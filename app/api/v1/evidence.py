"""Evidence CRUD API."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import Evidence
from app.schemas import EvidenceCreate, EvidenceRead

router = APIRouter()


@router.get("", response_model=list[EvidenceRead])
async def list_evidence(
    skip: int = 0,
    limit: int = 100,
    requirement_id: int | None = Query(None),
    assessment_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
) -> list[Evidence]:
    """List evidence with optional filters."""
    q = select(Evidence)
    if requirement_id is not None:
        q = q.where(Evidence.requirement_id == requirement_id)
    if assessment_id is not None:
        q = q.where(Evidence.assessment_id == assessment_id)
    q = q.offset(skip).limit(limit)
    result = await db.execute(q)
    return list(result.scalars().all())


@router.post("", response_model=EvidenceRead, status_code=201)
async def create_evidence(
    payload: EvidenceCreate,
    db: AsyncSession = Depends(get_db),
) -> Evidence:
    """Create a new evidence record (file should be uploaded separately to MinIO)."""
    evidence = Evidence(**payload.model_dump())
    db.add(evidence)
    await db.flush()
    await db.refresh(evidence)
    return evidence


@router.get("/{evidence_id}", response_model=EvidenceRead)
async def get_evidence(
    evidence_id: int,
    db: AsyncSession = Depends(get_db),
) -> Evidence:
    """Get evidence by id."""
    result = await db.execute(select(Evidence).where(Evidence.id == evidence_id))
    obj = result.scalar_one_or_none()
    if obj is None:
        raise HTTPException(status_code=404, detail="Evidence not found")
    return obj


@router.delete("/{evidence_id}", status_code=204)
async def delete_evidence(
    evidence_id: int,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete an evidence record."""
    result = await db.execute(select(Evidence).where(Evidence.id == evidence_id))
    obj = result.scalar_one_or_none()
    if obj is None:
        raise HTTPException(status_code=404, detail="Evidence not found")
    await db.delete(obj)
    await db.flush()
