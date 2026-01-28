"""
Service layer for the calendar module.

Provides business logic for calendar operations, including Google Calendar
integration and scheduled meeting management.

Usage:
    from app.modules.calendar.service import CalendarService

    calendar_service = CalendarService(db)
    credentials = calendar_service.get_active_credentials()
"""

from datetime import datetime

from sqlalchemy.orm import Session

from . import models, schemas
from .repository import GoogleCalendarCredentialsRepository, ScheduledMeetingRepository


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


class ScheduledMeetingService:
    """Service for managing scheduled meetings."""

    def __init__(self, db: Session):
        """
        Initialize the scheduled meeting service.

        Args:
            db: Database session
        """
        self.db = db
        self.repo = ScheduledMeetingRepository(db)

    def list_meetings(
        self, skip: int = 0, limit: int = 100, status: str | None = None, upcoming_only: bool = False
    ) -> list[models.ScheduledMeeting]:
        """
        List scheduled meetings with filtering.

        Args:
            skip: Number of meetings to skip for pagination
            limit: Maximum number of meetings to return
            status: Filter by status (e.g., "scheduled", "completed")
            upcoming_only: If True, only return meetings scheduled in the future

        Returns:
            List of scheduled meetings
        """
        return self.repo.list_all(skip=skip, limit=limit, status=status, upcoming_only=upcoming_only)

    def get_meeting(self, meeting_id: int) -> models.ScheduledMeeting | None:
        """
        Get a scheduled meeting by ID.

        Args:
            meeting_id: ID of the scheduled meeting

        Returns:
            Scheduled meeting if found, None otherwise
        """
        return self.repo.get_by_id(meeting_id)

    def get_by_calendar_event(self, event_id: str) -> models.ScheduledMeeting | None:
        """
        Get a scheduled meeting by Google Calendar event ID.

        Args:
            event_id: Google Calendar event ID

        Returns:
            Scheduled meeting if found, None otherwise
        """
        return self.repo.get_by_calendar_event_id(event_id)

    def create_meeting(self, meeting_data: schemas.ScheduledMeetingCreate) -> models.ScheduledMeeting:
        """
        Create a new scheduled meeting.

        Args:
            meeting_data: Scheduled meeting creation data

        Returns:
            Created scheduled meeting
        """
        return self.repo.create(meeting_data)

    def update_meeting(
        self, meeting_id: int, meeting_data: schemas.ScheduledMeetingUpdate
    ) -> models.ScheduledMeeting | None:
        """
        Update a scheduled meeting.

        Args:
            meeting_id: ID of the scheduled meeting
            meeting_data: Update data

        Returns:
            Updated scheduled meeting if found, None otherwise
        """
        meeting = self.repo.get_by_id(meeting_id)
        if not meeting:
            return None

        return self.repo.update(meeting_id, meeting_data)

    def delete_meeting(self, meeting_id: int) -> bool:
        """
        Delete a scheduled meeting.

        Args:
            meeting_id: ID of the scheduled meeting

        Returns:
            True if deleted, False if not found
        """
        return self.repo.delete(meeting_id)

    def link_to_uploaded_meeting(
        self, scheduled_meeting_id: int, uploaded_meeting_id: int
    ) -> models.ScheduledMeeting | None:
        """
        Link a scheduled meeting to an uploaded meeting.

        This also marks the scheduled meeting as completed.

        Args:
            scheduled_meeting_id: ID of the scheduled meeting
            uploaded_meeting_id: ID of the uploaded meeting

        Returns:
            Updated scheduled meeting if found, None otherwise
        """
        return self.repo.link_to_meeting(scheduled_meeting_id, uploaded_meeting_id)

    def get_upcoming_meetings(self, limit: int = 10) -> list[models.ScheduledMeeting]:
        """
        Get upcoming scheduled meetings.

        Args:
            limit: Maximum number of meetings to return

        Returns:
            List of upcoming meetings ordered by scheduled time
        """
        return self.repo.get_upcoming_meetings(limit)

    def get_meetings_by_date_range(
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
        return self.repo.get_by_date_range(start_date=start_date, end_date=end_date, skip=skip, limit=limit)


class CalendarService:
    """
    Combined service for calendar operations.

    This provides a unified interface for both credentials and
    scheduled meeting management.
    """

    def __init__(self, db: Session):
        """
        Initialize the calendar service.

        Args:
            db: Database session
        """
        self.db = db
        self.credentials = CalendarCredentialsService(db)
        self.meetings = ScheduledMeetingService(db)
