"""Runs a copilot question through the LangGraph agent.

The final graph state is mapped onto the stable CopilotResponse contract.
Every backend call made while answering is scoped to the acting user, so the
Express API applies that user's organization/factory authorization.
"""

import logging
from typing import Any, Dict

from langchain_core.messages import HumanMessage

from app.agents.graph import ecotrace_graph
from app.agents.intent_router import Intent
from app.agents.recommendation_workflow import build_recommendation_evidence
from app.agents.scenario_workflow import build_scenario_evidence
from app.mcp.server import reset_acting_user, set_acting_user
from app.schemas.ai_response import (
    ConfidenceLevel,
    CopilotRequest,
    CopilotResponse,
    RecommendationItem,
    ScenarioSummary,
    ToolUsed,
)

logger = logging.getLogger("ecotrace.ai.copilot")


async def run_copilot(request: CopilotRequest, acting_user_id: int) -> CopilotResponse:
    """Answer one copilot message for `acting_user_id`."""
    token = set_acting_user(acting_user_id)
    try:
        state = await ecotrace_graph.ainvoke({
            "messages": [HumanMessage(content=request.message)],
            "factory_id": request.factory_id,
            "tool_results": {},
            "assumptions": [],
            "confidence": ConfidenceLevel.UNAVAILABLE.value,
        })
    finally:
        reset_acting_user(token)
    return build_copilot_response(state)


def _confidence(value: Any) -> ConfidenceLevel:
    try:
        return ConfidenceLevel(value)
    except ValueError:
        return ConfidenceLevel.UNAVAILABLE


def build_copilot_response(state: Dict[str, Any]) -> CopilotResponse:
    """Map the final agent state onto the response contract. Pure and deterministic."""
    tool_results = state.get("tool_results") or {}
    tool_errors = state.get("tool_errors") or []
    intent = state.get("intent")

    recommendations = []
    if intent == Intent.RECOMMENDATION.value and tool_results.get("ranked_interventions") is not None:
        evidence = build_recommendation_evidence(tool_results, tool_errors)
        recommendations = [
            RecommendationItem(
                rank=item["rank"],
                name=item.get("name") or "Unnamed intervention",
                reduction_percent=item.get("reduction_percent"),
                cost_level=item.get("cost_level"),
                payback_years=item.get("estimated_payback_years"),
                score=item.get("score"),
                reason=item.get("description"),
            )
            for item in evidence.interventions
            if item.get("rank") is not None
        ]

    scenario = None
    if intent == Intent.SCENARIO.value and tool_results.get("scenario_result"):
        evidence = build_scenario_evidence(tool_results, tool_errors)
        scenario = ScenarioSummary(
            baseline_emission=evidence.baseline_emission,
            projected_emission=evidence.projected_emission,
            reduction_amount=evidence.reduction_amount,
            reduction_percent=evidence.reduction_percent,
            estimated_cost=evidence.estimated_cost,
            estimated_savings=evidence.estimated_savings,
            payback_period=evidence.payback_period,
            unit=evidence.co2e_unit,
        )

    tools = list(dict.fromkeys(state.get("tools_used") or []))
    response = CopilotResponse(
        answer=state.get("final_answer") or "",
        tools_used=[ToolUsed(name=name) for name in tools],
        recommendations=recommendations,
        scenario=scenario,
        assumptions=state.get("assumptions") or [],
        confidence=_confidence(state.get("confidence")),
        intent=intent,
        action_plan=tool_results.get("action_plan") if intent == Intent.ACTION_PLAN.value else None,
    )
    logger.info("Copilot answered (intent=%s, confidence=%s, tools=%s)", intent, response.confidence.value, tools)
    return response
