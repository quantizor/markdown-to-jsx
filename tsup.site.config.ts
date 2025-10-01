import { defineConfig } from 'tsup'

const terserOptions = {
  mangle: {
    regex: '^_',
    reserved: ['__html'],
  },
  compress: {
    unsafe: true,
  },
}

export default defineConfig({
  entry: ['site.tsx'],
  format: 'iife',
  outDir: 'docs',
  minify: 'terser',
  terserOptions,
  outExtension: () => ({ js: '.js' }),
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  external: ['react', 'react-dom', 'katex'],
})
