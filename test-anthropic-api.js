// Test script for Anthropic API integration
// Run with: node test-anthropic-api.js

const { ClaudeAPI } = require('./src/lib/claude-api.ts');

async function testAnthropicAPI() {
  console.log('🧪 Testing Anthropic API Integration...\n');
  
  try {
    const claudeAPI = new ClaudeAPI();
    
    // Test basic connection
    console.log('1️⃣ Testing API connection...');
    const isConnected = await claudeAPI.testConnection();
    console.log(`   Connection test: ${isConnected ? '✅ SUCCESS' : '❌ FAILED'}\n`);
    
    if (isConnected) {
      // Test accessibility suggestion
      console.log('2️⃣ Testing accessibility suggestion...');
      const suggestion = await claudeAPI.generateAccessibilitySuggestion(
        '<button class="btn">Click me</button>',
        'button-name',
        'Button does not have accessible name',
        '.btn'
      );
      console.log(`   Suggestion received: ${suggestion.substring(0, 100)}...\n`);
      
      // Test document suggestion
      console.log('3️⃣ Testing document suggestion...');
      const docSuggestion = await claudeAPI.generateDocumentAccessibilitySuggestion(
        'Image missing alt text',
        'Introduction',
        'test-document.pdf',
        'application/pdf',
        'Company logo image',
        1
      );
      console.log(`   Document suggestion: ${docSuggestion.substring(0, 100)}...\n`);
      
      console.log('🎉 All tests completed successfully!');
    } else {
      console.log('❌ API connection failed. Check your ANTHROPIC_API_KEY environment variable.');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Make sure you have ANTHROPIC_API_KEY in your .env.local file');
    console.log('2. Verify your API key is valid at console.anthropic.com');
    console.log('3. Check that you have sufficient API credits');
  }
}

// Run the test
testAnthropicAPI();









