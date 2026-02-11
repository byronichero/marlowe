"""Ollama API – list available models for chat/model picker."""

import logging

from fastapi import APIRouter, HTTPException

from app.services.ollama_service import ollama_list_models

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/models", response_model=list[str])
async def list_models() -> list[str]:
    """Return list of Ollama model names (for user to pick in Chat)."""
    try:
        return await ollama_list_models()
    except Exception as e:
        logger.warning("Ollama list_models failed: %s", e)
        raise HTTPException(status_code=503, detail="Could not list Ollama models") from e
