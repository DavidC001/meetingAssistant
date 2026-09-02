"""
Meetings module for the Meeting Assistant application.

This module provides:
- Meeting operations via repository pattern
- Transcription and action item management
- Attachment handling
- Document chunk management for RAG

Usage:
    from app.modules.meetings import MeetingRepository
    from app.modules.meetings.service import MeetingService  # import service explicitly

    service = MeetingService(db)
    meetings = service.list_meetings()
"""

from . import models, schemas
from .file_utils import FileManager, FileValidator
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
    # Utilities
    "FileManager",
    "FileValidator",
    # Repositories
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
