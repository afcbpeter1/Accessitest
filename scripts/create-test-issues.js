const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_PkNvW6bX5UFm@ep-summer-mode-abfxox5j-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
});

async function createTestIssues() {
  try {
    console.log('🔧 Creating test issues...');
    
    // Clear existing issues first
    await pool.query('DELETE FROM scan_issue_occurrences');
    await pool.query('DELETE FROM issues');
    console.log('🧹 Cleared existing issues');
    
    // Create test issues
    const testIssues = [
      {
        issue_key: 'color-contrast:test:1',
        rule_id: 'color-contrast',
        rule_name: 'Color Contrast',
        description: 'Elements must meet minimum color contrast ratio thresholds',
        impact: 'serious',
        priority: 'high',
        status: 'open',
        affected_pages: ['https://example.com'],
        total_occurrences: 3
      },
      {
        issue_key: 'target-size:test:2',
        rule_id: 'target-size',
        rule_name: 'Target Size',
        description: 'Ensure touch targets have sufficient size and space',
        impact: 'serious',
        priority: 'high',
        status: 'open',
        affected_pages: ['https://example.com'],
        total_occurrences: 2
      },
      {
        issue_key: 'alt-text:test:3',
        rule_id: 'alt-text',
        rule_name: 'Alt Text',
        description: 'Images must have alternative text',
        impact: 'moderate',
        priority: 'medium',
        status: 'in_progress',
        affected_pages: ['https://example.com'],
        total_occurrences: 1
      }
    ];
    
    for (const issue of testIssues) {
      const result = await pool.query(`
        INSERT INTO issues (
          issue_key, rule_id, rule_name, description, impact, wcag_level,
          help_text, help_url, total_occurrences, affected_pages, priority, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id
      `, [
        issue.issue_key,
        issue.rule_id,
        issue.rule_name,
        issue.description,
        issue.impact,
        'A',
        'Please review and fix this accessibility issue',
        'https://www.w3.org/WAI/WCAG21/quickref/',
        issue.total_occurrences,
        issue.affected_pages,
        issue.priority,
        issue.status
      ]);
      
      console.log(`✅ Created issue: ${issue.rule_name} (${issue.impact})`);
    }
    
    // Get final count
    const countResult = await pool.query('SELECT COUNT(*) as count FROM issues');
    console.log(`📈 Total issues in board: ${countResult.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Error creating test issues:', error);
  } finally {
    await pool.end();
  }
}

createTestIssues();