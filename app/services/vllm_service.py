"""vLLM service for chat and embeddings (OpenAI-compatible)."""

from __future__ import annotations

import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


def _auth_headers() -> dict[str, str]:
    """Return auth headers for vLLM if API key is configured."""
    if settings.vllm_api_key:
        return {"Authorization": f"Bearer {settings.vllm_api_key}"}
    return {}


async def vllm_chat(
    message: str,
    model: str,
    system: str | None = None,
) -> str:
    """Send a chat message to vLLM and return the reply text."""
    url = f"{settings.vllm_base_url.rstrip('/')}/v1/chat/completions"
    messages: list[dict[str, str]] = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": message})
    payload = {
        "model": model,
        "messages": messages,
        "stream": False,
    }
    async with httpx.AsyncClient(timeout=settings.vllm_api_timeout) as client:
        resp = await client.post(url, json=payload, headers=_auth_headers())
        resp.raise_for_status()
        data = resp.json()
    choices = data.get("choices") or []
    if not choices:
        return ""
    message_data = choices[0].get("message") or {}
    return message_data.get("content", "") or ""


async def vllm_embeddings(text: str, model: str) -> list[float]:
    """Get embedding vector for text from vLLM."""
    url = f"{settings.vllm_base_url.rstrip('/')}/v1/embeddings"
    payload = {"model": model, "input": text}
    async with httpx.AsyncClient(timeout=settings.vllm_api_timeout) as client:
        resp = await client.post(url, json=payload, headers=_auth_headers())
        resp.raise_for_status()
        data = resp.json()
    items = data.get("data") or []
    if not items:
        return []
    return items[0].get("embedding", []) or []


async def vllm_reachable() -> tuple[bool, str | None]:
    """Check if vLLM is reachable. Returns (True, None) or (False, error_message)."""
    base_url = settings.vllm_base_url.rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{base_url}/health", headers=_auth_headers())
            if resp.status_code == 404:
                resp = await client.get(f"{base_url}/v1/models", headers=_auth_headers())
            resp.raise_for_status()
            return True, None
    except httpx.ConnectError as e:
        return False, f"Connection refused or unreachable: {e}"
    except httpx.TimeoutException as e:
        return False, f"Timeout: {e}"
    except Exception as e:
        return False, str(e)


async def vllm_list_models() -> list[str]:
    """Return list of available model ids from vLLM. Returns [] if unreachable."""
    url = f"{settings.vllm_base_url.rstrip('/')}/v1/models"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=_auth_headers())
            resp.raise_for_status()
            data = resp.json()
        models = data.get("data") or []
        return [m.get("id", "") for m in models if m.get("id")]
    except (httpx.ConnectError, httpx.TimeoutException) as e:
        logger.warning("vLLM unreachable at %s: %s", settings.vllm_base_url, e)
        return []
    except Exception as e:
        logger.warning("vLLM list_models failed: %s", e)
        return []
