"""Unit tests for runtime configuration helpers."""

import importlib

from app.core.config import APIConfig

config_module = importlib.import_module("app.core.config")


class _FakeDotenvPath:
    """Minimal fake path object for dotenv lookup tests."""

    def __init__(self, exists: bool):
        self._exists = exists

    def __truediv__(self, _other):
        return self

    def exists(self):
        return self._exists


class _FakeConfigPath:
    """Path shim that supports the subset used by APIConfig.get."""

    def __init__(self, exists: bool):
        self._exists = exists

    def resolve(self):
        return self

    @property
    def parents(self):
        return [None, None, _FakeDotenvPath(self._exists)]


def test_api_config_get_falls_back_to_dotenv(monkeypatch):
    """Credentials saved in backend/.env should be readable at runtime."""

    monkeypatch.delenv("OLLAMA_SERVER_API_KEY", raising=False)
    monkeypatch.setattr(config_module, "Path", lambda *_args, **_kwargs: _FakeConfigPath(True))
    monkeypatch.setattr(config_module, "dotenv_values", lambda _path: {"OLLAMA_SERVER_API_KEY": "proxy-secret"})

    api_config = APIConfig()

    assert api_config.get("OLLAMA_SERVER_API_KEY") == "proxy-secret"


def test_api_config_get_normalizes_quoted_values(monkeypatch):
    """Quoted values from env files should be unwrapped before use."""

    monkeypatch.delenv("OLLAMA_SERVER_API_KEY", raising=False)
    monkeypatch.setattr(config_module, "Path", lambda *_args, **_kwargs: _FakeConfigPath(True))
    monkeypatch.setattr(config_module, "dotenv_values", lambda _path: {"OLLAMA_SERVER_API_KEY": '  "proxy-secret"  '})

    api_config = APIConfig()

    assert api_config.get("OLLAMA_SERVER_API_KEY") == "proxy-secret"
