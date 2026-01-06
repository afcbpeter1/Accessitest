import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { queryOne } from '@/lib/database'
import { AzureDevOpsClient } from '@/lib/azure-devops-client'

/**
 * GET /api/azure-devops/settings/work-item-types?project=XXX
 * Get available work item types for a project
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const { searchParams } = new URL(request.url)
    const project = searchParams.get('project')
    const projectId = searchParams.get('projectId') // Optional: prefer project ID if available
    const teamId = searchParams.get('teamId') // Optional: team ID to get work item types for specific team

    if (!project) {
      return NextResponse.json(
        {
          success: false,
          error: 'project query parameter is required'
        },
        { status: 400 }
      )
    }

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

    // Use teamId if provided to get work item types for that specific team's backlog
    // Otherwise get from project-level
    const workItemTypes = await client.getWorkItemTypes(project, projectId || undefined, teamId || undefined)

    return NextResponse.json({
      success: true,
      workItemTypes: workItemTypes.map(t => ({
        name: t.name,
        referenceName: t.referenceName,
        description: t.description
      }))
    })
  } catch (error) {
    console.error('Error fetching work item types:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch work item types'
      },
      { status: 500 }
    )
  }
}

