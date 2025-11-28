import * as React from 'react'
import type {
  ViewStyle,
  TextStyle,
  ImageStyle,
  ViewProps,
  TextProps,
  StyleProp,
} from 'react-native'
import { Linking, Text, View, Image } from 'react-native'
import * as $ from './constants'
import * as parse from './parse'
import { MarkdownToJSX, RuleType } from './types'
import * as util from './utils'

export { parser } from './parse'

export { RuleType, type MarkdownToJSX } from './types'
export { sanitizer, slugify } from './utils'

const TRIM_STARTING_NEWLINES = /^\n+/

export type NativeStyleKey =
  | 'text'
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'heading4'
  | 'heading5'
  | 'heading6'
  | 'link'
  | 'image'
  | 'codeBlock'
  | 'codeInline'
  | 'blockquote'
  | 'listOrdered'
  | 'listUnordered'
  | 'listItem'
  | 'listItemBullet'
  | 'listItemNumber'
  | 'thematicBreak'
  | 'table'
  | 'tableHeader'
  | 'tableHeaderCell'
  | 'tableRow'
  | 'tableCell'
  | 'em'
  | 'strong'
  | 'del'
  | 'gfmTask'
  // HTML semantic elements
  | 'div'
  | 'section'
  | 'article'
  | 'aside'
  | 'header'
  | 'footer'
  | 'main'
  | 'nav'
  | 'figure'
  | 'figcaption'
  | 'ul'
  | 'ol'
  | 'li'
  | 'th'
  | 'td'

export type NativeOptions = Omit<MarkdownToJSX.Options, 'wrapperProps'> & {
  onLinkPress?: (url: string, title?: string) => void
  onLinkLongPress?: (url: string, title?: string) => void
  styles?: Partial<
    Record<NativeStyleKey, StyleProp<ViewStyle | TextStyle | ImageStyle>>
  >
  wrapperProps?: ViewProps | TextProps
}

function encodeUrlTarget(target: string): string {
  let needsEncoding = false
  for (let i = 0; i < target.length; i++) {
    const code = target.charCodeAt(i)
    if (code > 127 || code === $.CHAR_BACKSLASH || code === $.CHAR_BACKTICK) {
      needsEncoding = true
      break
    }
  }
  if (!needsEncoding) return target

  let result = ''
  for (let i = 0; i < target.length; i++) {
    const char = target[i]
    if (
      char === '%' &&
      i + 2 < target.length &&
      /[0-9A-Fa-f]/.test(target[i + 1]) &&
      /[0-9A-Fa-f]/.test(target[i + 2])
    ) {
      result += target[i] + target[i + 1] + target[i + 2]
      i += 2
    } else if (char.charCodeAt(0) === $.CHAR_BACKSLASH) {
      result += '%5C'
    } else if (char.charCodeAt(0) === $.CHAR_BACKTICK) {
      result += '%60'
    } else {
      const code = char.charCodeAt(0)
      result += code > 127 ? encodeURIComponent(char) : char
    }
  }
  return result
}

