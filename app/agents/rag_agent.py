"""Minimal LangGraph agents for CopilotKit AG-UI: Marlowe (RAG + system prompt) and free chat (plain model)."""

import logging

from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, MessagesState, StateGraph

from app.services.chat_service import build_rag_prompt
from app.services.llm_service import llm_chat, llm_provider

logger = logging.getLogger(__name__)


def _resolve_model(config: RunnableConfig, state: MessagesState) -> str | None:
    """Get model from CopilotKit config/state or return None for default."""
    configurable = (config or {}).get("configurable") or {}
    model_override = configurable.get("model")
    if not model_override and isinstance(state.get("copilotkit"), dict):
        model_override = state["copilotkit"].get("model")
    if model_override is not None and isinstance(model_override, str):
        return model_override
    return None


def _last_user_content(state: MessagesState) -> str:
    """Extract last user message content from state."""
    messages = state.get("messages") or []
    for m in reversed(messages):
        if isinstance(m, HumanMessage):
            return m.content if isinstance(m.content, str) else str(m.content)
    return ""


async def _invoke_chat(
    state: MessagesState,
    config: RunnableConfig,
    system_prompt: str | None,
    user_content: str,
) -> dict:
    """Call the configured LLM provider and return the response as AIMessage."""
    chosen_model = _resolve_model(config, state)
    try:
        reply, used_model = await llm_chat(
            message=user_content,
            model=chosen_model,
            system=system_prompt,
        )
        logger.info("Chat node used %s model: %s", llm_provider(), used_model)
        return {"messages": [AIMessage(content=reply)]}
    except Exception as e:
        logger.exception("Chat node failed")
        return {"messages": [AIMessage(content=f"Error: {e!s}")]}


async def rag_chat_node(state: MessagesState, config: RunnableConfig) -> dict:
    """
    Marlowe node: build RAG prompt (system prompt + context from build_rag_prompt), then chat.
    System prompt and RAG logic are unchanged; used only by the main-chat graph.
    """
    last_content = _last_user_content(state)
    if not last_content:
        return {"messages": [AIMessage(content="No message received.")]}
    system_prompt, user_content = await build_rag_prompt(last_content, None)
    return await _invoke_chat(state, config, system_prompt, user_content)


async def free_chat_node(state: MessagesState, config: RunnableConfig) -> dict:
    """
    Free chat node: no RAG, no system prompt; only the user message to the model.
    Used by the side-popup graph.
    """
    last_content = _last_user_content(state)
    if not last_content:
        return {"messages": [AIMessage(content="No message received.")]}
    return await _invoke_chat(state, config, None, last_content)


# Marlowe graph: RAG + system prompt (unchanged behavior)
checkpointer = MemorySaver()
_workflow_marlowe = StateGraph(MessagesState)
_workflow_marlowe.add_node("rag_chat", rag_chat_node)
_workflow_marlowe.add_edge(START, "rag_chat")
_workflow_marlowe.add_edge("rag_chat", END)
graph = _workflow_marlowe.compile(checkpointer=checkpointer)

# Free chat graph: plain model only
_workflow_free = StateGraph(MessagesState)
_workflow_free.add_node("free_chat", free_chat_node)
_workflow_free.add_edge(START, "free_chat")
_workflow_free.add_edge("free_chat", END)
graph_free = _workflow_free.compile(checkpointer=MemorySaver())
