"""Run from ai-service/: python -m unittest discover -s tests -t ."""

import copy
import json
import re
import unittest
from unittest.mock import AsyncMock, patch

from langchain_core.messages import AIMessage, HumanMessage

from app.agents import hotspot_workflow, nodes
from app.agents.hotspot_workflow import NO_EQUIPMENT_DATA, build_root_cause, select_target_hotspot
from app.schemas.ai_response import ConfidenceLevel

# Shapes from docs/API_CONTRACT.md §3, §6 and §7.
PROFILE = {"id": 1, "name": "ABC Metal Manufacturing", "industryType": "Metal Components", "processes": []}

SUMMARY = {
    "factory": {"id": 1, "name": "ABC Metal Manufacturing"},
    "co2eUnit": "tCO2e",
    "totals": {"co2e": 1100, "simulatedCo2e": 0, "activityCount": 84, "emissionCount": 84},
    "history": [{"period": "2026-09", "co2e": 104}],
    "warnings": [],
}

RANKING = {
    "factory": {"id": 1, "name": "ABC Metal Manufacturing"},
    "co2eUnit": "tCO2e",
    "totalEmission": 1100,
    "activityCount": 84,
    "emissionCount": 84,
    "thresholds": {"critical": 40, "high": 25, "medium": 10},
    "hotspots": [
        {"rank": 1, "processId": 7, "process": "Furnace", "emission": 520, "percentage": 47.27, "severity": "CRITICAL", "activityCount": 24},
        {"rank": 2, "processId": 9, "process": "Boiler", "emission": 330, "percentage": 30, "severity": "HIGH", "activityCount": 30},
        {"rank": 3, "processId": 4, "process": "Paint Shop", "emission": 250, "percentage": 22.73, "severity": "MEDIUM", "activityCount": 30},
    ],
    "warnings": [],
}

DETAIL = {
    "process": {"id": 7, "name": "Furnace", "processType": "THERMAL", "description": "Main heat treatment"},
    "hotspot": RANKING["hotspots"][0],
    "factoryTotalEmission": 1100,
    "rankedProcessCount": 3,
    "thresholds": {"critical": 40, "high": 25, "medium": 10},
    "co2eUnit": "tCO2e",
    "emission": 520,
    "simulatedEmission": 0,
    "activityCount": 24,
    "drivers": [
        {"activityType": "ELECTRICITY", "label": "Electricity", "category": "ENERGY", "co2e": 120, "percentage": 23.08},
        {"activityType": "NATURAL_GAS", "label": "Natural gas", "category": "FUEL", "co2e": 400, "percentage": 76.92},
    ],
    "history": [{"period": "2026-09", "co2e": 43.3}],
    "production": {"quantity": 800, "unit": "tonnes", "byUnit": []},
    "intensity": {"value": 0.65, "unit": "tCO2e/tonne"},
    "warnings": [],
}

# A number not embedded in a word (so the "2" in "tCO2e" is not counted).
NUMBER = re.compile(r"(?<![\w.])\d+(?:\.\d+)?(?!\w)")

# Words that would describe an equipment condition EcoTrace never records.
EQUIPMENT_CONDITION_WORDS = ["faulty", "worn", "leak", "broken", "malfunction", "degraded", "poorly maintained", "inefficient"]


def tool_results(**overrides):
    results = {
        "factory_profile": PROFILE,
        "emissions_summary": SUMMARY,
        "hotspot_ranking": RANKING,
        "hotspot_detail": DETAIL,
        "hotspot_target": {"processId": 7, "process": "Furnace", "selection": "MENTIONED"},
    }
    results.update(overrides)
    return copy.deepcopy(results)


def statements(rca, *sections):
    sections = sections or ("factory_data", "derived_metrics", "hypotheses", "missing_information")
    return [item.statement for section in sections for item in getattr(rca, section)]


