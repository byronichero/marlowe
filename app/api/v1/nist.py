"""NIST SP 800-53 seed API – load official catalog for end users."""

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.nist_seed_service import seed_nist_80053

router = APIRouter()


class SeedResponse(BaseModel):
    """Response from NIST seed."""

    ok: bool
    framework_id: int
    controls_created: int
    error: str | None = None


@router.post("/seed", response_model=SeedResponse)
async def seed_nist_80053_catalog(
    replace_existing: bool = Query(False, description="Replace existing NIST framework if present"),
    catalog_url: str | None = Query(None, description="Optional URL/path to OSCAL catalog JSON"),
    db: AsyncSession = Depends(get_db),
) -> SeedResponse:
    """
    Seed NIST SP 800-53 Rev 5 framework and controls from official OSCAL catalog.

    Fetches the catalog from NIST's GitHub (public domain). End users get a complete
    NIST control set (1,189 controls across 20 families) without uploading documents.
    """
    result = await seed_nist_80053(
        db=db,
        catalog_url=catalog_url,
        replace_existing=replace_existing,
    )
    return SeedResponse(
        ok=result.get("ok", False),
        framework_id=result.get("framework_id", 0),
        controls_created=result.get("controls_created", 0),
        error=result.get("error"),
    )
