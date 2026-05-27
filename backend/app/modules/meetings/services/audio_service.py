"""
Audio service — serves and generates audio files for meetings.

Extracted from MeetingService to isolate audio-specific operations.
"""

from pathlib import Path

from fastapi import HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from . import models as meeting_models
from . import schemas
from .repository import MeetingRepository


class AudioService:
    """Serves and generates audio files for meetings."""

    def __init__(self, db: Session):
        self.db = db
        self.repo = MeetingRepository(db)

    def serve_audio(self, meeting: meeting_models.Meeting) -> FileResponse:
        """Stream the audio file for a meeting."""
        if not meeting.audio_filepath:
            raise HTTPException(
                status_code=404, detail="Audio file not available for this meeting"
            )
        audio_path = Path(meeting.audio_filepath)
        if not audio_path.exists():
            raise HTTPException(status_code=404, detail="Audio file not found on disk")

        return FileResponse(
            path=str(audio_path),
            media_type="audio/mpeg",
            filename=f"{meeting.filename}_audio.mp3",
            headers={
                "Accept-Ranges": "bytes",
                "Content-Disposition": f'inline; filename="{meeting.filename}_audio.mp3"',
            },
        )

    def generate_audio(self, meeting: meeting_models.Meeting) -> schemas.TaskStatus:
        """Queue audio generation for a meeting."""
        if meeting.audio_filepath and Path(meeting.audio_filepath).exists():
            return schemas.TaskStatus(
                status="already_exists",
                audio_filepath=meeting.audio_filepath,
                message="Audio file already exists for this meeting",
            )

        if not meeting.filepath or not Path(meeting.filepath).exists():
            raise HTTPException(
                status_code=404, detail="Source file not found. Cannot generate audio."
            )

        from ...tasks import generate_audio_for_existing_meeting

        task = generate_audio_for_existing_meeting.delay(meeting.id)
        return schemas.TaskStatus(
            status="queued",
            task_id=task.id,
            message=f"Audio generation task queued for meeting {meeting.id}",
        )

    def regenerate_all_audio(self, force: bool = False) -> schemas.BatchTaskStatus:
        """Queue audio generation for all completed meetings that lack it."""
        from ...tasks import generate_audio_for_existing_meeting

        all_completed = self.repo.get_completed_meetings(skip=0, limit=100000)

        if force:
            meetings = [
                m for m in all_completed
                if not m.audio_filepath or not Path(m.audio_filepath).exists()
            ]
        else:
            meetings = [m for m in all_completed if not m.audio_filepath]

        if not meetings:
            return schemas.BatchTaskStatus(
                status="completed",
                count=0,
                task_ids=[],
                message="No meetings found that need audio generation",
            )

        task_ids = []
        for meeting in meetings:
            if meeting.filepath and Path(meeting.filepath).exists():
                task = generate_audio_for_existing_meeting.delay(meeting.id)
                task_ids.append(task.id)

        return schemas.BatchTaskStatus(
            status="queued",
            count=len(task_ids),
            task_ids=task_ids,
            message=f"Queued audio generation for {len(task_ids)} meetings",
        )
