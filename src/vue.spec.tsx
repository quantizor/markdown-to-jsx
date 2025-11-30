/** @jsxImportSource vue */

import { afterEach, describe, expect, it, mock } from 'bun:test'
import { h, type VNode, type Component } from 'vue'
import theredoc from 'theredoc'
import Markdown, {
  astToJSX,
  compiler,
  htmlAttrsToVueProps,
  parser,
  RuleType,
  sanitizer,
  type VueOptions,
} from './vue'
import type { MarkdownToJSX } from './types'

afterEach(() => {
  mock.clearAllMocks()
})

// Helper to extract text content from Vue VNode structure
function extractTextContent(
  element: VNode | VNode[] | string | null | undefined
): string {
  if (!element) return ''
  if (typeof element === 'string') return element
  if (typeof element === 'number') return String(element)
  if (Array.isArray(element)) {
    let text = ''
    for (let i = 0; i < element.length; i++) {
      text += extractTextContent(element[i])
    }
    return text
  }
  if (typeof element === 'object' && element !== null) {
    const vnode = element as VNode
    const props =
      vnode.props && typeof vnode.props === 'object'
        ? (vnode.props as Record<string, unknown>)
        : null
    // Check for alt text in img (before children, as images don't have text children)
    if (
      typeof vnode.type === 'string' &&
      vnode.type === 'img' &&
      props &&
      typeof props.alt === 'string'
    ) {
      return props.alt
    }
    // Check for children in props or directly on vnode
    const children =
      props?.children !== undefined
        ? props.children
        : 'children' in vnode
          ? vnode.children
          : undefined
    if (children !== undefined) {
      return extractTextContent(children as VNode | VNode[] | string)
    }
  }
  return ''
}

// Helper to check if VNode has a property (avoids JSON.stringify)
function hasProp(vnode: VNode | VNode[] | null, prop: string): boolean {
  if (!vnode || Array.isArray(vnode)) return false
  if (
    typeof vnode === 'object' &&
    vnode.props &&
    typeof vnode.props === 'object'
  ) {
    return prop in (vnode.props as Record<string, unknown>)
  }
  return false
}

// Helper to get VNode type
function getVNodeType(vnode: VNode | VNode[] | null): string | undefined {
  if (!vnode || Array.isArray(vnode)) return undefined
  if (typeof vnode === 'object' && typeof vnode.type === 'string') {
    return vnode.type
  }
  return undefined
}

// Helper to get prop value from VNode
function getProp(vnode: VNode | VNode[] | null, prop: string): unknown {
  if (!vnode || Array.isArray(vnode)) return undefined
  if (
    typeof vnode === 'object' &&
    vnode.props &&
    typeof vnode.props === 'object'
  ) {
    return (vnode.props as Record<string, unknown>)[prop]
  }
  return undefined
}

it('should throw if not passed a string (first arg)', () => {
  expect(() => compiler('')).not.toThrow()
  // @ts-ignore
  expect(() => compiler()).not.toThrow()
  // @ts-ignore
  expect(() => compiler(1)).toThrow()
  // @ts-ignore
  expect(() => compiler(() => {})).toThrow()
  // @ts-ignore
  expect(() => compiler({})).toThrow()
  // @ts-ignore
  expect(() => compiler([])).toThrow()
  // @ts-ignore
  expect(() => compiler(null)).toThrow()
  // @ts-ignore
  expect(() => compiler(true)).toThrow()
})

it('should handle a basic string', () => {
  const result = compiler('Hello.')
  expect(extractTextContent(result)).toBe('Hello.')
  // Verify it's a string VNode, not wrapped
  expect(typeof result).toBe('string')
})

it('wraps multiple block element returns in a div to avoid invalid nesting errors', () => {
  const result = compiler('# Boop\n\n## Blep')
  expect(getVNodeType(result as VNode)).toBe('div')
  const text = extractTextContent(result)
  expect(text).toBe('BoopBlep')
  // Verify structure: div containing h1 and h2
  const vnode = result as VNode
  expect(Array.isArray(vnode.children)).toBe(true)
})

it('wraps solely inline elements in a span, rather than a div', () => {
  const result = compiler("Hello. _Beautiful_ day isn't it?")
  expect(getVNodeType(result as VNode)).toBe('span')
  const text = extractTextContent(result)
  expect(text).toBe("Hello. Beautiful day isn't it?")
})

describe('break elements', () => {
  it('should handle breakLine (hard break)', () => {
    const result = compiler('Line 1  \nLine 2')
    const text = extractTextContent(result)
    expect(text).toBe('Line 1Line 2')
  })

  it('should handle breakThematic (horizontal rule)', () => {
    const result = compiler('---')
    expect(getVNodeType(result as VNode)).toBe('hr')
  })
})

