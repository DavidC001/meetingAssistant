"""
CRUD operations for the meetings module.

This module provides both:
1. Function-based CRUD (legacy, for backward compatibility)
2. Repository-based CRUD (recommended for new code)

For new code, prefer using the repository classes:
    from app.modules.meetings.repository import MeetingRepository, ActionItemRepository

    meeting_repo = MeetingRepository(db)
    meeting = meeting_repo.get_by_id(1)

Legacy functions are still supported for existing code.
"""

from sqlalchemy.orm import Session

from . import models, schemas
from .repository import (
    ActionItemRepository,
    AttachmentRepository,
    DiarizationTimingRepository,
    DocumentChunkRepository,
    MeetingRepository,
    SpeakerRepository,
    TranscriptionRepository,
)

# =============================================================================
# Meeting CRUD (Legacy function-based interface)
# These wrap the repository pattern for backward compatibility
# =============================================================================


def get_meeting(db: Session, meeting_id: int):
    """Get a meeting by ID."""
    return MeetingRepository(db).get_by_id(meeting_id)


def get_meetings(db: Session, skip: int = 0, limit: int = 100):
    """Get all meetings with pagination."""
    return MeetingRepository(db).get_all(skip=skip, limit=limit)


def create_meeting(
    db: Session, meeting: schemas.MeetingCreate, file_path: str, file_size: int = None, celery_task_id: str = None
):
    """Create a new meeting."""
    return MeetingRepository(db).create_meeting(
        meeting_data=meeting, file_path=file_path, file_size=file_size, celery_task_id=celery_task_id
    )


def update_meeting_status(db: Session, meeting_id: int, status: models.MeetingStatus):
    """Update meeting status."""
    return MeetingRepository(db).update_status(meeting_id, status)


def update_meeting_progress(
    db: Session, meeting_id: int, stage: models.ProcessingStage, stage_progress: float, overall_progress: float
):
    """Update meeting processing progress."""
    return MeetingRepository(db).update_progress(meeting_id, stage, stage_progress, overall_progress)


def update_meeting(db: Session, meeting_id: int, meeting: schemas.MeetingUpdate):
    """Update meeting fields."""
    db_meeting = get_meeting(db, meeting_id=meeting_id)
    if db_meeting:
        if meeting.filename is not None:
            db_meeting.filename = meeting.filename
        if meeting.transcription_language is not None:
            db_meeting.transcription_language = meeting.transcription_language
        if meeting.number_of_speakers is not None:
            db_meeting.number_of_speakers = meeting.number_of_speakers
        if meeting.model_configuration_id is not None:
            db_meeting.model_configuration_id = meeting.model_configuration_id
        if meeting.tags is not None:
            db_meeting.tags = meeting.tags
        if meeting.folder is not None:
            db_meeting.folder = meeting.folder
        if meeting.notes is not None:
            db_meeting.notes = meeting.notes
        if meeting.meeting_date is not None:
            db_meeting.meeting_date = meeting.meeting_date

        db.commit()
        db.refresh(db_meeting)
    return db_meeting


def delete_meeting(db: Session, meeting_id: int):
    """Delete a meeting."""
    return MeetingRepository(db).delete_meeting(meeting_id)


def update_meeting_task_id(db: Session, meeting_id: int, task_id: str):
    """Update the Celery task ID for a meeting."""
    return MeetingRepository(db).update_task_id(meeting_id, task_id)


def mark_meeting_embeddings(db: Session, meeting_id: int, *, computed: bool, config_id: int | None = None):
    """Mark meeting embeddings status."""
    return MeetingRepository(db).mark_embeddings(meeting_id, computed=computed, config_id=config_id)


def update_meeting_processing_details(db: Session, meeting_id: int, **kwargs):
    """Update meeting processing details."""
    return MeetingRepository(db).update_processing_details(meeting_id, **kwargs)


# =============================================================================
# Transcription CRUD
# =============================================================================


def create_meeting_transcription(
    db: Session,
    meeting_id: int,
    transcription: schemas.TranscriptionCreate,
    action_items: list[schemas.ActionItemCreate],
    mark_completed: bool = True,
):
    """Create transcription with action items."""
    return TranscriptionRepository(db).create_with_action_items(
        meeting_id=meeting_id,
        transcription_data=transcription,
        action_items=action_items,
        mark_completed=mark_completed,
    )


# =============================================================================
# Action Item CRUD
# =============================================================================


