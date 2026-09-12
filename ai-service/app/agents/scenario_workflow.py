"""Scenario workflow for the EcoTrace AI Copilot.

    intent_router → load_factory_data → parse_intervention_parameters
    → calculate_scenario → generate_response

Workflow rules (ADR-003 / BUSINESS_RULES):
- The LLM is only used to parse intervention percentages from the user's
  natural-language message. It must not invent values not stated by the user.
- All arithmetic (baseline, projected, reduction, cost, savings, payback) is
  performed by the deterministic Express scenario engine.
- Scenario outputs are NEVER written back to baseline emissions.
- If a required parameter is ambiguous the workflow requests clarification
  rather than guessing a value.

Example user message:
  "What if I use 30% recycled material and improve energy efficiency by 15%?"
"""

import json
import logging
import re
from typing import Any, Dict, List, Optional

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field, field_validator

from app.agents.intent_router import Intent
from app.agents.state import AgentState
from app.mcp.tools.scenario import InterventionParameters, calculate_scenario
from app.schemas.ai_response import ConfidenceLevel
from app.services.llm import get_llm

logger = logging.getLogger("ecotrace.ai.scenario_workflow")

# ---------------------------------------------------------------------------
# Node name constants (imported by graph.py)
# ---------------------------------------------------------------------------
PARSE_INTERVENTIONS = "scenario_parse_interventions"
RUN_SCENARIO = "scenario_run_scenario"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _tool_error(tool: str, exc: Exception) -> Dict[str, Any]:
    logger.error("Tool %s failed: %s", tool, exc)
    return {"tool": tool, "error": str(exc)}


def _fmt(value: Any) -> str:
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value) if value is not None else "N/A"


# ---------------------------------------------------------------------------
# LLM-based parameter extraction
# ---------------------------------------------------------------------------

PARSE_PROMPT = """You are a parameter extractor for EcoTrace AI's what-if scenario engine.

Extract intervention percentages from the user message and return valid JSON only.

Output schema (all fields optional, default 0 when not mentioned):
{
  "recycled_material_percent": <number 0-100 or null if not mentioned>,
  "energy_efficiency_percent": <number 0-100 or null if not mentioned>,
  "fuel_replacement_percent": <number 0-100 or null if not mentioned>,
  "waste_recovery_percent": <number 0-100 or null if not mentioned>,
  "needs_clarification": <true if the user did not provide any concrete percentages>,
  "clarification_question": <string, only when needs_clarification is true>
}

Rules:
- Only extract values the user explicitly stated. Do NOT invent percentages.
- If the user says "more recycled material" without a number, set needs_clarification=true.
- Return ONLY the JSON object. No prose, no markdown fences."""


class ParsedInterventions(BaseModel):
    """Structured output of the LLM parameter extraction step."""
    recycled_material_percent: Optional[float] = Field(default=None, ge=0, le=100)
    energy_efficiency_percent: Optional[float] = Field(default=None, ge=0, le=100)
    fuel_replacement_percent: Optional[float] = Field(default=None, ge=0, le=100)
    waste_recovery_percent: Optional[float] = Field(default=None, ge=0, le=100)
    needs_clarification: bool = False
    clarification_question: Optional[str] = None

    @field_validator(
        "recycled_material_percent",
        "energy_efficiency_percent",
        "fuel_replacement_percent",
        "waste_recovery_percent",
        mode="before",
    )
    @classmethod
    def _coerce_none(cls, v: Any) -> Any:
        return None if v is None else float(v)

    def to_intervention_parameters(self) -> InterventionParameters:
        return InterventionParameters(
            recycled_material_percent=self.recycled_material_percent or 0.0,
            energy_efficiency_percent=self.energy_efficiency_percent or 0.0,
            fuel_replacement_percent=self.fuel_replacement_percent or 0.0,
            waste_recovery_percent=self.waste_recovery_percent or 0.0,
        )

    def has_any_parameter(self) -> bool:
        return any(
            v is not None and v > 0
            for v in [
                self.recycled_material_percent,
                self.energy_efficiency_percent,
                self.fuel_replacement_percent,
                self.waste_recovery_percent,
            ]
        )


_PERCENT = re.compile(r"(\d+(?:\.\d+)?)\s*(?:%|percent\b)", re.IGNORECASE)
_LEVER_KEYWORDS = [
    ("recycled_material_percent", re.compile(r"\brecycl", re.IGNORECASE)),
    ("waste_recovery_percent", re.compile(r"\bwaste\b", re.IGNORECASE)),
    ("fuel_replacement_percent", re.compile(r"\b(fuel|biogas|biomass|hydrogen|natural\s+gas|diesel|lpg)\b", re.IGNORECASE)),
    ("energy_efficiency_percent", re.compile(r"\befficien", re.IGNORECASE)),
]


