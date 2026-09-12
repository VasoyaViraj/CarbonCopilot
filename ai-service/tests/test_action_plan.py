"""Run from ai-service/: python -m unittest discover -s tests -t ."""

import copy
import re
import unittest
from unittest.mock import AsyncMock, patch

from langchain_core.messages import AIMessage, HumanMessage
from pydantic import ValidationError

from app.agents import action_plan_workflow, nodes
from app.agents.action_plan_workflow import build_action_plan_context
from app.mcp.server import _unwrap
from app.mcp.tools.action_plan import (
    ESTIMATE_BASIS,
    ESTIMATES_NOT_GUARANTEED,
    HUMAN_DECISION_NOTE,
    ActionPlan,
    ActionPlanContext,
    PlanSource,
    build_action_plan_draft,
    generate_action_plan,
    grounding_problems,
    render_action_plan,
)
from app.schemas.ai_response import ConfidenceLevel
from tests.test_hotspot_workflow import DETAIL, PROFILE, RANKING

# Shapes from docs/API_CONTRACT.md §8 (recommendations) and §9 (scenarios).
RECOMMENDATIONS = {
    "factory": {"id": 1, "name": "ABC Metal Manufacturing"},
    "generatedAt": "2026-09-12T10:00:00.000Z",
    "weights": {"environmentalImpact": 0.4, "financialBenefit": 0.25, "feasibility": 0.2, "circularity": 0.15},
    "assumptions": ["Annual estimates use the emissions recorded in the 12 months before the recommendations were generated."],
    "recommendations": [
        {
            "id": 22, "rank": 1, "status": "PENDING", "alternative": "Waste heat recovery", "currentOption": "Unrecovered furnace heat",
            "category": "energy efficiency", "scope": "PROCESS", "processId": 7, "process": "Furnace", "score": 88.5,
            "estimatedReduction": 9.45, "reductionPercent": 20, "estimatedSavings": 104, "savingsUnit": "tCO2e/yr",
            "estimatedCost": "MEDIUM", "implementationDifficulty": "MEDIUM", "paybackPeriod": 2.4, "assumptions": [],
        },
        {
            "id": 23, "rank": 2, "status": "PENDING", "alternative": "LED lighting", "currentOption": "Fluorescent lighting",
            "category": "energy efficiency", "scope": "FACTORY", "processId": None, "process": None, "score": 71,
            "estimatedReduction": 1.09, "reductionPercent": 50, "estimatedSavings": 12, "savingsUnit": "tCO2e/yr",
            "estimatedCost": "LOW", "implementationDifficulty": "LOW", "paybackPeriod": 1.2, "assumptions": [],
        },
        {
            "id": 24, "rank": 3, "status": "ACCEPTED", "alternative": "Recycled aluminum", "currentOption": "Virgin aluminum",
            "category": "material", "scope": "FACTORY", "processId": None, "process": None, "score": 64.2,
            "estimatedReduction": 5.45, "reductionPercent": 15, "estimatedSavings": 60, "savingsUnit": "tCO2e/yr",
            "estimatedCost": "MEDIUM", "implementationDifficulty": "HIGH", "paybackPeriod": None,
            "assumptions": ["Payback is not available because the knowledge base has no cost estimate."],
        },
        {
            "id": 25, "rank": 4, "status": "REJECTED", "alternative": "Biogas boiler", "currentOption": "Natural gas boiler",
            "category": "fuel substitution", "score": 60, "estimatedReduction": 4, "estimatedSavings": 44,
            "savingsUnit": "tCO2e/yr", "estimatedCost": "HIGH", "implementationDifficulty": "HIGH", "paybackPeriod": 6,
        },
    ],
}

