import { RuleType, type MarkdownToJSX } from './types'
import * as $ from './constants'
import * as util from './utils'

// NOTE: All debug and tracking functions are automatically removed by build-plugins.ts

// Global parseMetrics - accessible via global.parseMetrics from all files
declare global {
  var parseMetrics: {
    blockParsers: {
      [key: string]: {
        attempts: number
        hits: number
        hitTimings: number[]
      }
    }
    inlineParsers: {
      [key: string]: {
        attempts: number
        hits: number
        hitTimings: number[]
      }
    }
    totalOperations: number
    blockParseIterations: number
    inlineParseIterations: number
  } | null
  var parseMetricsStartTimes: Map<string, number> | null
}

export function initializeParseMetrics(): void {
  global.parseMetrics = {
    blockParsers: {},
    inlineParsers: {},
    totalOperations: 0,
    blockParseIterations: 0,
    inlineParseIterations: 0,
  }
  global.parseMetricsStartTimes = new Map()
}

initializeParseMetrics()

function warn(message: string): void {
  console.warn(message)
}

function debug(
  category: string,
  ruleType: string,
  state?: MarkdownToJSX.State
): void {
  if (category === 'parse') {
    if (ruleType === 'inlineSpan') {
      global.parseMetrics.inlineParseIterations++
      global.parseMetrics.totalOperations++
    } else if (state && !state.inline) {
      // Block parser attempt
      if (!global.parseMetrics.blockParsers[ruleType]) {
        global.parseMetrics.blockParsers[ruleType] = {
          attempts: 0,
          hits: 0,
          hitTimings: [],
        }
      }
      global.parseMetrics.blockParsers[ruleType].attempts++
    } else if (state && state.inline) {
      // Inline parser attempt
      if (!global.parseMetrics.inlineParsers[ruleType]) {
        global.parseMetrics.inlineParsers[ruleType] = {
          attempts: 0,
          hits: 0,
          hitTimings: [],
        }
      }
      global.parseMetrics.inlineParsers[ruleType].attempts++
    }
  }
}

// Top-level tracking helpers (use global parseMetrics)
function ensureParser(
  key: string,
  type: 'inline' | 'block'
): {
  attempts: number
  hits: number
  hitTimings: number[]
} {
  const parsers =
    type === 'inline'
      ? global.parseMetrics.inlineParsers
      : global.parseMetrics.blockParsers
  return (
    parsers[key] || (parsers[key] = { attempts: 0, hits: 0, hitTimings: [] })
  )
}

function trackAttempt(key: string): void {
  const parser = ensureParser(key, 'inline')
  parser.attempts++
  if (global.parseMetricsStartTimes) {
    global.parseMetricsStartTimes.set(key, performance.now())
  }
}

function trackHit(key: string): void {
  const parserMap = global.parseMetrics.inlineParsers
  const parser = parserMap[key]
  parser.hits++
  if (global.parseMetricsStartTimes) {
    const startTime = global.parseMetricsStartTimes.get(key)
    if (startTime !== undefined) {
      const duration = performance.now() - startTime
      parser.hitTimings.push(duration)
      global.parseMetricsStartTimes.delete(key)
    }
  }
}

function trackBlockAttempt(key: string): void {
  const parser = ensureParser(key, 'block')
  parser.attempts++
  if (global.parseMetricsStartTimes) {
    global.parseMetricsStartTimes.set(key, performance.now())
  }
}

function trackBlockHit(key: string): void {
  const parserMap = global.parseMetrics.blockParsers
  const parser = parserMap[key]
  parser.hits++
  if (global.parseMetricsStartTimes) {
    const startTime = global.parseMetricsStartTimes.get(key)
    if (startTime !== undefined) {
      const duration = performance.now() - startTime
      parser.hitTimings.push(duration)
      global.parseMetricsStartTimes.delete(key)
    }
  }
}

function trackBlockParseIteration(): void {
  global.parseMetrics.blockParseIterations++
  global.parseMetrics.totalOperations++
}

function trackOperation(): void {
  global.parseMetrics.totalOperations++
}

function countConsecutiveChars(
  source: string,
  pos: number,
  targetChar: string,
  maxCount?: number
): number {
  var targetCode = charCode(targetChar)
  var len = source.length
  var max = maxCount ?? len - pos
  var count = 0
  while (
    count < max &&
    pos + count < len &&
    charCode(source, pos + count) === targetCode
  )
    count++
  return count
}

// Unified flanking check: dir=0 for left, dir=1 for right
function checkFlanking(
  source: string,
  delimiterStart: number,
  delimiterEnd: number,
  bound: number,
  dir: number
): boolean {
  if (dir === 0 ? delimiterEnd >= bound : delimiterStart <= bound) return false

  const adjacentChar =
    dir === 0 ? source[delimiterEnd] : source[delimiterStart - 1]
  const oppositeChar =
    dir === 0
      ? delimiterStart > 0
        ? source[delimiterStart - 1]
        : null
      : delimiterEnd < source.length
        ? source[delimiterEnd]
        : null

  var adjacentCode = charCode(adjacentChar)

  if (
    adjacentCode < $.CHAR_ASCII_BOUNDARY
      ? util.isASCIIWhitespace(adjacentCode)
      : util.isUnicodeWhitespace(adjacentChar)
  ) {
    return false
  }

  var oppositeCode = oppositeChar ? charCode(oppositeChar) : null
  var isOppositeWS =
    oppositeChar === null ||
    oppositeChar === '\n' ||
    oppositeChar === '\r' ||
    (oppositeCode !== null
      ? oppositeCode < $.CHAR_ASCII_BOUNDARY
        ? util.isASCIIWhitespace(oppositeCode)
        : util.isUnicodeWhitespace(oppositeChar)
      : true)

  var isAdjacentPunct = isPunctuation(adjacentCode, adjacentChar)

  if (!isAdjacentPunct) return true
  if (isOppositeWS) return true

  return oppositeChar
    ? isPunctuation(charCode(oppositeChar), oppositeChar)
    : false
}

// Per CommonMark spec: backslashes escape ASCII punctuation characters in link destinations
// For non-punctuation characters, the backslash is preserved as a literal backslash
// Per CommonMark spec: backslash unescaping and entity reference decoding for URLs and titles
// Any ASCII punctuation character may be backslash-escaped
// Entity references are recognized and decoded to Unicode
function unescapeUrlOrTitle(str: string): string {
  var result = '',
    i = 0
  while (i < str.length) {
    if (str[i] === '\\' && i + 1 < str.length) {
      var next = str[i + 1]
      result += util.isUnicodePunctuation(charCode(next)) ? next : '\\' + next
      i += 2
    } else {
      result += str[i++]
    }
  }
  return util.decodeEntityReferences(result)
}

function skipToNextLine(source: string, lineEnd: number): number {
  if (lineEnd >= source.length) return lineEnd
  if (
    source.charCodeAt(lineEnd) === $.CHAR_CR &&
    lineEnd + 1 < source.length &&
    source.charCodeAt(lineEnd + 1) === $.CHAR_NEWLINE
  ) {
    return lineEnd + 2
  }
  if (source.charCodeAt(lineEnd) === $.CHAR_NEWLINE) {
    return lineEnd + 1
  }
  return lineEnd + 1
}

function getCharType(code: number, skipAutoLink: boolean): number {
  if (code >= $.CHAR_ASCII_BOUNDARY) return 0
  var type = util.inlineCharTypeTable[code]
  if (
    skipAutoLink &&
    type === 1 &&
    (code === $.CHAR_f || code === $.CHAR_H || code === $.CHAR_W)
  ) {
    return 0
  }
  return type
}

function tryMergeBlockquoteContinuation(
  source: string,
  currentPos: number,
  lastItem: MarkdownToJSX.ASTNode[],
  continuationContent: string,
  state: MarkdownToJSX.State,
  options: ParseOptions
): number | null {
  if (
    !lastItem.length ||
    lastItem[lastItem.length - 1].type !== RuleType.blockQuote
  )
    return null
  const checkPos = util.skipWhitespace(
    continuationContent,
    0,
    continuationContent.length
  )
  if (
    checkPos >= continuationContent.length ||
    continuationContent[checkPos] !== '>'
  )
    return null
  // We've already verified it starts with '>', so try blockquote directly
  // (parseBlock might match fenced code blocks first due to indentation)
  const cont = parseBlockQuote(source, currentPos, state, options)
  if (!cont) return null
  const lastBlockQuote = lastItem[
    lastItem.length - 1
  ] as MarkdownToJSX.BlockQuoteNode
  const contBlockQuote = cont as MarkdownToJSX.BlockQuoteNode & {
    endPos: number
  }
  if (contBlockQuote.children)
    lastBlockQuote.children.push(...contBlockQuote.children)
  return contBlockQuote.endPos
}

function createHeading(
  level: number,
  children: MarkdownToJSX.ASTNode[],
  content: string,
  slugify: (str: string) => string
): MarkdownToJSX.HeadingNode {
  return {
    type: RuleType.heading,
    level,
    children,
    id: slugify(content),
  } as MarkdownToJSX.HeadingNode
}

// Static regex patterns for performance
export const UNESCAPE_R: RegExp = /\\(.)/g
const HEADING_TRAILING_HASHES_R = /\s+#+\s*$/
// Unified regex for all list item patterns: ordered (digit + delimiter + content) or unordered (marker + content)
// Groups: 1=ordered_num, 2=ordered_delim, 3=ordered_content, 4=ordered_empty_num, 5=ordered_empty_delim, 6=unordered_marker, 7=unordered_content, 8=unordered_empty_marker
const LIST_ITEM_R =
  /^(?:(\d{1,9})([.)])\s+(.*)$|(\d{1,9})([.)])\s*$|([-*+])\s+(.*)$|([-*+])\s*$)/
// List items with content (marker + whitespace + content or end of line) - for continuation matching
const ORDERED_LIST_ITEM_WITH_CONTENT_R = /^(\d{1,9})([.)])(\s+|$)/
const UNORDERED_LIST_ITEM_WITH_CONTENT_R = /^([*+\-])(\s+|$)/
export const HTML_BLOCK_ELEMENT_START_R: RegExp =
  /^<([a-z][^ >/\n\r]*) ?([^>]*?)>/i
export const HTML_BLOCK_ELEMENT_START_R_ATTR: RegExp =
  /^<([a-z][^ >/]*) ?(?:[^>/]+[^/]|)>/i

var charCode = function (c: string, pos: number = 0) {
  return c.charCodeAt(pos)
}
var isAlnum = function (c: string): boolean {
  return util.isAlnumCode(charCode(c))
}
var isWS = function (c: string) {
  return util.isASCIIWhitespace(charCode(c))
}
var isSpaceOrTab = function (c: string): boolean {
  return c === ' ' || c === '\t'
}
var isPunctuation = function (code: number, char: string): boolean {
  return util.isUnicodePunctuation(code < $.CHAR_ASCII_BOUNDARY ? code : char)
}
var isNameChar = function (c: string) {
  var n = charCode(c)
  return (
    isAlnum(c) ||
    n === $.CHAR_DASH ||
    n === $.CHAR_UNDERSCORE ||
    n === $.CHAR_COLON ||
    n === $.CHAR_PERIOD
  )
}

// HTML validation functions removed - parser only recognizes boundaries, not validates syntax
// Per GFM spec: parser's job is to identify HTML boundaries and pass content opaquely

function parseHTMLTagName(
  source: string,
  pos: number
): { tagName: string; tagLower: string; nextPos: number } | null {
  var sourceLen = source.length
  if (pos >= sourceLen) return null
  var firstCharCode = charCode(source[pos])
  if (!isAlphaCode(firstCharCode)) return null
  var tagNameStart = pos
  var tagNameEnd = pos
  while (tagNameEnd < sourceLen) {
    var code = charCode(source[tagNameEnd])
    if (
      (code >= $.CHAR_a && code <= $.CHAR_z) ||
      (code >= $.CHAR_A && code <= $.CHAR_Z) ||
      (code >= $.CHAR_DIGIT_0 && code <= $.CHAR_DIGIT_9) ||
      code === $.CHAR_DASH
    ) {
      tagNameEnd++
    } else {
      var tagEndCode = charCode(source[tagNameEnd])
      if (
        tagEndCode === $.CHAR_SPACE ||
        tagEndCode === $.CHAR_TAB ||
        tagEndCode === $.CHAR_NEWLINE ||
        tagEndCode === $.CHAR_CR ||
        tagEndCode === $.CHAR_GT ||
        tagEndCode === $.CHAR_SLASH
      ) {
        break
      } else {
        return null
      }
    }
  }
  if (tagNameEnd === tagNameStart) return null
  var tagName = source.slice(tagNameStart, tagNameEnd)

  // Validate tag name according to spec: only ASCII letters, digits, hyphens
  for (var i = 0; i < tagName.length; i++) {
    var code = charCode(tagName[i])
    if (
      !(
        (code >= $.CHAR_a && code <= $.CHAR_z) ||
        (code >= $.CHAR_A && code <= $.CHAR_Z) ||
        (code >= $.CHAR_DIGIT_0 && code <= $.CHAR_DIGIT_9) ||
        code === $.CHAR_DASH
      )
    ) {
      return null
    }
  }

  return { tagName, tagLower: tagName.toLowerCase(), nextPos: tagNameEnd }
}

/** Unified HTML tag parser that handles opening, closing, and self-closing tags */
export function parseHTMLTag(
  source: string,
  pos: number
): {
  tagName: string
  tagLower: string
  attrs: string
  endPos: number
  isClosing: boolean
  isSelfClosing: boolean
  hasNewline: boolean
  hasSpaceBeforeSlash: boolean
  whitespaceBeforeAttrs: string
} | null {
  var token = scanRawHTML(source, pos)
  if (!token || token.kind !== 'tag') return null

  // Note: hasSpaceBeforeSlash is already validated in scanner (returns null if invalid)
  return {
    tagName: token.tagName || '',
    tagLower: token.tagNameLower || '',
    attrs: token.attrs || '',
    endPos: token.endPos,
    isClosing: token.isClosing || false,
    isSelfClosing: token.isSelfClosing || false,
    hasNewline: token.hasNewline,
    hasSpaceBeforeSlash: false,
    whitespaceBeforeAttrs: token.whitespaceBeforeAttrs || '',
  }
}

/** Find matching closing tag position for inline HTML tags. Returns [contentEnd, closingTagEnd] or null */
function findInlineClosingTag(
  source: string,
  startPos: number,
  tagNameLower: string
): [number, number] | null {
  var depth = 1
  var searchPos = startPos
  while (depth > 0 && searchPos < source.length) {
    var tagIdx = source.indexOf('<', searchPos)
    if (tagIdx === -1) return null
    var tagParseResult = parseHTMLTag(source, tagIdx)
    if (!tagParseResult) {
      searchPos = tagIdx + 1
      continue
    }
    if (
      tagParseResult.isClosing &&
      tagParseResult.tagLower === tagNameLower &&
      --depth === 0
    )
      return [tagIdx, tagParseResult.endPos]
    if (
      !tagParseResult.isClosing &&
      !tagParseResult.isSelfClosing &&
      tagParseResult.tagLower === tagNameLower
    )
      depth++
    searchPos = tagParseResult.endPos
  }
  return null
}

export const INTERPOLATION_R: RegExp = /^\{.*\}$/
const DOUBLE_NEWLINE_R = /\n\n/
const BLOCK_SYNTAX_R =
  /^(\s{0,3}#[#\s]|\s{0,3}[-*+]\s|\s{0,3}\d+\.\s|\s{0,3}>\s|\s{0,3}```)/m
const TYPE1_TAG_R = /<\/?(?:pre|script|style|textarea)\b/i
export const UPPERCASE_TAG_R: RegExp = /^<[A-Z]/
const TRAILING_NEWLINE_R = /\n$/
const BLOCK_START_CHARS_SET = new Set([
  '#',
  '>',
  '-',
  '*',
  '+',
  '`',
  '|',
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
])

/** Find the next occurrence of a character, ignoring escaped versions */
function findUnescapedChar(
  source: string,
  startPos: number,
  endPos: number,
  targetChar: string
): number {
  let i = startPos
  while (i < endPos) {
    if (source[i] === '\\' && i + 1 < endPos) {
      i += 2
      continue
    }
    if (source[i] === targetChar) return i
    i++
  }
  return -1
}

type StyleTuple = [key: string, value: string]

function addStyleToCollection(styles: StyleTuple[], buffer: string): void {
  var colonIndex = buffer.indexOf(':')
  if (colonIndex > 0) {
    var value = buffer.slice(colonIndex + 1).trim()
    var len = value.length
    if (len >= 2) {
      var first = value[0]
      if ((first === '"' || first === "'") && value[len - 1] === first) {
        value = value.slice(1, -1)
      }
    }
    styles.push([buffer.slice(0, colonIndex).trim(), value])
  }
}

export function parseStyleAttribute(styleString: string): StyleTuple[] {
  var styles: StyleTuple[] = []
  if (!styleString) return styles

  var buffer = ''
  var depth = 0
  var quoteChar = ''

  for (var i = 0; i < styleString.length; i++) {
    var char = styleString[i]

    if (char === '"' || char === "'") {
      if (!quoteChar) {
        quoteChar = char
        depth++
      } else if (char === quoteChar) {
        quoteChar = ''
        depth--
      }
    } else if (char === '(' && util.endsWith(buffer, 'url')) {
      depth++
    } else if (char === ')' && depth > 0) {
      depth--
    } else if (char === ';' && depth === 0) {
      addStyleToCollection(styles, buffer)
      buffer = ''
      continue
    }

    buffer += char
  }

  addStyleToCollection(styles, buffer)

  return styles
}

function attributeValueToJSXPropValue(
  tag: MarkdownToJSX.HTMLTags,
  key: string,
  value: string,
  sanitizeUrlFn: (
    value: string,
    tag: string,
    attribute: string
  ) => string | null,
  options: ParseOptions
): any {
  if (key === 'style') {
    return parseStyleAttribute(value).reduce(
      function (styles, [k, v]) {
        const sanitized = sanitizeUrlFn(v, tag, k)
        if (sanitized != null) {
          styles[k.replace(/(-[a-z])/g, substr => substr[1].toUpperCase())] =
            sanitized
        }
        return styles
      },
      {} as { [key: string]: any }
    )
  }

  // Handle JSX expressions (braces) before sanitization
  // This allows parsing of arrays/objects in JSX props
  if (value.match(INTERPOLATION_R)) {
    value = value.slice(1, value.length - 1)
    value = value ? value.replace(UNESCAPE_R, '$1') : value

    // Try to parse as JSON for arrays/objects (best effort)
    // Keep as raw string for functions and complex expressions
    if (value.length > 0) {
      const firstChar = value[0]
      // Check if it looks like an array or object literal
      if (firstChar === '[' || firstChar === '{') {
        try {
          return JSON.parse(value)
        } catch (e) {
          // Not valid JSON, keep as string (e.g., functions, JSX expressions)
          return value
        }
      }
    }
    // For other expressions (functions, variables, etc.), keep as string by default
    // Only eval if explicitly opted-in (NOT recommended for user inputs)
    if (value === 'true') return true
    if (value === 'false') return false

    // Attempt to eval unserializable expressions only if explicitly enabled
    // ⚠️ WARNING: This uses eval() and should only be used with trusted content
    if (options.evalUnserializableExpressions) {
      try {
        // Try to evaluate as an expression (function, variable, etc.)
        // eslint-disable-next-line no-eval
        return eval(`(${value})`)
      } catch (e) {
        // If eval fails, return as string
        return value
      }
    }

    // Don't apply sanitization to JSX expressions
    // Keep as string - can be handled via renderRule on a case-by-case basis
    return value
  }

  if (util.ATTRIBUTES_TO_SANITIZE.indexOf(key) !== -1) {
    return sanitizeUrlFn(
      value ? value.replace(UNESCAPE_R, '$1') : value,
      tag,
      key
    )
  }

  return value === 'true' ? true : value === 'false' ? false : value
}

function parseHTMLAttributes(
  attrs: string,
  tagName: string,
  tagNameOriginal: string,
  options: ParseOptions
): { [key: string]: any } {
  const result: { [key: string]: any } = {}
  if (!attrs || !attrs.trim()) return result

  const attrMatches: string[] = []
  let i = 0
  const len = attrs.length
  while (i < len) {
    while (i < len && isSpaceOrTab(attrs[i])) i++
    if (i >= len) break
    const nameStart = i
    while (i < len && isNameChar(attrs[i])) i++
    if (i === nameStart) {
      i++
      continue
    }
    const name = attrs.slice(nameStart, i)
    while (i < len && isSpaceOrTab(attrs[i])) i++
    if (i >= len || attrs[i] !== '=') {
      attrMatches.push(name)
      continue
    }
    i++
    while (i < len && isSpaceOrTab(attrs[i])) i++
    if (i >= len) {
      attrMatches.push(name + '=')
      break
    }
    const valueStart = i
    const q = attrs[i]
    if (q === '"' || q === "'") {
      i++
      while (i < len) {
        if (attrs[i] === q) {
          if (i + 1 >= len) {
            i++
            break
          }
          const nextChar = attrs[i + 1]
          if (isSpaceOrTab(nextChar) || nextChar === '/') {
            i++
            break
          }
        }
        i++
      }
    } else if (q === '{') {
      let depth = 1
      i++
      while (i < len && depth > 0) {
        if (attrs[i] === '{') depth++
        else if (attrs[i] === '}') {
          depth--
          if (depth === 0) {
            i++
            break
          }
        }
        i++
      }
    } else {
      while (i < len && !isSpaceOrTab(attrs[i])) i++
    }
    attrMatches.push(name + '=' + attrs.slice(valueStart, i))
  }

  if (!attrMatches?.length) return result
  const tagNameLower = tagName.toLowerCase(),
    isJSXComponent =
      tagNameOriginal.length > 0 &&
      tagNameOriginal[0] >= 'A' &&
      tagNameOriginal[0] <= 'Z'
  for (let i = 0; i < attrMatches.length; i++) {
    const rawAttr = attrMatches[i],
      delimiterIdx = rawAttr.indexOf('=')
    if (delimiterIdx !== -1) {
      const key = rawAttr.slice(0, delimiterIdx).trim(),
        keyLower = key.toLowerCase()
      if (keyLower === 'ref') continue
      const attrKey = isJSXComponent ? key : keyLower,
        rawValue = rawAttr.slice(delimiterIdx + 1).trim(),
        value = ((str: string) => {
          const first = str[0]
          if (
            (first === '"' || first === "'") &&
            str.length >= 2 &&
            str[str.length - 1] === first
          )
            return str.slice(1, -1)
          return str
        })(rawValue)

      if (
        (keyLower === 'href' && tagNameLower === 'a') ||
        (keyLower === 'src' && tagNameLower === 'img')
      ) {
        const safe = options.sanitizer(
          value,
          tagNameLower as MarkdownToJSX.HTMLTags,
          keyLower
        )
        if (safe == null) {
          warn(`Stripped unsafe ${keyLower} on <${tagNameOriginal}>`)
          continue
        }
        result[attrKey] = safe
      } else {
        const normalizedValue = attributeValueToJSXPropValue(
          tagNameLower as MarkdownToJSX.HTMLTags,
          keyLower,
          value,
          options.sanitizer,
          options
        )
        result[attrKey] = normalizedValue
      }
    } else if (rawAttr !== 'style')
      result[isJSXComponent ? rawAttr : rawAttr.toLowerCase()] = true
  }
  // Check for URI-encoded malicious content in the raw attributes string
  // Only decode if % is present (performance optimization)
  if (attrs.indexOf('%') !== -1) {
    try {
      if (util.SANITIZE_R.test(decodeURIComponent(attrs)))
        for (var key in result) delete result[key]
    } catch (e) {
      // Invalid URI encoding (e.g., "100%") - skip the check
      // Individual attributes were already sanitized above
    }
  } else if (util.SANITIZE_R.test(attrs)) {
    for (var key in result) delete result[key]
  }
  return result
}

export type ParseResult = (MarkdownToJSX.ASTNode & { endPos: number }) | null

/** Options passed to parsers */
export type ParseOptions = Omit<MarkdownToJSX.Options, 'slugify'> & {
  slugify: (input: string) => string
}

var isBlockStartChar = function (c: string): boolean {
  return BLOCK_START_CHARS_SET.has(c)
}

interface BracketEntry {
  type: 'link' | 'image'
  pos: number
  resultIdx: number
  inAnchor: boolean
}

// Check if an invalid reference definition should be skipped per CommonMark Examples 208 and 210
function shouldSkipInvalidReferenceDefinition(
  input: string,
  refCheckPos: number,
  isAtDocumentStart: boolean
): { shouldSkip: boolean; newPos: number } {
  // Find closing ']' handling escapes
  let bracketEnd = refCheckPos + 1
  while (bracketEnd < input.length && input[bracketEnd] !== ']') {
    if (input[bracketEnd] === '\\' && bracketEnd + 1 < input.length) {
      bracketEnd += 2
      continue
    }
    bracketEnd++
  }
  if (bracketEnd >= input.length) return { shouldSkip: false, newPos: 0 }

  // Check if label starts/ends with newline (Example 208 pattern)
  const labelStart = refCheckPos + 1
  const labelEnd = bracketEnd
  const labelStartsWithNewline =
    labelStart < labelEnd &&
    (input[labelStart] === '\n' || input[labelStart] === '\r')
  const labelEndsWithNewline =
    labelEnd > labelStart &&
    (input[labelEnd - 1] === '\n' || input[labelEnd - 1] === '\r')

  let afterBracket = bracketEnd + 1
  // Skip whitespace after ']'
  afterBracket = util.skipWhitespace(input, afterBracket)

  // Check for colon
  if (afterBracket >= input.length || input[afterBracket] !== ':') {
    return { shouldSkip: false, newPos: 0 }
  }

  // Found colon - check for Example 208 pattern (label starts/ends with newline at document start)
  if ((labelStartsWithNewline || labelEndsWithNewline) && isAtDocumentStart) {
    // Invalid ref definition per Example 208 - skip to next line after URL
    let skipPos = afterBracket + 1
    skipPos = util.skipWhitespace(input, skipPos)
    // Skip optional newline
    if (skipPos < input.length && input[skipPos] === '\n') {
      skipPos = util.skipWhitespace(input, skipPos + 1)
    }
    // Find end of URL line (next newline)
    while (skipPos < input.length && input[skipPos] !== '\n') {
      skipPos++
    }
    if (skipPos < input.length) {
      skipPos++
    }
    return { shouldSkip: true, newPos: skipPos }
  }

  // Check for Example 210 pattern (trailing text after title)
  return checkExample210Pattern(input, afterBracket)
}

// Helper for Example 210: trailing text after title
function checkExample210Pattern(
  input: string,
  colonPos: number
): { shouldSkip: boolean; newPos: number } {
  let urlEnd = colonPos + 1
  urlEnd = util.skipWhitespace(input, urlEnd)
  // Skip optional newline
  if (urlEnd < input.length && input[urlEnd] === '\n') {
    urlEnd = util.skipWhitespace(input, urlEnd + 1)
  }
  // Find end of URL (next newline)
  while (urlEnd < input.length && input[urlEnd] !== '\n') {
    urlEnd++
  }
  if (urlEnd >= input.length) return { shouldSkip: false, newPos: 0 }

  urlEnd++
  // Check for title delimiter on next line
  let titleLineStart = util.skipWhitespace(input, urlEnd)
  if (
    titleLineStart >= input.length ||
    (input[titleLineStart] !== '"' && input[titleLineStart] !== "'")
  ) {
    return { shouldSkip: false, newPos: 0 }
  }

  // Has title delimiter - check for trailing text (Example 210)
  const titleChar = input[titleLineStart]
  let titleEnd = titleLineStart + 1
  while (
    titleEnd < input.length &&
    input[titleEnd] !== titleChar &&
    input[titleEnd] !== '\n'
  ) {
    if (input[titleEnd] === '\\' && titleEnd + 1 < input.length) {
      titleEnd += 2
      continue
    }
    titleEnd++
  }
  if (titleEnd >= input.length || input[titleEnd] !== titleChar) {
    return { shouldSkip: false, newPos: 0 }
  }

  // Found closing quote - check for trailing text
  let afterTitle = util.skipWhitespace(input, titleEnd + 1)
  if (
    afterTitle < input.length &&
    input[afterTitle] !== '\n' &&
    input[afterTitle] !== '\r'
  ) {
    // Trailing text found - invalid ref definition per Example 210
    return { shouldSkip: true, newPos: urlEnd }
  }

  return { shouldSkip: false, newPos: 0 }
}

// Check if nodes contain a link (prevents nested links per CommonMark)
function containsLink(nodes: MarkdownToJSX.ASTNode[]): boolean {
  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i]
    if (node.type === RuleType.link) return true
    if (node.type === RuleType.textFormatted) {
      var formattedNode = node as MarkdownToJSX.FormattedTextNode
      if (formattedNode.children && containsLink(formattedNode.children))
        return true
    }
  }
  return false
}

function extractAllTextFromNodes(nodes: MarkdownToJSX.ASTNode[]): string {
  var text = ''
  for (var i = 0, len = nodes.length; i < len; i++) {
    var node = nodes[i]
    var type = node.type
    if (type === RuleType.text) {
      text += (node as MarkdownToJSX.TextNode).text
    } else if (type === RuleType.image) {
      var imgNode = node as MarkdownToJSX.ImageNode
      if (imgNode.alt) text += imgNode.alt
    } else if (type === RuleType.textFormatted) {
      var formattedNode = node as MarkdownToJSX.FormattedTextNode
      if (formattedNode.children) {
        text += extractAllTextFromNodes(formattedNode.children)
      }
    } else if (type === RuleType.link) {
      var linkNode = node as MarkdownToJSX.LinkNode
      if (linkNode.children) {
        text += extractAllTextFromNodes(linkNode.children)
      }
    }
  }
  return text
}

const WHITESPACE_CHARS = new Set([' ', '\t', '\r', '\n', '\f', '\v'])

/**
 * Single pass, no recursion, eliminates parseLink/parseImage/parseRefLink/parseRefImage functions
 */
