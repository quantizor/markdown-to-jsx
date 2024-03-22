/* @jsx h */
import * as React from 'react'

type Values<T> = T[keyof T]

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
  footer: '35',
  footnote: '6',
  footnoteReference: '7',
  gfmTask: '8',
  heading: '9',
  headingSetext: '10',
  /** only available if not `disableHTMLParsing` */
  htmlBlock: '11',
  htmlComment: '12',
  /** only available if not `disableHTMLParsing` */
  htmlSelfClosing: '13',
  image: '14',
  link: '15',
  /** emits a `link` 'node', does not render directly */
  linkAngleBraceStyleDetector: '16',
  /** emits a `link` 'node', does not render directly */
  linkBareUrlDetector: '17',
  /** emits a `link` 'node', does not render directly */
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
  textBolded: '28',
  textEmphasized: '29',
  textEscaped: '30',
  textFormatted: '34',
  textMarked: '31',
  textStrikethroughed: '32',
  unorderedList: '33',
} as const

// if (process.env.NODE_ENV !== 'production') {
//   Object.keys(RuleType).forEach(key => (RuleType[key] = key))
// }

export type RuleType = (typeof RuleType)[keyof typeof RuleType]

const enum Priority {
  /**
   * anything that must scan the tree before everything else
   */
  MAX,
  /**
   * scans for block-level constructs
   */
  HIGH,
  /**
   * inline w/ more priority than other inline
   */
  MED,
  /**
   * inline elements
   */
  LOW,
  /**
   * bare text and stuff that is considered leftovers
   */
  MIN,
}

const namedCodesToUnicode = {
  amp: '\u0026',
  apos: '\u0027',
  gt: '\u003e',
  lt: '\u003c',
  nbsp: '\u00a0',
  quot: '\u201c',
} as const

const DO_NOT_PROCESS_HTML_ELEMENTS = ['style', 'script']

/**
 * the attribute extractor regex looks for a valid attribute name,
 * followed by an equal sign (whitespace around the equal sign is allowed), followed
 * by one of the following:
 *
 * 1. a single quote-bounded string, e.g. 'foo'
 * 2. a double quote-bounded string, e.g. "bar"
 * 3. an interpolation, e.g. {something}
 *
 * JSX can be be interpolated into itself and is passed through the compiler using
 * the same options and setup as the current run.
 *
 * <Something children={<SomeOtherThing />} />
 *                      ==================
 *                              ↳ children: [<SomeOtherThing />]
 *
 * Otherwise, interpolations are handled as strings or simple booleans
 * unless HTML syntax is detected.
 *
 * <Something color={green} disabled={true} />
 *                   =====            ====
 *                     ↓                ↳ disabled: true
 *                     ↳ color: "green"
 *
 * Numbers are not parsed at this time due to complexities around int, float,
 * and the upcoming bigint functionality that would make handling it unwieldy.
 * Parse the string in your component as desired.
 *
 * <Something someBigNumber={123456789123456789} />
 *                           ==================
 *                                   ↳ someBigNumber: "123456789123456789"
 */
const ATTR_EXTRACTOR_R =
  /([-A-Z0-9_:]+)(?:\s*=\s*(?:(?:"((?:\\.|[^"])*)")|(?:'((?:\\.|[^'])*)')|(?:\{((?:\\.|{[^}]*?}|[^}])*)\})))?/gi

/** TODO: Write explainers for each of these */

