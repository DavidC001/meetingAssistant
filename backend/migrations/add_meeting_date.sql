-- Add meeting_date column to meetings table
-- This allows users to specify when a meeting took place, separate from when it was uploaded

ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS meeting_date TIMESTAMP WITH TIME ZONE;

-- Add comment to the column
COMMENT ON COLUMN meetings.meeting_date IS 'The actual date and time when the meeting took place';