SCENARIOS = [
    {
        "id": 3, "factoryId": 1, "name": "30% recycled material", "baselineEmission": 1100, "projectedEmission": 980,
        "reductionAmount": 120, "reductionPercent": 10.91, "estimatedCost": 150000, "estimatedSavings": 6000,
        "paybackPeriod": 25, "unit": "tCO2e", "assumptions": ["Savings are estimated at $50 per tCO2e reduced."],
        "createdAt": "2026-09-12T10:00:00.000Z",
    },
    {"id": 2, "name": "Older scenario", "baselineEmission": 1000, "projectedEmission": 999, "unit": "tCO2e"},
]

SECTIONS = ["immediate_investigation", "short_term_actions", "medium_term_interventions", "measurements"]

NUMBER = re.compile(r"(?<![\w.])\d+(?:\.\d+)?(?!\w)")


def full_tool_results(**overrides):
    results = {
        "factory_profile": PROFILE,
        "hotspot_ranking": RANKING,
        "hotspot_detail": DETAIL,
        "hotspot_target": {"processId": 7, "process": "Furnace", "selection": "TOP_RANKED"},
        "recommendations": RECOMMENDATIONS,
        "saved_scenarios": SCENARIOS,
    }
    results.update(overrides)
    return copy.deepcopy(results)


def full_context(**overrides):
    return build_action_plan_context(full_tool_results(**overrides), [])


def action_titles(plan, section):
    return [a.title for a in getattr(plan, section)]


class FakeStructuredLLM:
    """Returns a fixed narrative from with_structured_output(...).invoke()."""

    def __init__(self, output=None, error=None):
        self.output, self.error, self.calls = output, error, []

    def with_structured_output(self, schema):
        return self

    def invoke(self, messages):
        self.calls.append(messages)
        if self.error:
            raise self.error
        return self.output


def narrative(**overrides):
    base = {
        "immediate_investigation": [{"title": "Verify Furnace data", "detail": "Furnace contributes 47.27% of factory emissions; confirm its natural gas records on site.", "related_to": "Furnace"}],
        "short_term_actions": [{"title": "Pilot LED lighting", "detail": "LED lighting is estimated to avoid 12 tCO2e/yr with a projected payback of 1.2 years."}],
        "medium_term_interventions": [{"title": "Assess Waste heat recovery", "detail": "Waste heat recovery is ranked #1 with a score of 88.5; review the estimate with suppliers."}],
        "measurements": [{"title": "Track Furnace emissions", "detail": "Compare monthly Furnace emissions with the 520 tCO2e recorded so far."}],
    }
    base.update(overrides)
    return base


class ActionPlanSchemaTest(unittest.TestCase):
    def setUp(self):
        self.plan = build_action_plan_draft(full_context())
        self.data = self.plan.model_dump(mode="json")

    def test_plan_round_trips_through_schema(self):
        self.assertEqual(ActionPlan.model_validate(self.data), self.plan)

    def test_every_section_is_required_and_non_empty(self):
        for section in SECTIONS + ["risks_and_limitations", "success_metrics"]:
            with self.subTest(section=section):
                with self.assertRaises(ValidationError):
                    ActionPlan.model_validate({**self.data, section: []})
                missing = {k: v for k, v in self.data.items() if k != section}
                with self.assertRaises(ValidationError):
                    ActionPlan.model_validate(missing)

    def test_expected_impact_is_required_but_may_be_empty(self):
        self.assertEqual(ActionPlan.model_validate({**self.data, "expected_impact": []}).expected_impact, [])
        with self.assertRaises(ValidationError):
            ActionPlan.model_validate({k: v for k, v in self.data.items() if k != "expected_impact"})

    def test_actions_need_a_title_and_detail(self):
        for bad in [{"title": "", "detail": "x"}, {"title": "x", "detail": ""}, {"title": "x"}]:
            with self.subTest(action=bad), self.assertRaises(ValidationError):
                ActionPlan.model_validate({**self.data, "measurements": [bad]})

    def test_guaranteed_outcomes_are_rejected(self):
        for text in [
            "Savings are guaranteed.",
            "This will reduce emissions by 9.45%.",
            "LED lighting will save 12 tCO2e/yr.",
            "It is definitely worth it.",
            "A risk-free investment.",
        ]:
            with self.subTest(text=text), self.assertRaises(ValidationError):
                ActionPlan.model_validate({**self.data, "risks_and_limitations": [text]})

    def test_estimate_wording_is_allowed(self):
        plan = ActionPlan.model_validate({**self.data, "risks_and_limitations": ["Savings are estimated and not guaranteed."]})
        self.assertEqual(plan.risks_and_limitations, ["Savings are estimated and not guaranteed."])

    def test_human_decision_note_cannot_be_changed(self):
        self.assertEqual(self.plan.decision_note, HUMAN_DECISION_NOTE)
        with self.assertRaises(ValidationError):
            ActionPlan.model_validate({**self.data, "decision_note": "Implement all actions immediately."})


