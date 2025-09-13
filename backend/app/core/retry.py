import time
import logging
from functools import wraps
from typing import Callable, Tuple, Type, Any
import requests
import openai

logger = logging.getLogger(__name__)

def retry(
    max_retries: int = 3, 
    delay: float = 5.0, 
    backoff_factor: float = 2.0,
    exceptions: Tuple[Type[Exception], ...] = (Exception,),
    log_errors: bool = True
):
    """
    Decorator for retrying a function call with exponential backoff.
    
    Args:
        max_retries: Maximum number of retry attempts
        delay: Initial delay between retries in seconds
        backoff_factor: Multiplier for delay on each retry
        exceptions: Tuple of exception types to catch and retry
        log_errors: Whether to log error messages
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
                        logger.warning(
                            f"Attempt {attempt}/{max_retries} failed for {func.__name__}: {e}"
                        )
                    
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

# Specialized retry decorators for different types of operations

def retry_api_call(max_retries: int = 3, delay: float = 5.0):
    """Retry decorator specifically for API calls (OpenAI, Ollama, etc.)"""
    api_exceptions = (
        requests.exceptions.RequestException,
        requests.exceptions.Timeout,
        requests.exceptions.ConnectionError,
        ConnectionError,
        TimeoutError,
    )
    
    # Add OpenAI exceptions if available
    try:
        import openai
        api_exceptions += (
            openai.APIError,
            openai.APIConnectionError,
            openai.RateLimitError,
            openai.APITimeoutError,
        )
    except ImportError:
        pass
    
    return retry(
        max_retries=max_retries,
        delay=delay,
        backoff_factor=2.0,
        exceptions=api_exceptions,
        log_errors=True
    )

def retry_gpu_operation(max_retries: int = 2, delay: float = 2.0):
    """Retry decorator for GPU operations that might fail due to memory issues"""
    gpu_exceptions = (
        RuntimeError,  # CUDA out of memory, etc.
        torch.cuda.OutOfMemoryError if 'torch' in globals() else RuntimeError,
    )
    
    return retry(
        max_retries=max_retries,
        delay=delay,
        backoff_factor=1.5,
        exceptions=gpu_exceptions,
        log_errors=True
    )

def retry_file_operation(max_retries: int = 3, delay: float = 1.0):
    """Retry decorator for file operations that might fail due to I/O issues"""
    file_exceptions = (
        IOError,
        OSError,
        FileNotFoundError,
        PermissionError,
    )
    
    return retry(
        max_retries=max_retries,
        delay=delay,
        backoff_factor=1.2,
        exceptions=file_exceptions,
        log_errors=True
    )

# Import torch conditionally for GPU operations
try:
    import torch
except ImportError:
    torch = None
