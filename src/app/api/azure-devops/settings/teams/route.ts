import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { queryOne } from '@/lib/database'
import { AzureDevOpsClient } from '@/lib/azure-devops-client'

/**
 * GET /api/azure-devops/settings/teams?project=XXX&projectId=XXX
 * Get available teams for a project
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const { searchParams } = new URL(request.url)
    const project = searchParams.get('project')
    const projectId = searchParams.get('projectId') // Optional: prefer project ID if available
    const organization = searchParams.get('organization') // Optional: from form
    const pat = searchParams.get('pat') // Optional: from form (for testing)

    if (!project) {
      return NextResponse.json(
        {
          success: false,
          error: 'project query parameter is required'
        },
        { status: 400 }
      )
    }

    // Try to get integration from database first
    let integration = await queryOne(
      `SELECT organization, encrypted_pat
      FROM azure_devops_integrations 
      WHERE user_id = $1 AND is_active = true`,
      [user.userId]
    )

    // If no saved integration, use values from query params (for initial setup)
    let orgToUse = integration?.organization || organization
    let encryptedPatToUse = integration?.encrypted_pat

    // If PAT provided in query params, encrypt it temporarily
    if (!encryptedPatToUse && pat) {
      const { encryptTokenForStorage } = await import('@/lib/jira-encryption-service')
      encryptedPatToUse = encryptTokenForStorage(pat)
    }

    if (!orgToUse || !encryptedPatToUse) {
      return NextResponse.json(
        {
          success: false,
          error: 'Azure DevOps organization and PAT are required. Please configure Azure DevOps in settings or provide them in the request.'
        },
        { status: 400 }
      )
    }

    const client = new AzureDevOpsClient({
      organization: orgToUse,
      encryptedPat: encryptedPatToUse
    })

    // Get teams for the project
    const teams = await client.getTeams(project, projectId || undefined)

    return NextResponse.json({
      success: true,
      teams: teams.map(t => ({
        id: t.id,
        name: t.name
      }))
    })
  } catch (error) {
    console.error('Error fetching teams:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch teams'
    console.error('Error details:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json(
      {
        success: false,
        error: errorMessage
      },
      { status: 500 }
    )
  }
}

