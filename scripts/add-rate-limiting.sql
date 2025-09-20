-- Add rate limiting table to track daily scan usage per user
CREATE TABLE IF NOT EXISTS user_scan_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scan_date DATE NOT NULL DEFAULT CURRENT_DATE,
    scan_count INTEGER NOT NULL DEFAULT 0,
    max_scans_per_day INTEGER NOT NULL DEFAULT 30,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, scan_date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_scan_limits_user_date ON user_scan_limits(user_id, scan_date);
CREATE INDEX IF NOT EXISTS idx_user_scan_limits_date ON user_scan_limits(scan_date);

-- Add comments
COMMENT ON TABLE user_scan_limits IS 'Tracks daily scan usage per user for rate limiting';
COMMENT ON COLUMN user_scan_limits.scan_count IS 'Number of scans performed by user today';
COMMENT ON COLUMN user_scan_limits.max_scans_per_day IS 'Maximum scans allowed per day for this user (default 30)';

-- Create a function to check and increment scan count
CREATE OR REPLACE FUNCTION check_and_increment_scan_count(
    p_user_id UUID,
    p_max_scans INTEGER DEFAULT 30
) RETURNS BOOLEAN AS $$
DECLARE
    current_count INTEGER;
    today_date DATE := CURRENT_DATE;
BEGIN
    -- Get or create today's record
    INSERT INTO user_scan_limits (user_id, scan_date, scan_count, max_scans_per_day)
    VALUES (p_user_id, today_date, 0, p_max_scans)
    ON CONFLICT (user_id, scan_date) DO NOTHING;
    
    -- Get current count
    SELECT scan_count INTO current_count
    FROM user_scan_limits
    WHERE user_id = p_user_id AND scan_date = today_date;
    
    -- Check if limit exceeded
    IF current_count >= p_max_scans THEN
        RETURN FALSE;
    END IF;
    
    -- Increment count
    UPDATE user_scan_limits
    SET scan_count = scan_count + 1,
        updated_at = NOW()
    WHERE user_id = p_user_id AND scan_date = today_date;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get remaining scans for today
CREATE OR REPLACE FUNCTION get_remaining_scans_today(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    current_count INTEGER;
    max_scans INTEGER;
BEGIN
    SELECT scan_count, max_scans_per_day
    INTO current_count, max_scans
    FROM user_scan_limits
    WHERE user_id = p_user_id AND scan_date = CURRENT_DATE;
    
    -- If no record exists, user has full limit
    IF current_count IS NULL THEN
        RETURN 30; -- Default limit
    END IF;
    
    RETURN GREATEST(0, max_scans - current_count);
END;
$$ LANGUAGE plpgsql;

-- Create a function to get scan usage for today
CREATE OR REPLACE FUNCTION get_scan_usage_today(p_user_id UUID)
RETURNS TABLE(
    scans_used INTEGER,
    max_scans INTEGER,
    remaining_scans INTEGER
) AS $$
DECLARE
    current_count INTEGER;
    max_scans INTEGER;
BEGIN
    SELECT scan_count, max_scans_per_day
    INTO current_count, max_scans
    FROM user_scan_limits
    WHERE user_id = p_user_id AND scan_date = CURRENT_DATE;
    
    -- If no record exists, user has used 0 scans
    IF current_count IS NULL THEN
        current_count := 0;
        max_scans := 30; -- Default limit
    END IF;
    
    RETURN QUERY SELECT 
        current_count,
        max_scans,
        GREATEST(0, max_scans - current_count);
END;
$$ LANGUAGE plpgsql;