import { decodeEntity } from 'markdown-to-jsx/entities'
import * as $ from './constants.ts'
import { type MarkdownToJSX, RuleType } from './types.ts'

/**
 * Parse frontmatter bounds and validate YAML
 *
 * @param input - Input string to parse
 * @returns Object with end position and YAML validity, or null if no frontmatter
 */
export function parseFrontmatterBounds(
  input: string
): { endPos: number; hasValidYaml: boolean } | null {
  if (!startsWith(input, '---')) {
    return null
  }
  let pos = 3
  while (pos < input.length && (input[pos] === ' ' || input[pos] === '\t')) {
    pos++
  }
  // Handle both LF and CRLF line endings
  if (pos < input.length && input[pos] === '\r') {
    pos++
  }
  if (pos >= input.length || input[pos] !== '\n') {
    return null
  }
  pos++

  let hasValidYaml = false
  while (pos < input.length) {
    const lineStart = pos
    // Find line end, handling CRLF
    while (pos < input.length && input[pos] !== '\n' && input[pos] !== '\r') {
      pos++
    }
    if (pos >= input.length) {
      break
    }
    const lineEnd = pos
    // Skip CR if present
    if (input[pos] === '\r') {
      pos++
    }
    // Skip LF
    if (pos < input.length && input[pos] === '\n') {
      pos++
    }
    if (startsWith(input, '---', lineStart)) {
      return { endPos: pos, hasValidYaml }
    }
    // Validate YAML key-value pattern: [ws] key ":" (space|tab|EOL)
    if (!hasValidYaml) {
      let scanPos = skipWhitespace(input, lineStart, lineEnd)
      if (scanPos < lineEnd) {
        let c = input.charCodeAt(scanPos)
        if (
          (c >= $.CHAR_a && c <= $.CHAR_z) ||
          (c >= $.CHAR_A && c <= $.CHAR_Z) ||
          (c >= $.CHAR_DIGIT_0 && c <= $.CHAR_DIGIT_9) ||
          c === $.CHAR_UNDERSCORE
        ) {
          scanPos++
          while (scanPos < lineEnd) {
            c = input.charCodeAt(scanPos)
            if (
              (c >= $.CHAR_a && c <= $.CHAR_z) ||
              (c >= $.CHAR_A && c <= $.CHAR_Z) ||
              (c >= $.CHAR_DIGIT_0 && c <= $.CHAR_DIGIT_9) ||
              c === $.CHAR_UNDERSCORE ||
              c === $.CHAR_DASH ||
              c === $.CHAR_PERIOD
            ) {
              scanPos++
            } else {
              break
            }
          }
          if (scanPos < lineEnd && input.charCodeAt(scanPos) === $.CHAR_COLON) {
            scanPos++
            if (scanPos >= lineEnd) {
              hasValidYaml = true
            } else {
              c = input.charCodeAt(scanPos)
              if (c === $.CHAR_SPACE || c === $.CHAR_TAB) {
                hasValidYaml = true
              }
            }
          }
        }
      }
    }
  }
  return null
}

/**
 * Regex for matching HTML character references (&entity; or &#123; or &#xAB;)
 * Matches: & followed by entity name or # followed by decimal or hex digits, ending with ;
 */
export const HTML_CHAR_CODE_R: RegExp =
  /&([a-zA-Z0-9]+|#[0-9]{1,7}|#x[0-9a-fA-F]{1,6});/gi

// Mapping of lowercase HTML attributes to JSX prop names
// Shared between React and Solid renderers (Vue uses HTML attributes directly)
export const HTML_TO_JSX_MAP: Record<string, string> = {
  class: 'className',
  for: 'htmlFor',
  allowfullscreen: 'allowFullScreen',
  allowtransparency: 'allowTransparency',
  autocomplete: 'autoComplete',
  autofocus: 'autoFocus',
  autoplay: 'autoPlay',
  cellpadding: 'cellPadding',
  cellspacing: 'cellSpacing',
  charset: 'charSet',
  classid: 'classId',
  colspan: 'colSpan',
  contenteditable: 'contentEditable',
  contextmenu: 'contextMenu',
  crossorigin: 'crossOrigin',
  enctype: 'encType',
  formaction: 'formAction',
  formenctype: 'formEncType',
  formmethod: 'formMethod',
  formnovalidate: 'formNoValidate',
  formtarget: 'formTarget',
  frameborder: 'frameBorder',
  hreflang: 'hrefLang',
  inputmode: 'inputMode',
  keyparams: 'keyParams',
  keytype: 'keyType',
  marginheight: 'marginHeight',
  marginwidth: 'marginWidth',
  maxlength: 'maxLength',
  mediagroup: 'mediaGroup',
  minlength: 'minLength',
  novalidate: 'noValidate',
  radiogroup: 'radioGroup',
  readonly: 'readOnly',
  rowspan: 'rowSpan',
  spellcheck: 'spellCheck',
  srcdoc: 'srcDoc',
  srclang: 'srcLang',
  srcset: 'srcSet',
  tabindex: 'tabIndex',
  usemap: 'useMap',
  viewbox: 'viewBox',
}

/**
 * Convert HTML attributes to JSX props
 * Maps HTML attribute names (e.g., "class", "for") to JSX prop names (e.g., "className", "htmlFor")
 *
 * @param attrs - HTML attributes object
 * @returns JSX props object
 */
// Shared empty result for attribute-less elements; callers spread it, so the
// shared identity never leaks mutations
var EMPTY_JSX_PROPS: Record<string, any> = {}

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
    } else {
      var colonIdx = key.indexOf(':')
      if (colonIdx === -1) {
        jsxProps[key] = attrs[key]
      } else {
        // xml:lang -> xmlLang, xlink:href -> xlinkHref
        jsxProps[
          key.slice(0, colonIdx) +
            key[colonIdx + 1].toUpperCase() +
            key.slice(colonIdx + 2)
        ] = attrs[key]
      }
    }
  }

  return jsxProps
}

