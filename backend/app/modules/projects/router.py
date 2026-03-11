"""API router for projects feature."""

import os
import re
import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.config import get_app_config
from app.core.integrations.export import (
    export_project_to_docx,
    export_project_to_json,
    export_project_to_pdf,
    export_project_to_txt,
)
from app.dependencies import get_db

from ..meetings import schemas as meeting_schemas
from . import schemas
from .service import ProjectService

router = APIRouter(prefix="/api/v1/projects", tags=["projects"])
config = get_app_config()


def _service(db: Session) -> ProjectService:
    return ProjectService(db)


# ============ PROJECT CRUD ============


@router.get("/", response_model=list[schemas.Project])
def list_projects(status: str | None = None, db: Session = Depends(get_db)):
    """List all projects with summary stats."""
    return _service(db).list_projects(status)


@router.post("/", response_model=schemas.Project, status_code=201)
def create_project(project: schemas.ProjectCreate, db: Session = Depends(get_db)):
    """Create a new project."""
    return _service(db).create_project(project)


@router.get("/{project_id}", response_model=schemas.ProjectWithDetails)
def get_project(project_id: int, db: Session = Depends(get_db)):
    """Get project with full details."""
    return _service(db).get_project_with_details(project_id)


@router.put("/{project_id}", response_model=schemas.Project)
def update_project(project_id: int, update: schemas.ProjectUpdate, db: Session = Depends(get_db)):
    """Update project details."""
    return _service(db).update_project(project_id, update)


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: int, delete_meetings: bool = False, db: Session = Depends(get_db)):
    """Delete project (optionally delete associated meetings)."""
    _service(db).delete_project(project_id, delete_meetings)
    return None


# ============ PROJECT MEETINGS ============


@router.get("/{project_id}/meetings")
def get_project_meetings(
    project_id: int,
    status: str | None = None,
    sort_by: str = "date",
    sort_order: str = "desc",
    db: Session = Depends(get_db),
):
    """Get all meetings in the project."""
    return _service(db).get_project_meetings(project_id, status, sort_by, sort_order)


@router.post("/{project_id}/meetings/{meeting_id}", status_code=201)
def add_meeting_to_project(project_id: int, meeting_id: int, db: Session = Depends(get_db)):
    """Link a meeting to a project."""
    return _service(db).add_meeting_to_project(project_id, meeting_id)


@router.delete("/{project_id}/meetings/{meeting_id}", status_code=204)
def remove_meeting_from_project(project_id: int, meeting_id: int, db: Session = Depends(get_db)):
    """Unlink a meeting from a project."""
    _service(db).remove_meeting_from_project(project_id, meeting_id)
    return None


# ============ PROJECT MEMBERS ============


@router.get("/{project_id}/members", response_model=list[schemas.ProjectMember])
def get_project_members(project_id: int, db: Session = Depends(get_db)):
    """Get project team members."""
    return _service(db).get_project_members(project_id)


@router.post("/{project_id}/members", response_model=schemas.ProjectMember, status_code=201)
def add_project_member(project_id: int, member: schemas.ProjectMemberCreate, db: Session = Depends(get_db)):
    """Manually add a team member."""
    return _service(db).add_project_member(project_id, member)


@router.put("/{project_id}/members/{member_id}", response_model=schemas.ProjectMember)
def update_project_member(
    project_id: int, member_id: int, update: schemas.ProjectMemberUpdate, db: Session = Depends(get_db)
):
    """Update member role."""
    return _service(db).update_project_member(project_id, member_id, update)


@router.delete("/{project_id}/members/{member_id}", status_code=204)
def remove_project_member(project_id: int, member_id: int, db: Session = Depends(get_db)):
    """Remove a team member."""
    _service(db).remove_project_member(project_id, member_id)
    return None


@router.post("/{project_id}/members/sync", response_model=list[schemas.ProjectMember])
def sync_project_members(project_id: int, db: Session = Depends(get_db)):
    """Auto-detect and sync members from meeting speakers."""
    return _service(db).sync_project_members(project_id)


