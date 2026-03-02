"""Pydantic schemas for Assessment and RequirementAssessment."""

from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field


class AssessmentBase(BaseModel):
    """Base fields for Assessment."""

    title: str = Field(..., min_length=1, max_length=500)
    status: str = Field(default="draft", max_length=50)
    framework_id: int | None = None
    organization_id: int | None = None
    started_at: date | None = None
    completed_at: date | None = None


class AssessmentCreate(AssessmentBase):
    """Schema for creating an assessment."""

    pass


class AssessmentRead(AssessmentBase):
    """Schema for reading an assessment."""

    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    updated_at: datetime


class RequirementAssessmentRead(BaseModel):
    """Schema for reading a requirement-assessment link."""

    model_config = ConfigDict(from_attributes=True)
    id: int
    assessment_id: int
    requirement_id: int
    status: str
    notes: str | None
    maturity_score: int | None = Field(None, ge=0, le=5)


class RequirementAssessmentUpdate(BaseModel):
    """Schema for updating a requirement assessment."""

    status: str | None = None
    notes: str | None = None
    maturity_score: int | None = Field(None, ge=0, le=5)


class RequirementAssessmentItem(BaseModel):
    """Assessment row for a requirement (taxonomy entry table)."""

    assessment_id: int
    requirement_id: int
    identifier: str
    title: str
    description: str | None
    level: str | None
    family: str | None
    status: str
    notes: str | None
    maturity_score: int | None = Field(None, ge=0, le=5)
