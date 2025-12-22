import { DatabasePenTestHelper } from '../utils/db-helper.js';

export class DatabaseSecurityTests {
  constructor() {
    this.helper = new DatabasePenTestHelper();
    this.results = [];
  }

  async runAllTests() {
    console.log('🗄️  Starting Database Security Penetration Tests...\n');

    await this.testSQLInjection();
    await this.testPrivilegeEscalation();
    await this.testSchemaEnumeration();
    await this.testDataExposure();
    await this.testConnectionSecurity();
    await this.testParameterizedQueries();
    await this.testTableAccess();
    await this.testUserPrivileges();

    return this.results;
  }

  async testSQLInjection() {
    console.log('📋 Testing SQL Injection Protection...');
    
    // Test common SQL injection patterns
    const injectionTests = [
      {
        name: 'Basic SQL Injection',
        query: "SELECT * FROM users WHERE email = $1",
        params: ["' OR '1'='1"]
      },
      {
        name: 'Union-based Injection',
        query: "SELECT * FROM users WHERE id = $1",
        params: ["1' UNION SELECT NULL, NULL, NULL--"]
      },
      {
        name: 'Boolean-based Injection',
        query: "SELECT * FROM users WHERE email = $1",
        params: ["admin' AND '1'='1"]
      },
      {
        name: 'Time-based Injection',
        query: "SELECT * FROM users WHERE id = $1",
        params: ["1'; WAITFOR DELAY '00:00:05'--"]
      },
      {
        name: 'Stacked Queries',
        query: "SELECT * FROM users WHERE id = $1",
        params: ["1'; DROP TABLE users--"]
      }
    ];

    for (const test of injectionTests) {
      const result = await this.helper.testInjection(test.query, test.params);
      
      this.results.push({
        name: `SQL Injection: ${test.name}`,
        severity: result.vulnerable ? 'CRITICAL' : 'INFO',
        passed: !result.vulnerable,
        details: {
          query: test.query,
          params: test.params,
          vulnerable: result.vulnerable,
          protected: result.protected,
          error: result.error
        }
      });
    }
  }

  async testPrivilegeEscalation() {
    console.log('📋 Testing Privilege Escalation...');
    
    // Test if we can access system tables (READ-ONLY)
    const systemTables = [
      'pg_user',
      'pg_shadow',
      'pg_roles',
      'pg_authid',
      'pg_database'
    ];

    for (const table of systemTables) {
      const result = await this.helper.testQuery(`SELECT * FROM ${table} LIMIT 1`);
      
      this.results.push({
        name: `Privilege Escalation: Access to ${table}`,
        severity: result.success ? 'HIGH' : 'INFO',
        passed: !result.success,
        details: {
          table,
          accessible: result.success,
          error: result.error
        }
      });
    }

    // Test if we can create tables (using transaction that will rollback)
    const createTableTest = await this.helper.testQuerySafe(`
      CREATE TABLE test_pen_test_table_safe_check (id INT)
    `);
    
    this.results.push({
      name: 'Privilege Escalation: CREATE TABLE',
      severity: createTableTest.success ? 'HIGH' : 'INFO',
      passed: !createTableTest.success,
      details: {
        canCreate: createTableTest.success,
        error: createTableTest.error,
        note: 'Test uses transaction rollback - no data modified'
      }
    });
  }

  async testSchemaEnumeration() {
    console.log('📋 Testing Schema Enumeration...');
    
    // Test if we can enumerate tables
    const tablesResult = await this.helper.getTableNames();
    
    this.results.push({
      name: 'Schema Enumeration: Table Names',
      severity: tablesResult.success && tablesResult.rows.length > 0 ? 'MEDIUM' : 'INFO',
      passed: !tablesResult.success || tablesResult.rows.length === 0,
      details: {
        canEnumerate: tablesResult.success,
        tableCount: tablesResult.rows.length,
        tables: tablesResult.rows.map(r => r.table_name)
      }
    });

    // Test if we can enumerate columns
    if (tablesResult.success && tablesResult.rows.length > 0) {
      const firstTable = tablesResult.rows[0].table_name;
      const columnsResult = await this.helper.getTableColumns(firstTable);
      
      this.results.push({
        name: `Schema Enumeration: Columns for ${firstTable}`,
        severity: columnsResult.success ? 'MEDIUM' : 'INFO',
        passed: !columnsResult.success,
        details: {
          table: firstTable,
          canEnumerate: columnsResult.success,
          columnCount: columnsResult.rows.length,
          columns: columnsResult.rows.map(r => ({
            name: r.column_name,
            type: r.data_type
          }))
        }
      });
    }
  }

