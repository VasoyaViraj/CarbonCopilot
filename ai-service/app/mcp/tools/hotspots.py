"""MCP Tool: identify_hotspots

Calls the Express deterministic hotspot engine for a factory.
Returns process-level emission contributions ranked by severity.
"""

import logging
from typing import Any, Dict, List

from pydantic import BaseModel, Field

from app.mcp.server import backend_get

logger = logging.getLogger("ecotrace.ai.mcp.hotspots")


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class IdentifyHotspotsInput(BaseModel):
    factory_id: int = Field(..., gt=0)


class HotspotItem(BaseModel):
    """A single process-level hotspot entry."""
    process_id: int | None = None
    process_name: str
    total_emission: float
    percentage: float
    severity: str  # CRITICAL | HIGH | MEDIUM | LOW

    model_config = {"extra": "ignore", "populate_by_name": True}


# ---------------------------------------------------------------------------
# Tool function
# ---------------------------------------------------------------------------

async def identify_hotspots(factory_id: int) -> List[Dict[str, Any]]:
    """Retrieve deterministic process-level hotspot analysis from Express.

    Args:
        factory_id: ID of the factory to analyse.

    Returns:
        List of hotspot dicts sorted by emission descending.

    Raises:
        ValueError: on invalid input.
        RuntimeError: if backend is unreachable.
    """
    validated = IdentifyHotspotsInput(factory_id=factory_id)
    logger.info("Tool: identify_hotspots factory_id=%s", validated.factory_id)

    data = await backend_get(f"/factories/{validated.factory_id}/hotspots")

    # Backend may return { hotspots: [...] } or a list directly
    hotspots = data.get("hotspots", data) if isinstance(data, dict) else data
    return hotspots
