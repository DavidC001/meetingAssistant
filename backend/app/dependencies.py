"""
Centralized dependency injection for FastAPI.

Provides dependency injection functions for services, repositories,
and other shared components. This improves testability and code organization.

Usage:
    from fastapi import APIRouter, Depends
    from app.dependencies import get_meeting_service

    @router.get("/meetings")
    async def list_meetings(
        service: MeetingService = Depends(get_meeting_service)
    ):
        return service.list_meetings()
"""

from functools import lru_cache

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.config import AppConfig, config
from app.database import get_db
from app.modules.calendar.repository import GoogleCalendarCredentialsRepository, ScheduledMeetingRepository
from app.modules.calendar.service import CalendarCredentialsService, CalendarService, ScheduledMeetingService
from app.modules.chat.repository import ChatMessageRepository, GlobalChatMessageRepository, GlobalChatSessionRepository
from app.modules.chat.service import ChatService, GlobalChatService
from app.modules.diary.repository import DiaryRepository
from app.modules.diary.service import DiaryService
from app.modules.meetings.repository import ActionItemRepository, AttachmentRepository, MeetingRepository

# Module imports
from app.modules.meetings.service import MeetingService
from app.modules.users.repository import UserMappingRepository
from app.modules.users.service import UserMappingService

# =============================================================================
# Configuration Dependencies
# =============================================================================


@lru_cache
def get_config() -> AppConfig:
    """
    Get application configuration.

    This is cached to avoid repeated instantiation.

    Returns:
        Application configuration object
    """
    return config


# =============================================================================
# Meeting Module Dependencies
# =============================================================================


def get_meeting_repository(db: Session = Depends(get_db)) -> MeetingRepository:
    """
    Get meeting repository instance.

    Args:
        db: Database session (injected)

    Returns:
        MeetingRepository instance
    """
    return MeetingRepository(db)


def get_action_item_repository(db: Session = Depends(get_db)) -> ActionItemRepository:
    """
    Get action item repository instance.

    Args:
        db: Database session (injected)

    Returns:
        ActionItemRepository instance
    """
    return ActionItemRepository(db)


def get_attachment_repository(db: Session = Depends(get_db)) -> AttachmentRepository:
    """
    Get attachment repository instance.

    Args:
        db: Database session (injected)

    Returns:
        AttachmentRepository instance
    """
    return AttachmentRepository(db)


def get_meeting_service(db: Session = Depends(get_db)) -> MeetingService:
    """
    Get meeting service instance.

    Args:
        db: Database session (injected)

    Returns:
        MeetingService instance
    """
    return MeetingService(db)


# =============================================================================
# Diary Module Dependencies
# =============================================================================


def get_diary_repository(db: Session = Depends(get_db)) -> DiaryRepository:
    """
    Get diary repository instance.

    Args:
        db: Database session (injected)

    Returns:
        DiaryRepository instance
    """
    return DiaryRepository(db)


def get_diary_service(db: Session = Depends(get_db)) -> DiaryService:
    """
    Get diary service instance.

    Args:
        db: Database session (injected)

    Returns:
        DiaryService instance
    """
    return DiaryService(db)


# =============================================================================
# Chat Module Dependencies
# =============================================================================


def get_chat_message_repository(db: Session = Depends(get_db)) -> ChatMessageRepository:
    """
    Get chat message repository instance.

    Args:
        db: Database session (injected)

    Returns:
        ChatMessageRepository instance
    """
    return ChatMessageRepository(db)


def get_global_chat_session_repository(db: Session = Depends(get_db)) -> GlobalChatSessionRepository:
    """
    Get global chat session repository instance.

    Args:
        db: Database session (injected)

    Returns:
        GlobalChatSessionRepository instance
    """
    return GlobalChatSessionRepository(db)


def get_global_chat_message_repository(db: Session = Depends(get_db)) -> GlobalChatMessageRepository:
    """
    Get global chat message repository instance.

    Args:
        db: Database session (injected)

    Returns:
        GlobalChatMessageRepository instance
    """
    return GlobalChatMessageRepository(db)


def get_chat_service(db: Session = Depends(get_db)) -> ChatService:
    """
    Get chat service instance.

    Args:
        db: Database session (injected)

    Returns:
        ChatService instance
    """
    return ChatService(db)


def get_global_chat_service(db: Session = Depends(get_db)) -> GlobalChatService:
    """
    Get global chat service instance.

    Args:
        db: Database session (injected)

    Returns:
        GlobalChatService instance
    """
    return GlobalChatService(db)


# =============================================================================
# User Module Dependencies
# =============================================================================


def get_user_mapping_repository(db: Session = Depends(get_db)) -> UserMappingRepository:
    """
    Get user mapping repository instance.

    Args:
        db: Database session (injected)

    Returns:
        UserMappingRepository instance
    """
    return UserMappingRepository(db)


def get_user_mapping_service(db: Session = Depends(get_db)) -> UserMappingService:
    """
    Get user mapping service instance.

    Args:
        db: Database session (injected)

    Returns:
        UserMappingService instance
    """
    return UserMappingService(db)


# =============================================================================
# Calendar Module Dependencies
# =============================================================================


def get_calendar_credentials_repository(db: Session = Depends(get_db)) -> GoogleCalendarCredentialsRepository:
    """
    Get calendar credentials repository instance.

    Args:
        db: Database session (injected)

    Returns:
        GoogleCalendarCredentialsRepository instance
    """
    return GoogleCalendarCredentialsRepository(db)


def get_scheduled_meeting_repository(db: Session = Depends(get_db)) -> ScheduledMeetingRepository:
    """
    Get scheduled meeting repository instance.

    Args:
        db: Database session (injected)

    Returns:
        ScheduledMeetingRepository instance
    """
    return ScheduledMeetingRepository(db)


def get_calendar_credentials_service(db: Session = Depends(get_db)) -> CalendarCredentialsService:
    """
    Get calendar credentials service instance.

    Args:
        db: Database session (injected)

    Returns:
        CalendarCredentialsService instance
    """
    return CalendarCredentialsService(db)


def get_scheduled_meeting_service(db: Session = Depends(get_db)) -> ScheduledMeetingService:
    """
    Get scheduled meeting service instance.

    Args:
        db: Database session (injected)

    Returns:
        ScheduledMeetingService instance
    """
    return ScheduledMeetingService(db)


def get_calendar_service(db: Session = Depends(get_db)) -> CalendarService:
    """
    Get calendar service instance (combined).

    Args:
        db: Database session (injected)

    Returns:
        CalendarService instance
    """
    return CalendarService(db)
