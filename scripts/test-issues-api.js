const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_PkNvW6bX5UFm@ep-summer-mode-abfxox5j-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
});

async function testIssuesAPI() {
  try {
    console.log('🔍 Testing Issues Board API...');
    
    // Test direct database query
    const result = await pool.query(`
      SELECT 
        i.id,
        i.rule_name,
        i.description,
        i.impact,
        i.status,
        i.priority,
        i.total_occurrences,
        i.updated_at as last_seen,
        i.created_at,
        i.rank
      FROM issues i
      ORDER BY i.rank ASC, i.created_at DESC
      LIMIT 10
    `);
    
    console.log('📊 Issues found:', result.rows.length);
    
    if (result.rows.length > 0) {
      console.log('📋 Sample issues:');
      result.rows.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue.rule_name}`);
        console.log(`   Impact: ${issue.impact}, Status: ${issue.status}, Priority: ${issue.priority}`);
        console.log(`   Occurrences: ${issue.total_occurrences}, Last seen: ${new Date(issue.last_seen).toLocaleDateString()}`);
        console.log('');
      });
    }
    
    // Test API endpoint
    console.log('🌐 Testing API endpoint...');
    const response = await fetch('http://localhost:3000/api/issues-board?page=1&limit=20');
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ API Response:', JSON.stringify(data, null, 2));
    } else {
      console.log('❌ API Error:', data);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

testIssuesAPI();