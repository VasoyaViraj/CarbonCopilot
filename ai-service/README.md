# EcoTrace AI — AI Service

Python + FastAPI service that owns AI orchestration (LangChain, LangGraph, MCP).

Responsibilities:
- Intent routing and tool orchestration (LangGraph).
- Bounded MCP tools that call the backend's deterministic capabilities.
- Grounded explanations, root-cause analysis, and action plans.

Boundaries:
- Never the source of business truth — factory data and calculations come from the Express backend / PostgreSQL.
- Never performs authoritative arithmetic in the LLM.
- Only reachable from the Express backend (authenticated with `AI_SERVICE_TOKEN`), never directly from the browser.

Planned layout:

```text
ai-service/
├── app/
│   ├── main.py
│   ├── agents/   (graph.py, state.py, nodes.py)
│   ├── mcp/      (server.py, tools/)
│   ├── services/
│   ├── prompts/
│   └── schemas/
├── requirements.txt
└── .env.example
```

Default port: `8000`. Configuration: [.env.example](.env.example).
