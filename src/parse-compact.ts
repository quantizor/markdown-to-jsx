/**
 * Compact Table-Driven Markdown Parser
 * 
 * This parser uses tables and generic scanners instead of specialized functions
 * to achieve dramatic code size reduction while maintaining CommonMark compliance.
 */

import { RuleType, type MarkdownToJSX } from './types'
import * as $ from './constants'
import * as util from './utils'

// ============================================================================
// EXPORTS FOR REACT.TSX COMPATIBILITY
// ============================================================================

// Type export
export type ParseOptions = Omit<MarkdownToJSX.Options, 'slugify'> & {
  slugify: (input: string) => string
  sanitizer: (tag: string, attr: string, value: string) => string | null
  tagfilter: boolean
  forceBlock?: boolean
  streaming?: boolean
}

// Regex exports
export const HTML_BLOCK_ELEMENT_START_R_ATTR: RegExp =
  /^<([a-zA-Z][a-zA-Z0-9-]*)\s+[^>]*>/
export const UPPERCASE_TAG_R: RegExp = /^<[A-Z]/
export const INTERPOLATION_R: RegExp = /^\{.*\}$/
export const UNESCAPE_R: RegExp = /\\(.)/g

// HTML Type 1 tags (raw HTML blocks)
const TYPE1_TAGS = new Set([
  'script', 'pre', 'style', 'textarea'
])

export function isType1Block(tagLower: string): boolean {
  return TYPE1_TAGS.has(tagLower)
}

// Parse an HTML tag at position
export function parseHTMLTag(
  source: string,
  pos: number
): { tag: string; attrs: Record<string, string>; selfClosing: boolean; end: number; rawAttrs?: string } | null {
  if (source.charCodeAt(pos) !== 60) return null // <
  
  let i = pos + 1
  const len = source.length
  
  // Check for closing tag
  const isClosing = source.charCodeAt(i) === 47 // /
  if (isClosing) i++
  
  // Get tag name
  const tagStart = i
  while (i < len) {
    const c = source.charCodeAt(i)
    if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57) || c === 45) {
      i++
    } else {
      break
    }
  }
  if (i === tagStart) return null
  
  const tag = source.slice(tagStart, i) // Keep original case for custom components
  const attrs: Record<string, string> = {}
  const attrStartPos = i  // Track where attributes start for rawAttrs
  
  // Skip whitespace and parse attributes
  while (i < len) {
    // Skip whitespace
    while (i < len && (source.charCodeAt(i) === 32 || source.charCodeAt(i) === 9 || source.charCodeAt(i) === 10)) i++
    
    const c = source.charCodeAt(i)
    if (c === 62) { // >
      // Preserve raw attributes (from after tag name to before >)
      const rawAttrs = source.slice(attrStartPos, i)
      return { tag, attrs, selfClosing: false, end: i + 1, rawAttrs }
    }
    if (c === 47 && i + 1 < len && source.charCodeAt(i + 1) === 62) { // />
      const rawAttrs = source.slice(attrStartPos, i)
      return { tag, attrs, selfClosing: true, end: i + 2, rawAttrs }
    }
    
    // Parse attribute name
    const attrStart = i
    while (i < len) {
      const ac = source.charCodeAt(i)
      if (ac === 61 || ac === 62 || ac === 32 || ac === 9 || ac === 10 || ac === 47) break
      i++
    }
    if (i === attrStart) break
    const attrName = source.slice(attrStart, i)
    
    // Skip whitespace
    while (i < len && (source.charCodeAt(i) === 32 || source.charCodeAt(i) === 9)) i++
    
    // Check for =
    if (source.charCodeAt(i) !== 61) {
      attrs[attrName] = ''
      continue
    }
    i++ // skip =
    
    // Skip whitespace
    while (i < len && (source.charCodeAt(i) === 32 || source.charCodeAt(i) === 9)) i++
    
    // Parse value
    const quote = source.charCodeAt(i)
    if (quote === 34 || quote === 39) { // " or '
      i++
      const valueStart = i
      while (i < len && source.charCodeAt(i) !== quote) i++
      attrs[attrName] = source.slice(valueStart, i)
      if (i < len) i++ // skip closing quote
    } else {
      const valueStart = i
      while (i < len) {
        const vc = source.charCodeAt(i)
        if (vc === 32 || vc === 9 || vc === 62 || vc === 10) break
        i++
      }
      attrs[attrName] = source.slice(valueStart, i)
    }
  }
  
  return null
}

// Collect reference definitions in first pass
export function collectReferenceDefinitions(
  input: string,
  refs: { [key: string]: { target: string; title: string | undefined } },
  _options: ParseOptions
): void {
  let pos = 0
  const len = input.length
  let inParagraph = false // Track if we're in a paragraph (have seen non-ref content)
  
  while (pos < len) {
    // Skip to next line starting with [
    const lineStart = pos
    const lineEnd = input.indexOf('\n', pos)
    const end = lineEnd < 0 ? len : lineEnd
    
    // Skip leading whitespace (up to 3 spaces)
    let i = pos
    let spaces = 0
    while (i < end && spaces < 4) {
      if (input.charCodeAt(i) === 32) { spaces++; i++ }
      else if (input.charCodeAt(i) === 9) { spaces += 4; i++ }
      else break
    }
    
    // Check for blank line - resets paragraph state
    if (i >= end) {
      inParagraph = false
      pos = lineEnd < 0 ? len : lineEnd + 1
      continue
    }
    
    // Check for [
    if (!inParagraph && spaces < 4 && i < end && input.charCodeAt(i) === 91) {
      // Try to parse reference definition
      const result = parseRefDef(input, i, refs)
      if (result) {
        pos = result
        continue
      }
    }
    
    // If we get here and this line has content, we're in a paragraph
    if (i < end) {
      inParagraph = true
    }
    
    // Move to next line
    pos = lineEnd < 0 ? len : lineEnd + 1
  }
}

// Parse a reference definition [label]: url "title" or footnote [^id]: content
function parseRefDef(
  s: string,
  p: number,
  refs: { [key: string]: { target: string; title: string | undefined } }
): number | null {
  const len = s.length
  if (s.charCodeAt(p) !== 91) return null // [
  
  // Check for footnote definition [^
  const isFootnote = p + 1 < len && s.charCodeAt(p + 1) === 94
  
  // Find label end
  let i = p + 1
  let depth = 1
  while (i < len && depth > 0) {
    const c = s.charCodeAt(i)
    if (c === 91) depth++
    else if (c === 93) depth--
    else if (c === 92 && i + 1 < len) i++ // escape
    else if (c === 10) return null // no newline in label
    i++
  }
  if (depth !== 0) return null
  
  const rawLabel = s.slice(p + 1, i - 1)
  const label = rawLabel.toLowerCase().replace(/\s+/g, ' ').trim()
  if (!label) return null
  
  // Expect :
  if (i >= len || s.charCodeAt(i) !== 58) return null
  i++
  
  // Skip whitespace (including one optional newline)
  let hasNewline = false
  while (i < len) {
    const c = s.charCodeAt(i)
    if (c === 32 || c === 9) i++
    else if (c === 10 && !hasNewline) { hasNewline = true; i++ }
    else break
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
  let url: string
  if (i < len && s.charCodeAt(i) === 60) { // <url>
    i++
    const urlStart = i
    while (i < len && s.charCodeAt(i) !== 62 && s.charCodeAt(i) !== 10) i++
    if (i >= len || s.charCodeAt(i) !== 62) return null
    url = s.slice(urlStart, i)
    i++
  } else {
    const urlStart = i
    let parens = 0
    while (i < len) {
      const c = s.charCodeAt(i)
      if (c === 40) parens++
      else if (c === 41) { if (parens === 0) break; parens-- }
      else if (c === 32 || c === 9 || c === 10) break
      else if (c === 92 && i + 1 < len) i++ // escape
      i++
    }
    url = s.slice(urlStart, i)
  }
  
  if (!url) return null
  
  // Skip whitespace
  const wsStart = i
  while (i < len && (s.charCodeAt(i) === 32 || s.charCodeAt(i) === 9)) i++
  
  // Check for title or end of line
  let title: string | undefined
  const lineEnd = s.indexOf('\n', i)
  const eol = lineEnd < 0 ? len : lineEnd
  
  if (i < eol) {
    const tc = s.charCodeAt(i)
    if (tc === 34 || tc === 39 || tc === 40) { // " ' (
      const closeChar = tc === 40 ? 41 : tc
      i++
      const titleStart = i
      while (i < len && s.charCodeAt(i) !== closeChar) {
        if (s.charCodeAt(i) === 92 && i + 1 < len) i++ // escape
        i++
      }
      if (i < len && s.charCodeAt(i) === closeChar) {
        title = s.slice(titleStart, i)
        i++
      }
    }
  }
  
  // Skip trailing whitespace
  while (i < eol && (s.charCodeAt(i) === 32 || s.charCodeAt(i) === 9)) i++
  
  // Must be at end of line (or end of string)
  if (i < eol) return null
  
  refs[label] = { target: url, title }
  return lineEnd < 0 ? len : lineEnd + 1
}

// ============================================================================
// CHARACTER CLASSIFICATION TABLE
// ============================================================================
// Bitfield flags for character classification
const C_WS = 1        // Whitespace (space, tab, newline)
const C_NL = 2        // Newline
const C_PUNCT = 4     // Punctuation
const C_ALPHA = 8     // Letter
const C_DIGIT = 16    // Digit
const C_BLOCK = 32    // Can start a block
const C_INLINE = 64   // Can start inline syntax

// Character class lookup table (ASCII 0-127)
const CC = new Uint8Array(128)

// Initialize character classes
// Whitespace
CC[32] = C_WS                          // space
CC[9] = C_WS                           // tab
CC[10] = C_WS | C_NL                   // newline
CC[13] = C_WS | C_NL                   // carriage return

// Block starters
CC[35] = C_BLOCK | C_PUNCT             // # (heading)
CC[62] = C_BLOCK | C_PUNCT             // > (blockquote)
CC[45] = C_BLOCK | C_INLINE | C_PUNCT  // - (list, thematic, strikethrough)
CC[43] = C_BLOCK | C_PUNCT             // + (list)
CC[42] = C_BLOCK | C_INLINE | C_PUNCT  // * (list, thematic, emphasis)
CC[95] = C_BLOCK | C_INLINE | C_PUNCT  // _ (thematic, emphasis)
CC[96] = C_BLOCK | C_INLINE | C_PUNCT  // ` (code fence, code span)
CC[126] = C_BLOCK | C_INLINE | C_PUNCT // ~ (code fence, strikethrough)
CC[60] = C_BLOCK | C_INLINE | C_PUNCT  // < (HTML, autolink)
CC[91] = C_INLINE | C_PUNCT            // [ (link, image, footnote)
CC[33] = C_INLINE | C_PUNCT            // ! (image)
CC[124] = C_BLOCK | C_PUNCT            // | (table)

// Digits
for (let i = 48; i <= 57; i++) CC[i] = C_DIGIT | C_BLOCK  // 0-9 (ordered list)

// Letters
for (let i = 65; i <= 90; i++) CC[i] = C_ALPHA   // A-Z
for (let i = 97; i <= 122; i++) CC[i] = C_ALPHA  // a-z

// Other punctuation
CC[92] = C_PUNCT   // \ (escape)
CC[93] = C_PUNCT   // ]
CC[40] = C_PUNCT   // (
CC[41] = C_PUNCT   // )
CC[58] = C_PUNCT   // :
CC[34] = C_PUNCT   // "
CC[39] = C_PUNCT   // '
CC[38] = C_PUNCT   // &
CC[61] = C_PUNCT   // =

// ============================================================================
// GENERIC SCANNING PRIMITIVES
// ============================================================================

/** Get character class for a character code */
function cc(code: number): number {
  return code < 128 ? CC[code] : (code === 160 ? C_WS : 0)
}

/** Unescape backslash escapes in a string */
function unescapeString(s: string): string {
  // Replace \X with X when X is an ASCII punctuation character
  return s.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, '$1')
}

/** Find end of current line (position of \n or end of string) */
function lineEnd(s: string, p: number): number {
  const i = s.indexOf('\n', p)
  return i < 0 ? s.length : i
}

/** Skip to start of next line */
function nextLine(s: string, p: number): number {
  const e = lineEnd(s, p)
  return e < s.length ? e + 1 : e
}

/** Skip whitespace (space and tab only) */
function skipWS(s: string, p: number, e: number): number {
  while (p < e) {
    const c = s.charCodeAt(p)
    if (c !== 32 && c !== 9) break
    p++
  }
  return p
}

/** Skip all whitespace including newlines */
function skipAllWS(s: string, p: number, e: number): number {
  while (p < e && (cc(s.charCodeAt(p)) & C_WS)) p++
  return p
}

/** Count consecutive occurrences of a character */
function countChar(s: string, p: number, e: number, ch: number): number {
  let n = 0
  while (p + n < e && s.charCodeAt(p + n) === ch) n++
  return n
}

// Reusable indent result to avoid allocations
var _indentSpaces = 0, _indentChars = 0

/** Calculate indentation (spaces, with tabs = 4 spaces). Results in _indentSpaces and _indentChars */
function indent(s: string, p: number, e: number): void {
  _indentSpaces = 0
  _indentChars = 0
  while (p + _indentChars < e) {
    const c = s.charCodeAt(p + _indentChars)
    if (c === 9) _indentSpaces += 4 - (_indentSpaces % 4)
    else if (c === 32) _indentSpaces++
    else break
    _indentChars++
  }
}

/** Check if line is blank (only whitespace) */
function isBlank(s: string, p: number, e: number): boolean {
  return skipWS(s, p, e) >= e
}

