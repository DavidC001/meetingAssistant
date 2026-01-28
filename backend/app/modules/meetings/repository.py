"""
Repository classes for the meetings module.

Provides domain-specific repositories that extend BaseRepository
with meeting-specific operations.

Usage:
    from app.modules.meetings.repository import MeetingRepository, ActionItemRepository

    meeting_repo = MeetingRepository(db)
    meeting = meeting_repo.get_by_id(1)
    meetings = meeting_repo.get_by_status(MeetingStatus.COMPLETED)
"""

from datetime import datetime
from typing import Any

from sqlalchemy import asc, or_
from sqlalchemy.orm import Session

from app.core.base import BaseRepository, NotFoundError

from . import models, schemas

# =============================================================================
# Custom Exceptions
# =============================================================================


class MeetingNotFoundError(NotFoundError):
    """Raised when a meeting is not found."""

    def __init__(self, meeting_id: Any):
        super().__init__("Meeting", meeting_id)


class AttachmentNotFoundError(NotFoundError):
    """Raised when an attachment is not found."""

    def __init__(self, attachment_id: Any):
        super().__init__("Attachment", attachment_id)


class ActionItemNotFoundError(NotFoundError):
    """Raised when an action item is not found."""

    def __init__(self, item_id: Any):
        super().__init__("ActionItem", item_id)


# =============================================================================
# Meeting Repository
# =============================================================================


