"""
Validation utilities for input data and files.

Provides reusable validation functions that can be used across
endpoints and processing pipeline.

Usage:
    from app.core.base import validate_file_extension, sanitize_filename
    
    validate_file_extension(file.filename, ['.mp3', '.wav'])
    safe_name = sanitize_filename(uploaded_name)
"""

import os
import re
from pathlib import Path
from datetime import datetime
from typing import List, Optional, Any, Set

from .exceptions import ValidationError, FileValidationError


# =============================================================================
# File Validation
# =============================================================================

# Supported file formats
AUDIO_EXTENSIONS = {'.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.wma'}
VIDEO_EXTENSIONS = {'.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.wmv'}
DOCUMENT_EXTENSIONS = {'.pdf', '.txt', '.doc', '.docx', '.md'}
ALL_MEDIA_EXTENSIONS = AUDIO_EXTENSIONS | VIDEO_EXTENSIONS


def validate_file_extension(
    filename: str,
    allowed_extensions: Optional[Set[str]] = None,
    error_message: Optional[str] = None
) -> str:
    """
    Validate file extension is in allowed list.
    
    Args:
        filename: The filename to validate
        allowed_extensions: Set of allowed extensions (with dots, e.g., {'.mp3', '.wav'})
        error_message: Custom error message
    
    Returns:
        The validated file extension (lowercase)
    
    Raises:
        FileValidationError: If extension is not allowed
    """
    if allowed_extensions is None:
        allowed_extensions = ALL_MEDIA_EXTENSIONS
    
    extension = Path(filename).suffix.lower()
    
    if extension not in allowed_extensions:
        msg = error_message or f"File type '{extension}' not supported. Allowed: {', '.join(sorted(allowed_extensions))}"
        raise FileValidationError(msg, filename=filename)
    
    return extension


def validate_file_size(
    file_size: int,
    max_size_mb: int = 500,
    error_message: Optional[str] = None
) -> int:
    """
    Validate file size is within limits.
    
    Args:
        file_size: File size in bytes
        max_size_mb: Maximum allowed size in megabytes
        error_message: Custom error message
    
    Returns:
        The validated file size
    
    Raises:
        FileValidationError: If file exceeds size limit
    """
    max_size_bytes = max_size_mb * 1024 * 1024
    
    if file_size > max_size_bytes:
        msg = error_message or f"File size ({file_size / (1024*1024):.1f}MB) exceeds maximum ({max_size_mb}MB)"
        raise FileValidationError(msg)
    
    return file_size


def sanitize_filename(filename: str, max_length: int = 255) -> str:
    """
    Sanitize a filename to be safe for filesystem storage.
    
    Removes or replaces dangerous characters while preserving readability.
    
    Args:
        filename: The original filename
        max_length: Maximum length for the filename
    
    Returns:
        A sanitized, safe filename
    """
    if not filename:
        return "unnamed_file"
    
    # Get the stem and extension separately
    path = Path(filename)
    stem = path.stem
    extension = path.suffix.lower()
    
    # Remove or replace dangerous characters
    # Keep alphanumeric, spaces, hyphens, underscores
    stem = re.sub(r'[^\w\s\-]', '', stem)
    stem = re.sub(r'\s+', '_', stem)
    stem = stem.strip('_-')
    
    # Ensure we have something left
    if not stem:
        stem = "file"
    
    # Limit length (accounting for extension)
    max_stem_length = max_length - len(extension)
    if len(stem) > max_stem_length:
        stem = stem[:max_stem_length]
    
    return stem + extension


def is_audio_file(filename: str) -> bool:
    """Check if file is an audio format."""
    return Path(filename).suffix.lower() in AUDIO_EXTENSIONS


def is_video_file(filename: str) -> bool:
    """Check if file is a video format."""
    return Path(filename).suffix.lower() in VIDEO_EXTENSIONS


def is_media_file(filename: str) -> bool:
    """Check if file is any media format (audio or video)."""
    return Path(filename).suffix.lower() in ALL_MEDIA_EXTENSIONS


# =============================================================================
# Input Validation
# =============================================================================

def validate_required_fields(
    data: dict,
    required_fields: List[str],
    context: str = "request"
) -> None:
    """
    Validate that required fields are present and not empty.
    
    Args:
        data: Dictionary of input data
        required_fields: List of required field names
        context: Context for error message
    
    Raises:
        ValidationError: If any required field is missing or empty
    """
    missing = []
    for field in required_fields:
        value = data.get(field)
        if value is None or (isinstance(value, str) and not value.strip()):
            missing.append(field)
    
    if missing:
        raise ValidationError(
            f"Missing required fields in {context}: {', '.join(missing)}",
            field=missing[0]
        )