function parseInlineSpan(
  source: string,
  start: number,
  end: number,
  state: MarkdownToJSX.State,
  options: ParseOptions
): MarkdownToJSX.ASTNode[] {
  debug('parse', 'inlineSpan', state)
  var result: MarkdownToJSX.ASTNode[] = []
  var delimiterStack: DelimiterEntry[] = []
  var bracketStack: BracketEntry[] = []

  var pos = start
  var textStart = start
  var skipAutoLink = options.disableAutoLink || state.inAnchor
  var hasAmpersand = false
  var inAnchor = !!state.inAnchor
  var disableParsingRawHTML = !!options.disableParsingRawHTML

  // Helper: handle HTML tag parsing (angle brace autolinks, comments, tags, type 7 blocks)
  var handleHTMLTag = function (
    checkType7Block: boolean,
    respectDisableAutoLink: boolean
  ): boolean {
    if (!inAnchor && (!respectDisableAutoLink || !options.disableAutoLink)) {
      trackAttempt('linkAngleBrace')
      var angleBraceResult = parseLinkOrImage(source, pos, state, options, '<')
      if (angleBraceResult) {
        trackHit('linkAngleBrace')
        flushText(pos)
        result.push(angleBraceResult)
        pos = angleBraceResult.endPos
        textStart = pos
        return true
      }
    }

    // Skip HTML parsing if disableParsingRawHTML is enabled
    if (disableParsingRawHTML) {
      return false
    }

    trackAttempt('htmlElement')
    var htmlResult = parseHTML(source, pos, state, options)
    if (htmlResult) {
      trackHit('htmlElement')
      flushText(pos)
      result.push(htmlResult)
      pos = htmlResult.endPos
      textStart = pos
      return true
    }

    if (!checkType7Block) return false
    var tagCheckResult = parseHTMLTag(source, pos)
    if (!tagCheckResult) return false
    var tagNameStart = pos + (tagCheckResult.isClosing ? 2 : 1)
    if (tagNameStart >= source.length || isSpaceOrTab(source[tagNameStart]))
      return false
    var closeIdx = source.indexOf('>', pos + 1)
    if (closeIdx !== -1) {
      var contentStart = pos + 1
      var contentLen = closeIdx - contentStart
      if (contentLen >= 7) {
        var isHttp = util.startsWith(source, 'http://', contentStart)
        if (isHttp || util.startsWith(source, 'https://', contentStart)) {
          for (var j = contentStart; j < closeIdx; j++) {
            if (isSpaceOrTab(source[j])) return false
          }
        }
      }
    }
    var tagFirstCharCode = charCode(source, tagNameStart)
    if (
      isAlphaCode(tagFirstCharCode) &&
      tagNameStart + 1 < source.length &&
      source[tagNameStart + 1] === ':'
    )
      return false
    if (tagCheckResult.isClosing && tagCheckResult.attrs.trim().length)
      return false

    if (tagCheckResult.attrs.length) {
      var inQuotes = false
      var quoteChar = ''
      for (var i = 0; i < tagCheckResult.attrs.length; i++) {
        var ch = tagCheckResult.attrs[i]
        if (inQuotes && ch === quoteChar) {
          inQuotes = false
        } else if (!inQuotes && (ch === '"' || ch === "'")) {
          inQuotes = true
          quoteChar = ch
        } else if (ch === '*' || ch === '#' || ch === '!') {
          var checkAhead = i + 1
          while (
            checkAhead < tagCheckResult.attrs.length &&
            tagCheckResult.attrs[checkAhead] !== '=' &&
            tagCheckResult.attrs[checkAhead] !== ' ' &&
            tagCheckResult.attrs[checkAhead] !== '\t'
          )
            checkAhead++
          if (
            checkAhead < tagCheckResult.attrs.length &&
            tagCheckResult.attrs[checkAhead] === '='
          )
            return false
        }
      }
    }

    // Valid tag with newline - type 7 block, preserve as raw HTML
    // But still parse content into children
    var rawText = source.slice(pos, tagCheckResult.endPos)
    var tagName = tagCheckResult.tagName.toLowerCase()
    var contentToParse = rawText
    // Extract content if rawText includes opening tag
    var tagEnd = contentToParse.indexOf('>')
    if (tagEnd !== -1) {
      contentToParse = contentToParse.slice(tagEnd + 1)
      var closingTag = '</' + tagName + '>'
      var closingIdx = contentToParse.indexOf(closingTag)
      if (closingIdx !== -1) {
        contentToParse = contentToParse.slice(0, closingIdx)
      }
    }
    var children: MarkdownToJSX.ASTNode[] = []
    if (contentToParse.trim() && options) {
      var parseState: MarkdownToJSX.State = {
        ...state,
        inline: false,
        inHTML: true,
      }
      var trimmed = contentToParse.trim()
      if (
        DOUBLE_NEWLINE_R.test(trimmed) ||
        BLOCK_SYNTAX_R.test(trimmed) ||
        HTML_BLOCK_ELEMENT_START_R.test(trimmed)
      ) {
        children = parseBlocksInHTML(trimmed, parseState, options)
      } else if (trimmed) {
        parseState.inline = true
        children = parseInlineSpan(
          trimmed,
          0,
          trimmed.length,
          parseState,
          options
        )
      }
    }
    var htmlBlockResult = {
      type: RuleType.htmlBlock,
      tag: tagCheckResult.tagName as MarkdownToJSX.HTMLTags,
      attrs: {},
      children: children,
      rawText: rawText,
      text: rawText, // @deprecated - use rawText instead
      verbatim: true,
      endPos: tagCheckResult.endPos,
    } as MarkdownToJSX.HTMLNode & { endPos: number }
    flushText(pos)
    result.push(htmlBlockResult)
    pos = htmlBlockResult.endPos
    textStart = pos
    return true
  }

  var flushText = function (endPos: number) {
    if (endPos > textStart) {
      var text = source.slice(textStart, endPos)
      result.push({
        type: RuleType.text,
        text: hasAmpersand ? util.decodeEntityReferences(text) : text,
      } as MarkdownToJSX.TextNode)
      textStart = endPos
      hasAmpersand = false
    }
  }

  while (pos < end) {
    var code = charCode(source, pos)
    var charType = getCharType(code, skipAutoLink)

    if (charType === 0) {
      if (code === $.CHAR_AMPERSAND) hasAmpersand = true
      pos++
      // Fast path for ASCII text - avoid repeated charCode calls and lookups
      while (pos < end) {
        code = charCode(source, pos)
        if (code >= $.CHAR_ASCII_BOUNDARY) break
        if (code === $.CHAR_AMPERSAND) hasAmpersand = true
        var lookupCharType = util.inlineCharTypeTable[code]
        if (lookupCharType !== 0) {
          // Check for autolink exception
          if (
            skipAutoLink &&
            lookupCharType === 1 &&
            (code === $.CHAR_f || code === $.CHAR_H || code === $.CHAR_W)
          ) {
            pos++
            continue
          }
          break
        }
        pos++
      }
      continue
    }

    // CODE SPANS (highest priority, no nesting)
    if (code === $.CHAR_BACKTICK) {
      trackAttempt('codeInline')
      var backtickStart = pos
      var backtickCount = 0
      while (pos + backtickCount < end) {
        if (charCode(source, pos + backtickCount) !== $.CHAR_BACKTICK) break
        backtickCount++
      }

      if (backtickCount > 0) {
        var contentStart = pos + backtickCount
        var contentEnd = -1
        var i = contentStart
        // Scan character by character for closing backticks - faster than indexOf
        while (i < end) {
          // Find next backtick
          while (i < end && charCode(source, i) !== $.CHAR_BACKTICK) i++
          if (i >= end) break

          // Count consecutive backticks
          var closingCount = 0
          while (
            i + closingCount < end &&
            charCode(source, i + closingCount) === $.CHAR_BACKTICK
          ) {
            closingCount++
          }
          if (closingCount > backtickCount) closingCount = backtickCount
          var j = i + closingCount

          // Check if this is a valid closing sequence
          if (
            closingCount === backtickCount &&
            (i <= contentStart ||
              charCode(source, i - 1) !== $.CHAR_BACKTICK) &&
            (j >= end || charCode(source, j) !== $.CHAR_BACKTICK)
          ) {
            contentEnd = i
            i = j
            break
          }
          i++
        }

        if (contentEnd !== -1) {
          var rawContent = source.slice(contentStart, contentEnd)
          var hasNewline = false
          for (var k = 0; k < rawContent.length; k++) {
            var nlCode = charCode(rawContent, k)
            if (nlCode === $.CHAR_NEWLINE || nlCode === $.CHAR_CR) {
              hasNewline = true
              break
            }
          }
          var content = rawContent
          if (hasNewline) {
            // Optimize newline replacement by avoiding regex
            content = rawContent
              .replace(/\r\n/g, ' ')
              .replace(/\r/g, ' ')
              .replace(/\n/g, ' ')
          }
          if (content.length > 0) {
            var firstChar = charCode(content, 0)
            var lastChar = charCode(content, content.length - 1)
            if (firstChar === $.CHAR_SPACE && lastChar === $.CHAR_SPACE) {
              for (var idx = 1; idx < content.length - 1; idx++) {
                if (charCode(content, idx) !== $.CHAR_SPACE) {
                  content = content.slice(1, content.length - 1)
                  break
                }
              }
            }
          }

          flushText(backtickStart)
          trackHit('codeInline')
          result.push({
            type: RuleType.codeInline,
            text: content,
          } as MarkdownToJSX.CodeInlineNode)
          pos = i
          textStart = pos
          continue
        }
        pos = contentStart
        continue
      }
    }

    // AUTOLINKS: BARE URLS AND EMAIL (check BEFORE escapes to preserve backslashes in URLs)
    if (
      !inAnchor &&
      !skipAutoLink &&
      (code === $.CHAR_f || code === $.CHAR_H || code === $.CHAR_W)
    ) {
      var autolinkType: 'h' | 'w' | 'f' | null = null
      // Cache character codes to avoid repeated function calls
      var c1 = pos + 1 < end ? charCode(source, pos + 1) : 0
      var c2 = pos + 2 < end ? charCode(source, pos + 2) : 0
      var c3 = pos + 3 < end ? charCode(source, pos + 3) : 0
      var c4 = pos + 4 < end ? charCode(source, pos + 4) : 0
      var c5 = pos + 5 < end ? charCode(source, pos + 5) : 0

      if (
        code === $.CHAR_H &&
        c1 === $.CHAR_t &&
        c2 === $.CHAR_t &&
        c3 === $.CHAR_p
      ) {
        autolinkType = 'h'
      } else if (
        code === $.CHAR_W &&
        c1 === $.CHAR_W &&
        c2 === $.CHAR_W &&
        c3 === $.CHAR_PERIOD
      ) {
        autolinkType = 'w'
      } else if (
        code === $.CHAR_f &&
        c1 === $.CHAR_t &&
        c2 === $.CHAR_p &&
        c3 === $.CHAR_COLON &&
        c4 === $.CHAR_SLASH &&
        c5 === $.CHAR_SLASH
      ) {
        autolinkType = 'f'
      }
      if (autolinkType) {
        trackAttempt('linkBareUrl')
        var bareUrlResult = parseLinkOrImage(
          source,
          pos,
          state,
          options,
          autolinkType
        )
        if (bareUrlResult) {
          trackHit('linkBareUrl')
          flushText(pos)
          result.push(bareUrlResult)
          pos = bareUrlResult.endPos
          textStart = pos
          continue
        }
      }
    }

    if (!inAnchor && !skipAutoLink && code === $.CHAR_AT) {
      trackAttempt('linkEmail')
      var emailResult = parseLinkOrImage(source, pos, state, options, '@')
      if (emailResult && 'emailStart' in emailResult) {
        trackHit('linkEmail')
        var emailStart = (
          emailResult as MarkdownToJSX.LinkNode & {
            endPos: number
            emailStart: number
          }
        ).emailStart
        var emailEnd = emailResult.endPos
        var removedIndices: number[] = []
        for (var j = delimiterStack.length - 1; j >= 0; j--) {
          var delim = delimiterStack[j]
          if (delim.sourcePos >= emailStart && delim.sourcePos < emailEnd) {
            if (delim.nodeIndex >= 0 && delim.nodeIndex < result.length) {
              result.splice(delim.nodeIndex, 1)
              removedIndices.push(delim.nodeIndex)
            }
            delimiterStack.splice(j, 1)
          }
        }
        if (emailStart < textStart) {
          for (var i = result.length - 1; i >= 0; i--) {
            if (result[i].type === RuleType.text) {
              result.splice(i, 1)
              removedIndices.push(i)
              break
            }
          }
          textStart = emailStart
        }
        // Batch update delimiter indices after all removals (O(n+m) instead of O(n*m))
        if (removedIndices.length) {
          removedIndices.sort(function (a, b) {
            return a - b
          })
          var removedIdx = 0
          for (var m = 0; m < delimiterStack.length; m++) {
            var delim = delimiterStack[m]
            while (
              removedIdx < removedIndices.length &&
              removedIndices[removedIdx] < delim.nodeIndex
            )
              removedIdx++
            delim.nodeIndex -= removedIdx
          }
        }
        flushText(emailStart)
        result.push(emailResult)
        pos = emailEnd
        textStart = pos
        continue
      }
    }

    // HTML TAGS AND AUTOLINKS (check BEFORE escapes to preserve backslashes in autolinks)
    if (code === $.CHAR_LT) {
      if (handleHTMLTag(true, false)) continue
    }

    // BACKSLASH ESCAPES
    if (code === $.CHAR_BACKSLASH) {
      if (pos + 1 < end && charCode(source, pos + 1) === $.CHAR_NEWLINE) {
        var afterNewline = pos + 2
        while (
          afterNewline < end &&
          charCode(source, afterNewline) === $.CHAR_SPACE
        )
          afterNewline++
        if (afterNewline >= end) {
          pos++
          continue
        }
        trackAttempt('breakLine')
        flushText(pos)
        result.push({ type: RuleType.breakLine } as MarkdownToJSX.BreakLineNode)
        pos += 2
        while (pos < end && charCode(source, pos) === $.CHAR_SPACE) pos++
        textStart = pos
        trackHit('breakLine')
        continue
      }

      trackAttempt('escaped')
      var nextChar = pos + 1 < end ? source[pos + 1] : ''
      if (
        nextChar &&
        '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~'.indexOf(nextChar) !== -1
      ) {
        trackHit('escaped')
        flushText(pos)
        result.push({
          type: RuleType.text,
          text: nextChar === '&' ? '&\u200B' : nextChar,
        } as MarkdownToJSX.TextNode)
        pos += 2
        textStart = pos
        continue
      }
    }

    // LINKS AND IMAGES - OPENING BRACKET
    if (code === $.CHAR_BRACKET_OPEN) {
      if (!inAnchor) {
        if (pos + 1 < end && source[pos + 1] === '^') {
          trackAttempt('footnoteRef')
          var footnoteEndPos = pos + 2
          while (footnoteEndPos < end && source[footnoteEndPos] !== ']')
            footnoteEndPos++
          if (footnoteEndPos < end) {
            trackHit('footnoteRef')
            var identifier = source.slice(pos + 2, footnoteEndPos)
            flushText(pos)
            result.push({
              type: RuleType.footnoteReference,
              target: `#${options.slugify(identifier)}`,
              text: identifier,
            } as MarkdownToJSX.FootnoteReferenceNode)
            pos = footnoteEndPos + 1
            textStart = pos
            continue
          }
        }

        if (
          state.inList &&
          pos + 2 < end &&
          charCode(source, pos + 2) === $.CHAR_BRACKET_CLOSE
        ) {
          var nextCode = charCode(source, pos + 1)
          if (
            nextCode === $.CHAR_SPACE ||
            nextCode === $.CHAR_x ||
            nextCode === $.CHAR_X
          ) {
            trackAttempt('listGfmTask')
            flushText(pos)
            trackHit('listGfmTask')
            result.push({
              type: RuleType.gfmTask,
              completed: nextCode === $.CHAR_x || nextCode === $.CHAR_X,
            } as MarkdownToJSX.GFMTaskNode)
            pos += 3
            textStart = pos
            continue
          }
        }
      }

      var isImage = false
      if (pos > start && source[pos - 1] === '!') {
        var backslashCount = 0
        for (
          var checkPos = pos - 2;
          checkPos >= start && source[checkPos] === '\\';
          checkPos--
        )
          backslashCount++
        if ((backslashCount & 1) === 0) {
          isImage = true
          if (textStart < pos - 1) flushText(pos - 1)
          if (
            result.length > 0 &&
            result[result.length - 1].type === RuleType.text
          ) {
            var lastText = result[result.length - 1] as MarkdownToJSX.TextNode
            if (lastText.text.endsWith('!')) {
              lastText.text = lastText.text.slice(0, -1)
              if (!lastText.text) result.pop()
            }
          }
        }
      }
      if (!isImage) flushText(pos)
      textStart = pos + 1
      if (!inAnchor || isImage) {
        bracketStack.push({
          type: isImage ? 'image' : 'link',
          pos: isImage ? pos - 1 : pos,
          resultIdx: result.length,
          inAnchor: inAnchor,
        })
      }

      pos++
      continue
    }

    // LINKS AND IMAGES - CLOSING BRACKET
    if (code === $.CHAR_BRACKET_CLOSE && bracketStack.length > 0) {
      var bracket = bracketStack[bracketStack.length - 1]
      var linkTextStart = bracket.pos + (bracket.type === 'image' ? 2 : 1)
      var linkTextEnd = pos
      flushText(pos)
      var afterBracket = pos + 1
      var linkChildren = buildLinkChildren(result, bracket)
      var hasNestedLink = bracket.type === 'link' && containsLink(linkChildren)
      var foundRefBrackets = false

      if (
        !hasNestedLink &&
        afterBracket < end &&
        source[afterBracket] === '('
      ) {
        trackAttempt('link')
        var urlResult = parseUrlAndTitle(source, afterBracket + 1, true)
        if (urlResult) {
          trackHit('link')
          finalizeLinkOrImageNode(
            result,
            delimiterStack,
            bracketStack,
            bracket,
            linkTextStart,
            linkTextEnd,
            options.sanitizer(
              unescapeUrlOrTitle(urlResult.target),
              'a',
              'href'
            ),
            urlResult.title ? unescapeUrlOrTitle(urlResult.title) : undefined
          )
          pos = urlResult.endPos
          textStart = pos
          continue
        }
      }

      var refs = state.refs || {}
      if (util.hasKeys(refs)) trackAttempt('linkRef')
      var refLabel: string | null = null
      var refEnd = pos
      if (afterBracket < end && source[afterBracket] === '[') {
        var refStart = afterBracket + 1
        var i = refStart
        while (i < end && source[i] !== ']') i++
        if (i < end) {
          refLabel = source.slice(refStart, i)
          refEnd = i
          foundRefBrackets = true
        }
      }
      if (!foundRefBrackets || refLabel === '')
        refLabel = source.slice(linkTextStart, linkTextEnd)
      var normalizedRef = normalizeReferenceLabel(refLabel)
      if (!hasNestedLink && refs && refs[normalizedRef]) {
        trackHit('linkRef')
        var ref = refs[normalizedRef]
        finalizeLinkOrImageNode(
          result,
          delimiterStack,
          bracketStack,
          bracket,
          linkTextStart,
          linkTextEnd,
          ref.target,
          ref.title
        )
        pos = refEnd + 1
        textStart = pos
        continue
      }

      var bracketResultIdx = bracket.resultIdx
      bracketStack.pop()
      result.length = bracketResultIdx
      if (bracket.type === 'image')
        result.push({
          type: RuleType.text,
          text: '!',
        } as MarkdownToJSX.TextNode)
      result.push(
        { type: RuleType.text, text: '[' } as MarkdownToJSX.TextNode,
        ...linkChildren,
        { type: RuleType.text, text: ']' } as MarkdownToJSX.TextNode
      )
      for (var k = 0; k < delimiterStack.length; k++) {
        if (delimiterStack[k].nodeIndex >= bracketResultIdx)
          delimiterStack[k].nodeIndex++
      }
      pos++
      textStart = pos
      continue
    }

    // ========================================
    // EMPHASIS AND STRIKETHROUGH DELIMITERS (*, _, ~~, ==)
    // ========================================
    if (
      code === $.CHAR_ASTERISK ||
      code === $.CHAR_UNDERSCORE ||
      code === $.CHAR_TILDE ||
      code === $.CHAR_EQ
    ) {
      trackAttempt('formatting')
      var delimChar = source[pos]
      var delimStart = pos
      var delimCount = countConsecutiveChars(source, pos, delimChar)

      // GFM strikethrough (~~) and marked text (==) require exactly 2 delimiters
      if ((delimChar === '~' || delimChar === '=') && delimCount !== 2) {
        pos++
        continue
      }

      var delimiterEnd = delimStart + delimCount
      var leftFlanking = checkFlanking(source, delimStart, delimiterEnd, end, 0)
      var rightFlanking = checkFlanking(
        source,
        delimStart,
        delimiterEnd,
        start,
        1
      )
      var canOpen = leftFlanking
      var canClose = rightFlanking
      if (delimChar === '_' && leftFlanking && rightFlanking) {
        if (delimStart > 0) {
          var precedingChar = source[delimStart - 1]
          var precedingCode = charCode(precedingChar)
          canOpen = isPunctuation(precedingCode, precedingChar)
        }
        if (delimiterEnd < end) {
          var followingChar = source[delimiterEnd]
          var followingCode = charCode(followingChar)
          canClose = isPunctuation(followingCode, followingChar)
        }
      }
      flushText(delimStart)
      delimiterStack.push({
        nodeIndex: result.length,
        type: delimChar as '*' | '_' | '~' | '=',
        length: delimCount,
        canOpen: canOpen,
        canClose: canClose,
        active: true,
        sourcePos: delimStart,
        inAnchor: inAnchor,
      })
      trackHit('formatting')
      result.push({
        type: RuleType.text,
        text: source.slice(delimStart, delimStart + delimCount),
      } as MarkdownToJSX.TextNode)

      pos = delimStart + delimCount
      textStart = pos
      continue
    }

    // ========================================
    // LINE BREAKS
    // ========================================
    if (code === $.CHAR_NEWLINE) {
      var checkPos = pos - 1
      var spaceCount = 0
      while (
        checkPos >= textStart &&
        charCode(source, checkPos) === $.CHAR_SPACE
      ) {
        spaceCount++
        checkPos--
      }
      if (spaceCount >= 2) {
        var afterNewline = pos + 1
        while (
          afterNewline < end &&
          charCode(source, afterNewline) === $.CHAR_SPACE
        )
          afterNewline++
        if (afterNewline >= end) {
          flushText(checkPos + 1)
          pos = end
          textStart = end
          continue
        }
        trackAttempt('breakLine')
        flushText(checkPos + 1)
        result.push({ type: RuleType.breakLine } as MarkdownToJSX.BreakLineNode)
        pos++
        while (pos < end && charCode(source, pos) === $.CHAR_SPACE) pos++
        textStart = pos
        trackHit('breakLine')
        continue
      }

      var prevCode = pos > textStart ? charCode(source, pos - 1) : 0
      var nextCode = pos + 1 < end ? charCode(source, pos + 1) : 0
      var flushPos =
        pos > textStart &&
        prevCode === $.CHAR_SPACE &&
        nextCode === $.CHAR_SPACE
          ? pos - 1
          : pos
      flushText(flushPos)
      result.push({ type: RuleType.text, text: '\n' } as MarkdownToJSX.TextNode)
      textStart = pos + 1
      if (
        pos > start &&
        prevCode === $.CHAR_SPACE &&
        textStart < end &&
        charCode(source, textStart) === $.CHAR_SPACE
      )
        textStart++
      pos = textStart
      continue
    }

    if (code === $.CHAR_AMPERSAND) hasAmpersand = true
    pos++
    while (pos < end) {
      var code = charCode(source, pos)
      if (code >= $.CHAR_ASCII_BOUNDARY) break
      if (code === $.CHAR_AMPERSAND) hasAmpersand = true
      var lookupCharType = util.inlineCharTypeTable[code]
      if (lookupCharType === 0) {
        pos++
        continue
      }
      if (
        lookupCharType === 1 &&
        (code === $.CHAR_f || code === $.CHAR_H || code === $.CHAR_W) &&
        skipAutoLink
      ) {
        pos++
        continue
      }
      break
    }
  }

  flushText(pos)

  // Process emphasis using delimiter stack algorithm
  if (delimiterStack.length) {
    processEmphasis(result, delimiterStack, null)
  }

  // Insert bracket text nodes in forward order (more efficient than reverse splices)
  if (bracketStack.length) {
    bracketStack.sort(function (a, b) {
      return a.resultIdx - b.resultIdx
    })
    for (var i = 0; i < bracketStack.length; i++) {
      result.splice(bracketStack[i].resultIdx + i, 0, {
        type: RuleType.text,
        text: bracketStack[i].type === 'image' ? '![' : '[',
      } as MarkdownToJSX.TextNode)
    }
  }

  return result
}

// Helper: Process emphasis within link/image text and update delimiter stack
function processEmphasisInLinkText(
  result: MarkdownToJSX.ASTNode[],
  delimiterStack: DelimiterEntry[],
  bracket: BracketEntry,
  linkTextStart: number,
  linkTextEnd: number
): void {
  var hasDelims = false
  for (var di = 0; di < delimiterStack.length; di++) {
    if (
      delimiterStack[di].sourcePos >= linkTextStart &&
      delimiterStack[di].sourcePos < linkTextEnd
    ) {
      hasDelims = true
      break
    }
  }
  if (!hasDelims) return

  var tempNodes = buildLinkChildren(result, bracket)
  var tempDelims: DelimiterEntry[] = []
  for (var di = 0; di < delimiterStack.length; di++) {
    var delim = delimiterStack[di]
    if (delim.sourcePos >= linkTextStart && delim.sourcePos < linkTextEnd) {
      tempDelims.push({
        nodeIndex: delim.nodeIndex - bracket.resultIdx,
        type: delim.type,
        length: delim.length,
        canOpen: delim.canOpen,
        canClose: delim.canClose,
        active: delim.active,
        sourcePos: delim.sourcePos,
        inAnchor: delim.inAnchor,
      })
    }
  }
  processEmphasis(tempNodes, tempDelims, null)
  result.length = bracket.resultIdx
  for (var i = 0; i < tempNodes.length; i++) result.push(tempNodes[i])
  var newDelimStack: DelimiterEntry[] = []
  for (var di = 0; di < delimiterStack.length; di++) {
    if (
      delimiterStack[di].sourcePos < linkTextStart ||
      delimiterStack[di].sourcePos >= linkTextEnd
    ) {
      newDelimStack.push(delimiterStack[di])
    }
  }
  delimiterStack.length = 0
  for (var i = 0; i < newDelimStack.length; i++)
    delimiterStack.push(newDelimStack[i])
}

// Helper: Create link or image node from children and target/title
function createLinkOrImageNode(
  bracket: BracketEntry,
  linkChildren: MarkdownToJSX.ASTNode[],
  target: string | null,
  title: string | undefined
): MarkdownToJSX.ASTNode {
  if (bracket.type === 'link') {
    return {
      type: RuleType.link,
      target: target,
      title: title,
      children: linkChildren,
    } as MarkdownToJSX.LinkNode
  }
  trackAttempt('image')
  trackHit('image')
  return {
    type: RuleType.image,
    target: target || '',
    alt: extractAllTextFromNodes(linkChildren),
    title: title,
  } as MarkdownToJSX.ImageNode
}

function buildLinkChildren(
  result: MarkdownToJSX.ASTNode[],
  bracket: BracketEntry
): MarkdownToJSX.ASTNode[] {
  return result.slice(bracket.resultIdx)
}

function finalizeLinkOrImageNode(
  result: MarkdownToJSX.ASTNode[],
  delimiterStack: DelimiterEntry[],
  bracketStack: BracketEntry[],
  bracket: BracketEntry,
  linkTextStart: number,
  linkTextEnd: number,
  target: string | null,
  title: string | undefined
): void {
  processEmphasisInLinkText(
    result,
    delimiterStack,
    bracket,
    linkTextStart,
    linkTextEnd
  )
  var linkChildren = buildLinkChildren(result, bracket)
  bracketStack.pop()
  result.length = bracket.resultIdx
  result.push(createLinkOrImageNode(bracket, linkChildren, target, title))
}

/** Parse URL and optional title from parentheses: (url "title") */
// Parse link destination (URL) - handles angle brackets and regular URLs
function parseLinkDestination(
  source: string,
  start: number,
  allowNestedParens: boolean
): { target: string; endPos: number; hadSpace: boolean } | null {
  let i = util.skipWhitespace(source, start)
  const hasAngleBrackets = i < source.length && source[i] === '<'
  if (hasAngleBrackets) i++
  const actualUrlStart = i

  // Handle empty angle brackets <>
  if (hasAngleBrackets && i < source.length && source[i] === '>') {
    return { target: '', endPos: i + 1, hadSpace: false }
  }

  let target: string
  let urlEnd: number
  var foundSpace = false

  if (hasAngleBrackets) {
    // For angle bracket URLs, parse until '>', allowing spaces and handling escapes
    urlEnd = i
    while (urlEnd < source.length && source[urlEnd] !== '>') {
      const c = source[urlEnd]
      if (c === '\n' || c === '\r' || c === '<') return null
      if (c === '\\') {
        urlEnd += 2
        continue
      }
      urlEnd++
    }
    if (urlEnd >= source.length || source[urlEnd] !== '>') return null
    urlEnd++
    // Trim leading and trailing whitespace inside < >
    let actualStart = actualUrlStart
    while (actualStart < urlEnd - 1 && isSpaceOrTab(source[actualStart]))
      actualStart++
    let actualEnd = urlEnd - 1
    while (actualEnd > actualStart && isSpaceOrTab(source[actualEnd - 1]))
      actualEnd--
    target = source.slice(actualStart, actualEnd)
    i = urlEnd
  } else {
    // Non-angle bracket URL: break on whitespace, newline
    let parenDepth = 0
    urlEnd = i
    while (urlEnd < source.length) {
      const c = source[urlEnd]
      if (c === ' ' || c === '\t' || c === '\n') {
        foundSpace = true
        break
      }
      if (!allowNestedParens && c === ')') break
      if (allowNestedParens && c === '(') {
        if (urlEnd > 0 && source[urlEnd - 1] === '\\') {
          urlEnd++
          continue
        }
        parenDepth++
        urlEnd++
        continue
      }
      if (allowNestedParens && c === ')') {
        if (urlEnd > 0 && source[urlEnd - 1] === '\\') {
          urlEnd++
          continue
        }
        if (parenDepth === 0) break
        parenDepth--
        urlEnd++
        continue
      }
      urlEnd++
    }
    target = source.slice(actualUrlStart, urlEnd)
    i = urlEnd
  }

  return { target, endPos: i, hadSpace: foundSpace }
}

// Parse link title - handles quoted and parenthesized titles
function parseLinkTitle(
  source: string,
  start: number,
  hadSpaceInUrl: boolean,
  hasAngleBrackets: boolean
): { title: string | undefined; endPos: number } {
  let i = start
  // Skip whitespace after URL
  let newlineCount = 0
  while (i < source.length) {
    const c = source[i]
    if (isSpaceOrTab(c)) {
      i++
    } else if (c === '\n') {
      if (newlineCount >= 1) break
      newlineCount++
      i++
    } else if (util.isUnicodeWhitespace(c)) {
      break
    } else {
      break
    }
  }

  // If URL contained spaces and there's no title delimiter, the link is invalid
  if (hadSpaceInUrl && !hasAngleBrackets) {
    if (
      i >= source.length ||
      (source[i] !== '"' && source[i] !== "'" && source[i] !== '(')
    ) {
      return { title: undefined, endPos: i }
    }
  }
  let title: string | undefined = undefined
  if (i < source.length) {
    const titleChar = source[i]
    if (titleChar === '"' || titleChar === "'") {
      i++
      const titleStart = i
      while (i < source.length && source[i] !== titleChar) {
        if (source[i] === '\\') i++
        i++
      }
      if (i < source.length) {
        title = source.slice(titleStart, i)
        i++
      }
    } else if (titleChar === '(') {
      i++
      const titleStart = i
      let parenDepth = 1
      while (i < source.length && parenDepth > 0) {
        if (source[i] === '\\' && i + 1 < source.length) i++
        else if (source[i] === '(') parenDepth++
        else if (source[i] === ')') parenDepth--
        i++
      }
      if (parenDepth === 0) {
        title = source.slice(titleStart, i - 1)
      }
    }
  }

  i = util.skipWhitespace(source, i)
  return { title, endPos: i }
}

function parseUrlAndTitle(
  source: string,
  urlStart: number,
  allowNestedParens: boolean
): { target: string; title: string | undefined; endPos: number } | null {
  const destResult = parseLinkDestination(source, urlStart, allowNestedParens)
  if (!destResult) return null

  let i = urlStart
  i = util.skipWhitespace(source, i)
  const hasAngleBrackets = i < source.length && source[i] === '<'

  // Handle empty angle brackets <>
  if (
    hasAngleBrackets &&
    destResult.target === '' &&
    destResult.endPos === i + 2
  ) {
    const titleResult = parseLinkTitle(
      source,
      destResult.endPos,
      false,
      hasAngleBrackets
    )
    if (
      titleResult.endPos >= source.length ||
      source[titleResult.endPos] !== ')'
    )
      return null
    return {
      target: '',
      title: titleResult.title,
      endPos: titleResult.endPos + 1,
    }
  }

  const titleResult = parseLinkTitle(
    source,
    destResult.endPos,
    destResult.hadSpace,
    hasAngleBrackets
  )
  if (titleResult.endPos >= source.length || source[titleResult.endPos] !== ')')
    return null

  return {
    target: destResult.target,
    title: titleResult.title,
    endPos: titleResult.endPos + 1,
  }
}

enum AutolinkMode {
  URI,
  EMAIL,
  ANGLE,
}

function isAlphaCode(code: number): boolean {
  return (
    (code >= $.CHAR_A && code <= $.CHAR_Z) ||
    (code >= $.CHAR_a && code <= $.CHAR_z)
  )
}

function isValidUriScheme(content: string): boolean {
  const colonPos = content.indexOf(':')
  if (colonPos < 2 || colonPos > 32) return false

  const firstCharCode = charCode(content)
  if (!isAlphaCode(firstCharCode)) {
    return false
  }

  // Check if all chars before colon are valid scheme chars
  for (let j = 1; j < colonPos; j++) {
    const c = content[j]
    const cCode = charCode(c)
    if (!isAlnum(c) && c !== '+' && c !== '.' && c !== '-') {
      return false
    }
  }
  return true
}

function isValidAutolinkContext(
  source: string,
  start: number,
  includeCR: boolean
): boolean {
  if (start === 0) return true
  let validChars = includeCR ? ' \t\n\r*_~(' : ' \t\n*_~('
  return validChars.indexOf(source[start - 1]) !== -1
}

function sanitizeAndCreate(
  target: string,
  linkText: string,
  endPos: number,
  sanitizer: (url: string, tag: string, attr: string) => string | null,
  emailStart?: number
): ParseResult | null {
  let safe = sanitizer(target, 'a', 'href')
  if (!safe) return null
  return {
    type: RuleType.link,
    target: safe,
    children: [{ type: RuleType.text, text: linkText }],
    endPos: endPos,
    ...(emailStart !== undefined ? { emailStart } : {}),
  } as MarkdownToJSX.LinkNode & { endPos: number; emailStart?: number }
}

function parseAutolink(
  source: string,
  pos: number,
  state: MarkdownToJSX.State,
  options: ParseOptions,
  mode: AutolinkMode
): ParseResult | null {
  if (
    state.inAnchor ||
    (mode !== AutolinkMode.ANGLE && options.disableAutoLink)
  )
    return null

  if (mode === AutolinkMode.ANGLE) {
    if (source[pos] !== '<') return null
    let end = pos + 1
    while (end < source.length && source[end] !== '>') {
      const endCode = charCode(source, end)
      if (
        endCode === $.CHAR_SPACE ||
        endCode === $.CHAR_TAB ||
        endCode === $.CHAR_NEWLINE ||
        endCode === $.CHAR_CR ||
        endCode < $.CHAR_SPACE
      )
        return null
      end++
    }
    if (end >= source.length || source[end] !== '>') return null
    let content = source.slice(pos + 1, end)
    if (!content.length) return null

    let hasBackslash = content.indexOf('\\') !== -1
    let hasValidUriScheme = isValidUriScheme(content)
    let isHttp =
      util.startsWith(content, 'http://') ||
      util.startsWith(content, 'https://')
    let isMailto = false
    if (!hasValidUriScheme && !isHttp && content.length >= 7) {
      const firstChar = content[0]
      if (firstChar === 'm' || firstChar === 'M') {
        const contentLower = content.toLowerCase()
        if (util.startsWith(contentLower, 'mailto:')) {
          isMailto = true
          let colonPos = contentLower.indexOf(':')
          let mailtoText = content.slice(colonPos + 1)
          return sanitizeAndCreate(
            'mailto:' + mailtoText,
            content,
            end + 1,
            options.sanitizer
          )
        }
      }
    }
    let isEmailLike =
      !hasBackslash &&
      content.indexOf('@') !== -1 &&
      content.indexOf('//') === -1 &&
      !hasValidUriScheme

    if (!isHttp && !isMailto && !isEmailLike && !hasValidUriScheme) return null

    let target = content,
      linkText = content
    if (!isMailto && !hasValidUriScheme && !isHttp && isEmailLike) {
      target = 'mailto:' + content
    }

    return sanitizeAndCreate(target, linkText, end + 1, options.sanitizer)
  }

  if (mode === AutolinkMode.EMAIL) {
    let emailStart = pos
    while (
      emailStart > 0 &&
      (isAlnum(source[emailStart - 1]) ||
        '.+-_'.indexOf(source[emailStart - 1]) !== -1)
    )
      emailStart--
    if (emailStart >= pos || !isValidAutolinkContext(source, emailStart, true))
      return null

    let emailEnd = pos + 1
    let hasDot = false
    while (emailEnd < source.length) {
      let c = source[emailEnd]
      if (c === '.') {
        hasDot = true
        emailEnd++
      } else if (isAlnum(c) || c === '-' || c === '_') emailEnd++
      else break
    }

    if (!hasDot || emailEnd <= pos + 1) return null
    while (emailEnd > pos + 1 && source[emailEnd - 1] === '.') emailEnd--
    if (
      emailEnd > pos + 1 &&
      (source[emailEnd - 1] === '-' || source[emailEnd - 1] === '_')
    )
      return null
    // Check if email contains at least one dot
    // For large documents, prefer slice+includes to avoid scanning entire document
    const emailLength = emailEnd - (pos + 1)
    if (emailLength < 10000) {
      if (
        source.indexOf('.', pos + 1) >= emailEnd ||
        source.indexOf('.', pos + 1) === -1
      )
        return null
    } else {
      if (source.slice(pos + 1, emailEnd).indexOf('.') === -1) return null
    }

    let email = source.slice(emailStart, emailEnd)
    return sanitizeAndCreate(
      'mailto:' + email,
      email,
      emailEnd,
      options.sanitizer,
      emailStart
    )
  }

  let isHttp =
    util.startsWith(source, 'http://', pos) ||
    util.startsWith(source, 'https://', pos)
  let isFtp = !isHttp && util.startsWith(source, 'ftp://', pos)
  let isWww = !isHttp && !isFtp && util.startsWith(source, 'www.', pos)
  if (
    !(isHttp || isFtp || isWww) ||
    !isValidAutolinkContext(source, pos, false)
  )
    return null

  var urlEnd =
    pos +
    (isHttp ? (charCode(source, pos + 4) === $.CHAR_s ? 8 : 7) : isFtp ? 6 : 4)
  var domainStart = urlEnd
  // Inline scanDomain
  while (urlEnd < source.length) {
    const code = charCode(source, urlEnd)
    if (
      code === $.CHAR_SPACE ||
      code === $.CHAR_TAB ||
      code === $.CHAR_NEWLINE ||
      code === $.CHAR_LT ||
      code === $.CHAR_GT
    )
      break
    urlEnd++
  }
  if (urlEnd <= domainStart) return null
  // Inline trimTrailingPunct
  let trimmed = urlEnd
  while (trimmed > domainStart) {
    let lastChar = source[trimmed - 1]
    if (trimmed > domainStart + 1 && source[trimmed - 2] === '\\') break
    if (
      lastChar === '?' ||
      lastChar === '!' ||
      lastChar === '.' ||
      lastChar === ',' ||
      lastChar === ':' ||
      lastChar === '*' ||
      lastChar === '_' ||
      lastChar === '~'
    ) {
      trimmed--
    } else if (lastChar === ';') {
      let ampPos = trimmed - 2
      while (
        ampPos >= domainStart &&
        source[ampPos] !== '&' &&
        source[ampPos] !== ' '
      )
        ampPos--
      if (ampPos >= domainStart && source[ampPos] === '&') {
        let entityName = source.slice(ampPos + 1, trimmed - 1)
        if (
          entityName.length >= 2 &&
          entityName.length <= 10 &&
          /^[a-zA-Z0-9]+$/.test(entityName) &&
          (entityName === 'lt' ||
            entityName === 'gt' ||
            (entityName.length >= 3 &&
              (util.startsWith(entityName, 'amp') ||
                util.startsWith(entityName, 'apos') ||
                util.startsWith(entityName, 'quot') ||
                util.startsWith(entityName, 'nbsp') ||
                /^[a-z]{3,10}$/.test(entityName))))
        )
          break
        trimmed = ampPos
        break
      }
      trimmed--
    } else if (lastChar === ')') {
      let openCount = 0,
        closeCount = 0
      for (let i = domainStart; i < trimmed; i++) {
        if (source[i] === '(') openCount++
        if (source[i] === ')') closeCount++
      }
      if (closeCount > openCount) trimmed--
      else break
    } else break
  }
  urlEnd = trimmed
  if (urlEnd <= domainStart) return null

  var domainEnd = domainStart
  var lastDot = -1
  var secondLastDot = -1
  while (domainEnd < urlEnd) {
    const domainCode = charCode(source, domainEnd)
    if (
      (domainCode >= $.CHAR_A && domainCode <= $.CHAR_Z) ||
      (domainCode >= $.CHAR_a && domainCode <= $.CHAR_z) ||
      (domainCode >= $.CHAR_DIGIT_0 && domainCode <= $.CHAR_DIGIT_9) ||
      domainCode === $.CHAR_DASH ||
      domainCode === $.CHAR_UNDERSCORE ||
      domainCode === $.CHAR_PERIOD
    ) {
      if (domainCode === $.CHAR_PERIOD) {
        secondLastDot = lastDot
        lastDot = domainEnd
      }
      domainEnd++
      continue
    }
    break
  }
  if (domainEnd === domainStart || lastDot === -1) return null
  if (secondLastDot === -1) secondLastDot = domainStart - 1
  for (let i = secondLastDot + 1; i < lastDot; i++) {
    if (source[i] === '_') return null
  }
  for (let i = lastDot + 1; i < domainEnd; i++) {
    if (source[i] === '_') return null
  }

  let linkText = source.slice(pos, urlEnd)
  return sanitizeAndCreate(
    isWww ? 'http://' + linkText : linkText,
    linkText,
    urlEnd,
    options.sanitizer
  )
}

// Unified link/image parser - handles all link/image types based on starting character
function parseLinkOrImage(
  source: string,
  pos: number,
  state: MarkdownToJSX.State,
  options: ParseOptions,
  startChar: '[' | '!' | '<' | 'h' | 'f' | 'w' | '@'
): ParseResult | null {
  // Angle brace autolink: <url>
  if (startChar === '<') {
    return parseAutolink(
      source,
      pos,
      state,
      options,
      AutolinkMode.ANGLE
    ) as ParseResult
  }

  // Bare URL autolink: http://, https://, ftp://, www.
  if (startChar === 'h' || startChar === 'f' || startChar === 'w') {
    return parseAutolink(
      source,
      pos,
      state,
      options,
      AutolinkMode.URI
    ) as ParseResult
  }

  // Email autolink: @example.com
  if (startChar === '@') {
    return parseAutolink(
      source,
      pos,
      state,
      options,
      AutolinkMode.EMAIL
    ) as ParseResult | null
  }

  // Bracket-based links/images are handled inline in parseInlineSpan
  // This function only handles autolinks
  return null
}

function normalizeReferenceLabel(label: string): string {
  var trimmed = label.trim()
  var normalized = trimmed.replace(/[\s\t\n\r]+/g, ' ')
  if (normalized.indexOf('\u1E9E') !== -1) {
    return normalized.replace(/\u1E9E/g, 'ss').toLowerCase()
  }
  return normalized.toLowerCase()
}

function parseGFMTask(
  source: string,
  pos: number,
  state: MarkdownToJSX.State
): ParseResult {
  debug('parse', 'gfmTask', state)
  if (pos + 3 >= source.length || source[pos] !== '[') return null
  const marker = source[pos + 1]
  if (marker !== ' ' && marker !== 'x' && marker !== 'X') return null
  if (source[pos + 2] !== ']') return null
  return {
    type: RuleType.gfmTask,
    completed: marker.toLowerCase() === 'x',
    endPos: pos + 3,
  } as MarkdownToJSX.GFMTaskNode & { endPos: number }
}

function parseBlocksWithState(
  content: string,
  state: MarkdownToJSX.State,
  options: ParseOptions,
  config: { inline?: boolean; list?: boolean; inBlockQuote?: boolean }
): MarkdownToJSX.ASTNode[] {
  const originalInline = state.inline
  const originalList = state.inList
  const originalInBlockQuote = state.inBlockQuote
  if (config.inline !== undefined) state.inline = config.inline
  if (config.list !== undefined) state.inList = config.list
  if (config.inBlockQuote !== undefined)
    state.inBlockQuote = config.inBlockQuote
  const blocks = parseBlocksInHTML(content, state, options)
  state.inline = originalInline
  state.inList = originalList
  state.inBlockQuote = originalInBlockQuote
  return blocks
}

function parseInlineWithState(
  content: string,
  start: number,
  end: number,
  state: MarkdownToJSX.State,
  options: ParseOptions
): MarkdownToJSX.ASTNode[] {
  return parseWithInlineMode(state, true, () =>
    parseInlineSpan(content, start, end, state, options)
  )
}

type BlockParserFn = (
  source: string,
  pos: number,
  state: MarkdownToJSX.State,
  options: ParseOptions
) => ParseResult | null

function parseBlock(
  source: string,
  pos: number,
  state: MarkdownToJSX.State,
  options: ParseOptions
): ParseResult | null {
  var char = source[pos]
  if (char === undefined) return null
  var effectivePos = pos
  var indentInfo: ReturnType<typeof calculateIndent> | null = null
  var firstChar = char
  var lineEnd: number | null = null

  var charCodeVal = charCode(char)
  var isIndentChar = charCodeVal === $.CHAR_SPACE || charCodeVal === $.CHAR_TAB
  if (isIndentChar) {
    lineEnd = util.findLineEnd(source, pos)
    indentInfo = calculateIndent(source, pos, lineEnd)
    effectivePos = pos + indentInfo.charCount
    if (effectivePos >= source.length) return parseCodeBlock(source, pos, state)
    firstChar = source[effectivePos]
  }
  var spaceEquivalent = indentInfo ? indentInfo.spaceEquivalent : 0
  if (spaceEquivalent >= 4) {
    if (isIndentChar) return parseCodeBlock(source, pos, state)
    return null
  }
  var firstCharCode = charCode(firstChar)
  if (firstCharCode === $.CHAR_GT) {
    var blockQuoteResult = parseBlockQuote(source, pos, state, options)
    if (blockQuoteResult) return blockQuoteResult
  } else if (firstCharCode === $.CHAR_UNDERSCORE) {
    return parseBreakThematic(source, pos, state, options)
  } else if (
    firstCharCode === $.CHAR_DASH ||
    firstCharCode === $.CHAR_ASTERISK ||
    firstCharCode === $.CHAR_PLUS
  ) {
    var thematicBreakResult = parseBreakThematic(source, pos, state, options)
    if (thematicBreakResult) return thematicBreakResult
    var listResult = parseList(source, pos, state, options)
    if (listResult) return listResult
  } else if (
    firstCharCode >= $.CHAR_DIGIT_0 &&
    firstCharCode <= $.CHAR_DIGIT_9
  ) {
    var listResult = parseList(source, pos, state, options)
    if (listResult) return listResult
  } else if (firstCharCode === $.CHAR_HASH) {
    return parseHeading(source, effectivePos, state, options)
  } else if (firstCharCode === $.CHAR_BRACKET_OPEN) {
    return parseDefinition(
      source,
      effectivePos,
      state,
      options,
      effectivePos + 1 < source.length &&
        charCode(source, effectivePos + 1) === $.CHAR_CARET
    )
  } else if (firstCharCode === $.CHAR_LT && !options.disableParsingRawHTML) {
    return parseHTML(source, effectivePos, state, options)
  } else if (
    firstCharCode === $.CHAR_BACKTICK ||
    firstCharCode === $.CHAR_TILDE
  ) {
    if (!lineEnd) lineEnd = util.findLineEnd(source, pos)
    if (!indentInfo) indentInfo = calculateIndent(source, pos, lineEnd)
    if (indentInfo.spaceEquivalent <= 3)
      return parseCodeFenced(source, effectivePos, state, options)
  } else if (firstCharCode === $.CHAR_PIPE) {
    return parseTable(source, pos, state, options)
  }
  if (isIndentChar) return parseCodeBlock(source, pos, state)
  return null
}

