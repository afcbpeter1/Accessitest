import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/database'

// GET /api/sprint-board/issues - Get issues for a sprint
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sprintId = searchParams.get('sprintId')

    if (!sprintId) {
      return NextResponse.json(
        { error: 'Sprint ID is required' },
        { status: 400 }
      )
    }

    const result = await pool.query(`
      SELECT 
        si.id,
        si.issue_id,
        si.column_id,
        si.position,
        si.story_points,
        si.assignee_id,
        si.added_at,
        si.moved_at,
        i.rule_name,
        i.description,
        i.impact,
        i.status,
        i.priority,
        i.total_occurrences,
        i.last_seen
      FROM sprint_issues si
      JOIN issues i ON si.issue_id = i.id
      WHERE si.sprint_id = $1
      ORDER BY si.column_id, si.position ASC
    `, [sprintId])

    return NextResponse.json({
      success: true,
      data: {
        issues: result.rows
      }
    })

  } catch (error) {
    console.error('❌ Error fetching sprint issues:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sprint issues' },
      { status: 500 }
    )
  }
}