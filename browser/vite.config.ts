import { defineConfig } from 'vite'

export default defineConfig({
  appType: 'spa',
  build: {
    outDir: 'dist',
  },
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
