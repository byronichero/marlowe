"""Seed NIST SP 800-53 controls from OSCAL catalog into the database."""

import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import async_session_factory
from app.models import Framework, Requirement
from app.services.graph_sync import sync_framework_to_neo4j, sync_requirement_to_neo4j
from app.services.nist_oscal_service import load_and_parse_catalog

logger = logging.getLogger(__name__)

NIST_FRAMEWORK_SLUG = "nist-800-53-rev5"
NIST_FRAMEWORK_NAME = "NIST SP 800-53 Rev 5"
NIST_FRAMEWORK_DESCRIPTION = (
    "Security and privacy controls for information systems and organizations. "
    "Basis for FedRAMP. 20 families, 1,189 controls (base + enhancements)."
)


async def seed_nist_80053(
    db: AsyncSession,
    catalog_url: str | None = None,
    replace_existing: bool = False,
) -> dict[str, Any]:
    """
    Seed NIST SP 800-53 Rev 5 framework and controls from OSCAL catalog.

    Args:
        db: Async database session (caller manages commit/rollback).
        catalog_url: Optional URL or path to OSCAL catalog JSON. Default: fetch from NIST GitHub.
        replace_existing: If True, delete existing NIST framework and re-seed.

    Returns:
        {"ok": bool, "framework_id": int, "controls_created": int, "error": str | None}
    """
    # Parse catalog
    try:
        controls_data = load_and_parse_catalog(catalog_url)
    except Exception as e:
        logger.exception("Failed to load/parse OSCAL catalog")
        return {"ok": False, "framework_id": 0, "controls_created": 0, "error": str(e)}

    if not controls_data:
        return {"ok": False, "framework_id": 0, "controls_created": 0, "error": "No controls found in catalog"}

    # Check for existing NIST framework
    result = await db.execute(
        select(Framework).where(Framework.slug == NIST_FRAMEWORK_SLUG)
    )
    existing = result.scalar_one_or_none()
    if existing:
        if replace_existing:
            await db.delete(existing)
            await db.flush()
        else:
            return {
                "ok": False,
                "framework_id": existing.id,
                "controls_created": 0,
                "error": f"Framework '{NIST_FRAMEWORK_SLUG}' already exists. Use replace_existing=True to replace.",
            }

    # Create framework
    framework = Framework(
        name=NIST_FRAMEWORK_NAME,
        slug=NIST_FRAMEWORK_SLUG,
        description=NIST_FRAMEWORK_DESCRIPTION,
        region="US",
        framework_type="NIST",
    )
    db.add(framework)
    await db.flush()
    await db.refresh(framework)
    await sync_framework_to_neo4j(
        framework.id, framework.name, framework.slug,
        framework.description, framework.region, framework.framework_type,
    )

    # Build identifier -> id mapping for parent lookups (we need DB ids)
    identifier_to_id: dict[str, int] = {}
    controls_by_parent: dict[str | None, list[dict]] = {}
    for ctrl in controls_data:
        parent = ctrl.get("parent_identifier")
        if parent not in controls_by_parent:
            controls_by_parent[parent] = []
        controls_by_parent[parent].append(ctrl)

    # Insert in order: base controls first (parent=None), then enhancements
    created = 0
    to_process: list[tuple[str | None, list[dict]]] = [(None, controls_by_parent.get(None, []))]
    while to_process:
        parent_ident, children = to_process.pop(0)
        for ctrl in children:
            parent_id = identifier_to_id.get(parent_ident) if parent_ident else None
            req = Requirement(
                framework_id=framework.id,
                parent_id=parent_id,
                identifier=ctrl["identifier"],
                title=ctrl["title"],
                description=ctrl.get("description"),
                family=ctrl.get("family"),
                level=None,
            )
            db.add(req)
            await db.flush()
            await db.refresh(req)
            identifier_to_id[ctrl["identifier"]] = req.id
            created += 1
            await sync_requirement_to_neo4j(
                req.id, framework.id, req.identifier, req.title,
                req.description, req.level, req.family,
            )
            # Queue enhancements of this control
            sub = controls_by_parent.get(ctrl["identifier"], [])
            if sub:
                to_process.append((ctrl["identifier"], sub))

    return {
        "ok": True,
        "framework_id": framework.id,
        "controls_created": created,
    }


async def ensure_nist_seeded() -> None:
    """
    Auto-seed NIST 800-53 on startup if not present.
    Runs in background; does not block app startup.
    Skips if nist_auto_seed is False or framework already exists.
    """
    if not getattr(settings, "nist_auto_seed", True):
        return
    async with async_session_factory() as session:
        try:
            result = await session.execute(
                select(Framework).where(Framework.slug == NIST_FRAMEWORK_SLUG)
            )
            if result.scalar_one_or_none() is not None:
                logger.info("NIST 800-53 already present, skipping auto-seed")
                return
            logger.info("NIST 800-53 not found, auto-seeding from OSCAL catalog...")
            seed_result = await seed_nist_80053(db=session, replace_existing=False)
            await session.commit()
            if seed_result.get("ok"):
                logger.info(
                    "NIST 800-53 auto-seeded: %d controls",
                    seed_result.get("controls_created", 0),
                )
            else:
                logger.warning(
                    "NIST 800-53 auto-seed skipped: %s",
                    seed_result.get("error", "unknown"),
                )
        except Exception as e:
            await session.rollback()
            logger.warning("NIST 800-53 auto-seed failed: %s", e)
