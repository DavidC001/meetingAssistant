-- Migration to add tags column to global_chat_sessions table
-- Date: 2025-10-12

-- Add tags column to global_chat_sessions
ALTER TABLE global_chat_sessions ADD COLUMN IF NOT EXISTS tags VARCHAR;

-- Add index for faster tag searches
CREATE INDEX IF NOT EXISTS idx_global_chat_sessions_tags ON global_chat_sessions(tags);
