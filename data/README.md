# Data

Demo datasets and templates for EcoTrace AI. All data here is **fictional / demo data** and must be labelled as such wherever it is shown.

Contents:
- `templates/activities-template.csv` — CSV upload template (the required columns `date, process, energy, fuel, material, production, waste` plus optional type/unit columns). It is identical to `GET /api/activities/template`, and a backend test keeps the two in sync.

- `demo/abc-metal-manufacturing.csv` is the ABC Metal Manufacturing demo dataset: one row per process per month for Oct 2025 – Sep 2026. Monthly values vary seasonally, and the annual totals match the demo scenario:

  | Input | Annual total | Split |
  |---|---|---|
  | Electricity | 850,000 kWh | Furnace 250,000; Electricity 600,000 |
  | Natural gas | 300,000 m3 | Furnace 210,000; Boiler 90,000 |
  | Diesel | 40,000 L | Transport |
  | Virgin aluminium | 2,000 tonnes | Furnace |
  | Waste to landfill | 350 tonnes | Waste |
  | Production | 10,000 tonnes | Recorded on the Furnace row |

  Figures are rounded per row, so annual totals can differ by a few units.

  To load it, run `npm run db:seed` in `backend/`, then upload the file in Data Input → CSV Upload for the demo factory. Re-uploading is safe: rows that are already stored are rejected as duplicates.

Displayed values must always be calculated by the application from ingested activities and emission factors — never hardcoded from these files.