class TargetSelectionTest(unittest.TestCase):
    def test_mentioned_process_is_selected(self):
        hotspot, selection = select_target_hotspot(RANKING["hotspots"], "Why is my boiler a hotspot?")
        self.assertEqual(hotspot["processId"], 9)
        self.assertEqual(selection, "MENTIONED")

    def test_multi_word_and_plural_names_match(self):
        self.assertEqual(select_target_hotspot(RANKING["hotspots"], "why is the paint shop so high")[0]["processId"], 4)
        self.assertEqual(select_target_hotspot(RANKING["hotspots"], "Why are furnaces hotspots?")[0]["processId"], 7)

    def test_unmentioned_process_defaults_to_top_ranked(self):
        hotspot, selection = select_target_hotspot(RANKING["hotspots"], "What is my biggest hotspot?")
        self.assertEqual(hotspot["processId"], 7)
        self.assertEqual(selection, "TOP_RANKED")

    def test_no_hotspots(self):
        self.assertEqual(select_target_hotspot([], "Why is my furnace a hotspot?"), (None, None))


class RootCauseGroundingTest(unittest.TestCase):
    def test_every_number_comes_from_tool_output(self):
        results = tool_results()
        rca = build_root_cause(results, [])
        allowed = set(NUMBER.findall(json.dumps(results)))

        for statement in statements(rca):
            with self.subTest(statement=statement):
                self.assertTrue(set(NUMBER.findall(statement)) <= allowed, statement)

    def test_factory_data_quotes_tool_values(self):
        rca = build_root_cause(tool_results(), [])
        facts = " ".join(statements(rca, "factory_data"))

        self.assertIn("Furnace has recorded 520 tCO2e of emissions across 24 activities.", facts)
        self.assertIn("The factory has recorded 1100 tCO2e of emissions across 84 activities.", facts)
        self.assertIn("Natural gas accounts for 400 tCO2e of Furnace emissions.", facts)
        self.assertIn("Metal Components", facts)
        self.assertIn("800 tonnes", facts)

    def test_derived_metrics_quote_backend_calculations(self):
        rca = build_root_cause(tool_results(), [])
        derived = " ".join(statements(rca, "derived_metrics"))

        self.assertIn("ranks #1 of 3", derived)
        self.assertIn("47.27% of factory emissions, severity CRITICAL", derived)
        self.assertIn("Natural gas is 76.92% of Furnace emissions.", derived)
        self.assertIn("0.65 tCO2e/tonne", derived)

    def test_sections_are_kept_apart(self):
        rca = build_root_cause(tool_results(), [])
        # Derived shares are not reported as recorded data, and vice versa.
        self.assertFalse(any("%" in s for s in statements(rca, "factory_data")))
        self.assertTrue(all(item.source != "rule" for item in rca.factory_data + rca.derived_metrics))
        self.assertTrue(all(item.source == "rule" for item in rca.hypotheses))

    def test_hypotheses_follow_largest_drivers_and_are_unverified(self):
        rca = build_root_cause(tool_results(), [])

        self.assertEqual(len(rca.hypotheses), 2)
        self.assertTrue(rca.hypotheses[0].statement.startswith("Natural gas drives 76.92% of Furnace emissions"))
        for item in rca.hypotheses:
            self.assertIn("Not verified", item.statement)

    def test_no_equipment_condition_claims(self):
        rca = build_root_cause(tool_results(), [])

        for statement in statements(rca, "factory_data", "derived_metrics", "hypotheses"):
            for word in EQUIPMENT_CONDITION_WORDS:
                self.assertNotIn(word, statement.lower())
        self.assertIn(NO_EQUIPMENT_DATA, statements(rca, "missing_information"))

    def test_complete_data_is_high_confidence(self):
        rca = build_root_cause(tool_results(), [])
        self.assertEqual(rca.confidence, ConfidenceLevel.HIGH)
        self.assertEqual(rca.process, "Furnace")
        self.assertEqual(rca.target_selection, "MENTIONED")


