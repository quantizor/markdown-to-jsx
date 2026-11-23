import { decodeEntity } from 'markdown-to-jsx/entities'
import { $ } from './constants.ts'
import { type MarkdownToJSX, RuleType } from './types.ts'

var FRONTMATTER_OPEN_R = /^---[ \t]*\r?\n/
var FRONTMATTER_LINE_R = /[^\n\r]*(?:\r\n?|\n|$)/y
var FRONTMATTER_KEY_R = /^[ \t]*\w[\w.-]*:[\t\n\r ]/

export function parseFrontmatterBounds(
  input: string
): { endPos: number; hasValidYaml: boolean } | null {
  var open = FRONTMATTER_OPEN_R.exec(input)
  if (open === null) {
    return null
  }
  var hasValidYaml = false
  FRONTMATTER_LINE_R.lastIndex = open[0].length
  for (
    var line = FRONTMATTER_LINE_R.exec(input);
    line !== null && line[0] !== '';
    line = FRONTMATTER_LINE_R.exec(input)
  ) {
    if (line[0].startsWith('---')) {
      return { endPos: FRONTMATTER_LINE_R.lastIndex, hasValidYaml }
    }
    hasValidYaml = hasValidYaml || FRONTMATTER_KEY_R.test(line[0])
  }
  return null
}

