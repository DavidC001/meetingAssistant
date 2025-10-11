"""Vector store abstraction backed by pgvector."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Sequence

from sqlalchemy.orm import Session

from .. import models

LOGGER = logging.getLogger(__name__)


@dataclass
class RetrievedChunk:
    chunk: models.DocumentChunk
    similarity: float


class VectorStore:
    """Abstract interface for vector stores."""

    def add_documents(
        self,
        db: Session,
        *,
        meeting_id: int,
        chunks: Sequence[Dict[str, Any]],
        embeddings: Sequence[Sequence[float]],
        embedding_config_id: int,
    ) -> List[models.DocumentChunk]:
        raise NotImplementedError

    def delete_by_meeting_id(self, db: Session, meeting_id: int) -> None:
        raise NotImplementedError

    def similarity_search(
        self,
        db: Session,
        query_embedding: Sequence[float],
        *,
        meeting_id: Optional[int] = None,
        top_k: int = 5,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[RetrievedChunk]:
        raise NotImplementedError


class PgVectorStore(VectorStore):
    """PostgreSQL vector store powered by pgvector."""

    def add_documents(
        self,
        db: Session,
        *,
        meeting_id: int,
        chunks: Sequence[Dict[str, Any]],
        embeddings: Sequence[Sequence[float]],
        embedding_config_id: int,
    ) -> List[models.DocumentChunk]:
        if not chunks:
            return []
        if len(chunks) != len(embeddings):
            raise ValueError("Chunks and embeddings must have the same length.")
        records: List[models.DocumentChunk] = []
        for chunk, embedding in zip(chunks, embeddings):
            record = models.DocumentChunk(
                meeting_id=meeting_id,
                attachment_id=chunk.get("attachment_id"),
                content=chunk["content"],
                content_type=chunk.get("content_type", "transcript"),
                chunk_index=chunk.get("chunk_index", 0),
                metadata=chunk.get("metadata", {}),
                embedding=list(embedding),
                embedding_config_id=embedding_config_id,
            )
            records.append(record)
            db.add(record)
        db.commit()
        for record in records:
            db.refresh(record)
        return records

    def delete_by_meeting_id(self, db: Session, meeting_id: int) -> None:
        db.query(models.DocumentChunk).filter(models.DocumentChunk.meeting_id == meeting_id).delete()
        db.commit()

    def similarity_search(
        self,
        db: Session,
        query_embedding: Sequence[float],
        *,
        meeting_id: Optional[int] = None,
        top_k: int = 5,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[RetrievedChunk]:
        if not query_embedding:
            return []
        similarity_filters = filters or {}
        query = db.query(
            models.DocumentChunk,
            (1 - models.DocumentChunk.embedding.cosine_distance(query_embedding)).label("similarity"),
        )
        if meeting_id is not None:
            query = query.filter(models.DocumentChunk.meeting_id == meeting_id)
        if "content_type" in similarity_filters:
            query = query.filter(models.DocumentChunk.content_type == similarity_filters["content_type"])
        query = query.order_by(models.DocumentChunk.embedding.cosine_distance(query_embedding).asc()).limit(top_k)
        results = query.all()
        return [RetrievedChunk(chunk=row[0], similarity=float(row[1])) for row in results]


DEFAULT_VECTOR_STORE = PgVectorStore()