class MeetingRepository(BaseRepository[models.Meeting, schemas.MeetingCreate, schemas.MeetingUpdate]):
    """
    Repository for Meeting operations.

    Extends BaseRepository with meeting-specific functionality.
    """

    def __init__(self, db: Session):
        super().__init__(models.Meeting, db)

    def get_by_id(self, meeting_id: int) -> models.Meeting | None:
        """Get meeting by ID."""
        return self.get(meeting_id)

    def get_by_id_or_raise(self, meeting_id: int) -> models.Meeting:
        """Get meeting by ID or raise MeetingNotFoundError."""
        meeting = self.get(meeting_id)
        if not meeting:
            raise MeetingNotFoundError(meeting_id)
        return meeting

    def get_by_status(self, status: models.MeetingStatus, skip: int = 0, limit: int = 100) -> list[models.Meeting]:
        """Get meetings by status."""
        return self.get_multi(skip=skip, limit=limit, filters={"status": status.value})

    def get_completed_meetings(self, skip: int = 0, limit: int = 100) -> list[models.Meeting]:
        """Get all completed meetings."""
        return self.get_by_status(models.MeetingStatus.COMPLETED, skip, limit)

    def get_by_folder(self, folder: str, skip: int = 0, limit: int = 100) -> list[models.Meeting]:
        """Get meetings in a specific folder."""
        return self.get_multi(skip=skip, limit=limit, filters={"folder": folder})

    def get_by_filters(self, folder: str | None = None, tags: str | None = None) -> list[int]:
        """
        Get meeting IDs matching folder and/or tag filters.

        Args:
            folder: Filter by folder name
            tags: Comma-separated list of tags to filter by

        Returns:
            List of matching meeting IDs
        """
        query = self.db.query(models.Meeting.id).filter(models.Meeting.status == models.MeetingStatus.COMPLETED.value)

        if folder:
            query = query.filter(models.Meeting.folder == folder)

        if tags:
            tag_list = [t.strip() for t in tags.split(",") if t.strip()]
            if tag_list:
                tag_conditions = [models.Meeting.tags.like(f"%{tag}%") for tag in tag_list]
                query = query.filter(or_(*tag_conditions))

        return [row[0] for row in query.all()]

    def create_meeting(
        self,
        meeting_data: schemas.MeetingCreate,
        file_path: str,
        file_size: int | None = None,
        celery_task_id: str | None = None,
    ) -> models.Meeting:
        """
        Create a new meeting.

        Args:
            meeting_data: Meeting creation data
            file_path: Path to the uploaded file
            file_size: Size of the file in bytes
            celery_task_id: ID of the Celery processing task
        """
        db_meeting = models.Meeting(
            filename=meeting_data.filename,
            filepath=file_path,
            status=models.MeetingStatus.PENDING.value,
            transcription_language=meeting_data.transcription_language or "en-US",
            number_of_speakers=meeting_data.number_of_speakers or "auto",
            model_configuration_id=meeting_data.model_configuration_id,
            file_size=file_size,
            celery_task_id=celery_task_id,
            meeting_date=meeting_data.meeting_date,
        )
        self.db.add(db_meeting)
        self.db.commit()
        self.db.refresh(db_meeting)
        return db_meeting

    def update_status(self, meeting_id: int, status: models.MeetingStatus) -> models.Meeting | None:
        """Update meeting status."""
        meeting = self.get(meeting_id)
        if meeting:
            meeting.status = status.value
            self.db.commit()
            self.db.refresh(meeting)
        return meeting

    def update_progress(
        self, meeting_id: int, stage: models.ProcessingStage, stage_progress: float, overall_progress: float
    ) -> models.Meeting | None:
        """Update meeting processing progress."""
        meeting = self.get(meeting_id)
        if meeting:
            meeting.current_stage = stage.value
            meeting.stage_progress = stage_progress
            meeting.overall_progress = overall_progress
            self.db.commit()
            self.db.refresh(meeting)
        return meeting

    def update_task_id(self, meeting_id: int, task_id: str) -> models.Meeting | None:
        """Update the Celery task ID for a meeting."""
        meeting = self.get(meeting_id)
        if meeting:
            meeting.celery_task_id = task_id
            self.db.commit()
            self.db.refresh(meeting)
        return meeting

    def mark_embeddings(self, meeting_id: int, computed: bool, config_id: int | None = None) -> models.Meeting | None:
        """Mark meeting embeddings status."""
        meeting = self.get(meeting_id)
        if not meeting:
            return None

        from sqlalchemy.sql import func as sql_func

        meeting.embeddings_computed = computed
        meeting.embedding_config_id = config_id
        meeting.embeddings_updated_at = sql_func.now() if computed else None

        self.db.commit()
        self.db.refresh(meeting)
        return meeting

    def update_processing_details(self, meeting_id: int, **kwargs) -> models.Meeting | None:
        """
        Update meeting processing details.

        Handles special cases like log appending and timestamp conversion.
        """
        meeting = self.get(meeting_id)
        if not meeting:
            return None

        # Handle processing_logs specially - append instead of replace
        if "processing_logs" in kwargs:
            new_logs = kwargs.pop("processing_logs")
            new_logs_str = "\n".join(new_logs) if isinstance(new_logs, list) else str(new_logs)

            if meeting.processing_logs is None:
                meeting.processing_logs = new_logs_str
            else:
                # Append and keep only last 50 lines
                combined = meeting.processing_logs + "\n" + new_logs_str
                lines = combined.split("\n")
                meeting.processing_logs = "\n".join(lines[-50:])

        # Handle timestamp conversions
        for field in ["processing_start_time", "stage_start_time"]:
            if field in kwargs and isinstance(kwargs[field], int | float):
                kwargs[field] = datetime.fromtimestamp(kwargs[field])

        # Update remaining fields
        for key, value in kwargs.items():
            if hasattr(meeting, key):
                setattr(meeting, key, value)

        self.db.commit()
        self.db.refresh(meeting)
        return meeting

    def delete_meeting(self, meeting_id: int) -> models.Meeting | None:
        """
        Delete a meeting and cancel any running tasks.

        Handles Celery task cancellation and related record cleanup.
        """
        meeting = self.get(meeting_id)
        if not meeting:
            return None

        # Cancel Celery task if running
        processing_statuses = [models.MeetingStatus.PROCESSING.value, models.MeetingStatus.PENDING.value]
        if meeting.celery_task_id and meeting.status in processing_statuses:
            try:
                from ...worker import celery_app

                celery_app.control.revoke(meeting.celery_task_id, terminate=True)
            except Exception as e:
                # Log but don't fail the delete
                import logging

                logging.getLogger(__name__).warning(f"Failed to cancel Celery task {meeting.celery_task_id}: {e}")

        # Delete related diarization timings
        self.db.query(models.DiarizationTiming).filter(models.DiarizationTiming.meeting_id == meeting_id).delete()

        # Delete meeting (cascades to transcription and action items)
        self.db.delete(meeting)
        self.db.commit()
        return meeting


# =============================================================================
# Action Item Repository
# =============================================================================


