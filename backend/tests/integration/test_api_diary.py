"""
Integration tests for Diary API endpoints.
"""

from datetime import date, timedelta

import pytest
from fastapi import status


@pytest.mark.integration
@pytest.mark.api
class TestDiaryAPI:
    """Integration tests for diary endpoints."""

    def test_list_diary_entries_empty(self, client):
        """Test listing diary entries when none exist."""
        response = client.get("/api/v1/diary/entries")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "entries" in data
        assert isinstance(data["entries"], list)
        assert len(data["entries"]) == 0
        assert data["total"] == 0

    def test_create_diary_entry(self, client):
        """Test creating a new diary entry."""
        entry_data = {"entry_date": str(date.today()), "content": "Test diary entry for today"}

        response = client.post("/api/v1/diary/entries", json=entry_data)

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["content"] == entry_data["content"]
        assert "id" in data

    def test_list_diary_entries_with_data(self, client, db):
        """Test listing diary entries with data."""
        # Create some entries
        from app.modules.diary.service import DiaryService

        service = DiaryService(db)
        today = date.today()

        entry1 = service.create_entry(today, "Entry 1")
        entry2 = service.create_entry(today - timedelta(days=1), "Entry 2")

        response = client.get("/api/v1/diary/entries")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["entries"]) == 2
        assert data["total"] == 2

    def test_list_diary_entries_with_date_filter(self, client, db):
        """Test listing diary entries with date range filter."""
        # Create entries
        from app.modules.diary.service import DiaryService

        service = DiaryService(db)
        today = date.today()

        service.create_entry(today, "Today's entry")
        service.create_entry(today - timedelta(days=7), "Last week's entry")
        service.create_entry(today - timedelta(days=14), "Two weeks ago entry")

        # Query with date filter
        start_date = today - timedelta(days=10)
        response = client.get("/api/v1/diary/entries", params={"start_date": str(start_date)})

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["entries"]) == 2  # Only entries within last 10 days

    def test_get_diary_entry_by_id(self, client, db):
        """Test getting a specific diary entry."""
        # Create entry
        from app.modules.diary.service import DiaryService

        service = DiaryService(db)
        entry = service.create_entry(date.today(), "Test entry")

        response = client.get(f"/api/v1/diary/entries/{entry.id}")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == entry.id
        assert data["content"] == "Test entry"

    def test_update_diary_entry(self, client, db):
        """Test updating a diary entry."""
        # Create entry
        from app.modules.diary.service import DiaryService

        service = DiaryService(db)
        entry = service.create_entry(date.today(), "Original content")

        update_data = {"content": "Updated content"}

        response = client.put(f"/api/v1/diary/entries/{entry.id}", json=update_data)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["content"] == "Updated content"

    def test_delete_diary_entry(self, client, db):
        """Test deleting a diary entry."""
        # Create entry
        from app.modules.diary.service import DiaryService

        service = DiaryService(db)
        entry = service.create_entry(date.today(), "To delete")

        response = client.delete(f"/api/v1/diary/entries/{entry.id}")

        assert response.status_code == status.HTTP_200_OK

        # Verify it's deleted
        get_response = client.get(f"/api/v1/diary/entries/{entry.id}")
        assert get_response.status_code == status.HTTP_404_NOT_FOUND

    def test_get_diary_reminder(self, client, db, sample_meeting, sample_action_item):
        """Test getting daily reminder."""
        response = client.get("/api/v1/diary/reminder")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "action_items" in data
        assert "diary_entry" in data
        assert isinstance(data["action_items"], list)

    def test_dismiss_diary_reminder(self, client, db):
        """Test dismissing a diary reminder."""
        # Create entry for today
        from app.modules.diary.service import DiaryService

        service = DiaryService(db)
        entry = service.create_entry(date.today(), "Today's entry")

        dismiss_data = {"dismiss": True}

        response = client.post("/api/v1/diary/reminder/dismiss", json=dismiss_data)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "success"

    def test_get_diary_statistics(self, client, db):
        """Test getting diary statistics."""
        # Create some entries
        from app.modules.diary.service import DiaryService

        service = DiaryService(db)
        today = date.today()

        for i in range(5):
            service.create_entry(today - timedelta(days=i), f"Entry {i}")

        response = client.get("/api/v1/diary/statistics")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "total_entries" in data
        assert "entries_this_month" in data
        assert data["total_entries"] >= 5
