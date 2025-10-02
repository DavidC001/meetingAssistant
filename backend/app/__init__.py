"""Application package initialisation."""

from __future__ import annotations

from ._compat import ensure_numpy_legacy_aliases as _ensure_numpy_legacy_aliases

# Apply runtime compatibility shims before any submodules are imported. This is
# idempotent and safe to call multiple times.
_ensure_numpy_legacy_aliases()

__all__ = []
