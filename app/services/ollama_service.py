"""Ollama service for chat and embeddings (host)."""

import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)
OLLAMA_BASE = "OLLAMA_HOST"  # use settings.ollama_host


async def ollama_chat(message: str, model: str | None = None) -> str:
    """Send a chat message to Ollama and return the reply text."""
    url = f"{settings.ollama_host.rstrip('/')}/api/chat"
    payload = {
        "model": model or settings.ollama_model,
        "messages": [{"role": "user", "content": message}],
        "stream": False,
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()
    return data.get("message", {}).get("content", "")


async def ollama_embeddings(text: str, model: str = "nomic-embed-text") -> list[float]:
    """Get embedding vector for text from Ollama."""
    url = f"{settings.ollama_host.rstrip('/')}/api/embeddings"
    payload = {"model": model, "prompt": text}
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()
    return data.get("embedding", [])
