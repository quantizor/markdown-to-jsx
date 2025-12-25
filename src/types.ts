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
 * @lang zh markdown-to-jsx 类型和接口
 * @lang hi markdown-to-jsx प्रकार और इंटरफ़ेस
 */
declare namespace MarkdownToJSX {
  /**
   * RequireAtLeastOne<{ ... }> <- only requires at least one key
   * @lang zh RequireAtLeastOne<{ ... }> <- 只需要至少一个键
   * @lang hi RequireAtLeastOne<{ ... }> <- केवल कम से कम एक कुंजी की आवश्यकता है
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
   * @lang zh React.createElement 函数类型
   * @lang hi React.createElement फ़ंक्शन प्रकार
   */
  export type CreateElement = typeof React.createElement

  /**
   * HTML tag names that can be used in JSX
   * @lang zh 可在 JSX 中使用的 HTML 标签名称
   * @lang hi HTML टैग नाम जो JSX में उपयोग किए जा सकते हैं
   */
  export type HTMLTags = keyof React.JSX.IntrinsicElements & (string & {})

  /**
   * Parser and renderer state
   * @lang zh 解析器和渲染器状态
   * @lang hi पार्सर और रेंडरर स्थिति
   */
  export type State = {
    /** true if the current content is inside anchor link grammar */
    /** @lang zh 如果当前内容在锚点链接语法内，则为 true */
    /** @lang hi true यदि वर्तमान सामग्री एंकर लिंक व्याकरण के अंदर है */
    inAnchor?: boolean
    /** true if inside a blockquote */
    /** @lang zh 如果在引用块内，则为 true */
    /** @lang hi true यदि ब्लॉककोट के अंदर है */
    inBlockQuote?: boolean
    /** true if parsing in an HTML context */
    /** @lang zh 如果在 HTML 上下文中解析，则为 true */
    /** @lang hi true यदि HTML संदर्भ में पार्स कर रहे हैं */
    inHTML?: boolean
    /** true if in a list */
    /** @lang zh 如果在列表中，则为 true */
    /** @lang hi true यदि सूची में है */
    inList?: boolean
    /** true if parsing in an inline context (subset of rules around formatting and links) */
    /** @lang zh 如果在内联上下文中解析（围绕格式和链接的规则子集），则为 true */
    /** @lang hi true यदि इनलाइन संदर्भ में पार्स कर रहे हैं (फ़ॉर्मेटिंग और लिंक के आसपास के नियमों का उपसमुच्चय) */
    inline?: boolean

    /** use this for the `key` prop */
    /** @lang zh 用于 `key` 属性 */
    /** @lang hi `key` prop के लिए इसका उपयोग करें */
    key?: string | number
    /** reference definitions (footnotes are stored with '^' prefix) */
    /** @lang zh 引用定义（脚注以 '^' 前缀存储） */
    /** @lang hi संदर्भ परिभाषाएं (फ़ुटनोट्स '^' उपसर्ग के साथ संग्रहीत हैं) */
    refs?: { [key: string]: { target: string; title: string | undefined } }
    /** current recursion depth during rendering */
    /** @lang zh 渲染期间的当前递归深度 */
    /** @lang hi रेंडरिंग के दौरान वर्तमान पुनरावृत्ति गहराई */
    renderDepth?: number
  }

  /**
   * Blockquote node in the AST
   * @lang zh AST 中的引用块节点
   * @lang hi AST में ब्लॉककोट नोड
   */
  export interface BlockQuoteNode {
    /** Optional alert type (Note, Tip, Warning, etc.) */
    /** @lang zh 可选的警告类型 (Note, Tip, Warning 等) */
    /** @lang hi वैकल्पिक अलर्ट प्रकार (Note, Tip, Warning, आदि) */
    alert?: string
    /** Child nodes within the blockquote */
    /** @lang zh 引用块中的子节点 */
    /** @lang hi ब्लॉककोट के भीतर चाइल्ड नोड्स */
    children: MarkdownToJSX.ASTNode[]
    type: typeof RuleType.blockQuote
  }

