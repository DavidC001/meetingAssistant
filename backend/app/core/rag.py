"""Utility helpers for retrieval-augmented conversations across meetings."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Sequence

import numpy as np
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from .. import models
from .embeddings import generate_embedding

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


def has_vector_support(db: Session) -> bool:
    """Return True when the current database connection can run vector searches."""

    bind = db.get_bind()
    return bool(bind and bind.dialect.name.startswith("postgresql"))


def index_meeting_embeddings(db: Session, meeting: Any) -> int:
    """Generate and persist embeddings for a meeting's content."""

    if not has_vector_support(db):
        return 0

    meeting_id = getattr(meeting, "id", None)
    if not meeting_id:
        return 0

    documents = build_meeting_documents([meeting])
    if not documents:
        try:
            db.query(models.MeetingEmbedding).filter(models.MeetingEmbedding.meeting_id == meeting_id).delete(
                synchronize_session=False
            )
            db.commit()
        except Exception as exc:  # pragma: no cover - database failure
            db.rollback()
            logger.error("Failed to clear embeddings for meeting %s: %s", meeting_id, exc, exc_info=True)
        return 0

    entries: List[models.MeetingEmbedding] = []

    for doc in documents:
        embedding = generate_embedding(doc.content)
        if embedding is None:
            continue
        metadata = doc.metadata
        entries.append(
            models.MeetingEmbedding(
                meeting_id=meeting_id,
                chunk_type=metadata.get("type", "context"),
                chunk_index=metadata.get("chunk_index"),
                content=doc.content,
                embedding=embedding,
            )
        )

    if not entries:
        logger.warning(
            "No embeddings generated for meeting %s; existing vectors will remain unchanged.",
            meeting_id,
        )
        return 0

    try:
        db.query(models.MeetingEmbedding).filter(models.MeetingEmbedding.meeting_id == meeting_id).delete(
            synchronize_session=False
        )
        if entries:
            db.bulk_save_objects(entries)
        db.commit()
    except Exception as exc:  # pragma: no cover - database failure
        db.rollback()
        logger.error("Failed to index embeddings for meeting %s: %s", meeting_id, exc, exc_info=True)
        return 0

    return len(entries)


def ensure_embeddings_for_meetings(db: Session, meetings: Sequence[Any]) -> None:
    """Ensure each meeting in the sequence has stored embeddings."""

    if not has_vector_support(db):
        return

    meeting_map = {
        getattr(meeting, "id", None): meeting for meeting in meetings if getattr(meeting, "id", None)
    }
    if not meeting_map:
        return

    existing_ids = {
        meeting_id
        for meeting_id, _count in db.query(models.MeetingEmbedding.meeting_id, func.count(models.MeetingEmbedding.id))
        .filter(models.MeetingEmbedding.meeting_id.in_(meeting_map.keys()))
        .group_by(models.MeetingEmbedding.meeting_id)
        .all()
    }

    for meeting_id, meeting in meeting_map.items():
        if meeting_id not in existing_ids:
            index_meeting_embeddings(db, meeting)


def _vector_similarity_search(
    db: Session,
    query: str,
    meeting_ids: Optional[List[int]],
    top_k: int,
) -> Optional[List[Dict[str, Any]]]:
    """Search stored embeddings using cosine distance if available."""

    if not query or not has_vector_support(db):
        return None

    query_embedding = generate_embedding(query)
    if query_embedding is None:
        return None

    top_k = max(1, top_k)
    distance_column = models.MeetingEmbedding.embedding.cosine_distance(query_embedding).label("distance")

    stmt = (
        select(models.MeetingEmbedding, distance_column)
        .options(joinedload(models.MeetingEmbedding.meeting))
        .order_by(distance_column)
        .limit(top_k)
    )
    if meeting_ids:
        stmt = stmt.where(models.MeetingEmbedding.meeting_id.in_(meeting_ids))

    try:
        rows = db.execute(stmt).all()
    except Exception as exc:  # pragma: no cover - database failure
        logger.error("Vector similarity search failed: %s", exc, exc_info=True)
        return None

    results: List[Dict[str, Any]] = []
    for embedding_obj, distance in rows:
        distance_value = float(distance)
        similarity = max(0.0, 1.0 - distance_value)
        metadata = {
            "meeting_id": embedding_obj.meeting_id,
            "meeting_filename": getattr(embedding_obj.meeting, "filename", "Unknown meeting"),
            "type": embedding_obj.chunk_type,
            "chunk_index": embedding_obj.chunk_index,
        }
        results.append({"content": embedding_obj.content, "metadata": metadata, "score": similarity})

    return results


def select_relevant_documents(
    query: str,
    documents: List[Document],
    top_k: int = 5,
) -> List[Dict[str, Any]]:
    """Return the most relevant documents for the given query using TF-IDF."""

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


def retrieve_relevant_documents(
    db: Session,
    query: str,
    meetings: Sequence[Any],
    top_k: int = 5,
    meeting_ids: Optional[List[int]] = None,
) -> List[Dict[str, Any]]:
    """Return relevant meeting snippets, preferring stored vectors when available."""

    top_k = max(1, top_k)
    meeting_filter = None
    if meeting_ids:
        meeting_filter = [mid for mid in meeting_ids if mid is not None]
    elif meetings:
        meeting_filter = [getattr(meeting, "id", None) for meeting in meetings if getattr(meeting, "id", None)]

    vector_results = _vector_similarity_search(db, query, meeting_filter, top_k)
    if vector_results:
        return vector_results

    documents = build_meeting_documents(meetings)
    return select_relevant_documents(query, documents, top_k=top_k)
