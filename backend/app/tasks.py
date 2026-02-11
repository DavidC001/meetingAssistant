import logging
import time
from pathlib import Path
from typing import Any

from . import crud, models, schemas
from .core.processing import chunking
from .core.processing.document_processor import extract_text
from .core.storage.embeddings import batched_embeddings, get_embedding_provider
from .core.storage.vector_store import DEFAULT_PROJECT_VECTOR_STORE, DEFAULT_VECTOR_STORE
from .database import SessionLocal
from .worker import celery_app

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _build_chunk_payloads(meeting: models.Meeting) -> list[dict[str, Any]]:
    """Convert meeting artefacts into chunk payloads for embedding."""

    payloads: list[dict[str, Any]] = []
    counter = 0

    def append_chunks(chunks, attachment=None):
        nonlocal counter
        for chunk in chunks:
            metadata = dict(chunk.metadata or {})
            metadata.setdefault("meeting_id", meeting.id)
            metadata.setdefault("meeting_name", meeting.filename)
            if attachment is not None:
                metadata.setdefault("attachment_id", attachment.id)
                metadata.setdefault("attachment_name", attachment.filename)
            payload = {
                "content": chunk.content,
                "content_type": chunk.content_type,
                "chunk_index": counter,
                "metadata": metadata,
            }
            if attachment is not None:
                payload["attachment_id"] = attachment.id
            payloads.append(payload)
            counter += 1

    transcription = meeting.transcription
    if transcription:
        append_chunks(
            chunking.chunk_summary(
                transcription.summary or "",
                metadata={"section": "summary"},
            )
        )
        append_chunks(
            chunking.chunk_transcript(
                transcription.full_text or "",
                metadata={"section": "transcript"},
            )
        )
        action_items = [
            {
                "id": item.id,
                "task": item.task,
                "owner": item.owner,
                "due_date": item.due_date,
                "notes": item.notes,
            }
            for item in transcription.action_items or []
        ]
        append_chunks(chunking.chunk_action_items(action_items))

    if meeting.notes:
        append_chunks(
            chunking.chunk_notes(
                meeting.notes,
                metadata={"section": "notes"},
            )
        )

    for attachment in meeting.attachments or []:
        try:
            text = extract_text(attachment.filepath, attachment.mime_type)
        except Exception as exc:  # pragma: no cover - best effort extraction
            logger.warning(
                "Failed to extract text from attachment %s: %s",
                attachment.filepath,
                exc,
            )
            continue
        if not text.strip():
            continue
        append_chunks(
            chunking.chunk_document(
                text,
                metadata={
                    "section": "attachment",
                    "attachment_name": attachment.filename,
                },
            ),
            attachment=attachment,
        )

    return payloads


@celery_app.task(
    bind=True,
    autoretry_for=(ConnectionError, TimeoutError),
    retry_backoff=True,
    retry_backoff_max=600,  # Max 10 minutes
    retry_jitter=True,
    max_retries=3,
)
def process_meeting_task(self, meeting_id: int):
    """
    Celery task to process a meeting file.
    It will perform transcription, analysis, and save the results.

    Auto-retries on:
    - ConnectionError: Network/database connection issues
    - TimeoutError: External service timeouts

    Max 3 retries with exponential backoff up to 10 minutes.
    """
    logger.info(f"Starting processing for meeting_id: {meeting_id}")
    db = SessionLocal()

    try:
        # 1. Update meeting status to PROCESSING and set processing start time
        crud.update_meeting_status(db, meeting_id, models.MeetingStatus.PROCESSING)
        crud.update_meeting_processing_details(
            db,
            meeting_id,
            processing_start_time=time.time(),
            current_stage=models.ProcessingStage.CONVERSION.value,
            stage_start_time=time.time(),
            stage_progress=0.0,
            overall_progress=0.0,
            processing_logs=["Processing started"],
        )
        logger.info(f"Meeting {meeting_id} status updated to PROCESSING.")

        # 2. Get meeting details from DB
        meeting = crud.get_meeting(db, meeting_id)
        if not meeting:
            logger.error(f"Meeting with id {meeting_id} not found.")
            raise ValueError("Meeting not found")

        # 3. Run the actual processing pipeline
        from .core.processing.pipeline import run_processing_pipeline

        run_processing_pipeline(db=db, meeting_id=meeting_id)

        # The status is updated to COMPLETED inside the pipeline/crud function.
        logger.info(f"Processing for meeting {meeting_id} completed successfully.")
        compute_embeddings_for_meeting.delay(meeting_id)

    except Exception as e:
        error_message = f"Error processing meeting {meeting_id}: {str(e)}"
        logger.error(error_message, exc_info=True)

        # Mark the task as failed in the database
        crud.update_meeting_status(db, meeting_id, models.MeetingStatus.FAILED)
        crud.update_meeting_processing_details(
            db, meeting_id, error_message=error_message, stage_progress=0.0, overall_progress=0.0
        )

        # You might want to re-raise the exception if you want Celery to record it as a failure
        raise
    finally:
        db.close()

    return {"status": "Completed", "meeting_id": meeting_id}


