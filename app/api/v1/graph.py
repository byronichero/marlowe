"""Knowledge graph API – Neo4j-backed; nodes and edges for visualization."""

from fastapi import APIRouter, Depends

from app.core.database import get_db
from app.schemas import GraphResponse
from app.services.graph_service import ensure_indexes, get_graph
from app.services.graph_sync import sync_all_frameworks_and_requirements
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


@router.get("", response_model=GraphResponse)
async def get_knowledge_graph() -> GraphResponse:
    """Return graph nodes and edges for knowledge-graph visualization."""
    return await get_graph()


@router.post("/sync")
async def sync_graph_from_postgres(db: AsyncSession = Depends(get_db)) -> dict:
    """Sync all frameworks and requirements from Postgres to Neo4j (initial load or refresh)."""
    await ensure_indexes()
    counts = await sync_all_frameworks_and_requirements(db)
    return {"ok": True, "frameworks": counts["frameworks"], "requirements": counts["requirements"]}
