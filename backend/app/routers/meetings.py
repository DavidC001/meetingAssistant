from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import shutil

from .. import crud, models, schemas
from ..core import chat
from ..database import get_db

router = APIRouter(
    prefix="/meetings",
    tags=["meetings"],
)

# Define a directory to store uploaded files
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/upload", response_model=schemas.Meeting)
def create_upload_file(
    file: UploadFile = File(...),
    transcription_language: Optional[str] = Form("en-US"),
    number_of_speakers: Optional[str] = Form("auto"),
    db: Session = Depends(get_db)
):
    """
    Upload a new meeting file for processing with custom parameters.
    """
    # Get max file size from environment or use default (3GB)
    import os
    max_file_size_mb = int(os.getenv("MAX_FILE_SIZE_MB", "3000"))  # Default 3GB
    MAX_FILE_SIZE = max_file_size_mb * 1024 * 1024  # Convert MB to bytes
    
    file.file.seek(0, 2)  # Seek to end of file
    file_size = file.file.tell()
    file.file.seek(0)  # Reset to beginning
    
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413, 
            detail=f"File size ({file_size / (1024*1024):.1f}MB) exceeds maximum allowed size ({max_file_size_mb}MB)"
        )
    
    # Save the uploaded file to the UPLOAD_DIR
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Create a meeting record in the database with processing parameters
    meeting_create = schemas.MeetingCreate(
        filename=file.filename,
        transcription_language=transcription_language,
        number_of_speakers=number_of_speakers
    )
    db_meeting = crud.create_meeting(db=db, meeting=meeting_create, file_path=file_path, file_size=file_size)

    # Trigger the background processing task and store the task ID
    from ..tasks import process_meeting_task
    task_result = process_meeting_task.delay(db_meeting.id)
    
    # Store the Celery task ID in the database for tracking
    crud.update_meeting_task_id(db, db_meeting.id, task_result.id)

    return db_meeting

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
    db_meeting = crud.update_meeting(db, meeting_id=meeting_id, meeting=meeting)
    if db_meeting is None:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return db_meeting


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
            from ..worker import celery_app
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
    from ..tasks import process_meeting_task
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
    try:
        if os.path.exists(db_meeting.filepath):
            os.remove(db_meeting.filepath)
    except OSError as e:
        # Log this error, but don't block deletion of the DB record
        print(f"Error deleting file {db_meeting.filepath}: {e}")

    # Delete the meeting from the database
    crud.delete_meeting(db, meeting_id=meeting_id)

    return # Should return 204 No Content


@router.post("/{meeting_id}/chat", response_model=schemas.ChatResponse)
async def chat_with_meeting_endpoint(
    meeting_id: int,
    request: schemas.ChatRequest,
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
    crud.create_chat_message(db, meeting_id, "user", request.query)

    # Get the last 5 messages from the chat history
    chat_history = request.chat_history or []

    # Call the chat logic
    response_text = await chat.chat_with_meeting(
        query=request.query,
        transcript=db_meeting.transcription.full_text,
        chat_history=chat_history
    )

    # Save assistant response to database
    crud.create_chat_message(db, meeting_id, "assistant", response_text)

    return schemas.ChatResponse(response=response_text)

@router.get("/{meeting_id}/chat/history", response_model=schemas.ChatHistoryResponse)
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

    chat_messages = crud.get_chat_history(db, meeting_id)
    return schemas.ChatHistoryResponse(history=chat_messages)

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

    crud.clear_chat_history(db, meeting_id)
    return {"message": "Chat history cleared successfully"}