export const HTML_CHAR_CODE_R: RegExp =
  /&([a-zA-Z0-9]+|#[0-9]{1,7}|#x[0-9a-fA-F]{1,6});/gi

var HTML_TO_JSX_MAP: Record<string, string> = /* @__PURE__ */ (() => {
  var map: Record<string, string> = { class: 'className', for: 'htmlFor' }
  var names =
    'allowFullScreen allowTransparency autoComplete autoFocus autoPlay cellPadding cellSpacing charSet classId colSpan contentEditable contextMenu crossOrigin encType formAction formEncType formMethod formNoValidate formTarget frameBorder hrefLang inputMode keyParams keyType marginHeight marginWidth maxLength mediaGroup minLength noValidate radioGroup readOnly rowSpan spellCheck srcDoc srcLang srcSet tabIndex useMap viewBox'.split(
      ' '
    )
  for (var i = 0; i < names.length; i++) {
    map[names[i].toLowerCase()] = names[i]
  }
  return map
})()

var EMPTY_JSX_PROPS: Record<string, any> = {}
var XML_NAMESPACED_NAME_R = /^(?:xlink|xmlns|xml):./i

export function htmlAttrsToJSXProps(
  attrs: Record<string, any> | null | undefined
): Record<string, any> {
  if (!attrs) {
    return EMPTY_JSX_PROPS
  }

  var jsxProps: Record<string, any> = {}

  for (var key in attrs) {
    var keyLower = key.toLowerCase()
    var mappedKey = HTML_TO_JSX_MAP[keyLower]
    if (mappedKey) {
      jsxProps[mappedKey] = attrs[key]
    } else if (
      (key.charCodeAt(0) | 32) === $.CHAR_x &&
      XML_NAMESPACED_NAME_R.test(key)
    ) {
      var colonIdx = key.indexOf(':')
      jsxProps[
        key.slice(0, colonIdx) +
          key[colonIdx + 1].toUpperCase() +
          key.slice(colonIdx + 2)
      ] = attrs[key]
    } else {
      jsxProps[key] = attrs[key]
    }
  }

  return jsxProps
}

export function hasContent(children: unknown): boolean {
  if (Array.isArray(children)) {
    for (var i = 0; i < children.length; i++) {
      if (hasContent(children[i])) {
        return true
      }
    }
    return false
  }
  return (
    children !== undefined &&
    children !== null &&
    typeof children !== 'boolean' &&
    children !== ''
  )
}

export function childrenAttrContent(
  value: unknown,
  ownChildren: unknown
): string | undefined {
  return typeof value === 'string' && !hasContent(ownChildren)
    ? value
    : undefined
}

export function rawOpenTagAttrs(openTag: string, tagLength: number): string {
  var last = openTag.length - 1
  var endingLength =
    openTag.charCodeAt(last - 1) === $.CHAR_SLASH
      ? openTag.charCodeAt(last - 2) === $.CHAR_SPACE
        ? 3
        : 2
      : 1
  return openTag.slice(1 + tagLength, openTag.length - endingLength)
}

export const SHOULD_RENDER_AS_BLOCK_R: RegExp =
  /(\n|^[-*]\s|^#|^ {2,}|^-{2,}|^>\s|^<(div|p|h[1-6]|ul|ol|li|blockquote|pre|table|thead|tbody|tr|td|th|dl|dt|dd|hr|address|article|aside|details|dialog|figure|figcaption|footer|form|header|main|menu|nav|section|summary|textarea|fieldset|legend|center|dir|hgroup|marquee|search|output|template)\b)/i

export function decodeEntityReferences(text: string): string {
  if (text.indexOf('&') === -1) {
    return text
  }

  return text.replace(HTML_CHAR_CODE_R, (full, inner) => {
    var entity = decodeEntity(inner)
    if (entity) {
      return entity
    }

    if (inner[0] === '#') {
      var code =
        inner[1] === 'x' || inner[1] === 'X'
          ? Number.parseInt(inner.slice(2), 16)
          : Number.parseInt(inner.slice(1), 10)

      if (
        code === 0 ||
        (code >= 0xd8_00 && code <= 0xdf_ff) ||
        code > 0x10_ff_ff
      ) {
        return '\uFFFD'
      }
      return String.fromCodePoint(code)
    }

    return full
  })
}

var BLOCKED_SCHEME_R = /(javascript|vbscript|data(?!:image)):/i

export const SANITIZE_R: RegExp = new RegExp(
  `^[^/?#]*?${BLOCKED_SCHEME_R.source}`,
  'i'
)

var URL_AFTER_SCHEME_R = /[/?#][\s\S]*$/

export const URL_VERDICT = {
  malformed: 3,
  safe: 0,
  unsafe: 1,
  unsafeDecoded: 2,
} as const

var URL_STRIP_R = /[^A-Za-z0-9/:]/g

var URL_NEEDS_DECODE_R = /[%\t\n\r]/

function decodeUrlScheme(input: string): string {
  return decodeURIComponent(input).replace(URL_STRIP_R, '')
}

export function urlVerdict(
  input: string
): (typeof URL_VERDICT)[keyof typeof URL_VERDICT] {
  if (SANITIZE_R.test(input)) {
    return URL_VERDICT.unsafe
  }

  if (!URL_NEEDS_DECODE_R.test(input)) {
    return URL_VERDICT.safe
  }

  try {
    decodeURIComponent(input)
    return SANITIZE_R.test(
      decodeUrlScheme(input.replace(URL_AFTER_SCHEME_R, ''))
    )
      ? URL_VERDICT.unsafeDecoded
      : URL_VERDICT.safe
  } catch {
    return URL_VERDICT.malformed
  }
}

export function urlNamesBlockedScheme(input: string): boolean {
  return (
    BLOCKED_SCHEME_R.test(input) ||
    (URL_NEEDS_DECODE_R.test(input) &&
      BLOCKED_SCHEME_R.test(decodeUrlScheme(input)))
  )
}

var SVG_IMAGE_SLOTS = new Set([
  'image href',
  'image src',
  'image srcset',
  'image xlink:href',
  'img src',
  'img srcset',
  'input src',
  'source src',
  'source srcset',
  'video poster',
])

var URL_NOISE_R = /[\u0000- ]/g

var SVG_MEDIA_TYPE_R = /^image\/svg\+xml(?:;|$)/

export function opensSvgAsPage(
  url: string,
  tag: string,
  attribute: string
): boolean {
  return (
    isSvgDataUrl(url) &&
    !SVG_IMAGE_SLOTS.has(`${tag.toLowerCase()} ${attribute.toLowerCase()}`)
  )
}

function isSvgDataUrl(input: string): boolean {
  var first = input.charCodeAt(0)
  if (first > $.CHAR_SPACE && (first | 0x20) !== $.CHAR_d) {
    return false
  }
  var colon = input.indexOf(':')
  if (
    colon === -1 ||
    input.slice(0, colon).replace(URL_NOISE_R, '').toLowerCase() !== 'data'
  ) {
    return false
  }
  var comma = input.indexOf(',', colon)
  var mediaType = input
    .slice(colon + 1, comma === -1 ? input.length : comma)
    .replace(URL_NOISE_R, '')
    .toLowerCase()
  if (SVG_MEDIA_TYPE_R.test(mediaType)) {
    return true
  }
  try {
    return SVG_MEDIA_TYPE_R.test(decodeURIComponent(mediaType))
  } catch {
    return false
  }
}

/**
 * Sanitize URLs and other input values to prevent XSS attacks.
 * Filters out javascript:, vbscript:, and data: URLs (except data:image), judged
 * where a browser reads a scheme: before the first `/`, `?`, or `#`. When the
 * tag and attribute are given, an SVG data URL is also filtered out unless it
 * fills an image slot (`img src`, `img srcset`, `source src`, `source srcset`,
 * `video poster`, `input src`, `image` `src`, `srcset`, `href`, and
 * `xlink:href`), since a browser runs its
 * script when it opens the URL as a page.
 *
 * @param input - The URL or value to sanitize
 * @param tag - The element the value is written to
 * @param attribute - The attribute the value is written to
 * @returns Sanitized value, or null if unsafe
 */
export function sanitizer(
  input: string,
  tag?: string,
  attribute?: string
): string | null {
  var verdict = urlVerdict(input)
  if (verdict === URL_VERDICT.safe) {
    if (tag === undefined || !opensSvgAsPage(input, tag, attribute || '')) {
      return input
    }
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        'Input is an SVG data URL outside an image, which runs script when a browser opens it as a page, it will not be rendered.',
        input,
        `${tag} ${attribute}`
      )
    }
    return null
  }

  if (process.env.NODE_ENV !== 'production') {
    console.warn(
      verdict === URL_VERDICT.malformed
        ? 'Input could not be decoded due to malformed syntax or characters, it will not be rendered.'
        : 'Input contains an unsafe JavaScript/VBScript/data expression, it will not be rendered.',
      verdict === URL_VERDICT.unsafeDecoded ? decodeUrlScheme(input) : input
    )
  }
  return null
}

var SLUG_FOLD_START = 0xc0
var SLUG_FOLD =
  'aaaaaaaceeeeiiiidnooooo ouuuuy  aaaaaaaceeeeiiiidnooooo ouuuuy yaaaaaaccccccccddddeeeeeeeeeegggggggghhhhiiiiiiiiii  jjkk llllllllllnnnnnn nnoooooooorrrrrrssssssssttttttuuuuuuuuuuuuwwyyyzzzzzzs                                oo             uu                            aaiioouuuuuuuuuu aaaa    ggkkoooo  j   gg  nnaa    aaaaeeeeiiiioooorrrruuuusstt  hh      aaeeooooooooyy'
var SLUG_FOLD_EXTENDED_START = 0x1e_00
var SLUG_FOLD_EXTENDED =
  'aabbbbbbccddddddddddeeeeeeeeeeffgghhhhhhhhhhiiiikkkkkkllllllllmmmmmmnnnnnnnnoooooooopppprrrrrrrrssssssssssttttttttuuuuuuuuuuvvvvwwwwwwwwwwxxxxyyzzzzzzhtwy      aaaaaaaaaaaaaaaaaaaaaaaaeeeeeeeeeeeeeeeeiiiioooooooooooooooooooooooouuuuuuuuuuuuuuyyyyyyyy'

function slugLetter(code: number): string {
  if (code === $.CHAR_SHARP_S) {
    return 'ss'
  }
  var letter =
    code < SLUG_FOLD_EXTENDED_START
      ? SLUG_FOLD.charAt(code - SLUG_FOLD_START)
      : SLUG_FOLD_EXTENDED.charAt(code - SLUG_FOLD_EXTENDED_START)
  return letter === ' ' ? '' : letter
}

export function isAlnumCode(code: number): boolean {
  return code < $.CHAR_ASCII_BOUNDARY && (CC[code] & (C_ALPHA | C_DIGIT)) !== 0
}

/**
 * Convert a string to a URL-safe slug: ASCII letters are lowercased, digits are
 * kept, spaces and dashes become hyphens, accented Latin letters map to their
 * plain letter (é to e, č to c, ł to l, æ to a, ß to ss), and every other
 * character is dropped, including non-Latin scripts.
 *
 * @param str - String to slugify
 * @returns URL-safe slug
 */
export function slugify(str: string): string {
  var out = ''
  var segStart = -1
  var n = str.length
  for (var i = 0; i < n; i++) {
    var code = str.charCodeAt(i)
    if (
      (code >= $.CHAR_a && code <= $.CHAR_z) ||
      (code >= $.CHAR_DIGIT_0 && code <= $.CHAR_DIGIT_9)
    ) {
      if (segStart < 0) {
        segStart = i
      }
      continue
    }
    if (segStart >= 0) {
      out += str.slice(segStart, i)
      segStart = -1
    }
    out +=
      code >= $.CHAR_A && code <= $.CHAR_Z
        ? String.fromCharCode(code + $.CHAR_CASE_OFFSET)
        : code === $.CHAR_SPACE || code === $.CHAR_DASH
          ? '-'
          : slugLetter(code)
  }
  if (segStart >= 0) {
    out += str.slice(segStart)
  }
  return out
}

export function headingId(id: string | undefined): string | undefined {
  return id?.trim() ? id : undefined
}

export const VOID_ELEMENTS: Set<string> = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
  'circle',
  'ellipse',
  'line',
  'path',
  'polygon',
  'polyline',
  'rect',
  'use',
  'stop',
  'animate',
  'set',
])

