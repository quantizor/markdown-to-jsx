import * as $ from './constants.ts'
import {
  indexOfCi,
  isASCIILetter,
  lastIndexOfCi,
  matchesFolded,
  type ParserInputOptions,
  parseMarkdown,
  parser,
  stripDangerousHtml,
  TYPE1_TAG_NAMES,
  toParseOptions,
} from './parse.ts'
import { type MarkdownToJSX, RuleType } from './types.ts'
import {
  childrenAttrContent,
  containsTagfilterTag,
  decodeEntityReferences,
  encodeUrlTarget,
  getOverrideProps,
  getTag,
  isAlnumCode,
  isVoidElement,
  rawOpenTagAttrs,
  URL_VERDICT,
  urlNamesBlockedScheme,
  urlVerdict,
  withoutHandlerSource,
} from './utils.ts'

export { parser } from './parse.ts'
export { type MarkdownToJSX, RuleType } from './types.ts'

var _emptyState: MarkdownToJSX.State = {}

/**
 * Override configuration for HTML tags or custom components in Markdown output
 */
export type MarkdownOverride =
  | {
      component?: string
      props?: Record<string, string | number | boolean>
    }
  | string

/**
 * Map of HTML tags and custom components to their override configurations
 */
export type MarkdownOverrides = {
  [tag in MarkdownToJSX.HTMLTags]?: MarkdownOverride
} & {
  [customComponent: string]: MarkdownOverride
}

/**
 * Markdown-specific compiler options that extend the main MarkdownToJSX options
 * Excludes React/HTML-specific options (createElement, wrapper, wrapperProps, forceWrapper)
 */
export type MarkdownCompilerOptions = Omit<
  MarkdownToJSX.Options,
  'createElement' | 'wrapper' | 'wrapperProps' | 'forceWrapper' | 'renderRule'
> & {
  /**
   * Whether to use reference-style links instead of inline links
   * @default false
   */
  useReferenceLinks?: boolean

  /**
   * Whether to use setext-style headers for level 1 and 2 headers
   * @default false
   */
  useSetextHeaders?: boolean

  /**
   * Allows for full control over rendering of particular rules.
   * Returns a markdown string instead of JSX.
   */
  renderRule?: (
    next: () => string,
    node: MarkdownToJSX.ASTNode,
    renderChildren: (children: MarkdownToJSX.ASTNode[]) => string,
    state: MarkdownToJSX.State
  ) => string

  /**
   * Override HTML tag names and add attributes for HTML blocks and self-closing tags.
   * Output is markdown string (HTML tags in markdown).
   */
  overrides?: MarkdownOverrides
}

/**
 * Compiler function that parses markdown and renders to markdown string
 * Convenience function that combines parser() and astToMarkdown()
 *
 * @param input - Markdown string to compile
 * @param options - Markdown compiler options
 * @returns Normalized markdown string
 */
export function compiler(
  input: string,
  options?: MarkdownCompilerOptions
): string {
  const ast = parser(input, options)
  return astToMarkdown(ast, options)
}

/**
 * Convert AST nodes to markdown string
 *
 * @param ast - AST node(s) to render
 * @param options - Markdown compiler options
 * @returns Markdown string
 */
export function astToMarkdown(
  ast: MarkdownToJSX.ASTNode | MarkdownToJSX.ASTNode[],
  options?: MarkdownCompilerOptions
): string {
  var overrides = options?.overrides || {}
  var names = namesAfterRenames(overrides)
  if (!names) {
    return writeMarkdown(ast, options, overrides)
  }

  // A rename moves where a renderer ends a block, so markup the parser read as one
  // raw string splits and a quote pairs with a later one. What a rename writes is
  // read again like any source, and only that reading writes reference links.
  var again = { ...options, overrides: names, renderRule: undefined }
  return writeMarkdown(
    parser(
      writeMarkdown(ast, { ...options, useReferenceLinks: false }, overrides),
      again
    ),
    again,
    {}
  )
}

function writeMarkdown(
  ast: MarkdownToJSX.ASTNode | MarkdownToJSX.ASTNode[],
  options: WriterOptions | undefined,
  overrides: MarkdownOverrides
): string {
  const nodes = Array.isArray(ast) ? ast : [ast]

  // Extract refs from reference collection node
  var refs: { [key: string]: { target: string; title: string | undefined } } =
    Object.create(null)
  var nonRefCollectionNodes: MarkdownToJSX.ASTNode[] = []
  var foundRefCollection = false

  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i]
    if (node.type === RuleType.refCollection && !foundRefCollection) {
      refs =
        (node as MarkdownToJSX.ReferenceCollectionNode).refs ||
        Object.create(null)
      foundRefCollection = true
      nonRefCollectionNodes.push(node)
    } else if (
      node.type !== RuleType.footnote &&
      node.type !== RuleType.ref &&
      (node.type !== RuleType.frontmatter ||
        options?.preserveFrontmatter !== false)
    ) {
      nonRefCollectionNodes.push(node)
    }
  }

  function renderNodeDefault(node: MarkdownToJSX.ASTNode): string {
    if (
      node.type === RuleType.ref ||
      node.type === RuleType.footnote ||
      (node.type === RuleType.frontmatter &&
        options?.preserveFrontmatter === false)
    ) {
      return ''
    }
    return compileNode(node, state)
  }

  function nestedStatefulRender(
    node: MarkdownToJSX.ASTNode,
    stateWithKey: MarkdownToJSX.State = _emptyState
  ): string {
    // renderRule must be checked FIRST, before any filtering or rendering logic
    // This gives users full control to render even normally-skipped nodes
    if (options?.renderRule) {
      return options.renderRule(
        () => renderNodeDefault(node),
        node,
        renderChildren,
        stateWithKey
      )
    }

    return renderNodeDefault(node)
  }

  function renderChildren(children: MarkdownToJSX.ASTNode[]): string {
    var out = ''
    for (var ci = 0; ci < children.length; ci++) {
      out += nestedStatefulRender(children[ci], _emptyState)
    }
    return out
  }

  const state: CompilerState = {
    options: options || {},
    references: new Map(),
    referenceIndex: 1,
    overrides,
    renderChild: nestedStatefulRender,
  }

  // Render nodes, tracking key indices without O(n^2) indexOf
  var keyOffset = 0
  var content = ''
  for (var ni = 0; ni < nonRefCollectionNodes.length; ni++) {
    var n = nonRefCollectionNodes[ni]
    if (ni > 0) {
      content += '\n\n'
    }
    var keyIndex = n.type === RuleType.refCollection ? undefined : keyOffset++
    content += nestedStatefulRender(n, { key: keyIndex, refs })
  }

  if (state.options.useReferenceLinks && state.references.size > 0) {
    const references = Array.from(state.references.entries())
      .map(([key, { url, title }]) =>
        title
          ? `[${key}]: ${url} "${escapeLinkTitle(title)}"`
          : `[${key}]: ${url}`
      )
      .join('\n')
    return `${content}\n\n${references}`
  }

  return content
}

/**
 * The tag names `overrides` registers once its renames are written, for a parser
 * that reads only the names, or undefined when no key renames its tag.
 */
