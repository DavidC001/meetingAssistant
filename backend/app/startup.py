"""
Startup utilities for the Meeting Assistant application.
Handles recovery from Docker restarts and other initialization tasks.
"""

import logging

from .database import SessionLocal
from .modules.meetings.models import MeetingStatus, ProcessingStage
from .modules.meetings.repository import MeetingRepository
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
        interrupted_meetings = MeetingRepository(db).list_by_statuses([MeetingStatus.PROCESSING, MeetingStatus.PENDING])

        if not interrupted_meetings:
            logger.info("No interrupted processing jobs found.")
            return

        logger.info(f"Found {len(interrupted_meetings)} interrupted processing job(s)")

        for meeting in interrupted_meetings:
            # Check if meeting is actually already completed.
            # A meeting is complete when its transcription contains full_text.
            # NOTE: do NOT rely on action_items here — an empty list [] is falsy
            # but perfectly valid for a completed meeting.
            is_completed = meeting.transcription is not None and bool(meeting.transcription.full_text)

            if is_completed:
                logger.info(f"Meeting {meeting.id} appears to be completed, updating status to COMPLETED")
                meeting_repo = MeetingRepository(db)
                meeting_repo.update_status(meeting.id, MeetingStatus.COMPLETED)
                meeting_repo.update_processing_details(
                    meeting.id,
                    overall_progress=100.0,
                    stage_progress=100.0,
                    current_stage=ProcessingStage.ANALYSIS.value,
                )
                continue

            logger.info(f"Resuming processing for meeting {meeting.id}: {meeting.filename}")

            meeting_repo = MeetingRepository(db)
            # Reset the meeting to PENDING state
            meeting_repo.update_status(meeting.id, MeetingStatus.PENDING)

            # Clear any existing task ID since the old task is dead
            meeting_repo.update_task_id(meeting.id, None)

            # Add recovery log
            meeting_repo.update_processing_details(
                meeting.id, processing_logs=[f"Resumed processing after system restart at {meeting.id}"]
            )

            # Start a new processing task
            task_result = process_meeting_task.delay(meeting.id)
            meeting_repo.update_task_id(meeting.id, task_result.id)

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


def queue_missing_audio_generation():
    """
    Queue audio generation for meetings that are missing audio files.
    This is useful for backfilling audio for meetings processed before the audio_filepath feature.
    """
    logger.info("Checking for meetings missing audio files...")

    db = SessionLocal()
    try:
        from pathlib import Path

        from .tasks import generate_audio_for_existing_meeting

        # Find completed meetings without audio_filepath
        meetings_without_audio = MeetingRepository(db).list_completed_without_audio()

        # Also check for meetings with audio_filepath but missing file
        all_completed = MeetingRepository(db).list_completed_with_audio()

        meetings_with_missing_files = [m for m in all_completed if not Path(m.audio_filepath).exists()]

        meetings_needing_audio = meetings_without_audio + meetings_with_missing_files

        if not meetings_needing_audio:
            logger.info("All meetings have audio files.")
            return

        logger.info(f"Found {len(meetings_needing_audio)} meeting(s) missing audio files")

        queued_count = 0
        for meeting in meetings_needing_audio:
            # Verify source file exists before queuing
            if meeting.filepath and Path(meeting.filepath).exists():
                try:
                    task_result = generate_audio_for_existing_meeting.delay(meeting.id)
                    logger.info(f"Queued audio generation task {task_result.id} for meeting {meeting.id}")
                    queued_count += 1
                except Exception as e:
                    logger.warning(f"Failed to queue audio generation for meeting {meeting.id}: {e}")
            else:
                logger.warning(f"Skipping meeting {meeting.id}: source file not found at {meeting.filepath}")

        logger.info(f"Queued audio generation for {queued_count} meeting(s)")

    except Exception as e:
        logger.error(f"Error queuing missing audio generation: {e}", exc_info=True)
    finally:
        db.close()


def fix_diary_action_items():
    """
    Re-extract action items from existing diary entries.
    This is a one-time fix for entries that were created before the column type fix.
    """
    logger.info("Checking diary entries for action item extraction...")

    db = SessionLocal()
    try:
        from .modules.diary.models import DiaryEntry
        from .modules.diary.repository import DiaryRepository, extract_action_item_ids_from_content

        # Get all entries that have content but no action items extracted
        entries = DiaryRepository.get_entries_needing_action_item_fix(db)

        if not entries:
            logger.info("No diary entries need action item extraction.")
            return

        logger.info(f"Re-extracting action items from {len(entries)} diary entries")

        updated_count = 0
        for entry in entries:
            worked_on, completed = extract_action_item_ids_from_content(entry.content)

            if worked_on or completed:
                entry.action_items_worked_on = worked_on if worked_on else None
                entry.action_items_completed = completed if completed else None
                updated_count += 1

        db.commit()
        logger.info(f"Successfully updated {updated_count} diary entries with action items")

    except Exception as e:
        logger.error(f"Error fixing diary action items: {e}")
        db.rollback()
    finally:
        db.close()


def startup_recovery():
    """
    Main startup recovery function to be called when the application starts.
    """
    logger.info("Starting application recovery procedures...")

    # Clean up stale tasks first
    cleanup_stale_tasks()

    # Resume interrupted processing
    resume_interrupted_processing()

    # Queue audio generation for meetings missing audio files
    queue_missing_audio_generation()

    # Fix diary action items extraction
    fix_diary_action_items()

    logger.info("Application recovery procedures completed.")
