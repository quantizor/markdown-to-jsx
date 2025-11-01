// Re-export React for convenience since types reference it
import * as React from 'react'

/**
 * Analogous to `node.type`. Please note that the values here may change at any time,
 * so do not hard code against the value directly.
 */
const RuleTypeConst = {
  blockQuote: '0',
  breakLine: '1',
  breakThematic: '2',
  codeBlock: '3',
  codeFenced: '4',
  codeInline: '5',
  footnote: '6',
  footnoteReference: '7',
  gfmTask: '8',
  heading: '9',
  headingSetext: '10',
  htmlBlock: '11',
  htmlComment: '12',
  htmlSelfClosing: '13',
  image: '14',
  link: '15',
  linkAngleBraceStyleDetector: '16',
  linkBareUrlDetector: '17',
  linkMailtoDetector: '18',
  newlineCoalescer: '19',
  orderedList: '20',
  paragraph: '21',
  ref: '22',
  refImage: '23',
  refLink: '24',
  table: '25',
  tableSeparator: '26',
  text: '27',
  textEscaped: '28',
  textFormatted: '34',
  unorderedList: '30',
} as const

if (process.env.NODE_ENV === 'test') {
  Object.keys(RuleTypeConst).forEach(key => (RuleTypeConst[key] = key))
}

type RuleTypeValue = (typeof RuleTypeConst)[keyof typeof RuleTypeConst]

/**
 * markdown-to-jsx types and interfaces
 */
