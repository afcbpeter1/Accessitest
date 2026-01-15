import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { removeUserFromTeam } from '@/lib/team-service'

/**
 * POST /api/organization/teams/remove
 * Remove user from team
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const body = await request.json()
    const { organizationId, userId } = body
    
    if (!organizationId || !userId) {
      return NextResponse.json(
        { success: false, error: 'Organization ID and user ID are required' },
        { status: 400 }
      )
    }
    
    const result = await removeUserFromTeam(organizationId, userId, user.userId)
    
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
    console.error('Error removing user from team:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove user from team'
      },
      { status: 500 }
    )
  }
}






