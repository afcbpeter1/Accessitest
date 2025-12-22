import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

/**
 * Database helper for penetration testing
 * WARNING: Only use in test environments
 */
export class DatabasePenTestHelper {
  constructor() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL environment variable is not set. Please set it in your .env file or environment.');
    }
    
    this.pool = new Pool({
      connectionString: dbUrl,
      ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
      } : false
    });
  }

  async connect() {
    try {
      const client = await this.pool.connect();
      return client;
    } catch (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }
  }

  async testQuery(query, params = []) {
    const client = await this.connect();
    try {
      // Ensure this is a read-only query (SELECT only)
      const trimmedQuery = query.trim().toUpperCase();
      if (!trimmedQuery.startsWith('SELECT') && 
          !trimmedQuery.startsWith('WITH') &&
          !trimmedQuery.startsWith('SHOW') &&
          !trimmedQuery.startsWith('EXPLAIN')) {
        throw new Error('Only SELECT queries are allowed for safety');
      }
      
      const result = await client.query(query, params);
      return { success: true, rows: result.rows, rowCount: result.rowCount };
    } catch (error) {
      return { success: false, error: error.message, code: error.code };
    } finally {
      client.release();
    }
  }

  /**
   * Safe query test that uses transactions with rollback for write operations
   * This ensures no data is actually modified
   */
  async testQuerySafe(query, params = []) {
    const client = await this.connect();
    try {
      // Start transaction
      await client.query('BEGIN');
      
      try {
        const result = await client.query(query, params);
        // Always rollback to ensure no changes are committed
        await client.query('ROLLBACK');
        return { success: true, rows: result.rows, rowCount: result.rowCount };
      } catch (error) {
        // Rollback on error too
        await client.query('ROLLBACK');
        return { success: false, error: error.message, code: error.code };
      }
    } catch (error) {
      return { success: false, error: error.message, code: error.code };
    } finally {
      client.release();
    }
  }

  async testInjection(query, params = []) {
    // Test SQL injection attempts
    const client = await this.connect();
    try {
      const result = await client.query(query, params);
      return { 
        success: true, 
        vulnerable: false, 
        rows: result.rows, 
        rowCount: result.rowCount 
      };
    } catch (error) {
      // If error is about SQL syntax, it might indicate injection attempt was blocked
      if (error.code === '42601' || error.message.includes('syntax')) {
        return { 
          success: false, 
          vulnerable: false, 
          error: error.message,
          protected: true 
        };
      }
      return { 
        success: false, 
        vulnerable: true, 
        error: error.message 
      };
    } finally {
      client.release();
    }
  }

  async getTableNames() {
    const result = await this.testQuery(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    return result;
  }

  async getTableColumns(tableName) {
    const result = await this.testQuery(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);
    return result;
  }

  async testPrivileges() {
    // Test what privileges the current user has
    const result = await this.testQuery(`
      SELECT 
        grantee, 
        privilege_type, 
        table_name
      FROM information_schema.role_table_grants
      WHERE grantee = current_user
      OR grantee = 'PUBLIC'
    `);
    return result;
  }

  async testUserAccess() {
    // Test if we can access user information
    const result = await this.testQuery(`
      SELECT current_user, session_user, current_database()
    `);
    return result;
  }

  async testSchemaAccess() {
    // Test schema access
    const result = await this.testQuery(`
      SELECT schema_name 
      FROM information_schema.schemata
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
    `);
    return result;
  }

  async close() {
    await this.pool.end();
  }
}

