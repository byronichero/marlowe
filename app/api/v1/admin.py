"""Admin API – service status and version."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from fastapi import APIRouter

from app.core.config import settings
from app.services.graph_service import get_graph_health
from app.services.llm_service import llm_provider, llm_reachable

logger = logging.getLogger(__name__)

router = APIRouter()


async def _check_postgres() -> dict[str, Any]:
    """Check PostgreSQL connectivity."""
    try:
        from sqlalchemy import text

        from app.core.database import engine

        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return {"status": "healthy", "message": "Connected"}
    except Exception as e:
        logger.warning("Postgres health check failed: %s", e)
        return {"status": "unreachable", "message": str(e)[:200]}


def _check_redis() -> dict[str, Any]:
    """Check Redis connectivity."""
    try:
        import redis

        r = redis.from_url(settings.redis_url)
        r.ping()
        return {"status": "healthy", "message": "Connected"}
    except Exception as e:
        return {"status": "unreachable", "message": str(e)[:200]}


def _check_qdrant() -> dict[str, Any]:
    """Check Qdrant connectivity."""
    try:
        from app.services.qdrant_service import get_qdrant_client

        client = get_qdrant_client()
        client.get_collections()
        return {"status": "healthy", "message": "Connected"}
    except Exception as e:
        return {"status": "unreachable", "message": str(e)[:200]}


def _check_minio() -> dict[str, Any]:
    """Check MinIO connectivity."""
    try:
        from app.services.minio_client import get_minio_client

        client = get_minio_client()
        client.list_buckets()
        return {"status": "healthy", "message": "Connected"}
    except Exception as e:
        return {"status": "unreachable", "message": str(e)[:200]}


@router.get("/services")
async def get_services_status() -> dict[str, Any]:
    """Return per-service health status for API, Postgres, Redis, Qdrant, Neo4j, MinIO, LLM."""
    loop = asyncio.get_running_loop()

    # API: always healthy if we're here
    api_status = {"status": "healthy", "message": "OK"}

    # Run sync checks in executor (they block)
    redis_task = loop.run_in_executor(None, _check_redis)
    qdrant_task = loop.run_in_executor(None, _check_qdrant)
    minio_task = loop.run_in_executor(None, _check_minio)

    # Async checks
    postgres_status, neo4j_health, llm_result = await asyncio.gather(
        _check_postgres(),
        get_graph_health(),
        llm_reachable(),
    )
    neo4j_status = {"status": "healthy" if neo4j_health.status == "ok" else "degraded", "message": neo4j_health.version}
    llm_ok, llm_err = llm_result
    llm_status = {"status": "healthy" if llm_ok else "unreachable", "message": llm_err or f"Provider: {llm_provider()}"}

    redis_status = await redis_task
    qdrant_status = await qdrant_task
    minio_status = await minio_task

    return {
        "services": {
            "api": api_status,
            "postgres": postgres_status,
            "redis": redis_status,
            "qdrant": qdrant_status,
            "neo4j": neo4j_status,
            "minio": minio_status,
            "llm": llm_status,
        }
    }


@router.get("/version")
async def get_version() -> dict[str, Any]:
    """Return app and CLI version for display on admin page."""
    try:
        from importlib.metadata import version

        app_version = version("marlowe")
    except Exception:
        app_version = "0.1.0"
    return {"app_version": app_version, "cli_version": app_version}
