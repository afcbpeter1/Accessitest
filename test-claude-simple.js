// Simple test for Claude API
// Run with: node test-claude-simple.js

const { ClaudeAPI } = require('./src/lib/claude-api.ts');

async function testClaude() {
  console.log('🧪 Testing Claude API...\n');
  
  try {
    const claudeAPI = new ClaudeAPI();
    
    // Test basic connection
    console.log('1️⃣ Testing connection...');
    const isConnected = await claudeAPI.testConnection();
    console.log(`   Result: ${isConnected ? '✅ SUCCESS' : '❌ FAILED'}\n`);
    
    if (isConnected) {
      console.log('🎉 Claude API is working!');
    } else {
      console.log('❌ Claude API connection failed');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testClaude();















