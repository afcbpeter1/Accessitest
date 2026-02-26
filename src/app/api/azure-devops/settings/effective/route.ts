import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { queryOne } from '@/lib/database'

/**
 * GET /api/azure-devops/settings/effective
 * Returns the Azure DevOps integration this user would use when adding an issue
 * (their team's integration if they're in a team with ADO, otherwise personal).
 * Used so the UI can show "Add to Azure DevOps" when the user has access.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)

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

    let integration

    if (userTeam?.team_id) {
      integration = await queryOne(
        `SELECT id, user_id, team_id, organization, project, work_item_type, area_path, iteration_path,
                auto_sync_enabled, is_active, last_verified_at, created_at, updated_at
         FROM azure_devops_integrations
         WHERE team_id = $1 AND is_active = true`,
        [userTeam.team_id]
      )
    }

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
