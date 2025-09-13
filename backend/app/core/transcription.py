import tempfile
import hashlib
from pathlib import Path
from typing import List, Dict, Any, Tuple, Callable, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
from functools import lru_cache
import logging
import torch
from faster_whisper import WhisperModel
from tqdm import tqdm

from .utils import _run_ffmpeg
from .cache import cache_result, get_file_hash

# Setup logging
logger = logging.getLogger(__name__)

# Constants
MIN_SLICE_SEC = 0.20  # avoid zero-length clips
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

@lru_cache(maxsize=1)
def _load_whisper(model_size: str = "base") -> WhisperModel:
    """Loads the faster-whisper model."""
    logger.info(f"Loading faster-whisper '{model_size}' on {DEVICE.type}...")
    # Adjust compute_type based on device
    compute_type = "int8" if DEVICE.type == "cpu" else "float16"
    model = WhisperModel(model_size, device=DEVICE.type, compute_type=compute_type)
    logger.info(f"Whisper model loaded successfully on {DEVICE.type}")
    return model

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

@cache_result()
def compile_transcript(
    audio_path: str,
    segments: List[Dict[str, Any]],
    whisper_size: str = "base",
    language: str = "en",
    num_workers: int = 4,
    progress_callback: Optional[Callable[[int, int], None]] = None
) -> Tuple[str, str]:
    """
    Transcribes all diarized segments in parallel and compiles the full transcript.
    Returns the formatted transcript string and the detected dominant language.
    Results are cached based on file hash, segments, and parameters.
    """
    logger.info(f"Starting transcription process with {num_workers} workers...")
    
    # Add file hash to cache key for better cache invalidation
    file_hash = get_file_hash(audio_path)
    segments_hash = hashlib.md5(str(segments).encode()).hexdigest()
    logger.info(f"File hash: {file_hash}, Segments hash: {segments_hash}")
    
    whisper_model = _load_whisper(whisper_size)
    src_path = Path(audio_path)

    tasks = [(src_path, seg, whisper_model, language) for seg in segments]

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

    # Combine results into a single transcript string
    transcript_lines = []
    language_counts = {}
    for res in results:
        transcript_lines.append(f"{res['speaker']} ({res['start']:.2f}s - {res['end']:.2f}s): {res['text']}")
        lang = res["language"]
        language_counts[lang] = language_counts.get(lang, 0) + 1

    full_transcript = "\n".join(transcript_lines)

    # Determine dominant language
    dominant_language = max(language_counts, key=language_counts.get) if language_counts else language

    logger.info(f"Transcription complete. Dominant language: {dominant_language}")
    return full_transcript, dominant_language
