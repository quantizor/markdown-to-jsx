/** @jsxRuntime classic */
/** @jsx h */

import * as React from 'react'
import * as $ from './constants'
import * as parse from './parse'
import { MarkdownToJSX, RuleType } from './types'
import * as util from './utils'

export { parser } from './parse'

export { RuleType, type MarkdownToJSX } from './types'
export { sanitizer, slugify } from './utils'


/**
 * Symbol used by React to identify valid elements, auto-detected from the
 * installed React version. React 18 uses react.element, React 19+ uses
 * react.transitional.element, future versions may use something else.
 */
var REACT_ELEMENT_TYPE: symbol
try {
  REACT_ELEMENT_TYPE = React.createElement('div').$$typeof
} catch (e) {
  REACT_ELEMENT_TYPE = Symbol.for('react.transitional.element')
}

/**
 * Create a React element without calling React.createElement.
 * This avoids type validation, key/ref extraction, defaultProps merging,
 * and dev-mode freezing that React.createElement performs.
 * Inspired by Bun's JSReactElement approach.
 */
function createRawElement(
  type: any,
  props: any,
  key: any
): any {
  // These internal properties must be included unconditionally because the
  // library build replaces process.env.NODE_ENV, which strips dev-only branches.
  // _store: React's dev reconciler writes _store.validated; without _store it throws.
  // _debugStack/_debugTask: React's RSC Flight server (used by Next.js) warns
  // "Attempted to render without development properties" when these are undefined.
  // null (not undefined) satisfies the !== undefined check.
  return {
    $$typeof: REACT_ELEMENT_TYPE,
    type: type,
    key: key != null ? '' + key : null,
    ref: null,
    props: props,
    _owner: null,
    _store: {},
    _debugStack: null,
    _debugTask: null,
  }
}

/**
 * React context for sharing compiler options across Markdown components
 *
 * Note: This is undefined in React Server Component environments where createContext is not available.
 */
export const MarkdownContext:
  | React.Context<MarkdownToJSX.Options | undefined>
  | undefined =
  typeof React.createContext !== 'undefined'
    ? React.createContext<MarkdownToJSX.Options | undefined>(undefined)
    : undefined

