"""Evidence model – file reference (MinIO key or path), linked to requirement and assessment."""

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Evidence(Base):
    """Evidence attached to requirement/assessment; stored in MinIO or local path."""

    __tablename__ = "evidence"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    requirement_id: Mapped[int] = mapped_column(ForeignKey("requirements.id", ondelete="CASCADE"), nullable=False)
    assessment_id: Mapped[int] = mapped_column(ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False)
    file_key: Mapped[str] = mapped_column(String(500), nullable=False)  # MinIO key or path
    filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    requirement: Mapped["Requirement"] = relationship("Requirement", back_populates="evidence")
    assessment: Mapped["Assessment"] = relationship("Assessment", back_populates="evidence")
