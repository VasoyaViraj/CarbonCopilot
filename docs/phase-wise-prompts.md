# EcoTrace AI — End-to-End Phase-Wise Development Prompts & Git Commit Plan

> **Purpose:** This is the master execution document for the complete EcoTrace AI hackathon project.
>
> It is **not only an AI-agent development plan**. It covers the entire product from repository initialization through frontend, Express/PostgreSQL backend, deterministic carbon engine, CSV ingestion, simulation, LangChain/LangGraph/MCP, recommendations, what-if scenarios, AI Copilot, reports, integration, testing, deployment, and final demo.
>
> **Project basis:** React + Vite, Express, PostgreSQL, Python/FastAPI, LangChain, LangGraph, MCP, and an LLM. The hackathon has no physical sensors, so the MVP uses manual data, CSV data, and simulated readings while remaining sensor-ready.

---

# 0. Master Development Principles

## 0.1 Architecture

```text
                    USER
                      │
                      ▼
              React + Vite
                      │
                 HTTPS/REST
                      │
                      ▼
               Node + Express
                 │        │
                 │        └──────────────┐
                 ▼                       ▼
             PostgreSQL             Python/FastAPI
                                         │
                                         ▼
                                     LangGraph
                                         │
                                         ▼
                                        MCP
                              ┌──────────┼──────────┐
                              ▼          ▼          ▼
                           Carbon     Hotspot   Circular
                            Tool       Tool      Tool
                              │          │          │
                              └──────────┼──────────┘
                                         ▼
                                  Scenario Engine
                                         │
                                         ▼
                                  AI Recommendation
                                         │
                                         ▼
                                  Actionable Output
```

## 0.2 Non-negotiable Rules

1. PostgreSQL is the source of truth.
2. Express owns authentication, authorization, CRUD, validation, ingestion, and deterministic business APIs.
3. The Python service owns AI orchestration.
4. LLMs must not be used as authoritative calculators.
5. Carbon arithmetic must be deterministic.
6. AI must use actual factory/tool data before making factory-specific claims.
7. Simulated readings must be labelled as simulated.
8. Scenario calculations must not mutate baseline data.
9. Recommendations are decision support, not guaranteed savings.
10. The hackathon MVP does not claim physical sensor-based leak detection.
11. Future IoT/MQTT input should be able to enter through the ingestion boundary without redesigning downstream intelligence.
12. Every phase must leave the repository in a runnable state whenever practical.

---

# 1. Team Roles

Use the three-person team described in the project plan.

## Developer 1 — Frontend / UI

Primary ownership:
- React + Vite
- Tailwind
- Routing/layout
- Forms
- Dashboard
- Charts
- Hotspot UI
- Recommendation UI
- Scenario UI
- AI Copilot UI
- Report UI
- Frontend integration

## Developer 2 — Backend / Database

Primary ownership:
- Express
- PostgreSQL
- Prisma/ORM
- Authentication
- Authorization
- Factory/process/activity APIs
- CSV ingestion
- Emission persistence
- Recommendation/scenario APIs
- Validation
- Backend integration

## Developer 3 — AI / Agentic AI

Primary ownership:
- Python/FastAPI
- LangChain
- LangGraph
- MCP
- AI schemas
- Tool orchestration
- Root-cause analysis
- Recommendation reasoning
- AI Copilot
- Action-plan generation
- AI integration

## Shared Ownership

All three:
- Architecture
- API contract decisions
- Integration
- End-to-end testing
- Demo dataset
- Demo rehearsal
- Deployment
- Presentation

---

# 2. Git Strategy

## Branches

```text
main
develop

feature/project-foundation
feature/frontend-foundation
feature/backend-foundation
feature/database-schema
feature/auth
feature/factory-management
feature/data-input
feature/emission-engine
feature/dashboard
feature/hotspot-analysis
feature/circular-recommendations
feature/scenario-engine
feature/ai-service
feature/langgraph
feature/mcp-tools
feature/ai-copilot
feature/reports
feature/integration
feature/testing
feature/deployment
```

## Rules

- Never directly develop on `main`.
- Integrate features into `develop`.
- Merge to `main` only after a stable demo build.
- Use small logical commits.
- Do not mix unrelated frontend/backend/AI changes in one commit.
- Pull/rebase from `develop` before large integration work.
- Resolve API contract changes with all relevant developers before implementation.

## Commit Message Convention

Use:

```text
<type>(<scope>): <imperative summary>
```

Examples:

```text
feat(auth): implement JWT login and role authorization
feat(carbon): add deterministic emission calculation engine
feat(ai): add LangGraph hotspot analysis workflow
fix(csv): reject rows with invalid required fields
refactor(api): centralize factory authorization middleware
test(scenario): cover baseline and projected emission calculations
docs(api): document AI copilot request contract
chore(deploy): add production environment configuration
```

Recommended types:

```text
feat
fix
refactor
test
docs
chore
perf
style
```

---

# 3. Phase 0 — Architecture, Repository & Contracts

## Objective

Create the shared foundation before the three developers work independently.

## Tasks

### Shared

Create:

```text
ecotrace-ai/
├── frontend/
├── backend/
├── ai-service/
├── docs/
├── data/
├── .gitignore
├── README.md
└── docker-compose.yml (optional)
```

Define:
- Product name.
- Environment variables.
- Service ports.
- API base URL.
- PostgreSQL connection.
- AI service URL.
- JWT configuration.
- LLM configuration.

Finalize:
- Database entities.
- API routes.
- Roles.
- AI response contract.
- Error response shape.
- Folder structure.

## Prompt — Team Architecture

```text
Act as a senior full-stack architect.

Using the EcoTrace AI project requirements, design the implementation foundation for:
1. React + Vite frontend.
2. Node + Express backend.
3. PostgreSQL database.
4. Python + FastAPI AI service.
5. LangChain + LangGraph agent.
6. MCP tools.

The system must support:
- authentication
- factory management
- process management
- manual activity input
- CSV ingestion
- simulated readings
- deterministic emission calculation
- process-level hotspot detection
- circular recommendations
- recommendation ranking
- what-if simulation
- AI Copilot
- reports

Respect the architectural boundary:
- React = UI
- Express = application/business API + database
- FastAPI = AI orchestration
- deterministic tools = calculations
- LLM = reasoning/explanation/orchestration

Produce:
- repository structure
- service responsibilities
- environment variables
- API conventions
- error contract
- development workflow
- integration strategy
```

