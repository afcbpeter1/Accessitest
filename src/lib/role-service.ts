import { queryOne } from '@/lib/database'

export type Role = 'owner' | 'admin' | 'user'

export interface Permission {
  canManageUsers: boolean
  canManageTeams: boolean
  canManageIntegrations: boolean
  canViewBilling: boolean
  canManageBilling: boolean
  canDeleteOrganization: boolean
  canUseCredits: boolean
  canCreateScans: boolean
}

/**
 * Get user's role in an organization
 */
export async function getUserRole(userId: string, organizationId: string): Promise<Role | null> {
  const member = await queryOne(
    `SELECT role FROM organization_members
     WHERE organization_id = $1 AND user_id = $2 AND is_active = true`,
    [organizationId, userId]
  )
  
  return member?.role || null
}

/**
 * Check if user has a specific role or higher
 */
export async function hasRole(userId: string, organizationId: string, requiredRole: Role): Promise<boolean> {
  const role = await getUserRole(userId, organizationId)
  
  if (!role) {
    return false
  }
  
  const roleHierarchy: Record<Role, number> = {
    owner: 3,
    admin: 2,
    user: 1
  }
  
  return roleHierarchy[role] >= roleHierarchy[requiredRole]
}

/**
 * Check if user is a member of an organization
 */
export async function isMember(userId: string, organizationId: string): Promise<boolean> {
  const member = await queryOne(
    `SELECT id FROM organization_members
     WHERE organization_id = $1 AND user_id = $2 AND is_active = true`,
    [organizationId, userId]
  )
  
  return !!member
}

/**
 * Get user's permissions for an organization
 */
export async function getPermissions(userId: string, organizationId: string): Promise<Permission> {
  const role = await getUserRole(userId, organizationId)
  
  if (!role) {
    return {
      canManageUsers: false,
      canManageTeams: false,
      canManageIntegrations: false,
      canViewBilling: false,
      canManageBilling: false,
      canDeleteOrganization: false,
      canUseCredits: false,
      canCreateScans: false
    }
  }
  
  const permissions: Permission = {
    canManageUsers: role === 'owner' || role === 'admin',
    canManageTeams: role === 'owner' || role === 'admin',
    canManageIntegrations: role === 'owner' || role === 'admin',
    canViewBilling: role === 'owner' || role === 'admin',
    canManageBilling: role === 'owner',
    canDeleteOrganization: role === 'owner',
    canUseCredits: true,
    canCreateScans: true
  }
  
  return permissions
}

/**
 * Check if user can perform a specific action
 */
export async function checkPermission(
  userId: string,
  organizationId: string,
  action: keyof Permission
): Promise<boolean> {
  const permissions = await getPermissions(userId, organizationId)
  return permissions[action]
}

/**
 * Require a specific role (throws error if not met)
 */
export async function requireRole(
  userId: string,
  organizationId: string,
  requiredRole: Role
): Promise<void> {
  const hasAccess = await hasRole(userId, organizationId, requiredRole)
  
  if (!hasAccess) {
    throw new Error(`This action requires ${requiredRole} role or higher`)
  }
}

/**
 * Require a specific permission (throws error if not met)
 */
export async function requirePermission(
  userId: string,
  organizationId: string,
  permission: keyof Permission
): Promise<void> {
  const hasAccess = await checkPermission(userId, organizationId, permission)
  
  if (!hasAccess) {
    throw new Error(`You do not have permission to ${permission}`)
  }
}

