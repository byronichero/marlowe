"""Requirements CRUD API."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import Requirement
from app.schemas import RequirementCreate, RequirementRead, RequirementUpdate
from app.services.graph_sync import delete_requirement_from_neo4j, sync_requirement_to_neo4j

router = APIRouter()


@router.get("", response_model=list[RequirementRead])
async def list_requirements(
    skip: int = 0,
    limit: int = Query(2000, ge=1, le=10000, description="Max requirements to return (NIST 800-53 has ~1,200)"),
    framework_id: int | None = Query(None),
    level: str | None = Query(None),
    family: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
) -> list[Requirement]:
    """List requirements with optional filters."""
    q = select(Requirement)
    if framework_id is not None:
        q = q.where(Requirement.framework_id == framework_id)
    if level is not None:
        q = q.where(Requirement.level == level)
    if family is not None:
        q = q.where(Requirement.family == family)
    q = q.offset(skip).limit(limit)
    result = await db.execute(q)
    return list(result.scalars().all())


@router.post("", response_model=RequirementRead, status_code=201)
async def create_requirement(
    payload: RequirementCreate,
    db: AsyncSession = Depends(get_db),
) -> Requirement:
    """Create a new requirement."""
    requirement = Requirement(**payload.model_dump())
    db.add(requirement)
    await db.flush()
    await db.refresh(requirement)
    await sync_requirement_to_neo4j(
        requirement.id, requirement.framework_id, requirement.identifier, requirement.title,
        requirement.description, requirement.level, requirement.family,
    )
    return requirement


@router.get("/{requirement_id}", response_model=RequirementRead)
async def get_requirement(
    requirement_id: int,
    db: AsyncSession = Depends(get_db),
) -> Requirement:
    """Get a requirement by id."""
    result = await db.execute(select(Requirement).where(Requirement.id == requirement_id))
    req = result.scalar_one_or_none()
    if req is None:
        raise HTTPException(status_code=404, detail="Requirement not found")
    return req


@router.patch("/{requirement_id}", response_model=RequirementRead)
async def update_requirement(
    requirement_id: int,
    payload: RequirementUpdate,
    db: AsyncSession = Depends(get_db),
) -> Requirement:
    """Update a requirement (partial)."""
    result = await db.execute(select(Requirement).where(Requirement.id == requirement_id))
    req = result.scalar_one_or_none()
    if req is None:
        raise HTTPException(status_code=404, detail="Requirement not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(req, k, v)
    await db.flush()
    await db.refresh(req)
    await sync_requirement_to_neo4j(
        req.id, req.framework_id, req.identifier, req.title,
        req.description, req.level, req.family,
    )
    return req


@router.delete("/{requirement_id}", status_code=204)
async def delete_requirement(
    requirement_id: int,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a requirement."""
    result = await db.execute(select(Requirement).where(Requirement.id == requirement_id))
    req = result.scalar_one_or_none()
    if req is None:
        raise HTTPException(status_code=404, detail="Requirement not found")
    await delete_requirement_from_neo4j(requirement_id)
    await db.delete(req)
    await db.flush()
