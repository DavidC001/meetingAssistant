-- Migration: Convert transcript format to remove timestamps and group speakers
-- Date: 2025-11-04
-- Description: Updates all transcripts to new format without timestamps and with grouped consecutive speakers
-- 
-- WARNING: This migration modifies transcript data. It's recommended to backup the database first.
-- 
-- This SQL script provides a PostgreSQL function to migrate transcripts.
-- However, for more reliable conversion, use the Python script:
--     python -m backend.app.scripts.migrate_transcript_format
--
-- The Python script handles edge cases better and provides detailed logging.

-- Note: This is a placeholder for documentation purposes.
-- The actual migration should be run using the Python script for better control and error handling.

-- To run the Python migration script:
-- 1. Backup your database first
-- 2. Run in dry-run mode first to preview changes:
--    python -m backend.app.scripts.migrate_transcript_format --dry-run
-- 3. If everything looks good, run the actual migration:
--    python -m backend.app.scripts.migrate_transcript_format

-- The migration will:
-- 1. Find all transcripts with timestamps (old format)
-- 2. Remove timestamps from speaker lines
-- 3. Group consecutive utterances from the same speaker
-- 4. Update the transcript in the database

COMMENT ON TABLE transcriptions IS 
'Transcription table stores meeting transcripts. Format updated 2025-11-04 to remove timestamps and group consecutive speaker utterances.';