const AUTOLINK_MAILTO_CHECK_R = /mailto:/i
const BLOCK_END_R = /\n{2,}$/
const BLOCKQUOTE_R = /^(\s*>[\s\S]*?)(?=\n\n|$)/
const BLOCKQUOTE_TRIM_LEFT_MULTILINE_R = /^ *> ?/gm
const BLOCKQUOTE_ALERT_R = /^(?:\[!([^\]]*)\]\n)?([\s\S]*)/
const BREAK_LINE_R = /^ {2,}\n/
const BREAK_THEMATIC_R = /^(?:( *[-*_])){3,} *(?:\n *)+\n/
const CODE_BLOCK_FENCED_R =
  /^(?: {1,3})?(`{3,}|~{3,}) *(\S+)? *([^\n]*?)?\n([\s\S]*?)(?:\1\n?|$)/
const CODE_BLOCK_R = /^(?: {4}[^\n]+\n*)+(?:\n *)+\n?/
const CODE_INLINE_R = /^(`+)\s*([\s\S]*?[^`])\s*\1(?!`)/
const CONSECUTIVE_NEWLINE_R = /^(?:\n *)*\n/
const CR_NEWLINE_R = /\r\n?/g

/**
 * Matches footnotes on the format:
 *
 * [^key]: value
 *
 * Matches multiline footnotes
 *
 * [^key]: row
 * row
 * row
 *
 * And empty lines in indented multiline footnotes
 *
 * [^key]: indented with
 *     row
 *
 *     row
 *
 * Explanation:
 *
 * 1. Look for the starting tag, eg: [^key]
 *    ^\[\^([^\]]+)]
 *
 * 2. The first line starts with a colon, and continues for the rest of the line
 *   :(.*)
 *
 * 3. Parse as many additional lines as possible. Matches new non-empty lines that doesn't begin with a new footnote definition.
 *    (\n(?!\[\^).+)
 *
 * 4. ...or allows for repeated newlines if the next line begins with at least four whitespaces.
 *    (\n+ {4,}.*)
 */
const FOOTNOTE_R = /^\[\^([^\]]+)](:(.*)((\n+ {4,}.*)|(\n(?!\[\^).+))*)/

const FOOTNOTE_REFERENCE_R = /^\[\^([^\]]+)]/
const FORMFEED_R = /\f/g
const FRONT_MATTER_R = /^---[ \t]*\n(.|\n)*\n---[ \t]*\n/
const GFM_TASK_R = /^\s*?\[(x|\s)\]/
const HEADING_R = /^ *(#{1,6}) *([^\n]+?)(?: +#*)?(?:\n *)*(?:\n|$)/
const HEADING_ATX_COMPLIANT_R =
  /^ *(#{1,6}) +([^\n]+?)(?: +#*)?(?:\n *)*(?:\n|$)/
const HEADING_SETEXT_R = /^([^\n]+)\n *(=|-){3,} *(?:\n *)+\n/

/**
 * Explanation:
 *
 * 1. Look for a starting tag, preceded by any amount of spaces
 *    ^ *<
 *
 * 2. Capture the tag name (capture 1)
 *    ([^ >/]+)
 *
 * 3. Ignore a space after the starting tag and capture the attribute portion of the tag (capture 2)
 *     ?([^>]*)>
 *
 * 4. Ensure a matching closing tag is present in the rest of the input string
 *    (?=[\s\S]*<\/\1>)
 *
 * 5. Capture everything until the matching closing tag -- this might include additional pairs
 *    of the same tag type found in step 2 (capture 3)
 *    ((?:[\s\S]*?(?:<\1[^>]*>[\s\S]*?<\/\1>)*[\s\S]*?)*?)<\/\1>
 *
 * 6. Capture excess newlines afterward
 *    \n*
 */
const HTML_BLOCK_ELEMENT_R =
  /^ *(?!<[a-z][^ >/]* ?\/>)<([a-z][^ >/]*) ?((?:[^>]*[^/])?)>\n?(\s*(?:<\1[^>]*?>[\s\S]*?<\/\1>|(?!<\1\b)[\s\S])*?)<\/\1>(?!<\/\1>)\n*/i

const HTML_CHAR_CODE_R = /&([a-z0-9]+|#[0-9]{1,6}|#x[0-9a-fA-F]{1,6});/gi

const HTML_COMMENT_R = /^<!--[\s\S]*?(?:-->)/
const HTML_SELF_CLOSING_ELEMENT_R =
  /^ *<([a-z][a-z0-9:]*)(?:\s+((?:<.*?>|[^>])*))?\/?>(?!<\/\1>)(\s*\n)?/i
const INTERPOLATION_R = /^\{.*\}$/
const LINK_AUTOLINK_BARE_URL_R = /^(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/
const LINK_AUTOLINK_MAILTO_R = /^<([^ >]+@[^ >]+)>/
const LINK_AUTOLINK_R = /^<([^ >]+:\/[^ >]+)>/
const NP_TABLE_R = /^(\|.*)\n(?: *(\|? *[-:]+ *\|[-| :]*)\n((?:.*\|.*\n)*))?\n?/
const PARAGRAPH_R = /^[^\n]+(?:  \n|\n{2,})/
const REFERENCE_IMAGE_OR_LINK = /^\[([^\]]*)\]:\s+<?([^\s>]+)>?\s*("([^"]*)")?/
const REFERENCE_IMAGE_R = /^!\[([^\]]*)\] ?\[([^\]]*)\]/
const REFERENCE_LINK_R = /^\[([^\]]*)\] ?\[([^\]]*)\]/
const SHOULD_RENDER_AS_BLOCK_R = /(\n|^[-*]\s|^#|^ {2,}|^-{2,}|^>\s)/
const TAB_R = /\t/g
const TABLE_TRIM_PIPES = /(^ *\||\| *$)/g
const TABLE_CENTER_ALIGN = /^ *:-+: *$/
const TABLE_LEFT_ALIGN = /^ *:-+ *$/
const TABLE_RIGHT_ALIGN = /^ *-+: *$/

// https://regexr.com/7u91c
const INLINE_FORMATTING_R =
  /^(([*_])\2|[*_]|~~|==)((?:\[.*?\][([].*?[)\]]|<.*?>(?:.*?<.*?>)?|([*_]+|`|~~|==)[\s\S]+?\4|[\s\S])+?)\1/

const TEXT_ESCAPED_R = /^\\([^0-9A-Za-z\s])/

const TEXT_PLAIN_R =
  /^[\s\S]+?(?=[^0-9A-Z\s\u00c0-\uffff&#;.()'"]|\d+\.|\n\n| {2,}\n|\w+:\S|$)/i

const TRIM_STARTING_NEWLINES = /^\n+/

const HTML_LEFT_TRIM_AMOUNT_R = /^([ \t]*)/

const UNESCAPE_URL_R = /\\([^\\])/g

type LIST_TYPE = 1 | 2
const ORDERED: LIST_TYPE = 1
const UNORDERED: LIST_TYPE = 2

const LIST_ITEM_END_R = / *\n+$/
const LIST_LOOKBEHIND_R = /(?:^|\n)( *)$/

// recognize a `*` `-`, `+`, `1.`, `2.`... list bullet
const ORDERED_LIST_BULLET = '(?:\\d+\\.)'
const UNORDERED_LIST_BULLET = '(?:[*+-])'

function generateListItemPrefix(type: LIST_TYPE) {
  return (
    '( *)(' +
    (type === ORDERED ? ORDERED_LIST_BULLET : UNORDERED_LIST_BULLET) +
    ') +'
  )
}

// recognize the start of a list item:
// leading space plus a bullet plus a space (`   * `)
const ORDERED_LIST_ITEM_PREFIX = generateListItemPrefix(ORDERED)
const UNORDERED_LIST_ITEM_PREFIX = generateListItemPrefix(UNORDERED)

function generateListItemPrefixRegex(type: LIST_TYPE) {
  return new RegExp(
    '^' +
      (type === ORDERED ? ORDERED_LIST_ITEM_PREFIX : UNORDERED_LIST_ITEM_PREFIX)
  )
}

const ORDERED_LIST_ITEM_PREFIX_R = generateListItemPrefixRegex(ORDERED)
const UNORDERED_LIST_ITEM_PREFIX_R = generateListItemPrefixRegex(UNORDERED)

function generateListItemRegex(type: LIST_TYPE) {
  // recognize an individual list item:
  //  * hi
  //    this is part of the same item
  //
  //    as is this, which is a new paragraph in the same item
  //
  //  * but this is not part of the same item
  return new RegExp(
    '^' +
      (type === ORDERED
        ? ORDERED_LIST_ITEM_PREFIX
        : UNORDERED_LIST_ITEM_PREFIX) +
      '[^\\n]*(?:\\n' +
      '(?!\\1' +
      (type === ORDERED ? ORDERED_LIST_BULLET : UNORDERED_LIST_BULLET) +
      ' )[^\\n]*)*(\\n|$)',
    'gm'
  )
}

const ORDERED_LIST_ITEM_R = generateListItemRegex(ORDERED)
const UNORDERED_LIST_ITEM_R = generateListItemRegex(UNORDERED)

// check whether a list item has paragraphs: if it does,
// we leave the newlines at the end
function generateListRegex(type: LIST_TYPE) {
  const bullet = type === ORDERED ? ORDERED_LIST_BULLET : UNORDERED_LIST_BULLET

  return new RegExp(
    '^( *)(' +
      bullet +
      ') ' +
      '[\\s\\S]+?(?:\\n{2,}(?! )' +
      '(?!\\1' +
      bullet +
      ' (?!' +
      bullet +
      ' ))\\n*' +
      // the \\s*$ here is so that we can parse the inside of nested
      // lists, where our content might end before we receive two `\n`s
      '|\\s*\\n*$)'
  )
}

const ORDERED_LIST_R = generateListRegex(ORDERED)
const UNORDERED_LIST_R = generateListRegex(UNORDERED)

function generateListRule(
  type: LIST_TYPE
): MarkdownToJSX.Rule<
  MarkdownToJSX.OrderedListNode | MarkdownToJSX.UnorderedListNode
> {
  const ordered = type === ORDERED
  const LIST_R = ordered ? ORDERED_LIST_R : UNORDERED_LIST_R
  const LIST_ITEM_R = ordered ? ORDERED_LIST_ITEM_R : UNORDERED_LIST_ITEM_R
  const LIST_ITEM_PREFIX_R = ordered
    ? ORDERED_LIST_ITEM_PREFIX_R
    : UNORDERED_LIST_ITEM_PREFIX_R

  return {
    match(source, context) {
      // We only want to break into a list if we are at the start of a
      // line. This is to avoid parsing "hi * there" with "* there"
      // becoming a part of a list.
      // You might wonder, "but that's inline, so of course it wouldn't
      // start a list?". You would be correct! Except that some of our
      // lists can be inline, because they might be inside another list,
      // in which case we can parse with inline scope, but need to allow
      // nested lists inside this inline scope.
      const isStartOfLine = LIST_LOOKBEHIND_R.exec(context.prevCapture)
      const isListBlock = context.list || (!context.inline && !context.simple)

      if (isStartOfLine && isListBlock) {
        source = isStartOfLine[1] + source

        return LIST_R.exec(source)
      } else {
        return null
      }
    },
    order: Priority.HIGH,
    parse(capture, parse, context) {
      const bullet = capture[2]
      const start = ordered ? +bullet : undefined
      const items = capture[0]
        // recognize the end of a paragraph block inside a list item:
        // two or more newlines at end end of the item
        .replace(BLOCK_END_R, '\n')
        .match(LIST_ITEM_R)

      let lastItemWasAParagraph = false
      const itemContent = items.map(function (item, i) {
        // We need to see how far indented the item is:
        const space = LIST_ITEM_PREFIX_R.exec(item)[0].length

        // And then we construct a regex to "unindent" the subsequent
        // lines of the items by that amount:
        const spaceRegex = new RegExp('^ {1,' + space + '}', 'gm')

        // Before processing the item, we need a couple things
        const content = item
          // remove indents on trailing lines:
          .replace(spaceRegex, '')
          // remove the bullet:
          .replace(LIST_ITEM_PREFIX_R, '')

        // Handling "loose" lists, like:
        //
        //  * this is wrapped in a paragraph
        //
        //  * as is this
        //
        //  * as is this
        const isLastItem = i === items.length - 1
        const containsBlocks = content.indexOf('\n\n') !== -1

        // Any element in a list is a block if it contains multiple
        // newlines. The last element in the list can also be a block
        // if the previous item in the list was a block (this is
        // because non-last items in the list can end with \n\n, but
        // the last item can't, so we just "inherit" this property
        // from our previous element).
        const thisItemIsAParagraph =
          containsBlocks || (isLastItem && lastItemWasAParagraph)
        lastItemWasAParagraph = thisItemIsAParagraph

        // backup our state for restoration afterwards. We're going to
        // want to set context.list to true, and context.inline depending
        // on our list's looseness.
        const oldStateInline = context.inline
        const oldStateList = context.list
        context.list = true

        // Parse inline if we're in a tight list, or block if we're in
        // a loose list.
        let adjustedContent
        if (thisItemIsAParagraph) {
          context.inline = false
          adjustedContent = content.replace(LIST_ITEM_END_R, '\n\n')
        } else {
          context.inline = true
          adjustedContent = content.replace(LIST_ITEM_END_R, '')
        }

        const result = parse(adjustedContent, context)

        // Restore our state before returning
        context.inline = oldStateInline
        context.list = oldStateList

        return result
      })

      return {
        items: itemContent,
        ordered: ordered,
        start: start,
      }
    },
  }
}

const LINK_INSIDE = '(?:\\[[^\\]]*\\]|[^\\[\\]]|\\](?=[^\\[]*\\]))*'
const LINK_HREF_AND_TITLE =
  '\\s*<?((?:\\([^)]*\\)|[^\\s\\\\]|\\\\.)*?)>?(?:\\s+[\'"]([\\s\\S]*?)[\'"])?\\s*'
const LINK_R = new RegExp(
  '^\\[(' + LINK_INSIDE + ')\\]\\(' + LINK_HREF_AND_TITLE + '\\)'
)
const IMAGE_R = /^!\[(.*?)\]\( *((?:\([^)]*\)|[^() ])*) *"?([^)"]*)?"?\)/

const NON_PARAGRAPH_BLOCK_SYNTAXES = [
  BLOCKQUOTE_R,
  CODE_BLOCK_FENCED_R,
  CODE_BLOCK_R,
  HEADING_R,
  HEADING_SETEXT_R,
  HEADING_ATX_COMPLIANT_R,
  HTML_COMMENT_R,
  NP_TABLE_R,
  ORDERED_LIST_ITEM_R,
  ORDERED_LIST_R,
  UNORDERED_LIST_ITEM_R,
  UNORDERED_LIST_R,
]

const BLOCK_SYNTAXES = [
  ...NON_PARAGRAPH_BLOCK_SYNTAXES,
  PARAGRAPH_R,
  HTML_BLOCK_ELEMENT_R,
  HTML_SELF_CLOSING_ELEMENT_R,
]

function containsBlockSyntax(input: string) {
  return BLOCK_SYNTAXES.some(r => r.test(input))
}

/** Remove symmetrical leading and trailing quotes */
function unquote(str: string) {
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

// based on https://stackoverflow.com/a/18123682/1141611
// not complete, but probably good enough
export function slugify(str: string) {
  return str
    .replace(/[ÀÁÂÃÄÅàáâãäåæÆ]/g, 'a')
    .replace(/[çÇ]/g, 'c')
    .replace(/[ðÐ]/g, 'd')
    .replace(/[ÈÉÊËéèêë]/g, 'e')
    .replace(/[ÏïÎîÍíÌì]/g, 'i')
    .replace(/[Ññ]/g, 'n')
    .replace(/[øØœŒÕõÔôÓóÒò]/g, 'o')
    .replace(/[ÜüÛûÚúÙù]/g, 'u')
    .replace(/[ŸÿÝý]/g, 'y')
    .replace(/[^a-z0-9- ]/gi, '')
    .replace(/ /gi, '-')
    .toLowerCase()
}

function parseTableAlignCapture(alignCapture: string) {
  if (TABLE_RIGHT_ALIGN.test(alignCapture)) {
    return 'right'
  } else if (TABLE_CENTER_ALIGN.test(alignCapture)) {
    return 'center'
  } else if (TABLE_LEFT_ALIGN.test(alignCapture)) {
    return 'left'
  }

  return null
}

function parseTableRow(
  source: string,
  parse: MarkdownToJSX.NestedParser,
  context: MarkdownToJSX.Context,
  tableOutput: boolean
): MarkdownToJSX.ParserResult[][] {
  const prevInTable = context.inTable

  context.inTable = true

  let cells: MarkdownToJSX.ParserResult[][] = [[]]
  let acc = ''

  function flush() {
    if (!acc) return

    const cell = cells[cells.length - 1]
    cell.push.apply(cell, parse(acc, context))
    acc = ''
  }

  source
    .trim()
    // isolate situations where a pipe should be ignored (inline code, escaped, etc)
    .split(/(`[^`]*`|\\\||\|)/)
    .filter(Boolean)
    .forEach((fragment, i, arr) => {
      if (fragment.trim() === '|') {
        flush()

        if (tableOutput) {
          if (i !== 0 && i !== arr.length - 1) {
            // Split the current row
            cells.push([])
          }

          return
        }
      }

      acc += fragment
    })

  flush()

  context.inTable = prevInTable

  return cells
}

function parseTableAlign(source: string /*, parse, context*/) {
  const alignText = source.replace(TABLE_TRIM_PIPES, '').split('|')

  return alignText.map(parseTableAlignCapture)
}

function parseTableCells(
  source: string,
  parse: MarkdownToJSX.NestedParser,
  context: MarkdownToJSX.Context
) {
  const rowsText = source.trim().split('\n')

  return rowsText.map(function (rowText) {
    return parseTableRow(rowText, parse, context, true)
  })
}

function parseTable(
  capture: RegExpMatchArray,
  parse: MarkdownToJSX.NestedParser,
  context: MarkdownToJSX.Context
) {
  context.inline = true
  const align = parseTableAlign(capture[2])
  const cells = parseTableCells(capture[3], parse, context)
  const header = parseTableRow(capture[1], parse, context, !!cells.length)
  context.inline = false

  return cells.length
    ? {
        align: align,
        cells: cells,
        header: header,
        type: RuleType.table,
      }
    : {
        children: header,
        type: RuleType.paragraph,
      }
}

function getTableStyle(node, colIndex) {
  return node.align[colIndex] == null
    ? {}
    : {
        textAlign: node.align[colIndex],
      }
}

function attributeValueToJSXPropValue(
  tag: MarkdownToJSX.HTMLTags,
  key: keyof React.AllHTMLAttributes<Element>,
  value: string,
  sanitizeUrlFn: MarkdownToJSX.Options['sanitizer']
): any {
  if (key === 'style') {
    return value.split(/;\s?/).reduce(function (styles, kvPair) {
      const key = kvPair.slice(0, kvPair.indexOf(':'))

      // snake-case to camelCase
      // also handles PascalCasing vendor prefixes
      const camelCasedKey = key
        .trim()
        .replace(/(-[a-z])/g, substr => substr[1].toUpperCase())

      // key.length + 1 to skip over the colon
      styles[camelCasedKey] = kvPair.slice(key.length + 1).trim()

      return styles
    }, {})
  } else if (key === 'href' || key === 'src') {
    return sanitizeUrlFn(value, tag, key)
  } else if (value.match(INTERPOLATION_R)) {
    // return as a string and let the consumer decide what to do with it
    value = value.slice(1, value.length - 1)
  }

  if (value === 'true') {
    return true
  } else if (value === 'false') {
    return false
  }

  return value
}

function attrStringToMap(
  tag: MarkdownToJSX.HTMLTags,
  str: string,
  options: MarkdownToJSX.Options
): React.JSX.IntrinsicAttributes {
  const attributes = str.match(ATTR_EXTRACTOR_R)
  if (!attributes) {
    return null
  }

  return attributes.reduce(function (map, raw) {
    const delimiterIdx = raw.indexOf('=')

    if (delimiterIdx !== -1) {
      const key = raw
        .slice(0, delimiterIdx)
        .trim() as keyof React.AllHTMLAttributes<Element>
      const value = unquote(raw.slice(delimiterIdx + 1).trim())

      if (map[key] === 'ref') return map

      map[key] = attributeValueToJSXPropValue(
        tag,
        key,
        value,
        options.sanitizer
      )
    } else if (raw !== 'style') {
      map[raw] = true
    }

    return map
  }, {})
}

function normalizeWhitespace(source: string): string {
  return source
    .replace(CR_NEWLINE_R, '\n')
    .replace(FORMFEED_R, '')
    .replace(TAB_R, '    ')
}

/**
 * Creates a parser for a given set of rules, with the precedence
 * specified as a list of rules.
 *
 * @rules: an object containing
 * rule type -> {match, order, parse} objects
 * (lower order is higher precedence)
 * (Note: `order` is added to defaultRules after creation so that
 *  the `order` of defaultRules in the source matches the `order`
 *  of defaultRules in terms of `order` fields.)
 *
 * @returns The resulting parse function, with the following parameters:
 *   @source: the input source string to be parsed
 *   @state: an optional object to be threaded through parse
 *     calls. Allows clients to add stateful operations to
 *     parsing, such as keeping track of how many levels deep
 *     some nesting is. For an example use-case, see passage-ref
 *     parsing in src/widgets/passage/passage-markdown.jsx
 */
function parserFor(
  rules: [key: Values<typeof RuleType>, rule: MarkdownToJSX.Rule][],
  options: MarkdownToJSX.Options
): (
  source: string,
  context: MarkdownToJSX.Context
) => ReturnType<MarkdownToJSX.NestedParser> {
  // Sorts rules in order of increasing order, then
  // ascending rule name in case of ties.
  if (process.env.NODE_ENV !== 'production') {
    rules.forEach(function (ruleDef) {
      const [type, { order }] = ruleDef

      if (
        process.env.NODE_ENV !== 'production' &&
        (typeof order !== 'number' || !isFinite(order))
      ) {
        console.warn(
          'markdown-to-jsx: Invalid order for rule `' + type + '`: ' + order
        )
      }
    })
  }

  const filteredRules = rules.filter(function (tuple) {
    return tuple[0] === RuleType.text
      ? true
      : options.enabledRules.length
      ? options.enabledRules.indexOf(tuple[0]) !== -1
      : options.disabledRules!.indexOf(tuple[0]) === -1
  })

  filteredRules.sort(function (tupleA, tupleB) {
    const orderA = tupleA[1].order
    const orderB = tupleB[1].order

    // Sort based on increasing order
    if (orderA !== orderB) {
      return orderA - orderB
    } else if (tupleA[0] < tupleB[0]) {
      return -1
    }

    return 1
  })

  function nestedParse(
    source: string,
    context: MarkdownToJSX.Context
  ): MarkdownToJSX.ParserResult[] {
    let result = []

    context.prevCapture = context.prevCapture || ''

    // We store the previous capture so that match functions can
    // use some limited amount of lookbehind. Lists use this to
    // ensure they don't match arbitrary '- ' or '* ' in inline
    // text (see the list rule for more information).
    while (source) {
      let i = 0
      while (i < filteredRules.length) {
        const [ruleType, rule] = filteredRules[i]
        const capture = rule.match(source, context)

        if (capture) {
          const currCaptureString = capture[0]

          // retain what's been processed so far for lookbacks
          context.prevCapture += currCaptureString

          source = source.substring(currCaptureString.length)

          const parsed = rule.parse(capture, nestedParse, context)

          // We also let rules override the default type of
          // their parsed node if they would like to, so that
          // there can be a single output function for all links,
          // even if there are several rules to parse them.
          if (parsed.type == null) {
            parsed.type = ruleType
          }

          result.push(parsed)

          break
        }

        i++
      }
    }

    context.prevCapture = ''

    return result
  }

  return function outerParse(source, context) {
    return nestedParse(normalizeWhitespace(source), context)
  }
}

// Creates a match function for an inline scoped or simple element from a regex
function inlineRegex(regex: RegExp) {
  return function match(source, context: MarkdownToJSX.Context) {
    if (context.inline) {
      return regex.exec(source)
    } else {
      return null
    }
  }
}

// basically any inline element except links
export function simpleInlineRegex(regex: RegExp) {
  return function match(source: string, context: MarkdownToJSX.Context) {
    if (context.inline || context.simple) {
      return regex.exec(source)
    } else {
      return null
    }
  }
}

// Creates a match function for a block scoped element from a regex
export function blockRegex(regex: RegExp) {
  return function match(source: string, context: MarkdownToJSX.Context) {
    if (context.inline || context.simple) {
      return null
    } else {
      return regex.exec(source)
    }
  }
}

// Creates a match function from a regex, ignoring block/inline scope
export function anyScopeRegex(regex: RegExp) {
  return function match(source: string /*, context*/) {
    return regex.exec(source)
  }
}

function matchParagraph(source: string, context: MarkdownToJSX.Context) {
  if (context.inline || context.simple) {
    return null
  }

  let match = ''

  source.split('\n').every(line => {
    line += '\n'

    // bail out on first sign of non-paragraph block
    if (NON_PARAGRAPH_BLOCK_SYNTAXES.some(regex => regex.test(line))) {
      return false
    }

    match += line

    return !!line.trim()
  })

  const captured = match.trimEnd()
  if (captured == '') {
    return null
  }

  return [match, captured]
}

function sanitizer(url: string): string {
  try {
    const decoded = decodeURIComponent(url).replace(/[^A-Za-z0-9/:]/g, '')

    if (decoded.match(/^\s*(javascript|vbscript|data(?!:image)):/i)) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          'Anchor URL contains an unsafe JavaScript/VBScript/data expression, it will not be rendered.',
          decoded
        )
      }

      return null
    }
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        'Anchor URL could not be decoded due to malformed syntax or characters, it will not be rendered.',
        url
      )
    }

    // decodeURIComponent sometimes throws a URIError
    // See `decodeURIComponent('a%AFc');`
    // http://stackoverflow.com/questions/9064536/javascript-decodeuricomponent-malformed-uri-exception
    return null
  }

  return url
}

