/**
 * Differential security fuzz: seeded documents built from markup fragments go
 * through the html, markdown, and react outputs, and a spec-conformant HTML
 * tokenizer (parse5) reads the result the way a browser would, the markdown
 * output after both marked and micromark have rendered it. Fails on a live
 * handler, a dangerous URL, a live filtered tag, or a throw, and prints each
 * failure shrunk to its smallest fragment list. The react, solid, and vue element trees are also read
 * prop by prop, for the props a framework acts on and markup never shows.
 *
 * Usage: bun scripts/html-fuzz.ts [--count N] [--seed N] [--max-failures N]
 * The same seed and count always build the same documents, so a failure here
 * is a reproducible parser or compiler bug rather than a flake.
 */
import process from 'node:process'
import { marked } from 'marked'
import { micromark } from 'micromark'
import { type DefaultTreeAdapterTypes, parseFragment } from 'parse5'
import { renderToStaticMarkup } from 'react-dom/server'
import { compiler as htmlCompiler } from '../lib/src/html.ts'
import {
  astToMarkdown,
  compiler as markdownCompiler,
  parser,
} from '../lib/src/markdown.ts'
import { compiler as reactCompiler } from '../lib/src/react.tsx'
import { compiler as solidCompiler } from '../lib/src/solid.tsx'
import { compiler as vueCompiler } from '../lib/src/vue.tsx'

// Every character ECMAScript reads as whitespace, which the markdown output's scanner also
// treats as a separator in a link destination. CommonMark ends an autolink at ASCII space only.
const SPACE_CODES = [
  0x09, 0x0b, 0x0c, 0x0d, 0xa0, 0x16_80, 0x20_00, 0x20_01, 0x20_02, 0x20_03,
  0x20_04, 0x20_05, 0x20_06, 0x20_07, 0x20_08, 0x20_09, 0x20_0a, 0x20_28,
  0x20_29, 0x20_2f, 0x20_5f, 0x30_00, 0xfe_ff,
]
const SPACES = SPACE_CODES.map(code => String.fromCharCode(code))
const NBSP = String.fromCharCode(0xa0)
const EM_SPACE = String.fromCharCode(0x20_03)

// Whitespace to ECMAScript that a tokenizer or renderer can read differently where markup's shape is decided
const ODD_SPACES = [
  0x09, 0x0b, 0x0c, 0x0d, 0xa0, 0x20_28, 0x20_29, 0xfe_ff,
].map(code => String.fromCharCode(code))

