"""
Meetings module for the Meeting Assistant application.

This module provides:
- Meeting operations via repository pattern
- Transcription and action item management
- Attachment handling
- Document chunk management for RAG

Usage (Repository pattern):
    from app.modules.meetings import MeetingRepository, ActionItemRepository

    meeting_repo = MeetingRepository(db)
    meeting = meeting_repo.get_by_id(1)
"""

from . import models, schemas
from .repository import (
    ActionItemNotFoundError,
    ActionItemRepository,
    AttachmentNotFoundError,
    AttachmentRepository,
    DiarizationTimingRepository,
    DocumentChunkRepository,
    MeetingNotFoundError,
    MeetingRepository,
    SpeakerRepository,
    TranscriptionRepository,
)

__all__ = [
    # Submodules
    "models",
    "schemas",
    # Repository classes
    "MeetingRepository",
    "ActionItemRepository",
    "AttachmentRepository",
    "TranscriptionRepository",
    "DocumentChunkRepository",
    "DiarizationTimingRepository",
    "SpeakerRepository",
    # Exceptions
    "MeetingNotFoundError",
    "AttachmentNotFoundError",
    "ActionItemNotFoundError",
]