@celery_app.task(
    bind=True,
    autoretry_for=(ConnectionError, TimeoutError),
    retry_backoff=True,
    retry_backoff_max=300,  # Max 5 minutes
    retry_jitter=True,
    max_retries=3,
)
def compute_embeddings_for_meeting(self, meeting_id: int) -> dict[str, Any]:
    """
    Compute embeddings for a meeting's transcript, notes, action items, and attachments.

    Auto-retries on:
    - ConnectionError: Database/vector store connection issues
    - TimeoutError: Embedding API timeouts

    Max 3 retries with exponential backoff up to 5 minutes.
    """

    db = SessionLocal()
    try:
        logger.info(f"Starting embedding computation for meeting {meeting_id}")
        meeting = crud.get_meeting(db, meeting_id)
        if not meeting:
            raise ValueError(f"Meeting {meeting_id} not found")

        logger.info(f"Getting embedding provider for meeting {meeting_id}")
        try:
            provider, config = get_embedding_provider(db)
            logger.info(
                f"Using embedding provider: {config.provider}, model: {config.model_name}, dimension: {config.dimension}"
            )
        except Exception as e:
            logger.error(f"Failed to get embedding provider: {e}", exc_info=True)
            crud.mark_meeting_embeddings(db, meeting_id, computed=False, config_id=None)
            return {"status": "error", "meeting_id": meeting_id, "error": str(e)}

        logger.info(f"Building chunk payloads for meeting {meeting_id}")
        payloads = _build_chunk_payloads(meeting)
        if not payloads:
            logger.warning(f"No content to embed for meeting {meeting_id}")
            crud.clear_meeting_chunks(db, meeting_id)
            crud.mark_meeting_embeddings(db, meeting_id, computed=False, config_id=None)
            return {"status": "no-content", "meeting_id": meeting_id}

        logger.info(f"Generated {len(payloads)} chunks for meeting {meeting_id}")
        crud.clear_meeting_chunks(db, meeting_id)

        texts = [payload["content"] for payload in payloads]
        logger.info(f"Computing embeddings for {len(texts)} text chunks")
        try:
            embeddings = batched_embeddings(provider, texts, batch_size=16)
            logger.info(f"Successfully computed {len(embeddings)} embeddings")
        except Exception as e:
            logger.error(f"Failed to compute embeddings: {e}", exc_info=True)
            crud.mark_meeting_embeddings(db, meeting_id, computed=False, config_id=None)
            return {"status": "error", "meeting_id": meeting_id, "error": str(e)}

        logger.info("Storing embeddings in vector store")
        DEFAULT_VECTOR_STORE.add_documents(
            db,
            meeting_id=meeting_id,
            chunks=payloads,
            embeddings=embeddings,
            embedding_config_id=config.id,
        )
        crud.mark_meeting_embeddings(db, meeting_id, computed=True, config_id=config.id)
        logger.info("Successfully stored %s chunks for meeting %s", len(payloads), meeting_id)
        return {"status": "completed", "chunks": len(payloads), "meeting_id": meeting_id}
    except Exception as exc:
        logger.error("Failed to compute embeddings for meeting %s: %s", meeting_id, exc, exc_info=True)
        try:
            crud.mark_meeting_embeddings(db, meeting_id, computed=False, config_id=None)
        except Exception as mark_exc:
            logger.error("Failed to mark embeddings as failed: %s", mark_exc)
        raise
    finally:
        db.close()


