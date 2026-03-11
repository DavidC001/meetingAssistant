"""
Integration tests for Search API endpoints.
"""

import pytest
from fastapi import status


@pytest.mark.integration
@pytest.mark.api
class TestSearchAPI:
    """Integration tests for /api/v1/search endpoints."""

    # ------------------------------------------------------------------ POST /search/
    def test_unified_search_empty_query(self, client):
        response = client.post("/api/v1/search/", json={"query": ""})
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["results"] == []
        assert data["total"] == 0

    def test_unified_search_no_results(self, client):
        response = client.post("/api/v1/search/", json={"query": "zzz_nonexistent_zzz"})
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 0
        assert data["query"] == "zzz_nonexistent_zzz"

    def test_unified_search_with_data(self, client, sample_meeting):
        """Search should find text in transcript full_text."""
        response = client.post("/api/v1/search/", json={"query": "transcript"})
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] >= 1
        assert any(r["meeting_id"] == sample_meeting.id for r in data["results"])

    def test_unified_search_by_title(self, client, sample_meeting):
        response = client.post(
            "/api/v1/search/",
            json={"query": "test_meeting", "search_in": ["transcripts"]},
        )
        assert response.status_code == status.HTTP_200_OK

    def test_unified_search_with_folder_filter(self, client, sample_meeting):
        response = client.post(
            "/api/v1/search/",
            json={"query": "transcript", "folder": "test-folder"},
        )
        assert response.status_code == status.HTTP_200_OK

    def test_unified_search_with_tag_filter(self, client, sample_meeting):
        response = client.post(
            "/api/v1/search/",
            json={"query": "transcript", "tags": ["test"]},
        )
        assert response.status_code == status.HTTP_200_OK

    def test_unified_search_with_limit(self, client, sample_meeting):
        response = client.post(
            "/api/v1/search/",
            json={"query": "transcript", "limit": 1},
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["results"]) <= 1

    def test_unified_search_response_shape(self, client, sample_meeting):
        response = client.post("/api/v1/search/", json={"query": "transcript"})
        data = response.json()
        assert "results" in data
        assert "total" in data
        assert "query" in data
        assert "search_time_ms" in data
        if data["results"]:
            r = data["results"][0]
            assert "id" in r
            assert "meeting_id" in r
            assert "content_type" in r
            assert "snippet" in r
            assert "score" in r

    # ------------------------------------------------------------------ GET /search/quick
    def test_quick_search(self, client, sample_meeting):
        response = client.get("/api/v1/search/quick", params={"q": "test"})
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "results" in data
        assert "query" in data

    def test_quick_search_empty(self, client):
        """Quick search with no matches should still return valid shape."""
        response = client.get("/api/v1/search/quick", params={"q": "zzz_nope_zzz"})
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["results"] == []

    def test_quick_search_limit(self, client, sample_meeting):
        response = client.get("/api/v1/search/quick", params={"q": "test", "limit": 1})
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["results"]) <= 1

    def test_quick_search_missing_param(self, client):
        response = client.get("/api/v1/search/quick")
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
