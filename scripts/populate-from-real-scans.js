const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_PkNvW6bX5UFm@ep-summer-mode-abfxox5j-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
});

async function populateFromRealScans() {
  try {
    console.log('🔧 Populating Issues Board from real scan data...');
    
    // Get the most recent scan with issues
    const scanResult = await pool.query(`
      SELECT id, scan_results, created_at 
      FROM scan_history 
      WHERE scan_results IS NOT NULL 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    if (scanResult.rows.length === 0) {
      console.log('❌ No scan data found');
      return;
    }
    
    const scan = scanResult.rows[0];
    console.log(`📊 Processing scan ${scan.id} from ${scan.created_at}`);
    
    if (!scan.scan_results || !scan.scan_results.results || !Array.isArray(scan.scan_results.results)) {
      console.log('❌ No scan results array');
      return;
    }
    
    let issuesCreated = 0;
    
    for (const result of scan.scan_results.results) {
      if (!result.issues || !Array.isArray(result.issues)) continue;
      
      console.log(`📄 Processing ${result.issues.length} issues from ${result.url || 'unknown URL'}`);
      
      for (const issue of result.issues) {
        try {
          // Create unique issue key
          const issueKey = `${issue.id || 'unknown'}:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
          
          // Insert issue
          const newIssue = await pool.query(`
            INSERT INTO issues (
              issue_key, rule_id, rule_name, description, impact, wcag_level,
              help_text, help_url, total_occurrences, affected_pages, priority, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING id
          `, [
            issueKey,
            issue.id || 'unknown',
            issue.description || 'Accessibility Issue',
            issue.description || 'No description available',
            issue.impact || 'minor',
            'A',
            issue.help || 'Please review and fix this accessibility issue',
            issue.helpUrl || 'https://www.w3.org/WAI/WCAG21/quickref/',
            issue.nodes?.length || 1,
            [result.url],
            issue.impact === 'critical' ? 'critical' : 
            issue.impact === 'serious' ? 'high' : 'medium',
            'open'
          ]);
          
          console.log(`  ✅ Created: ${issue.description || issue.id} (${issue.impact})`);
          issuesCreated++;
          
        } catch (error) {
          if (error.code === '23505') { // Unique constraint violation
            console.log(`  ⚠️ Issue already exists: ${issue.description || issue.id}`);
          } else {
            console.log(`  ❌ Error: ${error.message}`);
          }
        }
      }
    }
    
    console.log(`\n✅ Populated ${issuesCreated} issues from scan data`);
    
    // Get final count
    const countResult = await pool.query('SELECT COUNT(*) as count FROM issues');
    console.log(`📈 Total issues in board: ${countResult.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

populateFromRealScans();