class ActionItemRepository(BaseRepository[models.ActionItem, schemas.ActionItemCreate, schemas.ActionItemUpdate]):
    """
    Repository for ActionItem operations.
    """

    def __init__(self, db: Session):
        super().__init__(models.ActionItem, db)

    def get_by_id_or_raise(self, item_id: int) -> models.ActionItem:
        """Get action item by ID or raise ActionItemNotFoundError."""
        item = self.get(item_id)
        if not item:
            raise ActionItemNotFoundError(item_id)
        return item

    def get_by_status(self, status: str, skip: int = 0, limit: int = 1000) -> list[models.ActionItem]:
        """Get action items by status."""
        return self.get_multi(skip=skip, limit=limit, filters={"status": status})

    def get_by_transcription(self, transcription_id: int) -> list[models.ActionItem]:
        """Get all action items for a transcription."""
        return self.db.query(models.ActionItem).filter(models.ActionItem.transcription_id == transcription_id).all()

    def create_action_item(
        self, transcription_id: int, item_data: schemas.ActionItemCreate, is_manual: bool = True
    ) -> models.ActionItem:
        """Create a new action item."""
        db_item = models.ActionItem(
            transcription_id=transcription_id,
            task=item_data.task,
            owner=item_data.owner,
            due_date=item_data.due_date,
            is_manual=is_manual,
        )
        self.db.add(db_item)
        self.db.commit()
        self.db.refresh(db_item)
        return db_item

    def update_action_item(self, item_id: int, update_data: schemas.ActionItemUpdate) -> models.ActionItem | None:
        """Update an action item."""
        item = self.get(item_id)
        if not item:
            return None

        # Update provided fields
        update_dict = update_data.dict(exclude_unset=True) if hasattr(update_data, "dict") else dict(update_data)
        for field, value in update_dict.items():
            if value is not None and hasattr(item, field):
                setattr(item, field, value)

        item.is_manual = True
        self.db.commit()
        self.db.refresh(item)
        return item

    def update_calendar_sync(
        self, item_id: int, event_id: str | None = None, synced: bool = False
    ) -> models.ActionItem | None:
        """Update action item calendar sync status."""
        item = self.get(item_id)
        if not item:
            return None

        item.google_calendar_event_id = event_id
        item.synced_to_calendar = synced
        item.last_synced_at = datetime.now()

        self.db.commit()
        self.db.refresh(item)
        return item


# =============================================================================
# Attachment Repository
# =============================================================================


class AttachmentRepository(BaseRepository[models.Attachment, Any, Any]):
    """
    Repository for Attachment operations.
    """

    def __init__(self, db: Session):
        super().__init__(models.Attachment, db)

    def get_by_id_or_raise(self, attachment_id: int) -> models.Attachment:
        """Get attachment by ID or raise AttachmentNotFoundError."""
        attachment = self.get(attachment_id)
        if not attachment:
            raise AttachmentNotFoundError(attachment_id)
        return attachment

    def get_by_meeting(self, meeting_id: int) -> list[models.Attachment]:
        """Get all attachments for a meeting."""
        return self.db.query(models.Attachment).filter(models.Attachment.meeting_id == meeting_id).all()

    def create_attachment(
        self,
        meeting_id: int,
        filename: str,
        filepath: str,
        file_size: int | None = None,
        mime_type: str | None = None,
        description: str | None = None,
    ) -> models.Attachment:
        """Create a new attachment."""
        db_attachment = models.Attachment(
            meeting_id=meeting_id,
            filename=filename,
            filepath=filepath,
            file_size=file_size,
            mime_type=mime_type,
            description=description,
        )
        self.db.add(db_attachment)
        self.db.commit()
        self.db.refresh(db_attachment)
        return db_attachment

    def update_description(self, attachment_id: int, description: str) -> models.Attachment | None:
        """Update attachment description."""
        attachment = self.get(attachment_id)
        if attachment:
            attachment.description = description
            self.db.commit()
            self.db.refresh(attachment)
        return attachment


# =============================================================================
# Transcription Repository
# =============================================================================


