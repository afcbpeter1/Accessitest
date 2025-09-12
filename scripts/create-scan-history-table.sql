-- Create scan_history table to store completed scan results
CREATE TABLE IF NOT EXISTS scan_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scan_type VARCHAR(20) NOT NULL CHECK (scan_type IN ('web', 'document')),
    scan_title VARCHAR(255) NOT NULL,
    url VARCHAR(500), -- For web scans
    file_name VARCHAR(255), -- For document scans
    file_type VARCHAR(50), -- For document scans (pdf, docx, etc.)
    scan_results JSONB NOT NULL, -- Store the complete scan results
    compliance_summary JSONB, -- Store compliance summary
    remediation_report JSONB, -- Store remediation report
    total_issues INTEGER DEFAULT 0,
    critical_issues INTEGER DEFAULT 0,
    serious_issues INTEGER DEFAULT 0,
    moderate_issues INTEGER DEFAULT 0,
    minor_issues INTEGER DEFAULT 0,
    pages_scanned INTEGER DEFAULT 1, -- For web scans
    pages_analyzed INTEGER DEFAULT 1, -- For document scans
    overall_score INTEGER, -- For document scans
    is_508_compliant BOOLEAN, -- For document scans
    scan_duration_seconds INTEGER, -- How long the scan took
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_scan_history_user_id ON scan_history(user_id);
CREATE INDEX IF NOT EXISTS idx_scan_history_scan_type ON scan_history(scan_type);
CREATE INDEX IF NOT EXISTS idx_scan_history_created_at ON scan_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_history_user_created ON scan_history(user_id, created_at DESC);

-- Add comments for documentation
COMMENT ON TABLE scan_history IS 'Stores completed scan results for both web and document scans';
COMMENT ON COLUMN scan_history.scan_results IS 'Complete scan results including issues, screenshots, and analysis';
COMMENT ON COLUMN scan_history.compliance_summary IS 'Summary of compliance status and statistics';
COMMENT ON COLUMN scan_history.remediation_report IS 'AI-generated remediation recommendations';
