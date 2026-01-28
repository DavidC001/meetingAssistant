"""Schemas for meeting templates."""
from datetime import datetime

from pydantic import BaseModel


class MeetingTemplateBase(BaseModel):
    name: str
    description: str | None = None
    template_type: str  # standup, retrospective, 1on1, brainstorm, planning, review, custom

    # Default settings
    default_language: str | None = "en-US"
    default_speakers: str | None = "auto"
    default_folder: str | None = None
    default_tags: str | None = None

    # Expected structure
    expected_speakers: list[str] | None = None
    summary_sections: list[str] | None = None
    action_item_categories: list[str] | None = None

    # AI prompts
    custom_summary_prompt: str | None = None
    custom_action_item_prompt: str | None = None

    # Metadata
    icon: str | None = "📋"
    color: str | None = "#1976d2"


class MeetingTemplateCreate(MeetingTemplateBase):
    pass


class MeetingTemplateUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    template_type: str | None = None
    default_language: str | None = None
    default_speakers: str | None = None
    default_folder: str | None = None
    default_tags: str | None = None
    expected_speakers: list[str] | None = None
    summary_sections: list[str] | None = None
    action_item_categories: list[str] | None = None
    custom_summary_prompt: str | None = None
    custom_action_item_prompt: str | None = None
    icon: str | None = None
    color: str | None = None
    is_active: bool | None = None


class MeetingTemplate(MeetingTemplateBase):
    id: int
    is_default: bool = False
    is_active: bool = True
    usage_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Default templates
DEFAULT_TEMPLATES = [
    {
        "name": "Daily Standup",
        "description": "Quick daily sync to share updates and blockers",
        "template_type": "standup",
        "icon": "🌅",
        "color": "#4CAF50",
        "default_folder": "Standups",
        "default_tags": "standup,daily",
        "summary_sections": ["Yesterday's Progress", "Today's Goals", "Blockers"],
        "action_item_categories": ["Follow-up", "Blocker Resolution"],
        "is_default": True,
    },
    {
        "name": "Sprint Retrospective",
        "description": "Review what went well and areas for improvement",
        "template_type": "retrospective",
        "icon": "🔄",
        "color": "#9C27B0",
        "default_folder": "Retrospectives",
        "default_tags": "retro,sprint",
        "summary_sections": ["What Went Well", "What Could Be Improved", "Action Items"],
        "action_item_categories": ["Process Improvement", "Team Action", "Technical Debt"],
        "is_default": True,
    },
    {
        "name": "1:1 Meeting",
        "description": "Private conversation between manager and team member",
        "template_type": "1on1",
        "icon": "👥",
        "color": "#2196F3",
        "default_speakers": "2",
        "default_folder": "1-on-1s",
        "default_tags": "1on1,private",
        "summary_sections": ["Updates", "Feedback", "Career Development", "Personal"],
        "action_item_categories": ["Growth", "Feedback", "Support Needed"],
        "is_default": True,
    },
    {
        "name": "Brainstorming Session",
        "description": "Creative session to generate and explore ideas",
        "template_type": "brainstorm",
        "icon": "💡",
        "color": "#FF9800",
        "default_folder": "Brainstorms",
        "default_tags": "brainstorm,ideas",
        "summary_sections": ["Ideas Generated", "Top Concepts", "Next Steps"],
        "action_item_categories": ["Research", "Prototype", "Validate"],
        "is_default": True,
    },
    {
        "name": "Sprint Planning",
        "description": "Plan work for the upcoming sprint",
        "template_type": "planning",
        "icon": "📅",
        "color": "#3F51B5",
        "default_folder": "Planning",
        "default_tags": "planning,sprint",
        "summary_sections": ["Sprint Goals", "Stories Committed", "Capacity", "Risks"],
        "action_item_categories": ["Story Refinement", "Technical Spike", "Dependency"],
        "is_default": True,
    },
    {
        "name": "Project Review",
        "description": "Review project progress with stakeholders",
        "template_type": "review",
        "icon": "📊",
        "color": "#607D8B",
        "default_folder": "Reviews",
        "default_tags": "review,project",
        "summary_sections": ["Progress Update", "Milestones", "Risks & Issues", "Decisions"],
        "action_item_categories": ["Decision", "Escalation", "Follow-up"],
        "is_default": True,
    },
]
