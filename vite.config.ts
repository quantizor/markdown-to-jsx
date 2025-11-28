import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import * as recast from 'recast'
import { createRequire } from 'module'
import tailwindcss from '@tailwindcss/vite'
import packageJson from './package.json'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const require = createRequire(import.meta.url)

const DEBUG_FUNCTION_NAMES = [
  'debug',
  'ensureParser',
  'initializeParseMetrics',
  'trackAttempt',
  'trackBlockAttempt',
  'trackBlockHit',
  'trackBlockParseIteration',
  'trackHit',
  'trackOperation',
]

function removeDebugCode(code: string): string {
  const namesToRemove = new Set(DEBUG_FUNCTION_NAMES)
  let modified = false

  const ast = recast.parse(code, {
    parser: require('recast/parsers/typescript'),
  })

  const visitor = {
    visitExpressionStatement(path: any) {
      const node = path.node
      if (node.expression) {
        const expr = node.expression
        if (
          expr.type === 'CallExpression' &&
          expr.callee &&
          expr.callee.type === 'Identifier' &&
          namesToRemove.has(expr.callee.name)
        ) {
          path.prune()
          modified = true
          return false
        }
      }
      this.traverse(path)
    },

    visitSequenceExpression(path: any) {
      const node = path.node
      const expressions = node.expressions || []
      if (expressions.length >= 2) {
        const filtered = expressions.filter((expr: any) => {
          if (
            expr.type === 'CallExpression' &&
            expr.callee &&
            expr.callee.type === 'Identifier' &&
            namesToRemove.has(expr.callee.name)
          ) {
            modified = true
            return false
          }
          return true
        })

        if (filtered.length !== expressions.length) {
          if (filtered.length === 1) {
            path.replace(filtered[0])
          } else if (filtered.length > 1) {
            path.replace({
              type: 'SequenceExpression',
              expressions: filtered,
            })
          } else {
            path.prune()
          }
          modified = true
        }
      }
      this.traverse(path)
    },

    visitFunctionDeclaration(path: any) {
      const node = path.node
      if (
        node.id &&
        node.id.type === 'Identifier' &&
        namesToRemove.has(node.id.name)
      ) {
        path.prune()
        modified = true
        return false
      }
      this.traverse(path)
    },
  }

  recast.visit(ast, visitor)

  if (modified) {
    return recast.print(ast).code
  }

  return code
}

function removeDebugVitePlugin(): Plugin {
  return {
    name: 'remove-debug',
    enforce: 'pre',
    transform(code, id) {
      if (
        id.includes('/parse.ts') ||
        id.includes('/index.tsx') ||
        id.includes('\\parse.ts') ||
        id.includes('\\index.tsx')
      ) {
        try {
          const modified = removeDebugCode(code)
          if (modified !== code) {
            return {
              code: modified,
              map: null,
            }
          }
        } catch (error) {
          console.warn(`Failed to remove debug code from ${id}:`, error)
        }
      }
      return null
    },
  }
}

function copyLlmsTxtPlugin(): Plugin {
  return {
    name: 'copy-llms-txt',
    closeBundle() {
      var readmePath = join(process.cwd(), 'README.md')
      var outputPath = join(process.cwd(), 'docs', 'llms.txt')
      var readmeContent = readFileSync(readmePath, 'utf-8')
      writeFileSync(outputPath, readmeContent, 'utf-8')
    },
  }
}

export default defineConfig({
  appType: 'spa',
  plugins: [
    react({
      // Exclude the file that uses custom classic JSX
      exclude: /\/react\.tsx$/,
    }),
    tailwindcss(),
    removeDebugVitePlugin(),
    copyLlmsTxtPlugin(),
  ],
  define: {
    VERSION: JSON.stringify(packageJson.version.split('.')[0]),
  },
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'docs',
    emptyOutDir: false,
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
    },
    copyPublicDir: true,
  },
  server: {
    allowedHosts: ['dev.local'],
    port: 3000,
    open: false,
    fs: {
      allow: ['..'],
    },
  },
})
