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

from sqlalchemy import asc, func, or_
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

    def list_by_statuses(self, statuses: list[models.MeetingStatus]) -> list[models.Meeting]:
        """Get all meetings whose status is in the provided list."""
        status_values = [s.value for s in statuses]
        return self.db.query(models.Meeting).filter(models.Meeting.status.in_(status_values)).all()

    def list_completed_without_audio(self) -> list[models.Meeting]:
        """Get completed meetings that have no audio_filepath."""
        return (
            self.db.query(models.Meeting)
            .filter(
                models.Meeting.status == models.MeetingStatus.COMPLETED.value,
                models.Meeting.audio_filepath.is_(None),
            )
            .all()
        )

    def list_completed_with_audio(self) -> list[models.Meeting]:
        """Get completed meetings that have an audio_filepath set."""
        return (
            self.db.query(models.Meeting)
            .filter(
                models.Meeting.status == models.MeetingStatus.COMPLETED.value,
                models.Meeting.audio_filepath.isnot(None),
            )
            .all()
        )

    def get_distinct_folders_all(self) -> list[str]:
        """Get all distinct non-empty folder names across meetings of any status."""
        rows = self.db.query(models.Meeting.folder).filter(models.Meeting.folder.isnot(None)).distinct().all()
        return [r[0] for r in rows if r[0]]

    def get_latest(self, meeting_ids: list[int] | None = None) -> models.Meeting | None:
        """Return the most recently dated/created meeting, optionally scoped to meeting_ids."""
        query = self.db.query(models.Meeting)
        if meeting_ids:
            query = query.filter(models.Meeting.id.in_(meeting_ids))
        return query.order_by(models.Meeting.meeting_date.desc().nullslast(), models.Meeting.created_at.desc()).first()

    def get_latest_by_folder(self, folder: str, meeting_ids: list[int] | None = None) -> models.Meeting | None:
        """Return the most recent meeting in a given folder."""
        query = self.db.query(models.Meeting).filter(models.Meeting.folder == folder)
        if meeting_ids:
            query = query.filter(models.Meeting.id.in_(meeting_ids))
        return query.order_by(models.Meeting.meeting_date.desc().nullslast(), models.Meeting.created_at.desc()).first()

    def get_latest_by_speaker_names(
        self, speaker_names: list[str], meeting_ids: list[int] | None = None
    ) -> models.Meeting | None:
        """Return the most recent meeting that contains any of the given speaker names."""
        query = (
            self.db.query(models.Meeting)
            .join(models.Speaker)
            .filter(func.lower(models.Speaker.name).in_([n.lower() for n in speaker_names]))
        )
        if meeting_ids:
            query = query.filter(models.Meeting.id.in_(meeting_ids))
        return query.order_by(models.Meeting.meeting_date.desc().nullslast(), models.Meeting.created_at.desc()).first()

    def list_with_transcriptions(self, meeting_ids: list[int] | None = None, limit: int = 50) -> list:
        """Return (Meeting, Transcription) pairs where full_text is available."""
        query = (
            self.db.query(models.Meeting, models.Transcription)
            .join(models.Transcription, models.Transcription.meeting_id == models.Meeting.id)
            .filter(models.Transcription.full_text.isnot(None))
        )
        if meeting_ids:
            query = query.filter(models.Meeting.id.in_(meeting_ids))
        return (
            query.order_by(models.Meeting.meeting_date.desc().nullslast(), models.Meeting.created_at.desc())
            .limit(limit)
            .all()
        )

    def search_for_llm(
        self,
        search: str | None = None,
        folder: str | None = None,
        meeting_ids: list[int] | None = None,
        limit: int = 20,
    ) -> list[models.Meeting]:
        """Search meetings by text (filename/folder/speaker) and/or folder, for LLM tool use."""
        base_query = self.db.query(models.Meeting)
        if meeting_ids:
            base_query = base_query.filter(models.Meeting.id.in_(meeting_ids))
        if folder:
            base_query = base_query.filter(func.lower(models.Meeting.folder) == folder.lower())

        if not search:
            return (
                base_query.order_by(models.Meeting.meeting_date.desc().nullslast(), models.Meeting.created_at.desc())
                .limit(limit)
                .all()
            )

        search_lower = search.lower()
        name_match = base_query.filter(
            func.lower(models.Meeting.filename).contains(search_lower)
            | func.lower(models.Meeting.folder).contains(search_lower)
        )
        speaker_match = base_query.join(models.Speaker, models.Speaker.meeting_id == models.Meeting.id).filter(
            func.lower(models.Speaker.name).contains(search_lower)
            | func.lower(func.coalesce(models.Speaker.label, "")).contains(search_lower)
        )
        seen: set[int] = set()
        combined: list[models.Meeting] = []
        for m in name_match.all():
            if m.id not in seen:
                seen.add(m.id)
                combined.append(m)
        for m in speaker_match.all():
            if m.id not in seen:
                seen.add(m.id)
                combined.append(m)
        combined.sort(
            key=lambda m: (m.meeting_date or m.created_at) if (m.meeting_date or m.created_at) else datetime.min,
            reverse=True,
        )
        return combined[:limit]

    def get_by_folder(self, folder: str, skip: int = 0, limit: int = 100) -> list[models.Meeting]:
        """Get meetings in a specific folder."""
        return self.get_multi(skip=skip, limit=limit, filters={"folder": folder})

    def get_unique_folders(self) -> list[str]:
        """Get list of unique non-empty folders from completed meetings."""
        from sqlalchemy import distinct

        rows = (
            self.db.query(distinct(models.Meeting.folder))
            .filter(models.Meeting.folder.isnot(None))
            .filter(models.Meeting.folder != "")
            .filter(models.Meeting.status == models.MeetingStatus.COMPLETED.value)
            .all()
        )
        return [r[0] for r in rows if r[0]]

    def get_unique_tags(self) -> list[str]:
        """Get sorted list of unique tags from completed meetings."""
        rows = (
            self.db.query(models.Meeting.tags)
            .filter(models.Meeting.tags.isnot(None))
            .filter(models.Meeting.tags != "")
            .filter(models.Meeting.status == models.MeetingStatus.COMPLETED.value)
            .all()
        )
        tags_set: set[str] = set()
        for (tags_str,) in rows:
            if tags_str:
                for tag in tags_str.split(","):
                    tag = tag.strip()
                    if tag:
                        tags_set.add(tag)
        return sorted(tags_set)

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

    # -------------------------------------------------------------------------
    # Meeting Link helpers
    # -------------------------------------------------------------------------

    def get_meeting_links(self, source_meeting_id: int) -> list[models.MeetingLink]:
        """Get all outgoing meeting links for a source meeting."""
        return self.db.query(models.MeetingLink).filter(models.MeetingLink.source_meeting_id == source_meeting_id).all()

    def delete_meeting_links(self, source_meeting_id: int) -> None:
        """Delete all outgoing meeting links for a source meeting."""
        self.db.query(models.MeetingLink).filter(models.MeetingLink.source_meeting_id == source_meeting_id).delete()
        self.db.commit()

    def delete_meeting_links_to_targets(self, source_meeting_id: int, target_ids: set) -> None:
        """Delete outgoing meeting links to specific target meetings."""
        self.db.query(models.MeetingLink).filter(
            models.MeetingLink.source_meeting_id == source_meeting_id,
            models.MeetingLink.target_meeting_id.in_(target_ids),
        ).delete(synchronize_session=False)

    def add_meeting_link(self, source_meeting_id: int, target_meeting_id: int) -> None:
        """Add a directed link from one meeting to another."""
        self.db.add(models.MeetingLink(source_meeting_id=source_meeting_id, target_meeting_id=target_meeting_id))


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

    def list_with_meetings(
        self,
        meeting_ids: list[int] | None = None,
        status: str | None = None,
        limit: int = 30,
    ) -> list:
        """Return (ActionItem, Meeting) pairs joined through Transcription."""
        query = (
            self.db.query(models.ActionItem, models.Meeting)
            .join(models.Transcription, models.ActionItem.transcription_id == models.Transcription.id)
            .join(models.Meeting, models.Transcription.meeting_id == models.Meeting.id)
        )
        if meeting_ids:
            query = query.filter(models.Meeting.id.in_(meeting_ids))
        if status:
            query = query.filter(models.ActionItem.status == status)
        return query.order_by(models.ActionItem.due_date.asc().nullslast()).limit(limit).all()

    def get_upcoming_with_meetings(
        self,
        meeting_ids: list[int] | None = None,
        before_date=None,
        now=None,
        include_overdue: bool = True,
    ) -> list:
        """Return (ActionItem, Meeting) pairs for upcoming/overdue deadlines."""
        from sqlalchemy import DateTime, cast

        due_date_expr = cast(models.ActionItem.due_date, DateTime)
        query = (
            self.db.query(models.ActionItem, models.Meeting)
            .join(models.Transcription, models.ActionItem.transcription_id == models.Transcription.id)
            .join(models.Meeting, models.Transcription.meeting_id == models.Meeting.id)
            .filter(models.ActionItem.due_date.isnot(None))
            .filter(models.ActionItem.status.in_(["pending", "in_progress"]))
        )
        if meeting_ids:
            query = query.filter(models.Meeting.id.in_(meeting_ids))
        if before_date is not None:
            if include_overdue:
                query = query.filter(due_date_expr <= before_date)
            elif now is not None:
                query = query.filter(due_date_expr >= now, due_date_expr <= before_date)
        return query.order_by(due_date_expr.asc()).all()

    def create_action_item(
        self, transcription_id: int | None, item_data: schemas.ActionItemCreate, is_manual: bool = True
    ) -> models.ActionItem:
        """Create a new action item. Pass transcription_id=None for standalone tasks."""
        db_item = models.ActionItem(
            transcription_id=transcription_id,
            task=item_data.task,
            owner=item_data.owner,
            due_date=item_data.due_date,
            status=getattr(item_data, "status", None) or "pending",
            priority=getattr(item_data, "priority", None),
            notes=getattr(item_data, "notes", None),
            is_manual=is_manual,
            synced_to_calendar=False,
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

    def get_by_ids(self, ids: list[int]) -> list[models.ActionItem]:
        """Fetch action items by a list of IDs."""
        if not ids:
            return []
        return self.db.query(models.ActionItem).filter(models.ActionItem.id.in_(ids)).all()

    def get_pending_due_before(self, date_str: str) -> list[models.ActionItem]:
        """Get pending action items whose due_date is on or before date_str."""
        return (
            self.db.query(models.ActionItem)
            .filter(
                models.ActionItem.status == "pending",
                models.ActionItem.due_date <= date_str,
            )
            .all()
        )

    def get_completed_in_range_or_ids(self, start: str, end: str, saved_ids: list[int]) -> list[models.ActionItem]:
        """Get completed action items whose due_date is in [start, end] OR whose id is in saved_ids."""
        condition = models.ActionItem.due_date.between(start, end)
        if saved_ids:
            condition = or_(condition, models.ActionItem.id.in_(saved_ids))
        return self.db.query(models.ActionItem).filter(models.ActionItem.status == "completed", condition).all()

    def get_distinct_owners(self) -> list[str]:
        """Return a sorted list of distinct non-null action item owners."""
        rows = self.db.query(models.ActionItem.owner).distinct().filter(models.ActionItem.owner.isnot(None)).all()
        return sorted(r[0] for r in rows)


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

    def get_meeting_title(self, transcription_id: int) -> str | None:
        """Get meeting filename/title for a given transcription ID."""
        transcription = self.get(transcription_id)
        if transcription and transcription.meeting:
            return transcription.meeting.filename
        return None

    def get_meeting_info(self, transcription_id: int) -> dict | None:
        """Return a dict with meeting_id, meeting_title, and meeting_date for a transcription."""
        transcription = self.get(transcription_id)
        if transcription and transcription.meeting:
            mtg = transcription.meeting
            return {
                "meeting_id": mtg.id,
                "meeting_title": mtg.filename,
                "meeting_date": mtg.meeting_date,
            }
        return None

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

    def delete_by_attachment(self, attachment_id: int) -> None:
        """Delete all document chunks associated with an attachment."""
        self.db.query(models.DocumentChunk).filter(models.DocumentChunk.attachment_id == attachment_id).delete(
            synchronize_session=False
        )
        self.db.flush()


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
        """Get all unique speaker names across all completed meetings."""
        results = self.db.query(models.Speaker.name).distinct().order_by(models.Speaker.name).all()
        return [row[0] for row in results]

    def get_all_distinct_names(self) -> list[str]:
        """Get all distinct non-null speaker names across all meetings."""
        results = self.db.query(models.Speaker.name).filter(models.Speaker.name.isnot(None)).distinct().all()
        return [row[0] for row in results]

    def delete_by_meeting_id(self, meeting_id: int) -> int:
        """Delete all speakers for a given meeting. Returns the count deleted."""
        count = (
            self.db.query(models.Speaker)
            .filter(models.Speaker.meeting_id == meeting_id)
            .delete(synchronize_session=False)
        )
        self.db.flush()
        return count
