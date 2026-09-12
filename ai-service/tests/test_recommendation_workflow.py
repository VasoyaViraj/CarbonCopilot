"""Run from ai-service/: python -m unittest discover -s tests -t ."""

import copy
import json
import re
import unittest
from unittest.mock import AsyncMock, patch

from langchain_core.messages import AIMessage, HumanMessage

from app.agents import nodes, recommendation_workflow
from app.agents.recommendation_workflow import build_recommendation_evidence, calculate_impact, rank_interventions_node
from app.schemas.ai_response import ConfidenceLevel
from tests.test_action_plan import RECOMMENDATIONS
from tests.test_hotspot_workflow import PROFILE, RANKING

# A number not embedded in a word (the "2" in "tCO2e" is not a number).
NUMBER = re.compile(r"(?<![\w.])\d+(?:\.\d+)?(?!\w)")


def numbers(value):
    return {float(n) for n in NUMBER.findall(json.dumps(value))}


def run_steps(**tool_results):
    """Run calculate_impact → rank_interventions on the given tool results."""
    state = {"messages": [], "factory_id": 1, "intent": "RECOMMENDATION", "tool_results": copy.deepcopy(tool_results)}
    state["tool_results"] = calculate_impact(state)["tool_results"]
    return rank_interventions_node(state)["tool_results"]


class ImpactFromBackendTest(unittest.TestCase):
    def test_copies_backend_values_without_arithmetic(self):
        first = run_steps(recommendations=RECOMMENDATIONS)["ranked_interventions"][0]

        self.assertEqual(first["name"], "Waste heat recovery")
        self.assertEqual(first["target"], "Furnace")
        self.assertEqual(first["score"], 88.5)
        self.assertEqual(first["estimated_reduction_percent"], 9.45)
        self.assertEqual(first["targeted_reduction_percent"], 20)
        self.assertEqual((first["estimated_savings"], first["savings_unit"]), (104, "tCO2e/yr"))
        self.assertEqual((first["cost_level"], first["payback_years"]), ("MEDIUM", 2.4))

    def test_every_number_is_a_backend_value(self):
        ranked = run_steps(recommendations=RECOMMENDATIONS, hotspot_ranking=RANKING)["ranked_interventions"]
        self.assertTrue(numbers(ranked) <= numbers(RECOMMENDATIONS))

    def test_impact_is_never_projected_onto_the_top_hotspot(self):
        # The old heuristic multiplied every reduction % by the top hotspot's emissions.
        ranked = run_steps(recommendations=RECOMMENDATIONS, hotspot_ranking=RANKING)["ranked_interventions"]
        self.assertFalse(any("estimated_reduction_absolute" in item for item in ranked))
        led = next(item for item in ranked if item["name"] == "LED lighting")
        self.assertEqual(led["target"], "Factory-wide")
        self.assertEqual(led["estimated_savings"], 12)

    def test_rejected_and_implemented_recommendations_are_left_out(self):
        recs = copy.deepcopy(RECOMMENDATIONS)
        recs["recommendations"][1]["status"] = "IMPLEMENTED"
        names = [item["name"] for item in run_steps(recommendations=recs)["ranked_interventions"]]
        self.assertEqual(names, ["Waste heat recovery", "Recycled aluminum"])

    def test_keeps_the_backend_rank_order(self):
        recs = copy.deepcopy(RECOMMENDATIONS)
        recs["recommendations"].reverse()
        ranks = [item["rank"] for item in run_steps(recommendations=recs)["ranked_interventions"]]
        self.assertEqual(ranks, [1, 2, 3])

    def test_missing_payload_gives_no_interventions(self):
        self.assertEqual(run_steps(recommendations=None)["ranked_interventions"], [])


