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
  tagfilter?: boolean
  forceBlock?: boolean
  streaming?: boolean
  inList?: boolean
  inHTML?: boolean
  disableBareUrls?: boolean
}

/** HTMLCommentNode with endsWithGreaterThan flag for empty/special comments */
type HTMLCommentNodeExt = MarkdownToJSX.HTMLCommentNode & { endsWithGreaterThan: boolean }

/** Union of AST nodes that have a children array */
type ASTNodeWithChildren = Extract<MarkdownToJSX.ASTNode, { children: MarkdownToJSX.ASTNode[] }>

// Regex exports
export const HTML_BLOCK_ELEMENT_START_R_ATTR: RegExp =
  /^<([a-zA-Z][a-zA-Z0-9-]*)\s+[^>]*>/
export const UPPERCASE_TAG_R: RegExp = /^<[A-Z]/
// HTML Type 1 tags (raw HTML blocks) — CommonMark §4.6
var TYPE1_TAG_LIST = ['script', 'pre', 'style', 'textarea']
var TYPE1_TAGS = new Set(TYPE1_TAG_LIST)

/** Matches Type 1 tags in raw HTML text */
var TYPE1_R = /<(?:pre|script|style|textarea)\b/i

// Table-related tags excluded from type 6/7 block extension across blank lines
var TABLE_TAGS = new Set([
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th'
])

// Inline special character lookup — true for chars that need processing in parseInline
// ` * _ ~ = [ ! < \ h w f \u001F (and alphanumeric for email near @)
var INLINE_SPECIAL = new Uint8Array(128)
;(function() {
  // Characters that trigger inline scanners
  var specials = [$.CHAR_BACKTICK, $.CHAR_ASTERISK, $.CHAR_UNDERSCORE, $.CHAR_TILDE, $.CHAR_EQ, $.CHAR_BRACKET_OPEN, $.CHAR_EXCLAMATION, $.CHAR_LT, $.CHAR_BACKSLASH, $.CHAR_UNIT_SEP, $.CHAR_H, $.CHAR_W, $.CHAR_f]
  for (var si = 0; si < specials.length; si++) INLINE_SPECIAL[specials[si]] = 1
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
  var i = start, len = end
  // skip leading whitespace
  while (i < len && (s.charCodeAt(i) === $.CHAR_SPACE || s.charCodeAt(i) === $.CHAR_TAB)) i++
  if (i >= len) return false
  // optional leading pipe
  if (s.charCodeAt(i) === $.CHAR_PIPE) i++
  var cellCount = 0
  while (i < len) {
    // skip whitespace before cell
    while (i < len && (s.charCodeAt(i) === $.CHAR_SPACE || s.charCodeAt(i) === $.CHAR_TAB)) i++
    if (i >= len) break
    // trailing pipe with only whitespace after — done
    if (s.charCodeAt(i) === $.CHAR_PIPE && cellCount > 0) {
      // check rest is whitespace
      var j = i + 1
      while (j < len && (s.charCodeAt(j) === $.CHAR_SPACE || s.charCodeAt(j) === $.CHAR_TAB)) j++
      if (j >= len) return true
      // not trailing — fall through to parse another cell
    }
    // optional leading colon
    if (s.charCodeAt(i) === $.CHAR_COLON) i++
    // require at least one dash
    if (i >= len || s.charCodeAt(i) !== $.CHAR_DASH) return false
    while (i < len && s.charCodeAt(i) === $.CHAR_DASH) i++
    // optional trailing colon
    if (i < len && s.charCodeAt(i) === $.CHAR_COLON) i++
    cellCount++
    // skip whitespace after cell
    while (i < len && (s.charCodeAt(i) === $.CHAR_SPACE || s.charCodeAt(i) === $.CHAR_TAB)) i++
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

// Parse an HTML tag at position
export function __parseHTMLTag(
  source: string,
  pos: number
): {
  tag: string
  attrs: Record<string, string>
  selfClosing: boolean
  end: number
  rawAttrs: string
  whitespaceBeforeAttrs: string
  isClosing: boolean
  hasSpaceBeforeSlash: boolean
} | null {
  if (source.charCodeAt(pos) !== $.CHAR_LT) return null // <

  let i = pos + 1
  const len = source.length

  let isClosing = false
  if (source.charCodeAt(i) === $.CHAR_SLASH) { // /
    i++
    isClosing = true
  }

  const nameStart = i
  const first = source.charCodeAt(i)
  if (!((first >= $.CHAR_a && first <= $.CHAR_z) || (first >= $.CHAR_A && first <= $.CHAR_Z))) return null

  while (i < len && ((source.charCodeAt(i) >= $.CHAR_a && source.charCodeAt(i) <= $.CHAR_z) || (source.charCodeAt(i) >= $.CHAR_A && source.charCodeAt(i) <= $.CHAR_Z) || (source.charCodeAt(i) >= $.CHAR_DIGIT_0 && source.charCodeAt(i) <= $.CHAR_DIGIT_9) || source.charCodeAt(i) === $.CHAR_DASH)) i++
  const tag = source.slice(nameStart, i)
  if (!tag) return null

  const wsStart = i
  while (i < len && (source.charCodeAt(i) === $.CHAR_SPACE || source.charCodeAt(i) === $.CHAR_TAB || source.charCodeAt(i) === $.CHAR_NEWLINE)) i++
  const whitespaceBeforeAttrs = source.slice(wsStart, i)
  // After tag name, must have whitespace before attributes, or > or />
  if (i === wsStart && i < len) {
    var nextC = source.charCodeAt(i)
    if (nextC !== $.CHAR_GT && nextC !== $.CHAR_SLASH) return null // not > or /
  }
  const attrStartPos = i
  const attrs: Record<string, string> = {}
  let hasSpaceBeforeSlash = false

  while (i < len) {
    const c = source.charCodeAt(i)
    if (c === $.CHAR_GT) { // >
      const rawAttrs = source.slice(attrStartPos, i)
      return { tag, attrs, selfClosing: false, end: i + 1, rawAttrs, whitespaceBeforeAttrs, isClosing, hasSpaceBeforeSlash }
    }
    if (c === $.CHAR_SPACE || c === $.CHAR_TAB || c === $.CHAR_NEWLINE) {
      i++
      continue
    }
    if (c === $.CHAR_SLASH && i + 1 < len && source.charCodeAt(i + 1) === $.CHAR_GT) { // />
      const rawAttrs = source.slice(attrStartPos, i)
      hasSpaceBeforeSlash = i > attrStartPos && source.charCodeAt(i - 1) === $.CHAR_SPACE
      return { tag, attrs, selfClosing: true, end: i + 2, rawAttrs, whitespaceBeforeAttrs, isClosing, hasSpaceBeforeSlash }
    }

    // Parse attribute name per CommonMark: [a-zA-Z_:][a-zA-Z0-9_.:-]*
    // Parse attribute name per CommonMark: [a-zA-Z_:][a-zA-Z0-9_.:-]*
    var attrStart = i
    var fc = source.charCodeAt(i)
    if (!((fc >= $.CHAR_a && fc <= $.CHAR_z) || (fc >= $.CHAR_A && fc <= $.CHAR_Z) || fc === $.CHAR_UNDERSCORE || fc === $.CHAR_COLON)) {
      // Invalid attribute name start character - invalid tag
      return null
    }
    i++
    while (i < len) {
      var ac = source.charCodeAt(i)
      if ((ac >= $.CHAR_a && ac <= $.CHAR_z) || (ac >= $.CHAR_A && ac <= $.CHAR_Z) || (ac >= $.CHAR_DIGIT_0 && ac <= $.CHAR_DIGIT_9) || ac === $.CHAR_UNDERSCORE || ac === $.CHAR_PERIOD || ac === $.CHAR_COLON || ac === $.CHAR_DASH) {
        i++
      } else break
    }
    var attrName = source.slice(attrStart, i)

    // Skip whitespace
    while (i < len && (source.charCodeAt(i) === $.CHAR_SPACE || source.charCodeAt(i) === $.CHAR_TAB)) i++

    // Check for =
    if (source.charCodeAt(i) !== $.CHAR_EQ) {
      attrs[attrName] = ''
      continue
    }
    i++ // skip =

    // Skip whitespace
    while (i < len && (source.charCodeAt(i) === $.CHAR_SPACE || source.charCodeAt(i) === $.CHAR_TAB)) i++

    // Parse value
    var quote = source.charCodeAt(i)
    if (quote === $.CHAR_DOUBLE_QUOTE || quote === $.CHAR_SINGLE_QUOTE) { // " or '
      i++
      var valueStart = i
      // Newlines are allowed in quoted attribute values per CommonMark
      while (i < len && source.charCodeAt(i) !== quote) i++
      if (i >= len) return null // unclosed quote
      attrs[attrName] = source.slice(valueStart, i)
      i++ // skip closing quote
      // After a quoted value, next must be whitespace, >, or />
      if (i < len) {
        var afterQuote = source.charCodeAt(i)
        if (afterQuote !== $.CHAR_SPACE && afterQuote !== $.CHAR_TAB && afterQuote !== $.CHAR_NEWLINE &&
            afterQuote !== $.CHAR_GT && afterQuote !== $.CHAR_SLASH) return null
      }
    } else if (quote === $.CHAR_BRACE_OPEN) { // {
      var depth = 1
      var valueStart = i
      i++
      while (i < len && depth > 0) {
        var ac = source.charCodeAt(i)
        if (ac === $.CHAR_BRACE_OPEN) depth++
        else if (ac === $.CHAR_BRACE_CLOSE) depth--
        i++
      }
      attrs[attrName] = source.slice(valueStart, i)
    } else {
      // Unquoted value: can't contain " ' = < > ` or whitespace
      var valueStart = i
      while (i < len) {
        var vc = source.charCodeAt(i)
        if (vc === $.CHAR_SPACE || vc === $.CHAR_TAB || vc === $.CHAR_GT || vc === $.CHAR_NEWLINE ||
            vc === $.CHAR_DOUBLE_QUOTE || vc === $.CHAR_SINGLE_QUOTE || vc === $.CHAR_EQ || vc === $.CHAR_LT || vc === $.CHAR_BACKTICK) break
        i++
      }
      if (i === valueStart) return null // empty unquoted value
      attrs[attrName] = source.slice(valueStart, i)
    }
  }

  return null
}

// Collect reference definitions in first pass
export function collectReferenceDefinitions(
  input: string,
  refs: { [key: string]: { target: string; title: string } },
  _options: ParseOptions
): void {
  var pos = 0
  var len = input.length
  // Track whether prev line was paragraph content — ref defs can't interrupt paragraphs
  var prevWasContent = false

  while (pos < len) {
    var lineEnd = input.indexOf('\n', pos)
    var end = lineEnd < 0 ? len : lineEnd

    // Skip leading whitespace (up to 3 spaces)
    var i = pos
    var spaces = 0
    while (i < end && spaces < 4) {
      if (input.charCodeAt(i) === $.CHAR_SPACE) { spaces++; i++ }
      else if (input.charCodeAt(i) === $.CHAR_TAB) { spaces += 4; i++ }
      else break
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
        while (fi < end && input.charCodeAt(fi) === fenceChar) { fenceCount++; fi++ }
        if (fenceCount >= 3) {
          prevWasContent = false
          // Skip fenced block: scan for close fence using direct charCode walk
          // Avoids per-line indexOf('\n') overhead for 5000+ fenced lines in large docs
          var scanPos = lineEnd < 0 ? len : lineEnd + 1
          while (scanPos < len) {
            // Skip indent (up to 3 spaces)
            var ci = scanPos, cSp = 0
            while (ci < len && cSp < 4) {
              var cc = input.charCodeAt(ci)
              if (cc === $.CHAR_SPACE) { cSp++; ci++ }
              else if (cc === $.CHAR_TAB) { cSp += 4; ci++ }
              else break
            }
            // Check for fence chars
            if (cSp < 4 && ci < len && input.charCodeAt(ci) === fenceChar) {
              var cf = 0
              while (ci < len && input.charCodeAt(ci) === fenceChar) { cf++; ci++ }
              if (cf >= fenceCount) {
                // Check rest of line is whitespace
                while (ci < len && (input.charCodeAt(ci) === $.CHAR_SPACE || input.charCodeAt(ci) === $.CHAR_TAB)) ci++
                if (ci >= len || input.charCodeAt(ci) === $.CHAR_NEWLINE) {
                  pos = ci >= len ? len : ci + 1
                  break
                }
              }
            }
            // Skip to next line
            while (scanPos < len && input.charCodeAt(scanPos) !== $.CHAR_NEWLINE) scanPos++
            if (scanPos < len) scanPos++ // skip past \n
          }
          if (scanPos >= len) pos = len
          continue
        }
      }
    }

    // Strip blockquote markers to find ref defs inside blockquotes
    var ri = i
    while (ri < end && input.charCodeAt(ri) === $.CHAR_GT) { // >
      ri++
      if (ri < end && input.charCodeAt(ri) === $.CHAR_SPACE) ri++ // optional space after >
      // Re-check leading whitespace after >
      var bqSpaces = 0
      while (ri < end && bqSpaces < 4) {
        if (input.charCodeAt(ri) === $.CHAR_SPACE) { bqSpaces++; ri++ }
        else if (input.charCodeAt(ri) === $.CHAR_TAB) { bqSpaces += 4; ri++ }
        else break
      }
      if (bqSpaces >= 4) break // indented code block inside blockquote
      prevWasContent = false // blockquote marker resets paragraph context
    }

    // Check for [ (potential reference definition, not footnote [^)
    // Link ref defs cannot interrupt paragraphs
    if (!prevWasContent && spaces < 4 && ri < end && input.charCodeAt(ri) === $.CHAR_BRACKET_OPEN && !(ri + 1 < len && input.charCodeAt(ri + 1) === $.CHAR_CARET)) {
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
    if (lineC === $.CHAR_HASH && spaces < 4) { // # heading
      prevWasContent = false
    } else if (spaces < 4 && (lineC === $.CHAR_DASH || lineC === $.CHAR_ASTERISK || lineC === $.CHAR_UNDERSCORE)) {
      // Could be thematic break — check
      var tbp = i, tbCount = 0
      while (tbp < end) {
        var tbc = input.charCodeAt(tbp)
        if (tbc === lineC) tbCount++
        else if (tbc !== $.CHAR_SPACE && tbc !== $.CHAR_TAB) break
        tbp++
      }
      prevWasContent = !(tbCount >= 3 && tbp >= end)
    } else {
      prevWasContent = true
    }
    // Move to next line
    pos = lineEnd < 0 ? len : lineEnd + 1
  }
}

// Parse a reference definition [label]: url "title" or footnote [^id]: content
export function parseRefDef(
  s: string,
  p: number,
  refs: { [key: string]: { target: string; title: string | undefined } }
): number | null {
  const len = s.length
  if (s.charCodeAt(p) !== $.CHAR_BRACKET_OPEN) return null // [

  // Check for footnote definition [^
  const isFootnote = p + 1 < len && s.charCodeAt(p + 1) === $.CHAR_CARET

  // Find label end - per CommonMark, labels cannot contain unescaped brackets
  let i = p + 1
  while (i < len) {
    var c = s.charCodeAt(i)
    if (c === $.CHAR_BRACKET_CLOSE) { i++; break } // ]
    if (c === $.CHAR_BRACKET_OPEN) return null // unescaped [ in label
    if (c === $.CHAR_BACKSLASH && i + 1 < len) i++ // escape
    i++
  }
  if (i > len || s.charCodeAt(i - 1) !== $.CHAR_BRACKET_CLOSE) return null

  const rawLabel = s.slice(p + 1, i - 1)
  // Label must not exceed 999 chars per CommonMark spec
  if (rawLabel.length > 999) return null
  const label = normalizeLabel(rawLabel)
  if (!label) return null

  // Expect :
  if (i >= len || s.charCodeAt(i) !== $.CHAR_COLON) return null
  i++

  // Skip whitespace (including one optional newline)
  let hasNewline = false
  while (i < len) {
    const c = s.charCodeAt(i)
    if (c === $.CHAR_SPACE || c === $.CHAR_TAB) i++
    else if (c === $.CHAR_NEWLINE && !hasNewline) { hasNewline = true; i++ }
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
  var url: string
  if (i < len && s.charCodeAt(i) === $.CHAR_LT) { // <url>
    i++
    var urlStart = i
    while (i < len && s.charCodeAt(i) !== $.CHAR_GT && s.charCodeAt(i) !== $.CHAR_NEWLINE) {
      if (s.charCodeAt(i) === $.CHAR_BACKSLASH && i + 1 < len) i++ // escape
      i++
    }
    if (i >= len || s.charCodeAt(i) !== $.CHAR_GT) return null
    url = s.slice(urlStart, i)
    i++
    // Check that nothing follows the > on this line except whitespace or a title
    var afterUrlEnd = s.indexOf('\n', i)
    var afterUrlEol = afterUrlEnd < 0 ? len : afterUrlEnd
    var ai = i
    while (ai < afterUrlEol && (s.charCodeAt(ai) === $.CHAR_SPACE || s.charCodeAt(ai) === $.CHAR_TAB)) ai++
    if (ai < afterUrlEol) {
      // Content after > — must be whitespace-separated title
      if (ai === i) return null // no whitespace before title = invalid
      var tc2 = s.charCodeAt(ai)
      if (tc2 !== $.CHAR_DOUBLE_QUOTE && tc2 !== $.CHAR_SINGLE_QUOTE && tc2 !== $.CHAR_PAREN_OPEN) return null // not a title char
    }
  } else {
    var urlStart = i
    var parens = 0
    while (i < len) {
      var c = s.charCodeAt(i)
      if (c === $.CHAR_PAREN_OPEN) parens++
      else if (c === $.CHAR_PAREN_CLOSE) { if (parens === 0) break; parens-- }
      else if (c === $.CHAR_SPACE || c === $.CHAR_TAB || c === $.CHAR_NEWLINE) break
      else if (c === $.CHAR_BACKSLASH && i + 1 < len) i++ // escape
      i++
    }
    url = s.slice(urlStart, i)
    if (!url) return null // URL required for non-angle-bracket form
  }

  // Skip whitespace
  while (i < len && (s.charCodeAt(i) === $.CHAR_SPACE || s.charCodeAt(i) === $.CHAR_TAB)) i++

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
    while (tryTitleAt < len && (s.charCodeAt(tryTitleAt) === $.CHAR_SPACE || s.charCodeAt(tryTitleAt) === $.CHAR_TAB)) tryTitleAt++
  }

  if (tryTitleAt < len) {
    var tc = s.charCodeAt(tryTitleAt)
    if (tc === $.CHAR_DOUBLE_QUOTE || tc === $.CHAR_SINGLE_QUOTE || tc === $.CHAR_PAREN_OPEN) { // " ' (
      var closeChar = tc === $.CHAR_PAREN_OPEN ? 41 : tc
      var ti = tryTitleAt + 1
      var titleStart = ti
      // Title can span multiple lines, but not contain blank lines
      while (ti < len) {
        var tch = s.charCodeAt(ti)
        if (tch === closeChar) {
          // Found closing - check rest of line is blank
          var afterTitle = ti + 1
          while (afterTitle < len && (s.charCodeAt(afterTitle) === $.CHAR_SPACE || s.charCodeAt(afterTitle) === $.CHAR_TAB)) afterTitle++
          if (afterTitle >= len || s.charCodeAt(afterTitle) === $.CHAR_NEWLINE) {
            title = s.slice(titleStart, ti)
            titleParsed = true
            titleEnd = afterTitle < len ? afterTitle + 1 : len
          }
          break
        }
        if (tch === $.CHAR_BACKSLASH && ti + 1 < len) { ti += 2; continue } // escape
        // Check for blank line (title can't span blank lines)
        if (tch === $.CHAR_NEWLINE && ti + 1 < len && s.charCodeAt(ti + 1) === $.CHAR_NEWLINE) break
        ti++
      }

      if (!titleParsed) {
        // Title didn't parse properly
        if (tryTitleAt !== i) {
          // Title was on next line - just use URL-only form
        } else {
          // Title on same line that didn't close - not valid
          return null
        }
      }
    }
  }

  if (titleParsed) {
    if (!refs[label]) refs[label] = { target: unescapeString(url), title: title !== undefined ? unescapeString(title) : title }
    return titleEnd
  }

  // No title - check that rest of line is blank
  while (i < eol && (s.charCodeAt(i) === $.CHAR_SPACE || s.charCodeAt(i) === $.CHAR_TAB)) i++
  if (i < eol) return null

  // First definition wins
  if (!refs[label]) {
    refs[label] = { target: unescapeString(url), title }
  }
  return lineEndPos < 0 ? len : lineEndPos + 1
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
CC[$.CHAR_SPACE] = C_WS                          // space
CC[$.CHAR_TAB] = C_WS                           // tab
CC[$.CHAR_NEWLINE] = C_WS | C_NL                   // newline
CC[$.CHAR_CR] = C_WS | C_NL                   // carriage return

// Block starters
CC[$.CHAR_HASH] = C_BLOCK | C_PUNCT             // # (heading)
CC[$.CHAR_GT] = C_BLOCK | C_PUNCT             // > (blockquote)
CC[$.CHAR_DASH] = C_BLOCK | C_INLINE | C_PUNCT  // - (list, thematic, strikethrough)
CC[$.CHAR_PLUS] = C_BLOCK | C_PUNCT             // + (list)
CC[$.CHAR_ASTERISK] = C_BLOCK | C_INLINE | C_PUNCT  // * (list, thematic, emphasis)
CC[$.CHAR_UNDERSCORE] = C_BLOCK | C_INLINE | C_PUNCT  // _ (thematic, emphasis)
CC[$.CHAR_BACKTICK] = C_BLOCK | C_INLINE | C_PUNCT  // ` (code fence, code span)
CC[$.CHAR_TILDE] = C_BLOCK | C_INLINE | C_PUNCT // ~ (code fence, strikethrough)
CC[$.CHAR_LT] = C_BLOCK | C_INLINE | C_PUNCT  // < (HTML, autolink)
CC[$.CHAR_BRACKET_OPEN] = C_INLINE | C_PUNCT            // [ (link, image, footnote)
CC[$.CHAR_EXCLAMATION] = C_INLINE | C_PUNCT            // ! (image)
CC[$.CHAR_PIPE] = C_BLOCK | C_PUNCT            // | (table)

// Digits
for (let i = $.CHAR_DIGIT_0; i <= $.CHAR_DIGIT_9; i++) CC[i] = C_DIGIT | C_BLOCK  // 0-9 (ordered list)

// Letters
for (let i = $.CHAR_A; i <= $.CHAR_Z; i++) CC[i] = C_ALPHA   // A-Z
for (let i = $.CHAR_a; i <= $.CHAR_z; i++) CC[i] = C_ALPHA  // a-z

// Other punctuation - all ASCII punctuation must be classified for CommonMark escape handling
CC[$.CHAR_BACKSLASH] = C_PUNCT   // \ (escape)
CC[$.CHAR_BRACKET_CLOSE] = C_PUNCT   // ]
CC[$.CHAR_PAREN_OPEN] = C_PUNCT   // (
CC[$.CHAR_PAREN_CLOSE] = C_PUNCT   // )
CC[$.CHAR_COLON] = C_PUNCT   // :
CC[$.CHAR_DOUBLE_QUOTE] = C_PUNCT   // "
CC[$.CHAR_SINGLE_QUOTE] = C_PUNCT   // '
CC[$.CHAR_AMPERSAND] = C_PUNCT   // &
CC[$.CHAR_EQ] = C_PUNCT   // =
CC[$.CHAR_DOLLAR] = C_PUNCT   // $
CC[$.CHAR_PERCENT] = C_PUNCT   // %
CC[$.CHAR_COMMA] = C_PUNCT   // ,
CC[$.CHAR_PERIOD] = C_PUNCT   // .
CC[$.CHAR_SLASH] = C_PUNCT   // /
CC[$.CHAR_SEMICOLON] = C_PUNCT   // ;
CC[$.CHAR_QUESTION] = C_PUNCT   // ?
CC[$.CHAR_AT] = C_PUNCT   // @
CC[$.CHAR_CARET] = C_PUNCT   // ^
CC[$.CHAR_BRACE_OPEN] = C_PUNCT  // {
CC[$.CHAR_BRACE_CLOSE] = C_PUNCT  // }

/** Check if string contains unescaped [ or ] */
function hasUnescapedBracket(s: string): boolean {
  // Fast rejection: if no brackets at all, skip the escaping check
  if (s.indexOf('[') < 0 && s.indexOf(']') < 0) return false
  for (var i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) === $.CHAR_BACKSLASH) { i++; continue } // skip escaped char
    if (s.charCodeAt(i) === $.CHAR_BRACKET_OPEN || s.charCodeAt(i) === $.CHAR_BRACKET_CLOSE) return true
  }
  return false
}

/** Normalize a reference label for case-insensitive matching */
function normalizeLabel(label: string): string {
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
  return code < $.CHAR_ASCII_BOUNDARY ? CC[code] : (code === $.CHAR_NBSP ? C_WS : 0)
}

/** Unescape backslash escapes in a string */
function unescapeString(s: string): string {
  // Replace \X with X when X is an ASCII punctuation character
  return s.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, '$1')
}

/** Find end of current line (position of \n or end of string) */
function lineEnd(s: string, p: number): number {
  var i = s.indexOf('\n', p)
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
    if (c !== $.CHAR_SPACE && c !== $.CHAR_TAB) break
    p++
  }
  return p
}

