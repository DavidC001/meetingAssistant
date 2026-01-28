"""
External service integrations module.

This subpackage contains integrations with external services:
- Calendar generation (ICS format)
- Google Calendar sync
- Export to various formats (PDF, DOCX, JSON, etc.)

Usage:
    from app.core.integrations import create_calendar_event
    from app.core.integrations import GoogleCalendarService
    from app.core.integrations import export_meeting
"""

from .calendar import (
    generate_ics_calendar,
    parse_relative_date,
)
from .export import (
    export_meeting_data,
    export_to_docx,
    export_to_json,
    export_to_pdf,
    export_to_txt,
)
from .google_calendar import GoogleCalendarService

__all__ = [
    # Calendar
    "generate_ics_calendar",
    "parse_relative_date",
    # Google Calendar
    "GoogleCalendarService",
    # Export
    "export_to_json",
    "export_to_txt",
    "export_to_docx",
    "export_to_pdf",
    "export_meeting_data",
]
