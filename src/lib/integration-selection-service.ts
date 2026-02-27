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
  auto_sync_enabled?: boolean
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
  auto_sync_enabled?: boolean
}

/**
 * Get the appropriate Jira integration for a user (used when creating tickets).
 * Priority: Team > any team in org > org admin/owner's personal > user's personal.
 * Must match effective API so "Add to Jira" and ticket creation use the same integration.
 */
export async function getJiraIntegration(
  userId: string,
  teamId?: string,
  organizationId?: string
): Promise<JiraIntegration | null> {
  // 1. Team integration (if teamId provided)
  if (teamId) {
    const teamIntegration = await queryOne(
      `SELECT * FROM jira_integrations
       WHERE team_id = $1 AND is_active = true`,
      [teamId]
    )
    if (teamIntegration) return teamIntegration
  }

  // 2. Any team in the user's organization (if we have organizationId, or derive from membership)
  let orgId = organizationId
  if (!orgId) {
    const memberOrg = await queryOne(
      `SELECT organization_id FROM organization_members
       WHERE user_id = $1 AND is_active = true LIMIT 1`,
      [userId]
    )
    orgId = memberOrg?.organization_id
  }
  if (orgId) {
    const orgTeamIntegration = await queryOne(
      `SELECT ji.* FROM jira_integrations ji
       INNER JOIN teams t ON ji.team_id = t.id
       WHERE t.organization_id = $1 AND ji.is_active = true LIMIT 1`,
      [orgId]
    )
    if (orgTeamIntegration) return orgTeamIntegration
  }

  // 3. Org admin/owner's personal Jira (members adopt the org's integration)
  const adminJira = await queryOne(
    `SELECT ji.* FROM jira_integrations ji
     INNER JOIN organization_members om ON om.user_id = ji.user_id AND om.is_active = true AND om.role IN ('owner', 'admin')
     INNER JOIN organization_members me ON me.organization_id = om.organization_id AND me.user_id = $1 AND me.is_active = true
     WHERE ji.team_id IS NULL AND ji.is_active = true
     LIMIT 1`,
    [userId]
  )
  if (adminJira) return adminJira

  // 4. User's personal integration
  const personalIntegration = await queryOne(
    `SELECT * FROM jira_integrations
     WHERE user_id = $1 AND team_id IS NULL AND is_active = true`,
    [userId]
  )
  return personalIntegration || null
}

/**
 * Get the appropriate Azure DevOps integration for a user (used when creating work items).
 * Priority: Team > any team in org > org admin/owner's personal > user's personal.
 * Must match effective API so "Add to Azure DevOps" and work item creation use the same integration.
 */
export async function getAzureDevOpsIntegration(
  userId: string,
  teamId?: string,
  organizationId?: string
): Promise<AzureDevOpsIntegration | null> {
  // 1. Team integration (if teamId provided)
  if (teamId) {
    const teamIntegration = await queryOne(
      `SELECT * FROM azure_devops_integrations
       WHERE team_id = $1 AND is_active = true`,
      [teamId]
    )
    if (teamIntegration) return teamIntegration
  }

  // 2. Any team in the user's organization (derive org from membership if not provided)
  let orgId = organizationId
  if (!orgId) {
    const memberOrg = await queryOne(
      `SELECT organization_id FROM organization_members
       WHERE user_id = $1 AND is_active = true LIMIT 1`,
      [userId]
    )
    orgId = memberOrg?.organization_id
  }
  if (orgId) {
    const orgTeamIntegration = await queryOne(
      `SELECT adi.* FROM azure_devops_integrations adi
       INNER JOIN teams t ON adi.team_id = t.id
       WHERE t.organization_id = $1 AND adi.is_active = true LIMIT 1`,
      [orgId]
    )
    if (orgTeamIntegration) return orgTeamIntegration
  }

  // 3. Org admin/owner's personal Azure DevOps (members adopt the org's integration)
  const adminAdo = await queryOne(
    `SELECT adi.* FROM azure_devops_integrations adi
     INNER JOIN organization_members om ON om.user_id = adi.user_id AND om.is_active = true AND om.role IN ('owner', 'admin')
     INNER JOIN organization_members me ON me.organization_id = om.organization_id AND me.user_id = $1 AND me.is_active = true
     WHERE adi.team_id IS NULL AND adi.is_active = true
     LIMIT 1`,
    [userId]
  )
  if (adminAdo) return adminAdo

  // 4. User's personal integration
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


