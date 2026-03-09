"""Repository layer for projects feature - Database operations."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models import ActionItem, DiarizationTiming, Meeting, MeetingStatus, Speaker, Transcription

from .models import (
    Project,
    ProjectActionItem,
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

    # -------------------------------------------------------------------------
    # Meeting ID helpers
    # -------------------------------------------------------------------------

    def get_meeting_ids_subquery(self, project_id: int):
        """Return a SQLAlchemy subquery of meeting IDs for a project."""
        return self.db.query(ProjectMeeting.meeting_id).filter(ProjectMeeting.project_id == project_id).subquery()

    def get_meeting_ids_list(self, project_id: int) -> list[int]:
        """Return a plain list of meeting IDs for a project."""
        rows = self.db.query(ProjectMeeting.meeting_id).filter(ProjectMeeting.project_id == project_id).all()
        return [row[0] for row in rows]

    def get_project_ids_for_meeting(self, meeting_id: int) -> list[int]:
        """Return a plain list of project IDs that are linked to a given meeting."""
        rows = self.db.query(ProjectMeeting.project_id).filter(ProjectMeeting.meeting_id == meeting_id).all()
        return [row[0] for row in rows]

    def get_completed_meeting_ids(self, project_id: int) -> list[int]:
        """Return IDs of COMPLETED meetings linked to a project."""
        meeting_ids = self.get_meeting_ids_subquery(project_id)
        results = (
            self.db.query(Meeting.id)
            .filter(
                Meeting.id.in_(meeting_ids),
                Meeting.status == MeetingStatus.COMPLETED.value,
            )
            .all()
        )
        return [row[0] for row in results]

    # -------------------------------------------------------------------------
    # Meeting validation / CRUD helpers
    # -------------------------------------------------------------------------

    def validate_meeting_ids(self, meeting_ids: list[int]) -> set[int]:
        """Return the subset of meeting_ids that actually exist in the DB."""
        rows = self.db.query(Meeting.id).filter(Meeting.id.in_(meeting_ids)).all()
        return {row[0] for row in rows}

    def delete_meetings_by_ids(self, meeting_ids) -> None:
        """Bulk-delete meetings matching a list/subquery of IDs."""
        self.db.query(Meeting).filter(Meeting.id.in_(meeting_ids)).delete(synchronize_session=False)
        self.db.commit()

    def get_meeting_by_id(self, meeting_id: int) -> Meeting | None:
        """Get a single Meeting record by primary key."""
        return self.db.query(Meeting).filter(Meeting.id == meeting_id).first()

    def get_meetings_by_ids(self, meeting_ids) -> list[Meeting]:
        """Get Meeting records filtered by a list or subquery of IDs."""
        return self.db.query(Meeting).filter(Meeting.id.in_(meeting_ids)).all()

    def get_meetings_by_project(
        self,
        project_id: int,
        status: str | None = None,
        sort_by: str = "date",
        sort_order: str = "desc",
    ) -> list[Meeting]:
        """Get project meetings with optional status filter and sorting."""
        meeting_ids = self.get_meeting_ids_subquery(project_id)
        query = self.db.query(Meeting).filter(Meeting.id.in_(meeting_ids))
        if status:
            query = query.filter(Meeting.status == status)
        order_col = Meeting.meeting_date if sort_by == "date" else Meeting.created_at
        query = query.order_by(order_col.desc()) if sort_order == "desc" else query.order_by(order_col.asc())
        return query.all()

    def get_dated_meetings_by_project(self, project_id: int) -> list[Meeting]:
        """Get project meetings that have a meeting_date set, ordered by date asc."""
        meeting_ids = self.get_meeting_ids_subquery(project_id)
        return (
            self.db.query(Meeting)
            .filter(Meeting.id.in_(meeting_ids), Meeting.meeting_date.isnot(None))
            .order_by(Meeting.meeting_date)
            .all()
        )

    def get_recent_meetings_by_project(self, project_id: int, limit: int = 50) -> list[Meeting]:
        """Get most recently created meetings in a project."""
        meeting_ids = self.get_meeting_ids_subquery(project_id)
        return (
            self.db.query(Meeting)
            .filter(Meeting.id.in_(meeting_ids))
            .order_by(Meeting.created_at.desc())
            .limit(limit)
            .all()
        )

    def get_project_meetings_query(self, project_id: int, data_meeting_id: int | None = None) -> Meeting | None:
        """Get the best meeting for a project action item creation."""
        meeting_ids = self.get_meeting_ids_subquery(project_id)
        query = self.db.query(Meeting).filter(Meeting.id.in_(meeting_ids))
        if data_meeting_id:
            return query.filter(Meeting.id == data_meeting_id).first()
        return query.order_by(Meeting.meeting_date.desc().nullslast(), Meeting.created_at.desc()).first()

    # -------------------------------------------------------------------------
    # ProjectMeeting link helpers
    # -------------------------------------------------------------------------

    def check_meeting_in_project(self, project_id: int, meeting_id: int) -> ProjectMeeting | None:
        """Return the ProjectMeeting link if it exists, else None."""
        return (
            self.db.query(ProjectMeeting)
            .filter(
                ProjectMeeting.project_id == project_id,
                ProjectMeeting.meeting_id == meeting_id,
            )
            .first()
        )

    def remove_meeting_link(self, project_id: int, meeting_id: int) -> int:
        """Delete a project–meeting link. Returns number of deleted rows."""
        result = (
            self.db.query(ProjectMeeting)
            .filter(
                ProjectMeeting.project_id == project_id,
                ProjectMeeting.meeting_id == meeting_id,
            )
            .delete()
        )
        self.db.commit()
        return result

    def sync_meetings(self, project: Project, meeting_ids: list[int]) -> None:
        """Synchronise project meetings to exactly the given list."""
        existing_ids = set(self.get_meeting_ids_list(project.id))
        desired_ids = set(meeting_ids)
        to_add = desired_ids - existing_ids
        to_remove = existing_ids - desired_ids
        for mid in to_add:
            self.db.add(ProjectMeeting(project_id=project.id, meeting_id=mid))
        if to_remove:
            (
                self.db.query(ProjectMeeting)
                .filter(
                    ProjectMeeting.project_id == project.id,
                    ProjectMeeting.meeting_id.in_(to_remove),
                )
                .delete(synchronize_session=False)
            )
        self.db.commit()
        self.db.refresh(project)

    # -------------------------------------------------------------------------
    # Cross-module analytics
    # -------------------------------------------------------------------------

    def count_meetings_by_project(self, project_id: int) -> int:
        """Count meetings linked to a project."""
        meeting_ids = self.get_meeting_ids_subquery(project_id)
        return self.db.query(func.count(Meeting.id)).filter(Meeting.id.in_(meeting_ids)).scalar() or 0

    def count_action_items_by_project(self, project_id: int, status: str | None = None) -> int:
        """Count action items from meetings in a project, optionally filtered by status."""
        meeting_ids = self.get_meeting_ids_subquery(project_id)
        query = (
            self.db.query(func.count(ActionItem.id))
            .join(Transcription, ActionItem.transcription_id == Transcription.id)
            .filter(Transcription.meeting_id.in_(meeting_ids))
        )
        if status:
            query = query.filter(ActionItem.status == status)
        return query.scalar() or 0

    def count_distinct_speakers_by_project(self, project_id: int) -> int:
        """Count distinct speaker names across all project meetings."""
        meeting_ids = self.get_meeting_ids_subquery(project_id)
        return (
            self.db.query(func.count(func.distinct(Speaker.name)))
            .join(Meeting, Speaker.meeting_id == Meeting.id)
            .filter(Meeting.id.in_(meeting_ids), Speaker.name.isnot(None))
            .scalar()
            or 0
        )

    def get_all_action_items_by_project(self, project_id: int) -> list[ActionItem]:
        """Get all action items from meetings in a project."""
        meeting_ids = self.get_meeting_ids_subquery(project_id)
        return (
            self.db.query(ActionItem)
            .join(Transcription, ActionItem.transcription_id == Transcription.id)
            .filter(Transcription.meeting_id.in_(meeting_ids))
            .all()
        )

    def get_action_items_by_meeting(self, meeting_id: int) -> list[ActionItem]:
        """Get all action items from a specific meeting."""
        return (
            self.db.query(ActionItem)
            .join(Transcription, ActionItem.transcription_id == Transcription.id)
            .filter(Transcription.meeting_id == meeting_id)
            .all()
        )

    def get_project_linked_action_items(
        self, project_id: int, status: str | None = None, owner: str | None = None
    ) -> list[ActionItem]:
        """Get action items linked to a project via ProjectActionItem."""
        query = (
            self.db.query(ActionItem)
            .join(ProjectActionItem, ProjectActionItem.action_item_id == ActionItem.id)
            .filter(ProjectActionItem.project_id == project_id)
        )
        if status:
            query = query.filter(ActionItem.status == status)
        if owner:
            query = query.filter(ActionItem.owner.ilike(f"%{owner}%"))
        return query.all()

    def get_speaker_names_by_project(self, project_id: int) -> list[str]:
        """Get distinct non-null speaker names from a project's meetings."""
        meeting_ids = self.get_meeting_ids_subquery(project_id)
        rows = (
            self.db.query(Speaker.name)
            .join(Meeting, Speaker.meeting_id == Meeting.id)
            .filter(Meeting.id.in_(meeting_ids), Speaker.name.isnot(None))
            .distinct()
            .all()
        )
        return [row[0] for row in rows]

    def get_diarization_timing_for_meeting(self, meeting_id: int) -> DiarizationTiming | None:
        """Get the most recent diarization timing record for a meeting."""
        return (
            self.db.query(DiarizationTiming)
            .filter(DiarizationTiming.meeting_id == meeting_id)
            .order_by(DiarizationTiming.created_at.desc())
            .first()
        )

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


class ProjectActionItemRepository:
    """Repository for ProjectActionItem (project ↔ action item links)."""

    def __init__(self, db: Session):
        self.db = db

    def get(self, project_id: int, action_item_id: int) -> ProjectActionItem | None:
        """Return the link if it exists, else None."""
        return self.db.query(ProjectActionItem).filter_by(project_id=project_id, action_item_id=action_item_id).first()

    def create(self, project_id: int, action_item_id: int) -> ProjectActionItem:
        """Create a project–action-item link."""
        pai = ProjectActionItem(project_id=project_id, action_item_id=action_item_id)
        self.db.add(pai)
        self.db.commit()
        return pai

    def delete(self, pai: ProjectActionItem) -> None:
        """Remove a project–action-item link."""
        self.db.delete(pai)
        self.db.commit()

    def get_action_item(self, action_item_id: int) -> ActionItem | None:
        """Convenience: get the ActionItem by primary key."""
        return self.db.query(ActionItem).filter(ActionItem.id == action_item_id).first()
