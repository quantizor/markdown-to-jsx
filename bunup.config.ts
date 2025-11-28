import { defineConfig, BunupPlugin, DefineConfigItem } from 'bunup'
import { removeDebugPlugin } from './scripts/build-plugins'

const common = {
  define: {
    'process.env.NODE_ENV': '"production"',
    'globalThis.parseMetrics': 'false',
  },
  minify: true,
  plugins: [removeDebugPlugin() as unknown] as BunupPlugin[],
  sourcemap: 'linked',
  splitting: false,
} satisfies DefineConfigItem

export default defineConfig([
  // Main library build - ESM and CJS (includes index, react, html, markdown, and native entry points)
  {
    ...common,
    name: 'main',
    entry: ['src/index.tsx', 'src/react.tsx', 'src/html.ts', 'src/markdown.ts', 'src/native.tsx'],
    outDir: 'dist',
    format: ['esm', 'cjs'],
    dts: true,
    external: ['react', 'react-native'],
    target: 'node',
  },
])
