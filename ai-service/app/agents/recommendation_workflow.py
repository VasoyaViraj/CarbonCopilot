"""Recommendation workflow for the EcoTrace AI Copilot.

    intent_router → load_factory_data → fetch_hotspots
    → fetch_circular_alternatives → calculate_impact
    → rank_interventions → generate_response

Every number comes from the Express recommendation service (BR-06):
- circular alternatives are matched to the factory's recorded emissions by the
  backend's fixed rule table, not by the AI;
- estimated reduction, CO2e savings, cost level, payback and the weighted score
  are calculated and stored by that service;
- this workflow only selects, orders and explains them. It performs no
  arithmetic, so it can never attach a reduction to emissions an alternative
  does not target.

Recommendations are decision support, presented as estimated / projected.
A factory without recommendations is a valid result, reported as missing data.
"""

import logging
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from app.agents.intent_router import GENERATE_RESPONSE, Intent
from app.agents.state import AgentState
from app.mcp.tools.hotspots import get_hotspot_ranking
from app.mcp.tools.recommendations import get_recommendations
from app.schemas.ai_response import ConfidenceLevel

logger = logging.getLogger("ecotrace.ai.recommendation_workflow")

# ---------------------------------------------------------------------------
# Node name constants (imported by graph.py)
# ---------------------------------------------------------------------------
FETCH_HOTSPOTS = "recommendation_fetch_hotspots"
FETCH_ALTERNATIVES = "recommendation_fetch_alternatives"
CALCULATE_IMPACT = "recommendation_calculate_impact"
RANK_INTERVENTIONS = "recommendation_rank_interventions"

# Interventions a person has not already rejected or implemented.
_OPEN_STATUSES = {None, "PENDING", "ACCEPTED"}
# How many ranked interventions the response explains.
MAX_INTERVENTIONS = 5


def route_after_factory_data_rec(state: AgentState) -> str:
    """Conditional edge: only RECOMMENDATION intent runs this workflow."""
    if state.get("intent") == Intent.RECOMMENDATION.value:
        return FETCH_HOTSPOTS
    return GENERATE_RESPONSE


def _tool_error(tool: str, exc: Exception) -> Dict[str, Any]:
    logger.error("Tool %s failed: %s", tool, exc)
    return {"tool": tool, "error": str(exc)}


# ---------------------------------------------------------------------------
# Node: fetch_hotspots
# ---------------------------------------------------------------------------
async def fetch_hotspots(state: AgentState) -> Dict[str, Any]:
    """Retrieve the factory's deterministic hotspot ranking (the context for "fix first")."""
    tool = "get_hotspot_ranking"
    try:
        ranking = await get_hotspot_ranking(state["factory_id"])
    except Exception as exc:
        return {
            "tool_results": {**state.get("tool_results", {}), "hotspot_ranking": None},
            "tools_used": [tool],
            "tool_errors": [_tool_error(tool, exc)],
        }
    return {"tool_results": {**state.get("tool_results", {}), "hotspot_ranking": ranking}, "tools_used": [tool]}


# ---------------------------------------------------------------------------
# Node: fetch_circular_alternatives
# ---------------------------------------------------------------------------
async def fetch_circular_alternatives(state: AgentState) -> Dict[str, Any]:
    """Retrieve the circular alternatives the backend matched to this factory's emissions and scored."""
    tool = "get_recommendations"
    try:
        payload = await get_recommendations(state["factory_id"])
    except Exception as exc:
        return {
            "tool_results": {**state.get("tool_results", {}), "recommendations": None},
            "tools_used": [tool],
            "tool_errors": [_tool_error(tool, exc)],
        }
    return {"tool_results": {**state.get("tool_results", {}), "recommendations": payload}, "tools_used": [tool]}


# ---------------------------------------------------------------------------
# Node: calculate_impact
# ---------------------------------------------------------------------------
def to_intervention(recommendation: Dict[str, Any]) -> Dict[str, Any]:
    """Map one backend recommendation (API_CONTRACT §8) onto the evidence shape. Copies values only."""
    return {
        "rank": recommendation.get("rank"),
        "name": recommendation.get("alternative"),
        "current_option": recommendation.get("currentOption"),
        "category": recommendation.get("category"),
        "target": "Factory-wide" if recommendation.get("scope") == "FACTORY" else recommendation.get("process"),
        # Weighted BR-06 score on a 0–100 scale
        "score": recommendation.get("score"),
        # Share of the factory's emissions the intervention is estimated to avoid (%)
        "estimated_reduction_percent": recommendation.get("estimatedReduction"),
        # Knowledge-base reduction of the emissions the intervention targets (%)
        "targeted_reduction_percent": recommendation.get("reductionPercent"),
        "estimated_savings": recommendation.get("estimatedSavings"),
        "savings_unit": recommendation.get("savingsUnit"),
        "cost_level": recommendation.get("estimatedCost"),
        "implementation_difficulty": recommendation.get("implementationDifficulty"),
        # None when the knowledge base has no cost estimate (BR-09 → "N/A")
        "payback_years": recommendation.get("paybackPeriod"),
        "status": recommendation.get("status"),
        "reason": recommendation.get("reason"),
        "assumptions": recommendation.get("assumptions") or [],
    }