## Deliverables

- Repository.
- README skeleton.
- Architecture document.
- API contract.
- Initial ER diagram.
- Environment example files.

## Commit Messages

```text
chore(repo): initialize EcoTrace AI monorepo structure
docs(architecture): document service boundaries and system architecture
docs(api): define initial REST API contracts
chore(config): add development environment templates
```

---

# 4. Phase 1 — Frontend Foundation

## Owner

Developer 1.

## Objective

Create the application shell and navigation without waiting for backend completion.

## Build

```text
src/
├── components/
├── pages/
├── layouts/
├── hooks/
├── services/
├── context/
├── charts/
└── utils/
```

Create routes/pages:

```text
/login
/factory
/data
/dashboard
/hotspots
/recommendations
/scenarios
/copilot
/reports
```

Build:
- App layout.
- Sidebar.
- Navbar.
- Protected-route placeholder.
- Loading state.
- Error state.
- Empty state.
- Reusable cards.
- Reusable tables.
- Form components.
- Chart containers.

## Prompt

```text
Build the React + Vite foundation for EcoTrace AI.

Use a professional industrial sustainability dashboard UX.

Create:
- application shell
- sidebar
- navbar
- routing
- reusable DashboardCard
- DataTable
- FileUploader
- HotspotCard
- RecommendationCard
- ScenarioSlider
- ChatWindow
- loading/error/empty states

Create placeholder pages for:
Login
Factory Setup
Data Input
Carbon Dashboard
Hotspot Analysis
Circular Recommendations
What-if Simulator
AI Copilot
Reports

Do not hardcode final business calculations into components.
Keep API access inside services/hooks.
Use mock data only as temporary UI scaffolding and clearly isolate it.
```

## Commit Messages

```text
feat(frontend): initialize React Vite application shell
feat(frontend): add application routing and dashboard layout
feat(ui): add reusable dashboard cards tables and states
feat(ui): scaffold carbon hotspot recommendation and scenario pages
```

---

# 5. Phase 2 — Backend + PostgreSQL Foundation

## Owner

Developer 2.

## Objective

Create the system of record.

## Database

Implement:

```text
organizations
users
factories
processes
activities
emission_factors
emissions
materials
waste
circular_alternatives
recommendations
scenarios
ai_conversations
ai_messages
simulation_readings
```

Relationships:

```text
Organization
 ├── Users
 └── Factories
       ├── Processes
       │     └── Activities
       │            └── Emissions
       ├── Materials
       ├── Waste
       ├── Recommendations
       ├── Scenarios
       └── Simulation Readings
```

## Prompt

```text
Implement the PostgreSQL domain model for EcoTrace AI.

Use the project's defined entities and relationships.

Requirements:
- foreign keys
- timestamps
- appropriate indexes
- unique email
- organization scoping
- process → activity relationship
- activity → emission relationship
- emission → emission factor relationship
- factory → scenario relationship
- factory/process → recommendation relationship
- AI conversation/message relationship
- process → simulation reading relationship

Use Prisma or the selected ORM.

Do not put AI logic into database models.
Do not duplicate derived calculations unnecessarily.
Create migrations and seed support.
```

## Seed Data

Create initial:
- roles.
- emission factors.
- circular alternatives.
- demo organization.
- demo users.
- demo factory/processes.

## Commit Messages

```text
feat(database): define EcoTrace relational schema
feat(database): add migrations and development seed data
feat(database): add indexes and organization-level data constraints
feat(backend): initialize Express application structure
```

---

# 6. Phase 3 — Authentication & Authorization

## Owner

Developer 2.
Developer 1 integrates frontend authentication.

## Roles

```text
ADMIN
FACTORY_OPERATOR
CONSULTANT
REGULATOR
```

## Backend

Implement:

```http
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
```

Use:
- bcrypt.
- JWT.
- middleware.
- role checks.
- organization/factory ownership checks.

## Prompt — Backend

```text
Implement secure JWT authentication for EcoTrace AI.

Requirements:
1. Registration.
2. Login.
3. Password hashing with bcrypt.
4. JWT creation.
5. JWT verification middleware.
6. Current-user endpoint.
7. Role authorization.
8. Organization/factory access authorization.
9. Validation.
10. Consistent authentication errors.

Never trust factory_id supplied by the client without authorization verification.
Prevent cross-organization data access.
Keep secrets in environment variables.
```

## Prompt — Frontend

```text
Integrate React authentication with the Express JWT API.

Implement:
- login form
- auth context/state
- protected routes
- logout
- current-user restoration
- unauthorized handling
- loading state

Do not put authorization decisions only in the frontend. Backend remains authoritative.
```

## Commit Messages

```text
feat(auth): implement user registration and password hashing
feat(auth): add JWT authentication middleware
feat(auth): implement role and organization authorization
feat(frontend-auth): integrate login protected routes and logout
fix(auth): prevent unauthorized cross-factory access
```

---

# 7. Phase 4 — Factory & Process Management

## Owners

Developer 2: API/database.
Developer 1: UI.

## APIs

```http
POST   /api/factories
GET    /api/factories
GET    /api/factories/:id
PUT    /api/factories/:id
DELETE /api/factories/:id

POST /api/factories/:id/processes
GET  /api/factories/:id/processes
```

## UI

Factory Setup:
- factory name.
- industry.
- location.
- production capacity.
- production unit.
- process creation.

## Prompt

```text
Implement complete factory and process management.

Backend:
- controllers
- routes
- services
- validation
- authorization
- persistence

Frontend:
- factory setup form
- process list
- add process
- edit/delete where appropriate
- validation
- success/error states

Ensure every factory query is scoped to the authenticated organization/user permissions.
```

## Commit Messages

```text
feat(factory): add factory CRUD APIs
feat(process): add factory process management APIs
feat(factory-ui): implement factory setup and process configuration
fix(factory): enforce organization-scoped factory authorization
```

