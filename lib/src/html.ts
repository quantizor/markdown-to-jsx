import * as $ from './constants'
import * as parse from './parse'
import { MarkdownToJSX, RuleType } from './types'
import * as util from './utils'
var hasKeys = util.hasKeys

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
  // Use SIMD-accelerated indexOf to find earliest escapable char
  var i = text.indexOf('&')
  var lt = text.indexOf('<')
  if (lt !== -1 && (i === -1 || lt < i)) i = lt
  var gt = text.indexOf('>')
  if (gt !== -1 && (i === -1 || gt < i)) i = gt
  var qt = text.indexOf('"')
  if (qt !== -1 && (i === -1 || qt < i)) i = qt
  if (i === -1) return text
  // Build result from first escapable char with charCode replacement loop
  var result = text.slice(0, i)
  var last = i
  var len = text.length
  while (i < len) {
    var code = text.charCodeAt(i)
    if (code <= 62) {
      if (code === $.CHAR_AMPERSAND) {
        if (i > last) result += text.slice(last, i)
        result += '&amp;'
        last = i + 1
      } else if (code === $.CHAR_LT) {
        if (i > last) result += text.slice(last, i)
        result += '&lt;'
        last = i + 1
      } else if (code === $.CHAR_GT) {
        if (i > last) result += text.slice(last, i)
        result += '&gt;'
        last = i + 1
      } else if (code === $.CHAR_DOUBLE_QUOTE) {
        if (i > last) result += text.slice(last, i)
        result += '&quot;'
        last = i + 1
      }
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

function formatAttributes(attrs: Record<string, any>): string {
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

// Render context — created once per astToHTML call, shared across all recursive renders
interface _Ctx {
  sanitize: (url: string, tag: string, attr: string) => string | null
  slug: (input: string, defaultFn: typeof util.slugify) => string
  refs: { [key: string]: { target: string; title: string | undefined } }
  overrides: HTMLOverrides
  hasOverrides: boolean
  preserveFrontmatter: boolean
  tagfilter: boolean
  forceInline: boolean
  renderRule?: HTMLOptions['renderRule']
}

var _emptyObj: Record<string, any> = {}

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

function _mergeAttrs(
  base: Record<string, any> | undefined,
  overrideProps: Record<string, any>
): Record<string, any> {
  if (!hasKeys(overrideProps)) return base || _emptyObj
  var merged = base ? { ...base } : {}
  for (var key in overrideProps) merged[key] = overrideProps[key]
  return merged
}

function _renderTag(
  defaultTag: string,
  children: string,
  ctx: _Ctx,
  attrs?: Record<string, any>
): string {
  if (!ctx.hasOverrides) {
    if (!attrs || !hasKeys(attrs)) {
      return '<' + defaultTag + '>' + children + '</' + defaultTag + '>'
    }
    return '<' + defaultTag + formatAttributes(attrs) + '>' + children + '</' + defaultTag + '>'
  }
  var tag = util.getTag(defaultTag, ctx.overrides)
  var overrideProps = util.getOverrideProps(defaultTag, ctx.overrides)
  if (!attrs || !hasKeys(attrs)) {
    return '<' + tag + formatAttributes(overrideProps) + '>' + children + '</' + tag + '>'
  }
  var finalAttrs = { ...overrideProps }
  for (var aKey in attrs) finalAttrs[aKey] = attrs[aKey]
  return '<' + tag + formatAttributes(finalAttrs) + '>' + children + '</' + tag + '>'
}

function _renderChildren(nodes: MarkdownToJSX.ASTNode[], ctx: _Ctx): string {
  var result = ''
  if (ctx.renderRule) {
    for (var i = 0; i < nodes.length; i++) {
      result += _renderNodeEntry(nodes[i], { key: i }, ctx)
    }
  } else {
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i]
      if (node.type === RuleType.text) {
        if (node.text) result += escapeHtml(node.text)
      } else {
        result += _renderNode(node, ctx)
      }
    }
  }
  return result
}

function _renderNodeEntry(
  node: MarkdownToJSX.ASTNode,
  state: MarkdownToJSX.State,
  ctx: _Ctx
): string {
  if (!node || typeof node !== 'object') return ''

  if (ctx.renderRule) {
    return ctx.renderRule(
      function () {
        if (
          node.type === RuleType.ref ||
          node.type === RuleType.refCollection ||
          shouldSkipNode(node, ctx.preserveFrontmatter)
        )
          return ''
        return _renderNode(node, ctx)
      },
      node,
      function (children: MarkdownToJSX.ASTNode[]) {
        return _renderChildren(children, ctx)
      },
      state
    )
  }

  if (
    node.type === RuleType.ref ||
    node.type === RuleType.refCollection ||
    shouldSkipNode(node, ctx.preserveFrontmatter)
  )
    return ''

  return _renderNode(node, ctx)
}

function _renderNode(
  node: MarkdownToJSX.ASTNode,
  ctx: _Ctx
): string {
  switch (node.type) {
    case RuleType.blockQuote: {
      var children = node.children
        ? _renderChildren(node.children, ctx)
        : ''
      if (node.alert) {
        children = '<header>' + escapeHtml(node.alert) + '</header>' + children
        return _renderTag('blockquote', children, ctx, {
          class:
            'markdown-alert-' + ctx.slug(node.alert.toLowerCase(), util.slugify),
        })
      }
      return _renderTag('blockquote', children, ctx)
    }

    case RuleType.breakLine: {
      return '<br />\n'
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
        var decodedLang = util.decodeEntityReferences(node.lang)
        var existingClass =
          (codeAttrs.class as string) || (codeAttrs.className as string) || ''
        codeAttrs.class = existingClass
          ? existingClass + ' language-' + decodedLang
          : 'language-' + decodedLang
        delete codeAttrs.className
      }
      var codeAttrStr = formatAttributes(codeAttrs)
      var codeText = node.text || ''
      return '<pre><code' + codeAttrStr + '>' + escapeHtml(codeText) + '</code></pre>'
    }

    case RuleType.codeInline: {
      return '<code>' + escapeHtml(node.text || '') + '</code>'
    }

    case RuleType.footnoteReference: {
      var href = ctx.sanitize(node.target || '', 'a', 'href') || ''
      var text = escapeHtml(node.text || '')
      return '<a href="' + escapeHtml(href) + '"><sup>' + text + '</sup></a>'
    }

    case RuleType.gfmTask: {
      return (
        '<input' +
        (node.completed ? ' checked=""' : '') +
        ' disabled="" type="checkbox">'
      )
    }

    case RuleType.heading: {
      var level = node.level || 1
      var headingAttrs = node.id?.trim() ? { id: node.id } : undefined
      return _renderTag(
        'h' + level,
        node.children ? _renderChildren(node.children, ctx) : '',
        ctx,
        headingAttrs
      )
    }

    case RuleType.htmlComment: {
      var htmlCommentNode = node as MarkdownToJSX.HTMLCommentNode & {
        raw?: boolean
        endsWithGreaterThan?: boolean
      }
      if (htmlCommentNode.raw) {
        return htmlCommentNode.text
      }
      if (htmlCommentNode.endsWithGreaterThan) {
        return '<!--' + node.text + '>'
      }
      return '<!--' + node.text + '-->'
    }

    case RuleType.htmlBlock: {
      var htmlNode = node as MarkdownToJSX.HTMLNode & {
        _rawAttrs?: string
        _isClosingTag?: boolean
      }
      var defaultTag = htmlNode.tag || 'div'
      var tag = ctx.hasOverrides ? util.getTag(defaultTag, ctx.overrides) : defaultTag
      var overrideProps = ctx.hasOverrides ? util.getOverrideProps(defaultTag, ctx.overrides) : _emptyObj
      var attrsStr: string
      if (htmlNode._rawAttrs !== undefined) {
        var rawAttrsValue = htmlNode._rawAttrs
        var needsLeadingSpace = rawAttrsValue.length > 0 &&
          rawAttrsValue.charCodeAt(0) > $.CHAR_SPACE
        attrsStr =
          (needsLeadingSpace ? ' ' : '') +
          rawAttrsValue +
          (hasKeys(overrideProps)
            ? ' ' + formatAttributes(overrideProps).trim()
            : '')
      } else {
        attrsStr = formatAttributes(_mergeAttrs(htmlNode.attrs, overrideProps))
      }
      if (ctx.tagfilter && util.shouldFilterTag(tag)) {
        return htmlNode._isClosingTag
          ? '&lt;/' + tag + '>'
          : '&lt;' + tag + attrsStr + '>'
      }
      if (htmlNode._rawText) {
        if (htmlNode._verbatim) {
          var textContent = ctx.tagfilter
            ? util.applyTagFilterToText(htmlNode._rawText)
            : htmlNode._rawText
          if (htmlNode._isClosingTag) return '</' + tag + '>' + textContent
          var tagLower = tag.toLowerCase()
          var isType1Block = parse.isType1Block(tagLower)
          if (isType1Block) {
            var textLen = htmlNode._rawText.length
            var textStart = 0
            while (
              textStart < textLen &&
              htmlNode._rawText.charCodeAt(textStart) === $.CHAR_SPACE
            )
              textStart++
            if (
              textStart < textLen &&
              htmlNode._rawText.charCodeAt(textStart) === $.CHAR_LT
            ) {
              var openingTagEnd = htmlNode._rawText.indexOf('>', textStart)
              if (openingTagEnd !== -1) {
                var rawOpeningTag = htmlNode._rawText.slice(
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
                    var innerText = htmlNode._rawText.slice(openingTagEnd + 1)
                    return (
                      rawOpeningTag +
                      (ctx.tagfilter
                        ? util.applyTagFilterToText(innerText)
                        : innerText)
                    )
                  }
                }
              }
            }
            var closingTag = '</' + tagLower + '>'
            var hasClosingTag = htmlNode._rawText.indexOf(closingTag) !== -1
            return hasClosingTag
              ? '<' + tag + attrsStr + '>' + textContent
              : '<' + tag + attrsStr + '>' + textContent + '</' + tag + '>'
          }
          var trimmed = htmlNode._rawText.trim()
          if (trimmed.length > 0 && trimmed.charCodeAt(0) === $.CHAR_LT) {
            var secondCharCode = trimmed.charCodeAt(1)
            if (
              (secondCharCode >= $.CHAR_a && secondCharCode <= $.CHAR_z) ||
              (secondCharCode >= $.CHAR_A && secondCharCode <= $.CHAR_Z)
            ) {
              var tagStart = 1
              var tagEnd = tagStart
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
              if (foundTag === tagLower) {
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
          return '<' + tag + attrsStr + '>' + (trimmedStart > 0 ? textContent.slice(trimmedStart) : trimmed ? textContent : '')
        }
        var textContent = ctx.tagfilter
          ? util.applyTagFilterToText(htmlNode._rawText)
          : htmlNode._rawText
        return '<' + tag + attrsStr + '>' + textContent + '</' + tag + '>'
      }
      // For multi-line attributes (rawAttrs contains newlines), preserve rawText formatting
      if (htmlNode._rawAttrs && htmlNode._rawAttrs.indexOf('\n') !== -1 && htmlNode._rawText) {
        var rawTextContent = ctx.tagfilter
          ? util.applyTagFilterToText(htmlNode._rawText)
          : htmlNode._rawText
        return '<' + tag + attrsStr + '>' + rawTextContent + '</' + tag + '>'
      }
      var children = htmlNode.children
        ? _renderChildren(htmlNode.children, ctx)
        : ''
      if (htmlNode._isClosingTag) return '</' + tag + '>' + children
      // Check if children has non-whitespace content without allocating a trimmed string
      var hasContent = false
      for (var hci = 0; hci < children.length; hci++) {
        var hcc = children.charCodeAt(hci)
        if (hcc !== $.CHAR_SPACE && hcc !== $.CHAR_TAB && hcc !== $.CHAR_NEWLINE && hcc !== 13) {
          hasContent = true
          break
        }
      }
      return hasContent
        ? '<' + tag + attrsStr + '>' + children + '</' + tag + '>'
        : '<' + tag + attrsStr + '>' + children
    }

    case RuleType.htmlSelfClosing: {
      var scNode = node as MarkdownToJSX.HTMLSelfClosingNode & {
        _rawText?: string
        _isClosingTag?: boolean
      }
      var scDefaultTag = scNode.tag || 'div'
      var scTag = ctx.hasOverrides ? util.getTag(scDefaultTag, ctx.overrides) : scDefaultTag
      if (scNode._rawText) {
        return ctx.tagfilter && util.shouldFilterTag(scTag)
          ? scNode._rawText.replace(/^</, '&lt;')
          : scNode._rawText
      }
      if (scNode._isClosingTag) return '</' + scTag + '>'
      var scOverrideProps = ctx.hasOverrides ? util.getOverrideProps(scDefaultTag, ctx.overrides) : _emptyObj
      var scMergedAttrs = _mergeAttrs(scNode.attrs, scOverrideProps)
      var scAttrsStr = formatAttributes(scMergedAttrs)
      if (ctx.tagfilter && util.shouldFilterTag(scTag)) {
        return '&lt;' + scTag + scAttrsStr + ' />'
      }
      return '<' + scTag + scAttrsStr + ' />'
    }

    case RuleType.image: {
      var imgTag = ctx.hasOverrides ? util.getTag('img', ctx.overrides) : 'img'
      var imgOverrideProps = ctx.hasOverrides ? util.getOverrideProps('img', ctx.overrides) : _emptyObj
      var src = ctx.sanitize(node.target || '', 'img', 'src') || ''
      var imgAttrs: Record<string, any> = {
        ...imgOverrideProps,
        alt: node.alt || '',
      }
      if (node.title) imgAttrs.title = node.title
      return '<' + imgTag + ' src="' + escapeHtml(src) + '"' + formatAttributes(imgAttrs) + ' />'
    }

    case RuleType.link: {
      var linkTag = ctx.hasOverrides ? util.getTag('a', ctx.overrides) : 'a'
      var linkOverrideProps = ctx.hasOverrides ? util.getOverrideProps('a', ctx.overrides) : _emptyObj
      var linkAttrs: Record<string, any> = hasKeys(linkOverrideProps) ? { ...linkOverrideProps } : {}
      if (node.target != null) {
        var encodedTarget = util.encodeUrlTarget(util.decodeEntityReferences(node.target))
        var sanitized = ctx.sanitize(encodedTarget, 'a', 'href')
        if (sanitized !== null) {
          linkAttrs.href = sanitized === encodedTarget
            ? sanitized
            : util.encodeUrlTarget(sanitized)
        }
      }
      if (node.title) linkAttrs.title = util.decodeEntityReferences(node.title)
      return '<' + linkTag + formatAttributes(linkAttrs) + '>' + (node.children ? _renderChildren(node.children, ctx) : '') + '</' + linkTag + '>'
    }

    case RuleType.table: {
      var tableNode = node as MarkdownToJSX.TableNode
      var alignments = tableNode.align || []
      var header = ''
      var headerCells = tableNode.header || []
      for (var hi = 0; hi < headerCells.length; hi++) {
        var align = alignments[hi]
        header +=
          '<th' +
          (align ? ' align="' + align + '"' : '') +
          '>' +
          _renderChildren(headerCells[hi], ctx) +
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
            (align ? ' align="' + align + '"' : '') +
            '>' +
            _renderChildren(row[ci], ctx) +
            '</td>'
        }
        rows += '</tr>'
      }
      if (ctx.hasOverrides) {
        var tblTag = util.getTag('table', ctx.overrides)
        var tblAttrStr = formatAttributes(util.getOverrideProps('table', ctx.overrides))
        return '<' + tblTag + tblAttrStr + '><thead><tr>' + header + '</tr></thead>' + (rows ? '<tbody>' + rows + '</tbody>' : '') + '</' + tblTag + '>'
      }
      return '<table><thead><tr>' + header + '</tr></thead>' + (rows ? '<tbody>' + rows + '</tbody>' : '') + '</table>'
    }

    case RuleType.text:
      return escapeHtml(node.text || '')

    case RuleType.textFormatted: {
      return _renderTag(
        node.tag || 'strong',
        node.children ? _renderChildren(node.children, ctx) : '',
        ctx
      )
    }

    case RuleType.orderedList:
    case RuleType.unorderedList: {
      var items = ''
      var listItems = node.items || []
      for (var li = 0; li < listItems.length; li++) {
        items += '<li>' + _renderChildren(listItems[li], ctx) + '</li>'
      }
      var listTag = node.type === RuleType.orderedList ? 'ol' : 'ul'
      var listAttrs =
        node.type === RuleType.orderedList &&
        node.start != null &&
        node.start !== 1
          ? { start: node.start }
          : undefined
      return _renderTag(listTag, items, ctx, listAttrs)
    }

    case RuleType.paragraph: {
      if (ctx.forceInline) {
        return node.children ? _renderChildren(node.children, ctx) : ''
      }
      var children = node.children
        ? _renderChildren(node.children, ctx)
        : ''
      // Per CommonMark: collapse trailing spaces before newlines (soft line breaks)
      // Use indexOf to jump between occurrences (SIMD) instead of scanning every char
      // Track tag boundaries to avoid collapsing inside HTML attribute values
      var result = ''
      var segStart = 0
      var searchFrom = 0
      var inTag = false
      var quoteCount = 0
      var idx = 0
      while ((idx = children.indexOf(' \n', searchFrom)) !== -1) {
        // Update tag tracking only in the gap since last search
        for (var j = searchFrom; j < idx; j++) {
          var code = children.charCodeAt(j)
          if (code === $.CHAR_LT) { inTag = true; quoteCount = 0 }
          else if (code === $.CHAR_GT) { inTag = false; quoteCount = 0 }
          else if (inTag && code === $.CHAR_DOUBLE_QUOTE) { quoteCount++ }
        }
        if (inTag && quoteCount % 2 === 1) {
          // Inside quoted attribute — preserve
          searchFrom = idx + 2
        } else {
          result += children.slice(segStart, idx) + '\n'
          segStart = idx + 2
          searchFrom = segStart
        }
      }
      if (segStart > 0) {
        if (segStart < children.length) result += children.slice(segStart)
        children = result
      }

      if (!ctx.hasOverrides) {
        return '<p>' + children + '</p>'
      }
      var attrsStr = formatAttributes(util.getOverrideProps('p', ctx.overrides))
      var tag = util.getTag('p', ctx.overrides)
      return '<' + tag + attrsStr + '>' + children + '</' + tag + '>'
    }

    default:
      return ''
  }
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
  var sanitize = options.sanitizer || util.sanitizer
  var slug = options.slugify || util.slugify
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

  // Create render context once — shared across all recursive renders
  var ctx: _Ctx = {
    sanitize: sanitize,
    slug: slug,
    refs: refs,
    overrides: overrides,
    hasOverrides: hasKeys(overrides),
    preserveFrontmatter: !!options.preserveFrontmatter,
    tagfilter: !!options.tagfilter,
    forceInline: !!options.forceInline,
    renderRule: options.renderRule,
  }

  var content = ''
  if (Array.isArray(nodes)) {
    if (ctx.renderRule) {
      for (var ci = 0; ci < nonRefCollectionNodes.length; ci++) {
        content += _renderNodeEntry(nonRefCollectionNodes[ci], {
          key: ci,
          refs: refs,
        }, ctx)
      }
    } else {
      for (var ci = 0; ci < nonRefCollectionNodes.length; ci++) {
        content += _renderNode(nonRefCollectionNodes[ci], ctx)
      }
    }
  } else {
    content = _renderNodeEntry(nodes, { refs: refs }, ctx)
  }

  // Extract and render footnotes
  var footnoteFooter = ''
  for (var key in refs) {
    if (key.charCodeAt(0) === $.CHAR_CARET) {
      if (!footnoteFooter) footnoteFooter = '<footer>'
      var id = key.slice(1)
      var parsed = parse.parseMarkdown(
        refs[key].target,
        { inline: true, refs },
        {
          overrides: overrides as MarkdownToJSX.Overrides,
          sanitizer: sanitize,
          slugify: function (i: string) { return slug(i, util.slugify) },
          tagfilter: options.tagfilter !== false,
        }
      )
      var filtered: MarkdownToJSX.ASTNode[] = []
      for (var pi = 0; pi < parsed.length; pi++) {
        if (parsed[pi].type !== RuleType.refCollection)
          filtered.push(parsed[pi])
      }
      var footnoteCtx: _Ctx = {
        sanitize: sanitize,
        slug: slug,
        refs: {},
        overrides: overrides,
        hasOverrides: ctx.hasOverrides,
        preserveFrontmatter: ctx.preserveFrontmatter,
        tagfilter: ctx.tagfilter,
        forceInline: true,
        renderRule: ctx.renderRule,
      }
      var footnoteContent = _renderChildren(filtered, footnoteCtx)
      footnoteFooter += '<div id="' + escapeHtmlAttr(slug(id, util.slugify)) + '">' + escapeHtml(id) + ': ' + footnoteContent + '</div>'
    }
  }
  if (footnoteFooter) footnoteFooter += '</footer>'

  // Handle wrapper options
  if (options.wrapper === null) {
    return content + footnoteFooter
  }

  // Determine if content should be wrapped (only when explicitly requested)
  var hasMultipleChildren = nonRefCollectionNodes.length > 1
  var hasExplicitWrapper = options.wrapper != null
  var wrapperWasExplicit =
    hasExplicitWrapper && typeof options.wrapper === 'string'
  var shouldWrap =
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
      var paragraphNode =
        nonRefCollectionNodes[0] as MarkdownToJSX.ParagraphNode
      if (paragraphNode.children) {
        var inlineCtx: _Ctx = {
          sanitize: sanitize,
          slug: slug,
          refs: {},
          overrides: overrides,
          hasOverrides: ctx.hasOverrides,
          preserveFrontmatter: ctx.preserveFrontmatter,
          tagfilter: ctx.tagfilter,
          forceInline: true,
          renderRule: ctx.renderRule,
        }
        contentToWrap = _renderChildren(paragraphNode.children, inlineCtx)
      }
    }
  }

  // Determine wrapper tag
  var wrapperTag =
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

  return '<' + wrapperTag + wrapperAttrs + '>' + contentToWrap + footnoteFooter + '</' + wrapperTag + '>'
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
  var inline = options?.forceInline || false
  var parseOptions: parse.ParseOptions = {
    ...options,
    overrides: options?.overrides as MarkdownToJSX.Overrides,
    sanitizer: options?.sanitizer,
    slugify: options?.slugify
      ? function (i: string) { return options.slugify!(i, util.slugify) }
      : util.slugify,
    tagfilter: options?.tagfilter !== false,
  }
  var ast = parse.parser(markdown, { ...parseOptions, forceInline: inline })
  var htmlOptions: HTMLOptions = {
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
