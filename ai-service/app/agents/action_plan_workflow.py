"""Action plan workflow for the EcoTrace AI Copilot.

    intent_router → load_factory_data → action_plan_gather_context
    → action_plan_generate → generate_response

The gather step reads everything the plan needs from deterministic tools:
the hotspot ranking and the focus process's detail (for root-cause
findings), the ranked recommendations and the newest saved what-if
scenario. Nothing is calculated or saved. The generate step calls the
generate_action_plan tool, which returns a validated, grounded ActionPlan.
"""

import asyncio
import logging
from typing import Any, Dict, List

from app.agents.hotspot_workflow import build_root_cause, select_target_hotspot
from app.agents.intent_router import last_user_message
from app.agents.state import AgentState
from app.mcp.tools.action_plan import (
    ActionPlanContext,
    HotspotInput,
    ProjectedImpact,
    RecommendationInput,
    RootCauseFindings,
    generate_action_plan,
)
from app.mcp.tools.hotspots import get_hotspot_detail, get_hotspot_ranking
from app.mcp.tools.recommendations import get_recommendations
from app.mcp.tools.scenario import list_scenarios
from app.services.llm import get_llm

logger = logging.getLogger("ecotrace.ai.action_plan_workflow")

GATHER_CONTEXT = "action_plan_gather_context"
GENERATE_PLAN = "action_plan_generate"

# Recommendations a person has not already rejected or implemented.
_OPEN_STATUSES = {None, "PENDING", "ACCEPTED"}


def _tool_error(tool: str, exc: BaseException) -> Dict[str, Any]:
    logger.error("Tool %s failed: %s", tool, exc)
    return {"tool": tool, "error": str(exc)}


def _data_gap(tool: str) -> str:
    # Same wording as the root-cause analysis, so the two are de-duplicated.
    return f"The {tool} tool could not be reached, so its data is not included."


# ---------------------------------------------------------------------------
# Node: action_plan_gather_context
# ---------------------------------------------------------------------------
async def gather_action_plan_context(state: AgentState) -> Dict[str, Any]:
    """Read hotspots, recommendations and saved scenarios from the backend."""
    factory_id = state["factory_id"]
    results = dict(state.get("tool_results") or {})
    tools_used = ["get_hotspot_ranking", "get_recommendations", "list_scenarios"]
    errors: List[Dict[str, Any]] = []

    ranking, recommendations, scenarios = await asyncio.gather(
        get_hotspot_ranking(factory_id),
        get_recommendations(factory_id),
        list_scenarios(factory_id),
        return_exceptions=True,
    )
    for tool, key, value in (
        ("get_hotspot_ranking", "hotspot_ranking", ranking),
        ("get_recommendations", "recommendations", recommendations),
        ("list_scenarios", "saved_scenarios", scenarios),
    ):
        if isinstance(value, BaseException):
            errors.append(_tool_error(tool, value))
            results[key] = None
        else:
            results[key] = value

    # Root-cause findings for the process the user named, else hotspot #1.
    target, selection = select_target_hotspot(
        (results.get("hotspot_ranking") or {}).get("hotspots") or [],
        last_user_message(state["messages"]),
    )
    if target is not None and target.get("processId") is not None:
        results["hotspot_target"] = {"processId": target["processId"], "process": target.get("process"), "selection": selection}
        tools_used.append("get_hotspot_detail")
        try:
            results["hotspot_detail"] = await get_hotspot_detail(factory_id, target["processId"])
        except Exception as exc:
            errors.append(_tool_error("get_hotspot_detail", exc))

    return {"tool_results": results, "tools_used": tools_used, "tool_errors": errors}