  /**
   * Hard line break node
   * @lang zh 硬换行节点
   * @lang hi हार्ड लाइन ब्रेक नोड
   */
  export interface BreakLineNode {
    type: typeof RuleType.breakLine
  }

  /**
   * Thematic break (horizontal rule) node
   * @lang zh 分隔线（水平线）节点
   * @lang hi थीमैटिक ब्रेक (क्षैतिज नियम) नोड
   */
  export interface BreakThematicNode {
    type: typeof RuleType.breakThematic
  }

  /**
   * Code block node (fenced code blocks)
   * @lang zh 代码块节点（围栏代码块）
   * @lang hi कोड ब्लॉक नोड (फ़ेंस्ड कोड ब्लॉक्स)
   */
  export interface CodeBlockNode {
    type: typeof RuleType.codeBlock
    /** HTML attributes for the code block */
    /** @lang zh 代码块的 HTML 属性 */
    /** @lang hi कोड ब्लॉक के लिए HTML एट्रिब्यूट्स */
    attrs?: React.JSX.IntrinsicAttributes
    /** Programming language identifier */
    /** @lang zh 编程语言标识符 */
    /** @lang hi प्रोग्रामिंग भाषा पहचानकर्ता */
    lang?: string
    /** Code content */
    /** @lang zh 代码内容 */
    /** @lang hi कोड सामग्री */
    text: string
  }

  /**
   * Inline code node
   * @lang zh 内联代码节点
   * @lang hi इनलाइन कोड नोड
   */
  export interface CodeInlineNode {
    type: typeof RuleType.codeInline
    /** Code text */
    /** @lang zh 代码文本 */
    /** @lang hi कोड टेक्स्ट */
    text: string
  }

  /**
   * Footnote definition node (not rendered, stored in refCollection)
   * @lang zh 脚注定义节点（不渲染，存储在 refCollection 中）
   * @lang hi फ़ुटनोट परिभाषा नोड (रेंडर नहीं किया गया, refCollection में संग्रहीत)
   */
  export interface FootnoteNode {
    type: typeof RuleType.footnote
  }

  /**
   * Footnote reference node
   * @lang zh 脚注引用节点
   * @lang hi फ़ुटनोट संदर्भ नोड
   */
  export interface FootnoteReferenceNode {
    type: typeof RuleType.footnoteReference
    /** Link target (anchor) */
    /** @lang zh 链接目标（锚点） */
    /** @lang hi लिंक लक्ष्य (एंकर) */
    target: string
    /** Display text */
    /** @lang zh 显示文本 */
    /** @lang hi प्रदर्शन टेक्स्ट */
    text: string
  }

  /**
   * YAML frontmatter node
   * @lang zh YAML 前置元数据节点
   * @lang hi YAML फ्रंटमैटर नोड
   */
  export interface FrontmatterNode {
    type: typeof RuleType.frontmatter
    /** Frontmatter content */
    /** @lang zh 前置元数据内容 */
    /** @lang hi फ्रंटमैटर सामग्री */
    text: string
  }

  /**
   * GFM task list item node
   * @lang zh GFM 任务列表项节点
   * @lang hi GFM टास्क लिस्ट आइटम नोड
   */
  export interface GFMTaskNode {
    type: typeof RuleType.gfmTask
    /** Whether the task is completed */
    /** @lang zh 任务是否已完成 */
    /** @lang hi क्या टास्क पूर्ण है */
    completed: boolean
  }

  /**
   * Heading node
   * @lang zh 标题节点
   * @lang hi हेडिंग नोड
   */
  export interface HeadingNode {
    type: typeof RuleType.heading
    /** Child nodes (text content) */
    /** @lang zh 子节点（文本内容） */
    /** @lang hi चाइल्ड नोड्स (टेक्स्ट सामग्री) */
    children: MarkdownToJSX.ASTNode[]
    /** Generated HTML ID for anchor linking */
    /** @lang zh 用于锚点链接的生成的 HTML ID */
    /** @lang hi एंकर लिंकिंग के लिए जेनरेट किया गया HTML ID */
    id: string
    /** Heading level (1-6) */
    /** @lang zh 标题级别 (1-6) */
    /** @lang hi हेडिंग स्तर (1-6) */
    level: 1 | 2 | 3 | 4 | 5 | 6
  }

