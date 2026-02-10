"""Pydantic schemas for FAQ."""

from pydantic import BaseModel, ConfigDict, Field


class FAQBase(BaseModel):
    """Base fields for FAQ."""

    question: str = Field(..., min_length=1)
    answer: str = Field(..., min_length=1)
    category: str | None = None
    tags: str | None = None


class FAQCreate(FAQBase):
    """Schema for creating an FAQ."""

    pass


class FAQRead(FAQBase):
    """Schema for reading an FAQ."""

    model_config = ConfigDict(from_attributes=True)
    id: int
