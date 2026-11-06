/**
 * Compact Table-Driven Markdown Parser
 *
 * This parser uses tables and generic scanners instead of specialized functions
 * to achieve dramatic code size reduction while maintaining CommonMark compliance.
 */

import * as $ from './constants.ts'
import { type MarkdownToJSX, RuleType } from './types.ts'
import * as util from './utils.ts'
import {
  CC as _CC,
  C_BLOCK,
  C_INLINE,
  C_PUNCT,
  C_WS,
  UNICODE_PUNCT_R,
  UNICODE_WHITESPACE_R,
} from './utils.ts'

// ============================================================================
// EXPORTS FOR REACT.TSX COMPATIBILITY
// ============================================================================

export interface ParseOptions {
  disableAutoLink?: boolean
  disableBareUrls?: boolean
  disableFrontmatter?: boolean
  disableParsingRawHTML?: boolean
  enforceAtxHeadings?: boolean
  evalUnserializableExpressions?: boolean
  forceBlock?: boolean
  forceInline?: boolean
  ignoreHTMLBlocks?: boolean
  inHTML?: boolean
  inList?: boolean
  optimizeForStreaming?: boolean
  overrides?: { [tag: string]: unknown }
  preserveFrontmatter?: boolean
  sanitizer: (value: string, tag: string, attribute: string) => string | null
  slugify: (input: string) => string
  tagfilter: boolean
}

/** Compiler-option subset the parser reads (renderer-agnostic). */
export interface ParserInputOptions {
  disableAutoLink?: boolean
  disableFrontmatter?: boolean
  disableParsingRawHTML?: boolean
  enforceAtxHeadings?: boolean
  evalUnserializableExpressions?: boolean
  forceBlock?: boolean
  forceInline?: boolean
  ignoreHTMLBlocks?: boolean
  optimizeForStreaming?: boolean
  /** A key matches a capitalized tag ignoring case, which then reads `{...}` values as JSX props; a lowercase tag it lists keeps its handler attributes in `attrs`, as written, out of every raw span */
  overrides?: { [tag: string]: unknown }
  preserveFrontmatter?: boolean
  sanitizer?: (value: string, tag: string, attribute: string) => string | null
  slugify?: (input: string, defaultFn: (input: string) => string) => string
  tagfilter?: boolean
}

/**
 * Normalize compiler options into the ParseOptions shape every renderer should pass.
 * `forceInline` override is for compile-time inline detection.
 */
export function toParseOptions(
  options: ParserInputOptions | null | undefined,
  forceInline?: boolean
): ParseOptions {
  var opts = options || {}
  var userSlugify = opts.slugify
  var resolvedSlugify: (input: string) => string
  if (userSlugify) {
    var customSlugify = userSlugify
    resolvedSlugify = (input: string) => customSlugify(input, util.slugify)
  } else {
    resolvedSlugify = util.slugify
  }
  return {
    disableAutoLink: opts.disableAutoLink,
    disableFrontmatter: opts.disableFrontmatter,
    disableParsingRawHTML: opts.disableParsingRawHTML,
    enforceAtxHeadings: opts.enforceAtxHeadings,
    evalUnserializableExpressions: opts.evalUnserializableExpressions,
    forceBlock: opts.forceBlock,
    forceInline: forceInline === undefined ? opts.forceInline : forceInline,
    ignoreHTMLBlocks: opts.ignoreHTMLBlocks,
    optimizeForStreaming: opts.optimizeForStreaming,
    overrides: opts.overrides,
    preserveFrontmatter: opts.preserveFrontmatter,
    sanitizer: opts.sanitizer || util.sanitizer,
    slugify: resolvedSlugify,
    tagfilter: util.tagfilterEnabled(opts),
  }
}

/** Union of AST nodes that have a children array */
type AstNodeWithChildren = Extract<
  MarkdownToJSX.ASTNode,
  { children: MarkdownToJSX.ASTNode[] }
>

// Regex exports
export const HTML_BLOCK_ELEMENT_START_R_ATTR: RegExp =
  /^<([a-zA-Z][a-zA-Z0-9-]*)\s[^>]*>/
export const UPPERCASE_TAG_R: RegExp = /^<[A-Z]/
// HTML Type 1 tags (raw HTML blocks) — CommonMark §4.6
export var TYPE1_TAG_NAMES: string[] = ['pre', 'script', 'style', 'textarea']
var TYPE1_TAGS = new Set(TYPE1_TAG_NAMES)

/** Matches Type 1 tags in raw HTML text */
var TYPE1_R = /<(?:pre|script|style|textarea)\b/i
// Sticky variant for matching at a specific position without substring allocation
var TYPE1_STICKY_R = /<(?:pre|script|style|textarea)\b/iy
var TYPE1_CLOSER_STICKY_R = /<\/(?:pre|script|style|textarea)>/iy

var LAZY_MARKER = String.fromCharCode($.CHAR_RECORD_SEP)

/** Text a scanner takes in as content, where the lazy line marker has no place */
function dropLazyMarkers(text: string): string {
  return text.indexOf(LAZY_MARKER) === -1
    ? text
    : text.split(LAZY_MARKER).join('')
}

