const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_PkNvW6bX5UFm@ep-summer-mode-abfxox5j-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
});

async function createIssuesTables() {
  try {
    console.log('🔧 Creating Issues Board tables...');
    
    // Create issues table
    console.log('📝 Creating issues table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS issues (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        issue_key VARCHAR(255) UNIQUE NOT NULL,
        rule_id VARCHAR(255) NOT NULL,
        rule_name TEXT NOT NULL,
        description TEXT NOT NULL,
        impact VARCHAR(20) NOT NULL CHECK (impact IN ('critical', 'serious', 'moderate', 'minor')),
        wcag_level VARCHAR(10) NOT NULL,
        help_text TEXT,
        help_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'deferred', 'duplicate')),
        priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
        assignee_id UUID,
        labels TEXT[],
        first_seen_scan_id UUID,
        last_seen_scan_id UUID,
        total_occurrences INTEGER DEFAULT 1,
        affected_pages TEXT[],
        estimated_effort VARCHAR(20),
        custom_fields JSONB,
        notes TEXT,
        resolution_notes TEXT,
        rank INTEGER
      )
    `);
    console.log('✅ Issues table created');

    // Create scan_issue_occurrences table
    console.log('📝 Creating scan_issue_occurrences table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS scan_issue_occurrences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
        scan_id UUID NOT NULL,
        page_url TEXT NOT NULL,
        element_selector TEXT,
        html_snippet TEXT,
        failure_summary TEXT,
        screenshot_url TEXT,
        bounding_box JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(issue_id, scan_id, page_url, element_selector)
      )
    `);
    console.log('✅ Scan issue occurrences table created');

    // Create issue_activity table
    console.log('📝 Creating issue_activity table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS issue_activity (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
        user_id UUID NOT NULL,
        activity_type VARCHAR(50) NOT NULL,
        old_value TEXT,
        new_value TEXT,
        comment TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ Issue activity table created');

    // Create issue_labels table
    console.log('📝 Creating issue_labels table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS issue_labels (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) UNIQUE NOT NULL,
        color VARCHAR(7) NOT NULL,
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ Issue labels table created');

    // Create issue_label_assignments table
    console.log('📝 Creating issue_label_assignments table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS issue_label_assignments (
        issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
        label_id UUID NOT NULL REFERENCES issue_labels(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        PRIMARY KEY (issue_id, label_id)
      )
    `);
    console.log('✅ Issue label assignments table created');

    // Create indexes
    console.log('📝 Creating indexes...');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_issues_priority ON issues(priority)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_issues_impact ON issues(impact)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_issues_assignee ON issues(assignee_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_issues_created_at ON issues(created_at)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_issues_rule_id ON issues(rule_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_scan_occurrences_issue_id ON scan_issue_occurrences(issue_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_scan_occurrences_scan_id ON scan_issue_occurrences(scan_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_issue_activity_issue_id ON issue_activity(issue_id)');
    console.log('✅ Indexes created');

    // Insert default labels
    console.log('📝 Inserting default labels...');
    await pool.query(`
      INSERT INTO issue_labels (name, color, description) VALUES
      ('frontend', '#3B82F6', 'Frontend/UI related issues'),
      ('backend', '#10B981', 'Backend/API related issues'),
      ('content', '#F59E0B', 'Content accessibility issues'),
      ('forms', '#EF4444', 'Form accessibility issues'),
      ('navigation', '#8B5CF6', 'Navigation accessibility issues'),
      ('media', '#06B6D4', 'Media accessibility issues'),
      ('critical-path', '#DC2626', 'Critical user journey issues'),
      ('quick-win', '#10B981', 'Quick fixes that are easy to implement')
      ON CONFLICT (name) DO NOTHING
    `);
    console.log('✅ Default labels inserted');

    console.log('🎉 Issues Board tables created successfully!');
    
  } catch (error) {
    console.error('❌ Error creating Issues Board tables:', error);
  } finally {
    await pool.end();
  }
}

createIssuesTables();