@celery_app.task
def recompute_all_embeddings() -> dict[str, Any]:
    """Queue embedding recomputation for all meetings."""

    db = SessionLocal()
    try:
        meeting_ids = [meeting.id for meeting in crud.get_meetings(db, skip=0, limit=100000)]
    finally:
        db.close()

    for meeting_id in meeting_ids:
        compute_embeddings_for_meeting.delay(meeting_id)

    return {"status": "queued", "meetings": len(meeting_ids)}


@celery_app.task(bind=True)
def sync_google_drive_folder(self, force: bool = False):
    """
    Celery task to synchronize files from a Google Drive folder.
    Downloads new files, processes them, and moves them to a processed folder.

    Args:
        force: If True, run sync regardless of schedule (for manual triggers)
    """
    from datetime import datetime
    from datetime import time as dt_time
    from pathlib import Path

    from .core.config import config
    from .core.integrations.google_drive import GoogleDriveService

    logger.info("Starting Google Drive folder synchronization (force=%s)", force)
    db = SessionLocal()

    try:
        # Get Google Drive service
        drive_service = GoogleDriveService(db)

        # Check if authenticated
        if not drive_service.is_authenticated():
            logger.warning("Google Drive not authenticated, skipping sync")
            return {"status": "not_authenticated"}

        # Get sync configuration
        sync_config = crud.get_google_drive_sync_config(db)

        if not sync_config or not sync_config.enabled:
            logger.info("Google Drive sync is disabled")
            return {"status": "disabled"}

        if not sync_config.sync_folder_id:
            logger.warning("Sync folder ID not configured")
            return {"status": "not_configured"}

        # Check if we should run based on schedule (unless forced)
        if not force and sync_config.sync_mode == "scheduled":
            # Parse configured sync time
            try:
                hour, minute = map(int, sync_config.sync_time.split(":"))
                scheduled_time = dt_time(hour, minute)
            except (ValueError, AttributeError):
                logger.error("Invalid sync_time format: %s", sync_config.sync_time)
                scheduled_time = dt_time(4, 0)  # Default to 4 AM

            now = datetime.now()
            current_time = now.time()

            # Check if we're within 30 minutes of the scheduled time
            # (since beat runs every 30 minutes)
            scheduled_datetime = datetime.combine(now.date(), scheduled_time)
            time_diff = abs((now - scheduled_datetime).total_seconds() / 60)

            # Also check if we already ran today
            if sync_config.last_sync_at:
                last_sync_date = sync_config.last_sync_at.date()
                if last_sync_date == now.date() and time_diff > 30:
                    logger.info("Already synced today, skipping")
                    return {"status": "already_synced_today"}

            if time_diff > 30:
                logger.info("Not time to sync yet (scheduled: %s, current: %s)", scheduled_time, current_time)
                return {"status": "not_scheduled_time"}

            logger.info("Within scheduled sync window, proceeding")
        elif not force and sync_config.sync_mode == "manual":
            logger.info("Sync mode is manual, skipping automatic sync")
            return {"status": "manual_mode"}

        logger.info(f"Syncing from folder: {sync_config.sync_folder_id}")

        # Ensure processed folder exists
        if not sync_config.processed_folder_id:
            logger.info("Creating processed folder")
            processed_folder_id = drive_service.ensure_processed_folder(sync_config.sync_folder_id)
            crud.save_google_drive_sync_config(db, processed_folder_id=processed_folder_id, user_id="default")
            # Refresh config
            sync_config = crud.get_google_drive_sync_config(db)

        # List files in the sync folder
        files = drive_service.list_files_in_folder(sync_config.sync_folder_id)
        logger.info(f"Found {len(files)} files in sync folder")

        processed_count = 0
        error_count = 0

        for file_info in files:
            file_id = file_info["id"]
            file_name = file_info["name"]

            # Skip if already processed
            if crud.is_file_processed(db, file_id):
                logger.debug(f"File {file_name} already processed, skipping")
                continue

            # Check if file extension is allowed
            file_ext = Path(file_name).suffix.lower()
            if file_ext not in config.upload.allowed_extensions:
                logger.info(f"Skipping {file_name}: extension {file_ext} not allowed")
                crud.mark_file_as_processed(db, file_id, file_name)
                continue

            try:
                logger.info(f"Processing file: {file_name}")

                # Download file
                upload_dir = Path(config.upload.upload_dir)
                upload_dir.mkdir(parents=True, exist_ok=True)
                destination_path = upload_dir / file_name

                # Ensure unique filename
                counter = 1
                original_path = destination_path
                while destination_path.exists():
                    stem = original_path.stem
                    suffix = original_path.suffix
                    destination_path = original_path.parent / f"{stem}_{counter}{suffix}"
                    counter += 1

                file_path, upload_date = drive_service.download_file(file_id, str(destination_path))
                logger.info(f"Downloaded to: {file_path}, upload date: {upload_date}")

                # Mark as processed (before creating meeting to avoid duplicates)
                crud.mark_file_as_processed(db, file_id, file_name)

                # Create meeting record if auto_process is enabled
                if sync_config.auto_process:
                    file_size = destination_path.stat().st_size

                    meeting_create = schemas.MeetingCreate(
                        filename=file_name,
                        transcription_language="en-US",
                        number_of_speakers="auto",
                        meeting_date=upload_date,  # Use file upload date as meeting date
                    )

                    db_meeting = crud.create_meeting(
                        db=db, meeting=meeting_create, file_path=file_path, file_size=file_size
                    )

                    # Update processed file with meeting ID
                    crud.update_processed_file_meeting(db, file_id, db_meeting.id)

                    # Trigger processing task
                    process_meeting_task.delay(db_meeting.id)
                    logger.info(f"Created meeting {db_meeting.id} and triggered processing")

                # Move file to processed folder in Google Drive
                try:
                    drive_service.move_file(file_id, sync_config.sync_folder_id, sync_config.processed_folder_id)
                    crud.mark_file_moved_to_processed(db, file_id)
                    logger.info(f"Moved {file_name} to processed folder")
                except Exception as move_error:
                    logger.error(f"Failed to move file {file_name}: {move_error}")
                    # Continue anyway - file is downloaded and processed

                processed_count += 1

            except Exception as e:
                logger.error(f"Error processing file {file_name}: {e}", exc_info=True)
                error_count += 1
                # Don't mark as processed so we can retry later
                continue

        # Update last sync time
        crud.update_sync_last_run(db)

        logger.info(f"Google Drive sync completed: {processed_count} processed, {error_count} errors")

        return {"status": "completed", "processed": processed_count, "errors": error_count, "total_files": len(files)}

    except Exception as e:
        error_message = f"Error during Google Drive sync: {str(e)}"
        logger.error(error_message, exc_info=True)
        return {"status": "error", "error": error_message}
    finally:
        db.close()


