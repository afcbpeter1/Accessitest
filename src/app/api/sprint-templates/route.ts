import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import pool from '@/lib/database'

// GET /api/sprint-templates - Get all sprint templates for user
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await pool.query(`
      SELECT 
        st.id,
        st.name,
        st.description,
        st.duration_days,
        st.recurrence_type,
        st.auto_create,
        st.advance_creation_days,
        st.default_goal,
        st.is_active,
        st.created_at,
        st.updated_at,
        COUNT(s.id) as sprint_count
      FROM sprint_templates st
      LEFT JOIN sprints s ON st.id = s.template_id
      WHERE st.user_id = $1
      GROUP BY st.id, st.name, st.description, st.duration_days, st.recurrence_type, 
               st.auto_create, st.advance_creation_days, st.default_goal, st.is_active, 
               st.created_at, st.updated_at
      ORDER BY st.created_at DESC
    `, [user.userId])

    return NextResponse.json({
      success: true,
      data: {
        templates: result.rows
      }
    })

  } catch (error) {
    console.error('❌ Error fetching sprint templates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sprint templates' },
      { status: 500 }
    )
  }
}

// POST /api/sprint-templates - Create new sprint template
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { 
      name, 
      description, 
      duration_days, 
      recurrence_type, 
      auto_create, 
      advance_creation_days, 
      default_goal,
      columns 
    } = await request.json()

    if (!name || !duration_days) {
      return NextResponse.json(
        { error: 'Name and duration are required' },
        { status: 400 }
      )
    }

    // Create the template
    const templateResult = await pool.query(
      `INSERT INTO sprint_templates (
        user_id, name, description, duration_days, recurrence_type, 
        auto_create, advance_creation_days, default_goal
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        user.userId, 
        name, 
        description, 
        duration_days, 
        recurrence_type || 'none',
        auto_create || false,
        advance_creation_days || 7,
        default_goal
      ]
    )

    const template = templateResult.rows[0]

    // Create default columns if none provided
    const defaultColumns = columns || [
      { name: 'To Do', description: 'Issues to be worked on', position: 1, color: '#6B7280', wip_limit: null, is_done_column: false },
      { name: 'Blocked', description: 'Issues that are blocked', position: 2, color: '#EF4444', wip_limit: null, is_done_column: false },
      { name: 'In Progress', description: 'Issues currently being worked on', position: 3, color: '#3B82F6', wip_limit: 5, is_done_column: false },
      { name: 'In Review', description: 'Issues under review', position: 4, color: '#F59E0B', wip_limit: 3, is_done_column: false },
      { name: 'Done', description: 'Completed issues', position: 5, color: '#10B981', wip_limit: null, is_done_column: true }
    ]

    // Create template columns
    for (const column of defaultColumns) {
      await pool.query(
        `INSERT INTO template_columns (template_id, name, description, position, color, wip_limit, is_done_column)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [template.id, column.name, column.description, column.position, column.color, column.wip_limit, column.is_done_column]
      )
    }

    return NextResponse.json({
      success: true,
      data: template
    })

  } catch (error) {
    console.error('❌ Error creating sprint template:', error)
    return NextResponse.json(
      { error: 'Failed to create sprint template' },
      { status: 500 }
    )
  }
}

// PUT /api/sprint-templates - Update sprint template
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { 
      templateId, 
      name, 
      description, 
      duration_days, 
      recurrence_type, 
      auto_create, 
      advance_creation_days, 
      default_goal,
      is_active 
    } = await request.json()

    if (!templateId) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      )
    }

    // Verify template belongs to user
    const templateCheck = await pool.query(
      'SELECT id FROM sprint_templates WHERE id = $1 AND user_id = $2',
      [templateId, user.userId]
    )

    if (templateCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Template not found or access denied' },
        { status: 404 }
      )
    }

    // Update the template
    const result = await pool.query(`
      UPDATE sprint_templates 
      SET 
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        duration_days = COALESCE($3, duration_days),
        recurrence_type = COALESCE($4, recurrence_type),
        auto_create = COALESCE($5, auto_create),
        advance_creation_days = COALESCE($6, advance_creation_days),
        default_goal = COALESCE($7, default_goal),
        is_active = COALESCE($8, is_active),
        updated_at = NOW()
      WHERE id = $9 AND user_id = $10
      RETURNING *
    `, [name, description, duration_days, recurrence_type, auto_create, advance_creation_days, default_goal, is_active, templateId, user.userId])

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    })

  } catch (error) {
    console.error('❌ Error updating sprint template:', error)
    return NextResponse.json(
      { error: 'Failed to update sprint template' },
      { status: 500 }
    )
  }
}

// DELETE /api/sprint-templates - Delete sprint template
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const templateId = searchParams.get('templateId')

    if (!templateId) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      )
    }

    // Verify template belongs to user
    const templateCheck = await pool.query(
      'SELECT id FROM sprint_templates WHERE id = $1 AND user_id = $2',
      [templateId, user.userId]
    )

    if (templateCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Template not found or access denied' },
        { status: 404 }
      )
    }

    // Delete the template (cascade will handle columns)
    await pool.query(
      'DELETE FROM sprint_templates WHERE id = $1 AND user_id = $2',
      [templateId, user.userId]
    )

    return NextResponse.json({
      success: true,
      message: 'Template deleted successfully'
    })

  } catch (error) {
    console.error('❌ Error deleting sprint template:', error)
    return NextResponse.json(
      { error: 'Failed to delete sprint template' },
      { status: 500 }
    )
  }
}
