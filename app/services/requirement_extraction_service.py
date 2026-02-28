"""Extract compliance requirements from framework documents.

Uses framework-specific extractors (ISO vs NIST) with structure-aware parsing
first, then LLM fallback. ISO supports scope: annex_a_only (38 controls for 42001)
or full (clauses 4–10 + Annex A). NIST extracts control IDs (AC-1, AU-2(1)).
"""

import json
import logging
import re

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import Requirement
from app.services.graph_sync import sync_requirement_to_neo4j
from app.services.llm_service import llm_chat
from app.services.qdrant_service import get_chunks_for_framework

logger = logging.getLogger(__name__)

# Use structure-only when we get several matches (avoids slow LLM fallback)
MIN_STRUCTURE_ITEMS = 3
EXTRACTION_CHUNK_SIZE = 24_000
EXTRACTION_CHAR_LIMIT = 80_000
EXTRACTION_NIST_CHAR_LIMIT = 400_000
EXTRACTION_LLM_CHAR_LIMIT = 48_000

# ISO/IEC 42001:2023 Annex A — 38 controls (from Table A.1)
ISO_42001_ANNEX_A_CONTROLS = frozenset([
    "A.2.2", "A.2.3", "A.2.4",
    "A.3.2", "A.3.3",
    "A.4.2", "A.4.3", "A.4.4", "A.4.5", "A.4.6",
    "A.5.2", "A.5.3", "A.5.4", "A.5.5",
    "A.6.1.2", "A.6.1.3",
    "A.6.2.2", "A.6.2.3", "A.6.2.4", "A.6.2.5",
    "A.6.2.6", "A.6.2.7", "A.6.2.8",
    "A.7.2", "A.7.3", "A.7.4", "A.7.5", "A.7.6",
    "A.8.2", "A.8.3", "A.8.4", "A.8.5",
    "A.9.2", "A.9.3", "A.9.4",
    "A.10.2", "A.10.3", "A.10.4",
])

# Default titles for controls missed by structure extraction (chunk boundaries, hyphenation)
ISO_42001_DEFAULT_TITLES: dict[str, str] = {
    "A.2.2": "AI policy",
    "A.2.3": "Alignment with other organizational policies",
    "A.2.4": "Review of the AI policy",
    "A.3.2": "AI roles and responsibilities",
    "A.3.3": "Reporting of concerns",
    "A.4.2": "Resource documentation",
    "A.4.3": "Data resources",
    "A.4.4": "Tooling resources",
    "A.4.5": "System and computing resources",
    "A.4.6": "Human resources",
    "A.5.2": "AI system impact assessment process",
    "A.5.3": "Documentation of AI system impact assessments",
    "A.5.4": "Assessing AI system impact on individuals or groups",
    "A.5.5": "Assessing societal impacts of AI systems",
    "A.6.1.2": "Objectives for responsible development of AI system",
    "A.6.1.3": "Processes for responsible AI system design and development",
    "A.6.2.2": "AI system requirements and specification",
    "A.6.2.3": "Documentation of AI system design and development",
    "A.6.2.4": "AI system verification and validation",
    "A.6.2.5": "AI system deployment",
    "A.6.2.6": "AI system operation and monitoring",
    "A.6.2.7": "AI system technical documentation",
    "A.6.2.8": "AI system recording of event logs",
    "A.7.2": "Data for development and enhancement of AI system",
    "A.7.3": "Acquisition of data",
    "A.7.4": "Quality of data for AI systems",
    "A.7.5": "Data provenance",
    "A.7.6": "Data preparation",
    "A.8.2": "System documentation and information for users",
    "A.8.3": "External reporting",
    "A.8.4": "Communication of incidents",
    "A.8.5": "Information for interested parties",
    "A.9.2": "Processes for responsible use of AI systems",
    "A.9.3": "Objectives for responsible use of AI system",
    "A.9.4": "Intended use of the AI system",
    "A.10.2": "Allocating responsibilities",
    "A.10.3": "Suppliers",
    "A.10.4": "Customers",
}