export function isVoidElement(tagName: string): boolean {
  let lowerTag = tagName.toLowerCase()
  if (VOID_ELEMENTS.has(lowerTag)) {
    return true
  }
  const colonIndex = lowerTag.indexOf(':')
  if (colonIndex !== -1) {
    lowerTag = lowerTag.slice(colonIndex + 1)
    return VOID_ELEMENTS.has(lowerTag)
  }
  return false
}

export var C_WS = 1
export var C_PUNCT = 4
export var C_ALPHA = 8
export var C_DIGIT = 16

export var CC: Uint8Array = (() => {
  var t = new Uint8Array(128)
  for (var i = $.CHAR_EXCLAMATION; i <= $.CHAR_TILDE; i++) {
    t[i] =
      i >= $.CHAR_DIGIT_0 && i <= $.CHAR_DIGIT_9
        ? C_DIGIT
        : (i | $.CHAR_CASE_OFFSET) >= $.CHAR_a &&
            (i | $.CHAR_CASE_OFFSET) <= $.CHAR_z
          ? C_ALPHA
          : C_PUNCT
  }
  t[$.CHAR_TAB] =
    t[$.CHAR_NEWLINE] =
    t[$.CHAR_FF] =
    t[$.CHAR_CR] =
    t[$.CHAR_SPACE] =
      C_WS
  return t
})()

