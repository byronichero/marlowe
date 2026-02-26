"""Reports API – by assessment, framework, date; assessment summary reports."""

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.report_service import get_assessment_reports, get_gap_analysis_reports

router = APIRouter()


@router.get("")
async def list_reports(
    assessment_id: int | None = Query(None, description="Filter by assessment ID"),
    framework_id: int | None = Query(None, description="Filter by framework ID"),
    from_date: date | None = Query(None, description="From date (created_at)"),
    to_date: date | None = Query(None, description="To date (created_at)"),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    List assessment reports with optional filters.
    Returns assessments with framework name, requirement count, and evidence count.
    """
    assessment_reports = await get_assessment_reports(
        db,
        assessment_id=assessment_id,
        framework_id=framework_id,
        from_date=from_date,
        to_date=to_date,
    )
    gap_reports = await get_gap_analysis_reports(
        db,
        assessment_id=assessment_id,
        framework_id=framework_id,
        from_date=from_date,
        to_date=to_date,
    )
    return {
        "reports": assessment_reports,
        "gap_reports": gap_reports,
        "filters": {
            "assessment_id": assessment_id,
            "framework_id": framework_id,
            "from_date": str(from_date) if from_date else None,
            "to_date": str(to_date) if to_date else None,
        },
    }
