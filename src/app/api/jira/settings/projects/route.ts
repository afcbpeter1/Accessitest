import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { queryOne } from '@/lib/database'
import { JiraClient } from '@/lib/jira-client'

export const dynamic = 'force-dynamic'

/**
 * GET /api/jira/settings/projects
 * Get available projects for user's Jira integration
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)

    // Get user's personal Jira integration (not team-specific)
    const integration = await queryOne(
      `SELECT jira_url, jira_email, encrypted_api_token 
      FROM jira_integrations 
      WHERE user_id = $1 AND team_id IS NULL AND is_active = true
      ORDER BY created_at DESC
      LIMIT 1`,
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
    console.log('🔍 Fetching Jira projects for user:', user.userId)
    console.log('🔍 Using Jira URL:', integration.jira_url)
    
    const projects = await client.getProjects()
    
    console.log(`✅ Successfully fetched ${projects.length} projects from Jira`)
    
    if (projects.length === 0) {
      console.warn('⚠️ No projects returned from Jira API - user may not have access to any projects')
    }

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
    console.error('❌ Error fetching Jira projects:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch projects'
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('❌ Error details:', { errorMessage, errorStack })
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage
      },
      { status: 500 }
    )
  }
}











