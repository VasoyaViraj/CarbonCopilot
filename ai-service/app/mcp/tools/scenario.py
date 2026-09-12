"""MCP Tools: calculate_scenario + rank_interventions

calculate_scenario — calls the Express what-if engine; never mutates baseline data.
rank_interventions — deterministic local sort of candidates by weighted score.
"""

import logging
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from app.mcp.server import backend_get, backend_post

logger = logging.getLogger("ecotrace.ai.mcp.scenario")


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class InterventionParameters(BaseModel):
    """Percentage-based intervention sliders validated 0–100."""
    recycled_material_percent: float = Field(default=0.0, ge=0, le=100)
    energy_efficiency_percent: float = Field(default=0.0, ge=0, le=100)
    fuel_replacement_percent: float = Field(default=0.0, ge=0, le=100)
    waste_recovery_percent: float = Field(default=0.0, ge=0, le=100)


class CalculateScenarioInput(BaseModel):
    factory_id: int = Field(..., gt=0)
    intervention_parameters: InterventionParameters


class RankInterventionsInput(BaseModel):
    candidates: List[Dict[str, Any]] = Field(..., min_length=1)


# ---------------------------------------------------------------------------
# Tool: calculate_scenario
# ---------------------------------------------------------------------------

async def calculate_scenario(
    factory_id: int,
    recycled_material_percent: float = 0.0,
    energy_efficiency_percent: float = 0.0,
    fuel_replacement_percent: float = 0.0,
    waste_recovery_percent: float = 0.0,
) -> Dict[str, Any]:
    """Call the Express deterministic what-if engine.

    Scenario data is stored separately — it NEVER overwrites baseline emissions.

    Args:
        factory_id: Target factory.
        recycled_material_percent: % switch to recycled material (0–100).
        energy_efficiency_percent: % energy efficiency gain (0–100).
        fuel_replacement_percent: % fuel type substitution (0–100).
        waste_recovery_percent: % waste-to-energy recovery (0–100).

    Returns:
        Scenario result with baseline, projected, reductions, cost, savings, payback.
    """
    params = InterventionParameters(
        recycled_material_percent=recycled_material_percent,
        energy_efficiency_percent=energy_efficiency_percent,
        fuel_replacement_percent=fuel_replacement_percent,
        waste_recovery_percent=waste_recovery_percent,
    )
    validated = CalculateScenarioInput(factory_id=factory_id, intervention_parameters=params)

    logger.info(
        "Tool: calculate_scenario factory_id=%s params=%s",
        validated.factory_id, params.model_dump(),
    )

    payload = {
        "factoryId": validated.factory_id,
        "recycledMaterialPercent": params.recycled_material_percent,
        "energyEfficiencyPercent": params.energy_efficiency_percent,
        "fuelReplacementPercent": params.fuel_replacement_percent,
        "wasteRecoveryPercent": params.waste_recovery_percent,
    }

    return await backend_post("/scenarios", payload)


class ListScenariosInput(BaseModel):
    factory_id: int = Field(..., gt=0)


async def list_scenarios(factory_id: int) -> List[Dict[str, Any]]:
    """Fetch the factory's saved what-if scenarios, newest first.

    Read-only: nothing is calculated or stored. Each scenario carries the
    engine's baseline, projected, reduction, cost, savings, payback and
    assumptions.

    Raises:
        ValueError: on invalid input.
        RuntimeError: if the backend is unreachable.
    """
    validated = ListScenariosInput(factory_id=factory_id)
    logger.info("Tool: list_scenarios factory_id=%s", validated.factory_id)

    data = await backend_get(f"/factories/{validated.factory_id}/scenarios")
    if isinstance(data, dict):
        return data.get("scenarios", [])
    return data or []


# ---------------------------------------------------------------------------
# Tool: rank_interventions
# ---------------------------------------------------------------------------

def rank_interventions(candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Deterministically rank intervention candidates by their composite score.

    Weighted scoring (from Phase 11 Recommendation Scoring):
        Environmental Impact  40%
        Financial Benefit     25%
        Feasibility           20%
        Circularity           15%

    The `score` field on each candidate is assumed to have already been
    calculated by the Express recommendation engine. This function simply
    sorts the provided candidates — it does NOT fabricate scores.

    Args:
        candidates: List of recommendation/alternative dicts with a `score` field.

    Returns:
        Same candidates sorted descending by score with a `rank` field added.
    """
    validated = RankInterventionsInput(candidates=candidates)

    def _score_key(c: Dict[str, Any]) -> float:
        return float(c.get("score") or c.get("circularity_score") or 0.0)

    ranked = sorted(validated.candidates, key=_score_key, reverse=True)
    for i, item in enumerate(ranked, start=1):
        item["rank"] = i

    logger.info("Tool: rank_interventions — ranked %d candidates", len(ranked))
    return ranked
