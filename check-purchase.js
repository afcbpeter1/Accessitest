const { Pool } = require('pg')
require('dotenv').config({ path: '.env.local' })

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false
})

async function checkPurchase() {
  try {
    const email = 'peter.kirby85@gmail.com'
    
    console.log(`\n🔍 Checking for purchase records for: ${email}\n`)
    
    // First, find the user
    const userResult = await pool.query(
      'SELECT id, email, first_name, last_name FROM users WHERE email = $1',
      [email]
    )
    
    if (userResult.rows.length === 0) {
      console.log(`❌ No user found with email: ${email}`)
      return
    }
    
    const user = userResult.rows[0]
    console.log(`✅ Found user: ${user.first_name} ${user.last_name} (${user.email})`)
    console.log(`   User ID: ${user.id}\n`)
    
    // Check credit transactions for purchases
    const purchaseResult = await pool.query(
      `SELECT ct.*, u.email 
       FROM credit_transactions ct
       JOIN users u ON ct.user_id = u.id
       WHERE ct.user_id = $1 AND ct.transaction_type = 'purchase'
       ORDER BY ct.created_at DESC
       LIMIT 10`,
      [user.id]
    )
    
    console.log(`📦 Found ${purchaseResult.rows.length} purchase transaction(s):\n`)
    
    if (purchaseResult.rows.length === 0) {
      console.log('❌ No purchase transactions found')
    } else {
      purchaseResult.rows.forEach((tx, index) => {
        console.log(`Transaction ${index + 1}:`)
        console.log(`  ID: ${tx.id}`)
        console.log(`  Credits: ${tx.credits_amount}`)
        console.log(`  Description: ${tx.description}`)
        console.log(`  Created: ${tx.created_at}`)
        console.log('')
      })
    }
    
    // Check current credit balance
    const creditsResult = await pool.query(
      'SELECT credits_remaining, credits_used FROM user_credits WHERE user_id = $1',
      [user.id]
    )
    
    if (creditsResult.rows.length > 0) {
      const credits = creditsResult.rows[0]
      console.log(`💰 Current Credit Balance:`)
      console.log(`  Remaining: ${credits.credits_remaining}`)
      console.log(`  Used: ${credits.credits_used}`)
    }
    
    // Check webhook events (if stored)
    console.log('\n📧 Checking if receipt emails were sent...')
    console.log('   (Check terminal logs for "📧 Starting receipt email process" or "📧 Resend API response")')
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await pool.end()
  }
}

checkPurchase()











