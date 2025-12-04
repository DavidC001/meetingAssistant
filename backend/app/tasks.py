from .worker import celery_app
from .database import SessionLocal
from . import crud, models, schemas
from .core.processing import chunking
from .core.storage.embeddings import batched_embeddings, get_embedding_provider
from .core.processing.document_processor import extract_text
from .core.storage.vector_store import DEFAULT_VECTOR_STORE
from typing import Any, Dict, List
import time
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _build_chunk_payloads(meeting: models.Meeting) -> List[Dict[str, Any]]:
    """Convert meeting artefacts into chunk payloads for embedding."""

    payloads: List[Dict[str, Any]] = []
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


@celery_app.task(bind=True)
def process_meeting_task(self, meeting_id: int):
    """
    Celery task to process a meeting file.
    It will perform transcription, analysis, and save the results.
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
            processing_logs=['Processing started']
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
            db, 
            meeting_id, 
            error_message=error_message,
            stage_progress=0.0,
            overall_progress=0.0
        )
        
        # You might want to re-raise the exception if you want Celery to record it as a failure
        raise
    finally:
        db.close()

    return {"status": "Completed", "meeting_id": meeting_id}


@celery_app.task
def compute_embeddings_for_meeting(meeting_id: int) -> Dict[str, Any]:
    """Compute embeddings for a meeting's transcript, notes, action items, and attachments."""

    db = SessionLocal()
    try:
        logger.info(f"Starting embedding computation for meeting {meeting_id}")
        meeting = crud.get_meeting(db, meeting_id)
        if not meeting:
            raise ValueError(f"Meeting {meeting_id} not found")

        logger.info(f"Getting embedding provider for meeting {meeting_id}")
        try:
            provider, config = get_embedding_provider(db)
            logger.info(f"Using embedding provider: {config.provider}, model: {config.model_name}, dimension: {config.dimension}")
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
        
        logger.info(f"Storing embeddings in vector store")
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
def recompute_all_embeddings() -> Dict[str, Any]:
    """Queue embedding recomputation for all meetings."""

    db = SessionLocal()
    try:
        meeting_ids = [meeting.id for meeting in crud.get_meetings(db, skip=0, limit=100000)]
    finally:
        db.close()

    for meeting_id in meeting_ids:
        compute_embeddings_for_meeting.delay(meeting_id)

    return {"status": "queued", "meetings": len(meeting_ids)}
