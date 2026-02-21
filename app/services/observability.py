"""Observability helpers (Langfuse)."""

from __future__ import annotations

import logging
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

_handler: Optional["CallbackHandler"] = None


def get_langfuse_handler() -> Optional["CallbackHandler"]:
    """Get a Langfuse callback handler when configured.

    Returns:
        CallbackHandler | None: Handler instance when Langfuse is enabled and configured,
        otherwise None.
    """
    global _handler
    if _handler is not None:
        return _handler
    if not settings.langfuse_enabled:
        return None
    if not settings.langfuse_public_key or not settings.langfuse_secret_key:
        return None
    try:
        from langfuse.callback import CallbackHandler

        _handler = CallbackHandler(
            public_key=settings.langfuse_public_key,
            secret_key=settings.langfuse_secret_key,
            host=settings.langfuse_host,
        )
        return _handler
    except Exception as exc:
        logger.warning("Langfuse handler unavailable: %s", exc)
        return None
