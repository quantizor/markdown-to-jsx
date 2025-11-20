import * as $ from './constants'
import { parser } from './parse'
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
 * Check if tag should be filtered per GFM tagfilter extension
 */
function shouldFilterTag(tagName: string): boolean {
  var lowerTag = tagName.toLowerCase()
  return (
    lowerTag === 'title' ||
    lowerTag === 'textarea' ||
    lowerTag === 'style' ||
    lowerTag === 'xmp' ||
    lowerTag === 'iframe' ||
    lowerTag === 'noembed' ||
    lowerTag === 'noframes' ||
    lowerTag === 'script' ||
    lowerTag === 'plaintext'
  )
}

function applyTagFilterToText(text: string): string {
  // Escape dangerous tags in raw HTML text
  // Matches opening tags like <tag> or <tag attr="val">
  return text.replace(
    /<(\/?)(title|textarea|style|xmp|iframe|noembed|noframes|script|plaintext)(\s|>|\/)/gi,
    function (match, slash, tagName, after) {
      // Only escape the opening <
      return '&lt;' + slash + tagName + after
    }
  )
}

/**
 * Escape HTML for attribute values, preserving entity references
 * Only escapes bare & that are not part of valid entities
 */
function escapeHtmlAttr(value: string): string {
  // First, escape < > and " (these always need escaping)
  let escaped = value
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

  // For &, only escape if it's not part of a valid entity reference
  // Match entities: &name; or &#123; or &#x1A2B;
  // Use a more precise pattern that checks for valid entity syntax
  escaped = escaped.replace(
    /&(?!([a-zA-Z0-9]+|#[0-9]+|#x[0-9a-fA-F]+);)/g,
    '&amp;'
  )

  return escaped
}

/**
 * Extract markdown representation from inline AST nodes (for image alt text with links)
 * Renders links as [text](url) markdown instead of plain text
 */
function extractLinkMarkdown(
  nodes: MarkdownToJSX.ASTNode[],
  refs: { [key: string]: { target: string; title: string | undefined } }
): string {
  var result = ''
  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i]
    if (node.type === RuleType.text) {
      result += (node as MarkdownToJSX.TextNode).text || ''
    } else if (node.type === RuleType.textFormatted) {
      var formattedNode = node as MarkdownToJSX.FormattedTextNode
      if (formattedNode.children) {
        result += extractLinkMarkdown(formattedNode.children, refs)
      }
    } else if (node.type === RuleType.link) {
      var linkNode = node as MarkdownToJSX.LinkNode
      // For nested links in image alt text, extract the innermost link's text
      // and use the outermost link's URL
      var linkText = ''
      var linkUrl = linkNode.target || ''
      if (linkNode.children) {
        // Check if children contain a single link node (nested link)
        if (
          linkNode.children.length === 1 &&
          linkNode.children[0].type === RuleType.link
        ) {
          // Nested link: extract text from inner link, use outer link's URL
          var innerLink = linkNode.children[0] as MarkdownToJSX.LinkNode
          linkText = extractLinkMarkdown(innerLink.children || [], refs)
        } else {
          linkText = extractLinkMarkdown(linkNode.children, refs)
        }
      }
      result += '[' + linkText + '](' + linkUrl + ')'
    } else if (node.type === RuleType.image) {
      var imageNode = node as MarkdownToJSX.ImageNode
      if (imageNode.alt) {
        result += imageNode.alt
      }
    } else if (node.type === RuleType.codeInline) {
      result += (node as MarkdownToJSX.CodeInlineNode).text || ''
    }
    // Ignore other node types
  }
  return result
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

export function astToHTML(
  nodes: MarkdownToJSX.ASTNode[],
  options: {
    sanitizer?: (value: string, tag: string, attribute: string) => string | null
    slugify?: (input: string, defaultFn: (input: string) => string) => string
    refs?: { [key: string]: { target: string; title: string | undefined } }
    tagfilter?: boolean
  } = {}
): string {
  const sanitize = options.sanitizer || util.sanitizer
  const slug = options.slugify || util.slugify
  var refs = options.refs || {}

  // Extract refs from reference collection node at the head of AST
  // Reference collection node contains all refs for rendering
  var refsFromAST: {
    [key: string]: { target: string; title: string | undefined }
  } = {}
  var nonRefCollectionNodes: MarkdownToJSX.ASTNode[] = []
  var foundRefCollection = false
  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i]
    if (node.type === RuleType.refCollection && !foundRefCollection) {
      // Extract refs from reference collection node
      var refCollectionNode = node as MarkdownToJSX.ReferenceCollectionNode
      refsFromAST = refCollectionNode.refs || {}
      foundRefCollection = true
      continue // Skip reference collection node (it doesn't render)
    } else {
      nonRefCollectionNodes.push(node)
    }
  }

  // Merge AST refs with provided refs (AST refs take precedence)
  refs = Object.assign({}, refs, refsFromAST)

  // Update options with extracted refs for recursive calls
  var updatedOptions = Object.assign({}, options, { refs: refs })

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
    if (sanitized !== null && sanitized !== url) {
      let needsReencode = false
      for (let i = 0; i < sanitized.length; i++) {
        const code = sanitized.charCodeAt(i)
        if (code === $.CHAR_BACKSLASH || code === $.CHAR_BACKTICK) {
          needsReencode = true
          break
        }
      }
      if (needsReencode) {
        let reencoded = ''
        for (let i = 0; i < sanitized.length; i++) {
          const code = sanitized.charCodeAt(i)
          if (code === $.CHAR_BACKSLASH) {
            reencoded += '%5C'
          } else if (code === $.CHAR_BACKTICK) {
            reencoded += '%60'
          } else {
            reencoded += sanitized[i]
          }
        }
        return reencoded
      }
    }
    return sanitized
  }

  function extractAltText(node: MarkdownToJSX.ImageNode): string {
    return node.alt || ''
  }

  function renderNode(node: MarkdownToJSX.ASTNode): string {
    if (!node || typeof node !== 'object') return ''

    // Skip nodes that don't render
    if (
      node.type === RuleType.ref ||
      node.type === RuleType.refCollection ||
      node.type === RuleType.frontmatter
    )
      return ''

    switch (node.type) {
      case RuleType.blockQuote: {
        const attrs: Record<string, any> = {}
        if (node.alert) {
          attrs.class =
            'markdown-alert-' + slug(node.alert.toLowerCase(), util.slugify)
        }
        const attrStr = formatAttributes(attrs)
        let children = node.children
          ? astToHTML(node.children, updatedOptions)
          : ''
        if (node.alert) {
          const alertText = escapeHtml(node.alert)
          children = `<header>${alertText}</header>` + children
        }
        return `<blockquote${attrStr}>${children}</blockquote>`
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
          // Decode entity references in language name (per CommonMark spec)
          const decodedLang = util.decodeEntityReferences(node.lang)
          const existingClass = codeAttrs.class || codeAttrs.className || ''
          // Per CommonMark spec: use "language-" prefix (not "lang-")
          const langClass = 'language-' + decodedLang
          const newClass = existingClass
            ? existingClass + ' ' + langClass
            : langClass
          codeAttrs.class = newClass
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
        const text = node.text || ''
        return `<a href="${escapeHtml(href)}"><sup>${escapeHtml(
          text
        )}</sup></a>`
      }

      case RuleType.gfmTask: {
        const checked = node.completed ? ' checked=""' : ''
        return `<input${checked} disabled="" type="checkbox">`
      }

      case RuleType.heading: {
        const level = node.level || 1
        const attrs: Record<string, any> = {}
        if (node.id && node.id.trim() !== '') attrs.id = node.id
        const attrStr = formatAttributes(attrs)
        const children = node.children
          ? astToHTML(node.children, updatedOptions)
          : ''
        return `<h${level}${attrStr}>${children}</h${level}>`
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
          __rawAttrs?: string
          isClosingTag?: boolean
        }
        const tag = htmlNode.tag || 'div'
        // Normalize HTML attributes inline
        const attrs =
          htmlNode.__rawAttrs !== undefined
            ? htmlNode.__rawAttrs
                .replace(/\n\s*/g, '')
                .replace(/\r\s*/g, '')
                .replace(/\t\s*/g, '')
            : formatAttributes(htmlNode.attrs || {})
        const isClosingTag = htmlNode.isClosingTag || false
        // Render HTML block inline
        if (node.type !== RuleType.htmlBlock) return ''
        if (options.tagfilter && shouldFilterTag(tag)) {
          return isClosingTag ? `&lt;/${tag}>` : `&lt;${tag}${attrs}>`
        }
        if (htmlNode.text) {
          if (htmlNode.noInnerParse) {
            var textContent = options.tagfilter
              ? applyTagFilterToText(htmlNode.text)
              : htmlNode.text
            if (isClosingTag) return `</${tag}>${textContent}`
            var tagLower = tag.toLowerCase()
            var isType1Block =
              tagLower === 'pre' ||
              tagLower === 'script' ||
              tagLower === 'style' ||
              tagLower === 'textarea'
            if (isType1Block) {
              if (
                htmlNode.text &&
                htmlNode.text.trim().length > 0 &&
                htmlNode.text[0] === '<'
              ) {
                var openingTagEnd = htmlNode.text.indexOf('>')
                if (openingTagEnd !== -1) {
                  var rawOpeningTag = htmlNode.text.slice(0, openingTagEnd + 1)
                  var tagMatch = rawOpeningTag.match(/^<(\w+)/)
                  if (tagMatch && tagMatch[1].toLowerCase() === tagLower) {
                    var innerText = htmlNode.text.slice(openingTagEnd + 1)
                    var filteredInner = options.tagfilter
                      ? applyTagFilterToText(innerText)
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
            ? applyTagFilterToText(htmlNode.text)
            : htmlNode.text
          return `<${tag}${attrs}>${textContent}</${tag}>`
        }
        const children = htmlNode.children
          ? astToHTML(htmlNode.children, updatedOptions)
          : ''
        if (isClosingTag) return `</${tag}>${children}`
        const hasContent = children && children.trim().length > 0
        return hasContent
          ? `<${tag}${attrs}>${children}</${tag}>`
          : `<${tag}${attrs}>${children}`
      }

      case RuleType.htmlSelfClosing: {
        const htmlNode = node as MarkdownToJSX.HTMLSelfClosingNode & {
          rawText?: string
          isClosingTag?: boolean
        }
        const tag = htmlNode.tag || 'div'

        if (options.tagfilter && shouldFilterTag(tag)) {
          if (htmlNode.rawText) {
            return htmlNode.rawText.replace(/^</, '&lt;')
          }
          const attrs = formatAttributes(htmlNode.attrs || {})
          return `&lt;${tag}${attrs} />`
        }

        if (htmlNode.rawText) {
          return htmlNode.rawText
        }
        const attrs = formatAttributes(htmlNode.attrs || {})
        if (htmlNode.isClosingTag) {
          return `</${tag}>`
        }
        return `<${tag}${attrs} />`
      }

      case RuleType.image: {
        const src = sanitize(node.target || '', 'img', 'src') || ''
        const attrs: Record<string, any> = { alt: extractAltText(node) }
        if (node.title) attrs.title = node.title
        return `<img src="${escapeHtml(src)}"${formatAttributes(attrs)} />`
      }

      case RuleType.link: {
        const attrs: Record<string, any> = {}
        if (node.target !== null) {
          const decodedTarget = util.decodeEntityReferences(node.target)
          const encodedTarget = encodeUrlWithBackslashes(decodedTarget)
          const href = sanitizeAndReencodeUrl(encodedTarget)
          if (href !== null) attrs.href = href
        }
        if (node.title) {
          attrs.title = util.decodeEntityReferences(node.title)
        }
        const children = node.children
          ? astToHTML(node.children, updatedOptions)
          : ''
        return `<a${formatAttributes(attrs)}>${children}</a>`
      }

      case RuleType.table: {
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
        return `<table><thead><tr>${header}</tr></thead>${tbody}</table>`
      }

      case RuleType.text: {
        return escapeHtml(node.text || '')
      }

      case RuleType.textFormatted: {
        const tag = node.tag || 'strong'
        const children = node.children
          ? astToHTML(node.children, updatedOptions)
          : ''
        return `<${tag}>${children}</${tag}>`
      }

      case RuleType.orderedList: {
        const attrs: Record<string, any> = {}
        // Per CommonMark: only output start attribute if it's not 1
        if (node.start !== undefined && node.start !== 1)
          attrs.start = node.start
        const attrStr = formatAttributes(attrs)
        const items = (node.items || [])
          .map((item: any) => {
            const content = astToHTML(item, updatedOptions)
            return `<li>${content}</li>`
          })
          .join('')
        return `<ol${attrStr}>${items}</ol>`
      }

      case RuleType.unorderedList: {
        const items = (node.items || [])
          .map((item: any) => {
            const content = astToHTML(item, updatedOptions)
            return `<li>${content}</li>`
          })
          .join('')
        return `<ul>${items}</ul>`
      }

      case RuleType.paragraph: {
        var children = node.children
          ? astToHTML(node.children, updatedOptions)
          : ''
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

        // Per CommonMark spec Example 148: if paragraph has removedClosingTags,
        // render them outside the paragraph
        const paragraphNode = node as MarkdownToJSX.ParagraphNode & {
          removedClosingTags?: MarkdownToJSX.ASTNode[]
        }
        if (
          paragraphNode.removedClosingTags &&
          paragraphNode.removedClosingTags.length > 0
        ) {
          const closingTagsHtml = paragraphNode.removedClosingTags
            .map(tag => renderNode(tag))
            .join('')
          return `<p>${children}</p>${closingTagsHtml}`
        }

        return `<p>${children}</p>`
      }

      default:
        return ''
    }
  }

  if (Array.isArray(nodes)) {
    return nonRefCollectionNodes.map(renderNode).join('')
  }

  return renderNode(nodes)
}

/**
 * Compiler function that parses markdown and renders to HTML string
 * Convenience function that combines parser() and html()
 */
export function compiler(
  markdown: string,
  options?: {
    sanitizer?: (value: string, tag: string, attribute: string) => string | null
    slugify?: (input: string, defaultFn: (input: string) => string) => string
    tagfilter?: boolean
  } & MarkdownToJSX.Options
): string {
  const ast = parser(markdown, options)
  return astToHTML(ast, options)
}
