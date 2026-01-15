import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { getOrganizationMembers, removeMember, updateMemberRole } from '@/lib/organization-service'

/**
 * GET /api/organization/members
 * Get organization members
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
    
    const members = await getOrganizationMembers(organizationId)
    
    return NextResponse.json({
      success: true,
      members
    })
  } catch (error) {
    console.error('Error fetching members:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch members'
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/organization/members
 * Update member role
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const body = await request.json()
    const { organizationId, userId, role } = body
    
    if (!organizationId || !userId || !role) {
      return NextResponse.json(
        { success: false, error: 'Organization ID, user ID, and role are required' },
        { status: 400 }
      )
    }
    
    if (!['owner', 'admin', 'user'].includes(role)) {
      return NextResponse.json(
        { success: false, error: 'Invalid role. Must be owner, admin, or user' },
        { status: 400 }
      )
    }
    
    const result = await updateMemberRole(organizationId, userId, role, user.userId)
    
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
    console.error('Error updating member role:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update member role'
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/organization/members
 * Remove member from organization
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organization_id')
    const userId = searchParams.get('user_id')
    
    if (!organizationId || !userId) {
      return NextResponse.json(
        { success: false, error: 'Organization ID and user ID are required' },
        { status: 400 }
      )
    }
    
    const result = await removeMember(organizationId, userId, user.userId)
    
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
    console.error('Error removing member:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove member'
      },
      { status: 500 }
    )
  }
}