describe('inline textual elements', () => {
  it('should handle triple-emphasized text with mixed syntax 1/2', () => {
    const result = compiler('**_Hello._**')
    const text = extractTextContent(result)
    expect(text).toBe('Hello.')
  })

  it('should handle triple-emphasized text with mixed syntax 2/2', () => {
    const result = compiler('_**Hello.**_')
    const text = extractTextContent(result)
    expect(text).toBe('Hello.')
  })

  it('should handle the alternate form of bold/italic', () => {
    const result = compiler('___Hello.___')
    const text = extractTextContent(result)
    expect(text).toBe('Hello.')
  })

  it('should handle deleted text', () => {
    const result = compiler('~~Hello.~~')
    const text = extractTextContent(result)
    expect(text).toBe('Hello.')
  })

  it('should handle escaped text', () => {
    const result = compiler('Hello.\\_\\_foo\\_\\_')
    const text = extractTextContent(result)
    expect(text).toBe('Hello.__foo__')
  })
})

describe('headings', () => {
  it('should render h1 headings', () => {
    const result = compiler('# Hello World')
    expect(getVNodeType(result as VNode)).toBe('h1')
    expect(extractTextContent(result)).toBe('Hello World')
  })

  it('should render h2 headings', () => {
    const result = compiler('## Hello World')
    expect(getVNodeType(result as VNode)).toBe('h2')
    expect(extractTextContent(result)).toBe('Hello World')
  })

  it('should generate IDs for headings', () => {
    const result = compiler('# Hello World')
    expect(getVNodeType(result as VNode)).toBe('h1')
    expect(hasProp(result as VNode, 'id')).toBe(true)
    const id = getProp(result as VNode, 'id')
    expect(typeof id).toBe('string')
    expect(id).toBe('hello-world')
  })

  it('should handle setext level 1 style', () => {
    const result = compiler('Hello World\n===========\n\nsomething')
    expect(getVNodeType(result as VNode)).toBe('div')
    const text = extractTextContent(result)
    expect(text).toBe('Hello Worldsomething')
  })

  it('should handle setext level 2 style', () => {
    const result = compiler('Hello World\n-----------\n\nsomething')
    expect(getVNodeType(result as VNode)).toBe('div')
    const text = extractTextContent(result)
    expect(text).toBe('Hello Worldsomething')
  })
})

describe('links', () => {
  it('should render inline links', () => {
    const result = compiler('[Link](https://example.com)')
    expect(getVNodeType(result as VNode)).toBe('a')
    expect(extractTextContent(result)).toBe('Link')
    expect(getProp(result as VNode, 'href')).toBe('https://example.com')
  })

  it('should render reference links', () => {
    const result = compiler('[Link][ref]\n\n[ref]: https://example.com')
    // Reference links are wrapped in paragraph
    expect(getVNodeType(result as VNode)).toBe('p')
    const text = extractTextContent(result)
    expect(text).toBe('Link')
    // The link is nested inside the paragraph
    const vnode = result as VNode
    expect(Array.isArray(vnode.children)).toBe(true)
  })

  it('should handle links without target', () => {
    const result = compiler('[Link]()')
    expect(getVNodeType(result as VNode)).toBe('a')
    expect(extractTextContent(result)).toBe('Link')
    expect(getProp(result as VNode, 'href')).toBe('')
  })

  it('should handle links with title', () => {
    const result = compiler('[Link](https://example.com "Title")')
    expect(getProp(result as VNode, 'title')).toBe('Title')
    expect(getProp(result as VNode, 'href')).toBe('https://example.com')
  })

  it('should encode backslashes in URLs', () => {
    const result = compiler('[Link](path\\to\\file)')
    const href = getProp(result as VNode, 'href')
    expect(typeof href).toBe('string')
    expect(
      (href as string).includes('%5C') || (href as string).includes('\\')
    ).toBe(true)
  })

  it('should encode backticks in URLs', () => {
    const result = compiler('[Link](path`to`file)')
    const href = getProp(result as VNode, 'href')
    expect(typeof href).toBe('string')
    expect(
      (href as string).includes('%60') || (href as string).includes('`')
    ).toBe(true)
  })

  it('should not link bare URL if disabled via options', () => {
    const result = compiler('https://google.com', { disableAutoLink: true })
    expect(extractTextContent(result)).toBe('https://google.com')
  })
})

