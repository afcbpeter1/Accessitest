-- Migration: Add team board assignments
-- This allows teams to be assigned to specific Jira or Azure DevOps boards
-- Only admins can assign teams to boards

-- Create team_board_assignments table
CREATE TABLE IF NOT EXISTS team_board_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL, -- References jira_integrations.id or azure_devops_integrations.id
  integration_type VARCHAR(20) NOT NULL CHECK (integration_type IN ('jira', 'azure_devops')),
  board_name VARCHAR(255), -- Display name for the board
  assigned_by UUID NOT NULL REFERENCES users(id),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure a team can only have one active board assignment per integration type
  UNIQUE(team_id, integration_type)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_team_board_assignments_team_id ON team_board_assignments(team_id);
CREATE INDEX IF NOT EXISTS idx_team_board_assignments_organization_id ON team_board_assignments(organization_id);
CREATE INDEX IF NOT EXISTS idx_team_board_assignments_integration ON team_board_assignments(integration_id, integration_type);

-- Add comment
COMMENT ON TABLE team_board_assignments IS 'Stores which board (Jira or Azure DevOps) each team is assigned to. Only one board per team per integration type.';

