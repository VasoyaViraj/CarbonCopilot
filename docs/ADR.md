# EcoTrace AI — Architecture Decision Records (ADR)

## ADR-001 — Separate AI Service from Express

### Status
Accepted.

### Decision
Use:
- Node/Express for application/business APIs.
- Python/FastAPI for AI orchestration.

### Reason
The team has MERN/PostgreSQL and agentic-AI expertise, and separating concerns makes the architecture easier to explain and evolve.

### Consequences
Positive:
- Independent AI development.
- Clean service boundary.
- Easier LangGraph/MCP implementation.

Negative:
- Two backend services.
- Additional local/deployment configuration.

---

## ADR-002 — Use PostgreSQL as Source of Truth

### Status
Accepted.

### Decision
Persist factory, activity, emission, recommendation, scenario, and AI context data in PostgreSQL.

### Reason
The domain is relational and requires aggregation, filtering, historical data, and clear relationships.

---

## ADR-003 — Deterministic Carbon Calculations

### Status
Accepted.

### Decision
Emission arithmetic is implemented as deterministic application/tool logic.

### Reason
LLMs are probabilistic and should not be authoritative calculators.

### Consequence
Results are reproducible and easier to audit.

---

## ADR-004 — Use LangGraph for Agent Orchestration

### Status
Accepted.

### Decision
Use a graph/state-machine approach for multi-step AI workflows.

### Reason
The workflow naturally contains:
- Intent routing.
- Data retrieval.
- Calculation.
- Hotspot detection.
- Alternative discovery.
- Impact calculation.
- Ranking.
- Response generation.

---

## ADR-005 — Use MCP for Sustainability Tools

### Status
Accepted.

### Decision
Expose bounded capabilities through MCP tools.

### Reason
It provides a clear interface between agent reasoning and application capabilities.

---

## ADR-006 — No Physical Sensor Dependency in Hackathon MVP

### Status
Accepted.

### Decision
Support manual, CSV, and simulated data.

### Reason
The team does not have physical sensors during the hackathon.

### Consequence
The product must explicitly communicate that readings are estimated/simulated where applicable.

---

## ADR-007 — Structured Circular Knowledge Base Instead of Full RAG

### Status
Accepted for MVP.

### Decision
Store circular alternatives in PostgreSQL or a structured dataset.

### Reason
A huge RAG pipeline is unnecessary for the hackathon. Structured retrieval is simpler, deterministic, and sufficient to demonstrate the recommendation workflow.

### Future
Expand into a richer knowledge/RAG layer if needed.

---

## ADR-008 — Scenario Calculations Are Isolated

### Status
Accepted.

### Decision
What-if calculations create scenario outputs without modifying baseline records.

### Reason
Users need to compare alternatives safely.

---

## ADR-009 — Sensor-Ready Ingestion Boundary

### Status
Accepted.

### Decision
Treat ingestion as an interchangeable boundary.

Hackathon:
```text
Simulator/CSV/Manual → API → DB
```

Future:
```text
IoT → MQTT/Gateway → DB/Stream
```

### Reason
The core hotspot and decision logic should survive a future input-source change.
