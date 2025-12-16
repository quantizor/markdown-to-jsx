/** @jsxRuntime classic */
/** @jsx h */

import {
  h,
  type VNode,
  type Component,
  provide,
  inject,
  computed,
  type InjectionKey,
} from 'vue'
import * as $ from './constants'
import * as parse from './parse'
import { MarkdownToJSX, RuleType, RequireAtLeastOne } from './types'
import * as util from './utils'

export { parser } from './parse'
import { parser } from './parse'

export { RuleType, type MarkdownToJSX } from './types'
export { sanitizer, slugify } from './utils'

const TRIM_STARTING_NEWLINES = /^\n+/

export const MarkdownOptionsKey: InjectionKey<VueOptions> = Symbol(
  'markdown-options'
)

// Shared type for Vue child elements
type VueChild = VNode | string

// Vue sanitizer type (uses string instead of React's HTMLTags)
type VueSanitizer = (
  value: string,
  tag: string,
  attribute: string
) => string | null

/**
 * Convert HTML attributes to Vue props
 * Vue uses HTML standard attributes (class, not className), so minimal mapping needed
 * Only 'for' -> 'htmlFor' needs mapping
 */
export function htmlAttrsToVueProps(
  attrs: Record<string, any>
): Record<string, any> {
  var vueProps: Record<string, any> = {}
  for (var key in attrs) {
    var keyLower = key.toLowerCase()
    vueProps[keyLower === 'for' ? 'htmlFor' : key] = attrs[key]
  }
  return vueProps
}

// Helper function for URL encoding backslashes and backticks per CommonMark spec
function encodeUrlTarget(target: string): string {
  // Fast path: check if encoding is needed
  let needsEncoding = false
  for (let i = 0; i < target.length; i++) {
    const code = target.charCodeAt(i)
    if (
      code >= $.CHAR_ASCII_BOUNDARY ||
      code === $.CHAR_BACKSLASH ||
      code === $.CHAR_BACKTICK
    ) {
      needsEncoding = true
      break
    }
  }
  if (!needsEncoding) return target

  // Encode character by character, preserving existing percent-encoded sequences
  let result = ''
  for (let i = 0; i < target.length; i++) {
    const code = target.charCodeAt(i)
    const c1 = i + 1 < target.length ? target.charCodeAt(i + 1) : 0
    const c2 = i + 2 < target.length ? target.charCodeAt(i + 2) : 0
    if (
      code === $.CHAR_PERCENT &&
      i + 2 < target.length &&
      ((c1 >= $.CHAR_DIGIT_0 && c1 <= $.CHAR_DIGIT_9) ||
        (c1 >= $.CHAR_A && c1 <= $.CHAR_F) ||
        (c1 >= $.CHAR_a && c1 <= $.CHAR_f)) &&
      ((c2 >= $.CHAR_DIGIT_0 && c2 <= $.CHAR_DIGIT_9) ||
        (c2 >= $.CHAR_A && c2 <= $.CHAR_F) ||
        (c2 >= $.CHAR_a && c2 <= $.CHAR_f))
    ) {
      result += target[i] + target[i + 1] + target[i + 2]
      i += 2
    } else if (code === $.CHAR_BACKSLASH) {
      result += '%5C'
    } else if (code === $.CHAR_BACKTICK) {
      result += '%60'
    } else {
      result +=
        code >= $.CHAR_ASCII_BOUNDARY
          ? encodeURIComponent(target[i])
          : target[i]
    }
  }
  return result
}

type VueASTRender = (
  ast: MarkdownToJSX.ASTNode | MarkdownToJSX.ASTNode[],
  state: MarkdownToJSX.State
) => VueChild[] | VueChild | null

