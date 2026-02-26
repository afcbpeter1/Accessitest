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

    // Which issues does the user own (their scan) vs only linked (user_issues)?
    const checkResult = await pool.query(`
      SELECT i.id,
             (sh.user_id = $2) AS owned_by_user
      FROM issues i
      LEFT JOIN scan_history sh ON i.first_seen_scan_id = sh.id
      WHERE i.id = ANY($1::uuid[])
        AND (
          (sh.id IS NOT NULL AND sh.user_id = $2)
          OR (sh.id IS NULL AND EXISTS (
            SELECT 1 FROM scan_history sh2 
            WHERE sh2.id = i.first_seen_scan_id AND sh2.user_id = $2
          ))
          OR EXISTS (SELECT 1 FROM user_issues ui WHERE ui.issue_id = i.id AND ui.user_id = $2)
        )
    `, [itemIds, user.userId])

    if (checkResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'No valid issues found or access denied' },
        { status: 404 }
      )
    }

    const ownedIds = checkResult.rows.filter(r => r.owned_by_user).map(r => r.id)
    const linkedIds = checkResult.rows.filter(r => !r.owned_by_user).map(r => r.id)

    let deletedCount = 0
    if (ownedIds.length > 0) {
      const r = await pool.query(`DELETE FROM issues WHERE id = ANY($1::uuid[])`, [ownedIds])
      deletedCount += r.rowCount ?? 0
    }
    if (linkedIds.length > 0) {
      const r = await pool.query(
        `DELETE FROM user_issues WHERE user_id = $1 AND issue_id = ANY($2::uuid[])`,
        [user.userId, linkedIds]
      )
      deletedCount += r.rowCount ?? 0
    }
    const deleteResult = { rowCount: deletedCount }

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