/**
 * Whether rendered children hold anything: a non-empty string, a number, or an
 * element, at any depth of nested arrays. Booleans, null, undefined, '' and
 * empty arrays hold nothing, as React renders them.
 */
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

/**
 * The text a registered tag's `children` attribute supplies as the element's
 * content, or undefined. The element's own content wins, as in React, and only
 * a string value is text: a bare `children` or `{true}` is `true`, and
 * parse.ts drops an object value. The caller passes the text as a plain child
 * (never parsed as markdown or HTML) and drops `children` from the props. A
 * caller reads it once the tag it writes is known, since a void tag takes none.
 */
export function childrenAttrContent(
  value: unknown,
  ownChildren: unknown
): string | undefined {
  return typeof value === 'string' && !hasContent(ownChildren)
    ? value
    : undefined
}

/**
 * The attribute text of a self-closing tag's raw opening tag (`_rawOpen`): what
 * lies between the tag name, `tagLength` long, and its ending (` />`, `/>`, or
 * `>`), leading gap included.
 */
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

/**
 * Regex for determining if markdown content should be rendered as block-level
 * Matches: newlines, list items, headings, indented content, thematic breaks, blockquotes
 */
export const SHOULD_RENDER_AS_BLOCK_R: RegExp =
  /(\n|^[-*]\s|^#|^ {2,}|^-{2,}|^>\s|^<(div|p|h[1-6]|ul|ol|li|blockquote|pre|table|thead|tbody|tr|td|th|dl|dt|dd|hr|address|article|aside|details|dialog|figure|figcaption|footer|form|header|main|menu|nav|section|summary|textarea|fieldset|legend|center|dir|hgroup|marquee|search|output|template)\b)/i

/**
 * Decode HTML entity references to Unicode characters
 *
 * @param text - The text containing HTML entities
 * @returns The decoded text
 */
export function decodeEntityReferences(text: string): string {
  if (text.indexOf('&') === -1) {
    return text
  }

  return text.replace(HTML_CHAR_CODE_R, (full, inner) => {
    // Named entity lookup via swappable decoder
    // In browser builds, this uses DOM; in Node, uses lookup table
    var entity = decodeEntity(inner)
    if (entity) {
      return entity
    }

    // Numeric entities (always computed, no lookup needed)
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
      return code <= 0xff_ff
        ? String.fromCharCode(code)
        : String.fromCharCode(
            0xd8_00 + ((code - 0x1_00_00) >> 10),
            0xdc_00 + ((code - 0x1_00_00) & 0x3_ff)
          )
    }

    return full
  })
}

var BLOCKED_SCHEME_R = /(javascript|vbscript|data(?!:image)):/i

/**
 * A blocked scheme before a URL's first `/`, `?`, or `#`, the only place a browser
 * can read a scheme. It need not be at the start, so `feed:javascript:` is blocked.
 */
export const SANITIZE_R: RegExp = new RegExp(
  `^[^/?#]*?${BLOCKED_SCHEME_R.source}`,
  'i'
)