function unescapeUrl(rawUrlString: string): string {
  return rawUrlString.replace(UNESCAPE_URL_R, '$1')
}

/**
 * Everything inline, including links.
 */
function parseInline(
  parse: MarkdownToJSX.NestedParser,
  children: string,
  context: MarkdownToJSX.Context
): MarkdownToJSX.ParserResult[] {
  const isCurrentlyInline = context.inline || false
  const isCurrentlySimple = context.simple || false
  context.inline = true
  context.simple = true
  const result = parse(children, context)
  context.inline = isCurrentlyInline
  context.simple = isCurrentlySimple
  return result
}

/**
 * Anything inline that isn't a link.
 */
function parseSimpleInline(
  parse: MarkdownToJSX.NestedParser,
  children: string,
  context: MarkdownToJSX.Context
): MarkdownToJSX.ParserResult[] {
  const isCurrentlyInline = context.inline || false
  const isCurrentlySimple = context.simple || false
  context.inline = false
  context.simple = true
  const result = parse(children, context)
  context.inline = isCurrentlyInline
  context.simple = isCurrentlySimple
  return result
}

function parseBlock(
  parse,
  children,
  context: MarkdownToJSX.Context
): MarkdownToJSX.ParserResult[] {
  context.inline = false
  return parse(children, context)
}

