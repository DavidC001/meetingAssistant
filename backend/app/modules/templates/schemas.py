"""Schemas for meeting templates."""
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


class MeetingTemplateBase(BaseModel):
    name: str
    description: Optional[str] = None
    template_type: str  # standup, retrospective, 1on1, brainstorm, planning, review, custom
    
    # Default settings
    default_language: Optional[str] = "en-US"
    default_speakers: Optional[str] = "auto"
    default_folder: Optional[str] = None
    default_tags: Optional[str] = None
    
    # Expected structure
    expected_speakers: Optional[List[str]] = None
    summary_sections: Optional[List[str]] = None
    action_item_categories: Optional[List[str]] = None
    
    # AI prompts
    custom_summary_prompt: Optional[str] = None
    custom_action_item_prompt: Optional[str] = None
    
    # Metadata
    icon: Optional[str] = "📋"
    color: Optional[str] = "#1976d2"


class MeetingTemplateCreate(MeetingTemplateBase):
    pass


class MeetingTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    template_type: Optional[str] = None
    default_language: Optional[str] = None
    default_speakers: Optional[str] = None
    default_folder: Optional[str] = None
    default_tags: Optional[str] = None
    expected_speakers: Optional[List[str]] = None
    summary_sections: Optional[List[str]] = None
    action_item_categories: Optional[List[str]] = None
    custom_summary_prompt: Optional[str] = None
    custom_action_item_prompt: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None


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
        "is_default": True
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
        "is_default": True
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
        "is_default": True
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
        "is_default": True
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
        "is_default": True
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
        "is_default": True
    }
]
