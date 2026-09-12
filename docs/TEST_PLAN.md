# EcoTrace AI — Test Plan

## 1. Testing Goals

Verify:
- Correctness of deterministic calculations.
- Authorization boundaries.
- Data validation.
- API contracts.
- Hotspot ranking.
- Scenario calculations.
- AI tool grounding.
- End-to-end demo workflow.

## 2. Unit Tests

### Emission Calculator

Input:
```text
quantity = 100
factor = 0.7
```

Expected:
```text
70
```

Test:
- Normal values.
- Zero.
- Decimal values.
- Invalid/negative values.
- Missing factor.

### Hotspot Engine

Given:
```text
Furnace = 520
Electricity = 250
Boiler = 180
Transport = 80
Waste = 70
```

Verify:
- Total.
- Percentages.
- Descending order.
- Severity.

### Scenario Engine

Given:
```text
baseline = 1250
projected = 980
```

Expected:
```text
reduction = 270
reduction_percent = 21.6
```

## 3. API Tests

### Auth
- Register success.
- Duplicate email.
- Login success.
- Wrong password.
- Missing token.
- Expired token.

### Factory
- Create.
- List.
- Get.
- Update.
- Delete.
- Unauthorized access.

### Activities
- Valid manual input.
- Invalid quantity.
- Unknown process.
- CSV success.
- CSV malformed row.

### Emissions
- Calculation endpoint.
- Summary endpoint.
- Correct persistence.

### Recommendations
- List.
- Generate.
- Invalid alternative.

### Scenarios
- Valid scenario.
- Zero baseline.
- Negative percentage.
- Percentage over 100.
- Baseline immutability.

## 4. AI Tests

### Tool Grounding
Question:
> Why is my furnace the biggest emission source?

Verify the agent calls appropriate factory/emission/hotspot tools.

### No Fabrication
Remove furnace data and ask about furnace.
Expected:
- Agent states that the required data is unavailable rather than inventing values.

### Numerical Grounding
Ask:
> What is my total emission?

Verify the number comes from tool/backend output.

### Recommendation
Ask:
> What should I fix first?

Verify:
- Candidate alternatives are retrieved.
- Ranking is reproducible.
- Explanation matches tool output.

### Scenario
Ask:
> What happens if I use 30% recycled material?

Verify the scenario engine is called.

## 5. Security Tests

- SQL injection payloads.
- JWT tampering.
- Cross-organization factory access.
- Malicious CSV.
- Oversized upload.
- Invalid file extension.
- Unauthorized admin operation.

## 6. Frontend Tests

Verify:
- Login redirect.
- Protected routes.
- Loading states.
- Empty states.
- Error states.
- Chart rendering.
- CSV upload feedback.
- Scenario slider updates.
- Chat streaming/loading state.
- Report export.

## 7. Integration Test

Full path:

```text
Login
 ↓
Factory
 ↓
Process
 ↓
CSV
 ↓
Activities
 ↓
Emission Calculation
 ↓
Dashboard
 ↓
Hotspot
 ↓
AI Analysis
 ↓
Recommendation
 ↓
Scenario
 ↓
Report
```

## 8. Hackathon Smoke Test

Before presentation:
- Backend starts.
- AI service starts.
- Database reachable.
- Demo account works.
- Demo factory exists.
- Demo CSV works.
- Emission summary loads.
- Furnace hotspot appears.
- AI tool calls succeed.
- Recommendation appears.
- Scenario result is calculated.
- Report opens/exports.

## 9. Acceptance Criteria

The MVP is considered ready when the killer demo works from a clean session without manual database intervention.
