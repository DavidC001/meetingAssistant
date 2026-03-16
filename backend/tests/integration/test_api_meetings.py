"""
Integration tests for Meeting API endpoints.
"""

from types import SimpleNamespace

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
        assert data[0]["filename"] == sample_meeting.filename

    def test_get_meeting_by_id(self, client, sample_meeting):
        """Test getting a specific meeting by ID."""
        response = client.get(f"/api/v1/meetings/{sample_meeting.id}")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == sample_meeting.id
        assert data["filename"] == sample_meeting.filename
        assert data["status"] == sample_meeting.status

    def test_get_meeting_not_found(self, client):
        """Test getting a meeting that doesn't exist."""
        response = client.get("/api/v1/meetings/99999")

        assert response.status_code == status.HTTP_404_NOT_FOUND
        data = response.json()
        assert "detail" in data

    def test_delete_meeting(self, client, sample_meeting):
        """Test deleting a meeting."""
        meeting_id = sample_meeting.id

        response = client.delete(f"/api/v1/meetings/{meeting_id}")

        assert response.status_code == status.HTTP_204_NO_CONTENT

        # Verify meeting is deleted
        get_response = client.get(f"/api/v1/meetings/{meeting_id}")
        assert get_response.status_code == status.HTTP_404_NOT_FOUND

    def test_update_meeting(self, client, sample_meeting):
        """Test updating a meeting."""
        update_data = {"filename": "updated_test_meeting.wav", "notes": "Updated notes"}

        response = client.put(f"/api/v1/meetings/{sample_meeting.id}", json=update_data)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["filename"] == "updated_test_meeting.wav"
        assert data["notes"] == "Updated notes"
        assert data["status"] == sample_meeting.status  # Unchanged

    def test_get_meeting_action_items(self, client, sample_meeting, sample_action_item):
        """Test getting action items with meeting enrichment."""
        response = client.get("/api/v1/meetings/action-items/")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["id"] == sample_action_item.id
        assert data[0]["meeting_id"] == sample_meeting.id

    def test_search_meetings(self, client, sample_meeting):
        """Test quick search endpoint."""
        response = client.get("/api/v1/search/quick", params={"q": "test", "limit": 10})

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, dict)
        assert "results" in data
        assert isinstance(data["results"], list)
        assert len(data["results"]) >= 1

    def test_filter_meetings_by_status(self, client, sample_meeting):
        """Test meetings list endpoint returns entries with status field."""
        response = client.get("/api/v1/meetings")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert all("status" in m for m in data)

    def test_filter_meetings_by_date_range(self, client, sample_meeting):
        """Test that meeting date is returned in meeting details."""
        response = client.get(f"/api/v1/meetings/{sample_meeting.id}")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "meeting_date" in data


@pytest.mark.integration
@pytest.mark.api
class TestActionItemsAPI:
    """Integration tests for action items endpoints."""

    def test_create_action_item(self, client, sample_meeting):
        """Test creating an action item."""
        transcription_id = sample_meeting.transcription.id
        action_item_data = {
            "task": "New action item",
            "owner": "John Doe",
            "priority": "medium",
            "status": "pending",
        }

        response = client.post(
            f"/api/v1/meetings/transcriptions/{transcription_id}/action-items", json=action_item_data
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["task"] == "New action item"
        assert data["owner"] == "John Doe"
        assert "id" in data

    def test_update_action_item_status(self, client, sample_action_item):
        """Test updating action item status."""
        response = client.put(f"/api/v1/meetings/action-items/{sample_action_item.id}", json={"status": "completed"})

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "completed"

    def test_get_user_action_items(self, client, sample_action_item):
        """Test getting all action items."""
        response = client.get("/api/v1/meetings/action-items/")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert any(item["owner"] == "Test User" for item in data)


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
        """Test root endpoint returns version info."""
        response = client.get("/")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "version" in data


@pytest.mark.integration
@pytest.mark.api
class TestMeetingProcessingAPI:
    """Integration tests for restart/retry meeting processing endpoints."""

    def test_restart_processing_dispatches_task(self, client, db_session, sample_meeting, monkeypatch):
        from app import tasks

        class _DummyTask:
            def delay(self, meeting_id: int):
                return SimpleNamespace(id=f"task-{meeting_id}")

        monkeypatch.setattr(tasks, "process_meeting_task", _DummyTask())

        sample_meeting.status = "failed"
        db_session.commit()

        response = client.post(f"/api/v1/meetings/{sample_meeting.id}/restart-processing")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "pending"
        assert data["celery_task_id"] == f"task-{sample_meeting.id}"

    def test_retry_analysis_dispatches_task(self, client, db_session, sample_meeting, monkeypatch):
        from app import tasks

        class _DummyTask:
            def delay(self, meeting_id: int):
                return SimpleNamespace(id=f"task-{meeting_id}")

        monkeypatch.setattr(tasks, "process_meeting_task", _DummyTask())

        sample_meeting.status = "failed"
        db_session.commit()

        response = client.post(f"/api/v1/meetings/{sample_meeting.id}/retry-analysis")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "processing"
        assert data["celery_task_id"] == f"task-{sample_meeting.id}"


@pytest.mark.integration
@pytest.mark.api
class TestMeetingSpeakersAndNotesAPI:
    """Integration tests for speaker and notes endpoints."""

    def test_add_speaker(self, client, sample_meeting):
        response = client.post(
            f"/api/v1/meetings/{sample_meeting.id}/speakers",
            json={"name": "Alice", "label": "SPEAKER_01"},
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == "Alice"
        assert data["label"] == "SPEAKER_01"

    def test_update_notes_endpoint(self, client, sample_meeting, monkeypatch):
        from app import tasks

        class _DummyUpdateNotesEmbeddingsTask:
            def delay(self, meeting_id: int, notes: str):
                return SimpleNamespace(id=f"notes-{meeting_id}")

        monkeypatch.setattr(tasks, "update_notes_embeddings", _DummyUpdateNotesEmbeddingsTask())

        response = client.put(f"/api/v1/meetings/{sample_meeting.id}/notes", json={"notes": "linked to #123"})

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["notes"] == "linked to #123"
