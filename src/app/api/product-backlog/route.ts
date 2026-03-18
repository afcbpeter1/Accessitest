import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import pool from '@/lib/database'

// GET /api/product-backlog - List product_backlog rows for current user
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)

    const result = await pool.query(
      `SELECT
        id,
        user_id,
        issue_id,
        rule_name,
        description,
        impact,
        wcag_level,
        element_selector,
        element_html,
        failure_summary,
        url,
        domain,
        priority_rank,
        status,
        last_scan_at,
        created_at,
        updated_at
      FROM product_backlog
      WHERE user_id = $1
      ORDER BY
        CASE WHEN priority_rank IS NOT NULL THEN priority_rank ELSE 999999 END ASC,
        created_at ASC,
        id ASC`,
      [user.userId]
    )

    return NextResponse.json({
      success: true,
      items: result.rows,
      total: result.rows.length
    })
  } catch (error) {
    if ((error as Error).message?.includes('Authentication')) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }
    console.error('❌ Error fetching product backlog:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch product backlog' }, { status: 500 })
  }
}

