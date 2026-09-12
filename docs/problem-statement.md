# EcoCopilot — Complete Technical Project Document

> **Project:** Industrial Emission Leak-Point Detector & Circular Alternative Recommender  
> **Theme:** Circular Carbon Ecosystem  
> **Working product direction:** CarbonLoop / EcoTrace AI  
> **Constraint:** No physical sensors/hardware during the hackathon  
> **Core stack:** React + Vite, Express, PostgreSQL, Python/FastAPI, LangChain, LangGraph, MCP, LLM

The most important architectural decision is:

> **We are not pretending to perform physical sensor-based leak detection.**  
> For the hackathon, we perform **software-based emission hotspot detection** using operational/process data, manual input, CSV data, and simulated sensor streams. The architecture is sensor-ready for future deployment.

---

# 1. Problem Statement

## 1.1 Original Problem

Small and medium industries often know their:

- electricity consumption
    
- fuel consumption
    
- raw material usage
    
- production quantity
    
- waste generation
    

but they generally don't know:

> **Which exact process, material, or activity is responsible for the largest portion of their carbon footprint?**

And even when they identify a high-emission activity, they may not know:

> **What should they change, how much will it cost, how much CO₂ can be reduced, and whether the change is economically worthwhile?**

Existing systems often stop at:

```text
Energy data
     ↓
Carbon calculation
     ↓
"Your emissions = 1,250 tCO₂e"
```

Our system goes further:

```text
Operational Data
       ↓
Carbon Calculation
       ↓
Emission Hotspot Detection
       ↓
Root Cause Analysis
       ↓
Circular Alternatives
       ↓
Cost + Savings + Payback
       ↓
What-if Simulation
       ↓
Action Plan
```

---

# 2. Our Approach to Solve the Problem

## 2.1 Core Concept

We build an **AI-powered industrial carbon decision-support platform**.

The user provides factory/process data.

The platform:

1. Calculates estimated emissions.
    
2. Breaks emissions down by source/process.
    
3. Detects the largest emission hotspots.
    
4. Explains why those hotspots occur.
    
5. Finds circular alternatives.
    
6. Calculates estimated CO₂ reduction.
    
7. Estimates cost/savings/payback.
    
8. Allows the user to simulate interventions.
    
9. Generates an actionable sustainability plan.
    

---

# 3. What Does "Leak-Point Detector" Mean in Our MVP?

The problem statement uses **emission leak-point detection**.

Without hardware, we should reinterpret this technically as:

> **Emission hotspot / abnormal emission source detection from operational data.**

For example:

```text
Factory
│
├── Cutting        → 80 tCO₂e
├── Assembly       → 100 tCO₂e
├── Boiler         → 180 tCO₂e
├── Furnace        → 520 tCO₂e  🔴
└── Transportation → 70 tCO₂e
```

Our system detects:

```text
FURNACE
↓
520 tCO₂e
↓
47% of total emissions
↓
HIGH PRIORITY HOTSPOT
```

If sensor data becomes available in the future:

```text
IoT Sensors
     ↓
MQTT/API
     ↓
Data Ingestion
     ↓
Same Hotspot Engine
```

So the **business logic remains valid** even when the input source changes.

---

# 4. Product Vision

## One-line vision

> **Help SMEs discover where their carbon emissions come from and determine the most economically viable circular action to reduce them.**

## Product loop

```text
              ┌──────────────┐
              │    MEASURE   │
              └──────┬───────┘
                     ↓
              ┌──────────────┐
              │    LOCATE    │
              └──────┬───────┘
                     ↓
              ┌──────────────┐
              │   EXPLAIN    │
              └──────┬───────┘
                     ↓
              ┌──────────────┐
              │ RECOMMEND    │
              └──────┬───────┘
                     ↓
              ┌──────────────┐
              │   SIMULATE   │
              └──────┬───────┘
                     ↓
              ┌──────────────┐
              │    ACT       │
              └──────┬───────┘
                     ↓
                 REDUCTION
```

---

# 5. PRD — Product Requirements Document

# 5.1 Product Objective

Build a web platform for SMEs that converts factory operational data into:

- estimated carbon emissions
    
- process-level emission hotspots
    
- AI explanations
    
- circular recommendations
    
- financial impact
    
- what-if scenarios
    
- sustainability action plans
    

---

# 5.2 Target Users

## Primary

