"""Models for meeting templates."""
from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    Text,
    Boolean,
    JSON
)
from sqlalchemy.sql import func
from ...database import Base


class MeetingTemplate(Base):
    """Template for creating meetings with predefined settings."""
    __tablename__ = "meeting_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    description = Column(Text, nullable=True)
    template_type = Column(String, nullable=False)  # standup, retrospective, 1on1, brainstorm, planning, review, custom
    
    # Default settings
    default_language = Column(String, default="en-US")
    default_speakers = Column(String, default="auto")
    default_folder = Column(String, nullable=True)
    default_tags = Column(String, nullable=True)
    
    # Expected structure
    expected_speakers = Column(JSON, nullable=True)  # List of expected speaker names
    summary_sections = Column(JSON, nullable=True)  # Custom sections for summary
    action_item_categories = Column(JSON, nullable=True)  # Predefined categories
    
    # AI prompts
    custom_summary_prompt = Column(Text, nullable=True)
    custom_action_item_prompt = Column(Text, nullable=True)
    
    # Metadata
    icon = Column(String, default="📋")
    color = Column(String, default="#1976d2")
    is_default = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    usage_count = Column(Integer, default=0)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
