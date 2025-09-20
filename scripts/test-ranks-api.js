const fetch = require('node-fetch');

async function testRanksAPI() {
  try {
    console.log('🔍 Testing Ranks API...');
    
    const rankUpdates = [
      { issueId: 'a88c9180-eabd-48f9-bbba-7e9c9561dd83', rank: 2 },
      { issueId: '4ddc298d-c6ab-40f7-b574-6f120c585117', rank: 1 }
    ];
    
    const response = await fetch('http://localhost:3001/api/issues-board/ranks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rankUpdates })
    });
    
    console.log('📊 Response status:', response.status);
    const data = await response.json();
    console.log('📋 Response data:', JSON.stringify(data, null, 2));
    
    if (response.ok) {
      console.log('✅ Ranks API working!');
    } else {
      console.error('❌ Ranks API failed');
    }
    
  } catch (error) {
    console.error('❌ Error testing ranks API:', error);
  }
}

testRanksAPI();