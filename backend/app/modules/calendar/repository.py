"""
Repository classes for the calendar module.

Provides domain-specific repositories that extend BaseRepository
with calendar-specific operations.

Usage:
    from app.modules.calendar.repository import (
        GoogleCalendarCredentialsRepository,
        ScheduledMeetingRepository
    )

    creds_repo = GoogleCalendarCredentialsRepository(db)
    credentials = creds_repo.get_active_credentials(user_id="default")
"""

from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.core.base import BaseRepository, NotFoundError

from . import models, schemas

# =============================================================================
# Custom Exceptions
# =============================================================================


class CredentialsNotFoundError(NotFoundError):
    """Raised when calendar credentials are not found."""

    def __init__(self, user_id: str):
        super().__init__("GoogleCalendarCredentials", user_id)


class ScheduledMeetingNotFoundError(NotFoundError):
    """Raised when a scheduled meeting is not found."""

    def __init__(self, meeting_id: Any):
        super().__init__("ScheduledMeeting", meeting_id)


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


# =============================================================================
# Scheduled Meeting Repository
# =============================================================================


class ScheduledMeetingRepository(
    BaseRepository[models.ScheduledMeeting, schemas.ScheduledMeetingCreate, schemas.ScheduledMeetingUpdate]
):
    """Repository for scheduled meetings."""

    def __init__(self, db: Session):
        """Initialize the repository with a database session."""
        super().__init__(models.ScheduledMeeting, db)

    def list_all(
        self, skip: int = 0, limit: int = 100, status: str | None = None, upcoming_only: bool = False
    ) -> list[models.ScheduledMeeting]:
        """
        List scheduled meetings with filtering and pagination.

        Args:
            skip: Number of meetings to skip for pagination
            limit: Maximum number of meetings to return
            status: Filter by status (e.g., "scheduled", "completed")
            upcoming_only: If True, only return meetings scheduled in the future

        Returns:
            List of scheduled meetings ordered by scheduled time (descending)
        """
        query = self.db.query(self.model)

        if status:
            query = query.filter(self.model.status == status)

        if upcoming_only:
            query = query.filter(self.model.scheduled_time >= datetime.now())

        return query.order_by(self.model.scheduled_time.desc()).offset(skip).limit(limit).all()

    def get_by_calendar_event_id(self, event_id: str) -> models.ScheduledMeeting | None:
        """
        Get a scheduled meeting by Google Calendar event ID.

        Args:
            event_id: Google Calendar event ID

        Returns:
            Scheduled meeting if found, None otherwise
        """
        return self.db.query(self.model).filter(self.model.google_calendar_event_id == event_id).first()

    def link_to_meeting(self, scheduled_meeting_id: int, meeting_id: int) -> models.ScheduledMeeting | None:
        """
        Link a scheduled meeting to an uploaded meeting.

        This also updates the status to "completed".

        Args:
            scheduled_meeting_id: ID of the scheduled meeting
            meeting_id: ID of the uploaded meeting to link

        Returns:
            Updated scheduled meeting if found, None otherwise
        """
        scheduled_meeting = self.get_by_id(scheduled_meeting_id)
        if not scheduled_meeting:
            return None

        scheduled_meeting.linked_meeting_id = meeting_id
        scheduled_meeting.status = "completed"
        self.db.commit()
        self.db.refresh(scheduled_meeting)
        return scheduled_meeting

    def get_upcoming_meetings(self, limit: int = 10) -> list[models.ScheduledMeeting]:
        """
        Get upcoming scheduled meetings.

        Args:
            limit: Maximum number of meetings to return

        Returns:
            List of upcoming meetings ordered by scheduled time (ascending)
        """
        return (
            self.db.query(self.model)
            .filter(self.model.scheduled_time >= datetime.now(), self.model.status == "scheduled")
            .order_by(self.model.scheduled_time.asc())
            .limit(limit)
            .all()
        )

    def get_by_date_range(
        self, start_date: datetime, end_date: datetime, skip: int = 0, limit: int = 100
    ) -> list[models.ScheduledMeeting]:
        """
        Get scheduled meetings within a date range.

        Args:
            start_date: Start of the date range
            end_date: End of the date range
            skip: Number of meetings to skip for pagination
            limit: Maximum number of meetings to return

        Returns:
            List of scheduled meetings within the date range
        """
        return (
            self.db.query(self.model)
            .filter(self.model.scheduled_time >= start_date, self.model.scheduled_time <= end_date)
            .order_by(self.model.scheduled_time.asc())
            .offset(skip)
            .limit(limit)
            .all()
        )
