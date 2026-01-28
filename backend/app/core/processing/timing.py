import logging
import time
from collections.abc import Callable

from sqlalchemy.orm import Session

from ...modules.meetings import crud
from ..base.utils import get_file_metadata

logger = logging.getLogger(__name__)


class DiarizationProgressTracker:
    """
    Tracks and predicts diarization progress using historical timing data.
    """

    def __init__(self, db: Session, audio_path: str, meeting_id: int):
        self.db = db
        self.audio_path = audio_path
        self.meeting_id = meeting_id
        self.start_time = None
        self.audio_duration = None
        self.estimated_total_time = None

        # Get audio duration from metadata
        try:
            metadata = get_file_metadata(audio_path)
            self.audio_duration = getattr(metadata, "duration", None)
        except Exception as e:
            logger.warning(f"Could not get audio duration: {e}")
            self.audio_duration = None

        # Get average processing rate from historical data
        self.avg_processing_rate = crud.get_average_diarization_rate(db)

        # Calculate estimated total processing time
        if self.audio_duration and self.avg_processing_rate:
            self.estimated_total_time = self.audio_duration * self.avg_processing_rate
            logger.info(
                f"Estimated diarization time: {self.estimated_total_time:.1f}s for {self.audio_duration:.1f}s audio"
            )
        else:
            # Fallback to conservative estimate if no historical data
            self.estimated_total_time = self.audio_duration * 2.0 if self.audio_duration else 120.0
            logger.info(f"Using fallback estimate: {self.estimated_total_time:.1f}s")

    def start_tracking(self):
        """Start tracking diarization progress."""
        self.start_time = time.time()
        logger.info("Started diarization timing tracking")

    def get_progress_callback(self, external_callback: Callable | None = None):
        """
        Returns a progress callback that calculates real-time progress percentage
        and remaining time based on running averages.
        """

        def progress_callback(base_progress: int, message: str):
            if not self.start_time:
                # If tracking hasn't started, use the base progress as-is
                if external_callback:
                    external_callback(base_progress, message)
                return

            elapsed_time = time.time() - self.start_time

            # Calculate actual progress based on elapsed time vs estimated total time
            if self.estimated_total_time and self.estimated_total_time > 0:
                time_based_progress = min(95, (elapsed_time / self.estimated_total_time) * 100)

                # Use primarily time-based progress, with base_progress as a minimum
                actual_progress = max(base_progress, int(time_based_progress))

                # Calculate remaining time
                if actual_progress > 0 and actual_progress < 95:
                    remaining_time = max(0, self.estimated_total_time - elapsed_time)

                    if remaining_time >= 60:
                        time_info = f"~{remaining_time/60:.1f}m remaining"
                    elif remaining_time >= 1:
                        time_info = f"~{remaining_time:.0f}s remaining"
                    else:
                        time_info = "Almost done"

                    enhanced_message = f"{message} ({time_info})"
                else:
                    enhanced_message = message
            else:
                # Fallback to base progress if no timing estimate available
                actual_progress = base_progress
                enhanced_message = message

            # Ensure progress doesn't exceed 95% until completion
            actual_progress = min(95, max(0, actual_progress))

            logger.debug(
                f"Diarization progress: {actual_progress}% (base: {base_progress}%, elapsed: {elapsed_time:.1f}s)"
            )

            if external_callback:
                external_callback(actual_progress, enhanced_message)

        return progress_callback

    def finish_tracking(self, num_speakers: int | None = None):
        """
        Finish tracking and record the timing data for future predictions.
        """
        if not self.start_time:
            logger.warning("Cannot finish tracking - tracking was never started")
            return

        total_time = time.time() - self.start_time

        # Record timing data for future predictions
        if self.audio_duration:
            try:
                # Get file size for additional correlation data
                import os

                file_size = os.path.getsize(self.audio_path) if os.path.exists(self.audio_path) else None

                crud.create_diarization_timing(
                    self.db,
                    meeting_id=self.meeting_id,
                    audio_duration_seconds=self.audio_duration,
                    processing_time_seconds=total_time,
                    num_speakers=num_speakers,
                    file_size_bytes=file_size,
                )

                processing_rate = total_time / self.audio_duration
                logger.info(
                    f"Diarization completed in {total_time:.1f}s for {self.audio_duration:.1f}s audio (rate: {processing_rate:.2f}x)"
                )

            except Exception as e:
                logger.error(f"Failed to record diarization timing: {e}")
        else:
            logger.warning("Cannot record timing data - audio duration unknown")

        # Reset tracking state
        self.start_time = None


def estimate_diarization_time(db: Session, audio_path: str) -> float | None:
    """
    Estimate diarization processing time based on historical data.
    Returns estimated time in seconds, or None if no estimate possible.
    """
    try:
        # Get audio duration
        metadata = get_file_metadata(audio_path)
        audio_duration = getattr(metadata, "duration", None)

        if not audio_duration:
            return None

        # Get average processing rate
        avg_rate = crud.get_average_diarization_rate(db)

        if avg_rate:
            return audio_duration * avg_rate
        else:
            # Conservative fallback estimate
            return audio_duration * 2.0

    except Exception as e:
        logger.warning(f"Could not estimate diarization time: {e}")
        return None
