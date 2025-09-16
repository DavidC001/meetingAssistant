"""
Common exceptions and constants for the Meeting Assistant application.
"""

from fastapi import HTTPException


class MeetingAssistantException(Exception):
    """Base exception for Meeting Assistant application."""
    pass


class FileValidationError(MeetingAssistantException):
    """Exception raised for file validation errors."""
    pass


class ProcessingError(MeetingAssistantException):
    """Exception raised during meeting processing."""
    pass


class ConfigurationError(MeetingAssistantException):
    """Exception raised for configuration issues."""
    pass


# HTTP Exception shortcuts
class HTTPExceptions:
    """Common HTTP exceptions."""
    
    @staticmethod
    def not_found(detail: str = "Resource not found"):
        return HTTPException(status_code=404, detail=detail)
    
    @staticmethod
    def bad_request(detail: str = "Bad request"):
        return HTTPException(status_code=400, detail=detail)
    
    @staticmethod
    def internal_error(detail: str = "Internal server error"):
        return HTTPException(status_code=500, detail=detail)
    
    @staticmethod
    def file_too_large(detail: str = "File too large"):
        return HTTPException(status_code=413, detail=detail)
    
    @staticmethod
    def unsupported_media_type(detail: str = "Unsupported media type"):
        return HTTPException(status_code=415, detail=detail)


# Processing constants
class ProcessingConstants:
    """Constants for processing operations."""
    
    DEFAULT_LANGUAGE = "en-US"
    AUTO_SPEAKERS = "auto"
    MAX_RETRY_ATTEMPTS = 3
    RETRY_DELAY_SECONDS = 5.0
    
    # Stage names
    STAGE_CONVERSION = "conversion"
    STAGE_DIARIZATION = "diarization"
    STAGE_TRANSCRIPTION = "transcription"
    STAGE_ANALYSIS = "analysis"
    
    # Progress percentages by stage
    STAGE_PROGRESS = {
        STAGE_CONVERSION: 25,
        STAGE_DIARIZATION: 50,
        STAGE_TRANSCRIPTION: 75,
        STAGE_ANALYSIS: 100
    }


# Response messages
class ResponseMessages:
    """Standard response messages."""
    
    MEETING_NOT_FOUND = "Meeting not found"
    PROCESSING_ALREADY_COMPLETE = "Meeting processing is already completed"
    CANNOT_RESTART_PROCESSING = "Cannot restart processing for meeting with current status"
    FILE_UPLOAD_SUCCESS = "File uploaded successfully"
    PROCESSING_RESTARTED = "Processing restarted successfully"
    MEETING_UPDATED = "Meeting updated successfully"
    MEETING_DELETED = "Meeting deleted successfully"