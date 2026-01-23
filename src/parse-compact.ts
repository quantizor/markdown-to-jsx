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
): { tag: string; attrs: Record<string, string>; selfClosing: boolean; end: number } | null {
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
  
  const tag = source.slice(tagStart, i).toLowerCase()
  const attrs: Record<string, string> = {}
  
  // Skip whitespace and parse attributes
  while (i < len) {
    // Skip whitespace
    while (i < len && (source.charCodeAt(i) === 32 || source.charCodeAt(i) === 9 || source.charCodeAt(i) === 10)) i++
    
    const c = source.charCodeAt(i)
    if (c === 62) { // >
      return { tag, attrs, selfClosing: false, end: i + 1 }
    }
    if (c === 47 && i + 1 < len && source.charCodeAt(i + 1) === 62) { // />
      return { tag, attrs, selfClosing: true, end: i + 2 }
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
    
    // Check for [
    if (spaces < 4 && i < end && input.charCodeAt(i) === 91) {
      // Try to parse reference definition
      const result = parseRefDef(input, i, refs)
      if (result) {
        pos = result
        continue
      }
    }
    
    // Move to next line
    pos = lineEnd < 0 ? len : lineEnd + 1
  }
}

// Parse a reference definition [label]: url "title"
function parseRefDef(
  s: string,
  p: number,
  refs: { [key: string]: { target: string; title: string | undefined } }
): number | null {
  const len = s.length
  if (s.charCodeAt(p) !== 91) return null // [
  
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
  
  const label = s.slice(p + 1, i - 1).toLowerCase().replace(/\s+/g, ' ').trim()
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
  
  // Parse URL
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

/** Calculate indentation (spaces, with tabs = 4 spaces) */
function indent(s: string, p: number, e: number): { spaces: number; chars: number } {
  let spaces = 0, chars = 0
  while (p + chars < e) {
    const c = s.charCodeAt(p + chars)
    if (c === 9) spaces += 4 - (spaces % 4)
    else if (c === 32) spaces++
    else break
    chars++
  }
  return { spaces, chars }
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
  const ind = indent(s, p, e)
  if (ind.spaces > 3) return null
  
  let i = p + ind.chars
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
  const ind = indent(s, p, e)
  if (ind.spaces > 3) return null
  
  let i = p + ind.chars
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
  const ind = indent(s, p, e)
  if (ind.spaces > 3) return null
  
  let i = p + ind.chars
  const fence = s.charCodeAt(i)
  if (fence !== 96 && fence !== 126) return null // ` or ~
  
  const fenceLen = countChar(s, i, e, fence)
  if (fenceLen < 3) return null
  i += fenceLen
  
  // Parse info string
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
  const lang = s.slice(infoStart, infoEnd)
  
  // Find closing fence
  let contentStart = nextLine(s, e)
  let contentEnd = contentStart
  let closeEnd = s.length
  
  while (contentEnd < s.length) {
    const le = lineEnd(s, contentEnd)
    const li = indent(s, contentEnd, le)
    if (li.spaces < 4) {
      const fp = contentEnd + li.chars
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
  
  // Extract content, removing up to ind.spaces from each line
  let content = ''
  let cp = contentStart
  while (cp < contentEnd) {
    const le = lineEnd(s, cp)
    const li = indent(s, cp, le)
    const remove = Math.min(li.chars, ind.spaces)
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
    } as MarkdownToJSX.CodeBlockNode,
    end: closeEnd
  }
}

/** Scan indented code block */
function scanIndented(s: string, p: number): ScanResult {
  const e = lineEnd(s, p)
  const ind = indent(s, p, e)
  if (ind.spaces < 4) return null
  
  let content = ''
  let end = p
  
  while (end < s.length) {
    const le = lineEnd(s, end)
    const li = indent(s, end, le)
    
    if (isBlank(s, end, le)) {
      // Blank line - include but check if code continues
      const nextStart = nextLine(s, le)
      if (nextStart < s.length) {
        const nextLe = lineEnd(s, nextStart)
        const nextInd = indent(s, nextStart, nextLe)
        if (nextInd.spaces >= 4 && !isBlank(s, nextStart, nextLe)) {
          content += '\n'
          end = nextStart
          continue
        }
      }
      break
    }
    
    if (li.spaces < 4) break
    
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
  const ind = indent(s, p, e)
  if (ind.spaces > 3) return null
  
  let i = p + ind.chars
  if (s.charCodeAt(i) !== 62) return null // >
  
  // Collect blockquote content
  let content = ''
  let end = p
  let alertType: string | undefined
  
  while (end < s.length) {
    const le = lineEnd(s, end)
    const li = indent(s, end, le)
    
    if (li.spaces > 3) {
      // Could be lazy continuation or indented code
      if (content) {
        content += s.slice(end, le) + '\n'
        end = nextLine(s, le)
        continue
      }
      break
    }
    
    const qi = end + li.chars
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
  const ind = indent(s, p, e)
  if (ind.spaces > 3) return null
  
  let i = p + ind.chars
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
  let baseIndent = indent(s, p, firstLine).spaces
  let hasBlankBetweenItems = false
  let blankAfterCurrentItem = false
  
  // Calculate content indent for continuation lines
  const firstMarkerEnd = marker.contentStart
  const contentIndent = firstMarkerEnd - p
  
  while (end < s.length) {
    const le = lineEnd(s, end)
    const ind = indent(s, end, le)
    
    // Check if this line starts a new list item with same marker type
    const lineMarker = checkListMarker(s, end, le)
    if (lineMarker && lineMarker.ordered === marker.ordered && 
        (marker.ordered ? lineMarker.marker === marker.marker : true) &&
        ind.spaces <= baseIndent + 3) {
      // New item - save current and start new
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
        const nextMarker = checkListMarker(s, nextStart, nextLe)
        if (!nextMarker || nextMarker.ordered !== marker.ordered) {
          // Check for continuation by indentation
          const nextInd = indent(s, nextStart, nextLe)
          if (nextInd.spaces < contentIndent && !isBlank(s, nextStart, nextLe)) {
            break
          }
        }
      }
      continue
    }
    
    // Check for indented continuation
    if (ind.spaces >= contentIndent || ind.spaces >= 4) {
      // Remove base indentation for continuation
      const contentStart = Math.min(end + contentIndent, end + ind.chars)
      currentItem += s.slice(contentStart, le) + '\n'
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

/** Scan HTML block */
function scanHTMLBlock(s: string, p: number, state: MarkdownToJSX.State, opts: any): ScanResult {
  if (opts.disableParsingRawHTML) return null
  
  const e = lineEnd(s, p)
  const ind = indent(s, p, e)
  if (ind.spaces > 3) return null
  
  const start = p + ind.chars
  const blockInfo = isHTMLBlockStart(s, start, e)
  if (!blockInfo) return null
  
  let end = p
  
  // Types 1-5: Look for closing pattern
  if (blockInfo.close) {
    while (end < s.length) {
      const le = lineEnd(s, end)
      const lineContent = s.slice(end, le)
      if (lineContent.toLowerCase().includes(blockInfo.close!.toLowerCase())) {
        end = nextLine(s, le)
        break
      }
      end = nextLine(s, le)
    }
  } else {
    // Type 6: Ends at blank line
    while (end < s.length) {
      const le = lineEnd(s, end)
      if (isBlank(s, end, le)) {
        break
      }
      end = nextLine(s, le)
    }
  }
  
  const text = s.slice(p, end)
  
  return {
    node: {
      type: RuleType.htmlBlock,
      text,
    } as MarkdownToJSX.HTMLBlockNode,
    end
  }
}

/** Parse table row cells */
function parseTableRow(s: string, state: MarkdownToJSX.State, opts: any): MarkdownToJSX.ASTNode[][] {
  // Trim leading/trailing |
  let row = s.trim()
  if (row.startsWith('|')) row = row.slice(1)
  if (row.endsWith('|') && !row.endsWith('\\|')) row = row.slice(0, -1)
  
  // Split by | (but not \|)
  const cells: string[] = []
  let current = ''
  let i = 0
  while (i < row.length) {
    if (row[i] === '\\' && i + 1 < row.length) {
      current += row[i + 1]
      i += 2
      continue
    }
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
  const ind = indent(s, p, e)
  if (ind.spaces > 3) return null
  
  let i = p + ind.chars
  if (s.charCodeAt(i) !== 91) return null // [
  i++
  
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
    const ind = indent(s, end, le)
    if (ind.spaces < 4 && textEnd > 0) {
      const c = s.charCodeAt(end + ind.chars)
      if (c === 61 || c === 45) { // = or -
        // Check if entire line is = or - (with optional spaces)
        let i = end + ind.chars
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
      const nextInd = indent(s, nextStart, nextLe)
      if (nextInd.spaces < 4) {
        const c = s.charCodeAt(nextStart + nextInd.chars)
        // Check for block starters that interrupt paragraphs
        if (c === 35 || c === 62 || c === 96 || c === 126) break
        // Thematic break (but not setext underline)
        if ((c === 45 || c === 42 || c === 95) && scanThematic(s, nextStart)) {
          // For dashes, only break if it's really a thematic break not setext
          if (c !== 45) break
          // Check if it could be setext (need at least 1 dash)
          let dashCount = 0
          let i = nextStart + nextInd.chars
          while (i < nextLe && s.charCodeAt(i) === 45) { dashCount++; i++ }
          while (i < nextLe && (s.charCodeAt(i) === 32 || s.charCodeAt(i) === 9)) i++
          // If whole line is dashes, it could be setext - let loop continue to check
          if (i < nextLe) break // Not setext, it's thematic break
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
  // Replace "  \n" with special marker, then replace remaining \n with space
  text = text.replace(/  +\n/g, '\u001F').replace(/\n/g, ' ')
  
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

/** Scan strikethrough ~~text~~ */
function scanStrikethrough(s: string, p: number, e: number, state: MarkdownToJSX.State, opts: any): ScanResult {
  if (s.charCodeAt(p) !== 126 || p + 1 >= e || s.charCodeAt(p + 1) !== 126) return null // ~~
  
  // Find closing ~~
  let i = p + 2
  while (i + 1 < e) {
    if (s.charCodeAt(i) === 126 && s.charCodeAt(i + 1) === 126) {
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
    if (s.charCodeAt(i) === 92 && i + 1 < e) i++ // escape
    i++
  }
  
  return null
}

/** Scan marked text ==text== */
function scanMarked(s: string, p: number, e: number, state: MarkdownToJSX.State, opts: any): ScanResult {
  if (s.charCodeAt(p) !== 61 || p + 1 >= e || s.charCodeAt(p + 1) !== 61) return null // ==
  
  // Find closing ==
  let i = p + 2
  while (i + 1 < e) {
    if (s.charCodeAt(i) === 61 && s.charCodeAt(i + 1) === 61) {
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
    if (s.charCodeAt(i) === 92 && i + 1 < e) i++ // escape
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
  
  // Find closing delimiter
  let searchPos = p + delimLen
  
  while (searchPos < e) {
    const c = s.charCodeAt(searchPos)
    
    if (c === 92 && searchPos + 1 < e) {
      searchPos += 2 // skip escape
      continue
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
        const useLen = Math.min(delimLen, closeLen, 2)
        const content = s.slice(p + useLen, searchPos)
        const children = parseInline(content, 0, content.length, state, opts)
        
        return {
          node: {
            type: RuleType.textFormatted,
            tag: useLen === 2 ? 'strong' : 'em',
            children,
          } as MarkdownToJSX.TextFormattedNode,
          end: searchPos + useLen
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
          alt: text,
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

/** Parse inline content */
function parseInline(s: string, p: number, e: number, state: MarkdownToJSX.State, opts: any): MarkdownToJSX.ASTNode[] {
  const nodes: MarkdownToJSX.ASTNode[] = []
  let textStart = p
  
  while (p < e) {
    const c = s.charCodeAt(p)
    let result: ScanResult = null
    
    // Try inline scanners
    if (c === 96) { // `
      result = scanCodeSpan(s, p, e)
    } else if (c === 42 || c === 95) { // * or _
      result = scanEmphasis(s, p, e, state, opts)
    } else if (c === 126) { // ~
      result = scanStrikethrough(s, p, e, state, opts)
    } else if (c === 61) { // = - potential ==marked==
      result = scanMarked(s, p, e, state, opts)
    } else if (c === 91 || (c === 33 && p + 1 < e && s.charCodeAt(p + 1) === 91)) { // [ or ![
      result = scanLink(s, p, e, state, opts)
    } else if (c === 60 && !opts.disableAutoLink) { // <
      result = scanAutolink(s, p, e)
    } else if (c === 104 && !state.inAnchor) { // h - potential http:// or https://
      result = scanBareUrl(s, p, e, opts)
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
    nodes.push(textNode(s.slice(textStart, e)))
  }
  
  return nodes
}

// ============================================================================
// BLOCK PARSER
// ============================================================================

/** Parse block-level content */
function parseBlocks(s: string, state: MarkdownToJSX.State, opts: any): MarkdownToJSX.ASTNode[] {
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
      // Skip frontmatter (don't render by default per test expectations)
      // The content between --- markers is ignored
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
    const ind = indent(s, p, le)
    
    let result: ScanResult = null
    
    // Check for indented code block (4+ spaces) - but not in list context
    if (ind.spaces >= 4 && !state.inList) {
      result = scanIndented(s, p)
    } else {
      const i = p + ind.chars
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
  
  return parseBlocks(normalized, state || defaultState, options || {})
}

/**
 * Main parser entry point - matches original parser interface
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
  return parseBlocks(source, state, finalOptions)
}

// Export for testing
export { parseBlocks, parseInline, scanHeading, scanThematic, scanFenced, scanBlockquote }

// Export parseMarkdown as alias for react.tsx compatibility
export const parseMarkdown = parseBlocks
