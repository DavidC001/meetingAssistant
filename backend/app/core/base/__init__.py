"""
Base module containing foundational patterns for the Meeting Assistant.

Contains:
- Repository pattern for database operations
- Exception hierarchy for consistent error handling
- Model mixins for common database patterns
- Validation utilities
- Retry decorators
- Caching utilities
"""

from .exceptions import (
    MeetingAssistantError,
    NotFoundError,
    MeetingNotFoundError,
    ValidationError,
    FileValidationError,
    ProcessingError,
    TranscriptionError,
    DiarizationError,
    AnalysisError,
    ExternalServiceError,
    LLMProviderError,
    EmbeddingError,
    ConfigurationError,
    AuthenticationError,
    RateLimitError,
    HTTPExceptions,
)

from .repository import (
    BaseRepository,
    get_or_404,
)

from .mixins import (
    TimestampMixin,
    SoftDeleteMixin,
    AuditMixin,
    MetadataMixin,
    TaggableMixin,
)

from .validation import (
    validate_file_extension,
    validate_file_size,
    validate_required_fields,
    parse_iso_date,
    sanitize_filename,
)

from .retry import (
    retry,
    retry_api_call,
    retry_gpu_operation,
    retry_file_operation,
)

from .cache import (
    cache_result,
    clear_cache,
    get_cache_info,
    file_cache,
    get_file_hash,
)

__all__ = [
    # Exceptions
    "MeetingAssistantError",
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
    "get_file_hash",
]