class DraftPlanTest(unittest.TestCase):
    def test_every_number_comes_from_the_context(self):
        context = full_context()
        plan = build_action_plan_draft(context)
        self.assertEqual(grounding_problems(plan.texts(), context), [])

    def test_quick_wins_are_short_term_and_the_rest_medium_term(self):
        plan = build_action_plan_draft(full_context())
        self.assertEqual(action_titles(plan, "short_term_actions"), ["Pilot LED lighting"])
        self.assertEqual(
            action_titles(plan, "medium_term_interventions"),
            ["Plan implementation of Waste heat recovery", "Plan implementation of Recycled aluminum"],
        )

    def test_rejected_recommendations_are_left_out(self):
        plan = build_action_plan_draft(full_context())
        self.assertFalse(any("Biogas boiler" in text for text in plan.texts()))

    def test_immediate_investigation_uses_hotspots_and_hypotheses(self):
        plan = build_action_plan_draft(full_context())
        furnace = plan.immediate_investigation[0]

        self.assertEqual(furnace.title, "Investigate Furnace emissions")
        self.assertIn("hotspot #1 with 520 tCO2e recorded (47.27% of factory emissions, CRITICAL)", furnace.detail)
        self.assertIn("Check these unverified hypotheses on site: Natural gas drives 76.92%", furnace.detail)
        self.assertEqual(plan.immediate_investigation[1].title, "Investigate Boiler emissions")

    def test_expected_impact_copies_tool_values(self):
        plan = build_action_plan_draft(full_context())
        by_label = {i.label: i for i in plan.expected_impact}

        heat = by_label["Waste heat recovery"]
        self.assertEqual((heat.estimated_co2e_reduction, heat.co2e_reduction_unit), (104, "tCO2e/yr"))
        self.assertEqual(heat.estimated_reduction_percent, 9.45)
        self.assertEqual(heat.payback, "2.4 years")
        self.assertEqual(by_label["Recycled aluminum"].payback, "N/A")

        scenario = by_label["30% recycled material"]
        self.assertEqual(scenario.source, "scenario")
        self.assertEqual((scenario.estimated_cost, scenario.estimated_savings), ("150000 USD", "6000 USD"))
        self.assertEqual(scenario.projection, "Projected emissions of 980 tCO2e against a baseline of 1100 tCO2e.")
        for impact in plan.expected_impact:
            self.assertEqual(impact.basis, ESTIMATE_BASIS)

    def test_risks_carry_every_assumption_and_limitation(self):
        risks = build_action_plan_draft(full_context()).risks_and_limitations

        self.assertEqual(risks[0], ESTIMATES_NOT_GUARANTEED)
        self.assertIn(RECOMMENDATIONS["assumptions"][0], risks)
        self.assertIn("Payback is not available because the knowledge base has no cost estimate.", risks)
        self.assertIn("Savings are estimated at $50 per tCO2e reduced.", risks)
        self.assertTrue(any("Equipment condition" in r for r in risks))
        self.assertEqual(len(risks), len(set(risks)))

    def test_success_metrics_start_from_recorded_baselines(self):
        metrics = {m.metric: m for m in build_action_plan_draft(full_context()).success_metrics}

        self.assertEqual(metrics["Recorded emissions of Furnace"].baseline, "520 tCO2e recorded")
        self.assertIn("estimated 104 tCO2e/yr avoided by Waste heat recovery", metrics["Recorded emissions of Furnace"].target)
        self.assertEqual(metrics["Share of factory emissions from Furnace"].baseline, "47.27% of factory emissions")
        self.assertEqual(metrics["Total factory emissions"].baseline, "1100 tCO2e recorded")
        self.assertIn("projected 980 tCO2e", metrics["Total factory emissions"].target)

    def test_complete_data_is_high_confidence(self):
        plan = build_action_plan_draft(full_context())
        self.assertEqual(plan.confidence, ConfidenceLevel.HIGH)
        self.assertEqual(plan.source, PlanSource.DETERMINISTIC)

    def test_without_recommendations_the_plan_is_still_valid(self):
        plan = build_action_plan_draft(full_context(recommendations={"recommendations": []}, saved_scenarios=[]))

        self.assertEqual(action_titles(plan, "short_term_actions"), ["Generate ranked recommendations"])
        self.assertEqual(action_titles(plan, "medium_term_interventions"), ["Re-assess interventions"])
        self.assertEqual(plan.expected_impact, [])
        self.assertTrue(any("No ranked recommendations" in r for r in plan.risks_and_limitations))
        self.assertTrue(any("No saved what-if scenario" in r for r in plan.risks_and_limitations))
        self.assertEqual(plan.confidence, ConfidenceLevel.MEDIUM)

    def test_only_high_cost_recommendations_get_a_feasibility_step(self):
        recs = copy.deepcopy(RECOMMENDATIONS)
        recs["recommendations"] = [recs["recommendations"][0]]
        plan = build_action_plan_draft(full_context(recommendations=recs))
        self.assertEqual(action_titles(plan, "short_term_actions"), ["Prepare a feasibility assessment for Waste heat recovery"])

    def test_tool_failure_lowers_confidence_and_is_reported(self):
        results = full_tool_results(recommendations=None)
        context = build_action_plan_context(results, [{"tool": "get_recommendations", "error": "timeout"}])
        plan = build_action_plan_draft(context)

        self.assertIn("The get_recommendations tool could not be reached, so its data is not included.", plan.risks_and_limitations)
        self.assertIn("Close data gaps", action_titles(plan, "immediate_investigation"))
        self.assertEqual(plan.confidence, ConfidenceLevel.LOW)

    def test_no_data_at_all(self):
        errors = [{"tool": t, "error": "down"} for t in ("get_hotspot_ranking", "get_recommendations", "list_scenarios")]
        plan = build_action_plan_draft(build_action_plan_context({}, errors))

        self.assertEqual(plan.confidence, ConfidenceLevel.UNAVAILABLE)
        for section in SECTIONS:
            self.assertGreaterEqual(len(getattr(plan, section)), 1)
        self.assertEqual(plan.success_metrics[0].baseline, "Not recorded")