@celery_app.task(bind=True)
def generate_audio_for_existing_meeting(self, meeting_id: int):
    """
    Generate MP3 audio file for an existing meeting that's missing audio.
    This task is used to backfill audio for meetings processed before the audio_filepath feature was added.

    Args:
        meeting_id: ID of the meeting to generate audio for

    Returns:
        dict: Status information about the operation
    """
    db = SessionLocal()
    try:
        meeting = crud.get_meeting(db, meeting_id)
        if not meeting:
            logger.warning(f"Meeting {meeting_id} not found")
            return {"status": "error", "reason": "meeting_not_found", "meeting_id": meeting_id}

        if meeting.audio_filepath:
            logger.info(f"Meeting {meeting_id} already has audio at {meeting.audio_filepath}")
            return {"status": "skipped", "reason": "already_has_audio", "meeting_id": meeting_id}

        if not meeting.filepath or not Path(meeting.filepath).exists():
            logger.warning(f"Source file for meeting {meeting_id} not found at {meeting.filepath}")
            return {"status": "error", "reason": "source_file_not_found", "meeting_id": meeting_id}

        logger.info(f"Generating MP3 audio for meeting {meeting_id} from {meeting.filepath}")

        # Generate MP3
        from .core.base.utils import convert_to_mp3
        from .core.config import config

        audio_dir = Path(config.upload.upload_dir) / "audio"
        audio_dir.mkdir(parents=True, exist_ok=True)
        mp3_filename = f"{Path(meeting.filepath).stem}_audio.mp3"
        mp3_path = audio_dir / mp3_filename

        # Ensure unique filename
        counter = 1
        original_mp3_path = mp3_path
        while mp3_path.exists():
            mp3_filename = f"{Path(meeting.filepath).stem}_audio_{counter}.mp3"
            mp3_path = audio_dir / mp3_filename
            counter += 1

        convert_to_mp3(meeting.filepath, mp3_path)

        # Update meeting with audio filepath
        meeting.audio_filepath = str(mp3_path)
        db.commit()

        logger.info(f"Successfully generated audio for meeting {meeting_id} at {mp3_path}")
        return {"status": "completed", "meeting_id": meeting_id, "audio_filepath": str(mp3_path)}

    except Exception as e:
        logger.error(f"Error generating audio for meeting {meeting_id}: {e}", exc_info=True)
        db.rollback()
        return {"status": "error", "reason": "generation_failed", "meeting_id": meeting_id, "error": str(e)}
    finally:
        db.close()


