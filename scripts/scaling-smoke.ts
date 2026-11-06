#!/usr/bin/env bun
/**
 * Scaling smoke: every adversarial shape must stay near-linear in input size.
 *
 * redos-smoke.ts answers "is this one payload fast enough right now", which a
 * quadratic passes whenever the chosen size is still cheap. This measures the
 * growth exponent between two input sizes instead, so the shape of the work
 * is what fails the gate, not the size someone happened to pick.
 *
 * Per shape: double the input from BASE until the faster of two timed runs
 * (the parser, or the markdown compiler for a `compile` shape) takes TARGET_MS (or the input reaches MAX_SIZE), call that size `large`,
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
import { compiler as markdownCompiler } from '../lib/src/markdown.ts'
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

/** n units, each with its own tag name, so no two openers share a closer */
const distinctTags =
  (unit: (tag: string) => string, suffix = '') =>
  (n: number) =>
    Array.from({ length: n }, (_, i) => unit(i.toString(36))).join('') + suffix

const shapes: Array<{
  /** Run through the markdown compiler rather than only the parser */
  compile?: boolean
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
  // Issue #874: each `[](` once retried the bare-URL scan to end of input
  { make: n => '[]('.repeat(n), name: 'link-empty-dest-openers' },
  { make: n => '[^'.repeat(n), name: 'footnote-openers' },
  { make: n => '[^a]'.repeat(n), name: 'footnote-undefined-refs' },
  { make: n => '[^a]('.repeat(n), name: 'footnote-undefined-dest-openers' },
  { make: n => `${'[^'.repeat(n)}]`, name: 'footnote-openers-one-close' },
  { make: n => `${'[^a '.repeat(n)}]`, name: 'footnote-words-one-close' },
  { make: n => `${'[^'.repeat(n)}\nx`, name: 'footnote-openers-line-end' },
  { make: n => '*'.repeat(n), name: 'emphasis-star' },
  { make: n => '_'.repeat(n), name: 'emphasis-underscore' },
  { make: n => '*a'.repeat(n), name: 'emphasis-alternating' },
  { make: n => '~~'.repeat(n), name: 'strikethrough' },
  { make: n => '=='.repeat(n), name: 'marked' },
  { make: n => '`'.repeat(n), name: 'code-backticks' },
  { make: n => '<'.repeat(n), name: 'html-angle' },
  { make: n => '<a '.repeat(n), name: 'html-partial-tag' },
  { make: n => '[<b>] '.repeat(n), name: 'link-tag-no-closer' },
  { make: n => `${'[<b>] '.repeat(n)}</b>`, name: 'link-tag-one-closer' },
  { make: distinctTags(t => `[<x${t}>] `), name: 'link-tag-distinct-names' },
  {
    make: distinctTags(t => `<x${t}>[<y>](/u)`),
    name: 'html-tag-distinct-names-link-holds-tag',
  },
  { make: distinctTags(t => `<x${t}> `), name: 'html-tag-distinct-names' },
  {
    make: distinctTags(t => `<x${t}> `, '</z>'),
    name: 'html-tag-distinct-names-other-closer',
  },
  { make: n => `<i>${'</a'.repeat(n)}`, name: 'html-closers-unended' },
  { make: n => `${'[<a '.repeat(n)}\n]`, name: 'link-tag-unended' },
  { make: n => '[</a '.repeat(n), name: 'link-closer-unended' },
  { make: n => `${'[<!-- '.repeat(n)}]`, name: 'link-comment-unended' },
  { make: n => '<http://'.repeat(n), name: 'autolink-partial' },
  { make: n => '&am'.repeat(n), name: 'entity-partial' },
  { make: n => 'http://'.repeat(n), name: 'bare-url' },
  { make: n => 'a@'.repeat(n), name: 'bare-email' },
  { make: n => 'a'.repeat(n), name: 'plain-text' },
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
  // The raw HTML screen: a browser's read of a tag the parser rejects or reads
  // differently, first at block level, where the screen sees one long string
  { make: n => `<div>\n${'<a x="'.repeat(n)}`, name: 'screen-quote-run' },
  {
    make: n => `<div>\n${'<a x="'.repeat(n)}>`,
    name: 'screen-quote-run-closed',
  },
  {
    make: n => `<div>\n${`<a x="<b y='`.repeat(n)}`,
    name: 'screen-mixed-quotes',
  },
  {
    make: n => `<div>\n${`<a x="<b y='`.repeat(n)}>`,
    name: 'screen-mixed-quotes-closed',
  },
  {
    make: n => `<div>\n<a x="${'<b '.repeat(n)}">`,
    name: 'screen-hidden-tags',
  },
  {
    make: n => `<div>\n<a x="${'<b <c >'.repeat(n)}">`,
    name: 'screen-hidden-tags-closing',
  },
  { make: n => `<div>\n${'<a b c '.repeat(n)}`, name: 'screen-open-tag-run' },
  {
    make: n => `<div>\n${'<!-- <a x="'.repeat(n)}`,
    name: 'screen-comment-run',
  },
  { make: n => `<!-- ${'<a x="'.repeat(n)} -->`, name: 'screen-in-comment' },
  { make: n => `<?${'<a x="'.repeat(n)}?>`, name: 'screen-in-instruction' },
  { make: n => `<iframe>${'<a x="'.repeat(n)}`, name: 'screen-filtered-body' },
  // A parsed tag that a browser reads differently, inline, where each tag is
  // parsed on its own. Each is closed, since a run of unclosed inline tags is
  // its own cost, whatever the tag holds
  { make: n => `x ${'<a b={c d}>y</a>'.repeat(n)}`, name: 'screen-brace-tags' },
  {
    make: n => `x ${'<a b={c>d}>y</a>'.repeat(n)}`,
    name: 'screen-brace-gt-tags',
  },
  {
    make: n => `x ${'<a b={c><d>}>y</a>'.repeat(n)}`,
    name: 'screen-brace-hidden-tags',
  },
  {
    make: n => `x <a b={c${'><d'.repeat(n)}}>y</a>`,
    name: 'screen-brace-hidden-tag-run',
  },
  {
    make: n => `x ${'<a b={ c="}>y</a>'.repeat(n)}`,
    name: 'screen-brace-quote-tags',
  },
  {
    make: n => `x ${'<a b={ c="}>"</a>'.repeat(n)}`,
    name: 'screen-brace-quote-chain',
  },
  {
    make: n => `x ${'<a b="<c>">y</a>'.repeat(n)}`,
    name: 'screen-quoted-tag-tags',
  },
  {
    make: n => `\`\`\`x ${'a="b" '.repeat(n)}\ny\n\`\`\``,
    name: 'fence-attrs',
  },
  {
    make: n => `<div>\n${'<section>\n</section>\n'.repeat(n)}`,
    name: 'html-body-nested-blocks',
  },
  {
    make: n => `<div>\n${'<section>\n<b>x</b>\n</section>\n'.repeat(n)}`,
    name: 'html-body-nested-block-bodies',
  },
  {
    make: n => `<Foo>\n${'<section>\n</section>\n'.repeat(n)}\n</Foo>`,
    name: 'component-body-nested-blocks',
  },
  {
    make: n =>
      `<Foo>\n${'<section>\n<b>x</b>\n</section>\n'.repeat(n)}\n</Foo>`,
    name: 'component-body-nested-block-bodies',
  },
  // Deeply nested same-tag openers. `n >> 4` repeats, so n stays the input
  // size: a closer search per opener costs too much to start at a repeat of BASE
  ...[
    ['<div>\n\n', '</div>\n\n', 'blank'],
    ['<div>\n\n', '', 'blank-unclosed'],
    ['<div>\n', '</div>\n', 'newline'],
  ].map(([opener, closer, name]) => ({
    make: (n: number) => opener.repeat(n >> 4) + closer.repeat(n >> 4),
    name: `html-nested-openers-${name}`,
  })),
  // A closer search per opener: no closer at all, one past a Type 1 tag (a near
  // tag, a far one all openers share, or one inside an attribute), and the
  // cursors and verdicts a nested string must not cost the outer one
  ...[
    ['<div>\nx\n\n', 'opener-text-blank'],
    ['<Foo>\nx\n\n', 'component-text-blank'],
    ['<div>\nx\n\n<pre>\n</pre>\n\n', 'opener-near-pre', '</div>\n'],
    ['<div>\nx\n\n', 'opener-far-pre', '</div>\n', '<pre></pre>\n\n'],
    [
      '<div>\nx\n\ny <b>z\n\n',
      'opener-far-pre-unclosed-between',
      '</div>\n',
      '<pre></pre>\n\n',
    ],
    ['<div title="</div><pre>">\nx\n\n', 'opener-pre-in-attribute'],
    ['<pre></pre>\n', 'type1-run'],
    [
      '<section>\nx\n\n<div>\ny\n\nz\n</div>\n</section>\n',
      'nested-closed-far-pre',
      '',
      '<pre></pre>\n',
    ],
    ['<div>\nx\n\n<section>\ny\n\n<p>\nq\n\n</section>\n', 'nested-unclosed'],
    // A blockquote or list parses its own string without going through an HTML body
    ['<div>\nx\n\n> <div>\n> y\n\n', 'blockquote-between'],
    ['<div>\nx\n\n- <div>\n  y\n\n', 'list-between'],
  ].map(([unit, name, closer = '', middle = '']) => ({
    make: (n: number) => unit.repeat(n >> 4) + middle + closer.repeat(n >> 4),
    name: `html-closer-search-${name}`,
  })),
  { make: n => `x ${'<b>a'.repeat(n)}`, name: 'inline-openers-unclosed' },
  // Link text walks over a comment opener whose terminator never comes
  { make: n => `[ ${'<!-- '.repeat(n)}]`, name: 'link-text-comment-openers' },
  {
    make: n => '[a<!-- b](/u) '.repeat(n),
    name: 'links-holding-comment-openers',
  },
  // An inline opener of raw markup whose terminator never comes
  ...[
    ['<!-- ', 'comment'],
    ['<? ', 'instruction'],
    ['<![CDATA[ ', 'cdata'],
    ['<!A ', 'declaration'],
  ].map(([unit, name]) => ({
    make: (n: number) => `x ${unit.repeat(n)}`,
    name: `inline-unterminated-${name}`,
  })),
  // A nested inline parse fails on the same terminator between the outer openers
  {
    make: n => `x ${'<? [<? a](/u) '.repeat(n)}`,
    name: 'inline-unterminated-instruction-in-link',
  },
  // The markdown output's raw-string screens
  {
    compile: true,
    make: n => '<![CDATA[a]]]>'.repeat(n),
    name: 'markdown-raw-cdata-odd-ends',
  },
  {
    compile: true,
    make: n => `<![CDATA[${']'.repeat(n)}>`,
    name: 'markdown-raw-cdata-bracket-run',
  },
  {
    compile: true,
    make: n => `${'<![CDATA['.repeat(n)}]]]>`,
    name: 'markdown-raw-cdata-shared-end',
  },
  {
    compile: true,
    make: n => `<!-- x -->${'<pre>'.repeat(n)}`,
    name: 'markdown-raw-mode-openers',
  },
  {
    compile: true,
    make: n => `<!-- x -->${'<!--'.repeat(n)}`,
    name: 'markdown-raw-comment-openers',
  },
  {
    compile: true,
    make: n => `${'<?p ?>'.repeat(n)}\`\`\`\n`,
    name: 'markdown-raw-markup-chain',
  },
  {
    compile: true,
    make: n => `<?p ?>${'<?p '.repeat(n)}`,
    name: 'markdown-raw-markup-chain-unended',
  },
  {
    compile: true,
    make: n => `<?e>${'<a '.repeat(n)}?>`,
    name: 'markdown-raw-markup-body-tags',
  },
  {
    compile: true,
    make: n => `<div>${'<?'.repeat(n)}</div>`,
    name: 'markdown-raw-markup-bodies-unended',
  },
  {
    compile: true,
    make: n => `<div>\n\n${'<?\n'.repeat(n)}</div>`,
    name: 'markdown-raw-openers-past-blank-line',
  },
  {
    compile: true,
    make: n => `${'&a'.repeat(n)};`,
    name: 'markdown-text-entity-shape',
  },
  {
    compile: true,
    make: n => `<div>${'<?><a ?>'.repeat(n)}</div>`,
    name: 'markdown-raw-markup-bodies-many',
  },
  {
    compile: true,
    make: n => `<div>${'<![cdata[><a ]]>'.repeat(n)}</div>`,
    name: 'markdown-raw-markup-bodies-cdata',
  },
  {
    compile: true,
    make: n => `[l](${'&#106'.repeat(n)})`,
    name: 'markdown-numeric-references',
  },
  {
    compile: true,
    make: n => `<div>\n\n${'[a](javascript:b) '.repeat(n)}`,
    name: 'markdown-raw-links',
  },
  {
    compile: true,
    make: n => `<div>\n${'<javascript:b> '.repeat(n)}`,
    name: 'markdown-raw-autolinks',
  },
  {
    compile: true,
    make: n => `<div>\n${'<javascript:b'.repeat(n)}>`,
    name: 'markdown-raw-autolink-chain',
  },
  {
    compile: true,
    make: n => `<div>\n${'<javascript:](b '.repeat(n)}>`,
    name: 'markdown-raw-autolink-bodies',
  },
  {
    compile: true,
    make: n => `<div>\n${'[a <b:c](<javascript:d>)> '.repeat(n)}`,
    name: 'markdown-raw-autolink-links',
  },
  {
    compile: true,
    make: n => `<div>\n${'!['.repeat(n)}`,
    name: 'markdown-raw-image-openers',
  },
  {
    compile: true,
    make: n => `<div>\n${'!["]'.repeat(n)}`,
    name: 'markdown-raw-image-alts',
  },
  // The walks over a raw string, each reached through what the parser keeps raw:
  // a block's body or what follows a comment on its line
  ...[
    [']', 'bracket'],
    ['](', 'paren'],
    [']: ', 'colon'],
    ['&lt;/', 'entity-closer'],
  ].map(([unit, name]) => ({
    compile: true,
    make: (n: number) => `<div>\n${unit.repeat(n)}`,
    name: `markdown-raw-run-${name}`,
  })),
  ...[
    ['<a:', 'autolink-short-scheme'],
    ['<aa:', 'autolink-body'],
    ['<!', 'declaration'],
    ['<?', 'instruction'],
    ['<pre', 'tag'],
    ['</pre', 'tag-closer'],
    ['<![cdata[', 'cdata'],
    ['![', 'image'],
    ['](', 'paren'],
  ].map(([unit, name]) => ({
    compile: true,
    make: (n: number) => `<!-- x -->${unit.repeat(n)}`,
    name: `markdown-after-markup-${name}`,
  })),
  // A code body is tested as raw HTML before it is written
  ...[
    ['<', 'openers'],
    ['<b onclick=a>', 'tags'],
    ['](', 'links'],
    ['<!--', 'comments'],
  ].map(([unit, name]) => ({
    compile: true,
    make: (n: number) => `\`\`\`\n${unit.repeat(n)}\n\`\`\``,
    name: `markdown-code-body-${name}`,
  })),
  {
    compile: true,
    make: n => '`<b onclick=a>` '.repeat(n),
    name: 'markdown-code-spans-many',
  },
  { compile: true, make: n => '\\<b '.repeat(n), name: 'markdown-text-lt' },
  {
    compile: true,
    make: n => `a[^1]\n\n[^1]: ${'<b>y</b> '.repeat(n)}`,
    name: 'markdown-footnote-html',
  },
]

