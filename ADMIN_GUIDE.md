# Marlowe - Administrator's Guide

**Document Version**: 1.0  
**Date**: February 2025  
**Audience**: System Administrators, Operations Staff, Support Personnel

---

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Document & Knowledge Base Management](#document--knowledge-base-management)
4. [GRC & Assessments](#grc--assessments)
5. [Knowledge Graph Management](#knowledge-graph-management)
6. [AI Chat Management](#ai-chat-management)
7. [Reports & Analytics](#reports--analytics)
8. [Admin Dashboard](#admin-dashboard)
9. [Configuration Management](#configuration-management)
10. [Troubleshooting](#troubleshooting)
11. [Best Practices](#best-practices)

---

## Introduction

### Purpose of This Guide

This Administrator's Guide provides step-by-step instructions for managing and operating the Marlowe application on a day-to-day basis. This guide focuses on **application-level operations** rather than infrastructure deployment.

**For infrastructure and deployment information, refer to the [Technical Brief](TECHNICAL_BRIEF.md).**

### Who Should Use This Guide

- **System Administrators**: Managing application settings and operations
- **Operations Staff**: Performing routine maintenance and monitoring
- **Support Personnel**: Assisting users and troubleshooting issues
- **Compliance Officers**: Managing GRC frameworks and assessments

### Application Overview

Marlowe is an AI-powered platform for **AI governance**, **responsible AI**, **privacy**, and **global AI regulations**. It provides:

- **Document Processing**: Upload and ingest PDF, Word, Excel, PowerPoint, Markdown, TXT into the knowledge base
- **GRC & Gap Analysis**: Frameworks (NIST 800-53, ISO 42001), assessments, evidence, multi-agent gap analysis
- **NIST AI RMF Taxonomy**: 150 trustworthiness properties with maturity scoring
- **AI Chat**: RAG-powered Q&A over documents and framework context
- **Knowledge Graph**: Visual representation of frameworks, requirements, and relationships (Neo4j)
- **Reports**: Gap analysis reports, AI Readiness checklist

---

## Getting Started

### Accessing the Application

1. **Main Application**: Navigate to `http://localhost:5011` (or your production URL)
2. **Admin Dashboard**: Navigate to `http://localhost:5011/admin`
3. **Observability**: Navigate to `http://localhost:5011/admin/observability`
4. **About Page**: Navigate to `http://localhost:5011/about-marlowe`

### Port Reference

| Port | Service    |
|------|------------|
| 5010 | Backend API |
| 5011 | Frontend    |
| 5012 | PostgreSQL  |
| 5013 | Redis       |
| 5014 | Qdrant      |
| 5015 | Neo4j HTTP  |
| 5016 | Neo4j Bolt  |
| 5017 | Grafana     |
| 5018 | Tempo       |
| 5019 | Prometheus  |
| 5020 | cAdvisor    |
| 5021 | Postgres Exporter |
| 5022 | Redis Exporter |
| 5023 | vLLM (optional, profile `vllm`) |

### Navigation Overview

#### Main Application Pages

- **Home** (`/`): Dashboard with AI chat, quick actions, stats
- **Getting Started** (`/tutorial`): Tutorial and synthetic data
- **AI Knowledge Base** (`/knowledge-base`): Document upload, semantic search
- **GRC & Gap Analysis** (`/assessments`): Frameworks, evidence, gap analysis
- **AI RMF Taxonomy** (`/taxonomy`): NIST trustworthiness properties
- **AI Readiness Check** (`/ai-readiness`): Checklist with radar visualization
- **Standards Library** (`/standards-library`): Framework catalog
- **Knowledge Graph** (`/knowledge-graph`): Neo4j visualization
- **Reports** (`/reports`): Gap analysis reports
- **Watch Intro** (`/splash`): Optional intro video
- **Admin** (`/admin`): Service status, CLI commands
- **Help** (`/help`): Help and documentation

### Initial Setup Checklist

- [ ] Verify all services are running (check Technical Brief for details)
- [ ] Access the main application interface
- [ ] Load NIST 800-53 (auto-seeds on first startup, or use Assessments → Load NIST 800-53)
- [ ] Verify document upload and AI Knowledge Base
- [ ] Test AI chat interface
- [ ] Review Admin dashboard and service status

---

## Document & Knowledge Base Management

### Uploading Documents

#### Via Web Interface

1. Navigate to **AI Knowledge Base** (`/knowledge-base`)
2. Use **Upload** to select files
3. Supported formats: PDF, DOCX, TXT (Docling for extraction)
4. Wait for processing (ingest → chunk → embed → Qdrant)
5. Documents become searchable and available for RAG chat

#### Via API

```bash
POST http://localhost:5010/api/v1/documents/upload
# Or ingest from docs folder:
POST http://localhost:5010/api/v1/documents/ingest?path=docs
```

#### Via CLI

```bash
docker compose exec backend python -m app.scripts.ingest_docs
python -m app.scripts.ingest_docs docs   # optional path
```

#### File Size Limits

- **Default Maximum**: 100 MB per file (nginx `client_max_body_size`)
- **Configurable**: Edit `docker/nginx.conf` if needed
- **Large Documents**: May take longer to process

### Document Processing Details

1. **Text Extraction**: Docling extracts content from PDF, DOCX, PPTX, XLSX
2. **Chunking**: Document split into chunks for embedding
3. **Vectorization**: Chunks embedded (nomic-embed-text) and stored in Qdrant
4. **Evidence Bridge**: If uploaded with framework_id, Postgres Evidence created and synced to Neo4j

### Licensed Documents

- Create `docs/licensed/` (gitignored) for proprietary content
- Do not commit licensed PDFs to the repository
- See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for details

### Clearing the Vector Store

Before sharing a deployment or backup, clear Qdrant if it contains licensed content:

- **API**: `DELETE /api/v1/documents/collection`
- **Docker**: `docker compose down -v` resets volumes

---

## GRC & Assessments

### NIST 800-53

- **Auto-seed**: On first startup, NIST 800-53 (1,196 controls) loads automatically
- **Disable**: Set `NIST_AUTO_SEED=false` in `.env`
- **Manual load**: Assessments → **Load NIST 800-53** button
- **Replace**: `POST /api/v1/nist/seed?replace_existing=true`
- **CLI**: `python -m app.scripts.seed_nist_80053 --replace`

### NIST AI RMF Trustworthiness Taxonomy

- Navigate to **AI RMF Taxonomy** (`/taxonomy`)
- Click **Load Taxonomy** to seed 150 trustworthiness properties
- Entry-table assessment with maturity scoring (0–5)
- Bar charts show maturity by stage and characteristic

### Synthetic Taxonomy Scores (Demos)

```bash
# Seed random maturity scores (requires backend running, taxonomy loaded)
python scripts/synth_taxonomy.py
python scripts/synth_taxonomy.py --limit 60 --seed 7
```

### Gap Analysis

1. Go to **GRC & Gap Analysis** (`/assessments`)
2. Add a framework (or use NIST 800-53)
3. Upload evidence (documents linked to requirements)
4. Run **Gap Analysis** – multi-agent LangGraph workflow (Framework Analyst → Evidence Reviewer → Gap Assessor)
5. View report, download Markdown, or view in Knowledge Graph

### Evidence Management

- Evidence links requirements to uploaded documents
- Upload Evidence associates documents with frameworks
- Evidence syncs from Postgres to Neo4j for graph visualization

---

## Knowledge Graph Management

### Sync from Database

- Frameworks, requirements, and evidence sync from PostgreSQL to Neo4j
- **Manual sync**: Knowledge Graph page → **Sync from DB** button
- **API**: `POST /api/v1/graph/sync`

### Viewing the Graph

1. Navigate to **Knowledge Graph** (`/knowledge-graph`)
2. Use vis-network: zoom, pan, click nodes
3. Filter by framework or FedRAMP baseline
4. **Crosswalk**: Select two frameworks to see requirement mappings (dashed edges)

### Neo4j Browser

- Direct access: `http://localhost:5015`
- Username: `neo4j`, Password: `password` (change in production!)

---

## AI Chat Management

### Chat Interfaces

- **Main Chat**: Embedded on Home page (CopilotKit)
- **Side Popup**: Floating CopilotKit chat (bottom-right) for context across pages

### Model Selection

- Chat includes a **Model** dropdown
- Models loaded from `GET /api/v1/llm/models` (Ollama or vLLM)
- Default: server-configured model (Ollama or vLLM)

### RAG Context

- Chat uses RAG over uploaded documents and knowledge base
- Framework and requirement context included when relevant
- Voice input supported (Whisper speech-to-text)

---

## Reports & Analytics

### Gap Analysis Reports

- **Reports** page lists persisted gap analysis reports
- Download as Markdown
- View findings in Knowledge Graph

### AI Readiness Check

- **AI Readiness** page: Checklist with radar visualization
- Score by dimension (1–5)
- Action plan based on scores
- Export/import JSON state

---

## Admin Dashboard

### Accessing Admin

Navigate to `http://localhost:5011/admin`

### Service Status

- **API**: Backend health
- **PostgreSQL**: Database connection
- **Redis**: Cache connection
- **Qdrant**: Vector store
- **Neo4j**: Graph database
- **MinIO**: Object storage
- **LLM**: Ollama or vLLM reachability

### Marlowe CLI

The Admin page shows copyable CLI commands:

```bash
marlowe --version
marlowe health
marlowe health --base-url http://localhost:5010 --json
```

**Install CLI** (from project root):

```bash
pip install -e .
# or
uv sync
```

### Version

- **API**: `GET /api/v1/admin/version` returns app version
- Displayed on Admin dashboard

---

## Configuration Management

### Environment Variables

Key variables (see `.env` or `docker-compose.yml`):

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `postgresql+asyncpg://marlowe:marlowe@postgres:5432/marlowe` | Postgres |
| `REDIS_URL` | `redis://redis:6379/0` | Redis |
| `QDRANT_HOST`, `QDRANT_PORT` | qdrant:6333 | Qdrant |
| `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` | neo4j:password | Neo4j |
| `LLM_PROVIDER` | `ollama` | `ollama` or `vllm` |
| `OLLAMA_HOST` | `http://host.docker.internal:11434` | Ollama (on host) |
| `NIST_AUTO_SEED` | `true` | Auto-load NIST 800-53 on startup |
| `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY` | host.docker.internal:9000 | MinIO (on host) |
| `SECRET_KEY` | `change-me-in-production` | **Change in production!** |

### Changing Configuration

1. Edit `.env` or `docker-compose.yml` environment section
2. Restart services: `docker compose down && docker compose up -d`

### Ollama (Linux)

On Linux, Ollama must listen on all interfaces for Docker:

```bash
OLLAMA_HOST=0.0.0.0 ollama serve
# Or systemd override - see README
```

---

## Troubleshooting

### Common Issues

#### "Ollama not reachable"

- **Cause**: Ollama not running on host, or wrong `OLLAMA_HOST`
- **Fix**: Start Ollama (`ollama serve`), ensure `OLLAMA_HOST` points to host (e.g. `host.docker.internal:11434`)

#### "Document upload failed"

- **Cause**: MinIO not running, file too large, or unsupported format
- **Fix**: Start MinIO on host, check `client_max_body_size` in nginx (100 MB), verify format

#### "Knowledge graph empty"

- **Cause**: No sync from Postgres, or no frameworks loaded
- **Fix**: Load NIST 800-53 or add framework, click **Sync from DB**

#### "Gap analysis stuck"

- **Cause**: Long-running LangGraph (can take minutes)
- **Fix**: Poll job status; check backend logs for errors

### Diagnostic Steps

```bash
# Service status
docker compose ps

# Backend logs
docker compose logs backend --tail 50

# Health check
curl http://localhost:5010/api/v1/health
curl http://localhost:5010/api/v1/admin/services

# Marlowe CLI
marlowe health
marlowe health --json
```

### Escalation

- Check logs: `docker compose logs backend`
- Verify services: `marlowe health`
- Refer to [Technical Brief](TECHNICAL_BRIEF.md) for infrastructure details

---

## Best Practices

### Daily Operations

- Verify services via Admin dashboard
- Monitor disk space (Postgres, Qdrant, MinIO)
- Check logs for errors

### Weekly Tasks

- Review gap analysis reports
- Sync Knowledge Graph if new frameworks/evidence added
- Verify backup strategy (if implemented)

### Security

- Change default passwords (Postgres, Neo4j, MinIO) in production
- Use strong `SECRET_KEY`
- Restrict CORS origins for production
- Do not commit `.env` or licensed documents

### Performance

- 16 GB+ RAM recommended for AI workloads
- SSD storage for databases
- Monitor Ollama/vLLM memory usage

---

## Quick Reference

### URLs

- **Frontend**: `http://localhost:5011`
- **Backend API**: `http://localhost:5010`
- **API Docs**: `http://localhost:5010/docs`
- **Neo4j Browser**: `http://localhost:5015`
- **Grafana**: `http://localhost:5017`

### API Endpoints

- `GET /api/v1/health` – Health check
- `GET /api/v1/admin/services` – Service status
- `GET /api/v1/admin/version` – Version
- `POST /api/v1/graph/sync` – Sync Postgres → Neo4j
- `POST /api/v1/documents/ingest` – Ingest docs folder
- `DELETE /api/v1/documents/collection` – Clear Qdrant

---

**Marlowe is a trademark of GallowGlass AI.**

**Last Updated**: February 2025
