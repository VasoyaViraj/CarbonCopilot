"""MCP Tool: get_recommendations

Reads the factory's deterministically scored recommendations from Express
(BR-06 score, estimated reduction, cost level, CO2e savings and payback).
The AI never scores interventions itself; it only explains these values.
"""

import logging
from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel, Field

from app.mcp.server import backend_get

logger = logging.getLogger("ecotrace.ai.mcp.recommendations")


class GetRecommendationsInput(BaseModel):
    factory_id: int = Field(..., gt=0)
    status: Optional[Literal["PENDING", "ACCEPTED", "REJECTED", "IMPLEMENTED"]] = None


async def get_recommendations(factory_id: int, status: Optional[str] = None) -> Dict[str, Any]:
    """Fetch ranked recommendations (docs/API_CONTRACT.md §8).

    Returns:
        { factory, generatedAt, weights, assumptions, recommendations }, ranked
        by score (highest first).

    Raises:
        ValueError: on invalid input.
        RuntimeError: if the backend is unreachable.
    """
    validated = GetRecommendationsInput(factory_id=factory_id, status=status)
    logger.info("Tool: get_recommendations factory_id=%s status=%s", validated.factory_id, validated.status)

    params = {"status": validated.status} if validated.status else None
    data = await backend_get(f"/factories/{validated.factory_id}/recommendations", params=params)
    return data if isinstance(data, dict) else {"recommendations": data}
