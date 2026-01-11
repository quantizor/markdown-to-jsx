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
function encodeUrlTarget(target: string): string {
  // Fast path: check if encoding is needed
  let needsEncoding = false
  for (let i = 0; i < target.length; i++) {
    const code = target.charCodeAt(i)
    if (code > 127 || code === $.CHAR_BACKSLASH || code === $.CHAR_BACKTICK) {
      needsEncoding = true
      break
    }
  }
  if (!needsEncoding) return target

  // Encode character by character, preserving existing percent-encoded sequences
  let result = ''
  for (let i = 0; i < target.length; i++) {
    const char = target[i]
    if (
      char === '%' &&
      i + 2 < target.length &&
      /[0-9A-Fa-f]/.test(target[i + 1]) &&
      /[0-9A-Fa-f]/.test(target[i + 2])
    ) {
      // Preserve existing percent-encoded sequence
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
          verbatim: true,
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
        <a key={state.key} href={sanitize(node.target, 'a', 'href')}>
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
        let tagText: string
        if ('rawText' in htmlNode && typeof htmlNode.rawText === 'string') {
          // Use raw text as-is, React will escape it
          tagText = htmlNode.rawText
        } else {
          // Simple attribute formatting for filtered tags
          let attrStr = ''
          if (htmlNode.attrs) {
            for (const [key, value] of Object.entries(htmlNode.attrs)) {
              if (value === true) {
                attrStr += ` ${key}`
              } else if (
                value !== undefined &&
                value !== null &&
                value !== false
              ) {
                attrStr += ` ${key}="${String(value)}"`
              }
            }
          }
          tagText = `<${htmlNode.tag}${attrStr}>`
        }
        // Pass unescaped tag as text child - React will escape it automatically
        return h('span', { key: state.key }, tagText)
      }

      if (htmlNode.rawText && htmlNode.verbatim) {
        // For verbatim blocks, always use rawText for rendering (CommonMark compliance)
        // Children are available for renderRule but default rendering uses rawText
        const tagLower = (htmlNode.tag as string).toLowerCase()
        const isType1Block = parse.isType1Block(tagLower)

        const containsHTMLTags = /<[a-z][^>]{0,100}>/i.test(htmlNode.rawText)
        const containsPreTags = /<\/?pre\b/i.test(htmlNode.rawText)

        if (isType1Block && !containsHTMLTags) {
          let textContent = htmlNode.rawText.replace(
            new RegExp('\\s*</' + tagLower + '>\\s*$', 'i'),
            ''
          )
          if (options.tagfilter) {
            textContent = util.applyTagFilterToText(textContent)
          }
          return h(node.tag, { key: state.key, ...node.attrs }, textContent)
        }

        if (containsPreTags) {
          const innerHtml = options.tagfilter
            ? util.applyTagFilterToText(htmlNode.rawText)
            : htmlNode.rawText
          return h(node.tag, {
            key: state.key,
            ...node.attrs,
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
        const cleanedText = htmlNode.rawText
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
          return h(node.tag, { key: state.key, ...node.attrs })
        }

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
          )
            return []
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

        const hasNoAttrs =
          !htmlNode.attrs || Object.keys(htmlNode.attrs).length === 0

        // Case 1: rawText contains full outer block AND no parsed attrs
        // Skip wrapper and render the parsed nodes directly (attrs are in rawText)
        if (startsWithOwnTag && endsWithClosingTag && hasNoAttrs) {
          return output(astNodes.flatMap(processNode), state)
        }

        // Case 2: rawText contains full outer block AND we have parsed attrs (#781)
        // Use children array instead of re-parsing rawText to avoid duplication
        // The children contain the inner content without the outer tags
        if (
          startsWithOwnTag &&
          endsWithClosingTag &&
          htmlNode.children &&
          htmlNode.children.length > 0
        ) {
          return h(
            node.tag,
            { key: state.key, ...node.attrs },
            output(htmlNode.children, state)
          )
        }

        return h(
          node.tag,
          { key: state.key, ...node.attrs },
          output(astNodes.flatMap(processNode), state)
        )
      }
      return h(
        node.tag,
        { key: state.key, ...node.attrs },
        node.children ? output(node.children, state) : ''
      )
    }

    case RuleType.htmlSelfClosing: {
      const htmlNode = node as MarkdownToJSX.HTMLSelfClosingNode

      // Apply options.tagfilter: escape dangerous self-closing tags
      if (options.tagfilter && util.shouldFilterTag(htmlNode.tag)) {
        let tagText: string
        if ('rawText' in htmlNode && typeof htmlNode.rawText === 'string') {
          // Use raw text as-is, React will escape it
          tagText = htmlNode.rawText
        } else {
          // Simple attribute formatting for filtered self-closing tags
          let attrStr = ''
          if (htmlNode.attrs) {
            for (const [key, value] of Object.entries(htmlNode.attrs)) {
              if (value === true) {
                attrStr += ` ${key}`
              } else if (
                value !== undefined &&
                value !== null &&
                value !== false
              ) {
                attrStr += ` ${key}="${String(value)}"`
              }
            }
          }
          tagText = `<${htmlNode.tag}${attrStr} />`
        }
        // Pass unescaped tag as text child - React will escape it automatically
        return h('span', { key: state.key }, tagText)
      }

      return h(node.tag, { key: state.key, ...node.attrs })
    }

    case RuleType.image: {
      return (
        <img
          key={state.key}
          alt={node.alt && node.alt.length > 0 ? node.alt : undefined}
          title={node.title || undefined}
          src={sanitize(node.target, 'img', 'src')}
        />
      )
    }

    case RuleType.link: {
      const props: Record<string, unknown> = { key: state.key }
      if (node.target != null) {
        // Entity references are already decoded during parsing (per CommonMark spec)
        // URL-encode backslashes and backticks (per CommonMark spec)
        props.href = encodeUrlTarget(node.target)
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
  const renderRule = (
    node: MarkdownToJSX.ASTNode,
    renderChildren: (children: MarkdownToJSX.ASTNode[]) => React.ReactNode,
    state: MarkdownToJSX.State
  ) => {
    const defaultRender = () =>
      render(node, renderChildren, state, h, sanitize, slug, refs, options)
    return userRender
      ? userRender(defaultRender, node, renderChildren, state)
      : defaultRender()
  }
  const handleStackOverflow = (ast: MarkdownToJSX.ASTNode[]) =>
    ast.map(node => ('text' in node ? node.text : ''))
  const renderer = (
    ast: MarkdownToJSX.ASTNode[],
    state: MarkdownToJSX.State = {}
  ) => {
    const depth = (state.renderDepth || 0) + 1
    if (depth > 2500) return handleStackOverflow(ast)
    state.renderDepth = depth

    const oldKey = state.key,
      result: React.ReactNode[] = []
    let lastWasString = false
    for (let i = 0; i < ast.length; i++) {
      state.key = i
      const nodeOut = renderRule(ast[i], renderer, state),
        isString = typeof nodeOut === 'string'
      if (isString && lastWasString) {
        // Concatenate consecutive strings
        result[result.length - 1] += nodeOut
      } else if (nodeOut !== null) {
        if (Array.isArray(nodeOut)) {
          // Use loop instead of spread for better performance
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
    return result
  }
  return renderer
}

const cx = (...args) => args.filter(Boolean).join(' ')

const get = (source, path, fallback) => {
  let result = source,
    segments = path.split('.'),
    i = 0
  while (i < segments.length) {
    result = result?.[segments[i]]
    if (result === undefined) break
    i++
  }
  return result || fallback
}

const getTag = (tag, overrides) => {
  const override = get(overrides, tag, undefined)
  return !override
    ? tag
    : typeof override === 'function' ||
        (typeof override === 'object' && 'render' in override)
      ? override
      : get(overrides, `${tag}.component`, tag)
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
  const createElement = opts.createElement || React.createElement

  // Recursive compile function for HTML content
  const compileHTML = (input: string) =>
    compiler(input, { ...opts, wrapper: null })

  // JSX custom pragma
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
    const overrideProps = get(opts.overrides, `${tag}.props`, {})

    // Convert HTML attributes to JSX props and compile any HTML content
    const jsxProps = htmlAttrsToJSXProps(props || {})
    if (compileHTML) {
      for (const [key, value] of Object.entries(jsxProps)) {
        if (
          typeof value === 'string' &&
          value.length > 0 &&
          value[0] === '<' &&
          (parse.HTML_BLOCK_ELEMENT_START_R_ATTR.test(value) ||
            parse.UPPERCASE_TAG_R.test(value) ||
            parse.parseHTMLTag(value, 0))
        ) {
          jsxProps[key] = compileHTML(value.trim())
        }
      }
    }

    return createElement(
      getTag(tag, opts.overrides),
      {
        ...jsxProps,
        ...overrideProps,
        className:
          cx(jsxProps?.className, overrideProps.className) || undefined,
      },
      ...children
    )
  }

  // Post-process AST for JSX compatibility: combine HTML blocks with following paragraphs
  // when the HTML block contains <pre> tags (to keep pre content as plain text)
  const postProcessedAst: MarkdownToJSX.ASTNode[] = []
  for (let i = 0; i < ast.length; i++) {
    const node = ast[i]
    if (
      node.type === RuleType.htmlBlock &&
      'rawText' in node &&
      node.rawText &&
      /<\/?pre\b/i.test(node.rawText) &&
      i + 1 < ast.length &&
      ast[i + 1].type === RuleType.paragraph &&
      'removedClosingTags' in ast[i + 1] &&
      (
        ast[i + 1] as MarkdownToJSX.ParagraphNode & {
          removedClosingTags?: MarkdownToJSX.ASTNode[]
        }
      ).removedClosingTags
    ) {
      const htmlNode = node as MarkdownToJSX.HTMLNode,
        paragraphNode = ast[i + 1] as MarkdownToJSX.ParagraphNode & {
          removedClosingTags?: MarkdownToJSX.ASTNode[]
        }
      function extractText(nodes: MarkdownToJSX.ASTNode[]): string {
        let text = ''
        for (const n of nodes) {
          const type = n.type
          if (type === RuleType.text) text += (n as MarkdownToJSX.TextNode).text
          else if (
            type === RuleType.htmlSelfClosing &&
            'rawText' in n &&
            (n as MarkdownToJSX.HTMLSelfClosingNode & { rawText?: string })
              .rawText
          )
            text += (
              n as MarkdownToJSX.HTMLSelfClosingNode & { rawText?: string }
            ).rawText!
          else if (type === RuleType.textFormatted) {
            const formattedNode = n as MarkdownToJSX.FormattedTextNode
            const marker =
              formattedNode.tag === 'em'
                ? '_'
                : formattedNode.tag === 'strong'
                  ? '**'
                  : ''
            text += marker + extractText(formattedNode.children) + marker
          } else if ('children' in n && n.children)
            text += extractText(n.children)
        }
        return text
      }
      let combinedText = extractText(paragraphNode.children)
      if (paragraphNode.removedClosingTags) {
        combinedText += paragraphNode.removedClosingTags
          .filter(
            (tag: MarkdownToJSX.ASTNode) =>
              tag.type === RuleType.htmlSelfClosing &&
              'rawText' in tag &&
              (
                tag as MarkdownToJSX.HTMLSelfClosingNode & {
                  rawText?: string
                }
              ).rawText &&
              (
                tag as MarkdownToJSX.HTMLSelfClosingNode & {
                  rawText?: string
                }
              ).rawText!.indexOf(`</${htmlNode.tag}>`) === -1
          )
          .map((tag: MarkdownToJSX.ASTNode) =>
            tag.type === RuleType.htmlSelfClosing && 'rawText' in tag
              ? (
                  tag as MarkdownToJSX.HTMLSelfClosingNode & {
                    rawText?: string
                  }
                ).rawText || ''
              : ''
          )
          .join('')
      }
      htmlNode.rawText = (htmlNode.rawText || '') + '\n' + combinedText
      htmlNode.text = htmlNode.rawText // @deprecated - use rawText instead
      i++ // Skip paragraph
    }
    postProcessedAst.push(node)
  }
  ast = postProcessedAst

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

  return createElement(
    wrapper,
    { key: 'outer', ...opts.wrapperProps },
    jsx
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
