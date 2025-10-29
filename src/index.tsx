/* @jsx h */
import * as React from 'react'
import {
  parseBlockQuote,
  parseBreakThematic,
  parseCodeBlock,
  parseCodeFenced,
  parseFootnote,
  parseHeading,
  parseHeadingSetext,
  parseHTMLBlock,
  parseHTMLComment,
  parseHTMLSelfClosing,
  parseInlineSpan,
  ParseOptions,
  parseOrderedList,
  parseParagraph,
  parseRef,
  parseTable,
  parseUnorderedList,
} from './parse'
import { MarkdownToJSX, RuleType } from './types'
import {
  camelCaseCss,
  NAMED_CODES_TO_UNICODE,
  sanitizer,
  slugify,
} from './utils'

export { type MarkdownToJSX, RuleType } from './types'
export {
  camelCaseCss,
  NAMED_CODES_TO_UNICODE,
  sanitizer,
  slugify,
} from './utils'

const FRONT_MATTER_R = /^---[ \t]*\n(.|\n)*\n---[ \t]*\n/
const SHOULD_RENDER_AS_BLOCK_R = /(\n|^[-*]\s|^#|^ {2,}|^-{2,}|^>\s)/
const TRIM_STARTING_NEWLINES = /^\n+/

function isString(value: any): value is string {
  return typeof value === 'string'
}

function trimEnd(str: string) {
  let end = str.length
  while (end > 0 && str[end - 1] <= ' ') end--
  return str.slice(0, end)
}

function getTableStyle(node, colIndex) {
  return node.align[colIndex] == null
    ? {}
    : {
        textAlign: node.align[colIndex],
      }
}

function render(
  node: MarkdownToJSX.ASTNode,
  output: MarkdownToJSX.ASTRender,
  state: MarkdownToJSX.State,
  h: (tag: any, props: any, ...children: any[]) => any,
  sanitize: (value: string, tag: string, attribute: string) => string | null,
  slug: (input: string, defaultFn: (input: string) => string) => string,
  refs: { [key: string]: { target: string; title: string } }
): React.ReactNode {
  switch (node.type) {
    case RuleType.blockQuote: {
      const props = {
        key: state.key,
      } as Record<string, unknown>

      if (node.alert) {
        props.className =
          'markdown-alert-' + slug(node.alert.toLowerCase(), slugify)

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

    case RuleType.codeBlock:
      return (
        <pre key={state.key}>
          <code
            {...node.attrs}
            className={node.lang ? `lang-${node.lang}` : ''}
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
      const attrsBlock = normalizeHtmlAttributes(node.attrs)
      return h(
        node.tag,
        { key: state.key, ...attrsBlock },
        node.text || (node.children ? output(node.children, state) : '')
      )
    }

    case RuleType.htmlSelfClosing: {
      const attrsSelf = normalizeHtmlAttributes(node.attrs)
      return h(node.tag, { key: state.key, ...attrsSelf })
    }

    case RuleType.image:
      return (
        <img
          key={state.key}
          alt={node.alt || undefined}
          title={node.title || undefined}
          src={sanitize(node.target, 'img', 'src')}
        />
      )

    case RuleType.link: {
      const href =
        node.target !== null ? sanitize(node.target, 'a', 'href') : null
      const props: Record<string, unknown> = { key: state.key }
      if (href != null) {
        props.href = href
      }
      if (node.title) {
        props.title = node.title
      }
      return h('a', props, output(node.children, state))
    }

    case RuleType.refImage:
      return refs[node.ref] ? (
        <img
          key={state.key}
          alt={node.alt}
          src={sanitize(refs[node.ref].target, 'img', 'src')}
          title={refs[node.ref].title}
        />
      ) : null

    case RuleType.refLink:
      return refs[node.ref] ? (
        <a
          key={state.key}
          href={sanitize(refs[node.ref].target, 'a', 'href')}
          title={refs[node.ref].title}
        >
          {output(node.children, state)}
        </a>
      ) : (
        <span key={state.key}>{node.fallbackChildren}</span>
      )

    case RuleType.table: {
      const table = node as MarkdownToJSX.TableNode
      return (
        <table key={state.key}>
          <thead>
            <tr>
              {table.header.map(function generateHeaderCell(content, i) {
                return (
                  <th key={i} style={getTableStyle(table, i)}>
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
                      <td key={c} style={getTableStyle(table, c)}>
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
      const Tag = node.ordered ? 'ol' : 'ul'

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

    case RuleType.newlineCoalescer:
      return '\n'

    case RuleType.paragraph:
      return <p key={state.key}>{output(node.children, state)}</p>

    default:
      return null
  }
}

function createRenderer(
  userRender: MarkdownToJSX.Options['renderRule'] | undefined,
  h: (tag: any, props: any, ...children: any[]) => any,
  sanitize: (value: string, tag: string, attribute: string) => string | null,
  slug: (input: string, defaultFn: (input: string) => string) => string,
  refs: { [key: string]: { target: string; title: string } }
) {
  function renderRule(
    ast: MarkdownToJSX.ASTNode,
    renderer: MarkdownToJSX.ASTRender,
    state: MarkdownToJSX.State
  ): React.ReactNode {
    const nodeRender = () =>
      render(ast, renderer, state, h, sanitize, slug, refs)
    return userRender
      ? userRender(nodeRender, ast, renderer, state)
      : nodeRender()
  }

  // Return plain text as fallback to prevent stack overflow
  function handleStackOverflow(
    ast: MarkdownToJSX.ASTNode | MarkdownToJSX.ASTNode[]
  ) {
    if (Array.isArray(ast)) {
      return ast.map(node => ('text' in node ? node.text : ''))
    }
    return 'text' in ast ? ast.text : ''
  }

  return function patchedRender(
    ast: MarkdownToJSX.ASTNode | MarkdownToJSX.ASTNode[],
    state: MarkdownToJSX.State = {}
  ): React.ReactNode {
    // Track render depth to prevent stack overflow from extremely deep nesting
    const currentDepth = (state.renderDepth || 0) + 1
    const MAX_RENDER_DEPTH = 2500

    if (currentDepth > MAX_RENDER_DEPTH) {
      return handleStackOverflow(ast)
    }

    state.renderDepth = currentDepth

    try {
      if (Array.isArray(ast)) {
        const oldKey = state.key
        const result = []

        // map nestedOutput over the ast, except group any text
        // nodes together into a single string output.
        let lastWasString = false

        for (let i = 0; i < ast.length; i++) {
          state.key = i

          const nodeOut = patchedRender(ast[i], state)
          const _isString = isString(nodeOut)

          if (_isString && lastWasString) {
            result[result.length - 1] += nodeOut
          } else if (nodeOut !== null) {
            // If renderRule returned an array, spread it into result (React handles arrays as children)
            if (Array.isArray(nodeOut)) {
              result.push(...nodeOut)
            } else {
              result.push(nodeOut)
            }
          }

          lastWasString = _isString
        }

        state.key = oldKey
        state.renderDepth = currentDepth - 1

        return result
      }

      const result = renderRule(ast, patchedRender, state)
      state.renderDepth = currentDepth - 1

      return result
    } catch (error) {
      // Catch stack overflow or other unexpected errors
      if (
        error instanceof RangeError &&
        error.message.includes('Maximum call stack')
      ) {
        // Log error asynchronously to avoid stack overflow
        if (process.env.NODE_ENV !== 'production') {
          try {
            console.error(
              'markdown-to-jsx: Stack overflow during rendering. ' +
                'This usually indicates extremely nested content. ' +
                'Consider breaking up the nested structure.'
            )
          } catch (e) {
            // If console.error fails, silently continue - no more stack available
          }
        }

        return handleStackOverflow(ast)
      }

      // Re-throw other errors
      throw error
    }
  }
}

function cx(...args) {
  return args.filter(Boolean).join(' ')
}

function get(src: Object, path: string, fb?: any) {
  let ptr = src
  const frags = path.split('.')

  while (frags.length) {
    ptr = ptr[frags[0]]

    if (ptr === undefined) break
    else frags.shift()
  }

  return ptr || fb
}

function getTag(tag: string, overrides: MarkdownToJSX.Overrides) {
  const override = get(overrides, tag)

  if (!override) return tag

  return typeof override === 'function' ||
    (typeof override === 'object' && 'render' in override)
    ? override
    : get(overrides, `${tag}.component`, tag)
}

export function compiler(
  markdown: string,
  options: MarkdownToJSX.Options & {
    ast: true
  }
): MarkdownToJSX.ASTNode[]
export function compiler(
  markdown: string,
  options: MarkdownToJSX.Options & {
    wrapper: null
  }
): React.ReactNode
export function compiler(
  markdown: string,
  options?: MarkdownToJSX.Options
): React.JSX.Element
export function compiler(
  markdown: string = '',
  options: MarkdownToJSX.Options = {}
): React.ReactNode | MarkdownToJSX.ASTNode[] {
  const isDebug = !!process.env.DEBUG

  let parseMetrics: {
    blockParsers: { [key: string]: { attempts: number; hits: number } }
    inlineParsers: { [key: string]: { attempts: number; hits: number } }
    totalOperations: number
    blockParseIterations: number
    inlineParseIterations: number
  } | null = null

  if (isDebug) {
    parseMetrics = {
      blockParsers: {
        codeBlock: { attempts: 0, hits: 0 },
        blockQuote: { attempts: 0, hits: 0 },
        heading: { attempts: 0, hits: 0 },
        headingSetext: { attempts: 0, hits: 0 },
        breakThematic: { attempts: 0, hits: 0 },
        codeFenced: { attempts: 0, hits: 0 },
        unorderedList: { attempts: 0, hits: 0 },
        orderedList: { attempts: 0, hits: 0 },
        table: { attempts: 0, hits: 0 },
        htmlComment: { attempts: 0, hits: 0 },
        htmlBlock: { attempts: 0, hits: 0 },
        htmlSelfClosing: { attempts: 0, hits: 0 },
        footnote: { attempts: 0, hits: 0 },
        ref: { attempts: 0, hits: 0 },
        paragraph: { attempts: 0, hits: 0 },
        noMatch: { attempts: 0, hits: 0 },
      },
      inlineParsers: {
        escaped: { attempts: 0, hits: 0 },
        footnoteRef: { attempts: 0, hits: 0 },
        ref: { attempts: 0, hits: 0 },
        gfmTask: { attempts: 0, hits: 0 },
        refLink: { attempts: 0, hits: 0 },
        link: { attempts: 0, hits: 0 },
        angleBraceLink: { attempts: 0, hits: 0 },
        htmlComment: { attempts: 0, hits: 0 },
        htmlElement: { attempts: 0, hits: 0 },
        htmlSelfClosing: { attempts: 0, hits: 0 },
        formatting: { attempts: 0, hits: 0 },
        breakLine: { attempts: 0, hits: 0 },
        codeInline: { attempts: 0, hits: 0 },
        refImage: { attempts: 0, hits: 0 },
        image: { attempts: 0, hits: 0 },
        bareUrl: { attempts: 0, hits: 0 },
        text: { attempts: 0, hits: 0 },
      },
      totalOperations: 0,
      blockParseIterations: 0,
      inlineParseIterations: 0,
    }
  }

  options.overrides = options.overrides || {}
  options.namedCodesToUnicode = options.namedCodesToUnicode
    ? { ...NAMED_CODES_TO_UNICODE, ...options.namedCodesToUnicode }
    : NAMED_CODES_TO_UNICODE

  const slug = options.slugify || slugify
  const sanitize = options.sanitizer || sanitizer
  const createElement = options.createElement || React.createElement

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

    return createElement(
      getTag(tag, options.overrides),
      {
        ...props,
        ...overrideProps,
        className: cx(props?.className, overrideProps.className) || undefined,
      },
      ...children
    )
  }

  function compile(input: string): React.ReactNode | MarkdownToJSX.ASTNode[] {
    input = input.replace(FRONT_MATTER_R, '')

    let inline = false

    if (options.forceInline) {
      inline = true
    } else if (!options.forceBlock) {
      /**
       * should not contain any block-level markdown like newlines, lists, headings,
       * thematic breaks, blockquotes, tables, etc
       */
      inline = SHOULD_RENDER_AS_BLOCK_R.test(input) === false
    }

    const parseOptions: ParseOptions = {
      ...options,
      slugify: (input: string) => slug(input, slugify),
      sanitizer: sanitize,
      compile: compile,
      parseMetrics: parseMetrics,
    }

    const astNodes = parseMarkdown(
      inline
        ? input
        : `${trimEnd(input).replace(TRIM_STARTING_NEWLINES, '')}\n\n`,
      { inline: inline, footnotes: footnotes, refs: refs },
      parseOptions
    )

    if (options.ast) {
      return astNodes
    }

    const arr = emitter(astNodes) as React.ReactNode[]

    while (
      isString(arr[arr.length - 1]) &&
      !(arr[arr.length - 1] as string).trim()
    ) {
      arr.pop()
    }

    if (footnotes.length) {
      arr.push(
        <footer key="footer">
          {footnotes.map(function createFootnote(def) {
            // Footnotes are parsed with preserveNewlines to match old parser behavior
            // This preserves newlines and indentation in the rendered output
            const footnoteAstNodes = parseMarkdown(
              def.footnote,
              { inline: true, refs: refs, preserveNewlines: true },
              parseOptions
            )
            return h(
              'div',
              { id: slug(def.identifier, slugify), key: def.identifier },
              def.identifier + ': ',
              emitter(footnoteAstNodes)
            )
          })}
        </footer>
      )
    }

    if (options.wrapper === null) {
      return arr
    }

    const wrapper = options.wrapper || (inline ? 'span' : 'div')
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

  const footnotes: { footnote: string; identifier: string }[] = []
  const refs: { [key: string]: { target: string; title: string | undefined } } =
    {}

  function parseMarkdown(
    input: string,
    state: MarkdownToJSX.State,
    options: ParseOptions
  ): MarkdownToJSX.ASTNode[] {
    const isDebug = !!process.env.DEBUG
    const parseMetrics = options.parseMetrics
    const result: MarkdownToJSX.ASTNode[] = []
    let pos = 0

    // If inline mode, just parse the entire input as inline content
    if (state.inline) {
      const inlineNodes = parseInlineSpan(
        input,
        0,
        input.length,
        state,
        options
      )
      return inlineNodes
    }

    // Block parsing mode
    while (pos < input.length) {
      if (isDebug && parseMetrics) {
        parseMetrics.blockParseIterations++
        parseMetrics.totalOperations++
      }

      // Skip leading newlines (but preserve whitespace for indented code blocks)
      while (pos < input.length && input[pos] === '\n') {
        pos++
        if (isDebug && parseMetrics) {
          parseMetrics.totalOperations++
        }
      }

      if (pos >= input.length) break

      const char = input[pos]
      let matched = false

      // Check for indented code blocks BEFORE skipping whitespace
      if (!matched && (char === ' ' || char === '\t')) {
        if (isDebug && parseMetrics) {
          parseMetrics.blockParsers.codeBlock.attempts++
        }
        const parseResult = parseCodeBlock(input, pos)
        if (parseResult) {
          if (isDebug && parseMetrics) {
            parseMetrics.blockParsers.codeBlock.hits++
          }
          result.push(parseResult.node)
          pos = parseResult.endPos
          matched = true
        }
      }

      // Try different parsers based on the first character
      if (!matched) {
        // Block quote
        if (char === '>') {
          if (isDebug && parseMetrics) {
            parseMetrics.blockParsers.blockQuote.attempts++
          }
          const parseResult = parseBlockQuote(input, pos, state, options)
          if (parseResult) {
            if (isDebug && parseMetrics) {
              parseMetrics.blockParsers.blockQuote.hits++
            }
            result.push(parseResult.node)
            pos = parseResult.endPos
            matched = true
          }
        }
      }

      if (!matched) {
        // Heading (ATX style)
        if (char === '#') {
          if (isDebug && parseMetrics) {
            parseMetrics.blockParsers.heading.attempts++
          }
          const parseResult = parseHeading(input, pos, state, options)
          if (parseResult) {
            if (isDebug && parseMetrics) {
              parseMetrics.blockParsers.heading.hits++
            }
            result.push(parseResult.node)
            pos = parseResult.endPos
            matched = true
          }
        }
      }

      if (!matched) {
        // Heading (Setext style) - check after other parsers that might match
        if (isDebug && parseMetrics) {
          parseMetrics.blockParsers.headingSetext.attempts++
        }
        const parseResult = parseHeadingSetext(input, pos, state, options)
        if (parseResult) {
          if (isDebug && parseMetrics) {
            parseMetrics.blockParsers.headingSetext.hits++
          }
          result.push(parseResult.node)
          pos = parseResult.endPos
          matched = true
        }
      }

      if (!matched) {
        // Thematic break
        if (char === '-' || char === '*' || char === '_') {
          if (isDebug && parseMetrics) {
            parseMetrics.blockParsers.breakThematic.attempts++
          }
          const parseResult = parseBreakThematic(input, pos)
          if (parseResult) {
            if (isDebug && parseMetrics) {
              parseMetrics.blockParsers.breakThematic.hits++
            }
            result.push(parseResult.node)
            pos = parseResult.endPos
            matched = true
          }
        }
      }

      if (!matched) {
        // Code block (fenced)
        if (char === '`') {
          if (isDebug && parseMetrics) {
            parseMetrics.blockParsers.codeFenced.attempts++
          }
          const parseResult = parseCodeFenced(input, pos, state, options)
          if (parseResult) {
            if (isDebug && parseMetrics) {
              parseMetrics.blockParsers.codeFenced.hits++
            }
            result.push(parseResult.node)
            pos = parseResult.endPos
            matched = true
          }
        }
      }

      if (!matched) {
        // List
        if (
          char === '-' ||
          char === '*' ||
          char === '+' ||
          (char >= '0' && char <= '9')
        ) {
          // Try unordered list first
          if (isDebug && parseMetrics) {
            parseMetrics.blockParsers.unorderedList.attempts++
          }
          let parseResult = parseUnorderedList(input, pos, state, options)
          if (parseResult) {
            if (isDebug && parseMetrics) {
              parseMetrics.blockParsers.unorderedList.hits++
            }
            result.push(parseResult.node)
            pos = parseResult.endPos
            matched = true
          } else {
            // Try ordered list
            if (isDebug && parseMetrics) {
              parseMetrics.blockParsers.orderedList.attempts++
            }
            parseResult = parseOrderedList(input, pos, state, options)
            if (parseResult) {
              if (isDebug && parseMetrics) {
                parseMetrics.blockParsers.orderedList.hits++
              }
              result.push(parseResult.node)
              pos = parseResult.endPos
              matched = true
            }
          }
        }
      }

      if (!matched) {
        // Table
        if (char === '|') {
          if (isDebug && parseMetrics) {
            parseMetrics.blockParsers.table.attempts++
          }
          const parseResult = parseTable(input, pos, state, options)
          if (parseResult) {
            if (isDebug && parseMetrics) {
              parseMetrics.blockParsers.table.hits++
            }
            result.push(parseResult.node)
            pos = parseResult.endPos
            matched = true
          }
        }
      }

      if (!matched) {
        // HTML elements (honor disableParsingRawHTML)
        if (char === '<' && !options.disableParsingRawHTML) {
          // Try HTML comment first
          if (isDebug && parseMetrics) {
            parseMetrics.blockParsers.htmlComment.attempts++
          }
          let parseResult = parseHTMLComment(input, pos)
          if (parseResult) {
            if (isDebug && parseMetrics) {
              parseMetrics.blockParsers.htmlComment.hits++
            }
            result.push(parseResult.node)
            pos = parseResult.endPos
            matched = true
          } else {
            // Try HTML block first (handles both self-closing and block tags)
            if (isDebug && parseMetrics) {
              parseMetrics.blockParsers.htmlBlock.attempts++
            }
            parseResult = parseHTMLBlock(input, pos, state, options)
            if (parseResult) {
              if (isDebug && parseMetrics) {
                parseMetrics.blockParsers.htmlBlock.hits++
              }
              result.push(parseResult.node)
              pos = parseResult.endPos
              matched = true
            } else {
              // Fallback to self-closing HTML
              if (isDebug && parseMetrics) {
                parseMetrics.blockParsers.htmlSelfClosing.attempts++
              }
              parseResult = parseHTMLSelfClosing(input, pos, state, options)
              if (parseResult) {
                if (isDebug && parseMetrics) {
                  parseMetrics.blockParsers.htmlSelfClosing.hits++
                }
                result.push(parseResult.node)
                pos = parseResult.endPos
                matched = true
              }
            }
          }
        }
      }

      if (!matched) {
        // Footnote definition (skip leading whitespace)
        let checkPos = pos
        while (
          checkPos < input.length &&
          (input[checkPos] === ' ' || input[checkPos] === '\t')
        ) {
          checkPos++
        }
        if (
          checkPos < input.length &&
          input[checkPos] === '[' &&
          checkPos + 1 < input.length &&
          input[checkPos + 1] === '^'
        ) {
          if (isDebug && parseMetrics) {
            parseMetrics.blockParsers.footnote.attempts++
          }
          const parseResult = parseFootnote(input, checkPos, footnotes)
          if (parseResult) {
            if (isDebug && parseMetrics) {
              parseMetrics.blockParsers.footnote.hits++
            }
            // Footnotes don't produce visible content, just stored
            pos = parseResult.endPos
            matched = true
          }
        }
      }

      if (!matched) {
        // Reference definition
        if (char === '[') {
          if (isDebug && parseMetrics) {
            parseMetrics.blockParsers.ref.attempts++
          }
          const parseResult = parseRef(input, pos, refs)
          if (parseResult) {
            if (isDebug && parseMetrics) {
              parseMetrics.blockParsers.ref.hits++
            }
            // References don't produce visible content, just stored
            pos = parseResult.endPos
            matched = true
          }
        }
      }

      if (!matched) {
        // Paragraph (fallback for any remaining content)
        if (isDebug && parseMetrics) {
          parseMetrics.blockParsers.paragraph.attempts++
        }
        const parseResult = parseParagraph(input, pos, state, options)
        if (parseResult) {
          if (isDebug && parseMetrics) {
            parseMetrics.blockParsers.paragraph.hits++
          }
          result.push(parseResult.node)
          pos = parseResult.endPos
          matched = true
        }
      }

      // If nothing matched, advance by one character to avoid infinite loop
      if (!matched) {
        if (isDebug && parseMetrics) {
          parseMetrics.blockParsers.noMatch.attempts++
          parseMetrics.blockParsers.noMatch.hits++
        }
        pos++
      }
    }

    // Note: Memory snapshot "After block parsing" is taken in compiler function
    // after parseMarkdown returns, not here

    // Footnotes footer is appended during rendering phase (old rule system)
    // to preserve legacy snapshot behavior. Do not emit here to avoid duplicates.

    return result
  }

  const emitter = createRenderer(options.renderRule, h, sanitize, slug, refs)

  const jsx = compile(markdown)

  if (isDebug && parseMetrics) {
    console.log('='.repeat(60))
    console.log('MARKDOWN PARSING METRICS')
    console.log('='.repeat(60))
    console.log('\nBlock Parser Performance:')
    console.log('-'.repeat(60))
    for (const parser in parseMetrics.blockParsers) {
      const stats = parseMetrics.blockParsers[parser]
      const hitRate =
        stats.attempts > 0
          ? ((stats.hits / stats.attempts) * 100).toFixed(2)
          : '0.00'
      const missRate =
        stats.attempts > 0
          ? (((stats.attempts - stats.hits) / stats.attempts) * 100).toFixed(2)
          : '0.00'
      console.log(
        `  ${parser.padEnd(20)} Attempts: ${stats.attempts
          .toString()
          .padStart(6)} Hits: ${stats.hits
          .toString()
          .padStart(6)} (${hitRate}% hit, ${missRate}% miss)`
      )
    }

    console.log('\nInline Parser Performance:')
    console.log('-'.repeat(60))
    for (const parser in parseMetrics.inlineParsers) {
      const stats = parseMetrics.inlineParsers[parser]
      const hitRate =
        stats.attempts > 0
          ? ((stats.hits / stats.attempts) * 100).toFixed(2)
          : '0.00'
      const missRate =
        stats.attempts > 0
          ? (((stats.attempts - stats.hits) / stats.attempts) * 100).toFixed(2)
          : '0.00'
      console.log(
        `  ${parser.padEnd(20)} Attempts: ${stats.attempts
          .toString()
          .padStart(6)} Hits: ${stats.hits
          .toString()
          .padStart(6)} (${hitRate}% hit, ${missRate}% miss)`
      )
    }

    console.log('\nOperation Counts:')
    console.log('-'.repeat(60))
    console.log(
      `  Total Operations:      ${parseMetrics.totalOperations.toLocaleString()}`
    )
    console.log(
      `  Block Parse Iterations: ${parseMetrics.blockParseIterations.toLocaleString()}`
    )
    console.log(
      `  Inline Parse Iterations: ${parseMetrics.inlineParseIterations.toLocaleString()}`
    )

    console.log('='.repeat(60))
  }

  return jsx
}

function normalizeHtmlAttributes(attrs: any = {}) {
  const out: any = {}
  const booleanMap: { [key: string]: string } = {
    autofocus: 'autoFocus',
    autoplay: 'autoPlay',
    checked: 'checked',
    controls: 'controls',
    disabled: 'disabled',
    hidden: 'hidden',
    loop: 'loop',
    multiple: 'multiple',
    muted: 'muted',
    readonly: 'readOnly',
    required: 'required',
    selected: 'selected',
    playsinline: 'playsInline',
    allowfullscreen: 'allowFullScreen',
  }

  const svgAttrMap: { [key: string]: string } = {
    'fill-rule': 'fillRule',
    'clip-rule': 'clipRule',
    'stroke-linecap': 'strokeLinecap',
    'stroke-linejoin': 'strokeLinejoin',
    'stroke-width': 'strokeWidth',
    'stroke-miterlimit': 'strokeMiterlimit',
    viewBox: 'viewBox',
    'xml:space': 'xmlSpace',
    'xlink:href': 'xlinkHref',
  }

  Object.keys(attrs || {}).forEach(key => {
    const value = (attrs as any)[key]
    if (svgAttrMap[key]) {
      out[svgAttrMap[key]] = value
    } else if (key === 'class') {
      out.className = value
    } else if (key === 'for') {
      out.htmlFor = value
    } else if (key === 'tabindex') {
      out.tabIndex = value
    } else if (key === 'style' && typeof value === 'string') {
      const styleObj: { [key: string]: string } = {}
      String(value)
        .split(';')
        .forEach(decl => {
          if (!decl) return
          const idx = decl.indexOf(':')
          if (idx === -1) return
          const k = camelCaseCss(decl.slice(0, idx))
          const v = decl.slice(idx + 1).trim()
          if (k) styleObj[k] = v
        })
      out.style = styleObj
    } else if (booleanMap[key] !== undefined) {
      const reactKey = booleanMap[key]
      // Treat presence or truthy string as true
      out[reactKey] =
        value === '' || value === true || String(value).toLowerCase() === 'true'
    } else {
      out[key] = value
    }
  })

  return out
}

/**
 * A simple HOC for easy React use. Feed the markdown content as a direct child
 * and the rest is taken care of automatically.
 */
const Markdown: React.FC<
  Omit<React.HTMLAttributes<Element>, 'children'> & {
    children?: string | null
    options?: MarkdownToJSX.Options
  }
> = ({ children: rawChildren, options, ...props }) => {
  const children =
    rawChildren === null || rawChildren === undefined ? '' : rawChildren

  if (process.env.NODE_ENV !== 'production' && typeof children !== 'string') {
    console.error(
      'markdown-to-jsx: <Markdown> component only accepts a single string as a child, received:',
      children
    )
  }

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
