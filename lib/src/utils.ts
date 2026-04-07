import { NAMED_CODES_TO_UNICODE as util, decodeEntity } from 'markdown-to-jsx/entities'
import * as $ from './constants'

/**
 * Parse frontmatter bounds and validate YAML
 *
 * @param input - Input string to parse
 * @returns Object with end position and YAML validity, or null if no frontmatter
 */
export function parseFrontmatterBounds(
  input: string
): { endPos: number; hasValidYaml: boolean } | null {
  if (!startsWith(input, '---')) return null
  let pos = 3
  while (pos < input.length && (input[pos] === ' ' || input[pos] === '\t'))
    pos++
  // Handle both LF and CRLF line endings
  if (pos < input.length && input[pos] === '\r') pos++
  if (pos >= input.length || input[pos] !== '\n') return null
  pos++

  let hasValidYaml = false
  while (pos < input.length) {
    const lineStart = pos
    // Find line end, handling CRLF
    while (pos < input.length && input[pos] !== '\n' && input[pos] !== '\r')
      pos++
    if (pos >= input.length) break
    const lineEnd = pos
    // Skip CR if present
    if (input[pos] === '\r') pos++
    // Skip LF
    if (pos < input.length && input[pos] === '\n') pos++
    if (startsWith(input, '---', lineStart))
      return { endPos: pos, hasValidYaml }
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
              if (c === $.CHAR_SPACE || c === $.CHAR_TAB) hasValidYaml = true
            }
          }
        }
      }
    }
  }
  return null
}

/**
 * Named HTML entity codes to unicode character mapping
 * Pre-computed from generated entity set
 * Numeric references (&#123; and &#xAB;) are fully supported without any mapping.
 * Unknown named entities pass through as literal text (CommonMark-compliant).
 */
export const NAMED_CODES_TO_UNICODE: Record<string, string> = util

/**
 * Regex for matching HTML character references (&entity; or &#123; or &#xAB;)
 * Matches: & followed by entity name or # followed by decimal or hex digits, ending with ;
 */
export const HTML_CHAR_CODE_R: RegExp =
  /&([a-zA-Z0-9]+|#[0-9]{1,7}|#x[0-9a-fA-F]{1,6});/gi

/**
 * Regex for determining if markdown content should be rendered as block-level
 * Matches: newlines, list items, headings, indented content, thematic breaks, blockquotes
 */
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
export function htmlAttrsToJSXProps(
  attrs: Record<string, any>
): Record<string, any> {
  var jsxProps: Record<string, any> = {}

  for (var key in attrs) {
    var keyLower = key.toLowerCase()
    var mappedKey = HTML_TO_JSX_MAP[keyLower]
    if (mappedKey) {
      jsxProps[mappedKey] = attrs[key]
    } else {
      var colonIdx = key.indexOf(':')
      if (colonIdx !== -1) {
        // xml:lang -> xmlLang, xlink:href -> xlinkHref
        jsxProps[key.slice(0, colonIdx) + key[colonIdx + 1].toUpperCase() + key.slice(colonIdx + 2)] = attrs[key]
      } else {
        jsxProps[key] = attrs[key]
      }
    }
  }

  return jsxProps
}

export const SHOULD_RENDER_AS_BLOCK_R: RegExp =
  /(\n|^[-*]\s|^#|^ {2,}|^-{2,}|^>\s|^<(div|p|h[1-6]|ul|ol|li|blockquote|pre|table|thead|tbody|tr|td|th|dl|dt|dd|hr|address|article|aside|details|dialog|figure|figcaption|footer|form|header|main|menu|nav|section|summary|textarea|fieldset|legend|center|dir|hgroup|marquee|search|output|template)\b)/i

/**
 * Decode HTML entity references to Unicode characters
 *
 * @param text - The text containing HTML entities
 * @returns The decoded text
 */
export function decodeEntityReferences(text: string): string {
  if (text.indexOf('&') === -1) return text

  return text.replace(HTML_CHAR_CODE_R, (full, inner) => {
    // Named entity lookup via swappable decoder
    // In browser builds, this uses DOM; in Node, uses lookup table
    var entity = decodeEntity(inner)
    if (entity) return entity

    // Numeric entities (always computed, no lookup needed)
    if (inner[0] === '#') {
      var code =
        inner[1] === 'x' || inner[1] === 'X'
          ? parseInt(inner.slice(2), 16)
          : parseInt(inner.slice(1), 10)

      if (code === 0 || (code >= 0xd800 && code <= 0xdfff) || code > 0x10ffff) {
        return '\uFFFD'
      }
      return code <= 0xffff
        ? String.fromCharCode(code)
        : String.fromCharCode(
            0xd800 + ((code - 0x10000) >> 10),
            0xdc00 + ((code - 0x10000) & 0x3ff)
          )
    }

    return full
  })
}

export const SANITIZE_R: RegExp = /(javascript|vbscript|data(?!:image)):/i

/**
 * Sanitize URLs and other input values to prevent XSS attacks.
 * Filters out javascript:, vbscript:, and data: URLs (except data:image).
 *
 *
 * @param input - The URL or value to sanitize
 * @returns Sanitized value, or null if unsafe
 */
export function sanitizer(input: string): string | null {
  if (SANITIZE_R.test(input)) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        'Input contains an unsafe JavaScript/VBScript/data expression, it will not be rendered.',
        input
      )
    }
    return null
  }

  if (input.indexOf('%') === -1) return input

  try {
    const decoded = decodeURIComponent(input).replace(/[^A-Za-z0-9/:]/g, '')
    if (SANITIZE_R.test(decoded)) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          'Input contains an unsafe JavaScript/VBScript/data expression, it will not be rendered.',
          decoded
        )
      }
      return null
    }
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        'Input could not be decoded due to malformed syntax or characters, it will not be rendered.',
        input
      )
    }
    return null
  }

  return input
}

