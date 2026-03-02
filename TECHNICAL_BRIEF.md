# Marlowe - Technical Brief

**Document Version**: 1.0  
**Date**: February 2025  
**Audience**: IT Staff, SRE, DevOps, Infrastructure Engineers

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Docker Compose Services](#docker-compose-services)
4. [Port Mapping](#port-mapping)
5. [Data Persistence](#data-persistence)
6. [Security Considerations](#security-considerations)
7. [Deployment](#deployment)
8. [Monitoring & Observability](#monitoring--observability)
9. [Host Dependencies](#host-dependencies)
10. [Troubleshooting](#troubleshooting)

---

## Executive Summary

Marlowe is an AI-powered platform for AI governance, responsible AI, privacy, and global AI regulations. This Technical Brief describes the infrastructure, Docker Compose layout, port mapping, persistence, security, and deployment considerations for IT and SRE teams.

### Key Points

- **Stack**: FastAPI backend, React frontend, PostgreSQL, Qdrant, Neo4j, Redis, Ollama/vLLM, MinIO
- **Deployment**: Docker Compose (production-like); Ollama and MinIO typically run on host
- **Ports**: 5010–5023 (host ports) to avoid clashes with Docling (5001) and other stacks
- **Observability**: OpenTelemetry, Prometheus, Tempo, Grafana (for local dev/testing)

---

## Architecture Overview

### High-Level Diagram

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                     User / Browser                       │
                    └────────────────────────────┬────────────────────────────┘
                                                 │
                                                 ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  Frontend (nginx) :5011                                                               │
│  - Static React SPA                                                                   │
│  - /api/* → backend:8000                                                              │
│  - /api/copilotkit → copilot-runtime:3010                                             │
└──────────────────────────────────────────────────────────────────────────────────────┘
                                                 │
        ┌────────────────────────────────────────┼────────────────────────────────────────┐
        │                                        │                                        │
        ▼                                        ▼                                        ▼
┌───────────────┐                    ┌──────────────────────┐                    ┌───────────────┐
│ Backend       │                    │ Copilot Runtime      │                    │ Host          │
│ (FastAPI)     │                    │ (Node)               │                    │ - Ollama      │
│ :5010         │                    │ :3010 (internal)     │                    │ - MinIO       │
└───────┬───────┘                    └──────────┬───────────┘                    └───────┬───────┘
        │                                       │                                        │
        │  ┌─────────────┐  ┌─────────────┐  ┌─┴────────┐  ┌─────────────┐  ┌─────────┴──────────┐
        ├──┤ PostgreSQL  │  │ Redis       │  │ Qdrant   │  │ Neo4j       │  │ OTel Collector      │
        │  │ :5012       │  │ :5013       │  │ :5014    │  │ :5015/:5016 │  │ (internal)          │
        │  └─────────────┘  └─────────────┘  └──────────┘  └─────────────┘  └─────────────────────┘
        │                                                                           │
        │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                        │
        └──┤ Prometheus  │  │ Tempo       │  │ Grafana     │◄───────────────────────┘
           │ :5019       │  │ :5018       │  │ :5017       │
           └─────────────┘  └─────────────┘  └─────────────┘
```

### Request Flow

1. User hits frontend on port 5011 (nginx)
2. Static assets served by nginx; `/api/*` proxied to backend (FastAPI) on port 5010
3. `/api/copilotkit` proxied to CopilotKit runtime (Node) for AI chat
4. Backend uses PostgreSQL, Redis, Qdrant, Neo4j; calls Ollama/vLLM and MinIO on host via `host.docker.internal`

---

## Docker Compose Services

| Service | Image | Purpose |
|---------|-------|---------|
| **backend** | Custom (Dockerfile.backend) | FastAPI app, API routes, agents |
| **frontend** | Custom (Dockerfile.frontend) | Nginx + built React SPA |
| **copilot-runtime** | Custom (Dockerfile.copilot-runtime) | CopilotKit runtime (Node), AI chat |
| **postgres** | postgres:15-alpine | Primary database |
| **redis** | redis:7-alpine | Cache / sessions |
| **qdrant** | qdrant/qdrant:latest | Vector store (embeddings) |
| **neo4j** | neo4j:5 | Knowledge graph |
| **otel-collector** | otel/opentelemetry-collector-contrib | OTLP receiver, Prometheus exporter |
| **tempo** | grafana/tempo | Trace storage |
| **prometheus** | prom/prometheus | Metrics |
| **grafana** | grafana/grafana | Dashboards, Explore (Tempo) |
| **postgres-exporter** | prometheuscommunity/postgres-exporter | Postgres metrics |
| **redis-exporter** | oliver006/redis_exporter | Redis metrics |
| **cadvisor** | gcr.io/cadvisor/cadvisor | Container metrics |
| **vllm** | vllm/vllm-openai (profile: vllm) | Optional OpenAI-compatible LLM |

### Optional vLLM

```bash
docker compose --profile vllm up -d
```

Enables vLLM on port 5023; set `LLM_PROVIDER=vllm` in `.env`.

---

## Port Mapping

| Host Port | Container Port | Service | Description |
|-----------|----------------|---------|-------------|
| 5010 | 8000 | backend | FastAPI API |
| 5011 | 80 | frontend | Nginx (React SPA) |
| 5012 | 5432 | postgres | PostgreSQL |
| 5013 | 6379 | redis | Redis |
| 5014 | 6333 | qdrant | Qdrant HTTP |
| 5015 | 7474 | neo4j | Neo4j HTTP (browser) |
| 5016 | 7687 | neo4j | Neo4j Bolt |
| 5017 | 3000 | grafana | Grafana |
| 5018 | 3200 | tempo | Tempo |
| 5019 | 9090 | prometheus | Prometheus |
| 5020 | 8080 | cadvisor | cAdvisor |
| 5021 | 9187 | postgres-exporter | Postgres exporter |
| 5022 | 9121 | redis-exporter | Redis exporter |
| 5023 | 8000 | vllm | vLLM (optional, profile `vllm`) |

Internal-only: otel-collector (4317/4318 OTLP), copilot-runtime (3010).

---

## Data Persistence

### Docker Volumes

| Volume | Service | Path | Contents |
|--------|---------|------|----------|
| `postgres_data` | postgres | /var/lib/postgresql/data | Database files |
| `qdrant_data` | qdrant | /qdrant/storage | Vector index |
| `neo4j_data` | neo4j | /data | Graph data |
| `tempo_data` | tempo | /var/tempo | Traces |
| `vllm_cache` | vllm | /root/.cache/huggingface | Model cache (if vLLM used) |

### Backup Recommendations

- **PostgreSQL**: `pg_dump` or `pg_dumpall`; consider WAL archiving for point-in-time recovery
- **Qdrant**: Snapshot API or volume backup
- **Neo4j**: `neo4j-admin dump` or volume backup
- **MinIO** (on host): S3-compatible backup or replication

### Resetting Data

```bash
docker compose down -v   # Removes volumes; fresh start
```

**Warning**: This deletes all data (Postgres, Qdrant, Neo4j, Tempo).

---

## Security Considerations

### Default Credentials (Change in Production)

| Service | Default User | Default Password |
|---------|--------------|------------------|
| PostgreSQL | marlowe | marlowe |
| Neo4j | neo4j | password |
| MinIO | minioadmin | minioadmin |
| Grafana | admin | admin |
| Marlowe | - | SECRET_KEY=change-me-in-production |

### Recommendations

1. **SECRET_KEY**: Set a strong value in `.env` for production
2. **Database passwords**: Override via environment in `docker-compose.yml` or `.env`
3. **Neo4j**: Change `NEO4J_AUTH` before exposing
4. **MinIO**: Use strong `MINIO_ACCESS_KEY` and `MINIO_SECRET_KEY`
5. **CORS**: Restrict `cors_origins` in `app/core/config.py` for production
6. **Network**: Consider placing backend and databases on internal networks; expose only frontend/nginx
7. **TLS**: Add TLS termination (reverse proxy) for production; nginx currently serves HTTP only

### Host Access

Backend uses `host.docker.internal:host-gateway` to reach Ollama and MinIO on the host. Ensure these services are properly secured and not exposed unnecessarily.

---

## Deployment

### Quick Start

```bash
cp .env.example .env
# Edit .env: DB, Redis, Qdrant, Neo4j, Ollama, MinIO

# Start Ollama and MinIO on host
ollama serve
minio server /data   # or your MinIO setup

# Linux: Ollama must listen on 0.0.0.0 for Docker
OLLAMA_HOST=0.0.0.0 ollama serve

docker compose up -d
```

### Rebuild Frontend

If the UI shows outdated content:

```bash
docker compose build --no-cache frontend && docker compose up -d
```

### Resource Requirements

- **Minimum**: 8 GB RAM
- **Recommended**: 16 GB+ RAM for AI workloads (Ollama models, embeddings)
- **Storage**: SSD preferred; allow for Postgres, Qdrant, Neo4j, and MinIO growth

### Production Notes

- Use external managed services (RDS, ElastiCache, etc.) if desired; update `DATABASE_URL`, `REDIS_URL`, etc.
- Configure external Prometheus/Grafana or managed observability; the included stack is for local dev/testing
- Set up log aggregation (e.g. Loki, CloudWatch)
- Consider horizontal scaling for backend (stateless); database and Qdrant/Neo4j need appropriate sizing

---

## Monitoring & Observability

### Stack (Local Dev / Testing)

- **OpenTelemetry**: FastAPI, httpx, LangChain instrumented; traces exported via OTLP to collector
- **Prometheus**: Scrapes otel-collector, postgres-exporter, redis-exporter, Qdrant, cAdvisor
- **Tempo**: Stores traces; queryable from Grafana Explore
- **Grafana**: Pre-provisioned dashboards; Explore → Tempo for trace search

### Access

- **Grafana**: http://localhost:5017 (admin/admin)
- **Prometheus**: http://localhost:5019

### What Is Instrumented

- HTTP requests (FastAPI)
- Outbound HTTP (httpx)
- LangChain/LLM calls (when `OTEL_ENABLED=true`)
- Postgres, Redis, Qdrant metrics
- Container metrics (cAdvisor)

### Production

The included observability stack is **not production-ready**. For production:

- Configure retention, alerting, and security
- Use managed solutions (Grafana Cloud, Datadog, etc.) or self-hosted with proper hardening
- Ensure credentials and data handling meet compliance requirements

---

## Host Dependencies

### Ollama

- **Purpose**: Chat and embeddings (default LLM provider)
- **URL**: `http://host.docker.internal:11434`
- **Models**: `ollama pull nomic-embed-text`, `ollama pull qwen3`, etc.
- **Linux**: Must listen on `0.0.0.0` so Docker can connect

### MinIO

- **Purpose**: S3-compatible object storage for uploaded documents
- **URL**: `host.docker.internal:9000` (default)
- **Bucket**: `marlowe`
- **Note**: MinIO is not in docker-compose; run on host or another stack

---

## Troubleshooting

### Services Not Healthy

```bash
docker compose ps
docker compose logs backend
curl http://localhost:5010/api/v1/health
curl http://localhost:5010/api/v1/admin/services
marlowe health
marlowe health --json
```

### Ollama Unreachable

- Ensure Ollama is running on host
- Linux: `OLLAMA_HOST=0.0.0.0 ollama serve`
- Check `OLLAMA_HOST` in backend environment

### Document Upload Fails

- MinIO must be running and reachable
- Check `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`
- Verify nginx `client_max_body_size` (100 MB default) in `docker/nginx.conf`

### Frontend Shows Wrong Content

```bash
docker compose build --no-cache frontend && docker compose up -d frontend
```

### Database Connection Errors

- Verify Postgres is healthy: `docker compose ps postgres`
- Check `DATABASE_URL` format: `postgresql+asyncpg://user:pass@host:port/db`
- From host, use `localhost:5012` for Postgres port

### Clearing All Data

```bash
docker compose down -v
docker compose up -d
```

---

## Quick Reference

### URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5011 |
| Backend API | http://localhost:5010 |
| API Docs | http://localhost:5010/docs |
| Neo4j Browser | http://localhost:5015 |
| Grafana | http://localhost:5017 |
| Prometheus | http://localhost:5019 |

### Key Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Service definitions |
| `.env` | Environment overrides |
| `docker/nginx.conf` | Nginx config (frontend container) |
| `observability/*.yaml` | OTel, Prometheus, Tempo, Grafana configs |
| `Dockerfile.backend` | Backend image |
| `Dockerfile.frontend` | Frontend (nginx + React) image |
| `Dockerfile.copilot-runtime` | CopilotKit runtime image |

---

**Marlowe is a trademark of GallowGlass AI.**

**Last Updated**: February 2025
