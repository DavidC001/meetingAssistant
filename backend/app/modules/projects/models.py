"""SQLAlchemy models for projects feature."""

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class Project(Base):
    """Project model - Enhanced folder with project management capabilities."""

    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String, nullable=False, default="active", index=True)
    color = Column(String(7), nullable=True)
    icon = Column(String(50), nullable=True)
    start_date = Column(DateTime(timezone=True), nullable=True)
    target_end_date = Column(DateTime(timezone=True), nullable=True)
    actual_end_date = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    settings = Column(JSONB, nullable=False, default={}, server_default="{}")
    tags = Column(JSONB, nullable=False, default=list, server_default="[]")

    # Relationships
    project_meetings = relationship("ProjectMeeting", back_populates="project", cascade="all, delete-orphan")
    milestones = relationship("ProjectMilestone", back_populates="project", cascade="all, delete-orphan")
    members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")
    chat_sessions = relationship("ProjectChatSession", back_populates="project", cascade="all, delete-orphan")
    notes = relationship("ProjectNote", back_populates="project", cascade="all, delete-orphan")
    note_attachments = relationship("ProjectNoteAttachment", back_populates="project", cascade="all, delete-orphan")
    document_chunks = relationship("ProjectDocumentChunk", back_populates="project", cascade="all, delete-orphan")
    project_action_items = relationship("ProjectActionItem", back_populates="project", cascade="all, delete-orphan")

    @property
    def meetings(self):
        return [pm.meeting for pm in self.project_meetings]


class ProjectMeeting(Base):
    """Junction table linking projects to meetings."""

    __tablename__ = "project_meetings"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (UniqueConstraint("project_id", "meeting_id", name="uq_project_meeting"),)

    project = relationship("Project", back_populates="project_meetings")
    meeting = relationship("Meeting")


class ProjectActionItem(Base):
    """Junction table linking projects to action items."""

    __tablename__ = "project_action_items"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    action_item_id = Column(Integer, ForeignKey("action_items.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (UniqueConstraint("project_id", "action_item_id", name="uq_project_action_item"),)

    project = relationship("Project", back_populates="project_action_items")
    action_item = relationship("ActionItem")


class ProjectMilestone(Base):
    """Project milestone model."""

    __tablename__ = "project_milestones"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    due_date = Column(DateTime(timezone=True), nullable=True, index=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String, nullable=False, default="pending")
    color = Column(String(7), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    project = relationship("Project", back_populates="milestones")


class ProjectMember(Base):
    """Project member model - Team members involved in the project."""

    __tablename__ = "project_members"
    __table_args__ = (UniqueConstraint("project_id", "name", name="uq_project_member_name"),)

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    user_mapping_id = Column(Integer, ForeignKey("user_mappings.id", ondelete="SET NULL"), nullable=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=True)
    role = Column(String, nullable=False, default="member")
    added_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    is_auto_detected = Column(Boolean, nullable=False, default=True, server_default="true")

    # Relationships
    project = relationship("Project", back_populates="members")


class ProjectChatSession(Base):
    """Chat session for project-scoped AI conversations."""

    __tablename__ = "project_chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False, default="New chat", server_default="New chat")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    project = relationship("Project", back_populates="chat_sessions")
    messages = relationship("ProjectChatMessage", back_populates="session", cascade="all, delete-orphan")


class ProjectChatMessage(Base):
    """Chat message in a project chat session."""

    __tablename__ = "project_chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("project_chat_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    sources = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    session = relationship("ProjectChatSession", back_populates="messages")


class ProjectNote(Base):
    """Project notes and documentation."""

    __tablename__ = "project_notes"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=True)
    pinned = Column(Boolean, nullable=False, default=False, server_default="false")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    project = relationship("Project", back_populates="notes")
    attachments = relationship("ProjectNoteAttachment", back_populates="note", cascade="all, delete-orphan")
    document_chunks = relationship("ProjectDocumentChunk", back_populates="note", cascade="all, delete-orphan")


class ProjectNoteAttachment(Base):
    """Attachment uploaded for a project note."""

    __tablename__ = "project_note_attachments"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    note_id = Column(Integer, ForeignKey("project_notes.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String, nullable=False)
    filepath = Column(String, nullable=False)
    file_size = Column(Integer, nullable=True)
    mime_type = Column(String, nullable=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    description = Column(Text, nullable=True)

    project = relationship("Project", back_populates="note_attachments")
    note = relationship("ProjectNote", back_populates="attachments")
    document_chunks = relationship("ProjectDocumentChunk", back_populates="attachment", cascade="all, delete-orphan")


class ProjectDocumentChunk(Base):
    """Vector chunks for project notes and note attachments."""

    __tablename__ = "project_document_chunks"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    note_id = Column(Integer, ForeignKey("project_notes.id", ondelete="CASCADE"), nullable=True, index=True)
    attachment_id = Column(
        Integer, ForeignKey("project_note_attachments.id", ondelete="CASCADE"), nullable=True, index=True
    )
    content = Column(Text, nullable=False)
    content_type = Column(String, nullable=False)
    chunk_index = Column(Integer, nullable=False)
    chunk_metadata = Column(JSONB, nullable=True)
    embedding = Column(Vector(), nullable=False)
    embedding_config_id = Column(Integer, ForeignKey("embedding_configurations.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    project = relationship("Project", back_populates="document_chunks")
    note = relationship("ProjectNote", back_populates="document_chunks")
    attachment = relationship("ProjectNoteAttachment", back_populates="document_chunks")
