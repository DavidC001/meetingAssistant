"""
Repository classes for the chat module.

Provides domain-specific repositories that extend BaseRepository
with chat-specific operations.

Usage:
    from app.modules.chat.repository import ChatMessageRepository, GlobalChatSessionRepository

    chat_repo = ChatMessageRepository(db)
    messages = chat_repo.get_by_meeting(meeting_id)
"""

from typing import Any

from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from app.core.base import BaseRepository, NotFoundError

from . import models, schemas

# =============================================================================
# Custom Exceptions
# =============================================================================


class ChatMessageNotFoundError(NotFoundError):
    """Raised when a chat message is not found."""

    def __init__(self, message_id: Any):
        super().__init__("ChatMessage", message_id)


class GlobalChatSessionNotFoundError(NotFoundError):
    """Raised when a global chat session is not found."""

    def __init__(self, session_id: Any):
        super().__init__("GlobalChatSession", session_id)


class GlobalChatMessageNotFoundError(NotFoundError):
    """Raised when a global chat message is not found."""

    def __init__(self, message_id: Any):
        super().__init__("GlobalChatMessage", message_id)


# =============================================================================
# Chat Message Repository
# =============================================================================


class ChatMessageRepository(BaseRepository[models.ChatMessage, Any, Any]):
    """Repository for meeting-specific chat messages."""

    def __init__(self, db: Session):
        """Initialize the repository with a database session."""
        super().__init__(models.ChatMessage, db)

    def get_by_meeting(
        self, meeting_id: int, skip: int = 0, limit: int = 100, order_asc: bool = True
    ) -> list[models.ChatMessage]:
        """
        Get all chat messages for a specific meeting.

        Args:
            meeting_id: ID of the meeting
            skip: Number of messages to skip for pagination
            limit: Maximum number of messages to return
            order_asc: If True, order by created_at ascending (oldest first)

        Returns:
            List of chat messages for the meeting
        """
        query = self.db.query(self.model).filter(self.model.meeting_id == meeting_id)

        if order_asc:
            query = query.order_by(self.model.created_at.asc())
        else:
            query = query.order_by(self.model.created_at.desc())

        return query.offset(skip).limit(limit).all()

    def count_by_meeting(self, meeting_id: int) -> int:
        """
        Count total chat messages for a meeting.

        Args:
            meeting_id: ID of the meeting

        Returns:
            Total count of messages
        """
        return self.db.query(func.count(self.model.id)).filter(self.model.meeting_id == meeting_id).scalar()

    def delete_by_meeting(self, meeting_id: int) -> int:
        """
        Delete all chat messages for a meeting.

        Args:
            meeting_id: ID of the meeting

        Returns:
            Number of messages deleted
        """
        count = self.db.query(self.model).filter(self.model.meeting_id == meeting_id).delete()
        self.db.commit()
        return count

    def create_message(self, meeting_id: int, role: str, content: str) -> models.ChatMessage:
        """
        Create a new chat message for a meeting.

        Args:
            meeting_id: ID of the meeting
            role: Role of the message sender (user/assistant/system)
            content: Message content

        Returns:
            Created chat message
        """
        message = self.model(meeting_id=meeting_id, role=role, content=content)
        self.db.add(message)
        self.db.commit()
        self.db.refresh(message)
        return message


# =============================================================================
# Global Chat Session Repository
# =============================================================================


