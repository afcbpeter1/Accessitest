import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import pool from '@/lib/database'

function mapRowsToItems(rows: any[], hasExtraColumns: boolean): any[] {
  return (rows || []).map((row: any) => {
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
        help_text: hasExtraColumns ? (row.help_text ?? null) : null,
        help_url: hasExtraColumns ? (row.help_url ?? null) : null,
        suggestions: hasExtraColumns ? (row.suggestions ?? null) : null,
        offending_elements: offending,
        affected_pages: row.url ? [row.url] : [],
        total_occurrences: 1,
        screenshots: null
      }
    }
  })
}

// GET /api/product-backlog - List product_backlog rows for current user
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const userId = user.userId

    // Try full SELECT first (includes help_text, help_url, suggestions)
    let result: { rows: any[] }
    let hasExtraColumns = true
    try {
      result = await pool.query(
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
        [userId]
      )
    } catch (queryError: any) {
      const msg = queryError?.message ?? ''
      // If new columns are missing, retry without them so UI still shows items
      if (msg.includes('column') && (msg.includes('does not exist') || msg.includes('help_text') || msg.includes('help_url') || msg.includes('suggestions'))) {
        hasExtraColumns = false
        result = await pool.query(
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
          [userId]
        )
      } else {
        throw queryError
      }
    }

    const items = mapRowsToItems(result.rows, hasExtraColumns)

    const payload: { success: boolean; items: any[]; total: number; diagnostics?: { user_id: string } } = {
      success: true,
      items,
      total: items.length
    }
    if (items.length === 0) {
      payload.diagnostics = { user_id: userId }
    }
    return NextResponse.json(payload)
  } catch (error) {
    if ((error as Error).message?.includes('Authentication')) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }
    console.error('❌ Error fetching product backlog:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch product backlog' }, { status: 500 })
  }
}

