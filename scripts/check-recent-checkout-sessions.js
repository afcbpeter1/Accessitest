/**
 * Check recent checkout sessions to see if they completed and if webhooks were sent
 * Usage: node scripts/check-recent-checkout-sessions.js
 */

require('dotenv').config()
const Stripe = require('stripe')

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY not found in environment')
  console.error('   Make sure .env file exists and contains STRIPE_SECRET_KEY')
  process.exit(1)
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

async function checkRecentSessions() {
  try {
    console.log('🔍 Checking recent checkout sessions...\n')
    
    const sessions = await stripe.checkout.sessions.list({
      limit: 5,
      expand: ['data.subscription', 'data.customer']
    })
    
    if (sessions.data.length === 0) {
      console.log('❌ No recent checkout sessions found')
      return
    }
    
    for (const session of sessions.data) {
      console.log('='.repeat(80))
      console.log('📋 Session ID:', session.id)
      console.log('   Created:', new Date(session.created * 1000).toISOString())
      console.log('   Status:', session.status)
      console.log('   Payment Status:', session.payment_status)
      console.log('   Mode:', session.mode)
      console.log('   Customer:', session.customer)
      console.log('   Customer Email:', session.customer_email)
      console.log('   Subscription:', session.subscription)
      console.log('   Metadata:', JSON.stringify(session.metadata, null, 2))
      
      if (session.status === 'complete' && session.payment_status === 'paid') {
        console.log('   ✅ Session is complete and paid!')
        
        // Check if webhook event exists
        try {
          const events = await stripe.events.list({
            type: 'checkout.session.completed',
            created: {
              gte: session.created - 60, // Within 1 minute of session creation
            },
            limit: 10
          })
          
          const matchingEvent = events.data.find(e => {
            const eventSession = e.data.object
            return eventSession.id === session.id
          })
          
          if (matchingEvent) {
            console.log('   ✅ Webhook event found:', matchingEvent.id)
            console.log('      Event created:', new Date(matchingEvent.created * 1000).toISOString())
            console.log('      Event delivered:', matchingEvent.delivery ? 'Yes' : 'No')
          } else {
            console.log('   ⚠️  No webhook event found for this session!')
            console.log('      This means Stripe did not send checkout.session.completed')
          }
        } catch (error) {
          console.log('   ⚠️  Could not check webhook events:', error.message)
        }
      } else {
        console.log('   ⚠️  Session is not complete')
      }
      
      console.log('')
    }
    
    console.log('='.repeat(80))
    console.log('\n💡 To manually trigger webhook for a session:')
    console.log('   1. Find the session ID above')
    console.log('   2. Go to Stripe Dashboard → Webhooks → Events')
    console.log('   3. Find checkout.session.completed event for that session')
    console.log('   4. Click "Resend" to send it again')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

checkRecentSessions()

