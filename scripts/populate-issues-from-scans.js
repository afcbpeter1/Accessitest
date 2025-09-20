const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_PkNvW6bX5UFm@ep-summer-mode-abfxox5j-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
});

async function populateIssuesFromScans() {
  try {
    console.log('🔧 Populating Issues Board from scan data...');
    
    // Get recent scans with issues
    const scanResult = await pool.query(`
      SELECT id, scan_results, created_at 
      FROM scan_history 
      WHERE scan_results IS NOT NULL 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    if (scanResult.rows.length === 0) {
      console.log('❌ No scan data found');
      return;
    }
    
    console.log(`📊 Found ${scanResult.rows.length} scans with data`);
    
    let totalIssues = 0;
    let createdIssues = 0;
    
    for (const scan of scanResult.rows) {
      console.log(`\n📋 Processing scan ${scan.id}...`);
      
      if (!scan.scan_results || !Array.isArray(scan.scan_results)) {
        console.log('  ⚠️ No scan results array');
        continue;
      }
      
      for (const result of scan.scan_results) {
        if (!result.issues || !Array.isArray(result.issues)) {
          console.log('  ⚠️ No issues array in result');
          continue;
        }
        
        console.log(`  📄 Processing ${result.issues.length} issues from ${result.url || 'unknown URL'}`);
        
        for (const issue of result.issues) {
          totalIssues++;
          
          // Create unique issue key
          const issueKey = `${issue.id || 'unknown'}:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
          
          try {
            // Insert issue
            const newIssue = await pool.query(`
              INSERT INTO issues (
                issue_key, rule_id, rule_name, description, impact, wcag_level,
                help_text, help_url, first_seen_scan_id, last_seen_scan_id,
                total_occurrences, affected_pages, priority, status
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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
              scan.id,
              scan.id,
              issue.nodes?.length || 1,
              [result.url],
              issue.impact === 'critical' ? 'critical' : 
              issue.impact === 'serious' ? 'high' : 'medium',
              'open'
            ]);
            
            console.log(`    ✅ Created issue: ${issue.description || issue.id}`);
            createdIssues++;
            
            // Add occurrences for each node
            if (issue.nodes && Array.isArray(issue.nodes)) {
              for (const node of issue.nodes) {
                await pool.query(`
                  INSERT INTO scan_issue_occurrences (issue_id, scan_id, page_url, element_selector, html_snippet, failure_summary)
                  VALUES ($1, $2, $3, $4, $5, $6)
                `, [
                  newIssue.rows[0].id,
                  scan.id,
                  result.url,
                  node.target?.join(' ') || null,
                  node.html || null,
                  node.failureSummary || null
                ]);
              }
            }
            
          } catch (error) {
            if (error.code === '23505') { // Unique constraint violation
              console.log(`    ⚠️ Issue already exists: ${issue.description || issue.id}`);
            } else {
              console.log(`    ❌ Error creating issue: ${error.message}`);
            }
          }
        }
      }
    }
    
    console.log(`\n✅ Issues Board population completed!`);
    console.log(`📊 Total issues processed: ${totalIssues}`);
    console.log(`🆕 New issues created: ${createdIssues}`);
    
    // Get final count
    const countResult = await pool.query('SELECT COUNT(*) as count FROM issues');
    console.log(`📈 Total issues in board: ${countResult.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Error populating Issues Board:', error);
  } finally {
    await pool.end();
  }
}

populateIssuesFromScans();