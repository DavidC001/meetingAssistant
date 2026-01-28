import json
import logging
import pickle
from datetime import datetime
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from ... import crud

logger = logging.getLogger(__name__)


class CheckpointManager:
    """
    Manages checkpoints for processing pipeline stages to enable resumption after interruption.
    """

    def __init__(self, meeting_id: int, cache_dir: str = "/app/cache"):
        self.meeting_id = meeting_id
        self.cache_dir = Path(cache_dir)
        self.checkpoint_dir = self.cache_dir / "checkpoints" / str(meeting_id)
        self.checkpoint_dir.mkdir(parents=True, exist_ok=True)

    def _get_checkpoint_path(self, stage: str) -> Path:
        """Get the checkpoint file path for a specific stage."""
        return self.checkpoint_dir / f"{stage}_checkpoint.pkl"

    def _get_metadata_path(self) -> Path:
        """Get the metadata file path for the meeting."""
        return self.checkpoint_dir / "metadata.json"

    def save_checkpoint(self, stage: str, data: Any, metadata: dict | None = None) -> bool:
        """
        Save a checkpoint for a specific stage.

        Args:
            stage: The processing stage name
            data: The data to checkpoint (will be pickled)
            metadata: Optional metadata to store as JSON

        Returns:
            bool: True if successfully saved
        """
        try:
            checkpoint_path = self._get_checkpoint_path(stage)

            # Save the data using pickle for complex objects
            with open(checkpoint_path, "wb") as f:
                pickle.dump(data, f)

            # Save metadata if provided
            if metadata:
                self._save_metadata(stage, metadata)

            logger.info(f"Checkpoint saved for meeting {self.meeting_id}, stage: {stage}")
            return True

        except Exception as e:
            logger.error(f"Failed to save checkpoint for meeting {self.meeting_id}, stage {stage}: {e}")
            return False

    def load_checkpoint(self, stage: str) -> Any | None:
        """
        Load a checkpoint for a specific stage.

        Args:
            stage: The processing stage name

        Returns:
            The checkpointed data or None if not found
        """
        try:
            checkpoint_path = self._get_checkpoint_path(stage)

            if not checkpoint_path.exists():
                return None

            with open(checkpoint_path, "rb") as f:
                data = pickle.load(f)

            logger.info(f"Checkpoint loaded for meeting {self.meeting_id}, stage: {stage}")
            return data

        except Exception as e:
            logger.error(f"Failed to load checkpoint for meeting {self.meeting_id}, stage {stage}: {e}")
            return None

    def has_checkpoint(self, stage: str) -> bool:
        """Check if a checkpoint exists for a specific stage."""
        checkpoint_path = self._get_checkpoint_path(stage)
        return checkpoint_path.exists()

    def get_completed_stages(self) -> list[str]:
        """Get a list of all completed stages that have checkpoints."""
        completed_stages = []
        for checkpoint_file in self.checkpoint_dir.glob("*_checkpoint.pkl"):
            stage = checkpoint_file.stem.replace("_checkpoint", "")
            completed_stages.append(stage)
        return sorted(completed_stages)

    def _save_metadata(self, stage: str, metadata: dict) -> None:
        """Save metadata for a stage."""
        try:
            metadata_path = self._get_metadata_path()

            # Load existing metadata or create new
            all_metadata = {}
            if metadata_path.exists():
                with open(metadata_path) as f:
                    all_metadata = json.load(f)

            # Add stage metadata with timestamp
            all_metadata[stage] = {**metadata, "timestamp": datetime.now().isoformat(), "meeting_id": self.meeting_id}

            # Save updated metadata
            with open(metadata_path, "w") as f:
                json.dump(all_metadata, f, indent=2)

        except Exception as e:
            logger.error(f"Failed to save metadata for stage {stage}: {e}")

    def get_metadata(self, stage: str | None = None) -> dict:
        """
        Get metadata for a specific stage or all stages.

        Args:
            stage: Specific stage name, or None for all stages

        Returns:
            Dict with metadata
        """
        try:
            metadata_path = self._get_metadata_path()

            if not metadata_path.exists():
                return {}

            with open(metadata_path) as f:
                all_metadata = json.load(f)

            if stage:
                return all_metadata.get(stage, {})
            else:
                return all_metadata

        except Exception as e:
            logger.error(f"Failed to load metadata: {e}")
            return {}

    def clear_checkpoints(self) -> bool:
        """Clear all checkpoints for this meeting."""
        try:
            import shutil

            if self.checkpoint_dir.exists():
                shutil.rmtree(self.checkpoint_dir)
            logger.info(f"Cleared all checkpoints for meeting {self.meeting_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to clear checkpoints for meeting {self.meeting_id}: {e}")
            return False

    def get_resume_point(self, db: Session) -> str | None:
        """
        Determine where to resume processing based on checkpoints and database state.

        Returns:
            The stage to resume from, or None if starting from beginning
        """
        try:
            # Get meeting from database
            meeting = crud.get_meeting(db, self.meeting_id)
            if not meeting:
                return None

            # Check what stages have been completed
            completed_stages = self.get_completed_stages()

            # Define stage order
            stage_order = ["conversion", "diarization", "transcription", "analysis"]

            # If we have a transcription in the database, we can skip to the end
            if meeting.transcription:
                logger.info(f"Meeting {self.meeting_id} already has transcription, processing complete")
                return None  # Already complete

            # Find the last completed stage
            last_completed_stage_index = -1
            for i, stage in enumerate(stage_order):
                if stage in completed_stages:
                    last_completed_stage_index = i

            # Resume from the next stage after the last completed one
            if last_completed_stage_index >= 0 and last_completed_stage_index < len(stage_order) - 1:
                resume_stage = stage_order[last_completed_stage_index + 1]
                logger.info(f"Meeting {self.meeting_id} can resume from stage: {resume_stage}")
                return resume_stage

            # If no checkpoints or all stages complete, start from beginning
            return None

        except Exception as e:
            logger.error(f"Failed to determine resume point for meeting {self.meeting_id}: {e}")
            return None

    def validate_checkpoint(self, stage: str) -> bool:
        """
        Validate that a checkpoint is still valid and not corrupted.

        Args:
            stage: The stage to validate

        Returns:
            bool: True if valid, False otherwise
        """
        try:
            data = self.load_checkpoint(stage)
            if data is None:
                return False

            # Basic validation - check if it's not empty
            return not (isinstance(data, list | dict) and len(data) == 0)

        except Exception as e:
            logger.error(f"Checkpoint validation failed for stage {stage}: {e}")
            return False
