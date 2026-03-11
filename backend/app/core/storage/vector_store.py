"""Vector store abstraction backed by pgvector."""

from __future__ import annotations

import logging
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

from sqlalchemy.orm import Session

from ... import models
from .repository import VectorStoreRepository

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

    @staticmethod
    def _repository(db: Session) -> VectorStoreRepository:
        return VectorStoreRepository(db)

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
        self._repository(db).delete_project_chunks_by_project_id(project_id)

    def delete_by_note_id(self, db: Session, note_id: int) -> None:
        self._repository(db).delete_project_chunks_by_note_id(note_id)

    def delete_note_content_by_note_id(self, db: Session, note_id: int) -> None:
        self._repository(db).delete_project_note_content_by_note_id(note_id)

    def delete_by_attachment_id(self, db: Session, attachment_id: int) -> None:
        self._repository(db).delete_project_chunks_by_attachment_id(attachment_id)

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
        results = self._repository(db).search_project_chunks(
            query_embedding,
            project_id=project_id,
            top_k=top_k,
            filters=filters,
        )
        return [ProjectRetrievedChunk(chunk=row[0], similarity=float(row[1])) for row in results]


class PgVectorStore(VectorStore):
    """PostgreSQL vector store powered by pgvector."""

    @staticmethod
    def _repository(db: Session) -> VectorStoreRepository:
        return VectorStoreRepository(db)

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
        self._repository(db).delete_document_chunks_by_meeting_id(meeting_id)

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
        results = self._repository(db).search_document_chunks(
            query_embedding,
            meeting_id=meeting_id,
            top_k=top_k,
            filters=filters,
            meeting_ids=meeting_ids,
        )
        return [RetrievedChunk(chunk=row[0], similarity=float(row[1])) for row in results]


DEFAULT_VECTOR_STORE = PgVectorStore()
DEFAULT_PROJECT_VECTOR_STORE = ProjectVectorStore()
