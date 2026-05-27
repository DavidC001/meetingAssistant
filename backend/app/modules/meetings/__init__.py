"""
Meetings module for the Meeting Assistant application.

This module provides:
- Meeting operations via repository pattern
- Transcription and action item management
- Attachment handling
- Document chunk management for RAG

Usage:
    from app.modules.meetings import MeetingService, MeetingRepository

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
from .service import MeetingService
from .services.attachment_service import AttachmentService
from .services.audio_service import AudioService
from .services.chat_service import MeetingChatService
from .services.export_service import ExportService

__all__ = [
    # Submodules
    "models",
    "schemas",
    # Service
    "MeetingService",
    # Sub-services
    "AttachmentService",
    "AudioService",
    "MeetingChatService",
    "ExportService",
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
