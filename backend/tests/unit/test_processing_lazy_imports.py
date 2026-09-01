"""Regression guard for app.core.processing's lazy heavy-dependency imports.

app.core.processing.pipeline/transcription/diarization pull in torch,
faster_whisper, and pyannote.audio, which are only installed in the "heavy"
Docker image target (the `worker` service — see backend/Dockerfile). The API
and worker-light run the "light" target, which never installs those packages
(see backend/requirements-heavy.txt). app.core.processing.__init__ exposes
their exports lazily (PEP 562 __getattr__) precisely so that importing the
package — which happens at API/worker-light startup via app.tasks — doesn't
force those dependencies in.

This has to run in a subprocess: by the time any test function in this suite
executes, pytest has already collected every test module, including
tests/integration/test_audio_transcription_pipeline.py, which imports
app.core.processing.transcription directly at module scope. That import
happens during collection regardless of test order, so checking
sys.modules in-process would just be checking pollution from an unrelated
test file, not from the package under test.
"""

import subprocess
import sys

import pytest

_PACKAGE_IMPORT_ONLY = """
import sys
import app.core.processing  # noqa: F401

heavy = sorted(m for m in ("faster_whisper", "pyannote") if m in sys.modules)
print("HEAVY_MODULES=" + ",".join(heavy))
"""

_LAZY_ATTRS_RESOLVE = """
import app.core.processing as p

names = ["run_processing_pipeline", "compile_transcript", "compile_transcript_legacy",
         "WhisperConfig", "diarize_audio"]
missing = [n for n in names if not hasattr(p, n)]
print("MISSING=" + ",".join(missing))
"""


@pytest.mark.unit
def test_importing_package_does_not_load_heavy_dependencies():
    """Merely importing app.core.processing must not import faster_whisper/pyannote."""
    result = subprocess.run(
        [sys.executable, "-c", _PACKAGE_IMPORT_ONLY],
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 0, result.stderr
    output = dict(line.split("=", 1) for line in result.stdout.splitlines() if "=" in line)
    heavy_loaded = output.get("HEAVY_MODULES", "")
    assert heavy_loaded == "", f"Importing app.core.processing loaded heavy deps: {heavy_loaded}"


@pytest.mark.unit
def test_lazy_exports_are_resolvable_via_getattr():
    """Every documented __all__ export backed by a heavy submodule must still resolve."""
    result = subprocess.run(
        [sys.executable, "-c", _LAZY_ATTRS_RESOLVE],
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 0, result.stderr
    output = dict(line.split("=", 1) for line in result.stdout.splitlines() if "=" in line)
    missing = output.get("MISSING", "")
    assert missing == "", f"app.core.processing failed to resolve lazy attrs: {missing}"


@pytest.mark.unit
def test_getattr_raises_attribute_error_for_unknown_name():
    import app.core.processing as p

    with pytest.raises(AttributeError):
        _ = p.definitely_not_a_real_export
