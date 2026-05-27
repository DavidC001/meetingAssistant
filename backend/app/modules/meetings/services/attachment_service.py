"""
Attachment service — manages uploaded file attachments for meetings.

Extracted from MeetingService to isolate file-system and async-task logic.
"""

import os
import re
import shutil
import time
from pathlib import Path

from fastapi import HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ...core.config import config
from . import models as meeting_models
from .repository import AttachmentRepository, DocumentChunkRepository


class AttachmentService:
    """Manages file attachments for meetings."""

    def __init__(self, db: Session):
        self.db = db
        self.attachment_repo = AttachmentRepository(db)
        self.chunk_repo = DocumentChunkRepository(db)

    def upload_attachment(
        self,
        meeting_id: int,
        file: UploadFile,
        description: str | None = None,
    ) -> meeting_models.Attachment:
        """Save an uploaded file as a meeting attachment and queue indexing."""
        attachments_dir = Path(config.upload.upload_dir) / "attachments"
        attachments_dir.mkdir(parents=True, exist_ok=True)

        original_filename = file.filename or "attachment"
        safe_filename = re.sub(r"[^\w\s.-]", "", original_filename)
        timestamp = str(int(time.time() * 1000))
        unique_filename = f"{meeting_id}_{timestamp}_{safe_filename}"
        file_path = attachments_dir / unique_filename

        try:
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

        file_size = os.path.getsize(file_path)
        mime_type = file.content_type or "application/octet-stream"

        attachment = self.attachment_repo.create_attachment(
            meeting_id=meeting_id,
            filename=original_filename,
            filepath=str(file_path),
            file_size=file_size,
            mime_type=mime_type,
            description=description,
        )

        from ...tasks import index_attachment

        index_attachment.delay(attachment.id)
        return attachment

    def get_attachments(self, meeting_id: int) -> list[meeting_models.Attachment]:
        """List all attachments for a meeting."""
        return self.attachment_repo.get_by_meeting(meeting_id)

    def get_attachment(self, attachment_id: int) -> meeting_models.Attachment:
        """Get a single attachment by ID."""
        attachment = self.attachment_repo.get(attachment_id)
        if not attachment:
            raise HTTPException(status_code=404, detail="Attachment not found")
        return attachment

    def serve_attachment(self, attachment_id: int, inline: bool = False) -> FileResponse:
        """Return a FileResponse for downloading/serving an attachment."""
        attachment = self.get_attachment(attachment_id)
        file_path = Path(attachment.filepath)
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="Attachment file not found on disk")

        headers = {}
        if inline:
            headers["Content-Disposition"] = f'inline; filename="{attachment.filename}"'

        return FileResponse(
            path=str(file_path),
            media_type=attachment.mime_type,
            filename=attachment.filename,
            headers=headers or None,
        )

    def update_description(self, attachment_id: int, description: str) -> meeting_models.Attachment:
        """Update an attachment's description."""
        attachment = self.attachment_repo.get(attachment_id)
        if not attachment:
            raise HTTPException(status_code=404, detail="Attachment not found")
        return self.attachment_repo.update_description(attachment_id, description)

    def delete_attachment(self, attachment_id: int) -> None:
        """Delete an attachment, its chunks, and its file on disk."""
        attachment = self.get_attachment(attachment_id)
        meeting_id = attachment.meeting_id

        file_path = Path(attachment.filepath)
        if file_path.exists():
            try:
                file_path.unlink()
            except Exception as e:
                print(f"Warning: Failed to delete attachment file: {str(e)}")

        self.chunk_repo.delete_by_attachment(attachment_id)
        self.attachment_repo.delete(id=attachment_id)

        from ...tasks import remove_attachment_embeddings

        remove_attachment_embeddings.delay(meeting_id, attachment_id)
