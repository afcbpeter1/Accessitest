-- Simplify to team-based model
-- Organizations are free, teams are the paid feature
-- Each user gets one organization automatically

-- Add max_teams column to organizations (replaces max_users)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'organizations' AND column_name = 'max_teams') THEN
    ALTER TABLE organizations ADD COLUMN max_teams INTEGER DEFAULT 0;
  END IF;
END $$;

-- Migrate existing max_users to max_teams (if any teams exist, set max_teams accordingly)
-- For now, set max_teams to 0 (free tier - no teams)
UPDATE organizations SET max_teams = 0 WHERE max_teams IS NULL;

-- Ensure all scans have team_id (required for team isolation)
-- For existing scans without team_id, we'll need to assign them to a default team
-- This will be handled in application code

-- Ensure all issues have team_id (required for team isolation)
-- Same as above - handled in application code

-- Add team subscription tracking
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'teams' AND column_name = 'stripe_subscription_id') THEN
    ALTER TABLE teams ADD COLUMN stripe_subscription_id VARCHAR(255);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'teams' AND column_name = 'subscription_status') THEN
    ALTER TABLE teams ADD COLUMN subscription_status VARCHAR(50) DEFAULT 'inactive';
  END IF;
END $$;

-- Update teams to track subscription
-- Teams require a paid subscription to be active
UPDATE teams SET subscription_status = 'inactive' WHERE subscription_status IS NULL;

