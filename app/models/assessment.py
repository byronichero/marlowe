"""Assessment and RequirementAssessment models."""

from datetime import date, datetime
from sqlalchemy import Date, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Assessment(Base):
    """Assessment linked to framework and/or organization; status and dates."""

    __tablename__ = "assessments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="draft", index=True)
    framework_id: Mapped[int | None] = mapped_column(ForeignKey("frameworks.id", ondelete="SET NULL"), nullable=True)
    organization_id: Mapped[int | None] = mapped_column(
        ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True
    )
    started_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    completed_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    framework: Mapped["Framework"] = relationship("Framework", back_populates="assessments")
    organization: Mapped["Organization"] = relationship("Organization", back_populates="assessments")
    requirement_assessments: Mapped[list["RequirementAssessment"]] = relationship(
        "RequirementAssessment", back_populates="assessment", cascade="all, delete-orphan"
    )
    evidence: Mapped[list["Evidence"]] = relationship(
        "Evidence", back_populates="assessment", cascade="all, delete-orphan"
    )


class RequirementAssessment(Base):
    """Links assessment to requirement/control; status and notes."""

    __tablename__ = "requirement_assessments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    assessment_id: Mapped[int] = mapped_column(ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False)
    requirement_id: Mapped[int] = mapped_column(ForeignKey("requirements.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending", index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    assessment: Mapped["Assessment"] = relationship("Assessment", back_populates="requirement_assessments")
    requirement: Mapped["Requirement"] = relationship("Requirement", back_populates="requirement_assessments")
