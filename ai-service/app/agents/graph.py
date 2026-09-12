"""LangGraph agent graph definition.

This module compiles the EcoTrace StateGraph that routes a user message
through intent classification → data loading → response generation.

The graph is compiled once at import time and reused across requests.
"""

import logging

from langgraph.graph import END, START, StateGraph

from app.agents.hotspot_workflow import (
    CALCULATE_EMISSIONS,
    IDENTIFY_HOTSPOTS,
    ROOT_CAUSE_ANALYSIS,
    calculate_emissions,
    identify_hotspots,
    root_cause_analysis,
    route_after_factory_data,
)
from app.agents.recommendation_workflow import (
    CALCULATE_IMPACT,
    FETCH_ALTERNATIVES,
    FETCH_HOTSPOTS,
    RANK_INTERVENTIONS,
    calculate_impact,
    fetch_circular_alternatives,
    fetch_hotspots,
    rank_interventions_node,
    route_after_factory_data_rec,
)
from app.agents.intent_router import GENERATE_RESPONSE, LOAD_FACTORY_DATA, Intent, route_intent
from app.agents.state import AgentState
from app.agents.nodes import classify_intent, load_factory_data, generate_response

logger = logging.getLogger("ecotrace.ai.graph")


def _route_after_intent(state: AgentState) -> str:
    """Conditional edge: send each intent to the minimum workflow it needs."""
    return route_intent(state.get("intent"))


def _route_after_factory_data(state: AgentState) -> str:
    """Conditional edge: dispatch to the correct workflow after factory data is loaded."""
    intent = state.get("intent")
    if intent == Intent.HOTSPOT_ANALYSIS.value:
        return CALCULATE_EMISSIONS
    if intent == Intent.RECOMMENDATION.value:
        return FETCH_HOTSPOTS
    return GENERATE_RESPONSE


def _build_graph() -> StateGraph:
    """Construct and compile the EcoTrace agent graph."""

    builder = StateGraph(AgentState)

    # -----------------------------------------------------------------------
    # Nodes
    # -----------------------------------------------------------------------
    builder.add_node("intent_router", classify_intent)
    builder.add_node(LOAD_FACTORY_DATA, load_factory_data)
    builder.add_node(GENERATE_RESPONSE, generate_response)

    # Hotspot analysis workflow
    builder.add_node(CALCULATE_EMISSIONS, calculate_emissions)
    builder.add_node(IDENTIFY_HOTSPOTS, identify_hotspots)
    builder.add_node(ROOT_CAUSE_ANALYSIS, root_cause_analysis)

    # Recommendation workflow
    builder.add_node(FETCH_HOTSPOTS, fetch_hotspots)
    builder.add_node(FETCH_ALTERNATIVES, fetch_circular_alternatives)
    builder.add_node(CALCULATE_IMPACT, calculate_impact)
    builder.add_node(RANK_INTERVENTIONS, rank_interventions_node)

    # -----------------------------------------------------------------------
    # Edges
    # -----------------------------------------------------------------------
    builder.add_edge(START, "intent_router")
    builder.add_conditional_edges(
        "intent_router",
        _route_after_intent,
        {LOAD_FACTORY_DATA: LOAD_FACTORY_DATA, GENERATE_RESPONSE: GENERATE_RESPONSE},
    )

    # After factory data: dispatch to correct workflow
    builder.add_conditional_edges(
        LOAD_FACTORY_DATA,
        _route_after_factory_data,
        {
            CALCULATE_EMISSIONS: CALCULATE_EMISSIONS,
            FETCH_HOTSPOTS: FETCH_HOTSPOTS,
            GENERATE_RESPONSE: GENERATE_RESPONSE,
        },
    )

    # Hotspot workflow chain
    builder.add_edge(CALCULATE_EMISSIONS, IDENTIFY_HOTSPOTS)
    builder.add_edge(IDENTIFY_HOTSPOTS, ROOT_CAUSE_ANALYSIS)
    builder.add_edge(ROOT_CAUSE_ANALYSIS, GENERATE_RESPONSE)

    # Recommendation workflow chain
    builder.add_edge(FETCH_HOTSPOTS, FETCH_ALTERNATIVES)
    builder.add_edge(FETCH_ALTERNATIVES, CALCULATE_IMPACT)
    builder.add_edge(CALCULATE_IMPACT, RANK_INTERVENTIONS)
    builder.add_edge(RANK_INTERVENTIONS, GENERATE_RESPONSE)

    builder.add_edge(GENERATE_RESPONSE, END)

    graph = builder.compile()
    logger.info("EcoTrace LangGraph compiled successfully.")
    return graph


# Singleton compiled graph — imported by the API route
ecotrace_graph = _build_graph()
