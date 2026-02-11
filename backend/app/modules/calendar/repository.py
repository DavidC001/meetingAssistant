"""
Repository classes for the calendar module.

Provides domain-specific repositories that extend BaseRepository
with calendar-specific operations.

Usage:
    from app.modules.calendar.repository import GoogleCalendarCredentialsRepository

    creds_repo = GoogleCalendarCredentialsRepository(db)
    credentials = creds_repo.get_active_credentials(user_id="default")
"""

from typing import Any

from sqlalchemy.orm import Session

from app.core.base import BaseRepository, NotFoundError

from . import models

# =============================================================================
# Custom Exceptions
# =============================================================================


class CredentialsNotFoundError(NotFoundError):
    """Raised when calendar credentials are not found."""

    def __init__(self, user_id: str):
        super().__init__("GoogleCalendarCredentials", user_id)


# =============================================================================
# Google Calendar Credentials Repository
# =============================================================================


class GoogleCalendarCredentialsRepository(BaseRepository[models.GoogleCalendarCredentials, Any, Any]):
    """Repository for Google Calendar credentials."""

    def __init__(self, db: Session):
        """Initialize the repository with a database session."""
        super().__init__(models.GoogleCalendarCredentials, db)

    def get_active_credentials(self, user_id: str = "default") -> models.GoogleCalendarCredentials | None:
        """
        Get active Google Calendar credentials for a user.

        Args:
            user_id: User identifier (default: "default")

        Returns:
            Active credentials if found, None otherwise
        """
        return self.db.query(self.model).filter(self.model.user_id == user_id, self.model.is_active == True).first()

    def save_credentials(
        self, credentials_json: str, calendar_id: str = "primary", user_id: str = "default"
    ) -> models.GoogleCalendarCredentials:
        """
        Save or update Google Calendar credentials.

        This deactivates any existing credentials for the user before
        creating new ones, ensuring only one set of credentials is active.

        Args:
            credentials_json: JSON string containing OAuth credentials
            calendar_id: Google Calendar ID (default: "primary")
            user_id: User identifier (default: "default")

        Returns:
            Created credentials
        """
        # Deactivate existing credentials
        self.db.query(self.model).filter(self.model.user_id == user_id).update({"is_active": False})

        # Create new credentials
        credentials = self.model(
            user_id=user_id, credentials_json=credentials_json, calendar_id=calendar_id, is_active=True
        )
        self.db.add(credentials)
        self.db.commit()
        self.db.refresh(credentials)
        return credentials

    def delete_credentials(self, user_id: str = "default") -> bool:
        """
        Delete Google Calendar credentials for a user.

        Args:
            user_id: User identifier (default: "default")

        Returns:
            True if deleted, False if not found
        """
        count = self.db.query(self.model).filter(self.model.user_id == user_id).delete()
        self.db.commit()
        return count > 0
