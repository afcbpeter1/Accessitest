-- Add VPN detection tracking
-- Run this in your database

-- Add VPN detection results table
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

-- Add indexes for VPN detection
CREATE INDEX IF NOT EXISTS idx_vpn_detection_ip ON vpn_detection_log(ip_address);
CREATE INDEX IF NOT EXISTS idx_vpn_detection_detected_at ON vpn_detection_log(detected_at);
CREATE INDEX IF NOT EXISTS idx_vpn_detection_risk ON vpn_detection_log(risk_level);

-- Add blocked IPs table for manual blocking
CREATE TABLE IF NOT EXISTS blocked_ips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address VARCHAR(45) NOT NULL UNIQUE,
    reason VARCHAR(255),
    blocked_at TIMESTAMP DEFAULT NOW(),
    blocked_by VARCHAR(255) DEFAULT 'system'
);

-- Add index for blocked IPs
CREATE INDEX IF NOT EXISTS idx_blocked_ips_address ON blocked_ips(ip_address);
