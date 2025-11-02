import { RuleType, type MarkdownToJSX } from './types'
import { NAMED_CODES_TO_UNICODE } from './utils'

// Attribute mapping from HTML to JSX props
const ATTRIBUTE_TO_JSX_PROP_MAP = [
  'allowFullScreen',
  'allowTransparency',
  'autoComplete',
  'autoFocus',
  'autoPlay',
  'cellPadding',
  'cellSpacing',
  'charSet',
  'classId',
  'colSpan',
  'contentEditable',
  'contextMenu',
  'crossOrigin',
  'encType',
  'formAction',
  'formEncType',
  'formMethod',
  'formNoValidate',
  'formTarget',
  'frameBorder',
  'hrefLang',
  'inputMode',
  'keyParams',
  'keyType',
  'marginHeight',
  'marginWidth',
  'maxLength',
  'mediaGroup',
  'minLength',
  'noValidate',
  'radioGroup',
  'readOnly',
  'rowSpan',
  'spellCheck',
  'srcDoc',
  'srcLang',
  'srcSet',
  'tabIndex',
  'useMap',
].reduce(
  (obj, x) => {
    obj[x.toLowerCase()] = x
    return obj
  },
  { class: 'className', for: 'htmlFor' }
)

function includes(str: string, search: string): boolean {
  return str.indexOf(search) !== -1
}

function startsWith(str: string, prefix: string, pos?: number): boolean {
  if (pos === undefined) pos = 0
  if (pos + prefix.length > str.length) return false
  for (let i = 0; i < prefix.length; i++) {
    if (str[pos + i] !== prefix[i]) return false
  }
  return true
}

function endsWith(str: string, suffix: string, pos?: number): boolean {
  if (pos === undefined) pos = str.length
  if (suffix.length > pos) return false
  const start = pos - suffix.length
  for (let i = 0; i < suffix.length; i++) {
    if (str[start + i] !== suffix[i]) return false
  }
  return true
}

function skipWhitespace(source: string, pos: number, maxPos?: number): number {
  const end = maxPos !== undefined ? maxPos : source.length
  while (pos < end && (source[pos] === ' ' || source[pos] === '\t')) {
    pos++
  }
  return pos
}

function findLineEnd(source: string, startPos: number): number {
  let lineEnd = startPos
  while (lineEnd < source.length && source[lineEnd] !== '\n') {
    lineEnd++
  }
  return lineEnd
}

