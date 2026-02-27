import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { queryOne } from '@/lib/database'

/**
 * GET /api/jira/settings/effective
 * Returns the Jira integration this user would use when adding an issue to Jira.
 * Priority: 1) user's team Jira, 2) any team in org with Jira, 3) org admin/owner's personal Jira (members adopt admin's), 4) personal.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)

    let integration

    // 1. User's assigned team that has Jira
    const userTeam = await queryOne(
      `SELECT om.team_id, om.organization_id
       FROM organization_members om
       INNER JOIN teams t ON om.team_id = t.id
       INNER JOIN jira_integrations ji ON ji.team_id = t.id AND ji.is_active = true
       WHERE om.user_id = $1 AND om.is_active = true AND om.team_id IS NOT NULL
       ORDER BY om.joined_at DESC
       LIMIT 1`,
      [user.userId]
    )
    if (userTeam?.team_id) {
      integration = await queryOne(
        `SELECT id, user_id, team_id, jira_url, jira_email, project_key, issue_type,
                auto_sync_enabled, is_active, last_verified_at, created_at, updated_at
         FROM jira_integrations WHERE team_id = $1 AND is_active = true`,
        [userTeam.team_id]
      )
    }

    // 2. Any team in the user's organization has Jira
    if (!integration) {
      const orgWithJira = await queryOne(
        `SELECT ji.id, ji.user_id, ji.team_id, ji.jira_url, ji.jira_email, ji.project_key, ji.issue_type,
                ji.auto_sync_enabled, ji.is_active, ji.last_verified_at, ji.created_at, ji.updated_at
         FROM jira_integrations ji
         INNER JOIN teams t ON ji.team_id = t.id
         INNER JOIN organization_members om ON om.organization_id = t.organization_id AND om.user_id = $1 AND om.is_active = true
         WHERE ji.is_active = true
         LIMIT 1`,
        [user.userId]
      )
      if (orgWithJira) integration = orgWithJira
    }

    // 3. Org admin/owner's personal Jira – members adopt the integration of the admin who added them
    if (!integration) {
      const adminJira = await queryOne(
        `SELECT ji.id, ji.user_id, ji.team_id, ji.jira_url, ji.jira_email, ji.project_key, ji.issue_type,
                ji.auto_sync_enabled, ji.is_active, ji.last_verified_at, ji.created_at, ji.updated_at
         FROM jira_integrations ji
         INNER JOIN organization_members om ON om.user_id = ji.user_id AND om.is_active = true AND om.role IN ('owner', 'admin')
         INNER JOIN organization_members me ON me.organization_id = om.organization_id AND me.user_id = $1 AND me.is_active = true
         WHERE ji.team_id IS NULL AND ji.is_active = true
         LIMIT 1`,
        [user.userId]
      )
      if (adminJira) integration = adminJira
    }

    // 4. Current user's personal integration
    if (!integration) {
      integration = await queryOne(
        `SELECT id, user_id, team_id, jira_url, jira_email, project_key, issue_type,
                auto_sync_enabled, is_active, last_verified_at, created_at, updated_at
         FROM jira_integrations
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
        jiraUrl: integration.jira_url,
        email: integration.jira_email,
        projectKey: integration.project_key,
        issueType: integration.issue_type,
        autoSyncEnabled: integration.auto_sync_enabled,
        isActive: integration.is_active,
        lastVerifiedAt: integration.last_verified_at,
        createdAt: integration.created_at,
        updatedAt: integration.updated_at
      }
    })
  } catch (error) {
    console.error('Error fetching effective Jira settings:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch Jira settings' },
      { status: 500 }
    )
  }
}
