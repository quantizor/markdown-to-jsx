/**
 * Analogous to `node.type`. Please note that the values here may change at any time,
 * so do not hard code against the value directly.
 */
export const RuleType = {
  blockQuote: '0',
  breakLine: '1',
  breakThematic: '2',
  codeBlock: '3',
  codeFenced: '4',
  codeInline: '5',
  footnote: '6',
  footnoteReference: '7',
  gfmTask: '8',
  heading: '9',
  headingSetext: '10',
  htmlBlock: '11',
  htmlComment: '12',
  htmlSelfClosing: '13',
  image: '14',
  link: '15',
  linkAngleBraceStyleDetector: '16',
  linkBareUrlDetector: '17',
  linkMailtoDetector: '18',
  newlineCoalescer: '19',
  orderedList: '20',
  paragraph: '21',
  ref: '22',
  refImage: '23',
  refLink: '24',
  table: '25',
  tableSeparator: '26',
  text: '27',
  textEscaped: '28',
  textFormatted: '34',
  unorderedList: '30',
} as const

if (process.env.NODE_ENV === 'test') {
  Object.keys(RuleType).forEach(key => (RuleType[key] = key))
}

export type RuleType = (typeof RuleType)[keyof typeof RuleType]

const T = ['strong', 'em', 'del', 'mark']
const DELS = [
  ['**', T[0]],
  ['__', T[0]],
  ['~~', T[2]],
  ['==', T[3]],
  ['*', T[1]],
  ['_', T[1]],
]

function skipLinkOrImage(source, pos) {
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
  state?: { inline?: boolean; simple?: boolean }
): RegExpMatchArray | null {
  if (!state || (!state.inline && !state.simple)) return null

  var c = source[0]
  if (c !== '*' && c !== '_' && c !== '~' && c !== '=') return null

  var delimiter = ''
  var startLength = 0
  var tag = ''

  for (var i = 0; i < 6; i++) {
    var d = DELS[i][0]
    if (source.startsWith(d) && source.length >= d.length * 2) {
      delimiter = d
      startLength = d.length
      tag = DELS[i][1]
      break
    }
  }

  if (!delimiter) return null

  var pos = startLength
  var inCode = false
  var inHTMLTag = false
  var inHTMLQuote = ''
  var htmlDepth = 0
  var content = ''
  var lastWasEscape = false
  var lastChar = ''

  while (pos < source.length) {
    var char = source[pos]

    if (lastWasEscape) {
      content += char
      lastWasEscape = false
      lastChar = char
      pos++
      continue
    }

    if (char === '\\') {
      content += char
      lastWasEscape = true
      lastChar = char
      pos++
      continue
    }

    if (char === '`' && htmlDepth === 0) {
      inCode = !inCode
      content += char
      lastChar = char
      pos++
      continue
    }

    if (char === '[' && !inCode && htmlDepth === 0) {
      var linkEnd = skipLinkOrImage(source, pos)
      if (linkEnd !== -1) {
        content += source.slice(pos, linkEnd)
        pos = linkEnd
        lastChar = source[linkEnd - 1]
        continue
      }
    }

    if (inHTMLTag) {
      content += char
      if (inHTMLQuote) {
        if (char === inHTMLQuote) inHTMLQuote = ''
      } else if (char === '"' || char === "'") {
        inHTMLQuote = char
      } else if (char === '>') {
        inHTMLTag = false
      }
      lastChar = char
      pos++
      continue
    }

    if (char === '<' && !inCode) {
      var nextChar = source[pos + 1]
      var tagEnd = source.indexOf('>', pos)

      if (tagEnd !== -1) {
        var tagContent = source.slice(pos, tagEnd + 1)
        var isSelfClosing = tagContent.endsWith('/>')

        if (nextChar === '/') {
          htmlDepth = Math.max(0, htmlDepth - 1)
        } else if (!isSelfClosing) {
          htmlDepth++
        }
      }

      inHTMLTag = true
      content += char
      lastChar = char
      pos++
      continue
    }

    if (char === '\n' && lastChar === '\n' && !inCode && htmlDepth === 0) {
      return null
    }

    if (!inCode && htmlDepth === 0) {
      var delimiterRunLength = 0
      while (
        pos + delimiterRunLength < source.length &&
        source[pos + delimiterRunLength] === delimiter[0]
      ) {
        delimiterRunLength++
      }

      if (delimiterRunLength >= startLength) {
        if (
          startLength !== 1 ||
          (delimiter !== '*' && delimiter !== '_') ||
          (source[pos - 1] !== delimiter && source[pos + 1] !== delimiter)
        ) {
          var result = [
            source.slice(0, pos + delimiterRunLength),
            tag,
            content + source.slice(pos + startLength, pos + delimiterRunLength),
          ] as unknown as RegExpMatchArray
          result.index = 0
          result.input = source
          return result
        }
      }
    }

    content += char
    lastChar = char
    pos++
  }

  return null
}