# ============ PROJECT MILESTONES ============


@router.get("/{project_id}/milestones", response_model=list[schemas.ProjectMilestone])
def get_project_milestones(project_id: int, db: Session = Depends(get_db)):
    """Get project milestones."""
    return _service(db).get_project_milestones(project_id)


@router.post("/{project_id}/milestones", response_model=schemas.ProjectMilestone, status_code=201)
def create_milestone(project_id: int, milestone: schemas.ProjectMilestoneCreate, db: Session = Depends(get_db)):
    """Create a new milestone."""
    return _service(db).create_milestone(project_id, milestone)


@router.put("/{project_id}/milestones/{milestone_id}", response_model=schemas.ProjectMilestone)
def update_milestone(
    project_id: int, milestone_id: int, update: schemas.ProjectMilestoneUpdate, db: Session = Depends(get_db)
):
    """Update milestone."""
    return _service(db).update_milestone(project_id, milestone_id, update)


@router.post("/{project_id}/milestones/{milestone_id}/complete", response_model=schemas.ProjectMilestone)
def complete_milestone(project_id: int, milestone_id: int, db: Session = Depends(get_db)):
    """Mark milestone as completed."""
    return _service(db).complete_milestone(project_id, milestone_id)


@router.delete("/{project_id}/milestones/{milestone_id}", status_code=204)
def delete_milestone(project_id: int, milestone_id: int, db: Session = Depends(get_db)):
    """Delete milestone."""
    _service(db).delete_milestone(project_id, milestone_id)
    return None


# ============ PROJECT ACTION ITEMS ============


@router.get("/{project_id}/action-items")
def get_project_action_items(
    project_id: int, status: str | None = None, owner: str | None = None, db: Session = Depends(get_db)
):
    """Get all action items from meetings in this project."""
    return _service(db).get_project_action_items(project_id, status, owner)


@router.post("/{project_id}/action-items", response_model=meeting_schemas.ActionItem, status_code=201)
def create_project_action_item(
    project_id: int, action_item: schemas.ProjectActionItemCreate, db: Session = Depends(get_db)
):
    """Create a manual action item within a project."""
    return _service(db).create_project_action_item(project_id, action_item)


@router.post("/{project_id}/action-items/{action_item_id}", status_code=status.HTTP_201_CREATED)
def link_action_item_to_project(project_id: int, action_item_id: int, db: Session = Depends(get_db)):
    """Link an existing action item to a project."""
    try:
        _service(db).link_action_item_to_project(project_id, action_item_id)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return {"detail": "Linked"}