class TranscriptionRepository(BaseRepository[models.Transcription, schemas.TranscriptionCreate, Any]):
    """
    Repository for Transcription operations.
    """

    def __init__(self, db: Session):
        super().__init__(models.Transcription, db)

    def get_by_meeting(self, meeting_id: int) -> models.Transcription | None:
        """Get transcription for a meeting."""
        return self.db.query(models.Transcription).filter(models.Transcription.meeting_id == meeting_id).first()

    def create_with_action_items(
        self,
        meeting_id: int,
        transcription_data: schemas.TranscriptionCreate,
        action_items: list[schemas.ActionItemCreate],
        mark_completed: bool = True,
    ) -> models.Transcription | None:
        """
        Create transcription with associated action items.

        Args:
            meeting_id: ID of the meeting
            transcription_data: Transcription data
            action_items: List of action items to create
            mark_completed: Whether to mark the meeting as completed
        """
        # Update meeting status if needed
        meeting_repo = MeetingRepository(self.db)
        meeting = meeting_repo.get(meeting_id)

        if not meeting:
            return None

        if mark_completed:
            meeting_repo.update_status(meeting_id, models.MeetingStatus.COMPLETED)

        # Create transcription
        db_transcription = models.Transcription(
            meeting_id=meeting_id, summary=transcription_data.summary, full_text=transcription_data.full_text
        )
        self.db.add(db_transcription)
        self.db.commit()
        self.db.refresh(db_transcription)

        # Create action items
        for item_data in action_items:
            db_item = models.ActionItem(**item_data.dict(), transcription_id=db_transcription.id)
            self.db.add(db_item)

        self.db.commit()
        self.db.refresh(db_transcription)
        return db_transcription


# =============================================================================
# Document Chunk Repository
# =============================================================================


class DocumentChunkRepository(BaseRepository[models.DocumentChunk, Any, Any]):
    """
    Repository for DocumentChunk operations (embeddings/RAG).
    """

    def __init__(self, db: Session):
        super().__init__(models.DocumentChunk, db)

    def get_by_meeting(self, meeting_id: int) -> list[models.DocumentChunk]:
        """Get all chunks for a meeting, ordered by index."""
        return (
            self.db.query(models.DocumentChunk)
            .filter(models.DocumentChunk.meeting_id == meeting_id)
            .order_by(asc(models.DocumentChunk.chunk_index))
            .all()
        )

    def clear_meeting_chunks(self, meeting_id: int) -> int:
        """Delete all chunks for a meeting. Returns count deleted."""
        count = self.db.query(models.DocumentChunk).filter(models.DocumentChunk.meeting_id == meeting_id).delete()
        self.db.commit()
        return count

    def bulk_create(self, chunks: list[models.DocumentChunk]) -> list[models.DocumentChunk]:
        """Create multiple chunks at once."""
        if not chunks:
            return []

        self.db.add_all(chunks)
        self.db.commit()
        for chunk in chunks:
            self.db.refresh(chunk)
        return chunks


# =============================================================================
# Diarization Timing Repository
# =============================================================================


class DiarizationTimingRepository(BaseRepository[models.DiarizationTiming, Any, Any]):
    """
    Repository for DiarizationTiming operations (performance tracking).
    """

    def __init__(self, db: Session):
        super().__init__(models.DiarizationTiming, db)

    def create_timing(
        self,
        meeting_id: int,
        audio_duration_seconds: float,
        processing_time_seconds: float,
        num_speakers: int | None = None,
        file_size_bytes: int | None = None,
    ) -> models.DiarizationTiming:
        """Record diarization timing data."""
        db_timing = models.DiarizationTiming(
            meeting_id=meeting_id,
            audio_duration_seconds=audio_duration_seconds,
            processing_time_seconds=processing_time_seconds,
            num_speakers=num_speakers,
            file_size_bytes=file_size_bytes,
        )
        self.db.add(db_timing)
        self.db.commit()
        self.db.refresh(db_timing)
        return db_timing

    def get_recent(self, limit: int = 20) -> list[models.DiarizationTiming]:
        """Get recent timing data, ordered by creation date."""
        return (
            self.db.query(models.DiarizationTiming)
            .order_by(models.DiarizationTiming.created_at.desc())
            .limit(limit)
            .all()
        )

    def get_average_rate(self, limit: int = 10) -> float | None:
        """
        Calculate average processing rate.

        Returns:
            Seconds of processing per second of audio, or None if no data.
        """
        timings = self.get_recent(limit)
        if not timings:
            return None

        rates = [t.processing_time_seconds / t.audio_duration_seconds for t in timings if t.audio_duration_seconds > 0]

        return sum(rates) / len(rates) if rates else None


# =============================================================================
# Speaker Repository
# =============================================================================


class SpeakerRepository(BaseRepository[models.Speaker, Any, Any]):
    """
    Repository for Speaker operations.
    """

    def __init__(self, db: Session):
        super().__init__(models.Speaker, db)

    def get_unique_names(self) -> list[str]:
        """Get all unique speaker names."""
        results = self.db.query(models.Speaker.name).distinct().order_by(models.Speaker.name).all()
        return [row[0] for row in results]
