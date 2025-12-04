"""
Meetings module for the Meeting Assistant application.

This module provides:
- Meeting CRUD operations (create, read, update, delete)
- Transcription and action item management
- Attachment handling
- Document chunk management for RAG

Usage (Repository pattern - recommended):
    from app.modules.meetings import MeetingRepository, ActionItemRepository
    
    meeting_repo = MeetingRepository(db)
    meeting = meeting_repo.get_by_id(1)

Usage (Function-based - legacy):
    from app.modules.meetings import crud
    
    meeting = crud.get_meeting(db, 1)
"""

from . import models
from . import schemas
from . import crud
from .repository import (
    MeetingRepository,
    ActionItemRepository,
    AttachmentRepository,
    TranscriptionRepository,
    DocumentChunkRepository,
    DiarizationTimingRepository,
    SpeakerRepository,
    MeetingNotFoundError,
    AttachmentNotFoundError,
    ActionItemNotFoundError,
)

__all__ = [
    # Submodules
    "models",
    "schemas",
    "crud",
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
