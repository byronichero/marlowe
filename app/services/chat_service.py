"""AI chat service – LLM provider with optional Qdrant document context."""

import logging

from app.core.config import settings
from app.services.graph_service import get_framework_names, get_graph_health, get_graph_stats
from app.services.llm_service import llm_chat, llm_embeddings
from app.services.qdrant_service import ensure_collection, get_recent_documents, list_document_sources, search

logger = logging.getLogger(__name__)

CONTEXT_CHUNKS_MAX = 6
CONTEXT_CHAR_LIMIT = 4000


async def _get_knowledge_graph_summary() -> str:
    """Fetch graph stats and framework names for chat context. Returns empty string on failure."""
    try:
        stats = await get_graph_stats()
        health = await get_graph_health()
        names = await get_framework_names()
        parts = [
            f"Knowledge graph (Neo4j): status {health.status}, version {health.version}.",
            f"Total nodes: {stats.total_nodes}, frameworks: {stats.framework_nodes}, "
            f"requirements: {stats.requirement_nodes}, relationships: {stats.total_relationships}.",
        ]
        if names:
            parts.append(f"Frameworks in the graph: {', '.join(names)}.")
        parts.append(
            "Users can explore and visualize the graph on the Knowledge Graph page. "
            "Use this information when they ask about the knowledge graph, frameworks, or requirements."
        )
        out = "[Marlowe knowledge graph summary]\n" + " ".join(parts) + "\n\n"
        logger.info("Knowledge graph summary included in chat (%d frameworks)", len(names))
        return out
    except Exception as e:
        logger.warning("Knowledge graph summary unavailable for chat: %s", e)
        return ""


async def build_rag_prompt(
    message: str,
    context_document_ids: list[str] | None = None,
) -> tuple[str | None, str]:
    """
    Build (system_prompt, user_content) for RAG: embed message, search Qdrant, format context.
    Returns (None, message) if RAG is skipped or fails. Used by streaming agent to build messages.
    """
    _ = context_document_ids
    system_prompt: str | None = None
    user_content = message
    try:
        graph_str = await _get_knowledge_graph_summary()
        ensure_collection()
        doc_list_str = ""
        if doc_sources := list_document_sources(settings.qdrant_collection):
            doc_list_str = (
                "Documents in the knowledge base: "
                + ", ".join(doc_sources)
                + ".\n\n"
            )
        recent_docs = get_recent_documents(settings.qdrant_collection, hours=24)
        if recent_docs:
            recent_list = [doc["source"] for doc in recent_docs]
            doc_list_str += (
                "Recently uploaded (last 24 hours, newest first): "
                + ", ".join(recent_list)
                + ". When the user asks what they just uploaded, which document they added, "
                "or about the most recent upload, answer using this list (the first item is the newest).\n\n"
            )
        doc_list_str = graph_str + doc_list_str
        if doc_list_str:
            system_prompt = (
                "You are the Marlowe AI governance assistant. You have direct access to the "
                "knowledge base, the knowledge graph summary, and the document lists provided in the user message. "
                "When the user asks about 'the graph', 'knowledge graph', 'frameworks in the graph', or 'which frameworks' "
                "they mean Marlowe's Neo4j knowledge graph (frameworks and requirements). Always use the graph summary "
                "in the message below to answer those questions—do not give a generic answer about graph theory or libraries. "
                "Use that information to answer. Do not say you do not have access to the user's files or uploads—you do; "
                "the lists and excerpts in the conversation are that access."
            )
            user_content = f"{doc_list_str}Question: {message}"
        query_vector = await llm_embeddings(message, model=settings.embedding_model)
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
                    user_content = (
                        f"{doc_list_str}"
                        "Use the following excerpts from our documentation when relevant:\n\n"
                        f"{context}\n\n---\n\nQuestion: {message}"
                    )
                elif doc_list_str:
                    user_content = f"{doc_list_str}Question: {message}"
            elif doc_list_str:
                user_content = f"{doc_list_str}Question: {message}"
    except Exception as e:
        logger.warning("RAG retrieval failed, continuing without context: %s", e)
    return system_prompt, user_content


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
    if use_rag:
        system_prompt, user_content = await build_rag_prompt(message, context_document_ids)
    else:
        system_prompt, user_content = None, message
    reply, used_model = await llm_chat(user_content, model=model, system=system_prompt)
    return reply, used_model
