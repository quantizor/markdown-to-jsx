import { defineConfig } from '@playwright/test'

/**
 * Two Vite modes, two ports. Production is `vite preview` of the built
 * harness bundle on 4173; development is `vite dev` serving src on 4174.
 * Building is the caller's job (`bun run test:browser` builds lib and the
 * harness bundle first). Both servers start via webServer[]; each project
 * pins baseURL so a reused local listener cannot silently swap modes.
 * The page exposes data-vite-mode from import.meta.env.DEV so each project
 * asserts it hit the intended mode before cases run.
 */
export default defineConfig({
  outputDir: 'test-results',
  projects: [
    {
      name: 'production',
      use: {
        baseURL: 'http://localhost:4173',
        browserName: 'chromium',
      },
    },
    {
      name: 'development',
      use: {
        baseURL: 'http://localhost:4174',
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
  ],
  workers: 1,
})