# Regex patterns
_ISO_CLAUSE_RE = re.compile(r"^\s*(\d+(?:\.\d+)+)\s+(.+?)$", re.MULTILINE)
# Line-start only (for "A.2.2  Title" at beginning of line)
_ISO_ANNEX_A_RE = re.compile(r"^\s*(A\.\d+(?:\.\d+)*)\s+(.+?)$", re.MULTILINE)
# Inline: finds A.X.Y anywhere (e.g. inside markdown table cells)
_ISO_ANNEX_A_INLINE_RE = re.compile(
    r"(?:^|[\s|])(A\.\d+(?:\.\d+)*)\s+([^\n|]+?)(?=\s+A\.\d|\s+##|$)",
    re.MULTILINE | re.DOTALL,
)
_NIST_CONTROL_RE = re.compile(r"^\s*([A-Z]{2,4}-\d+(?:\(\d+\))?)\s+(.+)$", re.MULTILINE)
_NIST_CONTROL_INLINE_RE = re.compile(
    r"(?:^|[\s|])([A-Z]{2,4}-\d+(?:\(\d+\))?)\s+([^\n|]+?)(?=\s+[A-Z]{2,4}-\d|\s+##|$)",
    re.MULTILINE | re.DOTALL,
)


def _normalize_nist_text(text: str) -> str:
    """Normalize NIST control IDs from PDF text (dash variants, line breaks)."""
    if not text:
        return ""
    normalized = (
        text.replace("\u2013", "-")
        .replace("\u2014", "-")
        .replace("\u2212", "-")
        .replace("\u00ad", "")
    )
    # Normalize spaced or line-broken IDs: "AC - 1" or "AC-\n1" -> "AC-1"
    normalized = re.sub(
        r"([A-Z]{2,4})\s*-\s*\n?\s*(\d+(?:\(\d+\))?)",
        r"\1-\2",
        normalized,
    )
    # Normalize dash variants with optional spaces: "AC – 1" -> "AC-1"
    normalized = re.sub(
        r"([A-Z]{2,4})\s*[-–—]\s*(\d+(?:\(\d+\))?)",
        r"\1-\2",
        normalized,
    )
    return normalized

EXTRACT_SYSTEM_ISO = """You are an expert at extracting compliance requirements from ISO standards.

Given document text, extract ONLY Annex A controls (identifiers starting with A., e.g. A.2.2, A.6.2.3).
Do NOT extract main body clauses (4, 5, 6, 7, 8, 9, 10).

Output one requirement per line in this exact format:
identifier | title | description

Examples:
A.2.2 | AI policy | The organization shall document a policy...
A.6.2.3 | Documentation of AI system design | The organization shall document...

Use the pipe character | as separator. No JSON. No headers. One line per requirement."""

EXTRACT_SYSTEM_ISO_FULL = """You are an expert at extracting compliance requirements from ISO standards.

Given document text, extract distinct requirements: main body clauses (4.x, 5.x, 6.x, 7.x, 8.x, 9.x, 10.x) AND Annex A controls (A.x.x).

Output one requirement per line in this exact format:
identifier | title | description

Examples:
4.2.1 | Context of the organization | The organization shall determine...
A.2.2 | AI policy | The organization shall document a policy...

Use the pipe character | as separator. No JSON. No headers. One line per requirement."""

EXTRACT_SYSTEM_NIST = """You are an expert at extracting compliance requirements from NIST standards.

Given document text, extract control IDs (e.g. AC-1, AU-2, AC-2(1)) with titles and descriptions.

Output one requirement per line in this exact format:
identifier | title | description

Examples:
AC-1 | Access Control Policy | The organization develops...
AU-2 | Auditable Events | The organization determines...

Use the pipe character | as separator. No JSON. No headers. One line per requirement."""


# ---------- Shared utilities ----------


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


def _parse_llm_response(content: str) -> list[dict]:
    """Parse LLM response: pipe format first, then JSON fallbacks."""
    if not content or not content.strip():
        return []
    content = content.strip()
    pipe_result = _parse_pipe_format(content)
    if pipe_result:
        return pipe_result
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
    """Split at paragraph boundaries."""
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


