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

// Mapping of lowercase HTML attributes to JSX prop names
// Moved outside function to avoid recreation on every call
const HTML_TO_JSX_MAP: Record<string, string> = {
  class: 'className',
  for: 'htmlFor',
  allowfullscreen: 'allowFullScreen',
  allowtransparency: 'allowTransparency',
  autocomplete: 'autoComplete',
  autofocus: 'autoFocus',
  autoplay: 'autoPlay',
  cellpadding: 'cellPadding',
  cellspacing: 'cellSpacing',
  charset: 'charSet',
  classid: 'classId',
  colspan: 'colSpan',
  contenteditable: 'contentEditable',
  contextmenu: 'contextMenu',
  crossorigin: 'crossOrigin',
  enctype: 'encType',
  formaction: 'formAction',
  formenctype: 'formEncType',
  formmethod: 'formMethod',
  formnovalidate: 'formNoValidate',
  formtarget: 'formTarget',
  frameborder: 'frameBorder',
  hreflang: 'hrefLang',
  inputmode: 'inputMode',
  keyparams: 'keyParams',
  keytype: 'keyType',
  marginheight: 'marginHeight',
  marginwidth: 'marginWidth',
  maxlength: 'maxLength',
  mediagroup: 'mediaGroup',
  minlength: 'minLength',
  novalidate: 'noValidate',
  radiogroup: 'radioGroup',
  readonly: 'readOnly',
  rowspan: 'rowSpan',
  spellcheck: 'spellCheck',
  srcdoc: 'srcDoc',
  srclang: 'srcLang',
  srcset: 'srcSet',
  tabindex: 'tabIndex',
  usemap: 'useMap',
}

/**
 * Convert HTML attributes to JSX props
 * Maps HTML attribute names (e.g., "class", "for") to JSX prop names (e.g., "className", "htmlFor")
 */
export function htmlAttrsToJSXProps(
  attrs: Record<string, any>
): Record<string, any> {
  var jsxProps: Record<string, any> = {}

  for (var key in attrs) {
    var keyLower = key.toLowerCase()
    var mappedKey = HTML_TO_JSX_MAP[keyLower]
    jsxProps[mappedKey || key] = attrs[key]
  }

  return jsxProps
}

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
          noInnerParse: true,
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
        let escapedTag: string
        if ('rawText' in htmlNode && typeof htmlNode.rawText === 'string') {
          escapedTag = htmlNode.rawText.replace(/^</, '&lt;')
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
          escapedTag = `&lt;${htmlNode.tag}${attrStr}&gt;`
        }
        return h('span', {
          key: state.key,
          dangerouslySetInnerHTML: { __html: escapedTag },
        })
      }

      if (htmlNode.text && htmlNode.noInnerParse) {
        // Type 1 blocks (script, style, pre, textarea) must have verbatim text content
        // React requires these tags to have a single string child, not parsed elements
        const tagLower = (htmlNode.tag as string).toLowerCase()
        const isType1Block = parse.isType1Block(tagLower)

        const containsHTMLTags = /<[a-z][^>]{0,100}>/i.test(htmlNode.text)
        const containsPreTags = /<\/?pre\b/i.test(htmlNode.text)

        if (isType1Block && !containsHTMLTags) {
          let textContent = htmlNode.text.replace(
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
            ? util.applyTagFilterToText(htmlNode.text)
            : htmlNode.text
          return h(node.tag, {
            key: state.key,
            ...node.attrs,
            dangerouslySetInnerHTML: { __html: innerHtml },
          })
        }
        // This handles JSX compilation where HTML content should be parsed
        const parseOptions: parse.ParseOptions = {
          slugify: (input: string) => slug(input, util.slugify),
          sanitizer: sanitize,
          tagfilter: true,
        }
        const cleanedText = htmlNode.text
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

        const astNodes = parse.parseMarkdown(
          cleanedText,
          { inline: false, refs: refs, inHTML: false },
          parseOptions
        )
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
        let escapedTag: string
        if ('rawText' in htmlNode && typeof htmlNode.rawText === 'string') {
          escapedTag = htmlNode.rawText.replace(/^</, '&lt;')
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
          escapedTag = `&lt;${htmlNode.tag}${attrStr} />`
        }
        return h('span', {
          key: state.key,
          dangerouslySetInnerHTML: { __html: escapedTag },
        })
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

export function astToJSX(
  ast: MarkdownToJSX.ASTNode[],
  options?: MarkdownToJSX.Options
): React.ReactNode {
  options.overrides = options.overrides || {}

  const slug = options.slugify || util.slugify
  const sanitize = options.sanitizer || util.sanitizer
  const createElement = options.createElement || React.createElement

  // Recursive compile function for HTML content
  const compileHTML = (input: string) =>
    compiler(input, { ...options, wrapper: null })

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
    const overrideProps = get(options.overrides, `${tag}.props`, {})

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
      getTag(tag, options.overrides),
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
      'text' in node &&
      node.text &&
      /<\/?pre\b/i.test(node.text) &&
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
      htmlNode.text += '\n' + combinedText
      i++ // Skip paragraph
    }
    postProcessedAst.push(node)
  }
  ast = postProcessedAst

  const parseOptions: parse.ParseOptions = {
    ...options,
    slugify: i => slug(i, util.slugify),
    sanitizer: sanitize,
    tagfilter: options.tagfilter !== false,
  }

  const refs =
    ast[0] && ast[0].type === RuleType.refCollection
      ? (ast[0] as MarkdownToJSX.ReferenceCollectionNode).refs
      : {}

  const emitter = createRenderer(
    options.renderRule,
    h,
    sanitize,
    slug,
    refs,
    options
  )

  const arr = emitter(ast, {
    inline: options.forceInline,
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

  if (options.wrapper === null) {
    return arr
  }

  const wrapper = options.wrapper || (options.forceInline ? 'span' : 'div')
  let jsx: React.ReactNode

  if (arr.length > 1 || options.forceWrapper) {
    jsx = arr
  } else if (arr.length === 1) {
    return arr[0]
  } else {
    return null
  }

  return createElement(
    wrapper,
    { key: 'outer', ...options.wrapperProps },
    jsx
  ) as React.JSX.Element
}

export function compiler(
  markdown: string = '',
  options: MarkdownToJSX.Options = {}
): React.ReactNode {
  options.overrides = options.overrides || {}

  const slug = options.slugify || util.slugify
  const sanitize = options.sanitizer || util.sanitizer

  function compile(input: string): React.ReactNode {
    const inline =
      options.forceInline ||
      (!options.forceBlock && !util.SHOULD_RENDER_AS_BLOCK_R.test(input))
    const parseOptions: parse.ParseOptions = {
      ...options,
      slugify: i => slug(i, util.slugify),
      sanitizer: sanitize,
      tagfilter: options.tagfilter !== false,
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

    if (
      Object.prototype.toString.call(options.overrides) !== '[object Object]'
    ) {
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
 * A simple HOC for easy React use. Feed the markdown content as a direct child
 * and the rest is taken care of automatically.
 */
export const Markdown: React.FC<
  Omit<React.HTMLAttributes<Element>, 'children'> & {
    children?: string | null
    options?: MarkdownToJSX.Options
  }
> = ({ children: rawChildren, options, ...props }) => {
  const children =
    rawChildren === null || rawChildren === undefined ? '' : rawChildren

  return compiler(children, {
    ...options,
    wrapperProps: {
      ...options?.wrapperProps,
      ...props,
    } as React.JSX.IntrinsicAttributes,
  })
}

// MarkdownToJSX namespace moved to types.ts

export default Markdown