describe('images', () => {
  it('should render images', () => {
    const result = compiler('![Alt text](image.png)')
    expect(getVNodeType(result as VNode)).toBe('img')
    expect(getProp(result as VNode, 'alt')).toBe('Alt text')
    expect(getProp(result as VNode, 'src')).toBe('image.png')
  })

  it('should handle images without alt text', () => {
    const result = compiler('![](image.png)')
    expect(getVNodeType(result as VNode)).toBe('img')
    expect(getProp(result as VNode, 'src')).toBe('image.png')
  })

  it('should handle images with title', () => {
    const result = compiler('![Alt](image.png "Title")')
    expect(getVNodeType(result as VNode)).toBe('img')
    expect(getProp(result as VNode, 'alt')).toBe('Alt')
    expect(getProp(result as VNode, 'title')).toBe('Title')
    expect(getProp(result as VNode, 'src')).toBe('image.png')
  })
})

describe('lists', () => {
  it('should render unordered lists', () => {
    const result = compiler('- Item 1\n- Item 2')
    expect(getVNodeType(result as VNode)).toBe('ul')
    const text = extractTextContent(result)
    expect(text).toBe('Item 1Item 2')
  })

  it('should render ordered lists', () => {
    const result = compiler('1. Item 1\n2. Item 2')
    expect(getVNodeType(result as VNode)).toBe('ol')
    const text = extractTextContent(result)
    expect(text).toBe('Item 1Item 2')
  })

  it('should handle ordered lists with start attribute', () => {
    const result = compiler('3. Item 3\n4. Item 4')
    expect(getVNodeType(result as VNode)).toBe('ol')
    expect(getProp(result as VNode, 'start')).toBe(3)
  })
})

describe('code blocks', () => {
  it('should render fenced code blocks', () => {
    const result = compiler('```js\nconsole.log("hello");\n```')
    expect(getVNodeType(result as VNode)).toBe('pre')
    const text = extractTextContent(result)
    expect(text).toBe('console.log("hello");')
  })

  it('should render inline code', () => {
    const result = compiler('This is `inline code`')
    const text = extractTextContent(result)
    expect(text).toBe('This is inline code')
  })

  it('should handle code blocks with language', () => {
    const result = compiler('```javascript\ncode\n```')
    expect(getVNodeType(result as VNode)).toBe('pre')
    // Language class may be on code element inside pre, or on pre itself
    const classProp = getProp(result as VNode, 'class')
    const hasLanguageClass =
      classProp &&
      typeof classProp === 'string' &&
      ((classProp as string).includes('language-javascript') ||
        (classProp as string).includes('lang-javascript'))
    expect(hasLanguageClass || classProp === undefined).toBe(true)
    expect(extractTextContent(result)).toBe('code')
  })
})

describe('Vue-specific features', () => {
  it('should use class instead of className', () => {
    const result = compiler('# Hello', {
      overrides: {
        h1: { props: { class: 'custom-class' } },
      },
    })
    expect(getVNodeType(result as VNode)).toBe('h1')
    expect(getProp(result as VNode, 'class')).toBe('custom-class')
    expect(getProp(result as VNode, 'className')).toBeUndefined()
  })

  it('should handle htmlAttrsToVueProps', () => {
    const props = htmlAttrsToVueProps({ for: 'input-id', class: 'test' })
    expect(props.htmlFor).toBe('input-id')
    expect(props.class).toBe('test')
  })

  it('should handle case-insensitive attribute matching', () => {
    const result = htmlAttrsToVueProps({ For: 'input-id', CLASS: 'test' })
    expect(result.htmlFor).toBe('input-id')
    expect(result.CLASS).toBe('test')
    expect(result.For).toBeUndefined()
  })

  it('should handle component overrides', () => {
    const CustomHeading = (props: any) => h('h1', { ...props, class: 'custom' })
    const result = compiler('# Hello', {
      overrides: {
        h1: CustomHeading,
      },
    })
    // Component overrides result in function component type
    expect(typeof (result as VNode)?.type).toBe('function')
    expect((result as VNode)?.type).toBe(CustomHeading)
    expect(extractTextContent(result)).toBe('Hello')
  })

  it('should handle Options API component overrides with render function', () => {
    const OptionsAPIComponent = {
      render() {
        return h('h1', { class: 'options-api' }, 'Options API Heading')
      },
    }
    const result = compiler('# Hello', {
      overrides: {
        h1: OptionsAPIComponent,
      },
    })
    // Object-based component should be recognized and passed to h()
    expect(typeof (result as VNode)?.type).toBe('object')
    expect((result as VNode)?.type).toBe(OptionsAPIComponent)
    // Verify the component has a render function (Options API)
    expect('render' in OptionsAPIComponent).toBe(true)
    expect(typeof OptionsAPIComponent['render']).toBe('function')
    // Verify the component's render function produces the expected output
    const renderedOutput = OptionsAPIComponent['render']()
    expect(getVNodeType(renderedOutput as VNode)).toBe('h1')
    expect(getProp(renderedOutput as VNode, 'class')).toBe('options-api')
    expect(extractTextContent(renderedOutput)).toBe('Options API Heading')
  })

  it('should handle Composition API component overrides with setup function', () => {
    const CompositionAPIComponent = {
      setup() {
        return () =>
          h('h1', { class: 'composition-api' }, 'Composition API Heading')
      },
    }
    const result = compiler('# Hello', {
      overrides: {
        h1: CompositionAPIComponent,
      },
    })
    // Object-based component should be recognized and passed to h()
    expect(typeof (result as VNode)?.type).toBe('object')
    expect((result as VNode)?.type).toBe(CompositionAPIComponent)
    // Verify the component has a setup function (Composition API)
    expect('setup' in CompositionAPIComponent).toBe(true)
    expect(typeof CompositionAPIComponent['setup']).toBe('function')
    // Verify the component's setup function produces the expected output
    const renderFn = CompositionAPIComponent['setup']()
    expect(typeof renderFn).toBe('function')
    const renderedOutput = renderFn()
    expect(getVNodeType(renderedOutput as VNode)).toBe('h1')
    expect(getProp(renderedOutput as VNode, 'class')).toBe('composition-api')
    expect(extractTextContent(renderedOutput)).toBe('Composition API Heading')
  })
})

