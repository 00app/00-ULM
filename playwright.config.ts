import { defineConfig, devices } from '@playwright/test'

const defaultBase = 'http://127.0.0.1:3000'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? defaultBase,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
      },
    },
    {
      // Safari's engine, for the Gravity Grid canvas only (needs `npx playwright install webkit`).
      name: 'webkit',
      testMatch: /gravity-grid\.spec\.ts/,
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: 'npm run dev:3000',
    url: defaultBase,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
