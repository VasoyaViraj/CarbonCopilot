"""Operational-data schemas the AI service consumes from the Express backend.

They mirror docs/API_CONTRACT.md §5 (activities) and the deterministic carbon engine's
calculation result. The AI layer reads these values and explains them; it never
recalculates them (ADR-003), and simulated readings are never treated as physical
measurements (BR-12).
"""

from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ActivitySource(str, Enum):
    MANUAL = "MANUAL"
    CSV = "CSV"
    SIMULATION = "SIMULATION"


class ActivityCategory(str, Enum):
    ENERGY = "ENERGY"
    FUEL = "FUEL"
    MATERIAL = "MATERIAL"
    WASTE = "WASTE"


class ApiModel(BaseModel):
    """Parses the backend's camelCase JSON into immutable snake_case attributes."""

    model_config = ConfigDict(populate_by_name=True, frozen=True, extra="ignore")


class ActivityEmission(ApiModel):
    """Persisted carbon-engine result attached to an activity."""

    id: int
    co2e_value: float = Field(alias="co2eValue", ge=0)
    co2e_unit: str = Field(alias="co2eUnit")
    emission_factor_id: int = Field(alias="emissionFactorId")
    calculation_method: Optional[str] = Field(default=None, alias="calculationMethod")
    calculated_at: Optional[datetime] = Field(default=None, alias="calculatedAt")


class Activity(ApiModel):
    """A dated operational measurement (manual, CSV or simulated)."""

    id: int
    process_id: int = Field(alias="processId")
    process_name: Optional[str] = Field(default=None, alias="processName")
    activity_date: datetime = Field(alias="activityDate")
    energy_type: str = Field(alias="energyType")
    category: Optional[ActivityCategory] = None
    quantity: float = Field(gt=0)
    unit: str
    production_quantity: Optional[float] = Field(default=None, alias="productionQuantity", ge=0)
    production_unit: Optional[str] = Field(default=None, alias="productionUnit")
    source: ActivitySource
    is_simulated: bool = Field(alias="isSimulated")
    emission: Optional[ActivityEmission] = None

    @model_validator(mode="after")
    def _simulated_flag_matches_source(self) -> "Activity":
        if self.is_simulated != (self.source == ActivitySource.SIMULATION):
            raise ValueError("isSimulated must be true exactly when source is SIMULATION")
        return self


class ActivityPage(ApiModel):
    items: List[Activity]
    total: int = Field(ge=0)
    limit: int = Field(ge=1)
    offset: int = Field(ge=0)


class EmissionFactorSource(ApiModel):
    region: Optional[str] = None
    year: Optional[int] = None
    reference: Optional[str] = None


class CalculateEmissionsInput(ApiModel):
    """Validated input of the `calculate_emissions` MCP tool (Phase 14)."""

    activity_type: str = Field(alias="activityType", min_length=1)
    quantity: float = Field(ge=0)
    unit: str = Field(min_length=1)
    emission_factor_id: Optional[int] = Field(default=None, alias="emissionFactorId", gt=0)


class EmissionCalculation(ApiModel):
    """Result of the backend's deterministic carbon engine — the tool output the LLM explains."""

    activity_type: str = Field(alias="activityType")
    quantity: float = Field(ge=0)
    unit: str
    emission_factor_id: int = Field(alias="emissionFactorId")
    factor: float = Field(ge=0)
    factor_unit: str = Field(alias="factorUnit")
    factor_source: Optional[EmissionFactorSource] = Field(default=None, alias="factorSource")
    co2e_value: float = Field(alias="co2eValue", ge=0)
    co2e_unit: str = Field(alias="co2eUnit")
    calculation_method: str = Field(alias="calculationMethod")