class RootCauseMissingInformationTest(unittest.TestCase):
    def test_missing_production_is_reported(self):
        detail = {**DETAIL, "production": {"quantity": 0, "unit": None, "byUnit": []}, "intensity": {"value": None, "unit": None}}
        rca = build_root_cause(tool_results(hotspot_detail=detail), [])

        self.assertTrue(any("intensity cannot be calculated" in s for s in statements(rca, "missing_information")))
        self.assertFalse(any("intensity is" in s for s in statements(rca, "derived_metrics")))
        self.assertEqual(rca.confidence, ConfidenceLevel.MEDIUM)

    def test_simulated_readings_are_labelled(self):
        rca = build_root_cause(tool_results(hotspot_detail={**DETAIL, "simulatedEmission": 12.4}), [])

        self.assertIn("12.4 tCO2e of Furnace emissions come from simulated readings.", statements(rca, "factory_data"))
        self.assertTrue(any("simulated readings, not physical measurements" in s for s in statements(rca, "missing_information")))
        self.assertEqual(rca.confidence, ConfidenceLevel.MEDIUM)

    def test_backend_warnings_are_passed_through_once(self):
        warning = {"code": "MISSING_EMISSIONS", "message": "3 activities have no stored emission and are excluded."}
        rca = build_root_cause(
            tool_results(hotspot_detail={**DETAIL, "warnings": [warning]}, hotspot_ranking={**RANKING, "warnings": [warning]}),
            [],
        )
        warnings = [s for s in statements(rca, "missing_information") if "MISSING_EMISSIONS" in s]
        self.assertEqual(len(warnings), 1)
        self.assertEqual(rca.confidence, ConfidenceLevel.MEDIUM)

    def test_detail_failure_falls_back_to_ranking(self):
        results = tool_results()
        del results["hotspot_detail"]
        rca = build_root_cause(results, [{"tool": "get_hotspot_detail", "error": "timeout"}])

        self.assertIn("Furnace has recorded 520 tCO2e of emissions across 24 activities.", statements(rca, "factory_data"))
        self.assertTrue(any("47.27%" in s for s in statements(rca, "derived_metrics")))
        self.assertEqual(rca.hypotheses, [])
        self.assertTrue(any("get_hotspot_detail tool could not be reached" in s for s in statements(rca, "missing_information")))
        self.assertEqual(rca.confidence, ConfidenceLevel.LOW)

    def test_no_emissions_means_no_hotspot(self):
        results = tool_results(hotspot_ranking={**RANKING, "totalEmission": 0, "hotspots": []})
        del results["hotspot_detail"], results["hotspot_target"]
        rca = build_root_cause(results, [])

        self.assertIsNone(rca.process)
        self.assertTrue(any("no hotspot to analyse" in s for s in statements(rca, "missing_information")))
        self.assertEqual(rca.confidence, ConfidenceLevel.UNAVAILABLE)

    def test_all_tools_failed(self):
        errors = [{"tool": "get_emissions_summary", "error": "down"}, {"tool": "get_hotspot_ranking", "error": "down"}]
        rca = build_root_cause({}, errors)

        self.assertEqual(rca.factory_data, [])
        self.assertEqual(rca.derived_metrics, [])
        self.assertEqual(rca.confidence, ConfidenceLevel.UNAVAILABLE)
        self.assertEqual(len(statements(rca, "missing_information")), 3)


class FakeLLM:
    def __init__(self):
        self.calls = []

    def with_structured_output(self, schema):
        raise AssertionError("rules should classify these messages")

    def invoke(self, messages):
        self.calls.append(messages)
        return AIMessage(content="Grounded explanation.")


