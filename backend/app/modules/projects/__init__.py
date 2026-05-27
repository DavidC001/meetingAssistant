"""
Projects module for managing project-enhanced folders.

Usage:
    from app.modules.projects import ProjectService
    service = ProjectService(db)
    projects = service.list_projects()
"""

from .service import ProjectService
from .services.chat_service import ProjectChatService
from .services.gantt_service import ProjectGanttService
from .services.notes_service import ProjectNotesService

__all__ = [
    "ProjectService",
    "ProjectChatService",
    "ProjectGanttService",
    "ProjectNotesService",
]