@celery_app.task(
    bind=True,
    autoretry_for=(ConnectionError, TimeoutError),
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
    max_retries=3,
)
def update_notes_embeddings(self, meeting_id: int, notes: str):
    """
    Update embeddings for meeting notes only, without recomputing everything.
    This is much more efficient than recomputing all embeddings.

    Args:
        meeting_id: ID of the meeting
        notes: The updated notes content

    Auto-retries on ConnectionError/TimeoutError with exponential backoff.
    """
    db = SessionLocal()
    try:
        logger.info(f"Updating notes embeddings for meeting {meeting_id}")

        # Get meeting
        meeting = crud.get_meeting(db, meeting_id)
        if not meeting:
            logger.warning(f"Meeting {meeting_id} not found")
            return {"status": "error", "reason": "meeting_not_found"}

        # Get embedding provider
        provider, config = get_embedding_provider(db)

        # Remove old notes embeddings
        DEFAULT_VECTOR_STORE.delete_chunks_by_metadata(db, meeting_id=meeting_id, metadata_filter={"section": "notes"})

        # Create new chunks for notes
        notes_chunks = chunking.chunk_notes(notes, metadata={"section": "notes"})

        if not notes_chunks:
            logger.info(f"No chunks generated from notes for meeting {meeting_id}")
            return {"status": "completed", "chunks": 0}

        # Build payloads
        payloads = []
        for i, chunk in enumerate(notes_chunks):
            metadata = dict(chunk.metadata or {})
            metadata.setdefault("meeting_id", meeting.id)
            metadata.setdefault("meeting_name", meeting.filename)
            payloads.append(
                {
                    "content": chunk.content,
                    "content_type": chunk.content_type,
                    "chunk_index": i,
                    "metadata": metadata,
                }
            )

        # Compute embeddings
        embeddings = batched_embeddings(provider, [p["content"] for p in payloads])

        # Store in vector store
        DEFAULT_VECTOR_STORE.add_documents(
            db,
            meeting_id=meeting_id,
            chunks=payloads,
            embeddings=embeddings,
            embedding_config_id=config.id,
        )

        logger.info(f"Updated {len(payloads)} note chunks for meeting {meeting_id}")
        return {"status": "completed", "chunks": len(payloads), "meeting_id": meeting_id}

    except Exception as e:
        logger.error(f"Error updating notes embeddings for meeting {meeting_id}: {e}", exc_info=True)
        return {"status": "error", "meeting_id": meeting_id, "error": str(e)}
    finally:
        db.close()