/** Find closing character, respecting escapes */
function findClose(s: string, p: number, e: number, close: number): number {
  while (p < e) {
    const c = s.charCodeAt(p)
    if (c === close) return p
    if (c === 92 && p + 1 < e) p++ // skip escaped char
    p++
  }
  return -1
}

// ============================================================================
// RESULT TYPES
// ============================================================================

type ScanResult = { node: MarkdownToJSX.ASTNode; end: number } | null

// ============================================================================
// BLOCK SCANNERS
// ============================================================================

/** Scan ATX heading (# ... #) */
function scanHeading(s: string, p: number, state: MarkdownToJSX.State, opts: any): ScanResult {
  const e = lineEnd(s, p)
  indent(s, p, e)
  if (_indentSpaces > 3) return null
  
  let i = p + _indentChars
  if (s.charCodeAt(i) !== 35) return null // #
  
  // Count # characters (1-6)
  const level = countChar(s, i, e, 35)
  if (level < 1 || level > 6) return null
  i += level
  
  // Must be followed by space or end of line
  if (i < e && s.charCodeAt(i) !== 32 && s.charCodeAt(i) !== 9) return null
  
  // Skip whitespace after #
  i = skipWS(s, i, e)
  
  // Find content end (strip trailing # and spaces)
  let contentEnd = e
  while (contentEnd > i && s.charCodeAt(contentEnd - 1) === 32) contentEnd--
  while (contentEnd > i && s.charCodeAt(contentEnd - 1) === 35) contentEnd--
  if (contentEnd > i && s.charCodeAt(contentEnd - 1) === 32) {
    while (contentEnd > i && s.charCodeAt(contentEnd - 1) === 32) contentEnd--
  } else if (contentEnd < e) {
    // Trailing # not preceded by space - keep them
    contentEnd = e
    while (contentEnd > i && s.charCodeAt(contentEnd - 1) === 32) contentEnd--
  }
  
  const text = s.slice(i, contentEnd)
  const children = parseInline(text, 0, text.length, state, opts)
  
  // Generate heading ID (slug)
  const slugify = opts?.slugify || util.slugify
  const id = slugify(text)
  
  return {
    node: {
      type: RuleType.heading,
      level,
      children,
      id,
    } as MarkdownToJSX.HeadingNode,
    end: nextLine(s, e)
  }
}

/** Scan thematic break (---, ***, ___) */
function scanThematic(s: string, p: number): ScanResult {
  const e = lineEnd(s, p)
  indent(s, p, e)
  if (_indentSpaces > 3) return null
  
  let i = p + _indentChars
  const ch = s.charCodeAt(i)
  if (ch !== 45 && ch !== 42 && ch !== 95) return null // - * _
  
  let count = 0
  while (i < e) {
    const c = s.charCodeAt(i)
    if (c === ch) count++
    else if (c !== 32 && c !== 9) return null
    i++
  }
  
  if (count < 3) return null
  
  return {
    node: { type: RuleType.breakThematic } as MarkdownToJSX.BreakThematicNode,
    end: nextLine(s, e)
  }
}