/** Parse blocks inside HTML content */
function parseBlocksInHTML(
  input: string,
  state: MarkdownToJSX.State,
  options: ParseOptions
): MarkdownToJSX.ASTNode[] {
  const result: MarkdownToJSX.ASTNode[] = []
  let pos = 0

  while (pos < input.length) {
    while (pos < input.length && input[pos] === '\n') {
      pos++
    }

    if (pos >= input.length) break

    var char = input[pos]

    // Fast path: check for setext heading in list context
    // Per CommonMark: setext headings take precedence over thematic breaks
    if (state.inList && result.length > 0) {
      var lastBlock = result[result.length - 1]
      if (lastBlock?.type === RuleType.paragraph) {
        var paragraph = lastBlock as MarkdownToJSX.ParagraphNode
        // Quick check for potential setext underline characters
        var code = charCode(char)
        if (
          code === $.CHAR_DASH ||
          code === $.CHAR_EQ ||
          code === $.CHAR_SPACE ||
          code === $.CHAR_TAB
        ) {
          var lineEnd = util.findLineEnd(input, pos)
          var lineContent = input.slice(pos, lineEnd)

          // Check indentation (up to 3 spaces allowed for setext headings)
          var indentInfo = calculateIndent(input, pos, lineEnd)
          if (indentInfo.spaceEquivalent < 4) {
            var trimmed = lineContent.slice(indentInfo.charCount).trim()
            // Use convertSetextHeadingInListItem helper to check and convert
            if (convertSetextHeadingInListItem(result, trimmed, options)) {
              pos =
                lineEnd +
                (lineEnd < input.length && input[lineEnd] === '\n' ? 1 : 0)
              continue
            }
          }
        }
      }
    }

    // Try parseBlock first (handles most block types)
    var blockResult = parseBlock(input, pos, state, options)
    if (blockResult) {
      result.push(blockResult)
      pos = blockResult.endPos
      continue
    }

    // Try setext heading (not handled by parseBlock)
    var setextResult = parseHeadingSetext(input, pos, state, options)
    if (setextResult) {
      result.push(setextResult)
      pos = setextResult.endPos
      continue
    }

    var remaining = input.slice(pos).trim()
    if (remaining) {
      // Per CommonMark spec example 293: Before parsing a paragraph, check if there's
      // a blockquote ending with a paragraph in recent blocks that this should merge into
      if (state.inBlockQuote && result.length > 0) {
        // Find the deepest blockquote ending with a paragraph in recent blocks
        // (may be nested inside list items)
        function findBlockquoteWithParagraphEnd(
          node: MarkdownToJSX.ASTNode
        ): MarkdownToJSX.ParagraphNode | null {
          if (node.type === RuleType.blockQuote) {
            var blockQuote = node as MarkdownToJSX.BlockQuoteNode
            if (blockQuote.children && blockQuote.children.length > 0) {
              var lastChild =
                blockQuote.children[blockQuote.children.length - 1]
              if (lastChild.type === RuleType.paragraph) {
                return lastChild as MarkdownToJSX.ParagraphNode
              }
            }
          } else if (
            node.type === RuleType.orderedList ||
            node.type === RuleType.unorderedList
          ) {
            var list = node as
              | MarkdownToJSX.OrderedListNode
              | MarkdownToJSX.UnorderedListNode
            if (list.items && list.items.length > 0) {
              var lastItem = list.items[list.items.length - 1]
              if (lastItem && lastItem.length > 0) {
                var lastItemChild = lastItem[lastItem.length - 1]
                var found = findBlockquoteWithParagraphEnd(lastItemChild)
                if (found) return found
              }
            }
          }
          return null
        }

        // Check recent blocks (from end) for blockquote ending with paragraph
        for (var i = result.length - 1; i >= 0; i--) {
          var paragraph = findBlockquoteWithParagraphEnd(result[i])
          if (paragraph) {
            var parseResult = parseParagraph(input, pos, state, options)
            if (parseResult) {
              var newParagraph = parseResult as MarkdownToJSX.ParagraphNode
              // Merge the new paragraph's children into the blockquote's paragraph
              if (paragraph.children && newParagraph.children) {
                paragraph.children.push(
                  { type: RuleType.text, text: '\n' } as MarkdownToJSX.TextNode,
                  ...newParagraph.children
                )
              }
              pos = parseResult.endPos
              continue
            }
          }
        }
      }

      var parseResult = parseParagraph(input, pos, state, options)
      if (parseResult) {
        result.push(parseResult)
        pos = parseResult.endPos
        continue
      }
    }

    pos++
  }

  return result
}

function parseHeading(
  source: string,
  pos: number,
  state: MarkdownToJSX.State,
  options: ParseOptions
): ParseResult {
  debug('parse', 'heading', state)
  if (state.inline) return null

  // Find line end to limit expensive indentation scan
  const lineEnd = util.findLineEnd(source, pos)
  const indentResult = calculateIndent(source, pos, lineEnd, 3)
  if (indentResult.spaceEquivalent > 3 && !state.inList) return null
  var i = pos + indentResult.charCount

  if (i >= source.length || source[i] !== '#') return null
  trackBlockAttempt('heading')

  const level = countConsecutiveChars(source, i, '#', 6)
  i += level

  if (i >= source.length) return null
  const afterHash = source[i]
  if (afterHash === '\n' || afterHash === '\r') {
    const lineEnd = util.findLineEnd(source, i)
    return {
      ...createHeading(level, [], '', options.slugify),
      endPos: lineEnd + (lineEnd < source.length ? 1 : 0),
    } as MarkdownToJSX.HeadingNode & { endPos: number }
  }
  if (afterHash !== ' ' && afterHash !== '\t') return null

  const contentStart = i
  const contentEnd = util.findLineEnd(source, contentStart)
  var content = source
    .slice(contentStart, contentEnd)
    .replace(HEADING_TRAILING_HASHES_R, '')
    .trim()

  const children = parseInlineWithState(
    content,
    0,
    content.length,
    state,
    options
  )
  trackBlockHit('heading')

  return {
    ...createHeading(level, children, content, options.slugify),
    endPos: contentEnd + (contentEnd < source.length ? 1 : 0),
  } as MarkdownToJSX.HeadingNode & { endPos: number }
}

function parseHeadingSetext(
  source: string,
  pos: number,
  state: MarkdownToJSX.State,
  options: ParseOptions
): ParseResult {
  debug('parse', 'headingSetext', state)
  trackBlockAttempt('headingSetext')

  if (state.inline || state.inBlockQuote || state.inList) return null

  const firstLineEnd = util.findLineEnd(source, pos)
  if (firstLineEnd >= source.length) return null

  // Find underline pattern first, then validate backwards
  let underlineLineStart = skipToNextLine(source, firstLineEnd),
    underlineLineEnd = -1,
    underlineChar: string | null = null

  // Scan forward for underline (= or - with up to 3 spaces indentation)
  for (
    var linesScanned = 0;
    underlineLineStart < source.length && linesScanned < 10;
    linesScanned++
  ) {
    const lineEnd = util.findLineEnd(source, underlineLineStart)
    if (lineEnd >= source.length) break

    // Check if blank line (stops setext headings)
    var i = underlineLineStart
    while (
      i < lineEnd &&
      (charCode(source, i) === $.CHAR_SPACE ||
        charCode(source, i) === $.CHAR_TAB ||
        charCode(source, i) === $.CHAR_CR)
    )
      i++
    if (i >= lineEnd) break

    // Check indentation (up to 3 spaces) and first char
    var indentCount = 0,
      checkPos = underlineLineStart
    while (
      checkPos < lineEnd &&
      indentCount < 3 &&
      charCode(source, checkPos) === $.CHAR_SPACE
    ) {
      indentCount++
      checkPos++
    }

    if (checkPos < lineEnd) {
      const code = charCode(source, checkPos)
      if (code === $.CHAR_EQ || code === $.CHAR_DASH) {
        // Validate underline: only = or - with optional trailing spaces, no internal spaces
        const char = source[checkPos]
        var underlineCount = 0,
          hasSeenWS = false,
          p = checkPos
        while (p < lineEnd) {
          const c = charCode(source, p)
          if (c === code) {
            if (hasSeenWS) {
              underlineCount = 0
              break
            }
            underlineCount++
          } else if (c === $.CHAR_SPACE || c === $.CHAR_TAB) {
            hasSeenWS = true
          } else {
            underlineCount = 0
            break
          }
          p++
        }

        if (underlineCount >= 1) {
          underlineLineEnd = lineEnd
          underlineChar = char
          break
        }
      }
    }

    underlineLineStart = skipToNextLine(source, lineEnd)
  }

  if (!underlineChar) return null

  // Quick validation: content cannot start with certain block characters
  const firstCharCode = charCode(source, pos)
  if (
    firstCharCode === $.CHAR_HASH ||
    firstCharCode === $.CHAR_GT ||
    source[pos] === '|'
  )
    return null

  // Collect content lines forward to underline
  let contentEnd = pos
  var currentPos = pos,
    hasContent = false

  while (currentPos < underlineLineStart) {
    const lineEnd = util.findLineEnd(source, currentPos)
    if (lineEnd >= underlineLineStart) break

    // Check if line has non-whitespace content
    var j = currentPos
    while (
      j < lineEnd &&
      (charCode(source, j) === $.CHAR_SPACE ||
        charCode(source, j) === $.CHAR_TAB ||
        charCode(source, j) === $.CHAR_CR)
    )
      j++
    if (j < lineEnd) {
      // Line has content
      hasContent = true
      contentEnd = lineEnd
    }

    currentPos = skipToNextLine(source, lineEnd)
  }

  if (!hasContent) return null

  // Extract and trim content
  const rawContent = source.slice(pos, contentEnd)
  var startTrim = 0,
    endTrim = rawContent.length
  while (
    startTrim < endTrim &&
    (rawContent.charCodeAt(startTrim) === $.CHAR_SPACE ||
      rawContent.charCodeAt(startTrim) === $.CHAR_TAB ||
      rawContent.charCodeAt(startTrim) === $.CHAR_CR ||
      rawContent.charCodeAt(startTrim) === $.CHAR_NEWLINE)
  )
    startTrim++
  while (
    endTrim > startTrim &&
    (rawContent.charCodeAt(endTrim - 1) === $.CHAR_SPACE ||
      rawContent.charCodeAt(endTrim - 1) === $.CHAR_TAB ||
      rawContent.charCodeAt(endTrim - 1) === $.CHAR_CR ||
      rawContent.charCodeAt(endTrim - 1) === $.CHAR_NEWLINE)
  )
    endTrim--
  const content = rawContent.slice(startTrim, endTrim)

  if (!content) return null

  const level = underlineChar === '=' ? 1 : 2
  const children = parseInlineWithState(
    content,
    0,
    content.length,
    state,
    options
  )

  return {
    ...createHeading(level, children, content, options.slugify),
    endPos: underlineLineEnd + (underlineLineEnd < source.length ? 1 : 0),
  } as MarkdownToJSX.HeadingNode & { endPos: number }
}

function parseParagraph(
  source: string,
  pos: number,
  state: MarkdownToJSX.State,
  options: ParseOptions
): ParseResult {
  debug('parse', 'paragraph', state)
  // Note: We don't check isBlockStartChar here because this is called as a fallback
  // after other block parsers have already tried and failed
  if (state.inline) return null
  let endPos = pos
  const sourceLen = source.length

  while (endPos < sourceLen) {
    let lineEnd = util.findLineEnd(source, endPos)
    let isEmptyLine = true

    for (let i = endPos; i < lineEnd; i++) {
      const code = charCode(source, i)
      if (code !== $.CHAR_SPACE && code !== $.CHAR_TAB && code !== $.CHAR_CR) {
        isEmptyLine = false
        break
      }
    }

    if (isEmptyLine) {
      endPos = lineEnd
      break
    }

    if (lineEnd >= sourceLen) {
      endPos = sourceLen
      break
    }

    const nextLineStart = skipToNextLine(source, lineEnd)
    if (nextLineStart >= sourceLen) {
      endPos = sourceLen
      break
    }

    let nextLineEnd = util.findLineEnd(source, nextLineStart)
    let nextLineIsEmpty = true
    let nextLineFirstChar = ''

    for (let i = nextLineStart; i < nextLineEnd; i++) {
      const code = charCode(source, i)
      if (code !== $.CHAR_SPACE && code !== $.CHAR_TAB && code !== $.CHAR_CR) {
        nextLineIsEmpty = false
        if (nextLineFirstChar === '') nextLineFirstChar = source[i]
        break
      }
    }

    if (nextLineIsEmpty) {
      endPos = lineEnd
      break
    }

    // Check if next line starts with a block element
    // BUT: per CommonMark, lines indented by exactly 4 spaces are paragraph continuation,
    // not code blocks or other blocks, even if they start with block-starting characters.
    let shouldBreak = false
    const nextIndentInfo = calculateIndent(source, nextLineStart, nextLineEnd)
    const isExact4SpaceIndent =
      nextIndentInfo.spaceEquivalent === 4 && nextIndentInfo.charCount === 4

    // Check for HTML blocks first (types 1-6 can interrupt paragraphs)
    // Per CommonMark spec: HTML blocks of types 1-6 can interrupt paragraphs
    if (
      nextLineFirstChar === '<' &&
      !isExact4SpaceIndent &&
      !options.disableParsingRawHTML
    ) {
      const htmlCheckPos = nextLineStart
      let htmlLineStart = htmlCheckPos
      let htmlIndent = 0
      while (htmlLineStart < nextLineEnd && htmlIndent < 3) {
        const code = charCode(source, htmlLineStart)
        if (code === $.CHAR_SPACE || code === $.CHAR_TAB) {
          htmlIndent++
          htmlLineStart++
        } else {
          break
        }
      }
      if (htmlLineStart < nextLineEnd && source[htmlLineStart] === '<') {
        var htmlResult = parseHTML(
          source,
          htmlLineStart,
          { ...state, inline: false },
          options
        )
        if (htmlResult) {
          shouldBreak =
            !('canInterruptParagraph' in htmlResult) ||
            (htmlResult.canInterruptParagraph as boolean)
        }
      }
    }

    // In list context, lines indented to the content start column are also continuation
    // For now, treat 4-space indented lines as continuation regardless of context
    if (isExact4SpaceIndent) {
      // Line is indented exactly 4 spaces - this is paragraph continuation
      // Per CommonMark spec: lines indented by exactly 4 spaces are paragraph continuation,
      // not code blocks or other blocks, even if they start with block-starting characters.
      // Don't break, continue paragraph across this line
      shouldBreak = false
    } else if (
      !shouldBreak &&
      nextLineFirstChar &&
      isBlockStartChar(nextLineFirstChar)
    ) {
      // Reference definitions don't break paragraphs - skip them
      if (nextLineFirstChar === '[') {
        // Check if it's a reference definition (not a footnote)
        const checkPos = nextLineStart
        if (checkPos + 1 >= sourceLen || source[checkPos + 1] !== '^') {
          // Could be a reference definition - don't break paragraph
          shouldBreak = false
        } else {
          // Footnote definition - break paragraph
          shouldBreak = true
        }
      } else if (nextLineFirstChar === '*' || nextLineFirstChar === '+') {
        // Asterisk/plus is only a block start for lists (*/+ followed by space/tab) or thematic breaks (3+ alone)
        // But thematic breaks can have up to 3 spaces indentation, so check for thematic break first
        const thematicBreakResult = parseBreakThematic(
          source,
          nextLineStart,
          state,
          options
        )
        if (thematicBreakResult) {
          shouldBreak = true
        } else {
          // Check if it's a list (followed by space/tab)
          const secondChar =
            nextLineStart + 1 < sourceLen ? source[nextLineStart + 1] : ''
          if (secondChar && isSpaceOrTab(secondChar)) {
            shouldBreak = true
          } else {
            // Not a list or thematic break - don't break paragraph
            shouldBreak = false
          }
        }
      } else {
        // Use parseBlock to check if next line starts a block
        // Special handling needed for setext headings and ordered lists
        const blockResult = parseBlock(source, nextLineStart, state, options)

        if (blockResult) {
          // Check if it's a code block from 4+ space indentation (paragraph continuation)
          if (blockResult.type === RuleType.codeBlock) {
            const blockIndentInfo = calculateIndent(
              source,
              nextLineStart,
              nextLineEnd
            )
            if (blockIndentInfo.spaceEquivalent >= 4) {
              // 4+ space indentation is paragraph continuation, not a block start
              shouldBreak = false
            } else {
              // Fenced code block - break paragraph
              shouldBreak = true
            }
          } else if (
            blockResult.type === RuleType.unorderedList ||
            blockResult.type === RuleType.orderedList
          ) {
            // Lists can interrupt paragraphs, but ordered lists starting with numbers other than 1 cannot
            if (blockResult.type === RuleType.orderedList) {
              const orderedList = blockResult as MarkdownToJSX.OrderedListNode
              // Only ordered lists starting with 1 can interrupt paragraphs
              shouldBreak = orderedList.start === 1
            } else {
              shouldBreak = true
            }
          } else if (nextLineFirstChar === '-') {
            // Dash could be setext heading underline if preceded by content
            // Per CommonMark: setext headings take precedence over thematic breaks
            if (endPos > pos) {
              // We have content - break paragraph to let setext heading parser check
              shouldBreak = true
            } else {
              // No content - use the block result (thematic break or list)
              shouldBreak = true
            }
          } else if (blockResult.type === RuleType.ref) {
            // Reference definitions don't break paragraphs
            shouldBreak = false
          } else {
            // Other block types break paragraphs
            shouldBreak = true
          }
        }
      }
    } else {
      // Next line doesn't start with a block-starting character
      // Per CommonMark: in paragraph context, lines indented by exactly 4 spaces
      // are paragraph continuation, not code blocks. Only 4+ spaces at document
      // start (not in paragraph) are code blocks.
      // So we don't break on 4-space indentation in paragraph continuation.
    }

    if (shouldBreak) {
      endPos = lineEnd
      break
    }

    // Continue paragraph across single newline
    endPos = skipToNextLine(source, lineEnd)
  }

  if (endPos <= pos) return null

  // Per CommonMark: lines indented by exactly 4 spaces in paragraph context
  // are continuation, not code blocks. We need to remove the 4-space indentation
  // from continuation lines but preserve them as part of the paragraph.
  var contentStart = pos
  var contentEnd = endPos

  while (contentStart < contentEnd) {
    const code = charCode(source, contentStart)
    if (code === $.CHAR_SPACE || code === $.CHAR_TAB) {
      contentStart++
    } else {
      break
    }
  }

  // Fast path: if no newlines, use content directly (common case)
  // Check if there's a newline between contentStart and contentEnd
  // We can optimize by checking if contentEnd is beyond the first line
  const firstLineEnd = util.findLineEnd(source, contentStart)
  var hasNewline = contentEnd > firstLineEnd

  var processedContent
  if (!hasNewline) {
    // Single line - no processing needed
    processedContent = source.slice(contentStart, contentEnd)
  } else {
    // Multi-line: process 4-space indentation
    var processedParts: string[] = []
    var lineStart = contentStart
    var lineIndex = 0

    while (lineStart < contentEnd) {
      var lineEnd = util.findLineEnd(source, lineStart)
      if (lineEnd > contentEnd) lineEnd = contentEnd

      if (lineIndex === 0) {
        processedParts.push(source.slice(lineStart, lineEnd))
      } else {
        // Check for exactly 4 leading spaces
        var spaceCount = 0
        while (spaceCount < 4 && lineStart + spaceCount < lineEnd) {
          if (charCode(source, lineStart + spaceCount) === $.CHAR_SPACE) {
            spaceCount++
          } else {
            break
          }
        }
        var start = spaceCount === 4 ? lineStart + 4 : lineStart
        processedParts.push(source.slice(start, lineEnd))
      }

      if (lineEnd < contentEnd) {
        const charAtEnd = charCode(source, lineEnd)
        if (charAtEnd === $.CHAR_CR || charAtEnd === $.CHAR_NEWLINE) {
          processedParts.push('\n')
          lineStart = skipToNextLine(source, lineEnd)
        } else {
          lineStart = contentEnd
        }
      } else {
        lineStart = contentEnd
      }
      lineIndex++
    }
    processedContent = processedParts.join('')
  }

  var processedContentEnd = processedContent.length
  while (processedContentEnd > 0) {
    var c = processedContent.charCodeAt(processedContentEnd - 1)
    if (c === $.CHAR_SPACE || c === $.CHAR_TAB) {
      processedContentEnd--
    } else {
      break
    }
  }
  if (processedContentEnd < processedContent.length) {
    processedContent = processedContent.slice(0, processedContentEnd)
  }

  // Check if processed content has actual content
  let hasProcessedContent = false
  for (let i = 0; i < processedContent.length; i++) {
    const code = processedContent.charCodeAt(i)
    if (
      code !== $.CHAR_SPACE &&
      code !== $.CHAR_TAB &&
      code !== $.CHAR_NEWLINE &&
      code !== $.CHAR_CR
    ) {
      hasProcessedContent = true
      break
    }
  }
  if (!hasProcessedContent) return null

  // Per CommonMark spec: Extract link reference definitions from paragraph content
  // Reference definitions can appear at the end of paragraph content
  // They should be extracted and stored, not parsed as inline content
  // Scan backwards from endPos in source to find reference definitions
  var extractedContent = processedContent
  var extractedEndPos = endPos
  // Find the last newline in the source before endPos (optimized: manual scan instead of lastIndexOf)
  var lastNewlinePos = -1
  var searchPos = endPos - 1
  while (searchPos >= contentStart) {
    if (charCode(source, searchPos) === $.CHAR_NEWLINE) {
      lastNewlinePos = searchPos
      break
    }
    searchPos--
  }
  if (lastNewlinePos >= 0) {
    // Per CommonMark spec: "A link reference definition cannot interrupt a paragraph."
    // Only extract reference definitions if they're at the START of the paragraph (no content before them)
    // Check if there's any non-whitespace content before the last newline
    var hasContentBeforeNewline = false
    for (var checkPos = contentStart; checkPos < lastNewlinePos; checkPos++) {
      const code = charCode(source, checkPos)
      if (
        code !== $.CHAR_SPACE &&
        code !== $.CHAR_TAB &&
        code !== $.CHAR_NEWLINE &&
        code !== $.CHAR_CR
      ) {
        hasContentBeforeNewline = true
        break
      }
    }

    // Only extract reference definition if there's no content before the newline
    // (i.e., it's at the start of the paragraph)
    if (!hasContentBeforeNewline) {
      // Check if the content after the last newline is a reference definition
      var refDefStartPos = lastNewlinePos + 1
      // Skip any leading whitespace
      while (refDefStartPos < source.length) {
        const code = charCode(source, refDefStartPos)
        if (code === $.CHAR_SPACE || code === $.CHAR_TAB) {
          refDefStartPos++
        } else {
          break
        }
      }
      // Check indentation - reference definitions can't be indented 4+ spaces
      var refDefIndent = refDefStartPos - (lastNewlinePos + 1)
      if (
        refDefIndent < 4 &&
        refDefStartPos < source.length &&
        source[refDefStartPos] === '['
      ) {
        var refDefState = { ...state, inline: false }
        var refDefResult = parseDefinition(
          source,
          refDefStartPos,
          refDefState,
          options,
          false
        )
        if (refDefResult) {
          // Reference definition was successfully parsed - exclude it from paragraph content
          // Find the corresponding position in processedContent
          // Count newlines from contentStart to lastNewlinePos
          var newlineCount = 0
          var searchPos = contentStart
          while (searchPos <= lastNewlinePos) {
            const nlPos = source.indexOf('\n', searchPos)
            if (nlPos === -1 || nlPos > lastNewlinePos) break
            newlineCount++
            searchPos = nlPos + 1
          }
          // Find the corresponding position in processedContent
          var newlinePosInProcessed = 0
          var newlinesFound = 0
          searchPos = 0
          while (searchPos < processedContent.length) {
            const nlPos = processedContent.indexOf('\n', searchPos)
            if (nlPos === -1) break
            newlinesFound++
            if (newlinesFound === newlineCount) {
              newlinePosInProcessed = nlPos + 1
              break
            }
            searchPos = nlPos + 1
          }
          if (newlinePosInProcessed > 0) {
            extractedContent = processedContent.slice(
              0,
              newlinePosInProcessed - 1
            )
          }
          extractedEndPos = refDefResult.endPos
          // Update state.refs from the parsed reference
          state.refs = refDefState.refs
        }
      }
    }
  }

  // Parse as inline (newlines are preserved by default)
  const children = parseInlineWithState(
    extractedContent,
    0,
    extractedContent.length,
    state,
    options
  )

  var result: MarkdownToJSX.ParagraphNode & {
    endPos: number
    removedClosingTags?: MarkdownToJSX.ASTNode[]
  } = {
    type: RuleType.paragraph,
    children,
    endPos: extractedEndPos,
  }

  // Per CommonMark spec Example 148: when paragraphs contain multiple closing tags at the end,
  // only the first closing tag should be kept in the paragraph, the rest should be removed
  // This handles cases where closing tags are part of HTML block structures
  // Heuristic: if there are 3+ consecutive closing tags, remove all but the first one
  // Example 148: <p><em>world</em>.</pre></p> should keep </pre> but remove </td>, </tr>, </table> (4 tags)
  // Example 623: <p></a></foo ></p> should keep both </a> and </foo > (2 tags, not removed)
  if (children.length > 0) {
    // Find closing tags at the end of paragraph children (ignoring whitespace-only text nodes)
    // Keep the first closing tag but remove the rest
    var closingTagIndices: number[] = []
    for (var i = children.length - 1; i >= 0; i--) {
      var child = children[i]
      if (
        child.type === RuleType.htmlSelfClosing &&
        child.isClosingTag === true
      ) {
        closingTagIndices.push(i)
      } else if (child.type === RuleType.text) {
        var textNode = child as MarkdownToJSX.TextNode
        // Skip whitespace-only text nodes when looking for consecutive closing tags
        if (textNode.text && textNode.text.trim().length > 0) {
          break
        }
      } else {
        // Stop at first non-closing-tag, non-whitespace node
        break
      }
    }
    // If we found 3+ consecutive closing tags at the end, remove all but the first one
    // Store the removed closing tags on the paragraph node so html() can render them separately
    // Heuristic: 3+ tags indicates HTML block structure (like </pre></td></tr></table>)
    // 2 tags might be standalone (like </a></foo >) - keep both
    if (closingTagIndices.length >= 3) {
      // Keep only the first closing tag (earliest in array), remove the rest
      var firstClosingTagIdx = closingTagIndices[closingTagIndices.length - 1]
      var removedClosingTags = children.slice(firstClosingTagIdx + 1)
      children.splice(firstClosingTagIdx + 1)
      result.removedClosingTags = removedClosingTags
    }
  }

  return result
}

function parseFrontmatter(source: string, pos: number): ParseResult {
  if (pos !== 0) return null
  const bounds = util.parseFrontmatterBounds(source)
  if (!bounds?.hasValidYaml) return null
  let sliceEnd = bounds.endPos - 1
  if (sliceEnd > 0 && source[sliceEnd - 1] === '\r') sliceEnd--
  let text = util.normalizeInput(source.slice(0, sliceEnd))
  return {
    type: RuleType.frontmatter,
    text,
    endPos: bounds.endPos,
  } as MarkdownToJSX.FrontmatterNode & { endPos: number }
}

function parseBreakThematic(
  source: string,
  pos: number,
  state?: MarkdownToJSX.State,
  options?: ParseOptions
): ParseResult {
  debug('parse', 'breakThematic', state)
  // Find the end of the line
  const lineEnd = util.findLineEnd(source, pos)

  // Per CommonMark: up to 3 spaces of indentation allowed
  // Count indentation, checking if it exceeds 3 spaces
  // OPTIMIZATION: Work directly on source string to avoid slice allocation
  const indentResult = calculateIndent(source, pos, lineEnd, 3)
  if (indentResult.spaceEquivalent > 3) return null
  var checkPos = pos + indentResult.charCount

  // Now check for thematic break character (-, *, or _)
  if (checkPos >= lineEnd) return null
  const startChar = source[checkPos]
  if (startChar !== '-' && startChar !== '*' && startChar !== '_') return null

  trackBlockAttempt('breakThematic')

  // OPTIMIZATION: Fast path - count matching characters before full validation
  // This eliminates 96% of failed attempts (102 attempts -> ~4 attempts)
  // Thematic break requires 3+ matching chars per CommonMark spec
  var charCount = 0
  var scanPos = checkPos
  while (scanPos < lineEnd) {
    var char = source[scanPos]
    if (char === startChar) {
      charCount++
    } else if (char !== ' ' && char !== '\t') {
      // Non-matching non-whitespace character - not a thematic break
      return null
    }
    scanPos++
  }

  if (charCount < 3) {
    return null // Need at least 3 matching characters per CommonMark spec
  }

  // Fast path check passed - validation complete (count already verified)
  trackBlockHit('breakThematic')

  return {
    type: RuleType.breakThematic,
    endPos: skipToNextLine(source, lineEnd),
  } as MarkdownToJSX.BreakThematicNode & { endPos: number }
}

/** Calculate the space-equivalent indentation at a position (tabs = 4 spaces) */
export function calculateIndent(
  source: string,
  pos: number,
  maxPos: number,
  maxSpaces?: number
): { spaceEquivalent: number; charCount: number } {
  let spaceEquivalent = 0
  let charCount = 0
  let i = pos
  while (i < maxPos) {
    var iCode = charCode(source, i)
    if (iCode !== $.CHAR_SPACE && iCode !== $.CHAR_TAB) break
    if (maxSpaces !== undefined && spaceEquivalent >= maxSpaces) break
    if (iCode === $.CHAR_TAB) {
      spaceEquivalent += 4 - (spaceEquivalent % 4)
    } else {
      spaceEquivalent += 1
    }
    charCount++
    i++
  }
  return { spaceEquivalent, charCount }
}

function extractCodeBlockLineContent(
  source: string,
  lineStart: number,
  lineEnd: number,
  startColumn: number
): string {
  let indentChars = 0
  let indentSpaceEquivalent = 0
  let currentColumn = startColumn
  for (let i = lineStart; i < lineEnd && indentSpaceEquivalent < 4; i++) {
    var iCode = charCode(source, i)
    if (iCode === $.CHAR_TAB) {
      const spaces = 4 - (currentColumn % 4)
      indentSpaceEquivalent += spaces
      indentChars++
      currentColumn += spaces
      if (indentSpaceEquivalent >= 4) break
    } else if (iCode === $.CHAR_SPACE) {
      indentSpaceEquivalent++
      indentChars++
      currentColumn++
      if (indentSpaceEquivalent >= 4) break
    } else {
      break
    }
  }

  let content = source.slice(lineStart + indentChars, lineEnd)
  var tabCount = 0
  for (var tc = lineStart; tc < lineEnd; tc++) {
    if (source[tc] === '\t') tabCount++
    if (tabCount >= 2) break
  }
  if (tabCount >= 2 && util.startsWith(content, '\t') && startColumn > 0) {
    content = '  ' + content.slice(1)
  }
  return content
}

function parseCodeBlock(
  source: string,
  pos: number,
  state: MarkdownToJSX.State
): ParseResult {
  debug('parse', 'codeBlock', state)
  // Limit indentation scan to current line
  const lineEndForIndent = util.findLineEnd(source, pos)
  const indentInfo = calculateIndent(source, pos, lineEndForIndent)
  if (indentInfo.spaceEquivalent < 4) return null

  trackBlockAttempt('codeBlock')

  const initialIndent = indentInfo.spaceEquivalent
  const lineEnd = util.findLineEnd(source, pos + indentInfo.charCount)
  const lineStart = pos

  let column = 0
  var i = lineStart - 1
  while (i >= 0 && source[i] !== '\n' && source[i] !== '\r') {
    i--
  }
  i++
  while (i < lineStart) {
    if (source[i] === '\t') {
      column = column + 4 - (column % 4)
    } else {
      column++
    }
    i++
  }

  let firstLineContent = extractCodeBlockLineContent(
    source,
    lineStart,
    lineEnd,
    column
  )
  const contentStart = skipToNextLine(source, lineEnd)
  if (contentStart >= source.length) {
    if (!firstLineContent.trim()) return null
    trackBlockHit('codeBlock')
    return {
      type: RuleType.codeBlock,
      text: firstLineContent,
      endPos: contentStart,
    } as MarkdownToJSX.CodeBlockNode & { endPos: number }
  }

  var parts: string[] = []
  parts.push(firstLineContent)
  let endPos = contentStart

  while (endPos < source.length) {
    const nextLineEnd = util.findLineEnd(source, endPos)
    if (isBlankLineCheck(source, endPos, nextLineEnd)) {
      const nextLinePos = nextLineEnd + 1
      if (nextLinePos < source.length) {
        const nextLineEnd = util.findLineEnd(source, nextLinePos)
        const nextIndentInfo = calculateIndent(source, nextLinePos, nextLineEnd)
        const nextChar = source[nextLinePos + nextIndentInfo.charCount]
        if (
          nextChar &&
          nextChar !== '\n' &&
          (nextIndentInfo.spaceEquivalent < 4 ||
            (nextChar === '>' &&
              nextIndentInfo.spaceEquivalent < initialIndent))
        ) {
          break
        }
      }
      parts.push('\n')
    } else {
      const currentIndentInfo = calculateIndent(source, endPos, nextLineEnd)
      if (currentIndentInfo.spaceEquivalent < 4) {
        break
      }

      let lineContent = extractCodeBlockLineContent(
        source,
        endPos,
        nextLineEnd,
        0
      )
      parts.push('\n')
      parts.push(lineContent)
    }

    endPos = skipToNextLine(source, nextLineEnd)
  }

  let content = parts.join('')
  content = content.replace(TRAILING_NEWLINE_R, '')
  if (!content.trim()) return null

  trackBlockHit('codeBlock')
  return {
    type: RuleType.codeBlock,
    text: content,
    endPos,
  } as MarkdownToJSX.CodeBlockNode & { endPos: number }
}

