/**
 * Manually activate a subscription
 * Usage: node scripts/activate-subscription.js <subscription_id>
 * Example: node scripts/activate-subscription.js sub_1StFRMRYsgNlHbsUo1j52QKp
 */

const subscriptionId = process.argv[2]

if (!subscriptionId) {
  console.error('❌ Please provide a subscription ID')
  console.error('   Usage: node scripts/activate-subscription.js <subscription_id>')
  process.exit(1)
}

// This would need to be called via the API endpoint instead
// Since we need auth, let's just provide instructions
console.log(`
To manually activate subscription: ${subscriptionId}

Option 1: Use the API endpoint directly
POST /api/subscription/activate
Headers: Authorization: Bearer <your_token>
Body: { "subscriptionId": "${subscriptionId}" }

Option 2: The sync should work - try calling:
POST /api/subscription
Body: { "action": "sync" }
`)
