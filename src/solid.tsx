/** @jsxRuntime classic */
/** @jsx h */

import {
  Component,
  JSX,
  Accessor,
  createMemo,
  createContext,
  useContext,
  type Context,
} from 'solid-js'
import solidH from 'solid-js/h'
import * as $ from './constants'
import * as parse from './parse'
import { MarkdownToJSX, RuleType, RequireAtLeastOne } from './types'
import * as util from './utils'

export { parser } from './parse'
import { parser } from './parse'

export { RuleType, type MarkdownToJSX } from './types'
export { sanitizer, slugify } from './utils'

const TRIM_STARTING_NEWLINES = /^\n+/

// Import shared HTML to JSX conversion utilities
import { htmlAttrsToJSXProps } from './utils'

// Internal helper to create SolidJS elements
const hasDOM = typeof document !== 'undefined'

// Helper function for URL encoding backslashes and backticks per CommonMark spec
function encodeUrlTarget(target: string): string {
  // Fast path: check if encoding is needed
  let needsEncoding = false
  for (let i = 0; i < target.length; i++) {
    const code = target.charCodeAt(i)
    if (code > 127 || code === $.CHAR_BACKSLASH || code === $.CHAR_BACKTICK) {
      needsEncoding = true
      break
    }
  }
  if (!needsEncoding) return target

  // Encode character by character, preserving existing percent-encoded sequences
  let result = ''
  for (let i = 0; i < target.length; i++) {
    const code = target.charCodeAt(i)
    if (
      target[i] === '%' &&
      i + 2 < target.length &&
      /[0-9A-Fa-f]/.test(target[i + 1]) &&
      /[0-9A-Fa-f]/.test(target[i + 2])
    ) {
      // Preserve existing percent-encoded sequence
      result += target[i] + target[i + 1] + target[i + 2]
      i += 2
    } else if (code === $.CHAR_BACKSLASH) {
      result += '%5C'
    } else if (code === $.CHAR_BACKTICK) {
      result += '%60'
    } else {
      result += code > 127 ? encodeURIComponent(target[i]) : target[i]
    }
  }
  return result
}

type SolidASTRender = (
  ast: MarkdownToJSX.ASTNode | MarkdownToJSX.ASTNode[],
  state: Omit<MarkdownToJSX.State, 'key'>
) => JSX.Element | JSX.Element[]

type HTag = string | Component<Record<string, unknown>>
type HProps = Record<string, unknown>
type HChildren = JSX.Element | JSX.Element[] | string | null

// Normalize children to array format
const toArray = <T,>(value: T | T[]): T[] =>
  Array.isArray(value) ? value : [value]

// Check if value is a SolidJS component
const isComponent = (
  value: unknown
): value is Component<Record<string, unknown>> =>
  typeof value === 'function' ||
  (typeof value === 'object' && value !== null && 'render' in value)

// Format HTML attributes for filtered tags
function formatFilteredTagAttrs(
  attrs: Record<string, unknown> | undefined
): string {
  if (!attrs) return ''
  let attrStr = ''
  for (const [key, value] of Object.entries(attrs)) {
    if (value === true) {
      attrStr += ` ${key}`
    } else if (value !== undefined && value !== null && value !== false) {
      attrStr += ` ${key}="${String(value)}"`
    }
  }
  return attrStr
}

