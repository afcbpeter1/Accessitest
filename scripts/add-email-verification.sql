-- Add email verification fields to users table
ALTER TABLE users 
ADD COLUMN email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN verification_code VARCHAR(6),
ADD COLUMN verification_code_expires_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster verification lookups
CREATE INDEX idx_users_verification_code ON users(verification_code) WHERE verification_code IS NOT NULL;

-- Create email verification attempts table for tracking
CREATE TABLE email_verification_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    verification_code VARCHAR(6) NOT NULL,
    attempts INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for verification attempts
CREATE INDEX idx_email_verification_attempts_user_id ON email_verification_attempts(user_id);
CREATE INDEX idx_email_verification_attempts_email ON email_verification_attempts(email);

-- Add RLS policy for email verification attempts
ALTER TABLE email_verification_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own verification attempts" ON email_verification_attempts
    FOR SELECT USING (auth.uid() = user_id);

-- Update the update_updated_at_column function trigger for email_verification_attempts
CREATE TRIGGER update_email_verification_attempts_updated_at
    BEFORE UPDATE ON email_verification_attempts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

