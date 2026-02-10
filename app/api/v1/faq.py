"""FAQ API – list and search."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import FAQ
from app.schemas import FAQCreate, FAQRead

router = APIRouter()


@router.get("", response_model=list[FAQRead])
async def list_faq(
    skip: int = 0,
    limit: int = 100,
    category: str | None = Query(None),
    q: str | None = Query(None, description="Search question/answer"),
    db: AsyncSession = Depends(get_db),
) -> list[FAQ]:
    """List FAQs with optional category and search."""
    stmt = select(FAQ)
    if category:
        stmt = stmt.where(FAQ.category == category)
    if q:
        stmt = stmt.where(FAQ.question.ilike(f"%{q}%") | FAQ.answer.ilike(f"%{q}%"))
    stmt = stmt.offset(skip).limit(limit)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post("", response_model=FAQRead, status_code=201)
async def create_faq(
    payload: FAQCreate,
    db: AsyncSession = Depends(get_db),
) -> FAQ:
    """Create an FAQ entry."""
    faq = FAQ(**payload.model_dump())
    db.add(faq)
    await db.flush()
    await db.refresh(faq)
    return faq


@router.get("/{faq_id}", response_model=FAQRead)
async def get_faq(
    faq_id: int,
    db: AsyncSession = Depends(get_db),
) -> FAQ:
    """Get FAQ by id."""
    result = await db.execute(select(FAQ).where(FAQ.id == faq_id))
    obj = result.scalar_one_or_none()
    if obj is None:
        raise HTTPException(status_code=404, detail="FAQ not found")
    return obj
