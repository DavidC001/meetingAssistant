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
        entry_data = {"date": str(date.today()), "content": "Test diary entry for today"}

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

        from app.modules.diary.schemas import DiaryEntryCreate

        service.create_entry(DiaryEntryCreate(date=today, content="Entry 1"))
        service.create_entry(DiaryEntryCreate(date=today - timedelta(days=1), content="Entry 2"))

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

        from app.modules.diary.schemas import DiaryEntryCreate

        service.create_entry(DiaryEntryCreate(date=today, content="Today's entry"))
        service.create_entry(DiaryEntryCreate(date=today - timedelta(days=7), content="Last week's entry"))
        service.create_entry(DiaryEntryCreate(date=today - timedelta(days=14), content="Two weeks ago entry"))

        # Query with date filter
        start_date = today - timedelta(days=10)
        response = client.get("/api/v1/diary/entries", params={"start_date": str(start_date)})

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["entries"]) == 2  # Only entries within last 10 days

    def test_get_diary_entry_by_date(self, client, db):
        """Test getting a specific diary entry by date."""
        # Create entry
        from app.modules.diary.schemas import DiaryEntryCreate
        from app.modules.diary.service import DiaryService

        service = DiaryService(db)
        entry = service.create_entry(DiaryEntryCreate(date=date.today(), content="Test entry"))

        response = client.get(f"/api/v1/diary/entries/{entry.date}")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == entry.id
        assert data["content"] == "Test entry"

    def test_update_diary_entry(self, client, db):
        """Test updating a diary entry."""
        # Create entry
        from app.modules.diary.schemas import DiaryEntryCreate
        from app.modules.diary.service import DiaryService

        service = DiaryService(db)
        entry = service.create_entry(DiaryEntryCreate(date=date.today(), content="Original content"))

        update_data = {"content": "Updated content"}

        response = client.put(f"/api/v1/diary/entries/{entry.date}", json=update_data)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["content"] == "Updated content"

    def test_delete_diary_entry(self, client, db):
        """Test deleting a diary entry."""
        # Create entry
        from app.modules.diary.schemas import DiaryEntryCreate
        from app.modules.diary.service import DiaryService

        service = DiaryService(db)
        entry = service.create_entry(DiaryEntryCreate(date=date.today(), content="To delete"))

        response = client.delete(f"/api/v1/diary/entries/{entry.date}")

        assert response.status_code == status.HTTP_204_NO_CONTENT

        # Verify it's deleted
        get_response = client.get(f"/api/v1/diary/entries/{entry.date}")
        assert get_response.status_code == status.HTTP_404_NOT_FOUND

    def test_get_diary_reminder(self, client, db, sample_meeting, sample_action_item):
        """Test getting daily reminder."""
        response = client.get("/api/v1/diary/reminder")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "should_show_reminder" in data
        assert "action_items_summary" in data or data["should_show_reminder"] is False

    def test_dismiss_diary_reminder(self, client, db):
        """Test dismissing a diary reminder."""
        # Create entry for today
        from app.modules.diary.schemas import DiaryEntryCreate
        from app.modules.diary.service import DiaryService

        service = DiaryService(db)
        service.create_entry(DiaryEntryCreate(date=date.today(), content="Today's entry"))

        dismiss_data = {"date": str(date.today())}

        response = client.post("/api/v1/diary/reminder/dismiss", json=dismiss_data)

        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_get_diary_statistics(self, client, db):
        """Test getting diary statistics."""
        # Create some entries
        from app.modules.diary.schemas import DiaryEntryCreate
        from app.modules.diary.service import DiaryService

        service = DiaryService(db)
        today = date.today()

        for i in range(5):
            service.create_entry(DiaryEntryCreate(date=today - timedelta(days=i), content=f"Entry {i}"))

        response = client.get("/api/v1/diary/statistics/summary")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "total_entries" in data
        assert "date_range" in data
        assert data["total_entries"] >= 5
