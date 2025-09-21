const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_PkNvW6bX5UFm@ep-summer-mode-abfxox5j-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
});

async function createTestSprint() {
  try {
    console.log('🏃 Creating test sprint...');
    
    // Get a user ID first
    const userResult = await pool.query('SELECT id FROM users LIMIT 1');
    if (userResult.rows.length === 0) {
      console.log('❌ No users found. Please create a user first.');
      return;
    }
    const userId = userResult.rows[0].id;
    console.log('👤 Using user ID:', userId);
    
    // Create a test sprint
    const sprintResult = await pool.query(`
      INSERT INTO sprints (user_id, name, description, start_date, end_date, goal, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [
      userId,
      'Accessibility Sprint 1',
      'First accessibility sprint focusing on critical issues',
      '2025-09-20',
      '2025-10-04',
      'Fix all critical and serious accessibility issues',
      'active'
    ]);

    const sprintId = sprintResult.rows[0].id;
    console.log('✅ Sprint created:', sprintId);

    // Create columns for the sprint
    const columns = [
      { name: 'To Do', description: 'Issues to be worked on', color: '#6B7280', position: 1, wip_limit: null, is_done_column: false },
      { name: 'In Progress', description: 'Issues currently being worked on', color: '#3B82F6', position: 2, wip_limit: 5, is_done_column: false },
      { name: 'In Review', description: 'Issues under review', color: '#F59E0B', position: 3, wip_limit: 3, is_done_column: false },
      { name: 'Done', description: 'Completed issues', color: '#10B981', position: 4, wip_limit: null, is_done_column: true }
    ];

    for (const column of columns) {
      await pool.query(`
        INSERT INTO sprint_columns (sprint_id, name, description, color, position, wip_limit, is_done_column)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `, [sprintId, column.name, column.description, column.color, column.position, column.wip_limit, column.is_done_column]);
    }

    console.log('✅ Columns created');

    // Get some issues to add to the sprint
    const issuesResult = await pool.query(`
      SELECT id FROM issues 
      ORDER BY created_at DESC 
      LIMIT 3
    `);

    if (issuesResult.rows.length > 0) {
      // Get the "To Do" column
      const todoColumn = await pool.query(`
        SELECT id FROM sprint_columns 
        WHERE sprint_id = $1 AND name = 'To Do'
      `, [sprintId]);

      if (todoColumn.rows.length > 0) {
        const todoColumnId = todoColumn.rows[0].id;

        // Add issues to the sprint
        for (let i = 0; i < issuesResult.rows.length; i++) {
          await pool.query(`
            INSERT INTO sprint_issues (sprint_id, issue_id, column_id, position, story_points)
            VALUES ($1, $2, $3, $4, $5)
          `, [sprintId, issuesResult.rows[i].id, todoColumnId, i + 1, Math.floor(Math.random() * 5) + 1]);
        }

        console.log(`✅ Added ${issuesResult.rows.length} issues to sprint`);
      }
    }

    console.log('🎉 Test sprint created successfully!');
    console.log('📊 Sprint ID:', sprintId);
    console.log('🔗 Visit: http://localhost:3001/sprint-board');

  } catch (error) {
    console.error('❌ Error creating test sprint:', error);
  } finally {
    await pool.end();
  }
}

createTestSprint();