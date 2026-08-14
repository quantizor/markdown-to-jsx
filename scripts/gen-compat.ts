/**
 * Generate the `markdown-to-jsx` compatibility shim's re-export stubs. The shim
 * lets existing `markdown-to-jsx` and `markdown-to-jsx/<subpath>` imports keep
 * resolving after the split by forwarding each subpath to its `@marqdown/*`
 * package. Derived from one row per subpath so the stubs cannot drift.
 *
 * Only the dist stubs are generated here. packages/compat/package.json is
 * committed and owns the version (changesets bumps it), so this script never
 * writes it. The two must agree on the subpath set; the resolution tests catch
 * any drift.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

var OUT = path.resolve(import.meta.dir, '..', 'packages', 'compat', 'dist')

/**
 * file: emitted stub basename (matches the exports map in package.json).
 * spec: the `@marqdown/*` specifier it forwards to.
 * hasDefault: whether the target exports a component default to re-export.
 */
var SUBPATHS = [
  { file: 'index', hasDefault: true, spec: '@marqdown/react' },
  { file: 'react', hasDefault: true, spec: '@marqdown/react' },
  { file: 'native', hasDefault: true, spec: '@marqdown/native' },
  { file: 'solid', hasDefault: true, spec: '@marqdown/solid' },
  { file: 'vue', hasDefault: true, spec: '@marqdown/vue' },
  { file: 'html', hasDefault: false, spec: '@marqdown/html' },
  { file: 'markdown', hasDefault: false, spec: '@marqdown/markdown' },
  { file: 'entities', hasDefault: false, spec: '@marqdown/parser/entities' },
]

function esm(spec: string, hasDefault: boolean): string {
  var out = `export * from '${spec}'\n`
  return hasDefault ? `${out}export { default } from '${spec}'\n` : out
}

function cjs(spec: string): string {
  return `module.exports = require('${spec}')\n`
}

rmSync(OUT, { force: true, recursive: true })
mkdirSync(OUT, { recursive: true })

for (var sp of SUBPATHS) {
  // .d.ts/.d.cts mirror the ESM form: `export *` forwards the target's types.
  var types = esm(sp.spec, sp.hasDefault)
  writeFileSync(path.join(OUT, `${sp.file}.js`), esm(sp.spec, sp.hasDefault))
  writeFileSync(path.join(OUT, `${sp.file}.cjs`), cjs(sp.spec))
  writeFileSync(path.join(OUT, `${sp.file}.d.ts`), types)
  writeFileSync(path.join(OUT, `${sp.file}.d.cts`), types)
}

console.log(
  `generated markdown-to-jsx compat stubs (${SUBPATHS.length} subpaths)`
)