### Factory Operator

Needs:

- easy data entry
    
- emission overview
    
- hotspot identification
    
- recommended actions
    

### Sustainability Consultant

Needs:

- detailed analysis
    
- recommendations
    
- scenario comparison
    
- reports
    

## Secondary

### Regulator/Auditor

Needs:

- emission history
    
- methodology
    
- reports
    
- compliance-oriented information
    

### Admin

Needs:

- users
    
- emission factors
    
- circular alternatives
    
- system configuration
    

---

# 5.3 User Goals

### Factory Operator

> "I want to know where my factory's emissions are coming from."

### Sustainability Consultant

> "I want to know which intervention gives the best environmental and financial outcome."

### Regulator

> "I want transparent emission calculations and historical reports."

---

# 5.4 Functional Requirements

## FR-01 Authentication

System shall support:

- login
    
- registration
    
- JWT authentication
    
- role-based authorization
    

---

## FR-02 Factory Management

User can:

- create factory
    
- update factory
    
- add processes
    
- define production capacity
    
- define industry type
    

---

## FR-03 Data Input

System supports:

### Manual

```text
Electricity
Natural Gas
Diesel
Coal
Materials
Waste
Production
```

### CSV

```text
date
process
energy
fuel
material
production
waste
```

### Simulation

Generate synthetic operational readings.

---

# 5.5 FR-04 Emission Calculation

System calculates:

```text
CO₂e = Activity Quantity × Emission Factor
```

Example:

```text
Electricity = 10,000 kWh
Factor = 0.7 kg CO₂e/kWh

CO₂e = 7,000 kg
     = 7 tonnes
```

The calculation engine is deterministic.

**LLM must not be responsible for numerical emission calculations.**

---

# 5.6 FR-05 Hotspot Detection

System shall:

1. Calculate emissions.
    
2. Group emissions by process.
    
3. Rank processes.
    
4. Calculate percentage contribution.
    
5. Assign severity.
    

Example:

```text
>40% → CRITICAL
25–40% → HIGH
10–25% → MEDIUM
<10% → LOW
```

These thresholds are configurable.

---

# 5.7 FR-06 AI Root Cause Analysis

AI should explain:

```text
Why is this process a hotspot?

What activity causes it?

What factors contribute?

What should be investigated?
```

---

# 5.8 FR-07 Circular Recommendation

System shall recommend:

- alternative materials
    
- recycling
    
- reuse
    
- waste recovery
    
- process optimization
    
- energy efficiency
    
- fuel substitution
    

---

# 5.9 FR-08 Recommendation Ranking

Each intervention receives a score.

Example:

```text
Recommendation Score =

40% Environmental Impact
25% Financial Benefit
20% Feasibility
15% Circularity
```

Output:

```text
Waste Heat Recovery
Score: 91/100

Furnace Efficiency
Score: 86/100

Recycled Material
Score: 82/100
```

---

# 5.10 FR-09 What-if Simulation

User can modify:

```text
Recycled material %
Energy efficiency %
Fuel replacement %
Waste recovery %
```

System calculates:

```text
Baseline
    ↓
Intervention
    ↓
Projected emissions
    ↓
Reduction
    ↓
Financial impact
```

---

# 5.11 FR-10 AI Copilot

User can ask:

> Why is my furnace causing high emissions?

> What should I fix first?

> Which recommendation has the shortest payback?

> What happens if I replace 30% of the material?

The agent retrieves actual factory data before answering.

---

# 5.12 FR-11 Report Generation

System generates:

```text
Factory Summary
Emission Summary
Hotspots
Recommendations
Estimated Reduction
Scenario
Methodology
```

---

# 6. Non-Functional Requirements

## Performance

Normal API response:

```text
<500ms
```

AI response:

```text
2–10 seconds
```

depending on model/API.

---

## Security

- JWT
    
- password hashing
    
- role-based authorization
    
- API validation
    
- environment variables
    
- SQL parameterization/ORM
    
- CORS configuration
    

---

## Reliability

Numerical calculations should be deterministic.

AI should receive structured data.

---

## Explainability

Every recommendation should show:

```text
Why recommended
Estimated reduction
Estimated cost
Estimated savings
Payback
Confidence/assumptions
```

---

# 7. Application Screens

Build approximately **8 core screens**.

