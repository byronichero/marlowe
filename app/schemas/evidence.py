"""Pydantic schemas for Evidence."""

from pydantic import BaseModel, ConfigDict, Field


class EvidenceBase(BaseModel):
    """Base fields for Evidence."""

    requirement_id: int
    assessment_id: int
    file_key: str = Field(..., max_length=500)
    filename: str | None = None
    notes: str | None = None


class EvidenceCreate(EvidenceBase):
    """Schema for creating evidence."""

    pass


class EvidenceRead(EvidenceBase):
    """Schema for reading evidence."""

    model_config = ConfigDict(from_attributes=True)
    id: int
