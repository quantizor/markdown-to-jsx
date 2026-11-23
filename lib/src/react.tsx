/** @jsxRuntime classic */
/** @jsx h */

import * as React from 'react'
import { $ } from './constants.ts'
import * as parse from './parse.ts'
import { supportsRawElements } from './runtime-probe.ts'
import { useShallowStable } from './shallow-stable.ts'
import { type MarkdownToJSX, RuleType } from './types.ts'
import * as util from './utils.ts'

export { parser } from './parse.ts'

export { type MarkdownToJSX, RuleType } from './types.ts'
export { sanitizer, slugify } from './utils.ts'

declare namespace h {
  export import JSX = React.JSX
}

var REACT_ELEMENT_TYPE: symbol | null = null
try {
  var probeElement: unknown = React.createElement('div')
  if (supportsRawElements(probeElement)) {
    REACT_ELEMENT_TYPE = probeElement.$$typeof
  }
} catch {}

function createRawElement(type: any, props: any, key: any): any {
  if (REACT_ELEMENT_TYPE !== null) {
    return {
      $$typeof: REACT_ELEMENT_TYPE,
      type,
      key: key == null ? null : String(key),
      ref: null,
      props,
      _owner: null,
      _store: {},
      _debugStack: null,
      _debugTask: null,
    }
  }
  if (key != null) {
    props.key = key
  }
  return React.createElement(type, props)
}

function keyedJsxProps(
  key: any,
  attrs: Record<string, any> | null | undefined
): Record<string, any> {
  var props: Record<string, any> = { key }
  if (attrs) {
    var jsx = util.htmlAttrsToJSXProps(attrs)
    for (var k in jsx) {
      props[k] = jsx[k]
    }
  }
  return props
}

/**
 * React context for sharing compiler options across Markdown components
 *
 * Note: This is undefined in React Server Component environments where createContext is not available.
 */
export const MarkdownContext:
  | React.Context<MarkdownToJSX.Options | undefined>
  | undefined =
  typeof React.createContext === 'undefined'
    ? undefined
    : React.createContext<MarkdownToJSX.Options | undefined>(undefined)

