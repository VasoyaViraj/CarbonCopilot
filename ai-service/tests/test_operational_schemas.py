"""Run from ai-service/: python -m unittest discover -s tests -t ."""

import unittest

from pydantic import ValidationError

from app.schemas import Activity, ActivityPage, ActivitySource, CalculateEmissionsInput, EmissionCalculation

# Shape returned by GET /api/factories/:id/activities (docs/API_CONTRACT.md §5).
ACTIVITY_JSON = {
    "id": 101,
    "processId": 7,
    "processName": "Furnace",
    "activityDate": "2026-09-12T00:00:00.000Z",
    "energyType": "NATURAL_GAS",
    "category": "FUEL",
    "quantity": 300,
    "unit": "m3",
    "productionQuantity": 8,
    "productionUnit": "tonnes",
    "source": "MANUAL",
    "isSimulated": False,
    "createdAt": "2026-09-12T10:00:00.000Z",
    "emission": {
        "id": 70,
        "co2eValue": 570,
        "co2eUnit": "kgCO2e",
        "emissionFactorId": 5,
        "calculationMethod": "CO2e = activity quantity × emission factor",
        "calculatedAt": "2026-09-12T10:00:00.000Z",
    },
}


class OperationalSchemaTest(unittest.TestCase):
    def test_parses_backend_activity_json(self):
        activity = Activity.model_validate(ACTIVITY_JSON)
        self.assertEqual(activity.energy_type, "NATURAL_GAS")
        self.assertEqual(activity.source, ActivitySource.MANUAL)
        self.assertEqual(activity.emission.co2e_value, 570)

    def test_parses_a_page_of_activities(self):
        page = ActivityPage.model_validate({"items": [ACTIVITY_JSON], "total": 1, "limit": 50, "offset": 0})
        self.assertEqual(len(page.items), 1)

    def test_rejects_a_simulated_flag_that_contradicts_the_source(self):
        with self.assertRaises(ValidationError):
            Activity.model_validate({**ACTIVITY_JSON, "source": "SIMULATION", "isSimulated": False})

    def test_rejects_non_positive_quantities(self):
        with self.assertRaises(ValidationError):
            Activity.model_validate({**ACTIVITY_JSON, "quantity": 0})

    def test_parses_a_carbon_engine_result(self):
        result = EmissionCalculation.model_validate(
            {
                "activityType": "NATURAL_GAS",
                "quantity": 300,
                "unit": "m3",
                "emissionFactorId": 5,
                "factor": 1.9,
                "factorUnit": "kgCO2e/m3",
                "factorSource": {"region": "GLOBAL-DEMO", "year": 2026, "reference": "demo"},
                "co2eValue": 570,
                "co2eUnit": "kgCO2e",
                "calculationMethod": "CO2e = activity quantity × emission factor",
            }
        )
        self.assertEqual(result.co2e_value, 570)

    def test_validates_calculate_emissions_tool_input(self):
        self.assertEqual(CalculateEmissionsInput(activity_type="DIESEL", quantity=40, unit="L").emission_factor_id, None)
        with self.assertRaises(ValidationError):
            CalculateEmissionsInput(activity_type="DIESEL", quantity=-1, unit="L")


if __name__ == "__main__":
    unittest.main()
