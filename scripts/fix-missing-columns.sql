-- Fix missing columns in users table
-- Run this to add the missing columns

-- Add missing columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_ip VARCHAR(45);
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code VARCHAR(6);
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code_expires_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_users_last_ip ON users(last_ip);
CREATE INDEX IF NOT EXISTS idx_users_verification_code ON users(verification_code) WHERE verification_code IS NOT NULL;

-- Verify the columns were added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('last_ip', 'verification_code', 'verification_code_expires_at')
ORDER BY column_name;

