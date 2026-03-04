# Marlowe 1.0

<p align="center"><img src="frontend/public/marlowe.jpeg" width="120" alt="Marlowe" /></p>

AI application for **AI governance**, **responsible AI**, **privacy**, and **global AI regulations**. Supports compliance, assessments, and evidence across frameworks (e.g. EU AI Act, GDPR, NIST AI RMF)—framework-agnostic.

**For GRC, Privacy, and Infosec Professionals**

Marlowe helps you manage AI governance, compliance, and privacy in one place. Use it to run AI impact assessments (e.g., EU AI Act, NIST AI RMF), map controls across frameworks (ISO 27001, SOC 2, NIST 800-53, FedRAMP), and collect and organize evidence for audits. Upload your policy and control documents and use the knowledge graph and AI chat to see how requirements relate, find gaps, and quickly answer questions like *"What evidence do I need?"* or *"Where does this control sit across our frameworks?"*.

**Data protection and privacy.** Marlowe runs entirely on your infrastructure. Your documents, prompts, and embeddings never leave your environment. With Ollama or vLLM on-prem, you avoid sending sensitive data to third‑party AI APIs. That makes it suitable for regulated industries and organizations with strict data residency and privacy obligations.

The app is named after [Christopher Marlowe](https://en.wikipedia.org/wiki/Christopher_Marlowe)— Elizabethan playwright, poet, and contemporary of Shakespeare—whose work combined sharp structure, craft, and a touch of intrigue.

## Stack

- **Backend:** Python 3.10+, FastAPI, async
- **Database:** PostgreSQL
- **Vector store:** Qdrant
- **Cache:** Redis
- **Graph:** Neo4j (knowledge graph)
- **Document processing:** Docling only (PDF, DOCX, PPTX, XLSX, etc.)
- **AI:** Ollama (default) or vLLM (OpenAI-compatible)
- **Object storage:** MinIO or S3-compatible (on host)
- **Frontend:** React (Vite, TypeScript, Tailwind CSS, CopilotKit, vis-network). Preferred stack: React + Vite + Tailwind + Shadcn UI. Legacy static HTML (SB Admin 2 style) lives in `frontend-old/` and is not the default UI.
- **Deployment:** Docker Compose

## Quick start (Docker)

1. Copy `.env.example` to `.env` and set values (DB, Redis, Qdrant, Neo4j, LLM, MinIO).
2. Ensure Ollama or vLLM and MinIO run on the host or in Compose, depending on your setup.
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
   | 5023 | vLLM (optional, profile `vllm`) |

## Local development (backend only)

- Use a venv and install with `uv pip install -e ".[dev]"` or `pip install -e ".[dev]"`.
- Run Postgres, Redis, Qdrant, Neo4j via Docker Compose (e.g. `docker compose up -d postgres redis qdrant neo4j`). All host ports are 5010–5016 (see `docker-compose.yml`).
- Point `.env` at local services; for DB from host use `postgresql+asyncpg://marlowe:marlowe@localhost:5012/marlowe`; Redis `localhost:5013`, Qdrant `localhost:5014`; set `OLLAMA_HOST` and MinIO endpoint to host where those run.
- Start backend: `uvicorn app.main:app --reload`.

## Ingesting docs into Qdrant

The `docs/` folder (PDFs, DOCX, .md, etc.) can be ingested into Qdrant so **AI Chat** and search use them as context. Via the UI (AI Knowledge Base → Upload), single-file uploads are limited to **100 MB** (nginx `client_max_body_size`); increase in `docker/nginx.conf` if needed.

1. **Embeddings**: Pull or configure an embedding model (required for ingestion and RAG).
   - Ollama default: `ollama pull nomic-embed-text`
   - vLLM: set `VLLM_EMBEDDINGS_MODEL` to a supported embedding model
   
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

## NIST SP 800-53 (free, no document needed)

NIST 800-53 Rev 5 is public domain. The app **auto-seeds** the official catalog on startup if not present—end users get 1,196 controls with no action required.

- **Auto-seed:** On first startup, NIST 800-53 is loaded automatically (set `NIST_AUTO_SEED=false` to disable).
- **Manual:** Assessments → **Load NIST 800-53** button, or `POST /api/v1/nist/seed` (add `?replace_existing=true` to replace).
- **CLI:** `python -m app.scripts.seed_nist_80053` (add `--replace` to replace existing)

Catalog is fetched from [NIST OSCAL GitHub](https://github.com/usnistgov/oscal-content). Controls include base controls and enhancements with proper hierarchy (e.g. AC-2(1) under AC-2).

## Knowledge graph (Neo4j)

Frameworks and requirements are synced from Postgres to Neo4j when you create or update them via the API. For existing data, use **Sync from DB** on the Knowledge Graph page, or `POST /api/v1/graph/sync`. The graph UI (vis-network) shows frameworks and requirements and **BELONGS_TO** edges; pan and zoom to explore.

## Enterprise Grafana observability

Grafana (with Prometheus, Tempo, and the OTel collector) is available in the default Docker Compose stack for tracing and metrics. Access it at http://localhost:5017 (Admin → Observability in the UI).

**Important:** The observability stack is **not tested** with default passwords and has general security considerations:

- **Default credentials:** Grafana ships with `admin` / `admin`. Change these immediately for any non-local use.
- **No authentication:** Prometheus, Tempo, and the OTel collector expose ports without auth in the default setup.
- **Production use:** For production, use managed observability, restrict network access, configure TLS, and follow your organization's security policies. The included stack is intended for local development and testing only.

## LLM provider (Ollama or vLLM)

Marlowe supports **Ollama (default)** or **vLLM**. Configure with `LLM_PROVIDER=ollama|vllm` in `.env`.

### Ollama (on host)

The backend in Docker reaches Ollama at `host.docker.internal:11434`. **On Linux, Ollama must listen on all interfaces** so the container can connect: start it with `OLLAMA_HOST=0.0.0.0` (e.g. `OLLAMA_HOST=0.0.0.0 ollama serve`). If you use systemd:

```bash
sudo mkdir -p /etc/systemd/system/ollama.service.d
printf '[Service]\nEnvironment="OLLAMA_HOST=0.0.0.0"\n' | sudo tee /etc/systemd/system/ollama.service.d/override.conf
sudo systemctl daemon-reload && sudo systemctl restart ollama
```

To verify from the API: `GET http://localhost:5010/api/v1/llm/health` returns `{"provider": "ollama", "reachable": true}` when Ollama is reachable.

### vLLM (OpenAI-compatible)

vLLM support is **optional and untested** in Marlowe. Enable and validate it only if you
accept the security and operational implications. Configuration and deployment are left
to the end user.

Run vLLM in Docker or on the host and set:

```
LLM_PROVIDER=vllm
VLLM_BASE_URL=http://vllm:8000
VLLM_MODEL=meta-llama/Meta-Llama-3-8B-Instruct
VLLM_EMBEDDINGS_MODEL=<embedding-model-id>   # optional but recommended for RAG
```

### LLM model picker

**Chat** lets users choose a model from a dropdown. The list is loaded from `GET /api/v1/llm/models`. Send the selected model in the chat request body as `model`; the reply includes `model_used`.

## Marlowe CLI (optional)

The Marlowe CLI provides health checks and admin tasks from the terminal. **New installs** must install the package first:

```bash
# From project root (development)
pip install -e .
# or
uv sync
```

When published to PyPI: `pip install marlowe`.

Then:

```bash
marlowe --version
marlowe health              # Check API, Postgres, Redis, Qdrant, Neo4j, MinIO, LLM
marlowe health --base-url http://localhost:5010 --json
```

The Admin page (Admin → Dashboard) shows the same service status and copyable CLI commands with the live version from the backend.

## Project structure

- `app/` – FastAPI application (core, models, schemas, api, services, agents)
- `database/` – Postgres init script
- `frontend/` – **Live UI:** React + Vite + TypeScript + Tailwind, CopilotKit, vis-network (knowledge graph)
- `frontend-old/` – Legacy static HTML/CSS/JS (SB Admin 2 style), not used by default
- `docs/` – Reference documents (ingestible into Qdrant)

See [PRD.md](PRD.md) for product and architecture. See [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) for the developer's guide. See [CHANGELOG.md](CHANGELOG.md) for release notes.

## Licensed documents and Qdrant

Licensed or copyrighted documents (e.g. ISO standards) must **not** be committed. See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for details.

- **Local use:** Create `docs/licensed/` (gitignored) and place your licensed PDFs there. Ingest from `docs` as usual.
- **Public repo:** Only open-access content in `docs/` is committed.
- **Clearing Qdrant:** Before sharing a deployment or backup, clear the vector store: `DELETE /api/v1/documents/collection` or `docker compose down -v` to reset volumes.

## Required docs (do not delete)

The following files are required for the NIST AI RMF Trustworthiness Taxonomy seed. **Do not delete them**; removing them will break the taxonomy seeding feature (Assessments → Load NIST AI RMF Taxonomy).

- `docs/taxonomy-ai.md` – Source markdown for the trustworthiness taxonomy
- `docs/taxonomy-ai-clean.json` – Parsed taxonomy (used if present; falls back to `taxonomy-ai.md`)

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for full details.

## Built for AI

<p align="center"><img src="frontend/public/fedora_logo.svg.png" width="48" alt="Fedora" /> <strong>Built on Fedora</strong></p>

Marlowe was developed on a custom-built AI workstation:

| Component | Specification |
|-----------|---------------|
| **OS** | Fedora Linux 42 (KDE Plasma, Wayland) |
| **CPU** | AMD Ryzen 9 9950X (32 threads) |
| **RAM** | 128 GiB |
| **GPU** | NVIDIA GeForce RTX 4060 |

The NVIDIA GPU is used exclusively for AI workloads via the [Fedora CUDA container](https://github.com/NVIDIA/nvidia-container-toolkit)—Ollama and other LLM inference run in the container for isolation and reproducibility. The host runs on AMD integrated graphics.

*Local LLMs, vector databases, and the full stack run on this machine—no cloud required.*

## License

Marlowe is released under the [Apache License 2.0](LICENSE). See [TRADEMARK](TRADEMARK) for use of the name.
