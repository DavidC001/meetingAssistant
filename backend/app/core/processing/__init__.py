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
"""

# Main pipeline
from .pipeline import run_processing_pipeline

# Transcription
from .transcription import (
    compile_transcript,
    compile_transcript_legacy,
    WhisperConfig,
)

# Diarization
from .diarization import diarize_audio

# Chunking
from .chunking import (
    Chunk,
    chunk_transcript,
    chunk_document,
    chunk_notes,
    chunk_summary,
    chunk_action_items,
)

# Transcript formatting
from .transcript_formatter import (
    format_transcript_grouped,
    convert_old_transcript_format,
    update_speaker_name_in_transcript,
)

# Document processing
from .document_processor import extract_text

# Progress tracking
from .timing import (
    DiarizationProgressTracker,
    estimate_diarization_time,
)

# Checkpointing
from .checkpoint import CheckpointManager

__all__ = [
    # Pipeline
    "run_processing_pipeline",
    # Transcription
    "compile_transcript",
    "compile_transcript_legacy",
    "WhisperConfig",
    # Diarization
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
