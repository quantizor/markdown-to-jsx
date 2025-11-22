import * as $ from './constants'
import * as parse from './parse'
import { MarkdownToJSX, RuleType } from './types'
import * as util from './utils'

// Re-export parser, types, and utils for the /html entry point
export { parser } from './parse'
export { RuleType, type MarkdownToJSX } from './types'
export { sanitizer, slugify } from './utils'

/**
 * Escape HTML entities for text content
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}


/**
 * Escape HTML for attribute values, preserving entity references
 * Only escapes bare & that are not part of valid entities
 */
function escapeHtmlAttr(value: string): string {
  return value
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/&(?!([a-zA-Z0-9]+|#[0-9]+|#x[0-9a-fA-F]+);)/g, '&amp;')
}

function formatAttributes(attrs: Record<string, any> = {}): string {
  const parts: string[] = []
  for (const key in attrs) {
    const value = attrs[key]
    if (value === undefined || value === null) continue
    if (value === true) {
      parts.push(key)
    } else if (value === '') {
      // Empty string values should output as key=""
      parts.push(`${key}=""`)
    } else if (key === 'style' && typeof value === 'object' && value !== null) {
      var styleParts: string[] = []
      for (const styleKey in value) {
        var styleValue = value[styleKey]
        if (styleValue != null) {
          var cssKey = styleKey.replace(/[A-Z]/g, m => '-' + m.toLowerCase())
          styleParts.push(cssKey + ': ' + styleValue)
        }
      }
      if (styleParts.length > 0) {
        parts.push('style="' + escapeHtmlAttr(styleParts.join('; ')) + '"')
      }
    } else if (typeof value === 'string') {
      parts.push(`${key}="${escapeHtmlAttr(value)}"`)
    } else if (typeof value === 'number') {
      parts.push(`${key}="${value}"`)
    }
  }
  return parts.length > 0 ? ' ' + parts.join(' ') : ''
}

export type HTMLOverride =
  | {
      component?: string
      props?: Record<string, string | number | boolean>
    }
  | string

export type HTMLOverrides = {
  [tag in MarkdownToJSX.HTMLTags]?: HTMLOverride
} & {
  [customComponent: string]: HTMLOverride
}

export type HTMLOptions = Omit<
  MarkdownToJSX.Options,
  'createElement' | 'wrapperProps' | 'overrides'
> & {
  refs?: { [key: string]: { target: string; title: string | undefined } }
  renderRule?: (
    next: () => string,
    node: MarkdownToJSX.ASTNode,
    renderChildren: (children: MarkdownToJSX.ASTNode[]) => string,
    state: MarkdownToJSX.State
  ) => string
  overrides?: HTMLOverrides
  wrapperProps?: Record<string, string | number | boolean>
}

export function astToHTML(
  nodes: MarkdownToJSX.ASTNode[],
  options: HTMLOptions = {}
): string {
  const sanitize = options.sanitizer || util.sanitizer
  const slug = options.slugify || util.slugify
  var refs = options.refs || {}
  var overrides = options.overrides || {}

  // Extract refs from reference collection node and filter non-renderable nodes
  var refsFromAST: {
    [key: string]: { target: string; title: string | undefined }
  } = {}
  var nonRefCollectionNodes: MarkdownToJSX.ASTNode[] = []
  var foundRefCollection = false
  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i]
    if (node.type === RuleType.refCollection && !foundRefCollection) {
      refsFromAST = (node as MarkdownToJSX.ReferenceCollectionNode).refs || {}
      foundRefCollection = true
      continue
    }
    if (
      node.type === RuleType.footnote ||
      node.type === RuleType.ref ||
      node.type === RuleType.frontmatter
    ) {
      continue
    }
    nonRefCollectionNodes.push(node)
  }
  refs = Object.assign({}, refs, refsFromAST)

  var updatedOptions = Object.assign({}, options, { refs, overrides })

  function encodeUrlWithBackslashes(decodedTarget: string): string {
    var encoded = ''
    var i = 0
    while (i < decodedTarget.length) {
      if (
        decodedTarget[i] === '%' &&
        i + 2 < decodedTarget.length &&
        /[0-9A-Fa-f]/.test(decodedTarget[i + 1]) &&
        /[0-9A-Fa-f]/.test(decodedTarget[i + 2])
      ) {
        encoded +=
          decodedTarget[i] + decodedTarget[i + 1] + decodedTarget[i + 2]
        i += 3
      } else {
        const charCode = decodedTarget.charCodeAt(i)
        if (charCode === $.CHAR_BACKSLASH) {
          encoded += '%5C'
        } else if (charCode === $.CHAR_BACKTICK) {
          encoded += '%60'
        } else {
          encoded += encodeURI(decodedTarget[i])
        }
        i++
      }
    }
    return encoded
  }

  function sanitizeAndReencodeUrl(url: string): string | null {
    var sanitized = sanitize(url, 'a', 'href')
    if (sanitized === null || sanitized === url) return sanitized
    var reencoded = ''
    var needsReencode = false
    for (var i = 0; i < sanitized.length; i++) {
      const code = sanitized.charCodeAt(i)
      if (code === $.CHAR_BACKSLASH) {
        reencoded += '%5C'
        needsReencode = true
      } else if (code === $.CHAR_BACKTICK) {
        reencoded += '%60'
        needsReencode = true
      } else {
        reencoded += sanitized[i]
      }
    }
    return needsReencode ? reencoded : sanitized
  }

  function renderChildren(children: MarkdownToJSX.ASTNode[]): string {
    return astToHTML(children, updatedOptions)
  }

  function renderNode(
    node: MarkdownToJSX.ASTNode,
    state: MarkdownToJSX.State = {}
  ): string {
    if (!node || typeof node !== 'object') return ''

    // Skip nodes that don't render
    if (
      node.type === RuleType.ref ||
      node.type === RuleType.refCollection ||
      node.type === RuleType.frontmatter ||
      node.type === RuleType.footnote
    )
      return ''

    switch (node.type) {
      case RuleType.blockQuote: {
        const tag = util.getTag('blockquote', overrides)
        const overrideProps = util.getOverrideProps('blockquote', overrides)
        const attrs: Record<string, any> = { ...overrideProps }
        if (node.alert) {
          attrs.class =
            'markdown-alert-' + slug(node.alert.toLowerCase(), util.slugify)
        }
        const attrStr = formatAttributes(attrs)
        var children = node.children
          ? astToHTML(node.children, updatedOptions)
          : ''
        if (node.alert) {
          children = `<header>${escapeHtml(node.alert)}</header>` + children
        }
        return `<${tag}${attrStr}>${children}</${tag}>`
      }

      case RuleType.breakLine: {
        return '<br />'
      }
      case RuleType.breakThematic: {
        return '<hr />'
      }

      case RuleType.codeBlock: {
        const codeAttrs: Record<string, any> = { ...(node.attrs || {}) }
        if (node.lang) {
          const decodedLang = util.decodeEntityReferences(node.lang)
          const existingClass = codeAttrs.class || codeAttrs.className || ''
          codeAttrs.class = existingClass
            ? existingClass + ' language-' + decodedLang
            : 'language-' + decodedLang
          delete codeAttrs.className
        }
        const attrs = formatAttributes(codeAttrs)
        const text = node.text || ''
        return `<pre><code${attrs}>${escapeHtml(text)}</code></pre>`
      }

      case RuleType.codeInline: {
        const text = node.text || ''
        return `<code>${escapeHtml(text)}</code>`
      }

      case RuleType.footnoteReference: {
        const href = sanitize(node.target || '', 'a', 'href') || ''
        const text = escapeHtml(node.text || '')
        return `<a href="${escapeHtml(href)}"><sup>${text}</sup></a>`
      }

      case RuleType.gfmTask: {
        const checked = node.completed ? ' checked=""' : ''
        return `<input${checked} disabled="" type="checkbox">`
      }

      case RuleType.heading: {
        const level = node.level || 1
        const defaultTag = 'h' + level
        const tag = util.getTag(defaultTag, overrides)
        const overrideProps = util.getOverrideProps(defaultTag, overrides)
        const attrs: Record<string, any> = { ...overrideProps }
        if (node.id?.trim()) attrs.id = node.id
        const attrStr = formatAttributes(attrs)
        const children = node.children
          ? astToHTML(node.children, updatedOptions)
          : ''
        return `<${tag}${attrStr}>${children}</${tag}>`
      }

      case RuleType.htmlComment: {
        const htmlCommentNode = node as MarkdownToJSX.HTMLCommentNode & {
          raw?: boolean
          endsWithGreaterThan?: boolean
        }
        if (htmlCommentNode.raw) {
          return htmlCommentNode.text
        }
        if (htmlCommentNode.endsWithGreaterThan) {
          return `<!--${node.text}>`
        }
        return `<!--${node.text}-->`
      }

      case RuleType.htmlBlock: {
        const htmlNode = node as MarkdownToJSX.HTMLNode & {
          rawAttrs?: string
          isClosingTag?: boolean
        }
        const defaultTag = htmlNode.tag || 'div'
        const tag = util.getTag(defaultTag, overrides)
        const overrideProps = util.getOverrideProps(defaultTag, overrides)
        // Merge override props with base attrs
        const mergedAttrs = { ...(htmlNode.attrs || {}), ...overrideProps }
        const attrs =
          htmlNode.rawAttrs !== undefined
            ? htmlNode.rawAttrs
                .replace(/\n\s*/g, '')
                .replace(/\r\s*/g, '')
                .replace(/\t\s*/g, '') +
              (Object.keys(overrideProps).length > 0
                ? ' ' + formatAttributes(overrideProps).trim()
                : '')
            : formatAttributes(mergedAttrs)
        if (options.tagfilter && util.shouldFilterTag(tag)) {
          return htmlNode.isClosingTag ? `&lt;/${tag}>` : `&lt;${tag}${attrs}>`
        }
        if (htmlNode.text) {
          if (htmlNode.noInnerParse) {
            var textContent = options.tagfilter
              ? util.applyTagFilterToText(htmlNode.text)
              : htmlNode.text
            if (htmlNode.isClosingTag) return `</${tag}>${textContent}`
            var tagLower = tag.toLowerCase()
            var isType1Block =
              tagLower === 'pre' ||
              tagLower === 'script' ||
              tagLower === 'style' ||
              tagLower === 'textarea'
            if (isType1Block) {
              if (htmlNode.text.trim().length > 0 && htmlNode.text[0] === '<') {
                var openingTagEnd = htmlNode.text.indexOf('>')
                if (openingTagEnd !== -1) {
                  var rawOpeningTag = htmlNode.text.slice(0, openingTagEnd + 1)
                  var tagMatch = rawOpeningTag.match(/^<(\w+)/)
                  if (tagMatch && tagMatch[1].toLowerCase() === tagLower) {
                    var innerText = htmlNode.text.slice(openingTagEnd + 1)
                    var filteredInner = options.tagfilter
                      ? util.applyTagFilterToText(innerText)
                      : innerText
                    return `${rawOpeningTag}${filteredInner}`
                  }
                }
              }
              var closingTagPattern = new RegExp(`</${tagLower}>`, 'i')
              var hasClosingTagInText = closingTagPattern.test(htmlNode.text)
              if (htmlNode.text === '') return `<${tag}${attrs}></${tag}>`
              return hasClosingTagInText
                ? `<${tag}${attrs}>${textContent}`
                : `<${tag}${attrs}>${textContent}</${tag}>`
            }
            var textStart = 0
            while (
              textStart < htmlNode.text.length &&
              htmlNode.text[textStart] === ' '
            ) {
              textStart++
            }
            if (
              textStart < htmlNode.text.length &&
              htmlNode.text[textStart] === '<'
            ) {
              var openingTagMatch = htmlNode.text
                .slice(textStart)
                .match(/^<(\w+)/)
              if (
                openingTagMatch &&
                openingTagMatch[1].toLowerCase() === tagLower
              ) {
                return textContent
              }
            }
            if (htmlNode.text === '') return `<${tag}${attrs}>`
            return `<${tag}${attrs}>${textContent.replace(/^\s+/, '')}`
          }
          var textContent = options.tagfilter
            ? util.applyTagFilterToText(htmlNode.text)
            : htmlNode.text
          return `<${tag}${attrs}>${textContent}</${tag}>`
        }
        const children = htmlNode.children
          ? astToHTML(htmlNode.children, updatedOptions)
          : ''
        if (htmlNode.isClosingTag) return `</${tag}>${children}`
        return children.trim()
          ? `<${tag}${attrs}>${children}</${tag}>`
          : `<${tag}${attrs}>${children}`
      }

      case RuleType.htmlSelfClosing: {
        const htmlNode = node as MarkdownToJSX.HTMLSelfClosingNode & {
          rawText?: string
          isClosingTag?: boolean
        }
        const defaultTag = htmlNode.tag || 'div'
        const tag = util.getTag(defaultTag, overrides)
        const overrideProps = util.getOverrideProps(defaultTag, overrides)
        const mergedAttrs = { ...(htmlNode.attrs || {}), ...overrideProps }

        if (options.tagfilter && util.shouldFilterTag(tag)) {
          if (htmlNode.rawText) {
            return htmlNode.rawText.replace(/^</, '&lt;')
          }
          return `&lt;${tag}${formatAttributes(mergedAttrs)} />`
        }

        if (htmlNode.rawText) {
          return htmlNode.rawText
        }
        if (htmlNode.isClosingTag) {
          return `</${tag}>`
        }
        return `<${tag}${formatAttributes(mergedAttrs)} />`
      }

      case RuleType.image: {
        const tag = util.getTag('img', overrides)
        const overrideProps = util.getOverrideProps('img', overrides)
        const src = sanitize(node.target || '', 'img', 'src') || ''
        const attrs: Record<string, any> = {
          ...overrideProps,
          alt: node.alt || '',
        }
        if (node.title) attrs.title = node.title
        return `<${tag} src="${escapeHtml(src)}"${formatAttributes(attrs)} />`
      }

      case RuleType.link: {
        const tag = util.getTag('a', overrides)
        const overrideProps = util.getOverrideProps('a', overrides)
        const attrs: Record<string, any> = { ...overrideProps }
        if (node.target != null) {
          const decodedTarget = util.decodeEntityReferences(node.target)
          const href = sanitizeAndReencodeUrl(
            encodeUrlWithBackslashes(decodedTarget)
          )
          if (href != null) attrs.href = href
        }
        if (node.title) {
          attrs.title = util.decodeEntityReferences(node.title)
        }
        const children = node.children
          ? astToHTML(node.children, updatedOptions)
          : ''
        return `<${tag}${formatAttributes(attrs)}>${children}</${tag}>`
      }

      case RuleType.table: {
        const tag = util.getTag('table', overrides)
        const overrideProps = util.getOverrideProps('table', overrides)
        const attrs = formatAttributes(overrideProps)
        const tableNode = node as MarkdownToJSX.TableNode
        const alignments = tableNode.align || []
        const header = (tableNode.header || [])
          .map((cell: MarkdownToJSX.ASTNode[], i: number) => {
            const content = astToHTML(cell, updatedOptions)
            const align = alignments[i]
            const alignAttr = align ? ` align="${align}"` : ''
            return `<th${alignAttr}>${content}</th>`
          })
          .join('')
        const rows = (tableNode.cells || [])
          .map((row: MarkdownToJSX.ASTNode[][]) => {
            const cells = (row || [])
              .map((cell: MarkdownToJSX.ASTNode[], i: number) => {
                const content = astToHTML(cell, updatedOptions)
                const align = alignments[i]
                const alignAttr = align ? ` align="${align}"` : ''
                return `<td${alignAttr}>${content}</td>`
              })
              .join('')
            return `<tr>${cells}</tr>`
          })
          .join('')
        // Per GFM spec: no tbody if no data rows
        const tbody = rows ? `<tbody>${rows}</tbody>` : ''
        return `<${tag}${attrs}><thead><tr>${header}</tr></thead>${tbody}</${tag}>`
      }

      case RuleType.text: {
        return escapeHtml(node.text || '')
      }

      case RuleType.textFormatted: {
        const defaultTag = node.tag || 'strong'
        const tag = util.getTag(defaultTag, overrides)
        const overrideProps = util.getOverrideProps(defaultTag, overrides)
        const attrs = formatAttributes(overrideProps)
        const children = node.children
          ? astToHTML(node.children, updatedOptions)
          : ''
        return `<${tag}${attrs}>${children}</${tag}>`
      }

      case RuleType.orderedList: {
        const tag = util.getTag('ol', overrides)
        const overrideProps = util.getOverrideProps('ol', overrides)
        const attrs: Record<string, any> = { ...overrideProps }
        if (node.start != null && node.start !== 1) attrs.start = node.start
        const attrStr = formatAttributes(attrs)
        const items = (node.items || [])
          .map((item: any) => {
            const content = astToHTML(item, updatedOptions)
            return `<li>${content}</li>`
          })
          .join('')
        return `<${tag}${attrStr}>${items}</${tag}>`
      }

      case RuleType.unorderedList: {
        const tag = util.getTag('ul', overrides)
        const overrideProps = util.getOverrideProps('ul', overrides)
        const attrs = formatAttributes(overrideProps)
        const items = (node.items || [])
          .map((item: any) => {
            const content = astToHTML(item, updatedOptions)
            return `<li>${content}</li>`
          })
          .join('')
        return `<${tag}${attrs}>${items}</${tag}>`
      }

      case RuleType.paragraph: {
        const { forceWrapper, ...paragraphOptions } = updatedOptions
        var children = node.children
          ? astToHTML(node.children, { ...paragraphOptions, refs: {} })
          : ''
        // When forceInline is true, render paragraph children without <p> wrapper
        if (options.forceInline) {
          return children
        }
        // Per CommonMark: collapse trailing spaces before newlines (soft line breaks)
        // Replace " \n" pattern with just "\n" or remove entirely if followed by certain content
        // This handles cases like "![foo] \n[]" where the space should be collapsed
        // BUT: Don't collapse spaces inside raw HTML tag attributes (preserve spacing per CommonMark spec)
        // Check if space+newline is inside HTML attribute value (between quotes inside an HTML tag)
        var spaceNewlinePattern = / \n/g
        var lastIndex = 0
        var result = ''
        var match
        while ((match = spaceNewlinePattern.exec(children)) !== null) {
          var pos = match.index
          // Check if we're inside an HTML tag attribute value
          // Find the last < before this position
          var beforePos = children.slice(0, pos)
          var lastOpenBracket = beforePos.lastIndexOf('<')
          var lastCloseBracket = beforePos.lastIndexOf('>')
          // If there's an open bracket after the last close bracket, we're inside a tag
          var isInsideTag = lastOpenBracket > lastCloseBracket
          if (isInsideTag) {
            // Count quotes between the opening < and current position to see if we're in an attribute value
            var afterOpenBracket = children.slice(lastOpenBracket, pos)
            var quoteCount = (afterOpenBracket.match(/"/g) || []).length
            // If odd number of quotes, we're inside an attribute value - preserve the space
            if (quoteCount % 2 === 1) {
              result += children.slice(lastIndex, pos) + match[0]
              lastIndex = pos + match[0].length
              continue
            }
          }
          // In text content - collapse the space
          result += children.slice(lastIndex, pos) + '\n'
          lastIndex = pos + match[0].length
        }
        result += children.slice(lastIndex)
        children = result

        const tag = util.getTag('p', overrides)
        const overrideProps = util.getOverrideProps('p', overrides)
        const attrs = formatAttributes(overrideProps)

        // Per CommonMark spec Example 148: if paragraph has removedClosingTags,
        // render them outside the paragraph
        const paragraphNode = node as MarkdownToJSX.ParagraphNode & {
          removedClosingTags?: MarkdownToJSX.ASTNode[]
        }
        if (paragraphNode.removedClosingTags?.length) {
          const closingTagsHtml = paragraphNode.removedClosingTags
            .map(tag => renderNode(tag, state))
            .join('')
          return `<${tag}${attrs}>${children}</${tag}>${closingTagsHtml}`
        }
        return `<${tag}${attrs}>${children}</${tag}>`
      }

      default:
        return ''
    }
  }

  function renderNodeWithRule(
    node: MarkdownToJSX.ASTNode,
    state: MarkdownToJSX.State = {}
  ): string {
    if (!node || typeof node !== 'object') return ''

    // Skip nodes that don't render
    if (
      node.type === RuleType.ref ||
      node.type === RuleType.refCollection ||
      node.type === RuleType.frontmatter ||
      node.type === RuleType.footnote
    )
      return ''

    // Use custom renderRule if provided
    if (options.renderRule) {
      const defaultRender = (): string => renderNode(node, state)
      return options.renderRule(defaultRender, node, renderChildren, state)
    }

    return renderNode(node, state)
  }

  var content = Array.isArray(nodes)
    ? nonRefCollectionNodes
        .map((node, i) => renderNodeWithRule(node, { key: i, refs }))
        .join('')
    : renderNodeWithRule(nodes, { refs })

  // Extract and render footnotes
  var footnoteFooter = ''
  for (const key in refs) {
    if (key.charCodeAt(0) === $.CHAR_CARET) {
      if (!footnoteFooter) footnoteFooter = '<footer>'
      const id = key.slice(1)
      const footnoteContent = astToHTML(
        parse
          .parseMarkdown(
            refs[key].target,
            { inline: true, refs },
            {
              ...updatedOptions,
              overrides: updatedOptions.overrides as MarkdownToJSX.Overrides,
              sanitizer: sanitize,
              slugify: (i: string) => slug(i, util.slugify),
              tagfilter: updatedOptions.tagfilter !== false,
            }
          )
          .filter(node => node.type !== RuleType.refCollection),
        { ...updatedOptions, refs: {}, forceInline: true, wrapper: null }
      )
      footnoteFooter += `<div id="${escapeHtmlAttr(slug(id, util.slugify))}">${escapeHtml(id)}: ${footnoteContent}</div>`
    }
  }
  if (footnoteFooter) footnoteFooter += '</footer>'

  // Handle wrapper options
  if (options.wrapper === null) {
    return content + footnoteFooter
  }

  // Determine if content should be wrapped (only when explicitly requested)
  const hasMultipleChildren = nonRefCollectionNodes.length > 1
  const hasExplicitWrapper = options.wrapper != null
  const shouldWrap =
    options.forceWrapper ||
    (options.forceInline && hasExplicitWrapper) ||
    (hasMultipleChildren && hasExplicitWrapper)

  if (!shouldWrap) {
    return content + footnoteFooter
  }

  // Extract paragraph content when forceInline or forceWrapper with custom wrapper
  var contentToWrap = content
  if (
    (options.forceInline || (options.forceWrapper && hasExplicitWrapper)) &&
    !hasMultipleChildren &&
    nonRefCollectionNodes.length === 1 &&
    nonRefCollectionNodes[0].type === RuleType.paragraph
  ) {
    const paragraphNode =
      nonRefCollectionNodes[0] as MarkdownToJSX.ParagraphNode
    if (paragraphNode.children) {
      contentToWrap = astToHTML(paragraphNode.children, {
        ...updatedOptions,
        refs: {},
        forceInline: true,
        wrapper: null,
      })
    }
  }

  // Determine wrapper tag
  const wrapperTag =
    typeof options.wrapper === 'string'
      ? options.wrapper
      : options.forceInline
        ? 'span'
        : 'div'

  // Format wrapper attributes
  var wrapperAttrs = ''
  if (options.wrapperProps) {
    var sanitizedProps: Record<string, string> = {}
    for (const key in options.wrapperProps) {
      const value = options.wrapperProps[key]
      if (value != null) {
        const sanitized = sanitize(String(value), wrapperTag, key)
        if (sanitized !== null) sanitizedProps[key] = sanitized
      }
    }
    wrapperAttrs = formatAttributes(sanitizedProps)
  }

  return `<${wrapperTag}${wrapperAttrs}>${contentToWrap + footnoteFooter}</${wrapperTag}>`
}

/**
 * Compiler function that parses markdown and renders to HTML string
 * Convenience function that combines parser() and html()
 */
export function compiler(markdown: string, options?: HTMLOptions): string {
  // Determine inline mode
  // HTML compiler defaults to block mode (for valid HTML output)
  // Only use inline if explicitly requested via forceInline
  const inline = options?.forceInline || false

  const parseOptions: parse.ParseOptions = {
    ...options,
    overrides: options?.overrides as MarkdownToJSX.Overrides,
    sanitizer: options?.sanitizer,
    slugify: options?.slugify
      ? (i: string) => options.slugify!(i, util.slugify)
      : util.slugify,
    tagfilter: options?.tagfilter !== false,
  }

  // Parse with inline mode
  const ast = parse.parser(markdown, { ...parseOptions, forceInline: inline })

  const htmlOptions: HTMLOptions = {
    ...options,
    forceInline: inline,
  } as HTMLOptions

  if (options?.wrapper === undefined) {
    const nonRefNodes = ast.filter(
      n =>
        n.type !== RuleType.refCollection &&
        n.type !== RuleType.footnote &&
        n.type !== RuleType.ref &&
        n.type !== RuleType.frontmatter
    )
    if (nonRefNodes.length > 1) {
      htmlOptions.wrapper = 'div'
    } else if (inline && nonRefNodes.length > 0) {
      htmlOptions.wrapper = 'span'
    }
  }

  return astToHTML(ast, htmlOptions)
}
