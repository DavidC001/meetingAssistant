from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional
from .models import MeetingStatus, ProcessingStage

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
        from_attributes = True

# Chat Schemas
class ChatRequest(BaseModel):
    query: str
    chat_history: Optional[List[dict]] = None

class ChatResponse(BaseModel):
    response: str

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
        from_attributes = True

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
    transcription_language: Optional[str] = "en-US"
    number_of_speakers: Optional[str] = "auto"

class MeetingUpdate(MeetingBase):
    transcription_language: Optional[str] = None
    number_of_speakers: Optional[str] = None

class Meeting(MeetingBase):
    id: int
    status: MeetingStatus
    created_at: datetime
    transcription_language: Optional[str] = "en-US"
    number_of_speakers: Optional[str] = "auto"
    current_stage: Optional[ProcessingStage] = None
    stage_progress: float = 0.0
    overall_progress: float = 0.0
    
    # Processing details and metadata
    file_size: Optional[int] = None
    estimated_duration: Optional[float] = None
    processing_start_time: Optional[datetime] = None
    stage_start_time: Optional[datetime] = None
    error_message: Optional[str] = None
    processing_logs: Optional[str] = None
    celery_task_id: Optional[str] = None
    
    transcription: Optional[Transcription] = None

    class Config:
        from_attributes = True