function render(
  node: MarkdownToJSX.ASTNode,
  output: SolidASTRender,
  state: Omit<MarkdownToJSX.State, 'key'>,
  h: (tag: HTag, props: HProps, ...children: HChildren[]) => JSX.Element,
  sanitize: (value: string, tag: string, attribute: string) => string | null,
  slug: (input: string, defaultFn: (input: string) => string) => string,
  refs: { [key: string]: { target: string; title: string } },
  options: SolidOptions
): JSX.Element | string | null {
  switch (node.type) {
    case RuleType.blockQuote: {
      const props = {} as Record<string, unknown>
      let children = node.children
      if (node.alert) {
        props.className =
          'markdown-alert-' + slug(node.alert.toLowerCase(), util.slugify)
        const headerNode: MarkdownToJSX.HTMLNode = {
          attrs: {},
          children: [{ type: RuleType.text, text: node.alert }],
          verbatim: true,
          type: RuleType.htmlBlock,
          tag: 'header',
        }
        children = [headerNode, ...children]
      }
      return h('blockquote', props, ...toArray(output(children, state)))
    }

    case RuleType.breakLine:
      return h('br', {})

    case RuleType.breakThematic:
      return h('hr', {})

    case RuleType.frontmatter:
      if (options.preserveFrontmatter) {
        return h('pre', {}, node.text)
      }
      return null

    case RuleType.codeBlock: {
      const decodedLang = node.lang
        ? util.decodeEntityReferences(node.lang)
        : ''
      const codeProps = {
        ...htmlAttrsToJSXProps((node.attrs || {}) as Record<string, unknown>),
        className: decodedLang
          ? `language-${decodedLang} lang-${decodedLang}`
          : '',
      } as Record<string, unknown>
      return h('pre', {}, h('code', codeProps, node.text))
    }

    case RuleType.codeInline:
      return h('code', {}, node.text)

    case RuleType.footnoteReference:
      return h(
        'a',
        { href: sanitize(node.target, 'a', 'href') },
        h('sup', {}, node.text)
      )

    case RuleType.gfmTask:
      return h('input', {
        checked: node.completed,
        readOnly: true,
        type: 'checkbox',
      })

    case RuleType.heading:
      return h(
        `h${node.level}`,
        { id: node.id },
        ...toArray(output(node.children, state))
      )

    case RuleType.htmlBlock: {
      const htmlNode = node as MarkdownToJSX.HTMLNode

      // Apply options.tagfilter: escape dangerous tags
      if (options.tagfilter && util.shouldFilterTag(htmlNode.tag)) {
        const tagText =
          'rawText' in htmlNode && typeof htmlNode.rawText === 'string'
            ? htmlNode.rawText
            : `<${htmlNode.tag}${formatFilteredTagAttrs(htmlNode.attrs)}>`
        return h('span', {}, tagText)
      }

      if (htmlNode.rawText && htmlNode.verbatim) {
        // Type 1 blocks (script, style, pre, textarea) must have verbatim text content
        const tagLower = (htmlNode.tag as string).toLowerCase()
        const isType1Block = parse.isType1Block(tagLower)

        const containsHTMLTags = /<[a-z][^>]{0,100}>/i.test(htmlNode.rawText)
        const containsPreTags = /<\/?pre\b/i.test(htmlNode.rawText)

        if (isType1Block && !containsHTMLTags) {
          let textContent = htmlNode.rawText.replace(
            new RegExp('\\s*</' + tagLower + '>\\s*$', 'i'),
            ''
          )
          if (options.tagfilter) {
            textContent = util.applyTagFilterToText(textContent)
          }
          return h(node.tag, { ...node.attrs }, textContent)
        }

        if (containsPreTags) {
          const innerHtml = options.tagfilter
            ? util.applyTagFilterToText(htmlNode.rawText)
            : htmlNode.rawText
          return h(node.tag, {
            ...node.attrs,
            innerHTML: innerHtml,
          })
        }
        // Use already-parsed children if available instead of re-parsing rawText
        function processNode(
          node: MarkdownToJSX.ASTNode
        ): MarkdownToJSX.ASTNode[] {
          if (
            node.type === RuleType.htmlSelfClosing &&
            'isClosingTag' in node &&
            (
              node as MarkdownToJSX.HTMLSelfClosingNode & {
                isClosingTag?: boolean
              }
            ).isClosingTag
          )
            return []
          if (node.type === RuleType.paragraph) {
            const children = (node as MarkdownToJSX.ParagraphNode).children
            return children ? children.flatMap(processNode) : []
          }
          if (node.type === RuleType.text) {
            return (node as MarkdownToJSX.TextNode).text?.trim() ? [node] : []
          }
          if (
            node.type === RuleType.htmlBlock &&
            (node as MarkdownToJSX.HTMLNode).children
          ) {
            return [
              {
                ...node,
                children: node.children?.flatMap(processNode),
              } as MarkdownToJSX.HTMLNode,
            ]
          }
          return [node]
        }
        if (htmlNode.children && htmlNode.children.length > 0) {
          return h(
            node.tag,
            { ...node.attrs },
            output(htmlNode.children.flatMap(processNode), state)
          )
        }
        // Fallback to re-parsing rawText if children not available (edge case)
        const parseOptions: parse.ParseOptions = {
          slugify: (input: string) => slug(input, util.slugify),
          sanitizer: sanitize,
          tagfilter: true,
        }
        const cleanedText = htmlNode.rawText
          .replace(/>\s+</g, '><')
          .replace(/\n+/g, ' ')
          .trim()

        // Avoid infinite recursion: if cleanedText is just the same HTML tag we're processing,
        // render as an empty element
        const selfTagRegex = new RegExp(
          `^<${htmlNode.tag}(\\s[^>]*)?>(\\s*</${htmlNode.tag}>)?$`,
          'i'
        )
        if (selfTagRegex.test(cleanedText)) {
          return h(node.tag, { ...node.attrs })
        }

        const astNodes = parse.parseMarkdown(
          cleanedText,
          { inline: false, refs: refs, inHTML: false },
          parseOptions
        )
        const processedChildren = output(astNodes.flatMap(processNode), state)
        return h(node.tag, { ...node.attrs }, ...toArray(processedChildren))
      }
      return h(
        node.tag,
        { ...node.attrs },
        ...(node.children ? toArray(output(node.children, state)) : [])
      )
    }

    case RuleType.htmlSelfClosing: {
      const htmlNode = node as MarkdownToJSX.HTMLSelfClosingNode

      // Apply options.tagfilter: escape dangerous self-closing tags
      if (options.tagfilter && util.shouldFilterTag(htmlNode.tag)) {
        const tagText =
          'rawText' in htmlNode && typeof htmlNode.rawText === 'string'
            ? htmlNode.rawText
            : `<${htmlNode.tag}${formatFilteredTagAttrs(htmlNode.attrs)} />`
        return h('span', {}, tagText)
      }

      return h(htmlNode.tag, { ...htmlNode.attrs })
    }

    case RuleType.image: {
      return h('img', {
        alt: node.alt && node.alt.length > 0 ? node.alt : undefined,
        title: node.title || undefined,
        src: sanitize(node.target, 'img', 'src'),
      } as Record<string, unknown>)
    }

    case RuleType.link: {
      const props: Record<string, unknown> = {}
      if (node.target != null) props.href = encodeUrlTarget(node.target)
      if (node.title) props.title = node.title
      return h('a', props, ...toArray(output(node.children, state)))
    }

    case RuleType.table: {
      const table = node as MarkdownToJSX.TableNode
      return h(
        'table',
        {},
        h(
          'thead',
          {},
          h(
            'tr',
            {},
            ...table.header.map(function generateHeaderCell(content, i) {
              return h(
                'th',
                {
                  style:
                    table.align[i] == null ? {} : { textAlign: table.align[i] },
                },
                ...toArray(output(content, state))
              )
            })
          )
        ),
        h(
          'tbody',
          {},
          ...table.cells.map(function generateTableRow(row, i) {
            return h(
              'tr',
              {},
              ...row.map(function generateTableCell(content, c) {
                return h(
                  'td',
                  {
                    style:
                      table.align[c] == null
                        ? {}
                        : { textAlign: table.align[c] },
                  },
                  ...toArray(output(content, state))
                )
              })
            )
          })
        )
      )
    }

    case RuleType.text:
      return node.text

    case RuleType.textFormatted:
      return h(
        node.tag as MarkdownToJSX.HTMLTags,
        {},
        ...toArray(output(node.children, state))
      )

    case RuleType.orderedList:
    case RuleType.unorderedList: {
      const Tag = node.type === RuleType.orderedList ? 'ol' : 'ul'

      return h(
        Tag,
        {
          start: node.type === RuleType.orderedList ? node.start : undefined,
        },
        ...node.items.map(function generateListItem(item, i) {
          return h('li', {}, ...toArray(output(item, state)))
        })
      )
    }

    case RuleType.paragraph:
      return h('p', {}, ...toArray(output(node.children, state)))

    case RuleType.ref:
      // Reference definitions should not be rendered (they're consumed during parsing)
      return null

    default:
      return null
  }
}

