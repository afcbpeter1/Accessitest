import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { queryOne } from '@/lib/database'
import { JiraClient } from '@/lib/jira-client'

/**
 * GET /api/jira/settings/projects
 * Get available projects for user's Jira integration
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)

    // Get user's Jira integration
    const integration = await queryOne(
      `SELECT jira_url, jira_email, encrypted_api_token 
      FROM jira_integrations 
      WHERE user_id = $1 AND is_active = true`,
      [user.userId]
    )

    if (!integration) {
      return NextResponse.json(
        {
          success: false,
          error: 'Jira integration not found. Please configure Jira in settings first.'
        },
        { status: 404 }
      )
    }

    // Create client
    const client = new JiraClient({
      jiraUrl: integration.jira_url,
      email: integration.jira_email,
      encryptedApiToken: integration.encrypted_api_token
    })

    // Fetch projects
    const projects = await client.getProjects()

    return NextResponse.json({
      success: true,
      projects: projects.map(p => ({
        id: p.id,
        key: p.key,
        name: p.name,
        displayName: `${p.name} (${p.key})`
      }))
    })
  } catch (error) {
    console.error('Error fetching Jira projects:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch projects'
      },
      { status: 500 }
    )
  }
}











