# EcoTrace AI — API Contract

## 1. API Conventions

Base path:

```text
/api
```

JSON request/response format.

Authentication:

```http
Authorization: Bearer <JWT>
```

Standard success/error shape:

```json
{
  "success": true,
  "data": {}
}
```

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": [{ "field": "email", "message": "Invalid email" }]
  }
}
```

`details` is optional (field-level or row-level errors). Stack traces and internal errors are never returned to clients.

### Error Codes

| HTTP | Code | Meaning |
|---:|---|---|
| 400 | `VALIDATION_ERROR` | Request body/params/query failed validation |
| 401 | `UNAUTHENTICATED` | Missing, invalid, or expired token |
| 401 | `INVALID_CREDENTIALS` | Wrong email/password on login |
| 403 | `FORBIDDEN` | Authenticated but role not permitted |
| 404 | `NOT_FOUND` | Resource missing **or** outside the caller's organization (not disclosed) |
| 409 | `CONFLICT` | Duplicate resource (e.g. email already registered) |
| 413 | `PAYLOAD_TOO_LARGE` | Upload exceeds the configured limit |
| 429 | `RATE_LIMITED` | Too many requests from this client. Limits: failed logins, registrations, uploads, and an overall per-IP ceiling. Retry after the `RateLimit` header's reset time |
| 502 | `AI_SERVICE_ERROR` | AI service returned an error |
| 503 | `SERVICE_UNAVAILABLE` | A dependency (e.g. the database) is unavailable |
| 504 | `AI_SERVICE_TIMEOUT` | AI service did not respond in time |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

### Service Ports

| Service | Default |
|---|---|
| Frontend (Vite) | `5173` |
| Backend (Express) | `5000` — base URL `http://localhost:5000/api` |
| AI service (FastAPI) | `8000` — internal only, called by Express |
| PostgreSQL | `5432` |

## 2. Authentication

### Register
```http
POST /api/auth/register
```

Request:
```json
{
  "name": "Operator",
  "email": "operator@example.com",
  "password": "********",
  "role": "FACTORY_OPERATOR",
  "organizationName": "ABC Metal Manufacturing"
}
```

- `role`: `FACTORY_OPERATOR` (default), `CONSULTANT`, or `REGULATOR`. `ADMIN` cannot be self-assigned.
- Registration always creates a **new organization** for the user; clients cannot supply an organization ID.
- Password: 8–72 characters. Unknown fields are rejected.
- `201` with the same body as login; `409 CONFLICT` if the email exists.

### Login
```http
POST /api/auth/login
```

Response:
```json
{
  "success": true,
  "data": {
    "accessToken": "...",
    "user": {
      "id": 1,
      "name": "Operator",
      "email": "operator@example.com",
      "role": "FACTORY_OPERATOR",
      "organizationId": 1
    }
  }
}
```

Wrong email or password both return `401 INVALID_CREDENTIALS`. The token is also set as an `httpOnly` cookie; clients should send it as `Authorization: Bearer <token>`.

### Current User
```http
GET /api/auth/me
```

Returns `{ "success": true, "data": { "user": { ... } } }`. The user is re-loaded from the database on every request, so role changes and deletions apply immediately; missing, tampered, or expired tokens return `401 UNAUTHENTICATED`.

### Logout
```http
POST /api/auth/logout
```

Clears the auth cookie. Clients also discard their stored token.

## 3. Factories

```http
POST   /api/factories
GET    /api/factories
GET    /api/factories/:id
PUT    /api/factories/:id
DELETE /api/factories/:id
```

Create request:
```json
{
  "name": "ABC Metal Manufacturing",
  "industryType": "Metal Components",
  "location": "Demo Location",
  "productionCapacity": 10000,
  "productionUnit": "tonnes/year"
}
```

## 4. Processes

```http
POST /api/factories/:id/processes
GET  /api/factories/:id/processes
```

Request:
```json
{
  "name": "Furnace",
  "processType": "THERMAL",
  "description": "Main heat treatment process"
}
```

## 5. Activities

```http
GET  /api/activities/types
POST /api/processes/:id/activities
GET  /api/processes/:id/activities
GET  /api/factories/:id/activities
POST /api/activities/upload
```

Writing activities requires `ADMIN` or `FACTORY_OPERATOR`; every role in the organization may read them. Processes and factories outside the caller's organization return `404 NOT_FOUND`.

### Supported activity types