  /**
   * HTML comment node
   * @lang zh HTML 注释节点
   * @lang hi HTML कमेंट नोड
   */
  export interface HTMLCommentNode {
    type: typeof RuleType.htmlComment
    /** Comment text */
    /** @lang zh 注释文本 */
    /** @lang hi कमेंट टेक्स्ट */
    text: string
  }

  /**
   * Image node
   * @lang zh 图像节点
   * @lang hi छवि नोड
   */
  export interface ImageNode {
    type: typeof RuleType.image
    /** Alt text */
    /** @lang zh 替代文本 */
    /** @lang hi Alt टेक्स्ट */
    alt?: string
    /** Image URL */
    /** @lang zh 图像 URL */
    /** @lang hi छवि URL */
    target: string
    /** Title attribute */
    /** @lang zh 标题属性 */
    /** @lang hi शीर्षक एट्रिब्यूट */
    title?: string
  }

  /**
   * Link node
   * @lang zh 链接节点
   * @lang hi लिंक नोड
   */
  export interface LinkNode {
    type: typeof RuleType.link
    /** Child nodes (link text) */
    /** @lang zh 子节点（链接文本） */
    /** @lang hi चाइल्ड नोड्स (लिंक टेक्स्ट) */
    children: MarkdownToJSX.ASTNode[]
    /** Link URL (null for reference links without definition) */
    /** @lang zh 链接 URL（对于没有定义的引用链接为 null） */
    /** @lang hi लिंक URL (परिभाषा के बिना संदर्भ लिंक के लिए null) */
    target: string | null
    /** Title attribute */
    /** @lang zh 标题属性 */
    /** @lang hi शीर्षक एट्रिब्यूट */
    title?: string
  }

  /**
   * Ordered list node
   * @lang zh 有序列表节点
   * @lang hi क्रमबद्ध सूची नोड
   */
  export interface OrderedListNode {
    type: typeof RuleType.orderedList
    /** Array of list items, each item is an array of nodes */
    /** @lang zh 列表项数组，每个项是节点数组 */
    /** @lang hi सूची आइटम्स की सरणी, प्रत्येक आइटम नोड्स की एक सरणी है */
    items: MarkdownToJSX.ASTNode[][]
    /** Starting number for the list */
    /** @lang zh 列表的起始编号 */
    /** @lang hi सूची के लिए प्रारंभिक संख्या */
    start?: number
  }

  /**
   * Unordered list node
   * @lang zh 无序列表节点
   * @lang hi अक्रमबद्ध सूची नोड
   */
  export interface UnorderedListNode {
    type: typeof RuleType.unorderedList
    /** Array of list items, each item is an array of nodes */
    /** @lang zh 列表项数组，每个项是节点数组 */
    /** @lang hi सूची आइटम्स की सरणी, प्रत्येक आइटम नोड्स की एक सरणी है */
    items: MarkdownToJSX.ASTNode[][]
  }

  /**
   * Paragraph node
   * @lang zh 段落节点
   * @lang hi पैराग्राफ नोड
   */
  export interface ParagraphNode {
    type: typeof RuleType.paragraph
    /** Child nodes */
    /** @lang zh 子节点 */
    /** @lang hi चाइल्ड नोड्स */
    children: MarkdownToJSX.ASTNode[]
  }

  /**
   * Reference definition node (not rendered, stored in refCollection)
   * @lang zh 引用定义节点（不渲染，存储在 refCollection 中）
   * @lang hi संदर्भ परिभाषा नोड (रेंडर नहीं किया गया, refCollection में संग्रहीत)
   */
  export interface ReferenceNode {
    type: typeof RuleType.ref
  }