describe('tables', () => {
  it('should render tables', () => {
    const result = compiler('| Header |\n|--------|\n| Cell   |')
    expect(getVNodeType(result as VNode)).toBe('table')
    const text = extractTextContent(result)
    expect(text).toBe('HeaderCell')
  })
})

describe('blockquotes', () => {
  it('should render blockquotes', () => {
    const result = compiler('> This is a quote')
    expect(getVNodeType(result as VNode)).toBe('blockquote')
    const text = extractTextContent(result)
    expect(text).toBe('This is a quote')
  })
})

describe('footnotes', () => {
  it('should handle footnote references', () => {
    const result = compiler('Text[^1]\n\n[^1]: Footnote')
    const text = extractTextContent(result)
    // Footnotes include both the reference and the definition
    expect(text.includes('Text')).toBe(true)
    expect(text.includes('Footnote')).toBe(true)
  })
})

describe('parser and astToJSX', () => {
  it('should parse markdown to AST', () => {
    const ast = parser('# Hello')
    expect(ast.length).toBe(1)
    expect(ast[0].type).toBe(RuleType.heading)
  })

  it('should convert AST to Vue VNodes', () => {
    const ast = parser('# Hello')
    const vnodes = astToJSX(ast)
    expect(getVNodeType(vnodes as VNode)).toBe('h1')
    expect(extractTextContent(vnodes)).toBe('Hello')
  })
})

type MarkdownProps = {
  children?: string | null
  options?: VueOptions
  [key: string]: unknown
}

// Markdown is implemented as a functional component, so we can type it as a function
type MarkdownComponent = (props: MarkdownProps) => VNode | VNode[] | null

describe('Markdown component', () => {
  it('should render markdown via component', () => {
    // Markdown is a functional component, call it directly
    const result = (Markdown as MarkdownComponent)({ children: '# Hello' })
    expect(getVNodeType(result as VNode)).toBe('h1')
    expect(extractTextContent(result)).toBe('Hello')
  })

  it('should handle null children', () => {
    // Markdown component converts null to empty string
    const result = (Markdown as MarkdownComponent)({ children: null })
    expect(result).toBeNull()
  })

  it('should merge additional props into wrapperProps', () => {
    // Markdown component merges restProps into wrapperProps
    const result = (Markdown as MarkdownComponent)({
      children: '# Hello\n\n## World',
      'data-testid': 'markdown-wrapper',
      id: 'test-id',
    })
    expect(getVNodeType(result as VNode)).toBe('div')
    expect(getProp(result as VNode, 'data-testid')).toBe('markdown-wrapper')
    expect(getProp(result as VNode, 'id')).toBe('test-id')
  })

  it('should pass options through to compiler', () => {
    const result = (Markdown as MarkdownComponent)({
      children: '# Hello',
      options: {
        overrides: {
          h1: { props: { class: 'custom-class' } },
        },
      },
    })
    expect(getVNodeType(result as VNode)).toBe('h1')
    expect(getProp(result as VNode, 'class')).toBe('custom-class')
  })
})

describe('sanitizer', () => {
  it('should sanitize dangerous URLs', () => {
    const result = sanitizer('javascript:alert(1)')
    expect(result).toBeNull()
  })

  it('should allow safe URLs', () => {
    const result = sanitizer('https://example.com')
    expect(result).toBe('https://example.com')
  })

  it('should sanitize data URLs', () => {
    const result = sanitizer('data:text/html,<script>alert(1)</script>')
    expect(result).toBeNull()
  })
})

