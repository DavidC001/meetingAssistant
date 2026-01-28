"""
Service layer for the users module.

Provides business logic for user management operations.

Usage:
    from app.modules.users.service import UserMappingService

    user_service = UserMappingService(db)
    mapping = user_service.create_or_update_mapping("John Doe", "john@example.com")
"""


from sqlalchemy.orm import Session

from . import models, schemas
from .repository import UserMappingRepository


class UserMappingService:
    """Service for managing user mappings."""

    def __init__(self, db: Session):
        """
        Initialize the user mapping service.

        Args:
            db: Database session
        """
        self.db = db
        self.repo = UserMappingRepository(db)

    def get_all_mappings(self, skip: int = 0, limit: int = 100) -> list[models.UserMapping]:
        """
        Get all active user mappings.

        Args:
            skip: Number of mappings to skip for pagination
            limit: Maximum number of mappings to return

        Returns:
            List of active user mappings
        """
        return self.repo.get_all_active(skip=skip, limit=limit)

    def get_mapping_by_id(self, mapping_id: int) -> models.UserMapping | None:
        """
        Get a user mapping by ID.

        Args:
            mapping_id: ID of the mapping

        Returns:
            User mapping if found, None otherwise
        """
        return self.repo.get_by_id(mapping_id)

    def get_mapping_by_name(self, name: str) -> models.UserMapping | None:
        """
        Get a user mapping by name.

        Args:
            name: Name to search for (case-insensitive)

        Returns:
            User mapping if found, None otherwise
        """
        return self.repo.get_by_name(name)

    def get_mapping_by_email(self, email: str) -> models.UserMapping | None:
        """
        Get a user mapping by email.

        Args:
            email: Email to search for (case-insensitive)

        Returns:
            User mapping if found, None otherwise
        """
        return self.repo.get_by_email(email)

    def get_email_for_name(self, name: str) -> str:
        """
        Get email for a given name.

        If no mapping exists, returns the name unchanged. This is useful
        for ensuring backward compatibility with existing data.

        Args:
            name: Name to look up

        Returns:
            Email address if mapping exists, otherwise the original name
        """
        return self.repo.get_email_for_name(name)

    def create_or_update_mapping(self, name: str, email: str) -> models.UserMapping:
        """
        Create a new user mapping or update existing one.

        If a mapping with the same name already exists, updates its email.
        This ensures idempotent behavior for bulk imports.

        Args:
            name: User's name
            email: User's email address

        Returns:
            Created or updated user mapping
        """
        return self.repo.create_or_update(name, email)

    def update_mapping(self, mapping_id: int, update_data: schemas.UserMappingUpdate) -> models.UserMapping | None:
        """
        Update a user mapping.

        Args:
            mapping_id: ID of the mapping to update
            update_data: Update data

        Returns:
            Updated user mapping if found, None otherwise
        """
        mapping = self.repo.get_by_id(mapping_id)
        if not mapping:
            return None

        return self.repo.update(mapping_id, update_data)

    def delete_mapping(self, mapping_id: int) -> bool:
        """
        Delete (deactivate) a user mapping.

        This performs a soft delete by setting is_active to False.

        Args:
            mapping_id: ID of the mapping to delete

        Returns:
            True if deleted, False if not found
        """
        return self.repo.deactivate(mapping_id)

    def reactivate_mapping(self, mapping_id: int) -> bool:
        """
        Reactivate a previously deactivated user mapping.

        Args:
            mapping_id: ID of the mapping to reactivate

        Returns:
            True if reactivated, False if not found
        """
        return self.repo.reactivate(mapping_id)

    def search_mappings(self, pattern: str, skip: int = 0, limit: int = 100) -> list[models.UserMapping]:
        """
        Search for user mappings by name pattern.

        Args:
            pattern: Pattern to search for (case-insensitive)
            skip: Number of results to skip for pagination
            limit: Maximum number of results to return

        Returns:
            List of matching user mappings
        """
        return self.repo.search_by_name_pattern(pattern=pattern, skip=skip, limit=limit)

    def get_total_count(self) -> int:
        """
        Get total count of active user mappings.

        Returns:
            Total count of active mappings
        """
        return self.repo.count_active()

    def bulk_create_or_update(self, mappings: list[schemas.UserMappingCreate]) -> list[models.UserMapping]:
        """
        Bulk create or update user mappings.

        This is useful for importing user data from external sources
        or synchronizing with identity providers.

        Args:
            mappings: List of user mapping data to create/update

        Returns:
            List of created or updated user mappings
        """
        results = []
        for mapping_data in mappings:
            mapping = self.create_or_update_mapping(name=mapping_data.name, email=mapping_data.email)
            results.append(mapping)

        return results