/** The path, query, and fragment of a URL */
var URL_AFTER_SCHEME_R = /[/?#][\s\S]*$/

/** What urlVerdict found: a safe URL, or why one is unsafe (a blocked scheme as written, one after percent-decoding, or an undecodable sequence) */
export const URL_VERDICT = {
  malformed: 3,
  safe: 0,
  unsafe: 1,
  unsafeDecoded: 2,
} as const

var URL_STRIP_R = /[^A-Za-z0-9/:]/g

/** Anything that makes the decode and strip pass necessary: a browser's URL parser deletes tab, LF, and CR anywhere in a URL, and decodes `%` */
var URL_NEEDS_DECODE_R = /[%\t\n\r]/

/** The percent-decoded URL with everything outside `[A-Za-z0-9/:]` removed; throws on a malformed sequence */
function decodeUrlScheme(input: string): string {
  return decodeURIComponent(input).replace(URL_STRIP_R, '')
}

/**
 * The sanitizer's judgment of a URL, with no warning: a value of URL_VERDICT.
 * For a caller that screens text a browser may read as markup, where one URL
 * can be judged more than once.
 */
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
    // An undecodable sequence is rejected anywhere, so the whole URL is decoded first
    decodeURIComponent(input)
    // The strip removes `?` and `#`, so the scheme part is cut before it
    return SANITIZE_R.test(
      decodeUrlScheme(input.replace(URL_AFTER_SCHEME_R, ''))
    )
      ? URL_VERDICT.unsafeDecoded
      : URL_VERDICT.safe
  } catch {
    return URL_VERDICT.malformed
  }
}

/**
 * Whether a blocked scheme stands anywhere in a URL, as written or decoded once.
 * For text another renderer will read, which can take a later part of it as a URL
 * of its own. Throws on an undecodable sequence, which urlVerdict reports first.
 */
export function urlNamesBlockedScheme(input: string): boolean {
  return (
    BLOCKED_SCHEME_R.test(input) ||
    (URL_NEEDS_DECODE_R.test(input) &&
      BLOCKED_SCHEME_R.test(decodeUrlScheme(input)))
  )
}

/**
 * Sanitize URLs and other input values to prevent XSS attacks.
 * Filters out javascript:, vbscript:, and data: URLs (except data:image), judged
 * where a browser reads a scheme: before the first `/`, `?`, or `#`.
 *
 *
 * @param input - The URL or value to sanitize
 * @returns Sanitized value, or null if unsafe
 */