export namespace MarkdownToJSX {
  /**
   * RequireAtLeastOne<{ ... }> <- only requires at least one key
   */
  type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<
    T,
    Exclude<keyof T, Keys>
  > &
    {
      [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>
    }[Keys]

  export type CreateElement = typeof React.createElement

  export type HTMLTags = keyof React.JSX.IntrinsicElements

  export type State = {
    /** true if the current content is inside anchor link grammar */
    inAnchor?: boolean
    /** true if parsing in an HTML context */
    inHTML?: boolean
    /** true if parsing in an inline context (subset of rules around formatting and links) */
    inline?: boolean
    /** true if in a table */
    inTable?: boolean
    /** use this for the `key` prop */
    key?: React.Key
    /** true if in a list */
    list?: boolean
    /** used for lookbacks */
    prevCapture?: string
    preserveNewlines?: boolean
    /** footnotes collected during parsing */
    footnotes?: { footnote: string; identifier: string }[]
    /** reference definitions */
    refs?: { [key: string]: { target: string; title: string | undefined } }
    /** current recursion depth during rendering */
    renderDepth?: number
    /** true if parsing in inline context w/o links */
    simple?: boolean
  }

  export interface BlockQuoteNode {
    alert?: string
    children: MarkdownToJSX.ASTNode[]
    type: typeof RuleType.blockQuote
  }

  export interface BreakLineNode {
    type: typeof RuleType.breakLine
  }

  export interface BreakThematicNode {
    type: typeof RuleType.breakThematic
  }

  export interface CodeBlockNode {
    type: typeof RuleType.codeBlock
    attrs?: React.JSX.IntrinsicAttributes
    lang?: string
    text: string
  }

  export interface CodeFencedNode {
    type: typeof RuleType.codeFenced
  }

  export interface CodeInlineNode {
    type: typeof RuleType.codeInline
    text: string
  }

  export interface FootnoteNode {
    type: typeof RuleType.footnote
  }

  export interface FootnoteReferenceNode {
    type: typeof RuleType.footnoteReference
    target: string
    text: string
  }

  export interface GFMTaskNode {
    type: typeof RuleType.gfmTask
    completed: boolean
  }

  export interface HeadingNode {
    type: typeof RuleType.heading
    children: MarkdownToJSX.ASTNode[]
    id: string
    level: 1 | 2 | 3 | 4 | 5 | 6
  }

  export interface HeadingSetextNode {
    type: typeof RuleType.headingSetext
  }

  export interface HTMLCommentNode {
    type: typeof RuleType.htmlComment
    text: string
  }

  export interface ImageNode {
    type: typeof RuleType.image
    alt?: string
    target: string
    title?: string
  }

  export interface LinkNode {
    type: typeof RuleType.link
    children: MarkdownToJSX.ASTNode[]
    target: string | null
    title?: string
  }

  export interface LinkAngleBraceNode {
    type: typeof RuleType.linkAngleBraceStyleDetector
  }

  export interface LinkBareURLNode {
    type: typeof RuleType.linkBareUrlDetector
  }

  export interface LinkMailtoNode {
    type: typeof RuleType.linkMailtoDetector
  }

  export interface OrderedListNode {
    type: typeof RuleType.orderedList
    items: MarkdownToJSX.ASTNode[][]
    ordered: true
    start?: number
  }

  export interface UnorderedListNode {
    type: typeof RuleType.unorderedList
    items: MarkdownToJSX.ASTNode[][]
    ordered: false
  }

  export interface NewlineNode {
    type: typeof RuleType.newlineCoalescer
  }

  export interface ParagraphNode {
    type: typeof RuleType.paragraph
    children: MarkdownToJSX.ASTNode[]
  }

  export interface ReferenceNode {
    type: typeof RuleType.ref
  }

  export interface ReferenceImageNode {
    type: typeof RuleType.refImage
    alt?: string
    ref: string
  }

  export interface ReferenceLinkNode {
    type: typeof RuleType.refLink
    children: MarkdownToJSX.ASTNode[]
    fallbackChildren: string
    ref: string
  }

  export interface TableNode {
    type: typeof RuleType.table
    /**
     * alignment for each table column
     */
    align: ('left' | 'right' | 'center')[]
    cells: MarkdownToJSX.ASTNode[][][]
    header: MarkdownToJSX.ASTNode[][]
  }

  export interface TableSeparatorNode {
    type: typeof RuleType.tableSeparator
  }

  export interface TextNode {
    type: typeof RuleType.text
    text: string
  }

  export interface FormattedTextNode {
    type: typeof RuleType.textFormatted
    /**
     * the corresponding html tag
     */
    tag: string
    children: MarkdownToJSX.ASTNode[]
  }

  export interface EscapedTextNode {
    type: typeof RuleType.textEscaped
  }

  export interface HTMLNode {
    type: typeof RuleType.htmlBlock
    attrs: React.JSX.IntrinsicAttributes
    children?: ASTNode[] | undefined
    noInnerParse: Boolean
    tag: string
    text?: string | undefined
  }

  export interface HTMLSelfClosingNode {
    type: typeof RuleType.htmlSelfClosing
    attrs: React.JSX.IntrinsicAttributes
    tag: string
  }

  export type ASTNode =
    | BlockQuoteNode
    | BreakLineNode
    | BreakThematicNode
    | CodeBlockNode
    | CodeFencedNode
    | CodeInlineNode
    | FootnoteNode
    | FootnoteReferenceNode
    | GFMTaskNode
    | HeadingNode
    | HeadingSetextNode
    | HTMLCommentNode
    | ImageNode
    | LinkNode
    | LinkAngleBraceNode
    | LinkBareURLNode
    | LinkMailtoNode
    | OrderedListNode
    | UnorderedListNode
    | NewlineNode
    | ParagraphNode
    | ReferenceNode
    | ReferenceImageNode
    | ReferenceLinkNode
    | TableNode
    | TableSeparatorNode
    | TextNode
    | FormattedTextNode
    | EscapedTextNode
    | HTMLNode
    | HTMLSelfClosingNode

  export type ASTRender = (
    ast: MarkdownToJSX.ASTNode | MarkdownToJSX.ASTNode[],
    state: MarkdownToJSX.State
  ) => React.ReactNode

  export type Override =
    | RequireAtLeastOne<{
        component: React.ElementType
        props: Object
      }>
    | React.ElementType

  export type Overrides = {
    [tag in HTMLTags]?: Override
  } & {
    [customComponent: string]: Override
  }

  export type Options = Partial<{
    /**
     * When true, returns the parsed AST instead of rendered JSX.
     * Footnotes are not automatically appended; the consumer handles them.
     */
    ast: boolean

    /**
     * Ultimate control over the output of all rendered JSX.
     */
    createElement: (
      tag: Parameters<CreateElement>[0],
      props: React.JSX.IntrinsicAttributes,
      ...children: React.ReactNode[]
    ) => React.ReactNode

    /**
     * The library automatically generates an anchor tag for bare URLs included in the markdown
     * document, but this behavior can be disabled if desired.
     */
    disableAutoLink: boolean

    /**
     * Disable the compiler's best-effort transcription of provided raw HTML
     * into JSX-equivalent. This is the functionality that prevents the need to
     * use `dangerouslySetInnerHTML` in React.
     */
    disableParsingRawHTML: boolean

    /**
     * Forces the compiler to have space between hash sign and the header text which
     * is explicitly stated in the most of the markdown specs.
     * https://github.github.com/gfm/#atx-heading
     * `The opening sequence of # characters must be followed by a space or by the end of line.`
     */
    enforceAtxHeadings: boolean

    /**
     * Forces the compiler to always output content with a block-level wrapper
     * (`<p>` or any block-level syntax your markdown already contains.)
     */
    forceBlock: boolean

    /**
     * Forces the compiler to always output content with an inline wrapper (`<span>`)
     */
    forceInline: boolean

    /**
     * Forces the compiler to wrap results, even if there is only a single
     * child or no children.
     */
    forceWrapper: boolean

    /**
     * Supply additional HTML entity: unicode replacement mappings.
     *
     * Pass only the inner part of the entity as the key,
     * e.g. `&le;` -> `{ "le": "\u2264" }`
     *
     * By default
     * the following entities are replaced with their unicode equivalents:
     *
     * ```
     * &amp;
     * &apos;
     * &gt;
     * &lt;
     * &nbsp;
     * &quot;
     * ```
     */
    namedCodesToUnicode: {
      [key: string]: string
    }

    /**
     * Selectively control the output of particular HTML tags as they would be
     * emitted by the compiler.
     */
    overrides: Overrides

    /**
     * Allows for full control over rendering of particular rules.
     * For example, to implement a LaTeX renderer such as `react-katex`:
     *
     * ```
     * renderRule(next, node, renderChildren, state) {
     *   if (node.type === RuleType.codeBlock && node.lang === 'latex') {
     *     return (
     *       <TeX as="div" key={state.key}>
     *         {String.raw`${node.text}`}
     *       </TeX>
     *     )
     *   }
     *
     *   return next();
     * }
     * ```
     *
     * Thar be dragons obviously, but you can do a lot with this
     * (have fun!) To see how things work internally, check the `render`
     * method in source for a particular rule.
     */
    renderRule: (
      /** Resume normal processing, call this function as a fallback if you are not returning custom JSX. */
      next: () => React.ReactNode,
      /** the current AST node, use `RuleType` against `node.type` for identification */
      node: ASTNode,
      /** use as `renderChildren(node.children)` for block nodes */
      renderChildren: ASTRender,
      /** contains `key` which should be supplied to the topmost JSX element */
      state: State
    ) => React.ReactNode

    /**
     * Override the built-in sanitizer function for URLs, etc if desired. The built-in version is available as a library
     export called `sanitizer`.
     */
    sanitizer: (
      value: string,
      tag: HTMLTags,
      attribute: string
    ) => string | null

    /**
     * Override normalization of non-URI-safe characters for use in generating
     * HTML IDs for anchor linking purposes.
     */
    slugify: (input: string, defaultFn: (input: string) => string) => string

    /**
     * Declare the type of the wrapper to be used when there are multiple
     * children to render. Set to `null` to get an array of children back
     * without any wrapper, or use `React.Fragment` to get a React element
     * that won't show up in the DOM.
     */
    wrapper: React.ElementType | null

    /**
     * Props to apply to the wrapper element.
     */
    wrapperProps?: React.JSX.IntrinsicAttributes
  }>
}

export const RuleType = RuleTypeConst
export type RuleType = RuleTypeValue
