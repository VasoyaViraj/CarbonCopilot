"""Hotspot analysis workflow for the EcoTrace AI Copilot.

    intent_router → load_factory_data → calculate_emissions
    → identify_hotspots → root_cause_analysis → generate_response

Every number comes from the Express backend through MCP tools. The
root-cause step is deterministic: it sorts the tool outputs into
- actual factory data (recorded emissions and measurements),
- derived metrics (shares, ranks, severity, intensity computed by the backend),
- hypotheses (rule-based, explicitly unverified),
- missing information (gaps that limit the analysis),
and the LLM only explains that evidence. EcoTrace stores no equipment
condition data, so no step may claim anything about equipment condition.
"""

import logging
import re
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel, Field

from app.agents.intent_router import GENERATE_RESPONSE, Intent, last_user_message
from app.agents.state import AgentState
from app.mcp.tools.emissions import get_emissions_summary
from app.mcp.tools.hotspots import get_hotspot_detail, get_hotspot_ranking
from app.schemas.ai_response import ConfidenceLevel

logger = logging.getLogger("ecotrace.ai.hotspot_workflow")

CALCULATE_EMISSIONS = "calculate_emissions"
IDENTIFY_HOTSPOTS = "identify_hotspots"
ROOT_CAUSE_ANALYSIS = "root_cause_analysis"

# How many of the target process's emission drivers get a hypothesis.
MAX_HYPOTHESES = 2


def route_after_factory_data(state: AgentState) -> str:
    """Conditional edge: only hotspot questions run the hotspot workflow."""
    if state.get("intent") == Intent.HOTSPOT_ANALYSIS.value:
        return CALCULATE_EMISSIONS
    return GENERATE_RESPONSE


def _tool_error(tool: str, exc: Exception) -> Dict[str, Any]:
    logger.error("Tool %s failed: %s", tool, exc)
    return {"tool": tool, "error": str(exc)}


# ---------------------------------------------------------------------------
# Node: calculate_emissions
# ---------------------------------------------------------------------------
async def calculate_emissions(state: AgentState) -> Dict[str, Any]:
    """Load the factory's emissions as aggregated by the deterministic carbon engine."""
    tool = "get_emissions_summary"
    try:
        summary = await get_emissions_summary(state["factory_id"])
    except Exception as exc:
        return {"tools_used": [tool], "tool_errors": [_tool_error(tool, exc)]}

    return {
        "tool_results": {**state.get("tool_results", {}), "emissions_summary": summary},
        "tools_used": [tool],
    }


# ---------------------------------------------------------------------------
# Node: identify_hotspots
# ---------------------------------------------------------------------------
def select_target_hotspot(
    hotspots: List[Dict[str, Any]], message: str
) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """Pick the process the user asked about, else the top-ranked hotspot.

    Returns (hotspot, selection) where selection is "MENTIONED" or "TOP_RANKED".
    """
    text = (message or "").lower()
    # Longest names first so "Furnace 2" wins over "Furnace".
    for hotspot in sorted(hotspots, key=lambda h: len(h.get("process") or ""), reverse=True):
        name = (hotspot.get("process") or "").strip().lower()
        if name and re.search(rf"\b{re.escape(name)}s?\b", text):
            return hotspot, "MENTIONED"
    if hotspots:
        return hotspots[0], "TOP_RANKED"
    return None, None


async def identify_hotspots(state: AgentState) -> Dict[str, Any]:
    """Load the hotspot ranking and the emission drivers of the process in question."""
    factory_id = state["factory_id"]
    tools_used = ["get_hotspot_ranking"]
    try:
        ranking = await get_hotspot_ranking(factory_id)
    except Exception as exc:
        return {"tools_used": tools_used, "tool_errors": [_tool_error("get_hotspot_ranking", exc)]}

    results = {**state.get("tool_results", {}), "hotspot_ranking": ranking}
    errors: List[Dict[str, Any]] = []

    target, selection = select_target_hotspot(
        ranking.get("hotspots") or [], last_user_message(state["messages"])
    )
    if target is not None and target.get("processId") is not None:
        results["hotspot_target"] = {
            "processId": target["processId"],
            "process": target.get("process"),
            "selection": selection,
        }
        tools_used.append("get_hotspot_detail")
        try:
            results["hotspot_detail"] = await get_hotspot_detail(factory_id, target["processId"])
        except Exception as exc:
            errors.append(_tool_error("get_hotspot_detail", exc))

    return {"tool_results": results, "tools_used": tools_used, "tool_errors": errors}


