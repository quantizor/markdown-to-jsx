// Re-export React for convenience since types reference it
import * as React from 'react'

/**
 * Analogous to `node.type`. Please note that the values here may change at any time,
 * so do not hard code against the value directly.
 */
const RuleTypeConst = {
  blockQuote: 0,
  breakLine: 1,
  breakThematic: 2,
  codeBlock: 3,
  codeInline: 4,
  footnote: 5,
  footnoteReference: 6,
  frontmatter: 7,
  gfmTask: 8,
  heading: 9,
  htmlBlock: 10,
  htmlComment: 11,
  htmlSelfClosing: 12,
  image: 13,
  link: 14,
  orderedList: 15,
  paragraph: 16,
  ref: 17,
  refCollection: 18,
  table: 19,
  text: 20,
  textFormatted: 21,
  unorderedList: 22,
} as const

if (process.env.NODE_ENV === 'test') {
  // In test mode, use strings for better debugging
  Object.keys(RuleTypeConst).forEach(key => (RuleTypeConst[key] = key))
}

type RuleTypeValue = (typeof RuleTypeConst)[keyof typeof RuleTypeConst]

/**
 * markdown-to-jsx types and interfaces
 */
declare namespace MarkdownToJSX {
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

  export type HTMLTags = keyof React.JSX.IntrinsicElements & (string & {})

  export type State = {
    /** true if the current content is inside anchor link grammar */
    inAnchor?: boolean
    /** true if inside a blockquote */
    inBlockQuote?: boolean
    /** true if parsing in an HTML context */
    inHTML?: boolean
    /** true if in a list */
    inList?: boolean
    /** true if parsing in an inline context (subset of rules around formatting and links) */
    inline?: boolean

    /** use this for the `key` prop */
    key?: React.Key
    /** reference definitions (footnotes are stored with '^' prefix) */
    refs?: { [key: string]: { target: string; title: string | undefined } }
    /** current recursion depth during rendering */
    renderDepth?: number
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

  export interface FrontmatterNode {
    type: typeof RuleType.frontmatter
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

  export interface OrderedListNode {
    type: typeof RuleType.orderedList
    items: MarkdownToJSX.ASTNode[][]
    start?: number
  }

  export interface UnorderedListNode {
    type: typeof RuleType.unorderedList
    items: MarkdownToJSX.ASTNode[][]
  }

  export interface ParagraphNode {
    type: typeof RuleType.paragraph
    children: MarkdownToJSX.ASTNode[]
  }

  export interface ReferenceNode {
    type: typeof RuleType.ref
  }

  export interface ReferenceCollectionNode {
    type: typeof RuleType.refCollection
    refs: { [key: string]: { target: string; title: string | undefined } }
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

  export interface HTMLNode {
    type: typeof RuleType.htmlBlock
    attrs?: Record<string, any>
    children?: ASTNode[] | undefined
    noInnerParse?: Boolean
    tag: string
    text?: string | undefined
  }

  export interface HTMLSelfClosingNode {
    type: typeof RuleType.htmlSelfClosing
    attrs?: Record<string, any>
    isClosingTag?: boolean
    tag: string
  }

  export type ASTNode =
    | BlockQuoteNode
    | BreakLineNode
    | BreakThematicNode
    | CodeBlockNode
    | CodeInlineNode
    | FootnoteNode
    | FootnoteReferenceNode
    | FrontmatterNode
    | GFMTaskNode
    | HeadingNode
    | HTMLCommentNode
    | ImageNode
    | LinkNode
    | OrderedListNode
    | UnorderedListNode
    | ParagraphNode
    | ReferenceNode
    | ReferenceCollectionNode
    | TableNode
    | TextNode
    | FormattedTextNode
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
     * Enable GFM tagfilter extension to filter potentially dangerous HTML tags.
     * When enabled, the following tags are escaped: title, textarea, style, xmp,
     * iframe, noembed, noframes, script, plaintext.
     * https://github.github.com/gfm/#disallowed-raw-html-extension-
     * @default true
     */
    tagfilter?: boolean

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

    /**
     * Preserve frontmatter in the output by rendering it as a <pre> element.
     * By default, frontmatter is parsed but not rendered.
     * @default false
     */
    preserveFrontmatter?: boolean
  }>
}

export const RuleType: typeof RuleTypeConst = RuleTypeConst
export type RuleType = RuleTypeValue

export type RequireAtLeastOne<
  T,
  Keys extends keyof T = keyof T,
> = MarkdownToJSX.RequireAtLeastOne<T, Keys>

export { MarkdownToJSX }
