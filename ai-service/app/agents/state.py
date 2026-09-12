"""LangGraph agent state definition.

AgentState is the shared mutable context passed through every node of the graph.
"""

from typing import Annotated, Any, Dict, List, Optional

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages
from typing_extensions import TypedDict


class AgentState(TypedDict):
    """Shared state flowing through every node of the EcoTrace LangGraph."""

    # Full message history (HumanMessage / AIMessage / ToolMessage).
    # `add_messages` is a reducer that appends rather than replaces.
    messages: Annotated[List[BaseMessage], add_messages]

    # Authenticated factory context
    factory_id: int

    # Classified intent from the intent-router node
    # Values: FACTORY_OVERVIEW | HOTSPOT_ANALYSIS | RECOMMENDATION |
    #         SCENARIO | ACTION_PLAN | GENERAL_CARBON_QUESTION
    intent: Optional[str]

    # Structured results returned by MCP tools (keyed by tool name)
    tool_results: Dict[str, Any]

    # Final answer text produced by the generate_response node
    final_answer: Optional[str]

    # Caveats / assumptions the model added
    assumptions: List[str]

    # Confidence tier: HIGH | MEDIUM | LOW | UNAVAILABLE
    confidence: str
