import { RuleType, type MarkdownToJSX } from './types'
import { isVoidElement } from './utils'
import { parser } from './parse'

/**
 * Markdown-specific compiler options that extend the main MarkdownToJSX options
 */
export interface MarkdownCompilerOptions extends MarkdownToJSX.Options {
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
  const state: CompilerState = {
    options: options || {},
    references: new Map(),
    referenceIndex: 1,
  }

  const content = nodes.map(node => compileNode(node, state)).join('\n\n')

  // Add reference definitions if using reference-style links
  if (state.options.useReferenceLinks && state.references.size > 0) {
    const references = Array.from(state.references.entries())
      .map(([key, { url, title }]) => {
        if (title) {
          return `[${key}]: ${url} "${title}"`
        }
        return `[${key}]: ${url}`
      })
      .join('\n')

    return content + '\n\n' + references
  }

  return content
}

// Alias for backwards compatibility
export const markdown = astToMarkdown

/**
 * Internal compiler state
 */
interface CompilerState {
  options: MarkdownCompilerOptions
  references: Map<string, { url: string; title?: string }>
  referenceIndex: number
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
      return compileHTMLComment(node, state)

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

/**
 * Compile text node
 */
function compileText(node: MarkdownToJSX.TextNode): string {
  // For round-trip compilation, preserve text as-is
  return node.text
}

/**
 * Compile paragraph node
 */
function compileParagraph(
  node: MarkdownToJSX.ParagraphNode,
  state: CompilerState
): string {
  return node.children.map(child => compileNode(child, state)).join('')
}

/**
 * Compile heading node
 */
function compileHeading(
  node: MarkdownToJSX.HeadingNode,
  state: CompilerState
): string {
  const content = node.children.map(child => compileNode(child, state)).join('')

  if (
    state.options.useSetextHeaders &&
    (node.level === 1 || node.level === 2)
  ) {
    const underline = node.level === 1 ? '=' : '-'
    return `${content}\n${underline.repeat(content.length)}`
  }

  const hashes = '#'.repeat(node.level)
  const space = state.options.enforceAtxHeadings !== false ? ' ' : ''
  return `${hashes}${space}${content}`
}

/**
 * Compile thematic break
 */
function compileBreakThematic(_node: MarkdownToJSX.BreakThematicNode): string {
  return '---'
}

/**
 * Compile line break
 */
function compileBreakLine(_node: MarkdownToJSX.BreakLineNode): string {
  return '  \n'
}

/**
 * Compile code block
 */
function compileCodeBlock(node: MarkdownToJSX.CodeBlockNode): string {
  const lang = node.lang ? `\`\`\`${node.lang}\n` : '```\n'
  return `${lang}${node.text}\n\`\`\``
}

/**
 * Compile inline code
 */
function compileCodeInline(node: MarkdownToJSX.CodeInlineNode): string {
  // Use double backticks if the code contains a backtick
  if (node.text.includes('`')) {
    return `\`\`${node.text}\`\``
  }
  return `\`${node.text}\``
}

/**
 * Compile formatted text (emphasis, strong, etc.)
 */
function compileTextFormatted(
  node: MarkdownToJSX.FormattedTextNode,
  state: CompilerState
): string {
  const content = node.children.map(child => compileNode(child, state)).join('')
  const tag = node.tag

  switch (tag) {
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

/**
 * Compile link
 */
function compileLink(
  node: MarkdownToJSX.LinkNode,
  state: CompilerState
): string {
  const text = node.children.map(child => compileNode(child, state)).join('')
  const url = node.target || ''
  const title = node.title

  if (state.options.useReferenceLinks) {
    // Generate reference-style link
    const refKey = generateReferenceKey(url, state)
    if (!state.references.has(refKey)) {
      state.references.set(refKey, { url, title })
    }
    return `[${text}][${refKey}]`
  }

  // Inline link
  if (title) {
    return `[${text}](${url} "${title}")`
  }
  return `[${text}](${url})`
}

/**
 * Compile image
 */
function compileImage(
  node: MarkdownToJSX.ImageNode,
  state: CompilerState
): string {
  const alt = node.alt || ''
  const url = node.target
  const title = node.title

  if (state.options.useReferenceLinks) {
    // Generate reference-style image
    const refKey = generateReferenceKey(url, state)
    if (!state.references.has(refKey)) {
      state.references.set(refKey, { url, title })
    }
    return `![${alt}][${refKey}]`
  }

  // Inline image
  if (title) {
    return `![${alt}](${url} "${title}")`
  }
  return `![${alt}](${url})`
}

/**
 * Compile ordered list
 */
function compileOrderedList(
  node: MarkdownToJSX.OrderedListNode,
  state: CompilerState
): string {
  const start = node.start || 1
  return node.items
    .map((item, index) => {
      const marker = `${start + index}. `
      const content = item.map(child => compileNode(child, state)).join('')
      return marker + content.replace(/\n/g, '\n    ')
    })
    .join('\n')
}

/**
 * Compile unordered list
 */
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

/**
 * Compile blockquote
 */
function compileBlockQuote(
  node: MarkdownToJSX.BlockQuoteNode,
  state: CompilerState
): string {
  const content = node.children
    .map(child => compileNode(child, state))
    .join('\n\n')
  return content
    .split('\n')
    .map(line => (line.trim() ? `> ${line}` : '>'))
    .join('\n')
}

/**
 * Compile table
 */
function compileTable(
  node: MarkdownToJSX.TableNode,
  state: CompilerState
): string {
  const headerRow = node.header
    .map(cell => cell.map(child => compileNode(child, state)).join(''))
    .join(' | ')

  let finalSeparator: string
  if (node.align.length > 0) {
    finalSeparator = node.align
      .map(align => {
        switch (align) {
          case 'left':
            return ':---'
          case 'right':
            return '---:'
          case 'center':
            return ':---:'
          default:
            return '---'
        }
      })
      .join('|')
  } else {
    // No alignment specified, use default --- separators
    finalSeparator = Array(node.header.length).fill('---').join('|')
  }

  const dataRows = node.cells
    .map(row =>
      row
        .map(cell => cell.map(child => compileNode(child, state)).join(''))
        .join(' | ')
    )
    .join('\n')

  return `${headerRow}\n${finalSeparator}\n${dataRows}`
}

/**
 * Dangerous HTML tags that should be escaped when tagfilter is enabled
 */
const DANGEROUS_HTML_TAGS = new Set([
  'title',
  'textarea',
  'style',
  'xmp',
  'iframe',
  'noembed',
  'noframes',
  'script',
  'plaintext',
])

/**
 * Compile HTML block
 */
function compileHTMLBlock(
  node: MarkdownToJSX.HTMLNode,
  state: CompilerState
): string {
  const tag = node.tag
  const attrs = compileAttributes(node.attrs)

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
  const tag = node.tag
  const attrs = compileAttributes(node.attrs)
  return `<${tag}${attrs} />`
}

/**
 * Compile HTML comment
 */
function compileHTMLComment(
  node: MarkdownToJSX.HTMLCommentNode,
  state: CompilerState
): string {
  return `<!--${node.text}-->`
}

/**
 * Compile footnote
 */
function compileFootnote(_node: MarkdownToJSX.FootnoteNode): string {
  // Footnotes are typically handled separately, return empty for now
  return ''
}

/**
 * Compile footnote reference
 */
function compileFootnoteReference(
  node: MarkdownToJSX.FootnoteReferenceNode
): string {
  return `[^${node.text}]`
}

/**
 * Compile frontmatter
 */
function compileFrontmatter(node: MarkdownToJSX.FrontmatterNode): string {
  return `---\n${node.text}\n---`
}

/**
 * Compile GFM task list item
 */
function compileGFMTask(node: MarkdownToJSX.GFMTaskNode): string {
  return node.completed ? '[x]' : '[ ]'
}

/**
 * Compile reference
 */
function compileReference(_node: MarkdownToJSX.ReferenceNode): string {
  // Reference definitions are handled separately
  return ''
}

/**
 * Compile reference collection
 */
function compileReferenceCollection(
  node: MarkdownToJSX.ReferenceCollectionNode
): string {
  return Object.entries(node.refs)
    .map(([key, { target, title }]) => {
      if (title) {
        return `[${key}]: ${target} "${title}"`
      }
      return `[${key}]: ${target}`
    })
    .join('\n')
}

/**
 * Generate a reference key for URLs
 */
function generateReferenceKey(url: string, state: CompilerState): string {
  // Simple implementation - use incremental numbers for now
  return `ref${state.referenceIndex++}`
}

/**
 * Compile HTML attributes to string
 */
function compileAttributes(attrs: Record<string, any>): string {
  return Object.entries(attrs || {})
    .map(([key, value]) => {
      if (typeof value === 'boolean') {
        return value ? ` ${key}` : ''
      }
      return ` ${key}="${String(value).replace(/"/g, '&quot;')}"`
    })
    .join('')
}

/**
 * Escape special markdown characters in text
 */
function escapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\') // Escape backslashes first
    .replace(/\*/g, '\\*') // Escape asterisks
    .replace(/_/g, '\\_') // Escape underscores
    .replace(/\[/g, '\\[') // Escape brackets
    .replace(/\]/g, '\\]') // Escape brackets
    .replace(/\(/g, '\\(') // Escape parentheses
    .replace(/\)/g, '\\)') // Escape parentheses
    .replace(/`/g, '\\`') // Escape backticks
    .replace(/~/g, '\\~') // Escape tildes
    .replace(/</g, '\\<') // Escape less-than
    .replace(/>/g, '\\>') // Escape greater-than
    .replace(/#/g, '\\#') // Escape hash
    .replace(/\+/g, '\\+') // Escape plus
    .replace(/-/g, '\\-') // Escape dash
    .replace(/\./g, '\\.') // Escape dot
    .replace(/!/g, '\\!') // Escape exclamation
    .replace(/\|/g, '\\|') // Escape pipe
    .replace(/\{/g, '\\{') // Escape braces
    .replace(/\}/g, '\\}') // Escape braces
}
