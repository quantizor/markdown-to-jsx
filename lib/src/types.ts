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

  /**
   * React.createElement function type
   */
  export type CreateElement = typeof React.createElement

  /**
   * HTML tag names that can be used in JSX
   */
  export type HTMLTags = keyof React.JSX.IntrinsicElements & (string & {})

  /**
   * Parser and renderer state
   */
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
    key?: string | number
    /** reference definitions (footnotes are stored with '^' prefix) */
    refs?: { [key: string]: { target: string; title: string } }
    /** current recursion depth during rendering */
    renderDepth?: number
    /** internal: block parse recursion depth */
    _depth?: number
    /** internal: disable setext heading detection (lazy blockquote continuation) */
    _noSetext?: boolean
    /** internal: HTML nesting depth for stack overflow protection */
    _htmlDepth?: number
    /** internal: set by collectReferenceDefinitions when input ends inside an unclosed fence */
    _endsInsideFence?: boolean
  }

  /**
   * Blockquote node in the AST
   */
  export interface BlockQuoteNode {
    /** Optional alert type (Note, Tip, Warning, etc.) */
    alert?: string
    /** Child nodes within the blockquote */
    children: MarkdownToJSX.ASTNode[]
    type: typeof RuleType.blockQuote
  }

  /**
   * Hard line break node
   */
  export interface BreakLineNode {
    type: typeof RuleType.breakLine
  }

  /**
   * Thematic break (horizontal rule) node
   */
  export interface BreakThematicNode {
    type: typeof RuleType.breakThematic
  }

  /**
   * Code block node (fenced code blocks)
   */
  export interface CodeBlockNode {
    type: typeof RuleType.codeBlock
    /** HTML attributes for the code block */
    attrs?: React.JSX.IntrinsicAttributes
    /** Programming language identifier */
    lang?: string
    /** Code content */
    text: string
  }

  /**
   * Inline code node
   */
  export interface CodeInlineNode {
    type: typeof RuleType.codeInline
    /** Code text */
    text: string
  }

  /**
   * Footnote definition node (not rendered, stored in refCollection)
   */
  export interface FootnoteNode {
    type: typeof RuleType.footnote
  }

  /**
   * Footnote reference node
   */
  export interface FootnoteReferenceNode {
    type: typeof RuleType.footnoteReference
    /** Link target (anchor) */
    target: string
    /** Display text */
    text: string
  }

  /**
   * YAML frontmatter node
   */
  export interface FrontmatterNode {
    type: typeof RuleType.frontmatter
    /** Frontmatter content */
    text: string
  }

  /**
   * GFM task list item node
   */
  export interface GFMTaskNode {
    type: typeof RuleType.gfmTask
    /** Whether the task is completed */
    completed: boolean
  }

  /**
   * Heading node
   */
  export interface HeadingNode {
    type: typeof RuleType.heading
    /** Child nodes (text content) */
    children: MarkdownToJSX.ASTNode[]
    /** Generated HTML ID for anchor linking */
    id: string
    /** Heading level (1-6) */
    level: 1 | 2 | 3 | 4 | 5 | 6
  }

  /**
   * HTML comment node
   */
  export interface HTMLCommentNode {
    type: typeof RuleType.htmlComment
    /** Comment text */
    text: string
  }

  /**
   * Image node
   */
  export interface ImageNode {
    type: typeof RuleType.image
    /** Alt text */
    alt?: string
    /** Image URL */
    target: string
    /** Title attribute */
    title?: string
  }

  /**
   * Link node
   */
  export interface LinkNode {
    type: typeof RuleType.link
    /** Child nodes (link text) */
    children: MarkdownToJSX.ASTNode[]
    /** Link URL (null for reference links without definition) */
    target: string | null
    /** Title attribute */
    title?: string
  }

  /**
   * Ordered list node
   */
  export interface OrderedListNode {
    type: typeof RuleType.orderedList
    /** Array of list items, each item is an array of nodes */
    items: MarkdownToJSX.ASTNode[][]
    /** Starting number for the list */
    start?: number
  }

  /**
   * Unordered list node
   */
  export interface UnorderedListNode {
    type: typeof RuleType.unorderedList
    /** Array of list items, each item is an array of nodes */
    items: MarkdownToJSX.ASTNode[][]
  }

  /**
   * Paragraph node
   */
  export interface ParagraphNode {
    type: typeof RuleType.paragraph
    /** Child nodes */
    children: MarkdownToJSX.ASTNode[]
  }

  /**
   * Reference definition node (not rendered, stored in refCollection)
   */
  export interface ReferenceNode {
    type: typeof RuleType.ref
  }

  /**
   * Reference collection node (appears at AST root, includes footnotes with '^' prefix)
   */
  export interface ReferenceCollectionNode {
    type: typeof RuleType.refCollection
    /** Map of reference labels to their definitions */
    refs: { [key: string]: { target: string; title: string } }
  }

  /**
   * Table node
   */
  export interface TableNode {
    type: typeof RuleType.table
    /**
     * alignment for each table column
     */
    align: ('left' | 'right' | 'center')[]
    /** Table cells (3D array: rows -> cells -> nodes) */
    cells: MarkdownToJSX.ASTNode[][][]
    /** Table header row */
    header: MarkdownToJSX.ASTNode[][]
  }

  /**
   * Plain text node
   */
  export interface TextNode {
    type: typeof RuleType.text
    /** Text content */
    text: string
  }

  /**
   * Formatted text node (bold, italic, etc.)
   */
  export interface FormattedTextNode {
    type: typeof RuleType.textFormatted
    /**
     * the corresponding html tag
     */
    tag: string
    /** Child nodes */
    children: MarkdownToJSX.ASTNode[]
  }

  /** @deprecated Use `FormattedTextNode` instead. */
  export type TextFormattedNode = FormattedTextNode

  /**
   * HTML block node (includes JSX components)
   */
  export interface HTMLNode {
    type: typeof RuleType.htmlBlock
    /** Parsed HTML attributes */
    attrs?: Record<string, any>
    /** Parsed child nodes (always parsed, even for verbatim blocks) */
    children?: ASTNode[] | undefined
    /** @internal Whether this is a closing tag */
    _isClosingTag?: boolean
    /** @internal Whether this is a verbatim block (script, style, pre, etc.) */
    _verbatim?: boolean
    /** @internal Original raw attribute string */
    _rawAttrs?: string
    /** @internal Original raw HTML content (for verbatim blocks) */
    _rawText?: string | undefined
    /** @deprecated Use `_rawText` instead. This property will be removed in a future major version. */
    text?: string | undefined
    /** HTML tag name */
    tag: string
  }

  /**
   * Self-closing HTML tag node
   */
  export interface HTMLSelfClosingNode {
    type: typeof RuleType.htmlSelfClosing
    /** Parsed HTML attributes */
    attrs?: Record<string, any>
    /** @internal Whether this is a closing tag */
    _isClosingTag?: boolean
    /** HTML tag name */
    tag: string
    /** @internal Original raw HTML content */
    _rawText?: string
  }

  /**
   * Union type of all possible AST node types
   */
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

  /**
   * Function type for rendering AST nodes
   */
  export type ASTRender = (
    ast: MarkdownToJSX.ASTNode | MarkdownToJSX.ASTNode[],
    state: MarkdownToJSX.State
  ) => React.ReactNode

  /**
   * Override configuration for HTML tags or custom components
   */
  export type Override =
    | RequireAtLeastOne<{
        component: React.ElementType
        props: Object
      }>
    | React.ElementType

  /**
   * Map of HTML tags and custom components to their override configurations
   */
  export type Overrides = {
    [tag in HTMLTags]?: Override
  } & {
    [customComponent: string]: Override
  }

  /**
   * Compiler options
   */
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
     * Disable frontmatter detection at the start of the document.
     * When enabled, `---` at position 0 will be parsed as a thematic break
     * instead of being treated as a YAML frontmatter delimiter.
     */
    disableFrontmatter: boolean

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
     * Disable the compiler's parsing of HTML blocks.
     */
    ignoreHTMLBlocks?: boolean

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
     * **⚠️ SECURITY WARNING: STRONGLY DISCOURAGED FOR USER INPUTS**
     *
     * When enabled, attempts to eval expressions in JSX props that cannot be serialized
     * as JSON (functions, variables, complex expressions). This uses `eval()` which can
     * execute arbitrary code.
     *
     * **ONLY use this option when:**
     * - The markdown source is completely trusted (e.g., your own documentation)
     * - You control all JSX components and their props
     * - The content is NOT user-generated or user-editable
     *
     * **DO NOT use this option when:**
     * - Processing user-submitted markdown
     * - Rendering untrusted content
     * - Building public-facing applications with user content
     *
     * Example unsafe input: `<Component onClick={() => fetch('/admin/delete-all')} />`
     *
     * When disabled (default), unserializable expressions remain as strings that can be
     * safely inspected or handled on a case-by-case basis via custom renderRule logic.
     *
     * @default false
     */
    evalUnserializableExpressions?: boolean

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
    sanitizer: (value: string, tag: string, attribute: string) => string | null

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

    /**
     * Optimize rendering for streaming scenarios where markdown content arrives
     * incrementally (e.g., from LLM APIs). When enabled, incomplete inline syntax
     * is suppressed to avoid displaying raw markdown characters while waiting
     * for the closing delimiter to arrive.
     *
     * Fenced code blocks render normally with content visible as it streams.
     *
     * @default false
     *
     * @example
     * ```tsx
     * // Streaming markdown example
     * function StreamingMarkdown({ content }) {
     *   return (
     *     <Markdown options={{ optimizeForStreaming: true }}>
     *       {content}
     *     </Markdown>
     *   )
     * }
     * ```
     */
    optimizeForStreaming?: boolean
  }>
}

export const RuleType: typeof RuleTypeConst = RuleTypeConst
export type RuleType = RuleTypeValue

export type RequireAtLeastOne<
  T,
  Keys extends keyof T = keyof T,
> = MarkdownToJSX.RequireAtLeastOne<T, Keys>

export { MarkdownToJSX }
