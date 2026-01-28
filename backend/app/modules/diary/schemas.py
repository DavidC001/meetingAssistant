"""Pydantic schemas for diary module."""
from datetime import date, datetime

from pydantic import BaseModel, Field


# Action Item Snapshot Schemas
class ActionItemSnapshot(BaseModel):
    """Snapshot of an action item at a point in time."""

    id: int
    task: str
    owner: str | None = None
    status: str
    priority: str | None = None
    due_date: str | None = None

    class Config:
        from_attributes = True


class ActionItemStatusChange(BaseModel):
    """Represents a status change for an action item."""

    action_item: ActionItemSnapshot
    from_status: str
    to_status: str
    changed_at: datetime


class ActionItemsDailySummary(BaseModel):
    """Summary of action items for a specific date."""

    date: date
    in_progress_items: list[ActionItemSnapshot] = Field(default_factory=list)
    completed_items: list[ActionItemSnapshot] = Field(default_factory=list)
    created_items: list[ActionItemSnapshot] = Field(default_factory=list)
    status_changes: list[ActionItemStatusChange] = Field(default_factory=list)


# Diary Entry Schemas
class DiaryEntryBase(BaseModel):
    """Base schema for diary entry."""

    date: date
    content: str | None = None
    mood: str | None = None
    highlights: list[str] | None = None
    blockers: list[str] | None = None
    arrival_time: str | None = None  # HH:MM format
    departure_time: str | None = None  # HH:MM format
    hours_worked: float | None = None


class DiaryEntryCreate(DiaryEntryBase):
    """Schema for creating a diary entry."""

    pass


class DiaryEntryUpdate(BaseModel):
    """Schema for updating a diary entry."""

    content: str | None = None
    mood: str | None = None
    highlights: list[str] | None = None
    blockers: list[str] | None = None
    reminder_dismissed: bool | None = None
    arrival_time: str | None = None
    departure_time: str | None = None
    hours_worked: float | None = None


class DiaryEntry(DiaryEntryBase):
    """Complete diary entry schema."""

    id: int
    created_at: datetime
    updated_at: datetime
    reminder_dismissed: bool = False
    is_work_day: bool = True

    class Config:
        from_attributes = True


class DiaryEntryWithActionItems(DiaryEntry):
    """Diary entry with action items summary."""

    action_items_summary: ActionItemsDailySummary | None = None


# Reminder Schemas
class DiaryReminderResponse(BaseModel):
    """Response for diary reminder check."""

    should_show_reminder: bool
    missing_date: date | None = None
    previous_work_day: date | None = None
    action_items_summary: ActionItemsDailySummary | None = None


class ReminderDismissRequest(BaseModel):
    """Request to dismiss a reminder for a specific date."""

    date: date


# Diary Action Item Snapshot Schemas
class DiaryActionItemSnapshotBase(BaseModel):
    """Base schema for diary action item snapshot."""

    action_item_id: int
    previous_status: str | None = None
    current_status: str
    notes: str | None = None


class DiaryActionItemSnapshotCreate(DiaryActionItemSnapshotBase):
    """Schema for creating a diary action item snapshot."""

    diary_entry_id: int


class DiaryActionItemSnapshot(DiaryActionItemSnapshotBase):
    """Complete diary action item snapshot schema."""

    id: int
    diary_entry_id: int
    status_changed_at: datetime

    class Config:
        from_attributes = True


# List response schemas
class DiaryEntriesListResponse(BaseModel):
    """Response for listing diary entries."""

    entries: list[DiaryEntry]
    total: int
    page: int = 1
    page_size: int = 50
