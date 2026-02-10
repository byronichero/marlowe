"""Pydantic schemas for Requirement."""

from pydantic import BaseModel, ConfigDict, Field


class RequirementBase(BaseModel):
    """Base fields for Requirement."""

    framework_id: int
    identifier: str = Field(..., min_length=1, max_length=100)
    title: str = Field(..., min_length=1, max_length=500)
    description: str | None = None
    level: str | None = None
    family: str | None = None


class RequirementCreate(RequirementBase):
    """Schema for creating a requirement."""

    pass


class RequirementUpdate(BaseModel):
    """Schema for updating a requirement (partial)."""

    identifier: str | None = Field(None, max_length=100)
    title: str | None = Field(None, max_length=500)
    description: str | None = None
    level: str | None = None
    family: str | None = None


class RequirementRead(RequirementBase):
    """Schema for reading a requirement."""

    model_config = ConfigDict(from_attributes=True)
    id: int
