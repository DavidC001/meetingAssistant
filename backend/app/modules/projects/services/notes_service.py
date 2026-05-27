"""
Project notes service — manages notes and their file attachments.

Extracted from ProjectService to keep the main service focused on project lifecycle.
"""

import os
import re
import shutil
import time
from pathlib import Path

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from ...core.config import get_app_config
from . import schemas


class ProjectNotesService:
    """Handles project notes and note attachment operations."""

    def __init__(self, db: Session, note_repository, attachment_repository):
        self.db = db
        self.config = get_app_config()
        self.note_repository = note_repository
        self.attachment_repository = attachment_repository

    # -- Notes ----------------------------------------------------------- #

    def list_notes(self, project_id: int) -> list[schemas.ProjectNote]:
        notes = self.note_repository.list_by_project(project_id)
        return [schemas.ProjectNote.model_validate(note) for note in notes]

    def get_note(self, project_id: int, note_id: int):
        note = self.note_repository.get(note_id)
        if not note or note.project_id != project_id:
            raise HTTPException(status_code=404, detail="Note not found")
        return note

    def create_note(self, project_id: int, note: schemas.ProjectNoteCreate) -> schemas.ProjectNote:
        new_note = self.note_repository.create(project_id, note.model_dump())
        try:
            from ...tasks import index_project_note
            index_project_note.delay(new_note.id)
        except Exception:
            pass
        return schemas.ProjectNote.model_validate(new_note)

    def update_note(
        self, project_id: int, note_id: int, update: schemas.ProjectNoteUpdate
    ) -> schemas.ProjectNote:
        note = self.get_note(project_id, note_id)
        updated_note = self.note_repository.update(note, update.model_dump(exclude_unset=True))
        try:
            from ...tasks import index_project_note
            index_project_note.delay(updated_note.id)
        except Exception:
            pass
        return schemas.ProjectNote.model_validate(updated_note)

    def delete_note(self, project_id: int, note_id: int) -> None:
        note = self.get_note(project_id, note_id)
        self.note_repository.delete(note)
        try:
            from ...tasks import remove_project_note_embeddings
            remove_project_note_embeddings.delay(note_id)
        except Exception:
            pass

    # -- Attachments ----------------------------------------------------- #

    def list_attachments(self, project_id: int, note_id: int) -> list[schemas.ProjectNoteAttachment]:
        self.get_note(project_id, note_id)
        attachments = self.attachment_repository.list_by_note(note_id)
        return [schemas.ProjectNoteAttachment.model_validate(a) for a in attachments]

    def get_attachment(self, attachment_id: int):
        attachment = self.attachment_repository.get(attachment_id)
        if not attachment:
            raise HTTPException(status_code=404, detail="Attachment not found")
        return attachment

    async def upload_attachment(
        self,
        project_id: int,
        note_id: int,
        file: UploadFile,
        description: str | None = None,
    ) -> schemas.ProjectNoteAttachment:
        self.get_note(project_id, note_id)
        attachments_dir = Path(self.config.upload.upload_dir) / "project_notes" / str(project_id)
        attachments_dir.mkdir(parents=True, exist_ok=True)

        original_filename = file.filename or "attachment"
        safe_filename = re.sub(r"[^\w\s.-]", "", original_filename)
        timestamp = str(int(time.time() * 1000))
        unique_filename = f"{project_id}_{note_id}_{timestamp}_{safe_filename}"
        file_path = attachments_dir / unique_filename

        try:
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Failed to save file: {str(exc)}")

        attachment = self.attachment_repository.create(
            project_id,
            note_id,
            {
                "filename": original_filename,
                "filepath": str(file_path),
                "file_size": os.path.getsize(file_path),
                "mime_type": file.content_type or "application/octet-stream",
                "description": description,
            },
        )

        try:
            from ...tasks import index_project_note_attachment
            index_project_note_attachment.delay(attachment.id)
        except Exception:
            pass

        return schemas.ProjectNoteAttachment.model_validate(attachment)

    def update_attachment_description(
        self, attachment_id: int, description: str
    ) -> schemas.ProjectNoteAttachment:
        attachment = self.get_attachment(attachment_id)
        updated = self.attachment_repository.update(attachment, {"description": description})
        return schemas.ProjectNoteAttachment.model_validate(updated)

    def delete_attachment(self, attachment_id: int) -> None:
        attachment = self.get_attachment(attachment_id)
        try:
            file_path = Path(attachment.filepath)
            if file_path.exists():
                file_path.unlink(missing_ok=True)
        except Exception:
            pass
        self.attachment_repository.delete(attachment)
        try:
            from ...tasks import remove_project_attachment_embeddings
            remove_project_attachment_embeddings.delay(attachment_id)
        except Exception:
            pass
