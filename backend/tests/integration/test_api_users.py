"""
Integration tests for User Mapping API endpoints.
"""

import pytest
from fastapi import status


@pytest.mark.integration
@pytest.mark.api
class TestUserMappingAPI:
    """Integration tests for user mapping endpoints."""

    def test_list_user_mappings_empty(self, client):
        """Test listing user mappings when none exist."""
        response = client.get("/api/v1/user-mappings/")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0

    def test_create_user_mapping(self, client):
        """Test creating a new user mapping."""
        mapping_data = {"name": "John Doe", "email": "john.doe@example.com"}

        response = client.post("/api/v1/user-mappings/", json=mapping_data)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == mapping_data["name"]
        assert data["email"] == mapping_data["email"]
        assert "id" in data
        assert data["is_active"] == True

    def test_create_duplicate_user_mapping(self, client, db):
        """Test creating a duplicate user mapping returns validation error."""
        # Create first mapping
        from app.modules.users.service import UserMappingService

        service = UserMappingService(db)
        mapping = service.create_or_update_mapping("Jane Smith", "jane@example.com")

        # Create duplicate with different email
        mapping_data = {"name": "Jane Smith", "email": "jane.smith@newdomain.com"}

        response = client.post("/api/v1/user-mappings/", json=mapping_data)

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_list_user_mappings_with_data(self, client, db):
        """Test listing user mappings with data."""
        # Create mappings
        from app.modules.users.service import UserMappingService

        service = UserMappingService(db)
        service.create_or_update_mapping("Alice Johnson", "alice@example.com")
        service.create_or_update_mapping("Bob Williams", "bob@example.com")

        response = client.get("/api/v1/user-mappings/")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 2

    def test_get_user_mapping_by_id(self, client, db):
        """Test listing includes IDs for created mappings."""
        from app.modules.users.service import UserMappingService

        service = UserMappingService(db)
        mapping = service.create_or_update_mapping("Charlie Brown", "charlie@example.com")

        response = client.get("/api/v1/user-mappings/")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert any(item["id"] == mapping.id for item in data)

    def test_get_user_mapping_by_name(self, client, db):
        """Test getting a user mapping by name."""
        # Create mapping
        from app.modules.users.service import UserMappingService

        service = UserMappingService(db)
        service.create_or_update_mapping("Diana Prince", "diana@example.com")

        response = client.get("/api/v1/user-mappings/by-name/Diana Prince")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == "Diana Prince"
        assert data["email"] == "diana@example.com"

    def test_get_user_mapping_by_name_not_found(self, client):
        """Test getting a user mapping by name that doesn't exist."""
        response = client.get("/api/v1/user-mappings/by-name/NonExistent User")

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_update_user_mapping(self, client, db):
        """Test updating a user mapping."""
        # Create mapping
        from app.modules.users.service import UserMappingService

        service = UserMappingService(db)
        mapping = service.create_or_update_mapping("Eve Adams", "eve@example.com")

        update_data = {"email": "eve.adams@newdomain.com"}

        response = client.put(f"/api/v1/user-mappings/{mapping.id}", json=update_data)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["email"] == "eve.adams@newdomain.com"
        assert data["name"] == "Eve Adams"  # Unchanged

    def test_delete_user_mapping(self, client, db):
        """Test deleting (deactivating) a user mapping."""
        # Create mapping
        from app.modules.users.service import UserMappingService

        service = UserMappingService(db)
        mapping = service.create_or_update_mapping("Frank Miller", "frank@example.com")

        response = client.delete(f"/api/v1/user-mappings/{mapping.id}")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["message"] == "Mapping deleted successfully"

        # Verify it's not in active listings
        list_response = client.get("/api/v1/user-mappings/?is_active=true")
        active_names = [m["name"] for m in list_response.json()]
        assert "Frank Miller" not in active_names

    def test_search_user_mappings(self, client, db):
        """Test suggesting unmapped action item owners."""
        # Create mappings
        from app.modules.users.service import UserMappingService

        service = UserMappingService(db)
        service.create_or_update_mapping("Grace Hopper", "grace@example.com")

        response = client.get("/api/v1/user-mappings/suggest")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "unmapped_names" in data
        assert "total" in data

    def test_get_email_for_name(self, client, db):
        """Test getting a user mapping by email."""
        # Create mapping
        from app.modules.users.service import UserMappingService

        service = UserMappingService(db)
        service.create_or_update_mapping("Henry Ford", "henry@example.com")

        response = client.get("/api/v1/user-mappings/by-email/henry@example.com")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["email"] == "henry@example.com"

    def test_get_email_for_unknown_name(self, client):
        """Test getting a user mapping by unknown email returns 404."""
        response = client.get("/api/v1/user-mappings/by-email/unknown@example.com")

        assert response.status_code == status.HTTP_404_NOT_FOUND
