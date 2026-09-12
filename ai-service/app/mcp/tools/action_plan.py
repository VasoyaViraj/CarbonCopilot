"""MCP Tool: generate_action_plan

Turns tool-derived context — hotspots, root-cause findings, ranked
recommendations and projected scenario impact — into a structured
sustainability action plan with seven sections:

1. Immediate investigation     5. Expected impact
2. Short-term action           6. Risks / limitations
3. Medium-term intervention    7. Success metric
4. Measurement to perform

Numbers never come from the LLM:
- build_action_plan_draft() writes a complete plan deterministically,
  copying every figure from the context.
- If an LLM is available it may rewrite the four action sections. Its output
  is kept only if it passes the schema, uses no number that is absent from
  the context, guarantees nothing and makes no equipment-condition claim;
  otherwise the deterministic draft is returned.
- Expected impact and success metrics are always deterministic.

Every impact is worded as estimated or projected, and the plan always states
that the factory team is the final decision-maker.
"""

import json
import logging
import re
from enum import Enum
from typing import Any, Iterable, List, Optional, Union

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field, ValidationError, model_validator

from app.schemas.ai_response import ConfidenceLevel

logger = logging.getLogger("ecotrace.ai.mcp.action_plan")

HUMAN_DECISION_NOTE = (
    "This plan is decision support generated from EcoTrace data. Every impact is an estimate "
    "or projection, not a guaranteed outcome, and the factory team makes the final decision on each action."
)
ESTIMATE_BASIS = "Estimated, not guaranteed; actual results depend on implementation."
ESTIMATES_NOT_GUARANTEED = (
    "All reductions, savings and paybacks in this plan are estimates or projections, not guaranteed outcomes."
)

# Affirmative certainty the plan must never express ("not guaranteed" is fine).
_GUARANTEE = re.compile(
    r"(?<!not )(?<!never )\bguarantee(d|s)?\b"
    r"|\bwill (definitely |certainly )?(save|reduce|cut|eliminate|deliver|achieve|pay back)\b"
    r"|\b(definitely|certainly|risk[- ]free)\b",
    re.IGNORECASE,
)
# EcoTrace records no equipment condition, so the plan may not describe one.
_EQUIPMENT_CONDITION = re.compile(
    r"\b(faulty|worn|leak(s|ing|y)?|broken|malfunction\w*|degraded|poorly maintained)\b", re.IGNORECASE
)
# A number not embedded in a word (the "2" in "tCO2e" is not a number).
_NUMBER = re.compile(r"(?<![\w.])\d+(?:\.\d+)?(?!\w)")


# ---------------------------------------------------------------------------
# Input schemas — everything here comes from deterministic tools
# ---------------------------------------------------------------------------

class HotspotInput(BaseModel):
    rank: Optional[int] = None
    process_id: Optional[int] = None
    process: str
    emission: Optional[float] = None
    percentage: Optional[float] = None
    severity: Optional[str] = None


class RootCauseFindings(BaseModel):
    """Statements from the grounded root-cause analysis (hotspot workflow)."""

    process: Optional[str] = None
    factory_data: List[str] = Field(default_factory=list)
    derived_metrics: List[str] = Field(default_factory=list)
    hypotheses: List[str] = Field(default_factory=list)
    missing_information: List[str] = Field(default_factory=list)
    confidence: ConfidenceLevel = ConfidenceLevel.UNAVAILABLE


class RecommendationInput(BaseModel):
    """One deterministically scored recommendation (API_CONTRACT §8)."""

    rank: int
    name: str
    current_option: Optional[str] = None
    process: Optional[str] = None
    score: Optional[float] = None
    # Share of the factory's emissions avoided (%)
    estimated_reduction_percent: Optional[float] = None
    # Reduction of the emissions the intervention targets (%)
    targeted_reduction_percent: Optional[float] = None
    # CO2e avoided per year
    estimated_savings: Optional[float] = None
    savings_unit: Optional[str] = None
    cost_level: Optional[str] = None
    implementation_difficulty: Optional[str] = None
    # None when not available (BR-09 → "N/A")
    payback_years: Optional[float] = None
    status: Optional[str] = None
    reason: Optional[str] = None
    assumptions: List[str] = Field(default_factory=list)


