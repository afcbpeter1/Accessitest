-- Add IP tracking to prevent multiple signups
-- Run this in your database

-- Add last_ip column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_ip VARCHAR(45);

-- Add index for faster IP lookups
CREATE INDEX IF NOT EXISTS idx_users_last_ip ON users(last_ip);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Add a table to track registration attempts
CREATE TABLE IF NOT EXISTS registration_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address VARCHAR(45) NOT NULL,
    email VARCHAR(255) NOT NULL,
    attempted_at TIMESTAMP DEFAULT NOW(),
    success BOOLEAN DEFAULT FALSE,
    user_id UUID REFERENCES users(id)
);

-- Add indexes for registration attempts
CREATE INDEX IF NOT EXISTS idx_registration_attempts_ip ON registration_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_registration_attempts_attempted_at ON registration_attempts(attempted_at);
CREATE INDEX IF NOT EXISTS idx_registration_attempts_email ON registration_attempts(email);

-- Add a table to track free scan usage
CREATE TABLE IF NOT EXISTS free_scan_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address VARCHAR(45) NOT NULL,
    email VARCHAR(255),
    url_scanned TEXT NOT NULL,
    scanned_at TIMESTAMP DEFAULT NOW(),
    user_id UUID REFERENCES users(id)
);

-- Add indexes for free scan tracking
CREATE INDEX IF NOT EXISTS idx_free_scan_ip ON free_scan_usage(ip_address);
CREATE INDEX IF NOT EXISTS idx_free_scan_attempted_at ON free_scan_usage(scanned_at);
