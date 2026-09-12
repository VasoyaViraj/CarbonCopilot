"""MCP Tool: find_circular_alternatives

Retrieves structured circular alternatives from the Express knowledge base.
Supports filtering by material, waste type, or energy category.
"""

import logging
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from app.mcp.server import backend_get

logger = logging.getLogger("ecotrace.ai.mcp.circular")


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class FindCircularAlternativesInput(BaseModel):
    factory_id: int = Field(..., gt=0)
    process_id: Optional[int] = Field(default=None, gt=0)
    material: Optional[str] = None
    waste: Optional[str] = None
    energy: Optional[str] = None


# ---------------------------------------------------------------------------
# Tool function
# ---------------------------------------------------------------------------

async def find_circular_alternatives(
    factory_id: int,
    process_id: Optional[int] = None,
    material: Optional[str] = None,
    waste: Optional[str] = None,
    energy: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Retrieve circular alternatives from the Express knowledge base.

    Uses structured PostgreSQL retrieval — no RAG or fabricated results.

    Args:
        factory_id: The factory context.
        process_id: Optional process to narrow alternatives.
        material: Current material option to replace.
        waste: Waste type to address.
        energy: Energy type to substitute.

    Returns:
        List of circular alternative records sorted by circularity score.
    """
    validated = FindCircularAlternativesInput(
        factory_id=factory_id,
        process_id=process_id,
        material=material,
        waste=waste,
        energy=energy,
    )
    logger.info(
        "Tool: find_circular_alternatives factory_id=%s material=%s waste=%s energy=%s",
        validated.factory_id, validated.material, validated.waste, validated.energy,
    )

    params: Dict[str, Any] = {}
    if validated.material:
        params["material"] = validated.material
    if validated.waste:
        params["waste"] = validated.waste
    if validated.energy:
        params["energy"] = validated.energy
    if validated.process_id:
        params["processId"] = validated.process_id

    data = await backend_get("/circular/alternatives", params=params)
    alternatives = data.get("alternatives", data) if isinstance(data, dict) else data
    return alternatives