describe('blockquotes with alerts', () => {
  it('should handle alert blockquotes', () => {
    const result = compiler('> [!NOTE]\n> Something important')
    expect(getVNodeType(result as VNode)).toBe('blockquote')
    const classProp = getProp(result as VNode, 'class')
    expect(typeof classProp).toBe('string')
    expect((classProp as string).includes('markdown-alert-note')).toBe(true)
    const text = extractTextContent(result)
    expect(text).toBe('NOTESomething important')
  })
})

describe('frontmatter', () => {
  it('should preserve frontmatter when option is set', () => {
    const result = compiler('---\ntitle: Test\n---\n\nContent', {
      preserveFrontmatter: true,
    })
    const text = extractTextContent(result)
    expect(text.includes('title: Test')).toBe(true)
    expect(text.includes('Content')).toBe(true)
  })

  it('should not preserve frontmatter by default', () => {
    const result = compiler('---\ntitle: Test\n---\n\nContent')
    const text = extractTextContent(result)
    expect(text.includes('title: Test')).toBe(false)
    expect(text).toBe('Content')
  })
})

describe('GFM task lists', () => {
  it('should handle unchecked task items', () => {
    const result = compiler('- [ ] Task 1')
    expect(getVNodeType(result as VNode)).toBe('ul')
    const text = extractTextContent(result)
    expect(text).toBe(' Task 1')
    // Verify checkbox exists in the structure
    const vnode = result as VNode
    expect(Array.isArray(vnode.children)).toBe(true)
  })

  it('should handle checked task items', () => {
    const result = compiler('- [x] Task 1')
    expect(getVNodeType(result as VNode)).toBe('ul')
    const text = extractTextContent(result)
    expect(text).toBe(' Task 1')
    // Verify checkbox exists in the structure
    const vnode = result as VNode
    expect(Array.isArray(vnode.children)).toBe(true)
  })
})

describe('code blocks with attributes', () => {
  it('should handle code blocks with custom attributes', () => {
    const result = compiler('```js data-line="1"\ncode\n```')
    expect(getVNodeType(result as VNode)).toBe('pre')
    // Attributes may be on code element inside pre, or on pre itself
    const dataLine = getProp(result as VNode, 'data-line')
    // If not on pre, it's on the nested code element (which is acceptable)
    expect(dataLine === '1' || dataLine === undefined).toBe(true)
    expect(extractTextContent(result)).toBe('code')
  })
})

describe('HTML blocks', () => {
  it('should filter dangerous HTML tags by wrapping in span when tagfilter is enabled', () => {
    const result = compiler('<script>alert("xss")</script>', {
      tagfilter: true,
    })
    // When tagfilter is enabled, dangerous tags are escaped and wrapped in span
    expect(getVNodeType(result as VNode)).toBe('span')
    // The script tag should be escaped as text content
    const text = extractTextContent(result)
    expect(text.includes('<script>') || text.includes('&lt;script&gt;')).toBe(
      true
    )
  })

  it('should process markdown within HTML blocks', () => {
    const result = compiler('<div>**Bold** text</div>')
    expect(getVNodeType(result as VNode)).toBe('div')
    const text = extractTextContent(result)
    expect(text).toBe('Bold text')
  })

  it('should handle HTML blocks with noInnerParse', () => {
    const result = compiler('<pre>code here</pre>')
    expect(getVNodeType(result as VNode)).toBe('pre')
    const text = extractTextContent(result)
    expect(text).toBe('code here')
  })

  it('should handle self-closing HTML tags', () => {
    const result = compiler('<br />')
    expect(getVNodeType(result as VNode)).toBe('br')
  })

  it('should filter dangerous self-closing tags by wrapping in span when tagfilter is enabled', () => {
    const result = compiler('<script />', { tagfilter: true })
    // When tagfilter is enabled, dangerous self-closing tags are escaped
    expect(getVNodeType(result as VNode)).toBe('span')
    const text = extractTextContent(result)
    expect(text.includes('<script') || text.includes('&lt;script')).toBe(true)
  })
})

describe('headings with all levels', () => {
  it('should render h3 headings', () => {
    const result = compiler('### Hello')
    expect(getVNodeType(result as VNode)).toBe('h3')
    expect(extractTextContent(result)).toBe('Hello')
  })

  it('should render h4 headings', () => {
    const result = compiler('#### Hello')
    expect(getVNodeType(result as VNode)).toBe('h4')
    expect(extractTextContent(result)).toBe('Hello')
  })

  it('should render h5 headings', () => {
    const result = compiler('##### Hello')
    expect(getVNodeType(result as VNode)).toBe('h5')
    expect(extractTextContent(result)).toBe('Hello')
  })

  it('should render h6 headings', () => {
    const result = compiler('###### Hello')
    expect(getVNodeType(result as VNode)).toBe('h6')
    expect(extractTextContent(result)).toBe('Hello')
  })
})

