"""MCP Tool: generate_action_plan

Assembles hotspot + recommendation + scenario context and asks Gemini Flash
to produce a structured, grounded sustainability action plan.

The LLM explains and structures tool-derived data.
It NEVER invents numbers or guarantees outcomes.
"""

import logging
from typing import Any, Dict, List, Optional

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from app.services.llm import get_llm

logger = logging.getLogger("ecotrace.ai.mcp.action_plan")


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ActionPlanContext(BaseModel):
    """All tool-derived data passed into the action plan generator."""
    factory_name: Optional[str] = None
    hotspots: List[Dict[str, Any]] = Field(default_factory=list)
    recommendations: List[Dict[str, Any]] = Field(default_factory=list)
    scenario: Optional[Dict[str, Any]] = None
    assumptions: List[str] = Field(default_factory=list)


ACTION_PLAN_SYSTEM_PROMPT = """You are EcoTrace AI, a sustainability engineering assistant.

Generate a structured, actionable sustainability action plan for a factory based on the data provided below.

Rules you MUST follow:
1. Only reference the numbers, hotspots, and recommendations shown in the context.
2. Use "estimated" or "projected" language — never guarantee savings.
3. The factory operator is the final decision-maker; you are providing decision support.
4. Clearly separate known data from hypotheses.
5. Do not invent equipment conditions, costs, or emission factors.

Structure your response as:
1. Immediate Investigation (this week)
2. Short-term Actions (1–3 months)
3. Medium-term Interventions (3–12 months)
4. Key Measurements to Track
5. Expected Impact (use tool-derived numbers only)
6. Risks & Limitations
7. Success Metrics
"""


# ---------------------------------------------------------------------------
# Tool function
# ---------------------------------------------------------------------------

async def generate_action_plan(
    factory_name: Optional[str] = None,
    hotspots: Optional[List[Dict[str, Any]]] = None,
    recommendations: Optional[List[Dict[str, Any]]] = None,
    scenario: Optional[Dict[str, Any]] = None,
    assumptions: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Generate a structured sustainability action plan using Gemini Flash.

    All numeric context comes from MCP tool results.
    The LLM formats, explains, and structures — it does not calculate.

    Args:
        factory_name: Optional name of the factory for context.
        hotspots: List of hotspot dicts from identify_hotspots tool.
        recommendations: List of ranked recommendations from rank_interventions.
        scenario: Scenario result from calculate_scenario.
        assumptions: Any caveats already collected in the agent state.

    Returns:
        Dict with `action_plan` (text) and `metadata`.
    """
    context = ActionPlanContext(
        factory_name=factory_name,
        hotspots=hotspots or [],
        recommendations=recommendations or [],
        scenario=scenario,
        assumptions=assumptions or [],
    )

    logger.info(
        "Tool: generate_action_plan factory=%s hotspots=%d recommendations=%d",
        context.factory_name, len(context.hotspots), len(context.recommendations),
    )

    # Build a structured context string for the LLM
    context_text_parts = []

    if context.factory_name:
        context_text_parts.append(f"Factory: {context.factory_name}")

    if context.hotspots:
        context_text_parts.append("\nTop Emission Hotspots:")
        for h in context.hotspots[:5]:  # Top 5 only
            context_text_parts.append(
                f"  - {h.get('process_name', 'Unknown')}: "
                f"{h.get('total_emission', '?')} tCO2e "
                f"({h.get('percentage', '?')}%) — {h.get('severity', '?')}"
            )

    if context.recommendations:
        context_text_parts.append("\nRanked Interventions:")
        for r in context.recommendations[:5]:
            context_text_parts.append(
                f"  #{r.get('rank', '?')} {r.get('alternative_option') or r.get('name', 'Unknown')}: "
                f"Score={r.get('score') or r.get('circularity_score', '?')}, "
                f"Reduction={r.get('reduction_percent', '?')}%, "
                f"Cost={r.get('cost_level', '?')}, "
                f"Payback={r.get('estimated_payback_years', '?')} years"
            )

    if context.scenario:
        s = context.scenario
        context_text_parts.append("\nWhat-if Scenario Result:")
        context_text_parts.append(
            f"  Baseline: {s.get('baselineEmission', s.get('baseline_emission', '?'))} tCO2e\n"
            f"  Projected: {s.get('projectedEmission', s.get('projected_emission', '?'))} tCO2e\n"
            f"  Reduction: {s.get('reductionAmount', s.get('reduction_amount', '?'))} tCO2e "
            f"({s.get('reductionPercent', s.get('reduction_percent', '?'))}%)\n"
            f"  Estimated Cost: {s.get('estimatedCost', s.get('estimated_cost', 'N/A'))}\n"
            f"  Payback: {s.get('paybackPeriod', s.get('payback_period', 'N/A'))}"
        )

    if context.assumptions:
        context_text_parts.append(f"\nAssumptions: {'; '.join(context.assumptions)}")

    context_text = "\n".join(context_text_parts) or "No factory-specific data available."

    llm = get_llm()
    response = llm.invoke([
        SystemMessage(content=ACTION_PLAN_SYSTEM_PROMPT),
        HumanMessage(content=f"Generate an action plan based on this factory data:\n\n{context_text}"),
    ])

    return {
        "action_plan": response.content,
        "metadata": {
            "factory_name": context.factory_name,
            "hotspot_count": len(context.hotspots),
            "recommendation_count": len(context.recommendations),
            "scenario_included": context.scenario is not None,
        },
    }
