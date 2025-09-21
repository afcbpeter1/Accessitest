-- Periodic Scans Database Setup
-- Run this SQL script in your PostgreSQL database

-- Create periodic_scans table for scheduling recurring accessibility scans
CREATE TABLE IF NOT EXISTS periodic_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Scan details
    scan_type VARCHAR(50) NOT NULL, -- 'web', 'document'
    scan_title VARCHAR(255) NOT NULL,
    url TEXT, -- For web scans
    file_name VARCHAR(255), -- For document scans
    file_type VARCHAR(50), -- For document scans
    
    -- Scheduling options
    frequency VARCHAR(20) NOT NULL, -- 'once', 'daily', 'weekly', 'monthly', 'custom'
    custom_cron VARCHAR(100), -- For custom scheduling
    
    -- Date/time scheduling
    scheduled_date DATE, -- For one-time scans
    scheduled_time TIME, -- Time of day to run
    timezone VARCHAR(50) DEFAULT 'UTC', -- User's timezone
    
    -- Recurring options
    days_of_week INTEGER[], -- [1,2,3,4,5] for weekdays, [0,6] for weekends
    day_of_month INTEGER, -- For monthly scans (1-31)
    end_date DATE, -- Optional end date for recurring scans
    
    -- Status and execution
    status VARCHAR(20) DEFAULT 'scheduled', -- 'scheduled', 'running', 'paused', 'cancelled', 'completed'
    last_run_at TIMESTAMP,
    next_run_at TIMESTAMP,
    run_count INTEGER DEFAULT 0,
    max_runs INTEGER, -- Optional limit on number of runs
    
    -- Notification preferences
    notify_on_completion BOOLEAN DEFAULT true,
    notify_on_failure BOOLEAN DEFAULT true,
    email_notifications BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(255), -- User who created the scan
    notes TEXT -- Optional notes
);

-- Create periodic_scan_executions table to track individual scan runs
CREATE TABLE IF NOT EXISTS periodic_scan_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    periodic_scan_id UUID NOT NULL REFERENCES periodic_scans(id) ON DELETE CASCADE,
    scan_history_id UUID REFERENCES scan_history(id), -- Link to actual scan result
    
    -- Execution details
    scheduled_at TIMESTAMP NOT NULL,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    status VARCHAR(20) NOT NULL, -- 'pending', 'running', 'completed', 'failed', 'cancelled'
    
    -- Results summary
    total_issues INTEGER DEFAULT 0,
    critical_issues INTEGER DEFAULT 0,
    serious_issues INTEGER DEFAULT 0,
    moderate_issues INTEGER DEFAULT 0,
    minor_issues INTEGER DEFAULT 0,
    
    -- Error handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_periodic_scans_user_id ON periodic_scans(user_id);
CREATE INDEX IF NOT EXISTS idx_periodic_scans_status ON periodic_scans(status);
CREATE INDEX IF NOT EXISTS idx_periodic_scans_next_run ON periodic_scans(next_run_at);
CREATE INDEX IF NOT EXISTS idx_periodic_scans_scheduled_date ON periodic_scans(scheduled_date);

-- Create indexes for scan executions
CREATE INDEX IF NOT EXISTS idx_scan_executions_periodic_scan_id ON periodic_scan_executions(periodic_scan_id);
CREATE INDEX IF NOT EXISTS idx_scan_executions_status ON periodic_scan_executions(status);
CREATE INDEX IF NOT EXISTS idx_scan_executions_scheduled_at ON periodic_scan_executions(scheduled_at);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_periodic_scans_updated_at 
    BEFORE UPDATE ON periodic_scans 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_periodic_scan_executions_updated_at 
    BEFORE UPDATE ON periodic_scan_executions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Success message
SELECT 'Periodic scans tables created successfully!' as message;