"""
Tool definitions and handlers for LLM chat capabilities.
Provides functions that the LLM can call to interact with the meeting assistant system.
"""

import logging
from collections.abc import Callable
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import DateTime, cast, func
from sqlalchemy.orm import Session

from ...modules.meetings import crud, schemas
from ...modules.meetings.models import Meeting, Speaker, Transcription
from ...modules.projects import schemas as project_schemas
from ...modules.projects.service import ProjectService

logger = logging.getLogger(__name__)


class ToolRegistry:
    """Registry for available tools that the LLM can use"""

    def __init__(self):
        self._tools: dict[str, dict[str, Any]] = {}
        self._handlers: dict[str, Callable] = {}
        self._register_default_tools()

    def register_tool(self, name: str, definition: dict[str, Any], handler: Callable):
        """Register a new tool with its definition and handler"""
        self._tools[name] = definition
        self._handlers[name] = handler
        logger.debug(f"Registered tool: {name}")

    def get_tool_definitions(self) -> list[dict[str, Any]]:
        """Get all tool definitions in OpenAI function calling format"""
        return list(self._tools.values())

    async def execute_tool(self, name: str, arguments: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
        """Execute a tool by name with given arguments"""
        if name not in self._handlers:
            return {"error": f"Tool {name} not found"}

        try:
            handler = self._handlers[name]
            result = await handler(arguments, context)
            return {"success": True, "result": result}
        except Exception as e:
            db = context.get("db") if isinstance(context, dict) else None
            if db is not None:
                try:
                    db.rollback()
                except Exception:
                    logger.warning("Failed to rollback session after tool error", exc_info=True)
            logger.error(f"Error executing tool {name}: {e}", exc_info=True)
            return {"success": False, "error": str(e)}

    def _register_default_tools(self):
        """Register all default tools"""

        # Tool: Create Action Item
        self.register_tool(
            name="create_action_item",
            definition={
                "type": "function",
                "function": {
                    "name": "create_action_item",
                    "description": "Create a new action item/task. Extract the task description, owner, and due date from the conversation when possible. If the user doesn't specify an owner or due date, create the item without them — do NOT guess. If multiple meetings could apply, ask the user to clarify which one.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "task": {"type": "string", "description": "The task description or action to be taken"},
                            "owner": {
                                "type": "string",
                                "description": "The person responsible for this action item (optional)",
                            },
                            "due_date": {"type": "string", "description": "Due date in YYYY-MM-DD format (optional)"},
                            "priority": {
                                "type": "string",
                                "enum": ["low", "medium", "high", "critical"],
                                "description": "Priority level of the action item (optional)",
                            },
                            "notes": {
                                "type": "string",
                                "description": "Additional notes or context for the action item (optional)",
                            },
                            "meeting_id": {
                                "type": "integer",
                                "description": "Optional meeting ID to attach the action item",
                            },
                            "project_id": {
                                "type": "integer",
                                "description": "Optional project ID to create the action item in",
                            },
                        },
                        "required": ["task"],
                    },
                },
            },
            handler=self._handle_create_action_item,
        )

        # Tool: Update Action Item
        self.register_tool(
            name="update_action_item",
            definition={
                "type": "function",
                "function": {
                    "name": "update_action_item",
                    "description": "Update an existing action item. You MUST know the item_id — use list_action_items first to find it if needed. You can change status, owner, due_date, priority, task description, or notes.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "item_id": {"type": "integer", "description": "The ID of the action item to update"},
                            "task": {"type": "string", "description": "Updated task description (optional)"},
                            "owner": {"type": "string", "description": "Updated owner name (optional)"},
                            "due_date": {
                                "type": "string",
                                "description": "Updated due date in YYYY-MM-DD format (optional)",
                            },
                            "status": {
                                "type": "string",
                                "enum": ["pending", "in_progress", "completed", "cancelled"],
                                "description": "Updated status (optional)",
                            },
                            "priority": {
                                "type": "string",
                                "enum": ["low", "medium", "high", "critical"],
                                "description": "Updated priority (optional)",
                            },
                            "notes": {"type": "string", "description": "Updated notes (optional)"},
                            "meeting_id": {
                                "type": "integer",
                                "description": "Optional meeting ID context (if needed)",
                            },
                            "project_id": {
                                "type": "integer",
                                "description": "Optional project ID context (if needed)",
                            },
                        },
                        "required": ["item_id"],
                    },
                },
            },
            handler=self._handle_update_action_item,
        )

        # Tool: List Action Items
        self.register_tool(
            name="list_action_items",
            definition={
                "type": "function",
                "function": {
                    "name": "list_action_items",
                    "description": "List action items from a meeting or project. Use this instead of transcript search when the user asks to list tasks or action items.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "status_filter": {
                                "type": "string",
                                "enum": ["all", "pending", "in_progress", "completed", "cancelled"],
                                "description": "Filter action items by status (optional, defaults to 'all')",
                            },
                            "meeting_id": {
                                "type": "integer",
                                "description": "Optional meeting ID to list action items from",
                            },
                            "project_id": {
                                "type": "integer",
                                "description": "Optional project ID to list action items from",
                            },
                        },
                    },
                },
            },
            handler=self._handle_list_action_items,
        )

        # Tool: Add Note to Meeting
        self.register_tool(
            name="add_note_to_meeting",
            definition={
                "type": "function",
                "function": {
                    "name": "add_note_to_meeting",
                    "description": "Add or append notes to a meeting record. By default appends with a timestamp. Set append=false to overwrite.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "note_content": {"type": "string", "description": "The note content to add to the meeting"},
                            "append": {
                                "type": "boolean",
                                "description": "If true, append to existing notes; if false, replace existing notes (optional, defaults to true)",
                            },
                            "meeting_id": {
                                "type": "integer",
                                "description": "Optional meeting ID to add the note to",
                            },
                        },
                        "required": ["note_content"],
                    },
                },
            },
            handler=self._handle_add_note_to_meeting,
        )

        # Tool: Update Meeting Details
        self.register_tool(
            name="update_meeting_details",
            definition={
                "type": "function",
                "function": {
                    "name": "update_meeting_details",
                    "description": "Update meeting metadata such as date, topic, or folder. Use this when the user wants to change meeting details or organize meetings.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "meeting_date": {
                                "type": "string",
                                "description": "Meeting date in ISO format (YYYY-MM-DDTHH:MM:SS) (optional)",
                            },
                            "filename": {"type": "string", "description": "Updated meeting name or title (optional)"},
                            "tags": {
                                "type": "string",
                                "description": "Comma-separated tags for organizing the meeting (optional)",
                            },
                            "folder": {
                                "type": "string",
                                "description": "Folder or category for organizing the meeting (optional)",
                            },
                            "meeting_id": {
                                "type": "integer",
                                "description": "Optional meeting ID to update",
                            },
                        },
                    },
                },
            },
            handler=self._handle_update_meeting_details,
        )

        # Tool: List Projects
        self.register_tool(
            name="list_projects",
            definition={
                "type": "function",
                "function": {
                    "name": "list_projects",
                    "description": "List all projects with basic metadata. Use this to resolve a project name before scoping meeting queries.",
                    "parameters": {
                        "type": "object",
                        "properties": {},
                    },
                },
            },
            handler=self._handle_list_projects,
        )

        # Tool: List Project Notes
        self.register_tool(
            name="list_project_notes",
            definition={
                "type": "function",
                "function": {
                    "name": "list_project_notes",
                    "description": "List notes for a project.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "project_id": {"type": "integer", "description": "Project ID"},
                        },
                        "required": ["project_id"],
                    },
                },
            },
            handler=self._handle_list_project_notes,
        )

        # Tool: Search Content (single tool for meeting/project/global)
        self.register_tool(
            name="search_content",
            definition={
                "type": "function",
                "function": {
                    "name": "search_content",
                    "description": "Search meeting transcripts for keywords or phrases. Automatically scopes to the current meeting, project meetings, or all meetings. Returns matching snippets with meeting context. Use for finding specific discussions, quotes, or topics. IMPORTANT: Speaker names in transcripts may appear as generic labels (e.g. SPEAKER_00). To find meetings by a person's name or speaker, use the list_meetings tool instead.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "search_query": {"type": "string", "description": "Search text"},
                            "max_results": {"type": "integer", "description": "Maximum number of matches"},
                            "meeting_limit": {"type": "integer", "description": "Maximum meetings to scan (optional)"},
                            "meeting_id": {"type": "integer", "description": "Optional meeting ID override"},
                            "project_id": {"type": "integer", "description": "Optional project ID override"},
                        },
                        "required": ["search_query"],
                    },
                },
            },
            handler=self._handle_search_content,
        )

        # Tool: Get Meeting Summary
        self.register_tool(
            name="get_meeting_summary",
            definition={
                "type": "function",
                "function": {
                    "name": "get_meeting_summary",
                    "description": "Get the AI-generated summary of a meeting. Use this instead of trying to summarize from transcript snippets. In meeting context, defaults to the current meeting.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "meeting_id": {
                                "type": "integer",
                                "description": "Meeting ID to get the summary for (optional in meeting context)",
                            },
                        },
                    },
                },
            },
            handler=self._handle_get_meeting_summary,
        )

        # Tool: Get Meeting Speakers
        self.register_tool(
            name="get_meeting_speakers",
            definition={
                "type": "function",
                "function": {
                    "name": "get_meeting_speakers",
                    "description": "Get the list of speakers/participants in a meeting (real names, not SPEAKER_00 labels). Use this instead of reading speakers from transcript text. In meeting context, defaults to the current meeting.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "meeting_id": {
                                "type": "integer",
                                "description": "Meeting ID to get speakers for (optional in meeting context)",
                            },
                        },
                    },
                },
            },
            handler=self._handle_get_meeting_speakers,
        )

        # Tool: Iterative Research
        # Project tools
        self.register_tool(
            name="create_project_note",
            definition={
                "type": "function",
                "function": {
                    "name": "create_project_note",
                    "description": "Create a project note. Use this in project or global chat to add documentation.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "project_id": {"type": "integer", "description": "Project ID"},
                            "title": {"type": "string", "description": "Note title"},
                            "content": {"type": "string", "description": "Note content"},
                            "pinned": {"type": "boolean", "description": "Pin note"},
                        },
                        "required": ["title"],
                    },
                },
            },
            handler=self._handle_create_project_note,
        )

        self.register_tool(
            name="create_project_milestone",
            definition={
                "type": "function",
                "function": {
                    "name": "create_project_milestone",
                    "description": "Create a project milestone. Use this in project or global chat to track deliverables.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "project_id": {"type": "integer", "description": "Project ID"},
                            "name": {"type": "string", "description": "Milestone name"},
                            "description": {"type": "string", "description": "Milestone description"},
                            "due_date": {"type": "string", "description": "Due date in ISO format"},
                            "color": {"type": "string", "description": "Hex color"},
                        },
                        "required": ["name"],
                    },
                },
            },
            handler=self._handle_create_project_milestone,
        )

        # Tool: List Milestones — list milestones for a project
        self.register_tool(
            name="list_milestones",
            definition={
                "type": "function",
                "function": {
                    "name": "list_milestones",
                    "description": (
                        "List milestones for a project. Shows name, status, due date, and completion info. "
                        "Use this when the user asks about milestones, progress, or deliverables."
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "project_id": {
                                "type": "integer",
                                "description": "Project ID. Required in global context, auto-resolved in project context.",
                            },
                            "status_filter": {
                                "type": "string",
                                "enum": ["all", "pending", "completed"],
                                "description": "Filter by status (default: all)",
                            },
                        },
                        "required": [],
                    },
                },
            },
            handler=self._handle_list_milestones,
        )

        # Tool: List Meetings — search/browse meetings by name, folder, speaker, date
        self.register_tool(
            name="list_meetings",
            definition={
                "type": "function",
                "function": {
                    "name": "list_meetings",
                    "description": (
                        "Search and list meetings. Filter by name, folder, or speaker name. Optionally scope to a project via project_id. "
                        "ALWAYS use this tool when the user asks to find meetings by speaker/person name, "
                        "wants to list meetings, or needs to know what meetings exist. "
                        "This searches the meetings database (titles, folders, speaker records), NOT transcript text."
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "search": {
                                "type": "string",
                                "description": "Search term to match against meeting name, folder, or speaker names (optional)",
                            },
                            "project_id": {
                                "type": "integer",
                                "description": "Optional project ID to scope results to a specific project",
                            },
                            "folder": {
                                "type": "string",
                                "description": "Filter by folder name (optional)",
                            },
                            "limit": {
                                "type": "integer",
                                "description": "Max number of meetings to return (default 20)",
                            },
                        },
                    },
                },
            },
            handler=self._handle_list_meetings,
        )

        # Tool: Get Meeting Details — full metadata for a specific meeting
        self.register_tool(
            name="get_meeting_details",
            definition={
                "type": "function",
                "function": {
                    "name": "get_meeting_details",
                    "description": (
                        "Get full details about a specific meeting: name, date, folder, tags, speakers, "
                        "action item count, summary, and notes. Use when the user asks about a particular meeting."
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "meeting_id": {
                                "type": "integer",
                                "description": "The ID of the meeting to get details for",
                            },
                        },
                        "required": ["meeting_id"],
                    },
                },
            },
            handler=self._handle_get_meeting_details,
        )

        # Tool: Get Upcoming Deadlines
        self.register_tool(
            name="get_upcoming_deadlines",
            definition={
                "type": "function",
                "function": {
                    "name": "get_upcoming_deadlines",
                    "description": "Get upcoming action-item deadlines across meetings and projects. Use this when the user asks about upcoming deadlines or next due items.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "days_ahead": {
                                "type": "integer",
                                "description": "Number of days ahead to look for deadlines (default 14)",
                            },
                            "include_overdue": {
                                "type": "boolean",
                                "description": "Whether to include overdue items (default true)",
                            },
                        },
                    },
                },
            },
            handler=self._handle_get_upcoming_deadlines,
        )

        # Tool: Delete Action Item
        self.register_tool(
            name="delete_action_item",
            definition={
                "type": "function",
                "function": {
                    "name": "delete_action_item",
                    "description": "Delete an action item by its ID. Use when the user asks to remove or delete a task.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "item_id": {"type": "integer", "description": "The ID of the action item to delete"},
                        },
                        "required": ["item_id"],
                    },
                },
            },
            handler=self._handle_delete_action_item,
        )

    def _resolve_meeting_from_query(
        self,
        db: Session,
        query_text: str | None,
        meeting_ids: list[int] | None = None,
    ) -> Meeting | None:
        base_query = db.query(Meeting)
        if meeting_ids:
            base_query = base_query.filter(Meeting.id.in_(meeting_ids))

        if not query_text:
            return base_query.order_by(Meeting.meeting_date.desc().nullslast(), Meeting.created_at.desc()).first()

        query_lower = query_text.lower()

        # Try folder match
        folders = db.query(Meeting.folder).filter(Meeting.folder.isnot(None)).distinct().all()
        for (folder,) in folders:
            if folder and folder.lower() in query_lower:
                match = (
                    base_query.filter(Meeting.folder == folder)
                    .order_by(Meeting.meeting_date.desc().nullslast(), Meeting.created_at.desc())
                    .first()
                )
                if match:
                    return match

        # Try speaker name match
        speaker_names = db.query(Speaker.name).filter(Speaker.name.isnot(None)).distinct().all()
        matched_names = [name for (name,) in speaker_names if name and name.lower() in query_lower]
        if matched_names:
            match = (
                base_query.join(Speaker)
                .filter(func.lower(Speaker.name).in_([n.lower() for n in matched_names]))
                .order_by(Meeting.meeting_date.desc().nullslast(), Meeting.created_at.desc())
                .first()
            )
            if match:
                return match

        return base_query.order_by(Meeting.meeting_date.desc().nullslast(), Meeting.created_at.desc()).first()

    # Tool Handlers

    async def _handle_create_action_item(self, args: dict[str, Any], context: dict[str, Any]) -> str:
        """Handler for creating action items"""
        db: Session = context["db"]
        meeting_id: int | None = args.get("meeting_id") or context.get("meeting_id")
        project_id: int | None = args.get("project_id") or context.get("project_id")
        meeting_ids: list[int] | None = context.get("meeting_ids")
        user_query: str | None = context.get("user_query")

        if project_id:
            service = ProjectService(db)
            payload = project_schemas.ProjectActionItemCreate(
                task=args["task"],
                owner=args.get("owner"),
                due_date=args.get("due_date"),
                status=args.get("status") or "pending",
                priority=args.get("priority"),
                notes=args.get("notes"),
                meeting_id=meeting_id,
            )
            item = service.create_project_action_item(project_id, payload)
            return f"Project action item created with ID {item.id}: '{item.task}'"

        if meeting_id is None:
            meeting = self._resolve_meeting_from_query(db, user_query, meeting_ids)
            meeting_id = meeting.id if meeting else None

        if not meeting_id:
            return "Error: No meeting available to attach the action item"

        meeting = crud.get_meeting(db, meeting_id)
        if not meeting or not meeting.transcription:
            return "Error: Meeting or transcription not found"

        action_item_data = schemas.ActionItemCreate(
            task=args["task"],
            owner=args.get("owner"),
            due_date=args.get("due_date"),
            priority=args.get("priority"),
            notes=args.get("notes"),
        )

        action_item = crud.create_action_item(
            db, transcription_id=meeting.transcription.id, action_item=action_item_data, is_manual=True
        )

        meeting_name = meeting.filename or f"Meeting {meeting.id}"
        result = f"✅ Action item created (ID: {action_item.id}) in **{meeting_name}**:\n"
        result += f"- **Task:** {action_item.task}\n"
        if action_item.owner:
            result += f"- **Owner:** {action_item.owner}\n"
        if action_item.due_date:
            result += f"- **Due:** {action_item.due_date}\n"
        if action_item.priority:
            result += f"- **Priority:** {action_item.priority}\n"
        return result

    async def _handle_update_action_item(self, args: dict[str, Any], context: dict[str, Any]) -> str:
        """Handler for updating action items"""
        db: Session = context["db"]
        item_id: int = args["item_id"]

        # Build update data
        update_data = schemas.ActionItemUpdate(
            task=args.get("task"),
            owner=args.get("owner"),
            due_date=args.get("due_date"),
            status=args.get("status"),
            priority=args.get("priority"),
            notes=args.get("notes"),
        )

        updated_item = crud.update_action_item(db, item_id, update_data)
        if not updated_item:
            return f"Error: Action item with ID {item_id} not found"

        return f"Action item {item_id} updated successfully: '{updated_item.task}'"

    async def _handle_list_action_items(self, args: dict[str, Any], context: dict[str, Any]) -> str:
        """Handler for listing action items"""
        db: Session = context["db"]
        meeting_id: int | None = args.get("meeting_id") or context.get("meeting_id")
        project_id: int | None = args.get("project_id") or context.get("project_id")
        meeting_ids: list[int] | None = context.get("meeting_ids")
        status_filter = args.get("status_filter", "all")

        if project_id:
            service = ProjectService(db)
            items = service.get_project_action_items(project_id)
            if status_filter != "all":
                items = [item for item in items if item.get("status") == status_filter]
            if not items:
                return f"No action items found with status: {status_filter}"

            result = f"Found {len(items)} action item(s):\n\n"
            for item in items:
                result += f"- **{item.get('task')}** (ID: {item.get('id')})\n"
                result += f"  Status: {item.get('status')}"
                if item.get("owner"):
                    result += f" | Owner: {item.get('owner')}"
                if item.get("due_date"):
                    result += f" | Due: {item.get('due_date')}"
                if item.get("priority"):
                    result += f" | Priority: {item.get('priority')}"
                result += "\n\n"
            return result

        if meeting_id:
            # Single meeting scope
            meeting = crud.get_meeting(db, meeting_id)
            if not meeting or not meeting.transcription:
                return "No action items found - meeting or transcription not available"

            action_items = list(meeting.transcription.action_items)
            if status_filter != "all":
                action_items = [item for item in action_items if item.status == status_filter]

            if not action_items:
                return f"No action items found with status: {status_filter}"

            meeting_name = meeting.filename or f"Meeting {meeting.id}"
            result = f"Found {len(action_items)} action item(s) in **{meeting_name}**:\n\n"
            for item in action_items:
                result += f"- **{item.task}** (ID: {item.id})\n"
                result += f"  Status: {item.status}"
                if item.owner:
                    result += f" | Owner: {item.owner}"
                if item.due_date:
                    result += f" | Due: {item.due_date}"
                if item.priority:
                    result += f" | Priority: {item.priority}"
                result += "\n\n"
            return result

        # Global/multi-meeting scope: list action items across all (or scoped) meetings
        from ...models import ActionItem as GlobalActionItem

        query = (
            db.query(GlobalActionItem, Meeting)
            .join(Transcription, GlobalActionItem.transcription_id == Transcription.id)
            .join(Meeting, Transcription.meeting_id == Meeting.id)
        )
        if meeting_ids:
            query = query.filter(Meeting.id.in_(meeting_ids))
        if status_filter != "all":
            query = query.filter(GlobalActionItem.status == status_filter)

        query = query.order_by(GlobalActionItem.due_date.asc().nullslast())
        rows = query.limit(30).all()

        if not rows:
            return f"No action items found with status: {status_filter}"

        result = f"Found {len(rows)} action item(s):\n\n"
        for item, meeting in rows:
            meeting_name = meeting.filename or f"Meeting {meeting.id}"
            result += f"- **{item.task}** (ID: {item.id})\n"
            result += f"  Meeting: {meeting_name} | Status: {item.status}"
            if item.owner:
                result += f" | Owner: {item.owner}"
            if item.due_date:
                result += f" | Due: {item.due_date}"
            if item.priority:
                result += f" | Priority: {item.priority}"
            result += "\n\n"
        return result

    async def _handle_add_note_to_meeting(self, args: dict[str, Any], context: dict[str, Any]) -> str:
        """Handler for adding notes to meeting"""
        db: Session = context["db"]
        meeting_id: int | None = args.get("meeting_id") or context.get("meeting_id")
        meeting_ids: list[int] | None = context.get("meeting_ids")
        user_query: str | None = context.get("user_query")

        if meeting_id is None:
            meeting = self._resolve_meeting_from_query(db, user_query, meeting_ids)
            meeting_id = meeting.id if meeting else None

        if not meeting_id:
            return "Error: No meeting available to update notes"

        meeting = crud.get_meeting(db, meeting_id)
        if not meeting:
            return "Error: Meeting not found"

        note_content = args["note_content"]
        append = args.get("append", True)

        if append and meeting.notes:
            # Append to existing notes with timestamp
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            meeting.notes = f"{meeting.notes}\n\n[{timestamp}] {note_content}"
        else:
            meeting.notes = note_content

        db.commit()

        # Trigger embedding computation for the updated notes
        try:
            from ..tasks import compute_embeddings_for_meeting

            compute_embeddings_for_meeting.delay(meeting_id)
        except Exception as e:
            logger.warning(f"Could not trigger embedding computation: {e}")

        action = "appended to" if append else "updated for"
        return f"Note {action} the meeting successfully"

    async def _handle_update_meeting_details(self, args: dict[str, Any], context: dict[str, Any]) -> str:
        """Handler for updating meeting details"""
        db: Session = context["db"]
        meeting_id: int | None = args.get("meeting_id") or context.get("meeting_id")
        meeting_ids: list[int] | None = context.get("meeting_ids")
        user_query: str | None = context.get("user_query")

        if meeting_id is None:
            meeting = self._resolve_meeting_from_query(db, user_query, meeting_ids)
            meeting_id = meeting.id if meeting else None

        if not meeting_id:
            return "Error: No meeting available to update"

        meeting = crud.get_meeting(db, meeting_id)
        if not meeting:
            return "Error: Meeting not found"

        updated_fields = []

        if "meeting_date" in args:
            try:
                meeting.meeting_date = datetime.fromisoformat(args["meeting_date"])
                updated_fields.append("date")
            except ValueError:
                return "Error: Invalid date format. Use ISO format (YYYY-MM-DDTHH:MM:SS)"

        if "filename" in args:
            meeting.filename = args["filename"]
            updated_fields.append("name")

        if "tags" in args:
            meeting.tags = args["tags"]
            updated_fields.append("tags")

        if "folder" in args:
            meeting.folder = args["folder"]
            updated_fields.append("folder")

        if not updated_fields:
            return "No fields were updated"

        db.commit()

        return f"Meeting details updated successfully: {', '.join(updated_fields)}"

    async def _handle_list_projects(self, args: dict[str, Any], context: dict[str, Any]) -> str:
        """Handler for listing projects."""
        db: Session = context["db"]
        service = ProjectService(db)
        projects = service.list_projects()
        if not projects:
            return "No projects found"

        result = f"Found {len(projects)} project(s):\n\n"
        for project in projects:
            result += f"- ID: {project.id}\n"
            result += f"  Name: {project.name}\n"
            if project.description:
                result += f"  Description: {project.description}\n"
            result += f"  Status: {project.status}\n"
            if project.meeting_ids:
                result += f"  Meetings linked: {len(project.meeting_ids)}\n"
            if project.tags:
                result += f"  Tags: {', '.join(project.tags)}\n"
            result += "\n"

        return result

    async def _handle_list_project_notes(self, args: dict[str, Any], context: dict[str, Any]) -> str:
        """Handler for listing project notes."""
        db: Session = context["db"]
        project_id = args.get("project_id")
        if not project_id:
            return "Error: project_id is required to list project notes"

        service = ProjectService(db)
        notes = service.note_repository.list_by_project(project_id)
        if not notes:
            return "No project notes found"

        result = f"Found {len(notes)} note(s):\n\n"
        for note in notes:
            result += f"- ID: {note.id}\n"
            result += f"  Title: {note.title}\n"
            result += f"  Pinned: {'Yes' if note.pinned else 'No'}\n\n"
        return result

    async def _handle_search_content(self, args: dict[str, Any], context: dict[str, Any]) -> dict[str, Any] | str:
        """Handler for searching meeting content (single tool for meeting/project/global).
        Supports partial word matching: if the full query doesn't match, tries individual words."""
        db: Session = context["db"]
        meeting_id: int | None = args.get("meeting_id") or context.get("meeting_id")
        project_id: int | None = args.get("project_id") or context.get("project_id")
        meeting_ids: list[int] | None = context.get("meeting_ids")

        search_query = args["search_query"].lower().strip()
        max_results = args.get("max_results", 10)
        meeting_limit = args.get("meeting_limit", 50)

        # Build search terms: first try full phrase, then individual significant words
        search_words = [w for w in search_query.split() if len(w) > 2]

        def _sentence_matches(sentence_lower: str) -> bool:
            """Check if a sentence matches the search query (full phrase or all significant words)."""
            if search_query in sentence_lower:
                return True
            if len(search_words) > 1:
                return all(word in sentence_lower for word in search_words)
            return False

        if project_id:
            service = ProjectService(db)
            project = service.repository.get(project_id)
            if not project:
                return "Error: Project not found"
            meeting_ids = service._get_project_meeting_ids(project)

        if meeting_id:
            meeting = crud.get_meeting(db, meeting_id)
            if not meeting or not meeting.transcription:
                return "Error: Meeting transcript not available"

            transcript = meeting.transcription.full_text
            sentences = transcript.split(". ")
            matches = []
            for sentence in sentences:
                if _sentence_matches(sentence.lower()):
                    matches.append(sentence.strip())
                    if len(matches) >= max_results:
                        break

            if not matches:
                return {
                    "count": 0,
                    "matches": [],
                    "query": search_query,
                    "message": f"No matches found for '{search_query}' in the meeting transcript",
                }

            return {
                "count": len(matches),
                "query": search_query,
                "matches": [
                    {
                        "meeting_id": meeting.id,
                        "meeting_name": meeting.filename or f"Meeting {meeting.id}",
                        "snippet": match.strip(),
                    }
                    for match in matches
                ],
            }

        query = (
            db.query(Meeting, Transcription)
            .join(Transcription, Transcription.meeting_id == Meeting.id)
            .filter(Transcription.full_text.isnot(None))
        )

        if meeting_ids:
            query = query.filter(Meeting.id.in_(meeting_ids))

        query = query.order_by(Meeting.meeting_date.desc().nullslast(), Meeting.created_at.desc())
        if meeting_limit:
            query = query.limit(meeting_limit)

        rows = query.all()
        if not rows:
            return "Error: No meeting transcripts available"

        matches = []
        for meeting, transcription in rows:
            transcript = transcription.full_text or ""
            sentences = transcript.split(". ")
            for sentence in sentences:
                if _sentence_matches(sentence.lower()):
                    matches.append(
                        {
                            "meeting_id": meeting.id,
                            "meeting_name": meeting.filename or f"Meeting {meeting.id}",
                            "snippet": sentence.strip(),
                        }
                    )
                    if len(matches) >= max_results:
                        break
            if len(matches) >= max_results:
                break

        if not matches:
            return {
                "count": 0,
                "matches": [],
                "query": search_query,
                "message": f"No matches found for '{search_query}' in the selected meetings",
            }

        return {
            "count": len(matches),
            "query": search_query,
            "matches": matches,
        }

    async def _handle_create_project_note(self, args: dict[str, Any], context: dict[str, Any]) -> str:
        """Handler for creating a project note."""
        db: Session = context["db"]
        project_id: int | None = args.get("project_id") or context.get("project_id")
        if not project_id:
            return "Error: project_id is required to create a project note"

        service = ProjectService(db)
        note = service.note_repository.create(
            project_id,
            {
                "title": args.get("title"),
                "content": args.get("content"),
                "pinned": bool(args.get("pinned", False)),
            },
        )
        return f"Project note created with ID {note.id}: '{note.title}'"

    async def _handle_create_project_milestone(self, args: dict[str, Any], context: dict[str, Any]) -> str:
        """Handler for creating a project milestone."""
        db: Session = context["db"]
        project_id: int | None = args.get("project_id") or context.get("project_id")
        if not project_id:
            return "Error: project_id is required to create a project milestone"

        service = ProjectService(db)
        due_date = args.get("due_date")
        if isinstance(due_date, str):
            try:
                due_date = datetime.fromisoformat(due_date)
            except ValueError:
                due_date = None

        milestone = service.milestone_repository.create(
            project_id,
            {
                "name": args.get("name"),
                "description": args.get("description"),
                "due_date": due_date,
                "color": args.get("color"),
            },
        )
        return f"Project milestone created with ID {milestone.id}: '{milestone.name}'"

    async def _handle_list_milestones(self, args: dict[str, Any], context: dict[str, Any]) -> str:
        """Handler for listing project milestones."""
        db: Session = context["db"]
        project_id: int | None = args.get("project_id") or context.get("project_id")
        if not project_id:
            return "Error: project_id is required. Use list_projects to find the project first."

        status_filter = args.get("status_filter", "all")
        service = ProjectService(db)
        milestones = service.milestone_repository.list_by_project(project_id)

        if status_filter != "all":
            milestones = [m for m in milestones if m.status == status_filter]

        if not milestones:
            return f"No milestones found with status: {status_filter}"

        now = datetime.now(timezone.utc)
        result = f"Found {len(milestones)} milestone(s):\n\n"
        for m in milestones:
            overdue = False
            if m.due_date and m.status != "completed":
                due_date = m.due_date
                if due_date.tzinfo is None:
                    due_date = due_date.replace(tzinfo=timezone.utc)
                overdue = due_date < now
            status_emoji = "✅" if m.status == "completed" else "🔴" if overdue else "🔵"
            result += f"- {status_emoji} **{m.name}** (ID: {m.id})\n"
            result += f"  Status: {m.status}"
            if m.due_date:
                result += f" | Due: {m.due_date.strftime('%Y-%m-%d')}"
            if m.completed_at:
                result += f" | Completed: {m.completed_at.strftime('%Y-%m-%d')}"
            if m.description:
                result += f"\n  {m.description}"
            result += "\n\n"
        return result

    async def _handle_get_meeting_summary(self, args: dict[str, Any], context: dict[str, Any]) -> str:
        """Handler for getting meeting summary"""
        db: Session = context["db"]
        meeting_id: int | None = args.get("meeting_id") or context.get("meeting_id")

        if not meeting_id:
            return "Error: meeting_id is required. Use list_meetings to find the meeting first."

        meeting = crud.get_meeting(db, meeting_id)
        if not meeting or not meeting.transcription:
            return "Error: Meeting summary not available"

        summary = meeting.transcription.summary
        if not summary:
            return "No summary available for this meeting"

        meeting_name = meeting.filename or f"Meeting {meeting.id}"
        return f"**Summary of {meeting_name} (ID: {meeting.id}):**\n\n{summary}"

    async def _handle_get_meeting_speakers(self, args: dict[str, Any], context: dict[str, Any]) -> str:
        """Handler for getting meeting speakers"""
        db: Session = context["db"]
        meeting_id: int | None = args.get("meeting_id") or context.get("meeting_id")

        if not meeting_id:
            return "Error: meeting_id is required. Use list_meetings to find the meeting first."

        meeting = crud.get_meeting(db, meeting_id)
        if not meeting:
            return "Error: Meeting not found"

        speakers = meeting.speakers
        if not speakers:
            return "No speaker information available for this meeting"

        meeting_name = meeting.filename or f"Meeting {meeting.id}"
        result = f"**Participants in {meeting_name}** ({len(speakers)} speaker(s)):\n\n"
        for speaker in speakers:
            result += f"- {speaker.name}"
            if speaker.label:
                result += f" ({speaker.label})"
            result += "\n"

        return result

    async def _handle_list_meetings(self, args: dict[str, Any], context: dict[str, Any]) -> str:
        """Handler for listing/searching meetings."""
        db: Session = context["db"]
        meeting_ids: list[int] | None = context.get("meeting_ids")
        project_id = args.get("project_id")
        search = (args.get("search") or "").strip().lower()
        folder_filter = (args.get("folder") or "").strip()
        limit = args.get("limit", 20)

        if project_id:
            service = ProjectService(db)
            project = service.repository.get(project_id)
            if not project:
                return "Error: Project not found"
            project_meeting_ids = service._get_project_meeting_ids(project)
            meeting_ids = list(set(meeting_ids) & set(project_meeting_ids)) if meeting_ids else project_meeting_ids

        query = db.query(Meeting)

        # Scope to project meetings if applicable
        if meeting_ids:
            query = query.filter(Meeting.id.in_(meeting_ids))

        if folder_filter:
            query = query.filter(func.lower(Meeting.folder) == folder_filter.lower())

        if search:
            # Match on filename, folder, or speaker names (check both name and label fields)
            name_match = query.filter(
                func.lower(Meeting.filename).contains(search) | func.lower(Meeting.folder).contains(search)
            )
            speaker_match = query.join(Speaker, Speaker.meeting_id == Meeting.id).filter(
                func.lower(Speaker.name).contains(search)
                | func.lower(func.coalesce(Speaker.label, "")).contains(search)
            )
            # Union both
            meeting_id_set = set()
            combined_meetings = []
            for m in name_match.all():
                if m.id not in meeting_id_set:
                    meeting_id_set.add(m.id)
                    combined_meetings.append(m)
            for m in speaker_match.all():
                if m.id not in meeting_id_set:
                    meeting_id_set.add(m.id)
                    combined_meetings.append(m)
            # Sort by date desc
            combined_meetings.sort(
                key=lambda m: (m.meeting_date or m.created_at) if (m.meeting_date or m.created_at) else datetime.min,
                reverse=True,
            )
            meetings = combined_meetings[:limit]
        else:
            meetings = (
                query.order_by(Meeting.meeting_date.desc().nullslast(), Meeting.created_at.desc()).limit(limit).all()
            )

        if not meetings:
            return f"No meetings found{' matching: ' + search if search else ''}."

        result = f"Found {len(meetings)} meeting(s):\n\n"
        for m in meetings:
            date_str = m.meeting_date.strftime("%Y-%m-%d %H:%M") if m.meeting_date else "No date"
            result += f"- **ID {m.id}**: {m.filename or 'Untitled'}\n"
            result += f"  Date: {date_str}"
            if m.folder:
                result += f" | Folder: {m.folder}"
            if m.tags:
                result += f" | Tags: {m.tags}"
            # Include speakers
            if m.speakers:
                speaker_names = [s.name for s in m.speakers if s.name]
                if speaker_names:
                    result += f"\n  Speakers: {', '.join(speaker_names)}"
            result += "\n\n"

        return result

    async def _handle_get_meeting_details(self, args: dict[str, Any], context: dict[str, Any]) -> str:
        """Handler for getting full meeting details."""
        db: Session = context["db"]
        meeting_id = args.get("meeting_id") or context.get("meeting_id")

        if not meeting_id:
            return "Error: meeting_id is required"

        meeting = crud.get_meeting(db, meeting_id)
        if not meeting:
            return f"Error: Meeting {meeting_id} not found"

        date_str = meeting.meeting_date.strftime("%Y-%m-%d %H:%M") if meeting.meeting_date else "Not set"
        result = f"**Meeting: {meeting.filename or 'Untitled'}** (ID: {meeting.id})\n\n"
        result += f"- **Date:** {date_str}\n"
        if meeting.folder:
            result += f"- **Folder:** {meeting.folder}\n"
        if meeting.tags:
            result += f"- **Tags:** {meeting.tags}\n"
        result += f"- **Status:** {meeting.status}\n"

        if meeting.speakers:
            speaker_names = [f"{s.name}{' (' + s.label + ')' if s.label else ''}" for s in meeting.speakers]
            result += f"- **Speakers:** {', '.join(speaker_names)}\n"

        if meeting.transcription:
            if meeting.transcription.summary:
                summary_preview = meeting.transcription.summary[:300]
                if len(meeting.transcription.summary) > 300:
                    summary_preview += "..."
                result += f"\n**Summary:**\n{summary_preview}\n"

            action_items = meeting.transcription.action_items or []
            if action_items:
                pending = [a for a in action_items if a.status == "pending"]
                completed = [a for a in action_items if a.status == "completed"]
                result += f"\n**Action Items:** {len(action_items)} total ({len(pending)} pending, {len(completed)} completed)\n"

        if meeting.notes:
            notes_preview = meeting.notes[:200]
            if len(meeting.notes) > 200:
                notes_preview += "..."
            result += f"\n**Notes:**\n{notes_preview}\n"

        return result

    async def _handle_get_upcoming_deadlines(self, args: dict[str, Any], context: dict[str, Any]) -> str:
        """Handler for getting upcoming action item deadlines."""
        from ...models import ActionItem as GlobalActionItem

        db: Session = context["db"]
        project_id: int | None = context.get("project_id")
        meeting_ids: list[int] | None = context.get("meeting_ids")
        days_ahead = args.get("days_ahead", 14)
        include_overdue = args.get("include_overdue", True)

        now = datetime.now()
        now_aware = datetime.now(timezone.utc)
        future_date = now + timedelta(days=days_ahead)

        items = []

        # Query meeting action items — scoped to project meetings when in project context
        due_date_expr = cast(GlobalActionItem.due_date, DateTime)
        meeting_query = (
            db.query(GlobalActionItem, Meeting)
            .join(Transcription, GlobalActionItem.transcription_id == Transcription.id)
            .join(Meeting, Transcription.meeting_id == Meeting.id)
            .filter(GlobalActionItem.due_date.isnot(None))
            .filter(GlobalActionItem.status.in_(["pending", "in_progress"]))
        )
        if meeting_ids:
            meeting_query = meeting_query.filter(Meeting.id.in_(meeting_ids))
        if include_overdue:
            meeting_query = meeting_query.filter(due_date_expr <= future_date)
        else:
            meeting_query = meeting_query.filter(
                due_date_expr >= now,
                due_date_expr <= future_date,
            )
        for ai, meeting in meeting_query.order_by(due_date_expr.asc()).all():
            due_value = ai.due_date
            try:
                parsed_due = datetime.fromisoformat(due_value) if isinstance(due_value, str) else due_value
            except ValueError:
                parsed_due = None
            is_overdue = False
            if parsed_due is not None:
                if parsed_due.tzinfo is not None:
                    is_overdue = parsed_due.astimezone(timezone.utc) < now_aware
                else:
                    is_overdue = parsed_due < now
            items.append(
                {
                    "type": "meeting",
                    "id": ai.id,
                    "task": ai.task,
                    "owner": ai.owner,
                    "due_date": str(ai.due_date),
                    "status": ai.status,
                    "overdue": is_overdue,
                    "meeting_name": meeting.filename or f"Meeting {meeting.id}",
                    "meeting_id": meeting.id,
                }
            )

        # Project action items are stored as meeting action items; meeting_ids already scope project context.

        if not items:
            return f"No upcoming deadlines in the next {days_ahead} days."

        # Sort all by due date
        items.sort(key=lambda x: x["due_date"])

        overdue_items = [i for i in items if i.get("overdue")]
        upcoming_items = [i for i in items if not i.get("overdue")]

        result = ""
        if overdue_items:
            result += f"⚠️ **Overdue ({len(overdue_items)} items):**\n\n"
            for item in overdue_items:
                result += f"- **{item['task']}** (ID: {item['id']})\n"
                result += f"  Due: {item['due_date']} | Status: {item['status']}"
                if item.get("owner"):
                    result += f" | Owner: {item['owner']}"
                if item.get("meeting_name"):
                    result += f" | Meeting: {item['meeting_name']}"
                result += "\n\n"

        if upcoming_items:
            result += f"📅 **Upcoming ({len(upcoming_items)} items):**\n\n"
            for item in upcoming_items:
                result += f"- **{item['task']}** (ID: {item['id']})\n"
                result += f"  Due: {item['due_date']} | Status: {item['status']}"
                if item.get("owner"):
                    result += f" | Owner: {item['owner']}"
                if item.get("meeting_name"):
                    result += f" | Meeting: {item['meeting_name']}"
                result += "\n\n"

        return result

    async def _handle_delete_action_item(self, args: dict[str, Any], context: dict[str, Any]) -> str:
        """Handler for deleting an action item."""
        db: Session = context["db"]
        item_id: int = args["item_id"]

        # Try meeting action item first
        from ...models import ActionItem as GlobalActionItem

        item = db.query(GlobalActionItem).filter(GlobalActionItem.id == item_id).first()
        if item:
            task_name = item.task
            db.delete(item)
            db.commit()
            return f"Action item {item_id} ('{task_name}') deleted successfully."

        return f"Error: Action item with ID {item_id} not found."

    async def _handle_iterative_research(self, args: dict[str, Any], context: dict[str, Any]) -> str:
        """Handler for iterative research with multi-step reasoning.

        This tool performs deep research by:
        1. Taking an initial question
        2. Retrieving relevant sources
        3. Analyzing results and generating follow-up questions
        4. Repeating the process until reaching a satisfactory answer or depth limit

        Returns a structured response showing the reasoning chain.
        """
        from ..storage import rag

        db: Session = context["db"]
        meeting_id: int | None = context.get("meeting_id")
        llm_config = context.get("llm_config")

        initial_question = args["question"]
        max_depth = args.get("max_depth", 3)

        # Validate max_depth
        if max_depth < 1:
            max_depth = 1
        elif max_depth > 10:
            max_depth = 10  # Safety limit

        reasoning_chain = []
        current_question = initial_question

        logger.info(f"Starting iterative research with max_depth={max_depth}")

        for step in range(max_depth):
            logger.info(f"Iterative research step {step + 1}/{max_depth}: {current_question}")

            # Retrieve relevant sources for current question
            try:
                chunks = rag.retrieve_relevant_chunks(db, query=current_question, meeting_id=meeting_id, top_k=5)

                sources_text = rag._format_context(chunks)
                source_summaries = [
                    {
                        "meeting_id": chunk.chunk.meeting_id,
                        "content_type": chunk.chunk.content_type,
                        "snippet": chunk.chunk.content[:150] + "..."
                        if len(chunk.chunk.content) > 150
                        else chunk.chunk.content,
                        "similarity": chunk.similarity,
                    }
                    for chunk in chunks[:3]  # Include top 3 sources
                ]

            except Exception as e:
                logger.error(f"Error retrieving sources in iterative research: {e}", exc_info=True)
                sources_text = "Error retrieving sources"
                source_summaries = []

            # Analyze the sources and determine if we need to go deeper
            analysis_prompt = f"""Based on the following sources, analyze the answer to this question: "{current_question}"

Sources:
{sources_text}

Provide:
1. A concise answer based on the sources (2-3 sentences)
2. Your confidence in the answer (low/medium/high)
3. If confidence is not high AND we haven't reached the depth limit, suggest ONE specific follow-up question that would help get a better answer. If confidence is high or we're at the limit, say "COMPLETE".

Format your response as:
ANSWER: [your answer]
CONFIDENCE: [low/medium/high]
FOLLOW_UP: [next question or "COMPLETE"]"""

            try:
                # Use the chat provider to analyze
                from . import chat

                if not llm_config:
                    llm_config = chat.get_default_chat_config()

                provider = chat.ProviderFactory.create_provider(llm_config)
                analysis_response = await provider.chat_completion(
                    messages=[{"role": "user", "content": analysis_prompt}],
                    system_prompt="You are a research assistant analyzing information to answer questions. Be concise and specific.",
                )

                # Parse the response
                answer_line = ""
                confidence_line = ""
                follow_up_line = ""

                for line in analysis_response.split("\n"):
                    if line.startswith("ANSWER:"):
                        answer_line = line.replace("ANSWER:", "").strip()
                    elif line.startswith("CONFIDENCE:"):
                        confidence_line = line.replace("CONFIDENCE:", "").strip()
                    elif line.startswith("FOLLOW_UP:"):
                        follow_up_line = line.replace("FOLLOW_UP:", "").strip()

                step_info = {
                    "step": step + 1,
                    "question": current_question,
                    "answer": answer_line or "Unable to determine answer",
                    "confidence": confidence_line or "unknown",
                    "sources": source_summaries,
                    "follow_up": follow_up_line or "COMPLETE",
                }

                reasoning_chain.append(step_info)

                # Check if we should continue
                if follow_up_line.upper() == "COMPLETE" or not follow_up_line or step == max_depth - 1:
                    logger.info(f"Iterative research complete at step {step + 1}")
                    break

                # Use the follow-up question for next iteration
                current_question = follow_up_line

            except Exception as e:
                logger.error(f"Error in iterative research analysis: {e}", exc_info=True)
                reasoning_chain.append(
                    {
                        "step": step + 1,
                        "question": current_question,
                        "answer": f"Error during analysis: {str(e)}",
                        "confidence": "low",
                        "sources": source_summaries,
                        "follow_up": "COMPLETE",
                    }
                )
                break

        # Format the final response
        result = "🔍 **Iterative Research Results**\n\n"
        result += f"**Initial Question:** {initial_question}\n"
        result += f"**Research Depth:** {len(reasoning_chain)} step(s)\n\n"

        for step_info in reasoning_chain:
            result += f"### Step {step_info['step']}: {step_info['question']}\n\n"
            result += f"**Answer:** {step_info['answer']}\n\n"
            result += f"**Confidence:** {step_info['confidence']}\n\n"

            if step_info["sources"]:
                result += f"**Sources:** {len(step_info['sources'])} relevant chunks found\n\n"

            if step_info["follow_up"] and step_info["follow_up"].upper() != "COMPLETE":
                result += f"**Follow-up:** {step_info['follow_up']}\n\n"

            result += "---\n\n"

        # Add final conclusion
        final_answer = reasoning_chain[-1]["answer"] if reasoning_chain else "No conclusion reached"
        result += f"### Final Conclusion\n\n{final_answer}\n"

        return result


# Global tool registry instance
tool_registry = ToolRegistry()
