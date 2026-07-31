#!/usr/bin/env bun
/**
 * ReDoS / adversarial parse smoke: each case must finish within BUDGET_MS.
 */
import fs from 'node:fs'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { parser } from '../lib/src/parse.ts'

const BUDGET_MS = 200
const root = path.join(import.meta.dirname, '..')

const cases: Array<{ name: string; input: string; budgetMs?: number }> = [
  { name: 'stars-8k', input: '*'.repeat(8000) },
  { name: 'underscores-8k', input: '_'.repeat(8000) },
  { name: 'unclosed-fence', input: `\`\`\`\n${'a'.repeat(4000)}` },
  { name: 'unclosed-emphasis', input: `*${'a'.repeat(4000)}` },
  {
    name: 'nested-html-200',
    input: `${'<div>'.repeat(200)}x${'</div>'.repeat(200)}`,
  },
  {
    name: 'gfm-spec',
    input: fs.readFileSync(path.join(root, 'lib/src/gfm-spec.md'), 'utf8'),
    // Large fixture: allow more headroom than micro adversarial cases.
    budgetMs: 2000,
  },
]

var failed = 0
for (const c of cases) {
  const budget = c.budgetMs ?? BUDGET_MS
  const t0 = performance.now()
  try {
    parser(c.input)
  } catch (err) {
    console.error(`FAIL ${c.name}: threw`, err)
    failed++
    continue
  }
  const elapsed = performance.now() - t0
  const ok = elapsed <= budget
  console.log(
    `${ok ? 'OK' : 'FAIL'} ${c.name}: ${elapsed.toFixed(2)}ms (budget ${budget}ms)`
  )
  if (!ok) {
    failed++
  }
}

if (failed > 0) {
  process.exit(1)
}
console.log('redos-smoke ok')
