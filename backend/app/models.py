import enum
from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    Text,
    Enum,
    Float
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
    status = Column(String, default=MeetingStatus.PENDING.value)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Processing configuration
    transcription_language = Column(String, default="en-US")
    number_of_speakers = Column(String, default="auto")  # Can be "auto" or a number as string
    
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

    transcription = relationship("Transcription", back_populates="action_items")
