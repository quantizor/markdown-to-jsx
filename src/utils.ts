import { MarkdownToJSX, RuleType } from './types'

/**
 * Named HTML entity codes to unicode character mapping
 * Shared between parse.ts and index.tsx
 */
export const NAMED_CODES_TO_UNICODE = {
  amp: '\u0026',
  apos: '\u0027',
  gt: '\u003e',
  lt: '\u003c',
  nbsp: '\u00a0',
  quot: '\u201c',
} as const

/**
 * Convert hyphenated CSS property name to camelCase
 * Example: "background-color" -> "backgroundColor"
 */
export function camelCaseCss(prop: string): string {
  return prop.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase())
}

const SANITIZE_R = /(javascript|vbscript|data(?!:image)):/i

export function sanitizer(input: string): string | null {
  try {
    const decoded = decodeURIComponent(input).replace(/[^A-Za-z0-9/:]/g, '')

    if (SANITIZE_R.test(decoded)) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          'Input contains an unsafe JavaScript/VBScript/data expression, it will not be rendered.',
          decoded
        )
      }

      return null
    }
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        'Input could not be decoded due to malformed syntax or characters, it will not be rendered.',
        input
      )
    }

    // decodeURIComponent sometimes throws a URIError
    // See `decodeURIComponent('a%AFc');`
    // http://stackoverflow.com/questions/9064536/javascript-decodeuricomponent-malformed-uri-exception
    return null
  }

  return input
}

// based on https://stackoverflow.com/a/18123682/1141611
// not complete, but probably good enough
export function slugify(str: string) {
  return str
    .replace(/[ÀÁÂÃÄÅàáâãäåæÆ]/g, 'a')
    .replace(/[çÇ]/g, 'c')
    .replace(/[ðÐ]/g, 'd')
    .replace(/[ÈÉÊËéèêë]/g, 'e')
    .replace(/[ÏïÎîÍíÌì]/g, 'i')
    .replace(/[Ññ]/g, 'n')
    .replace(/[øØœŒÕõÔôÓóÒò]/g, 'o')
    .replace(/[ÜüÛûÚúÙù]/g, 'u')
    .replace(/[ŸÿÝý]/g, 'y')
    .replace(/[^a-z0-9- ]/gi, '')
    .replace(/ /gi, '-')
    .toLowerCase()
}

/**
 * Escape HTML entities for text content
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

/**
 * Format HTML attributes to string
 */
function formatAttributes(attrs: Record<string, any> = {}): string {
  const parts: string[] = []
  for (const key in attrs) {
    const value = attrs[key]
    if (value === undefined || value === null) continue
    if (value === true || value === '') {
      parts.push(key)
    } else if (typeof value === 'string') {
      parts.push(`${key}="${escapeHtml(value)}"`)
    } else if (typeof value === 'number') {
      parts.push(`${key}="${value}"`)
    }
  }
  return parts.length > 0 ? ' ' + parts.join(' ') : ''
}

/**
 * Convert AST nodes to HTML string output.
 */
