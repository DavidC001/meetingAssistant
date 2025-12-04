"""
Meetings router for the Meeting Assistant API.

This module handles all meeting-related API endpoints including file upload,
processing management, and meeting data retrieval.
"""

import os
import re
import shutil
import tempfile
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Body
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from . import crud, models, schemas
from ..chat import schemas as chat_schemas, crud as chat_crud
from ..settings import crud as settings_crud
from ...core.llm import chat
from ...core.storage import rag
from ...core.config import config
from ...core.integrations.export import export_to_json, export_to_txt, export_to_docx, export_to_pdf
from ...database import get_db

router = APIRouter(
    prefix="/meetings",
    tags=["meetings"],
)


class FileValidator:
    """Utility class for file validation."""
    
    @staticmethod
    def validate_file_size(file: UploadFile) -> int:
        """Validate file size and return file size in bytes."""
        file.file.seek(0, 2)  # Seek to end of file
        file_size = file.file.tell()
        file.file.seek(0)  # Reset to beginning
        
        if file_size > config.upload.max_file_size_bytes:
            raise HTTPException(
                status_code=413, 
                detail=f"File size ({file_size / (1024*1024):.1f}MB) exceeds maximum allowed size ({config.upload.max_file_size_mb}MB)"
            )
        
        return file_size
    
    @staticmethod
    def validate_file_extension(filename: str) -> None:
        """Validate file extension."""
        file_ext = Path(filename).suffix.lower()
        if file_ext not in config.upload.allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"File extension '{file_ext}' not allowed. Allowed extensions: {', '.join(config.upload.allowed_extensions)}"
            )


class FileManager:
    """Utility class for file management operations."""
    
    @staticmethod
    def save_uploaded_file(file: UploadFile) -> str:
        """Save uploaded file and return the file path."""
        file_path = Path(config.upload.upload_dir) / file.filename
        
        # Ensure filename is unique
        counter = 1
        original_path = file_path
        while file_path.exists():
            stem = original_path.stem
            suffix = original_path.suffix
            file_path = original_path.parent / f"{stem}_{counter}{suffix}"
            counter += 1
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        return str(file_path)

