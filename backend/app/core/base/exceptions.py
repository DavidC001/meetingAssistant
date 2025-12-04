"""
Unified exception hierarchy for the Meeting Assistant application.

This module provides a consistent exception structure with:
- Meaningful error messages
- HTTP status code mapping for API responses
- Proper inheritance hierarchy for catch-all handling

Usage:
    from app.core.base import MeetingAssistantError, NotFoundError

    raise NotFoundError("Meeting", meeting_id)
    raise ProcessingError("Transcription failed", original_exception)
"""

from typing import Optional, Any
from fastapi import HTTPException, status


class MeetingAssistantError(Exception):
    """
    Base exception for all Meeting Assistant errors.
    
    Provides:
    - Consistent error message formatting
    - HTTP status code for API responses
    - Optional original exception chaining
    """
    
    message: str = "An error occurred"
    http_status: int = status.HTTP_500_INTERNAL_SERVER_ERROR
    
    def __init__(
        self,
        message: Optional[str] = None,
        original_error: Optional[Exception] = None,
        details: Optional[dict] = None
    ):
        self.message = message or self.__class__.message
        self.original_error = original_error
        self.details = details or {}
        super().__init__(self.message)
    
    def to_http_exception(self) -> HTTPException:
        """Convert to FastAPI HTTPException for API responses."""
        detail = {"message": self.message}
        if self.details:
            detail.update(self.details)
        return HTTPException(status_code=self.http_status, detail=detail)
    
    def __repr__(self) -> str:
        return f"{self.__class__.__name__}('{self.message}')"


# =============================================================================
# Not Found Errors (404)
# =============================================================================

class NotFoundError(MeetingAssistantError):
    """Base class for resource not found errors."""
    
    http_status = status.HTTP_404_NOT_FOUND
    
    def __init__(self, resource_type: str, resource_id: Any = None, message: Optional[str] = None):
        self.resource_type = resource_type
        self.resource_id = resource_id
        if message is None:
            if resource_id:
                message = f"{resource_type} with id '{resource_id}' not found"
            else:
                message = f"{resource_type} not found"
        super().__init__(message, details={"resource_type": resource_type, "resource_id": resource_id})


class MeetingNotFoundError(NotFoundError):
    """Raised when a meeting is not found."""
    
    def __init__(self, meeting_id: Any, message: Optional[str] = None):
        super().__init__("Meeting", meeting_id, message)


class AttachmentNotFoundError(NotFoundError):
    """Raised when an attachment is not found."""
    
    def __init__(self, attachment_id: Any, message: Optional[str] = None):
        super().__init__("Attachment", attachment_id, message)


class UserNotFoundError(NotFoundError):
    """Raised when a user is not found."""
    
    def __init__(self, user_id: Any, message: Optional[str] = None):
        super().__init__("User", user_id, message)


# =============================================================================
# Validation Errors (400)
# =============================================================================

class ValidationError(MeetingAssistantError):
    """Raised for input validation failures."""
    
    http_status = status.HTTP_400_BAD_REQUEST
    message = "Validation failed"
    
    def __init__(self, message: str, field: Optional[str] = None, **kwargs):
        self.field = field
        details = {"field": field} if field else {}
        super().__init__(message, details=details, **kwargs)


class FileValidationError(ValidationError):
    """Raised for file validation failures (type, size, format)."""
    
    def __init__(self, message: str, filename: Optional[str] = None, **kwargs):
        self.filename = filename
        super().__init__(message, field="file", **kwargs)
        if filename:
            self.details["filename"] = filename


# =============================================================================
# Processing Errors (500 or 422)
# =============================================================================

class ProcessingError(MeetingAssistantError):
    """
    Base class for processing pipeline errors.
    
    Used when meeting processing steps fail.
    """
    
    http_status = status.HTTP_422_UNPROCESSABLE_ENTITY
    message = "Processing failed"


class TranscriptionError(ProcessingError):
    """Raised when audio transcription fails."""
    
    def __init__(self, message: str = "Transcription failed", **kwargs):
        super().__init__(message, **kwargs)


