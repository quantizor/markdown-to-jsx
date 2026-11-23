#!/usr/bin/env bun
import process from 'node:process'
import { $ } from '../lib/src/constants.ts'
import { compiler as markdownCompiler } from '../lib/src/markdown.ts'
import { type ParserInputOptions, parser } from '../lib/src/parse.ts'

const MAX_EXPONENT = 1.4
const MAX_NESTED_EXPONENT = 2.4
const TARGET_MS = 12
const MIN_JUDGE_MS = 2
const MIN_SMALL_MS = 0.001
const BASE = 4000
const MAX_SIZE = 1 << 21
const RUNS = 7

const OVERRIDE_KEY_COUNT = 50
const TAG_ID_WIDTH = 4
const TAG_ID_RADIX = 36

const distinctTags =
  (unit: (tag: string) => string, suffix = '') =>
  (n: number) =>
    Array.from({ length: n }, (_, i) => unit(i.toString(36))).join('') + suffix

const nestedOneLine = (unit: string) => (n: number) =>
  `${unit.repeat(Math.min(n >> 13, $.MAX_PARSE_DEPTH))}x`

const nestedMultiLineList = (n: number) =>
  Array.from(
    { length: Math.min(Math.floor(Math.sqrt(n)), $.MAX_PARSE_DEPTH) },
    (_, i) => `${'  '.repeat(i)}- x`
  ).join('\n')

const shapes: Array<{
  compile?: boolean
  make: (n: number) => string
  maxExponent?: number
  name: string
  options?: ParserInputOptions
}> = [
  { make: n => '['.repeat(n) + ']'.repeat(n), name: 'link-balanced' },
  { make: n => `${'['.repeat(n)}]`, name: 'link-openers-one-close' },
  { make: n => '['.repeat(n), name: 'link-openers-no-close' },
  {
    make: n => `${'[*'.repeat(n)}x${'*](u)'.repeat(n)}`,
    name: 'link-candidates-holding-a-link',
  },
  { make: n => '['.repeat(n) + '\\]'.repeat(n), name: 'link-escaped-close' },
  { make: n => '!['.repeat(n) + ']'.repeat(n), name: 'image-openers' },
  { make: n => `[a](${'('.repeat(n)}`, name: 'link-dest-unclosed-paren' },
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
  {
    make: n => `${'*a '.repeat(n)}b${' a*'.repeat(n)}`,
    name: 'emphasis-nested-pairs',
  },
  { make: n => '~~'.repeat(n), name: 'strikethrough' },
  { make: n => '~~a~~~'.repeat(n), name: 'strikethrough-long-runs' },
  { make: n => '~~a '.repeat(n), name: 'strikethrough-openers-no-close' },
  { make: n => 'a~~ '.repeat(n), name: 'strikethrough-closers-no-open' },
  { make: n => '~~a ~~'.repeat(n), name: 'strikethrough-unflanked' },
  { make: n => '=='.repeat(n), name: 'marked' },
  { make: n => '==a==='.repeat(n), name: 'marked-long-runs' },
  {
    make: n => `==http://a.b/${'=a'.repeat(n)}`,
    name: 'marked-open-url-equals',
  },
  {
    make: nestedOneLine('- '),
    maxExponent: MAX_NESTED_EXPONENT,
    name: 'nested-one-line-list',
  },
  {
    make: nestedOneLine('> '),
    maxExponent: MAX_NESTED_EXPONENT,
    name: 'nested-one-line-quote',
  },
  {
    make: nestedMultiLineList,
    name: 'nested-multi-line-list',
  },
  { make: n => '`'.repeat(n), name: 'code-backticks' },
  {
    make: n =>
      `${Array.from({ length: Math.floor(Math.sqrt(n)) }, (_, i) => `${'`'.repeat(i + 1)}a`).join(' ')} ${'`'.repeat(n)}`,
    name: 'code-distinct-length-openers',
  },
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
    make: distinctTags(t => `<x${t}>a</x${t}> `),
    name: 'html-tag-distinct-names-closed',
  },
  {
    make: (n: number) =>
      Array.from({ length: n }, (_, i) => {
        const tag = `X${i.toString(TAG_ID_RADIX).padStart(TAG_ID_WIDTH, '0')}`
        return `x <${tag} a={b}>y</${tag}>\n\n`
      }).join(''),
    name: 'override-lookup-unmatched-capitalized',
    options: {
      overrides: Object.fromEntries(
        Array.from({ length: OVERRIDE_KEY_COUNT }, (_, i) => [
          `Y${i.toString(TAG_ID_RADIX).padStart(TAG_ID_WIDTH, '0')}`,
          'b',
        ])
      ),
    },
  },
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
  { make: n => 'www.x.y '.repeat(n), name: 'bare-url-www-no-slash' },
  { make: n => 'www._'.repeat(n), name: 'bare-url-www-rejected-run' },
  { make: n => 'http://a_b.c_d'.repeat(n), name: 'bare-url-http-rejected-run' },
  {
    make: n => 'www._)www._('.repeat(n) + ').'.repeat(n),
    name: 'bare-url-www-rejected-run-paren-tail',
  },
  {
    make: n => 'www._)www._[www._(www._]'.repeat(n) + ').].'.repeat(n),
    name: 'bare-url-www-rejected-run-bracket-tail',
  },
  { make: n => 'a@'.repeat(n), name: 'bare-email' },
  { make: n => 'a'.repeat(n), name: 'plain-text' },
  {
    make: n => `|${'a|'.repeat(n)}\n|${'-|'.repeat(n)}`,
    name: 'table-pipes',
  },
  {
    make: n => '[a '.repeat(n),
    name: 'streaming-link-openers',
    options: { optimizeForStreaming: true },
  },
  {
    make: n => 'p *a _b\n\n'.repeat(n),
    name: 'streaming-held-openers',
    options: { optimizeForStreaming: true },
  },
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
    make: n => `<div ${'a="b" '.repeat(n)}>x</div>`,
    name: 'html-block-quoted-attrs',
  },
  {
    make: n => `x <span ${'a="b" '.repeat(n)}>y</span>`,
    name: 'html-inline-quoted-attrs',
  },
  { make: n => `<a ${'b="c" '.repeat(n)}`, name: 'html-unclosed-quoted-attrs' },
  { make: n => `<Foo ${'a="b" '.repeat(n)}/>`, name: 'component-quoted-attrs' },
  {
    make: n => `<div>\n${'x <a'.repeat(n)}\n</div>`,
    name: 'html-body-tag-openers',
  },
  {
    make: n => `<Foo>\n${'<a\n'.repeat(n)}</Foo>`,
    name: 'component-body-line-openers',
  },
  { make: n => `<div>\n${'<a\n'.repeat(n)}`, name: 'html-body-line-openers' },
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
  ...[
    ['<div>\n\n', '</div>\n\n', 'blank'],
    ['<div>\n\n', '', 'blank-unclosed'],
    ['<div>\n', '</div>\n', 'newline'],
  ].map(([opener, closer, name]) => ({
    make: (n: number) => opener.repeat(n >> 4) + closer.repeat(n >> 4),
    name: `html-nested-openers-${name}`,
  })),
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
    ['<div>\nx\n\n> <div>\n> y\n\n', 'blockquote-between'],
    ['<div>\nx\n\n- <div>\n  y\n\n', 'list-between'],
  ].map(([unit, name, closer = '', middle = '']) => ({
    make: (n: number) => unit.repeat(n >> 4) + middle + closer.repeat(n >> 4),
    name: `html-closer-search-${name}`,
  })),
  { make: n => `x ${'<b>a'.repeat(n)}`, name: 'inline-openers-unclosed' },
  { make: n => `[ ${'<!-- '.repeat(n)}]`, name: 'link-text-comment-openers' },
  {
    make: n => '[a<!-- b](/u) '.repeat(n),
    name: 'links-holding-comment-openers',
  },
  ...[
    ['<!-- ', 'comment'],
    ['<? ', 'instruction'],
    ['<![CDATA[ ', 'cdata'],
    ['<!A ', 'declaration'],
  ].map(([unit, name]) => ({
    make: (n: number) => `x ${unit.repeat(n)}`,
    name: `inline-unterminated-${name}`,
  })),
  {
    make: n => `x ${'<? [<? a](/u) '.repeat(n)}`,
    name: 'inline-unterminated-instruction-in-link',
  },
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