/** Find start of next blank line (line with only whitespace or empty) */
function findNextBlankLine(s: string, p: number): number {
  // CommonMark Type 7 blocks continue until a truly blank line is reached.
  // We start searching AFTER the current line.
  let i = nextLine(s, p)
  while (i < s.length) {
    const e = lineEnd(s, i)
    if (isBlank(s, i, e)) return i
    i = nextLine(s, i)
  }
  return s.length
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
export var _indentSpaces = 0, _indentChars = 0

/** Calculate indentation (spaces, with tabs = 4 spaces). Results in _indentSpaces and _indentChars */
export function indent(s: string, p: number, e: number): void {
  _indentSpaces = 0
  _indentChars = 0
  while (p + _indentChars < e) {
    const c = s.charCodeAt(p + _indentChars)
    if (c === $.CHAR_TAB) _indentSpaces += 4 - (_indentSpaces % 4)
    else if (c === $.CHAR_SPACE) _indentSpaces++
    else break
    _indentChars++
  }
}

/** Check if line is blank (only whitespace) */
function isBlank(s: string, p: number, e: number): boolean {
  return skipWS(s, p, e) >= e
}


// ============================================================================
// RESULT TYPES
// ============================================================================

type ScanResult = { node: MarkdownToJSX.ASTNode; end: number } | null

// ============================================================================
// BLOCK SCANNERS
// ============================================================================

/** Scan ATX heading (# ... #) */
function scanHeading(s: string, p: number, state: MarkdownToJSX.State, opts: ParseOptions): ScanResult {
  const e = lineEnd(s, p)
  indent(s, p, e)
  if (_indentSpaces > 3) return null

  let i = p + _indentChars
  if (s.charCodeAt(i) !== $.CHAR_HASH) return null // #

  // Count # characters (1-6)
  const level = countChar(s, i, e, 35)
  if (level < 1 || level > 6) return null
  i += level

  // Must be followed by space or end of line
  if (i < e && s.charCodeAt(i) !== $.CHAR_SPACE && s.charCodeAt(i) !== $.CHAR_TAB) return null

  // Skip whitespace after #
  i = skipWS(s, i, e)

  // Find content end (strip trailing # and spaces per CommonMark)
  var contentEnd = e
  // Strip trailing whitespace
  while (contentEnd > i && s.charCodeAt(contentEnd - 1) === $.CHAR_SPACE) contentEnd--
  // Strip trailing # characters
  var beforeHash = contentEnd
  while (contentEnd > i && s.charCodeAt(contentEnd - 1) === $.CHAR_HASH) contentEnd--
  if (contentEnd < beforeHash) {
    // We stripped some #s - check if preceded by space or at beginning
    if (contentEnd === i || s.charCodeAt(contentEnd - 1) === $.CHAR_SPACE) {
      // Valid closing sequence - strip trailing spaces before the #s
      while (contentEnd > i && s.charCodeAt(contentEnd - 1) === $.CHAR_SPACE) contentEnd--
    } else {
      // Trailing # not preceded by space - keep them
      contentEnd = beforeHash
    }
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

/** Check if a line is a setext heading underline (=== or ---) */
function isSetextUnderline(s: string, p: number, e: number): boolean {
  var c = s.charCodeAt(p)
  if (c !== $.CHAR_EQ && c !== $.CHAR_DASH) return false // = or -
  var i = p
  while (i < e && s.charCodeAt(i) === c) i++
  while (i < e && (s.charCodeAt(i) === $.CHAR_SPACE || s.charCodeAt(i) === $.CHAR_TAB)) i++
  return i >= e
}

/** Scan thematic break (---, ***, ___) */
function scanThematic(s: string, p: number): ScanResult {
  const e = lineEnd(s, p)
  indent(s, p, e)
  if (_indentSpaces > 3) return null

  let i = p + _indentChars
  const ch = s.charCodeAt(i)
  if (ch !== $.CHAR_DASH && ch !== $.CHAR_ASTERISK && ch !== $.CHAR_UNDERSCORE) return null // - * _

  let count = 0
  while (i < e) {
    const c = s.charCodeAt(i)
    if (c === ch) count++
    else if (c !== $.CHAR_SPACE && c !== $.CHAR_TAB) return null
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
  if (fence !== $.CHAR_BACKTICK && fence !== $.CHAR_TILDE) return null // ` or ~

  const fenceLen = countChar(s, i, e, fence)
  if (fenceLen < 3) return null
  i += fenceLen

  // Parse info string - extract language (first word) and optional attributes
  const infoStart = skipWS(s, i, e)
  let infoEnd = e
  // Backtick fences can't have backticks in info
  if (fence === $.CHAR_BACKTICK) {
    for (let j = infoStart; j < e; j++) {
      if (s.charCodeAt(j) === $.CHAR_BACKTICK) return null
    }
  }
  while (infoEnd > infoStart && (s.charCodeAt(infoEnd - 1) === $.CHAR_SPACE || s.charCodeAt(infoEnd - 1) === $.CHAR_TAB)) {
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
  var attrs: Record<string, string> | undefined = undefined
  if (attrsStr) {
    FENCE_ATTR_R.lastIndex = 0
    var match
    while ((match = FENCE_ATTR_R.exec(attrsStr)) !== null) {
      if (!attrs) attrs = {}
      attrs[match[1]] = match[2] !== undefined ? match[2] : match[3]
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
      var fcount = countChar(s, fp, le, fence)
      if (fcount >= fenceLen) {
        const afterFence = fp + fcount
        if (isBlank(s, afterFence, le)) {
          closeEnd = nextLine(s, le)
          break
        }
      }
    }
    contentEnd = nextLine(s, le)
  }

  // Extract content, removing up to fenceIndent spaces from each line
  var content: string
  if (fenceIndent === 0) {
    // Fast path: no indent stripping needed — content is contiguous in source
    // Strip trailing newline: contentEnd points to start of closing fence line,
    // so the last char before it is '\n' from the last content line
    content = contentEnd > contentStart && s.charCodeAt(contentEnd - 1) === $.CHAR_NEWLINE
      ? s.slice(contentStart, contentEnd - 1)
      : s.slice(contentStart, contentEnd)
  } else {
    content = ''
    var cp = contentStart
    while (cp < contentEnd) {
      var le = lineEnd(s, cp)
      indent(s, cp, le)
      var remove = Math.min(_indentChars, fenceIndent)
      content += s.slice(cp + remove, le) + '\n'
      cp = nextLine(s, le)
    }
    // Remove trailing newline
    if (content.length > 0 && content.charCodeAt(content.length - 1) === $.CHAR_NEWLINE) content = content.slice(0, -1)
  }

  return {
    node: {
      type: RuleType.codeBlock,
      lang: lang || undefined,
      text: content,
      infoString: attrsStr || undefined,
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
      // Blank line(s) - include if code continues after them
      var blankCount = 0
      var scanPos = nextLine(s, le)
      while (scanPos < s.length) {
        var scanLe = lineEnd(s, scanPos)
        if (isBlank(s, scanPos, scanLe)) {
          blankCount++
          scanPos = nextLine(s, scanLe)
          continue
        }
        indent(s, scanPos, scanLe)
        if (_indentSpaces >= 4) {
          // Code continues after blank(s): add the blank lines
          for (var bi = 0; bi <= blankCount; bi++) content += '\n'
          end = scanPos
          break
        }
        break
      }
      if (end !== scanPos) break
      continue
    }

    if (_indentSpaces < 4) break

    // Remove 4 spaces of indentation, expanding tabs to spaces
    let remove = 0, spaces = 0
    var extraSpaces = 0
    for (let i = end; i < le && spaces < 4; i++) {
      const c = s.charCodeAt(i)
      if (c === $.CHAR_TAB) {
        var tabW = 4 - (spaces % 4)
        if (spaces + tabW > 4) {
          extraSpaces = spaces + tabW - 4
        }
        spaces += tabW
      }
      else spaces++
      remove++
    }

    // Add any leftover spaces from partial tab consumption, then literal content
    var lineContent = ''
    if (extraSpaces > 0) {
      for (var si = 0; si < extraSpaces; si++) lineContent += ' '
    }
    lineContent += s.slice(end + remove, le)
    content += lineContent + '\n'
    end = nextLine(s, le)
  }

  // Trim trailing blank lines
  while (content.length > 0 && content.charCodeAt(content.length - 1) === $.CHAR_NEWLINE) content = content.slice(0, -1)
  while (content.length > 0 && content.charCodeAt(content.length - 1) === $.CHAR_NEWLINE) content = content.slice(0, -1)

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
function scanBlockquote(s: string, p: number, state: MarkdownToJSX.State, opts: ParseOptions): ScanResult {
  const e = lineEnd(s, p)
  indent(s, p, e)
  if (_indentSpaces > 3) return null

  let i = p + _indentChars
  if (s.charCodeAt(i) !== $.CHAR_GT) return null // >

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
          ci++; bqAbsCol++; bqStripOne = true
        } else if (bqNextChar === $.CHAR_TAB) {
          // Tab after >: consume 1 col as optional space, expand rest
          bqStripOne = true
        }
      }
      // Build lineContent with tab expansion using absolute columns
      var lineContent = ''
      var hasTabInLine = false
      for (var bci = ci; bci < le; bci++) {
        if (s.charCodeAt(bci) === $.CHAR_TAB) { hasTabInLine = true; break }
      }
      if (hasTabInLine) {
        // Expand tabs to spaces using absolute column tracking
        var bqCol = bqAbsCol
        if (bqStripOne && ci < le && s.charCodeAt(ci) === $.CHAR_TAB) {
          // First char is a tab — consume 1 col, expand rest
          var tw = 4 - (bqCol % 4)
          for (var bi = 0; bi < tw - 1; bi++) lineContent += ' '
          bqCol += tw
          ci++
        }
        for (var bci2 = ci; bci2 < le; bci2++) {
          if (s.charCodeAt(bci2) === $.CHAR_TAB) {
            var tw2 = 4 - (bqCol % 4)
            for (var bi2 = 0; bi2 < tw2; bi2++) lineContent += ' '
            bqCol += tw2
          } else { lineContent += s[bci2]; bqCol++ }
        }
      } else {
        lineContent = s.slice(ci, le)
      }

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
      // Track if content has open fenced code block or indented code
      var trimLine = lineContent.trimStart()
      if (trimLine.startsWith('```') || trimLine.startsWith('~~~')) {
        contentHasOpenBlock = !contentHasOpenBlock
      } else if (lineContent.startsWith('    ') || lineContent.startsWith('\t')) {
        contentHasOpenBlock = true
      } else if (trimLine.length > 0 && !contentHasOpenBlock) {
        contentHasOpenBlock = false
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
        if (lazyC === $.CHAR_HASH || lazyC === $.CHAR_GT || lazyC === $.CHAR_BACKTICK || lazyC === $.CHAR_TILDE || lazyC === $.CHAR_LT) break
        if ((lazyC === $.CHAR_DASH || lazyC === $.CHAR_ASTERISK || lazyC === $.CHAR_UNDERSCORE) && scanThematic(s, end)) break
        if ((lazyC === $.CHAR_DASH || lazyC === $.CHAR_ASTERISK || lazyC === $.CHAR_PLUS) && lazyI + 1 < le && (s.charCodeAt(lazyI + 1) === $.CHAR_SPACE || s.charCodeAt(lazyI + 1) === $.CHAR_TAB)) break
        if (lazyC >= $.CHAR_DIGIT_0 && lazyC <= $.CHAR_DIGIT_9) {
          var oi = lazyI
          while (oi < le && s.charCodeAt(oi) >= $.CHAR_DIGIT_0 && s.charCodeAt(oi) <= $.CHAR_DIGIT_9) oi++
          if (oi < le && (s.charCodeAt(oi) === $.CHAR_PERIOD || s.charCodeAt(oi) === $.CHAR_PAREN_CLOSE)) break
        }
      }
      // Don't allow lazy continuation if blockquote content has unclosed block elements
      if (contentHasOpenBlock) break
      content += s.slice(end, le) + '\n'
      hasLazyContinuation = true
      end = nextLine(s, le)
    } else {
      break
    }
  }

  if (!content && !alertType) return null

  // Parse blockquote content recursively
  // If lazy continuation was used, disable setext heading detection
  // (per CommonMark, setext underlines can't be lazy continuation lines)
  var savedBQ = state.inBlockQuote, savedNoSetext = state._noSetext
  state.inBlockQuote = true
  if (hasLazyContinuation) state._noSetext = true
  const children = parseBlocks(content || '', state, opts)
  state.inBlockQuote = savedBQ; state._noSetext = savedNoSetext

  const node: MarkdownToJSX.BlockQuoteNode = {
    type: RuleType.blockQuote,
    children,
  }
  if (alertType) {
    node.alert = alertType
  }

  return { node, end }
}

/** Calculate column position at offset p accounting for tabs */
function columnAt(s: string, lineStart: number, p: number): number {
  var col = 0
  for (var i = lineStart; i < p; i++) {
    if (s.charCodeAt(i) === $.CHAR_TAB) col += 4 - (col % 4)
    else col++
  }
  return col
}

/** Check if line starts a list item, return marker info */
function checkListMarker(s: string, p: number, e: number): {
  ordered: boolean; marker: string; start?: number;
  contentStart: number; contentCol: number; markerCol: number;
  isEmpty: boolean
} | null {
  indent(s, p, e)
  if (_indentSpaces > 3) return null

  var i = p + _indentChars
  if (i >= e) return null

  var c = s.charCodeAt(i)
  var markerCol = _indentSpaces
  var markerEnd = i

  // Unordered: - * +
  if (c === $.CHAR_DASH || c === $.CHAR_ASTERISK || c === $.CHAR_PLUS) {
    markerEnd = i + 1
    if (markerEnd < e && s.charCodeAt(markerEnd) !== $.CHAR_SPACE && s.charCodeAt(markerEnd) !== $.CHAR_TAB && s.charCodeAt(markerEnd) !== $.CHAR_NEWLINE) {
      return null
    }
  }
  // Ordered: 1. or 1)
  else if (c >= $.CHAR_DIGIT_0 && c <= $.CHAR_DIGIT_9) {
    var numEnd = i
    while (numEnd < e && numEnd - i < 9) {
      var nc = s.charCodeAt(numEnd)
      if (nc < $.CHAR_DIGIT_0 || nc > $.CHAR_DIGIT_9) break
      numEnd++
    }
    if (numEnd > i && numEnd < e) {
      var delim = s.charCodeAt(numEnd)
      if (delim === $.CHAR_PERIOD || delim === $.CHAR_PAREN_CLOSE) {
        markerEnd = numEnd + 1
        if (markerEnd < e && s.charCodeAt(markerEnd) !== $.CHAR_SPACE && s.charCodeAt(markerEnd) !== $.CHAR_TAB && s.charCodeAt(markerEnd) !== $.CHAR_NEWLINE) {
          return null
        }
      } else return null
    } else return null
  } else return null

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
      marker: c >= $.CHAR_DIGIT_0 && c <= $.CHAR_DIGIT_9 ? s[numEnd!] : s[i],
      start: c >= $.CHAR_DIGIT_0 && c <= $.CHAR_DIGIT_9 ? parseInt(s.slice(i, numEnd!), 10) : undefined,
      contentStart: afterMarker,
      contentCol: afterMarkerCol + 1,
      markerCol: markerCol,
      isEmpty: true
    }
  }

  // Count spaces after marker (1-4; if 5+, only 1 counts)
  while (contentPos < e && (s.charCodeAt(contentPos) === $.CHAR_SPACE || s.charCodeAt(contentPos) === $.CHAR_TAB)) {
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
    marker: c >= $.CHAR_DIGIT_0 && c <= $.CHAR_DIGIT_9 ? s[numEnd!] : s[i],
    start: c >= $.CHAR_DIGIT_0 && c <= $.CHAR_DIGIT_9 ? parseInt(s.slice(i, numEnd!), 10) : undefined,
    contentStart: contentPos,
    contentCol: contentCol,
    markerCol: markerCol,
    isEmpty: isEmpty
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
    } else break
    i++
  }
  return i
}

