"""
Configuration management module for the Meeting Assistant application.

This module centralizes configuration logic and provides a clean interface
for accessing environment variables and application settings.
"""

import os
from typing import Optional
from dataclasses import dataclass
from pathlib import Path


@dataclass
class UploadConfig:
    """Configuration for file uploads."""
    max_file_size_mb: int
    upload_dir: str
    allowed_extensions: tuple
    
    @property
    def max_file_size_bytes(self) -> int:
        """Get max file size in bytes."""
        return self.max_file_size_mb * 1024 * 1024
    
    def __post_init__(self):
        """Ensure upload directory exists."""
        Path(self.upload_dir).mkdir(parents=True, exist_ok=True)


@dataclass
class ModelConfig:
    """Configuration for AI models."""
    default_whisper_model: str
    default_chat_model: str
    default_analysis_model: str
    default_max_tokens: int
    default_temperature: float
    ollama_base_url: str


@dataclass
class DatabaseConfig:
    """Database configuration."""
    url: str
    echo: bool = False


@dataclass
class CeleryConfig:
    """Celery configuration."""
    broker_url: str
    result_backend: str


@dataclass
class AppConfig:
    """Main application configuration."""
    title: str
    description: str
    version: str
    debug: bool
    upload: UploadConfig
    model: ModelConfig
    database: DatabaseConfig
    celery: CeleryConfig


def get_upload_config() -> UploadConfig:
    """Get upload configuration from environment variables."""
    return UploadConfig(
        max_file_size_mb=int(os.getenv("MAX_FILE_SIZE_MB", "3000")),
        upload_dir=os.getenv("UPLOAD_DIR", "uploads"),
        allowed_extensions=tuple(
            ext.strip() 
            for ext in os.getenv("ALLOWED_EXTENSIONS", ".wav,.mp3,.mp4,.m4a,.flac").split(",")
        )
    )


def get_model_config() -> ModelConfig:
    """Get model configuration from environment variables."""
    return ModelConfig(
        default_whisper_model=os.getenv("DEFAULT_WHISPER_MODEL", "base"),
        default_chat_model=os.getenv("DEFAULT_CHAT_MODEL", "gpt-4o-mini"),
        default_analysis_model=os.getenv("DEFAULT_ANALYSIS_MODEL", "gpt-4o-mini"),
        default_max_tokens=int(os.getenv("DEFAULT_MAX_TOKENS", "4000")),
        default_temperature=float(os.getenv("DEFAULT_TEMPERATURE", "0.1")),
        ollama_base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    )


def get_database_config() -> DatabaseConfig:
    """Get database configuration from environment variables."""
    return DatabaseConfig(
        url=os.getenv("DATABASE_URL", "sqlite:///./app.db"),
        echo=os.getenv("DATABASE_ECHO", "false").lower() == "true"
    )


def get_celery_config() -> CeleryConfig:
    """Get Celery configuration from environment variables."""
    return CeleryConfig(
        broker_url=os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0"),
        result_backend=os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")
    )


def get_app_config() -> AppConfig:
    """Get complete application configuration."""
    return AppConfig(
        title="Meeting Assistant API",
        description="Enhanced API for transcribing and analyzing meetings with export capabilities.",
        version="1.0.0",
        debug=os.getenv("DEBUG", "false").lower() == "true",
        upload=get_upload_config(),
        model=get_model_config(),
        database=get_database_config(),
        celery=get_celery_config()
    )


# Global configuration instance
config = get_app_config()