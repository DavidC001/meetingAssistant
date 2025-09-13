"""
Startup utilities for the Meeting Assistant application.
Handles recovery from Docker restarts and other initialization tasks.
"""

import logging
from sqlalchemy.orm import Session
from . import crud, models
from .database import SessionLocal
from .tasks import process_meeting_task

logger = logging.getLogger(__name__)

def resume_interrupted_processing():
    """
    Find meetings that were processing when the system was interrupted
    and resume their processing.
    """
    logger.info("Checking for interrupted processing jobs...")
    
    db = SessionLocal()
    try:
        # Find meetings that are stuck in PROCESSING or PENDING state
        interrupted_meetings = db.query(models.Meeting).filter(
            models.Meeting.status.in_([models.MeetingStatus.PROCESSING.value, models.MeetingStatus.PENDING.value])
        ).all()
        
        if not interrupted_meetings:
            logger.info("No interrupted processing jobs found.")
            return
        
        logger.info(f"Found {len(interrupted_meetings)} interrupted processing job(s)")
        
        for meeting in interrupted_meetings:
            logger.info(f"Resuming processing for meeting {meeting.id}: {meeting.filename}")
            
            # Reset the meeting to PENDING state
            crud.update_meeting_status(db, meeting.id, models.MeetingStatus.PENDING)
            
            # Clear any existing task ID since the old task is dead
            crud.update_meeting_task_id(db, meeting.id, None)
            
            # Add recovery log
            crud.update_meeting_processing_details(
                db, meeting.id,
                processing_logs=[f"Resumed processing after system restart at {meeting.id}"]
            )
            
            # Start a new processing task
            task_result = process_meeting_task.delay(meeting.id)
            crud.update_meeting_task_id(db, meeting.id, task_result.id)
            
            logger.info(f"Restarted processing task {task_result.id} for meeting {meeting.id}")
            
    except Exception as e:
        logger.error(f"Error resuming interrupted processing: {e}", exc_info=True)
    finally:
        db.close()

def cleanup_stale_tasks():
    """
    Clean up any stale Celery tasks that may be left over from previous runs.
    """
    try:
        from .worker import celery_app
        
        # Get active tasks
        active_tasks = celery_app.control.inspect().active()
        if active_tasks:
            task_count = sum(len(tasks) for tasks in active_tasks.values()) if active_tasks else 0
            logger.info(f"Found {task_count} active Celery tasks")
        else:
            logger.info("No active Celery tasks found")
            
    except Exception as e:
        logger.warning(f"Could not inspect Celery tasks: {e}")

def startup_recovery():
    """
    Main startup recovery function to be called when the application starts.
    """
    logger.info("Starting application recovery procedures...")
    
    # Clean up stale tasks first
    cleanup_stale_tasks()
    
    # Resume interrupted processing
    resume_interrupted_processing()
    
    logger.info("Application recovery procedures completed.")
