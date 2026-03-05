"""
Meetings router for the Meeting Assistant API.

This module handles all meeting-related API endpoints including file upload,
processing management, and meeting data retrieval. All business logic is
delegated to MeetingService – this file is an HTTP-layer-only module.
"""

from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ...database import get_db
from ..chat import schemas as chat_schemas
from . import schemas
from .service import MeetingService

router = APIRouter(
    prefix="/meetings",
    tags=["meetings"],
)


def _service(db: Session) -> MeetingService:
    return MeetingService(db)


# =============================================================================
# Upload Endpoints
# =============================================================================


@router.post("/upload", response_model=schemas.Meeting)
def create_upload_file(
    file: UploadFile = File(
        ..., description="Audio or video file to transcribe (mp3, mp4, wav, m4a, mpeg, mpga, webm, oga, ogg, flac)"
    ),
    transcription_language: str | None = Form(
        "en-US", description="Language code for transcription (e.g., en-US, es-ES, fr-FR)"
    ),
    number_of_speakers: str | None = Form(
        "auto", description="Number of speakers in the meeting ('auto' for automatic detection or a specific number)"
    ),
    meeting_date: str | None = Form(None, description="Meeting date in ISO format (e.g., 2024-01-15T10:00:00Z)"),
    db: Session = Depends(get_db),
):
    """Upload a new meeting file for processing."""
    return _service(db).create_meeting_from_upload(
        file=file,
        transcription_language=transcription_language,
        number_of_speakers=number_of_speakers,
        meeting_date=meeting_date,
    )


@router.post("/batch-upload", response_model=list[schemas.Meeting])
def create_batch_upload_files(
    files: list[UploadFile] = File(...),
    transcription_languages: str | None = Form("en-US"),
    number_of_speakers_list: str | None = Form("auto"),
    meeting_dates: str | None = Form(None),
    db: Session = Depends(get_db),
):
    """Upload multiple meeting files for processing."""
    return _service(db).create_batch_meetings_from_upload(
        files=files,
        transcription_languages=transcription_languages,
        number_of_speakers_list=number_of_speakers_list,
        meeting_dates=meeting_dates,
    )


# =============================================================================
# Meeting CRUD
# =============================================================================


