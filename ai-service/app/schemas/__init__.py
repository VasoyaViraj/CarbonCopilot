"""Validated data contracts shared by the AI service's tools and workflows."""

from app.schemas.operational import (
    Activity,
    ActivityCategory,
    ActivityEmission,
    ActivityPage,
    ActivitySource,
    CalculateEmissionsInput,
    EmissionCalculation,
    EmissionFactorSource,
)
from app.schemas.ai_response import (
    ConfidenceLevel,
    CopilotRequest,
    CopilotResponse,
    RecommendationItem,
    ScenarioSummary,
    ToolUsed,
)

__all__ = [
    # Operational
    "Activity",
    "ActivityCategory",
    "ActivityEmission",
    "ActivityPage",
    "ActivitySource",
    "CalculateEmissionsInput",
    "EmissionCalculation",
    "EmissionFactorSource",
    # AI response
    "ConfidenceLevel",
    "CopilotRequest",
    "CopilotResponse",
    "RecommendationItem",
    "ScenarioSummary",
    "ToolUsed",
]
