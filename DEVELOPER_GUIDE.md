# Marlowe - Developer's Guide

**Document Version**: 1.0  
**Date**: March 2026  
**Audience**: Software Developers, Contributors

---

## Table of Contents

1. [Introduction](#introduction)
2. [Architecture Overview](#architecture-overview)
3. [Project Structure](#project-structure)
4. [Backend Development](#backend-development)
5. [Frontend Development](#frontend-development)
6. [API Reference](#api-reference)
7. [Key Workflows](#key-workflows)
8. [Configuration](#configuration)
9. [Testing](#testing)
10. [Code Conventions](#code-conventions)
11. [Observability](#observability)
12. [Local Development](#local-development)
13. [Contributing](#contributing)

---

## Introduction

### Purpose

This Developer's Guide helps engineers understand, extend, and contribute to Marlowe—an AI application for AI governance, compliance, and evidence across frameworks (NIST 800-53, ISO 42001, etc.).

### Prerequisites

- **Python 3.10+** with `uv` or `pip`
- **Node.js 18+** with `npm`
- **Docker** and **Docker Compose**
- **Ollama** (on host) for local LLM
- **MinIO** (on host) for document storage

### Related Documents

- [CONTRIBUTING.md](docs/CONTRIBUTING.md) – License and document handling
- [TECHNICAL_BRIEF.md](TECHNICAL_BRIEF.md) – Infrastructure and deployment
- [ADMIN_GUIDE.md](ADMIN_GUIDE.md) – Operations guide

---

## Architecture Overview

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Backend | Python 3.10+, FastAPI | REST API, async handlers |
| Database | PostgreSQL (asyncpg) | Frameworks, requirements, assessments, evidence |
| Vector Store | Qdrant | Document embeddings, semantic search (RAG) |
| Graph | Neo4j | Knowledge graph (frameworks, requirements, evidence) |
| Cache | Redis | Sessions, caching |
| AI | Ollama (default) or vLLM | Chat, embeddings, gap analysis agents |
| Document Processing | Docling | PDF, DOCX, PPTX, XLSX → text extraction |
| Object Storage | MinIO / S3 | Uploaded documents |
| Frontend | React, Vite, TypeScript, Tailwind, Shadcn UI | Single-page app |
| Chat UI | CopilotKit, LangGraph | AI agents with RAG |
| Observability | OpenTelemetry, Prometheus, Tempo, Grafana | Traces, metrics |

### Data Flow

```
User → Frontend (React) → Backend (FastAPI) → [Postgres | Qdrant | Neo4j | LLM (Ollama/vLLM) | MinIO]
```

- **PostgreSQL**: Source of truth for frameworks, requirements, assessments, evidence
- **Neo4j**: Synced from Postgres; used for graph visualization and relationship queries
- **Qdrant**: Document chunks with embeddings; used by RAG (chat) and gap analysis evidence context
- **MinIO**: Raw uploaded documents (S3-compatible)

---

## Project Structure

```
marlowe/
├── app/                          # Backend (FastAPI)
│   ├── main.py                   # App entry, lifespan, CopilotKit agents
│   ├── cli.py                    # Marlowe CLI (version, health)
│   ├── core/                     # Config, database, security
│   ├── models/                   # SQLAlchemy models
│   ├── schemas/                  # Pydantic request/response
│   ├── api/v1/                   # Versioned API routes
│   ├── services/                 # Business logic
│   ├── agents/                   # LangGraph agents (gap analysis, RAG chat)
│   ├── data/                     # Static data (e.g. FedRAMP baselines)
│   └── scripts/                  # CLI scripts (ingest, seed)
├── frontend/                     # React SPA
│   └── src/
│       ├── pages/                # Route components
│       ├── components/           # Reusable UI
│       ├── lib/                  # API client, utils
│       ├── contexts/             # React context (theme, chat model)
│       └── types/                # TypeScript types
├── docs/                         # Reference docs, ingestible into Qdrant
├── observability/                # Prometheus, OTel collector, Grafana config
├── database/                     # Postgres init
├── docker-compose.yml
├── pyproject.toml
└── tests/
```

---

## Backend Development

### API Routes (`app/api/v1/`)

| Prefix | Module | Description |
|--------|--------|-------------|
| `/health` | health | Health check |
| `/admin` | admin | Services, version |
| `/nist` | nist | NIST 800-53 seed |
| `/frameworks` | frameworks | CRUD, library, evidence status, extract requirements |
| `/requirements` | requirements | CRUD |
| `/assessments` | assessments | CRUD |
| `/evidence` | evidence | CRUD (Postgres Evidence, syncs to Neo4j) |
| `/documents` | documents | Upload, ingest, search, docs folder |
| `/chat` | chat | Legacy chat endpoint |
| `/reports` | reports | Gap analysis reports |
| `/graph` | graph | Knowledge graph, stats, health, sync, crosswalk |
| `/ollama` | ollama | Ollama model list, health |
| `/llm` | llm | Provider-agnostic model list, health |
| `/faq` | faq | FAQ CRUD |
| `/gap-analysis` | gap_analysis | Run gap analysis (async job), poll status |
| `/voice` | voice | Speech-to-text (Whisper) |

### Services (`app/services/`)

| Service | Purpose |
|---------|---------|
| `chat_service` | Build RAG prompt (Qdrant search, graph summary), legacy chat |
| `gap_analysis_service` | Orchestrate LangGraph, fetch requirements, evidence from Qdrant |
| `graph_service` | Neo4j queries: graph nodes/edges, stats, health |
| `graph_sync` | Sync Postgres → Neo4j (frameworks, requirements, evidence) |
| `evidence_bridge_service` | Create Postgres Evidence when documents uploaded with framework_id |
| `crosswalk_service` | Map requirements between frameworks via embeddings + cosine similarity |
| `ingest_service` | Docling extract → chunk → embed → Qdrant upsert |
| `document_service` | Docling parsing, text extraction |
| `qdrant_service` | Qdrant client, search, ensure collection |
| `ollama_service` | Chat, embeddings via Ollama |
| `vllm_service` | Chat, embeddings via vLLM (OpenAI-compatible) |
| `llm_service` | Provider switch for chat + embeddings |
| `minio_client` | S3-compatible uploads |
| `nist_seed_service` | Load NIST 800-53 from OSCAL |
| `requirement_extraction_service` | AI extraction of requirements from documents |
| `whisper_service` | Speech-to-text (faster-whisper) |
| `otel` | OpenTelemetry init (FastAPI, httpx, LangChain) |

### Agents (`app/agents/`)

| Agent | File | Description |
|-------|------|-------------|
| Gap Analysis | `gap_analysis_graph.py` | LangGraph: Framework Analyst → Evidence Reviewer → Gap Assessor |
| RAG Chat (Marlowe) | `rag_agent.py` | LangGraph: RAG node (build prompt, invoke LLM provider) |
| Free Chat | `rag_agent.py` | LangGraph: plain LLM provider, no RAG |

### Models (`app/models/`)

- **Framework** – Name, slug, description, region, framework_type
- **Requirement** – framework_id, identifier, title, description, level, family
- **Assessment** – Title, status, framework_id, organization_id
- **Evidence** – requirement_id, assessment_id, file_key, filename (Postgres; synced to Neo4j)
- **Organization**, **User**, **FAQ** – Supporting models

### Adding a New API Endpoint

1. Add route in `app/api/v1/<module>.py`
2. Add schema in `app/schemas/` if needed
3. Add service logic in `app/services/`
4. Register router in `app/main.py` if new router
5. Add tests in `tests/`

---

## Frontend Development

### Pages (`frontend/src/pages/`)

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | Home | Dashboard, AI chat, quick actions |
| `/tutorial` | Tutorial | Getting started, synthetic data |
| `/assessments` | Assessments | Frameworks, gap analysis, evidence upload |
| `/standards-library` | StandardsLibrary | Framework catalog, evidence status |
| `/knowledge-base` | KnowledgeBase | Document upload, semantic search |
| `/knowledge-graph` | KnowledgeGraph | Neo4j visualization, crosswalk |
| `/reports` | Reports | Gap analysis reports |
| `/taxonomy` | Taxonomy | NIST AI RMF trustworthiness properties |
| `/ai-readiness` | AIReadiness | AI Readiness checklist with radar |
| `/faq` | Faq | FAQ list |
| `/help` | Help | Help content |
| `/about-marlowe` | AboutMarlowe | About page |
| `/admin` | Admin | Service status, CLI commands |
| `/admin/observability` | AdminObservability | Observability dashboard |

### API Client (`frontend/src/lib/api.ts`)

Centralized `api` object with methods for all backend endpoints. Uses `fetch` with `/api/v1` prefix.

### Key Frontend Flows

1. **Gap Analysis**: Run → poll job status → show report → Download MD / View in Knowledge Graph
2. **Knowledge Graph**: Load graph/stats → Sync from DB → Filter by framework, FedRAMP → Crosswalk
3. **Crosswalk**: Select frameworks A & B → Generate Crosswalk → overlay dashed edges on graph
4. **AI Chat**: CopilotKit → `/api/copilotkit` → Copilot runtime → RAG agent

### CopilotKit Dev Console

Marlowe suppresses the CopilotKit dev console update banner via CSS (`.copilotKitDevConsole` in `frontend/src/index.css`). Remove or override the rule to show the banner again.

---

## API Reference

### Base URL

- Local: `http://localhost:5010/api/v1`
- OpenAPI: `http://localhost:5010/docs`

### Common Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/admin/services` | Service status |
| GET | `/admin/version` | App version |
| POST | `/graph/sync` | Sync Postgres → Neo4j |
| POST | `/documents/upload` | Upload document |
| POST | `/documents/ingest` | Ingest docs folder |
| DELETE | `/documents/collection` | Clear Qdrant collection |
| POST | `/gap-analysis/run` | Start gap analysis job |
| GET | `/gap-analysis/jobs/{id}` | Poll job status |

---

## Key Workflows

### Gap Analysis

1. User runs gap analysis on a framework (Assessments page)
2. `POST /gap-analysis/run?framework_id=X` → returns `job_id`
3. Frontend polls `GET /gap-analysis/jobs/{job_id}` every 2s
4. Backend runs LangGraph: **Framework Analyst** (summarize requirements) → **Evidence Reviewer** (map evidence) → **Gap Assessor** (produce report)
5. Evidence context from **Qdrant** (semantic search on uploaded docs with framework_id)
6. On completion, report shown; user can Download MD or View in Knowledge Graph

### Knowledge Graph

1. Frameworks, requirements, evidence sync from Postgres to Neo4j via `graph_sync`
2. Sync triggered: on create/update (hooks) or manually (`POST /graph/sync`)
3. Graph API: `GET /graph?framework_id=&fedramp_baseline=` returns nodes and edges
4. Frontend uses **vis-network** for visualization; clusters by framework

### Document Upload → Evidence Bridge

1. User uploads document with framework_id (Upload Evidence)
2. `documents/upload` → MinIO + Qdrant ingest
3. On success, `evidence_bridge_service.create_evidence_for_uploaded_document` runs
4. Creates Postgres Evidence (links to first requirement + default assessment)
5. Syncs to Neo4j → Evidence node appears in Knowledge Graph

### Crosswalk

1. User selects Framework A and B on Knowledge Graph page
2. `GET /graph/crosswalk?framework_a=1&framework_b=2`
3. Backend embeds all requirements via Ollama
4. For each req in A, find best match in B by **cosine similarity**
5. Returns mappings; frontend overlays dashed edges on graph

---

## Configuration

### Environment Variables (`app/core/config.py`)

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql+asyncpg://...` | Postgres connection |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis |
| `QDRANT_HOST`, `QDRANT_PORT` | localhost:6333 | Qdrant |
| `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` | … | Neo4j |
| `LLM_PROVIDER` | `ollama` | `ollama` or `vllm` |
| `OLLAMA_HOST` | `http://host.docker.internal:11434` | Ollama |
| `OLLAMA_MODEL`, `OLLAMA_FALLBACK_MODEL` | qwen3, granite3.2 | Chat models |
| `VLLM_BASE_URL` | `http://vllm:8000` | vLLM base URL |
| `VLLM_MODEL` | meta-llama/Meta-Llama-3-8B-Instruct | vLLM chat model |
| `EMBEDDING_MODEL`, `EMBEDDING_DIMENSION` | nomic-embed-text, 768 | Embeddings |
| `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY` | host.docker.internal:9000 | MinIO |
| `OTEL_ENABLED`, `OTEL_SERVICE_NAME`, `OTEL_EXPORTER_OTLP_ENDPOINT` | … | OpenTelemetry |
| `NIST_AUTO_SEED` | true | Auto-load NIST 800-53 on startup |
| `WHISPER_MODEL_SIZE`, `WHISPER_DEVICE` | base, cpu | Speech-to-text |

---

## Testing

### Running Tests

```bash
pytest
pytest tests/ -v
pytest tests/test_admin.py -v
```

### Test Structure

- `tests/` – Pytest tests
- `pytest.ini_options` in `pyproject.toml`: `asyncio_mode = "auto"`, `testpaths = ["tests"]`

### Pre-push Checklist

See [docs/PRE_PUSH_CHECKLIST.md](PRE_PUSH_CHECKLIST.md) for commit and push guidelines.

---

## Code Conventions

### Python

- **Formatter/Linter**: Ruff (replaces black, isort, flake8)
- **Type Hints**: All functions, methods, class members
- **Docstrings**: Google style
- **Line Length**: 100 (Ruff config in `pyproject.toml`)

```bash
ruff check app/
ruff format app/
```

### TypeScript / React

- **Linter**: ESLint
- **Functional components** with TypeScript interfaces
- **Shadcn UI** and **Tailwind** for styling
- **Named exports** for components

```bash
cd frontend && npm run lint
```

---

## Observability

### Instrumentation

- **OpenTelemetry**: FastAPI, httpx, LangChain instrumented; traces → OTLP → Tempo
- **Prometheus**: Scrapes OTel collector, Postgres, Redis, Qdrant, cAdvisor
- **Grafana**: Dashboards; Explore → Tempo for traces
- **LangChain traces**: Agent/LLM spans in Tempo when `OTEL_ENABLED=true`

### Local Stack

The observability stack (Prometheus, Tempo, Grafana, OTel Collector) is for **local development and testing**. Configure production monitoring per your deployment needs.

---

## Local Development

### Backend

**Ollama and MinIO must run on the host.** Backend reaches them via `host.docker.internal` when running in Docker, or `localhost` when running directly.

```bash
uv venv && source .venv/bin/activate  # or Windows equivalent
uv sync

# Run Postgres, Redis, Qdrant, Neo4j
docker compose up -d postgres redis qdrant neo4j

# Optional: vLLM via profile
docker compose --profile vllm up -d vllm

# Ensure Ollama and MinIO on host
# .env: OLLAMA_HOST=http://localhost:11434, MINIO_ENDPOINT=localhost:9000

# Start backend
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Marlowe CLI

```bash
# After pip install -e . or uv sync
marlowe --version
marlowe health
marlowe health --base-url http://localhost:5010 --json
```

### Ingest & Seed

```bash
python -m app.scripts.ingest_docs
python -m app.scripts.ingest_docs docs
python -m app.scripts.seed_nist_80053
python -m app.scripts.seed_nist_80053 --replace
```

---

## Contributing

- Use **Ruff** for formatting/linting
- Add **type hints** and **Google-style docstrings**
- Run `pytest` before committing
- See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for license and document handling
- Do not commit licensed documents; use `docs/licensed/` (gitignored)

---

**Marlowe is a trademark of GallowGlass AI.**

**Last Updated**: March 2026
