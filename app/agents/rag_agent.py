"""Minimal LangGraph agent that wraps Marlowe RAG chat for CopilotKit AG-UI."""

import logging
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, MessagesState, StateGraph

from app.services.chat_service import chat_with_context

logger = logging.getLogger(__name__)


async def rag_chat_node(state: MessagesState, config: RunnableConfig) -> dict:
    """
    Single node: take the last user message, call RAG chat_with_context, return assistant message.
    Model can be overridden via config.configurable.model (from CopilotKit frontend properties).
    """
    messages = state.get("messages") or []
    last_content = ""
    for m in reversed(messages):
        if isinstance(m, HumanMessage):
            last_content = m.content if isinstance(m.content, str) else str(m.content)
            break
    if not last_content:
        return {"messages": [AIMessage(content="No message received.")]}
    configurable = (config or {}).get("configurable") or {}
    model_override = configurable.get("model")
    if not model_override and isinstance(state.get("copilotkit"), dict):
        model_override = state["copilotkit"].get("model")
    if model_override is not None and not isinstance(model_override, str):
        model_override = None
    try:
        reply, _model = await chat_with_context(
            message=last_content,
            context_document_ids=None,
            model=model_override,
            use_rag=True,
        )
        return {"messages": [AIMessage(content=reply)]}
    except Exception as e:
        logger.exception("RAG chat node failed")
        return {"messages": [AIMessage(content=f"Error: {e!s}")]}


# Build minimal graph: single node, straight through.
# Checkpointer required so AG-UI/CopilotKit receives a terminal event and run lifecycle is correct.
checkpointer = MemorySaver()
_workflow = StateGraph(MessagesState)
_workflow.add_node("rag_chat", rag_chat_node)
_workflow.add_edge(START, "rag_chat")
_workflow.add_edge("rag_chat", END)
graph = _workflow.compile(checkpointer=checkpointer)