export function parseCodeFenced(
  source: string,
  pos: number,
  state: MarkdownToJSX.State,
  options: ParseOptions
): ParseResult {
  debug('parse', 'codeFenced', state)
  // Track attempt at the start - this is a real attempt to parse, regardless of outcome
  trackBlockAttempt('codeFenced')

  const fenceChar = source[pos]
  if (fenceChar !== '`' && fenceChar !== '~') return null

  // Fast check: must have at least 3 consecutive fence chars
  const fenceLength = countConsecutiveChars(source, pos, fenceChar)
  if (fenceLength < 3) return null

  // Find line start for indentation calculation
  let lineStart = pos
  while (lineStart > 0 && charCode(source, lineStart - 1) !== $.CHAR_NEWLINE)
    lineStart--

  // Calculate indentation (caller already verified <= 3, but we need exact value)
  const indentInfo = calculateIndent(source, lineStart, pos)
  let openingIndent = indentInfo.spaceEquivalent
  let contentIndentToRemove = openingIndent

  // Handle 4-space indentation special case (simplified)
  if (openingIndent === 4 && indentInfo.charCount === 4) {
    // All 4 chars before pos are spaces/tabs, so this is indented code block
    openingIndent = 0
    contentIndentToRemove = 4
  }

  // Should not happen since caller checks indent <= 3, but keep for safety
  if (openingIndent >= 4) return null

  let i = util.skipWhitespace(source, pos + fenceLength)
  const lineEnd = util.findLineEnd(source, i)
  let langAndAttrs = source.slice(i, lineEnd).trim()

  if (fenceChar === '`' && langAndAttrs.indexOf('`') !== -1) return null

  langAndAttrs = langAndAttrs.replace(UNESCAPE_R, '$1')
  const langSpaceIdx = langAndAttrs.indexOf(' ')
  const lang =
    langSpaceIdx > 0 ? langAndAttrs.slice(0, langSpaceIdx) : langAndAttrs
  const attrsString =
    langSpaceIdx > 0 ? langAndAttrs.slice(langSpaceIdx + 1).trim() : ''
  const attrs =
    attrsString && /=\s*["']/.test(attrsString)
      ? parseHTMLAttributes(attrsString, 'code', 'code', options)
      : undefined

  let contentStart = skipToNextLine(source, lineEnd)
  let endPos = contentStart
  // Track whether we found an explicit closing fence or an implicit close
  // (when encountering a new opening fence with info string)
  let foundExplicitClose = false

  while (endPos < source.length) {
    let lineEndPos = util.findLineEnd(source, endPos)

    let fenceStart = endPos
    let indentCount = 0
    while (fenceStart < lineEndPos) {
      const code = charCode(source, fenceStart)
      if (code === $.CHAR_SPACE) {
        indentCount++
        fenceStart++
        if (indentCount >= 4) break
      } else if (code === $.CHAR_TAB) {
        indentCount += 4 - (indentCount % 4)
        fenceStart++
        if (indentCount >= 4) break
      } else {
        break
      }
    }

    if (indentCount < 4) {
      let closeLen = countConsecutiveChars(
        source,
        fenceStart,
        fenceChar,
        lineEndPos - fenceStart
      )
      if (closeLen >= fenceLength) {
        let afterFence = fenceStart + closeLen
        while (afterFence < lineEndPos) {
          const code = charCode(source, afterFence)
          if (code === $.CHAR_SPACE || code === $.CHAR_TAB) {
            afterFence++
          } else {
            break
          }
        }
        if (afterFence === lineEndPos) {
          // Valid closing fence (only whitespace after fence chars)
          foundExplicitClose = true
          break
        }
        // Check if this looks like an opening fence with an info string
        // Per issue: a fence with a language (e.g., ```python) should be treated
        // as a new opening fence, implicitly closing the current code block
        // This happens BEFORE this line (we don't include this line in content)
        // Only treat as new opening if info string immediately follows fence (no space)
        // This ensures ``` aaa (with space) is not treated as new opening per CommonMark
        if (closeLen >= 3 && afterFence < lineEndPos) {
          // Check if there's whitespace immediately after the fence chars
          let posAfterFence = fenceStart + closeLen
          let hasWhitespaceAfterFence =
            posAfterFence < lineEndPos &&
            (charCode(source, posAfterFence) === $.CHAR_SPACE ||
              charCode(source, posAfterFence) === $.CHAR_TAB)

          // Only treat as new opening if NO space between fence and info string
          if (!hasWhitespaceAfterFence) {
            // There's non-whitespace immediately after the fence - looks like ```python
            // Info strings cannot contain backticks for backtick fences
            let isValidInfoString = true
            if (fenceChar === '`') {
              // Check if there's a backtick in the info string
              let lineContent = source.slice(posAfterFence, lineEndPos)
              if (lineContent.indexOf('`') !== -1) {
                isValidInfoString = false
              }
            }
            if (isValidInfoString) {
              // This is a new opening fence - current code block ends before this line
              // endPos is already at the start of this line, so content won't include it
              // foundExplicitClose stays false - we don't skip past this line
              break
            }
          }
        }
      }
    } else if (
      contentIndentToRemove === 4 &&
      openingIndent === 0 &&
      indentCount === 4
    ) {
      let closeLen = countConsecutiveChars(
        source,
        fenceStart,
        fenceChar,
        lineEndPos - fenceStart
      )
      if (
        closeLen >= fenceLength &&
        isBlankLineCheck(source, fenceStart + closeLen, lineEndPos)
      ) {
        foundExplicitClose = true
        break
      }
    }

    endPos = skipToNextLine(source, lineEndPos)
  }

  let contentEnd =
    endPos > contentStart && source[endPos - 1] === '\n' ? endPos - 1 : endPos
  if (contentEnd > contentStart && source[contentEnd - 1] === '\r') {
    contentEnd--
  }
  let rawContent = util.normalizeInput(source.slice(contentStart, contentEnd))
  if (contentIndentToRemove) {
    rawContent = removeExtraIndentFromCodeBlock(
      rawContent,
      contentIndentToRemove
    )
  }

  // If we found an explicit closing fence, skip past it
  // If we found an implicit close (new opening fence), endPos should stay at the start
  // of that line so the next parse can handle the new code block
  let finalEndPos =
    foundExplicitClose && endPos < source.length
      ? skipToNextLine(source, util.findLineEnd(source, endPos))
      : endPos

  return {
    type: RuleType.codeBlock,
    text: rawContent,
    lang: lang,
    attrs: attrs,
    endPos: finalEndPos,
  } as MarkdownToJSX.CodeBlockNode & { endPos: number }
}

function parseBlockQuoteChildren(
  content: string,
  state: MarkdownToJSX.State,
  options: ParseOptions
): MarkdownToJSX.ASTNode[] {
  // Fast check: if content is empty or only whitespace, return early
  for (var i = 0; i < content.length; i++) {
    if (!isWS(content[i])) {
      // Parse all blocks using parseBlocksWithState (which uses parseBlock via parseBlocksInHTML)
      const blockChildren = parseBlocksWithState(content, state, options, {
        inline: false,
        inBlockQuote: true,
      })
      // Remove endPos property efficiently without creating intermediate objects
      for (var j = 0; j < blockChildren.length; j++) {
        const node = blockChildren[j] as MarkdownToJSX.ASTNode & {
          endPos?: number
        }
        if ('endPos' in node) {
          delete node.endPos
        }
      }
      return blockChildren
    }
  }
  return []
}

function parseBlockQuote(
  source: string,
  pos: number,
  state: MarkdownToJSX.State,
  options: ParseOptions
): ParseResult {
  debug('parse', 'blockQuote', state)
  if (state.inline) return null
  trackBlockAttempt('blockQuote')

  let checkPos = pos
  while (
    checkPos < source.length &&
    (source[checkPos] === ' ' || source[checkPos] === '\t')
  ) {
    checkPos++
  }
  if (checkPos >= source.length || source[checkPos] !== '>') return null

  // Find the end of the blockquote and process content in single pass
  let endPos = pos
  var processedParts: string[] = []
  var alertType: string | undefined = undefined
  var hasContent = false
  var firstLineStart = -1

  // Track if we're currently in a code block (indented or fenced) that requires > prefix
  var inCodeBlock = false
  var codeBlockType: 'indented' | 'fenced' | null = null
  var fencedFenceChar: string | null = null
  var fencedFenceLength = 0
  var previousLineWasEmpty = false

  while (endPos < source.length) {
    const lineEnd = util.findLineEnd(source, endPos)

    // Check if this line starts a blockquote
    let lineStart = endPos
    // Skip leading whitespace
    while (
      lineStart < lineEnd &&
      (source[lineStart] === ' ' || source[lineStart] === '\t')
    ) {
      lineStart++
    }

    // If line starts with '>', it's part of the blockquote
    if (lineStart < lineEnd && source[lineStart] === '>') {
      let contentStart = lineStart + 1
      if (contentStart < lineEnd && source[contentStart] === ' ') contentStart++

      // Inline code block detection (was detectCodeBlockInBlockQuote)
      const indentInfo = calculateIndent(source, contentStart, lineEnd)
      const isIndented = indentInfo.spaceEquivalent >= 4
      let isFenced = false
      let fenceChar: string | null = null
      let fenceLen = 0
      if (contentStart < lineEnd) {
        const firstChar = source[contentStart]
        if (firstChar === '`' || firstChar === '~') {
          let len = 0
          let i = contentStart
          while (i < lineEnd && source[i] === firstChar && len < 20) {
            len++
            i++
          }
          if (len >= 3) {
            isFenced = true
            fenceChar = firstChar
            fenceLen = len
          }
        }
      }

      // Update code block state
      if (
        inCodeBlock &&
        codeBlockType === 'fenced' &&
        fenceChar === fencedFenceChar &&
        fenceLen >= fencedFenceLength
      ) {
        inCodeBlock = false
        codeBlockType = null
        fencedFenceChar = null
        fencedFenceLength = 0
      } else if (isIndented || isFenced) {
        inCodeBlock = true
        codeBlockType = isIndented ? 'indented' : 'fenced'
        fencedFenceChar = fenceChar
        fencedFenceLength = fenceLen
      }

      // Inline blank line check (was isBlankLineCheck)
      var isBlankLine = !isIndented && !isFenced
      if (isBlankLine) {
        for (var i = contentStart; i < lineEnd; i++) {
          if (!isWS(source[i])) {
            isBlankLine = false
            break
          }
        }
      }
      previousLineWasEmpty = isBlankLine

      // Track first line for alert extraction
      if (firstLineStart === -1 && !isBlankLine) {
        firstLineStart = processedParts.length
      }
      if (!isBlankLine) hasContent = true

      // Process line content: remove > marker and optional space, handle tabs
      const afterMarkerStart = lineStart + 1

      // Check if first char after > is a tab (needs special handling)
      if (afterMarkerStart < lineEnd && source[afterMarkerStart] === '\t') {
        // Expand tabs to spaces
        processedParts.push('  ') // First tab after > becomes 2 spaces
        let col = 4
        for (let k = afterMarkerStart + 1; k < lineEnd; k++) {
          const char = source[k]
          var code = charCode(char)
          if (code === $.CHAR_TAB) {
            const spaces = 4 - (col % 4)
            // Use fixed strings for common cases
            if (spaces === 1) processedParts.push(' ')
            else if (spaces === 2) processedParts.push('  ')
            else if (spaces === 3) processedParts.push('   ')
            else processedParts.push(' '.repeat(spaces))
            col += spaces
          } else {
            processedParts.push(char)
            col++
          }
        }
        if (lineEnd < source.length) processedParts.push('\n')
      } else {
        // Fast path: no tab immediately after > (common case)
        let processedContentStart = afterMarkerStart
        if (
          processedContentStart < lineEnd &&
          source[processedContentStart] === ' '
        ) {
          processedContentStart++
        }
        processedParts.push(source.slice(processedContentStart, lineEnd))
        if (lineEnd < source.length) processedParts.push('\n')
      }
    } else {
      // Check for lazy continuation line (line without > that continues blockquote)
      // Inline blank line check
      var isEmptyLine = true
      for (var i = endPos; i < lineEnd; i++) {
        if (!isWS(source[i])) {
          isEmptyLine = false
          break
        }
      }

      // Stop blockquote if: empty line, or in code block (code blocks require > prefix)
      if (isEmptyLine || inCodeBlock) {
        break
      }

      const lazyIndentInfo = calculateIndent(source, endPos, lineEnd)
      if (lazyIndentInfo.spaceEquivalent === 0) {
        // Check if this line starts a block (excluding reference definitions which don't break blockquotes)
        const blockResult = parseBlock(source, endPos, state, options)
        if (
          blockResult &&
          blockResult.type !== RuleType.ref &&
          blockResult.type !== RuleType.codeBlock
        ) {
          break
        }
        if (previousLineWasEmpty) {
          break
        }
      }
      processedParts.push(source.slice(endPos, lineEnd))
      if (lineEnd < source.length) processedParts.push('\n')
    }

    endPos = skipToNextLine(source, lineEnd)
  }

  // Empty blockquotes are valid (e.g., ">\n" or ">\n>  \n> \n")
  // Only reject if we didn't process any lines at all
  if (endPos === pos) return null

  // Remove trailing newline if present (avoid endsWith check by tracking)
  if (
    processedParts.length > 0 &&
    processedParts[processedParts.length - 1] === '\n'
  ) {
    processedParts.pop()
  }

  let processedContent = processedParts.join('')

  // Extract alert type (check start of content for [!...]\n pattern)
  if (
    processedContent.length >= 4 &&
    processedContent.charCodeAt(0) === $.CHAR_BRACKET_OPEN &&
    processedContent.charCodeAt(1) === $.CHAR_EXCLAMATION
  ) {
    const alertEnd = processedContent.indexOf(']\n', 2)
    if (alertEnd > 2) {
      alertType = processedContent.slice(2, alertEnd)
      processedContent = processedContent.slice(alertEnd + 2)
    }
  }

  const children = parseBlockQuoteChildren(processedContent, state, options)

  const result: MarkdownToJSX.BlockQuoteNode & { endPos: number } = {
    type: RuleType.blockQuote,
    children,
    endPos,
  }
  if (alertType) {
    result.alert = alertType
  }
  trackBlockHit('blockQuote')
  return result
}

/** Remove extra indentation from code block text when used in list items */
function removeExtraIndentFromCodeBlock(
  codeBlockText: string,
  extraIndent: number
): string {
  return codeBlockText
    .split('\n')
    .map(function (line) {
      if (line.length === 0) return line
      let toRemove = extraIndent
      let removed = 0
      let i = 0
      let currentColumn = 0
      while (i < line.length && removed < toRemove) {
        if (line[i] === ' ') {
          removed++
          currentColumn++
          i++
        } else if (line[i] === '\t') {
          const spacesFromTab = 4 - (currentColumn % 4)
          if (removed + spacesFromTab <= toRemove) {
            removed += spacesFromTab
            currentColumn += spacesFromTab
            i++
          } else {
            const remainingToRemove = toRemove - removed
            const spacesToKeep = Math.max(0, spacesFromTab - remainingToRemove)
            return ' '.repeat(spacesToKeep) + line.slice(i + 1)
          }
        } else {
          break
        }
      }
      return line.slice(i)
    })
    .join('\n')
}

function appendListContinuation(
  continuationContent: string,
  lastItem: MarkdownToJSX.ASTNode[],
  state: MarkdownToJSX.State,
  options: ParseOptions,
  addNewline: boolean = true
): void {
  const sourceToParse = (addNewline ? '\n' : '') + continuationContent
  const continuationInline = parseInlineWithState(
    sourceToParse,
    0,
    sourceToParse.length,
    state,
    options
  )
  if (
    lastItem.length > 0 &&
    lastItem[lastItem.length - 1].type === RuleType.paragraph
  ) {
    ;(
      lastItem[lastItem.length - 1] as MarkdownToJSX.ParagraphNode
    ).children.push(...continuationInline)
  } else {
    lastItem.push(...continuationInline)
  }
}

// Helper: Check if list item contains block-level content
function listItemHasBlockContent(item: MarkdownToJSX.ASTNode[]): boolean {
  return item.some(function (node) {
    return (
      node.type === RuleType.codeBlock ||
      node.type === RuleType.paragraph ||
      node.type === RuleType.blockQuote ||
      node.type === RuleType.orderedList ||
      node.type === RuleType.unorderedList ||
      node.type === RuleType.heading
    )
  })
}

// Helper: Check if line matches any list item pattern
function isLineListItem(line: string): boolean {
  return !!line.match(LIST_ITEM_R)
}

// Helper: Find deepest nested list parent in item hierarchy
function findNestedListParent(
  item: MarkdownToJSX.ASTNode[]
): MarkdownToJSX.ASTNode[] {
  if (item.length === 0) return item
  var lastBlock = item[item.length - 1]
  if (
    (lastBlock.type === RuleType.orderedList ||
      lastBlock.type === RuleType.unorderedList) &&
    (
      lastBlock as
        | MarkdownToJSX.OrderedListNode
        | MarkdownToJSX.UnorderedListNode
    ).items?.length > 0
  ) {
    return findNestedListParent(
      (
        lastBlock as
          | MarkdownToJSX.OrderedListNode
          | MarkdownToJSX.UnorderedListNode
      ).items.slice(-1)[0]
    )
  }
  return item
}

// Helper: Skip link reference definition if present
function skipLinkReferenceDefinition(
  source: string,
  linePos: number,
  lineEnd: number,
  indentInfo: ReturnType<typeof calculateIndent>,
  lineWithoutIndent: string,
  state: MarkdownToJSX.State,
  options: ParseOptions
): number | null {
  if (!util.startsWith(lineWithoutIndent, '[')) return null
  var refCheckState = { inline: false, list: false, refs: state.refs || {} }
  var refResult = parseDefinition(
    source,
    linePos + indentInfo.charCount,
    refCheckState,
    options,
    false
  )
  return refResult ? refResult.endPos : null
}

// Helper: Check if we should break list due to empty item after blank line
function shouldBreakForEmptyItem(
  items: MarkdownToJSX.ASTNode[][],
  isEmptyItem: boolean,
  prevLineWasBlank: boolean,
  firstItemContent: string
): boolean {
  if (items.length !== 1 || !prevLineWasBlank) return false
  const lastItem = items[0] // Since items.length === 1, this is the only item
  if (lastItem.length !== 0) return false
  if (isEmptyItem) return true
  if (!isEmptyItem && firstItemContent.trim() === '') return true
  return false
}

// Helper: Calculate content start column for a list item
// Helper: Calculate marker end position from match
function calculateMarkerEnd(match: RegExpMatchArray, ordered: boolean): number {
  var markerStart = match.index || 0
  return ordered
    ? markerStart + match[1].length + match[2].length + 1
    : markerStart + match[1].length + 1
}

function calculateListItemContentColumn(
  source: string,
  contentStartInSource: number,
  lineEnd: number,
  baseIndent: number,
  markerEndInLine: number
): { contentStartColumn: number; contentStartPos: number } {
  var spacesAfterMarker = 0
  var col = baseIndent + markerEndInLine
  var contentCheckPos = contentStartInSource
  while (contentCheckPos < lineEnd && spacesAfterMarker < 4) {
    var code = charCode(source, contentCheckPos)
    if (code === $.CHAR_SPACE) {
      spacesAfterMarker++
      col++
    } else if (code === $.CHAR_TAB) {
      var spaces = 4 - (col % 4)
      if (spacesAfterMarker + spaces > 4) break
      spacesAfterMarker += spaces
      col += spaces
    } else {
      break
    }
    contentCheckPos++
  }
  return { contentStartColumn: col, contentStartPos: contentCheckPos }
}

function matchListItem(
  lineWithoutIndent: string
): { match: RegExpMatchArray; ordered: boolean; listItemRegex: RegExp } | null {
  var match = lineWithoutIndent.match(LIST_ITEM_R)
  if (!match) return null

  // Groups: 1=ordered_num, 2=ordered_delim, 3=ordered_content, 4=ordered_empty_num, 5=ordered_empty_delim, 6=unordered_marker, 7=unordered_content, 8=unordered_empty_marker
  if (match[1]) {
    // Ordered with content: (\d{1,9})([.)])\s+(.*)
    return {
      match: [lineWithoutIndent, match[1], match[2], match[3]],
      ordered: true,
      listItemRegex: ORDERED_LIST_ITEM_WITH_CONTENT_R,
    }
  }
  if (match[4]) {
    // Ordered empty: (\d{1,9})([.)])\s*
    return {
      match: [lineWithoutIndent, match[4], match[5], ''],
      ordered: true,
      listItemRegex: ORDERED_LIST_ITEM_WITH_CONTENT_R,
    }
  }
  if (match[6]) {
    // Unordered with content: ([-*+])\s+(.*)
    return {
      match: [lineWithoutIndent, match[6], match[7]],
      ordered: false,
      listItemRegex: UNORDERED_LIST_ITEM_WITH_CONTENT_R,
    }
  }
  if (match[8]) {
    // Unordered empty: ([-*+])\s*
    return {
      match: [lineWithoutIndent, match[8], ''],
      ordered: false,
      listItemRegex: UNORDERED_LIST_ITEM_WITH_CONTENT_R,
    }
  }
  return null
}

// Helper: Check if a line is a matching list item for the current list
function isMatchingListItem(
  lineWithoutIndent: string,
  indentInfo: ReturnType<typeof calculateIndent>,
  ordered: boolean,
  marker: string | undefined,
  delimiter: string | undefined,
  baseIndent: number,
  listItemRegex: RegExp
): boolean {
  if (indentInfo.spaceEquivalent !== baseIndent) return false
  var match = lineWithoutIndent.match(listItemRegex)
  if (match) {
    return ordered ? match[2] === delimiter : match[1] === marker
  }
  var emptyMatch = lineWithoutIndent.match(LIST_ITEM_R)
  if (!emptyMatch) return false
  if (ordered) {
    return emptyMatch[4] && emptyMatch[5] === delimiter
  } else {
    return emptyMatch[8] === marker
  }
}

// Helper: Handle fenced code blocks that span multiple lines in list items
function expandMultilineFencedCodeBlock(
  source: string,
  itemContent: string,
  startPos: number,
  markerWidth: number
): { content: string; endPos: number } {
  var content = itemContent
  var pos = startPos
  var fenceChar = itemContent[0]
  while (pos < source.length) {
    var lineEnd = util.findLineEnd(source, pos)
    var line = source.slice(pos, lineEnd)
    var processedLine = util.startsWith(line, ' '.repeat(markerWidth))
      ? line.slice(markerWidth)
      : line
    if (
      util.startsWith(processedLine.trim(), fenceChar) &&
      countConsecutiveChars(processedLine.trim(), 0, fenceChar) >= 3
    ) {
      return { content: content, endPos: skipToNextLine(source, lineEnd) }
    }
    content += '\n' + processedLine
    pos = skipToNextLine(source, lineEnd)
  }
  return { content: content, endPos: pos }
}

// Helper function to add a new list item with all standard processing
function addListItem(
  source: string,
  items: MarkdownToJSX.ASTNode[][],
  itemContentStartColumns: number[],
  itemContent: string,
  startPos: number,
  nextLineEnd: number,
  nextIndent: number,
  nextIndentChars: number,
  nextMatch: RegExpMatchArray,
  ordered: boolean,
  hasBlankLines: boolean,
  state: MarkdownToJSX.State,
  options: ParseOptions
): { newCurrentPos: number; itemHasBlankLine: boolean } {
  // Derive marker/delimiter/regex (cheap to recompute vs passing 3 extra params)
  var marker = ordered ? undefined : nextMatch[1]
  var delimiter = ordered ? nextMatch[2] : undefined
  var listItemRegex = ordered
    ? ORDERED_LIST_ITEM_WITH_CONTENT_R
    : UNORDERED_LIST_ITEM_WITH_CONTENT_R

  // Check if item has blank lines
  var itemHasBlankLine = hasBlankLines
  if (!hasBlankLines) {
    var startCheckPos = skipToNextLine(source, nextLineEnd)
    var checkItemPos = startCheckPos
    while (checkItemPos < source.length) {
      var checkLineEnd = util.findLineEnd(source, checkItemPos)
      var checkLine = source.slice(checkItemPos, checkLineEnd)
      var checkIndentInfo = calculateIndent(source, checkItemPos, checkLineEnd)
      var checkIndent = checkIndentInfo.spaceEquivalent
      if (isBlankLineCheck(source, checkItemPos, checkLineEnd)) {
        var afterBlank = skipToNextLine(source, checkLineEnd)
        if (afterBlank < source.length) {
          var afterBlankLineEnd = util.findLineEnd(source, afterBlank)
          var afterBlankIndentInfo = calculateIndent(
            source,
            afterBlank,
            afterBlankLineEnd
          )
          var afterBlankIndent = afterBlankIndentInfo.spaceEquivalent
          var thisItemMarkerEnd = calculateMarkerEnd(nextMatch, ordered)
          var thisItemContentStartInSource =
            startPos + nextIndentChars + thisItemMarkerEnd
          var thisItemResult = calculateListItemContentColumn(
            source,
            thisItemContentStartInSource,
            nextLineEnd,
            nextIndent,
            thisItemMarkerEnd
          )
          var thisItemContentStartColumn = thisItemResult.contentStartColumn
          if (afterBlankIndent + 1 > thisItemContentStartColumn) {
            itemHasBlankLine = true
            break
          }
        }
        break
      } else if (checkIndent <= nextIndent) {
        var checkLineWithoutIndent = checkLine.slice(checkIndentInfo.charCount)
        var checkMatch = checkLineWithoutIndent.match(listItemRegex)
        if (
          checkMatch &&
          (ordered ? checkMatch[2] === delimiter : checkMatch[1] === marker)
        ) {
          break
        }
      }
      checkItemPos = skipToNextLine(source, checkLineEnd)
    }
  }

  // Calculate content start column
  var thisItemMarkerEnd = calculateMarkerEnd(nextMatch, ordered)
  var thisItemContentStartInSource =
    startPos + nextIndentChars + thisItemMarkerEnd
  var thisItemResult = calculateListItemContentColumn(
    source,
    thisItemContentStartInSource,
    nextLineEnd,
    nextIndent,
    thisItemMarkerEnd
  )
  var thisItemContentStartColumn = thisItemResult.contentStartColumn

  // Handle fenced code blocks
  var actualItemContent = itemContent
  var newCurrentPos = skipToNextLine(source, nextLineEnd)
  if (
    util.startsWith(itemContent, '```') ||
    util.startsWith(itemContent, '~~~')
  ) {
    var markerWidth = ordered
      ? nextMatch[1].length + nextMatch[2].length + 1
      : nextMatch[1].length + 1
    var expandedResult = expandMultilineFencedCodeBlock(
      source,
      itemContent,
      newCurrentPos,
      markerWidth
    )
    actualItemContent = expandedResult.content
    newCurrentPos = expandedResult.endPos
  }

  // Build and add item with GFM task support
  items.push(
    buildListItemContent(actualItemContent, itemHasBlankLine, state, options)
  )
  itemContentStartColumns.push(thisItemContentStartColumn)

  return { newCurrentPos, itemHasBlankLine }
}

// Helper function to process list item continuation lines
function checkHTMLTagInterruptsList(
  source: string,
  pos: number,
  indentChars: number,
  baseIndent: number,
  indent: number,
  options: ParseOptions
): boolean {
  if (indent > baseIndent || options.disableParsingRawHTML) return false
  const lineStartPos = pos + indentChars
  if (lineStartPos >= source.length || source[lineStartPos] !== '<')
    return false
  return isValidHTMLTagStart(source, lineStartPos)
}

// Lightweight check for HTML tag validity without full parsing
function isValidHTMLTagStart(source: string, pos: number): boolean {
  if (pos >= source.length || source[pos] !== '<') return false
  const len = source.length
  let i = pos + 1

  // Handle closing tags
  if (i < len && source[i] === '/') {
    i++
  }

  // Must have at least one character for tag name
  if (i >= len) return false

  // First character of tag name must be letter
  const firstChar = charCode(source, i)
  if (!isAlphaCode(firstChar)) return false
  i++

  // Rest of tag name can be letters, digits, hyphens, underscores
  // Use early return to avoid nested conditionals
  while (i < len) {
    const ch = source[i]
    const code = charCode(source, i)

    // Break conditions (valid tag name terminators)
    if (
      ch === '>' ||
      ch === ' ' ||
      ch === '\t' ||
      ch === '\n' ||
      ch === '\r' ||
      ch === '/'
    ) {
      break
    }

    // Valid tag name characters - continue
    if (
      ch === '-' ||
      ch === '_' ||
      isAlphaCode(code) ||
      (code >= 48 && code <= 57)
    ) {
      i++
    } else {
      return false // Invalid character in tag name
    }
  }

  // Find the end of the tag - use state machine approach to reduce branching
  let state = 0 // 0: normal, 1: in double quotes, 2: in single quotes
  while (i < len) {
    const ch = source[i]
    const code = charCode(source, i)

    // State machine for quote handling
    if (state === 1) {
      // in double quotes
      if (ch === '"') state = 0
      i++
    } else if (state === 2) {
      // in single quotes
      if (ch === "'") state = 0
      i++
    } else if (ch === '"') {
      state = 1
      i++
    } else if (ch === "'") {
      state = 2
      i++
    } else if (ch === '>') {
      return true // Found valid closing >
    } else if (ch === '/' && i + 1 < len && source[i + 1] === '>') {
      return true // Found valid self-closing />
    } else if (code === 10 || code === 13) {
      // \n or \r
      return false // No multiline tags in this context
    } else {
      i++
    }
  }

  return false // No closing > found
}

function processContinuation(
  source: string,
  item: MarkdownToJSX.ASTNode[],
  contentStartColumn: number,
  startPos: number,
  baseIndent: number,
  ordered: boolean,
  marker: string | undefined,
  delimiter: string | undefined,
  listItemRegex: RegExp,
  state: MarkdownToJSX.State,
  options: ParseOptions,
  allowLinkRefs?: boolean
): number {
  let pos = startPos
  let prevLineWasBlank = false
  while (pos < source.length) {
    const lineEnd = util.findLineEnd(source, pos)
    const indentInfo = calculateIndent(source, pos, lineEnd)
    const indent = indentInfo.spaceEquivalent

    if (isBlankLineCheck(source, pos, lineEnd)) {
      prevLineWasBlank = true
      pos = skipToNextLine(source, lineEnd)
      continue
    }

    const lineWithoutIndent = source.slice(pos + indentInfo.charCount, lineEnd)

    if (
      indent <= baseIndent &&
      isMatchingListItem(
        lineWithoutIndent,
        indentInfo,
        ordered,
        marker,
        delimiter,
        baseIndent,
        listItemRegex
      )
    ) {
      break
    }

    if (indent >= contentStartColumn) {
      // Check for link reference definitions (only for first item)
      if (allowLinkRefs && prevLineWasBlank) {
        const refEndPos = skipLinkReferenceDefinition(
          source,
          pos,
          lineEnd,
          indentInfo,
          lineWithoutIndent,
          state,
          options
        )
        if (refEndPos) {
          pos = refEndPos
          prevLineWasBlank = false
          continue
        }
      }

      const result = processListContinuationLine(
        source,
        pos,
        lineEnd,
        indentInfo,
        contentStartColumn - 1,
        contentStartColumn,
        item,
        prevLineWasBlank,
        state,
        options,
        undefined,
        baseIndent
      )
      if (result.processed) {
        pos = result.newPos
        prevLineWasBlank = result.wasBlank
        continue
      }
    } else {
      break
    }
  }
  return pos
}

// Helper: Parse content with paragraph wrapping for tight/loose lists
function parseContentWithParagraphHandling(
  content: string,
  wrapInParagraph: boolean,
  state: MarkdownToJSX.State,
  options: ParseOptions
): MarkdownToJSX.ASTNode[] {
  const blocks = parseBlocksWithState(content, state, options, {
    inline: false,
    list: true,
  })
  if (blocks.length > 0) {
    // Unwrap single paragraph for tight lists
    return !wrapInParagraph &&
      blocks.length === 1 &&
      blocks[0].type === RuleType.paragraph
      ? (blocks[0] as MarkdownToJSX.ParagraphNode).children
      : blocks
  }
  // Fallback to inline parsing
  const inline = parseWithInlineMode(state, true, () =>
    parseInlineSpan(content, 0, content.length, state, options)
  )
  return wrapInParagraph && inline.length > 0
    ? [
        {
          type: RuleType.paragraph,
          children: inline,
        } as MarkdownToJSX.ParagraphNode,
      ]
    : inline
}

function buildListItemContent(
  itemContent: string,
  itemHasBlankLine: boolean,
  state: MarkdownToJSX.State,
  options: ParseOptions
): MarkdownToJSX.ASTNode[] {
  const task = parseGFMTask(itemContent, 0, state)
  const hasTask =
    task &&
    (task.endPos >= itemContent.length || itemContent[task.endPos] === ' ')
  if (!hasTask) {
    return parseContentWithParagraphHandling(
      itemContent,
      itemHasBlankLine,
      state,
      options
    )
  }
  trackBlockAttempt('listGfmTask')
  trackBlockHit('listGfmTask')
  const afterTask =
    task.endPos < itemContent.length ? task.endPos + 1 : task.endPos
  const restContent = itemContent.slice(afterTask)
  const restNodes = parseContentWithParagraphHandling(
    restContent,
    itemHasBlankLine,
    state,
    options
  )
  const nodes: MarkdownToJSX.ASTNode[] = [task]
  if (task.endPos < itemContent.length) {
    nodes.push({ type: RuleType.text, text: ' ' } as MarkdownToJSX.TextNode)
  }
  nodes.push(...restNodes)
  return nodes
}

function checkUnicodeWhitespaceAfterMarker(
  match: RegExpMatchArray,
  marker: string
): boolean {
  if (!match[0]) return false
  const markerInMatch = match[0].indexOf(marker)
  if (markerInMatch === -1) return false
  const afterMarkerInMatch = markerInMatch + marker.length
  if (afterMarkerInMatch >= match[0].length) return false
  const afterMarkerChar = match[0][afterMarkerInMatch]
  return afterMarkerChar ? charCode(afterMarkerChar) === $.CHAR_NBSP : false
}

function convertSetextHeadingInListItem(
  lastItem: MarkdownToJSX.ASTNode[],
  underlineLine: string,
  options: ParseOptions
): boolean {
  if (lastItem.length === 0) return false
  const lastBlock = lastItem[lastItem.length - 1]
  const trimmed = underlineLine.trim()
  if (
    (!util.startsWith(trimmed, '=') && !util.startsWith(trimmed, '-')) ||
    trimmed.length < 1 ||
    !/^[=-]+[ \t]*$/.test(trimmed)
  ) {
    return false
  }

  let headingChildren: MarkdownToJSX.ASTNode[] = []
  let headingContent = ''
  if (lastBlock.type === RuleType.paragraph) {
    const paragraph = lastBlock as MarkdownToJSX.ParagraphNode
    headingChildren = paragraph.children
    headingContent = paragraph.children
      .map(child =>
        child.type === RuleType.text
          ? (child as MarkdownToJSX.TextNode).text
          : ''
      )
      .join('')
      .trim()
  } else if (lastBlock.type === RuleType.text) {
    const textNodes: MarkdownToJSX.TextNode[] = []
    let i = lastItem.length - 1
    while (i >= 0 && lastItem[i].type === RuleType.text) {
      textNodes.unshift(lastItem[i] as MarkdownToJSX.TextNode)
      i--
    }
    if (textNodes.length > 0) {
      headingChildren = textNodes
      headingContent = textNodes
        .map(node => (node as MarkdownToJSX.TextNode).text)
        .join('')
        .trim()
    }
  }

  if (!headingContent) return false

  const underlineChar = trimmed[0]
  const level = underlineChar === '=' ? 1 : 2
  if (lastBlock.type === RuleType.paragraph) {
    lastItem.pop()
  } else if (lastBlock.type === RuleType.text) {
    while (
      lastItem.length > 0 &&
      lastItem[lastItem.length - 1].type === RuleType.text
    ) {
      lastItem.pop()
    }
  }
  lastItem.push(
    createHeading(level, headingChildren, headingContent, options.slugify)
  )
  return true
}

function processListContinuationLine(
  source: string,
  currentPos: number,
  nextLineEnd: number,
  nextIndentInfo: ReturnType<typeof calculateIndent>,
  continuationColumn: number,
  contentStartColumn: number,
  lastItem: MarkdownToJSX.ASTNode[],
  prevLineWasBlank: boolean,
  state: MarkdownToJSX.State,
  options: ParseOptions,
  unwrapParagraphs?: boolean,
  baseIndent?: number
): { processed: boolean; newPos: number; wasBlank: boolean } {
  const nextIndent = nextIndentInfo.spaceEquivalent
  const continuationContent = source.slice(
    currentPos + nextIndentInfo.charCount,
    nextLineEnd
  )

  if (nextIndent >= continuationColumn + 4) {
    const blockResult = parseCodeBlock(source, currentPos, state)
    if (blockResult) {
      const codeBlockNode = blockResult as MarkdownToJSX.CodeBlockNode & {
        endPos: number
      }
      const adjustedText = removeExtraIndentFromCodeBlock(
        codeBlockNode.text || '',
        contentStartColumn
      )
      lastItem.push({
        ...codeBlockNode,
        text: adjustedText,
      } as MarkdownToJSX.CodeBlockNode)
      return {
        processed: true,
        newPos: codeBlockNode.endPos,
        wasBlank: false,
      }
    }
  }

  const indentRelativeToContentFenced = nextIndent - (contentStartColumn - 1)
  if (
    nextIndent + 1 >= contentStartColumn &&
    indentRelativeToContentFenced <= 3
  ) {
    const continuationStart = currentPos + nextIndentInfo.charCount
    if (continuationStart < nextLineEnd) {
      const firstCharAfterIndent = source[continuationStart]
      if (firstCharAfterIndent === '`' || firstCharAfterIndent === '~') {
        const fencedResult = parseCodeFenced(
          source,
          continuationStart,
          state,
          options
        )
        if (fencedResult) {
          const codeBlockNode = fencedResult as MarkdownToJSX.CodeBlockNode & {
            endPos: number
          }
          const adjustedText = removeExtraIndentFromCodeBlock(
            codeBlockNode.text || '',
            contentStartColumn - 1
          )
          lastItem.push({
            ...codeBlockNode,
            text: adjustedText,
            endPos: codeBlockNode.endPos,
          } as MarkdownToJSX.CodeBlockNode & { endPos: number })
          return {
            processed: true,
            newPos: codeBlockNode.endPos,
            wasBlank: false,
          }
        }
      }
      // Try parsing as table when line starts with |
      if (firstCharAfterIndent === '|') {
        const tableResult = parseTable(
          source,
          continuationStart,
          state,
          options
        )
        if (tableResult) {
          const tableNode = tableResult as MarkdownToJSX.TableNode & {
            endPos: number
          }
          lastItem.push(tableNode)
          return {
            processed: true,
            newPos: tableNode.endPos,
            wasBlank: false,
          }
        }
      }
    }
  }

  if (
    continuationContent.length > 0 &&
    (continuationContent[0] === '-' ||
      continuationContent[0] === '*' ||
      continuationContent[0] === '+' ||
      (continuationContent[0] >= '0' && continuationContent[0] <= '9'))
  ) {
    const listMarkerRegex = /^([-*+]|\d{1,9}[.)])\s+/
    if (listMarkerRegex.test(continuationContent)) {
      const inline = parseInlineWithState(
        continuationContent,
        0,
        continuationContent.length,
        state,
        options
      )
      lastItem.push({ type: RuleType.text, text: '\n' }, ...inline)
      return {
        processed: true,
        newPos: skipToNextLine(source, nextLineEnd),
        wasBlank: false,
      }
    }
  }

  const mergedPos = tryMergeBlockquoteContinuation(
    source,
    currentPos,
    lastItem,
    continuationContent,
    state,
    options
  )
  if (mergedPos !== null) {
    return { processed: true, newPos: mergedPos, wasBlank: false }
  }

  const continuationBlocks = parseBlocksWithState(
    continuationContent,
    state,
    options,
    { inline: false, list: true }
  )
  if (continuationBlocks.length > 0) {
    if (unwrapParagraphs && continuationBlocks[0].type === RuleType.paragraph) {
      const continuationParagraph =
        continuationBlocks[0] as MarkdownToJSX.ParagraphNode
      lastItem.push(
        { type: RuleType.text, text: '\n' } as MarkdownToJSX.TextNode,
        ...continuationParagraph.children
      )
      if (continuationBlocks.length > 1) {
        lastItem.push(...continuationBlocks.slice(1))
      }
    } else if (
      !prevLineWasBlank &&
      continuationBlocks[0].type === RuleType.paragraph &&
      lastItem.length > 0
    ) {
      const lastBlock = lastItem[lastItem.length - 1]
      const continuationParagraph =
        continuationBlocks[0] as MarkdownToJSX.ParagraphNode
      if (lastBlock.type === RuleType.paragraph) {
        ;(lastBlock as MarkdownToJSX.ParagraphNode).children.push(
          { type: RuleType.text, text: '\n' } as MarkdownToJSX.TextNode,
          ...continuationParagraph.children
        )
      } else if (lastBlock.type === RuleType.heading) {
        lastItem.push(...continuationParagraph.children)
      } else if (!listItemHasBlockContent(lastItem)) {
        lastItem.push(
          { type: RuleType.text, text: ' ' } as MarkdownToJSX.TextNode,
          ...continuationParagraph.children
        )
      } else {
        lastItem.push(...continuationBlocks)
      }
      if (continuationBlocks.length > 1) {
        lastItem.push(...continuationBlocks.slice(1))
      }
    } else {
      lastItem.push(...continuationBlocks)
    }
    return {
      processed: true,
      newPos: skipToNextLine(source, nextLineEnd),
      wasBlank: false,
    }
  }

  if (prevLineWasBlank) {
    const inline = parseWithInlineMode(state, true, () =>
      parseInlineSpan(
        continuationContent,
        0,
        continuationContent.length,
        state,
        options
      )
    )
    lastItem.push({
      type: RuleType.paragraph,
      children: inline,
    } as MarkdownToJSX.ParagraphNode)
  } else {
    appendListContinuation(continuationContent, lastItem, state, options)
  }
  return {
    processed: true,
    newPos: skipToNextLine(source, nextLineEnd),
    wasBlank: false,
  }
}