def calculate_impact(state: AgentState) -> Dict[str, Any]:
    """Attach each open recommendation's backend-calculated impact. No arithmetic happens here."""
    tool_results = state.get("tool_results") or {}
    payload = tool_results.get("recommendations")
    raw = (payload.get("recommendations") or []) if isinstance(payload, dict) else (payload or [])
    impacts = [
        to_intervention(item)
        for item in raw
        if item.get("alternative") and item.get("status") in _OPEN_STATUSES
    ]
    return {"tool_results": {**tool_results, "intervention_impacts": impacts}}


# ---------------------------------------------------------------------------
# Node: rank_interventions
# ---------------------------------------------------------------------------
def rank_interventions_node(state: AgentState) -> Dict[str, Any]:
    """Order interventions by the backend's deterministic BR-06 rank (score, then CO2e saved, then name)."""
    tool_results = state.get("tool_results") or {}
    impacts: List[Dict[str, Any]] = tool_results.get("intervention_impacts") or []
    ranked = sorted(impacts, key=lambda item: (item.get("rank") is None, item.get("rank") or 0))
    return {"tool_results": {**tool_results, "ranked_interventions": ranked}}


# ---------------------------------------------------------------------------
# Grounded evidence builder (deterministic — no LLM)
# ---------------------------------------------------------------------------
class RecommendationEvidence(BaseModel):
    """Structured grounded data the response node explains."""

    # Top hotspot context
    top_hotspot_process: Optional[str] = None
    top_hotspot_emission: Optional[float] = None
    top_hotspot_percent: Optional[float] = None
    top_hotspot_severity: Optional[str] = None
    co2e_unit: str = "tCO2e"
    total_factory_emission: Optional[float] = None

    # When the backend last scored the recommendations
    generated_at: Optional[str] = None
    # Ranked interventions (the top MAX_INTERVENTIONS are sent to the LLM)
    interventions: List[Dict[str, Any]] = Field(default_factory=list)
    alternative_count: int = 0

    missing_information: List[str] = Field(default_factory=list)
    assumptions: List[str] = Field(default_factory=list)
    confidence: ConfidenceLevel = ConfidenceLevel.UNAVAILABLE


def _dedupe(items: List[Optional[str]]) -> List[str]:
    return list(dict.fromkeys(item for item in items if item))


def build_recommendation_evidence(
    tool_results: Dict[str, Any],
    tool_errors: List[Dict[str, Any]],
) -> RecommendationEvidence:
    """Build grounded evidence from tool outputs. Pure and deterministic."""
    ranking = tool_results.get("hotspot_ranking") or {}
    hotspots = ranking.get("hotspots") or []
    payload = tool_results.get("recommendations")
    payload = payload if isinstance(payload, dict) else {}
    ranked: List[Dict[str, Any]] = tool_results.get("ranked_interventions") or []

    evidence = RecommendationEvidence(
        co2e_unit=ranking.get("co2eUnit") or "tCO2e",
        total_factory_emission=ranking.get("totalEmission"),
        generated_at=payload.get("generatedAt"),
        alternative_count=len(ranked),
    )

    if hotspots:
        top = hotspots[0]
        evidence.top_hotspot_process = top.get("process")
        evidence.top_hotspot_emission = top.get("emission")
        evidence.top_hotspot_percent = top.get("percentage")
        evidence.top_hotspot_severity = top.get("severity")

    evidence.interventions = [
        {key: value for key, value in item.items() if key != "assumptions"} for item in ranked[:MAX_INTERVENTIONS]
    ]

    # --- Missing information --------------------------------------------------
    failed = _dedupe([error.get("tool") for error in tool_errors])
    missing = [f"The {tool} tool could not be reached, so its data is not included." for tool in failed]
    if not hotspots and "get_hotspot_ranking" not in failed:
        missing.append("No hotspot data is available — emissions may not have been calculated for this factory yet.")
    if not ranked and "get_recommendations" not in failed:
        missing.append(
            "No open recommendations exist for this factory. Admins, factory operators and consultants "
            "can generate them on the Recommendations page."
        )
    unknown_payback = any(item.get("payback_years") is None for item in evidence.interventions)
    if unknown_payback:
        missing.append("Payback is not available for some interventions because the knowledge base has no cost estimate; it is shown as N/A.")
    evidence.missing_information = missing

    # --- Assumptions (as stated by the recommendation service) ----------------
    evidence.assumptions = _dedupe(
        list(payload.get("assumptions") or []) + [text for item in ranked for text in item.get("assumptions") or []]
    )

    # --- Confidence -----------------------------------------------------------
    if not ranked:
        evidence.confidence = ConfidenceLevel.UNAVAILABLE
    elif failed:
        evidence.confidence = ConfidenceLevel.LOW
    elif not hotspots or unknown_payback:
        evidence.confidence = ConfidenceLevel.MEDIUM
    else:
        evidence.confidence = ConfidenceLevel.HIGH

    return evidence