class ContextBuilderTest(unittest.TestCase):
    def test_maps_backend_payloads(self):
        context = full_context()

        self.assertEqual(context.factory_name, "ABC Metal Manufacturing")
        self.assertEqual(context.total_emission, 1100)
        self.assertEqual([h.process for h in context.hotspots], ["Furnace", "Boiler", "Paint Shop"])
        self.assertEqual(context.root_cause.process, "Furnace")
        self.assertEqual(len(context.root_cause.hypotheses), 2)

        heat = context.recommendations[0]
        self.assertEqual((heat.name, heat.score, heat.estimated_reduction_percent, heat.targeted_reduction_percent), ("Waste heat recovery", 88.5, 9.45, 20))
        self.assertEqual((heat.cost_level, heat.payback_years, heat.savings_unit), ("MEDIUM", 2.4, "tCO2e/yr"))
        self.assertEqual([r.name for r in context.recommendations], ["Waste heat recovery", "LED lighting", "Recycled aluminum"])

        # Newest saved scenario only.
        self.assertEqual(context.projected_impact.name, "30% recycled material")
        self.assertEqual(context.projected_impact.payback_years, 25)

    def test_backend_warnings_become_data_gaps(self):
        recs = {**RECOMMENDATIONS, "warnings": [{"code": "NO_EMISSIONS", "message": "Nothing recorded in the window."}]}
        context = full_context(recommendations=recs)
        self.assertIn("Data warning (NO_EMISSIONS): Nothing recorded in the window.", context.data_gaps)

    def test_backend_envelope_is_unwrapped(self):
        self.assertEqual(_unwrap({"success": True, "data": [1, 2]}), [1, 2])
        self.assertEqual(_unwrap({"hotspots": []}), {"hotspots": []})
        self.assertEqual(_unwrap({"success": False, "error": {"code": "X"}}), {"success": False, "error": {"code": "X"}})


