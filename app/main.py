"""FastAPI application entry point with lifespan, CORS, health, and API router."""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from ag_ui_langgraph import add_langgraph_fastapi_endpoint
from copilotkit import LangGraphAGUIAgent
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.agents.rag_agent import graph, graph_free
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import init_db
from app.services.otel import init_otel

# Main chat uses Marlowe system prompt + RAG; side popup uses plain model (free_chat_agent).
MARLOWE_AGENT = LangGraphAGUIAgent(
    name="marlowe_agent",
    description="Marlowe AI governance assistant with RAG over your knowledge base.",
    graph=graph,
)
FREE_CHAT_AGENT = LangGraphAGUIAgent(
    name="free_chat_agent",
    description="General chat with the model (no Marlowe system prompt).",
    graph=graph_free,
)


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
    init_otel(app)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(api_router, prefix=settings.api_v1_prefix)
    # CopilotKit AG-UI: one endpoint per agent (avoids list-dispatch 502); same graph, different paths.
    add_langgraph_fastapi_endpoint(
        app,
        MARLOWE_AGENT,
        path="/api/v1/copilotkit",
    )
    add_langgraph_fastapi_endpoint(
        app,
        FREE_CHAT_AGENT,
        path="/api/v1/copilotkit/free",
    )
    return app


app = create_app()
