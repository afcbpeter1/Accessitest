import { queryOne } from '@/lib/database'

export interface JiraIntegration {
  id: string
  user_id: string
  team_id?: string
  jira_url: string
  jira_email: string
  encrypted_api_token: string
  project_key: string
  issue_type: string
}

export interface AzureDevOpsIntegration {
  id: string
  user_id: string
  team_id?: string
  organization: string
  project: string
  encrypted_pat: string
  work_item_type: string
  area_path?: string
  iteration_path?: string
}

/**
 * Get the appropriate Jira integration for a user
 * Priority: Team integration > Organization default > Personal integration
 */
export async function getJiraIntegration(
  userId: string,
  teamId?: string,
  organizationId?: string
): Promise<JiraIntegration | null> {
  // 1. Check team integration first (if teamId provided)
  if (teamId) {
    const teamIntegration = await queryOne(
      `SELECT * FROM jira_integrations
       WHERE team_id = $1 AND is_active = true`,
      [teamId]
    )
    
    if (teamIntegration) {
      return teamIntegration
    }
  }
  
  // 2. Check organization default (if organizationId provided)
  // Note: We don't have an "organization default" integration table yet,
  // so we'll check if there's a team integration for any team in the org
  if (organizationId) {
    const orgTeamIntegration = await queryOne(
      `SELECT ji.*
       FROM jira_integrations ji
       INNER JOIN teams t ON ji.team_id = t.id
       WHERE t.organization_id = $1 AND ji.is_active = true
       LIMIT 1`,
      [organizationId]
    )
    
    if (orgTeamIntegration) {
      return orgTeamIntegration
    }
  }
  
  // 3. Fall back to personal integration
  const personalIntegration = await queryOne(
    `SELECT * FROM jira_integrations
     WHERE user_id = $1 AND team_id IS NULL AND is_active = true`,
    [userId]
  )
  
  return personalIntegration || null
}

/**
 * Get the appropriate Azure DevOps integration for a user
 * Priority: Team integration > Organization default > Personal integration
 */
export async function getAzureDevOpsIntegration(
  userId: string,
  teamId?: string,
  organizationId?: string
): Promise<AzureDevOpsIntegration | null> {
  // 1. Check team integration first (if teamId provided)
  if (teamId) {
    const teamIntegration = await queryOne(
      `SELECT * FROM azure_devops_integrations
       WHERE team_id = $1 AND is_active = true`,
      [teamId]
    )
    
    if (teamIntegration) {
      return teamIntegration
    }
  }
  
  // 2. Check organization default (if organizationId provided)
  // Note: We don't have an "organization default" integration table yet,
  // so we'll check if there's a team integration for any team in the org
  if (organizationId) {
    const orgTeamIntegration = await queryOne(
      `SELECT adi.*
       FROM azure_devops_integrations adi
       INNER JOIN teams t ON adi.team_id = t.id
       WHERE t.organization_id = $1 AND adi.is_active = true
       LIMIT 1`,
      [organizationId]
    )
    
    if (orgTeamIntegration) {
      return orgTeamIntegration
    }
  }
  
  // 3. Fall back to personal integration
  const personalIntegration = await queryOne(
    `SELECT * FROM azure_devops_integrations
     WHERE user_id = $1 AND team_id IS NULL AND is_active = true`,
    [userId]
  )
  
  return personalIntegration || null
}

/**
 * Get user's team and organization context from an issue
 */
export async function getIssueContext(issueId: string): Promise<{
  teamId?: string
  organizationId?: string
} | null> {
  const issue = await queryOne(
    `SELECT team_id, organization_id FROM issues WHERE id = $1`,
    [issueId]
  )
  
  if (!issue) {
    return null
  }
  
  return {
    teamId: issue.team_id,
    organizationId: issue.organization_id
  }
}