const createRenderer = (
  userRender: SolidOptions['renderRule'],
  h: (
    tag: HTag,
    props: HProps & {
      className?: string
      id?: string
    },
    ...children: HChildren[]
  ) => JSX.Element,
  sanitize: (value: string, tag: string, attribute: string) => string | null,
  slug: (input: string, defaultFn: (input: string) => string) => string,
  refs: { [key: string]: { target: string; title: string } },
  options: SolidOptions
) => {
  const renderRule = (
    node: MarkdownToJSX.ASTNode,
    renderChildren: (
      children: MarkdownToJSX.ASTNode[]
    ) => JSX.Element | JSX.Element[],
    state: Omit<MarkdownToJSX.State, 'key'>
  ) => {
    const defaultRender = () =>
      render(
        node,
        ast => renderChildren(toArray(ast)),
        state,
        h,
        sanitize,
        slug,
        refs,
        options
      )
    return userRender
      ? userRender(defaultRender, node, renderChildren, state)
      : defaultRender()
  }
  const handleStackOverflow = (ast: MarkdownToJSX.ASTNode[]) =>
    ast.map(node => ('text' in node ? node.text : ''))
  const renderer = (
    ast: MarkdownToJSX.ASTNode[],
    state: Omit<MarkdownToJSX.State, 'key'> = {}
  ) => {
    const depth = (state.renderDepth || 0) + 1
    if (depth > 2500) return handleStackOverflow(ast)

    const result: (JSX.Element | string)[] = []
    let lastWasString = false
    for (let i = 0; i < ast.length; i++) {
      const nodeOut = renderRule(ast[i], renderer, {
          ...state,
          renderDepth: depth,
        }),
        isString = typeof nodeOut === 'string'
      if (isString && lastWasString) {
        // Concatenate consecutive strings
        result[result.length - 1] += nodeOut
      } else if (nodeOut !== null) {
        if (Array.isArray(nodeOut)) {
          // Use loop instead of spread for better performance
          for (let j = 0; j < nodeOut.length; j++) {
            result.push(nodeOut[j])
          }
        } else {
          result.push(nodeOut)
        }
      }
      lastWasString = isString
    }
    return result
  }
  return renderer
}

