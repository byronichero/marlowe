"""
Seed synthetic maturity scores for the NIST AI RMF Taxonomy assessment.

This script calls the Marlowe API to:
1) Find the taxonomy framework.
2) Create an assessment if needed.
3) Initialize requirement assessments.
4) Patch a subset of rows with random status/maturity/notes.

Usage:
    python scripts/synth_taxonomy.py
    python scripts/synth_taxonomy.py --limit 60 --seed 7

Notes:
    - Requires the backend to be running.
    - Requires the taxonomy framework to be loaded.
"""

from __future__ import annotations

import argparse
import json
import random
import urllib.error
import urllib.request
from typing import Any

DEFAULT_BASE_URL = "http://localhost:5010/api/v1"
TAXONOMY_SLUG = "nist-ai-rmf-trustworthiness-taxonomy"
STATUS_OPTIONS = ["pending", "in_progress", "complete", "not_applicable"]


def _request_json(method: str, url: str, payload: dict[str, Any] | None = None) -> Any:
    """Send a JSON request and return decoded JSON."""
    data = None
    headers = {"Content-Type": "application/json"}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request) as response:
            body = response.read().decode("utf-8")
            return json.loads(body) if body else None
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8")
        raise RuntimeError(f"{method} {url} failed: {exc.code} {detail}") from exc


def _find_taxonomy_framework(base_url: str) -> dict[str, Any] | None:
    """Find the taxonomy framework record."""
    frameworks = _request_json("GET", f"{base_url}/frameworks")
    if not isinstance(frameworks, list):
        return None
    for item in frameworks:
        slug = str(item.get("slug", "")).lower()
        name = str(item.get("name", "")).lower()
        if slug == TAXONOMY_SLUG or "trustworthiness taxonomy" in name:
            return item
    return None


def _ensure_assessment(base_url: str, framework_id: int) -> dict[str, Any]:
    """Get or create the taxonomy assessment."""
    assessments = _request_json("GET", f"{base_url}/assessments?framework_id={framework_id}")
    if isinstance(assessments, list) and assessments:
        return assessments[0]
    payload = {
        "title": "NIST AI RMF Taxonomy Entry Table",
        "status": "in_progress",
        "framework_id": framework_id,
    }
    return _request_json("POST", f"{base_url}/assessments", payload)


def _init_requirements(base_url: str, assessment_id: int) -> None:
    """Initialize requirement assessment rows."""
    _request_json("POST", f"{base_url}/assessments/{assessment_id}/requirements/init")


def _list_requirements(base_url: str, assessment_id: int) -> list[dict[str, Any]]:
    """List requirement assessment items for the taxonomy assessment."""
    items = _request_json("GET", f"{base_url}/assessments/{assessment_id}/requirements")
    if not isinstance(items, list):
        return []
    return items


def _patch_requirement(
    base_url: str,
    assessment_id: int,
    requirement_id: int,
    payload: dict[str, Any],
) -> None:
    """Patch a single requirement assessment row."""
    _request_json(
        "PATCH",
        f"{base_url}/assessments/{assessment_id}/requirements/{requirement_id}",
        payload,
    )


def main() -> int:
    """Run the synthetic taxonomy seeder."""
    parser = argparse.ArgumentParser(description="Seed synthetic taxonomy maturity scores.")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--limit", type=int, default=60)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    random.seed(args.seed)
    framework = _find_taxonomy_framework(args.base_url)
    if not framework:
        print("Taxonomy framework not found. Load it first from the UI.")
        return 1

    assessment = _ensure_assessment(args.base_url, int(framework["id"]))
    assessment_id = int(assessment["id"])
    _init_requirements(args.base_url, assessment_id)

    items = _list_requirements(args.base_url, assessment_id)
    if not items:
        print("No taxonomy requirements found to update.")
        return 1

    sample = items[: args.limit] if args.limit > 0 else items
    for item in sample:
        requirement_id = int(item["requirement_id"])
        maturity_score = random.randint(0, 5)
        status = random.choice(STATUS_OPTIONS)
        notes = f"Synthetic sample score {maturity_score}."
        _patch_requirement(
            args.base_url,
            assessment_id,
            requirement_id,
            {
                "status": status,
                "maturity_score": maturity_score,
                "notes": notes,
            },
        )

    print(
        "Synthetic taxonomy scores applied:",
        f"assessment_id={assessment_id}, updated={len(sample)}",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