const FRAGMENTS = [
  // openers a tokenizer can stay inside
  '<!--',
  '-->',
  '--!>',
  '<!-->',
  '<!--->',
  '<?',
  '?>',
  '<!X ',
  '<!DOCTYPE html>',
  '<![CDATA[',
  ']]>',
  '</',
  '</a ',
  '<a title="',
  "<a title='",
  '<img src=x ',
  '<div ',
  '<my-widget ',
  '<Img ',
  '<Foo ',
  // a quoted value holding the end of markup an earlier piece left open
  '<a title="-->',
  '<a title="--!>',
  '<a title="?>',
  '<a title=">',
  '<a title="]]>',
  '<a title="</noscript>',
  '<a title="</title>',
  '<a title="</style>',
  '<a title="</textarea>',
  '">',
  // a brace value holding a `>`, which ends the tag there for a browser
  '<div x={a>',
  '<Foo x={a>',
  // tags that change what a tokenizer or tree builder does next
  '<div>',
  '</div>',
  '<span>',
  '</span>',
  '<p>',
  '<svg>',
  '</svg>',
  '<math>',
  '<mtext>',
  '<annotation-xml>',
  '<foreignObject>',
  '<noscript>',
  '</noscript>',
  '<template>',
  '</template>',
  '<table>',
  '<select>',
  '<details>',
  '<title>',
  '</title>',
  '<style>',
  '</style>',
  '<script>',
  '</script>',
  '<textarea>',
  '</textarea>',
  '<xmp>',
  '<iframe>',
  '<noembed>',
  '<noframes>',
  '<plaintext>',
  '<pre>',
  '</pre>',
  // tags named after a built-in, which an override lookup can answer
  '<constructor>',
  '<Constructor>',
  '<toString>',
  // tag punctuation
  '>',
  '/>',
  '"',
  "'",
  '=',
  '{',
  '}',
  ' ',
  '/',
  // payloads
  'onerror=alert(1)',
  'onmouseover="alert(1)"',
  "onclick='alert(1)'",
  'onclick={alert(1)}',
  'x={a',
  'href="javascript:alert(1)"',
  'href=javascript:alert(1)',
  'src="java\tscript:alert(1)"',
  '<img src=x onerror=alert(1)>',
  '<svg onload=alert(1)>',
  '<a href="javascript:alert(1)">l</a>',
  '<iframe srcdoc="x"></iframe>',
  '<b onclick=alert(1)>b</b>',
  '<Foo onclick={alert(1)}>f</Foo>',
  // an SVG animation writes its value onto the attribute it names
  '<set attributeName="href" to="javascript:alert(1)"/>',
  '<animate attributeName="href" values="javascript:alert(1)"/>',
  '<set attributeName="&#104;ref" to="javascript:alert(1)"/>',
  '<animate attributename="xlink:href" to="javascript:alert(1)"/>',
  '<set attributeName="&#111;nclick" to="alert(1)"/>',
  '<set attributeName={href} to="javascript:alert(1)"/>',
  'attributeName="href"',
  'attributeName="opacity"',
  // a brace value on a component-like tag that reaches a URL prop
  'action={javascript:alert(1)}',
  'href={java&#115;cript:alert(1)}',
  'src={ javascript:alert(1)}',
  '<Foo action={javascript:alert(1)}>f</Foo>',
  'src={[1]}',
  'data={{"a":1}}',
  'href={link}',
  // where a browser ends markup the parser ends later or not at all
  '<!-- c -->',
  '--!> ',
  '<?x > ',
  '<![CDATA[ > ',
  // attribute names a framework acts on rather than writes
  'innerHTML="x<img src=x onerror=alert(1)>"',
  'prop:innerHTML="x<img src=x onerror=alert(1)>"',
  'attr:onclick="alert(1)"',
  'bool:onclick',
  // Solid passes these to addEventListener, which throws on anything but a function
  'onerror',
  'on:click',
  'oncapture:click',
  'onclick={[1]}',
  '<Img src=x onerror>',
  '<x-y onerror>f</x-y>',
  '<Foo on:click>f</Foo>',
  '<Foo onclick={[1]}>f</Foo>',
  // a blocked scheme after a URL's first `/`, `?`, or `#`, which a browser does not read as one
  '[l](/javascript:alert(1))',
  '[l](?javascript:alert(1))',
  '[l](#javascript:alert(1))',
  '[l](a/javascript:alert(1))',
  '[l](/ javascript:alert(1))',
  '[l](/\njavascript:alert(1))',
  '[r]: /javascript:alert(1)',
  '[^1]: /javascript:alert(1)',
  '<a href="/javascript:alert(1)">l</a>',
  '<a href=/javascript:alert(1)>l</a>',
  '<a href=/ javascript:alert(1)>l</a>',
  '<img src="?javascript:alert(1)">',
  '<Foo href={/javascript:alert(1)}>f</Foo>',
  '/javascript:alert(1)',
  '?javascript:alert(1)',
  '#javascript:alert(1)',
  // a destination another renderer splits, reading the rest as a live link
  '[r]: /javascript:alert(1)[x](javascript:alert(1) "t")',
  '[x](\n?>[x](javascript:alert(1) "t")',
  // A lazy list line an HTML block takes in
  '- <div\nonclick=alert(1)>f</div>',
  '- <x-y\nonclick=alert(1)>f</x-y>',
  '- <Foo\nonclick=alert(1)>f</Foo>',
  '- <!-- x\n<img src=x onerror=alert(1)> -->',
  '- <pre>x\n<img src=x onerror=alert(1)></pre>',
  '- a | b\n  --- | ---\nc | d',
  '- # h\na | b\n  --- | ---',
  '- <b>f</b><!-- c --><img\nsrc=x> onclick=alert(1)',
  '- - [^1]:\nz',
  '- [r]: a\\\nb',
  '[x](a\\\\)',
  '[^a`b] ',
  '[^a`b]: y\n\n',
  '[^a]: y\n\n',
  '[^a<img src=x onerror=alert(1)>]: y\n',
  '[r]: /u "\n```\n"\n\n',
  '[^1]: a\n\n  ```\n\n',
  '- | a |\n  | - |\n| <img src=x onerror=alert(1)> |',
  // A split tag on the line after a Type 1 tag in a list item
  '1. <pre>a</pre>\n   <img\n   src=x>" onclick=alert(1)>',
  '- <pre>a</pre>\n  <img\n  src=x>" onclick=alert(1)>',
  '- a <pre>x</pre>\n  <img\n  src=x>" onclick=alert(1)>',
  'attr:href="javascript:alert(1)"',
  'prop:href=javascript:alert(1)',
  'xlinkHref="javascript:alert(1)"',
  'ref="x"',
  'dangerouslySetInnerHTML="x"',
  'children="x"',
  'children={{"a":1}}',
  "<b y='",
  "' onclick=alert(1)>",
  '" onclick=alert(1)>',
  '~~ ',
  '[r][^1]',
  '<?p ?>',
  '<javascript:alert(1)>',
  '<span>[l](javascript:alert(1))</span>',
  // a target followed by a space character, where renderers disagree on where the target ends
  `<javascript:alert(1)//${NBSP}>`,
  '<javascript:alert(1)// >',
  '<javascript:alert(1) x>',
  `<javascript:alert(1)${String.fromCharCode(0xfe_ff)}x>`,
  `<span><javascript:alert(1)${NBSP}x></span>`,
  '<span><javascript:alert(1) x></span>',
  '<vbscript:x y>',
  `<vbscript:x${String.fromCharCode(0x20_28)}y>`,
  // an unquoted value ending in a separator, whose `>` a blockquote reader takes as a marker
  `\n\n> <div a=1${String.fromCharCode(0x20_28)}>  onclick=alert(1) b>y</div>\n\n`,
  '[x](<javascript:alert(1) y>)',
  `[x](<javascript:alert(1)${NBSP}y>)`,
  '[x](javascript:alert(1) "t")',
  `[x](javascript:alert(1)${NBSP}"t")`,
  '[r]: javascript:alert(1) x\n\n[r]\n\n',
  `[r]: javascript:alert(1)${NBSP}x\n\n[r]\n\n`,
  '[r]: javascript:alert(1)\n\n[r]\n\n',
  NBSP,
  EM_SPACE,
  ...SPACES.map(space => `<javascript:alert(1)${space}x>`),
  // raw markup that ends in a later block, which can hold a definition
  '<!-- a\n\n',
  '\n-->',
  '<? a\n\n',
  '\n?>',
  '<![CDATA[\n\n',
  '\n]]>',
  // an autolink's body once its `<` is neutralized, and a `<` that blocks one
  '[x <https:a ](javascript:alert(1))>',
  '[x <javascript:a](javascript:alert(1))>',
  '<https:a [x](javascript:alert(1))>',
  '[x <javascript:a](<javascript:alert(1)>)>',
  // a closer's own bytes, read on from a block left open or from its attributes
  '</div title="><script>alert(1)</script>">',
  '</Foo a={><script>alert(1)</script>}>',
  // a block left open, which a browser reads on into the next raw block
  '<p><? a\n\n',
  '<p><!x a\n\n',
  '<p></ a\n\n',
  '<p><!-- a\n\n',
  '<p><svg><![CDATA[ a\n\n',
  '<p><noscript>\n\n',
  '<!-- x><noembed>',
  '<div title="x><script>alert(1)</script>">',
  '<br title="--><script>alert(1)</script>">',
  // block structure that splits a document into separately screened pieces
  '\n',
  '\n\n',
  '\n\n',
  '\n',
  '> ',
  '- ',
  '1. ',
  '    ',
  '# ',
  '```\n',
  '| a | b |\n|---|---|\n',
  // inline structure and text that decodes into markup
  '[^1]',
  '[^1]: ',
  '[r]: ',
  '[r]',
  '[l](',
  ')',
  '![',
  '](',
  '`',
  '*',
  '_',
  '~~',
  '\\',
  '&lt;',
  '&gt;',
  '&#60;',
  '&quot;',
  '&amp;',
  'javascript:alert(1)',
  'java\tscript:alert(1)',
  'data:text/html,x',
  'text',
  // compiler-built attributes and fence info strings
  '[l](/u "--><img src=x onerror=alert(1)>")',
  '![a"--><img src=x onerror=alert(1)>](/x)',
  '```x onmouseover="alert(1)"\n',
  '~~~~',
  // whole shapes random pieces rarely assemble: a footnote body, a target that
  // decodes twice, a closer carrying a value
  '[^1]: a [l](javascript:alert(1))\n',
  '[^1]: [l](javascript:alert(1))\n',
  '[^1]: ![a](javascript:alert(1))\n',
  '&amp;#106;avascript:alert(1)',
  '![a](&amp;#106;avascript:alert(1))',
  '[r]: &amp;#106;avascript:alert(1)\n',
  '[x](&amp;amp;#106;avascript:alert(1))',
  // a browser decodes a numeric reference with no semicolon or with many zeros
  '[x](&#106avascript:alert(1))',
  '[x](java&#9script:alert(1))',
  '[x](&#00000000106;avascript:alert(1))',
  '[r]: &#x6avascript:alert(1)\n',
  '[^1]: &#106avascript:alert(1)\n',
  '<a href="&#106avascript:alert(1)">',
  '<a href="&#00000000106;avascript:alert(1)">',
  '[^1]:&#106avascript:alert(1)',
  // a browser ends this at the first `>`, marked at the terminator inside the value
  '<?e><a e="?>">\n',
  "<?e><a e='?>'>\n",
  '<![CDATA[x><a e="]]>">\n',
  '<![cdata[x><a e="]]>">\n',
  // a renderer can drop this at the start of a document, and another keep it
  '\n﻿',
  '1. # [^1]\n',
  '1. <!-- c --> x\n',
  '<div <b c="d"/>\n<![CDATA[</pre>\n',
  '<a e="--><b e=">">\n',
  '<div>"onclick=alert(1)>',
  '<textarea\n```\n',
  '[^a](javascript:alert(1))',
  '[^a<img src=x onerror=alert(1)>]\n',
  '[^[x](javascript:alert(1))]: a\n',
  '[r<javascript:alert(1)>]: a "[x](javascript:alert(1))"\n',
  '[\\[a\\](javascript:alert(1))](/u)',
  '[^1]: a [\n',
  '[r]: a "](javascript:alert(1))"\n',
  '<script></textarea></script >\n',
  '<pre></textarea></pre\n>\n',
  '- <div/>`<img src=x onerror=alert(1)>`\n',
  '- z\n  <b/>\n  `<img src=x onerror=alert(1)>`\n',
  '- <br>\n  `<img src=x onerror=alert(1)>`\n',
  '- a\n\n- z\n  <b/>\n  `<img src=x onerror=alert(1)>`\n',
  '<b>`</b>x`<img src=x onerror=alert(1)>`\n',
  'z\n    <div>`<img src=x onerror=alert(1)>`\n',
  '~~~<a href="javascript:alert(1)">\nq\n~~~\n',
  '- <?a ?>[x]:\n  javascript:alert(1)\n\n<span>[x]</span>\n',
  '1. ```\n   <img src=x onerror=alert(1)>\n   ```\n',
  '<pre/>\n\n',
  '```~\n',
  '~~~`\n',
  '[x](\n',
  '![x](\n',
  '<![CDATA[a]]]>\n',
  ']]]>',
  '<div>\n\n```\n```~\n```\n\n</div>\n\n```\n<img src=x onerror=alert(1)>\n',
  ...ODD_SPACES.flatMap(space => [
    `${space}\n`,
    `\`\`\`${space}\n`,
    `~~~${space}\n`,
    `<div>\n\n\`\`\`\n\`\`\`${space}\n\n</div>\n\n\`\`\`\n<img src=x onerror=alert(1)>\n`,
    `<img${space}src=x${space}onerror=alert(1)>`,
    `<a${space}href="javascript:alert(1)">x</a>`,
    `</div${space}>`,
    `</script${space}>`,
    `<script></textarea></script${space}>\n`,
    `<!--${space}-->`,
    `[x](${space}javascript:alert(1))`,
    `[r]:${space}javascript:alert(1)\n`,
  ]),
  // a renderer starts over at the blank line and stays inside the opener
  '<title>a\n\n<!--</title>',
  '<div>a\n\n<?</div>\n',
  '&amp;#106;avascript:alert(1)',
  '<div>\n<?e><a e="?>">',
  '"onclick=alert(1)>',
  "'onclick=alert(1)>",
  '[x](javascript&amp;amp;colon;alert(1))',
  '[r]: java&amp;amp;#9;script:alert(1)\n',
  '[^1]: &amp;#106;avascript:alert(1)\n',
  '[x][^1]',
  // marked restarts at each terminator, so a chain moves where it reads a fence
  '<?p ?><!DOCTYPE html>',
  '<!DOCTYPE html><?p ?>',
  '<?p ?><![CDATA[x]]>',
  '<?p ?> <?q ?>',
  '```\n',
  '~~~\n',
  '</div x={a ><img src=x onerror=alert(1)>}>',
  '</Foo x={a ><img src=x onerror=alert(1)>}>',
  '</span ](javascript:alert(1))>',
  '</a title="',
  '</div\n',
] as const

