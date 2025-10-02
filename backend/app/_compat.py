"""Runtime compatibility helpers for optional dependencies."""

from __future__ import annotations

from typing import Dict


def ensure_numpy_legacy_aliases() -> None:
    """Restore NumPy aliases that were removed in the 2.0 release.

    Several third-party libraries (for example :mod:`pyannote.audio`) still
    access camel-cased constants such as ``np.NaN`` that used to be available in
    NumPy 1.x. When those libraries run on NumPy 2.0+, importing them raises an
    :class:`AttributeError`. We proactively recreate the missing attributes so
    that the rest of the application can continue working without pinning an old
    NumPy version.
    """

    try:  # pragma: no cover - defensive guard for optional dependency
        import numpy as np
    except Exception:
        # NumPy is optional at runtime. If it is not installed we simply skip
        # the alias creation and let the caller fail with a clear error later.
        return

    alias_map: Dict[str, float] = {
        "NaN": np.nan,
        "NAN": np.nan,
        "Inf": np.inf,
        "PINF": np.inf,
        "NINF": -np.inf,
    }

    for alias, value in alias_map.items():
        if not hasattr(np, alias):
            try:
                setattr(np, alias, value)
            except Exception:
                # Setting attributes on the module should succeed, but we keep
                # the guard to avoid breaking initialization if it does not.
                pass


__all__ = ["ensure_numpy_legacy_aliases"]