---

# 8. Phase 5 — Operational Data Input

## Owners

Developer 2: ingestion.
Developer 1: UI.
Developer 3: prepare AI data schemas only.

## Supported Inputs

```text
Manual
CSV
Simulation
```

Manual activity example:

```text
Process: Furnace
Natural Gas: 300 m3
Electricity: 1,200 kWh
Production: 8 tonnes
```

CSV:

```text
date
process
energy
fuel
material
production
waste
```

## Prompt — Backend

```text
Implement EcoTrace operational data ingestion.

Support:
1. Manual activity creation.
2. Activity listing.
3. CSV upload.
4. CSV parsing.
5. Process resolution.
6. Row-level validation.
7. Transaction-safe persistence.
8. Source field: MANUAL, CSV, SIMULATION.

Reject or quarantine invalid rows with useful row-level errors.

Validate:
- required fields
- numeric quantities
- valid dates
- known process
- supported activity types
- reasonable domain constraints

Never silently create incorrect records.
```

## Prompt — Frontend

```text
Build the Data Input screen.

Tabs:
Manual Input | CSV Upload | Simulation

Manual:
- process selector
- energy/fuel/material fields
- quantity
- unit
- production
- submit

CSV:
- drag/drop upload
- template download
- validation feedback
- upload progress
- imported-row summary
- row-level errors

Simulation:
- configuration controls
- start/stop
- clearly label readings as simulated.
```

## Commit Messages

```text
feat(activity): add manual operational activity API
feat(csv): implement validated CSV ingestion pipeline
feat(data-ui): build manual activity entry form
feat(data-ui): add CSV upload and validation feedback
feat(simulation-ui): add simulated reading controls
```

---

# 9. Phase 6 — Deterministic Carbon Engine

## Owners

Developer 2 primary.
Developer 3 exposes the capability through MCP later.

## Formula

```text
CO2e = Activity Quantity × Emission Factor
```

Example:

```text
10,000 kWh × 0.7 kgCO2e/kWh
= 7,000 kgCO2e
= 7 tCO2e
```

## Requirements

- Factor lookup.
- Unit handling.
- Factor version persistence.
- Deterministic calculation.
- Calculation method persistence.
- Emission persistence.

## Prompt

```text
Implement the deterministic EcoTrace carbon calculation engine.

Input:
- activity type
- quantity
- unit
- emission factor

Process:
1. Find valid emission factor.
2. Validate compatible unit.
3. Multiply quantity by factor.
4. Store emission result.
5. Store factor reference and calculation method.

Output:
- activity
- factor
- quantity
- unit
- co2e value
- co2e unit
- calculation method

Do not use an LLM.

Design the calculation service so the same function can later be exposed as an MCP tool.
```

## Tests

Test:
- integers.
- decimals.
- zero.
- unsupported units.
- missing factor.
- invalid negative values.
- repeatability.

## Commit Messages

```text
feat(carbon): implement deterministic emission calculation engine
feat(carbon): add emission factor lookup and version persistence
test(carbon): cover emission calculation edge cases
feat(emissions): persist calculated emissions with methodology
```

---

# 10. Phase 7 — Carbon Dashboard

## Owners

Developer 1 + Developer 2.

## Dashboard Metrics

```text
Total Emissions
Production
Emission Intensity
```

Charts:
- emission by source.
- emission by process.
- historical emissions.
- energy consumption.

## APIs

```http
POST /api/emissions/calculate
GET  /api/factories/:id/emissions
GET  /api/factories/:id/emissions/summary
```

## Prompt

```text
Implement the EcoTrace carbon dashboard end to end.

Backend:
- emission summary aggregation
- process aggregation
- source aggregation
- historical aggregation
- production aggregation
- emission intensity

Frontend:
- KPI cards
- process chart
- source chart
- historical chart
- energy chart
- date/filter controls if supported
- loading/error/empty states

Do not calculate authoritative totals independently in React.
The API should provide the calculated values.
```

## Commit Messages

```text
feat(emissions-api): add emission summary aggregation endpoints
feat(dashboard): build carbon KPI and chart components
feat(dashboard): connect emission analytics APIs
fix(dashboard): handle empty and unavailable emission datasets
```

---

# 11. Phase 8 — Hotspot Detection

## Owners

Developer 2: deterministic API.
Developer 1: UI.
Developer 3: AI integration later.

## Algorithm

```text
Group emissions by process
        ↓
Sort descending
        ↓
Total = sum(all emissions)
        ↓
Percentage = process / total × 100
        ↓
Severity
```

Default:

```text
>40%       CRITICAL
25–40%     HIGH
10–25%     MEDIUM
<10%       LOW
```

## Prompt

```text
Implement deterministic process-level hotspot detection.

Do not use ML.

For a factory:
1. Retrieve emissions.
2. Group by process.
3. Calculate process totals.
4. Calculate contribution percentage.
5. Sort descending.
6. Assign configurable severity.

Return:
processId
process
emission
percentage
severity

Handle:
- zero total emissions
- missing process
- empty dataset
- rounding
```

## UI

Show:
- ranked hotspot cards.
- severity.
- percentage.
- emissions.
- details action.
- AI Analysis action.

## Commit Messages

```text
feat(hotspots): implement deterministic process hotspot engine
feat(hotspots-api): add hotspot analysis endpoints
feat(hotspots-ui): build ranked hotspot analysis screen
test(hotspots): cover ranking percentages and severity thresholds
```

---

# 12. Phase 9 — Abnormal Emission Intensity / Potential Leak Signal

## Objective

Create the software interpretation of "leak-point detection" without pretending it is physical leak sensing.

## Formula

```text
Emission Intensity = CO2e / Production Quantity
```

Historical comparison:

```text
7-day average
      ↓
Current intensity
      ↓
Deviation
      ↓
Configured threshold
      ↓
Potential abnormal emission intensity
```

## Prompt

