-- Create periodic_scans table to store scheduled scan configurations
CREATE TABLE IF NOT EXISTS periodic_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scan_type VARCHAR(20) NOT NULL CHECK (scan_type IN ('web', 'document')),
    scan_title VARCHAR(255) NOT NULL,
    url VARCHAR(500), -- For web scans
    file_name VARCHAR(255), -- For document scans (if applicable)
    file_type VARCHAR(50), -- For document scans
    scan_settings JSONB NOT NULL, -- Store all scan configuration (pages, WCAG level, etc.)
    frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
    next_run_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_run_at TIMESTAMP WITH TIME ZONE,
    last_scan_id UUID REFERENCES scan_history(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_periodic_scans_user_id ON periodic_scans(user_id);
CREATE INDEX IF NOT EXISTS idx_periodic_scans_next_run ON periodic_scans(next_run_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_periodic_scans_active ON periodic_scans(is_active);

-- Add comments for documentation
COMMENT ON TABLE periodic_scans IS 'Stores scheduled periodic scan configurations';
COMMENT ON COLUMN periodic_scans.scan_settings IS 'Complete scan configuration including pages, WCAG level, tags, etc.';
COMMENT ON COLUMN periodic_scans.frequency IS 'How often the scan should run: daily, weekly, or monthly';
COMMENT ON COLUMN periodic_scans.next_run_at IS 'When the next scan should be executed';
COMMENT ON COLUMN periodic_scans.last_scan_id IS 'Reference to the most recent scan result';
