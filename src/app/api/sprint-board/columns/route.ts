import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/database'

// GET /api/sprint-board/columns - Get columns for a sprint
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
        sc.id,
        sc.name,
        sc.description,
        sc.position,
        sc.color,
        sc.wip_limit,
        sc.is_done_column
      FROM sprint_columns sc
      WHERE sc.sprint_id = $1
      ORDER BY sc.position ASC
    `, [sprintId])

    return NextResponse.json({
      success: true,
      data: {
        columns: result.rows
      }
    })

  } catch (error) {
    console.error('❌ Error fetching sprint columns:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sprint columns' },
      { status: 500 }
    )
  }
}

// POST /api/sprint-board/columns - Create new column
export async function POST(request: NextRequest) {
  try {
    const { sprintId, name, description, color, wip_limit } = await request.json()

    if (!sprintId || !name) {
      return NextResponse.json(
        { error: 'Sprint ID and name are required' },
        { status: 400 }
      )
    }

    // Get the next position
    const positionResult = await pool.query(`
      SELECT COALESCE(MAX(position), 0) + 1 as next_position
      FROM sprint_columns 
      WHERE sprint_id = $1
    `, [sprintId])

    const nextPosition = positionResult.rows[0].next_position

    const result = await pool.query(`
      INSERT INTO sprint_columns (sprint_id, name, description, color, position, wip_limit, is_done_column)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [sprintId, name, description || '', color || '#3B82F6', nextPosition, wip_limit || null, false])

    console.log('✅ Column created successfully')

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    })

  } catch (error) {
    console.error('❌ Error creating sprint column:', error)
    return NextResponse.json(
      { error: 'Failed to create sprint column' },
      { status: 500 }
    )
  }
}