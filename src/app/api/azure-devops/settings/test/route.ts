import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { queryOne } from '@/lib/database'
import { AzureDevOpsClient } from '@/lib/azure-devops-client'

/**
 * POST /api/azure-devops/settings/test
 * Test Azure DevOps connection
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const body = await request.json()

    const { organization, pat } = body

    if (!organization || !pat) {
      return NextResponse.json(
        {
          success: false,
          error: 'Organization and Personal Access Token are required'
        },
        { status: 400 }
      )
    }

    // Encrypt PAT temporarily for client (will be re-encrypted on save)
    const { encryptTokenForStorage } = await import('@/lib/jira-encryption-service')
    const encryptedPat = encryptTokenForStorage(pat)

    const client = new AzureDevOpsClient({
      organization,
      encryptedPat
    })

    // Test connection
    const connectionTest = await client.testConnection()
    
    if (!connectionTest.success) {
      return NextResponse.json({
        success: false,
        error: connectionTest.error || 'Failed to connect to Azure DevOps'
      })
    }

    // Fetch available projects
    let projects: Array<{ id: string; name: string; description?: string }> = []
    try {
      projects = await client.getProjects()
      console.log(`✅ Fetched ${projects.length} projects from Azure DevOps`)
    } catch (error) {
      console.error('❌ Error fetching projects:', error)
      // Return success even if projects fail (connection works)
    }

    const projectsResponse = projects.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      displayName: p.name
    }))

    console.log(`📋 Returning ${projectsResponse.length} projects in test response`)

    return NextResponse.json({
      success: true,
      user: connectionTest.user,
      projects: projectsResponse
    })
  } catch (error) {
    console.error('Error testing Azure DevOps connection:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to test connection'
      },
      { status: 500 }
    )
  }
}

