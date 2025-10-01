"""Core package initialization with compatibility helpers."""

from __future__ import annotations

# NOTE: `pyannote.audio` (used for diarization) still references the deprecated
# `np.NaN` attribute that was removed in NumPy 2.0. Importing the library would
# therefore raise an `AttributeError` and break the processing pipeline.
#
# To keep the dependency working without requiring older NumPy versions, we
# create the missing alias once during package initialisation. NumPy allows
# setting new attributes on the module, so we simply point `np.NaN` to the
# canonical `np.nan` value when needed.
try:  # pragma: no cover - defensive compatibility shim
    import numpy as _np

    if not hasattr(_np, "NaN"):
        setattr(_np, "NaN", _np.nan)
except Exception:  # pragma: no cover - importing numpy should not fail
    # If NumPy is not available for some reason we silently continue. The
    # subsequent imports will fail in a more informative way.
    pass

__all__ = []

