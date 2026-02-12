"""AI chat service – Ollama with optional Qdrant document context."""

import logging

from app.core.config import settings
from app.services.ollama_service import ollama_chat, ollama_embeddings
from app.services.qdrant_service import ensure_collection, get_recent_documents, list_document_sources, search

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
    system_prompt: str | None = None
    if use_rag:
        try:
            ensure_collection()
            # Get document list so the model can answer "which documents are stored?"
            doc_sources = list_document_sources(settings.qdrant_collection)
            doc_list_str = ""
            if doc_sources:
                doc_list_str = (
                    "Documents in the knowledge base: "
                    + ", ".join(doc_sources)
                    + ".\n\n"
                )
            
            # Get recently uploaded documents (last 24 hours) for temporal queries
            recent_docs = get_recent_documents(settings.qdrant_collection, hours=24)
            if recent_docs:
                recent_list = [doc["source"] for doc in recent_docs]
                doc_list_str += (
                    "Recently uploaded (last 24 hours, newest first): "
                    + ", ".join(recent_list)
                    + ". When the user asks what they just uploaded, which document they added, "
                    "or about the most recent upload, answer using this list (the first item is the newest).\n\n"
                )
            # System instruction so the model does not claim it lacks access to the knowledge base
            if doc_list_str:
                system_prompt = (
                    "You are the Marlowe AI governance assistant. You have direct access to the "
                    "knowledge base and the document lists provided in the user message. Use that "
                    "information to answer. Do not say you do not have access to the user's files or "
                    "uploads—you do; the lists and excerpts in the conversation are that access."
                )
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
                        payload = r.payload or {}
                        text = payload.get("text") or ""
                        source = payload.get("source") or ""
                        prefix = f"[From: {source}]\n" if source else ""
                        chunk = f"{prefix}{text}" if prefix else text
                        if not text or total + len(chunk) > CONTEXT_CHAR_LIMIT:
                            continue
                        parts.append(chunk)
                        total += len(chunk)
                    if parts:
                        context = "\n\n---\n\n".join(parts)
                        prompt = (
                            f"{doc_list_str}"
                            "Use the following excerpts from our documentation when relevant:\n\n"
                            f"{context}\n\n---\n\nQuestion: {message}"
                        )
                    elif doc_list_str:
                        prompt = f"{doc_list_str}Question: {message}"
                elif doc_list_str:
                    prompt = f"{doc_list_str}Question: {message}"
        except Exception as e:
            logger.warning("RAG retrieval failed, continuing without context: %s", e)
    used_model = model or settings.ollama_model
    reply = await ollama_chat(prompt, model=used_model, system=system_prompt)
    return reply, used_model
