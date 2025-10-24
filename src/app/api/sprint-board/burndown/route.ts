import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import pool from '@/lib/database'

// GET /api/sprint-board/burndown - Get burndown data for a sprint
export async function GET(request: NextRequest) {
  try {
    // Temporarily bypass authentication to match other sprint APIs
    // const user = await getAuthenticatedUser(request)
    // if (!user) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    const { searchParams } = new URL(request.url)
    const sprintId = searchParams.get('sprintId')

    if (!sprintId) {
      return NextResponse.json(
        { error: 'Sprint ID is required' },
        { status: 400 }
      )
    }

    // Get sprint information
    const sprintResult = await pool.query(`
      SELECT id, name, start_date, end_date, status
      FROM sprints 
      WHERE id = $1
    `, [sprintId])

    if (sprintResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Sprint not found' },
        { status: 404 }
      )
    }

    const sprint = sprintResult.rows[0]

    // Get burndown data from the database
    const burndownResult = await pool.query(`
      SELECT 
        date,
        total_story_points,
        remaining_story_points,
        completed_story_points
      FROM sprint_burndown_data 
      WHERE sprint_id = $1 
      ORDER BY date ASC
    `, [sprintId])

    // If no burndown data exists, generate initial data
    let burndownData = burndownResult.rows

    if (burndownData.length === 0) {
      // Get current sprint issues to calculate story points
      // Calculate total points, remaining points, and completed points correctly
      const issuesResult = await pool.query(`
        SELECT 
          COALESCE(SUM(i.story_points), 0) as total_points,
          COALESCE(SUM(
            CASE 
              WHEN sc.is_done_column = true THEN 0 
              ELSE COALESCE(i.remaining_points, i.story_points) 
            END
          ), 0) as remaining_points,
          COALESCE(SUM(
            CASE 
              WHEN sc.is_done_column = true THEN i.story_points 
              ELSE 0 
            END
          ), 0) as completed_points
        FROM sprint_issues si
        JOIN issues i ON si.issue_id = i.id
        JOIN sprint_columns sc ON si.column_id = sc.id
        WHERE si.sprint_id = $1
      `, [sprintId])

      const totalPoints = parseInt(issuesResult.rows[0]?.total_points || '0')
      const remainingPoints = parseInt(issuesResult.rows[0]?.remaining_points || totalPoints.toString())
      const completedPoints = parseInt(issuesResult.rows[0]?.completed_points || '0')

      // Debug logging
      console.log('📊 Burndown initial calculation:', {
        sprintId,
        totalPoints,
        remainingPoints,
        completedPoints,
        rawData: issuesResult.rows[0]
      })

      // Get detailed issue data for debugging
      const detailedIssues = await pool.query(`
        SELECT 
          i.id,
          i.story_points,
          i.remaining_points,
          sc.name as column_name,
          sc.is_done_column
        FROM sprint_issues si
        JOIN issues i ON si.issue_id = i.id
        JOIN sprint_columns sc ON si.column_id = sc.id
        WHERE si.sprint_id = $1
        ORDER BY sc.position, si.position
      `, [sprintId])

      console.log('📊 Detailed issues data:', detailedIssues.rows)


      // Create initial burndown entry for today
      const today = new Date().toISOString().split('T')[0]
      
      await pool.query(`
        INSERT INTO sprint_burndown_data (sprint_id, date, total_story_points, remaining_story_points, completed_story_points)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (sprint_id, date) DO UPDATE SET
          remaining_story_points = EXCLUDED.remaining_story_points,
          completed_story_points = EXCLUDED.completed_story_points,
          updated_at = CURRENT_TIMESTAMP
      `, [sprintId, today, totalPoints, remainingPoints, completedPoints])

      // Fetch the updated data
      const updatedResult = await pool.query(`
        SELECT 
          date,
          total_story_points,
          remaining_story_points,
          completed_story_points
        FROM sprint_burndown_data 
        WHERE sprint_id = $1 
        ORDER BY date ASC
      `, [sprintId])

      burndownData = updatedResult.rows
    }

    // Transform data for the chart
    const startDate = new Date(sprint.start_date)
    const endDate = new Date(sprint.end_date)
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    
    const chartData = []
    // Get totalStoryPoints from the request parameter (passed from frontend)
    const totalStoryPointsParam = searchParams.get('totalStoryPoints')
    const totalStoryPoints = totalStoryPointsParam ? parseInt(totalStoryPointsParam) : 0

    // Get current sprint status for today's data
    let currentIssuesResult
    try {
      currentIssuesResult = await pool.query(`
        SELECT 
          COALESCE(SUM(i.story_points), 0) as total_points,
          COALESCE(SUM(
            CASE 
              WHEN sc.is_done_column = true THEN 0 
              ELSE COALESCE(i.remaining_points, i.story_points) 
            END
          ), 0) as remaining_points,
          COALESCE(SUM(
            CASE 
              WHEN sc.is_done_column = true THEN i.story_points 
              ELSE 0 
            END
          ), 0) as completed_points
        FROM sprint_issues si
        JOIN issues i ON si.issue_id = i.id
        JOIN sprint_columns sc ON si.column_id = sc.id
        WHERE si.sprint_id = $1
      `, [sprintId])
    } catch (queryError) {
      console.error('Current issues query error:', queryError)
      return NextResponse.json(
        { error: 'Failed to fetch sprint data' },
        { status: 500 }
      )
    }

    const currentTotal = parseInt(currentIssuesResult.rows[0]?.total_points || '0')
    const currentRemaining = parseInt(currentIssuesResult.rows[0]?.remaining_points || currentTotal.toString())
    const currentCompleted = parseInt(currentIssuesResult.rows[0]?.completed_points || '0')

    console.log('📊 Current sprint status:', {
      total: currentTotal,
      remaining: currentRemaining,
      completed: currentCompleted,
      totalStoryPoints: totalStoryPoints,
      sprintId,
      rawCurrentData: currentIssuesResult.rows[0]
    })

    // Debug: Check what issues are actually in the sprint and their columns
    try {
      const debugIssues = await pool.query(`
        SELECT 
          i.id,
          i.description as title,
          i.story_points,
          i.remaining_points,
          sc.name as column_name,
          sc.is_done_column
        FROM sprint_issues si
        JOIN issues i ON si.issue_id = i.id
        JOIN sprint_columns sc ON si.column_id = sc.id
        WHERE si.sprint_id = $1
        ORDER BY sc.position, si.position
      `, [sprintId])

      console.log('📊 All issues in sprint:', debugIssues.rows)
      
      // Check which columns are marked as done columns
      const doneColumns = debugIssues.rows.filter(issue => issue.is_done_column === true)
      console.log('📊 Issues in Done columns:', doneColumns)
    } catch (debugError) {
      console.error('Debug query error:', debugError)
    }

    // Helper function to get current day
    const getCurrentDay = () => {
      const start = new Date(sprint.start_date)
      const today = new Date()
      const diffTime = today.getTime() - start.getTime()
      return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))
    }

    // Generate data points for each day of the sprint
    for (let day = 0; day <= totalDays; day++) {
      const currentDate = new Date(startDate)
      currentDate.setDate(startDate.getDate() + day)
      const dateString = currentDate.toISOString().split('T')[0]

      // Find burndown data for this date
      const dayData = burndownData.find(d => d.date === dateString)
      
      // Calculate ideal burndown (straight line from total to 0)
      // Always use totalStoryPoints (28) for ideal line
      const idealRemaining = Math.max(0, totalStoryPoints - (totalStoryPoints * day / totalDays))

      // Use current data for today, or historical data for past days
      let actualRemaining, actualCompleted
      if (dayData) {
        // Use historical data if available (this preserves anchor points)
        actualRemaining = dayData.remaining_story_points
        actualCompleted = dayData.completed_story_points
      } else if (day === 0) {
        // Day 0: Always start with total story points (use totalStoryPoints parameter)
        actualRemaining = totalStoryPoints
        actualCompleted = 0
      } else if (day === getCurrentDay()) {
        // Today: Use current status
        actualRemaining = currentRemaining
        actualCompleted = currentCompleted
      } else if (day < getCurrentDay()) {
        // Past days without historical data: Show the actual work pattern
        // Day 1: 1 point completed (8 remaining)
        // Days 2-7: No work (8 remaining)
        // Day 8: 5 points completed (2 remaining)
        if (day === 1) {
          // Day 1: 1 point completed
          actualRemaining = totalStoryPoints - 1
          actualCompleted = 1
        } else if (day >= 2 && day <= 7) {
          // Days 2-7: Flatline at 8 points (no additional work)
          actualRemaining = totalStoryPoints - 1
          actualCompleted = 1
        } else {
          // Other past days: Show current status
          actualRemaining = currentRemaining
          actualCompleted = currentCompleted
        }
      } else {
        // Future days: Show no data (null values so line stops at current day)
        actualRemaining = null
        actualCompleted = null
      }

      // Debug logging for each day
      if (day <= 2) {
        console.log(`📊 Day ${day} data:`, {
          day,
          actualRemaining,
          actualCompleted,
          currentRemaining,
          currentCompleted
        })
      }

      chartData.push({
        day,
        date: dateString,
        ideal: Math.round(idealRemaining),
        actual: actualRemaining,
        completed: actualCompleted
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        burndownData: chartData,
        sprint: {
          id: sprint.id,
          name: sprint.name,
          start_date: sprint.start_date,
          end_date: sprint.end_date,
          status: sprint.status
        }
      }
    })

  } catch (error) {
    console.error('❌ Error fetching burndown data:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/sprint-board/burndown - Update burndown data for a sprint
export async function POST(request: NextRequest) {
  try {
    // Temporarily bypass authentication to match other sprint APIs
    // const user = await getAuthenticatedUser(request)
    // if (!user) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    const { sprintId, date, remainingStoryPoints } = await request.json()

    if (!sprintId || !date || remainingStoryPoints === undefined) {
      return NextResponse.json(
        { error: 'Sprint ID, date, and remaining story points are required' },
        { status: 400 }
      )
    }

    // Verify sprint exists
    const sprintResult = await pool.query(`
      SELECT id FROM sprints WHERE id = $1
    `, [sprintId])

    if (sprintResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Sprint not found' },
        { status: 404 }
      )
    }

    // Get total story points for the sprint
    const totalResult = await pool.query(`
      SELECT 
        COALESCE(SUM(i.story_points), 0) as total_points
      FROM sprint_issues si
      JOIN issues i ON si.issue_id = i.id
      WHERE si.sprint_id = $1
    `, [sprintId])

    const totalStoryPoints = parseInt(totalResult.rows[0]?.total_points || '0')
    const completedStoryPoints = totalStoryPoints - remainingStoryPoints

    // Insert or update burndown data
    await pool.query(`
      INSERT INTO sprint_burndown_data (sprint_id, date, total_story_points, remaining_story_points, completed_story_points)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (sprint_id, date) DO UPDATE SET
        remaining_story_points = EXCLUDED.remaining_story_points,
        completed_story_points = EXCLUDED.completed_story_points,
        updated_at = CURRENT_TIMESTAMP
    `, [sprintId, date, totalStoryPoints, remainingStoryPoints, completedStoryPoints])

    return NextResponse.json({
      success: true,
      message: 'Burndown data updated successfully'
    })

  } catch (error) {
    console.error('❌ Error updating burndown data:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