function parseList(
  source: string,
  pos: number,
  state: MarkdownToJSX.State,
  options: ParseOptions
): ParseResult {
  debug('parse', 'list', state)
  if (state.inline) return null

  // Set inList state for proper GFM task tracking during inline parsing
  var originalInList = state.inList
  state.inList = true

  // Lists must start at the beginning of a line (block boundary)
  if (pos > 0) {
    var prevCharCode = charCode(source, pos - 1)
    if (prevCharCode !== $.CHAR_NEWLINE && prevCharCode !== $.CHAR_CR) {
      state.inList = originalInList
      return null
    }
  }

  var lineEnd = util.findLineEnd(source, pos)
  var indentInfo = calculateIndent(source, pos, lineEnd)
  // Early fail: headings/lists cannot be indented more than 3 spaces unless in list context
  if (indentInfo.spaceEquivalent > 3 && !state.inList) {
    state.inList = originalInList
    return null
  }
  var line = source.slice(pos, lineEnd)
  var indent = indentInfo.charCount
  var lineWithoutIndent = line.slice(indent)

  // Detect list type: ordered (digit marker) vs unordered (-/*/+ marker)
  var matchResult = matchListItem(lineWithoutIndent)
  if (!matchResult) {
    state.inList = originalInList
    return null
  }
  var match = matchResult.match
  var ordered = matchResult.ordered
  var listItemRegex = matchResult.listItemRegex

  // Track attempt after cheap disqualifications but before expensive parsing work
  trackBlockAttempt('list')

  var baseIndent = indentInfo.spaceEquivalent
  // Extract list-specific properties: start number and delimiter for ordered, marker for unordered
  var start = ordered ? parseInt(match[1], 10) : undefined
  var delimiter = ordered ? match[2] : undefined // '.' or ')' for ordered lists
  var marker = ordered ? undefined : match[1] // '-', '*', or '+' for unordered lists

  // Check if this is an empty list item (no content after marker)
  var isEmptyItem = ordered ? match[3] === '' : match[2] === ''

  // Helper: Check if we're at a block boundary (document start or after blank line)
  function isAtBlockBoundary(
    checkPos: number,
    requireBlankLine: boolean
  ): boolean {
    if (checkPos === 0) return true
    var prevCode = charCode(source, checkPos - 1)
    if (prevCode !== $.CHAR_NEWLINE) return false
    if (!requireBlankLine) return true
    var backPos = checkPos - 2
    while (backPos >= 0) {
      var code = charCode(source, backPos)
      if (code !== $.CHAR_SPACE && code !== $.CHAR_TAB) break
      backPos--
    }
    return backPos < 0 || charCode(source, backPos) === $.CHAR_NEWLINE
  }

  // Per CommonMark: empty list items cannot interrupt paragraphs (need blank line)
  if (isEmptyItem && !isAtBlockBoundary(pos, true)) {
    state.inList = originalInList
    return null
  }

  // Per CommonMark: only ordered lists starting with 1 can interrupt paragraphs
  if (ordered && start !== 1 && !isAtBlockBoundary(pos, false)) {
    return null
  }

  // For unordered lists, check that the whitespace after marker is regular space/tab, not Unicode whitespace
  if (!ordered && checkUnicodeWhitespaceAfterMarker(match, marker)) {
    return null
  }

  // Calculate the content start column: where the first non-whitespace character
  // after the marker delimiter actually appears in the source
  // This is needed to determine continuation indentation
  var markerStartInLine = match.index || 0
  // isEmptyItem is already set above - check if it needs updating based on spacesAfterMarkerCount
  // Empty item is different from item with whitespace but no content
  // We'll calculate spacesAfterMarkerCount later and update isEmptyItem if needed
  var markerEndInLine = ordered
    ? markerStartInLine + match[1].length + match[2].length + 1 // number + delimiter + required space
    : isEmptyItem
      ? markerStartInLine + match[1].length // marker only (no space)
      : markerStartInLine + match[1].length + 1 // marker + required space
  // Find the actual position after marker delimiter in the source
  var contentStartInSource = pos + indent + markerEndInLine
  // Count spaces/tabs before first non-whitespace in the content
  // Per CommonMark spec: marker must be followed by 1 ≤ N ≤ 4 spaces
  var contentColumnResult = calculateListItemContentColumn(
    source,
    contentStartInSource,
    lineEnd,
    baseIndent,
    markerEndInLine
  )
  var contentStartColumn = contentColumnResult.contentStartColumn
  // minimumContentStartColumn is the minimum column where content can start (for continuation checks)
  // This is the column after marker+space, regardless of how much whitespace follows
  // For empty items, it's right after the marker
  var markerBaseColumn = baseIndent + markerStartInLine + match[1].length
  var minimumContentStartColumn = ordered
    ? markerBaseColumn + match[2].length + 1 // number + delimiter + space
    : isEmptyItem
      ? markerBaseColumn // marker only (no space)
      : markerBaseColumn + 1 // marker + space

  var items: MarkdownToJSX.ASTNode[][] = []
  // Track contentStartColumn for each item (for nested list detection)
  var itemContentStartColumns: number[] = []

  // Helper: Check if a marker column is nested enough to belong to the last item
  function isMarkerNested(
    markerColumn: number,
    lastItemContentColumn: number,
    hasBlockContent: boolean
  ): boolean {
    return hasBlockContent
      ? markerColumn >= lastItemContentColumn
      : markerColumn > lastItemContentColumn
  }

  // Helper: Get last item
  function getLastItem(): MarkdownToJSX.ASTNode[] {
    return items[items.length - 1]
  }

  // Helper: Get last item's content start column
  function getLastItemContentColumn(): number {
    return (
      itemContentStartColumns[itemContentStartColumns.length - 1] ??
      contentStartColumn
    )
  }

  function tryParseNestedList(
    pos: number,
    lastItem: MarkdownToJSX.ASTNode[]
  ): ParseResult | null {
    const parentItem = findNestedListParent(lastItem)
    const originalList = state.inList
    state.inList = true
    const result = parseList(source, pos, state, options)
    state.inList = originalList
    if (result) {
      parentItem.push(result)
      return result
    }
    return null
  }

  var currentPos = skipToNextLine(source, lineEnd)

  // Check if this is a loose list (has blank lines)
  var checkPos = currentPos
  var hasBlankLines = false

  while (checkPos < source.length) {
    var nextLineEnd = util.findLineEnd(source, checkPos)
    var nextLine = source.slice(checkPos, nextLineEnd)
    if (nextLine.trim() === '') {
      // look ahead to next non-empty line
      var look = skipToNextLine(source, nextLineEnd)
      while (look < source.length) {
        var code = charCode(source, look)
        if (code === $.CHAR_NEWLINE) {
          // keep skipping
        } else if (!WHITESPACE_CHARS.has(source[look])) {
          break
        }
        look++
      }
      var lookEnd = util.findLineEnd(source, look)
      var lookLine = source.slice(look, lookEnd)
      var lookIndentInfo = calculateIndent(source, look, lookEnd)
      var lookLineWithoutIndent = lookLine.slice(lookIndentInfo.charCount)
      if (
        isMatchingListItem(
          lookLineWithoutIndent,
          lookIndentInfo,
          ordered,
          marker,
          delimiter,
          baseIndent,
          listItemRegex
        )
      ) {
        hasBlankLines = true
      } else {
        // Per CommonMark: link reference definitions can interrupt lists
        // If blank line is followed by a link reference definition, check if there's a list item after it
        var refEndPos = skipLinkReferenceDefinition(
          source,
          look,
          lookEnd,
          lookIndentInfo,
          lookLineWithoutIndent,
          state,
          options
        )
        if (refEndPos) {
          var afterRefPos = refEndPos
          while (
            afterRefPos < source.length &&
            charCode(source, afterRefPos) === $.CHAR_NEWLINE
          ) {
            afterRefPos++
          }
          if (afterRefPos < source.length) {
            var afterRefLineEnd = util.findLineEnd(source, afterRefPos)
            var afterRefLine = source.slice(afterRefPos, afterRefLineEnd)
            var afterRefIndentInfo = calculateIndent(
              source,
              afterRefPos,
              afterRefLineEnd
            )
            var afterRefLineWithoutIndent = afterRefLine.slice(
              afterRefIndentInfo.charCount
            )
            if (
              isMatchingListItem(
                afterRefLineWithoutIndent,
                afterRefIndentInfo,
                ordered,
                marker,
                delimiter,
                baseIndent,
                listItemRegex
              )
            ) {
              hasBlankLines = true
            }
          }
        }
      }
      break
    }
    var nextIndentInfo = calculateIndent(source, checkPos, nextLineEnd)
    var nextLineWithoutIndent = nextLine.slice(nextIndentInfo.charCount)
    var nextMatchResult = matchListItem(nextLineWithoutIndent)
    if (!nextMatchResult) break
    var nextMatch = nextMatchResult.match
    if (ordered) {
      if (nextMatch[2] !== delimiter) break
    } else {
      if (nextMatch[1] !== marker) break
    }
    checkPos = skipToNextLine(source, nextLineEnd)
  }

  // Parse the first item
  var firstItemContent = ordered ? match[3] : match[2]
  // Trim leading whitespace from content (regex now captures optional whitespace)
  firstItemContent = firstItemContent.trimStart()

  // Per CommonMark spec: tabs after list marker need special handling
  // For `-\t\tfoo`: `-` at column 0, first tab at column 1 = 3 spaces (one for marker delimiter),
  // second tab at column 4 = 4 spaces, total 6 spaces, so code block with 2 spaces remaining
  // The regex `\s+` consumes the tabs, so match[2]/match[3] is just `foo`
  // We need to check the original source to detect tabs after the marker
  var markerStartPos = pos + indent + (match.index || 0)
  var markerEndPos = ordered
    ? markerStartPos + match[1].length + match[2].length // number + delimiter
    : markerStartPos + match[1].length // marker

  // Check for spaces after marker (for code blocks with 5+ spaces)
  // Per CommonMark: if there are 4+ spaces after the marker (including required space),
  // the first line is an indented code block
  var contentStartPos = markerEndPos
  // Skip the required space/tab after marker
  while (contentStartPos < source.length) {
    var code = charCode(source, contentStartPos)
    if (code !== $.CHAR_SPACE && code !== $.CHAR_TAB) break
    contentStartPos++
  }
  // Count spaces after marker (including the required one)
  var spacesAfterMarkerCount = 0
  var spacesCheckPos = markerEndPos
  while (spacesCheckPos < lineEnd) {
    var code = charCode(source, spacesCheckPos)
    if (code === $.CHAR_TAB) {
      spacesAfterMarkerCount += 4 - (spacesAfterMarkerCount % 4)
    } else if (code === $.CHAR_SPACE) {
      spacesAfterMarkerCount++
    } else {
      break
    }
    spacesCheckPos++
  }

  var tabsProcessed = false
  if (
    markerEndPos < source.length &&
    charCode(source, markerEndPos) === $.CHAR_TAB
  ) {
    // First tab after marker was consumed by `\s+`
    // Tab at column 1 = 3 spaces (1 for delimiter, 2 for content)
    // Check if there's a second tab
    var tabCount = 1
    var tabCheckPos = markerEndPos + 1
    while (
      tabCheckPos < source.length &&
      charCode(source, tabCheckPos) === $.CHAR_TAB
    ) {
      tabCount++
      tabCheckPos++
    }

    if (tabCount >= 2) {
      // We have 2+ tabs after marker: first gives 2 spaces, second at column 4 = 4 spaces
      // Total: 6 spaces, then remove 4 for code block = 2 spaces
      firstItemContent = '      ' + firstItemContent
      tabsProcessed = true
    }
  }
  // Update isEmptyItem now that we know spacesAfterMarkerCount
  // Empty item is one with no whitespace after marker (spacesAfterMarkerCount === 0)
  // For unordered lists, also check that match[2] is empty (no content captured)
  if (!ordered) {
    isEmptyItem = isEmptyItem && spacesAfterMarkerCount === 0
  }
  // RULE_2_CODE_START: if 4+ spaces after marker, first line is indented code block
  // Skip if tabs were already processed (they already account for code block indentation)
  if (spacesAfterMarkerCount >= 4 && !tabsProcessed) {
    // Preserve the leading spaces for code blocks
    const preservedSpaces = ' '.repeat(spacesAfterMarkerCount - 1)
    firstItemContent = preservedSpaces + firstItemContent.trimStart()
  }

  // RULE_3_BLANK_START: check if item starts with blank line
  // If firstItemContent is empty (just whitespace), this is RULE_3_BLANK_START
  var startsWithBlankLine = firstItemContent.trim() === ''
  if (startsWithBlankLine) {
    // For RULE_3_BLANK_START, content starts after blank line(s)
    // Continuation lines need to be indented by W + 1 spaces minimum
    // W is the width of the marker (1 for '-', 2 for '10.', etc.)
    // So minimum continuation indent is markerWidth + 1
  }

  // Check if there will be blank lines within the first item (after currentPos)
  // by looking ahead to see if we'll encounter a blank line before the next item or end
  let firstItemHasBlankLine = hasBlankLines
  if (!hasBlankLines && currentPos < source.length) {
    var firstCheckPos = currentPos
    while (firstCheckPos < source.length) {
      var firstNextLineEnd = util.findLineEnd(source, firstCheckPos)
      var firstNextLine = source.slice(firstCheckPos, firstNextLineEnd)
      if (isBlankLineCheck(source, firstCheckPos, firstNextLineEnd)) {
        // Found blank line - check if continuation belongs to nested list or first item
        var afterBlank = skipToNextLine(source, firstNextLineEnd)
        // Skip consecutive blank lines
        while (afterBlank < source.length) {
          var blankLineEnd = util.findLineEnd(source, afterBlank)
          if (isBlankLineCheck(source, afterBlank, blankLineEnd)) {
            afterBlank = skipToNextLine(source, blankLineEnd)
          } else {
            break
          }
        }

        if (afterBlank < source.length) {
          var afterIndentInfo = calculateIndent(
            source,
            afterBlank,
            source.length
          )
          var afterIndent = afterIndentInfo.spaceEquivalent
          if (afterIndent >= baseIndent) {
            var afterLine = source.slice(
              afterBlank,
              util.findLineEnd(source, afterBlank)
            )
            var afterMatch = afterLine
              .slice(afterIndentInfo.charCount)
              .match(listItemRegex)
            var afterIsNewItem =
              afterMatch &&
              (ordered ? afterMatch[2] === delimiter : afterMatch[1] === marker)

            // Find nested item before blank line and calculate its content column
            var nestedItemContentColumn = null
            for (
              var nestedCheckPos = currentPos;
              nestedCheckPos < firstCheckPos;
              nestedCheckPos = util.findLineEnd(source, nestedCheckPos) + 1
            ) {
              var nestedCheckLineEnd = util.findLineEnd(source, nestedCheckPos)
              var nestedCheckIndentInfo = calculateIndent(
                source,
                nestedCheckPos,
                nestedCheckLineEnd
              )
              var nestedCheckMatch = source
                .slice(nestedCheckPos, nestedCheckLineEnd)
                .slice(nestedCheckIndentInfo.charCount)
                .match(listItemRegex)
              var isNestedItem =
                nestedCheckMatch &&
                nestedCheckIndentInfo.spaceEquivalent > baseIndent &&
                nestedCheckIndentInfo.spaceEquivalent >= contentStartColumn &&
                (ordered
                  ? nestedCheckMatch[2] === delimiter
                  : nestedCheckMatch[1] === marker)

              if (isNestedItem) {
                // Calculate nested item's content column (same pattern as contentStartColumn)
                var nestedMarkerStart =
                  nestedCheckIndentInfo.spaceEquivalent + 1
                var nestedMarkerEnd = ordered
                  ? nestedMarkerStart +
                    nestedCheckMatch[1].length +
                    nestedCheckMatch[2].length +
                    1
                  : nestedMarkerStart + nestedCheckMatch[1].length + 1
                var nestedContentStartInSource =
                  nestedCheckPos +
                  nestedCheckIndentInfo.charCount +
                  nestedCheckMatch[0].length
                var nestedResult = calculateListItemContentColumn(
                  source,
                  nestedContentStartInSource,
                  nestedCheckLineEnd,
                  nestedMarkerStart,
                  nestedMarkerEnd - nestedMarkerStart
                )
                nestedItemContentColumn = nestedResult.contentStartColumn
                break
              }
            }

            var continuationCheckColumn =
              spacesAfterMarkerCount >= 5
                ? minimumContentStartColumn
                : contentStartColumn
            if (
              !afterIsNewItem &&
              afterIndent >= continuationCheckColumn &&
              (nestedItemContentColumn === null ||
                afterIndent + 1 < nestedItemContentColumn)
            ) {
              firstItemHasBlankLine = true
            }
          }
        }
        break
      }
      // Check if this line is a new list item (at same or greater indentation)
      var firstLineIndentInfo = calculateIndent(
        source,
        firstCheckPos,
        firstNextLineEnd
      )
      var firstIndent = firstLineIndentInfo.spaceEquivalent
      var firstLineWithoutIndent = firstNextLine.slice(
        firstLineIndentInfo.charCount
      )
      var firstLineMatch = firstLineWithoutIndent.match(listItemRegex)
      var firstIsNewItem =
        firstLineMatch &&
        (ordered
          ? firstLineMatch[2] === delimiter
          : firstLineMatch[1] === marker)
      // If it's a new item at baseIndent, it's the next item at same level - stop looking
      // For nested items, continue looking for blank lines after the nested list
      if (firstIsNewItem) {
        if (firstIndent <= baseIndent) {
          // Same level or higher - stop looking
          break
        }
        // Nested list - continue looking (don't break)
      }
      firstCheckPos = skipToNextLine(source, firstNextLineEnd)
    }
  }

  // Handle fenced code blocks that span multiple lines
  // Note: We use manual expansion here rather than parseCodeFenced because
  // we need to return a content string (with fence lines) that will be parsed later,
  // not an AST node. parseCodeFenced returns an AST node, which doesn't fit this use case.
  var actualFirstItemContent = firstItemContent
  if (
    util.startsWith(firstItemContent, '```') ||
    util.startsWith(firstItemContent, '~~~')
  ) {
    var markerWidth = ordered
      ? match[1].length + match[2].length + 1
      : match[1].length + 1
    var expandedResult = expandMultilineFencedCodeBlock(
      source,
      firstItemContent,
      currentPos,
      markerWidth
    )
    actualFirstItemContent = expandedResult.content
    currentPos = expandedResult.endPos
  }

  // For tight lists with whitespace-only first line, combine with continuation to avoid multiple blocks
  var hasWhitespaceButNoContent =
    !isEmptyItem &&
    firstItemContent.trim() === '' &&
    spacesAfterMarkerCount > 0 &&
    spacesAfterMarkerCount < 5
  // For ALL tight lists (no blank lines), concatenate simple text continuation lines BEFORE
  // building the item content. This is necessary to preserve hard line breaks (two trailing
  // spaces before newline) that would otherwise be lost when first line and continuation are
  // parsed separately. The broader condition (not just whitespace-only first lines) is safe
  // because we stop collecting text when we hit NEW block elements (not continuations of the
  // same block element), which ensures block-level structures are still parsed correctly.
  if (!firstItemHasBlankLine) {
    // Detect if the first line starts a blockquote (to allow continuation lines)
    var firstLineFirstChar =
      actualFirstItemContent.length > 0 ? actualFirstItemContent[0] : ''
    var firstLineStartsBlockQuote = firstLineFirstChar === '>'

    var pos = currentPos
    while (pos < source.length) {
      var lineEnd = util.findLineEnd(source, pos)
      var line = source.slice(pos, lineEnd)
      if (line.trim() === '') break
      var indentInfo = calculateIndent(source, pos, lineEnd)
      if (indentInfo.spaceEquivalent < minimumContentStartColumn) break
      var lineWithoutIndent = line.slice(indentInfo.charCount)
      if (
        indentInfo.spaceEquivalent <= baseIndent &&
        isMatchingListItem(
          lineWithoutIndent,
          indentInfo,
          ordered,
          marker,
          delimiter,
          baseIndent,
          listItemRegex
        )
      ) {
        break
      }
      // Check for nested list items
      if (
        isLineListItem(lineWithoutIndent) &&
        indentInfo.spaceEquivalent > baseIndent
      ) {
        break
      }
      // Check for block elements - stop collecting text if we hit a NEW block element
      // (not a continuation of the same block element started on the first line)
      var firstChar = lineWithoutIndent.length > 0 ? lineWithoutIndent[0] : ''
      // Allow blockquote continuation if first line started a blockquote
      var isBlockQuoteContinuation =
        firstChar === '>' && firstLineStartsBlockQuote
      if (
        (firstChar === '>' && !isBlockQuoteContinuation) ||
        firstChar === '#' ||
        util.startsWith(lineWithoutIndent, '```') ||
        util.startsWith(lineWithoutIndent, '~~~')
      ) {
        break
      }
      actualFirstItemContent += '\n' + lineWithoutIndent
      currentPos = pos = skipToNextLine(source, lineEnd)
    }
  }

  // Build first item with GFM task support
  items.push(
    buildListItemContent(
      actualFirstItemContent,
      firstItemHasBlankLine,
      state,
      options
    )
  )
  itemContentStartColumns.push(contentStartColumn)

  // Process continuation lines for the first item
  // For tight lists (no blank lines), also process continuation if it's indented enough
  const shouldProcessContinuation =
    firstItemHasBlankLine &&
    (spacesAfterMarkerCount >= 5 || hasWhitespaceButNoContent)
  if (shouldProcessContinuation) {
    const lastItem = getLastItem()
    currentPos = processContinuation(
      source,
      lastItem,
      minimumContentStartColumn,
      currentPos,
      baseIndent,
      ordered,
      marker,
      delimiter,
      listItemRegex,
      state,
      options,
      true
    )
  } else if (!firstItemHasBlankLine) {
    // For tight lists (no blank lines), process continuation lines
    const continuationColumn = minimumContentStartColumn - 1
    while (currentPos < source.length) {
      const nextLineEnd = util.findLineEnd(source, currentPos)
      const nextLine = source.slice(currentPos, nextLineEnd)
      const nextIndentInfo = calculateIndent(source, currentPos, nextLineEnd)
      const nextIndent = nextIndentInfo.spaceEquivalent
      const nextLineWithoutIndent = nextLine.slice(nextIndentInfo.charCount)

      if (
        nextLine.trim() === '' ||
        (nextIndent <= baseIndent &&
          isMatchingListItem(
            nextLineWithoutIndent,
            nextIndentInfo,
            ordered,
            marker,
            delimiter,
            baseIndent,
            listItemRegex
          )) ||
        (isLineListItem(nextLineWithoutIndent) && nextIndent > baseIndent) ||
        nextIndent < continuationColumn
      ) {
        break
      }

      const lastItem = getLastItem()
      const result = processListContinuationLine(
        source,
        currentPos,
        nextLineEnd,
        nextIndentInfo,
        continuationColumn,
        contentStartColumn,
        lastItem,
        false,
        state,
        options,
        true,
        baseIndent
      )
      if (result.processed) {
        currentPos = result.newPos
      } else {
        break
      }
    }
  }

  // Continue parsing subsequent list items
  var prevLineWasBlank = false
  while (currentPos < source.length) {
    const nextLineEnd = util.findLineEnd(source, currentPos)

    const nextLine = source.slice(currentPos, nextLineEnd)
    const nextIndentInfo = calculateIndent(source, currentPos, nextLineEnd)
    const nextIndentChars = nextIndentInfo.charCount
    const nextIndent = nextIndentInfo.spaceEquivalent

    if (nextLine.trim() === '') {
      // Blank line - mark as loose list and continue
      hasBlankLines = true
      prevLineWasBlank = true
      currentPos = skipToNextLine(source, nextLineEnd)
    } else if (nextIndent < baseIndent) {
      const nextLineWithoutIndent = nextLine.slice(nextIndentChars)
      if (
        nextLineWithoutIndent.startsWith('<') &&
        checkHTMLTagInterruptsList(
          source,
          currentPos,
          nextIndentChars,
          baseIndent,
          nextIndent,
          options
        )
      ) {
        break
      }

      // Less indented - check if this is a lazy continuation line
      // Per CommonMark: lazy continuation lines can have all indentation deleted
      // They are still part of the list item if they are paragraph continuation text
      const trimmed = nextLineWithoutIndent.trim()
      if (
        trimmed.length > 0 &&
        items.length > 0 &&
        !isBlockStartChar(trimmed[0]) &&
        !isMatchingListItem(
          nextLineWithoutIndent,
          nextIndentInfo,
          ordered,
          marker,
          delimiter,
          baseIndent,
          listItemRegex
        )
      ) {
        const lastItem = getLastItem()
        if (lastItem.length > 0) {
          const lastBlock = lastItem[lastItem.length - 1]
          if (
            !prevLineWasBlank &&
            (lastBlock.type === RuleType.paragraph ||
              lastBlock.type === RuleType.text)
          ) {
            // This is a lazy continuation line - continue the paragraph
            // Per CommonMark: lazy continuation only applies when there's no blank line
            appendListContinuation(
              nextLineWithoutIndent,
              lastItem,
              state,
              options
            )
            prevLineWasBlank = false
            currentPos = skipToNextLine(source, nextLineEnd)
            continue
          }
        }
      }
      // Not a lazy continuation - end of list
      break
    } else {
      const nextLineWithoutIndent = nextLine.slice(nextIndentChars)

      // Check for setext heading BEFORE thematic break
      // If last item ends with text/paragraph and this line is setext underline, convert to heading
      // Per CommonMark: setext underline must be indented enough to be continuation
      // BUT: don't check if this line is a list item marker (would be continuation of wrong item)
      if (items.length > 0) {
        const lastItemContentStartColumn =
          itemContentStartColumns[items.length - 1] || contentStartColumn
        if (
          nextIndent + 1 >= lastItemContentStartColumn &&
          !isMatchingListItem(
            nextLineWithoutIndent,
            nextIndentInfo,
            ordered,
            marker,
            delimiter,
            baseIndent,
            listItemRegex
          )
        ) {
          const lastItem = getLastItem()
          if (
            lastItem.length > 0 &&
            convertSetextHeadingInListItem(
              lastItem,
              nextLineWithoutIndent,
              options
            )
          ) {
            currentPos = skipToNextLine(source, nextLineEnd)
            continue
          }
        }
      }

      // Check if this line is a thematic break (per CommonMark, thematic breaks end lists)
      const thematicBreakResult = parseBreakThematic(
        source,
        currentPos,
        state,
        options
      )
      if (thematicBreakResult) {
        // Thematic break ends the list
        break
      }

      // Per CommonMark spec: link reference definitions interrupt list continuation
      // Check if this is a link reference definition after a blank line
      if (prevLineWasBlank) {
        const refEndPos = skipLinkReferenceDefinition(
          source,
          currentPos,
          nextLineEnd,
          nextIndentInfo,
          nextLineWithoutIndent,
          state,
          options
        )
        if (refEndPos) {
          // Skip link reference definition and continue parsing list (don't break)
          currentPos = refEndPos
          prevLineWasBlank = false
          continue
        }
      }

      // If line is at base indentation and not a list item, check for lazy continuation first
      if (nextIndent <= baseIndent) {
        if (
          nextLineWithoutIndent.startsWith('<') &&
          checkHTMLTagInterruptsList(
            source,
            currentPos,
            nextIndentChars,
            baseIndent,
            nextIndent,
            options
          )
        ) {
          break
        }

        if (
          !isMatchingListItem(
            nextLineWithoutIndent,
            nextIndentInfo,
            ordered,
            marker,
            delimiter,
            baseIndent,
            listItemRegex
          )
        ) {
          // Check for lazy continuation when nextIndent === baseIndent
          // Per CommonMark: lazy continuation lines can have all indentation deleted
          // BUT: only if there was no blank line before (lazy continuation requires no blank line)
          // AND: only if it's truly paragraph continuation text (not a block start)
          if (nextIndent === baseIndent && !prevLineWasBlank) {
            const trimmed = nextLineWithoutIndent.trim()
            if (trimmed.length > 0 && !isBlockStartChar(trimmed[0])) {
              // Check if this line would start a block (like HTML comment, thematic break, etc.)
              // If so, it should break the list, not continue it
              const blockResult = parseBlock(source, currentPos, state, options)
              if (blockResult && blockResult.type !== RuleType.paragraph) {
                break
              }
              const lastItem = getLastItem()
              if (lastItem.length > 0 && !listItemHasBlockContent(lastItem)) {
                // This is a lazy continuation line - continue the inline content
                // Lazy continuation lines don't add a newline (no space in output)
                appendListContinuation(
                  nextLineWithoutIndent,
                  lastItem,
                  state,
                  options,
                  false
                )
                prevLineWasBlank = false
                currentPos = skipToNextLine(source, nextLineEnd)
                continue
              }
            }
          }
          break
        }
      }

      // Check for empty items with blank lines
      if (
        shouldBreakForEmptyItem(
          items,
          isEmptyItem,
          prevLineWasBlank,
          firstItemContent
        )
      )
        break

      const nextMatchResult = matchListItem(nextLineWithoutIndent)
      const nextMatch = nextMatchResult ? nextMatchResult.match : null
      const isSameType =
        nextMatch &&
        (ordered ? nextMatch[2] === delimiter : nextMatch[1] === marker)
      // Per CommonMark: list markers may be indented by up to 3 spaces
      // If marker is too indented (> 3 spaces), it's not a valid list item
      // If there's a blank line before such a marker, end the list (e.g., Example 313)
      if (isSameType && nextIndent > 3 && prevLineWasBlank) {
        break
      }
      // Skip list item processing and fall through to continuation check
      if (isSameType && nextIndent <= baseIndent + 3) {
        if (nextIndent >= 4 && prevLineWasBlank) break
        if (nextIndent === baseIndent) {
          // Item at same level - parse as new item
          let itemContent = ordered ? nextMatch[3] : nextMatch[2]
          itemContent = itemContent.trimStart()

          const result = addListItem(
            source,
            items,
            itemContentStartColumns,
            itemContent,
            currentPos,
            nextLineEnd,
            nextIndent,
            nextIndentChars,
            nextMatch,
            ordered,
            hasBlankLines,
            state,
            options
          )
          currentPos = result.newCurrentPos
          prevLineWasBlank = false

          // For empty items, process continuation immediately
          if (itemContent.trim() === '') {
            const newItem = items[items.length - 1]
            const thisItemContentStartColumn = getLastItemContentColumn()
            currentPos = processContinuation(
              source,
              newItem,
              thisItemContentStartColumn,
              currentPos,
              baseIndent,
              ordered,
              marker,
              delimiter,
              listItemRegex,
              state,
              options
            )
          }

          continue
        }
        if (nextIndent > baseIndent) {
          // Per CommonMark spec: items are only nested if indented enough to belong to previous item
          // If there was a blank line before this item, it's at the same level (not nested)
          if (prevLineWasBlank) {
            // Blank line before item means it's a new item at same level, not nested
            let itemContent = ordered ? nextMatch[3] : nextMatch[2]
            // Trim leading whitespace from content (regex now captures optional whitespace)
            itemContent = itemContent.trimStart()
            const result = addListItem(
              source,
              items,
              itemContentStartColumns,
              itemContent,
              currentPos,
              nextLineEnd,
              nextIndent,
              nextIndentChars,
              nextMatch,
              ordered,
              hasBlankLines,
              state,
              options
            )
            currentPos = result.newCurrentPos
            prevLineWasBlank = false
            continue
          }
          // Check if this item's marker position is indented enough to be continuation of previous item
          // We need to calculate the previous item's contentStartColumn, not use the first item's
          const lastItem = getLastItem()
          const markerColumn = nextIndent + 1
          const isNested = isMarkerNested(
            markerColumn,
            getLastItemContentColumn(),
            listItemHasBlockContent(lastItem)
          )

          if (isNested) {
            const nestedResult = tryParseNestedList(currentPos, lastItem)
            if (nestedResult) {
              currentPos = nestedResult.endPos
              prevLineWasBlank = false
              continue
            }
          }
          // Item is not indented enough to be nested - check if it's same type for same level
          if (!isNested && isSameType) {
            // This item has more indentation than baseIndent but not enough to be nested
            // It's still at the same level - parse it as a new item
            let itemContent = ordered ? nextMatch[3] : nextMatch[2]
            // Trim leading whitespace from content
            itemContent = itemContent.trimStart()
            if (!hasBlankLines) {
              // Check if this item has blank lines within it
              let checkItemPos = skipToNextLine(source, nextLineEnd)
              while (checkItemPos < source.length) {
                const checkLineEnd = util.findLineEnd(source, checkItemPos)
                const checkLine = source.slice(checkItemPos, checkLineEnd)
                const checkIndentInfo = calculateIndent(
                  source,
                  checkItemPos,
                  checkLineEnd
                )
                const checkIndent = checkIndentInfo.spaceEquivalent

                if (checkLine.trim() === '') {
                  const afterBlank = skipToNextLine(source, checkLineEnd)
                  if (afterBlank < source.length) {
                    const afterBlankIndentInfo = calculateIndent(
                      source,
                      afterBlank,
                      source.length
                    )
                    const afterBlankIndent =
                      afterBlankIndentInfo.spaceEquivalent
                    // Calculate contentStartColumn for this item
                    const thisItemMarkerStart = nextIndent
                    const thisItemContentStart =
                      thisItemMarkerStart +
                      (ordered
                        ? nextMatch[1].length + nextMatch[2].length + 1
                        : nextMatch[1].length + 1)
                    if (afterBlankIndent + 1 > thisItemContentStart) {
                      break
                    }
                  }
                  break
                } else if (checkIndent <= baseIndent) {
                  // Check if this is the next list item at baseIndent or less
                  const checkLineWithoutIndent = checkLine.slice(
                    checkIndentInfo.charCount
                  )
                  const checkMatch = checkLineWithoutIndent.match(listItemRegex)
                  const isNextItem =
                    checkMatch &&
                    (ordered
                      ? checkMatch[2] === delimiter
                      : checkMatch[1] === marker)
                  if (isNextItem && checkIndent <= baseIndent) {
                    break
                  }
                }
                checkItemPos = skipToNextLine(source, checkLineEnd)
              }
            }
            const result = addListItem(
              source,
              items,
              itemContentStartColumns,
              itemContent,
              currentPos,
              nextLineEnd,
              nextIndent,
              nextIndentChars,
              nextMatch,
              ordered,
              hasBlankLines,
              state,
              options
            )
            currentPos = result.newCurrentPos
            prevLineWasBlank = false
            continue
          } else if (!isNested && !isSameType) {
            // Different marker type at same level - end this list
            break
          }
          // Fall through to continuation check if isNested but parseList failed
          // Check if this is continuation content
          // Per CommonMark: continuation needs to be indented to at least the content start column
          // nextIndent is space count (0-indexed), contentStartColumn is column number (1-indexed)
          // When list item has block content, exact indentation (==) continues; otherwise use >
          // For continuation checks, use minimumContentStartColumn (column after marker+space)
          // instead of contentStartColumn (which can be higher for code blocks)
          {
            const lastItem = getLastItem()
            // Check if last item is empty (no content)
            const lastItemIsEmpty = lastItem.length === 0
            // Check for empty items with blank lines
            if (
              lastItemIsEmpty &&
              shouldBreakForEmptyItem(
                items,
                isEmptyItem,
                prevLineWasBlank,
                firstItemContent
              )
            )
              break

            const hasBlockContent = lastItem.some(
              node =>
                node.type === RuleType.codeBlock ||
                node.type === RuleType.paragraph ||
                node.type === RuleType.blockQuote ||
                node.type === RuleType.orderedList ||
                node.type === RuleType.unorderedList ||
                node.type === RuleType.heading
            )
            // For empty items, use minimumContentStartColumn (marker + space) instead of contentStartColumn
            // which can be higher when there's extra whitespace but no content
            const continuationColumn =
              lastItemIsEmpty && items.length === 1
                ? minimumContentStartColumn
                : contentStartColumn
            const continuationCheck = hasBlockContent
              ? nextIndent >= continuationColumn
              : nextIndent > continuationColumn
            if (continuationCheck) {
              const result = processListContinuationLine(
                source,
                currentPos,
                nextLineEnd,
                nextIndentInfo,
                continuationColumn,
                contentStartColumn,
                getLastItem(),
                prevLineWasBlank,
                state,
                options,
                undefined,
                baseIndent
              )
              if (result.processed) {
                prevLineWasBlank = result.wasBlank
                currentPos = result.newPos
                continue
              }
            } else {
              break
            }
          }
        } else if (nextIndent === baseIndent) {
          // Check for Unicode whitespace after marker in unordered lists
          if (
            !ordered &&
            nextMatch &&
            checkUnicodeWhitespaceAfterMarker(nextMatch, nextMatch[1])
          ) {
            break
          }
          let itemContent = ordered ? nextMatch[3] : nextMatch[2]
          // Trim leading whitespace from content (regex now captures optional whitespace)
          itemContent = itemContent.trimStart()
          // Per CommonMark: A list is loose if items are separated by blank lines,
          // OR if an item directly contains two block-level elements with a blank line between them.
          // If list is loose (hasBlankLines = true), ALL items are wrapped.
          // Otherwise, an item is wrapped only if it has blank lines within it.
          // A blank line before this item means the PREVIOUS item was separated from this one,
          // making the list loose. For this item, we check if it has continuation after blank lines.
          // But if the list is already loose (hasBlankLines), wrap this item too.
          const result = addListItem(
            source,
            items,
            itemContentStartColumns,
            itemContent,
            currentPos,
            nextLineEnd,
            baseIndent,
            nextIndentChars,
            nextMatch,
            ordered,
            hasBlankLines,
            state,
            options
          )
          currentPos = result.newCurrentPos
          prevLineWasBlank = false
        }
      } else if (nextIndent > baseIndent) {
        // Check if this is a list item - if so, check if it should be nested or separate
        // Per CommonMark: list item markers can only be indented 0-3 spaces relative to baseIndent
        // However, nested lists can have more indentation if they're indented relative to content start
        // So we need to try parsing as nested list first, then check for paragraph continuation
        const lastItem = getLastItem()
        const isListItemResult = isLineListItem(nextLineWithoutIndent)
        if (isListItemResult) {
          // Check if marker would be properly nested (relative to content start column)
          // This handles nested lists that may have > 3 spaces indent from baseIndent
          const markerColumn = nextIndent + 1
          const isNested = isMarkerNested(
            markerColumn,
            getLastItemContentColumn(),
            listItemHasBlockContent(lastItem)
          )

          if (isNested) {
            // Properly nested - try parsing as nested list
            const nestedResult = tryParseNestedList(currentPos, lastItem)
            if (nestedResult) {
              currentPos = nestedResult.endPos
              prevLineWasBlank = false
              continue
            }
          }

          // Not properly nested - check if marker indent is valid (0-3 spaces relative to baseIndent)
          // Per CommonMark: list item markers can only be indented 0-3 spaces relative to baseIndent
          const markerIndentRelative = nextIndent - baseIndent
          if (markerIndentRelative > 3) {
            // Too much indentation (> 3 spaces from baseIndent) and not nested - not a valid list item marker
            // Check if it should be treated as paragraph continuation (if last item ends with paragraph)
            const lastBlock =
              lastItem.length > 0 ? lastItem[lastItem.length - 1] : null
            if (
              lastBlock &&
              (lastBlock.type === RuleType.paragraph ||
                lastBlock.type === RuleType.text)
            ) {
              // This is paragraph continuation text, not a code block or nested list
              appendListContinuation(
                nextLineWithoutIndent,
                lastItem,
                state,
                options
              )
              prevLineWasBlank = false
              currentPos = skipToNextLine(source, nextLineEnd)
              continue
            }
            // Not paragraph continuation - fall through to code block check
          } else {
            // Valid marker indent (0-3 spaces) but not nested - this should be a separate list
            break
          }
        } else {
          // Not a list item - try parsing as nested list (for other block types)
          const nestedResult = tryParseNestedList(currentPos, lastItem)
          if (nestedResult) {
            currentPos = nestedResult.endPos
            prevLineWasBlank = false
            continue
          }
        }
        // Check if this is continuation content
        // Per CommonMark: continuation needs to be indented to at least the content start column
        // nextIndent is space count (0-indexed), contentStartColumn is column number (1-indexed)
        // When list item has block content, exact indentation (==) continues; otherwise use >
        // For continuation checks, use minimumContentStartColumn (column after marker+space)
        // instead of contentStartColumn (which can be higher for code blocks)
        const continuationColumn = contentStartColumn
        const continuationCheck = listItemHasBlockContent(lastItem)
          ? nextIndent >= continuationColumn - 1
          : nextIndent > continuationColumn - 1
        if (continuationCheck) {
          const result = processListContinuationLine(
            source,
            currentPos,
            nextLineEnd,
            nextIndentInfo,
            continuationColumn - 1,
            contentStartColumn,
            getLastItem(),
            prevLineWasBlank,
            state,
            options,
            undefined,
            baseIndent
          )
          if (result.processed) {
            prevLineWasBlank = result.wasBlank
            currentPos = result.newPos
            continue
          }
        } else {
          break
        }
      } else {
        break
      }
    }
  }

  // For loose lists, ensure all items have paragraph wrappers
  // The first item may have been created before we detected that the list is loose
  if (
    hasBlankLines &&
    items.length > 1 &&
    items[0].length > 0 &&
    items[0][0].type !== RuleType.paragraph
  ) {
    // Check if list is truly loose (another item has paragraph wrapper)
    for (var j = 1; j < items.length; j++) {
      if (items[j].length > 0 && items[j][0].type === RuleType.paragraph) {
        // First item is all inline content - wrap it for loose lists
        var isBlock = false
        for (var i = 0; i < items[0].length; i++) {
          var t = items[0][i].type
          if (
            t === RuleType.codeBlock ||
            t === RuleType.heading ||
            t === RuleType.blockQuote ||
            t === RuleType.orderedList ||
            t === RuleType.unorderedList ||
            t === RuleType.htmlBlock ||
            t === RuleType.breakThematic
          ) {
            isBlock = true
            break
          }
        }
        if (!isBlock) {
          items[0] = [
            {
              type: RuleType.paragraph,
              children: items[0],
            } as MarkdownToJSX.ParagraphNode,
          ]
        }
        break
      }
    }
  }

  const listNode = ordered
    ? ({
        type: RuleType.orderedList,
        items,
        ordered: true,
        start,
      } as MarkdownToJSX.OrderedListNode)
    : ({
        type: RuleType.unorderedList,
        items,
        ordered: false,
      } as MarkdownToJSX.UnorderedListNode)

  // Restore original inList state
  state.inList = originalInList

  // Track hit at logical end of parser
  trackBlockHit('list')

  return {
    ...listNode,
    endPos: currentPos,
  } as (MarkdownToJSX.OrderedListNode | MarkdownToJSX.UnorderedListNode) & {
    endPos: number
  }
}

