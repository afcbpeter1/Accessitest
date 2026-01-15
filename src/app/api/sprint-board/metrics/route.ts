import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/database'

export const dynamic = 'force-dynamic'

// GET /api/sprint-board/metrics - Get metrics for a sprint
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

    // Get sprint issues with their story points
    const issuesResult = await pool.query(`
      SELECT 
        si.story_points,
        si.column_id,
        sc.is_done_column
      FROM sprint_issues si
      JOIN sprint_columns sc ON si.column_id = sc.id
      WHERE si.sprint_id = $1
    `, [sprintId])

    const totalStoryPoints = issuesResult.rows.reduce((sum, issue) => sum + (issue.story_points || 0), 0)
    const completedStoryPoints = issuesResult.rows
      .filter(issue => issue.is_done_column)
      .reduce((sum, issue) => sum + (issue.story_points || 0), 0)
    const remainingStoryPoints = totalStoryPoints - completedStoryPoints

    const issuesCount = issuesResult.rows.length
    const completedIssuesCount = issuesResult.rows.filter(issue => issue.is_done_column).length

    // Calculate velocity (story points per day)
    const sprintResult = await pool.query(`
      SELECT start_date, end_date, status
      FROM sprints 
      WHERE id = $1
    `, [sprintId])

    const sprint = sprintResult.rows[0]
    const startDate = new Date(sprint.start_date)
    const endDate = new Date(sprint.end_date)
    const daysElapsed = Math.max(1, Math.ceil((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24)))
    const velocity = daysElapsed > 0 ? completedStoryPoints / daysElapsed : 0

    const metrics = {
      total_story_points: totalStoryPoints,
      completed_story_points: completedStoryPoints,
      remaining_story_points: remainingStoryPoints,
      issues_count: issuesCount,
      completed_issues_count: completedIssuesCount,
      velocity: velocity
    }

    return NextResponse.json({
      success: true,
      data: {
        metrics
      }
    })

  } catch (error) {
    console.error('❌ Error fetching sprint metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sprint metrics' },
      { status: 500 }
    )
  }
}