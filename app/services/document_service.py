"""Document processing service – Docling only for all parsing and text extraction."""

import logging
import tempfile
from pathlib import Path
from typing import BinaryIO

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
