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
import * as $ from './constants'
import * as parse from './parse'
import { MarkdownToJSX, RuleType } from './types'
import * as util from './utils'

export { parser } from './parse'

export { RuleType, type MarkdownToJSX } from './types'
export { sanitizer, slugify } from './utils'

const LIST_ITEM_ROW_STYLE: ViewStyle = { flexDirection: 'row' }
// The content sits in a row beside the bullet/number, so it must flex to fill the
// remaining width: text then wraps instead of overflowing, and a block child (a
// table with flex columns) gets a bounded width to lay out within.
const LIST_ITEM_CONTENT_STYLE: ViewStyle = { flex: 1 }
// Top-align so the checkbox sits with the first line of a multi-line label; the
// checkbox's own marginTop then centers it against that line's text.
const GFM_TASK_ITEM_ROW_STYLE: ViewStyle = {
  alignItems: 'flex-start',
  flex: 1,
  flexDirection: 'row',
}
// Default drawn checkbox for a GFM task item, since React Native has no checkbox
// primitive: an outlined box that fills with an accent and a checkmark when done.
// The box is symmetric, so its centroid is its geometric center; the label's ink
// centroid sits ~4pt below the line's geometric center (measured on-device at DPR 3),
// so marginTop drops the box by that much to center it against the first line's text.
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
// Base table row layout. The checked-box accent, the checkmark glyph, the table
// grid dividers, and the bold header run are overridable DEFAULT_STYLES keys
// (gfmTaskChecked, checkmark, tableCellDivider, tableRowDivider, tableHeaderText);
// the per-compile StyledCache precombines the row-plus-divider array.
const TABLE_ROW_FLEX: ViewStyle = { flexDirection: 'row' }
// Platform monospace family for code, since React Native has no generic 'monospace' on iOS.
const MONOSPACE_FONT = Platform.select({
  android: 'monospace',
  ios: 'Menlo',
  default: 'monospace',
})

/**
 * Base stylesheet applied to rendered markdown so the default output has a
 * readable visual hierarchy (heading size cascade, monospace code, block
 * spacing, blockquote rule) without any configuration. Every key merges under
 * the caller's `styles`, so a consumer overrides individual properties or a whole
 * element, and layout-only defaults (list/task rows) stay separate. See the
 * React Native section of the README for a fully-overridden example.
 */
