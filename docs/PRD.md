# EcoTrace AI — Product Requirements Document (PRD)

## 1. Product Overview

**Product:** EcoTrace AI / CarbonLoop  
**Problem:** SMEs can calculate aggregate emissions but often cannot identify the process-level hotspots, understand likely causes, compare circular interventions, or estimate financial impact.

EcoTrace AI converts operational/process data into a decision workflow:

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
Action Plan / Report
```

The hackathon MVP does **not** claim physical sensor-based leak detection. It uses manual data, CSV data, and simulated readings, while keeping the downstream architecture sensor-ready.

## 2. Product Vision

> Help SMEs discover where their carbon emissions come from and determine the most economically viable circular action to reduce them.

## 3. Target Users

### Factory Operator
- Create/manage a factory.
- Enter or upload operational data.
- View emission totals and hotspots.
- Understand recommended actions.

### Sustainability Consultant
- Inspect detailed emission analysis.
- Compare interventions.
- Run scenarios.
- Generate reports.

### Regulator / Auditor
- Review historical emissions.
- Inspect methodology and assumptions.
- Review generated reports.

### Admin
- Manage users, emission factors, circular alternatives, and configuration.

## 4. MVP Scope

### Must Have
1. Authentication.
2. Factory and process setup.
3. Manual operational data input.
4. CSV upload.
5. Deterministic emission calculation.
6. Carbon dashboard.
7. Process-level hotspot detection.
8. AI root-cause explanation.
9. Circular recommendation ranking.
10. What-if simulation.
11. AI Copilot.
12. Basic report generation.

### Can Defer
- Real IoT integration.
- Advanced ML anomaly detection.
- Large-scale RAG.
- Complex multi-tenant enterprise administration.
- Real-time sensor streaming.
- Advanced report customization.

## 5. Functional Requirements

### FR-01 Authentication
- Registration/login.
- JWT authentication.
- Role-based authorization.
- `/api/auth/me`.

### FR-02 Factory Management
- Create/update/list factory.
- Add processes.
- Define industry and production capacity.

### FR-03 Data Input
Supported modes:
- Manual.
- CSV.
- Simulation.

CSV minimum fields:

```text
date, process, energy, fuel, material, production, waste
```

### FR-04 Emission Calculation
Use:

```text
CO2e = Activity Quantity × Emission Factor
```

The calculation engine must be deterministic. The LLM must never be the source of numerical arithmetic.

### FR-05 Hotspot Detection
- Group emissions by process.
- Calculate total and contribution percentage.
- Rank processes.
- Assign severity.

Default severity:
- `>40%`: CRITICAL
- `25–40%`: HIGH
- `10–25%`: MEDIUM
- `<10%`: LOW

Thresholds are configurable.

### FR-06 AI Root Cause Analysis
The AI explains:
- Why a process is a hotspot.
- Which activity is the major driver.
- Which contributing factors deserve investigation.
- What additional information could improve confidence.

### FR-07 Circular Recommendations
Potential intervention classes:
- Alternative materials.
- Recycling.
- Reuse.
- Waste recovery.
- Process optimization.
- Energy efficiency.
- Fuel substitution.

### FR-08 Recommendation Ranking

Default weighted score:

```text
Environmental Impact  40%
Financial Benefit     25%
Feasibility           20%
Circularity           15%
```

### FR-09 What-if Simulation
Inputs may include:
- Recycled material percentage.
- Energy-efficiency improvement.
- Fuel replacement percentage.
- Waste recovery percentage.

Outputs:
- Baseline emissions.
- Projected emissions.
- Absolute reduction.
- Percentage reduction.
- Estimated cost.
- Estimated savings.
- Payback.

### FR-10 AI Copilot
Example queries:
- Why is my furnace a hotspot?
- What should I fix first?
- Which intervention has the best ROI?
- What happens if I use 30% recycled material?

The agent retrieves relevant factory data and invokes tools before answering.

### FR-11 Reports
Report sections:
- Factory summary.
- Emission summary.
- Hotspots.
- Root causes.
- Recommendations.
- Projected reductions.
- Financial impact.
- Methodology/assumptions.

## 6. Core Screens

1. Login.
2. Factory Setup.
3. Data Input.
4. Carbon Dashboard.
5. Hotspot Analysis.
6. Circular Recommendations.
7. What-if Simulator.
8. AI Copilot.
9. Reports.

## 7. Success Criteria

A successful hackathon demo should demonstrate:

```text
CSV upload
  ↓
Emission calculation
  ↓
Furnace identified as hotspot
  ↓
AI explains why
  ↓
Circular actions ranked
  ↓
Scenario changes emissions
  ↓
Actionable recommendation
```

## 8. Product Constraints

- No physical hardware during hackathon.
- Simulated readings must be clearly labelled as simulated.
- Numerical results must come from deterministic code.
- AI responses should expose assumptions and confidence where appropriate.
- Architecture must allow future sensor ingestion without rewriting core business logic.