/** Scan fenced code block */
function scanFenced(s: string, p: number, state: MarkdownToJSX.State): ScanResult {
  const e = lineEnd(s, p)
  indent(s, p, e)
  if (_indentSpaces > 3) return null
  
  // Save fence indentation - we'll remove this many spaces from each content line
  const fenceIndent = _indentSpaces
  const fenceIndentChars = _indentChars
  
  let i = p + _indentChars
  const fence = s.charCodeAt(i)
  if (fence !== 96 && fence !== 126) return null // ` or ~
  
  const fenceLen = countChar(s, i, e, fence)
  if (fenceLen < 3) return null
  i += fenceLen
  
  // Parse info string - extract language (first word) and optional attributes
  const infoStart = skipWS(s, i, e)
  let infoEnd = e
  // Backtick fences can't have backticks in info
  if (fence === 96) {
    for (let j = infoStart; j < e; j++) {
      if (s.charCodeAt(j) === 96) return null
    }
  }
  while (infoEnd > infoStart && (s.charCodeAt(infoEnd - 1) === 32 || s.charCodeAt(infoEnd - 1) === 9)) {
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
  
  // Parse attributes if present
  let attrs: Record<string, any> | undefined = undefined
  if (attrsStr) {
    attrs = {}
    // Simple attribute parsing: name="value" or name='value' or name
    const attrR = /([a-zA-Z_][a-zA-Z0-9_-]*)(?:=(?:"([^"]*)"|'([^']*)'|([^\s]+)))?/g
    let match
    while ((match = attrR.exec(attrsStr)) !== null) {
      const name = match[1]
      const value = match[2] || match[3] || match[4] || true
      attrs[name] = value
    }
  }
  
  // Find closing fence
  let contentStart = nextLine(s, e)
  let contentEnd = contentStart
  let closeEnd = s.length
  
  while (contentEnd < s.length) {
    const le = lineEnd(s, contentEnd)
    indent(s, contentEnd, le)
    if (_indentSpaces < 4) {
      const fp = contentEnd + _indentChars
      if (countChar(s, fp, le, fence) >= fenceLen) {
        const afterFence = fp + countChar(s, fp, le, fence)
        if (isBlank(s, afterFence, le)) {
          closeEnd = nextLine(s, le)
          break
        }
      }
    }
    contentEnd = nextLine(s, le)
  }
  
  // Extract content, removing up to fenceIndent spaces from each line
  // This preserves relative indentation within the code block
  let content = ''
  let cp = contentStart
  while (cp < contentEnd) {
    const le = lineEnd(s, cp)
    indent(s, cp, le)
    // Remove at most fenceIndent spaces (not more)
    const remove = Math.min(_indentChars, fenceIndent)
    content += s.slice(cp + remove, le) + '\n'
    cp = nextLine(s, le)
  }
  // Remove trailing newline
  if (content.endsWith('\n')) content = content.slice(0, -1)
  
  return {
    node: {
      type: RuleType.codeBlock,
      lang: lang || undefined,
      text: content,
      attrs: attrs,
    } as MarkdownToJSX.CodeBlockNode,
    end: closeEnd
  }
}

/** Scan indented code block */
function scanIndented(s: string, p: number): ScanResult {
  const e = lineEnd(s, p)
  indent(s, p, e)
  if (_indentSpaces < 4) return null
  
  let content = ''
  let end = p
  
  while (end < s.length) {
    const le = lineEnd(s, end)
    indent(s, end, le)
    
    if (isBlank(s, end, le)) {
      // Blank line - include but check if code continues
      const nextStart = nextLine(s, le)
      if (nextStart < s.length) {
        const nextLe = lineEnd(s, nextStart)
        indent(s, nextStart, nextLe)
        if (_indentSpaces >= 4 && !isBlank(s, nextStart, nextLe)) {
          content += '\n'
          end = nextStart
          continue
        }
      }
      break
    }
    
    if (_indentSpaces < 4) break
    
    // Remove 4 spaces of indentation
    let remove = 0, spaces = 0
    for (let i = end; i < le && spaces < 4; i++) {
      const c = s.charCodeAt(i)
      if (c === 9) spaces += 4 - (spaces % 4)
      else spaces++
      remove++
    }
    
    content += s.slice(end + remove, le) + '\n'
    end = nextLine(s, le)
  }
  
  // Trim trailing blank lines
  while (content.endsWith('\n\n')) content = content.slice(0, -1)
  if (content.endsWith('\n')) content = content.slice(0, -1)
  
  if (!content) return null
  
  return {
    node: {
      type: RuleType.codeBlock,
      text: content,
    } as MarkdownToJSX.CodeBlockNode,
    end
  }
}

/** Scan blockquote */
function scanBlockquote(s: string, p: number, state: MarkdownToJSX.State, opts: any): ScanResult {
  const e = lineEnd(s, p)
  indent(s, p, e)
  if (_indentSpaces > 3) return null
  
  let i = p + _indentChars
  if (s.charCodeAt(i) !== 62) return null // >
  
  // Collect blockquote content
  let content = ''
  let end = p
  let alertType: string | undefined
  
  while (end < s.length) {
    const le = lineEnd(s, end)
    indent(s, end, le)
    
    if (_indentSpaces > 3) {
      // Could be lazy continuation or indented code
      if (content) {
        content += s.slice(end, le) + '\n'
        end = nextLine(s, le)
        continue
      }
      break
    }
    
    const qi = end + _indentChars
    if (s.charCodeAt(qi) === 62) {
      // > marker
      let ci = qi + 1
      if (ci < le && s.charCodeAt(ci) === 32) ci++ // optional space after >
      const lineContent = s.slice(ci, le)
      
      // Check for alert syntax [!TYPE] on first line
      if (!content && !alertType) {
        const alertMatch = lineContent.match(/^\[!([A-Z]+)\]\s*$/)
        if (alertMatch) {
          alertType = alertMatch[1]
          end = nextLine(s, le)
          continue // Don't add alert marker to content
        }
      }
      
      content += lineContent + '\n'
      end = nextLine(s, le)
    } else if (content && !isBlank(s, end, le)) {
      // Lazy continuation
      content += s.slice(end, le) + '\n'
      end = nextLine(s, le)
    } else {
      break
    }
  }
  
  if (!content && !alertType) return null
  
  // Parse blockquote content recursively
  const children = parseBlocks(content || '', state, opts)
  
  const node: MarkdownToJSX.BlockQuoteNode = {
    type: RuleType.blockQuote,
    children,
  }
  if (alertType) {
    node.alert = alertType
  }
  
  return { node, end }
}

/** Check if line starts a list item, return marker info */
function checkListMarker(s: string, p: number, e: number): { ordered: boolean; marker: string; start?: number; contentStart: number } | null {
  indent(s, p, e)
  if (_indentSpaces > 3) return null
  
  let i = p + _indentChars
  if (i >= e) return null
  
  const c = s.charCodeAt(i)
  
  // Unordered: - * +
  if (c === 45 || c === 42 || c === 43) {
    const next = i + 1
    if (next >= e || s.charCodeAt(next) === 32 || s.charCodeAt(next) === 9 || s.charCodeAt(next) === 10) {
      return { ordered: false, marker: s[i], contentStart: skipWS(s, next, e) }
    }
    return null
  }
  
  // Ordered: 1. or 1)
  if (c >= 48 && c <= 57) {
    let numEnd = i
    while (numEnd < e && numEnd - i < 9) {
      const nc = s.charCodeAt(numEnd)
      if (nc < 48 || nc > 57) break
      numEnd++
    }
    if (numEnd > i && numEnd < e) {
      const delim = s.charCodeAt(numEnd)
      if (delim === 46 || delim === 41) { // . or )
        const next = numEnd + 1
        if (next >= e || s.charCodeAt(next) === 32 || s.charCodeAt(next) === 9 || s.charCodeAt(next) === 10) {
          return { 
            ordered: true, 
            marker: s[numEnd], 
            start: parseInt(s.slice(i, numEnd), 10),
            contentStart: skipWS(s, next, e)
          }
        }
      }
    }
  }
  
  return null
}

/** Scan list (ordered or unordered) */
function scanList(s: string, p: number, state: MarkdownToJSX.State, opts: any): ScanResult {
  const firstLine = lineEnd(s, p)
  const marker = checkListMarker(s, p, firstLine)
  if (!marker) return null
  
  const items: MarkdownToJSX.ASTNode[][] = []
  const itemContents: string[] = []
  let end = p
  let currentItem = ''
  indent(s, p, firstLine)
  let baseIndent = _indentSpaces
  let hasBlankBetweenItems = false
  let blankAfterCurrentItem = false
  
  // Calculate content indent for continuation lines
  const firstMarkerEnd = marker.contentStart
  const contentIndent = firstMarkerEnd - p
  // Marker width is the minimum indentation for nested content (more lenient than CommonMark)
  const markerWidth = contentIndent > 1 ? Math.max(2, contentIndent - 1) : 2
  
  while (end < s.length) {
    const le = lineEnd(s, end)
    indent(s, end, le)
    
    // Check if this line starts a new list item with same marker type
    const lineMarker = checkListMarker(s, end, le)
    if (lineMarker && lineMarker.ordered === marker.ordered && 
        (marker.ordered ? lineMarker.marker === marker.marker : true) &&
        _indentSpaces === baseIndent) {
      // New item at same indentation level - save current and start new
      if (currentItem) {
        itemContents.push(currentItem.trim())
        // If there was a blank line before this new item, list is loose
        if (blankAfterCurrentItem) hasBlankBetweenItems = true
      }
      currentItem = s.slice(lineMarker.contentStart, le) + '\n'
      blankAfterCurrentItem = false
      end = nextLine(s, le)
      continue
    }
    
    // Check for blank line
    if (isBlank(s, end, le)) {
      blankAfterCurrentItem = true
      currentItem += '\n'
      end = nextLine(s, le)
      // Check if list continues after blank
      const nextStart = end
      if (nextStart < s.length) {
        const nextLe = lineEnd(s, nextStart)
        
        // Check for thematic break first - it takes precedence over list continuation
        indent(s, nextStart, nextLe)
        const nextC = s.charCodeAt(nextStart + _indentChars)
        if ((nextC === 45 || nextC === 42 || nextC === 95) && scanThematic(s, nextStart)) {
          break
        }
        
        const nextMarker = checkListMarker(s, nextStart, nextLe)
        if (!nextMarker || nextMarker.ordered !== marker.ordered) {
          // Check for continuation by indentation
          if (_indentSpaces < markerWidth && !isBlank(s, nextStart, nextLe)) {
            break
          }
        }
      }
      continue
    }
    
    // Check for indented continuation - use more lenient markerWidth instead of contentIndent
    if (_indentSpaces >= markerWidth || _indentSpaces >= 4) {
      // Check if this indented line is actually a nested list
      const nestedMarker = checkListMarker(s, end, le)
      if (nestedMarker && _indentSpaces >= markerWidth) {
        // This is a nested list - collect all lines that belong to this nested content
        // Remove base indentation and add to current item for later parsing
        const contentStart = Math.min(end + markerWidth, end + _indentChars)
        currentItem += s.slice(contentStart, le) + '\n'
        end = nextLine(s, le)
        continue
      }
      // Remove base indentation for continuation
      const contentStart = Math.min(end + markerWidth, end + _indentChars)
      currentItem += s.slice(contentStart, le) + '\n'
      end = nextLine(s, le)
      continue
    }
    
    // Check for lazy continuation - paragraph text can continue list item without indentation
    // This only applies if the line doesn't start a new block type
    const lineStart = end + _indentChars
    const c = s.charCodeAt(lineStart)
    
    // Check if this line starts a new block
    const startsNewBlock = 
      // ATX heading
      c === 35 || // #
      // Thematic break or list marker
      (c === 45 || c === 42 || c === 95 || c === 43) && (
        scanThematic(s, end) !== 0 || 
        checkListMarker(s, end, le)
      ) ||
      // Ordered list
      (c >= 48 && c <= 57 && checkListMarker(s, end, le)) ||
      // Fenced code
      (c === 96 || c === 126) && scanFence(s, end, le) ||
      // HTML block start
      c === 60 ||
      // Blockquote
      c === 62
    
    if (!startsNewBlock && currentItem && !isBlank(s, end, le)) {
      // Lazy continuation - add line to current item
      currentItem += s.slice(lineStart, le) + '\n'
      end = nextLine(s, le)
      continue
    }
    
    // Line doesn't belong to list
    break
  }
  
  // Save last item
  if (currentItem) {
    itemContents.push(currentItem.trim())
  }
  
  if (itemContents.length === 0) return null
  
  // Determine if list is tight (no blank lines between items, single paragraph items)
  const isTight = !hasBlankBetweenItems && itemContents.every(content => !content.includes('\n\n'))
  
  // Parse items
  for (const content of itemContents) {
    let itemContent = content
    let taskNode: MarkdownToJSX.GFMTaskNode | null = null
    
    // Check for GFM task list item [ ] or [x]
    if (itemContent.length >= 3 && itemContent[0] === '[') {
      const marker = itemContent[1]
      if ((marker === ' ' || marker === 'x' || marker === 'X') && itemContent[2] === ']') {
        taskNode = {
          type: RuleType.gfmTask,
          completed: marker.toLowerCase() === 'x',
        } as MarkdownToJSX.GFMTaskNode
        // Skip task marker only (keep the space after for text content)
        itemContent = itemContent.slice(3)
      }
    }
    
    let itemNodes: MarkdownToJSX.ASTNode[]
    if (isTight && !itemContent.includes('\n')) {
      // Tight list item - parse as inline, no wrapping paragraph
      itemNodes = parseInline(itemContent, 0, itemContent.length, state, opts)
    } else if (isTight && itemContent.includes('\n')) {
      // Tight list with multiline content
      // First check if content has hard line breaks (two spaces before newline)
      const hasHardBreak = /  +\n/.test(itemContent)
      
      if (hasHardBreak) {
        // Content has hard line breaks - parse all as inline with breaks
        const textWithBreaks = itemContent.replace(/  +\n/g, '\u001F').replace(/\n/g, ' ')
        itemNodes = parseInlineWithBreaks(textWithBreaks, 0, textWithBreaks.length, state, opts)
      } else {
        // Check for nested list
        const lines = itemContent.split('\n')
        const firstLine = lines[0]
        const rest = lines.slice(1).join('\n').trim()
        
        // Check if rest starts with a list marker (nested list)
        if (rest) {
          const restFirstLine = lineEnd(rest, 0)
          const restMarker = checkListMarker(rest, 0, restFirstLine)
          if (restMarker) {
            // Parse first line as inline, then rest as blocks (nested list)
            itemNodes = parseInline(firstLine, 0, firstLine.length, state, opts)
            const nestedNodes = parseBlocks(rest, { ...state, inList: true }, opts)
            itemNodes = [...itemNodes, ...nestedNodes]
          } else {
            // Not a nested list - parse as inline content with soft breaks
            // For indented continuation (like *   item\n    continuation), normalize whitespace
            // For lazy continuation (like *   item\ncontunuation), keep newlines as soft breaks
            const hasIndentedContinuation = lines.slice(1).some(l => /^[\t ]+/.test(l))
            if (hasIndentedContinuation) {
              // Normalize whitespace for indented continuation
              const joinedText = itemContent.replace(/\s+/g, ' ').trim()
              itemNodes = parseInline(joinedText, 0, joinedText.length, state, opts)
            } else {
              // Keep newlines for lazy continuation - render as soft breaks (literal newlines)
              const joinedText = itemContent.replace(/\n/g, '\n')
              itemNodes = parseInline(joinedText, 0, joinedText.length, state, opts)
            }
          }
        } else {
          // Just first line
          itemNodes = parseInline(firstLine, 0, firstLine.length, state, opts)
        }
      }
    } else {
      // Loose list item - parse as blocks
      itemNodes = parseBlocks(itemContent, { ...state, inList: true }, opts)
    }
    
    // Prepend task node if present
    if (taskNode) {
      items.push([taskNode, ...itemNodes])
    } else {
      items.push(itemNodes)
    }
  }
  
  return {
    node: {
      type: marker.ordered ? RuleType.orderedList : RuleType.unorderedList,
      start: marker.ordered ? marker.start : undefined,
      items,
    } as MarkdownToJSX.OrderedListNode | MarkdownToJSX.UnorderedListNode,
    end
  }
}

// HTML block-level tag names (CommonMark spec)
const HTML_TAGS_BLOCK = new Set([
  'address', 'article', 'aside', 'base', 'basefont', 'blockquote', 'body',
  'caption', 'center', 'col', 'colgroup', 'dd', 'details', 'dialog', 'dir',
  'div', 'dl', 'dt', 'fieldset', 'figcaption', 'figure', 'footer', 'form',
  'frame', 'frameset', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header',
  'hr', 'html', 'iframe', 'legend', 'li', 'link', 'main', 'menu', 'menuitem',
  'nav', 'noframes', 'ol', 'optgroup', 'option', 'p', 'param', 'search',
  'section', 'summary', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead',
  'title', 'tr', 'track', 'ul'
])

// Inline HTML tags - these should not be treated as block elements
const HTML_TAGS_INLINE = new Set([
  'a', 'abbr', 'b', 'bdi', 'bdo', 'br', 'cite', 'code', 'data', 'dfn', 'em',
  'i', 'kbd', 'mark', 'q', 'rp', 'rt', 'ruby', 's', 'samp', 'small', 'span',
  'strong', 'sub', 'sup', 'time', 'u', 'var', 'wbr', 'img', 'input'
])

/** Check if string starts with HTML block (types 1-6) */
function isHTMLBlockStart(s: string, p: number, e: number): { type: number; close?: string } | null {
  if (s.charCodeAt(p) !== 60) return null // <
  
  const line = s.slice(p, e).toLowerCase()
  
  // Type 1: script, pre, style, textarea
  if (/^<(script|pre|style|textarea)[\s>]/i.test(line)) {
    return { type: 1, close: '</' + line.match(/^<(\w+)/)?.[1] + '>' }
  }
  
  // Type 2: <!-- comment
  if (line.startsWith('<!--')) return { type: 2, close: '-->' }
  
  // Type 3: <?
  if (line.startsWith('<?')) return { type: 3, close: '?>' }
  
  // Type 4: <!LETTER
  if (/^<![a-z]/i.test(line)) return { type: 4, close: '>' }
  
  // Type 5: <![CDATA[
  if (line.startsWith('<![cdata[')) return { type: 5, close: ']]>' }
  
  // Type 6: Block-level tag
  const match = line.match(/^<\/?([a-z][a-z0-9-]*)[\s/>]/i)
  if (match && HTML_TAGS_BLOCK.has(match[1].toLowerCase())) {
    return { type: 6 }
  }
  
  return null
}

/** Process raw attributes object - convert names, parse styles, sanitize URLs */
function processHTMLAttributes(rawAttrs: Record<string, string>, tagName: string, opts: any): Record<string, any> {
  const attrs: Record<string, any> = {}
  
  for (const [rawName, value] of Object.entries(rawAttrs)) {
    let name = rawName
    
    // Convert HTML attribute names to React
    if (name === 'class') name = 'className'
    else if (name === 'for') name = 'htmlFor'
    else if (name.charCodeAt(0) === 100 && name.startsWith('data-')) { /* keep as-is */ }
    else if (name.charCodeAt(0) === 97 && name.startsWith('aria-')) { /* keep as-is */ }
    else {
      // Convert kebab-case to camelCase for other attributes
      if (name.indexOf('-') !== -1) {
        name = name.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase())
      }
    }
    
    if (name === 'style' && typeof value === 'string') {
      // Parse inline styles - handle url() values properly
      const styles: Record<string, string> = {}
      let decls: string[] = []
      let depth = 0
      let start = 0
      for (let j = 0; j < value.length; j++) {
        const c = value.charCodeAt(j)
        if (c === 40) depth++ // (
        else if (c === 41) depth-- // )
        else if (c === 59 && depth === 0) { // ;
          decls.push(value.slice(start, j))
          start = j + 1
        }
      }
      if (start < value.length) decls.push(value.slice(start))
      
      let hasXSS = false
      decls.forEach(decl => {
        const colonIdx = decl.indexOf(':')
        if (colonIdx === -1) return
        const prop = decl.slice(0, colonIdx).trim()
        const val = decl.slice(colonIdx + 1).trim()
        if (prop && val) {
          if (/url\s*\(\s*(javascript|vbscript|data:(?!image\/))/i.test(val)) {
            hasXSS = true
            if (process.env.NODE_ENV !== 'production') {
              console.warn('Style attribute contains an unsafe URL expression, it will not be rendered.', val)
            }
            return
          }
          const camelProp = prop.indexOf('-') !== -1 
            ? prop.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase())
            : prop
          styles[camelProp] = val
        }
      })
      if (!hasXSS && Object.keys(styles).length > 0) {
        attrs[name] = styles
      }
    } else if ((name === 'href' || name === 'src') && opts?.sanitizer) {
      const sanitized = opts.sanitizer(value, tagName, name)
      if (sanitized !== null) {
        attrs[name] = sanitized
      }
    } else if (value === '' || value === true) {
      attrs[name] = true
    } else {
      // Handle JSX interpolation: {expression} -> expression
      if (value.length >= 2 && value.charCodeAt(0) === 123 && value.charCodeAt(value.length - 1) === 125) {
        // Strip braces for JSX interpolation
        attrs[name] = value.slice(1, -1)
      } else {
        attrs[name] = value
      }
    }
  }
  
  return attrs
}

/** Parse HTML attributes from a string */
function parseHTMLAttributes(attrStr: string, tagName: string, opts: any): Record<string, any> {
  const attrs: Record<string, any> = {}
  let i = 0
  const len = attrStr.length
  
  while (i < len) {
    // Skip whitespace (space, tab, newline, carriage return)
    var c = attrStr.charCodeAt(i)
    while (i < len && (c === 32 || c === 9 || c === 10 || c === 13)) {
      i++
      c = attrStr.charCodeAt(i)
    }
    if (i >= len) break
    
    // Parse attribute name (not whitespace, =, /, >)
    const nameStart = i
    c = attrStr.charCodeAt(i)
    while (i < len && c !== 32 && c !== 9 && c !== 10 && c !== 13 && c !== 61 && c !== 47 && c !== 62) {
      i++
      c = attrStr.charCodeAt(i)
    }
    if (i === nameStart) break
    let name = attrStr.slice(nameStart, i)
    
    // Convert HTML attribute names to React
    if (name === 'class') name = 'className'
    else if (name === 'for') name = 'htmlFor'
    else if (name.charCodeAt(0) === 100 && name.startsWith('data-')) { /* keep as-is */ }
    else if (name.charCodeAt(0) === 97 && name.startsWith('aria-')) { /* keep as-is */ }
    else {
      // Convert kebab-case to camelCase for other attributes
      if (name.indexOf('-') !== -1) {
        name = name.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase())
      }
    }
    
    // Skip whitespace
    c = attrStr.charCodeAt(i)
    while (i < len && (c === 32 || c === 9 || c === 10 || c === 13)) {
      i++
      c = attrStr.charCodeAt(i)
    }
    
    // Check for =
    if (attrStr.charCodeAt(i) !== 61) {
      attrs[name] = true
      continue
    }
    i++ // skip =
    
    // Skip whitespace
    c = attrStr.charCodeAt(i)
    while (i < len && (c === 32 || c === 9 || c === 10 || c === 13)) {
      i++
      c = attrStr.charCodeAt(i)
    }
    
    // Parse value
    let value: string
    const quote = attrStr.charCodeAt(i)
    if (quote === 34 || quote === 39) { // " or '
      i++
      const valueStart = i
      while (i < len && attrStr.charCodeAt(i) !== quote) i++
      value = attrStr.slice(valueStart, i)
      if (i < len) i++ // skip closing quote
    } else {
      const valueStart = i
      c = attrStr.charCodeAt(i)
      while (i < len && c !== 32 && c !== 9 && c !== 10 && c !== 13 && c !== 62) {
        i++
        c = attrStr.charCodeAt(i)
      }
      value = attrStr.slice(valueStart, i)
    }
    
    // Handle special cases
    if (name === 'style') {
      // Parse inline styles - handle url() values properly
      const styles: Record<string, string> = {}
      // Split by ; but not inside url()
      let decls: string[] = []
      let depth = 0
      let start = 0
      for (let j = 0; j < value.length; j++) {
        const c = value.charCodeAt(j)
        if (c === 40) depth++ // (
        else if (c === 41) depth-- // )
        else if (c === 59 && depth === 0) { // ;
          decls.push(value.slice(start, j))
          start = j + 1
        }
      }
      if (start < value.length) decls.push(value.slice(start))
      
      let hasXSS = false
      decls.forEach(decl => {
        // Split property: value, but only on first colon (handle url() with colons)
        const colonIdx = decl.indexOf(':')
        if (colonIdx === -1) return
        const prop = decl.slice(0, colonIdx).trim()
        const val = decl.slice(colonIdx + 1).trim()
        if (prop && val) {
          // Check for XSS in url() values
          if (/url\s*\(\s*(javascript|vbscript|data:(?!image\/))/i.test(val)) {
            hasXSS = true
            if (process.env.NODE_ENV !== 'production') {
              console.warn('Style attribute contains an unsafe URL expression, it will not be rendered.', val)
            }
            return
          }
          // Convert CSS property to camelCase
          const camelProp = prop.indexOf('-') !== -1 
            ? prop.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase())
            : prop
          styles[camelProp] = val
        }
      })
      // If XSS was detected, don't include any styles
      if (!hasXSS && Object.keys(styles).length > 0) {
        attrs[name] = styles
      }
    } else if ((name === 'href' || name === 'src') && opts?.sanitizer) {
      // Sanitize href and src attributes
      const sanitized = opts.sanitizer(value, tagName, name)
      if (sanitized !== null) {
        attrs[name] = sanitized
      }
      // if null, don't include the attribute (security)
    } else {
      attrs[name] = value
    }
  }
  
  return attrs
}

