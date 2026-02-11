from pydantic import BaseModel


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