class LLMRefinementTest(unittest.TestCase):
    def setUp(self):
        self.context = full_context()
        self.draft = build_action_plan_draft(self.context)

    def test_grounded_llm_sections_are_used(self):
        plan = generate_action_plan(self.context, llm=FakeStructuredLLM(output=narrative()))

        self.assertEqual(plan.source, PlanSource.LLM)
        self.assertEqual(action_titles(plan, "short_term_actions"), ["Pilot LED lighting"])
        self.assertEqual(action_titles(plan, "immediate_investigation"), ["Verify Furnace data"])
        # Numbers, risks and the decision note stay deterministic.
        self.assertEqual(plan.expected_impact, self.draft.expected_impact)
        self.assertEqual(plan.success_metrics, self.draft.success_metrics)
        self.assertEqual(plan.risks_and_limitations, self.draft.risks_and_limitations)
        self.assertEqual(plan.decision_note, HUMAN_DECISION_NOTE)

    def test_ungrounded_llm_output_falls_back_to_the_draft(self):
        cases = {
            "invented number": narrative(measurements=[{"title": "Cut Furnace emissions", "detail": "Aim for a 35% cut within 6 months."}]),
            "guarantee": narrative(short_term_actions=[{"title": "Pilot LED lighting", "detail": "This will save 12 tCO2e/yr."}]),
            "equipment condition": narrative(immediate_investigation=[{"title": "Fix Furnace", "detail": "The Furnace burner is faulty."}]),
            "empty section": narrative(measurements=[]),
        }
        for name, output in cases.items():
            with self.subTest(case=name):
                plan = generate_action_plan(self.context, llm=FakeStructuredLLM(output=output))
                self.assertEqual(plan.source, PlanSource.DETERMINISTIC)
                self.assertEqual(plan, self.draft)

    def test_llm_error_falls_back_to_the_draft(self):
        plan = generate_action_plan(self.context, llm=FakeStructuredLLM(error=RuntimeError("quota exceeded")))
        self.assertEqual(plan, self.draft)

    def test_without_llm_the_draft_is_returned(self):
        self.assertEqual(generate_action_plan(self.context), self.draft)
        self.assertEqual(generate_action_plan(self.context.model_dump()), self.draft)

    def test_llm_is_given_only_tool_data_and_the_rules(self):
        llm = FakeStructuredLLM(output=narrative())
        generate_action_plan(self.context, llm=llm)

        system, human = llm.calls[0]
        self.assertIn("Every number you write must appear in the context", system.content)
        self.assertIn("Never present reductions, savings or payback as guaranteed", system.content)
        self.assertIn("factory team is the final decision-maker", system.content)
        self.assertIn(self.context.model_dump_json(indent=2), human.content)


