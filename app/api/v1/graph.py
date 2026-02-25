"""Knowledge graph API – Neo4j-backed; nodes and edges for visualization."""

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.database import get_db
from app.schemas import GraphHealth, GraphResponse, GraphStats
from app.services.crosswalk_service import generate_crosswalk
from app.services.graph_service import ensure_indexes, get_graph, get_graph_health, get_graph_stats
from app.services.graph_sync import sync_all_frameworks_and_requirements
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


@router.get("", response_model=GraphResponse)
async def get_knowledge_graph(
    framework_id: int | None = Query(None, description="Filter graph to a single framework"),
    fedramp_baseline: str | None = Query(
        None, description="FedRAMP baseline: low, moderate, high (NIST 800-53 only)"
    ),
) -> GraphResponse:
    """Return graph nodes and edges for knowledge-graph visualization."""
    return await get_graph(
        framework_id=framework_id, fedramp_baseline=fedramp_baseline
    )


@router.get("/stats", response_model=GraphStats)
async def get_knowledge_graph_stats(
    framework_id: int | None = Query(None, description="Filter stats to a single framework"),
    fedramp_baseline: str | None = Query(
        None, description="FedRAMP baseline: low, moderate, high (NIST 800-53 only)"
    ),
) -> GraphStats:
    """Return aggregate graph statistics for UI telemetry cards."""
    return await get_graph_stats(
        framework_id=framework_id, fedramp_baseline=fedramp_baseline
    )


@router.get("/health", response_model=GraphHealth)
async def get_knowledge_graph_health() -> GraphHealth:
    """Return Neo4j health status and version."""
    return await get_graph_health()


@router.post("/sync")
async def sync_graph_from_postgres(db: AsyncSession = Depends(get_db)) -> dict:
    """Sync all frameworks and requirements from Postgres to Neo4j (initial load or refresh)."""
    try:
        await ensure_indexes()
        counts = await sync_all_frameworks_and_requirements(db)
        return {
            "ok": True,
            "frameworks": counts["frameworks"],
            "requirements": counts["requirements"],
            "evidence": counts.get("evidence", 0),
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Sync failed: {e!s}. Check Neo4j is running and reachable.",
        )


@router.get("/crosswalk")
async def get_crosswalk(
    framework_a: int = Query(..., description="First framework ID"),
    framework_b: int = Query(..., description="Second framework ID"),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Generate a crosswalk mapping requirements between two frameworks.
    Uses embedding similarity to find best-matching requirements.
    """
    if framework_a == framework_b:
        raise HTTPException(status_code=400, detail="Select two different frameworks")
    result = await generate_crosswalk(db, framework_a, framework_b)
    if result.get("error"):
        raise HTTPException(status_code=404, detail=result["error"])
    return result