def get_action_item(db: Session, item_id: int):
    """Get a single action item by ID."""
    return ActionItemRepository(db).get(item_id)


def get_all_action_items(db: Session, skip: int = 0, limit: int = 1000, status: str = None):
    """Get all action items with optional status filter."""
    repo = ActionItemRepository(db)
    if status:
        return repo.get_by_status(status, skip=skip, limit=limit)
    return repo.get_all(skip=skip, limit=limit)


def create_action_item(
    db: Session, transcription_id: int, action_item: schemas.ActionItemCreate, is_manual: bool = True
):
    """Create a new action item."""
    return ActionItemRepository(db).create_action_item(
        transcription_id=transcription_id, item_data=action_item, is_manual=is_manual
    )


def update_action_item(db: Session, item_id: int, action_item_update: schemas.ActionItemUpdate):
    """Update an action item."""
    return ActionItemRepository(db).update_action_item(item_id, action_item_update)


def delete_action_item(db: Session, item_id: int):
    """Delete an action item."""
    return ActionItemRepository(db).delete(id=item_id)


def update_action_item_calendar_sync(db: Session, item_id: int, event_id: str = None, synced: bool = False):
    """Update action item calendar sync status."""
    return ActionItemRepository(db).update_calendar_sync(item_id, event_id=event_id, synced=synced)


# =============================================================================
# Attachment CRUD
# =============================================================================


def get_attachment(db: Session, attachment_id: int):
    """Get a single attachment by ID."""
    return AttachmentRepository(db).get(attachment_id)


def get_meeting_attachments(db: Session, meeting_id: int):
    """Get all attachments for a meeting."""
    return AttachmentRepository(db).get_by_meeting(meeting_id)


def create_attachment(
    db: Session,
    meeting_id: int,
    filename: str,
    filepath: str,
    file_size: int = None,
    mime_type: str = None,
    description: str = None,
):
    """Create a new attachment."""
    return AttachmentRepository(db).create_attachment(
        meeting_id=meeting_id,
        filename=filename,
        filepath=filepath,
        file_size=file_size,
        mime_type=mime_type,
        description=description,
    )


def update_attachment(db: Session, attachment_id: int, description: str = None):
    """Update attachment description."""
    return AttachmentRepository(db).update_description(attachment_id, description)


def delete_attachment(db: Session, attachment_id: int):
    """Delete an attachment."""
    return AttachmentRepository(db).delete(id=attachment_id)


# =============================================================================
# Document Chunks CRUD (for RAG/embeddings)
# =============================================================================


def clear_meeting_chunks(db: Session, meeting_id: int):
    """Clear all chunks for a meeting."""
    DocumentChunkRepository(db).clear_meeting_chunks(meeting_id)


def add_document_chunks(db: Session, chunks: list[models.DocumentChunk]):
    """Add multiple document chunks."""
    return DocumentChunkRepository(db).bulk_create(chunks)


def get_document_chunks(db: Session, meeting_id: int | None = None):
    """Get document chunks, optionally filtered by meeting."""
    repo = DocumentChunkRepository(db)
    if meeting_id is not None:
        return repo.get_by_meeting(meeting_id)
    return repo.get_all(skip=0, limit=10000)


# =============================================================================
# Diarization Timing CRUD
# =============================================================================


def create_diarization_timing(
    db: Session,
    meeting_id: int,
    audio_duration_seconds: float,
    processing_time_seconds: float,
    num_speakers: int = None,
    file_size_bytes: int = None,
):
    """Record diarization timing data."""
    return DiarizationTimingRepository(db).create_timing(
        meeting_id=meeting_id,
        audio_duration_seconds=audio_duration_seconds,
        processing_time_seconds=processing_time_seconds,
        num_speakers=num_speakers,
        file_size_bytes=file_size_bytes,
    )


def get_diarization_timings(db: Session, limit: int = 20):
    """Get recent diarization timing data."""
    return DiarizationTimingRepository(db).get_recent(limit)


def get_average_diarization_rate(db: Session, limit: int = 10):
    """Calculate average processing rate."""
    return DiarizationTimingRepository(db).get_average_rate(limit)


# =============================================================================
# Filter helpers
# =============================================================================


def get_meeting_ids_by_filters(db: Session, folder: str | None = None, tags: str | None = None):
    """Get meeting IDs matching filters."""
    return MeetingRepository(db).get_by_filters(folder=folder, tags=tags)


def get_all_unique_speakers(db: Session):
    """Get all unique speaker names."""
    return SpeakerRepository(db).get_unique_names()
