from sqlalchemy.orm import Session

from . import models


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