const cx = (...args: (string | undefined | null | false)[]): string =>
  args.filter(Boolean).join(' ')

const getTag = (
  tag: string,
  overrides: SolidOverrides | undefined
): string | Component<Record<string, unknown>> => {
  const override = util.get(overrides, tag, undefined)
  if (!override) return tag
  if (isComponent(override)) return override
  const component = util.get(overrides, `${tag}.component`, tag)
  return isComponent(component) ? component : (component as string)
}

/**
 * Override configuration for HTML tags or custom components in SolidJS output
 * @lang zh SolidJS 输出中 HTML 标签或自定义组件的覆盖配置
 * @lang hi SolidJS आउटपुट में HTML टैग्स या कस्टम कंपोनेंट्स के लिए ओवरराइड कॉन्फ़िगरेशन
 */
export type SolidOverride =
  | RequireAtLeastOne<{
      component: string | Component<Record<string, unknown>>
      props: Record<string, unknown>
    }>
  | string
  | Component<Record<string, unknown>>

/**
 * Map of HTML tags and custom components to their override configurations
 * @lang zh HTML 标签和自定义组件到其覆盖配置的映射
 * @lang hi HTML टैग्स और कस्टम कंपोनेंट्स से उनकी ओवरराइड कॉन्फ़िगरेशन का मैप
 */
export type SolidOverrides = {
  [tag in MarkdownToJSX.HTMLTags]?: SolidOverride
} & {
  [customComponent: string]: SolidOverride
}

/**
 * SolidJS compiler options
 * @lang zh SolidJS 编译器选项
 * @lang hi SolidJS कंपाइलर विकल्प
 */
export type SolidOptions = Omit<
  MarkdownToJSX.Options,
  'createElement' | 'wrapperProps' | 'renderRule' | 'overrides'
> & {
  /** Custom createElement function for SolidJS */
  /** @lang zh SolidJS 的自定义 createElement 函数 */
  /** @lang hi SolidJS के लिए कस्टम createElement फ़ंक्शन */
  createElement?: (
    tag: HTag,
    props: HProps,
    ...children: HChildren[]
  ) => JSX.Element
  /** Props for wrapper element */
  /** @lang zh 包装元素的属性 */
  /** @lang hi रैपर एलिमेंट के लिए props */
  wrapperProps?: JSX.HTMLAttributes<HTMLElement>
  /** Custom rendering function for AST rules */
  /** @lang zh AST 规则的自定义渲染函数 */
  /** @lang hi AST नियमों के लिए कस्टम रेंडरिंग फ़ंक्शन */
  renderRule?: (
    next: () => JSX.Element | string | null,
    node: MarkdownToJSX.ASTNode,
    renderChildren: (
      children: MarkdownToJSX.ASTNode[]
    ) => JSX.Element | JSX.Element[],
    state: Omit<MarkdownToJSX.State, 'key'>
  ) => JSX.Element | string | null
  /** Override configurations for HTML tags */
  /** @lang zh HTML 标签的覆盖配置 */
  /** @lang hi HTML टैग्स के लिए ओवरराइड कॉन्फ़िगरेशन */
  overrides?: SolidOverrides
}

/**
 * Convert AST nodes to SolidJS JSX elements
 * @lang zh 将 AST 节点转换为 SolidJS JSX 元素
 * @lang hi AST नोड्स को SolidJS JSX एलिमेंट्स में बदलें
 *
 * @param ast - Array of AST nodes to render
 * @lang zh @param ast - 要渲染的 AST 节点数组
 * @lang hi @param ast - रेंडर करने के लिए AST नोड्स की सरणी
 * @param options - SolidJS compiler options
 * @lang zh @param options - SolidJS 编译器选项
 * @lang hi @param options - SolidJS कंपाइलर विकल्प
 * @returns SolidJS JSX element(s)
 * @lang zh @returns SolidJS JSX 元素
 * @lang hi @returns SolidJS JSX एलिमेंट(s)
 */