// Character replacement lookup table for slugify (Unicode to ASCII)
var slugifyReplaceTable: Record<number, string> = {}
var codes: number[], i: number
codes = [192, 193, 194, 195, 196, 197, 224, 225, 226, 227, 228, 229, 230, 198]
for (i = 0; i < codes.length; i++) slugifyReplaceTable[codes[i]] = 'a'
slugifyReplaceTable[231] = slugifyReplaceTable[199] = 'c'
slugifyReplaceTable[240] = slugifyReplaceTable[208] = 'd'
codes = [200, 201, 202, 203, 233, 232, 234, 235]
for (i = 0; i < codes.length; i++) slugifyReplaceTable[codes[i]] = 'e'
codes = [207, 239, 206, 238, 205, 237, 204, 236]
for (i = 0; i < codes.length; i++) slugifyReplaceTable[codes[i]] = 'i'
slugifyReplaceTable[209] = slugifyReplaceTable[241] = 'n'
codes = [248, 216, 339, 338, 213, 245, 212, 244, 211, 243, 210, 242]
for (i = 0; i < codes.length; i++) slugifyReplaceTable[codes[i]] = 'o'
codes = [220, 252, 219, 251, 218, 250, 217, 249]
for (i = 0; i < codes.length; i++) slugifyReplaceTable[codes[i]] = 'u'
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
    if ((code >= $.CHAR_a && code <= $.CHAR_z) || (code >= $.CHAR_DIGIT_0 && code <= $.CHAR_DIGIT_9)) {
      if (segStart < 0) segStart = i
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
    if (replacement) out += replacement
  }
  if (segStart >= 0) out += str.slice(segStart)
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
  if (VOID_ELEMENTS.has(lowerTag)) return true
  // Handle SVG namespace prefixes like svg:circle
  const colonIndex = lowerTag.indexOf(':')
  if (colonIndex !== -1) {
    lowerTag = lowerTag.slice(colonIndex + 1)
    return VOID_ELEMENTS.has(lowerTag)
  }
  return false
}

/** Attributes that should be sanitized for security */
export const ATTRIBUTES_TO_SANITIZE: readonly string[] = [
  'src',
  'href',
  'data',
  'formAction',
  'srcDoc',
  'action',
]

// Character classification flags (bitfield) - shared by parser and utils
// These flags allow multiple classifications per character with bitwise AND/OR
export var C_WS = 1        // Whitespace (space, tab, newline, cr, ff)
export var C_NL = 2        // Newline (\n, \r)
export var C_PUNCT = 4     // Punctuation
export var C_ALPHA = 8     // Letter (a-z, A-Z)
export var C_DIGIT = 16    // Digit (0-9)
export var C_BLOCK = 32    // Can start a block (parser-specific)
export var C_INLINE = 64   // Can start inline syntax (parser-specific)

// Inline character type constants
// const INLINE_CHAR_TYPE_NORMAL = 0
const INLINE_CHAR_TYPE_SPECIAL = 1
const INLINE_CHAR_TYPE_ESCAPE = 2
const INLINE_CHAR_TYPE_DELIMITER = 3
const INLINE_CHAR_TYPE_LINK = 4