def validate_string_length(
    value: str,
    field_name: str,
    min_length: int = 0,
    max_length: int = 10000
) -> str:
    """
    Validate string length is within bounds.
    
    Args:
        value: The string to validate
        field_name: Name of the field for error message
        min_length: Minimum allowed length
        max_length: Maximum allowed length
    
    Returns:
        The validated string (stripped)
    
    Raises:
        ValidationError: If string length is out of bounds
    """
    value = value.strip() if value else ""
    
    if len(value) < min_length:
        raise ValidationError(
            f"{field_name} must be at least {min_length} characters",
            field=field_name
        )
    
    if len(value) > max_length:
        raise ValidationError(
            f"{field_name} must not exceed {max_length} characters",
            field=field_name
        )
    
    return value


def validate_positive_integer(
    value: Any,
    field_name: str,
    min_value: int = 1,
    max_value: Optional[int] = None
) -> int:
    """
    Validate value is a positive integer within range.
    
    Args:
        value: The value to validate
        field_name: Name of the field for error message
        min_value: Minimum allowed value
        max_value: Maximum allowed value (optional)
    
    Returns:
        The validated integer
    
    Raises:
        ValidationError: If value is not a valid positive integer
    """
    try:
        int_value = int(value)
    except (TypeError, ValueError):
        raise ValidationError(f"{field_name} must be an integer", field=field_name)
    
    if int_value < min_value:
        raise ValidationError(
            f"{field_name} must be at least {min_value}",
            field=field_name
        )
    
    if max_value is not None and int_value > max_value:
        raise ValidationError(
            f"{field_name} must not exceed {max_value}",
            field=field_name
        )
    
    return int_value


# =============================================================================
# Date/Time Validation
# =============================================================================

def parse_iso_date(
    date_string: str,
    field_name: str = "date"
) -> datetime:
    """
    Parse and validate an ISO format date string.
    
    Args:
        date_string: Date string in ISO format
        field_name: Name of the field for error message
    
    Returns:
        Parsed datetime object
    
    Raises:
        ValidationError: If date format is invalid
    """
    if not date_string:
        raise ValidationError(f"{field_name} is required", field=field_name)
    
    try:
        # Try ISO format first
        return datetime.fromisoformat(date_string.replace('Z', '+00:00'))
    except ValueError:
        pass
    
    # Try common formats
    formats = [
        "%Y-%m-%d",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%d/%m/%Y",
        "%m/%d/%Y",
    ]
    
    for fmt in formats:
        try:
            return datetime.strptime(date_string, fmt)
        except ValueError:
            continue
    
    raise ValidationError(
        f"Invalid date format for {field_name}. Expected ISO format (YYYY-MM-DD)",
        field=field_name
    )


def validate_date_range(
    start_date: Optional[datetime],
    end_date: Optional[datetime],
    field_name: str = "date range"
) -> None:
    """
    Validate that start date is before end date.
    
    Args:
        start_date: Start of range
        end_date: End of range
        field_name: Name of the field for error message
    
    Raises:
        ValidationError: If start date is after end date
    """
    if start_date and end_date and start_date > end_date:
        raise ValidationError(
            f"Invalid {field_name}: start date must be before end date",
            field=field_name
        )


# =============================================================================
# Email/URL Validation
# =============================================================================

EMAIL_REGEX = re.compile(
    r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
)

URL_REGEX = re.compile(
    r'^https?://[^\s<>"{}|\\^`\[\]]+$'
)


def validate_email(email: str, field_name: str = "email") -> str:
    """
    Validate email format.
    
    Args:
        email: Email address to validate
        field_name: Name of the field for error message
    
    Returns:
        The validated email (lowercase, stripped)
    
    Raises:
        ValidationError: If email format is invalid
    """
    email = email.strip().lower() if email else ""
    
    if not email:
        raise ValidationError(f"{field_name} is required", field=field_name)
    
    if not EMAIL_REGEX.match(email):
        raise ValidationError(f"Invalid {field_name} format", field=field_name)
    
    return email


def validate_url(url: str, field_name: str = "url") -> str:
    """
    Validate URL format.
    
    Args:
        url: URL to validate
        field_name: Name of the field for error message
    
    Returns:
        The validated URL (stripped)
    
    Raises:
        ValidationError: If URL format is invalid
    """
    url = url.strip() if url else ""
    
    if not url:
        raise ValidationError(f"{field_name} is required", field=field_name)
    
    if not URL_REGEX.match(url):
        raise ValidationError(f"Invalid {field_name} format", field=field_name)
    
    return url