export var UNICODE_PUNCT_R: RegExp = /[\p{P}\p{S}]/u
export var UNICODE_WHITESPACE_R: RegExp = /\p{Zs}/u

var crlfParts: string[] = []

export function normalizeInput(text: string): string {
  var firstCr = text.indexOf('\r')
  var firstNull = text.indexOf('\x00')

  if (firstCr === -1 && firstNull === -1) {
    return text
  }

  var len = text.length
  crlfParts.length = 0
  var start = 0
  var i = 0

  if (firstCr === -1) {
    i = firstNull
  } else if (firstNull === -1) {
    i = firstCr
  } else {
    i = firstCr < firstNull ? firstCr : firstNull
  }

  for (; i < len; i++) {
    var code = text.charCodeAt(i)
    if (code === $.CHAR_CR) {
      if (start < i) {
        crlfParts.push(text.slice(start, i))
      }
      if (i + 1 < len && text.charCodeAt(i + 1) === $.CHAR_NEWLINE) {
        i++
      }
      crlfParts.push('\n')
      start = i + 1
    } else if (code === 0) {
      if (start < i) {
        crlfParts.push(text.slice(start, i))
      }
      crlfParts.push('\uFFFD')
      start = i + 1
    }
  }
  if (start < len) {
    crlfParts.push(text.slice(start))
  }
  return crlfParts.join('')
}

var MARKUP_GAP_R = />\s+</g
var LINE_BREAKS_R = /\n+/g

function collapseMarkupWhitespace(text: string): string {
  return text.replace(MARKUP_GAP_R, '><').replace(LINE_BREAKS_R, ' ')
}

export function normalizeJsxReparseText(text: string): string {
  var out = ''
  var segStart = 0
  var inTag = false
  var prev = 0
  for (var i = 0; i < text.length; i += 1) {
    var code = text.charCodeAt(i)
    if (code === $.CHAR_LT) {
      var next = text.charCodeAt(i + 1)
      inTag =
        (next >= $.CHAR_a && next <= $.CHAR_z) ||
        (next >= $.CHAR_A && next <= $.CHAR_Z)
      prev = code
    } else if (code === $.CHAR_GT) {
      inTag = false
    } else if (
      inTag &&
      prev === $.CHAR_EQ &&
      (code === $.CHAR_DOUBLE_QUOTE || code === $.CHAR_SINGLE_QUOTE)
    ) {
      var close = text.indexOf(text[i], i + 1)
      if (close === -1) {
        close = text.length
      }
      out +=
        collapseMarkupWhitespace(text.slice(segStart, i + 1)) +
        text.slice(i + 1, close)
      segStart = close
      i = close
      prev = code
    } else if (
      code !== $.CHAR_SPACE &&
      code !== $.CHAR_TAB &&
      code !== $.CHAR_NEWLINE &&
      code !== $.CHAR_CR
    ) {
      prev = code
    }
  }
  return (out + collapseMarkupWhitespace(text.slice(segStart))).trim()
}

