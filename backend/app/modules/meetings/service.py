"""
Business logic service layer for meetings module.

This module contains the business logic for meetings, separating it from
the API routing layer for better testability and maintainability.
"""

import shutil
from datetime import datetime
from pathlib import Path

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from ...core.config import config
from ...tasks import process_meeting_task
from . import crud, schemas
from .repository import MeetingRepository


class FileValidator:
    """Utility class for file validation."""

    @staticmethod
    def validate_file_size(file: UploadFile) -> int:
        """Validate file size and return file size in bytes."""
        file.file.seek(0, 2)  # Seek to end of file
        file_size = file.file.tell()
        file.file.seek(0)  # Reset to beginning

        if file_size > config.upload.max_file_size_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"File size ({file_size / (1024*1024):.1f}MB) exceeds maximum allowed size ({config.upload.max_file_size_mb}MB)",
            )

        return file_size

    @staticmethod
    def validate_file_extension(filename: str) -> None:
        """Validate file extension."""
        file_ext = Path(filename).suffix.lower()
        if file_ext not in config.upload.allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"File extension '{file_ext}' not allowed. Allowed extensions: {', '.join(config.upload.allowed_extensions)}",
            )


class FileManager:
    """Utility class for file management operations."""

    @staticmethod
    def save_uploaded_file(file: UploadFile) -> str:
        """Save uploaded file and return the file path."""
        file_path = Path(config.upload.upload_dir) / file.filename

        # Ensure filename is unique
        counter = 1
        original_path = file_path
        while file_path.exists():
            stem = original_path.stem
            suffix = original_path.suffix
            file_path = original_path.parent / f"{stem}_{counter}{suffix}"
            counter += 1

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        return str(file_path)


class MeetingService:
    """Service class for meeting business logic."""

    def __init__(self, db: Session):
        self.db = db
        self.repo = MeetingRepository(db)

    def create_meeting_from_upload(
        self,
        file: UploadFile,
        transcription_language: str | None = "en-US",
        number_of_speakers: str | None = "auto",
        meeting_date: str | None = None,
    ) -> schemas.Meeting:
        """
        Create a new meeting from an uploaded file.

        Args:
            file: Uploaded file object
            transcription_language: Language code for transcription
            number_of_speakers: Number of speakers or 'auto'
            meeting_date: ISO format date string

        Returns:
            Created meeting object

        Raises:
            HTTPException: If validation fails
        """
        # Validate file
        FileValidator.validate_file_extension(file.filename)
        file_size = FileValidator.validate_file_size(file)

        # Save file
        file_path = FileManager.save_uploaded_file(file)

        # Parse meeting date
        parsed_meeting_date = self._parse_meeting_date(meeting_date)

        # Create meeting record
        meeting_create = schemas.MeetingCreate(
            filename=file.filename,
            transcription_language=transcription_language,
            number_of_speakers=number_of_speakers,
            meeting_date=parsed_meeting_date,
        )

        db_meeting = crud.create_meeting(db=self.db, meeting=meeting_create, file_path=file_path, file_size=file_size)

        # Trigger background processing
        task_result = process_meeting_task.delay(db_meeting.id)
        crud.update_meeting_task_id(self.db, db_meeting.id, task_result.id)

        return db_meeting

    def create_batch_meetings_from_upload(
        self,
        files: list[UploadFile],
        transcription_languages: str | None = "en-US",
        number_of_speakers_list: str | None = "auto",
        meeting_dates: str | None = None,
    ) -> list[schemas.Meeting]:
        """
        Create multiple meetings from uploaded files.

        Args:
            files: List of uploaded files
            transcription_languages: Comma-separated languages or single value
            number_of_speakers_list: Comma-separated speaker counts or single value
            meeting_dates: Comma-separated ISO dates or empty

        Returns:
            List of created meeting objects
        """
        # Parse parameters
        languages = self._parse_batch_param(transcription_languages, len(files), "en-US")
        speakers = self._parse_batch_param(number_of_speakers_list, len(files), "auto")
        dates = self._parse_batch_param(meeting_dates, len(files), None)

        meetings = []
        for idx, file in enumerate(files):
            try:
                meeting = self.create_meeting_from_upload(
                    file=file,
                    transcription_language=languages[idx],
                    number_of_speakers=speakers[idx],
                    meeting_date=dates[idx],
                )
                meetings.append(meeting)
            except Exception as e:
                # Log error but continue with other files
                print(f"Error uploading {file.filename}: {str(e)}")
                continue

        return meetings

    @staticmethod
    def _parse_meeting_date(meeting_date: str | None) -> datetime | None:
        """Parse ISO format meeting date string."""
        if not meeting_date:
            return None

        try:
            return datetime.fromisoformat(meeting_date.replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            return None

    @staticmethod
    def _parse_batch_param(param: str | None, file_count: int, default: str | None) -> list[str | None]:
        """Parse comma-separated batch parameter or use default."""
        if not param:
            return [default] * file_count

        values = param.split(",")

        # If single value, use for all files
        if len(values) == 1:
            return values * file_count

        # Pad with default if not enough values
        while len(values) < file_count:
            values.append(default)

        return values[:file_count]
