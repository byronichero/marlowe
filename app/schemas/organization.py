"""Pydantic schemas for Organization."""

from pydantic import BaseModel, ConfigDict, Field


class OrganizationBase(BaseModel):
    """Base fields for Organization."""

    name: str = Field(..., min_length=1, max_length=255)
    level: str | None = None
    tier: str | None = None


class OrganizationCreate(OrganizationBase):
    """Schema for creating an organization."""

    pass


class OrganizationRead(OrganizationBase):
    """Schema for reading an organization."""

    model_config = ConfigDict(from_attributes=True)
    id: int
