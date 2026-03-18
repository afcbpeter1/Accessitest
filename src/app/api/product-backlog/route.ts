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
        help_text,
        help_url,
        suggestions,
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

    const items = (result.rows || []).map((row: any) => {
      const offending = [{
        target: row.element_selector ? [row.element_selector] : [],
        html: row.element_html || null,
        failureSummary: row.failure_summary || null,
        impact: row.impact,
        url: row.url
      }]
      return {
        ...row,
        scan_data: {
          help_text: row.help_text ?? null,
          help_url: row.help_url ?? null,
          suggestions: row.suggestions ?? null,
          offending_elements: offending,
          affected_pages: row.url ? [row.url] : [],
          total_occurrences: 1,
          screenshots: null
        }
      }
    })

    return NextResponse.json({
      success: true,
      items,
      total: items.length
    })
  } catch (error) {
    if ((error as Error).message?.includes('Authentication')) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }
    console.error('❌ Error fetching product backlog:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch product backlog' }, { status: 500 })
  }
}