export function astToJSX(
  ast: MarkdownToJSX.ASTNode[],
  options?: SolidOptions
): JSX.Element | JSX.Element[] | null {
  const opts = { ...(options || {}) }
  opts.overrides = opts.overrides || {}

  const slug = opts.slugify || util.slugify
  const sanitize = opts.sanitizer || util.sanitizer

  // Recursive compile function for HTML content
  const compileHTML = (input: string) =>
    compiler(input, { ...opts, wrapper: null })

  function createSolidElement(
    tag: string | Component<Record<string, unknown>>,
    props: Record<string, unknown>,
    ...children: HChildren[]
  ): JSX.Element {
    if (!hasDOM) {
      // Non-DOM environments (tests/SSR) get a structural representation or component output
      const childValue =
        children.length === 0
          ? undefined
          : children.length === 1
            ? children[0]
            : children
      const propsWithChildren =
        childValue === undefined ? props : { ...props, children: childValue }
      if (typeof tag === 'function') {
        return (tag as Component<Record<string, unknown>>)(
          propsWithChildren as Record<string, unknown>
        )
      }
      return {
        t: tag,
        p: propsWithChildren,
      } as unknown as JSX.Element
    }
    const elementFactory = solidH(
      tag as Component<Record<string, unknown>>,
      props,
      ...children
    )
    return typeof elementFactory === 'function'
      ? (elementFactory as () => JSX.Element)()
      : (elementFactory as JSX.Element)
  }

  // JSX helper function - this is what @jsx pragma uses
  function h(
    tag: MarkdownToJSX.HTMLTags | string,
    props: Record<string, unknown> & {
      className?: string
      id?: string
      innerHTML?: string
    },
    ...children: HChildren[]
  ): JSX.Element {
    const overrideProps = util.get(
      opts.overrides,
      `${tag}.props`,
      {}
    ) as Record<string, unknown>

    // Convert HTML attributes to JSX props and compile any HTML content
    const jsxProps = htmlAttrsToJSXProps(props || {}) as Record<string, unknown>
    // Only check props that might contain HTML (avoid iterating all props)
    for (const key in jsxProps) {
      const value = jsxProps[key]
      if (
        typeof value === 'string' &&
        value.length > 0 &&
        value[0] === '<' &&
        (parse.HTML_BLOCK_ELEMENT_START_R_ATTR.test(value) ||
          parse.UPPERCASE_TAG_R.test(value) ||
          parse.parseHTMLTag(value, 0))
      ) {
        jsxProps[key] = compileHTML(value.trim())
      }
    }

    const finalTag = getTag(tag, opts.overrides)
    const mergedClassName =
      cx(
        jsxProps?.className as string | undefined,
        (overrideProps.className as string | undefined) || undefined
      ) || undefined

    // Build finalProps efficiently
    const finalProps: Record<string, unknown> = {
      ...jsxProps,
      ...overrideProps,
    }
    if (mergedClassName) finalProps.className = mergedClassName
    // Handle innerHTML for SolidJS (move from jsxProps to finalProps)
    // Only set innerHTML from jsxProps if user didn't provide it in overrides
    if (jsxProps.innerHTML && overrideProps.innerHTML === undefined) {
      finalProps.innerHTML = jsxProps.innerHTML
      delete jsxProps.innerHTML
    }

    return createSolidElement(finalTag, finalProps, ...children)
  }

  // SolidJS createElement helper - uses createSolidElement
  const createElement =
    opts.createElement ||
    ((tag: HTag, props: HProps, ...children: HChildren[]): JSX.Element =>
      createSolidElement(tag, props || {}, ...children))

  // Extract text from AST nodes recursively
  function extractText(nodes: MarkdownToJSX.ASTNode[]): string {
    let text = ''
    for (const n of nodes) {
      const type = n.type
      if (type === RuleType.text) {
        text += (n as MarkdownToJSX.TextNode).text
      } else if (type === RuleType.htmlSelfClosing && 'rawText' in n) {
        const rawText = (
          n as MarkdownToJSX.HTMLSelfClosingNode & { rawText?: string }
        ).rawText
        if (rawText) text += rawText
      } else if (type === RuleType.textFormatted) {
        const formattedNode = n as MarkdownToJSX.FormattedTextNode
        const marker =
          formattedNode.tag === 'em'
            ? '_'
            : formattedNode.tag === 'strong'
              ? '**'
              : ''
        text += marker + extractText(formattedNode.children) + marker
      } else if ('children' in n && n.children) {
        text += extractText(n.children)
      }
    }
    return text
  }

  // Post-process AST for JSX compatibility: combine HTML blocks with following paragraphs
  // when the HTML block contains <pre> tags (to keep pre content as plain text)
  const postProcessedAst: MarkdownToJSX.ASTNode[] = []
  for (let i = 0; i < ast.length; i++) {
    const node = ast[i]
    if (
      node.type === RuleType.htmlBlock &&
      'rawText' in node &&
      node.rawText &&
      /<\/?pre\b/i.test(node.rawText) &&
      i + 1 < ast.length &&
      ast[i + 1].type === RuleType.paragraph &&
      'removedClosingTags' in ast[i + 1] &&
      (
        ast[i + 1] as MarkdownToJSX.ParagraphNode & {
          removedClosingTags?: MarkdownToJSX.ASTNode[]
        }
      ).removedClosingTags
    ) {
      const htmlNode = node as MarkdownToJSX.HTMLNode
      const paragraphNode = ast[i + 1] as MarkdownToJSX.ParagraphNode & {
        removedClosingTags?: MarkdownToJSX.ASTNode[]
      }
      let combinedText = extractText(paragraphNode.children)
      if (paragraphNode.removedClosingTags) {
        // Single-pass filter and extract (avoid filter/map/join chain)
        const closingTagText: string[] = []
        const closingTagEnd = `</${htmlNode.tag}>`
        for (const tag of paragraphNode.removedClosingTags) {
          if (tag.type === RuleType.htmlSelfClosing && 'rawText' in tag) {
            const rawText = (
              tag as MarkdownToJSX.HTMLSelfClosingNode & { rawText?: string }
            ).rawText
            if (rawText && rawText.indexOf(closingTagEnd) === -1) {
              closingTagText.push(rawText)
            }
          }
        }
        combinedText += closingTagText.join('')
      }
      // Create a new node instead of mutating to avoid issues with memoization
      // When ast() is cached but jsx() recalculates, mutation would accumulate text
      const newRawText = (htmlNode.rawText || '') + '\n' + combinedText
      const modifiedHtmlNode: MarkdownToJSX.HTMLNode = {
        ...htmlNode,
        rawText: newRawText,
        text: newRawText, // @deprecated - use rawText instead
      }
      postProcessedAst.push(modifiedHtmlNode)
      i++ // Skip paragraph
    } else {
      postProcessedAst.push(node)
    }
  }

  const parseOptions: parse.ParseOptions = {
    slugify: i => slug(i, util.slugify),
    sanitizer: sanitize,
    tagfilter: opts.tagfilter !== false,
    disableAutoLink: opts.disableAutoLink,
    disableParsingRawHTML: opts.disableParsingRawHTML,
    enforceAtxHeadings: opts.enforceAtxHeadings,
    forceBlock: opts.forceBlock,
    forceInline: opts.forceInline,
    preserveFrontmatter: opts.preserveFrontmatter,
  }

  const refs =
    postProcessedAst[0] && postProcessedAst[0].type === RuleType.refCollection
      ? (postProcessedAst[0] as MarkdownToJSX.ReferenceCollectionNode).refs
      : {}

  const emitter = createRenderer(
    opts.renderRule,
    h as (
      tag: HTag,
      props: HProps & {
        className?: string
        id?: string
      },
      ...children: HChildren[]
    ) => JSX.Element,
    sanitize,
    slug,
    refs as { [key: string]: { target: string; title: string } },
    opts
  )

  const arr = emitter(postProcessedAst, {
    inline: opts.forceInline,
    refs: refs,
  }) as (JSX.Element | string)[]

  // Extract footnotes from refs (keys starting with '^')
  const footnoteEntries: { identifier: string; footnote: string }[] = []
  for (const key in refs) {
    if (key.charCodeAt(0) === $.CHAR_CARET) {
      footnoteEntries.push({ identifier: key, footnote: refs[key].target })
    }
  }

  if (footnoteEntries.length) {
    arr.push(
      h(
        'footer',
        {},
        ...footnoteEntries.map(function createFootnote(def) {
          // We know identifier starts with '^' from the filter above
          const identifierWithoutCaret = def.identifier.slice(1)
          const footnoteAstNodes = parse.parseMarkdown(
            def.footnote,
            { inline: true, refs: refs },
            parseOptions
          )
          const footnoteContent = emitter(footnoteAstNodes, {
            inline: true,
            refs: refs,
          })
          return h(
            'div',
            {
              id: slug(identifierWithoutCaret, util.slugify),
            },
            identifierWithoutCaret + ': ',
            ...toArray(footnoteContent)
          )
        })
      )
    )
  }

  if (opts.wrapper === null) {
    return arr.length === 0
      ? null
      : ((arr.length === 1 ? arr[0] : arr) as JSX.Element | JSX.Element[])
  }

  const wrapper = opts.wrapper || (opts.forceInline ? 'span' : 'div')
  let jsx: JSX.Element | JSX.Element[]

  if (arr.length > 1 || opts.forceWrapper) {
    jsx = arr as JSX.Element[]
  } else if (arr.length === 1) {
    return arr[0] as JSX.Element
  } else {
    return null
  }

  return createElement(
    wrapper as HTag,
    { ...opts.wrapperProps } as HProps,
    jsx
  ) as JSX.Element
}

