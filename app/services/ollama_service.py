"""Ollama service for chat and embeddings (host)."""

import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


async def ollama_chat(message: str, model: str | None = None) -> str:
    """Send a chat message to Ollama and return the reply text."""
    url = f"{settings.ollama_host.rstrip('/')}/api/chat"
    payload = {
        "model": model or settings.ollama_model,
        "messages": [{"role": "user", "content": message}],
        "stream": False,
    }
    async with httpx.AsyncClient(timeout=settings.ollama_api_timeout) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()
    return data.get("message", {}).get("content", "")


async def ollama_reachable() -> tuple[bool, str | None]:
    """Check if Ollama is reachable. Returns (True, None) or (False, error_message)."""
    url = f"{settings.ollama_host.rstrip('/')}/api/tags"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return True, None
    except httpx.ConnectError as e:
        return False, f"Connection refused or unreachable: {e}"
    except httpx.TimeoutException as e:
        return False, f"Timeout: {e}"
    except Exception as e:
        return False, str(e)


async def ollama_list_models() -> list[str]:
    """Return list of available model names from Ollama (GET /api/tags). Returns [] if unreachable."""
    url = f"{settings.ollama_host.rstrip('/')}/api/tags"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
        models = data.get("models") or []
        return [m.get("name", "") for m in models if m.get("name")]
    except (httpx.ConnectError, httpx.TimeoutException) as e:
        logger.warning("Ollama unreachable at %s: %s", settings.ollama_host, e)
        return []
    except Exception as e:
        logger.warning("Ollama list_models failed: %s", e)
        return []


async def ollama_embeddings(text: str, model: str = "nomic-embed-text") -> list[float]:
    """Get embedding vector for text from Ollama."""
    url = f"{settings.ollama_host.rstrip('/')}/api/embeddings"
    payload = {"model": model, "prompt": text}
    async with httpx.AsyncClient(timeout=settings.ollama_api_timeout) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()
    return data.get("embedding", [])
