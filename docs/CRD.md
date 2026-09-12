# EcoTrace AI — Customer / Concept Requirements Document (CRD)

> **Purpose:** Translate the project problem into customer-facing requirements and measurable outcomes. Where the source project document does not define a formal CRD, this document organizes the supplied product requirements into customer needs.

## 1. Customer Problem

SMEs typically possess operational information such as electricity, fuel, raw-material usage, production quantity, and waste generation, but struggle to answer:

1. Where are emissions actually coming from?
2. Which process should be investigated first?
3. Why is that process producing a large footprint?
4. What circular alternative is practical?
5. How much CO2e could be reduced?
6. What would the intervention cost?
7. How quickly could it pay back?
8. What happens under different intervention assumptions?

## 2. Customer Outcomes

### Outcome A — Visibility
The customer can see total estimated emissions and their breakdown by source/process.

### Outcome B — Prioritization
The customer receives a ranked list of emission hotspots rather than an unexplained aggregate number.

### Outcome C — Explanation
The customer receives an AI-generated explanation grounded in actual factory data.

### Outcome D — Action
The customer receives ranked circular interventions with environmental and financial context.

### Outcome E — Decision Support
The customer can change assumptions in a scenario and compare baseline vs projected impact.

## 3. User Stories

### Factory Operator
- As an operator, I want to upload factory data so that I can avoid entering every reading manually.
- As an operator, I want to see my biggest emission source so that I know where to focus.
- As an operator, I want a plain-language explanation so that the result is understandable.
- As an operator, I want recommended actions so that I know what to investigate next.

### Sustainability Consultant
- As a consultant, I want process-level analysis so that I can prioritize interventions.
- As a consultant, I want recommendation scores so that alternatives can be compared.
- As a consultant, I want scenario simulation so that I can discuss options with management.
- As a consultant, I want a report so that findings can be shared.

### Regulator / Auditor
- As an auditor, I want transparent calculation methodology so that results can be reviewed.
- As an auditor, I want historical data so that changes can be assessed over time.

### Admin
- As an admin, I want configurable emission factors so that calculations can evolve without code changes.
- As an admin, I want to manage circular alternatives so that the recommendation catalog remains useful.

## 4. Customer Journey

```text
Discover
  ↓
Create Factory
  ↓
Provide Data
  ↓
Measure
  ↓
Locate Hotspot
  ↓
Understand Cause
  ↓
Explore Alternatives
  ↓
Simulate
  ↓
Select Action
  ↓
Generate Report
```

## 5. Customer Trust Requirements

The product must clearly distinguish:
- Measured vs simulated data.
- Deterministic calculations vs AI-generated explanations.
- Known values vs estimates.
- Actual historical results vs scenario projections.
- Source/reference information for emission factors where available.

## 6. Acceptance Criteria

A feature is accepted when:
- It produces a usable UI outcome.
- Its API contract is validated.
- Database persistence works.
- Numerical outputs are deterministic.
- Errors are handled visibly.
- AI responses are grounded in tool-returned data.

## 7. Non-Goals

The MVP is not:
- A physical gas/smoke sensor.
- A certified regulatory emissions measurement instrument.
- A replacement for industrial safety systems.
- A fully autonomous plant-control system.
- A trained industrial ML anomaly detector.