class RenderTest(unittest.TestCase):
    def test_renders_seven_sections_in_order(self):
        text = render_action_plan(build_action_plan_draft(full_context()))
        headings = re.findall(r"^### (.+)$", text, re.MULTILINE)

        self.assertEqual(headings, [
            "1. Immediate investigation",
            "2. Short-term action",
            "3. Medium-term intervention",
            "4. Measurement to perform",
            "5. Expected impact",
            "6. Risks / limitations",
            "7. Success metric",
        ])
        self.assertIn(HUMAN_DECISION_NOTE, text)
        self.assertIn("projected payback: N/A", text)
        self.assertIn("Confidence: HIGH", text)

    def test_empty_expected_impact_is_explained(self):
        plan = build_action_plan_draft(full_context(recommendations={"recommendations": []}, saved_scenarios=[]))
        self.assertIn("No estimate is available from the current data.", render_action_plan(plan))


class ActionPlanGraphTest(unittest.IsolatedAsyncioTestCase):
    async def run_graph(self, recommendations=None, plan_llm=None):
        from app.agents.graph import ecotrace_graph

        router_llm = FakeStructuredLLM()
        recs_mock = recommendations or AsyncMock(return_value=copy.deepcopy(RECOMMENDATIONS))
        steps, final = [], None
        with patch.object(nodes, "get_llm", return_value=router_llm), \
                patch.object(action_plan_workflow, "get_llm", return_value=plan_llm or FakeStructuredLLM(error=RuntimeError("no key"))), \
                patch("app.mcp.tools.factory_profile.get_factory_profile", AsyncMock(return_value=copy.deepcopy(PROFILE))), \
                patch.object(action_plan_workflow, "get_hotspot_ranking", AsyncMock(return_value=copy.deepcopy(RANKING))), \
                patch.object(action_plan_workflow, "get_hotspot_detail", AsyncMock(return_value=copy.deepcopy(DETAIL))), \
                patch.object(action_plan_workflow, "get_recommendations", recs_mock), \
                patch.object(action_plan_workflow, "list_scenarios", AsyncMock(return_value=copy.deepcopy(SCENARIOS))):
            async for mode, chunk in ecotrace_graph.astream(
                {"messages": [HumanMessage(content="Generate an action plan.")], "factory_id": 1, "tool_results": {}},
                stream_mode=["updates", "values"],
            ):
                if mode == "updates":
                    steps.extend(chunk)
                else:
                    final = chunk
        return steps, final, router_llm

    async def test_action_plan_workflow_sequence(self):
        steps, final, _ = await self.run_graph()

        self.assertEqual(steps, ["intent_router", "load_factory_data", "action_plan_gather_context", "action_plan_generate", "generate_response"])
        self.assertEqual(final["tools_used"], [
            "get_factory_profile", "get_hotspot_ranking", "get_recommendations", "list_scenarios",
            "get_hotspot_detail", "generate_action_plan",
        ])

    async def test_answer_is_the_rendered_validated_plan(self):
        _, final, router_llm = await self.run_graph()

        plan = ActionPlan.model_validate(final["tool_results"]["action_plan"])
        self.assertEqual(final["final_answer"], render_action_plan(plan))
        self.assertIsInstance(final["messages"][-1], AIMessage)
        self.assertEqual(final["confidence"], "HIGH")
        self.assertEqual(final["assumptions"], plan.risks_and_limitations)
        # The response node renders the plan; it does not ask the LLM to restate numbers.
        self.assertEqual(router_llm.calls, [])

    async def test_llm_refined_plan_flows_through(self):
        _, final, _ = await self.run_graph(plan_llm=FakeStructuredLLM(output=narrative()))
        self.assertEqual(final["tool_results"]["action_plan"]["source"], "LLM")
        self.assertIn("Verify Furnace data", final["final_answer"])

    async def test_tool_failure_still_produces_a_plan(self):
        _, final, _ = await self.run_graph(recommendations=AsyncMock(side_effect=RuntimeError("backend down")))

        self.assertEqual(final["tool_errors"], [{"tool": "get_recommendations", "error": "backend down"}])
        self.assertEqual(final["confidence"], "LOW")
        self.assertIn("### 7. Success metric", final["final_answer"])


if __name__ == "__main__":
    unittest.main()