@router.get("/", response_model=list[schemas.Meeting])
def read_meetings(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Retrieve a paginated list of all meetings."""
    return _service(db).list_meetings(skip=skip, limit=limit)


@router.get("/{meeting_id}", response_model=schemas.Meeting)
def read_meeting(meeting_id: int, db: Session = Depends(get_db)):
    """Retrieve complete details for a specific meeting."""
    return _service(db).get_meeting_or_404(meeting_id)


@router.put("/{meeting_id}", response_model=schemas.Meeting)
def update_meeting_details(
    meeting_id: int,
    meeting: schemas.MeetingUpdate,
    db: Session = Depends(get_db),
):
    """Update a meeting's details, e.g., rename it."""
    if meeting.filename and not meeting.filename.strip():
        raise HTTPException(status_code=400, detail="Filename cannot be empty")
    try:
        return _service(db).update_meeting(meeting_id, meeting)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to update meeting")


@router.post("/{meeting_id}/restart-processing", response_model=schemas.Meeting)
def restart_meeting_processing(meeting_id: int, db: Session = Depends(get_db)):
    """Restart processing for a meeting that may be stuck or failed."""
    return _service(db).restart_processing(meeting_id)


@router.post("/{meeting_id}/retry-analysis", response_model=schemas.Meeting)
def retry_meeting_analysis(meeting_id: int, db: Session = Depends(get_db)):
    """Retry only the analysis phase for a meeting that has failed analysis but has valid transcription."""
    return _service(db).retry_analysis(meeting_id)


@router.delete("/{meeting_id}", status_code=204)
def delete_meeting_file(meeting_id: int, db: Session = Depends(get_db)):
    """Delete a meeting, its transcription, and the associated file."""
    try:
        _service(db).delete_meeting(meeting_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to delete meeting from database")
    return


@router.post("/bulk/delete", response_model=schemas.BulkOperationResponse)
def bulk_delete_meetings(request: schemas.BulkDeleteRequest, db: Session = Depends(get_db)):
    """Delete multiple meetings in a single transaction."""
    return _service(db).bulk_delete(request.meeting_ids)


@router.post("/bulk/update", response_model=schemas.BulkOperationResponse)
def bulk_update_meetings(request: schemas.BulkUpdateRequest, db: Session = Depends(get_db)):
    """Update multiple meetings with the same changes in a single transaction."""
    return _service(db).bulk_update(request.meeting_ids, request.updates)


# =============================================================================
# Speaker Endpoints
# =============================================================================


@router.post("/{meeting_id}/speakers", response_model=schemas.Speaker)
def add_speaker(meeting_id: int, speaker: schemas.SpeakerCreate, db: Session = Depends(get_db)):
    return _service(db).add_speaker(meeting_id, speaker.name, speaker.label)


@router.get("/{meeting_id}/speakers", response_model=list[schemas.Speaker])
def get_speakers(meeting_id: int, db: Session = Depends(get_db)):
    return _service(db).get_speakers(meeting_id)


@router.put("/speakers/{speaker_id}", response_model=schemas.Speaker)
def update_speaker(speaker_id: int, speaker: schemas.SpeakerCreate, db: Session = Depends(get_db)):
    return _service(db).update_speaker(speaker_id, speaker.name, speaker.label)


@router.delete("/speakers/{speaker_id}", status_code=204)
def delete_speaker(speaker_id: int, db: Session = Depends(get_db)):
    _service(db).delete_speaker(speaker_id)
    return


# =============================================================================
# Action Item Endpoints
# =============================================================================


@router.get("/action-items/", response_model=list[schemas.ActionItemWithMeeting])
def list_all_action_items(skip: int = 0, limit: int = 1000, status: str | None = None, db: Session = Depends(get_db)):
    """Retrieve all action items across all meetings."""
    return _service(db).list_action_items(skip=skip, limit=limit, status=status)


@router.post("/transcriptions/{transcription_id}/action-items", response_model=schemas.ActionItem)
def add_action_item(transcription_id: int, action_item: schemas.ActionItemCreate, db: Session = Depends(get_db)):
    return _service(db).add_action_item(transcription_id, action_item)


@router.put("/action-items/{item_id}", response_model=schemas.ActionItem)
def update_action_item(item_id: int, action_item: schemas.ActionItemUpdate, db: Session = Depends(get_db)):
    return _service(db).update_action_item(item_id, action_item)


@router.delete("/action-items/{item_id}", status_code=204)
def delete_action_item(item_id: int, db: Session = Depends(get_db)):
    _service(db).delete_action_item(item_id)
    return


# =============================================================================
# Tags / Folder / Notes
# =============================================================================


@router.put("/{meeting_id}/tags-folder", response_model=schemas.Meeting)
def update_meeting_tags_folder(
    meeting_id: int, tags: str | None = Body(None), folder: str | None = Body(None), db: Session = Depends(get_db)
):
    return _service(db).update_tags_folder(meeting_id, tags, folder)


@router.put("/{meeting_id}/notes", response_model=schemas.Meeting)
def update_meeting_notes(meeting_id: int, notes: str | None = Body(None, embed=True), db: Session = Depends(get_db)):
    """Update notes for a meeting and sync meeting links."""
    return _service(db).update_notes(meeting_id, notes)


# =============================================================================
# Chat Endpoints
# =============================================================================


@router.post("/{meeting_id}/chat", response_model=chat_schemas.ChatResponse)
async def chat_with_meeting_endpoint(meeting_id: int, request: chat_schemas.ChatRequest, db: Session = Depends(get_db)):
    """Chat with a meeting's transcription."""
    return await _service(db).chat_with_meeting(meeting_id, request)


@router.get("/{meeting_id}/chat/history", response_model=chat_schemas.ChatHistoryResponse)
def get_chat_history_endpoint(meeting_id: int, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Get chat history for a meeting with pagination."""
    return _service(db).get_chat_history(meeting_id, skip=skip, limit=limit)


@router.delete("/{meeting_id}/chat/history")
def clear_chat_history_endpoint(meeting_id: int, db: Session = Depends(get_db)):
    """Clear chat history for a meeting."""
    return _service(db).clear_chat_history(meeting_id)


# =============================================================================
# Download / Export
# =============================================================================


@router.get("/{meeting_id}/download/{format}")
def download_meeting(meeting_id: int, format: str, db: Session = Depends(get_db)):
    """Download meeting data in the specified format (json, txt, docx, pdf)."""
    return _service(db).get_export_file_response(meeting_id, format)


# =============================================================================
# Attachment Endpoints
# =============================================================================


@router.post("/{meeting_id}/attachments", response_model=schemas.Attachment)
async def upload_attachment(
    meeting_id: int,
    file: UploadFile = File(...),
    description: str | None = Form(None),
    db: Session = Depends(get_db),
):
    """Upload an attachment file for a meeting."""
    return _service(db).upload_attachment(meeting_id, file, description)


@router.get("/{meeting_id}/attachments", response_model=list[schemas.Attachment])
def get_meeting_attachments(meeting_id: int, db: Session = Depends(get_db)):
    """Get all attachments for a meeting."""
    return _service(db).get_attachments(meeting_id)


@router.get("/attachments/{attachment_id}/download")
async def download_attachment(attachment_id: int, db: Session = Depends(get_db)):
    """Download an attachment file."""
    return _service(db).get_attachment_file_response(attachment_id)


@router.get("/attachments/{attachment_id}/preview")
async def preview_attachment(attachment_id: int, db: Session = Depends(get_db)):
    """Preview an attachment file in-browser."""
    return _service(db).get_attachment_file_response(attachment_id, inline=True)


@router.put("/attachments/{attachment_id}", response_model=schemas.Attachment)
def update_attachment_description(
    attachment_id: int, description: str = Body(..., embed=True), db: Session = Depends(get_db)
):
    """Update the description of an attachment."""
    return _service(db).update_attachment_description(attachment_id, description)


@router.delete("/attachments/{attachment_id}", status_code=204)
def delete_attachment(attachment_id: int, db: Session = Depends(get_db)):
    """Delete an attachment and its file."""
    _service(db).delete_attachment(attachment_id)
    return None


# =============================================================================
# Audio Endpoints
# =============================================================================


@router.get("/{meeting_id}/audio")
def stream_meeting_audio(meeting_id: int, db: Session = Depends(get_db)):
    """Stream the meeting audio file for playback."""
    return _service(db).get_audio_file_response(meeting_id)


# =============================================================================
# Misc / Admin Endpoints
# =============================================================================


@router.get("/tags/all", response_model=list[str])
def get_all_tags(db: Session = Depends(get_db)):
    """Get all unique tags from meetings and global chat sessions."""
    return _service(db).get_all_tags()


@router.get("/speakers/all", response_model=list[str])
def get_all_speakers(db: Session = Depends(get_db)):
    """Retrieve all unique speaker names across all meetings."""
    return _service(db).get_all_speakers()


@router.post("/{meeting_id}/generate-audio", response_model=schemas.TaskStatus)
def generate_audio_for_meeting(meeting_id: int, db: Session = Depends(get_db)):
    """Generate MP3 audio file for a meeting that is missing it."""
    return _service(db).generate_audio(meeting_id)


@router.post("/admin/regenerate-all-audio", response_model=schemas.BatchTaskStatus)
def regenerate_all_audio(force: bool = False, db: Session = Depends(get_db)):
    """Admin endpoint to regenerate audio for all meetings missing audio files."""
    return _service(db).regenerate_all_audio(force)
