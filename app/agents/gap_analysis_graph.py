"""LangGraph gap analysis – multi-agent workflow for compliance gap assessment."""

import logging
from typing import Any, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_ollama import ChatOllama
from langgraph.graph import END, START, StateGraph

from app.core.config import settings

logger = logging.getLogger(__name__)


class GapAnalysisState(TypedDict, total=False):
    """State for the gap analysis workflow."""

    framework_name: str
    requirements_summary: str
    evidence_context: str
    framework_analysis: str
    evidence_review: str
    gap_assessment: str
    report: str


def _get_chat() -> ChatOllama:
    """Return ChatOllama for gap analysis (non-streaming for structured output)."""
    return ChatOllama(
        base_url=settings.ollama_host.rstrip("/"),
        model=settings.ollama_model,
        temperature=0.3,
        stream=False,
    )


async def _invoke_node(system_prompt: str, user_content: str) -> str:
    """Invoke ChatOllama and return content. Raises on failure."""
    chat = _get_chat()
    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_content),
    ]
    try:
        response = await chat.ainvoke(messages)
        return response.content if hasattr(response, "content") else str(response)
    except Exception as e:
        logger.warning("Gap analysis node failed: %s", e)
        raise


async def framework_analyst_node(state: GapAnalysisState) -> dict[str, Any]:
    """Analyze framework and requirements; produce structured summary."""
    user_content = (
        f"Framework: {state['framework_name']}\n\n"
        f"Requirements:\n{state['requirements_summary']}\n\n"
        "Provide a structured summary of each requirement and what evidence would demonstrate compliance."
    )
    system_prompt = (
        "You are a Framework Analyst, an expert in AI governance standards. "
        "Interpret framework clauses accurately and summarize what evidence would demonstrate compliance."
    )
    output = await _invoke_node(system_prompt, user_content)
    return {"framework_analysis": output}


async def evidence_reviewer_node(state: GapAnalysisState) -> dict[str, Any]:
    """Review evidence against requirements; map evidence to requirements."""
    evidence = state["evidence_context"] or "No evidence provided."
    user_content = (
        f"Framework analysis (from previous step):\n{state['framework_analysis']}\n\n"
        f"Evidence excerpts from the organization:\n{evidence}\n\n"
        "Map each piece of evidence to relevant framework requirements. Note strengths and weaknesses."
    )
    system_prompt = (
        "You are an Evidence Reviewer, a compliance auditor who evaluates policies, procedures, and artifacts. "
        "Assess organizational evidence against framework requirements."
    )
    output = await _invoke_node(system_prompt, user_content)
    return {"evidence_review": output}


async def gap_assessor_node(state: GapAnalysisState) -> dict[str, Any]:
    """Assess gaps; produce per-requirement status and recommendations."""
    user_content = (
        f"Framework analysis:\n{state['framework_analysis']}\n\n"
        f"Evidence review:\n{state['evidence_review']}\n\n"
        "Produce a gap analysis report. For each requirement, state: COMPLIANT, PARTIAL, GAP, or NOT_APPLICABLE. "
        "Include a brief rationale and recommendations for closing gaps."
    )
    system_prompt = (
        "You are a Gap Assessor, a seasoned auditor who produces structured gap findings and recommendations. "
        "Identify gaps between requirements and evidence; determine compliance status."
    )
    output = await _invoke_node(system_prompt, user_content)
    return {"gap_assessment": output, "report": output}


# Build the graph
_gap_workflow = StateGraph(GapAnalysisState)
_gap_workflow.add_node("framework_analyst", framework_analyst_node)
_gap_workflow.add_node("evidence_reviewer", evidence_reviewer_node)
_gap_workflow.add_node("gap_assessor", gap_assessor_node)
_gap_workflow.add_edge(START, "framework_analyst")
_gap_workflow.add_edge("framework_analyst", "evidence_reviewer")
_gap_workflow.add_edge("evidence_reviewer", "gap_assessor")
_gap_workflow.add_edge("gap_assessor", END)

gap_analysis_graph = _gap_workflow.compile()


async def run_gap_analysis(
    framework_name: str,
    requirements_summary: str,
    evidence_context: str,
) -> dict[str, Any]:
    """
    Run the gap analysis LangGraph workflow.
    Returns dict with keys: output (str), ok (bool), error (str | None).
    """
    try:
        initial_state: GapAnalysisState = {
            "framework_name": framework_name,
            "requirements_summary": requirements_summary,
            "evidence_context": evidence_context,
            "framework_analysis": "",
            "evidence_review": "",
            "gap_assessment": "",
            "report": "",
        }
        config = {"configurable": {}}
        result = await gap_analysis_graph.ainvoke(initial_state, config=config)
        report = result.get("report", "") or result.get("gap_assessment", "")
        return {"ok": True, "output": report, "error": None}
    except Exception as e:
        logger.exception("Gap analysis graph failed")
        return {"ok": False, "output": "", "error": str(e)}
