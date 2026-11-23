import * as React from 'react'
import type {
  ImageStyle,
  StyleProp,
  TextProps,
  TextStyle,
  ViewProps,
  ViewStyle,
} from 'react-native'
import { Image, Linking, Platform, Pressable, Text, View } from 'react-native'
import { $ } from './constants.ts'
import * as parse from './parse.ts'
import { useShallowStable } from './shallow-stable.ts'
import { type MarkdownToJSX, RuleType } from './types.ts'
import * as util from './utils.ts'

export { parser } from './parse.ts'

export { type MarkdownToJSX, RuleType } from './types.ts'
export { sanitizer, slugify } from './utils.ts'

const LIST_ITEM_ROW_STYLE: ViewStyle = { flexDirection: 'row' }
const LIST_ITEM_CONTENT_STYLE: ViewStyle = { flex: 1 }
const GFM_TASK_ITEM_ROW_STYLE: ViewStyle = {
  alignItems: 'flex-start',
  flex: 1,
  flexDirection: 'row',
}
const CHECKBOX_STYLE: ViewStyle = {
  alignItems: 'center',
  borderColor: '#8c959f',
  borderRadius: 4,
  borderWidth: 1.5,
  height: 16,
  justifyContent: 'center',
  marginRight: 8,
  marginTop: 6,
  width: 16,
}
const TABLE_ROW_FLEX: ViewStyle = { flexDirection: 'row' }
const MONOSPACE_FONT = Platform.select({
  android: 'monospace',
  ios: 'Menlo',
  default: 'monospace',
})

const DEFAULT_STYLES: NativeStyles = {
  blockquote: {
    borderLeftColor: '#d1d9e0',
    borderLeftWidth: 3,
    marginBottom: 16,
    paddingLeft: 16,
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
    transform: [{ translateY: -1 }],
  },
  codeBlock: {
    backgroundColor: '#f6f8fa',
    borderRadius: 8,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  codeInline: { fontFamily: MONOSPACE_FONT, fontSize: 15 },
  gfmTaskChecked: { backgroundColor: '#0969da', borderColor: '#0969da' },
  heading1: {
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 36,
    marginBottom: 12,
    marginTop: 8,
  },
  heading2: {
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 30,
    marginBottom: 10,
    marginTop: 8,
  },
  heading3: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 26,
    marginBottom: 8,
    marginTop: 8,
  },
  heading4: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
    marginBottom: 8,
    marginTop: 8,
  },
  heading5: { fontSize: 15, fontWeight: '600', marginBottom: 6, marginTop: 8 },
  heading6: {
    color: '#656d76',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 8,
  },
  link: { color: '#0969da', textDecorationLine: 'underline' },
  listOrdered: { marginBottom: 16 },
  listUnordered: { marginBottom: 16 },
  paragraph: { fontSize: 16, lineHeight: 26, marginBottom: 16 },
  table: {
    borderColor: '#d1d9e0',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  tableCell: { flex: 1, paddingHorizontal: 10, paddingVertical: 8 },
  tableCellDivider: { borderRightColor: '#d1d9e0', borderRightWidth: 1 },
  tableHeader: { backgroundColor: '#f6f8fa' },
  tableHeaderCell: { flex: 1, paddingHorizontal: 10, paddingVertical: 8 },
  tableHeaderText: { fontWeight: 'bold' },
  tableRowDivider: { borderBottomColor: '#d1d9e0', borderBottomWidth: 1 },
  text: { fontSize: 16, lineHeight: 24 },
  thematicBreak: { backgroundColor: '#d8dee4', height: 1, marginVertical: 16 },
}

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
}
const toSuperscript = (text: string): string =>
  text.replace(/[0-9]/g, digit => SUPERSCRIPT_DIGITS[digit])
const TEXT_FORMAT_STYLES: Record<string, TextStyle> = {
  em: { fontStyle: 'italic' },
  strong: { fontWeight: 'bold' },
  del: { textDecorationLine: 'line-through' },
}

const mergeStyle = <T,>(
  d: T | undefined,
  u: T | undefined
): T | T[] | undefined => (u ? (d ? [d, u] : u) : d)

const withTextBase = (
  base: StyleProp<TextStyle> | undefined,
  style: StyleProp<TextStyle>
): StyleProp<TextStyle> =>
  base ? (Array.isArray(style) ? [base, ...style] : [base, style]) : style

