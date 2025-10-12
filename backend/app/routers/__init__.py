"""
Routers package for the Meeting Assistant API.
"""

from . import meetings, settings, admin, ollama, calendar, global_chat, scheduled_meetings

__all__ = ['meetings', 'settings', 'admin', 'ollama', 'calendar', 'global_chat', 'scheduled_meetings']
