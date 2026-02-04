import { defineConfig, type BunupPlugin, type DefineConfigItem } from 'bunup'
import { transformSync } from 'esbuild'
import { readFileSync, writeFileSync } from 'fs'

function manglePropsPlugin(): BunupPlugin {
  return {
    name: 'mangle-props',
    hooks: {
      onBuildDone({ files }) {
        for (var file of files) {
          if (file.kind !== 'entry-point' && file.kind !== 'chunk') continue
          if (!file.fullPath.endsWith('.js') && !file.fullPath.endsWith('.cjs')) continue

          var code = readFileSync(file.fullPath, 'utf-8')
          var result = transformSync(code, {
            loader: 'js',
            mangleProps: /^_/,
            reserveProps: /__html/,
            minifyWhitespace: true,
            minifySyntax: true,
          })
          writeFileSync(file.fullPath, result.code)
        }
      },
    },
  }
}

var common = {
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  minify: true,
  plugins: [manglePropsPlugin()],
  sourcemap: 'linked',
  splitting: false,
} satisfies DefineConfigItem

export default defineConfig([
  // Entities modules - built separately for browser field swapping
  {
    ...common,
    name: 'entities',
    entry: ['src/entities.generated.ts', 'src/entities.browser.ts'],
    outDir: 'dist',
    format: ['esm', 'cjs'],
    dts: true,
    target: 'browser',
  },
  // Main library build - ESM and CJS (includes index, react, html, markdown, native, solid, and vue entry points)
  {
    ...common,
    name: 'main',
    entry: [
      'src/index.tsx',
      'src/react.tsx',
      'src/html.ts',
      'src/markdown.ts',
      'src/native.tsx',
      'src/solid.tsx',
      'src/vue.tsx',
    ],
    outDir: 'dist',
    format: ['esm', 'cjs'],
    dts: true,
    external: ['react', 'react-native', 'solid-js', 'solid-js/h', 'vue', 'markdown-to-jsx/entities'],
    target: 'browser',
  },
])