const ZERO_MARGIN_BOTTOM: ViewStyle = { marginBottom: 0 }
const withoutTrailingMargin = (rendered: React.ReactNode): React.ReactNode => {
  if (Array.isArray(rendered)) {
    for (let i = rendered.length - 1; i >= 0; i--) {
      const child = rendered[i]
      if (React.isValidElement<{ style?: StyleProp<ViewStyle> }>(child)) {
        const copy = rendered.slice()
        copy[i] = React.cloneElement(child, {
          style: [child.props.style, ZERO_MARGIN_BOTTOM],
        })
        return copy
      }
    }
    return rendered
  }
  return React.isValidElement<{ style?: StyleProp<ViewStyle> }>(rendered)
    ? React.cloneElement(rendered, {
        style: [rendered.props.style, ZERO_MARGIN_BOTTOM],
      })
    : rendered
}

const ALIGN_CENTER: ViewStyle = { alignItems: 'center' }
const ALIGN_LEFT: ViewStyle = { alignItems: 'flex-start' }
const ALIGN_RIGHT: ViewStyle = { alignItems: 'flex-end' }

const alignItemsFor = (
  align: 'center' | 'left' | 'right' | null | undefined
): ViewStyle | null =>
  align === null
    ? null
    : align === 'center'
      ? ALIGN_CENTER
      : align === 'right'
        ? ALIGN_RIGHT
        : ALIGN_LEFT

const resolveStyles = (user?: NativeStyles): NativeStyles => {
  if (!util.hasKeys(user)) {
    return DEFAULT_STYLES
  }
  const resolved = { ...DEFAULT_STYLES } as Record<string, unknown>
  const defaults = DEFAULT_STYLES as Record<string, unknown>
  const overrides = user as Record<string, unknown>
  for (const key in overrides) {
    resolved[key] = mergeStyle(defaults[key], overrides[key])
  }
  return resolved as NativeStyles
}

interface StyledCache {
  bulletText: StyleProp<TextStyle>
  codeText: StyleProp<TextStyle>
  footnoteText: StyleProp<TextStyle>
  formatted: Record<
    string,
    { host: StyleProp<TextStyle>; inline: StyleProp<TextStyle> }
  >
  headingInline: StyleProp<TextStyle>[]
  li: StyleProp<ViewStyle>
  linkInline: StyleProp<TextStyle>
  listContent: StyleProp<ViewStyle>
  numberText: StyleProp<TextStyle>
  paragraphInline: StyleProp<TextStyle>
  preText: StyleProp<TextStyle>
  rowFlexDivider: StyleProp<ViewStyle>
  styles: NativeStyles
  taskChecked: StyleProp<ViewStyle>
  taskRow: StyleProp<ViewStyle>
  taskUnchecked: StyleProp<ViewStyle>
  textOnly: StyleProp<TextStyle>
}

let DefaultStyledCache: StyledCache | undefined

const buildStyledCache = (user?: NativeStyles): StyledCache => {
  if (!util.hasKeys(user)) {
    if (!DefaultStyledCache) {
      DefaultStyledCache = createStyledCache(user)
    }
    return DefaultStyledCache
  }
  return createStyledCache(user)
}

const createStyledCache = (user?: NativeStyles): StyledCache => {
  const styles = resolveStyles(user)
  const text = styles.text
  return {
    bulletText: withTextBase(text, styles.listItemBullet),
    codeText: withTextBase(text, styles.codeInline),
    footnoteText: withTextBase(text, styles.footnote),
    formatted: Object.create(null),
    headingInline: [
      undefined,
      withTextBase(text, styles.heading1),
      withTextBase(text, styles.heading2),
      withTextBase(text, styles.heading3),
      withTextBase(text, styles.heading4),
      withTextBase(text, styles.heading5),
      withTextBase(text, styles.heading6),
    ],
    li: mergeStyle(LIST_ITEM_ROW_STYLE, styles.li),
    linkInline: withTextBase(text, styles.link),
    listContent: mergeStyle(LIST_ITEM_CONTENT_STYLE, styles.listItem),
    numberText: withTextBase(text, styles.listItemNumber),
    paragraphInline: withTextBase(text, styles.paragraph),
    preText: withTextBase(text, styles.codeBlock),
    rowFlexDivider: [TABLE_ROW_FLEX, styles.tableRowDivider],
    styles,
    taskChecked: mergeStyle<StyleProp<ViewStyle>>(
      [CHECKBOX_STYLE, styles.gfmTaskChecked],
      styles.gfmTask
    ),
    taskRow: mergeStyle(GFM_TASK_ITEM_ROW_STYLE, styles.listItem),
    taskUnchecked: mergeStyle<StyleProp<ViewStyle>>(
      CHECKBOX_STYLE,
      styles.gfmTask
    ),
    textOnly: withTextBase(text, undefined),
  }
}

