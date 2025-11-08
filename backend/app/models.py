import enum
from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    Text,
    Enum,
    Float,
    Boolean,
    JSON
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base
from pgvector.sqlalchemy import Vector

class MeetingStatus(enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class ProcessingStage(enum.Enum):
    CONVERSION = "conversion"
    DIARIZATION = "diarization"
    TRANSCRIPTION = "transcription"
    ANALYSIS = "analysis"

class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True)
    filepath = Column(String, unique=True)
    audio_filepath = Column(String, nullable=True)  # Path to playback audio file (MP3)
    status = Column(String, default=MeetingStatus.PENDING.value)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    meeting_date = Column(DateTime(timezone=True), nullable=True)  # When the meeting actually took place
    
    # Processing configuration
    transcription_language = Column(String, default="en-US")
    number_of_speakers = Column(String, default="auto")  # Can be "auto" or a number as string
    model_configuration_id = Column(Integer, ForeignKey("model_configurations.id"), nullable=True)  # Link to model configuration
    
    # Progress tracking fields
    current_stage = Column(String, nullable=True)
    stage_progress = Column(Float, default=0.0)  # 0.0 to 100.0
    overall_progress = Column(Float, default=0.0)  # 0.0 to 100.0
    
    # Processing details and metadata
    file_size = Column(Integer, nullable=True)  # File size in bytes
    estimated_duration = Column(Float, nullable=True)  # Estimated processing duration in minutes
    processing_start_time = Column(DateTime(timezone=True), nullable=True)
    stage_start_time = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)  # Store error details if processing fails
    processing_logs = Column(Text, nullable=True)  # Store processing logs
    celery_task_id = Column(String, nullable=True)  # Track Celery task ID for cancellation
    embeddings_computed = Column(Boolean, default=False, nullable=False)
    embeddings_updated_at = Column(DateTime(timezone=True), nullable=True)
    embedding_config_id = Column(Integer, ForeignKey("embedding_configurations.id"), nullable=True)

    transcription = relationship("Transcription", back_populates="meeting", uselist=False, cascade="all, delete-orphan")
    model_configuration = relationship("ModelConfiguration", backref="meetings")
    chat_messages = relationship("ChatMessage", back_populates="meeting", cascade="all, delete-orphan")
    embedding_config = relationship("EmbeddingConfiguration", back_populates="meetings")

    # New fields for tags and folders
    tags = Column(String, nullable=True)  # Comma-separated tags
    folder = Column(String, nullable=True)  # Folder name or path
    notes = Column(Text, nullable=True)  # User notes for the meeting

    # Relationship for speakers
    speakers = relationship("Speaker", back_populates="meeting", cascade="all, delete-orphan")

    # Relationship for attachments
    attachments = relationship("Attachment", back_populates="meeting", cascade="all, delete-orphan")
    document_chunks = relationship("DocumentChunk", back_populates="meeting", cascade="all, delete-orphan")

class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"), nullable=False)
    filename = Column(String, nullable=False)  # Original filename
    filepath = Column(String, nullable=False)  # Stored file path
    file_size = Column(Integer, nullable=True)  # File size in bytes
    mime_type = Column(String, nullable=True)  # MIME type
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    description = Column(Text, nullable=True)  # Optional description

    meeting = relationship("Meeting", back_populates="attachments")

class Transcription(Base):
    __tablename__ = "transcriptions"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"))
    summary = Column(Text)
    full_text = Column(Text)

    meeting = relationship("Meeting", back_populates="transcription")
    action_items = relationship("ActionItem", back_populates="transcription", cascade="all, delete-orphan")