function namesAfterRenames(
  overrides: MarkdownOverrides
): Record<string, boolean> | undefined {
  var renames = false
  var names: Record<string, boolean> = {}
  for (var name in overrides) {
    var written = getTag(name, overrides)
    renames = renames || written !== name
    names[name] = names[written] = true
  }
  return renames ? names : undefined
}

// Alias for backwards compatibility
export const markdown: typeof astToMarkdown = astToMarkdown

/** Options as the writer reads them: `overrides` only by name, for its nested parses */
type WriterOptions = Omit<MarkdownCompilerOptions, 'overrides'> &
  Pick<ParserInputOptions, 'overrides'>

/**
 * Internal compiler state
 */
interface CompilerState {
  options: WriterOptions
  references: Map<string, { url: string; title?: string }>
  referenceIndex: number
  overrides?: MarkdownOverrides
  renderChild: (
    node: MarkdownToJSX.ASTNode,
    stateWithKey?: MarkdownToJSX.State
  ) => string
}

/**
 * Compile a single AST node to markdown
 */
function compileNode(
  node: MarkdownToJSX.ASTNode,
  state: CompilerState
): string {
  switch (node.type) {
    case RuleType.text:
      return compileText(node)

    case RuleType.paragraph:
      return compileParagraph(node, state)

    case RuleType.heading:
      return compileHeading(node, state)

    case RuleType.breakThematic:
      return compileBreakThematic(node)

    case RuleType.breakLine:
      return compileBreakLine(node)

    case RuleType.codeBlock:
      return compileCodeBlock(node, state.options)

    case RuleType.codeInline:
      return compileCodeInline(node, state.options)

    case RuleType.textFormatted:
      return compileTextFormatted(node, state)

    case RuleType.link:
      return compileLink(node, state)

    case RuleType.image:
      return compileImage(node, state)

    case RuleType.orderedList:
      return compileOrderedList(node, state)

    case RuleType.unorderedList:
      return compileUnorderedList(node, state)

    case RuleType.blockQuote:
      return compileBlockQuote(node, state)

    case RuleType.table:
      return compileTable(node, state)

    case RuleType.htmlBlock:
      return compileHtmlBlock(node, state)

    case RuleType.htmlSelfClosing:
      return compileHtmlSelfClosing(node, state)

    case RuleType.htmlComment:
      return compileHtmlComment(node)

    case RuleType.footnoteReference:
      return compileFootnoteReference(node)

    case RuleType.frontmatter:
      return compileFrontmatter(node)

    case RuleType.gfmTask:
      return compileGfmTask(node)

    case RuleType.refCollection:
      return compileReferenceCollection(node, state)

    default:
      // Unknown node type, return empty string
      return ''
  }
}

/**
 * Escape, in a single pass, every character a text node must protect so it
 * stays literal on re-parse. An inline special (backslash, backtick, `*`, `_`,
 * `[`, `]`, `~`) is escaped anywhere, since emphasis, code, and links are
 * separate node types. A `<` before a letter, `/`, `!`, or `?` is written as an
 * entity: text can decode to one (`&lt;img …&gt;`), and a downstream renderer
 * would read it as live HTML. An entity stays inert where that renderer sees a
 * raw HTML block and a backslash would not, and re-parses to the same text. A
 * block starter is escaped only at the start of a line: `#` heading, `>`
 * blockquote, `-`/`+` bullet, `=`/`-` setext underline, `|` table, and a digit
 * run followed by `.`/`)`. A `(` after `]` is escaped too, and one opening the
 * node, since the node before it can end in `]` (`[^1](javascript:…)`): marked
 * drops the backslash of `\]` in link text and parses that text again, so `\](`
 * alone would read as a link.
 */