const isInlineSafe = (node: MarkdownToJSX.ASTNode): boolean => {
  switch (node.type) {
    case RuleType.breakLine:
    case RuleType.codeInline:
    case RuleType.footnoteReference:
    case RuleType.htmlComment:
    case RuleType.ref:
    case RuleType.text:
      return true
    case RuleType.link:
      return node.children.every(isInlineSafe)
    case RuleType.textFormatted:
      return node.children.every(isInlineSafe)
    case RuleType.htmlSelfClosing:
      return node.tag.toLowerCase() !== 'img' && !mapsToNativeView(node.tag)
    case RuleType.htmlBlock:
      if (mapsToNativeView(node.tag)) {
        return false
      }
      return !node.children || node.children.every(isInlineSafe)
    default:
      return false
  }
}

const singleTextChild = (
  nodes: MarkdownToJSX.ASTNode[],
  ctx: CompileContext
): string | null =>
  !ctx.options.renderRule &&
  nodes.length === 1 &&
  nodes[0].type === RuleType.text
    ? (nodes[0] as MarkdownToJSX.TextNode).text
    : null

const renderViewChildren = (
  nodes: MarkdownToJSX.ASTNode[],
  output: MarkdownToJSX.ASTRender,
  state: MarkdownToJSX.State,
  runStyle: StyleProp<TextStyle> | undefined,
  ctx: CompileContext
): React.ReactNode[] => {
  const h = ctx.h
  const styled = ctx.styled
  const children: React.ReactNode[] = []
  let run: MarkdownToJSX.ASTNode[] = []
  let key = 0
  const runTextStyle =
    runStyle === undefined
      ? styled.textOnly
      : withTextBase(styled.styles.text, runStyle)
  const flushRun = () => {
    if (run.length > 0) {
      const text = singleTextChild(run, ctx)
      if (text != null) {
        children.push(h(Text, { key: key++, style: runTextStyle }, text))
        run = []
        return
      }
      const prev = state.inlineSafe
      state.inlineSafe = true
      children.push(
        h(Text, { key: key++, style: runTextStyle }, output(run, state))
      )
      state.inlineSafe = prev
      run = []
    }
  }
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    if (isInlineSafe(node)) {
      run.push(node)
    } else {
      flushRun()
      children.push(
        React.createElement(
          React.Fragment,
          { key: key++ },
          output([node], state)
        )
      )
    }
  }
  flushRun()
  return children
}

const renderInlineHost = (
  tag: string,
  props: Record<string, unknown> & { style?: StyleProp<TextStyle> },
  inlineStyle: StyleProp<TextStyle>,
  childNodes: MarkdownToJSX.ASTNode[],
  output: MarkdownToJSX.ASTRender,
  state: MarkdownToJSX.State,
  ctx: CompileContext
): React.ReactNode => {
  const h = ctx.h
  const overrides = ctx.overrides
  const overridden =
    Boolean(overrides) && Boolean(util.get(overrides, tag, undefined))
  const safe = state.inlineSafe === true || childNodes.every(isInlineSafe)
  if (overridden || safe) {
    if (inlineStyle !== props.style) {
      props.style = inlineStyle
    }
    const text = singleTextChild(childNodes, ctx)
    if (text != null) {
      return h(tag, props, text)
    }
    const prev = state.inlineSafe
    state.inlineSafe = safe
    const out = h(tag, props, output(childNodes, state))
    state.inlineSafe = prev
    return out
  }
  return h(
    View,
    props,
    ...renderViewChildren(childNodes, output, state, props.style, ctx)
  )
}

/**
 * React context for sharing compiler options across Markdown components in React Native
 */
export const MarkdownContext: React.Context<NativeOptions | undefined> =
  React.createContext<NativeOptions | undefined>(undefined)

/**
 * Per-key style map for React Native rendering. Each key is narrowed to the
 * style type accepted by the component it targets: Text styles for inline and
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
  /** Footnote reference marker, rendered as a Unicode superscript for numeric identifiers. */
  footnote?: StyleProp<TextStyle>
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
  /** Text run inside header cells, bold by default. */
  tableHeaderText?: StyleProp<TextStyle>
  tableRow?: StyleProp<ViewStyle>
  tableCell?: StyleProp<ViewStyle>
  /** Vertical grid divider drawn on every cell but the last in a row. */
  tableCellDivider?: StyleProp<ViewStyle>
  /** Horizontal grid divider drawn under every row but the last. */
  tableRowDivider?: StyleProp<ViewStyle>
  em?: StyleProp<TextStyle>
  strong?: StyleProp<TextStyle>
  del?: StyleProp<TextStyle>
  mark?: StyleProp<TextStyle>
  gfmTask?: StyleProp<ViewStyle>
  /** Accent fill layered over gfmTask when the task is completed. */
  gfmTaskChecked?: StyleProp<ViewStyle>
  /** Checkmark glyph drawn inside a completed GFM task box. */
  checkmark?: StyleProp<TextStyle>
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

