"""Frameworks CRUD API."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models import Framework, Requirement
from app.schemas import FrameworkCreate, FrameworkRead, FrameworkUpdate
from app.services.graph_sync import delete_framework_from_neo4j, sync_framework_to_neo4j
from app.services.qdrant_service import count_documents_for_framework

router = APIRouter()


class FrameworkLibraryItem(BaseModel):
    """Framework summary for Standards Library: metadata + evidence + requirement count."""

    id: int
    name: str
    slug: str
    description: str | None
    region: str | None
    framework_type: str | None
    has_evidence: bool
    documents: list[str]
    chunk_count: int
    requirement_count: int


class FrameworkEvidenceResponse(BaseModel):
    """Evidence status for a framework (standard documents uploaded)."""

    framework_id: int
    chunk_count: int
    documents: list[str]
    has_evidence: bool


@router.get("", response_model=list[FrameworkRead])
async def list_frameworks(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
) -> list[Framework]:
    """List frameworks with optional pagination."""
    result = await db.execute(select(Framework).offset(skip).limit(limit))
    return list(result.scalars().all())


@router.get("/library", response_model=list[FrameworkLibraryItem])
async def list_frameworks_library(
    db: AsyncSession = Depends(get_db),
) -> list[FrameworkLibraryItem]:
    """
    List all frameworks with evidence status and requirement count for Standards Library.
    """
    result = await db.execute(select(Framework).order_by(Framework.name))
    frameworks = list(result.scalars().all())

    req_counts: dict[int, int] = {}
    if frameworks:
        counts_result = await db.execute(
            select(Requirement.framework_id, func.count(Requirement.id))
            .where(Requirement.framework_id.in_([f.id for f in frameworks]))
            .group_by(Requirement.framework_id)
        )
        req_counts = {row[0]: row[1] for row in counts_result.all()}

    items: list[FrameworkLibraryItem] = []
    for f in frameworks:
        chunk_count, documents = count_documents_for_framework(
            settings.qdrant_collection, f.id
        )
        items.append(
            FrameworkLibraryItem(
                id=f.id,
                name=f.name,
                slug=f.slug,
                description=f.description,
                region=f.region,
                framework_type=f.framework_type,
                has_evidence=chunk_count > 0,
                documents=documents,
                chunk_count=chunk_count,
                requirement_count=req_counts.get(f.id, 0),
            )
        )
    return items


@router.post("", response_model=FrameworkRead, status_code=201)
async def create_framework(
    payload: FrameworkCreate,
    db: AsyncSession = Depends(get_db),
) -> Framework:
    """Create a new framework."""
    framework = Framework(**payload.model_dump())
    db.add(framework)
    await db.flush()
    await db.refresh(framework)
    await sync_framework_to_neo4j(
        framework.id, framework.name, framework.slug,
        framework.description, framework.region, framework.framework_type,
    )
    return framework


@router.get("/{framework_id}/evidence", response_model=FrameworkEvidenceResponse)
async def get_framework_evidence(framework_id: int) -> dict:
    """Get evidence status for a framework: chunk count and document sources."""
    chunk_count, documents = count_documents_for_framework(
        settings.qdrant_collection, framework_id
    )
    return {
        "framework_id": framework_id,
        "chunk_count": chunk_count,
        "documents": documents,
        "has_evidence": chunk_count > 0,
    }


@router.get("/{framework_id}", response_model=FrameworkRead)
async def get_framework(
    framework_id: int,
    db: AsyncSession = Depends(get_db),
) -> Framework:
    """Get a framework by id."""
    result = await db.execute(select(Framework).where(Framework.id == framework_id))
    framework = result.scalar_one_or_none()
    if framework is None:
        raise HTTPException(status_code=404, detail="Framework not found")
    return framework


@router.patch("/{framework_id}", response_model=FrameworkRead)
async def update_framework(
    framework_id: int,
    payload: FrameworkUpdate,
    db: AsyncSession = Depends(get_db),
) -> Framework:
    """Update a framework (partial)."""
    result = await db.execute(select(Framework).where(Framework.id == framework_id))
    framework = result.scalar_one_or_none()
    if framework is None:
        raise HTTPException(status_code=404, detail="Framework not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(framework, k, v)
    await db.flush()
    await db.refresh(framework)
    await sync_framework_to_neo4j(
        framework.id, framework.name, framework.slug,
        framework.description, framework.region, framework.framework_type,
    )
    return framework


@router.delete("/{framework_id}", status_code=204)
async def delete_framework(
    framework_id: int,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a framework."""
    result = await db.execute(select(Framework).where(Framework.id == framework_id))
    framework = result.scalar_one_or_none()
    if framework is None:
        raise HTTPException(status_code=404, detail="Framework not found")
    await delete_framework_from_neo4j(framework_id)
    await db.delete(framework)
    await db.flush()
