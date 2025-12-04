"""
Migration script to convert old transcript format to new grouped format.

This script:
1. Removes timestamps from transcripts
2. Groups consecutive utterances from the same speaker
3. Updates all existing transcripts in the database

Run this script with:
    python -m backend.app.scripts.migrate_transcript_format
"""
import sys
import os
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

import logging
from sqlalchemy.orm import Session

try:
    # Try Docker/production import path first
    from app.database import SessionLocal
    from app import models
    from app.core.processing.transcript_formatter import convert_old_transcript_format
except ImportError:
    # Fallback to development import path
    from backend.app.database import SessionLocal
    from backend.app import models
    from backend.app.core.processing.transcript_formatter import convert_old_transcript_format

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def migrate_transcripts(db: Session, dry_run: bool = False):
    """
    Migrate all transcripts from old format to new grouped format.
    
    Args:
        db: Database session
        dry_run: If True, only show what would be changed without making changes
    """
    # Get all meetings with transcriptions
    meetings = db.query(models.Meeting).join(
        models.Transcription,
        models.Meeting.id == models.Transcription.meeting_id
    ).all()
    
    total_meetings = len(meetings)
    logger.info(f"Found {total_meetings} meetings with transcriptions to process")
    
    if total_meetings == 0:
        logger.info("No transcripts to migrate")
        return
    
    migrated_count = 0
    error_count = 0
    skipped_count = 0
    
    for i, meeting in enumerate(meetings, 1):
        meeting_id = meeting.id
        filename = meeting.filename
        
        logger.info(f"[{i}/{total_meetings}] Processing meeting {meeting_id}: {filename}")
        
        if not meeting.transcription or not meeting.transcription.full_text:
            logger.warning(f"  Skipping - no transcript text found")
            skipped_count += 1
            continue
        
        old_transcript = meeting.transcription.full_text
        
        # Check if transcript is already in new format (no timestamps)
        # Old format has pattern: "Speaker (X.XXs - Y.YYs): text"
        import re
        timestamp_pattern = re.compile(r'\(\d+\.\d+s\s*-\s*\d+\.\d+s\)')
        
        if not timestamp_pattern.search(old_transcript):
            logger.info(f"  Already in new format - skipping")
            skipped_count += 1
            continue
        
        try:
            # Convert to new format
            new_transcript = convert_old_transcript_format(old_transcript)
            
            if not new_transcript:
                logger.error(f"  Conversion resulted in empty transcript!")
                error_count += 1
                continue
            
            # Log sample of changes
            old_lines = old_transcript.split('\n')[:3]
            new_lines = new_transcript.split('\n')[:3]
            logger.info(f"  Old format (first 3 lines):")
            for line in old_lines:
                logger.info(f"    {line[:100]}...")
            logger.info(f"  New format (first 3 lines):")
            for line in new_lines:
                logger.info(f"    {line[:100]}...")
            
            if not dry_run:
                # Update the transcript
                meeting.transcription.full_text = new_transcript
                db.commit()
                logger.info(f"  ✓ Successfully migrated")
            else:
                logger.info(f"  ✓ Would be migrated (dry run)")
            
            migrated_count += 1
            
        except Exception as e:
            logger.error(f"  ✗ Error migrating transcript: {e}", exc_info=True)
            error_count += 1
            db.rollback()
    
    # Summary
    logger.info("")
    logger.info("=" * 60)
    logger.info("Migration Summary")
    logger.info("=" * 60)
    logger.info(f"Total meetings: {total_meetings}")
    logger.info(f"Migrated: {migrated_count}")
    logger.info(f"Skipped (already new format or no transcript): {skipped_count}")
    logger.info(f"Errors: {error_count}")
    
    if dry_run:
        logger.info("")
        logger.info("DRY RUN - No changes were made to the database")
        logger.info("Run without --dry-run to apply changes")


def main():
    """Main entry point for migration script."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Migrate transcript format to remove timestamps and group speakers'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be changed without making changes'
    )
    
    args = parser.parse_args()
    
    logger.info("Starting transcript format migration")
    logger.info(f"Mode: {'DRY RUN' if args.dry_run else 'LIVE'}")
    logger.info("")
    
    db = SessionLocal()
    try:
        migrate_transcripts(db, dry_run=args.dry_run)
    finally:
        db.close()
    
    logger.info("")
    logger.info("Migration completed")


if __name__ == "__main__":
    main()
