import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results.json' }],
    ['junit', { outputFile: 'junit.xml' }]
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },
  
  projects: [
    {
      name: 'Desktop Windows',
      use: { 
        ...devices['Desktop Chrome'], 
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    },
    {
      name: 'Desktop macOS',
      use: { 
        ...devices['Desktop Safari'],
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
      }
    },
    {
      name: 'Desktop Linux',
      use: { 
        ...devices['Desktop Firefox'],
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/91.0',
      }
    }
  ],
  
  webServer: [
    {
      command: 'cd backend && source venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000',
      port: 8000,
      timeout: 120 * 1000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'cd frontend && npm run dev',
      port: 3000,
      timeout: 120 * 1000,
      reuseExistingServer: !process.env.CI,
    }
  ],
});