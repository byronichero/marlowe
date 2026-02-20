"""Document processing service – Docling for parsing, preview (HTML), and Markdown export."""

import csv
import logging
import tempfile
from pathlib import Path
from typing import BinaryIO

import markdown
from docling.backend.pypdfium2_backend import PyPdfiumDocumentBackend
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.document_converter import DocumentConverter, PdfFormatOption

logger = logging.getLogger(__name__)

# Use PyPdfium2 for PDFs to avoid RT-DETRv2 layout model (requires Transformers 4.55+).
# PyPdfium2 extracts text from the PDF's embedded text layer; no layout/OCR model needed.
_PDF_PIPELINE = PdfPipelineOptions()
_PDF_PIPELINE.do_ocr = False
_PDF_PIPELINE.do_table_structure = False


def _get_converter() -> DocumentConverter:
    """Return DocumentConverter with PyPdfium2 for PDFs (avoids Transformers layout model)."""
    return DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(
                pipeline_options=_PDF_PIPELINE,
                backend=PyPdfiumDocumentBackend,
            )
        }
    )


def extract_text_from_file(
    file_path: str | Path | None = None,
    file_obj: BinaryIO | None = None,
    filename_hint: str | None = None,
) -> str:
    """
    Extract text from a document using Docling only.
    PDFs use PyPdfium2 (embedded text layer); DOCX, PPTX, XLSX, HTML, images use defaults.
    Returns Markdown or plain text for indexing and AI context.
    """
    if file_path is None and file_obj is None:
        raise ValueError("Provide either file_path or file_obj")
    converter = _get_converter()
    if file_path is not None:
        result = converter.convert(str(file_path))
    else:
        suffix = Path(filename_hint).suffix if filename_hint else ".bin"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(file_obj.read())
            tmp.flush()
            try:
                result = converter.convert(tmp.name)
            finally:
                Path(tmp.name).unlink(missing_ok=True)
    return result.document.export_to_markdown()


# Extensions supported for preview and MD export (Docling + CSV + text)
DOCLING_EXTENSIONS = {".pdf", ".docx", ".pptx", ".xlsx", ".html", ".htm"}
TEXT_EXTENSIONS = {".md", ".markdown", ".txt"}
CSV_EXTENSIONS = {".csv"}
PREVIEW_EXTENSIONS = DOCLING_EXTENSIONS | TEXT_EXTENSIONS | CSV_EXTENSIONS


def _csv_to_markdown(file_path: Path) -> str:
    """Convert CSV to Markdown table."""
    rows: list[list[str]] = []
    with open(file_path, newline="", encoding="utf-8", errors="replace") as f:
        reader = csv.reader(f)
        for row in reader:
            rows.append(row)
    if not rows:
        return ""
    # Header row, separator, data rows
    lines: list[str] = []
    lines.append("| " + " | ".join(str(c) for c in rows[0]) + " |")
    lines.append("| " + " | ".join("---" for _ in rows[0]) + " |")
    for row in rows[1:]:
        lines.append("| " + " | ".join(str(c) for c in row) + " |")
    return "\n".join(lines)


def _text_to_markdown(file_path: Path) -> str:
    """Read plain text as Markdown (code block for raw)."""
    text = file_path.read_text(encoding="utf-8", errors="replace")
    # If looks like code/logs, wrap in code block
    if any(c in text[:500] for c in ["{", "}", "import ", "def ", "<?php"]):
        return f"```\n{text}\n```"
    return text


def document_to_markdown(file_path: Path) -> str:
    """
    Convert a document to Markdown.
    Docling for PDF/DOCX/PPTX/XLSX/HTML; CSV to table; TXT/MD as text.
    """
    ext = file_path.suffix.lower()
    if ext in CSV_EXTENSIONS:
        return _csv_to_markdown(file_path)
    if ext in TEXT_EXTENSIONS:
        return _text_to_markdown(file_path)
    if ext in DOCLING_EXTENSIONS:
        return extract_text_from_file(file_path=file_path)
    return ""


def document_to_html(file_path: Path) -> str:
    """Convert document to HTML for preview. Uses Markdown as intermediate."""
    md = document_to_markdown(file_path)
    if not md.strip():
        return "<p class='text-muted-foreground'>No content extracted.</p>"
    html_body = markdown.markdown(md, extensions=["tables", "fenced_code", "nl2br"])
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{{font-family:system-ui,sans-serif;max-width:800px;margin:1rem auto;padding:0 1rem;line-height:1.6;}}
table{{border-collapse:collapse;width:100%;}} th,td{{border:1px solid #ddd;padding:.5rem;text-align:left;}}
th{{background:#f5f5f5;}} pre{{background:#f5f5f5;padding:1rem;overflow-x:auto;}}</style>
</head><body>{html_body}</body></html>"""
