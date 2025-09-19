const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function runMigration() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        await client.connect();
        console.log('Connected to the database.');

        const schemaSql = fs.readFileSync(path.join(__dirname, 'create-issue-status-table.sql'), 'utf8');
        await client.query(schemaSql);
        console.log('Migration for issue_status table executed successfully.');

    } catch (error) {
        console.error('Error running migration:', error);
        process.exit(1);
    } finally {
        await client.end();
        console.log('Database connection closed.');
    }
}

runMigration();