```text
1. Login
2. Factory Setup
3. Data Input
4. Carbon Dashboard
5. Hotspot Analysis
6. Circular Recommendations
7. What-if Simulator
8. AI Copilot
9. Reports
```

---

# 8. App Flow

## Complete user journey

```text
LOGIN
  ↓
FACTORY SETUP
  ↓
ADD PROCESSES
  ↓
INPUT DATA
  ↓
CALCULATE EMISSIONS
  ↓
CARBON DASHBOARD
  ↓
HOTSPOT ANALYSIS
  ↓
AI ROOT-CAUSE ANALYSIS
  ↓
CIRCULAR RECOMMENDATIONS
  ↓
SELECT INTERVENTION
  ↓
WHAT-IF SIMULATION
  ↓
ACTION PLAN
  ↓
REPORT
```

---

# 9. Detailed Screen Flow

## Screen 1 — Login

```text
Email
Password

[Login]
```

Backend:

```text
POST /api/auth/login
```

Returns:

```json
{
  "accessToken": "...",
  "user": {
    "id": 1,
    "role": "FACTORY_OPERATOR"
  }
}
```

---

# 10. Screen 2 — Factory Setup

User enters:

```text
Factory Name
Industry
Location
Production Capacity
```

Then:

```text
Processes

+ Furnace
+ Boiler
+ Cutting
+ Assembly
```

---

# 11. Screen 3 — Data Input

Three tabs:

```text
Manual Input | CSV Upload | Simulation
```

Manual:

```text
Process: Furnace

Natural Gas: 300 m³
Electricity: 1,200 kWh
Production: 8 tonnes

[Calculate]
```

---

# 12. Screen 4 — Carbon Dashboard

Top cards:

```text
Total Emissions
1,250 tCO₂e

Production
10,000 tonnes

Emission Intensity
0.125 tCO₂e/tonne
```

Charts:

- emission by source
    
- emission by process
    
- historical emissions
    
- energy consumption
    

---

# 13. Screen 5 — Hotspot Analysis

Example:

```text
┌────────────────────────────┐
│ Furnace                    │
│                            │
│ 520 tCO₂e                  │
│ 47% of total emissions     │
│                            │
│ 🔴 HIGH PRIORITY           │
└────────────────────────────┘
```

Click:

```text
View AI Analysis
```

---

# 14. Screen 6 — Circular Recommendations

Cards:

```text
Waste Heat Recovery

Reduction: 12%
Cost: Medium
Payback: 2.4 years

Score: 91
```

and:

```text
Recycled Aluminum

Reduction: 15%
Cost: Medium

Score: 82
```

---

# 15. Screen 7 — What-if Simulator

Example:

```text
Recycled Material
0% ─────────●──── 100%

Furnace Efficiency
0% ───────●────── 30%
```

Result:

```text
CURRENT
1,250 tCO₂e

PROJECTED
980 tCO₂e

REDUCTION
270 tCO₂e
21.6%
```

---

# 16. Screen 8 — AI Copilot

Chat:

```text
User:
Why is my furnace the biggest emission source?

AI:
The furnace contributes 47% of estimated
emissions. Natural gas consumption is the
primary driver relative to production output.
```

---

# 17. Screen 9 — Report

```text
Carbon Assessment Report

Total emissions
Top hotspots
Root causes
Recommendations
Projected reductions
Financial impact
Methodology
```

Export PDF.

---

# 18. Technical Architecture

## High-Level Architecture

```text
                         ┌──────────────────┐
                         │   React + Vite   │
                         │   Web Frontend   │
                         └────────┬─────────┘
                                  │
                              HTTPS/REST
                                  │
                         ┌────────▼─────────┐
                         │ Node + Express   │
                         │    Backend       │
                         └─────┬──────┬─────┘
                               │      │
                         SQL   │      │ HTTP
                               │      │
                  ┌────────────▼─┐   ┌▼──────────────┐
                  │ PostgreSQL   │   │ Python        │
                  │              │   │ FastAPI       │
                  │ Factory Data │   │ AI Service    │
                  │ Activities   │   └───────┬───────┘
                  │ Emissions    │           │
                  │ Alternatives  │           ▼
                  └──────────────┘    ┌──────────────┐
                                      │  LangGraph   │
                                      │     Agent    │
                                      └──────┬───────┘
                                             │
                                             ▼
                                      ┌──────────────┐
                                      │ MCP Tools    │
                                      ├──────────────┤
                                      │ Carbon       │
                                      │ Hotspot      │
                                      │ Alternatives │
                                      │ Scenario     │
                                      │ Factory Data │
                                      └──────────────┘
```

