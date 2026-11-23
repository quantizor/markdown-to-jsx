import { $ } from './constants.ts'
import { type MarkdownToJSX, RuleType } from './types.ts'
import * as util from './utils.ts'
import {
  C_PUNCT,
  C_WS,
  CC,
  UNICODE_PUNCT_R,
  UNICODE_WHITESPACE_R,
} from './utils.ts'

export interface ParseOptions {
  disableAutoLink?: boolean
  disableFrontmatter?: boolean
  disableParsingRawHTML?: boolean
  enforceAtxHeadings?: boolean
  evalUnserializableExpressions?: boolean
  ignoreHTMLBlocks?: boolean
  optimizeForStreaming?: boolean
  overrides?: { [tag: string]: unknown }
  preserveFrontmatter?: boolean
  sanitizer: (value: string, tag: string, attribute: string) => string | null
  slugify: (input: string) => string
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

export function toParseOptions(
  options: ParserInputOptions | null | undefined
): ParseOptions {
  var opts = options || {}
  const userSlugify = opts.slugify
  return {
    disableAutoLink: opts.disableAutoLink,
    disableFrontmatter: opts.disableFrontmatter,
    disableParsingRawHTML: opts.disableParsingRawHTML,
    enforceAtxHeadings: opts.enforceAtxHeadings,
    evalUnserializableExpressions: opts.evalUnserializableExpressions,
    ignoreHTMLBlocks: opts.ignoreHTMLBlocks,
    optimizeForStreaming: opts.optimizeForStreaming,
    overrides: opts.overrides,
    preserveFrontmatter: opts.preserveFrontmatter,
    sanitizer: opts.sanitizer || util.sanitizer,
    slugify: userSlugify
      ? (input: string) => userSlugify(input, util.slugify)
      : util.slugify,
  }
}

type AstNodeWithChildren = Extract<
  MarkdownToJSX.ASTNode,
  { children: MarkdownToJSX.ASTNode[] }
>

var _end = 0
function ret(end: number, node: MarkdownToJSX.ASTNode): MarkdownToJSX.ASTNode {
  _end = end
  return node
}

function wordSet(words: string): Set<string> {
  return new Set(words.split(' '))
}

export const HTML_BLOCK_ELEMENT_START_R_ATTR: RegExp =
  /^<([a-zA-Z][a-zA-Z0-9-]*)\s[^>]*>/
export const UPPERCASE_TAG_R: RegExp = /^<[A-Z]/
export var TYPE1_TAG_NAMES: string[] = ['pre', 'script', 'style', 'textarea']

var TYPE1_TAGS = new Set(TYPE1_TAG_NAMES)
var BLOCK_TAGS = wordSet(
  'address article aside base basefont blockquote body caption center col colgroup dd details dialog dir div dl dt fieldset figcaption figure footer form frame frameset h1 h2 h3 h4 h5 h6 head header hr html iframe legend li link main menu menuitem nav noframes ol optgroup option p param search section summary table tbody td tfoot th thead title tr track ul'
)
var URL_BEARING_ATTRS = wordSet(
  'action background cite data formaction href longdesc poster src xlink:href xlinkhref'
)
var RENDERER_ONLY_ATTRS = wordSet(
  'children dangerouslysetinnerhtml innerhtml outerhtml ref'
)

var REFRESH_URL_PREFIX_R =
  /^[\t\n\f\r \d.]*[;,]?[\t\n\f\r ]*(?:url[\t\n\f\r ]*=[\t\n\f\r ]*)?["']?/i
var CSS_COMMENT_R = /\/\*[\s\S]*?(?:\*\/|$)/g
var CSS_ESCAPE_R = /\\(?:([0-9a-f]{1,6})[\t\n\f\r ]?|([\s\S]))/gi
var CSS_NOISE_R = /[\u0000- "']/g
var STYLE_XSS_R =
  /[(,](?:javascript|vbscript|data(?!:image\/)):|expression\(|-moz-binding|(?:^|[;{])behavior:/
var CONTROL_CHARS_R = /[\u0000-\u001F\u007F]/g
var BRACE_NAME_WRAPPER_R = /[{}"'`]/g
var NUMERIC_ENTITY_R = /&#(x[0-9a-f]+|[0-9]+);?/gi
var LT_R = /</g
var LAZY_MARKER = String.fromCharCode($.CHAR_RECORD_SEP)

// biome-ignore lint/suspicious/noConstEnum: the bundler inlines const enum members; a plain const would stay a variable in the minified dist
const enum F {
  WS = 1,
  WSNL = 2,
  SPNL = 4,
  ASCII_WS = 8,
  ALPHA = 16,
  DIGIT = 32,
  HEX = 64,
  TAG = 128,
  ATTR = 256,
  EMAIL = 512,
  INLINE = 1024,
  URL_TRIM = 2048,
  UNQUOTED_STOP = 4096,
  URL_STOP = 8192,
  SLASH_GT = 16_384,
  EQ_GT = 32_768,
}

var CF = new Uint16Array(128)
;(() => {
  var i: number
  for (i = $.CHAR_A; i <= $.CHAR_Z; i++) {
    CF[i] |= F.ALPHA | F.TAG | F.ATTR | F.EMAIL
    CF[i + $.CHAR_CASE_OFFSET] |= F.ALPHA | F.TAG | F.ATTR | F.EMAIL
  }
  for (i = $.CHAR_A; i <= $.CHAR_F; i++) {
    CF[i] |= F.HEX
    CF[i + $.CHAR_CASE_OFFSET] |= F.HEX
  }
  for (i = $.CHAR_DIGIT_0; i <= $.CHAR_DIGIT_9; i++) {
    CF[i] |= F.DIGIT | F.HEX | F.TAG | F.ATTR | F.EMAIL
  }
  var sets: [string, number][] = [
    [' \t', F.WS | F.WSNL | F.ASCII_WS | F.URL_STOP],
    ['\n', F.WSNL | F.SPNL | F.ASCII_WS | F.URL_STOP | F.INLINE],
    [' ', F.SPNL],
    ['\r', F.ASCII_WS | F.URL_STOP],
    ['\f', F.ASCII_WS],
    ['-', F.TAG | F.ATTR | F.EMAIL],
    ['_.', F.ATTR | F.EMAIL | F.URL_TRIM],
    [':', F.ATTR | F.URL_TRIM],
    ["!#$%&'*+/=?^`{|}~", F.EMAIL],
    ['`*_~=[!<\\&hwf', F.INLINE],
    [',!?)~*]', F.URL_TRIM],
    [' \t\n>"\'=<`', F.UNQUOTED_STOP],
    ['<>', F.URL_STOP],
    ['/>', F.SLASH_GT],
    ['=>', F.EQ_GT],
  ]
  for (var si = 0; si < sets.length; si++) {
    var str = sets[si][0]
    var flag = sets[si][1]
    for (i = 0; i < str.length; i++) {
      CF[str.charCodeAt(i)] |= flag
    }
  }
})()

function isCF(c: number, mask: number): boolean {
  return c < $.CHAR_ASCII_BOUNDARY && (CF[c] & mask) !== 0
}

export function isType1Block(tagLower: string): boolean {
  return TYPE1_TAGS.has(tagLower)
}

function matchType1At(s: string, at: number, isClose: boolean): boolean {
  var ns = at + (isClose ? 2 : 1)
  if (isClose && s.charCodeAt(at + 1) !== $.CHAR_SLASH) {
    return false
  }
  var ne = skipMask(s, ns, Math.min(s.length, ns + 9), F.ALPHA)
  var n = ne - ns
  var name =
    n === 3
      ? 'pre'
      : n === 5
        ? 'style'
        : n === 6
          ? 'script'
          : n === 8
            ? 'textarea'
            : ''
  if (!(name && matchesFolded(s, ns, name))) {
    return false
  }
  if (isClose) {
    return ne < s.length && s.charCodeAt(ne) === $.CHAR_GT
  }
  var ac = ne < s.length ? s.charCodeAt(ne) : 0
  return !util.isAlnumCode(ac) && ac !== $.CHAR_UNDERSCORE
}

export function containsType1Tag(text: string): boolean {
  for (var lt = text.indexOf('<'); lt !== -1; lt = text.indexOf('<', lt + 1)) {
    if (matchType1At(text, lt, false)) {
      return true
    }
  }
  return false
}

export function isASCIILetter(c: number): boolean {
  return (c | 0x20) >= $.CHAR_a && (c | 0x20) <= $.CHAR_z
}

function dropLazyMarkers(text: string): string {
  return text.indexOf(LAZY_MARKER) === -1
    ? text
    : text.split(LAZY_MARKER).join('')
}

function cc(code: number): number {
  return code < $.CHAR_ASCII_BOUNDARY
    ? CC[code]
    : code === $.CHAR_NBSP
      ? C_WS
      : 0
}

function unescapeString(s: string): string {
  var bs = s.indexOf('\\')
  if (bs === -1) {
    return s
  }
  var out = ''
  var seg = 0
  var n = s.length
  for (var i = bs; i < n; ) {
    if (
      s.charCodeAt(i) === $.CHAR_BACKSLASH &&
      i + 1 < n &&
      cc(s.charCodeAt(i + 1)) & C_PUNCT
    ) {
      out += s.slice(seg, i) + s[i + 1]
      seg = i += 2
    } else {
      i++
    }
  }
  return seg < n ? out + s.slice(seg) : out
}

function hasUnescapedBracket(s: string): boolean {
  if (s.indexOf('[') < 0 && s.indexOf(']') < 0) {
    return false
  }
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i)
    if (c === $.CHAR_BACKSLASH) {
      i++
    } else if (c === $.CHAR_BRACKET_OPEN || c === $.CHAR_BRACKET_CLOSE) {
      return true
    }
  }
  return false
}

function normalizeLabel(label: string): string {
  var n = label.length
  var prevSpace = true
  var clean = n > 0
  for (var i = 0; i < n; i++) {
    var c = label.charCodeAt(i)
    if (c === $.CHAR_SPACE) {
      if (prevSpace) {
        clean = false
        break
      }
      prevSpace = true
    } else if (c < 33 || c > 126 || (c >= $.CHAR_A && c <= $.CHAR_Z)) {
      clean = false
      break
    } else {
      prevSpace = false
    }
  }
  if (clean && !prevSpace) {
    return label
  }
  var norm = label.replace(/\s+/g, ' ').trim()
  return (
    norm.indexOf('\u1E9E') === -1 ? norm : norm.replace(/\u1E9E/g, 'ss')
  ).toLowerCase()
}

var _leCacheS: string | null = null
var _leCacheP = -1
var _leCacheE = -1

interface TagMemo {
  _failEnd: number
  _failStarts: number[]
  _noCloseEnd: number
  _noCloseFrom: number
}

interface DocCache {
  _blankEnd: number
  _blankFrom: number
  _closeMemo: Record<string, TagMemo | undefined>
  _failedLen: number
  _lastCloser: Record<string, number | undefined> | null
  _s: string
  _t1CloseAt: number
  _t1CloseFrom: number
  _t1TagAt: number
  _t1TagFrom: number
}

var _doc: DocCache | null = null

function docFor(s: string): DocCache {
  if (_doc !== null && _doc._s === s) {
    return _doc
  }
  _doc = {
    _blankEnd: -1,
    _blankFrom: -1,
    _closeMemo: Object.create(null),
    _failedLen: 0,
    _lastCloser: null,
    _s: s,
    _t1CloseAt: -1,
    _t1CloseFrom: -1,
    _t1TagAt: -1,
    _t1TagFrom: -1,
  }
  return _doc
}

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

function nextLine(s: string, p: number): number {
  var e = lineEnd(s, p)
  return e < s.length ? e + 1 : e
}

function nextLineOrEnd(s: string, p: number): number {
  return p < s.length ? nextLine(s, p) : s.length
}

function prevLineStart(s: string, pos: number): number {
  while (pos > 0 && s.charCodeAt(pos - 1) !== $.CHAR_NEWLINE) {
    pos--
  }
  return pos
}

function skipMask(s: string, p: number, e: number, mask: number): number {
  while (p < e && isCF(s.charCodeAt(p), mask)) {
    p++
  }
  return p
}

function scanUntil(s: string, p: number, e: number, mask: number): number {
  while (p < e && !isCF(s.charCodeAt(p), mask)) {
    p++
  }
  return p
}

function scanTagName(s: string, p: number, e: number): number {
  return p < e && isASCIILetter(s.charCodeAt(p))
    ? skipMask(s, p + 1, e, F.TAG)
    : p
}

function rtrim(s: string, p: number, e: number, allWs: boolean): number {
  while (e > p) {
    var c = s.charCodeAt(e - 1)
    if (
      c === $.CHAR_NEWLINE ||
      (allWs && (c === $.CHAR_SPACE || c === $.CHAR_TAB || c === $.CHAR_CR))
    ) {
      e--
    } else {
      break
    }
  }
  return e
}

function trimEndNl(s: string, from: number): string {
  return s.slice(from, rtrim(s, from, s.length, false))
}

function countChar(s: string, p: number, e: number, ch: number): number {
  var n = 0
  while (p + n < e && s.charCodeAt(p + n) === ch) {
    n++
  }
  return n
}

function findChar(s: string, p: number, e: number, ch: number): number {
  while (p < e) {
    if (s.charCodeAt(p) === ch) {
      return p
    }
    p++
  }
  return -1
}

function isBlank(s: string, p: number, e: number): boolean {
  while (p < e) {
    var c = s.charCodeAt(p)
    if (c !== $.CHAR_SPACE && c !== $.CHAR_TAB) {
      return false
    }
    p++
  }
  return true
}

function hasNonWs(s: string, p: number, e: number): boolean {
  return skipMask(s, p, e, F.ASCII_WS) < e
}

function findNextBlankLine(s: string, p: number): number {
  var i = nextLine(s, p)
  var doc = docFor(s)
  if (i >= doc._blankFrom && i <= doc._blankEnd) {
    return doc._blankEnd
  }
  doc._blankFrom = i
  while (i < s.length && !isBlank(s, i, lineEnd(s, i))) {
    i = nextLine(s, i)
  }
  doc._blankEnd = i < s.length ? i : s.length
  return doc._blankEnd
}

var _indentSpaces = 0
var _indentChars = 0

function indent(
  s: string,
  p: number,
  e: number,
  startCol = 0,
  maxCols = 1e9
): void {
  var col = startCol
  var n = 0
  while (col < maxCols && p + n < e) {
    var c = s.charCodeAt(p + n)
    if (c === $.CHAR_TAB) {
      col += 4 - (col % 4)
    } else if (c === $.CHAR_SPACE) {
      col++
    } else {
      break
    }
    n++
  }
  _indentSpaces = col
  _indentChars = n
}

function isBlankAfterCappedIndent(
  s: string,
  p: number,
  e: number,
  maxCols: number
): boolean {
  var i = p + _indentChars
  if (i >= e) {
    return true
  }
  if (_indentSpaces < maxCols) {
    return false
  }
  var last = s.charCodeAt(e - 1)
  return (last === $.CHAR_SPACE || last === $.CHAR_TAB) && isBlank(s, i, e)
}

function columnAt(s: string, lineStart: number, p: number): number {
  var col = 0
  for (var i = lineStart; i < p; i++) {
    col += s.charCodeAt(i) === $.CHAR_TAB ? 4 - (col % 4) : 1
  }
  return col
}

function expandTabs(
  s: string,
  p: number,
  e: number,
  absCol: number,
  leadSpaces: number
): string {
  var tab = findChar(s, p, e, $.CHAR_TAB)
  if (tab < 0) {
    return leadSpaces > 0
      ? ' '.repeat(leadSpaces) + s.slice(p, e)
      : s.slice(p, e)
  }
  var out = leadSpaces > 0 ? ' '.repeat(leadSpaces) : ''
  var col = absCol
  var seg = p
  for (var i = p; i < e; i++) {
    if (s.charCodeAt(i) === $.CHAR_TAB) {
      if (i > seg) {
        out += s.slice(seg, i)
      }
      var tw = 4 - (col % 4)
      out += ' '.repeat(tw)
      col += tw
      seg = i + 1
    } else {
      col++
    }
  }
  return seg < e ? out + s.slice(seg, e) : out
}

function dedentLine(
  s: string,
  p: number,
  e: number,
  cols: number,
  expandOnOvershoot: boolean
): string {
  var col = 0
  var i = p
  var overshoot = 0
  while (i < e && col < cols) {
    var c = s.charCodeAt(i)
    if (c === $.CHAR_TAB) {
      var tw = 4 - (col % 4)
      if (col + tw > cols) {
        overshoot = col + tw - cols
        i++
        break
      }
      col += tw
    } else if (c === $.CHAR_SPACE) {
      col++
    } else {
      break
    }
    i++
  }
  return overshoot > 0
    ? expandOnOvershoot
      ? expandTabs(s, i, e, cols + overshoot, overshoot)
      : ' '.repeat(overshoot) + s.slice(i, e)
    : s.slice(i, e)
}

function isBraceObj(v: string): boolean {
  if (v.charCodeAt(0) !== $.CHAR_BRACE_OPEN) {
    return false
  }
  var p = skipMask(v, 1, v.length, F.ASCII_WS)
  var c = p < v.length ? v.charCodeAt(p) : 0
  return c === $.CHAR_BRACKET_OPEN || c === $.CHAR_BRACE_OPEN
}

function braceArray(value: string): unknown[] | null {
  try {
    var parsed: unknown = JSON.parse(value.slice(1, -1))
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function isUnsafeStyle(value: string): boolean {
  return STYLE_XSS_R.test(
    decodeNumericEntities(util.decodeEntityReferences(value))
      .replace(CSS_COMMENT_R, '')
      .replace(CSS_ESCAPE_R, decodeCssEscape)
      .replace(CSS_NOISE_R, '')
      .toLowerCase()
  )
}

function decodeCssEscape(
  _: string,
  hex: string | undefined,
  char: string | undefined
): string {
  if (hex === undefined) {
    return char || ''
  }
  var code = Number.parseInt(hex, 16)
  return code === 0 || code > 0x10_ff_ff ? '�' : String.fromCodePoint(code)
}

function decodeNumericEntities(value: string): string {
  return value.indexOf('&#') === -1
    ? value
    : value.replace(NUMERIC_ENTITY_R, (full, body) => {
        var c0 = body.charCodeAt(0)
        var code =
          c0 === $.CHAR_x || c0 === $.CHAR_X
            ? Number.parseInt(body.slice(1), 16)
            : Number.parseInt(body, 10)
        return code > 0 && code <= 0x10_ff_ff
          ? String.fromCodePoint(code)
          : full
      })
}

var _parseOptionsForTags: ParseOptions | undefined

function hasOverride(tag: string): boolean {
  return Boolean(util.get(_parseOptionsForTags?.overrides, tag, undefined))
}

function isUnsafeUrl(
  url: string,
  quiet: boolean | undefined,
  tag: string | undefined,
  attribute: string
): boolean {
  return quiet
    ? util.urlVerdict(url) !== util.URL_VERDICT.safe ||
        (tag !== undefined && util.opensSvgAsPage(url, tag, attribute))
    : util.sanitizer(url, tag, attribute) === null
}

function isDangerousAttr(
  name: string,
  value: string,
  isComponent: boolean,
  quiet?: boolean,
  tag?: string
): boolean {
  if (
    name.charCodeAt(4) === $.CHAR_COLON &&
    util.SOLID_TARGET_PREFIX_R.test(name)
  ) {
    return isDangerousAttr(name.slice(5), value, isComponent, quiet, tag)
  }
  var lower = name.toLowerCase()
  if (RENDERER_ONLY_ATTRS.has(lower)) {
    return true
  }
  if (lower === 'srcdoc') {
    return true
  }
  var isPropBrace = isComponent && value.charCodeAt(0) === $.CHAR_BRACE_OPEN
  if (isPropBrace && value.charCodeAt(1) === $.CHAR_BRACKET_OPEN) {
    var items = braceArray(value)
    if (items) {
      return isDangerousAttr(name, String(items), isComponent, quiet, tag)
    }
  }
  if (lower === 'attributename') {
    if (isPropBrace && isBraceObj(value)) {
      return false
    }
    var target = decodeNumericEntities(util.decodeEntityReferences(value))
      .replace(BRACE_NAME_WRAPPER_R, '')
      .trim()
      .toLowerCase()
    target = target.slice(target.lastIndexOf(':') + 1)
    return URL_BEARING_ATTRS.has(target) || target.slice(0, 2) === 'on'
  }
  if (
    isPropBrace &&
    !util.isHandlerName(name) &&
    (!URL_BEARING_ATTRS.has(lower) || isBraceObj(value))
  ) {
    return false
  }
  if (util.isHandlerName(name)) {
    return !(isComponent && value === '')
  }
  if (lower === 'style') {
    return isUnsafeStyle(value)
  }
  if (URL_BEARING_ATTRS.has(lower) || lower === 'content') {
    var decoded = decodeNumericEntities(util.decodeEntityReferences(value))
    var delay = decoded.charCodeAt(
      skipMask(decoded, 0, decoded.length, F.ASCII_WS)
    )
    if (
      lower === 'content' &&
      !isCF(delay, F.DIGIT) &&
      delay !== $.CHAR_PERIOD
    ) {
      return false
    }
    if (lower === 'content') {
      decoded = decoded.replace(REFRESH_URL_PREFIX_R, '')
    }
    if (isUnsafeUrl(decoded, quiet, tag, lower)) {
      return true
    }
    var normalized = decoded.replace(CONTROL_CHARS_R, '')
    return normalized !== decoded && isUnsafeUrl(normalized, quiet, tag, lower)
  }
  return false
}

function reconstructOpenTag(t: ParsedHtmlTag, rawAttrs?: string): string {
  return (
    '<' +
    (t._isClosing ? '/' : '') +
    t._tag +
    t._wsBefore +
    (rawAttrs === undefined ? t._rawAttrs : rawAttrs) +
    (t._selfClosing ? (t._hasSpaceBeforeSlash ? ' />' : '/>') : '>')
  )
}

function buildSafeRawAttrs(
  source: string,
  from: number,
  to: number,
  dangerSpans: number[],
  keptStarts?: number[]
): string {
  var parts: string[] = []
  var cursor = from
  for (var k = 0; k < dangerSpans.length; k += 2) {
    if (keptStarts !== undefined && keptStarts.indexOf(dangerSpans[k]) !== -1) {
      continue
    }
    var seg =
      dangerSpans[k] > cursor ? source.slice(cursor, dangerSpans[k]).trim() : ''
    if (seg) {
      parts.push(seg)
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

var HIDDEN_TAG_READ_LIMIT = 1024
var _browserTagUnsafe = false

export function browserTagEnd(
  html: string,
  lt: number,
  ownAttrs: Record<string, string> | null,
  hiddenEnd?: number
): number {
  var len = hiddenEnd === undefined ? html.length : hiddenEnd
  var i = scanUntil(html, lt + 2, len, F.ASCII_WS | F.SLASH_GT)
  var tagName = html.slice(lt + 1, i)
  var hiddenReadEnd = 0
  _browserTagUnsafe = false
  while (i < len) {
    var c = html.charCodeAt(i)
    if (c === $.CHAR_GT) {
      _browserTagUnsafe = _browserTagUnsafe || hiddenReadEnd > i + 1
      return i + 1
    }
    if (isCF(c, F.ASCII_WS) || c === $.CHAR_SLASH) {
      i++
      continue
    }
    var nameStart = i
    i = scanUntil(html, i + 1, len, F.ASCII_WS | F.SLASH_GT | F.EQ_GT)
    var name = html.slice(nameStart, i)
    i = skipMask(html, i, len, F.ASCII_WS)
    var value = ''
    var quotedStart = -1
    if (i < len && html.charCodeAt(i) === $.CHAR_EQ) {
      i = skipMask(html, i + 1, len, F.ASCII_WS)
      var quote = html.charCodeAt(i)
      if (quote === $.CHAR_DOUBLE_QUOTE || quote === $.CHAR_SINGLE_QUOTE) {
        quotedStart = ++i
        var qEnd = findChar(html, i, len, quote)
        i = qEnd === -1 ? len : qEnd
        value = html.slice(quotedStart, i)
        i++
      } else {
        var valueStart = i
        i = scanUntil(html, i, len, F.ASCII_WS | F.EQ_GT)
        while (i < len && html.charCodeAt(i) === $.CHAR_EQ) {
          i = scanUntil(html, i + 1, len, F.ASCII_WS | F.EQ_GT)
        }
        value = html.slice(valueStart, i)
      }
    }
    if (!_browserTagUnsafe) {
      var ownValue =
        ownAttrs === null ? undefined : util.overrideValue(ownAttrs, name)
      _browserTagUnsafe = isDangerousAttr(
        name,
        value,
        ownValue?.startsWith(value) === true,
        true,
        tagName
      )
    }
    if (hiddenEnd === undefined && quotedStart !== -1) {
      for (
        var hidden = value.indexOf('<');
        hidden !== -1 && !_browserTagUnsafe;
        hidden = value.indexOf('<', hidden + 1)
      ) {
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
      }
    }
  }
  _browserTagUnsafe = true
  return len
}

function withBrowserReadSpans(
  source: string,
  pos: number,
  end: number,
  ownAttrs: Record<string, string> | null,
  dangerSpans: number[] | null,
  readSpans: number[]
): number[] | null {
  var capped = source.slice(0, end + HIDDEN_TAG_READ_LIMIT)
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

interface ParsedHtmlTag {
  _attrs: Record<string, string>
  _browserReadDiffers: boolean
  _end: number
  _hasSpaceBeforeSlash: boolean
  _isClosing: boolean
  _isComponent: boolean
  _isComponentTag: boolean
  _rawAttrs: string
  _rawAttrsKeepingProps: string | undefined
  _sanitized: boolean
  _selfClosing: boolean
  _tag: string
  _wsBefore: string
}

function __parseHtmlTag(
  source: string,
  pos: number,
  quiet?: boolean,
  forRawScreen?: boolean
): ParsedHtmlTag | null {
  if (source.charCodeAt(pos) !== $.CHAR_LT) {
    return null
  }
  var len = source.length
  var isClosing = source.charCodeAt(pos + 1) === $.CHAR_SLASH
  var i = pos + (isClosing ? 2 : 1)
  var nameEnd = scanTagName(source, i, len)
  if (nameEnd === i) {
    return null
  }
  var tag = source.slice(i, nameEnd)
  i = nameEnd

  var tagFirst = tag.charCodeAt(0)
  var isCapitalized = tagFirst >= $.CHAR_A && tagFirst <= $.CHAR_Z
  var isComponentTag = isCapitalized || tag.indexOf('-') !== -1
  var isComponent = isCapitalized && hasOverride(tag)

  var wsStart = i
  i = skipMask(source, i, len, F.WSNL)
  var wsBefore = source.slice(wsStart, i)
  if (i === wsStart && i < len && !isCF(source.charCodeAt(i), F.SLASH_GT)) {
    return null
  }

  var attrStartPos = i
  var attrs: Record<string, string> = {}
  var dangerSpans: number[] | null = null
  var readSpans: number[] | null = null
  var keptPropStarts: number[] | undefined

  while ((i = skipMask(source, i, len, F.WSNL)) < len) {
    var c = source.charCodeAt(i)
    var isSelfClose =
      c === $.CHAR_SLASH &&
      i + 1 < len &&
      source.charCodeAt(i + 1) === $.CHAR_GT
    if (c === $.CHAR_GT || isSelfClose) {
      var endPos = i + (isSelfClose ? 2 : 1)
      if (readSpans !== null && !forRawScreen) {
        dangerSpans = withBrowserReadSpans(
          source,
          pos,
          endPos,
          isComponent ? attrs : null,
          dangerSpans,
          readSpans
        )
      }
      return {
        _attrs: attrs,
        _browserReadDiffers: readSpans !== null,
        _end: endPos,
        _hasSpaceBeforeSlash:
          isSelfClose &&
          i > attrStartPos &&
          source.charCodeAt(i - 1) === $.CHAR_SPACE,
        _isClosing: isClosing,
        _isComponent: isComponent,
        _isComponentTag: isComponentTag,
        _rawAttrs: dangerSpans
          ? buildSafeRawAttrs(source, attrStartPos, i, dangerSpans)
          : source.slice(attrStartPos, i),
        _rawAttrsKeepingProps:
          keptPropStarts === undefined || dangerSpans === null
            ? undefined
            : buildSafeRawAttrs(
                source,
                attrStartPos,
                i,
                dangerSpans,
                keptPropStarts
              ),
        _sanitized: dangerSpans != null,
        _selfClosing: isSelfClose,
        _tag: tag,
        _wsBefore: wsBefore,
      }
    }

    var attrStart = i
    if (!isASCIILetter(c) && c !== $.CHAR_UNDERSCORE && c !== $.CHAR_COLON) {
      return null
    }
    i = skipMask(source, i + 1, len, F.ATTR)
    var attrName = source.slice(attrStart, i)
    var attrEnd = i
    i = skipMask(source, i, len, F.WS)

    var attrValue = ''
    var valueReadsDifferently = false
    if (source.charCodeAt(i) === $.CHAR_EQ) {
      i = skipMask(source, i + 1, len, F.WS)
      var quote = source.charCodeAt(i)
      var valStart: number
      if (quote === $.CHAR_DOUBLE_QUOTE || quote === $.CHAR_SINGLE_QUOTE) {
        valStart = ++i
        var qEnd = source.indexOf(
          quote === $.CHAR_DOUBLE_QUOTE ? '"' : "'",
          valStart
        )
        if (qEnd === -1) {
          return null
        }
        for (
          var ltIn = findChar(source, valStart, qEnd, $.CHAR_LT);
          ltIn !== -1;
          ltIn = findChar(source, ltIn + 1, qEnd, $.CHAR_LT)
        ) {
          if (isASCIILetter(source.charCodeAt(ltIn + 1))) {
            valueReadsDifferently = true
            break
          }
        }
        attrValue = source.slice(valStart, qEnd)
        i = qEnd + 1
        if (i < len && !isCF(source.charCodeAt(i), F.WSNL | F.SLASH_GT)) {
          return null
        }
      } else if (quote === $.CHAR_BRACE_OPEN) {
        valStart = i++
        var depth = 1
        while (i < len && depth > 0) {
          var bc = source.charCodeAt(i++)
          if (bc === $.CHAR_BRACE_OPEN) {
            depth++
          } else if (bc === $.CHAR_BRACE_CLOSE) {
            depth--
          } else if (
            isCF(bc, F.ASCII_WS) ||
            bc === $.CHAR_GT ||
            bc === $.CHAR_DOUBLE_QUOTE ||
            bc === $.CHAR_SINGLE_QUOTE
          ) {
            valueReadsDifferently = true
          }
        }
        attrValue = source.slice(valStart, i)
      } else {
        valStart = i
        i = scanUntil(source, i, len, F.UNQUOTED_STOP)
        if (i === valStart) {
          return null
        }
        attrValue = source.slice(valStart, i)
      }
      attrEnd = i
    }

    if (isDangerousAttr(attrName, attrValue, isComponent, quiet, tag)) {
      ;(dangerSpans || (dangerSpans = [])).push(attrStart, attrEnd)
      var attrLower = attrName.toLowerCase()
      if (
        util.isHandlerName(attrName) &&
        hasOverride(tag) &&
        (!isCapitalized || attrValue.charCodeAt(0) === $.CHAR_BRACE_OPEN)
      ) {
        attrs[attrName] = attrValue
        if (isCapitalized) {
          ;(keptPropStarts || (keptPropStarts = [])).push(attrStart)
        }
      } else if (
        attrLower === 'children' &&
        !isBraceObj(attrValue) &&
        hasOverride(tag)
      ) {
        attrs.children = attrValue
        ;(keptPropStarts || (keptPropStarts = [])).push(attrStart)
      }
      if (
        process.env.NODE_ENV !== 'production' &&
        !quiet &&
        attrLower === 'style'
      ) {
        console.warn(
          'Style attribute contains an unsafe URL expression, it will not be rendered.',
          attrValue
        )
      }
    } else {
      attrs[attrName] = attrValue
      if (valueReadsDifferently) {
        ;(readSpans || (readSpans = [])).push(attrStart, attrEnd)
      }
    }
  }
  return null
}

var _keptProps: string | undefined

function bareTagEnd(html: string, lt: number): number {
  var i = lt + 1 + (html.charCodeAt(lt + 1) === $.CHAR_SLASH ? 1 : 0)
  var end = scanTagName(html, i, html.length)
  return end > i && html.charCodeAt(end) === $.CHAR_GT ? end + 1 : -1
}

function screenRawTags(
  html: string,
  quiet: boolean | undefined,
  captureKeep?: boolean
): string {
  var lt = html.indexOf('<')
  if (lt === -1) {
    return html
  }
  var out = ''
  var keeping: string | undefined
  var replacement: string | undefined
  var keptReplacement: string | undefined
  var cursor = 0
  var changed = false
  while (lt !== -1) {
    var c1 = html.charCodeAt(lt + 1)
    if (
      !(
        isASCIILetter(c1) ||
        (c1 === $.CHAR_SLASH && isASCIILetter(html.charCodeAt(lt + 2)))
      )
    ) {
      lt = html.indexOf('<', lt + 1)
      continue
    }
    var bareEnd = bareTagEnd(html, lt)
    if (bareEnd !== -1) {
      lt = html.indexOf('<', bareEnd)
      continue
    }
    var tagResult = __parseHtmlTag(html, lt, quiet, true)
    var nextEnd: number
    replacement = undefined
    keptReplacement = undefined
    if (
      tagResult?._sanitized &&
      tagResult._browserReadDiffers &&
      tagResult._isComponent
    ) {
      replacement = screenRawTags(reconstructOpenTag(tagResult), quiet)
      nextEnd = tagResult._end
    } else if (tagResult && !tagResult._browserReadDiffers) {
      nextEnd = tagResult._end
      if (tagResult._sanitized) {
        replacement = reconstructOpenTag(tagResult)
        if (tagResult._rawAttrsKeepingProps !== undefined) {
          keptReplacement = reconstructOpenTag(
            tagResult,
            tagResult._rawAttrsKeepingProps
          )
        }
      }
    } else if (tagResult || isASCIILetter(html.charCodeAt(lt + 1))) {
      nextEnd = browserTagEnd(
        html,
        tagResult?._isClosing ? lt + 1 : lt,
        tagResult?._isComponent ? tagResult._attrs : null
      )
      if (_browserTagUnsafe) {
        replacement = html.slice(lt, nextEnd).replace(LT_R, '&lt;')
      }
    } else {
      lt = html.indexOf('<', lt + 1)
      continue
    }
    if (replacement !== undefined) {
      var gap = html.slice(cursor, lt)
      if (
        keeping === undefined &&
        keptReplacement !== undefined &&
        captureKeep
      ) {
        keeping = out
      }
      out += gap + replacement
      if (keeping !== undefined) {
        keeping +=
          gap + (keptReplacement === undefined ? replacement : keptReplacement)
      }
      cursor = nextEnd
      changed = true
    }
    lt = html.indexOf('<', nextEnd)
  }
  if (!changed) {
    return html
  }
  var rest = html.slice(cursor)
  if (keeping !== undefined && captureKeep) {
    _keptProps = keeping + rest
  }
  return out + rest
}

export function stripDangerousHtml(
  html: string,
  quiet?: boolean,
  captureKeep?: boolean
): string {
  var once = screenRawTags(html, quiet, captureKeep)
  if (once === html) {
    return html
  }
  if (screenRawTags(once, true) === once) {
    return once
  }
  if (captureKeep) {
    _keptProps = undefined
  }
  return once.replace(LT_R, '&lt;')
}

function screenKeep(raw: string): string {
  _keptProps = undefined
  return stripDangerousHtml(raw, undefined, true)
}

var _scannedDest = ''
var _scannedTitle = ''
var _urlFailFrom = 0
var _urlFailGen = 0
var _linkNoCloseFrom = 0
var _linkNoCloseGen = 0
var _scanGeneration = 0
var _scanGen = 0
var _linkTextMatch: Int32Array | null = null
var _linkTextMatchShift = 0
var _nestedLinkTextShift = -1
const _linkBracketStack: number[] = []
const LINK_TEXT_MEMO_MIN_SPAN = 256

function nextScanGeneration(): number {
  if (_scanGeneration === 0x7f_ff_ff_ff) {
    _urlFailGen = _linkNoCloseGen = _scanGeneration = 0
  }
  return ++_scanGeneration
}

function scanBracketLabelEnd(s: string, p: number, e: number): number {
  for (var i = p; i < e; ) {
    var c = s.charCodeAt(i)
    if (c === $.CHAR_BRACKET_CLOSE) {
      return i
    }
    if (c === $.CHAR_BRACKET_OPEN) {
      return -1
    }
    i += c === $.CHAR_BACKSLASH && i + 1 < e ? 2 : 1
  }
  return -1
}

function scanLinkDest(
  s: string,
  p: number,
  e: number,
  isRefDef: boolean,
  useFailMemo: boolean
): number {
  var i = p
  if (i < e && s.charCodeAt(i) === $.CHAR_LT) {
    var start = ++i
    while (i < e) {
      var c = s.charCodeAt(i)
      if (c === $.CHAR_GT) {
        _scannedDest = s.slice(start, i)
        return i + 1
      }
      if (c === $.CHAR_NEWLINE) {
        return -1
      }
      i +=
        c === $.CHAR_BACKSLASH &&
        i + 1 < e &&
        s.charCodeAt(i + 1) !== $.CHAR_NEWLINE
          ? 2
          : 1
    }
    return -1
  }
  if (useFailMemo && _urlFailGen === _scanGen && i >= _urlFailFrom) {
    return -1
  }
  var parens = 0
  var sawClose = false
  while (i < e) {
    var c2 = s.charCodeAt(i)
    if (
      c2 === $.CHAR_BACKSLASH &&
      i + 1 < e &&
      !(isRefDef && isCF(s.charCodeAt(i + 1), F.WSNL))
    ) {
      i += 2
      continue
    }
    if (c2 === $.CHAR_PAREN_OPEN) {
      parens++
    } else if (c2 === $.CHAR_PAREN_CLOSE) {
      sawClose = true
      if (parens === 0) {
        break
      }
      parens--
    } else if (
      c2 === $.CHAR_SPACE ||
      c2 === $.CHAR_NEWLINE ||
      (isRefDef && c2 === $.CHAR_TAB)
    ) {
      break
    }
    i++
  }
  if (
    useFailMemo &&
    i >= e &&
    !sawClose &&
    (_urlFailGen !== _scanGen || p < _urlFailFrom)
  ) {
    _urlFailFrom = p
    _urlFailGen = _scanGen
  }
  if (isRefDef && i === p) {
    return -1
  }
  _scannedDest = s.slice(p, i)
  return i
}

function scanLinkTitle(
  s: string,
  p: number,
  e: number,
  disallowBlankLine: boolean
): number {
  var tc = p < e ? s.charCodeAt(p) : 0
  if (
    tc !== $.CHAR_DOUBLE_QUOTE &&
    tc !== $.CHAR_SINGLE_QUOTE &&
    tc !== $.CHAR_PAREN_OPEN
  ) {
    return -1
  }
  var closeCh = tc === $.CHAR_PAREN_OPEN ? $.CHAR_PAREN_CLOSE : tc
  for (var i = p + 1; i < e; ) {
    var c = s.charCodeAt(i)
    if (c === closeCh) {
      _scannedTitle = s.slice(p + 1, i)
      return i + 1
    }
    if (c === $.CHAR_BACKSLASH && i + 1 < e) {
      i += 2
      continue
    }
    if (
      disallowBlankLine &&
      c === $.CHAR_NEWLINE &&
      i + 1 < e &&
      s.charCodeAt(i + 1) === $.CHAR_NEWLINE
    ) {
      return -1
    }
    i++
  }
  return -1
}

function parseRefDef(
  s: string,
  p: number,
  refs: { [key: string]: { target: string; title: string | undefined } }
): number | null {
  var len = s.length
  if (s.charCodeAt(p) !== $.CHAR_BRACKET_OPEN) {
    return null
  }
  var closeBr = scanBracketLabelEnd(s, p + 1, len)
  if (closeBr === -1) {
    return null
  }
  var rawLabel = dropLazyMarkers(s.slice(p + 1, closeBr))
  var label = rawLabel.length <= 999 ? normalizeLabel(rawLabel) : ''
  var i = closeBr + 1
  if (!label || i >= len || s.charCodeAt(i) !== $.CHAR_COLON) {
    return null
  }
  i++

  var hasNl = false
  while (i < len) {
    var wc = s.charCodeAt(i)
    if (wc === $.CHAR_SPACE || wc === $.CHAR_TAB) {
      i++
    } else if (wc === $.CHAR_NEWLINE && !hasNl) {
      hasNl = true
      i++
    } else if (wc === $.CHAR_RECORD_SEP && hasNl) {
      i++
    } else {
      break
    }
  }

  var isAngle = i < len && s.charCodeAt(i) === $.CHAR_LT
  var destEnd = scanLinkDest(s, i, len, true, false)
  if (destEnd < 0) {
    return null
  }
  var url = _scannedDest
  var eol = lineEnd(s, destEnd)
  var wsEnd = skipMask(s, destEnd, eol, F.WS)
  if (isAngle && wsEnd < eol) {
    var tc2 = s.charCodeAt(wsEnd)
    if (
      wsEnd === destEnd ||
      (tc2 !== $.CHAR_DOUBLE_QUOTE &&
        tc2 !== $.CHAR_SINGLE_QUOTE &&
        tc2 !== $.CHAR_PAREN_OPEN)
    ) {
      return null
    }
  }

  var tryTitleAt =
    wsEnd === eol && wsEnd < len
      ? skipMask(
          s,
          s.charCodeAt(wsEnd + 1) === $.CHAR_RECORD_SEP ? wsEnd + 2 : wsEnd + 1,
          len,
          F.WS
        )
      : wsEnd
  var titleEnd = scanLinkTitle(s, tryTitleAt, len, true)
  var title: string | undefined
  var titleParsed = false
  var resultEnd = eol < len ? eol + 1 : len
  if (titleEnd >= 0) {
    var afterTitle = skipMask(s, titleEnd, len, F.WS)
    if (afterTitle >= len || s.charCodeAt(afterTitle) === $.CHAR_NEWLINE) {
      title = dropLazyMarkers(_scannedTitle)
      titleParsed = true
      resultEnd = afterTitle < len ? afterTitle + 1 : len
    }
  }
  if (!titleParsed && tryTitleAt === wsEnd && wsEnd < eol) {
    return null
  }
  if (!refs[label]) {
    refs[label] = {
      target: util.decodeEntityReferences(unescapeString(url)),
      title:
        title === undefined
          ? undefined
          : util.decodeEntityReferences(unescapeString(title)),
    }
  }
  return resultEnd
}

var _fenceNeedleCh = 0
var _fenceNeedleLen = 0
var _fenceNeedleStr = ''
var _fenceCloseEnd = 0

function findFenceClose(
  s: string,
  from: number,
  fence: number,
  fenceLen: number
): number {
  var needle =
    fence === _fenceNeedleCh && fenceLen === _fenceNeedleLen
      ? _fenceNeedleStr
      : ((_fenceNeedleCh = fence),
        (_fenceNeedleLen = fenceLen),
        (_fenceNeedleStr = String.fromCharCode(fence).repeat(fenceLen)))
  for (var searchPos = from; searchPos < s.length; ) {
    var cand = s.indexOf(needle, searchPos)
    if (cand === -1) {
      break
    }
    var ls = cand
    while (ls > 0 && cand - ls < 4 && s.charCodeAt(ls - 1) === $.CHAR_SPACE) {
      ls--
    }
    if (
      cand - ls <= 3 &&
      (ls === 0 || s.charCodeAt(ls - 1) === $.CHAR_NEWLINE)
    ) {
      var runEnd =
        cand + fenceLen + countChar(s, cand + fenceLen, s.length, fence)
      var closeLe = lineEnd(s, runEnd)
      if (isBlank(s, runEnd, closeLe)) {
        _fenceCloseEnd = nextLine(s, closeLe)
        return ls
      }
    }
    searchPos = cand + 1
  }
  _fenceCloseEnd = s.length
  return -1
}

export function collectReferenceDefinitions(
  input: string,
  refs: { [key: string]: { target: string; title: string | undefined } },
  _options: ParseOptions
): boolean {
  if (!_options.optimizeForStreaming && input.indexOf('[') === -1) {
    return false
  }
  var pos = 0
  var len = input.length
  var prevWasContent = false
  var endsInsideFence = false

  while (pos < len) {
    var end = lineEnd(input, pos)
    indent(input, pos, end)
    var i = pos + _indentChars
    if (i >= end) {
      prevWasContent = false
      pos = end < len ? end + 1 : len
      continue
    }
    var spaces = _indentSpaces
    if (spaces < 4) {
      var fenceLen = fenceOpenLen(input, i, end)
      if (fenceLen >= 3) {
        prevWasContent = false
        var fc = findFenceClose(
          input,
          end < len ? end + 1 : len,
          input.charCodeAt(i),
          fenceLen
        )
        endsInsideFence = fc === -1
        pos = _fenceCloseEnd
        continue
      }
    }

    var ri = i
    while (ri < end && input.charCodeAt(ri) === $.CHAR_GT) {
      ri += ri + 1 < end && input.charCodeAt(ri + 1) === $.CHAR_SPACE ? 2 : 1
      indent(input, ri, end)
      ri += _indentChars
      if (_indentSpaces >= 4) {
        break
      }
      prevWasContent = false
    }

    if (
      !prevWasContent &&
      spaces < 4 &&
      ri < end &&
      input.charCodeAt(ri) === $.CHAR_BRACKET_OPEN &&
      !(ri + 1 < len && input.charCodeAt(ri + 1) === $.CHAR_CARET)
    ) {
      var res = parseRefDef(input, ri, refs)
      if (res) {
        pos = res
        prevWasContent = false
        continue
      }
    }

    prevWasContent = !(
      spaces < 4 &&
      (input.charCodeAt(i) === $.CHAR_HASH || isThematicBreak(input, i, end))
    )
    pos = end < len ? end + 1 : len
  }
  return endsInsideFence
}

function atxLevel(s: string, i: number, e: number, opts: ParseOptions): number {
  if (s.charCodeAt(i) !== $.CHAR_HASH) {
    return 0
  }
  var level = countChar(s, i, e, $.CHAR_HASH)
  var after = i + level
  return level >= 1 &&
    level <= 6 &&
    (opts.enforceAtxHeadings === false ||
      after >= e ||
      isCF(s.charCodeAt(after), F.WS))
    ? level
    : 0
}

function setextLevel(s: string, i: number, e: number): number {
  var c = s.charCodeAt(i)
  return (c === $.CHAR_EQ || c === $.CHAR_DASH) &&
    isBlank(s, i + countChar(s, i, e, c), e)
    ? c === $.CHAR_EQ
      ? 1
      : 2
    : 0
}

var _thematicBreakRejectedAt = -1

function isThematicBreak(s: string, i: number, e: number): boolean {
  var ch = s.charCodeAt(i)
  if (
    ch !== $.CHAR_DASH &&
    ch !== $.CHAR_ASTERISK &&
    ch !== $.CHAR_UNDERSCORE
  ) {
    return false
  }
  var count = 0
  for (var p = i; p < e; p++) {
    var c = s.charCodeAt(p)
    if (c === ch) {
      count++
    } else if (c !== $.CHAR_SPACE && c !== $.CHAR_TAB) {
      _thematicBreakRejectedAt = p
      return false
    }
  }
  return count >= 3
}

function fenceOpenLen(s: string, i: number, e: number): number {
  var ch = s.charCodeAt(i)
  if (ch !== $.CHAR_BACKTICK && ch !== $.CHAR_TILDE) {
    return 0
  }
  var n = countChar(s, i, e, ch)
  if (
    n < 3 ||
    (ch === $.CHAR_BACKTICK && findChar(s, i + n, e, $.CHAR_BACKTICK) !== -1)
  ) {
    return 0
  }
  return n
}

// biome-ignore lint/suspicious/noConstEnum: the bundler inlines const enum members; a plain const would stay a variable in the minified dist
const enum LineBlockMode {
  ParagraphEnd = 0,
  QuoteLazyLine = 1,
  ListLazyLine = 2,
  TableRowEnd = 3,
}

function lineStartsBlock(
  s: string,
  lineStart: number,
  i: number,
  le: number,
  mode: LineBlockMode,
  opts: ParseOptions
): boolean {
  var c = i < le ? s.charCodeAt(i) : 0
  if (c === $.CHAR_GT) {
    return true
  }
  if (c === $.CHAR_HASH) {
    return mode === LineBlockMode.ParagraphEnd
      ? atxLevel(s, i, le, opts) > 0
      : true
  }
  if (c === $.CHAR_BACKTICK || c === $.CHAR_TILDE) {
    return mode === LineBlockMode.ParagraphEnd ||
      mode === LineBlockMode.TableRowEnd
      ? countChar(s, i, le, c) >= 3
      : true
  }
  if (c === $.CHAR_LT && mode !== LineBlockMode.TableRowEnd) {
    return mode === LineBlockMode.ParagraphEnd
      ? !(opts.ignoreHTMLBlocks || opts.disableParsingRawHTML) &&
          matchAutolinkEnd(s, i, le) === -1 &&
          detectHtmlBlockType(s, i, true) !== 0
      : true
  }
  if (
    (c === $.CHAR_DASH || c === $.CHAR_ASTERISK || c === $.CHAR_UNDERSCORE) &&
    isThematicBreak(s, i, le)
  ) {
    return mode === LineBlockMode.ParagraphEnd
      ? c !== $.CHAR_DASH || setextLevel(s, i, le) === 0
      : true
  }
  if (mode === LineBlockMode.TableRowEnd) {
    return false
  }
  if (c === $.CHAR_DASH || c === $.CHAR_ASTERISK || c === $.CHAR_PLUS) {
    return mode === LineBlockMode.ParagraphEnd
      ? i + 1 < le && isCF(s.charCodeAt(i + 1), F.WS) && !isBlank(s, i + 1, le)
      : checkListMarker(s, lineStart, le) !== null
  }
  if (c >= $.CHAR_DIGIT_0 && c <= $.CHAR_DIGIT_9) {
    if (mode === LineBlockMode.ParagraphEnd) {
      return (
        c === $.CHAR_DIGIT_1 &&
        i + 2 < le &&
        (s.charCodeAt(i + 1) === $.CHAR_PERIOD ||
          s.charCodeAt(i + 1) === $.CHAR_PAREN_CLOSE) &&
        isCF(s.charCodeAt(i + 2), F.WS) &&
        !isBlank(s, i + 2, le)
      )
    }
    if (mode === LineBlockMode.QuoteLazyLine) {
      var oi = skipMask(s, i, le, F.DIGIT)
      return (
        oi < le &&
        (s.charCodeAt(oi) === $.CHAR_PERIOD ||
          s.charCodeAt(oi) === $.CHAR_PAREN_CLOSE)
      )
    }
    return checkListMarker(s, lineStart, le) !== null
  }
  if (c === $.CHAR_PIPE && mode === LineBlockMode.ParagraphEnd) {
    var third = nextLine(s, le)
    return (
      third < s.length &&
      parseDelimiterRow(s, third, lineEnd(s, third)) !== null
    )
  }
  return false
}

var _containers: number[] = []
var _depth = 0
var _emptyItem = false

// biome-ignore lint/suspicious/noConstEnum: the bundler inlines const enum members; a plain const would stay a variable in the minified dist
const enum OpenState {
  None = 0,
  Paragraph = 1,
  HtmlBlockType6Or7 = 2,
  Table = 3,
  RawHtmlBase = 3,
}

// biome-ignore lint/suspicious/noConstEnum: the bundler inlines const enum members; a plain const would stay a variable in the minified dist
const enum OpenEncoding {
  FenceLengthShift = 7,
  FenceLengthUnit = 1 << FenceLengthShift,
  FenceCharMask = FenceLengthUnit - 1,
  RawHtmlLastType = 5,
}

function openAfter(open: number, s: string, opts: ParseOptions): number {
  var e = s.length
  if (s.charCodeAt(0) === $.CHAR_RECORD_SEP) {
    return open
  }
  var p = 0
  var matched = 0
  for (; matched < _depth; matched++) {
    indent(s, p, e)
    var q = p + _indentChars
    var width = _containers[matched]
    if (width === 0) {
      if (_indentSpaces > 3 || s.charCodeAt(q) !== $.CHAR_GT) {
        break
      }
      p = q + (s.charCodeAt(q + 1) === $.CHAR_SPACE ? 2 : 1)
    } else if (q < e) {
      if (_indentChars !== _indentSpaces || _indentSpaces < width) {
        break
      }
      p += width
    } else if (_emptyItem && matched === _depth - 1) {
      break
    }
  }
  _emptyItem = false

  if (matched < _depth) {
    indent(s, p, e)
    var unmatchedQuote = false
    for (var u = matched; u < _depth; u++) {
      unmatchedQuote = unmatchedQuote || _containers[u] === 0
    }
    if (
      open === OpenState.Paragraph &&
      p + _indentChars < e &&
      !(
        _indentSpaces < 4 &&
        lineStartsBlock(
          s,
          p,
          p + _indentChars,
          e,
          unmatchedQuote
            ? LineBlockMode.QuoteLazyLine
            : LineBlockMode.ListLazyLine,
          opts
        )
      )
    ) {
      return open
    }
    _depth = matched
    open = OpenState.None
  }

  var leafOpen =
    open < 0 ||
    open === OpenState.HtmlBlockType6Or7 ||
    open > OpenState.RawHtmlBase
  var opened = 0
  var rejectedChar = 0
  var rejectedAt = -1
  while (!leafOpen) {
    indent(s, p, e)
    var at = p + _indentChars
    if (_indentSpaces > 3) {
      break
    }
    var qc = s.charCodeAt(at)
    if (qc === $.CHAR_GT) {
      p = at + (s.charCodeAt(at + 1) === $.CHAR_SPACE ? 2 : 1)
      _containers[_depth++] = 0
      opened++
      continue
    }
    var isBreak = false
    if (qc !== rejectedChar || at >= rejectedAt) {
      _thematicBreakRejectedAt = -1
      isBreak = isThematicBreak(s, at, e)
      rejectedChar = qc
      rejectedAt = _thematicBreakRejectedAt
    }
    var marker = isBreak ? null : checkListMarker(s, p, e)
    if (
      !marker ||
      (open === OpenState.Paragraph &&
        !opened &&
        (marker._isEmpty || (marker._ordered && marker._start !== 1)))
    ) {
      break
    }
    p = marker._contentStart
    _containers[_depth++] = marker._contentCol
    _emptyItem = marker._isEmpty
    opened++
  }

  if (opened && (open === OpenState.Paragraph || open === OpenState.Table)) {
    open = OpenState.None
  }

  indent(s, p, e)
  var spaces = _indentSpaces
  var i = p + _indentChars
  var c = s.charCodeAt(i)
  if (i >= e) {
    return open < 0 || open > OpenState.RawHtmlBase ? open : OpenState.None
  }
  if (open < 0) {
    var run = countChar(s, i, e, c)
    return spaces < 4 &&
      c === (-open & OpenEncoding.FenceCharMask) &&
      run >= -open >> OpenEncoding.FenceLengthShift &&
      isBlank(s, i + run, e)
      ? OpenState.None
      : open
  }
  if (open > OpenState.RawHtmlBase) {
    return rawBlockEnds(open - OpenState.RawHtmlBase, s, i, e)
      ? OpenState.None
      : open
  }
  if (open === OpenState.HtmlBlockType6Or7) {
    return OpenState.HtmlBlockType6Or7
  }
  if (
    open === OpenState.Table &&
    (spaces > 3 ||
      !lineStartsBlock(s, p, i, e, LineBlockMode.TableRowEnd, opts))
  ) {
    return OpenState.Table
  }
  if (spaces > 3) {
    return open === OpenState.Paragraph ? OpenState.Paragraph : OpenState.None
  }

  var fenceLen = fenceOpenLen(s, i, e)
  if (fenceLen) {
    return -(fenceLen * OpenEncoding.FenceLengthUnit + c)
  }
  if (
    atxLevel(s, i, e, opts) > 0 ||
    isThematicBreak(s, i, e) ||
    (open === OpenState.Paragraph && setextLevel(s, i, e) > 0)
  ) {
    return OpenState.None
  }
  if (
    c === $.CHAR_LT &&
    !(opts.ignoreHTMLBlocks || opts.disableParsingRawHTML) &&
    matchAutolinkEnd(s, i, e) === -1
  ) {
    var type = detectHtmlBlockType(s, i, open === OpenState.Paragraph)
    if (!type && open !== OpenState.Paragraph && matchType1At(s, i, true)) {
      type = isBlank(s, s.indexOf('>', i) + 1, e) ? 7 : 0
    }
    if (type) {
      return type > OpenEncoding.RawHtmlLastType
        ? OpenState.HtmlBlockType6Or7
        : rawBlockEnds(type, s, i, e)
          ? OpenState.None
          : OpenState.RawHtmlBase + type
    }
  }
  return open === OpenState.Paragraph &&
    findChar(s, i, e, $.CHAR_PIPE) !== -1 &&
    parseDelimiterRow(s, p, e) !== null
    ? OpenState.Table
    : OpenState.Paragraph
}

function openAfterLines(
  open: number,
  raw: string,
  from: number,
  opts: ParseOptions
): number {
  while (from < raw.length) {
    var le = raw.indexOf('\n', from)
    open = openAfter(open, raw.slice(from, le), opts)
    from = le + 1
  }
  return open
}

function rawBlockEnds(type: number, s: string, i: number, e: number): boolean {
  if (type > 1) {
    var end = s.indexOf(
      type === 2 ? '-->' : type === 3 ? '?>' : type === 4 ? '>' : ']]>',
      i
    )
    return end !== -1 && end < e
  }
  for (
    var at = s.indexOf('</', i);
    at !== -1 && at < e;
    at = s.indexOf('</', at + 1)
  ) {
    if (matchType1At(s, at, true)) {
      return true
    }
  }
  return false
}

function parseDelimiterRow(
  s: string,
  start: number,
  end: number
): Array<'left' | 'right' | 'center' | null> | null {
  var i = skipMask(s, start, end, F.WS)
  if (i >= end) {
    return null
  }
  if (s.charCodeAt(i) === $.CHAR_PIPE) {
    i++
  }
  var align: Array<'left' | 'right' | 'center' | null> = []
  while ((i = skipMask(s, i, end, F.WS)) < end) {
    if (
      s.charCodeAt(i) === $.CHAR_PIPE &&
      align.length > 0 &&
      isBlank(s, i + 1, end)
    ) {
      return align
    }
    var hasLeft = s.charCodeAt(i) === $.CHAR_COLON
    if (hasLeft) {
      i++
    }
    var dashes = countChar(s, i, end, $.CHAR_DASH)
    if (!dashes) {
      return null
    }
    i += dashes
    var hasRight = i < end && s.charCodeAt(i) === $.CHAR_COLON
    if (hasRight) {
      i++
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
    i = skipMask(s, i, end, F.WS)
    if (i < end) {
      if (s.charCodeAt(i) !== $.CHAR_PIPE) {
        return null
      }
      i++
    }
  }
  return align.length > 0 ? align : null
}

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
    candidate = `${base}-${++n}`
  }
  ids[base] = n
  ids[candidate] = 0
  return candidate
}

function scanHeading(
  s: string,
  p: number,
  state: MarkdownToJSX.State,
  opts: ParseOptions
): MarkdownToJSX.ASTNode | null {
  var e = lineEnd(s, p)
  indent(s, p, e)
  var i = p + _indentChars
  var level = _indentSpaces <= 3 ? atxLevel(s, i, e, opts) : 0
  if (!level) {
    return null
  }
  i = skipMask(s, i + level, e, F.WS)
  var contentEnd = e
  while (contentEnd > i && s.charCodeAt(contentEnd - 1) === $.CHAR_SPACE) {
    contentEnd--
  }
  var beforeHash = contentEnd
  while (contentEnd > i && s.charCodeAt(contentEnd - 1) === $.CHAR_HASH) {
    contentEnd--
  }
  if (contentEnd < beforeHash) {
    if (contentEnd === i || s.charCodeAt(contentEnd - 1) === $.CHAR_SPACE) {
      while (contentEnd > i && s.charCodeAt(contentEnd - 1) === $.CHAR_SPACE) {
        contentEnd--
      }
    } else {
      contentEnd = beforeHash
    }
  }
  return ret(nextLine(s, e), {
    type: RuleType.heading,
    level: level as 1 | 2 | 3 | 4 | 5 | 6,
    children: queueInline(s.slice(i, contentEnd), false, state, opts),
    id: '',
  })
}

function parseFenceAttrs(attrsStr: string): Record<string, string> | undefined {
  var attrs: Record<string, string> | undefined
  var len = attrsStr.length
  for (var i = 0; i < len; ) {
    var c = attrsStr.charCodeAt(i)
    if (!isASCIILetter(c) && c !== $.CHAR_UNDERSCORE) {
      i++
      continue
    }
    var ns = i++
    while (
      i < len &&
      (isCF(attrsStr.charCodeAt(i), F.TAG) ||
        attrsStr.charCodeAt(i) === $.CHAR_UNDERSCORE)
    ) {
      i++
    }
    if (i + 1 < len && attrsStr.charCodeAt(i) === $.CHAR_EQ) {
      var q = attrsStr.charCodeAt(i + 1)
      if (q === $.CHAR_DOUBLE_QUOTE || q === $.CHAR_SINGLE_QUOTE) {
        var qe = findChar(attrsStr, i + 2, len, q)
        if (qe !== -1) {
          var name = attrsStr.slice(ns, i)
          var val = attrsStr.slice(i + 2, qe)
          if (!isDangerousAttr(name, val, false)) {
            ;(attrs || (attrs = {}))[name] = val
          }
          i = qe + 1
        }
      }
    }
  }
  return attrs
}

function scanFenced(
  s: string,
  p: number,
  state: MarkdownToJSX.State,
  opts: ParseOptions
): MarkdownToJSX.ASTNode | null {
  var e = lineEnd(s, p)
  indent(s, p, e)
  var fenceIndent = _indentSpaces
  var i = p + _indentChars
  var fenceLen = fenceIndent <= 3 ? fenceOpenLen(s, i, e) : 0
  if (!fenceLen) {
    return null
  }
  var fence = s.charCodeAt(i)
  var infoStart = skipMask(s, i + fenceLen, e, F.WS)
  var infoStr = s.slice(infoStart, rtrim(s, infoStart, e, true))
  var spaceIdx = infoStr.indexOf(' ')
  var lang = unescapeString(
    spaceIdx === -1 ? infoStr : infoStr.slice(0, spaceIdx)
  )
  var attrsStr = spaceIdx === -1 ? '' : infoStr.slice(spaceIdx + 1).trim()
  var rawAttrs = attrsStr ? parseFenceAttrs(attrsStr) : undefined
  var attrs = rawAttrs && processHtmlAttributes(rawAttrs, 'code', opts)

  var contentStart = nextLine(s, e)
  var foundClose = findFenceClose(s, contentStart, fence, fenceLen)
  var contentEnd = foundClose === -1 ? s.length : foundClose
  var closeEnd = _fenceCloseEnd

  var content: string
  if (fenceIndent === 0) {
    content = s.slice(
      contentStart,
      contentEnd > contentStart &&
        s.charCodeAt(contentEnd - 1) === $.CHAR_NEWLINE
        ? contentEnd - 1
        : contentEnd
    )
  } else {
    content = ''
    for (var cp = contentStart; cp < contentEnd; ) {
      var le = lineEnd(s, cp)
      indent(s, cp, le)
      content += `${s.slice(cp + Math.min(_indentChars, fenceIndent), le)}\n`
      cp = nextLine(s, le)
    }
    if (content.charCodeAt(content.length - 1) === $.CHAR_NEWLINE) {
      content = content.slice(0, -1)
    }
  }
  if (state.inList) {
    content = dropLazyMarkers(content)
  }
  return ret(closeEnd, {
    type: RuleType.codeBlock,
    lang: lang || undefined,
    text: content,
    infoString: attrsStr || undefined,
    attrs,
  } as MarkdownToJSX.CodeBlockNode)
}

function scanIndented(s: string, p: number): MarkdownToJSX.ASTNode | null {
  var content = ''
  var pending = ''
  var end = p
  var lastCodeEnd = p
  while (end < s.length) {
    var le = lineEnd(s, end)
    if (isBlank(s, end, le)) {
      pending += `${dedentLine(s, end, le, 4, false)}\n`
    } else {
      indent(s, end, le)
      if (_indentSpaces < 4) {
        break
      }
      content += `${pending + dedentLine(s, end, le, 4, false)}\n`
      pending = ''
      lastCodeEnd = nextLine(s, le)
    }
    end = nextLine(s, le)
  }
  content = trimEndNl(content, 0)
  return content
    ? ret(lastCodeEnd, {
        type: RuleType.codeBlock,
        lang: undefined,
        text: content,
        infoString: undefined,
        attrs: undefined,
      } as MarkdownToJSX.CodeBlockNode)
    : null
}

interface ListMarker {
  _contentCol: number
  _contentStart: number
  _isEmpty: boolean
  _marker: string
  _markerCol: number
  _ordered: boolean
  _start: number | undefined
}

function checkListMarker(s: string, p: number, e: number): ListMarker | null {
  indent(s, p, e)
  var markerCol = _indentSpaces
  var i = p + _indentChars
  if (markerCol > 3 || i >= e) {
    return null
  }
  var c = s.charCodeAt(i)
  var ordered = c >= $.CHAR_DIGIT_0 && c <= $.CHAR_DIGIT_9
  var markerEnd: number
  var markerCh: string
  var startNum: number | undefined

  if (c === $.CHAR_DASH || c === $.CHAR_ASTERISK || c === $.CHAR_PLUS) {
    markerEnd = i + 1
    markerCh = s[i]
  } else if (ordered) {
    var numEnd = skipMask(s, i, Math.min(e, i + 9), F.DIGIT)
    var delim = numEnd < e ? s.charCodeAt(numEnd) : 0
    if (delim !== $.CHAR_PERIOD && delim !== $.CHAR_PAREN_CLOSE) {
      return null
    }
    markerEnd = numEnd + 1
    markerCh = s[numEnd]
    startNum = Number.parseInt(s.slice(i, numEnd), 10)
  } else {
    return null
  }

  if (markerEnd < e && !isCF(s.charCodeAt(markerEnd), F.WSNL)) {
    return null
  }

  var afterMarkerCol = columnAt(s, p, markerEnd)
  indent(s, markerEnd, e, afterMarkerCol)
  var contentPos = markerEnd + _indentChars
  var contentCol = _indentSpaces
  var isEmpty = contentPos >= e
  if (isEmpty || contentCol - afterMarkerCol > 4 || contentPos === markerEnd) {
    contentCol = afterMarkerCol + 1
    contentPos =
      markerEnd < e && contentPos > markerEnd ? markerEnd + 1 : markerEnd
  }

  return {
    _contentCol: contentCol,
    _contentStart: contentPos,
    _isEmpty: isEmpty,
    _marker: markerCh,
    _markerCol: markerCol,
    _ordered: ordered,
    _start: startNum,
  }
}

function scanBlockquote(
  s: string,
  p: number,
  state: MarkdownToJSX.State,
  opts: ParseOptions
): MarkdownToJSX.ASTNode | null {
  var e = lineEnd(s, p)
  indent(s, p, e)
  if (_indentSpaces > 3 || s.charCodeAt(p + _indentChars) !== $.CHAR_GT) {
    return null
  }

  var lines: string[] = []
  var end = p
  var alertType: string | undefined
  var open = OpenState.None
  var foldedCount = 0
  _depth = 0

  while (end < s.length) {
    var le = lineEnd(s, end)
    indent(s, end, le)
    var qi = end + _indentChars
    if (s.charCodeAt(qi) === $.CHAR_GT) {
      var ci = qi + 1
      var bqCol = _indentSpaces + 1
      var nextCh = ci < le ? s.charCodeAt(ci) : 0
      var lineContent =
        nextCh === $.CHAR_SPACE
          ? expandTabs(s, ci + 1, le, bqCol + 1, 0)
          : nextCh === $.CHAR_TAB
            ? expandTabs(
                s,
                ci + 1,
                le,
                bqCol + (4 - (bqCol % 4)),
                3 - (bqCol % 4)
              )
            : expandTabs(s, ci, le, bqCol, 0)

      if (
        !(lines.length > 0 || alertType) &&
        lineContent.charCodeAt(0) === $.CHAR_BRACKET_OPEN &&
        lineContent.charCodeAt(1) === $.CHAR_EXCLAMATION
      ) {
        var ae = skipMask(lineContent, 2, lineContent.length, F.ALPHA)
        if (
          ae > 2 &&
          lineContent.charCodeAt(ae) === $.CHAR_BRACKET_CLOSE &&
          lineContent.slice(ae + 1).trim().length === 0
        ) {
          alertType = lineContent.slice(2, ae).toUpperCase()
          end = nextLine(s, le)
          continue
        }
      }

      lines.push(lineContent)
      end = nextLine(s, le)
    } else {
      if (isBlank(s, end, le)) {
        break
      }
      for (; foldedCount < lines.length; foldedCount++) {
        open = openAfter(open, lines[foldedCount], opts)
      }
      if (open !== OpenState.Paragraph) {
        break
      }
      indent(s, end, le)
      var lazyStart = end + _indentChars
      if (
        _indentSpaces < 4 &&
        lineStartsBlock(
          s,
          end,
          lazyStart,
          le,
          LineBlockMode.QuoteLazyLine,
          opts
        )
      ) {
        break
      }
      lines.push(
        s.charCodeAt(lazyStart) === $.CHAR_RECORD_SEP
          ? s.slice(lazyStart, le)
          : LAZY_MARKER + s.slice(lazyStart, le)
      )
      foldedCount = lines.length
      end = nextLine(s, le)
    }
  }

  if (!(lines.length > 0 || alertType)) {
    return null
  }
  var savedBq = state.inBlockQuote
  var savedEdge = state._notAtEdge
  state.inBlockQuote = true
  state._notAtEdge = savedEdge || hasNonWs(s, end, s.length)
  lines.push('')
  var children = parseBlocks(lines.join('\n'), state, opts)
  state._notAtEdge = savedEdge
  state.inBlockQuote = savedBq

  return ret(end, {
    type: RuleType.blockQuote,
    children,
    alert: alertType || undefined,
  })
}

function copyUnwrap(
  src: MarkdownToJSX.ASTNode[],
  dest: MarkdownToJSX.ASTNode[],
  unwrap: boolean
): void {
  for (var i = 0; i < src.length; i++) {
    var sn = src[i]
    if (unwrap && sn.type === RuleType.paragraph) {
      var pc = (sn as MarkdownToJSX.ParagraphNode).children
      for (var j = 0; j < pc.length; j++) {
        dest.push(pc[j])
      }
    } else {
      dest.push(sn)
    }
  }
}

function deferOrCopy(
  src: MarkdownToJSX.ASTNode[],
  dest: MarkdownToJSX.ASTNode[],
  unwrap: boolean
): void {
  if (_pendingOps) {
    _pendingOps.push({ _dest: dest, _src: src, _unwrap: unwrap })
  } else {
    copyUnwrap(src, dest, unwrap)
  }
}

var _blocksHadInternalBlank = false

function scanList(
  s: string,
  p: number,
  state: MarkdownToJSX.State,
  opts: ParseOptions
): MarkdownToJSX.ASTNode | null {
  var firstLine = lineEnd(s, p)
  var firstMarker = checkListMarker(s, p, firstLine)
  if (!firstMarker) {
    return null
  }

  var itemRaws: string[] = []
  var curContentCol = firstMarker._contentCol
  var curIsEmpty = firstMarker._isEmpty
  var curHasContent = !firstMarker._isEmpty
  var isLoose = false
  var curRaw = ''
  var open = OpenState.None
  var foldedLen = 0
  _depth = 0
  if (!firstMarker._isEmpty) {
    var absCol = columnAt(s, p, firstMarker._contentStart)
    curRaw = `${expandTabs(
      s,
      firstMarker._contentStart,
      firstLine,
      absCol,
      Math.max(0, absCol - firstMarker._contentCol)
    )}\n`
  }
  var end = nextLine(s, firstLine)
  var trailingBlankStart = -1

  while (end < s.length) {
    var sawBlankRun = false
    var le = lineEnd(s, end)
    var indentCols = curContentCol > 4 ? curContentCol : 4
    indent(s, end, le, 0, indentCols)
    while (end < s.length && isBlankAfterCappedIndent(s, end, le, indentCols)) {
      if (!sawBlankRun) {
        trailingBlankStart = end
        sawBlankRun = true
      }
      var blankLine = dedentLine(s, end, le, curContentCol, false)
      curRaw += `${blankLine}\n`
      end = nextLine(s, le)
      if (end < s.length) {
        le = lineEnd(s, end)
        indent(s, end, le, 0, indentCols)
      }
    }
    if (end >= s.length) {
      break
    }

    var lineSpaces = _indentSpaces
    var i = end + _indentChars
    var ch = s.charCodeAt(i)
    if (
      lineSpaces < curContentCol &&
      (ch === $.CHAR_DASH ||
        ch === $.CHAR_ASTERISK ||
        ch === $.CHAR_UNDERSCORE) &&
      isThematicBreak(s, i, le)
    ) {
      break
    }

    var emptyWithNoContent = curIsEmpty && !curHasContent
    var canBeMarker =
      lineSpaces <= 3 &&
      (lineSpaces < curContentCol || (sawBlankRun && emptyWithNoContent)) &&
      (ch === $.CHAR_DASH ||
        ch === $.CHAR_ASTERISK ||
        ch === $.CHAR_PLUS ||
        (ch >= $.CHAR_DIGIT_0 && ch <= $.CHAR_DIGIT_9))
    var lineMarker = canBeMarker ? checkListMarker(s, end, le) : null
    if (
      lineMarker !== null &&
      lineMarker._ordered === firstMarker._ordered &&
      lineMarker._marker === firstMarker._marker
    ) {
      if (sawBlankRun) {
        isLoose = true
      }
      itemRaws.push(curRaw)
      curContentCol = lineMarker._contentCol
      curIsEmpty = lineMarker._isEmpty
      curHasContent = !lineMarker._isEmpty
      trailingBlankStart = -1
      curRaw = lineMarker._isEmpty
        ? ''
        : `${s.slice(lineMarker._contentStart, le)}\n`
      open = OpenState.None
      foldedLen = 0
      _depth = 0
      end = nextLine(s, le)
      continue
    }

    if (sawBlankRun && emptyWithNoContent) {
      break
    }
    if (lineSpaces >= curContentCol) {
      trailingBlankStart = -1
      curHasContent = true
      var contLine = dedentLine(s, end, le, curContentCol, true)
      curRaw += `${contLine}\n`
      end = nextLine(s, le)
      continue
    }
    var canBeLazy = !sawBlankRun && curHasContent
    if (canBeLazy && foldedLen < curRaw.length) {
      open = openAfterLines(open, curRaw, foldedLen, opts)
      foldedLen = curRaw.length
    }
    if (
      canBeLazy &&
      open === OpenState.Paragraph &&
      !lineStartsBlock(s, end, i, le, LineBlockMode.ListLazyLine, opts)
    ) {
      trailingBlankStart = -1
      curRaw +=
        ch === $.CHAR_RECORD_SEP
          ? `${s.slice(i, le)}\n`
          : `${LAZY_MARKER}${s.slice(i, le)}\n`
      foldedLen = curRaw.length
      end = nextLine(s, le)
      continue
    }
    break
  }

  if (trailingBlankStart !== -1) {
    end = trailingBlankStart
  }
  itemRaws.push(curRaw)

  var items: MarkdownToJSX.ASTNode[][] = []
  var taskNodes: (MarkdownToJSX.GFMTaskNode | null)[] | null = null
  var savedInList = state.inList
  var savedEdge = state._notAtEdge

  for (var ii = 0; ii < itemRaws.length; ii++) {
    var itemContent = trimEndNl(itemRaws[ii], 0)
    if (
      itemContent.length >= 3 &&
      itemContent.charCodeAt(0) === $.CHAR_BRACKET_OPEN &&
      itemContent.charCodeAt(2) === $.CHAR_BRACKET_CLOSE
    ) {
      var tm = itemContent[1]
      var textStart = skipMask(itemContent, 3, itemContent.length, F.WS)
      var textOnMarkerLine =
        textStart < itemContent.length &&
        itemContent.charCodeAt(textStart) !== $.CHAR_NEWLINE
      if (
        (tm === ' ' || tm === 'x' || tm === 'X') &&
        isCF(itemContent.charCodeAt(3), F.ASCII_WS) &&
        (textOnMarkerLine ||
          continuesParagraph(itemContent, textStart + 1, opts))
      ) {
        if (!taskNodes) {
          taskNodes = new Array(itemRaws.length).fill(null)
        }
        taskNodes[ii] = { type: RuleType.gfmTask, completed: tm !== ' ' }
        itemContent = textOnMarkerLine
          ? LAZY_MARKER + itemContent.slice(textStart)
          : itemContent.slice(3)
      }
    }
    var itemNodes: MarkdownToJSX.ASTNode[]
    if (hasNonWs(itemContent, 0, itemContent.length)) {
      state.inList = true
      state._notAtEdge = savedEdge || ii !== itemRaws.length - 1
      itemNodes = parseBlocks(itemContent, state, opts)
      if (_blocksHadInternalBlank) {
        isLoose = true
      }
    } else {
      itemNodes = []
    }
    items.push(itemNodes)
  }

  state.inList = savedInList
  state._notAtEdge = savedEdge

  if (!isLoose || taskNodes) {
    for (var ai = 0; ai < items.length; ai++) {
      var nodes = items[ai]
      if (!isLoose && nodes.length > 0) {
        if (nodes.length === 1 && nodes[0].type === RuleType.paragraph) {
          nodes = (nodes[0] as MarkdownToJSX.ParagraphNode).children
        } else {
          var unwrapped: MarkdownToJSX.ASTNode[] = []
          deferOrCopy(nodes, unwrapped, true)
          nodes = unwrapped
        }
      }
      var tn = taskNodes ? taskNodes[ai] : null
      if (tn) {
        var taskItem: MarkdownToJSX.ASTNode[] = [
          tn,
          { type: RuleType.text, text: ' ' },
        ]
        deferOrCopy(nodes, taskItem, false)
        items[ai] = taskItem
      } else {
        items[ai] = nodes
      }
    }
  }

  return ret(
    end,
    firstMarker._ordered
      ? { type: RuleType.orderedList, start: firstMarker._start, items }
      : { type: RuleType.unorderedList, items }
  )
}

function processHtmlAttributes(
  rawAttrs: Record<string, string>,
  tagName: string,
  opts: ParseOptions
): Record<string, any> {
  var attrs: Record<string, any> = {}
  var first = tagName.charCodeAt(0)
  var readsJsxProps =
    first >= $.CHAR_A &&
    first <= $.CHAR_Z &&
    Boolean(util.get(opts.overrides, tagName, undefined))

  for (var name in rawAttrs) {
    var value = rawAttrs[name]
    var nameLower = name.toLowerCase()
    if (nameLower === 'style' && typeof value === 'string') {
      var styles: Record<string, string> = {}
      var depth = 0
      var start = 0
      var hasXss = false
      var styleCount = 0
      for (var j = 0; j <= value.length; j++) {
        var c = j < value.length ? value.charCodeAt(j) : $.CHAR_SEMICOLON
        if (c === $.CHAR_PAREN_OPEN) {
          depth++
        } else if (c === $.CHAR_PAREN_CLOSE) {
          depth--
        } else if (c === $.CHAR_SEMICOLON && depth === 0) {
          var decl = value.slice(start, j)
          start = j + 1
          var colon = decl.indexOf(':')
          if (colon !== -1) {
            var prop = decl.slice(0, colon).trim()
            var val = decl.slice(colon + 1).trim()
            if (prop && val) {
              if (isUnsafeStyle(decl)) {
                hasXss = true
                if (process.env.NODE_ENV !== 'production') {
                  console.warn(
                    'Style attribute contains an unsafe URL expression, it will not be rendered.',
                    val
                  )
                }
              } else {
                styles[
                  prop.indexOf('-') === -1
                    ? prop
                    : prop.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase())
                ] = val
                styleCount++
              }
            }
          }
        }
      }
      if (!hasXss && styleCount > 0) {
        attrs[name] = styles
      }
    } else if (nameLower === 'href' || nameLower === 'src') {
      var sanitized = opts.sanitizer(value, tagName, nameLower)
      if (sanitized != null) {
        attrs[name] = sanitized
      }
    } else if (value === '') {
      attrs[name] = true
    } else if (
      readsJsxProps &&
      value.length >= 2 &&
      value.charCodeAt(0) === $.CHAR_BRACE_OPEN &&
      value.charCodeAt(value.length - 1) === $.CHAR_BRACE_CLOSE
    ) {
      var inner = value.slice(1, -1)
      var fc = inner.charCodeAt(0)
      if (fc === $.CHAR_BRACKET_OPEN || fc === $.CHAR_BRACE_OPEN) {
        try {
          attrs[name] = JSON.parse(inner)
          continue
        } catch {}
      }
      if (inner === 'true' || inner === 'false') {
        attrs[name] = inner === 'true'
      } else if (opts.evalUnserializableExpressions) {
        try {
          attrs[name] = (0, eval)(`(${inner})`)
        } catch {
          attrs[name] = inner
        }
      } else {
        attrs[name] = inner
      }
    } else {
      attrs[name] = value
    }
  }
  return attrs
}

export function indexOfCi(
  str: string,
  search: string,
  from: number,
  end: number
): number {
  var strEnd = end - search.length
  var ch = search.charAt(0)
  for (var j = from; j <= strEnd; ) {
    var found = str.indexOf(ch, j)
    if (found === -1 || found > strEnd) {
      return -1
    }
    if (matchesFolded(str, found, search)) {
      return found
    }
    j = found + 1
  }
  return -1
}

export function matchesFolded(
  text: string,
  at: number,
  lower: string
): boolean {
  for (var i = 0; i < lower.length; i++) {
    var c1 = text.charCodeAt(at + i)
    var c2 = lower.charCodeAt(i)
    if (c1 >= $.CHAR_A && c1 <= $.CHAR_Z) {
      c1 += $.CHAR_CASE_OFFSET
    }
    if (c2 >= $.CHAR_A && c2 <= $.CHAR_Z) {
      c2 += $.CHAR_CASE_OFFSET
    }
    if (c1 !== c2) {
      return false
    }
  }
  return true
}

export function lastIndexOfCi(
  str: string,
  search: string,
  from: number
): number {
  var first = search.charAt(0)
  var last = Math.min(from, str.length - search.length)
  var at = last < 0 ? -1 : str.lastIndexOf(first, last)
  while (at !== -1 && !matchesFolded(str, at, search)) {
    at = at === 0 ? -1 : str.lastIndexOf(first, at - 1)
  }
  return at
}

var _closeTagStart = -1

function isCloserTail(code: number): boolean {
  return code === $.CHAR_GT || isCF(code, F.WSNL)
}

function lastCloserByName(s: string): Record<string, number | undefined> {
  var table: Record<string, number | undefined> = Object.create(null)
  for (var at = s.indexOf('</'); at !== -1; ) {
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

function findClosingTag(
  s: string,
  start: number,
  tagName: string,
  limit: number,
  useMemo = true
): number {
  var tagLower = tagName.toLowerCase()
  var openTag = `<${tagLower}`
  var closeTag = `</${tagLower}`
  var depth = 1
  var i = start
  _closeTagStart = -1

  if (_doc !== null && _doc._s === s) {
    if (_doc._lastCloser !== null) {
      var lastAt = _doc._lastCloser[tagLower]
      if (lastAt === undefined || lastAt < start) {
        return -1
      }
    }
    if (useMemo) {
      var known = _doc._closeMemo[tagLower]
      if (known !== undefined) {
        if (start >= known._noCloseFrom && limit <= known._noCloseEnd) {
          return -1
        }
        if (limit === known._failEnd) {
          var fi = firstAtOrAfter(known._failStarts, start)
          if (
            fi < known._failStarts.length &&
            known._failStarts[fi] === start
          ) {
            return -1
          }
        }
      }
    }
  }

  var eventEnds: number[] | null = null
  var noCloseFrom = -1
  var openIdx = -2
  var closeIdx = -2
  var openSearched = i

  while (i < limit && depth > 0) {
    if (closeIdx < i) {
      closeIdx = indexOfCi(s, closeTag, i, limit)
    }
    if (closeIdx === -1) {
      noCloseFrom = i
      break
    }
    if (openIdx < i) {
      var openFrom = i > openSearched ? i : openSearched
      openIdx =
        openFrom < closeIdx ? indexOfCi(s, openTag, openFrom, closeIdx) : -1
      openSearched = openIdx === -1 ? closeIdx : openIdx + 1
    }
    if (openIdx !== -1 && openIdx < closeIdx) {
      var res = __parseHtmlTag(s, openIdx)
      if (res) {
        if (
          res._tag.toLowerCase() === tagLower &&
          !res._isClosing &&
          !res._selfClosing &&
          !util.isVoidElement(res._tag)
        ) {
          depth++
          if (useMemo) {
            ;(eventEnds || (eventEnds = [])).push(res._end)
          }
        }
        i = res._end
      } else {
        i = openIdx + 1
      }
    } else {
      var afterPos = closeIdx + closeTag.length
      var endBound = useMemo ? s.length : limit
      var afterCode = afterPos < endBound ? s.charCodeAt(afterPos) : $.CHAR_GT
      if (isCloserTail(afterCode)) {
        if (--depth === 0) {
          _closeTagStart = closeIdx
          var gt = findChar(s, afterPos, endBound, $.CHAR_GT)
          return gt === -1 ? endBound : gt + 1
        }
        if (useMemo) {
          ;(eventEnds || (eventEnds = [])).push(-1)
        }
      }
      i = closeIdx + 1
    }
  }

  if (!useMemo) {
    return -1
  }
  var doc = docFor(s)
  doc._failedLen += limit - start
  if (doc._lastCloser === null && doc._failedLen >= s.length) {
    doc._lastCloser = lastCloserByName(s)
  }
  var memo =
    doc._closeMemo[tagLower] ||
    (doc._closeMemo[tagLower] = {
      _failEnd: -1,
      _failStarts: [],
      _noCloseEnd: -1,
      _noCloseFrom: -1,
    })
  if (noCloseFrom !== -1) {
    memo._noCloseFrom = noCloseFrom
    memo._noCloseEnd = limit
  }
  var memoFails = memo._failStarts
  if (memo._failEnd !== limit) {
    memoFails.length = 0
    memo._failEnd = limit
  }
  memoFails.length = firstAtOrAfter(memoFails, start)
  if (eventEnds === null) {
    return -1
  }
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

function nextType1At(s: string, from: number, isClose: boolean): number {
  var doc = docFor(s)
  var cFrom = isClose ? doc._t1CloseFrom : doc._t1TagFrom
  var cAt = isClose ? doc._t1CloseAt : doc._t1TagAt
  if (cFrom !== -1 && from >= cFrom && from <= cAt) {
    return cAt
  }
  var prefix = isClose ? '</' : '<'
  var found = s.length
  for (
    var at = s.indexOf(prefix, from);
    at !== -1;
    at = s.indexOf(prefix, at + 1)
  ) {
    if (matchType1At(s, at, isClose)) {
      found = at
      break
    }
  }
  if (isClose) {
    doc._t1CloseFrom = from
    doc._t1CloseAt = found
  } else {
    doc._t1TagFrom = from
    doc._t1TagAt = found
  }
  return found
}

function isOpenerBeforeBlankLineTag(
  s: string,
  from: number,
  closeTag: string
): boolean {
  var newlines = 0
  var i = from
  var c = s.charCodeAt(i)
  while (isCF(c, F.WSNL)) {
    if (c === $.CHAR_NEWLINE) {
      newlines++
    }
    c = s.charCodeAt(++i)
  }
  if (newlines < 2 || c !== $.CHAR_LT) {
    return false
  }
  if (!matchesFolded(s, i, closeTag)) {
    return true
  }
  var afterClose = i + closeTag.length
  return !isCloserTail(
    afterClose < s.length ? s.charCodeAt(afterClose) : $.CHAR_GT
  )
}

function rawCloser(s: string, start: number, end: number, tag: string): string {
  return s.lastIndexOf('<', end - 1) === start
    ? s.slice(start, end)
    : `</${tag}>`
}

var _noEndFrom: Record<string, number> | null = null

function terminatorAt(s: string, terminator: string, from: number): number {
  var noEndFrom = _noEndFrom === null ? undefined : _noEndFrom[terminator]
  if (noEndFrom !== undefined && from >= noEndFrom) {
    return -1
  }
  var at = s.indexOf(terminator, from)
  if (at === -1) {
    ;(_noEndFrom || (_noEndFrom = {}))[terminator] = from
  }
  return at
}

// biome-ignore lint/suspicious/noConstEnum: the bundler inlines const enum members; a plain const would stay a variable in the minified dist
const enum H {
  ATTRS = 1,
  BODY = 2,
  CLOSE = 4,
  OUTER = 8,
  EMIT_CLOSE = 16,
  VERBATIM = 32,
  CLOSING = 64,
}

function makeHtmlNode(
  mask: number,
  tag: string,
  attrs: Record<string, any>,
  rawAttrs: string | undefined,
  children: MarkdownToJSX.ASTNode[],
  text: string,
  rawBody?: string,
  rawClose?: string,
  rawOuter?: string,
  reparseSource?: string
): MarkdownToJSX.HTMLNode {
  var node: MarkdownToJSX.HTMLNode = { type: RuleType.htmlBlock, tag, attrs }
  if (mask & H.ATTRS) {
    node._rawAttrs = rawAttrs
  }
  node.children = children
  var closeFirst = (mask & H.CLOSING) !== 0
  if (closeFirst && mask & H.CLOSE) {
    node._rawClose = rawClose
  }
  if (mask & H.BODY) {
    node._rawBody = rawBody
  }
  if (!closeFirst && mask & H.CLOSE) {
    node._rawClose = rawClose
  }
  if (mask & H.OUTER) {
    node._rawOuter = rawOuter
  }
  node._reparseSource = reparseSource
  node.text = text
  node._verbatim = (mask & H.VERBATIM) !== 0
  node._isClosingTag = (mask & H.CLOSING) !== 0
  if (mask & H.EMIT_CLOSE) {
    node._emitOwnClose = true
  }
  return node
}

var _rmTerm = ''
var _rmOffset = 0

function rawMarkupKind(s: string, p: number, e: number): number {
  var i = p + 1
  if (i >= e) {
    return 0
  }
  var ch = s.charCodeAt(i)
  if (ch === $.CHAR_QUESTION) {
    _rmTerm = '?>'
    _rmOffset = 2
    return 3
  }
  if (ch === $.CHAR_EXCLAMATION && i + 1 < e) {
    var nc = s.charCodeAt(i + 1)
    if (
      nc === $.CHAR_DASH &&
      i + 2 < e &&
      s.charCodeAt(i + 2) === $.CHAR_DASH
    ) {
      _rmTerm = '-->'
      _rmOffset = 4
      return 2
    }
    if (isASCIILetter(nc)) {
      _rmTerm = '>'
      _rmOffset = 3
      return 4
    }
    if (nc === $.CHAR_BRACKET_OPEN && s.slice(i + 1, i + 8) === '[CDATA[') {
      _rmTerm = ']]>'
      _rmOffset = 9
      return 5
    }
  }
  return 0
}

function scanRawMarkup(
  s: string,
  p: number,
  e: number,
  isBlock: boolean
): MarkdownToJSX.ASTNode | null {
  var kind = rawMarkupKind(s, p, e)
  if (!kind) {
    return null
  }
  var term = _rmTerm
  if (!isBlock && kind === 2) {
    var cs = p + 4
    if (cs < e && s.charCodeAt(cs) === $.CHAR_GT) {
      return ret(cs + 1, {
        type: RuleType.htmlComment,
        text: '',
        _endsWithGT: true,
      })
    }
    if (
      cs + 1 < e &&
      s.charCodeAt(cs) === $.CHAR_DASH &&
      s.charCodeAt(cs + 1) === $.CHAR_GT
    ) {
      return ret(cs + 2, {
        type: RuleType.htmlComment,
        text: '-',
        _endsWithGT: true,
      })
    }
  }
  var found = isBlock
    ? s.indexOf(term, p)
    : terminatorAt(s, term, p + _rmOffset)
  if (!isBlock) {
    if (found === -1 || found + term.length > e) {
      return null
    }
    var endInline = found + term.length
    var src = s.slice(p, endInline)
    var screened = stripDangerousHtml(src)
    return ret(
      endInline,
      kind === 2 && screened === src
        ? {
            type: RuleType.htmlComment,
            text: s.slice(p + 4, found),
            _endsWithGT: false,
          }
        : {
            type: RuleType.htmlComment,
            text: screened,
            _endsWithGT: false,
            raw: true,
          }
    )
  }
  var rawEnd = found >= 0 ? nextLine(s, found + term.length) : s.length
  return ret(rawEnd, {
    type: RuleType.htmlComment,
    text: stripDangerousHtml(s.slice(p, rawEnd)),
    _endsWithGT: false,
    raw: true,
  })
}

var _detectedTag: ParsedHtmlTag | null = null

function detectHtmlBlockType(
  s: string,
  p: number,
  skipType7?: boolean
): number {
  _detectedTag = null
  if (s.charCodeAt(p) !== $.CHAR_LT) {
    return 0
  }
  var len = s.length
  var rk = rawMarkupKind(s, p, len)
  if (rk) {
    return rk
  }
  var isClosing = s.charCodeAt(p + 1) === $.CHAR_SLASH
  var nameStart = p + (isClosing ? 2 : 1)
  var nameEnd = scanTagName(s, nameStart, len)
  if (nameEnd === nameStart) {
    return 0
  }
  var tagLower = s.slice(nameStart, nameEnd).toLowerCase()
  var ac = nameEnd < len ? s.charCodeAt(nameEnd) : -1
  var validAfterOpen = ac === -1 || ac === $.CHAR_GT || isCF(ac, F.WSNL)

  if (TYPE1_TAGS.has(tagLower)) {
    return !isClosing && validAfterOpen ? 1 : 0
  }
  var isBlock = BLOCK_TAGS.has(tagLower)
  if (!isBlock && skipType7) {
    return 0
  }
  var bound = isBlock ? len : lineEnd(s, p)
  if (isClosing) {
    var jc = skipMask(s, nameEnd, bound, F.WS)
    return jc < bound &&
      s.charCodeAt(jc) === $.CHAR_GT &&
      (isBlock || isBlank(s, jc + 1, bound))
      ? isBlock
        ? 6
        : 7
      : 0
  }
  if (isBlock) {
    return validAfterOpen || ac === $.CHAR_SLASH ? 6 : 0
  }
  var tagRes = __parseHtmlTag(s, p)
  if (tagRes && tagRes._end <= bound && isBlank(s, tagRes._end, bound)) {
    _detectedTag = tagRes
    return 7
  }
  return 0
}

function hasHtmlTag(s: string): boolean {
  var lastGt = s.lastIndexOf('>')
  for (
    var lt = s.indexOf('<');
    lt !== -1 && lt + 2 <= lastGt;
    lt = s.indexOf('<', lt + 1)
  ) {
    if (isASCIILetter(s.charCodeAt(lt + 1))) {
      return true
    }
  }
  return false
}

function hasLineStartOpenTag(s: string): boolean {
  var lastGt = s.lastIndexOf('>')
  for (var p = 0; p < s.length; ) {
    if (
      s.charCodeAt(p) === $.CHAR_LT &&
      p + 1 < s.length &&
      isASCIILetter(s.charCodeAt(p + 1))
    ) {
      var i = p + 2
      while (
        i < s.length &&
        !isCF(s.charCodeAt(i), F.SLASH_GT | F.SPNL) &&
        s.charCodeAt(i) !== $.CHAR_CR
      ) {
        i++
      }
      if (i < s.length && s.charCodeAt(i) === $.CHAR_SPACE) {
        i++
      }
      if (lastGt >= i) {
        return true
      }
    }
    var nl = s.indexOf('\n', p)
    if (nl === -1) {
      break
    }
    p = nl + 1
  }
  return false
}

function hasBlockSyntax(s: string, relaxed: boolean): boolean {
  var len = s.length
  for (var p = 0; p < len; ) {
    var i = p
    var sp = 0
    while (i < len && sp < 3 && isCF(s.charCodeAt(i), F.ASCII_WS)) {
      if (s.charCodeAt(i) === $.CHAR_NEWLINE) {
        break
      }
      i++
      sp++
    }
    if (i < len) {
      var c = s.charCodeAt(i)
      var nc = i + 1 < len ? s.charCodeAt(i + 1) : 0
      if (
        (c === $.CHAR_HASH &&
          i + 1 < len &&
          (relaxed || nc === $.CHAR_HASH || isCF(nc, F.ASCII_WS))) ||
        ((c === $.CHAR_DASH ||
          c === $.CHAR_ASTERISK ||
          c === $.CHAR_PLUS ||
          c === $.CHAR_GT) &&
          i + 1 < len &&
          isCF(nc, F.ASCII_WS)) ||
        (c === $.CHAR_BACKTICK &&
          i + 2 < len &&
          nc === $.CHAR_BACKTICK &&
          s.charCodeAt(i + 2) === $.CHAR_BACKTICK)
      ) {
        return true
      }
      if (c >= $.CHAR_DIGIT_0 && c <= $.CHAR_DIGIT_9) {
        var di = skipMask(s, i + 1, len, F.DIGIT)
        if (
          di + 1 < len &&
          s.charCodeAt(di) === $.CHAR_PERIOD &&
          isCF(s.charCodeAt(di + 1), F.ASCII_WS)
        ) {
          return true
        }
      }
    }
    var nl = s.indexOf('\n', p)
    if (nl === -1) {
      break
    }
    p = nl + 1
  }
  return false
}

var _hasInlineHtmlBlock = false

// biome-ignore lint/suspicious/noConstEnum: the bundler inlines const enum members; a plain const would stay a variable in the minified dist
const enum HtmlChildrenMode {
  Block = 0,
  Component = 1,
  Inline = 2,
  Unclosed = 3,
}

function parseHtmlChildren(
  rawContent: string,
  tagLower: string,
  state: MarkdownToJSX.State,
  opts: ParseOptions,
  mode: HtmlChildrenMode
): MarkdownToJSX.ASTNode[] {
  var trimmed = rawContent.trim()
  if (mode === HtmlChildrenMode.Inline ? !rawContent : !trimmed) {
    return []
  }
  var sInline = state.inline
  var sInHtml = state.inHTML
  var sDepth = state._htmlDepth
  var sAnchor = state.inAnchor
  var sBreaks = state._breaks
  var children: MarkdownToJSX.ASTNode[]
  var relaxed = opts.enforceAtxHeadings === false

  if (mode === HtmlChildrenMode.Inline) {
    if (tagLower === 'a') {
      state.inAnchor = true
    }
    state._breaks = false
    var hc = countChar(trimmed, 0, trimmed.length, $.CHAR_HASH)
    var hasHeading =
      hc >= 1 &&
      hc <= 6 &&
      hc < trimmed.length &&
      (relaxed
        ? trimmed.charCodeAt(hc) !== $.CHAR_HASH
        : isCF(trimmed.charCodeAt(hc), F.ASCII_WS))
    if (trimmed.indexOf('\n\n') !== -1 || hasHeading) {
      _hasInlineHtmlBlock = true
      state.inline = false
      children = parseBlocks(trimmed, state, opts)
    } else {
      children = parseInline(rawContent, 0, rawContent.length, state, opts)
    }
  } else {
    state.inHTML = true
    state._htmlDepth = (sDepth || 0) + 1
    if (mode === HtmlChildrenMode.Unclosed) {
      state.inline = false
      children = parseBlocks(rawContent, state, opts)
    } else if (mode === HtmlChildrenMode.Block && tagLower === 'p') {
      state.inline = true
      children = queueInline(trimmed, false, state, opts)
    } else {
      var hasDoubleNl = rawContent.indexOf('\n\n') !== -1
      var hasBlockSyn = hasBlockSyntax(trimmed, relaxed)
      var hasHtmlTags = hasLineStartOpenTag(trimmed)
      if (
        mode === HtmlChildrenMode.Block &&
        rawContent.length >= 2 &&
        rawContent.charCodeAt(0) === $.CHAR_NEWLINE &&
        rawContent.charCodeAt(rawContent.length - 1) === $.CHAR_NEWLINE &&
        !(hasDoubleNl || hasBlockSyn || hasHtmlTags)
      ) {
        children = [{ type: RuleType.text, text: trimmed }]
      } else if (hasDoubleNl || hasBlockSyn || hasHtmlTags) {
        state.inline = false
        children = parseBlocks(rawContent, state, opts)
      } else {
        state.inline = true
        children = queueInline(trimmed, false, state, opts)
      }
    }
  }

  state.inline = sInline
  state.inHTML = sInHtml
  state._htmlDepth = sDepth
  state.inAnchor = sAnchor
  state._breaks = sBreaks
  return children
}

function extractFallbackTag(raw: string): string {
  var ns = raw.charCodeAt(1) === $.CHAR_SLASH ? 2 : 1
  var ne = scanTagName(raw, ns, raw.length)
  return ne > ns ? raw.slice(ns, ne) : 'div'
}

function scanHtmlBlock(
  s: string,
  p: number,
  state: MarkdownToJSX.State,
  opts: ParseOptions
): MarkdownToJSX.ASTNode | null {
  if (opts.ignoreHTMLBlocks || opts.disableParsingRawHTML) {
    return null
  }
  var e = lineEnd(s, p)
  indent(s, p, e)
  if (_indentSpaces > 3 && !state.inHTML) {
    return null
  }
  var start = p + _indentChars
  if (
    s.charCodeAt(start) !== $.CHAR_LT ||
    matchAutolinkEnd(s, start, e) !== -1
  ) {
    return null
  }

  var blockType = detectHtmlBlockType(s, start)
  if (blockType >= 2 && blockType <= 5) {
    return scanRawMarkup(s, start, s.length, true)
  }

  var tagResult = _detectedTag || __parseHtmlTag(s, start)
  _detectedTag = null

  if (blockType === 1) {
    var t1Close = nextType1At(s, start, true)
    var rawEnd =
      t1Close < s.length ? nextLine(s, s.indexOf('>', t1Close) + 1) : s.length
    var rawText = s.slice(start, rawEnd)
    var tagName1 = tagResult ? tagResult._tag : extractFallbackTag(rawText)
    var rawBody1: string | undefined
    var rawClose1: string | undefined
    var rawOuter1: string | undefined
    var text1 = ''

    if (tagResult) {
      var cStart = tagResult._end - start
      var cIdx = indexOfCi(
        rawText,
        `</${tagName1.toLowerCase()}`,
        0,
        rawText.length
      )
      var bStart =
        rawText.charCodeAt(cStart) === $.CHAR_NEWLINE ? cStart + 1 : cStart
      if (cIdx === -1) {
        var outer = trimEndNl(rawText, 0)
        rawOuter1 = stripDangerousHtml(outer)
        text1 = outer.slice(bStart)
      } else {
        var bEnd = rtrim(rawText, bStart, cIdx, true)
        if (bEnd > bStart) {
          rawBody1 = stripDangerousHtml(rawText.slice(bStart, bEnd))
        }
        rawClose1 = stripDangerousHtml(trimEndNl(rawText, cIdx))
        text1 = rawText.slice(cStart, cIdx).trim()
      }
    }

    return ret(
      rawEnd,
      makeHtmlNode(
        H.ATTRS | H.BODY | H.CLOSE | H.OUTER | H.VERBATIM,
        tagName1,
        tagResult
          ? processHtmlAttributes(tagResult._attrs, tagName1, opts)
          : {},
        tagResult ? tagResult._wsBefore + tagResult._rawAttrs : undefined,
        [],
        text1 && stripDangerousHtml(text1),
        rawBody1,
        rawClose1,
        rawOuter1
      )
    )
  }

  if (blockType >= 6 && (!tagResult || tagResult._isClosing)) {
    var rawEndF = findNextBlankLine(s, p)
    var isCloseF = tagResult ? true : s.charCodeAt(start + 1) === $.CHAR_SLASH
    var tagF = tagResult
      ? tagResult._tag
      : extractFallbackTag(s.slice(start, rawEndF))
    var rawCloseF: string | undefined
    var rawBodyF: string | undefined
    var rawOuterF: string | undefined
    _keptProps = undefined
    if (isCloseF) {
      var cEndF = tagResult
        ? tagResult._end
        : (() => {
            var g = findChar(s, start, rawEndF, $.CHAR_GT)
            return g === -1 ? rawEndF : g + 1
          })()
      rawCloseF = tagResult
        ? rawCloser(s, start, cEndF, tagF)
        : s.slice(start, cEndF)
      if (cEndF < rawEndF) {
        rawBodyF = screenKeep(s.slice(cEndF, rawEndF))
      }
    } else {
      rawOuterF = screenKeep(s.slice(start, rawEndF))
    }
    return ret(
      nextLineOrEnd(s, rawEndF),
      makeHtmlNode(
        H.BODY |
          H.CLOSE |
          (tagResult ? 0 : H.OUTER) |
          H.VERBATIM |
          (isCloseF ? H.CLOSING : 0),
        tagF,
        {},
        undefined,
        [],
        rawOuterF || rawBodyF || '',
        rawBodyF,
        rawCloseF,
        rawOuterF,
        _keptProps
      )
    )
  }

  if (!tagResult) {
    return null
  }
  var tagName = tagResult._tag
  var tagLower = tagName.toLowerCase()
  var isJsx =
    tagName.charCodeAt(0) >= $.CHAR_A && tagName.charCodeAt(0) <= $.CHAR_Z

  if (
    blockType === 0 &&
    !(
      isJsx ||
      BLOCK_TAGS.has(tagLower) ||
      TYPE1_TAGS.has(tagLower) ||
      tagLower.includes('-')
    )
  ) {
    return null
  }

  if (tagResult._isClosing) {
    return ret(tagResult._end, {
      type: RuleType.htmlSelfClosing,
      tag: tagName,
      attrs: {},
      _rawClose: rawCloser(s, start, tagResult._end, tagName),
      _isClosingTag: true,
    })
  }

  var attrs = processHtmlAttributes(tagResult._attrs, tagName, opts)
  var rawAttrs = tagResult._wsBefore + tagResult._rawAttrs

  if (
    blockType >= 6 &&
    (tagResult._selfClosing || util.isVoidElement(tagName))
  ) {
    return ret(
      tagResult._end +
        (s.charCodeAt(tagResult._end) === $.CHAR_NEWLINE ? 1 : 0),
      makeHtmlNode(H.ATTRS, tagName, attrs, rawAttrs, [], '')
    )
  }

  if (blockType === 0) {
    var jsxCloseEnd = findClosingTag(s, tagResult._end, tagName, s.length)
    if (jsxCloseEnd !== -1) {
      var jsxContent = s.slice(tagResult._end, _closeTagStart)
      var endPos = isBlank(s, jsxCloseEnd, lineEnd(s, jsxCloseEnd))
        ? nextLine(s, jsxCloseEnd)
        : jsxCloseEnd
      var safeOuter = screenKeep(s.slice(start, isJsx ? jsxCloseEnd : endPos))
      var keptOuter = _keptProps
      return ret(
        endPos,
        makeHtmlNode(
          H.ATTRS | H.OUTER | H.VERBATIM,
          tagName,
          attrs,
          rawAttrs,
          parseHtmlChildren(
            jsxContent,
            tagLower,
            state,
            opts,
            HtmlChildrenMode.Component
          ),
          stripDangerousHtml(jsxContent),
          undefined,
          undefined,
          safeOuter,
          keptOuter
        )
      )
    }
    var fbBlank = findNextBlankLine(s, tagResult._end)
    var fbContent = s.slice(tagResult._end, fbBlank)
    var safeFb = screenKeep(fbContent)
    var keptFb = _keptProps
    return ret(
      nextLineOrEnd(s, fbBlank),
      makeHtmlNode(
        H.ATTRS | H.BODY | H.VERBATIM,
        tagName,
        attrs,
        rawAttrs,
        parseHtmlChildren(
          fbContent,
          tagLower,
          state,
          opts,
          HtmlChildrenMode.Unclosed
        ),
        safeFb,
        safeFb,
        undefined,
        undefined,
        keptFb
      )
    )
  }

  var rawEnd6 = findNextBlankLine(s, p)
  var end6 = nextLineOrEnd(s, rawEnd6)
  var blockContent = s.slice(start, rawEnd6)
  var closeIdx = -1
  var closeEndRel = -1
  var blockExtended = false

  if ((state._htmlDepth || 0) < $.MAX_HTML_NESTING_DEPTH) {
    var localCloseEnd = findClosingTag(
      s,
      tagResult._end,
      tagLower,
      rawEnd6,
      false
    )
    if (localCloseEnd !== -1) {
      closeIdx = _closeTagStart - start
      closeEndRel = localCloseEnd - start
    } else if (
      (blockType === 6 || tagResult._isComponentTag) &&
      !isOpenerBeforeBlankLineTag(s, tagResult._end, `</${tagLower}`)
    ) {
      var extCloseEnd = findClosingTag(
        s,
        tagResult._end,
        tagLower,
        nextType1At(s, tagResult._end, false)
      )
      if (
        extCloseEnd !== -1 &&
        _closeTagStart > findNextBlankLine(s, tagResult._end)
      ) {
        rawEnd6 = lineEnd(s, extCloseEnd)
        end6 = nextLine(s, rawEnd6)
        blockContent = s.slice(start, rawEnd6)
        closeIdx = _closeTagStart - start
        closeEndRel = extCloseEnd - start
        blockExtended = true
      }
    }
  }

  var hasMultiLineAttrs = rawAttrs.indexOf('\n') !== -1
  var isCleanBlock =
    closeIdx !== -1 && blockContent.slice(closeEndRel).trim().length === 0
  var useInHtmlBounds = false
  var effectiveEndPos = rawEnd6
  var effectiveEnd = end6

  if (closeIdx !== -1) {
    var closeAbs = start + closeEndRel
    var closeLe = lineEnd(s, closeAbs - 1)
    var slp = skipMask(s, closeAbs, closeLe, F.WS)
    if (slp < closeLe && s.charCodeAt(slp) === $.CHAR_LT) {
      var sib = __parseHtmlTag(s, slp)
      if (sib && !sib._isClosing) {
        useInHtmlBounds = isCleanBlock = true
        effectiveEndPos = effectiveEnd = closeAbs
      }
    }
    if (!useInHtmlBounds) {
      var nls = nextLine(s, closeLe)
      var nlp = nls < rawEnd6 ? skipMask(s, nls, rawEnd6, F.WS) : rawEnd6
      if (
        nlp < rawEnd6 &&
        s.charCodeAt(nlp) === $.CHAR_LT &&
        __parseHtmlTag(s, nlp)
      ) {
        useInHtmlBounds = isCleanBlock = true
        effectiveEndPos = closeLe
        effectiveEnd = nls
      } else if (state.inHTML) {
        useInHtmlBounds = true
        effectiveEndPos = closeLe
        effectiveEnd = nextLine(s, closeLe)
        isCleanBlock = isBlank(s, closeAbs, closeLe)
      }
    }
  }

  var openRelEnd = tagResult._end - start
  var rawContent =
    closeIdx === -1 ? '' : blockContent.slice(openRelEnd, closeIdx)
  var children67 = parseHtmlChildren(
    rawContent,
    tagLower,
    state,
    opts,
    HtmlChildrenMode.Block
  )
  var useVerbatim =
    !blockExtended &&
    (state.inHTML ||
      blockType === 7 ||
      hasMultiLineAttrs ||
      !isCleanBlock ||
      (hasHtmlTag(rawContent) &&
        rawContent.indexOf('\n\n') === -1 &&
        !hasBlockSyntax(rawContent, opts.enforceAtxHeadings === false)))

  if (!useVerbatim) {
    var safeClean = stripDangerousHtml(rawContent)
    return ret(
      effectiveEnd,
      makeHtmlNode(
        H.ATTRS | H.BODY,
        tagName,
        attrs,
        rawAttrs,
        children67,
        safeClean,
        blockExtended ? undefined : safeClean
      )
    )
  }

  var isOuter = false
  var raw67: string
  var emitOwnClose = false
  if (closeIdx !== -1 && useInHtmlBounds) {
    var slEnd = blockContent.indexOf('\n', closeEndRel)
    var slAfter = state.inHTML
      ? blockContent
          .slice(closeEndRel, slEnd < 0 ? blockContent.length : slEnd)
          .trim()
      : ''
    raw67 =
      slAfter.length > 1 &&
      slAfter.charCodeAt(0) === $.CHAR_LT &&
      slAfter.charCodeAt(1) !== $.CHAR_SLASH
        ? blockContent.slice(openRelEnd)
        : rawContent
    emitOwnClose = true
  } else if (useInHtmlBounds || hasMultiLineAttrs) {
    isOuter = true
    raw67 = useInHtmlBounds ? s.slice(start, effectiveEndPos) : blockContent
  } else {
    raw67 = blockContent.slice(openRelEnd)
    if (raw67.charCodeAt(0) === $.CHAR_NEWLINE) {
      raw67 = raw67.slice(1)
    }
  }

  var safeRaw = screenKeep(raw67)
  var inner67 = closeIdx === -1 ? blockContent.slice(openRelEnd) : rawContent
  if (
    !(closeIdx !== -1 && useInHtmlBounds) &&
    inner67.charCodeAt(0) === $.CHAR_NEWLINE
  ) {
    inner67 = inner67.slice(1)
  }
  return ret(
    effectiveEnd,
    makeHtmlNode(
      H.ATTRS |
        H.BODY |
        H.OUTER |
        H.VERBATIM |
        (emitOwnClose ? H.EMIT_CLOSE : 0),
      tagName,
      attrs,
      rawAttrs,
      children67,
      inner67 === raw67 ? safeRaw : stripDangerousHtml(inner67),
      isOuter ? undefined : safeRaw,
      undefined,
      isOuter ? safeRaw : undefined,
      _keptProps
    )
  )
}

var _noCloserRunStartByLength: number[] | null = null
var _noCloserScanFrom = 0

function findCodeSpanEnd(s: string, p: number, e: number): number {
  var openLen = countChar(s, p, e, $.CHAR_BACKTICK)
  if (
    _noCloserRunStartByLength !== null &&
    p >= _noCloserScanFrom &&
    !(_noCloserRunStartByLength[openLen] > p)
  ) {
    return -1
  }
  for (var i = p + openLen; i < e; ) {
    var j = s.indexOf('`', i)
    if (j < 0 || j >= e) {
      break
    }
    var closeLen = countChar(s, j, e, $.CHAR_BACKTICK)
    if (closeLen === openLen) {
      return j + closeLen
    }
    i = j + closeLen
  }
  _noCloserRunStartByLength = []
  _noCloserScanFrom = p
  for (i = p + openLen; i < e; ) {
    j = s.indexOf('`', i)
    if (j < 0 || j >= e) {
      break
    }
    closeLen = countChar(s, j, e, $.CHAR_BACKTICK)
    _noCloserRunStartByLength[closeLen] = j
    i = j + closeLen
  }
  return -1
}

function unescapeCellPipes(cell: string): string {
  if (cell.indexOf('\\|') === -1) {
    return cell
  }
  var out = ''
  var seg = 0
  for (var i = 0; i < cell.length; ) {
    if (cell.charCodeAt(i) === $.CHAR_BACKSLASH && i + 1 < cell.length) {
      if (cell.charCodeAt(i + 1) === $.CHAR_PIPE) {
        out += `${cell.slice(seg, i)}|`
        seg = i += 2
      } else {
        i += 2
      }
    } else {
      i++
    }
  }
  return seg < cell.length ? out + cell.slice(seg) : out
}

function splitTableRow(s: string): string[] {
  var rStart = 0
  var rEnd = rtrim(s, 0, s.length, true)
  while (
    rStart < rEnd &&
    (isCF(s.charCodeAt(rStart), F.WS) ||
      s.charCodeAt(rStart) === $.CHAR_RECORD_SEP)
  ) {
    rStart++
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

  var out: string[] = []
  var cellStart = rStart
  var acc = ''
  var savedRunStarts = _noCloserRunStartByLength
  var savedScanFrom = _noCloserScanFrom
  _noCloserRunStartByLength = null
  for (var i = rStart; i <= rEnd; ) {
    var ch = i < rEnd ? s.charCodeAt(i) : $.CHAR_PIPE
    if (ch === $.CHAR_BACKSLASH && i + 1 < rEnd) {
      if (s.charCodeAt(i + 1) === $.CHAR_PIPE) {
        acc += `${s.slice(cellStart, i)}|`
        cellStart = i += 2
      } else {
        i += 2
      }
      continue
    }
    if (ch === $.CHAR_BACKTICK) {
      var csEnd = findCodeSpanEnd(s, i, rEnd)
      i = csEnd === -1 ? i + countChar(s, i, rEnd, $.CHAR_BACKTICK) : csEnd
      continue
    }
    if (ch === $.CHAR_PIPE) {
      out.push(
        unescapeCellPipes(
          (acc ? acc + s.slice(cellStart, i) : s.slice(cellStart, i)).trim()
        )
      )
      cellStart = ++i
      acc = ''
      continue
    }
    i++
  }
  _noCloserRunStartByLength = savedRunStarts
  _noCloserScanFrom = savedScanFrom
  return out
}

function queueTableCells(
  cells: string[],
  state: MarkdownToJSX.State,
  opts: ParseOptions
): MarkdownToJSX.ASTNode[][] {
  var out: MarkdownToJSX.ASTNode[][] = []
  for (var i = 0; i < cells.length; i++) {
    out.push(cells[i] ? queueInline(cells[i], false, state, opts) : [])
  }
  return out
}

function scanTable(
  s: string,
  p: number,
  state: MarkdownToJSX.State,
  opts: ParseOptions
): MarkdownToJSX.ASTNode | null {
  var firstEnd = lineEnd(s, p)
  if (findChar(s, p, firstEnd, $.CHAR_PIPE) < 0) {
    return null
  }
  var secondStart = nextLine(s, firstEnd)
  if (secondStart >= s.length) {
    return null
  }
  var secondEnd = lineEnd(s, secondStart)
  var align = parseDelimiterRow(s, secondStart, secondEnd)
  if (!align) {
    return null
  }
  var headerCells = splitTableRow(s.slice(p, firstEnd))
  if (align.length !== headerCells.length) {
    return null
  }

  var header = queueTableCells(headerCells, state, opts)
  var cells: MarkdownToJSX.ASTNode[][][] = []
  var end = nextLine(s, secondEnd)
  while (end < s.length) {
    var le = lineEnd(s, end)
    if (isBlank(s, end, le)) {
      break
    }
    indent(s, end, le)
    if (
      _indentSpaces < 4 &&
      lineStartsBlock(
        s,
        end,
        end + _indentChars,
        le,
        LineBlockMode.TableRowEnd,
        opts
      )
    ) {
      break
    }
    var rowCells = splitTableRow(s.slice(end, le))
    while (rowCells.length < header.length) {
      rowCells.push('')
    }
    rowCells.length = header.length
    cells.push(queueTableCells(rowCells, state, opts))
    end = nextLine(s, le)
  }
  return opts.optimizeForStreaming && cells.length === 0
    ? null
    : ret(end, { type: RuleType.table, header, cells, align })
}

function parseFootnoteDefinition(
  s: string,
  p: number,
  state: MarkdownToJSX.State
): MarkdownToJSX.ASTNode | null {
  var len = s.length
  var i = p + 2
  while (i < len && s.charCodeAt(i) !== $.CHAR_BRACKET_CLOSE) {
    if (s.charCodeAt(i) === $.CHAR_NEWLINE) {
      return null
    }
    i++
  }
  if (i + 1 >= len || s.charCodeAt(i + 1) !== $.CHAR_COLON) {
    return null
  }
  var label = `^${s.slice(p + 2, i)}`.toLowerCase()
  i = skipMask(s, i + 2, len, F.WS)
  if (i < len && s.charCodeAt(i) === $.CHAR_NEWLINE) {
    i++
    while (s.charCodeAt(i) === $.CHAR_RECORD_SEP) {
      i++
    }
    i = skipMask(s, i, len, F.WS)
  }

  var fnEnd = lineEnd(s, i)
  var content = s.slice(i, fnEnd).trim()
  var end = fnEnd < len ? fnEnd + 1 : len

  while (end < len) {
    var nextLe = lineEnd(s, end)
    if (isBlank(s, end, nextLe)) {
      var afterBlank = nextLine(s, nextLe)
      if (afterBlank < len) {
        indent(s, afterBlank, lineEnd(s, afterBlank))
        if (_indentSpaces >= 2) {
          content += '\n'
          end = afterBlank
          continue
        }
      }
      break
    }
    indent(s, end, nextLe)
    if (_indentSpaces < 2) {
      break
    }
    content += `\n${s.slice(end, nextLe)}`
    end = nextLine(s, nextLe)
  }

  if (state.refs && !state.refs[label]) {
    state.refs[label] = { target: content, title: undefined }
  }
  return ret(end, { type: RuleType.footnote })
}

function scanRefDefinition(
  s: string,
  p: number,
  state: MarkdownToJSX.State
): MarkdownToJSX.ASTNode | null {
  var e = lineEnd(s, p)
  var isLazy = s.charCodeAt(p) === $.CHAR_RECORD_SEP
  indent(s, isLazy ? p + 1 : p, e)
  var i = (isLazy ? p + 1 : p) + _indentChars
  if (_indentSpaces > 3 || s.charCodeAt(i) !== $.CHAR_BRACKET_OPEN) {
    return null
  }
  if (i + 1 < s.length && s.charCodeAt(i + 1) === $.CHAR_CARET) {
    return isLazy ? null : parseFootnoteDefinition(s, i, state)
  }
  var refs =
    state.refs ||
    (state.refs = Object.create(null) as {
      [key: string]: { target: string; title: string | undefined }
    })
  var res = parseRefDef(s, i, refs)
  return res === null ? null : ret(res, { type: RuleType.ref })
}

function continuesParagraph(s: string, p: number, opts: ParseOptions): boolean {
  if (p >= s.length || s.charCodeAt(p) === $.CHAR_RECORD_SEP) {
    return p < s.length
  }
  var le = lineEnd(s, p)
  if (isBlank(s, p, le)) {
    return false
  }
  indent(s, p, le)
  return (
    _indentSpaces >= 4 ||
    !lineStartsBlock(
      s,
      p,
      p + _indentChars,
      le,
      LineBlockMode.ParagraphEnd,
      opts
    )
  )
}

function scanParagraph(
  s: string,
  p: number,
  state: MarkdownToJSX.State,
  opts: ParseOptions
): MarkdownToJSX.ASTNode | null {
  var end = p
  var setext = 0
  var textEnd = 0
  var cachedLe = -1

  while (end < s.length) {
    var le = cachedLe >= 0 ? cachedLe : lineEnd(s, end)
    cachedLe = -1
    if (isBlank(s, end, le)) {
      break
    }
    indent(s, end, le)
    if (_indentSpaces < 4 && textEnd > 0) {
      var sl = setextLevel(s, end + _indentChars, le)
      if (sl) {
        setext = sl
        end = nextLine(s, le)
        break
      }
    }
    textEnd = le

    var nextStart = nextLine(s, le)
    while (
      nextStart < s.length &&
      s.charCodeAt(nextStart) === $.CHAR_RECORD_SEP
    ) {
      le = textEnd = lineEnd(s, nextStart)
      nextStart = nextLine(s, le)
    }
    if (nextStart < s.length) {
      var nextLe = lineEnd(s, nextStart)
      cachedLe = nextLe
      indent(s, nextStart, nextLe)
      if (
        _indentSpaces < 4 &&
        lineStartsBlock(
          s,
          nextStart,
          nextStart + _indentChars,
          nextLe,
          LineBlockMode.ParagraphEnd,
          opts
        )
      ) {
        end = nextStart
        break
      }
    }
    end = nextLine(s, le)
  }

  var contentEnd = rtrim(s, p, setext ? textEnd : end, true)
  var textStart = skipMask(s, p, contentEnd, F.WS)
  if (textStart >= contentEnd) {
    return null
  }
  var text = dropLazyMarkers(s.slice(textStart, contentEnd))
  if (!text) {
    return null
  }
  var children = queueInline(text, true, state, opts)
  return ret(
    end,
    setext
      ? ({
          type: RuleType.heading,
          level: setext as 1 | 2,
          children,
          id: '',
        } as MarkdownToJSX.HeadingNode)
      : ({
          type: RuleType.paragraph,
          children,
        } as MarkdownToJSX.ParagraphNode)
  )
}

interface PendingInline {
  _depth: number | undefined
  _dest: MarkdownToJSX.ASTNode[]
  _flags: number
  _htmlDepth: number | undefined
  _text: string
}

interface PendingOp {
  _dest: MarkdownToJSX.ASTNode[]
  _src: MarkdownToJSX.ASTNode[]
  _unwrap: boolean
}

var _pendingInline: PendingInline[] | null = null
var _pendingOps: PendingOp[] | null = null

function packState(state: MarkdownToJSX.State, breaks: boolean): number {
  return (
    (breaks ? 1 : 0) |
    (state.inline ? 2 : 0) |
    (state.inAnchor ? 4 : 0) |
    (state.inHTML ? 8 : 0) |
    (state.inList ? 16 : 0) |
    (state.inBlockQuote ? 32 : 0) |
    (state._notAtEdge ? 128 : 0)
  )
}

function unpackState(
  state: MarkdownToJSX.State,
  flags: number,
  depth: number | undefined,
  htmlDepth: number | undefined
): void {
  state._breaks = (flags & 1) !== 0
  state.inline = (flags & 2) !== 0
  state.inAnchor = (flags & 4) !== 0
  state.inHTML = (flags & 8) !== 0
  state.inList = (flags & 16) !== 0
  state.inBlockQuote = (flags & 32) !== 0
  state._notAtEdge = (flags & 128) !== 0
  state._depth = depth
  state._htmlDepth = htmlDepth
}

function queueInline(
  text: string,
  breaks: boolean,
  state: MarkdownToJSX.State,
  opts: ParseOptions
): MarkdownToJSX.ASTNode[] {
  if (!_pendingInline) {
    var savedBreaks = state._breaks
    state._breaks = breaks
    var direct = parseInline(text, 0, text.length, state, opts)
    state._breaks = savedBreaks
    return direct
  }
  var dest: MarkdownToJSX.ASTNode[] = []
  _pendingInline.push({
    _depth: state._depth,
    _dest: dest,
    _flags: packState(state, breaks),
    _htmlDepth: state._htmlDepth,
    _text: text,
  })
  return dest
}

function makeTextLink(
  end: number,
  target: string,
  text: string
): MarkdownToJSX.ASTNode {
  return ret(end, {
    type: RuleType.link,
    target,
    title: undefined,
    children: [{ type: RuleType.text, text }],
  })
}

function scanCodeSpan(
  s: string,
  p: number,
  e: number
): MarkdownToJSX.ASTNode | null {
  var openLen = countChar(s, p, e, $.CHAR_BACKTICK)
  var closeEnd = findCodeSpanEnd(s, p, e)
  if (closeEnd === -1) {
    return null
  }
  var content = s.slice(p + openLen, closeEnd - openLen)
  if (content.indexOf('\n') !== -1) {
    content = content.replace(/\n/g, ' ')
  }
  if (
    content.length > 0 &&
    content.charCodeAt(0) === $.CHAR_SPACE &&
    content.charCodeAt(content.length - 1) === $.CHAR_SPACE &&
    countChar(content, 0, content.length, $.CHAR_SPACE) < content.length
  ) {
    content = content.slice(1, -1)
  }
  return ret(closeEnd, { type: RuleType.codeInline, text: content })
}

const TAG_SKIP_BUDGET_FLOOR = 1_048_576
var _tagSkipBudget = TAG_SKIP_BUDGET_FLOOR

function skipInlineHtmlTag(s: string, i: number, e: number): number {
  if (s.charCodeAt(i) !== $.CHAR_LT || _tagSkipBudget <= 0) {
    return i
  }
  if (rawMarkupKind(s, i, e) === 2) {
    var closeIdx = terminatorAt(s, '-->', i + 4)
    return closeIdx < 0 ? i : closeIdx + 3
  }
  var c1 = i + 1 < e ? s.charCodeAt(i + 1) : 0
  if (c1 !== $.CHAR_SLASH && !isCF(c1, F.ALPHA)) {
    return i
  }
  var tag = __parseHtmlTag(s, i, true)
  if (tag === null || tag._end > e) {
    _tagSkipBudget -= e - i
    return i
  }
  return tag._end
}

function isUPunct(code: number, s: string, pos: number): boolean {
  return code < $.CHAR_ASCII_BOUNDARY
    ? Boolean(cc(code) & C_PUNCT)
    : UNICODE_PUNCT_R.test(s[pos])
}

function isUws(code: number, s: string, pos: number): boolean {
  return code < $.CHAR_ASCII_BOUNDARY
    ? Boolean(cc(code) & C_WS)
    : UNICODE_WHITESPACE_R.test(s[pos])
}

interface DelimEntry {
  _active: boolean
  _canClose: boolean
  _canOpen: boolean
  _ch: number
  _idx: number
  _len: number
  _nearestLiveBelow: number
  _text: MarkdownToJSX.TextNode
}

var _lnDepth: number[] = []
var _lnNext: number[] = []
var _lnPrev: number[] = []
var _lnNode: MarkdownToJSX.ASTNode[] = []

function lnPush(
  node: MarkdownToJSX.ASTNode,
  depth: number,
  prev: number,
  next: number
): number {
  var i = _lnNode.length
  _lnNode.push(node)
  _lnDepth[i] = depth
  _lnNext[i] = next
  _lnPrev[i] = prev
  return i
}

var _dLen = 0
var _dOpen = false
var _dClose = false

function collectDelimiter(s: string, p: number, e: number): void {
  var ch = s.charCodeAt(p)
  var len = countChar(s, p, e, ch)
  _dLen = len
  if (len !== 2 && (ch === $.CHAR_TILDE || ch === $.CHAR_EQ)) {
    _dOpen = _dClose = false
    return
  }
  var beforeCode = p > 0 ? s.charCodeAt(p - 1) : $.CHAR_SPACE
  var afterCode = p + len < e ? s.charCodeAt(p + len) : $.CHAR_SPACE
  var beforeWs = isUws(beforeCode, s, p - 1)
  var afterWs = isUws(afterCode, s, p + len)
  var beforePunct = p > 0 && isUPunct(beforeCode, s, p - 1)
  var afterPunct = p + len < e && isUPunct(afterCode, s, p + len)
  var left = !afterWs && (!afterPunct || beforeWs || beforePunct)
  var right = !beforeWs && (!beforePunct || afterWs || afterPunct)
  if (ch === $.CHAR_UNDERSCORE) {
    _dOpen = left && (!right || beforePunct)
    _dClose = right && (!left || afterPunct)
  } else {
    _dOpen = left
    _dClose = right
  }
}

function holdStreamingDelim(s: string, p: number, e: number): boolean {
  if (_dLen !== 2 && s.charCodeAt(p) === $.CHAR_TILDE) {
    return false
  }
  var runEnd = p + _dLen
  var prevC = p > 0 ? s.charCodeAt(p - 1) : $.CHAR_SPACE
  var prevWs = p === 0 || isUws(prevC, s, p - 1)
  if (!_dOpen) {
    return runEnd === e && prevWs
  }
  var nextC = s.charCodeAt(runEnd)
  return (
    prevWs ||
    isUPunct(prevC, s, p - 1) ||
    isUws(nextC, s, runEnd) ||
    isUPunct(nextC, s, runEnd)
  )
}

function processEmphasis(
  nodes: MarkdownToJSX.ASTNode[],
  delims: DelimEntry[],
  held: number[] | null
): void {
  _lnNode.length = 0
  var last = nodes.length - 1
  for (var li = 0; li <= last; li++) {
    lnPush(nodes[li], 0, li - 1, li < last ? li + 1 : -1)
  }
  var head = 0

  var openersBottom = [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]
  var maxNesting = MAX_INLINE_DEPTH - _globalInlineDepth
  var deepestOpenerIdx = -1
  for (var ci = 0; ci < delims.length; ) {
    var closer = delims[ci]
    if (!(closer._active && closer._canClose)) {
      ci++
      continue
    }
    var obKey =
      closer._ch === $.CHAR_TILDE
        ? 12
        : closer._ch === $.CHAR_EQ
          ? 13
          : (closer._ch === $.CHAR_ASTERISK ? 0 : 6) +
            (closer._len % 3) * 2 +
            (closer._canOpen ? 1 : 0)
    var openerIdx = -1
    for (
      var oi = closer._nearestLiveBelow;
      oi > openersBottom[obKey] && oi > deepestOpenerIdx;
    ) {
      var cand = delims[oi]
      if (
        cand._active &&
        cand._ch === closer._ch &&
        cand._canOpen &&
        !(
          (closer._canOpen || cand._canClose) &&
          (cand._len + closer._len) % 3 === 0 &&
          cand._len % 3 !== 0
        )
      ) {
        openerIdx = oi
        break
      }
      oi = cand._nearestLiveBelow
    }
    if (openerIdx < 0) {
      openersBottom[obKey] = ci - 1
      if (!closer._canOpen) {
        closer._active = false
      }
      ci++
      continue
    }

    var opener = delims[openerIdx]
    var useLen = opener._len >= 2 && closer._len >= 2 ? 2 : 1
    opener._len -= useLen
    closer._len -= useLen

    var openLn = opener._idx
    var closeLn = closer._idx
    var openNode = opener._text
    var closeNode = closer._text
    openNode.text = openNode.text.slice(0, openNode.text.length - useLen)
    closeNode.text = closeNode.text.slice(useLen)

    var contentNodes: MarkdownToJSX.ASTNode[] = []
    var contentDepth = 0
    for (
      var walk = _lnNext[openLn];
      walk !== -1 && walk !== closeLn;
      walk = _lnNext[walk]
    ) {
      contentNodes.push(_lnNode[walk])
      if (_lnDepth[walk] > contentDepth) {
        contentDepth = _lnDepth[walk]
      }
    }
    if (contentDepth + 1 >= maxNesting) {
      deepestOpenerIdx = openerIdx
    }
    var emphLn = lnPush(
      {
        type: RuleType.textFormatted,
        tag:
          closer._ch === $.CHAR_TILDE
            ? 'del'
            : closer._ch === $.CHAR_EQ
              ? 'mark'
              : useLen === 2
                ? 'strong'
                : 'em',
        children: contentNodes,
      },
      contentDepth + 1,
      openLn,
      closeLn
    )
    _lnNext[openLn] = emphLn
    _lnPrev[closeLn] = emphLn

    for (
      var di = closer._nearestLiveBelow;
      di > openerIdx;
      di = delims[di]._nearestLiveBelow
    ) {
      delims[di]._active = false
    }
    closer._nearestLiveBelow = openerIdx
    if (opener._len === 0) {
      opener._active = false
      if (!openNode.text) {
        var before = _lnPrev[openLn]
        _lnPrev[emphLn] = before
        if (before === -1) {
          head = emphLn
        } else {
          _lnNext[before] = emphLn
        }
      }
    }
    if (closer._len === 0) {
      closer._active = false
      if (!closeNode.text) {
        var after = _lnNext[closeLn]
        _lnNext[emphLn] = after
        if (after !== -1) {
          _lnPrev[after] = emphLn
        }
      }
      ci++
    }
  }

  if (held) {
    for (var hk = 0; hk < held.length; hk++) {
      var hd = delims[held[hk]]
      if (hd._active && hd._len > 0) {
        hd._text.text = ''
      }
    }
  }

  var wi = 0
  for (var cur = head; cur !== -1; cur = _lnNext[cur]) {
    var n = _lnNode[cur]
    if (n.type === RuleType.text) {
      var tn = n as MarkdownToJSX.TextNode
      if (!tn.text) {
        continue
      }
      if (wi > 0 && nodes[wi - 1].type === RuleType.text) {
        ;(nodes[wi - 1] as MarkdownToJSX.TextNode).text += tn.text
        continue
      }
    }
    nodes[wi++] = n
  }
  nodes.length = wi
  _lnNode.length = 0
}

function ensureLinkMemo(
  memo: Int32Array | null,
  span: number,
  e: number
): Int32Array | null {
  if (memo === null && span >= LINK_TEXT_MEMO_MIN_SPAN) {
    _linkTextMatch = new Int32Array(e)
    return _linkTextMatch
  }
  return memo
}

function scanLink(
  s: string,
  p: number,
  e: number,
  state: MarkdownToJSX.State,
  opts: ParseOptions
): MarkdownToJSX.ASTNode | null {
  var isImage = s.charCodeAt(p) === $.CHAR_EXCLAMATION
  var start = isImage ? p + 1 : p
  if (
    s.charCodeAt(start) !== $.CHAR_BRACKET_OPEN ||
    (_linkNoCloseGen === _scanGen && start >= _linkNoCloseFrom)
  ) {
    return null
  }
  var memo = _linkTextMatch
  var shift = _linkTextMatchShift
  var cached = memo === null ? 0 : memo[start + shift]
  if (cached < 0) {
    return null
  }

  var i = cached > 0 ? cached - shift : 0
  if (cached === 0) {
    var cb = s.indexOf(']', start + 1)
    if (cb < 0 || cb >= e) {
      _linkNoCloseFrom = start
      _linkNoCloseGen = _scanGen
      return null
    }
    i = start + 1
    var sp = 0
    _linkBracketStack[sp++] = start
    while (i < e && sp > 0) {
      var c = s.charCodeAt(i)
      if (c === $.CHAR_BACKSLASH && i + 1 < e) {
        i += 2
        continue
      }
      if (c === $.CHAR_BACKTICK) {
        var csEnd = findCodeSpanEnd(s, i, e)
        i = csEnd === -1 ? i + countChar(s, i, e, $.CHAR_BACKTICK) : csEnd
        continue
      }
      if (c === $.CHAR_LT) {
        var autoEnd = matchAutolinkEnd(s, i, e)
        if (autoEnd !== -1) {
          i = autoEnd
          continue
        }
        var afterHtml = skipInlineHtmlTag(s, i, e)
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
        memo = ensureLinkMemo(memo, i - start, e)
        if (memo !== null) {
          memo[opener + shift] = i + 1 + shift
        }
      }
      i++
    }
    if (sp > 0) {
      memo = ensureLinkMemo(memo, i - start, e)
      if (memo !== null) {
        while (sp > 0) {
          memo[_linkBracketStack[--sp] + shift] = -1
        }
      }
      return null
    }
  }

  var textEnd = i - 1
  var text = s.slice(start + 1, textEnd)
  var nextChar = i < e ? s.charCodeAt(i) : 0
  var url: string | undefined
  var title: string | undefined
  var endPos = i

  if (nextChar === $.CHAR_PAREN_OPEN) {
    var k = skipMask(s, i + 1, e, F.SPNL)
    var destEnd = scanLinkDest(s, k, e, false, true)
    if (destEnd >= 0) {
      var candUrl = _scannedDest
      k = skipMask(s, destEnd, e, F.SPNL)
      var candTitle: string | undefined
      var ok = true
      var tc = k < e ? s.charCodeAt(k) : 0
      if (
        tc === $.CHAR_DOUBLE_QUOTE ||
        tc === $.CHAR_SINGLE_QUOTE ||
        tc === $.CHAR_PAREN_OPEN
      ) {
        var tEnd = scanLinkTitle(s, k, e, false)
        if (tEnd < 0) {
          ok = false
        } else {
          candTitle = _scannedTitle
          k = skipMask(s, tEnd, e, F.SPNL)
        }
      }
      if (ok && k < e && s.charCodeAt(k) === $.CHAR_PAREN_CLOSE) {
        url = util.decodeEntityReferences(unescapeString(candUrl))
        title =
          candTitle === undefined
            ? undefined
            : util.decodeEntityReferences(unescapeString(candTitle))
        endPos = k + 1
      }
    }
  }

  if (url === undefined) {
    var refEnd = -1
    var ref = ''
    if (nextChar === $.CHAR_BRACKET_OPEN) {
      refEnd = scanBracketLabelEnd(s, i + 1, e)
      if (refEnd === -1) {
        return null
      }
      ref = s.slice(i + 1, refEnd)
    }
    var label: string
    if (ref.trim()) {
      label = normalizeLabel(ref)
    } else {
      if (hasUnescapedBracket(text)) {
        return null
      }
      label = normalizeLabel(text)
    }
    endPos = (refEnd >= 0 ? refEnd : textEnd) + 1
    var refData = state.refs?.[label]
    if (!refData || label.charCodeAt(0) === $.CHAR_CARET) {
      return null
    }
    url = refData.target
    title = refData.title
  }

  if (isImage) {
    return ret(endPos, {
      type: RuleType.image,
      target: opts.sanitizer(url, 'img', 'src') === null ? null : url,
      alt: extractText(parseInline(text, 0, text.length, state, opts)),
      title,
    })
  }
  var savedAnchor = state.inAnchor
  state.inAnchor = true
  var children: MarkdownToJSX.ASTNode[] = [{ type: RuleType.text, text }]
  if (!savedAnchor) {
    _nestedLinkTextShift = memo === null ? -1 : shift + start + 1
    children = parseInline(text, 0, text.length, state, opts)
  }
  state.inAnchor = savedAnchor
  return !state.inAnchor && containsLink(children)
    ? null
    : ret(endPos, {
        type: RuleType.link,
        target: opts.sanitizer(url, 'a', 'href') === null ? null : url,
        title,
        children,
      })
}

function isValidEmailDomain(s: string, p: number, e: number): boolean {
  if (p >= e) {
    return false
  }
  var labelStart = p
  for (var i = p; i < e; i++) {
    var c = s.charCodeAt(i)
    if (c === $.CHAR_PERIOD) {
      if (
        i === labelStart ||
        i - labelStart > 63 ||
        s.charCodeAt(labelStart) === $.CHAR_DASH ||
        s.charCodeAt(i - 1) === $.CHAR_DASH
      ) {
        return false
      }
      labelStart = i + 1
    } else if (!util.isAlnumCode(c) && c !== $.CHAR_DASH) {
      return false
    }
  }
  return (
    labelStart < e &&
    e - labelStart <= 63 &&
    s.charCodeAt(labelStart) !== $.CHAR_DASH &&
    s.charCodeAt(e - 1) !== $.CHAR_DASH
  )
}

var _autoIsMail = false

function matchAutolinkEnd(s: string, p: number, e: number): number {
  if (s.charCodeAt(p) !== $.CHAR_LT) {
    return -1
  }
  var start = p + 1
  var i = scanUntil(s, start, e, F.URL_STOP)
  if (i >= e || s.charCodeAt(i) !== $.CHAR_GT || i === start) {
    return -1
  }
  if (isASCIILetter(s.charCodeAt(start))) {
    for (var k = start + 1; k < i; k++) {
      var c = s.charCodeAt(k)
      if (c === $.CHAR_COLON) {
        if (k - start >= 2 && k - start <= 32) {
          var ok = true
          for (var u = k + 1; u < i; u++) {
            if (s.charCodeAt(u) <= $.CHAR_SPACE) {
              ok = false
              break
            }
          }
          if (ok) {
            _autoIsMail = false
            return i + 1
          }
        }
        break
      }
      if (
        !util.isAlnumCode(c) &&
        c !== $.CHAR_PLUS &&
        c !== $.CHAR_PERIOD &&
        c !== $.CHAR_DASH
      ) {
        break
      }
    }
  }
  var localEnd = skipMask(s, start, i, F.EMAIL)
  if (
    localEnd > start &&
    localEnd < i &&
    s.charCodeAt(localEnd) === $.CHAR_AT &&
    isValidEmailDomain(s, localEnd + 1, i)
  ) {
    _autoIsMail = true
    return i + 1
  }
  return -1
}

function scanAutolink(
  s: string,
  p: number,
  e: number
): MarkdownToJSX.ASTNode | null {
  var end = matchAutolinkEnd(s, p, e)
  if (end === -1) {
    return null
  }
  var content = s.slice(p + 1, end - 1)
  return makeTextLink(end, _autoIsMail ? `mailto:${content}` : content, content)
}

function scanFootnoteRef(
  s: string,
  p: number,
  e: number,
  state: MarkdownToJSX.State,
  opts: ParseOptions
): MarkdownToJSX.ASTNode | null {
  var i = p + 2
  while (i < e) {
    var c = s.charCodeAt(i)
    if (
      c === $.CHAR_BRACKET_CLOSE ||
      c === $.CHAR_BRACKET_OPEN ||
      c === $.CHAR_NEWLINE
    ) {
      break
    }
    i++
  }
  if (i >= e || s.charCodeAt(i) !== $.CHAR_BRACKET_CLOSE || i === p + 2) {
    return null
  }
  var id = s.slice(p + 2, i)
  return opts.optimizeForStreaming || state.refs?.[`^${id}`.toLowerCase()]
    ? ret(i + 1, {
        type: RuleType.footnoteReference,
        target: `#${util.slugify(id)}`,
        text: id,
      })
    : null
}

interface BareUrlRun {
  _bracketClosers: number[] | null
  _bracketDepth: number
  _bracketWitnesses: number[] | null
  _dot: number
  _end: number
  _eqOpen: boolean
  _from: number
  _group: number
  _groupUnderscore: number
  _lastSlash: number
  _parenClosers: number[] | null
  _parenDepth: number
  _parenWitnesses: number[] | null
  _slash: number
  _tildeOpen: boolean
  _trimEnd: number
}

function newBareUrlRun(): BareUrlRun {
  return {
    _bracketClosers: null,
    _bracketDepth: 0,
    _bracketWitnesses: null,
    _dot: -1,
    _end: -1,
    _eqOpen: false,
    _from: 0,
    _group: -1,
    _groupUnderscore: -1,
    _lastSlash: -1,
    _parenClosers: null,
    _parenDepth: 0,
    _parenWitnesses: null,
    _slash: -1,
    _tildeOpen: false,
    _trimEnd: -1,
  }
}

function sweepDomainUnderscore(
  s: string,
  lo: number,
  hi: number,
  mark: number,
  run: BareUrlRun
): number {
  var lastDot = -1
  var under = -1
  var atMark = -1
  for (var x = lo; x < hi; x++) {
    if (x === mark) {
      atMark = under
    }
    var c = s.charCodeAt(x)
    if (c === $.CHAR_PERIOD) {
      if (under < lastDot) {
        under = -1
      }
      lastDot = x
    } else if (c === $.CHAR_UNDERSCORE) {
      under = x
    } else if (c === $.CHAR_PAREN_CLOSE && x >= mark) {
      ;(run._parenWitnesses || (run._parenWitnesses = [])).push(under)
    } else if (c === $.CHAR_BRACKET_CLOSE && x >= mark) {
      ;(run._bracketWitnesses || (run._bracketWitnesses = [])).push(under)
    }
  }
  return mark >= hi ? under : atMark
}

var BARE_URL_HEADS = [$.CHAR_h, $.CHAR_h, $.CHAR_f, $.CHAR_w]
var BARE_URL_TAILS = ['ttps://', 'ttp://', 'tp://', 'ww.']

function scanBareUrl(
  s: string,
  p: number,
  e: number,
  run: BareUrlRun
): MarkdownToJSX.ASTNode | null {
  var prefixLen = 0
  var isWww = false
  var c0 = s.charCodeAt(p)
  for (var pi = 0; pi < 4; pi++) {
    var tail = BARE_URL_TAILS[pi]
    if (
      c0 === BARE_URL_HEADS[pi] &&
      p + 1 + tail.length <= e &&
      s.startsWith(tail, p + 1)
    ) {
      prefixLen = 1 + tail.length
      isWww = pi === 3
      break
    }
  }
  if (!prefixLen) {
    return null
  }

  var dStart = p + prefixLen
  if (p >= run._end) {
    var parenDepth = 0
    var bracketDepth = 0
    var dot = -1
    var firstSlash = -1
    var lastSlash = -1
    var i = dStart
    while (i < e) {
      var rc = s.charCodeAt(i)
      if (isCF(rc, F.URL_STOP)) {
        break
      }
      if (rc === $.CHAR_PAREN_OPEN) {
        parenDepth--
      } else if (rc === $.CHAR_PAREN_CLOSE) {
        parenDepth++
      } else if (rc === $.CHAR_BRACKET_OPEN) {
        bracketDepth--
      } else if (rc === $.CHAR_BRACKET_CLOSE) {
        bracketDepth++
      } else if (
        rc === $.CHAR_BACKSLASH &&
        i + 1 < e &&
        s.charCodeAt(i + 1) === $.CHAR_BRACKET_CLOSE
      ) {
        break
      } else if (
        rc === $.CHAR_EQ ? run._eqOpen : rc === $.CHAR_TILDE && run._tildeOpen
      ) {
        collectDelimiter(s, i, e)
        if (_dClose) {
          break
        }
        i += _dLen - 1
      } else if (rc === $.CHAR_PERIOD) {
        dot = i
      } else if (rc === $.CHAR_SLASH) {
        if (firstSlash < 0) {
          firstSlash = i
        }
        lastSlash = i
      }
      i++
    }
    run._bracketDepth = bracketDepth
    run._dot = dot
    run._end = i
    run._from = p
    run._lastSlash = lastSlash
    run._parenDepth = parenDepth
    run._slash = firstSlash
    run._trimEnd = -1
  } else {
    for (var fi = run._from; fi < p; fi++) {
      var fc = s.charCodeAt(fi)
      if (fc === $.CHAR_PAREN_OPEN) {
        run._parenDepth++
      } else if (fc === $.CHAR_PAREN_CLOSE) {
        run._parenDepth--
      } else if (fc === $.CHAR_BRACKET_OPEN) {
        run._bracketDepth++
      } else if (fc === $.CHAR_BRACKET_CLOSE) {
        run._bracketDepth--
      }
    }
    run._from = p
  }

  if (isWww && run._dot < dStart) {
    return null
  }

  var slash = -1
  if (run._lastSlash >= dStart) {
    if (run._slash < dStart) {
      run._slash = s.indexOf('/', dStart)
    }
    slash = run._slash
    if (run._group !== slash) {
      run._groupUnderscore = sweepDomainUnderscore(s, dStart, slash, slash, run)
      run._group = slash
    }
    if (run._groupUnderscore >= dStart) {
      return null
    }
  }

  if (run._trimEnd < 0) {
    if (run._parenClosers !== null) {
      run._parenClosers.length = 0
    }
    if (run._bracketClosers !== null) {
      run._bracketClosers.length = 0
    }
    var end = run._end
    while (end > dStart) {
      var tc = s.charCodeAt(end - 1)
      if (isCF(tc, F.URL_TRIM)) {
        if (tc === $.CHAR_PAREN_CLOSE) {
          ;(run._parenClosers || (run._parenClosers = [])).push(end - 1)
        } else if (tc === $.CHAR_BRACKET_CLOSE) {
          ;(run._bracketClosers || (run._bracketClosers = [])).push(end - 1)
        }
        end--
      } else if (tc === $.CHAR_SEMICOLON) {
        var amp = end - 2
        while (amp > p && util.isAlnumCode(s.charCodeAt(amp))) {
          amp--
        }
        end = amp >= p && s.charCodeAt(amp) === $.CHAR_AMPERSAND ? amp : end - 1
      } else {
        break
      }
    }
    run._trimEnd = end
  }

  var parenTrim = run._parenDepth > 0 ? run._parenDepth : 0
  var bracketTrim = run._bracketDepth > 0 ? run._bracketDepth : 0
  var parens = run._parenClosers
  var brackets = run._bracketClosers
  var keptParen =
    parens !== null && parenTrim < parens.length ? parens[parenTrim] : -1
  var keptBracket =
    brackets !== null && bracketTrim < brackets.length
      ? brackets[bracketTrim]
      : -1
  var kept = keptParen > keptBracket ? keptParen : keptBracket
  var urlEnd = kept >= 0 ? kept + 1 : run._trimEnd
  if (slash < 0) {
    if (run._group !== run._end) {
      if (run._parenWitnesses !== null) {
        run._parenWitnesses.length = 0
      }
      if (run._bracketWitnesses !== null) {
        run._bracketWitnesses.length = 0
      }
      run._groupUnderscore = sweepDomainUnderscore(
        s,
        dStart,
        run._end,
        run._trimEnd,
        run
      )
      run._group = run._end
    }
    if (urlEnd <= dStart) {
      return null
    }
    var underscore = run._groupUnderscore
    if (keptParen > keptBracket && parens !== null && run._parenWitnesses) {
      underscore = run._parenWitnesses[parens.length - 1 - parenTrim]
    } else if (keptBracket >= 0 && brackets !== null && run._bracketWitnesses) {
      underscore = run._bracketWitnesses[brackets.length - 1 - bracketTrim]
    }
    if (underscore >= dStart) {
      return null
    }
  }

  var url = s.slice(p, urlEnd)
  return makeTextLink(urlEnd, isWww ? `http://${url}` : url, url)
}

function scanBareEmail(
  s: string,
  p: number,
  e: number
): MarkdownToJSX.ASTNode | null {
  var i = skipMask(s, p, e, F.EMAIL)
  if (i === p || i >= e || s.charCodeAt(i) !== $.CHAR_AT) {
    return null
  }
  var domainStart = ++i
  var lastDot = -1
  var labelStart = i
  while (i < e) {
    var c = s.charCodeAt(i)
    if (
      util.isAlnumCode(c) ||
      ((c === $.CHAR_DASH || c === $.CHAR_UNDERSCORE) && i > domainStart)
    ) {
      i++
    } else if (c === $.CHAR_PERIOD) {
      var prev = i > domainStart ? s.charCodeAt(i - 1) : $.CHAR_DASH
      if (
        i - labelStart > 63 ||
        prev === $.CHAR_DASH ||
        prev === $.CHAR_UNDERSCORE ||
        i + 1 >= e ||
        !util.isAlnumCode(s.charCodeAt(i + 1))
      ) {
        break
      }
      lastDot = i
      labelStart = ++i
    } else {
      break
    }
  }
  if (
    i - labelStart > 63 ||
    lastDot < 0 ||
    i <= lastDot + 1 ||
    !util.isAlnumCode(s.charCodeAt(i - 1))
  ) {
    return null
  }
  var email = s.slice(p, i)
  return makeTextLink(i, `mailto:${email}`, email)
}

function containsLink(nodes: MarkdownToJSX.ASTNode[]): boolean {
  for (var i = 0; i < nodes.length; i++) {
    var n = nodes[i]
    if (
      n.type === RuleType.link ||
      ('children' in n &&
        Array.isArray((n as AstNodeWithChildren).children) &&
        containsLink((n as AstNodeWithChildren).children))
    ) {
      return true
    }
  }
  return false
}

function extractText(
  nodes: MarkdownToJSX.ASTNode[],
  omitImages?: boolean
): string {
  var result = ''
  for (var i = 0; i < nodes.length; i++) {
    var n = nodes[i]
    if (
      n.type === RuleType.text ||
      n.type === RuleType.codeInline ||
      n.type === RuleType.footnoteReference
    ) {
      result += (n as MarkdownToJSX.TextNode).text
    } else if (n.type === RuleType.breakLine) {
      result += ' '
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

function assignHeadingIds(
  nodes: MarkdownToJSX.ASTNode[],
  state: MarkdownToJSX.State,
  slugify: (input: string) => string
): void {
  for (var i = 0; i < nodes.length; i++) {
    var n = nodes[i]
    var t = n.type
    if (t === RuleType.heading) {
      var h = n as MarkdownToJSX.HeadingNode
      h.id = uniqueHeadingId(slugify(extractText(h.children, true)), state)
    } else if (
      t === RuleType.blockQuote ||
      t === RuleType.htmlBlock ||
      (_hasInlineHtmlBlock &&
        (t === RuleType.paragraph ||
          t === RuleType.link ||
          t === RuleType.textFormatted))
    ) {
      assignHeadingIds((n as AstNodeWithChildren).children, state, slugify)
    } else if (t === RuleType.orderedList || t === RuleType.unorderedList) {
      var items = (n as MarkdownToJSX.OrderedListNode).items
      for (var j = 0; j < items.length; j++) {
        assignHeadingIds(items[j], state, slugify)
      }
    }
  }
}

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
    var maxDigits = isHex ? 6 : 7
    var endNum = skipMask(
      s,
      i,
      Math.min(e, i + maxDigits + 1),
      isHex ? F.HEX : F.DIGIT
    )
    return endNum > i &&
      endNum - i <= maxDigits &&
      endNum < e &&
      s.charCodeAt(endNum) === $.CHAR_SEMICOLON
      ? endNum + 1
      : -1
  }
  var end = skipMask(s, i, Math.min(e, i + 48), F.ALPHA | F.DIGIT)
  return end > i && end < e && s.charCodeAt(end) === $.CHAR_SEMICOLON
    ? end + 1
    : -1
}

function scanInlineHtml(
  s: string,
  p: number,
  e: number,
  state: MarkdownToJSX.State,
  opts: ParseOptions
): MarkdownToJSX.ASTNode | null {
  var i = p + 1
  if (i >= e) {
    return null
  }
  var ch = s.charCodeAt(i)
  if (ch === $.CHAR_EXCLAMATION || ch === $.CHAR_QUESTION) {
    return scanRawMarkup(s, p, e, false)
  }
  if (ch === $.CHAR_SLASH) {
    var ne = scanTagName(s, i + 1, e)
    var j = ne > i + 1 ? skipMask(s, ne, e, F.WSNL) : e
    return j < e && s.charCodeAt(j) === $.CHAR_GT
      ? ret(j + 1, {
          type: RuleType.htmlSelfClosing,
          tag: s.slice(i + 1, ne),
          attrs: {},
          _rawClose: s.slice(p, j + 1),
          _isClosingTag: true,
        })
      : null
  }
  if (!isASCIILetter(ch)) {
    return null
  }
  var tagResult = __parseHtmlTag(s, p)
  if (!tagResult) {
    return null
  }
  var tagName = tagResult._tag
  var tagLower = tagName.toLowerCase()
  var attrs = processHtmlAttributes(tagResult._attrs, tagName, opts)
  var closeEnd =
    tagResult._selfClosing || util.isVoidElement(tagName)
      ? -1
      : findClosingTag(s, tagResult._end, tagName, e)

  if (closeEnd === -1) {
    return ret(tagResult._end, {
      type: RuleType.htmlSelfClosing,
      tag: tagName,
      attrs,
      _rawOpen: tagResult._sanitized
        ? reconstructOpenTag(tagResult)
        : s.slice(p, tagResult._end),
      _isClosingTag: false,
    })
  }

  var closeStart = _closeTagStart
  var inner = s.slice(tagResult._end, closeStart)
  if (TYPE1_TAGS.has(tagLower)) {
    var type1Body = stripDangerousHtml(inner)
    return ret(
      closeEnd,
      makeHtmlNode(
        H.ATTRS | H.BODY | H.CLOSE | H.VERBATIM,
        tagName,
        attrs,
        tagResult._wsBefore + tagResult._rawAttrs,
        [],
        type1Body,
        type1Body || undefined,
        rawCloser(s, closeStart, closeEnd, tagName)
      )
    )
  }
  return ret(
    closeEnd,
    makeHtmlNode(
      H.ATTRS,
      tagName,
      attrs,
      tagResult._rawAttrs,
      parseHtmlChildren(inner, tagLower, state, opts, HtmlChildrenMode.Inline),
      stripDangerousHtml(inner)
    )
  )
}

function stripIncompleteLinks(s: string): string {
  if (s.indexOf('[') === -1) {
    return s
  }
  var n = s.length
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
    if (ci >= 0 && ci + 1 < end) {
      var ac = s.charCodeAt(ci + 1)
      if (ac !== $.CHAR_PAREN_OPEN && ac !== $.CHAR_BRACKET_OPEN) {
        skipped.push(i)
        i = ci
        continue
      }
      var want =
        ac === $.CHAR_PAREN_OPEN ? $.CHAR_PAREN_CLOSE : $.CHAR_BRACKET_CLOSE
      var j = findChar(s, ci + 2, end, want)
      if (j !== -1) {
        i = j
        continue
      }
    }
    if (image) {
      end = i - 1
      var last = skipped.pop()
      if (last !== undefined && close[last] === end - 1) {
        i = last - 1
        continue
      }
      break
    }
    close[i] = -2
    if (ci >= 0) {
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

function unclosedBacktickPos(s: string, end: number): number {
  var unclosed = -1
  var savedRunStarts = _noCloserRunStartByLength
  var savedScanFrom = _noCloserScanFrom
  _noCloserRunStartByLength = null
  for (var i = s.indexOf('`'); i !== -1 && i < end; i = s.indexOf('`', i)) {
    var backslashes = 0
    while (
      i - backslashes > 0 &&
      s.charCodeAt(i - backslashes - 1) === $.CHAR_BACKSLASH
    ) {
      backslashes++
    }
    if (backslashes % 2 === 1) {
      i++
      continue
    }
    var spanEnd = findCodeSpanEnd(s, i, end)
    if (spanEnd === -1) {
      unclosed = i
      break
    }
    i = spanEnd
  }
  _noCloserRunStartByLength = savedRunStarts
  _noCloserScanFrom = savedScanFrom
  return unclosed
}

function tableLineKind(s: string, start: number, end: number): number {
  var hasDash = false
  for (var i = start; i < end; i++) {
    var c = s.charCodeAt(i)
    if (c === $.CHAR_DASH) {
      hasDash = true
    } else if (
      c !== $.CHAR_SPACE &&
      c !== $.CHAR_TAB &&
      c !== $.CHAR_PIPE &&
      c !== $.CHAR_COLON
    ) {
      return 0
    }
  }
  return hasDash ? 2 : 1
}

function stripUnclosedStreamingTag(s: string, isBlock: boolean): string {
  var hi = s.lastIndexOf('<')
  if (hi === -1) {
    return s
  }
  var hc = hi + 1 < s.length ? s.charCodeAt(hi + 1) : 0
  var isLetter = isBlock ? isASCIILetter(hc) : hc >= $.CHAR_A && hc <= $.CHAR_Z
  var isClose =
    isBlock &&
    hc === $.CHAR_SLASH &&
    hi + 2 < s.length &&
    isASCIILetter(s.charCodeAt(hi + 2))
  if (
    !(
      isLetter ||
      (isBlock &&
        (isClose ||
          hc === $.CHAR_EXCLAMATION ||
          hc === $.CHAR_QUESTION ||
          hi + 1 >= rtrim(s, hi + 1, s.length, false)))
    ) ||
    (isBlock && isLetter && matchAutolinkEnd(s, hi, s.length) !== -1) ||
    unclosedBacktickPos(s, hi) !== -1
  ) {
    return s
  }
  var hn =
    isLetter || isClose
      ? skipMask(s, hi + (isClose ? 2 : 1), s.length, F.ALPHA | F.DIGIT)
      : hi + 2
  var hg = s.indexOf('>', hn)
  if (hg === -1) {
    return isBlock ? s.slice(0, hi) : s
  }
  if (
    isLetter &&
    (isBlock || hn === hg || isCF(s.charCodeAt(hn), F.ASCII_WS)) &&
    s.charCodeAt(hg - 1) !== $.CHAR_SLASH &&
    !(isBlock && util.isVoidElement(s.slice(hi + 1, hn))) &&
    indexOfCi(s, `</${s.slice(hi + 1, hn)}`, 0, s.length) === -1
  ) {
    return s.slice(0, hi) + s.slice(hg + 1)
  }
  return s
}

function trimStreamingInlineEdge(content: string): string {
  var bt = unclosedBacktickPos(content, content.length)
  if (bt !== -1) {
    content = content.slice(0, bt)
  }
  return stripUnclosedStreamingTag(stripIncompleteLinks(content), false)
}

function trimStreamingBlockEdge(s: string): string {
  var tblEnd = rtrim(s, 0, s.length, false)
  var tblStart = prevLineStart(s, tblEnd)
  if (tblEnd > tblStart && s.charCodeAt(tblStart) === $.CHAR_PIPE) {
    var trailingHasContent = tableLineKind(s, tblStart + 1, tblEnd) === 0
    var dividerAbove = false
    var bodyRowsBetween = 0
    var fragmentStart = tblStart
    for (var upEnd = tblStart - 1; upEnd > 0; ) {
      var upStart = prevLineStart(s, upEnd)
      if (s.charCodeAt(upStart) !== $.CHAR_PIPE) {
        break
      }
      fragmentStart = upStart
      if (tableLineKind(s, upStart, upEnd) === 2) {
        dividerAbove = true
      } else if (!dividerAbove) {
        bodyRowsBetween++
      }
      upEnd = upStart - 1
    }
    if (!trailingHasContent) {
      s = s
        .slice(
          0,
          dividerAbove && bodyRowsBetween > 0 ? tblStart : fragmentStart
        )
        .trimEnd()
    } else if (!dividerAbove) {
      s = s.slice(0, tblStart).trimEnd()
    }
  }

  s = stripUnclosedStreamingTag(s, true)

  var stEnd = rtrim(s, 0, s.length, false)
  if (stEnd > 0) {
    var stLs = prevLineStart(s, stEnd)
    var stP = stLs + Math.min(3, countChar(s, stLs, stEnd, $.CHAR_SPACE))
    if (
      stLs > 0 &&
      stP < stEnd &&
      setextLevel(s, stP, stEnd) &&
      !isBlank(s, prevLineStart(s, stLs - 1), stLs - 1)
    ) {
      s = s.slice(0, stLs).trimEnd()
    }
  }

  if (s.length > 0) {
    var llStart = prevLineStart(s, s.length)
    if (checkListMarker(s, llStart, s.length)?._isEmpty) {
      s = s.slice(0, llStart).trimEnd()
    }
  }
  return s
}

const MAX_INLINE_DEPTH = 200
var _globalInlineDepth = 0

function pushText(
  nodes: MarkdownToJSX.ASTNode[],
  pending: string,
  s: string,
  from: number,
  to: number
): string {
  if (pending || to > from) {
    nodes.push({ type: RuleType.text, text: pending + s.slice(from, to) })
  }
  return ''
}

function parseInline(
  s: string,
  p: number,
  e: number,
  state: MarkdownToJSX.State,
  opts: ParseOptions
): MarkdownToJSX.ASTNode[] {
  var sharedLinkTextShift = _nestedLinkTextShift
  _nestedLinkTextShift = -1
  if (++_globalInlineDepth > MAX_INLINE_DEPTH) {
    _globalInlineDepth--
    return [{ type: RuleType.text, text: s.slice(p, e) }]
  }

  var savedScanGen = _scanGen
  _scanGen = nextScanGeneration()
  var savedLinkTextMatch = _linkTextMatch
  var savedLinkTextShift = _linkTextMatchShift
  if (sharedLinkTextShift < 0) {
    _linkTextMatch = null
    _linkTextMatchShift = 0
  } else {
    _linkTextMatchShift = sharedLinkTextShift
  }
  var savedNoEndFrom = _noEndFrom
  _noEndFrom = null
  var savedRunStarts = _noCloserRunStartByLength
  var savedScanFrom = _noCloserScanFrom
  _noCloserRunStartByLength = null
  var savedDoc = _doc

  var streamEdge =
    opts.optimizeForStreaming === true &&
    _globalInlineDepth === 1 &&
    !state._notAtEdge

  if (streamEdge) {
    var orig = s.slice(p, e)
    var trimmed = trimStreamingInlineEdge(orig)
    if (trimmed !== orig) {
      s = s.slice(0, p) + trimmed
      e = p + trimmed.length
    }
  }

  var nodes: MarkdownToJSX.ASTNode[] = []
  var delimStack: DelimEntry[] = []
  var held: number[] | null = null
  var textStart = p
  var pending = ''
  var nextAtPos =
    opts.disableAutoLink || state.inAnchor ? -1 : s.indexOf('@', p)
  if (nextAtPos >= e) {
    nextAtPos = -1
  }
  var urlRun: BareUrlRun | null = null
  var eqOpen = 0
  var tildeOpen = 0

  while (p < e) {
    var c = s.charCodeAt(p)
    var node: MarkdownToJSX.ASTNode | null = null

    if (c === $.CHAR_BACKTICK) {
      node = scanCodeSpan(s, p, e)
      if (!node) {
        p += countChar(s, p, e, $.CHAR_BACKTICK) - 1
      }
    } else if (
      c === $.CHAR_ASTERISK ||
      c === $.CHAR_UNDERSCORE ||
      c === $.CHAR_TILDE ||
      c === $.CHAR_EQ
    ) {
      collectDelimiter(s, p, e)
      var holdRun = streamEdge && c !== $.CHAR_EQ && holdStreamingDelim(s, p, e)
      if (holdRun) {
        ;(held || (held = [])).push(delimStack.length)
      }
      if (_dOpen || _dClose || holdRun) {
        pending = pushText(nodes, pending, s, textStart, p)
        if (c === $.CHAR_EQ) {
          eqOpen += _dClose && eqOpen > 0 ? -1 : _dOpen ? 1 : 0
        } else if (c === $.CHAR_TILDE) {
          tildeOpen += _dClose && tildeOpen > 0 ? -1 : _dOpen ? 1 : 0
        }
        var delimText: MarkdownToJSX.TextNode = {
          type: RuleType.text,
          text: s.slice(p, p + _dLen),
        }
        delimStack.push({
          _active: true,
          _canClose: _dClose,
          _canOpen: _dOpen,
          _ch: c,
          _idx: nodes.length,
          _len: _dLen,
          _nearestLiveBelow: delimStack.length - 1,
          _text: delimText,
        })
        nodes.push(delimText)
        p = textStart = p + _dLen
        continue
      }
      p += _dLen - 1
    } else if (
      c === $.CHAR_BRACKET_OPEN ||
      (c === $.CHAR_EXCLAMATION &&
        p + 1 < e &&
        s.charCodeAt(p + 1) === $.CHAR_BRACKET_OPEN)
    ) {
      if (
        c === $.CHAR_BRACKET_OPEN &&
        p + 1 < e &&
        s.charCodeAt(p + 1) === $.CHAR_CARET
      ) {
        node = scanFootnoteRef(s, p, e, state, opts)
      }
      if (!node) {
        node = scanLink(s, p, e, state, opts)
      }
    } else if (c === $.CHAR_LT) {
      node = scanAutolink(s, p, e)
      if (!(node || opts.disableParsingRawHTML || opts.ignoreHTMLBlocks)) {
        node = scanInlineHtml(s, p, e, state, opts)
      }
    } else if (c === $.CHAR_BACKSLASH) {
      if (p + 1 < e && cc(s.charCodeAt(p + 1)) & C_PUNCT) {
        pending = pushText(nodes, pending, s, textStart, p)
        nodes.push({ type: RuleType.text, text: s[p + 1] })
        p = textStart = p + 2
        continue
      }
    } else if (c === $.CHAR_AMPERSAND) {
      var entEnd = scanEntityRef(s, p, e)
      if (entEnd !== -1) {
        var entRaw = s.slice(p, entEnd)
        var entDecoded = util.decodeEntityReferences(entRaw)
        if (entDecoded !== entRaw) {
          pending += s.slice(textStart, p) + entDecoded
          p = textStart = entEnd
          continue
        }
      }
    } else if (c === $.CHAR_NEWLINE) {
      if (state._breaks) {
        var trimEnd = p
        while (
          trimEnd > textStart &&
          s.charCodeAt(trimEnd - 1) === $.CHAR_SPACE
        ) {
          trimEnd--
        }
        var spCount = p - trimEnd
        var trimBack =
          p > textStart && s.charCodeAt(p - 1) === $.CHAR_BACKSLASH
            ? 1
            : spCount >= 2
              ? spCount
              : 0
        if (
          trimBack > 0 ||
          spCount > 0 ||
          (p + 1 < e && s.charCodeAt(p + 1) === $.CHAR_SPACE)
        ) {
          if (trimBack > 0) {
            pending = pushText(nodes, pending, s, textStart, p - trimBack)
            nodes.push({ type: RuleType.breakLine })
          } else {
            pending += `${s.slice(textStart, trimEnd)}\n`
          }
          p++
          while (p < e && s.charCodeAt(p) === $.CHAR_SPACE) {
            p++
          }
          textStart = p
          continue
        }
      }
    } else if (
      (c === $.CHAR_h || c === $.CHAR_w || c === $.CHAR_f) &&
      !state.inAnchor &&
      !opts.disableAutoLink &&
      (p === 0 || s.charCodeAt(p - 1) !== $.CHAR_LT)
    ) {
      var nc2 = p + 1 < e ? s.charCodeAt(p + 1) : 0
      if (
        (c === $.CHAR_w && nc2 === $.CHAR_w) ||
        ((c === $.CHAR_h || c === $.CHAR_f) && nc2 === $.CHAR_t)
      ) {
        if (urlRun === null) {
          urlRun = newBareUrlRun()
        }
        urlRun._eqOpen = eqOpen > 0
        urlRun._tildeOpen = tildeOpen > 0
        node = scanBareUrl(s, p, e, urlRun)
      }
    }

    if (!node && nextAtPos >= 0 && nextAtPos - p <= 64 && util.isAlnumCode(c)) {
      node = scanBareEmail(s, p, e)
      if (!node && p >= nextAtPos) {
        nextAtPos = s.indexOf('@', p + 1)
        if (nextAtPos >= e) {
          nextAtPos = -1
        }
      }
    }

    if (node) {
      pending = pushText(nodes, pending, s, textStart, p)
      nodes.push(node)
      p = textStart = _end
    } else {
      p++
      if (nextAtPos < 0 || nextAtPos - p > 64) {
        var limit = nextAtPos >= 0 ? Math.min(e, nextAtPos - 64) : e
        while (p < limit) {
          var sc = s.charCodeAt(p)
          if (
            sc >= $.CHAR_ASCII_BOUNDARY ||
            !(CF[sc] & F.INLINE) ||
            (sc === $.CHAR_w
              ? s.charCodeAt(p + 1) !== $.CHAR_w
              : (sc === $.CHAR_h || sc === $.CHAR_f) &&
                s.charCodeAt(p + 1) !== $.CHAR_t)
          ) {
            p++
          } else {
            break
          }
        }
      }
    }
  }

  pushText(nodes, pending, s, textStart, e)
  if (delimStack.length > 0) {
    processEmphasis(nodes, delimStack, held)
  }

  _scanGen = savedScanGen
  _noEndFrom = savedNoEndFrom
  _noCloserRunStartByLength = savedRunStarts
  _noCloserScanFrom = savedScanFrom
  _linkTextMatch = savedLinkTextMatch
  _linkTextMatchShift = savedLinkTextShift
  if (savedDoc !== null && savedDoc !== _doc) {
    _doc = savedDoc
  }
  _globalInlineDepth--
  return nodes
}

function hasBlankLine(s: string, from: number, to: number): boolean {
  var nl = false
  for (; from < to; from++) {
    var c = s.charCodeAt(from)
    if (c === $.CHAR_NEWLINE) {
      if (nl) {
        return true
      }
      nl = true
    } else if (c !== $.CHAR_SPACE && c !== $.CHAR_TAB) {
      nl = false
    }
  }
  return false
}

function parseBlocks(
  s: string,
  state: MarkdownToJSX.State,
  opts: ParseOptions
): MarkdownToJSX.ASTNode[] {
  var savedDepth = state._depth || 0
  if (savedDepth > $.MAX_PARSE_DEPTH) {
    _blocksHadInternalBlank = false
    return [{ type: RuleType.text, text: s }]
  }

  state._depth = savedDepth + 1
  var savedDoc = _doc

  if (
    opts.optimizeForStreaming &&
    !(state._notAtEdge || state._endsInsideFence)
  ) {
    s = trimStreamingBlockEdge(s)
  }

  if (state.inline) {
    var inl = parseInline(s, 0, s.length, state, opts)
    state._depth = savedDepth
    _blocksHadInternalBlank = false
    return inl
  }

  var nodes: MarkdownToJSX.ASTNode[] = []
  var blockCount = 0
  var hadInternalBlank = false
  var prevEnd = 0
  var p = 0
  var e = s.length
  var lastLazyMarker = -2
  var nextPipe = -2
  var afterRef = false

  if (!opts.disableFrontmatter && s.startsWith('---')) {
    var bounds = util.parseFrontmatterBounds(s)
    if (bounds?.hasValidYaml) {
      if (opts.preserveFrontmatter !== false) {
        nodes.push({
          type: RuleType.frontmatter,
          text: s.slice(0, bounds.endPos).trimEnd(),
        })
      }
      p = bounds.endPos
    }
  }

  while (p < e) {
    var le = lineEnd(s, p)
    while (p < e && isBlank(s, p, le)) {
      p = le < e ? le + 1 : le
      if (p < e) {
        le = lineEnd(s, p)
      }
    }
    if (p >= e) {
      break
    }

    var isLazy = s.charCodeAt(p) === $.CHAR_RECORD_SEP
    indent(s, p, le)
    var node: MarkdownToJSX.ASTNode | null = null
    var pendingBefore = _pendingInline ? _pendingInline.length : 0

    if (!isLazy && _indentSpaces >= 4 && !state.inHTML) {
      node = scanIndented(s, p)
    } else if (!isLazy) {
      var i = p + _indentChars
      var c = s.charCodeAt(i)
      if (c === $.CHAR_HASH) {
        node = scanHeading(s, p, state, opts)
      } else if (c === $.CHAR_GT) {
        node = scanBlockquote(s, p, state, opts)
      } else if (c === $.CHAR_BACKTICK || c === $.CHAR_TILDE) {
        node = scanFenced(s, p, state, opts)
      } else if (
        c === $.CHAR_DASH ||
        c === $.CHAR_ASTERISK ||
        c === $.CHAR_UNDERSCORE
      ) {
        node = isThematicBreak(s, i, le)
          ? ret(nextLine(s, le), { type: RuleType.breakThematic })
          : c === $.CHAR_UNDERSCORE
            ? null
            : scanList(s, p, state, opts)
      } else if (
        c === $.CHAR_PLUS ||
        (c >= $.CHAR_DIGIT_0 && c <= $.CHAR_DIGIT_9)
      ) {
        node = scanList(s, p, state, opts)
      } else if (c === $.CHAR_LT) {
        if (state.inList) {
          if (lastLazyMarker === -2) {
            lastLazyMarker = s.lastIndexOf(LAZY_MARKER)
          }
          if (
            lastLazyMarker > p &&
            !opts.ignoreHTMLBlocks &&
            !opts.disableParsingRawHTML &&
            (detectHtmlBlockType(s, i) !== 0 ||
              __parseHtmlTag(s, i)?._isComponentTag)
          ) {
            s = s.slice(0, p) + dropLazyMarkers(s.slice(p))
            e = s.length
            lastLazyMarker = -1
            nextPipe = -2
          }
        }
        node = scanHtmlBlock(s, p, state, opts)
      } else if (c === $.CHAR_BRACKET_OPEN) {
        node = scanRefDefinition(s, p, state)
      }
    } else if (afterRef) {
      node = scanRefDefinition(s, p, state)
    }

    if (!node) {
      if (nextPipe === -2 || (nextPipe !== -1 && nextPipe < p)) {
        nextPipe = s.indexOf('|', p)
      }
      if (nextPipe >= p && nextPipe < le) {
        node = scanTable(s, p, state, opts)
      }
    }
    if (!node) {
      node = scanParagraph(s, p, state, opts)
    }

    if (node) {
      var resEnd = _end
      var contentEnd = rtrim(s, p, resEnd, true)
      if (
        !hadInternalBlank &&
        ((blockCount > 0 && hasBlankLine(s, prevEnd, p)) ||
          (state.inList &&
            node.type === RuleType.htmlBlock &&
            hasBlankLine(s, p, contentEnd)))
      ) {
        hadInternalBlank = true
      }
      prevEnd = contentEnd
      blockCount++
      afterRef = node.type === RuleType.ref
      if (!afterRef) {
        nodes.push(node)
      }
      if (
        opts.optimizeForStreaming &&
        _pendingInline &&
        _pendingInline.length > pendingBefore &&
        hasNonWs(s, resEnd, e)
      ) {
        for (var pqi = pendingBefore; pqi < _pendingInline.length; pqi++) {
          _pendingInline[pqi]._flags |= 128
        }
      }
      p = resEnd
    } else {
      afterRef = false
      var _skip = s.indexOf('\n', p)
      p = _skip < 0 ? e : _skip + 1
    }
  }

  _doc = savedDoc
  state._depth = savedDepth
  _blocksHadInternalBlank = hadInternalBlank
  return nodes
}

/** Main parser entry point. */
export function parser(
  source: string,
  options?: ParserInputOptions | null
): MarkdownToJSX.ASTNode[] {
  if (source.charCodeAt(0) === $.CHAR_BYTE_ORDER_MARK) {
    source = source.slice(1)
  }
  return parseMarkdown(
    source,
    {
      inAnchor: false,
      inBlockQuote: false,
      inHTML: false,
      inList: false,
      inline: false,
      refs: Object.create(null) as {
        [key: string]: { target: string; title: string | undefined }
      },
    },
    toParseOptions(options)
  )
}

export function parseCodeFenced(
  s: string,
  p: number,
  state: MarkdownToJSX.State
): {
  attrs: Record<string, any> | undefined
  end: number
  endPos: number
  lang: string | undefined
  node: MarkdownToJSX.ASTNode
  text: string
  type: number
} | null {
  var node = scanFenced(
    s,
    p,
    state,
    toParseOptions(null)
  ) as MarkdownToJSX.CodeBlockNode | null
  return node
    ? {
        attrs: node.attrs as Record<string, any> | undefined,
        end: _end,
        endPos: _end,
        lang: node.lang,
        node,
        text: node.text,
        type: RuleType.codeBlock,
      }
    : null
}

export function parseHTMLTag(
  s: string,
  p: number,
  _state?: MarkdownToJSX.State,
  _options?: unknown
): {
  attrs: string
  endPos: number
  hasNewline: boolean
  hasSpaceBeforeSlash: boolean
  isClosing: boolean
  isSelfClosing: boolean
  tagLower: string
  tagName: string
  whitespaceBeforeAttrs: string
} | null {
  var res = __parseHtmlTag(s, p)
  return res
    ? {
        attrs: res._rawAttrs,
        endPos: res._end,
        hasNewline:
          res._wsBefore.includes('\n') || res._rawAttrs.includes('\n'),
        hasSpaceBeforeSlash: res._hasSpaceBeforeSlash,
        isClosing: res._isClosing,
        isSelfClosing: res._selfClosing,
        tagLower: res._tag.toLowerCase(),
        tagName: res._tag,
        whitespaceBeforeAttrs: res._wsBefore,
      }
    : null
}

export function calculateIndent(
  s: string,
  p: number,
  e: number,
  _state?: unknown
): {
  charCount: number
  chars: number
  indent: number
  spaceEquivalent: number
} {
  indent(s, p, e)
  return {
    charCount: _indentChars,
    chars: _indentChars,
    indent: _indentSpaces,
    spaceEquivalent: _indentSpaces,
  }
}

export function parseDefinition(
  s: string,
  p: number,
  state: MarkdownToJSX.State,
  _opts: unknown,
  isFootnote: boolean
): { end: number; endPos: number; type: number } | null {
  if (!state.refs) {
    return null
  }
  if (
    isFootnote ||
    (p + 1 < s.length && s.charCodeAt(p + 1) === $.CHAR_CARET)
  ) {
    return parseFootnoteDefinition(s, p, state)
      ? { end: _end, endPos: _end, type: RuleType.ref }
      : null
  }
  var end = parseRefDef(s, p, state.refs)
  return end === null ? null : { end, endPos: end, type: RuleType.ref }
}

export function parseMarkdown(
  input: string,
  state: MarkdownToJSX.State,
  opts: ParseOptions
): MarkdownToJSX.ASTNode[] {
  _globalInlineDepth = 0
  var outerOptionsForTags = _parseOptionsForTags
  _parseOptionsForTags = opts
  input = util.normalizeInput(input)
  _tagSkipBudget = input.length * 16 + TAG_SKIP_BUDGET_FLOOR

  if (!state.refs) {
    state.refs = Object.create(null) as {
      [key: string]: { target: string; title: string | undefined }
    }
  }
  if (opts.optimizeForStreaming || state.inline) {
    state._endsInsideFence = collectReferenceDefinitions(
      input,
      state.refs,
      opts
    )
  }

  var savedInline = _pendingInline
  var savedOps = _pendingOps
  var savedInlineHtmlBlock = _hasInlineHtmlBlock
  _hasInlineHtmlBlock = false
  var ownedInline: PendingInline[] | null = null
  var ownedOps: PendingOp[] | null = null
  if (opts.optimizeForStreaming || input.indexOf(']:') !== -1) {
    _pendingInline = ownedInline = []
    _pendingOps = ownedOps = []
  } else {
    _pendingInline = _pendingOps = null
  }

  var nodes = parseBlocks(input, state, opts)

  if (ownedInline && ownedOps) {
    var savedFlags = packState(state, false)
    var savedDepth = state._depth
    var savedHtmlDepth = state._htmlDepth
    for (var qi = 0; qi < ownedInline.length; qi++) {
      var ent = ownedInline[qi]
      unpackState(state, ent._flags, ent._depth, ent._htmlDepth)
      var parsed = parseInline(ent._text, 0, ent._text.length, state, opts)
      for (var pi = 0; pi < parsed.length; pi++) {
        ent._dest.push(parsed[pi])
      }
    }
    unpackState(state, savedFlags, savedDepth, savedHtmlDepth)
    for (var oi = 0; oi < ownedOps.length; oi++) {
      copyUnwrap(ownedOps[oi]._src, ownedOps[oi]._dest, ownedOps[oi]._unwrap)
    }
  }

  _pendingInline = savedInline
  _pendingOps = savedOps
  _doc = null
  assignHeadingIds(nodes, state, opts.slugify)
  _hasInlineHtmlBlock = savedInlineHtmlBlock
  _parseOptionsForTags = outerOptionsForTags

  return util.hasKeys(state.refs)
    ? [{ type: RuleType.refCollection, refs: state.refs }, ...nodes]
    : nodes
}