const DEFAULT_STYLES: NativeStyles = {
  blockquote: {
    borderLeftColor: '#d1d9e0',
    borderLeftWidth: 3,
    marginBottom: 16,
    paddingLeft: 16,
  },
  // translateY lifts the glyph off the box's optical center: the check reads a
  // touch low in the box otherwise. A transform shifts the rendered glyph without
  // disturbing the flex centering (unlike a margin, which the centering absorbs).
  checkmark: { color: '#ffffff', fontSize: 12, fontWeight: '700', lineHeight: 14, transform: [{ translateY: -1 }] },
  codeBlock: {
    backgroundColor: '#f6f8fa',
    borderRadius: 8,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  // Inline code reads as code by its monospace face alone; a background renders
  // as a blocky inline rectangle in React Native, which the clean default avoids.
  codeInline: { fontFamily: MONOSPACE_FONT, fontSize: 15 },
  gfmTaskChecked: { backgroundColor: '#0969da', borderColor: '#0969da' },
  heading1: { fontSize: 28, fontWeight: '600', lineHeight: 36, marginBottom: 12, marginTop: 8 },
  heading2: { fontSize: 22, fontWeight: '600', lineHeight: 30, marginBottom: 10, marginTop: 8 },
  heading3: { fontSize: 18, fontWeight: '600', lineHeight: 26, marginBottom: 8, marginTop: 8 },
  heading4: { fontSize: 16, fontWeight: '600', lineHeight: 24, marginBottom: 8, marginTop: 8 },
  heading5: { fontSize: 15, fontWeight: '600', marginBottom: 6, marginTop: 8 },
  heading6: { color: '#656d76', fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 8 },
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
  // Base applied under all text so body copy has one consistent size and line
  // height everywhere (list runs, bullets, table cells), matching paragraphs
  // instead of falling back to React Native's smaller default. This keeps a list
  // bullet the same size as its label, so it sits on the line rather than riding high.
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
/**
 * Convert digits to their Unicode superscript glyphs so a numeric footnote
 * marker renders as a real raised superscript, matching the <sup> the web
 * renderers emit. React Native cannot raise or relatively size inline text
 * through styles (verticalAlign and transforms are ignored on inline text), but
 * the superscript glyph is drawn small and raised by the font and scales with the
 * surrounding text on its own. Non-digit identifiers pass through unchanged.
 */
const toSuperscript = (text: string): string =>
  text.replace(/[0-9]/g, digit => SUPERSCRIPT_DIGITS[digit])
const TEXT_FORMAT_STYLES: Record<string, TextStyle> = {
  em: { fontStyle: 'italic' },
  strong: { fontWeight: 'bold' },
  del: { textDecorationLine: 'line-through' },
}

// Merge a default style with a user-supplied one. RN accepts a style array, so
// we return [default, user] when both exist; otherwise return whichever is set.
const mergeStyle = <T,>(d: T | undefined, u: T | undefined): T | T[] | undefined =>
  u ? (d ? [d, u] : u) : d

/**
 * Prepend the universal `styles.text` base under a Text element's own style so a
 * single consumer-supplied base (font, color, size) reaches every rendered Text
 * while element-specific styles still win on conflict. Returns the style
 * unchanged when no base is set, so the default output is untouched. Keeps the
 * result a flat one-level array so a downstream style read need not recurse.
 */
const withTextBase = (
  base: StyleProp<TextStyle> | undefined,
  style: StyleProp<TextStyle>
): StyleProp<TextStyle> =>
  base ? (Array.isArray(style) ? [base, ...style] : [base, style]) : style

const ZERO_MARGIN_BOTTOM: ViewStyle = { marginBottom: 0 }
/**
 * Zero the trailing block child's bottom margin so a bordered container (a
 * blockquote) ends flush instead of carrying that child's marginBottom as
 * apparent bottom padding. React Native does not drop a last-child margin the
 * way CSS does, so the last paragraph's block spacing otherwise sits inside the
 * container's border box.
 */
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

// Shared alignment styles so a table with many cells reuses three constants
// instead of allocating one object per cell.
const ALIGN_CENTER: ViewStyle = { alignItems: 'center' }
const ALIGN_LEFT: ViewStyle = { alignItems: 'flex-start' }
const ALIGN_RIGHT: ViewStyle = { alignItems: 'flex-end' }

/**
 * Map a column's markdown alignment to the React Native `alignItems` value that
 * positions its cell content, or null when the column has no explicit alignment.
 */
const alignItemsFor = (
  align: 'center' | 'left' | 'right' | undefined
): ViewStyle | null =>
  align == null
    ? null
    : align === 'center'
      ? ALIGN_CENTER
      : align === 'right'
        ? ALIGN_RIGHT
        : ALIGN_LEFT

/**
 * Merge the base stylesheet under the caller's styles: each element keeps its
 * default with the caller's properties winning on conflict, and a caller key with
 * no default passes through. The result feeds every `styles.<key>` lookup.
 */
const resolveStyles = (user?: NativeStyles): NativeStyles => {
  if (!user) return DEFAULT_STYLES
  const resolved = { ...DEFAULT_STYLES } as Record<string, unknown>
  const defaults = DEFAULT_STYLES as Record<string, unknown>
  const overrides = user as Record<string, unknown>
  for (const key in overrides) {
    resolved[key] = mergeStyle(defaults[key], overrides[key])
  }
  return resolved as NativeStyles
}

/**
 * Per-compile bundle of the resolved stylesheet plus every style value derived
 * from it (text-base merges, list row layouts, checkbox variants). All fields
 * are pure functions of the resolved styles, so computing them once per compile
 * replaces a per-node allocation on each hot render path with a lookup.
 */
interface StyledCache {
  /** Bullet Text style for unordered list items: text base under listItemBullet. */
  bulletText: StyleProp<TextStyle>
  /** Inline/block code text: text base under codeInline. */
  codeText: StyleProp<TextStyle>
  /** Footnote reference marker: text base under footnote. */
  footnoteText: StyleProp<TextStyle>
  /**
   * Lazy per-tag cache for textFormatted (em/strong/del/...): the merged host
   * style and its text-base variant, filled on first render of each tag.
   */
  formatted: Record<
    string,
    { host: StyleProp<TextStyle>; inline: StyleProp<TextStyle> }
  >
  /** Text-base merges for heading hosts, indexed by heading level (1-6). */
  headingInline: StyleProp<TextStyle>[]
  /** List item row: LIST_ITEM_ROW_STYLE under styles.li. */
  li: StyleProp<ViewStyle>
  /** Inline link host: text base under styles.link. */
  linkInline: StyleProp<TextStyle>
  /** List item content column: LIST_ITEM_CONTENT_STYLE under styles.listItem. */
  listContent: StyleProp<ViewStyle>
  /** Number Text style for ordered list items: text base under listItemNumber. */
  numberText: StyleProp<TextStyle>
  /** Inline paragraph host: text base under styles.paragraph. */
  paragraphInline: StyleProp<TextStyle>
  /** Verbatim pre-bearing HTML text: text base under styles.codeBlock. */
  preText: StyleProp<TextStyle>
  /** Table row layout plus the horizontal divider (styles.tableRowDivider). */
  rowFlexDivider: StyleProp<ViewStyle>
  /** The resolved per-key stylesheet feeding every `styles.<key>` lookup. */
  styles: NativeStyles
  /** Checked GFM task box: checkbox + checked accent under styles.gfmTask. */
  taskChecked: StyleProp<ViewStyle>
  /** GFM task item row: GFM_TASK_ITEM_ROW_STYLE under styles.listItem. */
  taskRow: StyleProp<ViewStyle>
  /** Unchecked GFM task box: checkbox outline under styles.gfmTask. */
  taskUnchecked: StyleProp<ViewStyle>
  /** Bare text base as applied by withTextBase (matches its output shape). */
  textOnly: StyleProp<TextStyle>
}

/**
 * Lazily built singleton for the zero-config case, so a compile without user
 * styles (the common Markdown-component path) skips rebuilding the cache.
 */
let DEFAULT_STYLED_CACHE: StyledCache | undefined

const buildStyledCache = (user?: NativeStyles): StyledCache => {
  if (!user) {
    return (
      DEFAULT_STYLED_CACHE || (DEFAULT_STYLED_CACHE = createStyledCache(user))
    )
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
    styles: styles,
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

/**
 * Whether a node renders entirely within React Native text layout: a string, or
 * a Text-host element whose descendants are all inline-safe too. A node that
 * resolves to an Image or a View (an image, a block element, a View-mapped HTML
 * tag) is not inline-safe: React Native forbids nesting a view under a text node
 * on Android, so such a node must render as its own child of a View rather than
 * inside a Text. The check recurses through inline containers (links, emphasis)
 * so a link or emphasis wrapping an image is itself treated as a block.
 */
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
      // Classify by the tag's native mapping so inline HTML (a <span> or <em>
      // within text) keeps flowing in a Text, while a View-mapped tag (div,
      // blockquote) stays a block. Recurse so a Text-mapped tag wrapping an
      // image is treated as a block.
      if (mapsToNativeView(node.tag)) return false
      return !node.children || node.children.every(isInlineSafe)
    default:
      // Everything else is block-level (paragraph, heading, list, table, code
      // block, thematic break) or an image: not inline-safe.
      return false
  }
}

/**
 * The text of a sole plain-text child, or null when the fast path does not
 * apply. A single text node renders to exactly its string, so the caller can
 * skip the renderer round trip (array wrap, key save/restore, result
 * collection) that would produce the same value. Gated off when a user
 * renderRule is present, since that contract passes every node through it.
 */
const singleTextChild = (
  nodes: MarkdownToJSX.ASTNode[],
  ctx: CompileContext
): string | null =>
  !ctx.options.renderRule &&
  nodes.length === 1 &&
  nodes[0].type === RuleType.text
    ? (nodes[0] as MarkdownToJSX.TextNode).text
    : null

/**
 * Render children for placement inside a React Native View. Consecutive
 * inline-safe nodes (text, emphasis, links, inline code) group into a single
 * Text so they lay out on one line; nodes that are not inline-safe (images,
 * paragraphs, nested lists, code blocks, task checkboxes) render as their own
 * child. React Native forbids bare strings directly inside a View, so ungrouped
 * text would otherwise throw "Text strings must be rendered within a <Text>
 * component" (issue #884). An optional runStyle styles the grouped Text runs so
 * a container's text style survives when it degrades from a Text to a View; the
 * universal text base (styled.styles.text) merges under those runs.
 */
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
  // Every run in this call shares one merged style, so compute it once here
  // rather than per flushed run; the bare-base case reuses the per-compile value.
  const runTextStyle =
    runStyle === undefined
      ? styled.textOnly
      : withTextBase(styled.styles.text, runStyle)
  const flushRun = () => {
    if (run.length) {
      const text = singleTextChild(run, ctx)
      if (text !== null) {
        children.push(h(Text, { key: key++, style: runTextStyle }, text))
        run = []
        return
      }
      // A run holds only inline-safe nodes, so mark the subtree inline-safe while
      // rendering it and restore, letting nested inline containers skip re-checking.
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
      // Wrap in a Fragment to carry the list key: output([node]) may return an
      // array, and the key belongs on a single sibling in the View's children.
      children.push(
        React.createElement(React.Fragment, { key: key++ }, output([node], state))
      )
    }
  }
  flushRun()
  return children
}

/**
 * Render an inline container (paragraph, heading, emphasis, or a Text-mapped HTML
 * tag) whose host element type is chosen from its content. When every child is
 * inline-safe it renders as the given Text-host tag using text layout. When a
 * child is a hard block (an image or a nested view), it renders as a View that
 * groups inline runs into Text and lays blocks out as siblings, carrying the
 * container's text style onto those runs so styling survives the switch.
 */
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
  // The nesting constraint only binds native Text: a custom override component
  // can hold any child, so an overridden tag is emitted as-is rather than
  // degraded to a View (which would discard the override).
  const overridden = !!overrides && !!util.get(overrides, tag, undefined)
  // A subtree already known inline-safe (this container sits inside one) needs no
  // re-derivation; otherwise decide it here. Deciding once at the top and
  // threading the result down turns O(depth) redundant subtree walks into one.
  const safe = state.inlineSafe === true || childNodes.every(isInlineSafe)
  if (overridden || safe) {
    // The caller precomputed inlineStyle (the text base under the host's own
    // style, usually once per compile), so swap it in place of the host style
    // rather than re-deriving and re-allocating props per node. props is a
    // per-node literal owned by this render, so the mutation is contained; the
    // identity guard keeps a style key from appearing when nothing merges.
    if (inlineStyle !== props.style) props.style = inlineStyle
    const text = singleTextChild(childNodes, ctx)
    if (text !== null) return h(tag, props, text)
    // Mark the subtree inline-safe around the recursive render so nested inline
    // containers skip their own check, then restore, matching how the renderer
    // saves and restores state.key.
    const prev = state.inlineSafe
    state.inlineSafe = safe
    const out = h(tag, props, output(childNodes, state))
    state.inlineSafe = prev
    return out
  }
  // Forward the full props (which already carry key and style) so a Text-mapped
  // HTML tag's attributes survive the switch to a View, matching the inline path.
  // The text style also styles the grouped runs so it survives the degrade, with
  // the universal text base merged under them.
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


/**
 * Everything a compile pass shares across every rendered node: the element
 * factory, resolved options, sanitizers, reference definitions, and the
 * per-compile style cache. Built once in astToNative so the per-node render
 * call carries one pointer instead of re-deriving any of it.
 */
interface CompileContext {
  h: (tag: any, props: any, ...children: any[]) => any
  options: NativeOptions
  /**
   * User overrides, or undefined when none are set, so per-node override
   * lookups short-circuit on the empty case.
   */
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
          style: styled.footnoteText,
        },
        toSuperscript(footnoteNode.text)
      )
    }

    case RuleType.gfmTask: {
      const taskNode = node as MarkdownToJSX.GFMTaskNode
      // An overridden 'input' owns the visual, so pass the DOM-only props
      // (type/checked/readOnly) plus a text marker child it can fall back to.
      // Without an override, attaching those props to the RN View fallback would
      // log unknown-prop warnings, so the default instead draws a checkbox.
      const hasInputOverride = !!(overrides && overrides.input)
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
      if (options.tagfilter && util.shouldFilterTag(htmlNode.tag)) {
        const tagText =
          typeof htmlNode._rawText === 'string'
            ? htmlNode._rawText
            : `<${htmlNode.tag}>`
        return h(
          Text,
          { key: state.key, style: styled.textOnly },
          tagText
        )
      }

      if (htmlNode._rawText && htmlNode._verbatim) {
        const tagLower = (htmlNode.tag as string).toLowerCase()
        const isType1Block = parse.isType1Block(tagLower)

        // Type 1 blocks (pre, script, style, textarea) always render verbatim.
        // These tags map to a native View, so the verbatim text is wrapped in a
        // Text rather than placed directly inside the View (issue #884).
        if (isType1Block) {
          const textContent = util.type1TextContent(
            htmlNode._rawText,
            tagLower,
            options.tagfilter
          )
          // Verbatim text renders monospaced (codeInline) so raw markup keeps
          // its literal shape, as a pre or code block reads.
          return h(
            htmlNode.tag,
            { key: state.key, ...util.htmlAttrsToJSXProps(htmlNode.attrs) },
            h(Text, { style: styled.codeText }, textContent)
          )
        }

        if (/<\/?pre\b/i.test(htmlNode._rawText)) {
          const innerHtml = options.tagfilter
            ? util.applyTagFilterToText(htmlNode._rawText)
            : htmlNode._rawText
          return h(
            Text,
            { key: state.key, style: styled.preText },
            innerHtml
          )
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
          slugify: (input: string) => ctx.slug(input, util.slugify),
          sanitizer: sanitize,
          tagfilter: true,
        }
        const astNodes = parse.parseMarkdown(
          cleanedText,
          { inline: false, refs: ctx.refs, inHTML: false },
          parseOptions
        )
        util.stripVerbatim(astNodes)

        // rawText already contains its own wrapper element, so emit the parsed
        // nodes directly instead of nesting them in another copy of the tag. Their
        // own render pass keys them from 0, ignoring this block's index, so the
        // first re-parsed node (key 0) would collide with the first sibling of
        // this block. Re-key a single result to this node's index; carry multiple
        // on a Fragment so their 0-based keys stay scoped under one keyed sibling.
        if (util.isFullVerbatimBlock(cleanedText, htmlNode.tag as string)) {
          const rendered = output(astNodes.flatMap(util.processVerbatimNode), state)
          if (Array.isArray(rendered)) {
            return React.createElement(React.Fragment, { key: state.key }, rendered)
          }
          return React.isValidElement(rendered)
            ? React.cloneElement(rendered, { key: state.key })
            : rendered
        }

        const split = util.findOwnCloseInAST(astNodes, tagLower)
        if (split.found && split.afterClose.length > 0) {
          // The element (keyed state.key) and the trailing siblings (renderViewChildren
          // keys its children from 0) share one Fragment, so re-key the trailing
          // siblings into a disjoint namespace to keep the Fragment's keys unique.
          const trailing = renderViewChildren(
            split.afterClose.flatMap(util.processVerbatimNode),
            output,
            state,
            undefined,
            ctx
          ).map((element, index) =>
            React.isValidElement(element)
              ? React.cloneElement(element, { key: 'after-' + index })
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

      if (util.isVoidElement(htmlNode.tag)) {
        return h(htmlNode.tag, { key: state.key, ...util.htmlAttrsToJSXProps(htmlNode.attrs) })
      }
      return htmlNode.children
        ? emitHtmlElement(
            htmlNode.tag,
            { key: state.key, ...util.htmlAttrsToJSXProps(htmlNode.attrs) },
            htmlNode.children,
            output,
            state,
            ctx
          )
        : h(htmlNode.tag, { key: state.key, ...util.htmlAttrsToJSXProps(htmlNode.attrs) })
    }

    case RuleType.htmlSelfClosing: {
      const htmlNode = node as MarkdownToJSX.HTMLSelfClosingNode
      if (options.tagfilter && util.shouldFilterTag(htmlNode.tag)) {
        const tagText =
          typeof htmlNode._rawText === 'string'
            ? htmlNode._rawText
            : `<${htmlNode.tag} />`
        return h(
          Text,
          { key: state.key, style: styled.textOnly },
          tagText
        )
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
      const linkStyle = styles.link
      // A link whose content is inline stays a Text (with text-layout press
      // handling). When it wraps an image or other block, a Text cannot hold it,
      // so it becomes a Pressable View that keeps the same press handlers.
      // Deciding first lets one props literal carry the right (precomputed)
      // style instead of re-merging the text base per link.
      const safe =
        state.inlineSafe === true || linkNode.children.every(isInlineSafe)
      const props: Record<string, unknown> = {
        key: state.key,
        style: safe ? styled.linkInline : linkStyle,
      }

      if (linkNode.target != null) {
        const url = util.encodeUrlTarget(linkNode.target)
        props.onPress = () => {
          options.onLinkPress
            ? options.onLinkPress(url, linkNode.title)
            : Linking.openURL(url).catch(() => {})
        }
        const onLinkLongPress = options.onLinkLongPress
        if (onLinkLongPress) {
          props.onLongPress = () => onLinkLongPress(url, linkNode.title)
        }
      }

      if (safe) {
        const text = singleTextChild(linkNode.children, ctx)
        if (text !== null) return h('a', props, text)
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
          // The header row carries the separator under it (borderBottom); each
          // cell but the last carries a vertical divider (borderRight). Header
          // runs render bold. Together with flex:1 cells the columns line up as a
          // grid without doubling the outer border.
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
                    // Each body row but the last carries a separator under it, so
                    // no line doubles the header separator or the outer border.
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
      // The tag set is small (em/strong/del/...), so the merged host style and
      // its text-base variant are cached per compile on first use.
      var formatted = styled.formatted[formattedNode.tag]
      if (formatted === undefined) {
        var host = mergeStyle(
          TEXT_FORMAT_STYLES[formattedNode.tag],
          styles[formattedNode.tag as NativeStyleKey] as TextStyle | undefined
        )
        formatted = styled.formatted[formattedNode.tag] = {
          host: host,
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
      // One shared props object serves every bullet Text in this list;
      // createElement never mutates the config it is handed.
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

          // When an item begins with a GFM task marker, the marker and label
          // are sibling AST nodes. The inner wrapper opts into a row that
          // top-aligns the checkbox with the first line of the label by default;
          // styles.listItem (when provided) still wins on collision via
          // mergeStyle's [default, user] ordering.
          const itemIsTask =
            item.length > 0 && item[0].type === RuleType.gfmTask
          const innerItemStyle = itemIsTask
            ? styled.taskRow
            : styled.listContent

          // The task marker is followed by a whitespace-only text node (the space
          // after `[ ]`). Drop it so the checkbox's marginRight is the sole gap to
          // the label, matching a bullet's spacing instead of doubling it.
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
            // A task item's checkbox stands in for the bullet, so the bullet is
            // suppressed to avoid a redundant marker beside the checkbox.
            itemIsTask
              ? null
              : h(Text, bulletProps, bullet + ' '),
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
    if (depth > 2500) return handleStackOverflow(nodes)
    state.renderDepth = depth

    const oldKey = state.key,
      result: React.ReactNode[] = []
    let lastWasString = false
    for (let i = 0; i < nodes.length; i++) {
      state.key = i
      let nodeOut: React.ReactNode
      // The renderer itself satisfies the ASTRender contract render() consumes
      // (single node or list, explicit state), so the no-renderRule hot path
      // calls render directly with no per-node closures; the closure form only
      // exists to hand a user renderRule its deferred defaultRender.
      if (userRender) {
        const currentNode = nodes[i]
        nodeOut = userRender(
          () => render(currentNode, renderer, state, ctx),
          currentNode,
          renderer,
          state
        )
      } else {
        nodeOut = render(nodes[i], renderer, state, ctx)
      }
      const isString = typeof nodeOut === 'string'
      if (lastWasString && typeof nodeOut === 'string') {
        const last = result[result.length - 1]
        result[result.length - 1] =
          (typeof last === 'string' ? last : '') + nodeOut
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

/**
 * Resolve a tag through user overrides. Returns the override component when
 * one applies, otherwise the tag string unchanged; arbitrary HTML tag strings
 * flow through and are mapped to native components by the caller.
 */
const getTag = (
  tag: string,
  overrides?: MarkdownToJSX.Overrides
): React.ComponentType<any> | string => {
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
/**
 * HTML tags that render as a native View (block layout) rather than a Text.
 * This is a React Native rendering concern, deliberately separate from the
 * CommonMark HTML-block tag list in parse.ts (BLOCK_TAGS): that list drives
 * block parsing and includes document/metadata tags (head, html, title, base,
 * col, ...) that must never become Views, plus paragraph and heading tags
 * handled here as semantic nodes. This list instead names the block containers
 * that need View layout and adds `input`, so the two overlap but neither is
 * derivable from the other.
 */
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

/**
 * Whether an HTML tag renders as a native View. A View cannot hold bare strings,
 * so its inline children must be grouped into a Text (see renderViewChildren).
 * Type 1 blocks (pre, script, style, textarea) map to a View as well.
 */
const mapsToNativeView = (tag: string): boolean => {
  const tagLower = tag.toLowerCase()
  return VIEW_TAGS.has(tagLower) || parse.isType1Block(tagLower)
}

/**
 * Memo for mapHTMLTagToNativeComponent, keyed by the raw tag string. The
 * mapping is a pure function of the tag, so one process-wide cache serves every
 * compile; the size cap bounds memory against pathological input that mints
 * unique tag spellings, falling back to recomputation once full.
 */
const NATIVE_COMPONENT_CACHE: Map<string, React.ElementType> = new Map()

/**
 * Map an HTML tag to its React Native component. React Native has no arbitrary
 * HTML tags, so img becomes an Image, a View-mapped tag becomes a View, and
 * every other tag becomes a Text. Derives its View decision from mapsToNativeView
 * so the two stay a single source of truth. Every rendered element passes
 * through this on the h() hot path, hence the memo over the repeated
 * lowercase-and-lookup work.
 */
const mapHTMLTagToNativeComponent = (tag: string): React.ElementType => {
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

/**
 * Emit an HTML element, routing by whether its tag maps to a native View. A
 * View-mapped tag groups its inline children into a Text so no bare string sits
 * directly inside the View; a Text-mapped tag (span, em, ...) goes through
 * renderInlineHost, receiving children unchanged since strings are valid there.
 * See issue #884.
 */
const emitHtmlElement = (
  tag: string,
  props: Record<string, unknown> & { style?: StyleProp<TextStyle> },
  childNodes: MarkdownToJSX.ASTNode[],
  output: MarkdownToJSX.ASTRender,
  state: MarkdownToJSX.State,
  ctx: CompileContext
): React.ReactNode =>
  mapsToNativeView(tag)
    ? ctx.h(
        tag,
        props,
        ...renderViewChildren(childNodes, output, state, undefined, ctx)
      )
    : renderInlineHost(
        tag,
        props,
        // HTML attrs rarely carry a style, so the text-base merge happens here
        // per element rather than from the per-compile cache.
        withTextBase(ctx.styled.styles.text, props.style),
        childNodes,
        output,
        state,
        ctx
      )

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
    optimizeForStreaming: opts.optimizeForStreaming,
  }

  const refs =
    ast[0] && ast[0].type === RuleType.refCollection
      ? (ast[0] as MarkdownToJSX.ReferenceCollectionNode).refs
      : {}

  const ctx: CompileContext = {
    h: h,
    options: opts,
    overrides: hasOverrides ? opts.overrides : undefined,
    refs: refs,
    sanitize: sanitize,
    slug: slug,
    styled: buildStyledCache(opts.styles),
  }
  const emitter = createRenderer(ctx)

  const emitted = emitter(ast, {
    inline: opts.forceInline,
    refs: refs,
  })
  const arr: React.ReactNode[] = Array.isArray(emitted) ? emitted : [emitted]

  const footnoteEntries = util.extractFootnoteEntries(refs)

  if (footnoteEntries.length) {
    // The universal text base (styles.text) also reaches the footnote footer, so
    // its identifier prefix and block-fallback runs match the rest of the output.
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
            { inline: true, refs: refs },
            parseOptions
          )
          // parseMarkdown prepends a non-rendering refCollection node; drop it so
          // the inline check reflects only the visible content.
          const renderable = footnoteAstNodes.filter(
            node => node.type !== RuleType.refCollection
          )
          // The identifier and the note read as one line, so when the note is all
          // inline it flows inside a single Text after the identifier. A note that
          // holds a block (an image) falls back to stacking the identifier above
          // grouped children, since a Text cannot nest a view (issue #884).
          if (renderable.every(isInlineSafe)) {
            return createElement(
              Text,
              { key: def.identifier, style: footnoteTextBase },
              identifierWithoutCaret + ': ',
              emitter(renderable, { inline: true, refs: refs })
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
              identifierWithoutCaret + ': '
            ),
            ...renderViewChildren(
              footnoteAstNodes,
              emitter,
              { inline: true, refs: refs },
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
    // A View wrapper cannot hold bare strings; wrap any stray top-level string
    // so a node that emitted raw text (e.g. a full verbatim HTML block) does not
    // crash React Native (issue #884). A Text wrapper accepts strings as-is.
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
      optimizeForStreaming: opts.optimizeForStreaming,
    }

    let processedInput = inline ? input : util.prepareBlockInput(input)

    // While streaming, drop a trailing unterminated HTML tag so a half-arrived
    // "<div" does not re-parse into runaway structure between tokens.
    if (opts.optimizeForStreaming) {
      const lastLt = processedInput.lastIndexOf('<')
      if (lastLt !== -1 && processedInput.indexOf('>', lastLt) === -1) {
        processedInput = processedInput.slice(0, lastLt)
      }
    }

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