/**
 * Compile markdown string to SolidJS JSX elements
 * @lang zh 将 Markdown 字符串编译为 SolidJS JSX 元素
 * @lang hi Markdown स्ट्रिंग को SolidJS JSX एलिमेंट्स में कंपाइल करें
 *
 * @param markdown - Markdown string to compile
 * @lang zh @param markdown - 要编译的 Markdown 字符串
 * @lang hi @param markdown - कंपाइल करने के लिए Markdown स्ट्रिंग
 * @param options - SolidJS compiler options
 * @lang zh @param options - SolidJS 编译器选项
 * @lang hi @param options - SolidJS कंपाइलर विकल्प
 * @returns SolidJS JSX element(s)
 * @lang zh @returns SolidJS JSX 元素
 * @lang hi @returns SolidJS JSX एलिमेंट(s)
 */
export function compiler(
  markdown: string = '',
  options: SolidOptions = {}
): JSX.Element | JSX.Element[] | null {
  const opts = { ...(options || {}) }
  opts.overrides = opts.overrides || {}

  const slug = opts.slugify || util.slugify
  const sanitize = opts.sanitizer || util.sanitizer

  function compile(input: string): JSX.Element | JSX.Element[] | null {
    const inline =
      opts.forceInline ||
      (!opts.forceBlock && !util.SHOULD_RENDER_AS_BLOCK_R.test(input))
    const parseOptions: parse.ParseOptions = {
      slugify: i => slug(i, util.slugify),
      sanitizer: sanitize,
      tagfilter: opts.tagfilter !== false,
      disableAutoLink: opts.disableAutoLink,
      disableParsingRawHTML: opts.disableParsingRawHTML,
      enforceAtxHeadings: opts.enforceAtxHeadings,
      forceBlock: opts.forceBlock,
      forceInline: inline,
      preserveFrontmatter: opts.preserveFrontmatter,
    }

    // First pass: collect all reference definitions
    // This ensures refs are available during inline parsing, even when they appear after their usage
    if (!inline) {
      parse.collectReferenceDefinitions(input, refs, parseOptions)
    }

    // Inline trimEnd: trim trailing newlines and carriage returns
    let processedInput = input
    if (!inline) {
      let e = processedInput.length
      while (
        e > 0 &&
        (processedInput[e - 1] === '\n' || processedInput[e - 1] === '\r')
      )
        e--
      processedInput = processedInput.slice(0, e)
      processedInput = `${processedInput.replace(TRIM_STARTING_NEWLINES, '')}\n\n`
    }

    let astNodes = parse.parseMarkdown(
      inline ? input : processedInput,
      { inline: inline, refs: refs },
      parseOptions
    )

    return astToJSX(astNodes, {
      ...opts,
      forceInline: inline,
    } as SolidOptions)
  }

  if (process.env.NODE_ENV !== 'production') {
    if (typeof markdown !== 'string') {
      throw new Error(`markdown-to-jsx: the first argument must be
                             a string`)
    }

    if (Object.prototype.toString.call(opts.overrides) !== '[object Object]') {
      throw new Error(`markdown-to-jsx: options.overrides (second argument property) must be
                             undefined or an object literal with shape:
                             {
                                htmltagname: {
                                    component: string|SolidComponent(optional),
                                    props: object(optional)
                                }
                             }`)
    }
  }

  const refs: { [key: string]: { target: string; title: string | undefined } } =
    {}

  const jsx = compile(markdown)

  return jsx
}

