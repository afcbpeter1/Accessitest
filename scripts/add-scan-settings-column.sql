-- Add scan_settings column to scan_history table
-- This column will store the original scan settings for rerun functionality

ALTER TABLE scan_history 
ADD COLUMN IF NOT EXISTS scan_settings JSONB;

-- Add comment for documentation
COMMENT ON COLUMN scan_history.scan_settings IS 'Original scan settings including pagesToScan, includeSubdomains, wcagLevel, selectedTags, etc. for rerun functionality';

-- Create index for better performance when querying scan settings
CREATE INDEX IF NOT EXISTS idx_scan_history_scan_settings ON scan_history USING GIN (scan_settings);