  /**
   * Reference collection node (appears at AST root, includes footnotes with '^' prefix)
   * @lang zh 引用集合节点（出现在 AST 根部，包括以 '^' 前缀的脚注）
   * @lang hi संदर्भ संग्रह नोड (AST रूट पर दिखाई देता है, '^' उपसर्ग के साथ फ़ुटनोट्स शामिल हैं)
   */
  export interface ReferenceCollectionNode {
    type: typeof RuleType.refCollection
    /** Map of reference labels to their definitions */
    /** @lang zh 引用标签到其定义的映射 */
    /** @lang hi संदर्भ लेबल्स से उनकी परिभाषाओं का मैप */
    refs: { [key: string]: { target: string; title: string | undefined } }
  }

  /**
   * Table node
   * @lang zh 表格节点
   * @lang hi टेबल नोड
   */
  export interface TableNode {
    type: typeof RuleType.table
    /**
     * alignment for each table column
     * @lang zh 每个表格列的对齐方式
     * @lang hi प्रत्येक टेबल कॉलम के लिए संरेखण
     */
    align: ('left' | 'right' | 'center')[]
    /** Table cells (3D array: rows -> cells -> nodes) */
    /** @lang zh 表格单元格（三维数组：行 -> 单元格 -> 节点） */
    /** @lang hi टेबल सेल्स (3D सरणी: पंक्तियाँ -> सेल्स -> नोड्स) */
    cells: MarkdownToJSX.ASTNode[][][]
    /** Table header row */
    /** @lang zh 表格标题行 */
    /** @lang hi टेबल हेडर पंक्ति */
    header: MarkdownToJSX.ASTNode[][]
  }

  /**
   * Plain text node
   * @lang zh 纯文本节点
   * @lang hi सादा टेक्स्ट नोड
   */
  export interface TextNode {
    type: typeof RuleType.text
    /** Text content */
    /** @lang zh 文本内容 */
    /** @lang hi टेक्स्ट सामग्री */
    text: string
  }

  /**
   * Formatted text node (bold, italic, etc.)
   * @lang zh 格式化文本节点（加粗、斜体等）
   * @lang hi फ़ॉर्मेट किया गया टेक्स्ट नोड (बोल्ड, इटैलिक, आदि)
   */
  export interface FormattedTextNode {
    type: typeof RuleType.textFormatted
    /**
     * the corresponding html tag
     * @lang zh 对应的 HTML 标签
     * @lang hi संबंधित HTML टैग
     */
    tag: string
    /** Child nodes */
    /** @lang zh 子节点 */
    /** @lang hi चाइल्ड नोड्स */
    children: MarkdownToJSX.ASTNode[]
  }

  /**
   * HTML block node (includes JSX components)
   * @lang zh HTML 块节点（包括 JSX 组件）
   * @lang hi HTML ब्लॉक नोड (JSX कंपोनेंट्स शामिल हैं)
   */
  export interface HTMLNode {
    type: typeof RuleType.htmlBlock
    /** Parsed HTML attributes */
    /** @lang zh 解析后的 HTML 属性 */
    /** @lang hi पार्स किए गए HTML एट्रिब्यूट्स */
    attrs?: Record<string, any>
    /** Parsed child nodes (always parsed, even for verbatim blocks) */
    /** @lang zh 解析后的子节点（始终解析，即使是逐字块） */
    /** @lang hi पार्स किए गए चाइल्ड नोड्स (हमेशा पार्स किए जाते हैं, यहां तक कि verbatim ब्लॉक्स के लिए भी) */
    children?: ASTNode[] | undefined
    /** Whether this is a verbatim block (script, style, pre, etc.) */
    /** @lang zh 这是否是逐字块（script、style、pre 等） */
    /** @lang hi क्या यह एक verbatim ब्लॉक है (script, style, pre, आदि) */
    verbatim?: boolean
    /** Original raw attribute string */
    /** @lang zh 原始属性字符串 */
    /** @lang hi मूल raw एट्रिब्यूट स्ट्रिंग */
    rawAttrs?: string
    /** Original raw HTML content (for verbatim blocks) */
    /** @lang zh 原始 HTML 内容（用于逐字块） */
    /** @lang hi मूल raw HTML सामग्री (verbatim ब्लॉक्स के लिए) */
    rawText?: string | undefined
    /** @deprecated Use `rawText` instead. This property will be removed in a future major version. */
    /** @lang zh @deprecated 请使用 `rawText` 代替。此属性将在未来的主要版本中移除。 */
    /** @lang hi @deprecated कृपया इसके बजाय `rawText` का उपयोग करें। यह प्रॉपर्टी भविष्य के प्रमुख संस्करण में हटा दी जाएगी। */
    text?: string | undefined
    /** HTML tag name */
    /** @lang zh HTML 标签名称 */
    /** @lang hi HTML टैग नाम */
    tag: string
  }

