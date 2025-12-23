import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { assignUserToTeam } from '@/lib/team-service'

/**
 * POST /api/organization/teams/assign
 * Assign user to team
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const body = await request.json()
    const { organizationId, userId, teamId } = body
    
    if (!organizationId || !userId || !teamId) {
      return NextResponse.json(
        { success: false, error: 'Organization ID, user ID, and team ID are required' },
        { status: 400 }
      )
    }
    
    const result = await assignUserToTeam(organizationId, userId, teamId, user.userId)
    
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
    console.error('Error assigning user to team:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to assign user to team'
      },
      { status: 500 }
    )
  }
}

