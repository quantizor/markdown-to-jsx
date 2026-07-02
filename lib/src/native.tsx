import * as React from 'react'
import type {
  ImageStyle,
  StyleProp,
  TextProps,
  TextStyle,
  ViewProps,
  ViewStyle,
} from 'react-native'
import { Image, Linking, Text, View } from 'react-native'
import * as $ from './constants'
import * as parse from './parse'
import { MarkdownToJSX, RuleType } from './types'
import * as util from './utils'

export { parser } from './parse'

export { RuleType, type MarkdownToJSX } from './types'
export { sanitizer, slugify } from './utils'

const LIST_ITEM_ROW_STYLE: ViewStyle = { flexDirection: 'row' }
const GFM_TASK_ITEM_ROW_STYLE: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
}
const LINK_DEFAULT_STYLE: TextStyle = { textDecorationLine: 'underline' }
const TEXT_FORMAT_STYLES: Record<string, TextStyle> = {
  em: { fontStyle: 'italic' },
  strong: { fontWeight: 'bold' },
  del: { textDecorationLine: 'line-through' },
}

// Merge a default style with a user-supplied one. RN accepts a style array, so
// we return [default, user] when both exist; otherwise return whichever is set.
const mergeStyle = <T,>(d: T | undefined, u: T | undefined): T | T[] | undefined =>
  u ? (d ? [d, u] : u) : d

// Tight list items render their inline content straight from `output()`,
// which returns bare strings for plain-text runs (no intervening paragraph
// wrapper the way loose items get). React Native throws "Text strings must
// be rendered within a <Text> component" if such a string ends up as a
// direct child of a View, so wrap any top-level string children in Text
// before handing them to the list item's View wrapper.
const wrapLooseStringsInText = (content: React.ReactNode): React.ReactNode => {
  if (typeof content === 'string') {
    return content ? React.createElement(Text, { key: 'text' }, content) : null
  }
  if (Array.isArray(content)) {
    return content.map((child, i) =>
      typeof child === 'string'
        ? child
          ? React.createElement(Text, { key: `text-${i}` }, child)
          : null
        : child
    )
  }
  return content
}

/**
 * React context for sharing compiler options across Markdown components in React Native
 */
export const MarkdownContext: React.Context<NativeOptions | undefined> =
  React.createContext<NativeOptions | undefined>(undefined)

/**
 * Per-key style map for React Native rendering. Each key is narrowed to the
 * style type accepted by the component it targets — Text styles for inline /
 * text content, View styles for block containers, ImageStyle for images.
 */
export interface NativeStyles {
  text?: StyleProp<TextStyle>
  paragraph?: StyleProp<TextStyle>
  heading1?: StyleProp<TextStyle>
  heading2?: StyleProp<TextStyle>
  heading3?: StyleProp<TextStyle>
  heading4?: StyleProp<TextStyle>
  heading5?: StyleProp<TextStyle>
  heading6?: StyleProp<TextStyle>
  link?: StyleProp<TextStyle>
  image?: StyleProp<ImageStyle>
  codeBlock?: StyleProp<ViewStyle>
  codeInline?: StyleProp<TextStyle>
  blockquote?: StyleProp<ViewStyle>
  listOrdered?: StyleProp<ViewStyle>
  listUnordered?: StyleProp<ViewStyle>
  listItem?: StyleProp<ViewStyle>
  listItemBullet?: StyleProp<TextStyle>
  listItemNumber?: StyleProp<TextStyle>
  thematicBreak?: StyleProp<ViewStyle>
  table?: StyleProp<ViewStyle>
  tableHeader?: StyleProp<ViewStyle>
  tableHeaderCell?: StyleProp<ViewStyle>
  tableRow?: StyleProp<ViewStyle>
  tableCell?: StyleProp<ViewStyle>
  em?: StyleProp<TextStyle>
  strong?: StyleProp<TextStyle>
  del?: StyleProp<TextStyle>
  mark?: StyleProp<TextStyle>
  gfmTask?: StyleProp<ViewStyle>
  // HTML semantic block elements (rendered as View by default)
  div?: StyleProp<ViewStyle>
  section?: StyleProp<ViewStyle>
  article?: StyleProp<ViewStyle>
  aside?: StyleProp<ViewStyle>
  header?: StyleProp<ViewStyle>
  footer?: StyleProp<ViewStyle>
  main?: StyleProp<ViewStyle>
  nav?: StyleProp<ViewStyle>
  figure?: StyleProp<ViewStyle>
  figcaption?: StyleProp<ViewStyle>
  ul?: StyleProp<ViewStyle>
  ol?: StyleProp<ViewStyle>
  li?: StyleProp<ViewStyle>
  th?: StyleProp<ViewStyle>
  td?: StyleProp<ViewStyle>
}

