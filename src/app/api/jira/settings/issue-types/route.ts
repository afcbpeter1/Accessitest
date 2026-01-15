import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { queryOne } from '@/lib/database'
import { JiraClient } from '@/lib/jira-client'

/**
 * GET /api/jira/settings/issue-types?projectKey=XXX
 * Get available issue types for a project
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const { searchParams } = new URL(request.url)
    const projectKey = searchParams.get('projectKey')

    if (!projectKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'projectKey query parameter is required'
        },
        { status: 400 }
      )
    }

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

    // Fetch issue types
    const issueTypes = await client.getIssueTypes(projectKey)

    return NextResponse.json({
      success: true,
      issueTypes: issueTypes.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        iconUrl: t.iconUrl
      }))
    })
  } catch (error) {
    console.error('Error fetching Jira issue types:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch issue types'
      },
      { status: 500 }
    )
  }
}