def _parse_table_rows(text: str, iso_only: bool, nist_only: bool) -> list[dict]:
    """Extract from pipe/tab-separated table rows."""
    result: list[dict] = []
    seen: set[str] = set()
    for line in text.splitlines():
        line = line.strip()
        if not line or len(line) < 5 or re.match(r"^[\s\|-]+$", line):
            continue
        parts = re.split(r"\t|\|", line)
        parts = [p.strip() for p in parts if p.strip()]
        if len(parts) < 2:
            continue
        ident = parts[0]
        is_iso = bool(re.match(r"^(\d+(?:\.\d+)+|A\.\d+(?:\.\d+)*)$", ident))
        is_nist = bool(re.match(r"^[A-Z]{2,4}-\d+(?:\(\d+\))?$", ident))
        if iso_only and not is_iso:
            continue
        if nist_only and not is_nist:
            continue
        if not is_iso and not is_nist and not re.match(r"^Article\s+\d+$", ident, re.I):
            continue
        key = ident.lower()
        if key not in seen:
            seen.add(key)
            result.append({
                "identifier": ident,
                "title": parts[1] if len(parts) > 1 else "Untitled",
                "description": parts[2] if len(parts) > 2 else None,
            })
    return result


# ---------- ISO extractor ----------


def _is_annex_a_control(ident: str, use_42001_canonical: bool) -> bool:
    """Check if identifier is a valid Annex A control."""
    if not ident.upper().startswith("A."):
        return False
    if use_42001_canonical:
        return ident in ISO_42001_ANNEX_A_CONTROLS
    return bool(re.match(r"^A\.\d+(\.\d+)*$", ident))


def _extract_iso(
    text: str,
    extraction_scope: str = "annex_a_only",
    use_42001_canonical: bool = False,
) -> list[dict]:
    """
    Extract ISO requirements using structure (Annex A regex, tables) only.
    When annex_a_only: filter to Annex A controls; use 42001 canonical list if applicable.
    When full: include main body clauses (4–10) and Annex A.
    """
    if not text or not text.strip():
        return []
    seen: set[str] = set()
    result: list[dict] = []

    annex_a_only = extraction_scope == "annex_a_only"

    # 1. Table rows (pipe/tab)
    for item in _parse_table_rows(text, iso_only=True, nist_only=False):
        ident = item["identifier"]
        if annex_a_only:
            if not _is_annex_a_control(ident, use_42001_canonical):
                continue
        else:
            if ident.upper().startswith("B.") or ident.upper().startswith("C."):
                continue  # Skip Annex B/C implementation guidance
        key = ident.lower()
        if key not in seen:
            seen.add(key)
            result.append(item)

    # 2a. Annex A at line start: "A.2.2  Title"
    for m in _ISO_ANNEX_A_RE.finditer(text):
        ident, rest = m.group(1), m.group(2).strip()
        if annex_a_only and not _is_annex_a_control(ident, use_42001_canonical):
            continue
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

    # 2b. Annex A inline (inside table cells, e.g. "| A.2.2  AI policy  The org...")
    for m in _ISO_ANNEX_A_INLINE_RE.finditer(text):
        ident, rest = m.group(1), m.group(2).strip()
        if annex_a_only and not _is_annex_a_control(ident, use_42001_canonical):
            continue
        key = ident.lower()
        if key not in seen and len(ident) <= 20:
            seen.add(key)
            # Title: first phrase (until " The organization" or first 60 chars)
            rest_clean = re.sub(r"\s+", " ", rest)
            for sep in (" The organization", " The AI ", " The organization's"):
                if sep in rest_clean:
                    title = rest_clean.split(sep)[0].strip()[:200]
                    break
            else:
                title = rest_clean[:60].strip() or "Untitled"
            if not title:
                title = "Untitled"
            result.append({
                "identifier": ident,
                "title": title[:200],
                "description": rest_clean[:2000] if len(rest_clean) > 50 else None,
            })

    # 3. Main body clauses only when full
    if not annex_a_only:
        for m in _ISO_CLAUSE_RE.finditer(text):
            ident, rest = m.group(1), m.group(2).strip()
            if ident.startswith("A.") or ident.startswith("B.") or ident.startswith("C."):
                continue
            try:
                first_num = int(ident.split(".")[0])
                if first_num < 4 or first_num > 10:
                    continue
            except (ValueError, IndexError):
                continue
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

    # 4. Fallback: for ISO 42001 annex_a_only, inject any missing canonical controls
    if annex_a_only and use_42001_canonical:
        found_ids = {r["identifier"] for r in result}
        for ident in sorted(ISO_42001_ANNEX_A_CONTROLS):
            if ident not in found_ids:
                title = ISO_42001_DEFAULT_TITLES.get(ident, ident.replace(".", " "))
                result.append({
                    "identifier": ident,
                    "title": title,
                    "description": None,
                })

    result.sort(key=lambda x: (x["identifier"],))
    return result


