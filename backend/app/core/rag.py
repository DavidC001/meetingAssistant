"""Utility helpers for retrieval-augmented conversations across meetings."""

import logging
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger(__name__)


@dataclass
class Document:
    """Container for pieces of meeting context."""

    content: str
    metadata: Dict[str, Any]


def chunk_text(text: str, chunk_size: int = 220, overlap: int = 40) -> List[str]:
    """Split text into overlapping word-based chunks."""

    if not text:
        return []

    words = text.split()
    if not words:
        return []

    chunk_size = max(chunk_size, 1)
    overlap = max(0, min(overlap, chunk_size - 1))

    chunks: List[str] = []
    step = chunk_size - overlap if chunk_size > overlap else chunk_size

    for start in range(0, len(words), step):
        chunk_words = words[start : start + chunk_size]
        chunk = " ".join(chunk_words).strip()
        if chunk:
            chunks.append(chunk)

    return chunks


def format_action_items(action_items: Iterable[Any]) -> Optional[str]:
    """Create a readable representation of action items."""

    formatted_items: List[str] = []
    for item in action_items or []:
        task = getattr(item, "task", "").strip()
        if not task:
            continue
        owner = getattr(item, "owner", None)
        due_date = getattr(item, "due_date", None)
        metadata_parts = []
        if owner:
            metadata_parts.append(f"Owner: {owner}")
        if due_date:
            metadata_parts.append(f"Due: {due_date}")
        suffix = f" ({'; '.join(metadata_parts)})" if metadata_parts else ""
        formatted_items.append(f"- {task}{suffix}")

    if not formatted_items:
        return None

    return "Action Items:\n" + "\n".join(formatted_items)


def build_meeting_documents(meetings: Iterable[Any]) -> List[Document]:
    """Create document chunks from meetings, summaries, and action items."""

    documents: List[Document] = []

    for meeting in meetings:
        metadata_base = {
            "meeting_id": getattr(meeting, "id", None),
            "meeting_filename": getattr(meeting, "filename", "Unknown meeting"),
        }

        transcription = getattr(meeting, "transcription", None)
        if not transcription:
            continue

        summary = getattr(transcription, "summary", None)
        if summary:
            documents.append(
                Document(
                    content=summary.strip(),
                    metadata={**metadata_base, "type": "summary"},
                )
            )

        action_items_text = format_action_items(getattr(transcription, "action_items", []))
        if action_items_text:
            documents.append(
                Document(
                    content=action_items_text,
                    metadata={**metadata_base, "type": "action_items"},
                )
            )

        full_text = getattr(transcription, "full_text", None)
        if full_text:
            for idx, chunk in enumerate(chunk_text(full_text)):
                documents.append(
                    Document(
                        content=chunk,
                        metadata={
                            **metadata_base,
                            "type": "transcript_chunk",
                            "chunk_index": idx + 1,
                        },
                    )
                )

    return documents


def select_relevant_documents(
    query: str,
    documents: List[Document],
    top_k: int = 5,
) -> List[Dict[str, Any]]:
    """Return the most relevant documents for the given query."""

    if not query or not documents:
        return []

    contents = [doc.content for doc in documents]
    try:
        vectorizer = TfidfVectorizer(stop_words="english", max_features=6000)
        doc_matrix = vectorizer.fit_transform(contents)
        query_vector = vectorizer.transform([query])
    except ValueError as exc:  # Typically empty vocabulary
        logger.warning("RAG vectorization failed: %s", exc)
        return []

    similarities = cosine_similarity(doc_matrix, query_vector).flatten()
    if similarities.size == 0:
        return []

    top_k = max(1, top_k)
    sorted_indices = np.argsort(similarities)[::-1]

    selected: List[Dict[str, Any]] = []
    for idx in sorted_indices[:top_k]:
        score = float(similarities[idx])
        if score <= 0 and selected:
            break
        selected.append(
            {
                "content": contents[idx],
                "metadata": documents[idx].metadata,
                "score": score,
            }
        )

    if not selected and sorted_indices.size > 0:
        idx = int(sorted_indices[0])
        selected.append(
            {
                "content": contents[idx],
                "metadata": documents[idx].metadata,
                "score": float(similarities[idx]),
            }
        )

    return selected