// Unified character class lookup table (ASCII 0-127)
// Shared by parser (parse.ts) and utilities (utils.ts)
export var CC: Uint8Array = (function () {
  var t = new Uint8Array(128)
  var i
  // Whitespace characters
  t[$.CHAR_TAB] = C_WS
  t[$.CHAR_NEWLINE] = C_WS | C_NL
  t[$.CHAR_FF] = C_WS
  t[$.CHAR_CR] = C_WS | C_NL
  t[$.CHAR_SPACE] = C_WS
  // Punctuation ranges (all ASCII punctuation for CommonMark escape handling)
  for (i = $.CHAR_EXCLAMATION; i <= $.CHAR_SLASH; i++) t[i] = C_PUNCT
  for (i = $.CHAR_COLON; i <= $.CHAR_AT; i++) t[i] = C_PUNCT
  for (i = $.CHAR_BRACKET_OPEN; i <= $.CHAR_BACKTICK; i++) t[i] = C_PUNCT
  for (i = $.CHAR_BRACE_OPEN; i <= $.CHAR_TILDE; i++) t[i] = C_PUNCT
  // Digits 0-9
  for (i = $.CHAR_DIGIT_0; i <= $.CHAR_DIGIT_9; i++) t[i] = C_DIGIT
  // Letters
  for (i = $.CHAR_A; i <= $.CHAR_Z; i++) t[i] = C_ALPHA
  for (i = $.CHAR_a; i <= $.CHAR_z; i++) t[i] = C_ALPHA
  return t
})()

// Lookup table for inline character types (0-127): 0=normal, 1=special, 2=escape, 3=delimiter, 4=link
export const inlineCharTypeTable: Uint8Array = (function () {
  const t = new Uint8Array(128)
  t[$.CHAR_BACKSLASH] = INLINE_CHAR_TYPE_ESCAPE
  t[$.CHAR_BRACKET_OPEN] = INLINE_CHAR_TYPE_LINK
  t[$.CHAR_ASTERISK] =
    t[$.CHAR_UNDERSCORE] =
    t[$.CHAR_TILDE] =
    t[$.CHAR_EQ] =
      INLINE_CHAR_TYPE_DELIMITER
  t[$.CHAR_BACKTICK] =
    t[$.CHAR_LT] =
    t[$.CHAR_AT] =
    t[$.CHAR_BRACKET_CLOSE] =
    t[$.CHAR_NEWLINE] =
    t[$.CHAR_SPACE] =
    t[$.CHAR_EXCLAMATION] =
      INLINE_CHAR_TYPE_SPECIAL
  t[$.CHAR_f] = t[$.CHAR_H] = t[$.CHAR_W] = INLINE_CHAR_TYPE_SPECIAL
  return t
})()

export function isASCIIPunctuation(code: number): boolean {
  return (
    code < $.CHAR_ASCII_BOUNDARY &&
    (CC[code] & C_PUNCT) !== 0
  )
}

export function isASCIIWhitespace(code: number): boolean {
  return (
    code < $.CHAR_ASCII_BOUNDARY &&
    (CC[code] & C_WS) !== 0
  )
}

// Unicode property escapes for spec-compliant character classification
// Per GFM spec Section 2.1: "A punctuation character is a character in the general Unicode categories
// Pc, Pd, Pe, Pf, Pi, Po, or Ps" - this is \p{P}
// BUT also includes some currency symbols and other symbols per the spec's explicit list
export var UNICODE_PUNCT_R: RegExp = /[\p{P}\p{S}]/u
export var UNICODE_WHITESPACE_R: RegExp = /\p{Zs}/u

export function isUnicodeWhitespace(c: string): boolean {
  if (!c) return true
  const code = c.charCodeAt(0)
  return code < $.CHAR_ASCII_BOUNDARY
    ? (CC[code] & C_WS) !== 0
    : UNICODE_WHITESPACE_R.test(c)
}

export function isUnicodePunctuation(c: string | number): boolean {
  if (typeof c === 'number')
    return (
      c < $.CHAR_ASCII_BOUNDARY && (CC[c] & C_PUNCT) !== 0
    )
  if (!c) return false
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
  if (newlinePos === -1) return source.length
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
  var firstCR = text.indexOf('\r')
  var firstNull = text.indexOf('\x00')

  if (firstCR === -1 && firstNull === -1) return text

  var len = text.length
  crlfParts.length = 0
  var start = 0
  var i = 0

  if (firstCR === -1) {
    i = firstNull
  } else if (firstNull === -1) {
    i = firstCR
  } else {
    i = firstCR < firstNull ? firstCR : firstNull
  }

  for (; i < len; i++) {
    var code = text.charCodeAt(i)
    if (code === $.CHAR_CR) {
      if (start < i) crlfParts.push(text.slice(start, i))
      if (i + 1 < len && text.charCodeAt(i + 1) === $.CHAR_NEWLINE) {
        i++
      }
      crlfParts.push('\n')
      start = i + 1
    } else if (code === 0) {
      if (start < i) crlfParts.push(text.slice(start, i))
      crlfParts.push('\uFFFD')
      start = i + 1
    }
  }
  if (start < len) crlfParts.push(text.slice(start))
  return crlfParts.join('')
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
  while (pos < end && (source[pos] === ' ' || source[pos] === '\t')) pos++
  return pos
}

