"""Repository helpers for storage-layer database access."""

from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy.orm import Session

from ... import models


class VectorStoreRepository:
    """Repository for document chunk CRUD and similarity queries."""

    def __init__(self, db: Session):
        self.db = db

    def delete_project_chunks_by_project_id(self, project_id: int) -> None:
        self.db.query(models.ProjectDocumentChunk).filter(models.ProjectDocumentChunk.project_id == project_id).delete()
        self.db.commit()

    def delete_project_chunks_by_note_id(self, note_id: int) -> None:
        self.db.query(models.ProjectDocumentChunk).filter(models.ProjectDocumentChunk.note_id == note_id).delete()
        self.db.commit()

    def delete_project_note_content_by_note_id(self, note_id: int) -> None:
        self.db.query(models.ProjectDocumentChunk).filter(
            models.ProjectDocumentChunk.note_id == note_id,
            models.ProjectDocumentChunk.attachment_id.is_(None),
        ).delete()
        self.db.commit()

    def delete_project_chunks_by_attachment_id(self, attachment_id: int) -> None:
        self.db.query(models.ProjectDocumentChunk).filter(
            models.ProjectDocumentChunk.attachment_id == attachment_id
        ).delete()
        self.db.commit()

    def search_project_chunks(
        self,
        query_embedding: Sequence[float],
        *,
        project_id: int | None = None,
        top_k: int = 5,
        filters: dict | None = None,
    ) -> list[tuple[models.ProjectDocumentChunk, float]]:
        similarity_filters = filters or {}
        query = self.db.query(
            models.ProjectDocumentChunk,
            (1 - models.ProjectDocumentChunk.embedding.cosine_distance(query_embedding)).label("similarity"),
        )
        if project_id is not None:
            query = query.filter(models.ProjectDocumentChunk.project_id == project_id)
        if "content_type" in similarity_filters:
            query = query.filter(models.ProjectDocumentChunk.content_type == similarity_filters["content_type"])
        if "note_id" in similarity_filters:
            query = query.filter(models.ProjectDocumentChunk.note_id == similarity_filters["note_id"])
        return (
            query.order_by(models.ProjectDocumentChunk.embedding.cosine_distance(query_embedding).asc())
            .limit(top_k)
            .all()
        )

    def delete_document_chunks_by_meeting_id(self, meeting_id: int) -> None:
        self.db.query(models.DocumentChunk).filter(models.DocumentChunk.meeting_id == meeting_id).delete()
        self.db.commit()

    def search_document_chunks(
        self,
        query_embedding: Sequence[float],
        *,
        meeting_id: int | None = None,
        top_k: int = 5,
        filters: dict | None = None,
        meeting_ids: list[int] | None = None,
    ) -> list[tuple[models.DocumentChunk, float]]:
        similarity_filters = filters or {}
        query = self.db.query(
            models.DocumentChunk,
            (1 - models.DocumentChunk.embedding.cosine_distance(query_embedding)).label("similarity"),
        )
        if meeting_id is not None:
            query = query.filter(models.DocumentChunk.meeting_id == meeting_id)
        elif meeting_ids is not None:
            query = query.filter(models.DocumentChunk.meeting_id.in_(meeting_ids))
        if "content_type" in similarity_filters:
            query = query.filter(models.DocumentChunk.content_type == similarity_filters["content_type"])
        return query.order_by(models.DocumentChunk.embedding.cosine_distance(query_embedding).asc()).limit(top_k).all()