```text
Implement a transparent non-ML anomaly signal for EcoTrace.

Use emission intensity:
CO2e / production quantity

Compare current value with an available historical baseline such as a rolling average.

If configured deviation exceeds the threshold:
return:
- current intensity
- baseline intensity
- deviation
- threshold
- status
- explanation

Use the wording:
"Potential abnormal emission intensity detected"

Do not call this a certified leak detection result.
Do not claim physical sensor detection.
Label it as a software-based investigation signal.
```

## Commit Messages

```text
feat(anomaly): add non-ML emission intensity deviation signal
feat(anomaly-ui): display potential abnormal emission investigation state
docs(product): clarify software-based hotspot and anomaly interpretation
```

---

# 13. Phase 10 — Circular Alternatives Knowledge Base

## Owners

Developer 2: database/API.
Developer 3: retrieval/tool interface.
Developer 1: recommendation cards.

## Data

Example:

```json
{
  "category": "material",
  "current": "virgin_aluminum",
  "alternative": "recycled_aluminum",
  "co2_reduction": 15,
  "cost": "medium",
  "difficulty": "medium",
  "payback": 2.5
}
```

## Categories

```text
material
recycling
reuse
waste recovery
process optimization
energy efficiency
fuel substitution
```

## Prompt

```text
Implement the structured circular alternatives knowledge base.

Create CRUD/seed support for:
- category
- current option
- alternative option
- description
- reduction percentage
- cost level
- implementation difficulty
- estimated payback
- circularity score

Do not build a huge RAG system for the hackathon.
Use structured retrieval from PostgreSQL or a versioned dataset.

Expose a service function that can later be called through MCP:
find_circular_alternatives(...)
```

## Commit Messages

```text
feat(circular): add circular alternatives schema and seed dataset
feat(circular-api): add alternative retrieval endpoints
feat(circular-service): add process material waste and energy matching
```

---

# 14. Phase 11 — Recommendation Scoring

## Objective

Rank actions using deterministic business logic.

## Formula

```text
Score =
0.40 × Environmental Impact
+ 0.25 × Financial Benefit
+ 0.20 × Feasibility
+ 0.15 × Circularity
```

## Prompt

```text
Implement deterministic intervention scoring.

Normalize component scores to a common scale.

Weights:
Environmental Impact = 40%
Financial Benefit = 25%
Feasibility = 20%
Circularity = 15%

Return:
- score
- estimated reduction
- estimated cost
- estimated savings
- payback
- reason
- status

The score must be reproducible.
Do not let the LLM generate the numeric score.
The AI may explain the score after the deterministic service produces it.
```

## UI

Recommendation cards:

```text
Waste Heat Recovery
Reduction: 12%
Cost: Medium
Payback: 2.4 years
Score: 91
```

## Commit Messages

```text
feat(recommendations): implement deterministic intervention scoring
feat(recommendations-ui): build ranked recommendation cards
test(recommendations): verify weighted scoring and ranking
```

---

# 15. Phase 12 — What-if Scenario Engine

## Owners

Developer 2 primary.
Developer 1 UI.
Developer 3 AI scenario tool.

## Inputs

```text
recycledMaterialPercent
energyEfficiencyPercent
fuelReplacementPercent
wasteRecoveryPercent
```

## Outputs

```text
baseline
projected
reduction
reductionPercent
cost
savings
payback
```

## Critical Rule

Scenario data must never overwrite baseline emissions.

## Prompt

```text
Implement a deterministic what-if scenario engine.

Given a baseline factory state and intervention parameters:
- recycled material %
- energy efficiency %
- fuel replacement %
- waste recovery %

calculate projected emissions and financial impact.

Return:
baselineEmission
projectedEmission
reductionAmount
reductionPercent
estimatedCost
estimatedSavings
paybackPeriod

Validate percentages between 0 and 100 where applicable.

Do not mutate baseline activity or emission records.

If baseline is zero, avoid division by zero.
If annual savings are zero/unavailable, payback must be N/A.
```

## Frontend Prompt

```text
Build the What-if Simulator.

Use sliders/controls for intervention percentages.

Show:
CURRENT
PROJECTED
REDUCTION
REDUCTION %

Add charts comparing baseline and projected emissions.

Update results from the scenario API.
Do not implement authoritative scenario mathematics solely in React.
```

## Commit Messages

```text
feat(scenario): implement deterministic what-if calculation engine
feat(scenario-api): add scenario creation and retrieval endpoints
feat(scenario-ui): build interactive intervention simulator
test(scenario): cover reduction cost savings and payback cases
fix(scenario): prevent baseline mutation during simulation
```

---

# 16. Phase 13 — AI Service Foundation

## Owner

Developer 3.

## Parallel Work

Developer 1/2 can continue frontend/backend features while this is built.

## Structure

```text
ai-service/
├── app/
│   ├── main.py
│   ├── agents/
│   │   ├── graph.py
│   │   ├── state.py
│   │   └── nodes.py
│   ├── mcp/
│   │   ├── server.py
│   │   └── tools/
│   ├── services/
│   ├── prompts/
│   └── schemas/
├── requirements.txt
└── .env
```

## Prompt

```text
Build the Python FastAPI AI service for EcoTrace AI.

Implement:
- FastAPI application
- health endpoint
- configuration
- Pydantic schemas
- LLM provider wrapper
- LangChain integration
- LangGraph state
- graph skeleton
- AI response schema
- structured logging
- exception handling

Do not implement fake factory data.
Do not hardcode final demo answers.
Do not let the LLM perform authoritative arithmetic.
```

## Commit Messages

```text
feat(ai-service): initialize FastAPI AI service
feat(ai-service): add LangChain model abstraction and schemas
feat(ai-agent): add initial LangGraph state and graph skeleton
```

---

# 17. Phase 14 — MCP Tool Layer

## Owner

Developer 3, coordinated with Developer 2.

## Required Tools

```text
get_factory_profile
calculate_emissions
identify_hotspots
find_circular_alternatives
calculate_scenario
rank_interventions
generate_action_plan
```

## Prompt

