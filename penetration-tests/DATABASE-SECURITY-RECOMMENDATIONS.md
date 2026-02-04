# Database Security Recommendations

## Current Situation

Your penetration tests revealed that the database user (`neondb_owner`) has full privileges, which is **expected** for a database owner account. However, for production, you should implement additional security measures.

## Critical Findings from Penetration Tests

### 1. **CRITICAL**: Password Hash Access
- **Finding**: Can query `user_passwords` table directly
- **Risk**: If database is compromised, password hashes could be accessed
- **Mitigation**: ✅ Password hashes are already bcrypt hashed (good!)
- **Recommendation**: Use Row-Level Security (RLS) to restrict access

### 2. **HIGH**: System Table Access
- **Finding**: Can access `pg_user`, `pg_shadow`, `pg_roles`, etc.
- **Risk**: Information disclosure about database structure
- **Recommendation**: Create limited-privilege user for application

### 3. **HIGH**: Table Creation/Modification
- **Finding**: Can CREATE/DROP tables
- **Risk**: Database schema could be modified
- **Recommendation**: Use read-write user without DDL privileges

### 4. **HIGH**: Direct Table Access
- **Finding**: Can directly query sensitive tables
- **Risk**: Bypass application-level security
- **Recommendation**: Use RLS policies and limited-privilege user

## Recommended Production Setup

### Step 1: Create Application Database User

```sql
-- Create a dedicated user for the application
CREATE USER app_user WITH PASSWORD 'your_strong_password_here';

-- Grant connection to database
GRANT CONNECT ON DATABASE neondb TO app_user;

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO app_user;

-- Grant table permissions (read-write for application needs)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;

-- Grant sequence permissions (for auto-increment IDs)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Grant permissions on future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;

-- Revoke dangerous privileges
REVOKE CREATE ON SCHEMA public FROM app_user;
REVOKE ALL ON DATABASE neondb FROM app_user;
```

### Step 2: Implement Row-Level Security (RLS)

```sql
-- Enable RLS on sensitive tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_passwords ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE jira_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE azure_devops_integrations ENABLE ROW LEVEL SECURITY;

-- Create policies for users table
CREATE POLICY users_isolation ON users
  FOR ALL
  USING (id = current_setting('app.user_id', true)::uuid);

-- Create policies for user_passwords
CREATE POLICY user_passwords_isolation ON user_passwords
  FOR ALL
  USING (user_id = current_setting('app.user_id', true)::uuid);

-- Create policies for issues
CREATE POLICY issues_isolation ON issues
  FOR ALL
  USING (user_id = current_setting('app.user_id', true)::uuid);

-- Similar policies for other user-specific tables...
```

### Step 3: Update Application Connection

Update your `DATABASE_URL` environment variable to use the new `app_user` instead of `neondb_owner`:

```env
DATABASE_URL=postgresql://app_user:password@host:port/neondb?sslmode=require
```

### Step 4: Set User Context in Application

When making database queries, set the user context:

```typescript
// In your database helper
export async function query(text: string, params?: any[], userId?: string) {
  const client = await pool.connect()
  try {
    if (userId) {
      await client.query(`SET app.user_id = $1`, [userId])
    }
    const result = await client.query(text, params)
    return result
  } finally {
    if (userId) {
      await client.query('RESET app.user_id')
    }
    client.release()
  }
}
```

## Additional Security Measures

### 1. Connection Pooling
- ✅ Already using connection pooling (good!)
- Consider limiting max connections per user

### 2. Query Logging
- Log all database queries in production
- Monitor for suspicious patterns
- Alert on unusual access patterns

### 3. Regular Security Audits
- Run penetration tests regularly
- Review database access logs
- Monitor for privilege escalation attempts

### 4. Backup Security
- Encrypt database backups
- Store backups securely
- Test backup restoration regularly

## Current Status

✅ **Application-level security**: FIXED
- All endpoints now require authentication
- IDOR protection implemented
- User-based data filtering active

⚠️ **Database-level security**: Needs production setup
- Currently using database owner (expected for development)
- Should create limited-privilege user for production
- Should implement RLS policies

## Testing

After implementing these changes:

1. Test with new database user
2. Verify RLS policies work correctly
3. Re-run penetration tests
4. Verify all application functionality still works

## Migration Path

1. **Development**: Keep using `neondb_owner` (current setup)
2. **Staging**: Create `app_user` and test with limited privileges
3. **Production**: Use `app_user` with RLS policies enabled

This allows you to test security improvements before deploying to production.









