"""Frameworks CRUD API."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import Framework
from app.schemas import FrameworkCreate, FrameworkRead, FrameworkUpdate

router = APIRouter()


@router.get("", response_model=list[FrameworkRead])
async def list_frameworks(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
) -> list[Framework]:
    """List frameworks with optional pagination."""
    result = await db.execute(select(Framework).offset(skip).limit(limit))
    return list(result.scalars().all())


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
    return framework


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
    await db.delete(framework)
    await db.flush()
