"""Report service – generate compliance reports from assessments and evidence."""

from datetime import date, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Assessment, GapAnalysisReport


async def get_assessment_reports(
    db: AsyncSession,
    assessment_id: int | None = None,
    framework_id: int | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
) -> list[dict[str, Any]]:
    """
    Fetch assessments with filters and return report items.
    Each item includes assessment details, framework name, requirement count, and evidence count.
    """
    q = (
        select(Assessment)
        .options(
            selectinload(Assessment.framework),
            selectinload(Assessment.requirement_assessments),
            selectinload(Assessment.evidence),
        )
        .order_by(Assessment.created_at.desc())
    )
    if assessment_id is not None:
        q = q.where(Assessment.id == assessment_id)
    if framework_id is not None:
        q = q.where(Assessment.framework_id == framework_id)
    if from_date is not None:
        q = q.where(Assessment.created_at >= from_date)  # from_date as midnight
    if to_date is not None:
        next_day = to_date + timedelta(days=1)
        q = q.where(Assessment.created_at < next_day)

    result = await db.execute(q)
    assessments = list(result.scalars().unique().all())

    reports: list[dict[str, Any]] = []
    for a in assessments:
        framework_name = a.framework.name if a.framework else None
        reports.append(
            {
                "id": a.id,
                "title": a.title,
                "status": a.status,
                "framework_id": a.framework_id,
                "framework_name": framework_name,
                "started_at": a.started_at.isoformat() if a.started_at else None,
                "completed_at": a.completed_at.isoformat() if a.completed_at else None,
                "created_at": a.created_at.isoformat() if a.created_at else None,
                "requirement_count": len(a.requirement_assessments),
                "evidence_count": len(a.evidence),
            }
        )
    return reports


async def get_gap_analysis_reports(
    db: AsyncSession,
    assessment_id: int | None = None,
    framework_id: int | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
) -> list[dict[str, Any]]:
    """
    Fetch persisted gap analysis reports with optional filters.
    Each item includes framework name and full report text for audit purposes.
    """
    q = (
        select(GapAnalysisReport)
        .options(selectinload(GapAnalysisReport.framework))
        .order_by(GapAnalysisReport.created_at.desc())
    )
    if assessment_id is not None:
        q = q.where(GapAnalysisReport.assessment_id == assessment_id)
    if framework_id is not None:
        q = q.where(GapAnalysisReport.framework_id == framework_id)
    if from_date is not None:
        q = q.where(GapAnalysisReport.created_at >= from_date)
    if to_date is not None:
        next_day = to_date + timedelta(days=1)
        q = q.where(GapAnalysisReport.created_at < next_day)

    result = await db.execute(q)
    rows = list(result.scalars().unique().all())

    reports: list[dict[str, Any]] = []
    for r in rows:
        framework_name = r.framework.name if r.framework else None
        reports.append(
            {
                "id": r.id,
                "framework_id": r.framework_id,
                "framework_name": framework_name,
                "assessment_id": r.assessment_id,
                "status": r.status,
                "report_text": r.report_text,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
        )
    return reports
