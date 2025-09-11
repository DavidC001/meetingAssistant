from sqlalchemy.orm import Session
from . import models, schemas

# Meeting CRUD operations
def get_meeting(db: Session, meeting_id: int):
    return db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()

def get_meetings(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Meeting).offset(skip).limit(limit).all()

def create_meeting(db: Session, meeting: schemas.MeetingCreate, filepath: str):
    db_meeting = models.Meeting(
        filename=meeting.filename,
        filepath=filepath,
        status=models.MeetingStatus.PENDING
    )
    db.add(db_meeting)
    db.commit()
    db.refresh(db_meeting)
    return db_meeting

def update_meeting_status(db: Session, meeting_id: int, status: models.MeetingStatus):
    db_meeting = get_meeting(db, meeting_id)
    if db_meeting:
        db_meeting.status = status
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
        db.delete(db_meeting)
        db.commit()
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
