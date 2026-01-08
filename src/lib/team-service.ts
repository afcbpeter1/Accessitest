import { query, queryOne, queryMany } from '@/lib/database'

export interface Team {
  id: string
  organization_id: string
  name: string
  description?: string
  jira_project_key?: string
  azure_devops_project?: string
  jira_issue_type?: string
  azure_devops_work_item_type?: string
  created_at: string
  updated_at: string
}

export interface TeamWithMembers extends Team {
  member_count: number
  integrations: {
    jira?: boolean
    azure_devops?: boolean
  }
}

/**
 * Create a new team
 */
export async function createTeam(
  organizationId: string,
  name: string,
  description?: string,
  userId?: string
): Promise<Team> {
  // If userId provided, check permission
  if (userId) {
    const member = await queryOne(
      `SELECT role FROM organization_members
       WHERE organization_id = $1 AND user_id = $2 AND is_active = true`,
      [organizationId, userId]
    )
    
    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      throw new Error('You do not have permission to create teams')
    }
  }
  
  const team = await queryOne(
    `INSERT INTO teams (organization_id, name, description)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [organizationId, name, description || null]
  )
  
  return team
}

/**
 * Get teams for an organization
 */
export async function getOrganizationTeams(organizationId: string): Promise<TeamWithMembers[]> {
  const teams = await queryMany(
    `SELECT 
      t.*,
      COUNT(DISTINCT om.id) as member_count
     FROM teams t
     LEFT JOIN organization_members om ON t.id = om.team_id AND om.is_active = true
     WHERE t.organization_id = $1
     GROUP BY t.id
     ORDER BY t.created_at DESC`,
    [organizationId]
  )
  
  // Get integration info for each team
  const result: TeamWithMembers[] = []
  for (const team of teams) {
    const jiraIntegration = await queryOne(
      `SELECT id FROM jira_integrations WHERE team_id = $1 AND is_active = true`,
      [team.id]
    )
    
    const azureIntegration = await queryOne(
      `SELECT id FROM azure_devops_integrations WHERE team_id = $1 AND is_active = true`,
      [team.id]
    )
    
    result.push({
      ...team,
      integrations: {
        jira: !!jiraIntegration,
        azure_devops: !!azureIntegration
      }
    })
  }
  
  return result
}

/**
 * Get team by ID
 */
export async function getTeam(teamId: string): Promise<Team | null> {
  return await queryOne(
    `SELECT * FROM teams WHERE id = $1`,
    [teamId]
  )
}

/**
 * Update team
 */
export async function updateTeam(
  teamId: string,
  updates: { 
    name?: string
    description?: string
    jira_project_key?: string | null
    azure_devops_project?: string | null
    jira_issue_type?: string | null
    azure_devops_work_item_type?: string | null
  },
  userId: string
): Promise<{ success: boolean; message: string }> {
  // Get team's organization
  const team = await queryOne(
    `SELECT organization_id FROM teams WHERE id = $1`,
    [teamId]
  )
  
  if (!team) {
    return { success: false, message: 'Team not found' }
  }
  
  // Check permission
  const member = await queryOne(
    `SELECT role FROM organization_members
     WHERE organization_id = $1 AND user_id = $2 AND is_active = true`,
    [team.organization_id, userId]
  )
  
  if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
    return { success: false, message: 'You do not have permission to update this team' }
  }
  
  const setClauses: string[] = []
  const values: any[] = []
  let paramIndex = 1
  
  if (updates.name !== undefined) {
    setClauses.push(`name = $${paramIndex++}`)
    values.push(updates.name)
  }
  if (updates.description !== undefined) {
    setClauses.push(`description = $${paramIndex++}`)
    values.push(updates.description)
  }
  if (updates.jira_project_key !== undefined) {
    setClauses.push(`jira_project_key = $${paramIndex++}`)
    values.push(updates.jira_project_key || null)
  }
  if (updates.azure_devops_project !== undefined) {
    setClauses.push(`azure_devops_project = $${paramIndex++}`)
    values.push(updates.azure_devops_project || null)
  }
  if (updates.jira_issue_type !== undefined) {
    setClauses.push(`jira_issue_type = $${paramIndex++}`)
    values.push(updates.jira_issue_type || null)
  }
  if (updates.azure_devops_work_item_type !== undefined) {
    setClauses.push(`azure_devops_work_item_type = $${paramIndex++}`)
    values.push(updates.azure_devops_work_item_type || null)
  }
  
  if (setClauses.length === 0) {
    return { success: false, message: 'No updates provided' }
  }
  
  setClauses.push(`updated_at = NOW()`)
  values.push(teamId)
  
  await query(
    `UPDATE teams
     SET ${setClauses.join(', ')}
     WHERE id = $${paramIndex}`,
    values
  )
  
  return { success: true, message: 'Team updated successfully' }
}

/**
 * Delete team
 */
export async function deleteTeam(teamId: string, userId: string): Promise<{ success: boolean; message: string }> {
  // Get team's organization
  const team = await queryOne(
    `SELECT organization_id FROM teams WHERE id = $1`,
    [teamId]
  )
  
  if (!team) {
    return { success: false, message: 'Team not found' }
  }
  
  // Check permission
  const member = await queryOne(
    `SELECT role FROM organization_members
     WHERE organization_id = $1 AND user_id = $2 AND is_active = true`,
    [team.organization_id, userId]
  )
  
  if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
    return { success: false, message: 'You do not have permission to delete this team' }
  }
  
  // Delete team (cascade will handle related records)
  await query(
    `DELETE FROM teams WHERE id = $1`,
    [teamId]
  )
  
  return { success: true, message: 'Team deleted successfully' }
}

/**
 * Assign user to team
 */
export async function assignUserToTeam(
  organizationId: string,
  userId: string,
  teamId: string,
  assignerId: string
): Promise<{ success: boolean; message: string }> {
  // Check if assigner has permission
  const assigner = await queryOne(
    `SELECT role FROM organization_members
     WHERE organization_id = $1 AND user_id = $2 AND is_active = true`,
    [organizationId, assignerId]
  )
  
  if (!assigner || (assigner.role !== 'owner' && assigner.role !== 'admin')) {
    return { success: false, message: 'You do not have permission to assign users to teams' }
  }
  
  // Check if team belongs to organization
  const team = await queryOne(
    `SELECT id FROM teams WHERE id = $1 AND organization_id = $2`,
    [teamId, organizationId]
  )
  
  if (!team) {
    return { success: false, message: 'Team not found or does not belong to this organization' }
  }
  
  // Check if user is a member of the organization
  const member = await queryOne(
    `SELECT id FROM organization_members
     WHERE organization_id = $1 AND user_id = $2 AND is_active = true`,
    [organizationId, userId]
  )
  
  if (!member) {
    return { success: false, message: 'User is not a member of this organization' }
  }
  
  // Update team assignment
  await query(
    `UPDATE organization_members
     SET team_id = $1, updated_at = NOW()
     WHERE organization_id = $2 AND user_id = $3`,
    [teamId, organizationId, userId]
  )
  
  return { success: true, message: 'User assigned to team successfully' }
}

/**
 * Remove user from team
 */
export async function removeUserFromTeam(
  organizationId: string,
  userId: string,
  assignerId: string
): Promise<{ success: boolean; message: string }> {
  // Check if assigner has permission
  const assigner = await queryOne(
    `SELECT role FROM organization_members
     WHERE organization_id = $1 AND user_id = $2 AND is_active = true`,
    [organizationId, assignerId]
  )
  
  if (!assigner || (assigner.role !== 'owner' && assigner.role !== 'admin')) {
    return { success: false, message: 'You do not have permission to remove users from teams' }
  }
  
  // Remove team assignment
  await query(
    `UPDATE organization_members
     SET team_id = NULL, updated_at = NOW()
     WHERE organization_id = $1 AND user_id = $2`,
    [organizationId, userId]
  )
  
  return { success: true, message: 'User removed from team successfully' }
}

