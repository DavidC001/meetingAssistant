"""Utilities for chunking transcripts and documents for embedding."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional

DEFAULT_MAX_TOKENS = 400
DEFAULT_OVERLAP = 40

try:  # Optional dependency
    import tiktoken
except ImportError:  # pragma: no cover - graceful degradation
    tiktoken = None


@dataclass
class Chunk:
    """Represents a chunk of text prepared for embedding."""

    content: str
    content_type: str
    metadata: Dict[str, Any]
    chunk_index: int


def _get_tokenizer(model_name: str = "cl100k_base"):
    if tiktoken is None:
        return None
    try:
        return tiktoken.get_encoding(model_name)
    except Exception:  # pragma: no cover - fallback path
        return None


def _count_tokens(text: str, encoding=None) -> int:
    if encoding is None:
        return max(len(text) // 4, 1)
    return len(encoding.encode(text))


def _split_text(
    text: str,
    *,
    max_tokens: int = DEFAULT_MAX_TOKENS,
    overlap: int = DEFAULT_OVERLAP,
    encoding=None,
) -> List[str]:
    if not text.strip():
        return []

    tokens_per_char = max(len(text) / max(_count_tokens(text, encoding), 1), 1)
    step_size = max_tokens - overlap
    segments: List[str] = []
    start = 0

    while start < len(text):
        approx_end = start + int(step_size * tokens_per_char)
        end = min(len(text), approx_end)
        segment = text[start:end].strip()
        if not segment:
            break
        segments.append(segment)
        if end == len(text):
            break
        start = max(0, end - int(overlap * tokens_per_char))

    return segments or [text.strip()]


def chunk_transcript(
    transcript_text: str,
    *,
    metadata: Optional[Dict[str, Any]] = None,
    max_tokens: int = DEFAULT_MAX_TOKENS,
    overlap: int = DEFAULT_OVERLAP,
) -> List[Chunk]:
    encoding = _get_tokenizer()
    segments = _split_text(
        transcript_text,
        max_tokens=max_tokens,
        overlap=overlap,
        encoding=encoding,
    )
    chunks: List[Chunk] = []
    for idx, segment in enumerate(segments):
        chunk_metadata = {"source": "transcript"}
        if metadata:
            chunk_metadata.update(metadata)
        chunks.append(
            Chunk(
                content=segment,
                content_type="transcript",
                metadata=chunk_metadata,
                chunk_index=idx,
            )
        )
    return chunks


def chunk_document(
    text: str,
    *,
    metadata: Optional[Dict[str, Any]] = None,
    max_tokens: int = DEFAULT_MAX_TOKENS,
    overlap: int = DEFAULT_OVERLAP,
) -> List[Chunk]:
    encoding = _get_tokenizer()
    segments = _split_text(
        text,
        max_tokens=max_tokens,
        overlap=overlap,
        encoding=encoding,
    )
    chunks: List[Chunk] = []
    for idx, segment in enumerate(segments):
        chunk_metadata = {"source": "document"}
        if metadata:
            chunk_metadata.update(metadata)
        chunks.append(
            Chunk(
                content=segment,
                content_type="document",
                metadata=chunk_metadata,
                chunk_index=idx,
            )
        )
    return chunks


def chunk_notes(text: str, *, metadata: Optional[Dict[str, Any]] = None) -> List[Chunk]:
    if not text:
        return []
    chunk_metadata = {"source": "notes"}
    if metadata:
        chunk_metadata.update(metadata)
    return [
        Chunk(
            content=text.strip(),
            content_type="notes",
            metadata=chunk_metadata,
            chunk_index=0,
        )
    ]


def chunk_summary(text: str, *, metadata: Optional[Dict[str, Any]] = None) -> List[Chunk]:
    if not text:
        return []
    chunk_metadata = {"source": "summary"}
    if metadata:
        chunk_metadata.update(metadata)
    return [
        Chunk(
            content=text.strip(),
            content_type="summary",
            metadata=chunk_metadata,
            chunk_index=0,
        )
    ]


def chunk_action_items(action_items: Iterable[Dict[str, Any]]) -> List[Chunk]:
    chunks: List[Chunk] = []
    for idx, item in enumerate(action_items):
        description_parts = [item.get("task") or ""]
        if owner := item.get("owner"):
            description_parts.append(f"Owner: {owner}")
        if due := item.get("due_date"):
            description_parts.append(f"Due: {due}")
        if notes := item.get("notes"):
            description_parts.append(f"Notes: {notes}")
        text = "\n".join(part for part in description_parts if part)
        if not text:
            continue
        chunk_metadata = {"source": "action_item", "action_item_id": item.get("id")}
        chunks.append(
            Chunk(
                content=text,
                content_type="action_item",
                metadata=chunk_metadata,
                chunk_index=idx,
            )
        )
    return chunks

