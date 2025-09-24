const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkCredits() {
  try {
    console.log('🔍 Checking current credits...');
    
    // Get your user ID (replace with your actual user ID)
    const userResult = await pool.query('SELECT id, email FROM users WHERE email = $1', ['your-email@example.com']);
    
    if (userResult.rows.length === 0) {
      console.log('❌ User not found. Please update the email in this script.');
      return;
    }
    
    const userId = userResult.rows[0].id;
    console.log('👤 User ID:', userId);
    
    // Check current credits
    const creditsResult = await pool.query('SELECT credits FROM user_credits WHERE user_id = $1', [userId]);
    
    if (creditsResult.rows.length === 0) {
      console.log('❌ No credit record found for user');
    } else {
      console.log('💰 Current credits:', creditsResult.rows[0].credits);
    }
    
    // Check recent credit transactions
    const transactionsResult = await pool.query(
      'SELECT * FROM credit_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5',
      [userId]
    );
    
    console.log('📊 Recent transactions:');
    transactionsResult.rows.forEach((tx, i) => {
      console.log(`${i + 1}. ${tx.credits_amount} credits - ${tx.transaction_type} - ${tx.created_at}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking credits:', error.message);
  } finally {
    await pool.end();
  }
}

checkCredits();
