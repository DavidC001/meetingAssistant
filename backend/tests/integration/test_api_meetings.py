"""
Integration tests for Meeting API endpoints.
"""

import pytest
from fastapi import status


@pytest.mark.integration
@pytest.mark.api
class TestMeetingsAPI:
    """Integration tests for /api/v1/meetings endpoints."""

    def test_get_meetings_empty(self, client):
        """Test getting meetings when database is empty."""
        response = client.get("/api/v1/meetings")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0

    def test_get_meetings_with_data(self, client, sample_meeting):
        """Test getting meetings when data exists."""
        response = client.get("/api/v1/meetings")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["id"] == sample_meeting.id
        assert data[0]["title"] == sample_meeting.title

    def test_get_meeting_by_id(self, client, sample_meeting):
        """Test getting a specific meeting by ID."""
        response = client.get(f"/api/v1/meetings/{sample_meeting.id}")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == sample_meeting.id
        assert data["title"] == sample_meeting.title
        assert data["status"] == sample_meeting.status

    def test_get_meeting_not_found(self, client):
        """Test getting a meeting that doesn't exist."""
        response = client.get("/api/v1/meetings/99999")

        assert response.status_code == status.HTTP_404_NOT_FOUND
        data = response.json()
        assert "error" in data
        assert data["error"]["code"] == "MeetingNotFoundError"

    def test_delete_meeting(self, client, sample_meeting):
        """Test deleting a meeting."""
        meeting_id = sample_meeting.id

        response = client.delete(f"/api/v1/meetings/{meeting_id}")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["message"] == "Meeting deleted successfully"

        # Verify meeting is deleted
        get_response = client.get(f"/api/v1/meetings/{meeting_id}")
        assert get_response.status_code == status.HTTP_404_NOT_FOUND

    def test_update_meeting(self, client, sample_meeting):
        """Test updating a meeting."""
        update_data = {"title": "Updated Title", "description": "Updated description"}

        response = client.patch(f"/api/v1/meetings/{sample_meeting.id}", json=update_data)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["title"] == "Updated Title"
        assert data["description"] == "Updated description"
        assert data["status"] == sample_meeting.status  # Unchanged

    def test_get_meeting_action_items(self, client, sample_meeting, sample_action_item):
        """Test getting action items for a meeting."""
        response = client.get(f"/api/v1/meetings/{sample_meeting.id}/action-items")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["id"] == sample_action_item.id
        assert data[0]["meeting_id"] == sample_meeting.id

    def test_search_meetings(self, client, sample_meeting):
        """Test searching meetings."""
        response = client.get("/api/v1/meetings/search", params={"query": "Test"})

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        # Should find the meeting with "Test" in title
        assert any(m["id"] == sample_meeting.id for m in data)

    def test_filter_meetings_by_status(self, client, sample_meeting):
        """Test filtering meetings by status."""
        response = client.get("/api/v1/meetings", params={"status": "completed"})

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        # All returned meetings should have status "completed"
        assert all(m["status"] == "completed" for m in data)

    def test_filter_meetings_by_date_range(self, client, sample_meeting):
        """Test filtering meetings by date range."""
        response = client.get("/api/v1/meetings", params={"start_date": "2024-01-01", "end_date": "2024-01-31"})

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1


@pytest.mark.integration
@pytest.mark.api
class TestActionItemsAPI:
    """Integration tests for action items endpoints."""

    def test_create_action_item(self, client, sample_meeting):
        """Test creating an action item."""
        action_item_data = {
            "meeting_id": sample_meeting.id,
            "description": "New action item",
            "assignee": "John Doe",
            "priority": "medium",
            "status": "pending",
        }

        response = client.post("/api/v1/action-items", json=action_item_data)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["description"] == "New action item"
        assert data["assignee"] == "John Doe"
        assert "id" in data

    def test_update_action_item_status(self, client, sample_action_item):
        """Test updating action item status."""
        response = client.patch(f"/api/v1/action-items/{sample_action_item.id}", json={"status": "completed"})

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "completed"

    def test_get_user_action_items(self, client, sample_action_item):
        """Test getting action items for a specific user."""
        response = client.get("/api/v1/action-items", params={"assignee": "Test User"})

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert all(item["assignee"] == "Test User" for item in data)


@pytest.mark.integration
@pytest.mark.api
class TestHealthEndpoints:
    """Integration tests for health check endpoints."""

    def test_health_check(self, client):
        """Test health check endpoint."""
        response = client.get("/health")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "healthy"

    def test_api_version(self, client):
        """Test API version endpoint."""
        response = client.get("/api/v1/version")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "version" in data