---

# 19. Why Three Layers?

## React

Responsible only for:

```text
UI
UX
Charts
Forms
Interaction
```

---

## Express

Responsible for:

```text
Authentication
Authorization
CRUD
Database access
Business APIs
File upload
```

---

## Python AI Service

Responsible for:

```text
LLM
LangChain
LangGraph
MCP
AI orchestration
Reasoning
```

This keeps AI logic separate from your MERN backend.

---

# 20. Service-to-Service Flow

Example:

```text
User asks:

"How can I reduce furnace emissions?"
```

Flow:

```text
React
 ↓
POST /api/ai/copilot
 ↓
Express
 ↓
FastAPI
 ↓
LangGraph
 ↓
get_factory_data()
 ↓
calculate_emissions()
 ↓
identify_hotspots()
 ↓
find_circular_alternatives()
 ↓
calculate_scenario()
 ↓
LLM
 ↓
Structured response
 ↓
Express
 ↓
React
```

---

# 21. Database Design

Use PostgreSQL.

## Entity Relationship

```text
Organization
     │
     ├──────── Users
     │
     └──────── Factory
                  │
                  ├──── Processes
                  │         │
                  │         └──── Activities
                  │                    │
                  │                    └──── Emissions
                  │
                  ├──── Materials
                  │
                  ├──── Waste
                  │
                  ├──── Recommendations
                  │
                  └──── Scenarios
```

---

# 22. Users Table

```sql
users
-----
id
organization_id
name
email
password_hash
role
created_at
updated_at
```

Roles:

```text
ADMIN
FACTORY_OPERATOR
CONSULTANT
REGULATOR
```

---

# 23. Organizations

```sql
organizations
-------------
id
name
industry_type
created_at
updated_at
```

---

# 24. Factories

```sql
factories
---------
id
organization_id
name
location
production_capacity
production_unit
created_at
updated_at
```

Relationship:

```text
Organization 1 ─────── N Factories
```

---

# 25. Processes

```sql
processes
---------
id
factory_id
name
process_type
description
created_at
```

Example:

```text
Furnace
Boiler
Assembly
Cutting
Packaging
```

---

# 26. Activities

This is one of the most important tables.

```sql
activities
----------
id
process_id
activity_date
energy_type
quantity
unit
production_quantity
production_unit
source
created_at
```

Example:

```text
Furnace
Natural Gas
300
m³
8 tonnes
CSV
```

---

# 27. Emission Factors

```sql
emission_factors
----------------
id
category
source
fuel_type
unit
factor
region
year
reference
created_at
```

Example:

```text
Natural Gas
m³
factor
region
year
```

This allows you to update factors without changing code.

---

# 28. Emissions

```sql
emissions
---------
id
activity_id
emission_factor_id
co2e_value
co2e_unit
calculation_method
calculated_at
```

Calculation:

```text
activity.quantity
        ×
emission_factor.factor
        =
co2e_value
```

---

# 29. Materials

```sql
materials
---------
id
factory_id
name
category
material_type
quantity
unit
created_at
```

Example:

```text
Aluminum
Metal
Virgin
2,000 tonnes
```

---

# 30. Waste

```sql
waste
-----
id
factory_id
process_id
waste_type
quantity
unit
disposal_method
created_at
```

Example:

```text
Metal Scrap
350 tonnes
Landfill
```

---

# 31. Circular Alternatives

```sql
circular_alternatives
---------------------
id
category
current_option
alternative_option
description
reduction_percent
cost_level
implementation_difficulty
estimated_payback_years
circularity_score
created_at
```

Example:

```text
Current:
Virgin Aluminum

Alternative:
Recycled Aluminum
```

---

# 32. Recommendations

```sql
recommendations
---------------
id
factory_id
process_id
alternative_id
score
estimated_reduction
estimated_cost
estimated_savings
payback_period
reason
status
created_at
```

---

# 33. Scenarios

```sql
scenarios
---------
id
factory_id
name
description
baseline_emission
projected_emission
reduction_amount
reduction_percent
estimated_cost
estimated_savings
payback_period
created_at
```

---

# 34. AI Conversations

Optional but valuable:

```sql
ai_conversations
----------------
id
user_id
factory_id
created_at
```

```sql
ai_messages
-----------
id
conversation_id
role
content
tool_used
created_at
```

This allows the copilot to maintain conversation history.

---

# 35. Simulation Data

```sql
simulation_readings
-------------------
id
process_id
timestamp
temperature
energy_consumption
fuel_consumption
estimated_emission
status
```

Example:

```text
Furnace
820°C
1,350 kWh
315 m³
HIGH
```

This is explicitly **simulated data**, not physical sensor data.

---

# 36. Database Relationship Summary

```text
organizations
      │
      ├── users
      │
      └── factories
             │
             ├── processes
             │      │
             │      └── activities
             │               │
             │               └── emissions
             │
             ├── materials
             │
             ├── waste
             │
             ├── recommendations
             │
             ├── scenarios
             │
             └── simulation_readings
```

---

# 37. API Design

## Authentication

```http
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
```

---

## Factory

```http
POST /api/factories
GET /api/factories
GET /api/factories/:id
PUT /api/factories/:id
DELETE /api/factories/:id
```

---

## Processes

```http
POST /api/factories/:id/processes
GET /api/factories/:id/processes
```

---

## Activities

```http
POST /api/processes/:id/activities
GET /api/processes/:id/activities
POST /api/activities/upload
```

---

## Emissions

```http
POST /api/emissions/calculate
GET /api/factories/:id/emissions
GET /api/factories/:id/emissions/summary
```

---

## Hotspots

```http
GET /api/factories/:id/hotspots
GET /api/factories/:id/hotspots/:processId
```

---

## Recommendations

```http
GET /api/factories/:id/recommendations
POST /api/factories/:id/recommendations/generate
```

---

## Scenarios

```http
POST /api/factories/:id/scenarios
GET /api/factories/:id/scenarios
```

---

## AI

```http
POST /api/ai/analyze
POST /api/ai/copilot
POST /api/ai/recommend
POST /api/ai/scenario
```

---

# 38. TRD — Technical Requirements Document

# 38.1 Frontend Requirements

### Stack

```text
React
Vite
Tailwind
React Router
Axios
Recharts
```

### Components

```text
Navbar
Sidebar
DashboardCard
EmissionChart
HotspotCard
RecommendationCard
ScenarioSlider
ChatWindow
DataTable
FileUploader
```

---

# 39. Backend Requirements

### Stack

```text
Node.js
Express
PostgreSQL
Prisma / Sequelize
JWT
bcrypt
Multer
CSV parser
```

Responsibilities:

```text
Authentication
Database
CRUD
Validation
Business rules
File upload
AI proxy
```

---

# 40. AI Service Requirements

### Stack

```text
Python
FastAPI
LangChain
LangGraph
MCP
LLM SDK
Pydantic
```

---

# 41. LangGraph State

Create a shared state such as:

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

---

# 42. LangGraph Nodes

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

---

# 43. MCP Architecture

Your MCP server exposes tools.

## Tool 1

```text
get_factory_profile
```

Returns:

```json
{
  "factory": "...",
  "industry": "...",
  "production": 10000
}
```

---

## Tool 2

```text
calculate_emissions
```

Input:

```json
{
  "activity": "natural_gas",
  "quantity": 300
}
```

Returns deterministic calculation.

---

## Tool 3

```text
identify_hotspots
```

Returns:

```json
[
  {
    "process": "Furnace",
    "emission": 520,
    "percentage": 47
  }
]
```

---

## Tool 4

```text
find_circular_alternatives
```

Returns alternatives based on:

```text
process
material
waste
energy
```

---

## Tool 5

```text
calculate_scenario
```

Returns:

```text
baseline
projected
reduction
percentage
cost
savings
payback
```

---

## Tool 6

```text
rank_interventions
```

Ranks possible actions.

---

## Tool 7

```text
generate_action_plan
```

Produces structured implementation steps.

---

# 44. AI vs Normal Backend

This distinction is **very important for your technical presentation**.

## Backend should do:

```text
Authentication
CRUD
SQL
Emission arithmetic
Validation
Scoring
Scenario mathematical calculations
```

## AI should do:

```text
Interpret user intent
Explain hotspots
Reason over structured data
Find relevant alternatives
Generate recommendations
Generate action plans
Answer natural-language questions
```