class GlobalChatSessionRepository(
    BaseRepository[models.GlobalChatSession, schemas.GlobalChatSessionCreate, schemas.GlobalChatSessionUpdate]
):
    """Repository for global chat sessions."""

    def __init__(self, db: Session):
        """Initialize the repository with a database session."""
        super().__init__(models.GlobalChatSession, db)

    def list_all(self, skip: int = 0, limit: int = 100) -> list[models.GlobalChatSession]:
        """
        List all global chat sessions ordered by last update.

        Args:
            skip: Number of sessions to skip for pagination
            limit: Maximum number of sessions to return

        Returns:
            List of global chat sessions
        """
        return self.db.query(self.model).order_by(self.model.updated_at.desc()).offset(skip).limit(limit).all()

    def create_session(
        self,
        title: str | None = None,
        tags: str | None = None,
        filter_folder: str | None = None,
        filter_tags: str | None = None,
    ) -> models.GlobalChatSession:
        """
        Create a new global chat session.

        Args:
            title: Session title (default: "New chat")
            tags: Optional tags for organizing sessions
            filter_folder: Optional folder filter for scoping searches
            filter_tags: Optional tag filter for scoping searches

        Returns:
            Created chat session
        """
        session = self.model(title=title or "New chat", tags=tags, filter_folder=filter_folder, filter_tags=filter_tags)
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    def update_session(
        self,
        session_id: int,
        title: str | None = None,
        tags: str | None = None,
        filter_folder: str | None = None,
        filter_tags: str | None = None,
    ) -> models.GlobalChatSession:
        """
        Update a global chat session.

        Args:
            session_id: ID of the session to update
            title: New title (if provided)
            tags: New tags (if provided)
            filter_folder: New folder filter (if provided)
            filter_tags: New tag filter (if provided)

        Returns:
            Updated chat session

        Raises:
            GlobalChatSessionNotFoundError: If session not found
        """
        session = self.get(session_id)
        if not session:
            raise GlobalChatSessionNotFoundError(session_id)

        if title is not None:
            session.title = title
        if tags is not None:
            session.tags = tags
        if filter_folder is not None:
            session.filter_folder = filter_folder
        if filter_tags is not None:
            session.filter_tags = filter_tags

        session.updated_at = func.now()
        self.db.commit()
        self.db.refresh(session)
        return session

    def touch_session(self, session_id: int) -> None:
        """
        Update the updated_at timestamp for a session.

        Args:
            session_id: ID of the session to touch

        Raises:
            GlobalChatSessionNotFoundError: If session not found
        """
        session = self.get(session_id)
        if not session:
            raise GlobalChatSessionNotFoundError(session_id)

        session.updated_at = func.now()
        self.db.commit()


# =============================================================================
# Global Chat Message Repository
# =============================================================================


class GlobalChatMessageRepository(BaseRepository[models.GlobalChatMessage, Any, Any]):
    """Repository for global chat messages."""

    def __init__(self, db: Session):
        """Initialize the repository with a database session."""
        super().__init__(models.GlobalChatMessage, db)

    def get_by_session(
        self, session_id: int, skip: int = 0, limit: int = 100, order_asc: bool = True
    ) -> list[models.GlobalChatMessage]:
        """
        Get all messages for a specific global chat session.

        Args:
            session_id: ID of the chat session
            skip: Number of messages to skip for pagination
            limit: Maximum number of messages to return
            order_asc: If True, order by created_at ascending (oldest first)

        Returns:
            List of global chat messages for the session
        """
        query = self.db.query(self.model).filter(self.model.session_id == session_id)

        if order_asc:
            query = query.order_by(self.model.created_at.asc())
        else:
            query = query.order_by(self.model.created_at.desc())

        return query.offset(skip).limit(limit).all()

    def count_by_session(self, session_id: int) -> int:
        """
        Count total messages for a session.

        Args:
            session_id: ID of the chat session

        Returns:
            Total count of messages
        """
        return self.db.query(func.count(self.model.id)).filter(self.model.session_id == session_id).scalar()

    def create_message(
        self, session_id: int, role: str, content: str, sources: list | None = None
    ) -> models.GlobalChatMessage:
        """
        Create a new message in a global chat session.

        Args:
            session_id: ID of the chat session
            role: Role of the message sender (user/assistant/system)
            content: Message content
            sources: Optional list of source documents/meetings

        Returns:
            Created global chat message
        """
        message = self.model(session_id=session_id, role=role, content=content, sources=sources or [])
        self.db.add(message)
        self.db.commit()
        self.db.refresh(message)
        return message
