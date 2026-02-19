import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import pool from '@/lib/database'

// POST /api/backlog/bulk-delete - Delete multiple backlog items
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { itemIds } = await request.json()

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json(
        { error: 'itemIds array is required' },
        { status: 400 }
      )
    }

    // First, verify all issues exist and belong to the user
    const checkResult = await pool.query(`
      SELECT i.id 
      FROM issues i
      LEFT JOIN scan_history sh ON i.first_seen_scan_id = sh.id
      WHERE i.id = ANY($1::uuid[])
        AND (
          (sh.id IS NOT NULL AND sh.user_id = $2)
          OR
          (sh.id IS NULL AND EXISTS (
            SELECT 1 FROM scan_history sh2 
            WHERE sh2.id = i.first_seen_scan_id AND sh2.user_id = $2
          ))
        )
    `, [itemIds, user.userId])

    if (checkResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'No valid issues found or access denied' },
        { status: 404 }
      )
    }

    const validIds = checkResult.rows.map(row => row.id)

    // Delete the issues from the issues table
    const deleteResult = await pool.query(`
      DELETE FROM issues 
      WHERE id = ANY($1::uuid[])
    `, [validIds])

    return NextResponse.json({
      success: true,
      message: `${deleteResult.rowCount} issue(s) deleted successfully`,
      deletedCount: deleteResult.rowCount
    })

  } catch (error: any) {
    console.error('❌ Error bulk deleting issues:', error)
    return NextResponse.json(
      { error: 'Failed to delete issues', details: error.message },
      { status: 500 }
    )
  }
}

