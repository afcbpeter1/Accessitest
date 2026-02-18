/**
 * Script to check the status of a checkout session and manually trigger webhook if needed
 * Usage: node scripts/check-checkout-session.js <session_id>
 */

const Stripe = require('stripe')

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY not found in environment')
  process.exit(1)
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

async function checkCheckoutSession(sessionId) {
  try {
    console.log(`🔍 Checking checkout session: ${sessionId}`)
    
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer']
    })
    
    console.log('\n📋 Session Details:')
    console.log('  ID:', session.id)
    console.log('  Status:', session.status)
    console.log('  Payment Status:', session.payment_status)
    console.log('  Mode:', session.mode)
    console.log('  Customer:', session.customer)
    console.log('  Customer Email:', session.customer_email)
    console.log('  Subscription:', session.subscription)
    console.log('  Metadata:', JSON.stringify(session.metadata, null, 2))
    
    if (session.status === 'complete' && session.payment_status === 'paid') {
      console.log('\n✅ Session is complete and paid!')
      console.log('⚠️  If webhook didn\'t fire, you can manually trigger it:')
      console.log(`   stripe events resend ${session.id}`)
    } else {
      console.log('\n⚠️  Session is not complete yet')
      console.log('   Status:', session.status)
      console.log('   Payment Status:', session.payment_status)
    }
    
    // Check if subscription was created
    if (session.subscription) {
      const subscription = typeof session.subscription === 'string' 
        ? await stripe.subscriptions.retrieve(session.subscription)
        : session.subscription
      
      console.log('\n📋 Subscription Details:')
      console.log('  ID:', subscription.id)
      console.log('  Status:', subscription.status)
      console.log('  Current Period End:', new Date(subscription.current_period_end * 1000).toISOString())
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    if (error.type === 'StripeInvalidRequestError') {
      console.error('   Session ID might be invalid or from a different account')
    }
  }
}

// Get session ID from command line or use a test one
const sessionId = process.argv[2]

if (!sessionId) {
  console.log('Usage: node scripts/check-checkout-session.js <session_id>')
  console.log('\nTo find recent sessions, check Stripe Dashboard:')
  console.log('https://dashboard.stripe.com/test/payments')
  process.exit(1)
}

checkCheckoutSession(sessionId)












