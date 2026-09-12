# Data

Demo datasets and templates for EcoTrace AI. All data here is **fictional / demo data** and must be labelled as such wherever it is shown.

Contents:
- `templates/activities-template.csv` — CSV upload template (the required columns `date, process, energy, fuel, material, production, waste` plus optional type/unit columns). It is identical to `GET /api/activities/template`, and a backend test keeps the two in sync. See `docs/API_CONTRACT.md` §5 for the column rules.

Planned contents:
- `demo/abc-metal-manufacturing.csv` — ABC Metal Manufacturing demo dataset (Phase 28).

Displayed values must always be calculated by the application from ingested activities and emission factors — never hardcoded from these files.
