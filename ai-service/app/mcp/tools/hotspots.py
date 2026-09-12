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

class HotspotDetailInput(BaseModel):
    factory_id: int = Field(..., gt=0)
    process_id: int = Field(..., gt=0)


async def get_hotspot_ranking(factory_id: int) -> Dict[str, Any]:
    """Retrieve the full deterministic hotspot ranking from Express.

    Unlike `identify_hotspots`, this keeps the ranking's context: factory
    total, co2eUnit, severity thresholds and data-quality warnings.

    Raises:
        ValueError: on invalid input.
        RuntimeError: if backend is unreachable.
    """
    validated = IdentifyHotspotsInput(factory_id=factory_id)
    logger.info("Tool: get_hotspot_ranking factory_id=%s", validated.factory_id)

    data = await backend_get(f"/factories/{validated.factory_id}/hotspots")

    # Backend may return { hotspots: [...] } or a list directly
    return data if isinstance(data, dict) else {"hotspots": data}


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
    ranking = await get_hotspot_ranking(factory_id)
    return ranking.get("hotspots", [])


async def get_hotspot_detail(factory_id: int, process_id: int) -> Dict[str, Any]:
    """Retrieve one process's hotspot position and emission drivers from Express.

    Returns the backend's process detail: rank, share, severity, drivers
    (emissions by activity type), simulated share, production and intensity.

    Raises:
        ValueError: on invalid input.
        httpx.HTTPStatusError: 404 when the process is not in the factory.
        RuntimeError: if backend is unreachable.
    """
    validated = HotspotDetailInput(factory_id=factory_id, process_id=process_id)
    logger.info(
        "Tool: get_hotspot_detail factory_id=%s process_id=%s",
        validated.factory_id,
        validated.process_id,
    )
    return await backend_get(f"/factories/{validated.factory_id}/hotspots/{validated.process_id}")
