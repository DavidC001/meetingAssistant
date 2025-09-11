from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
import os
import shutil

from .. import crud, models, schemas
from ..database import get_db

router = APIRouter(
    prefix="/meetings",
    tags=["meetings"],
)

# Define a directory to store uploaded files
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/", response_model=schemas.Meeting)
def create_upload_file(
    file: UploadFile = File(...), db: Session = Depends(get_db)
):
    """
    Upload a new meeting file for processing.
    """
    # Save the uploaded file to the UPLOAD_DIR
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Create a meeting record in the database
    meeting_create = schemas.MeetingCreate(filename=file.filename)
    db_meeting = crud.create_meeting(db=db, meeting=meeting_create, filepath=file_path)

    # Trigger the background processing task
    from ..tasks import process_meeting_task
    process_meeting_task.delay(db_meeting.id)

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
