"""Vector store abstraction backed by pgvector."""

from __future__ import annotations

import logging
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from ... import models
from .embeddings import ensure_active_embedding_configuration
from .repository import VectorStoreRepository

LOGGER = logging.getLogger(__name__)

# (table, index_name) pairs for every chunk table with a pgvector embedding column.
_HNSW_INDEXES = (
    ("document_chunks", "ix_document_chunks_embedding_hnsw"),
    ("project_document_chunks", "ix_project_document_chunks_embedding_hnsw"),
)


def rebuild_embedding_indexes(db: Session) -> dict[str, Any]:
    """Pin the chunk tables' embedding columns to the active dimension and (re)build an
    HNSW cosine index.

    The embedding columns are declared as a dimensionless ``vector()`` so the app can
    support switching to a differently-sized embedding model, but pgvector can't build
    an ANN index on a dimensionless column — every similarity search is a full
    sequential scan until this runs. Call this ONLY after every chunk has been
    re-embedded at the same dimension (see recompute_all_embeddings /
    rebuild_vector_indexes in app/tasks.py, which chains this as a chord callback so it
    runs once the fan-out of per-meeting embedding jobs is fully done) — Postgres
    validates every existing row against the new declared dimension during ALTER
    COLUMN, so mixed dimensions make this fail.
    """
    db_config = ensure_active_embedding_configuration(db)
    dimension = db_config.dimension
    if not dimension:
        LOGGER.warning("Active embedding configuration has no dimension recorded; skipping index rebuild")
        return {"status": "skipped", "reason": "no_dimension"}
    dimension = int(dimension)

    for table, index_name in _HNSW_INDEXES:
        try:
            db.execute(text(f"DROP INDEX IF EXISTS {index_name}"))
            db.execute(text(f"ALTER TABLE {table} ALTER COLUMN embedding TYPE vector({dimension})"))
            db.execute(text(f"CREATE INDEX {index_name} ON {table} USING hnsw (embedding vector_cosine_ops)"))
            db.commit()
            LOGGER.info(f"Rebuilt HNSW index {index_name} on {table} for dimension {dimension}")
        except Exception as e:
            db.rollback()
            LOGGER.error(f"Failed to rebuild index {index_name} on {table}: {e}", exc_info=True)
            return {"status": "error", "table": table, "error": str(e)}

    return {"status": "completed", "dimension": dimension}


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
