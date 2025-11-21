import { NAMED_CODES_TO_UNICODE as util } from './entities.generated'
import * as $ from './constants'

// Parse frontmatter bounds and validate YAML
export function parseFrontmatterBounds(
  input: string
): { endPos: number; hasValidYaml: boolean } | null {
  if (!startsWith(input, '---')) return null
  let pos = 3
  while (pos < input.length && (input[pos] === ' ' || input[pos] === '\t'))
    pos++
  if (pos >= input.length || input[pos] !== '\n') return null
  pos++

  let hasValidYaml = false
  while (pos < input.length) {
    const lineStart = pos
    while (pos < input.length && input[pos] !== '\n') pos++
    if (pos >= input.length) break
    const lineEnd = pos++
    if (startsWith(input, '---', lineStart))
      return { endPos: pos, hasValidYaml }
    // Check if line contains ':' anywhere
    // OPTIMIZATION: Use indexOf directly to avoid slice allocation
    const colonIndex = input.indexOf(':', lineStart)
    if (colonIndex !== -1 && colonIndex < lineEnd) hasValidYaml = true
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
export const SHOULD_RENDER_AS_BLOCK_R: RegExp =
  /(\n|^[-*]\s|^#|^ {2,}|^-{2,}|^>\s)/

/**
 * Decode HTML entity references to Unicode characters
 */
export function decodeEntityReferences(text: string): string {
  if (text.indexOf('&') === -1) return text

  return text.replace(HTML_CHAR_CODE_R, (full, inner) => {
    // Named entity lookup - try exact match, then lowercase fallback
    // The generation script handles uppercase fallbacks for lowercase entities
    const entity =
      NAMED_CODES_TO_UNICODE[inner] ||
      NAMED_CODES_TO_UNICODE[inner.toLowerCase()]
    if (entity) return entity

    // Numeric entities
    if (inner[0] === '#') {
      const code =
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

export function isAlnumCode(code: number): boolean {
  return (
    (code >= $.CHAR_DIGIT_0 && code <= $.CHAR_DIGIT_9) ||
    (code >= $.CHAR_A && code <= $.CHAR_Z) ||
    (code >= $.CHAR_a && code <= $.CHAR_z)
  )
}

// based on https://stackoverflow.com/a/18123682/1141611
// not complete, but probably good enough
export function slugify(str: string): string {
  var parts: string[] = []
  for (var i = 0; i < str.length; i++) {
    var code = str.charCodeAt(i)
    if (isAlnumCode(code)) {
      if (code >= $.CHAR_A && code <= $.CHAR_Z) {
        parts.push(String.fromCharCode(code + $.CHAR_CASE_OFFSET))
      } else {
        parts.push(str[i])
      }
    } else if (code === $.CHAR_SPACE || code === $.CHAR_DASH) {
      parts.push('-')
    } else {
      var replacement = slugifyReplaceTable[code]
      if (replacement) parts.push(replacement)
    }
  }
  return parts.join('')
}

/**
 * Basic string utility functions
 */
export function includes(str: string, search: string): boolean {
  return str.indexOf(search) !== -1
}

export function startsWith(str: string, prefix: string, pos?: number): boolean {
  return str.startsWith(prefix, pos)
}

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
  'animateTransform',
  'set',
])

/** Check if an element is a void element (doesn't require closing tag) */
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

// Character classification flags (bitfield)
const CHAR_WHITESPACE = 1
const CHAR_PUNCTUATION = 2

// Inline character type constants
// const INLINE_CHAR_TYPE_NORMAL = 0
const INLINE_CHAR_TYPE_SPECIAL = 1
const INLINE_CHAR_TYPE_ESCAPE = 2
const INLINE_CHAR_TYPE_DELIMITER = 3
const INLINE_CHAR_TYPE_LINK = 4

// Lookup table for ASCII characters (0-127)
export const charClassTable: Uint8Array = (function () {
  const t = new Uint8Array(128)
  let i
  t[$.CHAR_TAB] =
    t[$.CHAR_NEWLINE] =
    t[$.CHAR_FF] =
    t[$.CHAR_CR] =
    t[$.CHAR_SPACE] =
      CHAR_WHITESPACE
  for (i = $.CHAR_EXCLAMATION; i <= $.CHAR_SLASH; i++) t[i] = CHAR_PUNCTUATION
  for (i = $.CHAR_COLON; i <= $.CHAR_AT; i++) t[i] = CHAR_PUNCTUATION
  for (i = $.CHAR_BRACKET_OPEN; i <= $.CHAR_BACKTICK; i++)
    t[i] = CHAR_PUNCTUATION
  for (i = $.CHAR_BRACE_OPEN; i <= $.CHAR_TILDE; i++) t[i] = CHAR_PUNCTUATION
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
  t[$.CHAR_F] = t[$.CHAR_H] = t[$.CHAR_W] = INLINE_CHAR_TYPE_SPECIAL
  return t
})()

export function isASCIIPunctuation(code: number): boolean {
  return (
    code < $.CHAR_ASCII_BOUNDARY &&
    (charClassTable[code] & CHAR_PUNCTUATION) !== 0
  )
}

export function isASCIIWhitespace(code: number): boolean {
  return (
    code < $.CHAR_ASCII_BOUNDARY &&
    (charClassTable[code] & CHAR_WHITESPACE) !== 0
  )
}

// Unicode property escapes for spec-compliant character classification
// Per GFM spec Section 2.1: "A punctuation character is a character in the general Unicode categories
// Pc, Pd, Pe, Pf, Pi, Po, or Ps" - this is \p{P}
// BUT also includes some currency symbols and other symbols per the spec's explicit list
const UNICODE_PUNCT_R = /[\p{P}\p{S}]/u
const UNICODE_WHITESPACE_R = /\p{Zs}/u

export function isUnicodeWhitespace(c: string): boolean {
  if (!c) return true
  const code = c.charCodeAt(0)
  return code < $.CHAR_ASCII_BOUNDARY
    ? (charClassTable[code] & CHAR_WHITESPACE) !== 0
    : UNICODE_WHITESPACE_R.test(c)
}

export function isUnicodePunctuation(c: string | number): boolean {
  if (typeof c === 'number')
    return (
      c < $.CHAR_ASCII_BOUNDARY && (charClassTable[c] & CHAR_PUNCTUATION) !== 0
    )
  if (!c) return false
  const code = c.charCodeAt(0)
  return code < $.CHAR_ASCII_BOUNDARY
    ? (charClassTable[code] & CHAR_PUNCTUATION) !== 0
    : UNICODE_PUNCT_R.test(c)
}

/**
 * Find the end of the current line
 * Optimized: Pure indexOf is faster than hybrid approach - JS engine optimizes it better
 */
export function findLineEnd(source: string, startPos: number): number {
  const newlinePos = source.indexOf('\n', startPos)
  return newlinePos !== -1 ? newlinePos : source.length
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
