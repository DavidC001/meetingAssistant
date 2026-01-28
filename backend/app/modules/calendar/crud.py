from sqlalchemy.orm import Session

from . import models, schemas


def get_google_calendar_credentials(db: Session, user_id: str = "default"):
    """Get Google Calendar credentials for a user"""
    return (
        db.query(models.GoogleCalendarCredentials)
        .filter(models.GoogleCalendarCredentials.user_id == user_id, models.GoogleCalendarCredentials.is_active == True)
        .first()
    )


def save_google_calendar_credentials(
    db: Session, credentials_json: str, calendar_id: str = "primary", user_id: str = "default"
):
    """Save or update Google Calendar credentials"""
    # Deactivate existing credentials
    db.query(models.GoogleCalendarCredentials).filter(models.GoogleCalendarCredentials.user_id == user_id).update(
        {"is_active": False}
    )

    # Create new credentials
    db_creds = models.GoogleCalendarCredentials(
        user_id=user_id, credentials_json=credentials_json, calendar_id=calendar_id, is_active=True
    )
    db.add(db_creds)
    db.commit()
    db.refresh(db_creds)
    return db_creds


def delete_google_calendar_credentials(db: Session, user_id: str = "default"):
    """Delete Google Calendar credentials"""
    db.query(models.GoogleCalendarCredentials).filter(models.GoogleCalendarCredentials.user_id == user_id).delete()
    db.commit()


def get_scheduled_meetings(
    db: Session, skip: int = 0, limit: int = 100, status: str = None, upcoming_only: bool = False
):
    """Get scheduled meetings with optional filtering"""
    query = db.query(models.ScheduledMeeting)

    if status:
        query = query.filter(models.ScheduledMeeting.status == status)

    if upcoming_only:
        from datetime import datetime

        query = query.filter(models.ScheduledMeeting.scheduled_time >= datetime.now())

    return query.order_by(models.ScheduledMeeting.scheduled_time.desc()).offset(skip).limit(limit).all()


def get_scheduled_meeting(db: Session, scheduled_meeting_id: int):
    """Get a single scheduled meeting by ID"""
    return db.query(models.ScheduledMeeting).filter(models.ScheduledMeeting.id == scheduled_meeting_id).first()


def get_scheduled_meeting_by_calendar_event_id(db: Session, event_id: str):
    """Get a scheduled meeting by Google Calendar event ID"""
    return (
        db.query(models.ScheduledMeeting).filter(models.ScheduledMeeting.google_calendar_event_id == event_id).first()
    )


def create_scheduled_meeting(db: Session, scheduled_meeting: schemas.ScheduledMeetingCreate):
    """Create a new scheduled meeting"""
    db_scheduled_meeting = models.ScheduledMeeting(
        title=scheduled_meeting.title,
        description=scheduled_meeting.description,
        scheduled_time=scheduled_meeting.scheduled_time,
        duration_minutes=scheduled_meeting.duration_minutes or 60,
        location=scheduled_meeting.location,
        attendees=scheduled_meeting.attendees,
        google_calendar_event_id=scheduled_meeting.google_calendar_event_id,
        google_meet_link=scheduled_meeting.google_meet_link,
        status="scheduled",
    )
    db.add(db_scheduled_meeting)
    db.commit()
    db.refresh(db_scheduled_meeting)
    return db_scheduled_meeting


def update_scheduled_meeting(db: Session, scheduled_meeting_id: int, scheduled_meeting: schemas.ScheduledMeetingUpdate):
    """Update a scheduled meeting"""
    db_scheduled_meeting = get_scheduled_meeting(db, scheduled_meeting_id)
    if db_scheduled_meeting:
        if scheduled_meeting.title is not None:
            db_scheduled_meeting.title = scheduled_meeting.title
        if scheduled_meeting.description is not None:
            db_scheduled_meeting.description = scheduled_meeting.description
        if scheduled_meeting.scheduled_time is not None:
            db_scheduled_meeting.scheduled_time = scheduled_meeting.scheduled_time
        if scheduled_meeting.duration_minutes is not None:
            db_scheduled_meeting.duration_minutes = scheduled_meeting.duration_minutes
        if scheduled_meeting.location is not None:
            db_scheduled_meeting.location = scheduled_meeting.location
        if scheduled_meeting.attendees is not None:
            db_scheduled_meeting.attendees = scheduled_meeting.attendees
        if scheduled_meeting.status is not None:
            db_scheduled_meeting.status = scheduled_meeting.status
        if scheduled_meeting.linked_meeting_id is not None:
            db_scheduled_meeting.linked_meeting_id = scheduled_meeting.linked_meeting_id

        db.commit()
        db.refresh(db_scheduled_meeting)
    return db_scheduled_meeting


def delete_scheduled_meeting(db: Session, scheduled_meeting_id: int):
    """Delete a scheduled meeting"""
    db_scheduled_meeting = get_scheduled_meeting(db, scheduled_meeting_id)
    if db_scheduled_meeting:
        db.delete(db_scheduled_meeting)
        db.commit()
        return True
    return False


def link_meeting_to_scheduled(db: Session, meeting_id: int, scheduled_meeting_id: int):
    """Link an uploaded meeting to a scheduled meeting"""
    db_scheduled_meeting = get_scheduled_meeting(db, scheduled_meeting_id)
    if db_scheduled_meeting:
        db_scheduled_meeting.linked_meeting_id = meeting_id
        db_scheduled_meeting.status = "completed"
        db.commit()
        db.refresh(db_scheduled_meeting)
    return db_scheduled_meeting