`GET /api/activities/types` returns the catalog used by every ingestion path. Each type maps to an emission factor, and units are normalised to the factor's canonical unit (`kwh` → `kWh`, `litres` → `L`). Units are never converted; a unit that isn't a spelling of the canonical unit is rejected.

| Category | Types | Unit |
|---|---|---|
| ENERGY | `ELECTRICITY` | kWh |
| FUEL | `NATURAL_GAS` / `DIESEL` / `LPG` | m3 / L / kg |
| MATERIAL | `VIRGIN_ALUMINUM`, `RECYCLED_ALUMINUM`, `STEEL` | tonne |
| WASTE | `WASTE_LANDFILL`, `WASTE_RECYCLED` | tonne |

Production units: `tonnes` (default when omitted), `kg`, `units`.

### Create (manual or simulated)

```http
POST /api/processes/:id/activities
```

```json
{
  "activityDate": "2026-09-12",
  "energyType": "NATURAL_GAS",
  "quantity": 300,
  "unit": "m3",
  "productionQuantity": 8,
  "productionUnit": "tonnes",
  "source": "MANUAL"
}
```

- `activityDate`: `YYYY-MM-DD` (stored as UTC midnight) or an ISO-8601 timestamp with timezone. It must be a real date, not before 2000-01-01, and not in the future.
- `quantity`: a JSON number greater than 0 and no larger than the type's plausibility ceiling (which catches unit mistakes).
- `unit`: optional. It defaults to the type's canonical unit.
- `productionQuantity`: optional, a number ≥ 0. Record production once per process and period so it isn't double counted.
- `source`: `MANUAL` (default) or `SIMULATION`. `CSV` is rejected here because CSV rows must go through the upload pipeline.

`201` response (the same shape is used by the list endpoints):

```json
{
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
  "isSimulated": false,
  "createdAt": "2026-09-12T10:00:00.000Z",
  "emission": {
    "id": 70,
    "co2eValue": 570,
    "co2eUnit": "kgCO2e",
    "emissionFactorId": 5,
    "calculationMethod": "CO2e = activity quantity × emission factor",
    "calculatedAt": "2026-09-12T10:00:00.000Z"
  }
}
```

`isSimulated` is `true` for every `SIMULATION` activity (BR-12).

The activity and its deterministic emission (§6) are written in one transaction. If no emission factor exists for the type and unit, the request fails with `400 VALIDATION_ERROR` ("No emission factor is configured for …") and nothing is stored. `emission` is the activity's latest calculation, and list responses include it too.

### List

```http
GET /api/processes/:id/activities
GET /api/factories/:id/activities
```

Query: `from`, `to` (inclusive `YYYY-MM-DD`), `source`, `energyType`, `limit` (1–200, default 50), `offset`. The response is `{ "items": [Activity], "total", "limit", "offset" }`, newest first.

### CSV upload

```http
GET  /api/activities/template   → text/csv (header + example rows; also data/templates/activities-template.csv)
POST /api/activities/upload     → multipart/form-data
```

Form fields: `file` (one `.csv` file, UTF-8, up to `MAX_UPLOAD_SIZE_MB`), `factoryId`, `dryRun` (`true`/`false`, default `false`), `skipInvalidRows` (`true`/`false`, default `false`).

Columns (the header is case-insensitive):

| Column | Required | Meaning |
|---|---|---|
| `date` | yes | `YYYY-MM-DD` |
| `process` | yes | Name of an existing process in the factory (case-insensitive) |
| `energy`, `fuel`, `material`, `waste` | header yes, values optional | Quantity for that category. Each filled cell becomes one activity |
| `energy_type`, `fuel_type`, `material_type`, `waste_type` | no | Activity type within the category. Required when the quantity is filled, except energy, which defaults to `ELECTRICITY` |
| `energy_unit`, `fuel_unit`, `material_unit`, `waste_unit` | no | Must be the type's canonical unit when given |
| `production` | yes (header) | Production quantity for the row, stored once on the row's first activity |
| `production_unit` | no | `tonnes` (default), `kg`, `units` |

How rows are handled:

- **Unknown or duplicate columns**, or a missing required column, reject the file.
- **Limits:** more than 5000 data rows, binary content, or a file that isn't UTF-8 also reject the file.
- **Row validation:** each row is validated on its own. A row with any error is never written and is reported as `{ "row", "field", "message" }`, where `row` is the spreadsheet line number.
- **Duplicates:** a row whose activity exactly matches an existing activity (same process, date, type and quantity), or an earlier row in the file, is invalid. Re-uploading a file therefore cannot double-count emissions.
- **Atomic import:** validation, duplicate checks, and inserts run in one transaction, so an import is all-or-nothing.
- **Invalid rows and the flags:**
  - With `dryRun=true`, nothing is written and the summary is returned with `200`.
  - With `skipInvalidRows=false` (the default), any invalid row aborts the import: `400 VALIDATION_ERROR`, with the row errors in `details`.
  - With `skipInvalidRows=true`, only valid rows are imported and invalid rows are reported.

Summary (`200` for a dry run, `201` when imported):

```json
{
  "fileName": "september.csv",
  "dryRun": false,
  "imported": true,
  "totalRows": 30,
  "validRows": 28,
  "invalidRows": 2,
  "activityCount": 61,
  "co2e": { "value": 48210.5, "unit": "kgCO2e" },
  "errors": [{ "row": 7, "field": "process", "message": "Unknown process \"Kiln\" — add it in Factory Setup first" }],
  "errorsTruncated": false,
  "preview": [{ "row": 2, "processName": "Furnace", "activityDate": "2026-09-01T00:00:00.000Z", "energyType": "ELECTRICITY", "quantity": 1200, "unit": "kWh", "productionQuantity": 8, "productionUnit": "tonnes", "co2eValue": 840, "co2eUnit": "kgCO2e" }]
}
```

## 6. Emissions

The deterministic carbon engine (`backend/src/services/carbon.service.js`, BR-01/BR-02) runs as part of ingestion:

- **Calculation:** `CO2e = quantity × factor`, with no LLM involved.
- **Storage:** manual entries, simulated readings and CSV imports store each activity and its emission in the same transaction. The emission records the factor used (`emission_factor_id`) and the calculation method.
- **Factor choice:** the newest factor by year for the activity's type and canonical unit, with the id as a deterministic tie-break.
- **Missing factor:** a manual entry fails with `400`; a CSV row becomes a row error.
- **Recalculation:** recalculating an activity replaces its emission rather than duplicating it.
- **Backfill:** `npm run emissions:backfill` calculates emissions for any activities stored without one.

```http
POST /api/emissions/calculate
GET  /api/factories/:id/emissions
GET  /api/factories/:id/emissions/summary
```

Every role in the organization may read emissions. Factories outside the caller's organization return `404 NOT_FOUND`.

### Calculate

Two request forms are accepted:

- **Ad hoc:** `{ "activityType": "NATURAL_GAS", "quantity": 300, "unit": "m3", "emissionFactorId": 5 }`. `unit` and `emissionFactorId` are optional. Nothing is stored and any role may call it. `quantity` may be `0`; otherwise it follows the ingestion rules (§5). This is the capability the `calculate_emissions` MCP tool exposes.
- **Stored activity:** `{ "activityId": 101 }`. This recalculates the activity with the current factor and replaces its stored emission. It requires `ADMIN` or `FACTORY_OPERATOR` (`403` otherwise), and activities outside the organization return `404`.

Sending both forms at once is rejected. `200` response:

```json
{
  "activityId": 101,
  "activityType": "NATURAL_GAS",
  "quantity": 300,
  "unit": "m3",
  "emissionFactorId": 5,
  "factor": 1.9,
  "factorUnit": "kgCO2e/m3",
  "factorSource": { "region": "GLOBAL-DEMO", "year": 2026, "reference": "…" },
  "co2eValue": 570,
  "co2eUnit": "kgCO2e",
  "calculationMethod": "CO2e = activity quantity × emission factor",
  "emission": { "id": 71, "co2eValue": 570, "co2eUnit": "kgCO2e", "emissionFactorId": 5, "calculationMethod": "…", "calculatedAt": "…" }
}
```

`activityId` and `emission` are only present for the stored-activity form.

### List

`GET /api/factories/:id/emissions` accepts `from`, `to`, `source`, `energyType`, `processId`, `limit` and `offset`, like the activity list. It returns `{ "items", "total", "limit", "offset" }`, newest activity first. Each item is the stored emission plus the activity (`activityId`, `processId`, `processName`, `activityDate`, `energyType`, `category`, `quantity`, `unit`, `source`, `isSimulated`) and the factor that explains it (`factor: { id, value, unit, region, year, reference }`).

### Dashboard summary

