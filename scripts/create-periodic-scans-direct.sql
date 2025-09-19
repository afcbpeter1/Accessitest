-- Create periodic_scans table directly
CREATE TABLE IF NOT EXISTS periodic_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scan_type VARCHAR(20) NOT NULL CHECK (scan_type IN ('web', 'document')),
    scan_title VARCHAR(255) NOT NULL,
    url VARCHAR(500), -- For web scans
    file_name VARCHAR(255), -- For document scans
    file_type VARCHAR(50), -- For document scans
    scan_settings JSONB NOT NULL, -- Store all original scan settings (pagesToScan, includeSubdomains, wcagLevel, selectedTags, etc.)
    frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
    next_run_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_run_at TIMESTAMP WITH TIME ZONE,
    last_scan_id UUID REFERENCES scan_history(id) ON DELETE SET NULL, -- Link to the last completed scan
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_periodic_scans_user_id ON periodic_scans(user_id);
CREATE INDEX IF NOT EXISTS idx_periodic_scans_next_run_at ON periodic_scans(next_run_at);
CREATE INDEX IF NOT EXISTS idx_periodic_scans_is_active ON periodic_scans(is_active);

COMMENT ON TABLE periodic_scans IS 'Stores configurations for recurring accessibility scans';
COMMENT ON COLUMN periodic_scans.scan_settings IS 'JSON object containing all original scan parameters (e.g., pagesToScan, includeSubdomains, wcagLevel, selectedTags)';