# ---------- NIST extractor ----------


def _extract_nist(text: str) -> list[dict]:
    """Extract NIST controls using structure (control ID regex, tables)."""
    if not text or not text.strip():
        return []
    text = _normalize_nist_text(text)
    seen: set[str] = set()
    result: list[dict] = []

    # 1. Table rows
    for item in _parse_table_rows(text, iso_only=False, nist_only=True):
        key = item["identifier"].lower()
        if key not in seen:
            seen.add(key)
            result.append(item)

    # 2. Control at line start
    for m in _NIST_CONTROL_RE.finditer(text):
        ident, rest = m.group(1), m.group(2).strip()
        key = ident.lower()
        if key not in seen:
            seen.add(key)
            title = rest.split("\n")[0].strip()[:200] if rest else "Untitled"
            desc = rest[len(title):].strip()[:2000] if len(rest) > len(title) + 5 else None
            result.append({"identifier": ident, "title": title or "Untitled", "description": desc})

    # 3. Inline controls (e.g. inside table cells)
    for m in _NIST_CONTROL_INLINE_RE.finditer(text):
        ident, rest = m.group(1), m.group(2).strip()
        key = ident.lower()
        if key not in seen:
            seen.add(key)
            rest_clean = re.sub(r"\s+", " ", rest)
            title = rest_clean[:120].strip() or "Untitled"
            result.append(
                {
                    "identifier": ident,
                    "title": title,
                    "description": rest_clean[:2000] if len(rest_clean) > 60 else None,
                }
            )

    result.sort(key=lambda x: (x["identifier"],))
    return result


# ---------- LLM fallback ----------


async def _extract_from_chunk_llm(
    chunk_text: str,
    model: str,
    framework_type: str,
    extraction_scope: str = "annex_a_only",
) -> list[dict]:
    """Single LLM call for one chunk."""
    fw = framework_type.upper()
    if "ISO" in fw:
        system = EXTRACT_SYSTEM_ISO if extraction_scope == "annex_a_only" else EXTRACT_SYSTEM_ISO_FULL
    else:
        system = EXTRACT_SYSTEM_NIST
    hint = "ISO Annex A only. " if ("ISO" in fw and extraction_scope == "annex_a_only") else ""
    hint += "Extract from this section:"
    prompt = f"{hint}\n\n{chunk_text}"
    reply, _ = await llm_chat(message=prompt, model=model, system=system)
    if not reply or not reply.strip():
        return []
    return _parse_llm_response(reply)


# ---------- Public API ----------


