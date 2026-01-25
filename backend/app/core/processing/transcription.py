import tempfile
import hashlib
import os
from pathlib import Path
from typing import List, Dict, Any, Tuple, Callable, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
from functools import lru_cache
import logging
import torch
from faster_whisper import WhisperModel
from tqdm import tqdm

from ..base.utils import _run_ffmpeg
from ..base.cache import cache_result, get_file_hash
from .transcript_formatter import format_transcript_grouped

# Setup logging
logger = logging.getLogger(__name__)

# Constants
MIN_SLICE_SEC = 0.20  # avoid zero-length clips

def _get_device():
    """
    Get the appropriate device for the current process.
    With solo pool, we can safely use CUDA in worker processes.
    """
    # Check if CPU-only mode is forced
    if os.getenv('FORCE_CPU', '').lower() in ['true', '1', 'yes']:
        logger.info("FORCE_CPU enabled, using CPU device")
        return torch.device("cpu")
    
    try:
        if torch.cuda.is_available():
            # Test CUDA initialization
            device = torch.device("cuda")
            # Try to allocate a small tensor to verify CUDA works
            test_tensor = torch.zeros(1, device=device)
            # Test a simple operation to ensure cuDNN works
            test_tensor = test_tensor + 1
            del test_tensor
            torch.cuda.empty_cache()
            logger.info(f"CUDA is available and working, using GPU")
            return device
    except Exception as e:
        logger.warning(f"CUDA initialization failed: {e}, falling back to CPU")
        # Force fallback to CPU for all future operations in this process
        os.environ["CUDA_VISIBLE_DEVICES"] = ""
    
    logger.info("Using CPU device")
    return torch.device("cpu")

DEVICE = _get_device()

@lru_cache(maxsize=3)  # Increased cache size to support multiple models
def _load_whisper(model_size: str = "base", provider: str = "faster-whisper") -> WhisperModel:
    """Loads the whisper model with configurable provider and size."""
    # Get device fresh each time to handle process forking
    device = _get_device()
    logger.info(f"Loading whisper model '{model_size}' ({provider}) on {device.type}...")
    
    # Use persistent cache directory for model downloads
    cache_dir = Path("/app/cache/models/whisper")
    cache_dir.mkdir(parents=True, exist_ok=True)
    
    # Adjust compute_type based on device
    compute_type = "int8" if device.type == "cpu" else "float16"
    
    try:
        if provider == "faster-whisper":
            model = WhisperModel(
                model_size, 
                device=device.type, 
                compute_type=compute_type,
                download_root=str(cache_dir)
            )
        else:
            # For future extensibility, could add other providers here
            logger.warning(f"Unknown provider '{provider}', falling back to faster-whisper")
            model = WhisperModel(
                model_size, 
                device=device.type, 
                compute_type=compute_type,
                download_root=str(cache_dir)
            )
            
        logger.info(f"Whisper model loaded successfully on {device.type}")
        return model
    except RuntimeError as e:
        if "CUDA" in str(e) and device.type == "cuda":
            logger.warning(f"CUDA failed during model loading: {e}, falling back to CPU")
            # Force CPU and try again
            model = WhisperModel(
                model_size, 
                device="cpu", 
                compute_type="int8",
                download_root=str(cache_dir)
            )
            logger.info("Whisper model loaded successfully on CPU (fallback)")
            return model
        else:
            raise e

def _transcribe_local(audio_slice: Path, whisper_model: WhisperModel, language: str = None) -> Tuple[str, str]:
    """Transcribes a single audio slice and returns text and detected language."""
    segments, info = whisper_model.transcribe(str(audio_slice), vad_filter=False, language=language)
    text = " ".join(seg.text for seg in segments).strip()
    detected_lang = info.language
    return text, detected_lang

def _extract_segment(src: Path, start: float, end: float) -> Path:
    """Extracts a segment from an audio file using ffmpeg."""
    duration = max(end - start, MIN_SLICE_SEC)
    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    
    # Validate that source file exists
    if not src.exists():
        raise FileNotFoundError(f"Source audio file does not exist: {src}")
    
    # Log the extraction for debugging
    logger.info(f"Extracting segment {start:.2f}s-{end:.2f}s from {src}")
    
    cmd = [
        "ffmpeg", "-y", "-i", str(src),
        "-ss", f"{start}", "-t", f"{duration}",
        "-ac", "1", "-ar", "16000", "-loglevel", "error", tmp.name,
    ]
    _run_ffmpeg(cmd)
    return Path(tmp.name)

