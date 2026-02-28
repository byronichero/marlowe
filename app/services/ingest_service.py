"""Ingest documents from a folder into Qdrant: extract text (Docling), chunk, embed (LLM), upsert."""

import io
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.core.config import settings
from app.services.document_service import extract_text_from_file
from app.services.llm_service import llm_embeddings
from app.services.qdrant_service import ensure_collection, get_qdrant_client, upsert_points
from qdrant_client.models import PointStruct

logger = logging.getLogger(__name__)

# Extensions we can process: Docling for these, or read as text for .md
DOCLING_EXTENSIONS = {".pdf", ".docx", ".pptx", ".xlsx", ".html", ".htm"}
TEXT_EXTENSIONS = {".md", ".markdown", ".txt"}
INGEST_EXTENSIONS = DOCLING_EXTENSIONS | TEXT_EXTENSIONS

CHUNK_SIZE = 800
CHUNK_OVERLAP = 150
UPSERT_BATCH_SIZE = 200


def _chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split text into overlapping chunks for embedding."""
    if not text or not text.strip():
        return []
    chunks: list[str] = []
    start = 0
    text = text.strip()
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        # Prefer breaking at paragraph or sentence
        if end < len(text):
            for sep in ["\n\n", "\n", ". ", " "]:
                last = chunk.rfind(sep)
                if last > chunk_size // 2:
                    chunk = chunk[: last + len(sep)]
                    end = start + last + len(sep)
                    break
        chunk = chunk.strip()
        if chunk:
            chunks.append(chunk)
        start = end - overlap
        if start >= len(text):
            break
    return chunks


def _stable_point_id(source_path: str, chunk_index: int) -> uuid.UUID:
    """Stable UUID for upsert (re-ingestion replaces points). Qdrant accepts UUID or int only."""
    key = f"{source_path}:{chunk_index}"
    return uuid.uuid5(uuid.NAMESPACE_DNS, key)


def _batched(iterable: list[PointStruct], batch_size: int) -> list[list[PointStruct]]:
    """Split a list into batches for Qdrant upsert."""
    return [iterable[i : i + batch_size] for i in range(0, len(iterable), batch_size)]


def _resolve_docs_path() -> Path:
    """Resolve docs path: absolute or relative to cwd."""
    p = Path(settings.docs_path)
    if p.is_absolute():
        return p
    return Path.cwd() / p


def _iter_doc_files(root: Path):
    """Yield (path, relative_path_str) for each ingestible file under root."""
    if not root.exists():
        logger.warning("Docs path does not exist: %s", root)
        return
    for f in root.iterdir():
        if f.is_file() and f.suffix.lower() in INGEST_EXTENSIONS:
            yield f, str(f.relative_to(root))


async def _embed_chunks(chunks: list[str]) -> list[list[float]]:
    """Get embeddings for each chunk via Ollama (sequential to avoid overload)."""
    vectors = []
    for chunk in chunks:
        try:
            vec = await llm_embeddings(chunk, model=settings.embedding_model)
            vectors.append(vec)
        except Exception as e:
            logger.warning("Embedding failed for chunk (len=%s): %s", len(chunk), e)
            # Append zero vector so we don't break indexing; or skip point
            vectors.append([0.0] * settings.embedding_dimension)
    return vectors


def _extract_text_from_path(file_path: Path, ext: str) -> str:
    """Extract text from file: Docling for supported types, else read as text."""
    if ext in TEXT_EXTENSIONS:
        return file_path.read_text(encoding="utf-8", errors="replace")
    return extract_text_from_file(file_path=file_path)


async def ingest_single_file(
    file_content: bytes,
    filename: str,
    framework_id: int | None = None,
) -> dict[str, Any]:
    """
    Ingest one document (bytes + filename) into Qdrant: extract, chunk, embed, upsert.
    If framework_id is provided, links the document to that framework for gap analysis evidence.
    Returns {"ok": True, "filename": str, "chunks": int} or {"ok": False, "error": str}.
    """
    ext = Path(filename).suffix.lower()
    if ext not in INGEST_EXTENSIONS:
        return {"ok": False, "error": f"Unsupported extension: {ext}"}
    try:
        if ext in TEXT_EXTENSIONS:
            text = file_content.decode("utf-8", errors="replace")
        else:
            text = extract_text_from_file(file_obj=io.BytesIO(file_content), filename_hint=filename)
    except Exception as e:
        logger.exception("Extract failed for %s", filename)
        return {"ok": False, "error": f"Extraction failed: {e!s}"}
    chunks = _chunk_text(text)
    if not chunks:
        return {"ok": True, "filename": filename, "chunks": 0}
    vectors = await _embed_chunks(chunks)
    if len(vectors) != len(chunks):
        return {"ok": False, "error": "Embedding count mismatch"}
    ensure_collection(vector_size=settings.embedding_dimension)
    client = get_qdrant_client()
    collection = settings.qdrant_collection
    source_path = filename
    uploaded_at = datetime.now(timezone.utc).isoformat()
    base_payload: dict[str, object] = {
        "source": source_path,
        "chunk_index": 0,
        "text": "",
        "uploaded_at": uploaded_at,
    }
    if framework_id is not None:
        base_payload["framework_id"] = framework_id
    points = []
    for i, vec in enumerate(vectors):
        payload = dict(base_payload)
        payload["chunk_index"] = i
        payload["text"] = chunks[i][:2000]
        point_id = (
            _stable_point_id(f"{source_path}:{framework_id}", i)
            if framework_id is not None
            else _stable_point_id(source_path, i)
        )
        points.append(PointStruct(id=point_id, vector=vec, payload=payload))
    for batch in _batched(points, UPSERT_BATCH_SIZE):
        upsert_points(collection, batch, client=client)
    logger.info("Ingested single file %s: %d chunks", filename, len(points))
    return {"ok": True, "filename": filename, "chunks": len(points)}


async def ingest_docs(path_override: str | None = None) -> dict[str, Any]:
    """
    Ingest all documents from the docs folder into Qdrant.
    Returns stats: files_processed, chunks_ingested, errors.
    """
    root = _resolve_docs_path() if path_override is None else Path(path_override)
    if not root.is_absolute():
        root = Path.cwd() / root
    if not root.exists():
        return {"ok": False, "error": f"Path does not exist: {root}", "files_processed": 0, "chunks_ingested": 0}

    ensure_collection(vector_size=settings.embedding_dimension)
    client = get_qdrant_client()
    collection = settings.qdrant_collection
    files_processed = 0
    chunks_ingested = 0
    errors: list[str] = []

    for file_path, rel_path in _iter_doc_files(root):
        try:
            ext = file_path.suffix.lower()
            text = _extract_text_from_path(file_path, ext)
        except Exception as e:
            logger.exception("Extract failed for %s", rel_path)
            errors.append(f"{rel_path}: {e}")
            continue

        chunks = _chunk_text(text)
        if not chunks:
            files_processed += 1
            continue

        vectors = await _embed_chunks(chunks)
        if len(vectors) != len(chunks):
            errors.append(f"{rel_path}: embedding count mismatch")
            continue

        uploaded_at = datetime.now(timezone.utc).isoformat()
        points = [
            PointStruct(
                id=_stable_point_id(rel_path, i),
                vector=vec,
                payload={
                    "source": rel_path,
                    "chunk_index": i,
                    "text": chunks[i][:2000],
                    "uploaded_at": uploaded_at,
                },
            )
            for i, vec in enumerate(vectors)
        ]
        for batch in _batched(points, UPSERT_BATCH_SIZE):
            upsert_points(collection, batch, client=client)
        files_processed += 1
        chunks_ingested += len(points)
        logger.info("Ingested %s: %d chunks", rel_path, len(points))

    return {
        "ok": True,
        "files_processed": files_processed,
        "chunks_ingested": chunks_ingested,
        "errors": errors[:20],
    }
