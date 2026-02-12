"""Ollama service for chat and embeddings (host)."""

import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


def _ollama_404_message(chosen: str) -> str:
    """User-facing message when Ollama returns 404."""
    return (
        "Ollama returned 404. Is Ollama running on the host? "
        "If yes, the model may be missing. Try: ollama pull "
        f"{chosen} or set OLLAMA_MODEL to a model you have (e.g. qwen3:latest)."
    )


async def _ollama_chat_once(
    client: httpx.AsyncClient, url: str, payload: dict[str, object]
) -> tuple[bool, str]:
    """POST to Ollama /api/chat. Returns (success, content_or_error_message)."""
    try:
        resp = await client.post(url, json=payload)
        if resp.status_code == 404:
            return False, ""
        resp.raise_for_status()
        data = resp.json()
        return True, data.get("message", {}).get("content", "")
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return False, ""
        raise


def _chat_capable_models(listed: list[str]) -> list[str]:
    """Filter to models likely to support chat (exclude embed-only)."""
    skip = {"nomic-embed-text", "embeddinggemma", "embed"}
    return [m for m in listed if m and not any(s in m.lower() for s in skip)]


async def _try_listed_models(
    client: httpx.AsyncClient,
    url: str,
    messages: list[dict[str, str]],
    chosen: str,
) -> str | None:
    """Try chat with first chat-capable model from Ollama; return content or None."""
    for m in _chat_capable_models(await ollama_list_models()):
        logger.warning("Ollama 404 for %s and fallback, trying listed model %s", chosen, m)
        ok, content = await _ollama_chat_once(client, url, {"model": m, "messages": messages, "stream": False})
        if ok:
            return content
    return None


async def ollama_chat(
    message: str,
    model: str | None = None,
    system: str | None = None,
) -> str:
    """Send a chat message to Ollama and return the reply text.
    If system is provided, it is sent as a system message (role: system) before the user message.
    On 404 (e.g. model not found), retries with ollama_fallback_model, then first listed model.
    """
    url = f"{settings.ollama_host.rstrip('/')}/api/chat"
    messages: list[dict[str, str]] = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": message})
    chosen = model or settings.ollama_model
    fallback = (
        settings.ollama_fallback_model
        if settings.ollama_fallback_model and settings.ollama_fallback_model != chosen
        else None
    )
    to_try: list[str] = [chosen] + ([fallback] if fallback else [])

    async with httpx.AsyncClient(timeout=settings.ollama_api_timeout) as client:
        for i, attempt_model in enumerate(to_try):
            if not attempt_model:
                continue
            payload = {"model": attempt_model, "messages": messages, "stream": False}
            ok, content = await _ollama_chat_once(client, url, payload)
            if ok:
                return content
            if i < len(to_try) - 1:
                logger.warning(
                    "Ollama 404 for model %s, retrying with %s",
                    attempt_model,
                    to_try[-1],
                )
                continue
            # Both 404'd: try first chat-capable model from /api/tags
            content = await _try_listed_models(client, url, messages, chosen)
            return content if content is not None else _ollama_404_message(chosen)
    return _ollama_404_message(chosen)


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
