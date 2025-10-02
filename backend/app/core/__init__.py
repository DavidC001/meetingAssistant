"""Core package initialisation and shared helpers."""

from __future__ import annotations

from .._compat import ensure_numpy_legacy_aliases as _ensure_numpy_legacy_aliases

# Ensure compatibility shims are applied even when the core package is imported
# directly. Calling the helper is idempotent so repeated imports are safe.
_ensure_numpy_legacy_aliases()

__all__ = []