class ProjectedImpact(BaseModel):
    """A saved what-if scenario from the deterministic scenario engine."""

    name: Optional[str] = None
    baseline_emission: Optional[float] = None
    projected_emission: Optional[float] = None
    reduction_amount: Optional[float] = None
    reduction_percent: Optional[float] = None
    estimated_cost: Optional[float] = None
    estimated_savings: Optional[float] = None
    currency: str = "USD"
    payback_years: Optional[float] = None
    unit: str = "tCO2e"
    assumptions: List[str] = Field(default_factory=list)


class ActionPlanContext(BaseModel):
    """All tool-derived data the action plan may use."""

    factory_name: Optional[str] = None
    co2e_unit: str = "tCO2e"
    total_emission: Optional[float] = None
    hotspots: List[HotspotInput] = Field(default_factory=list)
    root_cause: Optional[RootCauseFindings] = None
    recommendations: List[RecommendationInput] = Field(default_factory=list)
    projected_impact: Optional[ProjectedImpact] = None
    assumptions: List[str] = Field(default_factory=list)
    # Tools that failed and backend data warnings
    data_gaps: List[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Output schema
# ---------------------------------------------------------------------------

class PlanAction(BaseModel):
    title: str = Field(..., min_length=1)
    detail: str = Field(..., min_length=1)
    # Hotspot process or intervention the action is about
    related_to: Optional[str] = None


class ImpactEstimate(BaseModel):
    source: str  # "recommendation" | "scenario"
    label: str = Field(..., min_length=1)
    estimated_co2e_reduction: Optional[float] = None
    co2e_reduction_unit: Optional[str] = None
    estimated_reduction_percent: Optional[float] = None
    estimated_cost: Optional[str] = None
    estimated_savings: Optional[str] = None
    payback: str = "N/A"
    projection: Optional[str] = None
    basis: str = ESTIMATE_BASIS


class SuccessMetric(BaseModel):
    metric: str = Field(..., min_length=1)
    baseline: str = Field(..., min_length=1)
    target: str = Field(..., min_length=1)


class PlanSource(str, Enum):
    DETERMINISTIC = "DETERMINISTIC"
    LLM = "LLM"


class ActionPlan(BaseModel):
    """Structured sustainability action plan returned to the copilot."""

    immediate_investigation: List[PlanAction] = Field(..., min_length=1)
    short_term_actions: List[PlanAction] = Field(..., min_length=1)
    medium_term_interventions: List[PlanAction] = Field(..., min_length=1)
    measurements: List[PlanAction] = Field(..., min_length=1)
    # Required, but empty when no deterministic estimate exists.
    expected_impact: List[ImpactEstimate]
    risks_and_limitations: List[str] = Field(..., min_length=1)
    success_metrics: List[SuccessMetric] = Field(..., min_length=1)
    decision_note: str = HUMAN_DECISION_NOTE
    source: PlanSource = PlanSource.DETERMINISTIC
    confidence: ConfidenceLevel = ConfidenceLevel.UNAVAILABLE

    @model_validator(mode="after")
    def _decision_support_only(self) -> "ActionPlan":
        if self.decision_note != HUMAN_DECISION_NOTE:
            raise ValueError("decision_note must state that the factory team makes the final decision")
        for text in self.texts():
            if _GUARANTEE.search(text):
                raise ValueError(f"action plan must not present outcomes as guaranteed: {text!r}")
        return self

    def texts(self) -> List[str]:
        """Every free-text value in the plan."""
        texts: List[str] = []
        for action in self.immediate_investigation + self.short_term_actions + self.medium_term_interventions + self.measurements:
            texts += [action.title, action.detail]
        for impact in self.expected_impact:
            texts += [t for t in (impact.label, impact.estimated_cost, impact.estimated_savings, impact.payback, impact.projection, impact.basis) if t]
        texts += self.risks_and_limitations
        for metric in self.success_metrics:
            texts += [metric.metric, metric.baseline, metric.target]
        return texts


class ActionPlanNarrative(BaseModel):
    """The only part of the plan the LLM may write."""

    immediate_investigation: List[PlanAction] = Field(..., min_length=1, max_length=5)
    short_term_actions: List[PlanAction] = Field(..., min_length=1, max_length=5)
    medium_term_interventions: List[PlanAction] = Field(..., min_length=1, max_length=5)
    measurements: List[PlanAction] = Field(..., min_length=1, max_length=5)

    def texts(self) -> List[str]:
        actions = self.immediate_investigation + self.short_term_actions + self.medium_term_interventions + self.measurements
        return [t for a in actions for t in (a.title, a.detail)]


# ---------------------------------------------------------------------------
# Deterministic draft
# ---------------------------------------------------------------------------

def _fmt(value: Any) -> str:
    """Render a tool value exactly as returned (no rounding), without a trailing .0."""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def _payback(years: Optional[float]) -> str:
    return f"{_fmt(years)} years" if years is not None else "N/A"


def _dedupe(items: Iterable[str]) -> List[str]:
    seen, result = set(), []
    for item in items:
        if item and item not in seen:
            seen.add(item)
            result.append(item)
    return result


def _hotspot_summary(h: HotspotInput, unit: str) -> str:
    parts = [f"{h.process} is hotspot #{_fmt(h.rank)}" if h.rank is not None else f"{h.process} is a hotspot"]
    if h.emission is not None:
        parts.append(f" with {_fmt(h.emission)} {unit} recorded")
    if h.percentage is not None:
        parts.append(f" ({_fmt(h.percentage)}% of factory emissions" + (f", {h.severity})" if h.severity else ")"))
    return "".join(parts) + "."


def _recommendation_estimate(r: RecommendationInput) -> str:
    parts = [f"Ranked #{_fmt(r.rank)}" + (f" with a score of {_fmt(r.score)}" if r.score is not None else "") + "."]
    if r.estimated_savings is not None:
        estimate = f"Estimated to avoid {_fmt(r.estimated_savings)} {r.savings_unit or ''}".rstrip()
        if r.estimated_reduction_percent is not None:
            estimate += f" ({_fmt(r.estimated_reduction_percent)}% of factory emissions)"
        parts.append(estimate + ".")
    if r.cost_level:
        parts.append(f"Cost level {r.cost_level}" + (f", implementation difficulty {r.implementation_difficulty}" if r.implementation_difficulty else "") + ".")
    parts.append(f"Projected payback: {_payback(r.payback_years)}.")
    return " ".join(parts)


def _is_quick_win(r: RecommendationInput) -> bool:
    return (r.cost_level or "").upper() == "LOW" or (r.implementation_difficulty or "").upper() == "LOW"


def _plan_confidence(context: ActionPlanContext) -> ConfidenceLevel:
    rc = context.root_cause
    if not context.hotspots and not context.recommendations:
        return ConfidenceLevel.UNAVAILABLE
    if context.data_gaps:
        return ConfidenceLevel.LOW
    if not context.recommendations or rc is None or rc.confidence != ConfidenceLevel.HIGH:
        return ConfidenceLevel.MEDIUM
    return ConfidenceLevel.HIGH


def build_action_plan_draft(context: ActionPlanContext) -> ActionPlan:
    """Build a complete, grounded action plan without an LLM. Pure and deterministic."""
    unit = context.co2e_unit
    focus = context.hotspots[:2]
    rc = context.root_cause
    recs = sorted(context.recommendations, key=lambda r: r.rank)
    quick = [r for r in recs if _is_quick_win(r)][:3]
    longer = [r for r in recs if not _is_quick_win(r)][:3]

    # 1. Immediate investigation ---------------------------------------------
    immediate: List[PlanAction] = []
    for h in focus:
        detail = _hotspot_summary(h, unit) + " Confirm that its recorded activity data is complete and correct before committing to changes."
        if rc and rc.process == h.process and rc.hypotheses:
            detail += " Check these unverified hypotheses on site: " + " ".join(rc.hypotheses)
        immediate.append(PlanAction(title=f"Investigate {h.process} emissions", detail=detail, related_to=h.process))
    if context.data_gaps:
        immediate.append(PlanAction(
            title="Close data gaps",
            detail="Resolve the missing or unavailable data listed under risks and limitations, then regenerate this plan.",
        ))
    if not immediate:
        immediate.append(PlanAction(
            title="Confirm emission data is recorded",
            detail="No hotspot data is available. Check that activities and emissions are recorded for this factory, then regenerate the plan.",
        ))

    # 2. Short-term action ------------------------------------------------------
    short_term: List[PlanAction] = [
        PlanAction(
            title=f"Pilot {r.name}",
            detail=f"{_recommendation_estimate(r)} Run a small pilot and confirm the estimate before scaling up.",
            related_to=r.name,
        )
        for r in quick
    ]
    if not short_term and recs:
        top = recs[0]
        short_term.append(PlanAction(
            title=f"Prepare a feasibility assessment for {top.name}",
            detail=f"{_recommendation_estimate(top)} Collect supplier quotes and confirm the emissions it targets before approving investment.",
            related_to=top.name,
        ))
    if not short_term:
        short_term.append(PlanAction(
            title="Generate ranked recommendations",
            detail="No ranked recommendations are available yet. Generate them in EcoTrace so interventions can be compared by estimated reduction, cost and payback.",
        ))

    # 3. Medium-term intervention ---------------------------------------------
    medium_term: List[PlanAction] = [
        PlanAction(
            title=f"Plan implementation of {r.name}",
            detail=f"{_recommendation_estimate(r)} Schedule it after the feasibility check and budget approval.",
            related_to=r.name,
        )
        for r in longer
    ]
    if not medium_term:
        medium_term.append(
            PlanAction(
                title="Scale up successful pilots",
                detail="Extend the short-term pilots that meet their estimated impact to the other processes they apply to.",
            )
            if quick
            else PlanAction(
                title="Re-assess interventions",
                detail="Once recommendations exist and data gaps are closed, regenerate this plan to choose medium-term interventions.",
            )
        )

    # 4. Measurement to perform -----------------------------------------------
    measurements: List[PlanAction] = []
    for h in focus:
        baseline = f" against the {_fmt(h.emission)} {unit} recorded so far" if h.emission is not None else ""
        measurements.append(PlanAction(
            title=f"Track monthly emissions of {h.process}",
            detail=f"Compare each month's recorded emissions for {h.process}{baseline} in EcoTrace.",
            related_to=h.process,
        ))
    if focus:
        measurements.append(PlanAction(
            title=f"Record activity and production data for {focus[0].process}",
            detail="Log energy, fuel and material use together with production quantities for each period, so emission intensity can be tracked and the hypotheses can be tested.",
            related_to=focus[0].process,
        ))
    for r in quick:
        measurements.append(PlanAction(
            title=f"Measure pilot results for {r.name}",
            detail="Record the targeted activity before and after the pilot to check the estimated reduction.",
            related_to=r.name,
        ))
    if not measurements:
        measurements.append(PlanAction(
            title="Record operational activity data",
            detail="Record energy, fuel, material and production data for each process so emissions and hotspots can be calculated.",
        ))

    # 5. Expected impact ---------------------------------------------------------
    expected_impact = [
        ImpactEstimate(
            source="recommendation",
            label=r.name,
            estimated_co2e_reduction=r.estimated_savings,
            co2e_reduction_unit=r.savings_unit if r.estimated_savings is not None else None,
            estimated_reduction_percent=r.estimated_reduction_percent,
            estimated_cost=f"{r.cost_level} cost level" if r.cost_level else None,
            payback=_payback(r.payback_years),
        )
        for r in recs[:3]
    ]
    scenario = context.projected_impact
    if scenario is not None:
        projection = None
        if scenario.baseline_emission is not None and scenario.projected_emission is not None:
            projection = (
                f"Projected emissions of {_fmt(scenario.projected_emission)} {scenario.unit} "
                f"against a baseline of {_fmt(scenario.baseline_emission)} {scenario.unit}."
            )
        expected_impact.append(ImpactEstimate(
            source="scenario",
            label=scenario.name or "Saved what-if scenario",
            estimated_co2e_reduction=scenario.reduction_amount,
            co2e_reduction_unit=scenario.unit if scenario.reduction_amount is not None else None,
            estimated_reduction_percent=scenario.reduction_percent,
            estimated_cost=f"{_fmt(scenario.estimated_cost)} {scenario.currency}" if scenario.estimated_cost is not None else None,
            estimated_savings=f"{_fmt(scenario.estimated_savings)} {scenario.currency}" if scenario.estimated_savings is not None else None,
            payback=_payback(scenario.payback_years),
            projection=projection,
        ))

    # 6. Risks / limitations -----------------------------------------------------
    risks = [ESTIMATES_NOT_GUARANTEED]
    risks += context.assumptions
    for r in recs:
        risks += r.assumptions
    if scenario is not None:
        risks += scenario.assumptions
    if rc is not None:
        risks += rc.missing_information
    risks += context.data_gaps
    if not recs:
        risks.append("No ranked recommendations were available, so the interventions in this plan are generic.")
    if scenario is None:
        risks.append("No saved what-if scenario was available; run one in the What-if Simulator for a combined projection.")

    # 7. Success metric -----------------------------------------------------------
    metrics: List[SuccessMetric] = []
    if focus:
        h = focus[0]
        target = "A sustained downward trend after the planned actions are implemented"
        top_saving = next((r for r in recs if r.estimated_savings is not None), None)
        if top_saving is not None:
            target += (
                f", compared with the estimated {_fmt(top_saving.estimated_savings)} "
                f"{top_saving.savings_unit or ''} avoided by {top_saving.name}".replace("  ", " ")
            )
        metrics.append(SuccessMetric(
            metric=f"Recorded emissions of {h.process}",
            baseline=f"{_fmt(h.emission)} {unit} recorded" if h.emission is not None else "Not recorded",
            target=target + ".",
        ))
        if h.percentage is not None:
            metrics.append(SuccessMetric(
                metric=f"Share of factory emissions from {h.process}",
                baseline=f"{_fmt(h.percentage)}% of factory emissions",
                target=f"A lower share once the actions for {h.process} take effect.",
            ))
    total_target = (
        f"Progress toward the projected {_fmt(scenario.projected_emission)} {scenario.unit} from the saved scenario."
        if scenario is not None and scenario.projected_emission is not None
        else "A downward trend relative to the recorded baseline."
    )
    metrics.append(SuccessMetric(
        metric="Total factory emissions",
        baseline=f"{_fmt(context.total_emission)} {unit} recorded" if context.total_emission is not None else "Not recorded",
        target=total_target,
    ))

    return ActionPlan(
        immediate_investigation=immediate,
        short_term_actions=short_term,
        medium_term_interventions=medium_term,
        measurements=measurements,
        expected_impact=expected_impact,
        risks_and_limitations=_dedupe(risks),
        success_metrics=metrics,
        source=PlanSource.DETERMINISTIC,
        confidence=_plan_confidence(context),
    )


# ---------------------------------------------------------------------------
# Grounding checks
# ---------------------------------------------------------------------------

def _numbers(text: str) -> set:
    return {float(n) for n in _NUMBER.findall(text)}


def grounding_problems(texts: Iterable[str], context: ActionPlanContext) -> List[str]:
    """Return why the texts are not grounded in the context (empty list = grounded)."""
    allowed = _numbers(context.model_dump_json())
    problems = []
    for text in texts:
        invented = _numbers(text) - allowed
        if invented:
            problems.append(f"numbers not in the tool data {sorted(invented)}: {text!r}")
        if _GUARANTEE.search(text):
            problems.append(f"guarantees an outcome: {text!r}")
        if _EQUIPMENT_CONDITION.search(text):
            problems.append(f"claims an equipment condition: {text!r}")
    return problems


# ---------------------------------------------------------------------------
# LLM refinement of the action sections
# ---------------------------------------------------------------------------

ACTION_PLAN_SYSTEM_PROMPT = """You are EcoTrace AI, a sustainability engineering assistant.

You receive (1) factory context produced by deterministic tools and (2) a draft action plan built from it.
Rewrite the four action sections — immediate_investigation, short_term_actions, medium_term_interventions
and measurements — so each action is specific and practical for this factory.

Rules you MUST follow:
1. Use only facts from the context. Every number you write must appear in the context exactly as written.
   Write no other numbers: no timeframes, counts, targets or new figures.
2. Use "estimated" or "projected" wording. Never present reductions, savings or payback as guaranteed or certain.
3. Hypotheses are unverified: present them as things to check on site. Never state or imply the condition of any equipment.
4. The factory team is the final decision-maker: recommend actions, do not present them as decided.
5. Keep intervention names exactly as in the context and do not add interventions that are not in it."""


def refine_with_llm(context: ActionPlanContext, draft: ActionPlan, llm: Any) -> Optional[ActionPlanNarrative]:
    """Ask the LLM to rewrite the action sections. Returns None unless the result is grounded."""
    draft_sections = draft.model_dump(
        mode="json",
        include={"immediate_investigation", "short_term_actions", "medium_term_interventions", "measurements"},
    )
    try:
        structured_llm = llm.with_structured_output(ActionPlanNarrative)
        result = structured_llm.invoke([
            SystemMessage(content=ACTION_PLAN_SYSTEM_PROMPT),
            HumanMessage(content=(
                f"Context:\n{context.model_dump_json(indent=2)}\n\n"
                f"Draft action sections:\n{json.dumps(draft_sections, indent=2)}"
            )),
        ])
        narrative = result if isinstance(result, ActionPlanNarrative) else ActionPlanNarrative.model_validate(result)
    except Exception as exc:
        logger.warning("LLM action plan refinement failed: %s", exc)
        return None

    problems = grounding_problems(narrative.texts(), context)
    if problems:
        logger.warning("Rejected LLM action plan (%d problems): %s", len(problems), problems[0])
        return None
    return narrative


# ---------------------------------------------------------------------------
# Tool function
# ---------------------------------------------------------------------------

def generate_action_plan(context: Union[ActionPlanContext, dict], llm: Any = None) -> ActionPlan:
    """Generate a structured, grounded sustainability action plan.

    Args:
        context: Tool-derived hotspots, root-cause findings, ranked
            recommendations, projected impact and assumptions.
        llm: Optional chat model; without it the deterministic plan is returned.

    Returns:
        A validated ActionPlan. `source` says whether the action sections were
        written by the LLM or by the deterministic templates.
    """
    context = context if isinstance(context, ActionPlanContext) else ActionPlanContext.model_validate(context)
    logger.info(
        "Tool: generate_action_plan factory=%s hotspots=%d recommendations=%d scenario=%s",
        context.factory_name, len(context.hotspots), len(context.recommendations), context.projected_impact is not None,
    )

    draft = build_action_plan_draft(context)
    if llm is None:
        return draft

    narrative = refine_with_llm(context, draft, llm)
    if narrative is None:
        return draft
    try:
        return ActionPlan.model_validate({**draft.model_dump(), **narrative.model_dump(), "source": PlanSource.LLM})
    except ValidationError as exc:
        logger.warning("LLM action plan failed validation: %s", exc)
        return draft


# ---------------------------------------------------------------------------
# Rendering
# ---------------------------------------------------------------------------

def _render_actions(actions: List[PlanAction]) -> List[str]:
    return [f"- **{a.title}** — {a.detail}" for a in actions]


def _render_impact(impact: ImpactEstimate) -> str:
    parts = []
    if impact.estimated_co2e_reduction is not None:
        parts.append(f"estimated {_fmt(impact.estimated_co2e_reduction)} {impact.co2e_reduction_unit or ''} reduction".replace("  ", " "))
    if impact.estimated_reduction_percent is not None:
        parts.append(f"{_fmt(impact.estimated_reduction_percent)}% of factory emissions")
    if impact.estimated_cost:
        parts.append(f"estimated cost: {impact.estimated_cost}")
    if impact.estimated_savings:
        parts.append(f"estimated savings: {impact.estimated_savings}")
    parts.append(f"projected payback: {impact.payback}")
    line = f"- **{impact.label}** ({impact.source}): " + "; ".join(parts) + "."
    if impact.projection:
        line += f" {impact.projection}"
    return line + f" _{impact.basis}_"


def render_action_plan(plan: ActionPlan) -> str:
    """Render the plan as Markdown for the copilot answer."""
    lines = ["## Sustainability action plan", "", f"_{plan.decision_note}_", ""]
    lines += ["### 1. Immediate investigation", *_render_actions(plan.immediate_investigation), ""]
    lines += ["### 2. Short-term action", *_render_actions(plan.short_term_actions), ""]
    lines += ["### 3. Medium-term intervention", *_render_actions(plan.medium_term_interventions), ""]
    lines += ["### 4. Measurement to perform", *_render_actions(plan.measurements), ""]
    lines += ["### 5. Expected impact"]
    lines += [_render_impact(i) for i in plan.expected_impact] or ["- No estimate is available from the current data."]
    lines += ["", "### 6. Risks / limitations", *[f"- {r}" for r in plan.risks_and_limitations], ""]
    lines += ["### 7. Success metric"]
    lines += [f"- **{m.metric}** — baseline: {m.baseline}; target: {m.target}" for m in plan.success_metrics]
    lines += ["", f"Confidence: {plan.confidence.value}"]
    return "\n".join(lines)