class ActionItem(Base):
    __tablename__ = "action_items"

    id = Column(Integer, primary_key=True, index=True)
    transcription_id = Column(Integer, ForeignKey("transcriptions.id"))
    task = Column(String)
    owner = Column(String, nullable=True)
    due_date = Column(String, nullable=True)
    # Manual edit tracking
    is_manual = Column(Boolean, default=False)  # True if manually added/edited
    # Calendar sync fields
    google_calendar_event_id = Column(String, nullable=True)  # Google Calendar event ID
    synced_to_calendar = Column(Boolean, default=False)  # Whether synced to Google Calendar
    last_synced_at = Column(DateTime(timezone=True), nullable=True)  # Last sync timestamp
    # Additional fields
    status = Column(String, default="pending")  # pending, in_progress, completed, cancelled
    priority = Column(String, nullable=True)  # low, medium, high
    notes = Column(Text, nullable=True)  # Additional notes

    transcription = relationship("Transcription", back_populates="action_items")
class Speaker(Base):
    __tablename__ = "speakers"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"))
    name = Column(String, nullable=False)  # Speaker name
    label = Column(String, nullable=True)  # Diarization label (e.g., Speaker 1)

    meeting = relationship("Meeting", back_populates="speakers")

class DiarizationTiming(Base):
    __tablename__ = "diarization_timings"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"))
    audio_duration_seconds = Column(Float)  # Duration of the audio file
    processing_time_seconds = Column(Float)  # Time taken for diarization
    num_speakers = Column(Integer, nullable=True)  # Number of speakers detected
    file_size_bytes = Column(Integer, nullable=True)  # File size for correlation
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    meeting = relationship("Meeting")

class APIKey(Base):
    __tablename__ = "api_keys"
    
    id = Column(Integer, primary_key=True, index=True)      
    name = Column(String, unique=True, index=True)  # Friendly name for the API key
    provider = Column(String, index=True)  # Provider: openai, anthropic, etc.
    environment_variable = Column(String)  # Environment variable name containing the actual key
    description = Column(String, nullable=True)  # Optional description
    is_active = Column(Boolean, default=True)  # Whether this key is active
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class ModelConfiguration(Base):
    __tablename__ = "model_configurations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)  # Configuration name (e.g., "default", "high-quality")
    
    # Whisper/Transcription Configuration
    whisper_model = Column(String, default="base")  # Model size: base, small, medium, large-v3
    whisper_provider = Column(String, default="faster-whisper")  # Provider: faster-whisper, openai-whisper
    
    # Chat/Conversation Configuration  
    chat_provider = Column(String, default="openai")  # Provider: openai, ollama
    chat_model = Column(String, default="gpt-4o-mini")  # Model name
    chat_base_url = Column(String, nullable=True)  # Custom base URL for ollama
    chat_api_key_id = Column(Integer, ForeignKey("api_keys.id"), nullable=True)  # Reference to API key
    
    # Analysis/Summarization Configuration
    analysis_provider = Column(String, default="openai")  # Provider: openai, ollama
    analysis_model = Column(String, default="gpt-4o-mini")  # Model name  
    analysis_base_url = Column(String, nullable=True)  # Custom base URL for ollama
    analysis_api_key_id = Column(Integer, ForeignKey("api_keys.id"), nullable=True)  # Reference to API key
    
    # Additional Configuration
    max_tokens = Column(Integer, default=4000)  # Maximum tokens for responses
    max_reasoning_depth = Column(Integer, default=3)  # Maximum depth for iterative research tool (1-10)
    
    # Metadata
    is_default = Column(Boolean, default=False)  # Whether this is the default configuration
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    chat_api_key = relationship("APIKey", foreign_keys=[chat_api_key_id])
    analysis_api_key = relationship("APIKey", foreign_keys=[analysis_api_key_id])

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"), nullable=False)
    role = Column(String, nullable=False)  # 'user' or 'assistant'
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    meeting = relationship("Meeting", back_populates="chat_messages")

