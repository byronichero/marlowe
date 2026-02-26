"""Gap analysis report model – persisted report output for auditability."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class GapAnalysisReport(Base):
    """Persisted gap analysis report linked to a framework and optional assessment."""

    __tablename__ = "gap_analysis_reports"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    framework_id: Mapped[int] = mapped_column(
        ForeignKey("frameworks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    assessment_id: Mapped[int | None] = mapped_column(
        ForeignKey("assessments.id", ondelete="SET NULL"), nullable=True, index=True
    )
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="completed", index=True)
    report_text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    framework: Mapped["Framework"] = relationship("Framework")
    assessment: Mapped["Assessment | None"] = relationship("Assessment")
