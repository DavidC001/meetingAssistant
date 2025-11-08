-- Migration: Add max_reasoning_depth to model_configurations table
-- Date: 2025-11-04
-- Description: Adds max_reasoning_depth column to support multi-step reasoning tool configuration

ALTER TABLE model_configurations 
ADD COLUMN IF NOT EXISTS max_reasoning_depth INTEGER DEFAULT 3;

-- Add constraint to ensure reasonable depth values
ALTER TABLE model_configurations 
ADD CONSTRAINT check_max_reasoning_depth 
CHECK (max_reasoning_depth >= 1 AND max_reasoning_depth <= 10);

-- Add comment to describe the column
COMMENT ON COLUMN model_configurations.max_reasoning_depth IS 'Maximum depth for iterative research tool (1-10, default 3)';
