"""
Date and time utility functions.

Provides common date/time operations for the application.
"""

from datetime import date, datetime, timedelta

import pytz


def now_utc() -> datetime:
    """
    Get current datetime in UTC.

    Returns:
        Current UTC datetime
    """
    return datetime.now(pytz.UTC)


def today_utc() -> date:
    """
    Get current date in UTC.

    Returns:
        Current UTC date
    """
    return datetime.now(pytz.UTC).date()


def format_datetime(dt: datetime, fmt: str = "%Y-%m-%d %H:%M:%S") -> str:
    """
    Format datetime to string.

    Args:
        dt: Datetime to format
        fmt: Format string (default: ISO-like format)

    Returns:
        Formatted datetime string
    """
    return dt.strftime(fmt)


def parse_datetime(dt_str: str, fmt: str = "%Y-%m-%d %H:%M:%S") -> datetime:
    """
    Parse datetime from string.

    Args:
        dt_str: Datetime string to parse
        fmt: Format string (default: ISO-like format)

    Returns:
        Parsed datetime

    Raises:
        ValueError: If string doesn't match format
    """
    return datetime.strptime(dt_str, fmt)


def parse_date(date_str: str, fmt: str = "%Y-%m-%d") -> date:
    """
    Parse date from string.

    Args:
        date_str: Date string to parse
        fmt: Format string (default: ISO date)

    Returns:
        Parsed date

    Raises:
        ValueError: If string doesn't match format
    """
    return datetime.strptime(date_str, fmt).date()


def get_date_range(
    start_date: date | None = None, end_date: date | None = None, days: int | None = None
) -> tuple[date, date]:
    """
    Get a date range.

    If start_date is not provided, uses today.
    If end_date is not provided but days is, calculates end_date.
    If neither end_date nor days is provided, uses start_date as end_date.

    Args:
        start_date: Start date (default: today)
        end_date: End date (optional)
        days: Number of days from start_date (optional)

    Returns:
        Tuple of (start_date, end_date)

    Example:
        >>> get_date_range(days=7)  # Last 7 days
        >>> get_date_range(start_date=date(2024, 1, 1), days=30)  # January 2024
    """
    if start_date is None:
        start_date = today_utc()

    if end_date is None:
        end_date = start_date + timedelta(days=days) if days is not None else start_date

    return start_date, end_date


def is_recent(dt: datetime, hours: int = 24) -> bool:
    """
    Check if datetime is within the last N hours.

    Args:
        dt: Datetime to check
        hours: Number of hours to consider recent

    Returns:
        True if datetime is within the last N hours
    """
    cutoff = now_utc() - timedelta(hours=hours)
    return dt >= cutoff


def days_ago(days: int) -> date:
    """
    Get date N days ago.

    Args:
        days: Number of days in the past

    Returns:
        Date N days ago
    """
    return today_utc() - timedelta(days=days)


def days_from_now(days: int) -> date:
    """
    Get date N days from now.

    Args:
        days: Number of days in the future

    Returns:
        Date N days from now
    """
    return today_utc() + timedelta(days=days)


def get_week_start(dt: date | None = None) -> date:
    """
    Get the start of the week (Monday) for a given date.

    Args:
        dt: Date (default: today)

    Returns:
        Monday of the week containing the date
    """
    if dt is None:
        dt = today_utc()

    # Monday is 0, Sunday is 6
    days_since_monday = dt.weekday()
    return dt - timedelta(days=days_since_monday)


def get_month_start(dt: date | None = None) -> date:
    """
    Get the first day of the month for a given date.

    Args:
        dt: Date (default: today)

    Returns:
        First day of the month
    """
    if dt is None:
        dt = today_utc()

    return dt.replace(day=1)


def seconds_to_hms(seconds: float) -> str:
    """
    Convert seconds to HH:MM:SS format.

    Args:
        seconds: Number of seconds

    Returns:
        Formatted time string

    Example:
        >>> seconds_to_hms(3665)
        '01:01:05'
    """
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}"


def hms_to_seconds(time_str: str) -> float:
    """
    Convert HH:MM:SS format to seconds.

    Args:
        time_str: Time string in HH:MM:SS format

    Returns:
        Number of seconds

    Example:
        >>> hms_to_seconds('01:01:05')
        3665.0
    """
    parts = time_str.split(":")
    if len(parts) != 3:
        raise ValueError(f"Invalid time format: {time_str}. Expected HH:MM:SS")

    hours, minutes, seconds = map(int, parts)
    return hours * 3600 + minutes * 60 + seconds