class RecommendationEvidenceTest(unittest.TestCase):
    def evidence(self, recommendations=RECOMMENDATIONS, hotspot_ranking=RANKING, errors=()):
        results = run_steps(recommendations=recommendations, hotspot_ranking=hotspot_ranking)
        return build_recommendation_evidence(results, list(errors))

    def test_full_data(self):
        evidence = self.evidence()

        self.assertEqual((evidence.top_hotspot_process, evidence.top_hotspot_emission), ("Furnace", 520))
        self.assertEqual([i["name"] for i in evidence.interventions], ["Waste heat recovery", "LED lighting", "Recycled aluminum"])
        self.assertEqual(evidence.generated_at, RECOMMENDATIONS["generatedAt"])
        self.assertIn(RECOMMENDATIONS["assumptions"][0], evidence.assumptions)
        self.assertIn("Payback is not available because the knowledge base has no cost estimate.", evidence.assumptions)
        # Recycled aluminum has no payback, so the answer cannot be fully complete.
        self.assertTrue(any("shown as N/A" in item for item in evidence.missing_information))
        self.assertEqual(evidence.confidence, ConfidenceLevel.MEDIUM)

    def test_evidence_numbers_are_tool_values(self):
        evidence = self.evidence()
        self.assertTrue(numbers(evidence.model_dump(mode="json")) <= numbers(RECOMMENDATIONS) | numbers(RANKING))

    def test_complete_data_is_high_confidence(self):
        recs = copy.deepcopy(RECOMMENDATIONS)
        recs["recommendations"] = recs["recommendations"][:2]
        evidence = self.evidence(recommendations=recs)
        self.assertEqual(evidence.missing_information, [])
        self.assertEqual(evidence.confidence, ConfidenceLevel.HIGH)

    def test_no_recommendations_yet(self):
        evidence = self.evidence(recommendations={"recommendations": [], "assumptions": []})
        self.assertEqual(evidence.interventions, [])
        self.assertTrue(any("No open recommendations" in item for item in evidence.missing_information))
        self.assertEqual(evidence.confidence, ConfidenceLevel.UNAVAILABLE)

    def test_tool_failure_is_reported_not_guessed(self):
        evidence = self.evidence(recommendations=None, errors=[{"tool": "get_recommendations", "error": "timeout"}])
        self.assertEqual(evidence.interventions, [])
        self.assertIn("The get_recommendations tool could not be reached, so its data is not included.", evidence.missing_information)
        self.assertFalse(any("No open recommendations" in item for item in evidence.missing_information))
        self.assertEqual(evidence.confidence, ConfidenceLevel.UNAVAILABLE)

    def test_partial_failure_lowers_confidence(self):
        evidence = self.evidence(hotspot_ranking=None, errors=[{"tool": "get_hotspot_ranking", "error": "timeout"}])
        self.assertEqual(len(evidence.interventions), 3)
        self.assertIsNone(evidence.top_hotspot_process)
        self.assertEqual(evidence.confidence, ConfidenceLevel.LOW)


class FakeLLM:
    def __init__(self):
        self.calls = []

    def with_structured_output(self, schema):
        raise AssertionError("rules should classify these messages")

    def invoke(self, messages):
        self.calls.append(messages)
        return AIMessage(content="Grounded explanation.")


class RecommendationGraphTest(unittest.IsolatedAsyncioTestCase):
    async def run_graph(self, message):
        from app.agents.graph import ecotrace_graph

        llm = FakeLLM()
        steps, final = [], None
        with patch.object(nodes, "get_llm", return_value=llm), \
                patch("app.mcp.tools.factory_profile.get_factory_profile", AsyncMock(return_value=copy.deepcopy(PROFILE))), \
                patch.object(recommendation_workflow, "get_hotspot_ranking", AsyncMock(return_value=copy.deepcopy(RANKING))), \
                patch.object(recommendation_workflow, "get_recommendations", AsyncMock(return_value=copy.deepcopy(RECOMMENDATIONS))):
            async for mode, chunk in ecotrace_graph.astream(
                {"messages": [HumanMessage(content=message)], "factory_id": 1, "tool_results": {}},
                stream_mode=["updates", "values"],
            ):
                if mode == "updates":
                    steps.extend(chunk)
                else:
                    final = chunk
        return steps, final, llm

    async def test_workflow_sequence_and_tools(self):
        steps, final, _ = await self.run_graph("What should I fix first?")

        self.assertEqual(steps, [
            "intent_router", "load_factory_data", "recommendation_fetch_hotspots", "recommendation_fetch_alternatives",
            "recommendation_calculate_impact", "recommendation_rank_interventions", "generate_response",
        ])
        self.assertEqual(final["tools_used"], ["get_factory_profile", "get_hotspot_ranking", "get_recommendations"])
        self.assertEqual(final["confidence"], "MEDIUM")

    async def test_llm_explains_only_the_deterministic_ranking(self):
        _, _, llm = await self.run_graph("What should I fix first?")

        system_prompt = llm.calls[-1][0].content
        self.assertIn("matched and scored by the deterministic recommendation service", system_prompt)
        self.assertIn('"estimated_savings": 104', system_prompt)
        self.assertNotIn("Biogas boiler", system_prompt)
        self.assertNotIn("estimated_reduction_absolute", system_prompt)

    async def test_roi_question_uses_the_same_workflow(self):
        steps, _, _ = await self.run_graph("Which intervention has the best ROI?")
        self.assertIn("recommendation_rank_interventions", steps)


if __name__ == "__main__":
    unittest.main()
