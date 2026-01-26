from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional, Dict, Any
from .models import MeetingStatus, ProcessingStage
from ..settings.schemas import ModelConfiguration

class TaskStatus(BaseModel):
    """Status of an asynchronous task."""
    status: str
    task_id: Optional[str] = None
    audio_filepath: Optional[str] = None
    message: Optional[str] = None

class BatchTaskStatus(BaseModel):
    """Status of a batch operation."""
    status: str
    count: int
    task_ids: List[str]
    message: Optional[str] = None

class SpeakerBase(BaseModel):
    name: str
    label: Optional[str] = None

class SpeakerCreate(SpeakerBase):
    pass

class Speaker(SpeakerBase):
    id: int
    meeting_id: int

    class Config:
        from_attributes = True

class AttachmentBase(BaseModel):
    filename: str
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    description: Optional[str] = None

class AttachmentCreate(AttachmentBase):
    pass

class Attachment(AttachmentBase):
    id: int
    meeting_id: int
    filepath: str
    uploaded_at: datetime

    class Config:
        from_attributes = True

class ActionItemBase(BaseModel):
    task: str
    owner: Optional[str] = None
    due_date: Optional[str] = None
    status: Optional[str] = "pending"
    priority: Optional[str] = None
    notes: Optional[str] = None

class ActionItemCreate(ActionItemBase):
    pass

class ActionItemUpdate(BaseModel):
    task: Optional[str] = None
    owner: Optional[str] = None
    due_date: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    notes: Optional[str] = None

class ActionItem(ActionItemBase):
    id: int
    transcription_id: Optional[int] = None
    is_manual: bool = False
    google_calendar_event_id: Optional[str] = None
    synced_to_calendar: bool = False
    last_synced_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ActionItemWithMeeting(ActionItem):
    meeting_id: Optional[int] = None
    meeting_title: Optional[str] = None
    meeting_date: Optional[datetime] = None

    class Config:
        from_attributes = True

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
    model_configuration_id: Optional[int] = None
    meeting_date: Optional[datetime] = None

class MeetingUpdate(BaseModel):
    filename: Optional[str] = None
    transcription_language: Optional[str] = None
    number_of_speakers: Optional[str] = None
    model_configuration_id: Optional[int] = None
    tags: Optional[str] = None
    folder: Optional[str] = None
    notes: Optional[str] = None
    meeting_date: Optional[datetime] = None

class Meeting(MeetingBase):
    id: int
    status: MeetingStatus
    created_at: datetime
    transcription_language: Optional[str] = "en-US"
    number_of_speakers: Optional[str] = "auto"
    model_configuration_id: Optional[int] = None
    current_stage: Optional[ProcessingStage] = None
    stage_progress: float = 0.0
    overall_progress: float = 0.0
    embeddings_computed: bool = False
    embeddings_updated_at: Optional[datetime] = None
    embedding_config_id: Optional[int] = None

    file_size: Optional[int] = None
    estimated_duration: Optional[float] = None
    processing_start_time: Optional[datetime] = None
    stage_start_time: Optional[datetime] = None
    error_message: Optional[str] = None
    processing_logs: Optional[str] = None
    celery_task_id: Optional[str] = None
    audio_filepath: Optional[str] = None
    
    tags: Optional[str] = None
    folder: Optional[str] = None
    notes: Optional[str] = None
    meeting_date: Optional[datetime] = None
    speakers: List[Speaker] = []
    attachments: List[Attachment] = []
    transcription: Optional[Transcription] = None
    model_configuration: Optional[ModelConfiguration] = None

    class Config:
        from_attributes = True

class DocumentChunk(BaseModel):
    id: int
    meeting_id: int
    attachment_id: Optional[int] = None
    content: str
    content_type: str
    chunk_index: int
    chunk_metadata: Optional[Dict[str, Any]] = None
    similarity: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True


class BulkDeleteRequest(BaseModel):
    """Schema for bulk delete operation"""
    meeting_ids: list[int]


class BulkUpdateRequest(BaseModel):
    """Schema for bulk update operation"""
    meeting_ids: list[int]
    updates: MeetingUpdate


class BulkOperationResponse(BaseModel):
    """Response for bulk operations"""
    success_count: int
    failed_count: int
    failed_ids: list[int]
    errors: Optional[Dict[int, str]] = None
