"""Recommendation workflow for the EcoTrace AI Copilot.

    intent_router → load_factory_data → fetch_hotspots
    → fetch_circular_alternatives → calculate_impact
    → rank_interventions → generate_response

Workflow rules (ADR-003 / BUSINESS_RULES):
- Every score, reduction %, cost level and payback comes from the deterministic
  Express backend or the circular knowledge-base. The LLM explains the ranking;
  it never invents numerical values.
- Recommendations are decision-support; they are presented as estimated /
  projected, never as guaranteed outcomes.
- A recommendation set with zero items is a valid result — the workflow
  surfaces it as missing data, not an error.
"""

import logging
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from app.agents.intent_router import GENERATE_RESPONSE, Intent
from app.agents.state import AgentState
from app.mcp.tools.circular import find_circular_alternatives
from app.mcp.tools.hotspots import get_hotspot_ranking
from app.mcp.tools.scenario import rank_interventions
from app.schemas.ai_response import ConfidenceLevel

logger = logging.getLogger("ecotrace.ai.recommendation_workflow")

# ---------------------------------------------------------------------------
# Node name constants (imported by graph.py)
# ---------------------------------------------------------------------------
FETCH_HOTSPOTS = "recommendation_fetch_hotspots"
FETCH_ALTERNATIVES = "recommendation_fetch_alternatives"
CALCULATE_IMPACT = "recommendation_calculate_impact"
RANK_INTERVENTIONS = "recommendation_rank_interventions"


# ---------------------------------------------------------------------------
# Routing
# ---------------------------------------------------------------------------
def route_after_factory_data_rec(state: AgentState) -> str:
    """Conditional edge: only RECOMMENDATION intent runs this workflow."""
    if state.get("intent") == Intent.RECOMMENDATION.value:
        return FETCH_HOTSPOTS
    return GENERATE_RESPONSE


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _tool_error(tool: str, exc: Exception) -> Dict[str, Any]:
    logger.error("Tool %s failed: %s", tool, exc)
    return {"tool": tool, "error": str(exc)}


def _fmt(value: Any) -> str:
    """Render a numeric value exactly as returned (no rounding), without trailing .0."""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value) if value is not None else "N/A"


# ---------------------------------------------------------------------------
# Node: fetch_hotspots
# Loads the ranked hotspot list so we know which processes to target.
# ---------------------------------------------------------------------------
async def fetch_hotspots(state: AgentState) -> Dict[str, Any]:
    """Retrieve the factory's deterministic hotspot ranking."""
    tool = "get_hotspot_ranking"
    try:
        ranking = await get_hotspot_ranking(state["factory_id"])
    except Exception as exc:
        return {
            "tool_results": {**state.get("tool_results", {}), "hotspot_ranking": None},
            "tools_used": [tool],
            "tool_errors": [_tool_error(tool, exc)],
        }

    return {
        "tool_results": {**state.get("tool_results", {}), "hotspot_ranking": ranking},
        "tools_used": [tool],
    }


# ---------------------------------------------------------------------------
# Node: fetch_circular_alternatives
# Retrieves alternatives from the structured PostgreSQL knowledge base.
# No RAG — deterministic structured retrieval only.
# ---------------------------------------------------------------------------
async def fetch_circular_alternatives(state: AgentState) -> Dict[str, Any]:
    """Retrieve circular alternatives from the Express knowledge base."""
    tool = "find_circular_alternatives"
    factory_id = state["factory_id"]

    # Derive top-process context for better matching
    ranking = (state.get("tool_results") or {}).get("hotspot_ranking") or {}
    top_hotspots: List[Dict[str, Any]] = (ranking.get("hotspots") or [])[:3]

    # Collect energy types from top hotspots to filter alternatives
    energy_types = list({
        h.get("energyType") or h.get("energy_type")
        for h in top_hotspots
        if h.get("energyType") or h.get("energy_type")
    })
    energy_param = energy_types[0] if energy_types else None

    try:
        alternatives = await find_circular_alternatives(
            factory_id=factory_id,
            energy=energy_param,
        )
    except Exception as exc:
        return {
            "tool_results": {**state.get("tool_results", {}), "circular_alternatives": []},
            "tools_used": [tool],
            "tool_errors": [_tool_error(tool, exc)],
        }

    return {
        "tool_results": {**state.get("tool_results", {}), "circular_alternatives": alternatives},
        "tools_used": [tool],
    }


# ---------------------------------------------------------------------------
# Node: calculate_impact
# Maps alternatives onto the hotspot list — computes estimated reduction
# quantities from the alternative's reduction_percent and hotspot emission.
# This is deterministic arithmetic, not LLM-generated.
# ---------------------------------------------------------------------------
def calculate_impact(state: AgentState) -> Dict[str, Any]:
    """Combine hotspot emissions with alternative reduction % to estimate impact."""
    tool_results = state.get("tool_results") or {}
    ranking = tool_results.get("hotspot_ranking") or {}
    hotspots: List[Dict[str, Any]] = ranking.get("hotspots") or []
    alternatives: List[Dict[str, Any]] = tool_results.get("circular_alternatives") or []
    co2e_unit: str = ranking.get("co2eUnit") or "tCO2e"

    # Total factory emission for impact context
    total_emission: Optional[float] = ranking.get("totalEmission")

    enriched: List[Dict[str, Any]] = []
    for alt in alternatives:
        reduction_pct: Optional[float] = alt.get("reduction_percent") or alt.get("reductionPercent")

        # Estimated absolute reduction against the top hotspot (if data allows)
        estimated_reduction_absolute: Optional[float] = None
        target_process: Optional[str] = None
        if hotspots and reduction_pct is not None:
            top = hotspots[0]
            top_emission: Optional[float] = top.get("emission") or top.get("total_emission")
            if top_emission is not None:
                estimated_reduction_absolute = round(top_emission * reduction_pct / 100, 4)
                target_process = top.get("process") or top.get("processName")

        enriched.append({
            **alt,
            # Keep deterministic backend fields, add derived estimates below
            "estimated_reduction_absolute": estimated_reduction_absolute,
            "estimated_reduction_unit": co2e_unit if estimated_reduction_absolute is not None else None,
            "target_process": target_process,
            # Normalised score for ranking — prefer circularity_score, fall back to reduction_percent
            "score": alt.get("circularity_score") or alt.get("circularityScore") or reduction_pct or 0.0,
        })

    # Store the total factory emission and co2eUnit for the response node
    impact_summary = {
        "total_factory_emission": total_emission,
        "co2e_unit": co2e_unit,
        "alternative_count": len(enriched),
    }

    return {
        "tool_results": {
            **tool_results,
            "enriched_alternatives": enriched,
            "impact_summary": impact_summary,
        },
        "tools_used": ["calculate_impact"],
    }


