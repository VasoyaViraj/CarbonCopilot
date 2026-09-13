"""MCP Tool: get_factory_profile

Fetches the factory profile (name, industry, processes) from Express backend.
Input validated via Pydantic; output is a typed dict the LLM can explain.
"""

import asyncio
import logging
from typing import Any, Dict

from pydantic import BaseModel, Field

from app.mcp.server import backend_get

logger = logging.getLogger("ecotrace.ai.mcp.factory_profile")


# ---------------------------------------------------------------------------
# Input / Output schemas
# ---------------------------------------------------------------------------

class GetFactoryProfileInput(BaseModel):
    """Validated input for the get_factory_profile tool."""
    factory_id: int = Field(..., gt=0, description="ID of the factory to retrieve.")


class FactoryProfileOutput(BaseModel):
    """Structured factory profile returned to the agent."""
    id: int
    name: str
    industry_type: str | None = None
    location: str | None = None
    production_capacity: float | None = None
    production_unit: str | None = None
    process_count: int = 0

    model_config = {"extra": "ignore"}


# ---------------------------------------------------------------------------
# Tool function
# ---------------------------------------------------------------------------

async def get_factory_profile(factory_id: int) -> Dict[str, Any]:
    """Fetch factory profile from the Express backend.

    Args:
        factory_id: ID of the factory.

    Returns:
        Raw dict of factory data — the LLM explains this, never invents it.

    Raises:
        ValueError: if factory_id is invalid.
        RuntimeError: if the backend is unreachable.
    """
    validated = GetFactoryProfileInput(factory_id=factory_id)
    logger.info("Tool: get_factory_profile factory_id=%s", validated.factory_id)

    # GET /factories/:id returns the factory record only (API_CONTRACT §3); its processes
    # come from their own endpoint (§4).
    data, processes = await asyncio.gather(
        backend_get(f"/factories/{validated.factory_id}"),
        backend_get(f"/factories/{validated.factory_id}/processes"),
    )

    # data may be the factory object directly or wrapped in a `factory` key
    factory = data.get("factory", data) if isinstance(data, dict) else data
    processes = processes if isinstance(processes, list) else []

    factory["processes"] = [
        {"id": p.get("id"), "name": p.get("name"), "process_type": p.get("process_type")} for p in processes
    ]
    factory["process_count"] = len(processes)

    return factory
