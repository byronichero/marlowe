"""Parse NIST SP 800-53 OSCAL catalog and extract controls for seeding."""

import json
import logging
import re
from typing import Any

import httpx

logger = logging.getLogger(__name__)

NIST_80053_CATALOG_URL = (
    "https://raw.githubusercontent.com/usnistgov/oscal-content/main/"
    "nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_catalog-min.json"
)


def _oscal_id_to_identifier(oscal_id: str) -> str:
    """
    Convert OSCAL control ID to display format.
    ac-1 -> AC-1, ac-2.1 -> AC-2(1), ac-2.13 -> AC-2(13)
    """
    if not oscal_id or "." not in oscal_id:
        # Base control: ac-1 -> AC-1
        parts = oscal_id.split("-", 1)
        if len(parts) == 2:
            family, num = parts
            return f"{family.upper()}-{num}"
        return oscal_id.upper() if oscal_id else ""
    # Enhancement: ac-2.1 -> AC-2(1)
    base, enh = oscal_id.rsplit(".", 1)
    ident = _oscal_id_to_identifier(base)
    # AC-2 -> AC-2(1)
    return f"{ident}({enh})"


def _extract_statement_prose(part: dict[str, Any]) -> str:
    """Recursively extract prose from OSCAL control part (statement)."""
    prose = part.get("prose", "") or ""
    sub_parts = part.get("parts", [])
    if sub_parts:
        sub_texts = [_extract_statement_prose(p) for p in sub_parts]
        if prose:
            return prose + "\n\n" + "\n\n".join(sub_texts)
        return "\n\n".join(sub_texts)
    return prose


def _get_statement_text(control: dict[str, Any]) -> str | None:
    """Get the main statement text from a control's parts."""
    parts = control.get("parts") or []
    for part in parts:
        if part.get("name") == "statement":
            text = _extract_statement_prose(part).strip()
            # Replace param placeholders with readable text
            text = re.sub(r"\{\{\s*insert:\s*param,\s*[^}]+\}\}", "[organization-defined]", text)
            return text[:5000] if text else None
    return None


def _extract_family_label(group: dict[str, Any]) -> str:
    """Extract family code (e.g. AC) from group props."""
    props = group.get("props") or []
    for p in props:
        if p.get("name") == "label":
            return (p.get("value") or "").upper()
    # Fallback: first 2 chars of id (ac -> AC)
    gid = group.get("id") or ""
    return gid.upper()[:2] if gid else ""


def _parse_control(
    control: dict[str, Any],
    family: str,
    parent_identifier: str | None = None,
) -> dict[str, Any]:
    """Parse single OSCAL control to our requirement format."""
    oscal_id = control.get("id") or ""
    identifier = _oscal_id_to_identifier(oscal_id)
    title = (control.get("title") or "Untitled").strip()
    description = _get_statement_text(control)
    return {
        "oscal_id": oscal_id,
        "identifier": identifier,
        "title": title[:500],
        "description": description[:10000] if description else None,
        "family": family,
        "parent_identifier": parent_identifier,
    }


def _parse_controls_recursive(
    controls: list[dict[str, Any]],
    family: str,
    parent_identifier: str | None = None,
    result: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    """Recursively parse controls and enhancements."""
    if result is None:
        result = []
    for ctrl in controls:
        parsed = _parse_control(ctrl, family, parent_identifier)
        result.append(parsed)
        sub_controls = ctrl.get("controls") or []
        if sub_controls:
            _parse_controls_recursive(
                sub_controls, family, parsed["identifier"], result
            )
    return result


def parse_oscal_catalog(data: dict[str, Any]) -> list[dict[str, Any]]:
    """
    Parse OSCAL catalog JSON and return flat list of controls.
    Each item: {identifier, title, description, family, parent_identifier}
    """
    result: list[dict[str, Any]] = []
    catalog = data.get("catalog") or data
    groups = catalog.get("groups") or []
    for group in groups:
        family = _extract_family_label(group)
        controls = group.get("controls") or []
        _parse_controls_recursive(controls, family, None, result)
    return result


def fetch_oscal_catalog() -> dict[str, Any]:
    """Fetch NIST 800-53 Rev 5 OSCAL catalog from GitHub."""
    with httpx.Client(timeout=60.0) as client:
        resp = client.get(NIST_80053_CATALOG_URL)
        resp.raise_for_status()
        return resp.json()


def load_and_parse_catalog(url: str | None = None) -> list[dict[str, Any]]:
    """
    Fetch (or load from path) and parse OSCAL catalog.
    If url is None, fetches from default NIST GitHub URL.
    """
    if url and url.startswith("http"):
        with httpx.Client(timeout=60.0) as client:
            resp = client.get(url)
            resp.raise_for_status()
            data = resp.json()
    elif url:
        with open(url, encoding="utf-8") as f:
            data = json.load(f)
    else:
        data = fetch_oscal_catalog()
    return parse_oscal_catalog(data)
