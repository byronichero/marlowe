"""Minimal LangGraph agent that wraps Marlowe RAG chat for CopilotKit AG-UI."""

import logging

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from langchain_ollama import ChatOllama
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, MessagesState, StateGraph

from app.core.config import settings
from app.services.chat_service import build_rag_prompt

logger = logging.getLogger(__name__)


def _resolve_model(config: RunnableConfig, state: MessagesState) -> str:
    """Get model from CopilotKit config/state or settings default."""
    configurable = (config or {}).get("configurable") or {}
    model_override = configurable.get("model")
    if not model_override and isinstance(state.get("copilotkit"), dict):
        model_override = state["copilotkit"].get("model")
    if model_override is not None and isinstance(model_override, str):
        return model_override
    return settings.ollama_model


def _use_marlowe_context(config: RunnableConfig) -> bool:
    """True = use RAG and Marlowe system prompt; False = plain model (e.g. side/free chat)."""
    configurable = (config or {}).get("configurable") or {}
    explicit = configurable.get("useMarloweContext")
    if explicit is not None:
        return bool(explicit)
    # When request targets free_chat_agent, no Marlowe context
    return configurable.get("agent_id") != "free_chat_agent"


async def rag_chat_node(state: MessagesState, config: RunnableConfig) -> dict:
    """
    Single node: build RAG prompt (or plain user message), call ChatOllama (streaming), return assistant message.
    When useMarloweContext is False (e.g. free_chat_agent / side popup), skips RAG and system prompt.
    """
    messages = state.get("messages") or []
    last_content = ""
    for m in reversed(messages):
        if isinstance(m, HumanMessage):
            last_content = m.content if isinstance(m.content, str) else str(m.content)
            break
    if not last_content:
        return {"messages": [AIMessage(content="No message received.")]}
    chosen_model = _resolve_model(config, state)
    fallback_model = (
        settings.ollama_fallback_model
        if settings.ollama_fallback_model != chosen_model
        else None
    )
    use_marlowe = _use_marlowe_context(config)
    if use_marlowe:
        system_prompt, user_content = await build_rag_prompt(last_content, None)
    else:
        system_prompt, user_content = None, last_content
    lc_messages: list[SystemMessage | HumanMessage] = []
    if system_prompt:
        lc_messages.append(SystemMessage(content=system_prompt))
    lc_messages.append(HumanMessage(content=user_content))
    base_url = settings.ollama_host.rstrip("/")
    for attempt_model in [chosen_model] + ([fallback_model] if fallback_model else []):
        if not attempt_model:
            continue
        try:
            chat = ChatOllama(
                base_url=base_url,
                model=attempt_model,
                stream=True,
            )
            response = await chat.ainvoke(lc_messages)
            return {"messages": [response]}
        except Exception as e:
            logger.warning("ChatOllama failed for model %s: %s", attempt_model, e)
            if attempt_model == chosen_model and fallback_model:
                continue
            logger.exception("RAG chat node failed")
            return {"messages": [AIMessage(content=f"Error: {e!s}")]}
    return {"messages": [AIMessage(content="Error: No working model available.")]}


# Build minimal graph: single node, straight through.
# Checkpointer required so AG-UI/CopilotKit receives a terminal event and run lifecycle is correct.
checkpointer = MemorySaver()
_workflow = StateGraph(MessagesState)
_workflow.add_node("rag_chat", rag_chat_node)
_workflow.add_edge(START, "rag_chat")
_workflow.add_edge("rag_chat", END)
graph = _workflow.compile(checkpointer=checkpointer)
