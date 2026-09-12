"""End-to-end copilot checks for the Phase 25 review questions.

Each question runs through the compiled LangGraph with deterministic stand-ins
for the Express backend tools, and is checked for intent, the minimum tool
sequence, grounding, assumptions, confidence and failure handling.

Run from ai-service/: python -m unittest discover -s tests -t .
"""

import copy
import json
import re
import unittest
from contextlib import ExitStack
from unittest.mock import AsyncMock, patch

from langchain_core.messages import AIMessage, HumanMessage

from app.agents import action_plan_workflow, hotspot_workflow, nodes, recommendation_workflow, scenario_workflow
from app.agents.nodes import LLM_UNAVAILABLE_NOTE
from app.agents.scenario_workflow import parse_parameters_by_rules
from app.schemas.ai_response import ConfidenceLevel
from app.services.copilot import build_copilot_response
from tests.test_action_plan import RECOMMENDATIONS, SCENARIOS
from tests.test_hotspot_workflow import DETAIL, PROFILE, RANKING, SUMMARY

SCENARIO_RESULT = {
    "baselineEmission": 1100,
    "projectedEmission": 980,
    "reductionAmount": 120,
    "reductionPercent": 10.91,
    "estimatedCost": 150000,
    "estimatedSavings": 6000,
    "paybackPeriod": 25,
    "unit": "tCO2e",
    "assumptions": ["Savings are estimated at $50 per tCO2e reduced."],
}

NUMBER = re.compile(r"(?<![\w.])\d+(?:\.\d+)?(?!\w)")


def numbers(text):
    return {float(n) for n in NUMBER.findall(text)}


TOOL_NUMBERS = numbers(json.dumps([PROFILE, RANKING, DETAIL, SUMMARY, RECOMMENDATIONS, SCENARIOS, SCENARIO_RESULT]))

REVIEW_QUESTIONS = [
    ("Why is my furnace a hotspot?", "HOTSPOT_ANALYSIS",
     ["get_factory_profile", "get_emissions_summary", "get_hotspot_ranking", "get_hotspot_detail"]),
    ("What should I fix first?", "RECOMMENDATION",
     ["get_factory_profile", "get_hotspot_ranking", "get_recommendations"]),
    ("Which intervention has the best ROI?", "RECOMMENDATION",
     ["get_factory_profile", "get_hotspot_ranking", "get_recommendations"]),
    ("What happens if I use 30% recycled material?", "SCENARIO",
     ["get_factory_profile", "parse_intervention_parameters", "calculate_scenario"]),
    ("Generate an action plan.", "ACTION_PLAN",
     ["get_factory_profile", "get_hotspot_ranking", "get_recommendations", "list_scenarios", "get_hotspot_detail",
      "generate_action_plan"]),
]


class WorkingLLM:
    """Explains tool results; parses scenario parameters as JSON."""

    def with_structured_output(self, schema):
        raise RuntimeError("structured output not used in these tests")

    def invoke(self, messages):
        if "parameter extractor" in messages[0].content:
            return AIMessage(content='{"recycled_material_percent": 30}')
        return AIMessage(content="Grounded explanation of the tool results.")


class BrokenLLM:
    """An LLM provider that is down (quota, network, missing key)."""

    def with_structured_output(self, schema):
        raise RuntimeError("LLM unavailable")

    def invoke(self, messages):
        raise RuntimeError("LLM unavailable")


class Backend:
    """Deterministic stand-ins for the Express-backed MCP tools; `fail` names tools that raise."""

    def __init__(self, fail=()):
        def tool(name, value):
            if name in fail:
                return AsyncMock(side_effect=RuntimeError(f"{name} unreachable"))
            return AsyncMock(return_value=copy.deepcopy(value))

        self.profile = tool("get_factory_profile", PROFILE)
        self.summary = tool("get_emissions_summary", SUMMARY)
        self.ranking = tool("get_hotspot_ranking", RANKING)
        self.detail = tool("get_hotspot_detail", DETAIL)
        self.recommendations = tool("get_recommendations", RECOMMENDATIONS)
        self.saved_scenarios = tool("list_scenarios", SCENARIOS)
        self.scenario = tool("calculate_scenario", SCENARIO_RESULT)

    def patches(self):
        return [
            patch("app.mcp.tools.factory_profile.get_factory_profile", self.profile),
            patch.object(hotspot_workflow, "get_emissions_summary", self.summary),
            patch.object(hotspot_workflow, "get_hotspot_ranking", self.ranking),
            patch.object(hotspot_workflow, "get_hotspot_detail", self.detail),
            patch.object(recommendation_workflow, "get_hotspot_ranking", self.ranking),
            patch.object(recommendation_workflow, "get_recommendations", self.recommendations),
            patch.object(scenario_workflow, "calculate_scenario", self.scenario),
            patch.object(action_plan_workflow, "get_hotspot_ranking", self.ranking),
            patch.object(action_plan_workflow, "get_hotspot_detail", self.detail),
            patch.object(action_plan_workflow, "get_recommendations", self.recommendations),
            patch.object(action_plan_workflow, "list_scenarios", self.saved_scenarios),
        ]


async def ask(message, llm, backend):
    from app.agents.graph import ecotrace_graph

    with ExitStack() as stack:
        for backend_patch in backend.patches():
            stack.enter_context(backend_patch)
        for module in (nodes, scenario_workflow, action_plan_workflow):
            stack.enter_context(patch.object(module, "get_llm", return_value=llm))
        state = await ecotrace_graph.ainvoke({"messages": [HumanMessage(content=message)], "factory_id": 1, "tool_results": {}})
    return state, build_copilot_response(state)


