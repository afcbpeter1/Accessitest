-- Jira Integration Migration
-- Creates tables and columns for Jira Cloud integration

-- Create jira_integrations table
CREATE TABLE IF NOT EXISTS jira_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  jira_url VARCHAR(500) NOT NULL,
  jira_email VARCHAR(255) NOT NULL,
  encrypted_api_token TEXT NOT NULL, -- Encrypted API token
  encryption_key_id VARCHAR(100), -- Reference to encryption key version
  project_key VARCHAR(50) NOT NULL, -- Jira project key (e.g., "SCRUM")
  issue_type VARCHAR(50) DEFAULT 'Bug', -- Default issue type
  auto_sync_enabled BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  last_verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create jira_ticket_mappings table
CREATE TABLE IF NOT EXISTS jira_ticket_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  jira_ticket_key VARCHAR(50) NOT NULL, -- e.g., "SCRUM-123"
  jira_ticket_id VARCHAR(100) NOT NULL, -- Internal Jira ID
  jira_url TEXT NOT NULL, -- Full URL to ticket
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(issue_id, jira_ticket_key)
);

-- Create indexes for jira_ticket_mappings
CREATE INDEX IF NOT EXISTS idx_jira_ticket_mappings_issue_id ON jira_ticket_mappings(issue_id);
CREATE INDEX IF NOT EXISTS idx_jira_ticket_mappings_ticket_key ON jira_ticket_mappings(jira_ticket_key);

-- Add Jira sync columns to issues table
DO $$ 
BEGIN
  -- Add jira_synced column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'issues' AND column_name = 'jira_synced') THEN
    ALTER TABLE issues ADD COLUMN jira_synced BOOLEAN DEFAULT false;
  END IF;

  -- Add jira_ticket_key column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'issues' AND column_name = 'jira_ticket_key') THEN
    ALTER TABLE issues ADD COLUMN jira_ticket_key VARCHAR(50);
  END IF;

  -- Add jira_sync_error column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'issues' AND column_name = 'jira_sync_error') THEN
    ALTER TABLE issues ADD COLUMN jira_sync_error TEXT;
  END IF;
END $$;







