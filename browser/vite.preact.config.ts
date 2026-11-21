import { defineConfig } from 'vite'

/**
 * Preact build of the harness. A Vite alias is global to a build, so Preact
 * gets its own config, HTML entry (preact/index.html), and outDir rather than
 * sharing vite.config.ts with real React. Ports 4175 (preview, production)
 * and 4176 (dev) sit beside the 4173/4174 pair in vite.config.ts.
 */
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
