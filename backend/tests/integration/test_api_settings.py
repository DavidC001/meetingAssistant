"""
Integration tests for Settings API endpoints.
"""

import pytest
from fastapi import status


@pytest.mark.integration
@pytest.mark.api
class TestSettingsModelConfigurations:
    """Tests for /api/v1/settings/model-configurations endpoints."""

    def test_list_model_configurations_empty(self, client):
        response = client.get("/api/v1/settings/model-configurations")
        assert response.status_code == status.HTTP_200_OK
        assert isinstance(response.json(), list)

    def test_create_model_configuration(self, client):
        payload = {
            "name": "test-config",
            "whisper_model": "base",
            "chat_provider": "openai",
            "chat_model": "gpt-4o-mini",
            "analysis_provider": "openai",
            "analysis_model": "gpt-4o-mini",
        }
        response = client.post("/api/v1/settings/model-configurations", json=payload)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == "test-config"
        assert data["id"] is not None

    def test_get_model_configuration(self, client):
        # Create then fetch
        payload = {"name": "get-test", "chat_provider": "openai", "chat_model": "gpt-4o-mini"}
        created = client.post("/api/v1/settings/model-configurations", json=payload).json()
        config_id = created["id"]

        response = client.get(f"/api/v1/settings/model-configurations/{config_id}")
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["name"] == "get-test"

    def test_get_model_configuration_not_found(self, client):
        response = client.get("/api/v1/settings/model-configurations/99999")
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_update_model_configuration(self, client):
        payload = {"name": "update-test", "chat_provider": "openai", "chat_model": "gpt-4o-mini"}
        created = client.post("/api/v1/settings/model-configurations", json=payload).json()
        config_id = created["id"]

        response = client.put(
            f"/api/v1/settings/model-configurations/{config_id}",
            json={"chat_model": "gpt-4o"},
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["chat_model"] == "gpt-4o"

    def test_delete_model_configuration(self, client):
        # The first config is auto-set as default and can't be deleted.
        # Create two, set the second as default, then delete the first.
        p1 = {"name": "delete-test", "chat_provider": "openai", "chat_model": "gpt-4o-mini"}
        created = client.post("/api/v1/settings/model-configurations", json=p1).json()
        config_id = created["id"]

        p2 = {"name": "keep-test", "chat_provider": "openai", "chat_model": "gpt-4o"}
        kept = client.post("/api/v1/settings/model-configurations", json=p2).json()
        client.post(f"/api/v1/settings/model-configurations/{kept['id']}/set-default")

        response = client.delete(f"/api/v1/settings/model-configurations/{config_id}")
        assert response.status_code == status.HTTP_200_OK

    def test_set_default_model_configuration(self, client):
        payload = {"name": "default-test", "chat_provider": "openai", "chat_model": "gpt-4o-mini"}
        created = client.post("/api/v1/settings/model-configurations", json=payload).json()
        config_id = created["id"]

        response = client.post(f"/api/v1/settings/model-configurations/{config_id}/set-default")
        assert response.status_code == status.HTTP_200_OK


@pytest.mark.integration
@pytest.mark.api
class TestSettingsAPIKeys:
    """Tests for /api/v1/settings/api-keys endpoints."""

    def test_list_api_keys(self, client):
        response = client.get("/api/v1/settings/api-keys")
        assert response.status_code == status.HTTP_200_OK
        assert isinstance(response.json(), list)

    def test_create_api_key(self, client):
        payload = {
            "name": "Test OpenAI Key",
            "provider": "openai",
            "environment_variable": "OPENAI_API_KEY",
            "key_value": "sk-test1234567890",
        }
        response = client.post("/api/v1/settings/api-keys", json=payload)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == "Test OpenAI Key"
        assert data["provider"] == "openai"

    def test_get_api_key_not_found(self, client):
        response = client.get("/api/v1/settings/api-keys/99999")
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_get_api_keys_by_provider(self, client):
        response = client.get("/api/v1/settings/api-keys/provider/openai")
        assert response.status_code == status.HTTP_200_OK
        assert isinstance(response.json(), list)


@pytest.mark.integration
@pytest.mark.api
class TestSettingsProviders:
    """Tests for /api/v1/settings/model-providers endpoint."""

    def test_get_available_providers(self, client):
        response = client.get("/api/v1/settings/model-providers")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "whisper_providers" in data
        assert "llm_providers" in data
        assert "whisper_models" in data


@pytest.mark.integration
@pytest.mark.api
class TestSettingsWorkerScaling:
    """Tests for /api/v1/settings/worker-scaling endpoints."""

    def test_get_worker_scaling(self, client):
        response = client.get("/api/v1/settings/worker-scaling")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "max_workers" in data

    def test_update_worker_scaling(self, client):
        # Ensure a worker config exists by getting first
        client.get("/api/v1/settings/worker-scaling")
        response = client.put("/api/v1/settings/worker-scaling", json={"max_workers": 2})
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["max_workers"] == 2

    def test_update_worker_scaling_invalid(self, client):
        response = client.put("/api/v1/settings/worker-scaling", json={"max_workers": 0})
        assert response.status_code in (status.HTTP_400_BAD_REQUEST, status.HTTP_422_UNPROCESSABLE_ENTITY)


@pytest.mark.integration
@pytest.mark.api
class TestSettingsAppSettings:
    """Tests for /api/v1/settings/app-settings endpoints."""

    def test_get_app_settings(self, client):
        response = client.get("/api/v1/settings/app-settings")
        assert response.status_code == status.HTTP_200_OK

    def test_update_app_settings(self, client, monkeypatch):
        # The endpoint writes to a .env file; mock it to avoid side effects
        from app.modules.settings import service as settings_svc

        monkeypatch.setattr(settings_svc, "write_env_file", lambda _: True)
        response = client.post("/api/v1/settings/app-settings", json={"maxFileSize": 500})
        assert response.status_code == status.HTTP_200_OK
