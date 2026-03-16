"""
Integration tests for Backup API endpoints.
"""

import json

import pytest
from fastapi import status


@pytest.mark.integration
@pytest.mark.api
class TestBackupAPI:
    """Tests for /api/v1/backup endpoints."""

    def test_export_backup_json(self, client, sample_meeting):
        response = client.get("/api/v1/backup/export", params={"include_audio": False})

        assert response.status_code == status.HTTP_200_OK
        assert "application/json" in response.headers.get("content-type", "")

        data = response.json()
        assert "export_metadata" in data
        assert "meetings" in data
        assert any(m["id"] == sample_meeting.id for m in data["meetings"])

    def test_export_backup_zip(self, client, sample_meeting):
        response = client.get("/api/v1/backup/export", params={"include_audio": True})

        assert response.status_code == status.HTTP_200_OK
        assert "application/zip" in response.headers.get("content-type", "")
        assert response.content[:2] == b"PK"

    def test_import_backup_json_minimal(self, client):
        payload = {
            "export_metadata": {
                "version": "1.1",
                "exported_at": "2026-03-16T00:00:00",
                "counts": {},
            },
            "meetings": [],
        }

        response = client.post(
            "/api/v1/backup/import",
            files={"file": ("backup.json", json.dumps(payload), "application/json")},
            data={"merge_mode": "false"},
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert "statistics" in data
