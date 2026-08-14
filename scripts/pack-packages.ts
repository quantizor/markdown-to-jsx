/**
 * Assemble each published `@marqdown/*` package's dist from the single lib
 * build. lib/src is the one source home; lib/dist is its build output. Each
 * scoped package ships a slice of that output (its own entry plus the
 * browser-swappable entity table), with the externalized `marqdown/entities`
 * specifier rewritten to the package's own subpath so the shipped bundle has
 * zero cross-package `@marqdown` runtime dependencies.
 *
 * Usage: bun scripts/pack-packages.ts [dir...]   (default: every package)
 */
import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'

var ROOT = path.resolve(import.meta.dir, '..')
var LIB_DIST = path.join(ROOT, 'lib', 'dist')

/**
 * dir: workspace folder under packages/. scope: published package name. main:
 * the lib/dist entry basename that becomes this package's `.` export.
 */
var PACKAGES: Record<string, { main: string; scope: string }> = {
  html: { main: 'html', scope: '@marqdown/html' },
  markdown: { main: 'markdown', scope: '@marqdown/markdown' },
  native: { main: 'native', scope: '@marqdown/native' },
  parser: { main: 'parser', scope: '@marqdown/parser' },
  react: { main: 'react', scope: '@marqdown/react' },
  solid: { main: 'solid', scope: '@marqdown/solid' },
  vue: { main: 'vue', scope: '@marqdown/vue' },
}

// Files that carry code and may reference the entities specifier.
var CODE_EXT = ['.js', '.cjs', '.d.ts', '.d.cts']

function isCode(name: string): boolean {
  return CODE_EXT.some(ext => name.endsWith(ext))
}

/** Does this dist filename belong to the given package's slice? */
function belongs(name: string, main: string): boolean {
  return (
    name.startsWith(`${main}.`) ||
    name.startsWith('entities.generated.') ||
    name.startsWith('entities.browser.')
  )
}

function pack(dir: string): void {
  var entry = PACKAGES[dir]
  if (!entry) {
    throw new Error(
      `Unknown package "${dir}". Known: ${Object.keys(PACKAGES).join(', ')}`
    )
  }
  var destDir = path.join(ROOT, 'packages', dir, 'dist')
  rmSync(destDir, { force: true, recursive: true })
  mkdirSync(destDir, { recursive: true })

  var target = `${entry.scope}/entities`
  var copied = 0
  for (var name of readdirSync(LIB_DIST)) {
    if (!belongs(name, entry.main)) {
      continue
    }
    var from = path.join(LIB_DIST, name)
    var to = path.join(destDir, name)
    if (isCode(name)) {
      var code = readFileSync(from, 'utf-8')
      writeFileSync(to, code.split('marqdown/entities').join(target))
    } else {
      copyFileSync(from, to)
    }
    copied++
  }
  if (copied === 0) {
    throw new Error(
      `No dist files matched package "${dir}" in ${LIB_DIST}. Build lib first (bun run --filter marqdown build).`
    )
  }
  console.log(`packed ${entry.scope} (${copied} files)`)
}

var requested = process.argv.slice(2)
var dirs = requested.length > 0 ? requested : Object.keys(PACKAGES)
for (var d of dirs) {
  pack(d)
}
