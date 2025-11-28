// Configuration for k6 load tests
export const config = {
  // Base URL of the application
  baseUrl: process.env.APP_URL || 'http://localhost:3000',
  
  // Test credentials
  testUser: {
    email: process.env.TEST_USER_EMAIL || 'peter.kirby85@gmail.com',
    password: process.env.TEST_USER_PASSWORD || 'BeynacCastle2!',
    name: 'Test User'
  }
}