async def extract_requirements_from_text(
    text: str,
    model: str | None = None,
    framework_type: str | None = None,
    extraction_scope: str = "annex_a_only",
    framework_slug: str | None = None,
) -> tuple[list[dict], str | None]:
    """
    Extract requirements using framework-specific logic.
    - ISO: annex_a_only (38 controls for 42001) or full (clauses 4–10 + Annex A)
    - NIST: control IDs (AC-1, AU-2, etc.)
    """
    if not text or len(text.strip()) < 100:
        return [], "Document text too short"

    fw_type = (framework_type or "").upper()
    is_iso = "ISO" in fw_type
    is_nist = "NIST" in fw_type
    use_42001_canonical = "42001" in (framework_slug or "")

    # Structure-based extraction
    if is_iso:
        items = _extract_iso(
            text,
            extraction_scope=extraction_scope,
            use_42001_canonical=use_42001_canonical,
        )
    elif is_nist:
        items = _extract_nist(text)
    else:
        items = _extract_iso(text, extraction_scope="full")
        if len(items) < MIN_STRUCTURE_ITEMS:
            items = _extract_nist(text)
        if len(items) < MIN_STRUCTURE_ITEMS:
            items = _parse_table_rows(text, iso_only=False, nist_only=False)

    if len(items) >= MIN_STRUCTURE_ITEMS:
        logger.info(
            "Extraction: %s structure-based, found %d items",
            "ISO" if is_iso else "NIST" if is_nist else "generic",
            len(items),
        )
        return items, None

    # LLM fallback
    effective_model = model or settings.ollama_model
    llm_text = text[:EXTRACTION_LLM_CHAR_LIMIT] + "\n\n[Document truncated...]" if len(text) > EXTRACTION_LLM_CHAR_LIMIT else text
    chunks = _split_at_structure(llm_text)
    if not chunks:
        return items if items else [], "No requirements found."

    seen = {(i.get("identifier") or "").lower() for i in items if i.get("identifier")}
    merged = list(items)

    for i, chunk in enumerate(chunks):
        try:
            extracted = await _extract_from_chunk_llm(
                chunk, effective_model, fw_type or "ISO", extraction_scope
            )
            for item in extracted:
                ident = (item.get("identifier") or "").strip().lower()
                if ident and ident not in seen:
                    seen.add(ident)
                    if is_iso and extraction_scope == "annex_a_only":
                        if not _is_annex_a_control(
                            item.get("identifier") or "", use_42001_canonical
                        ):
                            continue
                    merged.append(item)
        except Exception as e:
            logger.warning("LLM extraction chunk %d failed: %s", i + 1, e)

    if not merged:
        return [], (
            "No requirements extracted. Ensure the document contains "
            "structured content (ISO Annex A or NIST controls)."
        )
    merged.sort(key=lambda x: (x.get("identifier") or ""))
    return merged, None


async def extract_and_save_requirements(
    db: AsyncSession,
    framework_id: int,
    model: str | None = None,
    extraction_scope: str | None = None,
) -> dict:
    """
    Get document text from Qdrant, extract requirements (ISO or NIST),
    save to DB, sync to Neo4j.
    """
    from app.models import Framework

    result = await db.execute(select(Framework).where(Framework.id == framework_id))
    framework = result.scalar_one_or_none()
    if not framework:
        return {"ok": False, "extracted": 0, "created": 0, "skipped": 0, "error": "Framework not found"}

    fw_type = (framework.framework_type or "").upper()
    max_chars = EXTRACTION_CHAR_LIMIT
    if "NIST" in fw_type:
        max_chars = EXTRACTION_NIST_CHAR_LIMIT
    text = get_chunks_for_framework(
        settings.qdrant_collection,
        framework_id,
        max_chars=max_chars,
    )
    if not text or len(text.strip()) < 100:
        return {
            "ok": False,
            "extracted": 0,
            "created": 0,
            "skipped": 0,
            "error": "No document content found. Upload a document first.",
        }

    scope = extraction_scope or ("annex_a_only" if "ISO" in fw_type else "full")

    extracted, extract_error = await extract_requirements_from_text(
        text,
        model=model,
        framework_type=framework.framework_type,
        extraction_scope=scope,
        framework_slug=framework.slug,
    )
    if not extracted:
        return {
            "ok": False,
            "extracted": 0,
            "created": 0,
            "skipped": 0,
            "error": extract_error or "No requirements extracted.",
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
