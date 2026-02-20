"""Extract compliance requirements from framework documents.

Uses structure-aware parsing first (ISO clauses, NIST controls, annex tables),
then falls back to LLM only when needed. ISO/NIST documents have predictable
formats: clause numbers (4.2.1), control IDs (AC-1), and annex tables.
"""

import json
import logging
import re

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import Requirement
from app.services.graph_sync import sync_requirement_to_neo4j
from app.services.ollama_service import ollama_chat
from app.services.qdrant_service import get_chunks_for_framework

logger = logging.getLogger(__name__)

# Use structure-only when we get several matches (avoids slow LLM fallback)
MIN_STRUCTURE_ITEMS = 3
# Larger chunks = fewer LLM calls (each can take 1-3 min)
EXTRACTION_CHUNK_SIZE = 24_000
# Cap chars for LLM path to limit chunks (structure path uses full limit)
EXTRACTION_CHAR_LIMIT = 80_000
EXTRACTION_LLM_CHAR_LIMIT = 48_000  # max chars when falling back to LLM

# ISO clause: 4.1, 4.2.1, 6.1.2 - at line start
_ISO_CLAUSE_RE = re.compile(r"^\s*(\d+(?:\.\d+)+)\s+(.+?)$", re.MULTILINE)
# NIST control at line start: AC-1, AU-2, AC-2(1)
_NIST_CONTROL_RE = re.compile(r"^\s*([A-Z]{2,4}-\d+(?:\(\d+\))?)\s+(.+)$", re.MULTILINE)

# Pipe format preferred (CMMC-style); simpler for models than JSON
EXTRACT_SYSTEM = """You are an expert at extracting compliance requirements from standards (ISO, NIST, EU AI Act, GDPR).

Given document text, extract ALL distinct requirements, controls, or clauses.

Output one requirement per line in this exact format:
identifier | title | description

Examples:
4.2.1 | Context of the organization | The organization shall determine...
AC-1 | Access Control Policy | The organization develops...
Article 5 | Prohibited practices | The following practices are prohibited...

- identifier: Short reference (e.g. "4.2.1", "AC-1", "Article 5")
- title: Brief heading
- description: The requirement text or a 1-2 sentence summary

Use the pipe character | as separator. No JSON. No headers. One line per requirement."""


def _extract_by_structure(text: str, framework_type: str | None = None) -> list[dict]:
    """
    Extract requirements using patterns for ISO clauses, NIST controls, and annex tables.
    When framework_type is ISO or NIST, use type-specific patterns for better precision.
    """
    if not text or not text.strip():
        return []
    fw_type = (framework_type or "").upper()
    iso_only = "ISO" in fw_type
    nist_only = "NIST" in fw_type
    seen: set[str] = set()
    result: list[dict] = []

    # 1. Annex/table rows: pipe or tab separated (identifier in first column)
    for line in text.splitlines():
        line = line.strip()
        if not line or len(line) < 5:
            continue
        # Skip markdown table header separator
        if re.match(r"^[\s\|-]+$", line):
            continue
        parts = re.split(r"\t|\|", line)
        parts = [p.strip() for p in parts if p.strip()]
        if len(parts) >= 2:
            ident = parts[0]
            # Must look like an ID: ISO (4.2.1) or NIST (AC-1) or Article N
            is_iso_id = bool(re.match(r"^\d+(?:\.\d+)+$", ident))
            is_nist_id = bool(re.match(r"^[A-Z]{2,4}-\d+(?:\(\d+\))?$", ident))
            if iso_only and not is_iso_id:
                continue
            if nist_only and not is_nist_id:
                continue
            if not (is_iso_id or is_nist_id or re.match(r"^Article\s+\d+$", ident, re.I)):
                continue
            key = ident.lower()
            if key not in seen:
                seen.add(key)
                title = parts[1] if len(parts) > 1 else "Untitled"
                desc = parts[2] if len(parts) > 2 else None
                result.append({"identifier": ident, "title": title, "description": desc})

    # 2. ISO clause at line start: "4.2.1 Title" (skip if NIST-only)
    if not nist_only:
        for m in _ISO_CLAUSE_RE.finditer(text):
            ident, rest = m.group(1), m.group(2).strip()
            key = ident.lower()
            if key not in seen and len(ident) <= 20:
                seen.add(key)
                first_line = rest.split("\n")[0].strip()
                desc = rest if len(rest) > len(first_line) + 10 else None
                result.append({
                    "identifier": ident,
                    "title": first_line[:200] if first_line else "Untitled",
                    "description": desc[:2000] if desc else None,
                })

    # 3. NIST control at line start: AC-1 Title (skip if ISO-only)
    if not iso_only:
        for m in _NIST_CONTROL_RE.finditer(text):
            ident, rest = m.group(1), m.group(2).strip()
            key = ident.lower()
            if key not in seen:
                seen.add(key)
                title = rest.split("\n")[0].strip()[:200] if rest else "Untitled"
                desc = rest[len(title):].strip()[:2000] if len(rest) > len(title) + 5 else None
                result.append({"identifier": ident, "title": title or "Untitled", "description": desc})

    # Sort by identifier for consistent order (ISO numeric, NIST alphanumeric)
    result.sort(key=lambda x: (x["identifier"],))
    return result


