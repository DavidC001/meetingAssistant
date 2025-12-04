"""Utilities for extracting text from uploaded documents."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

LOGGER = logging.getLogger(__name__)

try:  # Optional dependency
    import pdfplumber
except ImportError:  # pragma: no cover
    pdfplumber = None

try:  # Optional dependency
    from PyPDF2 import PdfReader
except ImportError:  # pragma: no cover
    PdfReader = None

try:  # Optional dependency
    from docx import Document as DocxDocument
except ImportError:  # pragma: no cover
    DocxDocument = None


SUPPORTED_TEXT_EXTENSIONS = {".txt", ".md", ".markdown"}


def _read_pdf(file_path: Path) -> str:
    if pdfplumber is not None:
        with pdfplumber.open(str(file_path)) as pdf:
            pages = [page.extract_text() or "" for page in pdf.pages]
        return "\n".join(pages)
    if PdfReader is not None:
        reader = PdfReader(str(file_path))
        pages = [page.extract_text() or "" for page in reader.pages]
        return "\n".join(pages)
    raise RuntimeError("PDF support requires pdfplumber or PyPDF2 to be installed.")


def _read_docx(file_path: Path) -> str:
    if DocxDocument is None:
        raise RuntimeError("python-docx is required to process DOCX files.")
    document = DocxDocument(str(file_path))
    paragraphs = [paragraph.text for paragraph in document.paragraphs]
    return "\n".join(paragraphs)


def _read_plaintext(file_path: Path, encoding: str = "utf-8") -> str:
    return file_path.read_text(encoding=encoding, errors="ignore")


def extract_text(file_path: str, mime_type: Optional[str] = None) -> str:
    """Extract plain text from a supported document type."""

    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(file_path)

    suffix = path.suffix.lower()
    if suffix == ".pdf" or (mime_type and "pdf" in mime_type):
        LOGGER.info("Extracting text from PDF attachment: %s", path.name)
        return _read_pdf(path)
    if suffix in {".docx"} or (mime_type and "word" in mime_type):
        LOGGER.info("Extracting text from DOCX attachment: %s", path.name)
        return _read_docx(path)
    if suffix in SUPPORTED_TEXT_EXTENSIONS or (mime_type and mime_type.startswith("text/")):
        LOGGER.info("Extracting text from plain text attachment: %s", path.name)
        return _read_plaintext(path)

    LOGGER.warning("Unsupported document format for text extraction: %s", path)
    return ""

