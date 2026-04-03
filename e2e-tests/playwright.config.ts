import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000'

export default defineConfig({
  testDir: path.join(__dirname, 'tests'),
  timeout: 3 * 60 * 1000,
  expect: { timeout: 30_000 },
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  globalSetup: require.resolve('./tests/global-setup'),
  projects: [
    {
      name: 'kirby',
      use: {
        ...devices['Desktop Chrome'],
        storageState: path.join(__dirname, '.auth', 'kirby.json'),
      },
    },
    {
      name: 'jawb',
      use: {
        ...devices['Desktop Chrome'],
        storageState: path.join(__dirname, '.auth', 'jawb.json'),
      },
    },
  ],
})

