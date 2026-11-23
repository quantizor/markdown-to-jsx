import { $ } from './constants.ts'
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
  opensSvgAsPage,
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

  var refs: { [key: string]: { target: string; title: string | undefined } } =
    Object.create(null)
  var nonRefCollectionNodes: MarkdownToJSX.ASTNode[] = []
  var foundRefCollection = false

  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i]
    if (node.type === RuleType.refCollection && !foundRefCollection) {
      refs = node.refs || Object.create(null)
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

  if (
    nonRefCollectionNodes.length > 1 &&
    nonRefCollectionNodes[0].type === RuleType.refCollection &&
    nonRefCollectionNodes[1].type === RuleType.frontmatter
  ) {
    nonRefCollectionNodes.unshift(nonRefCollectionNodes.splice(1, 1)[0])
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

  var depth = 0

  function nestedStatefulRender(
    node: MarkdownToJSX.ASTNode,
    stateWithKey: MarkdownToJSX.State = _emptyState
  ): string {
    if (depth >= $.MAX_RENDER_DEPTH) {
      return 'text' in node && node.text
        ? compileText({ type: RuleType.text, text: node.text }, state)
        : ''
    }

    depth++
    var out = options?.renderRule
      ? options.renderRule(
          () => renderNodeDefault(node),
          node,
          renderChildren,
          stateWithKey
        )
      : renderNodeDefault(node)
    depth--
    return out
  }

  function renderChildren(children: MarkdownToJSX.ASTNode[]): string {
    var out = ''
    for (var ci = 0; ci < children.length; ci++) {
      out += nestedStatefulRender(children[ci], _emptyState)
    }
    return out
  }

  const state: CompilerState = {
    inLink: false,
    options: options || {},
    references: new Map(),
    referenceIndex: 1,
    overrides,
    renderChild: nestedStatefulRender,
    underscorePlans: new WeakMap(),
  }

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

export const markdown: typeof astToMarkdown = astToMarkdown

type WriterOptions = Omit<MarkdownCompilerOptions, 'overrides'> &
  Pick<ParserInputOptions, 'overrides'>

interface CompilerState {
  inLink: boolean
  options: WriterOptions
  references: Map<string, { url: string; title?: string }>
  referenceIndex: number
  overrides?: MarkdownOverrides
  renderChild: (
    node: MarkdownToJSX.ASTNode,
    stateWithKey?: MarkdownToJSX.State
  ) => string
  underscorePlans: WeakMap<MarkdownToJSX.ASTNode[], Uint8Array>
}

function compileNode(
  node: MarkdownToJSX.ASTNode,
  state: CompilerState
): string {
  switch (node.type) {
    case RuleType.text:
      return compileText(node, state)

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
      return ''
  }
}

const TEXT_ESCAPE_R =
  /\]\(|[\\`*_[\]~]|<(?=[a-zA-Z/!?])|&(?=#?\w+;)|(^|\n)([ \t]*)(?:([#>=|+-])|(\d{1,9})([.)]))|==+/g

const TEXT_NEEDS_ESCAPE_R =
  /[\\`*_[\]~&@]|www\.|:\/\/|==|<[a-zA-Z/!?]|^[(﻿]|(?:^|\n)[ \t]*(?:[#>=|+-]|\d{1,9}[.)])/

const BARE_URL_START_R =
  /www\.(?![ \t\n\r<>])|(?:https?|ftp):\/\/(?![ \t\n\r<>])|[\w.!#$%&'*+/=?^`{|}~-]@(?=[\w-]*(?:\.[a-zA-Z0-9]|$))|^@$/g

const BACKSLASH_R = /\\/g
const CODE_BLOCK_MARKUP_R = /[&<[\]`*_~\\|]/g
const PLAIN_LANG_R = /^[a-zA-Z0-9+#.-]+$/
const RAW_SCREEN_TRIGGER_R =
  /[^\t-~] {0,3}>|\][(:]|!\[|<(?:[?!]|pre|script|style|textarea|[a-z][a-z0-9+.-]{1,31}:)/i
const CODE_SPAN_MARKUP_R = /[&<[\]`*_~\\|:.@]/g
const FOOTNOTE_DESTINATION_BREAK = '<!---->'
const LABEL_MARKUP_R = /[<[(]/g
const LABEL_MARKUP_ENTITY: Record<string, string> = {
  '(': '&#40;',
  '<': '&lt;',
  '[': '&#91;',
}
const ENTITY_AMPERSAND_R = /&(?=#?\w+;)/g
const LEFT_BRACKET_R = /\[/g
const RIGHT_BRACKET_R = /\]/g
const MARKUP_LT_R = /<(?=[a-zA-Z/!?])/g
const QUOTE_R = /"/g
const ALT_BRACKET_OR_BACKSLASH_R = /[[\]\\]/g
const LT_R = /</g
const UNREADABLE_DESTINATION_R = /[\s<>\u0000-\u001F\u007F]/
const CELL_ESCAPE_PAIR_OR_PIPE_R = /\\[\s\S]|\|/g
const FIRST_WORD_R = /^\s*(\S*)/
const NUMERIC_REFERENCE_R = /&#(?:0*(\d+)|x0*([\da-f]+));?/gi
const LINE_BREAK_R = / *\n */g
const RAW_MODE_MARKUP_CLOSER: Partial<Record<string, string>> = {
  '!--': '-->',
  '![cdata[': ']]>',
  '?': '?>',
}

function compileText(
  node: MarkdownToJSX.TextNode,
  state: CompilerState
): string {
  var text = node.text
  if (text === '<') {
    return '&lt;'
  }
  if (!TEXT_NEEDS_ESCAPE_R.test(text)) {
    return text
  }
  var out = text.replace(TEXT_ESCAPE_R, escapeTextMatch)
  var mayAutolink =
    out.indexOf('@') !== -1 ||
    out.indexOf('www.') !== -1 ||
    out.indexOf('://') !== -1
  if (mayAutolink && !(state.inLink || state.options.disableAutoLink)) {
    out = out.replace(
      BARE_URL_START_R,
      match => `${match.slice(0, -1)}\\${match.slice(-1)}`
    )
  }
  var first = out.charCodeAt(0)
  if (first === $.CHAR_PAREN_OPEN) {
    return `\\${out}`
  }
  return first === $.CHAR_BYTE_ORDER_MARK ? `&#xFEFF;${out.slice(1)}` : out
}

function escapeTextMatch(
  match: string,
  lineStart: string | undefined,
  indent: string,
  blockChar: string | undefined,
  digits: string,
  marker: string,
  at: number,
  text: string
): string {
  if (lineStart === undefined) {
    if (match.charCodeAt(0) === $.CHAR_EQ) {
      return opensHighlight(match, at, text) ? `\\${match}` : match
    }
    if (match === '<') {
      return '&lt;'
    }
    if (match === '](') {
      return '\\]\\('
    }
    return match === '&' ? '&amp;' : `\\${match}`
  }
  if (blockChar !== undefined) {
    return `${lineStart + indent}\\${blockChar}`
  }
  return `${lineStart + indent + digits}\\${marker}`
}

function opensHighlight(run: string, at: number, text: string): boolean {
  return run.length === 2 && text.charCodeAt(at + 2) > $.CHAR_SPACE
}

function isHighlight(node: MarkdownToJSX.ASTNode | undefined): boolean {
  return (
    node !== undefined &&
    node.type === RuleType.textFormatted &&
    node.tag === 'mark'
  )
}

function escapeEqAt(s: string, at: number): string {
  if (at < 0 || s.charCodeAt(at) !== $.CHAR_EQ) {
    return s
  }
  var slashes = 0
  for (var i = at - 1; i >= 0 && s.charCodeAt(i) === $.CHAR_BACKSLASH; i--) {
    slashes++
  }
  return slashes % 2 ? s : `${s.slice(0, at)}\\${s.slice(at)}`
}

function escapeTrailingEq(s: string): string {
  return escapeEqAt(s, s.length - 1)
}

function escapeEqBeforeSibling(
  children: MarkdownToJSX.ASTNode[],
  i: number,
  rendered: string
): string {
  var after = i + 1
  while (after < children.length && children[after].type === RuleType.text) {
    after++
  }
  if (isHighlight(children[after])) {
    rendered = escapeTrailingEq(rendered)
  }
  return after < children.length &&
    rendered.charCodeAt(rendered.length - 1) === $.CHAR_EQ &&
    rendered.charCodeAt(rendered.length - 2) === $.CHAR_EQ
    ? escapeEqAt(rendered, rendered.length - 2)
    : rendered
}

function compileElementText(text: string): string {
  return text.replace(TEXT_ESCAPE_R, entityTextMatch)
}

function entityTextMatch(
  match: string,
  lineStart: string | undefined,
  indent: string,
  blockChar: string | undefined,
  digits: string,
  marker: string,
  at: number,
  text: string
): string {
  if (lineStart === undefined) {
    if (match.charCodeAt(0) === $.CHAR_EQ) {
      return opensHighlight(match, at, text) ? '&#61;=' : match
    }
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

  var oneLine =
    content.indexOf('\n') === -1 ? content : content.replace(LINE_BREAK_R, ' ')

  return `${'#'.repeat(node.level)}${state.options.enforceAtxHeadings === false ? '' : ' '}${escapeClosingSequence(oneLine)}`
}

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
    return `<pre><code${langClass}>${encodeCodeText(node.text, CODE_BLOCK_MARKUP_R)}\n</code></pre>`
  }
  var fenceChar = node.lang && node.lang.indexOf('`') !== -1 ? '~' : '`'
  var fenceCode = fenceChar.charCodeAt(0)
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
    content += compileInlineChild(node.children, fi, state)
  }
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
      return `==${escapeTrailingEq(content)}==`
    case 'code':
      return compileCodeInline(
        { type: RuleType.codeInline, text: content },
        state.options
      )
    default:
      return content
  }
}

function escapeLinkTitle(title: string): string {
  return title
    .replace(BACKSLASH_R, '\\\\')
    .replace(ENTITY_AMPERSAND_R, '&amp;')
    .replace(QUOTE_R, '\\"')
    .replace(MARKUP_LT_R, '&lt;')
    .replace(LEFT_BRACKET_R, '&#91;')
    .replace(RIGHT_BRACKET_R, '&#93;')
}

function writtenLabel(label: string): string {
  return label.replace(LABEL_MARKUP_R, c => LABEL_MARKUP_ENTITY[c])
}

function isSafeDestination(url: string): boolean {
  return destinationVerdict(url) === URL_VERDICT.safe
}

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

function completeNumericReference(
  _match: string,
  decimal: string | undefined,
  hex: string | undefined
): string {
  return decimal ? `&#${decimal};` : `&#x${hex};`
}

function compileInlineChild(
  children: MarkdownToJSX.ASTNode[],
  i: number,
  state: CompilerState
): string {
  var node = children[i]
  if (node.type === RuleType.text) {
    if (i > 0 && children[i - 1].type === RuleType.text) {
      return ''
    }
    var next = children[i + 1]
    if (next !== undefined && next.type === RuleType.text) {
      node = textRun(children, i)
    }
  }
  var rendered = underscoreAdjacentEmphasis(
    children,
    i,
    state.renderChild(node, _emptyState),
    state
  )
  if (
    node.type === RuleType.text &&
    rendered.charCodeAt(rendered.length - 1) === $.CHAR_EQ
  ) {
    // Kept out of line: written inline, it makes this function too large for
    // V8 to inline and markdown output in Chrome runs 4% slower.
    rendered = escapeEqBeforeSibling(children, i, rendered)
  }
  return i > 0 &&
    children[i - 1].type === RuleType.footnoteReference &&
    children[i].type === RuleType.text &&
    rendered.charCodeAt(0) === $.CHAR_COLON
    ? `\\${rendered}`
    : rendered
}

function textRun(
  children: MarkdownToJSX.ASTNode[],
  start: number
): MarkdownToJSX.TextNode {
  var text = ''
  for (var j = start; j < children.length; j++) {
    var child = children[j]
    if (child.type !== RuleType.text) {
      break
    }
    text += child.text
  }
  return { text, type: RuleType.text }
}

function isStarEmphasis(
  node: MarkdownToJSX.ASTNode | undefined
): node is MarkdownToJSX.FormattedTextNode {
  return (
    node !== undefined &&
    node.type === RuleType.textFormatted &&
    (node.tag === 'em' ||
      node.tag === 'i' ||
      node.tag === 'strong' ||
      node.tag === 'b')
  )
}

function planUnderscoreRuns(children: MarkdownToJSX.ASTNode[]): Uint8Array {
  var plan = new Uint8Array(children.length)
  for (var start = 0; start < children.length; start++) {
    if (!isStarEmphasis(children[start])) {
      continue
    }
    var end = start
    while (isStarEmphasis(children[end + 1])) {
      end++
    }
    if (end > start) {
      var before = children[start - 1]
      var after = children[end + 1]
      var wordBefore =
        before !== undefined &&
        before.type === RuleType.text &&
        isAlnumCode(before.text.charCodeAt(before.text.length - 1))
      var wordAfter =
        after !== undefined &&
        after.type === RuleType.text &&
        isAlnumCode(after.text.charCodeAt(0))
      var lastIsOdd = (end - start) % 2 === 1
      var oddCanClose = !(lastIsOdd && wordAfter)
      var evenCanOpen = !(wordBefore || (!lastIsOdd && wordAfter))
      if (oddCanClose || evenCanOpen) {
        for (var at = start + (oddCanClose ? 1 : 0); at <= end; at += 2) {
          plan[at] = 1
        }
      }
    }
    start = end
  }
  return plan
}

function underscoreAdjacentEmphasis(
  children: MarkdownToJSX.ASTNode[],
  i: number,
  rendered: string,
  state: CompilerState
): string {
  var node = children[i]
  if (
    !(
      isStarEmphasis(node) &&
      (isStarEmphasis(children[i - 1]) || isStarEmphasis(children[i + 1]))
    ) ||
    rendered.charCodeAt(0) !== $.CHAR_ASTERISK
  ) {
    return rendered
  }
  var plan = state.underscorePlans.get(children)
  if (plan === undefined) {
    plan = planUnderscoreRuns(children)
    state.underscorePlans.set(children, plan)
  }
  if (plan[i] === 0) {
    return rendered
  }
  var width = node.tag === 'strong' || node.tag === 'b' ? 2 : 1
  var mark = '_'.repeat(width)
  return mark + rendered.slice(width, -width) + mark
}

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

function screenRawLinks(source: string): string {
  if (!RAW_SCREEN_TRIGGER_R.test(source)) {
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
      if (
        !isSafeDestination(raw.slice(destinationStart, destinationEnd)) ||
        (isLink && start + 2 === contentEnd)
      ) {
        out +=
          raw.slice(copied, start) +
          (isLink ? '&#93;' : '&lt;') +
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

function indexOrEnd(text: string, needle: string, from: number): number {
  var index = text.indexOf(needle, from)
  return index === -1 ? text.length : index
}

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

function indexPast(text: string, needle: string, from: number): number {
  var index = text.indexOf(needle, from)
  return index === -1 ? -1 : index + needle.length
}

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

const ESCAPING_BACKSLASH_R = /\\(?=[!-/:-@[-`{-~]|$)/g

function writeDestination(url: string): string {
  const written = UNREADABLE_DESTINATION_R.test(url)
    ? encodeUrlTarget(url)
    : url

  return hasUnbalancedParen(written)
    ? `<${written.replace(BACKSLASH_R, '\\\\')}>`
    : written.replace(ESCAPING_BACKSLASH_R, '\\\\')
}

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
  state.inLink = true
  for (var li = 0; li < node.children.length; li++) {
    text += compileInlineChild(node.children, li, state)
  }
  state.inLink = false
  return writeTarget('', text, node, state)
}

function compileImage(
  node: MarkdownToJSX.ImageNode,
  state: CompilerState
): string {
  const alt = (node.alt || '')
    .replace(ALT_BRACKET_OR_BACKSLASH_R, '\\$&')
    .replace(ENTITY_AMPERSAND_R, '&amp;')
    .replace(MARKUP_LT_R, '&lt;')
    .replace(QUOTE_R, '&quot;')
  return writeTarget('!', alt, node, state)
}

function writeTarget(
  prefix: '' | '!',
  text: string,
  node: MarkdownToJSX.LinkNode | MarkdownToJSX.ImageNode,
  state: CompilerState
): string {
  const url =
    node.target &&
    isSafeDestination(node.target) &&
    (prefix === '!' || !opensSvgAsPage(node.target, 'a', 'href'))
      ? writeDestination(node.target)
      : ''
  const title = url ? node.title : undefined

  if (state.options.useReferenceLinks) {
    const refKey = generateReferenceKey(state)
    if (!state.references.has(refKey)) {
      state.references.set(refKey, { url, title })
    }
    return `${prefix}[${text}][${refKey}]`
  }

  return title
    ? `${prefix}[${text}](${url} "${escapeLinkTitle(title)}")`
    : `${prefix}[${text}](${url})`
}

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

function compileListItemChildren(
  item: MarkdownToJSX.ASTNode[],
  state: CompilerState
): string {
  var content = ''
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
  var rendered = ''
  for (var qi = 0; qi < node.children.length; qi++) {
    if (qi > 0) {
      rendered += '\n\n'
    }
    rendered += state.renderChild(node.children[qi], _emptyState)
  }
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
  var compileRow = (cells: MarkdownToJSX.ASTNode[][]): string => {
    var out = '|'
    for (var j = 0; j < cells.length; j++) {
      var cell = ''
      for (var k = 0; k < cells[j].length; k++) {
        cell += compileInlineChild(cells[j], k, state)
      }
      out += ` ${cell.replace(CELL_ESCAPE_PAIR_OR_PIPE_R, match => (match === '|' ? '\\|' : match))} |`
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

  if (node._isClosingTag) {
    return `</${tag}>${screenRawLinks(node._rawBody || '')}`
  }

  const attrText =
    node.attrs !== undefined && node.attrs.children !== undefined
      ? childrenAttrContent(node.attrs.children, [
          node.children,
          node.text,
          node._rawBody,
        ])
      : undefined

  if (
    node._verbatim &&
    node._rawOuter !== undefined &&
    attrText === undefined
  ) {
    return screenRawLinks(node._rawOuter)
  }

  const overrideProps = getOverrideProps(defaultTag, state.overrides)
  let attrs: string
  if (node._rawAttrs === undefined) {
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

  const isVoid = isVoidElement(tag)

  if (node._verbatim && (node._rawBody || node._rawClose)) {
    return screenRawLinks(
      `<${tag}${attrs}>${node._rawBody || ''}${node._rawClose || ''}`
    )
  }
  if (node.text) {
    return screenRawLinks(
      `<${tag}${attrs}>${node.text}${isVoid ? '' : `</${tag}>`}`
    )
  }

  const content =
    node.children && node.children.length > 0
      ? `\n${node.children.map(child => state.renderChild(child, _emptyState)).join('\n')}\n`
      : attrText === undefined || isVoid
        ? ''
        : compileElementText(attrText)
  const closingTag = isVoid ? '' : `</${tag}>`
  return `${screenRawLinks(`<${tag}${attrs}>`)}${content}${closingTag}`
}

function compileHtmlSelfClosing(
  node: MarkdownToJSX.HTMLSelfClosingNode,
  state: CompilerState
): string {
  if (node._isClosingTag) {
    return node._rawClose || `</${node.tag}>`
  }
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
  if (node.raw) {
    return screenRawLinks(node.text)
  }
  var text = screenRawLinks(node.text)
  return node._endsWithGT ? `<!--${text}>` : `<!--${text}-->`
}

function compileFootnoteReference(
  node: MarkdownToJSX.FootnoteReferenceNode
): string {
  return `[^${writtenLabel(node.text)}]`
}

function compileFrontmatter(node: MarkdownToJSX.FrontmatterNode): string {
  return node.text
}

function compileGfmTask(node: MarkdownToJSX.GFMTaskNode): string {
  return node.completed ? '[x]' : '[ ]'
}

function compileFootnoteDefinition(
  source: string,
  refs: MarkdownToJSX.ReferenceCollectionNode['refs'],
  state: CompilerState
): string {
  if (source.indexOf('<') === -1 && screenRawLinks(source) === source) {
    return source
  }
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
      const attrName = key === 'className' ? 'class' : key
      return typeof value === 'boolean'
        ? value
          ? ` ${attrName}`
          : ''
        : ` ${attrName}="${String(value).replace(/"/g, '&quot;')}"`
    })
    .join('')
}