class ReviewQuestionsTest(unittest.IsolatedAsyncioTestCase):
    async def test_each_question_runs_the_minimum_workflow(self):
        for message, intent, tools in REVIEW_QUESTIONS:
            with self.subTest(message=message):
                state, response = await ask(message, WorkingLLM(), Backend())

                self.assertEqual(state["intent"], intent)
                self.assertEqual(state["tools_used"], tools)
                self.assertTrue(response.answer)
                self.assertTrue(response.assumptions)
                self.assertNotEqual(response.confidence, ConfidenceLevel.UNAVAILABLE)

    async def test_scenario_numbers_come_from_the_engine(self):
        backend = Backend()
        _, response = await ask("What happens if I use 30% recycled material?", WorkingLLM(), backend)

        backend.scenario.assert_awaited_once_with(
            factory_id=1,
            recycled_material_percent=30.0,
            energy_efficiency_percent=0.0,
            fuel_replacement_percent=0.0,
            waste_recovery_percent=0.0,
        )
        self.assertEqual(response.scenario.projected_emission, 980)
        self.assertEqual(response.scenario.payback_period, "25")

    async def test_recommendations_are_the_backend_ranking(self):
        _, response = await ask("Which intervention has the best ROI?", WorkingLLM(), Backend())

        self.assertEqual([item.name for item in response.recommendations], ["Waste heat recovery", "LED lighting", "Recycled aluminum"])
        self.assertEqual([item.payback_years for item in response.recommendations], [2.4, 1.2, None])

    async def test_hotspot_question_does_not_touch_other_workflows(self):
        backend = Backend()
        await ask("Why is my furnace a hotspot?", WorkingLLM(), backend)

        backend.recommendations.assert_not_awaited()
        backend.scenario.assert_not_awaited()
        backend.saved_scenarios.assert_not_awaited()

    async def test_failed_tool_is_reported_not_guessed(self):
        _, response = await ask("What should I fix first?", WorkingLLM(), Backend(fail={"get_recommendations"}))

        self.assertEqual(response.recommendations, [])
        self.assertEqual(response.confidence, ConfidenceLevel.UNAVAILABLE)
        self.assertTrue(any("get_recommendations tool could not be reached" in item for item in response.assumptions))


class LLMUnavailableTest(unittest.IsolatedAsyncioTestCase):
    async def test_questions_are_answered_from_tool_results_only(self):
        for message, intent, _ in REVIEW_QUESTIONS:
            with self.subTest(message=message):
                state, response = await ask(message, BrokenLLM(), Backend())

                self.assertEqual(state["intent"], intent)
                self.assertTrue(response.answer)
                # Section numbers of the rendered action plan are the only other digits allowed.
                allowed = TOOL_NUMBERS | numbers(message) | {float(n) for n in range(1, 8)}
                self.assertTrue(numbers(response.answer) <= allowed, response.answer)
                if intent != "ACTION_PLAN":
                    self.assertIn(LLM_UNAVAILABLE_NOTE, response.answer)

    async def test_hotspot_fallback_keeps_the_four_evidence_sections(self):
        _, response = await ask("Why is my furnace a hotspot?", BrokenLLM(), Backend())

        for heading in ("Actual factory data", "Derived metrics", "Hypotheses", "Missing information"):
            self.assertIn(heading, response.answer)
        self.assertIn("47.27%", response.answer)
        self.assertEqual(response.confidence, ConfidenceLevel.HIGH)

    async def test_scenario_values_are_read_by_rules(self):
        backend = Backend()
        _, response = await ask("What happens if I use 30% recycled material?", BrokenLLM(), backend)

        self.assertEqual(backend.scenario.await_args.kwargs["recycled_material_percent"], 30.0)
        self.assertIn("980", response.answer)

    async def test_ambiguous_scenario_asks_instead_of_guessing(self):
        backend = Backend()
        state, response = await ask("What if I use more recycled material?", BrokenLLM(), backend)

        backend.scenario.assert_not_awaited()
        self.assertNotIn("calculate_scenario", state["tools_used"])
        self.assertIn("?", response.answer)
        self.assertIsNone(response.scenario)

    async def test_general_question_says_the_explanation_is_unavailable(self):
        _, response = await ask("What is Scope 2?", BrokenLLM(), Backend())

        self.assertIn(LLM_UNAVAILABLE_NOTE, response.answer)
        self.assertEqual(response.confidence, ConfidenceLevel.UNAVAILABLE)

    async def test_tool_and_llm_failure_together(self):
        _, response = await ask("What should I fix first?", BrokenLLM(), Backend(fail={"get_recommendations"}))

        self.assertIn("could not be reached", response.answer)
        self.assertEqual(response.confidence, ConfidenceLevel.UNAVAILABLE)


class ScenarioRuleParsingTest(unittest.TestCase):
    def test_reads_explicit_values(self):
        parsed = parse_parameters_by_rules("What if I use 30% recycled material and improve energy efficiency by 15%?")
        self.assertEqual((parsed.recycled_material_percent, parsed.energy_efficiency_percent), (30.0, 15.0))

    def test_ignores_ambiguous_or_invalid_clauses(self):
        for message in [
            "What if I use more recycled material?",
            "What if 30% recycled waste?",  # two levers in one clause
            "What if I use 150% recycled material?",
            "What if we cut emissions by 20%?",  # no lever named
        ]:
            with self.subTest(message=message):
                self.assertIsNone(parse_parameters_by_rules(message))


if __name__ == "__main__":
    unittest.main()