function cpuMs(): number {
  const { system, user } = process.cpuUsage()
  return (system + user) / 1000
}

function timeOnce(shape: (typeof shapes)[number], input: string): number {
  const t0 = cpuMs()
  run(shape, input)
  return cpuMs() - t0
}

function run(shape: (typeof shapes)[number], input: string): void {
  if (shape.compile) {
    markdownCompiler(input)
  } else {
    parser(input, shape.options)
  }
}

function measure(
  shape: (typeof shapes)[number],
  targetMs: number,
  runs: number
) {
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
  return {
    exponent: Math.log2(large / Math.max(small, MIN_SMALL_MS)) / 2,
    large,
    sizes: `${small.toFixed(2)}ms (n=${size / 4}) -> ${large.toFixed(2)}ms (n=${size})`,
  }
}

console.warn = () => {}

const only = process.argv.slice(2)
const unknown = only.filter(name => !shapes.some(shape => shape.name === name))
if (unknown.length > 0) {
  console.error(
    `scaling-smoke: no shape named ${unknown.join(', ')}; run without arguments to measure every shape`
  )
  process.exit(2)
}

var failed = 0
for (const shape of only.length > 0
  ? shapes.filter(s => only.includes(s.name))
  : shapes) {
  const first = measure(shape, TARGET_MS, RUNS)
  if (first.large < MIN_JUDGE_MS) {
    console.log(
      `SKIP ${shape.name}: ${first.sizes}, too cheap to judge a ratio`
    )
    continue
  }
  const maxExponent = shape.maxExponent ?? MAX_EXPONENT
  if (first.exponent <= maxExponent) {
    console.log(
      `OK ${shape.name}: ${first.sizes}, exponent ${first.exponent.toFixed(2)}, max ${maxExponent}`
    )
    continue
  }
  const confirm = measure(shape, TARGET_MS * 2, RUNS * 2)
  const readings = `first ${first.exponent.toFixed(2)}, confirm ${confirm.exponent.toFixed(2)}`
  if (confirm.exponent <= maxExponent) {
    console.log(
      `OK* ${shape.name}: ${readings}, max ${maxExponent}; ${confirm.sizes}`
    )
    continue
  }
  failed++
  console.log(
    `FAIL ${shape.name}: ${readings}, max ${maxExponent}; first ${first.sizes}; confirm ${confirm.sizes}`
  )
}

if (failed > 0) {
  console.error(
    `scaling-smoke: ${failed} shape(s) grow faster than linear; a scanner is rescanning what an earlier pass already walked`
  )
  process.exit(1)
}
console.log('scaling-smoke ok')
