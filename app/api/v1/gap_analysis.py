"""Gap analysis API – run LangGraph-based compliance gap assessment."""

import logging
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from fastapi.responses import JSONResponse

from app.core.database import async_session_factory, get_db
from app.services.gap_analysis_service import run_gap_analysis_for_framework_with_progress
from app.services.gap_report_service import create_gap_analysis_report
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)
router = APIRouter()

# Job store: job_id -> { status, percent, step, framework_id, report, error }
_gap_analysis_jobs: dict[str, dict] = {}


async def _run_gap_analysis_job(job_id: str, framework_id: int) -> None:
    """Run gap analysis in background and update job state with progress."""
    _gap_analysis_jobs[job_id]["status"] = "running"
    _gap_analysis_jobs[job_id]["percent"] = 0
    _gap_analysis_jobs[job_id]["step"] = "Starting..."

    def progress_callback(percent: int, step: str) -> None:
        _gap_analysis_jobs[job_id]["percent"] = percent
        _gap_analysis_jobs[job_id]["step"] = step

    try:
        async with async_session_factory() as db:
            report = await run_gap_analysis_for_framework_with_progress(
                db, framework_id, progress_callback=progress_callback
            )
            if report.get("ok") and report.get("output"):
                await create_gap_analysis_report(
                    db,
                    framework_id=framework_id,
                    report_text=report.get("output", ""),
                )
                await db.commit()
        if report.get("ok"):
            _gap_analysis_jobs[job_id].update(
                status="completed",
                percent=100,
                step="Complete",
                report=report.get("output", ""),
                error=None,
            )
        else:
            _gap_analysis_jobs[job_id].update(
                status="failed",
                error=report.get("error", "Gap analysis failed"),
            )
    except Exception as e:
        logger.exception("Gap analysis job %s failed", job_id)
        _gap_analysis_jobs[job_id].update(
            status="failed",
            error=str(e),
        )


@router.post("/run")
async def run_gap_analysis(
    background_tasks: BackgroundTasks,
    framework_id: int = Query(..., description="Framework ID to assess"),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """
    Start gap analysis as a background job. Returns 202 with job_id.
    Poll GET /gap-analysis/jobs/{job_id} for status and progress.
    """
    # Validate framework exists
    from sqlalchemy import select
    from app.models import Framework

    result = await db.execute(select(Framework).where(Framework.id == framework_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Framework not found")

    job_id = uuid.uuid4().hex
    _gap_analysis_jobs[job_id] = {
        "status": "pending",
        "percent": 0,
        "step": "Queued",
        "framework_id": framework_id,
        "report": None,
        "error": None,
    }

    background_tasks.add_task(_run_gap_analysis_job, job_id, framework_id)

    return JSONResponse(
        status_code=202,
        content={
            "job_id": job_id,
            "framework_id": framework_id,
            "message": "Gap analysis started. Poll /gap-analysis/jobs/{job_id} for progress.",
        },
    )


@router.get("/jobs/{job_id}")
async def get_gap_analysis_job(job_id: str) -> dict:
    """Get status and progress of a gap analysis job."""
    if job_id not in _gap_analysis_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    j = _gap_analysis_jobs[job_id]
    return {
        "job_id": job_id,
        "status": j["status"],
        "percent": j.get("percent", 0),
        "step": j.get("step", ""),
        "framework_id": j.get("framework_id"),
        "report": j.get("report"),
        "error": j.get("error"),
    }