// Detects block-level markdown syntax at the start of a line (heading, list, blockquote, fenced code)
var BLOCK_SYNTAX_R =
  /^(\s{0,3}#[#\s]|\s{0,3}[-*+]\s|\s{0,3}\d+\.\s|\s{0,3}>\s|\s{0,3}```)/m
// enforceAtxHeadings: false variant: a # followed by any character counts as block syntax, a superset of the relaxed heading start (#x)
var BLOCK_SYNTAX_RELAXED_R =
  /^(\s{0,3}#[\s\S]|\s{0,3}[-*+]\s|\s{0,3}\d+\.\s|\s{0,3}>\s|\s{0,3}```)/m
// Heading start at the beginning of inline HTML content, strict and enforceAtxHeadings: false variants
var INLINE_HTML_HEADING_R = /^#{1,6}\s/
var INLINE_HTML_HEADING_RELAXED_R = /^#{1,6}[^#]/

function blockSyntaxFor(opts: ParseOptions): RegExp {
  return opts.enforceAtxHeadings === false
    ? BLOCK_SYNTAX_RELAXED_R
    : BLOCK_SYNTAX_R
}

// Detects HTML opening tags
var HTML_OPEN_TAG_R = /^<([a-z][^ >/\n\r]*) ?([^>]*?)>/im

// Inline special character lookup — true for chars that need processing in parseInline
// ` * _ ~ = [ ! < \ & \n h w f (and alphanumeric for email near @)
// Newline stops the fast-skip so the fused line-break branch can evaluate it.
// & stops it so the entity-reference dispatch can decode in place.
var INLINE_SPECIAL = new Uint8Array(128)
;(() => {
  // Characters that trigger inline scanners
  var specials = [
    $.CHAR_BACKTICK,
    $.CHAR_ASTERISK,
    $.CHAR_UNDERSCORE,
    $.CHAR_TILDE,
    $.CHAR_EQ,
    $.CHAR_BRACKET_OPEN,
    $.CHAR_EXCLAMATION,
    $.CHAR_LT,
    $.CHAR_BACKSLASH,
    $.CHAR_AMPERSAND,
    $.CHAR_NEWLINE,
    $.CHAR_H,
    $.CHAR_W,
    $.CHAR_f,
  ]
  for (var si = 0; si < specials.length; si++) {
    INLINE_SPECIAL[specials[si]] = 1
  }
})()

// Fenced code block attribute regex (hoisted to avoid per-fence allocation)
var FENCE_ATTR_R = /([a-zA-Z_][a-zA-Z0-9_-]*)=(?:"([^"]*)"|'([^']*)')/g

export function isType1Block(tagLower: string): boolean {
  return TYPE1_TAGS.has(tagLower)
}

/** Test if text contains any Type 1 block tags */
export function containsType1Tag(text: string): boolean {
  return TYPE1_R.test(text)
}

/**
 * Validate a table delimiter row without regex (avoids ReDoS from nested
 * quantifiers). Accepts: |? WS? :?-+:? WS? (| WS? :?-+:? WS?)* |? WS?
 * Single linear pass — O(n) guaranteed.
 */
function isDelimiterRow(s: string, start: number, end: number): boolean {
  var i = start
  var len = end
  // skip leading whitespace
  while (
    i < len &&
    (s.charCodeAt(i) === $.CHAR_SPACE || s.charCodeAt(i) === $.CHAR_TAB)
  ) {
    i++
  }
  if (i >= len) {
    return false
  }
  // optional leading pipe
  if (s.charCodeAt(i) === $.CHAR_PIPE) {
    i++
  }
  var cellCount = 0
  while (i < len) {
    // skip whitespace before cell
    while (
      i < len &&
      (s.charCodeAt(i) === $.CHAR_SPACE || s.charCodeAt(i) === $.CHAR_TAB)
    ) {
      i++
    }
    if (i >= len) {
      break
    }
    // trailing pipe with only whitespace after — done
    if (s.charCodeAt(i) === $.CHAR_PIPE && cellCount > 0) {
      // check rest is whitespace
      var j = i + 1
      while (
        j < len &&
        (s.charCodeAt(j) === $.CHAR_SPACE || s.charCodeAt(j) === $.CHAR_TAB)
      ) {
        j++
      }
      if (j >= len) {
        return true
      }
      // not trailing — fall through to parse another cell
    }
    // optional leading colon
    if (s.charCodeAt(i) === $.CHAR_COLON) {
      i++
    }
    // require at least one dash
    if (i >= len || s.charCodeAt(i) !== $.CHAR_DASH) {
      return false
    }
    while (i < len && s.charCodeAt(i) === $.CHAR_DASH) {
      i++
    }
    // optional trailing colon
    if (i < len && s.charCodeAt(i) === $.CHAR_COLON) {
      i++
    }
    cellCount++
    // skip whitespace after cell
    while (
      i < len &&
      (s.charCodeAt(i) === $.CHAR_SPACE || s.charCodeAt(i) === $.CHAR_TAB)
    ) {
      i++
    }
    // pipe separator or end
    if (i < len) {
      if (s.charCodeAt(i) === $.CHAR_PIPE) {
        i++ // consume pipe
      } else {
        return false // unexpected character
      }
    }
  }
  return cellCount > 0
}

/**
 * URL-bearing HTML attributes whose value can smuggle a dangerous scheme
 * (javascript:, vbscript:, or non-image data:). Their values are checked with
 * util.sanitizer after entity decoding; a null result means the attribute is
 * dropped. srcdoc is handled separately (dropped outright as it is raw HTML).
 */
/** C0 control characters and DEL, stripped from a URL before the scheme check. */
const CONTROL_CHARS_R = /[\u0000-\u001F\u007F]/g

const URL_BEARING_ATTRS: { [name: string]: 1 } = {
  action: 1,
  background: 1,
  cite: 1,
  data: 1,
  formaction: 1,
  href: 1,
  longdesc: 1,
  poster: 1,
  src: 1,
  'xlink:href': 1,
  // React writes this name as xlink:href
  xlinkhref: 1,
}

/**
 * Names a renderer acts on rather than writes, read in lowercase. Solid and Vue
 * put innerHTML and outerHTML into the page as markup, and a string or object
 * value of the rest throws while React, Solid, or Vue renders. children is never
 * in raw source: on a tag `overrides` registers, a string value stays in `attrs`
 * (a renderer writes it as the element's content), and an object value, which no
 * component can render as a child, is gone.
 */
const RENDERER_ONLY_ATTRS: { [name: string]: 1 } = {
  children: 1,
  dangerouslysetinnerhtml: 1,
  innerhtml: 1,
  outerhtml: 1,
  ref: 1,
}

const BRACE_OBJECT_VALUE_R = /^\{\s*[[{]/
const BRACE_NAME_WRAPPER_R = /[{}"'`]/g

/**
 * Numeric character references, tolerating a missing trailing semicolon. A
 * browser decodes `&#106avascript:` to `javascript:` (a semicolon-less numeric
 * reference is a parse error but still resolved), so the scheme check must too.
 */
const NUMERIC_ENTITY_R = /&#(x[0-9a-f]+|[0-9]+);?/gi

/**
 * Resolve semicolon-optional numeric character references so an obfuscated URL
 * scheme is caught. Used only to normalize a value before the scheme check,
 * never to rewrite the emitted attribute.
 */
function decodeNumericEntities(value: string): string {
  if (value.indexOf('&#') === -1) {
    return value
  }
  return value.replace(NUMERIC_ENTITY_R, (full, body) => {
    var code =
      body.charCodeAt(0) === $.CHAR_x || body.charCodeAt(0) === $.CHAR_X
        ? Number.parseInt(body.slice(1), 16)
        : Number.parseInt(body, 10)
    return code > 0 && code <= 0x10_ff_ff ? String.fromCodePoint(code) : full
  })
}

/**
 * The options of the parse in progress, for whether its `overrides` matches a tag.
 * Module state rather than a parameter since every tag parse and raw-string screen
 * reads it and most have no options to hand: a tag parsed with none in reach
 * matches nothing, the safe direction. Cleared when a parse ends.
 */
var _parseOptionsForTags: ParseOptions | undefined

function hasOverride(tag: string): boolean {
  return Boolean(util.get(_parseOptionsForTags?.overrides, tag, undefined))
}

/**
 * Decide whether a raw HTML attribute must be stripped for safety. String-valued
 * event handlers (on* attributes) and srcdoc are removed; a bare boolean on* on a
 * component is a prop rather than a handler string, so it is kept.
 * URL-bearing attributes are removed only when their value resolves to a
 * dangerous scheme.
 * The scheme check is intentionally independent of any caller-supplied
 * sanitizer so the raw HTML path is secure by default.
 *
 * `isComponent` is a capitalized tag `overrides` matches. A JSX
 * brace-expression value ({...}) on one is a component prop, not a raw-HTML
 * inline-handler string, so it is kept, handlers included. On every other tag
 * a browser runs a `{...}` handler as a block statement.
 *
 * A name is judged as what it reaches in a renderer rather than as written, and
 * the exemption above does not apply to one no prop value can make safe, or to a
 * URL attribute unless its brace value is an object or array.
 */
function isDangerousAttr(
  name: string,
  value: string,
  isComponent: boolean,
  /** Skips the sanitizer's DEV warning, for a screen that may judge a URL the tag parser already judged */
  quiet?: boolean
): boolean {
  // All three prefixes are four letters; the check spares every other name the regex
  if (
    name.charCodeAt(4) === $.CHAR_COLON &&
    util.SOLID_TARGET_PREFIX_R.test(name)
  ) {
    return isDangerousAttr(name.slice(5), value, isComponent, quiet)
  }
  var lower = name.toLowerCase()
  if (RENDERER_ONLY_ATTRS[lower] === 1) {
    return true
  }
  var isPropBrace = isComponent && value.charCodeAt(0) === $.CHAR_BRACE_OPEN
  if (lower === 'attributename') {
    return !isPropBrace && animatesDangerousAttr(value)
  }
  var isHandler = util.isHandlerName(name)
  // A JSX brace-expression value ({...}) on a component is a prop the renderer
  // resolves, so it is kept, except a brace string on a URL prop (it reaches a
  // component as the URL itself, so the URL screen below reads it). On any other
  // tag it is not a prop, and an on*/dangerous-URL brace value would still emit
  // an executable handler in string output, so it is screened like any other value.
  if (
    isPropBrace &&
    (URL_BEARING_ATTRS[lower] !== 1 || BRACE_OBJECT_VALUE_R.test(value))
  ) {
    return false
  }
  // on* event handlers (case-insensitive), e.g. onclick, onerror, onload
  if (isHandler) {
    // A bare boolean on* on a component (`<MyComponent onClick />`) is a prop
    // set to true, not a string-valued inline handler, so keep it. A
    // string-valued on*, and any on* on another tag, is still stripped.
    return !(isComponent && value === '')
  }
  if (lower === 'srcdoc') {
    return true
  }
  // Inline style url(javascript/vbscript/non-image-data) is stripped from the
  // attrs map in processHtmlAttributes; mark the raw attribute dangerous too
  // so string compilers that emit _rawAttrs cannot reintroduce the payload.
  if (lower === 'style') {
    return /url\s*\(\s*(javascript|vbscript|data:(?!image\/))/i.test(value)
  }
  if (URL_BEARING_ATTRS[lower] === 1) {
    var decoded = decodeNumericEntities(util.decodeEntityReferences(value))
    if (isUnsafeUrl(decoded, quiet)) {
      return true
    }
    // Browsers ignore ASCII tab/newline/CR (and other C0 controls) when
    // resolving a URL scheme, so java&#9;script: becomes javascript:. Strip
    // those and recheck; the raw value is otherwise left untouched.
    var normalized = decoded.replace(CONTROL_CHARS_R, '')
    return normalized !== decoded && isUnsafeUrl(normalized, quiet)
  }
  return false
}

/** Whether an attributeName value names a URL or on* attribute, as a JSX output resolves it: `{href}` reaches it as `href`. */
function animatesDangerousAttr(value: string): boolean {
  var target = decodeNumericEntities(util.decodeEntityReferences(value))
    .replace(BRACE_NAME_WRAPPER_R, '')
    .trim()
    .toLowerCase()
  target = target.slice(target.lastIndexOf(':') + 1)
  return URL_BEARING_ATTRS[target] === 1 || target.slice(0, 2) === 'on'
}

function isUnsafeUrl(url: string, quiet: boolean | undefined): boolean {
  return quiet
    ? util.urlVerdict(url) !== util.URL_VERDICT.safe
    : util.sanitizer(url) === null
}

/**
 * Reassemble a raw opening-tag string from a parsed tag whose dangerous
 * attributes were stripped. Byte output matches the safe reconstruction, not
 * the original source; only called when the tag actually had a dangerous
 * attribute, so safe tags keep their verbatim bytes elsewhere.
 */
function reconstructOpenTag(
  tagResult: {
    _hasSpaceBeforeSlash: boolean
    _isClosing: boolean
    _rawAttrs: string
    _selfClosing: boolean
    _whitespaceBeforeAttrs: string
    tag: string
  },
  /** In place of `_rawAttrs` */
  rawAttrs?: string
): string {
  return (
    '<' +
    (tagResult._isClosing ? '/' : '') +
    tagResult.tag +
    tagResult._whitespaceBeforeAttrs +
    (rawAttrs === undefined ? tagResult._rawAttrs : rawAttrs) +
    (tagResult._selfClosing
      ? tagResult._hasSpaceBeforeSlash
        ? ' />'
        : '/>'
      : '>')
  )
}

/**
 * Rebuild a raw attribute string from safe attribute spans, dropping the
 * source spans of dangerous attributes. Inter-attribute whitespace is
 * normalized to a single space; whitespace inside a value is preserved.
 */
function buildSafeRawAttrs(
  source: string,
  from: number,
  to: number,
  dangerSpans: number[]
): string {
  var parts: string[] = []
  var cursor = from
  for (var k = 0; k < dangerSpans.length; k += 2) {
    var spanStart = dangerSpans[k]
    if (spanStart > cursor) {
      var seg = source.slice(cursor, spanStart).trim()
      if (seg) {
        parts.push(seg)
      }
    }
    cursor = dangerSpans[k + 1]
  }
  if (cursor < to) {
    var tail = source.slice(cursor, to).trim()
    if (tail) {
      parts.push(tail)
    }
  }
  return parts.join(' ')
}

/** The [start, end] pairs of `spans` other than the one starting at `start`. */
function spansWithout(spans: number[] | null, start: number): number[] {
  var rest: number[] = []
  if (spans !== null) {
    for (var k = 0; k < spans.length; k += 2) {
      if (spans[k] !== start) {
        rest.push(spans[k], spans[k + 1])
      }
    }
  }
  return rest
}

/**
 * Longest read of a tag hidden in a quoted value, and longest read past a
 * parsed tag's own end. A read that gets there counts as dangerous, which keeps
 * the screen linear.
 */
var HIDDEN_TAG_READ_LIMIT = 1024

/**
 * A character inside a brace value that a browser reads differently: it ends an
 * unquoted value at whitespace or `>`, and a quote after whitespace opens a
 * value of its own
 */
function isBraceReadStop(c: number): boolean {
  return (
    util.isASCIIWhitespace(c) ||
    c === $.CHAR_GT ||
    c === $.CHAR_DOUBLE_QUOTE ||
    c === $.CHAR_SINGLE_QUOTE
  )
}

export function isASCIILetter(c: number): boolean {
  return (c | 0x20) >= $.CHAR_a && (c | 0x20) <= $.CHAR_z
}

/**
 * Whether the last browserTagEnd span must be neutralized: it holds an
 * attribute isDangerousAttr rejects, it hides a tag with one, or it is still
 * open at the end of the string, where it would read on into whatever markup
 * is emitted next
 */
var _browserTagUnsafe = false

/**
 * End of the tag at `lt` (a `<` then an ASCII letter; pass the `/` of an end
 * tag as `lt`) as a browser's tokenizer reads it: just past the first `>`
 * outside a quoted value, or the end of the string. Every attribute counts,
 * including names a tag parser rejects (`<img` inside `<div\n<img onerror=x>`
 * is an attribute of the div) and pieces of a brace value. `ownAttrs` is the
 * parsed attributes of a component (see isDangerousAttr), and null otherwise: a piece keeps
 * the exemption for a `{`-leading value only when it starts the parsed value of
 * the same name. Sets `_browserTagUnsafe`.
 *
 * Every `<` then letter in a quoted value is read the same way, past the
 * value's close: the string can land in a tokenizer state that ends the value
 * early (an earlier piece's open comment, `<noscript>`). `hiddenEnd` marks such
 * a read and stops it there. It has no attributes of its own and enumerates
 * nothing itself, since the outer read reaches every `<` in its values.
 */
export function browserTagEnd(
  html: string,
  lt: number,
  ownAttrs: Record<string, string> | null,
  hiddenEnd?: number
): number {
  var len = hiddenEnd === undefined ? html.length : hiddenEnd
  var i = lt + 2
  var hiddenReadEnd = 0
  _browserTagUnsafe = false
  while (i < len) {
    var c = html.charCodeAt(i)
    if (util.isASCIIWhitespace(c) || c === $.CHAR_SLASH || c === $.CHAR_GT) {
      break
    }
    i++
  }
  while (i < len) {
    c = html.charCodeAt(i)
    if (c === $.CHAR_GT) {
      // Past this tag a hidden read's closing quote is text, which an output can
      // write as `&quot;`, so a browser's read goes on to a quote in a later block
      _browserTagUnsafe = _browserTagUnsafe || hiddenReadEnd > i + 1
      return i + 1
    }
    if (util.isASCIIWhitespace(c) || c === $.CHAR_SLASH) {
      i++
      continue
    }
    // A name runs to whitespace, `/`, `>`, or `=`; a leading `=` belongs to it
    var nameStart = i
    i++
    while (i < len) {
      c = html.charCodeAt(i)
      if (
        util.isASCIIWhitespace(c) ||
        c === $.CHAR_SLASH ||
        c === $.CHAR_GT ||
        c === $.CHAR_EQ
      ) {
        break
      }
      i++
    }
    var name = html.slice(nameStart, i)
    while (i < len && util.isASCIIWhitespace(html.charCodeAt(i))) {
      i++
    }
    var value = ''
    var quotedStart = -1
    if (i < len && html.charCodeAt(i) === $.CHAR_EQ) {
      i++
      while (i < len && util.isASCIIWhitespace(html.charCodeAt(i))) {
        i++
      }
      var quote = html.charCodeAt(i)
      if (quote === $.CHAR_DOUBLE_QUOTE || quote === $.CHAR_SINGLE_QUOTE) {
        quotedStart = ++i
        while (i < len && html.charCodeAt(i) !== quote) {
          i++
        }
        value = html.slice(quotedStart, i)
        i++
      } else {
        var valueStart = i
        while (i < len) {
          c = html.charCodeAt(i)
          if (util.isASCIIWhitespace(c) || c === $.CHAR_GT) {
            break
          }
          i++
        }
        value = html.slice(valueStart, i)
      }
    }
    if (!_browserTagUnsafe) {
      var ownValue =
        ownAttrs === null ? undefined : util.overrideValue(ownAttrs, name)
      // A piece that starts an own value keeps the exemptions of a component
      _browserTagUnsafe = isDangerousAttr(
        name,
        value,
        ownValue?.startsWith(value) === true,
        true
      )
    }
    if (hiddenEnd === undefined && quotedStart !== -1) {
      var hidden = value.indexOf('<')
      while (hidden !== -1 && !_browserTagUnsafe) {
        if (isASCIILetter(value.charCodeAt(hidden + 1))) {
          var hiddenLt = quotedStart + hidden
          hiddenReadEnd = Math.max(
            hiddenReadEnd,
            browserTagEnd(
              html,
              hiddenLt,
              null,
              Math.min(len, hiddenLt + HIDDEN_TAG_READ_LIMIT)
            )
          )
        }
        hidden = value.indexOf('<', hidden + 1)
      }
    }
  }
  // Out of string is a tag open at the end, for a hidden read too: its open
  // quote carries a browser's read into the next emitted block
  _browserTagUnsafe = true
  return len
}

/**
 * The spans of a parsed tag's attributes a browser can read differently are
 * dropped from its raw attributes when its read of the tag is unsafe. The
 * parsed `attrs` keep them: the JSX outputs escape a value as a whole.
 */
function withBrowserReadSpans(
  source: string,
  pos: number,
  end: number,
  ownAttrs: Record<string, string> | null,
  dangerSpans: number[] | null,
  readSpans: number[]
): number[] | null {
  // The opener is walked already; past it, a value a brace value's split opened
  // can run on, and capping that is what keeps a run of such tags linear
  var capped = source.slice(0, end + HIDDEN_TAG_READ_LIMIT)
  // What goes from a component is gone for a browser too. Blanks keep
  // every position, and a tag's own span keeps a run of such tags linear
  if (dangerSpans !== null && ownAttrs !== null) {
    var blanked = capped.slice(pos, dangerSpans[0])
    for (var d = 0; d < dangerSpans.length; d += 2) {
      blanked +=
        ' '.repeat(dangerSpans[d + 1] - dangerSpans[d]) +
        capped.slice(
          dangerSpans[d + 1],
          d + 2 < dangerSpans.length ? dangerSpans[d + 2] : capped.length
        )
    }
    capped = blanked
    end -= pos
    pos = 0
  }
  var readEnd = browserTagEnd(
    capped,
    capped.charCodeAt(pos + 1) === $.CHAR_SLASH ? pos + 1 : pos,
    ownAttrs
  )
  // A `>` in a brace value ends the tag early, so the rest of the value is markup
  while (!_browserTagUnsafe && readEnd < end) {
    var next = capped.indexOf('<', readEnd)
    if (next === -1 || next >= end) {
      break
    }
    var isEndTag = capped.charCodeAt(next + 1) === $.CHAR_SLASH
    readEnd = isASCIILetter(capped.charCodeAt(next + (isEndTag ? 2 : 1)))
      ? browserTagEnd(capped, isEndTag ? next + 1 : next, null)
      : next + 1
  }
  if (!_browserTagUnsafe) {
    return dangerSpans
  }
  if (dangerSpans === null) {
    return readSpans
  }
  var merged: number[] = []
  var a = 0
  var b = 0
  while (a < dangerSpans.length || b < readSpans.length) {
    if (b >= readSpans.length || dangerSpans[a] < readSpans[b]) {
      merged.push(dangerSpans[a], dangerSpans[a + 1])
      a += 2
    } else {
      merged.push(readSpans[b], readSpans[b + 1])
      b += 2
    }
  }
  return merged
}

// Parse an HTML tag at position. `quiet` skips the DEV warnings for stripped
// attributes, and `forRawScreen` leaves a browser's differing read to the caller.
function __parseHtmlTag(
  source: string,
  pos: number,
  quiet?: boolean,
  forRawScreen?: boolean
): {
  /**
   * True when a browser can read this tag differently from ours: a JSX
   * brace-expression value holds whitespace, a quote, or `>` (a browser splits
   * it into attributes or ends the tag inside it), or a quoted value holds a
   * `<` then a letter (a tokenizer state the string lands in can end the value
   * early and read that tag).
   */
  _browserReadDiffers: boolean
  _hasSpaceBeforeSlash: boolean
  _isClosing: boolean
  /** A capitalized tag `overrides` matches, which the screen exempts as a component. */
  _isComponent: boolean
  /** PascalCase JSX component or hyphenated custom element, for block structure. */
  _isComponentTag: boolean
  _rawAttrs: string
  /**
   * `_rawAttrs` with the `children` attribute kept in `attrs` left in, for the
   * span the JSX renderers re-parse; undefined when no such attribute was cut.
   */
  _rawAttrsKeepingChildren: string | undefined
  /** True when one or more dangerous attributes were stripped from this tag. */
  _sanitized: boolean
  _selfClosing: boolean
  _whitespaceBeforeAttrs: string
  attrs: Record<string, string>
  end: number
  tag: string
} | null {
  if (source.charCodeAt(pos) !== $.CHAR_LT) {
    return null // <
  }

  let i = pos + 1
  const len = source.length

  let isClosing = false
  if (source.charCodeAt(i) === $.CHAR_SLASH) {
    // /
    i++
    isClosing = true
  }

  const nameStart = i
  const first = source.charCodeAt(i)
  if (
    !(
      (first >= $.CHAR_a && first <= $.CHAR_z) ||
      (first >= $.CHAR_A && first <= $.CHAR_Z)
    )
  ) {
    return null
  }

  while (
    i < len &&
    ((source.charCodeAt(i) >= $.CHAR_a && source.charCodeAt(i) <= $.CHAR_z) ||
      (source.charCodeAt(i) >= $.CHAR_A && source.charCodeAt(i) <= $.CHAR_Z) ||
      (source.charCodeAt(i) >= $.CHAR_DIGIT_0 &&
        source.charCodeAt(i) <= $.CHAR_DIGIT_9) ||
      source.charCodeAt(i) === $.CHAR_DASH)
  ) {
    i++
  }
  const tag = source.slice(nameStart, i)
  if (!tag) {
    return null
  }

  // A capitalized or hyphenated tag nests blank-line content (#870); only a
  // capitalized one `overrides` matches is a component the screen exempts
  // (isDangerousAttr)
  const tagFirstChar = tag.charCodeAt(0)
  const isCapitalized = tagFirstChar >= $.CHAR_A && tagFirstChar <= $.CHAR_Z
  const isComponentTag = isCapitalized || tag.indexOf('-') !== -1
  const isComponent = isCapitalized && hasOverride(tag)

  const wsStart = i
  while (
    i < len &&
    (source.charCodeAt(i) === $.CHAR_SPACE ||
      source.charCodeAt(i) === $.CHAR_TAB ||
      source.charCodeAt(i) === $.CHAR_NEWLINE)
  ) {
    i++
  }
  const whitespaceBeforeAttrs = source.slice(wsStart, i)
  // After tag name, must have whitespace before attributes, or > or />
  if (i === wsStart && i < len) {
    var nextC = source.charCodeAt(i)
    if (nextC !== $.CHAR_GT && nextC !== $.CHAR_SLASH) {
      return null // not > or /
    }
  }
  const attrStartPos = i
  const attrs: Record<string, string> = {}
  let hasSpaceBeforeSlash = false
  /**
   * Source spans [start, end, ...] of dangerous attributes, recorded lazily.
   * Stays null on the common safe path so rawAttrs uses the fast raw slice.
   */
  var dangerSpans: number[] | null = null
  /** Source spans of attributes a browser can read differently; null on the common path. */
  var readSpans: number[] | null = null
  var valueReadsDifferently = false
  /** Start of the `children` attribute kept as a prop, whose span is also in dangerSpans; -1 on the common path. */
  var keptChildrenStart = -1

  while (i < len) {
    const c = source.charCodeAt(i)
    if (c === $.CHAR_GT) {
      // >
      if (readSpans !== null && !forRawScreen) {
        dangerSpans = withBrowserReadSpans(
          source,
          pos,
          i + 1,
          isComponent ? attrs : null,
          dangerSpans,
          readSpans
        )
      }
      const rawAttrs = dangerSpans
        ? buildSafeRawAttrs(source, attrStartPos, i, dangerSpans)
        : source.slice(attrStartPos, i)
      return {
        _browserReadDiffers: readSpans !== null,
        _hasSpaceBeforeSlash: hasSpaceBeforeSlash,
        _isClosing: isClosing,
        _isComponent: isComponent,
        _isComponentTag: isComponentTag,
        _rawAttrs: rawAttrs,
        _rawAttrsKeepingChildren:
          keptChildrenStart === -1
            ? undefined
            : buildSafeRawAttrs(
                source,
                attrStartPos,
                i,
                spansWithout(dangerSpans, keptChildrenStart)
              ),
        _sanitized: dangerSpans != null,
        _selfClosing: false,
        _whitespaceBeforeAttrs: whitespaceBeforeAttrs,
        attrs,
        end: i + 1,
        tag,
      }
    }
    if (c === $.CHAR_SPACE || c === $.CHAR_TAB || c === $.CHAR_NEWLINE) {
      i++
      continue
    }
    if (
      c === $.CHAR_SLASH &&
      i + 1 < len &&
      source.charCodeAt(i + 1) === $.CHAR_GT
    ) {
      // />
      hasSpaceBeforeSlash =
        i > attrStartPos && source.charCodeAt(i - 1) === $.CHAR_SPACE
      if (readSpans !== null && !forRawScreen) {
        dangerSpans = withBrowserReadSpans(
          source,
          pos,
          i + 2,
          isComponent ? attrs : null,
          dangerSpans,
          readSpans
        )
      }
      const rawAttrs = dangerSpans
        ? buildSafeRawAttrs(source, attrStartPos, i, dangerSpans)
        : source.slice(attrStartPos, i)
      return {
        _browserReadDiffers: readSpans !== null,
        _hasSpaceBeforeSlash: hasSpaceBeforeSlash,
        _isClosing: isClosing,
        _isComponent: isComponent,
        _isComponentTag: isComponentTag,
        _rawAttrs: rawAttrs,
        _rawAttrsKeepingChildren:
          keptChildrenStart === -1
            ? undefined
            : buildSafeRawAttrs(
                source,
                attrStartPos,
                i,
                spansWithout(dangerSpans, keptChildrenStart)
              ),
        _sanitized: dangerSpans != null,
        _selfClosing: true,
        _whitespaceBeforeAttrs: whitespaceBeforeAttrs,
        attrs,
        end: i + 2,
        tag,
      }
    }

    // Parse attribute name per CommonMark: [a-zA-Z_:][a-zA-Z0-9_.:-]*
    var attrStart = i
    var fc = source.charCodeAt(i)
    if (
      !(
        (fc >= $.CHAR_a && fc <= $.CHAR_z) ||
        (fc >= $.CHAR_A && fc <= $.CHAR_Z) ||
        fc === $.CHAR_UNDERSCORE ||
        fc === $.CHAR_COLON
      )
    ) {
      // Invalid attribute name start character - invalid tag
      return null
    }
    i++
    while (i < len) {
      var ac = source.charCodeAt(i)
      if (
        (ac >= $.CHAR_a && ac <= $.CHAR_z) ||
        (ac >= $.CHAR_A && ac <= $.CHAR_Z) ||
        (ac >= $.CHAR_DIGIT_0 && ac <= $.CHAR_DIGIT_9) ||
        ac === $.CHAR_UNDERSCORE ||
        ac === $.CHAR_PERIOD ||
        ac === $.CHAR_COLON ||
        ac === $.CHAR_DASH
      ) {
        i++
      } else {
        break
      }
    }
    var attrName = source.slice(attrStart, i)
    var attrNameEnd = i

    // Skip whitespace
    while (
      i < len &&
      (source.charCodeAt(i) === $.CHAR_SPACE ||
        source.charCodeAt(i) === $.CHAR_TAB)
    ) {
      i++
    }

    var attrValue: string
    var attrEnd: number
    // Check for =
    if (source.charCodeAt(i) === $.CHAR_EQ) {
      i++ // skip =

      // Skip whitespace
      while (
        i < len &&
        (source.charCodeAt(i) === $.CHAR_SPACE ||
          source.charCodeAt(i) === $.CHAR_TAB)
      ) {
        i++
      }

      // Parse value
      var quote = source.charCodeAt(i)
      if (quote === $.CHAR_DOUBLE_QUOTE || quote === $.CHAR_SINGLE_QUOTE) {
        // " or '
        i++
        var valueStart = i
        // Newlines are allowed in quoted attribute values per CommonMark
        while (i < len) {
          var qc = source.charCodeAt(i)
          if (qc === quote) {
            break
          }
          if (qc === $.CHAR_LT && isASCIILetter(source.charCodeAt(i + 1))) {
            valueReadsDifferently = true
          }
          i++
        }
        if (i >= len) {
          return null // unclosed quote
        }
        attrValue = source.slice(valueStart, i)
        i++ // skip closing quote
        // After a quoted value, next must be whitespace, >, or />
        if (i < len) {
          var afterQuote = source.charCodeAt(i)
          if (
            afterQuote !== $.CHAR_SPACE &&
            afterQuote !== $.CHAR_TAB &&
            afterQuote !== $.CHAR_NEWLINE &&
            afterQuote !== $.CHAR_GT &&
            afterQuote !== $.CHAR_SLASH
          ) {
            return null
          }
        }
        attrEnd = i
      } else if (quote === $.CHAR_BRACE_OPEN) {
        // {
        var depth = 1
        var valueStart = i
        i++
        while (i < len && depth > 0) {
          var ac = source.charCodeAt(i)
          if (ac === $.CHAR_BRACE_OPEN) {
            depth++
          } else if (ac === $.CHAR_BRACE_CLOSE) {
            depth--
          } else if (isBraceReadStop(ac)) {
            valueReadsDifferently = true
          }
          i++
        }
        attrValue = source.slice(valueStart, i)
        attrEnd = i
      } else {
        // Unquoted value: can't contain " ' = < > ` or whitespace
        var valueStart = i
        while (i < len) {
          var vc = source.charCodeAt(i)
          if (
            vc === $.CHAR_SPACE ||
            vc === $.CHAR_TAB ||
            vc === $.CHAR_GT ||
            vc === $.CHAR_NEWLINE ||
            vc === $.CHAR_DOUBLE_QUOTE ||
            vc === $.CHAR_SINGLE_QUOTE ||
            vc === $.CHAR_EQ ||
            vc === $.CHAR_LT ||
            vc === $.CHAR_BACKTICK
          ) {
            break
          }
          i++
        }
        if (i === valueStart) {
          return null // empty unquoted value
        }
        attrValue = source.slice(valueStart, i)
        attrEnd = i
      }
    } else {
      // Boolean attribute (no value); span ends at the name.
      attrValue = ''
      attrEnd = attrNameEnd
    }

    if (isDangerousAttr(attrName, attrValue, isComponent, quiet)) {
      if (dangerSpans === null) {
        dangerSpans = []
      }
      dangerSpans.push(attrStart, attrEnd)
      // Out of raw source, but still in attrs on a tag an override matches, a
      // lowercase one too: a handler as written text for renderRule and
      // parser() users, which every renderer drops (util.withoutHandlerSource),
      // and a child string, safe in any
      if (!isCapitalized && util.isHandlerName(attrName) && hasOverride(tag)) {
        attrs[attrName] = attrValue
      } else if (
        attrName.toLowerCase() === 'children' &&
        !BRACE_OBJECT_VALUE_R.test(attrValue) &&
        hasOverride(tag)
      ) {
        // One key for any casing, since renderers read a registered tag's
        // content from it
        attrs.children = attrValue
        keptChildrenStart = attrStart
      }
      // Style XSS is screened here so string compilers cannot re-emit it via
      // _rawAttrs; keep the same DEV warn processHtmlAttributes used to emit.
      if (
        process.env.NODE_ENV !== 'production' &&
        !quiet &&
        attrName.toLowerCase() === 'style'
      ) {
        console.warn(
          'Style attribute contains an unsafe URL expression, it will not be rendered.',
          attrValue
        )
      }
    } else {
      attrs[attrName] = attrValue
      if (valueReadsDifferently) {
        if (readSpans === null) {
          readSpans = []
        }
        readSpans.push(attrStart, attrEnd)
      }
    }
    valueReadsDifferently = false
  }

  return null
}

var LT_R = /</g

/**
 * Where stripDangerousHtml writes its result with the `children` attribute of
 * each tag that keeps it as a prop left in, or undefined when it cut none. Only
 * the span a JSX renderer re-parses (`_reparseSource`) takes it.
 */
interface KeepingChildrenSink {
  keepingChildren: string | undefined
}

/**
 * Strip dangerous attributes from every tag in a raw HTML string, reusing
 * __parseHTMLTag as the single tag scanner so nested tags are covered too.
 * Tag boundaries follow a browser's reading wherever the parser's could differ
 * (a rejected tag, a brace value, a quoted value holding a tag), and a tag still
 * open at the end of the string is escaped. Returns the input unchanged (same
 * reference) when nothing is stripped, so safe content stays byte-identical and
 * allocation-free. Guards the raw-HTML output paths (html string compiler,
 * solid/vue innerHTML) that emit raw source verbatim and so bypass the sanitized
 * attrs map. `quiet` as in __parseHtmlTag. A `sink` takes the same result with
 * a kept children attribute left in.
 */
export function stripDangerousHtml(
  html: string,
  quiet?: boolean,
  sink?: KeepingChildrenSink
): string {
  var once = screenRawTags(html, quiet, sink)
  if (once === html) {
    return html
  }
  // A removed attribute takes its quotes with it, which re-pairs a quote left
  // open earlier in the string, so a rewrite is not settled until it reads the
  // same. A string that a second read changes too keeps no tag, which keeps
  // this to two passes
  if (screenRawTags(once, true) === once) {
    return once
  }
  if (sink !== undefined) {
    // No tag is left to hold a children attribute
    sink.keepingChildren = undefined
  }
  return once.replace(LT_R, '&lt;')
}

/**
 * Index past a tag with no attributes at `lt`, or -1. `<p>` and `</p>` make up most
 * tags, hold nothing to screen, and read the same to a browser, so they skip the
 * full tag parse.
 */
function bareTagEnd(html: string, lt: number): number {
  var i = lt + 1
  if (html.charCodeAt(i) === $.CHAR_SLASH) {
    i++
  }
  if (!isASCIILetter(html.charCodeAt(i))) {
    return -1
  }
  var code = html.charCodeAt(++i)
  while (
    isASCIILetter(code) ||
    (code >= $.CHAR_DIGIT_0 && code <= $.CHAR_DIGIT_9) ||
    code === $.CHAR_DASH
  ) {
    code = html.charCodeAt(++i)
  }
  return code === $.CHAR_GT ? i + 1 : -1
}

/**
 * One read of a raw string for stripDangerousHtml; the same reference when
 * nothing changes. A `sink` takes the result of the same decisions with a kept
 * children attribute left in.
 */
function screenRawTags(
  html: string,
  quiet: boolean | undefined,
  sink?: KeepingChildrenSink
): string {
  var lt = html.indexOf('<')
  if (lt === -1) {
    return html
  }
  var out = ''
  // Starts as a copy of `out` at the first tag that keeps a children attribute,
  // then takes every piece `out` takes, with that attribute left in
  var keeping: string | undefined
  var cursor = 0
  var changed = false
  while (lt !== -1) {
    var bareEnd = bareTagEnd(html, lt)
    if (bareEnd !== -1) {
      lt = html.indexOf('<', bareEnd)
      continue
    }
    var tagResult = __parseHtmlTag(html, lt, quiet, true)
    var piece: string
    if (
      tagResult?._sanitized &&
      tagResult._browserReadDiffers &&
      tagResult._isComponent
    ) {
      // What goes from a component goes whatever a browser reads, and
      // what a browser reads of the rest decides the rest. A children attribute
      // goes here too: the rest is read again without it
      piece =
        html.slice(cursor, lt) +
        screenRawTags(reconstructOpenTag(tagResult), quiet)
      out += piece
      if (keeping !== undefined) {
        keeping += piece
      }
      cursor = tagResult.end
      changed = true
      lt = html.indexOf('<', tagResult.end)
    } else if (tagResult && !tagResult._browserReadDiffers) {
      if (tagResult._sanitized) {
        var gap = html.slice(cursor, lt)
        var keptAttrs = tagResult._rawAttrsKeepingChildren
        if (
          keeping === undefined &&
          keptAttrs !== undefined &&
          sink !== undefined
        ) {
          keeping = out
        }
        out += gap + reconstructOpenTag(tagResult)
        if (keeping !== undefined) {
          keeping += gap + reconstructOpenTag(tagResult, keptAttrs)
        }
        cursor = tagResult.end
        changed = true
      }
      lt = html.indexOf('<', tagResult.end)
    } else if (tagResult || isASCIILetter(html.charCodeAt(lt + 1))) {
      // A tag to a browser that the parser rejects, or one a browser can read
      // differently: the browser's reading decides. Every `<` before its end is
      // inside the tag, so escaping each of them leaves the whole span as text;
      // the scan resumes at the browser's end, so tags inside a brace value are
      // screened as tags
      var tagEnd = browserTagEnd(
        html,
        tagResult?._isClosing ? lt + 1 : lt,
        tagResult?._isComponent ? tagResult.attrs : null
      )
      if (_browserTagUnsafe) {
        piece =
          html.slice(cursor, lt) + html.slice(lt, tagEnd).replace(LT_R, '&lt;')
        out += piece
        if (keeping !== undefined) {
          keeping += piece
        }
        cursor = tagEnd
        changed = true
      }
      lt = html.indexOf('<', tagEnd)
    } else {
      // A comment, processing instruction, declaration, CDATA section, or a
      // plain `<`: the string can land in any tokenizer state, so what follows
      // is read as usual
      lt = html.indexOf('<', lt + 1)
    }
  }
  if (!changed) {
    return html
  }
  var rest = html.slice(cursor)
  if (keeping !== undefined && sink !== undefined) {
    sink.keepingChildren = keeping + rest
  }
  return out + rest
}

// Collect reference definitions in first pass
export function collectReferenceDefinitions(
  input: string,
  refs: { [key: string]: { target: string; title: string | undefined } },
  _options: ParseOptions
): boolean {
  // Fast-path exit: without '[' there cannot be any reference definitions.
  // Streaming callers need fence detection and take the slow path.
  if (!_options.optimizeForStreaming && input.indexOf('[') === -1) {
    return false
  }
  var pos = 0
  var len = input.length
  // Track whether prev line was paragraph content — ref defs can't interrupt paragraphs
  var prevWasContent = false
  var endsInsideFence = false

  while (pos < len) {
    var lineEnd = input.indexOf('\n', pos)
    var end = lineEnd < 0 ? len : lineEnd

    // Skip leading whitespace (up to 3 spaces)
    var i = pos
    var spaces = 0
    while (i < end && spaces < 4) {
      if (input.charCodeAt(i) === $.CHAR_SPACE) {
        spaces++
        i++
      } else if (input.charCodeAt(i) === $.CHAR_TAB) {
        spaces += 4
        i++
      } else {
        break
      }
    }

    // Check for blank line
    if (i >= end) {
      prevWasContent = false
      pos = lineEnd < 0 ? len : lineEnd + 1
      continue
    }

    // Skip fenced code blocks (``` or ~~~)
    if (spaces < 4) {
      var fc = input.charCodeAt(i)
      if (fc === $.CHAR_BACKTICK || fc === $.CHAR_TILDE) {
        var fenceChar = fc
        var fenceCount = 0
        var fi = i
        while (fi < end && input.charCodeAt(fi) === fenceChar) {
          fenceCount++
          fi++
        }
        if (fenceCount >= 3) {
          // Backtick fences: info string must not contain backticks
          var validFence = true
          if (fenceChar === $.CHAR_BACKTICK) {
            for (var bi = fi; bi < end; bi++) {
              if (input.charCodeAt(bi) === $.CHAR_BACKTICK) {
                validFence = false
                break
              }
            }
          }
          if (validFence) {
            prevWasContent = false
            // Skip fenced block: scan for close fence using direct charCode walk
            // Avoids per-line indexOf('\n') overhead for 5000+ fenced lines in large docs
            var scanPos = lineEnd < 0 ? len : lineEnd + 1
            while (scanPos < len) {
              // Skip indent (up to 3 spaces)
              var ci = scanPos
              var cSp = 0
              while (ci < len && cSp < 4) {
                var cc = input.charCodeAt(ci)
                if (cc === $.CHAR_SPACE) {
                  cSp++
                  ci++
                } else if (cc === $.CHAR_TAB) {
                  cSp += 4
                  ci++
                } else {
                  break
                }
              }
              // Check for fence chars
              if (cSp < 4 && ci < len && input.charCodeAt(ci) === fenceChar) {
                var cf = 0
                while (ci < len && input.charCodeAt(ci) === fenceChar) {
                  cf++
                  ci++
                }
                if (cf >= fenceCount) {
                  // Check rest of line is whitespace
                  while (
                    ci < len &&
                    (input.charCodeAt(ci) === $.CHAR_SPACE ||
                      input.charCodeAt(ci) === $.CHAR_TAB)
                  ) {
                    ci++
                  }
                  if (ci >= len || input.charCodeAt(ci) === $.CHAR_NEWLINE) {
                    pos = ci >= len ? len : ci + 1
                    break
                  }
                }
              }
              // Skip to next line
              while (
                scanPos < len &&
                input.charCodeAt(scanPos) !== $.CHAR_NEWLINE
              ) {
                scanPos++
              }
              if (scanPos < len) {
                scanPos++ // skip past \n
              }
            }
            if (scanPos >= len) {
              pos = len
              endsInsideFence = true
            }
            continue
          }
        }
      }
    }

    // Strip blockquote markers to find ref defs inside blockquotes
    var ri = i
    while (ri < end && input.charCodeAt(ri) === $.CHAR_GT) {
      // >
      ri++
      if (ri < end && input.charCodeAt(ri) === $.CHAR_SPACE) {
        ri++ // optional space after >
      }
      // Re-check leading whitespace after >
      var bqSpaces = 0
      while (ri < end && bqSpaces < 4) {
        if (input.charCodeAt(ri) === $.CHAR_SPACE) {
          bqSpaces++
          ri++
        } else if (input.charCodeAt(ri) === $.CHAR_TAB) {
          bqSpaces += 4
          ri++
        } else {
          break
        }
      }
      if (bqSpaces >= 4) {
        break // indented code block inside blockquote
      }
      prevWasContent = false // blockquote marker resets paragraph context
    }

    // Check for [ (potential reference definition, not footnote [^)
    // Link ref defs cannot interrupt paragraphs
    if (
      !prevWasContent &&
      spaces < 4 &&
      ri < end &&
      input.charCodeAt(ri) === $.CHAR_BRACKET_OPEN &&
      !(ri + 1 < len && input.charCodeAt(ri + 1) === $.CHAR_CARET)
    ) {
      var result = parseRefDef(input, ri, refs)
      if (result) {
        pos = result
        prevWasContent = false
        continue
      }
    }

    // Determine if this line is paragraph-like content or a self-contained block
    // Headings, thematic breaks, and HTML block openers don't create paragraph context
    var lineC = input.charCodeAt(i)
    if (lineC === $.CHAR_HASH && spaces < 4) {
      // # heading
      prevWasContent = false
    } else if (
      spaces < 4 &&
      (lineC === $.CHAR_DASH ||
        lineC === $.CHAR_ASTERISK ||
        lineC === $.CHAR_UNDERSCORE)
    ) {
      // Could be thematic break — check
      var tbp = i
      var tbCount = 0
      while (tbp < end) {
        var tbc = input.charCodeAt(tbp)
        if (tbc === lineC) {
          tbCount++
        } else if (tbc !== $.CHAR_SPACE && tbc !== $.CHAR_TAB) {
          break
        }
        tbp++
      }
      prevWasContent = !(tbCount >= 3 && tbp >= end)
    } else {
      prevWasContent = true
    }
    // Move to next line
    pos = lineEnd < 0 ? len : lineEnd + 1
  }
  return endsInsideFence
}

// Parse a reference definition [label]: url "title" or footnote [^id]: content
function parseRefDef(
  s: string,
  p: number,
  refs: { [key: string]: { target: string; title: string | undefined } }
): number | null {
  const len = s.length
  if (s.charCodeAt(p) !== $.CHAR_BRACKET_OPEN) {
    return null // [
  }

  // Check for footnote definition [^
  const isFootnote = p + 1 < len && s.charCodeAt(p + 1) === $.CHAR_CARET

  // Find label end - per CommonMark, labels cannot contain unescaped brackets
  let i = p + 1
  while (i < len) {
    var c = s.charCodeAt(i)
    if (c === $.CHAR_BRACKET_CLOSE) {
      i++
      break
    } // ]
    if (c === $.CHAR_BRACKET_OPEN) {
      return null // unescaped [ in label
    }
    if (c === $.CHAR_BACKSLASH && i + 1 < len) {
      i++ // escape
    }
    i++
  }
  if (i > len || s.charCodeAt(i - 1) !== $.CHAR_BRACKET_CLOSE) {
    return null
  }

  const rawLabel = dropLazyMarkers(s.slice(p + 1, i - 1))
  // Label must not exceed 999 chars per CommonMark spec
  if (rawLabel.length > 999) {
    return null
  }
  const label = normalizeLabel(rawLabel)
  if (!label) {
    return null
  }

  // Expect :
  if (i >= len || s.charCodeAt(i) !== $.CHAR_COLON) {
    return null
  }
  i++

  // Skip whitespace (including one optional newline)
  let hasNewline = false
  while (i < len) {
    const c = s.charCodeAt(i)
    if (c === $.CHAR_SPACE || c === $.CHAR_TAB) {
      i++
    } else if (c === $.CHAR_NEWLINE && !hasNewline) {
      hasNewline = true
      i++
    } else if (c === $.CHAR_RECORD_SEP && hasNewline) {
      i++
    } else {
      break
    }
  }

  if (isFootnote) {
    // Footnote: collect content to end of line (simplified)
    const lineEnd = s.indexOf('\n', i)
    const contentEnd = lineEnd < 0 ? len : lineEnd
    const content = s.slice(i, contentEnd).trim()
    refs[label] = { target: content, title: undefined }
    return lineEnd < 0 ? len : lineEnd + 1
  }

  // Regular ref: parse URL
  var url: string
  if (i < len && s.charCodeAt(i) === $.CHAR_LT) {
    // <url>
    i++
    var urlStart = i
    while (
      i < len &&
      s.charCodeAt(i) !== $.CHAR_GT &&
      s.charCodeAt(i) !== $.CHAR_NEWLINE
    ) {
      // A line break ends the destination even after a backslash
      if (
        s.charCodeAt(i) === $.CHAR_BACKSLASH &&
        i + 1 < len &&
        s.charCodeAt(i + 1) !== $.CHAR_NEWLINE
      ) {
        i++ // escape
      }
      i++
    }
    if (i >= len || s.charCodeAt(i) !== $.CHAR_GT) {
      return null
    }
    url = s.slice(urlStart, i)
    i++
    // Check that nothing follows the > on this line except whitespace or a title
    var afterUrlEnd = s.indexOf('\n', i)
    var afterUrlEol = afterUrlEnd < 0 ? len : afterUrlEnd
    var ai = i
    while (
      ai < afterUrlEol &&
      (s.charCodeAt(ai) === $.CHAR_SPACE || s.charCodeAt(ai) === $.CHAR_TAB)
    ) {
      ai++
    }
    if (ai < afterUrlEol) {
      // Content after > — must be whitespace-separated title
      if (ai === i) {
        return null // no whitespace before title = invalid
      }
      var tc2 = s.charCodeAt(ai)
      if (
        tc2 !== $.CHAR_DOUBLE_QUOTE &&
        tc2 !== $.CHAR_SINGLE_QUOTE &&
        tc2 !== $.CHAR_PAREN_OPEN
      ) {
        return null // not a title char
      }
    }
  } else {
    var urlStart = i
    var parens = 0
    while (i < len) {
      var c = s.charCodeAt(i)
      if (c === $.CHAR_PAREN_OPEN) {
        parens++
      } else if (c === $.CHAR_PAREN_CLOSE) {
        if (parens === 0) {
          break
        }
        parens--
      } else if (
        c === $.CHAR_SPACE ||
        c === $.CHAR_TAB ||
        c === $.CHAR_NEWLINE
      ) {
        break
      } else if (c === $.CHAR_BACKSLASH && i + 1 < len) {
        var escaped = s.charCodeAt(i + 1)
        // Whitespace ends the destination even after a backslash
        if (
          escaped !== $.CHAR_SPACE &&
          escaped !== $.CHAR_TAB &&
          escaped !== $.CHAR_NEWLINE
        ) {
          i++ // escape
        }
      }
      i++
    }
    url = s.slice(urlStart, i)
    if (!url) {
      return null // URL required for non-angle-bracket form
    }
  }

  // Skip whitespace
  while (
    i < len &&
    (s.charCodeAt(i) === $.CHAR_SPACE || s.charCodeAt(i) === $.CHAR_TAB)
  ) {
    i++
  }

  var lineEndPos = s.indexOf('\n', i)
  var eol = lineEndPos < 0 ? len : lineEndPos

  // Try to parse title (can be on same line or next line)
  var title: string | undefined
  var titleParsed = false
  var titleEnd = i

  // Check if at end of line - title might be on next line
  var tryTitleAt = i
  if (i === eol && i < len) {
    tryTitleAt = i + 1
    while (
      tryTitleAt < len &&
      (s.charCodeAt(tryTitleAt) === $.CHAR_SPACE ||
        s.charCodeAt(tryTitleAt) === $.CHAR_TAB)
    ) {
      tryTitleAt++
    }
  }

  if (tryTitleAt < len) {
    var tc = s.charCodeAt(tryTitleAt)
    if (
      tc === $.CHAR_DOUBLE_QUOTE ||
      tc === $.CHAR_SINGLE_QUOTE ||
      tc === $.CHAR_PAREN_OPEN
    ) {
      // " ' (
      var closeChar = tc === $.CHAR_PAREN_OPEN ? 41 : tc
      var ti = tryTitleAt + 1
      var titleStart = ti
      // Title can span multiple lines, but not contain blank lines
      while (ti < len) {
        var tch = s.charCodeAt(ti)
        if (tch === closeChar) {
          // Found closing - check rest of line is blank
          var afterTitle = ti + 1
          while (
            afterTitle < len &&
            (s.charCodeAt(afterTitle) === $.CHAR_SPACE ||
              s.charCodeAt(afterTitle) === $.CHAR_TAB)
          ) {
            afterTitle++
          }
          if (
            afterTitle >= len ||
            s.charCodeAt(afterTitle) === $.CHAR_NEWLINE
          ) {
            title = dropLazyMarkers(s.slice(titleStart, ti))
            titleParsed = true
            titleEnd = afterTitle < len ? afterTitle + 1 : len
          }
          break
        }
        if (tch === $.CHAR_BACKSLASH && ti + 1 < len) {
          ti += 2
          continue
        } // escape
        // Check for blank line (title can't span blank lines)
        if (
          tch === $.CHAR_NEWLINE &&
          ti + 1 < len &&
          s.charCodeAt(ti + 1) === $.CHAR_NEWLINE
        ) {
          break
        }
        ti++
      }

      if (!titleParsed) {
        // Title didn't parse properly
        if (tryTitleAt === i) {
          // Title on same line that didn't close - not valid
          return null
        }
      }
    }
  }

  if (titleParsed) {
    // Destinations decode entities per CommonMark before sanitize consumers see them.
    if (!refs[label]) {
      refs[label] = {
        target: util.decodeEntityReferences(unescapeString(url)),
        title:
          title === undefined
            ? title
            : util.decodeEntityReferences(unescapeString(title)),
      }
    }
    return titleEnd
  }

  // No title - check that rest of line is blank
  while (
    i < eol &&
    (s.charCodeAt(i) === $.CHAR_SPACE || s.charCodeAt(i) === $.CHAR_TAB)
  ) {
    i++
  }
  if (i < eol) {
    return null
  }

  // First definition wins
  if (!refs[label]) {
    refs[label] = {
      target: util.decodeEntityReferences(unescapeString(url)),
      title,
    }
  }
  return lineEndPos < 0 ? len : lineEndPos + 1
}

// ============================================================================
// CHARACTER CLASSIFICATION TABLE
// ============================================================================
// Base table (WS, NL, PUNCT, ALPHA, DIGIT) imported from utils.ts
// Parser overlays BLOCK/INLINE flags for syntax dispatch
var CC = new Uint8Array(_CC)

// Parser-specific: block/inline starter flags
CC[$.CHAR_HASH] |= C_BLOCK // # (heading)
CC[$.CHAR_GT] |= C_BLOCK // > (blockquote)
CC[$.CHAR_DASH] |= C_BLOCK | C_INLINE // - (list, thematic, strikethrough)
CC[$.CHAR_PLUS] |= C_BLOCK // + (list)
CC[$.CHAR_ASTERISK] |= C_BLOCK | C_INLINE // * (list, thematic, emphasis)
CC[$.CHAR_UNDERSCORE] |= C_BLOCK | C_INLINE // _ (thematic, emphasis)
CC[$.CHAR_BACKTICK] |= C_BLOCK | C_INLINE // ` (code fence, code span)
CC[$.CHAR_TILDE] |= C_BLOCK | C_INLINE // ~ (code fence, strikethrough)
CC[$.CHAR_LT] |= C_BLOCK | C_INLINE // < (HTML, autolink)
CC[$.CHAR_BRACKET_OPEN] |= C_INLINE // [ (link, image, footnote)
CC[$.CHAR_EXCLAMATION] |= C_INLINE // ! (image)
CC[$.CHAR_PIPE] |= C_BLOCK // | (table)
for (var i = $.CHAR_DIGIT_0; i <= $.CHAR_DIGIT_9; i++) {
  CC[i] |= C_BLOCK // 0-9 (ordered list)
}

/** Check if string contains unescaped [ or ] */
function hasUnescapedBracket(s: string): boolean {
  // Fast rejection: if no brackets at all, skip the escaping check
  if (s.indexOf('[') < 0 && s.indexOf(']') < 0) {
    return false
  }
  for (var i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) === $.CHAR_BACKSLASH) {
      i++
      continue
    } // skip escaped char
    if (
      s.charCodeAt(i) === $.CHAR_BRACKET_OPEN ||
      s.charCodeAt(i) === $.CHAR_BRACKET_CLOSE
    ) {
      return true
    }
  }
  return false
}

/** Normalize a reference label for case-insensitive matching */
function normalizeLabel(label: string): string {
  // Fast path: a label that is already normalized (printable ASCII, no
  // uppercase, no whitespace runs or edge whitespace, nothing needing case
  // folding) is its own normalization; skip both replace/toLowerCase allocations.
  var n = label.length
  var prevSpace = true // also rejects a leading space
  var clean = n > 0
  for (var fi = 0; fi < n; fi++) {
    var fc = label.charCodeAt(fi)
    if (fc === $.CHAR_SPACE) {
      if (prevSpace) {
        clean = false
        break
      }
      prevSpace = true
    } else if (fc < 33 || fc > 126 || (fc >= $.CHAR_A && fc <= $.CHAR_Z)) {
      clean = false
      break
    } else {
      prevSpace = false
    }
  }
  if (clean && !prevSpace) {
    return label
  }

  var normalized = label.replace(/\s+/g, ' ').trim()
  // Handle Unicode case folding: ẞ (U+1E9E, capital sharp S) → ss
  if (normalized.indexOf('\u1E9E') !== -1) {
    return normalized.replace(/\u1E9E/g, 'ss').toLowerCase()
  }
  return normalized.toLowerCase()
}

// ============================================================================
// GENERIC SCANNING PRIMITIVES
// ============================================================================

/** Get character class for a character code */
function cc(code: number): number {
  return code < $.CHAR_ASCII_BOUNDARY
    ? CC[code]
    : code === $.CHAR_NBSP
      ? C_WS
      : 0
}

/** Unescape backslash escapes in a string */
function unescapeString(s: string): string {
  // Most link URLs/titles contain no backslash; skip the regex pass entirely.
  if (s.indexOf('\\') === -1) {
    return s
  }
  return s.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, '$1')
}

// Single-line range cache for line-end lookups. Any position within the
// cached line shares its end (p in [lineStart, end] maps to end; p === end
// is the \n itself, whose indexOf result is end). Keyed by string reference
// so recursive parseBlocks calls with different substrings don't alias.
// parseBlocks seeds it before invoking a scanner; scanners walking within
// the dispatched line (indent, interrupt checks, markers) all hit.
var _leCacheS: string | null = null
var _leCacheP = -1
var _leCacheE = -1

// The last findNextBlankLine answer: no line start in [_blankFrom, _blankEnd) is
// blank. A component body scans a nested block per line, and without this each one
// walks to the end of the body. parseBlocks keeps a nested parse from replacing the
// entry its parent is still using, and clears it as the outermost parse returns.
var _blankS: string | null = null
var _blankFrom = -1
var _blankEnd = -1

/** Find end of current line (position of \n or end of string) */
function lineEnd(s: string, p: number): number {
  if (p >= _leCacheP && p <= _leCacheE && s === _leCacheS) {
    return _leCacheE
  }
  var i = s.indexOf('\n', p)
  var e = i < 0 ? s.length : i
  _leCacheS = s
  _leCacheP = p
  _leCacheE = e
  return e
}

/** Skip to start of next line */
function nextLine(s: string, p: number): number {
  const e = lineEnd(s, p)
  return e < s.length ? e + 1 : e
}

/** Skip whitespace (space and tab only) */
function skipWs(s: string, p: number, e: number): number {
  while (p < e) {
    const c = s.charCodeAt(p)
    if (c !== $.CHAR_SPACE && c !== $.CHAR_TAB) {
      break
    }
    p++
  }
  return p
}

/** Find start of next blank line (line with only whitespace or empty) */
function findNextBlankLine(s: string, p: number): number {
  // CommonMark Type 7 blocks continue until a truly blank line is reached.
  // We start searching AFTER the current line.
  let i = nextLine(s, p)
  if (i >= _blankFrom && i <= _blankEnd && s === _blankS) {
    return _blankEnd
  }
  _blankS = s
  _blankFrom = i
  while (i < s.length && !isBlank(s, i, lineEnd(s, i))) {
    i = nextLine(s, i)
  }
  _blankEnd = i < s.length ? i : s.length
  return _blankEnd
}

/** Skip all whitespace including newlines */
function _skipAllWs(s: string, p: number, e: number): number {
  while (p < e && cc(s.charCodeAt(p)) & C_WS) {
    p++
  }
  return p
}

/** Count consecutive occurrences of a character */
function countChar(s: string, p: number, e: number, ch: number): number {
  let n = 0
  while (p + n < e && s.charCodeAt(p + n) === ch) {
    n++
  }
  return n
}

// Reusable indent result to avoid allocations
var _indentSpaces = 0
var _indentChars = 0

/** Calculate indentation (spaces, with tabs = 4 spaces). Results in _indentSpaces and _indentChars */
function indent(s: string, p: number, e: number): void {
  _indentSpaces = 0
  _indentChars = 0
  while (p + _indentChars < e) {
    const c = s.charCodeAt(p + _indentChars)
    if (c === $.CHAR_TAB) {
      _indentSpaces += 4 - (_indentSpaces % 4)
    } else if (c === $.CHAR_SPACE) {
      _indentSpaces++
    } else {
      break
    }
    _indentChars++
  }
}

/** Check if line is blank (only whitespace) */
function isBlank(s: string, p: number, e: number): boolean {
  return skipWs(s, p, e) >= e
}

/**
 * Whether [p, e) holds only blank lines. Unlike isBlank (one line's content),
 * this crosses newlines, so the blank lines prepareBlockInput appends after
 * the last block do not count as content following it.
 */
function onlyBlankLinesAfter(s: string, p: number, e: number): boolean {
  while (p < e) {
    var c = s.charCodeAt(p)
    if (c !== $.CHAR_NEWLINE && c !== $.CHAR_SPACE && c !== $.CHAR_TAB) {
      return false
    }
    p++
  }
  return true
}

// ============================================================================
// RESULT TYPES
// ============================================================================

type ScanResult = { node: MarkdownToJSX.ASTNode; end: number } | null

// ============================================================================
// BLOCK SCANNERS
// ============================================================================

/**
 * Append -1, -2, … until the heading ID is unique within this parse.
 * An empty base stays empty so a slugify that returns '' does not invent
 * suffixes. The map allocates lazily on the first non-empty heading. Key
 * presence means the id is taken; the value is the last numeric suffix tried
 * when that string was used as a base (`0` = unsuffixed id taken) so dense
 * collisions stay amortized O(1). Writing `ids[candidate] = 0` also marks
 * generated ids as taken for later bases (e.g. a literal "Foo-1" after an
 * auto `foo-1`).
 */
function uniqueHeadingId(base: string, state: MarkdownToJSX.State): string {
  if (!base) {
    return base
  }
  var ids =
    state._headingIds ||
    (state._headingIds = Object.create(null) as { [id: string]: number })
  var last = ids[base]
  if (last === undefined) {
    ids[base] = 0
    return base
  }
  var n = last + 1
  var candidate = `${base}-${n}`
  while (ids[candidate] !== undefined) {
    n++
    candidate = `${base}-${n}`
  }
  ids[base] = n
  ids[candidate] = 0
  return candidate
}

/** Scan ATX heading (# ... #) */
function scanHeading(
  s: string,
  p: number,
  state: MarkdownToJSX.State,
  opts: ParseOptions
): ScanResult {
  const e = lineEnd(s, p)
  indent(s, p, e)
  if (_indentSpaces > 3) {
    return null
  }

  let i = p + _indentChars
  if (s.charCodeAt(i) !== $.CHAR_HASH) {
    return null // #
  }

  // Count # characters (1-6)
  const level = countChar(s, i, e, $.CHAR_HASH)
  if (level < 1 || level > 6) {
    return null
  }
  i += level

  // Must be followed by space or end of line, unless enforceAtxHeadings is false
  if (
    opts.enforceAtxHeadings !== false &&
    i < e &&
    s.charCodeAt(i) !== $.CHAR_SPACE &&
    s.charCodeAt(i) !== $.CHAR_TAB
  ) {
    return null
  }

  // Skip whitespace after #
  i = skipWs(s, i, e)

  // Find content end (strip trailing # and spaces per CommonMark)
  var contentEnd = e
  // Strip trailing whitespace
  while (contentEnd > i && s.charCodeAt(contentEnd - 1) === $.CHAR_SPACE) {
    contentEnd--
  }
  // Strip trailing # characters
  var beforeHash = contentEnd
  while (contentEnd > i && s.charCodeAt(contentEnd - 1) === $.CHAR_HASH) {
    contentEnd--
  }
  if (contentEnd < beforeHash) {
    // We stripped some #s - check if preceded by space or at beginning
    if (contentEnd === i || s.charCodeAt(contentEnd - 1) === $.CHAR_SPACE) {
      // Valid closing sequence - strip trailing spaces before the #s
      while (contentEnd > i && s.charCodeAt(contentEnd - 1) === $.CHAR_SPACE) {
        contentEnd--
      }
    } else {
      // Trailing # not preceded by space - keep them
      contentEnd = beforeHash
    }
  }

  const text = s.slice(i, contentEnd)
  const children = queueInline(text, false, state, opts)

  // Heading ids are assigned after the deferred inline flush (assignHeadingIds):
  // children are still empty placeholders here when queueInline is deferred.
  return {
    node: {
      type: RuleType.heading,
      level,
      children,
      id: '',
    } as MarkdownToJSX.HeadingNode,
    end: nextLine(s, e),
  }
}

/** Check if a line is a setext heading underline (=== or ---) */
function isSetextUnderline(s: string, p: number, e: number): boolean {
  var c = s.charCodeAt(p)
  if (c !== $.CHAR_EQ && c !== $.CHAR_DASH) {
    return false // = or -
  }
  var i = p
  while (i < e && s.charCodeAt(i) === c) {
    i++
  }
  while (
    i < e &&
    (s.charCodeAt(i) === $.CHAR_SPACE || s.charCodeAt(i) === $.CHAR_TAB)
  ) {
    i++
  }
  return i >= e
}

/** Scan thematic break (---, ***, ___) */
function scanThematic(s: string, p: number): ScanResult {
  const e = lineEnd(s, p)
  indent(s, p, e)
  if (_indentSpaces > 3) {
    return null
  }

  let i = p + _indentChars
  const ch = s.charCodeAt(i)
  if (
    ch !== $.CHAR_DASH &&
    ch !== $.CHAR_ASTERISK &&
    ch !== $.CHAR_UNDERSCORE
  ) {
    return null // - * _
  }

  let count = 0
  while (i < e) {
    const c = s.charCodeAt(i)
    if (c === ch) {
      count++
    } else if (c !== $.CHAR_SPACE && c !== $.CHAR_TAB) {
      return null
    }
    i++
  }

  if (count < 3) {
    return null
  }

  return {
    node: { type: RuleType.breakThematic } as MarkdownToJSX.BreakThematicNode,
    end: nextLine(s, e),
  }
}

/** Last close-fence needle, memoized across fenced blocks (see scanFenced). */
var _fenceNeedleCh = 0
var _fenceNeedleLen = 0
var _fenceNeedleStr = ''

/** Scan fenced code block */
function scanFenced(
  s: string,
  p: number,
  state: MarkdownToJSX.State
): ScanResult {
  const e = lineEnd(s, p)
  indent(s, p, e)
  if (_indentSpaces > 3) {
    return null
  }

  // Save fence indentation - we'll remove this many spaces from each content line
  const fenceIndent = _indentSpaces
  const _fenceIndentChars = _indentChars

  let i = p + _indentChars
  const fence = s.charCodeAt(i)
  if (fence !== $.CHAR_BACKTICK && fence !== $.CHAR_TILDE) {
    return null // ` or ~
  }

  const fenceLen = countChar(s, i, e, fence)
  if (fenceLen < 3) {
    return null
  }
  i += fenceLen

  // Parse info string - extract language (first word) and optional attributes
  const infoStart = skipWs(s, i, e)
  let infoEnd = e
  // Backtick fences can't have backticks in info
  if (fence === $.CHAR_BACKTICK) {
    for (let j = infoStart; j < e; j++) {
      if (s.charCodeAt(j) === $.CHAR_BACKTICK) {
        return null
      }
    }
  }
  while (
    infoEnd > infoStart &&
    (s.charCodeAt(infoEnd - 1) === $.CHAR_SPACE ||
      s.charCodeAt(infoEnd - 1) === $.CHAR_TAB)
  ) {
    infoEnd--
  }
  const infoStr = s.slice(infoStart, infoEnd)

  // Split into language (first word) and attributes (rest)
  let lang = ''
  let attrsStr = ''
  const spaceIdx = infoStr.indexOf(' ')
  if (spaceIdx === -1) {
    lang = infoStr
  } else {
    lang = infoStr.slice(0, spaceIdx)
    attrsStr = infoStr.slice(spaceIdx + 1).trim()
  }

  // Per CommonMark, only the first word of the info string is used as language.
  // Parse key=value attributes from the rest (library extension, not CommonMark).
  // Unescape backslash sequences in language name
  lang = unescapeString(lang)

  // Parse attributes if present (only proper key="value" or key='value' pairs)
  var attrs: Record<string, string> | undefined
  if (attrsStr) {
    FENCE_ATTR_R.lastIndex = 0
    var match: RegExpExecArray | null
    while ((match = FENCE_ATTR_R.exec(attrsStr)) != null) {
      var fenceAttrValue = match[2] === undefined ? match[3] : match[2]
      if (isDangerousAttr(match[1], fenceAttrValue, false)) {
        continue
      }
      if (!attrs) {
        attrs = {}
      }
      attrs[match[1]] = fenceAttrValue
    }
  }

  // Find closing fence by jumping between candidate fence runs with SIMD
  // indexOf instead of walking every content line. A valid closer is a run of
  // >= fenceLen fence chars at line start behind at most 3 literal spaces
  // (a tab in the indent makes it >= 4 columns, never a closer) with a blank
  // tail. indexOf always lands on the first index of a run, so the candidate
  // position is the run start; failed candidates (mid-line, over-indented,
  // non-blank tail) resume searching one char ahead.
  const contentStart = nextLine(s, e)
  let contentEnd = s.length
  let closeEnd = s.length
  // Reuse the previous close-fence needle when char+length repeat (a document
  // tends to use one fence style throughout), avoiding a per-fence allocation.
  var needle: string
  if (fence === _fenceNeedleCh && fenceLen === _fenceNeedleLen) {
    needle = _fenceNeedleStr
  } else {
    needle = String.fromCharCode(fence).repeat(fenceLen)
    _fenceNeedleCh = fence
    _fenceNeedleLen = fenceLen
    _fenceNeedleStr = needle
  }
  var searchPos = contentStart

  while (searchPos < s.length) {
    var cand = s.indexOf(needle, searchPos)
    if (cand === -1) {
      break
    }
    var lineStart = cand
    var closeIndent = 0
    while (
      lineStart > 0 &&
      closeIndent < 4 &&
      s.charCodeAt(lineStart - 1) === $.CHAR_SPACE
    ) {
      lineStart--
      closeIndent++
    }
    if (
      closeIndent <= 3 &&
      (lineStart === 0 || s.charCodeAt(lineStart - 1) === $.CHAR_NEWLINE)
    ) {
      var runEnd = cand + fenceLen
      while (runEnd < s.length && s.charCodeAt(runEnd) === fence) {
        runEnd++
      }
      var closeLe = lineEnd(s, runEnd)
      if (isBlank(s, runEnd, closeLe)) {
        contentEnd = lineStart
        closeEnd = nextLine(s, closeLe)
        break
      }
    }
    searchPos = cand + 1
  }

  // Extract content, removing up to fenceIndent spaces from each line
  var content: string
  if (fenceIndent === 0) {
    // Fast path: no indent stripping needed — content is contiguous in source
    // Strip trailing newline: contentEnd points to start of closing fence line,
    // so the last char before it is '\n' from the last content line
    content =
      contentEnd > contentStart &&
      s.charCodeAt(contentEnd - 1) === $.CHAR_NEWLINE
        ? s.slice(contentStart, contentEnd - 1)
        : s.slice(contentStart, contentEnd)
  } else {
    content = ''
    var cp = contentStart
    while (cp < contentEnd) {
      var le = lineEnd(s, cp)
      indent(s, cp, le)
      var remove = Math.min(_indentChars, fenceIndent)
      content += `${s.slice(cp + remove, le)}\n`
      cp = nextLine(s, le)
    }
    // Remove trailing newline
    if (
      content.length > 0 &&
      content.charCodeAt(content.length - 1) === $.CHAR_NEWLINE
    ) {
      content = content.slice(0, -1)
    }
  }

  // A fence takes a lazy line in as code, so its marker is not content
  if (state.inList) {
    content = dropLazyMarkers(content)
  }

  return {
    node: {
      type: RuleType.codeBlock,
      lang: lang || undefined,
      text: content,
      infoString: attrsStr || undefined,
      attrs,
    } as MarkdownToJSX.CodeBlockNode,
    end: closeEnd,
  }
}

/**
 * Dedent a whitespace-only line by up to 4 columns (tabs expand to 4-column
 * stops) and return the remaining whitespace, which belongs to the code
 * content of an indented code block. Returns '' when the line has fewer than
 * 4 columns of whitespace.
 */
function dedentBlankLine(s: string, from: number, to: number): string {
  var spaces = 0
  var i = from
  while (i < to && spaces < 4) {
    if (s.charCodeAt(i) === $.CHAR_TAB) {
      spaces += 4 - (spaces % 4)
    } else {
      spaces++
    }
    i++
  }
  if (spaces < 4) {
    return ''
  }
  var out = ''
  // A tab that straddles the 4-column boundary contributes its overshoot
  for (var k = 4; k < spaces; k++) {
    out += ' '
  }
  return out + s.slice(i, to)
}

/** Scan indented code block */
function scanIndented(s: string, p: number): ScanResult {
  const e = lineEnd(s, p)
  indent(s, p, e)
  if (_indentSpaces < 4) {
    return null
  }

  let content = ''
  let end = p

  while (end < s.length) {
    const le = lineEnd(s, end)
    indent(s, end, le)

    if (isBlank(s, end, le)) {
      // Blank line(s) - include if code continues after them. A blank line's
      // whitespace beyond the 4-column dedent is part of the code content
      // (CommonMark 0.31.2 example 112), so keep the dedented remainder.
      var pending = `${dedentBlankLine(s, end, le)}\n`
      var scanPos = nextLine(s, le)
      while (scanPos < s.length) {
        var scanLe = lineEnd(s, scanPos)
        if (isBlank(s, scanPos, scanLe)) {
          pending += `${dedentBlankLine(s, scanPos, scanLe)}\n`
          scanPos = nextLine(s, scanLe)
          continue
        }
        indent(s, scanPos, scanLe)
        if (_indentSpaces >= 4) {
          // Code continues after blank(s): add the blank lines
          content += pending
          end = scanPos
        }
        break
      }
      if (end !== scanPos) {
        break
      }
      continue
    }

    if (_indentSpaces < 4) {
      break
    }

    // Remove 4 spaces of indentation, expanding tabs to spaces
    let remove = 0
    let spaces = 0
    var extraSpaces = 0
    for (let i = end; i < le && spaces < 4; i++) {
      const c = s.charCodeAt(i)
      if (c === $.CHAR_TAB) {
        var tabW = 4 - (spaces % 4)
        if (spaces + tabW > 4) {
          extraSpaces = spaces + tabW - 4
        }
        spaces += tabW
      } else {
        spaces++
      }
      remove++
    }

    // Add any leftover spaces from partial tab consumption, then literal content
    var lineContent = ''
    if (extraSpaces > 0) {
      for (var si = 0; si < extraSpaces; si++) {
        lineContent += ' '
      }
    }
    lineContent += s.slice(end + remove, le)
    content += `${lineContent}\n`
    end = nextLine(s, le)
  }

  // Trim trailing blank lines
  while (
    content.length > 0 &&
    content.charCodeAt(content.length - 1) === $.CHAR_NEWLINE
  ) {
    content = content.slice(0, -1)
  }

  if (!content) {
    return null
  }

  return {
    node: {
      type: RuleType.codeBlock,
      lang: undefined,
      text: content,
      infoString: undefined,
      attrs: undefined,
    } as MarkdownToJSX.CodeBlockNode,
    end,
  }
}

/** Scan blockquote */
function scanBlockquote(
  s: string,
  p: number,
  state: MarkdownToJSX.State,
  opts: ParseOptions
): ScanResult {
  const e = lineEnd(s, p)
  indent(s, p, e)
  if (_indentSpaces > 3) {
    return null
  }

  const i = p + _indentChars
  if (s.charCodeAt(i) !== $.CHAR_GT) {
    return null // >
  }

  // Collect blockquote content
  let content = ''
  let end = p
  let alertType: string | undefined
  let hasLazyContinuation = false
  let lastLineWasQuoted = false
  let contentHasOpenBlock = false

  while (end < s.length) {
    const le = lineEnd(s, end)
    indent(s, end, le)

    const qi = end + _indentChars
    if (s.charCodeAt(qi) === $.CHAR_GT) {
      // > marker
      let ci = qi + 1
      // Calculate absolute column after > marker
      var bqAbsCol = _indentSpaces + 1 // indent cols + > itself
      var bqStripOne = false
      if (ci < le) {
        var bqNextChar = s.charCodeAt(ci)
        if (bqNextChar === $.CHAR_SPACE) {
          ci++
          bqAbsCol++
          bqStripOne = true
        } else if (bqNextChar === $.CHAR_TAB) {
          // Tab after >: consume 1 col as optional space, expand rest
          bqStripOne = true
        }
      }
      // Build lineContent with tab expansion using absolute columns
      var lineContent = ''
      var hasTabInLine = false
      for (var bci = ci; bci < le; bci++) {
        if (s.charCodeAt(bci) === $.CHAR_TAB) {
          hasTabInLine = true
          break
        }
      }
      if (hasTabInLine) {
        // Expand tabs to spaces using absolute column tracking
        var bqCol = bqAbsCol
        if (bqStripOne && ci < le && s.charCodeAt(ci) === $.CHAR_TAB) {
          // First char is a tab — consume 1 col, expand rest
          var tw = 4 - (bqCol % 4)
          for (var bi = 0; bi < tw - 1; bi++) {
            lineContent += ' '
          }
          bqCol += tw
          ci++
        }
        for (var bci2 = ci; bci2 < le; bci2++) {
          if (s.charCodeAt(bci2) === $.CHAR_TAB) {
            var tw2 = 4 - (bqCol % 4)
            for (var bi2 = 0; bi2 < tw2; bi2++) {
              lineContent += ' '
            }
            bqCol += tw2
          } else {
            lineContent += s[bci2]
            bqCol++
          }
        }
      } else {
        lineContent = s.slice(ci, le)
      }

      // Check for alert syntax [!TYPE] on first line
      if (!(content || alertType)) {
        const alertMatch = lineContent.match(/^\[!([A-Za-z]+)\]\s*$/)
        if (alertMatch) {
          alertType = alertMatch[1].toUpperCase()
          end = nextLine(s, le)
          continue // Don't add alert marker to content
        }
      }

      content += `${lineContent}\n`
      // Track if content has open fenced code block or indented code
      var trimLine = lineContent.trimStart()
      if (trimLine.startsWith('```') || trimLine.startsWith('~~~')) {
        contentHasOpenBlock = !contentHasOpenBlock
      } else if (
        lineContent.startsWith('    ') ||
        lineContent.startsWith('\t')
      ) {
        contentHasOpenBlock = true
      }
      // After a blank quoted line (e.g. ">\n"), no lazy continuation allowed
      lastLineWasQuoted = trimLine.length > 0
      end = nextLine(s, le)
    } else if (content && !isBlank(s, end, le) && lastLineWasQuoted) {
      // Lazy continuation - only continues paragraphs, not block elements
      // Per CommonMark, lazy continuation can only continue a paragraph
      // Block-level checks only apply when indent < 4 (otherwise it's
      // an indented code block candidate which can lazy-continue a paragraph)
      if (_indentSpaces < 4) {
        var lazyI = end + _indentChars
        var lazyC = lazyI < le ? s.charCodeAt(lazyI) : 0
        // Don't continue if line starts a block element
        if (
          lazyC === $.CHAR_HASH ||
          lazyC === $.CHAR_GT ||
          lazyC === $.CHAR_BACKTICK ||
          lazyC === $.CHAR_TILDE ||
          lazyC === $.CHAR_LT
        ) {
          break
        }
        if (
          (lazyC === $.CHAR_DASH ||
            lazyC === $.CHAR_ASTERISK ||
            lazyC === $.CHAR_UNDERSCORE) &&
          scanThematic(s, end)
        ) {
          break
        }
        if (
          (lazyC === $.CHAR_DASH ||
            lazyC === $.CHAR_ASTERISK ||
            lazyC === $.CHAR_PLUS) &&
          lazyI + 1 < le &&
          (s.charCodeAt(lazyI + 1) === $.CHAR_SPACE ||
            s.charCodeAt(lazyI + 1) === $.CHAR_TAB)
        ) {
          break
        }
        if (lazyC >= $.CHAR_DIGIT_0 && lazyC <= $.CHAR_DIGIT_9) {
          var oi = lazyI
          while (
            oi < le &&
            s.charCodeAt(oi) >= $.CHAR_DIGIT_0 &&
            s.charCodeAt(oi) <= $.CHAR_DIGIT_9
          ) {
            oi++
          }
          if (
            oi < le &&
            (s.charCodeAt(oi) === $.CHAR_PERIOD ||
              s.charCodeAt(oi) === $.CHAR_PAREN_CLOSE)
          ) {
            break
          }
        }
      }
      // Don't allow lazy continuation if blockquote content has unclosed block elements
      if (contentHasOpenBlock) {
        break
      }
      content += `${s.slice(end, le)}\n`
      hasLazyContinuation = true
      end = nextLine(s, le)
    } else {
      break
    }
  }

  if (!(content || alertType)) {
    return null
  }

  // Parse blockquote content recursively
  // If lazy continuation was used, disable setext heading detection
  // (per CommonMark, setext underlines can't be lazy continuation lines)
  var savedBq = state.inBlockQuote
  var savedNoSetext = state._noSetext
  state.inBlockQuote = true
  if (hasLazyContinuation) {
    state._noSetext = true
  }
  // The blockquote holds the streaming edge only if nothing follows it; a
  // blockquote with content after it is closed and never needs suppression.
  var savedEdgeBq = state._notAtEdge
  state._notAtEdge = savedEdgeBq || !onlyBlankLinesAfter(s, end, s.length)
  const children = parseBlocks(content || '', state, opts)
  state._notAtEdge = savedEdgeBq
  state.inBlockQuote = savedBq
  state._noSetext = savedNoSetext

  const node: MarkdownToJSX.BlockQuoteNode = {
    type: RuleType.blockQuote,
    children,
    alert: alertType || undefined,
  }

  return { node, end }
}

/** Calculate column position at offset p accounting for tabs */
function columnAt(s: string, lineStart: number, p: number): number {
  var col = 0
  for (var i = lineStart; i < p; i++) {
    if (s.charCodeAt(i) === $.CHAR_TAB) {
      col += 4 - (col % 4)
    } else {
      col++
    }
  }
  return col
}

/** Check if line starts a list item, return marker info */
function checkListMarker(
  s: string,
  p: number,
  e: number
): {
  ordered: boolean
  marker: string
  start?: number
  contentStart: number
  contentCol: number
  markerCol: number
  isEmpty: boolean
} | null {
  indent(s, p, e)
  if (_indentSpaces > 3) {
    return null
  }

  var i = p + _indentChars
  if (i >= e) {
    return null
  }

  var c = s.charCodeAt(i)
  var markerCol = _indentSpaces
  var markerEnd = i
  // Only advanced past i in the ordered-list branch; the ordered ternaries
  // below read it solely when c is a digit, where the scan has run.
  var numEnd = i

  // Unordered: - * +
  if (c === $.CHAR_DASH || c === $.CHAR_ASTERISK || c === $.CHAR_PLUS) {
    markerEnd = i + 1
    if (
      markerEnd < e &&
      s.charCodeAt(markerEnd) !== $.CHAR_SPACE &&
      s.charCodeAt(markerEnd) !== $.CHAR_TAB &&
      s.charCodeAt(markerEnd) !== $.CHAR_NEWLINE
    ) {
      return null
    }
  }
  // Ordered: 1. or 1)
  else if (c >= $.CHAR_DIGIT_0 && c <= $.CHAR_DIGIT_9) {
    while (numEnd < e && numEnd - i < 9) {
      var nc = s.charCodeAt(numEnd)
      if (nc < $.CHAR_DIGIT_0 || nc > $.CHAR_DIGIT_9) {
        break
      }
      numEnd++
    }
    if (numEnd > i && numEnd < e) {
      var delim = s.charCodeAt(numEnd)
      if (delim === $.CHAR_PERIOD || delim === $.CHAR_PAREN_CLOSE) {
        markerEnd = numEnd + 1
        if (
          markerEnd < e &&
          s.charCodeAt(markerEnd) !== $.CHAR_SPACE &&
          s.charCodeAt(markerEnd) !== $.CHAR_TAB &&
          s.charCodeAt(markerEnd) !== $.CHAR_NEWLINE
        ) {
          return null
        }
      } else {
        return null
      }
    } else {
      return null
    }
  } else {
    return null
  }

  // Calculate content start column (1-4 spaces after marker)
  var afterMarker = markerEnd
  var afterMarkerCol = columnAt(s, p, markerEnd)
  var spacesAfter = 0
  var contentPos = afterMarker
  var contentCol = afterMarkerCol

  if (afterMarker >= e) {
    // Empty item (marker at end of line)
    return {
      ordered: c >= $.CHAR_DIGIT_0 && c <= $.CHAR_DIGIT_9,
      marker: c >= $.CHAR_DIGIT_0 && c <= $.CHAR_DIGIT_9 ? s[numEnd] : s[i],
      start:
        c >= $.CHAR_DIGIT_0 && c <= $.CHAR_DIGIT_9
          ? Number.parseInt(s.slice(i, numEnd), 10)
          : undefined,
      contentStart: afterMarker,
      contentCol: afterMarkerCol + 1,
      markerCol,
      isEmpty: true,
    }
  }

  // Count spaces after marker (1-4; if 5+, only 1 counts)
  while (
    contentPos < e &&
    (s.charCodeAt(contentPos) === $.CHAR_SPACE ||
      s.charCodeAt(contentPos) === $.CHAR_TAB)
  ) {
    if (s.charCodeAt(contentPos) === $.CHAR_TAB) {
      var tabWidth = 4 - (contentCol % 4)
      contentCol += tabWidth
    } else {
      contentCol++
    }
    contentPos++
    spacesAfter++
  }

  var isEmpty = contentPos >= e
  // Use column-equivalent width for the 5+ spaces check (not char count)
  var colsAfterMarker = contentCol - afterMarkerCol
  if (isEmpty) {
    contentCol = afterMarkerCol + 1
    contentPos = afterMarker + 1
    spacesAfter = 1
  } else if (colsAfterMarker > 4) {
    // If 5+ column-equivalent spaces after marker, only 1 space counts
    contentCol = afterMarkerCol + 1
    contentPos = afterMarker + 1
    spacesAfter = 1
  } else if (spacesAfter === 0) {
    contentCol = afterMarkerCol + 1
    contentPos = afterMarker
    spacesAfter = 1
  }

  return {
    ordered: c >= $.CHAR_DIGIT_0 && c <= $.CHAR_DIGIT_9,
    marker: c >= $.CHAR_DIGIT_0 && c <= $.CHAR_DIGIT_9 ? s[numEnd] : s[i],
    start:
      c >= $.CHAR_DIGIT_0 && c <= $.CHAR_DIGIT_9
        ? Number.parseInt(s.slice(i, numEnd), 10)
        : undefined,
    contentStart: contentPos,
    contentCol,
    markerCol,
    isEmpty,
  }
}

/**
 * Strip leading indentation from a line, removing up to `cols` columns.
 * Returns the position in `s` after stripping.
 */
var _stripRemaining = 0 // leftover spaces from partial tab after stripIndent
function stripIndent(s: string, p: number, e: number, cols: number): number {
  var col = 0
  var i = p
  _stripRemaining = 0
  while (i < e && col < cols) {
    var c = s.charCodeAt(i)
    if (c === $.CHAR_TAB) {
      var tabW = 4 - (col % 4)
      if (col + tabW > cols) {
        // Partial tab: consume only part, remainder becomes spaces
        _stripRemaining = col + tabW - cols
        i++
        col = cols
        break
      }
      col += tabW
    } else if (c === $.CHAR_SPACE) {
      col++
    } else {
      break
    }
    i++
  }
  return i
}

/** Scan list (ordered or unordered) */
function scanList(
  s: string,
  p: number,
  state: MarkdownToJSX.State,
  opts: ParseOptions
): ScanResult {
  var firstLine = lineEnd(s, p)
  var firstMarker = checkListMarker(s, p, firstLine)
  if (!firstMarker) {
    return null
  }

  // Collect items: each item is { contentCol, raw, hasBlankAfter, isEmpty }
  var itemData: {
    contentCol: number
    raw: string
    hasBlankAfter: boolean
    isEmpty: boolean
  }[] = []
  var end = p
  var curContentCol = firstMarker.contentCol
  var curRaw = ''
  var curIsEmpty = firstMarker.isEmpty
  var curHasBlankAfter = false
  var hadBlankLine = false

  // First item's first line content
  if (!firstMarker.isEmpty) {
    // Check if first line content has tabs that need absolute column expansion
    var firstHasTab = false
    for (var fti = firstMarker.contentStart; fti < firstLine; fti++) {
      if (s.charCodeAt(fti) === $.CHAR_TAB) {
        firstHasTab = true
        break
      }
    }
    if (firstHasTab) {
      var firstExpanded = ''
      var firstAbsCol = columnAt(s, p, firstMarker.contentStart)
      // Prepend virtual spaces for the gap between contentCol and absCol
      // (occurs when colsAfterMarker > 4 resets contentCol)
      var virtualGap = firstAbsCol - firstMarker.contentCol
      if (virtualGap > 0) {
        for (var vgi = 0; vgi < virtualGap; vgi++) {
          firstExpanded += ' '
        }
      }
      for (var fei = firstMarker.contentStart; fei < firstLine; fei++) {
        if (s.charCodeAt(fei) === $.CHAR_TAB) {
          var ftw = 4 - (firstAbsCol % 4)
          for (var fsi = 0; fsi < ftw; fsi++) {
            firstExpanded += ' '
          }
          firstAbsCol += ftw
        } else {
          firstExpanded += s[fei]
          firstAbsCol++
        }
      }
      curRaw = `${firstExpanded}\n`
    } else {
      curRaw = `${s.slice(firstMarker.contentStart, firstLine)}\n`
    }
  }
  end = nextLine(s, firstLine)

  while (end < s.length) {
    var le = lineEnd(s, end)
    indent(s, end, le)

    // Check for thematic break — but only if not indented enough for continuation
    var c0 = s.charCodeAt(end + _indentChars)
    if (
      _indentSpaces < curContentCol &&
      (c0 === $.CHAR_DASH ||
        c0 === $.CHAR_ASTERISK ||
        c0 === $.CHAR_UNDERSCORE) &&
      _indentSpaces <= 3 &&
      scanThematic(s, end)
    ) {
      break
    }

    // Check for new list item — sibling when markerCol < current item's contentCol
    var lineMarker = checkListMarker(s, end, le)
    if (
      lineMarker &&
      lineMarker.ordered === firstMarker.ordered &&
      lineMarker.marker === firstMarker.marker &&
      lineMarker.markerCol < curContentCol
    ) {
      // Save current item
      itemData.push({
        contentCol: curContentCol,
        raw: curRaw,
        hasBlankAfter: curHasBlankAfter,
        isEmpty: curIsEmpty,
      })
      if (curHasBlankAfter) {
        hadBlankLine = true
      }
      // Start new item
      curContentCol = lineMarker.contentCol
      curIsEmpty = lineMarker.isEmpty
      curHasBlankAfter = false
      curRaw = lineMarker.isEmpty
        ? ''
        : `${s.slice(lineMarker.contentStart, le)}\n`
      end = nextLine(s, le)
      continue
    }

    // Blank line
    if (isBlank(s, end, le)) {
      // Whitespace beyond the item's content column belongs to the item
      // content (e.g. interior blank lines of an indented code block keep
      // their dedented spaces, CommonMark 0.31.2 example 112)
      var blankRest = stripIndent(s, end, le, curContentCol)
      if (_stripRemaining > 0 || blankRest < le) {
        var blankWs = ''
        for (var bwi = 0; bwi < _stripRemaining; bwi++) {
          blankWs += ' '
        }
        curRaw += `${blankWs + s.slice(blankRest, le)}\n`
      } else {
        curRaw += '\n'
      }
      end = nextLine(s, le)
      // After blank in empty item, check if list continues — charCode check avoids .trim()
      var curRawHasContent = false
      for (var cri = 0; cri < curRaw.length; cri++) {
        var crc = curRaw.charCodeAt(cri)
        if (
          crc !== $.CHAR_NEWLINE &&
          crc !== $.CHAR_CR &&
          crc !== $.CHAR_SPACE &&
          crc !== $.CHAR_TAB
        ) {
          curRawHasContent = true
          break
        }
      }
      if (curIsEmpty && !curRawHasContent) {
        // List continues if next non-blank line is a matching list item
        if (end < s.length) {
          var peekLe = lineEnd(s, end)
          var peekMarker = checkListMarker(s, end, peekLe)
          if (
            !peekMarker ||
            peekMarker.ordered !== firstMarker.ordered ||
            peekMarker.marker !== firstMarker.marker
          ) {
            break
          }
          // Next is a matching item — blank before it counts as between-items
          curHasBlankAfter = true
        } else {
          break
        }
      }
      // Check what follows the blank
      if (end < s.length) {
        var nextLe = lineEnd(s, end)
        indent(s, end, nextLe)
        // Thematic break after blank
        var nc = s.charCodeAt(end + _indentChars)
        if (
          (nc === $.CHAR_DASH ||
            nc === $.CHAR_ASTERISK ||
            nc === $.CHAR_UNDERSCORE) &&
          _indentSpaces <= 3 &&
          scanThematic(s, end)
        ) {
          break
        }
        // Check if next line is a new item in the same list
        var nextMarker = checkListMarker(s, end, nextLe)
        if (
          nextMarker &&
          nextMarker.ordered === firstMarker.ordered &&
          nextMarker.marker === firstMarker.marker &&
          nextMarker.markerCol < curContentCol
        ) {
          // Blank before new item = between items
          curHasBlankAfter = true
          continue
        }
        // After blank, non-item content must be indented to contentCol
        if (!isBlank(s, end, nextLe) && _indentSpaces < curContentCol) {
          break
        }
        // Blank followed by continuation content = within item (not between items)
      }
      continue
    }

    // Continuation line: must be indented >= contentCol
    if (_indentSpaces >= curContentCol) {
      var stripped = stripIndent(s, end, le, curContentCol)
      // If partial tab was consumed, expand remaining content using ABSOLUTE columns
      // Tab stops are fixed at 0,4,8,12... regardless of stripping
      if (_stripRemaining > 0) {
        var expanded = ''
        // absCol = curContentCol because we stripped exactly curContentCol columns
        var absCol = curContentCol
        for (var ri = 0; ri < _stripRemaining; ri++) {
          expanded += ' '
          absCol++
        }
        for (var ei = stripped; ei < le; ei++) {
          if (s.charCodeAt(ei) === $.CHAR_TAB) {
            var etw = 4 - (absCol % 4)
            for (var eti = 0; eti < etw; eti++) {
              expanded += ' '
            }
            absCol += etw
          } else {
            expanded += s[ei]
            absCol++
          }
        }
        curRaw += `${expanded}\n`
      } else {
        curRaw += `${s.slice(stripped, le)}\n`
      }
      end = nextLine(s, le)
      continue
    }

    // Lazy continuation: text with < contentCol indent that isn't a new block
    // Only allowed if current item has an open paragraph (non-empty, no blank after)
    // Lazy continuation — check if curRaw has non-whitespace without .trim() allocation
    var lazyHasContent = false
    for (var lci = 0; lci < curRaw.length; lci++) {
      var lcc = curRaw.charCodeAt(lci)
      if (
        lcc !== $.CHAR_NEWLINE &&
        lcc !== $.CHAR_CR &&
        lcc !== $.CHAR_SPACE &&
        lcc !== $.CHAR_TAB
      ) {
        lazyHasContent = true
        break
      }
    }
    if (!curHasBlankAfter && lazyHasContent && !curIsEmpty) {
      var lineStart = end + _indentChars
      var lc = s.charCodeAt(lineStart)
      var isNewBlock =
        lc === $.CHAR_HASH ||
        lc === $.CHAR_GT ||
        lc === $.CHAR_LT ||
        lc === $.CHAR_BACKTICK ||
        lc === $.CHAR_TILDE ||
        ((lc === $.CHAR_DASH ||
          lc === $.CHAR_ASTERISK ||
          lc === $.CHAR_UNDERSCORE ||
          lc === $.CHAR_PLUS) &&
          (scanThematic(s, end) != null ||
            checkListMarker(s, end, le) != null)) ||
        (lc >= $.CHAR_DIGIT_0 &&
          lc <= $.CHAR_DIGIT_9 &&
          checkListMarker(s, end, le) != null)

      if (!isNewBlock) {
        // Mark lazy continuation with \u001E so it won't be parsed as block element
        curRaw += `\u001E${s.slice(lineStart, le)}\n`
        end = nextLine(s, le)
        continue
      }
    }

    break
  }

  // Save last item
  itemData.push({
    contentCol: curContentCol,
    raw: curRaw,
    hasBlankAfter: curHasBlankAfter,
    isEmpty: curIsEmpty,
  })

  if (itemData.length === 0) {
    return null
  }

  // Determine loose: blank lines between items, or within items between top-level blocks
  // Scan each item's raw content, skipping nested containers (fenced code, nested lists, blockquotes)
  var isLoose = hadBlankLine
  if (!isLoose) {
    for (var di = 0; di < itemData.length; di++) {
      if (itemData[di].hasBlankAfter && di < itemData.length - 1) {
        isLoose = true
        break
      }
      if (!itemData[di].isEmpty) {
        var raw = itemData[di].raw
        var rLen = raw.length
        var rp = 0
        var sawDirectContent = false
        var sawDirectBlank = false
        var hadNestedBlank = false // blank seen while inside nested block
        // Track containers: fenced code blocks, nested lists
        var fenced = false
        var fenceChar2 = 0
        var fenceLen2 = 0
        var nestedListCol = -1 // -1 = no active nested list
        while (rp < rLen) {
          var rle = raw.indexOf('\n', rp)
          if (rle < 0) {
            rle = rLen
          }
          // Inside fenced code block — skip until closing fence
          if (fenced) {
            indent(raw, rp, rle)
            var cl = raw.slice(rp + _indentChars, rle)
            var cc = 0
            while (cc < cl.length && cl.charCodeAt(cc) === fenceChar2) {
              cc++
            }
            if (cc >= fenceLen2 && cl.slice(cc).trim() === '') {
              fenced = false
            }
            rp = rle < rLen ? rle + 1 : rLen
            continue
          }
          if (isBlank(raw, rp, rle)) {
            if (nestedListCol >= 0) {
              hadNestedBlank = true
            } else if (sawDirectContent) {
              sawDirectBlank = true
            }
            rp = rle < rLen ? rle + 1 : rLen
            continue
          }
          indent(raw, rp, rle)
          // If inside nested list, check if line is still part of it
          if (nestedListCol >= 0) {
            if (_indentSpaces >= nestedListCol) {
              rp = rle < rLen ? rle + 1 : rLen
              continue
            }
            // Check for sibling item in nested list
            var nlm = checkListMarker(raw, rp, rle)
            if (nlm && nlm.markerCol < nestedListCol) {
              // Could be a new nested list item at same or shallower level
              // If at same level, continue in nested list
              if (nlm.contentCol <= nestedListCol) {
                rp = rle < rLen ? rle + 1 : rLen
                continue
              }
            }
            if (nlm) {
              rp = rle < rLen ? rle + 1 : rLen
              continue
            }
            // Line is back at top level — nested list ended
            nestedListCol = -1
            // If there was a blank while in the nested block, and now we're
            // back at top level with content, that's a blank between top-level blocks
            if (hadNestedBlank) {
              sawDirectBlank = true
              hadNestedBlank = false
            }
          }
          var lineText = raw.slice(rp + _indentChars, rle)
          // Check for fenced code opener
          var fc = lineText.charCodeAt(0)
          if (
            (fc === $.CHAR_BACKTICK || fc === $.CHAR_TILDE) &&
            _indentSpaces <= 3
          ) {
            var fn = 0
            while (fn < lineText.length && lineText.charCodeAt(fn) === fc) {
              fn++
            }
            if (fn >= 3) {
              if (sawDirectBlank && sawDirectContent) {
                isLoose = true
                break
              }
              fenced = true
              fenceChar2 = fc
              fenceLen2 = fn
              sawDirectContent = true
              rp = rle < rLen ? rle + 1 : rLen
              continue
            }
          }
          // Check for list marker (starts a nested list)
          var lm = _indentSpaces <= 3 ? checkListMarker(raw, rp, rle) : null
          if (lm && sawDirectContent) {
            // If there was a blank before this nested block, it's between top-level blocks
            if (sawDirectBlank) {
              isLoose = true
              break
            }
            nestedListCol = lm.contentCol
            hadNestedBlank = false
            rp = rle < rLen ? rle + 1 : rLen
            sawDirectContent = true
            continue
          }
          // Regular content at top level
          if (sawDirectBlank) {
            isLoose = true
            break
          }
          sawDirectContent = true
          rp = rle < rLen ? rle + 1 : rLen
        }
        if (isLoose) {
          break
        }
      }
    }
  }

  // Parse items
  var items: MarkdownToJSX.ASTNode[][] = []
  for (var ii = 0; ii < itemData.length; ii++) {
    var item = itemData[ii]
    // Strip trailing newlines without regex (avoids ReDoS on repeated \n)
    var itemRaw = item.raw
    var itemEnd = itemRaw.length
    while (itemEnd > 0 && itemRaw.charCodeAt(itemEnd - 1) === $.CHAR_NEWLINE) {
      itemEnd--
    }
    var itemContent =
      itemEnd < itemRaw.length ? itemRaw.slice(0, itemEnd) : itemRaw
    var taskNode: MarkdownToJSX.GFMTaskNode | null = null

    // Check for GFM task list item [ ] or [x]
    if (
      itemContent.length >= 3 &&
      itemContent.charCodeAt(0) === $.CHAR_BRACKET_OPEN
    ) {
      // [
      var tm = itemContent[1]
      if (
        (tm === ' ' || tm === 'x' || tm === 'X') &&
        itemContent.charCodeAt(2) === $.CHAR_BRACKET_CLOSE
      ) {
        // ]
        taskNode = {
          type: RuleType.gfmTask,
          completed: tm === 'x' || tm === 'X',
        } as MarkdownToJSX.GFMTaskNode
        itemContent = itemContent.slice(3)
      }
    }

    // \u001E markers on lazy continuation lines prevent block-level parsing
    // These lines are paragraph continuation text, not block starters

    var itemNodes: MarkdownToJSX.ASTNode[]
    if (item.isEmpty && itemContent.trim() === '') {
      // Empty list item
      itemNodes = []
    } else if (isLoose) {
      // Loose: parse as blocks — content is already indent-stripped. Only the
      // last item can hold the streaming edge; earlier items are closed.
      var savedInList = state.inList
      state.inList = true
      var savedEdgeLi = state._notAtEdge
      state._notAtEdge = savedEdgeLi || ii !== itemData.length - 1
      itemNodes = parseBlocks(itemContent, state, opts)
      state._notAtEdge = savedEdgeLi
      state.inList = savedInList
    } else {
      // Tight: parse as blocks then unwrap paragraphs. Only the last item can
      // hold the streaming edge; earlier items are closed.
      var savedInList2 = state.inList
      state.inList = true
      var savedEdgeLi2 = state._notAtEdge
      state._notAtEdge = savedEdgeLi2 || ii !== itemData.length - 1
      itemNodes = parseBlocks(itemContent, state, opts)
      state._notAtEdge = savedEdgeLi2
      state.inList = savedInList2
      // Unwrap: if result is single paragraph, unwrap its children
      if (itemNodes.length === 1 && itemNodes[0].type === RuleType.paragraph) {
        // Array reference: deferred inline parses fill it in place later
        itemNodes = (itemNodes[0] as MarkdownToJSX.ParagraphNode).children
      } else if (state._pendingOps) {
        // Paragraph children may still be empty (deferred inline parse), so
        // the element copy must run after the drain: queue it as an op
        var placeholder: MarkdownToJSX.ASTNode[] = []
        state._pendingOps.push({
          src: itemNodes,
          dest: placeholder,
          unwrap: true,
        })
        itemNodes = placeholder
      } else {
        // Unwrap paragraphs that are at top level (tight lists don't wrap in <p>)
        var unwrapped: MarkdownToJSX.ASTNode[] = []
        for (var ui = 0; ui < itemNodes.length; ui++) {
          if (itemNodes[ui].type === RuleType.paragraph) {
            var pChildren = (itemNodes[ui] as MarkdownToJSX.ParagraphNode)
              .children
            for (var ci = 0; ci < pChildren.length; ci++) {
              unwrapped.push(pChildren[ci])
            }
          } else {
            unwrapped.push(itemNodes[ui])
          }
        }
        itemNodes = unwrapped
      }
    }

    if (taskNode) {
      // Add space between checkbox and content
      var taskItem: MarkdownToJSX.ASTNode[] = [
        taskNode,
        { type: RuleType.text, text: ' ' } as MarkdownToJSX.TextNode,
      ]
      if (state._pendingOps) {
        // itemNodes may be a deferred children array; concat after the drain
        state._pendingOps.push({
          src: itemNodes,
          dest: taskItem,
          unwrap: false,
        })
      } else {
        for (var tni = 0; tni < itemNodes.length; tni++) {
          taskItem.push(itemNodes[tni])
        }
      }
      items.push(taskItem)
    } else {
      items.push(itemNodes)
    }
  }

  return {
    node: {
      type: firstMarker.ordered ? RuleType.orderedList : RuleType.unorderedList,
      start: firstMarker.ordered ? firstMarker.start : undefined,
      items,
    } as MarkdownToJSX.OrderedListNode | MarkdownToJSX.UnorderedListNode,
    end,
  }
}

// HTML block-level tag names (CommonMark spec)
const BLOCK_TAGS = new Set([
  'address',
  'article',
  'aside',
  'base',
  'basefont',
  'blockquote',
  'body',
  'caption',
  'center',
  'col',
  'colgroup',
  'dd',
  'details',
  'dialog',
  'dir',
  'div',
  'dl',
  'dt',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'frame',
  'frameset',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'head',
  'header',
  'hr',
  'html',
  'iframe',
  'legend',
  'li',
  'link',
  'main',
  'menu',
  'menuitem',
  'nav',
  'noframes',
  'ol',
  'optgroup',
  'option',
  'p',
  'param',
  'search',
  'section',
  'summary',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'title',
  'tr',
  'track',
  'ul',
])

/**
 * Process raw attributes object - convert names, parse styles, sanitize URLs.
 * Only a capitalized tag `overrides` matches reads `{…}` values as JSX props
 * (and evaluates them under `evalUnserializableExpressions`); every other tag,
 * a lowercase one with an override included, keeps each value as written.
 */
function processHtmlAttributes(
  rawAttrs: Record<string, string>,
  tagName: string,
  opts: ParseOptions
): Record<string, any> {
  const attrs: Record<string, any> = {}
  var first = tagName.charCodeAt(0)
  var readsJsxProps =
    first >= $.CHAR_A &&
    first <= $.CHAR_Z &&
    Boolean(util.get(opts.overrides, tagName, undefined))

  for (const [name, value] of Object.entries(rawAttrs)) {
    const nameLower = name.toLowerCase()

    if (nameLower === 'style' && typeof value === 'string') {
      // Parse inline styles - handle url() values properly
      const styles: Record<string, string> = {}
      const decls: string[] = []
      let depth = 0
      let start = 0
      for (let j = 0; j < value.length; j++) {
        const c = value.charCodeAt(j)
        if (c === $.CHAR_PAREN_OPEN) {
          depth++ // (
        } else if (c === $.CHAR_PAREN_CLOSE) {
          depth-- // )
        } else if (c === $.CHAR_SEMICOLON && depth === 0) {
          // ;
          decls.push(value.slice(start, j))
          start = j + 1
        }
      }
      if (start < value.length) {
        decls.push(value.slice(start))
      }

      let hasXss = false
      decls.forEach(decl => {
        const colonIdx = decl.indexOf(':')
        if (colonIdx === -1) {
          return
        }
        const prop = decl.slice(0, colonIdx).trim()
        const val = decl.slice(colonIdx + 1).trim()
        if (prop && val) {
          if (/url\s*\(\s*(javascript|vbscript|data:(?!image\/))/i.test(val)) {
            hasXss = true
            if (process.env.NODE_ENV !== 'production') {
              console.warn(
                'Style attribute contains an unsafe URL expression, it will not be rendered.',
                val
              )
            }
            return
          }
          const camelProp =
            prop.indexOf('-') === -1
              ? prop
              : prop.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase())
          styles[camelProp] = val
        }
      })
      if (!hasXss && Object.keys(styles).length > 0) {
        attrs[name] = styles
      }
    } else if (
      (nameLower === 'href' || nameLower === 'src') &&
      opts?.sanitizer
    ) {
      const sanitized = opts.sanitizer(value, tagName, nameLower)
      if (sanitized != null) {
        attrs[name] = sanitized
      }
    } else if (value === '') {
      attrs[name] = true
    } else {
      // Handle JSX interpolation: {expression} -> expression
      if (
        readsJsxProps &&
        value.length >= 2 &&
        value.charCodeAt(0) === $.CHAR_BRACE_OPEN &&
        value.charCodeAt(value.length - 1) === $.CHAR_BRACE_CLOSE
      ) {
        var inner = value.slice(1, -1)
        // Try JSON.parse for arrays/objects
        if (inner.length > 0) {
          var fc = inner.charCodeAt(0)
          if (fc === $.CHAR_BRACKET_OPEN || fc === $.CHAR_BRACE_OPEN) {
            // [ or {
            try {
              attrs[name] = JSON.parse(inner)
              continue
            } catch {
              /* not valid JSON, fall through */
            }
          }
        }
        // Check boolean literals
        if (inner === 'true') {
          attrs[name] = true
          continue
        }
        if (inner === 'false') {
          attrs[name] = false
          continue
        }
        // Eval unserializable expressions if opted in
        if (opts?.evalUnserializableExpressions) {
          try {
            attrs[name] = (0, eval)(`(${inner})`)
            continue
          } catch {
            /* eval failed, keep as string */
          }
        }
        attrs[name] = inner
      } else {
        attrs[name] = value
      }
    }
  }

  return attrs
}

/**
 * Case-insensitive indexOf without allocating new string.
 *
 * `search` starts with a non-letter (every caller's starts with '<'), so native
 * indexOf SIMD-skips past non-matching positions and the rest is verified CI.
 * This is typically 4-16x faster than a manual scan because '<' is rare in
 * typical markdown.
 */
export function indexOfCi(
  str: string,
  search: string,
  from: number,
  end: number
): number {
  const searchLen = search.length
  var searchCh = search.charAt(0)
  var strEnd = end - searchLen
  var j = from
  while (j <= strEnd) {
    var found = str.indexOf(searchCh, j)
    if (found === -1 || found > strEnd) {
      return -1
    }
    // Verify tail case-insensitively
    var match = true
    for (var k = 1; k < searchLen; k++) {
      var c1 = str.charCodeAt(found + k)
      var c2 = search.charCodeAt(k)
      if (c1 >= $.CHAR_A && c1 <= $.CHAR_Z) {
        c1 += $.CHAR_CASE_OFFSET
      }
      if (c2 >= $.CHAR_A && c2 <= $.CHAR_Z) {
        c2 += $.CHAR_CASE_OFFSET
      }
      if (c1 !== c2) {
        match = false
        break
      }
    }
    if (match) {
      return found
    }
    j = found + 1
  }
  return -1
}

/**
 * Whether `text` holds `lower` at `at`, folding ASCII letters only: a wider fold
 * reads U+017F as `s` and U+212A as `k`, which no raw HTML tokenizer does.
 */
export function matchesFolded(
  text: string,
  at: number,
  lower: string
): boolean {
  for (var i = 0; i < lower.length; i++) {
    var code = text.charCodeAt(at + i)
    if (code >= $.CHAR_A && code <= $.CHAR_Z) {
      code += $.CHAR_CASE_OFFSET
    }
    if (code !== lower.charCodeAt(i)) {
      return false
    }
  }
  return true
}

/**
 * Last index at or before `from` where the lowercase `search`, which starts with
 * a non-letter, occurs in `str` with ASCII case folded, or -1. Native lastIndexOf
 * finds each candidate, as it is far faster than a per-character walk when the
 * first character is rare.
 */
export function lastIndexOfCi(
  str: string,
  search: string,
  from: number
): number {
  var first = search.charAt(0)
  var last = Math.min(from, str.length - search.length)
  var at = last < 0 ? -1 : str.lastIndexOf(first, last)
  while (at !== -1 && !matchesFolded(str, at, search)) {
    // A negative fromIndex clamps to 0, which would find index 0 again
    at = at === 0 ? -1 : str.lastIndexOf(first, at - 1)
  }
  return at
}
/** One tag's findClosingTag verdicts; an end of -1 means none recorded */
interface TagMemo {
  /** The bound the failStarts verdicts hold under */
  failEnd: number
  /** Ascending, so a scan drops the verdicts past its start by truncating the list */
  failStarts: number[]
  /** The bound the noCloseFrom verdict holds under */
  noCloseEnd: number
  /** Position from which no `</tag` exists before noCloseEnd */
  noCloseFrom: number
}

/**
 * findClosingTag memo for the string being parsed, so a run of unpaired openers
 * of one tag does not rescan to the bound once per opener. Cleared when the
 * owning parse ends, so a finished document is not kept alive.
 */
var _closeMemoS: string | null = null
var _closeMemo: Record<string, TagMemo | undefined> = Object.create(null)

/**
 * Last `</name` per lowercased name in `_closeMemoS`, or null until failed searches
 * have read as much as the table costs to build. The memo above is per name, so a
 * run of openers under new names would rescan once per name; with this they cost
 * two passes in all, and a document with few failed searches builds nothing.
 */
var _lastCloser: Record<string, number | undefined> | null = null
/** Characters failed searches of `_closeMemoS` have read */
var _failedSearchLength = 0

function resetCloseTagMemo(): void {
  _closeMemoS = null
  _closeMemo = Object.create(null)
  _lastCloser = null
  _failedSearchLength = 0
}

/** Whether a code after `</tag` ends the closer's name, rather than continuing it as a longer name */
function isCloserTail(code: number): boolean {
  return (
    code === $.CHAR_GT ||
    code === $.CHAR_SPACE ||
    code === $.CHAR_TAB ||
    code === $.CHAR_NEWLINE
  )
}

/**
 * Builds `_lastCloser`. A tag name holds no `/`, so a walk reaching one has no name
 * to record and resumes at the `<` that can precede it, which keeps `</a</a` linear.
 */
function lastCloserByName(s: string): Record<string, number | undefined> {
  var table: Record<string, number | undefined> = Object.create(null)
  var at = s.indexOf('</')
  while (at !== -1) {
    var nameEnd = at + 2
    var code = s.charCodeAt(nameEnd)
    while (nameEnd < s.length && code !== $.CHAR_SLASH && !isCloserTail(code)) {
      code = s.charCodeAt(++nameEnd)
    }
    if (nameEnd === s.length || code !== $.CHAR_SLASH) {
      table[s.slice(at + 2, nameEnd).toLowerCase()] = at
    }
    at = s.indexOf('</', nameEnd - 1)
  }
  return table
}

/** Start of the closer (its `<`) found by the last successful findClosingTag */
var _closeTagStart = -1

/**
 * Find the matching closing tag (case-insensitive) after `start`; returns the
 * index just past its `>` or -1, and sets `_closeTagStart`. With `limit` before
 * the end of `s`, the walk stops at `limit`, so a closer past it counts as none,
 * while what it reads of a tag or closer that crosses `limit` is the same as
 * with no limit.
 */
function findClosingTag(
  s: string,
  start: number,
  tagName: string,
  limit: number
): number {
  const tagLower = tagName.toLowerCase()
  const openTag = `<${tagLower}`
  const closeTag = `</${tagLower}`
  let depth = 1
  let i = start
  _closeTagStart = -1

  if (_closeMemoS === s) {
    if (_lastCloser !== null) {
      var lastCloserAt = _lastCloser[tagLower]
      if (lastCloserAt === undefined || lastCloserAt < start) {
        return -1
      }
    }
    var known = _closeMemo[tagLower]
    if (known !== undefined) {
      if (start >= known.noCloseFrom && limit <= known.noCloseEnd) {
        return -1
      }
      if (limit === known.failEnd) {
        var fails = known.failStarts
        var failIdx = firstAtOrAfter(fails, start)
        if (failIdx < fails.length && fails[failIdx] === start) {
          return -1
        }
      }
    }
  }

  // Each counted tag in order, for the failure memo: an opener's end, or -1
  // for a closer. Allocated on the first one, so a scan that finds its closer
  // with no nested pair allocates nothing
  var eventEnds: number[] | null = null
  // Where the scan proved no `</tag` remains before the limit, or -1
  var noCloseFrom = -1
  // The next `<tag` and `</tag` each stay valid until the scan passes them;
  // -1 (none left) stays valid for the rest of the scan
  var openIdx = -2
  var closeIdx = -2

  while (i < limit && depth > 0) {
    if (openIdx !== -1 && openIdx < i) {
      openIdx = indexOfCi(s, openTag, i, limit)
    }
    if (closeIdx < i) {
      closeIdx = indexOfCi(s, closeTag, i, limit)
    }

    if (closeIdx === -1) {
      noCloseFrom = i
      break
    }

    if (openIdx !== -1 && openIdx < closeIdx) {
      // Use __parseHTMLTag to correctly identify if it's an opening tag and not self-closing
      const res = __parseHtmlTag(s, openIdx)
      if (res) {
        // Only count as nested open if tag name matches exactly (not just a prefix like AccordionItem matching Accordion)
        if (
          res.tag.toLowerCase() === tagLower &&
          !res._isClosing &&
          !res._selfClosing &&
          !util.isVoidElement(res.tag)
        ) {
          depth++
          if (eventEnds === null) {
            eventEnds = []
          }
          eventEnds.push(res.end)
        }
        i = res.end
      } else {
        i = openIdx + 1
      }
    } else {
      // Found closing tag - verify it's the exact tag (not a prefix of a longer tag name)
      var afterClosePos = closeIdx + closeTag.length
      // The end of the string counts as a `>`
      var afterClose =
        afterClosePos < s.length ? s.charCodeAt(afterClosePos) : $.CHAR_GT
      if (isCloserTail(afterClose)) {
        depth--
        if (depth === 0) {
          _closeTagStart = closeIdx
          // Find end of closing tag
          let j = closeIdx + closeTag.length
          while (j < s.length && s.charCodeAt(j) !== $.CHAR_GT) {
            j++
          }
          return j + 1
        }
        if (eventEnds === null) {
          eventEnds = []
        }
        eventEnds.push(-1)
      }
      i = closeIdx + 1
    }
  }

  if (_closeMemoS !== s) {
    resetCloseTagMemo()
    _closeMemoS = s
  }
  _failedSearchLength += limit - start
  if (_lastCloser === null && _failedSearchLength >= s.length) {
    _lastCloser = lastCloserByName(s)
  }
  var memo = _closeMemo[tagLower]
  if (memo === undefined) {
    memo = _closeMemo[tagLower] = {
      failEnd: -1,
      failStarts: [],
      noCloseEnd: -1,
      noCloseFrom: -1,
    }
  }
  if (noCloseFrom !== -1) {
    memo.noCloseFrom = noCloseFrom
    memo.noCloseEnd = limit
  }

  // This scan visited every opener from start to where it stopped (past that,
  // the no-closer memo answers), so its verdicts replace the memo's entries
  // past start and the list stays ascending
  var memoFails = memo.failStarts
  if (memo.failEnd !== limit) {
    memoFails.length = 0
    memo.failEnd = limit
  }
  memoFails.length = firstAtOrAfter(memoFails, start)
  if (eventEnds === null) {
    return -1
  }

  // A later search from a counted opener's end walks these same events with
  // its depth shifted down, and fails unless a later event drops below that
  // opener's depth; an opener that would succeed is cleared to -1. Depth
  // changes only at an event, so it is derived walking back from the final one
  var laterMin = depth
  var eventDepth = depth
  for (var ei = eventEnds.length - 1; ei >= 0; ei--) {
    var isOpener = eventEnds[ei] !== -1
    if (laterMin < eventDepth) {
      eventEnds[ei] = -1
    }
    if (eventDepth < laterMin) {
      laterMin = eventDepth
    }
    eventDepth += isOpener ? -1 : 1
  }
  for (ei = 0; ei < eventEnds.length; ei++) {
    if (eventEnds[ei] !== -1) {
      memoFails.push(eventEnds[ei])
    }
  }
  return -1
}

/** Index of the first value >= x in an ascending list (its length if none). */
function firstAtOrAfter(list: number[], x: number): number {
  var lo = 0
  var hi = list.length
  while (lo < hi) {
    var mid = (lo + hi) >> 1
    if (list[mid] < x) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  return lo
}

/** The first match at or after `from` in `s` is at `at`, the string's length if none. */
interface ForwardCursor {
  at: number
  from: number
  s: string
}

/** Each lookup of a parse's blocks moves forward, so these keep the walk linear; parseBlocks saves and restores them across a nested string. */
var _type1TagCursor: ForwardCursor | null = null
var _type1CloserCursor: ForwardCursor | null = null

/** The cursor answering `from`: the one given when it still does, otherwise a new one from a sticky test at each `prefix`. */
function advanceCursor(
  cursor: ForwardCursor | null,
  s: string,
  from: number,
  prefix: string,
  stickyR: RegExp
): ForwardCursor {
  if (
    cursor !== null &&
    cursor.s === s &&
    from >= cursor.from &&
    from <= cursor.at
  ) {
    return cursor
  }

  var at = s.indexOf(prefix, from)
  while (at !== -1) {
    stickyR.lastIndex = at
    if (stickyR.test(s)) {
      return { at, from, s }
    }
    at = s.indexOf(prefix, at + 1)
  }
  return { at: s.length, from, s }
}

/** Whether an opening tag ending at `from` is followed by a blank line and a tag other than `closeTag`, which rules out extending the block without a closer search. */
function isOpenerBeforeBlankLineTag(
  s: string,
  from: number,
  closeTag: string
): boolean {
  var newlines = 0
  var i = from
  var c = s.charCodeAt(i)
  while (c === $.CHAR_NEWLINE || c === $.CHAR_SPACE || c === $.CHAR_TAB) {
    if (c === $.CHAR_NEWLINE) {
      newlines++
    }
    c = s.charCodeAt(++i)
  }
  if (newlines < 2 || c !== $.CHAR_LT) {
    return false
  }
  if (s.slice(i, i + closeTag.length).toLowerCase() !== closeTag) {
    return true
  }
  var afterClose = i + closeTag.length
  var after = afterClose < s.length ? s.charCodeAt(afterClose) : $.CHAR_GT
  return !isCloserTail(after)
}

/** Whether a capitalized or hyphenated tag, which scanHtmlBlock takes as a block, is at `start` */
function isComponentShapedTag(s: string, start: number): boolean {
  var tag = __parseHtmlTag(s, start)
  if (tag === null) {
    return false
  }
  var first = tag.tag.charCodeAt(0)
  return (first >= $.CHAR_A && first <= $.CHAR_Z) || tag.tag.includes('-')
}

/** Scan HTML block */
function scanHtmlBlock(
  s: string,
  p: number,
  state: MarkdownToJSX.State,
  opts: ParseOptions
): ScanResult {
  if (opts.ignoreHTMLBlocks || opts.disableParsingRawHTML) {
    return null
  }

  var e = lineEnd(s, p)
  indent(s, p, e)
  // HTML blocks can be indented up to 3 spaces (unless we are already in an HTML block)
  if (_indentSpaces > 3 && !state.inHTML) {
    return null
  }

  var start = p + _indentChars
  if (s.charCodeAt(start) !== $.CHAR_LT) {
    return null
  }

  // Check for autolink (URL or email) - these are not HTML blocks
  var closeAngle = s.indexOf('>', start + 1)
  if (closeAngle !== -1 && closeAngle < e) {
    var content = s.slice(start + 1, closeAngle)
    if (
      /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(content) ||
      /^[^\s@]+@[^\s@]+$/.test(content)
    ) {
      return null
    }
  }

  // --- CommonMark HTML block type detection ---
  var htmlBlockType = detectHtmlBlockType(s, start)

  // Types 1-5: raw HTML block ending at specific pattern
  // Use indexOf/indexOfCI instead of per-line regex to avoid slice allocations
  if (htmlBlockType >= 1 && htmlBlockType <= 5) {
    var rawEnd = s.length
    if (htmlBlockType === 1) {
      _type1CloserCursor = advanceCursor(
        _type1CloserCursor,
        s,
        start,
        '</',
        TYPE1_CLOSER_STICKY_R
      )
      var closerAt = _type1CloserCursor.at
      if (closerAt < s.length) {
        // The cursor matched the closer through its `>`, so one follows
        rawEnd = nextLine(s, s.indexOf('>', closerAt) + 1)
      }
    } else {
      // Types 2-5: simple string search
      var searchStr =
        htmlBlockType === 2
          ? '-->'
          : htmlBlockType === 3
            ? '?>'
            : htmlBlockType === 4
              ? '>'
              : ']]>'
      var foundPos = s.indexOf(searchStr, start)
      if (foundPos >= 0) {
        rawEnd = nextLine(s, foundPos + searchStr.length)
      }
    }
    var rawText = s.slice(start, rawEnd)

    // Types 2-5: comments, processing instructions, declarations, CDATA
    // These should be htmlComment nodes, not htmlBlock
    if (htmlBlockType >= 2) {
      return {
        node: {
          type: RuleType.htmlComment,
          text: stripDangerousHtml(rawText),
          _endsWithGT: false,
          raw: true,
        } as MarkdownToJSX.HTMLCommentNode,
        end: rawEnd,
      }
    }

    // Type 1: extract tag name, attrs, and parse children
    var type1TagName = 'div'
    var type1Match = rawText.match(/^<\/?([a-zA-Z][a-zA-Z0-9-]*)/)
    if (type1Match) {
      type1TagName = type1Match[1]
    }

    // Parse the opening tag for attrs
    var type1TagResult = __parseHtmlTag(s, start)
    var type1Attrs: Record<string, any> = {}
    var type1RawAttrs: string | undefined
    if (type1TagResult && !type1TagResult._isClosing) {
      type1Attrs = processHtmlAttributes(
        type1TagResult.attrs,
        type1TagName,
        opts
      )
      type1RawAttrs =
        type1TagResult._whitespaceBeforeAttrs + type1TagResult._rawAttrs
    }

    // Parse children from content between opening and closing tags
    // rawText = content after opening tag (may include closing tag) per reference parser
    var type1Children: MarkdownToJSX.ASTNode[] = []
    var type1TagNameLower = type1TagName.toLowerCase()
    var type1ClosePattern = `</${type1TagNameLower}`
    var type1CloseIdx = indexOfCi(rawText, type1ClosePattern, 0, rawText.length)
    var type1TextContent = ''
    var type1RawOuter: string | undefined
    var type1RawBody: string | undefined
    var type1RawClose: string | undefined
    if (type1TagResult?._isClosing) {
      // Closing tag: node is the orphan closer; any trailing same-line/block
      // content becomes the body.
      type1RawClose = rawCloser(s, start, type1TagResult.end, type1TagName)
      var type1Trailing = rawText.slice(type1TagResult.end - start)
      while (
        type1Trailing.length > 0 &&
        type1Trailing.charCodeAt(type1Trailing.length - 1) === $.CHAR_NEWLINE
      ) {
        type1Trailing = type1Trailing.slice(0, -1)
      }
      if (type1Trailing) {
        type1RawBody = stripDangerousHtml(type1Trailing)
      }
    } else if (type1TagResult && !type1TagResult._isClosing) {
      var type1ContentStart = type1TagResult.end - start
      if (type1CloseIdx === -1) {
        // No closing tag found for this element (block ended via a different
        // Type 1 tag's closer): full block including its own opening tag
        // (matches reference parser behavior, prevents HTML compiler from adding closing tag)
        var type1Outer = rawText
        while (
          type1Outer.length > 0 &&
          type1Outer.charCodeAt(type1Outer.length - 1) === $.CHAR_NEWLINE
        ) {
          type1Outer = type1Outer.slice(0, -1)
        }
        type1RawOuter = stripDangerousHtml(type1Outer)
        // The inner content, for the text field and the JSX outputs, which
        // write the element themselves
        var type1InnerStart = type1ContentStart
        if (rawText.charCodeAt(type1InnerStart) === $.CHAR_NEWLINE) {
          type1InnerStart += 1
        }
        type1TextContent = type1Outer.slice(type1InnerStart)
      } else {
        // Has closing tag: split into body (before) and closer (from the
        // closing tag's own source through the end of the block).
        var type1BodyStart = type1ContentStart
        if (rawText.charCodeAt(type1BodyStart) === $.CHAR_NEWLINE) {
          type1BodyStart++
        }
        var type1BodyEnd = type1CloseIdx
        while (type1BodyEnd > type1BodyStart) {
          var type1BodyEndCode = rawText.charCodeAt(type1BodyEnd - 1)
          if (
            type1BodyEndCode !== $.CHAR_SPACE &&
            type1BodyEndCode !== $.CHAR_TAB &&
            type1BodyEndCode !== $.CHAR_NEWLINE &&
            type1BodyEndCode !== $.CHAR_CR
          ) {
            break
          }
          type1BodyEnd--
        }
        var type1BodySlice = rawText.slice(type1BodyStart, type1BodyEnd)
        if (type1BodySlice) {
          type1RawBody = stripDangerousHtml(type1BodySlice)
        }
        var type1CloseSlice = rawText.slice(type1CloseIdx)
        while (
          type1CloseSlice.length > 0 &&
          type1CloseSlice.charCodeAt(type1CloseSlice.length - 1) ===
            $.CHAR_NEWLINE
        ) {
          type1CloseSlice = type1CloseSlice.slice(0, -1)
        }
        type1RawClose = stripDangerousHtml(type1CloseSlice)
        type1TextContent = rawText
          .slice(type1ContentStart, type1CloseIdx)
          .trim()
      }
    }

    var type1IsClosing = type1TagResult ? type1TagResult._isClosing : false
    return {
      node: {
        type: RuleType.htmlBlock,
        tag: type1TagName,
        attrs: type1Attrs,
        _rawAttrs: type1RawAttrs,
        children: type1Children,
        _rawBody: type1RawBody,
        _rawClose: type1RawClose,
        _rawOuter: type1RawOuter,
        // A Type 1 block is never re-parsed
        _reparseSource: undefined,
        text: type1TextContent && stripDangerousHtml(type1TextContent),
        _verbatim: true,
        _isClosingTag: type1IsClosing,
      } as MarkdownToJSX.HTMLNode & { _isClosingTag: boolean },
      end: rawEnd,
    }
  }

  // Types 6-7: HTML block ending at blank line
  if (htmlBlockType === 6 || htmlBlockType === 7) {
    var blankEnd = findNextBlankLine(s, p)
    var rawEnd6 = blankEnd < s.length ? blankEnd : s.length
    var rawText6 = s.slice(start, rawEnd6)
    var end6 = blankEnd < s.length ? nextLine(s, blankEnd) : s.length

    // Try structured parsing to extract tag name and attributes
    var tagResult67 = __parseHtmlTag(s, start)

    if (tagResult67) {
      var tagName67 = tagResult67.tag
      var tagNameLower67 = tagName67.toLowerCase()
      var type67IsClosing = tagResult67._isClosing

      // Closing tag path
      if (type67IsClosing) {
        var afterTag67 = s.slice(tagResult67.end, rawEnd6)
        var afterTagSink67: KeepingChildrenSink = { keepingChildren: undefined }
        var afterTagBody67 = afterTag67
          ? stripDangerousHtml(afterTag67, undefined, afterTagSink67)
          : undefined
        return {
          node: {
            type: RuleType.htmlBlock,
            tag: tagName67,
            attrs: {},
            children: [],
            _rawClose: rawCloser(s, start, tagResult67.end, tagName67),
            _rawBody: afterTagBody67,
            _reparseSource: afterTagSink67.keepingChildren,
            text: afterTagBody67 || '',
            _verbatim: true,
            _isClosingTag: true,
          } as MarkdownToJSX.HTMLNode & { _isClosingTag: boolean },
          end: end6,
        }
      }

      // Void/self-closing elements: return immediately with no content
      if (tagResult67._selfClosing || util.isVoidElement(tagName67)) {
        return {
          node: {
            type: RuleType.htmlBlock,
            tag: tagName67,
            attrs: processHtmlAttributes(tagResult67.attrs, tagName67, opts),
            _rawAttrs:
              tagResult67._whitespaceBeforeAttrs + tagResult67._rawAttrs,
            children: [],
            _reparseSource: undefined,
            text: '',
            _verbatim: false,
            _isClosingTag: false,
          } as MarkdownToJSX.HTMLNode & { _isClosingTag: boolean },
          end:
            tagResult67.end < s.length &&
            s.charCodeAt(tagResult67.end) === $.CHAR_NEWLINE
              ? tagResult67.end + 1
              : tagResult67.end,
        }
      }

      // Opening tag - search for closing tag WITHIN this block (before blank line)
      // Limit search depth to prevent O(n²) on deeply nested same-tag structures
      var htmlDepth67 = state._htmlDepth || 0
      var blockContent67 = s.slice(start, rawEnd6)
      var closeIdx67 = -1
      var closeEndRel67 = -1
      var blockWasExtended67 = false
      if (htmlDepth67 < 10) {
        var closeTag67 = `</${tagNameLower67}`
        var searchStart67 = tagResult67.end - start
        var depth67 = 1
        var ci67 = searchStart67
        // As in findClosingTag, each index stays valid until the scan passes it
        var openIdx67 = -2
        var cIdx67 = -2
        while (ci67 < blockContent67.length && depth67 > 0) {
          if (openIdx67 !== -1 && openIdx67 < ci67) {
            openIdx67 = indexOfCi(
              blockContent67,
              `<${tagNameLower67}`,
              ci67,
              blockContent67.length
            )
          }
          if (cIdx67 < ci67) {
            cIdx67 = indexOfCi(
              blockContent67,
              closeTag67,
              ci67,
              blockContent67.length
            )
          }

          if (cIdx67 === -1) {
            break // no closing tag in block
          }

          if (openIdx67 !== -1 && openIdx67 < cIdx67) {
            // Check if it's a real opening tag (not a prefix match)
            var afterOpen67 = openIdx67 + tagNameLower67.length + 1
            if (afterOpen67 < blockContent67.length) {
              var ac67 = blockContent67.charCodeAt(afterOpen67)
              if (
                ac67 === $.CHAR_SPACE ||
                ac67 === $.CHAR_TAB ||
                ac67 === $.CHAR_NEWLINE ||
                ac67 === $.CHAR_GT ||
                ac67 === $.CHAR_SLASH
              ) {
                depth67++
              }
            }
            ci67 = openIdx67 + 1
          } else {
            // Check closing tag is exact match
            var afterClose67 = cIdx67 + closeTag67.length
            if (afterClose67 < blockContent67.length) {
              if (isCloserTail(blockContent67.charCodeAt(afterClose67))) {
                depth67--
                if (depth67 === 0) {
                  closeIdx67 = cIdx67
                  // Find end of closing tag (past >)
                  var j67 = afterClose67
                  while (
                    j67 < blockContent67.length &&
                    blockContent67.charCodeAt(j67) !== $.CHAR_GT
                  ) {
                    j67++
                  }
                  closeEndRel67 = j67 + 1
                  break
                }
              }
            } else {
              // At end of block content, treat > as present
              depth67--
              if (depth67 === 0) {
                closeIdx67 = cIdx67
                closeEndRel67 = blockContent67.length
                break
              }
            }
            ci67 = cIdx67 + 1
          }
        }

        // Block extension: when no closing tag was found within the pre-blank-line
        // range, search beyond for the matching close tag and extend the block.
        // Type 6 always qualifies. Component-like Type 7 tags (PascalCase JSX or
        // hyphenated custom elements, via tagResult67._isComponentTag) also
        // qualify so blank lines inside `<MyComponent>` nest children instead
        // of leaking siblings (#870).
        // Skip extension when the opening tag is alone on its line followed by a
        // blank line and then another HTML tag (CommonMark Examples 190/191 — the
        // reference parser treats each blank-line-separated element as top level),
        // or when the content contains a Type 1 raw-content element (`<pre>`,
        // `<script>`, `<style>`, `<textarea>`) whose blank lines are structurally
        // inside raw content (CommonMark Example 148).
        if (
          closeIdx67 === -1 &&
          !tagResult67._isClosing &&
          (htmlBlockType === 6 || tagResult67._isComponentTag) &&
          !isOpenerBeforeBlankLineTag(s, tagResult67.end, closeTag67)
        ) {
          // The Type 1 rule is settled by the limit: a closer past the next
          // Type 1 tag rules out extension whether it exists or not
          _type1TagCursor = advanceCursor(
            _type1TagCursor,
            s,
            tagResult67.end,
            '<',
            TYPE1_STICKY_R
          )
          var extCloseEnd = findClosingTag(
            s,
            tagResult67.end,
            tagNameLower67,
            _type1TagCursor.at
          )
          if (extCloseEnd !== -1) {
            var extEnd67 = _closeTagStart
            if (extEnd67 > findNextBlankLine(s, tagResult67.end)) {
              var extLineEnd = lineEnd(s, extCloseEnd)
              rawEnd6 = extLineEnd
              end6 = nextLine(s, extLineEnd)
              blockContent67 = s.slice(start, rawEnd6)
              rawText6 = s.slice(start, rawEnd6)
              closeIdx67 = extEnd67 - start
              closeEndRel67 = extCloseEnd - start
              blockWasExtended67 = true
            }
          }
        }
      }

      // Determine if opening tag has multi-line attributes
      var hasMultiLineAttrs67 =
        tagResult67._rawAttrs.indexOf('\n') !== -1 ||
        tagResult67._whitespaceBeforeAttrs.indexOf('\n') !== -1

      // Check if closing tag is the last meaningful content in the block
      var isCleanBlock67 = false
      if (closeIdx67 !== -1) {
        var afterCloseInBlock67 = blockContent67.slice(closeEndRel67).trim()
        isCleanBlock67 = afterCloseInBlock67.length === 0
      }

      // When a closing tag is found, check if subsequent content starts with another
      // HTML tag. If so, limit block to the closing tag line to allow sibling tags
      // (e.g., <dt>...</dt>\n<dd>...</dd>) to be parsed separately.
      var useInHtmlBounds = false
      var effectiveEndPos = rawEnd6
      var effectiveEnd = end6
      if (closeIdx67 !== -1) {
        var closeAbsPos = start + closeEndRel67
        var closeLineEndPos = lineEnd(s, closeAbsPos - 1)
        // Check for same-line sibling tags after closing tag (e.g. <dt>foo</dt><dd>bar</dd>)
        if (closeAbsPos < closeLineEndPos) {
          var slp67 = closeAbsPos
          while (
            slp67 < closeLineEndPos &&
            (s.charCodeAt(slp67) === $.CHAR_SPACE ||
              s.charCodeAt(slp67) === $.CHAR_TAB)
          ) {
            slp67++
          }
          if (slp67 < closeLineEndPos && s.charCodeAt(slp67) === $.CHAR_LT) {
            // '<'
            var sameLineSibling67 = __parseHtmlTag(s, slp67)
            if (sameLineSibling67 && !sameLineSibling67._isClosing) {
              useInHtmlBounds = true
              effectiveEndPos = closeAbsPos
              effectiveEnd = closeAbsPos
              isCleanBlock67 = true
            }
          }
        }
        // Check content on lines after closing tag for another HTML tag
        if (!useInHtmlBounds) {
          var nextLineStart67 = nextLine(s, closeLineEndPos)
          if (nextLineStart67 < rawEnd6) {
            // Skip leading whitespace on next line
            var nlp67 = nextLineStart67
            while (
              nlp67 < rawEnd6 &&
              (s.charCodeAt(nlp67) === $.CHAR_SPACE ||
                s.charCodeAt(nlp67) === $.CHAR_TAB)
            ) {
              nlp67++
            }
            if (nlp67 < rawEnd6 && s.charCodeAt(nlp67) === $.CHAR_LT) {
              // '<'
              // Next line starts with HTML tag - check if it's a valid tag
              var nextTag67 = __parseHtmlTag(s, nlp67)
              if (nextTag67) {
                // Stop block at closing tag line
                useInHtmlBounds = true
                effectiveEndPos = closeLineEndPos
                effectiveEnd = nextLineStart67
                isCleanBlock67 = true
              }
            }
          }
        }
        // Also limit when inside HTML
        if (!useInHtmlBounds && state.inHTML) {
          useInHtmlBounds = true
          effectiveEndPos = closeLineEndPos
          effectiveEnd = nextLine(s, closeLineEndPos)
          var afterCloseOnLine = s.slice(closeAbsPos, closeLineEndPos).trim()
          isCleanBlock67 = afterCloseOnLine.length === 0
        }
      }

      // Parse children for React/JSX renderers
      var children67: MarkdownToJSX.ASTNode[] = []
      var rawContent67 = ''
      if (closeIdx67 !== -1) {
        rawContent67 = blockContent67.slice(tagResult67.end - start, closeIdx67)
        var trimmed67 = rawContent67.trim()

        if (trimmed67) {
          // Save state, set HTML context for recursive parsing
          var sInline67 = state.inline
          var sInHtml67 = state.inHTML
          var sHtmlDepth67 = state._htmlDepth
          state.inHTML = true
          state._htmlDepth = htmlDepth67 + 1
          // <p> can only contain inline/phrasing content per HTML spec, so always
          // use inline parsing — avoids block rules misinterpreting HTML angle
          // brackets (e.g. ">" on its own line) as blockquote markers
          var isPTag67 = tagNameLower67 === 'p'
          if (isPTag67) {
            state.inline = true
            children67 = queueInline(trimmed67, false, state, opts)
          } else {
            // Detect block content using raw content (before trim) to preserve blank line detection
            var hasDoubleNewline67 = rawContent67.indexOf('\n\n') !== -1
            var hasBlockSyntax67 = blockSyntaxFor(opts).test(trimmed67)
            var hasHtmlTags67 = HTML_OPEN_TAG_R.test(trimmed67)
            var contentHasBlocks67 =
              hasDoubleNewline67 ||
              hasBlockSyntax67 ||
              (state.inHTML && hasHtmlTags67)

            // CommonMark Example 189 / GFM #860: A Type 6 HTML block whose content
            // occupies its own line(s) (newline-separated from the tags) with no
            // blank lines is raw — markdown must NOT be processed. A blank line
            // separating content from tags is required to enable markdown parsing
            // (Example 188). When content is inline with tags (e.g. <div>**x**</div>)
            // the library's markdown-inside-HTML feature still applies.
            var isNewlineWrapped67 =
              rawContent67.length >= 2 &&
              rawContent67.charCodeAt(0) === $.CHAR_NEWLINE &&
              rawContent67.charCodeAt(rawContent67.length - 1) ===
                $.CHAR_NEWLINE &&
              !hasDoubleNewline67
            if (isNewlineWrapped67 && !hasBlockSyntax67 && !hasHtmlTags67) {
              children67 = [
                {
                  type: RuleType.text,
                  text: trimmed67,
                } as MarkdownToJSX.TextNode,
              ]
            } else if (contentHasBlocks67 || hasHtmlTags67) {
              state.inline = false
              children67 = parseBlocks(rawContent67, state, opts)
            } else {
              state.inline = true
              children67 = queueInline(trimmed67, false, state, opts)
            }
          }
          // Restore state
          state.inline = sInline67
          state.inHTML = sInHtml67
          state._htmlDepth = sHtmlDepth67
        }
      }

      // Decide verbatim flag:
      // - Inside HTML (parsing children) → always verbatim
      // - Type 7 blocks → always verbatim (generic tags, reference parser behavior)
      // - Multi-line attributes → verbatim (rawText = content between tags)
      // - Content after closing tag → verbatim (rawText = full block)
      // - No closing tag → verbatim (rawText = full block)
      // - Type 6 with closing tag + inline-only content → verbatim (reference parser behavior)
      //   This allows the React compiler to re-parse rawText and handle sibling tags
      // - Clean block (closing tag is last) → not verbatim (children used)
      // Type 6 blocks with inline content containing HTML tags should be verbatim
      // to allow React compiler to re-parse and split sibling elements (e.g., dt/dd)
      var type6InlineVerbatim67 = false
      if (
        htmlBlockType === 6 &&
        closeIdx67 !== -1 &&
        !state.inHTML &&
        !hasMultiLineAttrs67
      ) {
        // Only force verbatim if content has HTML tags (sibling elements to split)
        // AND no block-level syntax (which needs children-based parsing)
        var hasHtmlInContent67 = /<[a-zA-Z][^>]*>/.test(rawContent67)
        var hasBlockInContent67 =
          rawContent67.indexOf('\n\n') !== -1 ||
          blockSyntaxFor(opts).test(rawContent67)
        if (hasHtmlInContent67 && !hasBlockInContent67) {
          type6InlineVerbatim67 = true
        }
      }
      // Block extension (content has blank lines; closing tag found beyond) means
      // the block is authoritatively nested — render children instead of rawText
      // so the HTML/React compilers produce correct <tag>…children…</tag> output.
      var useVerbatim67 =
        !blockWasExtended67 &&
        (state.inHTML ||
          htmlBlockType === 7 ||
          hasMultiLineAttrs67 ||
          !isCleanBlock67 ||
          type6InlineVerbatim67)

      if (useVerbatim67) {
        // Determine the raw span based on context. rawOuter67 starts at
        // this node's own opening tag (JSX/component re-parse shape);
        // rawBody67 starts after it (may still carry the own closing tag
        // and same-line siblings embedded as literal text, see the
        // _emitOwnClose handling below):
        // - inHTML with close tag: content between tags (rawContent67)
        // - Type 7 with close tag: content after opening tag including close tag
        // - Type 6 multi-line attrs: full block text from start (HTML compiler expects this)
        // - inHTML without close tag: block from start to effective end
        // - Others: full block text from start (rawText6)
        var rawOuter67: string | undefined
        var rawBody67: string | undefined
        var emitOwnClose67 = false
        if (closeIdx67 !== -1 && useInHtmlBounds) {
          // When inside HTML with same-line siblings after closing tag,
          // the body includes everything from after opening tag (including closing tag
          // and siblings). The React compiler re-parses it to split siblings.
          // Only extend it when sibling tags exist on the SAME LINE after closing tag
          var hasAfterClose67 = false
          if (state.inHTML && closeEndRel67 < blockContent67.length) {
            // Check same-line content only (stop at newline)
            var sameLineEnd67 = closeEndRel67
            while (
              sameLineEnd67 < blockContent67.length &&
              blockContent67.charCodeAt(sameLineEnd67) !== $.CHAR_NEWLINE
            ) {
              sameLineEnd67++
            }
            var sameLineAfter67 = blockContent67
              .slice(closeEndRel67, sameLineEnd67)
              .trim()
            // Must be an opening tag (not closing tag like </div>)
            hasAfterClose67 =
              sameLineAfter67.length > 1 &&
              sameLineAfter67.charCodeAt(0) === $.CHAR_LT && // '<'
              sameLineAfter67.charCodeAt(1) !== $.CHAR_SLASH // not '/'
          }
          rawBody67 = hasAfterClose67
            ? blockContent67.slice(tagResult67.end - start)
            : rawContent67
          emitOwnClose67 = true
        } else if ((htmlBlockType === 7 || state.inHTML) && closeIdx67 !== -1) {
          // For Type 7 and inHTML: body = content after opening tag including close tag
          rawBody67 = blockContent67.slice(tagResult67.end - start)
          // Strip leading newline (reference parser behavior)
          if (rawBody67.charCodeAt(0) === $.CHAR_NEWLINE) {
            rawBody67 = rawBody67.slice(1)
          }
        } else if (useInHtmlBounds) {
          rawOuter67 = s.slice(start, effectiveEndPos)
        } else if (hasMultiLineAttrs67) {
          // Full block from start, including the opening tag: the HTML
          // compiler expects this shape for multi-line attributes whether or
          // not a closing tag was found.
          rawOuter67 = rawText6
        } else {
          // Content after opening tag (not including opening tag itself)
          rawBody67 = blockContent67.slice(tagResult67.end - start)
          if (rawBody67.charCodeAt(0) === $.CHAR_NEWLINE) {
            rawBody67 = rawBody67.slice(1)
          }
        }

        var isOuter67 = rawOuter67 !== undefined
        var raw67 = rawBody67 || ''
        if (rawOuter67 !== undefined) {
          raw67 = rawOuter67
        }
        var sink67: KeepingChildrenSink = { keepingChildren: undefined }
        var safeRaw67 = stripDangerousHtml(raw67, undefined, sink67)
        // The public text field is the inner content, without the opening tag
        // or the own closing tag either raw span can hold, and without the line
        // break ending the opening tag's line, as the raw body drops it (only
        // the span between an enclosing block's bounds keeps it)
        var inner67 = rawContent67
        if (closeIdx67 === -1) {
          inner67 = blockContent67.slice(tagResult67.end - start)
        }
        if (
          !(closeIdx67 !== -1 && useInHtmlBounds) &&
          inner67.charCodeAt(0) === $.CHAR_NEWLINE
        ) {
          inner67 = inner67.slice(1)
        }
        var text67 = safeRaw67
        if (inner67 !== raw67) {
          text67 = stripDangerousHtml(inner67)
        }
        var verbatimNode67 = {
          type: RuleType.htmlBlock,
          tag: tagName67,
          attrs: processHtmlAttributes(tagResult67.attrs, tagName67, opts),
          _rawAttrs: tagResult67._whitespaceBeforeAttrs + tagResult67._rawAttrs,
          children: children67,
          _rawBody: isOuter67 ? undefined : safeRaw67,
          _rawOuter: isOuter67 ? safeRaw67 : undefined,
          _reparseSource: sink67.keepingChildren,
          text: text67,
          _verbatim: true,
          _isClosingTag: false,
        } as MarkdownToJSX.HTMLNode
        if (emitOwnClose67) {
          verbatimNode67._emitOwnClose = true
        }
        return {
          node: verbatimNode67,
          end: effectiveEnd,
        }
      }

      // Clean block with closing tag as last content - not verbatim
      // For block-extended nodes (content has blank lines), omit the raw body so
      // HTML compiler uses children path instead of the raw-body path.
      // Both raw-source fields feed a verbatim string emit (html reads
      // _rawBody, markdown reads text), so strip dangerous attributes once.
      var safeRawContent67 = stripDangerousHtml(rawContent67)
      return {
        node: {
          type: RuleType.htmlBlock,
          tag: tagName67,
          attrs: processHtmlAttributes(tagResult67.attrs, tagName67, opts),
          _rawAttrs: tagResult67._whitespaceBeforeAttrs + tagResult67._rawAttrs,
          children: children67,
          _rawBody: blockWasExtended67 ? undefined : safeRawContent67,
          // Not verbatim, so never re-parsed
          _reparseSource: undefined,
          text: safeRawContent67,
          _verbatim: false,
          _isClosingTag: false,
        } as MarkdownToJSX.HTMLNode & { _isClosingTag: boolean },
        end: effectiveEnd,
      }
    }

    // __parseHTMLTag failed - fallback to raw text extraction
    var type67Match = rawText6.match(/^<(\/?)([a-zA-Z][a-zA-Z0-9-]*)/)
    var type67TagF = type67Match ? type67Match[2] : 'div'
    var type67IsClosingF = type67Match ? type67Match[1] === '/' : false
    var type67RawCloseF: string | undefined
    var type67RawBodyF: string | undefined
    var type67RawOuterF: string | undefined
    var type67SinkF: KeepingChildrenSink = { keepingChildren: undefined }
    var type67TrailingF = ''
    if (type67IsClosingF) {
      var closeAngle67 = rawText6.indexOf('>')
      if (closeAngle67 === -1) {
        type67RawCloseF = rawText6
      } else {
        type67RawCloseF = rawText6.slice(0, closeAngle67 + 1)
        type67TrailingF = rawText6.slice(closeAngle67 + 1)
        if (type67TrailingF) {
          type67RawBodyF = stripDangerousHtml(
            type67TrailingF,
            undefined,
            type67SinkF
          )
        }
      }
    } else {
      type67RawOuterF = stripDangerousHtml(rawText6, undefined, type67SinkF)
    }

    return {
      node: {
        type: RuleType.htmlBlock,
        tag: type67TagF,
        attrs: {},
        children: [],
        _rawBody: type67RawBodyF,
        _rawClose: type67RawCloseF,
        _rawOuter: type67RawOuterF,
        _reparseSource: type67SinkF.keepingChildren,
        // One of the two is set, by whether the tag closes
        text: type67RawOuterF || type67RawBodyF || '',
        _verbatim: true,
        _isClosingTag: type67IsClosingF,
      } as MarkdownToJSX.HTMLNode & { _isClosingTag: boolean },
      end: end6,
    }
  }

  // Not a CommonMark HTML block - try structured parsing for JSX/React components
  var tagResult = __parseHtmlTag(s, start)
  if (!tagResult) {
    return null
  }

  var tagName = tagResult.tag
  var tagNameLower = tagName.toLowerCase()
  var firstChar = tagName.charCodeAt(0)
  var isJsx = firstChar >= $.CHAR_A && firstChar <= $.CHAR_Z
  // Skip tags that aren't block-level for block parsing
  // Known lowercase tags not in BLOCK_TAGS/TYPE1_TAGS are inline — skip them here
  // Custom elements (contain hyphen, e.g. <my-widget>) proceed to block parsing
  if (
    !(
      isJsx ||
      BLOCK_TAGS.has(tagNameLower) ||
      TYPE1_TAGS.has(tagNameLower) ||
      tagNameLower.includes('-')
    )
  ) {
    return null
  }

  // Closing tag
  if (tagResult._isClosing) {
    return {
      node: {
        type: RuleType.htmlSelfClosing,
        tag: tagName,
        attrs: {},
        _rawClose: rawCloser(s, start, tagResult.end, tagName),
        _isClosingTag: true,
      } as MarkdownToJSX.HTMLSelfClosingNode & { _isClosingTag: boolean },
      end: tagResult.end,
    }
  }

  var closeEnd = findClosingTag(s, tagResult.end, tagName, s.length)

  var children: MarkdownToJSX.ASTNode[] = []
  if (closeEnd !== -1) {
    var contentEnd = _closeTagStart
    var rawContent = s.slice(tagResult.end, contentEnd)
    var trimmed = rawContent.trim()
    if (trimmed) {
      // Detect block content vs inline content (same logic as Type 6/7 path)
      var hasDoubleNl = rawContent.indexOf('\n\n') !== -1
      var hasBlockSyn = blockSyntaxFor(opts).test(trimmed)
      var hasHtmlTagsS = HTML_OPEN_TAG_R.test(trimmed)
      var sInl = state.inline
      var sHtm = state.inHTML
      var sHd = state._htmlDepth
      state.inHTML = true
      state._htmlDepth = (state._htmlDepth || 0) + 1
      if (hasDoubleNl || hasBlockSyn || hasHtmlTagsS) {
        state.inline = false
        children = parseBlocks(rawContent, state, opts)
      } else {
        state.inline = true
        children = queueInline(trimmed, false, state, opts)
      }
      state.inline = sInl
      state.inHTML = sHtm
      state._htmlDepth = sHd
    }

    var lineEndPos = lineEnd(s, closeEnd)
    var afterClose = s.slice(closeEnd, lineEndPos).trim()
    var endPos = afterClose ? closeEnd : nextLine(s, closeEnd)

    // _rawOuter: full block from start (including opening tag) for React compiler's re-parse logic
    var rawTextJsx = isJsx ? s.slice(start, closeEnd) : s.slice(start, endPos)
    var _nodeEndPos = isJsx ? closeEnd : endPos
    var sinkJsx: KeepingChildrenSink = { keepingChildren: undefined }
    var safeRawJsx = stripDangerousHtml(rawTextJsx, undefined, sinkJsx)

    return {
      node: {
        type: RuleType.htmlBlock,
        tag: tagName,
        attrs: processHtmlAttributes(tagResult.attrs, tagName, opts),
        _rawAttrs: tagResult._whitespaceBeforeAttrs + tagResult._rawAttrs,
        children,
        _rawOuter: safeRawJsx,
        _reparseSource: sinkJsx.keepingChildren,
        // The public text field is the screened inner content, as on every
        // other path; a stored AST without the raw spans is written from it
        text: stripDangerousHtml(rawContent),
        _verbatim: true,
        _isClosingTag: false,
      } as MarkdownToJSX.HTMLNode & { _isClosingTag: boolean },
      end: endPos,
    }
  }

  // No closing tag found - go until blank line
  var blankLineEnd = findNextBlankLine(s, tagResult.end)
  var endFallback =
    blankLineEnd < s.length ? nextLine(s, blankLineEnd) : blankLineEnd
  var contentFallback = s.slice(tagResult.end, blankLineEnd)

  if (contentFallback.trim()) {
    var sInlF = state.inline
    var sHtmF = state.inHTML
    var sHdF = state._htmlDepth
    state.inline = false
    state.inHTML = true
    state._htmlDepth = (state._htmlDepth || 0) + 1
    children = parseBlocks(contentFallback, state, opts)
    state.inline = sInlF
    state.inHTML = sHtmF
    state._htmlDepth = sHdF
  }

  var sinkFallback: KeepingChildrenSink = { keepingChildren: undefined }
  var safeRawFallback = stripDangerousHtml(
    s.slice(tagResult.end, blankLineEnd),
    undefined,
    sinkFallback
  )

  return {
    node: {
      type: RuleType.htmlBlock,
      tag: tagName,
      attrs: processHtmlAttributes(tagResult.attrs, tagName, opts),
      _rawAttrs: tagResult._whitespaceBeforeAttrs + tagResult._rawAttrs,
      children,
      _rawBody: safeRawFallback,
      _reparseSource: sinkFallback.keepingChildren,
      text: safeRawFallback,
      _verbatim: true,
      _isClosingTag: false,
    } as MarkdownToJSX.HTMLNode & { _isClosingTag: boolean },
    end: endFallback,
  }
}

/** Detect CommonMark HTML block type (1-7) or 0 if not an HTML block */
function detectHtmlBlockType(s: string, p: number): number {
  if (s.charCodeAt(p) !== $.CHAR_LT) {
    return 0
  }
  var i = p + 1
  var len = s.length

  // Type 2: <!-- comment
  if (
    s.charCodeAt(i) === $.CHAR_EXCLAMATION &&
    s.charCodeAt(i + 1) === $.CHAR_DASH &&
    s.charCodeAt(i + 2) === $.CHAR_DASH
  ) {
    return 2
  }

  // Type 3: <? processing instruction
  if (s.charCodeAt(i) === $.CHAR_QUESTION) {
    return 3
  }

  // Type 4: <!LETTER declaration
  if (s.charCodeAt(i) === $.CHAR_EXCLAMATION) {
    var nc = s.charCodeAt(i + 1)
    if (nc >= $.CHAR_A && nc <= $.CHAR_Z) {
      return 4
    }
    // Type 5: <![CDATA[
    if (s.slice(i + 1, i + 8) === '[CDATA[') {
      return 5
    }
  }

  // Extract tag name for types 1, 6, 7
  var isClosing = s.charCodeAt(i) === $.CHAR_SLASH
  var nameStart = isClosing ? i + 1 : i
  var nameEnd = nameStart
  while (nameEnd < len) {
    var cc = s.charCodeAt(nameEnd)
    if (
      (cc >= $.CHAR_A && cc <= $.CHAR_Z) ||
      (cc >= $.CHAR_a && cc <= $.CHAR_z) ||
      (cc >= $.CHAR_DIGIT_0 && cc <= $.CHAR_DIGIT_9) ||
      cc === $.CHAR_DASH
    ) {
      nameEnd++
    } else {
      break
    }
  }
  if (nameEnd === nameStart) {
    return 0
  }
  var tagName = s.slice(nameStart, nameEnd)

  // Type 1: <pre, <script, <style, <textarea (opening only — closing tags don't start type 1)
  if (TYPE1_TAGS.has(tagName.toLowerCase())) {
    if (isClosing) {
      // Closing tags of type 1 elements do NOT start HTML blocks per CommonMark spec
      // They serve as end conditions for already-open type 1 blocks
      return 0
    }
    // Opening tag: must be followed by whitespace, >, or end of line
    var afterOpen = s.charCodeAt(nameEnd)
    if (
      afterOpen === $.CHAR_SPACE ||
      afterOpen === $.CHAR_TAB ||
      afterOpen === $.CHAR_GT ||
      afterOpen === $.CHAR_NEWLINE ||
      nameEnd >= len
    ) {
      return 1
    }
    return 0
  }

  // Type 6: block-level tag
  if (BLOCK_TAGS.has(tagName.toLowerCase())) {
    if (isClosing) {
      // Closing: </tag> with optional whitespace
      var j6 = nameEnd
      while (
        j6 < len &&
        (s.charCodeAt(j6) === $.CHAR_SPACE || s.charCodeAt(j6) === $.CHAR_TAB)
      ) {
        j6++
      }
      if (j6 < len && s.charCodeAt(j6) === $.CHAR_GT) {
        return 6
      }
      return 0
    }
    // Opening: must be followed by whitespace, >, />, or end of line
    var ac = nameEnd < len ? s.charCodeAt(nameEnd) : -1
    if (
      ac === $.CHAR_SPACE ||
      ac === $.CHAR_TAB ||
      ac === $.CHAR_GT ||
      ac === $.CHAR_NEWLINE ||
      ac === $.CHAR_SLASH ||
      ac === -1
    ) {
      return 6
    }
    return 0
  }

  // Type 7: complete tag on its own line - tag must end on same line
  // Cannot be a type 1 or type 6 tag (already checked above)
  if (isClosing) {
    // Closing tag for type 7
    var j7 = nameEnd
    while (
      j7 < len &&
      (s.charCodeAt(j7) === $.CHAR_SPACE || s.charCodeAt(j7) === $.CHAR_TAB)
    ) {
      j7++
    }
    if (j7 < len && s.charCodeAt(j7) === $.CHAR_GT) {
      // Must be the only thing on the line
      var le7 = lineEnd(s, p)
      var afterTag7 = s.slice(j7 + 1, le7).trim()
      if (afterTag7 === '') {
        return 7
      }
    }
  } else {
    var le = lineEnd(s, p)
    var tagRes = __parseHtmlTag(s, p)
    if (tagRes && tagRes.end <= le) {
      // Must be the only thing on the line (optionally followed by whitespace)
      var afterTag = s.slice(tagRes.end, le).trim()
      if (afterTag === '') {
        return 7
      }
    }
  }

  return 0
}

/** Parse table row cells */
function parseTableRow(
  s: string,
  state: MarkdownToJSX.State,
  opts: ParseOptions
): MarkdownToJSX.ASTNode[][] {
  // Find row bounds (trim leading/trailing pipe) using indices to avoid substring allocation
  var rStart = 0
  var rEnd = s.length
  while (
    rStart < rEnd &&
    (s.charCodeAt(rStart) === $.CHAR_SPACE ||
      s.charCodeAt(rStart) === $.CHAR_TAB ||
      // A header or body row can be a lazy line of a list item, once per list
      s.charCodeAt(rStart) === $.CHAR_RECORD_SEP)
  ) {
    rStart++
  }
  while (
    rEnd > rStart &&
    (s.charCodeAt(rEnd - 1) === $.CHAR_SPACE ||
      s.charCodeAt(rEnd - 1) === $.CHAR_TAB)
  ) {
    rEnd--
  }
  if (rStart < rEnd && s.charCodeAt(rStart) === $.CHAR_PIPE) {
    rStart++
  }
  if (
    rEnd > rStart &&
    s.charCodeAt(rEnd - 1) === $.CHAR_PIPE &&
    (rEnd - 2 < rStart || s.charCodeAt(rEnd - 2) !== $.CHAR_BACKSLASH)
  ) {
    rEnd--
  }

  // Split by | (but not \| and not | inside code spans)
  // Fast path: track cell start index, only build string when escapes present
  var cells: string[] = []
  var cellStart = rStart
  var hasEscape = false
  var parts: string[] = [] // only used when hasEscape
  var i = rStart

  while (i < rEnd) {
    var ch = s.charCodeAt(i)
    // Handle escape — \| is table-level pipe escape
    if (ch === $.CHAR_BACKSLASH && i + 1 < rEnd) {
      // backslash
      if (s.charCodeAt(i + 1) === $.CHAR_PIPE) {
        // \|
        if (!hasEscape) {
          hasEscape = true
          parts = []
        }
        parts.push(s.slice(cellStart, i))
        parts.push('|')
        i += 2
        cellStart = i
      } else {
        i += 2 // skip escape pair
      }
      continue
    }
    // Handle code span — skip to closing backticks
    if (ch === $.CHAR_BACKTICK) {
      // `
      var backticks = 0
      while (i < rEnd && s.charCodeAt(i) === $.CHAR_BACKTICK) {
        backticks++
        i++
      }
      var found = false
      while (i < rEnd && !found) {
        var closeBackticks = 0
        while (i < rEnd && s.charCodeAt(i) === $.CHAR_BACKTICK) {
          closeBackticks++
          i++
        }
        if (closeBackticks === backticks) {
          found = true
        } else if (closeBackticks === 0) {
          i++
        }
      }
      continue
    }
    // Handle cell separator
    if (ch === $.CHAR_PIPE) {
      // |
      var cellText = hasEscape
        ? (parts.push(s.slice(cellStart, i)), parts.join(''))
        : s.slice(cellStart, i)
      cells.push(cellText.trim())
      i++
      cellStart = i
      hasEscape = false
      parts = []
      continue
    }
    i++
  }
  // Push final cell
  var lastCell = hasEscape
    ? (parts.push(s.slice(cellStart, rEnd)), parts.join(''))
    : s.slice(cellStart, rEnd)
  cells.push(lastCell.trim())

  return cells.map(cell => {
    // Replace remaining \| with | (pipe escapes inside code spans are kept during
    // splitting). Reads pairs: the pipe in `\\|` is one the split already unescaped.
    var processed =
      cell.indexOf('\\|') === -1
        ? cell
        : cell.replace(/\\[\s\S]/g, pair => (pair === '\\|' ? '|' : pair))
    if (!processed) {
      return []
    }
    return queueInline(processed, false, state, opts)
  })
}

/** Scan GFM table */
function scanTable(
  s: string,
  p: number,
  state: MarkdownToJSX.State,
  opts: ParseOptions
): ScanResult {
  const firstEnd = lineEnd(s, p)

  // Must have at least one | — check without slicing
  var pipeIdx = s.indexOf('|', p)
  if (pipeIdx < 0 || pipeIdx >= firstEnd) {
    return null
  }

  // Check for delimiter row
  const secondStart = nextLine(s, firstEnd)
  if (secondStart >= s.length) {
    return null
  }

  const secondEnd = lineEnd(s, secondStart)
  // Delimiter row must match pattern: |? :?-+:? (| :?-+:?)* |?
  if (!isDelimiterRow(s, secondStart, secondEnd)) {
    return null
  }

  // Only slice firstLine after delimiter check passes (most | chars aren't tables)
  const firstLine = s.slice(p, firstEnd)
  const delimLine = s.slice(secondStart, secondEnd)

  // Parse alignment from delimiter row — single pass, no split/map/trim
  var align: (null | 'left' | 'right' | 'center')[] = []
  var di = 0
  var dLen = delimLine.length
  // skip leading whitespace + optional pipe
  while (
    di < dLen &&
    (delimLine.charCodeAt(di) === $.CHAR_SPACE ||
      delimLine.charCodeAt(di) === $.CHAR_TAB)
  ) {
    di++
  }
  if (di < dLen && delimLine.charCodeAt(di) === $.CHAR_PIPE) {
    di++
  }
  while (di < dLen) {
    // skip whitespace before cell
    while (
      di < dLen &&
      (delimLine.charCodeAt(di) === $.CHAR_SPACE ||
        delimLine.charCodeAt(di) === $.CHAR_TAB)
    ) {
      di++
    }
    if (di >= dLen) {
      break
    }
    // trailing pipe — done
    if (delimLine.charCodeAt(di) === $.CHAR_PIPE) {
      break
    }
    // check leading colon
    var hasLeft = delimLine.charCodeAt(di) === $.CHAR_COLON
    if (hasLeft) {
      di++
    }
    // skip dashes
    while (di < dLen && delimLine.charCodeAt(di) === $.CHAR_DASH) {
      di++
    }
    // check trailing colon
    var hasRight = di < dLen && delimLine.charCodeAt(di) === $.CHAR_COLON
    if (hasRight) {
      di++
    }
    align.push(
      hasLeft && hasRight
        ? 'center'
        : hasRight
          ? 'right'
          : hasLeft
            ? 'left'
            : null
    )
    // skip whitespace + pipe
    while (
      di < dLen &&
      (delimLine.charCodeAt(di) === $.CHAR_SPACE ||
        delimLine.charCodeAt(di) === $.CHAR_TAB)
    ) {
      di++
    }
    if (di < dLen && delimLine.charCodeAt(di) === $.CHAR_PIPE) {
      di++
    }
  }

  // Parse header
  const header = parseTableRow(firstLine, state, opts)

  // Delimiter column count must match header
  if (align.length !== header.length) {
    return null
  }

  // Parse body cells
  const cells: MarkdownToJSX.ASTNode[][][] = []
  let end = nextLine(s, secondEnd)

  while (end < s.length) {
    const le = lineEnd(s, end)
    const line = s.slice(end, le)

    if (isBlank(s, end, le)) {
      break
    }
    // Check if line starts a block element that should end the table
    indent(s, end, le)
    if (_indentSpaces < 4) {
      var tc = s.charCodeAt(end + _indentChars)
      // Blockquote, heading, thematic break, fenced code, HTML block all end the table
      if (tc === $.CHAR_GT || tc === $.CHAR_HASH) {
        break // > or #
      }
      if (
        (tc === $.CHAR_DASH ||
          tc === $.CHAR_ASTERISK ||
          tc === $.CHAR_UNDERSCORE) &&
        scanThematic(s, end)
      ) {
        break
      }
      if (tc === $.CHAR_BACKTICK || tc === $.CHAR_TILDE) {
        var tfp = end + _indentChars
        var tfc = 0
        while (tfp < le && s.charCodeAt(tfp) === tc) {
          tfc++
          tfp++
        }
        if (tfc >= 3) {
          break
        }
      }
    }
    // Per GFM, body rows don't require | — they can be pipeless (single-cell)

    cells.push(parseTableRow(line, state, opts))
    end = nextLine(s, le)
  }

  // For streaming mode: suppress tables with header + separator but no data rows
  // (data rows might be coming in a later stream chunk)
  if (opts.optimizeForStreaming && cells.length === 0) {
    return null
  }

  // Normalize: pad/trim rows to match header column count
  var colCount = header.length
  for (var ri = 0; ri < cells.length; ri++) {
    if (cells[ri].length < colCount) {
      while (cells[ri].length < colCount) {
        cells[ri].push([])
      }
    } else if (cells[ri].length > colCount) {
      cells[ri].length = colCount
    }
  }

  return {
    node: {
      type: RuleType.table,
      header,
      cells,
      align,
    } as MarkdownToJSX.TableNode,
    end,
  }
}

/** Scan link reference definition [label]: url "title" */
function scanRefDefinition(
  s: string,
  p: number,
  state: MarkdownToJSX.State
): ScanResult {
  var e = lineEnd(s, p)
  indent(s, p, e)
  if (_indentSpaces > 3) {
    return null
  }

  var i = p + _indentChars
  if (s.charCodeAt(i) !== $.CHAR_BRACKET_OPEN) {
    return null // [
  }

  // Check for footnote [^
  if (i + 1 < s.length && s.charCodeAt(i + 1) === $.CHAR_CARET) {
    // Footnote definition - handle separately
    var fnResult = parseFootnoteDefinition(s, i, state)
    if (fnResult) {
      return fnResult
    }
    return null
  }

  // Use parseRefDef which handles multi-line titles correctly
  if (!state.refs) {
    state.refs = Object.create(null) as {
      [key: string]: { target: string; title: string | undefined }
    }
  }
  var result = parseRefDef(s, i, state.refs)
  if (result === null) {
    return null
  }

  return {
    node: { type: RuleType.refCollection } as MarkdownToJSX.ASTNode,
    end: result,
  }
}

function parseFootnoteDefinition(
  s: string,
  p: number,
  state: MarkdownToJSX.State
): ScanResult {
  // Parse [^label]:
  var len = s.length
  if (
    s.charCodeAt(p) !== $.CHAR_BRACKET_OPEN ||
    p + 1 >= len ||
    s.charCodeAt(p + 1) !== $.CHAR_CARET
  ) {
    return null
  }

  var i = p + 2
  var labelStart = i
  while (i < len && s.charCodeAt(i) !== $.CHAR_BRACKET_CLOSE) {
    if (s.charCodeAt(i) === $.CHAR_NEWLINE) {
      return null
    }
    i++
  }
  if (i >= len) {
    return null
  }
  var label = `^${s.slice(labelStart, i)}`.toLowerCase()
  i++ // skip ]

  if (i >= len || s.charCodeAt(i) !== $.CHAR_COLON) {
    return null
  }
  i++ // skip :

  // Skip whitespace
  while (
    i < len &&
    (s.charCodeAt(i) === $.CHAR_SPACE || s.charCodeAt(i) === $.CHAR_TAB)
  ) {
    i++
  }
  if (i < len && s.charCodeAt(i) === $.CHAR_NEWLINE) {
    i++
    // A lazy line carries one marker per list it continues
    while (s.charCodeAt(i) === $.CHAR_RECORD_SEP) {
      i++
    }
    while (
      i < len &&
      (s.charCodeAt(i) === $.CHAR_SPACE || s.charCodeAt(i) === $.CHAR_TAB)
    ) {
      i++
    }
  }

  // Collect content
  var fnEnd = s.indexOf('\n', i)
  if (fnEnd < 0) {
    fnEnd = len
  }
  var content = s.slice(i, fnEnd).trim()
  var end = fnEnd < len ? fnEnd + 1 : len

  // Multiline continuation (2+ space indent)
  while (end < len) {
    var nextLe = lineEnd(s, end)
    indent(s, end, nextLe)
    if (_indentSpaces >= 2 && !isBlank(s, end, nextLe)) {
      content += `\n${s.slice(end, nextLe)}`
      end = nextLine(s, nextLe)
    } else if (isBlank(s, end, nextLe)) {
      var afterBlank = nextLine(s, nextLe)
      if (afterBlank < len) {
        var afterBlankEnd = lineEnd(s, afterBlank)
        indent(s, afterBlank, afterBlankEnd)
        if (_indentSpaces >= 2) {
          content += '\n'
          end = nextLine(s, nextLe)
          continue
        }
      }
      break
    } else {
      break
    }
  }

  var footnoteRefs = state.refs
  if (footnoteRefs && !footnoteRefs[label]) {
    footnoteRefs[label] = { target: content, title: undefined }
  }
  return { node: { type: RuleType.footnote } as MarkdownToJSX.ASTNode, end }
}

/** Scan paragraph (fallback) */
function scanParagraph(
  s: string,
  p: number,
  state: MarkdownToJSX.State,
  opts: ParseOptions
): ScanResult {
  let end = p
  let setextLevel = 0
  let textEnd = 0
  let cachedLe = -1 // Cache lineEnd from previous iteration's next-line check

  while (end < s.length) {
    const le = cachedLe >= 0 ? cachedLe : lineEnd(s, end)
    cachedLe = -1

    // Check for blank line
    if (isBlank(s, end, le)) {
      break
    }

    // Check if this line is a setext underline
    indent(s, end, le)
    if (_indentSpaces < 4 && textEnd > 0 && !state._noSetext) {
      const c = s.charCodeAt(end + _indentChars)
      if (c === $.CHAR_EQ || c === $.CHAR_DASH) {
        // = or -
        // Check if entire line is = or - (with optional spaces)
        let i = end + _indentChars
        while (i < le && s.charCodeAt(i) === c) {
          i++
        }
        while (
          i < le &&
          (s.charCodeAt(i) === $.CHAR_SPACE || s.charCodeAt(i) === $.CHAR_TAB)
        ) {
          i++
        }
        if (i >= le) {
          setextLevel = c === $.CHAR_EQ ? 1 : 2
          end = nextLine(s, le)
          break
        }
      }
    }

    textEnd = le

    // Check if next line starts a new block
    const nextStart = nextLine(s, le)
    if (nextStart < s.length) {
      // \u001E prefix marks lazy continuation — never break paragraph here
      if (s.charCodeAt(nextStart) === $.CHAR_RECORD_SEP) {
        var lazyLe = lineEnd(s, nextStart)
        end = nextLine(s, lazyLe)
        textEnd = lazyLe
        continue
      }
      const nextLe = lineEnd(s, nextStart)
      cachedLe = nextLe // Cache for next iteration (nextStart becomes end)
      indent(s, nextStart, nextLe)
      if (_indentSpaces < 4) {
        const c = s.charCodeAt(nextStart + _indentChars)
        // Check for block starters that interrupt paragraphs
        if (c === $.CHAR_GT) {
          // > blockquote
          end = nextStart
          break
        }
        if (c === $.CHAR_HASH) {
          // # heading - must be valid ATX heading
          // Spec: interruption depends only on the ATX start condition
          // (1-6 #s then space/tab/EOL). Running full scanHeading here would
          // parse + slug the heading and discard it (and queue an orphaned
          // deferred inline entry), then parseBlocks would parse it again.
          var atxP = nextStart + _indentChars
          var atxLevel = 0
          while (
            atxP < nextLe &&
            s.charCodeAt(atxP) === $.CHAR_HASH &&
            atxLevel <= 6
          ) {
            atxLevel++
            atxP++
          }
          if (
            atxLevel >= 1 &&
            atxLevel <= 6 &&
            (opts.enforceAtxHeadings === false ||
              atxP >= nextLe ||
              s.charCodeAt(atxP) === $.CHAR_SPACE ||
              s.charCodeAt(atxP) === $.CHAR_TAB)
          ) {
            end = nextStart
            break
          }
        }
        if (c === $.CHAR_BACKTICK || c === $.CHAR_TILDE) {
          // ` or ~ fenced code - need 3+
          var fenceCheck = nextStart + _indentChars
          var fenceCheckCount = 0
          while (fenceCheck < nextLe && s.charCodeAt(fenceCheck) === c) {
            fenceCheckCount++
            fenceCheck++
          }
          if (fenceCheckCount >= 3) {
            end = nextStart
            break
          }
        }
        // HTML blocks can interrupt paragraphs, but only types 1-6
        // Type 7 (generic tags) cannot interrupt paragraphs
        // Pre-check tag name before calling expensive scanHTMLBlock
        if (c === $.CHAR_LT) {
          var afterLt = nextStart + _indentChars + 1
          var hc = afterLt < nextLe ? s.charCodeAt(afterLt) : 0
          var canInterrupt =
            hc === $.CHAR_EXCLAMATION || // ! (comment <!--, <!DOCTYPE, <![CDATA[)
            hc === $.CHAR_QUESTION // ? (processing instruction <?)
          if (!canInterrupt && hc === $.CHAR_SLASH) {
            // Closing tag — extract tag name and check if block-level
            var closeTagStart = afterLt + 1
            var closeTagEnd = closeTagStart
            while (
              closeTagEnd < nextLe &&
              ((s.charCodeAt(closeTagEnd) >= $.CHAR_A &&
                s.charCodeAt(closeTagEnd) <= $.CHAR_Z) ||
                (s.charCodeAt(closeTagEnd) >= $.CHAR_a &&
                  s.charCodeAt(closeTagEnd) <= $.CHAR_z) ||
                (s.charCodeAt(closeTagEnd) >= $.CHAR_DIGIT_0 &&
                  s.charCodeAt(closeTagEnd) <= $.CHAR_DIGIT_9) ||
                s.charCodeAt(closeTagEnd) === $.CHAR_DASH)
            ) {
              closeTagEnd++
            }
            if (closeTagEnd > closeTagStart) {
              canInterrupt = BLOCK_TAGS.has(
                s.slice(closeTagStart, closeTagEnd).toLowerCase()
              )
            }
          } else if (!canInterrupt) {
            // Opening tag — extract tag name and check if block-level (type 1 or 6)
            var tagEndHc = afterLt
            while (
              tagEndHc < nextLe &&
              ((s.charCodeAt(tagEndHc) >= $.CHAR_A &&
                s.charCodeAt(tagEndHc) <= $.CHAR_Z) ||
                (s.charCodeAt(tagEndHc) >= $.CHAR_a &&
                  s.charCodeAt(tagEndHc) <= $.CHAR_z) ||
                (s.charCodeAt(tagEndHc) >= $.CHAR_DIGIT_0 &&
                  s.charCodeAt(tagEndHc) <= $.CHAR_DIGIT_9) ||
                s.charCodeAt(tagEndHc) === $.CHAR_DASH)
            ) {
              tagEndHc++
            }
            if (tagEndHc > afterLt) {
              var tagNameLc = s.slice(afterLt, tagEndHc).toLowerCase()
              canInterrupt =
                BLOCK_TAGS.has(tagNameLc) || TYPE1_TAGS.has(tagNameLc)
            }
          }
          // Only call expensive scanHTMLBlock if pre-check passes
          if (canInterrupt && scanHtmlBlock(s, nextStart, state, opts)) {
            end = nextStart
            break
          }
        }
        // List items can interrupt paragraphs (- * + or digit followed by . or ))
        // But empty list items CANNOT interrupt paragraphs per CommonMark
        if (c === $.CHAR_DASH || c === $.CHAR_ASTERISK || c === $.CHAR_PLUS) {
          // - * + followed by space/tab (must have content — not empty)
          const next = nextStart + _indentChars + 1
          if (
            next < nextLe &&
            (s.charCodeAt(next) === $.CHAR_SPACE ||
              s.charCodeAt(next) === $.CHAR_TAB)
          ) {
            // Has content after space — check it's not all whitespace (empty item)
            var contentAfterMarker = skipWs(s, next, nextLe)
            if (contentAfterMarker < nextLe) {
              // Only interrupt if not a thematic break
              if (!scanThematic(s, nextStart)) {
                end = nextStart
                break
              }
            }
          }
        }
        if (c >= $.CHAR_DIGIT_0 && c <= $.CHAR_DIGIT_9) {
          // Digit - check for ordered list
          // Per CommonMark, only "1." or "1)" can interrupt a paragraph
          // And empty items cannot interrupt paragraphs
          let i = nextStart + _indentChars
          while (
            i < nextLe &&
            s.charCodeAt(i) >= $.CHAR_DIGIT_0 &&
            s.charCodeAt(i) <= $.CHAR_DIGIT_9
          ) {
            i++
          }
          if (
            i < nextLe &&
            (s.charCodeAt(i) === $.CHAR_PERIOD ||
              s.charCodeAt(i) === $.CHAR_PAREN_CLOSE) &&
            i - (nextStart + _indentChars) === 1 &&
            s.charCodeAt(nextStart + _indentChars) === 49
          ) {
            var afterMarker = i + 1
            if (
              afterMarker < nextLe &&
              (s.charCodeAt(afterMarker) === $.CHAR_SPACE ||
                s.charCodeAt(afterMarker) === $.CHAR_TAB)
            ) {
              var contentAfterOrd = skipWs(s, afterMarker, nextLe)
              if (contentAfterOrd < nextLe) {
                end = nextStart
                break
              }
            }
          }
        }
        // Tables can interrupt paragraphs if the line starts with |
        if (c === $.CHAR_PIPE) {
          // |
          // Check if this could be a table (need to verify there's a delimiter row)
          const thirdStart = nextLine(s, nextLe)
          if (thirdStart < s.length) {
            const thirdEnd = lineEnd(s, thirdStart)
            if (isDelimiterRow(s, thirdStart, thirdEnd)) {
              end = nextStart
              break
            }
          }
        }
        // Thematic break (but not setext underline)
        if (
          (c === $.CHAR_DASH ||
            c === $.CHAR_ASTERISK ||
            c === $.CHAR_UNDERSCORE) &&
          scanThematic(s, nextStart)
        ) {
          // For dashes, only break if it's really a thematic break not setext
          if (c !== $.CHAR_DASH) {
            end = nextStart
            break
          }
          // Check if it could be setext (need at least 1 dash)
          let _dashCount = 0
          let i = nextStart + _indentChars
          while (i < nextLe && s.charCodeAt(i) === $.CHAR_DASH) {
            _dashCount++
            i++
          }
          while (
            i < nextLe &&
            (s.charCodeAt(i) === $.CHAR_SPACE || s.charCodeAt(i) === $.CHAR_TAB)
          ) {
            i++
          }
          // If whole line is dashes, it could be setext - let loop continue to check
          if (i < nextLe) {
            end = nextStart
            break // Not setext, it's thematic break
          }
        }
      }
    }

    end = nextLine(s, le)
  }

  // If setext, use textEnd as the content end
  var contentEnd = setextLevel ? textEnd : end
  // Trim trailing newlines and whitespace via index adjustment (avoid slice+replace+trim chain)
  while (
    contentEnd > p &&
    (s.charCodeAt(contentEnd - 1) === $.CHAR_NEWLINE ||
      s.charCodeAt(contentEnd - 1) === $.CHAR_CR ||
      s.charCodeAt(contentEnd - 1) === $.CHAR_SPACE ||
      s.charCodeAt(contentEnd - 1) === $.CHAR_TAB)
  ) {
    contentEnd--
  }
  var textStart = p
  while (
    textStart < contentEnd &&
    (s.charCodeAt(textStart) === $.CHAR_SPACE ||
      s.charCodeAt(textStart) === $.CHAR_TAB)
  ) {
    textStart++
  }
  if (textStart >= contentEnd) {
    return null
  }
  // Check for \u001E markers only within [textStart, contentEnd) — bounded scan
  // avoids O(n) indexOf over the entire remaining document per paragraph
  var hasMarker = false
  for (var mi = textStart; mi < contentEnd; mi++) {
    if (s.charCodeAt(mi) === $.CHAR_RECORD_SEP) {
      hasMarker = true
      break
    }
  }
  var text = hasMarker
    ? s.slice(textStart, contentEnd).replace(/\u001E/g, '')
    : s.slice(textStart, contentEnd)
  if (!text) {
    return null
  }

  // Inline parser handles hard line breaks directly (two+ spaces or \ before newline)
  const children = queueInline(text, true, state, opts)

  if (setextLevel) {
    // Heading ids are assigned after the deferred inline flush (assignHeadingIds).
    return {
      node: {
        type: RuleType.heading,
        level: setextLevel,
        children,
        id: '',
      } as MarkdownToJSX.HeadingNode,
      end,
    }
  }

  return {
    node: {
      type: RuleType.paragraph,
      children,
    } as MarkdownToJSX.ParagraphNode,
    end,
  }
}

/**
 * Defer a block-level inline parse until the block pass completes.
 *
 * Reference definitions are registered by scanRefDefinition during the block
 * pass, so deferring inline parsing until parseMarkdown's drain guarantees
 * forward references ([foo] used before [foo]: /url is defined) resolve in
 * every container: paragraphs, headings, list items, table cells, HTML blocks.
 * The returned array is the node's children; the drain fills it in place so
 * captured references (e.g. tight-list unwrap) stay live.
 *
 * State flags are captured at the callsite so the drain replays the parse
 * with exactly the values eager parsing would have seen.
 */
function queueInline(
  text: string,
  breaks: boolean,
  state: MarkdownToJSX.State,
  opts: ParseOptions
): MarkdownToJSX.ASTNode[] {
  var q = state._pendingInline
  if (!q) {
    var savedBreaks = state._breaks
    state._breaks = breaks
    var direct = parseInline(text, 0, text.length, state, opts)
    state._breaks = savedBreaks
    return direct
  }
  var dest: MarkdownToJSX.ASTNode[] = []
  q.push({
    dest,
    text,
    breaks,
    inline: state.inline,
    inAnchor: state.inAnchor,
    inHTML: state.inHTML,
    htmlDepth: state._htmlDepth,
    inList: state.inList,
    inBlockQuote: state.inBlockQuote,
    noSetext: state._noSetext,
    depth: state._depth,
    notAtEdge: state._notAtEdge,
  })
  return dest
}

// ============================================================================
// INLINE SCANNERS
// ============================================================================

/** Scan inline code span */
function scanCodeSpan(s: string, p: number, e: number): ScanResult {
  if (s.charCodeAt(p) !== $.CHAR_BACKTICK) {
    return null
  }

  // Count opening backticks
  const openLen = countChar(s, p, e, 96)
  let i = p + openLen

  // Find matching closing backticks (bounded to [i, e))
  while (i < e) {
    const j = s.indexOf('`', i)
    if (j < 0 || j >= e) {
      return null
    }

    const closeLen = countChar(s, j, e, 96)
    if (closeLen === openLen) {
      // Found matching close
      let content = s.slice(p + openLen, j)
      // CommonMark: line endings inside a code span render as spaces.
      // Guard the replace so the common newline-free span pays nothing.
      if (content.indexOf('\n') !== -1) {
        content = content.replace(/\n/g, ' ')
      }
      // Strip one space from each end if both ends have space and there's non-space content
      if (
        content.length > 0 &&
        content[0] === ' ' &&
        content.at(-1) === ' ' &&
        content.trim().length > 0
      ) {
        content = content.slice(1, -1)
      }

      return {
        node: {
          type: RuleType.codeInline,
          text: content,
        } as MarkdownToJSX.CodeInlineNode,
        end: j + closeLen,
      }
    }
    i = j + closeLen
  }

  return null
}

/** Skip over a code span starting at position i, return position after code span or i if not a code span */
function skipCodeSpan(s: string, i: number, e: number): number {
  if (s.charCodeAt(i) !== $.CHAR_BACKTICK) {
    return i
  }
  const openLen = countChar(s, i, e, 96)
  let j = i + openLen
  while (j < e) {
    const k = s.indexOf('`', j)
    if (k < 0 || k >= e) {
      return i // no close found within range
    }
    const closeLen = countChar(s, k, e, 96)
    if (closeLen === openLen) {
      return k + closeLen // return position after code span
    }
    j = k + closeLen
  }
  return i // no valid close
}

/** Least characters a parse can spend on `_tagSkipBudget`, so a short input never reaches it */
const TAG_SKIP_BUDGET_FLOOR = 1_048_576

/**
 * Characters the bracket walk may still read through tags in this parse. A tag
 * with no closer reads to the end of the range and every `[` can reach another,
 * under any number of names, so no per-tag memo bounds it. Documents stay far
 * under this total; past it a `<` is a plain character to the walk.
 */
var _tagSkipBudget = TAG_SKIP_BUDGET_FLOOR

/** Skip over an inline HTML element (including content and closing tag) starting at position i */
function skipInlineHtmlElement(s: string, i: number, e: number): number {
  if (s.charCodeAt(i) !== $.CHAR_LT || _tagSkipBudget <= 0) {
    return i
  }

  // Check for closing tag or comment
  if (i + 1 < e && s.charCodeAt(i + 1) === $.CHAR_SLASH) {
    // </
    // Closing tag - just skip to >
    let j = i + 2
    while (j < e && s.charCodeAt(j) !== $.CHAR_GT) {
      j++
    }
    if (j < e) {
      return j + 1
    }
    _tagSkipBudget -= j - i
    return i
  }

  if (
    i + 3 < e &&
    s.charCodeAt(i + 1) === $.CHAR_EXCLAMATION &&
    s.charCodeAt(i + 2) === $.CHAR_DASH &&
    s.charCodeAt(i + 3) === $.CHAR_DASH
  ) {
    // HTML comment <!-- -->
    const closeIdx = terminatorAt(s, '-->', i + 4)
    return closeIdx < 0 ? i : closeIdx + 3
  }

  // Get tag name
  let j = i + 1
  const tagStart = j
  while (j < e) {
    const c = s.charCodeAt(j)
    if (
      (c >= $.CHAR_A && c <= $.CHAR_Z) ||
      (c >= $.CHAR_a && c <= $.CHAR_z) ||
      (c >= $.CHAR_DIGIT_0 && c <= $.CHAR_DIGIT_9) ||
      c === $.CHAR_DASH
    ) {
      j++
    } else {
      break
    }
  }
  if (j === tagStart) {
    return i // not a valid tag
  }
  const tag = s.slice(tagStart, j).toLowerCase()

  // Skip to end of opening tag (newlines allowed inside quoted attributes per CommonMark)
  let selfClosing = false
  while (j < e) {
    const c = s.charCodeAt(j)
    if (c === $.CHAR_GT) {
      // >
      j++
      break
    }
    if (c === $.CHAR_SLASH && j + 1 < e && s.charCodeAt(j + 1) === $.CHAR_GT) {
      // />
      j += 2
      selfClosing = true
      break
    }
    // Allow newlines inside quoted attribute values
    if (c === $.CHAR_DOUBLE_QUOTE || c === $.CHAR_SINGLE_QUOTE) {
      // " or '
      var q = c
      j++
      while (j < e && s.charCodeAt(j) !== q) {
        j++
      }
      if (j < e) {
        j++ // skip closing quote
      }
      continue
    }
    if (c === $.CHAR_NEWLINE) {
      _tagSkipBudget -= j - i
      return i // newline outside quoted attribute
    }
    j++
  }

  if (selfClosing) {
    return j
  }

  // Void elements don't have closing tags
  if (util.isVoidElement(tag)) {
    return j
  }

  // Find matching closing tag
  let depth = 1
  while (j < e && depth > 0) {
    if (s.charCodeAt(j) === $.CHAR_LT) {
      // <
      if (j + 1 < e && s.charCodeAt(j + 1) === $.CHAR_SLASH) {
        // </
        // Check if it's closing our tag
        const closeTagStart = j + 2
        let k = closeTagStart
        while (
          k < e &&
          ((s.charCodeAt(k) >= $.CHAR_A && s.charCodeAt(k) <= $.CHAR_Z) ||
            (s.charCodeAt(k) >= $.CHAR_a && s.charCodeAt(k) <= $.CHAR_z))
        ) {
          k++
        }
        const closeTag = s.slice(closeTagStart, k).toLowerCase()
        if (closeTag === tag) {
          // Skip to end of closing tag
          while (k < e && s.charCodeAt(k) !== $.CHAR_GT) {
            k++
          }
          if (k < e) {
            k++ // skip >
          }
          depth--
          if (depth === 0) {
            return k
          }
        }
        j = k
      } else {
        // Opening tag - check if same tag
        const nextTagStart = j + 1
        let k = nextTagStart
        while (
          k < e &&
          ((s.charCodeAt(k) >= $.CHAR_A && s.charCodeAt(k) <= $.CHAR_Z) ||
            (s.charCodeAt(k) >= $.CHAR_a && s.charCodeAt(k) <= $.CHAR_z))
        ) {
          k++
        }
        const nextTag = s.slice(nextTagStart, k).toLowerCase()
        if (nextTag === tag) {
          depth++
        }
        j++
      }
    } else {
      j++
    }
  }

  return j
}

/** Scan strikethrough ~~text~~ */
function scanStrikethrough(
  s: string,
  p: number,
  e: number,
  state: MarkdownToJSX.State,
  opts: ParseOptions
): ScanResult {
  if (
    s.charCodeAt(p) !== $.CHAR_TILDE ||
    p + 1 >= e ||
    s.charCodeAt(p + 1) !== $.CHAR_TILDE
  ) {
    return null // ~~
  }

  // Find closing ~~, skipping over code spans
  let i = p + 2
  while (i + 1 < e) {
    const c = s.charCodeAt(i)
    // Skip code spans - they take precedence
    if (c === $.CHAR_BACKTICK) {
      const afterCode = skipCodeSpan(s, i, e)
      if (afterCode > i) {
        i = afterCode
        continue
      }
    }
    if (c === $.CHAR_TILDE && s.charCodeAt(i + 1) === $.CHAR_TILDE) {
      const content = s.slice(p + 2, i)
      const children = parseInline(content, 0, content.length, state, opts)
      return {
        node: {
          type: RuleType.textFormatted,
          tag: 'del',
          children,
        } as MarkdownToJSX.FormattedTextNode,
        end: i + 2,
      }
    }
    if (c === $.CHAR_BACKSLASH && i + 1 < e) {
      i++ // escape
    }
    i++
  }

  return null
}

/** Scan marked text ==text== */
function scanMarked(
  s: string,
  p: number,
  e: number,
  state: MarkdownToJSX.State,
  opts: ParseOptions
): ScanResult {
  if (
    s.charCodeAt(p) !== $.CHAR_EQ ||
    p + 1 >= e ||
    s.charCodeAt(p + 1) !== $.CHAR_EQ
  ) {
    return null // ==
  }

  // Find closing ==, skipping over code spans
  let i = p + 2
  while (i + 1 < e) {
    const c = s.charCodeAt(i)
    // Skip code spans - they take precedence
    if (c === $.CHAR_BACKTICK) {
      const afterCode = skipCodeSpan(s, i, e)
      if (afterCode > i) {
        i = afterCode
        continue
      }
    }
    if (c === $.CHAR_EQ && s.charCodeAt(i + 1) === $.CHAR_EQ) {
      // Require non-empty content between == delimiters
      if (i > p + 2) {
        const content = s.slice(p + 2, i)
        const children = parseInline(content, 0, content.length, state, opts)
        return {
          node: {
            type: RuleType.textFormatted,
            tag: 'mark',
            children,
          } as MarkdownToJSX.FormattedTextNode,
          end: i + 2,
        }
      }
    }
    if (c === $.CHAR_BACKSLASH && i + 1 < e) {
      i++ // escape
    }
    i++
  }

  return null
}

/** Check if a character (code or string) is Unicode/ASCII punctuation */
function isUPunct(code: number, s: string, pos: number): boolean {
  if (code < $.CHAR_ASCII_BOUNDARY) {
    return Boolean(cc(code) & C_PUNCT)
  }
  return UNICODE_PUNCT_R.test(s[pos])
}

/** Check if a character code is Unicode whitespace */
function isUws(code: number, s: string, pos: number): boolean {
  if (code < $.CHAR_ASCII_BOUNDARY) {
    return Boolean(cc(code) & C_WS)
  }
  return UNICODE_WHITESPACE_R.test(s[pos])
}

/** Delimiter entry for emphasis processing */
interface DelimEntry {
  idx: number // index in nodes array
  ch: number // char code (* or _ or ~ or =)
  len: number // original delimiter run length
  canOpen: boolean
  canClose: boolean
  active: boolean
}

/** Collect delimiter run info without consuming - returns null if not a valid delimiter */
function collectDelimiter(
  s: string,
  p: number,
  e: number
): { len: number; canOpen: boolean; canClose: boolean } | null {
  var ch = s.charCodeAt(p)
  if (ch !== $.CHAR_ASTERISK && ch !== $.CHAR_UNDERSCORE) {
    return null
  }

  var len = countChar(s, p, e, ch)
  if (len === 0) {
    return null
  }

  var beforeCode = p > 0 ? s.charCodeAt(p - 1) : 32
  var afterCode = p + len < e ? s.charCodeAt(p + len) : 32

  var beforeWs = isUws(beforeCode, s, p - 1)
  var afterWs = isUws(afterCode, s, p + len)
  var beforePunct = p > 0 ? isUPunct(beforeCode, s, p - 1) : false
  var afterPunct = p + len < e ? isUPunct(afterCode, s, p + len) : false

  // CommonMark flanking rules
  var leftFlanking = !afterWs && (!afterPunct || beforeWs || beforePunct)
  var rightFlanking = !beforeWs && (!beforePunct || afterWs || afterPunct)

  var canOpen: boolean
  var canClose: boolean
  if (ch === $.CHAR_ASTERISK) {
    canOpen = leftFlanking
    canClose = rightFlanking
  } else {
    // Underscore: stricter rules
    canOpen = leftFlanking && (!rightFlanking || beforePunct)
    canClose = rightFlanking && (!leftFlanking || afterPunct)
  }

  return { len, canOpen, canClose }
}

/**
 * Transient doubly-linked node used only inside processEmphasis. Wrapping the
 * inline sequence in a list (rather than mutating the flat array) keeps node
 * removal/insertion O(1) and removes the need to re-index the delimiter stack
 * after every match, which is what made the old array-splice design O(n^2) on
 * emphasis-heavy input.
 */
interface LNode {
  node: MarkdownToJSX.ASTNode
  prev: LNode | null
  next: LNode | null
}

/** Process emphasis delimiters using CommonMark algorithm */
function processEmphasis(
  nodes: MarkdownToJSX.ASTNode[],
  delims: DelimEntry[],
  held: number[] | null,
  _state: MarkdownToJSX.State,
  _opts: ParseOptions
): void {
  if (delims.length === 0) {
    return
  }

  // Build a doubly-linked list over the inline sequence. delimLN maps each
  // delimiter-stack position to the list node holding its delimiter text, so
  // splicing content out of the list never invalidates a delimiter reference.
  var listLen = nodes.length
  var lnodes: LNode[] = new Array(listLen)
  var head: LNode | null = null
  var prevLn: LNode | null = null
  for (var li = 0; li < listLen; li++) {
    var ln: LNode = { node: nodes[li], prev: prevLn, next: null }
    if (prevLn) {
      prevLn.next = ln
    } else {
      head = ln
    }
    lnodes[li] = ln
    prevLn = ln
  }
  var delimLn: LNode[] = new Array(delims.length)
  for (var lj = 0; lj < delims.length; lj++) {
    delimLn[lj] = lnodes[delims[lj].idx]
  }

  // openers_bottom indexed by: type(0=*,1=_) * 6 + (closerLen%3) * 2 + (canOpen?1:0)
  var openersBottom: number[] = []
  for (var oi = 0; oi < 12; oi++) {
    openersBottom[oi] = -1
  }

  // Process from left to right looking for closers
  var ci = 0
  while (ci < delims.length) {
    var closer = delims[ci]
    if (!(closer.active && closer.canClose)) {
      ci++
      continue
    }

    var typeCode = closer.ch === $.CHAR_ASTERISK ? 0 : 1
    var obKey = typeCode * 6 + (closer.len % 3) * 2 + (closer.canOpen ? 1 : 0)
    var bottomIdx =
      openersBottom[obKey] === undefined ? -1 : openersBottom[obKey]

    // Search backwards for matching opener
    var openerIdx = -1
    for (var oi2 = ci - 1; oi2 > bottomIdx; oi2--) {
      var candidate = delims[oi2]
      if (
        !candidate.active ||
        candidate.ch !== closer.ch ||
        !candidate.canOpen
      ) {
        continue
      }

      // "Sum of lengths" rule: if either can both open and close,
      // sum of lengths must not be multiple of 3 unless both are multiples of 3
      if (
        (closer.canOpen || candidate.canClose) &&
        (candidate.len + closer.len) % 3 === 0 &&
        candidate.len % 3 !== 0
      ) {
        continue
      }

      openerIdx = oi2
      break
    }

    if (openerIdx < 0) {
      // No opener found - update openers_bottom
      openersBottom[obKey] = ci - 1
      if (!closer.canOpen) {
        closer.active = false
      }
      ci++
      continue
    }

    var opener = delims[openerIdx]
    var isStrong = opener.len >= 2 && closer.len >= 2
    var useLen = isStrong ? 2 : 1

    // Update delimiter lengths
    opener.len -= useLen
    closer.len -= useLen

    // Update text nodes for opener/closer
    var openLn = delimLn[openerIdx]
    var closeLn = delimLn[ci]
    var openerNode = openLn.node as MarkdownToJSX.TextNode
    var closerNode = closeLn.node as MarkdownToJSX.TextNode
    openerNode.text = openerNode.text.slice(0, openerNode.text.length - useLen)
    closerNode.text = closerNode.text.slice(useLen)

    // Collect content nodes between opener and closer. Each node is moved into
    // exactly one emphasis child array over the whole run, so the total work
    // across all (including nested) matches is O(n).
    var contentNodes: MarkdownToJSX.ASTNode[] = []
    var walk = openLn.next
    while (walk && walk !== closeLn) {
      contentNodes.push(walk.node)
      walk = walk.next
    }

    var emphNode: MarkdownToJSX.FormattedTextNode = {
      type: RuleType.textFormatted,
      tag: isStrong ? 'strong' : 'em',
      children: contentNodes,
    }

    // Splice the emphasis node in place of the collected range (O(1)).
    var emphLn: LNode = { node: emphNode, prev: openLn, next: closeLn }
    openLn.next = emphLn
    closeLn.prev = emphLn

    // Deactivate delimiters between opener and closer
    for (var di2 = openerIdx + 1; di2 < ci; di2++) {
      delims[di2].active = false
    }

    // If opener is empty, deactivate and unlink its (now empty) text node
    if (opener.len === 0) {
      opener.active = false
      if (openerNode.text === '') {
        var op = openLn.prev
        emphLn.prev = op
        if (op) {
          op.next = emphLn
        } else {
          head = emphLn
        }
      }
    }

    // If closer is empty, deactivate and unlink its text node
    if (closer.len === 0) {
      closer.active = false
      if (closerNode.text === '') {
        var cn = closeLn.next
        emphLn.next = cn
        if (cn) {
          cn.prev = emphLn
        }
      }
    } else {
      // Closer still has delimiters - don't advance, try matching again
      continue
    }
    ci++
  }

  // A held run still active with unmatched length is an opener whose closer
  // has not streamed in yet. Its text node holds exactly the unmatched
  // markers, so emptying it removes them and the flatten below drops it.
  if (held) {
    for (var hk = 0; hk < held.length; hk++) {
      var hd = delims[held[hk]]
      if (hd.active && hd.len > 0) {
        ;(delimLn[held[hk]].node as MarkdownToJSX.TextNode).text = ''
      }
    }
  }

  // Flatten the list back into the caller's array, merging adjacent text nodes
  // and dropping empties in the same pass.
  var wi = 0
  var cur = head
  while (cur) {
    var n = cur.node
    if (n.type === RuleType.text) {
      var tn = n as MarkdownToJSX.TextNode
      if (tn.text === '') {
        cur = cur.next
        continue
      }
      if (wi > 0 && nodes[wi - 1].type === RuleType.text) {
        ;(nodes[wi - 1] as MarkdownToJSX.TextNode).text += tn.text
        cur = cur.next
        continue
      }
    }
    nodes[wi++] = n
    cur = cur.next
  }
  nodes.length = wi
}

/**
 * Accept or reject a decoded markdown destination.
 * Stores the original decoded target when the sanitizer accepts it.
 * Rewritten sanitizer returns are discarded here; renderers re-apply the
 * sanitizer at emit when they want transforms. Rejection is `null` for both
 * links and images so compilers omit href/src and markdown re-emits empty
 * destinations (`[text]()` / `![alt]()`).
 */
function gateDestination(
  decoded: string,
  sanitizerFn: (url: string, tag: string, attribute: string) => string | null,
  tag: string,
  attribute: string
): string | null {
  return sanitizerFn(decoded, tag, attribute) === null ? null : decoded
}

/**
 * Scan memos for the inline scanners, scoped to one parseInline call.
 *
 * Every scanner reachable from the inline dispatch runs once per candidate
 * position and walks forward to a terminator that may be far away. With
 * nothing kept, the walk from candidate k+1 repeats nearly all of the walk
 * from candidate k, which is quadratic on adversarial runs of one character
 * (issues #874, #893).
 *
 * Two memo shapes cover every scanner so far:
 *
 * - A watermark, where failure is monotone: a scan that fails by running off
 *   the end means every later start searches a subset of the same range and
 *   fails too, so one position per scanner is enough.
 * - A per-position table, for link-text bracket matching, where failure is
 *   NOT monotone: in `[[foo](/url)` the outer opener never closes while the
 *   inner one does, so the openers need individual answers.
 *
 * These live in module scratch rather than on State because they are scoped
 * to a single parseInline call, which saves and restores them around
 * recursion. Assigning them on State instead would transition its hidden
 * class part-way through a parse.
 */
/**
 * Each watermark is a position paired with the parseInline invocation that
 * recorded it. Scoping by generation rather than clearing on entry keeps the
 * per-call cost at one increment, and plain bindings beat a typed array here
 * because the reads sit in scanners that run once per candidate character.
 */
var _urlFailFrom = 0
var _urlFailGen = 0
var _linkNoCloseFrom = 0
var _linkNoCloseGen = 0

/** Invocation counter for parseInline; 0 is never a live generation. */
var _scanGeneration = 0
/** Generation of the parseInline call currently executing. */
var _scanGen = 0

/**
 * Start a new memo generation. Retires every entry on wrap: a wrapped counter
 * would let an entry recorded against a different string read as live, and a
 * server parsing continuously reaches 2^31 calls in hours, not years.
 */
function nextScanGeneration(): number {
  if (_scanGeneration === 0x7f_ff_ff_ff) {
    _urlFailGen = 0
    _linkNoCloseGen = 0
    _linkTextMatchGen = 0
    _scanGeneration = 0
  }
  return ++_scanGeneration
}

/**
 * Link-text bracket matches for the current parseInline call, indexed by `[`
 * position: 0 = unknown, -1 = no match in range, otherwise the offset just
 * past the matching `]`. Allocated only once a single walk proves long enough
 * to be worth remembering.
 */
var _linkTextMatch: Int32Array | null = null
/** Generation `_linkTextMatch` belongs to; a mismatch means it is stale. */
var _linkTextMatchGen = 0

/**
 * Reusable stack of `[` positions for the bracket matcher. The matcher only
 * calls skipCodeSpan/scanAutolink/skipInlineHtmlElement, none of which
 * re-enter scanLink, so one module-level buffer is safe and keeps the walk
 * allocation-free.
 */
const _linkBracketStack: number[] = []

/**
 * Characters a single bracket walk must cover before it starts recording
 * matches. Walks shorter than this are cheaper than the table they populate.
 */
const LINK_TEXT_MEMO_MIN_SPAN = 256

/** Scan link [text](url) or ![alt](url) or [text][ref] or [text] */
function scanLink(
  s: string,
  p: number,
  e: number,
  state: MarkdownToJSX.State,
  opts: ParseOptions
): ScanResult {
  const isImage = s.charCodeAt(p) === $.CHAR_EXCLAMATION // !
  const start = isImage ? p + 1 : p

  if (s.charCodeAt(start) !== $.CHAR_BRACKET_OPEN) {
    return null // [
  }

  // A walk that found no `]` at all in range means no later opener finds one
  // either, since every later opener searches a subset of this range.
  if (_linkNoCloseGen === _scanGen && start >= _linkNoCloseFrom) {
    return null
  }

  var memo = _linkTextMatchGen === _scanGen ? _linkTextMatch : null
  var cached = memo === null ? 0 : memo[start]
  if (cached < 0) {
    return null // this opener is known to have no matching ] in range
  }

  // A remembered match ends just past its `]`, exactly where the walk below
  // would have stopped.
  var i = cached
  if (cached === 0) {
    // Fast rejection: if no ] in range, no valid link possible
    var closeBracket = s.indexOf(']', start + 1)
    if (closeBracket < 0 || closeBracket >= e) {
      _linkNoCloseFrom = start
      _linkNoCloseGen = _scanGen
      return null
    }

    // Find closing ] - skip code spans, HTML tags, and autolinks
    // Per CommonMark spec, we match brackets but don't nest them for link detection
    //
    // The walk's trajectory depends only on (s, position, e): skipCodeSpan,
    // scanAutolink, skipInlineHtmlElement and the backslash rule all key off
    // position alone. So each `[` this walk steps over resolves to exactly the
    // `]` a walk started at that `[` would find, and recording the pairings
    // costs one stack push per opener instead of a fresh walk per opener.
    i = start + 1
    var sp = 0
    _linkBracketStack[sp++] = start
    // Hoisted out of the walk: whether this walk can reach the span that earns
    // a table is decided by the range, not rechecked every character.
    var memoWorthwhile = e - start >= LINK_TEXT_MEMO_MIN_SPAN
    while (i < e && sp > 0) {
      var c = s.charCodeAt(i)
      if (c === $.CHAR_BACKSLASH && i + 1 < e) {
        i += 2
        continue
      }
      // Code spans take precedence over link brackets
      if (c === $.CHAR_BACKTICK) {
        var after = skipCodeSpan(s, i, e)
        if (after > i) {
          i = after
          continue
        }
      }
      // HTML tags take precedence
      if (c === $.CHAR_LT) {
        // Check for autolink first
        var autoResult = scanAutolink(s, i, e)
        if (autoResult) {
          i = autoResult.end
          continue
        }
        var afterHtml = skipInlineHtmlElement(s, i, e)
        if (afterHtml > i) {
          _tagSkipBudget -= afterHtml - i
          i = afterHtml
          continue
        }
      }
      if (c === $.CHAR_BRACKET_OPEN) {
        _linkBracketStack[sp++] = i
      } else if (c === $.CHAR_BRACKET_CLOSE) {
        var opener = _linkBracketStack[--sp]
        if (
          memo === null &&
          memoWorthwhile &&
          i - start >= LINK_TEXT_MEMO_MIN_SPAN
        ) {
          memo = _linkTextMatch = new Int32Array(e)
          _linkTextMatchGen = _scanGen
        }
        if (memo !== null) {
          memo[opener] = i + 1
        }
      }
      i++
    }
    if (sp > 0) {
      // Reached e with openers still on the stack: none of them can close.
      if (
        memo === null &&
        memoWorthwhile &&
        i - start >= LINK_TEXT_MEMO_MIN_SPAN
      ) {
        memo = _linkTextMatch = new Int32Array(e)
        _linkTextMatchGen = _scanGen
      }
      if (memo !== null) {
        while (sp > 0) {
          memo[_linkBracketStack[--sp]] = -1
        }
      }
      return null
    }
  }

  var textEnd = i - 1
  var text = s.slice(start + 1, textEnd)

  // Check what follows the ]
  var nextChar = i < e ? s.charCodeAt(i) : 0

  // Inline link: [text](url)
  var inlineLinkFailed = false
  if (nextChar === $.CHAR_PAREN_OPEN) {
    // (
    var inlineOk = true
    i++

    // Skip whitespace
    while (
      i < e &&
      (s.charCodeAt(i) === $.CHAR_SPACE || s.charCodeAt(i) === $.CHAR_NEWLINE)
    ) {
      i++
    }

    // Parse URL (can be in angle brackets or bare)
    var url = ''
    var urlEnd = i
    if (i < e && s.charCodeAt(i) === $.CHAR_LT) {
      // <url>
      i++
      urlEnd = i
      while (urlEnd < e && s.charCodeAt(urlEnd) !== $.CHAR_GT) {
        if (s.charCodeAt(urlEnd) === $.CHAR_BACKSLASH && urlEnd + 1 < e) {
          urlEnd += 2
          continue
        }
        if (s.charCodeAt(urlEnd) === $.CHAR_NEWLINE) {
          inlineOk = false
          break
        } // no newlines in angle URLs
        urlEnd++
      }
      if (inlineOk && (urlEnd >= e || s.charCodeAt(urlEnd) !== $.CHAR_GT)) {
        inlineOk = false
      }
      if (inlineOk) {
        url = s.slice(i, urlEnd)
        urlEnd++ // skip >
      }
    } else if (inlineOk) {
      // Bare URL - count parens. If a prior scan from <= i walked to
      // end-of-input without examining any unescaped ')' (escaped `\)` is
      // skipped by the backslash branch above), every later start sees the
      // same `)`-free suffix and also fails — short-circuit (issue #874).
      // Caching on parenDepth alone would be unsound: a ')' seen at depth>0
      // from here may sit at depth 0 from a later start (e.g. `[](([](a)`).
      // Scoped per parseInline call so the source string can't change
      // underneath us.
      var urlFailFrom = _urlFailGen === _scanGen ? _urlFailFrom : -1
      if (urlFailFrom >= 0 && i >= urlFailFrom) {
        inlineOk = false
      } else {
        var parenDepth = 0
        var sawUnescapedCloseParen = false
        while (urlEnd < e) {
          var c2 = s.charCodeAt(urlEnd)
          if (c2 === $.CHAR_BACKSLASH && urlEnd + 1 < e) {
            urlEnd += 2
            continue
          }
          if (c2 === $.CHAR_PAREN_OPEN) {
            parenDepth++
          } else if (c2 === $.CHAR_PAREN_CLOSE) {
            sawUnescapedCloseParen = true
            if (parenDepth === 0) {
              break
            }
            parenDepth--
          } else if (c2 === $.CHAR_SPACE || c2 === $.CHAR_NEWLINE) {
            break
          }
          urlEnd++
        }
        if (
          urlEnd >= e &&
          !sawUnescapedCloseParen &&
          (urlFailFrom < 0 || i < urlFailFrom)
        ) {
          _urlFailFrom = i
          _urlFailGen = _scanGen
        }
        url = s.slice(i, urlEnd)
      }
    }

    if (inlineOk) {
      i = urlEnd
      // Skip whitespace
      while (
        i < e &&
        (s.charCodeAt(i) === $.CHAR_SPACE || s.charCodeAt(i) === $.CHAR_NEWLINE)
      ) {
        i++
      }

      // Optional title
      var title: string | undefined
      if (i < e) {
        var tc = s.charCodeAt(i)
        if (
          tc === $.CHAR_DOUBLE_QUOTE ||
          tc === $.CHAR_SINGLE_QUOTE ||
          tc === $.CHAR_PAREN_OPEN
        ) {
          // " ' (
          var closeChar = tc === $.CHAR_PAREN_OPEN ? 41 : tc
          i++
          var titleStart = i
          while (i < e && s.charCodeAt(i) !== closeChar) {
            if (s.charCodeAt(i) === $.CHAR_BACKSLASH && i + 1 < e) {
              i++
            }
            i++
          }
          if (i >= e) {
            inlineOk = false
          } else {
            title = s.slice(titleStart, i)
            i++ // skip close quote
          }
        }
      }

      if (inlineOk) {
        // Skip whitespace and find closing )
        while (
          i < e &&
          (s.charCodeAt(i) === $.CHAR_SPACE ||
            s.charCodeAt(i) === $.CHAR_NEWLINE)
        ) {
          i++
        }
        if (i >= e || s.charCodeAt(i) !== $.CHAR_PAREN_CLOSE) {
          inlineOk = false
        }
      }
    }

    if (inlineOk) {
      i++

      // Unescape backslashes, then decode entities in the destination (CommonMark)
      // before sanitize so entity-obfuscated javascript: schemes are rejected.
      url = util.decodeEntityReferences(unescapeString(url))
      if (title !== undefined) {
        title = util.decodeEntityReferences(unescapeString(title))
      }

      if (isImage) {
        // Parse inline content and flatten to plain text for alt attribute
        var altNodes = parseInline(text, 0, text.length, state, opts)
        var altText = extractText(altNodes)
        return {
          node: {
            type: RuleType.image,
            target: gateDestination(
              url,
              opts?.sanitizer || util.sanitizer,
              'img',
              'src'
            ),
            alt: altText,
            title,
          } as MarkdownToJSX.ImageNode,
          end: i,
        }
      }
      var savedAnchor = state.inAnchor
      state.inAnchor = true
      var children = savedAnchor
        ? [{ type: RuleType.text, text } as MarkdownToJSX.TextNode]
        : parseInline(text, 0, text.length, state, opts)
      state.inAnchor = savedAnchor
      // Per CommonMark, links cannot contain other links
      // If children contain a link, the outer link is invalid
      if (!state.inAnchor && containsLink(children)) {
        return null
      }
      return {
        node: {
          type: RuleType.link,
          target: gateDestination(
            url,
            opts?.sanitizer || util.sanitizer,
            'a',
            'href'
          ),
          title,
          children,
        } as MarkdownToJSX.LinkNode,
        end: i,
      }
    }
    // Inline link failed - fall through to try shortcut reference
    i = textEnd + 1 // reset i to after ]
    inlineLinkFailed = true
  }

  // Reference link: [text][ref] or [text][] or [text]
  var label = ''
  var refEnd = i

  if (!inlineLinkFailed && nextChar === $.CHAR_BRACKET_OPEN) {
    // [
    // Full reference [text][ref] or collapsed [text][]
    var refStart = i + 1
    refEnd = refStart
    var hasNestedBracket = false
    while (refEnd < e && s.charCodeAt(refEnd) !== $.CHAR_BRACKET_CLOSE) {
      if (s.charCodeAt(refEnd) === $.CHAR_BACKSLASH && refEnd + 1 < e) {
        refEnd += 2
        continue
      }
      if (s.charCodeAt(refEnd) === $.CHAR_BRACKET_OPEN) {
        hasNestedBracket = true
        break
      }
      refEnd++
    }
    if (hasNestedBracket || refEnd >= e) {
      return null
    }
    var ref = s.slice(refStart, refEnd)
    if (ref.trim()) {
      // Full reference: [text][ref]
      label = normalizeLabel(ref)
    } else {
      // Collapsed reference: [text][]
      // Per CommonMark, labels cannot contain unescaped brackets
      if (hasUnescapedBracket(text)) {
        return null
      }
      label = normalizeLabel(text)
    }
    refEnd += 1
  } else {
    // Shortcut reference: [text]
    // Per CommonMark, labels cannot contain unescaped brackets
    if (hasUnescapedBracket(text)) {
      return null
    }
    label = normalizeLabel(text)
  }

  // Look up reference. A `^` label is a footnote's, whose text is not a destination.
  var refData = state.refs?.[label]
  if (!refData || label.charCodeAt(0) === $.CHAR_CARET) {
    return null
  }

  // Refs store the decoded destination; gate at use so entity-obfuscated
  // (and literal) dangerous schemes never reach a renderer href/src.
  if (isImage) {
    return {
      node: {
        type: RuleType.image,
        target: gateDestination(
          refData.target,
          opts?.sanitizer || util.sanitizer,
          'img',
          'src'
        ),
        alt: extractText(parseInline(text, 0, text.length, state, opts)),
        title: refData.title,
      } as MarkdownToJSX.ImageNode,
      end: refEnd,
    }
  }
  var savedAnchor2 = state.inAnchor
  state.inAnchor = true
  var children = savedAnchor2
    ? [{ type: RuleType.text, text } as MarkdownToJSX.TextNode]
    : parseInline(text, 0, text.length, state, opts)
  state.inAnchor = savedAnchor2
  // Per CommonMark, links cannot contain other links
  if (!state.inAnchor && containsLink(children)) {
    return null
  }
  return {
    node: {
      type: RuleType.link,
      target: gateDestination(
        refData.target,
        opts?.sanitizer || util.sanitizer,
        'a',
        'href'
      ),
      title: refData.title,
      children,
    } as MarkdownToJSX.LinkNode,
    end: refEnd,
  }
}

/** Scan autolink <url> or <email> */
function scanAutolink(s: string, p: number, e: number): ScanResult {
  if (s.charCodeAt(p) !== $.CHAR_LT) {
    return null
  }

  var i = p + 1
  // Find closing > - autolinks cannot contain spaces or newlines
  while (i < e) {
    var cc = s.charCodeAt(i)
    if (cc === $.CHAR_GT) {
      break
    }
    // Per CommonMark: autolinks cannot contain spaces, newlines, or < chars
    if (
      cc === $.CHAR_SPACE ||
      cc === $.CHAR_NEWLINE ||
      cc === $.CHAR_CR ||
      cc === $.CHAR_LT
    ) {
      return null
    }
    i++
  }
  if (i >= e || s.charCodeAt(i) !== $.CHAR_GT) {
    return null
  }

  var content = s.slice(p + 1, i)

  // Check for URL autolink: scheme must be 2-32 chars [a-zA-Z][a-zA-Z0-9+.-]{1,31}
  // followed by : and the rest of the URI (no spaces already guaranteed above)
  var schemeMatch = content.match(
    /^([a-zA-Z][a-zA-Z0-9+.-]{1,31}):([^\x00-\x20]*)$/
  )
  if (schemeMatch) {
    return {
      node: {
        type: RuleType.link,
        target: content,
        title: undefined,
        children: [
          { type: RuleType.text, text: content } as MarkdownToJSX.TextNode,
        ],
      } as MarkdownToJSX.LinkNode,
      end: i + 1,
    }
  }

  // Check for email autolink per CommonMark spec
  if (
    content.indexOf('@') !== -1 &&
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(
      content
    )
  ) {
    return {
      node: {
        type: RuleType.link,
        target: `mailto:${content}`,
        title: undefined,
        children: [
          { type: RuleType.text, text: content } as MarkdownToJSX.TextNode,
        ],
      } as MarkdownToJSX.LinkNode,
      end: i + 1,
    }
  }

  return null
}

/** Scan footnote reference [^id] */
function scanFootnoteRef(
  s: string,
  p: number,
  e: number,
  state: MarkdownToJSX.State,
  opts: ParseOptions
): ScanResult {
  // Must start with [^
  if (
    s.charCodeAt(p) !== $.CHAR_BRACKET_OPEN ||
    p + 1 >= e ||
    s.charCodeAt(p + 1) !== $.CHAR_CARET
  ) {
    return null
  }

  let i = p + 2
  // A label holds no `[`: stopping at the next opener bounds a failed scan, so
  // a run of `[^` before one `]` stays linear even though it consumes nothing.
  while (
    i < e &&
    s.charCodeAt(i) !== $.CHAR_BRACKET_CLOSE &&
    s.charCodeAt(i) !== $.CHAR_BRACKET_OPEN &&
    s.charCodeAt(i) !== $.CHAR_NEWLINE
  ) {
    i++
  }
  if (i >= e || s.charCodeAt(i) !== $.CHAR_BRACKET_CLOSE) {
    return null
  }

  const id = s.slice(p + 2, i)
  if (!id) {
    return null
  }

  // With no definition this is text, as GitHub reads it; the key is the one
  // parseFootnoteDefinition stores. A streamed document may still receive the
  // definition, so a reference stays one there.
  if (!(opts.optimizeForStreaming || state.refs?.[`^${id}`.toLowerCase()])) {
    return null
  }

  return {
    node: {
      type: RuleType.footnoteReference,
      target: `#${util.slugify(id)}`,
      text: id,
    } as MarkdownToJSX.FootnoteReferenceNode,
    end: i + 1,
  }
}

/** Scan bare URL (https://..., http://..., or www.) */
function scanBareUrl(
  s: string,
  p: number,
  e: number,
  opts: ParseOptions
): ScanResult {
  if (opts.disableBareUrls) {
    return null
  }

  // Check for http://, https://, ftp://, or www. via charCode to avoid slice allocations
  var prefix = ''
  var isWww = false
  var c0 = s.charCodeAt(p)
  if (c0 === $.CHAR_H || c0 === 72) {
    // h/H
    if (
      p + 8 <= e &&
      s.charCodeAt(p + 1) === $.CHAR_t &&
      s.charCodeAt(p + 2) === $.CHAR_t &&
      s.charCodeAt(p + 3) === $.CHAR_p
    ) {
      // ttp
      if (
        s.charCodeAt(p + 4) === $.CHAR_s &&
        s.charCodeAt(p + 5) === $.CHAR_COLON &&
        s.charCodeAt(p + 6) === $.CHAR_SLASH &&
        s.charCodeAt(p + 7) === $.CHAR_SLASH
      ) {
        prefix = 'https://'
      } else if (
        s.charCodeAt(p + 4) === $.CHAR_COLON &&
        s.charCodeAt(p + 5) === $.CHAR_SLASH &&
        s.charCodeAt(p + 6) === $.CHAR_SLASH
      ) {
        prefix = 'http://'
      }
    }
  } else if (c0 === $.CHAR_f || c0 === 70) {
    // f/F
    if (
      p + 6 <= e &&
      s.charCodeAt(p + 1) === $.CHAR_t &&
      s.charCodeAt(p + 2) === $.CHAR_p &&
      s.charCodeAt(p + 3) === $.CHAR_COLON &&
      s.charCodeAt(p + 4) === $.CHAR_SLASH &&
      s.charCodeAt(p + 5) === $.CHAR_SLASH
    ) {
      prefix = 'ftp://'
    }
  } else if (c0 === $.CHAR_W || c0 === 87) {
    // w/W
    if (
      p + 4 <= e &&
      s.charCodeAt(p + 1) === $.CHAR_W &&
      s.charCodeAt(p + 2) === $.CHAR_W &&
      s.charCodeAt(p + 3) === $.CHAR_PERIOD
    ) {
      prefix = 'www.'
      isWww = true
    }
  }
  if (!prefix) {
    return null
  }

  // Find end of URL (stop at whitespace or common punctuation at end)
  let i = p + prefix.length
  while (i < e) {
    const c = s.charCodeAt(i)
    // Stop at whitespace
    if (
      c === $.CHAR_SPACE ||
      c === $.CHAR_NEWLINE ||
      c === $.CHAR_TAB ||
      c === $.CHAR_CR
    ) {
      break
    }
    // Stop at certain characters that are unlikely to be part of URL
    if (c === $.CHAR_LT || c === $.CHAR_GT) {
      break // < >
    }
    i++
  }

  // Pre-count parens to avoid O(n²) slice+match in trimming loop
  var openParens = 0
  var closeParens = 0
  for (var pi = p; pi < i; pi++) {
    var pc = s.charCodeAt(pi)
    if (pc === $.CHAR_PAREN_OPEN) {
      openParens++
    } else if (pc === $.CHAR_PAREN_CLOSE) {
      closeParens++
    }
  }

  // Trim trailing punctuation that's not part of URL
  let end = i
  while (end > p + prefix.length) {
    const c = s.charCodeAt(end - 1)
    if (
      c === $.CHAR_PERIOD ||
      c === $.CHAR_COMMA ||
      c === $.CHAR_COLON || // . , :
      c === $.CHAR_EXCLAMATION ||
      c === $.CHAR_QUESTION ||
      c === $.CHAR_PAREN_CLOSE || // ! ? )
      c === $.CHAR_ASTERISK ||
      c === $.CHAR_UNDERSCORE ||
      c === $.CHAR_TILDE
    ) {
      // * _ ~ (emphasis/strikethrough delimiters)
      // But keep ) if there's a matching (
      if (c === $.CHAR_PAREN_CLOSE) {
        if (openParens >= closeParens) {
          break
        }
        closeParens--
      }
      end--
    } else if (c === $.CHAR_SEMICOLON) {
      // ; — check for entity reference &word;
      var ampPos = end - 2
      while (
        ampPos > p &&
        ((s.charCodeAt(ampPos) >= $.CHAR_A &&
          s.charCodeAt(ampPos) <= $.CHAR_Z) ||
          (s.charCodeAt(ampPos) >= $.CHAR_a &&
            s.charCodeAt(ampPos) <= $.CHAR_z) ||
          (s.charCodeAt(ampPos) >= $.CHAR_DIGIT_0 &&
            s.charCodeAt(ampPos) <= $.CHAR_DIGIT_9))
      ) {
        ampPos--
      }
      if (ampPos >= p && s.charCodeAt(ampPos) === $.CHAR_AMPERSAND) {
        // &
        end = ampPos // exclude &entity;
      } else {
        end-- // regular trailing ;
      }
    } else {
      break
    }
  }

  if (end <= p + prefix.length) {
    return null
  }

  // Validate domain using charCode scan on original string (avoid slice/split)
  // Domain runs from p+prefixLen to the first / or end
  var dStart = p + (isWww ? 4 : prefix.length)
  var dEnd = s.indexOf('/', dStart)
  if (dEnd < 0 || dEnd > end) {
    dEnd = end
  }
  // For www. links, need at least one dot in domain
  if (isWww && s.indexOf('.', dStart) === -1) {
    return null
  }
  // Check last two segments for underscores (GFM rule)
  // Find last two dot positions by scanning backwards
  var lastDotU = -1
  var prevDotU = -1
  for (var di = dEnd - 1; di >= dStart; di--) {
    if (s.charCodeAt(di) === $.CHAR_PERIOD) {
      if (lastDotU < 0) {
        lastDotU = di
      } else {
        prevDotU = di
        break
      }
    }
  }
  // segCheckStart = start of second-to-last segment (or domain start if <2 dots)
  var segCheckStart = prevDotU >= 0 ? prevDotU + 1 : dStart
  for (var di = segCheckStart; di < dEnd; di++) {
    if (s.charCodeAt(di) === $.CHAR_UNDERSCORE) {
      return null // underscore in last two segments
    }
  }

  var url = s.slice(p, end)
  // For www. links, prepend http:// for the target URL
  var target = isWww ? `http://${url}` : url

  return {
    node: {
      type: RuleType.link,
      target,
      title: undefined,
      children: [{ type: RuleType.text, text: url } as MarkdownToJSX.TextNode],
    } as MarkdownToJSX.LinkNode,
    end,
  }
}

/** Scan bare email autolink (GFM extension) */
function scanBareEmail(
  s: string,
  p: number,
  e: number,
  opts: ParseOptions
): ScanResult {
  if (opts.disableBareUrls) {
    return null
  }
  // Email local part: [a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+
  var i = p
  var localStart = i
  while (i < e) {
    var c = s.charCodeAt(i)
    if (
      (c >= $.CHAR_A && c <= $.CHAR_Z) ||
      (c >= $.CHAR_a && c <= $.CHAR_z) ||
      (c >= $.CHAR_DIGIT_0 && c <= $.CHAR_DIGIT_9) ||
      c === $.CHAR_PERIOD ||
      c === $.CHAR_EXCLAMATION ||
      c === $.CHAR_HASH ||
      c === 36 ||
      c === $.CHAR_PERCENT ||
      c === $.CHAR_AMPERSAND ||
      c === $.CHAR_SINGLE_QUOTE ||
      c === $.CHAR_ASTERISK ||
      c === $.CHAR_PLUS ||
      c === $.CHAR_SLASH ||
      c === $.CHAR_EQ ||
      c === $.CHAR_QUESTION ||
      c === $.CHAR_CARET ||
      c === $.CHAR_UNDERSCORE ||
      c === $.CHAR_BACKTICK ||
      c === $.CHAR_BRACE_OPEN ||
      c === $.CHAR_PIPE ||
      c === $.CHAR_BRACE_CLOSE ||
      c === $.CHAR_TILDE ||
      c === $.CHAR_DASH
    ) {
      i++
    } else {
      break
    }
  }
  if (i === localStart) {
    return null
  }
  if (i >= e || s.charCodeAt(i) !== $.CHAR_AT) {
    return null // @
  }
  i++ // skip @
  // Domain: alphanumeric, hyphens, underscores, separated by dots
  // Per GFM: last two segments can't have underscore, last char can't be - or _
  var domainStart = i
  var lastDot = -1
  var labelStart = i
  while (i < e) {
    var c = s.charCodeAt(i)
    if (
      (c >= $.CHAR_A && c <= $.CHAR_Z) ||
      (c >= $.CHAR_a && c <= $.CHAR_z) ||
      (c >= $.CHAR_DIGIT_0 && c <= $.CHAR_DIGIT_9)
    ) {
      i++
    } else if (
      (c === $.CHAR_DASH || c === $.CHAR_UNDERSCORE) &&
      i > domainStart
    ) {
      // hyphen or underscore (not at start)
      i++
    } else if (c === $.CHAR_PERIOD) {
      // dot
      if (i === domainStart) {
        break
      }
      var prev = s.charCodeAt(i - 1)
      if (prev === $.CHAR_DASH || prev === $.CHAR_UNDERSCORE) {
        break // hyphen/underscore before dot invalid
      }
      if (i - labelStart > 63) {
        break // DNS label max 63 chars (RFC 1035)
      }
      // Only consume dot if followed by alphanumeric (valid domain continuation)
      if (i + 1 < e) {
        var nextDc = s.charCodeAt(i + 1)
        if (
          (nextDc >= $.CHAR_A && nextDc <= $.CHAR_Z) ||
          (nextDc >= $.CHAR_a && nextDc <= $.CHAR_z) ||
          (nextDc >= $.CHAR_DIGIT_0 && nextDc <= $.CHAR_DIGIT_9)
        ) {
          lastDot = i
          labelStart = i + 1
          i++
        } else {
          break // trailing dot — don't consume
        }
      } else {
        break // dot at end — don't consume
      }
    } else {
      break
    }
  }
  if (i - labelStart > 63) {
    return null // final label exceeds DNS limit
  }
  if (lastDot < 0) {
    return null // need at least one dot
  }
  // Last char of domain must be alphanumeric (not hyphen, underscore, or dot)
  var lastDomainChar = s.charCodeAt(i - 1)
  if (
    !(
      (lastDomainChar >= $.CHAR_A && lastDomainChar <= $.CHAR_Z) ||
      (lastDomainChar >= $.CHAR_a && lastDomainChar <= $.CHAR_z) ||
      (lastDomainChar >= $.CHAR_DIGIT_0 && lastDomainChar <= $.CHAR_DIGIT_9)
    )
  ) {
    return null
  }
  if (i <= lastDot + 1) {
    return null // need content after last dot
  }
  // Check last two domain segments don't have underscores (charCode scan, no slice/split)
  // Walk from lastDot backwards to find second-to-last dot
  var prevDot = -1
  for (var di = lastDot - 1; di >= domainStart; di--) {
    if (s.charCodeAt(di) === $.CHAR_PERIOD) {
      prevDot = di
      break
    }
  }
  var segCheckStart = prevDot >= 0 ? prevDot + 1 : domainStart
  for (var di = segCheckStart; di < i; di++) {
    if (s.charCodeAt(di) === $.CHAR_UNDERSCORE) {
      return null // underscore in last two segments
    }
  }
  var email = s.slice(p, i)
  return {
    node: {
      type: RuleType.link,
      target: `mailto:${email}`,
      title: undefined,
      children: [
        { type: RuleType.text, text: email } as MarkdownToJSX.TextNode,
      ],
    } as MarkdownToJSX.LinkNode,
    end: i,
  }
}

/** Check if nodes contain a link (for no-nested-links rule) */
function containsLink(nodes: MarkdownToJSX.ASTNode[]): boolean {
  for (var i = 0; i < nodes.length; i++) {
    if (nodes[i].type === RuleType.link) {
      return true
    }
    if (
      'children' in nodes[i] &&
      Array.isArray((nodes[i] as AstNodeWithChildren).children) &&
      containsLink((nodes[i] as AstNodeWithChildren).children)
    ) {
      return true
    }
  }
  return false
}

/**
 * Flatten inline AST nodes to plain text for alt text and heading slugs.
 * When omitImages is true (heading ids), image alt is skipped so slugs match
 * GitHub / rehype-slug textContent; image-alt callers leave it false.
 */
function extractText(
  nodes: MarkdownToJSX.ASTNode[],
  omitImages?: boolean
): string {
  var result = ''
  for (var ni = 0; ni < nodes.length; ni++) {
    var n = nodes[ni]
    if (n.type === RuleType.text) {
      result += (n as MarkdownToJSX.TextNode).text
    } else if (n.type === RuleType.breakLine) {
      result += ' '
    } else if (n.type === RuleType.codeInline) {
      result += (n as MarkdownToJSX.CodeInlineNode).text
    } else if (n.type === RuleType.footnoteReference) {
      result += (n as MarkdownToJSX.FootnoteReferenceNode).text
    } else if (
      'children' in n &&
      Array.isArray((n as AstNodeWithChildren).children)
    ) {
      result += extractText((n as AstNodeWithChildren).children, omitImages)
    } else if (!omitImages && n.type === RuleType.image) {
      result += (n as MarkdownToJSX.ImageNode).alt || ''
    }
  }
  return result
}

/**
 * Assign unique heading ids from each heading's flattened inline text after
 * deferred inline parses have filled children. Walks nested list items and
 * HTML/JSX children so document order matches source order.
 */
function assignHeadingIds(
  nodes: MarkdownToJSX.ASTNode[],
  state: MarkdownToJSX.State,
  slugify: (input: string) => string
): void {
  for (var i = 0; i < nodes.length; i++) {
    var n = nodes[i]
    if (n.type === RuleType.heading) {
      var heading = n as MarkdownToJSX.HeadingNode
      heading.id = uniqueHeadingId(
        slugify(extractText(heading.children, true)),
        state
      )
    }
    if ('children' in n) {
      var children = (n as AstNodeWithChildren).children
      if (Array.isArray(children)) {
        assignHeadingIds(children, state, slugify)
      }
    }
    if (
      (n.type === RuleType.orderedList || n.type === RuleType.unorderedList) &&
      Array.isArray((n as MarkdownToJSX.OrderedListNode).items)
    ) {
      var items = (n as MarkdownToJSX.OrderedListNode).items
      for (var j = 0; j < items.length; j++) {
        assignHeadingIds(items[j], state, slugify)
      }
    }
  }
}

/** Create a text node */
function textNode(text: string): MarkdownToJSX.TextNode {
  // Entity decoding happens in parseInline's & dispatch (scanEntityRef), so
  // flushed segments can only contain literal ampersands; no rescan needed.
  return { type: RuleType.text, text } as MarkdownToJSX.TextNode
}

/**
 * Scan an HTML character reference at p (caller guarantees s[p] === '&').
 * Mirrors HTML_CHAR_CODE_R exactly: &name; / &#1-7 digits; / &#x1-6 hex;.
 * Returns the index just past the ';' or -1 if the shape doesn't match.
 */
function scanEntityRef(s: string, p: number, e: number): number {
  var i = p + 1
  if (i >= e) {
    return -1
  }
  if (s.charCodeAt(i) === $.CHAR_HASH) {
    i++
    var isHex =
      i < e && (s.charCodeAt(i) === $.CHAR_x || s.charCodeAt(i) === $.CHAR_X)
    if (isHex) {
      i++
    }
    var digStart = i
    var maxDigits = isHex ? 6 : 7
    while (i < e && i - digStart <= maxDigits) {
      var d = s.charCodeAt(i)
      var isDig =
        (d >= $.CHAR_DIGIT_0 && d <= $.CHAR_DIGIT_9) ||
        (isHex &&
          ((d >= $.CHAR_A && d <= $.CHAR_F) ||
            (d >= $.CHAR_a && d <= $.CHAR_f)))
      if (!isDig) {
        break
      }
      i++
    }
    if (i === digStart || i - digStart > maxDigits) {
      return -1
    }
    return i < e && s.charCodeAt(i) === $.CHAR_SEMICOLON ? i + 1 : -1
  }
  // Named reference: [a-zA-Z0-9]+ then ';' (longest real entity name is 31 chars)
  var nameStart = i
  while (i < e && i - nameStart < 48) {
    var n = s.charCodeAt(i)
    if (
      (n >= $.CHAR_A && n <= $.CHAR_Z) ||
      (n >= $.CHAR_a && n <= $.CHAR_z) ||
      (n >= $.CHAR_DIGIT_0 && n <= $.CHAR_DIGIT_9)
    ) {
      i++
      continue
    }
    break
  }
  if (i === nameStart) {
    return -1
  }
  return i < e && s.charCodeAt(i) === $.CHAR_SEMICOLON ? i + 1 : -1
}

/**
 * A closer as written, unless it holds another `<`: a browser reads `</a <svg x>`
 * as one closer and a markdown renderer as text and a live tag, so that one is
 * written bare.
 */
function rawCloser(s: string, start: number, end: number, tag: string): string {
  return s.lastIndexOf('<', end - 1) === start
    ? s.slice(start, end)
    : `</${tag}>`
}

/** A processing instruction, declaration, or CDATA section at [start, end): screened text in a comment node */
function rawMarkupComment(
  s: string,
  start: number,
  end: number
): NonNullable<ScanResult> {
  return {
    node: {
      type: RuleType.htmlComment,
      text: stripDangerousHtml(s.slice(start, end)),
      _endsWithGT: false,
      raw: true,
    } as MarkdownToJSX.HTMLCommentNode,
    end,
  }
}

/** The position from which each terminator has no occurrence left in the string of the current parseInline call, which resets and restores it; allocated on the first miss. */
var _noEndFrom: Record<string, number> | null = null

/** Index of the first `terminator` at or after `from`, or -1. A miss is remembered, so a run of unterminated openers searches once. */
function terminatorAt(s: string, terminator: string, from: number): number {
  var noEndFrom = _noEndFrom === null ? undefined : _noEndFrom[terminator]
  if (noEndFrom !== undefined && from >= noEndFrom) {
    return -1
  }

  var at = s.indexOf(terminator, from)
  if (at === -1) {
    if (_noEndFrom === null) {
      _noEndFrom = {}
    }
    _noEndFrom[terminator] = from
  }
  return at
}

/** Scan inline HTML element - CommonMark types 1-7 */
function scanInlineHtml(
  s: string,
  p: number,
  e: number,
  state: MarkdownToJSX.State,
  opts: ParseOptions
): ScanResult {
  if (s.charCodeAt(p) !== $.CHAR_LT) {
    return null
  }

  var i = p + 1
  if (i >= e) {
    return null
  }
  var ch = s.charCodeAt(i)

  // Type 2: HTML comment <!-- ... -->
  if (
    ch === $.CHAR_EXCLAMATION &&
    i + 1 < e &&
    s.charCodeAt(i + 1) === $.CHAR_DASH &&
    i + 2 < e &&
    s.charCodeAt(i + 2) === $.CHAR_DASH
  ) {
    var commentStart = i + 3
    // Special case: <!--> (empty comment)
    if (commentStart < e && s.charCodeAt(commentStart) === $.CHAR_GT) {
      return {
        node: {
          type: RuleType.htmlComment,
          text: '',
          _endsWithGT: true,
        } as MarkdownToJSX.HTMLCommentNode,
        end: commentStart + 1,
      }
    }
    // Special case: <!---> (comment with single dash)
    if (
      commentStart + 1 < e &&
      s.charCodeAt(commentStart) === $.CHAR_DASH &&
      s.charCodeAt(commentStart + 1) === $.CHAR_GT
    ) {
      return {
        node: {
          type: RuleType.htmlComment,
          text: '-',
          _endsWithGT: true,
        } as MarkdownToJSX.HTMLCommentNode,
        end: commentStart + 2,
      }
    }
    // Regular comment: scan for -->
    var endComment = terminatorAt(s, '-->', commentStart)
    if (endComment === -1) {
      return null
    }
    var commentSource = s.slice(p, endComment + 3)
    var screenedComment = stripDangerousHtml(commentSource)
    return {
      // A screen can remove the closing `-->` with the tag that swallowed
      // it, so a changed comment is stored whole rather than rewrapped
      node:
        screenedComment === commentSource
          ? ({
              type: RuleType.htmlComment,
              text: s.slice(p + 4, endComment),
              _endsWithGT: false,
            } as MarkdownToJSX.HTMLCommentNode)
          : ({
              type: RuleType.htmlComment,
              text: screenedComment,
              _endsWithGT: false,
              raw: true,
            } as MarkdownToJSX.HTMLCommentNode),
      end: endComment + 3,
    }
  }

  // Type 3: Processing instruction <?...?>
  if (ch === $.CHAR_QUESTION) {
    var endPi = terminatorAt(s, '?>', i + 1)
    return endPi === -1 ? null : rawMarkupComment(s, p, endPi + 2)
  }

  // Type 4/5: Declaration <!LETTER...> or CDATA <![CDATA[...]]>
  if (ch === $.CHAR_EXCLAMATION && i + 1 < e) {
    var nextCh = s.charCodeAt(i + 1)
    // CDATA: <![CDATA[...]]>
    if (nextCh === $.CHAR_BRACKET_OPEN && s.slice(i + 1, i + 8) === '[CDATA[') {
      var endCdata = terminatorAt(s, ']]>', i + 8)
      return endCdata === -1 ? null : rawMarkupComment(s, p, endCdata + 3)
    }
    // Declaration: <!LETTER ...>
    if (nextCh >= $.CHAR_A && nextCh <= $.CHAR_Z) {
      var endDecl = terminatorAt(s, '>', i + 2)
      return endDecl === -1 ? null : rawMarkupComment(s, p, endDecl + 1)
    }
  }

  // Type 6: Closing tag </tagname optional-whitespace>
  if (ch === $.CHAR_SLASH) {
    var j = i + 1
    if (j >= e) {
      return null
    }
    var c0 = s.charCodeAt(j)
    if (
      !(
        (c0 >= $.CHAR_A && c0 <= $.CHAR_Z) ||
        (c0 >= $.CHAR_a && c0 <= $.CHAR_z)
      )
    ) {
      return null
    }
    j++
    while (j < e) {
      var cc = s.charCodeAt(j)
      if (
        (cc >= $.CHAR_A && cc <= $.CHAR_Z) ||
        (cc >= $.CHAR_a && cc <= $.CHAR_z) ||
        (cc >= $.CHAR_DIGIT_0 && cc <= $.CHAR_DIGIT_9) ||
        cc === $.CHAR_DASH
      ) {
        j++
      } else {
        break
      }
    }
    // Skip optional whitespace
    while (
      j < e &&
      (s.charCodeAt(j) === $.CHAR_SPACE ||
        s.charCodeAt(j) === $.CHAR_TAB ||
        s.charCodeAt(j) === $.CHAR_NEWLINE)
    ) {
      j++
    }
    if (j < e && s.charCodeAt(j) === $.CHAR_GT) {
      var closeTagName = s.slice(i + 1, j).trim()
      return {
        node: {
          type: RuleType.htmlSelfClosing,
          tag: closeTagName,
          attrs: {},
          _rawClose: s.slice(p, j + 1),
          _isClosingTag: true,
        } as MarkdownToJSX.HTMLSelfClosingNode & { _isClosingTag: boolean },
        end: j + 1,
      }
    }
    return null
  }

  // Type 1/7: Open tag - must start with letter
  if (
    !((ch >= $.CHAR_A && ch <= $.CHAR_Z) || (ch >= $.CHAR_a && ch <= $.CHAR_z))
  ) {
    return null
  }

  // Try parsing as a structured HTML tag first (for tags with closing tags in scope)
  var tagResult = __parseHtmlTag(s, p)
  if (!tagResult) {
    return null
  }

  var tagName = tagResult.tag
  var tagNameLower = tagName.toLowerCase()
  var selfClosing = tagResult._selfClosing

  // Self-closing tag or void element - preserve raw text for HTML compiler
  if (selfClosing || util.isVoidElement(tagName)) {
    return {
      node: {
        type: RuleType.htmlSelfClosing,
        tag: tagName,
        attrs: processHtmlAttributes(tagResult.attrs, tagName, opts),
        _rawOpen: tagResult._sanitized
          ? reconstructOpenTag(tagResult)
          : s.slice(p, tagResult.end),
        _isClosingTag: false,
      } as MarkdownToJSX.HTMLSelfClosingNode,
      end: tagResult.end,
    }
  }

  // Verbatim tags (script, style, pre, textarea)
  var isVerbatim = TYPE1_TAGS.has(tagNameLower)

  // Find closing tag (within the inline scope)
  var closeEnd = findClosingTag(s, tagResult.end, tagName, e)
  if (closeEnd === -1) {
    // No closing tag found - pass through as raw HTML open tag (CommonMark spec)
    return {
      node: {
        type: RuleType.htmlSelfClosing,
        tag: tagName,
        attrs: processHtmlAttributes(tagResult.attrs, tagName, opts),
        _rawOpen: tagResult._sanitized
          ? reconstructOpenTag(tagResult)
          : s.slice(p, tagResult.end),
        _isClosingTag: false,
      } as MarkdownToJSX.HTMLSelfClosingNode,
      end: tagResult.end,
    }
  }

  // Find where closing tag starts
  var closeTagStart = lastIndexOfCi(s, `</${tagNameLower}`, closeEnd)
  var innerContent = s.slice(tagResult.end, closeTagStart)

  // Type 1 (verbatim) tags must match the block-path shape: _verbatim +
  // _rawBody/_rawClose, empty children. React's Type 1 branch needs a
  // single string child; a text-child shape becomes an array under
  // React.createElement and the content is dropped.
  if (isVerbatim) {
    var type1Body = stripDangerousHtml(innerContent)
    return {
      node: {
        type: RuleType.htmlBlock,
        tag: tagName,
        attrs: processHtmlAttributes(tagResult.attrs, tagName, opts),
        // Match the block Type 1 shape: leading whitespace belongs in _rawAttrs.
        _rawAttrs: tagResult._whitespaceBeforeAttrs + tagResult._rawAttrs,
        children: [],
        _rawBody: type1Body || undefined,
        _rawClose: rawCloser(s, closeTagStart, closeEnd, tagName),
        // A Type 1 block is never re-parsed
        _reparseSource: undefined,
        text: type1Body,
        _verbatim: true,
        _isClosingTag: false,
      } as MarkdownToJSX.HTMLNode & { _isClosingTag: boolean },
      end: closeEnd,
    }
  }

  var children: MarkdownToJSX.ASTNode[] = []
  var trimmed = innerContent.trim()
  if (innerContent) {
    var savedAnchorH = state.inAnchor
    var savedInlineH = state.inline
    var savedBreaksH = state._breaks
    if (tagNameLower === 'a') {
      state.inAnchor = true
    }
    // Inline HTML element children were never break-processed under the
    // pre-pass (it skipped over HTML spans); preserve that by clearing the flag.
    state._breaks = false
    var hasBlocks =
      trimmed.indexOf('\n\n') !== -1 ||
      (opts.enforceAtxHeadings === false
        ? INLINE_HTML_HEADING_RELAXED_R
        : INLINE_HTML_HEADING_R
      ).test(trimmed)
    if (hasBlocks) {
      state.inline = false
      // Trimmed: leading spaces would read as an indented code block.
      children = parseBlocks(trimmed, state, opts)
    } else {
      children = parseInline(innerContent, 0, innerContent.length, state, opts)
    }
    state.inAnchor = savedAnchorH
    state.inline = savedInlineH
    state._breaks = savedBreaksH
  }

  return {
    node: {
      type: RuleType.htmlBlock,
      tag: tagName,
      attrs: processHtmlAttributes(tagResult.attrs, tagName, opts),
      _rawAttrs: tagResult._rawAttrs,
      children,
      // Not verbatim, so never re-parsed
      _reparseSource: undefined,
      // The deprecated text field carries the raw inner source, so strip
      // dangerous attributes from it as every other raw-source path does;
      // the markdown compiler emits this field verbatim.
      text: stripDangerousHtml(innerContent),
      _verbatim: false,
      _isClosingTag: false,
    } as MarkdownToJSX.HTMLNode & { _isClosingTag: boolean },
    end: closeEnd,
  }
}

/**
 * Streaming: drop the markup of a link or image that has not finished
 * arriving. An unmatched `[` loses its bracket and keeps its text; `[text]`
 * at the end, `[text](url`, and `[text][ref` keep only `text`, which is then
 * scanned in turn since it can hold its own incomplete link (`[[a]](b` ->
 * `a`); an incomplete image is removed with its alt text, which is metadata
 * rather than content.
 *
 * Brackets are matched once with a stack, and the scan only moves forward
 * while the kept end shrinks, so the work is linear in `s`.
 */
function stripIncompleteLinks(s: string): string {
  if (s.indexOf('[') === -1) {
    return s
  }
  var n = s.length
  // Index of each opener's matching `]`; -1 unmatched, -2 bracket dropped
  var close = new Int32Array(n).fill(-1)
  var stack: number[] = []
  for (var i = 0; i < n; i++) {
    var c = s.charCodeAt(i)
    if (
      (c === $.CHAR_BRACKET_OPEN || c === $.CHAR_BRACKET_CLOSE) &&
      (i === 0 || s.charCodeAt(i - 1) !== $.CHAR_BACKSLASH)
    ) {
      if (c === $.CHAR_BRACKET_OPEN) {
        stack.push(i)
      } else {
        var open = stack.pop()
        if (open !== undefined) {
          close[open] = i
        }
      }
    }
  }
  // Openers skipped as plain `[text]`, innermost last
  var skipped: number[] = []
  var end = n
  for (i = 0; i < end; i++) {
    if (
      s.charCodeAt(i) !== $.CHAR_BRACKET_OPEN ||
      (i > 0 && s.charCodeAt(i - 1) === $.CHAR_BACKSLASH)
    ) {
      continue
    }
    var image = i > 0 && s.charCodeAt(i - 1) === $.CHAR_EXCLAMATION
    var ci = close[i]
    if (ci >= 0) {
      var after = ci + 1
      if (after < end) {
        var ac = s.charCodeAt(after)
        if (ac !== $.CHAR_PAREN_OPEN && ac !== $.CHAR_BRACKET_OPEN) {
          // [text] followed by other text is not a link
          skipped.push(i)
          i = ci
          continue
        }
        var want =
          ac === $.CHAR_PAREN_OPEN ? $.CHAR_PAREN_CLOSE : $.CHAR_BRACKET_CLOSE
        var j = after + 1
        while (j < end && s.charCodeAt(j) !== want) {
          j++
        }
        if (j < end) {
          // Complete [text](url) or [text][ref]
          i = j
          continue
        }
      }
    }
    if (image) {
      end = i - 1
      // A skipped `[text]` that the cut leaves at the end is now `[text]` at
      // the end (`[a]![b` -> `[a]` -> `a`), so revisit it
      var last = skipped.pop()
      if (last !== undefined && close[last] === end - 1) {
        i = last - 1
        continue
      }
      break
    }
    close[i] = -2
    if (ci >= 0) {
      // Keep only the text; the scan continues inside it
      end = ci
    }
  }
  var out = ''
  var from = 0
  for (i = 0; i < end; i++) {
    if (close[i] === -2) {
      out += s.slice(from, i)
      from = i + 1
    }
  }
  return out + s.slice(from, end)
}

/** Parse inline content */
// Maximum inline recursion depth
const MAX_INLINE_DEPTH = 200

// Reusable state object to avoid allocations - use counter for depth tracking
let _globalInlineDepth = 0

function parseInline(
  s: string,
  p: number,
  e: number,
  state: MarkdownToJSX.State,
  opts: ParseOptions
): MarkdownToJSX.ASTNode[] {
  // Track inline depth using global counter for stack overflow protection
  _globalInlineDepth++
  if (_globalInlineDepth > MAX_INLINE_DEPTH) {
    _globalInlineDepth--
    // Return content as plain text to prevent stack overflow
    return [{ type: RuleType.text, text: s.slice(p, e) }]
  }

  // Scope the inline scan memos to this call: they are keyed by position in
  // `s`, and a nested call parses a different string, so an entry must never
  // outlive the call that recorded it (issue #874). Saving into locals keeps
  // recursion correct without allocating.
  var savedScanGen = _scanGen
  _scanGen = nextScanGeneration()
  var savedNoEndFrom = _noEndFrom
  _noEndFrom = null
  var savedCloseMemoS = _closeMemoS
  var savedCloseMemo = _closeMemo
  var savedLastCloser = _lastCloser
  var savedFailedSearchLength = _failedSearchLength

  // Use state directly to avoid object spread allocation
  const childState = state

  // Streaming suppresses only constructs that text still to arrive could
  // complete: those in the outermost inline run of the block at the streaming
  // edge, not in an earlier block or nested in a link, strikethrough, or
  // other closed construct
  var streamEdge =
    opts.optimizeForStreaming === true &&
    _globalInlineDepth === 1 &&
    !state._notAtEdge

  // Strip incomplete markers BEFORE parsing, which also keeps bare URLs
  // inside incomplete links from being autolinked
  if (streamEdge) {
    let content = s.slice(p, e)
    const original = content
    // Strip incomplete inline code - count backticks to detect unmatched
    // Only strip if there's an unmatched opening backtick
    let backtickCount = 0
    let lastBacktickPos = -1
    for (let bi = 0; bi < content.length; bi++) {
      if (content.charCodeAt(bi) === $.CHAR_BACKTICK) {
        // `
        backtickCount++
        lastBacktickPos = bi
      }
    }
    if (backtickCount % 2 === 1 && lastBacktickPos !== -1) {
      // Find the last unmatched opening backtick and strip from there
      // Work backwards to find where the incomplete code span starts
      let inCode = false
      let codeStart = -1
      let i = 0
      while (i < content.length) {
        if (content.charCodeAt(i) === $.CHAR_BACKTICK) {
          if (inCode) {
            inCode = false
            codeStart = -1
          } else {
            codeStart = i
            inCode = true
          }
        }
        i++
      }
      if (inCode && codeStart !== -1) {
        content = content.slice(0, codeStart)
      }
    }
    content = stripIncompleteLinks(content)
    // Strip incomplete HTML/JSX tags - <Tag>content but no closing </Tag>
    // Match <TagName...>content at end without corresponding closing tag
    // But skip if the tag is inside a code span (backticks)
    const tagMatch = content.match(/<([A-Z][A-Za-z0-9]*)(?:\s[^>]*)?>([^<]*)$/)
    if (tagMatch && tagMatch.index !== undefined) {
      // Skip self-closing tags (e.g. <Tag />) — they are complete
      var tagPortionLen = tagMatch[0].length - tagMatch[2].length
      var isSelfClosingTag =
        tagPortionLen >= 2 &&
        tagMatch[0].charCodeAt(tagPortionLen - 2) === $.CHAR_SLASH
      if (!isSelfClosingTag) {
        // Check if the match position is inside backtick code spans
        var inCodeSpan = false
        var btCount = 0
        for (var ci = 0; ci < tagMatch.index; ci++) {
          if (content.charCodeAt(ci) === $.CHAR_BACKTICK) {
            btCount++
          }
        }
        inCodeSpan = btCount % 2 === 1
        if (!inCodeSpan) {
          const tagName = tagMatch[1]
          // Only strip if there's no closing tag for this tag
          if (indexOfCi(content, `</${tagName}`, 0, content.length) === -1) {
            // Strip the unclosed tag but keep the inner content; the match
            // bounds are already in hand, so splice instead of rescanning
            content = content.slice(0, tagMatch.index) + tagMatch[2]
          }
        }
      }
    }

    if (content !== original) {
      s = s.slice(0, p) + content
      e = p + content.length
    }
  }

  const nodes: MarkdownToJSX.ASTNode[] = []
  var delimStack: DelimEntry[] = []
  // Streaming: delimStack indices of runs to remove if left unmatched
  var held: number[] | null = null
  let textStart = p
  // Soft-break normalization buffer: when a soft break strips surrounding spaces
  // the kept newline must merge with adjacent text into one node, so the carry is
  // prepended at the next flush. Empty in the common path (one truthiness check).
  var pending = ''
  // Pre-scan for @ position to avoid calling scanBareEmail on positions far before any @
  // Skip scan entirely when autolinks are disabled or when in anchor context
  var nextAtPos =
    opts.disableAutoLink || opts.disableBareUrls || childState.inAnchor
      ? -1
      : s.indexOf('@', p)
  if (nextAtPos >= e) {
    nextAtPos = -1
  }

  while (p < e) {
    const c = s.charCodeAt(p)
    let result: ScanResult = null

    // Try inline scanners
    if (c === $.CHAR_BACKTICK) {
      result = scanCodeSpan(s, p, e)
      if (!result) {
        // Skip entire backtick run as text (per CommonMark, unmatched backtick strings are literal)
        var btLen = countChar(s, p, e, $.CHAR_BACKTICK)
        p += btLen - 1 // -1 because p++ at end of loop
      }
    } else if (c === $.CHAR_ASTERISK || c === $.CHAR_UNDERSCORE) {
      // * or _
      // Collect delimiter for two-phase emphasis processing
      var dinfo = collectDelimiter(s, p, e)
      if (dinfo) {
        var holdRun = false
        if (streamEdge) {
          var runEnd = p + dinfo.len
          var prevC = p > 0 ? s.charCodeAt(p - 1) : $.CHAR_SPACE
          var prevWs = p === 0 || isUws(prevC, s, p - 1)
          if (dinfo.canOpen) {
            // A `*` between word chars (`2*3`) is far more often literal
            // than intraword emphasis, so it is never removed. An opening
            // `_` is never intraword.
            var nextC = s.charCodeAt(runEnd)
            holdRun =
              prevWs ||
              isUPunct(prevC, s, p - 1) ||
              isUws(nextC, s, runEnd) ||
              isUPunct(nextC, s, runEnd)
          } else {
            // The char after a run at the end has not arrived; `foo **` is
            // the usual token boundary before a bold word
            holdRun = runEnd === e && prevWs
          }
        }
        if (holdRun) {
          // Kept outside DelimEntry so non-streaming entries keep one shape
          if (held === null) {
            held = []
          }
          held.push(delimStack.length)
        }
        if (dinfo.canOpen || dinfo.canClose || holdRun) {
          // Flush text before delimiter
          if (pending || p > textStart) {
            nodes.push(textNode(pending + s.slice(textStart, p)))
            pending = ''
          }
          var delimText = s.slice(p, p + dinfo.len)
          var delimNode = textNode(delimText)
          delimStack.push({
            idx: nodes.length,
            ch: c,
            len: dinfo.len,
            canOpen: dinfo.canOpen,
            canClose: dinfo.canClose,
            active: true,
          })
          nodes.push(delimNode)
          p += dinfo.len
          textStart = p
          continue
        }
        // Not a valid delimiter - skip entire run as text
        p += dinfo.len - 1 // -1 because p++ at end of loop
      }
      // Fall through to regular text handling
    } else if (c === $.CHAR_TILDE) {
      // ~
      result = scanStrikethrough(s, p, e, childState, opts)
      if (
        !result &&
        streamEdge &&
        p + 1 < e &&
        s.charCodeAt(p + 1) === $.CHAR_TILDE
      ) {
        // An unclosed `~~` at the streaming edge: drop the marker
        if (pending || p > textStart) {
          nodes.push(textNode(pending + s.slice(textStart, p)))
          pending = ''
        }
        p += 2
        textStart = p
        continue
      }
    } else if (c === $.CHAR_EQ) {
      // = - potential ==marked==
      result = scanMarked(s, p, e, childState, opts)
    } else if (c === $.CHAR_BRACKET_OPEN) {
      // [
      // Check for footnote reference [^id] first
      if (p + 1 < e && s.charCodeAt(p + 1) === $.CHAR_CARET) {
        // ^
        result = scanFootnoteRef(s, p, e, childState, opts)
      }
      if (!result) {
        result = scanLink(s, p, e, childState, opts)
      }
    } else if (
      c === $.CHAR_EXCLAMATION &&
      p + 1 < e &&
      s.charCodeAt(p + 1) === $.CHAR_BRACKET_OPEN
    ) {
      // ![
      result = scanLink(s, p, e, childState, opts)
    } else if (c === $.CHAR_LT) {
      // < - autolink or HTML
      // Try angle-bracket autolinks first (per CommonMark spec, autolinks take priority)
      result = scanAutolink(s, p, e)
      if (!(result || opts.disableParsingRawHTML || opts.ignoreHTMLBlocks)) {
        result = scanInlineHtml(s, p, e, childState, opts)
      }
    } else if (c === $.CHAR_AMPERSAND) {
      // & - character reference
      // Decode entities here, in the segment carry, so flushed text never
      // needs an entity rescan (textNode allocates without inspecting).
      var entEnd = scanEntityRef(s, p, e)
      if (entEnd !== -1) {
        var entRaw = s.slice(p, entEnd)
        var entDecoded = util.decodeEntityReferences(entRaw)
        if (entDecoded !== entRaw) {
          pending = pending + s.slice(textStart, p) + entDecoded
          p = entEnd
          textStart = entEnd
          continue
        }
      }
      // Invalid or unknown reference: the & is literal text, fall through
    } else if (
      (c === $.CHAR_H || c === $.CHAR_W || c === $.CHAR_f) &&
      !childState.inAnchor &&
      !opts.disableAutoLink
    ) {
      // h/w/f — potential http://, https://, www., or ftp://
      // Cheap pre-check: the second char must be `t` (http/ttp), `w` (www), or `t` (ftp)
      // before we pay the scanBareUrl call. This rejects the vast majority of English
      // words (the, what, with, here, for, from...) at one compare each.
      if (p === 0 || s.charCodeAt(p - 1) !== $.CHAR_LT) {
        var nextAfterPrefix = p + 1 < e ? s.charCodeAt(p + 1) : 0
        if (
          (c === $.CHAR_H && nextAfterPrefix === $.CHAR_t) ||
          (c === $.CHAR_f && nextAfterPrefix === $.CHAR_t) ||
          (c === $.CHAR_W && nextAfterPrefix === $.CHAR_W)
        ) {
          result = scanBareUrl(s, p, e, opts)
        }
      }
    }
    // Email autolink: try when we see alphanumeric that could be local part of email
    // nextAtPos tracks next @ position — only attempt email scan within 64 chars of @
    if (
      !result &&
      nextAtPos >= 0 &&
      nextAtPos - p <= 64 &&
      !childState.inAnchor &&
      !opts.disableAutoLink &&
      !opts.disableBareUrls &&
      ((c >= $.CHAR_A && c <= $.CHAR_Z) ||
        (c >= $.CHAR_a && c <= $.CHAR_z) ||
        (c >= $.CHAR_DIGIT_0 && c <= $.CHAR_DIGIT_9))
    ) {
      result = scanBareEmail(s, p, e, opts)
      // If we passed the @, advance to next one (bounded to [p+1, e))
      if (!result && p >= nextAtPos) {
        nextAtPos = s.indexOf('@', p + 1)
        if (nextAtPos >= e) {
          nextAtPos = -1
        }
      }
    }

    // Hard/soft line breaks fused into the main scan for paragraph inline content.
    // Only active when state._breaks is set (paragraphs); headings, table cells,
    // and HTML element children clear it so their raw newlines pass through unchanged.
    if (c === $.CHAR_NEWLINE && childState._breaks) {
      var isHard = false
      var trimBack = 0
      if (p > textStart && s.charCodeAt(p - 1) === $.CHAR_BACKSLASH) {
        isHard = true
        trimBack = 1
      } else {
        var spCount = 0
        var sj = p - 1
        while (sj >= textStart && s.charCodeAt(sj) === $.CHAR_SPACE) {
          spCount++
          sj--
        }
        if (spCount >= 2) {
          isHard = true
          trimBack = spCount
        }
      }

      if (isHard) {
        if (pending || p - trimBack > textStart) {
          nodes.push(textNode(pending + s.slice(textStart, p - trimBack)))
          pending = ''
        }
        nodes.push({ type: RuleType.breakLine } as MarkdownToJSX.BreakLineNode)
        // Skip the newline and leading whitespace on the next line
        p++
        while (p < e && s.charCodeAt(p) === $.CHAR_SPACE) {
          p++
        }
        textStart = p
        continue
      }

      // Soft break: trailing spaces are insignificant whitespace; the newline is
      // kept as text content and leading spaces of the next line are skipped.
      // Fast path: no trailing spaces and no next-line leading spaces means the
      // newline can flow through inside the current text segment at zero cost.
      var hasTrailSp = p > textStart && s.charCodeAt(p - 1) === $.CHAR_SPACE
      var hasLeadSp = p + 1 < e && s.charCodeAt(p + 1) === $.CHAR_SPACE
      if (hasTrailSp || hasLeadSp) {
        var softEnd = p
        while (
          softEnd > textStart &&
          s.charCodeAt(softEnd - 1) === $.CHAR_SPACE
        ) {
          softEnd--
        }
        // Carry the normalized text plus the kept newline; merged at the next flush.
        pending += `${s.slice(textStart, softEnd)}\n`
        p++
        while (p < e && s.charCodeAt(p) === $.CHAR_SPACE) {
          p++
        }
        textStart = p
        continue
      }
      // No surrounding spaces: let the newline stay in the text segment.
    }

    if (result) {
      // Flush text before this
      if (pending || p > textStart) {
        nodes.push(textNode(pending + s.slice(textStart, p)))
        pending = ''
      }
      nodes.push(result.node)
      p = result.end
      textStart = p
    } else {
      // Handle escapes
      if (c === $.CHAR_BACKSLASH && p + 1 < e) {
        const next = s.charCodeAt(p + 1)
        if (cc(next) & C_PUNCT) {
          if (pending || p > textStart) {
            nodes.push(textNode(pending + s.slice(textStart, p)))
            pending = ''
          }
          nodes.push(textNode(s[p + 1]))
          p += 2
          textStart = p
          continue
        }
      }
      // Skip ahead through plain text to next special character
      p++
      // Only skip when not near an @ (email detection needs alphanumeric chars)
      if (nextAtPos < 0 || nextAtPos - p > 64) {
        while (p < e) {
          // Stop before entering the email detection window — the fast-skip must not
          // jump past the start of an email's local-part (max 64 chars before @).
          // Without this, an INLINE_SPECIAL char inside the local-part (e.g. 'h' in
          // "technicalsupport@…") becomes the scan start, silently truncating the address.
          if (nextAtPos >= 0 && nextAtPos - p <= 64) {
            break
          }
          var nc = s.charCodeAt(p)
          if (nc < $.CHAR_ASCII_BOUNDARY && !INLINE_SPECIAL[nc]) {
            p++
          } else {
            break
          }
        }
      }
    }
  }

  // Flush remaining text
  if (pending || e > textStart) {
    nodes.push(textNode(pending + s.slice(textStart, e)))
    pending = ''
  }

  // Phase 2: Process emphasis delimiters using CommonMark algorithm
  if (delimStack.length > 0) {
    processEmphasis(nodes, delimStack, held, state, opts)
  }

  _scanGen = savedScanGen
  _noEndFrom = savedNoEndFrom
  // A failed search in this call's own string replaced the memo of the string
  // around it, whose run of unclosed tags would rescan to the end per tag
  if (savedCloseMemoS !== null && savedCloseMemoS !== _closeMemoS) {
    _closeMemoS = savedCloseMemoS
    _closeMemo = savedCloseMemo
    _lastCloser = savedLastCloser
    _failedSearchLength = savedFailedSearchLength
  }
  _globalInlineDepth--
  return nodes
}

// ============================================================================
// BLOCK PARSER
// ============================================================================

/** Parse block-level content */
// Maximum recursion depth to prevent stack overflow
const MAX_PARSE_DEPTH = 500

function parseBlocks(
  s: string,
  state: MarkdownToJSX.State,
  opts: ParseOptions
): MarkdownToJSX.ASTNode[] {
  // Track depth in state for stack overflow protection (mutate in place, restore on exit)
  var savedDepth = state._depth || 0

  if (savedDepth > MAX_PARSE_DEPTH) {
    return [{ type: RuleType.text, text: s }]
  }

  state._depth = savedDepth + 1
  const _childState = state
  var savedBlankS = _blankS
  var savedBlankFrom = _blankFrom
  var savedBlankEnd = _blankEnd
  var savedCloseMemoS = _closeMemoS
  var savedCloseMemo = _closeMemo
  var savedLastCloser = _lastCloser
  var savedFailedSearchLength = _failedSearchLength
  var savedType1TagCursor = _type1TagCursor
  var savedType1CloserCursor = _type1CloserCursor

  // For streaming mode: strip incomplete tables (header + separator without data rows)
  // Only strip if the table is at the END of the input (might be incomplete during streaming)
  if (opts.optimizeForStreaming) {
    // Guard: skip all streaming pre-parse mutations if end of input is inside
    // an unclosed fenced code block — mutations would corrupt code block content.
    // Also skip when this block cannot hold the document's streaming edge (a
    // closed block nested above the live edge), so suppression scans only the
    // trailing chain instead of re-scanning every historical block on re-parse.
    if (!(state._notAtEdge || state._endsInsideFence)) {
      // Streaming table suppression. A GFM table needs a header line plus a
      // `|---|` divider row, then body rows. While tokens are still arriving, hide
      // whatever trailing table fragment cannot render cleanly yet, without
      // disturbing the finished rows above it so the table never flickers. Block
      // preprocessing (prepareBlockInput) appends a blank line, so the whole
      // trailing newline run is skipped before locating the last line.
      var tblEnd = s.length
      while (tblEnd > 0 && s.charCodeAt(tblEnd - 1) === $.CHAR_NEWLINE) {
        tblEnd--
      }
      var tblStart = tblEnd
      while (tblStart > 0 && s.charCodeAt(tblStart - 1) !== $.CHAR_NEWLINE) {
        tblStart--
      }
      if (tblEnd > tblStart && s.charCodeAt(tblStart) === $.CHAR_PIPE) {
        // Does the trailing line carry cell content (anything past the pipes,
        // spaces, dashes, and colons a header divider is made of)?
        var trailingHasContent = false
        for (var ci = tblStart + 1; ci < tblEnd; ci++) {
          var cc = s.charCodeAt(ci)
          if (
            cc !== $.CHAR_SPACE &&
            cc !== $.CHAR_TAB &&
            cc !== $.CHAR_PIPE &&
            cc !== $.CHAR_COLON &&
            cc !== $.CHAR_DASH
          ) {
            trailingHasContent = true
            break
          }
        }
        // Walk the whole contiguous pipe-block above the trailing line, tracking
        // the block's top (fragmentStart), whether a divider row is present, and
        // how many content rows sit between that divider and the trailing line. A
        // table renders only as header + divider + at least one body row.
        var dividerAbove = false
        var sawDivider = false
        var bodyRowsBetween = 0
        var fragmentStart = tblStart
        var upEnd = tblStart - 1 // the '\n' before the trailing line, or -1
        while (upEnd > 0) {
          var upStart = upEnd
          while (upStart > 0 && s.charCodeAt(upStart - 1) !== $.CHAR_NEWLINE) {
            upStart--
          }
          if (s.charCodeAt(upStart) !== $.CHAR_PIPE) {
            break
          }
          fragmentStart = upStart
          var upSep = true
          var upDash = false
          for (var ui = upStart; ui < upEnd; ui++) {
            var uc = s.charCodeAt(ui)
            if (uc === $.CHAR_DASH) {
              upDash = true
            } else if (
              uc !== $.CHAR_SPACE &&
              uc !== $.CHAR_TAB &&
              uc !== $.CHAR_COLON &&
              uc !== $.CHAR_PIPE
            ) {
              upSep = false
              break
            }
          }
          if (upSep && upDash) {
            dividerAbove = true
            sawDivider = true
          } else if (!sawDivider) {
            bodyRowsBetween++
          }
          upEnd = upStart - 1
        }
        if (!trailingHasContent) {
          // The trailing line is an empty row shell (pipes and spaces only) or a
          // divider. Drop just that shell when a renderable table remains above it
          // (divider plus at least one body row), so finished rows stay put; drop
          // the whole fragment otherwise, since header + divider alone would leak
          // as raw pipes.
          s =
            dividerAbove && bodyRowsBetween > 0
              ? s.slice(0, tblStart).trimEnd()
              : s.slice(0, fragmentStart).trimEnd()
        } else if (!dividerAbove) {
          // The trailing line carries content but no divider has arrived, so it is
          // an incomplete header (or a lone pipe-led line), not yet a table. Hide
          // it until its divider and first row arrive.
          s = s.slice(0, tblStart).trimEnd()
        }
        // Otherwise the trailing line is a body row of a rendered table; keep it so
        // its cells stream in.
      }

      // Strip incomplete HTML at the streaming edge. Two shapes:
      // 1) Opened tag with '>' arrived but no matching close: drop the opener,
      //    keep its trailing content (`<div>incomplete` → `incomplete`).
      // 2) Tag-like prefix whose '>' has not arrived yet: drop from '<' to end
      //    (`Hello <Citation` → `Hello `). Trigger only for a letter, `/`+letter,
      //    `!`, `?`, or a bare terminal '<'. Literal less-than prose (`5 < 3`,
      //    `<3`, `< foo`) is left alone.
      var htmlTagPos = -1
      var htmlTagEnd = -1
      var htmlContentStart = -1
      var htmlIncompletePrefix = false
      for (var hi = s.length - 1; hi >= 0; hi--) {
        if (s.charCodeAt(hi) === $.CHAR_LT) {
          var hc = hi + 1 < s.length ? s.charCodeAt(hi + 1) : 0
          var isLetter =
            (hc >= $.CHAR_A && hc <= $.CHAR_Z) ||
            (hc >= $.CHAR_a && hc <= $.CHAR_z)
          var isClose =
            hc === $.CHAR_SLASH &&
            hi + 2 < s.length &&
            ((s.charCodeAt(hi + 2) >= $.CHAR_A &&
              s.charCodeAt(hi + 2) <= $.CHAR_Z) ||
              (s.charCodeAt(hi + 2) >= $.CHAR_a &&
                s.charCodeAt(hi + 2) <= $.CHAR_z))
          var isBangOrPi = hc === $.CHAR_EXCLAMATION || hc === $.CHAR_QUESTION
          // prepareBlockInput appends a trailing blank line, so a document-final
          // '<' is followed only by newlines. Those synthetic newlines do not
          // make the '<' a literal; a user-typed space after '<' does.
          var sigEnd = s.length
          while (
            sigEnd > hi + 1 &&
            s.charCodeAt(sigEnd - 1) === $.CHAR_NEWLINE
          ) {
            sigEnd--
          }
          var isBareTerminal = hi + 1 >= sigEnd
          if (
            (isLetter || isClose || isBangOrPi || isBareTerminal) &&
            // A complete autolink (`<https://...>`) is not a tag
            !(isLetter && scanAutolink(s, hi, s.length))
          ) {
            // find end of tag name (letters/digits after optional '/' )
            var hn = hi + 1
            if (isClose) {
              hn = hi + 2
            } else if (isLetter) {
              hn = hi + 2
            }
            if (isLetter || isClose) {
              while (hn < s.length) {
                var hnc = s.charCodeAt(hn)
                if (
                  (hnc >= $.CHAR_A && hnc <= $.CHAR_Z) ||
                  (hnc >= $.CHAR_a && hnc <= $.CHAR_z) ||
                  (hnc >= $.CHAR_DIGIT_0 && hnc <= $.CHAR_DIGIT_9)
                ) {
                  hn++
                } else {
                  break
                }
              }
            }
            // find '>' after the opener (declarations/comments/PI scan to '>')
            var hg = isLetter || isClose ? hn : hi + 2
            while (hg < s.length && s.charCodeAt(hg) !== $.CHAR_GT) {
              hg++
            }
            if (hg >= s.length) {
              // '>' has not arrived: defer the whole incomplete prefix
              htmlTagPos = hi
              htmlIncompletePrefix = true
            } else if (
              // A complete closing tag or void element closes nothing later
              isLetter &&
              s.charCodeAt(hg - 1) !== $.CHAR_SLASH &&
              !util.isVoidElement(s.slice(hi + 1, hn))
            ) {
              // verify no '<' in content after '>'
              var hasLt = false
              for (var hk = hg + 1; hk < s.length; hk++) {
                if (s.charCodeAt(hk) === $.CHAR_LT) {
                  hasLt = true
                  break
                }
              }
              if (!hasLt) {
                htmlTagPos = hi
                htmlTagEnd = hn
                htmlContentStart = hg + 1
              }
            }
          }
          break
        }
      }
      if (htmlTagPos >= 0) {
        // Check if the match is inside backtick code spans
        var blockBtCount = 0
        for (var bci = 0; bci < htmlTagPos; bci++) {
          if (s.charCodeAt(bci) === $.CHAR_BACKTICK) {
            blockBtCount++
          }
        }
        if (blockBtCount % 2 === 0) {
          if (htmlIncompletePrefix) {
            s = s.slice(0, htmlTagPos)
          } else {
            var hTag = s.slice(htmlTagPos + 1, htmlTagEnd)
            if (indexOfCi(s, `</${hTag}`, 0, s.length) === -1) {
              // Remove the unclosed tag but keep its content
              s = s.slice(0, htmlTagPos) + s.slice(htmlContentStart)
            }
          }
        }
      }

      // Strip ambiguous setext underlines at end of input
      // (dashes could start a list, equals could be incomplete; defer until disambiguated)
      var stEnd = s.length
      while (stEnd > 0 && s.charCodeAt(stEnd - 1) === $.CHAR_NEWLINE) {
        stEnd--
      }
      if (stEnd > 0) {
        var stLs = stEnd
        while (stLs > 0 && s.charCodeAt(stLs - 1) !== $.CHAR_NEWLINE) {
          stLs--
        }
        // Skip up to 3 leading spaces (CommonMark setext indent limit)
        var stP = stLs
        var stSp = 0
        while (stP < stEnd && s.charCodeAt(stP) === $.CHAR_SPACE && stSp < 3) {
          stP++
          stSp++
        }
        if (stLs > 0 && stP < stEnd && isSetextUnderline(s, stP, stEnd)) {
          // Only strip if preceded by non-blank line (setext requires adjacent text)
          var pLe = stLs - 1
          var pLs = pLe
          while (pLs > 0 && s.charCodeAt(pLs - 1) !== $.CHAR_NEWLINE) {
            pLs--
          }
          if (!isBlank(s, pLs, pLe)) {
            s = s.slice(0, stLs).trimEnd()
          }
        }
      }

      // Strip incomplete list items at end of input
      // A lone list marker (*, -, +, or digit./digit)) with no content or only whitespace
      // should be suppressed since the content hasn't finished arriving
      var sLen = s.length
      if (sLen > 0) {
        // Find last line
        var lastNlPos = s.lastIndexOf('\n')
        var llStart = lastNlPos === -1 ? 0 : lastNlPos + 1
        var llEnd = sLen
        // Skip leading whitespace (up to 3 spaces for list indent)
        var llp = llStart
        var llSpaces = 0
        while (
          llp < llEnd &&
          s.charCodeAt(llp) === $.CHAR_SPACE &&
          llSpaces < 3
        ) {
          llp++
          llSpaces++
        }
        if (llp < llEnd) {
          var llc = s.charCodeAt(llp)
          var isListMarker = false
          // Unordered: *, -, +
          if (
            llc === $.CHAR_ASTERISK ||
            llc === $.CHAR_DASH ||
            llc === $.CHAR_PLUS
          ) {
            // Check if followed by space/tab/end or nothing (empty item)
            var afterM = llp + 1
            if (
              afterM >= llEnd ||
              s.charCodeAt(afterM) === $.CHAR_SPACE ||
              s.charCodeAt(afterM) === $.CHAR_TAB
            ) {
              // Check if content after marker+space is empty/whitespace
              var contentP = afterM
              while (
                contentP < llEnd &&
                (s.charCodeAt(contentP) === $.CHAR_SPACE ||
                  s.charCodeAt(contentP) === $.CHAR_TAB)
              ) {
                contentP++
              }
              if (contentP >= llEnd) {
                isListMarker = true
              }
            }
          }
          // Ordered: digit(s) followed by . or )
          else if (llc >= $.CHAR_DIGIT_0 && llc <= $.CHAR_DIGIT_9) {
            var numP = llp
            while (
              numP < llEnd &&
              s.charCodeAt(numP) >= $.CHAR_DIGIT_0 &&
              s.charCodeAt(numP) <= $.CHAR_DIGIT_9
            ) {
              numP++
            }
            if (
              numP < llEnd &&
              (s.charCodeAt(numP) === $.CHAR_PERIOD ||
                s.charCodeAt(numP) === $.CHAR_PAREN_CLOSE)
            ) {
              var afterOm = numP + 1
              if (
                afterOm >= llEnd ||
                s.charCodeAt(afterOm) === $.CHAR_SPACE ||
                s.charCodeAt(afterOm) === $.CHAR_TAB
              ) {
                var oContentP = afterOm
                while (
                  oContentP < llEnd &&
                  (s.charCodeAt(oContentP) === $.CHAR_SPACE ||
                    s.charCodeAt(oContentP) === $.CHAR_TAB)
                ) {
                  oContentP++
                }
                if (oContentP >= llEnd) {
                  isListMarker = true
                }
              }
            }
          }
          if (isListMarker) {
            s = s.slice(0, llStart).trimEnd()
          }
        }
      }
    } // end if (!insideFence)
  }

  // If inline mode, just parse as inline content directly
  if (state.inline) {
    return parseInline(s, 0, s.length, state, opts)
  }

  const nodes: MarkdownToJSX.ASTNode[] = []
  let p = 0
  var e = s.length
  // Not looked up until a `<` block in a list item needs it
  var lastLazyMarker = -2

  // Check for frontmatter at the start of the document (requires valid YAML)
  if (p === 0 && !opts.disableFrontmatter && s.startsWith('---')) {
    const bounds = util.parseFrontmatterBounds(s)
    if (bounds?.hasValidYaml) {
      // Output frontmatter by default, skip only if preserveFrontmatter === false
      if (opts.preserveFrontmatter !== false) {
        const frontmatterText = s.slice(0, bounds.endPos).trimEnd()
        nodes.push({
          type: RuleType.frontmatter,
          text: frontmatterText,
        } as MarkdownToJSX.FrontmatterNode)
      }
      // Skip past frontmatter
      p = bounds.endPos
    }
  }

  while (p < e) {
    // Skip blank lines — inline lineEnd to avoid function call overhead on hot path
    var _le = s.indexOf('\n', p)
    var le = _le < 0 ? e : _le
    while (p < e) {
      if (!isBlank(s, p, le)) {
        break
      }
      p = le < e ? le + 1 : le
      if (p < e) {
        _le = s.indexOf('\n', p)
        le = _le < 0 ? e : _le
      }
    }
    if (p >= e) {
      break
    }

    // Lazy continuation marker (\u001E) forces paragraph treatment; the
    // paragraph scanner handles \u001E-prefixed continuation lines
    var isLazyContinuation = s.charCodeAt(p) === $.CHAR_RECORD_SEP

    indent(s, p, le)

    let result: ScanResult = null
    var pendingBefore = state._pendingInline ? state._pendingInline.length : 0

    // Seed the lineEnd cache so scanners called below get their entry-point
    // lineEnd(s, p) for free (their very first line of work is almost always
    // `var e = lineEnd(s, p)`). This eliminates one SIMD indexOf per block.
    _leCacheS = s
    _leCacheP = p
    _leCacheE = le

    // Check for indented code block (4+ spaces) - skip when inside HTML blocks
    if (!isLazyContinuation && _indentSpaces >= 4 && !state.inHTML) {
      result = scanIndented(s, p)
    } else if (!isLazyContinuation) {
      const i = p + _indentChars
      const c = s.charCodeAt(i)

      // Try block scanners based on first character
      if (c === $.CHAR_HASH) {
        // #
        result = scanHeading(s, p, state, opts)
      } else if (c === $.CHAR_GT) {
        // >
        result = scanBlockquote(s, p, state, opts)
      } else if (c === $.CHAR_BACKTICK || c === $.CHAR_TILDE) {
        // ` or ~
        result = scanFenced(s, p, state)
      } else if (
        c === $.CHAR_DASH ||
        c === $.CHAR_ASTERISK ||
        c === $.CHAR_UNDERSCORE
      ) {
        // - * _
        result = scanThematic(s, p)
        if (!result) {
          result = scanList(s, p, state, opts)
        }
      } else if (
        c === $.CHAR_PLUS ||
        (c >= $.CHAR_DIGIT_0 && c <= $.CHAR_DIGIT_9)
      ) {
        // + or digit
        result = scanList(s, p, state, opts)
      } else if (c === $.CHAR_LT) {
        // <
        if (state.inList) {
          if (lastLazyMarker === -2) {
            lastLazyMarker = s.lastIndexOf(LAZY_MARKER)
          }
          // An HTML block takes a lazy line in as raw content, where the marker
          // would reach the output and hide an attribute name from the handler
          // screen. Later lines have no open paragraph to be lazy to.
          if (
            lastLazyMarker > p &&
            !opts.ignoreHTMLBlocks &&
            !opts.disableParsingRawHTML &&
            (detectHtmlBlockType(s, i) !== 0 || isComponentShapedTag(s, i))
          ) {
            s = s.slice(0, p) + dropLazyMarkers(s.slice(p))
            e = s.length
            lastLazyMarker = -1
          }
        }
        result = scanHtmlBlock(s, p, state, opts)
      } else if (c === $.CHAR_PIPE) {
        // |
        result = scanTable(s, p, state, opts)
      } else if (c === $.CHAR_BRACKET_OPEN) {
        // [ - could be reference definition
        result = scanRefDefinition(s, p, state)
      }
    }

    // Try table if current line contains | (bounded scan to avoid O(n) per block)
    if (!result) {
      var hasPipeInLine = false
      for (var pi = p; pi < le; pi++) {
        if (s.charCodeAt(pi) === $.CHAR_PIPE) {
          hasPipeInLine = true
          break
        }
      }
      if (hasPipeInLine) {
        result = scanTable(s, p, state, opts)
      }
    }

    // Fallback to paragraph
    if (!result) {
      result = scanParagraph(s, p, state, opts)
    }

    if (result) {
      // Don't add refCollection nodes to output
      if (result.node.type !== RuleType.refCollection) {
        nodes.push(result.node)
      }
      // A block followed by more content cannot hold the streaming edge, so
      // the inline parses it deferred must not hold back unclosed openers
      var pendingQ = state._pendingInline
      if (
        opts.optimizeForStreaming &&
        pendingQ &&
        pendingQ.length > pendingBefore &&
        !onlyBlankLinesAfter(s, result.end, e)
      ) {
        for (var pqi = pendingBefore; pqi < pendingQ.length; pqi++) {
          pendingQ[pqi].notAtEdge = true
        }
      }
      p = result.end
    } else {
      // Skip line if nothing matched
      var _skip = s.indexOf('\n', p)
      p = _skip < 0 ? e : _skip + 1
    }
  }

  _blankS = savedBlankS
  _blankFrom = savedBlankFrom
  _blankEnd = savedBlankEnd
  _closeMemoS = savedCloseMemoS
  _closeMemo = savedCloseMemo
  _lastCloser = savedLastCloser
  _failedSearchLength = savedFailedSearchLength
  _type1TagCursor = savedType1TagCursor
  _type1CloserCursor = savedType1CloserCursor
  state._depth = savedDepth
  return nodes
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

/**
 * Main parser entry point - matches original parser interface
 */
export function parser(
  source: string,
  options?: ParserInputOptions | null
): MarkdownToJSX.ASTNode[] {
  // Strip BOM (U+FEFF) at document start per CommonMark spec
  if (source.charCodeAt(0) === $.CHAR_BYTE_ORDER_MARK) {
    source = source.slice(1)
  }

  // Default state with refs object. Heading-id maps allocate lazily in
  // uniqueHeadingId on the first non-empty heading.
  const state: MarkdownToJSX.State = {
    inAnchor: false,
    inBlockQuote: false,
    inHTML: false,
    inList: false,
    inline: false,
    refs: Object.create(null) as {
      [key: string]: { target: string; title: string | undefined }
    },
  }

  return parseMarkdown(source, state, toParseOptions(options))
}

export function parseCodeFenced(
  s: string,
  p: number,
  state: MarkdownToJSX.State
): {
  endPos: number
  end: number
  node: MarkdownToJSX.ASTNode
  type: number
  text: string
  lang: string | undefined
  attrs: Record<string, string> | undefined
} | null {
  var res = scanFenced(s, p, state)
  if (!res) {
    return null
  }
  var node = res.node as MarkdownToJSX.CodeBlockNode
  return {
    ...res,
    endPos: res.end,
    end: res.end,
    node: res.node,
    type: RuleType.codeBlock,
    text: node.text,
    lang: node.lang,
    attrs: node.attrs as Record<string, string> | undefined,
  }
}

export function parseHTMLTag(
  s: string,
  p: number,
  _state?: MarkdownToJSX.State,
  _options?: unknown
): {
  tagName: string
  tagLower: string
  attrs: string
  whitespaceBeforeAttrs: string
  isSelfClosing: boolean
  hasSpaceBeforeSlash: boolean
  isClosing: boolean
  hasNewline: boolean
  endPos: number
} | null {
  var res = __parseHtmlTag(s, p)
  if (!res) {
    return null
  }
  return {
    tagName: res.tag,
    tagLower: res.tag.toLowerCase(),
    attrs: res._rawAttrs,
    whitespaceBeforeAttrs: res._whitespaceBeforeAttrs,
    isSelfClosing: res._selfClosing,
    hasSpaceBeforeSlash: res._hasSpaceBeforeSlash,
    isClosing: res._isClosing,
    hasNewline:
      res._whitespaceBeforeAttrs.includes('\n') || res._rawAttrs.includes('\n'),
    endPos: res.end,
  }
}

export function calculateIndent(
  s: string,
  p: number,
  e: number,
  _state?: unknown
): {
  indent: number
  chars: number
  spaceEquivalent: number
  charCount: number
} {
  indent(s, p, e)
  return {
    indent: _indentSpaces,
    chars: _indentChars,
    spaceEquivalent: _indentSpaces,
    charCount: _indentChars,
  }
}
export function parseDefinition(
  s: string,
  p: number,
  state: MarkdownToJSX.State,
  _opts: unknown,
  _isFootnote: boolean
): { type: number; endPos: number; end: number } | null {
  var defRefs = state.refs
  if (!defRefs) {
    return null
  }
  var end = parseRefDef(s, p, defRefs)
  if (end === null) {
    return null
  }
  return { type: RuleType.ref, endPos: end, end }
}
export function parseStyleAttribute(style: string): [string, string][] {
  var result: [string, string][] = []
  var decls = style.split(';')
  for (var di = 0; di < decls.length; di++) {
    var colonIdx = decls[di].indexOf(':')
    if (colonIdx !== -1) {
      var prop = decls[di].slice(0, colonIdx).trim()
      var val = decls[di].slice(colonIdx + 1).trim()
      if (prop && val) {
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1)
        }
        result.push([prop, val])
      }
    }
  }
  return result
}

// Export parseMarkdown with refCollection node for react.tsx compatibility
export function parseMarkdown(
  input: string,
  state: MarkdownToJSX.State,
  opts: ParseOptions
): MarkdownToJSX.ASTNode[] {
  // Reset global depth counter at the start of each parse
  _globalInlineDepth = 0
  var outerOptionsForTags = _parseOptionsForTags
  _parseOptionsForTags = opts

  // Normalize input (CRLF → LF, null bytes → U+FFFD)
  input = util.normalizeInput(input)
  _tagSkipBudget = input.length * 16 + TAG_SKIP_BUDGET_FLOOR

  if (!state.refs) {
    state.refs = Object.create(null) as {
      [key: string]: { target: string; title: string | undefined }
    }
  }
  // Inline parsing is deferred until after the block pass (queueInline), so
  // reference definitions registered by scanRefDefinition are complete before
  // any link lookup runs and no separate collection pre-pass is needed.
  // Streaming mode still needs the pre-pass for fence detection, and inline
  // mode never block-parses so the pre-pass is its only ref collector.
  if (opts.optimizeForStreaming || state.inline) {
    state._endsInsideFence = collectReferenceDefinitions(
      input,
      state.refs,
      opts
    )
  }

  // When this call owns the queues, keep direct references to the arrays it
  // installed: nested parses push into the same arrays via state, and the
  // locals prove definedness without a non-null assertion.
  var ownedInline: MarkdownToJSX.State['_pendingInline']
  var ownedOps: MarkdownToJSX.State['_pendingOps']
  if (!state._pendingInline) {
    state._pendingInline = ownedInline = []
    state._pendingOps = ownedOps = []
  }

  const nodes = parseBlocks(input, state, opts)

  if (ownedInline && ownedOps) {
    // Stage 1: run deferred inline parses. Entries restore the exact state
    // flags captured at their callsite. The queue can grow while draining
    // (nested block parses inside inline HTML), so re-read length each pass.
    var q = ownedInline
    var sv = {
      inline: state.inline,
      inAnchor: state.inAnchor,
      inHTML: state.inHTML,
      htmlDepth: state._htmlDepth,
      inList: state.inList,
      inBlockQuote: state.inBlockQuote,
      noSetext: state._noSetext,
      depth: state._depth,
      notAtEdge: state._notAtEdge,
    }
    for (var qi = 0; qi < q.length; qi++) {
      var ent = q[qi]
      state.inline = ent.inline
      state.inAnchor = ent.inAnchor
      state.inHTML = ent.inHTML
      state._htmlDepth = ent.htmlDepth
      state.inList = ent.inList
      state.inBlockQuote = ent.inBlockQuote
      state._noSetext = ent.noSetext
      state._depth = ent.depth
      state._notAtEdge = ent.notAtEdge
      state._breaks = ent.breaks
      var parsed = parseInline(ent.text, 0, ent.text.length, state, opts)
      state._breaks = false
      for (var pi = 0; pi < parsed.length; pi++) {
        ent.dest.push(parsed[pi])
      }
    }
    state.inline = sv.inline
    state.inAnchor = sv.inAnchor
    state.inHTML = sv.inHTML
    state._htmlDepth = sv.htmlDepth
    state.inList = sv.inList
    state.inBlockQuote = sv.inBlockQuote
    state._noSetext = sv.noSetext
    state._depth = sv.depth
    state._notAtEdge = sv.notAtEdge

    // Stage 2: list-item unwrap/concat ops that copy now-filled children
    var ops = ownedOps
    for (var oi = 0; oi < ops.length; oi++) {
      var op = ops[oi]
      for (var si = 0; si < op.src.length; si++) {
        var sn = op.src[si]
        if (op.unwrap && sn.type === RuleType.paragraph) {
          var pc2 = (sn as MarkdownToJSX.ParagraphNode).children
          for (var ci2 = 0; ci2 < pc2.length; ci2++) {
            op.dest.push(pc2[ci2])
          }
        } else {
          op.dest.push(sn)
        }
      }
    }

    state._pendingInline = undefined
    state._pendingOps = undefined
    // Most documents never search for a closing tag; skip the reallocation
    if (_closeMemoS !== null) {
      resetCloseTagMemo()
    }

    // Heading ids need filled inline children (links, code, footnotes). Assign
    // after the flush so slugify sees rendered text, not raw source.
    assignHeadingIds(nodes, state, opts.slugify)
  }

  _parseOptionsForTags = outerOptionsForTags

  // Add refCollection node at the start if there are refs
  if (util.hasKeys(state.refs)) {
    return [
      {
        type: RuleType.refCollection,
        refs: state.refs,
      } as MarkdownToJSX.ReferenceCollectionNode,
      ...nodes,
    ]
  }

  return nodes
}