  /**
   * Self-closing HTML tag node
   * @lang zh 自闭合 HTML 标签节点
   * @lang hi स्व-बंद होने वाला HTML टैग नोड
   */
  export interface HTMLSelfClosingNode {
    type: typeof RuleType.htmlSelfClosing
    /** Parsed HTML attributes */
    /** @lang zh 解析后的 HTML 属性 */
    /** @lang hi पार्स किए गए HTML एट्रिब्यूट्स */
    attrs?: Record<string, any>
    /** Whether this is a closing tag */
    /** @lang zh 这是否是闭合标签 */
    /** @lang hi क्या यह एक बंद करने वाला टैग है */
    isClosingTag?: boolean
    /** HTML tag name */
    /** @lang zh HTML 标签名称 */
    /** @lang hi HTML टैग नाम */
    tag: string
    /** Original raw HTML content */
    /** @lang zh 原始 HTML 内容 */
    /** @lang hi मूल raw HTML सामग्री */
    rawText?: string
  }

  /**
   * Union type of all possible AST node types
   * @lang zh 所有可能的 AST 节点类型的联合类型
   * @lang hi सभी संभावित AST नोड प्रकारों का संघ प्रकार
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
   * @lang zh 用于渲染 AST 节点的函数类型
   * @lang hi AST नोड्स को रेंडर करने के लिए फ़ंक्शन प्रकार
   */
  export type ASTRender = (
    ast: MarkdownToJSX.ASTNode | MarkdownToJSX.ASTNode[],
    state: MarkdownToJSX.State
  ) => React.ReactNode

  /**
   * Override configuration for HTML tags or custom components
   * @lang zh HTML 标签或自定义组件的覆盖配置
   * @lang hi HTML टैग्स या कस्टम कंपोनेंट्स के लिए ओवरराइड कॉन्फ़िगरेशन
   */
  export type Override =
    | RequireAtLeastOne<{
        component: React.ElementType
        props: Object
      }>
    | React.ElementType

  /**
   * Map of HTML tags and custom components to their override configurations
   * @lang zh HTML 标签和自定义组件到其覆盖配置的映射
   * @lang hi HTML टैग्स और कस्टम कंपोनेंट्स से उनकी ओवरराइड कॉन्फ़िगरेशन का मैप
   */
  export type Overrides = {
    [tag in HTMLTags]?: Override
  } & {
    [customComponent: string]: Override
  }

