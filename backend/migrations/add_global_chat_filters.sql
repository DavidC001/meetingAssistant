-- Migration: Add filter columns to global_chat_sessions table
-- Date: 2025-11-04
-- Description: Adds filter_folder and filter_tags columns to support filtered global chat

ALTER TABLE global_chat_sessions 
ADD COLUMN IF NOT EXISTS filter_folder VARCHAR(255),
ADD COLUMN IF NOT EXISTS filter_tags TEXT;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_global_chat_sessions_filter_folder ON global_chat_sessions(filter_folder);
CREATE INDEX IF NOT EXISTS idx_global_chat_sessions_filter_tags ON global_chat_sessions(filter_tags);

-- Add comment to describe the columns
COMMENT ON COLUMN global_chat_sessions.filter_folder IS 'Optional folder filter to constrain RAG retrieval to specific folder';
COMMENT ON COLUMN global_chat_sessions.filter_tags IS 'Optional comma-separated tags to constrain RAG retrieval to meetings with matching tags';
