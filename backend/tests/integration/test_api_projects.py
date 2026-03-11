"""
Integration tests for Projects API endpoints.
"""

import pytest
from fastapi import status


@pytest.mark.integration
@pytest.mark.api
class TestProjectsCRUD:
    """Tests for /api/v1/projects CRUD endpoints."""

    def _create_project(self, client, name="Test Project"):
        return client.post(
            "/api/v1/projects/",
            json={"name": name, "description": "A test project", "status": "active"},
        )

    def test_list_projects_empty(self, client):
        response = client.get("/api/v1/projects/")
        assert response.status_code == status.HTTP_200_OK
        assert isinstance(response.json(), list)

    def test_create_project(self, client):
        response = self._create_project(client)
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["name"] == "Test Project"
        assert data["id"] is not None
        assert data["status"] == "active"

    def test_get_project(self, client):
        created = self._create_project(client).json()
        response = client.get(f"/api/v1/projects/{created['id']}")
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["name"] == "Test Project"

    def test_get_project_not_found(self, client):
        response = client.get("/api/v1/projects/99999")
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_update_project(self, client):
        created = self._create_project(client).json()
        response = client.put(
            f"/api/v1/projects/{created['id']}",
            json={"name": "Updated Project"},
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["name"] == "Updated Project"

    def test_delete_project(self, client):
        created = self._create_project(client).json()
        response = client.delete(f"/api/v1/projects/{created['id']}")
        assert response.status_code == status.HTTP_204_NO_CONTENT

        # Verify deleted
        response = client.get(f"/api/v1/projects/{created['id']}")
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_list_projects_with_status_filter(self, client):
        self._create_project(client, name="Active One")
        response = client.get("/api/v1/projects/", params={"status": "active"})
        assert response.status_code == status.HTTP_200_OK


@pytest.mark.integration
@pytest.mark.api
class TestProjectMeetings:
    """Tests for project ↔ meeting association endpoints."""

    def _create_project(self, client, name="Meeting Project"):
        return client.post(
            "/api/v1/projects/",
            json={"name": name, "status": "active"},
        ).json()

    def test_get_project_meetings_empty(self, client):
        project = self._create_project(client)
        response = client.get(f"/api/v1/projects/{project['id']}/meetings")
        assert response.status_code == status.HTTP_200_OK

    def test_add_meeting_to_project(self, client, sample_meeting):
        project = self._create_project(client)
        response = client.post(f"/api/v1/projects/{project['id']}/meetings/{sample_meeting.id}")
        assert response.status_code == status.HTTP_201_CREATED

    def test_remove_meeting_from_project(self, client, sample_meeting):
        project = self._create_project(client)
        client.post(f"/api/v1/projects/{project['id']}/meetings/{sample_meeting.id}")
        response = client.delete(f"/api/v1/projects/{project['id']}/meetings/{sample_meeting.id}")
        assert response.status_code == status.HTTP_204_NO_CONTENT


@pytest.mark.integration
@pytest.mark.api
class TestProjectMembers:
    """Tests for project member endpoints."""

    def _create_project(self, client, name="Member Project"):
        return client.post(
            "/api/v1/projects/",
            json={"name": name, "status": "active"},
        ).json()

    def test_get_members_empty(self, client):
        project = self._create_project(client)
        response = client.get(f"/api/v1/projects/{project['id']}/members")
        assert response.status_code == status.HTTP_200_OK
        assert isinstance(response.json(), list)

    def test_add_member(self, client):
        project = self._create_project(client)
        response = client.post(
            f"/api/v1/projects/{project['id']}/members",
            json={"name": "Jane Doe", "role": "developer"},
        )
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["name"] == "Jane Doe"
        assert data["role"] == "developer"

    def test_update_member(self, client):
        project = self._create_project(client)
        member = client.post(
            f"/api/v1/projects/{project['id']}/members",
            json={"name": "Bob", "role": "member"},
        ).json()
        response = client.put(
            f"/api/v1/projects/{project['id']}/members/{member['id']}",
            json={"role": "lead"},
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["role"] == "lead"

    def test_remove_member(self, client):
        project = self._create_project(client)
        member = client.post(
            f"/api/v1/projects/{project['id']}/members",
            json={"name": "Carol", "role": "member"},
        ).json()
        response = client.delete(f"/api/v1/projects/{project['id']}/members/{member['id']}")
        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_sync_members(self, client, sample_meeting):
        project = self._create_project(client)
        # Link meeting
        client.post(f"/api/v1/projects/{project['id']}/meetings/{sample_meeting.id}")
        response = client.post(f"/api/v1/projects/{project['id']}/members/sync")
        assert response.status_code == status.HTTP_200_OK
        assert isinstance(response.json(), list)


@pytest.mark.integration
@pytest.mark.api
class TestProjectMilestones:
    """Tests for project milestone endpoints."""

    def _create_project(self, client, name="Milestone Project"):
        return client.post(
            "/api/v1/projects/",
            json={"name": name, "status": "active"},
        ).json()

    def test_get_milestones_empty(self, client):
        project = self._create_project(client)
        response = client.get(f"/api/v1/projects/{project['id']}/milestones")
        assert response.status_code == status.HTTP_200_OK
        assert response.json() == []

    def test_create_milestone(self, client):
        project = self._create_project(client)
        response = client.post(
            f"/api/v1/projects/{project['id']}/milestones",
            json={"name": "MVP Release", "description": "First release"},
        )
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["name"] == "MVP Release"
        assert data["status"] == "pending"

    def test_update_milestone(self, client):
        project = self._create_project(client)
        ms = client.post(
            f"/api/v1/projects/{project['id']}/milestones",
            json={"name": "Beta"},
        ).json()
        response = client.put(
            f"/api/v1/projects/{project['id']}/milestones/{ms['id']}",
            json={"name": "Beta v2"},
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["name"] == "Beta v2"

    def test_complete_milestone(self, client):
        project = self._create_project(client)
        ms = client.post(
            f"/api/v1/projects/{project['id']}/milestones",
            json={"name": "Done"},
        ).json()
        response = client.post(f"/api/v1/projects/{project['id']}/milestones/{ms['id']}/complete")
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["status"] == "completed"

    def test_delete_milestone(self, client):
        project = self._create_project(client)
        ms = client.post(
            f"/api/v1/projects/{project['id']}/milestones",
            json={"name": "Temp"},
        ).json()
        response = client.delete(f"/api/v1/projects/{project['id']}/milestones/{ms['id']}")
        assert response.status_code in (
            status.HTTP_200_OK,
            status.HTTP_204_NO_CONTENT,
        )


@pytest.mark.integration
@pytest.mark.api
class TestProjectNotes:
    """Tests for project notes endpoints."""

    def _create_project(self, client, name="Notes Project"):
        return client.post(
            "/api/v1/projects/",
            json={"name": name, "status": "active"},
        ).json()

    def test_get_notes_empty(self, client):
        project = self._create_project(client)
        response = client.get(f"/api/v1/projects/{project['id']}/notes")
        assert response.status_code == status.HTTP_200_OK
        assert response.json() == []

    def test_create_note(self, client):
        project = self._create_project(client)
        response = client.post(
            f"/api/v1/projects/{project['id']}/notes",
            json={"title": "Kickoff Notes", "content": "We discussed scope."},
        )
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["title"] == "Kickoff Notes"

    def test_update_note(self, client):
        project = self._create_project(client)
        note = client.post(
            f"/api/v1/projects/{project['id']}/notes",
            json={"title": "Draft", "content": "v1"},
        ).json()
        response = client.put(
            f"/api/v1/projects/{project['id']}/notes/{note['id']}",
            json={"content": "v2 updated"},
        )
        assert response.status_code == status.HTTP_200_OK

    def test_delete_note(self, client):
        project = self._create_project(client)
        note = client.post(
            f"/api/v1/projects/{project['id']}/notes",
            json={"title": "Temp", "content": "delete me"},
        ).json()
        response = client.delete(f"/api/v1/projects/{project['id']}/notes/{note['id']}")
        assert response.status_code in (
            status.HTTP_200_OK,
            status.HTTP_204_NO_CONTENT,
        )


@pytest.mark.integration
@pytest.mark.api
class TestProjectAnalytics:
    """Tests for project analytics endpoints."""

    def _create_project(self, client, name="Analytics Project"):
        return client.post(
            "/api/v1/projects/",
            json={"name": name, "status": "active"},
        ).json()

    def test_get_analytics(self, client):
        project = self._create_project(client)
        response = client.get(f"/api/v1/projects/{project['id']}/analytics")
        assert response.status_code == status.HTTP_200_OK

    def test_get_activity(self, client):
        project = self._create_project(client)
        response = client.get(f"/api/v1/projects/{project['id']}/activity")
        assert response.status_code == status.HTTP_200_OK
