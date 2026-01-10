import * as $ from './constants'
import * as parse from './parse'
import { MarkdownToJSX, RuleType } from './types'
import * as util from './utils'
const { hasKeys } = util

// Re-export parser, types, and utils for the /html entry point
export { parser } from './parse'
export { RuleType, type MarkdownToJSX } from './types'
export { sanitizer, slugify } from './utils'

/**
 * Escape HTML entities for text content
 * Fast path: return early if no escaping needed
 */
function escapeHtml(text: string): string {
  if (!text) return text
  var needsEscape = false
  var i = 0
  var len = text.length
  while (i < len) {
    var code = text.charCodeAt(i)
    if (
      code === $.CHAR_AMPERSAND ||
      code === $.CHAR_LT ||
      code === $.CHAR_GT ||
      code === $.CHAR_DOUBLE_QUOTE
    ) {
      needsEscape = true
      break
    }
    i++
  }
  if (!needsEscape) return text
  var result = ''
  i = 0
  var last = 0
  while (i < len) {
    var code = text.charCodeAt(i)
    var replacement: string | null = null
    if (code === $.CHAR_AMPERSAND) {
      replacement = '&amp;'
    } else if (code === $.CHAR_LT) {
      replacement = '&lt;'
    } else if (code === $.CHAR_GT) {
      replacement = '&gt;'
    } else if (code === $.CHAR_DOUBLE_QUOTE) {
      replacement = '&quot;'
    }
    if (replacement) {
      if (i > last) result += text.slice(last, i)
      result += replacement
      last = i + 1
    }
    i++
  }
  if (last < len) result += text.slice(last)
  return result
}

/**
 * Escape HTML for attribute values, preserving entity references
 * Only escapes bare & that are not part of valid entities
 */