// Format HTML attributes for filtered tags
function formatFilteredTagAttrs(
  attrs: Record<string, unknown> | undefined
): string {
  if (!attrs) return ''
  const parts: string[] = []
  for (const key in attrs) {
    const value = attrs[key]
    if (value === true) parts.push(` ${key}`)
    else if (value !== undefined && value !== null && value !== false)
      parts.push(` ${key}="${String(value)}"`)
  }
  return parts.length ? parts.join('') : ''
}

// Helper to normalize children output to array format (only for null handling)
// Inlined in hot paths for performance
const normalizeChildren = (output: VueChild[] | VueChild | null): VueChild[] =>
  Array.isArray(output) ? output : output !== null ? [output] : []

// Render functions for each node type
const renderers: Record<
  number,
  (node: any, ctx: RenderContext) => VueChild | null
> = {
  [RuleType.blockQuote]: (node, { h, output, state, slug }) => {
    const props = {} as Record<string, unknown>
    let children = node.children
    if (node.alert) {
      props.class =
        'markdown-alert-' + slug(node.alert.toLowerCase(), util.slugify)
      const headerNode: MarkdownToJSX.HTMLNode = {
        attrs: {},
        children: [{ type: RuleType.text, text: node.alert }],
        noInnerParse: true,
        type: RuleType.htmlBlock,
        tag: 'header',
      }
      children = [headerNode, ...children]
    }
    return h(
      'blockquote',
      { key: state.key, ...props },
      ...normalizeChildren(output(children, state))
    )
  },

  [RuleType.breakLine]: (_, { h, state }) => h('br', { key: state.key }),

  [RuleType.breakThematic]: (_, { h, state }) => h('hr', { key: state.key }),

  [RuleType.frontmatter]: (node, { h, state, options }) =>
    options.preserveFrontmatter
      ? h('pre', { key: state.key }, node.text)
      : null,

  [RuleType.codeBlock]: (node, { h, state }) => {
    const decodedLang = node.lang ? util.decodeEntityReferences(node.lang) : ''
    const codeProps = {
      ...htmlAttrsToVueProps((node.attrs || {}) as Record<string, unknown>),
      class: decodedLang ? `language-${decodedLang} lang-${decodedLang}` : '',
    } as Record<string, unknown>
    return h('pre', { key: state.key }, h('code', codeProps, node.text))
  },

  [RuleType.codeInline]: (node, { h, state }) =>
    h('code', { key: state.key }, node.text),

  [RuleType.footnoteReference]: (node, { h, state, sanitize }) =>
    h(
      'a',
      { key: state.key, href: sanitize(node.target, 'a', 'href') },
      h('sup', {}, node.text)
    ),

  [RuleType.gfmTask]: (node, { h, state }) =>
    h('input', {
      key: state.key,
      checked: node.completed,
      readOnly: true,
      type: 'checkbox',
    }),

  [RuleType.heading]: (node, { h, output, state }) =>
    h(
      `h${node.level}`,
      { id: node.id, key: state.key },
      ...normalizeChildren(output(node.children, state))
    ),

  [RuleType.htmlBlock]: (node: MarkdownToJSX.HTMLNode, ctx) => {
    const { h, state, options, output, sanitize, slug, refs } = ctx

    if (options.tagfilter && util.shouldFilterTag(node.tag)) {
      const tagText =
        'rawText' in node && typeof node.rawText === 'string'
          ? node.rawText
          : `<${node.tag}${formatFilteredTagAttrs(node.attrs)}>`
      return h('span', { key: state.key }, tagText)
    }

    if (node.text && node.noInnerParse) {
      const tagLower = (node.tag as string).toLowerCase()
      const isType1Block = parse.isType1Block(tagLower)
      const containsHTMLTags = /<[a-z][^>]{0,100}>/i.test(node.text)
      const containsPreTags = /<\/?pre\b/i.test(node.text)

      if (isType1Block && !containsHTMLTags) {
        let textContent = node.text.replace(
          new RegExp('\\s*</' + tagLower + '>\\s*$', 'i'),
          ''
        )
        if (options.tagfilter)
          textContent = util.applyTagFilterToText(textContent)
        return h(node.tag, { key: state.key, ...node.attrs }, textContent)
      }

      if (containsPreTags) {
        const innerHtml = options.tagfilter
          ? util.applyTagFilterToText(node.text)
          : node.text
        return h(node.tag, {
          key: state.key,
          ...node.attrs,
          innerHTML: innerHtml,
        })
      }

      const parseOptions: parse.ParseOptions = {
        slugify: (input: string) => slug(input, util.slugify),
        sanitizer: sanitize,
        tagfilter: true,
      }
      const cleanedText = node.text
        .replace(/>\s+</g, '><')
        .replace(/\n+/g, ' ')
        .trim()

      const selfTagRegex = new RegExp(
        `^<${node.tag}(\\s[^>]*)?>(\\s*</${node.tag}>)?$`,
        'i'
      )
      if (selfTagRegex.test(cleanedText)) {
        return h(node.tag, { key: state.key, ...node.attrs })
      }

      const astNodes = parse.parseMarkdown(
        cleanedText,
        { inline: false, refs: refs, inHTML: false },
        parseOptions
      )

      const processNode = (
        node: MarkdownToJSX.ASTNode
      ): MarkdownToJSX.ASTNode[] => {
        if (
          node.type === RuleType.htmlSelfClosing &&
          'isClosingTag' in node &&
          (node as any).isClosingTag
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

      return h(
        node.tag,
        { key: state.key, ...node.attrs },
        ...normalizeChildren(output(astNodes.flatMap(processNode), state))
      )
    }

    return h(
      node.tag,
      { key: state.key, ...node.attrs },
      ...normalizeChildren(node.children ? output(node.children, state) : null)
    )
  },

  [RuleType.htmlSelfClosing]: (
    node: MarkdownToJSX.HTMLSelfClosingNode,
    { h, state, options }
  ) => {
    if (options.tagfilter && util.shouldFilterTag(node.tag)) {
      const tagText =
        'rawText' in node && typeof node.rawText === 'string'
          ? node.rawText
          : `<${node.tag}${formatFilteredTagAttrs(node.attrs)} />`
      return h('span', { key: state.key }, tagText)
    }
    return h(node.tag, { key: state.key, ...node.attrs })
  },

  [RuleType.image]: (node, { h, state, sanitize }) =>
    h('img', {
      key: state.key,
      alt: node.alt?.length > 0 ? node.alt : undefined,
      title: node.title || undefined,
      src: sanitize(node.target, 'img', 'src'),
    } as Record<string, unknown>),

  [RuleType.link]: (node, { h, output, state }) => {
    const props: Record<string, unknown> = { key: state.key }
    if (node.target != null) props.href = encodeUrlTarget(node.target)
    if (node.title) props.title = node.title
    return h('a', props, ...normalizeChildren(output(node.children, state)))
  },

  [RuleType.table]: (node: MarkdownToJSX.TableNode, { h, output, state }) => {
    const headerCells = node.header.map((content, i) =>
      h(
        'th',
        {
          key: i,
          style: node.align[i] == null ? {} : { textAlign: node.align[i] },
        },
        ...normalizeChildren(output(content, state))
      )
    )

    const rows = node.cells.map((row, i) =>
      h(
        'tr',
        { key: i },
        ...row.map((content, c) =>
          h(
            'td',
            {
              key: c,
              style: node.align[c] == null ? {} : { textAlign: node.align[c] },
            },
            ...normalizeChildren(output(content, state))
          )
        )
      )
    )

    return h(
      'table',
      { key: state.key },
      h('thead', {}, h('tr', {}, ...headerCells)),
      h('tbody', {}, ...rows)
    )
  },

  [RuleType.text]: node => node.text,

  [RuleType.textFormatted]: (node, { h, output, state }) =>
    h(
      node.tag as string,
      { key: state.key },
      ...normalizeChildren(output(node.children, state))
    ),

  [RuleType.orderedList]: (node, { h, output, state }) => {
    const items = node.items.map((item, i) =>
      h('li', { key: i }, ...normalizeChildren(output(item, state)))
    )
    const props: Record<string, unknown> = {
      key: state.key,
      start: node.start,
    }
    return h('ol', props, ...items)
  },

  [RuleType.unorderedList]: (node, { h, output, state }) => {
    const items = node.items.map((item, i) =>
      h('li', { key: i }, ...normalizeChildren(output(item, state)))
    )
    return h('ul', { key: state.key }, ...items)
  },

  [RuleType.paragraph]: (node, { h, output, state }) =>
    h(
      'p',
      { key: state.key },
      ...normalizeChildren(output(node.children, state))
    ),

  [RuleType.ref]: () => null, // Reference definitions should not be rendered
}

type RenderContext = {
  h: (
    tag: string | Component,
    props?: Record<string, unknown> & {
      class?: string
      id?: string
      key?: string | number
    },
    ...children: VueChild[]
  ) => VNode
  output: VueASTRender
  state: MarkdownToJSX.State
  sanitize: VueSanitizer
  slug: (input: string, defaultFn: (input: string) => string) => string
  refs: { [key: string]: { target: string; title: string | undefined } }
  options: VueOptions
}

function render(
  node: MarkdownToJSX.ASTNode,
  output: VueASTRender,
  state: MarkdownToJSX.State,
  h: (
    tag: string | Component,
    props?: Record<string, unknown> & {
      class?: string
      id?: string
      key?: string | number
    },
    ...children: VueChild[]
  ) => VNode,
  sanitize: VueSanitizer,
  slug: (input: string, defaultFn: (input: string) => string) => string,
  refs: { [key: string]: { target: string; title: string | undefined } },
  options: VueOptions
): VueChild | null {
  const renderer = renderers[node.type]
  return renderer
    ? renderer(node, { h, output, state, sanitize, slug, refs, options })
    : null
}

const createRenderer = (
  userRender: VueOptions['renderRule'],
  h: (
    tag: string | Component,
    props?: Record<string, unknown> & {
      class?: string
      id?: string
      key?: string | number
    },
    ...children: VueChild[]
  ) => VNode,
  sanitize: VueSanitizer,
  slug: (input: string, defaultFn: (input: string) => string) => string,
  refs: { [key: string]: { target: string; title: string | undefined } },
  options: VueOptions
) => {
  const renderRule = (
    node: MarkdownToJSX.ASTNode,
    renderChildren: (
      children: MarkdownToJSX.ASTNode[]
    ) => (VNode | string)[] | VNode,
    state: MarkdownToJSX.State
  ) => {
    const defaultRender = () =>
      render(
        node,
        ast => renderChildren(Array.isArray(ast) ? ast : [ast]),
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
    ast.map(node => ('text' in node ? node.text : '')) as VueChild[]
  const renderer = (
    ast: MarkdownToJSX.ASTNode[],
    state: MarkdownToJSX.State = {}
  ) => {
    const depth = (state.renderDepth || 0) + 1
    if (depth > 2500) return handleStackOverflow(ast)
    state.renderDepth = depth

    const oldKey = state.key,
      result: VueChild[] = []
    let lastWasString = false
    for (let i = 0; i < ast.length; i++) {
      state.key = i
      const nodeOut = renderRule(ast[i], renderer, state),
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
    state.key = oldKey
    state.renderDepth = depth - 1
    return result
  }
  return renderer
}

const getTag = (
  tag: string | Component,
  overrides: VueOverrides | undefined
): string | Component => {
  if (typeof tag === 'function') return tag
  if (!overrides) return tag
  const tagStr = tag as string
  const override = util.get(overrides, tagStr, undefined)
  if (!override) return tag
  if (typeof override === 'function') return override
  if (
    typeof override === 'object' &&
    override !== null &&
    ('render' in override || 'setup' in override)
  )
    return override
  const component = util.get(overrides, `${tagStr}.component`, tagStr)
  if (typeof component === 'function') return component
  if (
    typeof component === 'object' &&
    component !== null &&
    ('render' in component || 'setup' in component)
  )
    return component
  return component as string
}

export type VueOverride =
  | RequireAtLeastOne<{
      component: string | Component
      props: Record<string, unknown>
    }>
  | string
  | Component

export type VueOverrides = {
  [tag: string]: VueOverride
}

export type VueOptions = Omit<
  MarkdownToJSX.Options,
  'createElement' | 'wrapperProps' | 'renderRule' | 'overrides'
> & {
  createElement?: typeof h
  wrapperProps?: Record<string, unknown>
  renderRule?: (
    next: () => VueChild | null,
    node: MarkdownToJSX.ASTNode,
    renderChildren: (children: MarkdownToJSX.ASTNode[]) => VueChild[] | VNode,
    state: MarkdownToJSX.State
  ) => VueChild | null
  overrides?: VueOverrides
}

// Extract text from AST nodes recursively
function extractText(nodes: MarkdownToJSX.ASTNode[]): string {
  const parts: string[] = []
  for (const n of nodes) {
    const type = n.type
    if (type === RuleType.text) {
      parts.push((n as MarkdownToJSX.TextNode).text)
    } else if (type === RuleType.htmlSelfClosing && n.rawText) {
      parts.push(n.rawText)
    } else if (type === RuleType.textFormatted) {
      const formattedNode = n as MarkdownToJSX.FormattedTextNode
      const marker =
        formattedNode.tag === 'em'
          ? '_'
          : formattedNode.tag === 'strong'
            ? '**'
            : ''
      parts.push(marker + extractText(formattedNode.children) + marker)
    } else if ('children' in n && n.children) {
      parts.push(extractText(n.children))
    }
  }
  return parts.join('')
}

// Post-process AST for JSX compatibility: combine HTML blocks with following paragraphs
function postProcessAst(ast: MarkdownToJSX.ASTNode[]): MarkdownToJSX.ASTNode[] {
  // Fast path: check if processing is needed (simple string check, avoid regex)
  let needsProcessing = false
  for (let i = 0; i < ast.length - 1; i++) {
    if (
      ast[i].type === RuleType.htmlBlock &&
      ast[i + 1].type === RuleType.paragraph &&
      'removedClosingTags' in ast[i + 1] &&
      (ast[i + 1] as any).removedClosingTags &&
      'text' in ast[i]
    ) {
      const text = (ast[i] as MarkdownToJSX.HTMLNode).text
      if (
        text &&
        (text.indexOf('<pre') !== -1 || text.indexOf('</pre') !== -1)
      ) {
        needsProcessing = true
        break
      }
    }
  }
  if (!needsProcessing) return ast

  const postProcessedAst: MarkdownToJSX.ASTNode[] = []
  for (let i = 0; i < ast.length; i++) {
    const node = ast[i]
    if (
      node.type === RuleType.htmlBlock &&
      'text' in node &&
      node.text &&
      /<\/?pre\b/i.test(node.text) &&
      i + 1 < ast.length &&
      ast[i + 1].type === RuleType.paragraph &&
      'removedClosingTags' in ast[i + 1] &&
      (ast[i + 1] as any).removedClosingTags
    ) {
      const htmlNode = node as MarkdownToJSX.HTMLNode
      const paragraphNode = ast[i + 1] as MarkdownToJSX.ParagraphNode & {
        removedClosingTags?: MarkdownToJSX.ASTNode[]
      }
      let combinedText = extractText(paragraphNode.children)
      if (paragraphNode.removedClosingTags) {
        const closingTagEnd = `</${htmlNode.tag}>`
        const closingTagText: string[] = []
        for (const tag of paragraphNode.removedClosingTags) {
          if (tag.type === RuleType.htmlSelfClosing && tag.rawText) {
            if (tag.rawText.indexOf(closingTagEnd) === -1)
              closingTagText.push(tag.rawText)
          }
        }
        combinedText += closingTagText.join('')
      }
      postProcessedAst.push({
        ...htmlNode,
        text: htmlNode.text + '\n' + combinedText,
      })
      i++
    } else {
      postProcessedAst.push(node)
    }
  }
  return postProcessedAst
}

export function astToJSX(
  ast: MarkdownToJSX.ASTNode[],
  options?: VueOptions
): VNode | VNode[] | null {
  const opts = { ...(options || {}) }
  opts.overrides = opts.overrides || {}

  const slug = opts.slugify || util.slugify
  const sanitize = opts.sanitizer || util.sanitizer

  // Recursive compile function for HTML content
  const compileHTML = (input: string) =>
    compiler(input, { ...opts, wrapper: null })

  // JSX helper function - this is what @jsx pragma uses
  function hHelper(
    tag: string | Component,
    props?: Record<string, unknown> & {
      class?: string
      id?: string
      innerHTML?: string
    },
    ...children: VueChild[]
  ): VNode {
    const tagKey = typeof tag === 'string' ? tag : ''
    const hasOverrides =
      opts.overrides && Object.keys(opts.overrides).length > 0
    const overrideProps = hasOverrides
      ? (util.get(opts.overrides, `${tagKey}.props`, {}) as Record<
          string,
          unknown
        >)
      : null
    const vueProps = props
      ? (htmlAttrsToVueProps(props) as Record<string, unknown>)
      : null

    // Convert HTML content in props (early exit for non-HTML)
    if (vueProps) {
      for (const key in vueProps) {
        const value = vueProps[key]
        if (
          typeof value === 'string' &&
          value.length > 0 &&
          value[0] === '<' &&
          (parse.HTML_BLOCK_ELEMENT_START_R_ATTR.test(value) ||
            parse.UPPERCASE_TAG_R.test(value) ||
            parse.parseHTMLTag(value, 0))
        ) {
          vueProps[key] = compileHTML(value.trim())
        }
      }
    }

    const finalTag = hasOverrides ? getTag(tag, opts.overrides) : tag
    const vueClass = vueProps?.class as string
    const overrideClass = overrideProps?.class as string
    const mergedClass =
      vueClass && overrideClass
        ? `${vueClass} ${overrideClass}`
        : vueClass || overrideClass || undefined

    if (!hasOverrides && !mergedClass && !vueProps?.innerHTML) {
      return h(finalTag, vueProps || {}, ...children)
    }

    const finalProps: Record<string, unknown> = vueProps ? { ...vueProps } : {}
    if (overrideProps) {
      for (const key in overrideProps) {
        finalProps[key] = overrideProps[key]
      }
    }
    if (mergedClass) finalProps.class = mergedClass
    if (vueProps?.innerHTML && overrideProps?.innerHTML === undefined) {
      finalProps.innerHTML = vueProps.innerHTML
    }

    return h(finalTag, finalProps, ...children)
  }

  const createElement =
    opts.createElement ||
    ((
      tag: string | Component,
      props: Record<string, unknown>,
      ...children: VueChild[]
    ): VNode => h(tag, props || {}, ...children))

  const postProcessedAst = postProcessAst(ast)

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
    hHelper,
    sanitize,
    slug,
    refs,
    opts
  )
  const arr = emitter(postProcessedAst, { inline: opts.forceInline, refs }) as (
    | VNode
    | string
  )[]

  // Process footnotes
  const footnoteEntries: { identifier: string; footnote: string }[] = []
  for (const key in refs) {
    if (key.charCodeAt(0) === $.CHAR_CARET) {
      footnoteEntries.push({ identifier: key, footnote: refs[key].target })
    }
  }

  if (footnoteEntries.length) {
    const footnoteNodes = footnoteEntries.map(def => {
      const identifierWithoutCaret = def.identifier.slice(1)
      const footnoteAstNodes = parse.parseMarkdown(
        def.footnote,
        { inline: true, refs },
        parseOptions
      )
      const footnoteContent = emitter(footnoteAstNodes, { inline: true, refs })
      const contentArray = normalizeChildren(footnoteContent)
      return hHelper(
        'div',
        { id: slug(identifierWithoutCaret, util.slugify) },
        identifierWithoutCaret + ': ',
        ...contentArray
      )
    })
    arr.push(hHelper('footer', { key: 'footer' }, ...footnoteNodes))
  }

  if (opts.wrapper === null) {
    return arr.length === 0
      ? null
      : ((arr.length === 1 ? arr[0] : arr) as VNode | VNode[])
  }

  const wrapper = opts.wrapper || (opts.forceInline ? 'span' : 'div')
  if (arr.length > 1 || opts.forceWrapper) {
    return createElement(
      wrapper as string | Component,
      { ...opts.wrapperProps } as Record<string, unknown>,
      ...arr
    )
  } else if (arr.length === 1) {
    return arr[0] as VNode
  }
  return null
}

export function compiler(
  markdown: string = '',
  options: VueOptions = {}
): VNode | VNode[] | null {
  const opts = { ...(options || {}) }
  opts.overrides = opts.overrides || {}

  if (process.env.NODE_ENV !== 'production') {
    if (typeof markdown !== 'string') {
      throw new Error(`markdown-to-jsx: the first argument must be a string`)
    }
    if (Object.prototype.toString.call(opts.overrides) !== '[object Object]') {
      throw new Error(`markdown-to-jsx: options.overrides (second argument property) must be
                             undefined or an object literal with shape:
                             {
                                htmltagname: {
                                    component: string|VueComponent(optional),
                                    props: object(optional)
                                }
                             }`)
    }
  }

  const slug = opts.slugify || util.slugify
  const sanitize = opts.sanitizer || util.sanitizer

  const inline =
    opts.forceInline ||
    (!opts.forceBlock && !util.SHOULD_RENDER_AS_BLOCK_R.test(markdown))
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

  const refs: { [key: string]: { target: string; title: string | undefined } } =
    {}

  // First pass: collect all reference definitions
  if (!inline) {
    parse.collectReferenceDefinitions(markdown, refs, parseOptions)
  }

  // Inline trimEnd: trim trailing newlines and carriage returns
  let processedInput = markdown
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

  const astNodes = parse.parseMarkdown(
    inline ? markdown : processedInput,
    { inline, refs },
    parseOptions
  )

  return astToJSX(astNodes, { ...opts, forceInline: inline } as VueOptions)
}

export const MarkdownProvider: Component<{
  options?: VueOptions
  children?: unknown
}> = props => {
  provide(MarkdownOptionsKey, props.options)
  return props.children as VNode
}

/**
 * A Vue component for easy markdown rendering. Feed the markdown content as a direct child
 * and the rest is taken care of automatically. Supports computed memoization for optimal performance.
 */
export const Markdown: Component<{
  children?: string | null
  options?: VueOptions
  [key: string]: unknown
}> = props => {
  const contextOptions = inject(MarkdownOptionsKey, undefined)

  const mergedOptions = computed(() => {
    var merged = Object.assign({}, contextOptions, props.options)
    merged.overrides = Object.assign(
      {},
      contextOptions?.overrides,
      props.options?.overrides
    )
    return merged
  })

  const content =
    props.children === null || props.children === undefined
      ? ''
      : props.children

  const { options: _, children: __, ...restProps } = props

  const jsx = computed(() =>
    compiler(content, {
      ...mergedOptions.value,
      wrapperProps: {
        ...mergedOptions.value?.wrapperProps,
        ...restProps,
      },
    })
  )

  return jsx.value as VNode
}

export default Markdown
