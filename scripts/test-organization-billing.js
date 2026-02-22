/**
 * Test script to verify organization billing logic
 * This simulates the flow without making actual Stripe API calls
 */

const { query, queryOne } = require('../src/lib/database')

async function testOrganizationBilling() {
  console.log('🧪 Testing Organization Billing Flow\n')
  
  try {
    // 1. Check if migration has been run
    console.log('1️⃣ Checking database schema...')
    const orgColumns = await query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'organizations'
      AND column_name IN ('max_users', 'subscription_status', 'stripe_customer_id')
      ORDER BY column_name
    `)
    
    console.log(`   Found ${orgColumns.rows.length} billing columns:`)
    orgColumns.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`)
    })
    
    if (orgColumns.rows.length < 3) {
      console.log('   ❌ Missing billing columns! Run migration: migrations/009_add_organization_billing_columns.sql')
      return
    }
    console.log('   ✅ All billing columns exist\n')
    
    // 2. Check for organizations
    console.log('2️⃣ Checking organizations...')
    const orgs = await query(`
      SELECT id, name, max_users, subscription_status, stripe_customer_id
      FROM organizations
      LIMIT 5
    `)
    
    console.log(`   Found ${orgs.rows.length} organization(s):`)
    orgs.rows.forEach(org => {
      console.log(`   - ${org.name} (${org.id})`)
      console.log(`     max_users: ${org.max_users || 0}`)
      console.log(`     subscription_status: ${org.subscription_status || 'NULL'}`)
      console.log(`     stripe_customer_id: ${org.stripe_customer_id || 'NULL'}`)
    })
    console.log('')
    
    // 3. Check for organization owners with subscriptions
    console.log('3️⃣ Checking organization owners with subscriptions...')
    const owners = await query(`
      SELECT 
        o.id as org_id,
        o.name as org_name,
        o.max_users,
        u.id as user_id,
        u.email,
        u.stripe_subscription_id
      FROM organizations o
      INNER JOIN organization_members om ON o.id = om.organization_id
      INNER JOIN users u ON om.user_id = u.id
      WHERE om.role = 'owner' 
        AND om.is_active = true
        AND u.stripe_subscription_id IS NOT NULL
      LIMIT 5
    `)
    
    console.log(`   Found ${owners.rows.length} owner(s) with subscriptions:`)
    owners.rows.forEach(owner => {
      console.log(`   - ${owner.org_name} (${owner.org_id})`)
      console.log(`     Owner: ${owner.email} (${owner.user_id})`)
      console.log(`     Subscription: ${owner.stripe_subscription_id}`)
      console.log(`     Current max_users: ${owner.max_users || 0}`)
    })
    console.log('')
    
    // 4. Check environment variables
    console.log('4️⃣ Checking environment variables...')
    const requiredEnvVars = [
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'STRIPE_PER_USER_PRICE_ID'
    ]
    
    requiredEnvVars.forEach(varName => {
      const value = process.env[varName]
      if (value) {
        const preview = varName.includes('SECRET') || varName.includes('KEY')
          ? `${value.substring(0, 10)}...${value.substring(value.length - 5)}`
          : value
        console.log(`   ✅ ${varName}: ${preview}`)
      } else {
        console.log(`   ❌ ${varName}: NOT SET`)
      }
    })
    console.log('')
    
    // 5. Test query logic (simulate webhook handler)
    if (owners.rows.length > 0) {
      console.log('5️⃣ Testing webhook handler query logic...')
      const testOwner = owners.rows[0]
      
      // Simulate: Find organizations owned by user with subscription
      const orgsForUser = await query(`
        SELECT o.id, o.name, o.max_users
        FROM organizations o
        INNER JOIN organization_members om ON o.id = om.organization_id
        WHERE om.user_id = $1 AND om.role = 'owner' AND om.is_active = true
      `, [testOwner.user_id])
      
      console.log(`   For user ${testOwner.email}:`)
      console.log(`   Found ${orgsForUser.rows.length} organization(s)`)
      orgsForUser.rows.forEach(org => {
        console.log(`   - ${org.name} (${org.id}): max_users=${org.max_users || 0}`)
      })
    }
    
    console.log('\n✅ Test complete!')
    console.log('\n💡 Next steps:')
    console.log('   1. Make sure migration 009 has been run')
    console.log('   2. Check that STRIPE_PER_USER_PRICE_ID is set in .env')
    console.log('   3. Try purchasing licenses and watch server logs')
    console.log('   4. Check database after purchase: SELECT max_users FROM organizations WHERE id = \'YOUR_ORG_ID\'')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
    console.error(error.stack)
  } finally {
    process.exit(0)
  }
}

// Run the test
testOrganizationBilling()















