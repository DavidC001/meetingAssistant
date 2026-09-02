"""
Processing pipeline module.

This subpackage contains all media processing functionality:
- Audio/video transcription
- Speaker diarization
- Text chunking
- Document processing
- Transcript formatting

Re-exports from existing modules for a cleaner API:
    from app.core.processing import run_processing_pipeline
    from app.core.processing import diarize_audio
    from app.core.processing import chunk_transcript

Note on lazy imports: `pipeline`, `transcription`, and `diarization` pull in
torch/faster-whisper/pyannote, which are only installed in the "heavy" Docker
image (see backend/Dockerfile). Their exports are loaded lazily via
module-level __getattr__ (PEP 562) so that `import app.core.processing` —
which happens at API/worker-light startup via app.tasks — does not force
those dependencies into the "light" image. Everything else here has no heavy
imports and stays eager.
"""

# Checkpointing
from .checkpoint import CheckpointManager

# Chunking
from .chunking import (
    Chunk,
    chunk_action_items,
    chunk_document,
    chunk_notes,
    chunk_summary,
    chunk_transcript,
)

# Document processing
from .document_processor import extract_text

# Progress tracking
from .timing import (
    DiarizationProgressTracker,
    estimate_diarization_time,
)

# Transcript formatting
from .transcript_formatter import (
    convert_old_transcript_format,
    format_transcript_grouped,
    update_speaker_name_in_transcript,
)

__all__ = [
    # Pipeline (lazy)
    "run_processing_pipeline",
    # Transcription (lazy)
    "compile_transcript",
    "compile_transcript_legacy",
    "WhisperConfig",
    # Diarization (lazy)
    "diarize_audio",
    # Chunking
    "Chunk",
    "chunk_transcript",
    "chunk_document",
    "chunk_notes",
    "chunk_summary",
    "chunk_action_items",
    # Formatting
    "format_transcript_grouped",
    "convert_old_transcript_format",
    "update_speaker_name_in_transcript",
    # Document processing
    "extract_text",
    # Progress
    "DiarizationProgressTracker",
    "estimate_diarization_time",
    # Checkpoint
    "CheckpointManager",
]

# Name -> (submodule, attribute) for lazily-imported, heavy-dependency exports.
_LAZY_ATTRS = {
    "run_processing_pipeline": (".pipeline", "run_processing_pipeline"),
    "compile_transcript": (".transcription", "compile_transcript"),
    "compile_transcript_legacy": (".transcription", "compile_transcript_legacy"),
    "WhisperConfig": (".transcription", "WhisperConfig"),
    "diarize_audio": (".diarization", "diarize_audio"),
}


def __getattr__(name: str):
    """PEP 562 lazy attribute access for heavy-dependency submodules.

    Deferring these imports until first use keeps `torch`, `faster_whisper`,
    and `pyannote.audio` out of process memory (and out of the "light" Docker
    image's requirements) unless something actually needs the transcription/
    diarization pipeline.
    """
    target = _LAZY_ATTRS.get(name)
    if target is None:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

    module_name, attr_name = target
    import importlib

    module = importlib.import_module(module_name, __name__)
    value = getattr(module, attr_name)
    globals()[name] = value  # cache on the package module for subsequent lookups
    return value


def __dir__():
    return sorted(set(globals()) | set(__all__))