@router.post("/upload", response_model=schemas.Meeting)
def create_upload_file(
    file: UploadFile = File(...),
    transcription_language: Optional[str] = Form("en-US"),
    number_of_speakers: Optional[str] = Form("auto"),
    meeting_date: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """Upload a new meeting file for processing with custom parameters."""
    
    # Validate file extension
    FileValidator.validate_file_extension(file.filename)
    
    # Validate file size
    file_size = FileValidator.validate_file_size(file)
    
    # Save the uploaded file
    file_path = FileManager.save_uploaded_file(file)
    
    # Parse meeting_date if provided
    parsed_meeting_date = None
    if meeting_date:
        try:
            from datetime import datetime
            parsed_meeting_date = datetime.fromisoformat(meeting_date.replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            pass  # If parsing fails, just leave it as None

    # Create a meeting record in the database with processing parameters
    meeting_create = schemas.MeetingCreate(
        filename=file.filename,
        transcription_language=transcription_language,
        number_of_speakers=number_of_speakers,
        meeting_date=parsed_meeting_date
    )
    db_meeting = crud.create_meeting(db=db, meeting=meeting_create, file_path=file_path, file_size=file_size)

    # Trigger the background processing task and store the task ID
    from ...tasks import process_meeting_task
    task_result = process_meeting_task.delay(db_meeting.id)
    
    # Store the Celery task ID in the database for tracking
    crud.update_meeting_task_id(db, db_meeting.id, task_result.id)

    return db_meeting


@router.post("/batch-upload", response_model=List[schemas.Meeting])
def create_batch_upload_files(
    files: List[UploadFile] = File(...),
    transcription_languages: Optional[str] = Form("en-US"),
    number_of_speakers_list: Optional[str] = Form("auto"),
    meeting_dates: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """Upload multiple meeting files for processing with individual custom parameters.
    
    Parameters:
    - files: List of files to upload
    - transcription_languages: Comma-separated list of languages (one per file) or single value for all
    - number_of_speakers_list: Comma-separated list of speaker counts (one per file) or single value for all
    - meeting_dates: Comma-separated list of ISO date strings (one per file) or empty for none
    """
    from datetime import datetime
    
    # Parse comma-separated parameters
    languages = transcription_languages.split(',') if transcription_languages else []
    speakers = number_of_speakers_list.split(',') if number_of_speakers_list else []
    dates = meeting_dates.split(',') if meeting_dates else []
    
    # If single value provided, use it for all files
    if len(languages) == 1:
        languages = languages * len(files)
    if len(speakers) == 1:
        speakers = speakers * len(files)
    
    # Pad with defaults if needed
    while len(languages) < len(files):
        languages.append('en-US')
    while len(speakers) < len(files):
        speakers.append('auto')
    while len(dates) < len(files):
        dates.append('')
    
    uploaded_meetings = []
    errors = []
    
    for idx, file in enumerate(files):
        try:
            # Validate file extension
            FileValidator.validate_file_extension(file.filename)
            
            # Validate file size
            file_size = FileValidator.validate_file_size(file)
            
            # Save the uploaded file
            file_path = FileManager.save_uploaded_file(file)
            
            # Parse meeting_date if provided
            parsed_meeting_date = None
            if dates[idx] and dates[idx].strip():
                try:
                    parsed_meeting_date = datetime.fromisoformat(dates[idx].strip().replace('Z', '+00:00'))
                except (ValueError, AttributeError):
                    pass  # If parsing fails, just leave it as None
            
            # Create a meeting record in the database with processing parameters
            meeting_create = schemas.MeetingCreate(
                filename=file.filename,
                transcription_language=languages[idx].strip(),
                number_of_speakers=speakers[idx].strip(),
                meeting_date=parsed_meeting_date
            )
            db_meeting = crud.create_meeting(db=db, meeting=meeting_create, file_path=file_path, file_size=file_size)
            
            # Trigger the background processing task and store the task ID
            from ...tasks import process_meeting_task
            task_result = process_meeting_task.delay(db_meeting.id)
            
            # Store the Celery task ID in the database for tracking
            crud.update_meeting_task_id(db, db_meeting.id, task_result.id)
            
            uploaded_meetings.append(db_meeting)
            
        except HTTPException as e:
            errors.append({"filename": file.filename, "error": e.detail})
        except Exception as e:
            errors.append({"filename": file.filename, "error": str(e)})
    
    # If there were errors, include them in the response metadata
    # For now, we'll just log them and return successful uploads
    if errors:
        print(f"Batch upload errors: {errors}")
    
    if not uploaded_meetings:
        raise HTTPException(
            status_code=400,
            detail=f"All files failed to upload. Errors: {errors}"
        )
    
    return uploaded_meetings

@router.get("/", response_model=List[schemas.Meeting])
def read_meetings(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Retrieve a list of all meetings.
    """
    meetings = crud.get_meetings(db, skip=skip, limit=limit)
    return meetings

@router.get("/{meeting_id}", response_model=schemas.Meeting)
def read_meeting(meeting_id: int, db: Session = Depends(get_db)):
    """
    Retrieve details for a specific meeting.
    """
    db_meeting = crud.get_meeting(db, meeting_id=meeting_id)
    if db_meeting is None:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return db_meeting

@router.put("/{meeting_id}", response_model=schemas.Meeting)
def update_meeting_details(
    meeting_id: int,
    meeting: schemas.MeetingUpdate,
    db: Session = Depends(get_db),
):
    """
    Update a meeting's details, e.g., rename it.
    """
    # Validate the meeting exists
    db_meeting = crud.get_meeting(db, meeting_id=meeting_id)
    if db_meeting is None:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Validate filename if provided
    if meeting.filename and not meeting.filename.strip():
        raise HTTPException(status_code=400, detail="Filename cannot be empty")
    
    try:
        updated_meeting = crud.update_meeting(db, meeting_id=meeting_id, meeting=meeting)
        print(f"Successfully updated meeting {meeting_id} with new filename: {meeting.filename}")
        return updated_meeting
    except Exception as e:
        print(f"Error updating meeting {meeting_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update meeting")

@router.post("/{meeting_id}/restart-processing", response_model=schemas.Meeting)
def restart_meeting_processing(meeting_id: int, db: Session = Depends(get_db)):
    """
    Restart processing for a meeting that may be stuck or failed.
    """
    db_meeting = crud.get_meeting(db, meeting_id=meeting_id)
    if db_meeting is None:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Check if meeting is already fully completed
    if db_meeting.status == models.MeetingStatus.COMPLETED.value:
        is_fully_completed = (db_meeting.transcription and 
                             db_meeting.transcription.summary and 
                             db_meeting.transcription.full_text and 
                             db_meeting.transcription.action_items)
        if is_fully_completed:
            raise HTTPException(
                status_code=400, 
                detail="Meeting processing is already completed. All transcription, analysis, and action items are available."
            )
    
    # Only allow restart for failed, completed, or stuck processing meetings
    if db_meeting.status not in [models.MeetingStatus.FAILED.value, models.MeetingStatus.COMPLETED.value, models.MeetingStatus.PROCESSING.value]:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot restart processing for meeting with status: {db_meeting.status}"
        )
    
    # Cancel existing task if it exists
    if db_meeting.celery_task_id:
        try:
            from ...worker import celery_app
            celery_app.control.revoke(db_meeting.celery_task_id, terminate=True)
        except Exception as e:
            print(f"Error cancelling existing task: {e}")
    
    # Reset meeting status and clear previous processing data
    crud.update_meeting_status(db, meeting_id, models.MeetingStatus.PENDING)
    crud.update_meeting_processing_details(
        db, meeting_id,
        current_stage=None,
        stage_progress=0.0,
        overall_progress=0.0,
        processing_start_time=None,
        stage_start_time=None,
        error_message=None,
        processing_logs=["Processing restarted manually"]
    )
    
    # Start new processing task
    from ...tasks import process_meeting_task
    task_result = process_meeting_task.delay(meeting_id)
    crud.update_meeting_task_id(db, meeting_id, task_result.id)
    
    # Return updated meeting
    return crud.get_meeting(db, meeting_id=meeting_id)

@router.post("/{meeting_id}/retry-analysis", response_model=schemas.Meeting)
def retry_meeting_analysis(meeting_id: int, db: Session = Depends(get_db)):
    """
    Retry only the analysis phase for a meeting that has failed analysis but has valid transcription.
    This is useful when the LLM connection failed but transcription/diarization completed successfully.
    """
    db_meeting = crud.get_meeting(db, meeting_id=meeting_id)
    if db_meeting is None:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Check if meeting has failed
    if db_meeting.status != models.MeetingStatus.FAILED.value:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot retry analysis for meeting with status: {db_meeting.status}. Only FAILED meetings can be retried."
        )
    
    # Check if meeting has transcription data (required for analysis)
    if not db_meeting.transcription or not db_meeting.transcription.full_text:
        raise HTTPException(
            status_code=400,
            detail="Meeting has no transcription data. Use /restart-processing to reprocess the entire meeting."
        )
    
    # Cancel existing task if it exists
    if db_meeting.celery_task_id:
        try:
            from ...worker import celery_app
            celery_app.control.revoke(db_meeting.celery_task_id, terminate=True)
        except Exception as e:
            print(f"Error cancelling existing task: {e}")
    
    # Update meeting status to allow reprocessing
    crud.update_meeting_status(db, meeting_id, models.MeetingStatus.PROCESSING)
    crud.update_meeting_processing_details(
        db, meeting_id,
        current_stage=models.ProcessingStage.ANALYSIS.value,
        stage_progress=0.0,
        overall_progress=75.0,
        error_message=None,
        processing_logs=["Retrying analysis after previous failure"]
    )
    
    # Start new processing task (it will skip to analysis since transcription exists)
    from ...tasks import process_meeting_task
    task_result = process_meeting_task.delay(meeting_id)
    crud.update_meeting_task_id(db, meeting_id, task_result.id)
    
    # Return updated meeting
    return crud.get_meeting(db, meeting_id=meeting_id)

@router.delete("/{meeting_id}", status_code=204)
def delete_meeting_file(meeting_id: int, db: Session = Depends(get_db)):
    """
    Delete a meeting, its transcription, and the associated file.
    """
    db_meeting = crud.get_meeting(db, meeting_id=meeting_id)
    if db_meeting is None:
        raise HTTPException(status_code=404, detail="Meeting not found")

    # Attempt to delete the file
    file_deleted = False
    try:
        if db_meeting.filepath and os.path.exists(db_meeting.filepath):
            os.remove(db_meeting.filepath)
            file_deleted = True
            print(f"Successfully deleted file: {db_meeting.filepath}")
        else:
            print(f"File not found or path empty: {db_meeting.filepath}")
    except OSError as e:
        # Log this error, but don't block deletion of the DB record
        print(f"Error deleting file {db_meeting.filepath}: {e}")

    # Delete the meeting from the database
    try:
        crud.delete_meeting(db, meeting_id=meeting_id)
        print(f"Successfully deleted meeting {meeting_id} from database")
    except Exception as e:
        print(f"Error deleting meeting {meeting_id} from database: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete meeting from database")

    return # Should return 204 No Content

# Speaker CRUD endpoints
@router.post("/{meeting_id}/speakers", response_model=schemas.Speaker)
def add_speaker(meeting_id: int, speaker: schemas.SpeakerCreate, db: Session = Depends(get_db)):
    db_meeting = crud.get_meeting(db, meeting_id=meeting_id)
    if not db_meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    db_speaker = models.Speaker(
        meeting_id=meeting_id,
        name=speaker.name,
        label=speaker.label
    )
    db.add(db_speaker)
    db.commit()
    db.refresh(db_speaker)
    return db_speaker

@router.get("/{meeting_id}/speakers", response_model=List[schemas.Speaker])
def get_speakers(meeting_id: int, db: Session = Depends(get_db)):
    db_meeting = crud.get_meeting(db, meeting_id=meeting_id)
    if not db_meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return db_meeting.speakers

@router.put("/speakers/{speaker_id}", response_model=schemas.Speaker)
def update_speaker(speaker_id: int, speaker: schemas.SpeakerCreate, db: Session = Depends(get_db)):
    from ...core.processing.transcript_formatter import update_speaker_name_in_transcript
    
    db_speaker = db.query(models.Speaker).filter(models.Speaker.id == speaker_id).first()
    if not db_speaker:
        raise HTTPException(status_code=404, detail="Speaker not found")
    
    # Store old values for updating transcript and action items
    old_name = db_speaker.name
    old_label = db_speaker.label
    
    # Update speaker
    db_speaker.name = speaker.name
    db_speaker.label = speaker.label
    
    # Update transcript text and action items if speaker name changed
    if old_name != speaker.name or old_label != speaker.label:
        # Get the meeting with all related data
        meeting = db.query(models.Meeting).filter(models.Meeting.id == db_speaker.meeting_id).first()
        if meeting and meeting.transcription:
            
            # Update transcript text: replace speaker references
            if meeting.transcription.full_text:
                updated_text = meeting.transcription.full_text
                
                # Replace old label if it exists
                if old_label and old_label != speaker.name:
                    updated_text = update_speaker_name_in_transcript(updated_text, old_label, speaker.name)
                
                # Replace old name if it's different from both the label and the new name
                if old_name and old_name != speaker.name and old_name != old_label:
                    updated_text = update_speaker_name_in_transcript(updated_text, old_name, speaker.name)
                
                meeting.transcription.full_text = updated_text
                
            # Update action items owner field
            for action_item in meeting.transcription.action_items:
                # Update if action item owner matches old speaker name or label (case-insensitive)
                if action_item.owner and (
                    (old_name and action_item.owner.lower() == old_name.lower()) or 
                    (old_label and action_item.owner.lower() == old_label.lower())
                ):
                    action_item.owner = speaker.name
    
    db.commit()
    db.refresh(db_speaker)
    return db_speaker

@router.delete("/speakers/{speaker_id}", status_code=204)
def delete_speaker(speaker_id: int, db: Session = Depends(get_db)):
    db_speaker = db.query(models.Speaker).filter(models.Speaker.id == speaker_id).first()
    if not db_speaker:
        raise HTTPException(status_code=404, detail="Speaker not found")
    db.delete(db_speaker)
    db.commit()
    return

# Manual Action Item CRUD endpoints
@router.post("/transcriptions/{transcription_id}/action-items", response_model=schemas.ActionItem)
def add_action_item(transcription_id: int, action_item: schemas.ActionItemCreate, db: Session = Depends(get_db)):
    return crud.create_action_item(db, transcription_id, action_item, is_manual=True)

@router.put("/action-items/{item_id}", response_model=schemas.ActionItem)
def update_action_item(item_id: int, action_item: schemas.ActionItemCreate, db: Session = Depends(get_db)):
    updated_item = crud.update_action_item(db, item_id, action_item)
    
    # If the item is synced to Google Calendar, update the event
    if updated_item.synced_to_calendar and updated_item.google_calendar_event_id:
        try:
            from ...core.integrations.google_calendar import GoogleCalendarService
            calendar_service = GoogleCalendarService(db)
            if calendar_service.is_connected():
                # Get meeting title for context
                transcription = db.query(models.Transcription).filter(
                    models.Transcription.id == updated_item.transcription_id
                ).first()
                meeting_title = None
                if transcription and transcription.meeting:
                    meeting_title = transcription.meeting.filename
                
                calendar_service.update_event(
                    updated_item.google_calendar_event_id,
                    updated_item,
                    meeting_title
                )
        except Exception as e:
            print(f"Error updating Google Calendar event: {e}")
            # Don't fail the request if calendar sync fails
    
    return updated_item

@router.delete("/action-items/{item_id}", status_code=204)
def delete_action_item(item_id: int, db: Session = Depends(get_db)):
    # Get the item before deletion to check if it's synced to Google Calendar
    action_item = crud.get_action_item(db, item_id)
    
    # If synced to Google Calendar, delete the event first
    if action_item and action_item.synced_to_calendar and action_item.google_calendar_event_id:
        try:
            from ...core.integrations.google_calendar import GoogleCalendarService
            calendar_service = GoogleCalendarService(db)
            if calendar_service.is_connected():
                calendar_service.delete_event(action_item.google_calendar_event_id)
        except Exception as e:
            print(f"Error deleting Google Calendar event: {e}")
            # Continue with database deletion even if calendar delete fails
    
    crud.delete_action_item(db, item_id)
    return

# Meeting tags/folder update endpoint
@router.put("/{meeting_id}/tags-folder", response_model=schemas.Meeting)
def update_meeting_tags_folder(meeting_id: int, tags: Optional[str] = Body(None), folder: Optional[str] = Body(None), db: Session = Depends(get_db)):
    db_meeting = crud.get_meeting(db, meeting_id=meeting_id)
    if not db_meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    if tags is not None:
        db_meeting.tags = tags
    if folder is not None:
        db_meeting.folder = folder
    db.commit()
    db.refresh(db_meeting)
    return db_meeting

@router.put("/{meeting_id}/notes", response_model=schemas.Meeting)
def update_meeting_notes(meeting_id: int, notes: Optional[str] = Body(None, embed=True), db: Session = Depends(get_db)):
    """Update notes for a meeting and sync meeting links."""
    db_meeting = crud.get_meeting(db, meeting_id=meeting_id)
    if not db_meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    db_meeting.notes = notes
    db.commit()
    db.refresh(db_meeting)
    
    # Sync meeting links from notes
    sync_meeting_links_from_notes(db, meeting_id, notes)
    
    # Trigger embedding computation to index the updated notes
    from ...tasks import compute_embeddings_for_meeting
    compute_embeddings_for_meeting.delay(meeting_id)
    
    return db_meeting


def sync_meeting_links_from_notes(db: Session, source_meeting_id: int, notes: Optional[str]):
    """
    Extract meeting references from notes and sync with meeting_links table.
    Removes old links and adds new ones based on current notes content.
    """
    if not notes:
        # If notes are empty, remove all links from this meeting
        db.query(models.MeetingLink).filter(
            models.MeetingLink.source_meeting_id == source_meeting_id
        ).delete()
        db.commit()
        return
    
    # Extract meeting IDs from notes
    meeting_ids = set()
    
    # Pattern 1: #meeting-123 or #123
    pattern1 = r'#(?:meeting-)?(\d+)'
    matches = re.finditer(pattern1, notes, re.IGNORECASE)
    for match in matches:
        meeting_ids.add(int(match.group(1)))
    
    # Pattern 2: meeting:123
    pattern2 = r'meeting:\s*(\d+)'
    matches = re.finditer(pattern2, notes, re.IGNORECASE)
    for match in matches:
        meeting_ids.add(int(match.group(1)))
    
    # Pattern 3: [[123]]
    pattern3 = r'\[\[(\d+)\]\]'
    matches = re.finditer(pattern3, notes, re.IGNORECASE)
    for match in matches:
        meeting_ids.add(int(match.group(1)))
    
    # Remove self-references
    meeting_ids.discard(source_meeting_id)
    
    # Get existing links for this meeting
    existing_links = db.query(models.MeetingLink).filter(
        models.MeetingLink.source_meeting_id == source_meeting_id
    ).all()
    
    existing_target_ids = {link.target_meeting_id for link in existing_links}
    
    # Find links to add and remove
    to_add = meeting_ids - existing_target_ids
    to_remove = existing_target_ids - meeting_ids
    
    # Remove outdated links
    if to_remove:
        db.query(models.MeetingLink).filter(
            models.MeetingLink.source_meeting_id == source_meeting_id,
            models.MeetingLink.target_meeting_id.in_(to_remove)
        ).delete(synchronize_session=False)
    
    # Add new links (verify target meetings exist)
    for target_id in to_add:
        target_meeting = db.query(models.Meeting).filter(
            models.Meeting.id == target_id
        ).first()
        
        if target_meeting:
            new_link = models.MeetingLink(
                source_meeting_id=source_meeting_id,
                target_meeting_id=target_id
            )
            db.add(new_link)
    
    db.commit()

@router.post("/{meeting_id}/chat", response_model=chat_schemas.ChatResponse)
async def chat_with_meeting_endpoint(
    meeting_id: int,
    request: chat_schemas.ChatRequest,
    db: Session = Depends(get_db)
):
    """
    Chat with a meeting's transcription.
    """
    db_meeting = crud.get_meeting(db, meeting_id=meeting_id)
    if not db_meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    if not db_meeting.transcription or not db_meeting.transcription.full_text:
        raise HTTPException(status_code=404, detail="Transcription not available for this meeting")

    # Save user message to database
    chat_crud.create_chat_message(db, meeting_id, "user", request.query)

    chat_history = request.chat_history or []

    model_config = None
    if db_meeting.model_configuration_id:
        model_config = settings_crud.get_model_configuration(db, db_meeting.model_configuration_id)
    if not model_config:
        model_config = settings_crud.get_default_model_configuration(db)

    llm_config = None
    if model_config:
        llm_config = chat.model_config_to_llm_config(model_config, use_analysis=False)

    # Check if tools should be enabled (default to True)
    enable_tools = getattr(request, 'enable_tools', True)
    
    response_text, sources = await rag.generate_rag_response(
        db,
        query=request.query,
        meeting_id=meeting_id,
        chat_history=chat_history,
        top_k=request.top_k or 5,
        llm_config=llm_config,
        use_full_transcript=request.use_full_transcript or False,
        full_transcript=db_meeting.transcription.full_text if request.use_full_transcript else None,
        enable_tools=enable_tools,
    )

    chat_crud.create_chat_message(db, meeting_id, "assistant", response_text)

    return chat_schemas.ChatResponse(response=response_text, sources=sources)

@router.get("/{meeting_id}/chat/history", response_model=chat_schemas.ChatHistoryResponse)
def get_chat_history_endpoint(
    meeting_id: int,
    db: Session = Depends(get_db)
):
    """
    Get chat history for a meeting.
    """
    db_meeting = crud.get_meeting(db, meeting_id=meeting_id)
    if not db_meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    chat_messages = chat_crud.get_chat_history(db, meeting_id)
    return chat_schemas.ChatHistoryResponse(history=chat_messages)

@router.delete("/{meeting_id}/chat/history")
def clear_chat_history_endpoint(
    meeting_id: int,
    db: Session = Depends(get_db)
):
    """
    Clear chat history for a meeting.
    """
    db_meeting = crud.get_meeting(db, meeting_id=meeting_id)
    if not db_meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    chat_crud.clear_chat_history(db, meeting_id)
    return {"message": "Chat history cleared successfully"}

@router.get("/{meeting_id}/download/{format}")
def download_meeting(
    meeting_id: int,
    format: str,
    db: Session = Depends(get_db)
):
    """
    Download meeting data in the specified format (json, txt, docx, pdf).
    """
    # Validate format
    allowed_formats = ["json", "txt", "docx", "pdf"]
    if format.lower() not in allowed_formats:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid format. Allowed formats: {', '.join(allowed_formats)}"
        )
    
    # Get meeting data
    db_meeting = crud.get_meeting(db, meeting_id=meeting_id)
    if not db_meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Check if meeting has transcription
    if not db_meeting.transcription:
        raise HTTPException(
            status_code=404,
            detail="Meeting transcription not available. Processing may still be in progress."
        )
    
    # Prepare the data dictionary
    data = {
        "filename": db_meeting.filename,
        "created_at": db_meeting.created_at,
        "status": db_meeting.status,
        "summary": db_meeting.transcription.summary or "No summary available",
        "transcript": db_meeting.transcription.full_text or "No transcript available",
        "notes": db_meeting.notes or "",
        "action_items": []
    }
    
    # Add action items with detailed information
    if db_meeting.transcription.action_items:
        for item in db_meeting.transcription.action_items:
            action_item_data = {
                "task": item.task,
                "owner": item.owner or "Unassigned",
                "due_date": item.due_date or "No due date",
                "status": item.status or "pending",
                "priority": item.priority or "medium",
                "notes": item.notes or ""
            }
            data["action_items"].append(action_item_data)
    
    # Add speakers information if available
    if db_meeting.speakers:
        data["speakers"] = [
            {"name": speaker.name, "label": speaker.label or ""}
            for speaker in db_meeting.speakers
        ]
    
    # Add tags and folder if available
    if db_meeting.tags:
        data["tags"] = db_meeting.tags
    if db_meeting.folder:
        data["folder"] = db_meeting.folder
    
    # Add model configuration info if available
    if db_meeting.model_configuration:
        data["model_info"] = {
            "name": db_meeting.model_configuration.name,
            "transcription_language": db_meeting.transcription_language,
            "number_of_speakers": db_meeting.number_of_speakers
        }
    
    # Create a temporary file for export
    temp_dir = tempfile.mkdtemp()
    base_name = db_meeting.filename.replace(" ", "_")
    # Remove extension from filename if present
    base_name = Path(base_name).stem
    
    try:
        # Export to the specified format
        export_path = None
        if format.lower() == "json":
            export_path = export_to_json(data, os.path.join(temp_dir, f"{base_name}.json"))
        elif format.lower() == "txt":
            export_path = export_to_txt(data, os.path.join(temp_dir, f"{base_name}.txt"))
        elif format.lower() == "docx":
            export_path = export_to_docx(data, os.path.join(temp_dir, f"{base_name}.docx"))
            if export_path is None:
                raise HTTPException(
                    status_code=500,
                    detail="DOCX export not available. python-docx library may not be installed."
                )
        elif format.lower() == "pdf":
            export_path = export_to_pdf(data, os.path.join(temp_dir, f"{base_name}.pdf"))
            if export_path is None:
                raise HTTPException(
                    status_code=500,
                    detail="PDF export not available. reportlab library may not be installed."
                )
        
        if not export_path or not os.path.exists(export_path):
            raise HTTPException(status_code=500, detail="Failed to generate export file")
        
        # Determine media type
        media_types = {
            "json": "application/json",
            "txt": "text/plain",
            "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "pdf": "application/pdf"
        }
        
        # Return the file as a download
        return FileResponse(
            path=str(export_path),
            media_type=media_types[format.lower()],
            filename=f"{base_name}.{format.lower()}",
            background=None  # Don't clean up immediately
        )
    
    except Exception as e:
        # Clean up temporary directory on error
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"Error generating export: {str(e)}")


# ============================================================================
# Attachment Endpoints
# ============================================================================

@router.post("/{meeting_id}/attachments", response_model=schemas.Attachment)
async def upload_attachment(
    meeting_id: int,
    file: UploadFile = File(...),
    description: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Upload an attachment file for a meeting.
    
    Args:
        meeting_id: ID of the meeting to attach the file to
        file: File to upload
        description: Optional description of the attachment
        db: Database session
    
    Returns:
        The created attachment record
    """
    # Verify meeting exists
    db_meeting = crud.get_meeting(db, meeting_id=meeting_id)
    if db_meeting is None:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Create attachments directory if it doesn't exist
    attachments_dir = Path(config.upload.upload_dir) / "attachments"
    attachments_dir.mkdir(parents=True, exist_ok=True)
    
    # Sanitize filename
    original_filename = file.filename or "attachment"
    safe_filename = re.sub(r'[^\w\s.-]', '', original_filename)
    
    # Create unique filename with meeting_id prefix
    timestamp = str(int(os.path.getmtime(__file__) * 1000))  # Simple timestamp
    unique_filename = f"{meeting_id}_{timestamp}_{safe_filename}"
    file_path = attachments_dir / unique_filename
    
    # Save file
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    
    # Get file size and mime type
    file_size = os.path.getsize(file_path)
    mime_type = file.content_type or "application/octet-stream"
    
    # Create attachment record
    attachment = crud.create_attachment(
        db=db,
        meeting_id=meeting_id,
        filename=original_filename,
        filepath=str(file_path),
        file_size=file_size,
        mime_type=mime_type,
        description=description
    )
    
    # Trigger embedding computation for the meeting to index the new attachment
    from ...tasks import compute_embeddings_for_meeting
    compute_embeddings_for_meeting.delay(meeting_id)
    
    return attachment


@router.get("/{meeting_id}/attachments", response_model=List[schemas.Attachment])
def get_meeting_attachments(
    meeting_id: int,
    db: Session = Depends(get_db)
):
    """
    Get all attachments for a meeting.
    
    Args:
        meeting_id: ID of the meeting
        db: Database session
    
    Returns:
        List of attachments for the meeting
    """
    # Verify meeting exists
    db_meeting = crud.get_meeting(db, meeting_id=meeting_id)
    if db_meeting is None:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    attachments = crud.get_meeting_attachments(db, meeting_id=meeting_id)
    return attachments


@router.get("/attachments/{attachment_id}/download")
async def download_attachment(
    attachment_id: int,
    db: Session = Depends(get_db)
):
    """
    Download an attachment file.
    
    Args:
        attachment_id: ID of the attachment to download
        db: Database session
    
    Returns:
        The attachment file
    """
    # Get attachment record
    attachment = crud.get_attachment(db, attachment_id=attachment_id)
    if attachment is None:
        raise HTTPException(status_code=404, detail="Attachment not found")
    
    # Verify file exists
    file_path = Path(attachment.filepath)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Attachment file not found on disk")
    
    # Return file
    return FileResponse(
        path=str(file_path),
        media_type=attachment.mime_type,
        filename=attachment.filename
    )


@router.get("/attachments/{attachment_id}/preview")
async def preview_attachment(
    attachment_id: int,
    db: Session = Depends(get_db)
):
    """
    Preview an attachment file in-browser (for PDFs and other previewable types).
    
    Args:
        attachment_id: ID of the attachment to preview
        db: Database session
    
    Returns:
        The attachment file with inline content disposition for browser preview
    """
    # Get attachment record
    attachment = crud.get_attachment(db, attachment_id=attachment_id)
    if attachment is None:
        raise HTTPException(status_code=404, detail="Attachment not found")
    
    # Verify file exists
    file_path = Path(attachment.filepath)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Attachment file not found on disk")
    
    # Return file with inline disposition for browser preview
    return FileResponse(
        path=str(file_path),
        media_type=attachment.mime_type,
        filename=attachment.filename,
        headers={
            "Content-Disposition": f'inline; filename="{attachment.filename}"'
        }
    )


@router.put("/attachments/{attachment_id}", response_model=schemas.Attachment)
def update_attachment_description(
    attachment_id: int,
    description: str = Body(..., embed=True),
    db: Session = Depends(get_db)
):
    """
    Update the description of an attachment.
    
    Args:
        attachment_id: ID of the attachment to update
        description: New description
        db: Database session
    
    Returns:
        The updated attachment record
    """
    # Get attachment
    attachment = crud.get_attachment(db, attachment_id=attachment_id)
    if attachment is None:
        raise HTTPException(status_code=404, detail="Attachment not found")
    
    # Update description
    updated_attachment = crud.update_attachment(
        db=db,
        attachment_id=attachment_id,
        description=description
    )
    
    return updated_attachment


@router.delete("/attachments/{attachment_id}", status_code=204)
def delete_attachment(
    attachment_id: int,
    db: Session = Depends(get_db)
):
    """
    Delete an attachment and its file.
    
    Args:
        attachment_id: ID of the attachment to delete
        db: Database session
    
    Returns:
        No content on success
    """
    # Get attachment
    attachment = crud.get_attachment(db, attachment_id=attachment_id)
    if attachment is None:
        raise HTTPException(status_code=404, detail="Attachment not found")
    
    meeting_id = attachment.meeting_id  # Store meeting_id before deletion
    
    # Delete file from disk
    file_path = Path(attachment.filepath)
    if file_path.exists():
        try:
            file_path.unlink()
        except Exception as e:
            # Log error but continue with database deletion
            print(f"Warning: Failed to delete attachment file: {str(e)}")
    
    # Delete database record
    crud.delete_attachment(db=db, attachment_id=attachment_id)
    
    # Trigger embedding recomputation to remove deleted attachment from index
    from ...tasks import compute_embeddings_for_meeting
    compute_embeddings_for_meeting.delay(meeting_id)
    
    return None


@router.get("/{meeting_id}/audio")
def stream_meeting_audio(
    meeting_id: int,
    db: Session = Depends(get_db)
):
    """
    Stream the meeting audio file for playback.
    Returns the MP3 audio file that can be streamed to the frontend.
    
    Args:
        meeting_id: ID of the meeting
        db: Database session
    
    Returns:
        FileResponse with the audio file
    """
    # Get meeting record
    meeting = crud.get_meeting(db, meeting_id=meeting_id)
    if meeting is None:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Check if audio file exists
    if not meeting.audio_filepath:
        raise HTTPException(status_code=404, detail="Audio file not available for this meeting")
    
    audio_path = Path(meeting.audio_filepath)
    if not audio_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found on disk")
    
    # Return audio file with streaming support
    return FileResponse(
        path=str(audio_path),
        media_type="audio/mpeg",
        filename=f"{meeting.filename}_audio.mp3",
        headers={
            "Accept-Ranges": "bytes",
            "Content-Disposition": f'inline; filename="{meeting.filename}_audio.mp3"'
        }
    )


@router.get("/tags/all", response_model=List[str])
def get_all_tags(db: Session = Depends(get_db)):
    """Get all unique tags from meetings and global chat sessions."""
    tags_set = set()
    
    # Get tags from meetings
    meetings = crud.get_meetings(db)
    for meeting in meetings:
        if meeting.tags:
            for tag in meeting.tags.split(','):
                tag = tag.strip()
                if tag:
                    tags_set.add(tag)
    
    # Get tags from global chat sessions
    # Note: list_global_chat_sessions is in chat module, but we are in meetings module.
    # We should probably import it from chat module or move this endpoint to a general router.
    # For now, let's import it from the main crud which aggregates everything, or from chat module directly.
    # But wait, we are in backend/app/modules/meetings/router.py
    # We can import from ..chat.crud
    from ..chat import crud as chat_crud
    sessions = chat_crud.list_global_chat_sessions(db)
    for session in sessions:
        if session.tags:
            for tag in session.tags.split(','):
                tag = tag.strip()
                if tag:
                    tags_set.add(tag)
    
    return sorted(list(tags_set))

@router.get("/speakers/all", response_model=List[str])
def get_all_speakers(db: Session = Depends(get_db)):
    """
    Retrieve all unique speaker names across all meetings.
    """
    speakers = crud.get_all_unique_speakers(db)
    # Filter out empty names and return the list directly (already strings from repository)
    return [s for s in speakers if s]
