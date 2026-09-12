# EcoTrace AI — Agent Architecture

## 1. Agent Purpose

The AI layer is an agentic decision-support system, not a generic chatbot.

Its responsibility is to:
- Interpret user intent.
- Retrieve relevant factory context.
- Invoke deterministic tools.
- Reason over structured results.
- Rank candidate interventions.
- Explain results.
- Produce actionable plans.

## 2. Agent State

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

## 3. Core Graph

```text
START
  ↓
Intent Router
  ↓
Load Factory Data
  ↓
Calculate Emissions
  ↓
Detect Hotspots
  ↓
Find Alternatives
  ↓
Calculate Impact
  ↓
Rank Recommendations
  ↓
Generate Response
  ↓
END
```

## 4. Agent Nodes

### intent_router
Classifies the request into categories such as:
- Dashboard/information.
- Hotspot explanation.
- Recommendation.
- Scenario.
- Action plan.

### load_factory_data
Retrieves factory/process/activity context.

### calculate_emissions
Uses deterministic calculation tools.

### detect_hotspots
Aggregates and ranks process emissions.

### find_alternatives
Retrieves matching circular alternatives.

### calculate_impact
Calculates projected environmental/financial impact.

### rank_recommendations
Ranks candidate interventions using business scoring rules.

### generate_response
Converts structured results into a concise, grounded answer.

## 5. MCP Tools

### get_factory_profile
Returns factory metadata and production context.

### calculate_emissions
Input:
```json
{
  "activity": "natural_gas",
  "quantity": 300
}
```

Returns deterministic emissions.

### identify_hotspots
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

### find_circular_alternatives
Searches based on:
- Process.
- Material.
- Waste.
- Energy.

### calculate_scenario
Returns:
- Baseline.
- Projected.
- Reduction.
- Percentage.
- Cost.
- Savings.
- Payback.

### rank_interventions
Ranks candidates using the configured score.

### generate_action_plan
Produces structured implementation steps.

## 6. Grounding Rules

The agent must:
1. Prefer tool results over model memory.
2. Never invent factory measurements.
3. Never invent a calculation when a calculation tool is available.
4. State assumptions.
5. Distinguish estimates from measured values.
6. Avoid claiming physical sensor detection in the MVP.

## 7. Tool Selection Examples

### Query
"Why is my furnace a hotspot?"

Expected:
```text
get_factory_profile
→ calculate_emissions
→ identify_hotspots
→ response
```

### Query
"What should I fix first?"

Expected:
```text
get_factory_profile
→ identify_hotspots
→ find_circular_alternatives
→ calculate_impact
→ rank_interventions
→ response
```

### Query
"What if I use 30% recycled material?"

Expected:
```text
get_factory_profile
→ find_circular_alternatives
→ calculate_scenario
→ response
```

## 8. Response Contract

Prefer structured AI responses:

```json
{
  "answer": "...",
  "summary": "...",
  "toolsUsed": [],
  "recommendations": [],
  "scenario": null,
  "assumptions": [],
  "confidence": "MEDIUM"
}
```

## 9. Failure Handling

If a tool fails:
- Do not fabricate its result.
- Explain that the requested calculation/data is unavailable.
- Retry where safe.
- Return partial information only when clearly marked.

## 10. Human-in-the-Loop Boundary

The agent recommends; the human decides.

The MVP must not:
- Directly control machinery.
- Automatically modify factory processes.
- Present recommendations as guaranteed savings.