# ---------------------------------------------------------------------------
# Node: root_cause_analysis
# ---------------------------------------------------------------------------
class Evidence(BaseModel):
    """One statement in the root-cause analysis and where it came from."""

    statement: str
    # MCP tool that supplied the values, or "rule" for rule-based statements.
    source: str


class RootCauseAnalysis(BaseModel):
    """Grounded evidence the response node explains. No field is LLM-generated."""

    process_id: Optional[int] = None
    process: Optional[str] = None
    # MENTIONED (named in the question) | TOP_RANKED (default to hotspot #1)
    target_selection: Optional[str] = None
    co2e_unit: str = "tCO2e"
    factory_data: List[Evidence] = Field(default_factory=list)
    derived_metrics: List[Evidence] = Field(default_factory=list)
    hypotheses: List[Evidence] = Field(default_factory=list)
    missing_information: List[Evidence] = Field(default_factory=list)
    confidence: ConfidenceLevel = ConfidenceLevel.UNAVAILABLE


NO_EQUIPMENT_DATA = (
    "Equipment condition, maintenance history and operating parameters are not recorded "
    "in EcoTrace, so nothing can be concluded about the condition of any equipment."
)

# Keyed by activity category. Each names possible, unverified contributors.
_HYPOTHESIS_TEMPLATES = {
    "FUEL": (
        "{label} drives {pct}% of {process} emissions, so fuel use per unit of output, "
        "the choice of fuel, or combustion and heat-recovery efficiency may be contributing. "
        "Not verified."
    ),
    "ENERGY": (
        "{label} drives {pct}% of {process} emissions, so the process's energy demand, its "
        "operating hours, or the carbon intensity of the supply may be contributing. Not verified."
    ),
    "MATERIAL": (
        "{label} drives {pct}% of {process} emissions, so the quantity of material used or its "
        "embodied carbon (for example virgin rather than recycled content) may be contributing. "
        "Not verified."
    ),
    "WASTE": (
        "{label} drives {pct}% of {process} emissions, so waste volumes or the disposal route "
        "may be contributing. Not verified."
    ),
}
_DEFAULT_HYPOTHESIS = (
    "{label} drives {pct}% of {process} emissions; the available data does not indicate why."
)


def _fmt(value: Any) -> str:
    """Render a tool value exactly as returned (no rounding), without a trailing .0."""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def _positive(value: Any) -> bool:
    return isinstance(value, (int, float)) and value > 0


