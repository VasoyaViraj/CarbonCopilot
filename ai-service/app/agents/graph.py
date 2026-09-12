"""LangGraph agent graph definition.

This module compiles the EcoTrace StateGraph that routes a user message
through intent classification → data loading → response generation.

The graph is compiled once at import time and reused across requests.
"""

import logging

from langgraph.graph import END, START, StateGraph

from app.agents.intent_router import GENERATE_RESPONSE, LOAD_FACTORY_DATA, route_intent
from app.agents.state import AgentState
from app.agents.nodes import classify_intent, load_factory_data, generate_response

logger = logging.getLogger("ecotrace.ai.graph")


def _route_after_intent(state: AgentState) -> str:
    """Conditional edge: send each intent to the minimum workflow it needs."""
    return route_intent(state.get("intent"))


def _build_graph() -> StateGraph:
    """Construct and compile the EcoTrace agent graph."""

    builder = StateGraph(AgentState)

    # -----------------------------------------------------------------------
    # Nodes
    # -----------------------------------------------------------------------
    builder.add_node("intent_router", classify_intent)
    builder.add_node(LOAD_FACTORY_DATA, load_factory_data)
    builder.add_node(GENERATE_RESPONSE, generate_response)

    # -----------------------------------------------------------------------
    # Edges — factory-specific intents load data first; general questions
    # and clarification requests go straight to the response node.
    # Later phases replace load_factory_data with per-intent workflows.
    # -----------------------------------------------------------------------
    builder.add_edge(START, "intent_router")
    builder.add_conditional_edges(
        "intent_router",
        _route_after_intent,
        {LOAD_FACTORY_DATA: LOAD_FACTORY_DATA, GENERATE_RESPONSE: GENERATE_RESPONSE},
    )
    builder.add_edge(LOAD_FACTORY_DATA, GENERATE_RESPONSE)
    builder.add_edge(GENERATE_RESPONSE, END)

    graph = builder.compile()
    logger.info("EcoTrace LangGraph compiled successfully.")
    return graph


# Singleton compiled graph — imported by the API route
ecotrace_graph = _build_graph()