/** Scan list (ordered or unordered) */
function scanList(s: string, p: number, state: MarkdownToJSX.State, opts: ParseOptions): ScanResult {
  var firstLine = lineEnd(s, p)
  var firstMarker = checkListMarker(s, p, firstLine)
  if (!firstMarker) return null

  // Collect items: each item is { contentCol, raw, hasBlankAfter, isEmpty }
  var itemData: { contentCol: number; raw: string; hasBlankAfter: boolean; isEmpty: boolean }[] = []
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
      if (s.charCodeAt(fti) === $.CHAR_TAB) { firstHasTab = true; break }
    }
    if (firstHasTab) {
      var firstExpanded = ''
      var firstAbsCol = columnAt(s, p, firstMarker.contentStart)
      // Prepend virtual spaces for the gap between contentCol and absCol
      // (occurs when colsAfterMarker > 4 resets contentCol)
      var virtualGap = firstAbsCol - firstMarker.contentCol
      if (virtualGap > 0) {
        for (var vgi = 0; vgi < virtualGap; vgi++) firstExpanded += ' '
      }
      for (var fei = firstMarker.contentStart; fei < firstLine; fei++) {
        if (s.charCodeAt(fei) === $.CHAR_TAB) {
          var ftw = 4 - (firstAbsCol % 4)
          for (var fsi = 0; fsi < ftw; fsi++) firstExpanded += ' '
          firstAbsCol += ftw
        } else { firstExpanded += s[fei]; firstAbsCol++ }
      }
      curRaw = firstExpanded + '\n'
    } else {
      curRaw = s.slice(firstMarker.contentStart, firstLine) + '\n'
    }
  }
  end = nextLine(s, firstLine)

  while (end < s.length) {
    var le = lineEnd(s, end)
    indent(s, end, le)

    // Check for thematic break — but only if not indented enough for continuation
    var c0 = s.charCodeAt(end + _indentChars)
    if (_indentSpaces < curContentCol &&
        (c0 === $.CHAR_DASH || c0 === $.CHAR_ASTERISK || c0 === $.CHAR_UNDERSCORE) &&
        _indentSpaces <= 3 && scanThematic(s, end)) {
      break
    }

    // Check for new list item — sibling when markerCol < current item's contentCol
    var lineMarker = checkListMarker(s, end, le)
    if (lineMarker && lineMarker.ordered === firstMarker.ordered &&
        lineMarker.marker === firstMarker.marker &&
        lineMarker.markerCol < curContentCol) {
      // Save current item
      itemData.push({ contentCol: curContentCol, raw: curRaw, hasBlankAfter: curHasBlankAfter, isEmpty: curIsEmpty })
      if (curHasBlankAfter) hadBlankLine = true
      // Start new item
      curContentCol = lineMarker.contentCol
      curIsEmpty = lineMarker.isEmpty
      curHasBlankAfter = false
      curRaw = lineMarker.isEmpty ? '' : (s.slice(lineMarker.contentStart, le) + '\n')
      end = nextLine(s, le)
      continue
    }

    // Blank line
    if (isBlank(s, end, le)) {
      curRaw += '\n'
      end = nextLine(s, le)
      // After blank in empty item, check if list continues — charCode check avoids .trim()
      var curRawHasContent = false
      for (var cri = 0; cri < curRaw.length; cri++) {
        var crc = curRaw.charCodeAt(cri)
        if (crc !== $.CHAR_NEWLINE && crc !== $.CHAR_CR && crc !== $.CHAR_SPACE && crc !== $.CHAR_TAB) { curRawHasContent = true; break }
      }
      if (curIsEmpty && !curRawHasContent) {
        // List continues if next non-blank line is a matching list item
        if (end < s.length) {
          var peekLe = lineEnd(s, end)
          var peekMarker = checkListMarker(s, end, peekLe)
          if (!peekMarker || peekMarker.ordered !== firstMarker.ordered ||
              peekMarker.marker !== firstMarker.marker) {
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
        if ((nc === $.CHAR_DASH || nc === $.CHAR_ASTERISK || nc === $.CHAR_UNDERSCORE) && _indentSpaces <= 3 && scanThematic(s, end)) {
          break
        }
        // Check if next line is a new item in the same list
        var nextMarker = checkListMarker(s, end, nextLe)
        if (nextMarker && nextMarker.ordered === firstMarker.ordered &&
            nextMarker.marker === firstMarker.marker &&
            nextMarker.markerCol < curContentCol) {
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
        for (var ri = 0; ri < _stripRemaining; ri++) { expanded += ' '; absCol++ }
        for (var ei = stripped; ei < le; ei++) {
          if (s.charCodeAt(ei) === $.CHAR_TAB) {
            var etw = 4 - (absCol % 4)
            for (var eti = 0; eti < etw; eti++) expanded += ' '
            absCol += etw
          } else { expanded += s[ei]; absCol++ }
        }
        curRaw += expanded + '\n'
      } else {
        curRaw += s.slice(stripped, le) + '\n'
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
      if (lcc !== $.CHAR_NEWLINE && lcc !== $.CHAR_CR && lcc !== $.CHAR_SPACE && lcc !== $.CHAR_TAB) { lazyHasContent = true; break }
    }
    if (!curHasBlankAfter && lazyHasContent && !curIsEmpty) {
      var lineStart = end + _indentChars
      var lc = s.charCodeAt(lineStart)
      var isNewBlock =
        lc === $.CHAR_HASH ||
        lc === $.CHAR_GT ||
        lc === $.CHAR_LT ||
        (lc === $.CHAR_BACKTICK || lc === $.CHAR_TILDE) ||
        ((lc === $.CHAR_DASH || lc === $.CHAR_ASTERISK || lc === $.CHAR_UNDERSCORE || lc === $.CHAR_PLUS) &&
          (scanThematic(s, end) !== null || checkListMarker(s, end, le) !== null)) ||
        (lc >= $.CHAR_DIGIT_0 && lc <= $.CHAR_DIGIT_9 && checkListMarker(s, end, le) !== null)

      if (!isNewBlock) {
        // Mark lazy continuation with \u001E so it won't be parsed as block element
        curRaw += '\u001E' + s.slice(lineStart, le) + '\n'
        end = nextLine(s, le)
        continue
      }
    }

    break
  }

  // Save last item
  itemData.push({ contentCol: curContentCol, raw: curRaw, hasBlankAfter: curHasBlankAfter, isEmpty: curIsEmpty })

  if (itemData.length === 0) return null

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
        var fenced = false, fenceChar2 = 0, fenceLen2 = 0
        var nestedListCol = -1 // -1 = no active nested list
        while (rp < rLen) {
          var rle = raw.indexOf('\n', rp)
          if (rle < 0) rle = rLen
          // Inside fenced code block — skip until closing fence
          if (fenced) {
            indent(raw, rp, rle)
            var cl = raw.slice(rp + _indentChars, rle)
            var cc = 0
            while (cc < cl.length && cl.charCodeAt(cc) === fenceChar2) cc++
            if (cc >= fenceLen2 && cl.slice(cc).trim() === '') fenced = false
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
          if ((fc === $.CHAR_BACKTICK || fc === $.CHAR_TILDE) && _indentSpaces <= 3) {
            var fn = 0
            while (fn < lineText.length && lineText.charCodeAt(fn) === fc) fn++
            if (fn >= 3) {
              if (sawDirectBlank && sawDirectContent) { isLoose = true; break }
              fenced = true; fenceChar2 = fc; fenceLen2 = fn; sawDirectContent = true; rp = rle < rLen ? rle + 1 : rLen; continue
            }
          }
          // Check for list marker (starts a nested list)
          var lm = _indentSpaces <= 3 ? checkListMarker(raw, rp, rle) : null
          if (lm && sawDirectContent) {
            // If there was a blank before this nested block, it's between top-level blocks
            if (sawDirectBlank) { isLoose = true; break }
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
        if (isLoose) break
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
    while (itemEnd > 0 && itemRaw.charCodeAt(itemEnd - 1) === $.CHAR_NEWLINE) itemEnd--
    var itemContent = itemEnd < itemRaw.length ? itemRaw.slice(0, itemEnd) : itemRaw
    var taskNode: MarkdownToJSX.GFMTaskNode | null = null

    // Check for GFM task list item [ ] or [x]
    if (itemContent.length >= 3 && itemContent.charCodeAt(0) === $.CHAR_BRACKET_OPEN) { // [
      var tm = itemContent[1]
      if ((tm === ' ' || tm === 'x' || tm === 'X') && itemContent.charCodeAt(2) === $.CHAR_BRACKET_CLOSE) { // ]
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
      // Loose: parse as blocks — content is already indent-stripped
      var savedInList = state.inList; state.inList = true
      itemNodes = parseBlocks(itemContent, state, opts)
      state.inList = savedInList
    } else {
      // Tight: parse as blocks then unwrap paragraphs
      var savedInList2 = state.inList; state.inList = true
      itemNodes = parseBlocks(itemContent, state, opts)
      state.inList = savedInList2
      // Unwrap: if result is single paragraph, unwrap its children
      if (itemNodes.length === 1 && itemNodes[0].type === RuleType.paragraph) {
        itemNodes = (itemNodes[0] as MarkdownToJSX.ParagraphNode).children
      } else {
        // Unwrap paragraphs that are at top level (tight lists don't wrap in <p>)
        var unwrapped: MarkdownToJSX.ASTNode[] = []
        for (var ui = 0; ui < itemNodes.length; ui++) {
          if (itemNodes[ui].type === RuleType.paragraph) {
            var pChildren = (itemNodes[ui] as MarkdownToJSX.ParagraphNode).children
            for (var ci = 0; ci < pChildren.length; ci++) unwrapped.push(pChildren[ci])
          } else {
            unwrapped.push(itemNodes[ui])
          }
        }
        itemNodes = unwrapped
      }
    }

    if (taskNode) {
      // Add space between checkbox and content
      items.push([taskNode, { type: RuleType.text, text: ' ' } as MarkdownToJSX.TextNode, ...itemNodes])
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
    end
  }
}

// HTML block-level tag names (CommonMark spec)
const BLOCK_TAGS = new Set([
  'address', 'article', 'aside', 'base', 'basefont', 'blockquote', 'body',
  'caption', 'center', 'col', 'colgroup', 'dd', 'details', 'dialog', 'dir',
  'div', 'dl', 'dt', 'fieldset', 'figcaption', 'figure', 'footer', 'form',
  'frame', 'frameset', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header',
  'hr', 'html', 'iframe', 'legend', 'li', 'link', 'main', 'menu', 'menuitem',
  'nav', 'noframes', 'ol', 'optgroup', 'option', 'p', 'param', 'search',
  'section', 'summary', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead',
  'title', 'tr', 'track', 'ul'
])

/** Process raw attributes object - convert names, parse styles, sanitize URLs */
function processHTMLAttributes(rawAttrs: Record<string, string>, tagName: string, opts: ParseOptions): Record<string, any> {
  const attrs: Record<string, any> = {}

  const isJSXComponent = tagName[0] >= 'A' && tagName[0] <= 'Z'

  for (const [rawName, value] of Object.entries(rawAttrs)) {
    const name = isJSXComponent ? rawName : rawName.toLowerCase()

    if (name === 'style' && typeof value === 'string') {
      // Parse inline styles - handle url() values properly
      const styles: Record<string, string> = {}
      let decls: string[] = []
      let depth = 0
      let start = 0
      for (let j = 0; j < value.length; j++) {
        const c = value.charCodeAt(j)
        if (c === $.CHAR_PAREN_OPEN) depth++ // (
        else if (c === $.CHAR_PAREN_CLOSE) depth-- // )
        else if (c === $.CHAR_SEMICOLON && depth === 0) { // ;
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
    } else if (value === '') {
      attrs[name] = true
    } else {
      // Handle JSX interpolation: {expression} -> expression
      if (value.length >= 2 && value.charCodeAt(0) === $.CHAR_BRACE_OPEN && value.charCodeAt(value.length - 1) === $.CHAR_BRACE_CLOSE) {
        var inner = value.slice(1, -1)
        // Try JSON.parse for arrays/objects
        if (inner.length > 0) {
          var fc = inner.charCodeAt(0)
          if (fc === $.CHAR_BRACKET_OPEN || fc === $.CHAR_BRACE_OPEN) { // [ or {
            try {
              attrs[name] = JSON.parse(inner)
              continue
            } catch (e) { /* not valid JSON, fall through */ }
          }
        }
        // Check boolean literals
        if (inner === 'true') { attrs[name] = true; continue }
        if (inner === 'false') { attrs[name] = false; continue }
        // Eval unserializable expressions if opted in
        if (opts?.evalUnserializableExpressions) {
          try {
            attrs[name] = (0, eval)('(' + inner + ')')
            continue
          } catch (e) { /* eval failed, keep as string */ }
        }
        attrs[name] = inner
      } else {
        attrs[name] = value
      }
    }
  }

  return attrs
}

/** Parse HTML attributes from a string */
export function parseHTMLAttributes(attrStr: string, tagName: string, opts: ParseOptions): Record<string, any> {
  const attrs: Record<string, any> = {}
  let i = 0
  const len = attrStr.length

  while (i < len) {
    // Skip whitespace (space, tab, newline, carriage return)
    var c = attrStr.charCodeAt(i)
    while (i < len && (c === $.CHAR_SPACE || c === $.CHAR_TAB || c === $.CHAR_NEWLINE || c === $.CHAR_CR)) {
      i++
      c = attrStr.charCodeAt(i)
    }
    if (i >= len) break

    // Parse attribute name (not whitespace, =, /, >)
    const nameStart = i
    c = attrStr.charCodeAt(i)
    while (i < len && c !== $.CHAR_SPACE && c !== $.CHAR_TAB && c !== $.CHAR_NEWLINE && c !== $.CHAR_CR && c !== $.CHAR_EQ && c !== $.CHAR_SLASH && c !== $.CHAR_GT) {
      i++
      c = attrStr.charCodeAt(i)
    }
    if (i === nameStart) break
    let name = attrStr.slice(nameStart, i)

    // Convert HTML attribute names to React
    if (name === 'class') name = 'className'
    else if (name === 'for') name = 'htmlFor'
    else if (name.charCodeAt(0) === $.CHAR_d && name.startsWith('data-')) { /* keep as-is */ }
    else if (name.charCodeAt(0) === $.CHAR_a && name.startsWith('aria-')) { /* keep as-is */ }
    else {
      // Convert kebab-case to camelCase for other attributes
      if (name.indexOf('-') !== -1) {
        name = name.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase())
      }
    }

    // Skip whitespace
    c = attrStr.charCodeAt(i)
    while (i < len && (c === $.CHAR_SPACE || c === $.CHAR_TAB || c === $.CHAR_NEWLINE || c === $.CHAR_CR)) {
      i++
      c = attrStr.charCodeAt(i)
    }

    // Check for =
    if (attrStr.charCodeAt(i) !== $.CHAR_EQ) {
      attrs[name] = true
      continue
    }
    i++ // skip =

    // Skip whitespace
    c = attrStr.charCodeAt(i)
    while (i < len && (c === $.CHAR_SPACE || c === $.CHAR_TAB || c === $.CHAR_NEWLINE || c === $.CHAR_CR)) {
      i++
      c = attrStr.charCodeAt(i)
    }

    // Parse value
    let value: string
    const quote = attrStr.charCodeAt(i)
    if (quote === $.CHAR_DOUBLE_QUOTE || quote === $.CHAR_SINGLE_QUOTE) { // " or '
      i++
      const valueStart = i
      while (i < len && attrStr.charCodeAt(i) !== quote) i++
      value = attrStr.slice(valueStart, i)
      if (i < len) i++ // skip closing quote
    } else {
      const valueStart = i
      c = attrStr.charCodeAt(i)
      while (i < len && c !== $.CHAR_SPACE && c !== $.CHAR_TAB && c !== $.CHAR_NEWLINE && c !== $.CHAR_CR && c !== $.CHAR_GT) {
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
        if (c === $.CHAR_PAREN_OPEN) depth++ // (
        else if (c === $.CHAR_PAREN_CLOSE) depth-- // )
        else if (c === $.CHAR_SEMICOLON && depth === 0) { // ;
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
  // Pre-compute lowercase first char for fast rejection
  var fc = search.charCodeAt(0)
  if (fc >= $.CHAR_A && fc <= $.CHAR_Z) fc += $.CHAR_CASE_OFFSET
  for (let j = from; j <= str.length - searchLen; j++) {
    // Fast first-char check before entering inner loop
    var c0 = str.charCodeAt(j)
    if (c0 >= $.CHAR_A && c0 <= $.CHAR_Z) c0 += $.CHAR_CASE_OFFSET
    if (c0 !== fc) continue
    let match = true
    for (let k = 1; k < searchLen; k++) {
      let c1 = str.charCodeAt(j + k)
      let c2 = search.charCodeAt(k)
      if (c1 >= $.CHAR_A && c1 <= $.CHAR_Z) c1 += $.CHAR_CASE_OFFSET
      if (c2 >= $.CHAR_A && c2 <= $.CHAR_Z) c2 += $.CHAR_CASE_OFFSET
      if (c1 !== c2) { match = false; break }
    }
    if (match) return j
  }
  return -1
}

/** Case-insensitive lastIndexOf without allocating new string */
function lastIndexOfCI(str: string, search: string, from: number): number {
  const searchLen = search.length
  var fc = search.charCodeAt(0)
  if (fc >= $.CHAR_A && fc <= $.CHAR_Z) fc += $.CHAR_CASE_OFFSET
  for (let j = Math.min(from, str.length - searchLen); j >= 0; j--) {
    var c0 = str.charCodeAt(j)
    if (c0 >= $.CHAR_A && c0 <= $.CHAR_Z) c0 += $.CHAR_CASE_OFFSET
    if (c0 !== fc) continue
    let match = true
    for (let k = 1; k < searchLen; k++) {
      let c1 = str.charCodeAt(j + k)
      let c2 = search.charCodeAt(k)
      if (c1 >= $.CHAR_A && c1 <= $.CHAR_Z) c1 += $.CHAR_CASE_OFFSET
      if (c2 >= $.CHAR_A && c2 <= $.CHAR_Z) c2 += $.CHAR_CASE_OFFSET
      if (c1 !== c2) { match = false; break }
    }
    if (match) return j
  }
  return -1
}
/** Find matching closing tag (case-insensitive without allocation) */
var _closeTagStart = -1 // start of closing tag (e.g. position of <)
function findClosingTag(s: string, start: number, tagName: string): number {
  const tagLower = tagName.toLowerCase()
  const openTag = '<' + tagLower
  const closeTag = '</' + tagLower
  let depth = 1
  let i = start
  const len = s.length
  _closeTagStart = -1

  while (i < len && depth > 0) {
    const openIdx = indexOfCI(s, openTag, i)
    const closeIdx = indexOfCI(s, closeTag, i)

    if (closeIdx === -1) return -1 // No closing tag found

    if (openIdx !== -1 && openIdx < closeIdx) {
      // Use __parseHTMLTag to correctly identify if it's an opening tag and not self-closing
      const res = __parseHTMLTag(s, openIdx)
      if (res) {
        // Only count as nested open if tag name matches exactly (not just a prefix like AccordionItem matching Accordion)
        if (res.tag.toLowerCase() === tagLower && !res.isClosing && !res.selfClosing && !util.isVoidElement(res.tag)) {
          depth++
        }
        i = res.end
      } else {
        i = openIdx + 1
      }
    } else {
      // Found closing tag - verify it's the exact tag (not a prefix of a longer tag name)
      var afterClosePos = closeIdx + closeTag.length
      var afterClose = afterClosePos < len ? s.charCodeAt(afterClosePos) : 62 // treat EOF as >
      if (afterClose === $.CHAR_GT || afterClose === $.CHAR_SPACE || afterClose === $.CHAR_TAB || afterClose === $.CHAR_NEWLINE) {
        depth--
        if (depth === 0) {
          _closeTagStart = closeIdx
          // Find end of closing tag
          let j = closeIdx + closeTag.length
          while (j < len && s.charCodeAt(j) !== $.CHAR_GT) j++
          return j + 1
        }
      }
      i = closeIdx + 1
    }
  }

  return -1
}

/** Scan HTML block */
function scanHTMLBlock(s: string, p: number, state: MarkdownToJSX.State, opts: ParseOptions): ScanResult {
  if (opts.ignoreHTMLBlocks || opts.disableParsingRawHTML) return null

  var e = lineEnd(s, p)
  indent(s, p, e)
  // HTML blocks can be indented up to 3 spaces (unless we are already in an HTML block)
  if (_indentSpaces > 3 && !state.inHTML) return null

  var start = p + _indentChars
  if (s.charCodeAt(start) !== $.CHAR_LT) return null

  // Check for autolink (URL or email) - these are not HTML blocks
  var closeAngle = s.indexOf('>', start + 1)
  if (closeAngle !== -1 && closeAngle < e) {
    var content = s.slice(start + 1, closeAngle)
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(content) || /^[^\s@]+@[^\s@]+$/.test(content)) {
      return null
    }
  }

  // --- CommonMark HTML block type detection ---
  var htmlBlockType = detectHTMLBlockType(s, start)

  // Types 1-5: raw HTML block ending at specific pattern
  // Use indexOf/indexOfCI instead of per-line regex to avoid slice allocations
  if (htmlBlockType >= 1 && htmlBlockType <= 5) {
    var rawEnd = s.length
    if (htmlBlockType === 1) {
      // Search for closing tags of Type 1 elements (case-insensitive)
      var bestPos = s.length
      for (var ti = 0; ti < TYPE1_TAG_LIST.length; ti++) {
        var pos = indexOfCI(s, '</' + TYPE1_TAG_LIST[ti] + '>', start)
        if (pos >= 0 && pos < bestPos) bestPos = pos
      }
      if (bestPos < s.length) {
        // Find the > that closes the tag
        var closeGT = s.indexOf('>', bestPos)
        rawEnd = closeGT >= 0 ? nextLine(s, closeGT + 1) : s.length
      }
    } else {
      // Types 2-5: simple string search
      var searchStr = htmlBlockType === 2 ? '-->' : htmlBlockType === 3 ? '?>' : htmlBlockType === 4 ? '>' : ']]>'
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
          text: rawText,
          raw: true,
          endPos: rawEnd,
        } as MarkdownToJSX.HTMLCommentNode & { raw: boolean; endPos: number },
        end: rawEnd
      }
    }

    // Type 1: extract tag name, attrs, and parse children
    var type1TagName = 'div'
    var type1Match = rawText.match(/^<\/?([a-zA-Z][a-zA-Z0-9-]*)/)
    if (type1Match) type1TagName = type1Match[1]

    // Parse the opening tag for attrs
    var type1TagResult = __parseHTMLTag(s, start)
    var type1Attrs: Record<string, any> = {}
    var type1RawAttrs: string | undefined
    if (type1TagResult && !type1TagResult.isClosing) {
      type1Attrs = processHTMLAttributes(type1TagResult.attrs, type1TagName, opts)
      type1RawAttrs = type1TagResult.whitespaceBeforeAttrs + type1TagResult.rawAttrs
    }

    // Parse children from content between opening and closing tags
    // rawText = content after opening tag (may include closing tag) per reference parser
    var type1Children: MarkdownToJSX.ASTNode[] = []
    var type1TagNameLower = type1TagName.toLowerCase()
    var type1ClosePattern = '</' + type1TagNameLower
    var type1CloseIdx = indexOfCI(rawText, type1ClosePattern, 0)
    var type1RawText = rawText // default: full block
    var type1TextContent = ''
    if (type1TagResult && type1TagResult.isClosing) {
      // Closing tag: rawText = content after the closing tag
      type1RawText = rawText.slice(type1TagResult.end - start)
      while (type1RawText.length > 0 && type1RawText.charCodeAt(type1RawText.length - 1) === $.CHAR_NEWLINE)
        type1RawText = type1RawText.slice(0, -1)
    } else if (type1TagResult && !type1TagResult.isClosing) {
      var type1ContentStart = type1TagResult.end - start
      if (type1CloseIdx !== -1) {
        // Has closing tag: rawText = content after opening tag
        type1RawText = rawText.slice(type1ContentStart)
        if (type1RawText.charCodeAt(0) === $.CHAR_NEWLINE) type1RawText = type1RawText.slice(1)
        while (type1RawText.length > 0 && type1RawText.charCodeAt(type1RawText.length - 1) === $.CHAR_NEWLINE)
          type1RawText = type1RawText.slice(0, -1)
      } else {
        // No closing tag: rawText = full block including opening tag
        // (matches reference parser behavior, prevents HTML compiler from adding closing tag)
        type1RawText = rawText
        while (type1RawText.length > 0 && type1RawText.charCodeAt(type1RawText.length - 1) === $.CHAR_NEWLINE)
          type1RawText = type1RawText.slice(0, -1)
      }
      if (type1CloseIdx !== -1) {
        var type1Content = rawText.slice(type1ContentStart, type1CloseIdx)
        type1TextContent = type1Content.trim()
        if (type1TextContent) {
          // Parse as inline (no paragraph wrapping for Type 1)
          var saved_inline1 = state.inline, saved_inHTML1 = state.inHTML
          state.inline = true; state.inHTML = true
          type1Children = parseInline(type1TextContent, 0, type1TextContent.length, state, opts)
          state.inline = saved_inline1; state.inHTML = saved_inHTML1
        }
      }
    }

    var type1IsClosing = type1TagResult ? type1TagResult.isClosing : false
    return {
      node: {
        type: RuleType.htmlBlock,
        tag: type1TagName,
        attrs: type1Attrs,
        _rawAttrs: type1RawAttrs,
        children: type1Children,
        _rawText: type1RawText,
        text: type1TextContent,
        _verbatim: true,
        _isClosingTag: type1IsClosing,
        endPos: rawEnd,
        canInterruptParagraph: true,
      } as MarkdownToJSX.HTMLNode & { _isClosingTag: boolean; endPos: number; canInterruptParagraph: boolean },
      end: rawEnd
    }
  }

  // Types 6-7: HTML block ending at blank line
  if (htmlBlockType === 6 || htmlBlockType === 7) {
    var blankEnd = findNextBlankLine(s, p)
    var rawEnd6 = blankEnd < s.length ? blankEnd : s.length
    var rawText6 = s.slice(start, rawEnd6)
    var end6 = blankEnd < s.length ? nextLine(s, blankEnd) : s.length

    // Try structured parsing to extract tag name and attributes
    var tagResult67 = __parseHTMLTag(s, start)

    if (tagResult67) {
      var tagName67 = tagResult67.tag
      var tagNameLower67 = tagName67.toLowerCase()
      var type67IsClosing = tagResult67.isClosing

      // Closing tag path
      if (type67IsClosing) {
        var afterTag67 = s.slice(tagResult67.end, rawEnd6)
        return {
          node: {
            type: RuleType.htmlBlock,
            tag: tagName67,
            attrs: {},
            children: [],
            _rawText: afterTag67,
            text: afterTag67,
            _verbatim: true,
            _isClosingTag: true,
            endPos: rawEnd6,
            canInterruptParagraph: htmlBlockType === 6,
          } as MarkdownToJSX.HTMLNode & { _isClosingTag: boolean; endPos: number; canInterruptParagraph: boolean },
          end: end6
        }
      }

      // Opening tag - search for closing tag WITHIN this block (before blank line)
      // Limit search depth to prevent O(n²) on deeply nested same-tag structures
      var htmlDepth67 = (state._htmlDepth || 0)
      var blockContent67 = s.slice(start, rawEnd6)
      var closeIdx67 = -1
      var closeEndRel67 = -1
      if (!tagResult67.selfClosing && !util.isVoidElement(tagName67) && htmlDepth67 < 10) {
        var closeTag67 = '</' + tagNameLower67
        var searchStart67 = tagResult67.end - start
        var depth67 = 1
        var ci67 = searchStart67
        while (ci67 < blockContent67.length && depth67 > 0) {
          var openIdx67 = indexOfCI(blockContent67, '<' + tagNameLower67, ci67)
          var cIdx67 = indexOfCI(blockContent67, closeTag67, ci67)

          if (cIdx67 === -1) break // no closing tag in block

          if (openIdx67 !== -1 && openIdx67 < cIdx67) {
            // Check if it's a real opening tag (not a prefix match)
            var afterOpen67 = openIdx67 + tagNameLower67.length + 1
            if (afterOpen67 < blockContent67.length) {
              var ac67 = blockContent67.charCodeAt(afterOpen67)
              if (ac67 === $.CHAR_SPACE || ac67 === $.CHAR_TAB || ac67 === $.CHAR_NEWLINE || ac67 === $.CHAR_GT || ac67 === $.CHAR_SLASH) {
                depth67++
              }
            }
            ci67 = openIdx67 + 1
          } else {
            // Check closing tag is exact match
            var afterClose67 = cIdx67 + closeTag67.length
            if (afterClose67 < blockContent67.length) {
              var ac67c = blockContent67.charCodeAt(afterClose67)
              if (ac67c === $.CHAR_GT || ac67c === $.CHAR_SPACE || ac67c === $.CHAR_TAB || ac67c === $.CHAR_NEWLINE) {
                depth67--
                if (depth67 === 0) {
                  closeIdx67 = cIdx67
                  // Find end of closing tag (past >)
                  var j67 = afterClose67
                  while (j67 < blockContent67.length && blockContent67.charCodeAt(j67) !== $.CHAR_GT) j67++
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

        // Block extension: when no closing tag found within block (before blank line),
        // search beyond for the closing tag. If content between tags has blank lines
        // (block content), extend the block to include the closing tag.
        // This matches reference parser behavior for cases like <div>...\n\n</div>
        // Exclude table-related tags to preserve inner structure across blank lines.
        var blockWasExtended67 = false
        if (closeIdx67 === -1 && htmlBlockType === 6 && !tagResult67.isClosing && !TABLE_TAGS.has(tagNameLower67)) {
          var extSearchContent = s.slice(tagResult67.end)
          var extCloseIdx = indexOfCI(extSearchContent, closeTag67, 0)
          if (extCloseIdx !== -1) {
            var extContent = extSearchContent.slice(0, extCloseIdx)
            // Only extend if content has blank lines (block content)
            if (extContent.indexOf('\n\n') !== -1) {
              var extCloseAbs = tagResult67.end + extCloseIdx
              var extAfterClose = extCloseAbs + closeTag67.length
              while (extAfterClose < s.length && s.charCodeAt(extAfterClose) !== $.CHAR_GT) extAfterClose++
              if (extAfterClose < s.length && s.charCodeAt(extAfterClose) === $.CHAR_GT) {
                var extCloseEnd = extAfterClose + 1
                var extLineEnd = lineEnd(s, extCloseEnd)
                // Extend block boundaries
                rawEnd6 = extLineEnd
                end6 = nextLine(s, extLineEnd)
                blockContent67 = s.slice(start, rawEnd6)
                rawText6 = s.slice(start, rawEnd6)
                closeIdx67 = extCloseAbs - start
                closeEndRel67 = extCloseEnd - start
                blockWasExtended67 = true
              }
            }
          }
        }
      }

      // Determine if opening tag has multi-line attributes
      var hasMultiLineAttrs67 = tagResult67.rawAttrs.indexOf('\n') !== -1 ||
        tagResult67.whitespaceBeforeAttrs.indexOf('\n') !== -1

      // Check if closing tag is the last meaningful content in the block
      var isCleanBlock67 = false
      if (closeIdx67 !== -1) {
        var afterCloseInBlock67 = blockContent67.slice(closeEndRel67).trim()
        isCleanBlock67 = afterCloseInBlock67.length === 0
      }

      // When a closing tag is found, check if subsequent content starts with another
      // HTML tag. If so, limit block to the closing tag line to allow sibling tags
      // (e.g., <dt>...</dt>\n<dd>...</dd>) to be parsed separately.
      var useInHTMLBounds = false
      var effectiveEndPos = rawEnd6
      var effectiveEnd = end6
      if (closeIdx67 !== -1) {
        var closeAbsPos = start + closeEndRel67
        var closeLineEndPos = lineEnd(s, closeAbsPos - 1)
        // Check for same-line sibling tags after closing tag (e.g. <dt>foo</dt><dd>bar</dd>)
        if (closeAbsPos < closeLineEndPos) {
          var slp67 = closeAbsPos
          while (slp67 < closeLineEndPos && (s.charCodeAt(slp67) === $.CHAR_SPACE || s.charCodeAt(slp67) === $.CHAR_TAB)) slp67++
          if (slp67 < closeLineEndPos && s.charCodeAt(slp67) === $.CHAR_LT) { // '<'
            var sameLineSibling67 = __parseHTMLTag(s, slp67)
            if (sameLineSibling67 && !sameLineSibling67.isClosing) {
              useInHTMLBounds = true
              effectiveEndPos = closeAbsPos
              effectiveEnd = closeAbsPos
              isCleanBlock67 = true
            }
          }
        }
        // Check content on lines after closing tag for another HTML tag
        if (!useInHTMLBounds) {
          var nextLineStart67 = nextLine(s, closeLineEndPos)
          if (nextLineStart67 < rawEnd6) {
            // Skip leading whitespace on next line
            var nlp67 = nextLineStart67
            while (nlp67 < rawEnd6 && (s.charCodeAt(nlp67) === $.CHAR_SPACE || s.charCodeAt(nlp67) === $.CHAR_TAB)) nlp67++
            if (nlp67 < rawEnd6 && s.charCodeAt(nlp67) === $.CHAR_LT) { // '<'
              // Next line starts with HTML tag - check if it's a valid tag
              var nextTag67 = __parseHTMLTag(s, nlp67)
              if (nextTag67) {
                // Stop block at closing tag line
                useInHTMLBounds = true
                effectiveEndPos = closeLineEndPos
                effectiveEnd = nextLineStart67
                isCleanBlock67 = true
              }
            }
          }
        }
        // Also limit when inside HTML
        if (!useInHTMLBounds && state.inHTML) {
          useInHTMLBounds = true
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
          var s_inline67 = state.inline, s_inHTML67 = state.inHTML, s_htmlDepth67 = state._htmlDepth
          state.inHTML = true; state._htmlDepth = htmlDepth67 + 1
          // <p> can only contain inline/phrasing content per HTML spec, so always
          // use inline parsing — avoids block rules misinterpreting HTML angle
          // brackets (e.g. ">" on its own line) as blockquote markers
          var isPTag67 = tagNameLower67 === 'p'
          if (isPTag67) {
            state.inline = true
            children67 = parseInline(trimmed67, 0, trimmed67.length, state, opts)
          } else {
            // Detect block content using raw content (before trim) to preserve blank line detection
            var hasDoubleNewline67 = rawContent67.indexOf('\n\n') !== -1
            var hasBlockSyntax67 = /^(\s{0,3}#[#\s]|\s{0,3}[-*+]\s|\s{0,3}\d+\.\s|\s{0,3}>\s|\s{0,3}```)/m.test(trimmed67)
            var hasHTMLTags67 = /^<([a-z][^ >/\n\r]*) ?([^>]*?)>/im.test(trimmed67)
            var contentHasBlocks67 = hasDoubleNewline67 || hasBlockSyntax67 || (state.inHTML && hasHTMLTags67)

            if (contentHasBlocks67 || hasHTMLTags67) {
              state.inline = false
              children67 = parseBlocks(rawContent67, state, opts)
            } else {
              state.inline = true
              children67 = parseInline(trimmed67, 0, trimmed67.length, state, opts)
            }
          }
          // Restore state
          state.inline = s_inline67; state.inHTML = s_inHTML67; state._htmlDepth = s_htmlDepth67
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
      if (htmlBlockType === 6 && closeIdx67 !== -1 && !state.inHTML && !hasMultiLineAttrs67) {
        var contentBetween67 = rawContent67
        // Only force verbatim if content has HTML tags (sibling elements to split)
        // AND no block-level syntax (which needs children-based parsing)
        var hasHTMLInContent67 = /<[a-zA-Z][^>]*>/.test(contentBetween67)
        var hasBlockInContent67 = /\n\n/.test(contentBetween67) ||
          /^(\s{0,3}#[#\s]|\s{0,3}[-*+]\s|\s{0,3}\d+\.\s|\s{0,3}>\s|\s{0,3}```)/m.test(contentBetween67)
        if (hasHTMLInContent67 && !hasBlockInContent67) {
          type6InlineVerbatim67 = true
        }
      }
      var useVerbatim67 = state.inHTML || htmlBlockType === 7 || hasMultiLineAttrs67 || !isCleanBlock67 || type6InlineVerbatim67

      if (useVerbatim67) {
        // Determine rawText based on context:
        // - inHTML with close tag: content between tags (rawContent67)
        // - Type 7 with close tag: content after opening tag including close tag
        // - Type 6 multi-line attrs: full block text from start (HTML compiler expects this)
        // - inHTML without close tag: block from start to effective end
        // - Others: full block text from start (rawText6)
        var rawText67v: string
        if (closeIdx67 !== -1 && useInHTMLBounds) {
          // When inside HTML with same-line siblings after closing tag,
          // rawText includes everything from after opening tag (including closing tag
          // and siblings). The React compiler re-parses rawText to split siblings.
          // Only extend rawText when sibling tags exist on the SAME LINE after closing tag
          var hasAfterClose67 = false
          if (state.inHTML && closeEndRel67 < blockContent67.length) {
            // Check same-line content only (stop at newline)
            var sameLineEnd67 = closeEndRel67
            while (sameLineEnd67 < blockContent67.length && blockContent67.charCodeAt(sameLineEnd67) !== $.CHAR_NEWLINE) sameLineEnd67++
            var sameLineAfter67 = blockContent67.slice(closeEndRel67, sameLineEnd67).trim()
            // Must be an opening tag (not closing tag like </div>)
            hasAfterClose67 = sameLineAfter67.length > 1 &&
              sameLineAfter67.charCodeAt(0) === $.CHAR_LT && // '<'
              sameLineAfter67.charCodeAt(1) !== $.CHAR_SLASH // not '/'
          }
          rawText67v = hasAfterClose67
            ? blockContent67.slice(tagResult67.end - start)
            : rawContent67
        } else if ((htmlBlockType === 7 || state.inHTML) && closeIdx67 !== -1) {
          // For Type 7 and inHTML: rawText = content after opening tag including close tag
          rawText67v = blockContent67.slice(tagResult67.end - start)
          // Strip leading newline (reference parser behavior)
          if (rawText67v.charCodeAt(0) === $.CHAR_NEWLINE) rawText67v = rawText67v.slice(1)
        } else if (useInHTMLBounds) {
          rawText67v = s.slice(start, effectiveEndPos)
        } else if (hasMultiLineAttrs67) {
          rawText67v = rawText6
        } else {
          // Content after opening tag (not including opening tag itself)
          rawText67v = blockContent67.slice(tagResult67.end - start)
          if (rawText67v.charCodeAt(0) === $.CHAR_NEWLINE) rawText67v = rawText67v.slice(1)
        }

        return {
          node: {
            type: RuleType.htmlBlock,
            tag: tagName67,
            attrs: processHTMLAttributes(tagResult67.attrs, tagName67, opts),
            _rawAttrs: tagResult67.whitespaceBeforeAttrs + tagResult67.rawAttrs,
            children: children67,
            _rawText: rawText67v,
            text: rawText67v,
            _verbatim: true,
            _isClosingTag: false,
            endPos: effectiveEndPos,
            canInterruptParagraph: htmlBlockType === 6,
          } as MarkdownToJSX.HTMLNode & { _isClosingTag: boolean; endPos: number; canInterruptParagraph: boolean },
          end: effectiveEnd
        }
      }

      // Clean block with closing tag as last content - not verbatim
      // For block-extended nodes (content has blank lines), clear rawText so
      // HTML compiler uses children path instead of rawText path
      return {
        node: {
          type: RuleType.htmlBlock,
          tag: tagName67,
          attrs: processHTMLAttributes(tagResult67.attrs, tagName67, opts),
          _rawAttrs: tagResult67.whitespaceBeforeAttrs + tagResult67.rawAttrs,
          children: children67,
          _rawText: blockWasExtended67 ? '' : rawContent67,
          text: rawContent67,
          _verbatim: false,
          _isClosingTag: false,
          endPos: effectiveEndPos,
          canInterruptParagraph: htmlBlockType === 6,
        } as MarkdownToJSX.HTMLNode & { _isClosingTag: boolean; endPos: number; canInterruptParagraph: boolean },
        end: effectiveEnd
      }
    }

    // __parseHTMLTag failed - fallback to raw text extraction
    var type67Match = rawText6.match(/^<(\/?)([a-zA-Z][a-zA-Z0-9-]*)/)
    var type67TagF = type67Match ? type67Match[2] : 'div'
    var type67IsClosingF = type67Match ? type67Match[1] === '/' : false
    var type67RawTextF = rawText6
    if (type67IsClosingF) {
      var closeAngle67 = rawText6.indexOf('>')
      if (closeAngle67 !== -1) {
        type67RawTextF = rawText6.slice(closeAngle67 + 1)
      }
    }

    return {
      node: {
        type: RuleType.htmlBlock,
        tag: type67TagF,
        attrs: {},
        children: [],
        _rawText: type67RawTextF,
        text: type67RawTextF,
        _verbatim: true,
        _isClosingTag: type67IsClosingF,
        endPos: rawEnd6,
        canInterruptParagraph: htmlBlockType === 6,
      } as MarkdownToJSX.HTMLNode & { _isClosingTag: boolean; endPos: number; canInterruptParagraph: boolean },
      end: end6
    }
  }

  // Not a CommonMark HTML block - try structured parsing for JSX/React components
  var tagResult = __parseHTMLTag(s, start)
  if (!tagResult) return null

  var tagName = tagResult.tag
  var tagNameLower = tagName.toLowerCase()
  var firstChar = tagName.charCodeAt(0)
  var isJSX = firstChar >= $.CHAR_A && firstChar <= $.CHAR_Z
  // Skip tags that aren't block-level for block parsing
  // Known lowercase tags not in BLOCK_TAGS/TYPE1_TAGS are inline — skip them here
  // Custom elements (contain hyphen, e.g. <my-widget>) proceed to block parsing
  if (!isJSX && !BLOCK_TAGS.has(tagNameLower) && !TYPE1_TAGS.has(tagNameLower) &&
      !tagNameLower.includes('-')) return null

  // Closing tag
  if (tagResult.isClosing) {
    return {
      node: {
        type: RuleType.htmlSelfClosing,
        tag: tagName,
        attrs: {},
        endPos: tagResult.end,
        _isClosingTag: true,
        _rawText: s.slice(start, tagResult.end),
      } as MarkdownToJSX.HTMLSelfClosingNode & { endPos: number; _isClosingTag: boolean; _rawText: string },
      end: tagResult.end
    }
  }

  var shouldSearchForClosingTag = true
  var closeEnd = findClosingTag(s, tagResult.end, tagName)

  var children: MarkdownToJSX.ASTNode[] = []
  if (closeEnd !== -1) {
    var contentEnd = _closeTagStart
    var rawContent = s.slice(tagResult.end, contentEnd)
    var trimmed = rawContent.trim()
    if (trimmed) {
      // Detect block content vs inline content (same logic as Type 6/7 path)
      var hasDoubleNL = rawContent.indexOf('\n\n') !== -1
      var hasBlockSyn = /^(\s{0,3}#[#\s]|\s{0,3}[-*+]\s|\s{0,3}\d+\.\s|\s{0,3}>\s|\s{0,3}```)/m.test(trimmed)
      var hasHTMLTagsS = /^<([a-z][^ >/\n\r]*) ?([^>]*?)>/im.test(trimmed)
      var s_inl = state.inline, s_htm = state.inHTML, s_hd = state._htmlDepth
      state.inHTML = true; state._htmlDepth = (state._htmlDepth || 0) + 1
      if (hasDoubleNL || hasBlockSyn || hasHTMLTagsS) {
        state.inline = false
        children = parseBlocks(rawContent, state, opts)
      } else {
        state.inline = true
        children = parseInline(trimmed, 0, trimmed.length, state, opts)
      }
      state.inline = s_inl; state.inHTML = s_htm; state._htmlDepth = s_hd
    }

    var lineEndPos = lineEnd(s, closeEnd)
    var afterClose = s.slice(closeEnd, lineEndPos).trim()
    var endPos = afterClose ? closeEnd : nextLine(s, closeEnd)

    // _rawText: full block from start (including opening tag) for React compiler's re-parse logic
    var rawTextJSX = isJSX ? s.slice(start, closeEnd) : s.slice(start, endPos)
    var nodeEndPos = isJSX ? closeEnd : endPos

    return {
      node: {
        type: RuleType.htmlBlock,
        tag: tagName,
        attrs: processHTMLAttributes(tagResult.attrs, tagName, opts),
        _rawAttrs: tagResult.whitespaceBeforeAttrs + tagResult.rawAttrs,
        children,
        _rawText: rawTextJSX,
        text: isJSX ? rawContent : rawTextJSX,
        _verbatim: true,
        _isClosingTag: false,
        endPos: nodeEndPos,
        canInterruptParagraph: false,
      } as MarkdownToJSX.HTMLNode & { _isClosingTag: boolean; endPos: number; canInterruptParagraph: boolean },
      end: endPos
    }
  }

  // No closing tag found - go until blank line
  var blankLineEnd = findNextBlankLine(s, tagResult.end)
  var endFallback = blankLineEnd < s.length ? nextLine(s, blankLineEnd) : blankLineEnd
  var contentFallback = s.slice(tagResult.end, blankLineEnd)

  if (contentFallback.trim()) {
    var s_inlF = state.inline, s_htmF = state.inHTML, s_hdF = state._htmlDepth
    state.inline = false; state.inHTML = true; state._htmlDepth = (state._htmlDepth || 0) + 1
    children = parseBlocks(contentFallback, state, opts)
    state.inline = s_inlF; state.inHTML = s_htmF; state._htmlDepth = s_hdF
  }

  var rawTextFallback = s.slice(tagResult.end, blankLineEnd)

  return {
    node: {
      type: RuleType.htmlBlock,
      tag: tagName,
      attrs: processHTMLAttributes(tagResult.attrs, tagName, opts),
      _rawAttrs: tagResult.whitespaceBeforeAttrs + tagResult.rawAttrs,
      children,
      _rawText: rawTextFallback,
      text: contentFallback,
      _verbatim: true,
      _isClosingTag: false,
      endPos: blankLineEnd,
      canInterruptParagraph: false,
    } as MarkdownToJSX.HTMLNode & { _isClosingTag: boolean; endPos: number; canInterruptParagraph: boolean },
    end: endFallback
  }
}

/** Detect CommonMark HTML block type (1-7) or 0 if not an HTML block */
function detectHTMLBlockType(s: string, p: number): number {
  if (s.charCodeAt(p) !== $.CHAR_LT) return 0
  var i = p + 1
  var len = s.length

  // Type 2: <!-- comment
  if (s.charCodeAt(i) === $.CHAR_EXCLAMATION && s.charCodeAt(i + 1) === $.CHAR_DASH && s.charCodeAt(i + 2) === $.CHAR_DASH) return 2

  // Type 3: <? processing instruction
  if (s.charCodeAt(i) === $.CHAR_QUESTION) return 3

  // Type 4: <!LETTER declaration
  if (s.charCodeAt(i) === $.CHAR_EXCLAMATION) {
    var nc = s.charCodeAt(i + 1)
    if (nc >= $.CHAR_A && nc <= $.CHAR_Z) return 4
    // Type 5: <![CDATA[
    if (s.slice(i + 1, i + 8) === '[CDATA[') return 5
  }

  // Extract tag name for types 1, 6, 7
  var isClosing = s.charCodeAt(i) === $.CHAR_SLASH
  var nameStart = isClosing ? i + 1 : i
  var nameEnd = nameStart
  while (nameEnd < len) {
    var cc = s.charCodeAt(nameEnd)
    if ((cc >= $.CHAR_A && cc <= $.CHAR_Z) || (cc >= $.CHAR_a && cc <= $.CHAR_z) || (cc >= $.CHAR_DIGIT_0 && cc <= $.CHAR_DIGIT_9) || cc === $.CHAR_DASH) {
      nameEnd++
    } else break
  }
  if (nameEnd === nameStart) return 0
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
    if (afterOpen === $.CHAR_SPACE || afterOpen === $.CHAR_TAB || afterOpen === $.CHAR_GT || afterOpen === $.CHAR_NEWLINE || nameEnd >= len) return 1
    return 0
  }

  // Type 6: block-level tag
  if (BLOCK_TAGS.has(tagName.toLowerCase())) {
    if (isClosing) {
      // Closing: </tag> with optional whitespace
      var j6 = nameEnd
      while (j6 < len && (s.charCodeAt(j6) === $.CHAR_SPACE || s.charCodeAt(j6) === $.CHAR_TAB)) j6++
      if (j6 < len && s.charCodeAt(j6) === $.CHAR_GT) return 6
      return 0
    }
    // Opening: must be followed by whitespace, >, />, or end of line
    var ac = nameEnd < len ? s.charCodeAt(nameEnd) : -1
    if (ac === $.CHAR_SPACE || ac === $.CHAR_TAB || ac === $.CHAR_GT || ac === $.CHAR_NEWLINE || ac === $.CHAR_SLASH || ac === -1) return 6
    return 0
  }

  // Type 7: complete tag on its own line - tag must end on same line
  // Cannot be a type 1 or type 6 tag (already checked above)
  if (!isClosing) {
    var le = lineEnd(s, p)
    var tagRes = __parseHTMLTag(s, p)
    if (tagRes && tagRes.end <= le) {
      // Must be the only thing on the line (optionally followed by whitespace)
      var afterTag = s.slice(tagRes.end, le).trim()
      if (afterTag === '') return 7
    }
  } else {
    // Closing tag for type 7
    var j7 = nameEnd
    while (j7 < len && (s.charCodeAt(j7) === $.CHAR_SPACE || s.charCodeAt(j7) === $.CHAR_TAB)) j7++
    if (j7 < len && s.charCodeAt(j7) === $.CHAR_GT) {
      // Must be the only thing on the line
      var le7 = lineEnd(s, p)
      var afterTag7 = s.slice(j7 + 1, le7).trim()
      if (afterTag7 === '') return 7
    }
  }

  return 0
}

/** Parse table row cells */
function parseTableRow(s: string, state: MarkdownToJSX.State, opts: ParseOptions): MarkdownToJSX.ASTNode[][] {
  // Find row bounds (trim leading/trailing pipe) using indices to avoid substring allocation
  var rStart = 0, rEnd = s.length
  while (rStart < rEnd && (s.charCodeAt(rStart) === $.CHAR_SPACE || s.charCodeAt(rStart) === $.CHAR_TAB)) rStart++
  while (rEnd > rStart && (s.charCodeAt(rEnd - 1) === $.CHAR_SPACE || s.charCodeAt(rEnd - 1) === $.CHAR_TAB)) rEnd--
  if (rStart < rEnd && s.charCodeAt(rStart) === $.CHAR_PIPE) rStart++
  if (rEnd > rStart && s.charCodeAt(rEnd - 1) === $.CHAR_PIPE && (rEnd - 2 < rStart || s.charCodeAt(rEnd - 2) !== $.CHAR_BACKSLASH)) rEnd--

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
    if (ch === $.CHAR_BACKSLASH && i + 1 < rEnd) { // backslash
      if (s.charCodeAt(i + 1) === $.CHAR_PIPE) { // \|
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
    if (ch === $.CHAR_BACKTICK) { // `
      var backticks = 0
      while (i < rEnd && s.charCodeAt(i) === $.CHAR_BACKTICK) { backticks++; i++ }
      var found = false
      while (i < rEnd && !found) {
        var closeBackticks = 0
        while (i < rEnd && s.charCodeAt(i) === $.CHAR_BACKTICK) { closeBackticks++; i++ }
        if (closeBackticks === backticks) {
          found = true
        } else if (closeBackticks === 0) {
          i++
        }
      }
      continue
    }
    // Handle cell separator
    if (ch === $.CHAR_PIPE) { // |
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

  return cells.map(function(cell) {
    // Replace remaining \| with | (pipe escapes inside code spans are kept during splitting)
    var processed = cell.indexOf('\\|') !== -1 ? cell.replace(/\\\|/g, '|') : cell
    return parseInline(processed, 0, processed.length, state, opts)
  })
}

/** Scan GFM table */
function scanTable(s: string, p: number, state: MarkdownToJSX.State, opts: ParseOptions): ScanResult {
  const firstEnd = lineEnd(s, p)

  // Must have at least one | — check without slicing
  var pipeIdx = s.indexOf('|', p)
  if (pipeIdx < 0 || pipeIdx >= firstEnd) return null

  // Check for delimiter row
  const secondStart = nextLine(s, firstEnd)
  if (secondStart >= s.length) return null

  const secondEnd = lineEnd(s, secondStart)
  // Delimiter row must match pattern: |? :?-+:? (| :?-+:?)* |?
  if (!isDelimiterRow(s, secondStart, secondEnd)) return null

  // Only slice firstLine after delimiter check passes (most | chars aren't tables)
  const firstLine = s.slice(p, firstEnd)
  const delimLine = s.slice(secondStart, secondEnd)

  // Parse alignment from delimiter row — single pass, no split/map/trim
  var align: (null | 'left' | 'right' | 'center')[] = []
  var di = 0, dLen = delimLine.length
  // skip leading whitespace + optional pipe
  while (di < dLen && (delimLine.charCodeAt(di) === $.CHAR_SPACE || delimLine.charCodeAt(di) === $.CHAR_TAB)) di++
  if (di < dLen && delimLine.charCodeAt(di) === $.CHAR_PIPE) di++
  while (di < dLen) {
    // skip whitespace before cell
    while (di < dLen && (delimLine.charCodeAt(di) === $.CHAR_SPACE || delimLine.charCodeAt(di) === $.CHAR_TAB)) di++
    if (di >= dLen) break
    // trailing pipe — done
    if (delimLine.charCodeAt(di) === $.CHAR_PIPE) break
    // check leading colon
    var hasLeft = delimLine.charCodeAt(di) === $.CHAR_COLON
    if (hasLeft) di++
    // skip dashes
    while (di < dLen && delimLine.charCodeAt(di) === $.CHAR_DASH) di++
    // check trailing colon
    var hasRight = di < dLen && delimLine.charCodeAt(di) === $.CHAR_COLON
    if (hasRight) di++
    align.push(hasLeft && hasRight ? 'center' : hasRight ? 'right' : hasLeft ? 'left' : null)
    // skip whitespace + pipe
    while (di < dLen && (delimLine.charCodeAt(di) === $.CHAR_SPACE || delimLine.charCodeAt(di) === $.CHAR_TAB)) di++
    if (di < dLen && delimLine.charCodeAt(di) === $.CHAR_PIPE) di++
  }

  // Parse header
  const header = parseTableRow(firstLine, state, opts)

  // Delimiter column count must match header
  if (align.length !== header.length) return null

  // Parse body cells
  const cells: MarkdownToJSX.ASTNode[][][] = []
  let end = nextLine(s, secondEnd)

  while (end < s.length) {
    const le = lineEnd(s, end)
    const line = s.slice(end, le)

    if (isBlank(s, end, le)) break
    // Check if line starts a block element that should end the table
    indent(s, end, le)
    if (_indentSpaces < 4) {
      var tc = s.charCodeAt(end + _indentChars)
      // Blockquote, heading, thematic break, fenced code, HTML block all end the table
      if (tc === $.CHAR_GT || tc === $.CHAR_HASH) break // > or #
      if ((tc === $.CHAR_DASH || tc === $.CHAR_ASTERISK || tc === $.CHAR_UNDERSCORE) && scanThematic(s, end)) break
      if ((tc === $.CHAR_BACKTICK || tc === $.CHAR_TILDE)) {
        var tfp = end + _indentChars, tfc = 0
        while (tfp < le && s.charCodeAt(tfp) === tc) { tfc++; tfp++ }
        if (tfc >= 3) break
      }
    }
    // Per GFM, body rows don't require | — they can be pipeless (single-cell)

    cells.push(parseTableRow(line, state, opts))
    end = nextLine(s, le)
  }

  // For streaming mode: suppress tables with header + separator but no data rows
  // (data rows might be coming in a later stream chunk)
  if ((opts.streaming || opts.optimizeForStreaming) && cells.length === 0) {
    return null
  }

  // Normalize: pad/trim rows to match header column count
  var colCount = header.length
  for (var ri = 0; ri < cells.length; ri++) {
    if (cells[ri].length < colCount) {
      while (cells[ri].length < colCount) cells[ri].push([])
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
    end
  }
}

/** Scan link reference definition [label]: url "title" */
function scanRefDefinition(s: string, p: number, state: MarkdownToJSX.State): ScanResult {
  var e = lineEnd(s, p)
  indent(s, p, e)
  if (_indentSpaces > 3) return null

  var i = p + _indentChars
  if (s.charCodeAt(i) !== $.CHAR_BRACKET_OPEN) return null // [

  // Check for footnote [^
  if (i + 1 < s.length && s.charCodeAt(i + 1) === $.CHAR_CARET) {
    // Footnote definition - handle separately
    var fnResult = parseFootnoteDefinition(s, i, state)
    if (fnResult) return fnResult
    return null
  }

  // Use parseRefDef which handles multi-line titles correctly
  if (!state.refs) state.refs = {}
  var result = parseRefDef(s, i, state.refs)
  if (result === null) return null

  return { node: { type: RuleType.refCollection } as MarkdownToJSX.ASTNode, end: result }
}

function parseFootnoteDefinition(s: string, p: number, state: MarkdownToJSX.State): ScanResult {
  // Parse [^label]:
  var len = s.length
  if (s.charCodeAt(p) !== $.CHAR_BRACKET_OPEN || p + 1 >= len || s.charCodeAt(p + 1) !== $.CHAR_CARET) return null

  var i = p + 2
  var labelStart = i
  while (i < len && s.charCodeAt(i) !== $.CHAR_BRACKET_CLOSE) {
    if (s.charCodeAt(i) === $.CHAR_NEWLINE) return null
    i++
  }
  if (i >= len) return null
  var label = ('^' + s.slice(labelStart, i)).toLowerCase()
  i++ // skip ]

  if (i >= len || s.charCodeAt(i) !== $.CHAR_COLON) return null
  i++ // skip :

  // Skip whitespace
  while (i < len && (s.charCodeAt(i) === $.CHAR_SPACE || s.charCodeAt(i) === $.CHAR_TAB)) i++
  if (i < len && s.charCodeAt(i) === $.CHAR_NEWLINE) {
    i++
    while (i < len && (s.charCodeAt(i) === $.CHAR_SPACE || s.charCodeAt(i) === $.CHAR_TAB)) i++
  }

  // Collect content
  var fnEnd = s.indexOf('\n', i)
  if (fnEnd < 0) fnEnd = len
  var content = s.slice(i, fnEnd).trim()
  var end = fnEnd < len ? fnEnd + 1 : len

  // Multiline continuation (2+ space indent)
  while (end < len) {
    var nextLe = lineEnd(s, end)
    indent(s, end, nextLe)
    if (_indentSpaces >= 2 && !isBlank(s, end, nextLe)) {
      content += '\n' + s.slice(end, nextLe)
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

  if (!state.refs[label]) state.refs[label] = { target: content, title: undefined }
  return { node: { type: RuleType.footnote } as MarkdownToJSX.ASTNode, end }
}

/** Scan paragraph (fallback) */
function scanParagraph(s: string, p: number, state: MarkdownToJSX.State, opts: ParseOptions): ScanResult {
  let end = p
  let setextLevel = 0
  let textEnd = 0
  let cachedLe = -1 // Cache lineEnd from previous iteration's next-line check

  while (end < s.length) {
    const le = cachedLe >= 0 ? cachedLe : lineEnd(s, end)
    cachedLe = -1

    // Check for blank line
    if (isBlank(s, end, le)) break

    // Check if this line is a setext underline
    indent(s, end, le)
    if (_indentSpaces < 4 && textEnd > 0 && !state._noSetext) {
      const c = s.charCodeAt(end + _indentChars)
      if (c === $.CHAR_EQ || c === $.CHAR_DASH) { // = or -
        // Check if entire line is = or - (with optional spaces)
        let i = end + _indentChars
        while (i < le && s.charCodeAt(i) === c) i++
        while (i < le && (s.charCodeAt(i) === $.CHAR_SPACE || s.charCodeAt(i) === $.CHAR_TAB)) i++
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
        if (c === $.CHAR_GT) { // > blockquote
          end = nextStart
          break
        }
        if (c === $.CHAR_HASH) { // # heading - must be valid ATX heading
          if (scanHeading(s, nextStart, state, opts)) {
            end = nextStart
            break
          }
        }
        if (c === $.CHAR_BACKTICK || c === $.CHAR_TILDE) { // ` or ~ fenced code - need 3+
          var fenceCheck = nextStart + _indentChars
          var fenceCheckCount = 0
          while (fenceCheck < nextLe && s.charCodeAt(fenceCheck) === c) { fenceCheckCount++; fenceCheck++ }
          if (fenceCheckCount >= 3) {
            end = nextStart
            break
          }
        }
        // HTML blocks can interrupt paragraphs, but only types 1-6
        // Type 7 (generic tags) cannot interrupt paragraphs
        // Pre-check tag name before calling expensive scanHTMLBlock
        if (c === $.CHAR_LT) {
          var afterLT = nextStart + _indentChars + 1
          var hc = afterLT < nextLe ? s.charCodeAt(afterLT) : 0
          var canInterrupt =
            hc === $.CHAR_EXCLAMATION || // ! (comment <!--, <!DOCTYPE, <![CDATA[)
            hc === $.CHAR_QUESTION    // ? (processing instruction <?)
          if (!canInterrupt && hc === $.CHAR_SLASH) {
            // Closing tag — extract tag name and check if block-level
            var closeTagStart = afterLT + 1
            var closeTagEnd = closeTagStart
            while (closeTagEnd < nextLe && ((s.charCodeAt(closeTagEnd) >= $.CHAR_A && s.charCodeAt(closeTagEnd) <= $.CHAR_Z) || (s.charCodeAt(closeTagEnd) >= $.CHAR_a && s.charCodeAt(closeTagEnd) <= $.CHAR_z) || (s.charCodeAt(closeTagEnd) >= $.CHAR_DIGIT_0 && s.charCodeAt(closeTagEnd) <= $.CHAR_DIGIT_9) || s.charCodeAt(closeTagEnd) === $.CHAR_DASH)) closeTagEnd++
            if (closeTagEnd > closeTagStart) canInterrupt = BLOCK_TAGS.has(s.slice(closeTagStart, closeTagEnd).toLowerCase())
          } else if (!canInterrupt) {
            // Opening tag — extract tag name and check if block-level (type 1 or 6)
            var tagEndHC = afterLT
            while (tagEndHC < nextLe && ((s.charCodeAt(tagEndHC) >= $.CHAR_A && s.charCodeAt(tagEndHC) <= $.CHAR_Z) || (s.charCodeAt(tagEndHC) >= $.CHAR_a && s.charCodeAt(tagEndHC) <= $.CHAR_z) || (s.charCodeAt(tagEndHC) >= $.CHAR_DIGIT_0 && s.charCodeAt(tagEndHC) <= $.CHAR_DIGIT_9) || s.charCodeAt(tagEndHC) === $.CHAR_DASH)) tagEndHC++
            if (tagEndHC > afterLT) {
              var tagNameLC = s.slice(afterLT, tagEndHC).toLowerCase()
              canInterrupt = BLOCK_TAGS.has(tagNameLC) || TYPE1_TAGS.has(tagNameLC)
            }
          }
          // Only call expensive scanHTMLBlock if pre-check passes
          if (canInterrupt && scanHTMLBlock(s, nextStart, state, opts)) {
            end = nextStart
            break
          }
        }
        // List items can interrupt paragraphs (- * + or digit followed by . or ))
        // But empty list items CANNOT interrupt paragraphs per CommonMark
        if (c === $.CHAR_DASH || c === $.CHAR_ASTERISK || c === $.CHAR_PLUS) {
          // - * + followed by space/tab (must have content — not empty)
          const next = nextStart + _indentChars + 1
          if (next < nextLe && (s.charCodeAt(next) === $.CHAR_SPACE || s.charCodeAt(next) === $.CHAR_TAB)) {
            // Has content after space — check it's not all whitespace (empty item)
            var contentAfterMarker = skipWS(s, next, nextLe)
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
          while (i < nextLe && s.charCodeAt(i) >= $.CHAR_DIGIT_0 && s.charCodeAt(i) <= $.CHAR_DIGIT_9) i++
          if (i < nextLe && (s.charCodeAt(i) === $.CHAR_PERIOD || s.charCodeAt(i) === $.CHAR_PAREN_CLOSE)) {
            if (i - (nextStart + _indentChars) === 1 && s.charCodeAt(nextStart + _indentChars) === 49) {
              var afterMarker = i + 1
              if (afterMarker < nextLe && (s.charCodeAt(afterMarker) === $.CHAR_SPACE || s.charCodeAt(afterMarker) === $.CHAR_TAB)) {
                var contentAfterOrd = skipWS(s, afterMarker, nextLe)
                if (contentAfterOrd < nextLe) {
                  end = nextStart
                  break
                }
              }
            }
          }
        }
        // Tables can interrupt paragraphs if the line starts with |
        if (c === $.CHAR_PIPE) { // |
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
        if ((c === $.CHAR_DASH || c === $.CHAR_ASTERISK || c === $.CHAR_UNDERSCORE) && scanThematic(s, nextStart)) {
          // For dashes, only break if it's really a thematic break not setext
          if (c !== $.CHAR_DASH) {
            end = nextStart
            break
          }
          // Check if it could be setext (need at least 1 dash)
          let dashCount = 0
          let i = nextStart + _indentChars
          while (i < nextLe && s.charCodeAt(i) === $.CHAR_DASH) { dashCount++; i++ }
          while (i < nextLe && (s.charCodeAt(i) === $.CHAR_SPACE || s.charCodeAt(i) === $.CHAR_TAB)) i++
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
  while (contentEnd > p && (s.charCodeAt(contentEnd - 1) === $.CHAR_NEWLINE || s.charCodeAt(contentEnd - 1) === $.CHAR_CR || s.charCodeAt(contentEnd - 1) === $.CHAR_SPACE || s.charCodeAt(contentEnd - 1) === $.CHAR_TAB)) contentEnd--
  var textStart = p
  while (textStart < contentEnd && (s.charCodeAt(textStart) === $.CHAR_SPACE || s.charCodeAt(textStart) === $.CHAR_TAB)) textStart++
  if (textStart >= contentEnd) return null
  // Check for \u001E markers only within [textStart, contentEnd) — bounded scan
  // avoids O(n) indexOf over the entire remaining document per paragraph
  var hasMarker = false
  for (var mi = textStart; mi < contentEnd; mi++) {
    if (s.charCodeAt(mi) === $.CHAR_RECORD_SEP) { hasMarker = true; break }
  }
  var text = hasMarker
    ? s.slice(textStart, contentEnd).replace(/\u001E/g, '')
    : s.slice(textStart, contentEnd)
  if (!text) return null

  // Inline parser handles hard line breaks directly (two+ spaces or \ before newline)
  const children = parseInlineWithBreaks(text, 0, text.length, state, opts)

  if (setextLevel) {
    // Setext heading
    const slugify = opts?.slugify || util.slugify
    const id = slugify(text)
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
function parseInlineWithBreaks(s: string, p: number, e: number, state: MarkdownToJSX.State, opts: ParseOptions): MarkdownToJSX.ASTNode[] {
  // Fast path: if no newlines in range, skip break processing entirely
  // Use indexOf bounded to [p, e) — faster than a charCode loop for this check
  var firstNL = s.indexOf('\n', p)
  if (firstNL < 0 || firstNL >= e) {
    return parseInline(s, p, e, state, opts)
  }

  // Rope concat (faster in JSC than array-push + join for small/medium segments)
  var out = ''
  var segStart = p
  var i = p

  while (i < e) {
    var ch = s.charCodeAt(i)

    // Skip code spans
    if (ch === $.CHAR_BACKTICK) {
      var csEnd = skipCodeSpan(s, i, e)
      if (csEnd > i) {
        // Check if code span contains newlines that need replacing
        var hasCSNewline = false
        for (var ci = i; ci < csEnd; ci++) {
          if (s.charCodeAt(ci) === $.CHAR_NEWLINE) { hasCSNewline = true; break }
        }
        if (hasCSNewline) {
          out += s.slice(segStart, i)
          out += s.slice(i, csEnd).replace(/\n/g, ' ')
          segStart = csEnd
        }
        i = csEnd
        continue
      }
    }

    // Skip HTML tags
    if (ch === $.CHAR_LT) {
      var htmlEnd = skipInlineHTMLElement(s, i, e)
      if (htmlEnd > i) {
        i = htmlEnd
        continue
      }
    }

    // Check for newline
    if (ch === $.CHAR_NEWLINE) {
      var isHard = false
      var trimBack = 0

      if (i > p && s.charCodeAt(i - 1) === $.CHAR_BACKSLASH) {
        isHard = true
        trimBack = 1
      } else {
        var spCount = 0
        var j = i - 1
        while (j >= p && s.charCodeAt(j) === $.CHAR_SPACE) { spCount++; j-- }
        if (spCount >= 2) {
          isHard = true
          trimBack = spCount
        }
      }

      if (isHard) {
        out += s.slice(segStart, i - trimBack)
        out += '\u001F'
      } else {
        out += s.slice(segStart, i + 1)
      }
      // Skip leading whitespace on next line
      i++
      while (i < e && s.charCodeAt(i) === $.CHAR_SPACE) i++
      segStart = i
      continue
    }

    i++
  }

  // Flush remaining segment
  if (segStart < e) {
    out += s.slice(segStart, e)
  }

  return parseInline(out, 0, out.length, state, opts)
}

// ============================================================================
// INLINE SCANNERS
// ============================================================================

/** Scan inline code span */
function scanCodeSpan(s: string, p: number, e: number): ScanResult {
  if (s.charCodeAt(p) !== $.CHAR_BACKTICK) return null

  // Count opening backticks
  const openLen = countChar(s, p, e, 96)
  let i = p + openLen

  // Find matching closing backticks (bounded to [i, e))
  while (i < e) {
    const j = s.indexOf('`', i)
    if (j < 0 || j >= e) return null

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
  if (s.charCodeAt(i) !== $.CHAR_BACKTICK) return i
  const openLen = countChar(s, i, e, 96)
  let j = i + openLen
  while (j < e) {
    const k = s.indexOf('`', j)
    if (k < 0 || k >= e) return i // no close found within range
    const closeLen = countChar(s, k, e, 96)
    if (closeLen === openLen) return k + closeLen // return position after code span
    j = k + closeLen
  }
  return i // no valid close
}

/** Skip over an inline HTML element (including content and closing tag) starting at position i */
function skipInlineHTMLElement(s: string, i: number, e: number): number {
  if (s.charCodeAt(i) !== $.CHAR_LT) return i // <

  // Check for closing tag or comment
  if (i + 1 < e && s.charCodeAt(i + 1) === $.CHAR_SLASH) { // </
    // Closing tag - just skip to >
    let j = i + 2
    while (j < e && s.charCodeAt(j) !== $.CHAR_GT) j++
    return j < e ? j + 1 : i
  }

  if (i + 3 < e && s.charCodeAt(i + 1) === $.CHAR_EXCLAMATION && s.charCodeAt(i + 2) === $.CHAR_DASH && s.charCodeAt(i + 3) === $.CHAR_DASH) {
    // HTML comment <!-- -->
    const closeIdx = s.indexOf('-->', i + 4)
    return closeIdx >= 0 ? closeIdx + 3 : i
  }

  // Get tag name
  let j = i + 1
  const tagStart = j
  while (j < e) {
    const c = s.charCodeAt(j)
    if ((c >= $.CHAR_A && c <= $.CHAR_Z) || (c >= $.CHAR_a && c <= $.CHAR_z) || (c >= $.CHAR_DIGIT_0 && c <= $.CHAR_DIGIT_9) || c === $.CHAR_DASH) {
      j++
    } else {
      break
    }
  }
  if (j === tagStart) return i // not a valid tag
  const tag = s.slice(tagStart, j).toLowerCase()

  // Skip to end of opening tag (newlines allowed inside quoted attributes per CommonMark)
  let selfClosing = false
  while (j < e) {
    const c = s.charCodeAt(j)
    if (c === $.CHAR_GT) { // >
      j++
      break
    }
    if (c === $.CHAR_SLASH && j + 1 < e && s.charCodeAt(j + 1) === $.CHAR_GT) { // />
      j += 2
      selfClosing = true
      break
    }
    // Allow newlines inside quoted attribute values
    if (c === $.CHAR_DOUBLE_QUOTE || c === $.CHAR_SINGLE_QUOTE) { // " or '
      var q = c
      j++
      while (j < e && s.charCodeAt(j) !== q) j++
      if (j < e) j++ // skip closing quote
      continue
    }
    if (c === $.CHAR_NEWLINE) return i // newline outside quoted attribute
    j++
  }

  if (selfClosing) return j

  // Void elements don't have closing tags
  if (util.isVoidElement(tag)) return j

  // Find matching closing tag
  let depth = 1
  while (j < e && depth > 0) {
    if (s.charCodeAt(j) === $.CHAR_LT) { // <
      if (j + 1 < e && s.charCodeAt(j + 1) === $.CHAR_SLASH) { // </
        // Check if it's closing our tag
        const closeTagStart = j + 2
        let k = closeTagStart
        while (k < e && ((s.charCodeAt(k) >= $.CHAR_A && s.charCodeAt(k) <= $.CHAR_Z) || (s.charCodeAt(k) >= $.CHAR_a && s.charCodeAt(k) <= $.CHAR_z))) k++
        const closeTag = s.slice(closeTagStart, k).toLowerCase()
        if (closeTag === tag) {
          // Skip to end of closing tag
          while (k < e && s.charCodeAt(k) !== $.CHAR_GT) k++
          if (k < e) k++ // skip >
          depth--
          if (depth === 0) return k
        }
        j = k
      } else {
        // Opening tag - check if same tag
        const nextTagStart = j + 1
        let k = nextTagStart
        while (k < e && ((s.charCodeAt(k) >= $.CHAR_A && s.charCodeAt(k) <= $.CHAR_Z) || (s.charCodeAt(k) >= $.CHAR_a && s.charCodeAt(k) <= $.CHAR_z))) k++
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
  const isImage = s.charCodeAt(i) === $.CHAR_EXCLAMATION
  const start = isImage ? i + 1 : i

  if (s.charCodeAt(start) !== $.CHAR_BRACKET_OPEN) return i // [

  // Find closing ]
  let depth = 1
  let j = start + 1
  while (j < e && depth > 0) {
    const c = s.charCodeAt(j)
    if (c === $.CHAR_BACKSLASH && j + 1 < e) { j += 2; continue } // escape
    if (c === $.CHAR_BRACKET_OPEN) depth++
    else if (c === $.CHAR_BRACKET_CLOSE) depth--
    j++
  }
  if (depth !== 0) return i

  // j is now past the ]
  if (j >= e) return j // just [text]

  const nextChar = s.charCodeAt(j)

  // Inline link: [text](url)
  if (nextChar === $.CHAR_PAREN_OPEN) { // (
    let parenDepth = 1
    j++
    while (j < e && parenDepth > 0) {
      const c = s.charCodeAt(j)
      if (c === $.CHAR_BACKSLASH && j + 1 < e) { j += 2; continue }
      if (c === $.CHAR_PAREN_OPEN) parenDepth++
      else if (c === $.CHAR_PAREN_CLOSE) parenDepth--
      j++
    }
    return j
  }

  // Reference link: [text][ref]
  if (nextChar === $.CHAR_BRACKET_OPEN) { // [
    let depth2 = 1
    j++
    while (j < e && depth2 > 0) {
      const c = s.charCodeAt(j)
      if (c === $.CHAR_BRACKET_OPEN) depth2++
      else if (c === $.CHAR_BRACKET_CLOSE) depth2--
      j++
    }
    return j
  }

  return j // shortcut link [text]
}

/** Scan strikethrough ~~text~~ */
function scanStrikethrough(s: string, p: number, e: number, state: MarkdownToJSX.State, opts: ParseOptions): ScanResult {
  if (s.charCodeAt(p) !== $.CHAR_TILDE || p + 1 >= e || s.charCodeAt(p + 1) !== $.CHAR_TILDE) return null // ~~

  // Find closing ~~, skipping over code spans
  let i = p + 2
  while (i + 1 < e) {
    const c = s.charCodeAt(i)
    // Skip code spans - they take precedence
    if (c === $.CHAR_BACKTICK) {
      const afterCode = skipCodeSpan(s, i, e)
      if (afterCode > i) { i = afterCode; continue }
    }
    if (c === $.CHAR_TILDE && s.charCodeAt(i + 1) === $.CHAR_TILDE) {
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
    if (c === $.CHAR_BACKSLASH && i + 1 < e) i++ // escape
    i++
  }

  return null
}

/** Scan marked text ==text== */
function scanMarked(s: string, p: number, e: number, state: MarkdownToJSX.State, opts: ParseOptions): ScanResult {
  if (s.charCodeAt(p) !== $.CHAR_EQ || p + 1 >= e || s.charCodeAt(p + 1) !== $.CHAR_EQ) return null // ==

  // Find closing ==, skipping over code spans
  let i = p + 2
  while (i + 1 < e) {
    const c = s.charCodeAt(i)
    // Skip code spans - they take precedence
    if (c === $.CHAR_BACKTICK) {
      const afterCode = skipCodeSpan(s, i, e)
      if (afterCode > i) { i = afterCode; continue }
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
          } as MarkdownToJSX.TextFormattedNode,
          end: i + 2
        }
      }
    }
    if (c === $.CHAR_BACKSLASH && i + 1 < e) i++ // escape
    i++
  }

  return null
}

// Unicode punctuation regex for non-ASCII chars (matches \p{P} and \p{S} per CommonMark/GFM)
var UNICODE_PUNCT_R = /[\p{P}\p{S}]/u

/** Check if a character (code or string) is Unicode/ASCII punctuation */
function isUPunct(code: number, s: string, pos: number): boolean {
  if (code < $.CHAR_ASCII_BOUNDARY) return !!(cc(code) & C_PUNCT)
  return UNICODE_PUNCT_R.test(s[pos])
}

/** Check if a character code is Unicode whitespace */
function isUWS(code: number, s: string, pos: number): boolean {
  if (code < $.CHAR_ASCII_BOUNDARY) return !!(cc(code) & C_WS)
  // Unicode Zs category
  return /\p{Zs}/u.test(s[pos])
}

/** Delimiter entry for emphasis processing */
interface DelimEntry {
  idx: number     // index in nodes array
  ch: number      // char code (* or _ or ~ or =)
  len: number     // original delimiter run length
  canOpen: boolean
  canClose: boolean
  active: boolean
}

/** Collect delimiter run info without consuming - returns null if not a valid delimiter */
function collectDelimiter(s: string, p: number, e: number): { len: number; canOpen: boolean; canClose: boolean } | null {
  var ch = s.charCodeAt(p)
  if (ch !== $.CHAR_ASTERISK && ch !== $.CHAR_UNDERSCORE) return null

  var len = countChar(s, p, e, ch)
  if (len === 0) return null

  var beforeCode = p > 0 ? s.charCodeAt(p - 1) : 32
  var afterCode = p + len < e ? s.charCodeAt(p + len) : 32

  var beforeWS = isUWS(beforeCode, s, p - 1)
  var afterWS = isUWS(afterCode, s, p + len)
  var beforePunct = p > 0 ? isUPunct(beforeCode, s, p - 1) : false
  var afterPunct = p + len < e ? isUPunct(afterCode, s, p + len) : false

  // CommonMark flanking rules
  var leftFlanking = !afterWS && (!afterPunct || beforeWS || beforePunct)
  var rightFlanking = !beforeWS && (!beforePunct || afterWS || afterPunct)

  var canOpen: boolean, canClose: boolean
  if (ch === $.CHAR_ASTERISK) {
    canOpen = leftFlanking
    canClose = rightFlanking
  } else {
    // Underscore: stricter rules
    canOpen = leftFlanking && (!rightFlanking || beforePunct)
    canClose = rightFlanking && (!leftFlanking || afterPunct)
  }

  return { len: len, canOpen: canOpen, canClose: canClose }
}

/** Process emphasis delimiters using CommonMark algorithm */
function processEmphasis(
  nodes: MarkdownToJSX.ASTNode[],
  delims: DelimEntry[],
  state: MarkdownToJSX.State,
  opts: ParseOptions
): void {
  if (delims.length === 0) return

  // openers_bottom indexed by: type(0=*,1=_) * 6 + (closerLen%3) * 2 + (canOpen?1:0)
  var openersBottom: number[] = []
  for (var oi = 0; oi < 12; oi++) openersBottom[oi] = -1

  // Process from left to right looking for closers
  var ci = 0
  while (ci < delims.length) {
    var closer = delims[ci]
    if (!closer.active || !closer.canClose) { ci++; continue }

    var typeCode = closer.ch === $.CHAR_ASTERISK ? 0 : 1
    var obKey = typeCode * 6 + (closer.len % 3) * 2 + (closer.canOpen ? 1 : 0)
    var bottomIdx = openersBottom[obKey] !== undefined ? openersBottom[obKey] : -1

    // Search backwards for matching opener
    var openerIdx = -1
    for (var oi2 = ci - 1; oi2 > bottomIdx; oi2--) {
      var candidate = delims[oi2]
      if (!candidate.active || candidate.ch !== closer.ch || !candidate.canOpen) continue

      // "Sum of lengths" rule: if either can both open and close,
      // sum of lengths must not be multiple of 3 unless both are multiples of 3
      if ((closer.canOpen || candidate.canClose) &&
          (candidate.len + closer.len) % 3 === 0 &&
          candidate.len % 3 !== 0) continue

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
    var openerNode = nodes[opener.idx] as MarkdownToJSX.TextNode
    var closerNode = nodes[closer.idx] as MarkdownToJSX.TextNode
    openerNode.text = openerNode.text.slice(0, openerNode.text.length - useLen)
    closerNode.text = closerNode.text.slice(useLen)

    // Collect content nodes between opener and closer
    var contentStart = opener.idx + 1
    var contentEnd = closer.idx
    var contentNodes = nodes.slice(contentStart, contentEnd)

    // Create emphasis node - recursively process content for nested emphasis
    var emphNode: MarkdownToJSX.TextFormattedNode = {
      type: RuleType.textFormatted,
      tag: isStrong ? 'strong' : 'em',
      children: contentNodes,
    }

    // Replace content nodes with emphasis node
    nodes.splice(contentStart, contentEnd - contentStart, emphNode as MarkdownToJSX.FormattedTextNode)

    // Fix up indices in delimiter stack
    var removed = contentEnd - contentStart - 1
    for (var di = 0; di < delims.length; di++) {
      if (delims[di].idx > opener.idx) {
        delims[di].idx -= removed
      }
    }

    // Deactivate delimiters between opener and closer
    for (var di2 = openerIdx + 1; di2 < ci; di2++) {
      delims[di2].active = false
    }

    // If opener is empty, deactivate
    if (opener.len === 0) {
      opener.active = false
      // Remove empty text node
      if (openerNode.text === '') {
        nodes.splice(opener.idx, 1)
        for (var di3 = 0; di3 < delims.length; di3++) {
          if (delims[di3].idx > opener.idx) delims[di3].idx--
          else if (delims[di3].idx === opener.idx) delims[di3].idx = -1
        }
      }
    }

    // If closer is empty, deactivate
    if (closer.len === 0) {
      closer.active = false
      // Remove empty text node
      var closerNewIdx = closer.idx
      if (closerNode.text === '') {
        nodes.splice(closerNewIdx, 1)
        for (var di4 = 0; di4 < delims.length; di4++) {
          if (delims[di4].idx > closerNewIdx) delims[di4].idx--
          else if (delims[di4].idx === closerNewIdx) delims[di4].idx = -1
        }
      }
    } else {
      // Closer still has delimiters - don't advance, try matching again
      continue
    }
    ci++
  }

  // Merge adjacent text nodes and remove empty ones
  var wi = 0
  for (var ni = 0; ni < nodes.length; ni++) {
    var n = nodes[ni]
    if (n.type === RuleType.text) {
      var tn = n as MarkdownToJSX.TextNode
      if (tn.text === '') continue
      if (wi > 0 && nodes[wi - 1].type === RuleType.text) {
        ;(nodes[wi - 1] as MarkdownToJSX.TextNode).text += tn.text
        continue
      }
    }
    nodes[wi++] = n
  }
  nodes.length = wi
}

/** Scan link [text](url) or ![alt](url) or [text][ref] or [text] */
function scanLink(s: string, p: number, e: number, state: MarkdownToJSX.State, opts: ParseOptions): ScanResult {
  const isImage = s.charCodeAt(p) === $.CHAR_EXCLAMATION // !
  const start = isImage ? p + 1 : p

  if (s.charCodeAt(start) !== $.CHAR_BRACKET_OPEN) return null // [

  // Fast rejection: if no ] in range, no valid link possible
  var closeBracket = s.indexOf(']', start + 1)
  if (closeBracket < 0 || closeBracket >= e) return null

  // Find closing ] - skip code spans, HTML tags, and autolinks
  // Per CommonMark spec, we match brackets but don't nest them for link detection
  var i = start + 1
  var bracketEnd = -1
  var depth = 1
  while (i < e && depth > 0) {
    var c = s.charCodeAt(i)
    if (c === $.CHAR_BACKSLASH && i + 1 < e) { i += 2; continue }
    // Code spans take precedence over link brackets
    if (c === $.CHAR_BACKTICK) {
      var after = skipCodeSpan(s, i, e)
      if (after > i) { i = after; continue }
    }
    // HTML tags take precedence
    if (c === $.CHAR_LT) {
      // Check for autolink first
      var autoResult = scanAutolink(s, i, e)
      if (autoResult) { i = autoResult.end; continue }
      var afterHTML = skipInlineHTMLElement(s, i, e)
      if (afterHTML > i) { i = afterHTML; continue }
    }
    if (c === $.CHAR_BRACKET_OPEN) depth++
    else if (c === $.CHAR_BRACKET_CLOSE) depth--
    i++
  }
  if (depth !== 0) return null

  var textEnd = i - 1
  var text = s.slice(start + 1, textEnd)

  // Check what follows the ]
  var nextChar = i < e ? s.charCodeAt(i) : 0

  // Inline link: [text](url)
  var inlineLinkFailed = false
  if (nextChar === $.CHAR_PAREN_OPEN) { // (
    var inlineOk = true
    i++

    // Skip whitespace
    while (i < e && (s.charCodeAt(i) === $.CHAR_SPACE || s.charCodeAt(i) === $.CHAR_NEWLINE)) i++

    // Parse URL (can be in angle brackets or bare)
    var url = '', urlEnd = i
    if (i < e && s.charCodeAt(i) === $.CHAR_LT) { // <url>
      i++
      urlEnd = i
      while (urlEnd < e && s.charCodeAt(urlEnd) !== $.CHAR_GT) {
        if (s.charCodeAt(urlEnd) === $.CHAR_BACKSLASH && urlEnd + 1 < e) { urlEnd += 2; continue }
        if (s.charCodeAt(urlEnd) === $.CHAR_NEWLINE) { inlineOk = false; break } // no newlines in angle URLs
        urlEnd++
      }
      if (inlineOk && (urlEnd >= e || s.charCodeAt(urlEnd) !== $.CHAR_GT)) inlineOk = false
      if (inlineOk) {
        url = s.slice(i, urlEnd)
        urlEnd++ // skip >
      }
    } else if (inlineOk) {
      // Bare URL - count parens
      var parenDepth = 0
      while (urlEnd < e) {
        var c2 = s.charCodeAt(urlEnd)
        if (c2 === $.CHAR_BACKSLASH && urlEnd + 1 < e) { urlEnd += 2; continue }
        if (c2 === $.CHAR_PAREN_OPEN) parenDepth++
        else if (c2 === $.CHAR_PAREN_CLOSE) {
          if (parenDepth === 0) break
          parenDepth--
        }
        else if (c2 === $.CHAR_SPACE || c2 === $.CHAR_NEWLINE) break
        urlEnd++
      }
      url = s.slice(i, urlEnd)
    }

    if (inlineOk) {
      i = urlEnd
      // Skip whitespace
      while (i < e && (s.charCodeAt(i) === $.CHAR_SPACE || s.charCodeAt(i) === $.CHAR_NEWLINE)) i++

      // Optional title
      var title: string | undefined
      if (i < e) {
        var tc = s.charCodeAt(i)
        if (tc === $.CHAR_DOUBLE_QUOTE || tc === $.CHAR_SINGLE_QUOTE || tc === $.CHAR_PAREN_OPEN) { // " ' (
          var closeChar = tc === $.CHAR_PAREN_OPEN ? 41 : tc
          i++
          var titleStart = i
          while (i < e && s.charCodeAt(i) !== closeChar) {
            if (s.charCodeAt(i) === $.CHAR_BACKSLASH && i + 1 < e) i++
            i++
          }
          if (i >= e) inlineOk = false
          else {
            title = s.slice(titleStart, i)
            i++ // skip close quote
          }
        }
      }

      if (inlineOk) {
        // Skip whitespace and find closing )
        while (i < e && (s.charCodeAt(i) === $.CHAR_SPACE || s.charCodeAt(i) === $.CHAR_NEWLINE)) i++
        if (i >= e || s.charCodeAt(i) !== $.CHAR_PAREN_CLOSE) inlineOk = false
      }
    }

    if (inlineOk) {
      i++

      // Unescape backslashes in URL and title
      url = unescapeString(url)
      if (title !== undefined) title = unescapeString(title)

      // Sanitize URL - remove dangerous protocols
      var sanitizer = opts?.sanitizer || util.sanitizer
      var sanitizedUrl = sanitizer(url, isImage ? 'img' : 'a', isImage ? 'src' : 'href')
      var safeUrl = sanitizedUrl === null ? null : url

      if (isImage) {
        // Parse inline content and flatten to plain text for alt attribute
        var altNodes = parseInline(text, 0, text.length, state, opts)
        var altText = extractText(altNodes)
        return {
          node: {
            type: RuleType.image,
            target: safeUrl,
            alt: altText,
            title: title,
          } as MarkdownToJSX.ImageNode,
          end: i
        }
      } else {
        var savedAnchor = state.inAnchor; state.inAnchor = true
        var children = savedAnchor ? [{ type: RuleType.text, text: text } as MarkdownToJSX.TextNode]
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
            target: safeUrl,
            title: title,
            children: children,
          } as MarkdownToJSX.LinkNode,
          end: i
        }
      }
    } else {
      // Inline link failed - fall through to try shortcut reference
      i = textEnd + 1 // reset i to after ]
      inlineLinkFailed = true
    }
  }

  // Reference link: [text][ref] or [text][] or [text]
  var label = ''
  var refEnd = i

  if (!inlineLinkFailed && nextChar === $.CHAR_BRACKET_OPEN) { // [
    // Full reference [text][ref] or collapsed [text][]
    var refStart = i + 1
    refEnd = refStart
    var hasNestedBracket = false
    while (refEnd < e && s.charCodeAt(refEnd) !== $.CHAR_BRACKET_CLOSE) {
      if (s.charCodeAt(refEnd) === $.CHAR_BACKSLASH && refEnd + 1 < e) { refEnd += 2; continue }
      if (s.charCodeAt(refEnd) === $.CHAR_BRACKET_OPEN) { hasNestedBracket = true; break }
      refEnd++
    }
    if (hasNestedBracket || refEnd >= e) return null
    var ref = s.slice(refStart, refEnd)
    if (ref.trim()) {
      // Full reference: [text][ref]
      label = normalizeLabel(ref)
    } else {
      // Collapsed reference: [text][]
      // Per CommonMark, labels cannot contain unescaped brackets
      if (hasUnescapedBracket(text)) return null
      label = normalizeLabel(text)
    }
    refEnd = refEnd + 1
  } else {
    // Shortcut reference: [text]
    // Per CommonMark, labels cannot contain unescaped brackets
    if (hasUnescapedBracket(text)) return null
    label = normalizeLabel(text)
  }

  // Look up reference
  var refData = state.refs[label]
  if (!refData) return null

  if (isImage) {
    return {
      node: {
        type: RuleType.image,
        target: refData.target,
        alt: extractText(parseInline(text, 0, text.length, state, opts)),
        title: refData.title,
      } as MarkdownToJSX.ImageNode,
      end: refEnd
    }
  } else {
    var savedAnchor2 = state.inAnchor; state.inAnchor = true
    var children = savedAnchor2 ? [{ type: RuleType.text, text: text } as MarkdownToJSX.TextNode]
      : parseInline(text, 0, text.length, state, opts)
    state.inAnchor = savedAnchor2
    // Per CommonMark, links cannot contain other links
    if (!state.inAnchor && containsLink(children)) {
      return null
    }
    return {
      node: {
        type: RuleType.link,
        target: refData.target,
        title: refData.title,
        children: children,
      } as MarkdownToJSX.LinkNode,
      end: refEnd
    }
  }
}

/** Scan autolink <url> or <email> */
function scanAutolink(s: string, p: number, e: number): ScanResult {
  if (s.charCodeAt(p) !== $.CHAR_LT) return null

  var i = p + 1
  // Find closing > - autolinks cannot contain spaces or newlines
  while (i < e) {
    var cc = s.charCodeAt(i)
    if (cc === $.CHAR_GT) break
    // Per CommonMark: autolinks cannot contain spaces, newlines, or < chars
    if (cc === $.CHAR_SPACE || cc === $.CHAR_NEWLINE || cc === $.CHAR_CR || cc === $.CHAR_LT) return null
    i++
  }
  if (i >= e || s.charCodeAt(i) !== $.CHAR_GT) return null

  var content = s.slice(p + 1, i)

  // Check for URL autolink: scheme must be 2-32 chars [a-zA-Z][a-zA-Z0-9+.-]{1,31}
  // followed by : and the rest of the URI (no spaces already guaranteed above)
  var schemeMatch = content.match(/^([a-zA-Z][a-zA-Z0-9+.-]{1,31}):([^\x00-\x20]*)$/)
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

  // Check for email autolink per CommonMark spec
  if (content.indexOf('@') !== -1 && /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(content)) {
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
  if (s.charCodeAt(p) !== $.CHAR_BRACKET_OPEN || p + 1 >= e || s.charCodeAt(p + 1) !== $.CHAR_CARET) return null

  let i = p + 2
  // Find closing ]
  while (i < e && s.charCodeAt(i) !== $.CHAR_BRACKET_CLOSE && s.charCodeAt(i) !== $.CHAR_NEWLINE) i++
  if (i >= e || s.charCodeAt(i) !== $.CHAR_BRACKET_CLOSE) return null

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

/** Scan bare URL (https://..., http://..., or www.) */
function scanBareUrl(s: string, p: number, e: number, opts: ParseOptions): ScanResult {
  if (opts.disableBareUrls) return null

  // Check for http://, https://, ftp://, or www. via charCode to avoid slice allocations
  var prefix = ''
  var isWww = false
  var c0 = s.charCodeAt(p)
  if (c0 === $.CHAR_H || c0 === 72) { // h/H
    if (p + 8 <= e && s.charCodeAt(p+1) === $.CHAR_t && s.charCodeAt(p+2) === $.CHAR_t && s.charCodeAt(p+3) === $.CHAR_p) { // ttp
      if (s.charCodeAt(p+4) === $.CHAR_s && s.charCodeAt(p+5) === $.CHAR_COLON && s.charCodeAt(p+6) === $.CHAR_SLASH && s.charCodeAt(p+7) === $.CHAR_SLASH) prefix = 'https://'
      else if (s.charCodeAt(p+4) === $.CHAR_COLON && s.charCodeAt(p+5) === $.CHAR_SLASH && s.charCodeAt(p+6) === $.CHAR_SLASH) prefix = 'http://'
    }
  } else if (c0 === $.CHAR_f || c0 === 70) { // f/F
    if (p + 6 <= e && s.charCodeAt(p+1) === $.CHAR_t && s.charCodeAt(p+2) === $.CHAR_p && s.charCodeAt(p+3) === $.CHAR_COLON && s.charCodeAt(p+4) === $.CHAR_SLASH && s.charCodeAt(p+5) === $.CHAR_SLASH) prefix = 'ftp://'
  } else if (c0 === $.CHAR_W || c0 === 87) { // w/W
    if (p + 4 <= e && s.charCodeAt(p+1) === $.CHAR_W && s.charCodeAt(p+2) === $.CHAR_W && s.charCodeAt(p+3) === $.CHAR_PERIOD) { prefix = 'www.'; isWww = true }
  }
  if (!prefix) return null

  // Find end of URL (stop at whitespace or common punctuation at end)
  let i = p + prefix.length
  while (i < e) {
    const c = s.charCodeAt(i)
    // Stop at whitespace
    if (c === $.CHAR_SPACE || c === $.CHAR_NEWLINE || c === $.CHAR_TAB || c === $.CHAR_CR) break
    // Stop at certain characters that are unlikely to be part of URL
    if (c === $.CHAR_LT || c === $.CHAR_GT) break // < >
    i++
  }

  // Pre-count parens to avoid O(n²) slice+match in trimming loop
  var openParens = 0, closeParens = 0
  for (var pi = p; pi < i; pi++) {
    var pc = s.charCodeAt(pi)
    if (pc === $.CHAR_PAREN_OPEN) openParens++
    else if (pc === $.CHAR_PAREN_CLOSE) closeParens++
  }

  // Trim trailing punctuation that's not part of URL
  let end = i
  while (end > p + prefix.length) {
    const c = s.charCodeAt(end - 1)
    if (c === $.CHAR_PERIOD || c === $.CHAR_COMMA || c === $.CHAR_COLON || // . , :
        c === $.CHAR_EXCLAMATION || c === $.CHAR_QUESTION || c === $.CHAR_PAREN_CLOSE) { // ! ? )
      // But keep ) if there's a matching (
      if (c === $.CHAR_PAREN_CLOSE) {
        if (openParens >= closeParens) break
        closeParens--
      }
      end--
    } else if (c === $.CHAR_SEMICOLON) { // ; — check for entity reference &word;
      var ampPos = end - 2
      while (ampPos > p && ((s.charCodeAt(ampPos) >= $.CHAR_A && s.charCodeAt(ampPos) <= $.CHAR_Z) || (s.charCodeAt(ampPos) >= $.CHAR_a && s.charCodeAt(ampPos) <= $.CHAR_z) || (s.charCodeAt(ampPos) >= $.CHAR_DIGIT_0 && s.charCodeAt(ampPos) <= $.CHAR_DIGIT_9))) ampPos--
      if (ampPos >= p && s.charCodeAt(ampPos) === $.CHAR_AMPERSAND) { // &
        end = ampPos // exclude &entity;
      } else {
        end-- // regular trailing ;
      }
    } else {
      break
    }
  }

  if (end <= p + prefix.length) return null

  // Validate domain using charCode scan on original string (avoid slice/split)
  // Domain runs from p+prefixLen to the first / or end
  var dStart = p + (isWww ? 4 : prefix.length)
  var dEnd = s.indexOf('/', dStart)
  if (dEnd < 0 || dEnd > end) dEnd = end
  // For www. links, need at least one dot in domain
  if (isWww && s.indexOf('.', dStart) === -1) return null
  // Check last two segments for underscores (GFM rule)
  // Find last two dot positions by scanning backwards
  var lastDotU = -1, prevDotU = -1
  for (var di = dEnd - 1; di >= dStart; di--) {
    if (s.charCodeAt(di) === $.CHAR_PERIOD) {
      if (lastDotU < 0) lastDotU = di
      else { prevDotU = di; break }
    }
  }
  // segCheckStart = start of second-to-last segment (or domain start if <2 dots)
  var segCheckStart = prevDotU >= 0 ? prevDotU + 1 : dStart
  for (var di = segCheckStart; di < dEnd; di++) {
    if (s.charCodeAt(di) === $.CHAR_UNDERSCORE) return null // underscore in last two segments
  }

  var url = s.slice(p, end)
  // For www. links, prepend http:// for the target URL
  var target = isWww ? 'http://' + url : url

  return {
    node: {
      type: RuleType.link,
      target: target,
      children: [{ type: RuleType.text, text: url } as MarkdownToJSX.TextNode],
    } as MarkdownToJSX.LinkNode,
    end
  }
}

/** Scan bare email autolink (GFM extension) */
function scanBareEmail(s: string, p: number, e: number, opts: ParseOptions): ScanResult {
  if (opts.disableBareUrls) return null
  // Email local part: [a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+
  var i = p
  var localStart = i
  while (i < e) {
    var c = s.charCodeAt(i)
    if ((c >= $.CHAR_A && c <= $.CHAR_Z) || (c >= $.CHAR_a && c <= $.CHAR_z) || (c >= $.CHAR_DIGIT_0 && c <= $.CHAR_DIGIT_9) ||
        c === $.CHAR_PERIOD || c === $.CHAR_EXCLAMATION || c === $.CHAR_HASH || c === 36 || c === $.CHAR_PERCENT || c === $.CHAR_AMPERSAND ||
        c === $.CHAR_SINGLE_QUOTE || c === $.CHAR_ASTERISK || c === $.CHAR_PLUS || c === $.CHAR_SLASH || c === $.CHAR_EQ || c === $.CHAR_QUESTION ||
        c === $.CHAR_CARET || c === $.CHAR_UNDERSCORE || c === $.CHAR_BACKTICK || c === $.CHAR_BRACE_OPEN || c === $.CHAR_PIPE || c === $.CHAR_BRACE_CLOSE ||
        c === $.CHAR_TILDE || c === $.CHAR_DASH) {
      i++
    } else break
  }
  if (i === localStart) return null
  if (i >= e || s.charCodeAt(i) !== $.CHAR_AT) return null // @
  i++ // skip @
  // Domain: alphanumeric, hyphens, underscores, separated by dots
  // Per GFM: last two segments can't have underscore, last char can't be - or _
  var domainStart = i
  var lastDot = -1
  while (i < e) {
    var c = s.charCodeAt(i)
    if ((c >= $.CHAR_A && c <= $.CHAR_Z) || (c >= $.CHAR_a && c <= $.CHAR_z) || (c >= $.CHAR_DIGIT_0 && c <= $.CHAR_DIGIT_9)) {
      i++
    } else if ((c === $.CHAR_DASH || c === $.CHAR_UNDERSCORE) && i > domainStart) { // hyphen or underscore (not at start)
      i++
    } else if (c === $.CHAR_PERIOD) { // dot
      if (i === domainStart) break
      var prev = s.charCodeAt(i - 1)
      if (prev === $.CHAR_DASH || prev === $.CHAR_UNDERSCORE) break // hyphen/underscore before dot invalid
      // Only consume dot if followed by alphanumeric (valid domain continuation)
      if (i + 1 < e) {
        var nextDC = s.charCodeAt(i + 1)
        if ((nextDC >= $.CHAR_A && nextDC <= $.CHAR_Z) || (nextDC >= $.CHAR_a && nextDC <= $.CHAR_z) || (nextDC >= $.CHAR_DIGIT_0 && nextDC <= $.CHAR_DIGIT_9)) {
          lastDot = i
          i++
        } else break // trailing dot — don't consume
      } else break // dot at end — don't consume
    } else break
  }
  if (lastDot < 0) return null // need at least one dot
  // Last char of domain must be alphanumeric (not hyphen, underscore, or dot)
  var lastDomainChar = s.charCodeAt(i - 1)
  if (!((lastDomainChar >= $.CHAR_A && lastDomainChar <= $.CHAR_Z) || (lastDomainChar >= $.CHAR_a && lastDomainChar <= $.CHAR_z) || (lastDomainChar >= $.CHAR_DIGIT_0 && lastDomainChar <= $.CHAR_DIGIT_9))) return null
  if (i <= lastDot + 1) return null // need content after last dot
  // Check last two domain segments don't have underscores (charCode scan, no slice/split)
  // Walk from lastDot backwards to find second-to-last dot
  var prevDot = -1
  for (var di = lastDot - 1; di >= domainStart; di--) {
    if (s.charCodeAt(di) === $.CHAR_PERIOD) { prevDot = di; break }
  }
  var segCheckStart = prevDot >= 0 ? prevDot + 1 : domainStart
  for (var di = segCheckStart; di < i; di++) {
    if (s.charCodeAt(di) === $.CHAR_UNDERSCORE) return null // underscore in last two segments
  }
  var email = s.slice(p, i)
  return {
    node: {
      type: RuleType.link,
      target: 'mailto:' + email,
      children: [{ type: RuleType.text, text: email } as MarkdownToJSX.TextNode],
    } as MarkdownToJSX.LinkNode,
    end: i
  }
}

/** Check if nodes contain a link (for no-nested-links rule) */
function containsLink(nodes: MarkdownToJSX.ASTNode[]): boolean {
  for (var i = 0; i < nodes.length; i++) {
    if (nodes[i].type === RuleType.link) return true
    if ('children' in nodes[i] && Array.isArray((nodes[i] as ASTNodeWithChildren).children)) {
      if (containsLink((nodes[i] as ASTNodeWithChildren).children)) return true
    }
  }
  return false
}

function extractText(nodes: MarkdownToJSX.ASTNode[]): string {
  var result = ''
  for (var ni = 0; ni < nodes.length; ni++) {
    var n = nodes[ni]
    if (n.type === RuleType.text) result += (n as MarkdownToJSX.TextNode).text
    else if (n.type === RuleType.breakLine) result += ' '
    else if (n.type === RuleType.codeInline) result += (n as MarkdownToJSX.CodeInlineNode).text
    else if ('children' in n && Array.isArray((n as ASTNodeWithChildren).children)) result += extractText((n as ASTNodeWithChildren).children)
    else if (n.type === RuleType.image) result += (n as MarkdownToJSX.ImageNode).alt || ''
    else if (n.type === RuleType.link) result += extractText((n as MarkdownToJSX.LinkNode).children)
  }
  return result
}

/** Create a text node with entity decoding */
function textNode(text: string): MarkdownToJSX.TextNode {
  // Decode HTML entities if present
  const decoded = text.includes('&') ? util.decodeEntityReferences(text) : text
  return { type: RuleType.text, text: decoded } as MarkdownToJSX.TextNode
}

/** Scan inline HTML element - CommonMark types 1-7 */
function scanInlineHTML(s: string, p: number, e: number, state: MarkdownToJSX.State, opts: ParseOptions): ScanResult {
  if (s.charCodeAt(p) !== $.CHAR_LT) return null

  var i = p + 1
  if (i >= e) return null
  var ch = s.charCodeAt(i)

  // Type 2: HTML comment <!-- ... -->
  if (ch === $.CHAR_EXCLAMATION && i + 1 < e && s.charCodeAt(i + 1) === $.CHAR_DASH && i + 2 < e && s.charCodeAt(i + 2) === $.CHAR_DASH) {
    var commentStart = i + 3
    // Special case: <!--> (empty comment)
    if (commentStart < e && s.charCodeAt(commentStart) === $.CHAR_GT) {
      return {
        node: { type: RuleType.htmlComment, text: '', endsWithGreaterThan: true } as HTMLCommentNodeExt,
        end: commentStart + 1
      }
    }
    // Special case: <!---> (comment with single dash)
    if (commentStart + 1 < e && s.charCodeAt(commentStart) === $.CHAR_DASH && s.charCodeAt(commentStart + 1) === $.CHAR_GT) {
      return {
        node: { type: RuleType.htmlComment, text: '-', endsWithGreaterThan: true } as HTMLCommentNodeExt,
        end: commentStart + 2
      }
    }
    // Regular comment: scan for -->
    var endComment = s.indexOf('-->', commentStart)
    if (endComment !== -1 && endComment <= e - 3) {
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

  // Type 3: Processing instruction <?...?>
  if (ch === $.CHAR_QUESTION) {
    var endPI = s.indexOf('?>', i + 1)
    if (endPI !== -1 && endPI < e) {
      return {
        node: { type: RuleType.htmlSelfClosing, tag: '?', attrs: {}, _rawText: s.slice(p, endPI + 2) } as MarkdownToJSX.HTMLSelfClosingNode,
        end: endPI + 2
      }
    }
    return null
  }

  // Type 4/5: Declaration <!LETTER...> or CDATA <![CDATA[...]]>
  if (ch === $.CHAR_EXCLAMATION && i + 1 < e) {
    var nextCh = s.charCodeAt(i + 1)
    // CDATA: <![CDATA[...]]>
    if (nextCh === $.CHAR_BRACKET_OPEN && s.slice(i + 1, i + 8) === '[CDATA[') {
      var endCDATA = s.indexOf(']]>', i + 8)
      if (endCDATA !== -1 && endCDATA < e) {
        return {
          node: { type: RuleType.htmlSelfClosing, tag: '![CDATA[', attrs: {}, _rawText: s.slice(p, endCDATA + 3) } as MarkdownToJSX.HTMLSelfClosingNode,
          end: endCDATA + 3
        }
      }
      return null
    }
    // Declaration: <!LETTER ...>
    if (nextCh >= $.CHAR_A && nextCh <= $.CHAR_Z) {
      var endDecl = s.indexOf('>', i + 2)
      if (endDecl !== -1 && endDecl < e) {
        return {
          node: { type: RuleType.htmlSelfClosing, tag: '!' + s.slice(i + 1, endDecl), attrs: {}, _rawText: s.slice(p, endDecl + 1) } as MarkdownToJSX.HTMLSelfClosingNode,
          end: endDecl + 1
        }
      }
      return null
    }
  }

  // Type 6: Closing tag </tagname optional-whitespace>
  if (ch === $.CHAR_SLASH) {
    var j = i + 1
    if (j >= e) return null
    var c0 = s.charCodeAt(j)
    if (!((c0 >= $.CHAR_A && c0 <= $.CHAR_Z) || (c0 >= $.CHAR_a && c0 <= $.CHAR_z))) return null
    j++
    while (j < e) {
      var cc = s.charCodeAt(j)
      if ((cc >= $.CHAR_A && cc <= $.CHAR_Z) || (cc >= $.CHAR_a && cc <= $.CHAR_z) || (cc >= $.CHAR_DIGIT_0 && cc <= $.CHAR_DIGIT_9) || cc === $.CHAR_DASH) {
        j++
      } else break
    }
    // Skip optional whitespace
    while (j < e && (s.charCodeAt(j) === $.CHAR_SPACE || s.charCodeAt(j) === $.CHAR_TAB || s.charCodeAt(j) === $.CHAR_NEWLINE)) j++
    if (j < e && s.charCodeAt(j) === $.CHAR_GT) {
      var closeTagName = s.slice(i + 1, j).trim()
      return {
        node: { type: RuleType.htmlSelfClosing, tag: closeTagName, attrs: {}, _rawText: s.slice(p, j + 1), _isClosingTag: true } as MarkdownToJSX.HTMLSelfClosingNode,
        end: j + 1
      }
    }
    return null
  }

  // Type 1/7: Open tag - must start with letter
  if (!((ch >= $.CHAR_A && ch <= $.CHAR_Z) || (ch >= $.CHAR_a && ch <= $.CHAR_z))) return null

  // Try parsing as a structured HTML tag first (for tags with closing tags in scope)
  var tagResult = __parseHTMLTag(s, p)
  if (!tagResult) return null

  var tagName = tagResult.tag
  var tagNameLower = tagName.toLowerCase()
  var selfClosing = tagResult.selfClosing

  // Self-closing tag or void element - preserve raw text for HTML compiler
  if (selfClosing || util.isVoidElement(tagName)) {
    return {
      node: {
        type: RuleType.htmlSelfClosing,
        tag: tagName,
        attrs: processHTMLAttributes(tagResult.attrs, tagName, opts),
        _rawText: s.slice(p, tagResult.end),
      } as MarkdownToJSX.HTMLSelfClosingNode,
      end: tagResult.end
    }
  }

  // Verbatim tags (script, style, pre, textarea)
  var isVerbatim = TYPE1_TAGS.has(tagNameLower)

  // Find closing tag (within the inline scope)
  var closeEnd = findClosingTag(s.slice(0, e), tagResult.end, tagName)
  if (closeEnd === -1) {
    // No closing tag found - pass through as raw HTML open tag (CommonMark spec)
    return {
      node: { type: RuleType.htmlSelfClosing, tag: tagName, attrs: processHTMLAttributes(tagResult.attrs, tagName, opts), _rawText: s.slice(p, tagResult.end) } as MarkdownToJSX.HTMLSelfClosingNode,
      end: tagResult.end
    }
  }

  // Find where closing tag starts
  var closeTagStart = lastIndexOfCI(s, '</' + tagNameLower, closeEnd)
  var innerContent = s.slice(tagResult.end, closeTagStart)

  var children: MarkdownToJSX.ASTNode[] = []

  if (isVerbatim) {
    if (innerContent.trim()) {
      children = [{
        type: RuleType.text,
        text: innerContent,
      } as MarkdownToJSX.TextNode]
    }
  } else {
    var trimmed = innerContent.trim()
    if (trimmed) {
      var savedAnchorH = state.inAnchor, savedInlineH = state.inline
      if (tagNameLower === 'a') state.inAnchor = true
      var hasBlocks = trimmed.indexOf('\n\n') !== -1 || /^#{1,6}\s/.test(trimmed)
      if (hasBlocks) {
        state.inline = false
        children = parseBlocks(trimmed, state, opts)
      } else {
        children = parseInline(trimmed, 0, trimmed.length, state, opts)
      }
      state.inAnchor = savedAnchorH; state.inline = savedInlineH
    }
  }

  return {
    node: {
      type: RuleType.htmlBlock,
      tag: tagName,
      attrs: processHTMLAttributes(tagResult.attrs, tagName, opts),
      _rawAttrs: tagResult.rawAttrs,
      children,
      text: innerContent,
      _verbatim: false,
    } as MarkdownToJSX.HTMLNode,
    end: closeEnd
  }
}

/** Parse inline content */
// Maximum inline recursion depth
const MAX_INLINE_DEPTH = 200

// Reusable state object to avoid allocations - use counter for depth tracking
let _globalInlineDepth = 0

function parseInline(s: string, p: number, e: number, state: MarkdownToJSX.State, opts: ParseOptions): MarkdownToJSX.ASTNode[] {
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
    // Strip incomplete emphasis/strikethrough by counting delimiter pairs
    // in a single charCode scan. For each delimiter type, if the count is
    // odd (unmatched opener), find and strip from the last unmatched one.
    var starDbl = 0, starSgl = 0, undDbl = 0, undSgl = 0, tilDbl = 0
    var lastStarDbl = -1, lastStarSgl = -1, lastUndDbl = -1, lastUndSgl = -1, lastTilDbl = -1
    for (var ei = 0; ei < content.length; ei++) {
      var ec = content.charCodeAt(ei)
      if (ec === $.CHAR_ASTERISK) {
        if (ei + 1 < content.length && content.charCodeAt(ei + 1) === $.CHAR_ASTERISK) {
          starDbl++; lastStarDbl = ei; ei++
        } else {
          starSgl++; lastStarSgl = ei
        }
      } else if (ec === $.CHAR_UNDERSCORE) {
        if (ei + 1 < content.length && content.charCodeAt(ei + 1) === $.CHAR_UNDERSCORE) {
          undDbl++; lastUndDbl = ei; ei++
        } else {
          undSgl++; lastUndSgl = ei
        }
      } else if (ec === $.CHAR_TILDE) {
        if (ei + 1 < content.length && content.charCodeAt(ei + 1) === $.CHAR_TILDE) {
          tilDbl++; lastTilDbl = ei; ei++
        } else {
          // single ~ is not a delimiter, skip
        }
      }
    }
    // Remove the last unmatched delimiter (just the marker chars, keep content).
    // Collect removals sorted right-to-left to avoid index shifts.
    var removals: [number, number][] = []
    if (tilDbl % 2 === 1 && lastTilDbl >= 0) removals.push([lastTilDbl, 2])
    if (undDbl % 2 === 1 && lastUndDbl >= 0) removals.push([lastUndDbl, 2])
    if (undSgl % 2 === 1 && lastUndSgl >= 0) removals.push([lastUndSgl, 1])
    if (starDbl % 2 === 1 && lastStarDbl >= 0) removals.push([lastStarDbl, 2])
    if (starSgl % 2 === 1 && lastStarSgl >= 0) removals.push([lastStarSgl, 1])
    // Sort descending by position so earlier splices don't shift later ones
    removals.sort(function (a, b) { return b[0] - a[0] })
    for (var ri = 0; ri < removals.length; ri++) {
      var rPos = removals[ri][0], rLen = removals[ri][1]
      content = content.slice(0, rPos) + content.slice(rPos + rLen)
    }
    // Strip incomplete inline code - count backticks to detect unmatched
    // Only strip if there's an unmatched opening backtick
    let backtickCount = 0
    let lastBacktickPos = -1
    for (let bi = 0; bi < content.length; bi++) {
      if (content.charCodeAt(bi) === $.CHAR_BACKTICK) { // `
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
    // Strip incomplete link/image markers using charCode scan.
    // Handles nested constructs like [![alt](img)](link).
    // Find matching ] for a [ at position pos, respecting bracket nesting.
    function findMatchingClose(str: string, pos: number): number {
      var depth = 1
      for (var fi = pos + 1; fi < str.length; fi++) {
        var fc = str.charCodeAt(fi)
        if (fc === $.CHAR_BRACKET_OPEN) depth++
        else if (fc === $.CHAR_BRACKET_CLOSE) { depth--; if (depth === 0) return fi }
      }
      return -1
    }
    // Loop to handle nested constructs (e.g. [![alt](img-url being typed)
    // First pass strips outer [, second pass strips inner ![
    var linkDidStrip = true
    while (linkDidStrip) {
      linkDidStrip = false
      var linkStripPos = -1
      var linkTextStart = -1
      var linkTextEnd = -1
      var linkIsImage = false
      for (var li = 0; li < content.length; li++) {
        var lc = content.charCodeAt(li)
        if (lc === $.CHAR_BRACKET_OPEN && (li === 0 || content.charCodeAt(li - 1) !== $.CHAR_BACKSLASH)) {
          var imgPrefix = li > 0 && content.charCodeAt(li - 1) === $.CHAR_EXCLAMATION
          var lStart = imgPrefix ? li - 1 : li
          var lClose = findMatchingClose(content, li)
          if (lClose === -1) {
            // [text... — no matching ]
            linkStripPos = lStart; linkIsImage = imgPrefix
            linkTextStart = li + 1
            linkTextEnd = content.length
          } else {
            var lAfter = lClose + 1
            if (lAfter >= content.length) {
              // [text] at end — no destination yet
              linkStripPos = lStart; linkIsImage = imgPrefix
              linkTextStart = li + 1
              linkTextEnd = lClose
            } else if (content.charCodeAt(lAfter) === $.CHAR_PAREN_OPEN) {
              var lParen = content.indexOf(')', lAfter + 1)
              if (lParen === -1) {
                // [text](url — incomplete
                linkStripPos = lStart; linkIsImage = imgPrefix
                linkTextStart = li + 1
                linkTextEnd = lClose
                li = content.length
              } else {
                // [text](url) — complete, skip past
                li = lParen
              }
            } else if (content.charCodeAt(lAfter) === $.CHAR_BRACKET_OPEN) {
              var lRef = content.indexOf(']', lAfter + 1)
              if (lRef === -1) {
                // [text][ref — incomplete ref
                linkStripPos = lStart; linkIsImage = imgPrefix
                linkTextStart = li + 1
                linkTextEnd = lClose
                li = content.length
              } else {
                // [text][ref] — complete ref, skip past
                li = lRef
              }
            } else {
              // [text] followed by non-link char — not a link, skip
              li = lClose
            }
          }
        }
      }
      if (linkStripPos >= 0) {
        // For images, suppress entirely (alt text is metadata, not content).
        // For links, show the link text as plain text.
        var linkText = linkIsImage ? '' : content.slice(linkTextStart, linkTextEnd)
        content = content.slice(0, linkStripPos) + linkText
        linkDidStrip = true
      }
    }
    // Strip incomplete HTML/JSX tags - <Tag>content but no closing </Tag>
    // Match <TagName...>content at end without corresponding closing tag
    // But skip if the tag is inside a code span (backticks)
    const tagMatch = content.match(/<([A-Z][A-Za-z0-9]*)(?:\s[^>]*)?>([^<]*)$/)
    if (tagMatch && tagMatch.index !== undefined) {
      // Check if the match position is inside backtick code spans
      var inCodeSpan = false
      var btCount = 0
      for (var ci = 0; ci < tagMatch.index; ci++) {
        if (content.charCodeAt(ci) === $.CHAR_BACKTICK) btCount++
      }
      inCodeSpan = btCount % 2 === 1
      if (!inCodeSpan) {
        const tagName = tagMatch[1]
        // Only strip if there's no closing tag for this tag
        if (indexOfCI(content, '</' + tagName, 0) === -1) {
          // Strip the unclosed tag but keep the inner content
          content = content.replace(/<[A-Z][A-Za-z0-9]*(?:\s[^>]*)?>([^<]*)$/, '$1')
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
  let textStart = p
  // Pre-scan for @ position to avoid calling scanBareEmail on positions far before any @
  // Skip scan entirely when autolinks are disabled or when in anchor context
  var nextAtPos = (opts.disableAutoLink || opts.disableBareUrls || childState.inAnchor) ? -1 : s.indexOf('@', p)
  if (nextAtPos >= e) nextAtPos = -1

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
    } else if (c === $.CHAR_ASTERISK || c === $.CHAR_UNDERSCORE) { // * or _
      // Collect delimiter for two-phase emphasis processing
      var dinfo = collectDelimiter(s, p, e)
      if (dinfo) {
        if (dinfo.canOpen || dinfo.canClose) {
          // Flush text before delimiter
          if (p > textStart) {
            nodes.push(textNode(s.slice(textStart, p)))
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
    } else if (c === $.CHAR_TILDE) { // ~
      result = scanStrikethrough(s, p, e, childState, opts)
    } else if (c === $.CHAR_EQ) { // = - potential ==marked==
      result = scanMarked(s, p, e, childState, opts)
    } else if (c === $.CHAR_BRACKET_OPEN) { // [
      // Check for footnote reference [^id] first
      if (p + 1 < e && s.charCodeAt(p + 1) === $.CHAR_CARET) { // ^
        result = scanFootnoteRef(s, p, e, childState)
      }
      if (!result) {
        result = scanLink(s, p, e, childState, opts)
      }
    } else if (c === $.CHAR_EXCLAMATION && p + 1 < e && s.charCodeAt(p + 1) === $.CHAR_BRACKET_OPEN) { // ![
      result = scanLink(s, p, e, childState, opts)
    } else if (c === $.CHAR_LT) { // < - autolink or HTML
      // Try angle-bracket autolinks first (per CommonMark spec, autolinks take priority)
      result = scanAutolink(s, p, e)
      if (!result && !opts.disableParsingRawHTML && !opts.ignoreHTMLBlocks) {
        result = scanInlineHTML(s, p, e, childState, opts)
      }
    } else if ((c === $.CHAR_H || c === $.CHAR_W || c === $.CHAR_f) && !childState.inAnchor && !opts.disableAutoLink) {
      // h, w, f - potential http://, https://, www., or ftp://
      if (p === 0 || s.charCodeAt(p - 1) !== $.CHAR_LT) {
        result = scanBareUrl(s, p, e, opts)
      }
    }
    // Email autolink: try when we see alphanumeric that could be local part of email
    // nextAtPos tracks next @ position — only attempt email scan within 64 chars of @
    if (!result && nextAtPos >= 0 && nextAtPos - p <= 64 && !childState.inAnchor && !opts.disableAutoLink && !opts.disableBareUrls &&
        ((c >= $.CHAR_A && c <= $.CHAR_Z) || (c >= $.CHAR_a && c <= $.CHAR_z) || (c >= $.CHAR_DIGIT_0 && c <= $.CHAR_DIGIT_9))) {
      result = scanBareEmail(s, p, e, opts)
      // If we passed the @, advance to next one (bounded to [p+1, e))
      if (!result && p >= nextAtPos) {
        nextAtPos = s.indexOf('@', p + 1)
        if (nextAtPos >= e) nextAtPos = -1
      }
    }

    // Handle hard break marker from parseInlineWithBreaks
    if (c === $.CHAR_UNIT_SEP) { // \u001F break marker
      if (p > textStart) {
        nodes.push(textNode(s.slice(textStart, p)))
      }
      nodes.push({ type: RuleType.breakLine } as MarkdownToJSX.BreakLineNode)
      p++
      textStart = p
      continue
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
      if (c === $.CHAR_BACKSLASH && p + 1 < e) {
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
      // Skip ahead through plain text to next special character
      p++
      // Only skip when not near an @ (email detection needs alphanumeric chars)
      if (nextAtPos < 0 || nextAtPos - p > 64) {
        while (p < e) {
          var nc = s.charCodeAt(p)
          if (nc < $.CHAR_ASCII_BOUNDARY && !INLINE_SPECIAL[nc]) p++
          else break
        }
      }
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

  // Phase 2: Process emphasis delimiters using CommonMark algorithm
  if (delimStack.length > 0) {
    processEmphasis(nodes, delimStack, state, opts)
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

function parseBlocks(s: string, state: MarkdownToJSX.State, opts: ParseOptions): MarkdownToJSX.ASTNode[] {
  // Track depth in state for stack overflow protection (mutate in place, restore on exit)
  var savedDepth = state._depth || 0

  if (savedDepth > MAX_PARSE_DEPTH) {
    return [{ type: RuleType.text, text: s }]
  }

  state._depth = savedDepth + 1
  const childState = state

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
    // Uses charCode scan instead of nested-quantifier regex to avoid ReDoS
    var trimmedS = s.trim()
    var lastNL = trimmedS.lastIndexOf('\n')
    var lastLine = lastNL === -1 ? trimmedS : trimmedS.slice(lastNL + 1)
    if (lastLine.length > 0 && lastLine.charCodeAt(0) === $.CHAR_PIPE) {
      // Check if last line has pipes and ends with delimiter-like content (dashes)
      var hasPipe = false, hasDash = false
      for (var si = 1; si < lastLine.length; si++) {
        var sc = lastLine.charCodeAt(si)
        if (sc === $.CHAR_PIPE) hasPipe = true
        if (sc === $.CHAR_DASH) hasDash = true
      }
      if (hasPipe && hasDash) {
        s = lastNL === -1 ? '' : s.slice(0, s.lastIndexOf(lastLine)).trimEnd()
      }
    }

    // Strip incomplete HTML tags at end of input (unclosed block-level tags)
    // Pattern: <tag>content at end without corresponding </tag>
    // But skip if the tag is inside a code span (backticks) or fenced code block
    var htmlTagAtEnd = s.match(/<([a-zA-Z][a-zA-Z0-9]*)(?:\s[^>]*)?>([^<]*)$/)
    if (htmlTagAtEnd && htmlTagAtEnd.index !== undefined) {
      // Check if the match is inside backtick code spans
      var blockBtCount = 0
      for (var bci = 0; bci < htmlTagAtEnd.index; bci++) {
        if (s.charCodeAt(bci) === $.CHAR_BACKTICK) blockBtCount++
      }
      if (blockBtCount % 2 === 0) {
        var hTag = htmlTagAtEnd[1]
        if (indexOfCI(s, '</' + hTag, 0) === -1) {
          // Remove the unclosed tag but keep its content
          s = s.slice(0, htmlTagAtEnd.index) + htmlTagAtEnd[2]
        }
      }
    }

    // Strip incomplete list items at end of input
    // A lone list marker (*, -, +, or digit./digit)) with no content or only whitespace
    // should be suppressed since the content hasn't finished arriving
    var sLen = s.length
    if (sLen > 0) {
      // Find last line
      var lastNLPos = s.lastIndexOf('\n')
      var llStart = lastNLPos === -1 ? 0 : lastNLPos + 1
      var llEnd = sLen
      // Skip leading whitespace (up to 3 spaces for list indent)
      var llp = llStart
      var llSpaces = 0
      while (llp < llEnd && s.charCodeAt(llp) === $.CHAR_SPACE && llSpaces < 3) { llp++; llSpaces++ }
      if (llp < llEnd) {
        var llc = s.charCodeAt(llp)
        var isListMarker = false
        // Unordered: *, -, +
        if (llc === $.CHAR_ASTERISK || llc === $.CHAR_DASH || llc === $.CHAR_PLUS) {
          // Check if followed by space/tab/end or nothing (empty item)
          var afterM = llp + 1
          if (afterM >= llEnd || s.charCodeAt(afterM) === $.CHAR_SPACE || s.charCodeAt(afterM) === $.CHAR_TAB) {
            // Check if content after marker+space is empty/whitespace
            var contentP = afterM
            while (contentP < llEnd && (s.charCodeAt(contentP) === $.CHAR_SPACE || s.charCodeAt(contentP) === $.CHAR_TAB)) contentP++
            if (contentP >= llEnd) isListMarker = true
          }
        }
        // Ordered: digit(s) followed by . or )
        else if (llc >= $.CHAR_DIGIT_0 && llc <= $.CHAR_DIGIT_9) {
          var numP = llp
          while (numP < llEnd && s.charCodeAt(numP) >= $.CHAR_DIGIT_0 && s.charCodeAt(numP) <= $.CHAR_DIGIT_9) numP++
          if (numP < llEnd && (s.charCodeAt(numP) === $.CHAR_PERIOD || s.charCodeAt(numP) === $.CHAR_PAREN_CLOSE)) {
            var afterOM = numP + 1
            if (afterOM >= llEnd || s.charCodeAt(afterOM) === $.CHAR_SPACE || s.charCodeAt(afterOM) === $.CHAR_TAB) {
              var oContentP = afterOM
              while (oContentP < llEnd && (s.charCodeAt(oContentP) === $.CHAR_SPACE || s.charCodeAt(oContentP) === $.CHAR_TAB)) oContentP++
              if (oContentP >= llEnd) isListMarker = true
            }
          }
        }
        if (isListMarker) {
          s = s.slice(0, llStart).trimEnd()
        }
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

  // Check for frontmatter at the start of the document (requires valid YAML)
  if (p === 0 && s.startsWith('---')) {
    const bounds = util.parseFrontmatterBounds(s)
    if (bounds && bounds.hasValidYaml) {
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
      if (!isBlank(s, p, le)) break
      p = le < e ? le + 1 : le
      if (p < e) { _le = s.indexOf('\n', p); le = _le < 0 ? e : _le }
    }
    if (p >= e) break

    // Check for lazy continuation marker (\u001E) — treat as paragraph text
    if (s.charCodeAt(p) === $.CHAR_RECORD_SEP) {
      // Strip marker and fall through to paragraph
      // The paragraph scanner will handle \u001E-prefixed continuation lines
    }

    indent(s, p, le)

    let result: ScanResult = null

    // Check for indented code block (4+ spaces) - skip when inside HTML blocks
    if (s.charCodeAt(p) !== $.CHAR_RECORD_SEP && _indentSpaces >= 4 && !state.inHTML) {
      result = scanIndented(s, p)
    } else if (s.charCodeAt(p) !== $.CHAR_RECORD_SEP) {
      const i = p + _indentChars
      const c = s.charCodeAt(i)

      // Try block scanners based on first character
      if (c === $.CHAR_HASH) { // #
        result = scanHeading(s, p, state, opts)
      } else if (c === $.CHAR_GT) { // >
        result = scanBlockquote(s, p, state, opts)
      } else if (c === $.CHAR_BACKTICK || c === $.CHAR_TILDE) { // ` or ~
        result = scanFenced(s, p, state)
      } else if (c === $.CHAR_DASH || c === $.CHAR_ASTERISK || c === $.CHAR_UNDERSCORE) { // - * _
        result = scanThematic(s, p)
        if (!result) result = scanList(s, p, state, opts)
      } else if (c === $.CHAR_PLUS || (c >= $.CHAR_DIGIT_0 && c <= $.CHAR_DIGIT_9)) { // + or digit
        result = scanList(s, p, state, opts)
      } else if (c === $.CHAR_LT) { // <
        result = scanHTMLBlock(s, p, state, opts)
      } else if (c === $.CHAR_PIPE) { // |
        result = scanTable(s, p, state, opts)
      } else if (c === $.CHAR_BRACKET_OPEN) { // [ - could be reference definition
        result = scanRefDefinition(s, p, state)
      }
    }

    // Try table if current line contains | (bounded scan to avoid O(n) per block)
    if (!result) {
      var hasPipeInLine = false
      for (var pi = p; pi < le; pi++) {
        if (s.charCodeAt(pi) === $.CHAR_PIPE) { hasPipeInLine = true; break }
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
      p = result.end
    } else {
      // Skip line if nothing matched
      var _skip = s.indexOf('\n', p)
      p = _skip < 0 ? e : _skip + 1
    }
  }

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

  // First pass: collect all reference definitions so they're available during inline parsing
  collectReferenceDefinitions(source, state.refs!, finalOptions)

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
export { parseBlocks, parseInline }
export { scanHeading, scanThematic, scanBlockquote }
export function parseCodeFenced(s: string, p: number, state: MarkdownToJSX.State): { endPos: number; end: number; node: MarkdownToJSX.ASTNode; type: number; text: string; lang: string | undefined; attrs: Record<string, string> | undefined } | null {
  var res = scanFenced(s, p, state)
  if (!res) return null
  var node = res.node as MarkdownToJSX.CodeBlockNode
  return { ...res, endPos: res.end, end: res.end, node: res.node, type: RuleType.codeBlock, text: node.text, lang: node.lang, attrs: node.attrs as Record<string, string> | undefined }
}

export function parseHTMLTag(s: string, p: number, _state?: MarkdownToJSX.State, _options?: unknown): {
  tagName: string; tagLower: string; attrs: string; whitespaceBeforeAttrs: string;
  isSelfClosing: boolean; hasSpaceBeforeSlash: boolean; isClosing: boolean; hasNewline: boolean; endPos: number
} | null {
  var res = __parseHTMLTag(s, p)
  if (!res) return null
  return {
    tagName: res.tag,
    tagLower: res.tag.toLowerCase(),
    attrs: res.rawAttrs,
    whitespaceBeforeAttrs: res.whitespaceBeforeAttrs,
    isSelfClosing: res.selfClosing,
    hasSpaceBeforeSlash: res.hasSpaceBeforeSlash,
    isClosing: res.isClosing,
    hasNewline: res.whitespaceBeforeAttrs.includes('\n') || res.rawAttrs.includes('\n'),
    endPos: res.end
  }
}

export function calculateIndent(s: string, p: number, e: number, _state?: unknown): { indent: number; chars: number; spaceEquivalent: number; charCount: number } {
  indent(s, p, e)
  return { indent: _indentSpaces, chars: _indentChars, spaceEquivalent: _indentSpaces, charCount: _indentChars }
}
export function parseDefinition(s: string, p: number, state: MarkdownToJSX.State, _opts: unknown, _isFootnote: boolean): { type: number; endPos: number; end: number } | null {
  var end = parseRefDef(s, p, state.refs!)
  if (end === null) return null
  return { type: RuleType.ref, endPos: end, end: end }
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
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
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

  // Normalize input (CRLF → LF, null bytes → U+FFFD)
  input = util.normalizeInput(input)

  // First pass: collect all reference definitions
  if (!state.refs) state.refs = {}
  collectReferenceDefinitions(input, state.refs, opts)

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
