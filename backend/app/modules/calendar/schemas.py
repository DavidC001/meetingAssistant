from datetime import datetime

from pydantic import BaseModel

from ..meetings.schemas import Meeting


class GoogleCalendarAuthUrl(BaseModel):
    auth_url: str


class GoogleCalendarAuthCode(BaseModel):
    code: str


class GoogleCalendarStatus(BaseModel):
    is_connected: bool
    calendar_id: str | None = None
    email: str | None = None


class CalendarEventSync(BaseModel):
    action_item_id: int
    sync: bool


class ScheduledMeetingBase(BaseModel):
    title: str
    description: str | None = None
    scheduled_time: datetime
    duration_minutes: int | None = 60
    location: str | None = None
    attendees: str | None = None


class ScheduledMeetingCreate(ScheduledMeetingBase):
    google_calendar_event_id: str | None = None
    google_meet_link: str | None = None


class ScheduledMeetingUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    scheduled_time: datetime | None = None
    duration_minutes: int | None = None
    location: str | None = None
    attendees: str | None = None
    status: str | None = None
    linked_meeting_id: int | None = None


class ScheduledMeeting(ScheduledMeetingBase):
    id: int
    google_calendar_event_id: str | None = None
    google_meet_link: str | None = None
    status: str
    linked_meeting_id: int | None = None
    created_at: datetime
    updated_at: datetime
    last_synced_at: datetime | None = None

    class Config:
        from_attributes = True


class ScheduledMeetingWithLinkedMeeting(ScheduledMeeting):
    linked_meeting: Meeting | None = None

    class Config:
        from_attributes = True
