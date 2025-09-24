const fetch = require('node-fetch');

// Test webhook endpoint
async function testWebhook() {
  try {
    console.log('🧪 Testing webhook endpoint...');
    
    const response = await fetch('http://localhost:3000/api/stripe-webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 'test-signature'
      },
      body: JSON.stringify({
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_123',
            metadata: {
              userId: 'test-user-123',
              priceId: 'price_123',
              type: 'credits'
            }
          }
        }
      })
    });
    
    console.log('📡 Response status:', response.status);
    console.log('📡 Response text:', await response.text());
    
  } catch (error) {
    console.error('❌ Error testing webhook:', error.message);
  }
}

testWebhook();
