import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { queryOne } from '@/lib/database'
import pool from '@/lib/database'
import { getStripe } from '@/lib/stripe-config'
import { sendAccountDeletedEmail } from '@/lib/subscription-email-service'

// Delete user account and all associated data
export async function DELETE(request: NextRequest) {
  const client = await pool.connect()
  
  try {
    const user = await getAuthenticatedUser(request)
    
    // Get user data to check for subscription and for goodbye email
    const userData = await queryOne(
      `SELECT email, first_name, last_name, stripe_subscription_id FROM users WHERE id = $1`,
      [user.userId]
    )

    if (!userData) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Start database transaction using the same client
    await client.query('BEGIN')

    try {
      // 1. Cancel Stripe subscription if exists (mark as account_deletion so webhook skips "access until end" email)
      if (userData.stripe_subscription_id) {
        try {
          const stripe = getStripe()
          await stripe.subscriptions.update(userData.stripe_subscription_id, {
            metadata: { cancel_reason: 'account_deletion' }
          })
          await stripe.subscriptions.cancel(userData.stripe_subscription_id)
        } catch (stripeError: any) {
          // Log but don't fail - subscription might already be cancelled
          console.warn(`⚠️ Could not cancel Stripe subscription: ${stripeError.message}`)
        }
      }

      // 2. Find ALL tables that reference this user and delete from them
      // Query the database to find all tables with user_id column
      const tablesWithUserId = await client.query(`
        SELECT table_name 
        FROM information_schema.columns 
        WHERE column_name = 'user_id' 
        AND table_schema = 'public'
        ORDER BY table_name
      `)

      tablesWithUserId.rows.forEach(row => {

      })

      // Delete from all tables that have user_id (except users table - we'll delete that last)
      for (const tableRow of tablesWithUserId.rows) {
        const tableName = tableRow.table_name
        
        // Skip users table - we'll delete that at the end
        if (tableName === 'users') {
          continue
        }
        
        try {
          // Special handling for organization_members - also delete where user is the inviter
          if (tableName === 'organization_members') {
            await client.query(
              `DELETE FROM organization_members WHERE user_id = $1 OR invited_by = $1`,
              [user.userId]
            )
          } else {
            const result = await client.query(
              `DELETE FROM ${tableName} WHERE user_id = $1`,
              [user.userId]
            )

          }
        } catch (error: any) {
          // Check if transaction is already aborted
          if (error.code === '25P02') {
            console.error(`❌ Transaction aborted. Previous operation failed.`)
            throw new Error(`Failed to delete from ${tableName}. Transaction aborted.`)
          }
          // Re-throw any other error
          console.error(`❌ Error deleting from ${tableName}:`, error.message)
          throw error
        }
      }

      // Also check for tables that might reference users by id (not user_id)
      // Check for foreign key constraints that reference users.id
      const tablesReferencingUsers = await client.query(`
        SELECT 
          tc.table_name,
          kcu.column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_name = 'users'
          AND ccu.column_name = 'id'
          AND tc.table_schema = 'public'
      `)

      tablesReferencingUsers.rows.forEach(row => {

      })

      // Delete from tables that reference users.id via foreign key
      for (const fkRow of tablesReferencingUsers.rows) {
        const tableName = fkRow.table_name
        const columnName = fkRow.column_name
        
        // Skip if we already deleted from this table
        if (tablesWithUserId.rows.some(row => row.table_name === tableName)) {
          continue
        }
        
        try {
          const result = await client.query(
            `DELETE FROM ${tableName} WHERE ${columnName} = $1`,
            [user.userId]
          )

        } catch (error: any) {
          if (error.code === '25P02') {
            console.error(`❌ Transaction aborted. Previous operation failed.`)
            throw new Error(`Failed to delete from ${tableName}. Transaction aborted.`)
          }
          console.error(`❌ Error deleting from ${tableName}:`, error.message)
          throw error
        }
      }

      // Clear self-referential and optional FKs so the user row can be deleted
      await client.query(
        `UPDATE users SET default_organization_id = NULL, updated_at = NOW() WHERE id = $1`,
        [user.userId]
      )

      // Send "Sorry to see you go" email before deleting user (so we still have email)
      try {
        const customerName = [userData.first_name, userData.last_name].filter(Boolean).join(' ') || undefined
        await sendAccountDeletedEmail({
          customerEmail: userData.email,
          customerName: customerName || undefined
        })
      } catch (emailError) {
        console.warn('⚠️ Could not send account-deleted email:', emailError)
        // Don't fail the delete if email fails
      }

      // Finally, delete the user record itself
      const deleteUserResult = await client.query('DELETE FROM users WHERE id = $1', [user.userId])

      if (deleteUserResult.rowCount === 0) {
        throw new Error('User was not deleted - user ID may not exist')
      }

      // Commit transaction
      await client.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: 'Account deleted successfully'
      })

    } catch (error: any) {
      // Rollback transaction on error
      await client.query('ROLLBACK')
      console.error('❌ Transaction rolled back due to error:', error)
      throw error
    } finally {
      // Always release the client
      client.release()
    }

  } catch (error: any) {
    console.error('❌ Error deleting account:', error)
    console.error('❌ Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    })
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete account' },
      { status: 500 }
    )
  }
}

