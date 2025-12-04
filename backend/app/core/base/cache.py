"""
Caching utilities for expensive operations.

Provides decorators and utilities for caching:
- Function results
- File-based caching
- Cache management

Usage:
    from app.core.base import cache_result, file_cache
    
    @cache_result(ttl_seconds=3600)
    def expensive_computation(param):
        ...
"""

import os
import json
import hashlib
import logging
from pathlib import Path
from datetime import datetime, timedelta
from functools import wraps
from typing import Callable, Any, Optional, Dict
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# In-memory cache storage
_memory_cache: Dict[str, Any] = {}
_cache_timestamps: Dict[str, datetime] = {}


@dataclass
class CacheInfo:
    """Information about a cache entry."""
    key: str
    created_at: datetime
    expires_at: Optional[datetime]
    size_bytes: int
    hit_count: int = 0


def get_file_hash(file_path: str | Path) -> str:
    """Calculate SHA256 hash of a file.
    
    Args:
        file_path: Path to the file to hash
        
    Returns:
        Hexadecimal string of the SHA256 hash
    """
    hash_sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_sha256.update(chunk)
    return hash_sha256.hexdigest()


def _generate_cache_key(func_name: str, args: tuple, kwargs: dict) -> str:
    """Generate a unique cache key from function name and arguments."""
    # Create a stable string representation
    key_data = {
        "func": func_name,
        "args": str(args),
        "kwargs": str(sorted(kwargs.items())),
    }
    key_string = json.dumps(key_data, sort_keys=True)
    return hashlib.md5(key_string.encode()).hexdigest()