### Never do this:

```text
LLM:
"10,000 × 0.7 = probably 6,500"
```

Instead:

```text
LLM
 ↓
calls calculate_emissions()
 ↓
backend/tool calculates 7,000
 ↓
LLM explains 7,000
```

This is both technically stronger and easier to defend to judges.

---

# 45. AI Recommendation Pipeline

```text
Factory Data
     ↓
Emission Engine
     ↓
Hotspot
     ↓
Context Builder
     ↓
Circular Knowledge Retrieval
     ↓
Candidate Alternatives
     ↓
Impact Calculator
     ↓
Recommendation Scorer
     ↓
LLM Explanation
     ↓
Final Recommendation
```

---

# 46. Circular Knowledge Base

For the hackathon, don't build a huge RAG system.

Create a structured dataset:

```text
alternatives.json
```

or PostgreSQL table.

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

Later this can become a full RAG system.

---

# 47. Emission Hotspot Algorithm

Pseudo-flow:

```text
for each activity:

    factor = find_emission_factor(activity)

    emission =
        activity.quantity × factor

    store emission
```

Then:

```text
group emissions by process

sort descending

total = sum(all emissions)

percentage =
process_emission / total × 100
```

Then assign severity.

This does **not require ML**.

---

# 48. Anomaly Detection Without ML

You can add an interesting "potential leak" feature without training ML.

Calculate emission intensity:

```text
Emission Intensity =
CO₂e / Production Quantity
```

Example:

```text
Normal:
0.10 tCO₂e / tonne

Current:
0.18 tCO₂e / tonne
```

System says:

> **Potential abnormal emission intensity detected.**

For historical data:

```text
7-day average
      ↓
Current value
      ↓
Deviation
```

If deviation exceeds a configured threshold:

```text
🟠 Investigation Required
```

This provides a credible software interpretation of "leak-point detection."

---

# 49. Simulated Sensor Architecture

Your future architecture can be:

```text
                    FUTURE
                      │
                IoT Sensors
                      │
                    MQTT
                      │
                Data Gateway
                      │
                      ▼
                PostgreSQL
```

For hackathon:

```text
                 Simulator
                     │
                     ▼
               REST/WebSocket
                     │
                     ▼
                PostgreSQL
```

Same downstream system.

---

# 50. Project Folder Structure

## Frontend

```text
frontend/
├── src/
│   ├── components/
│   ├── pages/
│   ├── layouts/
│   ├── hooks/
│   ├── services/
│   ├── context/
│   ├── charts/
│   └── utils/
├── public/
└── package.json
```

---

# 51. Backend

```text
backend/
├── src/
│   ├── controllers/
│   ├── routes/
│   ├── services/
│   ├── middleware/
│   ├── models/
│   ├── utils/
│   ├── validators/
│   └── config/
├── prisma/
│   └── schema.prisma
└── package.json
```

---

# 52. AI Service

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

---

# 53. Phase-Wise Implementation Plan

# Phase 0 — Architecture

### Duration: 1–2 hours

All 3 developers.

Finalize:

```text
Database schema
API contracts
UI screens
AI workflow
Git repository
Environment setup
```

Deliverable:

```text
Architecture diagram
ER diagram
API specification
```

---

# Phase 1 — Foundation

### Hours 2–5

### Developer 1

React:

```text
Vite
Tailwind
Routing
Layout
Sidebar
Dashboard skeleton
```

### Developer 2

Backend:

```text
Express
PostgreSQL
Prisma
JWT
User model
Factory model
```

### You

AI:

```text
Python
FastAPI
LLM connection
LangChain
LangGraph skeleton
```

---

# Phase 2 — Factory Data

### Hours 5–9

### Developer 1

Build:

```text
Factory Setup
Data Input
CSV Upload UI
```

### Developer 2

Build:

```text
Factory APIs
Process APIs
Activity APIs
CSV parser
```

### You

Build:

```text
Carbon calculator
Emission-factor retrieval
MCP calculate_emissions tool
```

---

# Phase 3 — Carbon Intelligence

### Hours 9–13

Backend:

```text
Emission persistence
Aggregation
Dashboard APIs
```

Frontend:

```text
Carbon dashboard
Charts
Emission breakdown
```

AI:

```text
Hotspot tool
Hotspot analysis
LangGraph routing
```

At this point you have:

```text
Input
 ↓
Emission
 ↓
Hotspot
```

This should already be demoable.

---

# Phase 4 — Circular Intelligence

### Hours 13–17

Backend:

```text
Alternative database
Recommendation API
```

Frontend:

```text
Recommendation cards
```

AI:

```text
find_circular_alternatives
rank_interventions
recommendation generation
```

Result:

```text
Hotspot
 ↓
Alternative
 ↓
Impact
 ↓
Score
```

---

# Phase 5 — What-if Engine

### Hours 17–20

Backend:

```text
Scenario calculation
```

Frontend:

```text
Sliders
Comparison
Charts
```

AI:

```text
calculate_scenario
scenario explanation
```

---

# Phase 6 — AI Copilot

### Hours 20–23

Build:

```text
Chat UI
 ↓
Express
 ↓
FastAPI
 ↓
LangGraph
 ↓
MCP
```

Test questions:

```text
Why is my furnace a hotspot?

What should I fix first?

Which intervention has the best ROI?

What happens if I use 30% recycled material?
```

---

# Phase 7 — Integration

### Hours 23–26

Full test:

```text
Login
 ↓
Factory
 ↓
Data
 ↓
Emission
 ↓
Hotspot
 ↓
Recommendation
 ↓
Scenario
 ↓
AI
 ↓
Report
```

Fix:

- API issues
    
- CORS
    
- auth
    
- database errors
    
- AI timeouts
    
- loading states
    

---

# Phase 8 — Demo & Deployment

### Final hours

Deploy:

```text
Frontend
Backend
AI Service
PostgreSQL
```

Prepare:

```text
Demo account
Demo factory
Demo CSV
Demo scenario
Presentation
Architecture diagram
```

---

# 54. Team Responsibility Matrix

|Module|Dev 1|Dev 2|You|
|---|---|---|---|
|React|⭐|||
|UI/UX|⭐|||
|Charts|⭐|||
|Express||⭐||
|PostgreSQL||⭐||
|Auth||⭐||
|CSV||⭐||
|Carbon Engine||⭐|⭐|
|FastAPI|||⭐|
|LangChain|||⭐|
|LangGraph|||⭐|
|MCP|||⭐|
|AI Copilot|||⭐|
|Scenario UI|⭐||⭐|
|Scenario API||⭐|⭐|
|Integration|⭐|⭐|⭐|
|Demo|⭐|⭐|⭐|

---

# 55. Git Strategy

Use:

```text
main
develop
```

Individual branches:

```text
feature/frontend-dashboard
feature/backend-emissions
feature/ai-langgraph
```

Every feature:

```text
branch
 ↓
commit
 ↓
pull request
 ↓
merge develop
```

Avoid directly modifying each other's files.

---

# 56. MVP Definition

If time becomes short, your **absolute MVP** is:

```text
Factory
 ↓
Input CSV
 ↓
Calculate CO₂
 ↓
Dashboard
 ↓
Hotspot
 ↓
AI recommendation
 ↓
What-if
```

You can remove:

```text
Complex roles
Real-time simulation
Advanced reports
Fancy animations
Advanced RAG
```

but **do not remove hotspot + recommendation + what-if**, because these are the core differentiation.

---

# 57. Hackathon Demo Dataset

Create one fictional but realistic factory:

## ABC Metal Manufacturing

```text
Industry:
Metal Components

Production:
10,000 tonnes/year
```

Input:

```text
Electricity       850,000 kWh
Natural Gas       300,000 m³
Diesel             40,000 L
Virgin Aluminum   2,000 tonnes
Waste               350 tonnes
```

Expected dashboard:

```text
Total:
1,250 tCO₂e
```

Hotspots:

```text
Furnace        520 tCO₂e   47%
Electricity    250 tCO₂e   22%
Boiler         180 tCO₂e   16%
Transport       80 tCO₂e    7%
Waste           70 tCO₂e    8%
```

---

# 58. Killer Demo Scenario

Start with:

> "This factory knows its total emissions, but it doesn't know what to fix."

Upload CSV.

Dashboard:

```text
1,250 tCO₂e
```

Then:

> **Furnace = 47%**

Ask:

> "Why?"

Agent:

```text
LangGraph
   ↓
MCP
   ↓
Factory Data
   ↓
Carbon Calculator
   ↓
Hotspot Analysis
```

AI explains.

Then:

> "What should I do?"

