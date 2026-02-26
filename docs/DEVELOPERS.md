# Marlowe Developer's Guide

This guide helps developers understand, extend, and contribute to Marlowe—an AI application for AI governance, compliance, and evidence across frameworks.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Project Structure](#project-structure)
3. [Backend Deep Dive](#backend-deep-dive)
4. [Frontend Deep Dive](#frontend-deep-dive)
5. [Key Workflows](#key-workflows)
6. [Configuration](#configuration)
7. [Observability & Monitoring](#observability--monitoring)
8. [Local Development](#local-development)

---

## Architecture Overview

### Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Backend | Python 3.10+, FastAPI | REST API, async handlers |
| Database | PostgreSQL (asyncpg) | Frameworks, requirements, assessments, evidence |
| Vector Store | Qdrant | Document embeddings, semantic search for RAG |
| Graph | Neo4j | Knowledge graph (frameworks, requirements, evidence relationships) |
| Cache | Redis | Sessions, caching (if used) |
| AI | Ollama (on host) | Chat, embeddings, gap analysis agents |
| Document Processing | Docling | PDF, DOCX, PPTX, XLSX → text extraction |
| Object Storage | MinIO / S3 (on host) | Uploaded documents |
| Frontend | React, Vite, TypeScript, Tailwind, Shadcn UI | Single-page app |
| Chat UI | CopilotKit, LangGraph | AI agents with RAG |
| Observability | OpenTelemetry, Prometheus, Tempo, Grafana | Traces, metrics |

### Data Flow (High Level)

```
User → Frontend (React) → Backend (FastAPI) → [Postgres | Qdrant | Neo4j | Ollama | MinIO]
```

- **Postgres**: Source of truth for frameworks, requirements, assessments, evidence.
- **Neo4j**: Synced from Postgres; used for graph visualization and relationship queries.
- **Qdrant**: Document chunks with embeddings; used by RAG (chat) and gap analysis evidence context.

---

## Project Structure

```
marlowe/
├── app/                          # Backend (FastAPI)
│   ├── main.py                   # App entry, lifespan, CopilotKit agents
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
└── pyproject.toml
```

---

## Backend Deep Dive

### API Routes (`app/api/v1/`)

| Prefix | Module | Description |
|--------|--------|-------------|
| `/health` | health | Health check |
| `/nist` | nist | NIST 800-53 seed |
| `/frameworks` | frameworks | CRUD, library, evidence status, extract requirements |
| `/requirements` | requirements | CRUD |
| `/assessments` | assessments | CRUD |
| `/evidence` | evidence | CRUD (Postgres Evidence, syncs to Neo4j) |
| `/documents` | documents | Upload, ingest, search, docs folder |
| `/chat` | chat | Legacy chat endpoint |
| `/reports` | reports | Gap analysis reports |
| `/graph` | graph | Knowledge graph, stats, health, sync, crosswalk |
| `/ollama` | ollama | Model list, health |
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
| `minio_client` | S3-compatible uploads |
| `nist_seed_service` | Load NIST 800-53 from OSCAL |
| `requirement_extraction_service` | AI extraction of requirements from documents |
| `whisper_service` | Speech-to-text (faster-whisper) |
| `otel` | OpenTelemetry init (FastAPI, httpx, LangChain) |

### Agents (`app/agents/`)

| Agent | File | Description |
|-------|------|-------------|
| Gap Analysis | `gap_analysis_graph.py` | LangGraph: Framework Analyst → Evidence Reviewer → Gap Assessor |
| RAG Chat (Marlowe) | `rag_agent.py` | LangGraph: RAG node (build prompt, invoke ChatOllama) |
| Free Chat | `rag_agent.py` | LangGraph: plain ChatOllama, no RAG |

### Models (`app/models/`)

- **Framework** – Name, slug, description, region, framework_type
- **Requirement** – framework_id, identifier, title, description, level, family
- **Assessment** – Title, status, framework_id, organization_id
- **Evidence** – requirement_id, assessment_id, file_key, filename (Postgres; synced to Neo4j)
- **Organization**, **User**, **FAQ** – Supporting models

---

## Frontend Deep Dive

### Pages (`frontend/src/pages/`)

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | Home | Dashboard, quick actions |
| `/tutorial` | Tutorial | Getting started, synthetic data |
| `/assessments` | Assessments | Frameworks, gap analysis, evidence upload |
| `/standards-library` | StandardsLibrary | Framework catalog, evidence status |
| `/knowledge-base` | KnowledgeBase | Document upload, semantic search |
| `/knowledge-graph` | KnowledgeGraph | Neo4j visualization, crosswalk |
| `/reports` | Reports | Gap analysis reports |
| `/faq` | Faq | FAQ list |
| `/help` | Help | Help content |
| `/about-marlowe` | AboutMarlowe | About page |
| `/admin/observability` | AdminObservability | Observability dashboard |

### API Client (`frontend/src/lib/api.ts`)

Centralized `api` object with methods for all backend endpoints. Uses `fetch` with `/api/v1` prefix.

### Key Frontend Flows

1. **Gap Analysis**: Run → poll job status → show report → Download MD / View in Knowledge Graph
2. **Knowledge Graph**: Load graph/stats → Sync from DB → Filter by framework, FedRAMP
3. **Crosswalk**: Select frameworks A & B → Generate Crosswalk → overlay dashed edges on graph

---

## Key Workflows

### Gap Analysis

1. User runs gap analysis on a framework (Assessments page).
2. `POST /gap-analysis/run?framework_id=X` → returns `job_id`.
3. Frontend polls `GET /gap-analysis/jobs/{job_id}` every 2s.
4. Backend runs LangGraph: **Framework Analyst** (summarize requirements) → **Evidence Reviewer** (map evidence) → **Gap Assessor** (produce report).
5. Evidence context comes from **Qdrant** (semantic search on uploaded docs with framework_id).
6. On completion, report shown in dialog; user can Download MD or View in Knowledge Graph.

### Knowledge Graph

1. Frameworks, requirements, evidence sync from Postgres to Neo4j via `graph_sync`.
2. Sync triggered: on create/update (hooks) or manually (`POST /graph/sync`).
3. Graph API: `GET /graph?framework_id=&fedramp_baseline=` returns nodes and edges.
4. Frontend uses **vis-network** for visualization; clusters by framework.

### Document Upload → Evidence Bridge

1. User uploads document with framework_id (Upload Evidence).
2. `documents/upload` → MinIO + Qdrant ingest.
3. On success, `evidence_bridge_service.create_evidence_for_uploaded_document` runs.
4. Creates Postgres Evidence (links to first requirement + default assessment).
5. Syncs to Neo4j → Evidence node appears in Knowledge Graph.

### Crosswalk

1. User selects Framework A and B on Knowledge Graph page.
2. `GET /graph/crosswalk?framework_a=1&framework_b=2`
3. Backend embeds all requirements (identifier + title + description) via Ollama.
4. For each req in A, find best match in B by **cosine similarity**.
5. Returns mappings; frontend overlays dashed edges on graph.

---

## Configuration

### Environment Variables (`app/core/config.py`)

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql+asyncpg://...` | Postgres connection |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis |
| `QDRANT_HOST`, `QDRANT_PORT` | localhost:6333 | Qdrant |
| `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` | … | Neo4j |
| `OLLAMA_HOST` | `http://host.docker.internal:11434` | Ollama |
| `OLLAMA_MODEL`, `OLLAMA_FALLBACK_MODEL` | qwen3, granite3.2 | Chat models |
| `EMBEDDING_MODEL`, `EMBEDDING_DIMENSION` | nomic-embed-text, 768 | Embeddings |
| `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY` | host.docker.internal:9000 | MinIO (runs on host; no container in Compose) |
| `OTEL_ENABLED`, `OTEL_SERVICE_NAME`, `OTEL_EXPORTER_OTLP_ENDPOINT` | … | OpenTelemetry |
| `NIST_AUTO_SEED` | true | Auto-load NIST 800-53 on startup |

---

## Observability & Monitoring

### Current Setup (Testing Only)

The included observability stack (Prometheus, Tempo, Grafana, OTel Collector) is for **local development and testing**. It is not production-ready. Configure monitoring, retention, alerting, and security according to your deployment needs.

### What's Instrumented

- **OpenTelemetry**: FastAPI, httpx, LangChain instrumented; traces → OTLP → Tempo.
- **Prometheus**: Scrapes OTel collector, Postgres, Redis, Qdrant, Cadvisor.
- **Grafana**: Dashboards for collector, core health; Explore → Tempo for traces.
- **LangChain traces**: Agent/LLM spans visible in Tempo when `OTEL_ENABLED=true`.

See `observability/` for configs. Token usage is not tracked (local models).

### Best Practice: Track All Agent Actions

It is best practice to trace all agent actions—gap analysis, RAG chat, requirement extraction, and any future AI workflows. Traces help with debugging, auditing, and understanding model behavior. Keep `OTEL_ENABLED=true` in non-local environments and route traces to your chosen observability platform.

### Production

For production, set up observability as you wish: external Prometheus/Grafana, managed OpenTelemetry (e.g. Grafana Cloud, Datadog), or your own alerting rules. Ensure credentials, retention policies, and data handling meet your compliance requirements.

---

## Local Development

### Backend

**Ollama and MinIO must run on the host** (not in Docker Compose). The backend reaches them via `host.docker.internal` when running in Docker, or `localhost` when the backend runs directly on the host. Document uploads require MinIO; without it, uploads will fail.

```bash
# Venv
uv venv && source .venv/bin/activate  # or Windows equivalent
uv sync

# Run Postgres, Redis, Qdrant, Neo4j
docker compose up -d postgres redis qdrant neo4j

# Ensure Ollama and MinIO run on host (e.g. minio server, ollama serve)
# Point .env: OLLAMA_HOST=http://localhost:11434, MINIO_ENDPOINT=localhost:9000

# Start backend
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Useful Commands

```bash
# Ingest docs into Qdrant
python -m app.scripts.ingest_docs

# Seed NIST 800-53
python -m app.scripts.seed_nist_80053

# Run tests
pytest
```

---

## Contributing

- Use **Ruff** for formatting/linting.
- Add **type hints** and **Google-style docstrings**.
- Run `pytest` before committing.
- See `docs/CONTRIBUTING.md` for license and document handling.
