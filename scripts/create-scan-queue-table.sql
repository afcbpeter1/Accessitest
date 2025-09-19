-- Create scan queue table for managing concurrent scans and rate limiting
CREATE TABLE IF NOT EXISTS scan_queue (
    id VARCHAR(255) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scan_type VARCHAR(20) NOT NULL CHECK (scan_type IN ('web', 'document')),
    url VARCHAR(500), -- For web scans
    file_name VARCHAR(255), -- For document scans
    file_type VARCHAR(50), -- For document scans
    scan_settings JSONB NOT NULL, -- Store all scan parameters
    priority VARCHAR(10) NOT NULL DEFAULT 'normal' CHECK (priority IN ('high', 'normal', 'low')),
    status VARCHAR(20) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error TEXT,
    estimated_duration INTEGER NOT NULL DEFAULT 300, -- in seconds
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_scan_queue_user_id ON scan_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_scan_queue_status ON scan_queue(status);
CREATE INDEX IF NOT EXISTS idx_scan_queue_priority ON scan_queue(priority);
CREATE INDEX IF NOT EXISTS idx_scan_queue_created_at ON scan_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_scan_queue_user_status ON scan_queue(user_id, status);

-- Create composite index for queue processing
CREATE INDEX IF NOT EXISTS idx_scan_queue_processing ON scan_queue(status, priority, created_at);

-- Add comments
COMMENT ON TABLE scan_queue IS 'Manages scan queue for rate limiting and concurrent scan control';
COMMENT ON COLUMN scan_queue.priority IS 'Scan priority: high (immediate), normal (standard), low (background)';
COMMENT ON COLUMN scan_queue.status IS 'Current scan status in the queue';
COMMENT ON COLUMN scan_queue.estimated_duration IS 'Estimated scan duration in seconds for queue management';
COMMENT ON COLUMN scan_queue.scan_settings IS 'JSON object containing all scan parameters and settings';
