#!/usr/bin/env bun
/**
 * Scaling smoke: every adversarial shape must stay near-linear in input size.
 *
 * redos-smoke.ts answers "is this one payload fast enough right now", which a
 * quadratic passes whenever the chosen size is still cheap. This measures the
 * growth exponent between two input sizes instead, so the shape of the work
 * is what fails the gate, not the size someone happened to pick.
 *
 * Per shape: double the input from BASE until the faster of two timed parses
 * takes TARGET_MS (or the input reaches MAX_SIZE), call that size `large`,
 * then time `large` and `large / 4` alternately RUNS times each and keep each
 * size's fastest run.
 * The exponent is log4 of the ratio. A quadratic term with a small constant
 * hides under the linear cost at a small size and dominates at a large one,
 * so growing to a fixed time rather than to a bare noise floor is what makes
 * a weak quadratic visible. Alternating the two sizes means a stretch of CPU
 * contention slows both rather than only one. A shape still under
 * MIN_JUDGE_MS at MAX_SIZE is reported SKIP and passes: any quadratic term
 * that small is negligible at every document size the library meets.
 *
 * Add a case for every scanner reachable from the inline dispatch. A scanner
 * with no case here is a scanner nobody is watching.
 */
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { type ParserInputOptions, parser } from '../lib/src/parse.ts'

/**
 * Linear work lands near 1.0. The ceiling sits well above that so ordinary
 * variance cannot fail the gate, and well under the 2.0 a quadratic produces.
 */
const MAX_EXPONENT = 1.4
const TARGET_MS = 12
const MIN_JUDGE_MS = 2
/** Floor on the small-size time, so a timer reading of zero cannot divide the ratio. */
const MIN_SMALL_MS = 0.001
const BASE = 4000
const MAX_SIZE = 1 << 21
/**
 * Noise (a GC pause, a CPU frequency dip) only ever adds time, so the fastest
 * of several runs is the steadiest estimate of a shape's intrinsic cost.
 */
const RUNS = 7

const shapes: Array<{
  make: (n: number) => string
  name: string
  options?: ParserInputOptions
}> = [
  { make: n => '['.repeat(n) + ']'.repeat(n), name: 'link-balanced' },
  { make: n => `${'['.repeat(n)}]`, name: 'link-openers-one-close' },
  { make: n => '['.repeat(n), name: 'link-openers-no-close' },
  { make: n => '['.repeat(n) + '\\]'.repeat(n), name: 'link-escaped-close' },
  { make: n => '!['.repeat(n) + ']'.repeat(n), name: 'image-openers' },
  { make: n => `[a](${'('.repeat(n)}`, name: 'link-dest-unclosed-paren' },
  { make: n => '[^'.repeat(n), name: 'footnote-openers' },
  { make: n => '*'.repeat(n), name: 'emphasis-star' },
  { make: n => '_'.repeat(n), name: 'emphasis-underscore' },
  { make: n => '*a'.repeat(n), name: 'emphasis-alternating' },
  { make: n => '~~'.repeat(n), name: 'strikethrough' },
  { make: n => '=='.repeat(n), name: 'marked' },
  { make: n => '`'.repeat(n), name: 'code-backticks' },
  { make: n => '<'.repeat(n), name: 'html-angle' },
  { make: n => '<a '.repeat(n), name: 'html-partial-tag' },
  { make: n => '<http://'.repeat(n), name: 'autolink-partial' },
  { make: n => '&am'.repeat(n), name: 'entity-partial' },
  { make: n => 'http://'.repeat(n), name: 'bare-url' },
  { make: n => 'a@'.repeat(n), name: 'bare-email' },
  {
    make: n => `|${'a|'.repeat(n)}\n|${'-|'.repeat(n)}`,
    name: 'table-pipes',
  },
  // Streaming: incomplete-link stripping over unmatched openers
  {
    make: n => '[a '.repeat(n),
    name: 'streaming-link-openers',
    options: { optimizeForStreaming: true },
  },
  // Streaming: per-block edge marking plus held openers in every block
  {
    make: n => 'p *a _b\n\n'.repeat(n),
    name: 'streaming-held-openers',
    options: { optimizeForStreaming: true },
  },
]

function timeOnce(input: string, options?: ParserInputOptions): number {
  const t0 = performance.now()
  parser(input, options)
  return performance.now() - t0
}

/**
 * One measurement of a shape: grow to `targetMs`, then take the fastest of
 * `runs` alternating timings per size.
 */
function measure(
  shape: (typeof shapes)[number],
  targetMs: number,
  runs: number
) {
  // The first parse of a new input pays to flatten the string `make` built
  // (and, for the first size, to compile the parser), so each size is parsed
  // once untimed, and the faster of two timed parses decides whether to grow:
  // one slow run stopping the growth early leaves a weak quadratic too small
  // to see.
  var size = BASE
  var input = shape.make(size)
  parser(input, shape.options)
  while (
    Math.min(timeOnce(input, shape.options), timeOnce(input, shape.options)) <
      targetMs &&
    size < MAX_SIZE
  ) {
    size *= 2
    input = shape.make(size)
    parser(input, shape.options)
  }
  const largeInput = input
  const smallInput = shape.make(size / 4)
  var small = Number.POSITIVE_INFINITY
  var large = Number.POSITIVE_INFINITY
  for (var r = 0; r < runs; r++) {
    small = Math.min(small, timeOnce(smallInput, shape.options))
    large = Math.min(large, timeOnce(largeInput, shape.options))
  }
  // Quadrupling the input costs 4x when linear and 16x when quadratic, so the
  // exponent is the log of the ratio over the two doublings between them.
  return {
    exponent: Math.log2(large / Math.max(small, MIN_SMALL_MS)) / 2,
    large,
    sizes: `${small.toFixed(2)}ms (n=${size / 4}) -> ${large.toFixed(2)}ms (n=${size})`,
  }
}

var failed = 0
for (const shape of shapes) {
  const first = measure(shape, TARGET_MS, RUNS)
  if (first.large < MIN_JUDGE_MS) {
    console.log(
      `SKIP ${shape.name}: ${first.sizes}, too cheap to judge a ratio`
    )
    continue
  }
  if (first.exponent <= MAX_EXPONENT) {
    console.log(
      `OK ${shape.name}: ${first.sizes}, exponent ${first.exponent.toFixed(2)}, max ${MAX_EXPONENT}`
    )
    continue
  }
  // CPU contention only adds time and can land unevenly on the two sizes, so a
  // reading over the limit is re-measured with twice the budget and runs. A
  // real quadratic sits near 2.0 in both readings; contention rarely repeats.
  const confirm = measure(shape, TARGET_MS * 2, RUNS * 2)
  const readings = `first ${first.exponent.toFixed(2)}, confirm ${confirm.exponent.toFixed(2)}`
  if (confirm.exponent <= MAX_EXPONENT) {
    console.log(
      `OK* ${shape.name}: ${readings}, max ${MAX_EXPONENT}; ${confirm.sizes}`
    )
    continue
  }
  failed++
  console.log(
    `FAIL ${shape.name}: ${readings}, max ${MAX_EXPONENT}; first ${first.sizes}; confirm ${confirm.sizes}`
  )
}

if (failed > 0) {
  console.error(
    `scaling-smoke: ${failed} shape(s) grow faster than linear; a scanner is rescanning what an earlier pass already walked`
  )
  process.exit(1)
}
console.log('scaling-smoke ok')
