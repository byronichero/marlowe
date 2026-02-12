"""Qdrant service for document embeddings and semantic search."""

import logging
from typing import Any

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, PointStruct, VectorParams

from app.core.config import settings

logger = logging.getLogger(__name__)


def get_qdrant_client() -> QdrantClient:
    """Return a Qdrant client."""
    return QdrantClient(host=settings.qdrant_host, port=settings.qdrant_port)


def ensure_collection(
    client: QdrantClient | None = None,
    vector_size: int | None = None,
) -> None:
    """Ensure the configured collection exists (e.g. for embeddings). Uses settings.embedding_dimension (768 for nomic-embed-text)."""
    size = vector_size if vector_size is not None else getattr(settings, "embedding_dimension", 768)
    c = client or get_qdrant_client()
    collections = c.get_collections().collections
    names = {c.name for c in collections}
    if settings.qdrant_collection not in names:
        c.create_collection(
            collection_name=settings.qdrant_collection,
            vectors_config=VectorParams(size=size, distance=Distance.COSINE),
        )


def upsert_points(
    collection: str,
    points: list[PointStruct],
    client: QdrantClient | None = None,
) -> None:
    """Upsert points into a collection."""
    c = client or get_qdrant_client()
    c.upsert(collection_name=collection, points=points)


def search(
    collection: str,
    query_vector: list[float],
    limit: int = 10,
    client: QdrantClient | None = None,
) -> list[Any]:
    """Semantic search; returns list of scored points (payload, score, etc.).
    Uses query_points (qdrant-client 1.12+); legacy search() was removed.
    """
    c = client or get_qdrant_client()
    response = c.query_points(
        collection_name=collection,
        query=query_vector,
        limit=limit,
        with_payload=True,
        with_vectors=False,
    )
    return list(response.points) if response.points else []


def list_document_sources(
    collection: str,
    client: QdrantClient | None = None,
    max_points: int = 5000,
) -> list[str]:
    """
    Scroll through the collection and return unique document source names (filenames/paths).
    Used so the chat can answer questions like 'which documents are stored?'.
    """
    c = client or get_qdrant_client()
    seen: set[str] = set()
    offset = None
    fetched = 0
    try:
        while fetched < max_points:
            records, next_offset = c.scroll(
                collection_name=collection,
                limit=min(500, max_points - fetched),
                offset=offset,
                with_payload=["source"],
                with_vectors=False,
            )
            for rec in records:
                payload = rec.payload or {}
                src = payload.get("source")
                if isinstance(src, str) and src.strip():
                    seen.add(src.strip())
            fetched += len(records)
            if not next_offset or not records:
                break
            offset = next_offset
    except Exception as e:
        logger.warning("Failed to list document sources from Qdrant: %s", e)
        return []
    return sorted(seen)


def get_recent_documents(
    collection: str,
    client: QdrantClient | None = None,
    hours: int = 24,
    max_points: int = 5000,
) -> list[dict[str, str]]:
    """
    Get recently uploaded documents (within the last N hours).
    Returns list of {source, uploaded_at} dicts, sorted by timestamp (newest first).
    """
    from datetime import datetime, timedelta, timezone

    c = client or get_qdrant_client()
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    cutoff_iso = cutoff.isoformat()

    recent_docs: dict[str, str] = {}  # source -> uploaded_at
    offset = None
    fetched = 0

    try:
        while fetched < max_points:
            records, next_offset = c.scroll(
                collection_name=collection,
                limit=min(500, max_points - fetched),
                offset=offset,
                with_payload=["source", "uploaded_at"],
                with_vectors=False,
            )
            for rec in records:
                payload = rec.payload or {}
                src = payload.get("source")
                uploaded_at = payload.get("uploaded_at")
                if isinstance(src, str) and isinstance(uploaded_at, str):
                    if uploaded_at >= cutoff_iso:
                        # Keep the most recent timestamp for each source
                        if src not in recent_docs or uploaded_at > recent_docs[src]:
                            recent_docs[src] = uploaded_at
            fetched += len(records)
            if not next_offset or not records:
                break
            offset = next_offset
    except Exception as e:
        logger.warning("Failed to get recent documents from Qdrant: %s", e)
        return []

    # Sort by timestamp, newest first
    result = [
        {"source": src, "uploaded_at": ts} for src, ts in recent_docs.items()
    ]
    result.sort(key=lambda x: x["uploaded_at"], reverse=True)
    return result
