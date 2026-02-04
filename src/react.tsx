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

const TRIM_STARTING_NEWLINES = /^\n+/

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
  return {
    $$typeof: REACT_ELEMENT_TYPE,
    type: type,
    key: key != null ? '' + key : null,
    ref: null,
    props: props,
  }
}

/**
 * React context for sharing compiler options across Markdown components
 * @lang zh 用于在 Markdown 组件之间共享编译器选项的 React 上下文
 * @lang hi Markdown कंपोनेंट्स के बीच कंपाइलर विकल्प साझा करने के लिए React संदर्भ
 *
 * Note: This is undefined in React Server Component environments where createContext is not available.
 * @lang zh 注意：在 createContext 不可用的 React Server Component 环境中，此值为 undefined。
 * @lang hi नोट: React Server Component वातावरण में यह undefined है जहां createContext उपलब्ध नहीं है।
 */
export const MarkdownContext:
  | React.Context<MarkdownToJSX.Options | undefined>
  | undefined =
  typeof React.createContext !== 'undefined'
    ? React.createContext<MarkdownToJSX.Options | undefined>(undefined)
    : undefined

// Import shared HTML to JSX conversion utilities
import { htmlAttrsToJSXProps } from './utils'

// Helper function for URL encoding backslashes and backticks per CommonMark spec