@router.delete("/{project_id}/action-items/{action_item_id}", status_code=status.HTTP_204_NO_CONTENT)
def unlink_action_item_from_project(project_id: int, action_item_id: int, db: Session = Depends(get_db)):
    """Unlink an action item from a project (does not delete the action item itself)."""
    try:
        _service(db).unlink_action_item_from_project(project_id, action_item_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return


@router.post("/{project_id}/gantt/links", response_model=schemas.GanttLink, status_code=201)
def add_gantt_link(project_id: int, link: schemas.GanttLinkCreate, db: Session = Depends(get_db)):
    """Add a gantt dependency link for a project."""
    return _service(db).add_gantt_link(project_id, link.source, link.target, link.type)


@router.delete("/{project_id}/gantt/links/{link_id}", status_code=204)
def delete_gantt_link(project_id: int, link_id: str, db: Session = Depends(get_db)):
    """Delete a gantt dependency link for a project."""
    _service(db).delete_gantt_link(project_id, link_id)
    return None


# ============ PROJECT CHAT ============


@router.get("/{project_id}/chat/sessions", response_model=list[schemas.ProjectChatSession])
def get_chat_sessions(project_id: int, db: Session = Depends(get_db)):
    """Get all chat sessions for the project."""
    return _service(db).get_chat_sessions(project_id)


@router.post("/{project_id}/chat/sessions", response_model=schemas.ProjectChatSession, status_code=201)
def create_chat_session(project_id: int, session_data: schemas.ProjectChatSessionCreate, db: Session = Depends(get_db)):
    """Create a new chat session."""
    return _service(db).create_chat_session(project_id, session_data)


@router.put("/{project_id}/chat/sessions/{session_id}", response_model=schemas.ProjectChatSession)
def update_chat_session(
    project_id: int, session_id: int, payload: schemas.ProjectChatSessionUpdate, db: Session = Depends(get_db)
):
    """Update a chat session."""
    return _service(db).update_chat_session(project_id, session_id, payload)


@router.post("/{project_id}/chat", response_model=schemas.ProjectChatResponse)
async def chat_with_project(project_id: int, request: schemas.ProjectChatRequest, db: Session = Depends(get_db)):
    """Chat with AI about the project (RAG over all project meetings)."""
    return await _service(db).chat_with_project(project_id, request)


@router.get("/{project_id}/chat/sessions/{session_id}/messages", response_model=list[schemas.ProjectChatMessage])
def get_chat_messages(project_id: int, session_id: int, db: Session = Depends(get_db)):
    """Get messages in a chat session."""
    return _service(db).get_chat_messages(project_id, session_id)


@router.delete("/{project_id}/chat/sessions/{session_id}", status_code=204)
def delete_chat_session(project_id: int, session_id: int, db: Session = Depends(get_db)):
    """Delete a chat session."""
    _service(db).delete_chat_session(project_id, session_id)
    return None


# ============ PROJECT NOTES ============


@router.get("/{project_id}/notes", response_model=list[schemas.ProjectNote])
def get_project_notes(project_id: int, db: Session = Depends(get_db)):
    """Get project notes."""
    return _service(db).get_project_notes(project_id)


@router.post("/{project_id}/notes", response_model=schemas.ProjectNote, status_code=201)
def create_note(project_id: int, note: schemas.ProjectNoteCreate, db: Session = Depends(get_db)):
    """Create a project note."""
    return _service(db).create_note(project_id, note)


@router.put("/{project_id}/notes/{note_id}", response_model=schemas.ProjectNote)
def update_note(project_id: int, note_id: int, update: schemas.ProjectNoteUpdate, db: Session = Depends(get_db)):
    """Update a note."""
    return _service(db).update_note(project_id, note_id, update)


@router.delete("/{project_id}/notes/{note_id}", status_code=204)
def delete_note(project_id: int, note_id: int, db: Session = Depends(get_db)):
    """Delete a note."""
    _service(db).delete_note(project_id, note_id)
    return None


@router.get("/{project_id}/notes/{note_id}/attachments", response_model=list[schemas.ProjectNoteAttachment])
def list_note_attachments(project_id: int, note_id: int, db: Session = Depends(get_db)):
    """List attachments for a project note."""
    return _service(db).list_note_attachments(project_id, note_id)


@router.post("/{project_id}/notes/{note_id}/attachments", response_model=schemas.ProjectNoteAttachment, status_code=201)
async def upload_note_attachment(
    project_id: int,
    note_id: int,
    file: UploadFile = File(...),
    description: str | None = Form(None),
    db: Session = Depends(get_db),
):
    """Upload an attachment for a project note."""
    return await _service(db).upload_note_attachment(project_id, note_id, file, description)


@router.get("/notes/attachments/{attachment_id}/download")
async def download_note_attachment(attachment_id: int, db: Session = Depends(get_db)):
    """Download a project note attachment."""
    attachment = _service(db).get_note_attachment(attachment_id)

    file_path = Path(attachment.filepath)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Attachment file not found on disk")

    return FileResponse(path=str(file_path), media_type=attachment.mime_type, filename=attachment.filename)


@router.get("/notes/attachments/{attachment_id}/preview")
async def preview_note_attachment(attachment_id: int, db: Session = Depends(get_db)):
    """Preview a project note attachment in-browser."""
    attachment = _service(db).get_note_attachment(attachment_id)

    file_path = Path(attachment.filepath)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Attachment file not found on disk")

    return FileResponse(
        path=str(file_path),
        media_type=attachment.mime_type,
        filename=attachment.filename,
        headers={"Content-Disposition": f'inline; filename="{attachment.filename}"'},
    )


@router.put("/notes/attachments/{attachment_id}", response_model=schemas.ProjectNoteAttachment)
def update_note_attachment(
    attachment_id: int,
    description: str = Body(..., embed=True),
    db: Session = Depends(get_db),
):
    """Update note attachment description."""
    return _service(db).update_note_attachment_description(attachment_id, description)


@router.delete("/notes/attachments/{attachment_id}", status_code=204)
def delete_note_attachment(attachment_id: int, db: Session = Depends(get_db)):
    """Delete a note attachment and its embeddings."""
    _service(db).delete_note_attachment(attachment_id)
    return None


# ============ PROJECT ANALYTICS ============


@router.get("/{project_id}/analytics", response_model=schemas.ProjectAnalytics)
def get_project_analytics(project_id: int, db: Session = Depends(get_db)):
    """Get project analytics and insights."""
    return _service(db).get_project_analytics(project_id)


@router.get("/{project_id}/activity", response_model=list[schemas.ActivityItem])
def get_project_activity(project_id: int, limit: int = 50, db: Session = Depends(get_db)):
    """Get recent activity feed for the project."""
    return _service(db).get_project_activity(project_id, limit)


# ============ PROJECT EXPORT ============


@router.get("/{project_id}/export")
def export_project(project_id: int, format: str = "pdf", db: Session = Depends(get_db)):
    """Export project summary to PDF/DOCX/TXT/JSON."""
    data = _service(db).get_project_export_data(project_id)

    temp_dir = tempfile.mkdtemp()
    project_name = data.get("project", {}).get("name") or f"project_{project_id}"
    safe_name = re.sub(r"[^\w\s.-]", "", project_name).strip().replace(" ", "_") or f"project_{project_id}"
    base_name = Path(safe_name).stem

    try:
        export_path = None
        fmt = format.lower()
        if fmt == "json":
            export_path = export_project_to_json(data, os.path.join(temp_dir, f"{base_name}.json"))
        elif fmt == "txt":
            export_path = export_project_to_txt(data, os.path.join(temp_dir, f"{base_name}.txt"))
        elif fmt == "docx":
            export_path = export_project_to_docx(data, os.path.join(temp_dir, f"{base_name}.docx"))
            if export_path is None:
                raise HTTPException(
                    status_code=500,
                    detail="DOCX export not available. python-docx library may not be installed.",
                )
        elif fmt == "pdf":
            export_path = export_project_to_pdf(data, os.path.join(temp_dir, f"{base_name}.pdf"))
            if export_path is None:
                raise HTTPException(
                    status_code=500,
                    detail="PDF export not available. reportlab library may not be installed.",
                )
        else:
            raise HTTPException(status_code=400, detail="Unsupported export format")

        if not export_path or not os.path.exists(export_path):
            raise HTTPException(status_code=500, detail="Failed to generate export file")

        media_types = {
            "json": "application/json",
            "txt": "text/plain",
            "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "pdf": "application/pdf",
        }

        return FileResponse(
            path=str(export_path),
            media_type=media_types[fmt],
            filename=f"{base_name}.{fmt}",
            background=None,
        )
    except Exception as exc:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"Error generating export: {str(exc)}")


# ============ PROJECT GANTT/TIMELINE ============


@router.get("/{project_id}/gantt", response_model=schemas.GanttData)
def get_gantt_data(project_id: int, db: Session = Depends(get_db)):
    """Get data for Gantt chart visualization."""
    return _service(db).get_gantt_data(project_id)


@router.patch("/{project_id}/gantt/items/{item_id}", response_model=schemas.GanttItem)
def update_gantt_item(project_id: int, item_id: str, update: schemas.GanttItemUpdate, db: Session = Depends(get_db)):
    """Update a Gantt item (meeting, milestone, or action item)."""
    return _service(db).update_gantt_item(project_id, item_id, update)
