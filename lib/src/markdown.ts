import { RuleType, type MarkdownToJSX } from './types'
import { isVoidElement, getTag, getOverrideProps } from './utils'
import { parser } from './parse'
import * as $ from './constants'

export { parser } from './parse'
export { RuleType, type MarkdownToJSX } from './types'

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
  'createElement' | 'wrapper' | 'wrapperProps' | 'forceWrapper'
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
  const nodes = Array.isArray(ast) ? ast : [ast]
  var overrides = options?.overrides || {}

  // Extract refs from reference collection node
  var refs: { [key: string]: { target: string; title: string | undefined } } =
    {}
  var nonRefCollectionNodes: MarkdownToJSX.ASTNode[] = []
  var foundRefCollection = false

  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i]
    if (node.type === RuleType.refCollection && !foundRefCollection) {
      refs = (node as MarkdownToJSX.ReferenceCollectionNode).refs || {}
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
    )
      return ''
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
    if (ni > 0) content += '\n\n'
    var keyIndex = n.type === RuleType.refCollection ? undefined : keyOffset++
    content += nestedStatefulRender(n, { key: keyIndex, refs })
  }

  if (state.options.useReferenceLinks && state.references.size > 0) {
    const references = Array.from(state.references.entries())
      .map(([key, { url, title }]) =>
        title ? `[${key}]: ${url} "${escapeLinkTitle(title)}"` : `[${key}]: ${url}`
      )
      .join('\n')
    return content + '\n\n' + references
  }

  return content
}

// Alias for backwards compatibility
export const markdown: typeof astToMarkdown = astToMarkdown

/**
 * Internal compiler state
 */
interface CompilerState {
  options: MarkdownCompilerOptions
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
      return compileCodeBlock(node)

    case RuleType.codeInline:
      return compileCodeInline(node)

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
      return compileHTMLBlock(node, state)

    case RuleType.htmlSelfClosing:
      return compileHTMLSelfClosing(node, state)

    case RuleType.htmlComment:
      return compileHTMLComment(node)

    case RuleType.footnoteReference:
      return compileFootnoteReference(node)

    case RuleType.frontmatter:
      return compileFrontmatter(node)

    case RuleType.gfmTask:
      return compileGFMTask(node)

    case RuleType.refCollection:
      return compileReferenceCollection(node)

    default:
      // Unknown node type, return empty string
      return ''
  }
}

/**
 * Characters that re-activate as inline syntax when they appear literally in a
 * text node. Every occurrence in a text node is literal (emphasis, code, and
 * links are separate node types), so escaping them all preserves the text on
 * re-parse. `<` is intentionally excluded: raw HTML becomes its own node type
 * when parsing is enabled, so a `<` in a text node only occurs when raw-HTML
 * parsing is disabled, where escaping it would corrupt the intended output.
 */
/**
 * Escape, in a single pass, every character a text node must protect so it
 * stays literal on re-parse. An inline special (backslash, backtick, `*`, `_`,
 * `[`, `]`, `~`) is escaped anywhere, since emphasis, code, and links are
 * separate node types. A block starter is escaped only at the start of a line:
 * `#` heading, `>` blockquote, `-`/`+` bullet, `=`/`-` setext underline, `|`
 * table, and a digit run followed by `.`/`)`. `<` is intentionally excluded:
 * raw HTML becomes its own node type when parsing is enabled, so a `<` in a
 * text node only occurs when raw-HTML parsing is disabled, where escaping it
 * would corrupt the intended output.
 */