function render(
  node: MarkdownToJSX.ASTNode,
  output: MarkdownToJSX.ASTRender,
  state: MarkdownToJSX.State,
  h: (tag: any, props: any, ...children: any[]) => any,
  sanitize: (value: string, tag: string, attribute: string) => string | null,
  slug: (input: string, defaultFn: (input: string) => string) => string,
  refs: { [key: string]: { target: string; title: string | undefined } },
  options: MarkdownToJSX.Options,
  hJsx: (tag: any, props: any, ...children: any[]) => any
): React.ReactNode {
  switch (node.type) {
    case RuleType.blockQuote: {
      const props = {
        key: state.key,
      } as Record<string, unknown>

      if (node.alert) {
        props.className = `markdown-alert-${slug(node.alert.toLowerCase(), util.slugify)}`

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

    case RuleType.codeBlock: {
      const decodedLang = node.lang
        ? util.decodeEntityReferences(node.lang)
        : ''
      var codeProps: Record<string, any> = node.attrs
        ? util.htmlAttrsToJSXProps(
            util.withoutHandlerSource('code', node.attrs, options.overrides)
          )
        : {}
      codeProps.className = decodedLang
        ? `language-${decodedLang} lang-${decodedLang}`
        : ''
      return h('pre', { key: state.key }, h('code', codeProps, node.text))
    }

    case RuleType.codeInline:
      return <code key={state.key}>{node.text}</code>

    case RuleType.footnoteReference:
      return (
        <a
          key={state.key}
          href={sanitize(node.target, 'a', 'href') || undefined}
        >
          <sup>{node.text}</sup>
        </a>
      )

    case RuleType.gfmTask:
      return (
        <input
          checked={node.completed}
          key={state.key}
          readOnly={true}
          type="checkbox"
        />
      )

    case RuleType.heading:
      return h(
        `h${node.level}`,
        { id: util.headingId(node.id), key: state.key },
        output(node.children, state)
      )

    case RuleType.htmlBlock: {
      const htmlNode = node as MarkdownToJSX.HTMLNode

      if (
        util.tagfilterEnabled(options) &&
        util.shouldFilterTag(htmlNode.tag)
      ) {
        var filtered = util.getFilteredTagEmit(htmlNode)
        if (filtered.kind === 'literal') {
          return h('span', { key: state.key }, filtered.literal)
        }
        return h(
          'span',
          { key: state.key },
          ...util.assembleFilteredTagChildren(
            filtered.open,
            htmlNode.children ? output(htmlNode.children, state) : null,
            filtered.close
          )
        )
      }

      const rawOuter = htmlNode._rawOuter
      const isRawOuter = rawOuter !== undefined
      const rawSource = isRawOuter
        ? rawOuter
        : htmlNode._isClosingTag
          ? htmlNode._rawBody || ''
          : (htmlNode._rawBody || '') + (htmlNode._rawClose || '')
      if (rawSource && htmlNode._verbatim) {
        const tagLower = (htmlNode.tag as string).toLowerCase()
        const isType1Block = parse.isType1Block(tagLower)
        const htmlChildren = htmlNode.children
        const hasChildren = htmlChildren != null && htmlChildren.length > 0

        if (isType1Block) {
          const type1Body =
            (isRawOuter ? htmlNode.text : htmlNode._rawBody) || ''
          const textContent = util.tagfilterEnabled(options)
            ? util.applyTagFilterToText(type1Body)
            : type1Body
          if (tagLower === 'textarea') {
            var taProps = keyedJsxProps(
              state.key,
              util.withoutHandlerSource(node.tag, node.attrs, options.overrides)
            )
            taProps.defaultValue = util.verbatimText(tagLower, textContent)
            return h(tagLower, taProps)
          }
          if (/<[a-z][^>]{0,100}>/i.test(type1Body)) {
            var t1Props = keyedJsxProps(state.key, node.attrs)
            t1Props.dangerouslySetInnerHTML = { __html: textContent }
            return hJsx(node.tag, t1Props)
          }
          return hJsx(
            node.tag,
            keyedJsxProps(state.key, node.attrs),
            util.verbatimText(node.tag, textContent)
          )
        }

        const ownTagStartR = new RegExp(`^<${htmlNode.tag}(\\s|>)`, 'i')
        if (
          hasChildren &&
          !ownTagStartR.test(rawSource) &&
          util.tagfilterEnabled(options) &&
          util.containsTagfilterTag(rawSource)
        ) {
          return hJsx(
            node.tag,
            keyedJsxProps(state.key, node.attrs),
            output(htmlChildren, state)
          )
        }

        const containsVerbatimTags = parse.containsType1Tag(rawSource)
        if (containsVerbatimTags) {
          const innerHtml = util.tagfilterEnabled(options)
            ? util.applyTagFilterToText(rawSource)
            : rawSource
          var vProps = keyedJsxProps(state.key, node.attrs)
          vProps.dangerouslySetInnerHTML = { __html: innerHtml }
          return hJsx(node.tag, vProps)
        }
        const parseOptions = parse.toParseOptions({
          overrides: options.overrides,
          slugify: options.slugify,
          sanitizer: sanitize,
          tagfilter: true,
        })
        const cleanedText = util.normalizeJsxReparseText(
          htmlNode._reparseSource || rawSource
        )
        const selfTagRegex = new RegExp(
          `^<${htmlNode.tag}(\\s[^>]*)?>(\\s*</${htmlNode.tag}>)?$`,
          'i'
        )
        if (selfTagRegex.test(cleanedText)) {
          if (htmlNode.children && htmlNode.children.length > 0) {
            return hJsx(
              node.tag,
              keyedJsxProps(state.key, node.attrs),
              output(htmlNode.children, state)
            )
          }
          return hJsx(node.tag, keyedJsxProps(state.key, node.attrs))
        }

        const astNodes = parse.parseMarkdown(
          cleanedText,
          { inline: false, refs, inHTML: false },
          parseOptions
        )
        util.stripVerbatim(astNodes)
        if (util.reparsedToItself(astNodes, cleanedText)) {
          return cleanedText
        }

        const tagLowerCheck = (htmlNode.tag as string).toLowerCase()
        const isFullOuterBlock = isRawOuter

        if (isFullOuterBlock && hasChildren) {
          return hJsx(
            node.tag,
            keyedJsxProps(state.key, node.attrs),
            output(htmlChildren, state)
          )
        }
        if (isFullOuterBlock) {
          return output(astNodes.flatMap(util.processVerbatimNode), state)
        }

        var splitResult = util.findOwnCloseInAST(astNodes, tagLowerCheck)
        if (splitResult.found && splitResult.afterClose.length > 0) {
          var beforeProcessed = splitResult.beforeClose.flatMap(
            util.processVerbatimNode
          )
          var afterProcessed = splitResult.afterClose.flatMap(
            util.processVerbatimNode
          )
          return createRawElement(
            React.Fragment,
            {
              children: [
                hJsx(
                  node.tag,
                  keyedJsxProps(state.key, node.attrs),
                  output(beforeProcessed, state)
                ),
                output(afterProcessed, state),
              ],
            },
            state.key
          )
        }

        return hJsx(
          node.tag,
          keyedJsxProps(state.key, node.attrs),
          output(astNodes.flatMap(util.processVerbatimNode), state)
        )
      }
      if (util.isVoidElement(node.tag)) {
        return hJsx(node.tag, keyedJsxProps(state.key, node.attrs))
      }
      return hJsx(
        node.tag,
        keyedJsxProps(state.key, node.attrs),
        node.children ? output(node.children, state) : ''
      )
    }

    case RuleType.htmlSelfClosing: {
      const htmlNode = node as MarkdownToJSX.HTMLSelfClosingNode

      if (
        util.tagfilterEnabled(options) &&
        util.shouldFilterTag(htmlNode.tag)
      ) {
        var filteredSc = util.getFilteredTagEmit(htmlNode)
        return h(
          'span',
          { key: state.key },
          filteredSc.kind === 'literal'
            ? filteredSc.literal
            : filteredSc.open + (filteredSc.close || '')
        )
      }

      return hJsx(node.tag, keyedJsxProps(state.key, node.attrs))
    }

    case RuleType.image: {
      const src =
        node.target === null
          ? null
          : util.sanitizeAndEncodeUrlTarget(node.target, sanitize, 'img', 'src')
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
        const href = util.sanitizeAndEncodeUrlTarget(
          node.target,
          sanitize,
          'a',
          'href'
        )
        if (href != null) {
          props.href = href
        }
      }
      if (node.title) {
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
                      table.align[i] === null
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
                            table.align[c] === null
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
      return null

    default:
      return null
  }
}

const createRenderer = (
  userRender: MarkdownToJSX.Options['renderRule'],
  h: (
    tag: MarkdownToJSX.HTMLTags,
    props: Parameters<MarkdownToJSX.CreateElement>[1] & {
      className?: string
      id?: string
    },
    ...children: any[]
  ) => any,
  sanitize: (value: string, tag: string, attribute: string) => string | null,
  slug: (input: string, defaultFn: (input: string) => string) => string,
  refs: { [key: string]: { target: string; title: string | undefined } },
  options: MarkdownToJSX.Options,
  hJsx: (tag: any, props: any, ...children: any[]) => any
) => {
  var handleStackOverflow = (ast: MarkdownToJSX.ASTNode[]) =>
    ast.map(node => ('text' in node ? node.text : ''))
  var renderer = (
    astInput: MarkdownToJSX.ASTNode | MarkdownToJSX.ASTNode[],
    state: MarkdownToJSX.State = {}
  ): React.ReactNode[] => {
    var ast = Array.isArray(astInput) ? astInput : [astInput]
    var depth = (state.renderDepth || 0) + 1
    if (depth > $.MAX_RENDER_DEPTH) {
      return handleStackOverflow(ast)
    }
    state.renderDepth = depth

    var oldKey = state.key
    var result: React.ReactNode[] = []
    var lastWasString = false
    var renderChildren = userRender
      ? (
          children: MarkdownToJSX.ASTNode | MarkdownToJSX.ASTNode[],
          childState?: MarkdownToJSX.State
        ) => renderer(children, childState || state)
      : renderer
    for (var i = 0; i < ast.length; i++) {
      state.key = i
      var nodeOut: React.ReactNode
      if (userRender) {
        var defaultRender = render.bind(
          null,
          ast[i],
          renderer,
          state,
          h,
          sanitize,
          slug,
          refs,
          options,
          hJsx
        )
        nodeOut = userRender(defaultRender, ast[i], renderChildren, state)
      } else {
        nodeOut = render(
          ast[i],
          renderer,
          state,
          h,
          sanitize,
          slug,
          refs,
          options,
          hJsx
        )
      }
      var isString = typeof nodeOut === 'string'
      if (lastWasString && typeof nodeOut === 'string') {
        var lastEntry = result.at(-1)
        result[result.length - 1] =
          (typeof lastEntry === 'string' ? lastEntry : '') + nodeOut
      } else if (nodeOut != null) {
        if (Array.isArray(nodeOut)) {
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

const getTag = (
  tag: string,
  overrides: MarkdownToJSX.Overrides | undefined
) => {
  const override = util.get(overrides, tag, undefined)
  return override
    ? typeof override === 'function' ||
      (typeof override === 'object' && 'render' in override)
      ? override
      : util.get(overrides, `${tag}.component`, tag)
    : tag
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

  const compileHtml = (input: string) =>
    compiler(input, { ...opts, wrapper: null })

  function _compilePropsJsx(props: Record<string, any>): void {
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
        var compiled = compileHtml(pval.trim())
        props[pkey] =
          pkey === 'innerHTML' && Array.isArray(compiled)
            ? compiled[0]
            : compiled
      }
    }
  }

  function h(
    tag: MarkdownToJSX.HTMLTags,
    props: Parameters<MarkdownToJSX.CreateElement>[1] & {
      className?: string
      id?: string
    },
    ...children: any[]
  ) {
    var finalProps: any = props || {}

    var resolvedTag: any = tag

    if (hasOverrides) {
      var overrideProps = util.get(opts.overrides, `${tag}.props`, {})
      resolvedTag = getTag(tag, opts.overrides)
      finalProps = {
        ...finalProps,
        ...overrideProps,
        className:
          util.cx(finalProps.className, overrideProps.className) || undefined,
      }
      if (typeof resolvedTag === 'string' && util.isVoidElement(resolvedTag)) {
        delete finalProps.children
        children.length = 0
      }
    }

    if (!customCreateElement) {
      var elKey = finalProps.key
      if (elKey != null) {
        var keyless: any = {}
        for (var pk in finalProps) {
          if (pk !== 'key') {
            keyless[pk] = finalProps[pk]
          }
        }
        finalProps = keyless
      }
      if (children.length === 1) {
        finalProps.children = children[0]
      } else if (children.length > 1) {
        finalProps.children = children
      }
      return createRawElement(resolvedTag, finalProps, elKey)
    }

    return customCreateElement(resolvedTag, finalProps, ...children)
  }

  function hJsx(tag: any, attrProps: any, ...children: any[]): any {
    var props =
      attrProps &&
      util.withoutHandlerSource(tag, attrProps, opts.overrides, getTag)
    if (props) {
      if (typeof props.children === 'string') {
        var attrText =
          props.dangerouslySetInnerHTML === undefined
            ? util.childrenAttrContent(props.children, children)
            : undefined
        delete props.children
        if (attrText !== undefined) {
          children = [attrText]
        }
      }
      _compilePropsJsx(props)
    }
    return h(tag, props, ...children)
  }

  const parseOptions = parse.toParseOptions(opts)

  const refs =
    ast[0] && ast[0].type === RuleType.refCollection
      ? (ast[0] as MarkdownToJSX.ReferenceCollectionNode).refs
      : (Object.create(null) as {
          [key: string]: { target: string; title: string | undefined }
        })

  const emitter = createRenderer(
    opts.renderRule,
    h,
    sanitize,
    slug,
    refs,
    opts,
    hJsx
  )

  const arr = emitter(ast, {
    inline: opts.forceInline,
    refs,
  })

  const footnoteEntries = util.extractFootnoteEntries(refs)

  if (footnoteEntries.length > 0) {
    arr.push(
      <footer key="footer">
        {footnoteEntries.map(function createFootnote(def) {
          const identifierWithoutCaret =
            def.identifier.charCodeAt(0) === $.CHAR_CARET
              ? def.identifier.slice(1)
              : def.identifier
          const footnoteAstNodes = parse.parseMarkdown(
            def.footnote,
            { inline: true, refs },
            parseOptions
          )
          return h(
            'div',
            {
              id: slug(identifierWithoutCaret, util.slugify),
              key: def.identifier,
            },
            `${identifierWithoutCaret}: `,
            emitter(footnoteAstNodes, { inline: true, refs })
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

  var wrapperProps: Record<string, unknown> = opts.wrapperProps
    ? { ...opts.wrapperProps }
    : {}
  wrapperProps.children = jsx
  return createRawElement(wrapper, wrapperProps, 'outer')
}

/**
 * Compile markdown string to React JSX elements
 *
 * @param markdown - Markdown string to compile
 * @param options - Compiler options
 * @returns React JSX element(s)
 */
export function compiler(
  markdown = '',
  options: MarkdownToJSX.Options = {}
): React.ReactNode {
  const opts = { ...(options || {}) }
  opts.overrides = opts.overrides || {}

  const _slug = opts.slugify || util.slugify
  const _sanitize = opts.sanitizer || util.sanitizer

  function compile(input: string): React.ReactNode {
    const inline =
      opts.forceInline ||
      !(opts.forceBlock || util.SHOULD_RENDER_AS_BLOCK_R.test(input))
    const parseOptions = parse.toParseOptions(opts)

    const processedInput = inline ? input : util.prepareBlockInput(input)

    const astNodes = parse.parseMarkdown(
      processedInput,
      { inline, refs },
      parseOptions
    )

    return astToJSX(astNodes, {
      ...opts,
      forceInline: inline,
    })
  }

  if (process.env.NODE_ENV !== 'production') {
    util.validateCompilerArgs(markdown, opts.overrides, 'ReactComponent')
  }

  const refs: { [key: string]: { target: string; title: string | undefined } } =
    Object.create(null)

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

  const contextOptions = MarkdownContext
    ? React.useContext(MarkdownContext)
    : undefined
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

export default Markdown
