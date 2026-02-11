"""Documents API – list docs folder, download, upload (single-file ingest to Qdrant)."""

import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.core.config import settings
from app.services.ingest_service import ingest_docs, ingest_single_file
from app.services.minio_client import upload_file

logger = logging.getLogger(__name__)
router = APIRouter()

# In-memory list for scaffold (replace with DB + MinIO listing)
_documents_store: list[dict] = []


class DocumentListItem(BaseModel):
    """Minimal document list item."""

    id: str
    filename: str
    object_key: str


class UploadResponse(BaseModel):
    """Response after uploading and ingesting a document into Qdrant."""

    ok: bool
    filename: str
    chunks: int = 0
    error: str | None = None
    id: str | None = None
    object_key: str | None = None


def _resolve_docs_root() -> Path:
    """Resolve docs path (absolute or relative to cwd)."""
    p = Path(settings.docs_path)
    return p if p.is_absolute() else Path.cwd() / p


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
    try:
        return FileResponse(path=str(full), filename=full.name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("", response_model=list[DocumentListItem])
async def list_documents() -> list[DocumentListItem]:
    """List uploaded documents (scaffold: from store; later from DB)."""
    return [DocumentListItem(**d) for d in _documents_store]


@router.post("/upload", response_model=UploadResponse)
async def upload_document(file: UploadFile = File(...)) -> UploadResponse:
    """
    Upload a document: store in MinIO, then extract, chunk, embed, and upsert into Qdrant.
    Returns JSON with ok, filename, chunks (or error). One file at a time for reliable processing.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")
    content = await file.read()
    ext = Path(file.filename).suffix or ""
    object_key = f"documents/{uuid.uuid4().hex}{ext}"
    doc_id = uuid.uuid4().hex
    try:
        upload_file(
            object_key, content, length=len(content), content_type=file.content_type or "application/octet-stream"
        )
    except Exception as e:
        logger.warning("MinIO upload failed for %s: %s", file.filename, e)
    result = await ingest_single_file(file_content=content, filename=file.filename)
    if not result.get("ok"):
        raise HTTPException(
            status_code=422,
            detail=result.get("error", "Ingest failed"),
        )
    item = {"id": doc_id, "filename": file.filename, "object_key": object_key}
    _documents_store.append(item)
    return UploadResponse(
        ok=True,
        filename=file.filename,
        chunks=result.get("chunks", 0),
        id=doc_id,
        object_key=object_key,
    )


class IngestResponse(BaseModel):
    """Response from docs ingest."""

    ok: bool
    files_processed: int
    chunks_ingested: int
    error: str | None = None
    errors: list[str] = []


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
