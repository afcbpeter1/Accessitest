-- Migration: Add project assignments to teams
-- This allows teams to be assigned to specific Jira or Azure DevOps projects
-- After setting up an integration, admins can assign the project to a team

-- Add project assignment columns to teams table
DO $$ 
BEGIN
  -- Add Jira project key column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'teams' AND column_name = 'jira_project_key'
  ) THEN
    ALTER TABLE teams 
    ADD COLUMN jira_project_key VARCHAR(255);
    
    RAISE NOTICE 'Added jira_project_key column to teams';
  ELSE
    RAISE NOTICE 'jira_project_key column already exists in teams';
  END IF;
  
  -- Add Azure DevOps project column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'teams' AND column_name = 'azure_devops_project'
  ) THEN
    ALTER TABLE teams 
    ADD COLUMN azure_devops_project VARCHAR(255);
    
    RAISE NOTICE 'Added azure_devops_project column to teams';
  ELSE
    RAISE NOTICE 'azure_devops_project column already exists in teams';
  END IF;
END $$;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_teams_jira_project_key ON teams(jira_project_key) WHERE jira_project_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_teams_azure_devops_project ON teams(azure_devops_project) WHERE azure_devops_project IS NOT NULL;

-- Add comments
COMMENT ON COLUMN teams.jira_project_key IS 'The Jira project key assigned to this team (e.g., "SCRUM"). Set from the organization integrations.';
COMMENT ON COLUMN teams.azure_devops_project IS 'The Azure DevOps project name assigned to this team (e.g., "A11ytest Scrm"). Set from the organization integrations.';