/**
 * Style keys for React Native components
 */
export type NativeStyleKey = keyof NativeStyles

/**
 * React Native compiler options
 */
export type NativeOptions = Omit<MarkdownToJSX.Options, 'wrapperProps'> & {
  /** Handler for link press events */
  onLinkPress?: (url: string, title?: string) => void
  /** Handler for link long press events */
  onLinkLongPress?: (url: string, title?: string) => void
  /** Style overrides for React Native components */
  styles?: NativeStyles
  /** Props for wrapper component (View or Text) */
  wrapperProps?: ViewProps | TextProps
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
        'blockquote',
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
      return h('hr', {
        key: state.key,
        style: styles.thematicBreak,
      })

    case RuleType.frontmatter:
      if (options.preserveFrontmatter) {
        const frontmatterNode = node as MarkdownToJSX.FrontmatterNode
        // In inline mode the wrapper is Text and View cannot nest inside it.
        // 'pre' maps to View (safe in block, takes ViewStyle);
        // 'code' maps to Text (safe inline, takes TextStyle).
        return h(
          state.inline ? 'code' : 'pre',
          {
            key: state.key,
            style: state.inline ? styles.codeInline : styles.codeBlock,
          },
          frontmatterNode.text
        )
      }
      return null

    case RuleType.codeBlock: {
      const codeNode = node as MarkdownToJSX.CodeBlockNode
      return h(
        'pre',
        { key: state.key, style: styles.codeBlock },
        h('code', { style: styles.codeInline }, codeNode.text)
      )
    }

    case RuleType.codeInline: {
      const codeNode = node as MarkdownToJSX.CodeInlineNode
      return h(
        'code',
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
      // Only attach DOM-only props (type/checked/readOnly) when the consumer
      // has overridden 'input'. Without an override the fallback is RN View,
      // which would log unknown-prop warnings for these in dev mode.
      const hasInputOverride = !!(options.overrides && options.overrides.input)
      const inputProps: Record<string, unknown> = {
        key: state.key,
        style: styles.gfmTask,
      }
      if (hasInputOverride) {
        inputProps.type = 'checkbox'
        inputProps.checked = taskNode.completed
        inputProps.readOnly = true
      }
      return h(
        'input',
        inputProps,
        h(Text, {}, taskNode.completed ? '[x]' : '[ ]')
      )
    }

    case RuleType.heading: {
      const headingNode = node as MarkdownToJSX.HeadingNode
      const headingStyleKey = `heading${headingNode.level}` as NativeStyleKey
      const headingStyle = styles[headingStyleKey]
      return h(
        `h${headingNode.level}`,
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
          typeof htmlNode._rawText === 'string'
            ? htmlNode._rawText
            : `<${htmlNode.tag}>`
        return h(Text, { key: state.key }, tagText)
      }

      if (htmlNode._rawText && htmlNode._verbatim) {
        const tagLower = (htmlNode.tag as string).toLowerCase()
        const isType1Block = parse.isType1Block(tagLower)

        // Type 1 blocks (pre, script, style, textarea) always render verbatim
        if (isType1Block) {
          const textContent = util.type1TextContent(
            htmlNode._rawText,
            tagLower,
            options.tagfilter
          )
          return h(
            htmlNode.tag,
            { key: state.key, ...util.htmlAttrsToJSXProps(htmlNode.attrs) },
            textContent
          )
        }

        if (/<\/?pre\b/i.test(htmlNode._rawText)) {
          const innerHtml = options.tagfilter
            ? util.applyTagFilterToText(htmlNode._rawText)
            : htmlNode._rawText
          return h(Text, { key: state.key, style: styles.codeBlock }, innerHtml)
        }

        // Re-parse rawText so a nested element does not absorb a following text
        // line, then split at this element's own closing tag so any trailing
        // content renders as siblings (issue #881).
        const cleanedText = htmlNode._rawText
          .replace(/>\s+</g, '><')
          .replace(/\n+/g, ' ')
          .trim()
        const props = { key: state.key, ...util.htmlAttrsToJSXProps(htmlNode.attrs) }
        const selfTagRegex = new RegExp(
          `^<${htmlNode.tag}(\\s[^>]*)?>(\\s*</${htmlNode.tag}>)?$`,
          'i'
        )
        if (selfTagRegex.test(cleanedText)) {
          return h(htmlNode.tag, props)
        }

        const parseOptions: parse.ParseOptions = {
          slugify: (input: string) => slug(input, util.slugify),
          sanitizer: sanitize,
          tagfilter: true,
        }
        const astNodes = parse.parseMarkdown(
          cleanedText,
          { inline: false, refs: refs, inHTML: false },
          parseOptions
        )
        util.stripVerbatim(astNodes)

        // rawText already contains its own wrapper element, so emit the parsed
        // nodes directly instead of nesting them in another copy of the tag.
        if (util.isFullVerbatimBlock(cleanedText, htmlNode.tag as string)) {
          return output(astNodes.flatMap(util.processVerbatimNode), state)
        }

        const split = util.findOwnCloseInAST(astNodes, tagLower)
        if (split.found && split.afterClose.length > 0) {
          return React.createElement(
            React.Fragment,
            { key: state.key },
            h(htmlNode.tag, props, output(split.beforeClose.flatMap(util.processVerbatimNode), state)),
            output(split.afterClose.flatMap(util.processVerbatimNode), state)
          )
        }

        return h(
          htmlNode.tag,
          props,
          output(astNodes.flatMap(util.processVerbatimNode), state)
        )
      }

      if (util.isVoidElement(htmlNode.tag)) {
        return h(htmlNode.tag, { key: state.key, ...util.htmlAttrsToJSXProps(htmlNode.attrs) })
      }
      return h(
        htmlNode.tag,
        { key: state.key, ...util.htmlAttrsToJSXProps(htmlNode.attrs) },
        htmlNode.children ? output(htmlNode.children, state) : ''
      )
    }

    case RuleType.htmlSelfClosing: {
      const htmlNode = node as MarkdownToJSX.HTMLSelfClosingNode
      if (options.tagfilter && util.shouldFilterTag(htmlNode.tag)) {
        const tagText =
          typeof htmlNode._rawText === 'string'
            ? htmlNode._rawText
            : `<${htmlNode.tag} />`
        return h(Text, { key: state.key }, tagText)
      }
      return h(htmlNode.tag, { key: state.key, ...util.htmlAttrsToJSXProps(htmlNode.attrs) })
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
      const props: Record<string, unknown> = {
        key: state.key,
        style: mergeStyle(LINK_DEFAULT_STYLE, styles.link),
      }

      if (linkNode.target != null) {
        const url = util.encodeUrlTarget(linkNode.target)
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
        tableNode.cells.length > 0
          ? h(
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
          : null
      )
    }

    case RuleType.text: {
      const textNode = node as MarkdownToJSX.TextNode
      return textNode.text
    }

    case RuleType.textFormatted: {
      const formattedNode = node as MarkdownToJSX.FormattedTextNode
      return h(
        formattedNode.tag,
        {
          key: state.key,
          style: mergeStyle(
            TEXT_FORMAT_STYLES[formattedNode.tag],
            styles[formattedNode.tag as NativeStyleKey]
          ),
        },
        output(formattedNode.children, state)
      )
    }

    case RuleType.orderedList:
    case RuleType.unorderedList: {
      const listNode = node as
        | MarkdownToJSX.OrderedListNode
        | MarkdownToJSX.UnorderedListNode
      const isOrdered = node.type === RuleType.orderedList
      const liStyle = mergeStyle(LIST_ITEM_ROW_STYLE, styles.li)

      return h(
        isOrdered ? 'ol' : 'ul',
        {
          key: state.key,
          style: isOrdered ? styles.listOrdered : styles.listUnordered,
        },
        listNode.items.map((item, i) => {
          const number =
            isOrdered && 'start' in listNode && listNode.start != null
              ? listNode.start + i
              : i + 1
          const bullet = isOrdered ? `${number}.` : '•'
          const bulletStyle = isOrdered
            ? styles.listItemNumber
            : styles.listItemBullet

          // When an item begins with a GFM task marker, the marker and label
          // are sibling AST nodes. The inner wrapper opts into row+center
          // alignment so the checkbox sits next to its label by default;
          // styles.listItem (when provided) still wins on collision via
          // mergeStyle's [default, user] ordering.
          const itemIsTask =
            item.length > 0 && item[0].type === RuleType.gfmTask
          const innerItemStyle = itemIsTask
            ? mergeStyle(GFM_TASK_ITEM_ROW_STYLE, styles.listItem)
            : styles.listItem

          return h(
            'li',
            { key: i, style: liStyle },
            h(Text, { style: bulletStyle }, bullet + ' '),
            h(
              View,
              { style: innerItemStyle },
              wrapLooseStringsInText(output(item, state))
            )
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

const getTag = (
  tag: string,
  overrides?: MarkdownToJSX.Overrides
): React.ElementType => {
  if (!overrides || typeof tag !== 'string') return tag
  const override = util.get(overrides, tag, undefined)
  if (!override) return tag
  if (
    typeof override === 'function' ||
    (typeof override === 'object' && override !== null && 'render' in override)
  ) {
    return override as React.ElementType
  }
  return util.get(overrides, `${tag}.component`, tag) as React.ElementType
}

// HTML tags that map to View on native. Set for O(1) lookups (matches
// utils.VOID_ELEMENTS precedent).
const VIEW_TAGS: Set<string> = new Set([
  'div',
  'section',
  'article',
  'aside',
  'header',
  'footer',
  'main',
  'nav',
  'figure',
  'figcaption',
  'blockquote',
  'hr',
  'input',
  'ul',
  'ol',
  'li',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
])

// Map HTML tags to React Native components
// React Native doesn't support arbitrary HTML tags, so we map them to Text or View
const mapHTMLTagToNativeComponent = (tag: string): React.ElementType => {
  const tagLower = tag.toLowerCase()
  if (tagLower === 'img') return Image
  if (VIEW_TAGS.has(tagLower)) return View
  // Type 1 blocks (pre, script, style, textarea)
  if (parse.isType1Block(tagLower)) return View
  return Text
}

/**
 * Convert AST nodes to React Native elements
 *
 * @param ast - Array of AST nodes to render
 * @param options - React Native compiler options
 * @returns React Native element(s)
 */
export function astToNative(
  ast: MarkdownToJSX.ASTNode[],
  options?: NativeOptions
): React.ReactNode {
  const opts: NativeOptions = { ...(options || {}) }
  opts.overrides = opts.overrides || {}

  const slug = opts.slugify || util.slugify
  const sanitize = opts.sanitizer || util.sanitizer
  const createElement = opts.createElement || React.createElement
  const hasOverrides = util.hasKeys(opts.overrides)

  function h(
    tag: React.ElementType,
    props: Record<string, unknown> & {
      style?: StyleProp<ViewStyle | TextStyle | ImageStyle>
    },
    ...children: React.ReactNode[]
  ): React.ReactNode {
    if (typeof tag !== 'string') {
      return createElement(tag, props, ...children)
    }

    let finalProps = props
    let Component: React.ElementType = tag
    if (hasOverrides) {
      const overrideProps = util.get(opts.overrides, `${tag}.props`, {}) as {
        [key: string]: unknown
        style?: StyleProp<ViewStyle | TextStyle | ImageStyle>
      }
      Component = getTag(tag, opts.overrides)
      // Merge so override.props.style and renderer-supplied style both apply.
      // Later entries in an RN style array win, so override-level styling has
      // precedence over the renderer's default — matches user intent for the
      // more-specific override entry.
      finalProps = {
        ...props,
        ...overrideProps,
        style: mergeStyle(props.style, overrideProps.style),
      }
    }

    if (typeof Component !== 'string') {
      return createElement(Component, finalProps, ...children)
    }
    return createElement(
      mapHTMLTagToNativeComponent(Component),
      finalProps,
      ...children
    )
  }

  const parseOptions: parse.ParseOptions = {
    slugify: i => slug(i, util.slugify),
    sanitizer: sanitize,
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
      sanitize(value, tag, attribute),
    slug,
    refs,
    opts
  )

  const emitted = emitter(ast, {
    inline: opts.forceInline,
    refs: refs as { [key: string]: { target: string; title: string } },
  })
  const arr: React.ReactNode[] = Array.isArray(emitted) ? emitted : [emitted]

  const footnoteEntries = util.extractFootnoteEntries(refs as { [key: string]: { target: string; title: string } })

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
          const wrappedContent =
            typeof footnoteContent === 'string'
              ? createElement(Text, {}, footnoteContent)
              : footnoteContent
          return createElement(
            View,
            {
              key: def.identifier,
            },
            createElement(Text, {}, identifierWithoutCaret + ': '),
            wrappedContent
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

/**
 * Compile markdown string to React Native elements
 *
 * @param markdown - Markdown string to compile
 * @param options - React Native compiler options
 * @returns React Native element(s)
 */
export function compiler(
  markdown: string = '',
  options: NativeOptions = {}
): React.ReactNode {
  const opts = { ...(options || {}) }
  opts.overrides = opts.overrides || {}

  const slug = opts.slugify || util.slugify
  const sanitize = opts.sanitizer || util.sanitizer

  function compile(input: string): React.ReactNode {
    const inline =
      opts.forceInline ||
      (!opts.forceBlock && !util.SHOULD_RENDER_AS_BLOCK_R.test(input))
    const parseOptions: parse.ParseOptions = {
      slugify: i => slug(i, util.slugify),
      sanitizer: (value: string, tag: string, attribute: string) =>
        sanitize(value, tag, attribute),
      tagfilter: opts.tagfilter !== false,
      disableAutoLink: opts.disableAutoLink,
      disableParsingRawHTML: opts.disableParsingRawHTML,
      enforceAtxHeadings: opts.enforceAtxHeadings,
    }

    let processedInput = inline ? input : util.prepareBlockInput(input)

    let astNodes = parse.parseMarkdown(
      inline ? input : processedInput,
      { inline: inline, refs: refs },
      parseOptions
    )

    return astToNative(astNodes, {
      ...opts,
      forceInline: inline,
    })
  }

  if (process.env.NODE_ENV !== 'production') {
    util.validateCompilerArgs(markdown, opts.overrides, 'ReactComponent')
  }

  const refs: {
    [key: string]: { target: string; title: string | undefined }
  } = {}

  return compile(markdown)
}

/**
 * React context provider for sharing compiler options across Markdown components in React Native
 *
 * @param options - Default compiler options to share
 * @param children - React children
 */
export const MarkdownProvider: React.FC<{
  options?: NativeOptions
  children: React.ReactNode
}> = ({ options, children }) => {
  return React.createElement(
    MarkdownContext.Provider,
    { value: options },
    children
  )
}

/**
 * Return the previous object identity when the new one is shallow-equal.
 * The JSX rest-props object is freshly allocated on every render; without
 * stabilization it invalidates the compile memo below even when nothing
 * changed, forcing a full re-parse per parent re-render.
 */
function useShallowStable<T extends Record<string, any>>(value: T): T {
  const ref = React.useRef(value)
  const prev = ref.current
  if (prev !== value) {
    var same = true
    var count = 0
    for (var key in value) {
      count++
      if (!Object.is(prev[key], value[key])) {
        same = false
        break
      }
    }
    if (same) {
      var prevCount = 0
      for (var prevKey in prev) prevCount++
      same = prevCount === count
    }
    if (!same) ref.current = value
  }
  return ref.current
}

/**
 * A React Native component for easy markdown rendering. Feed the markdown content as a direct child
 * and the rest is taken care of automatically. Supports memoization for optimal performance.
 *
 * @param children - Markdown string content
 * @param options - Compiler options
 * @param props - Additional View props
 */
export const Markdown: React.FC<
  Omit<ViewProps, 'children'> & {
    children?: string | string[] | null
    options?: NativeOptions
  }
> = ({ children: rawChildren, options, ...props }) => {
  const contextOptions = React.useContext(MarkdownContext)
  const stableProps = useShallowStable(props)

  const mergedOptions = React.useMemo(() => {
    var merged = Object.assign({}, contextOptions, options)
    merged.styles = Object.assign({}, contextOptions?.styles, options?.styles)
    merged.overrides = Object.assign(
      {},
      contextOptions?.overrides,
      options?.overrides
    )
    merged.wrapperProps = Object.assign(
      {},
      contextOptions?.wrapperProps,
      options?.wrapperProps,
      stableProps
    ) as ViewProps | TextProps
    return merged
  }, [contextOptions, options, stableProps])

  const content =
    rawChildren == null
      ? ''
      : Array.isArray(rawChildren)
        ? rawChildren.join('')
        : rawChildren

  const jsx = React.useMemo(
    () => compiler(content, mergedOptions),
    [content, mergedOptions]
  )

  return jsx as React.ReactElement
}

export default Markdown
