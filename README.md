# EcoTrace AI

> Repository: **CarbonCopilot** · Product: **EcoTrace AI** — Industrial Emission Hotspot Detector & Circular Alternative Recommender.

SMEs can usually calculate an aggregate carbon number, but cannot tell **which process** drives it, **why**, or **which circular intervention** pays back. EcoTrace AI turns operational data into a decision workflow:

```text
Operational Data → Deterministic Carbon Engine → Hotspot Detection → Agentic AI (LangGraph + MCP)
→ Circular Alternatives → Cost / Savings / Payback → What-if Simulation → Action Plan / Report
```

## Hackathon sensor constraint

There is no physical hardware at the hackathon. The MVP ingests **manual**, **CSV**, and **simulated** readings. Simulated readings are always labelled as simulated, and the product never claims physical leak detection. Software-based anomaly signals calculate deviations in emission intensity (CO2e/production unit) against historical baselines; they serve as an investigation signal rather than asserting physical equipment failure. The ingestion boundary is sensor-ready: future IoT/MQTT data enters at the same point without redesigning downstream logic.

## Architecture

```text
React + Vite ──REST──► Node + Express ──► PostgreSQL (source of truth)
                             │
                             └──► Python / FastAPI ──► LangGraph ──► MCP tools
```

| Service | Owns |
|---|---|
| `frontend/` (React + Vite) | UI only: forms, charts, navigation, chat, scenario controls |
| `backend/` (Express + Prisma) | Auth, authorization, CRUD, validation, ingestion, deterministic calculations |
| `ai-service/` (FastAPI) | AI orchestration: LangChain, LangGraph, MCP, LLM reasoning/explanation |
| PostgreSQL | System of record |

LLMs never perform authoritative arithmetic — numbers come from deterministic backend/tool code.

## Repository structure

```text
CarbonCopilot/
├── frontend/     React + Vite + Tailwind UI
├── backend/      Express API + Prisma (PostgreSQL)
├── ai-service/   Python FastAPI AI service (LangGraph + MCP)
├── data/         Demo datasets and CSV templates
└── docker-compose.yml   Optional local PostgreSQL
```

## Services & ports

| Service | Default URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:5000/api |
| AI service | http://localhost:8000 |
| PostgreSQL | localhost:5432 |

## Environment variables

Each service ships a committed template; copy it to `.env` and fill in secrets. **Never commit `.env` files.**

| File | Key variables |
|---|---|
| [backend/.env.example](backend/.env.example) | `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `FRONTEND_URL`, `AI_SERVICE_URL`, `AI_SERVICE_TOKEN` |
| [frontend/.env.example](frontend/.env.example) | `VITE_API_BASE_URL` |
| [ai-service/.env.example](ai-service/.env.example) | `BACKEND_INTERNAL_URL`, `AI_SERVICE_TOKEN`, `LLM_PROVIDER`, `LLM_MODEL`, `LLM_API_KEY` |

## Setup

```bash
# Database (optional local Postgres; or point DATABASE_URL at a hosted instance)
docker compose up -d postgres

# Backend
cd backend
cp .env.example .env
npm install
npm run db:migrate      # apply Prisma migrations
npm run db:seed         # seed emission factors, alternatives, demo org/users/factory
npm run dev

# Frontend
cd frontend
cp .env.example .env
npm install
npm run dev
```

## API conventions

- Base path `/api`, JSON only, `Authorization: Bearer <JWT>`.
- Success: `{ "success": true, "data": ... }`
- Error: `{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [...] } }`

## Roles

`ADMIN`, `FACTORY_OPERATOR`, `CONSULTANT`, `REGULATOR`. The backend is authoritative for all authorization; every factory-scoped request is checked against the user's organization.

## Development workflow

- Branches: `main` (stable demo builds) ← `develop` (integration) ← `feature/*`.
- Never develop directly on `main`.
- Commits follow `<type>(<scope>): <imperative summary>` (`feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `style`).
- Do not mix unrelated frontend / backend / AI changes in one commit.
- API contract changes are agreed with all affected developers before implementation.

## Integration strategy

1. Frontend builds against isolated mock data (`src/mocks/`), replaced by real services as APIs land.
2. Backend exposes the deterministic business APIs; the AI service calls backend internal APIs rather than duplicating business logic.
3. Express proxies AI requests (`/api/ai/*`) after authenticating the user and authorizing the factory; the browser never talks to the AI service directly.
