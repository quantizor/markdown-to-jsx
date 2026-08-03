#!/usr/bin/env bun
/**
 * Scaling smoke: every adversarial shape must stay near-linear in input size.
 *
 * redos-smoke.ts answers "is this one payload fast enough right now", which a
 * quadratic passes whenever the chosen size is still cheap: a 4k run of `[^`
 * sat at 12ms against that 200ms budget while being fully quadratic, and the
 * footnote scanner shipped that way. This measures the growth exponent across
 * doubling inputs instead, so the shape of the work is what fails the gate,
 * not the size someone happened to pick.
 *
 * Add a case for every scanner reachable from the inline dispatch. A scanner
 * with no case here is a scanner nobody is watching.
 */
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { parser } from '../lib/src/parse.ts'

/**
 * Linear work lands near 1.0. The ceiling sits well above that so ordinary
 * variance cannot fail the gate, and well under the 2.0 a quadratic produces.
 */
const MAX_EXPONENT = 1.4
/**
 * A ratio is only as trustworthy as its smaller term: dividing by a 0.1ms
 * measurement turns timer jitter into a fake exponent. Each shape is grown
 * until its baseline clears this, so the gate judges a signal rather than
 * noise.
 */
const MIN_SIGNAL_MS = 1
const BASE = 4000
const MAX_BASE = 64_000

const shapes: Array<{ name: string; make: (n: number) => string }> = [
  { name: 'link-balanced', make: n => '['.repeat(n) + ']'.repeat(n) },
  { name: 'link-openers-one-close', make: n => `${'['.repeat(n)}]` },
  { name: 'link-openers-no-close', make: n => '['.repeat(n) },
  { name: 'link-escaped-close', make: n => '['.repeat(n) + '\\]'.repeat(n) },
  { name: 'image-openers', make: n => '!['.repeat(n) + ']'.repeat(n) },
  { name: 'link-dest-unclosed-paren', make: n => `[a](${'('.repeat(n)}` },
  { name: 'footnote-openers', make: n => '[^'.repeat(n) },
  { name: 'emphasis-star', make: n => '*'.repeat(n) },
  { name: 'emphasis-underscore', make: n => '_'.repeat(n) },
  { name: 'emphasis-alternating', make: n => '*a'.repeat(n) },
  { name: 'strikethrough', make: n => '~~'.repeat(n) },
  { name: 'marked', make: n => '=='.repeat(n) },
  { name: 'code-backticks', make: n => '`'.repeat(n) },
  { name: 'html-angle', make: n => '<'.repeat(n) },
  { name: 'html-partial-tag', make: n => '<a '.repeat(n) },
  { name: 'autolink-partial', make: n => '<http://'.repeat(n) },
  { name: 'entity-partial', make: n => '&am'.repeat(n) },
  { name: 'bare-url', make: n => 'http://'.repeat(n) },
  { name: 'bare-email', make: n => 'a@'.repeat(n) },
  {
    name: 'table-pipes',
    make: n => `|${'a|'.repeat(n)}\n|${'-|'.repeat(n)}`,
  },
]

function median(xs: number[]) {
  return [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
}

function time(input: string) {
  parser(input) // warm up so the first timed run is not measuring compilation
  const runs: number[] = []
  for (var i = 0; i < 3; i++) {
    const t0 = performance.now()
    parser(input)
    runs.push(performance.now() - t0)
  }
  return median(runs)
}

var failed = 0
for (const shape of shapes) {
  // Grow the baseline until it is worth dividing by. A quadratic shape clears
  // this immediately; a shape that stays cheap at MAX_BASE is linear enough
  // that no ratio taken here would mean anything.
  var base = BASE
  var small = time(shape.make(base))
  while (small < MIN_SIGNAL_MS && base < MAX_BASE) {
    base *= 2
    small = time(shape.make(base))
  }
  if (small < MIN_SIGNAL_MS) {
    console.log(
      `SKIP ${shape.name}: ${small.toFixed(2)}ms at n=${base}, below the noise floor to judge a ratio`
    )
    continue
  }
  const large = time(shape.make(base * 4))
  // Quadrupling the input costs 4x when linear and 16x when quadratic, so the
  // exponent is the log of the ratio over the two doublings between them.
  const exponent = Math.log2(Math.max(large, 0.01) / small) / 2
  const ok = exponent <= MAX_EXPONENT
  if (!ok) {
    failed++
  }
  console.log(
    `${ok ? 'OK' : 'FAIL'} ${shape.name}: ${small.toFixed(2)}ms (n=${base}) -> ${large.toFixed(2)}ms (n=${base * 4}), exponent ${exponent.toFixed(2)}, max ${MAX_EXPONENT}`
  )
}

if (failed > 0) {
  console.error(
    `scaling-smoke: ${failed} shape(s) grow faster than linear; a scanner is rescanning what an earlier pass already walked`
  )
  process.exit(1)
}
console.log('scaling-smoke ok')
