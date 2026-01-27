-- Migration script for diary feature
-- Creates diary_entries and diary_action_item_snapshots tables

-- Create diary_entries table
CREATE TABLE IF NOT EXISTS diary_entries (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    content TEXT,
    mood VARCHAR(50),
    highlights JSON,
    blockers JSON,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reminder_dismissed BOOLEAN DEFAULT FALSE NOT NULL,
    is_work_day BOOLEAN DEFAULT TRUE NOT NULL,
    -- Time tracking fields
    arrival_time VARCHAR(5),
    departure_time VARCHAR(5),
    hours_worked FLOAT,
    action_items_worked_on JSON,
    action_items_completed JSON,
    meetings_attended JSON
);

-- Create index on date column for fast lookups
CREATE INDEX IF NOT EXISTS idx_diary_entries_date ON diary_entries(date);

-- Create diary_action_item_snapshots table
CREATE TABLE IF NOT EXISTS diary_action_item_snapshots (
    id SERIAL PRIMARY KEY,
    diary_entry_id INTEGER NOT NULL REFERENCES diary_entries(id) ON DELETE CASCADE,
    action_item_id INTEGER NOT NULL REFERENCES action_items(id) ON DELETE CASCADE,
    previous_status VARCHAR(50),
    current_status VARCHAR(50) NOT NULL,
    status_changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

-- Create composite index for efficient queries
CREATE INDEX IF NOT EXISTS idx_diary_action_item 
ON diary_action_item_snapshots(diary_entry_id, action_item_id);

-- Create index on diary_entry_id for foreign key lookups
CREATE INDEX IF NOT EXISTS idx_diary_action_item_snapshots_diary_entry_id 
ON diary_action_item_snapshots(diary_entry_id);

-- Create index on action_item_id for foreign key lookups
CREATE INDEX IF NOT EXISTS idx_diary_action_item_snapshots_action_item_id 
ON diary_action_item_snapshots(action_item_id);

-- Add trigger to update updated_at timestamp on diary_entries
CREATE OR REPLACE FUNCTION update_diary_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_diary_entries_updated_at
    BEFORE UPDATE ON diary_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_diary_entries_updated_at();

-- Migration to add time tracking fields to existing tables
DO $$
BEGIN
    -- Add arrival_time column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='diary_entries' AND column_name='arrival_time') THEN
        ALTER TABLE diary_entries ADD COLUMN arrival_time VARCHAR(5);
    END IF;
    
    -- Add departure_time column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='diary_entries' AND column_name='departure_time') THEN
        ALTER TABLE diary_entries ADD COLUMN departure_time VARCHAR(5);
    END IF;
    
    -- Add hours_worked column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='diary_entries' AND column_name='hours_worked') THEN
        ALTER TABLE diary_entries ADD COLUMN hours_worked FLOAT;
    END IF;
    
    -- Add action_items_worked_on column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='diary_entries' AND column_name='action_items_worked_on') THEN
        ALTER TABLE diary_entries ADD COLUMN action_items_worked_on JSON;
    END IF;
    
    -- Add action_items_completed column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='diary_entries' AND column_name='action_items_completed') THEN
        ALTER TABLE diary_entries ADD COLUMN action_items_completed JSON;
    END IF;
    
    -- Add meetings_attended column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='diary_entries' AND column_name='meetings_attended') THEN
        ALTER TABLE diary_entries ADD COLUMN meetings_attended JSON;
    END IF;
END $$;

-- Rollback script (commented out, uncomment to rollback)
-- DROP TRIGGER IF EXISTS trigger_update_diary_entries_updated_at ON diary_entries;
-- DROP FUNCTION IF EXISTS update_diary_entries_updated_at();
-- DROP TABLE IF EXISTS diary_action_item_snapshots CASCADE;
-- DROP TABLE IF EXISTS diary_entries CASCADE;