# ---------------------------------------------------------------------------
# Node: rank_interventions
# Deterministic sort — no LLM involvement in ranking.
# ---------------------------------------------------------------------------
def rank_interventions_node(state: AgentState) -> Dict[str, Any]:
    """Deterministically rank the enriched alternatives by score."""
    tool_results = state.get("tool_results") or {}
    enriched: List[Dict[str, Any]] = tool_results.get("enriched_alternatives") or []

    ranked = rank_interventions(enriched) if enriched else []

    return {
        "tool_results": {**tool_results, "ranked_interventions": ranked},
        "tools_used": ["rank_interventions"],
    }


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

    # Ranked interventions (top 5 only sent to the LLM)
    interventions: List[Dict[str, Any]] = Field(default_factory=list)

    # Metadata / data quality
    alternative_count: int = 0
    missing_information: List[str] = Field(default_factory=list)
    assumptions: List[str] = Field(default_factory=list)
    confidence: ConfidenceLevel = ConfidenceLevel.UNAVAILABLE


def build_recommendation_evidence(
    tool_results: Dict[str, Any],
    tool_errors: List[Dict[str, Any]],
) -> RecommendationEvidence:
    """Build grounded evidence from tool outputs. Pure and deterministic."""
    ranking = tool_results.get("hotspot_ranking") or {}
    hotspots = ranking.get("hotspots") or []
    ranked = tool_results.get("ranked_interventions") or []
    impact = tool_results.get("impact_summary") or {}

    ev = RecommendationEvidence(
        co2e_unit=impact.get("co2e_unit") or ranking.get("co2eUnit") or "tCO2e",
        total_factory_emission=impact.get("total_factory_emission") or ranking.get("totalEmission"),
        alternative_count=impact.get("alternative_count", len(ranked)),
    )

    # --- Top hotspot context -------------------------------------------------
    if hotspots:
        top = hotspots[0]
        ev.top_hotspot_process = top.get("process") or top.get("processName")
        ev.top_hotspot_emission = top.get("emission") or top.get("total_emission")
        ev.top_hotspot_percent = top.get("percentage")
        ev.top_hotspot_severity = top.get("severity")

    # --- Ranked interventions (top 5) ----------------------------------------
    ev.interventions = [
        {
            "rank": item.get("rank"),
            "name": item.get("alternative_option") or item.get("alternativeOption"),
            "current_option": item.get("current_option") or item.get("currentOption"),
            "category": item.get("category"),
            "score": item.get("score") or item.get("circularity_score") or item.get("circularityScore"),
            "reduction_percent": item.get("reduction_percent") or item.get("reductionPercent"),
            "estimated_reduction_absolute": item.get("estimated_reduction_absolute"),
            "cost_level": item.get("cost_level") or item.get("costLevel"),
            "estimated_payback_years": item.get("estimated_payback_years") or item.get("estimatedPaybackYears"),
            "target_process": item.get("target_process"),
            "description": item.get("description"),
        }
        for item in ranked[:5]
    ]

    # --- Missing information --------------------------------------------------
    if not hotspots:
        ev.missing_information.append(
            "No hotspot data is available — ensure emissions have been calculated for this factory."
        )
    if not ranked:
        ev.missing_information.append(
            "No circular alternatives are in the knowledge base for this factory's current options."
        )
    for err in tool_errors:
        ev.missing_information.append(
            f"The {err.get('tool')} tool could not be reached; its data is not included."
        )
    if ev.interventions and any(i.get("estimated_reduction_absolute") is None for i in ev.interventions):
        ev.missing_information.append(
            "Some reduction estimates are expressed as percentages only; "
            "absolute tCO2e impact could not be calculated for all items."
        )

    # --- Assumptions ----------------------------------------------------------
    ev.assumptions.append(
        "Reduction percentages are estimates from the circular alternatives knowledge base, "
        "not guaranteed outcomes. Real savings depend on implementation details."
    )
    if ev.interventions:
        ev.assumptions.append(
            "Rankings are based on a composite circularity score; "
            "financial and operational feasibility should be validated on site."
        )

    # --- Confidence -----------------------------------------------------------
    if not ranked:
        ev.confidence = ConfidenceLevel.UNAVAILABLE
    elif tool_errors:
        ev.confidence = ConfidenceLevel.LOW
    elif any(i.get("estimated_reduction_absolute") is None for i in ev.interventions):
        ev.confidence = ConfidenceLevel.MEDIUM
    else:
        ev.confidence = ConfidenceLevel.HIGH

    return ev
