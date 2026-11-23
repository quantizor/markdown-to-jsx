import { defineConfig } from 'vite'

export default defineConfig({
  appType: 'spa',
  build: {
    emptyOutDir: true,
    outDir: '../dist-preact',
  },
  preview: {
    port: 4175,
    strictPort: true,
  },
  resolve: {
    alias: [
      { find: /^react$/, replacement: 'preact/compat' },
      { find: /^react-dom$/, replacement: 'preact/compat' },
      { find: /^react-dom\/client$/, replacement: 'preact/compat/client' },
      { find: /^react\/jsx-runtime$/, replacement: 'preact/jsx-runtime' },
      { find: /^react\/jsx-dev-runtime$/, replacement: 'preact/jsx-runtime' },
    ],
    dedupe: ['preact'],
  },
  root: 'preact',
  server: {
    open: false,
    port: 4176,
    strictPort: true,
  },
})
