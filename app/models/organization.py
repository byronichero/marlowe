"""Organization model – name, optional level/tier."""

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Organization(Base):
    """Organization (generic level/tier)."""

    __tablename__ = "organizations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    level: Mapped[str | None] = mapped_column(String(50), nullable=True)
    tier: Mapped[str | None] = mapped_column(String(50), nullable=True)

    assessments: Mapped[list["Assessment"]] = relationship(
        "Assessment", back_populates="organization", cascade="all, delete-orphan"
    )