/**
 * Fast check if object has any enumerable properties
 * Optimized alternative to Object.keys(obj).length > 0
 */
export function hasKeys(obj: Record<string, any> | null | undefined): boolean {
  if (!obj) return false
  for (var key in obj) {
    return true
  }
  return false
}

/**
 * Extract plain text from AST nodes (for image alt text, heading slugs, etc.)
 * Shared between JSX and HTML renderers
 */
/**
 * Get nested property from object using dot notation path
 */
export function get(source: any, path: string, fallback: any): any {
  var result = source
  var segments = path.split('.')
  var i = 0
  while (i < segments.length) {
    result = result?.[segments[i]]
    if (result === undefined) break
    i++
  }
  return result || fallback
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
    if (code <= $.CHAR_SPACE || code === $.CHAR_DOUBLE_QUOTE || code === $.CHAR_PERCENT ||
        code === $.CHAR_LT || code === $.CHAR_GT || code === $.CHAR_BRACKET_OPEN ||
        code === $.CHAR_BACKSLASH || code === $.CHAR_BRACKET_CLOSE || code === $.CHAR_CARET ||
        code === $.CHAR_BACKTICK || code >= 123) {
      needsEncoding = true
      break
    }
  }
  if (!needsEncoding) return target

  var result = ''
  for (var i = 0; i < target.length; i++) {
    var code = target.charCodeAt(i)
    if (code === $.CHAR_PERCENT && i + 2 < target.length) {
      var c1 = target.charCodeAt(i + 1)
      var c2 = target.charCodeAt(i + 2)
      if (
        ((c1 >= $.CHAR_DIGIT_0 && c1 <= $.CHAR_DIGIT_9) || (c1 >= $.CHAR_A && c1 <= $.CHAR_F) || (c1 >= $.CHAR_a && c1 <= $.CHAR_f)) &&
        ((c2 >= $.CHAR_DIGIT_0 && c2 <= $.CHAR_DIGIT_9) || (c2 >= $.CHAR_A && c2 <= $.CHAR_F) || (c2 >= $.CHAR_a && c2 <= $.CHAR_f))
      ) {
        result += target[i] + target[i + 1] + target[i + 2]
        i += 2
        continue
      }
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
  if (!overrides) return tag
  const override = get(overrides, tag, undefined)
  if (typeof override === 'string') return override
  if (typeof override === 'object' && override.component)
    return override.component
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
  if (!overrides) return {}
  const override = get(overrides, tag, undefined)
  return typeof override === 'object' && override.props ? override.props : {}
}

export function extractPlainText(nodes: Array<any>, RuleType: any): string {
  var result = ''
  for (var i = 0, len = nodes.length; i < len; i++) {
    var node = nodes[i],
      type = node.type
    if (type === RuleType.text || type === RuleType.codeInline) {
      var text = node.text
      if (text) result += text
    } else if (type === RuleType.textFormatted || type === RuleType.link) {
      if (node.children) result += extractPlainText(node.children, RuleType)
    } else if (type === RuleType.image) {
      if (node.alt) {
        result += node.alt
      }
    }
  }
  return result
}

/** GFM tagfilter extension — security-sensitive tags whose `<` gets escaped */
var TAGFILTER_TAGS = new Set([
  'title', 'textarea', 'style', 'xmp', 'iframe', 'noembed', 'noframes', 'script', 'plaintext'
])

/** Matches tagfilter tags in raw HTML text (opening/closing) */
var TAGFILTER_R = /<(\/?)(title|textarea|style|xmp|iframe|noembed|noframes|script|plaintext)(\s|>|\/)/gi

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
 * Apply tagfilter to text content - escape dangerous tags
 */
export function applyTagFilterToText(text: string): string {
  TAGFILTER_R.lastIndex = 0
  return text.replace(
    TAGFILTER_R,
    function (match, slash, tagName, after) {
      return '&lt;' + slash + tagName + after
    }
  )
}

