const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_PkNvW6bX5UFm@ep-summer-mode-abfxox5j-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
});

async function testIssuesBoard() {
  try {
    console.log('🔍 Testing Issues Board data...');
    
    // Check issues count
    const countResult = await pool.query('SELECT COUNT(*) as count FROM issues');
    console.log(`📈 Total issues in board: ${countResult.rows[0].count}`);
    
    if (countResult.rows[0].count > 0) {
      // Get sample issues
      const issuesResult = await pool.query(`
        SELECT id, rule_name, description, impact, status, priority, created_at
        FROM issues 
        ORDER BY created_at DESC 
        LIMIT 5
      `);
      
      console.log('\n📋 Sample issues:');
      issuesResult.rows.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue.rule_name}`);
        console.log(`   Impact: ${issue.impact}, Status: ${issue.status}, Priority: ${issue.priority}`);
        console.log(`   Description: ${issue.description.substring(0, 100)}...`);
        console.log('');
      });
      
      // Get impact breakdown
      const impactResult = await pool.query(`
        SELECT impact, COUNT(*) as count
        FROM issues 
        GROUP BY impact
        ORDER BY 
          CASE impact 
            WHEN 'critical' THEN 1
            WHEN 'serious' THEN 2
            WHEN 'moderate' THEN 3
            WHEN 'minor' THEN 4
            ELSE 5
          END
      `);
      
      console.log('📊 Impact breakdown:');
      impactResult.rows.forEach(row => {
        console.log(`   ${row.impact}: ${row.count} issues`);
      });
      
    } else {
      console.log('❌ No issues found in the board');
    }
    
  } catch (error) {
    console.error('❌ Error testing Issues Board:', error.message);
  } finally {
    await pool.end();
  }
}

testIssuesBoard();