`GET /api/factories/:id/emissions/summary` backs the Carbon Dashboard. It aggregates stored emissions; nothing is recalculated and clients never total emissions themselves.

Query parameters:

- `from`, `to`: inclusive `YYYY-MM-DD` dates.
- `source`: `MANUAL`, `CSV` or `SIMULATION`.
- `granularity`: `month` (default) or `day`. Daily history requires `from` and `to`, at most 366 days apart.

```json
{
  "factory": { "id": 3, "name": "ABC Metal Manufacturing" },
  "filters": { "from": "2026-04-01", "to": "2026-09-30", "source": null, "granularity": "month" },
  "co2eUnit": "tCO2e",
  "totals": { "co2e": 1250, "simulatedCo2e": 12.4, "activityCount": 540, "emissionCount": 540 },
  "production": { "quantity": 10000, "unit": "tonnes", "byUnit": [{ "unit": "tonnes", "quantity": 10000 }] },
  "intensity": { "value": 0.125, "unit": "tCO2e/tonne" },
  "byProcess": [{ "processId": 7, "process": "Furnace", "co2e": 520, "percentage": 41.6, "activityCount": 120 }],
  "bySource": [{ "activityType": "NATURAL_GAS", "label": "Natural gas", "category": "FUEL", "co2e": 610, "percentage": 48.8 }],
  "byDataSource": [{ "source": "SIMULATION", "isSimulated": true, "co2e": 12.4, "activityCount": 30, "percentage": 0.99 }],
  "history": [{ "period": "2026-09", "co2e": 104 }],
  "energy": [{ "activityType": "ELECTRICITY", "label": "Electricity", "category": "ENERGY", "unit": "kWh", "total": 426700, "history": [{ "period": "2026-09", "quantity": 70900 }] }],
  "warnings": []
}
```

- **Units:** CO2e figures are in tCO2e, converted from the stored kgCO2e. Energy quantities stay in each type's canonical unit and are never converted.
- **Processes:** every process of the factory is listed, including those with no emissions. `percentage` is the share of the total, and it is `0` when the total is `0`.
- **History and energy:** each series has one point per `YYYY-MM` or `YYYY-MM-DD` period (UTC) from `from` (or the first activity) to `to` (or the last activity). Periods with no data are filled with `0`.
- **Production:** summed per unit. Mass units combine into tonnes.
- **Intensity:** total CO2e divided by production (BR-05), in `tCO2e/tonne` or `tCO2e/unit`. It is `null` when there is no production or production mixes mass and count units.
- **Warnings:** each warning is `{ code, message }`. Codes are `MISSING_EMISSIONS` (activities with no stored emission, which are excluded), `UNSUPPORTED_CO2E_UNIT`, `NO_PRODUCTION` and `MIXED_PRODUCTION_UNITS`.
- **Simulated readings:** `totals.simulatedCo2e` and `byDataSource[].isSimulated` let the UI label simulated readings (BR-12).

## 7. Hotspots

```http
GET /api/factories/:id/hotspots
GET /api/factories/:id/hotspots/:processId
```

Deterministic ranking of processes by their share of stored emissions (BR-03, BR-04). No ML or LLM is involved. Every role in the organization may read it, and factories outside the organization return `404`. Query parameters are `from`, `to` (inclusive `YYYY-MM-DD`) and `source`, the same as the dashboard summary.

### Ranking

```json
{
  "factory": { "id": 1, "name": "ABC Metal Manufacturing" },
  "filters": { "from": null, "to": null, "source": null },
  "co2eUnit": "tCO2e",
  "totalEmission": 1100,
  "activityCount": 84,
  "emissionCount": 84,
  "thresholds": { "critical": 40, "high": 25, "medium": 10 },
  "hotspots": [
    { "rank": 1, "processId": 7, "process": "Furnace", "emission": 520, "percentage": 47.27, "severity": "CRITICAL", "activityCount": 24 }
  ],
  "warnings": []
}
```

- **Contribution:** the total is the sum of the process emissions. `percentage` is the process's share of that total, rounded to 2 decimals. Processes are sorted by emission, descending, with the process name as a tie-break.
- **Severity:** above `critical` is `CRITICAL`, `high` up to `critical` is `HIGH`, `medium` up to `high` is `MEDIUM`, and anything lower is `LOW`. Severity is assigned from the rounded percentage, so the displayed share and its label always agree.
- **Thresholds:** configurable through `HOTSPOT_CRITICAL_PERCENT`, `HOTSPOT_HIGH_PERCENT` and `HOTSPOT_MEDIUM_PERCENT` (defaults 40, 25 and 10). The backend refuses to start unless CRITICAL > HIGH > MEDIUM.
- **Zero emissions:** when total emissions are `0`, `hotspots` is empty. Processes with no emissions stay in a non-empty ranking at 0% and `LOW`.
- **Warnings:** only the emission-related codes apply here: `MISSING_EMISSIONS` and `UNSUPPORTED_CO2E_UNIT`.

