/**
 * Script to manually add missing credits for a Stripe checkout session
 * Usage: node scripts/fix-missing-credits.js <stripe_session_id> <user_id>
 * 
 * This script:
 * 1. Retrieves the checkout session from Stripe
 * 2. Calculates the total credits that should have been added (including quantity)
 * 3. Checks what credits were actually added
 * 4. Adds the missing credits
 */

const Stripe = require('stripe')
const { Pool } = require('pg')

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-08-27.basil',
})

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

async function fixMissingCredits(sessionId, userId) {
  try {
    console.log(`🔍 Checking Stripe session: ${sessionId}`)
    console.log(`👤 User ID: ${userId}`)
    
    // Get checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items']
    })
    
    console.log(`\n📋 Session Details:`)
    console.log(`   Payment Status: ${session.payment_status}`)
    console.log(`   Customer Email: ${session.customer_email}`)
    console.log(`   Amount Total: $${(session.amount_total / 100).toFixed(2)}`)
    
    // Get line items with quantity
    const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, {
      limit: 100
    })
    
    console.log(`\n📦 Line Items (${lineItems.data.length}):`)
    let totalCreditsShouldBe = 0
    
    for (const item of lineItems.data) {
      const quantity = item.quantity || 1
      const priceId = item.price.id
      const unitAmount = item.price.unit_amount / 100
      
      // Get credit amount from price ID (you'll need to import this function)
      // For now, we'll use a simple mapping
      const CREDIT_AMOUNTS = {
        // Add your actual price IDs here
      }
      
      console.log(`   - Price ID: ${priceId}`)
      console.log(`     Quantity: ${quantity}`)
      console.log(`     Unit Price: $${unitAmount.toFixed(2)}`)
      
      // Try to determine credits from metadata or price
      // This is a simplified version - you may need to adjust
      if (item.price.metadata && item.price.metadata.credits) {
        const creditsPerItem = parseInt(item.price.metadata.credits)
        const creditsForThisItem = creditsPerItem * quantity
        totalCreditsShouldBe += creditsForThisItem
        console.log(`     Credits: ${creditsPerItem} × ${quantity} = ${creditsForThisItem}`)
      } else {
        console.log(`     ⚠️ Could not determine credits from price metadata`)
      }
    }
    
    console.log(`\n💰 Total Credits That Should Be Added: ${totalCreditsShouldBe}`)
    
    // Check current credits
    const currentCredits = await pool.query(
      `SELECT credits_remaining FROM user_credits WHERE user_id = $1`,
      [userId]
    )
    
    const current = currentCredits.rows[0]?.credits_remaining || 0
    console.log(`\n💳 Current Credits: ${current}`)
    
    // Check credit transactions for this session
    const transactions = await pool.query(
      `SELECT credits_amount, description, created_at 
       FROM credit_transactions 
       WHERE user_id = $1 AND description LIKE $2
       ORDER BY created_at DESC`,
      [userId, `%${sessionId}%`]
    )
    
    console.log(`\n📜 Credit Transactions for this session:`)
    let creditsAlreadyAdded = 0
    for (const tx of transactions.rows) {
      console.log(`   - ${tx.credits_amount} credits: ${tx.description} (${tx.created_at})`)
      creditsAlreadyAdded += tx.credits_amount || 0
    }
    
    console.log(`\n📊 Credits Already Added: ${creditsAlreadyAdded}`)
    
    const missingCredits = totalCreditsShouldBe - creditsAlreadyAdded
    console.log(`\n🔢 Missing Credits: ${missingCredits}`)
    
    if (missingCredits > 0) {
      console.log(`\n✅ Adding ${missingCredits} missing credits...`)
      
      await pool.query('BEGIN')
      try {
        // Add credits
        await pool.query(
          `UPDATE user_credits 
           SET credits_remaining = credits_remaining + $1, updated_at = NOW()
           WHERE user_id = $2`,
          [missingCredits, userId]
        )
        
        // Log transaction
        await pool.query(
          `INSERT INTO credit_transactions (user_id, transaction_type, credits_amount, description)
           VALUES ($1, $2, $3, $4)`,
          [userId, 'purchase', missingCredits, `Manual credit fix for Stripe session ${sessionId}`]
        )
        
        await pool.query('COMMIT')
        
        // Get updated credits
        const updated = await pool.query(
          `SELECT credits_remaining FROM user_credits WHERE user_id = $1`,
          [userId]
        )
        
        console.log(`\n✅ Successfully added ${missingCredits} credits!`)
        console.log(`💳 New Total Credits: ${updated.rows[0].credits_remaining}`)
      } catch (error) {
        await pool.query('ROLLBACK')
        throw error
      }
    } else if (missingCredits < 0) {
      console.log(`\n⚠️ Warning: More credits were added than expected. This might indicate a duplicate.`)
    } else {
      console.log(`\n✅ All credits are accounted for!`)
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await pool.end()
  }
}

// Get command line arguments
const sessionId = process.argv[2]
const userId = process.argv[3]

if (!sessionId || !userId) {
  console.error('Usage: node scripts/fix-missing-credits.js <stripe_session_id> <user_id>')
  console.error('Example: node scripts/fix-missing-credits.js cs_test_abc123 user_123')
  process.exit(1)
}

fixMissingCredits(sessionId, userId)
  .then(() => {
    console.log('\n✅ Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error)
    process.exit(1)
  })

