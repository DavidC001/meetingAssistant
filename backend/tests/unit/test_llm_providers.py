"""Unit tests for LLM provider factory and OpenAI-compatible provider behavior."""

from unittest.mock import MagicMock, patch

import pytest

from app.core.llm import providers
from app.core.llm.providers import LLMConfig, ProviderFactory


class _FakeOpenAIClient:
    """Minimal fake OpenAI SDK client."""

    def __init__(self, **kwargs):
        self.kwargs = kwargs


@pytest.mark.unit
def test_provider_factory_maps_other_to_openai_provider(monkeypatch):
    """'other' should be treated as OpenAI-compatible provider."""

    class _FakeProvider:
        def __init__(self, config):
            self.config = config

    monkeypatch.setattr(providers, "OpenAIProvider", _FakeProvider)

    config = LLMConfig(provider="other", model="my-model", base_url="https://proxy.example.com/v1")
    provider = ProviderFactory.create_provider(config)

    assert isinstance(provider, _FakeProvider)
    assert provider.config.provider == "other"


@pytest.mark.unit
def test_openai_provider_allows_other_without_api_key(monkeypatch):
    """Custom 'other' provider may rely on proxy-side auth injection."""

    monkeypatch.setattr(providers, "openai", type("_OpenAIModule", (), {"OpenAI": _FakeOpenAIClient}))
    monkeypatch.setattr(providers, "AsyncOpenAI", _FakeOpenAIClient)

    config = LLMConfig(provider="other", model="my-model", base_url="https://proxy.example.com/v1", api_key=None)
    provider = providers.OpenAIProvider(config)

    assert provider.client.kwargs["api_key"] == "proxy-auth"
    assert provider.client.kwargs["base_url"] == "https://proxy.example.com/v1"


@pytest.mark.unit
def test_openai_provider_requires_key_for_non_other(monkeypatch):
    """Standard OpenAI-compatible providers still require explicit API key."""

    monkeypatch.setattr(providers, "openai", type("_OpenAIModule", (), {"OpenAI": _FakeOpenAIClient}))
    monkeypatch.setattr(providers, "AsyncOpenAI", _FakeOpenAIClient)

    config = LLMConfig(provider="openai", model="gpt-4o-mini", api_key=None)

    with pytest.raises(RuntimeError, match="API key not provided"):
        providers.OpenAIProvider(config)


@pytest.mark.unit
def test_ollama_provider_uses_api_key_when_configured():
    """Ollama provider should pass Authorization header when API key is set."""

    with patch("app.core.llm.providers.requests.get") as mock_get:
        mock_response = MagicMock()
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response

        config = LLMConfig(
            provider="ollama", model="llama3", base_url="http://proxy.example.com", api_key="secret-token"
        )
        provider = providers.OllamaProvider(config)

        # Check the headers were set with Bearer token
        call_kwargs = mock_get.call_args[1]
        assert call_kwargs["headers"]["Authorization"] == "Bearer secret-token"


@pytest.mark.unit
def test_ollama_provider_strips_bearer_prefix():
    """Ollama provider should handle keys that already include 'Bearer ' prefix."""

    with patch("app.core.llm.providers.requests.get") as mock_get:
        mock_response = MagicMock()
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response

        config = LLMConfig(
            provider="ollama", model="llama3", base_url="http://proxy.example.com", api_key="Bearer my-token"
        )
        provider = providers.OllamaProvider(config)

        call_kwargs = mock_get.call_args[1]
        assert call_kwargs["headers"]["Authorization"] == "Bearer my-token"


@pytest.mark.unit
def test_openai_provider_strips_bearer_prefix(monkeypatch):
    """Keys pasted as 'Bearer ...' should be normalized to raw token."""

    monkeypatch.setattr(providers, "openai", type("_OpenAIModule", (), {"OpenAI": _FakeOpenAIClient}))
    monkeypatch.setattr(providers, "AsyncOpenAI", _FakeOpenAIClient)

    config = LLMConfig(provider="other", model="my-model", api_key="Bearer secret-token")
    provider = providers.OpenAIProvider(config)

    assert provider.client.kwargs["api_key"] == "secret-token"


@pytest.mark.unit
def test_openai_provider_other_missing_configured_env_raises(monkeypatch):
    """If an env var is explicitly configured but empty, fail with actionable error."""

    monkeypatch.setattr(providers, "openai", type("_OpenAIModule", (), {"OpenAI": _FakeOpenAIClient}))
    monkeypatch.setattr(providers, "AsyncOpenAI", _FakeOpenAIClient)

    config = LLMConfig(provider="other", model="my-model", api_key_env="OTHER_API_KEY", api_key=None)

    with pytest.raises(RuntimeError, match="OTHER_API_KEY"):
        providers.OpenAIProvider(config)