function parseTable(
  source: string,
  pos: number,
  state: MarkdownToJSX.State,
  options: ParseOptions
): ParseResult {
  debug('parse', 'table', state)
  if (state.inline) return null

  trackBlockAttempt('table')

  const lines: string[] = []
  let currentPos = pos

  while (currentPos < source.length) {
    const lineEnd = util.findLineEnd(source, currentPos)
    if (isBlankLineCheck(source, currentPos, lineEnd)) break

    const line = source.slice(currentPos, lineEnd).trim()
    const isTableLine =
      line.indexOf('|') !== -1 ||
      (lines.length >= 3 && line && !isBlockStartChar(line[0]))

    if (!isTableLine) break
    lines.push(line)
    currentPos = skipToNextLine(source, lineEnd)
  }

  if (lines.length < 2) return null

  // Unwrap pipes and split cells
  const unwrap = (line: string) =>
    line[0] === '|' && line[line.length - 1] === '|' ? line.slice(1, -1) : line

  const splitCells = (line: string) => {
    const cells: string[] = []
    let current = ''
    let inCode = false

    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '\\' && i + 1 < line.length && line[i + 1] === '|') {
        current += '|'
        i++
      } else if (ch === '`') {
        inCode = !inCode
        current += ch
      } else if (ch === '|' && !inCode) {
        cells.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    cells.push(current.trim())
    return cells
  }

  const headerCells = splitCells(unwrap(lines[0]))
  if (!headerCells.length) return null

  const separatorCells = splitCells(unwrap(lines[1]))
  if (
    separatorCells.length !== headerCells.length ||
    separatorCells.some(cell => !/^:?-+:?$/.test(cell))
  ) {
    return null
  }

  const alignments = separatorCells.map(cell => {
    const start = cell[0] === ':'
    const end = cell[cell.length - 1] === ':'
    return start && end ? 'center' : start ? 'left' : end ? 'right' : null
  })

  const parseRow = (cells: string[]) =>
    parseWithInlineMode(state, true, () =>
      cells.map(cell => parseInlineSpan(cell, 0, cell.length, state, options))
    )

  const header = parseRow(headerCells)

  const body = lines.slice(2).map(line => {
    const cells =
      line.indexOf('|') !== -1 ? splitCells(unwrap(line)) : [line.trim()]

    // Normalize cell count
    const count = headerCells.length
    while (cells.length < count) cells.push('')
    cells.length = count

    return parseRow(cells)
  })

  trackBlockHit('table')
  return {
    type: RuleType.table,
    header,
    cells: body,
    align: alignments,
    endPos: currentPos,
  } as MarkdownToJSX.TableNode & { endPos: number }
}

// Type 6 block-level tags - only the most common ones that matter in practice
// Unknown tags default to type 7 (inline/non-interrupting) for safety
// This is a pragmatic subset of the CommonMark spec's full list
var TYPE6_TAGS = [
  'div',
  'p',
  'section',
  'article',
  'aside',
  'nav',
  'header',
  'footer',
  'main',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'ul',
  'ol',
  'li',
  'dl',
  'dt',
  'dd',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'td',
  'th',
  'form',
  'fieldset',
  'hr',
  'pre',
  'details',
  'summary',
  'figure',
  'figcaption',
]

// Type 1 block tags for fast lookup
const TYPE1_TAGS_SET = new Set(['pre', 'script', 'style', 'textarea'])

function isType6Tag(tagName: string): boolean {
  return TYPE6_TAGS.indexOf(tagName.toLowerCase()) !== -1
}

export function isType1Block(tagLower: string): boolean {
  return TYPE1_TAGS_SET.has(tagLower)
}

function isBlankLineCheck(
  source: string,
  lineStart: number,
  lineEnd: number
): boolean {
  for (var i = lineStart; i < lineEnd; i++) {
    const code = charCode(source, i)
    if (code !== $.CHAR_SPACE && code !== $.CHAR_TAB && code !== $.CHAR_CR)
      return false
  }
  return true
}

function parseWithInlineMode<T>(
  state: MarkdownToJSX.State,
  inlineMode: boolean,
  parseFn: () => T
): T {
  const originalInline = state.inline
  state.inline = inlineMode
  try {
    return parseFn()
  } finally {
    state.inline = originalInline
  }
}

function findNextBlankLine(
  source: string,
  startPos: number,
  sourceLen: number
): number {
  var pos = startPos
  while (pos < sourceLen) {
    var nextLineEnd = util.findLineEnd(source, pos)
    if (isBlankLineCheck(source, pos, nextLineEnd)) return pos
    pos = skipToNextLine(source, nextLineEnd)
  }
  return sourceLen
}

function createHTMLCommentResult(
  text: string,
  endPos: number,
  options?: { raw?: boolean; endsWithGreaterThan?: boolean }
): MarkdownToJSX.HTMLCommentNode & {
  endPos: number
  raw?: boolean
  endsWithGreaterThan?: boolean
} {
  return {
    type: RuleType.htmlComment,
    text: util.normalizeInput(text),
    endPos,
    ...options,
  } as MarkdownToJSX.HTMLCommentNode & {
    endPos: number
    raw?: boolean
    endsWithGreaterThan?: boolean
  }
}

function createVerbatimHTMLBlock(
  tagName: string,
  text: string,
  endPos: number,
  attrs?: { [key: string]: any },
  rawAttrs?: string,
  isClosingTag?: boolean,
  canInterruptParagraph?: boolean,
  options?: ParseOptions,
  state?: MarkdownToJSX.State
): MarkdownToJSX.HTMLNode & {
  endPos: number
  isClosingTag?: boolean
  canInterruptParagraph?: boolean
} {
  var normalizedText = util.normalizeInput(text)
  // Detect empty unclosed HTML tags when forceBlock is used to avoid infinite recursion
  // For empty unclosed tags like <var>, the text field contains the opening tag itself
  // When forceBlock is used, this would cause recursion if the tag is parsed again
  var finalText = normalizedText
  if (options && options.forceBlock && text && !isClosingTag) {
    var openingTagPattern = new RegExp(
      '^<' + tagName.toLowerCase() + '(\\s[^>]*)?>$',
      'i'
    )
    if (openingTagPattern.test(text.trim())) {
      // Empty unclosed tag detected - render as empty element to avoid recursion
      finalText = ''
    }
  }

  // Always parse content into children, even for verbatim blocks
  // Extract content from text (may include opening tag)
  var contentToParse = finalText
  var tagLower = tagName.toLowerCase()

  // If text starts with opening tag, extract just the content
  var openingTagPattern2 = new RegExp('^<' + tagLower + '[\\s>]', 'i')
  if (openingTagPattern2.test(contentToParse)) {
    // Find the end of opening tag
    var tagEnd = contentToParse.indexOf('>')
    if (tagEnd !== -1) {
      contentToParse = contentToParse.slice(tagEnd + 1)
      // Remove closing tag if present
      var closingTag = '</' + tagLower + '>'
      var closingIdx = contentToParse.indexOf(closingTag)
      if (closingIdx !== -1) {
        contentToParse = contentToParse.slice(0, closingIdx)
      }
    }
  } else {
    // Text might just be content, but check for closing tag
    var closingTag2 = '</' + tagLower + '>'
    var closingIdx2 = contentToParse.indexOf(closingTag2)
    if (closingIdx2 !== -1) {
      contentToParse = contentToParse.slice(0, closingIdx2)
    }
  }

  // Parse content into children
  var children: MarkdownToJSX.ASTNode[] = []
  if (contentToParse && options) {
    var parseState: MarkdownToJSX.State = state || {
      inline: false,
      inHTML: true,
      inAnchor: false,
    }

    // Determine if content should be parsed as blocks or inline
    var trimmed = contentToParse.trim()
    var hasDoubleNewline = DOUBLE_NEWLINE_R.test(trimmed)
    var hasBlockSyntax = BLOCK_SYNTAX_R.test(trimmed)
    var hasHTMLTags = HTML_BLOCK_ELEMENT_START_R.test(trimmed)

    if (hasDoubleNewline || hasBlockSyntax || hasHTMLTags) {
      // Parse as blocks
      var blockState = {
        ...parseState,
        inline: false,
        inHTML: true,
        inAnchor: parseState.inAnchor || tagLower === 'a',
      }
      children = parseBlocksInHTML(trimmed, blockState, options)
    } else if (trimmed) {
      // Parse as inline
      var inlineState = {
        ...parseState,
        inline: true,
        inAnchor: parseState.inAnchor || tagLower === 'a',
      }
      children = parseInlineSpan(
        trimmed,
        0,
        trimmed.length,
        inlineState,
        options
      )
    }
  }

  return {
    type: RuleType.htmlBlock,
    tag: tagName as MarkdownToJSX.HTMLTags,
    attrs: attrs || {},
    rawAttrs: rawAttrs,
    children: children,
    rawText: finalText,
    text: finalText, // @deprecated - use rawText instead
    verbatim: true,
    isClosingTag: isClosingTag,
    canInterruptParagraph: canInterruptParagraph,
    endPos: endPos,
  } as MarkdownToJSX.HTMLNode & {
    endPos: number
    isClosingTag?: boolean
    canInterruptParagraph?: boolean
  }
}

/**
 * Check if content contains block-worthy elements that should be parsed
 * (explicit block syntax or blank lines not inside type 1 HTML blocks)
 */
function hasBlockContent(content: string): boolean {
  const hasExplicitBlockSyntax = BLOCK_SYNTAX_R.test(content)
  const hasBlankLines = DOUBLE_NEWLINE_R.test(content)
  const hasType1Tags = TYPE1_TAG_R.test(content)
  return hasExplicitBlockSyntax || (hasBlankLines && !hasType1Tags)
}

