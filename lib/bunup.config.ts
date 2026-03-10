import { defineConfig, type BunupPlugin, type DefineConfigItem } from 'bunup'
import { transformSync } from 'esbuild'
import { existsSync, readFileSync, writeFileSync } from 'fs'

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

function verifyDtsPlugin(): BunupPlugin {
  return {
    name: 'verify-dts',
    hooks: {
      onBuildDone({ files }) {
        var missing: string[] = []
        for (var file of files) {
          if (file.kind !== 'entry-point') continue
          if (!file.fullPath.endsWith('.js') && !file.fullPath.endsWith('.cjs'))
            continue

          var dtsPath = file.fullPath.replace(
            /\.(js|cjs)$/,
            function (_, ext) {
              return ext === 'cjs' ? '.d.cts' : '.d.ts'
            }
          )
          if (!existsSync(dtsPath)) missing.push(dtsPath)
        }
        if (missing.length > 0) {
          throw new Error(
            'Type declarations missing after build:\n  ' +
              missing.join('\n  ')
          )
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
  plugins: [manglePropsPlugin(), verifyDtsPlugin()],
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
  // Main library build - ESM and CJS
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
