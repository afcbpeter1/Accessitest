import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import {
  createTeam,
  getOrganizationTeams,
  updateTeam,
  deleteTeam,
  assignUserToTeam,
  removeUserFromTeam
} from '@/lib/team-service'

/**
 * GET /api/organization/teams
 * Get organization teams
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organization_id')
    
    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: 'Organization ID is required' },
        { status: 400 }
      )
    }
    
    const teams = await getOrganizationTeams(organizationId)
    
    return NextResponse.json({
      success: true,
      teams
    })
  } catch (error) {
    console.error('Error fetching teams:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch teams'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/organization/teams
 * Create a new team
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const body = await request.json()
    const { organizationId, name, description } = body
    
    if (!organizationId || !name) {
      return NextResponse.json(
        { success: false, error: 'Organization ID and team name are required' },
        { status: 400 }
      )
    }
    
    const team = await createTeam(organizationId, name, description, user.userId)
    
    return NextResponse.json({
      success: true,
      team,
      message: 'Team created successfully'
    })
  } catch (error) {
    console.error('Error creating team:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create team'
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/organization/teams
 * Update team
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const body = await request.json()
    const { teamId, ...updates } = body
    
    if (!teamId) {
      return NextResponse.json(
        { success: false, error: 'Team ID is required' },
        { status: 400 }
      )
    }
    
    const result = await updateTeam(teamId, updates, user.userId)
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.message },
        { status: 403 }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: result.message
    })
  } catch (error) {
    console.error('Error updating team:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update team'
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/organization/teams
 * Delete team
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('id')
    
    if (!teamId) {
      return NextResponse.json(
        { success: false, error: 'Team ID is required' },
        { status: 400 }
      )
    }
    
    const result = await deleteTeam(teamId, user.userId)
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.message },
        { status: 403 }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: result.message
    })
  } catch (error) {
    console.error('Error deleting team:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete team'
      },
      { status: 500 }
    )
  }
}


