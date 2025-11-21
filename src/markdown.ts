import { RuleType, type MarkdownToJSX } from './types'
import { isVoidElement, getTag, getOverrideProps } from './utils'
import { parser } from './parse'

export type MarkdownOverride =
  | {
      component?: string
      props?: Record<string, string | number | boolean>
    }
  | string

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
 */
export function compiler(
  input: string,
  options?: MarkdownCompilerOptions
): string {
  const ast = parser(input, options)
  return astToMarkdown(ast, options)
}

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
    } else if (node.type !== RuleType.footnote && node.type !== RuleType.ref) {
      nonRefCollectionNodes.push(node)
    }
  }

  const state: CompilerState = {
    options: options || {},
    references: new Map(),
    referenceIndex: 1,
    overrides,
  }

  function renderChildren(children: MarkdownToJSX.ASTNode[]): string {
    // For inline content (like paragraph children), render without block separators
    return children.map(child => compileNode(child, state)).join('')
  }

  function renderNodeWithRule(
    node: MarkdownToJSX.ASTNode,
    stateWithKey: MarkdownToJSX.State = {}
  ): string {
    if (!node || typeof node !== 'object') return ''
    if (node.type === RuleType.ref || node.type === RuleType.footnote) return ''

    if (options?.renderRule) {
      return options.renderRule(
        () => compileNode(node, state),
        node,
        renderChildren,
        stateWithKey
      )
    }

    return compileNode(node, state)
  }

  // Filter out refCollection from nodes that get keys (it's rendered separately)
  const renderableNodes = nonRefCollectionNodes.filter(
    node => node.type !== RuleType.refCollection
  )
  const content = nonRefCollectionNodes
    .map((node, i) => {
      // Only assign keys to renderable nodes (exclude refCollection from key counting)
      const keyIndex =
        node.type === RuleType.refCollection
          ? undefined
          : renderableNodes.indexOf(node)
      return renderNodeWithRule(node, { key: keyIndex, refs })
    })
    .join('\n\n')

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
  return node.children.map(child => compileNode(child, state)).join('')
}

function compileHeading(
  node: MarkdownToJSX.HeadingNode,
  state: CompilerState
): string {
  const content = node.children.map(child => compileNode(child, state)).join('')

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
  const content = node.children.map(child => compileNode(child, state)).join('')
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
  const text = node.children.map(child => compileNode(child, state)).join('')
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
  const start = node.start || 1
  return node.items
    .map((item, index) => {
      const content = item.map(child => compileNode(child, state)).join('')
      return `${start + index}. ${content.replace(/\n/g, '\n    ')}`
    })
    .join('\n')
}

function compileUnorderedList(
  node: MarkdownToJSX.UnorderedListNode,
  state: CompilerState
): string {
  return node.items
    .map(item => {
      const content = item.map(child => compileNode(child, state)).join('')
      return `- ${content.replace(/\n/g, '\n  ')}`
    })
    .join('\n')
}

function compileBlockQuote(
  node: MarkdownToJSX.BlockQuoteNode,
  state: CompilerState
): string {
  return node.children
    .map(child => compileNode(child, state))
    .join('\n\n')
    .split('\n')
    .map(line => (line.trim() ? `> ${line}` : '>'))
    .join('\n')
}

function compileTable(
  node: MarkdownToJSX.TableNode,
  state: CompilerState
): string {
  const headerRow = node.header
    .map(cell => cell.map(child => compileNode(child, state)).join(''))
    .join(' | ')

  const finalSeparator =
    node.align.length > 0
      ? node.align
          .map(align => {
            if (align === 'left') return ':---'
            if (align === 'right') return '---:'
            if (align === 'center') return ':---:'
            return '---'
          })
          .join('|')
      : Array(node.header.length).fill('---').join('|')

  const dataRows = node.cells
    .map(row =>
      row
        .map(cell => cell.map(child => compileNode(child, state)).join(''))
        .join(' | ')
    )
    .join('\n')

  return `${headerRow}\n${finalSeparator}\n${dataRows}`
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

  if (node.text) {
    // For HTML blocks with raw text content
    // node.text already includes the closing tag
    return `<${tag}${attrs}>${node.text}`
  }

  // For HTML blocks with children, reconstruct the HTML
  const content = node.children
    ? `\n${node.children.map(child => compileNode(child, state)).join('\n')}\n`
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
    .map(([key, value]) =>
      typeof value === 'boolean'
        ? value
          ? ` ${key}`
          : ''
        : ` ${key}="${String(value).replace(/"/g, '&quot;')}"`
    )
    .join('')
}
