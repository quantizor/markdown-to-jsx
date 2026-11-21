import process from 'node:process'
import { defineConfig } from '@playwright/test'

/**
 * Two Vite modes, two builds, four ports. Production is `vite preview` of the
 * built harness bundle; development is `vite dev` serving src. React, Solid,
 * and Vue share one build (4173 preview, 4174 dev); Preact needs its own
 * because the react-to-preact/compat alias is global to a build (4175
 * preview, 4176 dev). The test title "preact renders ..." routes the Preact
 * test to the preact-* projects and keeps it out of the others.
 * Building is the caller's job (`bun run test:browser` builds lib and both
 * harness bundles first). All servers start via webServer[]; each project
 * pins baseURL so a reused local listener cannot silently swap modes.
 * The page exposes data-vite-mode from import.meta.env.DEV so each project
 * asserts it hit the intended mode before cases run.
 */
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
