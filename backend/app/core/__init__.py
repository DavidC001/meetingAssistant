"""
Core module for the Meeting Assistant application.

This package provides a well-organized structure for all core functionality:

Subpackages:
-----------
- `core.base`: Foundational patterns (repository, exceptions, mixins, validation)
- `core.llm`: LLM provider integration (OpenAI, Ollama, chat, analysis)
- `core.processing`: Media processing (transcription, diarization, chunking)
- `core.storage`: Data storage (embeddings, vector store, caching)

Quick Import Examples:
---------------------
    # Base patterns
    from app.core.base import BaseRepository, MeetingAssistantError, ValidationError

    # LLM functionality
    from app.core.llm import ProviderFactory, chat_about_meeting, analyze_transcript

    # Processing
    from app.core.processing import process_audio_file, run_diarization

    # Storage
    from app.core.storage import VectorStore, generate_embeddings

Legacy Imports (still supported):
---------------------------------
    from app.core import config
    from app.core.providers import LLMConfig
    from app.core.embeddings import generate_embeddings
"""

# =============================================================================
# Core Configuration (always available at top level)
# =============================================================================
# =============================================================================
# Base patterns - foundational classes and utilities
# =============================================================================
from .base import (
    AnalysisError,
    AuditMixin,
    AuthenticationError,
    # Repository
    BaseRepository,
    ConfigurationError,
    DiarizationError,
    EmbeddingError,
    ExternalServiceError,
    FileValidationError,
    HTTPExceptions,
    LLMProviderError,
    # Exceptions
    MeetingAssistantError,
    MeetingNotFoundError,
    MetadataMixin,
    NotFoundError,
    ProcessingError,
    RateLimitError,
    SoftDeleteMixin,
    TaggableMixin,
    # Mixins
    TimestampMixin,
    TranscriptionError,
    ValidationError,
    # Cache
    cache_result,
    clear_cache,
    file_cache,
    get_cache_info,
    get_or_404,
    parse_iso_date,
    # Retry
    retry,
    retry_api_call,
    retry_file_operation,
    retry_gpu_operation,
    sanitize_filename,
    # Validation
    validate_file_extension,
    validate_file_size,
    validate_required_fields,
)

# =============================================================================
# Backward compatibility exports
# These maintain compatibility with existing code that imports from core directly
# =============================================================================
# Legacy exception imports (from old exceptions.py)
# Now consolidated in base.exceptions
from .base.exceptions import (
    MeetingAssistantError as MeetingAssistantException,  # Old name alias
)
from .config import AppConfig, config

__all__ = [
    # Configuration
    "config",
    "AppConfig",
    # Exceptions
    "MeetingAssistantError",
    "MeetingAssistantException",  # Legacy alias
    "NotFoundError",
    "MeetingNotFoundError",
    "ValidationError",
    "FileValidationError",
    "ProcessingError",
    "TranscriptionError",
    "DiarizationError",
    "AnalysisError",
    "ExternalServiceError",
    "LLMProviderError",
    "EmbeddingError",
    "ConfigurationError",
    "AuthenticationError",
    "RateLimitError",
    "HTTPExceptions",
    # Repository
    "BaseRepository",
    "get_or_404",
    # Mixins
    "TimestampMixin",
    "SoftDeleteMixin",
    "AuditMixin",
    "MetadataMixin",
    "TaggableMixin",
    # Validation
    "validate_file_extension",
    "validate_file_size",
    "validate_required_fields",
    "parse_iso_date",
    "sanitize_filename",
    # Retry
    "retry",
    "retry_api_call",
    "retry_gpu_operation",
    "retry_file_operation",
    # Cache
    "cache_result",
    "clear_cache",
    "get_cache_info",
    "file_cache",
]
