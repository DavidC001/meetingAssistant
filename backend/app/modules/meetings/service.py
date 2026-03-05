"""
Business logic service layer for meetings module.

This module contains the business logic for meetings, separating it from
the API routing layer for better testability and maintainability.
"""

import os
import re
import shutil
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ...core.config import config
from ...core.integrations.export import export_to_docx, export_to_json, export_to_pdf, export_to_txt
from ...core.llm import chat as llm_chat
from ...core.storage import rag
from ...tasks import process_meeting_task
from ..chat import schemas as chat_schemas
from ..chat.repository import ChatMessageRepository, GlobalChatSessionRepository
from ..settings.service import SettingsService
from . import models, schemas
from .models import MeetingStatus
from .repository import (
    ActionItemRepository,
    AttachmentRepository,
    DocumentChunkRepository,
    MeetingRepository,
    SpeakerRepository,
    TranscriptionRepository,
)


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
        self.action_item_repo = ActionItemRepository(db)
        self.attachment_repo = AttachmentRepository(db)
        self.speaker_repo = SpeakerRepository(db)
        self.transcription_repo = TranscriptionRepository(db)
        self.chunk_repo = DocumentChunkRepository(db)

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

        db_meeting = self.repo.create_meeting(meeting_data=meeting_create, file_path=file_path, file_size=file_size)

        # Trigger background processing
        task_result = process_meeting_task.delay(db_meeting.id)
        self.repo.update_task_id(db_meeting.id, task_result.id)

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

    # =========================================================================
    # Meeting CRUD
    # =========================================================================

    def list_meetings(self, skip: int = 0, limit: int = 100) -> list[models.Meeting]:
        return self.repo.get_all(skip=skip, limit=limit)

    def get_meeting(self, meeting_id: int) -> models.Meeting | None:
        return self.repo.get_by_id(meeting_id)

    def get_meeting_or_404(self, meeting_id: int) -> models.Meeting:
        meeting = self.repo.get_by_id(meeting_id)
        if not meeting:
            raise HTTPException(status_code=404, detail="Meeting not found")
        return meeting

    def update_meeting(self, meeting_id: int, meeting_update: schemas.MeetingUpdate) -> models.Meeting:
        db_meeting = self.get_meeting_or_404(meeting_id)

        tags_changed = False
        if meeting_update.tags is not None and meeting_update.tags != db_meeting.tags:
            db_meeting.tags = meeting_update.tags
            tags_changed = True
        if meeting_update.filename is not None:
            db_meeting.filename = meeting_update.filename
        if meeting_update.transcription_language is not None:
            db_meeting.transcription_language = meeting_update.transcription_language
        if meeting_update.number_of_speakers is not None:
            db_meeting.number_of_speakers = meeting_update.number_of_speakers
        if meeting_update.model_configuration_id is not None:
            db_meeting.model_configuration_id = meeting_update.model_configuration_id
        if meeting_update.folder is not None:
            db_meeting.folder = meeting_update.folder
        if meeting_update.notes is not None:
            db_meeting.notes = meeting_update.notes
        if meeting_update.meeting_date is not None:
            db_meeting.meeting_date = meeting_update.meeting_date

        self.db.commit()
        self.db.refresh(db_meeting)

        if tags_changed:
            try:
                from app.modules.projects.service import ProjectService

                ProjectService(self.db).sync_meeting_to_projects_by_tags(meeting_id)
            except Exception as e:
                print(f"Warning: Failed to auto-sync meeting {meeting_id} to projects: {e}")

        return db_meeting

    def restart_processing(self, meeting_id: int) -> models.Meeting:
        db_meeting = self.get_meeting_or_404(meeting_id)

        if db_meeting.status == models.MeetingStatus.COMPLETED.value:
            is_fully_completed = (
                db_meeting.transcription
                and db_meeting.transcription.summary
                and db_meeting.transcription.full_text
                and db_meeting.transcription.action_items
            )
            if is_fully_completed:
                raise HTTPException(
                    status_code=400,
                    detail="Meeting processing is already completed. All transcription, analysis, and action items are available.",
                )

        if db_meeting.status not in [
            models.MeetingStatus.FAILED.value,
            models.MeetingStatus.COMPLETED.value,
            models.MeetingStatus.PROCESSING.value,
        ]:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot restart processing for meeting with status: {db_meeting.status}",
            )

        if db_meeting.celery_task_id:
            try:
                from ...worker import celery_app

                celery_app.control.revoke(db_meeting.celery_task_id, terminate=True)
            except Exception as e:
                print(f"Error cancelling existing task: {e}")

        self.repo.update_status(meeting_id, models.MeetingStatus.PENDING)
        self.repo.update_processing_details(
            meeting_id,
            current_stage=None,
            stage_progress=0.0,
            overall_progress=0.0,
            processing_start_time=None,
            stage_start_time=None,
            error_message=None,
            processing_logs=["Processing restarted manually"],
        )

        task_result = process_meeting_task.delay(meeting_id)
        self.repo.update_task_id(meeting_id, task_result.id)
        return self.repo.get_by_id(meeting_id)

    def retry_analysis(self, meeting_id: int) -> models.Meeting:
        db_meeting = self.get_meeting_or_404(meeting_id)

        if db_meeting.status != models.MeetingStatus.FAILED.value:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot retry analysis for meeting with status: {db_meeting.status}. Only FAILED meetings can be retried.",
            )

        if not db_meeting.transcription or not db_meeting.transcription.full_text:
            raise HTTPException(
                status_code=400,
                detail="Meeting has no transcription data. Use /restart-processing to reprocess the entire meeting.",
            )

        if db_meeting.celery_task_id:
            try:
                from ...worker import celery_app

                celery_app.control.revoke(db_meeting.celery_task_id, terminate=True)
            except Exception as e:
                print(f"Error cancelling existing task: {e}")

        self.repo.update_status(meeting_id, models.MeetingStatus.PROCESSING)
        self.repo.update_processing_details(
            meeting_id,
            current_stage=models.ProcessingStage.ANALYSIS.value,
            stage_progress=0.0,
            overall_progress=75.0,
            error_message=None,
            processing_logs=["Retrying analysis after previous failure"],
        )

        task_result = process_meeting_task.delay(meeting_id)
        self.repo.update_task_id(meeting_id, task_result.id)
        return self.repo.get_by_id(meeting_id)

    def delete_meeting(self, meeting_id: int) -> None:
        db_meeting = self.get_meeting_or_404(meeting_id)

        try:
            if db_meeting.filepath and os.path.exists(db_meeting.filepath):
                os.remove(db_meeting.filepath)
        except OSError as e:
            print(f"Error deleting file {db_meeting.filepath}: {e}")

        self.repo.delete_meeting(meeting_id)

    def bulk_delete(self, meeting_ids: list[int]) -> schemas.BulkOperationResponse:
        success_count = 0
        failed_count = 0
        failed_ids = []
        errors: dict[int, str] = {}

        try:
            for meeting_id in meeting_ids:
                try:
                    db_meeting = self.repo.get_by_id(meeting_id)
                    if not db_meeting:
                        failed_count += 1
                        failed_ids.append(meeting_id)
                        errors[meeting_id] = "Meeting not found"
                        continue

                    try:
                        if db_meeting.filepath and os.path.exists(db_meeting.filepath):
                            os.remove(db_meeting.filepath)
                    except OSError as e:
                        print(f"Warning: Could not delete file for meeting {meeting_id}: {e}")

                    self.repo.delete_meeting(meeting_id)
                    success_count += 1

                except Exception as e:
                    failed_count += 1
                    failed_ids.append(meeting_id)
                    errors[meeting_id] = str(e)

            if success_count > 0:
                self.db.commit()

        except Exception as e:
            self.db.rollback()
            raise HTTPException(status_code=500, detail=f"Bulk delete failed: {str(e)}")

        return schemas.BulkOperationResponse(
            success_count=success_count,
            failed_count=failed_count,
            failed_ids=failed_ids,
            errors=errors if errors else None,
        )

    def bulk_update(self, meeting_ids: list[int], updates: Any) -> schemas.BulkOperationResponse:
        success_count = 0
        failed_count = 0
        failed_ids = []
        errors: dict[int, str] = {}

        try:
            for meeting_id in meeting_ids:
                try:
                    db_meeting = self.repo.get_by_id(meeting_id)
                    if not db_meeting:
                        failed_count += 1
                        failed_ids.append(meeting_id)
                        errors[meeting_id] = "Meeting not found"
                        continue

                    update_data = updates.model_dump(exclude_unset=True)
                    for key, value in update_data.items():
                        setattr(db_meeting, key, value)
                    success_count += 1

                except Exception as e:
                    failed_count += 1
                    failed_ids.append(meeting_id)
                    errors[meeting_id] = str(e)

            if success_count > 0:
                self.db.commit()

        except Exception as e:
            self.db.rollback()
            raise HTTPException(status_code=500, detail=f"Bulk update failed: {str(e)}")

        return schemas.BulkOperationResponse(
            success_count=success_count,
            failed_count=failed_count,
            failed_ids=failed_ids,
            errors=errors if errors else None,
        )

    # =========================================================================
    # Speakers
    # =========================================================================

    def add_speaker(self, meeting_id: int, name: str, label: str | None) -> models.Speaker:
        self.get_meeting_or_404(meeting_id)
        db_speaker = models.Speaker(meeting_id=meeting_id, name=name, label=label)
        self.db.add(db_speaker)
        self.db.commit()
        self.db.refresh(db_speaker)
        return db_speaker

    def get_speakers(self, meeting_id: int) -> list[models.Speaker]:
        db_meeting = self.get_meeting_or_404(meeting_id)
        return db_meeting.speakers

    def update_speaker(self, speaker_id: int, name: str, label: str | None) -> models.Speaker:
        from ...core.processing.transcript_formatter import update_speaker_name_in_transcript

        db_speaker = self.speaker_repo.get(speaker_id)
        if not db_speaker:
            raise HTTPException(status_code=404, detail="Speaker not found")

        old_name = db_speaker.name
        old_label = db_speaker.label
        db_speaker.name = name
        db_speaker.label = label

        if old_name != name or old_label != label:
            meeting = self.repo.get_by_id(db_speaker.meeting_id)
            if meeting and meeting.transcription:
                if meeting.transcription.full_text:
                    updated_text = meeting.transcription.full_text

                    if old_label and old_label != name:
                        updated_text = update_speaker_name_in_transcript(updated_text, old_label, name)

                    if old_name and old_name != name and old_name != old_label:
                        updated_text = update_speaker_name_in_transcript(updated_text, old_name, name)

                    meeting.transcription.full_text = updated_text

                for action_item in meeting.transcription.action_items:
                    if action_item.owner and (
                        (old_name and action_item.owner.lower() == old_name.lower())
                        or (old_label and action_item.owner.lower() == old_label.lower())
                    ):
                        action_item.owner = name

        self.db.commit()
        self.db.refresh(db_speaker)
        return db_speaker

    def delete_speaker(self, speaker_id: int) -> None:
        db_speaker = self.speaker_repo.get(speaker_id)
        if not db_speaker:
            raise HTTPException(status_code=404, detail="Speaker not found")
        self.db.delete(db_speaker)
        self.db.commit()

    # =========================================================================
    # Action Items
    # =========================================================================

    def list_action_items(
        self, skip: int = 0, limit: int = 1000, status: str | None = None
    ) -> list[schemas.ActionItemWithMeeting]:
        if status:
            items = self.action_item_repo.get_by_status(status, skip=skip, limit=limit)
        else:
            items = self.action_item_repo.get_all(skip=skip, limit=limit)

        enriched: list[schemas.ActionItemWithMeeting] = []
        for item in items:
            item_dict = {**item.__dict__, "meeting_id": None, "meeting_title": None, "meeting_date": None}
            if item.transcription_id:
                meeting_info = self.transcription_repo.get_meeting_info(item.transcription_id)
                if meeting_info:
                    item_dict["meeting_id"] = meeting_info["meeting_id"]
                    item_dict["meeting_title"] = meeting_info["meeting_title"]
                    item_dict["meeting_date"] = meeting_info["meeting_date"]
            enriched.append(schemas.ActionItemWithMeeting(**item_dict))
        return enriched

    def add_action_item(self, transcription_id: int, item_data: schemas.ActionItemCreate) -> models.ActionItem:
        return self.action_item_repo.create_action_item(
            transcription_id=transcription_id, item_data=item_data, is_manual=True
        )

    def update_action_item(self, item_id: int, item_update: schemas.ActionItemUpdate) -> models.ActionItem:
        updated_item = self.action_item_repo.update_action_item(item_id, item_update)
        if updated_item and updated_item.synced_to_calendar and updated_item.google_calendar_event_id:
            try:
                from ...core.integrations.google_calendar import GoogleCalendarService

                calendar_service = GoogleCalendarService(self.db)
                if calendar_service.is_connected():
                    meeting_title = self.transcription_repo.get_meeting_title(updated_item.transcription_id)
                    calendar_service.update_event(updated_item.google_calendar_event_id, updated_item, meeting_title)
            except Exception as e:
                print(f"Error updating Google Calendar event: {e}")
        return updated_item

    def delete_action_item(self, item_id: int) -> None:
        action_item = self.action_item_repo.get(item_id)
        if action_item and action_item.synced_to_calendar and action_item.google_calendar_event_id:
            try:
                from ...core.integrations.google_calendar import GoogleCalendarService

                calendar_service = GoogleCalendarService(self.db)
                if calendar_service.is_connected():
                    calendar_service.delete_event(action_item.google_calendar_event_id)
            except Exception as e:
                print(f"Error deleting Google Calendar event: {e}")
        self.action_item_repo.delete(id=item_id)

    # =========================================================================
    # Tags / Folder / Notes
    # =========================================================================

    def update_tags_folder(self, meeting_id: int, tags: str | None, folder: str | None) -> models.Meeting:
        db_meeting = self.get_meeting_or_404(meeting_id)
        if tags is not None:
            db_meeting.tags = tags
        if folder is not None:
            db_meeting.folder = folder
        self.db.commit()
        self.db.refresh(db_meeting)
        if tags is not None:
            try:
                from app.modules.projects.service import ProjectService

                ProjectService(self.db).sync_meeting_to_projects_by_tags(meeting_id)
            except Exception as e:
                print(f"Warning: Failed to auto-sync meeting {meeting_id} to projects: {e}")
        return db_meeting

    def update_notes(self, meeting_id: int, notes: str | None) -> models.Meeting:
        db_meeting = self.get_meeting_or_404(meeting_id)
        notes_changed = db_meeting.notes != notes
        db_meeting.notes = notes
        self.db.commit()
        self.db.refresh(db_meeting)
        self.sync_meeting_links_from_notes(meeting_id, notes)
        if notes_changed and notes:
            from ...tasks import update_notes_embeddings

            update_notes_embeddings.delay(meeting_id, notes)
        return db_meeting

    def sync_meeting_links_from_notes(self, source_meeting_id: int, notes: str | None) -> None:
        if not notes:
            self.repo.delete_meeting_links(source_meeting_id)
            return

        meeting_ids: set[int] = set()
        for pattern, group in [
            (r"#(?:meeting-)?(\d+)", 1),
            (r"meeting:\s*(\d+)", 1),
            (r"\[\[(\d+)\]\]", 1),
        ]:
            for match in re.finditer(pattern, notes, re.IGNORECASE):
                meeting_ids.add(int(match.group(group)))
        meeting_ids.discard(source_meeting_id)

        existing_links = self.repo.get_meeting_links(source_meeting_id)
        existing_target_ids = {link.target_meeting_id for link in existing_links}
        to_add = meeting_ids - existing_target_ids
        to_remove = existing_target_ids - meeting_ids

        if to_remove:
            self.repo.delete_meeting_links_to_targets(source_meeting_id, to_remove)

        for target_id in to_add:
            target_meeting = self.repo.get_by_id(target_id)
            if target_meeting:
                self.repo.add_meeting_link(source_meeting_id, target_id)

        self.db.commit()

    # =========================================================================
    # Chat
    # =========================================================================

    async def chat_with_meeting(
        self, meeting_id: int, request: "chat_schemas.ChatRequest"
    ) -> "chat_schemas.ChatResponse":
        db_meeting = self.get_meeting_or_404(meeting_id)
        if not db_meeting.transcription or not db_meeting.transcription.full_text:
            raise HTTPException(status_code=404, detail="Transcription not available for this meeting")

        chat_msg_repo = ChatMessageRepository(self.db)
        chat_msg_repo.create_message(meeting_id, "user", request.query)
        chat_history = request.chat_history or []

        settings_svc = SettingsService(self.db)
        model_config = None
        if db_meeting.model_configuration_id:
            model_config = settings_svc.get_model_configuration(db_meeting.model_configuration_id)
        if not model_config:
            model_config = settings_svc.get_default_model_configuration()

        llm_config = None
        if model_config:
            llm_config = llm_chat.model_config_to_llm_config(model_config, use_analysis=False)

        enable_tools = getattr(request, "enable_tools", True)
        response_text, sources, follow_ups = await rag.generate_rag_response(
            self.db,
            query=request.query,
            meeting_id=meeting_id,
            chat_history=chat_history,
            top_k=request.top_k or 5,
            llm_config=llm_config,
            use_full_transcript=request.use_full_transcript or False,
            full_transcript=db_meeting.transcription.full_text if request.use_full_transcript else None,
            enable_tools=enable_tools,
            allow_iterative_research=True,
        )

        chat_msg_repo.create_message(meeting_id, "assistant", response_text)
        return chat_schemas.ChatResponse(response=response_text, sources=sources, follow_up_suggestions=follow_ups)

    def get_chat_history(self, meeting_id: int, skip: int = 0, limit: int = 100) -> "chat_schemas.ChatHistoryResponse":
        self.get_meeting_or_404(meeting_id)
        messages = ChatMessageRepository(self.db).get_by_meeting(meeting_id, skip=skip, limit=limit)
        return chat_schemas.ChatHistoryResponse(history=messages)

    def clear_chat_history(self, meeting_id: int) -> dict:
        self.get_meeting_or_404(meeting_id)
        ChatMessageRepository(self.db).delete_by_meeting(meeting_id)
        return {"message": "Chat history cleared successfully"}

    # =========================================================================
    # Download / Export
    # =========================================================================

    def get_export_file_response(self, meeting_id: int, format: str) -> FileResponse:
        allowed_formats = ["json", "txt", "docx", "pdf"]
        if format.lower() not in allowed_formats:
            raise HTTPException(
                status_code=400, detail=f"Invalid format. Allowed formats: {', '.join(allowed_formats)}"
            )

        db_meeting = self.get_meeting_or_404(meeting_id)
        if not db_meeting.transcription:
            raise HTTPException(
                status_code=404, detail="Meeting transcription not available. Processing may still be in progress."
            )

        data: dict = {
            "filename": db_meeting.filename,
            "created_at": db_meeting.created_at,
            "status": db_meeting.status,
            "summary": db_meeting.transcription.summary or "No summary available",
            "transcript": db_meeting.transcription.full_text or "No transcript available",
            "notes": db_meeting.notes or "",
            "action_items": [],
        }
        if db_meeting.transcription.action_items:
            for item in db_meeting.transcription.action_items:
                data["action_items"].append(
                    {
                        "task": item.task,
                        "owner": item.owner or "Unassigned",
                        "due_date": item.due_date or "No due date",
                        "status": item.status or "pending",
                        "priority": item.priority or "medium",
                        "notes": item.notes or "",
                    }
                )
        if db_meeting.speakers:
            data["speakers"] = [{"name": s.name, "label": s.label or ""} for s in db_meeting.speakers]
        if db_meeting.tags:
            data["tags"] = db_meeting.tags
        if db_meeting.folder:
            data["folder"] = db_meeting.folder
        if db_meeting.model_configuration:
            data["model_info"] = {
                "name": db_meeting.model_configuration.name,
                "transcription_language": db_meeting.transcription_language,
                "number_of_speakers": db_meeting.number_of_speakers,
            }

        temp_dir = tempfile.mkdtemp()
        base_name = Path(db_meeting.filename.replace(" ", "_")).stem
        try:
            export_path = None
            if format.lower() == "json":
                export_path = export_to_json(data, os.path.join(temp_dir, f"{base_name}.json"))
            elif format.lower() == "txt":
                export_path = export_to_txt(data, os.path.join(temp_dir, f"{base_name}.txt"))
            elif format.lower() == "docx":
                export_path = export_to_docx(data, os.path.join(temp_dir, f"{base_name}.docx"))
                if export_path is None:
                    raise HTTPException(status_code=500, detail="DOCX export not available.")
            elif format.lower() == "pdf":
                export_path = export_to_pdf(data, os.path.join(temp_dir, f"{base_name}.pdf"))
                if export_path is None:
                    raise HTTPException(status_code=500, detail="PDF export not available.")

            if not export_path or not os.path.exists(export_path):
                raise HTTPException(status_code=500, detail="Failed to generate export file")

            media_types = {
                "json": "application/json",
                "txt": "text/plain",
                "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "pdf": "application/pdf",
            }
            return FileResponse(
                path=str(export_path),
                media_type=media_types[format.lower()],
                filename=f"{base_name}.{format.lower()}",
                background=None,
            )
        except HTTPException:
            shutil.rmtree(temp_dir, ignore_errors=True)
            raise
        except Exception as e:
            shutil.rmtree(temp_dir, ignore_errors=True)
            raise HTTPException(status_code=500, detail=f"Error generating export: {str(e)}")

    # =========================================================================
    # Attachments
    # =========================================================================

    def upload_attachment(
        self,
        meeting_id: int,
        file: UploadFile,
        description: str | None = None,
    ) -> models.Attachment:
        import time

        self.get_meeting_or_404(meeting_id)

        attachments_dir = Path(config.upload.upload_dir) / "attachments"
        attachments_dir.mkdir(parents=True, exist_ok=True)

        original_filename = file.filename or "attachment"
        safe_filename = re.sub(r"[^\w\s.-]", "", original_filename)
        timestamp = str(int(time.time() * 1000))
        unique_filename = f"{meeting_id}_{timestamp}_{safe_filename}"
        file_path = attachments_dir / unique_filename

        try:
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

        file_size = os.path.getsize(file_path)
        mime_type = file.content_type or "application/octet-stream"

        attachment = self.attachment_repo.create_attachment(
            meeting_id=meeting_id,
            filename=original_filename,
            filepath=str(file_path),
            file_size=file_size,
            mime_type=mime_type,
            description=description,
        )

        from ...tasks import index_attachment

        index_attachment.delay(attachment.id)
        return attachment

    def get_attachments(self, meeting_id: int) -> list[models.Attachment]:
        self.get_meeting_or_404(meeting_id)
        return self.attachment_repo.get_by_meeting(meeting_id)

    def get_attachment(self, attachment_id: int) -> models.Attachment:
        attachment = self.attachment_repo.get(attachment_id)
        if not attachment:
            raise HTTPException(status_code=404, detail="Attachment not found")
        return attachment

    def get_attachment_file_response(self, attachment_id: int, inline: bool = False) -> FileResponse:
        attachment = self.get_attachment(attachment_id)
        file_path = Path(attachment.filepath)
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="Attachment file not found on disk")
        headers = {}
        if inline:
            headers["Content-Disposition"] = f'inline; filename="{attachment.filename}"'
        return FileResponse(
            path=str(file_path),
            media_type=attachment.mime_type,
            filename=attachment.filename,
            headers=headers or None,
        )

    def update_attachment_description(self, attachment_id: int, description: str) -> models.Attachment:
        attachment = self.attachment_repo.get(attachment_id)
        if not attachment:
            raise HTTPException(status_code=404, detail="Attachment not found")
        return self.attachment_repo.update_description(attachment_id, description)

    def delete_attachment(self, attachment_id: int) -> None:
        attachment = self.get_attachment(attachment_id)
        meeting_id = attachment.meeting_id

        file_path = Path(attachment.filepath)
        if file_path.exists():
            try:
                file_path.unlink()
            except Exception as e:
                print(f"Warning: Failed to delete attachment file: {str(e)}")

        self.chunk_repo.delete_by_attachment(attachment_id)
        self.attachment_repo.delete(id=attachment_id)

        from ...tasks import remove_attachment_embeddings

        remove_attachment_embeddings.delay(meeting_id, attachment_id)

    # =========================================================================
    # Audio
    # =========================================================================

    def get_audio_file_response(self, meeting_id: int) -> FileResponse:
        meeting = self.get_meeting_or_404(meeting_id)
        if not meeting.audio_filepath:
            raise HTTPException(status_code=404, detail="Audio file not available for this meeting")
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

    def generate_audio(self, meeting_id: int) -> schemas.TaskStatus:
        meeting = self.get_meeting_or_404(meeting_id)
        if meeting.audio_filepath and Path(meeting.audio_filepath).exists():
            return schemas.TaskStatus(
                status="already_exists",
                audio_filepath=meeting.audio_filepath,
                message="Audio file already exists for this meeting",
            )
        if not meeting.filepath or not Path(meeting.filepath).exists():
            raise HTTPException(status_code=404, detail="Source file not found. Cannot generate audio.")
        from ...tasks import generate_audio_for_existing_meeting

        task = generate_audio_for_existing_meeting.delay(meeting_id)
        return schemas.TaskStatus(
            status="queued",
            task_id=task.id,
            message=f"Audio generation task queued for meeting {meeting_id}",
        )

    def regenerate_all_audio(self, force: bool = False) -> schemas.BatchTaskStatus:
        from ...tasks import generate_audio_for_existing_meeting

        all_completed = self.repo.get_completed_meetings(skip=0, limit=100000)
        if force:
            meetings = [m for m in all_completed if not m.audio_filepath or not Path(m.audio_filepath).exists()]
        else:
            meetings = [m for m in all_completed if not m.audio_filepath]

        if not meetings:
            return schemas.BatchTaskStatus(
                status="completed", count=0, task_ids=[], message="No meetings found that need audio generation"
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

    # =========================================================================
    # Misc
    # =========================================================================

    def get_all_tags(self) -> list[str]:
        tags_set: set[str] = set()
        meetings = self.repo.get_all(skip=0, limit=100000)
        for meeting in meetings:
            if meeting.tags:
                for tag in meeting.tags.split(","):
                    tag = tag.strip()
                    if tag:
                        tags_set.add(tag)

        sessions = GlobalChatSessionRepository(self.db).list_all(skip=0, limit=100000)
        for session in sessions:
            if session.tags:
                for tag in session.tags.split(","):
                    tag = tag.strip()
                    if tag:
                        tags_set.add(tag)

        return sorted(tags_set)

    def get_all_speakers(self) -> list[str]:
        return [s for s in self.speaker_repo.get_unique_names() if s]
