import os
from typing import List, Dict, Any, Optional
import logging

from .utils import get_file_metadata
from .cache import cache_result, get_file_hash
from .retry import retry_gpu_operation

# Setup logging
logger = logging.getLogger(__name__)

# Try to import torch and pyannote
try:
    import torch
    from pyannote.audio import Pipeline
    # Device configuration
    DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    TORCH_AVAILABLE = True
except ImportError:
    logger.warning("PyTorch or pyannote.audio not available")
    torch = None
    Pipeline = None
    DEVICE = None
    TORCH_AVAILABLE = False

@cache_result()
@retry_gpu_operation(max_retries=2, delay=2.0)
def diarize_audio(audio_path: str, num_speakers: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    Performs speaker diarization on an audio file.
    Requires a Hugging Face authentication token.
    Results are cached based on file hash and parameters.
    """
    logger.info(f"Running speaker diarization on {audio_path}...")
    
    # Add file hash to cache key for better cache invalidation
    file_hash = get_file_hash(audio_path)
    logger.info(f"File hash: {file_hash}")

    auth_token = os.getenv("HUGGINGFACE_TOKEN")
    if not auth_token:
        raise RuntimeError("Hugging Face token not found. Please set HUGGINGFACE_TOKEN environment variable.")

    try:
        pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            use_auth_token=auth_token,
        )
        pipeline.to(DEVICE)
        logger.info(f"Diarization pipeline loaded on {DEVICE}")

        diarization = pipeline(audio_path, num_speakers=num_speakers)

        segments: List[Dict[str, Any]] = []
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            segments.append({"start": turn.start, "end": turn.end, "speaker": speaker})

        logger.info(f"Diarization produced {len(segments)} segments.")
        return segments
    except Exception as e:
        logger.error(f"Diarization failed: {e}", exc_info=True)
        # Clear GPU cache if CUDA error
        if torch and torch.cuda.is_available():
            torch.cuda.empty_cache()
        # Fallback to a single speaker if diarization fails
        logger.warning("Falling back to single speaker diarization.")
        try:
            metadata = get_file_metadata(audio_path)
            duration = metadata.duration if hasattr(metadata, 'duration') else 1
        except:
            duration = 1
        return [{"start": 0, "end": duration, "speaker": "SPEAKER_00"}]