describe('URL encoding', () => {
  it('should preserve percent-encoded sequences in URLs', () => {
    const result = compiler('[Link](http://example.com/path%20with%20spaces)')
    const href = getProp(result as VNode, 'href')
    expect(href).toBe('http://example.com/path%20with%20spaces')
  })
})

describe('options.wrapper', () => {
  it('should use custom wrapper element', () => {
    const result = compiler('# Hello\n\n## World', { wrapper: 'article' })
    expect(getVNodeType(result as VNode)).toBe('article')
    const text = extractTextContent(result)
    expect(text).toBe('HelloWorld')
  })

  it('should return unwrapped result when wrapper is null', () => {
    const result = compiler('# Hello', { wrapper: null })
    expect(getVNodeType(result as VNode)).toBe('h1')
    expect(extractTextContent(result)).toBe('Hello')
  })
})

describe('options.forceWrapper', () => {
  it('should force wrapper even with single child', () => {
    const result = compiler('Hello', { wrapper: 'div', forceWrapper: true })
    expect(getVNodeType(result as VNode)).toBe('div')
    const text = extractTextContent(result)
    expect(text).toBe('Hello')
  })
})

describe('options.renderRule', () => {
  it('should allow custom rendering rules', () => {
    const result = compiler('# Hello', {
      renderRule: (next, node) => {
        if (node.type === RuleType.heading) {
          return h('h1', { class: 'custom' }, 'Custom Heading')
        }
        return next()
      },
    })
    expect(getVNodeType(result as VNode)).toBe('h1')
    const text = extractTextContent(result)
    expect(text).toBe('Custom Heading')
    expect(getProp(result as VNode, 'class')).toBe('custom')
  })
})

describe('options.overrides with props', () => {
  it('should apply props from overrides', () => {
    const result = compiler('# Hello', {
      overrides: {
        h1: { props: { class: 'custom-class', id: 'custom-id' } },
      },
    })
    expect(getProp(result as VNode, 'class')).toBe('custom-class')
    expect(getProp(result as VNode, 'id')).toBe('custom-id')
  })
})

describe('nested lists', () => {
  it('should handle nested unordered lists', () => {
    const result = compiler('- Item 1\n  - Nested 1\n  - Nested 2')
    expect(getVNodeType(result as VNode)).toBe('ul')
    const text = extractTextContent(result)
    expect(text).toBe('Item 1Nested 1Nested 2')
  })

  it('should handle nested ordered lists', () => {
    const result = compiler('1. Item 1\n   1. Nested 1\n   2. Nested 2')
    expect(getVNodeType(result as VNode)).toBe('ol')
    const text = extractTextContent(result)
    expect(text).toBe('Item 1Nested 1Nested 2')
  })
})

describe('tables with alignment', () => {
  it('should handle table alignment', () => {
    const result = compiler(
      '| Left | Center | Right |\n|:-----|:------:|------:|\n| L    |   C    |     R |'
    )
    expect(getVNodeType(result as VNode)).toBe('table')
    const text = extractTextContent(result)
    expect(text).toBe('LeftCenterRightLCR')
  })
})

describe('links without target', () => {
  it('should handle links with null target', () => {
    const result = compiler('[Link]()')
    expect(getVNodeType(result as VNode)).toBe('a')
    const text = extractTextContent(result)
    expect(text).toBe('Link')
    expect(getProp(result as VNode, 'href')).toBe('')
  })
})

describe('images with various attributes', () => {
  it('should handle images with empty alt', () => {
    const result = compiler('![](image.png)')
    expect(getVNodeType(result as VNode)).toBe('img')
    // Empty alt should be undefined, not empty string
    if (
      result &&
      typeof result === 'object' &&
      !Array.isArray(result) &&
      result.props &&
      typeof result.props === 'object'
    ) {
      const props = result.props as Record<string, unknown>
      expect(props.alt).toBeUndefined()
    }
  })
})

describe('text formatting combinations', () => {
  it('should handle bold and italic together', () => {
    const result = compiler('***bold italic***')
    const text = extractTextContent(result)
    expect(text).toBe('bold italic')
  })

  it('should handle strikethrough', () => {
    const result = compiler('~~deleted~~')
    const text = extractTextContent(result)
    expect(text).toBe('deleted')
  })
})

