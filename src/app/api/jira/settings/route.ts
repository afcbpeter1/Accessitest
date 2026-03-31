import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { query, queryOne, queryMany } from '@/lib/database'
import { encryptTokenForStorage, decryptTokenFromStorage } from '@/lib/jira-encryption-service'
import { JiraClient } from '@/lib/jira-client'
import { checkPermission } from '@/lib/role-service'

/**
 * GET /api/jira/settings
 * Get user's Jira integration settings (without decrypted token)
 * Supports team_id query parameter to get team integration
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('team_id')

    let integration

    if (teamId) {
      // Get team integration - check if user has permission
      const team = await queryOne(
        `SELECT t.organization_id, om.role
         FROM teams t
         INNER JOIN organization_members om ON t.organization_id = om.organization_id
         WHERE t.id = $1 AND om.user_id = $2 AND om.is_active = true`,
        [teamId, user.userId]
      )

      if (!team) {
        return NextResponse.json(
          { success: false, error: 'Team not found or access denied' },
          { status: 403 }
        )
      }

      // Check permission
      const hasPermission = await checkPermission(user.userId, team.organization_id, 'canManageIntegrations')
      if (!hasPermission) {
        return NextResponse.json(
          { success: false, error: 'You do not have permission to view team integrations' },
          { status: 403 }
        )
      }

      // Schema note: jira_integrations enforces UNIQUE(user_id) and user_id is NOT NULL.
      // So we store credentials once per user (personal integration) and keep per-team overrides on teams table.
      const teamOverrides = await queryOne(
        `SELECT jira_project_key, jira_issue_type
         FROM teams
         WHERE id = $1`,
        [teamId]
      )

      integration = await queryOne(
        `SELECT 
          id, user_id, team_id, jira_url, jira_email, project_key, issue_type,
          auto_sync_enabled, is_active, last_verified_at, created_at, updated_at
        FROM jira_integrations 
        WHERE user_id = $1 AND team_id IS NULL AND is_active = true`,
        [user.userId]
      )

      if (integration && teamOverrides) {
        if (teamOverrides.jira_project_key) integration.project_key = teamOverrides.jira_project_key
        if (teamOverrides.jira_issue_type) integration.issue_type = teamOverrides.jira_issue_type
      }
    } else {
      // Get personal integration
      integration = await queryOne(
        `SELECT 
          id, user_id, team_id, jira_url, jira_email, project_key, issue_type,
          auto_sync_enabled, is_active, last_verified_at, created_at, updated_at
        FROM jira_integrations 
        WHERE user_id = $1 AND team_id IS NULL AND is_active = true`,
        [user.userId]
      )
    }

    if (!integration) {
      return NextResponse.json({
        success: true,
        integration: null
      })
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
    console.error('Error fetching Jira settings:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch Jira settings'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/jira/settings
 * Save or update Jira integration settings
 * Supports team_id in body to create team integration
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const body = await request.json()

    const { jiraUrl, email, apiToken, projectKey, issueType, autoSyncEnabled, teamId } = body
    const resolvedAutoSyncEnabled = autoSyncEnabled ?? true

    // If teamId provided, check permissions
    if (teamId) {
      const team = await queryOne(
        `SELECT t.organization_id, om.role
         FROM teams t
         INNER JOIN organization_members om ON t.organization_id = om.organization_id
         WHERE t.id = $1 AND om.user_id = $2 AND om.is_active = true`,
        [teamId, user.userId]
      )

      if (!team) {
        return NextResponse.json(
          { success: false, error: 'Team not found or access denied' },
          { status: 403 }
        )
      }

      // Check permission
      const hasPermission = await checkPermission(user.userId, team.organization_id, 'canManageIntegrations')
      if (!hasPermission) {
        return NextResponse.json(
          { success: false, error: 'You do not have permission to configure team integrations' },
          { status: 403 }
        )
      }
    }

    // Check if integration already exists
    // Store credentials once per user (team_id IS NULL)
    const existing = await queryOne(
      'SELECT id, encrypted_api_token FROM jira_integrations WHERE user_id = $1 AND team_id IS NULL',
      [user.userId]
    )

    // Validate required fields - apiToken only required for new integrations
    if (!jiraUrl || !email || !projectKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: jiraUrl, email, projectKey'
        },
        { status: 400 }
      )
    }

    // API token is required for new integrations, but optional for updates
    if (!existing && !apiToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'API token is required for new integrations'
        },
        { status: 400 }
      )
    }

    // Validate Jira URL format
    try {
      const url = new URL(jiraUrl)
      if (!url.protocol.startsWith('http')) {
        throw new Error('Invalid URL protocol')
      }
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid Jira URL format'
        },
        { status: 400 }
      )
    }

    let encryptedToken: string
    
    if (existing && !apiToken) {
      // If updating existing integration and no new token provided, keep existing encrypted token
      encryptedToken = existing.encrypted_api_token
    } else if (apiToken) {
      // Encrypt new API token
      encryptedToken = encryptTokenForStorage(apiToken)
    } else {
      // This should not happen due to validation above, but just in case
      return NextResponse.json(
        {
          success: false,
          error: 'API token is required for new integrations'
        },
        { status: 400 }
      )
    }

    if (existing) {
      // Update existing integration - ensure is_active is set to true
      await query(
        `UPDATE jira_integrations 
         SET jira_url = $1, jira_email = $2, encrypted_api_token = $3,
             project_key = $4, issue_type = $5, auto_sync_enabled = $6,
             is_active = true, updated_at = NOW()
         WHERE user_id = $7 AND team_id IS NULL`,
        [jiraUrl, email, encryptedToken, projectKey, issueType || 'Bug', resolvedAutoSyncEnabled, user.userId]
      )
    } else {
      // Create new integration - set is_active to true
      await query(
        `INSERT INTO jira_integrations 
        (user_id, team_id, jira_url, jira_email, encrypted_api_token, project_key, issue_type, auto_sync_enabled, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)`,
        [user.userId, null, jiraUrl, email, encryptedToken, projectKey, issueType || 'Bug', resolvedAutoSyncEnabled]
      )
    }

    // If this save is in a team context, store per-team overrides on teams table.
    if (teamId) {
      await query(
        `UPDATE teams
         SET jira_project_key = $1,
             jira_issue_type = $2,
             updated_at = NOW()
         WHERE id = $3`,
        [projectKey, issueType || 'Bug', teamId]
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Jira integration saved successfully'
    })
  } catch (error) {
    console.error('Error saving Jira settings:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save Jira settings'
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/jira/settings
 * Remove Jira integration
 * Supports team_id query parameter to remove team integration
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('team_id')

    if (teamId) {
      // Check permission for team integration
      const team = await queryOne(
        `SELECT t.organization_id, om.role
         FROM teams t
         INNER JOIN organization_members om ON t.organization_id = om.organization_id
         WHERE t.id = $1 AND om.user_id = $2 AND om.is_active = true`,
        [teamId, user.userId]
      )

      if (!team) {
        return NextResponse.json(
          { success: false, error: 'Team not found or access denied' },
          { status: 403 }
        )
      }

      const hasPermission = await checkPermission(user.userId, team.organization_id, 'canManageIntegrations')
      if (!hasPermission) {
        return NextResponse.json(
          { success: false, error: 'You do not have permission to remove team integrations' },
          { status: 403 }
        )
      }

      await query(
        'UPDATE jira_integrations SET is_active = false, updated_at = NOW() WHERE team_id = $1',
        [teamId]
      )
    } else {
      await query(
        'UPDATE jira_integrations SET is_active = false, updated_at = NOW() WHERE user_id = $1 AND team_id IS NULL',
        [user.userId]
      )
      // Admin's personal integration is the org's: also remove from all teams in their org
      const orgAsAdmin = await queryOne(
        `SELECT organization_id FROM organization_members
         WHERE user_id = $1 AND role IN ('owner', 'admin') AND is_active = true LIMIT 1`,
        [user.userId]
      )
      if (orgAsAdmin?.organization_id) {
        const teams = await queryMany(`SELECT id FROM teams WHERE organization_id = $1`, [orgAsAdmin.organization_id])
        for (const row of teams) {
          await query(
            'UPDATE jira_integrations SET is_active = false, updated_at = NOW() WHERE team_id = $1',
            [row.id]
          )
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Jira integration removed successfully'
    })
  } catch (error) {
    console.error('Error removing Jira integration:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove Jira integration'
      },
      { status: 500 }
    )
  }
}

