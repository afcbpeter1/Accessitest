-- Create a demo user for testing
-- Run this in your database after setting up the tables

-- Insert demo user
INSERT INTO users (email, first_name, last_name, company, plan_type, is_active, email_verified)
VALUES ('demo@accessitest.com', 'Demo', 'User', 'Demo Company', 'complete_access', true, true)
ON CONFLICT (email) DO NOTHING;

-- Get the user ID
DO $$
DECLARE
    demo_user_id UUID;
BEGIN
    SELECT id INTO demo_user_id FROM users WHERE email = 'demo@accessitest.com';
    
    IF demo_user_id IS NOT NULL THEN
        -- Insert demo password (password: 'demo123')
        INSERT INTO user_passwords (user_id, password_hash, salt)
        VALUES (demo_user_id, '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uO.G', 'demo-salt')
        ON CONFLICT (user_id) DO NOTHING;
        
        -- Insert demo credits (unlimited)
        INSERT INTO user_credits (user_id, credits_remaining, credits_used, unlimited_credits)
        VALUES (demo_user_id, 0, 0, true)
        ON CONFLICT (user_id) DO NOTHING;
        
        RAISE NOTICE 'Demo user created with ID: %', demo_user_id;
    END IF;
END $$;
