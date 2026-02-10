"""Assessments CRUD API."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import Assessment
from app.schemas import AssessmentCreate, AssessmentRead

router = APIRouter()


@router.get("", response_model=list[AssessmentRead])
async def list_assessments(
    skip: int = 0,
    limit: int = 100,
    framework_id: int | None = Query(None),
    organization_id: int | None = Query(None),
    status: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
) -> list[Assessment]:
    """List assessments with optional filters."""
    q = select(Assessment)
    if framework_id is not None:
        q = q.where(Assessment.framework_id == framework_id)
    if organization_id is not None:
        q = q.where(Assessment.organization_id == organization_id)
    if status is not None:
        q = q.where(Assessment.status == status)
    q = q.offset(skip).limit(limit)
    result = await db.execute(q)
    return list(result.scalars().all())


@router.post("", response_model=AssessmentRead, status_code=201)
async def create_assessment(
    payload: AssessmentCreate,
    db: AsyncSession = Depends(get_db),
) -> Assessment:
    """Create a new assessment."""
    assessment = Assessment(**payload.model_dump())
    db.add(assessment)
    await db.flush()
    await db.refresh(assessment)
    return assessment


@router.get("/{assessment_id}", response_model=AssessmentRead)
async def get_assessment(
    assessment_id: int,
    db: AsyncSession = Depends(get_db),
) -> Assessment:
    """Get an assessment by id."""
    result = await db.execute(select(Assessment).where(Assessment.id == assessment_id))
    obj = result.scalar_one_or_none()
    if obj is None:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return obj


@router.delete("/{assessment_id}", status_code=204)
async def delete_assessment(
    assessment_id: int,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete an assessment."""
    result = await db.execute(select(Assessment).where(Assessment.id == assessment_id))
    obj = result.scalar_one_or_none()
    if obj is None:
        raise HTTPException(status_code=404, detail="Assessment not found")
    await db.delete(obj)
    await db.flush()