const ESCAPE_ALL_R =
  /\]\(|[\\`*_[\]~]|<(?=[a-zA-Z/!?])|&(?=#?\w+;)|(^|\n)([ \t]*)(?:([#>=|+-])|(\d{1,9})([.)]))/g

/**
 * Matches whenever compileText would change something, and on any `&`. Most text
 * nodes are plain words that match nothing here, so this cheap test skips the
 * escape pass for the common case (measured faster than running the escape regex
 * on text that needs no change), and the opening character it tests costs less
 * here than a charCodeAt on every node.
 */
const ESCAPE_TRIGGER_R =
  /^[(﻿]|[\\`*_[\]~&]|<[a-zA-Z/!?]|(?:^|\n)[ \t]*(?:[#>=|+-]|\d{1,9}[.)])/

const BACKSLASH_R = /\\/g
/** What can open markup in a code body a renderer reads as raw HTML or markdown */
const CODE_MARKUP_R = /[&<[\]`*_~\\|]/g
const PLAIN_LANG_R = /^[a-zA-Z0-9+#.-]+$/
/**
 * What any step of screenRawLinks acts on: a link or image opener, raw markup, a
 * type 1 tag, an autolink's scheme, and U+2028 or U+2029 before a `>`, which
 * `[^\t-~]` holds along with the rest of non-ASCII. A string with none of them comes
 * through unchanged.
 */
const RAW_SCREEN_SHAPE_R =
  /[^\t-~] {0,3}>|\][(:]|!\[|<(?:[?!]|pre|script|style|textarea|[a-z][a-z0-9+.-]{1,31}:)/i
/** A code span written as HTML is still inline markdown, where a URL or email address becomes a link */
const CODE_SPAN_MARKUP_R = /[&<[\]`*_~\\|:.@]/g
const FOOTNOTE_DESTINATION_BREAK = '<!---->'
/** What opens a tag, an autolink, or a link in a label a renderer reads as text */
const LABEL_MARKUP_R = /[<[(]/g
const LABEL_MARKUP_ENTITY: Record<string, string> = {
  '(': '&#40;',
  '<': '&lt;',
  '[': '&#91;',
}
const LEFT_BRACKET_R = /\[/g
const RIGHT_BRACKET_R = /\]/g
/** The `<` a downstream renderer reads as the start of markup */
const MARKUP_LT_R = /<(?=[a-zA-Z/!?])/g
const ALT_QUOTE_R = /"/g
/** The characters that end an image's alt early, the backslash included so `\]` can't */
const ALT_BRACKET_R = /[[\]\\]/g
const LT_R = /</g
const UNREADABLE_DESTINATION_R = /[\s<>]/
/** An escape pair, which a table cell keeps whole, or a bare pipe */
const CELL_PIPE_R = /\\[\s\S]|\|/g
/** A footnote body's first word, a destination to a renderer without footnotes */
const FIRST_WORD_R = /^\s*(\S*)/
const NUMERIC_REFERENCE_R = /&#(?:0*(\d+)|x0*([\da-f]+));?/gi
/** A line break and the spaces around it, which an ATX heading's one line cannot hold */
const LINE_BREAK_R = / *\n */g
/** The closer of each raw markup opener; a declaration's is a bare `>` */
const RAW_MODE_MARKUP_CLOSER: Partial<Record<string, string>> = {
  '!--': '-->',
  '![cdata[': ']]>',
  '?': '?>',
}

function compileText(node: MarkdownToJSX.TextNode): string {
  var text = node.text
  // `\<` parses to a text node of its own, so what follows it is the next node
  if (text === '<') {
    return '&lt;'
  }
  if (!ESCAPE_TRIGGER_R.test(text)) {
    return text
  }
  var out = text.replace(ESCAPE_ALL_R, escapeTextMatch)
  var first = out.charCodeAt(0)
  if (first === $.CHAR_PAREN_OPEN) {
    return `\\${out}`
  }
  // Some renderers drop this mark at the start of a document and others keep it as
  // text, so what follows reads as a block to one and a paragraph to the other. Only
  // a text node can open the output with it, and checking the output would flatten it.
  return first === $.CHAR_BYTE_ORDER_MARK ? `&#xFEFF;${out.slice(1)}` : out
}

function escapeTextMatch(
  match: string,
  lineStart: string | undefined,
  indent: string,
  blockChar: string | undefined,
  digits: string,
  marker: string
): string {
  if (lineStart === undefined) {
    if (match === '<') {
      return '&lt;'
    }
    if (match === '](') {
      return '\\]\\('
    }
    // Text reading `&copy;` decoded from `&amp;copy;`, and must not decode twice
    return match === '&' ? '&amp;' : `\\${match}`
  }
  if (blockChar !== undefined) {
    return `${lineStart + indent}\\${blockChar}`
  }
  return `${lineStart + indent + digits}\\${marker}`
}

/**
 * Text written as the content of an element the output tag opens. That element
 * can open a raw HTML block (a block-level tag alone on its line), where a
 * backslash shows as text, or sit inside a paragraph, where markdown is read
 * again. Only an entity is inert in both, so every character compileText would
 * escape is written as one.
 */
function compileElementText(text: string): string {
  return text.replace(ESCAPE_ALL_R, entityTextMatch)
}

function entityTextMatch(
  match: string,
  lineStart: string | undefined,
  indent: string,
  blockChar: string | undefined,
  digits: string,
  marker: string
): string {
  if (lineStart === undefined) {
    if (match === '<') {
      return '&lt;'
    }
    if (match === '&') {
      return '&amp;'
    }
    var out = ''
    for (var i = 0; i < match.length; i++) {
      out += `&#${match.charCodeAt(i)};`
    }
    return out
  }
  if (blockChar !== undefined) {
    return `${lineStart + indent}&#${blockChar.charCodeAt(0)};`
  }
  return `${lineStart + indent + digits}&#${marker.charCodeAt(0)};`
}

function compileParagraph(
  node: MarkdownToJSX.ParagraphNode,
  state: CompilerState
): string {
  var out = ''
  for (var i = 0; i < node.children.length; i++) {
    out += compileInlineChild(node.children, i, state)
  }
  return out
}

function compileHeading(
  node: MarkdownToJSX.HeadingNode,
  state: CompilerState
): string {
  var content = ''
  for (var hi = 0; hi < node.children.length; hi++) {
    content += compileInlineChild(node.children, hi, state)
  }

  if (
    state.options.useSetextHeaders &&
    (node.level === 1 || node.level === 2)
  ) {
    return `${content}\n${(node.level === 1 ? '=' : '-').repeat(content.length)}`
  }

  // A heading rarely holds a line break, and the regex costs far more to find none
  var oneLine =
    content.indexOf('\n') === -1 ? content : content.replace(LINE_BREAK_R, ' ')

  return `${'#'.repeat(node.level)}${state.options.enforceAtxHeadings === false ? '' : ' '}${escapeClosingSequence(oneLine)}`
}

/** A heading's last `#` run after a space reads as its closing sequence and is dropped, so the run gets a backslash */
function escapeClosingSequence(text: string): string {
  var end = text.length
  while (
    text.charCodeAt(end - 1) === $.CHAR_SPACE ||
    text.charCodeAt(end - 1) === $.CHAR_TAB
  ) {
    end--
  }
  var run = end
  while (text.charCodeAt(run - 1) === $.CHAR_HASH) {
    run--
  }
  var before = text.charCodeAt(run - 1)
  return run < end &&
    (run === 0 || before === $.CHAR_SPACE || before === $.CHAR_TAB)
    ? `${text.slice(0, run)}\\${text.slice(run)}`
    : text
}

function compileBreakThematic(_node: MarkdownToJSX.BreakThematicNode): string {
  return '---'
}

function compileBreakLine(_node: MarkdownToJSX.BreakLineNode): string {
  return '  \n'
}

/**
 * A renderer can read a code body as raw HTML or as markdown wherever it reads the
 * structure around it differently, and no screen can rule that out. So a body that
 * would be unsafe read that way, or a fence's info string, is not written as code
 * markup. `<` and `]` open everything this looks for. Raw HTML earlier in the
 * document is not required: `[^a`b]` re-pairs the backtick of a later code span.
 * A filtered tag counts only with raw HTML off: otherwise the document can write
 * that tag raw, and it passes through.
 */
function codeTextIsUnsafe(text: string, options: WriterOptions): boolean {
  if (text.indexOf('<') === -1 && text.indexOf(']') === -1) {
    return false
  }
  return (
    stripDangerousHtml(text, true) !== text ||
    (Boolean(options.disableParsingRawHTML) && containsTagfilterTag(text)) ||
    screenRawLinks(text) !== text
  )
}

/** What opens markup in a raw HTML or markdown reading, as an entity a browser shows as the character */
function encodeCodeText(text: string, markup: RegExp): string {
  return text.replace(markup, char =>
    char === '&' ? '&amp;' : char === '<' ? '&lt;' : `&#${char.charCodeAt(0)};`
  )
}

function compileCodeBlock(
  node: MarkdownToJSX.CodeBlockNode,
  options: WriterOptions
): string {
  if (
    codeTextIsUnsafe(node.text, options) ||
    (node.lang && codeTextIsUnsafe(node.lang, options))
  ) {
    var langClass =
      node.lang && PLAIN_LANG_R.test(node.lang)
        ? ` class="language-${node.lang}"`
        : ''
    return `<pre><code${langClass}>${encodeCodeText(node.text, CODE_MARKUP_R)}\n</code></pre>`
  }
  // A backtick fence cannot carry an info string holding a backtick: it would
  // re-parse as a paragraph with the body live, so that info string gets tildes.
  var fenceChar = node.lang && node.lang.indexOf('`') !== -1 ? '~' : '`'
  var fenceCode = fenceChar.charCodeAt(0)
  // The fence must be longer than any run of its character inside the content,
  // or an interior ``` would terminate the block early on re-parse.
  var longest = 0
  var run = 0
  for (var i = 0; i < node.text.length; i++) {
    if (node.text.charCodeAt(i) === fenceCode) {
      run++
      if (run > longest) {
        longest = run
      }
    } else {
      run = 0
    }
  }
  var fence = fenceChar.repeat(longest < 3 ? 3 : longest + 1)
  return `${node.lang ? `${fence}${node.lang}\n` : `${fence}\n`}${node.text}\n${fence}`
}

function compileCodeInline(
  node: MarkdownToJSX.CodeInlineNode,
  options: WriterOptions
): string {
  var text = node.text
  if (codeTextIsUnsafe(text, options)) {
    return `<code>${encodeCodeText(text, CODE_SPAN_MARKUP_R)}</code>`
  }
  // The delimiter must be longer than the longest backtick run inside, or the
  // content would close the span early.
  var longest = 0
  var run = 0
  for (var i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === $.CHAR_BACKTICK) {
      run++
      if (run > longest) {
        longest = run
      }
    } else {
      run = 0
    }
  }
  var fence = '`'.repeat(longest + 1)
  // Pad with a space when the content abuts the delimiter with a backtick, so
  // the opening and closing runs stay distinct.
  var pad =
    text.length > 0 &&
    (text.charCodeAt(0) === $.CHAR_BACKTICK ||
      text.charCodeAt(text.length - 1) === $.CHAR_BACKTICK)
      ? ' '
      : ''
  return fence + pad + text + pad + fence
}

function compileTextFormatted(
  node: MarkdownToJSX.FormattedTextNode,
  state: CompilerState
): string {
  var content = ''
  for (var fi = 0; fi < node.children.length; fi++) {
    content += state.renderChild(node.children[fi], _emptyState)
  }
  // Nothing to format: `~~~~` beside a code span reads as text to marked, which
  // leaves the span's content live, and writing nothing would join its neighbors
  // (`<~~~~javascript:…>` into an autolink)
  if (!content) {
    return node.tag === 'del' ? '\\~\\~\\~\\~' : ''
  }
  switch (node.tag) {
    case 'em':
    case 'i':
      return `*${content}*`
    case 'strong':
    case 'b':
      return `**${content}**`
    case 'del':
    case 's':
      return `~~${content}~~`
    case 'mark':
      return `==${content}==`
    case 'code':
      return compileCodeInline(
        { type: RuleType.codeInline, text: content },
        state.options
      )
    default:
      return content
  }
}

/**
 * Serialize a link/image title for a `"..."` delimiter, escaping the backslash
 * and quote a bare title would otherwise use to close the title early. A `<`, `[`,
 * and `]` become entities, which re-parse to the same title and stay inert for a
 * downstream renderer that reads the line as text (a reference definition joined
 * to a paragraph above it, whose open `[` a `]` here would close).
 */
function escapeLinkTitle(title: string): string {
  return title
    .replace(BACKSLASH_R, '\\\\')
    .replace(/"/g, '\\"')
    .replace(MARKUP_LT_R, '&lt;')
    .replace(LEFT_BRACKET_R, '&#91;')
    .replace(RIGHT_BRACKET_R, '&#93;')
}

/**
 * A reference or footnote name, written the same in the reference and the
 * definition so the two still match. A renderer without footnotes reads the
 * reference as text, and a definition joined to a paragraph above it too.
 */
function writtenLabel(label: string): string {
  return label.replace(LABEL_MARKUP_R, c => LABEL_MARKUP_ENTITY[c])
}

/** Whether a destination passes the screen as a renderer reads it: entities decoded, backslash escapes gone. */
function isSafeDestination(url: string): boolean {
  return destinationVerdict(url) === URL_VERDICT.safe
}

/** What another renderer can split a destination at, reading what follows as a URL of its own */
const DESTINATION_SPLIT_R = /[\s<>()[\]"'`&\\]/

function destinationVerdict(
  url: string
): (typeof URL_VERDICT)[keyof typeof URL_VERDICT] {
  var decoded = decodeEntityReferences(
    url.replace(NUMERIC_REFERENCE_R, completeNumericReference)
  ).replace(BACKSLASH_R, '')
  var verdict = urlVerdict(decoded)

  return verdict === URL_VERDICT.safe &&
    DESTINATION_SPLIT_R.test(url) &&
    urlNamesBlockedScheme(decoded)
    ? URL_VERDICT.unsafe
    : verdict
}

/** A numeric reference as a decoder needs it: a browser needs no semicolon and takes any number of leading zeros */
function completeNumericReference(
  _match: string,
  decimal: string | undefined,
  hex: string | undefined
): string {
  return decimal ? `&#${decimal};` : `&#x${hex};`
}

/**
 * A renderer without footnotes reads `[^1]:` opening a block as a link reference,
 * with the text after it as the destination. Where it opens a block is out of reach
 * from a node (a leading hard break writes a line it reads as blank, a comment ends
 * its line), and `\:` reads the same to every renderer, so the colon always gets it.
 */
function compileInlineChild(
  children: MarkdownToJSX.ASTNode[],
  i: number,
  state: CompilerState
): string {
  var rendered = state.renderChild(children[i], _emptyState)
  return i > 0 &&
    children[i - 1].type === RuleType.footnoteReference &&
    children[i].type === RuleType.text &&
    rendered.charCodeAt(0) === $.CHAR_COLON
    ? `\\${rendered}`
    : rendered
}

/** Whether a UTF-16 code unit is ECMAScript whitespace or a line terminator, a wider set than isASCIIWhitespace */
function isECMAScriptSpace(code: number): boolean {
  return code <= $.CHAR_SPACE
    ? code === $.CHAR_SPACE || (code >= $.CHAR_TAB && code <= $.CHAR_CR)
    : code >= $.CHAR_NBSP &&
        (code === $.CHAR_NBSP ||
          code === 0x16_80 ||
          (code >= 0x20_00 && code <= 0x20_0a) ||
          code === 0x20_28 ||
          code === 0x20_29 ||
          code === 0x20_2f ||
          code === 0x20_5f ||
          code === 0x30_00 ||
          code === 0xfe_ff)
}

/**
 * Index of the `>` closing an autolink whose `<` is at `start`, or -1. The scheme
 * is a letter and then 1 to 31 scheme characters, and the body holds nothing up to
 * a space, `<`, or `>`. U+007F stays in the body, though CommonMark ends an autolink
 * there: marked reads it as a link. A second `<` ends the search there too:
 * neutralizing it would let this one close at a later `>`.
 */
function autolinkEnd(raw: string, start: number): number {
  if (!isASCIILetter(raw.charCodeAt(start + 1))) {
    return -1
  }
  var schemeStart = start + 2
  var schemeLimit = schemeStart + 31
  var at = schemeStart
  var code = raw.charCodeAt(at)
  while (
    at < schemeLimit &&
    (isAlnumCode(code) ||
      code === $.CHAR_PLUS ||
      code === $.CHAR_PERIOD ||
      code === $.CHAR_DASH)
  ) {
    code = raw.charCodeAt(++at)
  }
  if (at === schemeStart || code !== $.CHAR_COLON) {
    return -1
  }
  for (at++; at < raw.length; at++) {
    code = raw.charCodeAt(at)
    if (code === $.CHAR_GT || code === $.CHAR_LT) {
      return at
    }
    if (code <= $.CHAR_SPACE) {
      return -1
    }
  }
  return -1
}

/**
 * Index where the destination of the `](` or `]:` at `bracket` starts, past any
 * whitespace and one `<`, or -1 when no such opener is there. The destination runs
 * to whitespace, `)`, `>`, `]`, or the end, and may be empty.
 */
function linkDestinationStart(raw: string, bracket: number): number {
  var kind = raw.charCodeAt(bracket + 1)
  if (kind !== $.CHAR_PAREN_OPEN && kind !== $.CHAR_COLON) {
    return -1
  }
  var at = bracket + 2
  while (isECMAScriptSpace(raw.charCodeAt(at))) {
    at++
  }
  return raw.charCodeAt(at) === $.CHAR_LT ? at + 1 : at
}

/** Index where a link destination starting at `start` ends */
function linkDestinationEnd(raw: string, start: number): number {
  for (var at = start; at < raw.length; at++) {
    var code = raw.charCodeAt(at)
    if (
      code === $.CHAR_PAREN_CLOSE ||
      code === $.CHAR_GT ||
      code === $.CHAR_BRACKET_CLOSE ||
      isECMAScriptSpace(code)
    ) {
      return at
    }
  }
  return raw.length
}

/**
 * A raw string reaches the output as written, and a downstream renderer reads
 * markdown in it wherever it does not see an HTML block: a neutralized opener
 * (`&lt;div`), an inline tag's body, a block's body after a blank line. So an
 * inline link's `]` or an autolink's `<` with an unsafe destination becomes an
 * entity, which renders the same in raw HTML. An autolink's body is read too:
 * neutralized it is text, where a `]` pairs with any `[` before it, and a renderer
 * that ends an autolink sooner than CommonMark reads it as text already.
 */
function screenRawLinks(source: string): string {
  if (!RAW_SCREEN_SHAPE_R.test(source)) {
    return source
  }
  var raw = screenUnendedOpeners(
    screenMarkupBody(
      screenMarkupBody(screenLineSeparators(source), '<?', '?>'),
      '<![cdata[',
      ']]>'
    )
  )
  var length = raw.length
  var contentEnd = length
  while (isECMAScriptSpace(raw.charCodeAt(contentEnd - 1))) {
    contentEnd--
  }
  var bracket = indexOrEnd(raw, ']', 0)
  var angle = indexOrEnd(raw, '<', 0)
  var out = ''
  var copied = 0
  while (bracket < length || angle < length) {
    var isLink = bracket < angle
    var start = isLink ? bracket : angle
    var destinationStart = start + 1
    var destinationEnd = -1
    if (isLink) {
      destinationStart = linkDestinationStart(raw, start)
      if (destinationStart !== -1) {
        destinationEnd = linkDestinationEnd(raw, destinationStart)
      }
    } else {
      destinationEnd = autolinkEnd(raw, start)
    }

    var resume = start + 1
    if (destinationEnd !== -1) {
      if (isLink) {
        resume = destinationEnd
      }
      // An opener with nothing after it takes its destination from the next node,
      // which a tight list item writes one line down, out of sight here
      if (
        !isSafeDestination(raw.slice(destinationStart, destinationEnd)) ||
        (isLink && start + 2 === contentEnd)
      ) {
        out +=
          raw.slice(copied, start) +
          (isLink ? '&#93;' : '&lt;') +
          // A `<` left in the destination would still read as an autolink
          raw.slice(start + 1, resume).replace(LT_R, '&lt;')
        copied = resume
      }
    }
    if (bracket < resume) {
      bracket = indexOrEnd(raw, ']', resume)
    }
    if (angle < resume) {
      angle = indexOrEnd(raw, '<', resume)
    }
  }
  return screenRawImageAlts(out + raw.slice(copied))
}

/**
 * marked strips blockquote markers with a multiline `^`, which JavaScript also matches
 * after U+2028 and U+2029, so a tag's own `>` after one is removed and the tag stays open.
 */
function screenLineSeparators(raw: string): string {
  var out = ''
  var copied = 0
  for (var at = 0; at < raw.length; at++) {
    var code = raw.charCodeAt(at)
    if (code === 0x20_28 || code === 0x20_29) {
      var after = at + 1
      while (after < at + 4 && raw.charCodeAt(after) === $.CHAR_SPACE) {
        after++
      }
      if (raw.charCodeAt(after) === $.CHAR_GT) {
        out += `${raw.slice(copied, at)}&#${code};`
        copied = at + 1
      }
    }
  }
  return copied ? out + raw.slice(copied) : raw
}

/** Index of `needle` at or after `from`, or the end of `text` */
function indexOrEnd(text: string, needle: string, from: number): number {
  var index = text.indexOf(needle, from)
  return index === -1 ? text.length : index
}

/**
 * A raw string can read as an image whose alt holds a quote, and marked 17 copies
 * alt into a quoted attribute unescaped. So a `![` with a `"` and then a `]` ahead
 * of the next blank line becomes an entity. Each search resumes where the last
 * ended, which keeps a run of `![` linear.
 */
function screenRawImageAlts(raw: string): string {
  var opener = raw.indexOf('![')
  var quote = -1
  var close = -1
  var paragraphEnd = -1
  var out = ''
  var copied = 0
  while (opener !== -1) {
    if (quote < opener) {
      quote = indexOrEnd(raw, '"', opener)
    }
    if (close < quote) {
      close = indexOrEnd(raw, ']', quote)
    }
    if (paragraphEnd < opener) {
      paragraphEnd = indexOrEnd(raw, '\n\n', opener)
    }
    if (close < paragraphEnd) {
      out += `${raw.slice(copied, opener)}!&#91;`
      copied = opener + 2
    }
    opener = raw.indexOf('![', opener + 2)
  }
  return out + raw.slice(copied)
}

/**
 * Index past a type 1 tag name at `at`, or -1. A name followed by a word character
 * is another name.
 */
function type1NameEnd(text: string, at: number): number {
  for (var i = 0; i < TYPE1_TAG_NAMES.length; i++) {
    var end = at + TYPE1_TAG_NAMES[i].length
    var after = text.charCodeAt(end)
    if (
      matchesFolded(text, at, TYPE1_TAG_NAMES[i]) &&
      !isAlnumCode(after) &&
      after !== $.CHAR_UNDERSCORE
    ) {
      return end
    }
  }
  return -1
}

/** Index just past `needle` at or after `from`, or -1 */
function indexPast(text: string, needle: string, from: number): number {
  var index = text.indexOf(needle, from)
  return index === -1 ? -1 : index + needle.length
}

/**
 * Index past an opener a renderer stays inside until its closer, with its `<` at
 * `at`, or -1: a type 1 tag or other raw markup, in any ASCII case.
 */
function rawModeOpenerEnd(text: string, at: number): number {
  var kind = text.charCodeAt(at + 1)
  if (kind === $.CHAR_QUESTION) {
    return at + 2
  }
  if (kind !== $.CHAR_EXCLAMATION) {
    return type1NameEnd(text, at + 1)
  }
  if (text.startsWith('--', at + 2)) {
    return at + 4
  }
  if (matchesFolded(text, at + 2, '[cdata[')) {
    return at + 9
  }
  return isASCIILetter(text.charCodeAt(at + 2)) ? at + 3 : -1
}

/**
 * A browser ends a processing instruction or CDATA section at its first `>`, and
 * a renderer at its terminator, which can sit inside a value of a tag the browser
 * reads past that `>`. A renderer can then move or escape what follows the
 * terminator, so the value's closing quote pairs with a later one, reading text
 * there as attributes. Such a tag is written as text, wherever a raw string holds
 * the markup: a renderer can reach it past anything before it. The search stops at
 * the first terminator it does not find, so it stays linear.
 */
function screenMarkupBody(
  raw: string,
  opener: string,
  terminator: string
): string {
  var length = raw.length
  var out = ''
  var copied = 0
  var at = indexOfCi(raw, opener, 0, length)
  while (at !== -1) {
    var end = indexPast(raw, terminator, at + opener.length)
    if (end === -1) {
      break
    }
    var lessThan = raw.indexOf('<', raw.indexOf('>', at))
    while (lessThan !== -1 && lessThan < end) {
      if (isASCIILetter(raw.charCodeAt(lessThan + 1))) {
        out += `${raw.slice(copied, lessThan)}&lt;`
        copied = lessThan + 1
      }
      lessThan = raw.indexOf('<', lessThan + 1)
    }
    at = indexOfCi(raw, opener, end, length)
  }
  return copied ? out + raw.slice(copied) : raw
}

/**
 * Whether the opener at `at` has no closer in `raw`. `lastCloser` keeps it to one
 * search per closer: the openers in a string are unbounded.
 */
function isUnendedOpener(
  raw: string,
  at: number,
  lastCloser: Partial<Record<string, number>>
): boolean {
  var openerEnd = rawModeOpenerEnd(raw, at)
  if (openerEnd === -1) {
    return false
  }
  var opener = raw.slice(at + 1, openerEnd).toLowerCase()
  var closer =
    RAW_MODE_MARKUP_CLOSER[opener] ||
    (opener.charCodeAt(0) === $.CHAR_EXCLAMATION ? '>' : `</${opener}>`)
  var closerAt = lastCloser[closer]
  if (closerAt === undefined) {
    closerAt = lastCloser[closer] = lastIndexOfCi(raw, closer, raw.length)
  }
  return closerAt < openerEnd
}

/**
 * A renderer can start over inside a raw string, at a blank line or after a first
 * line it reads as text, so a line opening markup with no closer here is raw HTML
 * to it through the end of the document. A browser reads what that hides as written,
 * past the opener's first `>` or an element the opener sat in
 * (`<title>a\n\n<!--</title>`).
 */
function screenUnendedOpeners(raw: string): string {
  var lineStart = raw.indexOf('\n') + 1
  if (lineStart === 0) {
    return raw
  }
  var length = raw.length
  var lastCloser: Partial<Record<string, number>> = {}
  var out = ''
  var copied = 0
  while (lineStart < length) {
    var at = lineStart
    var code = raw.charCodeAt(at)
    while (code === $.CHAR_SPACE || code === $.CHAR_TAB) {
      code = raw.charCodeAt(++at)
    }
    if (code === $.CHAR_LT && isUnendedOpener(raw, at, lastCloser)) {
      out += `${raw.slice(copied, at)}&lt;`
      copied = at + 1
    }
    lineStart = indexOrEnd(raw, '\n', at) + 1
  }
  return copied ? out + raw.slice(copied) : raw
}

/** A backslash a renderer would read as an escape: before ASCII punctuation, or before the `)` written after the destination */
const ESCAPING_BACKSLASH_R = /\\(?=[!-/:-@[-`{-~]|$)/g

/**
 * A destination with whitespace or an angle bracket (a footnote's text under
 * `[r][^1]`, a `<a b>` destination) is not one a renderer reads between plain
 * parentheses: it would leave them as text and any markup in it live.
 * Percent-encoding is what the other outputs emit for it.
 */
function writeDestination(url: string): string {
  const written = UNREADABLE_DESTINATION_R.test(url)
    ? encodeUrlTarget(url)
    : url

  return hasUnbalancedParen(written)
    ? `<${written.replace(BACKSLASH_R, '\\\\')}>`
    : written.replace(ESCAPING_BACKSLASH_R, '\\\\')
}

/** A destination outside angle brackets ends at a paren with no partner */
function hasUnbalancedParen(url: string): boolean {
  var depth = 0
  for (var i = 0; i < url.length; i++) {
    var code = url.charCodeAt(i)
    if (code === $.CHAR_PAREN_OPEN) {
      depth++
    } else if (code === $.CHAR_PAREN_CLOSE && --depth < 0) {
      return true
    }
  }
  return depth !== 0
}

function compileLink(
  node: MarkdownToJSX.LinkNode,
  state: CompilerState
): string {
  var text = ''
  for (var li = 0; li < node.children.length; li++) {
    text += state.renderChild(node.children[li], _emptyState)
  }
  // The parser keeps an autolink's scheme and the other outputs screen it at render
  const url =
    node.target && isSafeDestination(node.target)
      ? writeDestination(node.target)
      : ''
  const title = url ? node.title : undefined

  if (state.options.useReferenceLinks) {
    const refKey = generateReferenceKey(state)
    if (!state.references.has(refKey)) {
      state.references.set(refKey, { url, title })
    }
    return `[${text}][${refKey}]`
  }

  return title
    ? `[${text}](${url} "${escapeLinkTitle(title)}")`
    : `[${text}](${url})`
}

function compileImage(
  node: MarkdownToJSX.ImageNode,
  state: CompilerState
): string {
  // A renderer writes alt into a quoted attribute, and marked 17 does so unescaped.
  // A bare `]` would end the image early and turn the rest of the alt into markdown.
  const alt = (node.alt || '')
    .replace(ALT_BRACKET_R, '\\$&')
    .replace(MARKUP_LT_R, '&lt;')
    .replace(ALT_QUOTE_R, '&quot;')
  // Rejected destinations are null; keep the round-trip as ![alt]() so a
  // leftover title cannot become a live destination on re-parse. A target the
  // parser passed can still decode to a scheme once a renderer reads it.
  const url =
    node.target && isSafeDestination(node.target)
      ? writeDestination(node.target)
      : ''
  const title = url ? node.title : undefined

  if (state.options.useReferenceLinks) {
    const refKey = generateReferenceKey(state)
    if (!state.references.has(refKey)) {
      state.references.set(refKey, { url, title })
    }
    return `![${alt}][${refKey}]`
  }

  return title
    ? `![${alt}](${url} "${escapeLinkTitle(title)}")`
    : `![${alt}](${url})`
}

/**
 * Block-level node types that need a line break separating them from a
 * sibling inside a list item; inline siblings continue on the same line.
 */
function isBlockListChild(t: MarkdownToJSX.ASTNode['type']): boolean {
  return (
    t === RuleType.blockQuote ||
    t === RuleType.breakThematic ||
    t === RuleType.codeBlock ||
    t === RuleType.heading ||
    t === RuleType.htmlBlock ||
    t === RuleType.orderedList ||
    t === RuleType.paragraph ||
    t === RuleType.table ||
    t === RuleType.unorderedList
  )
}

/**
 * Render a list item's children, separating block-level siblings: two
 * block siblings get a blank line (loose item), an inline/block boundary
 * gets a single line break. Inline runs stay joined on one line.
 */
function compileListItemChildren(
  item: MarkdownToJSX.ASTNode[],
  state: CompilerState
): string {
  var content = ''
  // A renderer's HTML block runs to a blank line, so a block sibling after raw
  // HTML needs one or a code fence is read as part of the raw HTML
  var sawRawHtml = false
  for (var i = 0; i < item.length; i++) {
    var type = item[i].type
    if (i > 0) {
      var prevBlock = isBlockListChild(item[i - 1].type)
      var curBlock = isBlockListChild(type)
      if (curBlock && (prevBlock || sawRawHtml)) {
        content += '\n\n'
      } else if (prevBlock || curBlock) {
        content += '\n'
      }
    }
    sawRawHtml =
      sawRawHtml ||
      type === RuleType.htmlBlock ||
      type === RuleType.htmlSelfClosing ||
      type === RuleType.htmlComment
    var written = compileInlineChild(item, i, state)
    // A custom rule can return anything for these nodes, and text is not a tag
    var opensTag =
      (type === RuleType.htmlBlock || type === RuleType.htmlSelfClosing) &&
      written.charCodeAt(0) === $.CHAR_LT
    content +=
      opensTag && written.indexOf('\n') !== -1
        ? openTagOnOneLine(written)
        : written
  }
  return content
}

/**
 * Write a raw element's opening tag on one line. A renderer can end an HTML
 * block on the line a tag starts, and a tight list then joins the next line to
 * it, so the text after a split tag reads as that tag's attributes. A line break
 * between attributes means the same as a space, and one in a quoted value the
 * same as `&#10;`. One in a `{…}` value folds too and changes that value: a
 * renderer splits the tag there all the same, so keeping it lets a handler go live.
 */
function openTagOnOneLine(written: string): string {
  var out = ''
  var quote = 0
  var segStart = 0
  for (var i = 0; i < written.length; i++) {
    var c = written.charCodeAt(i)
    if (quote) {
      if (c === quote) {
        quote = 0
      }
    } else if (c === $.CHAR_DOUBLE_QUOTE || c === $.CHAR_SINGLE_QUOTE) {
      quote = c
    } else if (c === $.CHAR_GT) {
      break
    }
    if (c === $.CHAR_NEWLINE) {
      out += written.slice(segStart, i) + (quote ? '&#10;' : ' ')
      segStart = i + 1
    }
  }
  return out + written.slice(segStart)
}

/**
 * A list is loose when the parser kept paragraph wrappers inside its items
 * (tight items are unwrapped to inline children). A loose list separates its
 * items with a blank line so it re-parses loose and keeps its `<p>` wrappers.
 */
function isLooseList(items: MarkdownToJSX.ASTNode[][]): boolean {
  for (var i = 0; i < items.length; i++) {
    for (var j = 0; j < items[i].length; j++) {
      if (items[i][j].type === RuleType.paragraph) {
        return true
      }
    }
  }
  return false
}

function compileOrderedList(
  node: MarkdownToJSX.OrderedListNode,
  state: CompilerState
): string {
  var start = node.start || 1
  var separator = isLooseList(node.items) ? '\n\n' : '\n'
  var out = ''
  for (var oi = 0; oi < node.items.length; oi++) {
    var itemContent = compileListItemChildren(node.items[oi], state)
    if (oi > 0) {
      out += separator
    }
    var marker = `${start + oi}. `
    out += marker + itemContent.replace(/\n/g, `\n${' '.repeat(marker.length)}`)
  }
  return out
}

function compileUnorderedList(
  node: MarkdownToJSX.UnorderedListNode,
  state: CompilerState
): string {
  var separator = isLooseList(node.items) ? '\n\n' : '\n'
  var out = ''
  for (var ui = 0; ui < node.items.length; ui++) {
    var uContent = compileListItemChildren(node.items[ui], state)
    if (ui > 0) {
      out += separator
    }
    out += `- ${uContent.replace(/\n/g, '\n  ')}`
  }
  return out
}

function compileBlockQuote(
  node: MarkdownToJSX.BlockQuoteNode,
  state: CompilerState
): string {
  // Single-pass: render children, then prefix lines with > while scanning for \n
  var rendered = ''
  for (var qi = 0; qi < node.children.length; qi++) {
    if (qi > 0) {
      rendered += '\n\n'
    }
    rendered += state.renderChild(node.children[qi], _emptyState)
  }
  // Prefix each line with >; an alert blockquote re-emits its marker line
  // first so the round-trip re-parses to the same alert (mirrors the html
  // compiler, which renders the alert as a header + class).
  var out = node.alert ? `> [!${node.alert}]` : ''
  var segStart = 0
  for (var ri = 0; ri <= rendered.length; ri++) {
    if (ri === rendered.length || rendered.charCodeAt(ri) === $.CHAR_NEWLINE) {
      var line = rendered.slice(segStart, ri)
      if (out) {
        out += '\n'
      }
      out += line.trim() ? `> ${line}` : '>'
      segStart = ri + 1
    }
  }
  return out
}

function compileTable(
  node: MarkdownToJSX.TableNode,
  state: CompilerState
): string {
  // Emit outer pipes and escape only a bare pipe. An escape pair stays whole:
  // `\|` is already a cell's literal pipe, and `\[` or `\*` guard markup that
  // doubling the backslash would leave live. Without the outer pipes a
  // single-column table re-parses as a setext heading.
  var compileRow = (cells: MarkdownToJSX.ASTNode[][]): string => {
    var out = '|'
    for (var j = 0; j < cells.length; j++) {
      var cell = ''
      for (var k = 0; k < cells[j].length; k++) {
        cell += state.renderChild(cells[j][k], _emptyState)
      }
      out += ` ${cell.replace(CELL_PIPE_R, match => (match === '|' ? '\\|' : match))} |`
    }
    return out
  }

  var headerRow = compileRow(node.header)

  var columns = node.align.length > 0 ? node.align.length : node.header.length
  var finalSeparator = '|'
  for (var ci = 0; ci < columns; ci++) {
    var align = node.align[ci]
    finalSeparator +=
      align === 'left'
        ? ' :--- |'
        : align === 'right'
          ? ' ---: |'
          : align === 'center'
            ? ' :---: |'
            : ' --- |'
  }

  var dataRows = ''
  for (var di = 0; di < node.cells.length; di++) {
    if (di > 0) {
      dataRows += '\n'
    }
    dataRows += compileRow(node.cells[di])
  }

  return dataRows
    ? `${headerRow}\n${finalSeparator}\n${dataRows}`
    : `${headerRow}\n${finalSeparator}`
}

function compileHtmlBlock(
  node: MarkdownToJSX.HTMLNode,
  state: CompilerState
): string {
  const defaultTag = node.tag || 'div'
  const tag = getTag(defaultTag, state.overrides)

  // An orphan closing tag re-emits as the bare closing tag; _rawBody carries
  // any trailing same-line content (mirrors the html compiler).
  if (node._isClosingTag) {
    return `</${tag}>${screenRawLinks(node._rawBody || '')}`
  }

  // A children attribute is the element's content when it has none of its own
  // (an empty pair or a self-closing tag), and is never written as an attribute
  const attrText =
    node.attrs !== undefined && node.attrs.children !== undefined
      ? childrenAttrContent(node.attrs.children, [
          node.children,
          node.text,
          node._rawBody,
        ])
      : undefined

  // _rawOuter is the full span (own opener through closer, or through end of
  // input) and is emitted without an added wrapper, except for an empty pair
  // that takes content.
  if (
    node._verbatim &&
    node._rawOuter !== undefined &&
    attrText === undefined
  ) {
    return screenRawLinks(node._rawOuter)
  }

  const overrideProps = getOverrideProps(defaultTag, state.overrides)
  // Prefer the raw source attribute string (mirrors the html compiler): the
  // parsed attrs map loses formatting, turning a style object into
  // `[object Object]` and collapsing expression attributes. Override props are
  // appended after the raw attributes so they win.
  let attrs: string
  if (node._rawAttrs === undefined) {
    // `false` writes nothing, which keeps children from an attribute
    attrs = compileAttributes({
      ...withoutHandlerSource(defaultTag, node.attrs, state.overrides),
      children: false,
      ...overrideProps,
    })
  } else {
    const raw = node._rawAttrs
    const needsLeadingSpace = raw.length > 0 && raw.charCodeAt(0) > $.CHAR_SPACE
    attrs =
      (needsLeadingSpace ? ' ' : '') +
      raw +
      (Object.keys(overrideProps).length > 0
        ? ` ${compileAttributes(overrideProps).trim()}`
        : '')
  }

  // Check if this is a void element (self-closing)
  const isVoid = isVoidElement(tag)

  // Verbatim raw source already carries its own closing tag, so the body and
  // closer are appended after the reconstructed opening tag.
  if (node._verbatim && (node._rawBody || node._rawClose)) {
    return screenRawLinks(
      `<${tag}${attrs}>${node._rawBody || ''}${node._rawClose || ''}`
    )
  }
  // The deprecated text field holds inner content only, so a non-void element
  // needs its closing tag appended or the round-trip drops it (a following
  // sibling would then be absorbed into this element).
  if (node.text) {
    // Whole, since a separator ending the attributes pairs with the tag's own `>`
    return screenRawLinks(
      `<${tag}${attrs}>${node.text}${isVoid ? '' : `</${tag}>`}`
    )
  }

  // For HTML blocks with children, reconstruct the HTML. Empty children emit no
  // content: the newline wrapping used for block formatting would otherwise
  // split the surrounding paragraph when the element sits inline.
  const content =
    node.children && node.children.length > 0
      ? `\n${node.children.map(child => state.renderChild(child, _emptyState)).join('\n')}\n`
      : attrText === undefined || isVoid
        ? ''
        : compileElementText(attrText)
  const closingTag = isVoid ? '' : `</${tag}>`
  return `${screenRawLinks(`<${tag}${attrs}>`)}${content}${closingTag}`
}

/**
 * Compile self-closing HTML tag
 */
function compileHtmlSelfClosing(
  node: MarkdownToJSX.HTMLSelfClosingNode,
  state: CompilerState
): string {
  // An orphan closing tag and a self-contained leaf (processing instruction,
  // CDATA section, declaration) carry no attrs/overrides to reconstruct from;
  // their true source is the only faithful round-trip.
  if (node._isClosingTag) {
    return node._rawClose || `</${node.tag}>`
  }
  // A children attribute is the element's content and never an attribute
  const attrText =
    node.attrs !== undefined && node.attrs.children !== undefined
      ? childrenAttrContent(node.attrs.children, null)
      : undefined
  if (node._rawOpen && attrText === undefined) {
    return screenRawLinks(node._rawOpen)
  }
  const defaultTag = node.tag || 'div'
  const tag = getTag(defaultTag, state.overrides)
  const overrideProps = getOverrideProps(defaultTag, state.overrides)
  // `false` writes nothing, which keeps children from an attribute
  const attrs = node._rawOpen
    ? rawOpenTagAttrs(node._rawOpen, defaultTag.length) +
      compileAttributes(overrideProps)
    : compileAttributes({
        ...withoutHandlerSource(defaultTag, node.attrs, state.overrides),
        children: false,
        ...overrideProps,
      })
  if (attrText === undefined) {
    return `<${tag}${attrs} />`
  }
  return `${screenRawLinks(`<${tag}${attrs}>`)}${
    isVoidElement(tag) ? '' : `${compileElementText(attrText)}</${tag}>`
  }`
}

function compileHtmlComment(node: MarkdownToJSX.HTMLCommentNode): string {
  // Mirror the html compiler: a raw comment already carries its own delimiters
  // (wrapping again would nest them), and an unterminated `<!--... >` comment
  // keeps its single-`>` close.
  if (node.raw) {
    return screenRawLinks(node.text)
  }
  // A renderer can read a comment as broken open, leaving its text as markdown
  var text = screenRawLinks(node.text)
  return node._endsWithGT ? `<!--${text}>` : `<!--${text}-->`
}

function compileFootnoteReference(
  node: MarkdownToJSX.FootnoteReferenceNode
): string {
  return `[^${writtenLabel(node.text)}]`
}

function compileFrontmatter(node: MarkdownToJSX.FrontmatterNode): string {
  // The parser stores the full raw block including its --- delimiters
  // (the html compiler renders node.text as-is inside <pre>), so wrapping
  // again would double the delimiters and break the round-trip.
  return node.text
}

function compileGfmTask(node: MarkdownToJSX.GFMTaskNode): string {
  return node.completed ? '[x]' : '[ ]'
}

/**
 * A footnote stores its source as written. Text with no `<` and no unsafe link
 * stays byte-exact; anything else goes through the parser, the one place that
 * tells raw HTML or a link, which it screens, from a code span holding the same
 * text.
 */
function compileFootnoteDefinition(
  source: string,
  refs: MarkdownToJSX.ReferenceCollectionNode['refs'],
  state: CompilerState
): string {
  if (source.indexOf('<') === -1 && screenRawLinks(source) === source) {
    return source
  }
  // A copy: the inline pass registers definitions it finds in the state's refs
  var nodes = parseMarkdown(
    source,
    { inline: true, refs: { ...refs } },
    toParseOptions(state.options)
  )
  var out = ''
  for (var ni = 0; ni < nodes.length; ni++) {
    if (nodes[ni].type !== RuleType.refCollection) {
      out += state.renderChild(nodes[ni], _emptyState)
    }
  }
  return out
}

/**
 * A renderer without footnotes reads `[^1]: x` as a link reference whose
 * destination is the body's first word. A comment before an unsafe one breaks
 * that reading, since a destination opening with `<` must close at its `>`, and
 * draws nothing for a renderer with footnotes. A word that cannot be decoded, such
 * as `100%`, names no scheme, and a word already behind the comment stays as it is.
 */
function screenFootnoteDestination(body: string): string {
  var word = FIRST_WORD_R.exec(body)
  if (!word || word[1].startsWith(FOOTNOTE_DESTINATION_BREAK)) {
    return body
  }
  var verdict = destinationVerdict(word[1])
  return verdict === URL_VERDICT.safe || verdict === URL_VERDICT.malformed
    ? body
    : FOOTNOTE_DESTINATION_BREAK + body
}

function compileReferenceCollection(
  node: MarkdownToJSX.ReferenceCollectionNode,
  state: CompilerState
): string {
  return Object.entries(node.refs)
    .map(([key, { target, title }]) => {
      var isFootnote = key.charCodeAt(0) === $.CHAR_CARET
      var destination = isFootnote
        ? screenFootnoteDestination(
            compileFootnoteDefinition(target, node.refs, state)
          )
        : isSafeDestination(target)
          ? writeDestination(target)
          : '<>'
      var label = writtenLabel(key)
      return title
        ? `[${label}]: ${destination} "${escapeLinkTitle(title)}"`
        : `[${label}]: ${destination}`
    })
    .join('\n')
}

function generateReferenceKey(state: CompilerState): string {
  return `ref${state.referenceIndex++}`
}

function compileAttributes(attrs: Record<string, any>): string {
  return Object.entries(attrs || {})
    .map(([key, value]) => {
      // Convert className back to class for HTML output
      const attrName = key === 'className' ? 'class' : key
      return typeof value === 'boolean'
        ? value
          ? ` ${attrName}`
          : ''
        : ` ${attrName}="${String(value).replace(/"/g, '&quot;')}"`
    })
    .join('')
}
