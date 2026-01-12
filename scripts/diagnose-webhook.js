/**
 * Webhook Diagnostic Script
 * Run: node scripts/diagnose-webhook.js
 * 
 * This helps diagnose why webhooks aren't showing up in your CLI
 */

console.log('🔍 Webhook Diagnostic Tool\n')
console.log('='.repeat(80))

// Check 1: Environment variables
console.log('\n1️⃣ Checking Environment Variables:')
const requiredVars = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PER_USER_PRICE_ID'
]

let allVarsSet = true
requiredVars.forEach(varName => {
  const value = process.env[varName]
  if (value) {
    const preview = varName.includes('SECRET') || varName.includes('KEY')
      ? `${value.substring(0, 10)}...${value.substring(value.length - 5)}`
      : value
    console.log(`   ✅ ${varName}: ${preview}`)
  } else {
    console.log(`   ❌ ${varName}: NOT SET`)
    allVarsSet = false
  }
})

// Check 2: Webhook secret format
console.log('\n2️⃣ Checking Webhook Secret Format:')
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
if (webhookSecret) {
  const trimmed = webhookSecret.trim()
  if (trimmed !== webhookSecret) {
    console.log('   ⚠️  WARNING: Webhook secret has leading/trailing whitespace!')
    console.log(`   Original length: ${webhookSecret.length}, Trimmed length: ${trimmed.length}`)
  }
  
  if (webhookSecret.startsWith('whsec_')) {
    console.log('   ✅ Webhook secret format looks correct (starts with whsec_)')
  } else {
    console.log('   ⚠️  Webhook secret should start with "whsec_"')
  }
  
  console.log(`   Secret length: ${webhookSecret.length} characters`)
} else {
  console.log('   ❌ STRIPE_WEBHOOK_SECRET is not set')
}

// Check 3: Server accessibility
console.log('\n3️⃣ Testing Server Endpoint:')
const http = require('http')
const PORT = process.env.PORT || 3000
const WEBHOOK_URL = `http://localhost:${PORT}/api/stripe-webhook`

const testRequest = http.request(WEBHOOK_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  }
}, (res) => {
  let data = ''
  res.on('data', (chunk) => { data += chunk })
  res.on('end', () => {
    if (res.statusCode === 400) {
      console.log(`   ✅ Endpoint is accessible (Status: ${res.statusCode})`)
      console.log('   ✅ Expected: 400 (missing signature) - this is correct!')
    } else if (res.statusCode === 500) {
      console.log(`   ⚠️  Endpoint returned 500 - check server logs`)
    } else {
      console.log(`   ⚠️  Unexpected status: ${res.statusCode}`)
    }
    
    printRecommendations()
  })
})

testRequest.on('error', (error) => {
  console.log(`   ❌ Cannot connect to ${WEBHOOK_URL}`)
  console.log(`   Error: ${error.message}`)
  console.log('\n   💡 Make sure your Next.js server is running:')
  console.log('      npm run dev')
  printRecommendations()
})

testRequest.write(JSON.stringify({ test: true }))
testRequest.end()

function printRecommendations() {
  console.log('\n' + '='.repeat(80))
  console.log('\n💡 Recommendations:\n')
  
  console.log('1. Make sure Stripe CLI is running:')
  console.log('   stripe listen --forward-to localhost:3000/api/stripe-webhook')
  console.log('')
  
  console.log('2. Check your Stripe Dashboard for webhook endpoints:')
  console.log('   https://dashboard.stripe.com/test/webhooks')
  console.log('   If you see webhooks pointing to localhost, they might be interfering')
  console.log('')
  
  console.log('3. Test the webhook endpoint manually:')
  console.log('   stripe trigger checkout.session.completed')
  console.log('   This should show events in both CLI and server console')
  console.log('')
  
  console.log('4. When making a purchase, watch:')
  console.log('   - Stripe CLI terminal (should show: --> checkout.session.completed)')
  console.log('   - Next.js server console (should show: 🔔 WEBHOOK ENDPOINT HIT!)')
  console.log('')
  
  console.log('5. If you see events in Stripe Dashboard but not CLI:')
  console.log('   - Stripe is sending webhooks to Dashboard, not CLI')
  console.log('   - For local dev, you MUST use Stripe CLI')
  console.log('   - Disable or delete Dashboard webhooks pointing to localhost')
  console.log('')
  
  console.log('📖 For more help, see: scripts/check-webhook-setup.md')
  console.log('')
}

