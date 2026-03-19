import { RuleType, type MarkdownToJSX } from './types'
import { isVoidElement, getTag, getOverrideProps } from './utils'
import { parser } from './parse'

export { parser } from './parse'
export { RuleType, type MarkdownToJSX } from './types'

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
    stateWithKey: MarkdownToJSX.State = {}
  ): string {
    if (!node || typeof node !== 'object') return ''

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

  var _emptyState: MarkdownToJSX.State = {}

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
  var contentParts = ''
  for (var ni = 0; ni < nonRefCollectionNodes.length; ni++) {
    var n = nonRefCollectionNodes[ni]
    if (ni > 0) contentParts += '\n\n'
    var keyIndex = n.type === RuleType.refCollection ? undefined : keyOffset++
    contentParts += nestedStatefulRender(n, { key: keyIndex, refs })
  }
  var content = contentParts

  if (state.options.useReferenceLinks && state.references.size > 0) {
    const references = Array.from(state.references.entries())
      .map(([key, { url, title }]) =>
        title ? `[${key}]: ${url} "${title}"` : `[${key}]: ${url}`
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

    case RuleType.footnote:
      return compileFootnote(node)

    case RuleType.footnoteReference:
      return compileFootnoteReference(node)

    case RuleType.frontmatter:
      return compileFrontmatter(node)

    case RuleType.gfmTask:
      return compileGFMTask(node)

    case RuleType.ref:
      return compileReference(node)

    case RuleType.refCollection:
      return compileReferenceCollection(node)

    default:
      // Unknown node type, return empty string
      return ''
  }
}

function compileText(node: MarkdownToJSX.TextNode): string {
  return node.text
}

function compileParagraph(
  node: MarkdownToJSX.ParagraphNode,
  state: CompilerState
): string {
  var out = ''
  for (var i = 0; i < node.children.length; i++) out += state.renderChild(node.children[i], {})
  return out
}

function compileHeading(
  node: MarkdownToJSX.HeadingNode,
  state: CompilerState
): string {
  var content = ''
  for (var hi = 0; hi < node.children.length; hi++) content += state.renderChild(node.children[hi], {})

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
  return `${node.lang ? `\`\`\`${node.lang}\n` : '```\n'}${node.text}\n\`\`\``
}

function compileCodeInline(node: MarkdownToJSX.CodeInlineNode): string {
  return node.text.indexOf('`') !== -1
    ? `\`\`${node.text}\`\``
    : `\`${node.text}\``
}

function compileTextFormatted(
  node: MarkdownToJSX.FormattedTextNode,
  state: CompilerState
): string {
  var content = ''
  for (var fi = 0; fi < node.children.length; fi++) content += state.renderChild(node.children[fi], {})
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
    case 'code':
      return compileCodeInline({ type: RuleType.codeInline, text: content })
    default:
      return content
  }
}

function compileLink(
  node: MarkdownToJSX.LinkNode,
  state: CompilerState
): string {
  var text = ''
  for (var li = 0; li < node.children.length; li++) text += state.renderChild(node.children[li], {})
  const url = node.target || ''
  const title = node.title

  if (state.options.useReferenceLinks) {
    const refKey = generateReferenceKey(url, state)
    if (!state.references.has(refKey)) {
      state.references.set(refKey, { url, title })
    }
    return `[${text}][${refKey}]`
  }

  return title ? `[${text}](${url} "${title}")` : `[${text}](${url})`
}

function compileImage(
  node: MarkdownToJSX.ImageNode,
  state: CompilerState
): string {
  const alt = node.alt || ''
  const url = node.target
  const title = node.title

  if (state.options.useReferenceLinks) {
    const refKey = generateReferenceKey(url, state)
    if (!state.references.has(refKey)) {
      state.references.set(refKey, { url, title })
    }
    return `![${alt}][${refKey}]`
  }

  return title ? `![${alt}](${url} "${title}")` : `![${alt}](${url})`
}

function compileOrderedList(
  node: MarkdownToJSX.OrderedListNode,
  state: CompilerState
): string {
  var start = node.start || 1
  var out = ''
  for (var oi = 0; oi < node.items.length; oi++) {
    var itemContent = ''
    var item = node.items[oi]
    for (var oj = 0; oj < item.length; oj++) itemContent += state.renderChild(item[oj], {})
    if (oi > 0) out += '\n'
    out += (start + oi) + '. ' + itemContent.replace(/\n/g, '\n    ')
  }
  return out
}