function render(
  node: MarkdownToJSX.ASTNode,
  output: MarkdownToJSX.ASTRender,
  state: MarkdownToJSX.State,
  h: (tag: any, props: any, ...children: any[]) => any,
  sanitize: (value: string, tag: string, attribute: string) => string | null,
  slug: (input: string, defaultFn: (input: string) => string) => string,
  refs: { [key: string]: { target: string; title: string } },
  options: MarkdownToJSX.Options
): React.ReactNode {
  switch (node.type) {
    case RuleType.blockQuote: {
      const props = {
        key: state.key,
      } as Record<string, unknown>

      if (node.alert) {
        props.className =
          'markdown-alert-' + slug(node.alert.toLowerCase(), util.slugify)

        node.children.unshift({
          attrs: {},
          children: [{ type: RuleType.text, text: node.alert }],
          _verbatim: true,
          type: RuleType.htmlBlock,
          tag: 'header',
        })
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
            {...htmlAttrsToJSXProps(node.attrs || {})}
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
          <sup key={state.key}>{node.text}</sup>
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
        var attrStr = ''
        if (htmlNode.attrs) {
          for (var k in htmlNode.attrs) {
            var v = htmlNode.attrs[k]
            if (v === true) attrStr += ' ' + k
            else if (v !== undefined && v !== null && v !== false)
              attrStr += ' ' + k + '="' + String(v) + '"'
          }
        }
        return h('span', { key: state.key }, '<' + htmlNode.tag + attrStr + '>')
      }

      if (htmlNode._rawText && htmlNode._verbatim) {
        // For verbatim blocks, always use rawText for rendering (CommonMark compliance)
        // Children are available for renderRule but default rendering uses rawText
        const tagLower = (htmlNode.tag as string).toLowerCase()
        const isType1Block = parse.isType1Block(tagLower)
        const hasChildren = htmlNode.children && htmlNode.children.length > 0

        const containsHTMLTags = /<[a-z][^>]{0,100}>/i.test(htmlNode._rawText)

        if (isType1Block && !containsHTMLTags) {
          let textContent = htmlNode._rawText.replace(
            new RegExp('\\s*</' + tagLower + '>\\s*$', 'i'),
            ''
          )
          if (options.tagfilter) {
            textContent = util.applyTagFilterToText(textContent)
          }
          return h(node.tag, { key: state.key, ...htmlAttrsToJSXProps(node.attrs || {}) }, textContent)
        }

        // When the tag itself is filtered (e.g. <script>, <iframe>), prefer
        // children so each child element goes through its own tagfilter check
        const startsWithOwnTagEarly = new RegExp(
          `^<${htmlNode.tag}(\\s|>)`,
          'i'
        ).test(htmlNode._rawText)
        if (hasChildren && !startsWithOwnTagEarly && options.tagfilter && util.containsTagfilterTag(htmlNode._rawText)) {
          return h(
            node.tag,
            { key: state.key, ...htmlAttrsToJSXProps(node.attrs || {}) },
            output(htmlNode.children, state)
          )
        }

        // Type 1 tags (pre, script, style, textarea) require verbatim content
        // that cannot be re-parsed into JSX elements without losing fidelity
        const containsVerbatimTags = parse.containsType1Tag(htmlNode._rawText)
        if (containsVerbatimTags) {
          const innerHtml = options.tagfilter
            ? util.applyTagFilterToText(htmlNode._rawText)
            : htmlNode._rawText
          return h(node.tag, {
            key: state.key,
            ...htmlAttrsToJSXProps(node.attrs || {}),
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
            return h(
              node.tag,
              { key: state.key, ...htmlAttrsToJSXProps(node.attrs || {}) },
              output(htmlNode.children, state)
            )
          }
          return h(node.tag, { key: state.key, ...htmlAttrsToJSXProps(node.attrs || {}) })
        }

        function processNode(
          node: MarkdownToJSX.ASTNode
        ): MarkdownToJSX.ASTNode[] {
          if (
            (node.type === RuleType.htmlSelfClosing || node.type === RuleType.htmlBlock) &&
            node._isClosingTag
          ) return []
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

        const astNodes = parse.parseMarkdown(
          cleanedText,
          { inline: false, refs: refs, inHTML: false },
          parseOptions
        )
        // Recursively strip verbatim from re-parsed nodes to prevent infinite
        // re-parse recursion when rendering nested HTML blocks
        function stripVerbatim(nodes: MarkdownToJSX.ASTNode[]) {
          for (var ai = 0; ai < nodes.length; ai++) {
            if (nodes[ai].type === RuleType.htmlBlock) {
              ;(nodes[ai] as MarkdownToJSX.HTMLNode)._verbatim = false
            }
            if ('children' in nodes[ai] && (nodes[ai] as MarkdownToJSX.HTMLNode).children) {
              stripVerbatim((nodes[ai] as MarkdownToJSX.HTMLNode).children as MarkdownToJSX.ASTNode[])
            }
          }
        }
        stripVerbatim(astNodes)

        // Check if rawText represents the FULL outer block (starts with opening tag
        // and ends with closing tag of the same element, with no content after)
        // In this case, render the parsed nodes directly without adding another wrapper
        const tagLowerCheck = (htmlNode.tag as string).toLowerCase()
        const closingTag = '</' + tagLowerCheck + '>'
        const startsWithOwnTag = new RegExp(
          `^<${htmlNode.tag}(\\s|>)`,
          'i'
        ).test(cleanedText)
        const endsWithClosingTag = cleanedText
          .toLowerCase()
          .trimEnd()
          .endsWith(closingTag)
        const isFullOuterBlock = startsWithOwnTag && endsWithClosingTag

        // When rawText wraps the full outer block, prefer children if available
        if (isFullOuterBlock && hasChildren) {
          return h(
            node.tag,
            { key: state.key, ...htmlAttrsToJSXProps(node.attrs || {}) },
            output(htmlNode.children, state)
          )
        }
        if (isFullOuterBlock) {
          return output(astNodes.flatMap(processNode), state)
        }

        // Check if re-parsed AST contains a closing tag for this element
        // followed by sibling tags. If so, split: content before closing tag
        // becomes children, content after becomes siblings rendered alongside.
        // Must check raw AST (before processNode strips closing tags).
        function findOwnCloseInAST(
          nodes: MarkdownToJSX.ASTNode[],
          tag: string
        ): { found: boolean; beforeClose: MarkdownToJSX.ASTNode[]; afterClose: MarkdownToJSX.ASTNode[] } {
          for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i]
            // Check in paragraph children
            if (n.type === RuleType.paragraph && (n as MarkdownToJSX.ParagraphNode).children) {
              var pChildren = (n as MarkdownToJSX.ParagraphNode).children
              for (var j = 0; j < pChildren.length; j++) {
                var cn = pChildren[j]
                if (
                  cn.type === RuleType.htmlSelfClosing &&
                  cn._isClosingTag &&
                  cn.tag.toLowerCase() === tag
                ) {
                  // Found closing tag at pChildren[j]
                  // Before: pChildren[0..j-1] as paragraph + nodes[0..i-1]
                  // After: pChildren[j+1..] as paragraph + nodes[i+1..]
                  var before: MarkdownToJSX.ASTNode[] = nodes.slice(0, i)
                  if (j > 0) {
                    before.push({ type: RuleType.paragraph, children: pChildren.slice(0, j) } as MarkdownToJSX.ParagraphNode)
                  }
                  var after: MarkdownToJSX.ASTNode[] = []
                  if (j + 1 < pChildren.length) {
                    // Remaining paragraph children become nodes after close
                    var remaining = pChildren.slice(j + 1)
                    // Filter out trailing closing tags for parent elements
                    remaining = remaining.filter(function(r) {
                      return !(r.type === RuleType.htmlSelfClosing && r._isClosingTag)
                    })
                    if (remaining.length > 0) {
                      after = remaining
                    }
                  }
                  after = after.concat(nodes.slice(i + 1))
                  return { found: true, beforeClose: before, afterClose: after }
                }
              }
            }
            // Check direct closing tag
            if (
              (n.type === RuleType.htmlSelfClosing || n.type === RuleType.htmlBlock) &&
              n._isClosingTag &&
              n.tag.toLowerCase() === tag
            ) {
              return {
                found: true,
                beforeClose: nodes.slice(0, i),
                afterClose: nodes.slice(i + 1)
              }
            }
          }
          return { found: false, beforeClose: nodes, afterClose: [] }
        }

        var splitResult = findOwnCloseInAST(astNodes, tagLowerCheck)
        if (splitResult.found && splitResult.afterClose.length > 0) {
          var beforeProcessed = splitResult.beforeClose.flatMap(processNode)
          var afterProcessed = splitResult.afterClose.flatMap(processNode)
          return createRawElement(
            React.Fragment,
            {
              children: [
                h(
                  node.tag,
                  { key: state.key, ...htmlAttrsToJSXProps(node.attrs || {}) },
                  output(beforeProcessed, state)
                ),
                output(afterProcessed, state)
              ]
            },
            null
          )
        }

        return h(
          node.tag,
          { key: state.key, ...htmlAttrsToJSXProps(node.attrs || {}) },
          output(astNodes.flatMap(processNode), state)
        )
      }
      return h(
        node.tag,
        { key: state.key, ...htmlAttrsToJSXProps(node.attrs || {}) },
        node.children ? output(node.children, state) : ''
      )
    }

    case RuleType.htmlSelfClosing: {
      const htmlNode = node as MarkdownToJSX.HTMLSelfClosingNode

      // Apply options.tagfilter: escape dangerous self-closing tags
      if (options.tagfilter && util.shouldFilterTag(htmlNode.tag)) {
        var attrStr = ''
        if (htmlNode.attrs) {
          for (var k in htmlNode.attrs) {
            var v = htmlNode.attrs[k]
            if (v === true) attrStr += ' ' + k
            else if (v !== undefined && v !== null && v !== false)
              attrStr += ' ' + k + '="' + String(v) + '"'
          }
        }
        return h('span', { key: state.key }, '<' + htmlNode.tag + attrStr + ' />')
      }

      return h(node.tag, { key: state.key, ...htmlAttrsToJSXProps(node.attrs || {}) })
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
          <thead>
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

          <tbody>
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
  options: MarkdownToJSX.Options
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
          null, ast[i], renderer, state, h, sanitize, slug, refs, options
        )
        nodeOut = userRender(defaultRender, ast[i], renderer, state)
      } else {
        nodeOut = render(ast[i], renderer, state, h, sanitize, slug, refs, options)
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
 * @lang zh 将 AST 节点转换为 React JSX 元素
 * @lang hi AST नोड्स को React JSX एलिमेंट्स में बदलें
 *
 * @param ast - Array of AST nodes to render
 * @lang zh @param ast - 要渲染的 AST 节点数组
 * @lang hi @param ast - रेंडर करने के लिए AST नोड्स की सरणी
 * @param options - Compiler options
 * @lang zh @param options - 编译器选项
 * @lang hi @param options - कंपाइलर विकल्प
 * @returns React JSX element(s)
 * @lang zh @returns React JSX 元素
 * @lang hi @returns React JSX एलिमेंट(s)
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
  const hasOverrides = opts.overrides && Object.keys(opts.overrides).length > 0

  // Recursive compile function for HTML content
  const compileHTML = (input: string) =>
    compiler(input, { ...opts, wrapper: null })

  // JSX custom pragma — props are already JSX-compatible (htmlAttrsToJSXProps
  // is applied at call sites in render() that deal with HTML attributes).
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

    // Compile embedded HTML in prop values (needed for HTML block attrs that
    // contain JSX-like markup, e.g. component={<Inner />}).
    for (var pkey in finalProps) {
      var pval = finalProps[pkey]
      if (
        typeof pval === 'string' &&
        pval.length > 0 &&
        pval.charCodeAt(0) === $.CHAR_LT &&
        (parse.HTML_BLOCK_ELEMENT_START_R_ATTR.test(pval) ||
          parse.UPPERCASE_TAG_R.test(pval) ||
          parse.parseHTMLTag(pval, 0))
      ) {
        var compiled = compileHTML(pval.trim())
        finalProps[pkey] = pkey === 'innerHTML' && Array.isArray(compiled)
          ? compiled[0]
          : compiled
      }
    }

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

  const parseOptions: parse.ParseOptions = {
    ...opts,
    slugify: i => slug(i, util.slugify),
    sanitizer: sanitize,
    tagfilter: opts.tagfilter !== false,
  }

  const refs =
    ast[0] && ast[0].type === RuleType.refCollection
      ? (ast[0] as MarkdownToJSX.ReferenceCollectionNode).refs
      : {}

  const emitter = createRenderer(opts.renderRule, h, sanitize, slug, refs, opts)

  const arr = emitter(ast, {
    inline: opts.forceInline,
    refs: refs,
  }) as React.ReactNode[]

  // Extract footnotes from refs (keys starting with '^')
  const footnoteEntries: { identifier: string; footnote: string }[] = []
  for (const key in refs) {
    if (key.charCodeAt(0) === $.CHAR_CARET) {
      footnoteEntries.push({ identifier: key, footnote: refs[key].target })
    }
  }

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
 * @lang zh 将 Markdown 字符串编译为 React JSX 元素
 * @lang hi Markdown स्ट्रिंग को React JSX एलिमेंट्स में कंपाइल करें
 *
 * @param markdown - Markdown string to compile
 * @lang zh @param markdown - 要编译的 Markdown 字符串
 * @lang hi @param markdown - कंपाइल करने के लिए Markdown स्ट्रिंग
 * @param options - Compiler options
 * @lang zh @param options - 编译器选项
 * @lang hi @param options - कंपाइलर विकल्प
 * @returns React JSX element(s)
 * @lang zh @returns React JSX 元素
 * @lang hi @returns React JSX एलिमेंट(s)
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
      slugify: i => slug(i, util.slugify),
      sanitizer: sanitize,
      tagfilter: opts.tagfilter !== false,
    }

    // First pass: collect all reference definitions
    // This ensures refs are available during inline parsing, even when they appear after their usage
    if (!inline) {
      parse.collectReferenceDefinitions(input, refs, parseOptions)
    }

    // Inline trimEnd: trim trailing newlines and carriage returns
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

    // In streaming mode, strip trailing incomplete HTML tags to prevent infinite recursion
    if (opts.optimizeForStreaming) {
      // Find last '<' that doesn't have a matching '>'
      let lastLt = processedInput.lastIndexOf('<')
      if (lastLt !== -1) {
        let afterLt = processedInput.slice(lastLt)
        // Check if there's a complete tag (has '>')
        if (afterLt.indexOf('>') === -1) {
          // Incomplete tag - truncate before it
          processedInput = processedInput.slice(0, lastLt)
        }
      }
    }

    let astNodes = parse.parseMarkdown(
      inline ? input : processedInput,
      { inline: inline, refs: refs },
      parseOptions
    )

    return astToJSX(astNodes, {
      ...parseOptions,
      forceInline: inline,
    })
  }

  if (process.env.NODE_ENV !== 'production') {
    if (typeof markdown !== 'string') {
      throw new Error(`markdown-to-jsx: the first argument must be
                             a string`)
    }

    if (Object.prototype.toString.call(opts.overrides) !== '[object Object]') {
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

  const refs: { [key: string]: { target: string; title: string | undefined } } =
    {}

  const jsx = compile(markdown)

  return jsx
}

/**
 * React context provider for sharing compiler options across Markdown components
 * @lang zh 用于在 Markdown 组件之间共享编译器选项的 React 上下文提供者
 * @lang hi Markdown कंपोनेंट्स के बीच कंपाइलर विकल्प साझा करने के लिए React संदर्भ प्रदाता
 *
 * @param options - Default compiler options to share
 * @lang zh @param options - 要共享的默认编译器选项
 * @lang hi @param options - साझा करने के लिए डिफ़ॉल्ट कंपाइलर विकल्प
 * @param children - React children
 * @lang zh @param children - React 子元素
 * @lang hi @param children - React चाइल्ड एलिमेंट्स
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
 * A React component for easy markdown rendering. Feed the markdown content as a direct child
 * and the rest is taken care of automatically. Supports memoization for optimal performance.
 * @lang zh 用于轻松渲染 Markdown 的 React 组件。将 Markdown 内容作为直接子元素提供，其余部分会自动处理。支持记忆化以获得最佳性能。
 * @lang hi आसान markdown रेंडरिंग के लिए एक React कंपोनेंट। markdown सामग्री को सीधे चाइल्ड के रूप में प्रदान करें और बाकी स्वचालित रूप से संभाला जाता है। इष्टतम प्रदर्शन के लिए मेमोइज़ेशन का समर्थन करता है।
 *
 * @param children - Markdown string content
 * @lang zh @param children - Markdown 字符串内容
 * @lang hi @param children - Markdown स्ट्रिंग सामग्री
 * @param options - Compiler options
 * @lang zh @param options - 编译器选项
 * @lang hi @param options - कंपाइलर विकल्प
 * @param props - Additional HTML attributes for the wrapper element
 * @lang zh @param props - 包装元素的额外 HTML 属性
 * @lang hi @param props - रैपर एलिमेंट के लिए अतिरिक्त HTML एट्रिब्यूट्स
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
        ...props,
      } as React.JSX.IntrinsicAttributes,
    }),
    [contextOptions, options, props]
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
