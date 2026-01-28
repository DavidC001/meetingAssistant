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

from .cache import (
    cache_result,
    clear_cache,
    file_cache,
    get_cache_info,
    get_file_hash,
)
from .exceptions import (
    AnalysisError,
    AuthenticationError,
    ConfigurationError,
    DiarizationError,
    EmbeddingError,
    ExternalServiceError,
    FileValidationError,
    HTTPExceptions,
    LLMProviderError,
    MeetingAssistantError,
    MeetingNotFoundError,
    NotFoundError,
    ProcessingError,
    RateLimitError,
    TranscriptionError,
    ValidationError,
)
from .mixins import (
    AuditMixin,
    MetadataMixin,
    SoftDeleteMixin,
    TaggableMixin,
    TimestampMixin,
)
from .repository import (
    BaseRepository,
    get_or_404,
)
from .retry import (
    retry,
    retry_api_call,
    retry_file_operation,
    retry_gpu_operation,
)
from .validation import (
    parse_iso_date,
    sanitize_filename,
    validate_file_extension,
    validate_file_size,
    validate_required_fields,
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
