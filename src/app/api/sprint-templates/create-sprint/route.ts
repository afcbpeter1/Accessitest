import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import pool from '@/lib/database'

// POST /api/sprint-templates/create-sprint - Create sprint from template
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { templateId, startDate, customName, customGoal } = await request.json()

    if (!templateId || !startDate) {
      return NextResponse.json(
        { error: 'Template ID and start date are required' },
        { status: 400 }
      )
    }

    // Verify template belongs to user
    const templateCheck = await pool.query(
      'SELECT * FROM sprint_templates WHERE id = $1 AND user_id = $2',
      [templateId, user.userId]
    )

    if (templateCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Template not found or access denied' },
        { status: 404 }
      )
    }

    const template = templateCheck.rows[0]
    const startDateObj = new Date(startDate)
    const endDateObj = new Date(startDateObj.getTime() + (template.duration_days - 1) * 24 * 60 * 60 * 1000)

    // Create the sprint
    const sprintResult = await pool.query(
      `INSERT INTO sprints (
        user_id, name, description, start_date, end_date, goal, template_id, is_auto_created
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        user.userId,
        customName || `${template.name} - ${startDateObj.toISOString().split('T')[0]}`,
        template.description,
        startDateObj.toISOString().split('T')[0],
        endDateObj.toISOString().split('T')[0],
        customGoal || template.default_goal,
        templateId,
        false // Manual creation
      ]
    )

    const sprint = sprintResult.rows[0]

    // Create columns from template
    const columnsResult = await pool.query(
      'SELECT * FROM template_columns WHERE template_id = $1 ORDER BY position',
      [templateId]
    )

    for (const column of columnsResult.rows) {
      await pool.query(
        `INSERT INTO sprint_columns (sprint_id, name, description, position, color, wip_limit, is_done_column)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [sprint.id, column.name, column.description, column.position, column.color, column.wip_limit, column.is_done_column]
      )
    }

    return NextResponse.json({
      success: true,
      data: sprint
    })

  } catch (error) {
    console.error('❌ Error creating sprint from template:', error)
    return NextResponse.json(
      { error: 'Failed to create sprint from template' },
      { status: 500 }
    )
  }
}
