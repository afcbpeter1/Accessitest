import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { queryOne } from '@/lib/database'
import { deleteApiKey } from '@/lib/api-key-service'

async function getPrimaryOrganizationId(userId: string): Promise<string | null> {
  const row = await queryOne(
    `SELECT om.organization_id
     FROM organization_members om
     INNER JOIN organizations o ON o.id = om.organization_id
     WHERE om.user_id = $1 AND om.is_active = true
     ORDER BY CASE WHEN om.role = 'owner' THEN 1 ELSE 2 END, om.joined_at ASC
     LIMIT 1`,
    [userId]
  )
  return (row as any)?.organization_id ?? null
}

/**
 * DELETE /api/api-keys/[id] - Delete an API key
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUser(request)
    const organizationId = await getPrimaryOrganizationId(user.userId)
    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: 'No organization found' },
        { status: 400 }
      )
    }
    const id = params.id
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'API key ID is required' },
        { status: 400 }
      )
    }
    const deleted = await deleteApiKey(id, organizationId)
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'API key not found or already deleted' },
        { status: 404 }
      )
    }
    return NextResponse.json({ success: true, message: 'API key deleted' })
  } catch (error) {
    if ((error as Error).message?.includes('Authentication')) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }
    console.error('Delete API key error:', error)
    return NextResponse.json(
      { success: false, error: (error as Error).message ?? 'Failed to delete API key' },
      { status: 500 }
    )
  }
}