/** Case-insensitive indexOf without allocating new string */
function indexOfCI(str: string, search: string, from: number): number {
  const searchLen = search.length
  for (let j = from; j <= str.length - searchLen; j++) {
    let match = true
    for (let k = 0; k < searchLen; k++) {
      let c1 = str.charCodeAt(j + k)
      let c2 = search.charCodeAt(k)
      // Convert to lowercase inline
      if (c1 >= 65 && c1 <= 90) c1 += 32
      if (c2 >= 65 && c2 <= 90) c2 += 32
      if (c1 !== c2) { match = false; break }
    }
    if (match) return j
  }
  return -1
}

/** Case-insensitive lastIndexOf without allocating new string */
function lastIndexOfCI(str: string, search: string, from: number): number {
  const searchLen = search.length
  for (let j = Math.min(from, str.length - searchLen); j >= 0; j--) {
    let match = true
    for (let k = 0; k < searchLen; k++) {
      let c1 = str.charCodeAt(j + k)
      let c2 = search.charCodeAt(k)
      // Convert to lowercase inline
      if (c1 >= 65 && c1 <= 90) c1 += 32
      if (c2 >= 65 && c2 <= 90) c2 += 32
      if (c1 !== c2) { match = false; break }
    }
    if (match) return j
  }
  return -1
}

/** Find matching closing tag (case-insensitive without allocation) */
function findClosingTag(s: string, start: number, tagName: string): number {
  const tagLower = tagName.toLowerCase()
  const openTag = '<' + tagLower
  const closeTag = '</' + tagLower
  let depth = 1
  let i = start
  const len = s.length
  
  while (i < len && depth > 0) {
    const openIdx = indexOfCI(s, openTag, i)
    const closeIdx = indexOfCI(s, closeTag, i)
    
    if (closeIdx === -1) return -1 // No closing tag found
    
    if (openIdx !== -1 && openIdx < closeIdx) {
      // Check if it's actually a tag (not attribute or text)
      const afterOpen = s.charCodeAt(openIdx + openTag.length)
      if (afterOpen === 62 || afterOpen === 32 || afterOpen === 9 || afterOpen === 10 || afterOpen === 47) {
        depth++
      }
      i = openIdx + 1
    } else {
      // Found closing tag
      const afterClose = s.charCodeAt(closeIdx + closeTag.length)
      if (afterClose === 62 || afterClose === 32 || afterClose === 9 || afterClose === 10) {
        depth--
        if (depth === 0) {
          // Find end of closing tag
          let j = closeIdx + closeTag.length
          while (j < len && s.charCodeAt(j) !== 62) j++
          return j + 1
        }
      }
      i = closeIdx + 1
    }
  }
  
  return -1
}

/** Scan HTML block */
function scanHTMLBlock(s: string, p: number, state: MarkdownToJSX.State, opts: any): ScanResult {
  if (opts.disableParsingRawHTML) return null
  
  const e = lineEnd(s, p)
  indent(s, p, e)
  if (_indentSpaces > 3) return null
  
  const start = p + _indentChars
  if (s.charCodeAt(start) !== 60) return null // <
  
  // Check for autolink (URL or email) - these are not HTML blocks
  // URL autolink: <https://...> or <http://...>
  // Email autolink: <...@...>
  const closeAngle = s.indexOf('>', start + 1)
  if (closeAngle !== -1 && closeAngle < e) {
    const content = s.slice(start + 1, closeAngle)
    // Check for URL scheme or email
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(content) || /^[^\s@]+@[^\s@]+$/.test(content)) {
      return null // Let inline parser handle autolinks
    }
  }
  
  // Parse opening tag
  const tagResult = parseHTMLTag(s, start)
  if (!tagResult) {
    // Check for HTML comment
    if (s.slice(start, start + 4) === '<!--') {
      const endComment = s.indexOf('-->', start + 4)
      if (endComment !== -1) {
        const end = nextLine(s, endComment + 3)
        return {
          node: {
            type: RuleType.htmlComment,
            text: s.slice(start + 4, endComment),
          } as MarkdownToJSX.HTMLCommentNode,
          end
        }
      }
    }
    return null
  }
  
  const tagName = tagResult.tag
  const tagNameLower = tagName.toLowerCase()
  
  // Check if it's a block-level tag or custom component (uppercase first letter)
  // Also accept any custom tag that's not standard inline HTML
  const firstChar = tagName.charCodeAt(0)
  const isCustomComponent = firstChar >= 65 && firstChar <= 90 // A-Z
  const isStandardBlockTag = HTML_TAGS_BLOCK.has(tagNameLower)
  // Accept: block tags, custom components, or custom unknown tags (not standard inline)
  const isInlineTag = HTML_TAGS_INLINE.has(tagNameLower)
  if (isInlineTag && !isCustomComponent) return null
  
  // Self-closing tag
  if (tagResult.selfClosing || util.isVoidElement(tagName)) {
    const end = nextLine(s, tagResult.end)
    return {
      node: {
        type: RuleType.htmlBlock,
        tag: tagName,
        attrs: processHTMLAttributes(tagResult.attrs, tagName, opts),
        rawAttrs: tagResult.rawAttrs,
        children: [],
        rawText: s.slice(start, tagResult.end),
        verbatim: true,
      } as MarkdownToJSX.HTMLNode,
      end
    }
  }
  
  // Verbatim tags (script, style, pre, textarea)
  const isVerbatim = TYPE1_TAGS.has(tagNameLower)
  
  // Find closing tag
  const closeEnd = findClosingTag(s, tagResult.end, tagName)
  if (closeEnd === -1) {
    // No closing tag found
    // For HTML type 6 tags (block-level like div) or unknown tags, continue until blank line
    // This includes custom SVG elements (like <g>), custom web components, etc.
    if (isStandardBlockTag || isCustomComponent || !isInlineTag) {
      // Find next blank line or end of document
      let blankLineEnd = tagResult.end
      while (blankLineEnd < s.length) {
        const nextNL = s.indexOf('\n', blankLineEnd)
        if (nextNL === -1) {
          blankLineEnd = s.length
          break
        }
        // Check if next line is blank
        const nextLineStart = nextNL + 1
        if (nextLineStart >= s.length || s.charCodeAt(nextLineStart) === 10) {
          blankLineEnd = nextNL
          break
        }
        // Check if it's an all-whitespace line
        let isBlank = true
        let j = nextLineStart
        while (j < s.length && s.charCodeAt(j) !== 10) {
          const c = s.charCodeAt(j)
          if (c !== 32 && c !== 9) { isBlank = false; break }
          j++
        }
        if (isBlank) {
          blankLineEnd = nextNL
          break
        }
        blankLineEnd = j
      }
      
      const rawText = s.slice(tagResult.end, blankLineEnd)
      const end = blankLineEnd < s.length ? nextLine(s, blankLineEnd) : blankLineEnd
      
      // Parse content as blocks (similar to closed tag handling)
      let children: MarkdownToJSX.ASTNode[] = []
      const trimmed = rawText.trim()
      if (trimmed) {
        const hasBlocks = /\n\n/.test(trimmed) || /^[#\-*>1-9`]/.test(trimmed) || /<[a-z]/i.test(trimmed)
        if (hasBlocks) {
          children = parseBlocks(trimmed, { ...state, inline: false }, opts)
        } else {
          children = parseInline(trimmed, 0, trimmed.length, { ...state, inline: true }, opts)
        }
      }
      
      return {
        node: {
          type: RuleType.htmlBlock,
          tag: tagName,
          attrs: processHTMLAttributes(tagResult.attrs, tagName, opts),
          rawAttrs: tagResult.rawAttrs,
          children,
          rawText,
          text: rawText,
          verbatim: false,
        } as MarkdownToJSX.HTMLNode,
        end
      }
    }
    return null
  }
  
  // Find where closing tag starts
  const closeTagStart = lastIndexOfCI(s, '</' + tagNameLower, closeEnd)
  const innerContent = s.slice(tagResult.end, closeTagStart)
  
  // Check if content contains pre tags - if so, treat as verbatim for innerHTML handling
  const containsPreTags = /<\/?pre\b/i.test(innerContent)
  const shouldBeVerbatim = isVerbatim || containsPreTags
  
  let children: MarkdownToJSX.ASTNode[] = []
  
  if (shouldBeVerbatim) {
    // For verbatim or pre-containing blocks, parse only the first HTML tag as the child
    // This matches the original parser behavior where innerHTML uses the first child
    const trimmed = innerContent.trim()
    if (trimmed && trimmed.charCodeAt(0) === 60) { // starts with <
      // Parse just the first block (the pre tag)
      const firstBlockChildren = parseBlocks(trimmed, { ...state, inline: false }, opts)
      // Only take the first child (the pre element)
      if (firstBlockChildren.length > 0) {
        children = [firstBlockChildren[0]]
      }
    } else if (isVerbatim) {
      // For actual verbatim tags (script, style, pre, textarea), use raw text
      let textContent = innerContent
      if (textContent.charCodeAt(0) === 10) {
        textContent = textContent.slice(1)
      }
      if (textContent.charCodeAt(textContent.length - 1) === 10) {
        textContent = textContent.slice(0, -1)
      }
      if (textContent) {
        children = [{
          type: RuleType.text,
          text: textContent,
        } as MarkdownToJSX.TextNode]
      }
    }
  } else {
    // Parse inner content as markdown
    const trimmed = innerContent.trim()
    if (trimmed) {
      // Check if content looks like block content
      // Be careful to distinguish emphasis markers (**,__) from list markers (* , - )
      const firstChar = trimmed.charCodeAt(0)
      const secondChar = trimmed.length > 1 ? trimmed.charCodeAt(1) : 0
      const thirdChar = trimmed.length > 2 ? trimmed.charCodeAt(2) : 0
      const hasParagraphBreak = /\n\n/.test(trimmed)
      const hasBlockStart = firstChar === 35 || // # heading
        firstChar === 62 || // > blockquote
        firstChar === 96 || // ` code fence
        (firstChar >= 49 && firstChar <= 57 && secondChar === 46 && thirdChar === 32) || // 1. ordered list
        ((firstChar === 45 || firstChar === 42) && secondChar === 32) // - or * with space = list
      const hasHTMLTag = /<[a-z]/i.test(trimmed)
      if (hasParagraphBreak || hasBlockStart || hasHTMLTag) {
        children = parseBlocks(trimmed, { ...state, inline: false }, opts)
      } else {
        children = parseInline(trimmed, 0, trimmed.length, { ...state, inline: true }, opts)
      }
    }
  }
  
  // Check if there's more content on the same line after the closing tag
  // If so, don't skip to next line (allows parsing text after inline HTML)
  const lineEndPos = lineEnd(s, closeEnd)
  const afterClose = s.slice(closeEnd, lineEndPos).trim()
  const end = afterClose ? closeEnd : nextLine(s, closeEnd)
  // rawText should be from after opening tag to AFTER closing tag (including it)
  // This matches the original parser behavior for verbatim blocks
  // For multi-line attributes, preserve the newline after > to maintain formatting
  let rawTextStart = tagResult.end
  const hasMultilineAttrs = tagResult.rawAttrs && tagResult.rawAttrs.includes('\n')
  if (!hasMultilineAttrs && s.charCodeAt(rawTextStart) === 10) rawTextStart++
  // Include the closing tag in rawText for verbatim blocks containing pre
  let rawText = shouldBeVerbatim ? s.slice(rawTextStart, closeEnd) : s.slice(rawTextStart, closeTagStart)
  // For verbatim blocks, also strip trailing newline before closing tag
  if (shouldBeVerbatim && rawText.charCodeAt(rawText.length - 1) === 10) {
    rawText = rawText.slice(0, -1)
  }
  
  return {
    node: {
      type: RuleType.htmlBlock,
      tag: tagName,
      attrs: processHTMLAttributes(tagResult.attrs, tagName, opts),
      rawAttrs: tagResult.rawAttrs,
      children,
      rawText,
      text: innerContent, // deprecated
      verbatim: shouldBeVerbatim,
    } as MarkdownToJSX.HTMLNode,
    end
  }
}

