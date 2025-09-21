const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_PkNvW6bX5UFm@ep-summer-mode-abfxox5j-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
});

async function setupSprintBoard() {
  try {
    console.log('🏗️ Setting up Sprint Board schema...');
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'create-sprint-board-schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute the SQL
    await pool.query(sql);
    
    console.log('✅ Sprint Board schema created successfully!');
    
    // Verify tables were created
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'sprint%'
      ORDER BY table_name
    `);
    
    console.log('📊 Created tables:');
    tables.rows.forEach(table => {
      console.log(`  - ${table.table_name}`);
    });
    
    // Check if template was created
    const template = await pool.query('SELECT name FROM sprint_templates WHERE is_public = true');
    if (template.rows.length > 0) {
      console.log(`✅ Default template created: ${template.rows[0].name}`);
    }
    
  } catch (error) {
    console.error('❌ Error setting up Sprint Board schema:', error);
  } finally {
    await pool.end();
  }
}

setupSprintBoard();