# ---------------------------------------------------------------------------
# Context builder (deterministic)
# ---------------------------------------------------------------------------
def build_action_plan_context(tool_results: Dict[str, Any], tool_errors: List[Dict[str, Any]]) -> ActionPlanContext:
    """Map raw backend payloads onto the generate_action_plan input schema."""
    ranking = tool_results.get("hotspot_ranking") or {}
    unit = ranking.get("co2eUnit") or "tCO2e"
    profile = tool_results.get("factory_profile") or {}

    hotspots = [
        HotspotInput(
            rank=h.get("rank"),
            process_id=h.get("processId"),
            process=h["process"],
            emission=h.get("emission"),
            percentage=h.get("percentage"),
            severity=h.get("severity"),
        )
        for h in (ranking.get("hotspots") or [])[:5]
        if h.get("process")
    ]

    root_cause = None
    if tool_results.get("hotspot_target"):
        hotspot_errors = [e for e in tool_errors if e.get("tool") in ("get_hotspot_ranking", "get_hotspot_detail")]
        rca = build_root_cause(tool_results, hotspot_errors)
        root_cause = RootCauseFindings(
            process=rca.process,
            factory_data=[e.statement for e in rca.factory_data],
            derived_metrics=[e.statement for e in rca.derived_metrics],
            hypotheses=[e.statement for e in rca.hypotheses],
            missing_information=[e.statement for e in rca.missing_information],
            confidence=rca.confidence,
        )

    rec_payload = tool_results.get("recommendations") or {}
    raw_recs = rec_payload.get("recommendations") or [] if isinstance(rec_payload, dict) else rec_payload
    recommendations = [
        RecommendationInput(
            rank=r.get("rank") if r.get("rank") is not None else position,
            name=r.get("alternative") or r.get("name"),
            current_option=r.get("currentOption"),
            process=r.get("process"),
            score=r.get("score"),
            estimated_reduction_percent=r.get("estimatedReduction"),
            targeted_reduction_percent=r.get("reductionPercent"),
            estimated_savings=r.get("estimatedSavings"),
            savings_unit=r.get("savingsUnit"),
            cost_level=r.get("estimatedCost"),
            implementation_difficulty=r.get("implementationDifficulty"),
            payback_years=r.get("paybackPeriod"),
            status=r.get("status"),
            reason=r.get("reason"),
            assumptions=r.get("assumptions") or [],
        )
        for position, r in enumerate(raw_recs, start=1)
        if (r.get("alternative") or r.get("name")) and r.get("status") in _OPEN_STATUSES
    ]

    projected_impact = None
    scenarios = tool_results.get("saved_scenarios") or []
    if scenarios:
        latest = scenarios[0]  # the backend lists newest first
        projected_impact = ProjectedImpact(
            name=latest.get("name"),
            baseline_emission=latest.get("baselineEmission"),
            projected_emission=latest.get("projectedEmission"),
            reduction_amount=latest.get("reductionAmount"),
            reduction_percent=latest.get("reductionPercent"),
            estimated_cost=latest.get("estimatedCost"),
            estimated_savings=latest.get("estimatedSavings"),
            payback_years=latest.get("paybackPeriod"),
            unit=latest.get("unit") or unit,
            assumptions=latest.get("assumptions") or [],
        )

    data_gaps = []
    for error in tool_errors:
        gap = _data_gap(error.get("tool"))
        if gap not in data_gaps:
            data_gaps.append(gap)
    if isinstance(rec_payload, dict):
        for warning in rec_payload.get("warnings") or []:
            data_gaps.append(f"Data warning ({warning.get('code')}): {warning.get('message')}")

    return ActionPlanContext(
        factory_name=profile.get("name") or (ranking.get("factory") or {}).get("name"),
        co2e_unit=unit,
        total_emission=ranking.get("totalEmission"),
        hotspots=hotspots,
        root_cause=root_cause,
        recommendations=recommendations,
        projected_impact=projected_impact,
        assumptions=rec_payload.get("assumptions") or [] if isinstance(rec_payload, dict) else [],
        data_gaps=data_gaps,
    )


# ---------------------------------------------------------------------------
# Node: action_plan_generate
# ---------------------------------------------------------------------------
def _llm_or_none() -> Any:
    try:
        return get_llm()
    except Exception as exc:
        logger.warning("LLM unavailable; using the deterministic action plan: %s", exc)
        return None


def generate_action_plan_node(state: AgentState) -> Dict[str, Any]:
    """Build the grounded context and generate the structured action plan."""
    tool_results = state.get("tool_results") or {}
    context = build_action_plan_context(tool_results, state.get("tool_errors") or [])
    plan = generate_action_plan(context, llm=_llm_or_none())
    logger.info("Action plan generated (source=%s, confidence=%s)", plan.source.value, plan.confidence.value)
    return {
        "tool_results": {
            **tool_results,
            "action_plan_context": context.model_dump(mode="json"),
            "action_plan": plan.model_dump(mode="json"),
        },
        "tools_used": ["generate_action_plan"],
    }