### Process detail

`GET /api/factories/:id/hotspots/:processId` returns one process's position in the ranking, plus what drives its emissions. A process that isn't in the factory returns `404`.

```json
{
  "process": { "id": 7, "name": "Furnace", "processType": "THERMAL", "description": "…" },
  "hotspot": { "rank": 1, "processId": 7, "process": "Furnace", "emission": 520, "percentage": 47.27, "severity": "CRITICAL", "activityCount": 24 },
  "factoryTotalEmission": 1100,
  "rankedProcessCount": 5,
  "thresholds": { "critical": 40, "high": 25, "medium": 10 },
  "co2eUnit": "tCO2e",
  "emission": 520,
  "simulatedEmission": 0,
  "activityCount": 24,
  "drivers": [{ "activityType": "NATURAL_GAS", "label": "Natural gas", "category": "FUEL", "co2e": 400, "percentage": 76.92 }],
  "history": [{ "period": "2026-09", "co2e": 43.3 }],
  "production": { "quantity": 800, "unit": "tonnes", "byUnit": [] },
  "intensity": { "value": 0.65, "unit": "tCO2e/tonne" },
  "warnings": []
}
```

- **`hotspot`:** `null` when the factory has no emissions in the period.
- **`drivers`:** percentages are shares of this process's own emissions, not of the factory total.
- **`history`:** monthly.

## 8. Recommendations

```http
GET  /api/factories/:id/recommendations
POST /api/factories/:id/recommendations/generate
```

Deterministic intervention scoring (FR-08, BR-06). No LLM produces a number: the AI may only explain a score that this service has already calculated. Every role may read recommendations. Generating them requires `ADMIN`, `FACTORY_OPERATOR` or `CONSULTANT`; `REGULATOR` gets `403`. Factories outside the organization return `404`.

### Generate

`POST /api/factories/:id/recommendations/generate` takes an empty body and returns `201`.

1. **Baseline:** the factory's emissions over the trailing 12 months (365 days up to today, UTC).
2. **Matching:** each circular alternative is matched, through a fixed rule table (`INTERVENTION_TARGETS`), to the emissions it replaces.
   - `FACTORY`-scope alternatives cover an activity type across the whole factory, e.g. virgin aluminium → recycled aluminium, or natural gas → biogas.
   - `PROCESS`-scope alternatives cover each matching process, e.g. furnace upgrades apply to processes named like a furnace, kiln or oven, and the boiler upgrade to boilers.
   - Alternatives with no matching activity data are returned in `unmatchedAlternatives`, not recommended.
3. **Estimates:** targeted emissions × the alternative's reduction % gives the CO2e avoided per year. Its share of the factory total is the estimated reduction.
4. **Score:** each component is on a common 0–100 scale:
   ```text
   Score = 0.40 × Environmental Impact + 0.25 × Financial Benefit + 0.20 × Feasibility + 0.15 × Circularity
   ```
   | Component | 0–100 scale |
   |---|---|
   | Environmental Impact | Share of factory emissions avoided; 10% or more scores 100 |
   | Financial Benefit | `100 × (1 − payback / 10 years)`; 0 when payback is unavailable (BR-09) |
   | Feasibility | Mean of the implementation-difficulty and cost-level scores (LOW 100, MEDIUM 60, HIGH 20; an unspecified level scores 50) |
   | Circularity | The knowledge base's circularity score |
5. **Ranking:** highest score first. Ties go to the larger CO2e saving, then to the alternative and process name, so the same data always gives the same result.
6. **Storage:** `PENDING` recommendations are replaced. Ones a person has already `ACCEPTED`, `REJECTED` or `IMPLEMENTED` are kept and never duplicated.