interface CompileContext {
  h: (tag: any, props: any, ...children: any[]) => any
  options: NativeOptions
  overrides: MarkdownToJSX.Overrides | undefined
  refs: { [key: string]: { target: string; title: string | undefined } }
  sanitize: (value: string, tag: string, attribute: string) => string | null
  slug: (input: string, defaultFn: (input: string) => string) => string
  styled: StyledCache
}

function render(
  node: MarkdownToJSX.ASTNode,
  output: MarkdownToJSX.ASTRender,
  state: MarkdownToJSX.State,
  ctx: CompileContext
): React.ReactNode {
  const h = ctx.h
  const options = ctx.options
  const overrides = ctx.overrides
  const sanitize = ctx.sanitize
  const styled = ctx.styled
  const styles = styled.styles

  switch (node.type) {
    case RuleType.blockQuote: {
      const blockquoteNode = node as MarkdownToJSX.BlockQuoteNode
      return h(
        'blockquote',
        {
          key: state.key,
          style: styles.blockquote,
        },
        withoutTrailingMargin(output(blockquoteNode.children, state))
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
        if (state.inline) {
          return h(
            'code',
            { key: state.key, style: styles.codeInline },
            frontmatterNode.text
          )
        }
        return h(
          'pre',
          { key: state.key, style: styles.codeBlock },
          h('code', { style: styled.codeText }, frontmatterNode.text)
        )
      }
      return null

    case RuleType.codeBlock: {
      const codeNode = node as MarkdownToJSX.CodeBlockNode
      return h(
        'pre',
        { key: state.key, style: styles.codeBlock },
        h('code', { style: styled.codeText }, codeNode.text)
      )
    }

    case RuleType.codeInline: {
      const codeNode = node as MarkdownToJSX.CodeInlineNode
      return h(
        'code',
        { key: state.key, style: styled.codeText },
        codeNode.text
      )
    }

    case RuleType.footnoteReference: {
      const footnoteNode = node as MarkdownToJSX.FootnoteReferenceNode
      const href = sanitize(footnoteNode.target, 'a', 'href')
      if (!href) {
        return null
      }
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
          style: styled.footnoteText,
        },
        toSuperscript(footnoteNode.text)
      )
    }

    case RuleType.gfmTask: {
      const taskNode = node as MarkdownToJSX.GFMTaskNode
      const hasInputOverride = Boolean(overrides?.input)
      if (hasInputOverride) {
        return h(
          'input',
          {
            key: state.key,
            type: 'checkbox',
            checked: taskNode.completed,
            readOnly: true,
            style: styles.gfmTask,
          },
          h(
            Text,
            { style: styled.textOnly },
            taskNode.completed ? '[x]' : '[ ]'
          )
        )
      }
      return h(
        'input',
        {
          key: state.key,
          style: taskNode.completed ? styled.taskChecked : styled.taskUnchecked,
        },
        taskNode.completed
          ? h(Text, { style: styled.styles.checkmark }, '✓')
          : null
      )
    }

    case RuleType.heading: {
      const headingNode = node as MarkdownToJSX.HeadingNode
      const headingStyleKey = `heading${headingNode.level}` as NativeStyleKey
      return renderInlineHost(
        `h${headingNode.level}`,
        { key: state.key, style: styles[headingStyleKey] },
        styled.headingInline[headingNode.level],
        headingNode.children,
        output,
        state,
        ctx
      )
    }

    case RuleType.htmlBlock: {
      const htmlNode = node as MarkdownToJSX.HTMLNode
      if (
        util.tagfilterEnabled(options) &&
        util.shouldFilterTag(htmlNode.tag)
      ) {
        var filtered = util.getFilteredTagEmit(htmlNode)
        if (filtered.kind === 'literal') {
          return h(
            Text,
            { key: state.key, style: styled.textOnly },
            filtered.literal
          )
        }
        return h(
          Text,
          { key: state.key, style: styled.textOnly },
          ...util.assembleFilteredTagChildren(
            filtered.open,
            htmlNode.children ? output(htmlNode.children, state) : null,
            filtered.close
          )
        )
      }

      const rawOuter = htmlNode._rawOuter
      const isRawOuter = rawOuter !== undefined
      const rawSource = isRawOuter
        ? rawOuter
        : htmlNode._isClosingTag
          ? htmlNode._rawBody || ''
          : (htmlNode._rawBody || '') + (htmlNode._rawClose || '')
      if (rawSource && htmlNode._verbatim) {
        const tagLower = (htmlNode.tag as string).toLowerCase()
        const isType1Block = parse.isType1Block(tagLower)

        if (isType1Block) {
          const type1Body =
            (isRawOuter ? htmlNode.text : htmlNode._rawBody) || ''
          const textContent = util.tagfilterEnabled(options)
            ? util.applyTagFilterToText(type1Body)
            : type1Body
          return h(
            htmlNode.tag,
            htmlNodeProps(htmlNode, state.key, ctx.overrides),
            h(
              Text,
              { style: styled.codeText },
              util.verbatimText(htmlNode.tag, textContent)
            )
          )
        }

        if (/<\/?pre\b/i.test(rawSource)) {
          const innerHtml = util.tagfilterEnabled(options)
            ? util.applyTagFilterToText(rawSource)
            : rawSource
          return h(Text, { key: state.key, style: styled.preText }, innerHtml)
        }

        const cleanedText = util.normalizeJsxReparseText(
          htmlNode._reparseSource || rawSource
        )
        const props = htmlNodeProps(htmlNode, state.key, ctx.overrides)
        const selfTagRegex = new RegExp(
          `^<${htmlNode.tag}(\\s[^>]*)?>(\\s*</${htmlNode.tag}>)?$`,
          'i'
        )
        if (selfTagRegex.test(cleanedText)) {
          return typeof props.children === 'string'
            ? emitHtmlElement(htmlNode.tag, props, [], output, state, ctx)
            : h(htmlNode.tag, props)
        }

        const parseOptions = parse.toParseOptions({
          overrides: options.overrides,
          slugify: options.slugify,
          sanitizer: sanitize,
          tagfilter: true,
        })
        const astNodes = parse.parseMarkdown(
          cleanedText,
          { inline: false, refs: ctx.refs, inHTML: false },
          parseOptions
        )
        util.stripVerbatim(astNodes)
        if (util.reparsedToItself(astNodes, cleanedText)) {
          return cleanedText
        }

        if (isRawOuter) {
          const rendered = output(
            astNodes.flatMap(util.processVerbatimNode),
            state
          )
          if (Array.isArray(rendered)) {
            return React.createElement(
              React.Fragment,
              { key: state.key },
              rendered
            )
          }
          return React.isValidElement(rendered)
            ? React.cloneElement(rendered, { key: state.key })
            : rendered
        }

        const split = util.findOwnCloseInAST(astNodes, tagLower)
        if (split.found && split.afterClose.length > 0) {
          const trailing = renderViewChildren(
            split.afterClose.flatMap(util.processVerbatimNode),
            output,
            state,
            undefined,
            ctx
          ).map((element, index) =>
            React.isValidElement(element)
              ? React.cloneElement(element, { key: `after-${index}` })
              : element
          )
          return React.createElement(
            React.Fragment,
            { key: state.key },
            emitHtmlElement(
              htmlNode.tag,
              props,
              split.beforeClose.flatMap(util.processVerbatimNode),
              output,
              state,
              ctx
            ),
            ...trailing
          )
        }

        return emitHtmlElement(
          htmlNode.tag,
          props,
          astNodes.flatMap(util.processVerbatimNode),
          output,
          state,
          ctx
        )
      }

      const blockProps = htmlNodeProps(htmlNode, state.key, ctx.overrides)
      if (util.isVoidElement(htmlNode.tag)) {
        delete blockProps.children
        return h(htmlNode.tag, blockProps)
      }
      return htmlNode.children
        ? emitHtmlElement(
            htmlNode.tag,
            blockProps,
            htmlNode.children,
            output,
            state,
            ctx
          )
        : h(htmlNode.tag, blockProps)
    }

    case RuleType.htmlSelfClosing: {
      const htmlNode = node as MarkdownToJSX.HTMLSelfClosingNode
      if (
        util.tagfilterEnabled(options) &&
        util.shouldFilterTag(htmlNode.tag)
      ) {
        var filteredSc = util.getFilteredTagEmit(htmlNode)
        return h(
          Text,
          { key: state.key, style: styled.textOnly },
          filteredSc.kind === 'literal'
            ? filteredSc.literal
            : filteredSc.open + (filteredSc.close || '')
        )
      }
      const selfClosingProps = htmlNodeProps(htmlNode, state.key, ctx.overrides)
      return typeof selfClosingProps.children === 'string'
        ? emitHtmlElement(
            htmlNode.tag,
            selfClosingProps,
            [],
            output,
            state,
            ctx
          )
        : h(htmlNode.tag, selfClosingProps)
    }

    case RuleType.image: {
      const imageNode = node as MarkdownToJSX.ImageNode
      const src =
        imageNode.target === null
          ? null
          : util.sanitizeAndEncodeUrlTarget(
              imageNode.target,
              sanitize,
              'img',
              'src'
            )
      if (!src) {
        return null
      }
      return h('img', {
        key: state.key,
        source: { uri: src },
        accessibilityLabel: imageNode.alt || undefined,
        style: styles.image,
      })
    }

    case RuleType.link: {
      const linkNode = node as MarkdownToJSX.LinkNode
      const linkStyle = styles.link
      const safe =
        state.inlineSafe === true || linkNode.children.every(isInlineSafe)
      const props: Record<string, unknown> = {
        key: state.key,
        style: safe ? styled.linkInline : linkStyle,
      }

      if (linkNode.target != null) {
        const href = util.sanitizeAndEncodeUrlTarget(
          linkNode.target,
          sanitize,
          'a',
          'href'
        )
        if (href != null) {
          props.onPress = () => {
            options.onLinkPress
              ? options.onLinkPress(href, linkNode.title)
              : Linking.openURL(href).catch(() => {})
          }
          const onLinkLongPress = options.onLinkLongPress
          if (onLinkLongPress) {
            props.onLongPress = () => onLinkLongPress(href, linkNode.title)
          }
        }
      }

      if (safe) {
        const text = singleTextChild(linkNode.children, ctx)
        if (text != null) {
          return h('a', props, text)
        }
        const prev = state.inlineSafe
        state.inlineSafe = true
        const out = h('a', props, output(linkNode.children, state))
        state.inlineSafe = prev
        return out
      }
      return h(
        Pressable,
        props,
        ...renderViewChildren(linkNode.children, output, state, linkStyle, ctx)
      )
    }

    case RuleType.table: {
      const tableNode = node as MarkdownToJSX.TableNode
      const headerLast = tableNode.header.length - 1
      const rowsLast = tableNode.cells.length - 1
      return h(
        View,
        { key: state.key, style: styles.table },
        h(
          View,
          { style: styles.tableHeader },
          h(
            View,
            { style: styled.rowFlexDivider },
            tableNode.header.map(function generateHeaderCell(content, i) {
              return h(
                View,
                {
                  key: i,
                  style: [
                    styles.tableHeaderCell,
                    i < headerLast ? styles.tableCellDivider : null,
                    alignItemsFor(tableNode.align[i]),
                  ],
                },
                ...renderViewChildren(
                  content,
                  output,
                  state,
                  styles.tableHeaderText,
                  ctx
                )
              )
            })
          )
        ),
        tableNode.cells.length > 0
          ? h(
              View,
              {},
              tableNode.cells.map(function generateTableRow(row, i) {
                const rowLast = row.length - 1
                return h(
                  View,
                  {
                    key: i,
                    style:
                      i < rowsLast ? styled.rowFlexDivider : TABLE_ROW_FLEX,
                  },
                  row.map(function generateTableCell(content, c) {
                    return h(
                      View,
                      {
                        key: c,
                        style: [
                          styles.tableCell,
                          c < rowLast ? styles.tableCellDivider : null,
                          alignItemsFor(tableNode.align[c]),
                        ],
                      },
                      ...renderViewChildren(
                        content,
                        output,
                        state,
                        undefined,
                        ctx
                      )
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
      var formatted = styled.formatted[formattedNode.tag]
      if (formatted === undefined) {
        var host = mergeStyle(
          TEXT_FORMAT_STYLES[formattedNode.tag],
          styles[formattedNode.tag as NativeStyleKey] as TextStyle | undefined
        )
        formatted = styled.formatted[formattedNode.tag] = {
          host,
          inline: withTextBase(styles.text, host),
        }
      }
      return renderInlineHost(
        formattedNode.tag,
        { key: state.key, style: formatted.host },
        formatted.inline,
        formattedNode.children,
        output,
        state,
        ctx
      )
    }

    case RuleType.orderedList:
    case RuleType.unorderedList: {
      const listNode = node as
        | MarkdownToJSX.OrderedListNode
        | MarkdownToJSX.UnorderedListNode
      const isOrdered = node.type === RuleType.orderedList
      const liStyle = styled.li
      const bulletProps = {
        style: isOrdered ? styled.numberText : styled.bulletText,
      }

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

          const itemIsTask =
            item.length > 0 && item[0].type === RuleType.gfmTask
          const innerItemStyle = itemIsTask
            ? styled.taskRow
            : styled.listContent

          const renderNodes =
            itemIsTask &&
            item.length > 1 &&
            item[1].type === RuleType.text &&
            (item[1] as MarkdownToJSX.TextNode).text.trim() === ''
              ? [item[0], ...item.slice(2)]
              : item

          return h(
            'li',
            { key: i, style: liStyle },
            itemIsTask ? null : h(Text, bulletProps, `${bullet} `),
            h(
              View,
              { style: innerItemStyle },
              ...renderViewChildren(renderNodes, output, state, undefined, ctx)
            )
          )
        })
      )
    }

    case RuleType.paragraph:
      return renderInlineHost(
        'p',
        { key: state.key, style: styles.paragraph },
        styled.paragraphInline,
        (node as MarkdownToJSX.ParagraphNode).children,
        output,
        state,
        ctx
      )

    case RuleType.ref:
      return null

    default:
      return null
  }
}

const createRenderer = (ctx: CompileContext) => {
  const userRender = ctx.options.renderRule
  const handleStackOverflow = (ast: MarkdownToJSX.ASTNode[]) =>
    ast.map(node => ('text' in node ? node.text : ''))
  const renderer: MarkdownToJSX.ASTRender = (
    ast: MarkdownToJSX.ASTNode | MarkdownToJSX.ASTNode[],
    state: MarkdownToJSX.State = {}
  ) => {
    const nodes = Array.isArray(ast) ? ast : [ast]
    const depth = (state.renderDepth || 0) + 1
    if (depth > $.MAX_RENDER_DEPTH) {
      return handleStackOverflow(nodes)
    }
    state.renderDepth = depth

    const oldKey = state.key
    const result: React.ReactNode[] = []
    let lastWasString = false
    const renderChildren = userRender
      ? (
          children: MarkdownToJSX.ASTNode | MarkdownToJSX.ASTNode[],
          childState?: MarkdownToJSX.State
        ) => renderer(children, childState || state)
      : renderer
    for (let i = 0; i < nodes.length; i++) {
      state.key = i
      let nodeOut: React.ReactNode
      if (userRender) {
        const currentNode = nodes[i]
        nodeOut = userRender(
          () => render(currentNode, renderer, state, ctx),
          currentNode,
          renderChildren,
          state
        )
      } else {
        nodeOut = render(nodes[i], renderer, state, ctx)
      }
      const isString = typeof nodeOut === 'string'
      if (lastWasString && typeof nodeOut === 'string') {
        const last = result.at(-1)
        result[result.length - 1] =
          (typeof last === 'string' ? last : '') + nodeOut
      } else if (nodeOut != null) {
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
): React.ComponentType<any> | string => {
  if (!overrides || typeof tag !== 'string') {
    return tag
  }
  const override = util.get(overrides, tag, undefined)
  if (!override) {
    return tag
  }
  if (
    typeof override === 'function' ||
    (typeof override === 'object' && override != null && 'render' in override)
  ) {
    return override as React.ElementType
  }
  return util.get(overrides, `${tag}.component`, tag) as React.ElementType
}

const VIEW_TAGS: Set<string> = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'caption',
  'center',
  'dd',
  'details',
  'dialog',
  'div',
  'dl',
  'dt',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'header',
  'hr',
  'input',
  'legend',
  'li',
  'main',
  'menu',
  'nav',
  'ol',
  'search',
  'section',
  'summary',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'ul',
])

const mapsToNativeView = (tag: string): boolean => {
  const tagLower = tag.toLowerCase()
  return VIEW_TAGS.has(tagLower) || parse.isType1Block(tagLower)
}

const NATIVE_COMPONENT_CACHE: Map<string, React.ElementType> = new Map()

const mapHtmlTagToNativeComponent = (tag: string): React.ElementType => {
  var cached = NATIVE_COMPONENT_CACHE.get(tag)
  if (cached === undefined) {
    cached =
      tag.toLowerCase() === 'img' ? Image : mapsToNativeView(tag) ? View : Text
    if (NATIVE_COMPONENT_CACHE.size < 1000) {
      NATIVE_COMPONENT_CACHE.set(tag, cached)
    }
  }
  return cached
}

const htmlNodeProps = (
  htmlNode: MarkdownToJSX.HTMLNode | MarkdownToJSX.HTMLSelfClosingNode,
  key: MarkdownToJSX.State['key'],
  overrides: CompileContext['overrides']
): Record<string, unknown> => ({
  key,
  ...util.htmlAttrsToJSXProps(
    util.withoutHandlerSource(htmlNode.tag, htmlNode.attrs, overrides, getTag)
  ),
})

const emitHtmlElement = (
  tag: string,
  props: Record<string, unknown> & { style?: StyleProp<TextStyle> },
  ownNodes: MarkdownToJSX.ASTNode[],
  output: MarkdownToJSX.ASTRender,
  state: MarkdownToJSX.State,
  ctx: CompileContext
): React.ReactNode => {
  const childNodes = withChildrenAttr(props, ownNodes)
  return mapsToNativeView(tag)
    ? ctx.h(
        tag,
        props,
        ...renderViewChildren(childNodes, output, state, undefined, ctx)
      )
    : renderInlineHost(
        tag,
        props,
        withTextBase(ctx.styled.styles.text, props.style),
        childNodes,
        output,
        state,
        ctx
      )
}

const withChildrenAttr = (
  props: Record<string, unknown>,
  ownNodes: MarkdownToJSX.ASTNode[]
): MarkdownToJSX.ASTNode[] => {
  if (typeof props.children !== 'string') {
    return ownNodes
  }
  const text = util.childrenAttrContent(props.children, ownNodes)
  delete props.children
  return text === undefined ? ownNodes : [{ type: RuleType.text, text }]
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
    let Component: React.ComponentType<any> | string = tag
    if (hasOverrides) {
      const overrideProps = util.get(opts.overrides, `${tag}.props`, {}) as {
        [key: string]: unknown
        style?: StyleProp<ViewStyle | TextStyle | ImageStyle>
      }
      Component = getTag(tag, opts.overrides)
      finalProps = {
        ...props,
        ...overrideProps,
        style: mergeStyle(props.style, overrideProps.style),
      }
    }

    if (typeof Component !== 'string') {
      return createElement(Component, finalProps, ...children)
    }
    if (hasOverrides && util.isVoidElement(Component)) {
      delete finalProps.children
      children.length = 0
    }
    return createElement(
      mapHtmlTagToNativeComponent(Component),
      finalProps,
      ...children
    )
  }

  const parseOptions = parse.toParseOptions(opts)

  const refs =
    ast[0] && ast[0].type === RuleType.refCollection
      ? (ast[0] as MarkdownToJSX.ReferenceCollectionNode).refs
      : (Object.create(null) as {
          [key: string]: { target: string; title: string | undefined }
        })

  const ctx: CompileContext = {
    h,
    options: opts,
    overrides: hasOverrides ? opts.overrides : undefined,
    refs,
    sanitize,
    slug,
    styled: buildStyledCache(opts.styles),
  }
  const emitter = createRenderer(ctx)

  const emitted = emitter(ast, {
    inline: opts.forceInline,
    refs,
  })
  const arr: React.ReactNode[] = Array.isArray(emitted) ? emitted : [emitted]

  const footnoteEntries = util.extractFootnoteEntries(refs)

  if (footnoteEntries.length > 0) {
    const footnoteTextBase = ctx.styled.styles.text
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
            { inline: true, refs },
            parseOptions
          )
          const renderable = footnoteAstNodes.filter(
            node => node.type !== RuleType.refCollection
          )
          if (renderable.every(isInlineSafe)) {
            return createElement(
              Text,
              { key: def.identifier, style: footnoteTextBase },
              `${identifierWithoutCaret}: `,
              emitter(renderable, { inline: true, refs })
            )
          }
          return createElement(
            View,
            {
              key: def.identifier,
            },
            createElement(
              Text,
              { style: footnoteTextBase },
              `${identifierWithoutCaret}: `
            ),
            ...renderViewChildren(
              footnoteAstNodes,
              emitter,
              { inline: true, refs },
              undefined,
              ctx
            )
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
    jsx =
      wrapper === View
        ? arr.map((child, i) =>
            typeof child === 'string'
              ? createElement(Text, { key: `s${i}` }, child)
              : child
          )
        : arr
  } else if (arr.length === 1) {
    const single = arr[0]
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
  markdown = '',
  options: NativeOptions = {}
): React.ReactNode {
  const opts = { ...(options || {}) }
  opts.overrides = opts.overrides || {}

  const _slug = opts.slugify || util.slugify
  const _sanitize = opts.sanitizer || util.sanitizer

  function compile(input: string): React.ReactNode {
    const inline =
      opts.forceInline ||
      !(opts.forceBlock || util.SHOULD_RENDER_AS_BLOCK_R.test(input))
    const parseOptions = parse.toParseOptions(opts)

    const processedInput = inline ? input : util.prepareBlockInput(input)

    const astNodes = parse.parseMarkdown(
      processedInput,
      { inline, refs },
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
  } = Object.create(null)

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
}> = ({ options, children }) =>
  React.createElement(MarkdownContext.Provider, { value: options }, children)

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
    var merged = { ...contextOptions, ...options }
    merged.styles = { ...contextOptions?.styles, ...options?.styles }
    merged.overrides = { ...contextOptions?.overrides, ...options?.overrides }
    merged.wrapperProps = {
      ...contextOptions?.wrapperProps,
      ...options?.wrapperProps,
      ...stableProps,
    } as ViewProps | TextProps
    return merged
  }, [contextOptions, options, stableProps])

  const content =
    rawChildren === null
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
