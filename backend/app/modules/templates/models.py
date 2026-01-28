"""Models for meeting templates."""
from sqlalchemy import JSON, Boolean, Column, DateTime, Index, Integer, String, Text
from sqlalchemy.sql import func

from ...database import Base


class MeetingTemplate(Base):
    """Template for creating meetings with predefined settings."""

    __tablename__ = "meeting_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    description = Column(Text, nullable=True)
    template_type = Column(
        String, nullable=False, index=True
    )  # standup, retrospective, 1on1, brainstorm, planning, review, custom

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
    is_default = Column(Boolean, default=False, index=True)
    is_active = Column(Boolean, default=True, index=True)
    usage_count = Column(Integer, default=0, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_template_type_active", "template_type", "is_active"),
        Index("idx_template_usage", "usage_count", "is_active"),
    )
