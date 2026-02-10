"""Knowledge graph API – Neo4j-backed; nodes and edges for visualization."""

from fastapi import APIRouter

from app.schemas import GraphResponse
from app.services.graph_service import get_graph

router = APIRouter()


@router.get("", response_model=GraphResponse)
async def get_knowledge_graph() -> GraphResponse:
    """Return graph nodes and edges for knowledge-graph visualization."""
    return await get_graph()
