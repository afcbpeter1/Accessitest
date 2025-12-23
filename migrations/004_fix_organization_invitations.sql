-- Fix organization invitations - add missing columns
-- Run this AFTER 003_organizations_and_teams.sql

-- Add missing columns to organization_members table
DO $$ 
BEGIN
  -- Add invited_email column (for pending invitations)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'organization_members' AND column_name = 'invited_email') THEN
    ALTER TABLE organization_members ADD COLUMN invited_email VARCHAR(255);
  END IF;
  
  -- Add invitation_token column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'organization_members' AND column_name = 'invitation_token') THEN
    ALTER TABLE organization_members ADD COLUMN invitation_token VARCHAR(255);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_members_invitation_token 
      ON organization_members(invitation_token) WHERE invitation_token IS NOT NULL;
  END IF;
  
  -- Make user_id nullable for pending invitations (users who don't exist yet)
  -- This allows inviting people who haven't signed up
  ALTER TABLE organization_members ALTER COLUMN user_id DROP NOT NULL;
  
  -- Update existing members to ensure they have joined_at set
  UPDATE organization_members 
  SET joined_at = COALESCE(joined_at, created_at)
  WHERE joined_at IS NULL AND user_id IS NOT NULL;
END $$;

-- Add sprint_board_id to teams table (for sprint board configuration)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'teams' AND column_name = 'sprint_board_id') THEN
    ALTER TABLE teams ADD COLUMN sprint_board_id UUID;
  END IF;
END $$;

-- IMPORTANT: Organizations are FREE - no monthly fee per organization
-- Only additional users (beyond the owner) cost money
-- Set default max_users to 1 (owner is free, additional users require payment)
UPDATE organizations SET max_users = 1 WHERE max_users IS NULL OR max_users = 0;
