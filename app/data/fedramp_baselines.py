"""FedRAMP / NIST 800-53 baseline control identifiers (Low, Moderate, High)."""

import json
from pathlib import Path

_BASELINES_PATH = Path(__file__).resolve().parent / "fedramp_baselines.json"

# Cached control IDs per baseline: {"low": [...], "moderate": [...], "high": [...]}
_cached: dict[str, list[str]] | None = None


def get_baseline_control_ids(baseline: str) -> list[str]:
    """
    Return the list of NIST 800-53 control identifiers for a FedRAMP baseline.
    baseline: "low" | "moderate" | "high"
    Returns empty list if baseline unknown or file missing.
    """
    global _cached
    if _cached is None:
        try:
            with open(_BASELINES_PATH, encoding="utf-8") as f:
                _cached = json.load(f)
        except (OSError, json.JSONDecodeError):
            _cached = {}
    return _cached.get(baseline.lower(), [])
