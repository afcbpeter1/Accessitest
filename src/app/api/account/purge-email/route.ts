/**
 * Support-only: remove a user by email so that address can be used for signup again.
 * Use when "Delete account" left the row in the DB (e.g. transaction rolled back).
 *
 * POST /api/account/purge-email
 * Body: { email: string, purgeSecret: string }
 * Requires PURGE_USER_SECRET in env; body.purgeSecret must match.
 */
import { NextRequest, NextResponse } from 'next/server'
import { queryOne } from '@/lib/database'
import pool from '@/lib/database'

export async function POST(request: NextRequest) {
  const secret = process.env.PURGE_USER_SECRET?.trim()
  if (!secret) {
    return NextResponse.json(
      { success: false, error: 'Purge by email is not configured' },
      { status: 501 }
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const { email, purgeSecret } = body

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'Valid email is required' },
        { status: 400 }
      )
    }
    if (purgeSecret !== secret) {
      return NextResponse.json(
        { success: false, error: 'Invalid purge secret' },
        { status: 403 }
      )
    }

    const user = await queryOne(
      `SELECT id, email FROM users WHERE LOWER(email) = LOWER($1)`,
      [email.trim()]
    )
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'No user found with that email' },
        { status: 404 }
      )
    }

    const client = await pool.connect()
    const userId = user.id

    try {
      await client.query('BEGIN')

      const tablesWithUserId = await client.query(`
        SELECT table_name FROM information_schema.columns
        WHERE column_name = 'user_id' AND table_schema = 'public'
        ORDER BY table_name
      `)

      for (const row of tablesWithUserId.rows) {
        const tableName = row.table_name
        if (tableName === 'users') continue
        if (tableName === 'organization_members') {
          await client.query(
            `DELETE FROM organization_members WHERE user_id = $1 OR invited_by = $1`,
            [userId]
          )
        } else {
          await client.query(`DELETE FROM ${tableName} WHERE user_id = $1`, [userId])
        }
      }

      const fkTables = await client.query(`
        SELECT tc.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'users' AND ccu.column_name = 'id' AND tc.table_schema = 'public'
      `)

      for (const row of fkTables.rows) {
        if (tablesWithUserId.rows.some((r: { table_name: string }) => r.table_name === row.table_name)) continue
        await client.query(
          `DELETE FROM ${row.table_name} WHERE ${row.column_name} = $1`,
          [userId]
        )
      }

      await client.query(
        `UPDATE users SET default_organization_id = NULL, updated_at = NOW() WHERE id = $1`,
        [userId]
      )

      const r = await client.query('DELETE FROM users WHERE id = $1', [userId])
      if (r.rowCount === 0) throw new Error('User row could not be deleted')

      await client.query('COMMIT')
      return NextResponse.json({
        success: true,
        message: 'User removed; this email can be used for signup again.',
      })
    } catch (err: any) {
      await client.query('ROLLBACK').catch(() => {})
      throw err
    } finally {
      client.release()
    }
  } catch (error: any) {
    console.error('Purge email error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to purge user' },
      { status: 500 }
    )
  }
}