class EmbeddingConfiguration(Base):
    __tablename__ = "embedding_configurations"

    id = Column(Integer, primary_key=True, index=True)
    provider = Column(String, nullable=False)
    model_name = Column(String, nullable=False)
    dimension = Column(Integer, nullable=False)
    base_url = Column(String, nullable=True)
    api_key_id = Column(Integer, ForeignKey("api_keys.id"), nullable=True)
    settings = Column(JSON, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    api_key = relationship("APIKey")
    meetings = relationship("Meeting", back_populates="embedding_config")
    document_chunks = relationship("DocumentChunk", back_populates="embedding_config", cascade="all, delete-orphan")

class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"), nullable=False, index=True)
    attachment_id = Column(Integer, ForeignKey("attachments.id"), nullable=True, index=True)
    content = Column(Text, nullable=False)
    content_type = Column(String, nullable=False)
    chunk_index = Column(Integer, nullable=False)
    chunk_metadata = Column(JSON, nullable=True)
    embedding = Column(Vector(), nullable=False)
    embedding_config_id = Column(Integer, ForeignKey("embedding_configurations.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    meeting = relationship("Meeting", back_populates="document_chunks")
    embedding_config = relationship("EmbeddingConfiguration", back_populates="document_chunks")
    attachment = relationship("Attachment")

class GlobalChatSession(Base):
    __tablename__ = "global_chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False, default="New chat")
    tags = Column(String, nullable=True)  # Comma-separated tags
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Filter options for constraining RAG retrieval
    filter_folder = Column(String, nullable=True)  # Filter meetings by folder
    filter_tags = Column(String, nullable=True)  # Filter meetings by tags (comma-separated)

    messages = relationship("GlobalChatMessage", back_populates="session", cascade="all, delete-orphan")

class GlobalChatMessage(Base):
    __tablename__ = "global_chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("global_chat_sessions.id"), nullable=False, index=True)
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    sources = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("GlobalChatSession", back_populates="messages")

class WorkerConfiguration(Base):
    __tablename__ = "worker_configuration"

    id = Column(Integer, primary_key=True, index=True)
    max_workers = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class GoogleCalendarCredentials(Base):
    __tablename__ = "google_calendar_credentials"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, default="default")  # For multi-user support in the future
    credentials_json = Column(Text)  # Encrypted credentials
    calendar_id = Column(String, default="primary")  # Google Calendar ID to sync to
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class ScheduledMeeting(Base):
    __tablename__ = "scheduled_meetings"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)  # Meeting title/summary
    description = Column(Text, nullable=True)  # Meeting description
    scheduled_time = Column(DateTime(timezone=True), nullable=False)  # When the meeting is scheduled
    duration_minutes = Column(Integer, default=60)  # Expected duration
    location = Column(String, nullable=True)  # Meeting location (physical or virtual)
    attendees = Column(Text, nullable=True)  # Comma-separated list of attendees
    
    # Google Calendar integration
    google_calendar_event_id = Column(String, nullable=True, unique=True)  # Google Calendar event ID
    google_meet_link = Column(String, nullable=True)  # Google Meet conference link if available
    
    # Status and linking
    status = Column(String, default="scheduled")  # scheduled, completed, cancelled
    linked_meeting_id = Column(Integer, ForeignKey("meetings.id"), nullable=True)  # Link to uploaded meeting
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_synced_at = Column(DateTime(timezone=True), nullable=True)  # Last time synced from Google Calendar
    
    # Relationships
    linked_meeting = relationship("Meeting", backref="scheduled_meeting", foreign_keys=[linked_meeting_id])

class MeetingLink(Base):
    __tablename__ = "meeting_links"

    id = Column(Integer, primary_key=True, index=True)
    source_meeting_id = Column(Integer, ForeignKey("meetings.id"), nullable=False, index=True)
    target_meeting_id = Column(Integer, ForeignKey("meetings.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    source_meeting = relationship("Meeting", foreign_keys=[source_meeting_id], backref="outgoing_links")
    target_meeting = relationship("Meeting", foreign_keys=[target_meeting_id], backref="incoming_links")

class UserMapping(Base):
    """Maps person names to email addresses for task assignment and calendar sync"""
    __tablename__ = "user_mappings"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)  # Person's name as it appears in meetings (e.g., "Davide Cavicchini")
    email = Column(String, nullable=False, index=True)  # Person's email address (e.g., "davide@example.com")
    is_active = Column(Boolean, default=True)  # Whether this mapping is active
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
