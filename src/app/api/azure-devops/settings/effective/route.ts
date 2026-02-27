import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { queryOne } from '@/lib/database'

/**
 * GET /api/azure-devops/settings/effective
 * Returns the Azure DevOps integration this user would use when adding an issue.
 * Priority: 1) user's team ADO, 2) any team in org with ADO, 3) org admin/owner's personal ADO (members adopt), 4) personal.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)

    let integration

    // 1. User's assigned team that has Azure DevOps
    const userTeam = await queryOne(
      `SELECT om.team_id, om.organization_id
       FROM organization_members om
       INNER JOIN teams t ON om.team_id = t.id
       INNER JOIN azure_devops_integrations adi ON adi.team_id = t.id AND adi.is_active = true
       WHERE om.user_id = $1 AND om.is_active = true AND om.team_id IS NOT NULL
       ORDER BY om.joined_at DESC
       LIMIT 1`,
      [user.userId]
    )
    if (userTeam?.team_id) {
      integration = await queryOne(
        `SELECT id, user_id, team_id, organization, project, work_item_type, area_path, iteration_path,
                auto_sync_enabled, is_active, last_verified_at, created_at, updated_at
         FROM azure_devops_integrations
         WHERE team_id = $1 AND is_active = true`,
        [userTeam.team_id]
      )
    }

    // 2. Any team in the user's organization has Azure DevOps
    if (!integration) {
      const orgWithAdo = await queryOne(
        `SELECT adi.id, adi.user_id, adi.team_id, adi.organization, adi.project, adi.work_item_type, adi.area_path, adi.iteration_path,
                adi.auto_sync_enabled, adi.is_active, adi.last_verified_at, adi.created_at, adi.updated_at
         FROM azure_devops_integrations adi
         INNER JOIN teams t ON adi.team_id = t.id
         INNER JOIN organization_members om ON om.organization_id = t.organization_id AND om.user_id = $1 AND om.is_active = true
         WHERE adi.is_active = true
         LIMIT 1`,
        [user.userId]
      )
      if (orgWithAdo) integration = orgWithAdo
    }

    // 3. Org admin/owner's personal Azure DevOps – members adopt the integration of the admin who added them
    if (!integration) {
      const adminAdo = await queryOne(
        `SELECT adi.id, adi.user_id, adi.team_id, adi.organization, adi.project, adi.work_item_type, adi.area_path, adi.iteration_path,
                adi.auto_sync_enabled, adi.is_active, adi.last_verified_at, adi.created_at, adi.updated_at
         FROM azure_devops_integrations adi
         INNER JOIN organization_members om ON om.user_id = adi.user_id AND om.is_active = true AND om.role IN ('owner', 'admin')
         INNER JOIN organization_members me ON me.organization_id = om.organization_id AND me.user_id = $1 AND me.is_active = true
         WHERE adi.team_id IS NULL AND adi.is_active = true
         LIMIT 1`,
        [user.userId]
      )
      if (adminAdo) integration = adminAdo
    }

    // 4. Current user's personal integration
    if (!integration) {
      integration = await queryOne(
        `SELECT id, user_id, team_id, organization, project, work_item_type, area_path, iteration_path,
                auto_sync_enabled, is_active, last_verified_at, created_at, updated_at
         FROM azure_devops_integrations
         WHERE user_id = $1 AND team_id IS NULL AND is_active = true`,
        [user.userId]
      )
    }

    if (!integration) {
      return NextResponse.json({ success: true, integration: null })
    }

    return NextResponse.json({
      success: true,
      integration: {
        id: integration.id,
        userId: integration.user_id,
        teamId: integration.team_id,
        organization: integration.organization,
        project: integration.project,
        workItemType: integration.work_item_type,
        areaPath: integration.area_path,
        iterationPath: integration.iteration_path,
        autoSyncEnabled: integration.auto_sync_enabled,
        isActive: integration.is_active,
        lastVerifiedAt: integration.last_verified_at,
        createdAt: integration.created_at,
        updatedAt: integration.updated_at
      }
    })
  } catch (error) {
    console.error('Error fetching effective Azure DevOps settings:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch Azure DevOps settings' },
      { status: 500 }
    )
  }
}
