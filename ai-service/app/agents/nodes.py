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

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from app.agents.state import AgentState
from app.services.llm import get_llm

logger = logging.getLogger("ecotrace.ai.nodes")

# ---------------------------------------------------------------------------
# Intent constants
# ---------------------------------------------------------------------------
INTENTS = {
    "FACTORY_OVERVIEW",
    "HOTSPOT_ANALYSIS",
    "RECOMMENDATION",
    "SCENARIO",
    "ACTION_PLAN",
    "GENERAL_CARBON_QUESTION",
}

INTENT_CLASSIFICATION_PROMPT = """You are an intent classifier for EcoTrace AI, a carbon-footprint analysis system.

Classify the user message into exactly one of these intents:
- FACTORY_OVERVIEW — questions about the factory profile, industry, processes
- HOTSPOT_ANALYSIS — questions about emission hotspots, biggest sources, root causes
- RECOMMENDATION — requests for what to fix, interventions, circular alternatives
- SCENARIO — what-if questions with specific percentage/parameter changes
- ACTION_PLAN — requests to generate a full sustainability action plan
- GENERAL_CARBON_QUESTION — general carbon/sustainability questions not specific to the factory

Return ONLY the intent label, nothing else."""


# ---------------------------------------------------------------------------
# Node: classify_intent
# ---------------------------------------------------------------------------
def classify_intent(state: AgentState) -> Dict[str, Any]:
    """Use the LLM to classify the user's message into a structured intent."""
    messages = state["messages"]
    last_user_msg = next(
        (m.content for m in reversed(messages) if isinstance(m, HumanMessage)), ""
    )

    llm = get_llm()
    classification = llm.invoke(
        [
            SystemMessage(content=INTENT_CLASSIFICATION_PROMPT),
            HumanMessage(content=last_user_msg),
        ]
    )

    intent_text = classification.content.strip().upper()
    if intent_text not in INTENTS:
        logger.warning("Unknown intent '%s', defaulting to GENERAL_CARBON_QUESTION", intent_text)
        intent_text = "GENERAL_CARBON_QUESTION"

    logger.info("Classified intent: %s", intent_text)
    return {"intent": intent_text}


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
        return {"tool_results": {**state.get("tool_results", {}), "factory_profile": profile}}
    except Exception as exc:
        logger.error("Failed to load factory data: %s", exc)
        return {"tool_results": {**state.get("tool_results", {}), "factory_profile": None}}


# ---------------------------------------------------------------------------
# Node: generate_response
# ---------------------------------------------------------------------------
def generate_response(state: AgentState) -> Dict[str, Any]:
    """Generate the final natural-language answer.

    The LLM receives the tool results as context and produces an explanation.
    It must NEVER invent numeric values — it only explains what the tools returned.
    """
    intent = state.get("intent", "GENERAL_CARBON_QUESTION")
    tool_results = state.get("tool_results", {})
    messages = state["messages"]

    tool_context = json.dumps(tool_results, indent=2, default=str) if tool_results else "No tool data available."

    system_prompt = f"""You are EcoTrace AI Copilot, a sustainability analysis assistant.

Your role is to explain carbon emission data for a factory. You have access to actual calculated data from deterministic tools.

Rules you MUST follow:
1. Only use the numbers provided in the tool results below — never invent or estimate values.
2. If data is missing, say so explicitly.
3. Label any simulated readings clearly as "simulated".
4. Recommendations are decision-support, not guaranteed outcomes.
5. Always include relevant assumptions or limitations.

Current intent: {intent}

Tool results (calculated by deterministic services):
{tool_context}

Answer the user's question based on this data."""

    llm = get_llm()
    response = llm.invoke(
        [SystemMessage(content=system_prompt)] + messages
    )

    answer = response.content

    # Extract assumptions heuristically — sentences containing certain keywords
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