class HotspotGraphTest(unittest.IsolatedAsyncioTestCase):
    async def run_graph(self, message, ranking=RANKING, detail=DETAIL):
        from app.agents.graph import ecotrace_graph

        llm = FakeLLM()
        self.detail_mock = AsyncMock(return_value=copy.deepcopy(detail))
        steps, final = [], None
        with patch.object(nodes, "get_llm", return_value=llm), \
                patch("app.mcp.tools.factory_profile.get_factory_profile", AsyncMock(return_value=copy.deepcopy(PROFILE))), \
                patch.object(hotspot_workflow, "get_emissions_summary", AsyncMock(return_value=copy.deepcopy(SUMMARY))), \
                patch.object(hotspot_workflow, "get_hotspot_ranking", AsyncMock(return_value=copy.deepcopy(ranking))), \
                patch.object(hotspot_workflow, "get_hotspot_detail", self.detail_mock):
            async for mode, chunk in ecotrace_graph.astream(
                {"messages": [HumanMessage(content=message)], "factory_id": 1, "tool_results": {}},
                stream_mode=["updates", "values"],
            ):
                if mode == "updates":
                    steps.extend(chunk)
                else:
                    final = chunk
        return steps, final, llm

    async def test_hotspot_question_runs_full_workflow(self):
        steps, final, _ = await self.run_graph("Why is my furnace a hotspot?")

        self.assertEqual(
            steps,
            ["intent_router", "load_factory_data", "calculate_emissions", "identify_hotspots", "root_cause_analysis", "generate_response"],
        )
        self.assertEqual(
            final["tools_used"],
            ["get_factory_profile", "get_emissions_summary", "get_hotspot_ranking", "get_hotspot_detail"],
        )
        self.detail_mock.assert_awaited_once_with(1, 7)

    async def test_mentioned_process_is_analysed(self):
        _, final, _ = await self.run_graph("Why is the boiler a hotspot?")
        self.detail_mock.assert_awaited_once_with(1, 9)
        self.assertEqual(final["root_cause"]["target_selection"], "MENTIONED")

    async def test_response_is_grounded_in_root_cause(self):
        _, final, llm = await self.run_graph("Why is my furnace a hotspot?")

        system_prompt = llm.calls[-1][0].content
        self.assertIn(json.dumps(final["root_cause"], indent=2), system_prompt)
        self.assertIn("Quote numbers exactly as written", system_prompt)
        self.assertIn('"Actual factory data", "Derived metrics", "Hypotheses", "Missing information"', system_prompt)
        self.assertIn("Never state or imply the condition of any equipment", system_prompt)
        # Raw tool payloads are not handed to the LLM — only the grounded evidence.
        self.assertNotIn('"history"', system_prompt)

        self.assertEqual(final["final_answer"], "Grounded explanation.")
        self.assertEqual(final["confidence"], "HIGH")
        self.assertEqual(final["assumptions"], [item["statement"] for item in final["root_cause"]["missing_information"]])

    async def test_tool_failure_does_not_crash_the_workflow(self):
        from app.agents.graph import ecotrace_graph

        llm = FakeLLM()
        with patch.object(nodes, "get_llm", return_value=llm), \
                patch("app.mcp.tools.factory_profile.get_factory_profile", AsyncMock(return_value=PROFILE)), \
                patch.object(hotspot_workflow, "get_emissions_summary", AsyncMock(return_value=SUMMARY)), \
                patch.object(hotspot_workflow, "get_hotspot_ranking", AsyncMock(side_effect=RuntimeError("backend down"))), \
                patch.object(hotspot_workflow, "get_hotspot_detail", AsyncMock()) as detail:
            final = await ecotrace_graph.ainvoke(
                {"messages": [HumanMessage(content="Why is my furnace a hotspot?")], "factory_id": 1, "tool_results": {}}
            )

        detail.assert_not_awaited()
        self.assertEqual(final["tool_errors"], [{"tool": "get_hotspot_ranking", "error": "backend down"}])
        self.assertEqual(final["confidence"], "UNAVAILABLE")

    async def test_other_intents_skip_hotspot_workflow(self):
        steps, final, _ = await self.run_graph("What should I fix first?")

        self.assertEqual(steps, ["intent_router", "load_factory_data", "generate_response"])
        self.assertIsNone(final.get("root_cause"))
        self.assertEqual(final["tools_used"], ["get_factory_profile"])


if __name__ == "__main__":
    unittest.main()
