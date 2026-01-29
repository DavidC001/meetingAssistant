"""
Service layer for the chat module.

Provides business logic for chat operations, separating concerns
from the routing layer.

Usage:
    from app.modules.chat.service import ChatService

    chat_service = ChatService(db)
    message = chat_service.create_chat_message(meeting_id, role, content)
"""


from sqlalchemy.orm import Session

from . import models
from .repository import ChatMessageRepository, GlobalChatMessageRepository, GlobalChatSessionRepository


class ChatService:
    """Service for managing meeting-specific chat messages."""

    def __init__(self, db: Session):
        """
        Initialize the chat service.

        Args:
            db: Database session
        """
        self.db = db
        self.message_repo = ChatMessageRepository(db)

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
        return self.message_repo.create_message(meeting_id, role, content)

    def get_chat_history(self, meeting_id: int, skip: int = 0, limit: int = 100) -> list[models.ChatMessage]:
        """
        Get chat history for a meeting.

        Args:
            meeting_id: ID of the meeting
            skip: Number of messages to skip for pagination
            limit: Maximum number of messages to return

        Returns:
            List of chat messages ordered by creation time (ascending)
        """
        return self.message_repo.get_by_meeting(meeting_id, skip=skip, limit=limit, order_asc=True)

    def clear_chat_history(self, meeting_id: int) -> int:
        """
        Clear all chat messages for a meeting.

        Args:
            meeting_id: ID of the meeting

        Returns:
            Number of messages deleted
        """
        return self.message_repo.delete_by_meeting(meeting_id)

    def get_message_count(self, meeting_id: int) -> int:
        """
        Get the total number of messages for a meeting.

        Args:
            meeting_id: ID of the meeting

        Returns:
            Total count of messages
        """
        return self.message_repo.count_by_meeting(meeting_id)


class GlobalChatService:
    """Service for managing global chat sessions and messages."""

    def __init__(self, db: Session):
        """
        Initialize the global chat service.

        Args:
            db: Database session
        """
        self.db = db
        self.session_repo = GlobalChatSessionRepository(db)
        self.message_repo = GlobalChatMessageRepository(db)

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
        return self.session_repo.create_session(
            title=title, tags=tags, filter_folder=filter_folder, filter_tags=filter_tags
        )

    def list_sessions(self, skip: int = 0, limit: int = 100) -> list[models.GlobalChatSession]:
        """
        List all global chat sessions.

        Args:
            skip: Number of sessions to skip for pagination
            limit: Maximum number of sessions to return

        Returns:
            List of chat sessions ordered by last update (descending)
        """
        return self.session_repo.list_all(skip=skip, limit=limit)

    def get_session(self, session_id: int) -> models.GlobalChatSession | None:
        """
        Get a specific global chat session.

        Args:
            session_id: ID of the session

        Returns:
            Chat session if found, None otherwise
        """
        return self.session_repo.get(session_id)

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
        return self.session_repo.update_session(
            session_id=session_id, title=title, tags=tags, filter_folder=filter_folder, filter_tags=filter_tags
        )

    def delete_session(self, session_id: int) -> bool:
        """
        Delete a global chat session.

        Args:
            session_id: ID of the session to delete

        Returns:
            True if deleted, False if not found
        """
        return self.session_repo.delete(session_id)

    def add_message(
        self, session_id: int, role: str, content: str, sources: list | None = None
    ) -> models.GlobalChatMessage:
        """
        Add a message to a global chat session.

        This also updates the session's updated_at timestamp.

        Args:
            session_id: ID of the chat session
            role: Role of the message sender (user/assistant/system)
            content: Message content
            sources: Optional list of source documents/meetings

        Returns:
            Created global chat message
        """
        # Create the message
        message = self.message_repo.create_message(session_id=session_id, role=role, content=content, sources=sources)

        # Touch the session to update its timestamp
        self.session_repo.touch_session(session_id)

        return message

    def get_messages(self, session_id: int, skip: int = 0, limit: int = 100) -> list[models.GlobalChatMessage]:
        """
        Get messages for a global chat session.

        Args:
            session_id: ID of the chat session
            skip: Number of messages to skip for pagination
            limit: Maximum number of messages to return

        Returns:
            List of messages ordered by creation time (ascending)
        """
        return self.message_repo.get_by_session(session_id=session_id, skip=skip, limit=limit, order_asc=True)

    def get_message_count(self, session_id: int) -> int:
        """
        Get the total number of messages for a session.

        Args:
            session_id: ID of the chat session

        Returns:
            Total count of messages
        """
        return self.message_repo.count_by_session(session_id)
