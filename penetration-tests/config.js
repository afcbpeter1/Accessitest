// Configuration for penetration tests
export const config = {
  // Base URL of the application
  baseUrl: process.env.APP_URL || 'http://localhost:3000',
  
  // Test credentials (create test accounts if needed)
  testUser: {
    email: process.env.TEST_USER_EMAIL || 'test@example.com',
    password: process.env.TEST_USER_PASSWORD || 'TestPassword123!',
    name: 'Test User'
  },
  
  // Admin credentials (if available)
  adminUser: {
    email: process.env.ADMIN_EMAIL || 'admin@example.com',
    password: process.env.ADMIN_PASSWORD || 'AdminPassword123!'
  },
  
  // Test timeout
  timeout: 30000,
  
  // Whether to run destructive tests
  runDestructiveTests: process.env.RUN_DESTRUCTIVE === 'true',
  
  // JWT secret for token manipulation tests (if known)
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production'
}

