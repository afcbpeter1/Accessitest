import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { queryOne, query } from '@/lib/database'

async function handleGetNotifications(request: NextRequest, user: any) {
  try {
    // Get user notification preferences
    const preferences = await queryOne(
      'SELECT * FROM user_notification_preferences WHERE user_id = $1',
      [user.userId]
    )

    // Return default preferences if none exist
    const defaultPreferences = {
      scanCompletion: true,
      criticalIssues: true,
      weeklyReports: false,
      securityAlerts: true
    }

    return NextResponse.json({
      success: true,
      preferences: preferences || defaultPreferences
    })
  } catch (error) {
    console.error('Error fetching notification preferences:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch notification preferences' },
      { status: 500 }
    )
  }
}

async function handleUpdateNotifications(request: NextRequest, user: any) {
  try {
    const body = await request.json()
    const { scanCompletion, criticalIssues, weeklyReports, securityAlerts } = body

    // Upsert notification preferences
    await query(
      `INSERT INTO user_notification_preferences 
       (user_id, scan_completion, critical_issues, weekly_reports, security_alerts, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id) 
       DO UPDATE SET 
         scan_completion = $2,
         critical_issues = $3,
         weekly_reports = $4,
         security_alerts = $5,
         updated_at = NOW()`,
      [user.userId, scanCompletion, criticalIssues, weeklyReports, securityAlerts]
    )

    return NextResponse.json({
      success: true,
      message: 'Notification preferences updated successfully'
    })
  } catch (error) {
    console.error('Error updating notification preferences:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update notification preferences' },
      { status: 500 }
    )
  }
}

export const GET = requireAuth(handleGetNotifications)
export const PUT = requireAuth(handleUpdateNotifications)

