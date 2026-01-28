"""
Retry decorators for handling transient failures.

Provides retry functionality with exponential backoff for:
- API calls (OpenAI, Ollama, etc.)
- GPU operations
- File operations
- Network requests

Usage:
    from app.core.base import retry, retry_api_call

    @retry_api_call(max_retries=3)
    def call_llm_api():
        ...
"""

import logging
import time
from collections.abc import Callable
from functools import wraps
from typing import Any

logger = logging.getLogger(__name__)


def retry(
    max_retries: int = 3,
    delay: float = 5.0,
    backoff_factor: float = 2.0,
    exceptions: tuple[type[Exception], ...] = (Exception,),
    log_errors: bool = True,
    on_retry: Callable[[Exception, int], None] | None = None,
):
    """
    Decorator for retrying a function call with exponential backoff.

    Args:
        max_retries: Maximum number of retry attempts
        delay: Initial delay between retries in seconds
        backoff_factor: Multiplier for delay on each retry
        exceptions: Tuple of exception types to catch and retry
        log_errors: Whether to log error messages
        on_retry: Optional callback called on each retry (exception, attempt)

    Usage:
        @retry(max_retries=3, delay=2.0)
        def unstable_function():
            ...
    """

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            last_exception = None
            current_delay = delay

            for attempt in range(1, max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e

                    if log_errors:
                        logger.warning(f"Attempt {attempt}/{max_retries} failed for {func.__name__}: {e}")

                    if on_retry:
                        on_retry(e, attempt)

                    if attempt < max_retries:
                        if log_errors:
                            logger.info(f"Retrying in {current_delay:.1f} seconds...")
                        time.sleep(current_delay)
                        current_delay *= backoff_factor
                    else:
                        if log_errors:
                            logger.error(f"All {max_retries} attempts failed for {func.__name__}")
                except Exception as e:
                    # Don't retry for unexpected exceptions
                    logger.error(f"Unexpected error in {func.__name__}: {e}")
                    raise

            raise last_exception

        return wrapper

    return decorator


def retry_api_call(max_retries: int = 3, delay: float = 5.0):
    """
    Retry decorator specifically for API calls (OpenAI, Ollama, etc.).

    Handles common API-related exceptions including:
    - Connection errors
    - Timeout errors
    - Rate limiting

    Args:
        max_retries: Maximum number of retry attempts
        delay: Initial delay between retries
    """
    api_exceptions = [
        ConnectionError,
        TimeoutError,
    ]

    # Add requests exceptions if available
    try:
        import requests

        api_exceptions.extend(
            [
                requests.exceptions.RequestException,
                requests.exceptions.Timeout,
                requests.exceptions.ConnectionError,
            ]
        )
    except ImportError:
        pass

    # Add OpenAI exceptions if available
    try:
        import openai

        api_exceptions.extend(
            [
                openai.APIError,
                openai.APIConnectionError,
                openai.RateLimitError,
                openai.APITimeoutError,
            ]
        )
    except ImportError:
        pass

    return retry(
        max_retries=max_retries, delay=delay, backoff_factor=2.0, exceptions=tuple(api_exceptions), log_errors=True
    )


def retry_gpu_operation(max_retries: int = 2, delay: float = 2.0):
    """
    Retry decorator for GPU operations that might fail due to memory issues.

    Handles CUDA out of memory and similar GPU-related errors.

    Args:
        max_retries: Maximum number of retry attempts
        delay: Initial delay between retries
    """
    gpu_exceptions = [RuntimeError]  # CUDA out of memory raises RuntimeError

    # Add torch CUDA exceptions if available
    try:
        import torch

        if hasattr(torch.cuda, "OutOfMemoryError"):
            gpu_exceptions.append(torch.cuda.OutOfMemoryError)
    except ImportError:
        pass

    return retry(
        max_retries=max_retries, delay=delay, backoff_factor=1.5, exceptions=tuple(gpu_exceptions), log_errors=True
    )


def retry_file_operation(max_retries: int = 3, delay: float = 1.0):
    """
    Retry decorator for file operations that might fail due to locks or permissions.

    Handles:
    - Permission errors
    - File busy errors
    - OS errors

    Args:
        max_retries: Maximum number of retry attempts
        delay: Initial delay between retries
    """
    file_exceptions = (
        PermissionError,
        OSError,
        IOError,
    )

    return retry(max_retries=max_retries, delay=delay, backoff_factor=2.0, exceptions=file_exceptions, log_errors=True)


def retry_with_fallback(
    primary_func: Callable,
    fallback_func: Callable,
    exceptions: tuple[type[Exception], ...] = (Exception,),
    max_retries: int = 1,
    log_fallback: bool = True,
) -> Any:
    """
    Execute primary function with retry, falling back to secondary if all retries fail.

    Useful for provider failover (e.g., try OpenAI, fallback to Ollama).

    Args:
        primary_func: Primary function to try
        fallback_func: Fallback function if primary fails
        exceptions: Exceptions to catch
        max_retries: Retries for primary before fallback
        log_fallback: Whether to log fallback usage

    Returns:
        Result from primary or fallback function
    """
    for attempt in range(max_retries):
        try:
            return primary_func()
        except exceptions as e:
            logger.warning(f"Primary function failed (attempt {attempt + 1}): {e}")
            if attempt == max_retries - 1:
                if log_fallback:
                    logger.info("Falling back to secondary function")
                return fallback_func()
