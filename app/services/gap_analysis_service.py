"""Gap analysis service – orchestrates LangGraph agents with DB and Qdrant context."""

import logging
from typing import Any, Callable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.gap_analysis_graph import run_gap_analysis, run_gap_analysis_with_progress
from app.core.config import settings
from app.models import Framework, Requirement
from app.services.ollama_service import ollama_embeddings
from app.services.qdrant_service import ensure_collection, search

logger = logging.getLogger(__name__)

CONTEXT_CHUNKS_MAX = 12
CONTEXT_CHAR_LIMIT = 8000


async def get_requirements_summary(db: AsyncSession, framework_id: int) -> str:
    """Fetch requirements for a framework and return a formatted summary."""
    result = await db.execute(
        select(Requirement)
        .where(Requirement.framework_id == framework_id)
        .order_by(Requirement.identifier)
    )
    reqs = list(result.scalars().all())
    parts = []
    for r in reqs:
        parts.append(
            f"- {r.identifier}: {r.title}\n  {r.description or '(No description)'}"
        )
    return "\n\n".join(parts) if parts else "No requirements defined for this framework."


async def get_evidence_context(query: str, framework_id: int | None = None) -> str:
    """
    Retrieve relevant evidence from Qdrant via semantic search.
    Uses the given query (e.g. framework name + requirements summary) to find chunks.
    If framework_id is set, only returns documents linked to that framework.
    """
    try:
        ensure_collection()
        query_vector = await ollama_embeddings(query, model=settings.embedding_model)
        if not query_vector:
            return ""
        results = search(
            settings.qdrant_collection,
            query_vector,
            limit=CONTEXT_CHUNKS_MAX,
            framework_id=framework_id,
        )
        parts = []
        total = 0
        for r in results:
            payload = r.payload or {}
            text = payload.get("text") or ""
            source = payload.get("source") or ""
            prefix = f"[From: {source}]\n" if source else ""
            chunk = f"{prefix}{text}" if prefix else text
            if not text or total + len(chunk) > CONTEXT_CHAR_LIMIT:
                continue
            parts.append(chunk)
            total += len(chunk)
        return "\n\n---\n\n".join(parts) if parts else ""
    except Exception as e:
        logger.warning("Failed to retrieve evidence context from Qdrant: %s", e)
        return ""


async def run_gap_analysis_for_framework(
    db: AsyncSession,
    framework_id: int,
) -> dict[str, Any]:
    """
    Run gap analysis for a framework: fetch requirements, gather evidence from Qdrant,
    invoke LangGraph agents, return report.
    """
    result = await db.execute(
        select(Framework).where(Framework.id == framework_id)
    )
    framework = result.scalar_one_or_none()
    if not framework:
        return {"ok": False, "output": "", "error": "Framework not found"}

    requirements_summary = await get_requirements_summary(db, framework_id)
    search_query = f"{framework.name} {framework.description or ''} {requirements_summary[:500]}"
    evidence_context = await get_evidence_context(search_query, framework_id=framework_id)

    report = await run_gap_analysis(
        framework_name=framework.name,
        requirements_summary=requirements_summary,
        evidence_context=evidence_context,
    )
    return report


async def run_gap_analysis_for_framework_with_progress(
    db: AsyncSession,
    framework_id: int,
    progress_callback: Callable[[int, str], None] | None = None,
) -> dict[str, Any]:
    """
    Run gap analysis in background with progress updates.
    progress_callback(percent: int, step: str) is called as each agent completes.
    """
    result = await db.execute(
        select(Framework).where(Framework.id == framework_id)
    )
    framework = result.scalar_one_or_none()
    if not framework:
        return {"ok": False, "output": "", "error": "Framework not found"}

    requirements_summary = await get_requirements_summary(db, framework_id)
    search_query = f"{framework.name} {framework.description or ''} {requirements_summary[:500]}"
    evidence_context = await get_evidence_context(search_query, framework_id=framework_id)

    return await run_gap_analysis_with_progress(
        framework_name=framework.name,
        requirements_summary=requirements_summary,
        evidence_context=evidence_context,
        progress_callback=progress_callback,
    )
