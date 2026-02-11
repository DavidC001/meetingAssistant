"""Vector store abstraction backed by pgvector."""

from __future__ import annotations

import logging
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

from sqlalchemy.orm import Session

from ... import models

LOGGER = logging.getLogger(__name__)


@dataclass
class RetrievedChunk:
    chunk: models.DocumentChunk
    similarity: float


@dataclass
class ProjectRetrievedChunk:
    chunk: models.ProjectDocumentChunk
    similarity: float


class VectorStore:
    """Abstract interface for vector stores."""

    def add_documents(
        self,
        db: Session,
        *,
        meeting_id: int,
        chunks: Sequence[dict[str, Any]],
        embeddings: Sequence[Sequence[float]],
        embedding_config_id: int,
    ) -> list[models.DocumentChunk]:
        raise NotImplementedError

    def delete_by_meeting_id(self, db: Session, meeting_id: int) -> None:
        raise NotImplementedError

    def similarity_search(
        self,
        db: Session,
        query_embedding: Sequence[float],
        *,
        meeting_id: int | None = None,
        top_k: int = 5,
        filters: dict[str, Any] | None = None,
        meeting_ids: list[int] | None = None,
    ) -> list[RetrievedChunk]:
        raise NotImplementedError


class ProjectVectorStore:
    """Vector store for project note/document chunks."""

    def add_documents(
        self,
        db: Session,
        *,
        project_id: int,
        chunks: Sequence[dict[str, Any]],
        embeddings: Sequence[Sequence[float]],
        embedding_config_id: int,
    ) -> list[models.ProjectDocumentChunk]:
        if not chunks:
            return []
        if len(chunks) != len(embeddings):
            raise ValueError("Chunks and embeddings must have the same length.")
        records: list[models.ProjectDocumentChunk] = []
        for chunk, embedding in zip(chunks, embeddings, strict=False):
            record = models.ProjectDocumentChunk(
                project_id=project_id,
                note_id=chunk.get("note_id"),
                attachment_id=chunk.get("attachment_id"),
                content=chunk["content"],
                content_type=chunk.get("content_type", "project_note"),
                chunk_index=chunk.get("chunk_index", 0),
                chunk_metadata=chunk.get("metadata", {}),
                embedding=list(embedding),
                embedding_config_id=embedding_config_id,
            )
            records.append(record)
            db.add(record)
        db.commit()
        for record in records:
            db.refresh(record)
        return records

    def delete_by_project_id(self, db: Session, project_id: int) -> None:
        db.query(models.ProjectDocumentChunk).filter(models.ProjectDocumentChunk.project_id == project_id).delete()
        db.commit()

    def delete_by_note_id(self, db: Session, note_id: int) -> None:
        db.query(models.ProjectDocumentChunk).filter(models.ProjectDocumentChunk.note_id == note_id).delete()
        db.commit()

    def delete_note_content_by_note_id(self, db: Session, note_id: int) -> None:
        db.query(models.ProjectDocumentChunk).filter(
            models.ProjectDocumentChunk.note_id == note_id,
            models.ProjectDocumentChunk.attachment_id.is_(None),
        ).delete()
        db.commit()

    def delete_by_attachment_id(self, db: Session, attachment_id: int) -> None:
        db.query(models.ProjectDocumentChunk).filter(
            models.ProjectDocumentChunk.attachment_id == attachment_id
        ).delete()
        db.commit()

    def similarity_search(
        self,
        db: Session,
        query_embedding: Sequence[float],
        *,
        project_id: int | None = None,
        top_k: int = 5,
        filters: dict[str, Any] | None = None,
    ) -> list[ProjectRetrievedChunk]:
        if not query_embedding:
            return []
        similarity_filters = filters or {}
        query = db.query(
            models.ProjectDocumentChunk,
            (1 - models.ProjectDocumentChunk.embedding.cosine_distance(query_embedding)).label("similarity"),
        )
        if project_id is not None:
            query = query.filter(models.ProjectDocumentChunk.project_id == project_id)
        if "content_type" in similarity_filters:
            query = query.filter(models.ProjectDocumentChunk.content_type == similarity_filters["content_type"])
        if "note_id" in similarity_filters:
            query = query.filter(models.ProjectDocumentChunk.note_id == similarity_filters["note_id"])
        query = query.order_by(models.ProjectDocumentChunk.embedding.cosine_distance(query_embedding).asc()).limit(
            top_k
        )
        results = query.all()
        return [ProjectRetrievedChunk(chunk=row[0], similarity=float(row[1])) for row in results]


class PgVectorStore(VectorStore):
    """PostgreSQL vector store powered by pgvector."""

    def add_documents(
        self,
        db: Session,
        *,
        meeting_id: int,
        chunks: Sequence[dict[str, Any]],
        embeddings: Sequence[Sequence[float]],
        embedding_config_id: int,
    ) -> list[models.DocumentChunk]:
        if not chunks:
            return []
        if len(chunks) != len(embeddings):
            raise ValueError("Chunks and embeddings must have the same length.")
        records: list[models.DocumentChunk] = []
        for chunk, embedding in zip(chunks, embeddings, strict=False):
            record = models.DocumentChunk(
                meeting_id=meeting_id,
                attachment_id=chunk.get("attachment_id"),
                content=chunk["content"],
                content_type=chunk.get("content_type", "transcript"),
                chunk_index=chunk.get("chunk_index", 0),
                chunk_metadata=chunk.get("metadata", {}),
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
        meeting_id: int | None = None,
        top_k: int = 5,
        filters: dict[str, Any] | None = None,
        meeting_ids: list[int] | None = None,
    ) -> list[RetrievedChunk]:
        if not query_embedding:
            return []
        similarity_filters = filters or {}
        query = db.query(
            models.DocumentChunk,
            (1 - models.DocumentChunk.embedding.cosine_distance(query_embedding)).label("similarity"),
        )
        if meeting_id is not None:
            query = query.filter(models.DocumentChunk.meeting_id == meeting_id)
        elif meeting_ids is not None:
            # Filter by list of meeting IDs (for global chat filtering)
            query = query.filter(models.DocumentChunk.meeting_id.in_(meeting_ids))
        if "content_type" in similarity_filters:
            query = query.filter(models.DocumentChunk.content_type == similarity_filters["content_type"])
        query = query.order_by(models.DocumentChunk.embedding.cosine_distance(query_embedding).asc()).limit(top_k)
        results = query.all()
        return [RetrievedChunk(chunk=row[0], similarity=float(row[1])) for row in results]


DEFAULT_VECTOR_STORE = PgVectorStore()
DEFAULT_PROJECT_VECTOR_STORE = ProjectVectorStore()
