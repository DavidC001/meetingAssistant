"""
Structured logging configuration using structlog.

Provides JSON-formatted logging with request context, performance metrics,
and structured fields for easy parsing and analysis.

Usage:
    from app.core.logging import get_logger

    logger = get_logger(__name__)
    logger.info("user_login", user_id=user.id, ip_address=request.client.host)
"""

import logging
import sys
from typing import Any

import structlog
from structlog.types import EventDict, Processor

from .config import AppConfig


def add_app_context(logger: Any, method_name: str, event_dict: EventDict) -> EventDict:
    """
    Add application-wide context to log entries.

    Args:
        logger: Logger instance
        method_name: Method name
        event_dict: Event dictionary

    Returns:
        Modified event dictionary with app context
    """
    event_dict["app"] = "meeting-assistant"
    return event_dict


def add_severity_level(logger: Any, method_name: str, event_dict: EventDict) -> EventDict:
    """
    Add severity level for Cloud Logging compatibility.

    Maps Python log levels to Google Cloud severity levels.

    Args:
        logger: Logger instance
        method_name: Method name
        event_dict: Event dictionary

    Returns:
        Modified event dictionary with severity
    """
    level = event_dict.get("level", "").upper()
    severity_map = {
        "DEBUG": "DEBUG",
        "INFO": "INFO",
        "WARNING": "WARNING",
        "ERROR": "ERROR",
        "CRITICAL": "CRITICAL",
    }
    event_dict["severity"] = severity_map.get(level, "INFO")
    return event_dict


def configure_logging(config: AppConfig) -> None:
    """
    Configure structured logging for the application.

    Sets up structlog with JSON formatting in production and
    human-readable formatting in development.

    Args:
        config: Application configuration
    """
    # Determine if we should use JSON formatting
    use_json = not config.debug  # Use JSON when not in debug mode

    # Common processors for all environments
    shared_processors: list[Processor] = [
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        add_app_context,
        add_severity_level,
    ]

    if use_json:
        # Production: JSON formatting
        structlog.configure(
            processors=shared_processors
            + [
                structlog.processors.dict_tracebacks,
                structlog.processors.JSONRenderer(),
            ],
            wrapper_class=structlog.stdlib.BoundLogger,
            context_class=dict,
            logger_factory=structlog.stdlib.LoggerFactory(),
            cache_logger_on_first_use=True,
        )
    else:
        # Development: Human-readable formatting with colors
        structlog.configure(
            processors=shared_processors
            + [
                structlog.processors.dict_tracebacks,
                structlog.dev.ConsoleRenderer(colors=True),
            ],
            wrapper_class=structlog.stdlib.BoundLogger,
            context_class=dict,
            logger_factory=structlog.stdlib.LoggerFactory(),
            cache_logger_on_first_use=True,
        )

    # Configure standard logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=logging.DEBUG if config.debug else logging.INFO,
    )

    # Reduce noise from third-party libraries
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("asyncio").setLevel(logging.WARNING)


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    """
    Get a structured logger instance.

    Args:
        name: Logger name (typically __name__)

    Returns:
        Bound logger instance

    Example:
        >>> logger = get_logger(__name__)
        >>> logger.info("operation_completed", duration_ms=150, user_id=123)
    """
    return structlog.get_logger(name)


class LoggerContext:
    """
    Context manager for temporary logger context.

    Allows adding context fields that will be included in all
    log statements within the context.

    Example:
        >>> logger = get_logger(__name__)
        >>> with LoggerContext(logger, request_id="abc123", user_id=456):
        ...     logger.info("processing_request")  # Includes request_id and user_id
    """

    def __init__(self, logger: structlog.stdlib.BoundLogger, **context: Any):
        """
        Initialize logger context.

        Args:
            logger: Logger instance
            **context: Context fields to add
        """
        self.logger = logger
        self.context = context
        self.bound_logger = None

    def __enter__(self) -> structlog.stdlib.BoundLogger:
        """Enter context and return bound logger."""
        self.bound_logger = self.logger.bind(**self.context)
        return self.bound_logger

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Exit context."""
        pass


def log_performance(logger: structlog.stdlib.BoundLogger, operation: str, duration_ms: float, **extra: Any) -> None:
    """
    Log performance metrics in a structured format.

    Args:
        logger: Logger instance
        operation: Name of the operation
        duration_ms: Duration in milliseconds
        **extra: Additional fields to include

    Example:
        >>> logger = get_logger(__name__)
        >>> log_performance(
        ...     logger,
        ...     "database_query",
        ...     duration_ms=42.5,
        ...     query_type="select",
        ...     rows_returned=150
        ... )
    """
    logger.info("performance_metric", operation=operation, duration_ms=duration_ms, **extra)


def log_api_request(
    logger: structlog.stdlib.BoundLogger, method: str, path: str, status_code: int, duration_ms: float, **extra: Any
) -> None:
    """
    Log API request in a structured format.

    Args:
        logger: Logger instance
        method: HTTP method
        path: Request path
        status_code: Response status code
        duration_ms: Request duration in milliseconds
        **extra: Additional fields to include

    Example:
        >>> logger = get_logger(__name__)
        >>> log_api_request(
        ...     logger,
        ...     method="GET",
        ...     path="/api/v1/meetings",
        ...     status_code=200,
        ...     duration_ms=125.5,
        ...     user_id=123
        ... )
    """
    logger.info("api_request", method=method, path=path, status_code=status_code, duration_ms=duration_ms, **extra)


def log_error(logger: structlog.stdlib.BoundLogger, error_type: str, error_message: str, **extra: Any) -> None:
    """
    Log error in a structured format.

    Args:
        logger: Logger instance
        error_type: Type/category of error
        error_message: Error message
        **extra: Additional fields to include

    Example:
        >>> logger = get_logger(__name__)
        >>> log_error(
        ...     logger,
        ...     error_type="validation_error",
        ...     error_message="Invalid email format",
        ...     field="email",
        ...     value="invalid@"
        ... )
    """
    logger.error("error_occurred", error_type=error_type, error_message=error_message, **extra)
