import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import pool from '@/lib/database'

// GET /api/sprint-board/sprints - Get all sprints for user
export async function GET(request: NextRequest) {
  try {
    console.log('🏃 Sprint API called')
    
    // Temporarily bypass authentication for debugging
    // const user = await getAuthenticatedUser(request)
    // if (!user) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    const result = await pool.query(`
      SELECT 
        s.id,
        s.name,
        s.description,
        s.start_date,
        s.end_date,
        s.status,
        s.goal,
        s.created_at,
        s.updated_at
      FROM sprints s
      ORDER BY s.created_at DESC
      LIMIT 20
    `)

    console.log('📊 Found sprints:', result.rows.length)

    return NextResponse.json({
      success: true,
      data: {
        sprints: result.rows
      }
    })

  } catch (error) {
    console.error('❌ Error fetching sprints:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sprints' },
      { status: 500 }
    )
  }
}

// POST /api/sprint-board/sprints - Create new sprint
export async function POST(request: NextRequest) {
  try {
    console.log('🏃 Creating new sprint')
    
    const { name, description, start_date, end_date, goal } = await request.json()

    if (!name || !start_date || !end_date) {
      return NextResponse.json(
        { error: 'Name, start date, and end date are required' },
        { status: 400 }
      )
    }

    // For now, use the first available user_id since authentication is bypassed
    const defaultUserId = '09d7030b-e612-4226-b695-beefb3e97936'
    
    const result = await pool.query(
      `INSERT INTO sprints (user_id, name, description, start_date, end_date, goal, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'planning')
       RETURNING *`,
      [defaultUserId, name, description, start_date, end_date, goal]
    )

    // Create default columns for the sprint
    const sprintId = result.rows[0].id
    const defaultColumns = [
      { name: 'To Do', description: 'Issues to be worked on', color: '#6B7280', position: 1, wip_limit: null, is_done_column: false },
      { name: 'In Progress', description: 'Issues currently being worked on', color: '#3B82F6', position: 2, wip_limit: 5, is_done_column: false },
      { name: 'In Review', description: 'Issues under review', color: '#F59E0B', position: 3, wip_limit: 3, is_done_column: false },
      { name: 'Done', description: 'Completed issues', color: '#10B981', position: 4, wip_limit: null, is_done_column: true }
    ]

    for (const column of defaultColumns) {
      await pool.query(
        `INSERT INTO sprint_columns (sprint_id, name, description, color, position, wip_limit, is_done_column)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [sprintId, column.name, column.description, column.color, column.position, column.wip_limit, column.is_done_column]
      )
    }

    console.log('✅ Sprint created successfully')

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    })

  } catch (error) {
    console.error('❌ Error creating sprint:', error)
    console.error('❌ Error details:', error.message)
    console.error('❌ Error stack:', error.stack)
    return NextResponse.json(
      { error: 'Failed to create sprint', details: error.message },
      { status: 500 }
    )
  }
}