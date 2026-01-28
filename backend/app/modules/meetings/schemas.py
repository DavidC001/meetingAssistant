from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from ..settings.schemas import ModelConfiguration
from .models import MeetingStatus, ProcessingStage


class TaskStatus(BaseModel):
    """Status of an asynchronous task."""

    status: str
    task_id: str | None = None
    audio_filepath: str | None = None
    message: str | None = None


class BatchTaskStatus(BaseModel):
    """Status of a batch operation."""

    status: str
    count: int
    task_ids: list[str]
    message: str | None = None


class SpeakerBase(BaseModel):
    name: str
    label: str | None = None


class SpeakerCreate(SpeakerBase):
    pass


class Speaker(SpeakerBase):
    id: int
    meeting_id: int

    class Config:
        from_attributes = True


class AttachmentBase(BaseModel):
    filename: str
    file_size: int | None = None
    mime_type: str | None = None
    description: str | None = None


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
    """Base schema for action items extracted from meetings."""

    task: str = Field(
        ..., description="Description of the action item task", example="Send follow-up email to stakeholders"
    )
    owner: str | None = Field(None, description="Person assigned to the task", example="John Doe")
    due_date: str | None = Field(
        None, description="Due date for the task (ISO format or natural language)", example="2024-02-01"
    )
    status: str | None = Field("pending", description="Current status of the action item", example="pending")
    priority: str | None = Field(None, description="Priority level (low, medium, high)", example="high")
    notes: str | None = Field(
        None, description="Additional notes or context", example="Include Q4 metrics in the email"
    )


class ActionItemCreate(ActionItemBase):
    pass


class ActionItemUpdate(BaseModel):
    task: str | None = None
    owner: str | None = None
    due_date: str | None = None
    status: str | None = None
    priority: str | None = None
    notes: str | None = None


class ActionItem(ActionItemBase):
    id: int
    transcription_id: int | None = None
    is_manual: bool = False
    google_calendar_event_id: str | None = None
    synced_to_calendar: bool = False
    last_synced_at: datetime | None = None

    class Config:
        from_attributes = True


class ActionItemWithMeeting(ActionItem):
    meeting_id: int | None = None
    meeting_title: str | None = None
    meeting_date: datetime | None = None

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
    action_items: list[ActionItem] = []

    class Config:
        from_attributes = True


class MeetingMetadata(BaseModel):
    file_path: str
    file_size: int
    created_time: float
    modified_time: float
    duration: float | None = None
    tags: dict | None = None
    meeting_date: datetime | None = None
    meeting_topic: str | None = None
    detected_language: str | None = None
    file_type: str | None = None


class MeetingBase(BaseModel):
    filename: str


class MeetingCreate(MeetingBase):
    """Schema for creating a new meeting."""

    transcription_language: str | None = Field(
        "en-US", description="Language code for transcription (ISO 639-1 with country code)", example="en-US"
    )
    number_of_speakers: str | None = Field(
        "auto", description="Expected number of speakers or 'auto' for automatic detection", example="auto"
    )
    model_configuration_id: int | None = Field(
        None, description="ID of the model configuration to use for analysis", example=1
    )
    meeting_date: datetime | None = Field(
        None, description="Date and time of the meeting (ISO 8601 format)", example="2024-01-15T10:00:00Z"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "filename": "team_standup.mp3",
                "transcription_language": "en-US",
                "number_of_speakers": "auto",
                "meeting_date": "2024-01-15T10:00:00Z",
            }
        }


class MeetingUpdate(BaseModel):
    filename: str | None = None
    transcription_language: str | None = None
    number_of_speakers: str | None = None
    model_configuration_id: int | None = None
    tags: str | None = None
    folder: str | None = None
    notes: str | None = None
    meeting_date: datetime | None = None


class Meeting(MeetingBase):
    id: int
    status: MeetingStatus
    created_at: datetime
    transcription_language: str | None = "en-US"
    number_of_speakers: str | None = "auto"
    model_configuration_id: int | None = None
    current_stage: ProcessingStage | None = None
    stage_progress: float = 0.0
    overall_progress: float = 0.0
    embeddings_computed: bool = False
    embeddings_updated_at: datetime | None = None
    embedding_config_id: int | None = None

    file_size: int | None = None
    estimated_duration: float | None = None
    processing_start_time: datetime | None = None
    stage_start_time: datetime | None = None
    error_message: str | None = None
    processing_logs: str | None = None
    celery_task_id: str | None = None
    audio_filepath: str | None = None

    tags: str | None = None
    folder: str | None = None
    notes: str | None = None
    meeting_date: datetime | None = None
    speakers: list[Speaker] = []
    attachments: list[Attachment] = []
    transcription: Transcription | None = None
    model_configuration: ModelConfiguration | None = None

    class Config:
        from_attributes = True


class DocumentChunk(BaseModel):
    id: int
    meeting_id: int
    attachment_id: int | None = None
    content: str
    content_type: str
    chunk_index: int
    chunk_metadata: dict[str, Any] | None = None
    similarity: float | None = None
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
    errors: dict[int, str] | None = None
