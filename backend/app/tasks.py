from .worker import celery_app
from .database import SessionLocal
from . import crud, models, schemas
import time
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@celery_app.task(bind=True)
def process_meeting_task(self, meeting_id: int):
    """
    Celery task to process a meeting file.
    It will perform transcription, analysis, and save the results.
    """
    logger.info(f"Starting processing for meeting_id: {meeting_id}")
    db = SessionLocal()

    try:
        # 1. Update meeting status to PROCESSING
        crud.update_meeting_status(db, meeting_id, models.MeetingStatus.PROCESSING)
        logger.info(f"Meeting {meeting_id} status updated to PROCESSING.")

        # 2. Get meeting details from DB
        meeting = crud.get_meeting(db, meeting_id)
        if not meeting:
            logger.error(f"Meeting with id {meeting_id} not found.")
            raise ValueError("Meeting not found")

        # 3. Run the actual processing pipeline
        from .core.pipeline import run_processing_pipeline
        run_processing_pipeline(db=db, meeting_id=meeting_id)

        # The status is updated to COMPLETED inside the pipeline/crud function.
        logger.info(f"Processing for meeting {meeting_id} completed successfully.")

    except Exception as e:
        logger.error(f"Error processing meeting {meeting_id}: {e}", exc_info=True)
        # Mark the task as failed in the database
        crud.update_meeting_status(db, meeting_id, models.MeetingStatus.FAILED)
        # You might want to re-raise the exception if you want Celery to record it as a failure
        raise
    finally:
        db.close()

    return {"status": "Completed", "meeting_id": meeting_id}
