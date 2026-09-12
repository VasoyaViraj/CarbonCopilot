# EcoTrace AI — State Machines

## 1. Authentication State

```text
[LOGGED_OUT]
     │ login success
     ▼
[AUTHENTICATED]
     │ token expires/logout
     ▼
[LOGGED_OUT]
```

Failure path:

```text
[LOGGED_OUT]
   │ invalid credentials
   ▼
[LOGIN_ERROR]
   │ retry
   └──────────────► [LOGGED_OUT]
```

## 2. Factory Onboarding

```text
[NO_FACTORY]
    │ create factory
    ▼
[FACTORY_CREATED]
    │ add process
    ▼
[PROCESS_CONFIGURED]
    │ save
    ▼
[READY_FOR_DATA]
```

## 3. Data Ingestion

```text
[DATA_INPUT]
    │ manual submit / CSV upload / simulation
    ▼
[VALIDATING]
    │ valid
    ▼
[INGESTED]
    │ calculate
    ▼
[CALCULATED]
```

Invalid path:

```text
[VALIDATING]
    │ invalid
    ▼
[VALIDATION_ERROR]
    │ correction
    └────────────► [DATA_INPUT]
```

## 4. Analysis Pipeline

```text
[CALCULATED]
      │
      ▼
[AGGREGATING]
      │
      ▼
[HOTSPOTS_IDENTIFIED]
      │
      ▼
[ROOT_CAUSE_ANALYSIS]
      │
      ▼
[ALTERNATIVES_FOUND]
      │
      ▼
[IMPACT_CALCULATED]
      │
      ▼
[RECOMMENDATIONS_RANKED]
```

## 5. Scenario State

```text
[BASELINE]
   │ user changes intervention
   ▼
[SCENARIO_EDITING]
   │ calculate
   ▼
[SCENARIO_CALCULATED]
   │ save
   ▼
[SAVED]
```

Scenario calculations must not mutate the baseline.

## 6. AI Copilot State

```text
[IDLE]
  │ user message
  ▼
[INTENT_ROUTING]
  │
  ├── informational → [LOAD_CONTEXT]
  ├── hotspot       → [HOTSPOT_TOOLS]
  ├── recommendation→ [RECOMMENDATION_TOOLS]
  └── scenario      → [SCENARIO_TOOLS]
                          │
                          ▼
                    [GENERATE_RESPONSE]
                          │
                          ▼
                         [IDLE]
```

## 7. AI Failure State

```text
[TOOL_CALL]
   │ success
   ▼
[NEXT_NODE]

[TOOL_CALL]
   │ timeout/error
   ▼
[RECOVERABLE_ERROR]
   │ retry/fallback
   ├────────────► [TOOL_CALL]
   └────────────► [GENERATE_LIMITED_RESPONSE]
```

## 8. Report State

```text
[REPORT_REQUESTED]
       ↓
[COLLECTING_DATA]
       ↓
[GENERATING]
       ↓
[READY]
       ↓
[EXPORTED]
```

## 9. Simulation Stream State

```text
[STOPPED]
   │ start
   ▼
[RUNNING]
   │ anomaly threshold exceeded
   ▼
[ALERT]
   │ acknowledged
   ▼
[RUNNING]

[RUNNING] ── stop ──► [STOPPED]
```

Simulation alerts are informational and must not be represented as certified physical sensor alarms.
