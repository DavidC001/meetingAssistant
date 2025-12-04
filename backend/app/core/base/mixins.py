"""
SQLAlchemy model mixins for common patterns.

These mixins can be applied to SQLAlchemy models to add common functionality
like timestamps, soft deletion, auditing, and metadata storage.

Usage:
    from app.core.base import TimestampMixin, SoftDeleteMixin
    
    class Meeting(Base, TimestampMixin, SoftDeleteMixin):
        __tablename__ = "meetings"
        id = Column(Integer, primary_key=True)
        title = Column(String)
"""

from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy import Column, DateTime, Boolean, String, Text, func
from sqlalchemy.ext.declarative import declared_attr
from sqlalchemy.dialects.postgresql import JSONB


class TimestampMixin:
    """
    Adds created_at and updated_at timestamp columns.
    
    Automatically sets:
    - created_at on record creation
    - updated_at on every update
    """
    
    @declared_attr
    def created_at(cls):
        return Column(
            DateTime,
            default=datetime.utcnow,
            server_default=func.now(),
            nullable=False,
            index=True
        )
    
    @declared_attr
    def updated_at(cls):
        return Column(
            DateTime,
            default=datetime.utcnow,
            onupdate=datetime.utcnow,
            server_default=func.now(),
            nullable=False
        )


class SoftDeleteMixin:
    """
    Adds soft deletion support with deleted_at timestamp.
    
    Instead of deleting records, marks them as deleted with a timestamp.
    Provides helper methods for filtering and restoring.
    """
    
    @declared_attr
    def deleted_at(cls):
        return Column(DateTime, nullable=True, index=True)
    
    @declared_attr
    def is_deleted(cls):
        return Column(Boolean, default=False, nullable=False, index=True)
    
    def soft_delete(self) -> None:
        """Mark this record as deleted."""
        self.is_deleted = True
        self.deleted_at = datetime.utcnow()
    
    def restore(self) -> None:
        """Restore a soft-deleted record."""
        self.is_deleted = False
        self.deleted_at = None


class AuditMixin:
    """
    Adds audit trail columns for tracking who created/modified records.
    
    Adds:
    - created_by: User who created the record
    - updated_by: User who last updated the record
    """
    
    @declared_attr
    def created_by(cls):
        return Column(String(255), nullable=True)
    
    @declared_attr
    def updated_by(cls):
        return Column(String(255), nullable=True)


class MetadataMixin:
    """
    Adds a JSONB metadata column for flexible additional data.
    
    Useful for storing optional/dynamic fields without schema changes.
    """
    
    @declared_attr
    def metadata_json(cls):
        return Column(JSONB, default=dict, nullable=False)
    
    def get_metadata(self, key: str, default: Any = None) -> Any:
        """Get a value from metadata."""
        if self.metadata_json is None:
            return default
        return self.metadata_json.get(key, default)
    
    def set_metadata(self, key: str, value: Any) -> None:
        """Set a value in metadata."""
        if self.metadata_json is None:
            self.metadata_json = {}
        self.metadata_json[key] = value
    
    def update_metadata(self, data: Dict[str, Any]) -> None:
        """Update multiple metadata values at once."""
        if self.metadata_json is None:
            self.metadata_json = {}
        self.metadata_json.update(data)


class TaggableMixin:
    """
    Adds tagging support with a JSONB tags column.
    
    Stores tags as a list for easy querying and filtering.
    """
    
    @declared_attr
    def tags(cls):
        return Column(JSONB, default=list, nullable=False)
    
    def add_tag(self, tag: str) -> None:
        """Add a tag if not already present."""
        if self.tags is None:
            self.tags = []
        if tag not in self.tags:
            self.tags.append(tag)
    
    def remove_tag(self, tag: str) -> None:
        """Remove a tag if present."""
        if self.tags and tag in self.tags:
            self.tags.remove(tag)
    
    def has_tag(self, tag: str) -> bool:
        """Check if record has a specific tag."""
        return self.tags is not None and tag in self.tags
    
    def clear_tags(self) -> None:
        """Remove all tags."""
        self.tags = []


class StatusMixin:
    """
    Adds status tracking for records with workflow states.
    
    Common use cases: processing status, approval workflow, etc.
    """
    
    @declared_attr
    def status(cls):
        return Column(String(50), default="pending", nullable=False, index=True)
    
    @declared_attr
    def status_changed_at(cls):
        return Column(DateTime, nullable=True)
    
    @declared_attr
    def status_message(cls):
        return Column(Text, nullable=True)
    
    def set_status(self, status: str, message: Optional[str] = None) -> None:
        """Update the status with optional message."""
        self.status = status
        self.status_changed_at = datetime.utcnow()
        if message:
            self.status_message = message


class SlugMixin:
    """
    Adds a unique slug column for URL-friendly identifiers.
    """
    
    @declared_attr
    def slug(cls):
        return Column(String(255), unique=True, nullable=True, index=True)
    
    @staticmethod
    def generate_slug(text: str) -> str:
        """Generate a URL-friendly slug from text."""
        import re
        # Convert to lowercase and replace spaces with hyphens
        slug = text.lower().strip()
        slug = re.sub(r'[^\w\s-]', '', slug)
        slug = re.sub(r'[\s_-]+', '-', slug)
        slug = slug.strip('-')
        return slug[:255]  # Limit length
