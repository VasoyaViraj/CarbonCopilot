"""Run from ai-service/: python -m unittest discover -s tests -t ."""

import unittest
from unittest.mock import patch, MagicMock

from app.agents.scenario_workflow import (
    ParsedInterventions,
    _extract_parameters,
    build_scenario_evidence,
    ScenarioEvidence,
)
from app.schemas.ai_response import ConfidenceLevel

class ParseInterventionsTest(unittest.TestCase):
    @patch("app.agents.scenario_workflow.get_llm")
    def test_extract_parameters_success(self, mock_get_llm):
        mock_llm = MagicMock()
        mock_response = MagicMock()
        mock_response.content = '{"recycled_material_percent": 30, "energy_efficiency_percent": 15}'
        mock_llm.invoke.return_value = mock_response
        mock_get_llm.return_value = mock_llm

        parsed = _extract_parameters("What if I use 30% recycled material and 15% efficiency?")

        self.assertEqual(parsed.recycled_material_percent, 30.0)
        self.assertEqual(parsed.energy_efficiency_percent, 15.0)
        self.assertFalse(parsed.needs_clarification)

    @patch("app.agents.scenario_workflow.get_llm")
    def test_extract_parameters_clarification_needed(self, mock_get_llm):
        mock_llm = MagicMock()
        mock_response = MagicMock()
        mock_response.content = '{"needs_clarification": true, "clarification_question": "What percentage?"}'
        mock_llm.invoke.return_value = mock_response
        mock_get_llm.return_value = mock_llm

        parsed = _extract_parameters("What if I use more recycled material?")

        self.assertTrue(parsed.needs_clarification)
        self.assertEqual(parsed.clarification_question, "What percentage?")

    def test_has_any_parameter(self):
        parsed = ParsedInterventions(recycled_material_percent=30.0)
        self.assertTrue(parsed.has_any_parameter())

        parsed_empty = ParsedInterventions()
        self.assertFalse(parsed_empty.has_any_parameter())

class BuildScenarioEvidenceTest(unittest.TestCase):
    def test_build_scenario_evidence_success(self):
        tool_results = {
            "scenario_params": {
                "recycled_material_percent": 30.0,
            },
            "scenario_result": {
                "baselineEmission": 1100,
                "projectedEmission": 950,
                "reductionAmount": 150,
                "reductionPercent": 13.6,
                "estimatedCost": 50000,
                "estimatedSavings": 12000,
                "paybackPeriod": "4.2",
                "co2eUnit": "tCO2e",
            },
        }

        evidence = build_scenario_evidence(tool_results, [])

        self.assertEqual(evidence.recycled_material_percent, 30.0)
        self.assertEqual(evidence.baseline_emission, 1100)
        self.assertEqual(evidence.projected_emission, 950)
        self.assertEqual(evidence.confidence, ConfidenceLevel.HIGH)

    def test_build_scenario_evidence_clarification_needed(self):
        tool_results = {
            "scenario_needs_clarification": True,
            "clarification_question": "What percentage?",
        }

        evidence = build_scenario_evidence(tool_results, [])

        self.assertTrue(evidence.needs_clarification)
        self.assertEqual(evidence.clarification_question, "What percentage?")
        self.assertEqual(evidence.confidence, ConfidenceLevel.UNAVAILABLE)

    def test_build_scenario_evidence_missing_baseline(self):
        tool_results = {
            "scenario_result": {
                "baselineEmission": 0,
            },
        }

        evidence = build_scenario_evidence(tool_results, [])

        self.assertEqual(evidence.confidence, ConfidenceLevel.MEDIUM)
        self.assertTrue(any("Baseline emission is zero" in info for info in evidence.missing_information))