function processHTMLBlock(
  tagNameOriginal: string,
  tagName: string,
  attrs: string,
  content: string,
  fullMatch: string,
  endPos: number,
  source: string,
  state: MarkdownToJSX.State,
  parentInAnchor: boolean,
  options: ParseOptions
): MarkdownToJSX.HTMLNode & { endPos: number } {
  // Apply block-level paragraph wrapping heuristics
  if (!state.inHTML && !state.inline && !util.endsWith(fullMatch, '\n')) {
    let checkPos = endPos
    const sourceLen = source.length

    while (checkPos < sourceLen) {
      const lineEnd = util.findLineEnd(source, checkPos)
      if (isBlankLineCheck(source, checkPos, lineEnd)) break

      const line = source.slice(checkPos, lineEnd).trim()
      if (line.length > 0 && isBlockStartChar(line[0])) {
        const htmlResult = parseHTML(source, checkPos, state, options)
        if (htmlResult) {
          checkPos = htmlResult.endPos
          continue
        }
        const selfClosingMatch = parseHTMLTag(source, checkPos)
        if (selfClosingMatch) {
          checkPos = selfClosingMatch.endPos
          continue
        }
        return null
      }
      checkPos = skipToNextLine(source, lineEnd)
    }
  }

  const lowerTag = tagName
  const isType1BlockTag = isType1Block(lowerTag)

  // Per CommonMark spec: Type 6 blocks that end at blank lines should have verbatim content
  // Check if this is a type 6 block (block-level, not type 1, not void)
  var isType6Block = !isType1BlockTag && !util.isVoidElement(tagName)

  // Always extract raw attributes from fullMatch if available (for consistency)
  // Per CommonMark spec Example 153: newlines and spaces between attributes should be removed
  // (not converted to spaces) when rendering. Extract raw attributes so html() can handle this.
  var rawOpeningTag: string | undefined = undefined
  // Extract raw attributes from opening tag slice if fullMatch is available
  if (fullMatch) {
    // Find the closing > of the opening tag
    var openingTagEnd = fullMatch.indexOf('>')
    if (openingTagEnd !== -1) {
      var openingTagSlice = fullMatch.slice(0, openingTagEnd + 1)
      // Check if opening tag has newlines (for rawOpeningTag preservation)
      if (openingTagSlice.indexOf('\n') !== -1) {
        rawOpeningTag = openingTagSlice
      }
      // Always extract raw attributes from the opening tag slice for consistency
      // Find the tag name end (after <div or <div/) - first whitespace or >
      var tagNameEnd = openingTagEnd
      for (var i = 1; i < openingTagEnd; i++) {
        var ch = openingTagSlice[i]
        if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '>') {
          tagNameEnd = i
          break
        }
      }
      // Extract attributes from after tag name to before >
      // Preserve leading whitespace for CommonMark compliance (Examples 615-616)
      attrs = openingTagSlice.slice(tagNameEnd, openingTagEnd)
    }
  }

  // Parse attributes, but always preserve raw attributes for consistency
  // Per CommonMark spec Example 153: newlines and spaces between attributes should be removed
  // (not converted to spaces) when rendering. Store raw attributes so html() can handle this.
  // Trim leading whitespace for parsing, but preserve full attrs (with whitespace) for rawAttrs
  var attrsTrimmed = attrs.replace(/^[\s\n\r\t]+/, '')
  var parsedAttributes = parseHTMLAttributes(
    attrsTrimmed,
    tagName,
    tagNameOriginal,
    options
  )
  var attributes: Record<string, any> = {
    ...parsedAttributes,
  }

  // For type 6 blocks, check if content ends with blank line or if there's no closing tag
  // Both cases mean content should be verbatim
  var endedAtBlankLine = false
  var hasClosingTagWithBlockSyntax = false
  if (isType6Block && content.length > 0) {
    // Check if there's a closing tag in the content - if so, extract content before it
    var closingTagPattern = '</' + lowerTag
    var closingTagIdx = content.indexOf(closingTagPattern)
    if (closingTagIdx >= 0) {
      var afterTag = closingTagIdx + closingTagPattern.length
      while (
        afterTag < content.length &&
        (content[afterTag] === ' ' || content[afterTag] === '\t')
      )
        afterTag++
      if (afterTag < content.length && content[afterTag] === '>') {
        var contentBeforeClosingTag = content.slice(0, closingTagIdx)
        if (hasBlockContent(contentBeforeClosingTag)) {
          content = contentBeforeClosingTag
          hasClosingTagWithBlockSyntax = true
        } else {
          endedAtBlankLine = true
        }
      }
    }

    // If we didn't find a proper closing tag with block syntax, check if content ends with blank lines
    if (!hasClosingTagWithBlockSyntax) {
      // Check if content ends with blank line pattern (newline, optional whitespace, newline)
      var checkPos = content.length - 1
      // Skip trailing newline
      if (content[checkPos] === '\n') {
        checkPos--
        // Skip whitespace
        while (
          checkPos >= 0 &&
          (content[checkPos] === ' ' ||
            content[checkPos] === '\t' ||
            content[checkPos] === '\r')
        ) {
          checkPos--
        }
        // If there's another newline before this, we have a blank line ending
        if (checkPos >= 0 && content[checkPos] === '\n') {
          endedAtBlankLine = true
        }
      }
    }
  }

  // Determine if this block should have verbatim rendering hint
  // Type 1 blocks and Type 6 blocks ending with blank lines should be verbatim
  var shouldTreatAsVerbatim =
    isType1BlockTag ||
    (isType6Block && endedAtBlankLine && !hasBlockContent(content))

  var normalizedContent = util.normalizeInput(content)
  // Store original content for text field before we modify it for parsing
  var contentForText = normalizedContent
  if (shouldTreatAsVerbatim) {
    if (normalizedContent.length > 0 && normalizedContent[0] === '\n') {
      normalizedContent = normalizedContent.slice(1)
      contentForText = normalizedContent
    }
    if (
      normalizedContent.length > 0 &&
      normalizedContent[normalizedContent.length - 1] === '\n'
    ) {
      normalizedContent = normalizedContent.slice(0, -1)
      contentForText = normalizedContent
    }
    // Remove closing tag from content before parsing (it should only be in text field)
    // But keep it in contentForText for the text field
    var closingTagPattern = '</' + lowerTag + '>'
    var closingTagIdx = normalizedContent.indexOf(closingTagPattern)
    if (closingTagIdx !== -1) {
      normalizedContent = normalizedContent.slice(0, closingTagIdx)
      // contentForText keeps the closing tag
    }
  }

  const leftTrimMatch = normalizedContent.match(/^([ \t]*)/)
  const leftTrimAmount = leftTrimMatch ? leftTrimMatch[1] : ''
  const trimmer = new RegExp(
    `^${leftTrimAmount.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
    'gm'
  )
  const trimmed = normalizedContent.replace(trimmer, '')

  const hasDoubleNewline = DOUBLE_NEWLINE_R.test(trimmed)
  const hasNonParagraphBlockSyntax = BLOCK_SYNTAX_R.test(trimmed)
  const isParagraphTag = lowerTag === 'p'
  // Check if content contains HTML tags - if so, parse as blocks for proper nesting
  const hasHTMLTags = HTML_BLOCK_ELEMENT_START_R.test(trimmed)
  const hasBlockSyntax = isParagraphTag
    ? hasDoubleNewline
    : hasDoubleNewline ||
      hasNonParagraphBlockSyntax ||
      (state.inHTML && hasHTMLTags)

  // ALWAYS parse content into children, regardless of verbatim flag
  let children: MarkdownToJSX.ASTNode[] = []
  if (trimmed) {
    // Parse as blocks when content contains HTML tags to ensure nested HTML is parsed correctly
    if (hasBlockSyntax || hasHTMLTags) {
      const blockState = {
        ...state,
        inline: false,
        inHTML: true,
        inAnchor: state.inAnchor || lowerTag === 'a',
      }
      children = parseBlocksInHTML(trimmed, blockState, options)
    } else {
      const childState = {
        ...state,
        inline: true,
        inAnchor: parentInAnchor || state.inAnchor || lowerTag === 'a',
      }
      children = parseInlineSpan(
        trimmed,
        0,
        trimmed.length,
        childState,
        options
      )
    }
  }

  // Store raw text for verbatim blocks (for CommonMark compliance in default renderer)
  var finalText: string | undefined = undefined
  if (shouldTreatAsVerbatim) {
    if (rawOpeningTag !== undefined) {
      // Type 1 block with newlines in opening tag - preserve raw opening tag + content
      // Store the full raw HTML (opening tag + content) in text field
      // The closing tag will be added by html()
      finalText = rawOpeningTag + contentForText
    } else {
      finalText = contentForText
    }
  }

  return {
    type: RuleType.htmlBlock,
    tag: (shouldTreatAsVerbatim
      ? tagName
      : tagNameOriginal) as MarkdownToJSX.HTMLTags,
    attrs: attributes,
    rawAttrs: attrs,
    children: children,
    rawText: finalText,
    text: finalText, // @deprecated - use rawText instead
    verbatim: shouldTreatAsVerbatim,
    canInterruptParagraph: true, // type 1-6 blocks can interrupt paragraphs
    endPos: endPos,
  } as MarkdownToJSX.HTMLNode & {
    endPos: number
    canInterruptParagraph?: boolean
  }
}

function parseHTML(
  source: string,
  pos: number,
  state: MarkdownToJSX.State,
  options: ParseOptions
): ParseResult {
  debug('parse', 'htmlBlock', state)
  // Must start with '<'
  if (source[pos] !== '<') return null

  // Track attempt after cheap disqualifications but before expensive parsing work
  if (!state.inline) {
    trackBlockAttempt('htmlBlock')
  }

  // Check for processing instructions, declarations, and comments first (before unified parser)
  if (pos + 1 < source.length) {
    if (source[pos + 1] === '?') {
      debug('parse', 'htmlProcessingInstruction', state)
      var piToken = scanRawHTML(source, pos)
      if (piToken && piToken.kind === 'pi') {
        return createHTMLCommentResult(piToken.text || '', piToken.endPos, {
          raw: true,
        })
      }
    } else if (source[pos + 1] === '!') {
      // Check for HTML comments (<!-- ... -->)
      if (pos + 3 < source.length && source.slice(pos, pos + 4) === '<!--') {
        debug('parse', 'htmlComment', state)
        if (state.inline) {
          trackAttempt('htmlComment')
        } else {
          trackBlockAttempt('htmlComment')
        }
        var token = scanRawHTML(source, pos)
        if (token && token.kind === 'comment') {
          // Extract text content (strip <!-- and -->)
          var text = token.text || ''
          var endsWithGreaterThan = false
          if (text === '<!-->') {
            text = ''
            endsWithGreaterThan = true
          } else if (text === '<!--->') {
            text = '-'
            endsWithGreaterThan = true
          } else if (text.startsWith('<!--') && text.endsWith('-->')) {
            text = text.slice(4, -3)
          }
          // Track hit for inline mode (block mode hit tracking happens in parseMarkdown)
          if (state.inline) {
            trackHit('htmlComment')
          }
          return createHTMLCommentResult(text, token.endPos, {
            endsWithGreaterThan,
          })
        }
      }
      debug('parse', 'htmlDeclaration', state)
      var declToken = scanRawHTML(source, pos)
      if (
        declToken &&
        (declToken.kind === 'declaration' || declToken.kind === 'cdata')
      ) {
        return createHTMLCommentResult(declToken.text || '', declToken.endPos, {
          raw: true,
        })
      }
    }
  }

  // Check for space/newline after < (invalid HTML - should be escaped)
  if (pos + 1 < source.length) {
    const nextChar = source[pos + 1]
    if (
      nextChar === ' ' ||
      nextChar === '\n' ||
      nextChar === '\t' ||
      nextChar === '\r'
    ) {
      return null
    }
  }

  // Check if this looks like an autolink before parsing as HTML
  var closeIdx = source.indexOf('>', pos + 1)
  if (closeIdx !== -1) {
    var contentBetween = source.slice(pos + 1, closeIdx)
    // Check for spaces - if found, might be failed autolink
    var hasSpace =
      contentBetween.indexOf(' ') !== -1 || contentBetween.indexOf('\t') !== -1

    // Check for HTTP(S) URLs - these should be autolinks, not HTML tags
    if (
      !hasSpace &&
      (util.startsWith(contentBetween, 'http://') ||
        util.startsWith(contentBetween, 'https://'))
    ) {
      return null // This is an autolink, not an HTML tag
    }

    // Check for URI schemes (scheme:pattern) - no spaces
    if (!hasSpace && isValidUriScheme(contentBetween)) {
      return null // This is an autolink (URI scheme), not an HTML tag
    }
  }

  // Use unified parser
  var tagResult = parseHTMLTag(source, pos)

  // If parseHTMLTag returns null, it might be an incomplete tag
  // Handle incomplete/partial tags inline (previously handled by matchHTMLBlock)
  if (!tagResult && !state.inline) {
    // Check if we have < followed by a valid tag name (even without closing >)
    var sourceLen = source.length
    var firstLineEnd = util.findLineEnd(source, pos)
    var lineStart = pos
    // Skip up to 3 spaces of indentation (per spec)
    var indent = 0
    while (
      lineStart < firstLineEnd &&
      indent < 3 &&
      (source[lineStart] === ' ' || source[lineStart] === '\t')
    ) {
      indent++
      lineStart++
    }
    if (lineStart >= firstLineEnd || source[lineStart] !== '<') return null

    // Try to parse tag name even if tag is incomplete
    // Only handle incomplete tags for block-level tags (type 6)
    // Non-block-level tags that parseHTMLTag can't parse are invalid, not incomplete
    if (lineStart + 1 < firstLineEnd) {
      var tagNameResult = parseHTMLTagName(source, lineStart + 1)
      if (tagNameResult) {
        var tagName = tagNameResult.tagName
        var isType6 = isType6Tag(tagName)
        // Only handle incomplete tags for block-level tags
        if (!isType6) {
          return null // Non-block-level tags that parseHTMLTag can't parse are invalid
        }
        // Find where the tag would end (end of line or before invalid char)
        var partialTagEnd = tagNameResult.nextPos
        var hasNewlineInTag = false
        var inQuotesPartial = false
        var quoteCharPartial = ''
        var checkEnd = firstLineEnd
        var foundClosingAngle = false
        // Check across multiple lines to find the end of the tag
        // Optimized: use indexOf to quickly find boundary characters
        while (checkEnd < sourceLen && !foundClosingAngle) {
          var advancedInInnerLoop = false
          while (partialTagEnd < checkEnd) {
            var c = source[partialTagEnd]
            if (inQuotesPartial) {
              if (c === quoteCharPartial) {
                inQuotesPartial = false
                quoteCharPartial = ''
              }
              if (c === '\n' || c === '\r') {
                hasNewlineInTag = true
              }
              partialTagEnd++
              advancedInInnerLoop = true
            } else if (c === '"' || c === "'") {
              inQuotesPartial = true
              quoteCharPartial = c
              partialTagEnd++
              advancedInInnerLoop = true
            } else if (c === '\n' || c === '\r') {
              hasNewlineInTag = true
              partialTagEnd++
              advancedInInnerLoop = true
              var nextLineEnd = util.findLineEnd(source, partialTagEnd)
              if (nextLineEnd === partialTagEnd) break
              checkEnd = nextLineEnd
            } else if (c === '>') {
              partialTagEnd++
              foundClosingAngle = true
              break
            } else {
              partialTagEnd++
              advancedInInnerLoop = true
            }
          }
          if (foundClosingAngle) break
          if (!advancedInInnerLoop && partialTagEnd >= checkEnd) {
            var nextCheckEnd = util.findLineEnd(source, checkEnd + 1)
            if (nextCheckEnd <= checkEnd) break
            checkEnd = nextCheckEnd
          } else if (partialTagEnd >= checkEnd && checkEnd < sourceLen) {
            var nextCheckEnd = util.findLineEnd(source, checkEnd + 1)
            if (nextCheckEnd <= checkEnd) break
            checkEnd = nextCheckEnd
          } else {
            break
          }
        }
        // Only handle as incomplete tag if it has a newline (extends beyond first line)
        // OR if it extends to end of first line without closing >
        // If tag completes on first line with closing >, parseHTMLTag should have handled it
        if (!hasNewlineInTag && foundClosingAngle) {
          return null // Tag completes on first line but parseHTMLTag returned null - invalid, not incomplete
        }
        // Tag has newline - treat as incomplete and extend to end of first line if needed
        if (partialTagEnd >= firstLineEnd && firstLineEnd < sourceLen) {
          partialTagEnd = firstLineEnd
        }
        // Determine block type and find blank line
        var blockType: 'type6' | 'type7' = isType6 ? 'type6' : 'type7'
        var tagEnd = partialTagEnd
        var blockEnd = findNextBlankLine(
          source,
          skipToNextLine(source, firstLineEnd),
          sourceLen
        )
        var blockContent = source.slice(tagEnd, blockEnd)
        var isClosingTag = pos + 1 < source.length && source[pos + 1] === '/'

        // For type 7 blocks with incomplete tags, preserve raw HTML
        if (blockType === 'type7' && blockContent.trim() === '') {
          var rawTagHTML = source.slice(pos, blockEnd)
          var tagLineEnd = util.findLineEnd(rawTagHTML, 0)
          if (tagLineEnd < rawTagHTML.length) tagLineEnd++
          var rawTag = rawTagHTML.slice(0, tagLineEnd)
          return createVerbatimHTMLBlock(
            tagName,
            rawTag,
            blockEnd,
            {},
            undefined,
            isClosingTag,
            false, // type 7 blocks cannot interrupt paragraphs
            options,
            state
          )
        }

        // For type 6/7 blocks with incomplete tags and content, preserve full raw HTML
        var fullRawHTML = source.slice(pos, blockEnd)
        return createVerbatimHTMLBlock(
          tagName,
          fullRawHTML,
          blockEnd,
          {},
          undefined,
          isClosingTag,
          blockType === 'type6', // type 6 can interrupt, type 7 cannot
          options,
          state
        )
      }
    }
    return null
  }

  if (!tagResult) return null

  // Per CommonMark spec: reject HTML tags that look like failed autolinks
  // Check if the content between < and > looks like a failed autolink
  // (HTTP(S) URLs with spaces are failed autolinks - checked above)
  if (closeIdx !== -1) {
    var contentBetweenCheck = source.slice(pos + 1, closeIdx)
    // If it starts with http:// or https:// but has spaces, it's a failed autolink
    if (
      (util.startsWith(contentBetweenCheck, 'http://') ||
        util.startsWith(contentBetweenCheck, 'https://')) &&
      (contentBetweenCheck.indexOf(' ') !== -1 ||
        contentBetweenCheck.indexOf('\t') !== -1)
    ) {
      return null // Failed autolink - reject as HTML tag
    }
  }

  // If a tag name has a colon at position 1 (e.g., "m:abc"), it's trying to be an autolink
  // but the scheme is only 1 character (invalid). These should be escaped, not parsed as HTML.
  // Examples: <m:abc>, <x:foo> should be escaped as &lt;m:abc&gt;, &lt;x:foo&gt;
  var tagNameStart = pos + (tagResult.isClosing ? 2 : 1)
  if (tagNameStart < source.length) {
    var tagNameFirstChar = source[tagNameStart]
    var tagNameFirstCharCode = charCode(tagNameFirstChar)
    // Check if it starts with a letter
    if (
      (tagNameFirstCharCode >= 97 && tagNameFirstCharCode <= 122) ||
      (tagNameFirstCharCode >= 65 && tagNameFirstCharCode <= 90)
    ) {
      // Check if second character is a colon (making it a 1-char scheme, which is invalid)
      if (
        tagNameStart + 1 < source.length &&
        source[tagNameStart + 1] === ':'
      ) {
        // This looks like a failed autolink attempt - reject as HTML tag
        return null
      }
    }
  }

  // Handle closing tags
  if (tagResult.isClosing) {
    // Per CommonMark: closing tags cannot have attributes
    // If attrs is not empty (after trimming whitespace), it's invalid HTML - escape it
    var attrsTrimmed = tagResult.attrs.trim()
    if (attrsTrimmed.length > 0) {
      // Invalid closing tag with attributes - return null to allow escaping
      return null
    }

    // Per CommonMark spec: closing tags are type 7 HTML blocks
    // Parse as block if: (1) on its own line, or (2) followed by a block-level HTML tag
    // Per Example 148: </td></tr></table> should be block-level
    // Per Example 623: </a></foo > should be inline (wrapped in paragraph)
    if (!state.inline) {
      var sourceLen = source.length
      var firstLineEnd = util.findLineEnd(source, pos)
      var tagEnd = tagResult.endPos

      // Check if tag is on its own line or followed by a block-level HTML tag
      var afterTag = tagEnd
      while (
        afterTag < firstLineEnd &&
        (source[afterTag] === ' ' ||
          source[afterTag] === '\t' ||
          source[afterTag] === '\r')
      ) {
        afterTag++
      }

      var shouldParseAsBlock =
        afterTag >= firstLineEnd ||
        (source[afterTag] === '<' &&
          (function () {
            var nextTag = parseHTMLTag(source, afterTag)
            return nextTag && isType6Tag(nextTag.tagLower)
          })())

      if (shouldParseAsBlock) {
        var blockEnd = findNextBlankLine(
          source,
          skipToNextLine(source, firstLineEnd),
          sourceLen
        )
        var blockContent = source.slice(tagEnd, blockEnd)
        if (blockContent.length > 0) {
          if (blockContent[0] === '\r' && blockContent[1] === '\n') {
            blockContent = blockContent.slice(2)
          } else if (blockContent[0] === '\n' || blockContent[0] === '\r') {
            blockContent = blockContent.slice(1)
          }
        }

        // Cache lowercase tag name to avoid repeated toLowerCase() calls
        const tagLower = tagResult.tagLower || tagResult.tagName.toLowerCase()
        return createVerbatimHTMLBlock(
          tagResult.tagName,
          blockContent,
          blockEnd,
          parseHTMLAttributes(
            tagResult.whitespaceBeforeAttrs + tagResult.attrs,
            tagLower,
            tagResult.tagName,
            options
          ),
          tagResult.whitespaceBeforeAttrs + tagResult.attrs,
          true,
          false,
          options,
          state
        )
      }
    }

    // Fallback: for inline context or if block parsing didn't match, parse as self-closing
    // Per CommonMark spec Example 623: closing tags should preserve raw HTML to maintain spacing (e.g., </foo >)
    // Always preserve rawText for closing tags (both inline and block level) so they can be rendered correctly
    var rawText = source.slice(pos, tagResult.endPos)
    const result: MarkdownToJSX.HTMLSelfClosingNode & {
      endPos: number
      isClosingTag?: boolean
      rawText?: string
    } = {
      type: RuleType.htmlSelfClosing,
      tag: tagResult.tagName,
      attrs: {},
      endPos: tagResult.endPos,
      isClosingTag: true,
      rawText: rawText,
    }
    return result
  }

  // Now use unified parser result
  // tagResult already contains parsed tag info

  // IMPORTANT: All validation must happen BEFORE block parsing check
  // This ensures invalid tags are rejected even if they would match as blocks

  // Validate tag name: cannot start with space or newline after <
  // Per CommonMark spec Example 621: < a> and <\nfoo> are invalid
  var tagNameStart = pos + (tagResult.isClosing ? 2 : 1)
  if (tagNameStart < source.length) {
    var firstChar = source[tagNameStart]
    if (
      firstChar === ' ' ||
      firstChar === '\t' ||
      firstChar === '\n' ||
      firstChar === '\r'
    ) {
      // Tag name starts with whitespace - invalid HTML
      return null
    }
  }

  // Attributes are passed through opaquely - no validation

  var tagNameLower = tagResult.tagLower
  var isVoid = util.isVoidElement(tagResult.tagName)

  // Check if this is a JSX component (starts with uppercase letter)
  // JSX components should be parsed as block-level HTML even with newlines
  const isJSXComponent =
    tagResult.tagName.length > 0 &&
    tagResult.tagName[0] >= 'A' &&
    tagResult.tagName[0] <= 'Z'

  // Self-closing tags: has /> or is void (except anchor tags which need special handling)
  // Per CommonMark spec: self-closing tags with newlines are type 7 blocks
  // Type 7 blocks don't interrupt paragraphs, so they should be parsed as inline HTML
  // IMPORTANT: Validation already happened above, so if we get here the tag is valid
  // EXCEPTION: JSX components (uppercase tags) should always be parsed as block-level HTML
  if (tagResult.isSelfClosing || (isVoid && tagNameLower !== 'a')) {
    debug('match', 'htmlSelfClosing', state)
    // If tag has newline, it's a type 7 block - don't interrupt paragraphs
    // Return null to allow paragraph wrapping - parseInlineSpan will parse as raw HTML
    // But only if validation passed (which already happened above)
    // EXCEPTION: JSX components should be parsed as block-level HTML even with newlines
    if (tagResult.hasNewline && !isJSXComponent) {
      debug('match', 'htmlSelfClosing', state)
      return null
    }

    // If we're not in HTML block context and not inline, parse as inline HTML
    // This allows them to be wrapped in paragraphs per type 7 block rules
    // Return null to allow paragraph wrapping - parseInlineSpan will parse them as raw HTML
    // EXCEPTION: JSX components should be parsed as block-level HTML even when not in HTML block context
    if (!state.inHTML && !state.inline && !isJSXComponent) {
      debug('match', 'htmlSelfClosing', state)
      return null
    }

    var attrsTrimmedSelfClose = tagResult.attrs.replace(/\/\s*$/, '')
    var selfCloseAttrs = parseHTMLAttributes(
      attrsTrimmedSelfClose,
      tagNameLower,
      tagResult.tagName,
      options
    )
    // For inline context, preserve raw HTML to maintain spacing
    var rawText = state.inline ? source.slice(pos, tagResult.endPos) : undefined
    const result: MarkdownToJSX.HTMLSelfClosingNode & {
      endPos: number
      rawText?: string
    } = {
      type: RuleType.htmlSelfClosing,
      tag: tagResult.tagName,
      attrs: selfCloseAttrs,
      endPos: tagResult.endPos,
    }
    if (rawText !== undefined) {
      result.rawText = rawText
    }
    return result
  }

  // For inline context, parse as simple opening tag (no closing tag search)
  // IMPORTANT: Validation must happen before this check to reject invalid tags
  // Note: parseHTMLTag only returns a result if tag has closing >, so tag is complete
  // Multiline attributes are supported - newlines in tags are valid HTML
  if (state.inline) {
    // Validation already happened above, so if we get here the tag is valid
    var attrsTrimmedInline = tagResult.attrs.replace(/\/\s*$/, '')
    // Preserve whitespace before attributes for CommonMark compliance
    var rawAttrsWithWhitespace =
      tagResult.whitespaceBeforeAttrs + attrsTrimmedInline
    var parsedInlineAttrs = parseHTMLAttributes(
      attrsTrimmedInline,
      tagNameLower,
      tagResult.tagName,
      options
    )
    var inlineAttrs: Record<string, any> = {
      ...parsedInlineAttrs,
    }

    // For non-void inline tags, find matching closing tag and parse content
    var inlineEndPos = tagResult.endPos
    var children: MarkdownToJSX.ASTNode[] = []
    if (!util.isVoidElement(tagResult.tagName)) {
      var closingResult = findInlineClosingTag(
        source,
        tagResult.endPos,
        tagNameLower
      )
      if (closingResult !== null) {
        var content = source.slice(tagResult.endPos, closingResult[0])
        if (content) {
          if (
            (state.inHTML && HTML_BLOCK_ELEMENT_START_R.test(content)) ||
            hasBlockContent(content)
          ) {
            children = parseBlocksInHTML(
              content,
              {
                ...state,
                inline: false,
                inHTML: true,
                inAnchor: state.inAnchor || tagNameLower === 'a',
              },
              options
            )
          } else {
            children = parseInlineSpan(
              content,
              0,
              content.length,
              {
                ...state,
                inline: true,
                inAnchor: state.inAnchor || tagNameLower === 'a',
              },
              options
            )
          }
        }
        inlineEndPos = closingResult[1]
      }
    }
    return {
      type: RuleType.htmlBlock,
      tag: tagResult.tagName as MarkdownToJSX.HTMLTags,
      attrs: inlineAttrs,
      rawAttrs: rawAttrsWithWhitespace,
      children: children,
      verbatim: false,
      endPos: inlineEndPos,
    } as MarkdownToJSX.HTMLNode & { endPos: number }
  }

  // For inline context, don't try block parsing - simple opening tags should be parsed inline
  // Block parsing is only for tags that need closing tags or are block-level
  if (!state.inline) {
    // Determine block type inline (previously handled by matchHTMLBlock)
    var sourceLen = source.length
    var firstLineEnd = util.findLineEnd(source, pos)
    var tagLower = tagResult.tagLower
    var isType1BlockVar = isType1Block(tagLower)
    var isType6Block = !isType1BlockVar && isType6Tag(tagResult.tagName)
    var tagHasClosingAngle = false
    var checkPos = pos
    while (checkPos < tagResult.endPos) {
      if (source[checkPos] === '>') {
        tagHasClosingAngle = true
        break
      }
      checkPos++
    }
    // Check if tag is followed by end of line (with optional whitespace)
    var afterTag = tagResult.endPos
    while (
      afterTag < firstLineEnd &&
      (source[afterTag] === ' ' || source[afterTag] === '\t')
    ) {
      afterTag++
    }
    // Check if tag is complete on line
    // For type 6 blocks, they can have content on same line
    // For other tags, they must be followed by newline or end of line
    var isCompleteOnLine =
      afterTag >= firstLineEnd ||
      source[afterTag] === '\n' ||
      source[afterTag] === '\r' ||
      (isType6Block && afterTag < firstLineEnd) ||
      !tagHasClosingAngle

    // Type 1 blocks (pre, script, style, textarea) need matching closing tags
    // Handle type 1 blocks even if they have newlines in the opening tag
    if (isType1BlockVar && tagHasClosingAngle && !tagResult.isClosing) {
      // Type 1: find matching closing tag
      var type1TagName = tagResult.tagName
      var type1TagEnd = tagResult.endPos
      var type1Attrs = tagResult.attrs
      var type1ContentPos = type1TagEnd
      if (source[type1ContentPos] === '\n') type1ContentPos++
      var type1ContentStart = type1ContentPos
      var type1ContentEnd = type1ContentPos
      var type1Depth = 1
      var type1OpenTagLen = tagLower.length + 1
      while (type1Depth > 0) {
        var type1Idx = source.indexOf('<', type1ContentPos)
        if (type1Idx === -1) {
          type1ContentEnd = sourceLen
          type1ContentPos = sourceLen
          break
        }
        var type1OpenIdx = -1
        var type1CloseIdx = -1
        if (source[type1Idx + 1] === '/') {
          type1CloseIdx = type1Idx
        } else if (
          type1Idx + type1OpenTagLen + 1 <= sourceLen &&
          (source[type1Idx + 1] === tagLower[0] ||
            source[type1Idx + 1] === type1TagName[0])
        ) {
          var type1TagCandidate = source.substring(
            type1Idx + 1,
            type1Idx + type1OpenTagLen
          )
          if (
            type1TagCandidate.toLowerCase() === tagLower &&
            (source[type1Idx + type1OpenTagLen] === ' ' ||
              source[type1Idx + type1OpenTagLen] === '>')
          ) {
            type1OpenIdx = type1Idx
          }
        }
        if (type1OpenIdx === -1 && type1CloseIdx === -1) {
          type1ContentPos = type1Idx + 1
          continue
        }
        if (
          type1OpenIdx !== -1 &&
          (type1CloseIdx === -1 || type1OpenIdx < type1CloseIdx)
        ) {
          type1ContentPos = type1OpenIdx + type1OpenTagLen + 1
          type1Depth++
        } else {
          var type1P = type1CloseIdx + 2
          while (type1P < sourceLen) {
            var type1C = source[type1P]
            if (
              type1C !== ' ' &&
              type1C !== '\t' &&
              type1C !== '\n' &&
              type1C !== '\r'
            )
              break
            type1P++
          }
          if (type1P + tagLower.length > sourceLen) break
          var type1CloseTagCandidate = source.substring(
            type1P,
            type1P + tagLower.length
          )
          if (type1CloseTagCandidate.toLowerCase() !== tagLower) {
            type1ContentPos = type1P
            continue
          }
          type1P += tagLower.length
          while (type1P < sourceLen) {
            var type1C2 = source[type1P]
            if (
              type1C2 !== ' ' &&
              type1C2 !== '\t' &&
              type1C2 !== '\n' &&
              type1C2 !== '\r'
            )
              break
            type1P++
          }
          if (type1P >= sourceLen || source[type1P] !== '>') {
            type1ContentPos = type1P
            continue
          }
          var type1ClosingTagEnd = type1P + 1
          var type1LineEndAfterClose = util.findLineEnd(
            source,
            type1ClosingTagEnd
          )
          type1ContentEnd = type1LineEndAfterClose
          type1ContentPos = type1LineEndAfterClose + 1
          type1Depth--
        }
      }
      var type1TrailingNl = 0
      while (
        type1ContentPos + type1TrailingNl < sourceLen &&
        source[type1ContentPos + type1TrailingNl] === '\n'
      )
        type1TrailingNl++
      var type1FullMatch = source.slice(pos, type1ContentPos + type1TrailingNl)
      var type1Content = source.slice(type1ContentStart, type1ContentEnd)
      var type1EndPos = type1ContentPos + type1TrailingNl
      return processHTMLBlock(
        tagResult.tagName,
        tagResult.tagName,
        type1Attrs,
        type1Content,
        type1FullMatch,
        type1EndPos,
        source,
        state,
        false,
        options
      )
    }

    // Type 6/7 blocks end at blank lines
    if (isCompleteOnLine || !tagHasClosingAngle) {
      debug('match', 'htmlBlock', state)
      // Determine if type 6 or type 7
      var blockType: 'type6' | 'type7' = isType6Block ? 'type6' : 'type7'
      debug('match', 'htmlBlock', state)
      var tagEnd = tagResult.endPos
      var blockEnd = findNextBlankLine(
        source,
        skipToNextLine(source, firstLineEnd),
        sourceLen
      )

      // For type 6 blocks, check if there's a closing tag before the blank line
      // If found AND the next content is another HTML tag, stop at the closing tag
      // This ensures proper nesting of sibling elements (e.g., <dt></dt><dd></dd>)
      if (blockType === 'type6' && !tagResult.isClosing) {
        // For JSX components, preserve case; for HTML, use lowercase
        const tagNameForClosing = isJSXComponent
          ? tagResult.tagName
          : tagResult.tagLower || tagResult.tagName.toLowerCase()
        var closingTagPattern = '</' + tagNameForClosing
        var openingTagPattern = '<' + tagNameForClosing

        // Find the matching closing tag by tracking nesting depth
        var searchPos = tagEnd
        var depth = 1 // We already have one opening tag (depth starts at 1)
        var closingIdx = -1
        while (searchPos < blockEnd && depth > 0) {
          var nextOpenIdx = source.indexOf(openingTagPattern, searchPos)
          var nextCloseIdx = source.indexOf(closingTagPattern, searchPos)

          // Validate and find next valid opening tag (followed by whitespace or >)
          // Note: We don't accept / because that indicates a self-closing tag
          while (nextOpenIdx !== -1 && nextOpenIdx < blockEnd) {
            var afterOpenPos = nextOpenIdx + openingTagPattern.length
            if (afterOpenPos >= sourceLen) {
              nextOpenIdx = -1
              break
            }
            var charAfterOpen = source[afterOpenPos]
            if (
              charAfterOpen === ' ' ||
              charAfterOpen === '\t' ||
              charAfterOpen === '\n' ||
              charAfterOpen === '\r' ||
              charAfterOpen === '>'
            ) {
              break // Valid opening tag found
            }
            // Not valid (could be self-closing like <div/> or partial match), search for next
            nextOpenIdx = source.indexOf(openingTagPattern, afterOpenPos)
          }

          if (nextOpenIdx === -1 || nextOpenIdx >= blockEnd) {
            nextOpenIdx = blockEnd
          }
          if (nextCloseIdx === -1 || nextCloseIdx >= blockEnd) {
            nextCloseIdx = blockEnd
          }

          if (nextOpenIdx < nextCloseIdx) {
            // Found an opening tag first - increase depth
            depth++
            searchPos = nextOpenIdx + openingTagPattern.length
          } else if (nextCloseIdx < blockEnd) {
            // Found a closing tag first - decrease depth
            depth--
            if (depth === 0) {
              closingIdx = nextCloseIdx
              break
            }
            searchPos = nextCloseIdx + closingTagPattern.length
          } else {
            break // No more tags found
          }
        }

        if (closingIdx !== -1 && closingIdx < blockEnd) {
          // Found the matching closing tag before the blank line
          // Check if it's valid
          var afterClosingTag = closingIdx + closingTagPattern.length
          while (
            afterClosingTag < sourceLen &&
            (source[afterClosingTag] === ' ' ||
              source[afterClosingTag] === '\t')
          ) {
            afterClosingTag++
          }
          if (afterClosingTag < sourceLen && source[afterClosingTag] === '>') {
            // Valid closing tag found before blank line
            // Check if the content immediately after the closing tag (after newline) starts with another HTML tag
            var closingTagEndPos = afterClosingTag + 1
            var nextContentPos = closingTagEndPos
            // Skip to next line
            while (
              nextContentPos < sourceLen &&
              source[nextContentPos] !== '\n'
            ) {
              nextContentPos++
            }
            if (nextContentPos < sourceLen) {
              nextContentPos++ // Skip the newline
            }
            // Skip leading whitespace on next line
            while (
              nextContentPos < sourceLen &&
              (source[nextContentPos] === ' ' ||
                source[nextContentPos] === '\t')
            ) {
              nextContentPos++
            }
            // Check if next content is another HTML tag (that is NOT a closing tag for our current tag)
            if (
              nextContentPos < sourceLen &&
              source[nextContentPos] === '<' &&
              !util.startsWith(source.slice(nextContentPos), closingTagPattern)
            ) {
              var nextTag = parseHTMLTag(source, nextContentPos)
              if (nextTag) {
                // Next content is a different HTML tag - stop at our closing tag
                blockEnd = closingTagEndPos
              }
            }
            // Otherwise, continue to blank line as per CommonMark
          }
        } else {
          // No matching closing tag found before blank line
          // Check if there's a closing tag after the blank line
          closingIdx = source.indexOf(closingTagPattern, tagEnd)
          if (closingIdx !== -1) {
            // Closing tag found but after blank line
            // Check if there's block content that would warrant extending to the closing tag
            var extendedContent = source.slice(tagEnd, closingIdx)
            var shouldExtend =
              isJSXComponent || hasBlockContent(extendedContent)
            if (shouldExtend) {
              // Extend block to include closing tag
              var afterClosingTag2 = closingIdx + closingTagPattern.length
              while (
                afterClosingTag2 < sourceLen &&
                (source[afterClosingTag2] === ' ' ||
                  source[afterClosingTag2] === '\t')
              ) {
                afterClosingTag2++
              }
              if (
                afterClosingTag2 < sourceLen &&
                source[afterClosingTag2] === '>'
              ) {
                var closingLineEnd = util.findLineEnd(
                  source,
                  afterClosingTag2 + 1
                )
                blockEnd = closingLineEnd
              }
            }
          }
        }
      }

      var blockContent = source.slice(tagEnd, blockEnd)
      var blockAttrs = tagResult.whitespaceBeforeAttrs + tagResult.attrs
      var isClosingTag = tagResult.isClosing

      // Handle type 6/7 blocks
      // For type 7 blocks with empty content (standalone tags), determine if they should be block or inline
      // Per CommonMark: Type 7 blocks cannot interrupt paragraphs, but if they're on their own line they're blocks
      // However, if the tag contains newlines in attributes (without hasNewline flag because they're in quotes),
      // it should be treated as inline and wrapped in a paragraph
      if (blockType === 'type7' && blockContent.trim() === '') {
        // Check if the tag itself contains a newline (inside the tag, not after it)
        var rawTagText = source.slice(pos, tagResult.endPos)
        var tagContainsNewline = rawTagText.indexOf('\n') !== -1

        if (tagContainsNewline) {
          // Tag has newline inside it (in attribute) - should be wrapped in paragraph
          return null
        }

        // Tag is on its own line, treat as block
        var tagEndInSource = tagResult.endPos
        var tagLineEnd = util.findLineEnd(source, tagEndInSource)
        if (tagLineEnd < source.length) tagLineEnd++
        var rawTag = source.slice(pos, tagLineEnd)
        // Parse attributes for single-line type 7 blocks
        const type7TagLower =
          tagResult.tagLower || tagResult.tagName.toLowerCase()
        const type7Attrs = tagResult.whitespaceBeforeAttrs + tagResult.attrs
        const parsedType7Attrs = parseHTMLAttributes(
          type7Attrs,
          type7TagLower,
          tagResult.tagName,
          options
        )
        return createVerbatimHTMLBlock(
          tagResult.tagName,
          rawTag,
          blockEnd,
          parsedType7Attrs,
          type7Attrs,
          isClosingTag,
          false, // type 7 blocks cannot interrupt paragraphs
          options,
          state
        )
      }

      // For type 7 blocks with multi-line or incomplete opening tags, preserve raw HTML
      var openingTagHasNewline = tagResult.hasNewline
      var openingTagIsIncomplete = !tagHasClosingAngle
      if (
        (openingTagHasNewline || openingTagIsIncomplete) &&
        blockType === 'type7'
      ) {
        var openingTagEnd = tagResult.endPos
        var rawOpeningTag = source.slice(pos, openingTagEnd)
        var rawContent = blockContent
        var fullRawHTML = rawOpeningTag + rawContent
        // Parse attributes even for multi-line tags (#781)
        const multilineTagLower =
          tagResult.tagLower || tagResult.tagName.toLowerCase()
        const multilineAttrs = tagResult.whitespaceBeforeAttrs + tagResult.attrs
        const parsedMultilineAttrs = parseHTMLAttributes(
          multilineAttrs,
          multilineTagLower,
          tagResult.tagName,
          options
        )
        return createVerbatimHTMLBlock(
          tagResult.tagName,
          fullRawHTML,
          blockEnd,
          parsedMultilineAttrs,
          multilineAttrs,
          isClosingTag,
          false, // type 7 blocks cannot interrupt paragraphs
          options,
          state
        )
      }

      // Parse attributes, but always preserve raw attributes for consistency
      // Cache lowercase tag name to avoid repeated toLowerCase() calls
      const tagLower = tagResult.tagLower || tagResult.tagName.toLowerCase()
      var parsedBlockAttributes = parseHTMLAttributes(
        blockAttrs,
        tagLower,
        tagResult.tagName,
        options
      )
      var blockAttributes: Record<string, any> = {
        ...parsedBlockAttributes,
      }

      // For type 6 blocks with block syntax, parse through processHTMLBlock
      if (blockType === 'type6') {
        var contentForBlockCheck = blockContent
        var closingTagIdx = blockContent.indexOf('</' + tagLower)
        if (closingTagIdx >= 0) {
          var afterTag = closingTagIdx + 2 + tagResult.tagName.length
          while (
            afterTag < blockContent.length &&
            (blockContent[afterTag] === ' ' || blockContent[afterTag] === '\t')
          )
            afterTag++
          if (
            afterTag < blockContent.length &&
            blockContent[afterTag] === '>'
          ) {
            contentForBlockCheck = blockContent.slice(0, closingTagIdx)
          }
        }

        if (hasBlockContent(contentForBlockCheck)) {
          return processHTMLBlock(
            tagResult.tagName,
            tagResult.tagName,
            blockAttrs,
            contentForBlockCheck,
            source.slice(pos, tagResult.endPos),
            blockEnd,
            source,
            state,
            false,
            options
          )
        }
      }

      var verbatimContent = blockContent
      if (verbatimContent.length > 0) {
        if (verbatimContent[0] === '\r' && verbatimContent[1] === '\n') {
          verbatimContent = verbatimContent.slice(2)
        } else if (verbatimContent[0] === '\n' || verbatimContent[0] === '\r') {
          verbatimContent = verbatimContent.slice(1)
        }
      }
      // Per CommonMark spec: remove common leading whitespace from all lines
      var lines = verbatimContent.split('\n')
      var minIndent = Infinity
      for (var lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        var line = lines[lineIdx]
        if (line.trim().length === 0) continue
        var indent = 0
        while (
          indent < line.length &&
          (line[indent] === ' ' || line[indent] === '\t')
        ) {
          indent++
        }
        if (indent < minIndent) minIndent = indent
      }
      if (minIndent > 0 && minIndent < Infinity) {
        var dedentedLines: string[] = []
        for (var lineIdx2 = 0; lineIdx2 < lines.length; lineIdx2++) {
          var line2 = lines[lineIdx2]
          if (line2.trim().length === 0) {
            dedentedLines.push(line2)
          } else {
            dedentedLines.push(line2.slice(minIndent))
          }
        }
        verbatimContent = dedentedLines.join('\n')
      }

      return createVerbatimHTMLBlock(
        tagResult.tagName,
        verbatimContent,
        blockEnd,
        blockAttributes,
        blockAttrs,
        isClosingTag,
        blockType === 'type6' ? true : false, // type 6 can interrupt, type 7 cannot
        options,
        state
      )
    }
  }

  // If we're in inline context and didn't match simple tag parsing, return null
  // This allows the tag to be escaped or handled by other parsers
  if (state.inline) {
    debug('match', 'htmlBlock', state)
    return null
  }

  debug('match', 'htmlBlock', state)

  // Fallback: Try void element without /> (manual parsing)
  // Only try this if self-closing didn't match
  var tagNameResult = parseHTMLTagName(source, pos + 1)
  if (!tagNameResult) return null

  var tagName = tagNameResult.tagName
  if (!util.isVoidElement(tagName)) {
    debug('match', 'htmlBlock', state)
    return null
  }

  // Use tagLower from parseHTMLTagName result to avoid repeated toLowerCase() calls
  const tagLowerVoid = tagNameResult.tagLower

  var i = tagNameResult.nextPos
  var len = source.length
  while (i < len && isSpaceOrTab(source[i])) i++
  var attrsStart = i

  while (i < len && source[i] !== '>') i++
  if (i >= len) return null

  const attrs = source.slice(attrsStart, i).trim()
  const afterAngle = i + 1

  let checkIdx = afterAngle
  while (checkIdx < len && isSpaceOrTab(source[checkIdx])) checkIdx++
  const closeTagPattern = '</' + tagLowerVoid + '>'
  const foundIdx = source.toLowerCase().indexOf(closeTagPattern, checkIdx)
  if (foundIdx !== -1) {
    const between = source.slice(checkIdx, foundIdx).trim()
    if (between) {
      return null
    }
  }

  i++
  const endPos = i
  while (i < len && isSpaceOrTab(source[i])) i++
  if (i < len && source[i] === '\n') i++

  const fallbackAttributes = parseHTMLAttributes(
    attrs,
    tagName,
    tagName,
    options
  )

  return {
    type: RuleType.htmlSelfClosing,
    tag: tagName,
    attrs: fallbackAttributes,
    endPos,
  } as MarkdownToJSX.HTMLSelfClosingNode & { endPos: number }
}

// ============================================================================
// HTML Token Interface and Unified Scanner
// Ultra-compact unified scanner for all HTML constructs
// ============================================================================

export interface HTMLToken {
  kind: 'tag' | 'comment' | 'pi' | 'declaration' | 'cdata'
  tagNameLower?: string
  tagName?: string
  isClosing?: boolean
  isSelfClosing?: boolean
  hasNewline: boolean
  type6Candidate?: boolean
  type7Candidate?: boolean
  endPos: number
  attrs?: string
  whitespaceBeforeAttrs?: string
  text?: string
  raw?: boolean
}

/**
 * Scan tag-like constructs: </tag, <tag
 */
function scanTagLike(source: string, pos: number): HTMLToken | null {
  if (source[pos] !== '<') return null

  var sourceLen = source.length

  // Check for closing tag (</tag>)
  var isClosing = false
  var tagStart = pos + 1
  if (pos + 1 < sourceLen && source[pos + 1] === '/') {
    isClosing = true
    tagStart = pos + 2
  }

  // Parse tag name
  var tagNameResult = parseHTMLTagName(source, tagStart)
  if (!tagNameResult) return null

  var tagName = tagNameResult.tagName
  var tagLower = tagNameResult.tagLower
  var attrsStart = tagNameResult.nextPos

  // Fast path: tags without attributes or whitespace
  if (attrsStart < sourceLen) {
    var immediateChar = source[attrsStart]
    if (immediateChar === '>' || immediateChar === '/') {
      var endPos = immediateChar === '>' ? attrsStart + 1 : attrsStart + 2
      if (
        immediateChar === '/' &&
        (attrsStart + 1 >= sourceLen || source[attrsStart + 1] !== '>')
      ) {
        return null
      }
      var isSelfClosingFast = immediateChar === '/'
      var type6CandidateFast = isType6Tag(tagName)
      var type7CandidateFast = !isType1Block(tagLower) && !type6CandidateFast
      return {
        kind: 'tag',
        tagNameLower: tagLower,
        tagName: tagName,
        isClosing: isClosing,
        isSelfClosing: isSelfClosingFast,
        hasNewline: false,
        type6Candidate: type6CandidateFast,
        type7Candidate: type7CandidateFast,
        endPos: endPos,
        attrs: '',
        whitespaceBeforeAttrs: '',
      }
    }
  }

  // Capture whitespace after tag name (including newlines per CommonMark spec)
  var whitespaceStart = attrsStart
  var hasNewline = false
  while (attrsStart < sourceLen) {
    var ch = source[attrsStart]
    var code = charCode(source, attrsStart)
    if (ch === ' ' || ch === '\t') {
      // Space or tab - continue
    } else if (code === 10 || code === 13) {
      // \n or \r
      hasNewline = true
    } else {
      break // Not whitespace
    }
    attrsStart++
  }
  var whitespaceBeforeAttrs = source.slice(whitespaceStart, attrsStart)

  // Parse attributes until we find > - minimal validation only for boundary detection
  var tagEnd = attrsStart
  var inQuotes = false
  var quoteChar = ''
  var braceDepth = 0
  var hasSlash = false
  var hasSpaceBeforeSlash = false

  // State machine for attribute parsing: 0=normal, 1=inDoubleQuotes, 2=inSingleQuotes
  var parseState = 0
  while (tagEnd < sourceLen) {
    var char = source[tagEnd]
    var code = charCode(source, tagEnd)

    // Handle quotes state machine
    if (parseState === 1) {
      // in double quotes
      if (char === '"') {
        // Check for consecutive quotes (invalid HTML)
        if (tagEnd + 1 < sourceLen && source[tagEnd + 1] === '"') {
          return null
        }
        parseState = 0
      }
      tagEnd++
    } else if (parseState === 2) {
      // in single quotes
      if (char === "'") {
        parseState = 0
      }
      tagEnd++
    } else if (char === '"') {
      parseState = 1
      tagEnd++
    } else if (char === "'") {
      parseState = 2
      tagEnd++
    } else if (char === '{' || (char === '}' && braceDepth > 0)) {
      // Track JSX expression brace depth
      braceDepth += char === '{' ? 1 : -1
      tagEnd++
    } else if (char === '>' && braceDepth === 0) {
      // Found closing > - check for self-closing / and space before >
      if (tagEnd > attrsStart) {
        var checkBack = tagEnd - 1
        while (checkBack >= attrsStart) {
          var backChar = source[checkBack]
          if (backChar !== ' ' && backChar !== '\t') break
          checkBack--
        }
        if (checkBack >= attrsStart && source[checkBack] === '/') {
          hasSlash = true
          hasSpaceBeforeSlash = checkBack < tagEnd - 1
        }
      }
      tagEnd++
      break
    } else {
      // Check for invalid attribute name characters (*, #, !)
      if (char === '*' || char === '#' || char === '!') {
        var checkAhead = tagEnd + 1
        while (checkAhead < sourceLen) {
          var aheadChar = source[checkAhead]
          if (
            aheadChar === '=' ||
            aheadChar === ' ' ||
            aheadChar === '\t' ||
            aheadChar === '\n' ||
            aheadChar === '\r' ||
            aheadChar === '>'
          ) {
            break
          }
          checkAhead++
        }
        if (checkAhead < sourceLen && source[checkAhead] === '=') {
          return null // Invalid char in attribute name
        }
      }
      // Track newlines
      if (code === 10 || code === 13) {
        // \n or \r
        hasNewline = true
      }
      tagEnd++
    }
  }

  // Must have found >
  if (tagEnd > sourceLen || source[tagEnd - 1] !== '>') {
    return null
  }

  // Reject tags with unclosed quotes
  if (parseState === 1 || parseState === 2) {
    return null
  }

  // Reject tags with unclosed JSX expressions
  if (braceDepth > 0) {
    return null
  }

  // Reject tags with space between / and > (invalid HTML structure)
  if (hasSpaceBeforeSlash) {
    return null
  }

  var attrsEnd = tagEnd - 1
  if (hasSlash) {
    // For self-closing tags, exclude the / from attrs
    attrsEnd--
  }
  var attrs = source.slice(attrsStart, attrsEnd)
  var isSelfClosing = hasSlash

  // Minimal validation: reject missing space after quoted attribute value
  var lastQuotePos = -1
  var inQuotesCheck = false
  var quoteCharCheck = ''
  var afterEquals = false
  for (var i = 0; i < attrs.length; i++) {
    var ch = attrs[i]
    if (inQuotesCheck) {
      if (ch === quoteCharCheck) {
        inQuotesCheck = false
        lastQuotePos = i
        quoteCharCheck = ''
        afterEquals = false
      }
    } else if (ch === '"' || ch === "'") {
      inQuotesCheck = true
      quoteCharCheck = ch
      afterEquals = false
    } else if (ch === '=') {
      afterEquals = true
    } else if (lastQuotePos !== -1 && i === lastQuotePos + 1) {
      // Immediately after closing quote
      var code = ch.charCodeAt(0)
      if (isAlphaCode(code)) {
        // Letter immediately after quote - missing space, reject
        return null
      }
    } else if (
      afterEquals &&
      !inQuotesCheck &&
      (ch === '*' || ch === '#' || ch === '!')
    ) {
      // Invalid char in unquoted attribute value - reject
      return null
    } else if (isSpaceOrTab(ch)) {
      afterEquals = false
    }
  }

  // Determine type 6/7 candidates
  var type6Candidate = isType6Tag(tagName)
  var type7Candidate = !isType1Block(tagLower) && !type6Candidate

  return {
    kind: 'tag',
    tagNameLower: tagLower,
    tagName: tagName,
    isClosing: isClosing,
    isSelfClosing: isSelfClosing,
    hasNewline: hasNewline,
    type6Candidate: type6Candidate,
    type7Candidate: type7Candidate,
    endPos: tagEnd,
    attrs: attrs,
    whitespaceBeforeAttrs: whitespaceBeforeAttrs,
  }
}

// ============================================================================
// Unified HTML Scanner
// Ultra-compact unified scanner for all HTML constructs
// ============================================================================

/**
 * Unified HTML scanner - handles tags, comments, PIs, declarations, CDATA
 * Ultra-compact implementation tuned for minification
 */
function scanRawHTML(s: string, p: number): HTMLToken | null {
  if (p >= s.length || s[p] !== '<') return null
  var l = s.length
  if (p + 1 >= l) return null
  var c = s[p + 1]
  if (c === '!') {
    if (p + 4 <= l && s.slice(p, p + 4) === '<!--') {
      // Comment: scan for -->
      var endPos = p + 4
      if (endPos < l && s[endPos] === '>') {
        return {
          kind: 'comment',
          hasNewline: false,
          endPos: endPos + 1,
          text: s.slice(p, endPos + 1),
          raw: true,
        }
      }
      if (endPos + 1 < l && s[endPos] === '-' && s[endPos + 1] === '>') {
        return {
          kind: 'comment',
          hasNewline: false,
          endPos: endPos + 2,
          text: s.slice(p, endPos + 2),
          raw: true,
        }
      }
      while (endPos + 2 < l) {
        if (s.slice(endPos, endPos + 3) === '-->') {
          return {
            kind: 'comment',
            hasNewline: false,
            endPos: endPos + 3,
            text: s.slice(p, endPos + 3),
            raw: true,
          }
        }
        endPos++
      }
      return null
    }
    if (p + 9 <= l && s.slice(p, p + 9) === '<![CDATA[') {
      // CDATA: scan for ]]>
      var endPos = p + 9
      while (endPos + 2 < l) {
        if (s.slice(endPos, endPos + 3) === ']]>') {
          return {
            kind: 'cdata',
            hasNewline: false,
            endPos: endPos + 3,
            text: s.slice(p, endPos + 3),
            raw: true,
          }
        }
        endPos++
      }
      return null
    }
    if (p + 2 < l && isAlphaCode(s.charCodeAt(p + 2))) {
      // Declaration: scan for >
      var endPos = p + 2
      while (endPos < l && s[endPos] !== '>') endPos++
      if (endPos >= l) return null
      return {
        kind: 'declaration',
        hasNewline: false,
        endPos: endPos + 1,
        text: s.slice(p, endPos + 1),
        raw: true,
      }
    }
    return null
  }
  if (c === '?') {
    // Processing instruction: scan for ?>
    var endPos = p + 2
    while (endPos + 1 < l) {
      if (s.slice(endPos, endPos + 2) === '?>') {
        return {
          kind: 'pi',
          hasNewline: false,
          endPos: endPos + 2,
          text: s.slice(p, endPos + 2),
          raw: true,
        }
      }
      endPos++
    }
    return null
  }
  return scanTagLike(s, p)
}

interface DefinitionParseResult {
  endPos: number
  target: string
  title?: string
}

function isBlockStartAt(s: string, p: number): boolean {
  if (p >= s.length) return false
  var c = s[p]
  return (
    c === '=' ||
    c === '-' ||
    c === '_' ||
    c === '*' ||
    c === '#' ||
    c === '>' ||
    c === '`' ||
    c === '~' ||
    c === '[' ||
    (c >= '0' && c <= '9')
  )
}

function isTitleDelimiter(s: string, p: number): boolean {
  if (p >= s.length) return false
  var c = s[p]
  return c === '"' || c === "'" || c === '('
}

function parseQuotedTitle(
  s: string,
  p: number,
  closeChar: string
): { value: string; endPos: number } | null {
  var len = s.length
  if (p >= len || s[p] !== closeChar) return null
  p++
  var start = p
  var lastWasNewline = false
  while (p < len && s[p] !== closeChar) {
    var c = s.charCodeAt(p)
    if (c === $.CHAR_NEWLINE) {
      if (lastWasNewline) return null
      lastWasNewline = true
      p++
    } else if (c === $.CHAR_CR) {
      if (p + 1 < len && s.charCodeAt(p + 1) === $.CHAR_NEWLINE) {
        if (lastWasNewline) return null
        lastWasNewline = true
        p += 2
      } else {
        lastWasNewline = false
        p++
      }
    } else {
      lastWasNewline = false
      if (c === $.CHAR_BACKSLASH && p + 1 < len) p++
      p++
    }
  }
  if (p >= len) return null
  return { value: s.slice(start, p), endPos: p + 1 }
}

function parseParenTitle(
  s: string,
  p: number
): { value: string; endPos: number } | null {
  var len = s.length
  if (p >= len || s[p] !== '(') return null
  p++
  var start = p
  var depth = 1
  var lastWasNewline = false
  while (p < len && depth > 0) {
    var c = s.charCodeAt(p)
    if (c === $.CHAR_NEWLINE) {
      if (lastWasNewline) return null
      lastWasNewline = true
      p++
    } else if (c === $.CHAR_CR) {
      if (p + 1 < len && s.charCodeAt(p + 1) === $.CHAR_NEWLINE) {
        if (lastWasNewline) return null
        lastWasNewline = true
        p += 2
      } else {
        lastWasNewline = false
        p++
      }
    } else {
      lastWasNewline = false
      if (c === $.CHAR_BACKSLASH && p + 1 < len) {
        p++
      } else if (c === $.CHAR_PAREN_OPEN) {
        depth++
      } else if (c === $.CHAR_PAREN_CLOSE) {
        depth--
      }
      p++
    }
  }
  if (depth !== 0) return null
  return { value: s.slice(start, p - 1), endPos: p }
}

function scanFootnoteEnd(s: string, p: number): number {
  var len = s.length
  var pos = p
  while (pos < len) {
    var isLineStart = pos === 0 || s[pos - 1] === '\n'
    var c = s.charCodeAt(pos)
    if (c === $.CHAR_NEWLINE && pos > p) {
      var nextPos = pos + 1
      if (nextPos < len && s.charCodeAt(nextPos) === $.CHAR_CR) nextPos++
      if (nextPos < len && s.charCodeAt(nextPos) === $.CHAR_NEWLINE) {
        var afterBlank = nextPos + 1
        while (
          afterBlank < len &&
          (s[afterBlank] === ' ' || s[afterBlank] === '\t')
        ) {
          afterBlank++
        }
        var blankLineLen = afterBlank - (pos + 1)
        if (s.charCodeAt(pos + 1) === $.CHAR_CR) blankLineLen--
        if (
          afterBlank < len &&
          s.charCodeAt(afterBlank) !== $.CHAR_NEWLINE &&
          s.charCodeAt(afterBlank) !== $.CHAR_CR &&
          blankLineLen < 4
        ) {
          return pos
        }
      }
    }
    if (isLineStart && util.startsWith(s, '[^', pos)) {
      var checkPos = pos + 2
      while (checkPos < len && s[checkPos] !== ']') {
        checkPos++
      }
      if (
        checkPos < len &&
        s[checkPos] === ']' &&
        checkPos + 1 < len &&
        s[checkPos + 1] === ':'
      ) {
        return pos
      }
    }
    pos++
  }
  return len
}

