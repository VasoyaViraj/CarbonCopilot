"""MCP Tool: calculate_emissions

Calls the Express deterministic carbon engine to calculate CO2e for an activity.
The LLM must NOT perform this arithmetic — it only explains the result.
"""

import logging
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field

from app.mcp.server import backend_post

logger = logging.getLogger("ecotrace.ai.mcp.emissions")


# ---------------------------------------------------------------------------
# Input / Output schemas
# ---------------------------------------------------------------------------

class CalculateEmissionsInput(BaseModel):
    """Validated input for the calculate_emissions tool."""
    activity_type: str = Field(..., min_length=1)
    quantity: float = Field(..., ge=0)
    unit: str = Field(..., min_length=1)
    emission_factor_id: Optional[int] = Field(default=None, gt=0)


# ---------------------------------------------------------------------------
# Tool function
# ---------------------------------------------------------------------------

async def calculate_emissions(
    activity_type: str,
    quantity: float,
    unit: str,
    emission_factor_id: Optional[int] = None,
) -> Dict[str, Any]:
    """Call the Express deterministic carbon engine to compute CO2e.

    Args:
        activity_type: Energy / material type (e.g. "electricity", "natural_gas").
        quantity: Numeric quantity consumed.
        unit: Unit of measurement (e.g. "kWh", "m3", "L").
        emission_factor_id: Optional explicit factor ID; backend will look up
            the best available factor if omitted.

    Returns:
        Emission calculation result including co2eValue and calculationMethod.

    Raises:
        ValueError: on invalid input.
        RuntimeError: if backend is unreachable.
    """
    validated = CalculateEmissionsInput(
        activity_type=activity_type,
        quantity=quantity,
        unit=unit,
        emission_factor_id=emission_factor_id,
    )
    logger.info("Tool: calculate_emissions type=%s qty=%s %s", activity_type, quantity, unit)

    payload: Dict[str, Any] = {
        "activityType": validated.activity_type,
        "quantity": validated.quantity,
        "unit": validated.unit,
    }
    if validated.emission_factor_id:
        payload["emissionFactorId"] = validated.emission_factor_id

    return await backend_post("/emissions/calculate", payload)
