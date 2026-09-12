"""Run from ai-service/: python -m unittest discover -s tests -t ."""

import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app import main
from app.mcp import server
from app.mcp.tools import scenario as scenario_tool
from app.schemas.ai_response import ConfidenceLevel, CopilotRequest, CopilotResponse, ToolUsed
from app.services import copilot

TOKEN = "test-only-ai-service-token"
HEADERS = {"X-AI-Service-Token": TOKEN, "X-Acting-User-Id": "5"}
BODY = {"factoryId": 1, "message": "Generate an action plan."}


class CopilotEndpointTest(unittest.TestCase):
    def setUp(self):
        patcher = patch.object(main.settings, "ai_service_token", TOKEN)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.client = TestClient(main.app)

    def test_rejects_missing_or_wrong_service_token(self):
        for headers in ({"X-Acting-User-Id": "5"}, {**HEADERS, "X-AI-Service-Token": "wrong-token"}):
            with self.subTest(headers=headers):
                self.assertEqual(self.client.post("/copilot", json=BODY, headers=headers).status_code, 401)

    def test_rejects_everything_when_no_token_is_configured(self):
        with patch.object(main.settings, "ai_service_token", ""):
            res = self.client.post("/copilot", json=BODY, headers={**HEADERS, "X-AI-Service-Token": ""})
        self.assertEqual(res.status_code, 401)

    def test_requires_an_acting_user(self):
        res = self.client.post("/copilot", json=BODY, headers={"X-AI-Service-Token": TOKEN})
        self.assertEqual(res.status_code, 400)

    def test_answers_as_the_acting_user(self):
        answer = CopilotResponse(
            answer="ok", tools_used=[ToolUsed(name="get_hotspot_ranking")], intent="ACTION_PLAN",
            action_plan={"immediate_investigation": []}, confidence=ConfidenceLevel.HIGH,
        )
        with patch.object(main, "run_copilot", AsyncMock(return_value=answer)) as run:
            res = self.client.post("/copilot", json=BODY, headers=HEADERS)

        self.assertEqual(res.status_code, 200)
        request, user_id = run.await_args.args
        self.assertEqual((request.factory_id, request.message, user_id), (1, "Generate an action plan.", 5))
        self.assertEqual(res.json()["toolsUsed"][0]["name"], "get_hotspot_ranking")
        self.assertEqual(res.json()["actionPlan"], {"immediate_investigation": []})
        self.assertEqual(res.json()["confidence"], "HIGH")

    def test_failures_return_503_without_internals(self):
        with patch.object(main, "run_copilot", AsyncMock(side_effect=RuntimeError("secret stack detail"))):
            res = self.client.post("/copilot", json=BODY, headers=HEADERS)
        self.assertEqual(res.status_code, 503)
        self.assertNotIn("secret stack detail", res.text)


class ActingUserScopeTest(unittest.IsolatedAsyncioTestCase):
    def test_backend_headers_carry_the_acting_user_only_inside_a_request(self):
        self.assertNotIn("X-Acting-User-Id", server._request_headers())
        token = server.set_acting_user(7)
        try:
            self.assertEqual(server._request_headers()["X-Acting-User-Id"], "7")
        finally:
            server.reset_acting_user(token)
        self.assertNotIn("X-Acting-User-Id", server._request_headers())

    async def test_graph_backend_calls_are_scoped_to_the_acting_user(self):
        seen = {}

        async def fake_ainvoke(state):
            seen["headers"] = server._request_headers()
            seen["state"] = state
            return {"final_answer": "ok", "intent": "GENERAL_CARBON_QUESTION", "tools_used": [], "confidence": "LOW"}

        with patch.object(copilot, "ecotrace_graph", SimpleNamespace(ainvoke=fake_ainvoke)):
            response = await copilot.run_copilot(CopilotRequest(factoryId=1, message="What is Scope 2?"), 5)

        self.assertEqual(seen["headers"]["X-Acting-User-Id"], "5")
        self.assertEqual(seen["state"]["factory_id"], 1)
        self.assertNotIn("X-Acting-User-Id", server._request_headers())
        self.assertEqual(response.confidence, ConfidenceLevel.LOW)

    async def test_scenario_tool_calls_the_calculate_endpoint(self):
        with patch.object(scenario_tool, "backend_post", AsyncMock(return_value={})) as post:
            await scenario_tool.calculate_scenario(3, recycled_material_percent=30)

        path, payload = post.await_args.args
        self.assertEqual(path, "/factories/3/scenarios/calculate")
        self.assertEqual(payload, {
            "recycledMaterialPercent": 30.0,
            "energyEfficiencyPercent": 0.0,
            "fuelReplacementPercent": 0.0,
            "wasteRecoveryPercent": 0.0,
        })


class BuildCopilotResponseTest(unittest.TestCase):
    def test_action_plan_answers_carry_the_structured_plan(self):
        plan = {"immediate_investigation": [{"title": "Investigate Furnace"}]}
        response = copilot.build_copilot_response({
            "intent": "ACTION_PLAN",
            "final_answer": "## Sustainability action plan",
            "tools_used": ["get_factory_profile", "get_hotspot_ranking", "get_factory_profile"],
            "tool_results": {"action_plan": plan},
            "assumptions": ["Estimates only."],
            "confidence": "MEDIUM",
        })
        self.assertEqual(response.action_plan, plan)
        self.assertEqual([t.name for t in response.tools_used], ["get_factory_profile", "get_hotspot_ranking"])
        self.assertEqual(response.confidence, ConfidenceLevel.MEDIUM)

    def test_scenario_answers_carry_the_engine_result(self):
        response = copilot.build_copilot_response({
            "intent": "SCENARIO",
            "tool_results": {
                "scenario_params": {"recycled_material_percent": 30.0},
                "scenario_result": {
                    "baselineEmission": 1100, "projectedEmission": 980, "reductionAmount": 120, "reductionPercent": 10.91,
                    "estimatedCost": 150000, "estimatedSavings": 6000, "paybackPeriod": 25, "unit": "tCO2e",
                },
            },
            "confidence": "HIGH",
        })
        self.assertEqual(response.scenario.projected_emission, 980)
        self.assertEqual(response.scenario.payback_period, "25")
        self.assertEqual(response.scenario.unit, "tCO2e")
        self.assertIsNone(response.action_plan)

    def test_recommendation_answers_carry_the_ranking(self):
        response = copilot.build_copilot_response({
            "intent": "RECOMMENDATION",
            "tool_results": {"ranked_interventions": [
                {"rank": 1, "alternative_option": "Waste heat recovery", "reduction_percent": 12, "cost_level": "MEDIUM",
                 "estimated_payback_years": 2.4, "score": 91},
            ]},
            "confidence": "HIGH",
        })
        self.assertEqual(response.recommendations[0].name, "Waste heat recovery")
        self.assertEqual(response.recommendations[0].payback_years, 2.4)

    def test_unknown_confidence_is_unavailable(self):
        self.assertEqual(copilot.build_copilot_response({"confidence": None}).confidence, ConfidenceLevel.UNAVAILABLE)


if __name__ == "__main__":
    unittest.main()