const MAX_FRAGMENTS_PER_DOCUMENT = 14
const MIN_FRAGMENTS_PER_DOCUMENT = 2

const URL_ATTRIBUTES = new Set([
  'action',
  'background',
  'cite',
  'data',
  'formaction',
  'href',
  'longdesc',
  'poster',
  'src',
  'xlink:href',
  'xlinkhref',
])

/** Props a framework acts on, which throw or inject markup when markdown supplies them. */
const RENDERER_ONLY_PROPS = new Set([
  'children',
  'dangerouslysetinnerhtml',
  'innerhtml',
  'outerhtml',
  'ref',
])

/** The prefixes Solid strips to reach the attribute or property named after them. */
const SOLID_TARGET_PREFIX_R = /^(?:attr|bool|prop):/i

// A browser removes tab, LF, and CR anywhere in a URL and C0 or space at its start
const URL_REMOVED_R = /[\t\n\r]/g
const URL_LEADING_R = /^[\0- ]+/
const DANGEROUS_SCHEME_R = /^(?:javascript|vbscript|data(?!:image)):/i

/** A brace object or array, kept as a prop whatever it holds. */
const BRACE_OBJECT_VALUE_R = /^\{\s*[[{]/

/** The GFM tagfilter list, which the html sink must never leave as a live element. */
const TAGFILTER_TAGS = new Set([
  'iframe',
  'noembed',
  'noframes',
  'plaintext',
  'script',
  'style',
  'textarea',
  'title',
  'xmp',
])

/** The tag a sink registers as a component, whose `{`-leading attribute is kept by design. */
const REGISTERED_TAG = 'foo'
const REGISTERED_OVERRIDES = { Foo: { props: {} } }

/** Renames that change how a renderer reads what follows the tag: inline to block-level, and any tag to one read raw through its closer. */
const READING_CHANGING_OVERRIDES = {
  b: { component: 'script' },
  br: { component: 'pre' },
  div: { component: 'pre' },
  em: { component: 'section' },
  pre: { component: 'div' },
  span: { component: 'textarea' },
  x: { component: 'div' },
}
const CHAR_BRACE_OPEN = 0x7b

/** A `<` then a tag name starting with a capital */
const COMPONENT_TAG_R = /<([A-Z][a-zA-Z0-9-]*)/g

interface Finding {
  detail: string
  document: string[]
  sink: string
}
type TreeNode =
  | DefaultTreeAdapterTypes.ChildNode
  | DefaultTreeAdapterTypes.DocumentFragment

function createRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d_2b_79_f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

// On 9.x a capitalized tag keeps a `{`-leading attribute value by public
// behavior, registered or not. So an attribute is exempt only when its value
// starts with `{` and its element's name matches, case-insensitively, a
// capitalized tag name written in the source document or the tag the sink
// registers. Only the registered tag keeps a handler. A hyphenated tag gets no
// exemption, and `<div onclick={alert(1)}<xmp>` stays a failure.
function componentTagsIn(source: string, registered?: string): Set<string> {
  const names = new Set<string>(registered ? [registered] : [])
  for (const match of source.matchAll(COMPONENT_TAG_R)) {
    names.add(match[1].toLowerCase())
  }
  return names
}

/** Pre-order walk of a parsed tree (template contents included); the first finding `check` returns on a node wins. */
function findInTree(
  node: TreeNode,
  check: (node: TreeNode) => string | undefined
): string | undefined {
  const own = check(node)
  if (own) {
    return own
  }
  if ('content' in node) {
    const inTemplate = findInTree(node.content, check)
    if (inTemplate) {
      return inTemplate
    }
  }
  if ('childNodes' in node) {
    for (const child of node.childNodes) {
      const inChild = findInTree(child, check)
      if (inChild) {
        return inChild
      }
    }
  }
}

function dangerOf(
  node: TreeNode,
  exemptTags: Set<string>,
  registered: string | undefined
): string | undefined {
  if ('attrs' in node) {
    for (const attribute of node.attrs) {
      const name = attribute.name.toLowerCase()
      const tagName = node.tagName.toLowerCase()
      const isExempt =
        exemptTags.has(tagName) &&
        attribute.value.charCodeAt(0) === CHAR_BRACE_OPEN &&
        (tagName === registered || !name.startsWith('on'))
      if (name === 'attributename' && animatesDangerousAttr(attribute.value)) {
        return `<${node.tagName} attributeName=${attribute.value}>`
      }
      if (isExempt) {
        if (
          URL_ATTRIBUTES.has(name) &&
          !BRACE_OBJECT_VALUE_R.test(attribute.value) &&
          isDangerousUrl(attribute.value.slice(1))
        ) {
          return `<${node.tagName} ${name}=${attribute.value}>`
        }
        continue
      }
      // An empty handler attribute holds no script
      if (name.startsWith('on') && attribute.value !== '') {
        return `<${node.tagName} ${name}>`
      }
      if (name === 'srcdoc' && node.tagName === 'iframe') {
        return '<iframe srcdoc>'
      }
      if (URL_ATTRIBUTES.has(name) && isDangerousUrl(attribute.value)) {
        return `<${node.tagName} ${name}=${attribute.value}>`
      }
    }
  }
}

// scriptingEnabled matches a live page, where <noscript> is raw text
function parseAsBrowser(html: string) {
  return parseFragment(html, { scriptingEnabled: true })
}

function readTree(
  tree: TreeNode,
  source: string,
  registered?: string
): string | undefined {
  const exemptTags = componentTagsIn(source, registered)
  return findInTree(tree, node => dangerOf(node, exemptTags, registered))
}

function readAsBrowser(
  html: string,
  source: string,
  registered?: string
): string | undefined {
  return readTree(parseAsBrowser(html), source, registered)
}

function isDangerousUrl(value: string): boolean {
  return DANGEROUS_SCHEME_R.test(
    value.replace(URL_REMOVED_R, '').replace(URL_LEADING_R, '')
  )
}

/** Whether an attributeName value, already decoded, targets a URL or on* attribute. */
function animatesDangerousAttr(value: string): boolean {
  const target = value.trim().toLowerCase()
  const local = target.slice(target.lastIndexOf(':') + 1)
  return (
    URL_ATTRIBUTES.has(target) ||
    URL_ATTRIBUTES.has(local) ||
    local.startsWith('on')
  )
}

function filteredTagOf(node: TreeNode): string | undefined {
  if ('tagName' in node && TAGFILTER_TAGS.has(node.tagName.toLowerCase())) {
    return `live <${node.tagName}>`
  }
}

/** Reads one compiled html string as a browser would: a dangerous attribute, then a tag the output should have filtered. */
function readHtmlOutput(
  output: string,
  source: string,
  registered?: string
): string | undefined {
  const tree = parseAsBrowser(output)
  return readTree(tree, source, registered) ?? findInTree(tree, filteredTagOf)
}

/** Reads a React, Solid, or Vue element tree, each of which keeps its props on a different field. */
function findPropDanger(tree: unknown, source: string): string | undefined {
  if (Array.isArray(tree)) {
    for (const item of tree) {
      const inItem = findPropDanger(item, source)
      if (inItem) {
        return inItem
      }
    }
    return
  }
  if (tree === null || typeof tree !== 'object') {
    return
  }
  const element = tree as {
    children?: unknown
    p?: Record<string, unknown>
    props?: Record<string, unknown>
    t?: unknown
    type?: unknown
  }
  const props = element.p ?? element.props ?? {}
  const tag = element.t ?? element.type
  // On 9.x a capitalized tag keeps a `{...}` value, which reaches here unbraced
  const isComponentTag = typeof tag === 'string' && /^[A-Z]/.test(tag)
  for (const name of Object.keys(props)) {
    const value = props[name]
    const target = name.replace(SOLID_TARGET_PREFIX_R, '').toLowerCase()
    // The compiler's own markup, which must be a string to reach the page as markup
    if (name === 'innerHTML' || name === 'dangerouslySetInnerHTML') {
      const markup =
        name === 'innerHTML'
          ? value
          : (value as { __html?: unknown } | null)?.__html
      const inMarkup =
        typeof markup === 'string'
          ? readAsBrowser(markup, source)
          : `${name} is not a string`
      if (inMarkup) {
        return inMarkup
      }
      continue
    }
    if (target !== 'children' && RENDERER_ONLY_PROPS.has(target)) {
      return `prop ${name}`
    }
    if (
      target === 'attributename' &&
      typeof value === 'string' &&
      animatesDangerousAttr(value)
    ) {
      return `prop ${name}=${value}`
    }
    // React keeps a capitalized tag's handler prop for a component and writes no string handler
    const isHeldProp =
      isComponentTag &&
      !URL_ATTRIBUTES.has(target) &&
      (!target.startsWith('on') || '$$typeof' in element)
    if (typeof value === 'function' || isHeldProp) {
      continue
    }
    // A bare name holds no script. Only Solid (`p`) throws on one, and not behind a target prefix
    const isInertBare =
      value === true &&
      (element.p === undefined || SOLID_TARGET_PREFIX_R.test(name))
    if (target.startsWith('on') && !isInertBare) {
      return `prop ${name}`
    }
    if (
      typeof value === 'string' &&
      URL_ATTRIBUTES.has(target) &&
      isDangerousUrl(value)
    ) {
      return `prop ${name}=${value}`
    }
  }
  return findPropDanger(props.children ?? element.children, source)
}

// A consumer renders markdown output with its own markdown renderer, and
// marked passes raw HTML through unscreened
function renderDownstream(markdown: string): string {
  return marked.parse(markdown, { async: false })
}

// micromark follows CommonMark to the letter, where marked reads some shapes
// differently (an autolink body, a link title)
function renderCommonMark(markdown: string): string {
  return micromark(markdown, {
    allowDangerousHtml: true,
    allowDangerousProtocol: true,
  })
}

/** Reads markdown output through every renderer; unsafe in either is a finding. */
function readDownstream(
  markdown: string,
  source: string,
  registered?: string
): string | undefined {
  for (const render of [renderDownstream, renderCommonMark]) {
    const finding = readAsBrowser(render(markdown), source, registered)
    if (finding) {
      return finding
    }
  }
}

const SINKS = {
  html: source => readHtmlOutput(htmlCompiler(source), source),
  'html-registered': source =>
    readHtmlOutput(
      htmlCompiler(source, { overrides: REGISTERED_OVERRIDES }),
      source,
      REGISTERED_TAG
    ),
  markdown: source => readDownstream(astToMarkdown(parser(source)), source),
  'markdown-registered': source =>
    readDownstream(
      markdownCompiler(source, { overrides: REGISTERED_OVERRIDES }),
      source,
      REGISTERED_TAG
    ),
  'markdown-reading-changing-renames': source =>
    readDownstream(
      markdownCompiler(source, { overrides: READING_CHANGING_OVERRIDES }),
      source
    ),
  parser: source =>
    JSON.stringify(parser(source)).includes('\\u001e')
      ? 'the parser lazy line marker reached the AST'
      : undefined,
  solid: source => findPropDanger(solidCompiler(source), source),
  vue: source => findPropDanger(vueCompiler(source), source),
  react: source => {
    const tree = reactCompiler(source)
    return (
      readAsBrowser(renderToStaticMarkup(tree), source) ??
      findPropDanger(tree, source)
    )
  },
  'react-registered': source =>
    readAsBrowser(
      renderToStaticMarkup(
        reactCompiler(source, { overrides: REGISTERED_OVERRIDES })
      ),
      source,
      REGISTERED_TAG
    ),
} satisfies Record<string, (source: string) => string | undefined>

type SinkName = keyof typeof SINKS

function runSink(sink: SinkName, source: string): string | undefined {
  try {
    return SINKS[sink](source)
  } catch (error) {
    return `throw ${error instanceof Error ? error.message : String(error)}`
  }
}

function shrink(sink: SinkName, document: string[]): string[] {
  let smallest = document
  let index = 0
  while (index < smallest.length) {
    const candidate = smallest.filter((_, i) => i !== index)
    if (runSink(sink, candidate.join(''))) {
      smallest = candidate
    } else {
      index++
    }
  }
  return smallest
}

function readFlag(name: string, fallback: number): number {
  const at = process.argv.indexOf(`--${name}`)
  return at === -1 ? fallback : Number(process.argv[at + 1])
}

const count = readFlag('count', 4000)
const seed = readFlag('seed', 1)
const maxFailures = readFlag('max-failures', 40)

// Purpose-built bad input warns by design; a warning is not a finding
console.error = () => {}
console.warn = () => {}

const random = createRandom(seed)
const sinkNames = Object.keys(SINKS) as SinkName[]
const seen = new Map<string, Finding>()
const startMs = performance.now()
let failures = 0

for (let run = 0; run < count; run++) {
  const size =
    MIN_FRAGMENTS_PER_DOCUMENT +
    Math.floor(
      random() * (MAX_FRAGMENTS_PER_DOCUMENT - MIN_FRAGMENTS_PER_DOCUMENT + 1)
    )
  const document: string[] = []
  for (let i = 0; i < size; i++) {
    document.push(FRAGMENTS[Math.floor(random() * FRAGMENTS.length)])
  }
  const source = document.join('')
  for (const sink of sinkNames) {
    if (!runSink(sink, source)) {
      continue
    }
    failures++
    const smallest = shrink(sink, document)
    const key = `${sink}|${smallest.join('')}`
    if (!seen.has(key)) {
      seen.set(key, {
        detail: runSink(sink, smallest.join('')) ?? '',
        document: smallest,
        sink,
      })
    }
  }
}

const elapsedMs = Math.round(performance.now() - startMs)
const findings = [...seen.values()].sort(
  (a, b) => a.document.join('').length - b.document.join('').length
)
for (const finding of findings.slice(0, maxFailures)) {
  console.log(
    `FAIL sink=${finding.sink} detail=${JSON.stringify(finding.detail)} source=${JSON.stringify(finding.document.join(''))}`
  )
}
console.log(
  `html-fuzz documents=${count} seed=${seed} failing_runs=${failures} distinct=${findings.length} elapsed_ms=${elapsedMs}`
)
if (failures > 0) {
  process.exit(1)
}
