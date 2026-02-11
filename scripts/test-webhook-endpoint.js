/**
 * Simple test to verify webhook endpoint is accessible
 * Run: node scripts/test-webhook-endpoint.js
 */

const http = require('http');

const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = `http://localhost:${PORT}/api/stripe-webhook`;

console.log('🧪 Testing Webhook Endpoint\n');
console.log(`📍 Testing: ${WEBHOOK_URL}\n`);

// Test 1: Check if endpoint is accessible (should return error without signature, but that's OK)
const testRequest = http.request(WEBHOOK_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  }
}, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log(`✅ Endpoint is accessible (Status: ${res.statusCode})`);
    
    if (res.statusCode === 400) {
      console.log('   ✅ Expected: 400 (missing signature) - endpoint is working!');
      console.log('   Response:', data);
    } else if (res.statusCode === 500) {
      console.log('   ⚠️  Got 500 - check if STRIPE_WEBHOOK_SECRET is set');
      console.log('   Response:', data);
    } else {
      console.log('   ⚠️  Unexpected status code');
      console.log('   Response:', data);
    }
    
    console.log('\n💡 Next steps:');
    console.log('   1. Make sure your Next.js server is running: npm run dev');
    console.log('   2. Make sure Stripe CLI is running: stripe listen --forward-to localhost:3000/api/stripe-webhook');
    console.log('   3. Try purchasing licenses and watch the server console for logs');
    console.log('   4. Check database: SELECT max_users, subscription_status FROM organizations WHERE id = \'YOUR_ORG_ID\'');
  });
});

testRequest.on('error', (error) => {
  console.error('❌ Error connecting to endpoint:', error.message);
  console.log('\n💡 Make sure your Next.js server is running: npm run dev');
});

testRequest.write(JSON.stringify({ test: true }));
testRequest.end();








