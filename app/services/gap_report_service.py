"""Gap analysis report persistence for auditability."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import GapAnalysisReport


async def create_gap_analysis_report(
    db: AsyncSession,
    framework_id: int,
    report_text: str,
    assessment_id: int | None = None,
    status: str = "completed",
) -> GapAnalysisReport:
    """Persist a gap analysis report and return the row."""
    report = GapAnalysisReport(
        framework_id=framework_id,
        assessment_id=assessment_id,
        status=status,
        report_text=report_text,
    )
    db.add(report)
    await db.flush()
    await db.refresh(report)
    return report