def parse_parameters_by_rules(message: str) -> Optional[ParsedInterventions]:
    """Deterministic fallback for when the LLM is unavailable.

    A value is taken only when a clause states exactly one percentage next to
    exactly one intervention keyword ("use 30% recycled material"); anything
    ambiguous is left out so the user is asked instead of guessed for.
    """
    values: Dict[str, float] = {}
    for clause in re.split(r"\band\b|\bplus\b|[,;]", message, flags=re.IGNORECASE):
        percents = _PERCENT.findall(clause)
        levers = [name for name, pattern in _LEVER_KEYWORDS if pattern.search(clause)]
        if len(percents) == 1 and len(levers) == 1 and levers[0] not in values:
            value = float(percents[0])
            if 0 < value <= 100:
                values[levers[0]] = value
    return ParsedInterventions(**values) if values else None


def _extract_parameters(message: str) -> ParsedInterventions:
    """Use the LLM to extract intervention percentages; fall back to explicit rules if it is unavailable."""
    try:
        llm = get_llm()
        result = llm.invoke([
            SystemMessage(content=PARSE_PROMPT),
            HumanMessage(content=message),
        ])
        raw = result.content.strip()
        # Strip any accidental markdown fences
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        data = json.loads(raw)
        return ParsedInterventions.model_validate(data)
    except Exception as exc:
        by_rules = parse_parameters_by_rules(message)
        if by_rules is not None:
            logger.warning("LLM parameter extraction failed (%s); using explicitly stated values.", exc)
            return by_rules
        logger.warning("Parameter extraction failed (%s); requesting clarification.", exc)
        return ParsedInterventions(
            needs_clarification=True,
            clarification_question=(
                "I wasn't able to extract specific percentages from your message. "
                "Could you tell me, for example: 'What if I use 30% recycled material "
                "and improve energy efficiency by 15%'?"
            ),
        )


# ---------------------------------------------------------------------------
# Node: parse_intervention_parameters
# ---------------------------------------------------------------------------
def parse_intervention_parameters(state: AgentState) -> Dict[str, Any]:
    """LLM parses the user's message into typed scenario parameters.

    If the user didn't provide concrete percentages, sets a clarification flag
    so generate_response asks for more information instead of running numbers.
    """
    from app.agents.intent_router import last_user_message

    message = last_user_message(state["messages"])
    logger.info("Parsing scenario parameters from: %r", message[:120])

    parsed = _extract_parameters(message)

    if parsed.needs_clarification:
        logger.info("Scenario parameter extraction: clarification needed")
        return {
            "tool_results": {
                **state.get("tool_results", {}),
                "scenario_params": None,
                "scenario_needs_clarification": True,
                "clarification_question": parsed.clarification_question,
            },
            "tools_used": ["parse_intervention_parameters"],
        }

    params = parsed.to_intervention_parameters()
    logger.info(
        "Extracted scenario params: recycled=%.0f%% efficiency=%.0f%% fuel=%.0f%% waste=%.0f%%",
        params.recycled_material_percent,
        params.energy_efficiency_percent,
        params.fuel_replacement_percent,
        params.waste_recovery_percent,
    )
    return {
        "tool_results": {
            **state.get("tool_results", {}),
            "scenario_params": params.model_dump(),
            "scenario_needs_clarification": False,
        },
        "tools_used": ["parse_intervention_parameters"],
    }


# ---------------------------------------------------------------------------
# Node: run_scenario
# Calls the deterministic Express what-if engine.
# ---------------------------------------------------------------------------
async def run_scenario(state: AgentState) -> Dict[str, Any]:
    """Call the Express deterministic scenario engine with validated parameters.

    Scenario results are stored in tool_results — they are NEVER written back
    to baseline activities or emissions (enforced by the Express backend).
    """
    tool = "calculate_scenario"
    tool_results = state.get("tool_results") or {}

    # If clarification is needed, skip the engine call and go straight to response
    if tool_results.get("scenario_needs_clarification"):
        # The engine is not called, so it is not reported as a tool used.
        logger.info("Skipping scenario calculation — clarification required")
        return {}

    params_dict = tool_results.get("scenario_params") or {}
    factory_id = state["factory_id"]

    try:
        result = await calculate_scenario(
            factory_id=factory_id,
            recycled_material_percent=params_dict.get("recycled_material_percent", 0.0),
            energy_efficiency_percent=params_dict.get("energy_efficiency_percent", 0.0),
            fuel_replacement_percent=params_dict.get("fuel_replacement_percent", 0.0),
            waste_recovery_percent=params_dict.get("waste_recovery_percent", 0.0),
        )
    except Exception as exc:
        return {
            "tool_results": {**tool_results, "scenario_result": None},
            "tools_used": [tool],
            "tool_errors": [_tool_error(tool, exc)],
        }

    logger.info(
        "Scenario result: baseline=%s projected=%s reduction=%s%%",
        _fmt(result.get("baselineEmission") or result.get("baseline_emission")),
        _fmt(result.get("projectedEmission") or result.get("projected_emission")),
        _fmt(result.get("reductionPercent") or result.get("reduction_percent")),
    )

    return {
        "tool_results": {**tool_results, "scenario_result": result},
        "tools_used": [tool],
    }


