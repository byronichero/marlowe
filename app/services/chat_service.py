"""AI chat service – Ollama with optional Qdrant document context."""

import logging
from typing import Any

from app.core.config import settings
from app.services.ollama_service import ollama_chat, ollama_embeddings
from app.services.qdrant_service import ensure_collection, search

logger = logging.getLogger(__name__)

CONTEXT_CHUNKS_MAX = 6
CONTEXT_CHAR_LIMIT = 4000


async def chat_with_context(
    message: str,
    context_document_ids: list[str] | None = None,  # reserved for future per-doc filter
    model: str | None = None,
    use_rag: bool = True,
) -> tuple[str, str | None]:
    """
    Send user message to Ollama. When use_rag is True, embed the message, search Qdrant
    for relevant chunks, and prepend them as context to the prompt.
    """
    _ = context_document_ids  # reserved for future per-document filter
    prompt = message
    if use_rag:
        try:
            ensure_collection()
            query_vector = await ollama_embeddings(message, model=settings.embedding_model)
            if query_vector:
                results = search(
                    settings.qdrant_collection,
                    query_vector,
                    limit=CONTEXT_CHUNKS_MAX,
                )
                if results:
                    parts = []
                    total = 0
                    for r in results:
                        text = (r.payload or {}).get("text") or ""
                        if not text or total + len(text) > CONTEXT_CHAR_LIMIT:
                            continue
                        parts.append(text)
                        total += len(text)
                    if parts:
                        context = "\n\n---\n\n".join(parts)
                        prompt = f"Use the following excerpts from our documentation when relevant:\n\n{context}\n\n---\n\nQuestion: {message}"
        except Exception as e:
            logger.warning("RAG retrieval failed, continuing without context: %s", e)
    used_model = model or settings.ollama_model
    reply = await ollama_chat(prompt, model=used_model)
    return reply, used_model
