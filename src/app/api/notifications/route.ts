import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { queryOne, query } from '@/lib/database'

// Get user notifications
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const unreadOnly = searchParams.get('unreadOnly') === 'true'
    
    let queryText = `
      SELECT * FROM notifications 
      WHERE user_id = $1
    `
    const params: any[] = [user.userId]
    
    if (unreadOnly) {
      queryText += ' AND is_read = false'
    }
    
    queryText += ' ORDER BY created_at DESC LIMIT $2'
    params.push(limit)
    
    const notifications = await query(queryText, params)
    
    // Get unread count
    const unreadCount = await queryOne(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false',
      [user.userId]
    )
    
    return NextResponse.json({
      success: true,
      notifications: notifications.rows,
      unreadCount: parseInt(unreadCount.count)
    })
  } catch (error) {
    console.error('❌ Error fetching notifications:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch notifications' },
      { status: 500 }
    )
  }
}

// Mark notifications as read
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const body = await request.json()
    const { notificationIds, markAllAsRead } = body
    
    if (markAllAsRead) {
      // Mark all notifications as read
      await query(
        'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
        [user.userId]
      )
    } else if (notificationIds && Array.isArray(notificationIds)) {
      // Mark specific notifications as read
      const placeholders = notificationIds.map((_, index) => `$${index + 2}`).join(',')
      await query(
        `UPDATE notifications 
         SET is_read = true 
         WHERE user_id = $1 AND id IN (${placeholders})`,
        [user.userId, ...notificationIds]
      )
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid request parameters' },
        { status: 400 }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: 'Notifications marked as read'
    })
  } catch (error) {
    console.error('❌ Error updating notifications:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update notifications' },
      { status: 500 }
    )
  }
}

// Create a new notification (admin/internal use)
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const body = await request.json()
    const { title, message, type = 'info', targetUserId } = body
    
    if (!title || !message) {
      return NextResponse.json(
        { success: false, error: 'Title and message are required' },
        { status: 400 }
      )
    }
    
    const userId = targetUserId || user.userId
    
    await query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES ($1, $2, $3, $4)`,
      [userId, title, message, type]
    )
    
    return NextResponse.json({
      success: true,
      message: 'Notification created successfully'
    })
  } catch (error) {
    console.error('❌ Error creating notification:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create notification' },
      { status: 500 }
    )
  }
}