```text
Implement the EcoTrace MCP tool layer.

Each tool must:
1. Have a clear name.
2. Have a validated input schema.
3. Have a validated output schema.
4. Call the actual application/data capability.
5. Return structured results.
6. Never fabricate missing values.
7. Handle errors explicitly.

Tools:

get_factory_profile(factory_id)

calculate_emissions(activity_type, quantity, unit, factor_id?)

identify_hotspots(factory_id)

find_circular_alternatives(factory_id, process_id, material?, waste?, energy?)

calculate_scenario(factory_id, intervention_parameters)

rank_interventions(candidates)

generate_action_plan(context)

Keep calculations in deterministic services.
MCP is the standardized tool interface; it is not the source of business truth itself.
```

## Integration Decision

Choose one clean mechanism:
- FastAPI calls Express internal APIs, or
- shared trusted service/data access layer where appropriate.

Do not duplicate all business logic inside the AI service.

## Commit Messages

```text
feat(mcp): initialize EcoTrace MCP server
feat(mcp): add factory profile tool
feat(mcp): add deterministic emission calculation tool
feat(mcp): add hotspot analysis tool
feat(mcp): add circular alternative retrieval tool
feat(mcp): add scenario calculation and ranking tools
feat(mcp): add action plan generation tool
```

---

# 18. Phase 15 — LangGraph Intent Router

## Owner

Developer 3.

## Intents

```text
FACTORY_OVERVIEW
HOTSPOT_ANALYSIS
RECOMMENDATION
SCENARIO
ACTION_PLAN
GENERAL_CARBON_QUESTION
```

## Prompt

```text
Implement the LangGraph intent router.

The router must identify what the user is asking and route to the minimum required workflow.

Examples:

"Why is my furnace a hotspot?"
→ HOTSPOT_ANALYSIS

"What should I fix first?"
→ RECOMMENDATION

"What happens if I use 30% recycled material?"
→ SCENARIO

"Generate an action plan."
→ ACTION_PLAN

"What industry is my factory in?"
→ FACTORY_OVERVIEW

If uncertain, use a safe general/clarification path.

Return structured intent output.
Do not make factory-specific claims during classification.
```

## Commit Messages

```text
feat(langgraph): add structured intent router
test(langgraph): cover copilot intent classification cases
```

---

# 19. Phase 16 — LangGraph Hotspot Analysis

## Prompt

```text
Implement the hotspot analysis LangGraph workflow.

Workflow:

START
 ↓
intent_router
 ↓
load_factory_data
 ↓
calculate_emissions
 ↓
identify_hotspots
 ↓
root_cause_analysis
 ↓
generate_response
 ↓
END

The root-cause response must distinguish:
- actual factory data
- derived metrics
- hypotheses
- missing information

Never invent equipment conditions.
```

## Commit Messages

```text
feat(ai): implement hotspot analysis LangGraph workflow
feat(ai): add grounded root cause analysis
test(ai): verify hotspot responses use tool-derived values
```

---

# 20. Phase 17 — LangGraph Recommendation Workflow

## Prompt

```text
Implement the recommendation workflow:

START
 ↓
intent_router
 ↓
load_factory_data
 ↓
identify_hotspots
 ↓
find_circular_alternatives
 ↓
calculate_impact
 ↓
rank_interventions
 ↓
generate_response
 ↓
END

The LLM must explain the deterministic ranking.

Return:
- top hotspot
- recommended interventions
- score
- reduction
- cost
- savings
- payback
- assumptions
- confidence

Do not invent recommendation numbers.
```

## Commit Messages

```text
feat(ai): add circular recommendation LangGraph workflow
feat(ai): ground recommendation explanations in tool results
test(ai): verify recommendation workflow tool sequence
```

---

# 21. Phase 18 — LangGraph Scenario Workflow

## Prompt

```text
Implement the natural-language scenario workflow.

Example:
"What if I use 30% recycled material?"

Steps:

START
 ↓
intent_router
 ↓
load_factory_data
 ↓
parse_intervention_parameters
 ↓
calculate_scenario
 ↓
generate_response
 ↓
END

The LLM parses user intent/parameters.
The deterministic scenario tool calculates the numbers.

If a required parameter is ambiguous, request clarification rather than inventing a value.
```

## Commit Messages

```text
feat(ai): add natural language scenario workflow
feat(ai): connect scenario tool to LangGraph
test(ai): verify scenario responses use deterministic results
```

---

# 22. Phase 19 — AI Action Plan

## Prompt

```text
Implement generate_action_plan.

Input:
- hotspots
- root cause findings
- ranked recommendations
- projected impact
- cost
- savings
- payback
- assumptions

Output:

1. Immediate investigation
2. Short-term action
3. Medium-term intervention
4. Measurement to perform
5. Expected impact
6. Risks/limitations
7. Success metric

Use estimated/projected wording.
Never present savings as guaranteed.
The human remains the final decision-maker.
```

## Commit Messages

```text
feat(ai): add structured sustainability action plan generation
test(ai): validate action plan output schema
```

---

# 23. Phase 20 — AI Copilot API

## Owners

Developer 3: FastAPI.
Developer 2: Express proxy.
Developer 1: chat UI.

## Express API

```http
POST /api/ai/copilot
```

Request:

```json
{
  "factoryId": 1,
  "conversationId": 10,
  "message": "Why is my furnace the biggest emission source?"
}
```

Response:

```json
{
  "answer": "...",
  "toolsUsed": [],
  "recommendations": [],
  "scenario": null,
  "assumptions": [],
  "confidence": "HIGH"
}
```

## Prompt — Backend

```text
Implement the Express AI proxy endpoint.

Requirements:
- authenticate user
- authorize factory
- validate request
- forward only necessary context
- call FastAPI
- handle AI timeout
- return stable response schema
- never expose internal service credentials
```

## Prompt — Frontend

```text
Implement the AI Copilot screen.

Requirements:
- chat history
- message input
- loading state
- tool/analysis indicator where useful
- structured recommendation rendering
- scenario rendering
- error fallback
- conversation ID support

The UI should make it clear that AI answers are based on the factory's available data.
```

## Commit Messages

```text
feat(ai-api): add authenticated copilot proxy endpoint
feat(copilot-ui): build AI Copilot chat interface
feat(copilot): connect React chat to LangGraph AI service
fix(copilot): handle AI timeout and unavailable-service states
```

