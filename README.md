# Marlowe

AI application for **AI governance**, **responsible AI**, **privacy**, and **global AI regulations**. Supports compliance, assessments, and evidence across frameworks (e.g. EU AI Act, GDPR, NIST AI RMF)—framework-agnostic.

The app is named after [Christopher Marlowe](https://en.wikipedia.org/wiki/Christopher_Marlowe)— Elizabethan playwright, poet, and contemporary of Shakespeare—whose work combined sharp structure, craft, and a touch of intrigue.

## Stack

- **Backend:** Python 3.10+, FastAPI, async
- **Database:** PostgreSQL
- **Vector store:** Qdrant
- **Cache:** Redis
- **Graph:** Neo4j (knowledge graph)
- **Document processing:** Docling only (PDF, DOCX, PPTX, XLSX, etc.)
- **AI:** Ollama (on host)
- **Object storage:** MinIO or S3-compatible (on host)
- **Frontend:** React (Vite, TypeScript, Tailwind CSS, CopilotKit, vis-network). Preferred stack: React + Vite + Tailwind + Shadcn UI. Legacy static HTML (SB Admin 2 style) lives in `frontend-old/` and is not the default UI.
- **Deployment:** Docker Compose

## Quick start (Docker)

1. Copy `.env.example` to `.env` and set values (DB, Redis, Qdrant, Neo4j, Ollama, MinIO).
2. Ensure Ollama and MinIO run on the host if not in Compose.
3. From project root:

   ```bash
   docker compose up -d
   ```

   If you see old or wrong content (e.g. another app), rebuild the frontend so the container serves the current Marlowe UI:

   ```bash
   docker compose build --no-cache frontend && docker compose up -d
   ```

4. **URLs (host ports 5010–5016, avoids Docling on 5001):**  
   Frontend: http://localhost:5011  
   Backend API: http://localhost:5010  
   API docs: http://localhost:5010/docs  
   Neo4j browser: http://localhost:5015 (bolt on 5016)

   | Port | Service    |
   |------|------------|
   | 5010 | Backend    |
   | 5011 | Frontend   |
   | 5012 | Postgres   |
   | 5013 | Redis      |
   | 5014 | Qdrant     |
   | 5015 | Neo4j HTTP |
   | 5016 | Neo4j Bolt |

## Local development (backend only)

- Use a venv and install with `uv pip install -e ".[dev]"` or `pip install -e ".[dev]"`.
- Run Postgres, Redis, Qdrant, Neo4j via Docker Compose (e.g. `docker compose up -d postgres redis qdrant neo4j`). All host ports are 5010–5016 (see `docker-compose.yml`).
- Point `.env` at local services; for DB from host use `postgresql+asyncpg://marlowe:marlowe@localhost:5012/marlowe`; Redis `localhost:5013`, Qdrant `localhost:5014`; set `OLLAMA_HOST` and MinIO endpoint to host where those run.
- Start backend: `uvicorn app.main:app --reload`.

## Ingesting docs into Qdrant

The `docs/` folder (PDFs, DOCX, .md, etc.) can be ingested into Qdrant so **AI Chat** and search use them as context. Via the UI (AI Knowledge Base → Upload), single-file uploads are limited to **100 MB** (nginx `client_max_body_size`); increase in `docker/nginx.conf` if needed.

1. **Ollama**: Pull the embedding model (required for ingestion and RAG):
   ```bash
   ollama pull nomic-embed-text
   ```
2. **API** (with stack running):  
   `POST http://localhost:5010/api/v1/documents/ingest`  
   Optionally pass `?path=docs` to override the path. The backend container has `./docs` mounted at `/app/docs`.
3. **CLI** (from project root, with backend deps available):
   ```bash
   python -m app.scripts.ingest_docs
   python -m app.scripts.ingest_docs docs   # optional path
   ```
   In Docker: `docker compose exec backend python -m app.scripts.ingest_docs`
4. After ingestion, **Chat** uses retrieved chunks from Qdrant automatically when answering.

## Knowledge graph (Neo4j)

Frameworks and requirements are synced from Postgres to Neo4j when you create or update them via the API. For existing data, use **Sync from DB** on the Knowledge Graph page, or `POST /api/v1/graph/sync`. The graph UI (vis-network) shows frameworks and requirements and **BELONGS_TO** edges; pan and zoom to explore.

## Ollama (on host)

The backend in Docker reaches Ollama at `host.docker.internal:11434`. **On Linux, Ollama must listen on all interfaces** so the container can connect: start it with `OLLAMA_HOST=0.0.0.0` (e.g. `OLLAMA_HOST=0.0.0.0 ollama serve`). If you use systemd:

```bash
sudo mkdir -p /etc/systemd/system/ollama.service.d
printf '[Service]\nEnvironment="OLLAMA_HOST=0.0.0.0"\n' | sudo tee /etc/systemd/system/ollama.service.d/override.conf
sudo systemctl daemon-reload && sudo systemctl restart ollama
```

To verify from the API: `GET http://localhost:5010/api/v1/ollama/health` returns `{"reachable": true}` when Ollama is reachable.

## Ollama model picker

**Chat** lets users choose an Ollama model from a dropdown. The list is loaded from `GET /api/v1/ollama/models` (Ollama’s `/api/tags`). Send the selected model in the chat request body as `model`; the reply includes `model_used`.

## Project structure

- `app/` – FastAPI application (core, models, schemas, api, services, agents)
- `database/` – Postgres init script
- `frontend/` – **Live UI:** React + Vite + TypeScript + Tailwind, CopilotKit, vis-network (knowledge graph)
- `frontend-old/` – Legacy static HTML/CSS/JS (SB Admin 2 style), not used by default
- `docs/` – Reference documents (ingestible into Qdrant)

See `PRD.md` for full product and architecture details.

## Licensed documents and Qdrant

Licensed or copyrighted documents (e.g. ISO standards) must **not** be committed. See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for details.

- **Local use:** Create `docs/licensed/` (gitignored) and place your licensed PDFs there. Ingest from `docs` as usual.
- **Public repo:** Only open-access content in `docs/` is committed.
- **Clearing Qdrant:** Before sharing a deployment or backup, clear the vector store: `DELETE /api/v1/documents/collection` or `docker compose down -v` to reset volumes.
