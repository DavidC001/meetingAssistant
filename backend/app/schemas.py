from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional
from .models import MeetingStatus

# Action Item Schemas
class ActionItemBase(BaseModel):
    task: str
    owner: Optional[str] = None
    due_date: Optional[str] = None

class ActionItemCreate(ActionItemBase):
    pass

class ActionItem(ActionItemBase):
    id: int
    transcription_id: int

    class Config:
        orm_mode = True

# Transcription Schemas
class TranscriptionBase(BaseModel):
    summary: str
    full_text: str

class TranscriptionCreate(TranscriptionBase):
    pass

class Transcription(TranscriptionBase):
    id: int
    meeting_id: int
    action_items: List[ActionItem] = []

    class Config:
        orm_mode = True

# Meeting Schemas
class MeetingMetadata(BaseModel):
    file_path: str
    file_size: int
    created_time: float
    modified_time: float
    duration: Optional[float] = None
    tags: Optional[dict] = None
    meeting_date: Optional[datetime] = None
    meeting_topic: Optional[str] = None
    detected_language: Optional[str] = None
    file_type: Optional[str] = None

class MeetingBase(BaseModel):
    filename: str

class MeetingCreate(MeetingBase):
    pass

class Meeting(MeetingBase):
    id: int
    status: MeetingStatus
    created_at: datetime
    transcription: Optional[Transcription] = None

    class Config:
        orm_mode = True
