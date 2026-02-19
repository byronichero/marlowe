"""Crosswalk service – map requirements between two frameworks using embeddings."""

import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import Framework, Requirement
from app.services.ollama_service import ollama_embeddings

logger = logging.getLogger(__name__)


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(x * x for x in b) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def _req_text(req: Requirement) -> str:
    """Build text for embedding from requirement."""
    parts = [req.identifier, req.title or ""]
    if req.description:
        parts.append(req.description[:500])
    return " ".join(p for p in parts if p).strip() or req.identifier


async def generate_crosswalk(
    db: AsyncSession,
    framework_a_id: int,
    framework_b_id: int,
) -> dict[str, Any]:
    """
    Generate a crosswalk mapping requirements from framework A to framework B.
    Uses embedding similarity to find the best-matching requirement in B for each in A.
    Returns { mappings: [...], framework_a: {...}, framework_b: {...} }.
    """
    result_a = await db.execute(
        select(Framework).where(Framework.id == framework_a_id)
    )
    result_b = await db.execute(
        select(Framework).where(Framework.id == framework_b_id)
    )
    fw_a = result_a.scalar_one_or_none()
    fw_b = result_b.scalar_one_or_none()
    if not fw_a or not fw_b:
        return {"error": "Framework not found", "mappings": []}

    reqs_a = await db.execute(
        select(Requirement)
        .where(Requirement.framework_id == framework_a_id)
        .order_by(Requirement.identifier)
    )
    reqs_b = await db.execute(
        select(Requirement)
        .where(Requirement.framework_id == framework_b_id)
        .order_by(Requirement.identifier)
    )
    list_a = list(reqs_a.scalars().all())
    list_b = list(reqs_b.scalars().all())

    if not list_a or not list_b:
        return {
            "mappings": [],
            "framework_a": {"id": fw_a.id, "name": fw_a.name},
            "framework_b": {"id": fw_b.id, "name": fw_b.name},
            "message": "One or both frameworks have no requirements.",
        }

    # Embed all requirements
    model = settings.embedding_model
    vecs_a: list[list[float]] = []
    for r in list_a:
        text = _req_text(r)
        vec = await ollama_embeddings(text, model=model)
        dim = getattr(settings, "embedding_dimension", 768)
        vecs_a.append(vec if vec else [0.0] * dim)

    vecs_b: list[list[float]] = []
    for r in list_b:
        text = _req_text(r)
        vec = await ollama_embeddings(text, model=model)
        dim = getattr(settings, "embedding_dimension", 768)
        vecs_b.append(vec if vec else [0.0] * dim)

    # For each req in A, find best match in B
    mappings: list[dict[str, Any]] = []
    for i, req_a in enumerate(list_a):
        best_j = -1
        best_sim = -1.0
        for j, vec_b in enumerate(vecs_b):
            sim = _cosine_similarity(vecs_a[i], vec_b)
            if sim > best_sim:
                best_sim = sim
                best_j = j
        if best_j >= 0:
            req_b = list_b[best_j]
            mappings.append({
                "requirement_a": {
                    "id": req_a.id,
                    "identifier": req_a.identifier,
                    "title": req_a.title,
                    "description": req_a.description,
                },
                "requirement_b": {
                    "id": req_b.id,
                    "identifier": req_b.identifier,
                    "title": req_b.title,
                    "description": req_b.description,
                },
                "similarity": round(best_sim, 4),
            })

    return {
        "mappings": mappings,
        "framework_a": {"id": fw_a.id, "name": fw_a.name},
        "framework_b": {"id": fw_b.id, "name": fw_b.name},
    }
