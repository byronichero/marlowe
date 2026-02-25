"""Documents API – list docs folder, download, preview (HTML), download MD, upload."""

import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, Response

from app.services.document_service import (
    PREVIEW_EXTENSIONS,
    document_to_html,
    document_to_markdown,
)
from pydantic import BaseModel

from app.core.config import settings
from app.services.evidence_bridge_service import create_evidence_for_uploaded_document
from app.services.ingest_service import ingest_docs, ingest_single_file
from app.services.minio_client import upload_file
from app.services.ollama_service import ollama_embeddings
from app.services.qdrant_service import delete_collection, ensure_collection, search

logger = logging.getLogger(__name__)
router = APIRouter()

# In-memory list for scaffold (replace with DB + MinIO listing)
_documents_store: list[dict] = []

# Background upload jobs: job_id -> { status, filename, chunks, error, id, object_key }
_upload_jobs: dict[str, dict] = {}


class DocumentListItem(BaseModel):
    """Minimal document list item."""

    id: str
    filename: str
    object_key: str


class UploadResponse(BaseModel):
    """Response after uploading and ingesting a document into Qdrant (sync or final job result)."""

    ok: bool
    filename: str
    chunks: int = 0
    error: str | None = None
    id: str | None = None
    object_key: str | None = None


class UploadAcceptedResponse(BaseModel):
    """Response when upload is accepted for background processing (202)."""

    job_id: str
    filename: str
    message: str = "Processing in background. You can leave this page."


class JobStatusResponse(BaseModel):
    """Status of a background upload job."""

    job_id: str
    status: str  # pending | running | completed | failed
    filename: str
    chunks: int | None = None
    error: str | None = None
    id: str | None = None
    object_key: str | None = None


def _resolve_docs_root() -> Path:
    """Resolve docs path (absolute or relative to cwd)."""
    p = Path(settings.docs_path)
    return p if p.is_absolute() else Path.cwd() / p


def _resolve_doc_path(path: str) -> Path:
    """Validate path and return resolved full path. Raises HTTPException if invalid."""
    if ".." in path or path.startswith("/"):
        raise HTTPException(status_code=400, detail="Invalid path")
    root = _resolve_docs_root().resolve()
    full = (root / path).resolve()
    try:
        full.relative_to(root)
    except ValueError:
        raise HTTPException(status_code=404, detail="File not found")
    if not full.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return full


class DocsFolderItem(BaseModel):
    """A file in the docs folder (for list and download)."""

    name: str
    path: str  # relative path for download
    size: int


@router.get("/docs-files", response_model=list[DocsFolderItem])
async def list_docs_folder() -> list[DocsFolderItem]:
    """List all files in the docs folder (for AI Documents page)."""
    root = _resolve_docs_root()
    if not root.exists():
        return []
    items: list[DocsFolderItem] = []
    for f in root.rglob("*"):
        if f.is_file():
            try:
                rel = f.relative_to(root)
                items.append(
                    DocsFolderItem(
                        name=f.name,
                        path=str(rel).replace("\\", "/"),
                        size=f.stat().st_size,
                    )
                )
            except (OSError, ValueError):
                continue
    return sorted(items, key=lambda x: x.path.lower())


