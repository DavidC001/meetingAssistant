"""
Core utilities for the Meeting Assistant application.

This package provides common utility functions organized by category:
- datetime: Date and time operations
- strings: String manipulation
- files: File operations

Usage:
    from app.core.utils import datetime_utils, string_utils, file_utils

    # Or import specific functions
    from app.core.utils.datetime import now_utc, format_datetime
    from app.core.utils.strings import slugify, truncate
    from app.core.utils.files import ensure_dir, get_file_size_mb
"""

# Re-export commonly used utilities for convenience
from .datetime import (
    days_ago,
    days_from_now,
    format_datetime,
    hms_to_seconds,
    now_utc,
    parse_date,
    parse_datetime,
    seconds_to_hms,
    today_utc,
)
from .files import (
    AUDIO_FORMATS,
    SUPPORTED_MEDIA_FORMATS,
    VIDEO_FORMATS,
    ensure_dir,
    get_file_extension,
    get_file_size,
    get_file_size_mb,
    is_audio_file,
    is_supported_media_file,
    is_video_file,
)
from .strings import (
    extract_emails,
    extract_urls,
    join_tags,
    parse_tags,
    remove_extra_whitespace,
    sanitize_filename,
    slugify,
    truncate,
)

__all__ = [
    # Datetime utilities
    "now_utc",
    "today_utc",
    "format_datetime",
    "parse_datetime",
    "parse_date",
    "seconds_to_hms",
    "hms_to_seconds",
    "days_ago",
    "days_from_now",
    # String utilities
    "truncate",
    "slugify",
    "sanitize_filename",
    "extract_emails",
    "extract_urls",
    "parse_tags",
    "join_tags",
    "remove_extra_whitespace",
    # File utilities
    "ensure_dir",
    "get_file_size",
    "get_file_size_mb",
    "get_file_extension",
    "is_audio_file",
    "is_video_file",
    "is_supported_media_file",
    "AUDIO_FORMATS",
    "VIDEO_FORMATS",
    "SUPPORTED_MEDIA_FORMATS",
]
