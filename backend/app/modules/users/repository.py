"""
Repository classes for the users module.

Provides domain-specific repositories that extend BaseRepository
with user-specific operations.

Usage:
    from app.modules.users.repository import UserMappingRepository

    user_repo = UserMappingRepository(db)
    mapping = user_repo.get_by_name("John Doe")
"""

from typing import Any

from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from app.core.base import BaseRepository, NotFoundError

from . import models, schemas

# =============================================================================
# Custom Exceptions
# =============================================================================


class UserMappingNotFoundError(NotFoundError):
    """Raised when a user mapping is not found."""

    def __init__(self, identifier: Any):
        super().__init__("UserMapping", identifier)


# =============================================================================
# User Mapping Repository
# =============================================================================


class UserMappingRepository(BaseRepository[models.UserMapping, schemas.UserMappingCreate, schemas.UserMappingUpdate]):
    """Repository for user mappings."""

    def __init__(self, db: Session):
        """Initialize the repository with a database session."""
        super().__init__(models.UserMapping, db)

    def get_all_active(self, skip: int = 0, limit: int = 100) -> list[models.UserMapping]:
        """
        Get all active user mappings.

        Args:
            skip: Number of mappings to skip for pagination
            limit: Maximum number of mappings to return

        Returns:
            List of active user mappings
        """
        return self.db.query(self.model).filter(self.model.is_active == True).offset(skip).limit(limit).all()

    def get_by_name(self, name: str) -> models.UserMapping | None:
        """
        Get a user mapping by name (case-insensitive).

        Args:
            name: Name to search for

        Returns:
            User mapping if found, None otherwise
        """
        return self.db.query(self.model).filter(self.model.name.ilike(name), self.model.is_active == True).first()

    def get_by_email(self, email: str) -> models.UserMapping | None:
        """
        Get a user mapping by email (case-insensitive).

        Args:
            email: Email to search for

        Returns:
            User mapping if found, None otherwise
        """
        return self.db.query(self.model).filter(self.model.email.ilike(email), self.model.is_active == True).first()

    def get_email_for_name(self, name: str) -> str:
        """
        Get email for a given name.

        If no mapping exists, returns the name unchanged.

        Args:
            name: Name to look up

        Returns:
            Email address if mapping exists, otherwise the original name
        """
        if not name:
            return name

        mapping = self.get_by_name(name)
        return mapping.email if mapping else name

    def create_or_update(self, name: str, email: str) -> models.UserMapping:
        """
        Create a new user mapping or update existing one.

        If a mapping with the same name already exists, updates its email.

        Args:
            name: User's name
            email: User's email address

        Returns:
            Created or updated user mapping
        """
        existing = self.get_by_name(name)

        if existing:
            # Update existing mapping
            existing.email = email
            existing.updated_at = func.now()
            self.db.commit()
            self.db.refresh(existing)
            return existing

        # Create new mapping
        mapping = self.model(name=name, email=email, is_active=True)
        self.db.add(mapping)
        self.db.commit()
        self.db.refresh(mapping)
        return mapping

    def deactivate(self, mapping_id: int) -> bool:
        """
        Deactivate a user mapping (soft delete).

        Args:
            mapping_id: ID of the mapping to deactivate

        Returns:
            True if deactivated, False if not found
        """
        mapping = self.get_by_id(mapping_id)
        if not mapping:
            return False

        mapping.is_active = False
        mapping.updated_at = func.now()
        self.db.commit()
        return True

    def reactivate(self, mapping_id: int) -> bool:
        """
        Reactivate a previously deactivated user mapping.

        Args:
            mapping_id: ID of the mapping to reactivate

        Returns:
            True if reactivated, False if not found
        """
        mapping = self.db.query(self.model).filter(self.model.id == mapping_id).first()

        if not mapping:
            return False

        mapping.is_active = True
        mapping.updated_at = func.now()
        self.db.commit()
        return True

    def search_by_name_pattern(self, pattern: str, skip: int = 0, limit: int = 100) -> list[models.UserMapping]:
        """
        Search for user mappings by name pattern.

        Args:
            pattern: Pattern to search for (case-insensitive, supports wildcards)
            skip: Number of results to skip for pagination
            limit: Maximum number of results to return

        Returns:
            List of matching user mappings
        """
        search_pattern = f"%{pattern}%"
        return (
            self.db.query(self.model)
            .filter(self.model.name.ilike(search_pattern), self.model.is_active == True)
            .offset(skip)
            .limit(limit)
            .all()
        )

    def count_active(self) -> int:
        """
        Count total active user mappings.

        Returns:
            Total count of active mappings
        """
        return self.db.query(func.count(self.model.id)).filter(self.model.is_active == True).scalar()