---

# 24. Phase 21 — AI Conversation Persistence

## Objective

Support conversation history.

## Tables

```text
ai_conversations
ai_messages
```

## Prompt

```text
Implement AI Copilot conversation persistence.

When a user starts a conversation:
- create conversation record.

For each message:
- store role
- content
- timestamp
- optional tool_used metadata.

Maintain factory/user ownership.

Do not store secrets or unnecessary internal prompts.
```

## Commit Messages

```text
feat(ai-history): persist copilot conversations and messages
feat(copilot-ui): restore conversation history
```

---

# 25. Phase 22 — Reports

## Owner

Developer 1 + Developer 2.

## Report

```text
Carbon Assessment Report

Factory Summary
Emission Summary
Top Hotspots
Root Causes
Recommendations
Projected Reductions
Financial Impact
Methodology
Assumptions
```

## Prompt

```text
Implement the EcoTrace report workflow.

Backend:
- aggregate report data
- expose report endpoint
- enforce factory authorization

Frontend:
- report preview
- summary
- hotspots
- recommendations
- scenario impact
- methodology
- export/print-friendly PDF workflow

Clearly distinguish:
- calculated historical values
- estimated recommendations
- projected scenario values
- simulated readings
```

## Commit Messages

```text
feat(reports): add factory carbon assessment aggregation
feat(reports-ui): build sustainability report view
feat(reports): add report export workflow
```

---

# 26. Phase 23 — Full Frontend Integration

## Owner

Developer 1.

## Prompt

```text
Perform complete React integration against the real APIs.

Replace temporary mock data with API-backed data.

Verify pages:
1. Login
2. Factory Setup
3. Data Input
4. Carbon Dashboard
5. Hotspot Analysis
6. Circular Recommendations
7. What-if Simulator
8. AI Copilot
9. Reports

For every API:
- loading state
- success state
- empty state
- validation error
- server error
- retry where useful

Do not duplicate business calculations in components.
```

## Commit Messages

```text
feat(frontend): integrate all core product APIs
fix(frontend): standardize API loading and error handling
refactor(frontend): centralize API clients and query state
```

---

# 27. Phase 24 — Full Backend Integration

## Owner

Developer 2.

## Prompt

```text
Perform a backend architecture review.

Verify:
- route/controller/service separation
- validation
- authentication
- authorization
- transaction boundaries
- database indexes
- CSV handling
- deterministic calculations
- hotspot aggregation
- recommendation scoring
- scenario isolation
- AI proxy
- error contract

Remove duplicated logic.
Ensure factory-level authorization is enforced consistently.
```

## Commit Messages

```text
refactor(backend): consolidate business services and validation
fix(backend): enforce factory authorization across all resources
perf(database): optimize emission and factory summary queries
```

---

# 28. Phase 25 — Full AI Integration

## Owner

Developer 3.

## Prompt

```text
Perform a complete AI architecture review.

Verify the agent can answer:

1. Why is my furnace a hotspot?
2. What should I fix first?
3. Which intervention has the best ROI?
4. What happens if I use 30% recycled material?
5. Generate an action plan.

For each query:
- identify intent
- retrieve relevant factory context
- invoke minimum required tools
- use deterministic tool results
- generate grounded response
- expose assumptions
- expose confidence
- avoid fabricated values

If a tool fails, do not guess.
```

## Commit Messages

```text
feat(ai): complete end-to-end LangGraph copilot workflow
fix(ai): prevent unsupported factory-specific claims
fix(ai): prevent fabricated numerical tool results
refactor(ai): simplify graph routing and tool orchestration
```

---

# 29. Phase 26 — End-to-End Integration

## All Developers

## Golden Path

```text
LOGIN
  ↓
FACTORY SETUP
  ↓
ADD PROCESSES
  ↓
UPLOAD CSV
  ↓
ACTIVITIES
  ↓
EMISSION CALCULATION
  ↓
CARBON DASHBOARD
  ↓
HOTSPOT
  ↓
AI ROOT CAUSE
  ↓
CIRCULAR RECOMMENDATIONS
  ↓
SELECT INTERVENTION
  ↓
WHAT-IF
  ↓
ACTION PLAN
  ↓
REPORT
```

## Prompt

```text
Perform an end-to-end EcoTrace integration test.

Start from a clean user session.

Execute:
1. Login.
2. Open factory.
3. Add processes.
4. Upload demo CSV.
5. Persist activities.
6. Calculate emissions.
7. Display dashboard.
8. Identify hotspot.
9. Ask AI why.
10. Retrieve circular alternatives.
11. Rank interventions.
12. Run scenario.
13. Generate action plan.
14. Open report.

Trace factory_id, authenticated user, database records, API calls, AI tool calls, and final UI output.

Fix any contract mismatch.
Do not hide failures with hardcoded frontend values.
```

## Commit Messages

```text
test(e2e): add complete factory-to-report integration flow
fix(integration): resolve frontend backend contract mismatches
fix(integration): resolve AI service tool and schema mismatches
```

---

# 30. Phase 27 — Testing

## Backend Tests

Test:
- Auth.
- Factory authorization.
- Activities.
- CSV.
- Emissions.
- Hotspots.
- Recommendations.
- Scenarios.
- AI proxy.

## Frontend Tests

Test:
- Login.
- Protected routes.
- Forms.
- Dashboard rendering.
- CSV states.
- Scenario interactions.
- Copilot.
- Report.

## AI Tests

Test:
- Intent.
- Tool selection.
- Tool failures.
- Grounding.
- No fabrication.
- Scenario parsing.
- Action plan schema.

## Security Tests

Test:
- JWT tampering.
- SQL injection.
- Cross-organization access.
- Malicious CSV.
- Oversized upload.
- Invalid IDs.
- Unauthorized roles.

## Prompt

```text
Act as the QA lead for EcoTrace AI.

Create and execute a test matrix covering:
- unit
- integration
- API
- frontend
- AI workflow
- security
- end-to-end

Highest priority:
1. deterministic emission correctness
2. hotspot correctness
3. scenario correctness
4. factory authorization
5. AI grounding
6. demo golden path

Report failures by:
severity
component
reproduction
expected
actual
fix
regression test
```

