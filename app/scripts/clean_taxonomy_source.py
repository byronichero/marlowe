"""Generate a clean taxonomy source file from Docling markdown."""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Any

STAGE_NAME_MAP: dict[str, str] = {
    "plan and design": "Plan and Design",
    "collect and process data": "Collect and Process Data",
    "build and use model": "Build and Use Model",
    "verify and validate": "Verify and Validate",
    "deploy and use": "Deploy and Use",
    "operate and monitor": "Operate and Monitor",
    "use or impacted by": "Use or Impacted By",
}

STOP_MARKERS = (
    "## appendix",
    "properties of trustworthiness without segmentation",
)


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
    stripped = line.strip().strip("|").strip()
    if not stripped:
        return True
    return all(ch in "-: " for ch in stripped)


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


def _should_stop(line: str) -> bool:
    lower = line.strip().lower()
    return any(marker in lower for marker in STOP_MARKERS)


def _parse_markdown(path: Path) -> list[dict[str, Any]]:
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    stage: str | None = None
    characteristic: str | None = None
    items: list[dict[str, Any]] = []
    saw_stage = False

    for line in lines:
        if _should_break(line, saw_stage, len(items)):
            break
        stage, characteristic, saw_stage = _update_stage_state(
            line, stage, characteristic, saw_stage
        )
        if stage is None:
            continue
        row = _parse_table_row(line)
        if row is None:
            continue
        item, characteristic = _build_item(stage, characteristic, row)
        if item:
            items.append(item)

    return items


def _update_stage_state(
    line: str, stage: str | None, characteristic: str | None, saw_stage: bool
) -> tuple[str | None, str | None, bool]:
    raw_stage = _extract_stage_heading(line)
    if not raw_stage:
        return stage, characteristic, saw_stage
    canonical = _normalize_stage(raw_stage)
    if canonical is None:
        return None, None, saw_stage
    return canonical, None, True


def _is_appendix_table_header(line: str) -> bool:
    if not line.lstrip().startswith("|"):
        return False
    lower = line.lower()
    if "question(s) to consider" not in lower:
        return False
    return "relevant nist ai rmf subcategories" not in lower


def _should_break(line: str, saw_stage: bool, items_count: int) -> bool:
    if not saw_stage:
        return False
    if items_count >= 150:
        return True
    if _should_stop(line):
        return True
    if _is_appendix_table_header(line):
        return True
    return False


def _build_item(
    stage: str, characteristic: str | None, row: list[str]
) -> tuple[dict[str, Any] | None, str | None]:
    if "NIST Characteristics of Trustworthiness" in row[0]:
        return None, characteristic
    row_characteristic, prop_name, question, subcats = row
    if row_characteristic:
        characteristic = row_characteristic
    if not characteristic or not prop_name:
        return None, characteristic
    if prop_name.lower().startswith("properties of trustworthiness"):
        return None, characteristic
    return (
        {
            "stage": stage,
            "characteristic": characteristic.strip(),
            "property": prop_name.strip(),
            "questions": question.strip(),
            "subcategories": subcats.strip(),
        },
        characteristic,
    )


def _write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["stage", "characteristic", "property", "questions", "subcategories"],
        )
        writer.writeheader()
        writer.writerows(rows)


def _write_json(path: Path, rows: list[dict[str, Any]]) -> None:
    path.write_text(json.dumps(rows, indent=2, ensure_ascii=False), encoding="utf-8")


def main() -> int:
    """Extract a clean taxonomy source file from Docling markdown."""
    parser = argparse.ArgumentParser(description="Clean taxonomy markdown into CSV/JSON")
    parser.add_argument(
        "--input",
        default="/app/docs/taxonomy-ai.md",
        help="Path to Docling markdown (default: /app/docs/taxonomy-ai.md)",
    )
    parser.add_argument(
        "--output-json",
        default="/app/docs/taxonomy-ai-clean.json",
        help="Output JSON path (default: /app/docs/taxonomy-ai-clean.json)",
    )
    parser.add_argument(
        "--output-csv",
        default="/app/docs/taxonomy-ai-clean.csv",
        help="Output CSV path (default: /app/docs/taxonomy-ai-clean.csv)",
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    rows = _parse_markdown(input_path)
    _write_json(Path(args.output_json), rows)
    _write_csv(Path(args.output_csv), rows)

    print(f"Wrote {len(rows)} rows to {args.output_json} and {args.output_csv}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
