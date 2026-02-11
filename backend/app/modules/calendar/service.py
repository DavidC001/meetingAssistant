"""
Service layer for the calendar module.

Provides business logic for calendar operations, including Google Calendar
integration.

Usage:
    from app.modules.calendar.service import CalendarCredentialsService

    calendar_service = CalendarCredentialsService(db)
    credentials = calendar_service.get_active_credentials()
"""

from sqlalchemy.orm import Session

from . import models
from .repository import GoogleCalendarCredentialsRepository


class CalendarCredentialsService:
    """Service for managing Google Calendar credentials."""

    def __init__(self, db: Session):
        """
        Initialize the credentials service.

        Args:
            db: Database session
        """
        self.db = db
        self.repo = GoogleCalendarCredentialsRepository(db)

    def get_active_credentials(self, user_id: str = "default") -> models.GoogleCalendarCredentials | None:
        """
        Get active Google Calendar credentials for a user.

        Args:
            user_id: User identifier (default: "default")

        Returns:
            Active credentials if found, None otherwise
        """
        return self.repo.get_active_credentials(user_id)

    def save_credentials(
        self, credentials_json: str, calendar_id: str = "primary", user_id: str = "default"
    ) -> models.GoogleCalendarCredentials:
        """
        Save or update Google Calendar credentials.

        This replaces any existing credentials for the user.

        Args:
            credentials_json: JSON string containing OAuth credentials
            calendar_id: Google Calendar ID (default: "primary")
            user_id: User identifier (default: "default")

        Returns:
            Created credentials
        """
        return self.repo.save_credentials(credentials_json=credentials_json, calendar_id=calendar_id, user_id=user_id)

    def delete_credentials(self, user_id: str = "default") -> bool:
        """
        Delete Google Calendar credentials for a user.

        Args:
            user_id: User identifier (default: "default")

        Returns:
            True if deleted, False if not found
        """
        return self.repo.delete_credentials(user_id)

    def is_connected(self, user_id: str = "default") -> bool:
        """
        Check if Google Calendar is connected for a user.

        Args:
            user_id: User identifier (default: "default")

        Returns:
            True if connected, False otherwise
        """
        credentials = self.get_active_credentials(user_id)
        return credentials is not None