@router.get("/download")
async def download_docs_file(path: str = Query(..., description="Relative path within docs folder")) -> FileResponse:
    """Download a file from the docs folder. Path must be relative (no '..')."""
    full = _resolve_doc_path(path)
    try:
        return FileResponse(path=str(full), filename=full.name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/preview", response_class=HTMLResponse)
async def preview_document(path: str = Query(..., description="Relative path within docs folder")) -> str:
    """Preview document as HTML (Docling, CSV, TXT → Markdown → HTML)."""
    full = _resolve_doc_path(path)
    if full.suffix.lower() not in PREVIEW_EXTENSIONS:
        ext = full.suffix.lower() or "(none)"
        raise HTTPException(status_code=400, detail=f"Preview not supported for {ext}")
    try:
        return document_to_html(full)
    except Exception as e:
        logger.exception("Preview failed for %s", path)
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/download-md")
async def download_markdown(path: str = Query(..., description="Relative path within docs folder")) -> Response:
    """Download document content as Markdown (.md)."""
    full = _resolve_doc_path(path)
    if full.suffix.lower() not in PREVIEW_EXTENSIONS:
        ext = full.suffix.lower() or "(none)"
        raise HTTPException(status_code=400, detail=f"MD export not supported for {ext}")
    try:
        md = document_to_markdown(full)
        md_bytes = md.encode("utf-8")
        md_name = full.stem + ".md"
        return Response(
            content=md_bytes,
            media_type="text/markdown",
            headers={"Content-Disposition": f'attachment; filename="{md_name}"'},
        )
    except Exception as e:
        logger.exception("Download MD failed for %s", path)
        raise HTTPException(status_code=500, detail=str(e)) from e


class SearchResultItem(BaseModel):
    """One chunk from semantic search."""

    text: str
    source: str
    score: float


class SearchResponse(BaseModel):
    """Response for GET /documents/search."""

    results: list[SearchResultItem]


@router.get("/search", response_model=SearchResponse)
async def search_documents(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(10, ge=1, le=50, description="Max results"),
) -> SearchResponse:
    """
    Semantic search over the knowledge base. Embeds the query with Ollama,
    searches Qdrant, and returns matching chunks with source and score.
    """
    try:
        ensure_collection()
    except Exception as e:
        logger.warning("Qdrant collection not ready for search: %s", e)
        raise HTTPException(
            status_code=503,
            detail="Search is temporarily unavailable. Ensure Qdrant is running.",
        ) from e
    query_vector = await ollama_embeddings(q.strip(), model=settings.embedding_model)
    if not query_vector:
        raise HTTPException(
            status_code=503,
            detail="Embedding service unavailable. Ensure Ollama and the embedding model are running.",
        )
    points = search(
        settings.qdrant_collection,
        query_vector,
        limit=limit,
    )
    results = []
    for p in points:
        payload = getattr(p, "payload", None) or {}
        text = (payload.get("text") or "").strip()
        source = (payload.get("source") or "").strip()
        score = float(getattr(p, "score", 0.0))
        if text:
            results.append(
                SearchResultItem(text=text, source=source or "Unknown", score=score)
            )
    return SearchResponse(results=results)


@router.get("", response_model=list[DocumentListItem])
async def list_documents() -> list[DocumentListItem]:
    """List uploaded documents (scaffold: from store; later from DB)."""
    return [DocumentListItem(**d) for d in _documents_store]


async def _run_upload_job(
    job_id: str,
    filename: str,
    content: bytes,
    content_type: str | None,
    object_key: str,
    doc_id: str,
    framework_id: int | None = None,
) -> None:
    """Run in background: MinIO upload, ingest, then update job status."""
    _upload_jobs[job_id]["status"] = "running"
    try:
        try:
            upload_file(
                object_key,
                content,
                length=len(content),
                content_type=content_type or "application/octet-stream",
            )
        except Exception as e:
            logger.warning("MinIO upload failed for %s: %s", filename, e)
        result = await ingest_single_file(
            file_content=content, filename=filename, framework_id=framework_id
        )
        if result.get("ok"):
            _upload_jobs[job_id].update(
                status="completed",
                chunks=result.get("chunks", 0),
                id=doc_id,
                object_key=object_key,
            )
            _documents_store.append(
                {"id": doc_id, "filename": filename, "object_key": object_key}
            )
            if framework_id is not None:
                await create_evidence_for_uploaded_document(
                    framework_id=framework_id,
                    object_key=object_key,
                    filename=filename,
                )
        else:
            _upload_jobs[job_id].update(
                status="failed",
                error=result.get("error", "Ingest failed"),
            )
    except Exception as e:
        logger.exception("Background upload job %s failed", job_id)
        _upload_jobs[job_id].update(status="failed", error=str(e))


@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
async def get_upload_job(job_id: str) -> JobStatusResponse:
    """Get status of a background upload job."""
    if job_id not in _upload_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    j = _upload_jobs[job_id]
    return JobStatusResponse(
        job_id=job_id,
        status=j["status"],
        filename=j["filename"],
        chunks=j.get("chunks"),
        error=j.get("error"),
        id=j.get("id"),
        object_key=j.get("object_key"),
    )


@router.post("/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    framework_id: str | None = Form(None),
):
    """
    Upload a document: accept file and process in background (MinIO + extract, chunk, embed, Qdrant).
    If framework_id is provided, links the document to that framework for gap analysis evidence.
    Pass framework_id as a form field (e.g. framework_id=1).
    Returns 202 with job_id; poll GET /documents/jobs/{job_id} for status.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")
    content = await file.read()
    ext = Path(file.filename).suffix or ""
    object_key = f"documents/{uuid.uuid4().hex}{ext}"
    doc_id = uuid.uuid4().hex
    job_id = uuid.uuid4().hex
    _upload_jobs[job_id] = {
        "status": "pending",
        "filename": file.filename,
        "chunks": None,
        "error": None,
        "id": None,
        "object_key": None,
    }
    fw_id: int | None = None
    if framework_id is not None and framework_id.strip():
        try:
            fw_id = int(framework_id)
        except ValueError:
            pass
    background_tasks.add_task(
        _run_upload_job,
        job_id,
        file.filename,
        content,
        file.content_type,
        object_key,
        doc_id,
        fw_id,
    )
    return JSONResponse(
        status_code=202,
        content={
            "job_id": job_id,
            "filename": file.filename,
            "message": "Processing in background. You can leave this page.",
        },
    )


class IngestResponse(BaseModel):
    """Response from docs ingest."""

    ok: bool
    files_processed: int
    chunks_ingested: int
    error: str | None = None
    errors: list[str] = []


@router.delete("/collection", status_code=200)
async def clear_qdrant_collection() -> dict:
    """
    Delete the Qdrant collection (clears all vectors and payloads).
    Use before sharing a deployment or backup to remove licensed/copyrighted content.
    """
    deleted = delete_collection()
    return {"ok": True, "deleted": deleted}


@router.post("/ingest", response_model=IngestResponse)
async def ingest_docs_folder(
    path: str | None = Query(None, description="Override docs path (relative or absolute)"),
) -> IngestResponse:
    """
    Ingest all documents from the configured docs folder (or optional path) into Qdrant.
    Uses Docling for PDF/DOCX/etc., chunks text, embeds with Ollama, upserts to Qdrant.
    """
    result = await ingest_docs(path_override=path)
    if not result.get("ok"):
        return IngestResponse(
            ok=False,
            files_processed=result.get("files_processed", 0),
            chunks_ingested=result.get("chunks_ingested", 0),
            error=result.get("error", "Unknown error"),
            errors=result.get("errors", []),
        )
    return IngestResponse(
        ok=True,
        files_processed=result["files_processed"],
        chunks_ingested=result["chunks_ingested"],
        errors=result.get("errors", []),
    )
