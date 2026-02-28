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

DEFAULT_STAGE = "Plan and Design"
TAXONOMY_HEADER_KEY = "properties of trustworthiness"

def _extract_stage_heading(line: str) -> str | None:
    stripped = line.strip()
    for prefix in ("## AI LIFECYCLE STAGE:", "## AI Lifecycle Stage:", "AI LIFECYCLE STAGE:", "AI Lifecycle Stage:"):
        if stripped.startswith(prefix):
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


def _parse_markdown(path: Path) -> list[dict[str, Any]]:
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    stage: str | None = None
    characteristic: str | None = None
    items: list[dict[str, Any]] = []
    saw_stage = False

    for line in lines:
        if _should_break(saw_stage, len(items)):
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


def _parse_docling_json(path: Path) -> list[dict[str, Any]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    texts = data.get("texts", [])
    tables = data.get("tables", [])
    body = data.get("body", {}) or {}
    children = body.get("children", []) or []

    return _extract_items_from_body(children, texts, tables)


def _parse_taxonomy_csvs(docs_dir: Path, stage_sequence: list[str]) -> list[dict[str, Any]]:
    files = _load_taxonomy_csvs(docs_dir)
    items: list[dict[str, Any]] = []
    stage_idx = 0
    characteristic: str | None = None
    current_stage: str | None = None

    for path, rows in files:
        stage = stage_sequence[stage_idx] if stage_idx < len(stage_sequence) else DEFAULT_STAGE
        stage_idx += 1
        if stage != current_stage:
            characteristic = None
            current_stage = stage

        for row in rows:
            item, characteristic = _build_item(
                stage,
                characteristic,
                [row[0], row[1], row[2], row[3]],
            )
            if item:
                items.append(item)
            if len(items) >= 150:
                return items

    return items


def _load_taxonomy_csvs(docs_dir: Path) -> list[tuple[Path, list[list[str]]]]:
    files = sorted(
        [
            p
            for p in docs_dir.glob("table-*.csv")
            if "(1)" not in p.name and p.is_file()
        ],
        key=_csv_sort_key,
    )
    result: list[tuple[Path, list[list[str]]]] = []
    for path in files:
        rows = _read_csv_rows(path)
        if rows:
            result.append((path, rows))
    return result


def _read_csv_rows(path: Path) -> list[list[str]]:
    with path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.reader(f)
        rows = list(reader)
    if not rows:
        return []
    header = [cell.strip() for cell in rows[0]]
    if not _is_csv_taxonomy_header(header):
        return []
    return [row for row in rows[1:] if len(row) >= 4]


def _csv_sort_key(path: Path) -> tuple[int, str]:
    digits = "".join(ch for ch in path.stem.split("-")[-1] if ch.isdigit())
    return (int(digits) if digits else 0, path.name)


def _is_csv_taxonomy_header(header: list[str]) -> bool:
    header_text = " ".join(h.lower() for h in header)
    return (
        "nist characteristics of trustworthiness" in header_text
        and TAXONOMY_HEADER_KEY in header_text
        and "question(s) to consider" in header_text
        and "relevant nist ai rmf subcategories" in header_text
    )


def _build_stage_sequence_from_json(path: Path) -> list[str]:
    data = json.loads(path.read_text(encoding="utf-8"))
    texts = data.get("texts", [])
    tables = data.get("tables", [])
    body = data.get("body", {}) or {}
    children = body.get("children", []) or []

    return _extract_stage_sequence(children, texts, tables)


def _extract_stage_sequence(
    children: list[dict[str, Any]],
    texts: list[dict[str, Any]],
    tables: list[dict[str, Any]],
) -> list[str]:
    stage: str | None = None
    sequence: list[str] = []

    for child in children:
        ref = child.get("$ref") if isinstance(child, dict) else None
        if not ref or not isinstance(ref, str):
            continue
        stage = _update_stage_from_ref(ref, texts, stage)
        _append_stage_from_ref(ref, tables, stage, sequence)
    return sequence


def _update_stage_from_ref(
    ref: str,
    texts: list[dict[str, Any]],
    stage: str | None,
) -> str | None:
    if not ref.startswith("#/texts/"):
        return stage
    text = _resolve_text_ref(ref, texts)
    raw_stage = _extract_stage_heading(text)
    return _normalize_stage(raw_stage) if raw_stage else stage


def _append_stage_from_ref(
    ref: str,
    tables: list[dict[str, Any]],
    stage: str | None,
    sequence: list[str],
) -> None:
    if not ref.startswith("#/tables/"):
        return
    table = _resolve_table_ref(ref, tables)
    if not table:
        return
    rows = _table_to_rows(table)
    if _is_taxonomy_header(rows):
        sequence.append(stage or DEFAULT_STAGE)


def _extract_items_from_body(
    children: list[dict[str, Any]],
    texts: list[dict[str, Any]],
    tables: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    stage: str | None = None
    characteristic: str | None = None
    items: list[dict[str, Any]] = []

    for child in children:
        ref = child.get("$ref") if isinstance(child, dict) else None
        if not ref or not isinstance(ref, str):
            continue
        stage, characteristic = _handle_body_ref(
            ref,
            texts,
            tables,
            stage,
            characteristic,
            items,
        )
        if len(items) >= 150:
            break

    return items


def _handle_body_ref(
    ref: str,
    texts: list[dict[str, Any]],
    tables: list[dict[str, Any]],
    stage: str | None,
    characteristic: str | None,
    items: list[dict[str, Any]],
) -> tuple[str | None, str | None]:
    if ref.startswith("#/texts/"):
        text = _resolve_text_ref(ref, texts)
        raw_stage = _extract_stage_heading(text)
        if raw_stage:
            stage = _normalize_stage(raw_stage)
            characteristic = None
        return stage, characteristic

    if ref.startswith("#/tables/"):
        table = _resolve_table_ref(ref, tables)
        if table:
            if stage is None and _is_taxonomy_header(_table_to_rows(table)):
                stage = DEFAULT_STAGE
                characteristic = None
            if stage:
                characteristic = _append_table_items(stage, characteristic, table, items)
    return stage, characteristic


def _append_table_items(
    stage: str,
    characteristic: str | None,
    table: dict[str, Any],
    items: list[dict[str, Any]],
) -> str | None:
    rows = _table_to_rows(table)
    if not _is_taxonomy_header(rows):
        return characteristic
    for row in rows[1:]:
        item, characteristic = _build_item(stage, characteristic, row)
        if item:
            items.append(item)
        if len(items) >= 150:
            break
    return characteristic


def _resolve_text_ref(ref: str, texts: list[dict[str, Any]]) -> str:
    try:
        idx = int(ref.split("/")[-1])
        return str(texts[idx].get("text", "") or "")
    except (ValueError, IndexError, AttributeError):
        return ""


def _resolve_table_ref(ref: str, tables: list[dict[str, Any]]) -> dict[str, Any] | None:
    try:
        idx = int(ref.split("/")[-1])
        return tables[idx]
    except (ValueError, IndexError):
        return None


def _table_to_rows(table: dict[str, Any]) -> list[list[str]]:
    data = table.get("data", {}) or {}
    cells = data.get("table_cells", []) or []
    rows: dict[int, dict[int, str]] = {}
    max_row = 0
    max_col = 0
    for cell in cells:
        try:
            row_idx = int(cell.get("start_row_offset_idx", 0))
            col_idx = int(cell.get("start_col_offset_idx", 0))
        except (TypeError, ValueError):
            continue
        text = str(cell.get("text", "") or "").strip()
        rows.setdefault(row_idx, {})[col_idx] = text
        max_row = max(max_row, row_idx)
        max_col = max(max_col, col_idx)

    table_rows: list[list[str]] = []
    for row_idx in range(0, max_row + 1):
        row_cells = rows.get(row_idx, {})
        row = [row_cells.get(col_idx, "") for col_idx in range(0, max_col + 1)]
        table_rows.append(row)
    return table_rows


def _is_taxonomy_header(rows: list[list[str]]) -> bool:
    if not rows:
        return False
    header = [cell.lower() for cell in rows[0]]
    header_text = " ".join(header)
    return (
        "nist characteristics of trustworthiness" in header_text
        and TAXONOMY_HEADER_KEY in header_text
        and "relevant nist ai rmf subcategories" in header_text
    )


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


def _should_break(saw_stage: bool, items_count: int) -> bool:
    if not saw_stage:
        return False
    if items_count >= 150:
        return True
    return False


def _build_item(
    stage: str, characteristic: str | None, row: list[str]
) -> tuple[dict[str, Any] | None, str | None]:
    if "NIST Characteristics of Trustworthiness" in row[0]:
        return None, characteristic
    row_characteristic, prop_name, question, subcats = row
    if row_characteristic and _is_noise_value(row_characteristic):
        return None, characteristic
    if _is_noise_value(prop_name):
        return None, characteristic
    if row_characteristic:
        characteristic = row_characteristic
    if not characteristic or not prop_name:
        return None, characteristic
    if prop_name.lower().startswith("properties of trustworthiness"):
        return None, characteristic
    if _is_noise_value(question):
        question = ""
    if _is_noise_value(subcats):
        subcats = ""
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


def _is_noise_value(value: str) -> bool:
    stripped = value.strip()
    if not stripped:
        return True
    return all(ch == "-" for ch in stripped)


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
        "--input-json",
        default="/app/docs/taxanomy.json",
        help="Path to Docling JSON (default: /app/docs/taxanomy.json)",
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

    json_path = Path(args.input_json)
    docs_dir = json_path.parent
    csv_files = list(docs_dir.glob("table-*.csv"))
    if csv_files:
        stage_sequence = _build_stage_sequence_from_json(json_path) if json_path.exists() else []
        rows = _parse_taxonomy_csvs(docs_dir, stage_sequence)
    elif json_path.exists():
        rows = _parse_docling_json(json_path)
    else:
        input_path = Path(args.input)
        rows = _parse_markdown(input_path)
    _write_json(Path(args.output_json), rows)
    _write_csv(Path(args.output_csv), rows)

    print(f"Wrote {len(rows)} rows to {args.output_json} and {args.output_csv}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