def build_root_cause(
    tool_results: Dict[str, Any], tool_errors: List[Dict[str, Any]]
) -> RootCauseAnalysis:
    """Sort the tool outputs into grounded root-cause evidence. Pure and deterministic."""
    ranking = tool_results.get("hotspot_ranking") or {}
    detail = tool_results.get("hotspot_detail") or {}
    target = tool_results.get("hotspot_target") or {}
    summary = tool_results.get("emissions_summary") or {}
    profile = tool_results.get("factory_profile") or {}

    unit = detail.get("co2eUnit") or ranking.get("co2eUnit") or summary.get("co2eUnit") or "tCO2e"
    # Prefer the detail's view of the hotspot; fall back to the ranking entry.
    hotspot = detail.get("hotspot") or next(
        (h for h in ranking.get("hotspots") or [] if h.get("processId") == target.get("processId")),
        None,
    )
    process = (detail.get("process") or {}).get("name") or target.get("process")

    rca = RootCauseAnalysis(
        process_id=target.get("processId"),
        process=process,
        target_selection=target.get("selection"),
        co2e_unit=unit,
    )
    fact, derived, hypothesis, missing = (
        rca.factory_data,
        rca.derived_metrics,
        rca.hypotheses,
        rca.missing_information,
    )

    # --- Actual factory data -------------------------------------------------
    industry = profile.get("industryType") or profile.get("industry_type")
    if industry:
        fact.append(Evidence(statement=f"The factory's industry is {industry}.", source="get_factory_profile"))

    totals = summary.get("totals") or {}
    if totals.get("co2e") is not None:
        fact.append(Evidence(
            statement=(
                f"The factory has recorded {_fmt(totals['co2e'])} {summary.get('co2eUnit') or unit} "
                f"of emissions across {_fmt(totals.get('activityCount'))} activities."
            ),
            source="get_emissions_summary",
        ))
    elif ranking.get("totalEmission") is not None:
        fact.append(Evidence(
            statement=f"The factory has recorded {_fmt(ranking['totalEmission'])} {unit} of emissions.",
            source="get_hotspot_ranking",
        ))

    process_type = (detail.get("process") or {}).get("processType")
    if process and process_type:
        fact.append(Evidence(statement=f"{process} is registered as a {process_type} process.", source="get_hotspot_detail"))

    if hotspot:
        source = "get_hotspot_detail" if detail.get("hotspot") else "get_hotspot_ranking"
        fact.append(Evidence(
            statement=(
                f"{process} has recorded {_fmt(hotspot.get('emission'))} {unit} of emissions "
                f"across {_fmt(hotspot.get('activityCount'))} activities."
            ),
            source=source,
        ))

    drivers = sorted(detail.get("drivers") or [], key=lambda d: d.get("co2e") or 0, reverse=True)
    for driver in drivers:
        fact.append(Evidence(
            statement=(
                f"{driver.get('label') or driver.get('activityType')} accounts for "
                f"{_fmt(driver.get('co2e'))} {unit} of {process} emissions."
            ),
            source="get_hotspot_detail",
        ))

    simulated = detail.get("simulatedEmission")
    if _positive(simulated):
        fact.append(Evidence(
            statement=f"{_fmt(simulated)} {unit} of {process} emissions come from simulated readings.",
            source="get_hotspot_detail",
        ))

    production = detail.get("production") or {}
    if _positive(production.get("quantity")):
        fact.append(Evidence(
            statement=f"{process} has recorded production of {_fmt(production['quantity'])} {production.get('unit')}.",
            source="get_hotspot_detail",
        ))

    # --- Derived metrics (computed by the backend) ---------------------------
    if hotspot:
        thresholds = detail.get("thresholds") or ranking.get("thresholds") or {}
        ranked = detail.get("rankedProcessCount") or len(ranking.get("hotspots") or []) or None
        position = f"#{_fmt(hotspot.get('rank'))}" + (f" of {_fmt(ranked)}" if ranked else "")
        threshold_note = (
            f" (thresholds: CRITICAL above {_fmt(thresholds['critical'])}%, HIGH above "
            f"{_fmt(thresholds['high'])}%, MEDIUM above {_fmt(thresholds['medium'])}%)"
            if {"critical", "high", "medium"} <= thresholds.keys()
            else ""
        )
        derived.append(Evidence(
            statement=(
                f"{process} ranks {position} by emissions and contributes "
                f"{_fmt(hotspot.get('percentage'))}% of factory emissions, severity "
                f"{hotspot.get('severity')}{threshold_note}."
            ),
            source="get_hotspot_detail" if detail.get("hotspot") else "get_hotspot_ranking",
        ))

    for driver in drivers:
        if driver.get("percentage") is not None:
            derived.append(Evidence(
                statement=(
                    f"{driver.get('label') or driver.get('activityType')} is "
                    f"{_fmt(driver['percentage'])}% of {process} emissions."
                ),
                source="get_hotspot_detail",
            ))

    intensity = detail.get("intensity") or {}
    if intensity.get("value") is not None:
        derived.append(Evidence(
            statement=f"{process} emission intensity is {_fmt(intensity['value'])} {intensity.get('unit')}.",
            source="get_hotspot_detail",
        ))

    # --- Hypotheses (rule-based, never verified) ------------------------------
    for driver in drivers[:MAX_HYPOTHESES]:
        if driver.get("percentage") is None:
            continue
        template = _HYPOTHESIS_TEMPLATES.get(driver.get("category"), _DEFAULT_HYPOTHESIS)
        hypothesis.append(Evidence(
            statement=template.format(
                label=driver.get("label") or driver.get("activityType"),
                pct=_fmt(driver["percentage"]),
                process=process,
            ),
            source="rule",
        ))

    # --- Missing information --------------------------------------------------
    missing.append(Evidence(statement=NO_EQUIPMENT_DATA, source="rule"))

    failed = []
    for error in tool_errors:
        if error.get("tool") not in failed:
            failed.append(error.get("tool"))
    for tool in failed:
        missing.append(Evidence(
            statement=f"The {tool} tool could not be reached, so its data is not included.",
            source="rule",
        ))

    if ranking and not ranking.get("hotspots"):
        missing.append(Evidence(
            statement="No emissions are recorded for this factory in the period, so there is no hotspot to analyse.",
            source="get_hotspot_ranking",
        ))

    if hotspot and detail:
        if not drivers:
            missing.append(Evidence(
                statement=f"No breakdown of {process} emissions by activity type is available.",
                source="get_hotspot_detail",
            ))
        if intensity.get("value") is None:
            missing.append(Evidence(
                statement=(
                    f"Production data for {process} is missing or mixes units, so its emission "
                    "intensity cannot be calculated."
                ),
                source="get_hotspot_detail",
            ))

    if _positive(simulated):
        missing.append(Evidence(
            statement="Part of these emissions come from simulated readings, not physical measurements.",
            source="get_hotspot_detail",
        ))

    seen_warnings = set()
    for payload, source in ((detail, "get_hotspot_detail"), (ranking, "get_hotspot_ranking")):
        for warning in payload.get("warnings") or []:
            code = warning.get("code")
            if code in seen_warnings:
                continue
            seen_warnings.add(code)
            missing.append(Evidence(statement=f"Data warning ({code}): {warning.get('message')}", source=source))

    # --- Confidence -----------------------------------------------------------
    if not hotspot:
        rca.confidence = ConfidenceLevel.UNAVAILABLE
    elif failed:
        rca.confidence = ConfidenceLevel.LOW
    elif seen_warnings or _positive(simulated) or intensity.get("value") is None:
        rca.confidence = ConfidenceLevel.MEDIUM
    else:
        rca.confidence = ConfidenceLevel.HIGH

    return rca


def root_cause_analysis(state: AgentState) -> Dict[str, Any]:
    """Build grounded root-cause evidence from the tool outputs."""
    rca = build_root_cause(state.get("tool_results", {}), state.get("tool_errors", []))
    logger.info(
        "Root cause for process=%s (selection=%s, confidence=%s)",
        rca.process,
        rca.target_selection,
        rca.confidence.value,
    )
    return {"root_cause": rca.model_dump(mode="json")}


# Appended to the response prompt when a root-cause analysis is present.
HOTSPOT_RESPONSE_RULES = """

Hotspot analysis rules:
- The evidence below is the ONLY source of facts and numbers. Quote numbers exactly as written; do not add, round, convert, or combine them.
- Structure the answer under four headings, in this order: "Actual factory data", "Derived metrics", "Hypotheses", "Missing information".
- Present every hypothesis as an unverified possibility to check on site, never as a finding.
- Never state or imply the condition of any equipment (for example faulty, worn, leaking, poorly maintained, or inefficient) — it is not recorded.
- If target_selection is TOP_RANKED, say you analysed the top-ranked hotspot because no specific process was identified in the question.
- If confidence is UNAVAILABLE, say there is not enough data to analyse a hotspot."""
