-- Migration: Add work item type assignments to teams
-- This allows each team to specify their own work item types for Jira and Azure DevOps
-- When a team member runs a scan, tickets will be created with the team's specified work item type

-- Add work item type columns to teams table
DO $$ 
BEGIN
  -- Add Jira issue type column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'teams' AND column_name = 'jira_issue_type'
  ) THEN
    ALTER TABLE teams 
    ADD COLUMN jira_issue_type VARCHAR(100);
    
    RAISE NOTICE 'Added jira_issue_type column to teams';
  ELSE
    RAISE NOTICE 'jira_issue_type column already exists in teams';
  END IF;
  
  -- Add Azure DevOps work item type column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'teams' AND column_name = 'azure_devops_work_item_type'
  ) THEN
    ALTER TABLE teams 
    ADD COLUMN azure_devops_work_item_type VARCHAR(100);
    
    RAISE NOTICE 'Added azure_devops_work_item_type column to teams';
  ELSE
    RAISE NOTICE 'azure_devops_work_item_type column already exists in teams';
  END IF;
END $$;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_teams_jira_issue_type ON teams(jira_issue_type) WHERE jira_issue_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_teams_azure_devops_work_item_type ON teams(azure_devops_work_item_type) WHERE azure_devops_work_item_type IS NOT NULL;

-- Add comments
COMMENT ON COLUMN teams.jira_issue_type IS 'The Jira issue type to use when creating tickets for this team (e.g., "Bug", "Task", "Story"). Overrides integration default.';
COMMENT ON COLUMN teams.azure_devops_work_item_type IS 'The Azure DevOps work item type to use when creating work items for this team (e.g., "Bug", "Task", "Product Backlog Item"). Overrides integration default.';


