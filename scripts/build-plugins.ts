import type { Plugin } from 'esbuild'
import type { BunPlugin } from 'bun'
import * as recast from 'recast'

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

function createDebugRemovalVisitor(namesToRemove: Set<string>) {
  let modified = false

  return {
    visitor: {
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
    },
    getModified: () => modified,
    resetModified: () => {
      modified = false
    },
  }
}

export function removeDebugCode(code: string, filePath: string): string {
  const namesToRemove = new Set(DEBUG_FUNCTION_NAMES)

  const ast = recast.parse(code, {
    parser: require('recast/parsers/typescript'),
  })

  const visitor = createDebugRemovalVisitor(namesToRemove)
  recast.visit(ast, visitor.visitor)

  if (visitor.getModified()) {
    return recast.print(ast).code
  }

  return code
}


export function removeDebugPlugin(): Plugin {
  return {
    name: 'remove-debug',
    setup(build) {
      build.onLoad({ filter: /parse\.ts$/ }, async args => {
        const fs = await import('fs')
        const code = await fs.promises.readFile(args.path, 'utf8')

        const modified = removeDebugCode(code, args.path)

        if (modified !== code) {
          return {
            contents: modified,
            loader: 'ts',
          }
        }

        return null
      })

      build.onLoad({ filter: /index\.tsx$/ }, async args => {
        const fs = await import('fs')
        const code = await fs.promises.readFile(args.path, 'utf8')

        const modified = removeDebugCode(code, args.path)

        if (modified !== code) {
          return {
            contents: modified,
            loader: 'tsx',
          }
        }

        return null
      })
    },
  }
}

export function removeDebugBunPlugin(): BunPlugin {
  return {
    name: 'remove-debug',
    setup(build) {
      build.onLoad({ filter: /parse\.ts$/ }, async (args) => {
        const code = await Bun.file(args.path).text()
        const modified = removeDebugCode(code, args.path)

        if (modified !== code) {
          return {
            contents: modified,
            loader: 'ts',
          }
        }

        return undefined
      })

      build.onLoad({ filter: /index\.tsx$/ }, async (args) => {
        const code = await Bun.file(args.path).text()
        const modified = removeDebugCode(code, args.path)

        if (modified !== code) {
          return {
            contents: modified,
            loader: 'tsx',
          }
        }

        return undefined
      })
    },
  }
}
