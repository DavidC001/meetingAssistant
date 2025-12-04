from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from ..meetings.schemas import Meeting

class GoogleCalendarAuthUrl(BaseModel):
    auth_url: str

class GoogleCalendarAuthCode(BaseModel):
    code: str

class GoogleCalendarStatus(BaseModel):
    is_connected: bool
    calendar_id: Optional[str] = None
    email: Optional[str] = None

class CalendarEventSync(BaseModel):
    action_item_id: int
    sync: bool

class ScheduledMeetingBase(BaseModel):
    title: str
    description: Optional[str] = None
    scheduled_time: datetime
    duration_minutes: Optional[int] = 60
    location: Optional[str] = None
    attendees: Optional[str] = None

class ScheduledMeetingCreate(ScheduledMeetingBase):
    google_calendar_event_id: Optional[str] = None
    google_meet_link: Optional[str] = None

class ScheduledMeetingUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    scheduled_time: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    location: Optional[str] = None
    attendees: Optional[str] = None
    status: Optional[str] = None
    linked_meeting_id: Optional[int] = None

class ScheduledMeeting(ScheduledMeetingBase):
    id: int
    google_calendar_event_id: Optional[str] = None
    google_meet_link: Optional[str] = None
    status: str
    linked_meeting_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    last_synced_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class ScheduledMeetingWithLinkedMeeting(ScheduledMeeting):
    linked_meeting: Optional[Meeting] = None
    
    class Config:
        from_attributes = True