export const HTML_CHAR_CODE_R = /&([a-z0-9]+|#[0-9]{1,6}|#x[0-9a-fA-F]{1,6});/gi

// Known void elements (HTML5 and SVG) that don't require closing tag or />
// Use Set for O(1) lookups instead of O(n) array.includes()
const VOID_ELEMENTS = new Set([
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

/**
 * Check if an element is a void element (doesn't require closing tag)
 * Handles HTML5 void elements, SVG void elements, and custom elements
 * Custom elements (hyphenated web components) are treated as potentially void
 */
function isVoidElement(tagName: string): boolean {
  let lowerTag = tagName.toLowerCase()

  // Handle namespace prefixes (e.g., svg:circle -> circle)
  if (includes(lowerTag, ':')) {
    const colonIndex = lowerTag.indexOf(':')
    lowerTag = lowerTag.slice(colonIndex + 1)
  }

  // Check known void elements (HTML5 and SVG)
  if (VOID_ELEMENTS.has(lowerTag)) {
    return true
  }

  // Check if it's a custom web component (must contain hyphen per HTML spec)
  // Web components like <my-component> can be void - allow them
  if (includes(lowerTag, '-')) {
    return true
  }

  return false
}

// Static regex patterns for performance
export const UNESCAPE_R = /\\(.)/g
const HEADING_TRAILING_HASHES_R = /\s+#+\s*$/
const ORDERED_LIST_ITEM_R = /^(\d+)\.\s+(.*)$/
const UNORDERED_LIST_ITEM_R = /^\s*([-*+])\s+(.*)$/
const TABLE_ALIGN_R = /^:?-+:?$/
export const HTML_BLOCK_ELEMENT_START_R = /^<([a-z][^ >/\n\r]*) ?([^>]*?)>/i
export const HTML_BLOCK_ELEMENT_START_R_ATTR =
  /^<([a-z][^ >/]*) ?(?:[^>/]+[^/]|)>/i
export const HTML_CUSTOM_ATTR_R = /^(data|aria|x)-[a-z_][a-z\d_.-]*$/

const code = (c: string) => c.charCodeAt(0)
const isWS = (c: string) => {
  const n = code(c)
  return n === 32 || n === 9 || n === 10 || n === 13 || n === 12
}
const isNameChar = (c: string) => {
  const n = code(c)
  return (
    (n >= 48 && n <= 57) ||
    (n >= 65 && n <= 90) ||
    (n >= 97 && n <= 122) ||
    n === 45 ||
    n === 95 ||
    n === 58
  )
}

function extractHTMLAttributes(attrs: string): string[] {
  const matches: string[] = []
  let i = 0
  const len = attrs.length

  while (i < len) {
    while (i < len && isWS(attrs[i])) i++
    if (i >= len) break

    const nameStart = i
    while (i < len && isNameChar(attrs[i])) i++
    if (i === nameStart) {
      i++
      continue
    }

    const name = attrs.slice(nameStart, i)
    while (i < len && isWS(attrs[i])) i++

    if (i >= len || attrs[i] !== '=') {
      matches.push(name)
      continue
    }

    i++
    while (i < len && isWS(attrs[i])) i++
    if (i >= len) {
      matches.push(name + '=')
      break
    }

    const valueStart = i
    const q = attrs[i]
    if (q === '"' || q === "'") {
      i++
      while (i < len) {
        if (attrs[i] === '\\' && i + 1 < len) i += 2
        else if (attrs[i] === q) {
          i++
          break
        } else i++
      }
    } else if (q === '{') {
      let depth = 1
      i++
      while (i < len && depth > 0) {
        if (attrs[i] === '\\' && i + 1 < len) i += 2
        else if (attrs[i] === '{') depth++
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
      while (i < len && !isWS(attrs[i])) i++
    }

    matches.push(name + '=' + attrs.slice(valueStart, i))
  }

  return matches
}

function parseHTMLTagName(
  source: string,
  pos: number
): { tagName: string; tagLower: string; nextPos: number } | null {
  var sourceLen = source.length
  if (pos >= sourceLen) return null

  // Check first char of tag name (must be letter)
  var firstChar = source[pos]
  var firstCharCode = firstChar.charCodeAt(0)
  if (
    !(
      (firstCharCode >= 97 && firstCharCode <= 122) ||
      (firstCharCode >= 65 && firstCharCode <= 90)
    )
  ) {
    return null
  }

  // Parse tag name (linear scan - no backtracking)
  var tagNameStart = pos
  var tagNameEnd = pos
  while (tagNameEnd < sourceLen) {
    var char = source[tagNameEnd]
    var charCode = char.charCodeAt(0)
    // Tag name can be: letter, digit, hyphen, colon
    if (
      (charCode >= 97 && charCode <= 122) || // a-z
      (charCode >= 65 && charCode <= 90) || // A-Z
      (charCode >= 48 && charCode <= 57) || // 0-9
      charCode === 45 || // -
      charCode === 58 // :
    ) {
      tagNameEnd++
    } else if (
      char === ' ' ||
      char === '\t' ||
      char === '\n' ||
      char === '\r' ||
      char === '>' ||
      char === '/'
    ) {
      break
    } else {
      // Invalid character in tag name
      return null
    }
  }

  if (tagNameEnd === tagNameStart) return null
  var tagName = source.slice(tagNameStart, tagNameEnd)
  var tagLower = tagName.toLowerCase()

  return { tagName, tagLower, nextPos: tagNameEnd }
}

function parseHTMLSelfClosingTag(
  source: string,
  pos: number
): {
  tagName: string
  attrs: string
  fullMatch: string
  endsWithSlash: boolean
} | null {
  if (source[pos] !== '<') return null

  var tagNameResult = parseHTMLTagName(source, pos + 1)
  if (!tagNameResult) return null

  var tagName = tagNameResult.tagName
  var i = tagNameResult.nextPos
  var len = source.length

  while (i < len && isWS(source[i])) i++

  const attrsStart = i
  let hasSlash = false
  let inQuotes = false
  let quoteChar = ''
  let braceDepth = 0

  while (i < len) {
    const ch = source[i]
    if (ch === '>') {
      if (braceDepth === 0 && !inQuotes) {
        if (i > attrsStart && source[i - 1] === '/') {
          hasSlash = true
        }
        const attrsEnd = hasSlash ? i - 1 : i
        const attrs = source.slice(attrsStart, attrsEnd).trim()
        const afterAngle = i + 1

        let checkIdx = afterAngle
        while (checkIdx < len && isWS(source[checkIdx])) checkIdx++
        const hasTrailingNewline = checkIdx < len && source[checkIdx] === '\n'
        const matchEnd = hasTrailingNewline ? checkIdx + 1 : afterAngle

        if (!hasSlash) {
          let checkPos = hasTrailingNewline ? checkIdx + 1 : checkIdx
          while (checkPos < len && isWS(source[checkPos])) checkPos++
          const closeTagPattern = '</' + tagName.toLowerCase() + '>'
          const foundIdx = source
            .toLowerCase()
            .indexOf(closeTagPattern, checkPos)
          if (foundIdx !== -1) {
            const between = source.slice(checkPos, foundIdx).trim()
            if (between) {
              return null
            }
          }
        }

        return {
          tagName,
          attrs,
          fullMatch: source.slice(pos, matchEnd),
          endsWithSlash: hasSlash,
        }
      }
    } else if ((ch === '"' || ch === "'") && !inQuotes) {
      inQuotes = true
      quoteChar = ch
    } else if (
      ch === quoteChar &&
      inQuotes &&
      (i === 0 || source[i - 1] !== '\\')
    ) {
      inQuotes = false
      quoteChar = ''
    } else if (ch === '{' && !inQuotes) {
      braceDepth++
    } else if (ch === '}' && !inQuotes && braceDepth > 0) {
      braceDepth--
    }
    i++
  }

  return null
}
const CAPTURE_LETTER_AFTER_HYPHEN = /-([a-z])?/gi
export const INTERPOLATION_R = /^\{.*\}$/
const DOUBLE_NEWLINE_R = /\n\n/
const BLOCK_SYNTAX_R =
  /^(\s{0,3}#[#\s]|\s{0,3}[-*+]\s|\s{0,3}\d+\.\s|\s{0,3}>\s|\s{0,3}```)/m
const UPPERCASE_TAG_R = /^<[A-Z]/
const WHITESPACE_CHAR_R = /\s/
const TRAILING_NEWLINE_R = /\n$/
const TAB_TO_SPACES_R = /\t/g
const ESCAPE_SEQUENCE_R = /\\([^0-9A-Za-z\s])/g
// Use Sets for O(1) character lookups (optimization for large documents)
const SPECIAL_INLINE_CHARS_SET = new Set([
  '*',
  '_',
  '~',
  '=',
  '`',
  '<',
  '>',
  '[',
])
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
const ATTRIBUTES_TO_SANITIZE = [
  'src',
  'href',
  'data',
  'formAction',
  'srcDoc',
  'action',
]

// Helper functions for HTML attribute parsing
function unescape(rawString: string): string {
  return rawString ? rawString.replace(UNESCAPE_R, '$1') : rawString
}

/** Remove symmetrical leading and trailing quotes */
function unquote(str: string): string {
  const first = str[0]
  if (
    (first === '"' || first === "'") &&
    str.length >= 2 &&
    str[str.length - 1] === first
  ) {
    return str.slice(1, -1)
  }
  return str
}

function normalizeAttributeKey(key: string): string {
  if (includes(key, '-') && key.match(HTML_CUSTOM_ATTR_R) === null) {
    const hyphenIndex = key.indexOf('-')
    key = key.replace(CAPTURE_LETTER_AFTER_HYPHEN, function (_, letter) {
      return letter ? letter.toUpperCase() : ''
    })
  }

  return key
}

type StyleTuple = [key: string, value: string]

function parseStyleAttribute(styleString: string): StyleTuple[] {
  const styles: StyleTuple[] = []
  if (!styleString) return styles

  let buffer = ''
  let depth = 0
  let quoteChar = ''

  for (let i = 0; i < styleString.length; i++) {
    const char = styleString[i]

    if (char === '"' || char === "'") {
      if (!quoteChar) {
        quoteChar = char
        depth++
      } else if (char === quoteChar) {
        quoteChar = ''
        depth--
      }
    } else if (char === '(' && endsWith(buffer, 'url')) {
      depth++
    } else if (char === ')' && depth > 0) {
      depth--
    } else if (char === ';' && depth === 0) {
      const colonIndex = buffer.indexOf(':')
      if (colonIndex > 0) {
        styles.push([
          buffer.slice(0, colonIndex).trim(),
          buffer.slice(colonIndex + 1).trim(),
        ])
      }
      buffer = ''
      continue
    }

    buffer += char
  }

  const colonIndex = buffer.indexOf(':')
  if (colonIndex > 0) {
    styles.push([
      buffer.slice(0, colonIndex).trim(),
      buffer.slice(colonIndex + 1).trim(),
    ])
  }

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
  ) => string | null
): any {
  if (key === 'style') {
    return parseStyleAttribute(value).reduce(function (styles, [k, v]) {
      const sanitized = sanitizeUrlFn(v, tag, k)
      if (sanitized != null) {
        styles[k.replace(/(-[a-z])/g, substr => substr[1].toUpperCase())] =
          sanitized
      }
      return styles
    }, {} as { [key: string]: any })
  }

  if (ATTRIBUTES_TO_SANITIZE.indexOf(key) !== -1) {
    return sanitizeUrlFn(unescape(value), tag, key)
  }

  if (value.match(INTERPOLATION_R)) {
    value = unescape(value.slice(1, value.length - 1))
  }

  return value === 'true' ? true : value === 'false' ? false : value
}

function parseHTMLAttributes(
  attrs: string,
  tagName: string,
  tagNameOriginal: string,
  options: ParseOptions
): { [key: string]: any } {
  const attributes: { [key: string]: any } = {}
  if (!attrs || !attrs.trim()) return attributes

  const attrMatches = extractHTMLAttributes(attrs)
  if (!attrMatches || attrMatches.length === 0) return attributes

  const tagNameLower = tagName.toLowerCase()

  for (let i = 0; i < attrMatches.length; i++) {
    const raw = attrMatches[i]
    const delimiterIdx = raw.indexOf('=')

    if (delimiterIdx !== -1) {
      const key = normalizeAttributeKey(raw.slice(0, delimiterIdx).trim())
      const mappedKey = ATTRIBUTE_TO_JSX_PROP_MAP[key.toLowerCase()] || key

      if (mappedKey === 'ref') continue

      const rawValue = raw.slice(delimiterIdx + 1).trim()
      const value = unquote(rawValue)
      const lower = key.toLowerCase()

      if (
        (lower === 'href' && tagNameLower === 'a') ||
        (lower === 'src' && tagNameLower === 'img')
      ) {
        const safe = options.sanitizer(
          unescape(value),
          tagNameLower as MarkdownToJSX.HTMLTags,
          lower
        )
        if (safe == null) {
          console.warn &&
            console.warn(`Stripped unsafe ${lower} on <${tagNameOriginal}>`)
          continue
        }
        attributes[mappedKey] = safe
      } else {
        const normalizedValue = attributeValueToJSXPropValue(
          tagNameLower as MarkdownToJSX.HTMLTags,
          key.toLowerCase(),
          value,
          options.sanitizer
        )
        const hasBlockMatch =
          typeof normalizedValue === 'string' &&
          normalizedValue.length > 0 &&
          normalizedValue[0] === '<' &&
          (HTML_BLOCK_ELEMENT_START_R_ATTR.test(normalizedValue) ||
            UPPERCASE_TAG_R.test(normalizedValue))
        if (
          typeof normalizedValue === 'string' &&
          options.compile &&
          (hasBlockMatch || parseHTMLSelfClosingTag(normalizedValue, 0))
        ) {
          attributes[mappedKey] = options.compile(normalizedValue.trim())
        } else {
          attributes[mappedKey] = normalizedValue
        }
      }
    } else if (raw !== 'style') {
      attributes[ATTRIBUTE_TO_JSX_PROP_MAP[raw] || raw] = true
    }
  }

  return attributes
}

/**
 * Result of a streaming parser
 */
export type ParseResult = (MarkdownToJSX.ASTNode & { endPos: number }) | null

/**
 * Options passed to parsers
 */
export type ParseOptions = Omit<MarkdownToJSX.Options, 'slugify'> & {
  slugify: (input: string) => string
  compile?: (input: string) => any
  parseMetrics?: {
    blockParsers: { [key: string]: { attempts: number; hits: number } }
    inlineParsers: { [key: string]: { attempts: number; hits: number } }
    totalOperations: number
    blockParseIterations: number
    inlineParseIterations: number
  } | null
}

function isSpecialInlineChar(c: string): boolean {
  return SPECIAL_INLINE_CHARS_SET.has(c)
}

function isBlockStartChar(c: string): boolean {
  return BLOCK_START_CHARS_SET.has(c)
}

/**
 * Core inline parser that dispatches to specialized inline parsers
 */
export function parseInlineSpan(
  source: string,
  start: number,
  end: number,
  state: MarkdownToJSX.State,
  options: ParseOptions
): MarkdownToJSX.ASTNode[] {
  const isDebug = !!process.env.DEBUG
  const parseMetrics = options.parseMetrics
  const result: MarkdownToJSX.ASTNode[] = []
  let pos = start
  let textStart = start // Track start of accumulated text

  // Helper to flush accumulated text inline (avoid parseText function call)
  const flushText = (endPos: number) => {
    if (endPos > textStart) {
      const text = source.slice(textStart, endPos)

      // OPTIMIZATION: Skip regex entirely if no '&' is present (common case)
      let processedText = text
      if (includes(text, '&')) {
        // Only process HTML entities if '&' is actually present
        processedText = text.replace(HTML_CHAR_CODE_R, (full, inner) => {
          const namedCodes =
            options.namedCodesToUnicode || NAMED_CODES_TO_UNICODE
          return namedCodes[inner] || full
        })
      }

      if (processedText) {
        // Don't merge text nodes - each flush creates a new node
        // This matches the old parser behavior and test expectations
        result.push({
          type: RuleType.text,
          text: processedText,
        } as MarkdownToJSX.TextNode)
      }
      textStart = endPos
    }
  }

  while (pos < end) {
    if (isDebug && parseMetrics) {
      parseMetrics.inlineParseIterations++
      parseMetrics.totalOperations++
    }

    const char = source[pos]

    // Character-based dispatch: use switch to jump directly to relevant parsers
    // This eliminates ~90% of sequential if checks
    switch (char) {
      case '\\': {
        // Escaped characters (highest priority)
        if (isDebug && parseMetrics) {
          parseMetrics.inlineParsers.escaped.attempts++
        }
        const escapedResult = parseTextEscaped(source, pos)
        if (escapedResult) {
          if (isDebug && parseMetrics) {
            parseMetrics.inlineParsers.escaped.hits++
          }
          flushText(pos)
          // Push escaped character as separate node (don't merge with next text)
          result.push(escapedResult)
          pos = escapedResult.endPos
          // After escaped char, next text should NOT merge with it
          // Set textStart to current pos so next accumulation starts fresh
          textStart = pos
        } else {
          // Not a valid escape, accumulate as text
          if (isDebug && parseMetrics) {
            parseMetrics.inlineParsers.text.attempts++
            parseMetrics.inlineParsers.text.hits++
          }
          pos++
        }
        break
      }

      case '[': {
        if (!state.inAnchor) {
          // Try footnote reference first
          if (pos + 1 < end && source[pos + 1] === '^') {
            if (isDebug && parseMetrics) {
              parseMetrics.inlineParsers.footnoteRef.attempts++
            }
            const footnoteResult = parseFootnoteReference(
              source,
              pos,
              state,
              options
            )
            if (footnoteResult) {
              if (isDebug && parseMetrics) {
                parseMetrics.inlineParsers.footnoteRef.hits++
              }
              flushText(pos)
              result.push(footnoteResult)
              pos = footnoteResult.endPos
              textStart = pos
              break
            }
          }
          // Try reference definition
          if (isDebug && parseMetrics) {
            parseMetrics.inlineParsers.ref.attempts++
          }
          const refResult = parseRef(source, pos, state.refs || {})
          if (refResult) {
            if (isDebug && parseMetrics) {
              parseMetrics.inlineParsers.ref.hits++
            }
            flushText(pos)
            pos = refResult.endPos
            textStart = pos
            break
          }
          // Try GFM task checkbox
          if (
            state.list &&
            pos + 2 < end &&
            (source[pos + 1] === ' ' || source[pos + 1] === 'x') &&
            source[pos + 2] === ']'
          ) {
            if (isDebug && parseMetrics) {
              parseMetrics.inlineParsers.gfmTask.attempts++
            }
            const taskResult = parseGFMTask(source, pos)
            if (taskResult) {
              if (isDebug && parseMetrics) {
                parseMetrics.inlineParsers.gfmTask.hits++
              }
              flushText(pos)
              result.push(taskResult)
              pos = taskResult.endPos
              textStart = pos
              break
            }
          }
          // Try reference link
          if (isDebug && parseMetrics) {
            parseMetrics.inlineParsers.refLink.attempts++
          }
          const refLinkResult = parseRefLink(source, pos, state, options)
          if (refLinkResult) {
            if (isDebug && parseMetrics) {
              parseMetrics.inlineParsers.refLink.hits++
            }
            flushText(pos)
            result.push(refLinkResult)
            pos = refLinkResult.endPos
            textStart = pos
            break
          }
          // Try regular link
          if (isDebug && parseMetrics) {
            parseMetrics.inlineParsers.link.attempts++
          }
          const linkResult = parseLink(source, pos, end, state, options)
          if (linkResult) {
            if (isDebug && parseMetrics) {
              parseMetrics.inlineParsers.link.hits++
            }
            flushText(pos)
            result.push(linkResult)
            pos = linkResult.endPos
            textStart = pos
            break
          }
        }
        // If no link matched, accumulate as text (including '[')
        if (isDebug && parseMetrics) {
          parseMetrics.inlineParsers.text.attempts++
          parseMetrics.inlineParsers.text.hits++
        }
        pos++
        break
      }

      case '<': {
        if (!options.disableParsingRawHTML) {
          // Try angle-bracket autolink first
          if (isDebug && parseMetrics) {
            parseMetrics.inlineParsers.angleBraceLink.attempts++
          }
          const angleBraceResult = parseLinkAngleBrace(
            source,
            pos,
            state,
            options
          )
          if (angleBraceResult) {
            if (isDebug && parseMetrics) {
              parseMetrics.inlineParsers.angleBraceLink.hits++
            }
            flushText(pos)
            result.push(angleBraceResult)
            pos = angleBraceResult.endPos
            textStart = pos
            break
          }
          // Try HTML comment
          if (startsWith(source, '<!--', pos)) {
            if (isDebug && parseMetrics) {
              parseMetrics.inlineParsers.htmlComment.attempts++
            }
            const htmlCommentResult = parseHTMLComment(source, pos)
            if (htmlCommentResult) {
              if (isDebug && parseMetrics) {
                parseMetrics.inlineParsers.htmlComment.hits++
              }
              flushText(pos)
              result.push(htmlCommentResult)
              pos = htmlCommentResult.endPos
              textStart = pos
              break
            }
          }
          // Try HTML elements
          if (isDebug && parseMetrics) {
            parseMetrics.inlineParsers.htmlElement.attempts++
          }
          const htmlResult = parseHTML(source, pos, state, options)
          if (htmlResult) {
            if (isDebug && parseMetrics) {
              parseMetrics.inlineParsers.htmlElement.hits++
              // Track self-closing separately if it's a self-closing tag
              if (htmlResult.type === RuleType.htmlSelfClosing) {
                parseMetrics.inlineParsers.htmlSelfClosing.attempts++
                parseMetrics.inlineParsers.htmlSelfClosing.hits++
              }
            }
            flushText(pos)
            result.push(htmlResult)
            pos = htmlResult.endPos
            textStart = pos
            break
          }
        }
        // If no HTML matched, accumulate as text
        if (isDebug && parseMetrics) {
          parseMetrics.inlineParsers.text.attempts++
          parseMetrics.inlineParsers.text.hits++
        }
        pos++
        break
      }

      case '*':
      case '_':
      case '~':
      case '=': {
        if (isDebug && parseMetrics) {
          parseMetrics.inlineParsers.formatting.attempts++
        }
        const match = matchInlineFormatting(source, pos, end, {
          inline: state.inline,
          simple: state.simple,
        })
        if (match && match[0]) {
          if (isDebug && parseMetrics) {
            parseMetrics.inlineParsers.formatting.hits++
          }
          flushText(pos)
          const content = match[2]
          const children = parseInlineSpan(
            content,
            0,
            content.length,
            state,
            options
          )
          result.push({
            type: RuleType.textFormatted,
            tag: match[1],
            children,
          } as MarkdownToJSX.FormattedTextNode)
          pos += match[0].length
          textStart = pos
        } else {
          // Not valid formatting, accumulate as text
          if (isDebug && parseMetrics) {
            parseMetrics.inlineParsers.text.attempts++
            parseMetrics.inlineParsers.text.hits++
          }
          pos++
        }
        break
      }

      case ' ':
        // Try line break (2 spaces + newline)
        if (
          pos + 2 < end &&
          source[pos + 1] === ' ' &&
          source[pos + 2] === '\n'
        ) {
          if (isDebug && parseMetrics) {
            parseMetrics.inlineParsers.breakLine.attempts++
          }
          const breakResult = parseBreakLine(source, pos)
          if (breakResult) {
            if (isDebug && parseMetrics) {
              parseMetrics.inlineParsers.breakLine.hits++
            }
            flushText(pos)
            result.push(breakResult)
            pos = breakResult.endPos
            textStart = pos
            break
          }
        }
        // Not a line break, accumulate as text
        if (isDebug && parseMetrics) {
          parseMetrics.inlineParsers.text.attempts++
          parseMetrics.inlineParsers.text.hits++
        }
        pos++
        break

      case '`': {
        if (isDebug && parseMetrics) {
          parseMetrics.inlineParsers.codeInline.attempts++
        }
        const codeResult = parseCodeInline(source, pos)
        if (codeResult) {
          if (isDebug && parseMetrics) {
            parseMetrics.inlineParsers.codeInline.hits++
          }
          flushText(pos)
          result.push(codeResult)
          pos = codeResult.endPos
          textStart = pos
        } else {
          // Not valid code, accumulate as text
          if (isDebug && parseMetrics) {
            parseMetrics.inlineParsers.text.attempts++
            parseMetrics.inlineParsers.text.hits++
          }
          pos++
        }
        break
      }

      case '!': {
        if (pos + 1 < end && source[pos + 1] === '[') {
          if (isDebug && parseMetrics) {
            parseMetrics.inlineParsers.refImage.attempts++
          }
          const refImageResult = parseRefImage(source, pos, state, options)
          if (refImageResult) {
            if (isDebug && parseMetrics) {
              parseMetrics.inlineParsers.refImage.hits++
            }
            flushText(pos)
            result.push(refImageResult)
            pos = refImageResult.endPos
            textStart = pos
            break
          }
          if (isDebug && parseMetrics) {
            parseMetrics.inlineParsers.image.attempts++
          }
          const imageResult = parseImage(source, pos, state, options)
          if (imageResult) {
            if (isDebug && parseMetrics) {
              parseMetrics.inlineParsers.image.hits++
            }
            flushText(pos)
            result.push(imageResult)
            pos = imageResult.endPos
            textStart = pos
            break
          }
        }
        // Not an image, accumulate as text
        if (isDebug && parseMetrics) {
          parseMetrics.inlineParsers.text.attempts++
          parseMetrics.inlineParsers.text.hits++
        }
        pos++
        break
      }

      case '\n': {
        // Always create separate text node for newlines - matches CommonMark AST structure
        // React/HTML will collapse newlines to whitespace regardless, so this preserves AST fidelity
        // Only '  \n' (two spaces + newline) creates a hard line break via parseBreakLine
        flushText(pos)
        result.push({
          type: RuleType.text,
          text: '\n',
        } as MarkdownToJSX.TextNode)
        textStart = pos + 1
        pos++
        break
      }

      case 'h': {
        // Check for bare URLs starting with 'http'
        if (
          !state.inAnchor &&
          !options.disableAutoLink &&
          startsWith(source, 'http', pos)
        ) {
          if (isDebug && parseMetrics) {
            parseMetrics.inlineParsers.bareUrl.attempts++
          }
          const bareUrlResult = parseLinkBareUrl(source, pos, state, options)
          if (bareUrlResult) {
            if (isDebug && parseMetrics) {
              parseMetrics.inlineParsers.bareUrl.hits++
            }
            flushText(pos)
            result.push(bareUrlResult)
            pos = bareUrlResult.endPos
            textStart = pos
            break
          }
        }
        // Not a URL, accumulate as text
        if (isDebug && parseMetrics) {
          parseMetrics.inlineParsers.text.attempts++
          parseMetrics.inlineParsers.text.hits++
        }
        pos++
        break
      }

      default: {
        // Default case: accumulate as text (most common case)
        if (isDebug && parseMetrics) {
          parseMetrics.inlineParsers.text.attempts++
          parseMetrics.inlineParsers.text.hits++
        }
        pos++
        break
      }
    }
  }

  // Flush any remaining text
  flushText(pos)

  return result
}

export function parseTextEscaped(source: string, pos: number): ParseResult {
  if (source[pos] !== '\\' || pos + 1 >= source.length) return null

  const nextChar = source[pos + 1]
  if (!includes('*_~`[]()#\\+-.!{}|<>\n', nextChar)) return null

  return {
    type: RuleType.text,
    text: nextChar,
    endPos: pos + 2,
  } as MarkdownToJSX.TextNode & { endPos: number }
}

export function parseCodeInline(source: string, pos: number): ParseResult {
  if (source[pos] !== '`') return null

  // Count opening backticks
  let backtickCount = 0
  let i = pos
  while (i < source.length && source[i] === '`') {
    backtickCount++
    i++
  }

  if (backtickCount < 1) return null

  // Find matching closing backticks
  const contentStart = i
  let contentEnd = -1

  while (i < source.length) {
    // Check if this is an escaped backtick (backslash followed by backtick)
    // Escaped backticks don't close the code span
    if (i > 0 && source[i - 1] === '\\' && source[i] === '`') {
      i++
      continue
    }

    if (source[i] === '`') {
      // Check if we have the same number of consecutive backticks
      let closingCount = 0
      let j = i
      while (
        j < source.length &&
        source[j] === '`' &&
        closingCount < backtickCount
      ) {
        closingCount++
        j++
      }

      if (closingCount === backtickCount) {
        contentEnd = i
        i = j // Move past the closing backticks
        break
      }
    }
    i++
  }

  if (contentEnd === -1) return null // No matching closing backticks

  // Extract content and unescape all escaped characters (like the old parser)
  const rawContent = source.slice(contentStart, contentEnd)
  const content = rawContent.replace(UNESCAPE_R, '$1')

  return {
    type: RuleType.codeInline,
    text: content,
    endPos: i,
  } as MarkdownToJSX.CodeInlineNode & { endPos: number }
}

export function parseBreakLine(source: string, pos: number): ParseResult {
  // Check for 2+ spaces followed by newline
  if (
    pos + 2 < source.length &&
    source[pos] === ' ' &&
    source[pos + 1] === ' ' &&
    source[pos + 2] === '\n'
  ) {
    return {
      type: RuleType.breakLine,
      endPos: pos + 3,
    } as MarkdownToJSX.BreakLineNode & { endPos: number }
  }

  return null
}

/**
 * Parse URL and optional title from parentheses: (url "title")
 * Returns { target, title, endPos } or null if parsing fails
 */
function parseUrlAndTitle(
  source: string,
  urlStart: number,
  allowNestedParens: boolean
): { target: string; title: string | undefined; endPos: number } | null {
  let i = urlStart

  // Skip leading whitespace
  while (i < source.length && (source[i] === ' ' || source[i] === '\t')) i++

  // Skip optional '<'
  const hasAngleBrackets = source[i] === '<'
  if (hasAngleBrackets) i++

  const actualUrlStart = i

  // Find URL end
  let parenDepth = 0
  while (i < source.length) {
    const c = source[i]
    if (
      c === ' ' ||
      c === '\t' ||
      c === '\n' ||
      (hasAngleBrackets && c === '>') ||
      c === '"' ||
      c === "'"
    ) {
      break
    }
    // For images (no nested parens), stop at ')' immediately
    if (!allowNestedParens && c === ')') {
      break
    }
    if (allowNestedParens && c === '(') {
      parenDepth++
      i++
      continue
    }
    if (allowNestedParens && c === ')') {
      if (parenDepth === 0) break
      parenDepth--
      i++
      continue
    }
    if (c === '\\') i++ // skip escaped chars
    i++
  }

  const urlEnd = i
  const target = source.slice(actualUrlStart, urlEnd)

  // Skip whitespace after URL
  while (i < source.length && (source[i] === ' ' || source[i] === '\t')) i++

  // Check for title
  let title: string | undefined = undefined
  if (i < source.length && (source[i] === '"' || source[i] === "'")) {
    const quoteChar = source[i]
    i++ // skip opening quote
    const titleStart = i
    while (i < source.length && source[i] !== quoteChar) {
      if (source[i] === '\\') i++ // skip escaped chars
      i++
    }
    if (i < source.length) {
      title = source.slice(titleStart, i)
      i++ // skip closing quote
    }
  }

  // Skip trailing whitespace
  while (i < source.length && (source[i] === ' ' || source[i] === '\t')) i++

  // Must end with ')'
  if (i >= source.length || source[i] !== ')') return null

  return {
    target,
    title,
    endPos: i + 1,
  }
}

export function parseLink(
  source: string,
  pos: number,
  end: number,
  state: MarkdownToJSX.State,
  options: ParseOptions
): ParseResult {
  // Must start with '['
  if (source[pos] !== '[') return null

  let bracketDepth = 0
  let i = pos

  // Find the matching closing ']'
  let linkTextEnd = -1
  while (i < source.length) {
    if (source[i] === '[') {
      bracketDepth++
    } else if (source[i] === ']') {
      bracketDepth--
      if (bracketDepth === 0) {
        linkTextEnd = i
        break
      }
    }
    i++
  }

  if (
    linkTextEnd === -1 ||
    linkTextEnd + 1 >= source.length ||
    source[linkTextEnd + 1] !== '('
  ) {
    return null
  }

  // Parse the link text (content between [ and ]); disable nested link/ref parsing
  const originalInAnchor = state.inAnchor
  state.inAnchor = true
  const children = parseInlineSpan(source, pos + 1, linkTextEnd, state, options)
  state.inAnchor = originalInAnchor

  // Parse the URL and optional title inside ( )
  const urlResult = parseUrlAndTitle(source, linkTextEnd + 2, true)
  if (!urlResult) return null

  // Unescape then sanitize the target and title
  let target = urlResult.target.replace(UNESCAPE_R, '$1')
  let title = urlResult.title
    ? urlResult.title.replace(UNESCAPE_R, '$1')
    : undefined
  const safeHrefLink = options.sanitizer(target, 'a', 'href')
  if (safeHrefLink == null) {
    target = null
  } else {
    target = safeHrefLink
  }

  return {
    type: RuleType.link,
    children,
    target,
    title,
    endPos: urlResult.endPos,
  } as MarkdownToJSX.LinkNode & { endPos: number }
}

export function parseImage(
  source: string,
  pos: number,
  state: MarkdownToJSX.State,
  options: ParseOptions
): ParseResult {
  // Must start with '!['
  if (
    source[pos] !== '!' ||
    pos + 1 >= source.length ||
    source[pos + 1] !== '['
  ) {
    return null
  }

  let i = pos + 2 // after '!['

  // Find the closing ']'
  let altEnd = -1
  while (i < source.length) {
    if (source[i] === ']') {
      altEnd = i
      break
    }
    i++
  }

  if (
    altEnd === -1 ||
    altEnd + 1 >= source.length ||
    source[altEnd + 1] !== '('
  ) {
    return null
  }

  // Extract alt text
  const alt = source.slice(pos + 2, altEnd)

  // Parse the URL and optional title inside ( )
  const urlResult = parseUrlAndTitle(source, altEnd + 2, false)
  if (!urlResult) return null

  // Unescape the alt, target, and title
  const unescapedAlt = alt.replace(UNESCAPE_R, '$1')
  const unescapedTarget = urlResult.target.replace(UNESCAPE_R, '$1')
  const unescapedTitle = urlResult.title
    ? urlResult.title.replace(UNESCAPE_R, '$1')
    : undefined

  return {
    type: RuleType.image,
    alt: unescapedAlt || undefined,
    target: unescapedTarget,
    title: unescapedTitle,
    endPos: urlResult.endPos,
  } as MarkdownToJSX.ImageNode & { endPos: number }
}

export function parseLinkAngleBrace(
  source: string,
  pos: number,
  state: MarkdownToJSX.State,
  options: ParseOptions
): ParseResult {
  // Must start with '<' and be in inline mode and not in anchor
  if (source[pos] !== '<' || !state.inline || state.inAnchor) {
    return null
  }

  // Find the closing '>'
  let endPos = pos + 1
  while (endPos < source.length && source[endPos] !== '>') {
    endPos++
  }

  if (endPos >= source.length || source[endPos] !== '>') {
    return null
  }

  // Extract the content inside <>
  const raw = source.slice(pos + 1, endPos)
  const content = raw.trim()

  const isHttp =
    startsWith(content, 'http://') || startsWith(content, 'https://')
  const isMailto = startsWith(content, 'mailto:')
  const isEmailLike =
    !includes(content, ' ') &&
    includes(content, '@') &&
    !includes(content, '<') &&
    !includes(content, '>')

  if (!isHttp && !isMailto && !isEmailLike) {
    return null // likely an HTML tag, not an autolink
  }

  // Determine if it's an email or URL
  let target = content
  let isEmail = false

  if (isMailto || (isEmailLike && !includes(content, '//'))) {
    isEmail = true
    if (startsWith(target, 'mailto:')) {
      target = target.slice(7)
    }
  }

  // Sanitize autolink target
  const unsanitizedTarget = isEmail ? 'mailto:' + target : target
  const safeHrefAuto = options.sanitizer(unsanitizedTarget, 'a', 'href')
  const finalTarget = safeHrefAuto == null ? null : safeHrefAuto
  if (safeHrefAuto == null)
    console.warn && console.warn('Stripped unsafe href in autolink')
  return {
    children: [
      {
        text: target,
        type: RuleType.text,
      },
    ],
    target: finalTarget,
    type: RuleType.link,
    endPos: endPos + 1,
  } as MarkdownToJSX.LinkNode & { endPos: number }
}

export function parseLinkBareUrl(
  source: string,
  pos: number,
  state: MarkdownToJSX.State,
  options: ParseOptions
): ParseResult {
  // Must start with 'http' and not be in anchor and not disabled
  if (state.inAnchor || options.disableAutoLink) return null
  if (!startsWith(source, 'http', pos)) return null

  // Find the end of the URL (stops at whitespace or certain punctuation)
  let urlEnd = pos + 4 // after 'http'
  if (source[urlEnd] === 's') urlEnd++ // after 'https'

  // Skip ://
  if (source.slice(urlEnd, urlEnd + 3) === '://') {
    urlEnd += 3
  } else {
    return null // not a valid URL
  }

  // Continue until we hit a forbidden character
  while (urlEnd < source.length) {
    const c = source[urlEnd]
    // Stop at whitespace or certain punctuation
    if (
      c === ' ' ||
      c === '\t' ||
      c === '\n' ||
      c === '<' ||
      c === ',' ||
      c === ';' ||
      c === '"' ||
      c === ')' ||
      c === ']'
    ) {
      break
    }
    urlEnd++
  }

  if (urlEnd === pos + (source[pos + 4] === 's' ? 8 : 7)) return null // no actual URL content

  let url = source.slice(pos, urlEnd)
  const safeHrefBare = options.sanitizer(url, 'a', 'href')
  if (safeHrefBare == null) {
    console.warn && console.warn('Stripped unsafe href in bare URL')
    url = null
  } else {
    url = safeHrefBare
  }

  return {
    children: [
      {
        text: url,
        type: RuleType.text,
      },
    ],
    target: url,
    title: undefined,
    type: RuleType.link,
    endPos: urlEnd,
  } as MarkdownToJSX.LinkNode & { endPos: number }
}

export function parseRefLink(
  source: string,
  pos: number,
  state: MarkdownToJSX.State,
  options: ParseOptions
): ParseResult {
  // Must start with '[' and not contain '](' (that's a regular link)
  if (source[pos] !== '[') return null

  // Check if '](' exists without slicing
  let checkPos = pos
  while (checkPos < source.length) {
    if (
      source[checkPos] === ']' &&
      checkPos + 1 < source.length &&
      source[checkPos + 1] === '('
    ) {
      return null
    }
    if (source[checkPos] === '\n') break // Stop at newline
    checkPos++
  }

  let i = pos + 1 // after '['

  // Find the first ']'
  let textEnd = -1
  while (i < source.length && source[i] !== ']') {
    i++
  }
  if (i >= source.length) return null
  textEnd = i
  i++ // skip the ']'

  while (i < source.length && (source[i] === ' ' || source[i] === '\t')) i++

  // Must have another '['
  if (i >= source.length || source[i] !== '[') return null
  i++ // skip the '['

  // Find the closing ']'
  let refEnd = -1
  while (i < source.length && source[i] !== ']') {
    i++
  }
  if (i >= source.length) return null
  refEnd = i

  // Extract ref
  const refStart = textEnd + (source[textEnd + 1] === ' ' ? 2 : 1)
  const ref = source.slice(refStart + 1, refEnd) // +1 to skip the '['

  // Parse the text as inline content
  const children = parseInlineSpan(source, pos + 1, textEnd, state, options)

  return {
    type: RuleType.refLink,
    children,
    fallbackChildren: source.slice(pos, i + 1),
    ref: ref || undefined,
    endPos: i + 1,
  } as MarkdownToJSX.ReferenceLinkNode & { endPos: number }
}

export function parseRefImage(
  source: string,
  pos: number,
  state: MarkdownToJSX.State,
  options: ParseOptions
): ParseResult {
  // Must start with '!['
  if (
    source[pos] !== '!' ||
    pos + 1 >= source.length ||
    source[pos + 1] !== '['
  ) {
    return null
  }

  let i = pos + 2 // after '!['

  // Find the closing ']'
  let altEnd = -1
  while (i < source.length && source[i] !== ']') {
    i++
  }
  if (i >= source.length) return null
  altEnd = i
  i++ // skip the ']'

  while (i < source.length && (source[i] === ' ' || source[i] === '\t')) i++

  // Must have another '['
  if (i >= source.length || source[i] !== '[') return null
  i++ // skip the '['

  // Find the closing ']'
  let refEnd = -1
  while (i < source.length && source[i] !== ']') {
    i++
  }
  if (i >= source.length) return null
  refEnd = i

  // Extract alt and ref
  const alt = source.slice(pos + 2, altEnd)
  const refStart = altEnd + (source[altEnd + 1] === ' ' ? 2 : 1)
  const ref = source.slice(refStart + 1, refEnd) // +1 to skip the '['

  return {
    type: RuleType.refImage,
    alt: alt ? alt.replace(UNESCAPE_R, '$1') : undefined,
    ref: ref || undefined,
    endPos: i + 1,
  } as MarkdownToJSX.ReferenceImageNode & { endPos: number }
}

export function parseFootnoteReference(
  source: string,
  pos: number,
  state: MarkdownToJSX.State,
  options: ParseOptions
): ParseResult {
  // Must start with '[^'
  if (
    pos + 1 >= source.length ||
    source[pos] !== '[' ||
    source[pos + 1] !== '^'
  )
    return null

  // Find the closing ']'
  let endPos = pos + 2
  while (endPos < source.length && source[endPos] !== ']') {
    endPos++
  }

  if (endPos >= source.length || source[endPos] !== ']') return null

  // Extract the identifier
  const identifier = source.slice(pos + 2, endPos)

  // Create a slug from the identifier using the slugify function (same as old parser)
  const slugifiedId = options.slugify(identifier)

  return {
    type: RuleType.footnoteReference,
    target: `#${slugifiedId}`,
    text: identifier,
    endPos: endPos + 1,
  } as MarkdownToJSX.FootnoteReferenceNode & { endPos: number }
}

export function parseGFMTask(source: string, pos: number): ParseResult {
  // Must start with '[' followed by 'x', 'X', or space, then ']'
  if (source[pos] !== '[') return null

  let endPos = pos + 1
  if (endPos >= source.length) return null

  const marker = source[endPos]
  if (marker !== ' ' && marker !== 'x' && marker !== 'X') return null

  endPos++
  if (endPos >= source.length || source[endPos] !== ']') return null

  return {
    type: RuleType.gfmTask,
    completed: marker.toLowerCase() === 'x',
    endPos: endPos + 1,
  } as MarkdownToJSX.GFMTaskNode & { endPos: number }
}

/**
 * Parse blocks inside HTML content (similar to parseMarkdown but for HTML context)
 */
function parseBlocksInHTML(
  input: string,
  state: MarkdownToJSX.State,
  options: ParseOptions
): MarkdownToJSX.ASTNode[] {
  const result: MarkdownToJSX.ASTNode[] = []
  let pos = 0

  type ParserFn = (
    source: string,
    pos: number,
    state: MarkdownToJSX.State,
    options: ParseOptions
  ) => ParseResult | null

  const codeBlockWrapper: ParserFn = (source, pos) =>
    parseCodeBlock(source, pos)
  const breakThematicWrapper: ParserFn = (source, pos) =>
    parseBreakThematic(source, pos)
  const htmlCommentWrapper: ParserFn = (source, pos) =>
    parseHTMLComment(source, pos)

  const dispatchTable: { [key: string]: ParserFn[] } = {
    ' ': [codeBlockWrapper],
    '\t': [codeBlockWrapper],
    '>': [parseBlockQuote],
    '#': [parseHeading],
    '`': [parseCodeFenced],
    '|': [parseTable],
    '-': [breakThematicWrapper, parseUnorderedList, parseOrderedList],
    '*': [breakThematicWrapper, parseUnorderedList],
    _: [breakThematicWrapper],
    '+': [parseUnorderedList],
    '<': [htmlCommentWrapper, parseHTML],
  }

  const numericParsers: ParserFn[] = [parseOrderedList]

  while (pos < input.length) {
    while (pos < input.length && input[pos] === '\n') {
      pos++
    }

    if (pos >= input.length) break

    const char = input[pos]
    let matched = false

    const parsers = dispatchTable[char]
    if (parsers) {
      for (let i = 0; i < parsers.length; i++) {
        const parseResult = parsers[i](input, pos, state, options)
        if (parseResult) {
          result.push(parseResult)
          pos = parseResult.endPos
          matched = true
          break
        }
      }
    }

    if (!matched && char >= '0' && char <= '9') {
      for (let i = 0; i < numericParsers.length; i++) {
        const parseResult = numericParsers[i](input, pos, state, options)
        if (parseResult) {
          result.push(parseResult)
          pos = parseResult.endPos
          matched = true
          break
        }
      }
    }

    if (!matched) {
      const parseResult = parseHeadingSetext(input, pos, state, options)
      if (parseResult) {
        result.push(parseResult)
        pos = parseResult.endPos
        matched = true
      }
    }

    if (!matched) {
      const remaining = input.slice(pos).trim()
      if (remaining) {
        const parseResult = parseParagraph(input, pos, state, options)
        if (parseResult) {
          result.push(parseResult)
          pos = parseResult.endPos
          matched = true
        }
      }
    }

    if (!matched) {
      pos++
    }
  }

  return result
}

export function parseHeading(
  source: string,
  pos: number,
  state: MarkdownToJSX.State,
  options: ParseOptions
): ParseResult {
  // Must be at block level and start with '#'
  if (state.inline || source[pos] !== '#') return null

  // Count consecutive '#' characters (1-6)
  let level = 0
  let i = pos
  while (i < source.length && source[i] === '#' && level < 6) {
    level++
    i++
  }

  // Must be followed by whitespace
  if (i >= source.length || (source[i] !== ' ' && source[i] !== '\t')) {
    return null
  }

  i = skipWhitespace(source, i)

  const contentEnd = findLineEnd(source, i)

  // Extract content and remove trailing '#'
  let content = source.slice(i, contentEnd)
  content = content.replace(HEADING_TRAILING_HASHES_R, '').trim()

  // Parse content as inline
  const originalInline = state.inline
  state.inline = true
  const children = parseInlineSpan(content, 0, content.length, state, options)
  state.inline = originalInline

  return {
    type: RuleType.heading,
    level,
    children,
    id: options.slugify(content),
    endPos:
      contentEnd +
      (contentEnd < source.length && source[contentEnd] === '\n' ? 1 : 0),
  } as MarkdownToJSX.HeadingNode & { endPos: number }
}

export function parseHeadingSetext(
  source: string,
  pos: number,
  state: MarkdownToJSX.State,
  options: ParseOptions
): ParseResult {
  // Must be at block level and not start with a block character
  if (state.inline || isBlockStartChar(source[pos])) return null

  const lineEnd = findLineEnd(source, pos)

  if (lineEnd >= source.length || source[lineEnd] !== '\n') return null

  // Check the next line for setext markers
  const nextLineStart = lineEnd + 1
  if (nextLineStart >= source.length) return null

  const underlineChar = source[nextLineStart]
  if (underlineChar !== '=' && underlineChar !== '-') return null

  // Count underline characters
  let underlineCount = 0
  let i = nextLineStart
  while (i < source.length && source[i] === underlineChar) {
    underlineCount++
    i++
  }

  // Must have at least 1 underline character
  if (underlineCount < 1) return null

  i = skipWhitespace(source, i)

  // Must be end of line (newline or end of content)
  if (i < source.length && source[i] !== '\n') return null

  // Extract heading content
  const content = source.slice(pos, lineEnd).trim()
  if (!content) return null

  // Determine level (1 for =, 2 for -)
  const level = underlineChar === '=' ? 1 : 2

  // Parse content as inline
  const originalInline = state.inline
  state.inline = true
  const children = parseInlineSpan(content, 0, content.length, state, options)
  state.inline = originalInline

  return {
    type: RuleType.heading,
    level,
    children,
    id: options.slugify(content),
    endPos: i + (i < source.length && source[i] === '\n' ? 1 : 0),
  } as MarkdownToJSX.HeadingNode & { endPos: number }
}

export function parseParagraph(
  source: string,
  pos: number,
  state: MarkdownToJSX.State,
  options: ParseOptions
): ParseResult {
  // Must be at block level
  // Note: We don't check isBlockStartChar here because this is called as a fallback
  // after other block parsers have already tried and failed
  if (state.inline) return null

  // Find end of paragraph (next block or end of content)
  let endPos = pos
  const sourceLen = source.length

  while (endPos < sourceLen) {
    // Find line end and check if empty in one pass (early exit optimization)
    let lineEnd = endPos
    let isEmptyLine = true
    while (lineEnd < sourceLen && source[lineEnd] !== '\n') {
      const c = source[lineEnd]
      if (c !== ' ' && c !== '\t' && c !== '\r') {
        isEmptyLine = false
        // Continue to find line end even if not empty
        lineEnd++
        while (lineEnd < sourceLen && source[lineEnd] !== '\n') {
          lineEnd++
        }
        break
      }
      lineEnd++
    }

    // If this line is empty, stop the paragraph
    if (isEmptyLine) {
      endPos = lineEnd
      break
    }

    // Check if we're at the end of source
    if (lineEnd >= sourceLen) {
      endPos = sourceLen
      break
    }

    const nextLineStart = lineEnd + 1
    if (nextLineStart >= sourceLen) {
      // No next line, paragraph ends at end of source
      endPos = sourceLen
      break
    }

    // Find next line end and check if empty in one pass
    let nextLineEnd = nextLineStart
    let nextLineIsEmpty = true
    let nextLineFirstChar = ''
    while (nextLineEnd < sourceLen && source[nextLineEnd] !== '\n') {
      const c = source[nextLineEnd]
      if (c !== ' ' && c !== '\t' && c !== '\r') {
        nextLineIsEmpty = false
        if (nextLineFirstChar === '') {
          nextLineFirstChar = c
        }
      }
      nextLineEnd++
    }

    if (nextLineIsEmpty) {
      // Double newline - end paragraph
      endPos = lineEnd
      break
    }

    // Check if next line starts with a block element
    let shouldBreak = false
    if (nextLineFirstChar && isBlockStartChar(nextLineFirstChar)) {
      // Special case: backtick is only a block start for fenced code (3+ backticks)
      if (nextLineFirstChar === '`') {
        let backtickCount = 1
        let checkPos = nextLineStart + 1
        while (
          checkPos < sourceLen &&
          checkPos < nextLineStart + 3 &&
          source[checkPos] === '`'
        ) {
          backtickCount++
          checkPos++
        }
        shouldBreak = backtickCount >= 3
      } else if (nextLineFirstChar === '-') {
        // Dash is only a block start for lists (- followed by space) or thematic breaks (3+ dashes alone)
        const secondChar =
          nextLineStart + 1 < sourceLen ? source[nextLineStart + 1] : ''
        if (secondChar === ' ') {
          shouldBreak = true
        } else {
          // Check if it's a thematic break (3+ dashes with only spaces/tabs)
          let dashCount = 1
          let checkPos = nextLineStart + 1
          while (checkPos < nextLineEnd && source[checkPos] === '-') {
            dashCount++
            checkPos++
          }
          // Check if rest of line is only whitespace
          let restIsWhitespace = true
          while (checkPos < nextLineEnd) {
            const c = source[checkPos]
            if (c !== ' ' && c !== '\t') {
              restIsWhitespace = false
              break
            }
            checkPos++
          }
          shouldBreak = dashCount >= 3 && restIsWhitespace
        }
      } else {
        // Other block start characters break paragraphs
        shouldBreak = true
      }
    }

    if (shouldBreak) {
      endPos = lineEnd
      break
    }

    // Continue paragraph across single newline
    endPos = lineEnd + 1
  }

  if (endPos <= pos) return null

  // Extract paragraph content and parse as inline
  // Don't trim - preserve newlines within paragraphs (they'll be converted to spaces or preserved)
  // Only trim leading/trailing whitespace from the very edges
  let contentStart = pos
  let contentEnd = endPos

  // Trim leading whitespace (spaces/tabs only)
  while (
    contentStart < contentEnd &&
    (source[contentStart] === ' ' || source[contentStart] === '\t')
  ) {
    contentStart++
  }

  // Trim trailing whitespace (spaces/tabs only) and check for content in one pass
  let hasContent = false
  while (contentEnd > contentStart) {
    const c = source[contentEnd - 1]
    if (c === ' ' || c === '\t') {
      contentEnd--
    } else if (c !== '\n' && c !== '\r') {
      hasContent = true
      break
    } else {
      break
    }
  }

  // Final content check
  if (!hasContent) {
    // Check remaining characters
    for (let i = contentStart; i < contentEnd; i++) {
      const c = source[i]
      if (c !== ' ' && c !== '\t' && c !== '\n' && c !== '\r') {
        hasContent = true
        break
      }
    }
  }

  if (contentStart >= contentEnd || !hasContent) return null

  const content = source.slice(contentStart, contentEnd)

  // Parse as inline (newlines are preserved by default)
  const originalInline = state.inline
  state.inline = true
  const children = parseInlineSpan(content, 0, content.length, state, options)
  state.inline = originalInline

  return {
    type: RuleType.paragraph,
    children,
    endPos,
  } as MarkdownToJSX.ParagraphNode & { endPos: number }
}

export function parseBreakThematic(source: string, pos: number): ParseResult {
  // Must start with -, *, or _
  const startChar = source[pos]
  if (startChar !== '-' && startChar !== '*' && startChar !== '_') return null

  // Find the end of the line
  const lineEnd = findLineEnd(source, pos)
  const line = source.slice(pos, lineEnd)

  // Count the thematic break characters (ignoring spaces)
  let count = 0
  for (let i = 0; i < line.length; i++) {
    if (line[i] === startChar) {
      count++
    } else if (line[i] !== ' ' && line[i] !== '\t') {
      return null // Invalid character
    }
  }

  if (count < 3) return null

  return {
    type: RuleType.breakThematic,
    endPos: lineEnd + (lineEnd < source.length ? 1 : 0),
  } as MarkdownToJSX.BreakThematicNode & { endPos: number }
}

/**
 * Calculate the space-equivalent indentation at a position
 * Tabs count as 4 spaces, spaces count as 1
 * Returns { spaceEquivalent, charCount } where charCount is the number of characters
 */
function calculateIndent(
  source: string,
  pos: number,
  maxPos: number
): { spaceEquivalent: number; charCount: number } {
  let spaceEquivalent = 0
  let charCount = 0
  let i = pos

  while (i < maxPos && (source[i] === ' ' || source[i] === '\t')) {
    if (source[i] === '\t') {
      spaceEquivalent += 4 // Tab = 4 spaces
    } else {
      spaceEquivalent += 1
    }
    charCount++
    i++
  }

  return { spaceEquivalent, charCount }
}

/**
 * Remove exactly 4 space-equivalent characters of indentation
 * Tabs count as 4 spaces, spaces count as 1
 * Returns the number of characters to remove
 */
function removeIndent(source: string, pos: number, maxPos: number): number {
  let spaceEquivalent = 0
  let charCount = 0
  let i = pos

  while (
    i < maxPos &&
    (source[i] === ' ' || source[i] === '\t') &&
    spaceEquivalent < 4
  ) {
    if (source[i] === '\t') {
      spaceEquivalent += 4
      charCount++
      break // Tab counts as exactly 4, so we're done
    } else {
      spaceEquivalent += 1
      charCount++
    }
    i++
  }

  return charCount
}

export function parseCodeBlock(source: string, pos: number): ParseResult {
  // Check if line starts with 4+ spaces or 1+ tab
  const indentInfo = calculateIndent(source, pos, source.length)

  // Must have at least 4 space-equivalent indentation
  if (indentInfo.spaceEquivalent < 4) return null

  const lineEnd = findLineEnd(source, pos + indentInfo.charCount)

  // Extract the line content (remove exactly 4 space-equivalent characters)
  const indentSize = removeIndent(source, pos, lineEnd)
  // Use array for efficient string building in loops (optimization for large documents)
  const contentParts = [source.slice(pos + indentSize, lineEnd)]

  // Continue collecting lines until we hit a non-indented line or end
  let endPos = lineEnd + (lineEnd < source.length ? 1 : 0) // past the newline

  while (endPos < source.length) {
    const nextLineEnd = findLineEnd(source, endPos)

    // Check if this is a blank line (empty or only whitespace)
    const lineContent = source.slice(endPos, nextLineEnd)
    const isBlankLine = lineContent.trim() === ''

    // Check if next line (after this line's newline) is indented
    let checkPos = nextLineEnd + 1 // after the newline
    const nextIndentInfo =
      checkPos < source.length
        ? calculateIndent(source, checkPos, source.length)
        : { spaceEquivalent: 0, charCount: 0 }

    // Check if next line exists and has content
    const nextLineHasContent =
      nextLineEnd + 1 + nextIndentInfo.charCount < source.length &&
      source[nextLineEnd + 1 + nextIndentInfo.charCount] !== '\n'

    // Stop conditions:
    // 1. Non-blank line that's not indented enough (< 4 space-equivalent)
    // 2. Blank line followed by a non-indented line (double newline ending the code block)
    if (isBlankLine) {
      // Blank line: check if next line continues the code block
      // Next line must have 4+ space-equivalent indentation to continue
      const nextLineIsIndented = nextIndentInfo.spaceEquivalent >= 4

      if (nextLineHasContent && !nextLineIsIndented) {
        // Blank line followed by non-indented content - end of code block
        break
      }
      // Blank line followed by indented content (or end of input) - continue code block
      contentParts.push('\n')
    } else {
      // Non-blank line: check if it's indented enough
      const currentIndentInfo = calculateIndent(source, endPos, nextLineEnd)
      const currentLineIsIndented = currentIndentInfo.spaceEquivalent >= 4

      // Stop if current line is not indented enough
      if (!currentLineIsIndented) {
        break
      }

      // Add the content (remove exactly 4 space-equivalent characters)
      const indentToRemove = removeIndent(source, endPos, nextLineEnd)
      const nextContent = source.slice(endPos + indentToRemove, nextLineEnd)
      contentParts.push('\n', nextContent)
    }

    endPos = nextLineEnd + (nextLineEnd < source.length ? 1 : 0)
  }

  let content = contentParts.join('')
  content = content.replace(TRAILING_NEWLINE_R, '')

  content = content.replace(TAB_TO_SPACES_R, '    ')

  content = content.replace(ESCAPE_SEQUENCE_R, '$1')

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
  // Must start with at least 3 backticks
  if (source[pos] !== '`') return null

  // Count opening backticks
  let fenceChar = '`'
  let fenceLength = 0
  let i = pos
  while (i < source.length && source[i] === fenceChar) {
    fenceLength++
    i++
  }

  // Must have at least 3 backticks
  if (fenceLength < 3) return null

  // Extract language specifier and optional attributes (same format as old parser)
  // Format: ```lang attr1="value1" attr2="value2"
  let lang = ''
  let attrs = ''
  i = skipWhitespace(source, i)

  const lineEnd = findLineEnd(source, i)
  const langAndAttrs = source.slice(i, lineEnd).trim()

  // Split language and attributes (language is first word)
  const firstSpace = langAndAttrs.indexOf(' ')
  if (firstSpace > 0) {
    lang = langAndAttrs.slice(0, firstSpace)
    attrs = langAndAttrs.slice(firstSpace + 1).trim()
  } else {
    lang = langAndAttrs
  }

  // Find the closing fence
  let contentStart =
    lineEnd + (lineEnd < source.length && source[lineEnd] === '\n' ? 1 : 0)
  // Use array for efficient string building in loops (optimization for large documents)
  const contentParts: string[] = []
  let endPos = contentStart

  while (endPos < source.length) {
    const lineEnd = findLineEnd(source, endPos)

    // Check if this line is a closing fence
    let fenceStart = endPos
    // Skip leading whitespace
    while (
      fenceStart < lineEnd &&
      (source[fenceStart] === ' ' || source[fenceStart] === '\t')
    ) {
      fenceStart++
    }

    // Check for matching fence
    if (
      source.slice(fenceStart, fenceStart + fenceLength) ===
      fenceChar.repeat(fenceLength)
    ) {
      // Found closing fence
      let remaining = source.slice(fenceStart + fenceLength, lineEnd)
      // Should only have whitespace after fence
      if (remaining.trim() === '') {
        endPos =
          lineEnd +
          (lineEnd < source.length && source[lineEnd] === '\n' ? 1 : 0)
        break
      }
    }

    // Add this line to content
    const lineContent = source.slice(endPos, lineEnd)
    contentParts.push(lineContent, '\n')

    endPos =
      lineEnd + (lineEnd < source.length && source[lineEnd] === '\n' ? 1 : 0)
  }

  // Remove trailing newline
  let content = contentParts.join('')
  content = content.replace(/\n$/, '')

  // Parse attributes if present (same as old parser)
  let parsedAttrs: { [key: string]: any } = {}
  if (attrs && attrs.trim()) {
    const attrMatches = extractHTMLAttributes(attrs)
    if (attrMatches && attrMatches.length > 0) {
      for (let j = 0; j < attrMatches.length; j++) {
        const raw = attrMatches[j]
        const delimiterIdx = raw.indexOf('=')

        if (delimiterIdx !== -1) {
          const key = normalizeAttributeKey(raw.slice(0, delimiterIdx).trim())
          const mappedKey = ATTRIBUTE_TO_JSX_PROP_MAP[key.toLowerCase()] || key

          if (mappedKey === 'ref') continue

          const rawValue = raw.slice(delimiterIdx + 1).trim()
          const value = unquote(rawValue)
          const normalizedValue = attributeValueToJSXPropValue(
            'code' as MarkdownToJSX.HTMLTags,
            key.toLowerCase(),
            value,
            options.sanitizer
          )
          if (normalizedValue != null) {
            parsedAttrs[mappedKey] = normalizedValue
          }
        } else if (raw !== 'style') {
          parsedAttrs[ATTRIBUTE_TO_JSX_PROP_MAP[raw] || raw] = true
        }
      }
    }
  }

  return {
    type: RuleType.codeBlock,
    text: content,
    lang: lang || undefined,
    attrs: Object.keys(parsedAttrs).length > 0 ? parsedAttrs : undefined,
    endPos,
  } as MarkdownToJSX.CodeBlockNode & { endPos: number }
}

export function parseBlockQuote(
  source: string,
  pos: number,
  state: MarkdownToJSX.State,
  options: ParseOptions
): ParseResult {
  // Must be at block level and start with '>'
  if (state.inline || source[pos] !== '>') return null

  // Find the end of the blockquote (next non-blockquote line or end of content)
  let endPos = pos
  // Use array for efficient string building in loops (optimization for large documents)
  const rawContentParts: string[] = []

  while (endPos < source.length) {
    const lineEnd = findLineEnd(source, endPos)

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
      // Add the entire line including the '>' marker for regex processing
      rawContentParts.push(source.slice(endPos, lineEnd))
      if (lineEnd < source.length) {
        rawContentParts.push('\n')
      }
    } else {
      // Check for lazy continuation line (line without > that continues blockquote)
      const lineContent = source.slice(endPos, lineEnd).trim()
      const isEmptyLine = lineContent === ''

      // If it's an empty line, stop the blockquote
      if (isEmptyLine) {
        break
      }

      // Check if this line starts a new block element
      // Skip leading whitespace to find the first non-whitespace char
      let checkPos = endPos
      while (
        checkPos < lineEnd &&
        (source[checkPos] === ' ' || source[checkPos] === '\t')
      ) {
        checkPos++
      }
      // If it starts with a block character (but not >), it's a new block, stop
      if (
        checkPos < lineEnd &&
        isBlockStartChar(source[checkPos]) &&
        source[checkPos] !== '>'
      ) {
        break
      }

      // This is a lazy continuation line - include it in the blockquote
      rawContentParts.push(source.slice(endPos, lineEnd))
      if (lineEnd < source.length) {
        rawContentParts.push('\n')
      }
    }

    endPos = lineEnd + (lineEnd < source.length ? 1 : 0)
  }

  const rawContent = rawContentParts.join('')

  if (!rawContent.trim()) return null

  // Apply the same processing as the old parser
  // Remove leading '> ' from each line
  const trimmedContent = rawContent.replace(/^ *> ?/gm, '')

  // Extract alert type and content
  const alertMatch = trimmedContent.match(/^(?:\[!([^\]]*)\]\n)?([\s\S]*)/)
  if (!alertMatch) return null

  const alertType = alertMatch[1]
  let content = alertMatch[2]

  // For blockquotes, content goes into a single paragraph
  const children: MarkdownToJSX.ASTNode[] = []

  if (content.trim()) {
    // Parse the entire content as inline (newlines are preserved by default)
    const originalInAnchor = state.inAnchor
    const originalInline = state.inline
    state.inAnchor = false
    state.inline = true
    const inlineChildren = parseInlineSpan(
      content,
      0,
      content.length,
      state,
      options
    )
    state.inAnchor = originalInAnchor
    state.inline = originalInline

    children.push({
      type: RuleType.paragraph,
      children: inlineChildren,
    } as MarkdownToJSX.ParagraphNode)
  }

  return {
    type: RuleType.blockQuote,
    children,
    alert: alertType,
    endPos,
  } as MarkdownToJSX.BlockQuoteNode & { endPos: number }
}

function appendListContinuation(
  continuationContent: string,
  lastItem: MarkdownToJSX.ASTNode[],
  state: MarkdownToJSX.State,
  options: ParseOptions
): void {
  // Parse continuation content once (extract common logic)
  const originalInline = state.inline
  state.inline = true
  const continuationInline = parseInlineSpan(
    '\n' + continuationContent,
    0,
    continuationContent.length + 1,
    state,
    options
  )
  state.inline = originalInline

  // Append to either paragraph children or item directly
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

function parseList(
  source: string,
  pos: number,
  state: MarkdownToJSX.State,
  options: ParseOptions,
  ordered: boolean
): ParseResult {
  if (state.inline) return null

  const lineEnd = findLineEnd(source, pos)
  const line = source.slice(pos, lineEnd)
  const indentMatch = line.match(/^(\s*)/)
  const indent = indentMatch ? indentMatch[1].length : 0
  const lineWithoutIndent = line.slice(indent)
  const listItemRegex = ordered ? ORDERED_LIST_ITEM_R : UNORDERED_LIST_ITEM_R
  const match = lineWithoutIndent.match(listItemRegex)
  if (!match) return null

  const baseIndent = indent
  const start = ordered ? parseInt(match[1], 10) : undefined
  const marker = ordered ? undefined : match[1]
  const items: MarkdownToJSX.ASTNode[][] = []

  let currentPos = lineEnd + (lineEnd < source.length ? 1 : 0)

  // Check if this is a loose list (has blank lines)
  let checkPos = currentPos
  let hasBlankLines = false

  while (checkPos < source.length) {
    const nextLineEnd = findLineEnd(source, checkPos)
    const nextLine = source.slice(checkPos, nextLineEnd)
    if (nextLine.trim() === '') {
      // look ahead to next non-empty line
      let look = nextLineEnd + (nextLineEnd < source.length ? 1 : 0)
      while (
        look < source.length &&
        (source[look] === '\n' || WHITESPACE_CHAR_R.test(source[look]))
      ) {
        if (source[look] === '\n') {
          // keep skipping
        }
        look++
      }
      const lookEnd = findLineEnd(source, look)
      const lookLine = source.slice(look, lookEnd)
      const nextMatch = lookLine.match(listItemRegex)
      if (ordered ? nextMatch : nextMatch && nextMatch[1] === marker) {
        hasBlankLines = true
      }
      break
    }
    const nextMatch = nextLine.match(listItemRegex)
    if (ordered ? !nextMatch : !nextMatch || nextMatch[1] !== marker) break
    checkPos = nextLineEnd + (nextLineEnd < source.length ? 1 : 0)
  }

  // helper to create list item children, with GFM task support
  function buildListItemChildren(
    content: string,
    wrapInParagraph: boolean
  ): MarkdownToJSX.ASTNode[] {
    const children: MarkdownToJSX.ASTNode[] = []
    const task = parseGFMTask(content, 0)
    if (
      task &&
      (task.endPos < content.length ? content[task.endPos] === ' ' : true)
    ) {
      children.push(task)
      const restStart =
        task.endPos < content.length && content[task.endPos] === ' '
          ? task.endPos + 1
          : task.endPos
      const originalInline = state.inline
      state.inline = true
      const rest = parseInlineSpan(
        content,
        restStart,
        content.length,
        state,
        options
      )
      state.inline = originalInline
      children.push.apply(children, rest)
      return children
    }

    // Check if content contains double newlines (block content)
    const containsBlocks = includes(content, '\n\n')

    if (containsBlocks) {
      // Parse as blocks if content has double newlines
      // Use parseBlocksInHTML which handles block parsing (it's similar to parseMarkdown)
      // Mutate state directly and restore - inline should already be false at this point
      const originalInline = state.inline
      const originalList = state.list
      state.inline = false
      state.list = true
      const blocks = parseBlocksInHTML(content, state, options)
      state.inline = originalInline
      state.list = originalList
      return blocks
    } else if (wrapInParagraph) {
      // Wrap single-line content in paragraph for loose lists
      const originalInline = state.inline
      state.inline = true
      const inline = parseInlineSpan(content, 0, content.length, state, options)
      state.inline = originalInline
      return [
        {
          type: RuleType.paragraph,
          children: inline,
        } as MarkdownToJSX.ParagraphNode,
      ]
    } else {
      // Parse as inline (tight list)
      const originalInline = state.inline
      state.inline = true
      const inline = parseInlineSpan(content, 0, content.length, state, options)
      state.inline = originalInline
      return inline
    }
  }

  // Parse the first item
  const firstItemContent = match[2]
  items.push(buildListItemChildren(firstItemContent, hasBlankLines))

  // Continue parsing subsequent list items
  while (currentPos < source.length) {
    const nextLineEnd = findLineEnd(source, currentPos)

    const nextLine = source.slice(currentPos, nextLineEnd)
    const nextIndentMatch = nextLine.match(/^(\s*)/)
    const nextIndent = nextIndentMatch ? nextIndentMatch[1].length : 0

    if (nextLine.trim() === '') {
      // Blank line - mark as loose list and continue
      hasBlankLines = true
      currentPos = nextLineEnd + (nextLineEnd < source.length ? 1 : 0)
    } else if (nextIndent < baseIndent) {
      // Less indented - end of list
      break
    } else {
      const nextMatch = nextLine.match(listItemRegex)
      const isSameType = ordered
        ? !!nextMatch
        : nextMatch && nextMatch[1] === marker
      if (isSameType) {
        if (nextIndent > baseIndent) {
          const nestedResult = parseList(
            source,
            currentPos,
            state,
            options,
            ordered
          )
          if (nestedResult) {
            const lastItem = items[items.length - 1]
            lastItem.push(nestedResult)
            currentPos = nestedResult.endPos
          } else {
            const continuationContent = nextLine.slice(nextIndent)
            const lastItem = items[items.length - 1]
            appendListContinuation(
              continuationContent,
              lastItem,
              state,
              options
            )
            currentPos = nextLineEnd + (nextLineEnd < source.length ? 1 : 0)
          }
        } else if (nextIndent === baseIndent) {
          const itemContent = nextMatch[2]
          items.push(buildListItemChildren(itemContent, hasBlankLines))
          currentPos = nextLineEnd + (nextLineEnd < source.length ? 1 : 0)
        }
      } else if (nextIndent > baseIndent) {
        const nestedUnorderedResult = parseList(
          source,
          currentPos,
          state,
          options,
          false
        )
        if (nestedUnorderedResult) {
          const lastItem = items[items.length - 1]
          lastItem.push(nestedUnorderedResult)
          currentPos = nestedUnorderedResult.endPos
        } else {
          const nestedOrderedResult = parseList(
            source,
            currentPos,
            state,
            options,
            true
          )
          if (nestedOrderedResult) {
            const lastItem = items[items.length - 1]
            lastItem.push(nestedOrderedResult)
            currentPos = nestedOrderedResult.endPos
          } else if (nextIndent >= baseIndent + 4) {
            const continuationContent = nextLine.slice(nextIndent)
            const lastItem = items[items.length - 1]
            appendListContinuation(
              continuationContent,
              lastItem,
              state,
              options
            )
            currentPos = nextLineEnd + (nextLineEnd < source.length ? 1 : 0)
          } else {
            break
          }
        }
      } else {
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
  return {
    ...listNode,
    endPos: currentPos,
  } as (MarkdownToJSX.OrderedListNode | MarkdownToJSX.UnorderedListNode) & {
    endPos: number
  }
}

export function parseOrderedList(
  source: string,
  pos: number,
  state: MarkdownToJSX.State,
  options: ParseOptions
): ParseResult {
  return parseList(source, pos, state, options, true)
}

export function parseUnorderedList(
  source: string,
  pos: number,
  state: MarkdownToJSX.State,
  options: ParseOptions
): ParseResult {
  return parseList(source, pos, state, options, false)
}

export function parseTable(
  source: string,
  pos: number,
  state: MarkdownToJSX.State,
  options: ParseOptions
): ParseResult {
  // Must be at block level
  if (state.inline) return null

  // Need at least 3 lines: header, separator, and at least one body row
  let currentPos = pos
  let lines: string[] = []

  // Collect lines until we can't find more table lines
  while (currentPos < source.length) {
    const lineEnd = findLineEnd(source, currentPos)

    const line = source.slice(currentPos, lineEnd).trim()
    if (!includes(line, '|')) break // Not a table line

    lines.push(line)
    currentPos = lineEnd + (lineEnd < source.length ? 1 : 0)

    // Stop if we don't have enough lines for a valid table
    if (lines.length >= 3) {
      // Check if this looks like a valid table
      if (lines.length === 2) {
        // Check if second line is a separator
        const separatorCells = lines[1].split('|').map(s => s.trim())
        const isSeparator = separatorCells.every(
          cell => TABLE_ALIGN_R.test(cell) && includes(cell, '-')
        )
        if (!isSeparator) break
      }
    }
  }

  // Need at least header, separator, and one body row
  if (lines.length < 3) return null

  function splitTableCells(line: string): string[] {
    const cells: string[] = []
    let current = ''
    let inCode = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '\\' && i + 1 < line.length && line[i + 1] === '|') {
        current += '|'
        i++
        continue
      }
      if (ch === '`') {
        inCode = !inCode
        current += ch
        continue
      }
      if (ch === '|' && !inCode) {
        cells.push(current.trim())
        current = ''
        continue
      }
      current += ch
    }
    cells.push(current.trim())
    return cells
  }

  // Parse header - split on | and trim using robust splitter
  const headerLine = lines[0].trim()
  const headerCells =
    startsWith(headerLine, '|') && headerLine[headerLine.length - 1] === '|'
      ? splitTableCells(headerLine.slice(1, -1))
      : splitTableCells(headerLine)
  if (headerCells.length === 0) return null

  const separatorLine = lines[1].trim()
  const separatorCells =
    startsWith(separatorLine, '|') &&
    separatorLine[separatorLine.length - 1] === '|'
      ? splitTableCells(separatorLine.slice(1, -1))
      : splitTableCells(separatorLine)
  if (separatorCells.length !== headerCells.length) return null

  const alignments: (string | null)[] = separatorCells.map(cell => {
    const len = cell.length
    if (startsWith(cell, ':') && len > 0 && cell[len - 1] === ':')
      return 'center'
    if (startsWith(cell, ':')) return 'left'
    if (len > 0 && cell[len - 1] === ':') return 'right'
    return null
  })

  // Parse header row
  const originalInline = state.inline
  state.inline = true
  const header = headerCells.map(header =>
    parseInlineSpan(header, 0, header.length, state, options)
  )
  state.inline = originalInline

  // Parse body rows
  const cells = lines.slice(2).map(line => {
    const trimmedLine = line.trim()
    const rowCells =
      startsWith(trimmedLine, '|') &&
      trimmedLine[trimmedLine.length - 1] === '|'
        ? splitTableCells(trimmedLine.slice(1, -1))
        : splitTableCells(trimmedLine)
    // Ensure inline is true for each cell (it might have been modified)
    const originalInline = state.inline
    state.inline = true
    const result = rowCells.map(cell =>
      parseInlineSpan(cell, 0, cell.length, state, options)
    )
    state.inline = originalInline
    return result
  })

  return {
    type: RuleType.table,
    header,
    cells,
    align: alignments,
    endPos: currentPos,
  } as MarkdownToJSX.TableNode & { endPos: number }
}

function matchHTMLBlock(source: string): RegExpMatchArray | null {
  // Backtracking-proof parser: linear scan instead of regex
  // Avoids polynomial time on patterns like '<a!!!...!!!'
  if (source[0] !== '<') return null

  var tagNameResult = parseHTMLTagName(source, 1)
  if (!tagNameResult) return null

  var tagName = tagNameResult.tagName
  var tagLower = tagNameResult.tagLower
  var sourceLen = source.length

  // Skip whitespace after tag name
  var attrsStart = tagNameResult.nextPos
  while (
    attrsStart < sourceLen &&
    (source[attrsStart] === ' ' || source[attrsStart] === '\t')
  ) {
    attrsStart++
  }

  // Parse attributes (linear scan to find closing >)
  var attrs = ''
  var tagEnd = attrsStart
  var inQuotes = false
  var quoteChar = ''

  while (tagEnd < sourceLen) {
    var char = source[tagEnd]
    if (inQuotes) {
      if (char === quoteChar && (tagEnd === 0 || source[tagEnd - 1] !== '\\')) {
        inQuotes = false
        quoteChar = ''
      }
    } else if (char === '"' || char === "'") {
      inQuotes = true
      quoteChar = char
    } else if (char === '>') {
      attrs = source.slice(attrsStart, tagEnd)
      tagEnd++
      break
    }
    tagEnd++
  }

  // Check if we successfully found '>' (tagEnd > attrsStart means we broke after finding '>')
  if (tagEnd > sourceLen || source[tagEnd - 1] !== '>') return null

  // Skip HTML parsing if it looks like a URL (autolink)
  if (endsWith(tagName, ':') && startsWith(source.slice(tagEnd), '//')) {
    return null
  }

  // Check for URL pattern in tag itself (not in attributes) - linear scan
  if (tagEnd <= 50) {
    var tagContent = source.slice(0, tagEnd)
    // Linear scan for :// pattern (no regex backtracking)
    var colonIdx = tagContent.indexOf(':')
    if (colonIdx !== -1 && colonIdx + 2 < tagContent.length) {
      if (
        tagContent[colonIdx + 1] === '/' &&
        tagContent[colonIdx + 2] === '/'
      ) {
        // Check if it's not in an attribute (no = before it)
        var beforeColon = tagContent.slice(0, colonIdx)
        if (!includes(beforeColon, '=')) {
          return null
        }
      }
    }
  }

  var openTagLen = tagLower.length + 1

  var contentPos = tagEnd
  if (source[contentPos] === '\n') contentPos++
  var contentStart = contentPos
  var contentEnd = contentPos
  var depth = 1

  while (depth > 0) {
    var idx = source.indexOf('<', contentPos)
    if (idx === -1) {
      // No closing tag found - check if we should parse it anyway
      var hasAttrs = attrs && attrs.trim().length > 0

      if (hasAttrs) {
        // Tag has attributes - parse it anyway (needed for sanitization)
        // Treat everything after opening tag as content
        contentEnd = sourceLen
        contentPos = sourceLen
        break
      }

      // No attributes - return null to allow fallback to paragraph/autolink parsing
      return null
    }

    var openIdx = -1
    var closeIdx = -1

    if (source[idx + 1] === '/') {
      closeIdx = idx
    } else if (
      idx + openTagLen + 1 <= sourceLen &&
      (source[idx + 1] === tagLower[0] || source[idx + 1] === tagName[0])
    ) {
      var tagCandidate = source.substring(idx + 1, idx + openTagLen)
      if (
        tagCandidate.toLowerCase() === tagLower &&
        (source[idx + openTagLen] === ' ' || source[idx + openTagLen] === '>')
      ) {
        openIdx = idx
      }
    }

    if (openIdx === -1 && closeIdx === -1) {
      contentPos = idx + 1
      continue
    }

    if (openIdx !== -1 && (closeIdx === -1 || openIdx < closeIdx)) {
      // Check if this is a sibling tag (same name) at the same nesting level with newlines
      // Only for SVG <g> tags (known case where sibling closing is expected)
      var currentTagHasAttrs = attrs && attrs.trim().length > 0
      if (
        depth === 1 &&
        openIdx === idx &&
        !currentTagHasAttrs &&
        tagLower === 'g'
      ) {
        // Check if there's ONLY whitespace/newlines between the opening tag end and the sibling tag
        var openingTagEnd = tagEnd
        var betweenContent = source.slice(openingTagEnd, idx)
        var hasNewlineBetween = includes(betweenContent, '\n')
        // Make sure there's no other tags between them (which would indicate nesting)
        // Linear scan for < followed by non-/ (no regex backtracking)
        var hasOtherTagsBetween = false
        for (
          var checkIdx = 0;
          checkIdx < betweenContent.length - 1;
          checkIdx++
        ) {
          if (
            betweenContent[checkIdx] === '<' &&
            betweenContent[checkIdx + 1] !== '/'
          ) {
            hasOtherTagsBetween = true
            break
          }
        }
        if (hasNewlineBetween && !hasOtherTagsBetween) {
          // This is a sibling <g> tag with newline and no intervening tags - close the current tag with empty content
          contentEnd = idx
          contentPos = idx
          depth = 0
          break
        }
      }
      contentPos = openIdx + openTagLen + 1
      depth++
    } else {
      var p = closeIdx + 2
      while (p < sourceLen) {
        var c = source[p]
        if (c !== ' ' && c !== '\t' && c !== '\n' && c !== '\r') break
        p++
      }
      if (p + tagLower.length > sourceLen) return null

      var closeTagCandidate = source.substring(p, p + tagLower.length)
      if (closeTagCandidate.toLowerCase() !== tagLower) {
        contentPos = p
        continue
      }

      p += tagLower.length
      // Skip whitespace before '>' (matching old parser behavior)
      while (p < sourceLen) {
        var c = source[p]
        if (c !== ' ' && c !== '\t' && c !== '\n' && c !== '\r') break
        p++
      }
      if (p >= sourceLen || source[p] !== '>') {
        contentPos = p
        continue
      }

      contentEnd = closeIdx
      contentPos = p + 1
      depth--
    }
  }

  var trailingNl = 0
  while (
    contentPos + trailingNl < sourceLen &&
    source[contentPos + trailingNl] === '\n'
  )
    trailingNl++

  var result = [
    source.slice(0, contentPos + trailingNl),
    tagName,
    attrs,
    source.slice(contentStart, contentEnd),
  ] as unknown as RegExpMatchArray
  result.index = 0
  result.input = source
  return result
}

function processHTMLBlock(
  tagNameOriginal: string,
  tagName: string,
  attrs: string,
  content: string,
  fullMatch: string,
  endPos: number,
  source: string,
  pos: number,
  state: MarkdownToJSX.State,
  parentInAnchor: boolean,
  options: ParseOptions
): MarkdownToJSX.HTMLNode & { endPos: number } {
  // Apply block-level paragraph wrapping heuristics
  if (!state.inHTML && !state.inline && !endsWith(fullMatch, '\n')) {
    let checkPos = endPos
    const sourceLen = source.length

    while (checkPos < sourceLen) {
      if (source[checkPos] === '\n') {
        let p = checkPos + 1
        while (
          p < sourceLen &&
          (source[p] === ' ' || source[p] === '\t' || source[p] === '\r')
        ) {
          p++
        }
        if (p < sourceLen && source[p] === '\n') break
        checkPos = p
      } else if (
        source[checkPos] !== ' ' &&
        source[checkPos] !== '\t' &&
        source[checkPos] !== '\r'
      ) {
        if (source[checkPos] === '<') {
          const htmlMatch = matchHTMLBlock(source.slice(checkPos))
          if (htmlMatch) {
            checkPos += htmlMatch[0].length
            continue
          }
          const selfClosingMatch = parseHTMLSelfClosingTag(source, checkPos)
          if (selfClosingMatch) {
            checkPos += selfClosingMatch.fullMatch.length
            continue
          }
        }
        return null
      } else {
        checkPos++
      }
    }
  }

  const attributes = parseHTMLAttributes(
    attrs,
    tagName,
    tagNameOriginal,
    options
  )

  const lowerTag = tagName
  const noInnerParse =
    lowerTag === 'pre' || lowerTag === 'script' || lowerTag === 'style'

  if (noInnerParse) {
    let finalContent = content
    if (finalContent.length > 0 && finalContent[0] === '\n') {
      finalContent = finalContent.slice(1)
    }
    if (
      finalContent.length > 0 &&
      finalContent[finalContent.length - 1] === '\n'
    ) {
      finalContent = finalContent.slice(0, -1)
    }
    content = finalContent
  }

  const leftTrimMatch = content.match(/^([ \t]*)/)
  const leftTrimAmount = leftTrimMatch ? leftTrimMatch[1] : ''
  const trimmer = new RegExp(
    `^${leftTrimAmount.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
    'gm'
  )
  const trimmed = content.replace(trimmer, '')

  const hasDoubleNewline = DOUBLE_NEWLINE_R.test(trimmed)
  const hasNonParagraphBlockSyntax = BLOCK_SYNTAX_R.test(trimmed)
  const isParagraphTag = lowerTag === 'p'
  const hasBlockSyntax = isParagraphTag
    ? hasDoubleNewline
    : hasDoubleNewline ||
      hasNonParagraphBlockSyntax ||
      (state.inHTML && HTML_BLOCK_ELEMENT_START_R.test(trimmed))

  let children: MarkdownToJSX.ASTNode[] = []

  if (!noInnerParse && trimmed) {
    if (hasBlockSyntax) {
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

  return {
    type: RuleType.htmlBlock,
    tag: (noInnerParse ? tagName : tagNameOriginal) as MarkdownToJSX.HTMLTags,
    attrs: attributes,
    children,
    text: noInnerParse ? content : undefined,
    noInnerParse,
    endPos: endPos,
  } as MarkdownToJSX.HTMLNode & { endPos: number }
}

export function parseHTML(
  source: string,
  pos: number,
  state: MarkdownToJSX.State,
  options: ParseOptions
): ParseResult {
  // Must start with '<'
  if (source[pos] !== '<') return null

  // Preserve inAnchor state from parent for nested HTML parsing
  const parentInAnchor = state.inAnchor || false

  // Quick check: try self-closing tag detection first (fast path for void elements)
  // Only do this if we're not likely to be an anchor tag
  const isLikelyAnchor =
    pos + 1 < source.length &&
    (source[pos + 1] === 'a' || source[pos + 1] === 'A') &&
    (pos + 2 >= source.length || !/\w/u.test(source[pos + 2]))

  if (!isLikelyAnchor) {
    const selfClosingMatch = parseHTMLSelfClosingTag(source, pos)
    if (selfClosingMatch) {
      const tagNameLower = selfClosingMatch.tagName.toLowerCase()
      const isVoid = isVoidElement(selfClosingMatch.tagName)

      // If it's an anchor tag or non-void without />, we need block parsing
      // Otherwise, it's a valid self-closing tag
      if (tagNameLower !== 'a' && (isVoid || selfClosingMatch.endsWithSlash)) {
        // Valid self-closing tag (void or has />)
        const tagName = selfClosingMatch.tagName
        const attrs = selfClosingMatch.attrs.replace(/\/\s*$/, '')

        const attributes = parseHTMLAttributes(
          attrs,
          tagNameLower,
          tagName,
          options
        )

        return {
          type: RuleType.htmlSelfClosing,
          tag: tagName,
          attrs: attributes,
          endPos: pos + selfClosingMatch.fullMatch.length,
        } as MarkdownToJSX.HTMLSelfClosingNode & { endPos: number }
      }
      // Fall through to block parsing if it's an anchor or non-void without />
    }
  }

  // Try block parsing (for full tags with nested content, or anchor tags)
  const blockMatch = matchHTMLBlock(source.slice(pos))
  if (blockMatch) {
    const tagNameOriginal = blockMatch[1]
    const tagName = tagNameOriginal.toLowerCase()
    const attrs = blockMatch[2] || ''
    const content = blockMatch[3]
    const fullMatch = blockMatch[0]
    const endPos = pos + fullMatch.length

    return processHTMLBlock(
      tagNameOriginal,
      tagName,
      attrs,
      content,
      fullMatch,
      endPos,
      source,
      pos,
      state,
      parentInAnchor,
      options
    )
  }

  // Fallback: Try void element without /> (manual parsing)
  // Only try this if self-closing didn't match
  var tagNameResult = parseHTMLTagName(source, pos + 1)
  if (!tagNameResult) return null

  var tagName = tagNameResult.tagName
  if (!isVoidElement(tagName)) return null

  var i = tagNameResult.nextPos
  var len = source.length
  while (i < len && isWS(source[i])) i++
  var attrsStart = i

  while (i < len && source[i] !== '>') i++
  if (i >= len) return null

  const attrs = source.slice(attrsStart, i).trim()
  const afterAngle = i + 1

  let checkIdx = afterAngle
  while (checkIdx < len && isWS(source[checkIdx])) checkIdx++
  const closeTagPattern = '</' + tagName.toLowerCase() + '>'
  const foundIdx = source.toLowerCase().indexOf(closeTagPattern, checkIdx)
  if (foundIdx !== -1) {
    const between = source.slice(checkIdx, foundIdx).trim()
    if (between) {
      return null
    }
  }

  i++
  const endPos = i
  while (i < len && isWS(source[i])) i++
  if (i < len && source[i] === '\n') i++

  const attributes = parseHTMLAttributes(attrs, tagName, tagName, options)

  return {
    type: RuleType.htmlSelfClosing,
    tag: tagName,
    attrs: attributes,
    endPos,
  } as MarkdownToJSX.HTMLSelfClosingNode & { endPos: number }
}

export function parseHTMLComment(source: string, pos: number): ParseResult {
  if (!startsWith(source, '<!--', pos)) return null

  const contentStart = pos + 4
  let endPos = contentStart
  while (endPos + 2 < source.length) {
    if (startsWith(source, '-->', endPos)) {
      const content = source.slice(contentStart, endPos)
      return {
        type: RuleType.htmlComment,
        text: content,
        endPos: endPos + 3,
      } as MarkdownToJSX.HTMLCommentNode & { endPos: number }
    }
    endPos++
  }

  return null
}

export function parseRef(
  source: string,
  pos: number,
  refs: { [key: string]: { target: string; title: string | undefined } }
): ParseResult {
  // Must start with '['
  if (source[pos] !== '[') return null

  // Match reference definition: [ref]: url "title"
  const match = source
    .slice(pos)
    .match(/^\[([^\]]*)\]:\s+<?([^\s>]+)>?\s*("([^"]*)")?/)
  if (!match) return null

  const ref = match[1]
  const target = match[2]
  const title = match[4] || undefined

  // Store the reference
  refs[ref] = { target, title }

  return {
    type: RuleType.ref,
    endPos: pos + match[0].length,
  } as MarkdownToJSX.ReferenceNode & { endPos: number }
}

export function parseFootnote(
  source: string,
  pos: number,
  footnotes: { footnote: string; identifier: string }[]
): ParseResult {
  if (
    pos + 1 >= source.length ||
    source[pos] !== '[' ||
    source[pos + 1] !== '^'
  )
    return null

  // Find the identifier end
  let bracketEnd = pos + 2
  while (bracketEnd < source.length && source[bracketEnd] !== ']') {
    bracketEnd++
  }
  if (
    bracketEnd >= source.length ||
    source[bracketEnd] !== ']' ||
    bracketEnd + 1 >= source.length ||
    source[bracketEnd + 1] !== ':'
  ) {
    return null
  }

  const identifier = source.slice(pos + 2, bracketEnd)

  // Parse the footnote content
  let contentStart = bracketEnd + 2 // after ']:'
  let contentEnd = contentStart

  contentStart = skipWhitespace(source, contentStart)

  // Find the end of the footnote (next footnote definition, blank line, or end of input)
  // Continuation lines are lines that:
  // 1. Start with a newline
  // 2. Don't start with [^ (unless indented with 4+ spaces)
  // 3. Can be indented with up to 4 spaces
  // 4. Stop at a blank line (two consecutive newlines) if followed by non-indented content
  let stoppedAtBlankLine = false
  while (contentEnd < source.length) {
    // Check if we're at the start of a line (after newline or at start of input)
    const isLineStart = contentEnd === 0 || source[contentEnd - 1] === '\n'

    // Check for blank line (two consecutive newlines) followed by non-indented content
    // A blank line terminates the footnote if followed by content that's not indented 4+ spaces
    // We need to check if we're at a blank line: current position is \n and next is \n
    if (
      contentEnd + 1 < source.length &&
      source[contentEnd] === '\n' &&
      source[contentEnd + 1] === '\n' &&
      contentEnd > contentStart // Make sure we're past the first line
    ) {
      // Check if there's non-indented content after the blank line
      let afterBlank = contentEnd + 2
      // Skip whitespace
      while (
        afterBlank < source.length &&
        (source[afterBlank] === ' ' || source[afterBlank] === '\t')
      ) {
        afterBlank++
      }
      // If there's content and it's not indented with 4+ spaces, stop the footnote
      if (
        afterBlank < source.length &&
        source[afterBlank] !== '\n' &&
        afterBlank - (contentEnd + 2) < 4
      ) {
        // Blank line followed by non-indented content - stop at the blank line
        stoppedAtBlankLine = true
        break
      }
    }

    if (isLineStart && startsWith(source, '[^', contentEnd)) {
      // Check if this is a footnote definition (has ':')
      let checkPos = contentEnd + 2
      while (checkPos < source.length && source[checkPos] !== ']') {
        checkPos++
      }
      if (
        checkPos < source.length &&
        source[checkPos] === ']' &&
        checkPos + 1 < source.length &&
        source[checkPos + 1] === ':'
      ) {
        // Found next footnote definition at start of line - stop here
        break
      }
    }
    contentEnd++
  }

  // Extract the footnote content (from after ']:' to before next footnote or end)
  // The content starts right after ']:', so bracketEnd + 2 skips the ']:'
  // If we stopped at a blank line, contentEnd points to the first \n of \n\n
  // We want to extract up to but not including that \n (which slice does)
  // But we also need to make sure we don't include the trailing newline from the last line
  let extractEnd = contentEnd
  let footnoteContent = source.slice(bracketEnd + 2, extractEnd) // Everything after ']:'

  // Skip whitespace immediately after ']:' (colon and space)
  // The old parser's capture[2] includes ": " but we want just the content
  let startIdx = 0
  if (startIdx < footnoteContent.length && footnoteContent[startIdx] === ':') {
    startIdx++
  }
  startIdx = skipWhitespace(footnoteContent, startIdx)
  footnoteContent = footnoteContent.slice(startIdx)

  // Handle multiline footnotes with indentation
  // The old parser's regex has two patterns:
  // - (\n+ {4,}.*) - matches paragraphs (4+ spaces, preserved)
  // - (\n(?!\[\^).+) - matches continuation lines (indentation removed)
  // In practice: lines with 4 spaces that follow immediately are continuation (remove indentation)
  // Lines with 4+ spaces after a blank line are paragraphs (preserve indentation)
  // For simplicity, preserve 4+ spaces, remove < 4 spaces
  const lines = footnoteContent.split('\n')
  let prevWasBlank = false
  const processedLines = lines.map((line, index) => {
    if (index === 0) {
      // First line - just trim leading/trailing whitespace
      return line.trimEnd()
    }

    // Check if previous line was blank
    if (index > 0 && lines[index - 1].trim() === '') {
      prevWasBlank = true
    } else {
      prevWasBlank = false
    }

    // Continuation lines - check indentation
    // Based on tests: 2-space indentation is preserved, 4-space indentation is removed
    // 4+ spaces after blank line are paragraphs (preserved)
    const leadingSpaces = line.match(/^ */)?.[0].length || 0
    if (leadingSpaces >= 4 && prevWasBlank) {
      // 4+ spaces after a blank line - this is a paragraph, preserve indentation
      return line
    } else if (leadingSpaces === 4 && !prevWasBlank) {
      // Exactly 4 spaces without blank line - remove (markdown continuation indentation)
      return line.slice(4)
    }
    // Otherwise preserve (less than 4 spaces or more than 4 spaces without blank line)
    return line
  })
  footnoteContent = processedLines.join('\n')

  // Trim trailing whitespace/newlines but preserve internal structure
  // If we stopped at a blank line, remove the trailing newline from the last line
  if (stoppedAtBlankLine) {
    // Remove trailing newline if present (but preserve newlines between lines)
    footnoteContent = footnoteContent.replace(/\n$/, '')
  }
  // Remove trailing blank lines (multiple consecutive newlines at the end)
  // Use a more specific pattern to avoid issues
  while (
    endsWith(footnoteContent, '\n\n') ||
    endsWith(footnoteContent, '\n ')
  ) {
    footnoteContent = footnoteContent.slice(0, -1)
  }
  // Then trim any remaining trailing whitespace
  footnoteContent = footnoteContent.replace(/\s+$/, '')

  // Store the footnote
  footnotes.push({
    footnote: footnoteContent,
    identifier,
  })

  return {
    type: RuleType.footnote,
    endPos: contentEnd,
  } as MarkdownToJSX.FootnoteNode & { endPos: number }
}

const T = ['strong', 'em', 'del', 'mark']
const DELS = [
  ['**', T[0]],
  ['__', T[0]],
  ['~~', T[2]],
  ['==', T[3]],
  ['*', T[1]],
  ['_', T[1]],
]

function skipLinkOrImage(source: string, pos: number): number {
  var bracketDepth = 1
  var i = pos + 1

  while (i < source.length && bracketDepth > 0) {
    if (source[i] === '\\') {
      i += 2
      continue
    }
    if (source[i] === '[') bracketDepth++
    if (source[i] === ']') bracketDepth--
    i++
  }

  if (
    bracketDepth === 0 &&
    i < source.length &&
    (source[i] === '(' || source[i] === '[')
  ) {
    var closingChar = source[i] === '(' ? ')' : ']'
    var parenDepth = 1
    i++

    while (i < source.length && parenDepth > 0) {
      if (source[i] === '\\') {
        i += 2
        continue
      }
      if (source[i] === '(' && closingChar === ')') parenDepth++
      if (source[i] === closingChar) parenDepth--
      i++
    }

    if (parenDepth === 0) return i
  }

  return -1
}

export function matchInlineFormatting(
  source: string,
  start: number,
  end: number,
  state?: { inline?: boolean; simple?: boolean }
): RegExpMatchArray | null {
  if (!state || (!state.inline && !state.simple)) return null
  var c = source[start]
  if (c !== '*' && c !== '_' && c !== '~' && c !== '=') return null

  // Find matching delimiter
  var delimiter = ''
  var startLength = 0
  var tag = ''
  for (var i = 0; i < 6; i++) {
    var d = DELS[i][0]
    if (startsWith(source, d, start) && end - start >= d.length * 2) {
      delimiter = d
      startLength = d.length
      tag = DELS[i][1]
      break
    }
  }
  if (!delimiter) return null

  var MAX_DELIMITER_RUN = 100
  var pos = start + startLength
  var inCode = false
  var inHTMLTag = false
  var inHTMLQuote = ''
  var htmlDepth = 0
  var contentStart = pos
  var lastChar = ''
  var canMatch = true // !inCode && htmlDepth === 0
  var delimiterChar = delimiter[0] // Cache to avoid repeated indexing

  while (pos < end) {
    var char = source[pos]

    // Fast path: skip all delimiter checks when in code/HTML
    if (!canMatch) {
      if (char === '`' && htmlDepth === 0) {
        inCode = !inCode
        canMatch = !inCode && htmlDepth === 0
      } else if (inHTMLTag) {
        if (inHTMLQuote) {
          if (char === inHTMLQuote) inHTMLQuote = ''
        } else if (char === '"' || char === "'") {
          inHTMLQuote = char
        } else if (char === '>') {
          inHTMLTag = false
          canMatch = !inCode && htmlDepth === 0
        }
      } else if (char === '<' && !inCode) {
        var nextChar = pos + 1 < end ? source[pos + 1] : ''
        var tagEnd = source.indexOf('>', pos)
        if (tagEnd !== -1 && tagEnd < end) {
          var tagEndChar = tagEnd - 1
          var isSelfClosing =
            tagEndChar >= pos &&
            source[tagEndChar] === '/' &&
            tagEndChar - 1 >= pos &&
            source[tagEndChar - 1] !== '='
          if (nextChar === '/') {
            htmlDepth = Math.max(0, htmlDepth - 1)
            canMatch = !inCode && htmlDepth === 0
          } else if (!isSelfClosing) {
            htmlDepth++
            canMatch = false
          }
        }
        inHTMLTag = true
        canMatch = false
      }
      lastChar = char
      pos++
      continue
    }

    // Handle escape, code, links, HTML tags
    if (char === '\\') {
      lastChar = pos + 1 < end ? source[pos + 1] : char
      pos += pos + 1 < end ? 2 : 1
      continue
    }
    if (char === '`') {
      canMatch = !(inCode = !inCode) && htmlDepth === 0
      lastChar = char
      pos++
      continue
    }
    if (char === '[') {
      var linkEnd = skipLinkOrImage(source, pos)
      if (linkEnd !== -1 && linkEnd <= end) {
        pos = linkEnd
        lastChar = source[linkEnd - 1]
        continue
      }
    }
    if (char === '<') {
      var tagEnd = source.indexOf('>', pos)
      if (tagEnd !== -1 && tagEnd < end) {
        var nextChar = pos + 1 < end ? source[pos + 1] : ''
        var tagEndChar = tagEnd - 1
        var isSelfClosing =
          tagEndChar >= pos &&
          source[tagEndChar] === '/' &&
          tagEndChar - 1 >= pos &&
          source[tagEndChar - 1] !== '='
        if (nextChar === '/') {
          htmlDepth = htmlDepth > 0 ? htmlDepth - 1 : 0
          canMatch = !inCode && htmlDepth === 0
        } else if (!isSelfClosing) {
          htmlDepth++
          canMatch = false
        }
      }
      inHTMLTag = true
      canMatch = false
      lastChar = char
      pos++
      continue
    }
    if (char === '\n' && lastChar === '\n') return null

    // Early exit: only check delimiter if char matches (most common case)
    if (char !== delimiterChar) {
      lastChar = char
      pos++
      continue
    }

    // Calculate delimiter run length
    var delimiterRunLength = 0
    var checkPos = pos
    while (
      checkPos < end &&
      checkPos - pos < MAX_DELIMITER_RUN &&
      source[checkPos] === delimiterChar
    ) {
      delimiterRunLength++
      checkPos++
    }

    // Skip long runs to avoid exponential behavior
    if (
      checkPos - pos >= MAX_DELIMITER_RUN &&
      checkPos < end &&
      source[checkPos] === delimiterChar
    ) {
      while (checkPos < end && source[checkPos] === delimiterChar) checkPos++
      pos = checkPos
      lastChar = delimiterChar
      continue
    }

    if (delimiterRunLength >= startLength) {
      // Simplified validation: single-char delimiters (*, _) need word boundary check
      var needsWordBoundary =
        startLength === 1 && (delimiterChar === '*' || delimiterChar === '_')
      if (
        !needsWordBoundary ||
        ((pos === start || source[pos - 1] !== delimiterChar) &&
          (pos + delimiterRunLength >= end ||
            source[pos + delimiterRunLength] !== delimiterChar))
      ) {
        var matchEnd = pos + delimiterRunLength
        var fullMatch = source.slice(start, matchEnd)
        var contentStr = source.slice(contentStart, pos)
        var result = [
          fullMatch,
          tag,
          contentStr + source.slice(pos + startLength, matchEnd),
        ] as unknown as RegExpMatchArray
        result.index = start
        result.input = source
        return result
      }
    }

    lastChar = char
    pos++
  }

  return null
}
