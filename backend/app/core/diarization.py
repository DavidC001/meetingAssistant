import os
import torch
from pyannote.audio import Pipeline
from typing import List, Dict, Any, Optional
import logging

from .utils import get_file_metadata

# Setup logging
logger = logging.getLogger(__name__)

# Device configuration
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

def diarize_audio(audio_path: str, num_speakers: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    Performs speaker diarization on an audio file.
    Requires a Hugging Face authentication token.
    """
    logger.info(f"Running speaker diarization on {audio_path}...")

    auth_token = os.getenv("HUGGINGFACE_TOKEN")
    if not auth_token:
        raise RuntimeError("Hugging Face token not found. Please set HUGGINGFACE_TOKEN environment variable.")

    try:
        pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            use_auth_token=auth_token,
        )
        pipeline.to(DEVICE)

        diarization = pipeline(audio_path, num_speakers=num_speakers)

        segments: List[Dict[str, Any]] = []
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            segments.append({"start": turn.start, "end": turn.end, "speaker": speaker})

        logger.info(f"Diarization produced {len(segments)} segments.")
        return segments
    except Exception as e:
        logger.error(f"Diarization failed: {e}", exc_info=True)
        # Fallback to a single speaker if diarization fails
        logger.warning("Falling back to single speaker diarization.")
        duration = get_file_metadata(audio_path).duration or 1
        return [{"start": 0, "end": duration, "speaker": "SPEAKER_00"}]