function parseRefContent(
  source: string,
  pos: number,
  urlNewlineCount: number
): DefinitionParseResult | null {
  const len = source.length
  let i = pos

  // Parse URL (can be in angle brackets or plain, can span multiple lines)
  // At this point, i should be at the start of the destination (after any whitespace/newline)
  // Per CommonMark spec: destination can be on the same line or following lines
  const hasAngleBrackets = i < len && source[i] === '<'
  if (hasAngleBrackets) i++

  const urlStart = i
  let urlEnd = urlStart

  // Per CommonMark spec Example 199: empty destination after colon (just whitespace/newline)
  // is invalid - should be parsed as paragraph, not reference definition
  // Also check if we hit a blank line (two consecutive newlines) - destination ends there
  if (urlStart >= len) {
    // No destination found - invalid (except for empty <>)
    if (!hasAngleBrackets) return null
    // For angle brackets, empty destination is valid
    urlEnd = urlStart
  } else if (
    urlNewlineCount > 0 &&
    urlStart < len &&
    source[urlStart] === '\n'
  ) {
    // We had a newline after colon, skipped whitespace, but found another newline
    // This means blank line after colon - empty destination, invalid
    return null
  } else {
    // Find end of URL - can span multiple lines
    // Per CommonMark spec: destination ends when we encounter:
    // 1. Closing > for angle-bracketed URLs
    // 2. Whitespace followed by title delimiter (", ', or () on same or next line
    // 3. End of input or two consecutive newlines (blank line)
    while (urlEnd < len) {
      if (hasAngleBrackets && source[urlEnd] === '>') {
        break
      }

      if (source[urlEnd] === '\n') {
        // Check if next line continues the URL or starts a title
        const nextLineStart = urlEnd + 1
        if (nextLineStart >= len) break

        // Check for blank line (two consecutive newlines)
        if (nextLineStart < len && source[nextLineStart] === '\n') {
          // Blank line - URL ends here
          break
        }

        // Skip whitespace on next line
        let checkPos = nextLineStart
        while (
          checkPos < len &&
          (source[checkPos] === ' ' || source[checkPos] === '\t')
        ) {
          checkPos++
        }

        // If next line starts with title delimiter, URL ends here
        if (checkPos < len && isTitleDelimiter(source, checkPos)) {
          break
        }

        // Per CommonMark spec: reference definitions are block-level constructs
        // If next line starts with '[', it's a new reference definition, so current one ends here
        // Stop at the newline (don't include it in the URL)
        if (checkPos < len && source[checkPos] === '[') {
          break
        }

        // Check if next line looks like a block-level construct or content that would terminate the ref definition
        // Per CommonMark spec: "No further character may occur" after title/URL
        // URLs can span multiple lines, but continuation lines should still look like URLs
        if (checkPos < len) {
          const nextChar = source[checkPos]
          if (isBlockStartAt(source, checkPos)) {
            break
          }
          // Stop if next line starts with a letter (could be content, not URL continuation)
          // URLs typically start with /, http, https, <, or are indented
          // But allow if it looks like a URL scheme (letter followed by :)
          if (nextChar >= 'a' && nextChar <= 'z') {
            // Check if it's a URL scheme (e.g., "http:", "ftp:")
            let schemeEnd = checkPos + 1
            while (
              schemeEnd < len &&
              schemeEnd < checkPos + 32 &&
              ((source[schemeEnd] >= 'a' && source[schemeEnd] <= 'z') ||
                (source[schemeEnd] >= 'A' && source[schemeEnd] <= 'Z') ||
                (source[schemeEnd] >= '0' && source[schemeEnd] <= '9') ||
                source[schemeEnd] === '+' ||
                source[schemeEnd] === '.' ||
                source[schemeEnd] === '-')
            ) {
              schemeEnd++
            }
            // If followed by ':', it's a URL scheme - allow continuation
            if (schemeEnd < len && source[schemeEnd] === ':') {
              // URL scheme - allow continuation
            } else {
              // Not a URL scheme - stop here (likely content)
              break
            }
          }
        }

        // Otherwise, continue URL on next line (skip the newline and leading whitespace)
        urlEnd = checkPos
        continue
      }

      if (
        !hasAngleBrackets &&
        (source[urlEnd] === ' ' || source[urlEnd] === '\t')
      ) {
        // Check if this whitespace is followed by a title delimiter
        let checkPos = urlEnd + 1
        while (
          checkPos < len &&
          (source[checkPos] === ' ' || source[checkPos] === '\t')
        ) {
          checkPos++
        }

        // Check if next char starts a title
        if (checkPos < len && isTitleDelimiter(source, checkPos)) {
          break
        }

        // Check if next line starts a title
        if (checkPos < len && source[checkPos] === '\n') {
          const nextLineStart = checkPos + 1
          if (nextLineStart < len && source[nextLineStart] === '\n') {
            // Blank line - URL ends here
            break
          }
          let nextLineCheck = nextLineStart
          while (
            nextLineCheck < len &&
            (source[nextLineCheck] === ' ' || source[nextLineCheck] === '\t')
          ) {
            nextLineCheck++
          }
          if (nextLineCheck < len && isTitleDelimiter(source, nextLineCheck)) {
            break
          }
        }

        // No title delimiter found - URL continues (or ends if no title)
        // Continue parsing to find title or end
      }

      urlEnd++
    }
  }

  if (hasAngleBrackets && (urlEnd >= len || source[urlEnd] !== '>')) {
    return null // No closing >
  }

  // Extract target and normalize whitespace
  // Per CommonMark spec: destination can span multiple lines
  // Leading/trailing whitespace on each line should be trimmed, but internal whitespace preserved
  // Also, we need to preserve newlines between continuation lines
  let target = source.slice(urlStart, urlEnd)

  // Normalize whitespace: trim leading/trailing whitespace from each line
  // but preserve newlines and internal whitespace
  // Per CommonMark spec: leading/trailing whitespace is trimmed from destination
  let targetLines: string[] = []
  let targetLineStart = 0
  for (let i = 0; i <= target.length; i++) {
    if (i === target.length || target[i] === '\n') {
      let line = target.slice(targetLineStart, i)
      // Trim leading/trailing whitespace from this line
      line = line.trim()
      if (line.length > 0 || targetLines.length === 0) {
        // Only add non-empty lines, or the first line even if empty (for angle brackets)
        targetLines.push(line)
        if (i < target.length) {
          targetLines.push('\n')
        }
      } else if (i < target.length) {
        // Empty continuation line - preserve as newline
        targetLines.push('\n')
      }
      targetLineStart = i + 1
    }
  }

  target = targetLines.join('')

  // Trim leading/trailing whitespace from the entire target
  target = target.trim()

  i = hasAngleBrackets ? urlEnd + 1 : urlEnd

  // Check if we stopped URL parsing because next line starts with a block construct
  // (indicating the ref definition ends here)
  // Per Example 215: ref definitions end before setext headings
  // A setext heading has content on one line, then = or - on the next line
  // We need to look ahead to detect this pattern
  var stoppedAtBlock = false
  if (i < len && source[i] === '\n') {
    var nextLineStart = i + 1
    var checkPos = nextLineStart
    while (
      checkPos < len &&
      (source[checkPos] === ' ' || source[checkPos] === '\t')
    ) {
      checkPos++
    }
    if (checkPos < len) {
      const nextChar = source[checkPos]
      if (isBlockStartAt(source, checkPos)) {
        stoppedAtBlock = true
      }
      // Per Example 215: check if this looks like a setext heading
      // Pattern: content line, then line starting with = or -
      // If next line has content (not starting with block char), check if line after that starts with = or -
      if (!stoppedAtBlock && nextChar !== '=' && nextChar !== '-') {
        // Next line might be content - check if line after that starts with = or -
        var firstLineEnd = util.findLineEnd(source, checkPos)
        if (firstLineEnd < len) {
          var secondLineStart = skipToNextLine(source, firstLineEnd)
          var secondCheckPos = secondLineStart
          while (
            secondCheckPos < len &&
            (source[secondCheckPos] === ' ' || source[secondCheckPos] === '\t')
          ) {
            secondCheckPos++
          }
          if (secondCheckPos < len) {
            var secondChar = source[secondCheckPos]
            if (secondChar === '=' || secondChar === '-') {
              // This is a setext heading pattern - ref definition should end before content line
              stoppedAtBlock = true
            }
          }
        }
      }
    }
  }

  // Per CommonMark spec: title delimiter must be separated by whitespace from destination
  // Check if we see a title delimiter immediately after destination (no whitespace)
  // This makes it invalid as a reference definition
  if (!stoppedAtBlock && i < len && isTitleDelimiter(source, i)) {
    // Title delimiter immediately after destination without whitespace - invalid
    return null
  }

  // Skip whitespace between destination and title (including optional newline)
  // Per CommonMark spec: title must be separated from destination by spaces/tabs
  // The title can be on the same line or a following line
  // Per CommonMark spec: Unicode whitespace (like non-breaking space) does NOT work for separation
  // However, if we stopped because next line starts with a block construct, don't skip past the newline
  let titleNewlineCount = 0
  while (i < len && !stoppedAtBlock) {
    const c = source[i]
    if (c === '\n') {
      titleNewlineCount++
      if (titleNewlineCount > 1) break // Only one optional newline allowed before title
      i++
      // After newline, skip leading whitespace on next line (only ASCII space/tab)
      var whitespaceStart = i
      i = util.skipWhitespace(source, i)
      // If we hit Unicode whitespace, stop
      if (
        i < len &&
        util.isUnicodeWhitespace(source[i]) &&
        source[i] !== '\n'
      ) {
        i = whitespaceStart - 1
        break
      }
      // Check if next line starts with a block construct (ref definition ends here)
      // Per Example 215: setext headings (= or -) also terminate ref definitions
      if (i < len) {
        const nextChar = source[i]
        if (isBlockStartAt(source, i)) {
          stoppedAtBlock = true
          i = whitespaceStart - 1 // Back up to the newline
          break
        }
        // Also check if this looks like a setext heading (need to look ahead to see if there's
        // a line that starts with = or - after some content)
        // For now, just checking = or - is sufficient as they're already in the block check above
      }
    } else if (c === ' ' || c === '\t') {
      i++
    } else if (util.isUnicodeWhitespace(c)) {
      // Unicode whitespace does NOT work for separation - stop here
      break
    } else {
      break
    }
  }

  // Parse optional title (can span multiple lines, but cannot contain blank lines)
  let title: string | undefined = undefined
  if (i < len) {
    const titleChar = source[i]
    var titleResult =
      titleChar === '('
        ? parseParenTitle(source, i)
        : titleChar === '"' || titleChar === "'"
          ? parseQuotedTitle(source, i, titleChar)
          : null
    if (
      titleResult === null &&
      (titleChar === '"' || titleChar === "'" || titleChar === '(')
    ) {
      return null
    }
    if (titleResult) {
      title = titleResult.value
      i = titleResult.endPos
      var afterTitlePos = i
      while (
        afterTitlePos < len &&
        (source[afterTitlePos] === ' ' || source[afterTitlePos] === '\t')
      ) {
        afterTitlePos++
      }
      if (
        afterTitlePos < len &&
        source[afterTitlePos] !== '\n' &&
        source[afterTitlePos] !== '\r'
      ) {
        return null
      }
      i = afterTitlePos
    }
  }

  // Skip trailing whitespace
  i = util.skipWhitespace(source, i)

  // Must end at newline or end of input
  // Per CommonMark spec: no further character may occur after title
  // Per Example 210: if there's text after the title on the same line, it's invalid
  // The title parsing already handles this - if title is found, i points to after the closing delimiter
  // We just need to ensure there's no non-whitespace before the newline
  if (i < len && source[i] !== '\n') {
    // Check if there's non-whitespace before the newline
    var checkEndPos = i
    while (checkEndPos < len && source[checkEndPos] !== '\n') {
      if (source[checkEndPos] !== ' ' && source[checkEndPos] !== '\t') {
        // Found non-whitespace after title - invalid reference definition
        return null
      }
      checkEndPos++
    }
  }

  // Also check: if no title was found, make sure we're at end of line or there's trailing text
  // Per Example 210: `[foo]: /url\n"title" ok` - the "title" ok is trailing text, should invalidate
  if (title === undefined && i < len && source[i] !== '\n') {
    // No title found, but there's content after destination - check if it's just whitespace
    var checkTrailingPos = i
    while (checkTrailingPos < len && source[checkTrailingPos] !== '\n') {
      if (
        source[checkTrailingPos] !== ' ' &&
        source[checkTrailingPos] !== '\t'
      ) {
        // Found non-whitespace after destination - invalid reference definition
        return null
      }
      checkTrailingPos++
    }
  }

  return {
    endPos: i < len && source[i] === '\n' ? i + 1 : i,
    target: target,
    title: title,
  }
}

function parseFootnoteContent(
  source: string,
  pos: number
): DefinitionParseResult | null {
  // pos is already after the colon and whitespace
  let contentStart = pos
  let contentEnd = scanFootnoteEnd(source, pos)
  let stoppedAtBlankLine =
    contentEnd < source.length &&
    source[contentEnd] === '\n' &&
    source[contentEnd + 1] === '\n'

  // Extract the footnote content (from after ']:' to before next footnote or end)
  let extractEnd = contentEnd

  // pos is already after the colon and whitespace, so we can use it directly
  let contentStartPos = pos

  // Process lines directly without splitting to avoid intermediate array allocation
  var processedParts: string[] = []
  let lineStart = contentStartPos
  let lineIndex = 0
  let prevWasBlank = false

  while (lineStart < extractEnd) {
    // Find line end - use findLineEnd to properly handle CRLF
    let lineEnd = util.findLineEnd(source, lineStart)
    if (lineEnd > extractEnd) lineEnd = extractEnd

    // Extract and process line
    if (lineIndex === 0) {
      // First line - trim trailing whitespace only
      let trimmedEnd = lineEnd
      while (
        trimmedEnd > lineStart &&
        (source[trimmedEnd - 1] === ' ' || source[trimmedEnd - 1] === '\t')
      ) {
        trimmedEnd--
      }
      // Build first line
      let firstLineStr = source.slice(lineStart, trimmedEnd)
      processedParts.push(firstLineStr)
      // Check if first line is blank
      prevWasBlank = firstLineStr.length === 0
    } else {
      // Check indentation on current line
      let leadingSpaceCount = 0
      let checkPos = lineStart
      while (
        checkPos < lineEnd &&
        checkPos < lineStart + 4 &&
        source[checkPos] === ' '
      ) {
        leadingSpaceCount++
        checkPos++
      }

      // Check if current line is blank
      let lineHasContent = false
      for (let k = lineStart; k < lineEnd; k++) {
        if (source[k] !== ' ' && source[k] !== '\t' && source[k] !== '\r') {
          lineHasContent = true
          break
        }
      }
      let currentIsBlank = !lineHasContent

      // Process continuation line based on indentation rules
      if (leadingSpaceCount >= 4 && prevWasBlank) {
        // 4+ spaces after a blank line - this is a paragraph, preserve indentation
        processedParts.push(source.slice(lineStart, lineEnd))
      } else if (leadingSpaceCount === 4 && !prevWasBlank) {
        // Exactly 4 spaces without blank line - remove (markdown continuation indentation)
        processedParts.push(source.slice(lineStart + 4, lineEnd))
      } else {
        // Otherwise preserve (less than 4 spaces or more than 4 spaces without blank line)
        processedParts.push(source.slice(lineStart, lineEnd))
      }

      // Update prevWasBlank for next iteration
      prevWasBlank = currentIsBlank
    }

    // Move to next line
    if (lineEnd < extractEnd) {
      const charAtEnd = charCode(source, lineEnd)
      if (charAtEnd === $.CHAR_CR || charAtEnd === $.CHAR_NEWLINE) {
        processedParts.push('\n')
        lineStart = skipToNextLine(source, lineEnd)
      } else {
        lineStart = extractEnd
      }
    } else {
      lineStart = extractEnd
    }
    lineIndex++
  }

  let footnoteContent = processedParts.join('')

  // Trim trailing whitespace/newlines but preserve internal structure
  // If we stopped at a blank line, remove the trailing newline from the last line
  if (stoppedAtBlankLine) {
    // Remove trailing newline if present (but preserve newlines between lines)
    footnoteContent = footnoteContent.replace(/\n$/, '')
  }
  var contentLen = footnoteContent.length
  while (contentLen > 0) {
    var lastChar = footnoteContent[contentLen - 1]
    if (lastChar === '\n' || lastChar === ' ') {
      contentLen--
    } else {
      break
    }
  }
  if (contentLen < footnoteContent.length) {
    footnoteContent = footnoteContent.slice(0, contentLen)
  }

  return {
    endPos: contentEnd,
    target: footnoteContent,
    title: undefined,
  }
}

export function parseDefinition(
  source: string,
  pos: number,
  state: MarkdownToJSX.State,
  options: ParseOptions,
  isFootnote: boolean
): ParseResult | null {
  debug('parse', isFootnote ? 'footnote' : 'ref', state)
  if (source[pos] !== '[') return null
  var hasCaret = pos + 1 < source.length && source[pos + 1] === '^'
  if (isFootnote ? !hasCaret : hasCaret) return null

  var lineStart = pos
  while (lineStart > 0 && source[lineStart - 1] !== '\n') lineStart--
  if (
    calculateIndent(source, lineStart, pos).spaceEquivalent >= 4 ||
    state.inline
  )
    return null

  var labelStart = pos + (isFootnote ? 2 : 1)
  var len = source.length
  var refEnd = findUnescapedChar(source, labelStart, len, ']')
  if (refEnd === -1) return null
  var ref = source.slice(labelStart, refEnd)
  if (ref.length > 999) return null

  var hasNonWhitespace = false,
    hasUnescapedBracket = false,
    labelHasNewlines = false
  for (var j = 0; j < ref.length; j++) {
    var c = ref[j]
    if (c === '\\' && j + 1 < ref.length) {
      j++
      continue
    }
    var cCode = charCode(c)
    if (cCode === $.CHAR_BRACKET_OPEN || cCode === $.CHAR_BRACKET_CLOSE) {
      hasUnescapedBracket = true
    } else if (cCode === $.CHAR_NEWLINE || cCode === $.CHAR_CR) {
      labelHasNewlines = true
    } else if (cCode !== $.CHAR_SPACE && cCode !== $.CHAR_TAB) {
      hasNonWhitespace = true
    }
  }
  if (!hasNonWhitespace || hasUnescapedBracket) return null

  var i = refEnd + 1
  if (labelHasNewlines) {
    var labelStartCode = charCode(source, labelStart)
    var refEndPrevCode = charCode(source, refEnd - 1)
    if (
      labelStartCode === $.CHAR_NEWLINE ||
      labelStartCode === $.CHAR_CR ||
      refEndPrevCode === $.CHAR_NEWLINE ||
      refEndPrevCode === $.CHAR_CR ||
      i >= len ||
      source[i] !== ':'
    )
      return null
  } else {
    if (i >= len || source[i] !== ':') {
      i = util.skipWhitespace(source, i)
      if (i < len && charCode(source, i) === $.CHAR_NEWLINE)
        i = util.skipWhitespace(source, i + 1)
      if (i >= len || source[i] !== ':') return null
    }
  }
  i++

  var urlNewlineCount = 0
  while (i < len) {
    var iCode = charCode(source, i)
    if (iCode === $.CHAR_NEWLINE) {
      if (++urlNewlineCount > 1) break
      i = util.skipWhitespace(source, i + 1)
    } else if (iCode === $.CHAR_SPACE || iCode === $.CHAR_TAB) {
      i++
    } else {
      break
    }
  }

  const contentResult = isFootnote
    ? parseFootnoteContent(source, i)
    : parseRefContent(source, i, urlNewlineCount)
  if (!contentResult) return null

  const normalizedRef = normalizeReferenceLabel(ref)
  const refs = state.refs || {}
  const storageKey = isFootnote ? `^${normalizedRef}` : normalizedRef
  if (!refs[storageKey]) {
    refs[storageKey] = {
      target: unescapeUrlOrTitle(contentResult.target.trim()),
      title: contentResult.title
        ? unescapeUrlOrTitle(contentResult.title)
        : undefined,
    }
    state.refs = refs
  }

  return {
    type: isFootnote ? RuleType.footnote : RuleType.ref,
    endPos: contentResult.endPos,
  } as (MarkdownToJSX.ReferenceNode | MarkdownToJSX.FootnoteNode) & {
    endPos: number
  }
}

// Delimiter stack entry for CommonMark spec delimiter stack algorithm
interface DelimiterEntry {
  nodeIndex: number // Index in result array where this delimiter text node is
  type: '*' | '_' | '~' | '='
  length: number // Number of delimiters in the run
  canOpen: boolean // Whether this delimiter can open emphasis
  canClose: boolean // Whether this delimiter can close emphasis
  active: boolean // Whether this delimiter is active
  sourcePos: number // Source position where this delimiter starts (for overlap detection)
  inAnchor: boolean // Whether this delimiter was collected inside a link (should not match with delimiters outside)
}

// Process emphasis using delimiter stack algorithm per CommonMark spec
function processEmphasis(
  nodes: MarkdownToJSX.ASTNode[],
  delimiterStack: DelimiterEntry[],
  stackBottom: number | null
): void {
  // openers_bottom for each delimiter type, indexed by numeric key: typeCode * 6 + (length % 3) * 2 + (canOpen ? 1 : 0)
  // Type codes: '*' = 0, '_' = 1, '~' = 2, '=' = 3
  var openersBottom: number[] = []

  var currentPosition = stackBottom === null ? 0 : stackBottom + 1

  while (currentPosition < delimiterStack.length) {
    var closer = delimiterStack[currentPosition]
    if (
      !closer ||
      (closer.type !== '*' &&
        closer.type !== '_' &&
        closer.type !== '~' &&
        closer.type !== '=')
    ) {
      currentPosition++
      continue
    }

    if (!closer.canClose || !closer.active) {
      currentPosition++
      continue
    }

    // Convert type to numeric code: '*' = 0, '_' = 1, '~' = 2, '=' = 3
    var typeCode =
      closer.type === '*'
        ? 0
        : closer.type === '_'
          ? 1
          : closer.type === '~'
            ? 2
            : 3
    var openersBottomKey =
      typeCode * 6 + (closer.length % 3) * 2 + (closer.canOpen ? 1 : 0)
    var openersBottomIndex =
      openersBottom[openersBottomKey] !== undefined
        ? openersBottom[openersBottomKey]
        : stackBottom === null
          ? -1
          : stackBottom

    var openerIndex = -1
    var closerType = closer.type
    var closerInAnchor = closer.inAnchor
    var closerCanOpen = closer.canOpen
    var closerLength = closer.length
    var closerLengthMod3 = closerLength % 3

    for (var i = currentPosition - 1; i > openersBottomIndex; i--) {
      var candidate = delimiterStack[i]
      if (
        !candidate ||
        !candidate.active ||
        candidate.type !== closerType ||
        !candidate.canOpen ||
        candidate.inAnchor !== closerInAnchor
      )
        continue
      var openerLength = candidate.length
      if (
        (!closerCanOpen && !candidate.canClose) ||
        closerLengthMod3 === 0 ||
        (openerLength + closerLength) % 3 !== 0
      ) {
        openerIndex = i
        break
      }
    }

    if (openerIndex >= 0) {
      var opener = delimiterStack[openerIndex]
      var openerLength = opener.length

      // Determine if emphasis or strong emphasis (both must have length >= 2 for strong)
      var isStrong = openerLength >= 2 && closerLength >= 2
      var delimitersToRemove = isStrong ? 2 : 1
      if (
        delimitersToRemove > openerLength ||
        delimitersToRemove > closerLength
      ) {
        currentPosition++
        continue
      }

      var openerNodeIndex = opener.nodeIndex
      var closerNodeIndex = closer.nodeIndex
      var contentStartIndex = openerNodeIndex + 1
      var contentEndIndex = closerNodeIndex
      var contentNodes = nodes.slice(contentStartIndex, contentEndIndex)

      // Remove content nodes from nodes array (they'll be in the emphasis node)
      if (contentNodes.length > 0) {
        var nodesRemoved = contentEndIndex - contentStartIndex
        nodes.splice(contentStartIndex, nodesRemoved)
        for (var k = 0; k < delimiterStack.length; k++) {
          if (delimiterStack[k].nodeIndex > contentStartIndex)
            delimiterStack[k].nodeIndex -= nodesRemoved
        }
        if (closerNodeIndex > contentStartIndex) closerNodeIndex -= nodesRemoved
      }

      var emphasisTag =
        opener.type === '~'
          ? 'del'
          : opener.type === '='
            ? 'mark'
            : isStrong
              ? 'strong'
              : 'em'
      var emphasisNode: MarkdownToJSX.FormattedTextNode = {
        type: RuleType.textFormatted,
        tag: emphasisTag,
        children: contentNodes,
      }

      var openerNode = nodes[openerNodeIndex] as MarkdownToJSX.TextNode
      if (!openerNode || !openerNode.text) {
        opener.active = closer.active = false
        continue
      }

      // Remove delimiters from opener text node
      var openerRemoved = openerNode.text.length <= delimitersToRemove
      if (openerRemoved) {
        nodes.splice(openerNodeIndex, 1)
        for (var k = 0; k < delimiterStack.length; k++) {
          if (delimiterStack[k].nodeIndex > openerNodeIndex)
            delimiterStack[k].nodeIndex--
        }
        if (closerNodeIndex > openerNodeIndex) closerNodeIndex--
      } else {
        openerNode.text = openerNode.text.slice(delimitersToRemove)
      }

      var closerNode = nodes[closerNodeIndex] as MarkdownToJSX.TextNode
      if (!closerNode || !closerNode.text) {
        opener.active = closer.active = false
        continue
      }
      var closerRemoved = closerNode.text.length <= delimitersToRemove
      if (closerRemoved) {
        nodes.splice(closerNodeIndex, 1)
        for (var k = 0; k < delimiterStack.length; k++) {
          if (delimiterStack[k].nodeIndex > closerNodeIndex)
            delimiterStack[k].nodeIndex--
        }
      } else {
        closerNode.text = closerNode.text.slice(delimitersToRemove)
      }

      // Insert emphasis node after opener (or at the position where opener was)
      var insertIndex = openerRemoved
        ? openerNodeIndex < closerNodeIndex
          ? closerNodeIndex - 1
          : openerNodeIndex
        : openerNodeIndex + 1
      if (insertIndex < 0 || insertIndex > nodes.length)
        insertIndex = insertIndex < 0 ? 0 : nodes.length
      nodes.splice(insertIndex, 0, emphasisNode)

      // Update node indices in delimiter stack after insertion
      for (var k = 0; k < delimiterStack.length; k++) {
        if (delimiterStack[k].nodeIndex >= insertIndex) {
          delimiterStack[k].nodeIndex++
        }
      }

      // Remove delimiters between opener and closer from stack
      for (var k = openerIndex + 1; k < currentPosition; k++) {
        delimiterStack[k].active = false
      }

      // Update opener and closer in stack
      if (openerRemoved) {
        opener.active = false
      } else {
        opener.length -= delimitersToRemove
        if (opener.length === 0) opener.active = false
      }

      if (closerRemoved) {
        closer.active = false
        currentPosition++
      } else {
        closer.length -= delimitersToRemove
        if (closer.length === 0) {
          closer.active = false
          currentPosition++
        }
      }
    } else {
      // No opener found
      openersBottom[openersBottomKey] = currentPosition - 1
      if (!closer.canOpen) {
        closer.active = false
      }
      currentPosition++
    }
  }

  // Remove inactive delimiters from stack (O(n) shift algorithm instead of O(n²) splice)
  var writeIndex = 0
  for (var i = 0; i < delimiterStack.length; i++) {
    if (delimiterStack[i].active) {
      delimiterStack[writeIndex++] = delimiterStack[i]
    }
  }
  delimiterStack.length = writeIndex
}

export function parseMarkdown(
  input: string,
  state: MarkdownToJSX.State,
  options: ParseOptions
): MarkdownToJSX.ASTNode[] {
  var result: MarkdownToJSX.ASTNode[] = []
  var pos = 0
  var REF_CHECK_UNSET = -3
  var cachedRefCheckPos = REF_CHECK_UNSET

  // If inline mode, just parse the entire input as inline content
  if (state.inline)
    return parseInlineSpan(input, 0, input.length, state, options)

  // Block parsing mode

  // Check for frontmatter at the beginning (skip if doesn't start with ---)
  if (pos === 0 && input.startsWith('---')) {
    trackBlockAttempt('frontmatter')
    var frontmatterResult = parseFrontmatter(input, pos)
    if (frontmatterResult) {
      trackBlockHit('frontmatter')
      result.push(frontmatterResult)
      pos = frontmatterResult.endPos
    }
  }

  while (pos < input.length) {
    trackBlockParseIteration()

    // Skip leading newlines (but preserve whitespace for indented code blocks)
    while (pos < input.length && input[pos] === '\n') {
      pos++
      trackOperation()
    }

    if (pos >= input.length) break
    cachedRefCheckPos = REF_CHECK_UNSET

    const char = input[pos]

    // Try parseBlock first (handles indentation and tries all block parsers)
    // Note: Individual parsers called by parseBlock track their own attempts
    const parseResult = parseBlock(input, pos, state, options)
    if (parseResult) {
      const t = parseResult.type
      if (t === RuleType.codeBlock) {
        var isFenced = char === '`' || char === '~'
        if (!isFenced && (char === ' ' || char === '\t')) {
          const lineEnd = util.findLineEnd(input, pos)
          const indentInfo = calculateIndent(input, pos, lineEnd)
          isFenced =
            indentInfo.spaceEquivalent <= 3 &&
            pos + indentInfo.charCount < input.length &&
            (input[pos + indentInfo.charCount] === '`' ||
              input[pos + indentInfo.charCount] === '~')
        }
        trackBlockHit(isFenced ? 'codeFenced' : 'codeBlock')
      } else if (t === RuleType.breakThematic) {
        trackBlockHit('breakThematic')
      } else if (t === RuleType.blockQuote) {
        trackBlockHit('blockQuote')
      } else if (t === RuleType.heading) {
        trackBlockHit('heading')
      } else if (t === RuleType.orderedList || t === RuleType.unorderedList) {
        trackBlockHit('list')
      } else if (t === RuleType.table) {
        trackBlockHit('table')
      } else if (t === RuleType.htmlComment) {
        trackBlockHit('htmlComment')
      } else if (t === RuleType.htmlBlock) {
        trackBlockHit('htmlBlock')
      } else if (t === RuleType.ref) {
        trackBlockHit('ref')
      }

      // Special handling for HTML comments with trailing content
      if (parseResult.type === RuleType.htmlComment) {
        result.push(parseResult)
        const htmlCheckPos = pos
        pos = parseResult.endPos

        // Per CommonMark spec Example 177: HTML comment blocks end at --> on the same line
        // If there's content after --> on the same line, it should be treated as literal text
        const commentLineEnd = util.findLineEnd(input, htmlCheckPos)
        if (pos < commentLineEnd) {
          const textContent = input.slice(pos, commentLineEnd)
          if (textContent.trim().length > 0) {
            result.push({
              type: RuleType.text,
              text: textContent,
            } as MarkdownToJSX.TextNode)
          }
          pos = commentLineEnd
          if (pos < input.length && input[pos] === '\n') {
            pos++
          }
        }
        continue
      }
      // Special handling for HTML self-closing closing tags
      if (
        parseResult.type === RuleType.htmlBlock ||
        parseResult.type === RuleType.htmlSelfClosing
      ) {
        const isSelfClosingClosingTag =
          parseResult.type === RuleType.htmlSelfClosing &&
          parseResult.isClosingTag === true
        if (isSelfClosingClosingTag && !state.inline && !state.inHTML) {
          // Don't match, fall through to other parsers
        } else {
          result.push(parseResult)
          pos = parseResult.endPos
          continue
        }
      } else {
        result.push(parseResult)
        pos = parseResult.endPos
        continue
      }
    }

    // Reference definition - check BEFORE setext heading to prevent conflicts
    // Reference definitions take precedence over setext headings (e.g., [foo]: /url\n===)
    let refCheckPos =
      cachedRefCheckPos !== REF_CHECK_UNSET ? cachedRefCheckPos : pos
    if (cachedRefCheckPos === REF_CHECK_UNSET) {
      if (isSpaceOrTab(char)) {
        const lineEnd = util.findLineEnd(input, pos)
        const indentInfo = calculateIndent(input, pos, lineEnd)
        const checkPos = pos + indentInfo.charCount
        if (
          indentInfo.spaceEquivalent <= 3 &&
          checkPos < input.length &&
          input[checkPos] === '['
        ) {
          refCheckPos = checkPos
        } else {
          refCheckPos = -1
        }
      } else if (char === '[') {
        refCheckPos = pos
      } else {
        refCheckPos = -1
      }
      cachedRefCheckPos = refCheckPos
    }

    if (
      refCheckPos >= 0 &&
      refCheckPos + 1 < input.length &&
      input[refCheckPos + 1] === '^'
    ) {
      refCheckPos = -1
    }

    if (refCheckPos >= 0) {
      trackBlockAttempt('ref')
      const parseResult = parseDefinition(
        input,
        refCheckPos,
        state,
        options,
        false
      )
      if (parseResult) {
        trackBlockHit('ref')
        result.push(parseResult)
        pos = parseResult.endPos
        continue
      }
      // parseDefinition returned null - check if this is an invalid reference definition that should be skipped
      // Per CommonMark Examples 208 and 210: certain invalid reference definitions should be skipped entirely
      const skipResult = shouldSkipInvalidReferenceDefinition(
        input,
        refCheckPos,
        pos === 0
      )
      if (skipResult.shouldSkip) {
        pos = skipResult.newPos
        continue
      }
    }

    // Heading (Setext style) - check after reference definitions
    const setextResult = parseHeadingSetext(input, pos, state, options)
    if (setextResult) {
      trackBlockHit('headingSetext')
      result.push(setextResult)
      pos = setextResult.endPos
      continue
    }

    // Footnote definition (skip leading whitespace)
    let footnoteCheckPos = pos
    if (isSpaceOrTab(input[footnoteCheckPos])) {
      const lineEnd = util.findLineEnd(input, pos)
      const indentInfo = calculateIndent(input, pos, lineEnd)
      footnoteCheckPos = pos + indentInfo.charCount
    }
    if (
      footnoteCheckPos < input.length &&
      input[footnoteCheckPos] === '[' &&
      footnoteCheckPos + 1 < input.length &&
      input[footnoteCheckPos + 1] === '^'
    ) {
      trackBlockAttempt('footnote')
      const footnoteResult = parseDefinition(
        input,
        footnoteCheckPos,
        state,
        options,
        true
      )
      if (footnoteResult) {
        trackBlockHit('footnote')
        pos = footnoteResult.endPos
        continue
      }
    }

    // Paragraph (fallback for any remaining content)
    trackBlockAttempt('paragraph')
    const paragraphResult = parseParagraph(input, pos, state, options)
    if (paragraphResult) {
      trackBlockHit('paragraph')
      result.push(paragraphResult)
      pos = paragraphResult.endPos
      continue
    }

    // If nothing matched, advance by one character to avoid infinite loop
    trackBlockAttempt('noMatch')
    trackBlockHit('noMatch')
    pos++
  }

  // Note: Memory snapshot "After block parsing" is taken in compiler function
  // after parseMarkdown returns, not here

  // Footnotes footer is appended during rendering phase (not in AST)
  // Footnotes are stored in refs with '^' prefix and extracted during rendering

  // Collect all refs from state.refs (populated during parsing) and create a reference collection node
  // Reference nodes stay in their original positions, but we prepend a collection node
  // Include footnotes (keys starting with '^') so the renderer can handle them
  const allRefs = state.refs || {}
  const collectedRefs: {
    [key: string]: { target: string; title: string | undefined }
  } = {}
  for (const key in allRefs) {
    collectedRefs[key] = allRefs[key]
  }

  // Prepend reference collection node if we have any refs
  if (util.hasKeys(collectedRefs)) {
    const refCollectionNode: MarkdownToJSX.ReferenceCollectionNode = {
      type: RuleType.refCollection,
      refs: collectedRefs,
    }
    return [refCollectionNode, ...result]
  }

  return result
}

/**
 * Collect reference definitions from markdown input and populate the refs object.
 * This function scans the markdown for reference-style link and image definitions.
 *
 * @param input - The markdown string to scan
 * @param refs - Object to populate with reference definitions
 * @param options - Parser options
 */
export function collectReferenceDefinitions(
  input: string,
  refs: { [key: string]: { target: string; title: string | undefined } },
  options: ParseOptions
): void {
  var pos = 0
  var canStartRef = true
  const len = input.length

  while (pos < len) {
    var newlines = 0
    // Count consecutive newlines more efficiently
    while (pos < len && charCode(input, pos) === $.CHAR_NEWLINE) {
      newlines++
      pos++
    }
    if (pos >= len) break
    if (newlines > 0) canStartRef = true

    // Skip fenced code
    const currentCharCode = charCode(input, pos)
    if (
      currentCharCode === $.CHAR_BACKTICK ||
      currentCharCode === $.CHAR_TILDE
    ) {
      var fence = parseCodeFenced(input, pos, { inline: false }, options)
      if (fence) {
        pos = fence.endPos
        canStartRef = true
        continue
      }
    }

    // Try parse ref (up to 3 space indent)
    var refPos = pos
    var indent = 0
    while (refPos < len && indent < 4) {
      const code = charCode(input, refPos)
      if (code === $.CHAR_SPACE) {
        indent++
        refPos++
      } else if (code === $.CHAR_TAB) {
        indent += 4 - (indent % 4)
        refPos++
      } else {
        break
      }
    }

    if (
      indent < 4 &&
      refPos < len &&
      charCode(input, refPos) === $.CHAR_BRACKET_OPEN &&
      canStartRef
    ) {
      if (refPos + 1 < len && charCode(input, refPos + 1) === $.CHAR_CARET) {
        canStartRef = false
        var lineEnd = util.findLineEnd(input, pos)
        pos = lineEnd >= len ? len : skipToNextLine(input, lineEnd)
        continue
      } else {
        var result = parseDefinition(
          input,
          refPos,
          { inline: false, refs },
          options,
          false
        )
        if (result) {
          pos = result.endPos
          canStartRef = true
          continue
        }
        // parseDefinition returned null - check if colon exists (invalid ref attempt) vs paragraph content
        var lineEnd = util.findLineEnd(input, pos)
        var colonPos = input.indexOf(':', refPos + 1)
        if (colonPos === -1 || colonPos >= lineEnd) {
          var indentInfo = calculateIndent(input, pos, lineEnd)
          if (
            !isBlankLineCheck(input, pos, lineEnd) &&
            currentCharCode !== $.CHAR_HASH &&
            currentCharCode !== $.CHAR_GT &&
            currentCharCode !== $.CHAR_DASH &&
            currentCharCode !== $.CHAR_EQ &&
            indentInfo.spaceEquivalent < 4
          ) {
            canStartRef = false
          }
        }
        pos = lineEnd >= len ? len : skipToNextLine(input, lineEnd)
        continue
      }
    }

    // Scan blockquotes for nested refs
    if (currentCharCode === $.CHAR_GT && canStartRef) {
      var bqEnd = pos
      var bqLines = []
      while (bqEnd < len) {
        var lineEnd = util.findLineEnd(input, bqEnd)
        var quotePos = bqEnd
        while (quotePos < lineEnd) {
          const code = charCode(input, quotePos)
          if (code === $.CHAR_SPACE || code === $.CHAR_TAB) {
            quotePos++
          } else {
            break
          }
        }
        if (quotePos >= lineEnd || charCode(input, quotePos) !== $.CHAR_GT)
          break

        var contentStart = quotePos + 1
        if (
          contentStart < lineEnd &&
          (charCode(input, contentStart) === $.CHAR_SPACE ||
            charCode(input, contentStart) === $.CHAR_TAB)
        )
          contentStart++
        bqLines.push(input.slice(contentStart, lineEnd))
        bqEnd = skipToNextLine(input, lineEnd)
      }
      if (bqLines.length) {
        collectReferenceDefinitions(bqLines.join('\n'), refs, options)
        pos = bqEnd
        canStartRef = true
        continue
      }
    }

    var lineEnd = util.findLineEnd(input, pos)
    if (lineEnd >= len) {
      pos = len
    } else {
      var isCurrentLineBlank = isBlankLineCheck(input, pos, lineEnd)
      var indentInfo = calculateIndent(input, pos, lineEnd)
      pos = skipToNextLine(input, lineEnd)
      canStartRef =
        currentCharCode === $.CHAR_HASH ||
        currentCharCode === $.CHAR_GT ||
        currentCharCode === $.CHAR_DASH ||
        currentCharCode === $.CHAR_EQ ||
        isCurrentLineBlank ||
        indentInfo.spaceEquivalent >= 4
    }
  }
}

/**
 * Given a markdown string, return an abstract syntax tree (AST) of the markdown.
 *
 * The first node in the AST is a reference collection node. This node contains all the
 * reference definitions found in the markdown. These reference definitions are used to
 * resolve reference links and images in the markdown.
 *
 * @lang zh 给定一个 Markdown 字符串，返回 Markdown 的抽象语法树 (AST)。
 *
 * AST 中的第一个节点是引用集合节点。此节点包含在 Markdown 中找到的所有引用定义。这些引用定义用于解析 Markdown 中的引用链接和图像。
 * @lang hi एक Markdown स्ट्रिंग दी गई है, Markdown का अमूर्त सिंटैक्स ट्री (AST) लौटाता है।
 *
 * AST में पहला नोड संदर्भ संग्रह नोड है। यह नोड Markdown में पाई गई सभी संदर्भ परिभाषाएं शामिल करता है। ये संदर्भ परिभाषाएं Markdown में संदर्भ लिंक्स और छवियों को पार्स करने के लिए उपयोग की जाती हैं।
 *
 * @param source - The markdown string to parse.
 * @lang zh @param source - 要解析的 Markdown 字符串。
 * @lang hi @param source - पार्स करने के लिए Markdown स्ट्रिंग।
 * @param options - The options for the parser.
 * @lang zh @param options - 解析器的选项。
 * @lang hi @param options - पार्सर के लिए विकल्प।
 * @returns The AST of the markdown.
 * @lang zh @returns Markdown 的 AST。
 * @lang hi @returns Markdown का AST।
 */
export function parser(
  source: string,
  options?: MarkdownToJSX.Options
): MarkdownToJSX.ASTNode[] {
  // Strip BOM (U+FEFF) at document start per CommonMark spec
  if (source.charCodeAt(0) === 0xfeff) {
    source = source.slice(1)
  }

  // Normalize input: replace null bytes with U+FFFD per CommonMark spec
  source = util.normalizeInput(source)

  // Default state
  const defaultState: MarkdownToJSX.State = { inline: false, refs: {} }
  const finalState = { ...defaultState }

  // Normalize options - convert MarkdownToJSX.Options to ParseOptions
  const finalOptions: ParseOptions = {
    ...options,
    slugify: options?.slugify
      ? (input: string) => options.slugify(input, util.slugify)
      : util.slugify,
    sanitizer: options?.sanitizer || util.sanitizer,
    tagfilter: options?.tagfilter !== false,
  }

  // Collect reference definitions if not in inline mode
  if (!finalState.inline) {
    collectReferenceDefinitions(source, finalState.refs || {}, finalOptions)
  }

  // Parse markdown
  const astNodes = parseMarkdown(source, finalState, finalOptions)

  return astNodes
}
