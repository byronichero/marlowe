"""Versioned API router – mounts all v1 endpoints."""

from fastapi import APIRouter

from app.api.v1 import (
    health,
    frameworks,
    requirements,
    assessments,
    evidence,
    documents,
    chat,
    reports,
    graph,
    faq,
    ollama,
    gap_analysis,
    nist,
)

api_router = APIRouter()

api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(nist.router, prefix="/nist", tags=["nist"])
api_router.include_router(frameworks.router, prefix="/frameworks", tags=["frameworks"])
api_router.include_router(requirements.router, prefix="/requirements", tags=["requirements"])
api_router.include_router(assessments.router, prefix="/assessments", tags=["assessments"])
api_router.include_router(evidence.router, prefix="/evidence", tags=["evidence"])
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
api_router.include_router(graph.router, prefix="/graph", tags=["graph"])
api_router.include_router(ollama.router, prefix="/ollama", tags=["ollama"])
api_router.include_router(faq.router, prefix="/faq", tags=["faq"])
api_router.include_router(gap_analysis.router, prefix="/gap-analysis", tags=["gap-analysis"])
