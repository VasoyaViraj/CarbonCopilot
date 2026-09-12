"""AI Copilot request / response schemas.

All numeric values in responses come from deterministic tool results.
The LLM only generates the `answer` explanation text.
"""

from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ConfidenceLevel(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    UNAVAILABLE = "UNAVAILABLE"


class ToolUsed(BaseModel):
    """Metadata about a single MCP tool invocation during AI reasoning."""

    name: str = Field(..., description="Tool function name, e.g. identify_hotspots")
    input: Dict[str, Any] = Field(default_factory=dict)
    # Raw structured result returned by the tool (never fabricated by the LLM).
    output_summary: Optional[str] = Field(
        default=None,
        description="Brief human-readable summary of what the tool returned.",
    )


class RecommendationItem(BaseModel):
    """A single ranked circular-economy intervention."""

    rank: int
    name: str
    reduction_percent: Optional[float] = None
    cost_level: Optional[str] = None
    payback_years: Optional[float] = None
    score: Optional[float] = None
    reason: Optional[str] = None


class ScenarioSummary(BaseModel):
    """High-level projection from the what-if scenario engine."""

    baseline_emission: Optional[float] = None
    projected_emission: Optional[float] = None
    reduction_amount: Optional[float] = None
    reduction_percent: Optional[float] = None
    estimated_cost: Optional[float] = None
    estimated_savings: Optional[float] = None
    payback_period: Optional[str] = None  # "N/A" when savings are zero


# ---------------------------------------------------------------------------
# Request schema
# ---------------------------------------------------------------------------

class CopilotRequest(BaseModel):
    """Payload sent to POST /api/ai/copilot (proxied by Express)."""

    factory_id: int = Field(..., alias="factoryId", gt=0)
    conversation_id: Optional[int] = Field(default=None, alias="conversationId")
    message: str = Field(..., min_length=1, max_length=2000)

    model_config = {"populate_by_name": True}


# ---------------------------------------------------------------------------
# Response schema
# ---------------------------------------------------------------------------

class CopilotResponse(BaseModel):
    """Stable AI Copilot response contract consumed by the React frontend."""

    # Natural-language answer from the LLM (explains tool results; no invented numbers).
    answer: str
    tools_used: List[ToolUsed] = Field(default_factory=list, alias="toolsUsed")
    recommendations: List[RecommendationItem] = Field(default_factory=list)
    scenario: Optional[ScenarioSummary] = None
    # Caveats the model injected (e.g. "based on available data", "estimated").
    assumptions: List[str] = Field(default_factory=list)
    confidence: ConfidenceLevel = ConfidenceLevel.MEDIUM

    model_config = {"populate_by_name": True}