@celery_app.task(
    bind=True,
    autoretry_for=(ConnectionError, TimeoutError),
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
    max_retries=3,
)
def index_attachment(self, attachment_id: int):
    """
    Index a single attachment without recomputing all meeting embeddings.

    Args:
        attachment_id: ID of the attachment to index

    Auto-retries on ConnectionError/TimeoutError with exponential backoff.
    """
    db = SessionLocal()
    try:
        logger.info(f"Indexing attachment {attachment_id}")

        # Get attachment
        attachment = db.query(models.Attachment).filter(models.Attachment.id == attachment_id).first()

        if not attachment:
            logger.warning(f"Attachment {attachment_id} not found")
            return {"status": "error", "reason": "attachment_not_found"}

        meeting_id = attachment.meeting_id

        # Get embedding provider
        provider, config = get_embedding_provider(db)

        # Extract text from attachment
        try:
            text = extract_text(attachment.filepath)
            if not text or not text.strip():
                logger.info(f"No text extracted from attachment {attachment_id}")
                return {"status": "completed", "chunks": 0}
        except Exception as e:
            logger.warning(f"Failed to extract text from attachment {attachment_id}: {e}")
            return {"status": "error", "reason": "text_extraction_failed", "error": str(e)}

        # Create chunks
        attachment_chunks = chunking.chunk_document(
            text,
            metadata={"section": "attachment", "attachment_id": attachment.id, "attachment_name": attachment.filename},
        )

        if not attachment_chunks:
            logger.info(f"No chunks generated from attachment {attachment_id}")
            return {"status": "completed", "chunks": 0}

        # Build payloads
        payloads = []
        meeting = crud.get_meeting(db, meeting_id)
        for i, chunk in enumerate(attachment_chunks):
            metadata = dict(chunk.metadata or {})
            metadata.setdefault("meeting_id", meeting_id)
            metadata.setdefault("meeting_name", meeting.filename if meeting else "Unknown")
            payloads.append(
                {
                    "content": chunk.content,
                    "content_type": chunk.content_type,
                    "chunk_index": i,
                    "metadata": metadata,
                    "attachment_id": attachment.id,
                }
            )

        # Compute embeddings
        embeddings = batched_embeddings(provider, [p["content"] for p in payloads])

        # Store in vector store
        DEFAULT_VECTOR_STORE.add_documents(
            db,
            meeting_id=meeting_id,
            chunks=payloads,
            embeddings=embeddings,
            embedding_config_id=config.id,
        )

        logger.info(f"Indexed {len(payloads)} chunks for attachment {attachment_id}")
        return {"status": "completed", "chunks": len(payloads), "attachment_id": attachment_id}

    except Exception as e:
        logger.error(f"Error indexing attachment {attachment_id}: {e}", exc_info=True)
        return {"status": "error", "attachment_id": attachment_id, "error": str(e)}
    finally:
        db.close()


@celery_app.task(
    bind=True,
    autoretry_for=(ConnectionError, TimeoutError),
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
    max_retries=3,
)
def index_project_note(self, note_id: int):
    """Index a project note for RAG."""
    db = SessionLocal()
    try:
        note = db.query(models.ProjectNote).filter(models.ProjectNote.id == note_id).first()
        if not note:
            return {"status": "error", "reason": "note_not_found"}

        provider, config = get_embedding_provider(db)

        DEFAULT_PROJECT_VECTOR_STORE.delete_note_content_by_note_id(db, note_id)

        if not note.content:
            return {"status": "completed", "chunks": 0, "note_id": note_id}

        note_chunks = chunking.chunk_notes(
            note.content,
            metadata={
                "section": "project_note",
                "note_id": note.id,
                "note_title": note.title,
            },
        )

        if not note_chunks:
            return {"status": "completed", "chunks": 0, "note_id": note_id}

        payloads = []
        for i, chunk in enumerate(note_chunks):
            metadata = dict(chunk.metadata or {})
            payloads.append(
                {
                    "content": chunk.content,
                    "content_type": chunk.content_type,
                    "chunk_index": i,
                    "metadata": metadata,
                    "note_id": note.id,
                }
            )

        embeddings = batched_embeddings(provider, [p["content"] for p in payloads])

        DEFAULT_PROJECT_VECTOR_STORE.add_documents(
            db,
            project_id=note.project_id,
            chunks=payloads,
            embeddings=embeddings,
            embedding_config_id=config.id,
        )

        return {"status": "completed", "chunks": len(payloads), "note_id": note_id}
    except Exception as e:
        logger.error(f"Error indexing project note {note_id}: {e}", exc_info=True)
        return {"status": "error", "note_id": note_id, "error": str(e)}
    finally:
        db.close()


