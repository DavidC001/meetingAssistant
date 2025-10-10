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
    Boolean
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base

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

    transcription = relationship("Transcription", back_populates="meeting", uselist=False, cascade="all, delete-orphan")
    model_configuration = relationship("ModelConfiguration", backref="meetings")
    chat_messages = relationship("ChatMessage", back_populates="meeting", cascade="all, delete-orphan")

    # New fields for tags and folders
    tags = Column(String, nullable=True)  # Comma-separated tags
    folder = Column(String, nullable=True)  # Folder name or path

    # Relationship for speakers
    speakers = relationship("Speaker", back_populates="meeting", cascade="all, delete-orphan")
    
    # Relationship for attachments
    attachments = relationship("Attachment", back_populates="meeting", cascade="all, delete-orphan")

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

class GoogleCalendarCredentials(Base):
    __tablename__ = "google_calendar_credentials"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, default="default")  # For multi-user support in the future
    credentials_json = Column(Text)  # Encrypted credentials
    calendar_id = Column(String, default="primary")  # Google Calendar ID to sync to
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
