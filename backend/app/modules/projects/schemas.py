"""Pydantic schemas for projects feature."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

# ============ PROJECT SCHEMAS ============


class ProjectBase(BaseModel):
    """Base project schema."""

    name: str
    description: str | None = None
    status: str = "active"
    color: str | None = None
    icon: str | None = None
    start_date: datetime | None = None
    target_end_date: datetime | None = None


class ProjectCreate(ProjectBase):
    """Schema for creating a project."""

    meeting_ids: list[int] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)


class ProjectUpdate(BaseModel):
    """Schema for updating a project."""

    name: str | None = None
    description: str | None = None
    status: str | None = None
    color: str | None = None
    icon: str | None = None
    start_date: datetime | None = None
    target_end_date: datetime | None = None
    actual_end_date: datetime | None = None
    settings: dict[str, Any] | None = None
    meeting_ids: list[int] | None = None
    tags: list[str] | None = None


class Project(ProjectBase):
    """Complete project schema."""

    id: int
    meeting_ids: list[int] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    actual_end_date: datetime | None = None
    created_at: datetime
    updated_at: datetime
    settings: dict[str, Any] = Field(default_factory=dict)

    # Computed fields (populated by service layer)
    meeting_count: int = 0
    action_item_count: int = 0
    completed_action_items: int = 0
    member_count: int = 0

    class Config:
        from_attributes = True


class ProjectWithDetails(Project):
    """Project with full details including relationships."""

    milestones: list["ProjectMilestone"] = Field(default_factory=list)
    members: list["ProjectMember"] = Field(default_factory=list)
    recent_activity: list["ActivityItem"] = Field(default_factory=list)


# ============ MILESTONE SCHEMAS ============


class ProjectMilestoneBase(BaseModel):
    """Base milestone schema."""

    name: str
    description: str | None = None
    due_date: datetime | None = None
    color: str | None = None


class ProjectMilestoneCreate(ProjectMilestoneBase):
    """Schema for creating a milestone."""

    pass


class ProjectMilestoneUpdate(BaseModel):
    """Schema for updating a milestone."""

    name: str | None = None
    description: str | None = None
    due_date: datetime | None = None
    status: str | None = None
    color: str | None = None


class ProjectMilestone(ProjectMilestoneBase):
    """Complete milestone schema."""

    id: int
    project_id: int
    status: str
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============ MEMBER SCHEMAS ============


class ProjectMemberBase(BaseModel):
    """Base member schema."""

    name: str
    email: str | None = None
    role: str = "member"


class ProjectMemberCreate(ProjectMemberBase):
    """Schema for creating a member."""

    user_mapping_id: int | None = None


class ProjectMemberUpdate(BaseModel):
    """Schema for updating a member."""

    role: str | None = None
    email: str | None = None


class ProjectMember(ProjectMemberBase):
    """Complete member schema."""

    id: int
    project_id: int
    user_mapping_id: int | None = None
    is_auto_detected: bool
    added_at: datetime

    class Config:
        from_attributes = True


# ============ CHAT SCHEMAS ============


class ProjectChatSessionCreate(BaseModel):
    """Schema for creating a chat session."""

    title: str = "New chat"


class ProjectChatSession(BaseModel):
    """Complete chat session schema."""

    id: int
    project_id: int
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int = 0

    class Config:
        from_attributes = True


class ProjectChatSessionUpdate(BaseModel):
    """Schema for updating a chat session."""

    title: str | None = None


class ProjectChatRequest(BaseModel):
    """Schema for chat request."""

    message: str
    session_id: int | None = None  # Create new session if None


class ProjectChatResponse(BaseModel):
    """Schema for chat response."""

    session_id: int
    message: str
    sources: list[dict[str, Any]] = Field(default_factory=list)
    follow_up_suggestions: list[str] = Field(default_factory=list)


class ProjectChatMessage(BaseModel):
    """Chat message schema."""

    id: int
    session_id: int
    role: str
    content: str
    sources: list[dict[str, Any]] | None = None
    follow_up_suggestions: list[str] | None = None
    created_at: datetime

    class Config:
        from_attributes = True


# ============ NOTES SCHEMAS ============


class ProjectNoteBase(BaseModel):
    """Base note schema."""

    title: str
    content: str | None = None
    pinned: bool = False


class ProjectNoteCreate(ProjectNoteBase):
    """Schema for creating a note."""

    pass


class ProjectNoteUpdate(BaseModel):
    """Schema for updating a note."""

    title: str | None = None
    content: str | None = None
    pinned: bool | None = None


class ProjectNote(ProjectNoteBase):
    """Complete note schema."""

    id: int
    project_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProjectNoteAttachment(BaseModel):
    """Project note attachment schema."""

    id: int
    project_id: int
    note_id: int
    filename: str
    filepath: str
    file_size: int | None = None
    mime_type: str | None = None
    uploaded_at: datetime
    description: str | None = None

    class Config:
        from_attributes = True


# ============ ANALYTICS SCHEMAS ============


class ProjectAnalytics(BaseModel):
    """Project analytics and metrics schema."""

    project_id: int
    total_meetings: int
    total_duration_hours: float
    total_action_items: int
    completed_action_items: int
    pending_action_items: int
    overdue_action_items: int
    unique_participants: int
    meetings_by_month: list[dict[str, Any]] = Field(default_factory=list)
    action_items_by_status: dict[str, int] = Field(default_factory=dict)
    action_items_by_owner: list[dict[str, Any]] = Field(default_factory=list)
    milestone_progress: dict[str, Any] = Field(default_factory=dict)
    activity_trend: list[dict[str, Any]] = Field(default_factory=list)


# ============ GANTT SCHEMAS ============


class GanttItem(BaseModel):
    """Gantt chart item schema."""

    id: str
    name: str
    type: str  # meeting, action_item, milestone
    start_date: datetime
    end_date: datetime | None = None
    progress: float = 0
    dependencies: list[str] = Field(default_factory=list)
    color: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class GanttItemUpdate(BaseModel):
    """Schema for updating a Gantt item."""

    start_date: datetime | None = None
    end_date: datetime | None = None


class GanttLink(BaseModel):
    """Gantt dependency link schema."""

    id: str
    source: str
    target: str
    type: str = "e2s"


class GanttLinkCreate(BaseModel):
    """Create gantt dependency link schema."""

    source: str
    target: str
    type: str = "e2s"


class GanttData(BaseModel):
    """Gantt chart data schema."""

    items: list[GanttItem] = Field(default_factory=list)
    milestones: list[ProjectMilestone] = Field(default_factory=list)
    date_range: dict[str, Any] = Field(default_factory=dict)
    links: list[GanttLink] = Field(default_factory=list)


# ============ PROJECT ACTION ITEMS ============


class ProjectActionItemCreate(BaseModel):
    """Create action item within project context."""

    task: str = Field(..., description="Description of the action item task")
    owner: str | None = None
    start_date: datetime | None = None
    due_date: str | None = None
    status: str | None = "pending"
    priority: str | None = None
    notes: str | None = None
    meeting_id: int | None = None


# ============ ACTIVITY SCHEMAS ============


class ActivityItem(BaseModel):
    """Activity feed item schema."""

    type: str  # meeting_added, action_item_completed, milestone_reached, etc.
    timestamp: datetime
    description: str
    metadata: dict[str, Any] = Field(default_factory=dict)
