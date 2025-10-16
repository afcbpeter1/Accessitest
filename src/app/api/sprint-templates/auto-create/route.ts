import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import pool from '@/lib/database'

// POST /api/sprint-templates/auto-create - Check and create recurring sprints
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Call the database function to check and create recurring sprints
    const result = await pool.query('SELECT check_and_create_recurring_sprints()')

    return NextResponse.json({
      success: true,
      message: 'Recurring sprint check completed'
    })

  } catch (error) {
    console.error('❌ Error checking recurring sprints:', error)
    return NextResponse.json(
      { error: 'Failed to check recurring sprints' },
      { status: 500 }
    )
  }
}

// GET /api/sprint-templates/auto-create - Get status of auto-creation
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get templates with auto-creation enabled
    const result = await pool.query(`
      SELECT 
        st.id,
        st.name,
        st.recurrence_type,
        st.auto_create,
        st.advance_creation_days,
        COUNT(s.id) as created_sprints,
        MAX(s.end_date) as last_sprint_end
      FROM sprint_templates st
      LEFT JOIN sprints s ON st.id = s.template_id
      WHERE st.user_id = $1 AND st.auto_create = TRUE AND st.is_active = TRUE
      GROUP BY st.id, st.name, st.recurrence_type, st.auto_create, st.advance_creation_days
    `, [user.userId])

    return NextResponse.json({
      success: true,
      data: {
        autoCreateTemplates: result.rows
      }
    })

  } catch (error) {
    console.error('❌ Error fetching auto-creation status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch auto-creation status' },
      { status: 500 }
    )
  }
}
