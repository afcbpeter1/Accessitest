import { query, queryOne, queryMany } from '@/lib/database'
import { EmailService } from '@/lib/email-service'
import crypto from 'crypto'

export interface Organization {
  id: string
  name: string
  stripe_customer_id?: string
  subscription_status: string
  max_users: number
  created_at: string
  updated_at: string
}

export interface OrganizationMember {
  id: string
  user_id: string
  organization_id: string
  team_id?: string
  role: 'owner' | 'admin' | 'user'
  invited_by?: string
  invited_at?: string
  joined_at: string
  is_active: boolean
  email?: string
  first_name?: string
  last_name?: string
}

export interface OrganizationWithMembers extends Organization {
  members: OrganizationMember[]
  credits?: {
    credits_remaining: number
    credits_used: number
    unlimited_credits: boolean
  }
}

/**
 * Create a new organization and set the user as owner
 */
export async function createOrganization(userId: string, name: string): Promise<Organization> {
  await query('BEGIN')
  
  try {
    // Check if user already has an organization (simplified model - one org per user)
    const existingOrg = await queryOne(
      `SELECT o.* FROM organizations o
       INNER JOIN organization_members om ON o.id = om.organization_id
       WHERE om.user_id = $1 AND om.role = 'owner' AND om.is_active = true
       LIMIT 1`,
      [userId]
    )
    
    if (existingOrg) {
      await query('ROLLBACK')
      throw new Error('You already have an organization. Each user can only have one organization.')
    }
    
    // Create organization (simplified model - teams are the paid feature)
    const org = await queryOne(
      `INSERT INTO organizations (name, subscription_status, max_users, max_teams)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, 'active', 999, 0] // Unlimited users, 0 teams (free tier)
    )
    
    // Set user as owner
    await query(
      `INSERT INTO organization_members (user_id, organization_id, role, joined_at, is_active)
       VALUES ($1, $2, $3, NOW(), true)`,
      [userId, org.id, 'owner']
    )
    
    // Create organization credits (initialize with 0, will be migrated from user credits)
    await query(
      `INSERT INTO organization_credits (organization_id, credits_remaining, credits_used, unlimited_credits)
       VALUES ($1, $2, $3, $4)`,
      [org.id, 0, 0, false]
    )
    
    // Set as user's default organization
    await query(
      `UPDATE users SET default_organization_id = $1 WHERE id = $2`,
      [org.id, userId]
    )
    
    await query('COMMIT')
    return org
  } catch (error) {
    await query('ROLLBACK')
    throw error
  }
}

/**
 * Get user's organizations with their roles
 */
export async function getUserOrganizations(userId: string): Promise<OrganizationWithMembers[]> {
  // Order so the org the user OWNS comes first (avoids "no permission to invite" when they have multiple orgs)
  const orgs = await queryMany(
    `SELECT DISTINCT
      o.*,
      om.role,
      om.team_id,
      om.is_active as member_is_active
     FROM organizations o
     INNER JOIN organization_members om ON o.id = om.organization_id
     WHERE om.user_id = $1 AND om.is_active = true
     ORDER BY CASE WHEN om.role = 'owner' THEN 0 WHEN om.role = 'admin' THEN 1 ELSE 2 END, o.created_at DESC`,
    [userId]
  )
  
  // Get full details for each organization
  const result: OrganizationWithMembers[] = []
  for (const org of orgs) {
    const members = await getOrganizationMembers(org.id)
    const credits = await getOrganizationCredits(org.id)
    
    result.push({
      ...org,
      members,
      credits
    })
  }
  
  return result
}

/**
 * Get organization by ID (with permission check)
 */
export async function getOrganization(organizationId: string, userId: string): Promise<OrganizationWithMembers | null> {
  // Check if user is a member
  const member = await queryOne(
    `SELECT * FROM organization_members
     WHERE organization_id = $1 AND user_id = $2 AND is_active = true`,
    [organizationId, userId]
  )
  
  if (!member) {
    return null
  }
  
  const org = await queryOne(
    `SELECT * FROM organizations WHERE id = $1`,
    [organizationId]
  )
  
  if (!org) {
    return null
  }
  
  const members = await getOrganizationMembers(organizationId)
  const credits = await getOrganizationCredits(organizationId)
  
  return {
    ...org,
    members,
    credits
  }
}

/**
 * Get organization members
 */
export async function getOrganizationMembers(organizationId: string): Promise<OrganizationMember[]> {
  return await queryMany(
    `SELECT 
      om.*,
      u.email,
      u.first_name,
      u.last_name
     FROM organization_members om
     INNER JOIN users u ON om.user_id = u.id
     WHERE om.organization_id = $1 AND om.is_active = true
     ORDER BY 
       CASE om.role
         WHEN 'owner' THEN 1
         WHEN 'admin' THEN 2
         WHEN 'user' THEN 3
       END,
       om.joined_at ASC`,
    [organizationId]
  )
}

/**
 * Get organization credits
 */
export async function getOrganizationCredits(organizationId: string) {
  return await queryOne(
    `SELECT credits_remaining, credits_used, unlimited_credits
     FROM organization_credits
     WHERE organization_id = $1`,
    [organizationId]
  )
}

/**
 * Invite a user to an organization
 * Allows inviting users who don't exist yet - they'll get a signup link
 */
export async function inviteUser(
  organizationId: string,
  inviterId: string,
  email: string,
  role: 'owner' | 'admin' | 'user' = 'user',
  teamId?: string
): Promise<{ success: boolean; message: string; invitationToken?: string }> {
  await query('BEGIN')
  
  try {
    // Check if inviter has permission (admin or owner)
    const inviter = await queryOne(
      `SELECT role FROM organization_members
       WHERE organization_id = $1 AND user_id = $2 AND is_active = true`,
      [organizationId, inviterId]
    )
    
    if (!inviter || (inviter.role !== 'owner' && inviter.role !== 'admin')) {
      await query('ROLLBACK')
      return { success: false, message: 'You do not have permission to invite users' }
    }
    
    // Check if user exists
    const user = await queryOne(
      `SELECT id FROM users WHERE email = $1`,
      [email]
    )
    
    // Check for existing invitation or membership (by email or user_id)
    let existingMember
    if (user) {
      existingMember = await queryOne(
        `SELECT * FROM organization_members
         WHERE organization_id = $1 AND user_id = $2`,
        [organizationId, user.id]
      )
    } else {
      // Check for pending invitation by email
      existingMember = await queryOne(
        `SELECT * FROM organization_members
         WHERE organization_id = $1 AND invited_email = $2 AND is_active = false`,
        [organizationId, email]
      )
    }
    
    if (existingMember) {
      if (existingMember.is_active) {
        await query('ROLLBACK')
        return { success: false, message: 'User is already a member of this organization' }
      } else {
        // Resend invitation - update token and email
        const invitationToken = crypto.randomBytes(32).toString('hex')
        await query(
          `UPDATE organization_members
           SET invitation_token = $1, invited_at = NOW(), role = $2, team_id = $3, updated_at = NOW()
           WHERE id = $4`,
          [invitationToken, role, teamId || null, existingMember.id]
        )
        await query('COMMIT')
        
        // Send invitation email
        const org = await queryOne(`SELECT name FROM organizations WHERE id = $1`, [organizationId])
        const inviterUser = await queryOne(`SELECT first_name, last_name FROM users WHERE id = $1`, [inviterId])
        const inviterName = inviterUser ? `${inviterUser.first_name} ${inviterUser.last_name}` : 'A team member'
        
        await EmailService.sendOrganizationInvitation({
          email,
          organizationName: org.name,
          inviterName,
          invitationToken
        })
        
        return { success: true, message: 'Invitation resent successfully', invitationToken }
      }
    }
    
    // Generate invitation token
    const invitationToken = crypto.randomBytes(32).toString('hex')
    
    // Create pending invitation (is_active = false, joined_at = NULL)
    // Only include user_id if user exists, otherwise it's a pending invitation
    if (user) {
      await query(
        `INSERT INTO organization_members (user_id, organization_id, team_id, role, invited_by, invited_email, invitation_token, invited_at, is_active, joined_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), false, NULL)`,
        [user.id, organizationId, teamId || null, role, inviterId, email, invitationToken]
      )
    } else {
      // User doesn't exist yet - create pending invitation with just email
      await query(
        `INSERT INTO organization_members (user_id, organization_id, team_id, role, invited_by, invited_email, invitation_token, invited_at, is_active, joined_at)
         VALUES (NULL, $1, $2, $3, $4, $5, $6, NOW(), false, NULL)`,
        [organizationId, teamId || null, role, inviterId, email, invitationToken]
      )
    }
    
    // Get organization name and inviter name for email
    const org = await queryOne(`SELECT name FROM organizations WHERE id = $1`, [organizationId])
    const inviterUser = await queryOne(`SELECT first_name, last_name FROM users WHERE id = $1`, [inviterId])
    const inviterName = inviterUser ? `${inviterUser.first_name} ${inviterUser.last_name}` : 'A team member'
    
    // Send invitation email
    await EmailService.sendOrganizationInvitation({
      email,
      organizationName: org.name,
      inviterName,
      invitationToken
    })
    
    await query('COMMIT')
    return { success: true, message: 'Invitation sent successfully', invitationToken }
  } catch (error) {
    await query('ROLLBACK')
    throw error
  }
}

/**
 * Accept invitation (user joins organization)
 * Checks user limit before accepting
 */
export async function acceptInvitation(
  userId: string, 
  organizationId: string, 
  invitationToken?: string
): Promise<{ success: boolean; message: string; requiresPayment?: boolean }> {
  await query('BEGIN')
  
  try {
    // Find invitation by token or user_id
    let member
    if (invitationToken) {
      member = await queryOne(
        `SELECT * FROM organization_members
         WHERE organization_id = $1 AND invitation_token = $2`,
        [organizationId, invitationToken]
      )
    } else {
      member = await queryOne(
        `SELECT * FROM organization_members
         WHERE organization_id = $1 AND (user_id = $2 OR invited_email = (SELECT email FROM users WHERE id = $2))`,
        [organizationId, userId]
      )
    }
    
    if (!member) {
      await query('ROLLBACK')
      return { success: false, message: 'Invitation not found' }
    }
    
    if (member.is_active && member.joined_at) {
      await query('ROLLBACK')
      return { success: true, message: 'Already a member' }
    }
    
    // Check user limit before accepting
    const org = await queryOne(`SELECT max_users FROM organizations WHERE id = $1`, [organizationId])
    const currentActiveUsers = await queryOne(
      `SELECT COUNT(*) as count FROM organization_members 
       WHERE organization_id = $1 AND is_active = true`,
      [organizationId]
    )
    
    const maxUsers = org?.max_users || 1
    const currentUsers = parseInt(currentActiveUsers?.count || '0', 10)
    
    // Owner doesn't count against limit, so if this is the first user (owner), allow it
    const ownerCount = await queryOne(
      `SELECT COUNT(*) as count FROM organization_members 
       WHERE organization_id = $1 AND role = 'owner' AND is_active = true`,
      [organizationId]
    )
    const isOwner = member.role === 'owner'
    const effectiveCurrentUsers = isOwner ? currentUsers : currentUsers + 1
    
    if (effectiveCurrentUsers > maxUsers) {
      await query('ROLLBACK')
      return { 
        success: false, 
        message: 'Organization has reached its user limit. Please add more user seats first.',
        requiresPayment: true
      }
    }
    
    // Update invitation to active
    await query(
      `UPDATE organization_members
       SET user_id = $1, is_active = true, joined_at = NOW(), updated_at = NOW(), invitation_token = NULL
       WHERE id = $2`,
      [userId, member.id]
    )
    
    // Update user's default_organization_id to the organization they're joining
    await query(
      `UPDATE users SET default_organization_id = $1 WHERE id = $2`,
      [organizationId, userId]
    )
    
    await query('COMMIT')
    return { success: true, message: 'Successfully joined organization' }
  } catch (error) {
    await query('ROLLBACK')
    throw error
  }
}

/**
 * Remove user from organization
 */
export async function removeMember(
  organizationId: string,
  userIdToRemove: string,
  removerId: string
): Promise<{ success: boolean; message: string }> {
  await query('BEGIN')
  
  try {
    // Check if remover has permission
    const remover = await queryOne(
      `SELECT role FROM organization_members
       WHERE organization_id = $1 AND user_id = $2 AND is_active = true`,
      [organizationId, removerId]
    )
    
    if (!remover || (remover.role !== 'owner' && remover.role !== 'admin')) {
      await query('ROLLBACK')
      return { success: false, message: 'You do not have permission to remove members' }
    }
    
    // Cannot remove owner
    const memberToRemove = await queryOne(
      `SELECT role FROM organization_members
       WHERE organization_id = $1 AND user_id = $2`,
      [organizationId, userIdToRemove]
    )
    
    if (memberToRemove?.role === 'owner') {
      await query('ROLLBACK')
      return { success: false, message: 'Cannot remove the organization owner' }
    }
    
    // Remove member
    await query(
      `UPDATE organization_members
       SET is_active = false, updated_at = NOW()
       WHERE organization_id = $1 AND user_id = $2`,
      [organizationId, userIdToRemove]
    )
    
    await query('COMMIT')
    return { success: true, message: 'Member removed successfully' }
  } catch (error) {
    await query('ROLLBACK')
    throw error
  }
}

/**
 * Update member role
 */
export async function updateMemberRole(
  organizationId: string,
  userId: string,
  newRole: 'owner' | 'admin' | 'user',
  updaterId: string
): Promise<{ success: boolean; message: string }> {
  await query('BEGIN')
  
  try {
    // Only owner or admin can update roles
    const updater = await queryOne(
      `SELECT role FROM organization_members
       WHERE organization_id = $1 AND user_id = $2 AND is_active = true`,
      [organizationId, updaterId]
    )
    
    if (!updater || (updater.role !== 'owner' && updater.role !== 'admin')) {
      await query('ROLLBACK')
      return { success: false, message: 'Only organization owners and admins can update roles' }
    }
    
    // Get the member being updated to check their current role
    const memberToUpdate = await queryOne(
      `SELECT role FROM organization_members
       WHERE organization_id = $1 AND user_id = $2 AND is_active = true`,
      [organizationId, userId]
    )
    
    if (!memberToUpdate) {
      await query('ROLLBACK')
      return { success: false, message: 'Member not found' }
    }
    
    // Cannot change owner role (owner role is protected)
    if (memberToUpdate.role === 'owner') {
      await query('ROLLBACK')
      return { success: false, message: 'Cannot change the owner role' }
    }
    
    // Cannot promote to owner (only current owner can transfer ownership via separate process)
    if (newRole === 'owner') {
      await query('ROLLBACK')
      return { success: false, message: 'Cannot promote to owner role. Owner role cannot be changed.' }
    }
    
    // Update role
    await query(
      `UPDATE organization_members
       SET role = $1, updated_at = NOW()
       WHERE organization_id = $2 AND user_id = $3`,
      [newRole, organizationId, userId]
    )
    
    await query('COMMIT')
    return { success: true, message: 'Role updated successfully' }
  } catch (error) {
    await query('ROLLBACK')
    throw error
  }
}

/**
 * Update organization
 */
export async function updateOrganization(
  organizationId: string,
  updates: { name?: string; stripe_customer_id?: string; subscription_status?: string; max_users?: number },
  userId: string
): Promise<{ success: boolean; message: string }> {
  // Check if user is owner or admin
  const member = await queryOne(
    `SELECT role FROM organization_members
     WHERE organization_id = $1 AND user_id = $2 AND is_active = true`,
    [organizationId, userId]
  )
  
  if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
    return { success: false, message: 'You do not have permission to update this organization' }
  }
  
  const setClauses: string[] = []
  const values: any[] = []
  let paramIndex = 1
  
  if (updates.name !== undefined) {
    setClauses.push(`name = $${paramIndex++}`)
    values.push(updates.name)
  }
  if (updates.stripe_customer_id !== undefined) {
    setClauses.push(`stripe_customer_id = $${paramIndex++}`)
    values.push(updates.stripe_customer_id)
  }
  if (updates.subscription_status !== undefined) {
    setClauses.push(`subscription_status = $${paramIndex++}`)
    values.push(updates.subscription_status)
  }
  if (updates.max_users !== undefined) {
    setClauses.push(`max_users = $${paramIndex++}`)
    values.push(updates.max_users)
  }
  
  if (setClauses.length === 0) {
    return { success: false, message: 'No updates provided' }
  }
  
  setClauses.push(`updated_at = NOW()`)
  values.push(organizationId)
  
  await query(
    `UPDATE organizations
     SET ${setClauses.join(', ')}
     WHERE id = $${paramIndex}`,
    values
  )
  
  return { success: true, message: 'Organization updated successfully' }
}

/**
 * Delete organization (only owner can do this)
 */
export async function deleteOrganization(organizationId: string, userId: string): Promise<{ success: boolean; message: string }> {
  await query('BEGIN')
  
  try {
    // Check if user is owner
    const member = await queryOne(
      `SELECT role FROM organization_members
       WHERE organization_id = $1 AND user_id = $2 AND is_active = true`,
      [organizationId, userId]
    )
    
    if (!member || member.role !== 'owner') {
      await query('ROLLBACK')
      return { success: false, message: 'Only organization owners can delete the organization' }
    }
    
    // Delete organization (cascade will handle related records)
    await query(
      `DELETE FROM organizations WHERE id = $1`,
      [organizationId]
    )
    
    await query('COMMIT')
    return { success: true, message: 'Organization deleted successfully' }
  } catch (error) {
    await query('ROLLBACK')
    throw error
  }
}

