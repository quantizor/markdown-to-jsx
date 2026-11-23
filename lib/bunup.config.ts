import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { type BunupPlugin, type DefineConfigItem, defineConfig } from 'bunup'
import { transformSync } from 'esbuild'

var RESERVED_PROPS = ['__html', '_store', '_owner', '_debugStack', '_debugTask']
var RESERVED_PROPS_PATTERN = new RegExp(`\\b(?:${RESERVED_PROPS.join('|')})\\b`)

function manglePropsPlugin(): BunupPlugin {
  return {
    name: 'mangle-props',
    hooks: {
      onBuildDone({ files }) {
        for (var file of files) {
          if (file.kind !== 'entry-point' && file.kind !== 'chunk') {
            continue
          }
          if (
            !(file.fullPath.endsWith('.js') || file.fullPath.endsWith('.cjs'))
          ) {
            continue
          }

          var code = readFileSync(file.fullPath, 'utf-8')
          code = code
            .replace(
              /(?<![.\w$])[A-Za-z_$][\w$]*(?:\.default)?\.env\.NODE_ENV\s*!==\s*["']production["']/g,
              '!1'
            )
            .replace(
              /(?<![.\w$])[A-Za-z_$][\w$]*(?:\.default)?\.env\.NODE_ENV\s*===\s*["']production["']/g,
              '!0'
            )
          var result = transformSync(code, {
            define: {
              'process.env.NODE_ENV': '"production"',
            },
            loader: 'js',
            mangleProps: /^_/,
            minifySyntax: true,
            minifyWhitespace: true,
            reserveProps: RESERVED_PROPS_PATTERN,
          })
          writeFileSync(file.fullPath, result.code)
        }
      },
    },
  }
}

function verifyReservedPropsPlugin(): BunupPlugin {
  return {
    name: 'verify-reserved-props',
    hooks: {
      onBuildDone({ files }) {
        var failures: string[] = []
        for (var file of files) {
          if (file.kind !== 'entry-point' && file.kind !== 'chunk') {
            continue
          }
          if (
            !(
              file.fullPath.endsWith('react.js') ||
              file.fullPath.endsWith('react.cjs')
            )
          ) {
            continue
          }

          var code = readFileSync(file.fullPath, 'utf-8')
          for (var prop of RESERVED_PROPS) {
            if (prop === '__html') {
              continue
            }
            if (!new RegExp(`\\b${prop}\\b`).test(code)) {
              failures.push(
                `${file.fullPath} is missing reserved property ${prop}`
              )
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
          if (file.kind !== 'entry-point') {
            continue
          }
          if (
            !(file.fullPath.endsWith('.js') || file.fullPath.endsWith('.cjs'))
          ) {
            continue
          }

          var dtsPath = file.fullPath.replace(/\.(js|cjs)$/, (_, ext) =>
            ext === 'cjs' ? '.d.cts' : '.d.ts'
          )
          if (!existsSync(dtsPath)) {
            missing.push(dtsPath)
          }
        }
        if (missing.length > 0) {
          throw new Error(
            `Type declarations missing after build:\n  ${missing.join('\n  ')}`
          )
        }
      },
    },
  }
}

function verifyNoJsxAttrLeakPlugin(): BunupPlugin {
  return {
    name: 'verify-no-jsx-attr-leak',
    hooks: {
      onBuildDone({ files }) {
        var failures: string[] = []
        for (var file of files) {
          if (file.kind !== 'entry-point' && file.kind !== 'chunk') {
            continue
          }
          if (
            !(
              file.fullPath.endsWith('markdown.js') ||
              file.fullPath.endsWith('markdown.cjs')
            )
          ) {
            continue
          }
          var code = readFileSync(file.fullPath, 'utf-8')
          if (code.indexOf('allowTransparency') !== -1) {
            failures.push(file.fullPath)
          }
        }
        if (failures.length > 0) {
          throw new Error(
            'JSX attr map leaked into markdown bundle (multi-entry tree-shake regression):\n  ' +
              failures.join('\n  ')
          )
        }
      },
    },
  }
}

var common = {
  clean: false,
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  dts: true,
  format: ['esm', 'cjs'] as ('esm' | 'cjs')[],
  minify: true,
  outDir: 'dist',
  plugins: [
    manglePropsPlugin(),
    verifyReservedPropsPlugin(),
    verifyDtsPlugin(),
    verifyNoJsxAttrLeakPlugin(),
  ],
  sourcemap: 'linked' as const,
  splitting: false,
  target: 'browser' as const,
} satisfies DefineConfigItem

var compiler = {
  ...common,
  external: [
    'react',
    'react-native',
    'solid-js',
    'solid-js/h',
    'vue',
    'markdown-to-jsx/entities',
  ],
} satisfies DefineConfigItem

export default defineConfig([
  {
    ...common,
    name: 'entities',
    entry: ['src/entities.generated.ts', 'src/entities.browser.ts'],
  },
  { ...compiler, name: 'index', entry: 'src/index.tsx' },
  { ...compiler, name: 'react', entry: 'src/react.tsx' },
  { ...compiler, name: 'html', entry: 'src/html.ts' },
  { ...compiler, name: 'markdown', entry: 'src/markdown.ts' },
  { ...compiler, name: 'native', entry: 'src/native.tsx' },
  { ...compiler, name: 'solid', entry: 'src/solid.tsx' },
  { ...compiler, name: 'vue', entry: 'src/vue.tsx' },
])
