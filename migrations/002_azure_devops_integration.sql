-- Azure DevOps Integration Migration
-- Creates tables and columns for Azure DevOps integration

-- Create azure_devops_integrations table
CREATE TABLE IF NOT EXISTS azure_devops_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization VARCHAR(255) NOT NULL, -- e.g., "a11ytest"
  project VARCHAR(255) NOT NULL, -- e.g., "A11ytest Scrm"
  encrypted_pat TEXT NOT NULL, -- Encrypted Personal Access Token
  encryption_key_id VARCHAR(100), -- Reference to encryption key version
  work_item_type VARCHAR(50) DEFAULT 'Bug', -- Default work item type
  area_path VARCHAR(500), -- Optional area path
  iteration_path VARCHAR(500), -- Optional iteration path
  auto_sync_enabled BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  last_verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create azure_devops_work_item_mappings table
CREATE TABLE IF NOT EXISTS azure_devops_work_item_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  work_item_id INTEGER NOT NULL, -- Azure DevOps work item ID (e.g., 12345)
  work_item_url TEXT NOT NULL, -- Full URL to work item
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(issue_id, work_item_id)
);

-- Create indexes for azure_devops_work_item_mappings
CREATE INDEX IF NOT EXISTS idx_azure_devops_work_item_mappings_issue_id ON azure_devops_work_item_mappings(issue_id);
CREATE INDEX IF NOT EXISTS idx_azure_devops_work_item_mappings_work_item_id ON azure_devops_work_item_mappings(work_item_id);

-- Add Azure DevOps sync columns to issues table
DO $$ 
BEGIN
  -- Add azure_devops_synced column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'issues' AND column_name = 'azure_devops_synced') THEN
    ALTER TABLE issues ADD COLUMN azure_devops_synced BOOLEAN DEFAULT false;
  END IF;

  -- Add azure_devops_work_item_id column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'issues' AND column_name = 'azure_devops_work_item_id') THEN
    ALTER TABLE issues ADD COLUMN azure_devops_work_item_id INTEGER;
  END IF;

  -- Add azure_devops_sync_error column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'issues' AND column_name = 'azure_devops_sync_error') THEN
    ALTER TABLE issues ADD COLUMN azure_devops_sync_error TEXT;
  END IF;
END $$;