/** Parse table row cells */
function parseTableRow(s: string, state: MarkdownToJSX.State, opts: any): MarkdownToJSX.ASTNode[][] {
  // Trim leading/trailing |
  let row = s.trim()
  if (row.startsWith('|')) row = row.slice(1)
  if (row.endsWith('|') && !row.endsWith('\\|')) row = row.slice(0, -1)
  
  // Split by | (but not \| and not | inside code spans)
  const cells: string[] = []
  let current = ''
  let i = 0
  while (i < row.length) {
    // Handle escape
    if (row[i] === '\\' && i + 1 < row.length) {
      current += row[i] + row[i + 1]
      i += 2
      continue
    }
    // Handle code span - skip to closing backticks
    if (row[i] === '`') {
      // Count opening backticks
      let backticks = 0
      const start = i
      while (i < row.length && row[i] === '`') { backticks++; i++ }
      current += row.slice(start, i)
      // Find matching closing backticks
      let found = false
      while (i < row.length && !found) {
        let closeBackticks = 0
        while (i < row.length && row[i] === '`') { closeBackticks++; i++ }
        if (closeBackticks === backticks) {
          current += row.slice(i - closeBackticks, i)
          found = true
        } else if (closeBackticks > 0) {
          current += row.slice(i - closeBackticks, i)
        } else {
          current += row[i]
          i++
        }
      }
      continue
    }
    // Handle cell separator
    if (row[i] === '|') {
      cells.push(current.trim())
      current = ''
      i++
      continue
    }
    current += row[i]
    i++
  }
  cells.push(current.trim())
  
  return cells.map(cell => parseInline(cell, 0, cell.length, state, opts))
}

/** Scan GFM table */
function scanTable(s: string, p: number, state: MarkdownToJSX.State, opts: any): ScanResult {
  const firstEnd = lineEnd(s, p)
  const firstLine = s.slice(p, firstEnd)
  
  // Must have at least one |
  if (!firstLine.includes('|')) return null
  
  // Check for delimiter row
  const secondStart = nextLine(s, firstEnd)
  if (secondStart >= s.length) return null
  
  const secondEnd = lineEnd(s, secondStart)
  const delimLine = s.slice(secondStart, secondEnd).trim()
  
  // Delimiter row must match pattern: |? :?-+:? (| :?-+:?)* |?
  const delimPattern = /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/
  if (!delimPattern.test(delimLine)) return null
  
  // Parse alignment from delimiter row
  let delimRow = delimLine
  if (delimRow.startsWith('|')) delimRow = delimRow.slice(1)
  if (delimRow.endsWith('|')) delimRow = delimRow.slice(0, -1)
  const delims = delimRow.split('|').map(d => d.trim())
  const align = delims.map(d => {
    const left = d.startsWith(':')
    const right = d.endsWith(':')
    if (left && right) return 'center' as const
    if (right) return 'right' as const
    if (left) return 'left' as const
    return null  // no alignment
  })
  
  // Parse header
  const header = parseTableRow(firstLine, state, opts)
  
  // Parse body cells
  const cells: MarkdownToJSX.ASTNode[][][] = []
  let end = nextLine(s, secondEnd)
  
  while (end < s.length) {
    const le = lineEnd(s, end)
    const line = s.slice(end, le)
    
    if (isBlank(s, end, le)) break
    if (!line.includes('|')) break
    
    cells.push(parseTableRow(line, state, opts))
    end = nextLine(s, le)
  }
  
  // For streaming mode: suppress tables with header + separator but no data rows
  // (data rows might be coming in a later stream chunk)
  if ((opts.streaming || opts.optimizeForStreaming) && cells.length === 0) {
    return null
  }
  
  return {
    node: {
      type: RuleType.table,
      header,
      cells,
      align,
    } as MarkdownToJSX.TableNode,
    end
  }
}