const ESCAPE_ALL_R = /[\\`*_[\]~]|(^|\n)([ \t]*)(?:([#>=|+-])|(\d{1,9})([.)]))/g

/**
 * Matches exactly when ESCAPE_ALL_R would escape something. Most text nodes are
 * plain words that match nothing here, so this cheap test skips the escape pass
 * for the common case (measured faster than running the escape regex on text
 * that needs no change).
 */
const ESCAPE_TRIGGER_R = /[\\`*_[\]~]|(?:^|\n)[ \t]*(?:[#>=|+-]|\d{1,9}[.)])/

function compileText(node: MarkdownToJSX.TextNode): string {
  var text = node.text
  if (!ESCAPE_TRIGGER_R.test(text)) return text
  return text.replace(
    ESCAPE_ALL_R,
    function (match, lineStart, indent, blockChar, digits, marker) {
      if (lineStart === undefined) return '\\' + match
      if (blockChar !== undefined) return lineStart + indent + '\\' + blockChar
      return lineStart + indent + digits + '\\' + marker
    }
  )
}

function compileParagraph(
  node: MarkdownToJSX.ParagraphNode,
  state: CompilerState
): string {
  var out = ''
  for (var i = 0; i < node.children.length; i++) out += state.renderChild(node.children[i], _emptyState)
  return out
}

function compileHeading(
  node: MarkdownToJSX.HeadingNode,
  state: CompilerState
): string {
  var content = ''
  for (var hi = 0; hi < node.children.length; hi++) content += state.renderChild(node.children[hi], _emptyState)

  if (
    state.options.useSetextHeaders &&
    (node.level === 1 || node.level === 2)
  ) {
    return `${content}\n${(node.level === 1 ? '=' : '-').repeat(content.length)}`
  }

  return `${'#'.repeat(node.level)}${state.options.enforceAtxHeadings !== false ? ' ' : ''}${content}`
}

function compileBreakThematic(_node: MarkdownToJSX.BreakThematicNode): string {
  return '---'
}

function compileBreakLine(_node: MarkdownToJSX.BreakLineNode): string {
  return '  \n'
}

function compileCodeBlock(node: MarkdownToJSX.CodeBlockNode): string {
  // The fence must be longer than any backtick run inside the content, or an
  // interior ``` would terminate the block early on re-parse.
  var longest = 0
  var run = 0
  for (var i = 0; i < node.text.length; i++) {
    if (node.text.charCodeAt(i) === $.CHAR_BACKTICK) {
      run++
      if (run > longest) longest = run
    } else {
      run = 0
    }
  }
  var fence = '`'.repeat(longest < 3 ? 3 : longest + 1)
  return `${node.lang ? `${fence}${node.lang}\n` : `${fence}\n`}${node.text}\n${fence}`
}

function compileCodeInline(node: MarkdownToJSX.CodeInlineNode): string {
  var text = node.text
  // The delimiter must be longer than the longest backtick run inside, or the
  // content would close the span early.
  var longest = 0
  var run = 0
  for (var i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === $.CHAR_BACKTICK) {
      run++
      if (run > longest) longest = run
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
  for (var fi = 0; fi < node.children.length; fi++) content += state.renderChild(node.children[fi], _emptyState)
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
      return compileCodeInline({ type: RuleType.codeInline, text: content })
    default:
      return content
  }
}

/**
 * Serialize a link/image title for a `"..."` delimiter, escaping the backslash
 * and quote a bare title would otherwise use to close the title early.
 */
function escapeLinkTitle(title: string): string {
  return title.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function compileLink(
  node: MarkdownToJSX.LinkNode,
  state: CompilerState
): string {
  var text = ''
  for (var li = 0; li < node.children.length; li++) text += state.renderChild(node.children[li], _emptyState)
  const url = node.target || ''
  const title = node.title

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
  const alt = node.alt || ''
  const url = node.target
  const title = node.title

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
  for (var i = 0; i < item.length; i++) {
    if (i > 0) {
      var prevBlock = isBlockListChild(item[i - 1].type)
      var curBlock = isBlockListChild(item[i].type)
      if (prevBlock && curBlock) content += '\n\n'
      else if (prevBlock || curBlock) content += '\n'
    }
    content += state.renderChild(item[i], _emptyState)
  }
  return content
}

/**
 * A list is loose when the parser kept paragraph wrappers inside its items
 * (tight items are unwrapped to inline children). A loose list separates its
 * items with a blank line so it re-parses loose and keeps its `<p>` wrappers.
 */
function isLooseList(items: MarkdownToJSX.ASTNode[][]): boolean {
  for (var i = 0; i < items.length; i++)
    for (var j = 0; j < items[i].length; j++)
      if (items[i][j].type === RuleType.paragraph) return true
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
    if (oi > 0) out += separator
    out += (start + oi) + '. ' + itemContent.replace(/\n/g, '\n    ')
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
    if (ui > 0) out += separator
    out += '- ' + uContent.replace(/\n/g, '\n  ')
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
    if (qi > 0) rendered += '\n\n'
    rendered += state.renderChild(node.children[qi], _emptyState)
  }
  // Prefix each line with >; an alert blockquote re-emits its marker line
  // first so the round-trip re-parses to the same alert (mirrors the html
  // compiler, which renders the alert as a header + class).
  var out = node.alert ? '> [!' + node.alert + ']' : ''
  var segStart = 0
  for (var ri = 0; ri <= rendered.length; ri++) {
    if (ri === rendered.length || rendered.charCodeAt(ri) === $.CHAR_NEWLINE) {
      var line = rendered.slice(segStart, ri)
      if (out) out += '\n'
      out += line.trim() ? '> ' + line : '>'
      segStart = ri + 1
    }
  }
  return out
}

function compileTable(
  node: MarkdownToJSX.TableNode,
  state: CompilerState
): string {
  // Emit outer pipes and escape pipes inside cells. Without the outer pipes a
  // single-column table re-parses as a setext heading, and an unescaped cell
  // pipe splits the row.
  var compileRow = function (cells: MarkdownToJSX.ASTNode[][]): string {
    var out = '|'
    for (var j = 0; j < cells.length; j++) {
      var cell = ''
      for (var k = 0; k < cells[j].length; k++) cell += state.renderChild(cells[j][k], _emptyState)
      out += ' ' + cell.replace(/\|/g, '\\|') + ' |'
    }
    return out
  }

  var headerRow = compileRow(node.header)

  var columns = node.align.length > 0 ? node.align.length : node.header.length
  var finalSeparator = '|'
  for (var ci = 0; ci < columns; ci++) {
    var align = node.align[ci]
    finalSeparator +=
      align === 'left' ? ' :--- |' : align === 'right' ? ' ---: |' : align === 'center' ? ' :---: |' : ' --- |'
  }

  var dataRows = ''
  for (var di = 0; di < node.cells.length; di++) {
    if (di > 0) dataRows += '\n'
    dataRows += compileRow(node.cells[di])
  }

  return dataRows
    ? headerRow + '\n' + finalSeparator + '\n' + dataRows
    : headerRow + '\n' + finalSeparator
}

function compileHTMLBlock(
  node: MarkdownToJSX.HTMLNode,
  state: CompilerState
): string {
  const defaultTag = node.tag || 'div'
  const tag = getTag(defaultTag, state.overrides)
  const overrideProps = getOverrideProps(defaultTag, state.overrides)
  // Prefer the raw source attribute string (mirrors the html compiler): the
  // parsed attrs map loses formatting, turning a style object into
  // `[object Object]` and collapsing expression attributes. Override props are
  // appended after the raw attributes so they win.
  let attrs: string
  if (node._rawAttrs !== undefined) {
    const raw = node._rawAttrs
    const needsLeadingSpace = raw.length > 0 && raw.charCodeAt(0) > $.CHAR_SPACE
    attrs =
      (needsLeadingSpace ? ' ' : '') +
      raw +
      (Object.keys(overrideProps).length
        ? ' ' + compileAttributes(overrideProps).trim()
        : '')
  } else {
    attrs = compileAttributes({ ...(node.attrs || {}), ...overrideProps })
  }

  // Check if this is a void element (self-closing)
  const isVoid = isVoidElement(tag)

  // An orphan closing tag re-emits as the bare closing tag; _rawText carries
  // any trailing same-line content (mirrors the html compiler).
  if (node._isClosingTag) {
    return `</${tag}>${node._rawText || ''}`
  }

  // Verbatim raw source already carries its own closing tag, so emit it as-is.
  if (node._verbatim && node._rawText) {
    return `<${tag}${attrs}>${node._rawText}`
  }
  // The deprecated text field holds inner content only, so a non-void element
  // needs its closing tag appended or the round-trip drops it (a following
  // sibling would then be absorbed into this element).
  if (node.text) {
    return `<${tag}${attrs}>${node.text}${isVoid ? '' : `</${tag}>`}`
  }

  // For HTML blocks with children, reconstruct the HTML. Empty children emit no
  // content: the newline wrapping used for block formatting would otherwise
  // split the surrounding paragraph when the element sits inline.
  const content =
    node.children && node.children.length
      ? `\n${node.children.map(child => state.renderChild(child, _emptyState)).join('\n')}\n`
      : ''
  const closingTag = isVoid ? '' : `</${tag}>`
  return `<${tag}${attrs}>${content}${closingTag}`
}

/**
 * Compile self-closing HTML tag
 */
function compileHTMLSelfClosing(
  node: MarkdownToJSX.HTMLSelfClosingNode,
  state: CompilerState
): string {
  const defaultTag = node.tag || 'div'
  const tag = getTag(defaultTag, state.overrides)
  const overrideProps = getOverrideProps(defaultTag, state.overrides)
  const mergedAttrs = { ...(node.attrs || {}), ...overrideProps }
  const attrs = compileAttributes(mergedAttrs)
  return `<${tag}${attrs} />`
}

function compileHTMLComment(node: MarkdownToJSX.HTMLCommentNode): string {
  // Mirror the html compiler: a raw comment already carries its own delimiters
  // (wrapping again would nest them), and an unterminated `<!--... >` comment
  // keeps its single-`>` close.
  if (node.raw) return node.text
  if (node._endsWithGT) return `<!--${node.text}>`
  return `<!--${node.text}-->`
}

function compileFootnoteReference(
  node: MarkdownToJSX.FootnoteReferenceNode
): string {
  return `[^${node.text}]`
}

function compileFrontmatter(node: MarkdownToJSX.FrontmatterNode): string {
  // The parser stores the full raw block including its --- delimiters
  // (the html compiler renders node.text as-is inside <pre>), so wrapping
  // again would double the delimiters and break the round-trip.
  return node.text
}

function compileGFMTask(node: MarkdownToJSX.GFMTaskNode): string {
  return node.completed ? '[x]' : '[ ]'
}

function compileReferenceCollection(
  node: MarkdownToJSX.ReferenceCollectionNode
): string {
  return Object.entries(node.refs)
    .map(([key, { target, title }]) =>
      title ? `[${key}]: ${target} "${escapeLinkTitle(title)}"` : `[${key}]: ${target}`
    )
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
