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

The endpoints below arrive with the Carbon Dashboard (Phase 7).

```http
POST /api/emissions/calculate
GET  /api/factories/:id/emissions
GET  /api/factories/:id/emissions/summary
```

Calculation response:
```json
{
  "activityId": 101,
  "emissionFactorId": 5,
  "quantity": 300,
  "factor": 1.9,
  "co2eValue": 570,
  "unit": "kgCO2e"
}
```

## 7. Hotspots

```http
GET /api/factories/:id/hotspots
GET /api/factories/:id/hotspots/:processId
```

Response:
```json
[
  {
    "processId": 7,
    "process": "Furnace",
    "emission": 520,
    "percentage": 47,
    "severity": "CRITICAL"
  }
]
```

## 8. Recommendations

```http
GET  /api/factories/:id/recommendations
POST /api/factories/:id/recommendations/generate
```

Response:
```json
{
  "id": 22,
  "alternative": "Waste Heat Recovery",
  "score": 91,
  "estimatedReduction": 12,
  "estimatedCost": "MEDIUM",
  "estimatedSavings": 50000,
  "paybackPeriod": 2.4,
  "reason": "Targets the largest thermal hotspot."
}
```

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