/**
 * SolidJS context for sharing compiler options across Markdown components
 * @lang zh 用于在 Markdown 组件之间共享编译器选项的 SolidJS 上下文
 * @lang hi Markdown कंपोनेंट्स के बीच कंपाइलर विकल्प साझा करने के लिए SolidJS संदर्भ
 */
export const MarkdownContext: Context<SolidOptions | undefined> = createContext<
  SolidOptions | undefined
>(undefined)

// Module-level h function for components that use JSX
// This is used by the @jsx pragma for JSX in MarkdownProvider and Markdown components
function h(
  tag: string | Component<Record<string, unknown>>,
  props: Record<string, unknown>,
  ...children: (JSX.Element | string)[]
): JSX.Element {
  if (typeof document === 'undefined') {
    const childValue =
      children.length === 0
        ? undefined
        : children.length === 1
          ? children[0]
          : children
    const propsWithChildren =
      childValue === undefined ? props : { ...props, children: childValue }
    if (typeof tag === 'function') {
      return (tag as Component<Record<string, unknown>>)(
        propsWithChildren as Record<string, unknown>
      )
    }
    return {
      t: tag,
      p: propsWithChildren,
    } as unknown as JSX.Element
  }
  const elementFactory = solidH(
    tag as Component<Record<string, unknown>>,
    props,
    ...children
  )
  return typeof elementFactory === 'function'
    ? (elementFactory as () => JSX.Element)()
    : (elementFactory as JSX.Element)
}