export function hasKeys(obj: Record<string, any> | null | undefined): boolean {
  if (!obj) {
    return false
  }
  for (var _key in obj) {
    return true
  }
  return false
}

export function alertHeaderNode(alert: string): MarkdownToJSX.HTMLNode {
  return {
    attrs: {},
    children: [{ type: RuleType.text, text: alert }],
    _reparseSource: undefined,
    _verbatim: true,
    type: RuleType.htmlBlock,
    tag: 'header',
  } as MarkdownToJSX.HTMLNode
}

var TRIM_STARTING_NEWLINES = /^\n+/

export function prepareBlockInput(input: string): string {
  return input.replace(TRIM_STARTING_NEWLINES, '')
}

export function processVerbatimNode(
  node: MarkdownToJSX.ASTNode
): MarkdownToJSX.ASTNode[] {
  if (
    (node.type === RuleType.htmlSelfClosing ||
      node.type === RuleType.htmlBlock) &&
    node._isClosingTag
  ) {
    return []
  }
  if (node.type === RuleType.paragraph) {
    var children = node.children
    return children ? children.flatMap(processVerbatimNode) : []
  }
  if (node.type === RuleType.text) {
    return node.text?.trim() ? [node] : []
  }
  if (node.type === RuleType.htmlBlock && node.children) {
    return [
      {
        ...node,
        children: node.children?.flatMap(processVerbatimNode),
      } as MarkdownToJSX.HTMLNode,
    ]
  }
  return [node]
}

export function stripVerbatim(nodes: MarkdownToJSX.ASTNode[]): void {
  for (var ai = 0; ai < nodes.length; ai++) {
    var current = nodes[ai]
    if (current.type === RuleType.htmlBlock) {
      var hn = current
      var keepVerbatim = false
      if (hn._verbatim && ai === nodes.length - 1) {
        var rawSource =
          hn._rawOuter === undefined
            ? hn._isClosingTag
              ? hn._rawBody || ''
              : (hn._rawBody || '') + (hn._rawClose || '')
            : hn._rawOuter
        var ownClose = `</${String(hn.tag).toLowerCase()}>`
        var closeIdx = rawSource.toLowerCase().indexOf(ownClose)
        if (closeIdx !== -1) {
          var bledTail = rawSource
            .slice(closeIdx + ownClose.length)
            .replace(/<\/[a-z][a-z0-9-]*\s*>/gi, '')
          if (bledTail.trim()) {
            keepVerbatim = true
          }
        }
      }
      if (!keepVerbatim) {
        hn._verbatim = false
      }
    }
    if (
      'children' in nodes[ai] &&
      (nodes[ai] as MarkdownToJSX.HTMLNode).children
    ) {
      stripVerbatim(
        (nodes[ai] as MarkdownToJSX.HTMLNode)
          .children as MarkdownToJSX.ASTNode[]
      )
    }
  }
}

export function reparsedToItself(
  nodes: MarkdownToJSX.ASTNode[],
  source: string
): boolean {
  const last = nodes.at(-1)
  if (
    last === undefined ||
    last.type !== RuleType.htmlBlock ||
    last._verbatim !== true
  ) {
    return false
  }
  return (last._reparseSource || last._rawOuter) === source
}

export function findOwnCloseInAST(
  nodes: MarkdownToJSX.ASTNode[],
  tag: string
): {
  found: boolean
  beforeClose: MarkdownToJSX.ASTNode[]
  afterClose: MarkdownToJSX.ASTNode[]
} {
  for (var i = 0; i < nodes.length; i++) {
    var n = nodes[i]
    if (n.type === RuleType.paragraph && n.children) {
      var pChildren = n.children
      for (var j = 0; j < pChildren.length; j++) {
        var cn = pChildren[j]
        if (
          cn.type === RuleType.htmlSelfClosing &&
          cn._isClosingTag &&
          cn.tag.toLowerCase() === tag
        ) {
          var before: MarkdownToJSX.ASTNode[] = nodes.slice(0, i)
          if (j > 0) {
            before.push({
              type: RuleType.paragraph,
              children: pChildren.slice(0, j),
            } as MarkdownToJSX.ParagraphNode)
          }
          var after: MarkdownToJSX.ASTNode[] = []
          if (j + 1 < pChildren.length) {
            var remaining = pChildren
              .slice(j + 1)
              .filter(
                r => !(r.type === RuleType.htmlSelfClosing && r._isClosingTag)
              )
            if (remaining.length > 0) {
              after = remaining
            }
          }
          after = after.concat(nodes.slice(i + 1))
          return { found: true, beforeClose: before, afterClose: after }
        }
      }
    }
    if (
      (n.type === RuleType.htmlSelfClosing || n.type === RuleType.htmlBlock) &&
      n._isClosingTag &&
      n.tag.toLowerCase() === tag
    ) {
      return {
        found: true,
        beforeClose: nodes.slice(0, i),
        afterClose: nodes.slice(i + 1),
      }
    }
  }
  return { found: false, beforeClose: nodes, afterClose: [] }
}