def _transcribe_segment(args: Tuple[Path, Dict[str, Any], WhisperModel, str]) -> Dict[str, Any]:
    """Helper function for parallel transcription of a single diarized segment."""
    src_path, segment_info, whisper_model, language = args

    # Skip very short segments
    if segment_info["end"] - segment_info["start"] < 0.1:
        return {**segment_info, "text": "", "language": language}

    clip_path = _extract_segment(src_path, segment_info["start"], segment_info["end"])
    try:
        text, detected_lang = _transcribe_local(clip_path, whisper_model, language)
        return {
            **segment_info,
            "text": text,
            "language": detected_lang
        }
    finally:
        clip_path.unlink(missing_ok=True)

class WhisperConfig:
    """Configuration class for Whisper transcription"""
    def __init__(self, model_size: str = "base", provider: str = "faster-whisper", language: str = "en"):
        self.model_size = model_size
        self.provider = provider
        self.language = language
        
        # Validate model size
        valid_sizes = ["tiny", "base", "small", "medium", "large", "large-v2", "large-v3"]
        if model_size not in valid_sizes:
            logger.warning(f"Unknown model size '{model_size}', falling back to 'base'")
            self.model_size = "base"

@cache_result()
def compile_transcript(
    audio_path: str,
    segments: List[Dict[str, Any]],
    whisper_config: Optional[WhisperConfig] = None,
    num_workers: int = 4,
    progress_callback: Optional[Callable[[int, int], None]] = None
) -> Tuple[str, str]:
    """
    Transcribes all diarized segments in parallel and compiles the full transcript.
    Returns the formatted transcript string and the detected dominant language.
    Results are cached based on file hash, segments, and parameters.
    
    Args:
        audio_path: Path to the audio file
        segments: List of diarized segments
        whisper_config: Whisper configuration (model size, provider, language)
        num_workers: Number of parallel workers
        progress_callback: Progress callback function
    """
    # Use default config if none provided
    if whisper_config is None:
        whisper_config = WhisperConfig()
    
    logger.info(f"Starting transcription process with {num_workers} workers...")
    logger.info(f"Using Whisper model: {whisper_config.model_size} ({whisper_config.provider})")
    
    # Add file hash to cache key for better cache invalidation
    file_hash = get_file_hash(audio_path)
    segments_hash = hashlib.md5(str(segments).encode()).hexdigest()
    config_hash = hashlib.md5(f"{whisper_config.model_size}_{whisper_config.provider}_{whisper_config.language}".encode()).hexdigest()
    logger.info(f"File hash: {file_hash}, Segments hash: {segments_hash}, Config hash: {config_hash}")
    
    whisper_model = _load_whisper(whisper_config.model_size, whisper_config.provider)
    src_path = Path(audio_path)

    tasks = [(src_path, seg, whisper_model, whisper_config.language) for seg in segments]

    results = []
    completed_count = 0
    total_count = len(tasks)
    
    if progress_callback:
        progress_callback(0, total_count)

    with ThreadPoolExecutor(max_workers=num_workers) as executor:
        futures = [executor.submit(_transcribe_segment, task) for task in tasks]
        for future in as_completed(futures):
            try:
                result = future.result()
                if result.get("text"):
                    results.append(result)
                completed_count += 1
                if progress_callback:
                    progress_callback(completed_count, total_count)
            except Exception as e:
                logger.error(f"Error transcribing segment: {e}", exc_info=True)
                completed_count += 1
                if progress_callback:
                    progress_callback(completed_count, total_count)

    # Sort results by start time to ensure correct order
    results.sort(key=lambda r: r["start"])

    # Count languages for determining dominant language
    language_counts = {}
    for res in results:
        lang = res["language"]
        language_counts[lang] = language_counts.get(lang, 0) + 1

    # Format transcript using the new grouped format (no timestamps, grouped speakers)
    full_transcript = format_transcript_grouped(results)

    # Determine dominant language
    dominant_language = max(language_counts, key=language_counts.get) if language_counts else whisper_config.language

    logger.info(f"Transcription complete. Dominant language: {dominant_language}")
    return full_transcript, dominant_language

# Convenience function for backward compatibility
def compile_transcript_legacy(
    audio_path: str,
    segments: List[Dict[str, Any]],
    whisper_size: str = "base",
    language: str = "en",
    num_workers: int = 4,
    progress_callback: Optional[Callable[[int, int], None]] = None
) -> Tuple[str, str]:
    """Legacy wrapper for compile_transcript with old parameter format"""
    whisper_config = WhisperConfig(model_size=whisper_size, language=language)
    return compile_transcript(audio_path, segments, whisper_config, num_workers, progress_callback)
