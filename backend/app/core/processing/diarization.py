import os
from typing import List, Dict, Any, Optional
import logging

from ..base.utils import get_file_metadata
from ..base.cache import cache_result, get_file_hash
from ..base.retry import retry_gpu_operation
from ..config import config

# Setup logging
logger = logging.getLogger(__name__)

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
            del test_tensor
            torch.cuda.empty_cache()
            logger.info(f"CUDA is available and working, using GPU")
            return device
    except Exception as e:
        logger.warning(f"CUDA initialization failed: {e}, falling back to CPU")
    
    logger.info("Using CPU device")
    return torch.device("cpu")

# Try to import torch and pyannote
try:
    import torch
    from pyannote.audio import Pipeline
    # Device configuration
    DEVICE = _get_device()
    TORCH_AVAILABLE = True
except ImportError:
    logger.warning("PyTorch or pyannote.audio not available")
    torch = None
    Pipeline = None
    DEVICE = None
    TORCH_AVAILABLE = False

@cache_result()
@retry_gpu_operation(max_retries=2, delay=2.0)
def diarize_audio(audio_path: str, num_speakers: Optional[int] = None, progress_callback: Optional[object] = None, 
                  db_session = None, meeting_id: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    Performs speaker diarization on an audio file.
    Requires a Hugging Face authentication token.
    Results are cached based on file hash and parameters.
    
    Args:
        audio_path: Path to the audio file
        num_speakers: Number of speakers (optional)
        progress_callback: Callback function for progress updates
        db_session: Database session for timing tracking (optional)
        meeting_id: Meeting ID for timing tracking (optional)
    """
    logger.info(f"Running speaker diarization on {audio_path}...")
    
    # Initialize progress tracking if database session is provided
    progress_tracker = None
    if db_session and meeting_id:
        try:
            from .timing import DiarizationProgressTracker
            progress_tracker = DiarizationProgressTracker(db_session, audio_path, meeting_id)
        except ImportError:
            logger.warning("Timing module not available, using basic progress tracking")
    
    # Add file hash to cache key for better cache invalidation
    file_hash = get_file_hash(audio_path)
    logger.info(f"File hash: {file_hash}")

    auth_token = config.api.get("HUGGINGFACE_TOKEN")
    if not auth_token:
        raise RuntimeError("Hugging Face token not configured. Please set it in the application settings.")

    try:
        if progress_callback:
            progress_callback(10, "Loading diarization model...")
        
        # Use persistent cache directory for model downloads
        from pathlib import Path
        cache_dir = Path("/app/cache/models/pyannote")
        cache_dir.mkdir(parents=True, exist_ok=True)
        
        pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            use_auth_token=auth_token,
            cache_dir=str(cache_dir)
        )
        pipeline.to(DEVICE)
        logger.info(f"Diarization pipeline loaded on {DEVICE}")
        
        # Start timing tracking
        if progress_tracker:
            progress_tracker.start_tracking()
        
        # Create enhanced progress callback
        enhanced_progress_callback = None
        if progress_tracker:
            enhanced_progress_callback = progress_tracker.get_progress_callback(progress_callback)
        else:
            enhanced_progress_callback = progress_callback
        
        if enhanced_progress_callback:
            enhanced_progress_callback(30, "Running speaker diarization...")

        # Run diarization with simulated progress updates
        import threading
        import time
        
        # Start the diarization in a separate thread
        diarization_result = [None]
        diarization_error = [None]
        
        def run_diarization():
            try:
                diarization_result[0] = pipeline(audio_path, num_speakers=num_speakers)
            except Exception as e:
                diarization_error[0] = e
        
        diarization_thread = threading.Thread(target=run_diarization)
        diarization_thread.start()
        
        # Update progress while diarization is running
        if enhanced_progress_callback:
            if progress_tracker:
                # With timing tracker: let it calculate progress based on elapsed time
                while diarization_thread.is_alive():
                    time.sleep(1)  # Check every second for responsiveness
                    # The timing tracker will calculate the actual progress percentage
                    enhanced_progress_callback(50, "Processing audio segments...")
            else:
                # Fallback without timing tracker: use incremental progress
                progress = 30
                while diarization_thread.is_alive():
                    time.sleep(2)  # Update every 2 seconds
                    if progress < 90:  # Cap at 90% until actual completion
                        progress += 3
                        enhanced_progress_callback(progress, "Processing audio segments...")
        
        # Wait for completion
        diarization_thread.join()
        
        # Check for errors
        if diarization_error[0]:
            raise diarization_error[0]
        
        diarization = diarization_result[0]
        
        if enhanced_progress_callback:
            enhanced_progress_callback(95, "Processing diarization results...")

        segments: List[Dict[str, Any]] = []
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            segments.append({"start": turn.start, "end": turn.end, "speaker": speaker})

        # Count unique speakers for timing tracking
        unique_speakers = len(set(segment["speaker"] for segment in segments))
        
        # Finish timing tracking
        if progress_tracker:
            progress_tracker.finish_tracking(num_speakers=unique_speakers)

        if enhanced_progress_callback:
            enhanced_progress_callback(100, f"Diarization completed - {len(segments)} segments found")

        logger.info(f"Diarization produced {len(segments)} segments.")
        return segments
    except Exception as e:
        logger.error(f"Diarization failed: {e}", exc_info=True)
        
        # Finish timing tracking even on failure (to record partial timing data)
        if progress_tracker:
            try:
                progress_tracker.finish_tracking()
            except:
                pass  # Don't let timing errors mask the original error
        
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