const parseCaptureInline: MarkdownToJSX.Parser<{
  children: MarkdownToJSX.ParserResult[]
}> = (capture, parse, context: MarkdownToJSX.Context) => {
  return {
    children: parseInline(parse, capture[1], context),
  }
}

function captureNothing() {
  return {}
}

function cx(...args) {
  return args.filter(Boolean).join(' ')
}

function get(src: Object, path: string, fb?: any) {
  let ptr = src
  const frags = path.split('.')

  while (frags.length) {
    ptr = ptr[frags[0]]

    if (ptr === undefined) break
    else frags.shift()
  }

  return ptr || fb
}

function getTag(tag: string, overrides: MarkdownToJSX.Overrides) {
  const override = get(overrides, tag)

  if (!override) return tag

  return typeof override === 'function' ||
    (typeof override === 'object' && 'render' in override)
    ? override
    : get(overrides, `${tag}.component`, tag)
}

function reactOutput(
  options: MarkdownToJSX.Options,
  compiler: (input: string) => React.ReactNode
) {
  const createElementFn = options.createElement || React.createElement

  // JSX custom pragma
  // eslint-disable-next-line no-unused-vars
  function h(
    // locally we always will render a known string tag
    tag: MarkdownToJSX.HTMLTags,
    props: Parameters<MarkdownToJSX.CreateElement>[1] & {
      className?: string
      id?: string
    },
    ...children
  ) {
    const overrideProps = get(options.overrides, `${tag}.props`, {})

    return createElementFn(
      getTag(tag, options.overrides),
      {
        ...props,
        ...overrideProps,
        className: cx(props?.className, overrideProps.className) || undefined,
      },
      ...children
    )
  }

  function finalizeAttrs(attrs: React.JSX.IntrinsicAttributes) {
    for (const key in attrs) {
      if (
        typeof attrs[key] === 'string' &&
        (HTML_BLOCK_ELEMENT_R.test(attrs[key]) ||
          HTML_SELF_CLOSING_ELEMENT_R.test(attrs[key]))
      ) {
        attrs[key] = compiler(attrs[key].trim())
      }
    }

    return attrs
  }

  return function (
    node: MarkdownToJSX.ParserResult,
    /**
     * Continue rendering AST nodes if applicable.
     */
    output: MarkdownToJSX.RuleOutput,
    context?: MarkdownToJSX.Context
  ): React.ReactNode {
    switch (node.type) {
      case RuleType.blockQuote: {
        let className

        if (node.alert) {
          className =
            'markdown-alert-' +
            options.slugify(node.alert.toLowerCase(), slugify)

          node.children.unshift({
            attrs: {},
            children: [{ type: RuleType.text, text: node.alert }],
            noInnerParse: true,
            type: RuleType.htmlBlock,
            tag: 'header',
          })
        }

        return (
          <blockquote key={context.key} className={className}>
            {output(node.children, context)}
          </blockquote>
        )
      }

      case RuleType.breakLine: {
        return <br key={context.key} />
      }

      case RuleType.breakThematic: {
        return <hr key={context.key} />
      }

      case RuleType.codeBlock: {
        return (
          <pre key={context.key}>
            <code
              {...node.attrs}
              className={node.lang ? `lang-${node.lang}` : ''}
            >
              {node.text}
            </code>
          </pre>
        )
      }

      case RuleType.codeInline: {
        return <code key={context.key}>{node.text}</code>
      }

      case RuleType.footer: {
        return (
          <footer key="footer">
            {context.footnotes.map(function createFootnote(def) {
              return (
                <div
                  id={options.slugify(def.identifier, slugify)}
                  key={def.identifier}
                >
                  {def.identifier}
                  {output(def.footnote, {
                    inline: true,
                  } as MarkdownToJSX.Context)}
                </div>
              )
            })}
          </footer>
        )
      }

      case RuleType.footnoteReference: {
        return (
          <a key={context.key} href={sanitizer(node.target)}>
            <sup key={context.key}>{node.text}</sup>
          </a>
        )
      }

      case RuleType.gfmTask: {
        return (
          <input
            checked={node.completed}
            key={context.key}
            readOnly
            type="checkbox"
          />
        )
      }

      case RuleType.heading: {
        return h(
          `h${node.level}`,
          { id: node.id, key: context.key },
          output(node.children, context)
        )
      }

      case RuleType.htmlBlock: {
        return (
          <node.tag key={context.key} {...finalizeAttrs(node.attrs)}>
            {node.text || (node.children ? output(node.children, context) : '')}
          </node.tag>
        )
      }

      case RuleType.htmlSelfClosing: {
        return <node.tag {...finalizeAttrs(node.attrs)} key={context.key} />
      }

      case RuleType.image: {
        return (
          <img
            key={context.key}
            alt={node.alt || undefined}
            title={node.title || undefined}
            src={sanitizer(node.target)}
          />
        )
      }

      case RuleType.link: {
        return (
          <a key={context.key} href={sanitizer(node.target)} title={node.title}>
            {output(node.children, context)}
          </a>
        )
      }

      case RuleType.orderedList:
      case RuleType.unorderedList: {
        const Tag = node.ordered ? 'ol' : 'ul'

        return (
          <Tag
            key={context.key}
            start={node.type === RuleType.orderedList ? node.start : undefined}
          >
            {node.items.map(function generateListItem(item, i) {
              return <li key={i}>{output(item, context)}</li>
            })}
          </Tag>
        )
      }

      case RuleType.newlineCoalescer: {
        return '\n'
      }

      case RuleType.paragraph: {
        return <p key={context.key}>{output(node.children, context)}</p>
      }

      case RuleType.refImage: {
        return context.refs[node.ref] ? (
          <img
            key={context.key}
            alt={node.alt}
            src={sanitizer(context.refs[node.ref].target)}
            title={context.refs[node.ref].title}
          />
        ) : null
      }

      case RuleType.refLink: {
        return context.refs[node.ref] ? (
          <a
            key={context.key}
            href={sanitizer(context.refs[node.ref].target)}
            title={context.refs[node.ref].title}
          >
            {output(node.children, context)}
          </a>
        ) : (
          <span key={context.key}>{node.fallbackChildren}</span>
        )
      }

      case RuleType.table: {
        return (
          <table key={context.key}>
            <thead>
              <tr>
                {node.header.map(function generateHeaderCell(content, i) {
                  return (
                    <th key={i} style={getTableStyle(node, i)}>
                      {output(content, context)}
                    </th>
                  )
                })}
              </tr>
            </thead>

            <tbody>
              {node.cells.map(function generateTableRow(row, i) {
                return (
                  <tr key={i}>
                    {row.map(function generateTableCell(content, c) {
                      return (
                        <td key={c} style={getTableStyle(node, c)}>
                          {output(content, context)}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )
      }

      case RuleType.text: {
        return node.text
      }

      case RuleType.textBolded: {
        return (
          <strong key={context.key}>{output(node.children, context)}</strong>
        )
      }

      case RuleType.textEmphasized: {
        return <em key={context.key}>{output(node.children, context)}</em>
      }

      case RuleType.textMarked: {
        return <mark key={context.key}>{output(node.children, context)}</mark>
      }

      case RuleType.textStrikethroughed: {
        return <del key={context.key}>{output(node.children, context)}</del>
      }

      default: {
        return null
      }
    }
  }
}

function createRenderer(
  options: MarkdownToJSX.Options,
  compiler: (input: string) => React.ReactNode | React.ReactNode[]
) {
  return function renderRule(
    ast: MarkdownToJSX.ParserResult,
    render: MarkdownToJSX.RuleOutput,
    context: MarkdownToJSX.Context
  ): React.ReactNode {
    const renderer = reactOutput(options, compiler)

    return options.renderRule
      ? options.renderRule(
          () => renderer(ast, render, context),
          ast,
          render,
          context
        )
      : renderer(ast, render, context)
  }
}

function reactFor(render: ReturnType<typeof createRenderer>) {
  function patchedRender(
    ast: MarkdownToJSX.ParserResult,
    context: MarkdownToJSX.Context
  ): React.ReactNode
  function patchedRender(
    ast: MarkdownToJSX.ParserResult[],
    context: MarkdownToJSX.Context
  ): React.ReactNode[]
  function patchedRender(
    ast: MarkdownToJSX.ParserResult | MarkdownToJSX.ParserResult[],
    context: MarkdownToJSX.Context
  ): React.ReactNode[] | React.ReactNode {
    if (Array.isArray(ast)) {
      const oldKey = context.key
      const result: React.ReactNode[] = []

      // map nestedOutput over the ast, except group any text
      // nodes together into a single string output.
      let lastWasString = false

      for (let i = 0; i < ast.length; i++) {
        context.key = i

        const nodeOut = patchedRender(ast[i], context)
        const isString = typeof nodeOut === 'string'

        if (isString && lastWasString) {
          result[result.length - 1] += nodeOut
        } else if (nodeOut !== null) {
          result.push(nodeOut)
        }

        lastWasString = isString
      }

      context.key = oldKey

      return result
    }

    return render(ast, patchedRender, context)
  }

  return patchedRender
}

/**
 * Use `createMarkdown` to gain separate access to the parser and/or compiler. This allows
 * you to consume markdown-to-jsx's AST nodes and implement your own completely custom
 * compiler scheme if desired. See the `MarkdownToJSX.ParserResult` type for all potential
 * AST nodes.
 */
export function createMarkdown(options: MarkdownToJSX.Options = {}) {
  options.customRules ||= []
  options.disabledRules ||= []
  options.enabledRules ||= []
  options.overrides ||= {}
  options.sanitizer ||= sanitizer
  options.slugify ||= slugify
  options.namedCodesToUnicode = options.namedCodesToUnicode
    ? { ...namedCodesToUnicode, ...options.namedCodesToUnicode }
    : namedCodesToUnicode

  if (process.env.NODE_ENV !== 'production') {
    if (
      Object.prototype.toString.call(options.overrides) !== '[object Object]'
    ) {
      throw new Error(`markdown-to-jsx: options.overrides (second argument property) must be
                               undefined or an object literal with shape:
                               {
                                  htmltagname: {
                                      component: string|ReactComponent(optional),
                                      props: object(optional)
                                  }
                               }`)
    }
  }

  function isInline(input: string): boolean {
    let inline = false

    if (options.forceInline) {
      inline = true
    } else if (!options.forceBlock) {
      /**
       * should not contain any block-level markdown like newlines, lists, headings,
       * thematic breaks, blockquotes, tables, etc
       */
      inline = SHOULD_RENDER_AS_BLOCK_R.test(input) === false
    }

    return inline
  }

  const rules: [key: Values<typeof RuleType>, rule: MarkdownToJSX.Rule][] = [
    [
      RuleType.blockQuote,
      {
        match: blockRegex(BLOCKQUOTE_R),
        order: Priority.HIGH,
        parse(capture, parse, context) {
          const [, alert, content] = capture[0]
            .replace(BLOCKQUOTE_TRIM_LEFT_MULTILINE_R, '')
            .match(BLOCKQUOTE_ALERT_R)

          return {
            alert,
            children: parse(content, context),
          }
        },
      },
    ],

    [
      RuleType.breakLine,
      {
        match: anyScopeRegex(BREAK_LINE_R),
        order: Priority.HIGH,
        parse: captureNothing,
      },
    ],

    [
      RuleType.breakThematic,
      {
        match: blockRegex(BREAK_THEMATIC_R),
        order: Priority.HIGH,
        parse: captureNothing,
      },
    ],

    [
      RuleType.codeBlock,
      {
        match: blockRegex(CODE_BLOCK_R),
        order: Priority.MAX,
        parse(capture /*, parse, context*/) {
          return {
            lang: undefined,
            text: capture[0].replace(/^ {4}/gm, '').replace(/\n+$/, ''),
          }
        },
      } as MarkdownToJSX.Rule<{
        attrs?: ReturnType<typeof attrStringToMap>
        lang?: string
        text: string
      }>,
    ],

    [
      RuleType.codeFenced,
      {
        match: blockRegex(CODE_BLOCK_FENCED_R),
        order: Priority.MAX,
        parse(capture /*, parse, context*/) {
          return {
            // if capture[3] it's additional metadata
            attrs: attrStringToMap('code', capture[3] || '', options),
            lang: capture[2] || undefined,
            text: capture[4],
            type: RuleType.codeBlock,
          }
        },
      },
    ],

    [
      RuleType.codeInline,
      {
        match: simpleInlineRegex(CODE_INLINE_R),
        order: Priority.LOW,
        parse(capture /*, parse, context*/) {
          return {
            text: capture[2],
          }
        },
      },
    ],

    /**
     * footnotes are emitted at the end of compilation in a special <footer> block
     */
    [
      RuleType.footnote,
      {
        match: blockRegex(FOOTNOTE_R),
        order: Priority.MAX,
        parse(capture, parse, context) {
          context.footnotes.push({
            footnote: parse(capture[2], { ...context, inline: true }),
            identifier: capture[1],
          })

          return {}
        },
      },
    ],

    [
      RuleType.footnoteReference,
      {
        match: inlineRegex(FOOTNOTE_REFERENCE_R),
        order: Priority.HIGH,
        parse(capture /*, parse*/) {
          return {
            target: `#${options.slugify(capture[1], slugify)}`,
            text: capture[1],
          }
        },
      } as MarkdownToJSX.Rule<{ target: string; text: string }>,
    ],

    [
      RuleType.gfmTask,
      {
        match: inlineRegex(GFM_TASK_R),
        order: Priority.HIGH,
        parse(capture /*, parse, context*/) {
          return {
            completed: capture[1].toLowerCase() === 'x',
          }
        },
      } as MarkdownToJSX.Rule<{ completed: boolean }>,
    ],

    [
      RuleType.heading,
      {
        match: blockRegex(
          options.enforceAtxHeadings ? HEADING_ATX_COMPLIANT_R : HEADING_R
        ),
        order: Priority.HIGH,
        parse(capture, parse, context) {
          return {
            children: parseInline(parse, capture[2], context),
            id: options.slugify(capture[2], slugify),
            level: capture[1].length as MarkdownToJSX.HeadingNode['level'],
          }
        },
      },
    ],

    [
      RuleType.headingSetext,
      {
        match: blockRegex(HEADING_SETEXT_R),
        order: Priority.MAX,
        parse(capture, parse, context) {
          return {
            children: parseInline(parse, capture[1], context),
            level: capture[2] === '=' ? 1 : 2,
            type: RuleType.heading,
          }
        },
      },
    ],

    [
      RuleType.htmlBlock,
      {
        /**
         * find the first matching end tag and process the interior
         */
        match: anyScopeRegex(HTML_BLOCK_ELEMENT_R),
        order: Priority.HIGH,
        parse(capture, parse, context) {
          const [, whitespace] = capture[3].match(HTML_LEFT_TRIM_AMOUNT_R)

          const trimmer = new RegExp(`^${whitespace}`, 'gm')
          const trimmed = capture[3].replace(trimmer, '')

          const parseFunc = containsBlockSyntax(trimmed)
            ? parseBlock
            : parseInline

          const tagName = capture[1].toLowerCase() as MarkdownToJSX.HTMLTags
          const noInnerParse =
            DO_NOT_PROCESS_HTML_ELEMENTS.indexOf(tagName) !== -1

          const tag = (
            noInnerParse ? tagName : capture[1]
          ).trim() as MarkdownToJSX.HTMLTags

          const ast = {
            attrs: attrStringToMap(tag, capture[2], options),
            noInnerParse: noInnerParse,
            tag,
          } as {
            attrs: ReturnType<typeof attrStringToMap>
            children?: ReturnType<MarkdownToJSX.NestedParser> | undefined
            noInnerParse: Boolean
            tag: MarkdownToJSX.HTMLTags
            text?: string | undefined
          }

          context.inAnchor = context.inAnchor || tagName === 'a'

          if (noInnerParse) {
            ast.text = capture[3]
          } else {
            ast.children = parseFunc(parse, trimmed, context)
          }

          /**
           * if another html block is detected within, parse as block,
           * otherwise parse as inline to pick up any further markdown
           */
          context.inAnchor = false

          return ast
        },
      },
    ],

    [
      RuleType.htmlSelfClosing,
      {
        /**
         * find the first matching end tag and process the interior
         */
        match: anyScopeRegex(HTML_SELF_CLOSING_ELEMENT_R),
        order: Priority.HIGH,
        parse(capture /*, parse, context*/) {
          const tag = capture[1].trim() as MarkdownToJSX.HTMLTags

          return {
            attrs: attrStringToMap(tag, capture[2] || '', options),
            tag,
          }
        },
      },
    ],

    [
      RuleType.htmlComment,
      {
        match: anyScopeRegex(HTML_COMMENT_R),
        order: Priority.HIGH,
        parse() {
          return {}
        },
      },
    ],

    [
      RuleType.image,
      {
        match: simpleInlineRegex(IMAGE_R),
        order: Priority.HIGH,
        parse(capture /*, parse, context*/) {
          return {
            alt: capture[1],
            target: unescapeUrl(capture[2]),
            title: capture[3],
          }
        },
      } as MarkdownToJSX.Rule<{
        alt?: string
        target: string
        title?: string
      }>,
    ],

    [
      RuleType.link,
      {
        match: inlineRegex(LINK_R),
        order: Priority.LOW,
        parse(capture, parse, context) {
          return {
            children: parseSimpleInline(parse, capture[1], context),
            target: unescapeUrl(capture[2]),
            title: capture[3],
          }
        },
      },
    ],

    // https://daringfireball.net/projects/markdown/syntax#autolink
    [
      RuleType.linkAngleBraceStyleDetector,
      {
        match: inlineRegex(LINK_AUTOLINK_R),
        order: Priority.MAX,
        parse(capture /*, parse, context*/) {
          return {
            children: [
              {
                text: capture[1],
                type: RuleType.text,
              },
            ],
            target: capture[1],
            type: RuleType.link,
          }
        },
      },
    ],

    [
      RuleType.linkBareUrlDetector,
      {
        match: (source, context) => {
          if (context.inAnchor || options.disableAutoLink) {
            return null
          }
          return inlineRegex(LINK_AUTOLINK_BARE_URL_R)(source, context)
        },
        order: Priority.MAX,
        parse(capture /*, parse, context*/) {
          return {
            children: [
              {
                text: capture[1],
                type: RuleType.text,
              },
            ],
            target: capture[1],
            title: undefined,
            type: RuleType.link,
          }
        },
      },
    ],

    [
      RuleType.linkMailtoDetector,
      {
        match: inlineRegex(LINK_AUTOLINK_MAILTO_R),
        order: Priority.MAX,
        parse(capture /*, parse, context*/) {
          let address = capture[1]
          let target = capture[1]

          // Check for a `mailto:` already existing in the link:
          if (!AUTOLINK_MAILTO_CHECK_R.test(target)) {
            target = 'mailto:' + target
          }

          return {
            children: [
              {
                text: address.replace('mailto:', ''),
                type: RuleType.text,
              },
            ],
            target: target,
            type: RuleType.link,
          }
        },
      },
    ],

    [
      RuleType.orderedList,
      generateListRule(
        ORDERED
      ) as MarkdownToJSX.Rule<MarkdownToJSX.OrderedListNode>,
    ],

    [
      RuleType.unorderedList,
      generateListRule(
        UNORDERED
      ) as MarkdownToJSX.Rule<MarkdownToJSX.UnorderedListNode>,
    ],

    [
      RuleType.newlineCoalescer,
      {
        match: blockRegex(CONSECUTIVE_NEWLINE_R),
        order: Priority.LOW,
        parse: captureNothing,
      },
    ],

    [
      RuleType.paragraph,
      {
        match: matchParagraph,
        order: Priority.LOW,
        parse: parseCaptureInline,
      } as MarkdownToJSX.Rule<ReturnType<typeof parseCaptureInline>>,
    ],

    [
      RuleType.ref,
      {
        match: inlineRegex(REFERENCE_IMAGE_OR_LINK),
        order: Priority.MAX,
        parse(capture, parse, context) {
          context.refs[capture[1]] = {
            target: capture[2],
            title: capture[4],
          }

          return {}
        },
      },
    ],

    [
      RuleType.refImage,
      {
        match: simpleInlineRegex(REFERENCE_IMAGE_R),
        order: Priority.MAX,
        parse(capture) {
          return {
            alt: capture[1] || undefined,
            ref: capture[2],
          }
        },
      } as MarkdownToJSX.Rule<{ alt?: string; ref: string }>,
    ],

    [
      RuleType.refLink,
      {
        match: inlineRegex(REFERENCE_LINK_R),
        order: Priority.MAX,
        parse(capture, parse, context) {
          return {
            children: parse(capture[1], context),
            fallbackChildren: capture[0],
            ref: capture[2],
          }
        },
      },
    ],

    [
      RuleType.table,
      {
        match: blockRegex(NP_TABLE_R),
        order: Priority.HIGH,
        parse: parseTable,
      },
    ],

    [
      RuleType.text,
      {
        // Here we look for anything followed by non-symbols,
        // double newlines, or double-space-newlines
        // We break on any symbol characters so that this grammar
        // is easy to extend without needing to modify this regex
        match: anyScopeRegex(TEXT_PLAIN_R),
        order: Priority.MIN,
        parse(capture /*, parse, context*/) {
          return {
            text: capture[0]
              // nbsp -> unicode equivalent for named chars
              .replace(HTML_CHAR_CODE_R, (full, inner) => {
                return options.namedCodesToUnicode[inner]
                  ? options.namedCodesToUnicode[inner]
                  : full
              }),
          }
        },
      },
    ],

    [
      RuleType.textFormatted,
      {
        match: simpleInlineRegex(INLINE_FORMATTING_R),
        order: Priority.MED,
        parse(capture, parse, context) {
          let type

          switch (capture[1]) {
            case '__':
            case '**':
              type = RuleType.textBolded
              break
            case '_':
            case '*':
              type = RuleType.textEmphasized
              break
            case '~~':
              type = RuleType.textStrikethroughed
              break
            case '==':
              type = RuleType.textMarked
              break
            default:
              type = RuleType.text
              break
          }

          return {
            children: parse(capture[3], context),
            type,
          }
        },
      },
    ],

    [
      RuleType.textEscaped,
      {
        // We don't allow escaping numbers, letters, or spaces here so that
        // backslashes used in plain text still get rendered. But allowing
        // escaping anything else provides a very flexible escape mechanism,
        // regardless of how this grammar is extended.
        match: simpleInlineRegex(TEXT_ESCAPED_R),
        order: Priority.HIGH,
        parse(capture /*, parse, context*/) {
          return {
            text: capture[1],
            type: RuleType.text,
          }
        },
      },
    ],
  ]

  // Object.keys(rules).forEach(key => {
  //   let { match: match, parse: parse } = rules[key]

  //   rules[key].match = (...args) => {
  //     const start = performance.now()
  //     const result = match(...args)
  //     const delta = performance.now() - start

  //     if (delta > 5)
  //       console.warn(
  //         `Slow match for ${key}: ${delta.toFixed(3)}ms, input: ${args[0]}`
  //       )

  //     return result
  //   }

  //   rules[key].parse = (...args) => {
  //     const start = performance.now()
  //     const result = parse(...args)
  //     const delta = performance.now() - start

  //     if (delta > 5)
  //       console.warn(`Slow parse for ${key}: ${delta.toFixed(3)}ms`)

  //     console.log(`${key}:parse`, `${delta.toFixed(3)}ms`, args[0])

  //     return result
  //   }
  // })

  if (options.disableParsingRawHTML) {
    options.disabledRules.push(RuleType.htmlBlock, RuleType.htmlSelfClosing)
  }

  const doParse = parserFor(
    rules.concat(options.customRules as typeof rules),
    options
  )

  /**
   * A function that returns AST and resulting state context for given markdown.
   */
  function parser(input: string) {
    input = input.replace(FRONT_MATTER_R, '')

    const context = {
      inline: isInline(input),
      footnotes: [],
      refs: {},
    }

    const ast = doParse(
      context.inline
        ? input
        : `${input.trimEnd().replace(TRIM_STARTING_NEWLINES, '')}\n\n`,
      context
    )

    if (context.footnotes.length) {
      ast.push({
        type: RuleType.footer,
      })
    }

    return { ast, context }
  }

  function compiler(input: string = ''): React.ReactNode[] | React.ReactNode {
    const inline = isInline(input)
    const { ast, context } = parser(input)
    const arr = emitter(ast, context)
    const createElementFn = options.createElement || React.createElement

    while (
      typeof arr[arr.length - 1] === 'string' &&
      !(arr[arr.length - 1] as string).trim()
    ) {
      arr.pop()
    }

    if (options.wrapper === null) {
      return arr
    }

    const wrapper = options.wrapper || (inline ? 'span' : 'div')
    let jsx

    if (arr.length > 1 || options.forceWrapper) {
      jsx = arr
    } else if (arr.length === 1) {
      return arr[0]
    } else {
      return null
    }

    return createElementFn(wrapper, { key: 'outer' }, jsx)
  }

  const emitter = reactFor(createRenderer(options, compiler))

  function Markdown({ children = '' }: { children: string }) {
    if (process.env.NODE_ENV !== 'production' && typeof children !== 'string') {
      console.error(
        'markdown-to-jsx: <Markdown> component only accepts a single string as a child, received:',
        children
      )
    }

    return compiler(children) as React.ReactElement
  }

  return {
    compiler,
    parser,
    Markdown,
  }
}

/**
 * A simple HOC for easy React use. Feed the markdown content as a direct child
 * and the rest is taken care of automatically.
 */
function Markdown(props: {
  [key: string]: any
  children: string
  options?: MarkdownToJSX.Options
}) {
  const { Markdown: M } = React.useMemo(
    () => createMarkdown(props.options),
    [props.options]
  )

  return M(props)
}

export namespace MarkdownToJSX {
  /**
   * RequireAtLeastOne<{ ... }> <- only requires at least one key
   */
  type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<
    T,
    Exclude<keyof T, Keys>
  > &
    {
      [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>
    }[Keys]

  export type CreateElement = typeof React.createElement

  export type HTMLTags = keyof React.JSX.IntrinsicElements

  export type Context = {
    /** listing of detected footnotes */
    footnotes: { footnote: ParserResult[]; identifier: string }[]
    /** true if the current content is inside anchor link grammar */
    inAnchor?: boolean
    /** true if parsing in an inline context (subset of rules around formatting and links) */
    inline?: boolean
    /** true if in a table */
    inTable?: boolean
    /** use this for the `key` prop */
    key?: React.Key
    /** true if in a list */
    list?: boolean
    /** used for lookbacks */
    prevCapture?: string
    /** mapping of any detected image or link references */
    refs: { [key: string]: { target: string; title: string } }
    /** true if parsing in inline context w/o links */
    simple?: boolean
  }

  /** @deprecated use MarkdownToJSX.Context */
  export type State = Context

  export interface BlockQuoteNode {
    alert?: string
    children: MarkdownToJSX.ParserResult[]
    type: typeof RuleType.blockQuote
  }

  export interface BreakLineNode {
    type: typeof RuleType.breakLine
  }

  export interface BreakThematicNode {
    type: typeof RuleType.breakThematic
  }

  export interface CodeBlockNode {
    type: typeof RuleType.codeBlock
    attrs?: React.JSX.IntrinsicAttributes
    lang?: string
    text: string
  }

  export interface CodeFencedNode {
    type: typeof RuleType.codeFenced
  }

  export interface CodeInlineNode {
    type: typeof RuleType.codeInline
    text: string
  }

  export interface FooterNode {
    type: typeof RuleType.footer
  }

  export interface FootnoteNode {
    type: typeof RuleType.footnote
  }

  export interface FootnoteReferenceNode {
    type: typeof RuleType.footnoteReference
    target: string
    text: string
  }

  export interface GFMTaskNode {
    type: typeof RuleType.gfmTask
    completed: boolean
  }

  export interface HeadingNode {
    type: typeof RuleType.heading
    children: MarkdownToJSX.ParserResult[]
    id: string
    level: 1 | 2 | 3 | 4 | 5 | 6
  }

  export interface HeadingSetextNode {
    type: typeof RuleType.headingSetext
  }

  export interface HTMLCommentNode {
    type: typeof RuleType.htmlComment
  }

  export interface ImageNode {
    type: typeof RuleType.image
    alt?: string
    target: string
    title?: string
  }

  export interface LinkNode {
    type: typeof RuleType.link
    children: MarkdownToJSX.ParserResult[]
    target: string
    title?: string
  }

  export interface LinkAngleBraceNode {
    type: typeof RuleType.linkAngleBraceStyleDetector
  }

  export interface LinkBareURLNode {
    type: typeof RuleType.linkBareUrlDetector
  }

  export interface LinkMailtoNode {
    type: typeof RuleType.linkMailtoDetector
  }

  export interface OrderedListNode {
    type: typeof RuleType.orderedList
    items: MarkdownToJSX.ParserResult[][]
    ordered: true
    start?: number
  }

  export interface UnorderedListNode {
    type: typeof RuleType.unorderedList
    items: MarkdownToJSX.ParserResult[][]
    ordered: false
  }

  export interface NewlineNode {
    type: typeof RuleType.newlineCoalescer
  }

  export interface ParagraphNode {
    type: typeof RuleType.paragraph
    children: MarkdownToJSX.ParserResult[]
  }

  export interface ReferenceNode {
    type: typeof RuleType.ref
  }

  export interface ReferenceImageNode {
    type: typeof RuleType.refImage
    alt?: string
    ref: string
  }

  export interface ReferenceLinkNode {
    type: typeof RuleType.refLink
    children: MarkdownToJSX.ParserResult[]
    fallbackChildren: string
    ref: string
  }

  export interface TableNode {
    type: typeof RuleType.table
    /**
     * alignment for each table column
     */
    align: ('left' | 'right' | 'center')[]
    cells: MarkdownToJSX.ParserResult[][][]
    header: MarkdownToJSX.ParserResult[][]
  }

  export interface TableSeparatorNode {
    type: typeof RuleType.tableSeparator
  }

  export interface TextNode {
    type: typeof RuleType.text
    text: string
  }

  export interface BoldTextNode {
    type: typeof RuleType.textBolded
    children: MarkdownToJSX.ParserResult[]
  }

  export interface ItalicTextNode {
    type: typeof RuleType.textEmphasized
    children: MarkdownToJSX.ParserResult[]
  }

  export interface EscapedTextNode {
    type: typeof RuleType.textEscaped
  }

  export interface MarkedTextNode {
    type: typeof RuleType.textMarked
    children: MarkdownToJSX.ParserResult[]
  }

  export interface StrikethroughTextNode {
    type: typeof RuleType.textStrikethroughed
    children: MarkdownToJSX.ParserResult[]
  }

  export interface HTMLNode {
    type: typeof RuleType.htmlBlock
    attrs: React.JSX.IntrinsicAttributes
    children?: ReturnType<MarkdownToJSX.NestedParser> | undefined
    noInnerParse: Boolean
    tag: MarkdownToJSX.HTMLTags
    text?: string | undefined
  }

  export interface HTMLSelfClosingNode {
    type: typeof RuleType.htmlSelfClosing
    attrs: React.JSX.IntrinsicAttributes
    tag: string
  }

  export type ParserResult =
    | BlockQuoteNode
    | BreakLineNode
    | BreakThematicNode
    | CodeBlockNode
    | CodeFencedNode
    | CodeInlineNode
    | FooterNode
    | FootnoteNode
    | FootnoteReferenceNode
    | GFMTaskNode
    | HeadingNode
    | HeadingSetextNode
    | HTMLCommentNode
    | ImageNode
    | LinkNode
    | LinkAngleBraceNode
    | LinkBareURLNode
    | LinkMailtoNode
    | OrderedListNode
    | UnorderedListNode
    | NewlineNode
    | ParagraphNode
    | ReferenceNode
    | ReferenceImageNode
    | ReferenceLinkNode
    | TableNode
    | TableSeparatorNode
    | TextNode
    | BoldTextNode
    | ItalicTextNode
    | EscapedTextNode
    | MarkedTextNode
    | StrikethroughTextNode
    | HTMLNode
    | HTMLSelfClosingNode

  export type NestedParser = (
    input: string,
    context?: MarkdownToJSX.Context
  ) => MarkdownToJSX.ParserResult[]

  export type Parser<ParserOutput> = (
    capture: RegExpMatchArray,
    nestedParse: NestedParser,
    context?: MarkdownToJSX.Context
  ) => ParserOutput

  export type RuleOutput = (
    ast: MarkdownToJSX.ParserResult | MarkdownToJSX.ParserResult[],
    context: MarkdownToJSX.Context
  ) => React.ReactNode

  export type Rule<ParserOutput = MarkdownToJSX.ParserResult> = {
    match: (
      source: string,
      context: MarkdownToJSX.Context,
      prevCapturedString?: string
    ) => RegExpMatchArray
    order: Priority
    parse: MarkdownToJSX.Parser<
      Omit<ParserOutput, 'type'> & { type?: Values<typeof RuleType> }
    >
  }

  export type Rules = {
    [K in ParserResult['type']]: K extends typeof RuleType.table
      ? Rule<Extract<ParserResult, { type: K | typeof RuleType.paragraph }>>
      : Rule<Extract<ParserResult, { type: K }>>
  }

  export type Override =
    | RequireAtLeastOne<{
        component: React.ElementType
        props: Object
      }>
    | React.ElementType

  export type Overrides = {
    [tag in HTMLTags]?: Override
  } & {
    [customComponent: string]: Override
  }

  export type Options = Partial<{
    /**
     * Ultimate control over the output of all rendered JSX.
     */
    createElement: (
      tag: Parameters<CreateElement>[0],
      props: React.JSX.IntrinsicAttributes,
      ...children: React.ReactNode[]
    ) => React.ReactNode

    /**
     * Supply custom rule tuples; this allows for creation and handling of arbitrary syntaxes
     * within markdown. Note that `renderRule` needs to be composed as well to intercept the new
     * rules you have added and output appropriate JSX.
     *
     * The key for each rule should be unique and have no overlap with `RuleType`.
     *
     * For inspiration, it's recommended to see the [source code for this library](https://github.com/quantizor/markdown-to-jsx/blob/main/index.tsx)
     * and copy/modify an existing rule to get started.
     */
    customRules?: [key: string, rule: MarkdownToJSX.Rule][] | undefined

    /**
     * The library automatically generates an anchor tag for bare URLs included in the markdown
     * document, but this behavior can be disabled if desired.
     */
    disableAutoLink: boolean

    /**
     * Disable the compiler's best-effort transcription of provided raw HTML
     * into JSX-equivalent. This is the functionality that prevents the need to
     * use `dangerouslySetInnerHTML` in React.
     *
     * Passing `true` is equivalent to `disabledRules: [RuleType.htmlBlock, RuleType.htmlSelfClosing]`
     */
    disableParsingRawHTML: boolean

    /**
     * Selectively disable particular syntaxes. Note that `RuleType.text` cannot be disabled.
     *
     * ```
     * options: {
     *   // this would turn off blockquotes and leave other syntaxes enabled
     *   disabledRules: [
     *     RuleType.blockQuote
     *   ]
     * }
     * ```
     */
    disabledRules?: Values<typeof RuleType>[] | undefined

    /**
     * Forces the compiler to have space between hash sign and the header text which
     * is explicitly stated in the most of the markdown specs.
     * https://github.github.com/gfm/#atx-heading
     * `The opening sequence of # characters must be followed by a space or by the end of line.`
     */
    enforceAtxHeadings: boolean

    /**
     * Selectively enable particular syntaxes. Note that `RuleType.text` is always enabled.
     *
     * ```
     * options: {
     *   // this would only enable ultra-basic parsing of inline formats and no block syntaxes
     *   enabledRules: [
     *     RuleType.textFormatted
     *   ]
     * }
     * ```
     */
    enabledRules?: Values<typeof RuleType>[] | undefined

    /**
     * Forces the compiler to always output content with a block-level wrapper
     * (`<p>` or any block-level syntax your markdown already contains.)
     */
    forceBlock: boolean

    /**
     * Forces the compiler to always output content with an inline wrapper (`<span>`)
     */
    forceInline: boolean

    /**
     * Forces the compiler to wrap results, even if there is only a single
     * child or no children.
     */
    forceWrapper: boolean

    /**
     * Supply additional HTML entity: unicode replacement mappings.
     *
     * Pass only the inner part of the entity as the key,
     * e.g. `&le;` -> `{ "le": "\u2264" }`
     *
     * By default
     * the following entities are replaced with their unicode equivalents:
     *
     * ```
     * &amp;
     * &apos;
     * &gt;
     * &lt;
     * &nbsp;
     * &quot;
     * ```
     */
    namedCodesToUnicode: {
      [key: string]: string
    }

    /**
     * Selectively control the output of particular HTML tags as they would be
     * emitted by the compiler.
     */
    overrides: Overrides

    /**
     * Allows for full control over rendering of particular rules.
     * For example, to implement a LaTeX renderer such as `react-katex`:
     *
     * ```
     * renderRule(next, node, renderChildren, context) {
     *   if (node.type === RuleType.codeBlock && node.lang === 'latex') {
     *     return (
     *       <TeX as="div" key={context.key}>
     *         {String.raw`${node.text}`}
     *       </TeX>
     *     )
     *   }
     *
     *   return next();
     * }
     * ```
     *
     * Thar be dragons obviously, but you can do a lot with this
     * (have fun!) To see how things work internally, check the `render`
     * method in source for a particular rule.
     */
    renderRule: (
      /** Resume normal processing, call this function as a fallback if you are not returning custom JSX. */
      next: () => React.ReactNode,
      /** the current AST node, use `RuleType` against `node.type` for identification */
      node: ParserResult,
      /** use as `renderChildren(node.children)` for block nodes */
      renderChildren: RuleOutput,
      /** contains `key` which should be supplied to the topmost JSX element */
      state: State
    ) => React.ReactNode

    /**
     * Override the built-in sanitizer function for URLs, etc if desired. The built-in version is available as a library export called `sanitizer`.
     */
    sanitizer: (
      value: string,
      tag: HTMLTags,
      attribute: string
    ) => string | null

    /**
     * Override normalization of non-URI-safe characters for use in generating
     * HTML IDs for anchor linking purposes.
     */
    slugify: (input: string, defaultFn: (input: string) => string) => string

    /**
     * Declare the type of the wrapper to be used when there are multiple
     * children to render. Set to `null` to get an array of children back
     * without any wrapper, or use `React.Fragment` to get a React element
     * that won't show up in the DOM.
     */
    wrapper: React.ElementType | null
  }>
}

export default Markdown
