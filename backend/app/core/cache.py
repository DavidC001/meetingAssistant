import hashlib
import pickle
import logging
from pathlib import Path
from functools import wraps
from typing import Any, Callable
import os

logger = logging.getLogger(__name__)

# Configuration directory for cache
CACHE_DIR = Path(os.getenv("CACHE_DIR", "/app/cache"))
CACHE_DIR.mkdir(parents=True, exist_ok=True)

def get_file_hash(file_path: str | Path) -> str:
    """Calculate SHA256 hash of a file."""
    hash_sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_sha256.update(chunk)
    return hash_sha256.hexdigest()

def cache_result(cache_dir: Path = CACHE_DIR, enabled: bool = True):
    """Decorator for caching function results."""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            if not enabled or not os.getenv("CACHE_ENABLED", "true").lower() == "true":
                return func(*args, **kwargs)
                
            # Create a unique cache key based on function name and arguments
            args_str = "_".join(str(arg) for arg in args)
            kwargs_str = "_".join(f"{k}={v}" for k, v in sorted(kwargs.items()))
            cache_key = f"{func.__name__}_{hashlib.md5((args_str + kwargs_str).encode()).hexdigest()}"
            cache_file = cache_dir / f"{cache_key}.pkl"
            
            # Check if result is cached
            if cache_file.exists():
                try:
                    with open(cache_file, "rb") as f:
                        result = pickle.load(f)
                    logger.info(f"Using cached result for {func.__name__}")
                    return result
                except Exception as e:
                    logger.warning(f"Failed to load cached result: {e}")
                    # Remove corrupted cache file
                    try:
                        cache_file.unlink()
                    except:
                        pass
            
            # Compute and cache the result
            result = func(*args, **kwargs)
            try:
                # Ensure cache directory exists
                cache_dir.mkdir(parents=True, exist_ok=True)
                with open(cache_file, "wb") as f:
                    pickle.dump(result, f)
                logger.info(f"Cached result for {func.__name__}")
            except Exception as e:
                logger.warning(f"Failed to cache result: {e}")
                
            return result
        return wrapper
    return decorator

def clear_cache(cache_dir: Path = CACHE_DIR) -> int:
    """Clear all cached results and return number of files deleted."""
    deleted_count = 0
    try:
        for cache_file in cache_dir.glob("*.pkl"):
            cache_file.unlink()
            deleted_count += 1
        logger.info(f"Cleared {deleted_count} cached files")
    except Exception as e:
        logger.error(f"Error clearing cache: {e}")
    return deleted_count

def get_cache_info(cache_dir: Path = CACHE_DIR) -> dict:
    """Get information about the cache."""
    try:
        cache_files = list(cache_dir.glob("*.pkl"))
        total_size = sum(f.stat().st_size for f in cache_files)
        return {
            "cache_dir": str(cache_dir),
            "file_count": len(cache_files),
            "total_size_mb": round(total_size / (1024 * 1024), 2),
            "enabled": os.getenv("CACHE_ENABLED", "true").lower() == "true"
        }
    except Exception as e:
        logger.error(f"Error getting cache info: {e}")
        return {"error": str(e)}
