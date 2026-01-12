-- Migration: Ensure team assignment functionality
-- This ensures organization_members has team_id column and proper constraints
-- Safe to run multiple times (uses IF NOT EXISTS)

-- Add team_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_members' AND column_name = 'team_id'
  ) THEN
    ALTER TABLE organization_members 
    ADD COLUMN team_id UUID REFERENCES teams(id) ON DELETE SET NULL;
    
    -- Create index for faster lookups
    CREATE INDEX IF NOT EXISTS idx_organization_members_team_id 
    ON organization_members(team_id);
    
    RAISE NOTICE 'Added team_id column to organization_members';
  ELSE
    RAISE NOTICE 'team_id column already exists in organization_members';
  END IF;
END $$;

-- Add comment
COMMENT ON COLUMN organization_members.team_id IS 'The team this member is assigned to. NULL means no team assignment.';


