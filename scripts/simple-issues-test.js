const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_PkNvW6bX5UFm@ep-summer-mode-abfxox5j-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
});

async function testIssues() {
  try {
    console.log('Testing Issues Board...');
    
    // Check if issues table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'issues'
      );
    `);
    
    console.log('Issues table exists:', tableCheck.rows[0].exists);
    
    if (tableCheck.rows[0].exists) {
      // Check current issues count
      const countResult = await pool.query('SELECT COUNT(*) as count FROM issues');
      console.log('Current issues count:', countResult.rows[0].count);
      
      if (countResult.rows[0].count === 0) {
        console.log('Creating a test issue...');
        
        await pool.query(`
          INSERT INTO issues (
            issue_key, rule_id, rule_name, description, impact, wcag_level,
            help_text, help_url, total_occurrences, affected_pages, priority, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [
          'test-issue-1',
          'color-contrast',
          'Color Contrast Issue',
          'Text color contrast is insufficient',
          'serious',
          'A',
          'Please improve color contrast',
          'https://www.w3.org/WAI/WCAG21/quickref/',
          1,
          ['https://example.com'],
          'high',
          'open'
        ]);
        
        console.log('✅ Test issue created');
        
        // Check count again
        const newCount = await pool.query('SELECT COUNT(*) as count FROM issues');
        console.log('New issues count:', newCount.rows[0].count);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

testIssues();