/**
 * Byte-equality self-check for the React, HTML, and markdown outputs.
 *
 * Compiles every bench corpus through each output (React via
 * renderToStaticMarkup), writing a golden file on first run (--save) or
 * diffing against it otherwise. Run in both dev (NODE_ENV unset) and prod
 * (NODE_ENV=production) modes; both must match the same golden bytes.
 *
 * Usage: bun scripts/emit-selfcheck.ts [--save]
 * (run from the repo root, as verify does)
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { renderToStaticMarkup } from 'react-dom/server'
import { compiler as html } from '../lib/src/html.ts'
import { compiler as markdown } from '../lib/src/markdown.ts'
import { compiler } from '../lib/src/react.tsx'

const root = path.join(import.meta.dirname, '..', 'lib')
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8')

const CORPORA = [
  { name: 'readme', text: read('README.md') },
  { name: 'md-spec', text: read('src/markdown-spec.md') },
  { name: 'stress', text: read('src/stress-test.generated.md') },
  { name: 'gfm-spec', text: read('src/gfm-spec.md') },
]

const OUTPUTS = {
  html: (text: string) => html(text),
  markdown: (text: string) => markdown(text),
  react: (text: string) => renderToStaticMarkup(compiler(text)),
} satisfies Record<string, (text: string) => string>

const goldenPath = path.join(root, 'src', '.emit-golden.json')
const save = process.argv.includes('--save')

// One entry per output and corpus, keyed `output:corpus`
const out: Record<string, string> = {}
for (const [output, render] of Object.entries(OUTPUTS)) {
  for (const c of CORPORA) {
    out[`${output}:${c.name}`] = render(c.text)
  }
}

if (save) {
  // Biome's JSON layout, so verify's format step does not rewrite a fresh save
  fs.writeFileSync(goldenPath, `${JSON.stringify(out, null, 2)}\n`)
  console.log(
    'saved golden:',
    Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length]))
  )
} else {
  const golden = JSON.parse(fs.readFileSync(goldenPath, 'utf8'))
  let ok = true
  for (const key of Object.keys(out)) {
    if (golden[key] !== out[key]) {
      ok = false
      console.log(
        'MISMATCH',
        key,
        'golden',
        golden[key]?.length ?? 'missing',
        'now',
        out[key].length
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