class DiarizationError(ProcessingError):
    """Raised when speaker diarization fails."""
    
    def __init__(self, message: str = "Speaker diarization failed", **kwargs):
        super().__init__(message, **kwargs)


class AnalysisError(ProcessingError):
    """Raised when meeting analysis fails."""
    
    def __init__(self, message: str = "Meeting analysis failed", **kwargs):
        super().__init__(message, **kwargs)


# =============================================================================
# External Service Errors (502, 503, 504)
# =============================================================================

class ExternalServiceError(MeetingAssistantError):
    """
    Base class for external service failures.
    
    Used when external APIs (LLM providers, embedding services) fail.
    """
    
    http_status = status.HTTP_502_BAD_GATEWAY
    message = "External service error"
    
    def __init__(self, service_name: str, message: Optional[str] = None, **kwargs):
        self.service_name = service_name
        if message is None:
            message = f"External service '{service_name}' error"
        super().__init__(message, **kwargs)
        self.details["service"] = service_name


class LLMProviderError(ExternalServiceError):
    """Raised when an LLM provider (OpenAI, Ollama, etc.) fails."""
    
    def __init__(self, provider: str, message: Optional[str] = None, **kwargs):
        if message is None:
            message = f"LLM provider '{provider}' failed"
        super().__init__(provider, message, **kwargs)


class EmbeddingError(ExternalServiceError):
    """Raised when embedding generation fails."""
    
    def __init__(self, message: str = "Embedding generation failed", **kwargs):
        super().__init__("embedding_service", message, **kwargs)


# =============================================================================
# Configuration Errors (500)
# =============================================================================

class ConfigurationError(MeetingAssistantError):
    """Raised for configuration issues."""
    
    http_status = status.HTTP_500_INTERNAL_SERVER_ERROR
    message = "Configuration error"
    
    def __init__(self, message: str, setting_name: Optional[str] = None, **kwargs):
        self.setting_name = setting_name
        super().__init__(message, **kwargs)
        if setting_name:
            self.details["setting"] = setting_name


# =============================================================================
# Authentication/Authorization Errors (401, 403)
# =============================================================================

class AuthenticationError(MeetingAssistantError):
    """Raised for authentication failures."""
    
    http_status = status.HTTP_401_UNAUTHORIZED
    message = "Authentication required"


class AuthorizationError(MeetingAssistantError):
    """Raised for authorization failures."""
    
    http_status = status.HTTP_403_FORBIDDEN
    message = "Permission denied"


# =============================================================================
# Rate Limiting (429)
# =============================================================================

class RateLimitError(MeetingAssistantError):
    """Raised when rate limits are exceeded."""
    
    http_status = status.HTTP_429_TOO_MANY_REQUESTS
    message = "Rate limit exceeded"
    
    def __init__(self, message: str = "Rate limit exceeded", retry_after: Optional[int] = None, **kwargs):
        self.retry_after = retry_after
        super().__init__(message, **kwargs)
        if retry_after:
            self.details["retry_after"] = retry_after


# =============================================================================
# HTTP Exception Factory (for backward compatibility)
# =============================================================================

class HTTPExceptions:
    """
    Factory class for creating common HTTP exceptions.
    
    Provides backward compatibility with the old exceptions.py pattern.
    """
    
    @staticmethod
    def not_found(detail: str = "Resource not found") -> HTTPException:
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)
    
    @staticmethod
    def bad_request(detail: str = "Bad request") -> HTTPException:
        return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)
    
    @staticmethod
    def unauthorized(detail: str = "Unauthorized") -> HTTPException:
        return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)
    
    @staticmethod
    def forbidden(detail: str = "Forbidden") -> HTTPException:
        return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)
    
    @staticmethod
    def conflict(detail: str = "Conflict") -> HTTPException:
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)
    
    @staticmethod
    def unprocessable(detail: str = "Unprocessable entity") -> HTTPException:
        return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detail)
    
    @staticmethod
    def internal_error(detail: str = "Internal server error") -> HTTPException:
        return HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=detail)
    
    @staticmethod
    def service_unavailable(detail: str = "Service unavailable") -> HTTPException:
        return HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=detail)
