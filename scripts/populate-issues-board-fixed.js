const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_PkNvW6bX5UFm@ep-summer-mode-abfxox5j-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
});

async function populateIssuesBoard() {
  try {
    console.log('🔧 Populating Issues Board with scan data...');
    
    // Check if we have any scan data to work with
    const scanResult = await pool.query(`
      SELECT id, scan_results, created_at 
      FROM scan_history 
      WHERE scan_results IS NOT NULL 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    if (scanResult.rows.length === 0) {
      console.log('❌ No scan data found. Please run some scans first.');
      return;
    }
    
    console.log(`📊 Found ${scanResult.rows.length} scans with data`);
    
    let totalIssues = 0;
    let createdIssues = 0;
    let linkedIssues = 0;
    
    for (const scan of scanResult.rows) {
      if (!scan.scan_results || !Array.isArray(scan.scan_results)) continue;
      
      for (const result of scan.scan_results) {
        if (!result.issues || !Array.isArray(result.issues)) continue;
        
        for (const issue of result.issues) {
          totalIssues++;
          
          // Check if similar issue already exists
          const existingQuery = `
            SELECT id FROM issues 
            WHERE rule_id = $1 AND impact = $2
            LIMIT 1
          `;
          const existing = await pool.query(existingQuery, [
            issue.id || issue.rule_id || 'unknown',
            issue.impact || 'minor'
          ]);
          
          if (existing.rows.length > 0) {
            // Link to existing issue
            for (const node of issue.nodes || []) {
              await pool.query(`
                INSERT INTO scan_issue_occurrences (issue_id, scan_id, page_url, element_selector, html_snippet, failure_summary)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (issue_id, scan_id, page_url, element_selector) DO NOTHING
              `, [
                existing.rows[0].id,
                scan.id,
                result.url,
                node.target?.join(' ') || null,
                node.html || null,
                node.failureSummary || null
              ]);
            }
            linkedIssues++;
          } else {
            // Create new issue
            const issueKey = `${issue.id || issue.rule_id || 'unknown'}:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
            
            const newIssue = await pool.query(`
              INSERT INTO issues (
                issue_key, rule_id, rule_name, description, impact, wcag_level,
                help_text, help_url, first_seen_scan_id, last_seen_scan_id,
                total_occurrences, affected_pages, priority
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
              RETURNING id
            `, [
              issueKey,
              issue.id || issue.rule_id || 'unknown',
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
              issue.impact === 'serious' ? 'high' : 'medium'
            ]);
            
            // Add occurrences
            for (const node of issue.nodes || []) {
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
            createdIssues++;
          }
        }
      }
    }
    
    console.log(`✅ Issues Board populated successfully!`);
    console.log(`📊 Total issues processed: ${totalIssues}`);
    console.log(`🆕 New issues created: ${createdIssues}`);
    console.log(`🔗 Issues linked to existing: ${linkedIssues}`);
    
    // Get final count
    const countResult = await pool.query('SELECT COUNT(*) as count FROM issues');
    console.log(`📈 Total issues in board: ${countResult.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Error populating Issues Board:', error);
  } finally {
    await pool.end();
  }
}

populateIssuesBoard();