def _parse_llm_response(content: str) -> list[dict]:
    """Parse LLM response: pipe format first, then JSON fallbacks."""
    if not content or not content.strip():
        return []
    content = content.strip()

    # 1. Pipe format (primary—matches our prompt)
    pipe_result = _parse_pipe_format(content)
    if pipe_result:
        return pipe_result

    # 2. JSON fallbacks
    parsed: list | None = None
    if "---JSON---" in content:
        parts = content.split("---JSON---", 1)
        json_part = (parts[1].strip() if len(parts) > 1 else "").strip()
        if json_part:
            try:
                parsed = json.loads(json_part)
            except json.JSONDecodeError:
                parsed = _extract_array_from_text(json_part)
    if parsed is None and "```" in content:
        match = re.search(r"```(?:json)?\s*([\s\S]*?)```", content)
        if match:
            try:
                parsed = json.loads(match.group(1).strip())
            except json.JSONDecodeError:
                parsed = _extract_array_from_text(match.group(1).strip())
    if parsed is None:
        parsed = _extract_array_from_text(content)

    if not isinstance(parsed, list):
        return []
    result = []
    for item in parsed:
        if not isinstance(item, dict):
            continue
        identifier = (item.get("identifier") or item.get("id") or "").strip()
        title = (item.get("title") or item.get("name") or "").strip()
        description = (item.get("description") or item.get("text") or "").strip()
        if identifier or title:
            result.append({
                "identifier": identifier or f"req-{len(result)+1}",
                "title": title or "Untitled requirement",
                "description": description or None,
            })
    return result


def _parse_pipe_format(content: str) -> list[dict]:
    """Parse pipe-separated lines: identifier | title | description."""
    result: list[dict] = []
    for line in content.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "---" in line[:10]:
            continue
        parts = [p.strip() for p in line.split("|")]
        if len(parts) >= 2:
            identifier = parts[0] or f"req-{len(result)+1}"
            title = parts[1]
            description = parts[2] if len(parts) > 2 else None
            result.append({"identifier": identifier, "title": title, "description": description})
    return result


def _extract_array_from_text(text: str) -> list | None:
    """Extract JSON array from text using first [ to last ]."""
    if not text or not text.strip():
        return None
    start, end = text.find("["), text.rfind("]")
    if start == -1 or end == -1 or end <= start:
        return None
    try:
        parsed = json.loads(text[start : end + 1])
        return parsed if isinstance(parsed, list) else None
    except json.JSONDecodeError:
        return None


def _split_at_structure(text: str, chunk_size: int = EXTRACTION_CHUNK_SIZE) -> list[str]:
    """Split at paragraph boundaries. Larger chunks reduce LLM calls."""
    if not text or len(text) <= chunk_size:
        return [text] if text and text.strip() else []
    chunks: list[str] = []
    paragraphs = text.split("\n\n")
    current: list[str] = []
    current_len = 0
    for p in paragraphs:
        p_len = len(p) + 2
        if current_len + p_len > chunk_size and current:
            chunks.append("\n\n".join(current))
            current = []
            current_len = 0
        current.append(p)
        current_len += p_len
    if current:
        chunks.append("\n\n".join(current))
    return chunks


async def _extract_from_chunk(
    chunk_text: str, model: str, framework_type: str | None = None
) -> list[dict]:
    """Single LLM call for one chunk. Uses pipe format (simpler than JSON)."""
    fw = (framework_type or "").upper()
    hint = ""
    if "ISO" in fw:
        hint = "This is an ISO standard. Extract clause numbers (e.g. 4.2.1) and titles. "
    elif "NIST" in fw:
        hint = "This is NIST 800-53. Extract control IDs (e.g. AC-1, AU-2) and titles. "
    prompt = f"{hint}Extract all compliance requirements from this section:\n\n{chunk_text}"
    reply = await ollama_chat(message=prompt, model=model, system=EXTRACT_SYSTEM)
    if not reply or not reply.strip():
        return []
    return _parse_llm_response(reply)