function escapeHtmlAttr(value: string): string {
  // Fast-path: check if escaping is needed before regex
  var needsEscape = false
  var i = 0
  var len = value.length
  while (i < len) {
    var code = value.charCodeAt(i)
    if (
      code === $.CHAR_AMPERSAND ||
      code === $.CHAR_LT ||
      code === $.CHAR_GT ||
      code === $.CHAR_DOUBLE_QUOTE
    ) {
      needsEscape = true
      break
    }
    i++
  }
  if (!needsEscape) return value

  return value
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/&(?!([a-zA-Z0-9]+|#[0-9]+|#x[0-9a-fA-F]+);)/g, '&amp;')
}

function formatAttributes(attrs: Record<string, any> = {}): string {
  // Fast-path: return empty string if no attributes
  var hasAttrs = false
  for (var key in attrs) {
    hasAttrs = true
    break
  }
  if (!hasAttrs) return ''

  var result = ''
  for (var key in attrs) {
    var value = attrs[key]
    if (value === undefined || value === null) continue
    result += ' '
    if (value === true) {
      result += key
    } else if (value === '') {
      result += key + '=""'
    } else if (key === 'style' && typeof value === 'object' && value !== null) {
      var styleStr = ''
      var styleFirst = true
      for (var styleKey in value) {
        var styleValue = value[styleKey]
        if (styleValue != null) {
          if (styleFirst) styleFirst = false
          else styleStr += '; '
          var cssKey = ''
          for (var i = 0; i < styleKey.length; i++) {
            var code = styleKey.charCodeAt(i)
            if (code >= $.CHAR_A && code <= $.CHAR_Z) {
              cssKey += '-' + String.fromCharCode(code + $.CHAR_CASE_OFFSET)
            } else {
              cssKey += styleKey[i]
            }
          }
          styleStr += cssKey + ': ' + styleValue
        }
      }
      if (styleStr) result += 'style="' + escapeHtmlAttr(styleStr) + '"'
    } else if (typeof value === 'string') {
      result += key + '="' + escapeHtmlAttr(value) + '"'
    } else if (typeof value === 'number') {
      result += key + '="' + value + '"'
    }
  }
  return result
}

function renderTag(
  defaultTag: string,
  children: string,
  overrides: HTMLOverrides,
  attrs?: Record<string, any>
): string {
  const tag = util.getTag(defaultTag, overrides)
  const overrideProps = util.getOverrideProps(defaultTag, overrides)
  if (!attrs || !hasKeys(attrs)) {
    const attrStr = formatAttributes(overrideProps)
    return `<${tag}${attrStr}>${children}</${tag}>`
  }
  var finalAttrs = { ...overrideProps }
  for (var aKey in attrs) finalAttrs[aKey] = attrs[aKey]
  const attrStr = formatAttributes(finalAttrs)
  return `<${tag}${attrStr}>${children}</${tag}>`
}

/**
 * Override configuration for HTML tags or custom components in HTML output
 * @lang zh HTML 输出中 HTML 标签或自定义组件的覆盖配置
 * @lang hi HTML आउटपुट में HTML टैग्स या कस्टम कंपोनेंट्स के लिए ओवरराइड कॉन्फ़िगरेशन
 */
export type HTMLOverride =
  | {
      component?: string
      props?: Record<string, string | number | boolean>
    }
  | string

/**
 * Map of HTML tags and custom components to their override configurations
 * @lang zh HTML 标签和自定义组件到其覆盖配置的映射
 * @lang hi HTML टैग्स और कस्टम कंपोनेंट्स से उनकी ओवरराइड कॉन्फ़िगरेशन का मैप
 */
export type HTMLOverrides = {
  [tag in MarkdownToJSX.HTMLTags]?: HTMLOverride
} & {
  [customComponent: string]: HTMLOverride
}

/**
 * HTML compiler options
 * @lang zh HTML 编译器选项
 * @lang hi HTML कंपाइलर विकल्प
 */
export type HTMLOptions = Omit<
  MarkdownToJSX.Options,
  'createElement' | 'wrapperProps' | 'overrides'
> & {
  /** Reference definitions for link resolution */
  /** @lang zh 用于链接解析的引用定义 */
  /** @lang hi लिंक रिज़ॉल्यूशन के लिए संदर्भ परिभाषाएं */
  refs?: { [key: string]: { target: string; title: string | undefined } }
  /** Custom rendering function for AST rules */
  /** @lang zh AST 规则的自定义渲染函数 */
  /** @lang hi AST नियमों के लिए कस्टम रेंडरिंग फ़ंक्शन */
  renderRule?: (
    next: () => string,
    node: MarkdownToJSX.ASTNode,
    renderChildren: (children: MarkdownToJSX.ASTNode[]) => string,
    state: MarkdownToJSX.State
  ) => string
  /** Override configurations for HTML tags */
  /** @lang zh HTML 标签的覆盖配置 */
  /** @lang hi HTML टैग्स के लिए ओवरराइड कॉन्फ़िगरेशन */
  overrides?: HTMLOverrides
  /** Props for wrapper element */
  /** @lang zh 包装元素的属性 */
  /** @lang hi रैपर एलिमेंट के लिए props */
  wrapperProps?: Record<string, string | number | boolean>
  /** Internal flag for wrapper auto-detection */
  /** @lang zh 包装器自动检测的内部标志 */
  /** @lang hi रैपर ऑटो-डिटेक्शन के लिए आंतरिक फ़्लैग */
  wrapperWasAutoSet?: boolean
}

function shouldSkipNode(
  node: MarkdownToJSX.ASTNode,
  preserveFrontmatter: boolean
): boolean {
  return (
    node.type === RuleType.footnote ||
    node.type === RuleType.ref ||
    (node.type === RuleType.frontmatter && !preserveFrontmatter)
  )
}

/**
 * Convert AST nodes to HTML string
 * @lang zh 将 AST 节点转换为 HTML 字符串
 * @lang hi AST नोड्स को HTML स्ट्रिंग में बदलें
 *
 * @param nodes - Array of AST nodes to render
 * @lang zh @param nodes - 要渲染的 AST 节点数组
 * @lang hi @param nodes - रेंडर करने के लिए AST नोड्स की सरणी
 * @param options - HTML compiler options
 * @lang zh @param options - HTML 编译器选项
 * @lang hi @param options - HTML कंपाइलर विकल्प
 * @returns HTML string
 * @lang zh @returns HTML 字符串
 * @lang hi @returns HTML स्ट्रिंग
 */
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
    if (shouldSkipNode(node, !!options.preserveFrontmatter)) continue
    nonRefCollectionNodes.push(node)
  }
  for (var key in refsFromAST) refs[key] = refsFromAST[key]

  var updatedOptions = { ...options, refs, overrides }

  /**
   * Encode special characters in URL (backslashes and backticks)
   * Preserves existing percent-encoded sequences
   */
  function encodeUrlSpecialChars(url: string): string {
    var result = ''
    var i = 0
    var len = url.length
    while (i < len) {
      // Preserve existing percent-encoded sequences
      if (
        url[i] === '%' &&
        i + 2 < len &&
        isHexChar(url.charCodeAt(i + 1)) &&
        isHexChar(url.charCodeAt(i + 2))
      ) {
        result += url[i] + url[i + 1] + url[i + 2]
        i += 3
      } else {
        var code = url.charCodeAt(i)
        if (code === $.CHAR_BACKSLASH) {
          result += '%5C'
        } else if (code === $.CHAR_BACKTICK) {
          result += '%60'
        } else {
          result += encodeURI(url[i])
        }
        i++
      }
    }
    return result
  }

  function isHexChar(code: number): boolean {
    return (
      (code >= $.CHAR_DIGIT_0 && code <= $.CHAR_DIGIT_9) ||
      (code >= $.CHAR_a && code <= $.CHAR_f) ||
      (code >= $.CHAR_A && code <= $.CHAR_F)
    )
  }

  function sanitizeAndReencodeUrl(url: string): string | null {
    var sanitized = sanitize(url, 'a', 'href')
    if (sanitized === null || sanitized === url) return sanitized
    return encodeUrlSpecialChars(sanitized)
  }

  function mergeAttrs(
    base: Record<string, any> | undefined,
    overrideProps: Record<string, any>
  ): Record<string, any> {
    var merged = base || {}
    if (hasKeys(overrideProps)) {
      merged = { ...merged }
      for (var key in overrideProps) merged[key] = overrideProps[key]
    }
    return merged
  }

  function renderChildren(children: MarkdownToJSX.ASTNode[]): string {
    return children.length ? astToHTML(children, updatedOptions) : ''
  }

  function renderNode(
    node: MarkdownToJSX.ASTNode,
    state: MarkdownToJSX.State = {}
  ): string {
    if (!node || typeof node !== 'object') return ''
    if (
      node.type === RuleType.ref ||
      node.type === RuleType.refCollection ||
      shouldSkipNode(node, !!options.preserveFrontmatter)
    )
      return ''

    switch (node.type) {
      case RuleType.blockQuote: {
        var children = node.children
          ? astToHTML(node.children, updatedOptions)
          : ''
        if (node.alert) {
          children = `<header>${escapeHtml(node.alert)}</header>` + children
          return renderTag('blockquote', children, overrides, {
            class:
              'markdown-alert-' + slug(node.alert.toLowerCase(), util.slugify),
          })
        }
        return renderTag('blockquote', children, overrides)
      }

      case RuleType.breakLine: {
        return '<br />'
      }
      case RuleType.breakThematic: {
        return '<hr />'
      }

      case RuleType.frontmatter: {
        return '<pre>' + escapeHtml(node.text) + '</pre>'
      }

      case RuleType.codeBlock: {
        var codeAttrs: Record<string, any> = node.attrs || {}
        if (node.lang) {
          codeAttrs = { ...codeAttrs }
          const decodedLang = util.decodeEntityReferences(node.lang)
          const existingClass =
            (codeAttrs.class as string) || (codeAttrs.className as string) || ''
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
        return '<code>' + escapeHtml(node.text || '') + '</code>'
      }

      case RuleType.footnoteReference: {
        const href = sanitize(node.target || '', 'a', 'href') || ''
        const text = escapeHtml(node.text || '')
        return `<a href="${escapeHtml(href)}"><sup>${text}</sup></a>`
      }

      case RuleType.gfmTask: {
        return (
          '<input' +
          (node.completed ? ' checked=""' : '') +
          ' disabled="" type="checkbox">'
        )
      }

      case RuleType.heading: {
        const level = node.level || 1
        const attrs = node.id?.trim() ? { id: node.id } : undefined
        return renderTag(
          'h' + level,
          node.children ? astToHTML(node.children, updatedOptions) : '',
          overrides,
          attrs
        )
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
        var attrsStr: string
        if (htmlNode.rawAttrs !== undefined) {
          attrsStr =
            htmlNode.rawAttrs
              .replace(/\n\s*/g, '')
              .replace(/\r\s*/g, '')
              .replace(/\t\s*/g, '') +
            (hasKeys(overrideProps)
              ? ' ' + formatAttributes(overrideProps).trim()
              : '')
        } else {
          attrsStr = formatAttributes(mergeAttrs(htmlNode.attrs, overrideProps))
        }
        if (options.tagfilter && util.shouldFilterTag(tag)) {
          return htmlNode.isClosingTag
            ? `&lt;/${tag}>`
            : `&lt;${tag}${attrsStr}>`
        }
        if (htmlNode.rawText) {
          if (htmlNode.verbatim) {
            var textContent = options.tagfilter
              ? util.applyTagFilterToText(htmlNode.rawText)
              : htmlNode.rawText
            if (htmlNode.isClosingTag) return `</${tag}>${textContent}`
            var tagLower = tag.toLowerCase()
            var isType1Block =
              tagLower === 'pre' ||
              tagLower === 'script' ||
              tagLower === 'style' ||
              tagLower === 'textarea'
            if (isType1Block) {
              var textLen = htmlNode.rawText.length
              var textStart = 0
              while (
                textStart < textLen &&
                htmlNode.rawText.charCodeAt(textStart) === $.CHAR_SPACE
              )
                textStart++
              if (
                textStart < textLen &&
                htmlNode.rawText.charCodeAt(textStart) === $.CHAR_LT
              ) {
                var openingTagEnd = htmlNode.rawText.indexOf('>', textStart)
                if (openingTagEnd !== -1) {
                  var rawOpeningTag = htmlNode.rawText.slice(
                    textStart,
                    openingTagEnd + 1
                  )
                  if (
                    rawOpeningTag.charCodeAt(1) >= $.CHAR_a &&
                    rawOpeningTag.charCodeAt(1) <= $.CHAR_z
                  ) {
                    var tagStart = 1
                    var tagEnd = tagStart
                    while (
                      tagEnd < rawOpeningTag.length &&
                      rawOpeningTag.charCodeAt(tagEnd) >= $.CHAR_a &&
                      rawOpeningTag.charCodeAt(tagEnd) <= $.CHAR_z
                    )
                      tagEnd++
                    var foundTag = rawOpeningTag
                      .slice(tagStart, tagEnd)
                      .toLowerCase()
                    if (foundTag === tagLower) {
                      var innerText = htmlNode.rawText.slice(openingTagEnd + 1)
                      return (
                        rawOpeningTag +
                        (options.tagfilter
                          ? util.applyTagFilterToText(innerText)
                          : innerText)
                      )
                    }
                  }
                }
              }
              var closingTag = '</' + tagLower + '>'
              var hasClosingTag = htmlNode.rawText.indexOf(closingTag) !== -1
              return hasClosingTag
                ? `<${tag}${attrsStr}>${textContent}`
                : `<${tag}${attrsStr}>${textContent}</${tag}>`
            }
            var trimmed = htmlNode.rawText.trim()
            if (trimmed.length > 0 && trimmed.charCodeAt(0) === $.CHAR_LT) {
              var secondCharCode = trimmed.charCodeAt(1)
              // Check if second char is a letter (a-z or A-Z) - valid HTML tag name start
              // Both cases are needed for custom elements (lowercase) and JSX components (uppercase)
              if (
                (secondCharCode >= $.CHAR_a && secondCharCode <= $.CHAR_z) ||
                (secondCharCode >= $.CHAR_A && secondCharCode <= $.CHAR_Z)
              ) {
                var tagStart = 1
                var tagEnd = tagStart
                // Parse tag name: letters, digits, and hyphens (valid custom element names)
                while (tagEnd < trimmed.length) {
                  var code = trimmed.charCodeAt(tagEnd)
                  if (
                    (code >= $.CHAR_a && code <= $.CHAR_z) ||
                    (code >= $.CHAR_A && code <= $.CHAR_Z) ||
                    (code >= $.CHAR_DIGIT_0 && code <= $.CHAR_DIGIT_9) ||
                    code === $.CHAR_DASH
                  ) {
                    tagEnd++
                  } else {
                    break
                  }
                }
                var foundTag = trimmed.slice(tagStart, tagEnd).toLowerCase()
                // Check if rawText contains the full block for this tag
                // (i.e., starts with the same tag as we're rendering)
                // For verbatim blocks, rawText contains the complete HTML content including
                // opening and closing tags, so we can return it directly without wrapping
                if (foundTag === tagLower) {
                  // rawText already contains the full HTML block, just return it
                  return textContent
                }
              }
            }
            var trimmedStart = 0
            while (
              trimmedStart < textContent.length &&
              textContent.charCodeAt(trimmedStart) === $.CHAR_SPACE
            )
              trimmedStart++
            return `<${tag}${attrsStr}>${trimmedStart > 0 ? textContent.slice(trimmedStart) : trimmed ? textContent : ''}`
          }
          var textContent = options.tagfilter
            ? util.applyTagFilterToText(htmlNode.rawText)
            : htmlNode.rawText
          return `<${tag}${attrsStr}>${textContent}</${tag}>`
        }
        const children = htmlNode.children
          ? astToHTML(htmlNode.children, updatedOptions)
          : ''
        if (htmlNode.isClosingTag) return `</${tag}>${children}`
        return children.trim()
          ? `<${tag}${attrsStr}>${children}</${tag}>`
          : `<${tag}${attrsStr}>${children}`
      }

      case RuleType.htmlSelfClosing: {
        const htmlNode = node as MarkdownToJSX.HTMLSelfClosingNode & {
          rawText?: string
          isClosingTag?: boolean
        }
        const defaultTag = htmlNode.tag || 'div'
        const tag = util.getTag(defaultTag, overrides)
        if (htmlNode.rawText) {
          return options.tagfilter && util.shouldFilterTag(tag)
            ? htmlNode.rawText.replace(/^</, '&lt;')
            : htmlNode.rawText
        }
        if (htmlNode.isClosingTag) return `</${tag}>`
        const overrideProps = util.getOverrideProps(defaultTag, overrides)
        const mergedAttrs = mergeAttrs(htmlNode.attrs, overrideProps)
        const attrsStr = formatAttributes(mergedAttrs)
        if (options.tagfilter && util.shouldFilterTag(tag)) {
          return `&lt;${tag}${attrsStr} />`
        }
        return `<${tag}${attrsStr} />`
      }

      case RuleType.image: {
        const tag = util.getTag('img', overrides)
        const overrideProps = util.getOverrideProps('img', overrides)
        const src = sanitize(node.target || '', 'img', 'src') || ''
        var attrs: Record<string, any> = {
          ...overrideProps,
          alt: node.alt || '',
        }
        if (node.title) attrs.title = node.title
        return `<${tag} src="${escapeHtml(src)}"${formatAttributes(attrs)} />`
      }

      case RuleType.link: {
        const tag = util.getTag('a', overrides)
        const overrideProps = util.getOverrideProps('a', overrides)
        var attrs: Record<string, any> = { ...overrideProps }
        if (node.target != null) {
          const href = sanitizeAndReencodeUrl(
            encodeUrlSpecialChars(util.decodeEntityReferences(node.target))
          )
          if (href != null) attrs.href = href
        }
        if (node.title) attrs.title = util.decodeEntityReferences(node.title)
        return `<${tag}${formatAttributes(attrs)}>${node.children ? astToHTML(node.children, updatedOptions) : ''}</${tag}>`
      }

      case RuleType.table: {
        const tableNode = node as MarkdownToJSX.TableNode
        const alignments = tableNode.align || []
        var header = ''
        var headerCells = tableNode.header || []
        for (var hi = 0; hi < headerCells.length; hi++) {
          var align = alignments[hi]
          header +=
            '<th' +
            (align ? ` align="${align}"` : '') +
            '>' +
            astToHTML(headerCells[hi], updatedOptions) +
            '</th>'
        }
        var rows = ''
        var tableRows = tableNode.cells || []
        for (var ri = 0; ri < tableRows.length; ri++) {
          var row = tableRows[ri] || []
          rows += '<tr>'
          for (var ci = 0; ci < row.length; ci++) {
            var align = alignments[ci]
            rows +=
              '<td' +
              (align ? ` align="${align}"` : '') +
              '>' +
              astToHTML(row[ci], updatedOptions) +
              '</td>'
          }
          rows += '</tr>'
        }
        const tag = util.getTag('table', overrides)
        const attrs = formatAttributes(
          util.getOverrideProps('table', overrides)
        )
        return `<${tag}${attrs}><thead><tr>${header}</tr></thead>${rows ? `<tbody>${rows}</tbody>` : ''}</${tag}>`
      }

      case RuleType.text: {
        // Inline escapeHtml for common text node case
        var text = node.text || ''
        if (!text) return text
        var needsEscape = false
        var i = 0
        var len = text.length
        while (i < len) {
          var code = text.charCodeAt(i)
          if (
            code === $.CHAR_AMPERSAND ||
            code === $.CHAR_LT ||
            code === $.CHAR_GT ||
            code === $.CHAR_DOUBLE_QUOTE
          ) {
            needsEscape = true
            break
          }
          i++
        }
        if (!needsEscape) return text
        var result = ''
        i = 0
        var last = 0
        while (i < len) {
          var code = text.charCodeAt(i)
          var replacement: string | null = null
          if (code === $.CHAR_AMPERSAND) {
            replacement = '&amp;'
          } else if (code === $.CHAR_LT) {
            replacement = '&lt;'
          } else if (code === $.CHAR_GT) {
            replacement = '&gt;'
          } else if (code === $.CHAR_DOUBLE_QUOTE) {
            replacement = '&quot;'
          }
          if (replacement) {
            if (i > last) result += text.slice(last, i)
            result += replacement
            last = i + 1
          }
          i++
        }
        if (last < len) result += text.slice(last)
        return result
      }

      case RuleType.textFormatted: {
        return renderTag(
          node.tag || 'strong',
          node.children ? astToHTML(node.children, updatedOptions) : '',
          overrides
        )
      }

      case RuleType.orderedList:
      case RuleType.unorderedList: {
        var items = ''
        var listItems = node.items || []
        for (var li = 0; li < listItems.length; li++) {
          items += '<li>' + astToHTML(listItems[li], updatedOptions) + '</li>'
        }
        const tag = node.type === RuleType.orderedList ? 'ol' : 'ul'
        const attrs =
          node.type === RuleType.orderedList &&
          node.start != null &&
          node.start !== 1
            ? { start: node.start }
            : undefined
        return renderTag(tag, items, overrides, attrs)
      }

      case RuleType.paragraph: {
        var paragraphOpts = { ...updatedOptions, refs: {}, wrapper: null }
        if (options.forceInline) {
          return node.children ? astToHTML(node.children, paragraphOpts) : ''
        }
        var children = node.children
          ? astToHTML(node.children, paragraphOpts)
          : ''
        // Per CommonMark: collapse trailing spaces before newlines (soft line breaks)
        // Don't collapse spaces inside HTML attribute values
        var hasSpaceNewline = false
        for (var checki = 0; checki < children.length - 1; checki++) {
          if (
            children.charCodeAt(checki) === $.CHAR_SPACE &&
            children.charCodeAt(checki + 1) === $.CHAR_NEWLINE
          ) {
            hasSpaceNewline = true
            break
          }
        }
        if (hasSpaceNewline) {
          var result = ''
          var i = 0
          var len = children.length
          var inTag = false
          var quoteCount = 0
          while (i < len) {
            var code = children.charCodeAt(i)
            if (code === $.CHAR_LT) {
              inTag = true
              quoteCount = 0
            } else if (code === $.CHAR_GT) {
              inTag = false
              quoteCount = 0
            } else if (inTag && code === $.CHAR_DOUBLE_QUOTE) {
              quoteCount++
            }
            if (
              code === $.CHAR_SPACE &&
              i + 1 < len &&
              children.charCodeAt(i + 1) === $.CHAR_NEWLINE
            ) {
              if (inTag && quoteCount % 2 === 1) {
                result += ' \n'
              } else {
                result += '\n'
              }
              i += 2
            } else {
              result += children[i]
              i++
            }
          }
          children = result
        }

        const attrsStr = formatAttributes(util.getOverrideProps('p', overrides))
        const tag = util.getTag('p', overrides)

        const paragraphNode = node as MarkdownToJSX.ParagraphNode & {
          removedClosingTags?: MarkdownToJSX.ASTNode[]
        }
        var closingTags = ''
        if (paragraphNode.removedClosingTags?.length) {
          for (
            var cti = 0;
            cti < paragraphNode.removedClosingTags.length;
            cti++
          ) {
            closingTags += renderNode(
              paragraphNode.removedClosingTags[cti],
              state
            )
          }
        }
        return `<${tag}${attrsStr}>${children}</${tag}>${closingTags}`
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

    // renderRule must be checked FIRST, before any filtering or rendering logic
    // This gives users full control to render even normally-skipped nodes
    if (options.renderRule) {
      return options.renderRule(
        () => {
          // Default behavior: skip ref, refCollection, and other filtered nodes
          if (
            node.type === RuleType.ref ||
            node.type === RuleType.refCollection ||
            shouldSkipNode(node, !!options.preserveFrontmatter)
          )
            return ''
          return renderNode(node, state)
        },
        node,
        renderChildren,
        state
      )
    }

    // Default filtering: skip ref, refCollection, and other filtered nodes
    if (
      node.type === RuleType.ref ||
      node.type === RuleType.refCollection ||
      shouldSkipNode(node, !!options.preserveFrontmatter)
    )
      return ''

    return renderNode(node, state)
  }

  var content = ''
  if (Array.isArray(nodes)) {
    for (var ci = 0; ci < nonRefCollectionNodes.length; ci++) {
      content += renderNodeWithRule(nonRefCollectionNodes[ci], {
        key: ci,
        refs,
      })
    }
  } else {
    content = renderNodeWithRule(nodes, { refs })
  }

  // Extract and render footnotes
  var footnoteFooter = ''
  for (var key in refs) {
    if (key.charCodeAt(0) === $.CHAR_CARET) {
      if (!footnoteFooter) footnoteFooter = '<footer>'
      const id = key.slice(1)
      const parsed = parse.parseMarkdown(
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
      var filtered: MarkdownToJSX.ASTNode[] = []
      for (var pi = 0; pi < parsed.length; pi++) {
        if (parsed[pi].type !== RuleType.refCollection)
          filtered.push(parsed[pi])
      }
      const footnoteContent = astToHTML(filtered, {
        ...updatedOptions,
        refs: {},
        forceInline: true,
        wrapper: null,
      })
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
  const wrapperWasExplicit =
    hasExplicitWrapper && typeof options.wrapper === 'string'
  const shouldWrap =
    options.forceWrapper ||
    (options.forceInline && hasExplicitWrapper) ||
    (hasMultipleChildren && hasExplicitWrapper)

  if (!shouldWrap) {
    return content + footnoteFooter
  }

  // Extract paragraph content when forceInline or forceWrapper with explicit wrapper
  var contentToWrap = content
  if (
    options.forceInline ||
    (options.forceWrapper && wrapperWasExplicit && !options.wrapperWasAutoSet)
  ) {
    if (
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
  }

  // Determine wrapper tag
  const wrapperTag =
    typeof options.wrapper === 'string'
      ? options.wrapper
      : options.forceInline
        ? 'span'
        : 'div'

  var wrapperAttrs = ''
  if (options.wrapperProps) {
    var sanitizedProps: Record<string, string> = {}
    for (var wpKey in options.wrapperProps) {
      var wpValue = options.wrapperProps[wpKey]
      if (wpValue != null) {
        var sanitized = sanitize(String(wpValue), wrapperTag, wpKey)
        if (sanitized !== null) sanitizedProps[wpKey] = sanitized
      }
    }
    wrapperAttrs = formatAttributes(sanitizedProps)
  }

  return `<${wrapperTag}${wrapperAttrs}>${contentToWrap + footnoteFooter}</${wrapperTag}>`
}

/**
 * Compiler function that parses markdown and renders to HTML string
 * Convenience function that combines parser() and html()
 * @lang zh 解析 Markdown 并渲染为 HTML 字符串的编译器函数
 * 结合 parser() 和 html() 的便捷函数
 * @lang hi Markdown को पार्स करने और HTML स्ट्रिंग में रेंडर करने वाला कंपाइलर फ़ंक्शन
 * parser() और html() को जोड़ने वाला सुविधाजनक फ़ंक्शन
 *
 * @param markdown - Markdown string to compile
 * @lang zh @param markdown - 要编译的 Markdown 字符串
 * @lang hi @param markdown - कंपाइल करने के लिए Markdown स्ट्रिंग
 * @param options - HTML compiler options
 * @lang zh @param options - HTML 编译器选项
 * @lang hi @param options - HTML कंपाइलर विकल्प
 * @returns HTML string
 * @lang zh @returns HTML 字符串
 * @lang hi @returns HTML स्ट्रिंग
 */
export function compiler(markdown: string, options?: HTMLOptions): string {
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
  const ast = parse.parser(markdown, { ...parseOptions, forceInline: inline })
  const htmlOptions: HTMLOptions = {
    ...options,
    forceInline: inline,
  } as HTMLOptions
  var wrapperWasAutoSet = false
  if (options?.wrapper === undefined) {
    var nonRefCount = 0
    for (var ni = 0; ni < ast.length; ni++) {
      var n = ast[ni]
      if (
        n.type !== RuleType.refCollection &&
        n.type !== RuleType.footnote &&
        n.type !== RuleType.ref &&
        (n.type !== RuleType.frontmatter || !options?.preserveFrontmatter)
      ) {
        nonRefCount++
      }
    }
    if (nonRefCount > 1 || options?.forceWrapper) {
      htmlOptions.wrapper = 'div'
      wrapperWasAutoSet = true
    } else if (inline && nonRefCount > 0) {
      htmlOptions.wrapper = 'span'
      wrapperWasAutoSet = true
    }
  }
  htmlOptions.wrapperWasAutoSet = wrapperWasAutoSet
  return astToHTML(ast, htmlOptions)
}
