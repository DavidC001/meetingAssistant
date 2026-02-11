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
from .repository import (
    ProjectChatRepository,
    ProjectMemberRepository,
    ProjectMilestoneRepository,
    ProjectNoteAttachmentRepository,
    ProjectNoteRepository,
)
from .service import ProjectService

router = APIRouter(prefix="/api/v1/projects", tags=["projects"])
config = get_app_config()


# ============ PROJECT CRUD ============


@router.get("/", response_model=list[schemas.Project])
def list_projects(status: str | None = None, db: Session = Depends(get_db)):
    """List all projects with summary stats."""
    service = ProjectService(db)
    return service.list_projects(status)


@router.post("/", response_model=schemas.Project, status_code=201)
def create_project(project: schemas.ProjectCreate, db: Session = Depends(get_db)):
    """Create a new project."""
    service = ProjectService(db)
    return service.create_project(project)


@router.get("/{project_id}", response_model=schemas.ProjectWithDetails)
def get_project(project_id: int, db: Session = Depends(get_db)):
    """Get project with full details."""
    service = ProjectService(db)
    return service.get_project_with_details(project_id)


@router.put("/{project_id}", response_model=schemas.Project)
def update_project(project_id: int, update: schemas.ProjectUpdate, db: Session = Depends(get_db)):
    """Update project details."""
    service = ProjectService(db)
    return service.update_project(project_id, update)


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: int, delete_meetings: bool = False, db: Session = Depends(get_db)):
    """Delete project (optionally delete associated meetings)."""
    service = ProjectService(db)
    service.delete_project(project_id, delete_meetings)
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
    service = ProjectService(db)
    return service.get_project_meetings(project_id, status, sort_by, sort_order)


@router.post("/{project_id}/meetings/{meeting_id}", status_code=201)
def add_meeting_to_project(project_id: int, meeting_id: int, db: Session = Depends(get_db)):
    """Link a meeting to a project."""
    service = ProjectService(db)
    return service.add_meeting_to_project(project_id, meeting_id)


@router.delete("/{project_id}/meetings/{meeting_id}", status_code=204)
def remove_meeting_from_project(project_id: int, meeting_id: int, db: Session = Depends(get_db)):
    """Unlink a meeting from a project."""
    service = ProjectService(db)
    service.remove_meeting_from_project(project_id, meeting_id)
    return None


# ============ PROJECT MEMBERS ============


@router.get("/{project_id}/members", response_model=list[schemas.ProjectMember])
def get_project_members(project_id: int, db: Session = Depends(get_db)):
    """Get project team members."""
    member_repo = ProjectMemberRepository(db)
    members = member_repo.list_by_project(project_id)
    return [schemas.ProjectMember.model_validate(m) for m in members]


@router.post("/{project_id}/members", response_model=schemas.ProjectMember, status_code=201)
def add_project_member(project_id: int, member: schemas.ProjectMemberCreate, db: Session = Depends(get_db)):
    """Manually add a team member."""
    member_repo = ProjectMemberRepository(db)
    member_data = member.model_dump()
    member_data["is_auto_detected"] = False
    new_member = member_repo.create(project_id, member_data)
    return schemas.ProjectMember.model_validate(new_member)


@router.put("/{project_id}/members/{member_id}", response_model=schemas.ProjectMember)
def update_project_member(
    project_id: int, member_id: int, update: schemas.ProjectMemberUpdate, db: Session = Depends(get_db)
):
    """Update member role."""
    member_repo = ProjectMemberRepository(db)
    member = member_repo.get(member_id)
    if not member or member.project_id != project_id:
        raise HTTPException(status_code=404, detail="Member not found")

    update_data = update.model_dump(exclude_unset=True)
    updated_member = member_repo.update(member, update_data)
    return schemas.ProjectMember.model_validate(updated_member)


@router.delete("/{project_id}/members/{member_id}", status_code=204)
def remove_project_member(project_id: int, member_id: int, db: Session = Depends(get_db)):
    """Remove a team member."""
    member_repo = ProjectMemberRepository(db)
    member = member_repo.get(member_id)
    if not member or member.project_id != project_id:
        raise HTTPException(status_code=404, detail="Member not found")

    member_repo.delete(member)
    return None


