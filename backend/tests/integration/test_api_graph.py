"""
Integration tests for Graph API endpoints.
"""

import pytest
from fastapi import status


@pytest.mark.integration
@pytest.mark.api
class TestGraphAPI:
    """Integration tests for /api/v1/graph endpoints."""

    def test_get_graph_data_empty(self, client):
        response = client.get("/api/v1/graph/data")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "nodes" in data
        assert "edges" in data
        assert "stats" in data

    def test_get_graph_data_with_meeting(self, client, sample_meeting):
        response = client.get("/api/v1/graph/data")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["stats"]["meetings"] >= 1
        # Should have meeting node
        meeting_nodes = [n for n in data["nodes"] if n["type"] == "meeting"]
        assert len(meeting_nodes) >= 1
        # Should have folder node
        folder_nodes = [n for n in data["nodes"] if n["type"] == "folder"]
        assert len(folder_nodes) >= 1
        # Should have tag nodes
        tag_nodes = [n for n in data["nodes"] if n["type"] == "tag"]
        assert len(tag_nodes) >= 1

    def test_create_meeting_link(self, client, db_session):
        """Create two meetings and link them."""
        from datetime import date

        from app.models import Meeting

        m1 = Meeting(
            filename="meeting_a.wav",
            filepath="/tmp/a.wav",
            audio_filepath="/tmp/a.wav",
            status="completed",
            meeting_date=date(2024, 1, 1),
        )
        m2 = Meeting(
            filename="meeting_b.wav",
            filepath="/tmp/b.wav",
            audio_filepath="/tmp/b.wav",
            status="completed",
            meeting_date=date(2024, 1, 2),
        )
        db_session.add_all([m1, m2])
        db_session.commit()
        db_session.refresh(m1)
        db_session.refresh(m2)

        response = client.post(f"/api/v1/graph/meetings/{m1.id}/links/{m2.id}")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "link_id" in data
        assert data["source_meeting_id"] == m1.id
        assert data["target_meeting_id"] == m2.id

    def test_create_meeting_link_not_found(self, client):
        response = client.post("/api/v1/graph/meetings/99999/links/99998")
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_create_meeting_link_duplicate(self, client, db_session):
        """Creating the same link twice returns success (idempotent)."""
        from datetime import date

        from app.models import Meeting

        m1 = Meeting(
            filename="dup_a.wav",
            filepath="/tmp/da.wav",
            audio_filepath="/tmp/da.wav",
            status="completed",
            meeting_date=date(2024, 3, 1),
        )
        m2 = Meeting(
            filename="dup_b.wav",
            filepath="/tmp/db.wav",
            audio_filepath="/tmp/db.wav",
            status="completed",
            meeting_date=date(2024, 3, 2),
        )
        db_session.add_all([m1, m2])
        db_session.commit()
        db_session.refresh(m1)
        db_session.refresh(m2)

        client.post(f"/api/v1/graph/meetings/{m1.id}/links/{m2.id}")
        response = client.post(f"/api/v1/graph/meetings/{m1.id}/links/{m2.id}")
        assert response.status_code == status.HTTP_200_OK
        assert "already exists" in response.json().get("message", "").lower()

    def test_delete_meeting_link(self, client, db_session):
        from datetime import date

        from app.models import Meeting

        m1 = Meeting(
            filename="del_a.wav",
            filepath="/tmp/dela.wav",
            audio_filepath="/tmp/dela.wav",
            status="completed",
            meeting_date=date(2024, 4, 1),
        )
        m2 = Meeting(
            filename="del_b.wav",
            filepath="/tmp/delb.wav",
            audio_filepath="/tmp/delb.wav",
            status="completed",
            meeting_date=date(2024, 4, 2),
        )
        db_session.add_all([m1, m2])
        db_session.commit()
        db_session.refresh(m1)
        db_session.refresh(m2)

        # Create then delete
        client.post(f"/api/v1/graph/meetings/{m1.id}/links/{m2.id}")
        response = client.delete(f"/api/v1/graph/meetings/{m1.id}/links/{m2.id}")
        assert response.status_code == status.HTTP_200_OK

    def test_delete_meeting_link_not_found(self, client):
        response = client.delete("/api/v1/graph/meetings/99999/links/99998")
        assert response.status_code == status.HTTP_404_NOT_FOUND
