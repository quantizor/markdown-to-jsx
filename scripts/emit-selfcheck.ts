/**
 * renderToStaticMarkup byte-equality self-check for the React emit path.
 *
 * Compiles every bench corpus through compiler() and renderToStaticMarkup,
 * writing a golden file on first run (--save) or diffing against it otherwise.
 * Run in both dev (NODE_ENV unset) and prod (NODE_ENV=production) modes; both
 * must match the same golden bytes.
 *
 * Usage: bun scripts/emit-selfcheck.ts [--save]
 * (run from lib/ so react-dom resolves)
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { renderToStaticMarkup } from 'react-dom/server'
import { compiler } from '../lib/src/react.tsx'

const root = path.join(import.meta.dirname, '..', 'lib')
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8')

const CORPORA = [
  { name: 'readme', text: read('README.md') },
  { name: 'md-spec', text: read('src/markdown-spec.md') },
  { name: 'stress', text: read('src/stress-test.generated.md') },
  { name: 'gfm-spec', text: read('src/gfm-spec.md') },
]

const goldenPath = path.join(root, 'src', '.emit-golden.json')
const save = process.argv.includes('--save')

const out: Record<string, string> = {}
for (const c of CORPORA) {
  out[c.name] = renderToStaticMarkup(compiler(c.text) as any)
}

if (save) {
  fs.writeFileSync(goldenPath, JSON.stringify(out))
  console.log(
    'saved golden:',
    Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length]))
  )
} else {
  const golden = JSON.parse(fs.readFileSync(goldenPath, 'utf8'))
  let ok = true
  for (const c of CORPORA) {
    if (golden[c.name] !== out[c.name]) {
      ok = false
      console.log(
        'MISMATCH',
        c.name,
        'golden',
        golden[c.name].length,
        'now',
        out[c.name].length
      )
    }
  }
  console.log(
    ok
      ? `OK byte-identical NODE_ENV=${process.env.NODE_ENV || '(unset)'}`
      : 'FAIL'
  )
  if (!ok) {
    process.exit(1)
  }
}
