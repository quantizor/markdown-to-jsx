import process from 'node:process'
import { defineConfig } from '@playwright/test'

export default defineConfig({
  outputDir: 'test-results',
  projects: [
    {
      grepInvert: /preact renders every case/,
      name: 'production',
      use: {
        baseURL: 'http://localhost:4173',
        browserName: 'chromium',
      },
    },
    {
      grepInvert: /preact renders every case/,
      name: 'development',
      use: {
        baseURL: 'http://localhost:4174',
        browserName: 'chromium',
      },
    },
    {
      grep: /preact renders every case/,
      name: 'preact-production',
      use: {
        baseURL: 'http://localhost:4175',
        browserName: 'chromium',
      },
    },
    {
      grep: /preact renders every case/,
      name: 'preact-development',
      use: {
        baseURL: 'http://localhost:4176',
        browserName: 'chromium',
      },
    },
  ],
  reporter: process.env.CI ? 'github' : 'list',
  retries: 0,
  testDir: './tests',
  use: {
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'bun run preview',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      url: 'http://localhost:4173',
    },
    {
      command: 'bun run dev',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      url: 'http://localhost:4174',
    },
    {
      command: 'bun run preview:preact',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      url: 'http://localhost:4175',
    },
    {
      command: 'bun run dev:preact',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      url: 'http://localhost:4176',
    },
  ],
  workers: 1,
})
