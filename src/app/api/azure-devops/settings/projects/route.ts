import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { queryOne } from '@/lib/database'
import { AzureDevOpsClient } from '@/lib/azure-devops-client'

export const dynamic = 'force-dynamic'

/**
 * GET /api/azure-devops/settings/projects
 * Get available projects for user's Azure DevOps integration
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)

    // Get user's Azure DevOps integration
    const integration = await queryOne(
      `SELECT organization, encrypted_pat
      FROM azure_devops_integrations 
      WHERE user_id = $1 AND is_active = true`,
      [user.userId]
    )

    if (!integration) {
      return NextResponse.json(
        {
          success: false,
          error: 'Azure DevOps integration not found. Please configure Azure DevOps in settings first.'
        },
        { status: 404 }
      )
    }

    const client = new AzureDevOpsClient({
      organization: integration.organization,
      encryptedPat: integration.encrypted_pat
    })

    const projects = await client.getProjects()

    return NextResponse.json({
      success: true,
      projects: projects.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description
      }))
    })
  } catch (error) {
    console.error('Error fetching Azure DevOps projects:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch projects'
      },
      { status: 500 }
    )
  }
}




