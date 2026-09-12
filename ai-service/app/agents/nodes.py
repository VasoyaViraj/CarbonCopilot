"""LangGraph node functions for the EcoTrace AI agent.

Each node receives the current AgentState, performs its work,
and returns a dict with the state keys it wants to update.

Rules (from ADR-003 / BUSINESS_RULES):
- The LLM never performs authoritative arithmetic.
- All numeric data comes from tool_results populated by MCP tools.
- Simulated readings are always labelled as simulated.
"""

import json
import logging
from typing import Any, Dict

from langchain_core.messages import AIMessage, SystemMessage

from app.agents.hotspot_workflow import HOTSPOT_RESPONSE_RULES
from app.agents.intent_router import Intent, classify_message, last_user_message
from app.agents.recommendation_workflow import build_recommendation_evidence
from app.agents.scenario_workflow import build_scenario_evidence
from app.agents.state import AgentState
from app.mcp.tools.action_plan import ActionPlan, render_action_plan
from app.services.llm import get_llm

logger = logging.getLogger("ecotrace.ai.nodes")


def _llm_or_none() -> Any:
    """Return the LLM, or None if it cannot be initialised (rules-only routing)."""
    try:
        return get_llm()
    except Exception as exc:
        logger.warning("LLM unavailable for intent routing: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Node: classify_intent (the intent router)
# ---------------------------------------------------------------------------
def classify_intent(state: AgentState) -> Dict[str, Any]:
    """Classify the latest user message into a structured intent.

    Only the message text is inspected — no factory data is loaded yet, so the
    classification cannot contain factory-specific claims.
    """
    message = last_user_message(state["messages"])
    classification = classify_message(message, llm=_llm_or_none())

    logger.info(
        "Classified intent: %s (source=%s, confidence=%.2f, clarify=%s)",
        classification.intent.value,
        classification.source.value,
        classification.confidence,
        classification.needs_clarification,
    )
    return {
        "intent": classification.intent.value,
        "intent_classification": classification.model_dump(mode="json"),
    }


# ---------------------------------------------------------------------------
# Node: load_factory_data
# ---------------------------------------------------------------------------
async def load_factory_data(state: AgentState) -> Dict[str, Any]:
    """Load factory profile from the Express backend via the MCP tool.

    Results are stored in tool_results so downstream nodes can explain them
    without re-fetching.
    """
    from app.mcp.tools.factory_profile import get_factory_profile

    factory_id = state["factory_id"]
    logger.info("Loading factory data for factory_id=%s", factory_id)

    try:
        profile = await get_factory_profile(factory_id)
        return {
            "tool_results": {**state.get("tool_results", {}), "factory_profile": profile},
            "tools_used": ["get_factory_profile"],
        }
    except Exception as exc:
        logger.error("Failed to load factory data: %s", exc)
        return {
            "tool_results": {**state.get("tool_results", {}), "factory_profile": None},
            "tools_used": ["get_factory_profile"],
            "tool_errors": [{"tool": "get_factory_profile", "error": str(exc)}],
        }


# ---------------------------------------------------------------------------
# Node: generate_response
# ---------------------------------------------------------------------------
# Response rules injected when the recommendation workflow has run.
RECOMMENDATION_RESPONSE_RULES = """

Recommendation workflow rules:
- The interventions below were matched and scored by the deterministic recommendation service. They are the ONLY source of scores, reductions, savings, cost levels and payback figures. Quote them exactly; do not add, round, convert or combine them.
- Explain the ranking in rank order: name, target, score (0–100, BR-06), estimated_reduction_percent (share of factory emissions), estimated_savings with savings_unit, cost_level and payback_years.
- A payback_years of null means payback is not available — say "N/A".
- Use the wording "estimated" and "projected" — never guarantee outcomes. Savings of different interventions can overlap, so never add them together.
- If the list is empty, say no recommendations are available and explain what is missing.
- Never invent interventions or numbers that are not in the list.
- Mention all items in missing_information."""

# Response rules injected when the scenario workflow has run.
SCENARIO_RESPONSE_RULES = """

Scenario workflow rules:
- The scenario values below are the ONLY source of baseline, projected, reduction and financial figures. Quote them exactly.
- Use the wording "projected" and "estimated" throughout — never guarantee outcomes.
- If needs_clarification is true, do NOT present any numbers; instead ask the clarification_question.
- If baseline_emission is zero or unavailable, say the factory has no recorded emissions and a scenario cannot be calculated.
- payback_period of 'N/A' means annual savings are unavailable — state this clearly.
- Never invent percentages, costs or savings not present in the data.
- Mention all items in missing_information and assumptions."""


def generate_response(state: AgentState) -> Dict[str, Any]:
    """Generate the final natural-language answer.

    The LLM receives grounded tool results as context and produces an explanation.
    It must NEVER invent numeric values — it only explains what the tools returned.

    Workflows supported:
    - Hotspot analysis: uses root_cause evidence block.
    - Recommendation: uses RecommendationEvidence block.
    - All others: dumps raw tool_results.
    """
    intent = state.get("intent", "GENERAL_CARBON_QUESTION")
    tool_results = state.get("tool_results", {})
    tool_errors = state.get("tool_errors") or []
    messages = state["messages"]

    if intent == Intent.ACTION_PLAN.value and tool_results.get("action_plan"):
        # The plan is already structured and grounding-checked; render it as is
        # rather than letting a second LLM call restate its numbers.
        plan = ActionPlan.model_validate(tool_results["action_plan"])
        answer = render_action_plan(plan)
        logger.info("Rendered action plan (source=%s, confidence=%s)", plan.source.value, plan.confidence.value)
        return {
            "messages": [AIMessage(content=answer)],
            "final_answer": answer,
            "assumptions": plan.risks_and_limitations,
            "confidence": plan.confidence.value,
        }

    root_cause = state.get("root_cause")

    if root_cause:
        # Hotspot workflow: use the grounded evidence block.
        tool_context = json.dumps(root_cause, indent=2, default=str)
        workflow_rules = HOTSPOT_RESPONSE_RULES
        evidence_assumptions = [item["statement"] for item in root_cause.get("missing_information", [])]
        evidence_confidence = root_cause.get("confidence", "MEDIUM")

    elif intent == Intent.RECOMMENDATION.value and tool_results.get("ranked_interventions") is not None:
        # Recommendation workflow: build grounded evidence, give LLM a clean structure.
        rec_evidence = build_recommendation_evidence(tool_results, tool_errors)
        tool_context = json.dumps(rec_evidence.model_dump(mode="json"), indent=2, default=str)
        workflow_rules = RECOMMENDATION_RESPONSE_RULES
        evidence_assumptions = rec_evidence.assumptions + rec_evidence.missing_information
        evidence_confidence = rec_evidence.confidence.value

    elif intent == Intent.SCENARIO.value and "scenario_result" in tool_results:
        # Scenario workflow: build grounded evidence from deterministic engine output.
        scen_evidence = build_scenario_evidence(tool_results, tool_errors)
        tool_context = json.dumps(scen_evidence.model_dump(mode="json"), indent=2, default=str)
        workflow_rules = SCENARIO_RESPONSE_RULES
        evidence_assumptions = scen_evidence.assumptions + scen_evidence.missing_information
        evidence_confidence = scen_evidence.confidence.value

    else:
        tool_context = json.dumps(tool_results, indent=2, default=str) if tool_results else "No tool data available."
        workflow_rules = ""
        evidence_assumptions = None
        evidence_confidence = None

    classification = state.get("intent_classification") or {}
    clarification_rule = (
        "\n6. The request is ambiguous. Do not make factory-specific claims; give a brief general answer "
        "and ask one short clarifying question about what the user wants to analyse."
        if classification.get("needs_clarification")
        else ""
    )

    system_prompt = f"""You are EcoTrace AI Copilot, a sustainability analysis assistant.

Your role is to explain carbon emission data for a factory. You have access to actual calculated data from deterministic tools.

Rules you MUST follow:
1. Only use the numbers provided in the tool results below — never invent or estimate values.
2. If data is missing, say so explicitly.
3. Label any simulated readings clearly as "simulated".
4. Recommendations are decision-support, not guaranteed outcomes.
5. Always include relevant assumptions or limitations.{clarification_rule}{workflow_rules}

Current intent: {intent}

Tool results (calculated by deterministic services):
{tool_context}

Answer the user's question based on this data."""

    llm = get_llm()
    response = llm.invoke(
        [SystemMessage(content=system_prompt)] + messages
    )

    answer = response.content

    if evidence_assumptions is not None:
        assumptions = evidence_assumptions
        confidence = evidence_confidence
    else:
        assumption_keywords = ["estimated", "projected", "assumes", "based on available", "simulated"]
        assumptions = [
            sentence.strip()
            for sentence in answer.split(".")
            if any(kw in sentence.lower() for kw in assumption_keywords)
        ]
        confidence = "HIGH" if tool_results else "LOW"

    logger.info("Generated response (intent=%s, confidence=%s)", intent, confidence)

    return {
        "messages": [AIMessage(content=answer)],
        "final_answer": answer,
        "assumptions": assumptions,
        "confidence": confidence,
    }