function compileUnorderedList(
  node: MarkdownToJSX.UnorderedListNode,
  state: CompilerState
): string {
  var out = ''
  for (var ui = 0; ui < node.items.length; ui++) {
    var uContent = ''
    var uItem = node.items[ui]
    for (var uj = 0; uj < uItem.length; uj++) uContent += state.renderChild(uItem[uj], {})
    if (ui > 0) out += '\n'
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
    rendered += state.renderChild(node.children[qi], {})
  }
  // Prefix each line with >
  var out = ''
  var segStart = 0
  for (var ri = 0; ri <= rendered.length; ri++) {
    if (ri === rendered.length || rendered.charCodeAt(ri) === 10) {
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
  var headerRow = ''
  for (var hi2 = 0; hi2 < node.header.length; hi2++) {
    if (hi2 > 0) headerRow += ' | '
    var cell = node.header[hi2]
    for (var hj = 0; hj < cell.length; hj++) headerRow += state.renderChild(cell[hj], {})
  }

  var finalSeparator = ''
  if (node.align.length > 0) {
    for (var ai = 0; ai < node.align.length; ai++) {
      if (ai > 0) finalSeparator += '|'
      var align = node.align[ai]
      finalSeparator += align === 'left' ? ':---' : align === 'right' ? '---:' : align === 'center' ? ':---:' : '---'
    }
  } else {
    for (var si = 0; si < node.header.length; si++) {
      if (si > 0) finalSeparator += '|'
      finalSeparator += '---'
    }
  }

  var dataRows = ''
  for (var di = 0; di < node.cells.length; di++) {
    if (di > 0) dataRows += '\n'
    var row = node.cells[di]
    for (var dj = 0; dj < row.length; dj++) {
      if (dj > 0) dataRows += ' | '
      var dCell = row[dj]
      for (var dk = 0; dk < dCell.length; dk++) dataRows += state.renderChild(dCell[dk], {})
    }
  }

  return headerRow + '\n' + finalSeparator + '\n' + dataRows
}

function compileHTMLBlock(
  node: MarkdownToJSX.HTMLNode,
  state: CompilerState
): string {
  const defaultTag = node.tag || 'div'
  const tag = getTag(defaultTag, state.overrides)
  const overrideProps = getOverrideProps(defaultTag, state.overrides)
  const mergedAttrs = { ...(node.attrs || {}), ...overrideProps }
  const attrs = compileAttributes(mergedAttrs)

  // Check if this is a void element (self-closing)
  const isVoid = isVoidElement(tag)

  // For verbatim blocks, use rawText if available (CommonMark compliance)
  // Otherwise fall back to deprecated text field for backward compatibility
  if (node._verbatim && (node._rawText || node.text)) {
    const textContent = node._rawText || node.text
    // For HTML blocks with raw text content
    // textContent already includes the closing tag
    return `<${tag}${attrs}>${textContent}`
  }

  if (node.text) {
    // For HTML blocks with raw text content (backward compatibility)
    // node.text already includes the closing tag
    return `<${tag}${attrs}>${node.text}`
  }

  // For HTML blocks with children, reconstruct the HTML
  const content = node.children
    ? `\n${node.children.map(child => state.renderChild(child, {})).join('\n')}\n`
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
  return `<!--${node.text}-->`
}

function compileFootnote(_node: MarkdownToJSX.FootnoteNode): string {
  return ''
}

function compileFootnoteReference(
  node: MarkdownToJSX.FootnoteReferenceNode
): string {
  return `[^${node.text}]`
}

function compileFrontmatter(node: MarkdownToJSX.FrontmatterNode): string {
  return `---\n${node.text}\n---`
}

function compileGFMTask(node: MarkdownToJSX.GFMTaskNode): string {
  return node.completed ? '[x]' : '[ ]'
}

function compileReference(_node: MarkdownToJSX.ReferenceNode): string {
  return ''
}

function compileReferenceCollection(
  node: MarkdownToJSX.ReferenceCollectionNode
): string {
  return Object.entries(node.refs)
    .map(([key, { target, title }]) =>
      title ? `[${key}]: ${target} "${title}"` : `[${key}]: ${target}`
    )
    .join('\n')
}

function generateReferenceKey(url: string, state: CompilerState): string {
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
