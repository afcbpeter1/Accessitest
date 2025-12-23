import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import {
  createOrganization,
  getUserOrganizations,
  getOrganization,
  updateOrganization,
  deleteOrganization
} from '@/lib/organization-service'

/**
 * GET /api/organization
 * Get user's organizations
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const organizations = await getUserOrganizations(user.userId)
    
    return NextResponse.json({
      success: true,
      organizations
    })
  } catch (error) {
    console.error('Error fetching organizations:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch organizations'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/organization
 * Create a new organization (DEPRECATED - users can only have one organization)
 * Organizations are auto-created on signup
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    
    // Check if user already has an organization
    const existingOrgs = await getUserOrganizations(user.userId)
    if (existingOrgs.length > 0) {
      return NextResponse.json(
        { success: false, error: 'You already have an organization. Each user can only have one organization.' },
        { status: 400 }
      )
    }
    
    // If no org exists, allow creation (for edge cases)
    const body = await request.json()
    const { name } = body
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Organization name is required' },
        { status: 400 }
      )
    }
    
    const organization = await createOrganization(user.userId, name.trim())
    
    return NextResponse.json({
      success: true,
      organization,
      message: 'Organization created successfully'
    })
  } catch (error) {
    console.error('Error creating organization:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create organization'
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/organization
 * Update organization
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const body = await request.json()
    const { organizationId, ...updates } = body
    
    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: 'Organization ID is required' },
        { status: 400 }
      )
    }
    
    const result = await updateOrganization(organizationId, updates, user.userId)
    
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
    console.error('Error updating organization:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update organization'
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/organization
 * Delete organization
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('id')
    
    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: 'Organization ID is required' },
        { status: 400 }
      )
    }
    
    const result = await deleteOrganization(organizationId, user.userId)
    
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
    console.error('Error deleting organization:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete organization'
      },
      { status: 500 }
    )
  }
}

