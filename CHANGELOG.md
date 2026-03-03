# Changelog

All notable changes to Marlowe are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.0] - 2026-03-03

### Added

- **AI Chat & Knowledge Base** – RAG-powered chat over documents, framework context, and knowledge graph (CopilotKit, optional voice)
- **GRC & Gap Analysis** – Frameworks (ISO, NIST), evidence upload, requirement extraction, LangGraph multi-agent gap assessment
- **NIST AI RMF Trustworthiness Taxonomy** – 150 outcome-based properties with CMMI-style maturity (0–5), entry-table assessment, bar chart visualization
- **NIST 800-53** – Auto-seed of official catalog on startup; 1,196 controls
- **Knowledge Graph** – Neo4j visualization of frameworks, requirements, and relationships; sync from PostgreSQL
- **AI Readiness Check** – Checklist with radar visualization and action plan
- **Standards Library** – Curated frameworks and document preview
- **Reports** – Gap analysis report persistence
- **Admin Dashboard** – Service status (API, Postgres, Redis, Qdrant, Neo4j, MinIO, LLM), copyable CLI commands
- **Marlowe CLI** – `marlowe health`, `marlowe --version` for health checks and version
- **Splash video** – Optional intro video on first visit (muted autoplay, “Don’t show again”)
- **Watch Intro** – Dedicated `/splash` route and nav link to re-watch intro
- **Synthetic taxonomy script** – `scripts/synth_taxonomy.py` to seed random maturity scores for demos
- **Optional vLLM** – Self-hosted inference via OpenAI-compatible vLLM (profile-based in Docker)

### Stack

- Backend: Python 3.10+, FastAPI, async
- Databases: PostgreSQL, Redis, Qdrant, Neo4j
- AI: Ollama (default) or vLLM
- Frontend: React, Vite, TypeScript, Tailwind CSS, Shadcn UI, CopilotKit, vis-network
- Deployment: Docker Compose

---

Marlowe is a trademark of GallowGlass AI.
