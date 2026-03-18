import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import pool from '@/lib/database'

// POST /api/product-backlog/bulk-delete - delete multiple product_backlog items for current user
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const body = await request.json().catch(() => ({}))
    const itemIds: string[] = Array.isArray(body.itemIds) ? body.itemIds : []
    if (itemIds.length === 0) {
      return NextResponse.json({ success: false, error: 'No item IDs provided' }, { status: 400 })
    }

    const res = await pool.query(
      `DELETE FROM product_backlog
       WHERE user_id = $1 AND id = ANY($2::uuid[])`,
      [user.userId, itemIds]
    )

    const deleted = (res as any).rowCount ?? 0
    if (deleted === 0) {
      return NextResponse.json({ success: false, error: 'No valid items found or access denied' }, { status: 403 })
    }

    return NextResponse.json({ success: true, deleted })
  } catch (error) {
    if ((error as Error).message?.includes('Authentication')) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }
    console.error('Bulk delete product backlog error:', error)
    return NextResponse.json({ success: false, error: 'Failed to delete backlog items' }, { status: 500 })
  }
}

