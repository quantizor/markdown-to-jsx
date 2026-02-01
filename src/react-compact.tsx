/** @jsxRuntime classic */
/** @jsx h */

/**
 * Compact React Markdown Compiler
 * Uses the table-driven parser for smaller bundle size
 */

import * as React from 'react'
import { parseMarkdownCompact } from './parse-compact'
import { RuleType, type MarkdownToJSX } from './types'
import * as util from './utils'

type Props = {
  children: string
  options?: MarkdownToJSX.Options
}

const h = React.createElement

// Default component overrides
const defaultOverrides: MarkdownToJSX.Overrides = {}

// Compile AST node to React element
function compile(
  node: MarkdownToJSX.ASTNode,
  options: MarkdownToJSX.Options,
  key: number
): React.ReactNode {
  const overrides = options.overrides || defaultOverrides
  
  switch (node.type) {
    case RuleType.heading: {
      const n = node as MarkdownToJSX.HeadingNode
      const Tag = `h${n.level}` as any
      const Override = overrides[Tag]
      const children = n.children.map((c, i) => compile(c, options, i))
      const id = options.slugify !== false 
        ? util.slugify(util.extractPlainText([node], RuleType))
        : undefined
      return Override 
        ? h(Override, { key, id }, children)
        : h(Tag, { key, id }, children)
    }
    
    case RuleType.paragraph: {
      const n = node as MarkdownToJSX.ParagraphNode
      const Override = overrides.p
      const children = n.children.map((c, i) => compile(c, options, i))
      return Override
        ? h(Override, { key }, children)
        : h('p', { key }, children)
    }
    
    case RuleType.text: {
      const n = node as MarkdownToJSX.TextNode
      return n.text
    }
    
    case RuleType.textFormatted: {
      const n = node as MarkdownToJSX.TextFormattedNode
      // Use tag property directly
      const Tag = (n.tag || 'span') as keyof React.JSX.IntrinsicElements
      const Override = overrides[Tag]
      const children = n.children.map((c, i) => compile(c, options, i))
      return Override
        ? h(Override, { key }, children)
        : h(Tag, { key }, children)
    }
    
    case RuleType.codeInline: {
      const n = node as MarkdownToJSX.CodeInlineNode
      const Override = overrides.code
      return Override
        ? h(Override, { key }, n.text)
        : h('code', { key }, n.text)
    }
    
    case RuleType.codeBlock: {
      const n = node as MarkdownToJSX.CodeBlockNode
      const Override = overrides.pre
      const codeOverride = overrides.code
      const code = codeOverride
        ? h(codeOverride, { className: n.lang ? `language-${n.lang}` : undefined }, n.text)
        : h('code', { className: n.lang ? `language-${n.lang}` : undefined }, n.text)
      return Override
        ? h(Override, { key }, code)
        : h('pre', { key }, code)
    }
    
    case RuleType.link: {
      const n = node as MarkdownToJSX.LinkNode
      const Override = overrides.a
      const children = n.children.map((c, i) => compile(c, options, i))
      const props: any = { href: n.target, key }
      if (n.title) props.title = n.title
      return Override
        ? h(Override, props, children)
        : h('a', props, children)
    }
    
    case RuleType.image: {
      const n = node as MarkdownToJSX.ImageNode
      const Override = overrides.img
      const props: any = { src: n.target, alt: n.alt, key }
      if (n.title) props.title = n.title
      return Override
        ? h(Override, props)
        : h('img', props)
    }
    
    case RuleType.blockQuote: {
      const n = node as MarkdownToJSX.BlockQuoteNode
      const Override = overrides.blockquote
      const children = n.children.map((c, i) => compile(c, options, i))
      return Override
        ? h(Override, { key }, children)
        : h('blockquote', { key }, children)
    }
    
    case RuleType.orderedList:
    case RuleType.unorderedList: {
      const n = node as MarkdownToJSX.OrderedListNode | MarkdownToJSX.UnorderedListNode
      const Tag = node.type === RuleType.orderedList ? 'ol' : 'ul'
      const Override = overrides[Tag]
      const children = n.items.map((item, i) => {
        const liOverride = overrides.li
        const itemChildren = item.map((c, j) => compile(c, options, j))
        return liOverride
          ? h(liOverride, { key: i }, itemChildren)
          : h('li', { key: i }, itemChildren)
      })
      const props: any = { key }
      if (node.type === RuleType.orderedList && n.start !== 1) {
        props.start = n.start
      }
      return Override
        ? h(Override, props, children)
        : h(Tag, props, children)
    }
    
    case RuleType.breakThematic: {
      const Override = overrides.hr
      return Override
        ? h(Override, { key })
        : h('hr', { key })
    }
    
    case RuleType.table: {
      const n = node as MarkdownToJSX.TableNode
      const Override = overrides.table
      
      // Header
      const headerCells = n.header.map((cell, i) => {
        const cellChildren = cell.map((c, j) => compile(c, options, j))
        const style = n.align[i] ? { textAlign: n.align[i] } : undefined
        return h('th', { key: i, style }, cellChildren)
      })
      const thead = h('thead', { key: 'head' }, h('tr', null, headerCells))
      
      // Body
      const bodyRows = n.cells.map((row, i) => {
        const cells = row.map((cell, j) => {
          const cellChildren = cell.map((c, k) => compile(c, options, k))
          const style = n.align[j] ? { textAlign: n.align[j] } : undefined
          return h('td', { key: j, style }, cellChildren)
        })
        return h('tr', { key: i }, cells)
      })
      const tbody = h('tbody', { key: 'body' }, bodyRows)
      
      return Override
        ? h(Override, { key }, [thead, tbody])
        : h('table', { key }, [thead, tbody])
    }
    
    case RuleType.htmlBlock: {
      const n = node as MarkdownToJSX.HTMLBlockNode
      return h('div', { 
        key, 
        dangerouslySetInnerHTML: { __html: n.text }
      })
    }
    
    default:
      return null
  }
}

/**
 * Compile markdown string to React elements
 */
export function compileMarkdown(
  markdown: string,
  options: MarkdownToJSX.Options = {}
): React.ReactNode {
  const ast = parseMarkdownCompact(markdown)
  return ast.map((node, i) => compile(node, options, i))
}

/**
 * Compact Markdown component
 */
export function MarkdownCompact({ children, options = {} }: Props): React.ReactElement {
  const compiled = compileMarkdown(children, options)
  const Wrapper = options.wrapper || 'div'
  return h(Wrapper as any, null, compiled)
}

export { parseMarkdownCompact }