export function validateCompilerArgs(
  markdown: unknown,
  overrides: unknown,
  componentName: string
): void {
  if (typeof markdown !== 'string') {
    throw new Error('markdown-to-jsx: the first argument must be a string')
  }
  if (Object.prototype.toString.call(overrides) !== '[object Object]') {
    throw new Error(`markdown-to-jsx: options.overrides (second argument property) must be
                             undefined or an object literal with shape:
                             {
                                htmltagname: {
                                    component: string|${componentName}(optional),
                                    props: object(optional)
                                }
                             }`)
  }
}

export function formatFilteredTagAttrs(
  attrs: Record<string, any> | null | undefined
): string {
  var attrStr = ''
  for (var key in attrs) {
    var value = attrs[key]
    if (value === true) {
      attrStr += ` ${key}`
    } else if (value !== undefined && value != null && value !== false) {
      attrStr += ` ${key}="${String(value)}"`
    }
  }
  return attrStr
}

export type FilteredTagEmit =
  | { kind: 'literal'; literal: string }
  | { kind: 'sandwich'; close: string; open: string }

function filteredOpenTag(
  tag: string,
  rawAttrs: string | undefined,
  attrs: Record<string, any> | null | undefined,
  end: string
): string {
  var attrStr: string
  if (rawAttrs === undefined) {
    attrStr = formatFilteredTagAttrs(attrs)
  } else {
    attrStr =
      rawAttrs.length > 0 && rawAttrs.charCodeAt(0) > $.CHAR_SPACE
        ? ` ${rawAttrs}`
        : rawAttrs
  }
  return `<${tag}${attrStr}${end}`
}

export function getFilteredTagEmit(
  node: MarkdownToJSX.HTMLNode | MarkdownToJSX.HTMLSelfClosingNode,
  screenText?: (text: string) => string
): FilteredTagEmit {
  var tag = node.tag
  var selfClosing = node.type === RuleType.htmlSelfClosing
  var htmlNode = node as MarkdownToJSX.HTMLNode
  var rawAttrs = htmlNode._rawAttrs
  var close = `</${tag}>`

  if (!selfClosing && htmlNode._isClosingTag) {
    return {
      kind: 'literal',
      literal: (htmlNode._rawClose || close) + (htmlNode._rawBody || ''),
    }
  }

  if (selfClosing) {
    var scNode = node as MarkdownToJSX.HTMLSelfClosingNode
    if (scNode._isClosingTag) {
      return { kind: 'literal', literal: scNode._rawClose || close }
    }
    if (scNode._rawOpen) {
      return { kind: 'literal', literal: scNode._rawOpen }
    }
    return {
      kind: 'literal',
      literal: filteredOpenTag(tag, rawAttrs, node.attrs, ' />'),
    }
  }

  var open = filteredOpenTag(tag, rawAttrs, node.attrs, '>')
  var kids = htmlNode.children
  var hasKids = kids != null && kids.length > 0

  if (htmlNode._verbatim && htmlNode._rawOuter !== undefined) {
    if (hasKids) {
      return { kind: 'sandwich', open, close }
    }
    return { kind: 'literal', literal: htmlNode._rawOuter }
  }

  if (htmlNode._verbatim && !hasKids) {
    return {
      kind: 'literal',
      literal:
        open +
        (htmlNode._rawBody || '') +
        (htmlNode._rawClose || (rawAttrs === undefined ? close : '')),
    }
  }

  if (kids != null && kids.length > 0) {
    var plain = ''
    for (var i = 0; i < kids.length; i++) {
      var kid = kids[i]
      if (kid.type !== RuleType.text) {
        return { kind: 'sandwich', open, close }
      }
      plain += kid.text
    }
    return {
      kind: 'literal',
      literal: open + (screenText ? screenText(plain) : plain) + close,
    }
  }

  var body = htmlNode._rawBody || ''
  if (body && body.indexOf(close) !== -1) {
    return { kind: 'literal', literal: open + body }
  }
  return { kind: 'literal', literal: open + body + close }
}

