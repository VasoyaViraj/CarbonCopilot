"""Run from ai-service/: python -m unittest discover -s tests -t ."""

import unittest
from typing import Any, Dict

from app.agents.recommendation_workflow import (
    RecommendationEvidence,
    build_recommendation_evidence,
    calculate_impact,
)
from app.schemas.ai_response import ConfidenceLevel

# Mock tool results for recommendations
HOTSPOT_RANKING = {
    "factory": {"id": 1, "name": "ABC Metal Manufacturing"},
    "co2eUnit": "tCO2e",
    "totalEmission": 1100,
    "hotspots": [
        {
            "rank": 1,
            "processId": 7,
            "process": "Furnace",
            "emission": 520,
            "percentage": 47.27,
            "severity": "CRITICAL",
        }
    ],
}

CIRCULAR_ALTERNATIVES = [
    {
        "id": 101,
        "alternative_option": "Electric Arc Furnace",
        "current_option": "Gas Furnace",
        "category": "FUEL",
        "reduction_percent": 80.0,
        "circularity_score": 92.5,
        "cost_level": "HIGH",
        "estimated_payback_years": 5.5,
        "description": "Switch to EAF powered by renewables.",
    },
    {
        "id": 102,
        "alternative_option": "Waste Heat Recovery",
        "current_option": "None",
        "category": "ENERGY",
        "reduction_percent": 15.0,
        "circularity_score": 60.0,
        "cost_level": "MEDIUM",
        "estimated_payback_years": 2.0,
        "description": "Install heat exchanger.",
    },
]

class CalculateImpactTest(unittest.TestCase):
    def test_calculate_impact_calculates_absolute_reduction(self):
        state = {
            "messages": [],
            "factory_id": 1,
            "intent": "RECOMMENDATION",
            "tool_results": {
                "hotspot_ranking": HOTSPOT_RANKING,
                "circular_alternatives": CIRCULAR_ALTERNATIVES,
            },
            "tools_used": [],
            "tool_errors": [],
            "assumptions": [],
            "confidence": "UNAVAILABLE",
        }

        result = calculate_impact(state)
        enriched = result["tool_results"]["enriched_alternatives"]

        self.assertEqual(len(enriched), 2)
        # Top hotspot is Furnace with 520 emission. 80% reduction = 416.0
        self.assertEqual(enriched[0]["estimated_reduction_absolute"], 416.0)
        self.assertEqual(enriched[0]["estimated_reduction_unit"], "tCO2e")
        self.assertEqual(enriched[0]["target_process"], "Furnace")
        self.assertEqual(enriched[0]["score"], 92.5)

        # 15% reduction of 520 = 78.0
        self.assertEqual(enriched[1]["estimated_reduction_absolute"], 78.0)

class BuildRecommendationEvidenceTest(unittest.TestCase):
    def test_build_recommendation_evidence_with_full_data(self):
        tool_results = {
            "hotspot_ranking": HOTSPOT_RANKING,
            "impact_summary": {
                "total_factory_emission": 1100,
                "co2e_unit": "tCO2e",
                "alternative_count": 2,
            },
            "ranked_interventions": [
                {
                    "rank": 1,
                    "alternative_option": "Electric Arc Furnace",
                    "current_option": "Gas Furnace",
                    "category": "FUEL",
                    "reduction_percent": 80.0,
                    "estimated_reduction_absolute": 416.0,
                    "circularity_score": 92.5,
                    "cost_level": "HIGH",
                    "estimated_payback_years": 5.5,
                    "target_process": "Furnace",
                }
            ],
        }

        evidence = build_recommendation_evidence(tool_results, [])

        self.assertEqual(evidence.top_hotspot_process, "Furnace")
        self.assertEqual(evidence.top_hotspot_emission, 520)
        self.assertEqual(len(evidence.interventions), 1)
        self.assertEqual(evidence.interventions[0]["estimated_reduction_absolute"], 416.0)
        self.assertEqual(evidence.confidence, ConfidenceLevel.HIGH)

    def test_build_recommendation_evidence_with_missing_hotspots(self):
        tool_results = {
            "hotspot_ranking": {},
            "impact_summary": {},
            "ranked_interventions": CIRCULAR_ALTERNATIVES,
        }

        evidence = build_recommendation_evidence(tool_results, [])

        self.assertIsNone(evidence.top_hotspot_process)
        self.assertTrue(any("No hotspot data is available" in info for info in evidence.missing_information))
        # Confidence is medium because estimated_reduction_absolute is missing
        self.assertEqual(evidence.confidence, ConfidenceLevel.MEDIUM)

    def test_build_recommendation_evidence_with_tool_errors(self):
        tool_results = {
            "hotspot_ranking": HOTSPOT_RANKING,
            "impact_summary": {},
            "ranked_interventions": CIRCULAR_ALTERNATIVES,
        }
        tool_errors = [{"tool": "find_circular_alternatives", "error": "Connection failed"}]

        evidence = build_recommendation_evidence(tool_results, tool_errors)
        self.assertEqual(evidence.confidence, ConfidenceLevel.LOW)
        self.assertTrue(any("find_circular_alternatives" in info for info in evidence.missing_information))
