"""Ollama API – list available models and check reachability."""

import logging

from fastapi import APIRouter

from app.services.ollama_service import ollama_list_models, ollama_reachable

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/health")
async def ollama_health() -> dict:
    """Check if Ollama is reachable from the backend (e.g. from Docker to host)."""
    ok, err = await ollama_reachable()
    return {"reachable": ok, "error": err}


@router.get("/models", response_model=list[str])
async def list_models() -> list[str]:
    """Return list of Ollama model names (for user to pick in Chat). Returns [] if Ollama unreachable."""
    return await ollama_list_models()
