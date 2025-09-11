import enum
from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    Text,
    Enum
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base

class MeetingStatus(enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True)
    filepath = Column(String, unique=True)
    status = Column(Enum(MeetingStatus), default=MeetingStatus.PENDING)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

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