function render(
  node: MarkdownToJSX.ASTNode,
  output: MarkdownToJSX.ASTRender,
  state: MarkdownToJSX.State,
  h: (tag: any, props: any, ...children: any[]) => any,
  sanitize: (value: string, tag: string, attribute: string) => string | null,
  slug: (input: string, defaultFn: (input: string) => string) => string,
  refs: { [key: string]: { target: string; title: string } },
  options: MarkdownToJSX.Options,
  hJSX: (tag: any, props: any, ...children: any[]) => any
): React.ReactNode {
  switch (node.type) {
    case RuleType.blockQuote: {
      const props = {
        key: state.key,
      } as Record<string, unknown>

      if (node.alert) {
        props.className =
          'markdown-alert-' + slug(node.alert.toLowerCase(), util.slugify)

        node.children.unshift(util.alertHeaderNode(node.alert))
      }

      return h('blockquote', props, output(node.children, state))
    }

    case RuleType.breakLine:
      return <br key={state.key} />

    case RuleType.breakThematic:
      return <hr key={state.key} />

    case RuleType.frontmatter:
      if (options.preserveFrontmatter) {
        return <pre key={state.key}>{node.text}</pre>
      }
      return null

    case RuleType.codeBlock:
      // Decode entity references in language name (per CommonMark spec)
      const decodedLang = node.lang
        ? util.decodeEntityReferences(node.lang)
        : ''
      return (
        <pre key={state.key}>
          <code
            {...util.htmlAttrsToJSXProps(node.attrs)}
            className={
              decodedLang ? `language-${decodedLang} lang-${decodedLang}` : ''
            }
          >
            {node.text}
          </code>
        </pre>
      )

    case RuleType.codeInline:
      return <code key={state.key}>{node.text}</code>

    case RuleType.footnoteReference:
      return (
        <a key={state.key} href={sanitize(node.target, 'a', 'href') || undefined}>
          <sup>{node.text}</sup>
        </a>
      )

    case RuleType.gfmTask:
      return (
        <input
          checked={node.completed}
          key={state.key}
          readOnly
          type="checkbox"
        />
      )

    case RuleType.heading:
      return h(
        `h${node.level}`,
        { id: node.id, key: state.key },
        output(node.children, state)
      )

    case RuleType.htmlBlock: {
      const htmlNode = node as MarkdownToJSX.HTMLNode

      // Apply options.tagfilter: escape dangerous tags
      if (options.tagfilter && util.shouldFilterTag(htmlNode.tag)) {
        // Construct opening tag for display (React will escape the angle brackets)
        return h(
          'span',
          { key: state.key },
          '<' + htmlNode.tag + util.formatFilteredTagAttrs(htmlNode.attrs) + '>'
        )
      }

      if (htmlNode._rawText && htmlNode._verbatim) {
        // For verbatim blocks, always use rawText for rendering (CommonMark compliance)
        const tagLower = (htmlNode.tag as string).toLowerCase()
        const isType1Block = parse.isType1Block(tagLower)
        const hasChildren = htmlNode.children && htmlNode.children.length > 0

        // Type 1 blocks (pre, script, style, textarea) always render verbatim
        if (isType1Block) {
          const textContent = util.type1TextContent(
            htmlNode._rawText,
            tagLower,
            options.tagfilter
          )
          if (/<[a-z][^>]{0,100}>/i.test(htmlNode._rawText)) {
            return hJSX(node.tag, {
              key: state.key,
              ...util.htmlAttrsToJSXProps(node.attrs),
              dangerouslySetInnerHTML: { __html: textContent },
            })
          }
          return hJSX(node.tag, { key: state.key, ...util.htmlAttrsToJSXProps(node.attrs) }, textContent)
        }

        // When the tag itself is filtered (e.g. <iframe>), prefer
        // children so each child element goes through its own tagfilter check
        const ownTagStartR = new RegExp(`^<${htmlNode.tag}(\\s|>)`, 'i')
        if (hasChildren && !ownTagStartR.test(htmlNode._rawText) && options.tagfilter && util.containsTagfilterTag(htmlNode._rawText)) {
          return hJSX(
            node.tag,
            { key: state.key, ...util.htmlAttrsToJSXProps(node.attrs) },
            output(htmlNode.children, state)
          )
        }

        // Non-Type-1 verbatim blocks containing Type 1 tags use innerHTML
        const containsVerbatimTags = parse.containsType1Tag(htmlNode._rawText)
        if (containsVerbatimTags) {
          const innerHtml = options.tagfilter
            ? util.applyTagFilterToText(htmlNode._rawText)
            : htmlNode._rawText
          return hJSX(node.tag, {
            key: state.key,
            ...util.htmlAttrsToJSXProps(node.attrs),
            dangerouslySetInnerHTML: { __html: innerHtml },
          })
        }
        // For other verbatim blocks, re-parse rawText for JSX compilation
        // (children are available for renderRule but default uses rawText)
        const parseOptions: parse.ParseOptions = {
          slugify: (input: string) => slug(input, util.slugify),
          sanitizer: sanitize,
          tagfilter: true,
        }
        const cleanedText = htmlNode._rawText
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
          // If parser already produced children, use them instead of discarding
          if (htmlNode.children && htmlNode.children.length > 0) {
            return hJSX(
              node.tag,
              { key: state.key, ...util.htmlAttrsToJSXProps(node.attrs) },
              output(htmlNode.children, state)
            )
          }
          return hJSX(node.tag, { key: state.key, ...util.htmlAttrsToJSXProps(node.attrs) })
        }

        const astNodes = parse.parseMarkdown(
          cleanedText,
          { inline: false, refs: refs, inHTML: false },
          parseOptions
        )
        // Strip verbatim from re-parsed nodes to prevent infinite re-parse
        // recursion, keeping it only where trailing content bled past a closing
        // tag (issue #881). See util.stripVerbatim for the full rationale.
        util.stripVerbatim(astNodes)

        // Check if rawText represents the FULL outer block (starts with opening tag
        // and ends with closing tag of the same element, with no content after)
        // In this case, render the parsed nodes directly without adding another wrapper
        const tagLowerCheck = (htmlNode.tag as string).toLowerCase()
        const closingTag = '</' + tagLowerCheck + '>'
        const startsWithOwnTag = ownTagStartR.test(cleanedText)
        const endsWithClosingTag = cleanedText
          .toLowerCase()
          .trimEnd()
          .endsWith(closingTag)
        const isFullOuterBlock = startsWithOwnTag && endsWithClosingTag

        // When rawText wraps the full outer block, prefer children if available
        if (isFullOuterBlock && hasChildren) {
          return hJSX(
            node.tag,
            { key: state.key, ...util.htmlAttrsToJSXProps(node.attrs) },
            output(htmlNode.children, state)
          )
        }
        if (isFullOuterBlock) {
          return output(astNodes.flatMap(util.processVerbatimNode), state)
        }

        // Split the re-parsed AST at this element's own closing tag so trailing
        // content becomes siblings (issue #881). Runs on the raw AST before
        // util.processVerbatimNode strips closing tags.
        var splitResult = util.findOwnCloseInAST(astNodes, tagLowerCheck)
        if (splitResult.found && splitResult.afterClose.length > 0) {
          var beforeProcessed = splitResult.beforeClose.flatMap(util.processVerbatimNode)
          var afterProcessed = splitResult.afterClose.flatMap(util.processVerbatimNode)
          return createRawElement(
            React.Fragment,
            {
              children: [
                hJSX(
                  node.tag,
                  { key: state.key, ...util.htmlAttrsToJSXProps(node.attrs) },
                  output(beforeProcessed, state)
                ),
                output(afterProcessed, state)
              ]
            },
            state.key
          )
        }

        return hJSX(
          node.tag,
          { key: state.key, ...util.htmlAttrsToJSXProps(node.attrs) },
          output(astNodes.flatMap(util.processVerbatimNode), state)
        )
      }
      if (util.isVoidElement(node.tag)) {
        return hJSX(node.tag, { key: state.key, ...util.htmlAttrsToJSXProps(node.attrs) })
      }
      return hJSX(
        node.tag,
        { key: state.key, ...util.htmlAttrsToJSXProps(node.attrs) },
        node.children ? output(node.children, state) : ''
      )
    }

    case RuleType.htmlSelfClosing: {
      const htmlNode = node as MarkdownToJSX.HTMLSelfClosingNode

      // Apply options.tagfilter: escape dangerous self-closing tags
      if (options.tagfilter && util.shouldFilterTag(htmlNode.tag)) {
        return h(
          'span',
          { key: state.key },
          '<' +
            htmlNode.tag +
            util.formatFilteredTagAttrs(htmlNode.attrs) +
            ' />'
        )
      }

      return hJSX(node.tag, { key: state.key, ...util.htmlAttrsToJSXProps(node.attrs) })
    }

    case RuleType.image: {
      const src = node.target != null ? sanitize(node.target, 'img', 'src') : null
      return (
        <img
          key={state.key}
          alt={node.alt && node.alt.length > 0 ? node.alt : undefined}
          title={node.title || undefined}
          src={src || undefined}
        />
      )
    }

    case RuleType.link: {
      const props: Record<string, unknown> = { key: state.key }
      if (node.target != null) {
        // Entity references are already decoded during parsing (per CommonMark spec)
        // URL-encode backslashes and backticks (per CommonMark spec)
        props.href = util.encodeUrlTarget(node.target)
      }
      if (node.title) {
        // Entity references are already decoded during parsing (per CommonMark spec)
        props.title = node.title
      }
      return h('a', props, output(node.children, state))
    }

    case RuleType.table: {
      const table = node as MarkdownToJSX.TableNode
      return (
        <table key={state.key}>
          <thead key="thead">
            <tr>
              {table.header.map(function generateHeaderCell(content, i) {
                return (
                  <th
                    key={i}
                    style={
                      table.align[i] == null
                        ? {}
                        : { textAlign: table.align[i] }
                    }
                  >
                    {output(content, state)}
                  </th>
                )
              })}
            </tr>
          </thead>

          {table.cells.length > 0 && (
            <tbody key="tbody">
              {table.cells.map(function generateTableRow(row, i) {
                return (
                  <tr key={i}>
                    {row.map(function generateTableCell(content, c) {
                      return (
                        <td
                          key={c}
                          style={
                            table.align[c] == null
                              ? {}
                              : { textAlign: table.align[c] }
                          }
                        >
                          {output(content, state)}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          )}
        </table>
      )
    }

    case RuleType.text:
      return node.text

    case RuleType.textFormatted:
      return h(
        node.tag as MarkdownToJSX.HTMLTags,
        { key: state.key },
        output(node.children, state)
      )

    case RuleType.orderedList:
    case RuleType.unorderedList: {
      const Tag = node.type === RuleType.orderedList ? 'ol' : 'ul'

      return (
        <Tag
          key={state.key}
          start={node.type === RuleType.orderedList ? node.start : undefined}
        >
          {node.items.map(function generateListItem(item, i) {
            return <li key={i}>{output(item, state)}</li>
          })}
        </Tag>
      )
    }

    case RuleType.paragraph:
      return <p key={state.key}>{output(node.children, state)}</p>

    case RuleType.ref:
      // Reference definitions should not be rendered (they're consumed during parsing)
      return null

    default:
      return null
  }
}

const createRenderer = (
  userRender: MarkdownToJSX.Options['renderRule'],
  h: (
    tag: string,
    props: Parameters<MarkdownToJSX.CreateElement>[1] & {
      className?: string
      id?: string
    },
    ...children: any[]
  ) => any,
  sanitize: (value: string, tag: string, attribute: string) => string | null,
  slug: (input: string, defaultFn: (input: string) => string) => string,
  refs: { [key: string]: { target: string; title: string } },
  options: MarkdownToJSX.Options,
  hJSX: (tag: any, props: any, ...children: any[]) => any
) => {
  var handleStackOverflow = (ast: MarkdownToJSX.ASTNode[]) =>
    ast.map(function(node) { return 'text' in node ? node.text : '' })
  var renderer = (
    ast: MarkdownToJSX.ASTNode[],
    state: MarkdownToJSX.State = {}
  ) => {
    var depth = (state.renderDepth || 0) + 1
    if (depth > 2500) return handleStackOverflow(ast)
    state.renderDepth = depth

    var oldKey = state.key,
      result: React.ReactNode[] = []
    var lastWasString = false
    for (var i = 0; i < ast.length; i++) {
      state.key = i
      var nodeOut: React.ReactNode
      if (userRender) {
        var defaultRender = render.bind(
          null, ast[i], renderer, state, h, sanitize, slug, refs, options, hJSX
        )
        nodeOut = userRender(defaultRender, ast[i], renderer, state)
      } else {
        nodeOut = render(ast[i], renderer, state, h, sanitize, slug, refs, options, hJSX)
      }
      var isString = typeof nodeOut === 'string'
      if (isString && lastWasString) {
        // Concatenate consecutive strings
        result[result.length - 1] += nodeOut
      } else if (nodeOut !== null) {
        if (Array.isArray(nodeOut)) {
          // Use loop instead of spread for better performance
          for (var j = 0; j < nodeOut.length; j++) {
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

const getTag = (tag, overrides) => {
  const override = util.get(overrides, tag, undefined)
  return !override
    ? tag
    : typeof override === 'function' ||
        (typeof override === 'object' && 'render' in override)
      ? override
      : util.get(overrides, `${tag}.component`, tag)
}

/**
 * Convert AST nodes to React JSX elements
 *
 * @param ast - Array of AST nodes to render
 * @param options - Compiler options
 * @returns React JSX element(s)
 */
export function astToJSX(
  ast: MarkdownToJSX.ASTNode[],
  options?: MarkdownToJSX.Options
): React.ReactNode {
  const opts = { ...(options || {}) }
  opts.overrides = opts.overrides || {}

  const slug = opts.slugify || util.slugify
  const sanitize = opts.sanitizer || util.sanitizer
  const customCreateElement = opts.createElement
  const hasOverrides = util.hasKeys(opts.overrides)

  // Recursive compile function for HTML content
  const compileHTML = (input: string) =>
    compiler(input, { ...opts, wrapper: null })

  // Compile any JSX-like string values in props. Only called from the HTML
  // block/self-closing render cases via hJSX — the vast majority of h()
  // calls (paragraphs, headings, lists, inline emphasis, etc.) never contain
  // embedded JSX strings so running this per-element is a profiled hot path.
  function _compilePropsJSX(props: Record<string, any>): void {
    for (var pkey in props) {
      var pval = props[pkey]
      if (
        typeof pval === 'string' &&
        pval.length > 0 &&
        pval.charCodeAt(0) === $.CHAR_LT &&
        (parse.HTML_BLOCK_ELEMENT_START_R_ATTR.test(pval) ||
          parse.UPPERCASE_TAG_R.test(pval) ||
          parse.parseHTMLTag(pval, 0))
      ) {
        var compiled = compileHTML(pval.trim())
        props[pkey] = pkey === 'innerHTML' && Array.isArray(compiled)
          ? compiled[0]
          : compiled
      }
    }
  }

  // JSX custom pragma — props are already JSX-compatible (htmlAttrsToJSXProps
  // is applied at call sites in render() that deal with HTML attributes).
  // Fast path: does NOT run the embedded-JSX compile loop. Use hJSX for HTML
  // render cases where props may contain JSX-like strings.
  // eslint-disable-next-line no-unused-vars
  function h(
    // locally we always will render a known string tag
    tag: MarkdownToJSX.HTMLTags,
    props: Parameters<MarkdownToJSX.CreateElement>[1] & {
      className?: string
      id?: string
    },
    ...children
  ) {
    var finalProps: any = props || {}

    var resolvedTag: any = tag

    if (hasOverrides) {
      var overrideProps = util.get(opts.overrides, tag + '.props', {})
      resolvedTag = getTag(tag, opts.overrides)
      finalProps = {
        ...finalProps,
        ...overrideProps,
        className:
          util.cx(finalProps.className, overrideProps.className) || undefined,
      }
    }

    // Fast path: bypass React.createElement when no custom createElement
    if (!customCreateElement) {
      var elKey = finalProps.key
      if (elKey != null) {
        delete finalProps.key
      }
      if (children.length === 1) {
        finalProps.children = children[0]
      } else if (children.length > 1) {
        finalProps.children = children
      }
      return createRawElement(resolvedTag, finalProps, elKey)
    }

    return customCreateElement(
      resolvedTag,
      finalProps,
      ...children
    )
  }

  // Variant that runs the embedded-JSX compile loop on props before
  // delegating to h. Used only by HTML block / self-closing render cases.
  function hJSX(tag: any, props: any, ...children: any[]): any {
    if (props) _compilePropsJSX(props)
    return h(tag, props, ...children)
  }

  const parseOptions: parse.ParseOptions = {
    ...opts,
    // Fast path: when no user slugify, pass util.slugify directly (no closure)
    slugify: opts.slugify ? (i => opts.slugify!(i, util.slugify)) : util.slugify,
    sanitizer: sanitize,
    tagfilter: opts.tagfilter !== false,
  }

  const refs =
    ast[0] && ast[0].type === RuleType.refCollection
      ? (ast[0] as MarkdownToJSX.ReferenceCollectionNode).refs
      : {}

  const emitter = createRenderer(opts.renderRule, h, sanitize, slug, refs, opts, hJSX)

  const arr = emitter(ast, {
    inline: opts.forceInline,
    refs: refs,
  }) as React.ReactNode[]

  const footnoteEntries = util.extractFootnoteEntries(refs)

  if (footnoteEntries.length) {
    arr.push(
      <footer key="footer">
        {footnoteEntries.map(function createFootnote(def) {
          const identifierWithoutCaret =
            def.identifier.charCodeAt(0) === $.CHAR_CARET
              ? def.identifier.slice(1)
              : def.identifier
          const footnoteAstNodes = parse.parseMarkdown(
            def.footnote,
            { inline: true, refs: refs },
            parseOptions
          )
          return h(
            'div',
            {
              id: slug(identifierWithoutCaret, util.slugify),
              key: def.identifier,
            },
            identifierWithoutCaret + ': ',
            emitter(footnoteAstNodes, { inline: true, refs: refs })
          )
        })}
      </footer>
    )
  }

  if (opts.wrapper === null) {
    return arr
  }

  const wrapper = opts.wrapper || (opts.forceInline ? 'span' : 'div')
  let jsx: React.ReactNode

  if (arr.length > 1 || opts.forceWrapper) {
    jsx = arr
  } else if (arr.length === 1) {
    return arr[0]
  } else {
    return null
  }

  var wrapperProps = opts.wrapperProps ? { ...opts.wrapperProps } : {}
  wrapperProps.children = jsx
  return createRawElement(
    wrapper,
    wrapperProps,
    'outer'
  ) as React.JSX.Element
}

/**
 * Compile markdown string to React JSX elements
 *
 * @param markdown - Markdown string to compile
 * @param options - Compiler options
 * @returns React JSX element(s)
 */
export function compiler(
  markdown: string = '',
  options: MarkdownToJSX.Options = {}
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
      ...opts,
      // Fast path: when no user slugify, pass util.slugify directly (no closure)
      slugify: opts.slugify ? (i => opts.slugify!(i, util.slugify)) : util.slugify,
      sanitizer: sanitize,
      tagfilter: opts.tagfilter !== false,
    }

    let processedInput = inline ? input : util.prepareBlockInput(input)

    // In streaming mode, strip trailing incomplete HTML tags to prevent infinite recursion
    if (opts.optimizeForStreaming) {
      // Find last '<' that doesn't have a matching '>'
      var lastLt = processedInput.lastIndexOf('<')
      if (lastLt !== -1 && processedInput.indexOf('>', lastLt) === -1) {
        processedInput = processedInput.slice(0, lastLt)
      }
    }

    let astNodes = parse.parseMarkdown(
      processedInput,
      { inline: inline, refs: refs },
      parseOptions
    )

    return astToJSX(astNodes, {
      ...parseOptions,
      forceInline: inline,
    })
  }

  if (process.env.NODE_ENV !== 'production') {
    util.validateCompilerArgs(markdown, opts.overrides, 'ReactComponent')
  }

  const refs: { [key: string]: { target: string; title: string | undefined } } =
    {}

  return compile(markdown)
}

/**
 * React context provider for sharing compiler options across Markdown components
 *
 * @param options - Default compiler options to share
 * @param children - React children
 */
export const MarkdownProvider: React.FC<{
  options?: MarkdownToJSX.Options
  children: React.ReactNode
}> = ({ options, children }) => {
  if (!MarkdownContext) {
    return children as React.ReactElement
  }
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
 * A React component for easy markdown rendering. Feed the markdown content as a direct child
 * and the rest is taken care of automatically. Supports memoization for optimal performance.
 *
 * @param children - Markdown string content
 * @param options - Compiler options
 * @param props - Additional HTML attributes for the wrapper element
 */
export const Markdown: React.FC<
  Omit<React.HTMLAttributes<Element>, 'children'> & {
    children?: string | null
    options?: MarkdownToJSX.Options
  }
> = ({ children: rawChildren, options, ...props }) => {
  const hasHooks = typeof React.useContext !== 'undefined'

  // RSC path: direct execution
  if (!hasHooks) {
    const mergedOptions = {
      ...options,
      overrides: {
        ...options?.overrides,
      },
      wrapperProps: {
        ...options?.wrapperProps,
        ...props,
      } as React.JSX.IntrinsicAttributes,
    }
    const content =
      rawChildren === null || rawChildren === undefined ? '' : rawChildren
    return compiler(content, mergedOptions) as React.ReactElement
  }

  // Client path: existing hook-based implementation
  const contextOptions = React.useContext(MarkdownContext!)
  const stableProps = useShallowStable(props)
  const mergedOptions = React.useMemo(
    () => ({
      ...contextOptions,
      ...options,
      overrides: {
        ...contextOptions?.overrides,
        ...options?.overrides,
      },
      wrapperProps: {
        ...contextOptions?.wrapperProps,
        ...options?.wrapperProps,
        ...stableProps,
      } as React.JSX.IntrinsicAttributes,
    }),
    [contextOptions, options, stableProps]
  )

  const content =
    rawChildren === null || rawChildren === undefined ? '' : rawChildren

  const jsx = React.useMemo(
    () => compiler(content, mergedOptions),
    [content, mergedOptions]
  )

  return jsx as React.ReactElement
}

// MarkdownToJSX namespace moved to types.ts

export default Markdown
