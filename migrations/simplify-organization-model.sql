-- Migration: Simplify to Organization-Primary Model
-- This migration ensures every user has an organization and migrates credits to organization level
-- Run this SQL in your PostgreSQL database

BEGIN;

-- Step 1: Ensure every user has an organization
-- Create organizations for users who don't have one as owner
-- Use a simpler approach: create org, then link via default_organization_id

-- For users without an organization, create one and set default_organization_id
DO $$
DECLARE
  user_record RECORD;
  new_org_id VARCHAR(255);
BEGIN
  FOR user_record IN 
    SELECT u.id, u.company, u.first_name, u.last_name, u.created_at
    FROM users u
    WHERE NOT EXISTS (
      SELECT 1 FROM organization_members om 
      WHERE om.user_id = u.id AND om.role = 'owner' AND om.is_active = true
    )
  LOOP
    -- Create organization
    INSERT INTO organizations (name, subscription_status, max_users, max_teams, created_at, updated_at)
    VALUES (
      COALESCE(user_record.company, user_record.first_name || ' ' || user_record.last_name || '''s Organization', 'My Organization'),
      'active',
      999,
      0,
      user_record.created_at,
      NOW()
    )
    RETURNING id INTO new_org_id;
    
    -- Set user's default_organization_id
    UPDATE users 
    SET default_organization_id = new_org_id, updated_at = NOW()
    WHERE id = user_record.id;
  END LOOP;
END $$;

-- Step 2: Create organization_members entries for users without one
-- Link users to their organizations (using default_organization_id we just set)
INSERT INTO organization_members (user_id, organization_id, role, joined_at, is_active)
SELECT 
  u.id as user_id,
  u.default_organization_id as organization_id,
  'owner' as role,
  u.created_at as joined_at,
  true as is_active
FROM users u
WHERE u.default_organization_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM organization_members om 
  WHERE om.user_id = u.id AND om.organization_id = u.default_organization_id
);

-- Step 3: Migrate user_credits to organization_credits
-- For users with organizations, migrate their personal credits to organization credits
INSERT INTO organization_credits (organization_id, credits_remaining, credits_used, unlimited_credits, created_at, updated_at)
SELECT 
  o.id as organization_id,
  COALESCE(uc.credits_remaining, 0) as credits_remaining,
  COALESCE(uc.credits_used, 0) as credits_used,
  COALESCE(uc.unlimited_credits, false) as unlimited_credits,
  NOW() as created_at,
  NOW() as updated_at
FROM users u
INNER JOIN organization_members om ON u.id = om.user_id AND om.role = 'owner' AND om.is_active = true
INNER JOIN organizations o ON om.organization_id = o.id
LEFT JOIN user_credits uc ON u.id = uc.user_id
WHERE NOT EXISTS (
  SELECT 1 FROM organization_credits oc WHERE oc.organization_id = o.id
)
ON CONFLICT (organization_id) DO UPDATE
SET 
  credits_remaining = organization_credits.credits_remaining + EXCLUDED.credits_remaining,
  credits_used = organization_credits.credits_used + EXCLUDED.credits_used,
  unlimited_credits = organization_credits.unlimited_credits OR EXCLUDED.unlimited_credits,
  updated_at = NOW();

-- Step 4: Update default_organization_id for all users
-- Set default_organization_id to their primary (owned) organization
UPDATE users u
SET default_organization_id = (
  SELECT om.organization_id 
  FROM organization_members om 
  WHERE om.user_id = u.id 
  AND om.role = 'owner' 
  AND om.is_active = true 
  LIMIT 1
),
updated_at = NOW()
WHERE default_organization_id IS NULL;

-- Step 5: Ensure all organizations have organization_credits entries
-- Create empty credit records for organizations that don't have them
INSERT INTO organization_credits (organization_id, credits_remaining, credits_used, unlimited_credits, created_at, updated_at)
SELECT 
  o.id as organization_id,
  0 as credits_remaining,
  0 as credits_used,
  false as unlimited_credits,
  NOW() as created_at,
  NOW() as updated_at
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM organization_credits oc WHERE oc.organization_id = o.id
);

-- Step 6: Add constraint to ensure every user has a default organization
-- (Optional - can be added later if needed)
-- ALTER TABLE users ADD CONSTRAINT users_must_have_default_org 
--   CHECK (default_organization_id IS NOT NULL);

-- Step 7: Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_organization_members_user_owner 
  ON organization_members(user_id, role, is_active) 
  WHERE role = 'owner' AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_organization_members_org_active 
  ON organization_members(organization_id, is_active) 
  WHERE is_active = true;

COMMIT;

-- Verification queries (run these to check the migration)
-- Check that all users have organizations
SELECT 
  COUNT(*) as total_users,
  COUNT(DISTINCT om.organization_id) as users_with_orgs
FROM users u
LEFT JOIN organization_members om ON u.id = om.user_id AND om.role = 'owner' AND om.is_active = true
WHERE u.default_organization_id IS NOT NULL;

-- Check credit migration
SELECT 
  'user_credits' as source,
  COUNT(*) as count,
  SUM(credits_remaining) as total_credits
FROM user_credits
UNION ALL
SELECT 
  'organization_credits' as source,
  COUNT(*) as count,
  SUM(credits_remaining) as total_credits
FROM organization_credits;
