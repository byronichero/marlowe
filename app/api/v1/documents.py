"""Documents API – list, upload; ingest docs folder into Qdrant."""

import io
import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from pydantic import BaseModel

from app.services.document_service import extract_text_from_file
from app.services.ingest_service import ingest_docs
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


@router.get("", response_model=list[DocumentListItem])
async def list_documents() -> list[DocumentListItem]:
    """List ingested documents (scaffold: from store; later from DB)."""
    return [DocumentListItem(**d) for d in _documents_store]


@router.post("/upload", response_model=DocumentListItem, status_code=201)
async def upload_document(file: UploadFile = File(...)) -> DocumentListItem:
    """
    Upload a document. Store in MinIO, parse with Docling, extract text to Markdown.
    Scaffold: optional Qdrant indexing can be added in service layer.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")
    ext = Path(file.filename).suffix or ""
    object_key = f"documents/{uuid.uuid4().hex}{ext}"
    content = await file.read()
    # Store in MinIO
    upload_file(object_key, content, length=len(content), content_type=file.content_type or "application/octet-stream")
    # Extract text with Docling (optional: index in Qdrant via ingest flow)
    try:
        extract_text_from_file(file_obj=io.BytesIO(content), filename_hint=file.filename)
    except Exception as e:
        logger.warning("Docling extraction failed for %s: %s", file.filename, e)
    doc_id = uuid.uuid4().hex
    item = {"id": doc_id, "filename": file.filename, "object_key": object_key}
    _documents_store.append(item)
    return DocumentListItem(**item)


class IngestResponse(BaseModel):
    """Response from docs ingest."""

    ok: bool
    files_processed: int
    chunks_ingested: int
    error: str | None = None
    errors: list[str] = []


@router.post("/ingest", response_model=IngestResponse)
async def ingest_docs_folder(path: str | None = Query(None, description="Override docs path (relative or absolute)")) -> IngestResponse:
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
