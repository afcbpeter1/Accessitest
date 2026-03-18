import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import pool from '@/lib/database'

// DELETE /api/product-backlog/[id] - delete a product_backlog item for current user
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUser(request)
    const id = params.id
    if (!id) {
      return NextResponse.json({ success: false, error: 'Item ID is required' }, { status: 400 })
    }

    const res = await pool.query(
      `DELETE FROM product_backlog WHERE id = $1 AND user_id = $2`,
      [id, user.userId]
    )

    if ((res as any).rowCount === 0) {
      return NextResponse.json({ success: false, error: 'Backlog item not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if ((error as Error).message?.includes('Authentication')) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }
    console.error('Delete product backlog item error:', error)
    return NextResponse.json({ success: false, error: 'Failed to delete backlog item' }, { status: 500 })
  }
}