AI:

```text
1. Waste Heat Recovery
2. Furnace Efficiency
3. Recycled Material
```

Then:

> "What if I implement #1 + 30% recycled material?"

System:

```text
1,250 → 980 tCO₂e

Reduction:
270 tCO₂e

≈21.6%
```

Then show:

```text
                 AI AGENT
                    │
                 LangGraph
                    │
                    ▼
                   MCP
          ┌─────────┼─────────┐
          ↓         ↓         ↓
       Carbon    Hotspot   Circular
       Tool       Tool      Tool
          │         │         │
          └─────────┼─────────┘
                    ↓
                Scenario
                 Engine
```

That gives judges a clear story:

> **Data → Intelligence → Action → Simulation → Impact**

---

# 59. What Is AI Actually Doing?

This question will almost certainly come from judges.

Answer:

> "The deterministic backend calculates emissions and financial metrics. Our agentic AI layer interprets the factory context, identifies what information it needs, invokes specialized MCP tools, reasons over the results, ranks possible interventions, explains the hotspot, and generates an actionable sustainability plan."

That is much stronger than saying:

> "We send data to ChatGPT."

---

# 60. What Is Agentic About It?

A normal chatbot:

```text
User
 ↓
LLM
 ↓
Answer
```

Your system:

```text
User
 ↓
Agent
 ↓
Determine intent
 ↓
Get factory data
 ↓
Calculate emissions
 ↓
Detect hotspot
 ↓
Find alternatives
 ↓
Calculate impact
 ↓
Rank options
 ↓
Generate recommendation
```

The agent chooses the required tools and follows a multi-step workflow.

---

# 61. What Is MCP Doing?

Answer:

> "MCP provides a standardized tool interface through which our AI agent can access sustainability capabilities such as emission calculation, factory data retrieval, hotspot analysis, circular alternative search, and scenario simulation."

So:

```text
LLM ≠ Database
LLM ≠ Calculator

LLM
 ↓
MCP
 ↓
Tools
```

---

# 62. What Is the Innovation?

The innovation isn't simply AI.

It is the combination of:

```text
Industrial Data
      +
Deterministic Carbon Engine
      +
Hotspot Detection
      +
Agentic AI
      +
MCP Tools
      +
Circular Alternatives
      +
Financial Analysis
      +
What-if Simulation
```

Most importantly:

> **The system connects carbon accounting to an actual decision.**

---

# 63. Final System Architecture

```text
                         USER
                           │
                           ▼
                  ┌─────────────────┐
                  │ React Dashboard │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ Express Backend │
                  └──────┬─────┬────┘
                         │     │
                         │     │
                         ▼     ▼
                  ┌────────┐  ┌──────────────┐
                  │Postgres│  │ Python AI    │
                  │        │  │ FastAPI      │
                  └────────┘  └──────┬───────┘
                                     │
                                     ▼
                              ┌─────────────┐
                              │ LangGraph   │
                              │ Agent       │
                              └──────┬──────┘
                                     │
                                     ▼
                                ┌─────────┐
                                │   MCP   │
                                └────┬────┘
                                     │
              ┌──────────────────────┼─────────────────────┐
              │                      │                     │
              ▼                      ▼                     ▼
       Carbon Calculator       Hotspot Tool       Circular Tool
              │                      │                     │
              └──────────────────────┼─────────────────────┘
                                     │
                                     ▼
                              Scenario Engine
                                     │
                                     ▼
                              AI Recommendation
                                     │
                                     ▼
                              Actionable Output
```

---

# 64. Final Project Scope

Your complete project can therefore be summarized as:

```text
                    ECOTrace AI
          AI-Powered Circular Carbon Intelligence
                         │
       ┌─────────────────┼─────────────────┐
       │                 │                 │
       ▼                 ▼                 ▼
   MEASURE             LOCATE            EXPLAIN
       │                 │                 │
       ▼                 ▼                 ▼
 Operational         Emission           AI Root
 Data                Hotspots           Cause
       │                 │                 │
       └─────────────────┼─────────────────┘
                         ▼
                    RECOMMEND
                         │
                         ▼
                 Circular Alternatives
                         │
                         ▼
                    SIMULATE
                         │
                         ▼
                 Cost + CO₂ Impact
                         │
                         ▼
                      ACT
                         │
                         ▼
                 Carbon Reduction
```