function render(
  node: MarkdownToJSX.ASTNode,
  output: MarkdownToJSX.ASTRender,
  state: MarkdownToJSX.State,
  h: (tag: any, props: any, ...children: any[]) => any,
  sanitize: (value: string, tag: string, attribute: string) => string | null,
  slug: (input: string, defaultFn: (input: string) => string) => string,
  refs: { [key: string]: { target: string; title: string | undefined } },
  options: NativeOptions
): React.ReactNode {
  const styles = options.styles || {}

  switch (node.type) {
    case RuleType.blockQuote: {
      const blockquoteNode = node as MarkdownToJSX.BlockQuoteNode
      return h(
        View,
        {
          key: state.key,
          style: styles.blockquote,
        },
        output(blockquoteNode.children, state)
      )
    }

    case RuleType.breakLine:
      return '\n'

    case RuleType.breakThematic:
      return h(View, {
        key: state.key,
        style: styles.thematicBreak,
      })

    case RuleType.frontmatter:
      if (options.preserveFrontmatter) {
        const frontmatterNode = node as MarkdownToJSX.FrontmatterNode
        return h(
          Text,
          { key: state.key, style: styles.codeBlock },
          frontmatterNode.text
        )
      }
      return null

    case RuleType.codeBlock: {
      const codeNode = node as MarkdownToJSX.CodeBlockNode
      return h(
        View,
        { key: state.key, style: styles.codeBlock },
        h(Text, { style: styles.codeInline }, codeNode.text)
      )
    }

    case RuleType.codeInline: {
      const codeNode = node as MarkdownToJSX.CodeInlineNode
      return h(
        Text,
        { key: state.key, style: styles.codeInline },
        codeNode.text
      )
    }

    case RuleType.footnoteReference: {
      const footnoteNode = node as MarkdownToJSX.FootnoteReferenceNode
      const href = sanitize(footnoteNode.target, 'a', 'href')
      if (!href) return null
      return h(
        Text,
        {
          key: state.key,
          onPress: () => {
            if (options.onLinkPress) {
              options.onLinkPress(href, footnoteNode.text)
            } else {
              Linking.openURL(href).catch(() => {})
            }
          },
          style: styles.link,
        },
        h(Text, { style: { fontWeight: 'bold' } }, footnoteNode.text)
      )
    }

    case RuleType.gfmTask: {
      const taskNode = node as MarkdownToJSX.GFMTaskNode
      return h(
        Text,
        { key: state.key, style: styles.gfmTask },
        taskNode.completed ? '[x]' : '[ ]'
      )
    }

    case RuleType.heading: {
      const headingNode = node as MarkdownToJSX.HeadingNode
      const headingStyleKey = `heading${headingNode.level}` as NativeStyleKey
      const headingStyle = styles[headingStyleKey]
      return h(
        Text,
        {
          key: state.key,
          style: headingStyle,
        },
        output(headingNode.children, state)
      )
    }

    case RuleType.htmlBlock: {
      const htmlNode = node as MarkdownToJSX.HTMLNode
      if (options.tagfilter && util.shouldFilterTag(htmlNode.tag)) {
        const tagText =
          'rawText' in htmlNode && typeof htmlNode.rawText === 'string'
            ? htmlNode.rawText
            : `<${htmlNode.tag}>`
        return h(Text, { key: state.key }, tagText)
      }

      if (htmlNode.text && htmlNode.noInnerParse) {
        const tagLower = (htmlNode.tag as string).toLowerCase()
        const isType1Block = parse.isType1Block(tagLower)

        if (isType1Block && !/<[a-z][^>]{0,100}>/i.test(htmlNode.text)) {
          let textContent = htmlNode.text.replace(
            new RegExp('\\s*</' + tagLower + '>\\s*$', 'i'),
            ''
          )
          if (options.tagfilter) {
            textContent = util.applyTagFilterToText(textContent)
          }
          return h(
            htmlNode.tag,
            { key: state.key, ...htmlNode.attrs },
            textContent
          )
        }

        if (/<\/?pre\b/i.test(htmlNode.text)) {
          const innerHtml = options.tagfilter
            ? util.applyTagFilterToText(htmlNode.text)
            : htmlNode.text
          return h(Text, { key: state.key, style: styles.codeBlock }, innerHtml)
        }

        const cleanedText = htmlNode.text
          .replace(/>\s+</g, '><')
          .replace(/\n+/g, ' ')
          .trim()
        const selfTagRegex = new RegExp(
          `^<${htmlNode.tag}(\\s[^>]*)?>(\\s*</${htmlNode.tag}>)?$`,
          'i'
        )
        if (selfTagRegex.test(cleanedText)) {
          return h(htmlNode.tag, { key: state.key, ...htmlNode.attrs })
        }

        const parseOptions: parse.ParseOptions = {
          slugify: (input: string) => slug(input, util.slugify),
          sanitizer: (value: string, tag: string, attribute: string) =>
            sanitize(value, tag as MarkdownToJSX.HTMLTags, attribute),
          tagfilter: true,
        }
        const astNodes = parse.parseMarkdown(
          cleanedText,
          { inline: false, refs: refs, inHTML: false },
          parseOptions
        )

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
          ) {
            return []
          }
          if (node.type === RuleType.paragraph) {
            return (
              (node as MarkdownToJSX.ParagraphNode).children?.flatMap(
                processNode
              ) || []
            )
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
          htmlNode.tag,
          { key: state.key, ...htmlNode.attrs },
          output(astNodes.flatMap(processNode), state)
        )
      }

      return h(
        htmlNode.tag,
        { key: state.key, ...htmlNode.attrs },
        htmlNode.children ? output(htmlNode.children, state) : ''
      )
    }

    case RuleType.htmlSelfClosing: {
      const htmlNode = node as MarkdownToJSX.HTMLSelfClosingNode
      if (options.tagfilter && util.shouldFilterTag(htmlNode.tag)) {
        const tagText =
          'rawText' in htmlNode && typeof htmlNode.rawText === 'string'
            ? htmlNode.rawText
            : `<${htmlNode.tag} />`
        return h(Text, { key: state.key }, tagText)
      }
      return h(htmlNode.tag, { key: state.key, ...htmlNode.attrs })
    }

    case RuleType.image: {
      const imageNode = node as MarkdownToJSX.ImageNode
      const src = sanitize(imageNode.target, 'img', 'src')
      if (!src) return null
      return h('img', {
        key: state.key,
        source: { uri: src },
        accessibilityLabel: imageNode.alt || undefined,
        style: styles.image,
      })
    }

    case RuleType.link: {
      const linkNode = node as MarkdownToJSX.LinkNode
      const defaultLinkStyle: TextStyle = { textDecorationLine: 'underline' }
      const linkStyle = styles.link
        ? [defaultLinkStyle, styles.link]
        : defaultLinkStyle

      const props: Record<string, unknown> = {
        key: state.key,
        style: linkStyle,
      }

      if (linkNode.target != null) {
        const url = encodeUrlTarget(linkNode.target)
        props.onPress = () => {
          options.onLinkPress
            ? options.onLinkPress(url, linkNode.title)
            : Linking.openURL(url).catch(() => {})
        }
        if (options.onLinkLongPress) {
          props.onLongPress = () =>
            options.onLinkLongPress!(url, linkNode.title)
        }
      }

      return h('a', props, output(linkNode.children, state))
    }

    case RuleType.table: {
      const tableNode = node as MarkdownToJSX.TableNode
      return h(
        View,
        { key: state.key, style: styles.table },
        h(
          View,
          { style: styles.tableHeader },
          h(
            View,
            { style: { flexDirection: 'row' } },
            tableNode.header.map(function generateHeaderCell(content, i) {
              return h(
                View,
                {
                  key: i,
                  style: [
                    styles.tableHeaderCell,
                    tableNode.align[i] != null
                      ? {
                          alignItems:
                            tableNode.align[i] === 'center'
                              ? 'center'
                              : tableNode.align[i] === 'right'
                                ? 'flex-end'
                                : 'flex-start',
                        }
                      : {},
                  ],
                },
                output(content, state)
              )
            })
          )
        ),
        h(
          View,
          {},
          tableNode.cells.map(function generateTableRow(row, i) {
            return h(
              View,
              { key: i, style: { flexDirection: 'row' } },
              row.map(function generateTableCell(content, c) {
                return h(
                  View,
                  {
                    key: c,
                    style: [
                      styles.tableCell,
                      tableNode.align[c] != null
                        ? {
                            alignItems:
                              tableNode.align[c] === 'center'
                                ? 'center'
                                : tableNode.align[c] === 'right'
                                  ? 'flex-end'
                                  : 'flex-start',
                          }
                        : {},
                    ],
                  },
                  output(content, state)
                )
              })
            )
          })
        )
      )
    }

    case RuleType.text: {
      const textNode = node as MarkdownToJSX.TextNode
      return textNode.text
    }

    case RuleType.textFormatted: {
      const formattedNode = node as MarkdownToJSX.FormattedTextNode
      const tagStyles: Record<string, TextStyle> = {
        em: { fontStyle: 'italic' },
        strong: { fontWeight: 'bold' },
        del: { textDecorationLine: 'line-through' },
      }
      const defaultStyle = tagStyles[formattedNode.tag]
      const style = styles[formattedNode.tag as NativeStyleKey] || defaultStyle
      return h(
        Text,
        { key: state.key, style },
        output(formattedNode.children, state)
      )
    }

    case RuleType.orderedList:
    case RuleType.unorderedList: {
      const listNode = node as
        | MarkdownToJSX.OrderedListNode
        | MarkdownToJSX.UnorderedListNode
      const isOrdered = node.type === RuleType.orderedList
      const listStyle = isOrdered ? styles.listOrdered : styles.listUnordered

      return h(
        View,
        { key: state.key, style: listStyle },
        listNode.items.map((item, i) => {
          const number =
            isOrdered && 'start' in listNode && listNode.start
              ? listNode.start + i
              : i + 1
          const bullet = isOrdered ? `${number}.` : '•'
          const bulletStyle = isOrdered
            ? styles.listItemNumber
            : styles.listItemBullet

          return h(
            View,
            { key: i, style: { flexDirection: 'row' } },
            h(Text, { style: bulletStyle }, bullet + ' '),
            h(View, { style: styles.listItem }, output(item, state))
          )
        })
      )
    }

    case RuleType.paragraph:
      return h(
        'p',
        { key: state.key, style: styles.paragraph },
        output((node as MarkdownToJSX.ParagraphNode).children, state)
      )

    case RuleType.ref:
      return null

    default:
      return null
  }
}

