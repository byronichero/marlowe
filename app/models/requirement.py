"""Requirement / Control model – identifier, title, description, framework, level/family."""

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Requirement(Base):
    """Generic requirement or control tied to a framework; optional level/family."""

    __tablename__ = "requirements"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    framework_id: Mapped[int] = mapped_column(ForeignKey("frameworks.id", ondelete="CASCADE"), nullable=False)
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("requirements.id", ondelete="CASCADE"), nullable=True, index=True
    )
    identifier: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    level: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    family: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)

    framework: Mapped["Framework"] = relationship("Framework", back_populates="requirements")
    parent: Mapped["Requirement | None"] = relationship(
        "Requirement", remote_side=[id], back_populates="enhancements"
    )
    enhancements: Mapped[list["Requirement"]] = relationship(
        "Requirement", back_populates="parent", cascade="all, delete-orphan"
    )
    requirement_assessments: Mapped[list["RequirementAssessment"]] = relationship(
        "RequirementAssessment", back_populates="requirement", cascade="all, delete-orphan"
    )
    evidence: Mapped[list["Evidence"]] = relationship(
        "Evidence", back_populates="requirement", cascade="all, delete-orphan"
    )