/**
 * SolidJS context provider for sharing compiler options across Markdown components
 * @lang zh 用于在 Markdown 组件之间共享编译器选项的 SolidJS 上下文提供者
 * @lang hi Markdown कंपोनेंट्स के बीच कंपाइलर विकल्प साझा करने के लिए SolidJS संदर्भ प्रदाता
 *
 * @param options - Default compiler options to share
 * @lang zh @param options - 要共享的默认编译器选项
 * @lang hi @param options - साझा करने के लिए डिफ़ॉल्ट कंपाइलर विकल्प
 * @param children - SolidJS children
 * @lang zh @param children - SolidJS 子元素
 * @lang hi @param children - SolidJS चाइल्ड एलिमेंट्स
 */
export const MarkdownProvider: Component<{
  options?: SolidOptions
  children: JSX.Element
}> = props => {
  const providerProps = { value: props.options } as Record<string, unknown>
  return h(
    MarkdownContext.Provider as Component<Record<string, unknown>>,
    providerProps,
    props.children
  )
}

/**
 * A SolidJS component for easy markdown rendering. Feed the markdown content as a direct child
 * and the rest is taken care of automatically. Supports reactive content via signals/accessors.
 * @lang zh 用于轻松渲染 Markdown 的 SolidJS 组件。将 Markdown 内容作为直接子元素提供，其余部分会自动处理。支持通过信号/访问器实现响应式内容。
 * @lang hi आसान markdown रेंडरिंग के लिए एक SolidJS कंपोनेंट। markdown सामग्री को सीधे चाइल्ड के रूप में प्रदान करें और बाकी स्वचालित रूप से संभाला जाता है। signals/accessors के माध्यम से रिएक्टिव सामग्री का समर्थन करता है।
 *
 * @param children - Markdown string content or signal/accessor
 * @lang zh @param children - Markdown 字符串内容或信号/访问器
 * @lang hi @param children - Markdown स्ट्रिंग सामग्री या signal/accessor
 * @param options - Compiler options
 * @lang zh @param options - 编译器选项
 * @lang hi @param options - कंपाइलर विकल्प
 */
export const Markdown: Component<
  Omit<JSX.HTMLAttributes<HTMLElement>, 'children'> & {
    children?: string | Accessor<string> | null
    options?: SolidOptions
  }
> = props => {
  const contextOptions = useContext(MarkdownContext)
  const mergedOptions = createMemo(() => ({
    ...contextOptions,
    ...props.options,
  }))

  const content = createMemo(() => {
    const children =
      typeof props.children === 'function' ? props.children() : props.children
    return children === null || children === undefined ? '' : children
  })

  const ast = createMemo(() =>
    parser(
      content(),
      mergedOptions() as Partial<MarkdownToJSX.Options> &
        Pick<MarkdownToJSX.Options, 'slugify' | 'sanitizer'>
    )
  )
  const jsx = createMemo(() =>
    astToJSX(ast(), {
      ...mergedOptions(),
      wrapperProps: {
        ...mergedOptions()?.wrapperProps,
        ...Object.fromEntries(
          Object.entries(props).filter(
            ([key]) => key !== 'children' && key !== 'options'
          )
        ),
      } as JSX.HTMLAttributes<HTMLElement>,
    })
  )

  return jsx() as JSX.Element
}

export default Markdown
