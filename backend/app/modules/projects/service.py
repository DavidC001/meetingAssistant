"""Service layer for projects feature - Business logic.

ProjectService is the single public entry point, delegating specialized
operations (chat, notes, gantt) to focused sub-services.
"""

from __future__ import annotations

import logging
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.config import get_app_config
from app.models import ActionItem, Meeting

from . import schemas
from .models import Project, ProjectActionItem, ProjectMeeting
from .repository import (
    ProjectActionItemRepository,
    ProjectChatRepository,
    ProjectMemberRepository,
    ProjectMilestoneRepository,
    ProjectNoteAttachmentRepository,
    ProjectNoteRepository,
    ProjectRepository,
)
from .services.chat_service import ProjectChatService
from .services.gantt_service import ProjectGanttService
from .services.notes_service import ProjectNotesService

logger = logging.getLogger(__name__)


class ProjectService:
    """Service for project operations.

    Delegates chat, notes, and gantt operations to focused sub-services
    while keeping core CRUD, analytics, members, and milestones inline.
    """

    def __init__(self, db: Session):
        # Deferred: app.modules.meetings.service imports app.modules.settings.service,
        # which (via core.storage -> core.llm.tools) imports this module at the top
        # level. Importing MeetingService at module load time here would make that a
        # circular import; importing it lazily here, after both modules have finished
        # loading, breaks the cycle.
        from app.modules.meetings.service import MeetingService

        self.db = db
        self.config = get_app_config()
        self.repository = ProjectRepository(db)
        self.milestone_repository = ProjectMilestoneRepository(db)
        self.member_repository = ProjectMemberRepository(db)
        self.chat_repository = ProjectChatRepository(db)
        self.note_repository = ProjectNoteRepository(db)
        self.attachment_repository = ProjectNoteAttachmentRepository(db)
        self.pai_repo = ProjectActionItemRepository(db)
        self.meeting_service = MeetingService(db)

        # Lazy sub-services
        self._chat_svc: ProjectChatService | None = None
        self._notes_svc: ProjectNotesService | None = None
        self._gantt_svc: ProjectGanttService | None = None

    @property
    def chat_service(self) -> ProjectChatService:
        if self._chat_svc is None:
            self._chat_svc = ProjectChatService(self.db, self.chat_repository, self.repository)
        return self._chat_svc

    @property
    def notes_service(self) -> ProjectNotesService:
        if self._notes_svc is None:
            self._notes_svc = ProjectNotesService(self.db, self.note_repository, self.attachment_repository)
        return self._notes_svc

    @property
    def gantt_service(self) -> ProjectGanttService:
        if self._gantt_svc is None:
            self._gantt_svc = ProjectGanttService(self.db, self.repository, self.milestone_repository, self.pai_repo)
        return self._gantt_svc

    # =====================================================================
    #  Action Item Linking
    # =====================================================================

    def link_action_item_to_project(self, project_id: int, action_item_id: int) -> None:
        if self.pai_repo.get(project_id, action_item_id):
            raise ValueError("Action item already linked to project.")
        self.pai_repo.create(project_id, action_item_id)

    def unlink_action_item_from_project(self, project_id: int, action_item_id: int) -> None:
        pai = self.pai_repo.get(project_id, action_item_id)
        if not pai:
            raise ValueError("Action item not linked to project.")
        self.pai_repo.delete(pai)

    # =====================================================================
    #  Project CRUD
    # =====================================================================

    def list_projects(self, status: str | None = None) -> list[schemas.Project]:
        projects = self.repository.list(status)
        result = []
        for project in projects:
            meeting_ids = self._get_project_meeting_ids_list(project.id)
            project_dict = {
                "id": project.id,
                "meeting_ids": meeting_ids,
                "tags": project.tags or [],
                "name": project.name,
                "description": project.description,
                "status": project.status,
                "color": project.color,
                "icon": project.icon,
                "start_date": project.start_date,
                "target_end_date": project.target_end_date,
                "actual_end_date": project.actual_end_date,
                "created_at": project.created_at,
                "updated_at": project.updated_at,
                "settings": project.settings or {},
            }
            metrics = self._compute_project_metrics(project.id)
            project_dict.update(metrics)
            result.append(schemas.Project(**project_dict))
        return result

    def create_project(self, data: schemas.ProjectCreate) -> schemas.Project:
        if data.meeting_ids:
            existing_ids = self.repository.validate_meeting_ids(data.meeting_ids)
            missing_ids = set(data.meeting_ids) - existing_ids
            if missing_ids:
                raise HTTPException(status_code=404, detail=f"Meetings not found: {sorted(missing_ids)}")
        project_data = data.model_dump(exclude={"meeting_ids"})
        project = self.repository.create(project_data, data.meeting_ids)
        self.sync_project_members(project.id)
        return self.get_project(project.id)

    def get_project(self, project_id: int) -> schemas.Project:
        project = self.repository.get(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        meeting_ids = self._get_project_meeting_ids_list(project.id)
        project_dict = {
            "id": project.id,
            "meeting_ids": meeting_ids,
            "tags": project.tags or [],
            "name": project.name,
            "description": project.description,
            "status": project.status,
            "color": project.color,
            "icon": project.icon,
            "start_date": project.start_date,
            "target_end_date": project.target_end_date,
            "actual_end_date": project.actual_end_date,
            "created_at": project.created_at,
            "updated_at": project.updated_at,
            "settings": project.settings or {},
        }
        metrics = self._compute_project_metrics(project.id)
        project_dict.update(metrics)
        return schemas.Project(**project_dict)

    def get_project_with_details(self, project_id: int) -> schemas.ProjectWithDetails:
        project = self.repository.get_with_details(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        project_data = self.get_project(project_id).model_dump()
        project_data["milestones"] = [schemas.ProjectMilestone.model_validate(m) for m in project.milestones]
        project_data["members"] = [schemas.ProjectMember.model_validate(m) for m in project.members]
        project_data["recent_activity"] = self._get_recent_activity(project_id, limit=10)
        return schemas.ProjectWithDetails(**project_data)

    def update_project(self, project_id: int, data: schemas.ProjectUpdate) -> schemas.Project:
        project = self.repository.get(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        update_data = data.model_dump(exclude_unset=True)
        meeting_ids = update_data.pop("meeting_ids", None)
        project = self.repository.update(project, update_data)
        if meeting_ids is not None:
            if meeting_ids:
                existing_ids = self.repository.validate_meeting_ids(meeting_ids)
                missing_ids = set(meeting_ids) - existing_ids
                if missing_ids:
                    raise HTTPException(status_code=404, detail=f"Meetings not found: {sorted(missing_ids)}")
            self._sync_project_meetings(project, meeting_ids)
        return self.get_project(project_id)

    def delete_project(self, project_id: int, delete_meetings: bool = False) -> None:
        project = self.repository.get(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        if delete_meetings:
            meeting_ids = self.repository.get_meeting_ids_subquery(project.id)
            self.repository.delete_meetings_by_ids(meeting_ids)
        self.repository.delete(project)

    # =====================================================================
    #  Project Meetings
    # =====================================================================

    def get_project_meetings(
        self,
        project_id: int,
        status: str | None = None,
        sort_by: str = "date",
        sort_order: str = "desc",
    ) -> list[dict]:
        project = self.repository.get(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        meetings = self.repository.get_meetings_by_project(
            project_id, status=status, sort_by=sort_by, sort_order=sort_order
        )
        return [self._meeting_to_dict(m) for m in meetings]

    def add_meeting_to_project(self, project_id: int, meeting_id: int) -> dict:
        project = self.repository.get(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        meeting = self.repository.get_meeting_by_id(meeting_id)
        if not meeting:
            raise HTTPException(status_code=404, detail="Meeting not found")
        existing = self.repository.check_meeting_in_project(project_id, meeting_id)
        if existing:
            raise HTTPException(status_code=409, detail="Meeting already linked to project")
        self.db.add(ProjectMeeting(project_id=project_id, meeting_id=meeting_id))
        self.db.commit()
        self._apply_project_tags_to_meetings(project, [meeting_id])
        return {"project_id": project_id, "meeting_id": meeting_id}

    def remove_meeting_from_project(self, project_id: int, meeting_id: int) -> None:
        project = self.repository.get(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        deleted = self.repository.remove_meeting_link(project_id, meeting_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Meeting not linked to project")

    # =====================================================================
    #  Action Items
    # =====================================================================

    def get_project_action_items(
        self, project_id: int, status: str | None = None, owner: str | None = None
    ) -> list[dict]:
        project = self.repository.get(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        action_items = self.repository.get_project_linked_action_items(project_id, status=status, owner=owner)
        result = []
        for item in action_items:
            item_dict = {
                "id": item.id,
                "transcription_id": item.transcription_id,
                "owner": item.owner,
                "task": item.task,
                "start_date": item.start_date,
                "due_date": item.due_date,
                "status": item.status,
                "priority": item.priority,
                "notes": item.notes,
            }
            if item.transcription:
                meeting = item.transcription.meeting
                if meeting:
                    item_dict["meeting_id"] = meeting.id
                    item_dict["meeting_filename"] = meeting.filename
                    item_dict["meeting_title"] = meeting.title or meeting.filename
                    item_dict["meeting_date"] = meeting.meeting_date
            result.append(item_dict)
        return result

    def create_project_action_item(self, project_id: int, data: schemas.ProjectActionItemCreate) -> ActionItem:
        project = self.repository.get(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        if data.meeting_id:
            meeting = self.repository.get_project_meetings_query(project_id, data_meeting_id=data.meeting_id)
            if not meeting:
                raise HTTPException(status_code=404, detail="Meeting not found in project")
        else:
            meeting = self.repository.get_project_meetings_query(project_id)
        if not meeting:
            raise HTTPException(status_code=400, detail="No meetings available to attach action item")
        transcription = self.meeting_service.ensure_transcription_for_meeting(meeting.id)
        start_date = data.start_date
        due_date_value = data.due_date
        if isinstance(due_date_value, datetime):
            due_date_value = due_date_value.isoformat()
        owner = data.owner
        if not owner:
            owner = (project.settings or {}).get("default_action_item_owner")
        item = ActionItem(
            transcription_id=transcription.id,
            task=data.task,
            owner=owner,
            start_date=start_date,
            due_date=due_date_value,
            status=data.status or "pending",
            priority=data.priority,
            notes=data.notes,
            is_manual=True,
        )
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        try:
            self.link_action_item_to_project(project_id, item.id)
        except ValueError:
            pass
        return item

    # =====================================================================
    #  Analytics
    # =====================================================================

    def get_project_analytics(self, project_id: int) -> schemas.ProjectAnalytics:
        project = self.repository.get(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        meetings = self.repository.get_meetings_by_project(project_id)
        total_meetings = len(meetings)
        total_duration_minutes = 0.0
        for meeting in meetings:
            duration_minutes = self._get_meeting_duration_minutes(meeting)
            if duration_minutes and duration_minutes > 0:
                total_duration_minutes += float(duration_minutes)
        total_duration_hours = round(total_duration_minutes / 60.0, 2)
        action_items = self.repository.get_all_action_items_by_project(project_id)
        total_action_items = len(action_items)
        status_counts = Counter([item.status or "pending" for item in action_items])
        completed_action_items = status_counts.get("completed", 0)
        pending_action_items = total_action_items - completed_action_items
        now = datetime.now(timezone.utc)
        overdue_action_items = 0
        owner_counts: Counter[str] = Counter()
        for item in action_items:
            owner_label = (item.owner or "Unassigned").strip() or "Unassigned"
            owner_counts[owner_label] += 1
            if item.status == "completed":
                continue
            due_date = self._parse_datetime(item.due_date)
            if due_date and due_date < now:
                overdue_action_items += 1
        unique_participants = self.repository.count_distinct_speakers_by_project(project_id)
        meetings_by_month = self._group_meetings_by_month(meetings)
        action_items_by_status = dict(status_counts)
        action_items_by_owner = [{"owner": owner, "count": count} for owner, count in owner_counts.most_common(10)]
        milestones = self.milestone_repository.list_by_project(project_id)
        milestone_total = len(milestones)
        milestone_completed = len([m for m in milestones if m.status == "completed"])
        milestone_missed = len([m for m in milestones if m.status != "completed" and m.due_date and m.due_date < now])
        milestone_pending = milestone_total - milestone_completed
        milestone_progress = {
            "total": milestone_total,
            "completed": milestone_completed,
            "pending": milestone_pending,
            "missed": milestone_missed,
            "completion_rate": (round((milestone_completed / milestone_total) * 100, 2) if milestone_total else 0.0),
        }
        activity_trend = self._build_activity_trend(meetings)
        return schemas.ProjectAnalytics(
            project_id=project_id,
            total_meetings=total_meetings,
            total_duration_hours=total_duration_hours,
            total_action_items=total_action_items,
            completed_action_items=completed_action_items,
            pending_action_items=pending_action_items,
            overdue_action_items=overdue_action_items,
            unique_participants=unique_participants,
            meetings_by_month=meetings_by_month,
            action_items_by_status=action_items_by_status,
            action_items_by_owner=action_items_by_owner,
            milestone_progress=milestone_progress,
            activity_trend=activity_trend,
        )

    def get_project_activity(self, project_id: int, limit: int = 50) -> list[schemas.ActivityItem]:
        project = self.repository.get(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        return self._get_recent_activity(project_id, limit=limit)

    # =====================================================================
    #  Chat (delegated)
    # =====================================================================

    async def chat_with_project(
        self, project_id: int, request: schemas.ProjectChatRequest
    ) -> schemas.ProjectChatResponse:
        project = self.repository.get(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        meeting_ids = self._get_project_meeting_ids(project)
        return await self.chat_service.chat_with_project(project_id, request, meeting_ids)

    def get_chat_sessions(self, project_id: int) -> list[schemas.ProjectChatSession]:
        self.get_project(project_id)
        return self.chat_service.list_sessions(project_id)

    def create_chat_session(
        self, project_id: int, session_data: schemas.ProjectChatSessionCreate
    ) -> schemas.ProjectChatSession:
        self.get_project(project_id)
        return self.chat_service.create_session(project_id, session_data)

    def update_chat_session(
        self, project_id: int, session_id: int, payload: schemas.ProjectChatSessionUpdate
    ) -> schemas.ProjectChatSession:
        self.get_project(project_id)
        return self.chat_service.update_session(project_id, session_id, payload)

    def get_chat_messages(self, project_id: int, session_id: int) -> list[schemas.ProjectChatMessage]:
        self.get_project(project_id)
        return self.chat_service.list_messages(project_id, session_id)

    def delete_chat_session(self, project_id: int, session_id: int) -> None:
        self.get_project(project_id)
        self.chat_service.delete_session(project_id, session_id)

    # =====================================================================
    #  Notes (delegated)
    # =====================================================================

    def get_project_notes(self, project_id: int) -> list[schemas.ProjectNote]:
        self.get_project(project_id)
        return self.notes_service.list_notes(project_id)

    def get_project_note(self, project_id: int, note_id: int):
        self.get_project(project_id)
        return self.notes_service.get_note(project_id, note_id)

    def create_note(self, project_id: int, note: schemas.ProjectNoteCreate) -> schemas.ProjectNote:
        self.get_project(project_id)
        return self.notes_service.create_note(project_id, note)

    def update_note(self, project_id: int, note_id: int, update: schemas.ProjectNoteUpdate) -> schemas.ProjectNote:
        return self.notes_service.update_note(project_id, note_id, update)

    def delete_note(self, project_id: int, note_id: int) -> None:
        self.notes_service.delete_note(project_id, note_id)

    def list_note_attachments(self, project_id: int, note_id: int) -> list[schemas.ProjectNoteAttachment]:
        return self.notes_service.list_attachments(project_id, note_id)

    def get_note_attachment(self, attachment_id: int):
        return self.notes_service.get_attachment(attachment_id)

    async def upload_note_attachment(
        self,
        project_id: int,
        note_id: int,
        file: UploadFile,
        description: str | None = None,
    ) -> schemas.ProjectNoteAttachment:
        return await self.notes_service.upload_attachment(project_id, note_id, file, description)

    def update_note_attachment_description(self, attachment_id: int, description: str) -> schemas.ProjectNoteAttachment:
        return self.notes_service.update_attachment_description(attachment_id, description)

    def delete_note_attachment(self, attachment_id: int) -> None:
        self.notes_service.delete_attachment(attachment_id)

    # =====================================================================
    #  Members
    # =====================================================================

    def sync_project_members(self, project_id: int) -> list[schemas.ProjectMember]:
        try:
            project = self.repository.get(project_id)
            if not project:
                raise HTTPException(status_code=404, detail="Project not found")
            speakers = self.repository.get_speaker_names_by_project(project_id)
            self.member_repository.delete_auto_detected(project_id)
            members = []
            for speaker_name in speakers:
                if speaker_name and speaker_name.strip():
                    try:
                        member = self.member_repository.create(
                            project_id, {"name": speaker_name, "is_auto_detected": True}
                        )
                        members.append(schemas.ProjectMember.model_validate(member))
                    except Exception:
                        pass
            return members
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to sync members: {str(e)}")

    def get_project_members(self, project_id: int) -> list[schemas.ProjectMember]:
        self.get_project(project_id)
        members = self.member_repository.list_by_project(project_id)
        return [schemas.ProjectMember.model_validate(m) for m in members]

    def add_project_member(self, project_id: int, member: schemas.ProjectMemberCreate) -> schemas.ProjectMember:
        self.get_project(project_id)
        member_data = member.model_dump()
        member_data["is_auto_detected"] = False
        new_member = self.member_repository.create(project_id, member_data)
        return schemas.ProjectMember.model_validate(new_member)

    def update_project_member(
        self, project_id: int, member_id: int, update: schemas.ProjectMemberUpdate
    ) -> schemas.ProjectMember:
        self.get_project(project_id)
        member = self.member_repository.get(member_id)
        if not member or member.project_id != project_id:
            raise HTTPException(status_code=404, detail="Member not found")
        updated_member = self.member_repository.update(member, update.model_dump(exclude_unset=True))
        return schemas.ProjectMember.model_validate(updated_member)

    def remove_project_member(self, project_id: int, member_id: int) -> None:
        self.get_project(project_id)
        member = self.member_repository.get(member_id)
        if not member or member.project_id != project_id:
            raise HTTPException(status_code=404, detail="Member not found")
        self.member_repository.delete(member)

    # =====================================================================
    #  Milestones
    # =====================================================================

    def get_project_milestones(self, project_id: int) -> list[schemas.ProjectMilestone]:
        self.get_project(project_id)
        milestones = self.milestone_repository.list_by_project(project_id)
        return [schemas.ProjectMilestone.model_validate(m) for m in milestones]

    def create_milestone(self, project_id: int, milestone: schemas.ProjectMilestoneCreate) -> schemas.ProjectMilestone:
        self.get_project(project_id)
        new_milestone = self.milestone_repository.create(project_id, milestone.model_dump())
        return schemas.ProjectMilestone.model_validate(new_milestone)

    def update_milestone(
        self, project_id: int, milestone_id: int, update: schemas.ProjectMilestoneUpdate
    ) -> schemas.ProjectMilestone:
        self.get_project(project_id)
        milestone = self.milestone_repository.get(milestone_id)
        if not milestone or milestone.project_id != project_id:
            raise HTTPException(status_code=404, detail="Milestone not found")
        updated_milestone = self.milestone_repository.update(milestone, update.model_dump(exclude_unset=True))
        return schemas.ProjectMilestone.model_validate(updated_milestone)

    def complete_milestone(self, project_id: int, milestone_id: int) -> schemas.ProjectMilestone:
        self.get_project(project_id)
        milestone = self.milestone_repository.get(milestone_id)
        if not milestone or milestone.project_id != project_id:
            raise HTTPException(status_code=404, detail="Milestone not found")
        completed_milestone = self.milestone_repository.complete(milestone)
        return schemas.ProjectMilestone.model_validate(completed_milestone)

    def delete_milestone(self, project_id: int, milestone_id: int) -> None:
        self.get_project(project_id)
        milestone = self.milestone_repository.get(milestone_id)
        if not milestone or milestone.project_id != project_id:
            raise HTTPException(status_code=404, detail="Milestone not found")
        self.milestone_repository.delete(milestone)

    # =====================================================================
    #  Gantt (delegated)
    # =====================================================================

    def get_gantt_data(self, project_id: int) -> schemas.GanttData:
        return self.gantt_service.get_gantt_data(project_id)

    def add_gantt_link(self, project_id: int, source: str, target: str, link_type: str = "e2s") -> schemas.GanttLink:
        return self.gantt_service.add_link(project_id, source, target, link_type)

    def delete_gantt_link(self, project_id: int, link_id: str) -> None:
        self.gantt_service.delete_link(project_id, link_id)

    def update_gantt_item(self, project_id: int, item_id: str, update: schemas.GanttItemUpdate) -> schemas.GanttItem:
        return self.gantt_service.update_item(project_id, item_id, update)

    # =====================================================================
    #  Export
    # =====================================================================

    def get_project_export_data(self, project_id: int) -> dict:
        project = self.repository.get(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        project_schema = self.get_project(project_id)
        meetings = self.get_project_meetings(project_id)
        action_items = self.get_project_action_items(project_id)
        milestones = self.milestone_repository.list_by_project(project_id)
        members = self.member_repository.list_by_project(project_id)
        notes = self.note_repository.list_by_project(project_id)

        milestones_data = [
            {
                "id": m.id,
                "name": m.name,
                "description": m.description,
                "due_date": m.due_date,
                "completed_at": m.completed_at,
                "status": m.status,
                "color": m.color,
                "created_at": m.created_at,
                "updated_at": m.updated_at,
            }
            for m in milestones
        ]
        members_data = [
            {
                "id": m.id,
                "name": m.name,
                "email": m.email,
                "role": m.role,
                "is_auto_detected": m.is_auto_detected,
                "added_at": m.added_at,
            }
            for m in members
        ]
        notes_data = []
        for note in notes:
            attachments = self.attachment_repository.list_by_note(note.id)
            notes_data.append(
                {
                    "id": note.id,
                    "title": note.title,
                    "content": note.content or "",
                    "pinned": note.pinned,
                    "created_at": note.created_at,
                    "updated_at": note.updated_at,
                    "attachments": [
                        {
                            "id": a.id,
                            "filename": a.filename,
                            "description": a.description,
                            "file_size": a.file_size,
                            "uploaded_at": a.uploaded_at,
                        }
                        for a in attachments
                    ],
                }
            )

        return {
            "project": {
                "id": project_schema.id,
                "name": project_schema.name,
                "description": project_schema.description,
                "status": project_schema.status,
                "color": project_schema.color,
                "icon": project_schema.icon,
                "meeting_ids": project_schema.meeting_ids,
                "tags": project_schema.tags,
                "start_date": project_schema.start_date,
                "target_end_date": project_schema.target_end_date,
                "actual_end_date": project_schema.actual_end_date,
                "created_at": project_schema.created_at,
                "updated_at": project_schema.updated_at,
                "settings": project_schema.settings,
            },
            "metrics": {
                "meeting_count": project_schema.meeting_count,
                "action_item_count": project_schema.action_item_count,
                "completed_action_items": project_schema.completed_action_items,
                "member_count": project_schema.member_count,
                "milestone_count": len(milestones_data),
            },
            "meetings": meetings,
            "action_items": action_items,
            "milestones": milestones_data,
            "members": members_data,
            "notes": notes_data,
        }

    # =====================================================================
    #  Tag Sync
    # =====================================================================

    def sync_meeting_to_projects_by_tags(self, meeting_id: int) -> None:
        meeting = self.repository.get_meeting_by_id(meeting_id)
        if not meeting:
            logger.warning(f"Meeting {meeting_id} not found for tag sync")
            return

        meeting_tags: set[str] = set()
        if meeting.tags:
            if isinstance(meeting.tags, str):
                meeting_tags = {t.strip().lower() for t in meeting.tags.split(",") if t.strip()}
            elif isinstance(meeting.tags, list):
                meeting_tags = {str(t).strip().lower() for t in meeting.tags if t}
            elif isinstance(meeting.tags, dict):
                meeting_tags = {str(v).strip().lower() for v in meeting.tags.values() if v}

        logger.info(f"Syncing meeting {meeting_id} with tags {meeting_tags} to projects")
        all_projects = self.repository.list(status="active")
        projects_to_link: set[int] = set()

        for project in all_projects:
            if not project.tags:
                continue
            project_tags: set[str] = set()
            if isinstance(project.tags, list):
                project_tags = {str(t).strip().lower() for t in project.tags if t}
            elif isinstance(project.tags, str):
                project_tags = {project.tags.strip().lower()}
            if not project_tags:
                continue
            if meeting_tags & project_tags:
                projects_to_link.add(project.id)

        currently_linked_ids = set(self.repository.get_project_ids_for_meeting(meeting_id))
        action_items = self.repository.get_action_items_by_meeting(meeting_id)

        for project_id in projects_to_link - currently_linked_ids:
            self.db.add(ProjectMeeting(project_id=project_id, meeting_id=meeting_id))
            logger.info(f"Created project_meeting link: project {project_id} <-> meeting {meeting_id}")
            for ai in action_items:
                if not self.pai_repo.get(project_id, ai.id):
                    self.db.add(ProjectActionItem(project_id=project_id, action_item_id=ai.id))

        for project_id in currently_linked_ids - projects_to_link:
            self.repository.remove_meeting_link(project_id, meeting_id)
            logger.info(f"Removed stale project_meeting link: project {project_id} <-> meeting {meeting_id}")
            for ai in action_items:
                existing_ai = self.pai_repo.get(project_id, ai.id)
                if existing_ai:
                    self.db.delete(existing_ai)

        self.db.commit()
        logger.info(
            f"Tag sync complete for meeting {meeting_id}: "
            f"linked to {len(projects_to_link)} projects, "
            f"removed {len(currently_linked_ids - projects_to_link)} stale links"
        )

    # =====================================================================
    #  Private Helpers
    # =====================================================================

    def _get_project_meeting_ids_subquery(self, project_id: int):
        return self.repository.get_meeting_ids_subquery(project_id)

    def _get_project_meeting_ids_list(self, project_id: int) -> list[int]:
        return self.repository.get_meeting_ids_list(project_id)

    def _get_project_meeting_ids(self, project: Project) -> list[int]:
        return self.repository.get_completed_meeting_ids(project.id)

    def _sync_project_meetings(self, project: Project, meeting_ids: list[int]) -> None:
        existing_ids = set(self.repository.get_meeting_ids_list(project.id))
        self.repository.sync_meetings(project, meeting_ids)
        new_ids = set(meeting_ids) - existing_ids
        if new_ids:
            self._apply_project_tags_to_meetings(project, list(new_ids))

    def _apply_project_tags_to_meetings(self, project: Project, meeting_ids: list[int]) -> None:
        if not project.tags or not meeting_ids:
            return
        project_tags_set = {str(t).strip() for t in project.tags if t and str(t).strip()}
        if not project_tags_set:
            return
        for meeting_id in meeting_ids:
            meeting = self.repository.get_meeting_by_id(meeting_id)
            if not meeting:
                continue
            existing_tags: set[str] = set()
            if meeting.tags and isinstance(meeting.tags, str):
                existing_tags = {t.strip() for t in meeting.tags.split(",") if t.strip()}
            new_tags = existing_tags | project_tags_set
            meeting.tags = ", ".join(sorted(new_tags))
        self.db.commit()

    def _parse_datetime(self, value: str | datetime | None) -> datetime | None:
        if not value:
            return None
        if isinstance(value, datetime):
            return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        if isinstance(value, str):
            try:
                from dateutil.parser import parse

                parsed = parse(value)
                return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
            except Exception:
                return None
        return None

    def _group_meetings_by_month(self, meetings: list[Meeting]) -> list[dict]:
        counts: dict[str, int] = defaultdict(int)
        for meeting in meetings:
            date_value = meeting.meeting_date or meeting.created_at
            if not date_value:
                continue
            key = date_value.strftime("%Y-%m")
            counts[key] += 1
        return [{"month": month, "count": counts[month]} for month in sorted(counts.keys())]

    def _build_activity_trend(self, meetings: list[Meeting]) -> list[dict]:
        counts = defaultdict(int)
        now = datetime.now(timezone.utc)
        for meeting in meetings:
            date_value = meeting.meeting_date or meeting.created_at
            if not date_value:
                continue
            month_key = date_value.strftime("%Y-%m")
            counts[month_key] += 1
        trend = []
        for i in range(5, -1, -1):
            month_date = now.replace(day=1) - timedelta(days=30 * i)
            month_key = month_date.strftime("%Y-%m")
            trend.append({"month": month_key, "count": counts.get(month_key, 0)})
        return trend

    def _compute_project_metrics(self, project_id: int) -> dict:
        return {
            "meeting_count": self.repository.count_meetings_by_project(project_id),
            "action_item_count": self.repository.count_action_items_by_project(project_id),
            "completed_action_items": self.repository.count_action_items_by_project(project_id, status="completed"),
            "member_count": len(self.member_repository.list_by_project(project_id)),
        }

    def _get_recent_activity(self, project_id: int, limit: int = 50) -> list[schemas.ActivityItem]:
        activities = []
        recent_meetings = self.repository.get_recent_meetings_by_project(project_id, limit=limit)
        for meeting in recent_meetings:
            activities.append(
                schemas.ActivityItem(
                    type="meeting_added",
                    timestamp=meeting.created_at,
                    description=f"Meeting '{meeting.title or meeting.filename}' added",
                    metadata={"meeting_id": meeting.id, "filename": meeting.filename},
                )
            )
        milestones = self.milestone_repository.list_by_project(project_id)
        for milestone in milestones:
            if milestone.completed_at:
                activities.append(
                    schemas.ActivityItem(
                        type="milestone_completed",
                        timestamp=milestone.completed_at,
                        description=f"Milestone '{milestone.name}' completed",
                        metadata={"milestone_id": milestone.id, "name": milestone.name},
                    )
                )
        activities.sort(key=lambda x: x.timestamp, reverse=True)
        return activities[:limit]

    def _meeting_to_dict(self, meeting: Meeting) -> dict:
        speakers = [s.name for s in meeting.speakers if s.name]
        action_items_count = 0
        if meeting.transcription and meeting.transcription.action_items:
            action_items_count = len(meeting.transcription.action_items)
        duration_minutes = self._get_meeting_duration_minutes(meeting)
        return {
            "id": meeting.id,
            "filename": meeting.filename,
            "title": meeting.title or meeting.filename,
            "filepath": meeting.filepath,
            "status": meeting.status,
            "created_at": meeting.created_at,
            "meeting_date": meeting.meeting_date,
            "folder": meeting.folder,
            "tags": meeting.tags,
            "notes": meeting.notes,
            "duration": duration_minutes,
            "speakers": speakers,
            "action_items_count": action_items_count,
        }

    def _get_meeting_duration_minutes(self, meeting: Meeting) -> float | None:
        if meeting.estimated_duration and meeting.estimated_duration > 0:
            return float(meeting.estimated_duration)
        timing = self.repository.get_diarization_timing_for_meeting(meeting.id)
        if timing and timing.audio_duration_seconds and timing.audio_duration_seconds > 0:
            return round(float(timing.audio_duration_seconds) / 60.0, 2)
        return None
