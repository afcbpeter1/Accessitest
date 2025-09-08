-- Combined migration script for AccessiTest
-- Run this in your database to fix all the missing tables and columns

-- 1. Add IP tracking to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_ip VARCHAR(45);

-- 2. Add email verification fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verification_code VARCHAR(6),
ADD COLUMN IF NOT EXISTS verification_code_expires_at TIMESTAMP WITH TIME ZONE;

-- 3. Create indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_last_ip ON users(last_ip);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_verification_code ON users(verification_code) WHERE verification_code IS NOT NULL;

-- 4. Create registration attempts table
CREATE TABLE IF NOT EXISTS registration_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address VARCHAR(45) NOT NULL,
    email VARCHAR(255) NOT NULL,
    attempted_at TIMESTAMP DEFAULT NOW(),
    success BOOLEAN DEFAULT FALSE,
    user_id UUID REFERENCES users(id)
);

-- 5. Create free scan usage table
CREATE TABLE IF NOT EXISTS free_scan_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address VARCHAR(45) NOT NULL,
    email VARCHAR(255),
    url_scanned TEXT NOT NULL,
    scanned_at TIMESTAMP DEFAULT NOW(),
    user_id UUID REFERENCES users(id)
);

-- 6. Create VPN detection log table
CREATE TABLE IF NOT EXISTS vpn_detection_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address VARCHAR(45) NOT NULL,
    is_vpn BOOLEAN DEFAULT FALSE,
    is_proxy BOOLEAN DEFAULT FALSE,
    is_tor BOOLEAN DEFAULT FALSE,
    country VARCHAR(2),
    provider VARCHAR(255),
    risk_level VARCHAR(10) CHECK (risk_level IN ('low', 'medium', 'high')),
    detected_at TIMESTAMP DEFAULT NOW(),
    user_id UUID REFERENCES users(id),
    action_type VARCHAR(50) -- 'registration', 'free_scan', 'login'
);

-- 7. Create blocked IPs table
CREATE TABLE IF NOT EXISTS blocked_ips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address VARCHAR(45) NOT NULL UNIQUE,
    reason VARCHAR(255),
    blocked_at TIMESTAMP DEFAULT NOW(),
    blocked_by VARCHAR(255) DEFAULT 'system'
);

-- 8. Create email verification attempts table
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

-- 9. Create all necessary indexes
CREATE INDEX IF NOT EXISTS idx_registration_attempts_ip ON registration_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_registration_attempts_attempted_at ON registration_attempts(attempted_at);
CREATE INDEX IF NOT EXISTS idx_registration_attempts_email ON registration_attempts(email);

CREATE INDEX IF NOT EXISTS idx_free_scan_ip ON free_scan_usage(ip_address);
CREATE INDEX IF NOT EXISTS idx_free_scan_attempted_at ON free_scan_usage(scanned_at);

CREATE INDEX IF NOT EXISTS idx_vpn_detection_ip ON vpn_detection_log(ip_address);
CREATE INDEX IF NOT EXISTS idx_vpn_detection_detected_at ON vpn_detection_log(detected_at);
CREATE INDEX IF NOT EXISTS idx_vpn_detection_risk ON vpn_detection_log(risk_level);

CREATE INDEX IF NOT EXISTS idx_blocked_ips_address ON blocked_ips(ip_address);

CREATE INDEX IF NOT EXISTS idx_email_verification_attempts_user_id ON email_verification_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_attempts_email ON email_verification_attempts(email);

-- 10. Enable RLS and create policies
ALTER TABLE email_verification_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own verification attempts" ON email_verification_attempts
    FOR SELECT USING (auth.uid() = user_id);

-- 11. Create trigger for email verification attempts
CREATE TRIGGER update_email_verification_attempts_updated_at
    BEFORE UPDATE ON email_verification_attempts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 12. Update existing users to have email_verified = false (they'll need to verify)
UPDATE users SET email_verified = FALSE WHERE email_verified IS NULL;

-- Success message
SELECT 'All migrations completed successfully!' as status;

