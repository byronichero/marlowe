"""Seed NIST AI RMF Trustworthiness Taxonomy from markdown tables."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import Framework, Requirement
from app.services.graph_sync import sync_framework_to_neo4j, sync_requirement_to_neo4j

logger = logging.getLogger(__name__)

TAXONOMY_FRAMEWORK_SLUG = "nist-ai-rmf-trustworthiness-taxonomy"
TAXONOMY_FRAMEWORK_NAME = "NIST AI RMF Trustworthiness Taxonomy"
TAXONOMY_FRAMEWORK_DESCRIPTION = (
    "Outcome-based taxonomy of AI trustworthiness properties aligned to the NIST AI RMF. "
    "Organized by lifecycle stage and trustworthiness characteristic."
)

STAGE_PLAN = "Plan and Design"
STAGE_DATA = "Collect and Process Data"
STAGE_MODEL = "Build and Use Model"
STAGE_VERIFY = "Verify and Validate"
STAGE_DEPLOY = "Deploy and Use"
STAGE_OPERATE = "Operate and Monitor"
STAGE_IMPACT = "Use or Impacted By"

STAGE_NAME_MAP: dict[str, str] = {
    "plan and design": STAGE_PLAN,
    "collect and process data": STAGE_DATA,
    "build and use model": STAGE_MODEL,
    "verify and validate": STAGE_VERIFY,
    "deploy and use": STAGE_DEPLOY,
    "operate and monitor": STAGE_OPERATE,
    "use or impacted by": STAGE_IMPACT,
}

STAGE_CODE_MAP: dict[str, str] = {
    STAGE_PLAN: "PLAN",
    STAGE_DATA: "DATA",
    STAGE_MODEL: "MODEL",
    STAGE_VERIFY: "VERIFY",
    STAGE_DEPLOY: "DEPLOY",
    STAGE_OPERATE: "OPERATE",
    STAGE_IMPACT: "IMPACT",
}


def _resolve_taxonomy_path() -> Path:
    docs_root = Path(settings.docs_path)
    if not docs_root.is_absolute():
        docs_root = Path.cwd() / docs_root
    return docs_root / "taxonomy-ai.md"


def _resolve_clean_taxonomy_path() -> Path:
    docs_root = Path(settings.docs_path)
    if not docs_root.is_absolute():
        docs_root = Path.cwd() / docs_root
    primary = docs_root / "taxonomy-ai-clean.json"
    fallback = Path("/tmp/taxonomy-ai-clean.json")
    return primary if primary.exists() else fallback


def _load_clean_taxonomy(path: Path) -> list[dict[str, str | None]]:
    import json

    rows = json.loads(path.read_text(encoding="utf-8"))
    items: list[dict[str, str | None]] = []
    for row in rows:
        stage = (row.get("stage") or "").strip()
        characteristic = (row.get("characteristic") or "").strip()
        prop_name = (row.get("property") or "").strip()
        question = (row.get("questions") or "").strip()
        subcats = (row.get("subcategories") or "").strip()
        if not stage or not characteristic or not prop_name:
            continue
        items.append(
            {
                "identifier": "",
                "title": prop_name,
                "description": _build_description(question, subcats),
                "level": stage,
                "family": characteristic,
            }
        )
    return items


def _extract_stage_heading(line: str) -> str | None:
    stripped = line.strip()
    if stripped.startswith("## AI LIFECYCLE STAGE:"):
        return stripped.split(":", 1)[1].strip()
    if stripped.startswith("## AI Lifecycle Stage:"):
        return stripped.split(":", 1)[1].strip()
    return None


def _normalize_stage(raw_stage: str) -> str | None:
    return STAGE_NAME_MAP.get(raw_stage.lower())


def _is_separator_row(line: str) -> bool:
    """Detect markdown table separator rows like | --- | --- | --- | --- |."""
    if not line.lstrip().startswith("|"):
        return False
    cells = [c.strip() for c in line.strip().strip("|").split("|")]
    if not cells:
        return True
    for cell in cells:
        if cell and not all(ch in "-: " for ch in cell):
            return False
    return True


def _parse_table_row(line: str) -> list[str] | None:
    if not line.lstrip().startswith("|"):
        return None
    if _is_separator_row(line):
        return None
    cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
    if len(cells) < 4:
        return None
    if len(cells) > 4:
        cells = cells[:3] + [" | ".join(cells[3:])]
    return cells


def _is_appendix_stop_line(line: str) -> bool:
    lower = line.strip().lower()
    if lower.startswith("## appendix"):
        return True
    if "properties of trustworthiness without segmentation" in lower:
        return True
    return False


def _build_description(question: str, subcats: str) -> str | None:
    description_parts: list[str] = []
    if question:
        description_parts.append(question.strip())
    if subcats:
        description_parts.append(f"Relevant NIST AI RMF Subcategories: {subcats.strip()}")
    return "\n\n".join(description_parts) if description_parts else None


def _next_identifier(stage: str, stage_counts: dict[str, int]) -> str:
    stage_counts[stage] = stage_counts.get(stage, 0) + 1
    stage_code = STAGE_CODE_MAP[stage]
    return f"{stage_code}.{stage_counts[stage]:02d}"


def _update_stage_if_heading(
    line: str, stage: str | None, characteristic: str | None, stage_counts: dict[str, int]
) -> tuple[str | None, str | None]:
    if line.strip().lower().startswith("## appendix"):
        return None, None
    raw_stage = _extract_stage_heading(line)
    if not raw_stage:
        return stage, characteristic
    canonical = _normalize_stage(raw_stage)
    if canonical is None:
        logger.warning("Unknown lifecycle stage in taxonomy: %s", raw_stage)
        return None, None
    stage_counts.setdefault(canonical, 0)
    return canonical, None


def _item_from_table_line(
    line: str,
    stage: str,
    characteristic: str | None,
    stage_counts: dict[str, int],
) -> tuple[dict[str, str | None] | None, str | None]:
    if "NIST Characteristics of Trustworthiness" in line:
        return None, characteristic

    row = _parse_table_row(line)
    if row is None:
        return None, characteristic

    row_characteristic, prop_name, question, subcats = row
    if row_characteristic:
        characteristic = row_characteristic
    if not characteristic or not prop_name:
        return None, characteristic
    if prop_name.lower().startswith("properties of trustworthiness"):
        return None, characteristic

    identifier = _next_identifier(stage, stage_counts)
    item = {
        "identifier": identifier,
        "title": prop_name.strip(),
        "description": _build_description(question, subcats),
        "level": stage,
        "family": characteristic.strip(),
    }
    return item, characteristic


def _parse_taxonomy_markdown(path: Path) -> list[dict[str, str | None]]:
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    stage: str | None = None
    characteristic: str | None = None
    stage_counts: dict[str, int] = {}
    items: list[dict[str, str | None]] = []
    saw_stage = False

    for line in lines:
        if saw_stage and _is_appendix_stop_line(line):
            break
        stage, characteristic = _update_stage_if_heading(
            line, stage, characteristic, stage_counts
        )
        if stage is None:
            continue
        saw_stage = True
        if line.lstrip().startswith("|"):
            if _is_separator_row(line):
                continue
            if _parse_table_row(line) is None:
                # Appendix II switches to a 3-column table; stop once stages are parsed.
                break
        item, characteristic = _item_from_table_line(
            line, stage, characteristic, stage_counts
        )
        if item:
            items.append(item)

    return items


async def seed_nist_ai_rmf_taxonomy(
    db: AsyncSession,
    replace_existing: bool = False,
    mvp_only: bool = False,
) -> dict[str, Any]:
    """
    Seed the NIST AI RMF Trustworthiness Taxonomy into the database.

    Args:
        db: Async database session (caller manages commit/rollback).
        replace_existing: If True, delete existing taxonomy framework and re-seed.
        mvp_only: If True, only seed the first two lifecycle stages.

    Returns:
        {"ok": bool, "framework_id": int, "properties_created": int, "error": str | None}
    """
    taxonomy_path = _resolve_taxonomy_path()
    clean_path = _resolve_clean_taxonomy_path()
    if clean_path.exists():
        items = _load_clean_taxonomy(clean_path)
    elif taxonomy_path.exists():
        items = _parse_taxonomy_markdown(taxonomy_path)
    else:
        return {
            "ok": False,
            "framework_id": 0,
            "properties_created": 0,
            "error": f"Taxonomy markdown not found: {taxonomy_path}",
        }

    if mvp_only:
        allowed = {STAGE_PLAN, STAGE_DATA}
        items = [item for item in items if item.get("level") in allowed]

    if not items:
        return {
            "ok": False,
            "framework_id": 0,
            "properties_created": 0,
            "error": "No taxonomy properties parsed from markdown",
        }

    result = await db.execute(
        select(Framework).where(Framework.slug == TAXONOMY_FRAMEWORK_SLUG)
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
                "properties_created": 0,
                "error": f"Framework '{TAXONOMY_FRAMEWORK_SLUG}' already exists. "
                "Use replace_existing=True to replace.",
            }

    framework = Framework(
        name=TAXONOMY_FRAMEWORK_NAME,
        slug=TAXONOMY_FRAMEWORK_SLUG,
        description=TAXONOMY_FRAMEWORK_DESCRIPTION,
        region="US",
        framework_type="NIST AI RMF",
    )
    db.add(framework)
    await db.flush()
    await db.refresh(framework)
    await sync_framework_to_neo4j(
        framework.id,
        framework.name,
        framework.slug,
        framework.description,
        framework.region,
        framework.framework_type,
    )

    created = 0
    stage_counts: dict[str, int] = {}
    for item in items:
        level = item.get("level")
        if not level:
            continue
        stage_counts[level] = stage_counts.get(level, 0) + 1
        stage_code = STAGE_CODE_MAP.get(level, "STAGE")
        identifier = item.get("identifier") or f"{stage_code}.{stage_counts[level]:02d}"
        req = Requirement(
            framework_id=framework.id,
            parent_id=None,
            identifier=identifier,
            title=item["title"] or "",
            description=item.get("description"),
            level=level,
            family=item.get("family"),
        )
        db.add(req)
        await db.flush()
        await db.refresh(req)
        created += 1
        await sync_requirement_to_neo4j(
            req.id,
            framework.id,
            req.identifier,
            req.title,
            req.description,
            req.level,
            req.family,
        )

    return {
        "ok": True,
        "framework_id": framework.id,
        "properties_created": created,
    }
