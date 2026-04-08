import { defineConfig, type BunupPlugin, type DefineConfigItem } from 'bunup'
import { transformSync } from 'esbuild'
import { existsSync, readFileSync, writeFileSync } from 'fs'

// Property names that must survive mangling. React reads `_store`, `_owner`,
// `_debugStack`, `_debugTask` by literal name in dev/RSC builds and warns
// when they are missing. `__html` is the dangerouslySetInnerHTML payload key.
var RESERVED_PROPS = ['__html', '_store', '_owner', '_debugStack', '_debugTask']
var RESERVED_PROPS_PATTERN = new RegExp('\\b(?:' + RESERVED_PROPS.join('|') + ')\\b')

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
            reserveProps: RESERVED_PROPS_PATTERN,
            minifyWhitespace: true,
            minifySyntax: true,
          })
          writeFileSync(file.fullPath, result.code)
        }
      },
    },
  }
}

// Guard against the regression fixed in this commit: if the mangler ever
// strips a reserved field again, fail the build instead of shipping a
// broken dist.
function verifyReservedPropsPlugin(): BunupPlugin {
  return {
    name: 'verify-reserved-props',
    hooks: {
      onBuildDone({ files }) {
        var failures: string[] = []
        for (var file of files) {
          if (file.kind !== 'entry-point' && file.kind !== 'chunk') continue
          if (!file.fullPath.endsWith('react.js') && !file.fullPath.endsWith('react.cjs')) continue

          var code = readFileSync(file.fullPath, 'utf-8')
          for (var prop of RESERVED_PROPS) {
            if (prop === '__html') continue
            if (!new RegExp('\\b' + prop + '\\b').test(code)) {
              failures.push(file.fullPath + ' is missing reserved property ' + prop)
            }
          }
        }
        if (failures.length > 0) {
          throw new Error(
            'Reserved property names were mangled out of the published dist:\n  ' +
              failures.join('\n  ')
          )
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
  plugins: [manglePropsPlugin(), verifyReservedPropsPlugin(), verifyDtsPlugin()],
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
