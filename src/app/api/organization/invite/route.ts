import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { inviteUser } from '@/lib/organization-service'

/**
 * POST /api/organization/invite
 * Invite a user to an organization
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const body = await request.json()
    const { organizationId, email, role, teamId } = body
    
    if (!organizationId || !email) {
      return NextResponse.json(
        { success: false, error: 'Organization ID and email are required' },
        { status: 400 }
      )
    }
    
    if (role && !['owner', 'admin', 'user'].includes(role)) {
      return NextResponse.json(
        { success: false, error: 'Invalid role. Must be owner, admin, or user' },
        { status: 400 }
      )
    }
    
    const result = await inviteUser(
      organizationId,
      user.userId,
      email,
      role || 'user',
      teamId
    )
    
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
    console.error('Error inviting user:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to invite user'
      },
      { status: 500 }
    )
  }
}

