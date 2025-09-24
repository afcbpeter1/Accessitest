require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkCredits() {
  try {
    console.log('🔍 Checking your credits...');
    
    // Get your user ID (you'll need to replace this with your actual email)
    const userResult = await pool.query('SELECT id, email FROM users ORDER BY created_at DESC LIMIT 1');
    
    if (userResult.rows.length === 0) {
      console.log('❌ No users found in database');
      return;
    }
    
    const userId = userResult.rows[0].id;
    const email = userResult.rows[0].email;
    console.log('👤 User ID:', userId);
    console.log('📧 Email:', email);
    
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
