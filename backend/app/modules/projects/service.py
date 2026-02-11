"""Service layer for projects feature - Business logic."""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from app.core.llm import chat as llm_chat
from app.core.llm.providers import ProviderFactory
from app.core.storage import rag
from app.models import ActionItem, DiarizationTiming, Meeting, MeetingStatus, Speaker, Transcription
from app.modules.meetings.repository import ActionItemRepository, TranscriptionRepository
from app.modules.settings import crud as settings_crud

from . import schemas
from .models import Project, ProjectActionItem, ProjectMeeting, ProjectMember, ProjectMilestone
from .repository import (
    ProjectChatRepository,
    ProjectMemberRepository,
    ProjectMilestoneRepository,
    ProjectNoteAttachmentRepository,
    ProjectNoteRepository,
    ProjectRepository,
)


class ProjectService:
    """Service for project operations."""

    def __init__(self, db: Session):
        self.db = db
        self.repository = ProjectRepository(db)
        self.milestone_repository = ProjectMilestoneRepository(db)
        self.member_repository = ProjectMemberRepository(db)
        self.chat_repository = ProjectChatRepository(db)
        self.note_repository = ProjectNoteRepository(db)

    def link_action_item_to_project(self, project_id: int, action_item_id: int) -> None:
        """Link an existing action item to a project. Raises ValueError if already linked."""
        from .models import ProjectActionItem

        exists = (
            self.db.query(ProjectActionItem).filter_by(project_id=project_id, action_item_id=action_item_id).first()
        )
        if exists:
            raise ValueError("Action item already linked to project.")
        pai = ProjectActionItem(project_id=project_id, action_item_id=action_item_id)
        self.db.add(pai)
        self.db.commit()

    def unlink_action_item_from_project(self, project_id: int, action_item_id: int) -> None:
        """Unlink an action item from a project. Raises ValueError if not linked."""
        from .models import ProjectActionItem

        pai = self.db.query(ProjectActionItem).filter_by(project_id=project_id, action_item_id=action_item_id).first()
        if not pai:
            raise ValueError("Action item not linked to project.")
        self.db.delete(pai)
        self.db.commit()

    def list_projects(self, status: str | None = None) -> list[schemas.Project]:
        """List all projects with computed metrics."""
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

            # Compute metrics
            metrics = self._compute_project_metrics(project.id)
            project_dict.update(metrics)

            result.append(schemas.Project(**project_dict))

        return result

    def create_project(self, data: schemas.ProjectCreate) -> schemas.Project:
        """Create a new project from meeting links."""
        if data.meeting_ids:
            meeting_rows = self.db.query(Meeting.id).filter(Meeting.id.in_(data.meeting_ids)).all()
            existing_ids = {row[0] for row in meeting_rows}
            missing_ids = set(data.meeting_ids) - existing_ids
            if missing_ids:
                raise HTTPException(status_code=404, detail=f"Meetings not found: {sorted(missing_ids)}")

        project_data = data.model_dump(exclude={"meeting_ids"})
        project = self.repository.create(project_data, data.meeting_ids)

        # Auto-sync members from meetings
        self.sync_project_members(project.id)

        # Return with metrics
        return self.get_project(project.id)

    def get_project(self, project_id: int) -> schemas.Project:
        """Get project by ID with metrics."""
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
        """Get project with full details."""
        project = self.repository.get_with_details(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        project_data = self.get_project(project_id).model_dump()

        # Add relationships
        project_data["milestones"] = [schemas.ProjectMilestone.model_validate(m) for m in project.milestones]
        project_data["members"] = [schemas.ProjectMember.model_validate(m) for m in project.members]
        project_data["recent_activity"] = self._get_recent_activity(project_id, limit=10)

        return schemas.ProjectWithDetails(**project_data)

    def update_project(self, project_id: int, data: schemas.ProjectUpdate) -> schemas.Project:
        """Update project."""
        project = self.repository.get(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        update_data = data.model_dump(exclude_unset=True)
        meeting_ids = update_data.pop("meeting_ids", None)
        project = self.repository.update(project, update_data)

        if meeting_ids is not None:
            if meeting_ids:
                meeting_rows = self.db.query(Meeting.id).filter(Meeting.id.in_(meeting_ids)).all()
                existing_ids = {row[0] for row in meeting_rows}
                missing_ids = set(meeting_ids) - existing_ids
                if missing_ids:
                    raise HTTPException(status_code=404, detail=f"Meetings not found: {sorted(missing_ids)}")

            self._sync_project_meetings(project, meeting_ids)

        return self.get_project(project_id)

    def delete_project(self, project_id: int, delete_meetings: bool = False) -> None:
        """Delete project and optionally its meetings."""
        project = self.repository.get(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        if delete_meetings:
            meeting_ids = self._get_project_meeting_ids_subquery(project.id)
            self.db.query(Meeting).filter(Meeting.id.in_(meeting_ids)).delete(synchronize_session=False)
            self.db.commit()

        self.repository.delete(project)

    def get_project_meetings(
        self, project_id: int, status: str | None = None, sort_by: str = "date", sort_order: str = "desc"
    ) -> list[dict]:
        """Get all meetings in the project."""
        project = self.repository.get(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        meeting_ids = self._get_project_meeting_ids_subquery(project.id)
        query = self.db.query(Meeting).filter(Meeting.id.in_(meeting_ids))

        if status:
            query = query.filter(Meeting.status == status)

        # Sort
        if sort_by == "date":
            order_col = Meeting.meeting_date if Meeting.meeting_date else Meeting.created_at
        elif sort_by == "created":
            order_col = Meeting.created_at
        else:
            order_col = Meeting.created_at

        query = query.order_by(order_col.desc()) if sort_order == "desc" else query.order_by(order_col.asc())

        meetings = query.all()

        # Convert to dict for response
        return [self._meeting_to_dict(m) for m in meetings]

    def add_meeting_to_project(self, project_id: int, meeting_id: int) -> dict:
        """Link a meeting to a project."""
        project = self.repository.get(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        meeting = self.db.query(Meeting).filter(Meeting.id == meeting_id).first()
        if not meeting:
            raise HTTPException(status_code=404, detail="Meeting not found")

        existing = (
            self.db.query(ProjectMeeting)
            .filter(ProjectMeeting.project_id == project_id, ProjectMeeting.meeting_id == meeting_id)
            .first()
        )
        if existing:
            raise HTTPException(status_code=409, detail="Meeting already linked to project")

        self.db.add(ProjectMeeting(project_id=project_id, meeting_id=meeting_id))
        self.db.commit()
        return {"project_id": project_id, "meeting_id": meeting_id}

    def remove_meeting_from_project(self, project_id: int, meeting_id: int) -> None:
        """Unlink a meeting from a project."""
        project = self.repository.get(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        deleted = (
            self.db.query(ProjectMeeting)
            .filter(ProjectMeeting.project_id == project_id, ProjectMeeting.meeting_id == meeting_id)
            .delete()
        )
        if not deleted:
            raise HTTPException(status_code=404, detail="Meeting not linked to project")

        self.db.commit()

    def get_project_action_items(
        self, project_id: int, status: str | None = None, owner: str | None = None
    ) -> list[dict]:
        """Get all action items linked to this project via project_action_items."""
        from .models import ProjectActionItem

        project = self.repository.get(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        query = (
            self.db.query(ActionItem)
            .join(ProjectActionItem, ProjectActionItem.action_item_id == ActionItem.id)
            .filter(ProjectActionItem.project_id == project_id)
        )
        if status:
            query = query.filter(ActionItem.status == status)
        if owner:
            query = query.filter(ActionItem.owner.ilike(f"%{owner}%"))

        action_items = query.all()

        # Add meeting info to each action item (if available)
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

            # Get meeting info through transcription
            if item.transcription:
                meeting = item.transcription.meeting
                if meeting:
                    item_dict["meeting_id"] = meeting.id
                    item_dict["meeting_filename"] = meeting.filename
                    item_dict["meeting_title"] = meeting.filename  # Frontend expects meeting_title
                    item_dict["meeting_date"] = meeting.meeting_date

            result.append(item_dict)

        return result

    def get_project_analytics(self, project_id: int) -> schemas.ProjectAnalytics:
        """Get analytics metrics for a project."""
        project = self.repository.get(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        meeting_ids = self._get_project_meeting_ids_subquery(project.id)
        meetings_query = self.db.query(Meeting).filter(Meeting.id.in_(meeting_ids))
        meetings = meetings_query.all()
        total_meetings = len(meetings)

        total_duration_minutes = 0.0
        for meeting in meetings:
            duration_minutes = self._get_meeting_duration_minutes(meeting)
            if duration_minutes and duration_minutes > 0:
                total_duration_minutes += float(duration_minutes)

        total_duration_hours = round(total_duration_minutes / 60.0, 2)

        action_items_query = (
            self.db.query(ActionItem)
            .join(Transcription, ActionItem.transcription_id == Transcription.id)
            .filter(Transcription.meeting_id.in_(meeting_ids))
        )

        action_items = action_items_query.all()
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

        unique_participants = (
            self.db.query(func.count(func.distinct(Speaker.name)))
            .join(Meeting, Speaker.meeting_id == Meeting.id)
            .filter(Meeting.id.in_(meeting_ids), Speaker.name.isnot(None))
            .scalar()
            or 0
        )

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
            "completion_rate": round((milestone_completed / milestone_total) * 100, 2) if milestone_total else 0.0,
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
        """Get recent activity feed for a project."""
        project = self.repository.get(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        return self._get_recent_activity(project_id, limit=limit)

    async def chat_with_project(
        self, project_id: int, request: schemas.ProjectChatRequest
    ) -> schemas.ProjectChatResponse:
        """Chat with AI about a project (RAG over all project meetings)."""
        project = self.repository.get(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        session_id = request.session_id
        if session_id:
            session = self.chat_repository.get_session(session_id)
            if not session or session.project_id != project_id:
                raise HTTPException(status_code=404, detail="Chat session not found")
        else:
            title = (request.message or "New chat").strip()
            if len(title) > 60:
                title = f"{title[:57]}..."
            session = self.chat_repository.create_session(project_id, title=title or "New chat")
            session_id = session.id

        if session.title in (None, "", "New chat"):
            existing_messages = self.chat_repository.list_messages(session_id)
            if not existing_messages:
                title_candidate = await self._generate_chat_title(request.message)
                self.chat_repository.update_session(session, title=title_candidate)

        # Persist user message first
        self.chat_repository.create_message(session_id, role="user", content=request.message)

        meeting_ids = self._get_project_meeting_ids(project)
        history_messages = self.chat_repository.list_messages(session_id)
        chat_history = [{"role": message.role, "content": message.content} for message in history_messages[-6:]]

        model_config = settings_crud.get_default_model_configuration(self.db)
        llm_config = None
        if model_config:
            llm_config = llm_chat.model_config_to_llm_config(model_config, use_analysis=False)

        system_prompt_override = (project.settings or {}).get("chat_preferences", {}).get("system_prompt_override")
        if isinstance(system_prompt_override, str):
            system_prompt_override = system_prompt_override.strip() or None
        else:
            system_prompt_override = None

        response_text, sources, follow_ups = await rag.generate_project_rag_response(
            self.db,
            query=request.message,
            project_id=project_id,
            meeting_ids=meeting_ids,
            chat_history=chat_history,
            top_k=5,
            llm_config=llm_config,
            system_prompt_override=system_prompt_override,
        )

        self.chat_repository.create_message(
            session_id,
            role="assistant",
            content=response_text,
            sources=sources,
        )

        return schemas.ProjectChatResponse(
            session_id=session_id,
            message=response_text,
            sources=sources,
            follow_up_suggestions=follow_ups or [],
        )

    async def _generate_chat_title(self, message: str) -> str:
        title_fallback = (message or "").strip()
        if not title_fallback:
            return "New chat"
        if len(title_fallback) > 60:
            title_fallback = f"{title_fallback[:57]}..."

        try:
            model_config = settings_crud.get_default_model_configuration(self.db)
            llm_config = None
            if model_config:
                llm_config = llm_chat.model_config_to_llm_config(model_config, use_analysis=False)
            if llm_config is None:
                llm_config = llm_chat.get_default_chat_config()

            provider = ProviderFactory.create_provider(llm_config)
            system_prompt = (
                "Create a short, descriptive chat title (3-6 words). "
                "Return only the title, no quotes or punctuation."
            )
            response = await provider.chat_completion(
                messages=[{"role": "user", "content": message}],
                system_prompt=system_prompt,
            )
            if isinstance(response, dict):
                response = response.get("message", "")
            title = (response or "").strip().strip('"').strip("'")
            if not title:
                return title_fallback
            if len(title) > 60:
                return f"{title[:57]}..."
            return title
        except Exception:
            return title_fallback

    def _get_project_meeting_ids_subquery(self, project_id: int):
        return self.db.query(ProjectMeeting.meeting_id).filter(ProjectMeeting.project_id == project_id).subquery()

    def _get_project_meeting_ids_list(self, project_id: int) -> list[int]:
        rows = self.db.query(ProjectMeeting.meeting_id).filter(ProjectMeeting.project_id == project_id).all()
        return [row[0] for row in rows]

    def _get_project_meeting_ids(self, project: Project) -> list[int]:
        """Get completed meeting IDs for a project."""
        meeting_ids = self._get_project_meeting_ids_subquery(project.id)
        results = (
            self.db.query(Meeting.id)
            .filter(Meeting.id.in_(meeting_ids))
            .filter(Meeting.status == MeetingStatus.COMPLETED.value)
            .all()
        )
        return [row[0] for row in results]

    def _sync_project_meetings(self, project: Project, meeting_ids: list[int]) -> None:
        existing_ids = set(self._get_project_meeting_ids_list(project.id))
        desired_ids = set(meeting_ids)

        to_add = desired_ids - existing_ids
        to_remove = existing_ids - desired_ids

        for meeting_id in to_add:
            self.db.add(ProjectMeeting(project_id=project.id, meeting_id=meeting_id))

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
        """Build a 6-month rolling activity trend based on meetings."""
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

    def sync_meeting_to_projects_by_tags(self, meeting_id: int) -> None:
        """Auto-link a meeting to projects based on matching tags and sync action items."""
        import logging

        logger = logging.getLogger(__name__)

        meeting = self.db.query(Meeting).filter(Meeting.id == meeting_id).first()
        if not meeting:
            logger.warning(f"Meeting {meeting_id} not found for tag sync")
            return

        # Parse meeting tags - stored as comma-separated string
        meeting_tags = []
        if meeting.tags:
            if isinstance(meeting.tags, str):
                # Parse comma-separated string, normalize to lowercase
                meeting_tags = [t.strip().lower() for t in meeting.tags.split(",") if t.strip()]
            elif isinstance(meeting.tags, list):
                meeting_tags = [str(t).strip().lower() for t in meeting.tags if t]
            elif isinstance(meeting.tags, dict):
                # Extract tag values if it's a dict
                meeting_tags = [str(v).strip().lower() for v in meeting.tags.values() if v]

        if not meeting_tags:
            logger.info(f"Meeting {meeting_id} has no tags, skipping project sync")
            return

        logger.info(f"Syncing meeting {meeting_id} with tags {meeting_tags} to projects")

        # Find all projects with matching tags
        all_projects = self.repository.list(status="active")
        matched_projects = 0

        for project in all_projects:
            if not project.tags:
                continue

            # Parse project tags - stored as JSON array
            project_tags = []
            if isinstance(project.tags, list):
                project_tags = [str(t).strip().lower() for t in project.tags if t]
            elif isinstance(project.tags, str):
                project_tags = [project.tags.strip().lower()]

            if not project_tags:
                continue

            # Check for partial or exact matches (case-insensitive)
            # Meeting tag "UKC" should match project tag "UKC_concepts_thesis"
            matched = False
            for meeting_tag in meeting_tags:
                for project_tag in project_tags:
                    if meeting_tag in project_tag or project_tag in meeting_tag:
                        matched = True
                        break
                if matched:
                    break

            if matched:
                matched_projects += 1
                logger.info(f"Linking meeting {meeting_id} to project {project.id} ({project.name})")

                # Link meeting to project if not already linked
                existing = self.db.query(ProjectMeeting).filter_by(project_id=project.id, meeting_id=meeting_id).first()
                if not existing:
                    self.db.add(ProjectMeeting(project_id=project.id, meeting_id=meeting_id))
                    logger.info(f"Created project_meeting link: project {project.id} <-> meeting {meeting_id}")

                # Also link all action items from this meeting to the project
                action_items = (
                    self.db.query(ActionItem)
                    .join(Transcription, ActionItem.transcription_id == Transcription.id)
                    .filter(Transcription.meeting_id == meeting_id)
                    .all()
                )

                logger.info(f"Found {len(action_items)} action items for meeting {meeting_id}")

                for action_item in action_items:
                    existing_ai = (
                        self.db.query(ProjectActionItem)
                        .filter_by(project_id=project.id, action_item_id=action_item.id)
                        .first()
                    )
                    if not existing_ai:
                        self.db.add(ProjectActionItem(project_id=project.id, action_item_id=action_item.id))
                        logger.info(f"Linked action item {action_item.id} to project {project.id}")

        self.db.commit()
        logger.info(f"Tag sync complete for meeting {meeting_id}: linked to {matched_projects} projects")

    def sync_project_members(self, project_id: int) -> list[schemas.ProjectMember]:
        """Auto-detect and sync members from meeting speakers."""
        try:
            project = self.repository.get(project_id)
            if not project:
                raise HTTPException(status_code=404, detail="Project not found")

            # Get all unique speakers from project meetings
            meeting_ids = self._get_project_meeting_ids_subquery(project.id)
            speakers = (
                self.db.query(Speaker.name)
                .join(Meeting, Speaker.meeting_id == Meeting.id)
                .filter(Meeting.id.in_(meeting_ids), Speaker.name.isnot(None))
                .distinct()
                .all()
            )

            # Remove old auto-detected members
            self.member_repository.delete_auto_detected(project_id)

            # Add new auto-detected members
            members = []
            for (speaker_name,) in speakers:
                if speaker_name and speaker_name.strip():
                    try:
                        member = self.member_repository.create(
                            project_id, {"name": speaker_name, "is_auto_detected": True}
                        )
                        members.append(schemas.ProjectMember.model_validate(member))
                    except Exception:
                        # Skip duplicates
                        pass

            return members
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to sync members: {str(e)}")

    def _compute_project_metrics(self, project_id: int) -> dict:
        """Compute metrics for a project."""
        meeting_ids = self._get_project_meeting_ids_subquery(project_id)
        meeting_count = self.db.query(func.count(Meeting.id)).filter(Meeting.id.in_(meeting_ids)).scalar() or 0

        action_item_count = (
            self.db.query(func.count(ActionItem.id))
            .join(Transcription, ActionItem.transcription_id == Transcription.id)
            .filter(Transcription.meeting_id.in_(meeting_ids))
            .scalar()
            or 0
        )

        completed_action_items = (
            self.db.query(func.count(ActionItem.id))
            .join(Transcription, ActionItem.transcription_id == Transcription.id)
            .filter(Transcription.meeting_id.in_(meeting_ids), ActionItem.status == "completed")
            .scalar()
            or 0
        )

        # Member count
        member_count = self.member_repository.list_by_project(project_id).__len__()

        return {
            "meeting_count": meeting_count,
            "action_item_count": action_item_count,
            "completed_action_items": completed_action_items,
            "member_count": member_count,
        }

    def _get_recent_activity(self, project_id: int, limit: int = 50) -> list[schemas.ActivityItem]:
        """Generate recent activity feed."""
        activities = []

        # Recent meetings
        meeting_ids = self._get_project_meeting_ids_subquery(project_id)
        recent_meetings = (
            self.db.query(Meeting)
            .filter(Meeting.id.in_(meeting_ids))
            .order_by(Meeting.created_at.desc())
            .limit(limit)
            .all()
        )

        for meeting in recent_meetings:
            activities.append(
                schemas.ActivityItem(
                    type="meeting_added",
                    timestamp=meeting.created_at,
                    description=f"Meeting '{meeting.filename}' added",
                    metadata={"meeting_id": meeting.id, "filename": meeting.filename},
                )
            )

        # Recent milestones
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

        # Sort by timestamp
        activities.sort(key=lambda x: x.timestamp, reverse=True)

        return activities[:limit]

    def get_project_export_data(self, project_id: int) -> dict:
        """Build export data for a project report."""
        project = self.repository.get(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        project_schema = self.get_project(project_id)
        meetings = self.get_project_meetings(project_id)
        action_items = self.get_project_action_items(project_id)
        milestones = self.milestone_repository.list_by_project(project_id)
        members = self.member_repository.list_by_project(project_id)
        notes = self.note_repository.list_by_project(project_id)
        attachment_repo = ProjectNoteAttachmentRepository(self.db)

        milestones_data = [
            {
                "id": milestone.id,
                "name": milestone.name,
                "description": milestone.description,
                "due_date": milestone.due_date,
                "completed_at": milestone.completed_at,
                "status": milestone.status,
                "color": milestone.color,
                "created_at": milestone.created_at,
                "updated_at": milestone.updated_at,
            }
            for milestone in milestones
        ]

        members_data = [
            {
                "id": member.id,
                "name": member.name,
                "email": member.email,
                "role": member.role,
                "is_auto_detected": member.is_auto_detected,
                "added_at": member.added_at,
            }
            for member in members
        ]

        notes_data = []
        for note in notes:
            attachments = attachment_repo.list_by_note(note.id)
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
                            "id": attachment.id,
                            "filename": attachment.filename,
                            "description": attachment.description,
                            "file_size": attachment.file_size,
                            "uploaded_at": attachment.uploaded_at,
                        }
                        for attachment in attachments
                    ],
                }
            )

        export_data = {
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

        return export_data

    def _meeting_to_dict(self, meeting: Meeting) -> dict:
        """Convert Meeting object to dict for response."""
        speakers = [speaker.name for speaker in meeting.speakers if speaker.name]
        action_items_count = 0
        if meeting.transcription and meeting.transcription.action_items:
            action_items_count = len(meeting.transcription.action_items)
        duration_minutes = self._get_meeting_duration_minutes(meeting)
        return {
            "id": meeting.id,
            "filename": meeting.filename,
            "title": meeting.filename,  # Title is same as filename
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

        timing = (
            self.db.query(DiarizationTiming)
            .filter(DiarizationTiming.meeting_id == meeting.id)
            .order_by(DiarizationTiming.created_at.desc())
            .first()
        )
        if timing and timing.audio_duration_seconds and timing.audio_duration_seconds > 0:
            return round(float(timing.audio_duration_seconds) / 60.0, 2)

        return None

    def get_gantt_data(self, project_id: int) -> schemas.GanttData:
        """Build Gantt chart data from meetings, milestones, and action items."""
        try:
            project = self.repository.get(project_id)
            if not project:
                raise HTTPException(status_code=404, detail="Project not found")

            settings = project.settings or {}
            links_raw = settings.get("gantt_links", []) or []
            normalized_links: list[dict] = []
            settings_changed = False

            for link in links_raw:
                if not isinstance(link, dict):
                    continue
                source = link.get("source")
                target = link.get("target")
                if not source or not target:
                    continue
                link_id = link.get("id") or uuid4().hex
                link_type = link.get("type") or "e2s"
                if link_id != link.get("id") or link_type != link.get("type"):
                    settings_changed = True
                normalized_links.append(
                    {"id": str(link_id), "source": str(source), "target": str(target), "type": link_type}
                )

            if settings_changed:
                settings["gantt_links"] = normalized_links
                project.settings = settings
                self.db.commit()
                self.db.refresh(project)

            dependency_map: dict[str, list[str]] = {}
            for link in normalized_links:
                dependency_map.setdefault(link["target"], []).append(link["source"])

            meeting_ids = self._get_project_meeting_ids_subquery(project.id)

            gantt_items = []

            # Add meetings to Gantt (only those with meeting_date set)
            meetings = (
                self.db.query(Meeting)
                .filter(
                    Meeting.id.in_(meeting_ids),
                    Meeting.meeting_date.isnot(None),  # Only meetings with dates
                )
                .order_by(Meeting.meeting_date)
                .all()
            )

            for meeting in meetings:
                # Calculate end date based on duration (if available)
                end_date = meeting.meeting_date
                if meeting.estimated_duration and meeting.estimated_duration > 0:
                    # estimated_duration is in MINUTES, convert to timedelta
                    # (Originally thought to be seconds, but metadata extraction divides by 60)
                    end_date = meeting.meeting_date + timedelta(minutes=meeting.estimated_duration)

                gantt_items.append(
                    schemas.GanttItem(
                        id=f"meeting-{meeting.id}",
                        name=meeting.filename or f"Meeting {meeting.id}",
                        type="meeting",
                        start_date=meeting.meeting_date,
                        end_date=end_date,
                        progress=1.0,  # Meetings are always complete
                        dependencies=dependency_map.get(f"meeting-{meeting.id}", []),
                        color="#4CAF50",
                        metadata={"meeting_id": meeting.id, "folder": meeting.folder, "status": meeting.status},
                    )
                )

            # Add milestones to Gantt
            milestones = self.milestone_repository.list_by_project(project_id)
            for milestone in milestones:
                progress = 1.0 if milestone.status == "completed" else 0.0
                color = "#9C27B0" if milestone.status == "completed" else "#FF9800"

                # Use due_date or created_at
                milestone_date = milestone.due_date or milestone.created_at

                gantt_items.append(
                    schemas.GanttItem(
                        id=f"milestone-{milestone.id}",
                        name=milestone.name,
                        type="milestone",
                        start_date=milestone_date,
                        end_date=milestone_date,
                        progress=progress,
                        dependencies=dependency_map.get(f"milestone-{milestone.id}", []),
                        color=milestone.color or color,
                        metadata={
                            "milestone_id": milestone.id,
                            "status": milestone.status,
                            "completed_at": milestone.completed_at.isoformat() if milestone.completed_at else None,
                        },
                    )
                )

            # Add action items to Gantt
            action_items = self.get_project_action_items(project_id)
            # We need Meeting info for action items to set start_date correctly
            # get_project_action_items returns dicts, check if it has meeting_date

            for item in action_items:
                # Determine start date
                start_date = None

                # Prefer explicit action item start_date
                if item.get("start_date"):
                    if isinstance(item["start_date"], datetime):
                        start_date = item["start_date"]
                    elif isinstance(item["start_date"], str):
                        from dateutil.parser import parse

                        try:
                            start_date = parse(item["start_date"])
                        except Exception:
                            pass

                # Fallback to meeting_date as start date
                if not start_date and item.get("meeting_date"):
                    if isinstance(item["meeting_date"], datetime):
                        start_date = item["meeting_date"]
                    elif isinstance(item["meeting_date"], str):
                        from dateutil.parser import parse

                        try:
                            start_date = parse(item["meeting_date"])
                        except Exception:
                            pass

                # Determine due date (end date)
                due_date_raw = item.get("due_date")
                due_date = None

                if due_date_raw:
                    if isinstance(due_date_raw, datetime):
                        due_date = due_date_raw
                    elif isinstance(due_date_raw, str):
                        from dateutil.parser import parse

                        try:
                            due_date = parse(due_date_raw)
                        except Exception:
                            pass

                # Skip if we have neither dates
                if not start_date and not due_date:
                    continue

                # Fill missing dates
                from datetime import timezone

                if start_date and not due_date:
                    # Default: 1 week duration if no due date
                    due_date = start_date + timedelta(days=7)
                elif due_date and not start_date:
                    # Default: start 1 week before due date
                    start_date = due_date - timedelta(days=7)

                # Ensure timezone awareness
                if start_date.tzinfo is None:
                    start_date = start_date.replace(tzinfo=timezone.utc)
                if due_date.tzinfo is None:
                    due_date = due_date.replace(tzinfo=timezone.utc)

                task_text = item.get("task") or item.get("description") or "Action Item"
                progress = (
                    1.0 if item.get("status") == "completed" else 0.5 if item.get("status") == "in_progress" else 0.0
                )
                color_map = {
                    "completed": "#4CAF50",
                    "in_progress": "#2196F3",
                    "pending": "#FFC107",
                    "cancelled": "#9E9E9E",
                }

                gantt_items.append(
                    schemas.GanttItem(
                        id=f"action-{item.get('id')}",
                        name=task_text,
                        type="action_item",
                        start_date=start_date,
                        end_date=due_date,
                        progress=progress,
                        dependencies=dependency_map.get(f"action-{item.get('id')}", []),
                        color=color_map.get(item.get("status", "pending"), "#FFC107"),
                        metadata={
                            "action_item_id": item.get("id"),
                            "meeting_id": item.get("meeting_id"),
                            "status": item.get("status"),
                            "priority": item.get("priority"),
                            "owner": item.get("owner"),
                            "task": task_text,
                            "notes": item.get("notes"),
                            "meeting_title": item.get("meeting_title") or item.get("meeting_filename"),
                        },
                    )
                )

            # Calculate date range
            date_range = {}
            if gantt_items:
                all_dates = []
                for item in gantt_items:
                    if item.start_date:
                        all_dates.append(item.start_date)
                    if item.end_date:
                        all_dates.append(item.end_date)

                if all_dates:
                    date_range = {"start": min(all_dates), "end": max(all_dates)}

            return schemas.GanttData(
                items=gantt_items,
                milestones=[schemas.ProjectMilestone.model_validate(m) for m in milestones],
                date_range=date_range,
                links=[schemas.GanttLink(**link) for link in normalized_links],
            )

        except HTTPException:
            raise
        except Exception as e:
            import traceback

            traceback.print_exc()  # Print full traceback to logs
            raise HTTPException(status_code=500, detail=f"Failed to generate Gantt data: {str(e)}")

    def create_project_action_item(self, project_id: int, data: schemas.ProjectActionItemCreate) -> ActionItem:
        """Create a manual action item for a project."""
        project = self.repository.get(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        meeting_ids = self._get_project_meeting_ids_subquery(project.id)
        meeting_query = self.db.query(Meeting).filter(Meeting.id.in_(meeting_ids))
        if data.meeting_id:
            meeting = meeting_query.filter(Meeting.id == data.meeting_id).first()
            if not meeting:
                raise HTTPException(status_code=404, detail="Meeting not found in project")
        else:
            meeting = meeting_query.order_by(Meeting.meeting_date.desc().nullslast(), Meeting.created_at.desc()).first()

        if not meeting:
            raise HTTPException(status_code=400, detail="No meetings available to attach action item")

        transcription_repo = TranscriptionRepository(self.db)
        transcription = transcription_repo.get_by_meeting(meeting.id)

        if not transcription:
            transcription = Transcription(
                meeting_id=meeting.id,
                summary="",
                full_text="",
            )
            self.db.add(transcription)
            self.db.commit()
            self.db.refresh(transcription)

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

    def add_gantt_link(self, project_id: int, source: str, target: str, link_type: str = "e2s") -> schemas.GanttLink:
        """Persist a gantt dependency link in project settings."""
        project = self.repository.get(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        settings = project.settings or {}
        links = settings.get("gantt_links", []) or []

        for link in links:
            if link.get("source") == source and link.get("target") == target:
                return schemas.GanttLink(
                    **{
                        "id": str(link.get("id") or uuid4().hex),
                        "source": str(link.get("source")),
                        "target": str(link.get("target")),
                        "type": link.get("type") or "e2s",
                    }
                )

        new_link = {
            "id": uuid4().hex,
            "source": str(source),
            "target": str(target),
            "type": link_type or "e2s",
        }
        links.append(new_link)
        settings["gantt_links"] = links
        project.settings = settings
        self.db.commit()
        self.db.refresh(project)
        return schemas.GanttLink(**new_link)

    def delete_gantt_link(self, project_id: int, link_id: str) -> None:
        """Delete a gantt dependency link from project settings."""
        project = self.repository.get(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        settings = project.settings or {}
        links = settings.get("gantt_links", []) or []
        links = [link for link in links if str(link.get("id")) != str(link_id)]
        settings["gantt_links"] = links
        project.settings = settings
        self.db.commit()

    def update_gantt_item(self, project_id: int, item_id: str, update: schemas.GanttItemUpdate) -> schemas.GanttItem:
        """Update a Gantt item."""
        try:
            # Parse item type and ID
            if item_id.startswith("meeting-"):
                db_id = int(item_id.split("-")[1])
                meeting = self.db.query(Meeting).filter(Meeting.id == db_id).first()
                if not meeting:
                    raise HTTPException(status_code=404, detail="Meeting not found")

                # Update meeting date if provided
                if update.start_date:
                    meeting.meeting_date = update.start_date
                    self.db.commit()
                    self.db.refresh(meeting)

                # Return updated item (reuse logic partially or construct minimal)
                end_date = meeting.meeting_date
                if meeting.estimated_duration and meeting.estimated_duration > 0:
                    end_date = meeting.meeting_date + timedelta(minutes=meeting.estimated_duration)

                return schemas.GanttItem(
                    id=f"meeting-{meeting.id}",
                    name=meeting.filename,
                    type="meeting",
                    start_date=meeting.meeting_date,
                    end_date=end_date,
                    progress=1.0,
                    color="#4CAF50",
                    metadata={"meeting_id": meeting.id, "status": meeting.status},
                )

            elif item_id.startswith("milestone-"):
                db_id = int(item_id.split("-")[1])
                milestone = self.milestone_repository.get(db_id)
                if not milestone or milestone.project_id != project_id:
                    raise HTTPException(status_code=404, detail="Milestone not found")

                # Update milestone date
                if update.end_date:
                    milestone.due_date = update.end_date
                elif update.start_date:
                    milestone.due_date = update.start_date

                self.db.commit()
                self.db.refresh(milestone)

                milestone_date = milestone.due_date or milestone.created_at
                progress = 1.0 if milestone.status == "completed" else 0.0

                return schemas.GanttItem(
                    id=f"milestone-{milestone.id}",
                    name=milestone.name,
                    type="milestone",
                    start_date=milestone_date,
                    end_date=milestone_date,
                    progress=progress,
                    color=milestone.color or "#FF9800",
                    metadata={"milestone_id": milestone.id, "status": milestone.status},
                )

            elif item_id.startswith("action-"):
                db_id = int(item_id.split("-")[1])
                action = self.db.query(ActionItem).filter(ActionItem.id == db_id).first()
                if not action:
                    raise HTTPException(status_code=404, detail="Action item not found")

                # Update action item start/end dates
                if update.start_date:
                    action.start_date = update.start_date

                if update.end_date:
                    # due_date is stored as string in ActionItem model? Let's check model.
                    # Yes: due_date = Column(String, nullable=True) in modules/meetings/models.py
                    # We should store it as ISO string
                    action.due_date = update.end_date.isoformat()
                    self.db.commit()
                    self.db.refresh(action)
                elif update.start_date:
                    self.db.commit()
                    self.db.refresh(action)

                # Reconstruct item response
                # We need extensive logic to recreate the full GanttItem as in get_gantt_data
                # For simplicity, we return a basic version, frontend will likely reload or update locally

                start_date = update.start_date or update.end_date  # Fallback
                # If we have meeting link, we could fetch it for start_date

                return schemas.GanttItem(
                    id=f"action-{action.id}",
                    name=action.task,
                    type="action_item",
                    start_date=start_date if start_date else datetime.now(),
                    end_date=update.end_date if update.end_date else start_date,
                    progress=0.0,
                    color="#FFC107",
                    metadata={"action_item_id": action.id},
                )

            else:
                raise HTTPException(status_code=400, detail="Invalid item type")

        except HTTPException:
            raise
        except Exception as e:
            self.db.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to update Gantt item: {str(e)}")
