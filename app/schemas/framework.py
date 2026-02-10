"""Pydantic schemas for Framework."""

from pydantic import BaseModel, ConfigDict, Field


class FrameworkBase(BaseModel):
    """Base fields for Framework."""

    name: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(..., min_length=1, max_length=100)
    description: str | None = None
    region: str | None = None
    framework_type: str | None = None


class FrameworkCreate(FrameworkBase):
    """Schema for creating a framework."""

    pass


class FrameworkUpdate(BaseModel):
    """Schema for updating a framework (partial)."""

    name: str | None = Field(None, min_length=1, max_length=255)
    slug: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = None
    region: str | None = None
    framework_type: str | None = None


class FrameworkRead(FrameworkBase):
    """Schema for reading a framework."""

    model_config = ConfigDict(from_attributes=True)
    id: int
