import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/database'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { IssuesBoardDataService } from '@/lib/issues-board-data-service'

// GET /api/issues-board - Get all issues with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const user = await getAuthenticatedUser(request)
    
    console.log('Issues Board API called by user:', user.userId)
    
    // Get query parameters for pagination
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit
    
    // Get issues filtered by user_id to prevent IDOR
    // Only show issues that belong to the authenticated user
    const result = await pool.query(`
      SELECT 
        i.id,
        i.rule_name,
        i.description,
        i.impact,
        i.status,
        i.priority,
        i.total_occurrences,
        i.updated_at as last_seen,
        i.created_at,
        i.rank
      FROM issues i
      WHERE i.user_id = $1
      ORDER BY 
        CASE WHEN i.rank IS NOT NULL THEN i.rank ELSE 999999 END ASC,
        i.created_at DESC
      LIMIT $2 OFFSET $3
    `, [user.userId, limit, offset])
    
    // Get total count for pagination
    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM issues WHERE user_id = $1',
      [user.userId]
    )
    
    const total = parseInt(countResult.rows[0].total)
    const totalPages = Math.ceil(total / limit)
    
    console.log('Found issues:', result.rows.length, 'for user:', user.userId)
    
    return NextResponse.json({
      success: true,
      data: {
        issues: result.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages
        },
        stats: {}
      }
    })

  } catch (error) {
    console.error('Error fetching issues board:', error)
    // Don't expose internal error details
    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to fetch issues board' },
      { status: 500 }
    )
  }
}

// POST /api/issues-board - Create a new issue
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { rule_name, description, impact, wcag_level, help_url, page_url, element_html, element_selector, failure_summary, screenshot_url } = body

    const result = await pool.query(
      `INSERT INTO issues (
        user_id, rule_name, description, impact, wcag_level, help_url,
        page_url, element_html, element_selector, failure_summary, screenshot_url,
        deduplication_hash
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        user.userId,
        rule_name,
        description,
        impact,
        wcag_level,
        help_url,
        page_url,
        element_html,
        element_selector,
        failure_summary,
        screenshot_url,
        `hash-${Date.now()}-${Math.random()}`
      ]
    )

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    })

  } catch (error) {
    console.error('Error creating issue:', error)
    return NextResponse.json(
      { error: 'Failed to create issue' },
      { status: 500 }
    )
  }
}

// PUT /api/issues-board - Update an issue
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { issueId, updates } = body

    const setClause = Object.keys(updates)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ')

    const values = [issueId, ...Object.values(updates)]

    const result = await pool.query(
      `UPDATE issues SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 AND user_id = $2 RETURNING *`,
      [issueId, user.userId, ...values.slice(1)]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    })

  } catch (error) {
    console.error('Error updating issue:', error)
    return NextResponse.json(
      { error: 'Failed to update issue' },
      { status: 500 }
    )
  }
}

// DELETE /api/issues-board - Delete an issue
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const issueId = searchParams.get('id')

    if (!issueId) {
      return NextResponse.json({ error: 'Issue ID required' }, { status: 400 })
    }

    const result = await pool.query(
      'DELETE FROM issues WHERE id = $1 AND user_id = $2 RETURNING *',
      [issueId, user.userId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: 'Issue deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting issue:', error)
    return NextResponse.json(
      { error: 'Failed to delete issue' },
      { status: 500 }
    )
  }
}