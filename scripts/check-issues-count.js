const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_PkNvW6bX5UFm@ep-summer-mode-abfxox5j-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
});

async function checkIssuesCount() {
  try {
    console.log('🔍 Checking Issues Board data...');
    
    const result = await pool.query('SELECT COUNT(*) as count FROM issues');
    console.log(`📈 Total issues in board: ${result.rows[0].count}`);
    
    if (result.rows[0].count > 0) {
      const issues = await pool.query('SELECT rule_name, impact, status, priority FROM issues LIMIT 5');
      console.log('📋 Sample issues:');
      issues.rows.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue.rule_name} (${issue.impact}, ${issue.status}, ${issue.priority})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking issues:', error);
  } finally {
    await pool.end();
  }
}

checkIssuesCount();