## Commit Messages

```text
test(auth): add authentication and authorization coverage
test(carbon): add deterministic emission engine coverage
test(hotspots): add hotspot ranking and threshold coverage
test(scenario): add scenario engine regression tests
test(ai): add tool grounding and failure-path tests
test(e2e): add golden-path hackathon flow
```

---

# 31. Phase 28 — Demo Dataset

## Demo Factory

```text
ABC Metal Manufacturing

Industry:
Metal Components

Production:
10,000 tonnes/year
```

Inputs:

```text
Electricity       850,000 kWh
Natural Gas       300,000 m3
Diesel             40,000 L
Virgin Aluminum   2,000 tonnes
Waste               350 tonnes
```

Illustrative target dashboard from the project specification:

```text
Total:
1,250 tCO2e
```

Illustrative hotspot distribution:

```text
Furnace        520 tCO2e   47%
Electricity    250 tCO2e   22%
Boiler         180 tCO2e   16%
Transport       80 tCO2e    7%
Waste           70 tCO2e    8%
```

**Important:** these values are demo targets from the project specification. The running implementation must calculate its displayed values from its actual seeded activities and emission factors rather than merely hardcoding presentation values.

## Commit Messages

```text
feat(data): add ABC Metal Manufacturing demo dataset
chore(demo): add reproducible demo seed and CSV
test(demo): verify seeded hotspot and scenario workflow
```

---

# 32. Phase 29 — Killer Demo Hardening

## Demo Sequence

### 1. Opening

> "This factory knows its total emissions, but it doesn't know what to fix."

### 2. Upload CSV

```text
CSV
 ↓
Activities
 ↓
Emission Engine
```

### 3. Dashboard

Show:

```text
1,250 tCO2e
```

or the actual calculated demo value.

### 4. Hotspot

Show:

```text
Furnace
47%
High/Critical priority
```

### 5. AI

Ask:

> "Why is my furnace the biggest emission source?"

### 6. Recommendation

Ask:

> "What should I fix first?"

Expected concept:

```text
1. Waste Heat Recovery
2. Furnace Efficiency
3. Recycled Material
```

### 7. Scenario

Ask:

> "What if I implement waste heat recovery and use 30% recycled material?"

Show the actual scenario engine result.

### 8. Report

Finish with the assessment report.

## Prompt

```text
Harden the complete EcoTrace demo.

No hardcoded UI answers.
No manual database edits during presentation.
No dependency on development-only mock data.
No visible stack traces.
No unhandled AI failures.

Prepare:
- demo account
- demo factory
- demo CSV
- demo alternatives
- demo scenario
- stable environment variables
- fallback states
- fast startup
```

## Commit Messages

```text
chore(demo): prepare reproducible hackathon demo environment
fix(demo): remove presentation-only hardcoded business values
fix(demo): add graceful fallback states for external AI failures
```

---

# 33. Phase 30 — Deployment

## Services

```text
Frontend
Backend
AI Service
PostgreSQL
```

## Deployment Requirements

Configure:
- frontend API URL.
- backend database URL.
- JWT secret.
- AI service URL.
- LLM API key.
- CORS.
- production logging.
- health endpoints.

## Prompt

```text
Prepare EcoTrace AI for production-style hackathon deployment.

Requirements:
1. Build frontend.
2. Build/start Express.
3. Build/start FastAPI.
4. Configure PostgreSQL.
5. Run migrations.
6. Seed demo data.
7. Configure CORS.
8. Configure environment secrets.
9. Add health checks.
10. Verify service-to-service connectivity.
11. Verify database connectivity.
12. Verify AI tool connectivity.

Do not commit secrets.
```

## Commit Messages

```text
chore(deploy): add production environment configuration
chore(deploy): add service health checks
chore(deploy): configure frontend backend and AI service deployment
fix(deploy): resolve production CORS and service URL configuration
```

---

# 34. Phase 31 — Documentation Finalization

## Required Docs

Keep the 13-document set:

```text
PRD.md
CRD.md
TRD.md
ARCHITECTURE.md
DOMAIN_MODEL.md
API_CONTRACT.md
STATE_MACHINES.md
BUSINESS_RULES.md
DEMO_SCRIPT.md
TEST_PLAN.md
ADR.md
AGENTS.md
PHASE_WISE_AGENT_PROMPTS.md
```

## README Must Explain

```text
Problem
Solution
Hackathon sensor constraint
Architecture
Technology stack
Setup
Environment variables
Database
API
AI architecture
MCP
LangGraph
Demo
Testing
Deployment
Future IoT architecture
```

## Prompt

```text
Perform a documentation consistency audit.

Verify that:
- PRD matches implemented features.
- TRD matches actual stack.
- API contract matches routes.
- Domain model matches database.
- Architecture matches service boundaries.
- Business rules match code.
- State machines match actual flows.
- Agent documentation matches LangGraph implementation.
- Demo script matches the real application.
- Test plan matches implemented tests.

Do not claim capabilities that are not implemented.
```

## Commit Messages

```text
docs(project): finalize product and technical documentation
docs(api): synchronize API contract with implementation
docs(ai): document final LangGraph and MCP architecture
docs(demo): synchronize hackathon demo script with final build
```

---

# 35. Phase 32 — Final Release Candidate

## Release Checklist

### Product

```text
[ ] Login works
[ ] Factory setup works
[ ] Process setup works
[ ] Manual input works
[ ] CSV upload works
[ ] Simulation works
[ ] Carbon dashboard works
[ ] Hotspots work
[ ] AI root cause works
[ ] Recommendations work
[ ] What-if works
[ ] Copilot works
[ ] Reports work
```

### Technical

```text
[ ] PostgreSQL migrations succeed
[ ] Seed succeeds
[ ] API authentication works
[ ] Authorization works
[ ] No cross-factory access
[ ] Carbon calculation deterministic
[ ] Hotspot ranking deterministic
[ ] Recommendation ranking deterministic
[ ] Scenario does not mutate baseline
[ ] MCP tools validate input/output
[ ] LangGraph compiles
[ ] AI errors handled
[ ] No secrets committed
```