function timeOnce(shape: (typeof shapes)[number], input: string): number {
  const t0 = performance.now()
  run(shape, input)
  return performance.now() - t0
}

function run(shape: (typeof shapes)[number], input: string): void {
  if (shape.compile) {
    markdownCompiler(input)
  } else {
    parser(input, shape.options)
  }
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
  run(shape, input)
  while (
    Math.min(timeOnce(shape, input), timeOnce(shape, input)) < targetMs &&
    size < MAX_SIZE
  ) {
    size *= 2
    input = shape.make(size)
    run(shape, input)
  }
  const largeInput = input
  const smallInput = shape.make(size / 4)
  var small = Number.POSITIVE_INFINITY
  var large = Number.POSITIVE_INFINITY
  for (var r = 0; r < runs; r++) {
    small = Math.min(small, timeOnce(shape, smallInput))
    large = Math.min(large, timeOnce(shape, largeInput))
  }
  // Quadrupling the input costs 4x when linear and 16x when quadratic, so the
  // exponent is the log of the ratio over the two doublings between them.
  return {
    exponent: Math.log2(large / Math.max(small, MIN_SMALL_MS)) / 2,
    large,
    sizes: `${small.toFixed(2)}ms (n=${size / 4}) -> ${large.toFixed(2)}ms (n=${size})`,
  }
}

// Purpose-built bad input warns once per URL, and the logging would be the cost measured
console.warn = () => {}

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
