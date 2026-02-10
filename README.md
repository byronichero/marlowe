# Marlowe

AI application for **AI governance**, **responsible AI**, **privacy**, and **global AI regulations**. Supports compliance, assessments, and evidence across frameworks (e.g. EU AI Act, GDPR, NIST AI RMF)—framework-agnostic.

## Stack

- **Backend:** Python 3.10+, FastAPI, async
- **Database:** PostgreSQL
- **Vector store:** Qdrant
- **Cache:** Redis
- **Graph:** Neo4j (knowledge graph)
- **Document processing:** Docling only (PDF, DOCX, PPTX, XLSX, etc.)
- **AI:** Ollama (on host)
- **Object storage:** MinIO or S3-compatible (on host)
- **Frontend:** Static HTML/JS/CSS (SB Admin 2 style), nginx
- **Deployment:** Docker Compose

## Quick start (Docker)

1. Copy `.env.example` to `.env` and set values (DB, Redis, Qdrant, Neo4j, Ollama, MinIO).
2. Ensure Ollama and MinIO run on the host if not in Compose.
3. From project root:

   ```bash
   docker compose up -d
   ```

   If you see old or wrong content (e.g. another app or CMMC), rebuild the frontend so the container serves the current Marlowe UI:

   ```bash
   docker compose build --no-cache frontend && docker compose up -d
   ```

4. Backend: http://localhost:4000  
   API docs: http://localhost:4000/docs  
   Frontend: http://localhost:4006

## Local development (backend only)

- Use a venv and install with `uv pip install -e ".[dev]"` or `pip install -e ".[dev]"`.
- Run Postgres, Redis, Qdrant, Neo4j via Docker Compose (e.g. `docker compose up -d postgres redis qdrant neo4j`). Postgres is mapped to host port **5433** to avoid conflict with a local Postgres on 5432.
- Point `.env` at local services; for DB from host use `postgresql+asyncpg://marlowe:marlowe@localhost:5433/marlowe`; set `OLLAMA_HOST` and MinIO endpoint to host where those run.
- Start backend: `uvicorn app.main:app --reload`.

## Ingesting docs into Qdrant

The `docs/` folder (PDFs, DOCX, .md, etc.) can be ingested into Qdrant so **AI Chat** and search use them as context.

1. **Ollama**: Pull the embedding model (required for ingestion and RAG):
   ```bash
   ollama pull nomic-embed-text
   ```
2. **API** (with stack running):  
   `POST http://localhost:4000/api/v1/documents/ingest`  
   Optionally pass `?path=docs` to override the path. The backend container has `./docs` mounted at `/app/docs`.
3. **CLI** (from project root, with backend deps available):
   ```bash
   python -m app.scripts.ingest_docs
   python -m app.scripts.ingest_docs docs   # optional path
   ```
   In Docker: `docker compose exec backend python -m app.scripts.ingest_docs`
4. After ingestion, **Chat** uses retrieved chunks from Qdrant automatically when answering.

## Project structure

- `app/` – FastAPI application (core, models, schemas, api, services)
- `database/` – Postgres init script
- `frontend/` – Static HTML/CSS/JS, served by nginx
- `docs/` – Reference documents (ingestible into Qdrant)

See `PRD.md` for full product and architecture details.
