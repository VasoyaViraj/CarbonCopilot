# EcoTrace AI — Hackathon Demo Script

## 1. Demo Story

Opening:

> "A factory may know its total carbon footprint, but knowing the number is not the same as knowing what to fix. EcoTrace AI connects carbon measurement to an actual operational decision."

## 2. Demo Factory

**ABC Metal Manufacturing**

```text
Industry: Metal Components
Production: 10,000 tonnes/year

Electricity:       850,000 kWh
Natural Gas:       300,000 m3
Diesel:             40,000 L
Virgin Aluminum:   2,000 tonnes
Waste:               350 tonnes
```

Use a clearly labelled fictional/demo dataset.

## 3. Step 1 — Login

Show:
- Login.
- Factory dashboard.

Say:

> "The operator enters a factory workspace where operational data and analysis are kept together."

## 4. Step 2 — Upload CSV

Open Data Input.

Show:
```text
Manual Input | CSV Upload | Simulation
```

Upload demo CSV.

Say:

> "Because we do not have physical sensors at the hackathon, our ingestion layer supports manual, CSV, and simulated readings. The downstream engine is sensor-ready."

## 5. Step 3 — Carbon Dashboard

Show:
```text
Total Emissions
1,250 tCO2e
```

Show:
- Emission by source.
- Emission by process.
- Production.
- Emission intensity.

Say:

> "The first layer measures the footprint."

## 6. Step 4 — Hotspot

Show:
```text
Furnace
520 tCO2e
47%
CRITICAL / HIGH PRIORITY
```

Say:

> "Instead of stopping at total emissions, the platform locates the largest process-level hotspot."

## 7. Step 5 — Ask AI Why

Ask:

> "Why is my furnace the biggest emission source?"

The agent should:
```text
LangGraph
 ↓
MCP
 ↓
Factory Data
 ↓
Emission Calculator
 ↓
Hotspot Tool
 ↓
LLM explanation
```

Say:

> "The LLM is not calculating the emissions. It is orchestrating tools, interpreting the structured results, and explaining them."

## 8. Step 6 — Recommendations

Ask:

> "What should I fix first?"

Expected ranked options:
1. Waste Heat Recovery.
2. Furnace Efficiency.
3. Recycled Material.

Show:
- Score.
- Reduction.
- Cost.
- Savings.
- Payback.

## 9. Step 7 — What-if

Ask:

> "What if I implement waste heat recovery and use 30% recycled material?"

Show:

```text
1,250 → 980 tCO2e

Reduction:
270 tCO2e
≈21.6%
```

Important: the displayed values must be produced by the actual implemented scenario engine, not hardcoded solely for the presentation.

## 10. Step 8 — Action Plan

Show:
- Priority.
- Suggested investigation.
- Intervention.
- Expected impact.
- Assumptions.

## 11. Step 9 — Report

Show:
- Summary.
- Hotspots.
- Recommendations.
- Scenario.
- Methodology.

## 12. Judge Explanation — What Is AI Doing?

> "The deterministic backend calculates emissions and financial metrics. Our agentic AI layer interprets the factory context, identifies what information it needs, invokes specialized MCP tools, reasons over the results, ranks possible interventions, explains the hotspot, and generates an actionable sustainability plan."

## 13. Judge Explanation — What Is Agentic?

Normal chatbot:

```text
User → LLM → Answer
```

EcoTrace:

```text
User
 ↓
Agent
 ↓
Intent
 ↓
Factory data
 ↓
Emission calculation
 ↓
Hotspot detection
 ↓
Alternatives
 ↓
Impact
 ↓
Ranking
 ↓
Action plan
```

## 14. Judge Explanation — What Is MCP?

> "MCP provides a standardized tool interface through which our AI agent accesses capabilities such as factory data retrieval, emission calculation, hotspot analysis, circular alternative search, and scenario simulation."

## 15. Closing

> "Our innovation is not simply putting a chatbot on carbon data. We connect operational data to deterministic carbon accounting, hotspot detection, circular alternatives, financial analysis, agentic orchestration, and what-if simulation — turning carbon accounting into a decision system."

Final visual:

```text
DATA
  ↓
INTELLIGENCE
  ↓
ACTION
  ↓
SIMULATION
  ↓
IMPACT
```
