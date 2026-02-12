"""FastAPI application entry point with lifespan, CORS, health, and API router."""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from ag_ui_langgraph import add_langgraph_fastapi_endpoint
from copilotkit import LangGraphAGUIAgent
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.agents.rag_agent import graph
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup: init DB and other resources. Shutdown: cleanup."""
    await init_db()
    yield
    # Optional: close Neo4j, Redis, Qdrant clients if held at app state


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="Marlowe API",
        description="AI governance – frameworks, assessments, evidence, knowledge graph",
        version="0.1.0",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(api_router, prefix=settings.api_v1_prefix)
    # CopilotKit AG-UI endpoint for LangGraph agent (RAG chat)
    add_langgraph_fastapi_endpoint(
        app,
        LangGraphAGUIAgent(
            name="marlowe_agent",
            description="Marlowe AI governance assistant with RAG over your knowledge base.",
            graph=graph,
        ),
        path="/api/v1/copilotkit",
    )
    return app


app = create_app()
