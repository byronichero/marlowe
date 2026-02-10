"""Framework model – name, slug, optional metadata (region, type)."""

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Framework(Base):
    """Governance framework (e.g. EU AI Act, GDPR, NIST AI RMF)."""

    __tablename__ = "frameworks"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    region: Mapped[str | None] = mapped_column(String(100), nullable=True)
    framework_type: Mapped[str | None] = mapped_column(String(100), nullable=True)

    requirements: Mapped[list["Requirement"]] = relationship(
        "Requirement", back_populates="framework", cascade="all, delete-orphan"
    )
    assessments: Mapped[list["Assessment"]] = relationship(
        "Assessment", back_populates="framework", cascade="all, delete-orphan"
    )
