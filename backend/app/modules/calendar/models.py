from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    Text,
    Boolean
)
from sqlalchemy.sql import func
from ...database import Base

class GoogleCalendarCredentials(Base):
    __tablename__ = "google_calendar_credentials"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, default="default")
    credentials_json = Column(Text)
    calendar_id = Column(String, default="primary")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class ScheduledMeeting(Base):
    __tablename__ = "scheduled_meetings"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    scheduled_time = Column(DateTime(timezone=True), nullable=False)
    duration_minutes = Column(Integer, default=60)
    location = Column(String, nullable=True)
    attendees = Column(Text, nullable=True)
