"""
Integration tests for Admin API endpoints.
"""

import sys

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


@pytest.mark.integration
@pytest.mark.api
class TestAdminSystemStatusAPI:
    """Tests for /api/v1/admin/system endpoints.

    torch is only installed in the "heavy" Docker image target (the worker
    service - see backend/Dockerfile); on the "light" target (backend,
    worker-light) it's absent. These endpoints must degrade gracefully
    rather than 500 when that's the case, so we simulate torch's absence by
    marking it unimportable in sys.modules (the standard way to make
    `import torch` raise ImportError regardless of whether it was already
    imported elsewhere in the process).
    """

    def test_system_status_reports_gpu_when_torch_available(self, client):
        response = client.get("/api/v1/admin/system/status")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "torch_available" in data
        assert "gpu_available" in data
        assert "cache_info" in data

    def test_system_status_degrades_when_torch_missing(self, client, monkeypatch):
        monkeypatch.setitem(sys.modules, "torch", None)

        response = client.get("/api/v1/admin/system/status")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["torch_available"] is False
        assert data["gpu_available"] is False
        assert "gpu_info" not in data

    def test_gpu_clear_cache_returns_400_when_torch_missing(self, client, monkeypatch):
        monkeypatch.setitem(sys.modules, "torch", None)

        response = client.post("/api/v1/admin/system/gpu/clear-cache")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