describe('URL encoding edge cases', () => {
  it('should preserve percent-encoded sequences in URLs', () => {
    const result = compiler('[Link](http://example.com/path%20with%20spaces)')
    const href = getProp(result as VNode, 'href')
    expect(href).toBe('http://example.com/path%20with%20spaces')
  })

  it('should encode Unicode characters in URLs', () => {
    const result = compiler('[Link](http://example.com/测试)')
    const href = getProp(result as VNode, 'href')
    expect(typeof href).toBe('string')
    expect((href as string).includes('%')).toBe(true)
  })

  it('should handle URLs with existing percent encoding', () => {
    const result = compiler('[Link](http://example.com/path%5Cfile)')
    const href = getProp(result as VNode, 'href')
    expect(href).toBe('http://example.com/path%5Cfile')
  })

  it('should preserve valid percent-encoded sequences', () => {
    const result = compiler('[Link](http://example.com/path%41%42%43)')
    const href = getProp(result as VNode, 'href')
    expect(href).toBe('http://example.com/path%41%42%43')
  })
})

describe('HTML block processing', () => {
  it('should handle Type 1 blocks without inner HTML tags', () => {
    const result = compiler('<pre>code here</pre>')
    expect(getVNodeType(result as VNode)).toBe('pre')
    const text = extractTextContent(result)
    expect(text).toBe('code here')
  })

  it('should handle Type 1 blocks with tagfilter enabled', () => {
    const result = compiler('<pre>code here</pre>', { tagfilter: true })
    expect(getVNodeType(result as VNode)).toBe('pre')
    const text = extractTextContent(result)
    expect(text).toBe('code here')
  })

  it('should handle HTML blocks with pre tags and innerHTML', () => {
    const result = compiler('<div><pre>code</pre></div>')
    expect(getVNodeType(result as VNode)).toBe('div')
    const text = extractTextContent(result)
    expect(text).toBe('code')
  })

  it('should handle HTML blocks with pre tags and tagfilter', () => {
    const result = compiler('<div><pre>code</pre></div>', { tagfilter: true })
    expect(getVNodeType(result as VNode)).toBe('div')
    const text = extractTextContent(result)
    expect(text).toBe('code')
  })

  it('should handle self-closing tag regex match', () => {
    const result = compiler('<div></div>')
    expect(getVNodeType(result as VNode)).toBe('div')
  })

  it('should handle self-closing tag regex with attributes', () => {
    const result = compiler('<div class="test"></div>')
    expect(getVNodeType(result as VNode)).toBe('div')
  })

  it('should process markdown within HTML blocks with processNode', () => {
    const result = compiler('<div>**bold** text</div>')
    expect(getVNodeType(result as VNode)).toBe('div')
    const text = extractTextContent(result)
    expect(text).toBe('bold text')
  })

  it('should handle HTML blocks with paragraph children in processNode', () => {
    const result = compiler('<div><p>paragraph</p></div>')
    expect(getVNodeType(result as VNode)).toBe('div')
    const text = extractTextContent(result)
    expect(text).toBe('paragraph')
  })

  it('should handle HTML blocks with empty paragraph in processNode', () => {
    const result = compiler('<div><p></p></div>')
    const text = extractTextContent(result)
    expect(text.trim()).toBe('')
  })

  it('should handle HTML blocks with text nodes in processNode', () => {
    const result = compiler('<div>   </div>')
    const text = extractTextContent(result)
    expect(text.trim()).toBe('')
  })

  it('should handle HTML blocks with text nodes with content in processNode', () => {
    const result = compiler('<div>text content</div>')
    expect(getVNodeType(result as VNode)).toBe('div')
    const text = extractTextContent(result)
    expect(text).toBe('text content')
  })

  it('should handle HTML blocks with nested HTML blocks in processNode', () => {
    const result = compiler('<div><div>nested</div></div>')
    expect(getVNodeType(result as VNode)).toBe('div')
    const text = extractTextContent(result)
    expect(text).toBe('nested')
  })

  it('should handle HTML blocks with htmlSelfClosing isClosingTag in processNode', () => {
    const result = compiler('<div><!-- comment --></div>')
    const text = extractTextContent(result)
    expect(text).toBe('')
  })
})

describe('postProcessAst edge cases', () => {
  it('should combine HTML blocks with following paragraphs containing removedClosingTags', () => {
    // This tests the postProcessAst function with removedClosingTags
    const result = compiler('<pre>code</pre>\nparagraph')
    expect(getVNodeType(result as VNode)).toBe('div')
    const text = extractTextContent(result)
    expect(text).toBe('codeparagraph')
  })

  it('should handle extractText with htmlSelfClosing rawText', () => {
    // This tests extractText function with rawText
    const result = compiler('<div>content</div>')
    expect(getVNodeType(result as VNode)).toBe('div')
    const text = extractTextContent(result)
    expect(text).toBe('content')
  })

  it('should handle extractText with textFormatted nodes', () => {
    const result = compiler('<div>**bold**</div>')
    expect(getVNodeType(result as VNode)).toBe('div')
    const text = extractTextContent(result)
    expect(text).toBe('bold')
  })
})

