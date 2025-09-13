from sqlalchemy.orm import Session
from . import models, schemas

# Meeting CRUD operations
def get_meeting(db: Session, meeting_id: int):
    return db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()

def get_meetings(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Meeting).offset(skip).limit(limit).all()

def create_meeting(db: Session, meeting: schemas.MeetingCreate, file_path: str, file_size: int = None, celery_task_id: str = None):
    db_meeting = models.Meeting(
        filename=meeting.filename,
        filepath=file_path,
        status=models.MeetingStatus.PENDING.value,
        transcription_language=meeting.transcription_language or "en-US",
        number_of_speakers=meeting.number_of_speakers or "auto",
        file_size=file_size,
        celery_task_id=celery_task_id
    )
    db.add(db_meeting)
    db.commit()
    db.refresh(db_meeting)
    return db_meeting

def update_meeting_status(db: Session, meeting_id: int, status: models.MeetingStatus):
    db_meeting = get_meeting(db, meeting_id)
    if db_meeting:
        db_meeting.status = status.value
        db.commit()
        db.refresh(db_meeting)
    return db_meeting

def update_meeting_progress(db: Session, meeting_id: int, stage: models.ProcessingStage, 
                          stage_progress: float, overall_progress: float):
    db_meeting = get_meeting(db, meeting_id)
    if db_meeting:
        db_meeting.current_stage = stage.value
        db_meeting.stage_progress = stage_progress
        db_meeting.overall_progress = overall_progress
        db.commit()
        db.refresh(db_meeting)
    return db_meeting

def update_meeting(db: Session, meeting_id: int, meeting: schemas.MeetingUpdate):
    db_meeting = get_meeting(db, meeting_id=meeting_id)
    if db_meeting:
        db_meeting.filename = meeting.filename
        db.commit()
        db.refresh(db_meeting)
    return db_meeting

def delete_meeting(db: Session, meeting_id: int):
    db_meeting = get_meeting(db, meeting_id=meeting_id)
    if db_meeting:
        # Cancel Celery task if it's still running
        if db_meeting.celery_task_id and (db_meeting.status == models.MeetingStatus.PROCESSING.value or db_meeting.status == models.MeetingStatus.PENDING.value):
            try:
                from .worker import celery_app
                celery_app.control.revoke(db_meeting.celery_task_id, terminate=True)
                print(f"Cancelled Celery task {db_meeting.celery_task_id} for meeting {meeting_id}")
            except Exception as e:
                print(f"Error cancelling Celery task {db_meeting.celery_task_id}: {e}")
        
        db.delete(db_meeting)
        db.commit()
    return db_meeting

def update_meeting_task_id(db: Session, meeting_id: int, task_id: str):
    """Update the Celery task ID for a meeting"""
    db_meeting = get_meeting(db, meeting_id)
    if db_meeting:
        db_meeting.celery_task_id = task_id
        db.commit()
        db.refresh(db_meeting)
    return db_meeting

# Transcription CRUD operations
def create_meeting_transcription(db: Session, meeting_id: int, transcription: schemas.TranscriptionCreate, action_items: list[schemas.ActionItemCreate]):
    # First, update the meeting status to COMPLETED
    db_meeting = update_meeting_status(db, meeting_id, models.MeetingStatus.COMPLETED)
    if not db_meeting:
        return None

    # Create the transcription record
    db_transcription = models.Transcription(
        meeting_id=meeting_id,
        summary=transcription.summary,
        full_text=transcription.full_text
    )
    db.add(db_transcription)
    db.commit()
    db.refresh(db_transcription)

    # Create the action items
    for item_data in action_items:
        db_item = models.ActionItem(**item_data.dict(), transcription_id=db_transcription.id)
        db.add(db_item)

    db.commit()
    db.refresh(db_transcription)

    return db_transcription

def update_meeting_processing_details(db: Session, meeting_id: int, **kwargs):
    """Update meeting processing details like stage, progress, error messages, etc."""
    db_meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if not db_meeting:
        return None
    
    # Handle processing_logs specially to append instead of replace
    if 'processing_logs' in kwargs:
        new_logs = kwargs.pop('processing_logs')
        if isinstance(new_logs, list):
            new_logs_str = '\n'.join(new_logs)
        else:
            new_logs_str = str(new_logs)
            
        if db_meeting.processing_logs is None:
            db_meeting.processing_logs = new_logs_str
        else:
            # Append new logs to existing ones
            db_meeting.processing_logs = db_meeting.processing_logs + '\n' + new_logs_str
    
    # Update timestamp fields automatically
    if 'processing_start_time' in kwargs and isinstance(kwargs['processing_start_time'], (int, float)):
        from datetime import datetime
        kwargs['processing_start_time'] = datetime.fromtimestamp(kwargs['processing_start_time'])
    
    if 'stage_start_time' in kwargs and isinstance(kwargs['stage_start_time'], (int, float)):
        from datetime import datetime
        kwargs['stage_start_time'] = datetime.fromtimestamp(kwargs['stage_start_time'])
    
    # Update any other provided fields
    for key, value in kwargs.items():
        if hasattr(db_meeting, key):
            setattr(db_meeting, key, value)
    
    db.commit()
    db.refresh(db_meeting)
    return db_meeting
    return db_meeting
