"""Database models for diary module."""
from sqlalchemy import JSON, Boolean, Column, Date, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class DiaryEntry(Base):
    """Model for daily work diary entries."""

    __tablename__ = "diary_entries"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, unique=True, nullable=False, index=True)
    content = Column(Text, nullable=True)  # Markdown supported
    mood = Column(String(50), nullable=True)  # e.g., "productive", "challenging", "normal"
    highlights = Column(JSON, nullable=True)  # Array of key accomplishments
    blockers = Column(JSON, nullable=True)  # Array of blockers/challenges
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    reminder_dismissed = Column(Boolean, default=False, nullable=False)
    is_work_day = Column(Boolean, default=True, nullable=False)

    # Time tracking fields
    arrival_time = Column(String(5), nullable=True)  # HH:MM format
    departure_time = Column(String(5), nullable=True)  # HH:MM format
    hours_worked = Column(Float, nullable=True)  # Calculated or manual
    action_items_worked_on = Column(JSON, nullable=True)  # Array of action item IDs
    action_items_completed = Column(JSON, nullable=True)  # Array of action item IDs
    meetings_attended = Column(JSON, nullable=True)  # Array of meeting IDs or names

    # Relationships
    action_item_snapshots = relationship(
        "DiaryActionItemSnapshot", back_populates="diary_entry", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<DiaryEntry(date={self.date}, mood={self.mood})>"


class DiaryActionItemSnapshot(Base):
    """Model for tracking action item status changes for each day."""

    __tablename__ = "diary_action_item_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    diary_entry_id = Column(Integer, ForeignKey("diary_entries.id", ondelete="CASCADE"), nullable=False)
    action_item_id = Column(Integer, ForeignKey("action_items.id", ondelete="CASCADE"), nullable=False)
    previous_status = Column(String(50), nullable=True)  # Status at start of day or when first seen
    current_status = Column(String(50), nullable=False)  # Status at end of day
    status_changed_at = Column(DateTime(timezone=True), server_default=func.now())
    notes = Column(Text, nullable=True)  # Optional notes about what was done

    # Relationships
    diary_entry = relationship("DiaryEntry", back_populates="action_item_snapshots")
    action_item = relationship("ActionItem")

    # Create composite index for efficient queries
    __table_args__ = (Index("idx_diary_action_item", "diary_entry_id", "action_item_id"),)

    def __repr__(self):
        return f"<DiaryActionItemSnapshot(diary_id={self.diary_entry_id}, action_item_id={self.action_item_id})>"
