import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { queryOne } from '@/lib/database'
import { JiraClient } from '@/lib/jira-client'

/**
 * POST /api/jira/settings/test
 * Test Jira connection and return available projects
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const body = await request.json()

    const { jiraUrl, email, apiToken } = body

    // Validate required fields
    if (!jiraUrl || !email || !apiToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: jiraUrl, email, apiToken'
        },
        { status: 400 }
      )
    }

    // Create temporary client to test connection
    const { encryptTokenForStorage } = await import('@/lib/jira-encryption-service')
    const encryptedToken = encryptTokenForStorage(apiToken)
    
    const client = new JiraClient({
      jiraUrl,
      email,
      encryptedApiToken: encryptedToken
    })

    // Test connection
    const connectionTest = await client.testConnection()
    
    if (!connectionTest.success) {
      return NextResponse.json({
        success: false,
        error: connectionTest.error || 'Failed to connect to Jira'
      })
    }

    // Fetch available projects
    let projects = []
    try {
      projects = await client.getProjects()
    } catch (error) {
      console.error('Error fetching projects:', error)
      // Return success even if projects fail (connection works)
    }

    return NextResponse.json({
      success: true,
      user: connectionTest.user,
      projects: projects.map(p => ({
        id: p.id,
        key: p.key,
        name: p.name,
        displayName: `${p.name} (${p.key})`
      }))
    })
  } catch (error) {
    console.error('Error testing Jira connection:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to test Jira connection'
      },
      { status: 500 }
    )
  }
}