### Demo

```text
[ ] Demo account works
[ ] Demo CSV works
[ ] Dashboard values calculate correctly
[ ] Furnace hotspot appears from data
[ ] AI explains hotspot
[ ] Recommendations appear
[ ] Scenario produces actual result
[ ] Report generates
[ ] Deployment URL works
```

## Final Commit

```text
chore(release): prepare EcoTrace AI hackathon release candidate
```

Tag:

```text
v1.0.0-hackathon
```

---

# 36. Parallel Development Map

The team does not need to work strictly sequentially.

## Parallel Track A — Developer 1

```text
Frontend Foundation
      ↓
Factory UI
      ↓
Data Input UI
      ↓
Dashboard
      ↓
Hotspots UI
      ↓
Recommendations UI
      ↓
Scenario UI
      ↓
Copilot UI
      ↓
Reports
      ↓
Integration
```

## Parallel Track B — Developer 2

```text
Backend Foundation
      ↓
Database
      ↓
Auth
      ↓
Factory APIs
      ↓
Activities
      ↓
CSV
      ↓
Carbon Engine
      ↓
Dashboard APIs
      ↓
Hotspots
      ↓
Recommendations
      ↓
Scenario
      ↓
AI Proxy
      ↓
Integration
```

## Parallel Track C — Developer 3

```text
AI Foundation
      ↓
LLM
      ↓
LangGraph
      ↓
MCP
      ↓
Factory Tool
      ↓
Carbon Tool
      ↓
Hotspot Tool
      ↓
Root Cause
      ↓
Circular Tool
      ↓
Ranking
      ↓
Scenario Tool
      ↓
Copilot
      ↓
Action Plan
      ↓
Integration
```

---

# 37. Recommended Dependency Graph

```text
                ARCHITECTURE
                     │
        ┌────────────┼─────────────┐
        ▼            ▼             ▼
    FRONTEND      BACKEND          AI
        │            │             │
        │            ▼             ▼
        │         DATABASE      AI FOUNDATION
        │            │             │
        ▼            ▼             ▼
    FACTORY       FACTORY       LANGGRAPH
        │            │             │
        ▼            ▼             ▼
      DATA       ACTIVITIES       MCP
        │            │             │
        │            ▼             │
        │       CARBON ENGINE ◄─────┘
        │            │
        ▼            ▼
    DASHBOARD     EMISSIONS
        │            │
        ▼            ▼
    HOTSPOTS ◄──── HOTSPOT ENGINE
        │
        ▼
 RECOMMENDATIONS
        │
        ▼
    SCENARIOS
        │
        ▼
     COPILOT
        │
        ▼
      REPORT
```

---

# 38. Minimum Viable Cut-Down Plan

If the hackathon clock becomes critical, preserve this exact chain:

```text
Factory
  ↓
CSV
  ↓
Deterministic CO2 Calculation
  ↓
Dashboard
  ↓
Hotspot
  ↓
AI Explanation
  ↓
Circular Recommendation
  ↓
What-if Scenario
```

Defer first:

```text
Complex role management
Advanced simulation
Advanced RAG
Fancy animations
Complex reporting
Nonessential admin screens
```

Do **not** remove:

```text
Hotspot
Recommendation
What-if
```

These are central to the product differentiation.

---

# 39. Professional Commit History Example

A clean final history could look like:

```text
chore(repo): initialize EcoTrace AI monorepo structure
docs(architecture): document system architecture and service boundaries
feat(frontend): initialize React Vite application shell
feat(backend): initialize Express API
feat(database): define PostgreSQL schema and migrations
feat(auth): implement JWT authentication and role authorization
feat(factory): add factory and process management
feat(activity): add manual operational data ingestion
feat(csv): implement validated CSV import
feat(carbon): implement deterministic emission engine
feat(dashboard): add carbon analytics endpoints and UI
feat(hotspots): implement process-level hotspot detection
feat(anomaly): add emission-intensity investigation signal
feat(circular): add structured circular alternatives
feat(recommendations): implement intervention ranking
feat(scenario): implement deterministic what-if engine
feat(ai-service): initialize FastAPI AI service
feat(mcp): add sustainability MCP tools
feat(langgraph): implement intent routing
feat(ai): implement hotspot analysis workflow
feat(ai): implement recommendation workflow
feat(ai): implement scenario workflow
feat(ai): implement action-plan generation
feat(copilot): integrate AI Copilot end to end
feat(reports): add carbon assessment report
test(e2e): add golden-path integration coverage
fix(security): enforce organization-scoped resource authorization
fix(ai): prevent unsupported numerical claims
chore(demo): prepare reproducible hackathon dataset
chore(deploy): configure production deployment
docs(project): finalize hackathon documentation
chore(release): prepare EcoTrace AI hackathon release candidate
```

---

# 40. Final Team Definition of Done

The project is complete when a judge can perform:

```text
1. Login
      ↓
2. Open ABC Metal Manufacturing
      ↓
3. Upload operational CSV
      ↓
4. See total estimated CO2e
      ↓
5. See Furnace as top hotspot
      ↓
6. Ask AI "Why?"
      ↓
7. Receive tool-grounded explanation
      ↓
8. Ask "What should I fix first?"
      ↓
9. See ranked circular alternatives
      ↓
10. Change scenario assumptions
      ↓
11. See projected emissions and reduction
      ↓
12. Generate action plan
      ↓
13. Open report
```

The technical story is:

```text
Operational Data
       ↓
Deterministic Carbon Engine
       ↓
Emission Hotspot Detection
       ↓
Agentic AI
       ↓
MCP Tools
       ↓
Circular Alternatives
       ↓
Financial Impact
       ↓
What-if Simulation
       ↓
Actionable Sustainability Plan
```

The judge-facing explanation is:

> **"The deterministic backend calculates emissions and financial metrics. Our agentic AI layer interprets the factory context, identifies what information it needs, invokes specialized MCP tools, reasons over the results, ranks possible interventions, explains the hotspot, and generates an actionable sustainability plan."**

And the core product story is:

> **Data → Intelligence → Action → Simulation → Impact**