```json
{
  "factory": { "id": 1, "name": "ABC Metal Manufacturing" },
  "basis": { "from": "2025-09-13", "to": "2026-09-12", "factoryEmission": 24436.7, "co2eUnit": "tCO2e" },
  "weights": { "environmentalImpact": 0.4, "financialBenefit": 0.25, "feasibility": 0.2, "circularity": 0.15 },
  "assumptions": ["Annual estimates use the emissions recorded in the 12 months before the recommendations were generated.", "…"],
  "created": 13,
  "keptDecided": 0,
  "unmatchedAlternatives": [{ "id": 6, "alternative": "Reusable packaging", "currentOption": "Single use packaging", "category": "reuse" }],
  "recommendations": [Recommendation],
  "warnings": []
}
```

Warnings are `MISSING_EMISSIONS`, `UNSUPPORTED_CO2E_UNIT` and `NO_EMISSIONS` (nothing recorded in the window).

### List

`GET /api/factories/:id/recommendations?status=PENDING` returns `{ factory, generatedAt, weights, assumptions, recommendations }`, ranked the same way. `status` is optional.

### Recommendation

```json
{
  "id": 22,
  "rank": 1,
  "status": "PENDING",
  "alternativeId": 1,
  "alternative": "Recycled aluminum",
  "currentOption": "Virgin aluminum",
  "category": "material",
  "description": "Replace a share of virgin aluminum with recycled aluminum feedstock.",
  "scope": "FACTORY",
  "processId": null,
  "process": null,
  "score": 84.3,
  "scoreBreakdown": { "environmentalImpact": 100, "financialBenefit": 75, "feasibility": 60, "circularity": 90 },
  "estimatedReduction": 14.12,
  "reductionPercent": 15,
  "estimatedSavings": 3450,
  "savingsUnit": "tCO2e/yr",
  "estimatedCost": "MEDIUM",
  "implementationDifficulty": "MEDIUM",
  "paybackPeriod": 2.5,
  "circularityScore": 90,
  "reason": "Virgin aluminium emissions total 23,000 tCO2e a year across the factory, mostly from Furnace (hotspot #1, 96.47% of factory emissions, CRITICAL). Recycled aluminum is estimated to cut them by 15%, avoiding about 3,450 tCO2e a year (14.12% of factory emissions).",
  "assumptions": [],
  "createdAt": "2026-09-12T10:00:00.000Z"
}
```

| Field | Meaning |
|---|---|
| `estimatedReduction` | Share of the factory's emissions avoided (%) |
| `reductionPercent` | The alternative's reduction of the emissions it targets |
| `estimatedSavings` | CO2e avoided per year |
| `estimatedCost` | The knowledge base's cost level |
| `paybackPeriod` | Years, or `null` when not available |
| `assumptions` | Lists anything the knowledge base leaves unspecified (BR-11) |
| `scoreBreakdown` | Recomputed from the stored inputs |

## 9. Scenarios

```http
POST /api/factories/:id/scenarios
GET  /api/factories/:id/scenarios
```

Request:
```json
{
  "name": "30% recycled material",
  "recycledMaterialPercent": 30,
  "energyEfficiencyPercent": 10,
  "fuelReplacementPercent": 0,
  "wasteRecoveryPercent": 20
}
```

Response:
```json
{
  "baselineEmission": 1250,
  "projectedEmission": 980,
  "reductionAmount": 270,
  "reductionPercent": 21.6
}
```

## 10. AI

```http
POST /api/ai/analyze
POST /api/ai/copilot
POST /api/ai/recommend
POST /api/ai/scenario
```

Copilot request:
```json
{
  "factoryId": 1,
  "conversationId": 10,
  "message": "Why is my furnace the biggest emission source?"
}
```

Expected response:
```json
{
  "answer": "The furnace contributes 47% of estimated emissions...",
  "toolsUsed": [
    "get_factory_profile",
    "calculate_emissions",
    "identify_hotspots"
  ],
  "assumptions": [],
  "confidence": "HIGH"
}
```

## 11. Authorization Rules

- Users may access only factories within their organization/scope.
- Creating, updating and deleting factories and processes requires `ADMIN` or `FACTORY_OPERATOR`. Other roles get `403 FORBIDDEN`. A process can only be changed through the factory it belongs to.
- Admin can manage configuration.
- Operator can enter operational data.
- Consultant can analyze and generate recommendations/reports.
- Regulator access should be read-oriented.

## 12. Validation

Reject:
- Negative quantities where domain-invalid.
- Unknown process IDs.
- Invalid dates.
- Unsupported energy/fuel types.
- Malformed CSV rows.
- Unauthorized factory IDs.
- Oversized uploads.
