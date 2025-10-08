import { defineConfig, Options } from 'tsup'

const terserOptions = {
  mangle: {
    properties: {
      regex: '^_',
      reserved: ['__html'],
    },
  },
  compress: {
    unsafe: true,
  },
}

const sharedConfig: Options = {
  outDir: 'dist',
  minify: 'terser' as const,
  target: 'es5',
  terserOptions,
  define: {
    'process.env.NODE_ENV': '"production"',
    'process.env.DEBUG': 'false',
  },
  dts: {
    entry: 'index.tsx',
  },
  external: ['react'],
  sourcemap: true,
}

export default defineConfig([
  // CJS build from index.cjs.tsx
  {
    ...sharedConfig,
    entry: { index: 'index.cjs.tsx' },
    format: 'cjs',
    dts: {
      entry: 'index.cjs.tsx',
    },
  },
  // UMD build from index.tsx
  {
    ...sharedConfig,
    entry: { 'index.umd': 'index.tsx' },
    format: 'iife',
    // minify: true,
    minify: false,
    terserOptions,
    outExtension: () => ({ js: '.js' }),
    globalName: 'MarkdownToJSX',
    dts: undefined,
  },
  // ES build from index.tsx
  {
    ...sharedConfig,
    entry: { 'index.module': 'index.tsx' },
    format: 'esm',
  },
  // Modern build from index.tsx
  {
    ...sharedConfig,
    entry: { 'index.modern': 'index.tsx' },
    format: 'esm',
    target: 'es2017',
  },
  // Debug build from index.tsx
  {
    ...sharedConfig,
    entry: { debug: 'index.tsx' },
    format: 'esm',
    define: {
      ...sharedConfig.define,
      'process.env.DEBUG': `"${process.env.DEBUG || '1'}"`,
    },
    outExtension: () => ({ js: '.mjs' }),
  },
])