@router.post("/{project_id}/members/sync", response_model=list[schemas.ProjectMember])
def sync_project_members(project_id: int, db: Session = Depends(get_db)):
    """Auto-detect and sync members from meeting speakers."""
    service = ProjectService(db)
    return service.sync_project_members(project_id)


# ============ PROJECT MILESTONES ============


@router.get("/{project_id}/milestones", response_model=list[schemas.ProjectMilestone])
def get_project_milestones(project_id: int, db: Session = Depends(get_db)):
    """Get project milestones."""
    milestone_repo = ProjectMilestoneRepository(db)
    milestones = milestone_repo.list_by_project(project_id)
    return [schemas.ProjectMilestone.model_validate(m) for m in milestones]


@router.post("/{project_id}/milestones", response_model=schemas.ProjectMilestone, status_code=201)
def create_milestone(project_id: int, milestone: schemas.ProjectMilestoneCreate, db: Session = Depends(get_db)):
    """Create a new milestone."""
    milestone_repo = ProjectMilestoneRepository(db)
    milestone_data = milestone.model_dump()
    new_milestone = milestone_repo.create(project_id, milestone_data)
    return schemas.ProjectMilestone.model_validate(new_milestone)


@router.put("/{project_id}/milestones/{milestone_id}", response_model=schemas.ProjectMilestone)
def update_milestone(
    project_id: int, milestone_id: int, update: schemas.ProjectMilestoneUpdate, db: Session = Depends(get_db)
):
    """Update milestone."""
    milestone_repo = ProjectMilestoneRepository(db)
    milestone = milestone_repo.get(milestone_id)
    if not milestone or milestone.project_id != project_id:
        raise HTTPException(status_code=404, detail="Milestone not found")

    update_data = update.model_dump(exclude_unset=True)
    updated_milestone = milestone_repo.update(milestone, update_data)
    return schemas.ProjectMilestone.model_validate(updated_milestone)


@router.post("/{project_id}/milestones/{milestone_id}/complete", response_model=schemas.ProjectMilestone)
def complete_milestone(project_id: int, milestone_id: int, db: Session = Depends(get_db)):
    """Mark milestone as completed."""
    milestone_repo = ProjectMilestoneRepository(db)
    milestone = milestone_repo.get(milestone_id)
    if not milestone or milestone.project_id != project_id:
        raise HTTPException(status_code=404, detail="Milestone not found")

    completed_milestone = milestone_repo.complete(milestone)
    return schemas.ProjectMilestone.model_validate(completed_milestone)


@router.delete("/{project_id}/milestones/{milestone_id}", status_code=204)
def delete_milestone(project_id: int, milestone_id: int, db: Session = Depends(get_db)):
    """Delete milestone."""
    milestone_repo = ProjectMilestoneRepository(db)
    milestone = milestone_repo.get(milestone_id)
    if not milestone or milestone.project_id != project_id:
        raise HTTPException(status_code=404, detail="Milestone not found")

    milestone_repo.delete(milestone)
    return None


# ============ PROJECT ACTION ITEMS ============


@router.get("/{project_id}/action-items")
def get_project_action_items(
    project_id: int, status: str | None = None, owner: str | None = None, db: Session = Depends(get_db)
):
    """Get all action items from meetings in this project."""
    service = ProjectService(db)
    return service.get_project_action_items(project_id, status, owner)


@router.post("/{project_id}/action-items", response_model=meeting_schemas.ActionItem, status_code=201)
def create_project_action_item(
    project_id: int, action_item: schemas.ProjectActionItemCreate, db: Session = Depends(get_db)
):
    """Create a manual action item within a project."""
    service = ProjectService(db)
    return service.create_project_action_item(project_id, action_item)


@router.post("/{project_id}/action-items/{action_item_id}", status_code=status.HTTP_201_CREATED)
def link_action_item_to_project(project_id: int, action_item_id: int, db: Session = Depends(get_db)):
    """Link an existing action item to a project."""
    service = ProjectService(db)
    try:
        service.link_action_item_to_project(project_id, action_item_id)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return {"detail": "Linked"}


