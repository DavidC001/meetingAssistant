"""Configuration management module for the Meeting Assistant application."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Optional, Tuple

from dotenv import load_dotenv

# Ensure values from a local .env file are available before configuration is built
load_dotenv()


@dataclass
class UploadConfig:
    """Configuration for file uploads."""

    max_file_size_mb: int
    upload_dir: str
    allowed_extensions: Tuple[str, ...]

    @property
    def max_file_size_bytes(self) -> int:
        """Return the maximum upload size in bytes."""
        return self.max_file_size_mb * 1024 * 1024

    def __post_init__(self) -> None:
        """Ensure the upload directory exists."""
        Path(self.upload_dir).mkdir(parents=True, exist_ok=True)


@dataclass
class ModelConfig:
    """Configuration for AI model defaults and providers."""

    default_whisper_model: str
    default_chat_model: str
    default_analysis_model: str
    local_chat_model: str
    local_analysis_model: str
    default_max_tokens: int
    ollama_base_url: str
    preferred_provider: str


@dataclass
class APIConfig:
    """Centralised storage for API credentials."""

    _openai_api_key: Optional[str] = None
    _huggingface_token: Optional[str] = None
    extra_keys: Dict[str, str] = field(default_factory=dict)

    def get(self, name: Optional[str]) -> Optional[str]:
        """Return a credential by its environment variable style name."""
        if not name:
            return None

        normalized = name.upper()
        if normalized in self.extra_keys:
            return self.extra_keys[normalized]

        known = {
            "OPENAI_API_KEY": self._openai_api_key,
            "HUGGINGFACE_TOKEN": self._huggingface_token,
        }
        return known.get(normalized) or os.getenv(normalized)

    @property
    def openai_api_key(self) -> Optional[str]:
        """Convenience accessor for the OpenAI API key."""
        return self.get("OPENAI_API_KEY")

    @property
    def huggingface_token(self) -> Optional[str]:
        """Convenience accessor for the Hugging Face token."""
        return self.get("HUGGINGFACE_TOKEN")


@dataclass
class DatabaseConfig:
    """Database connection settings."""

    url: str
    echo: bool = False


@dataclass
class CeleryConfig:
    """Celery broker/back-end configuration."""

    broker_url: str
    result_backend: str


@dataclass
class AppConfig:
    """Main application configuration object."""

    title: str
    description: str
    version: str
    debug: bool
    upload: UploadConfig
    model: ModelConfig
    database: DatabaseConfig
    celery: CeleryConfig
    api: APIConfig

    def get_api_key(self, name: Optional[str]) -> Optional[str]:
        """Proxy helper for fetching an API key from :class:`APIConfig`."""
        return self.api.get(name)


def get_upload_config() -> UploadConfig:
    """Build the :class:`UploadConfig` from environment variables."""
    allowed = tuple(
        ext.strip()
        for ext in os.getenv("ALLOWED_EXTENSIONS", ".wav,.mp3,.mp4,.m4a,.flac,.mkv,.avi,.mov").split(",")
        if ext.strip()
    )
    return UploadConfig(
        max_file_size_mb=int(os.getenv("MAX_FILE_SIZE_MB", "3000")),
        upload_dir=os.getenv("UPLOAD_DIR", "uploads"),
        allowed_extensions=allowed,
    )


def get_model_config() -> ModelConfig:
    """Build the :class:`ModelConfig` from environment variables."""
    return ModelConfig(
        default_whisper_model=os.getenv("DEFAULT_WHISPER_MODEL", "base"),
        default_chat_model=os.getenv("DEFAULT_CHAT_MODEL", "gpt-4o-mini"),
        default_analysis_model=os.getenv("DEFAULT_ANALYSIS_MODEL", "gpt-4o-mini"),
        local_chat_model=os.getenv("DEFAULT_LOCAL_CHAT_MODEL", "llama3"),
        local_analysis_model=os.getenv("DEFAULT_LOCAL_ANALYSIS_MODEL", "llama3"),
        default_max_tokens=int(os.getenv("DEFAULT_MAX_TOKENS", "8000")),
        ollama_base_url=os.getenv("OLLAMA_BASE_URL", "http://host.docker.internal:11434"),
        preferred_provider=os.getenv("PREFERRED_PROVIDER", "openai"),
    )


def get_api_config() -> APIConfig:
    """Build the :class:`APIConfig` from environment variables."""
    return APIConfig(
        _openai_api_key=os.getenv("OPENAI_API_KEY"),
        _huggingface_token=os.getenv("HUGGINGFACE_TOKEN"),
    )


def get_database_config() -> DatabaseConfig:
    """Build the :class:`DatabaseConfig` from environment variables."""
    return DatabaseConfig(
        url=os.getenv("DATABASE_URL", "sqlite:///./app.db"),
        echo=os.getenv("DATABASE_ECHO", "false").lower() == "true",
    )


def get_celery_config() -> CeleryConfig:
    """Build the :class:`CeleryConfig` from environment variables."""
    return CeleryConfig(
        broker_url=os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0"),
        result_backend=os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0"),
    )


def get_app_config() -> AppConfig:
    """Construct the aggregate :class:`AppConfig`."""
    return AppConfig(
        title="Meeting Assistant API",
        description="Enhanced API for transcribing and analyzing meetings with export capabilities.",
        version="1.0.0",
        debug=os.getenv("DEBUG", "false").lower() == "true",
        upload=get_upload_config(),
        model=get_model_config(),
        database=get_database_config(),
        celery=get_celery_config(),
        api=get_api_config(),
    )


# Global configuration instance used across the application
config = get_app_config()
