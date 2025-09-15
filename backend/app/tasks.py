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
        from .core.pipeline import run_processing_pipeline
        run_processing_pipeline(db=db, meeting_id=meeting_id)

        # The status is updated to COMPLETED inside the pipeline/crud function.
        logger.info(f"Processing for meeting {meeting_id} completed successfully.")

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
