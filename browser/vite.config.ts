import { defineConfig } from 'vite'

export default defineConfig({
  appType: 'spa',
  build: {
    outDir: 'dist',
  },
  // Preview (production harness) and dev (HMR) share the machine; keep them
  // on distinct ports so Playwright can run both projects in one session.
  preview: {
    port: 4173,
    strictPort: true,
  },
  server: {
    open: false,
    port: 4174,
    strictPort: true,
  },
})
