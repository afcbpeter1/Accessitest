import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import pool from '@/lib/database'

// PUT /api/product-backlog/[id] - update a product_backlog item for current user (priority_rank, status)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUser(request)
    const id = params.id
    if (!id) {
      return NextResponse.json({ success: false, error: 'Item ID is required' }, { status: 400 })
    }
    const body = await request.json().catch(() => ({}))
    const { priorityRank, status } = body
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1
    if (typeof priorityRank === 'number') {
      updates.push(`priority_rank = $${paramIndex}`)
      values.push(priorityRank)
      paramIndex++
    }
    if (typeof status === 'string' && ['backlog', 'in_progress', 'done', 'cancelled'].includes(status)) {
      updates.push(`status = $${paramIndex}`)
      values.push(status)
      paramIndex++
    }
    if (updates.length === 0) {
      return NextResponse.json({ success: false, error: 'No valid fields to update' }, { status: 400 })
    }
    values.push(id, user.userId)
    const res = await pool.query(
      `UPDATE product_backlog SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}`,
      values
    )
    if ((res as any).rowCount === 0) {
      return NextResponse.json({ success: false, error: 'Backlog item not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    if ((error as Error).message?.includes('Authentication')) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }
    console.error('Update product backlog item error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update backlog item' }, { status: 500 })
  }
}

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