export function emitHTML(
  nodes: MarkdownToJSX.ASTNode[],
  options: {
    sanitizer?: (value: string, tag: string, attribute: string) => string | null
    slugify?: (input: string, defaultFn: (input: string) => string) => string
    refs?: { [key: string]: { target: string; title: string | undefined } }
  } = {}
): string {
  const sanitize = options.sanitizer || sanitizer
  const slug = options.slugify || slugify
  const refs = options.refs || {}

  function renderNode(node: MarkdownToJSX.ASTNode): string {
    if (!node || typeof node !== 'object') return ''

    switch (node.type) {
      case RuleType.blockQuote: {
        const attrs: Record<string, any> = {}
        if (node.alert) {
          attrs.class =
            'markdown-alert-' + slug(node.alert.toLowerCase(), slugify)
        }
        const attrStr = formatAttributes(attrs)
        let children = node.children ? emitHTML(node.children, options) : ''
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
          const existingClass = codeAttrs.class || codeAttrs.className || ''
          const langClass = 'lang-' + node.lang
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
        const checked = node.completed ? ' checked' : ''
        return `<input type="checkbox"${checked} readonly />`
      }

      case RuleType.heading: {
        const level = node.level || 1
        const attrs: Record<string, any> = {}
        if (node.id) attrs.id = node.id
        const attrStr = formatAttributes(attrs)
        const children = node.children ? emitHTML(node.children, options) : ''
        return `<h${level}${attrStr}>${children}</h${level}>`
      }

      case RuleType.htmlComment: {
        return `<!--${node.text}-->`
      }

      case RuleType.htmlBlock: {
        const tag = node.tag || 'div'
        const attrs = formatAttributes(node.attrs || {})
        if (node.text) {
          return `<${tag}${attrs}>${node.text}</${tag}>`
        }
        const children = node.children ? emitHTML(node.children, options) : ''
        return `<${tag}${attrs}>${children}</${tag}>`
      }

      case RuleType.htmlSelfClosing: {
        const tag = node.tag || 'br'
        const attrs = formatAttributes(node.attrs || {})
        return `<${tag}${attrs} />`
      }

      case RuleType.image: {
        const src = sanitize(node.target || '', 'img', 'src') || ''
        const attrs: Record<string, any> = {}
        if (node.alt) attrs.alt = node.alt
        if (node.title) attrs.title = node.title
        const attrStr = formatAttributes(attrs)
        return `<img src="${escapeHtml(src)}"${attrStr} />`
      }

      case RuleType.link: {
        const href =
          node.target !== null ? sanitize(node.target, 'a', 'href') : null
        const attrs: Record<string, any> = {}
        if (href) attrs.href = href
        if (node.title) attrs.title = node.title
        const attrStr = formatAttributes(attrs)
        const children = node.children ? emitHTML(node.children, options) : ''
        return `<a${attrStr}>${children}</a>`
      }

      case RuleType.refImage: {
        const ref = refs[node.ref]
        if (!ref) return ''
        const src = sanitize(ref.target, 'img', 'src') || ''
        const attrs: Record<string, any> = {}
        if (node.alt) attrs.alt = node.alt
        if (ref.title) attrs.title = ref.title
        const attrStr = formatAttributes(attrs)
        return `<img src="${escapeHtml(src)}"${attrStr} />`
      }

      case RuleType.refLink: {
        const ref = refs[node.ref]
        if (ref) {
          const href = sanitize(ref.target, 'a', 'href') || ''
          const attrs: Record<string, any> = {}
          if (href) attrs.href = href
          if (ref.title) attrs.title = ref.title
          const attrStr = formatAttributes(attrs)
          const children = node.children ? emitHTML(node.children, options) : ''
          return `<a${attrStr}>${children}</a>`
        }
        const children = node.fallbackChildren || ''
        return `<span>${escapeHtml(children)}</span>`
      }

      case RuleType.table: {
        const header = (node.header || [])
          .map((cell: any) => {
            const content = emitHTML(cell, options)
            return `<th>${content}</th>`
          })
          .join('')
        const rows = (node.cells || [])
          .map((row: any) => {
            const cells = (row || [])
              .map((cell: any) => {
                const content = emitHTML(cell, options)
                return `<td>${content}</td>`
              })
              .join('')
            return `<tr>${cells}</tr>`
          })
          .join('')
        return `<table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table>`
      }

      case RuleType.text: {
        return escapeHtml(node.text || '')
      }

      case RuleType.textFormatted: {
        const tag = node.tag || 'strong'
        const children = node.children ? emitHTML(node.children, options) : ''
        return `<${tag}>${children}</${tag}>`
      }

      case RuleType.orderedList: {
        const attrs: Record<string, any> = {}
        if (node.start !== undefined) attrs.start = node.start
        const attrStr = formatAttributes(attrs)
        const items = (node.items || [])
          .map((item: any) => {
            const content = emitHTML(item, options)
            return `<li>${content}</li>`
          })
          .join('')
        return `<ol${attrStr}>${items}</ol>`
      }

      case RuleType.unorderedList: {
        const items = (node.items || [])
          .map((item: any) => {
            const content = emitHTML(item, options)
            return `<li>${content}</li>`
          })
          .join('')
        return `<ul>${items}</ul>`
      }

      case RuleType.paragraph: {
        const children = node.children ? emitHTML(node.children, options) : ''
        return `<p>${children}</p>`
      }

      default:
        return ''
    }
  }

  if (Array.isArray(nodes)) {
    return nodes.map(renderNode).join('')
  }

  return renderNode(nodes)
}
