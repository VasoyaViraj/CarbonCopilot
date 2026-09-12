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
POST /api/processes/:id/activities
GET  /api/processes/:id/activities
POST /api/activities/upload
```

Activity:
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

CSV upload should validate:
```text
date
process
energy
fuel
material
production
waste
```

## 6. Emissions

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