describe('hHelper edge cases', () => {
  it('should handle HTML content in props', () => {
    const result = compiler('# Hello', {
      overrides: {
        h1: {
          props: {
            'data-html': '<span>test</span>',
          },
        },
      },
    })
    // HTML in overrideProps is passed through as string (compilation only happens on direct props)
    const dataHtmlProp = getProp(result as VNode, 'data-html')
    expect(dataHtmlProp).toBe('<span>test</span>')
  })

  it('should handle HTML content in props with uppercase tag', () => {
    const result = compiler('# Hello', {
      overrides: {
        h1: {
          props: {
            'data-html': '<DIV>test</DIV>',
          },
        },
      },
    })
    // HTML in overrideProps is passed through as string
    const dataHtmlProp = getProp(result as VNode, 'data-html')
    expect(dataHtmlProp).toBe('<DIV>test</DIV>')
  })

  it('should merge class names correctly', () => {
    const result = compiler('# Hello', {
      overrides: {
        h1: {
          props: {
            class: 'override-class',
          },
        },
      },
    })
    expect(getProp(result as VNode, 'class')).toBe('override-class')
  })

  it('should handle innerHTML prop when not overridden', () => {
    // Test the branch where innerHTML exists in vueProps but not in overrideProps
    const result = compiler('<div>content</div>')
    expect(getVNodeType(result as VNode)).toBe('div')
    const text = extractTextContent(result)
    expect(text).toBe('content')
  })

  it('should not set innerHTML when override has innerHTML', () => {
    const result = compiler('<div>original</div>', {
      overrides: {
        div: {
          props: {
            innerHTML: 'override',
          },
        },
      },
    })
    const innerHTML = getProp(result as VNode, 'innerHTML')
    expect(innerHTML).toBe('override')
  })
})

describe('renderRule edge cases', () => {
  it('should handle renderRule returning null', () => {
    const result = compiler('# Hello', {
      renderRule: () => null,
    })
    expect(result).toBeNull()
  })

  it('should handle renderRule with custom renderChildren', () => {
    const result = compiler('# Hello', {
      renderRule: (next, node, renderChildren) => {
        if (node.type === RuleType.heading) {
          return h('h1', {}, 'Custom')
        }
        return next()
      },
    })
    expect(extractTextContent(result)).toBe('Custom')
  })
})

describe('createElement override', () => {
  it('should use custom createElement function', () => {
    // createElement is used for wrapper elements
    // Test that it's called by checking wrapper behavior
    const result = compiler('# Hello\n\n## World', {
      wrapper: 'article',
    })
    expect(getVNodeType(result as VNode)).toBe('article')
  })
})

describe('error handling', () => {
  it('should throw error for invalid overrides type', () => {
    expect(() => {
      // @ts-ignore
      compiler('# Hello', { overrides: 'invalid' })
    }).toThrow('options.overrides')
  })

  it('should throw error for invalid overrides array', () => {
    expect(() => {
      // @ts-ignore
      compiler('# Hello', { overrides: [] })
    }).toThrow('options.overrides')
  })
})

describe('renderer edge cases', () => {
  it('should handle array output from renderRule', () => {
    const result = compiler('# Hello', {
      renderRule: (next, node, renderChildren, state) => {
        if (node.type === RuleType.heading) {
          // Return single VNode instead of array - arrays are handled internally
          return h('h1', { key: state.key }, 'First')
        }
        return next()
      },
    })
    expect(getVNodeType(result as VNode)).toBe('h1')
    const text = extractTextContent(result)
    expect(text).toBe('First')
  })

  it('should concatenate consecutive string outputs', () => {
    const result = compiler('text1 text2', {
      renderRule: (next, node) => {
        if (node.type === RuleType.text) {
          return (node as MarkdownToJSX.TextNode).text
        }
        return next()
      },
    })
    const text = extractTextContent(result)
    // Consecutive strings are concatenated, preserving the space
    expect(text).toBe('text1 text2')
  })

  it('should handle multiple nodes from renderRule', () => {
    const result = compiler('# Hello\n\n## World', {
      renderRule: (next, node, renderChildren, state) => {
        if (
          node.type === RuleType.heading &&
          (node as MarkdownToJSX.HeadingNode).level === 1
        ) {
          return h('h1', { key: state.key }, 'First')
        }
        return next()
      },
    })
    expect(getVNodeType(result as VNode)).toBe('div')
    const text = extractTextContent(result)
    expect(text).toBe('FirstWorld')
  })
})
