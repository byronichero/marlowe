"""Unified LLM service for chat and embeddings."""

from __future__ import annotations

import logging

from app.core.config import settings
from app.services.ollama_service import (
    ollama_chat,
    ollama_embeddings,
    ollama_list_models,
    ollama_reachable,
)
from app.services.vllm_service import (
    vllm_chat,
    vllm_embeddings,
    vllm_list_models,
    vllm_reachable,
)

logger = logging.getLogger(__name__)


def _normalize_provider(value: str) -> str:
    """Normalize LLM provider value."""
    normalized = value.strip().lower()
    return normalized or "ollama"


def llm_provider() -> str:
    """Return active LLM provider."""
    return _normalize_provider(settings.llm_provider)


async def llm_chat(
    message: str,
    model: str | None = None,
    system: str | None = None,
) -> tuple[str, str | None]:
    """Send a chat message to the configured LLM provider."""
    provider = llm_provider()
    if provider == "vllm":
        chosen = model or settings.vllm_model
        reply = await vllm_chat(message=message, model=chosen, system=system)
        return reply, chosen
    chosen = model or settings.ollama_model
    reply = await ollama_chat(message=message, model=chosen, system=system)
    return reply, chosen


async def llm_embeddings(text: str, model: str | None = None) -> list[float]:
    """Get embedding vector for text from the configured provider."""
    provider = llm_provider()
    if provider == "vllm":
        chosen = model or settings.vllm_embeddings_model
        if not chosen:
            logger.warning(
                "VLLM_EMBEDDINGS_MODEL not set; falling back to Ollama embeddings"
            )
            return await ollama_embeddings(text, model=settings.embedding_model)
        return await vllm_embeddings(text, model=chosen)
    chosen = model or settings.embedding_model
    return await ollama_embeddings(text, model=chosen)


async def llm_reachable() -> tuple[bool, str | None]:
    """Check if the configured LLM provider is reachable."""
    provider = llm_provider()
    if provider == "vllm":
        return await vllm_reachable()
    return await ollama_reachable()


async def llm_list_models() -> list[str]:
    """Return list of available model names for the configured provider."""
    provider = llm_provider()
    if provider == "vllm":
        return await vllm_list_models()
    return await ollama_list_models()