def cache_result(
    ttl_seconds: int = 3600,
    key_prefix: str = "",
    ignore_args: bool = False
):
    """
    Decorator to cache function results in memory.
    
    Args:
        ttl_seconds: Time-to-live for cached results in seconds
        key_prefix: Optional prefix for cache keys
        ignore_args: If True, cache key is only based on function name
    
    Usage:
        @cache_result(ttl_seconds=300)
        def get_settings():
            ...
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            # Generate cache key
            if ignore_args:
                cache_key = f"{key_prefix}:{func.__name__}"
            else:
                cache_key = f"{key_prefix}:{_generate_cache_key(func.__name__, args, kwargs)}"
            
            # Check if cached and not expired
            if cache_key in _memory_cache:
                cached_time = _cache_timestamps.get(cache_key)
                if cached_time and datetime.now() - cached_time < timedelta(seconds=ttl_seconds):
                    logger.debug(f"Cache hit for {func.__name__}")
                    return _memory_cache[cache_key]
                else:
                    # Expired, remove from cache
                    _memory_cache.pop(cache_key, None)
                    _cache_timestamps.pop(cache_key, None)
            
            # Execute function and cache result
            result = func(*args, **kwargs)
            _memory_cache[cache_key] = result
            _cache_timestamps[cache_key] = datetime.now()
            logger.debug(f"Cached result for {func.__name__}")
            
            return result
        
        # Add cache management methods
        wrapper.cache_clear = lambda: _clear_function_cache(func.__name__, key_prefix)
        wrapper.cache_info = lambda: _get_function_cache_info(func.__name__, key_prefix)
        
        return wrapper
    return decorator


def _clear_function_cache(func_name: str, key_prefix: str) -> int:
    """Clear cache entries for a specific function."""
    prefix = f"{key_prefix}:" if key_prefix else ""
    keys_to_remove = [
        k for k in _memory_cache.keys()
        if k.startswith(f"{prefix}{func_name}") or f":{func_name}" in k
    ]
    for key in keys_to_remove:
        _memory_cache.pop(key, None)
        _cache_timestamps.pop(key, None)
    return len(keys_to_remove)


def _get_function_cache_info(func_name: str, key_prefix: str) -> Dict[str, Any]:
    """Get cache information for a specific function."""
    prefix = f"{key_prefix}:" if key_prefix else ""
    matching_keys = [
        k for k in _memory_cache.keys()
        if k.startswith(f"{prefix}{func_name}") or f":{func_name}" in k
    ]
    return {
        "cached_entries": len(matching_keys),
        "keys": matching_keys,
    }


def clear_cache(prefix: Optional[str] = None) -> int:
    """
    Clear cache entries.
    
    Args:
        prefix: Optional prefix to clear only matching entries
    
    Returns:
        Number of cleared entries
    """
    if prefix is None:
        count = len(_memory_cache)
        _memory_cache.clear()
        _cache_timestamps.clear()
        logger.info(f"Cleared all {count} cache entries")
        return count
    
    keys_to_remove = [k for k in _memory_cache.keys() if k.startswith(prefix)]
    for key in keys_to_remove:
        _memory_cache.pop(key, None)
        _cache_timestamps.pop(key, None)
    
    logger.info(f"Cleared {len(keys_to_remove)} cache entries with prefix '{prefix}'")
    return len(keys_to_remove)


def get_cache_info() -> Dict[str, Any]:
    """
    Get overall cache statistics.
    
    Returns:
        Dictionary with cache statistics
    """
    now = datetime.now()
    expired_count = sum(
        1 for ts in _cache_timestamps.values()
        if now - ts > timedelta(hours=1)  # Assuming 1 hour default TTL
    )
    
    return {
        "total_entries": len(_memory_cache),
        "total_size_estimate": sum(
            len(str(v)) for v in _memory_cache.values()
        ),
        "potentially_expired": expired_count,
    }


# =============================================================================
# File-based caching
# =============================================================================

class FileCache:
    """
    File-based cache for larger objects that shouldn't be kept in memory.
    
    Usage:
        cache = FileCache(cache_dir="/app/cache")
        cache.set("key", data)
        data = cache.get("key")
    """
    
    def __init__(self, cache_dir: str, default_ttl_seconds: int = 86400):
        """
        Initialize file cache.
        
        Args:
            cache_dir: Directory to store cache files
            default_ttl_seconds: Default TTL for cache entries (24 hours)
        """
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.default_ttl = default_ttl_seconds
        self.metadata_file = self.cache_dir / ".cache_metadata.json"
        self._load_metadata()
    
    def _load_metadata(self) -> None:
        """Load cache metadata from disk."""
        if self.metadata_file.exists():
            try:
                with open(self.metadata_file, 'r') as f:
                    self.metadata = json.load(f)
            except (json.JSONDecodeError, IOError):
                self.metadata = {}
        else:
            self.metadata = {}
    
    def _save_metadata(self) -> None:
        """Save cache metadata to disk."""
        try:
            with open(self.metadata_file, 'w') as f:
                json.dump(self.metadata, f)
        except IOError as e:
            logger.warning(f"Failed to save cache metadata: {e}")
    
    def _get_file_path(self, key: str) -> Path:
        """Get the file path for a cache key."""
        # Use hash for filename to avoid special characters
        hashed_key = hashlib.sha256(key.encode()).hexdigest()
        return self.cache_dir / f"{hashed_key}.cache"
    
    def get(self, key: str, default: Any = None) -> Any:
        """
        Get a cached value.
        
        Args:
            key: Cache key
            default: Default value if not found or expired
        
        Returns:
            Cached value or default
        """
        file_path = self._get_file_path(key)
        
        if not file_path.exists():
            return default
        
        # Check expiration
        meta = self.metadata.get(key, {})
        if meta:
            expires_at = meta.get("expires_at")
            if expires_at and datetime.fromisoformat(expires_at) < datetime.now():
                # Expired
                self.delete(key)
                return default
        
        try:
            with open(file_path, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return default
    
    def set(self, key: str, value: Any, ttl_seconds: Optional[int] = None) -> None:
        """
        Set a cached value.
        
        Args:
            key: Cache key
            value: Value to cache (must be JSON serializable)
            ttl_seconds: Optional TTL override
        """
        file_path = self._get_file_path(key)
        ttl = ttl_seconds or self.default_ttl
        
        try:
            with open(file_path, 'w') as f:
                json.dump(value, f)
            
            self.metadata[key] = {
                "created_at": datetime.now().isoformat(),
                "expires_at": (datetime.now() + timedelta(seconds=ttl)).isoformat(),
                "file_path": str(file_path),
            }
            self._save_metadata()
        except (IOError, TypeError) as e:
            logger.warning(f"Failed to cache value for key '{key}': {e}")
    
    def delete(self, key: str) -> bool:
        """
        Delete a cached value.
        
        Args:
            key: Cache key
        
        Returns:
            True if deleted, False if not found
        """
        file_path = self._get_file_path(key)
        
        if file_path.exists():
            try:
                os.remove(file_path)
            except OSError:
                pass
        
        if key in self.metadata:
            del self.metadata[key]
            self._save_metadata()
            return True
        
        return False
    
    def clear(self) -> int:
        """
        Clear all cached values.
        
        Returns:
            Number of entries cleared
        """
        count = 0
        for file_path in self.cache_dir.glob("*.cache"):
            try:
                os.remove(file_path)
                count += 1
            except OSError:
                pass
        
        self.metadata = {}
        self._save_metadata()
        return count
    
    def cleanup_expired(self) -> int:
        """
        Remove expired cache entries.
        
        Returns:
            Number of entries removed
        """
        now = datetime.now()
        expired_keys = []
        
        for key, meta in self.metadata.items():
            expires_at = meta.get("expires_at")
            if expires_at and datetime.fromisoformat(expires_at) < now:
                expired_keys.append(key)
        
        for key in expired_keys:
            self.delete(key)
        
        return len(expired_keys)


# Global file cache instance (can be initialized by the application)
file_cache: Optional[FileCache] = None


def init_file_cache(cache_dir: str, default_ttl_seconds: int = 86400) -> FileCache:
    """
    Initialize the global file cache.
    
    Args:
        cache_dir: Directory to store cache files
        default_ttl_seconds: Default TTL for cache entries
    
    Returns:
        The initialized FileCache instance
    """
    global file_cache
    file_cache = FileCache(cache_dir, default_ttl_seconds)
    return file_cache
