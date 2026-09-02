"""
Project Gantt chart service — builds Gantt data from meetings, milestones, and action items.

Extracted from ProjectService to isolate the complex Gantt computation logic.
"""

from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.orm import Session

from .. import schemas


class ProjectGanttService:
    """Builds Gantt chart data and manages dependency links."""

    def __init__(self, db: Session, project_repository, milestone_repository, pai_repo):
        self.db = db
        self.project_repository = project_repository
        self.milestone_repository = milestone_repository
        self.pai_repo = pai_repo

    def get_gantt_data(self, project_id: int) -> schemas.GanttData:
        """Build Gantt chart data from meetings, milestones, and action items."""
        project = self.project_repository.get(project_id)
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

        gantt_items = []

        # Meetings
        meetings = self.project_repository.get_dated_meetings_by_project(project.id)
        for meeting in meetings:
            end_date = meeting.meeting_date
            if meeting.estimated_duration and meeting.estimated_duration > 0:
                end_date = meeting.meeting_date + timedelta(minutes=meeting.estimated_duration)

            gantt_items.append(
                schemas.GanttItem(
                    id=f"meeting-{meeting.id}",
                    name=meeting.title or meeting.filename or f"Meeting {meeting.id}",
                    type="meeting",
                    start_date=meeting.meeting_date,
                    end_date=end_date,
                    progress=1.0,
                    dependencies=dependency_map.get(f"meeting-{meeting.id}", []),
                    color="#5C6BC0",
                    metadata={"meeting_id": meeting.id, "folder": meeting.folder, "status": meeting.status},
                )
            )

        # Milestones
        milestones = self.milestone_repository.list_by_project(project_id)
        for milestone in milestones:
            progress = 1.0 if milestone.status == "completed" else 0.0
            color = "#8D6E63" if milestone.status == "completed" else "#FF7043"
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

        # Action items (via simplified dict access)
        action_items = self.project_repository.get_project_linked_action_items(project_id)
        for item in action_items:
            item_dict = self._action_item_to_dict(item)
            start_date = self._resolve_action_start(item_dict)
            due_date = self._resolve_action_due(item_dict)

            if not start_date and not due_date:
                continue

            if start_date and not due_date:
                due_date = start_date + timedelta(days=7)
            elif due_date and not start_date:
                start_date = due_date - timedelta(days=7)

            if start_date.tzinfo is None:
                start_date = start_date.replace(tzinfo=timezone.utc)
            if due_date.tzinfo is None:
                due_date = due_date.replace(tzinfo=timezone.utc)

            task_text = item_dict.get("task") or "Action Item"
            status = item_dict.get("status", "pending")
            progress = 1.0 if status == "completed" else 0.5 if status == "in_progress" else 0.0
            color_map = {
                "completed": "#66BB6A",
                "in_progress": "#26A69A",
                "pending": "#FFA726",
                "cancelled": "#78909C",
            }

            gantt_items.append(
                schemas.GanttItem(
                    id=f"action-{item_dict.get('id')}",
                    name=task_text,
                    type="action_item",
                    start_date=start_date,
                    end_date=due_date,
                    progress=progress,
                    dependencies=dependency_map.get(f"action-{item_dict.get('id')}", []),
                    color=color_map.get(status, "#FFA726"),
                    metadata={
                        "action_item_id": item_dict.get("id"),
                        "meeting_id": item_dict.get("meeting_id"),
                        "status": status,
                        "priority": item_dict.get("priority"),
                        "owner": item_dict.get("owner"),
                        "task": task_text,
                        "notes": item_dict.get("notes"),
                        "meeting_title": item_dict.get("meeting_title") or item_dict.get("meeting_filename"),
                    },
                )
            )

        date_range = {}
        if gantt_items:
            all_dates = []
            for gitem in gantt_items:
                if gitem.start_date:
                    all_dates.append(gitem.start_date)
                if gitem.end_date:
                    all_dates.append(gitem.end_date)
            if all_dates:
                date_range = {"start": min(all_dates), "end": max(all_dates)}

        return schemas.GanttData(
            items=gantt_items,
            milestones=[schemas.ProjectMilestone.model_validate(m) for m in milestones],
            date_range=date_range,
            links=[schemas.GanttLink(**link) for link in normalized_links],
        )

    def add_link(self, project_id: int, source: str, target: str, link_type: str = "e2s") -> schemas.GanttLink:
        """Persist a Gantt dependency link in project settings."""
        project = self.project_repository.get(project_id)
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

    def delete_link(self, project_id: int, link_id: str) -> None:
        """Remove a Gantt dependency link from project settings."""
        project = self.project_repository.get(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        settings = project.settings or {}
        links = settings.get("gantt_links", []) or []
        links = [link for link in links if str(link.get("id")) != str(link_id)]
        settings["gantt_links"] = links
        project.settings = settings
        self.db.commit()

    def update_item(self, project_id: int, item_id: str, update: schemas.GanttItemUpdate) -> schemas.GanttItem:
        """Update a Gantt item's date (meeting, milestone, or action item)."""
        if item_id.startswith("meeting-"):
            return self._update_meeting_gantt(project_id, item_id, update)
        if item_id.startswith("milestone-"):
            return self._update_milestone_gantt(project_id, item_id, update)
        if item_id.startswith("action-"):
            return self._update_action_gantt(item_id, update)
        raise HTTPException(status_code=400, detail="Invalid item type")

    # -- Private helpers ------------------------------------------------- #

    @staticmethod
    def _action_item_to_dict(item) -> dict:
        """Convert ActionItem ORM object to dict for Gantt processing."""
        result = {
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
        if hasattr(item, "transcription") and item.transcription:
            meeting = item.transcription.meeting if item.transcription.meeting else None
            if meeting:
                result["meeting_id"] = meeting.id
                result["meeting_filename"] = meeting.filename
                result["meeting_title"] = meeting.title or meeting.filename
                result["meeting_date"] = meeting.meeting_date
        return result

    @staticmethod
    def _resolve_action_start(item_dict: dict) -> datetime | None:
        """Resolve the start date of an action item for Gantt display."""
        start_date = item_dict.get("start_date")
        if start_date:
            if isinstance(start_date, datetime):
                return start_date
            if isinstance(start_date, str):
                from dateutil.parser import parse

                try:
                    return parse(start_date)
                except Exception:
                    pass
        meeting_date = item_dict.get("meeting_date")
        if meeting_date:
            if isinstance(meeting_date, datetime):
                return meeting_date
            if isinstance(meeting_date, str):
                from dateutil.parser import parse

                try:
                    return parse(meeting_date)
                except Exception:
                    pass
        return None

    @staticmethod
    def _resolve_action_due(item_dict: dict) -> datetime | None:
        """Resolve the due date of an action item for Gantt display."""
        due_date_raw = item_dict.get("due_date")
        if not due_date_raw:
            return None
        if isinstance(due_date_raw, datetime):
            return due_date_raw
        if isinstance(due_date_raw, str):
            from dateutil.parser import parse

            try:
                return parse(due_date_raw)
            except Exception:
                pass
        return None

    def _update_meeting_gantt(
        self, project_id: int, item_id: str, update: schemas.GanttItemUpdate
    ) -> schemas.GanttItem:
        db_id = int(item_id.split("-")[1])
        meeting = self.project_repository.get_meeting_by_id(db_id)
        if not meeting:
            raise HTTPException(status_code=404, detail="Meeting not found")

        if update.start_date:
            meeting.meeting_date = update.start_date
            self.db.commit()
            self.db.refresh(meeting)

        end_date = meeting.meeting_date
        if meeting.estimated_duration and meeting.estimated_duration > 0:
            end_date = meeting.meeting_date + timedelta(minutes=meeting.estimated_duration)

        return schemas.GanttItem(
            id=f"meeting-{meeting.id}",
            name=meeting.title or meeting.filename,
            type="meeting",
            start_date=meeting.meeting_date,
            end_date=end_date,
            progress=1.0,
            color="#4CAF50",
            metadata={"meeting_id": meeting.id, "status": meeting.status},
        )

    def _update_milestone_gantt(
        self, project_id: int, item_id: str, update: schemas.GanttItemUpdate
    ) -> schemas.GanttItem:
        db_id = int(item_id.split("-")[1])
        milestone = self.milestone_repository.get(db_id)
        if not milestone or milestone.project_id != project_id:
            raise HTTPException(status_code=404, detail="Milestone not found")

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

    def _update_action_gantt(self, item_id: str, update: schemas.GanttItemUpdate) -> schemas.GanttItem:
        db_id = int(item_id.split("-")[1])
        action = self.pai_repo.get_action_item(db_id)
        if not action:
            raise HTTPException(status_code=404, detail="Action item not found")

        if update.start_date:
            action.start_date = update.start_date
        if update.end_date:
            action.due_date = update.end_date.isoformat()

        if update.start_date or update.end_date:
            self.db.commit()
            self.db.refresh(action)

        start_date = update.start_date or update.end_date
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