export function sanitizer(input: string): string | null {
  var verdict = urlVerdict(input)
  if (verdict === URL_VERDICT.safe) {
    return input
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

// Character replacement lookup table for slugify (Unicode to ASCII)
var slugifyReplaceTable: Record<number, string> = {}
var codes: number[]
var i: number
codes = [192, 193, 194, 195, 196, 197, 224, 225, 226, 227, 228, 229, 230, 198]
for (i = 0; i < codes.length; i++) {
  slugifyReplaceTable[codes[i]] = 'a'
}
slugifyReplaceTable[231] = slugifyReplaceTable[199] = 'c'
slugifyReplaceTable[240] = slugifyReplaceTable[208] = 'd'
codes = [200, 201, 202, 203, 233, 232, 234, 235]
for (i = 0; i < codes.length; i++) {
  slugifyReplaceTable[codes[i]] = 'e'
}
codes = [207, 239, 206, 238, 205, 237, 204, 236]
for (i = 0; i < codes.length; i++) {
  slugifyReplaceTable[codes[i]] = 'i'
}
slugifyReplaceTable[209] = slugifyReplaceTable[241] = 'n'
codes = [248, 216, 339, 338, 213, 245, 212, 244, 211, 243, 210, 242]
for (i = 0; i < codes.length; i++) {
  slugifyReplaceTable[codes[i]] = 'o'
}
codes = [220, 252, 219, 251, 218, 250, 217, 249]
for (i = 0; i < codes.length; i++) {
  slugifyReplaceTable[codes[i]] = 'u'
}
slugifyReplaceTable[376] =
  slugifyReplaceTable[255] =
  slugifyReplaceTable[221] =
  slugifyReplaceTable[253] =
    'y'

/**
 * Check if a character code is alphanumeric (0-9, A-Z, a-z)
 * Uses optimized table lookup for ASCII characters
 *
 * @param code - Character code to check
 * @returns True if alphanumeric
 */
export function isAlnumCode(code: number): boolean {
  return code < $.CHAR_ASCII_BOUNDARY && (CC[code] & (C_ALPHA | C_DIGIT)) !== 0
}

/**
 * Convert a string to a URL-safe slug by normalizing characters and replacing spaces with hyphens.
 * Based on https://stackoverflow.com/a/18123682/1141611
 * Not complete, but probably good enough.
 *
 *
 * @param str - String to slugify
 * @returns URL-safe slug
 */
export function slugify(str: string): string {
  // One-pass scan without the upfront toLowerCase() allocation. Uppercase
  // ASCII letters are lowered inline by a segment break; we flush the prior
  // lowercase segment via slice, then append the single lowered char, then
  // start a new segment. This avoids the full-string allocation from
  // toLowerCase() which on long headings is a real cost.
  var out = ''
  var segStart = -1
  var n = str.length
  for (var i = 0; i < n; i++) {
    var code = str.charCodeAt(i)
    // lowercase ASCII letter / digit — fastest and most common path
    if (
      (code >= $.CHAR_a && code <= $.CHAR_z) ||
      (code >= $.CHAR_DIGIT_0 && code <= $.CHAR_DIGIT_9)
    ) {
      if (segStart < 0) {
        segStart = i
      }
      continue
    }
    // uppercase ASCII letter — flush, emit lowered single char
    if (code >= $.CHAR_A && code <= $.CHAR_Z) {
      if (segStart >= 0) {
        out += str.slice(segStart, i)
        segStart = -1
      }
      out += String.fromCharCode(code + $.CHAR_CASE_OFFSET)
      continue
    }
    // space / dash — flush, emit '-'
    if (code === $.CHAR_SPACE || code === $.CHAR_DASH) {
      if (segStart >= 0) {
        out += str.slice(segStart, i)
        segStart = -1
      }
      out += '-'
      continue
    }
    // anything else: flush, try replacement table
    if (segStart >= 0) {
      out += str.slice(segStart, i)
      segStart = -1
    }
    var replacement = slugifyReplaceTable[code]
    if (replacement) {
      out += replacement
    }
  }
  if (segStart >= 0) {
    out += str.slice(segStart)
  }
  return out
}

/**
 * Check if a string starts with a prefix
 *
 * @param str - String to check
 * @param prefix - Prefix to check for
 * @param pos - Optional starting position
 * @returns True if string starts with prefix
 */
export function startsWith(str: string, prefix: string, pos?: number): boolean {
  return str.startsWith(prefix, pos)
}

/**
 * Check if a string ends with a suffix
 *
 * @param str - String to check
 * @param suffix - Suffix to check for
 * @param pos - Optional ending position
 * @returns True if string ends with suffix
 */
export function endsWith(str: string, suffix: string, pos?: number): boolean {
  return str.startsWith(
    suffix,
    (pos === undefined ? str.length : pos) - suffix.length
  )
}

// Known void elements (HTML5 and SVG) that don't require closing tag or />
// Use Set for O(1) lookups instead of O(n) array.includes()
export const VOID_ELEMENTS: Set<string> = new Set([
  // HTML5 void elements
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
  // SVG void elements
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

/**
 * Check if an element is a void element (doesn't require closing tag)
 *
 * @param tagName - HTML tag name
 * @returns True if void element
 */
export function isVoidElement(tagName: string): boolean {
  let lowerTag = tagName.toLowerCase()
  if (VOID_ELEMENTS.has(lowerTag)) {
    return true
  }
  // Handle SVG namespace prefixes like svg:circle
  const colonIndex = lowerTag.indexOf(':')
  if (colonIndex !== -1) {
    lowerTag = lowerTag.slice(colonIndex + 1)
    return VOID_ELEMENTS.has(lowerTag)
  }
  return false
}

// Character classification flags (bitfield) - shared by parser and utils
// These flags allow multiple classifications per character with bitwise AND/OR
export var C_WS = 1 // Whitespace (space, tab, newline, cr, ff)
export var C_NL = 2 // Newline (\n, \r)
export var C_PUNCT = 4 // Punctuation
export var C_ALPHA = 8 // Letter (a-z, A-Z)
export var C_DIGIT = 16 // Digit (0-9)
export var C_BLOCK = 32 // Can start a block (parser-specific)
export var C_INLINE = 64 // Can start inline syntax (parser-specific)

// Unified character class lookup table (ASCII 0-127)
// Shared by parser (parse.ts) and utilities (utils.ts)
export var CC: Uint8Array = (() => {
  var t = new Uint8Array(128)
  var i: number
  // Whitespace characters
  t[$.CHAR_TAB] = C_WS
  t[$.CHAR_NEWLINE] = C_WS | C_NL
  t[$.CHAR_FF] = C_WS
  t[$.CHAR_CR] = C_WS | C_NL
  t[$.CHAR_SPACE] = C_WS
  // Punctuation ranges (all ASCII punctuation for CommonMark escape handling)
  for (i = $.CHAR_EXCLAMATION; i <= $.CHAR_SLASH; i++) {
    t[i] = C_PUNCT
  }
  for (i = $.CHAR_COLON; i <= $.CHAR_AT; i++) {
    t[i] = C_PUNCT
  }
  for (i = $.CHAR_BRACKET_OPEN; i <= $.CHAR_BACKTICK; i++) {
    t[i] = C_PUNCT
  }
  for (i = $.CHAR_BRACE_OPEN; i <= $.CHAR_TILDE; i++) {
    t[i] = C_PUNCT
  }
  // Digits 0-9
  for (i = $.CHAR_DIGIT_0; i <= $.CHAR_DIGIT_9; i++) {
    t[i] = C_DIGIT
  }
  // Letters
  for (i = $.CHAR_A; i <= $.CHAR_Z; i++) {
    t[i] = C_ALPHA
  }
  for (i = $.CHAR_a; i <= $.CHAR_z; i++) {
    t[i] = C_ALPHA
  }
  return t
})()

export function isASCIIPunctuation(code: number): boolean {
  return code < $.CHAR_ASCII_BOUNDARY && (CC[code] & C_PUNCT) !== 0
}

export function isASCIIWhitespace(code: number): boolean {
  return code < $.CHAR_ASCII_BOUNDARY && (CC[code] & C_WS) !== 0
}

// Unicode property escapes for spec-compliant character classification
// Per GFM spec Section 2.1: "A punctuation character is a character in the general Unicode categories
// Pc, Pd, Pe, Pf, Pi, Po, or Ps" - this is \p{P}
// BUT also includes some currency symbols and other symbols per the spec's explicit list
export var UNICODE_PUNCT_R: RegExp = /[\p{P}\p{S}]/u
export var UNICODE_WHITESPACE_R: RegExp = /\p{Zs}/u

export function isUnicodeWhitespace(c: string): boolean {
  if (!c) {
    return true
  }
  const code = c.charCodeAt(0)
  return code < $.CHAR_ASCII_BOUNDARY
    ? (CC[code] & C_WS) !== 0
    : UNICODE_WHITESPACE_R.test(c)
}

export function isUnicodePunctuation(c: string | number): boolean {
  if (typeof c === 'number') {
    return c < $.CHAR_ASCII_BOUNDARY && (CC[c] & C_PUNCT) !== 0
  }
  if (!c) {
    return false
  }
  const code = c.charCodeAt(0)
  return code < $.CHAR_ASCII_BOUNDARY
    ? (CC[code] & C_PUNCT) !== 0
    : UNICODE_PUNCT_R.test(c)
}

/**
 * Find the end of the current line
 * Optimized: Pure indexOf is faster than hybrid approach - JS engine optimizes it better
 * Handles CRLF by returning position before \r when followed by \n
 */
export function findLineEnd(source: string, startPos: number): number {
  const newlinePos = source.indexOf('\n', startPos)
  if (newlinePos === -1) {
    return source.length
  }
  if (newlinePos > 0 && source.charCodeAt(newlinePos - 1) === $.CHAR_CR) {
    return newlinePos - 1
  }
  return newlinePos
}

var crlfParts: string[] = []

/**
 * Normalize input text for parsing:
 * - Replace CRLF and CR line endings with LF
 * - Replace null bytes (U+0000) with replacement character (U+FFFD) per CommonMark spec
 * Returns original string if no transformations needed (fast path)
 */
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

/**
 * Collapse inter-tag whitespace and newlines before re-parsing raw HTML as
 * JSX in the react/native/solid/vue compilers. A quoted attribute value is
 * kept byte for byte: it is the element's data (a children value is its
 * text), so it renders as it does outside a raw block.
 */
export function normalizeJsxReparseText(text: string): string {
  var out = ''
  var segStart = 0
  var inTag = false
  // The last character inside a tag that is not whitespace: a quote opens a
  // value only after `=`, as a browser reads it
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
      // An unclosed value runs to the end of the text
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

/**
 * Skip whitespace characters
 */
export function skipWhitespace(
  source: string,
  pos: number,
  maxPos?: number
): number {
  const end = maxPos ?? source.length
  while (pos < end && (source[pos] === ' ' || source[pos] === '\t')) {
    pos++
  }
  return pos
}

/**
 * Fast check if object has any enumerable properties
 * Optimized alternative to Object.keys(obj).length > 0
 */
export function hasKeys(obj: Record<string, any> | null | undefined): boolean {
  if (!obj) {
    return false
  }
  for (var _key in obj) {
    return true
  }
  return false
}

/**
 * GFM alert blockquotes need a `<header>` node injected with the alert label
 * (CommonMark Example 175 et al). Renderer-agnostic.
 */
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

/**
 * Normalize block-mode compiler input: trim trailing newlines and carriage
 * returns, strip leading newlines, and append the terminating blank line the
 * block parser expects.
 */
export function prepareBlockInput(input: string): string {
  var e = input.length
  while (e > 0 && (input[e - 1] === '\n' || input[e - 1] === '\r')) {
    e--
  }
  return `${input.slice(0, e).replace(TRIM_STARTING_NEWLINES, '')}\n\n`
}

/**
 * Flatten the AST produced by re-parsing a verbatim HTML block's rawText for
 * JSX-style output: drop closing-tag nodes, unwrap paragraphs (raw HTML
 * content does not get `<p>` wrappers), drop whitespace-only text, and recurse
 * into nested HTML blocks. Renderer-agnostic; shared by the React, native,
 * Solid, and Vue compilers.
 */
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
    var children = (node as MarkdownToJSX.ParagraphNode).children
    return children ? children.flatMap(processVerbatimNode) : []
  }
  if (node.type === RuleType.text) {
    return (node as MarkdownToJSX.TextNode).text?.trim() ? [node] : []
  }
  if (
    node.type === RuleType.htmlBlock &&
    (node as MarkdownToJSX.HTMLNode).children
  ) {
    return [
      {
        ...node,
        children: node.children?.flatMap(processVerbatimNode),
      } as MarkdownToJSX.HTMLNode,
    ]
  }
  return [node]
}

/**
 * Clear `_verbatim` on re-parsed HTML block nodes to prevent infinite re-parse
 * recursion, with one exception for issue #881: keep verbatim on a last-sibling
 * node whose rawText bleeds real content past its own closing tag. There the
 * bled tail is the only place that trailing content exists, so the renderer
 * re-parses and splits it out as siblings. Each split strictly shrinks rawText,
 * so the recursion is bounded; reparsedToItself catches the one source that
 * does not split. When siblings follow (e.g. nested same-type
 * blocks like table rows) they already carry the bled content, so keeping
 * verbatim would duplicate it; a bled tail of pure closing tags (e.g.
 * "</dd></dl>") carries no content. Both fall to the default strip.
 * Renderer-agnostic; shared by the React, native, Solid, and Vue compilers.
 */
export function stripVerbatim(nodes: MarkdownToJSX.ASTNode[]): void {
  for (var ai = 0; ai < nodes.length; ai++) {
    if (nodes[ai].type === RuleType.htmlBlock) {
      var hn = nodes[ai] as MarkdownToJSX.HTMLNode
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

/**
 * Whether stripVerbatim left a re-parse of `source` verbatim over all of it,
 * which an opener the tag parser rejects does (`<div </div>'`). Re-parsing again
 * would never end, so the renderer writes the source as text.
 */
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
  // The span the next re-parse would read; a set _reparseSource holds a tag
  return (last._reparseSource || last._rawOuter) === source
}

/**
 * Split a re-parsed verbatim HTML block AST at the element's own closing tag
 * (issue #881). Content before the closing tag becomes the element's children;
 * content after it becomes siblings rendered alongside. Handles a closing tag
 * that is a direct node and one nested inside a paragraph's children. Returns
 * the original nodes as `beforeClose` with an empty `afterClose` when no own
 * closing tag is present. Renderer-agnostic; the caller assembles the wrapper
 * plus siblings with its own element primitive.
 */
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
    // Check in paragraph children
    if (
      n.type === RuleType.paragraph &&
      (n as MarkdownToJSX.ParagraphNode).children
    ) {
      var pChildren = (n as MarkdownToJSX.ParagraphNode).children
      for (var j = 0; j < pChildren.length; j++) {
        var cn = pChildren[j]
        if (
          cn.type === RuleType.htmlSelfClosing &&
          cn._isClosingTag &&
          cn.tag.toLowerCase() === tag
        ) {
          // Before: pChildren[0..j-1] as paragraph + nodes[0..i-1]
          // After: pChildren[j+1..] as paragraph + nodes[i+1..]
          var before: MarkdownToJSX.ASTNode[] = nodes.slice(0, i)
          if (j > 0) {
            before.push({
              type: RuleType.paragraph,
              children: pChildren.slice(0, j),
            } as MarkdownToJSX.ParagraphNode)
          }
          var after: MarkdownToJSX.ASTNode[] = []
          if (j + 1 < pChildren.length) {
            // Remaining paragraph children become nodes after close, minus any
            // trailing closing tags for parent elements
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
    // Check direct closing tag
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

/**
 * Dev-mode argument validation shared by the JSX compilers. Callers keep the
 * process.env.NODE_ENV guard at the call site so production bundles drop both
 * the call and the message strings.
 */
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

/**
 * Serialize an HTML node's attributes for tagfilter display output (the
 * escaped `<tag attr="value">` text emitted for filtered tags).
 */
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

/**
 * How a tagfiltered HTML node should be emitted. GFM replaces only each
 * matching tag's leading `<`; the body and closer stay. Type 1 / verbatim
 * nodes return a single `literal` (opener + body + closer). Structured nodes
 * with children return `sandwich` so allowed nested tags still render.
 */
export type FilteredTagEmit =
  | { kind: 'literal'; literal: string }
  | { kind: 'sandwich'; close: string; open: string }

/**
 * Build a filtered open tag, preserving author whitespace in `_rawAttrs` when present.
 * @param end - Tag terminator (`>` or ` />`)
 */
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

/**
 * Derive inert source parts for a tagfiltered htmlBlock / htmlSelfClosing node.
 */
export function getFilteredTagEmit(
  node: MarkdownToJSX.HTMLNode | MarkdownToJSX.HTMLSelfClosingNode,
  /** Screens a text body for a string output, where it is emitted as markup */
  screenText?: (text: string) => string
): FilteredTagEmit {
  var tag = node.tag
  var selfClosing = node.type === RuleType.htmlSelfClosing
  var htmlNode = node as MarkdownToJSX.HTMLNode
  var rawAttrs = htmlNode._rawAttrs
  var close = `</${tag}>`

  if (!selfClosing && htmlNode._isClosingTag) {
    // Orphan closer: _rawClose is the closer literal, _rawBody any trailing
    // content kept alongside it.
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

  // Verbatim source that already carries its own opener (JSX/component
  // re-parse full-block form).
  if (htmlNode._verbatim && htmlNode._rawOuter !== undefined) {
    if (hasKids) {
      return { kind: 'sandwich', open, close }
    }
    return { kind: 'literal', literal: htmlNode._rawOuter }
  }

  // Type 1 and other childless verbatim: body + own closer. A parsed opener
  // whose source has no closer gets none: the `>` of an added one would close a
  // tag left open in the body
  if (htmlNode._verbatim && !hasKids) {
    return {
      kind: 'literal',
      literal:
        open +
        (htmlNode._rawBody || '') +
        (htmlNode._rawClose || (rawAttrs === undefined ? close : '')),
    }
  }

  // Structured (or verbatim-with-children): sandwich inert open/close around
  // normally rendered children so allowed nested tags stay live. Plain text
  // children collapse into one literal so JSX sinks avoid adjacent text nodes.
  if (kids != null && kids.length > 0) {
    var plain = ''
    for (var i = 0; i < kids.length; i++) {
      var kid = kids[i]
      if (kid.type !== RuleType.text) {
        return { kind: 'sandwich', open, close }
      }
      plain += (kid as MarkdownToJSX.TextNode).text
    }
    return {
      kind: 'literal',
      literal: open + (screenText ? screenText(plain) : plain) + close,
    }
  }

  // Empty structured node: emit open + optional body text + close. The body
  // may already carry a nested same-name closing tag as literal text (e.g. an
  // identical tag appearing verbatim inside the content).
  var body = htmlNode._rawBody || ''
  if (body && body.indexOf(close) !== -1) {
    return { kind: 'literal', literal: open + body }
  }
  return { kind: 'literal', literal: open + body + close }
}

/**
 * Build span/Text children for a filtered open/close sandwich, merging
 * adjacent strings so React SSR does not inject text-boundary comments.
 */
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

/**
 * Whether GFM tagfilter is active. Omitted/`undefined` means on (documented default).
 */
export function tagfilterEnabled(
  options: { tagfilter?: boolean } | null | undefined
): boolean {
  return options == null || options.tagfilter !== false
}

/**
 * Sanitize a URL attribute then percent-encode the surviving value for emit.
 * Returns null when the sanitizer rejects the target.
 */
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

/**
 * Footnote keys are stored in the refs map with a leading `^` (CHAR_CARET).
 * Each renderer needs the same `{ identifier, footnote }` list for output.
 */
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
    if (key.charCodeAt(0) === 94 /* ^ */) {
      entries.push({ identifier: key, footnote: refs[key].target })
    }
  }
  return entries
}

/**
 * Return `s.toLowerCase()` if `s` contains an ASCII uppercase letter, else `s`.
 * Avoids allocating on the already-lowercase override-lookup hot path.
 */
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

/**
 * `source[key]`, unless `key` names a member of a built-in prototype that
 * `source` does not own. The key can be a tag name from the document, so
 * `constructor` or `call` must not answer, while any other inherited key
 * (`Object.create(defaults)`, a class getter, a Proxy) still does.
 */
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

/**
 * The value for `key` once its own key misses: the all-lowercase key (HTML tags
 * are case-insensitive, issue #248), then, for a key that starts with an
 * uppercase letter, the first key in `for...in` order equal to it ignoring case.
 */
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
  // A scan rather than an index, so a key added to the same object later is seen
  for (var name in source) {
    var c = name.charCodeAt(0)
    // A different ASCII first character settles it with no lowercased copy; any
    // other takes the full compare (the Kelvin sign lowercases to `k`)
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

/**
 * Get nested property from object using dot notation path, read through
 * overrideValue. A first segment that misses is matched by valueIgnoringCase.
 */
export function get(source: any, path: string, fallback: any): any {
  // Fast path: single-segment paths (the common case for override lookups)
  // skip the split allocation
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

/** Prefixes Solid strips to reach the attribute or property named after them. */
export const SOLID_TARGET_PREFIX_R: RegExp = /^(?:attr|bool|prop):/i

/**
 * Whether an attribute name is an on* event handler (onclick, onError), including
 * behind a Solid target prefix.
 */
export function isHandlerName(name: string): boolean {
  // All three prefixes are four letters; the check spares every other name the regex
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

/**
 * An HTML node's attributes without any on* value that is not a function, for
 * a JSX renderer to build the tag's props from, unless the tag is a component:
 * it starts with an uppercase letter and an `overrides` key matches it. The
 * parser keeps a lowercase tag's handler in `attrs` as written text for
 * `renderRule` and `parser()` users, and a hand-built AST can hold one, but no
 * output passes it on. A function is the caller's own code (or
 * `evalUnserializableExpressions` output on a component), not text from the
 * document, so it stays. Returns `attrs` itself when nothing goes.
 */
export function withoutHandlerSource(
  tag: string,
  attrs: Record<string, any> | undefined,
  overrides: unknown
): Record<string, any> | undefined {
  var kept: Record<string, any> | undefined
  for (var key in attrs) {
    if (isHandlerName(key) && typeof attrs[key] !== 'function') {
      // Settled once, and only for a tag that holds handler source
      if (kept === undefined) {
        var first = tag.charCodeAt(0)
        if (
          first >= $.CHAR_A &&
          first <= $.CHAR_Z &&
          get(overrides, tag, undefined)
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

/**
 * Encode special characters in URL targets for safe rendering.
 * Preserves existing percent-encoded sequences, encodes backslash/backtick,
 * and percent-encodes non-ASCII characters.
 */
export function encodeUrlTarget(target: string): string {
  // Fast path: skip encoding if URL contains only safe characters
  // encodeURI encodes: control chars (0-31), space, ", %, <, >, [, \, ], ^, `, {, |, }, DEL, non-ASCII
  var needsEncoding = false
  for (var i = 0; i < target.length; i++) {
    var code = target.charCodeAt(i)
    if (
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
    ) {
      needsEncoding = true
      break
    }
  }
  if (!needsEncoding) {
    return target
  }

  var result = ''
  for (var i = 0; i < target.length; i++) {
    var code = target.charCodeAt(i)
    if (code === $.CHAR_PERCENT && i + 2 < target.length) {
      var c1 = target.charCodeAt(i + 1)
      var c2 = target.charCodeAt(i + 2)
      if (
        ((c1 >= $.CHAR_DIGIT_0 && c1 <= $.CHAR_DIGIT_9) ||
          (c1 >= $.CHAR_A && c1 <= $.CHAR_F) ||
          (c1 >= $.CHAR_a && c1 <= $.CHAR_f)) &&
        ((c2 >= $.CHAR_DIGIT_0 && c2 <= $.CHAR_DIGIT_9) ||
          (c2 >= $.CHAR_A && c2 <= $.CHAR_F) ||
          (c2 >= $.CHAR_a && c2 <= $.CHAR_f))
      ) {
        result += target[i] + target[i + 1] + target[i + 2]
        i += 2
        continue
      }
    }
    if (code >= 0xd8_00 && code <= 0xdf_ff) {
      if (code <= 0xdb_ff && i + 1 < target.length) {
        var nextCode = target.charCodeAt(i + 1)
        if (nextCode >= 0xdc_00 && nextCode <= 0xdf_ff) {
          result += encodeURI(target[i] + target[i + 1])
          i++
          continue
        }
      }
      result += target[i]
      continue
    }
    result += encodeURI(target[i])
  }
  return result
}

/** Concatenate class names, filtering falsy values */
export function cx(...args: (string | undefined | null | false)[]): string {
  return args.filter(Boolean).join(' ')
}

/**
 * Get tag name from override object, supporting both string and component object overrides
 */
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

/**
 * Get override props from override object
 */
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

/** GFM tagfilter extension — security-sensitive tags whose `<` gets escaped */
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

/** Matches tagfilter tags in raw HTML text (opening/closing) */
var TAGFILTER_R =
  /<(\/?)(title|textarea|style|xmp|iframe|noembed|noframes|script|plaintext)(\s|>|\/)/gi

/**
 * Check if tag should be filtered per GFM tagfilter extension
 */
export function shouldFilterTag(tagName: string): boolean {
  return TAGFILTER_TAGS.has(tagName.toLowerCase())
}

/** Test if text contains any tagfilter tags */
export function containsTagfilterTag(text: string): boolean {
  TAGFILTER_R.lastIndex = 0
  return TAGFILTER_R.test(text)
}

/**
 * What a browser shows for a type 1 body, for a sink that sets it as text: `pre`
 * and `textarea` decode references, and `script` and `style` hold raw text.
 */
export function verbatimText(tag: string, body: string): string {
  var lower = tag.toLowerCase()
  return lower === 'pre' || lower === 'textarea'
    ? decodeEntityReferences(body)
    : body
}

/**
 * Apply tagfilter to text content - escape dangerous tags
 */
export function applyTagFilterToText(text: string): string {
  TAGFILTER_R.lastIndex = 0
  return text.replace(
    TAGFILTER_R,
    (_match, slash, tagName, after) => `&lt;${slash}${tagName}${after}`
  )
}
