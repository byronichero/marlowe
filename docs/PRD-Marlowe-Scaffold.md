# Product Requirements Document: Marlowe – Application Scaffold

**Version:** 1.0  
**Purpose:** Define Marlowe’s application structure, architecture, and capabilities so a new codebase can be built from scratch with the same shape. Marlowe is an AI app for AI governance, responsible AI, privacy, and global AI regulations (framework-agnostic; no legacy subject matter such as CMMC-specific logic or naming).

---

## 1. Executive Summary

**Product name:** Marlowe  
**Type:** AI application for **AI governance**, **responsible AI**, **privacy**, and **global AI regulations**. Marlowe supports compliance, assessments, and evidence across frameworks (e.g. EU AI Act, GDPR, NIST AI RMF)—framework-agnostic.  
**Goal of this PRD:** Provide a single reference to recreate Marlowe’s *structure* in a new folder and build from scratch—same stack, same high-level features, generic “frameworks / requirements / levels / controls” only.

---

## 2. High-Level Architecture

- **Backend:** Python (FastAPI), async where appropriate.
- **Database:** PostgreSQL (main app data).
- **Vector store:** Qdrant (document/control embeddings, semantic search).
- **Cache / sessions:** Redis.
- **Graph:** Neo4j (required)—relationships between controls/requirements; knowledge graph is a core feature.
- **Document processing:** **[Docling](https://github.com/docling-project/docling)** for **all** document processing. No PyPDF2, python-docx, openpyxl, etc. for parsing—use Docling exclusively for PDF, DOCX, PPTX, XLSX, HTML, images, and other [supported formats](https://docling-project.github.io/docling/usage/supported_formats/). Export to Markdown or text for indexing and AI context.
- **AI:** Ollama on host (Q&A, embeddings); optional vLLM when implemented; no AI in containers.
- **Object storage:** MinIO (or S3-compatible) on host; backend connects via config/credentials.
- **Frontend:** Static HTML/JS/CSS (e.g. SB Admin 2–style), served by nginx in Docker. No React/Next build required for scaffold.
- **Deployment:** Docker Compose; backend and frontend as separate services; DBs and MinIO/Ollama as specified above.

---

## 3. Application Structure (What to Recreate)

### 3.1 Backend layout (conceptual)

- **`app/main.py`** – FastAPI app, lifespan, CORS, health, mount API router.
- **`app/core/`** – Config (env-based), database (async session, `init_db`), security/auth placeholders.
- **`app/models/`** – SQLAlchemy models: e.g. **Framework**, **Requirement**, **Assessment**, **Evidence**, **Organization**, **User**; optional **Control**-style model with level/family (generic, not CMMC-named).
- **`app/schemas/`** – Pydantic request/response models for API.
- **`app/api/v1/`** – Versioned API router; endpoints for frameworks, requirements, assessments, evidence, chat, reports, **graph (required)**, health.
- **`app/services/`** – Business logic: **document service (Docling-only)** for parsing and text extraction, MinIO/S3 client, Qdrant service, Ollama service, AI/chat service, optional “crew”/report service, **Neo4j/graph service**.
- **`database/init.sql`** – Postgres init (extensions, grants only if needed; tables can be created by the app).

### 3.2 Frontend layout (conceptual)

- **Static pages:** `menu.html`, `dashboard.html`, `chat.html`, `controls.html`, `assessments.html`, `reports.html`, `documents.html`, **`knowledge-graph.html`** (required), `help.html`, `faq.html`, `login.html`, `register.html`.
- **Shared:** Common CSS/JS (e.g. SB Admin 2), one nginx config serving `*.html` and assets.
- **Navigation:** Sidebar and topbar; links only to existing pages (no `compliance.html` / `training.html` / `index.html` unless those files exist). “Home” entry point: `menu.html` (or equivalent).
- **API base URL:** Configurable (e.g. env or single constant) pointing at backend.

### 3.3 Configuration and deployment

- **Environment:** Backend gets DB URL, Redis URL, Qdrant host/port, **Neo4j URI and credentials**, Ollama host/port, MinIO endpoint and credentials (or path to credentials file), secret key, etc., via env (e.g. Compose).
- **Credentials:** MinIO (and similar) via env or a single credentials file (e.g. `credentials.json`) with endpoint, access key, secret key; no CMMC-specific naming.
- **Docker Compose:** One file defining backend, frontend, postgres, redis, qdrant, **neo4j**; no MinIO container if MinIO runs on host. Backend uses `host.docker.internal` (or Linux equivalent) for Ollama and MinIO when running in Docker.

---

## 4. Features (Structure Only)

Describe these in a framework-agnostic way so the new app can be “Marlowe” without any CMMC:

1. **Frameworks and requirements** – CRUD for frameworks (e.g. “EU AI Act”, “GDPR”) and requirements tied to frameworks; levels/tiers if needed (generic).
2. **Assessments** – Create and manage assessments linked to frameworks/organizations; store status and metadata.
3. **Evidence** – Attach evidence to requirements/assessments; store in MinIO and/or local uploads; optional indexing in Qdrant.
4. **Documents** – List/upload documents; **all** parsing and text extraction via **Docling** (PDF, DOCX, PPTX, XLSX, HTML, images, etc.). Export to Markdown/text and feed to Qdrant for semantic search. No other document-parsing libraries for content extraction.
5. **Controls (or requirements) browser** – List/filter “controls” or “requirements” by level/family (generic); data from DB and/or import (e.g. CSV/Excel) with a generic schema.
6. **AI chat** – Chat endpoint; calls Ollama (and optionally Qdrant/document context) for Q&A; no CMMC-specific prompts or roles.
7. **Reports** – Report generation (e.g. by assessment, framework, date); optional AI-assisted summaries (generic).
8. **Knowledge graph (required)** – Neo4j-backed graph of relationships between controls/requirements/frameworks; dedicated API and **`knowledge-graph.html`** page to visualize and explore the graph.
9. **FAQ** – Simple FAQ list/search from DB; categories and tags generic.
10. **Help** – Static help/documentation page; no CMMC-only content.

---

## 5. Data Model (Generic)

- **Framework** – Name, slug, optional metadata (e.g. region, type).  
- **Requirement / Control** – Identifier, title, description, framework_id, optional level/family (generic strings).  
- **Organization** – Name, optional level/tier (generic).  
- **Assessment** – Title, status, framework_id and/or organization_id, dates.  
- **RequirementAssessment / ControlAssessment** – Links assessment to requirement/control; status, notes.  
- **Evidence** – File reference (e.g. MinIO key or path), linked to requirement/control and assessment.  
- **User** – Auth fields and roles (placeholder OK for scaffold).  
- **FAQ** – Question, answer, category, tags (generic).

No “CMMC” in table or column names; use “level”, “family”, “control”, “requirement”, “framework”.

**Graph (Neo4j):** Nodes for frameworks, requirements/controls, assessments; edges for “belongs to”, “references”, “depends on”, etc., so the knowledge graph is queryable and visualizable.

---

## 5.1 Document Processing (Docling)

**Rule:** Use [Docling](https://github.com/docling-project/docling) for **all** document processing. No PyPDF2, python-docx, openpyxl, python-pptx, or similar for parsing document content.

- **Ingestion:** When a user uploads a file or the system ingests from MinIO, run it through Docling’s `DocumentConverter` (or equivalent API).
- **Formats:** Rely on Docling’s [supported formats](https://docling-project.github.io/docling/usage/supported_formats/) (PDF, DOCX, PPTX, XLSX, HTML, images, etc.). Add new formats only via Docling, not extra libraries.
- **Output:** Use Docling’s export (e.g. Markdown or text) for: storing extracted text, indexing in Qdrant, and supplying context to Ollama/chat.
- **Integration:** Document service in the backend should depend on Docling only for parsing; MinIO/local storage for blobs; Qdrant for vectors.

---

## 6. How to Use This PRD

1. **Create a new folder** (or repo) for the new Marlowe codebase.
2. **Use this PRD** as the single source of truth for:
   - Stack (FastAPI, Postgres, Qdrant, Redis, **Neo4j**, **Docling (all document processing)**, Ollama, MinIO, Docker, static frontend).
   - Backend/frontend layout and feature list (including **required** knowledge graph and **Docling-only** document processing).
   - Generic data model and config (no CMMC).
3. **Build from scratch** in that folder: implement only what’s described here, with generic naming and no CMMC.
4. **Reuse** from the current project only: high-level architecture, Docker layout, and maybe snippets (e.g. MinIO client, Qdrant service, Ollama client, **Neo4j/graph service**) after generalizing names and removing CMMC. **Do not** reuse legacy document parsing (PyPDF2, python-docx, etc.); use Docling instead.
