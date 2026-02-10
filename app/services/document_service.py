"""Document processing service – Docling only for all parsing and text extraction."""

import logging
import tempfile
from pathlib import Path
from typing import BinaryIO

from docling.document_converter import DocumentConverter

logger = logging.getLogger(__name__)


def extract_text_from_file(
    file_path: str | Path | None = None,
    file_obj: BinaryIO | None = None,
    filename_hint: str | None = None,
) -> str:
    """
    Extract text from a document using Docling only.
    Supports PDF, DOCX, PPTX, XLSX, HTML, images, etc. per Docling supported formats.
    Returns Markdown or plain text for indexing and AI context.
    """
    if file_path is None and file_obj is None:
        raise ValueError("Provide either file_path or file_obj")
    converter = DocumentConverter()
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