export function assembleFilteredTagChildren<T>(
  open: string,
  children: T | T[] | null | undefined,
  close: string
): Array<string | T> {
  var parts: Array<string | T> = []
  var openText = open
  var closeText = close
  if (openText) {
    parts.push(openText)
  }
  if (Array.isArray(children)) {
    for (var i = 0; i < children.length; i++) {
      parts.push(children[i])
    }
  } else if (children != null) {
    parts.push(children)
  }
  if (closeText) {
    parts.push(closeText)
  }
  var merged: Array<string | T> = []
  for (var j = 0; j < parts.length; j++) {
    var p = parts[j]
    if (
      typeof p === 'string' &&
      merged.length > 0 &&
      typeof merged.at(-1) === 'string'
    ) {
      merged[merged.length - 1] = (merged.at(-1) as string) + p
    } else {
      merged.push(p)
    }
  }
  return merged
}

export function tagfilterEnabled(
  options: { tagfilter?: boolean } | null | undefined
): boolean {
  return options == null || options.tagfilter !== false
}

export function sanitizeAndEncodeUrlTarget(
  target: string,
  sanitizer: (value: string, tag: string, attribute: string) => string | null,
  tag: string,
  attribute: string
): string | null {
  var sanitized = sanitizer(target, tag, attribute)
  if (sanitized === null) {
    return null
  }
  return encodeUrlTarget(sanitized)
}

export function extractFootnoteEntries(
  refs:
    | { [key: string]: { target: string; title: string | undefined } }
    | undefined
): { identifier: string; footnote: string }[] {
  var entries: { identifier: string; footnote: string }[] = []
  if (!refs) {
    return entries
  }
  for (var key in refs) {
    if (key.charCodeAt(0) === $.CHAR_CARET) {
      entries.push({ identifier: key, footnote: refs[key].target })
    }
  }
  return entries
}

function lowerAsciiIfNeeded(s: string): string {
  var i = 0
  var len = s.length
  while (i < len) {
    var c = s.charCodeAt(i)
    if (c >= $.CHAR_A && c <= $.CHAR_Z) {
      return s.toLowerCase()
    }
    i++
  }
  return s
}

var ownProperty = Object.prototype.hasOwnProperty

export function overrideValue(source: any, key: string): any {
  if (source == null) {
    return
  }
  var builtIn =
    typeof source === 'function' ? Function.prototype : Object.prototype
  return key in builtIn && !ownProperty.call(source, key)
    ? undefined
    : source[key]
}

function valueIgnoringCase(source: any, key: string): any {
  var lowered = lowerAsciiIfNeeded(key)
  if (lowered === key) {
    return
  }
  var lower = overrideValue(source, lowered)
  var first = key.charCodeAt(0)
  if (lower || first < $.CHAR_A || first > $.CHAR_Z) {
    return lower
  }
  var firstLower = first + $.CHAR_CASE_OFFSET
  for (var name in source) {
    var c = name.charCodeAt(0)
    var mayMatch =
      name.length === key.length &&
      (c === first || c === firstLower || c >= $.CHAR_ASCII_BOUNDARY)
    if (mayMatch && name.toLowerCase() === lowered) {
      var found = overrideValue(source, name)
      if (found) {
        return found
      }
    }
  }
}

export function get(source: any, path: string, fallback: any): any {
  if (path.indexOf('.') === -1) {
    var direct = overrideValue(source, path)
    if (direct || !source) {
      return direct || fallback
    }
    return valueIgnoringCase(source, path) || fallback
  }
  var segments = path.split('.')
  var result = overrideValue(source, segments[0])
  if (result === undefined && source) {
    result = valueIgnoringCase(source, segments[0])
  }
  var i = 1
  while (result !== undefined && i < segments.length) {
    result = overrideValue(result, segments[i])
    i++
  }
  return result || fallback
}

export const SOLID_TARGET_PREFIX_R: RegExp = /^(?:attr|bool|prop):/i

export function isHandlerName(name: string): boolean {
  var at =
    name.charCodeAt(4) === $.CHAR_COLON && SOLID_TARGET_PREFIX_R.test(name)
      ? 5
      : 0
  var c0 = name.charCodeAt(at)
  var c1 = name.charCodeAt(at + 1)
  return (
    (c0 === $.CHAR_o || c0 === $.CHAR_O) && (c1 === $.CHAR_n || c1 === $.CHAR_N)
  )
}