  /**
   * Compiler options
   * @lang zh 编译器选项
   * @lang hi कंपाइलर विकल्प
   */
  export type Options = Partial<{
    /**
     * Ultimate control over the output of all rendered JSX.
     * @lang zh 对所有渲染的 JSX 输出的最终控制。
     * @lang hi सभी रेंडर किए गए JSX आउटपुट पर अंतिम नियंत्रण।
     */
    createElement: (
      tag: Parameters<CreateElement>[0],
      props: React.JSX.IntrinsicAttributes,
      ...children: React.ReactNode[]
    ) => React.ReactNode

    /**
     * The library automatically generates an anchor tag for bare URLs included in the markdown
     * document, but this behavior can be disabled if desired.
     * @lang zh 库会自动为 Markdown 文档中包含的裸 URL 生成锚点标签，但可以根据需要禁用此行为。
     * @lang hi लाइब्रेरी markdown दस्तावेज़ में शामिल नंगे URLs के लिए स्वचालित रूप से एक एंकर टैग जेनरेट करती है, लेकिन यदि वांछित हो तो इस व्यवहार को अक्षम किया जा सकता है।
     */
    disableAutoLink: boolean

    /**
     * Disable the compiler's best-effort transcription of provided raw HTML
     * into JSX-equivalent. This is the functionality that prevents the need to
     * use `dangerouslySetInnerHTML` in React.
     * @lang zh 禁用编译器将提供的原始 HTML 转换为 JSX 等效项的最佳努力。此功能可避免在 React 中使用 `dangerouslySetInnerHTML`。
     * @lang hi कंपाइलर के प्रदान किए गए raw HTML को JSX-समतुल्य में ट्रांसक्राइब करने के सर्वोत्तम प्रयास को अक्षम करें। यह वह कार्यक्षमता है जो React में `dangerouslySetInnerHTML` का उपयोग करने की आवश्यकता को रोकती है।
     */
    disableParsingRawHTML: boolean

    /**
     * Enable GFM tagfilter extension to filter potentially dangerous HTML tags.
     * When enabled, the following tags are escaped: title, textarea, style, xmp,
     * iframe, noembed, noframes, script, plaintext.
     * https://github.github.com/gfm/#disallowed-raw-html-extension-
     * @lang zh 启用 GFM tagfilter 扩展以过滤潜在危险的 HTML 标签。启用后，以下标签将被转义：title、textarea、style、xmp、iframe、noembed、noframes、script、plaintext。
     * @lang hi संभावित खतरनाक HTML टैग्स को फ़िल्टर करने के लिए GFM tagfilter एक्सटेंशन सक्षम करें। सक्षम होने पर, निम्नलिखित टैग्स एस्केप किए जाते हैं: title, textarea, style, xmp, iframe, noembed, noframes, script, plaintext।
     * @default true
     */
    tagfilter?: boolean

    /**
     * Forces the compiler to have space between hash sign and the header text which
     * is explicitly stated in the most of the markdown specs.
     * https://github.github.com/gfm/#atx-heading
     * `The opening sequence of # characters must be followed by a space or by the end of line.`
     * @lang zh 强制编译器在井号和标题文本之间有空格，这在大多数 Markdown 规范中都有明确规定。
     * @lang hi कंपाइलर को हैश चिह्न और हेडर टेक्स्ट के बीच स्थान रखने के लिए बाध्य करता है, जो अधिकांश markdown विनिर्देशों में स्पष्ट रूप से कहा गया है。
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
     * @lang zh **⚠️ 安全警告：强烈建议不要用于用户输入**
     *
     * 启用后，尝试计算 JSX 属性中无法序列化为 JSON 的表达式（函数、变量、复杂表达式）。这使用 `eval()`，可能会执行任意代码。
     *
     * **仅在以下情况下使用此选项：**
     * - Markdown 源完全可信（例如，您自己的文档）
     * - 您控制所有 JSX 组件及其属性
     * - 内容不是用户生成或用户可编辑的
     *
     * **在以下情况下不要使用此选项：**
     * - 处理用户提交的 Markdown
     * - 渲染不可信内容
     * - 构建面向公众的用户内容应用程序
     *
     * 不安全的输入示例：`<Component onClick={() => fetch('/admin/delete-all')} />`
     *
     * 禁用时（默认），不可序列化的表达式保持为字符串，可以通过自定义 renderRule 逻辑安全地检查或逐例处理。
     *
     * @lang hi **⚠️ सुरक्षा चेतावनी: उपयोगकर्ता इनपुट के लिए अत्यधिक हतोत्साहित**
     *
     * सक्षम होने पर, JSX props में expressions को eval करने का प्रयास करता है जिन्हें JSON के रूप में सीरियलाइज़ नहीं किया जा सकता है (फ़ंक्शन, वेरिएबल, जटिल expressions)। यह `eval()` का उपयोग करता है जो मनमाने कोड को निष्पादित कर सकता है।
     *
     * **केवल निम्नलिखित स्थितियों में इस विकल्प का उपयोग करें:**
     * - Markdown स्रोत पूरी तरह से विश्वसनीय है (उदाहरण के लिए, आपका अपना दस्तावेज़ीकरण)
     * - आप सभी JSX कंपोनेंट्स और उनके props को नियंत्रित करते हैं
     * - सामग्री उपयोगकर्ता-जनित या उपयोगकर्ता-संपादन योग्य नहीं है
     *
     * **निम्नलिखित स्थितियों में इस विकल्प का उपयोग न करें:**
     * - उपयोगकर्ता-सबमिट किए गए markdown को प्रोसेस कर रहे हों
     * - अविश्वसनीय सामग्री रेंडर कर रहे हों
     * - उपयोगकर्ता सामग्री वाले सार्वजनिक-सामना करने वाले एप्लिकेशन बना रहे हों
     *
     * असुरक्षित इनपुट उदाहरण: `<Component onClick={() => fetch('/admin/delete-all')} />`
     *
     * अक्षम होने पर (डिफ़ॉल्ट), अनसीरियलाइज़ेबल expressions स्ट्रिंग्स के रूप में रहते हैं जिन्हें कस्टम renderRule लॉजिक के माध्यम से सुरक्षित रूप से जांचा जा सकता है या केस-बाई-केस हैंडल किया जा सकता है।
     *
     * @default false
     */
    evalUnserializableExpressions?: boolean

    /**
     * Forces the compiler to always output content with a block-level wrapper
     * (`<p>` or any block-level syntax your markdown already contains.)
     * @lang zh 强制编译器始终使用块级包装器输出内容（`<p>` 或您的 Markdown 已包含的任何块级语法）。
     * @lang hi कंपाइलर को हमेशा ब्लॉक-स्तरीय रैपर के साथ सामग्री आउटपुट करने के लिए बाध्य करता है (`<p>` या आपके markdown में पहले से मौजूद कोई भी ब्लॉक-स्तरीय सिंटैक्स)।
     */
    forceBlock: boolean

    /**
     * Forces the compiler to always output content with an inline wrapper (`<span>`)
     * @lang zh 强制编译器始终使用内联包装器（`<span>`）输出内容
     * @lang hi कंपाइलर को हमेशा इनलाइन रैपर (`<span>`) के साथ सामग्री आउटपुट करने के लिए बाध्य करता है
     */
    forceInline: boolean

    /**
     * Forces the compiler to wrap results, even if there is only a single
     * child or no children.
     * @lang zh 强制编译器包装结果，即使只有一个子元素或没有子元素。
     * @lang hi कंपाइलर को परिणामों को रैप करने के लिए बाध्य करता है, भले ही केवल एक चाइल्ड हो या कोई चाइल्ड न हो।
     */
    forceWrapper: boolean

    /**
     * Selectively control the output of particular HTML tags as they would be
     * emitted by the compiler.
     * @lang zh 选择性地控制特定 HTML 标签的输出，就像编译器会发出的一样。
     * @lang hi चुनिंदा रूप से विशिष्ट HTML टैग्स के आउटपुट को नियंत्रित करें जैसा कि कंपाइलर द्वारा उत्सर्जित किया जाएगा।
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
     * @lang zh 允许完全控制特定规则的渲染。例如，要实现像 `react-katex` 这样的 LaTeX 渲染器：
     *
     * 显然有风险，但您可以用它做很多事情（玩得开心！）要了解内部工作原理，请查看源代码中特定规则的 `render` 方法。
     * @lang hi विशिष्ट नियमों के रेंडरिंग पर पूर्ण नियंत्रण की अनुमति देता है। उदाहरण के लिए, `react-katex` जैसे LaTeX रेंडरर को लागू करने के लिए:
     *
     * स्पष्ट रूप से जोखिम हैं, लेकिन आप इसके साथ बहुत कुछ कर सकते हैं (मज़े करें!) आंतरिक रूप से चीजें कैसे काम करती हैं यह देखने के लिए, किसी विशिष्ट नियम के लिए स्रोत में `render` विधि देखें।
     */
    renderRule: (
      /** Resume normal processing, call this function as a fallback if you are not returning custom JSX. */
      /** @lang zh 恢复正常处理，如果您不返回自定义 JSX，请调用此函数作为后备。 */
      /** @lang hi सामान्य प्रोसेसिंग फिर से शुरू करें, यदि आप कस्टम JSX वापस नहीं कर रहे हैं तो इस फ़ंक्शन को फ़ॉलबैक के रूप में कॉल करें। */
      next: () => React.ReactNode,
      /** the current AST node, use `RuleType` against `node.type` for identification */
      /** @lang zh 当前的 AST 节点，使用 `RuleType` 与 `node.type` 进行比较以进行识别 */
      /** @lang hi वर्तमान AST नोड, पहचान के लिए `node.type` के खिलाफ `RuleType` का उपयोग करें */
      node: ASTNode,
      /** use as `renderChildren(node.children)` for block nodes */
      /** @lang zh 对于块节点，使用 `renderChildren(node.children)` */
      /** @lang hi ब्लॉक नोड्स के लिए `renderChildren(node.children)` के रूप में उपयोग करें */
      renderChildren: ASTRender,
      /** contains `key` which should be supplied to the topmost JSX element */
      /** @lang zh 包含应提供给最顶层 JSX 元素的 `key` */
      /** @lang hi `key` शामिल है जो सबसे ऊपरी JSX एलिमेंट को प्रदान किया जाना चाहिए */
      state: State
    ) => React.ReactNode

    /**
     * Override the built-in sanitizer function for URLs, etc if desired. The built-in version is available as a library
     export called `sanitizer`.
     * @lang zh 如果需要，覆盖内置的 URL 清理函数等。内置版本可作为名为 `sanitizer` 的库导出使用。
     * @lang hi यदि वांछित हो तो URLs आदि के लिए बिल्ट-इन सैनिटाइज़र फ़ंक्शन को ओवरराइड करें। बिल्ट-इन संस्करण `sanitizer` नामक लाइब्रेरी export के रूप में उपलब्ध है।
     */
    sanitizer: (value: string, tag: string, attribute: string) => string | null

    /**
     * Override normalization of non-URI-safe characters for use in generating
     * HTML IDs for anchor linking purposes.
     * @lang zh 覆盖非 URI 安全字符的规范化，用于生成用于锚点链接的 HTML ID。
     * @lang hi एंकर लिंकिंग उद्देश्यों के लिए HTML IDs जेनरेट करने में उपयोग के लिए गैर-URI-सुरक्षित वर्णों के सामान्यीकरण को ओवरराइड करें।
     */
    slugify: (input: string, defaultFn: (input: string) => string) => string

    /**
     * Declare the type of the wrapper to be used when there are multiple
     * children to render. Set to `null` to get an array of children back
     * without any wrapper, or use `React.Fragment` to get a React element
     * that won't show up in the DOM.
     * @lang zh 声明在有多个子元素要渲染时使用的包装器类型。设置为 `null` 以在没有包装器的情况下返回子元素数组，或使用 `React.Fragment` 获取不会出现在 DOM 中的 React 元素。
     * @lang hi रैपर के प्रकार को घोषित करें जब कई children को रेंडर करना हो। बिना किसी रैपर के children की एक सरणी वापस पाने के लिए `null` पर सेट करें, या DOM में दिखाई न देने वाला React एलिमेंट प्राप्त करने के लिए `React.Fragment` का उपयोग करें।
     */
    wrapper: React.ElementType | null

    /**
     * Props to apply to the wrapper element.
     * @lang zh 应用于包装元素的属性。
     * @lang hi रैपर एलिमेंट पर लागू करने के लिए props।
     */
    wrapperProps?: React.JSX.IntrinsicAttributes

    /**
     * Preserve frontmatter in the output by rendering it as a <pre> element.
     * By default, frontmatter is parsed but not rendered.
     * @lang zh 通过将其渲染为 <pre> 元素来保留输出中的前置元数据。默认情况下，前置元数据会被解析但不会渲染。
     * @lang hi इसे <pre> एलिमेंट के रूप में रेंडर करके आउटपुट में फ्रंटमैटर को संरक्षित करें। डिफ़ॉल्ट रूप से, फ्रंटमैटर को पार्स किया जाता है लेकिन रेंडर नहीं किया जाता है।
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
