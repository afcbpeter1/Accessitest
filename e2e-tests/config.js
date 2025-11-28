// Test configuration
export const config = {
  // Base URL
  baseUrl: process.env.APP_URL || 'http://localhost:3000',
  
  // Test credentials
  testUser: {
    email: process.env.TEST_USER_EMAIL || 'peter.kirby85@gmail.com',
    password: process.env.TEST_USER_PASSWORD || 'BeynacCastle2!',
    name: 'Test User'
  },
  
  // Test timeouts
  timeouts: {
    navigation: 30000,
    action: 10000,
    scan: 60000, // Scans can take longer
  }
};

