const { Pool } = require('pg');
const fs = require('fs');

// Read the SQL file
const sqlContent = fs.readFileSync('scripts/create-issues-board.sql', 'utf8');

// Split into individual statements
const statements = sqlContent
  .split(';')
  .map(stmt => stmt.trim())
  .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false
});

async function setupIssuesBoard() {
  try {
    console.log('🔧 Setting up Issues Board database tables...');
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`📝 Executing statement ${i + 1}/${statements.length}...`);
        try {
          await pool.query(statement);
          console.log('✅ Statement executed successfully');
        } catch (error) {
          console.log(`❌ Error in statement ${i + 1}:`, error.message);
          // Continue with other statements
        }
      }
    }
    
    console.log('🎉 Issues Board setup completed!');
  } catch (error) {
    console.error('❌ Error setting up Issues Board:', error);
  } finally {
    await pool.end();
  }
}

setupIssuesBoard();