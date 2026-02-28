"""AI chat API – configured LLM with optional context."""

from fastapi import APIRouter

from app.schemas import ChatRequest, ChatResponse
from app.services.chat_service import chat_with_context

router = APIRouter()


@router.post("", response_model=ChatResponse)
async def chat(payload: ChatRequest) -> ChatResponse:
    """Send a message to the AI; optional document context and model selection."""
    reply, model_used = await chat_with_context(
        payload.message,
        context_document_ids=payload.context_document_ids or None,
        model=payload.model,
    )
    return ChatResponse(reply=reply, model_used=model_used)
