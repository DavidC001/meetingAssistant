from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional, Dict, Any
from .models import MeetingStatus, ProcessingStage

# API Key Schemas
class APIKeyBase(BaseModel):
    name: str
    provider: str
    environment_variable: str
    description: Optional[str] = None
    is_active: bool = True

class APIKeyCreate(APIKeyBase):
    pass

class APIKeyUpdate(BaseModel):
    name: Optional[str] = None
    provider: Optional[str] = None
    environment_variable: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class APIKey(APIKeyBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    masked_value: Optional[str] = None
    is_environment_key: bool = False

    class Config:
        from_attributes = True

# Model Configuration Schemas
class ModelConfigurationBase(BaseModel):
    name: str
    whisper_model: str = "base"
    whisper_provider: str = "faster-whisper"
    chat_provider: str = "openai"
    chat_model: str = "gpt-4o-mini"
    chat_base_url: Optional[str] = None
    chat_api_key_id: Optional[int] = None
    analysis_provider: str = "openai"
    analysis_model: str = "gpt-4o-mini"
    analysis_base_url: Optional[str] = None
    analysis_api_key_id: Optional[int] = None
    max_tokens: int = 4000
    is_default: bool = False

class ModelConfigurationCreate(ModelConfigurationBase):
    pass

class ModelConfigurationUpdate(BaseModel):
    name: Optional[str] = None
    whisper_model: Optional[str] = None
    whisper_provider: Optional[str] = None
    chat_provider: Optional[str] = None
    chat_model: Optional[str] = None
    chat_base_url: Optional[str] = None
    chat_api_key_id: Optional[int] = None
    analysis_provider: Optional[str] = None
    analysis_model: Optional[str] = None
    analysis_base_url: Optional[str] = None
    analysis_api_key_id: Optional[int] = None
    max_tokens: Optional[int] = None
    is_default: Optional[bool] = None

class ModelConfiguration(ModelConfigurationBase):
    id: int
    created_at: datetime
    updated_at: datetime
    chat_api_key: Optional[APIKey] = None
    analysis_api_key: Optional[APIKey] = None

    class Config:
        from_attributes = True

# Action Item Schemas
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
    transcription_id: int
    is_manual: bool = False
    google_calendar_event_id: Optional[str] = None
    synced_to_calendar: bool = False
    last_synced_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Google Calendar Schemas
class GoogleCalendarAuthUrl(BaseModel):
    auth_url: str

class GoogleCalendarAuthCode(BaseModel):
    code: str

class GoogleCalendarStatus(BaseModel):
    is_connected: bool
    calendar_id: Optional[str] = None
    email: Optional[str] = None

class CalendarEventSync(BaseModel):
    action_item_id: int
    sync: bool  # True to sync, False to unsync
# Speaker Schemas
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

# Attachment Schemas
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

# Chat Schemas
class ChatMessage(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True

class ChatHistoryResponse(BaseModel):
    history: List[ChatMessage]

class ChatRequest(BaseModel):
    query: str
    chat_history: Optional[List[dict]] = None
    top_k: Optional[int] = 5

class ChatResponse(BaseModel):
    response: str
    sources: List[Dict[str, Any]] = []

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
    model_configuration_id: Optional[int] = None

class MeetingUpdate(BaseModel):
    filename: Optional[str] = None
    transcription_language: Optional[str] = None
    number_of_speakers: Optional[str] = None
    model_configuration_id: Optional[int] = None
    tags: Optional[str] = None
    folder: Optional[str] = None
    notes: Optional[str] = None

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

    # Processing details and metadata
    file_size: Optional[int] = None
    estimated_duration: Optional[float] = None
    processing_start_time: Optional[datetime] = None
    stage_start_time: Optional[datetime] = None
    error_message: Optional[str] = None
    processing_logs: Optional[str] = None
    celery_task_id: Optional[str] = None
    audio_filepath: Optional[str] = None  # Path to playback audio file
    
    tags: Optional[str] = None
    folder: Optional[str] = None
    notes: Optional[str] = None
    speakers: List[Speaker] = []
    attachments: List[Attachment] = []
    transcription: Optional[Transcription] = None
    model_configuration: Optional[ModelConfiguration] = None

    class Config:
        from_attributes = True

# Embedding schemas
class EmbeddingConfigurationBase(BaseModel):
    provider: str
    model_name: str
    dimension: int
    base_url: Optional[str] = None
    api_key_id: Optional[int] = None
    settings: Optional[dict] = None
    is_active: bool = True

class EmbeddingConfigurationCreate(EmbeddingConfigurationBase):
    pass

class EmbeddingConfigurationUpdate(BaseModel):
    provider: Optional[str] = None
    model_name: Optional[str] = None
    dimension: Optional[int] = None
    base_url: Optional[str] = None
    api_key_id: Optional[int] = None
    settings: Optional[dict] = None
    is_active: Optional[bool] = None

class EmbeddingConfiguration(EmbeddingConfigurationBase):
    id: int
    created_at: datetime
    updated_at: datetime

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

class WorkerConfiguration(BaseModel):
    id: int
    max_workers: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class WorkerConfigurationUpdate(BaseModel):
    max_workers: int

class GlobalChatSession(BaseModel):
    id: int
    title: str
    tags: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class GlobalChatMessage(BaseModel):
    id: int
    session_id: int
    role: str
    content: str
    sources: Optional[List[Dict[str, Any]]] = None
    created_at: datetime

    class Config:
        from_attributes = True

class GlobalChatSessionCreate(BaseModel):
    title: Optional[str] = None
    tags: Optional[str] = None

class GlobalChatSessionUpdate(BaseModel):
    title: Optional[str] = None
    tags: Optional[str] = None

class GlobalChatMessageCreate(BaseModel):
    message: str
    chat_history: Optional[List[Dict[str, Any]]] = None
    top_k: Optional[int] = 5

class GlobalChatSessionDetail(BaseModel):
    session: GlobalChatSession
    messages: List[GlobalChatMessage]
