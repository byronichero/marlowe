"""Bridge document uploads (Qdrant) to Postgres Evidence for Knowledge Graph visibility."""

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_factory
from app.models import Assessment, Evidence, Requirement
from app.services.graph_sync import sync_evidence_to_neo4j

logger = logging.getLogger(__name__)

DEFAULT_ASSESSMENT_TITLE = "Uploaded Documents"


async def _get_or_create_default_assessment(db: AsyncSession, framework_id: int) -> Assessment:
    """Get or create a default assessment for framework-level document evidence."""
    result = await db.execute(
        select(Assessment).where(
            Assessment.framework_id == framework_id,
            Assessment.title == DEFAULT_ASSESSMENT_TITLE,
        )
    )
    assessment = result.scalar_one_or_none()
    if assessment:
        return assessment
    assessment = Assessment(
        title=DEFAULT_ASSESSMENT_TITLE,
        status="draft",
        framework_id=framework_id,
    )
    db.add(assessment)
    await db.flush()
    await db.refresh(assessment)
    return assessment


async def create_evidence_for_uploaded_document(
    framework_id: int,
    object_key: str,
    filename: str | None = None,
) -> bool:
    """
    Create Postgres Evidence and sync to Neo4j for an uploaded document.
    Links to the first requirement of the framework as a proxy for framework-level evidence.
    Returns True if Evidence was created, False if skipped (e.g. no requirements).
    """
    async with async_session_factory() as db:
        try:
            # Get first requirement for the framework
            req_result = await db.execute(
                select(Requirement)
                .where(Requirement.framework_id == framework_id)
                .order_by(Requirement.id)
                .limit(1)
            )
            requirement = req_result.scalar_one_or_none()
            if not requirement:
                logger.info(
                    "Skipping Evidence creation: no requirements for framework_id=%s",
                    framework_id,
                )
                return False

            assessment = await _get_or_create_default_assessment(db, framework_id)
            evidence = Evidence(
                requirement_id=requirement.id,
                assessment_id=assessment.id,
                file_key=object_key,
                filename=filename,
            )
            db.add(evidence)
            await db.flush()
            await db.refresh(evidence)
            await db.commit()

            await sync_evidence_to_neo4j(
                evidence.id,
                evidence.requirement_id,
                evidence.file_key,
                evidence.filename,
            )
            logger.info(
                "Created Evidence id=%s for framework_id=%s (object_key=%s)",
                evidence.id,
                framework_id,
                object_key,
            )
            return True
        except Exception as e:
            await db.rollback()
            logger.warning(
                "Failed to create Evidence for framework_id=%s, object_key=%s: %s",
                framework_id,
                object_key,
                e,
            )
            return False