async def extract_requirements_from_text(
    text: str,
    model: str | None = None,
    framework_type: str | None = None,
) -> tuple[list[dict], str | None]:
    """
    Extract requirements: structure-aware first, LLM fallback.
    ISO/NIST docs use pattern parsing; others use LLM with pipe format.
    """
    if not text or len(text.strip()) < 100:
        return [], "Document text too short"

    # 1. Structure extraction (no LLM)—works for ISO annexes, NIST controls
    structure_items = _extract_by_structure(text, framework_type=framework_type)
    # If type-specific gave nothing, try all patterns (doc may use non-standard format)
    if not structure_items and framework_type:
        structure_items = _extract_by_structure(text, framework_type=None)
    if len(structure_items) >= MIN_STRUCTURE_ITEMS:
        logger.info(
            "Extraction: structure-based (ISO/NIST patterns), found %d items",
            len(structure_items),
        )
        return structure_items, None

    # 2. LLM fallback—pipe format, cap text to limit chunks (each Ollama call 1-3 min)
    effective_model = model or settings.ollama_model
    llm_text = text
    if len(text) > EXTRACTION_LLM_CHAR_LIMIT:
        llm_text = text[:EXTRACTION_LLM_CHAR_LIMIT] + "\n\n[Document truncated for extraction...]"
        logger.info("LLM extraction: truncating to %d chars (%d chunks max)", EXTRACTION_LLM_CHAR_LIMIT, 2)
    chunks = _split_at_structure(llm_text)
    if not chunks:
        return structure_items if structure_items else [], (
            "No requirements found. Document may not contain structured clauses or controls."
        )

    seen: set[str] = set()
    for item in structure_items:
        key = (item.get("identifier") or "").lower()
        if key:
            seen.add(key)
    merged = list(structure_items)

    logger.info("LLM extraction: processing %d chunk(s), ~%d min each", len(chunks), 1)
    for i, chunk in enumerate(chunks):
        try:
            items = await _extract_from_chunk(chunk, effective_model, framework_type)
            for item in items:
                ident = (item.get("identifier") or "").strip().lower()
                if ident and ident not in seen:
                    seen.add(ident)
                    merged.append(item)
        except Exception as e:
            logger.warning("Extraction chunk %d failed: %s", i + 1, e)

    if not merged:
        return [], (
            "No requirements could be extracted. Ensure the document contains "
            "structured content (e.g. ISO clauses, NIST controls, annex tables)."
        )
    return merged, None


async def extract_and_save_requirements(
    db: AsyncSession,
    framework_id: int,
    model: str | None = None,
) -> dict:
    """
    Get document text from Qdrant, extract requirements (structure first, then LLM),
    save to DB, sync to Neo4j.
    """
    from app.models import Framework

    result = await db.execute(select(Framework).where(Framework.id == framework_id))
    framework = result.scalar_one_or_none()
    if not framework:
        return {"ok": False, "extracted": 0, "created": 0, "skipped": 0, "error": "Framework not found"}

    text = get_chunks_for_framework(
        settings.qdrant_collection,
        framework_id,
        max_chars=EXTRACTION_CHAR_LIMIT,
    )
    if not text or len(text.strip()) < 100:
        return {
            "ok": False,
            "extracted": 0,
            "created": 0,
            "skipped": 0,
            "error": "No document content found for this framework. Upload a document first.",
        }

    extracted, extract_error = await extract_requirements_from_text(
        text, model=model, framework_type=framework.framework_type
    )
    if not extracted:
        return {
            "ok": False,
            "extracted": 0,
            "created": 0,
            "skipped": 0,
            "error": extract_error
            or "No requirements extracted. Try a document with structured clauses (ISO, NIST).",
        }

    existing = await db.execute(
        select(Requirement.identifier).where(Requirement.framework_id == framework_id)
    )
    existing_ids = {r[0].lower().strip() for r in existing.all()}

    created = 0
    skipped = 0
    for item in extracted:
        ident = (item.get("identifier") or "").strip()
        if not ident:
            continue
        if ident.lower() in existing_ids:
            skipped += 1
            continue
        req = Requirement(
            framework_id=framework_id,
            identifier=ident[:100],
            title=(item.get("title") or "Untitled")[:500],
            description=item.get("description"),
        )
        db.add(req)
        await db.flush()
        await db.refresh(req)
        existing_ids.add(ident.lower())
        created += 1
        await sync_requirement_to_neo4j(
            req.id,
            framework_id,
            req.identifier,
            req.title,
            req.description,
            req.level,
            req.family,
        )

    await db.commit()
    return {
        "ok": True,
        "extracted": len(extracted),
        "created": created,
        "skipped": skipped,
    }
