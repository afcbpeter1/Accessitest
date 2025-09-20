const fetch = require('node-fetch');

async function testAPI() {
  try {
    console.log('🔍 Testing Issues Board API directly...');
    
    const response = await fetch('http://localhost:3000/api/issues-board');
    const data = await response.json();
    
    console.log('📊 Response status:', response.status);
    console.log('📋 Response data:', JSON.stringify(data, null, 2));
    
    if (data.success && data.data.issues) {
      console.log('✅ Found', data.data.issues.length, 'issues');
      data.data.issues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue.rule_name} (${issue.impact})`);
      });
    } else {
      console.log('❌ No issues found or API error');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testAPI();