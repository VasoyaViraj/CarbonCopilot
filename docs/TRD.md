# EcoTrace AI — Technical Requirements Document (TRD)

## 1. Technology Stack

### Frontend
- React
- Vite
- Tailwind CSS
- React Router
- Axios
- Recharts

### Backend
- Node.js
- Express
- PostgreSQL
- Prisma or Sequelize
- JWT
- bcrypt
- Multer
- CSV parser

### AI Service
- Python
- FastAPI
- LangChain
- LangGraph
- MCP
- LLM SDK
- Pydantic

## 2. Service Boundaries

```text
React/Vite
    │
    │ HTTPS/REST
    ▼
Express API
    ├──────────────► PostgreSQL
    │
    └──────────────► FastAPI AI Service
                           │
                           ▼
                       LangGraph
                           │
                           ▼
                          MCP
                           │
             ┌─────────────┼─────────────┐
             ▼             ▼             ▼
          Carbon        Hotspot       Circular
           Tools         Tools          Tools
                           │
                           ▼
                       Scenario
```

## 3. Backend Responsibilities

Express owns:
- Authentication.
- Authorization.
- CRUD.
- Validation.
- PostgreSQL access.
- File upload.
- CSV ingestion.
- Deterministic carbon calculations.
- Recommendation scoring where possible.
- Scenario mathematical calculations.
- Proxying AI requests.

## 4. AI Responsibilities

FastAPI/LangGraph owns:
- Natural-language intent interpretation.
- Tool selection/orchestration.
- Retrieval of structured factory context.
- Root-cause explanation.
- Recommendation explanation.
- Action-plan generation.
- Natural-language scenario explanation.

## 5. Deterministic Calculation Requirement

Never ask an LLM to perform authoritative arithmetic.

Correct:

```text
Agent
  ↓
calculate_emissions tool
  ↓
deterministic calculation
  ↓
tool result
  ↓
LLM explanation
```

## 6. LangGraph State

```python
class CarbonState:
    user_query: str
    factory_id: int
    factory_data: dict
    emissions: dict
    hotspots: list
    alternatives: list
    scenarios: list
    recommendation: dict
    final_response: str
```

## 7. LangGraph Workflow

```text
START
 ↓
intent_router
 ↓
load_factory_data
 ↓
calculate_emissions
 ↓
detect_hotspots
 ↓
find_alternatives
 ↓
calculate_impact
 ↓
rank_recommendations
 ↓
generate_response
 ↓
END
```

For simple questions, routing may skip unnecessary nodes.

## 8. MCP Tools

Required tools:
1. `get_factory_profile`
2. `calculate_emissions`
3. `identify_hotspots`
4. `find_circular_alternatives`
5. `calculate_scenario`
6. `rank_interventions`
7. `generate_action_plan`

## 9. Security

- Password hashing.
- JWT validation.
- Role authorization.
- Request validation.
- Parameterized queries/ORM.
- Environment variables for secrets.
- CORS restrictions.
- File-type and file-size validation.
- Factory-level authorization checks.

## 10. Performance Targets

Normal API:
- Target under 500 ms for common CRUD/summary operations.

AI:
- Expected 2–10 seconds depending on model/API.

## 11. Reliability

- Calculations must be reproducible.
- Tool schemas must validate inputs.
- AI service failures must return graceful errors.
- UI must expose loading/error states.
- Scenario calculations should not mutate baseline data.

## 12. Observability

At minimum log:
- Request ID.
- User/factory ID.
- API endpoint.
- AI request ID.
- Tool invoked.
- Tool execution duration.
- Error category.

Do not log secrets or sensitive user content unnecessarily.

## 13. Deployment Shape

```text
Frontend
Backend
AI Service
PostgreSQL
```

Each service can be deployed independently.
