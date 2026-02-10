"""Pydantic schemas for AI chat."""

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    """Request body for chat endpoint."""

    message: str = Field(..., min_length=1, max_length=10000)
    context_document_ids: list[str] = Field(default_factory=list, max_length=20)


class ChatResponse(BaseModel):
    """Response from chat endpoint."""

    reply: str
    model_used: str | None = None
