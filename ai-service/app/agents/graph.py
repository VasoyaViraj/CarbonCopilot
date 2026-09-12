"""LangGraph agent graph definition.

This module compiles the EcoTrace StateGraph that routes a user message
through intent classification → data loading → response generation.

The graph is compiled once at import time and reused across requests.
"""

import logging

from langgraph.graph import END, START, StateGraph

from app.agents.state import AgentState
from app.agents.nodes import classify_intent, load_factory_data, generate_response

logger = logging.getLogger("ecotrace.ai.graph")


def _build_graph() -> StateGraph:
    """Construct and compile the EcoTrace agent graph skeleton."""

    builder = StateGraph(AgentState)

    # -----------------------------------------------------------------------
    # Nodes
    # -----------------------------------------------------------------------
    builder.add_node("classify_intent", classify_intent)
    builder.add_node("load_factory_data", load_factory_data)
    builder.add_node("generate_response", generate_response)

    # -----------------------------------------------------------------------
    # Edges — linear skeleton; Phase 15+ will add conditional routing per intent
    # -----------------------------------------------------------------------
    builder.add_edge(START, "classify_intent")
    builder.add_edge("classify_intent", "load_factory_data")
    builder.add_edge("load_factory_data", "generate_response")
    builder.add_edge("generate_response", END)

    graph = builder.compile()
    logger.info("EcoTrace LangGraph compiled successfully.")
    return graph


# Singleton compiled graph — imported by the API route
ecotrace_graph = _build_graph()