/** Scan link reference definition [label]: url "title" */
function scanRefDefinition(s: string, p: number, state: MarkdownToJSX.State): ScanResult {
  const e = lineEnd(s, p)
  indent(s, p, e)
  if (_indentSpaces > 3) return null
  
  let i = p + _indentChars
  if (s.charCodeAt(i) !== 91) return null // [
  i++
  
  // Check for footnote definition [^
  const isFootnote = s.charCodeAt(i) === 94 // ^
  
  // Parse label
  const labelStart = i
  let depth = 1
  while (i < s.length && depth > 0) {
    const c = s.charCodeAt(i)
    if (c === 92 && i + 1 < s.length) { i += 2; continue }
    if (c === 91) depth++
    else if (c === 93) depth--
    else if (c === 10) return null // no newlines in label
    i++
  }
  if (depth !== 0) return null
  
  const label = s.slice(labelStart, i - 1).trim().toLowerCase()
  if (!label) return null
  
  // Must be followed by :
  if (i >= s.length || s.charCodeAt(i) !== 58) return null
  i++
  
  // Skip whitespace (including one newline)
  while (i < s.length && (s.charCodeAt(i) === 32 || s.charCodeAt(i) === 9)) i++
  if (i < s.length && s.charCodeAt(i) === 10) {
    i++
    while (i < s.length && (s.charCodeAt(i) === 32 || s.charCodeAt(i) === 9)) i++
  }
  
  // For footnotes, content is everything to end of line and continuation lines
  if (isFootnote) {
    let fnEnd = s.indexOf('\n', i)
    if (fnEnd < 0) fnEnd = s.length
    let content = s.slice(i, fnEnd).trim()
    let end = fnEnd < 0 ? s.length : fnEnd + 1
    
    // Check for multiline footnote continuation (2+ space indent)
    while (end < s.length) {
      const nextLe = lineEnd(s, end)
      indent(s, end, nextLe)
      // Continuation line must have 2+ space indent (or 4+ for indented content)
      if (_indentSpaces >= 2 && !isBlank(s, end, nextLe)) {
        // Keep original indentation in content for formatting
        const lineContent = s.slice(end, nextLe)
        content += '\n' + lineContent
        end = nextLine(s, nextLe)
      } else if (isBlank(s, end, nextLe)) {
        // Skip blank lines but check if next line is continuation
        const afterBlank = nextLine(s, nextLe)
        if (afterBlank < s.length) {
          const afterBlankEnd = lineEnd(s, afterBlank)
          indent(s, afterBlank, afterBlankEnd)
          if (_indentSpaces >= 2) {
            // Include blank line and continue
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
    
    state.refs[label] = { target: content, title: undefined }
    // Return footnote node (not refCollection) so HTML compiler can find it
    return { node: { type: RuleType.footnote } as MarkdownToJSX.ASTNode, end }
  }
  
  // Parse URL (can be in angle brackets or bare)
  let url = '', urlEnd = i
  if (i < s.length && s.charCodeAt(i) === 60) { // <url>
    i++
    urlEnd = i
    while (urlEnd < s.length && s.charCodeAt(urlEnd) !== 62 && s.charCodeAt(urlEnd) !== 10) urlEnd++
    if (urlEnd >= s.length || s.charCodeAt(urlEnd) !== 62) return null
    url = s.slice(i, urlEnd)
    urlEnd++
  } else {
    while (urlEnd < s.length) {
      const c = s.charCodeAt(urlEnd)
      if (c === 32 || c === 9 || c === 10) break
      urlEnd++
    }
    url = s.slice(i, urlEnd)
  }
  if (!url) return null
  
  i = urlEnd
  
  // Skip whitespace
  while (i < s.length && (s.charCodeAt(i) === 32 || s.charCodeAt(i) === 9)) i++
  
  // Optional title (can be on next line)
  let title: string | undefined
  let end = i
  
  if (i < s.length && s.charCodeAt(i) === 10) {
    // Title might be on next line
    const nextLineStart = i + 1
    let ti = nextLineStart
    while (ti < s.length && (s.charCodeAt(ti) === 32 || s.charCodeAt(ti) === 9)) ti++
    const tc = s.charCodeAt(ti)
    if (tc === 34 || tc === 39 || tc === 40) {
      i = ti  // Move to title start
    } else {
      // No title, end at newline
      end = nextLine(s, i)
      state.refs[label] = { target: url }
      return { node: { type: RuleType.refCollection } as MarkdownToJSX.ASTNode, end }
    }
  }
  
  if (i < s.length) {
    const tc = s.charCodeAt(i)
    if (tc === 34 || tc === 39 || tc === 40) {
      const closeChar = tc === 40 ? 41 : tc
      i++
      const titleStart = i
      while (i < s.length && s.charCodeAt(i) !== closeChar && s.charCodeAt(i) !== 10) {
        if (s.charCodeAt(i) === 92 && i + 1 < s.length) i++
        i++
      }
      if (i < s.length && s.charCodeAt(i) === closeChar) {
        title = s.slice(titleStart, i)
        i++
      }
    }
  }
  
  // Skip trailing whitespace and find end
  while (i < s.length && (s.charCodeAt(i) === 32 || s.charCodeAt(i) === 9)) i++
  end = i < s.length && s.charCodeAt(i) === 10 ? i + 1 : s.length
  
  // Store reference
  state.refs[label] = { target: url, title }
  
  return { node: { type: RuleType.refCollection } as MarkdownToJSX.ASTNode, end }
}

/** Scan paragraph (fallback) */
function scanParagraph(s: string, p: number, state: MarkdownToJSX.State, opts: any): ScanResult {
  let end = p
  let setextLevel = 0
  let textEnd = 0
  
  while (end < s.length) {
    const le = lineEnd(s, end)
    
    // Check for blank line
    if (isBlank(s, end, le)) break
    
    // Check if this line is a setext underline
    indent(s, end, le)
    if (_indentSpaces < 4 && textEnd > 0) {
      const c = s.charCodeAt(end + _indentChars)
      if (c === 61 || c === 45) { // = or -
        // Check if entire line is = or - (with optional spaces)
        let i = end + _indentChars
        while (i < le && s.charCodeAt(i) === c) i++
        while (i < le && (s.charCodeAt(i) === 32 || s.charCodeAt(i) === 9)) i++
        if (i >= le) {
          setextLevel = c === 61 ? 1 : 2
          end = nextLine(s, le)
          break
        }
      }
    }
    
    textEnd = le
    
    // Check if next line starts a new block
    const nextStart = nextLine(s, le)
    if (nextStart < s.length) {
      const nextLe = lineEnd(s, nextStart)
      indent(s, nextStart, nextLe)
      if (_indentSpaces < 4) {
        const c = s.charCodeAt(nextStart + _indentChars)
        // Check for block starters that interrupt paragraphs
        if (c === 35 || c === 62 || c === 96 || c === 126) {
          end = nextStart // End paragraph at current line
          break
        }
        // HTML blocks (including comments) can interrupt paragraphs
        if (c === 60) {
          end = nextStart
          break
        }
        // List items can interrupt paragraphs (- * + or digit followed by . or ))
        if (c === 45 || c === 42 || c === 43) {
          // - * + followed by space/tab
          const next = nextStart + _indentChars + 1
          if (next >= nextLe || s.charCodeAt(next) === 32 || s.charCodeAt(next) === 9) {
            // Only interrupt if not a thematic break
            if (!scanThematic(s, nextStart)) {
              end = nextStart
              break
            }
          }
        }
        if (c >= 48 && c <= 57) {
          // Digit - check for ordered list
          let i = nextStart + _indentChars
          while (i < nextLe && s.charCodeAt(i) >= 48 && s.charCodeAt(i) <= 57) i++
          if (i < nextLe && (s.charCodeAt(i) === 46 || s.charCodeAt(i) === 41)) {
            const afterMarker = i + 1
            if (afterMarker >= nextLe || s.charCodeAt(afterMarker) === 32 || s.charCodeAt(afterMarker) === 9) {
              end = nextStart
              break
            }
          }
        }
        // Tables can interrupt paragraphs if the line starts with |
        if (c === 124) { // |
          // Check if this could be a table (need to verify there's a delimiter row)
          const thirdStart = nextLine(s, nextLe)
          if (thirdStart < s.length) {
            const thirdEnd = lineEnd(s, thirdStart)
            const delimLine = s.slice(thirdStart, thirdEnd).trim()
            const delimPattern = /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/
            if (delimPattern.test(delimLine)) {
              end = nextStart
              break
            }
          }
        }
        // Thematic break (but not setext underline)
        if ((c === 45 || c === 42 || c === 95) && scanThematic(s, nextStart)) {
          // For dashes, only break if it's really a thematic break not setext
          if (c !== 45) {
            end = nextStart
            break
          }
          // Check if it could be setext (need at least 1 dash)
          let dashCount = 0
          let i = nextStart + _indentChars
          while (i < nextLe && s.charCodeAt(i) === 45) { dashCount++; i++ }
          while (i < nextLe && (s.charCodeAt(i) === 32 || s.charCodeAt(i) === 9)) i++
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
  const contentEnd = setextLevel ? textEnd : end
  // Don't replace \n directly - need to preserve hard line breaks (  \n)
  let text = s.slice(p, contentEnd).replace(/\n$/, '').trim()
  if (!text) return null
  
  // Process hard line breaks (two or more spaces before newline)
  // Replace "  \n" with special marker for later conversion to <br>
  // Keep soft line breaks as newlines (per CommonMark spec)
  text = text.replace(/  +\n/g, '\u001F')
  
  const children = parseInlineWithBreaks(text, 0, text.length, state, opts)
  
  if (setextLevel) {
    // Setext heading
    const slugify = opts?.slugify || util.slugify
    const id = slugify(text.replace(/\u001F/g, ''))
    return {
      node: {
        type: RuleType.heading,
        level: setextLevel,
        children,
        id,
      } as MarkdownToJSX.HeadingNode,
      end
    }
  }
  
  return {
    node: {
      type: RuleType.paragraph,
      children,
    } as MarkdownToJSX.ParagraphNode,
    end
  }
}

/** Parse inline with hard line break support */
function parseInlineWithBreaks(s: string, p: number, e: number, state: MarkdownToJSX.State, opts: any): MarkdownToJSX.ASTNode[] {
  const result: MarkdownToJSX.ASTNode[] = []
  let start = p
  
  while (start < e) {
    // Find next break marker
    let breakPos = s.indexOf('\u001F', start)
    if (breakPos < 0 || breakPos >= e) {
      // No more breaks, parse rest as inline
      const nodes = parseInline(s, start, e, state, opts)
      result.push(...nodes)
      break
    }
    
    // Parse before break
    if (breakPos > start) {
      const nodes = parseInline(s, start, breakPos, state, opts)
      result.push(...nodes)
    }
    
    // Add break node
    result.push({ type: RuleType.breakLine } as MarkdownToJSX.BreakLineNode)
    start = breakPos + 1
  }
  
  return result
}

// ============================================================================
// INLINE SCANNERS  
// ============================================================================

/** Scan inline code span */
function scanCodeSpan(s: string, p: number, e: number): ScanResult {
  if (s.charCodeAt(p) !== 96) return null
  
  // Count opening backticks
  const openLen = countChar(s, p, e, 96)
  let i = p + openLen
  
  // Find matching closing backticks
  while (i < e) {
    const j = s.indexOf('`', i)
    if (j < 0) return null
    
    const closeLen = countChar(s, j, e, 96)
    if (closeLen === openLen) {
      // Found matching close
      let content = s.slice(p + openLen, j)
      // Normalize whitespace
      content = content.replace(/\n/g, ' ')
      // Strip one space from each end if both ends have space and there's non-space content
      if (content.length > 0 && content[0] === ' ' && content[content.length - 1] === ' ' &&
          content.trim().length > 0) {
        content = content.slice(1, -1)
      }
      
      return {
        node: {
          type: RuleType.codeInline,
          text: content,
        } as MarkdownToJSX.CodeInlineNode,
        end: j + closeLen
      }
    }
    i = j + closeLen
  }
  
  return null
}

/** Skip over a code span starting at position i, return position after code span or i if not a code span */
function skipCodeSpan(s: string, i: number, e: number): number {
  if (s.charCodeAt(i) !== 96) return i
  const openLen = countChar(s, i, e, 96)
  let j = i + openLen
  while (j < e) {
    const k = s.indexOf('`', j)
    if (k < 0) return i // no close found, not a valid code span
    const closeLen = countChar(s, k, e, 96)
    if (closeLen === openLen) return k + closeLen // return position after code span
    j = k + closeLen
  }
  return i // no valid close
}

/** Skip over an inline HTML element (including content and closing tag) starting at position i */
function skipInlineHTMLElement(s: string, i: number, e: number): number {
  if (s.charCodeAt(i) !== 60) return i // <
  
  // Check for closing tag or comment
  if (i + 1 < e && s.charCodeAt(i + 1) === 47) { // </
    // Closing tag - just skip to >
    let j = i + 2
    while (j < e && s.charCodeAt(j) !== 62) j++
    return j < e ? j + 1 : i
  }
  
  if (i + 3 < e && s.charCodeAt(i + 1) === 33 && s.charCodeAt(i + 2) === 45 && s.charCodeAt(i + 3) === 45) {
    // HTML comment <!-- -->
    const closeIdx = s.indexOf('-->', i + 4)
    return closeIdx >= 0 ? closeIdx + 3 : i
  }
  
  // Get tag name
  let j = i + 1
  const tagStart = j
  while (j < e) {
    const c = s.charCodeAt(j)
    if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57) || c === 45) {
      j++
    } else {
      break
    }
  }
  if (j === tagStart) return i // not a valid tag
  const tag = s.slice(tagStart, j).toLowerCase()
  
  // Skip to end of opening tag
  let selfClosing = false
  while (j < e) {
    const c = s.charCodeAt(j)
    if (c === 62) { // >
      j++
      break
    }
    if (c === 47 && j + 1 < e && s.charCodeAt(j + 1) === 62) { // />
      j += 2
      selfClosing = true
      break
    }
    if (c === 10) return i // newline in tag
    j++
  }
  
  if (selfClosing) return j
  
  // Void elements don't have closing tags
  const voidElements = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'])
  if (voidElements.has(tag)) return j
  
  // Find matching closing tag
  let depth = 1
  while (j < e && depth > 0) {
    if (s.charCodeAt(j) === 60) { // <
      if (j + 1 < e && s.charCodeAt(j + 1) === 47) { // </
        // Check if it's closing our tag
        const closeTagStart = j + 2
        let k = closeTagStart
        while (k < e && ((s.charCodeAt(k) >= 65 && s.charCodeAt(k) <= 90) || (s.charCodeAt(k) >= 97 && s.charCodeAt(k) <= 122))) k++
        const closeTag = s.slice(closeTagStart, k).toLowerCase()
        if (closeTag === tag) {
          // Skip to end of closing tag
          while (k < e && s.charCodeAt(k) !== 62) k++
          if (k < e) k++ // skip >
          depth--
          if (depth === 0) return k
        }
        j = k
      } else {
        // Opening tag - check if same tag
        const nextTagStart = j + 1
        let k = nextTagStart
        while (k < e && ((s.charCodeAt(k) >= 65 && s.charCodeAt(k) <= 90) || (s.charCodeAt(k) >= 97 && s.charCodeAt(k) <= 122))) k++
        const nextTag = s.slice(nextTagStart, k).toLowerCase()
        if (nextTag === tag) depth++
        j++
      }
    } else {
      j++
    }
  }
  
  return j
}

/** Skip over a link [text](url) or [text][ref] starting at position i */
function skipLinkOrImage(s: string, i: number, e: number): number {
  // Check for ![
  const isImage = s.charCodeAt(i) === 33
  const start = isImage ? i + 1 : i
  
  if (s.charCodeAt(start) !== 91) return i // [
  
  // Find closing ]
  let depth = 1
  let j = start + 1
  while (j < e && depth > 0) {
    const c = s.charCodeAt(j)
    if (c === 92 && j + 1 < e) { j += 2; continue } // escape
    if (c === 91) depth++
    else if (c === 93) depth--
    j++
  }
  if (depth !== 0) return i
  
  // j is now past the ]
  if (j >= e) return j // just [text]
  
  const nextChar = s.charCodeAt(j)
  
  // Inline link: [text](url)
  if (nextChar === 40) { // (
    let parenDepth = 1
    j++
    while (j < e && parenDepth > 0) {
      const c = s.charCodeAt(j)
      if (c === 92 && j + 1 < e) { j += 2; continue }
      if (c === 40) parenDepth++
      else if (c === 41) parenDepth--
      j++
    }
    return j
  }
  
  // Reference link: [text][ref]
  if (nextChar === 91) { // [
    let depth2 = 1
    j++
    while (j < e && depth2 > 0) {
      const c = s.charCodeAt(j)
      if (c === 91) depth2++
      else if (c === 93) depth2--
      j++
    }
    return j
  }
  
  return j // shortcut link [text]
}

/** Scan strikethrough ~~text~~ */
function scanStrikethrough(s: string, p: number, e: number, state: MarkdownToJSX.State, opts: any): ScanResult {
  if (s.charCodeAt(p) !== 126 || p + 1 >= e || s.charCodeAt(p + 1) !== 126) return null // ~~
  
  // Find closing ~~, skipping over code spans
  let i = p + 2
  while (i + 1 < e) {
    const c = s.charCodeAt(i)
    // Skip code spans - they take precedence
    if (c === 96) {
      const afterCode = skipCodeSpan(s, i, e)
      if (afterCode > i) { i = afterCode; continue }
    }
    if (c === 126 && s.charCodeAt(i + 1) === 126) {
      const content = s.slice(p + 2, i)
      const children = parseInline(content, 0, content.length, state, opts)
      return {
        node: {
          type: RuleType.textFormatted,
          tag: 'del',
          children,
        } as MarkdownToJSX.TextFormattedNode,
        end: i + 2
      }
    }
    if (c === 92 && i + 1 < e) i++ // escape
    i++
  }
  
  return null
}

/** Scan marked text ==text== */
function scanMarked(s: string, p: number, e: number, state: MarkdownToJSX.State, opts: any): ScanResult {
  if (s.charCodeAt(p) !== 61 || p + 1 >= e || s.charCodeAt(p + 1) !== 61) return null // ==
  
  // Find closing ==, skipping over code spans
  let i = p + 2
  while (i + 1 < e) {
    const c = s.charCodeAt(i)
    // Skip code spans - they take precedence
    if (c === 96) {
      const afterCode = skipCodeSpan(s, i, e)
      if (afterCode > i) { i = afterCode; continue }
    }
    if (c === 61 && s.charCodeAt(i + 1) === 61) {
      const content = s.slice(p + 2, i)
      const children = parseInline(content, 0, content.length, state, opts)
      return {
        node: {
          type: RuleType.textFormatted,
          tag: 'mark',
          children,
        } as MarkdownToJSX.TextFormattedNode,
        end: i + 2
      }
    }
    if (c === 92 && i + 1 < e) i++ // escape
    i++
  }
  
  return null
}

/** Scan emphasis (* or _) */
function scanEmphasis(s: string, p: number, e: number, state: MarkdownToJSX.State, opts: any): ScanResult {
  const ch = s.charCodeAt(p)
  if (ch !== 42 && ch !== 95) return null // * or _
  
  const delimLen = countChar(s, p, e, ch)
  if (delimLen === 0) return null
  
  // Check left-flanking
  const before = p > 0 ? s.charCodeAt(p - 1) : 32
  const after = p + delimLen < e ? s.charCodeAt(p + delimLen) : 32
  
  const beforeWS = cc(before) & C_WS
  const afterWS = cc(after) & C_WS
  const beforePunct = cc(before) & C_PUNCT
  const afterPunct = cc(after) & C_PUNCT
  
  const leftFlanking = !afterWS && (!afterPunct || beforeWS || beforePunct)
  const rightFlanking = !beforeWS && (!beforePunct || afterWS || afterPunct)
  
  // For _ we need stricter rules per CommonMark spec
  // Can open: left-flanking AND (not right-flanking OR preceded by punctuation)
  const canOpen = ch === 42 
    ? leftFlanking 
    : leftFlanking && (!rightFlanking || beforePunct)
  
  if (!canOpen) return null
  
  // Find closing delimiter, skipping code spans
  let searchPos = p + delimLen
  
  while (searchPos < e) {
    const c = s.charCodeAt(searchPos)
    
    if (c === 92 && searchPos + 1 < e) {
      searchPos += 2 // skip escape
      continue
    }
    
    // Skip code spans - they take precedence
    if (c === 96) {
      const afterCode = skipCodeSpan(s, searchPos, e)
      if (afterCode > searchPos) { searchPos = afterCode; continue }
    }
    
    // Skip inline HTML tags - content inside HTML tags shouldn't close emphasis
    if (c === 60) { // <
      const afterHTML = skipInlineHTMLElement(s, searchPos, e)
      if (afterHTML > searchPos) { searchPos = afterHTML; continue }
    }
    
    // Skip links/images - content inside shouldn't close emphasis
    if (c === 91 || (c === 33 && searchPos + 1 < e && s.charCodeAt(searchPos + 1) === 91)) { // [ or ![
      const afterLink = skipLinkOrImage(s, searchPos, e)
      if (afterLink > searchPos) { searchPos = afterLink; continue }
    }
    
    if (c === ch) {
      const closeLen = countChar(s, searchPos, e, ch)
      const closeBefore = searchPos > 0 ? s.charCodeAt(searchPos - 1) : 32
      const closeAfter = searchPos + closeLen < e ? s.charCodeAt(searchPos + closeLen) : 32
      
      const closeBeforeWS = cc(closeBefore) & C_WS
      const closeAfterWS = cc(closeAfter) & C_WS
      const closeBeforePunct = cc(closeBefore) & C_PUNCT
      const closeAfterPunct = cc(closeAfter) & C_PUNCT
      
      // Right-flanking: not preceded by whitespace, and either not preceded by punctuation or followed by whitespace/punctuation
      const closeRightFlanking = !closeBeforeWS && (!closeBeforePunct || closeAfterWS || closeAfterPunct)
      // Left-flanking at close position
      const closeLeftFlanking = !closeAfterWS && (!closeAfterPunct || closeBeforeWS || closeBeforePunct)
      
      // Can close: for *, just right-flanking; for _, right-flanking AND (not left-flanking OR followed by punctuation)
      const closeCanClose = ch === 42
        ? closeRightFlanking
        : closeRightFlanking && (!closeLeftFlanking || closeAfterPunct)
      
      if (closeCanClose) {
        // For triple+ emphasis like ___text___, we want:
        // - If both sides have 3+, consume 1 (em) and let recursive parse handle 2 (strong)
        // - Otherwise consume min of both sides, capped at 2
        let useLen: number
        if (delimLen >= 3 && closeLen >= 3) {
          useLen = 1 // em wrapping inner strong
        } else {
          useLen = Math.min(delimLen, closeLen, 2)
        }
        
        // Content is between consumed delimiters on both ends
        // For triple emphasis: consume 1 from each side, content includes inner delimiters
        const contentEnd = searchPos + closeLen - useLen
        const content = s.slice(p + useLen, contentEnd)
        const children = parseInline(content, 0, content.length, state, opts)
        
        return {
          node: {
            type: RuleType.textFormatted,
            tag: useLen === 2 ? 'strong' : 'em',
            children,
          } as MarkdownToJSX.TextFormattedNode,
          end: searchPos + closeLen
        }
      }
      searchPos += closeLen
    } else {
      searchPos++
    }
  }
  
  return null
}

/** Scan link [text](url) or ![alt](url) or [text][ref] or [text] */
function scanLink(s: string, p: number, e: number, state: MarkdownToJSX.State, opts: any): ScanResult {
  const isImage = s.charCodeAt(p) === 33 // !
  const start = isImage ? p + 1 : p
  
  if (s.charCodeAt(start) !== 91) return null // [
  
  // Find closing ]
  let depth = 1, i = start + 1
  while (i < e && depth > 0) {
    const c = s.charCodeAt(i)
    if (c === 92 && i + 1 < e) { i += 2; continue }
    if (c === 91) depth++
    else if (c === 93) depth--
    i++
  }
  if (depth !== 0) return null
  
  const textEnd = i - 1
  const text = s.slice(start + 1, textEnd)
  
  // Check what follows the ]
  const nextChar = i < e ? s.charCodeAt(i) : 0
  
  // Inline link: [text](url)
  if (nextChar === 40) { // (
    i++
    
    // Skip whitespace
    while (i < e && (s.charCodeAt(i) === 32 || s.charCodeAt(i) === 10)) i++
    
    // Parse URL (can be in angle brackets or bare)
    let url = '', urlEnd = i
    if (i < e && s.charCodeAt(i) === 60) { // <url>
      i++
      urlEnd = i
      while (urlEnd < e && s.charCodeAt(urlEnd) !== 62) {
        if (s.charCodeAt(urlEnd) === 10) return null // no newlines in angle URLs
        urlEnd++
      }
      if (urlEnd >= e) return null
      url = s.slice(i, urlEnd)
      urlEnd++ // skip >
    } else {
      // Bare URL - count parens
      let parenDepth = 0
      while (urlEnd < e) {
        const c = s.charCodeAt(urlEnd)
        if (c === 92 && urlEnd + 1 < e) { urlEnd += 2; continue }
        if (c === 40) parenDepth++
        else if (c === 41) {
          if (parenDepth === 0) break
          parenDepth--
        }
        else if (c === 32 || c === 10) break
        urlEnd++
      }
      url = s.slice(i, urlEnd)
    }
  
    i = urlEnd
    // Skip whitespace
    while (i < e && (s.charCodeAt(i) === 32 || s.charCodeAt(i) === 10)) i++
    
    // Optional title
    let title: string | undefined
    if (i < e) {
      const tc = s.charCodeAt(i)
      if (tc === 34 || tc === 39 || tc === 40) { // " ' (
        const closeChar = tc === 40 ? 41 : tc
        i++
        const titleStart = i
        while (i < e && s.charCodeAt(i) !== closeChar) {
          if (s.charCodeAt(i) === 92 && i + 1 < e) i++
          i++
        }
        if (i >= e) return null
        title = s.slice(titleStart, i)
        i++ // skip close quote
      }
    }
    
    // Skip whitespace and find closing )
    while (i < e && (s.charCodeAt(i) === 32 || s.charCodeAt(i) === 10)) i++
    if (i >= e || s.charCodeAt(i) !== 41) return null
    i++
    
    // Sanitize URL - remove dangerous protocols
    const sanitizer = opts?.sanitizer || util.sanitizer
    const sanitizedUrl = sanitizer(url, isImage ? 'img' : 'a', isImage ? 'src' : 'href')
    const safeUrl = sanitizedUrl === null ? null : url
    
    if (isImage) {
      return {
        node: {
          type: RuleType.image,
          target: safeUrl,
          alt: unescapeString(text),
          title,
        } as MarkdownToJSX.ImageNode,
        end: i
      }
    } else {
      const children = state.inAnchor ? [{ type: RuleType.text, text } as MarkdownToJSX.TextNode]
        : parseInline(text, 0, text.length, { ...state, inAnchor: true }, opts)
      return {
        node: {
          type: RuleType.link,
          target: safeUrl,
          title,
          children,
        } as MarkdownToJSX.LinkNode,
        end: i
      }
    }
  }
  
  // Reference link: [text][ref] or [text][] or [text]
  let label = text.trim().toLowerCase()
  
  if (nextChar === 91) { // [
    // Full reference [text][ref] or collapsed [text][]
    const refStart = i + 1
    let refEnd = refStart
    while (refEnd < e && s.charCodeAt(refEnd) !== 93) {
      if (s.charCodeAt(refEnd) === 10) return null
      refEnd++
    }
    if (refEnd >= e) return null
    const ref = s.slice(refStart, refEnd).trim()
    if (ref) label = ref.toLowerCase()
    i = refEnd + 1
  }
  
  // Look up reference
  const refData = state.refs[label]
  if (!refData) return null
  
  if (isImage) {
    return {
      node: {
        type: RuleType.image,
        target: refData.target,
        alt: text,
        title: refData.title,
      } as MarkdownToJSX.ImageNode,
      end: i
    }
  } else {
    const children = state.inAnchor ? [{ type: RuleType.text, text } as MarkdownToJSX.TextNode]
      : parseInline(text, 0, text.length, { ...state, inAnchor: true }, opts)
    return {
      node: {
        type: RuleType.link,
        target: refData.target,
        title: refData.title,
        children,
      } as MarkdownToJSX.LinkNode,
      end: i
    }
  }
}

/** Scan autolink <url> or <email> */
function scanAutolink(s: string, p: number, e: number): ScanResult {
  if (s.charCodeAt(p) !== 60) return null // <
  
  let i = p + 1
  // Find closing >
  while (i < e && s.charCodeAt(i) !== 62 && s.charCodeAt(i) !== 10) i++
  if (i >= e || s.charCodeAt(i) !== 62) return null
  
  const content = s.slice(p + 1, i)
  
  // Check for URL scheme
  const schemeMatch = content.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/)
  if (schemeMatch) {
    return {
      node: {
        type: RuleType.link,
        target: content,
        children: [{ type: RuleType.text, text: content } as MarkdownToJSX.TextNode],
      } as MarkdownToJSX.LinkNode,
      end: i + 1
    }
  }
  
  // Check for email
  if (content.includes('@') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(content)) {
    return {
      node: {
        type: RuleType.link,
        target: 'mailto:' + content,
        children: [{ type: RuleType.text, text: content } as MarkdownToJSX.TextNode],
      } as MarkdownToJSX.LinkNode,
      end: i + 1
    }
  }
  
  return null
}

/** Scan footnote reference [^id] */
function scanFootnoteRef(s: string, p: number, e: number, state: MarkdownToJSX.State): ScanResult {
  // Must start with [^
  if (s.charCodeAt(p) !== 91 || p + 1 >= e || s.charCodeAt(p + 1) !== 94) return null
  
  let i = p + 2
  // Find closing ]
  while (i < e && s.charCodeAt(i) !== 93 && s.charCodeAt(i) !== 10) i++
  if (i >= e || s.charCodeAt(i) !== 93) return null
  
  const id = s.slice(p + 2, i)
  if (!id) return null
  
  // Return footnote reference regardless of whether ref exists
  // (refs get populated during first pass)
  return {
    node: {
      type: RuleType.footnoteReference,
      target: '#' + util.slugify(id),
      text: id,
    } as MarkdownToJSX.FootnoteReferenceNode,
    end: i + 1
  }
}

/** Scan bare URL (https://... or http://...) */
function scanBareUrl(s: string, p: number, e: number, opts: any): ScanResult {
  if (opts.disableBareUrls) return null
  
  // Check for http:// or https://
  const rest = s.slice(p, Math.min(p + 8, e))
  let prefix = ''
  if (rest.startsWith('https://')) prefix = 'https://'
  else if (rest.startsWith('http://')) prefix = 'http://'
  else return null
  
  // Find end of URL (stop at whitespace or common punctuation at end)
  let i = p + prefix.length
  while (i < e) {
    const c = s.charCodeAt(i)
    // Stop at whitespace
    if (c === 32 || c === 10 || c === 9 || c === 13) break
    // Stop at certain characters that are unlikely to be part of URL
    if (c === 60 || c === 62) break // < >
    i++
  }
  
  // Trim trailing punctuation that's not part of URL
  let end = i
  while (end > p + prefix.length) {
    const c = s.charCodeAt(end - 1)
    if (c === 46 || c === 44 || c === 59 || c === 58 || // . , ; :
        c === 33 || c === 63 || c === 41) { // ! ? )
      // But keep ) if there's a matching (
      if (c === 41) {
        const url = s.slice(p, end)
        const openCount = (url.match(/\(/g) || []).length
        const closeCount = (url.match(/\)/g) || []).length
        if (openCount >= closeCount) break
      }
      end--
    } else {
      break
    }
  }
  
  if (end <= p + prefix.length) return null
  
  const url = s.slice(p, end)
  
  // Validate domain - underscores not allowed in final two segments (TLD and SLD)
  // Extract domain from URL (between :// and first / or end)
  const domainStart = prefix.length
  let domainEnd = url.indexOf('/', domainStart)
  if (domainEnd < 0) domainEnd = url.length
  const domain = url.slice(domainStart, domainEnd)
  // Split domain into segments and check last two
  const segments = domain.split('.')
  if (segments.length >= 2) {
    const lastTwo = segments.slice(-2)
    if (lastTwo.some(seg => seg.includes('_'))) {
      return null // Invalid domain - underscore in final segments
    }
  } else if (segments.length === 1 && segments[0].includes('_')) {
    return null // Single segment with underscore
  }
  
  return {
    node: {
      type: RuleType.link,
      target: url,
      children: [{ type: RuleType.text, text: url } as MarkdownToJSX.TextNode],
    } as MarkdownToJSX.LinkNode,
    end
  }
}

/** Create a text node with entity decoding */
function textNode(text: string): MarkdownToJSX.TextNode {
  // Decode HTML entities if present
  const decoded = text.includes('&') ? util.decodeEntityReferences(text) : text
  return { type: RuleType.text, text: decoded } as MarkdownToJSX.TextNode
}

/** Scan inline HTML element */
function scanInlineHTML(s: string, p: number, e: number, state: MarkdownToJSX.State, opts: any): ScanResult {
  if (s.charCodeAt(p) !== 60) return null // <
  
  // Check for HTML comment
  if (s.slice(p, p + 4) === '<!--') {
    const endComment = s.indexOf('-->', p + 4)
    if (endComment !== -1) {
      return {
        node: {
          type: RuleType.htmlComment,
          text: s.slice(p + 4, endComment),
        } as MarkdownToJSX.HTMLCommentNode,
        end: endComment + 3
      }
    }
    return null
  }
  
  // Parse opening tag
  const tagResult = parseHTMLTag(s, p)
  if (!tagResult) return null
  
  const tagName = tagResult.tag
  const tagNameLower = tagName.toLowerCase()
  
  // Self-closing tag or void element
  if (tagResult.selfClosing || util.isVoidElement(tagName)) {
    return {
      node: {
        type: RuleType.htmlSelfClosing,
        tag: tagName,
        attrs: processHTMLAttributes(tagResult.attrs, tagName, opts),
        // Note: inline self-closing does NOT include rawText - matches original parser
      } as MarkdownToJSX.HTMLSelfClosingNode,
      end: tagResult.end
    }
  }
  
  // Verbatim tags (script, style, pre, textarea)
  const isVerbatim = TYPE1_TAGS.has(tagNameLower)
  
  // Find closing tag (within the inline scope)
  const closeEnd = findClosingTag(s.slice(0, e), tagResult.end, tagName)
  if (closeEnd === -1) {
    // No closing tag found - might be unclosed or extends past inline scope
    return null
  }
  
  // Find where closing tag starts  
  const closeTagStart = lastIndexOfCI(s, '</' + tagNameLower, closeEnd)
  const innerContent = s.slice(tagResult.end, closeTagStart)
  
  let children: MarkdownToJSX.ASTNode[] = []
  
  if (isVerbatim) {
    // Keep content as raw text
    if (innerContent.trim()) {
      children = [{
        type: RuleType.text,
        text: innerContent,
      } as MarkdownToJSX.TextNode]
    }
  } else {
    // Parse inner content as inline
    // If we're inside an anchor tag, set inAnchor to prevent bare URL autolinking
    const trimmed = innerContent.trim()
    if (trimmed) {
      const innerState = tagNameLower === 'a' ? { ...state, inAnchor: true } : state
      // Check if content starts with a clear block construct
      // Be careful: * can be emphasis OR list, # is heading, etc.
      // Only parse as blocks if it's clearly block-level (has paragraph breaks or starts with heading)
      const hasBlocks = /\n\n/.test(trimmed) || /^#{1,6}\s/.test(trimmed)
      if (hasBlocks) {
        children = parseBlocks(trimmed, { ...innerState, inline: false }, opts)
      } else {
        children = parseInline(trimmed, 0, trimmed.length, innerState, opts)
      }
    }
  }
  
  // rawText should be the content from after opening tag to end of closing tag
  return {
    node: {
      type: RuleType.htmlBlock,
      tag: tagName,
      attrs: processHTMLAttributes(tagResult.attrs, tagName, opts),
      rawAttrs: tagResult.rawAttrs,
      children,
      // Note: inline HTML does NOT include rawText - this matches original parser behavior
      // rawText is only set for block-level HTML
      text: innerContent,
      verbatim: false, // inline HTML is never verbatim
    } as MarkdownToJSX.HTMLNode,
    end: closeEnd
  }
}

/** Parse inline content */
// Maximum inline recursion depth
const MAX_INLINE_DEPTH = 200

// Reusable state object to avoid allocations - use counter for depth tracking
let _globalInlineDepth = 0

function parseInline(s: string, p: number, e: number, state: MarkdownToJSX.State, opts: any): MarkdownToJSX.ASTNode[] {
  // Track inline depth using global counter for stack overflow protection
  _globalInlineDepth++
  if (_globalInlineDepth > MAX_INLINE_DEPTH) {
    _globalInlineDepth--
    // Return content as plain text to prevent stack overflow
    return [{ type: RuleType.text, text: s.slice(p, e) }]
  }
  
  // Use state directly to avoid object spread allocation
  const childState = state
  
  // If streaming mode, preprocess to strip incomplete markers BEFORE parsing
  // This prevents bare URLs inside incomplete links from being autolinked
  if (opts.streaming || opts.optimizeForStreaming) {
    let content = s.slice(p, e)
    const original = content
    // Strip incomplete bold markers **text
    content = content.replace(/\*\*([^*]+)$/, '$1')
    // Strip incomplete italic markers *text
    if (/\*[^*]+$/.test(content)) {
      content = content.replace(/\*([^*]+)$/, '$1')
    }
    // Strip incomplete underscore bold markers __text
    content = content.replace(/__([^_]+)$/, '$1')
    // Strip incomplete underscore italic markers _text
    if (/_[^_]+$/.test(content)) {
      content = content.replace(/_([^_]+)$/, '$1')
    }
    // Strip incomplete strikethrough markers ~~text
    content = content.replace(/~~([^~]+)$/, '$1')
    // Strip incomplete inline code - count backticks to detect unmatched
    // Only strip if there's an unmatched opening backtick
    let backtickCount = 0
    let lastBacktickPos = -1
    for (let bi = 0; bi < content.length; bi++) {
      if (content.charCodeAt(bi) === 96) { // `
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
        if (content.charCodeAt(i) === 96) {
          if (!inCode) {
            codeStart = i
            inCode = true
          } else {
            inCode = false
            codeStart = -1
          }
        }
        i++
      }
      if (inCode && codeStart !== -1) {
        content = content.slice(0, codeStart)
      }
    }
    // Strip incomplete link/image markers - strip everything from [ onwards if no closing ]
    content = content.replace(/!?\[([^\]]*$)/, '$1')
    // Strip [text]( without closing ) - partial inline link
    content = content.replace(/!?\[([^\]]+)\]\([^)]*$/, '$1 ')
    // Strip [text][ref without closing ]
    content = content.replace(/!?\[([^\]]+)\]\[[^\]]*$/, '$1')
    
    if (content !== original) {
      s = s.slice(0, p) + content
      e = p + content.length
    }
  }
  
  const nodes: MarkdownToJSX.ASTNode[] = []
  let textStart = p
  
  while (p < e) {
    const c = s.charCodeAt(p)
    let result: ScanResult = null
    
    // Try inline scanners
    if (c === 96) { // `
      result = scanCodeSpan(s, p, e)
    } else if (c === 42 || c === 95) { // * or _
      result = scanEmphasis(s, p, e, childState, opts)
    } else if (c === 126) { // ~
      result = scanStrikethrough(s, p, e, childState, opts)
    } else if (c === 61) { // = - potential ==marked==
      result = scanMarked(s, p, e, childState, opts)
    } else if (c === 91) { // [
      // Check for footnote reference [^id] first
      if (p + 1 < e && s.charCodeAt(p + 1) === 94) { // ^
        result = scanFootnoteRef(s, p, e, childState)
      }
      if (!result) {
        result = scanLink(s, p, e, childState, opts)
      }
    } else if (c === 33 && p + 1 < e && s.charCodeAt(p + 1) === 91) { // ![
      result = scanLink(s, p, e, childState, opts)
    } else if (c === 60) { // < - HTML or autolink
      if (!opts.disableParsingRawHTML) {
        // Try inline HTML first
        result = scanInlineHTML(s, p, e, childState, opts)
      }
      if (!result && !opts.disableAutoLink) {
        result = scanAutolink(s, p, e)
      }
    } else if (c === 104 && !childState.inAnchor && !opts.disableAutoLink) { // h - potential http:// or https://
      // Don't match bare URLs if previous char was < (failed angle autolink)
      if (p === 0 || s.charCodeAt(p - 1) !== 60) {
        result = scanBareUrl(s, p, e, opts)
      }
    }
    
    if (result) {
      // Flush text before this
      if (p > textStart) {
        nodes.push(textNode(s.slice(textStart, p)))
      }
      nodes.push(result.node)
      p = result.end
      textStart = p
    } else {
      // Handle escapes
      if (c === 92 && p + 1 < e) {
        const next = s.charCodeAt(p + 1)
        if (cc(next) & C_PUNCT) {
          if (p > textStart) {
            nodes.push(textNode(s.slice(textStart, p)))
          }
          nodes.push(textNode(s[p + 1]))
          p += 2
          textStart = p
          continue
        }
      }
      p++
    }
  }
  
  // Flush remaining text
  if (e > textStart) {
    let remainingText = s.slice(textStart, e)
    
    // If streaming mode is enabled, strip incomplete markers from end of text
    if (opts.streaming || opts.optimizeForStreaming) {
      // Strip incomplete bold markers **text
      remainingText = remainingText.replace(/\*\*([^*]+)$/, '$1')
      // Strip incomplete italic markers *text (but not after stripping bold)
      if (remainingText.match(/\*[^*]+$/)) {
        remainingText = remainingText.replace(/\*([^*]+)$/, '$1')
      }
      // Strip incomplete underscore bold markers __text
      remainingText = remainingText.replace(/__([^_]+)$/, '$1')
      // Strip incomplete underscore italic markers _text
      if (remainingText.match(/_[^_]+$/)) {
        remainingText = remainingText.replace(/_([^_]+)$/, '$1')
      }
      // Strip incomplete strikethrough markers ~~text
      remainingText = remainingText.replace(/~~([^~]+)$/, '$1')
      // Strip incomplete link markers [text (no ])
      remainingText = remainingText.replace(/\[([^\]]+)$/, '$1')
      // Strip [text]( without closing ) - partial inline link
      remainingText = remainingText.replace(/\[([^\]]+)\]\([^)]*$/, '$1')
    }
    
    if (remainingText) {
      nodes.push(textNode(remainingText))
    }
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

function parseBlocks(s: string, state: MarkdownToJSX.State, opts: any): MarkdownToJSX.ASTNode[] {
  // Track depth in state for stack overflow protection
  const depth = (state as any)._depth || 0
  
  // Protect against stack overflow from deeply nested input
  if (depth > MAX_PARSE_DEPTH) {
    // Return content as plain text to prevent stack overflow
    return [{ type: RuleType.text, text: s }]
  }
  
  // Create new state with incremented depth for recursive calls
  const childState = { ...state, _depth: depth + 1 } as any
  
  // For streaming mode: strip incomplete tables (header + separator without data rows)
  // Only strip if the table is at the END of the input (might be incomplete during streaming)
  if (opts.streaming || opts.optimizeForStreaming) {
    // Pattern: table at end with only header + separator (no data rows after)
    // Match: | header |\n| --- | followed by end of string or non-pipe line
    const match = s.match(/(\|[^\n]+\n\|[\s\-:|]+\n?)$/)
    if (match) {
      const tableText = match[1]
      const lines = tableText.split('\n').filter(l => l.trim() && l.includes('|'))
      // Only strip if just 2 lines (header + separator) - no data rows
      if (lines.length <= 2) {
        s = s.slice(0, s.length - match[1].length)
      }
    }
    
    // Also handle single-line incomplete table (header and partial separator on same line)
    // Pattern: | header | ... | :--- | :--- (all on one line, ends input)
    // This catches tables being typed where the separator hasn't been moved to its own line yet
    if (/^\|[^|\n]*(\|[^|\n]*)+\|?\s*(:?-+:?\s*\|?\s*)+$/m.test(s.trim())) {
      const lines = s.trim().split('\n')
      const lastLine = lines[lines.length - 1]
      // If last line looks like incomplete table header + separator combo, strip it
      if (/\|[^|]+\|[^|]*:?-+/.test(lastLine) && !/\n/.test(lastLine.trim())) {
        s = s.slice(0, s.lastIndexOf(lastLine)).trimEnd()
      }
    }
  }
  
  // If inline mode, just parse as inline content directly
  if (state.inline) {
    return parseInline(s, 0, s.length, state, opts)
  }
  
  const nodes: MarkdownToJSX.ASTNode[] = []
  let p = 0
  const e = s.length
  
  // Check for frontmatter at the start of the document
  if (p === 0 && s.startsWith('---')) {
    const bounds = util.parseFrontmatterBounds(s)
    if (bounds) {
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
    // Skip blank lines
    while (p < e) {
      const le = lineEnd(s, p)
      if (!isBlank(s, p, le)) break
      p = nextLine(s, le)
    }
    if (p >= e) break
    
    const le = lineEnd(s, p)
    indent(s, p, le)
    
    let result: ScanResult = null
    
    // Check for indented code block (4+ spaces) - but not in list context
    if (_indentSpaces >= 4 && !state.inList) {
      result = scanIndented(s, p)
    } else {
      const i = p + _indentChars
      const c = s.charCodeAt(i)
      
      // Try block scanners based on first character
      if (c === 35) { // #
        result = scanHeading(s, p, state, opts)
      } else if (c === 62) { // >
        result = scanBlockquote(s, p, state, opts)
      } else if (c === 96 || c === 126) { // ` or ~
        result = scanFenced(s, p, state)
      } else if (c === 45 || c === 42 || c === 95) { // - * _
        result = scanThematic(s, p)
        if (!result) result = scanList(s, p, state, opts)
      } else if (c === 43 || (c >= 48 && c <= 57)) { // + or digit
        result = scanList(s, p, state, opts)
      } else if (c === 60) { // <
        result = scanHTMLBlock(s, p, state, opts)
      } else if (c === 124) { // |
        result = scanTable(s, p, state, opts)
      } else if (c === 91) { // [ - could be reference definition
        result = scanRefDefinition(s, p, state)
      }
    }
    
    // Try table if line contains |
    if (!result && s.slice(p, lineEnd(s, p)).includes('|')) {
      result = scanTable(s, p, state, opts)
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
      p = result.end
    } else {
      // Skip line if nothing matched
      p = nextLine(s, lineEnd(s, p))
    }
  }
  
  return nodes
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

export function parseMarkdownCompact(
  source: string,
  state?: MarkdownToJSX.State,
  options?: any
): MarkdownToJSX.ASTNode[] {
  // Reset global depth counter at the start of each parse
  _globalInlineDepth = 0
  
  // Normalize input
  const normalized = util.normalizeInput(source)
  
  const defaultState: MarkdownToJSX.State = {
    inline: false,
    inAnchor: false,
    inHTML: false,
    inList: false,
    inBlockQuote: false,
    refs: {},
  }
  
  const actualState = state || defaultState
  const nodes = parseBlocks(normalized, actualState, options || {})
  
  // Add refCollection node at the start if there are refs
  if (actualState.refs && Object.keys(actualState.refs).length > 0) {
    return [
      { type: RuleType.refCollection, refs: actualState.refs } as MarkdownToJSX.ReferenceCollectionNode,
      ...nodes
    ]
  }
  
  return nodes
}

/**
 * Main parser entry point - matches original parser interface
 */
export function parser(
  source: string,
  options?: MarkdownToJSX.Options
): MarkdownToJSX.ASTNode[] {
  // Reset global depth counter at the start of each parse
  _globalInlineDepth = 0
  
  // Strip BOM (U+FEFF) at document start per CommonMark spec
  if (source.charCodeAt(0) === 0xfeff) {
    source = source.slice(1)
  }

  // Normalize input: replace null bytes with U+FFFD per CommonMark spec
  source = util.normalizeInput(source)

  // Default state with refs object
  const state: MarkdownToJSX.State = {
    inline: false,
    inAnchor: false,
    inHTML: false,
    inList: false,
    inBlockQuote: false,
    refs: {},
  }

  // Normalize options
  const finalOptions = {
    ...options,
    slugify: options?.slugify
      ? (input: string) => options.slugify!(input, util.slugify)
      : util.slugify,
    sanitizer: options?.sanitizer || util.sanitizer,
    tagfilter: options?.tagfilter !== false,
  }

  // Parse markdown
  const nodes = parseBlocks(source, state, finalOptions)
  
  // Add refCollection node at the start if there are refs
  if (state.refs && Object.keys(state.refs).length > 0) {
    return [
      { type: RuleType.refCollection, refs: state.refs } as MarkdownToJSX.ReferenceCollectionNode,
      ...nodes
    ]
  }
  
  return nodes
}

// Export for testing
export { parseBlocks, parseInline, scanHeading, scanThematic, scanFenced, scanBlockquote }

// Export parseMarkdown with refCollection node for react.tsx compatibility
export function parseMarkdown(
  input: string,
  state: MarkdownToJSX.State,
  opts: any
): MarkdownToJSX.ASTNode[] {
  // Reset global depth counter at the start of each parse
  _globalInlineDepth = 0
  
  const nodes = parseBlocks(input, state, opts)
  
  // Add refCollection node at the start if there are refs
  if (state.refs && Object.keys(state.refs).length > 0) {
    return [
      { type: RuleType.refCollection, refs: state.refs } as MarkdownToJSX.ReferenceCollectionNode,
      ...nodes
    ]
  }
  
  return nodes
}
