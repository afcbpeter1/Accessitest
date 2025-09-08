-- Create missing tables for AccessiTest
-- Run this to add the missing tables

-- Create vpn_detection_log table
CREATE TABLE IF NOT EXISTS vpn_detection_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address VARCHAR(45) NOT NULL,
    is_vpn BOOLEAN NOT NULL,
    detection_method VARCHAR(50),
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_agent TEXT,
    country VARCHAR(2),
    city VARCHAR(100),
    isp VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create registration_attempts table
CREATE TABLE IF NOT EXISTS registration_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address VARCHAR(45) NOT NULL,
    email VARCHAR(255) NOT NULL,
    attempted_at TIMESTAMP DEFAULT NOW(),
    success BOOLEAN DEFAULT FALSE,
    user_id UUID REFERENCES users(id)
);

-- Create free_scan_usage table
CREATE TABLE IF NOT EXISTS free_scan_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address VARCHAR(45) NOT NULL,
    email VARCHAR(255),
    url_scanned TEXT NOT NULL,
    scanned_at TIMESTAMP DEFAULT NOW(),
    user_id UUID REFERENCES users(id)
);

-- Create email_verification_attempts table
CREATE TABLE IF NOT EXISTS email_verification_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    verification_code VARCHAR(6) NOT NULL,
    attempts INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_vpn_detection_log_ip ON vpn_detection_log(ip_address);
CREATE INDEX IF NOT EXISTS idx_vpn_detection_log_detected_at ON vpn_detection_log(detected_at);
CREATE INDEX IF NOT EXISTS idx_registration_attempts_ip ON registration_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_registration_attempts_attempted_at ON registration_attempts(attempted_at);
CREATE INDEX IF NOT EXISTS idx_registration_attempts_email ON registration_attempts(email);
CREATE INDEX IF NOT EXISTS idx_free_scan_ip ON free_scan_usage(ip_address);
CREATE INDEX IF NOT EXISTS idx_free_scan_attempted_at ON free_scan_usage(scanned_at);
CREATE INDEX IF NOT EXISTS idx_email_verification_attempts_user_id ON email_verification_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_attempts_email ON email_verification_attempts(email);

-- Verify tables were created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('vpn_detection_log', 'registration_attempts', 'free_scan_usage', 'email_verification_attempts')
ORDER BY table_name;

