"""Assessments CRUD API."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import Assessment, Requirement, RequirementAssessment
from app.schemas import (
    AssessmentCreate,
    AssessmentRead,
    RequirementAssessmentItem,
    RequirementAssessmentUpdate,
)

router = APIRouter()

ASSESSMENT_NOT_FOUND = "Assessment not found"


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
        raise HTTPException(status_code=404, detail=ASSESSMENT_NOT_FOUND)
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


@router.post("/{assessment_id}/requirements/init")
async def init_requirement_assessments(
    assessment_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Create missing requirement assessment rows for a framework."""
    result = await db.execute(select(Assessment).where(Assessment.id == assessment_id))
    assessment = result.scalar_one_or_none()
    if assessment is None:
        raise HTTPException(status_code=404, detail=ASSESSMENT_NOT_FOUND)
    if assessment.framework_id is None:
        raise HTTPException(status_code=400, detail="Assessment has no framework")

    req_result = await db.execute(
        select(Requirement.id).where(Requirement.framework_id == assessment.framework_id)
    )
    requirement_ids = [row[0] for row in req_result.all()]
    if not requirement_ids:
        return {"ok": True, "created": 0}

    existing_result = await db.execute(
        select(RequirementAssessment.requirement_id).where(
            RequirementAssessment.assessment_id == assessment_id
        )
    )
    existing_ids = {row[0] for row in existing_result.all()}

    created = 0
    for req_id in requirement_ids:
        if req_id in existing_ids:
            continue
        db.add(
            RequirementAssessment(
                assessment_id=assessment_id,
                requirement_id=req_id,
                status="pending",
                notes=None,
            )
        )
        created += 1
    await db.flush()
    return {"ok": True, "created": created}


@router.get("/{assessment_id}/requirements", response_model=list[RequirementAssessmentItem])
async def list_requirement_assessments(
    assessment_id: int,
    db: AsyncSession = Depends(get_db),
) -> list[RequirementAssessmentItem]:
    """List requirement assessment rows with requirement details."""
    result = await db.execute(select(Assessment).where(Assessment.id == assessment_id))
    assessment = result.scalar_one_or_none()
    if assessment is None:
        raise HTTPException(status_code=404, detail=ASSESSMENT_NOT_FOUND)
    if assessment.framework_id is None:
        raise HTTPException(status_code=400, detail="Assessment has no framework")

    req_result = await db.execute(
        select(Requirement).where(Requirement.framework_id == assessment.framework_id)
    )
    requirements = list(req_result.scalars().all())

    ra_result = await db.execute(
        select(RequirementAssessment).where(RequirementAssessment.assessment_id == assessment_id)
    )
    ra_map = {ra.requirement_id: ra for ra in ra_result.scalars().all()}

    items: list[RequirementAssessmentItem] = []
    for req in requirements:
        ra = ra_map.get(req.id)
        items.append(
            RequirementAssessmentItem(
                assessment_id=assessment_id,
                requirement_id=req.id,
                identifier=req.identifier,
                title=req.title,
                description=req.description,
                level=req.level,
                family=req.family,
                status=ra.status if ra else "pending",
                notes=ra.notes if ra else None,
            )
        )
    return items


@router.patch("/{assessment_id}/requirements/{requirement_id}", response_model=RequirementAssessmentItem)
async def update_requirement_assessment(
    assessment_id: int,
    requirement_id: int,
    payload: RequirementAssessmentUpdate,
    db: AsyncSession = Depends(get_db),
) -> RequirementAssessmentItem:
    """Update status/notes for a requirement assessment row."""
    result = await db.execute(select(Assessment).where(Assessment.id == assessment_id))
    assessment = result.scalar_one_or_none()
    if assessment is None:
        raise HTTPException(status_code=404, detail=ASSESSMENT_NOT_FOUND)

    req_result = await db.execute(select(Requirement).where(Requirement.id == requirement_id))
    req = req_result.scalar_one_or_none()
    if req is None:
        raise HTTPException(status_code=404, detail="Requirement not found")

    ra_result = await db.execute(
        select(RequirementAssessment).where(
            RequirementAssessment.assessment_id == assessment_id,
            RequirementAssessment.requirement_id == requirement_id,
        )
    )
    ra = ra_result.scalar_one_or_none()
    if ra is None:
        ra = RequirementAssessment(
            assessment_id=assessment_id,
            requirement_id=requirement_id,
            status="pending",
            notes=None,
        )
        db.add(ra)
        await db.flush()

    if payload.status is not None:
        ra.status = payload.status
    if payload.notes is not None:
        ra.notes = payload.notes
    await db.flush()
    await db.refresh(ra)

    return RequirementAssessmentItem(
        assessment_id=assessment_id,
        requirement_id=requirement_id,
        identifier=req.identifier,
        title=req.title,
        description=req.description,
        level=req.level,
        family=req.family,
        status=ra.status,
        notes=ra.notes,
    )
