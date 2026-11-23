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

const out: Record<string, string> = {}
for (const [output, render] of Object.entries(OUTPUTS)) {
  for (const c of CORPORA) {
    out[`${output}:${c.name}`] = render(c.text)
  }
}

if (save) {
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
