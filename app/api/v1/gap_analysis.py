"""Gap analysis API – run LangGraph-based compliance gap assessment."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.database import get_db
from app.services.gap_analysis_service import run_gap_analysis_for_framework
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/run")
async def run_gap_analysis(
    framework_id: int = Query(..., description="Framework ID to assess"),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Run gap analysis for a framework using LangGraph agents.
    Fetches requirements from DB, gathers evidence from Qdrant, and produces a report.
    """
    try:
        report = await run_gap_analysis_for_framework(db, framework_id)
    except Exception as e:
        logger.exception("Gap analysis API failed")
        raise HTTPException(status_code=500, detail=str(e)) from e

    if not report.get("ok"):
        raise HTTPException(
            status_code=500,
            detail=report.get("error", "Gap analysis failed"),
        )

    return {
        "ok": True,
        "framework_id": framework_id,
        "report": report.get("output", ""),
    }
