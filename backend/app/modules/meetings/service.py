"""
Business logic service layer for meetings module.

This module contains the business logic for meetings, separating it from
the API routing layer for better testability and maintainability.

MeetingService remains the single public entry point but delegates to focused
sub-services for chat, export, attachments, and audio operations.
"""

import os
import re
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ...core.config import config
from ..chat import schemas as chat_schemas
from ..chat.repository import ChatMessageRepository, GlobalChatSessionRepository
from ..settings.service import SettingsService
from . import models, schemas
from .file_utils import FileManager, FileValidator
from .models import MeetingStatus
from .repository import (
    ActionItemRepository,
    AttachmentRepository,
    DocumentChunkRepository,
    MeetingRepository,
    SpeakerRepository,
    TranscriptionRepository,
)
from .services.attachment_service import AttachmentService
from .services.audio_service import AudioService
from .services.chat_service import MeetingChatService
from .services.export_service import ExportService


class MeetingService:
    """Service class for meeting business logic.

    Delegates specialized operations to sub-services while maintaining
    full backward compatibility with all existing callers.
    """

    def __init__(self, db: Session):
        self.db = db
        self.repo = MeetingRepository(db)
        self.action_item_repo = ActionItemRepository(db)
        self.attachment_repo = AttachmentRepository(db)
        self.speaker_repo = SpeakerRepository(db)
        self.transcription_repo = TranscriptionRepository(db)
        self.chunk_repo = DocumentChunkRepository(db)

        # Sub-services (lazy-init pattern for delegated concerns)
        self._chat: MeetingChatService | None = None
        self._export: ExportService | None = None
        self._attachments: AttachmentService | None = None
        self._audio: AudioService | None = None

    # ------------------------------------------------------------------ #
    #  Sub-service accessors (lazy)                                      #
    # ------------------------------------------------------------------ #

    @property
    def chat_service(self) -> MeetingChatService:
        if self._chat is None:
            self._chat = MeetingChatService(self.db)
        return self._chat

    @property
    def export_service(self) -> ExportService:
        if self._export is None:
            self._export = ExportService(self.db)
        return self._export

    @property
    def attachment_service(self) -> AttachmentService:
        if self._attachments is None:
            self._attachments = AttachmentService(self.db)
        return self._attachments

    @property
    def audio_service(self) -> AudioService:
        if self._audio is None:
            self._audio = AudioService(self.db)
        return self._audio

    # ------------------------------------------------------------------ #
    #  Internal helpers                                                   #
    # ------------------------------------------------------------------ #

    def _dispatch_processing(self, meeting_id: int) -> str:
        """Dispatch a Celery processing task and return the task ID."""
        from ...tasks import process_meeting_task

        result = process_meeting_task.delay(meeting_id)
        self.repo.update_task_id(meeting_id, result.id)
        return result.id

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
    def _parse_batch_param(
        param: str | None, file_count: int, default: str | None
    ) -> list[str | None]:
        """Parse comma-separated batch parameter or use default."""
        if not param:
            return [default] * file_count
        values = param.split(",")
        if len(values) == 1:
            return values * file_count
        while len(values) < file_count:
            values.append(default)
        return values[:file_count]

    # =====================================================================
    #  Upload
    # =====================================================================

    def create_meeting_from_upload(
        self,
        file: UploadFile,
        transcription_language: str | None = "en-US",
        number_of_speakers: str | None = "auto",
        meeting_date: str | None = None,
    ) -> schemas.Meeting:
        """Create a new meeting from an uploaded file."""
        FileValidator.validate_file_extension(file.filename)
        file_size = FileValidator.validate_file_size(file)
        file_path = FileManager.save_uploaded_file(file)
        parsed_meeting_date = self._parse_meeting_date(meeting_date)

        meeting_create = schemas.MeetingCreate(
            filename=file.filename,
            transcription_language=transcription_language,
            number_of_speakers=number_of_speakers,
            meeting_date=parsed_meeting_date,
        )
        db_meeting = self.repo.create_meeting(
            meeting_data=meeting_create, file_path=file_path, file_size=file_size
        )
        self._dispatch_processing(db_meeting.id)
        return db_meeting

    def create_batch_meetings_from_upload(
        self,
        files: list[UploadFile],
        transcription_languages: str | None = "en-US",
        number_of_speakers_list: str | None = "auto",
        meeting_dates: str | None = None,
    ) -> list[schemas.Meeting]:
        """Create multiple meetings from uploaded files."""
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
                print(f"Error uploading {file.filename}: {str(e)}")
                continue
        return meetings

    # =====================================================================
    #  Meeting CRUD
    # =====================================================================

    def list_meetings(self, skip: int = 0, limit: int = 100) -> list[models.Meeting]:
        return self.repo.get_all(skip=skip, limit=limit)

    def get_unique_folders(self) -> list[str]:
        return self.repo.get_unique_folders()

    def get_unique_tags(self) -> list[str]:
        return self.repo.get_unique_tags()

    def get_meetings_by_filters(
        self, folder: str | None = None, tags: str | None = None
    ) -> list[int]:
        return self.repo.get_by_filters(folder=folder, tags=tags)

    def get_meeting(self, meeting_id: int) -> models.Meeting | None:
        return self.repo.get_by_id(meeting_id)

    def get_meeting_or_404(self, meeting_id: int) -> models.Meeting:
        meeting = self.repo.get_by_id(meeting_id)
        if not meeting:
            raise HTTPException(status_code=404, detail="Meeting not found")
        return meeting

    def update_meeting(
        self, meeting_id: int, meeting_update: schemas.MeetingUpdate
    ) -> models.Meeting:
        db_meeting = self.get_meeting_or_404(meeting_id)

        tags_changed = False
        updates: dict[str, Any] = {}
        if meeting_update.tags is not None and meeting_update.tags != db_meeting.tags:
            updates["tags"] = meeting_update.tags
            tags_changed = True
        if meeting_update.filename is not None:
            updates["filename"] = meeting_update.filename
        if meeting_update.transcription_language is not None:
            updates["transcription_language"] = meeting_update.transcription_language
        if meeting_update.number_of_speakers is not None:
            updates["number_of_speakers"] = meeting_update.number_of_speakers
        if meeting_update.model_configuration_id is not None:
            updates["model_configuration_id"] = meeting_update.model_configuration_id
        if meeting_update.folder is not None:
            updates["folder"] = meeting_update.folder
        if meeting_update.notes is not None:
            updates["notes"] = meeting_update.notes
        if meeting_update.meeting_date is not None:
            updates["meeting_date"] = meeting_update.meeting_date

        if updates:
            db_meeting = self.repo.update_fields(db_meeting, updates)

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
                    detail=(
                        "Meeting processing is already completed. All transcription, "
                        "analysis, and action items are available."
                    ),
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
        self._dispatch_processing(meeting_id)
        return self.repo.get_by_id(meeting_id)

    def retry_analysis(self, meeting_id: int) -> models.Meeting:
        db_meeting = self.get_meeting_or_404(meeting_id)

        if db_meeting.status != models.MeetingStatus.FAILED.value:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Cannot retry analysis for meeting with status: {db_meeting.status}. "
                    "Only FAILED meetings can be retried."
                ),
            )

        if not db_meeting.transcription or not db_meeting.transcription.full_text:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Meeting has no transcription data. Use /restart-processing "
                    "to reprocess the entire meeting."
                ),
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
        self._dispatch_processing(meeting_id)
        return self.repo.get_by_id(meeting_id)

    def delete_meeting(self, meeting_id: int) -> None:
        db_meeting = self.get_meeting_or_404(meeting_id)
        try:
            if db_meeting.filepath and os.path.exists(db_meeting.filepath):
                os.remove(db_meeting.filepath)
        except OSError as e:
            print(f"Error deleting file {db_meeting.filepath}: {e}")
        self.repo.delete_meeting(meeting_id)

    # =====================================================================
    #  Action Items
    # =====================================================================

    def get_action_items(
        self,
        status: str | None = None,
        skip: int = 0,
        limit: int = 1000,
    ) -> list[models.ActionItem]:
        if status:
            return self.action_item_repo.get_by_status(status, skip=skip, limit=limit)
        return self.action_item_repo.get_all(skip=skip, limit=limit)

    def get_action_item(self, item_id: int) -> models.ActionItem | None:
        return self.action_item_repo.get(item_id)

    def create_action_item(
        self,
        action_item: schemas.ActionItemCreate,
        transcription_id: int | None = None,
        is_manual: bool = True,
    ) -> models.ActionItem:
        return self.action_item_repo.create_action_item(
            transcription_id=transcription_id,
            item_data=action_item,
            is_manual=is_manual,
        )

    def update_calendar_sync(
        self,
        item_id: int,
        event_id: str | None = None,
        synced: bool = False,
    ) -> models.ActionItem | None:
        return self.action_item_repo.update_calendar_sync(
            item_id, event_id=event_id, synced=synced
        )

    def get_meeting_title(self, transcription_id: int) -> str | None:
        return self.transcription_repo.get_meeting_title(transcription_id)

    def get_distinct_action_item_owners(self) -> list[str]:
        return self.action_item_repo.get_distinct_owners()

    def get_action_items_by_ids(self, ids: list[int]) -> list[models.ActionItem]:
        return self.action_item_repo.get_by_ids(ids)

    def get_pending_action_items_due_before(self, date_str: str) -> list[models.ActionItem]:
        return self.action_item_repo.get_pending_due_before(date_str)

    def get_completed_action_items_in_range_or_ids(
        self,
        start: str,
        end: str,
        saved_ids: list[int],
    ) -> list[models.ActionItem]:
        return self.action_item_repo.get_completed_in_range_or_ids(start, end, saved_ids)

    def list_action_items(
        self, skip: int = 0, limit: int = 1000, status: str | None = None
    ) -> list[schemas.ActionItemWithMeeting]:
        if status:
            items = self.action_item_repo.get_by_status(status, skip=skip, limit=limit)
        else:
            items = self.action_item_repo.get_all(skip=skip, limit=limit)

        enriched: list[schemas.ActionItemWithMeeting] = []
        for item in items:
            item_dict = {
                **item.__dict__,
                "meeting_id": None,
                "meeting_title": None,
                "meeting_date": None,
            }
            if item.transcription_id:
                meeting_info = self.transcription_repo.get_meeting_info(item.transcription_id)
                if meeting_info:
                    item_dict["meeting_id"] = meeting_info["meeting_id"]
                    item_dict["meeting_title"] = meeting_info["meeting_title"]
                    item_dict["meeting_date"] = meeting_info["meeting_date"]
            enriched.append(schemas.ActionItemWithMeeting(**item_dict))
        return enriched

    def add_action_item(
        self, transcription_id: int, item_data: schemas.ActionItemCreate
    ) -> models.ActionItem:
        return self.action_item_repo.create_action_item(
            transcription_id=transcription_id, item_data=item_data, is_manual=True
        )

    def update_action_item(
        self, item_id: int, item_update: schemas.ActionItemUpdate
    ) -> models.ActionItem:
        updated_item = self.action_item_repo.update_action_item(item_id, item_update)
        if updated_item and updated_item.synced_to_calendar and updated_item.google_calendar_event_id:
            try:
                from ...core.integrations.google_calendar import GoogleCalendarService

                calendar_service = GoogleCalendarService(self.db)
                if calendar_service.is_connected():
                    meeting_title = self.transcription_repo.get_meeting_title(
                        updated_item.transcription_id
                    )
                    calendar_service.update_event(
                        updated_item.google_calendar_event_id, updated_item, meeting_title
                    )
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

    # =====================================================================
    #  Bulk Operations
    # =====================================================================

    def bulk_delete(self, meeting_ids: list[int]) -> schemas.BulkOperationResponse:
        success_count = 0
        failed_count = 0
        failed_ids: list[int] = []
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

        except Exception as e:
            self.repo.rollback()
            raise HTTPException(status_code=500, detail=f"Bulk delete failed: {str(e)}")

        return schemas.BulkOperationResponse(
            success_count=success_count,
            failed_count=failed_count,
            failed_ids=failed_ids,
            errors=errors if errors else None,
        )

    def bulk_update(
        self, meeting_ids: list[int], updates: Any
    ) -> schemas.BulkOperationResponse:
        success_count = 0
        failed_count = 0
        failed_ids: list[int] = []
        errors: dict[int, str] = {}

        update_data = updates.model_dump(exclude_unset=True)
        try:
            existing_ids: list[int] = []
            for meeting_id in meeting_ids:
                if self.repo.get_by_id(meeting_id):
                    existing_ids.append(meeting_id)
                else:
                    failed_count += 1
                    failed_ids.append(meeting_id)
                    errors[meeting_id] = "Meeting not found"

            if existing_ids and update_data:
                updated_count = self.repo.bulk_update_fields(existing_ids, update_data)
                success_count += updated_count
            else:
                success_count += len(existing_ids)

        except Exception as e:
            self.repo.rollback()
            raise HTTPException(status_code=500, detail=f"Bulk update failed: {str(e)}")

        return schemas.BulkOperationResponse(
            success_count=success_count,
            failed_count=failed_count,
            failed_ids=failed_ids,
            errors=errors if errors else None,
        )

    # =====================================================================
    #  Speakers
    # =====================================================================

    def add_speaker(
        self, meeting_id: int, name: str, label: str | None
    ) -> models.Speaker:
        self.get_meeting_or_404(meeting_id)
        return self.speaker_repo.create_for_meeting(
            meeting_id=meeting_id, name=name, label=label
        )

    def get_speakers(self, meeting_id: int) -> list[models.Speaker]:
        db_meeting = self.get_meeting_or_404(meeting_id)
        return db_meeting.speakers

    def update_speaker(
        self, speaker_id: int, name: str, label: str | None
    ) -> models.Speaker:
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
                        updated_text = update_speaker_name_in_transcript(
                            updated_text, old_label, name
                        )
                    if old_name and old_name != name and old_name != old_label:
                        updated_text = update_speaker_name_in_transcript(
                            updated_text, old_name, name
                        )
                    meeting.transcription.full_text = updated_text

                for action_item in meeting.transcription.action_items:
                    if action_item.owner and (
                        (old_name and action_item.owner.lower() == old_name.lower())
                        or (old_label and action_item.owner.lower() == old_label.lower())
                    ):
                        action_item.owner = name

        return self.speaker_repo.save(db_speaker)

    def delete_speaker(self, speaker_id: int) -> None:
        db_speaker = self.speaker_repo.get(speaker_id)
        if not db_speaker:
            raise HTTPException(status_code=404, detail="Speaker not found")
        self.speaker_repo.delete_speaker(db_speaker)

    # =====================================================================
    #  Tags / Folder / Notes
    # =====================================================================

    def update_tags_folder(
        self, meeting_id: int, tags: str | None, folder: str | None
    ) -> models.Meeting:
        db_meeting = self.get_meeting_or_404(meeting_id)
        updates: dict[str, Any] = {}
        if tags is not None:
            updates["tags"] = tags
        if folder is not None:
            updates["folder"] = folder
        if updates:
            db_meeting = self.repo.update_fields(db_meeting, updates)
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
        db_meeting = self.repo.update_fields(db_meeting, {"notes": notes})
        self.sync_meeting_links_from_notes(meeting_id, notes)
        if notes_changed and notes:
            from ...tasks import update_notes_embeddings

            update_notes_embeddings.delay(meeting_id, notes)
        return db_meeting

    def sync_meeting_links_from_notes(
        self, source_meeting_id: int, notes: str | None
    ) -> None:
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

        self.repo.commit()

    # =====================================================================
    #  Chat (delegated to MeetingChatService)
    # =====================================================================

    async def chat_with_meeting(
        self, meeting_id: int, request: "chat_schemas.ChatRequest"
    ) -> "chat_schemas.ChatResponse":
        db_meeting = self.get_meeting_or_404(meeting_id)
        return await self.chat_service.chat_with_meeting(
            meeting_id=meeting_id,
            request=request,
            transcription_text=(
                db_meeting.transcription.full_text if db_meeting.transcription else None
            ),
            model_configuration_id=db_meeting.model_configuration_id,
        )

    def get_chat_history(
        self, meeting_id: int, skip: int = 0, limit: int = 100
    ) -> "chat_schemas.ChatHistoryResponse":
        self.get_meeting_or_404(meeting_id)
        return self.chat_service.get_chat_history(meeting_id, skip=skip, limit=limit)

    def clear_chat_history(self, meeting_id: int) -> dict:
        self.get_meeting_or_404(meeting_id)
        return self.chat_service.clear_chat_history(meeting_id)

    # =====================================================================
    #  Download / Export (delegated to ExportService)
    # =====================================================================

    def get_export_file_response(self, meeting_id: int, format: str) -> FileResponse:
        db_meeting = self.get_meeting_or_404(meeting_id)
        return self.export_service.export_meeting(db_meeting, format)

    # =====================================================================
    #  Attachments (delegated to AttachmentService)
    # =====================================================================

    def upload_attachment(
        self,
        meeting_id: int,
        file: UploadFile,
        description: str | None = None,
    ) -> models.Attachment:
        self.get_meeting_or_404(meeting_id)
        return self.attachment_service.upload_attachment(meeting_id, file, description)

    def get_attachments(self, meeting_id: int) -> list[models.Attachment]:
        self.get_meeting_or_404(meeting_id)
        return self.attachment_service.get_attachments(meeting_id)

    def get_attachment(self, attachment_id: int) -> models.Attachment:
        return self.attachment_service.get_attachment(attachment_id)

    def get_attachment_file_response(
        self, attachment_id: int, inline: bool = False
    ) -> FileResponse:
        return self.attachment_service.serve_attachment(attachment_id, inline)

    def update_attachment_description(
        self, attachment_id: int, description: str
    ) -> models.Attachment:
        return self.attachment_service.update_description(attachment_id, description)

    def delete_attachment(self, attachment_id: int) -> None:
        self.attachment_service.delete_attachment(attachment_id)

    # =====================================================================
    #  Audio (delegated to AudioService)
    # =====================================================================

    def get_audio_file_response(self, meeting_id: int) -> FileResponse:
        meeting = self.get_meeting_or_404(meeting_id)
        return self.audio_service.serve_audio(meeting)

    def generate_audio(self, meeting_id: int) -> schemas.TaskStatus:
        meeting = self.get_meeting_or_404(meeting_id)
        return self.audio_service.generate_audio(meeting)

    def regenerate_all_audio(self, force: bool = False) -> schemas.BatchTaskStatus:
        return self.audio_service.regenerate_all_audio(force)

    # =====================================================================
    #  Misc
    # =====================================================================

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
