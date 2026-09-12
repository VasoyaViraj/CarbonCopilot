# EcoTrace AI — System Architecture

## 1. Architectural Principle

The most important design decision is:

> We do not pretend to perform physical sensor-based leak detection during the hackathon.

The MVP performs software-based emission hotspot/abnormality detection using:
- Manual input.
- CSV data.
- Simulated sensor streams.

The architecture remains sensor-ready.

## 2. High-Level Architecture

```text
                         USER
                           │
                           ▼
                  ┌─────────────────┐
                  │ React Dashboard │
                  └────────┬────────┘
                           │ HTTPS/REST
                           ▼
                  ┌─────────────────┐
                  │ Express Backend │
                  └──────┬─────┬────┘
                         │     │
                         │     ▼
                         │  FastAPI AI
                         │      │
                         │      ▼
                         │  LangGraph
                         │      │
                         │      ▼
                         │     MCP
                         │      │
                         │  ┌───┼────┐
                         │  ▼   ▼    ▼
                         │ Carbon Hotspot Circular
                         │  Tool   Tool    Tool
                         │      │
                         │      ▼
                         │  Scenario Engine
                         │
                         ▼
                    PostgreSQL
```

## 3. Data Flow

```text
Manual / CSV / Simulator
          ↓
     Data Ingestion
          ↓
       Activities
          ↓
   Emission Factor Lookup
          ↓
   Deterministic Calculator
          ↓
       Emissions
          ↓
    Process Aggregation
          ↓
       Hotspots
          ↓
   Circular Alternatives
          ↓
     Impact Calculator
          ↓
 Recommendation Ranking
          ↓
       AI Explanation
```

## 4. Why Three Layers?

### React
Only presentation and interaction:
- Forms.
- Charts.
- Navigation.
- Tables.
- Chat.
- Scenario controls.

### Express
System-of-record and business API:
- Auth.
- CRUD.
- Validation.
- PostgreSQL.
- File ingestion.
- Deterministic business logic.

### Python AI Service
AI orchestration:
- LangChain.
- LangGraph.
- MCP.
- LLM.
- Natural-language reasoning.

## 5. Sensor-Ready Architecture

Hackathon:

```text
Simulator
   ↓
REST/WebSocket
   ↓
PostgreSQL
   ↓
Existing Hotspot Engine
```

Future:

```text
IoT Sensors
   ↓
MQTT
   ↓
Data Gateway
   ↓
PostgreSQL / Stream
   ↓
Existing Hotspot Engine
```

The downstream calculation and decision layers remain reusable.

## 6. AI Request Flow

Example: "How can I reduce furnace emissions?"

```text
React
 ↓
POST /api/ai/copilot
 ↓
Express authorization
 ↓
FastAPI
 ↓
LangGraph
 ↓
get_factory_profile
 ↓
calculate_emissions
 ↓
identify_hotspots
 ↓
find_circular_alternatives
 ↓
calculate_scenario
 ↓
rank_interventions
 ↓
LLM explanation
 ↓
Structured response
 ↓
React
```

## 7. Frontend Module Architecture

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

## 8. Backend Module Architecture

```text
src/
├── controllers/
├── routes/
├── services/
├── middleware/
├── models/
├── utils/
├── validators/
└── config/
```

## 9. AI Service Architecture

```text
app/
├── main.py
├── agents/
│   ├── graph.py
│   ├── state.py
│   └── nodes.py
├── mcp/
│   ├── server.py
│   └── tools/
├── services/
├── prompts/
└── schemas/
```

## 10. Architectural Invariants

1. Database remains the source of truth.
2. Backend owns deterministic calculations.
3. AI cannot directly invent factory facts.
4. MCP tools expose bounded capabilities.
5. Scenario calculations do not overwrite baseline results.
6. Simulated data is explicitly labelled.