@router.delete("/{project_id}/action-items/{action_item_id}", status_code=status.HTTP_204_NO_CONTENT)
def unlink_action_item_from_project(project_id: int, action_item_id: int, db: Session = Depends(get_db)):
    """Unlink an action item from a project (does not delete the action item itself)."""
    service = ProjectService(db)
    try:
        service.unlink_action_item_from_project(project_id, action_item_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return


@router.post("/{project_id}/gantt/links", response_model=schemas.GanttLink, status_code=201)
def add_gantt_link(project_id: int, link: schemas.GanttLinkCreate, db: Session = Depends(get_db)):
    """Add a gantt dependency link for a project."""
    service = ProjectService(db)
    return service.add_gantt_link(project_id, link.source, link.target, link.type)


@router.delete("/{project_id}/gantt/links/{link_id}", status_code=204)
def delete_gantt_link(project_id: int, link_id: str, db: Session = Depends(get_db)):
    """Delete a gantt dependency link for a project."""
    service = ProjectService(db)
    service.delete_gantt_link(project_id, link_id)
    return None


# ============ PROJECT CHAT ============


@router.get("/{project_id}/chat/sessions", response_model=list[schemas.ProjectChatSession])
def get_chat_sessions(project_id: int, db: Session = Depends(get_db)):
    """Get all chat sessions for the project."""
    chat_repo = ProjectChatRepository(db)
    sessions = chat_repo.list_sessions(project_id)

    # Add message count to each session
    result = []
    for session in sessions:
        messages = chat_repo.list_messages(session.id)
        session_dict = {
            "id": session.id,
            "project_id": session.project_id,
            "title": session.title,
            "created_at": session.created_at,
            "updated_at": session.updated_at,
            "message_count": len(messages),
        }
        result.append(schemas.ProjectChatSession(**session_dict))

    return result


@router.post("/{project_id}/chat/sessions", response_model=schemas.ProjectChatSession, status_code=201)
def create_chat_session(project_id: int, session_data: schemas.ProjectChatSessionCreate, db: Session = Depends(get_db)):
    """Create a new chat session."""
    chat_repo = ProjectChatRepository(db)
    session = chat_repo.create_session(project_id, session_data.title)
    return schemas.ProjectChatSession(
        id=session.id,
        project_id=session.project_id,
        title=session.title,
        created_at=session.created_at,
        updated_at=session.updated_at,
        message_count=0,
    )


@router.put("/{project_id}/chat/sessions/{session_id}", response_model=schemas.ProjectChatSession)
def update_chat_session(
    project_id: int, session_id: int, payload: schemas.ProjectChatSessionUpdate, db: Session = Depends(get_db)
):
    """Update a chat session."""
    chat_repo = ProjectChatRepository(db)
    session = chat_repo.get_session(session_id)
    if not session or session.project_id != project_id:
        raise HTTPException(status_code=404, detail="Chat session not found")

    updated = chat_repo.update_session(session, title=payload.title)
    messages = chat_repo.list_messages(session.id)
    return schemas.ProjectChatSession(
        id=updated.id,
        project_id=updated.project_id,
        title=updated.title,
        created_at=updated.created_at,
        updated_at=updated.updated_at,
        message_count=len(messages),
    )


@router.post("/{project_id}/chat", response_model=schemas.ProjectChatResponse)
async def chat_with_project(project_id: int, request: schemas.ProjectChatRequest, db: Session = Depends(get_db)):
    """Chat with AI about the project (RAG over all project meetings)."""
    service = ProjectService(db)
    return await service.chat_with_project(project_id, request)


@router.get("/{project_id}/chat/sessions/{session_id}/messages", response_model=list[schemas.ProjectChatMessage])
def get_chat_messages(project_id: int, session_id: int, db: Session = Depends(get_db)):
    """Get messages in a chat session."""
    chat_repo = ProjectChatRepository(db)
    session = chat_repo.get_session(session_id)
    if not session or session.project_id != project_id:
        raise HTTPException(status_code=404, detail="Chat session not found")

    messages = chat_repo.list_messages(session_id)
    return [schemas.ProjectChatMessage.model_validate(m) for m in messages]


@router.delete("/{project_id}/chat/sessions/{session_id}", status_code=204)
def delete_chat_session(project_id: int, session_id: int, db: Session = Depends(get_db)):
    """Delete a chat session."""
    chat_repo = ProjectChatRepository(db)
    session = chat_repo.get_session(session_id)
    if not session or session.project_id != project_id:
        raise HTTPException(status_code=404, detail="Chat session not found")

    chat_repo.delete_session(session)
    return None


# ============ PROJECT NOTES ============


@router.get("/{project_id}/notes", response_model=list[schemas.ProjectNote])
def get_project_notes(project_id: int, db: Session = Depends(get_db)):
    """Get project notes."""
    note_repo = ProjectNoteRepository(db)
    notes = note_repo.list_by_project(project_id)
    return [schemas.ProjectNote.model_validate(n) for n in notes]


@router.post("/{project_id}/notes", response_model=schemas.ProjectNote, status_code=201)
def create_note(project_id: int, note: schemas.ProjectNoteCreate, db: Session = Depends(get_db)):
    """Create a project note."""
    note_repo = ProjectNoteRepository(db)
    note_data = note.model_dump()
    new_note = note_repo.create(project_id, note_data)
    try:
        from ...tasks import index_project_note

        index_project_note.delay(new_note.id)
    except Exception:
        pass
    return schemas.ProjectNote.model_validate(new_note)


@router.put("/{project_id}/notes/{note_id}", response_model=schemas.ProjectNote)
def update_note(project_id: int, note_id: int, update: schemas.ProjectNoteUpdate, db: Session = Depends(get_db)):
    """Update a note."""
    note_repo = ProjectNoteRepository(db)
    note = note_repo.get(note_id)
    if not note or note.project_id != project_id:
        raise HTTPException(status_code=404, detail="Note not found")

    update_data = update.model_dump(exclude_unset=True)
    updated_note = note_repo.update(note, update_data)
    try:
        from ...tasks import index_project_note

        index_project_note.delay(updated_note.id)
    except Exception:
        pass
    return schemas.ProjectNote.model_validate(updated_note)


@router.delete("/{project_id}/notes/{note_id}", status_code=204)
def delete_note(project_id: int, note_id: int, db: Session = Depends(get_db)):
    """Delete a note."""
    note_repo = ProjectNoteRepository(db)
    note = note_repo.get(note_id)
    if not note or note.project_id != project_id:
        raise HTTPException(status_code=404, detail="Note not found")

    note_repo.delete(note)
    try:
        from ...tasks import remove_project_note_embeddings

        remove_project_note_embeddings.delay(note_id)
    except Exception:
        pass
    return None


@router.get("/{project_id}/notes/{note_id}/attachments", response_model=list[schemas.ProjectNoteAttachment])
def list_note_attachments(project_id: int, note_id: int, db: Session = Depends(get_db)):
    """List attachments for a project note."""
    note_repo = ProjectNoteRepository(db)
    note = note_repo.get(note_id)
    if not note or note.project_id != project_id:
        raise HTTPException(status_code=404, detail="Note not found")

    attachment_repo = ProjectNoteAttachmentRepository(db)
    attachments = attachment_repo.list_by_note(note_id)
    return [schemas.ProjectNoteAttachment.model_validate(a) for a in attachments]


@router.post("/{project_id}/notes/{note_id}/attachments", response_model=schemas.ProjectNoteAttachment, status_code=201)
async def upload_note_attachment(
    project_id: int,
    note_id: int,
    file: UploadFile = File(...),
    description: str | None = Form(None),
    db: Session = Depends(get_db),
):
    """Upload an attachment for a project note."""
    note_repo = ProjectNoteRepository(db)
    note = note_repo.get(note_id)
    if not note or note.project_id != project_id:
        raise HTTPException(status_code=404, detail="Note not found")

    attachments_dir = Path(config.upload.upload_dir) / "project_notes" / str(project_id)
    attachments_dir.mkdir(parents=True, exist_ok=True)

    original_filename = file.filename or "attachment"
    safe_filename = re.sub(r"[^\w\s.-]", "", original_filename)

    import time

    timestamp = str(int(time.time() * 1000))
    unique_filename = f"{project_id}_{note_id}_{timestamp}_{safe_filename}"
    file_path = attachments_dir / unique_filename

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    file_size = os.path.getsize(file_path)
    mime_type = file.content_type or "application/octet-stream"

    attachment_repo = ProjectNoteAttachmentRepository(db)
    attachment = attachment_repo.create(
        project_id,
        note_id,
        {
            "filename": original_filename,
            "filepath": str(file_path),
            "file_size": file_size,
            "mime_type": mime_type,
            "description": description,
        },
    )

    try:
        from ...tasks import index_project_note_attachment

        index_project_note_attachment.delay(attachment.id)
    except Exception:
        pass

    return schemas.ProjectNoteAttachment.model_validate(attachment)


@router.get("/notes/attachments/{attachment_id}/download")
async def download_note_attachment(attachment_id: int, db: Session = Depends(get_db)):
    """Download a project note attachment."""
    attachment_repo = ProjectNoteAttachmentRepository(db)
    attachment = attachment_repo.get(attachment_id)
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")

    file_path = Path(attachment.filepath)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Attachment file not found on disk")

    return FileResponse(path=str(file_path), media_type=attachment.mime_type, filename=attachment.filename)


@router.get("/notes/attachments/{attachment_id}/preview")
async def preview_note_attachment(attachment_id: int, db: Session = Depends(get_db)):
    """Preview a project note attachment in-browser."""
    attachment_repo = ProjectNoteAttachmentRepository(db)
    attachment = attachment_repo.get(attachment_id)
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")

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
    attachment_repo = ProjectNoteAttachmentRepository(db)
    attachment = attachment_repo.get(attachment_id)
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")

    updated = attachment_repo.update(attachment, {"description": description})
    return schemas.ProjectNoteAttachment.model_validate(updated)


@router.delete("/notes/attachments/{attachment_id}", status_code=204)
def delete_note_attachment(attachment_id: int, db: Session = Depends(get_db)):
    """Delete a note attachment and its embeddings."""
    attachment_repo = ProjectNoteAttachmentRepository(db)
    attachment = attachment_repo.get(attachment_id)
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")

    try:
        file_path = Path(attachment.filepath)
        if file_path.exists():
            file_path.unlink(missing_ok=True)
    except Exception:
        pass

    attachment_repo.delete(attachment)

    try:
        from ...tasks import remove_project_attachment_embeddings

        remove_project_attachment_embeddings.delay(attachment_id)
    except Exception:
        pass
    return None


# ============ PROJECT ANALYTICS ============


@router.get("/{project_id}/analytics", response_model=schemas.ProjectAnalytics)
def get_project_analytics(project_id: int, db: Session = Depends(get_db)):
    """Get project analytics and insights."""
    service = ProjectService(db)
    return service.get_project_analytics(project_id)


@router.get("/{project_id}/activity", response_model=list[schemas.ActivityItem])
def get_project_activity(project_id: int, limit: int = 50, db: Session = Depends(get_db)):
    """Get recent activity feed for the project."""
    service = ProjectService(db)
    return service.get_project_activity(project_id, limit)


# ============ PROJECT EXPORT ============


@router.get("/{project_id}/export")
def export_project(project_id: int, format: str = "pdf", db: Session = Depends(get_db)):
    """Export project summary to PDF/DOCX/TXT/JSON."""
    service = ProjectService(db)
    data = service.get_project_export_data(project_id)

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
    service = ProjectService(db)
    return service.get_gantt_data(project_id)


@router.patch("/{project_id}/gantt/items/{item_id}", response_model=schemas.GanttItem)
def update_gantt_item(project_id: int, item_id: str, update: schemas.GanttItemUpdate, db: Session = Depends(get_db)):
    """Update a Gantt item (meeting, milestone, or action item)."""
    service = ProjectService(db)
    return service.update_gantt_item(project_id, item_id, update)
