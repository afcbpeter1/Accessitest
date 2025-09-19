CREATE TABLE IF NOT EXISTS issue_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID NOT NULL REFERENCES scan_history(id) ON DELETE CASCADE,
    issue_id VARCHAR(255) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status JSONB NOT NULL, -- Store status object with status, dates, and deferred reason
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(scan_id, issue_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_issue_status_scan_id ON issue_status(scan_id);
CREATE INDEX IF NOT EXISTS idx_issue_status_user_id ON issue_status(user_id);
CREATE INDEX IF NOT EXISTS idx_issue_status_issue_id ON issue_status(issue_id);

COMMENT ON TABLE issue_status IS 'Tracks the status of individual accessibility issues within scans';
COMMENT ON COLUMN issue_status.status IS 'JSON object containing status (unread/read/actioned/deferred), dates, and deferred reason';