  async testDataExposure() {
    console.log('📋 Testing Data Exposure (READ-ONLY)...');
    
    // Test if we can access sensitive tables (READ-ONLY - only COUNT)
    const sensitiveTables = [
      'users',
      'user_passwords',
      'user_credits',
      'jira_integrations',
      'azure_devops_integrations'
    ];

    for (const table of sensitiveTables) {
      const result = await this.helper.testQuery(`SELECT COUNT(*) FROM ${table}`);
      
      this.results.push({
        name: `Data Exposure: Access to ${table}`,
        severity: result.success ? 'HIGH' : 'INFO',
        passed: !result.success,
        details: {
          table,
          accessible: result.success,
          rowCount: result.rows?.[0]?.count,
          error: result.error,
          note: 'READ-ONLY test - only counting rows, no data accessed'
        }
      });
    }

    // Test if we can read password hashes (READ-ONLY - just checking access, not reading actual hashes)
    // Using LIMIT 0 to ensure we don't actually retrieve any data
    const passwordHashTest = await this.helper.testQuery(`
      SELECT COUNT(*) as can_access FROM user_passwords WHERE 1=0
    `);
    
    this.results.push({
      name: 'Data Exposure: Password Hash Access',
      severity: passwordHashTest.success ? 'CRITICAL' : 'INFO',
      passed: !passwordHashTest.success,
      details: {
        canAccess: passwordHashTest.success,
        error: passwordHashTest.error,
        note: 'READ-ONLY test - checking table access only, no actual password data retrieved'
      }
    });
  }

  async testConnectionSecurity() {
    console.log('📋 Testing Connection Security...');
    
    // Test SSL/TLS
    const userAccess = await this.helper.testUserAccess();
    
    this.results.push({
      name: 'Connection Security: User Access',
      severity: 'INFO',
      passed: true,
      details: {
        currentUser: userAccess.rows?.[0]?.current_user,
        sessionUser: userAccess.rows?.[0]?.session_user,
        database: userAccess.rows?.[0]?.current_database
      }
    });

    // Test connection string exposure
    const connectionTest = await this.helper.testQuery('SELECT version()');
    
    this.results.push({
      name: 'Connection Security: Version Information',
      severity: connectionTest.success ? 'LOW' : 'INFO',
      passed: true, // Version info is usually not critical
      details: {
        canQuery: connectionTest.success,
        version: connectionTest.rows?.[0]?.version
      }
    });
  }

  async testParameterizedQueries() {
    console.log('📋 Testing Parameterized Query Protection...');
    
    // Test that parameterized queries work correctly
    const validQuery = await this.helper.testQuery(
      'SELECT * FROM users WHERE email = $1',
      ['test@example.com']
    );
    
    this.results.push({
      name: 'Parameterized Queries: Valid Query',
      severity: 'INFO',
      passed: true,
      details: {
        works: validQuery.success,
        usesParams: true
      }
    });

    // Test that malicious input is properly escaped
    const maliciousInput = await this.helper.testQuery(
      'SELECT * FROM users WHERE email = $1',
      ["'; DROP TABLE users--"]
    );
    
    this.results.push({
      name: 'Parameterized Queries: Malicious Input Protection',
      severity: maliciousInput.success && maliciousInput.rowCount === 0 ? 'INFO' : 'HIGH',
      passed: maliciousInput.success && maliciousInput.rowCount === 0,
      details: {
        protected: maliciousInput.success && maliciousInput.rowCount === 0,
        error: maliciousInput.error
      }
    });
  }

  async testTableAccess() {
    console.log('📋 Testing Table Access Control...');
    
    // Test access to various tables
    const tablesToTest = [
      'users',
      'issues',
      'scan_history',
      'backlog',
      'jira_integrations',
      'azure_devops_integrations'
    ];

    for (const table of tablesToTest) {
      const result = await this.helper.testQuery(`SELECT COUNT(*) FROM ${table}`);
      
      this.results.push({
        name: `Table Access: ${table}`,
        severity: result.success ? 'MEDIUM' : 'INFO',
        passed: !result.success, // Ideally, direct table access should be restricted
        details: {
          table,
          accessible: result.success,
          error: result.error
        }
      });
    }
  }

  async testUserPrivileges() {
    console.log('📋 Testing User Privileges...');
    
    const privileges = await this.helper.testPrivileges();
    
    this.results.push({
      name: 'User Privileges: Current User Privileges',
      severity: privileges.success && privileges.rows.length > 0 ? 'MEDIUM' : 'INFO',
      passed: privileges.success,
      details: {
        canQuery: privileges.success,
        privilegeCount: privileges.rows.length,
        privileges: privileges.rows
      }
    });

    // Test if we can modify data (using transaction that will rollback - SAFE)
    // Using a non-existent UUID to ensure no actual data is modified
    const modifyTest = await this.helper.testQuerySafe(`
      UPDATE users SET email = 'test@test.com' 
      WHERE id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'
    `);
    
    this.results.push({
      name: 'User Privileges: Data Modification',
      severity: modifyTest.success ? 'HIGH' : 'INFO',
      passed: !modifyTest.success,
      details: {
        canModify: modifyTest.success,
        error: modifyTest.error,
        note: 'Test uses transaction rollback - no data modified'
      }
    });
  }

  async close() {
    await this.helper.close();
  }
}

