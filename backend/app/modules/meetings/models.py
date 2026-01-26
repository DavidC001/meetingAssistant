import enum
from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    Text,
    Float,
    Boolean,
    JSON,
    Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ...database import Base
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
    audio_filepath = Column(String, nullable=True)
    status = Column(String, default=MeetingStatus.PENDING.value, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    meeting_date = Column(DateTime(timezone=True), nullable=True, index=True)
    
    transcription_language = Column(String, default="en-US")
    number_of_speakers = Column(String, default="auto")
    model_configuration_id = Column(Integer, ForeignKey("model_configurations.id"), nullable=True, index=True)
    
    current_stage = Column(String, nullable=True)
    stage_progress = Column(Float, default=0.0)
    overall_progress = Column(Float, default=0.0)
    
    file_size = Column(Integer, nullable=True)
    estimated_duration = Column(Float, nullable=True)
    processing_start_time = Column(DateTime(timezone=True), nullable=True)
    stage_start_time = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)
    processing_logs = Column(Text, nullable=True)
    celery_task_id = Column(String, nullable=True)
    embeddings_computed = Column(Boolean, default=False, nullable=False)
    embeddings_updated_at = Column(DateTime(timezone=True), nullable=True)
    embedding_config_id = Column(Integer, ForeignKey("embedding_configurations.id"), nullable=True)

    transcription = relationship("Transcription", back_populates="meeting", uselist=False, cascade="all, delete-orphan")
    model_configuration = relationship("ModelConfiguration", backref="meetings")
    chat_messages = relationship("ChatMessage", back_populates="meeting", cascade="all, delete-orphan")
    embedding_config = relationship("EmbeddingConfiguration", back_populates="meetings")

    tags = Column(String, nullable=True, index=True)
    folder = Column(String, nullable=True, index=True)
    notes = Column(Text, nullable=True)

    speakers = relationship("Speaker", back_populates="meeting", cascade="all, delete-orphan")
    attachments = relationship("Attachment", back_populates="meeting", cascade="all, delete-orphan")
    document_chunks = relationship("DocumentChunk", back_populates="meeting", cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_meeting_status_date', 'status', 'created_at'),
        Index('idx_meeting_folder_status', 'folder', 'status'),
        Index('idx_meeting_date_status', 'meeting_date', 'status'),
        Index('idx_meeting_embeddings', 'embeddings_computed', 'embeddings_updated_at'),
    )

class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"), nullable=False, index=True)
    filename = Column(String, nullable=False)
    filepath = Column(String, nullable=False)
    file_size = Column(Integer, nullable=True)
    mime_type = Column(String, nullable=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    description = Column(Text, nullable=True)

    meeting = relationship("Meeting", back_populates="attachments")

class Transcription(Base):
    __tablename__ = "transcriptions"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"), index=True)
    summary = Column(Text)
    full_text = Column(Text)

    meeting = relationship("Meeting", back_populates="transcription")
    action_items = relationship("ActionItem", back_populates="transcription", cascade="all, delete-orphan")

class ActionItem(Base):
    __tablename__ = "action_items"

    id = Column(Integer, primary_key=True, index=True)
    transcription_id = Column(Integer, ForeignKey("transcriptions.id"), nullable=True, index=True)
    task = Column(String)
    owner = Column(String, nullable=True)
    due_date = Column(String, nullable=True)
    is_manual = Column(Boolean, default=False)
    google_calendar_event_id = Column(String, nullable=True)
    synced_to_calendar = Column(Boolean, default=False)
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String, default="pending", index=True)
    priority = Column(String, nullable=True)
    notes = Column(Text, nullable=True)

    transcription = relationship("Transcription", back_populates="action_items")

class Speaker(Base):
    __tablename__ = "speakers"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"), index=True)
    name = Column(String, nullable=False)
    label = Column(String, nullable=True)

    meeting = relationship("Meeting", back_populates="speakers")

class DiarizationTiming(Base):
    __tablename__ = "diarization_timings"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"), index=True)
    audio_duration_seconds = Column(Float)
    processing_time_seconds = Column(Float)
    num_speakers = Column(Integer, nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    meeting = relationship("Meeting")

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

class MeetingLink(Base):
    __tablename__ = "meeting_links"

    id = Column(Integer, primary_key=True, index=True)
    source_meeting_id = Column(Integer, ForeignKey("meetings.id"), nullable=False, index=True)
    target_meeting_id = Column(Integer, ForeignKey("meetings.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    source_meeting = relationship("Meeting", foreign_keys=[source_meeting_id], backref="outgoing_links")
    target_meeting = relationship("Meeting", foreign_keys=[target_meeting_id], backref="incoming_links")

