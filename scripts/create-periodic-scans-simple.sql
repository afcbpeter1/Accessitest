-- Simple SQL script to create periodic scans tables
-- Run this manually in your database when ready

-- Create periodic_scans table
CREATE TABLE IF NOT EXISTS periodic_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Scan details
    scan_type VARCHAR(50) NOT NULL,
    scan_title VARCHAR(255) NOT NULL,
    url TEXT,
    file_name VARCHAR(255),
    file_type VARCHAR(50),
    
    -- Scheduling options
    frequency VARCHAR(20) NOT NULL,
    custom_cron VARCHAR(100),
    
    -- Date/time scheduling
    scheduled_date DATE,
    scheduled_time TIME,
    timezone VARCHAR(50) DEFAULT 'UTC',
    
    -- Recurring options
    days_of_week INTEGER[],
    day_of_month INTEGER,
    end_date DATE,
    
    -- Status and execution
    status VARCHAR(20) DEFAULT 'scheduled',
    last_run_at TIMESTAMP,
    next_run_at TIMESTAMP,
    run_count INTEGER DEFAULT 0,
    max_runs INTEGER,
    
    -- Notification preferences
    notify_on_completion BOOLEAN DEFAULT true,
    notify_on_failure BOOLEAN DEFAULT true,
    email_notifications BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(255),
    notes TEXT
);

-- Create periodic_scan_executions table
CREATE TABLE IF NOT EXISTS periodic_scan_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    periodic_scan_id UUID NOT NULL REFERENCES periodic_scans(id) ON DELETE CASCADE,
    scan_history_id UUID REFERENCES scan_history(id),
    
    -- Execution details
    scheduled_at TIMESTAMP NOT NULL,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    status VARCHAR(20) NOT NULL,
    
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_periodic_scans_user_id ON periodic_scans(user_id);
CREATE INDEX IF NOT EXISTS idx_periodic_scans_status ON periodic_scans(status);
CREATE INDEX IF NOT EXISTS idx_periodic_scans_next_run ON periodic_scans(next_run_at);
CREATE INDEX IF NOT EXISTS idx_scan_executions_periodic_scan_id ON periodic_scan_executions(periodic_scan_id);
CREATE INDEX IF NOT EXISTS idx_scan_executions_status ON periodic_scan_executions(status);
 