const createRenderer = (
  userRender: NativeOptions['renderRule'],
  h: (tag: any, props: any, ...children: any[]) => any,
  sanitize: (value: string, tag: string, attribute: string) => string | null,
  slug: (input: string, defaultFn: (input: string) => string) => string,
  refs: { [key: string]: { target: string; title: string | undefined } },
  options: NativeOptions
) => {
  const renderRule = (
    node: MarkdownToJSX.ASTNode,
    renderChildren: MarkdownToJSX.ASTRender,
    state: MarkdownToJSX.State
  ) => {
    const outputFn: MarkdownToJSX.ASTRender = (children, childState) => {
      const nodes = Array.isArray(children) ? children : [children]
      return renderChildren(nodes, childState || state)
    }
    const defaultRender = () =>
      render(node, outputFn, state, h, sanitize, slug, refs, options)
    return userRender
      ? userRender(defaultRender, node, renderChildren, state)
      : defaultRender()
  }
  const handleStackOverflow = (ast: MarkdownToJSX.ASTNode[]) =>
    ast.map(node => ('text' in node ? node.text : ''))
  const renderer: MarkdownToJSX.ASTRender = (
    ast: MarkdownToJSX.ASTNode | MarkdownToJSX.ASTNode[],
    state: MarkdownToJSX.State = {}
  ) => {
    const nodes = Array.isArray(ast) ? ast : [ast]
    const depth = (state.renderDepth || 0) + 1
    if (depth > 2500) return handleStackOverflow(nodes)
    state.renderDepth = depth

    const oldKey = state.key,
      result: React.ReactNode[] = []
    let lastWasString = false
    for (let i = 0; i < nodes.length; i++) {
      state.key = i
      const nodeOut = renderRule(nodes[i], renderer, state),
        isString = typeof nodeOut === 'string'
      if (isString && lastWasString) {
        result[result.length - 1] += nodeOut
      } else if (nodeOut !== null) {
        if (Array.isArray(nodeOut)) {
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
    return result.length === 1 ? result[0] : result
  }
  return renderer
}

const get = (source: any, path: string, fallback: any): any => {
  if (!source || typeof path !== 'string') return fallback
  const segments = path.split('.')
  let result = source
  for (let i = 0; i < segments.length; i++) {
    result = result?.[segments[i]]
    if (result === undefined) return fallback
  }
  return result || fallback
}

const getTag = (tag: string, overrides?: MarkdownToJSX.Overrides) => {
  if (!overrides || typeof tag !== 'string') return tag
  const override = get(overrides, tag, undefined)
  if (!override) return tag
  if (
    typeof override === 'function' ||
    (typeof override === 'object' && override !== null && 'render' in override)
  ) {
    return override
  }
  return get(overrides, `${tag}.component`, tag)
}

// Map HTML tags to React Native components
// React Native doesn't support arbitrary HTML tags, so we map them to Text or View
const mapHTMLTagToNativeComponent = (tag: string): React.ElementType => {
  const tagLower = tag.toLowerCase()

  // Media elements
  if (tagLower === 'img') {
    return Image
  }

  // Semantic block containers
  if (
    tagLower === 'div' ||
    tagLower === 'section' ||
    tagLower === 'article' ||
    tagLower === 'aside' ||
    tagLower === 'header' ||
    tagLower === 'footer' ||
    tagLower === 'main' ||
    tagLower === 'nav' ||
    tagLower === 'figure' ||
    tagLower === 'figcaption' ||
    tagLower === 'blockquote' ||
    tagLower === 'ul' ||
    tagLower === 'ol' ||
    tagLower === 'li' ||
    tagLower === 'table' ||
    tagLower === 'thead' ||
    tagLower === 'tbody' ||
    tagLower === 'tr' ||
    tagLower === 'th' ||
    tagLower === 'td'
  ) {
    return View
  }

  // Type 1 blocks (pre, script, style, textarea)
  if (parse.isType1Block(tagLower)) {
    return View
  }

  // Everything else (inline elements, text content, etc.)
  return Text
}

export function astToNative(
  ast: MarkdownToJSX.ASTNode[],
  options?: NativeOptions
): React.ReactNode {
  const opts: NativeOptions = options || {}
  opts.overrides = opts.overrides || {}

  const slug = opts.slugify || util.slugify
  const sanitize = opts.sanitizer || util.sanitizer
  const createElement = opts.createElement || React.createElement

  function h(
    tag: string,
    props: Record<string, any> & {
      style?: StyleProp<ViewStyle | TextStyle | ImageStyle>
    },
    ...children: any[]
  ) {
    if (typeof tag !== 'string') {
      return createElement(tag, props, ...children)
    }

    const overrideProps = get(opts.overrides || {}, `${tag}.props`, {})
    const Component = getTag(tag, opts.overrides || {})

    const finalProps = {
      ...props,
      ...overrideProps,
      style: props.style || overrideProps.style || undefined,
    }

    if (
      typeof Component === 'function' ||
      (typeof Component === 'object' && Component !== null)
    ) {
      return createElement(
        Component as React.ElementType,
        finalProps,
        ...children
      )
    }
    // Component is still a string (HTML tag name) - map it to React Native component
    const NativeComponent = mapHTMLTagToNativeComponent(Component)
    return createElement(NativeComponent, finalProps, ...children)
  }

  const parseOptions: parse.ParseOptions = {
    slugify: i => slug(i, util.slugify),
    sanitizer: (value: string, tag: string, attribute: string) =>
      sanitize(value, tag as MarkdownToJSX.HTMLTags, attribute),
    tagfilter: opts.tagfilter !== false,
    disableAutoLink: opts.disableAutoLink,
    disableParsingRawHTML: opts.disableParsingRawHTML,
    enforceAtxHeadings: opts.enforceAtxHeadings,
  }

  const refs =
    ast[0] && ast[0].type === RuleType.refCollection
      ? (ast[0] as MarkdownToJSX.ReferenceCollectionNode).refs
      : {}

  const emitter = createRenderer(
    opts.renderRule,
    h,
    (value: string, tag: string, attribute: string) =>
      sanitize(value, tag as MarkdownToJSX.HTMLTags, attribute),
    slug,
    refs,
    opts
  )

  const emitted = emitter(ast, {
    inline: opts.forceInline,
    refs: refs as { [key: string]: { target: string; title: string } },
  })
  const arr: React.ReactNode[] = Array.isArray(emitted) ? emitted : [emitted]

  const footnoteEntries: { identifier: string; footnote: string }[] = []
  for (const key in refs) {
    if (key.charCodeAt(0) === $.CHAR_CARET) {
      footnoteEntries.push({ identifier: key, footnote: refs[key].target })
    }
  }

  if (footnoteEntries.length) {
    arr.push(
      createElement(
        View,
        { key: 'footer' },
        footnoteEntries.map(function createFootnote(def) {
          const identifierWithoutCaret =
            def.identifier.charCodeAt(0) === $.CHAR_CARET
              ? def.identifier.slice(1)
              : def.identifier
          const footnoteAstNodes = parse.parseMarkdown(
            def.footnote,
            { inline: true, refs: refs },
            parseOptions
          )
          const footnoteContent = emitter(footnoteAstNodes, {
            inline: true,
            refs: refs,
          })
          return createElement(
            View,
            {
              key: def.identifier,
            },
            createElement(Text, {}, identifierWithoutCaret + ': '),
            footnoteContent
          )
        })
      )
    )
  }

  if (opts.wrapper === null) {
    return arr
  }

  const wrapper = opts.wrapper || (opts.forceInline ? Text : View)
  let jsx: React.ReactNode

  if (arr.length > 1 || opts.forceWrapper) {
    jsx = arr
  } else if (arr.length === 1) {
    const single = arr[0]
    // In React Native, raw strings must be wrapped in Text
    if (typeof single === 'string') {
      return createElement(Text, { key: 'outer', ...opts.wrapperProps }, single)
    }
    return single
  } else {
    return null
  }

  return createElement(
    wrapper,
    { key: 'outer', ...opts.wrapperProps },
    jsx
  ) as React.ReactNode
}

export function compiler(
  markdown: string = '',
  options: NativeOptions = {}
): React.ReactNode {
  options.overrides = options.overrides || {}

  const slug = options.slugify || util.slugify
  const sanitize = options.sanitizer || util.sanitizer

  function compile(input: string): React.ReactNode {
    const inline =
      options.forceInline ||
      (!options.forceBlock && !util.SHOULD_RENDER_AS_BLOCK_R.test(input))
    const parseOptions: parse.ParseOptions = {
      slugify: i => slug(i, util.slugify),
      sanitizer: (value: string, tag: string, attribute: string) =>
        sanitize(value, tag as MarkdownToJSX.HTMLTags, attribute),
      tagfilter: options.tagfilter !== false,
      disableAutoLink: options.disableAutoLink,
      disableParsingRawHTML: options.disableParsingRawHTML,
      enforceAtxHeadings: options.enforceAtxHeadings,
    }

    if (!inline) {
      parse.collectReferenceDefinitions(input, refs, parseOptions)
    }

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

    return astToNative(astNodes, {
      ...options,
      forceInline: inline,
    })
  }

  if (process.env.NODE_ENV !== 'production') {
    if (typeof markdown !== 'string') {
      throw new Error(`markdown-to-jsx: the first argument must be a string`)
    }

    if (
      Object.prototype.toString.call(options.overrides) !== '[object Object]'
    ) {
      throw new Error(`markdown-to-jsx: options.overrides (second argument property) must be
                             undefined or an object literal with shape:
                             {
                                htmltagname: {
                                    component: string|ReactComponent(optional),
                                    props: object(optional)
                                }
                             }`)
    }
  }

  const refs: {
    [key: string]: { target: string; title: string | undefined }
  } = {}

  const jsx = compile(markdown)

  return jsx
}

export const Markdown: React.FC<
  Omit<ViewProps, 'children'> & {
    children?: string | null
    options?: NativeOptions
  }
> = ({ children: rawChildren, options, ...props }) => {
  const children =
    rawChildren === null || rawChildren === undefined ? '' : rawChildren

  return compiler(children, {
    ...options,
    wrapperProps: {
      ...options?.wrapperProps,
      ...props,
    } as ViewProps | TextProps,
  })
}

export default Markdown