@celery_app.task(
    bind=True,
    autoretry_for=(ConnectionError, TimeoutError),
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
    max_retries=3,
)
def index_project_note_attachment(self, attachment_id: int):
    """Index a single project note attachment for RAG."""
    db = SessionLocal()
    try:
        attachment = (
            db.query(models.ProjectNoteAttachment).filter(models.ProjectNoteAttachment.id == attachment_id).first()
        )
        if not attachment:
            return {"status": "error", "reason": "attachment_not_found"}

        provider, config = get_embedding_provider(db)

        DEFAULT_PROJECT_VECTOR_STORE.delete_by_attachment_id(db, attachment_id)

        try:
            text = extract_text(attachment.filepath, attachment.mime_type)
        except Exception as e:
            logger.warning(f"Failed to extract text from project attachment {attachment_id}: {e}")
            return {"status": "error", "reason": "text_extraction_failed", "error": str(e)}

        if not text or not text.strip():
            return {"status": "completed", "chunks": 0, "attachment_id": attachment_id}

        note_title = None
        if attachment.note_id:
            note = db.query(models.ProjectNote).filter(models.ProjectNote.id == attachment.note_id).first()
            note_title = note.title if note else None

        attachment_chunks = chunking.chunk_document(
            text,
            metadata={
                "section": "project_note_attachment",
                "note_id": attachment.note_id,
                "note_title": note_title,
                "attachment_id": attachment.id,
                "attachment_name": attachment.filename,
            },
        )

        if not attachment_chunks:
            return {"status": "completed", "chunks": 0, "attachment_id": attachment_id}

        payloads = []
        for i, chunk in enumerate(attachment_chunks):
            metadata = dict(chunk.metadata or {})
            payloads.append(
                {
                    "content": chunk.content,
                    "content_type": chunk.content_type,
                    "chunk_index": i,
                    "metadata": metadata,
                    "note_id": attachment.note_id,
                    "attachment_id": attachment.id,
                }
            )

        embeddings = batched_embeddings(provider, [p["content"] for p in payloads])

        DEFAULT_PROJECT_VECTOR_STORE.add_documents(
            db,
            project_id=attachment.project_id,
            chunks=payloads,
            embeddings=embeddings,
            embedding_config_id=config.id,
        )

        return {"status": "completed", "chunks": len(payloads), "attachment_id": attachment_id}
    except Exception as e:
        logger.error(f"Error indexing project attachment {attachment_id}: {e}", exc_info=True)
        return {"status": "error", "attachment_id": attachment_id, "error": str(e)}
    finally:
        db.close()


@celery_app.task(
    bind=True,
    autoretry_for=(ConnectionError, TimeoutError),
    retry_backoff=True,
    retry_backoff_max=120,
    retry_jitter=True,
    max_retries=3,
)
def remove_project_note_embeddings(self, note_id: int):
    """Remove embeddings for a deleted project note."""
    db = SessionLocal()
    try:
        DEFAULT_PROJECT_VECTOR_STORE.delete_by_note_id(db, note_id)
        return {"status": "completed", "note_id": note_id}
    except Exception as e:
        logger.error(f"Error removing project note embeddings {note_id}: {e}", exc_info=True)
        return {"status": "error", "note_id": note_id, "error": str(e)}
    finally:
        db.close()


@celery_app.task(
    bind=True,
    autoretry_for=(ConnectionError, TimeoutError),
    retry_backoff=True,
    retry_backoff_max=120,
    retry_jitter=True,
    max_retries=3,
)
def remove_project_attachment_embeddings(self, attachment_id: int):
    """Remove embeddings for a deleted project note attachment."""
    db = SessionLocal()
    try:
        DEFAULT_PROJECT_VECTOR_STORE.delete_by_attachment_id(db, attachment_id)
        return {"status": "completed", "attachment_id": attachment_id}
    except Exception as e:
        logger.error(f"Error removing project attachment embeddings {attachment_id}: {e}", exc_info=True)
        return {"status": "error", "attachment_id": attachment_id, "error": str(e)}
    finally:
        db.close()


@celery_app.task(
    bind=True,
    autoretry_for=(ConnectionError,),
    retry_backoff=True,
    retry_backoff_max=120,
    retry_jitter=True,
    max_retries=3,
)
def remove_attachment_embeddings(self, meeting_id: int, attachment_id: int):
    """
    Remove embeddings for a deleted attachment from the vector store.

    Args:
        meeting_id: ID of the meeting
        attachment_id: ID of the deleted attachment

    Auto-retries on ConnectionError with exponential backoff.
    """
    db = SessionLocal()
    try:
        logger.info(f"Removing embeddings for attachment {attachment_id} from meeting {meeting_id}")

        # Remove chunks associated with this attachment
        DEFAULT_VECTOR_STORE.delete_chunks_by_metadata(
            db, meeting_id=meeting_id, metadata_filter={"attachment_id": attachment_id}
        )

        logger.info(f"Removed embeddings for attachment {attachment_id}")
        return {"status": "completed", "attachment_id": attachment_id, "meeting_id": meeting_id}

    except Exception as e:
        logger.error(f"Error removing embeddings for attachment {attachment_id}: {e}", exc_info=True)
        return {"status": "error", "attachment_id": attachment_id, "error": str(e)}
    finally:
        db.close()