# ---------------------------------------------------------------------------
# Grounded evidence builder (deterministic — no LLM)
# ---------------------------------------------------------------------------
class ScenarioEvidence(BaseModel):
    """Structured grounded data the response node explains."""

    # The intervention parameters the user asked about
    recycled_material_percent: float = 0.0
    energy_efficiency_percent: float = 0.0
    fuel_replacement_percent: float = 0.0
    waste_recovery_percent: float = 0.0

    # Results from the deterministic engine
    baseline_emission: Optional[float] = None
    projected_emission: Optional[float] = None
    reduction_amount: Optional[float] = None
    reduction_percent: Optional[float] = None
    estimated_cost: Optional[float] = None
    estimated_savings: Optional[float] = None
    payback_period: Optional[str] = None  # "N/A" when savings are zero
    co2e_unit: str = "tCO2e"

    # Clarification requested?
    needs_clarification: bool = False
    clarification_question: Optional[str] = None

    missing_information: List[str] = Field(default_factory=list)
    assumptions: List[str] = Field(default_factory=list)
    confidence: ConfidenceLevel = ConfidenceLevel.UNAVAILABLE


def build_scenario_evidence(
    tool_results: Dict[str, Any],
    tool_errors: List[Dict[str, Any]],
) -> ScenarioEvidence:
    """Build grounded scenario evidence from tool outputs. Pure and deterministic."""

    if tool_results.get("scenario_needs_clarification"):
        return ScenarioEvidence(
            needs_clarification=True,
            clarification_question=tool_results.get("clarification_question"),
            confidence=ConfidenceLevel.UNAVAILABLE,
        )

    params = tool_results.get("scenario_params") or {}
    result = tool_results.get("scenario_result") or {}

    # normalise camelCase / snake_case keys from Express
    baseline = result.get("baselineEmission") if "baselineEmission" in result else result.get("baseline_emission")
    projected = result.get("projectedEmission") if "projectedEmission" in result else result.get("projected_emission")
    reduction = result.get("reductionAmount") if "reductionAmount" in result else result.get("reduction_amount")
    reduction_pct = result.get("reductionPercent") if "reductionPercent" in result else result.get("reduction_percent")
    cost = result.get("estimatedCost") if "estimatedCost" in result else result.get("estimated_cost")
    savings = result.get("estimatedSavings") if "estimatedSavings" in result else result.get("estimated_savings")
    payback = result.get("paybackPeriod") if "paybackPeriod" in result else result.get("payback_period")
    # The Express scenario engine reports its unit as `unit`.
    unit = result.get("co2eUnit") or result.get("unit") or result.get("co2e_unit") or "tCO2e"

    ev = ScenarioEvidence(
        recycled_material_percent=params.get("recycled_material_percent", 0.0),
        energy_efficiency_percent=params.get("energy_efficiency_percent", 0.0),
        fuel_replacement_percent=params.get("fuel_replacement_percent", 0.0),
        waste_recovery_percent=params.get("waste_recovery_percent", 0.0),
        baseline_emission=baseline,
        projected_emission=projected,
        reduction_amount=reduction,
        reduction_percent=reduction_pct,
        estimated_cost=cost,
        estimated_savings=savings,
        payback_period=str(payback) if payback is not None else "N/A",
        co2e_unit=unit,
    )

    # Missing information
    if not result:
        ev.missing_information.append(
            "The scenario engine did not return a result — ensure the factory has baseline emissions."
        )
    if baseline == 0 or baseline is None:
        ev.missing_information.append(
            "Baseline emission is zero or unavailable; "
            "reduction percentages cannot be calculated."
        )
    for err in tool_errors:
        ev.missing_information.append(
            f"The {err.get('tool')} tool could not be reached; its data is not included."
        )

    # Assumptions
    ev.assumptions.append(
        "Scenario values are projections from the deterministic what-if engine, "
        "not guaranteed outcomes. Real savings depend on implementation."
    )
    ev.assumptions.append(
        "Scenario data is stored separately and does not change recorded baseline emissions."
    )
    if savings == 0 or savings is None:
        ev.assumptions.append("Annual savings are unavailable; payback period is shown as N/A.")

    # Confidence
    if not result or baseline is None:
        ev.confidence = ConfidenceLevel.LOW
    elif tool_errors:
        ev.confidence = ConfidenceLevel.LOW
    elif baseline == 0:
        ev.confidence = ConfidenceLevel.MEDIUM
    else:
        ev.confidence = ConfidenceLevel.HIGH

    return ev