export function withoutHandlerSource(
  tag: string,
  attrs: Record<string, any> | undefined,
  overrides: unknown,
  resolveTag?: (tag: string, overrides: any) => unknown
): Record<string, any> | undefined {
  var kept: Record<string, any> | undefined
  for (var key in attrs) {
    if (isHandlerName(key) && typeof attrs[key] !== 'function') {
      if (kept === undefined) {
        var first = tag.charCodeAt(0)
        if (
          resolveTag !== undefined &&
          first >= $.CHAR_A &&
          first <= $.CHAR_Z &&
          typeof resolveTag(tag, overrides) !== 'string'
        ) {
          return attrs
        }
        kept = { ...attrs }
      }
      delete kept[key]
    }
  }
  return kept || attrs
}

function isHexDigitCode(code: number): boolean {
  return (
    (code >= $.CHAR_DIGIT_0 && code <= $.CHAR_DIGIT_9) ||
    (code >= $.CHAR_A && code <= $.CHAR_F) ||
    (code >= $.CHAR_a && code <= $.CHAR_f)
  )
}

export function encodeUrlTarget(target: string): string {
  var result = ''
  var segStart = 0
  for (var i = 0; i < target.length; i++) {
    var code = target.charCodeAt(i)
    var needsEncoding =
      code <= $.CHAR_SPACE ||
      code === $.CHAR_DOUBLE_QUOTE ||
      code === $.CHAR_PERCENT ||
      code === $.CHAR_LT ||
      code === $.CHAR_GT ||
      code === $.CHAR_BRACKET_OPEN ||
      code === $.CHAR_BACKSLASH ||
      code === $.CHAR_BRACKET_CLOSE ||
      code === $.CHAR_CARET ||
      code === $.CHAR_BACKTICK ||
      code >= 123
    if (!needsEncoding) {
      continue
    }
    if (
      code === $.CHAR_PERCENT &&
      i + 2 < target.length &&
      isHexDigitCode(target.charCodeAt(i + 1)) &&
      isHexDigitCode(target.charCodeAt(i + 2))
    ) {
      i += 2
      continue
    }
    if (code >= 0xd8_00 && code <= 0xdf_ff) {
      var nextCode = target.charCodeAt(i + 1)
      if (code > 0xdb_ff || !(nextCode >= 0xdc_00 && nextCode <= 0xdf_ff)) {
        continue
      }
      result += target.slice(segStart, i) + encodeURI(target.slice(i, i + 2))
      segStart = ++i + 1
      continue
    }
    result += target.slice(segStart, i) + encodeURI(target[i])
    segStart = i + 1
  }
  return segStart === 0 ? target : result + target.slice(segStart)
}

export function cx(...args: (string | undefined | null | false)[]): string {
  return args.filter(Boolean).join(' ')
}

export function getTag<
  T extends string | { component?: string; props?: Record<string, any> },
>(tag: string, overrides?: Record<string, T>): string {
  if (!overrides) {
    return tag
  }
  const override = get(overrides, tag, undefined)
  if (typeof override === 'string') {
    return override
  }
  if (typeof override === 'object' && override.component) {
    return override.component
  }
  return tag
}

export function getOverrideProps<
  T extends string | { component?: string; props?: Record<string, any> },
>(
  tag: string,
  overrides?: Record<string, T>
): Record<string, string | number | boolean> {
  if (!overrides) {
    return {}
  }
  const override = get(overrides, tag, undefined)
  return typeof override === 'object' && override.props ? override.props : {}
}

var TAGFILTER_TAGS = new Set([
  'title',
  'textarea',
  'style',
  'xmp',
  'iframe',
  'noembed',
  'noframes',
  'script',
  'plaintext',
])

var TAGFILTER_R =
  /<(\/?)(title|textarea|style|xmp|iframe|noembed|noframes|script|plaintext)(\s|>|\/)/gi

export function shouldFilterTag(tagName: string): boolean {
  return TAGFILTER_TAGS.has(tagName.toLowerCase())
}

export function containsTagfilterTag(text: string): boolean {
  TAGFILTER_R.lastIndex = 0
  return TAGFILTER_R.test(text)
}

export function verbatimText(tag: string, body: string): string {
  var lower = tag.toLowerCase()
  return lower === 'pre' || lower === 'textarea'
    ? decodeEntityReferences(body)
    : body
}

export function applyTagFilterToText(text: string): string {
  TAGFILTER_R.lastIndex = 0
  return text.replace(
    TAGFILTER_R,
    (_match, slash, tagName, after) => `&lt;${slash}${tagName}${after}`
  )
}
