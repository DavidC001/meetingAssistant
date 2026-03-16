"""
Integration tests for Admin API endpoints.
"""

import pytest
from fastapi import status


@pytest.mark.integration
@pytest.mark.api
class TestAdminCacheAPI:
    """Tests for /api/v1/admin/cache endpoints."""

    def test_get_cache_info(self, client):
        response = client.get("/api/v1/admin/cache/info")
        assert response.status_code == status.HTTP_200_OK
        # Should return cache info dict
        assert isinstance(response.json(), dict)

    def test_clear_cache(self, client):
        response = client.delete("/api/v1/admin/cache/clear")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "message" in data


@pytest.mark.integration
@pytest.mark.api
class TestAdminCheckpointAPI:
    """Tests for /api/v1/admin/checkpoints endpoints."""

    def test_checkpoints_not_found(self, client):
        response = client.get("/api/v1/admin/checkpoints/99999")
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_checkpoints_with_meeting(self, client, sample_meeting):
        response = client.get(f"/api/v1/admin/checkpoints/{sample_meeting.id}")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["meeting_id"] == sample_meeting.id
