"""Repository layer for projects feature - Database operations."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, selectinload

from .models import (
    Project,
    ProjectChatMessage,
    ProjectChatSession,
    ProjectMeeting,
    ProjectMember,
    ProjectMilestone,
    ProjectNote,
    ProjectNoteAttachment,
)


class ProjectRepository:
    """Repository for Project operations."""

    def __init__(self, db: Session):
        self.db = db

    def get(self, project_id: int) -> Project | None:
        """Get project by ID."""
        return self.db.query(Project).filter(Project.id == project_id).first()

    def list(self, status: str | None = None) -> list[Project]:
        """List all projects, optionally filtered by status."""
        query = self.db.query(Project)
        if status:
            query = query.filter(Project.status == status)
        return query.order_by(Project.created_at.desc()).all()

    def create(self, data: dict, meeting_ids: list[int]) -> Project:
        """Create a new project with associated meetings."""
        project_data = {k: v for k, v in data.items() if k != "meeting_ids"}
        project = Project(**project_data)
        self.db.add(project)
        self.db.flush()

        for meeting_id in meeting_ids:
            self.db.add(ProjectMeeting(project_id=project.id, meeting_id=meeting_id))

        self.db.commit()
        self.db.refresh(project)
        return project

    def add_meeting(self, project: Project, meeting_id: int) -> ProjectMeeting:
        """Add a meeting to a project."""
        project_meeting = ProjectMeeting(project_id=project.id, meeting_id=meeting_id)
        self.db.add(project_meeting)
        self.db.commit()
        self.db.refresh(project_meeting)
        return project_meeting

    def remove_meeting(self, project: Project, meeting_id: int) -> bool:
        """Remove a meeting from a project."""
        result = (
            self.db.query(ProjectMeeting)
            .filter(ProjectMeeting.project_id == project.id, ProjectMeeting.meeting_id == meeting_id)
            .delete()
        )
        self.db.commit()
        return result > 0

    def update(self, project: Project, data: dict) -> Project:
        """Update project fields."""
        for key, value in data.items():
            if value is not None:
                setattr(project, key, value)
        project.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(project)
        return project

    def delete(self, project: Project) -> None:
        """Delete a project."""
        self.db.delete(project)
        self.db.commit()

    def get_with_details(self, project_id: int) -> Project | None:
        """Get project with all related entities loaded."""
        return (
            self.db.query(Project)
            .options(
                selectinload(Project.project_meetings),
                selectinload(Project.milestones),
                selectinload(Project.members),
                selectinload(Project.notes),
            )
            .filter(Project.id == project_id)
            .first()
        )


class ProjectMilestoneRepository:
    """Repository for ProjectMilestone operations."""

    def __init__(self, db: Session):
        self.db = db

    def get(self, milestone_id: int) -> ProjectMilestone | None:
        """Get milestone by ID."""
        return self.db.query(ProjectMilestone).filter(ProjectMilestone.id == milestone_id).first()

    def list_by_project(self, project_id: int) -> list[ProjectMilestone]:
        """List all milestones for a project."""
        return (
            self.db.query(ProjectMilestone)
            .filter(ProjectMilestone.project_id == project_id)
            .order_by(ProjectMilestone.due_date.asc())
            .all()
        )

    def create(self, project_id: int, data: dict) -> ProjectMilestone:
        """Create a new milestone."""
        milestone = ProjectMilestone(project_id=project_id, **data)
        self.db.add(milestone)
        self.db.commit()
        self.db.refresh(milestone)
        return milestone

    def update(self, milestone: ProjectMilestone, data: dict) -> ProjectMilestone:
        """Update milestone fields."""
        for key, value in data.items():
            if value is not None:
                setattr(milestone, key, value)
        milestone.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(milestone)
        return milestone

    def complete(self, milestone: ProjectMilestone) -> ProjectMilestone:
        """Mark milestone as completed."""
        milestone.status = "completed"
        milestone.completed_at = datetime.utcnow()
        milestone.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(milestone)
        return milestone

    def delete(self, milestone: ProjectMilestone) -> None:
        """Delete a milestone."""
        self.db.delete(milestone)
        self.db.commit()


class ProjectMemberRepository:
    """Repository for ProjectMember operations."""

    def __init__(self, db: Session):
        self.db = db

    def get(self, member_id: int) -> ProjectMember | None:
        """Get member by ID."""
        return self.db.query(ProjectMember).filter(ProjectMember.id == member_id).first()

    def list_by_project(self, project_id: int) -> list[ProjectMember]:
        """List all members for a project."""
        return (
            self.db.query(ProjectMember)
            .filter(ProjectMember.project_id == project_id)
            .order_by(ProjectMember.added_at.asc())
            .all()
        )

    def get_by_name(self, project_id: int, name: str) -> ProjectMember | None:
        """Get member by project and name."""
        return (
            self.db.query(ProjectMember)
            .filter(and_(ProjectMember.project_id == project_id, ProjectMember.name == name))
            .first()
        )

    def create(self, project_id: int, data: dict) -> ProjectMember:
        """Create a new member."""
        member = ProjectMember(project_id=project_id, **data)
        self.db.add(member)
        self.db.commit()
        self.db.refresh(member)
        return member

    def update(self, member: ProjectMember, data: dict) -> ProjectMember:
        """Update member fields."""
        for key, value in data.items():
            if value is not None:
                setattr(member, key, value)
        self.db.commit()
        self.db.refresh(member)
        return member

    def delete(self, member: ProjectMember) -> None:
        """Delete a member."""
        self.db.delete(member)
        self.db.commit()

    def delete_auto_detected(self, project_id: int) -> None:
        """Delete all auto-detected members for a project."""
        self.db.query(ProjectMember).filter(
            and_(ProjectMember.project_id == project_id, ProjectMember.is_auto_detected == True)
        ).delete()
        self.db.commit()


class ProjectChatRepository:
    """Repository for project chat operations."""

    def __init__(self, db: Session):
        self.db = db

    def get_session(self, session_id: int) -> ProjectChatSession | None:
        """Get chat session by ID."""
        return self.db.query(ProjectChatSession).filter(ProjectChatSession.id == session_id).first()

    def list_sessions(self, project_id: int) -> list[ProjectChatSession]:
        """List all chat sessions for a project."""
        return (
            self.db.query(ProjectChatSession)
            .filter(ProjectChatSession.project_id == project_id)
            .order_by(ProjectChatSession.updated_at.desc())
            .all()
        )

    def create_session(self, project_id: int, title: str = "New chat") -> ProjectChatSession:
        """Create a new chat session."""
        session = ProjectChatSession(project_id=project_id, title=title)
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    def update_session(self, session: ProjectChatSession, title: str | None = None) -> ProjectChatSession:
        """Update a chat session."""
        if title is not None:
            session.title = title
        session.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(session)
        return session

    def delete_session(self, session: ProjectChatSession) -> None:
        """Delete a chat session."""
        self.db.delete(session)
        self.db.commit()

    def create_message(
        self, session_id: int, role: str, content: str, sources: dict | None = None
    ) -> ProjectChatMessage:
        """Create a new chat message."""
        message = ProjectChatMessage(session_id=session_id, role=role, content=content, sources=sources)
        self.db.add(message)

        # Update session timestamp
        session = self.get_session(session_id)
        if session:
            session.updated_at = datetime.utcnow()

        try:
            self.db.commit()
            self.db.refresh(message)
            return message
        except Exception:
            self.db.rollback()
            raise

    def list_messages(self, session_id: int) -> list[ProjectChatMessage]:
        """List all messages in a chat session."""
        return (
            self.db.query(ProjectChatMessage)
            .filter(ProjectChatMessage.session_id == session_id)
            .order_by(ProjectChatMessage.created_at.asc())
            .all()
        )


class ProjectNoteRepository:
    """Repository for ProjectNote operations."""

    def __init__(self, db: Session):
        self.db = db

    def get(self, note_id: int) -> ProjectNote | None:
        """Get note by ID."""
        return self.db.query(ProjectNote).filter(ProjectNote.id == note_id).first()

    def list_by_project(self, project_id: int) -> list[ProjectNote]:
        """List all notes for a project."""
        return (
            self.db.query(ProjectNote)
            .filter(ProjectNote.project_id == project_id)
            .order_by(ProjectNote.pinned.desc(), ProjectNote.updated_at.desc())
            .all()
        )

    def create(self, project_id: int, data: dict) -> ProjectNote:
        """Create a new note."""
        note = ProjectNote(project_id=project_id, **data)
        self.db.add(note)
        self.db.commit()
        self.db.refresh(note)
        return note

    def update(self, note: ProjectNote, data: dict) -> ProjectNote:
        """Update note fields."""
        for key, value in data.items():
            if value is not None:
                setattr(note, key, value)
        note.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(note)
        return note

    def delete(self, note: ProjectNote) -> None:
        """Delete a note."""
        self.db.delete(note)
        self.db.commit()


class ProjectNoteAttachmentRepository:
    """Repository for ProjectNoteAttachment operations."""

    def __init__(self, db: Session):
        self.db = db

    def get(self, attachment_id: int) -> ProjectNoteAttachment | None:
        return self.db.query(ProjectNoteAttachment).filter(ProjectNoteAttachment.id == attachment_id).first()

    def list_by_note(self, note_id: int) -> list[ProjectNoteAttachment]:
        return (
            self.db.query(ProjectNoteAttachment)
            .filter(ProjectNoteAttachment.note_id == note_id)
            .order_by(ProjectNoteAttachment.uploaded_at.desc())
            .all()
        )

    def create(self, project_id: int, note_id: int, data: dict) -> ProjectNoteAttachment:
        attachment = ProjectNoteAttachment(project_id=project_id, note_id=note_id, **data)
        self.db.add(attachment)
        self.db.commit()
        self.db.refresh(attachment)
        return attachment

    def update(self, attachment: ProjectNoteAttachment, data: dict) -> ProjectNoteAttachment:
        for key, value in data.items():
            if value is not None:
                setattr(attachment, key, value)
        self.db.commit()
        self.db.refresh(attachment)
        return attachment

    def delete(self, attachment: ProjectNoteAttachment) -> None:
        self.db.delete(attachment)
        self.db.commit()
