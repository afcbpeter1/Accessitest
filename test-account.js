// Test script to check what models you have access to
const fetch = require('node-fetch');

async function testAccount() {
  // Load environment variables
  require('dotenv').config({ path: '.env.local' });
  
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    console.log('❌ ANTHROPIC_API_KEY not found');
    return;
  }

  console.log('🔑 API Key found:', '***' + apiKey.slice(-4));
  
  // Test 1: Try to get account info
  try {
    console.log('\n🔍 Testing account access...');
    
    const response = await fetch('https://api.anthropic.com/v1/models', {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      }
    });

    console.log('📡 Response status:', response.status, response.statusText);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Available models:', JSON.stringify(data, null, 2));
    } else {
      const errorText = await response.text();
      console.log('❌ Error getting models:', errorText);
    }
    
  } catch (error) {
    console.log('❌ Request failed:', error.message);
  }

  // Test 2: Try a simple message with a basic model
  try {
    console.log('\n🧪 Testing basic message...');
    
    const requestBody = {
      model: 'claude-3-sonnet-20240229',
      messages: [
        { role: 'user', content: 'Hello, please respond with "Working" if you can see this.' }
      ],
      max_tokens: 50
    };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    });

    console.log('📡 Message test status:', response.status, response.statusText);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Message test SUCCESS! Response:', data.content?.[0]?.text);
    } else {
      const errorText = await response.text();
      console.log('❌ Message test failed:', errorText);
    }
    
  } catch (error) {
    console.log('❌ Message test failed:', error.message);
  }
}

testAccount();












