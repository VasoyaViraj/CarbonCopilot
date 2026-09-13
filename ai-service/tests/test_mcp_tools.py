"""Contract checks: MCP tools against the Express responses they wrap.

Run from ai-service/: python -m unittest discover -s tests -t .
"""

import copy
import unittest
from unittest.mock import AsyncMock, patch

from app.mcp.tools import circular, factory_profile
from app.mcp.tools.hotspots import HotspotItem
from tests.test_hotspot_workflow import RANKING

# GET /api/factories/:id and GET /api/factories/:id/processes (docs/API_CONTRACT.md §3, §4).
FACTORY_JSON = {
    "id": 1,
    "organization_id": 1,
    "name": "ABC Metal Manufacturing",
    "industry_type": "Metal Components",
    "location": "Pune",
    "production_capacity": 10000,
    "production_unit": "tonnes",
    "created_at": "2026-09-12T10:00:00.000Z",
    "updated_at": "2026-09-12T10:00:00.000Z",
}
PROCESSES_JSON = [
    {"id": 7, "factory_id": 1, "name": "Furnace", "process_type": "THERMAL", "description": None},
    {"id": 9, "factory_id": 1, "name": "Boiler", "process_type": None, "description": None},
]

# Query keys GET /api/circular/alternatives accepts (backend alternativesQuerySchema, strict).
CIRCULAR_QUERY_KEYS = {"category", "material", "waste", "energy"}


def backend(responses):
    """Stand-in for backend_get that answers by path."""
    return AsyncMock(side_effect=lambda path, params=None: copy.deepcopy(responses[path]))


class FactoryProfileToolTest(unittest.IsolatedAsyncioTestCase):
    async def test_counts_processes_from_the_processes_endpoint(self):
        get = backend({"/factories/1": FACTORY_JSON, "/factories/1/processes": PROCESSES_JSON})
        with patch.object(factory_profile, "backend_get", get):
            profile = await factory_profile.get_factory_profile(1)

        self.assertEqual(profile["process_count"], 2)
        self.assertEqual([p["name"] for p in profile["processes"]], ["Furnace", "Boiler"])
        self.assertEqual(profile["industry_type"], "Metal Components")

    async def test_reports_zero_processes_for_an_empty_factory(self):
        get = backend({"/factories/1": FACTORY_JSON, "/factories/1/processes": []})
        with patch.object(factory_profile, "backend_get", get):
            profile = await factory_profile.get_factory_profile(1)

        self.assertEqual(profile["process_count"], 0)


class CircularAlternativesToolTest(unittest.IsolatedAsyncioTestCase):
    async def test_sends_only_filters_the_backend_accepts(self):
        get = AsyncMock(return_value={"alternatives": [{"id": 1, "alternative_option": "recycled_aluminum"}]})
        with patch.object(circular, "backend_get", get):
            alternatives = await circular.find_circular_alternatives(
                1, category="material", material="virgin_aluminum", waste="aluminum_scrap", energy="NATURAL_GAS"
            )

        path, = get.await_args.args
        self.assertEqual(path, "/circular/alternatives")
        self.assertLessEqual(set(get.await_args.kwargs["params"]), CIRCULAR_QUERY_KEYS)
        self.assertEqual(get.await_args.kwargs["params"]["category"], "material")
        self.assertEqual(alternatives[0]["alternative_option"], "recycled_aluminum")


class HotspotItemTest(unittest.TestCase):
    def test_parses_a_backend_ranking_entry(self):
        item = HotspotItem.model_validate(RANKING["hotspots"][0])
        self.assertEqual((item.rank, item.process_id, item.process), (1, 7, "Furnace"))
        self.assertEqual((item.emission, item.severity, item.activity_count), (520, "CRITICAL", 24))


if __name__ == "__main__":
    unittest.main()
