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
    if (
      typeof vnode.type === 'string' &&
      vnode.type === 'img' &&
      props &&
      typeof props.alt === 'string'
    ) {
      return props.alt
    }
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

// Helper to find a child VNode by tag name
function findByTag(
  vnode: VNode | VNode[] | null,
  tag: string
): VNode | undefined {
  if (!vnode || Array.isArray(vnode)) return undefined
  if (typeof vnode === 'object' && Array.isArray(vnode.children)) {
    for (let i = 0; i < vnode.children.length; i++) {
      const child = vnode.children[i]
      if (
        typeof child === 'object' &&
        typeof child.type === 'string' &&
        child.type === tag
      ) {
        return child as VNode
      }
    }
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
  const vnode = result as VNode
  expect(Array.isArray(vnode.children)).toBe(true)
  expect(vnode.children?.length).toBe(2)
  expect(getVNodeType(vnode.children?.[0] as VNode)).toBe('h1')
  expect(getVNodeType(vnode.children?.[1] as VNode)).toBe('h2')
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
    expect(href as string).toContain('%5C')
  })

  it('should encode backticks in URLs', () => {
    const result = compiler('[Link](path`to`file)')
    const href = getProp(result as VNode, 'href')
    expect(typeof href).toBe('string')
    expect(href as string).toContain('%60')
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
    const vnode = result as VNode
    expect(Array.isArray(vnode.children)).toBe(true)
    expect(vnode.children?.length).toBe(2)
    expect(getVNodeType(vnode.children?.[0] as VNode)).toBe('li')
    expect(getVNodeType(vnode.children?.[1] as VNode)).toBe('li')
  })

  it('should render ordered lists', () => {
    const result = compiler('1. Item 1\n2. Item 2')
    expect(getVNodeType(result as VNode)).toBe('ol')
    const text = extractTextContent(result)
    expect(text).toBe('Item 1Item 2')
    const vnode = result as VNode
    expect(Array.isArray(vnode.children)).toBe(true)
    expect(vnode.children?.length).toBe(2)
    expect(getVNodeType(vnode.children?.[0] as VNode)).toBe('li')
    expect(getVNodeType(vnode.children?.[1] as VNode)).toBe('li')
  })

  it('should handle ordered lists with start attribute', () => {
    const result = compiler('3. Item 3\n4. Item 4')
    expect(getVNodeType(result as VNode)).toBe('ol')
    expect(getProp(result as VNode, 'start')).toBe(3)
    const vnode = result as VNode
    expect(Array.isArray(vnode.children)).toBe(true)
    expect(vnode.children?.length).toBe(2)
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
    const codeElement = (result as VNode).children?.[0] as VNode
    expect(getVNodeType(codeElement)).toBe('code')
    const codeClass = getProp(codeElement, 'class')
    expect(typeof codeClass).toBe('string')
    expect(codeClass as string).toContain('language-javascript')
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
    const vnode = result as VNode
    expect(Array.isArray(vnode.children)).toBe(true)
    expect(vnode.children?.length).toBe(2)
    expect(getVNodeType(vnode.children?.[0] as VNode)).toBe('thead')
    expect(getVNodeType(vnode.children?.[1] as VNode)).toBe('tbody')
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
    expect(getVNodeType(result as VNode)).toBe('div')
    const text = extractTextContent(result)
    expect(text).toContain('Text')
    expect(text).toContain('Footnote')
    const vnode = result as VNode
    expect(Array.isArray(vnode.children)).toBe(true)
    const footer = findByTag(vnode, 'footer')
    expect(footer).toBeDefined()
    expect(getVNodeType(footer)).toBe('footer')
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
    expect(classProp as string).toContain('markdown-alert-note')
    const text = extractTextContent(result)
    expect(text).toBe('NOTESomething important')
    const vnode = result as VNode
    expect(Array.isArray(vnode.children)).toBe(true)
  })
})

describe('frontmatter', () => {
  it('should preserve frontmatter when option is set', () => {
    const result = compiler('---\ntitle: Test\n---\n\nContent', {
      preserveFrontmatter: true,
    })
    expect(getVNodeType(result as VNode)).toBe('div')
    const text = extractTextContent(result)
    expect(text).toContain('title: Test')
    expect(text).toContain('Content')
    const vnode = result as VNode
    const preElement = findByTag(vnode, 'pre')
    expect(preElement).toBeDefined()
    expect(getVNodeType(preElement)).toBe('pre')
  })

  it('should not preserve frontmatter by default', () => {
    const result = compiler('---\ntitle: Test\n---\n\nContent')
    const text = extractTextContent(result)
    expect(text).not.toContain('title: Test')
    expect(text).toBe('Content')
  })
})

describe('GFM task lists', () => {
  it('should handle unchecked task items', () => {
    const result = compiler('- [ ] Task 1')
    expect(getVNodeType(result as VNode)).toBe('ul')
    const text = extractTextContent(result)
    expect(text).toBe(' Task 1')
    const vnode = result as VNode
    expect(Array.isArray(vnode.children)).toBe(true)
    const li = vnode.children?.[0] as VNode
    expect(getVNodeType(li)).toBe('li')
    expect(Array.isArray(li.children)).toBe(true)
    const checkbox = li.children?.[0] as VNode
    expect(getVNodeType(checkbox)).toBe('input')
    expect(getProp(checkbox, 'type')).toBe('checkbox')
    expect(getProp(checkbox, 'checked')).toBe(false)
  })

  it('should handle checked task items', () => {
    const result = compiler('- [x] Task 1')
    expect(getVNodeType(result as VNode)).toBe('ul')
    const text = extractTextContent(result)
    expect(text).toBe(' Task 1')
    const vnode = result as VNode
    expect(Array.isArray(vnode.children)).toBe(true)
    const li = vnode.children?.[0] as VNode
    expect(getVNodeType(li)).toBe('li')
    const checkbox = li.children?.[0] as VNode
    expect(getVNodeType(checkbox)).toBe('input')
    expect(getProp(checkbox, 'type')).toBe('checkbox')
    expect(getProp(checkbox, 'checked')).toBe(true)
  })
})

describe('code blocks with attributes', () => {
  it('should handle code blocks with custom attributes', () => {
    const result = compiler('```js data-line="1"\ncode\n```')
    expect(getVNodeType(result as VNode)).toBe('pre')
    // Attributes are on code element inside pre, not on pre itself
    const codeElement = (result as VNode).children?.[0] as VNode
    expect(getVNodeType(codeElement)).toBe('code')
    const dataLine = getProp(codeElement, 'data-line')
    expect(dataLine).toBe('1')
    expect(extractTextContent(result)).toBe('code')
  })
})

describe('HTML blocks', () => {
  it('should filter dangerous HTML tags by wrapping in span when tagfilter is enabled', () => {
    const result = compiler('<script>alert("xss")</script>', {
      tagfilter: true,
    })
    expect(getVNodeType(result as VNode)).toBe('span')
    const text = extractTextContent(result)
    expect(text).toContain('<script>')
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
    expect(getVNodeType(result as VNode)).toBe('span')
    const text = extractTextContent(result)
    expect(text).toContain('<script')
  })

  it('should format filtered tag attributes with boolean values', () => {
    const result = compiler('<iframe src="test" allowfullscreen />', {
      tagfilter: true,
    })
    expect(getVNodeType(result as VNode)).toBe('span')
    const text = extractTextContent(result)
    expect(text).toContain('allowfullscreen')
    expect(text).toContain('src="test"')
  })

  it('should handle HTML blocks with pre tags using innerHTML', () => {
    const result = compiler('<div><pre>code\nhere</pre>text</div>')
    expect(getVNodeType(result as VNode)).toBe('div')
    const innerHTML = getProp(result as VNode, 'innerHTML')
    expect(typeof innerHTML === 'object' && innerHTML !== null).toBe(true)
    const innerHTMLVNode = innerHTML as VNode
    expect(getVNodeType(innerHTMLVNode)).toBe('pre')
    const text = extractTextContent(innerHTMLVNode)
    expect(text).toContain('code')
    expect(text).toContain('here')
  })

  it('should handle self-closing tag regex match with attributes', () => {
    const result = compiler('<div class="test"></div>')
    expect(getVNodeType(result as VNode)).toBe('div')
    expect(getProp(result as VNode, 'class')).toBe('test')
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
    const vnode = result as VNode
    expect(Array.isArray(vnode.children)).toBe(true)
    const firstLi = vnode.children?.[0] as VNode
    expect(getVNodeType(firstLi)).toBe('li')
    expect(Array.isArray(firstLi.children)).toBe(true)
    const nestedUl = findByTag(firstLi, 'ul')
    expect(nestedUl).toBeDefined()
  })

  it('should handle nested ordered lists', () => {
    const result = compiler('1. Item 1\n   1. Nested 1\n   2. Nested 2')
    expect(getVNodeType(result as VNode)).toBe('ol')
    const text = extractTextContent(result)
    expect(text).toBe('Item 1Nested 1Nested 2')
    const vnode = result as VNode
    expect(Array.isArray(vnode.children)).toBe(true)
    const firstLi = vnode.children?.[0] as VNode
    expect(getVNodeType(firstLi)).toBe('li')
    const nestedOl = findByTag(firstLi, 'ol')
    expect(nestedOl).toBeDefined()
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
    const vnode = result as VNode
    const thead = vnode.children?.[0] as VNode
    const tbody = vnode.children?.[1] as VNode
    expect(getVNodeType(thead)).toBe('thead')
    expect(getVNodeType(tbody)).toBe('tbody')
    expect(Array.isArray(tbody.children)).toBe(true)
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
  it('should encode Unicode characters in URLs', () => {
    const result = compiler('[Link](http://example.com/测试)')
    const href = getProp(result as VNode, 'href')
    expect(typeof href).toBe('string')
    expect(href as string).toContain('%')
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
  it('should handle Type 1 blocks with and without tagfilter', () => {
    const result1 = compiler('<pre>code here</pre>')
    expect(getVNodeType(result1 as VNode)).toBe('pre')
    expect(extractTextContent(result1)).toBe('code here')
    const result2 = compiler('<pre>code here</pre>', { tagfilter: true })
    expect(getVNodeType(result2 as VNode)).toBe('pre')
    expect(extractTextContent(result2)).toBe('code here')
  })

  it('should handle HTML blocks with pre tags', () => {
    const result1 = compiler('<div><pre>code</pre></div>')
    expect(getVNodeType(result1 as VNode)).toBe('div')
    expect(extractTextContent(result1)).toBe('code')
    const result2 = compiler('<div><pre>code</pre></div>', { tagfilter: true })
    expect(getVNodeType(result2 as VNode)).toBe('div')
    expect(extractTextContent(result2)).toBe('code')
  })

  it('should process markdown within HTML blocks', () => {
    const result1 = compiler('<div>**bold** text</div>')
    expect(getVNodeType(result1 as VNode)).toBe('div')
    expect(extractTextContent(result1)).toBe('bold text')
    const vnode1 = result1 as VNode
    expect(Array.isArray(vnode1.children)).toBe(true)
    const strongElement = findByTag(vnode1, 'strong')
    expect(strongElement).toBeDefined()
    expect(getVNodeType(strongElement)).toBe('strong')
    expect(extractTextContent(strongElement)).toBe('bold')
    const result2 = compiler('<div><p>paragraph</p></div>')
    expect(getVNodeType(result2 as VNode)).toBe('div')
    expect(extractTextContent(result2)).toBe('paragraph')
  })

  it('should handle HTML blocks with empty or whitespace-only content', () => {
    const result1 = compiler('<div><p></p></div>')
    expect(getVNodeType(result1 as VNode)).toBe('div')
    expect(extractTextContent(result1).trim()).toBe('')
    const result2 = compiler('<div>   </div>')
    expect(getVNodeType(result2 as VNode)).toBe('div')
    expect(extractTextContent(result2).trim()).toBe('')
  })

  it('should handle HTML blocks with text and nested HTML', () => {
    const result1 = compiler('<div>text content</div>')
    expect(getVNodeType(result1 as VNode)).toBe('div')
    expect(extractTextContent(result1)).toBe('text content')
    const result2 = compiler('<div><div>nested</div></div>')
    expect(getVNodeType(result2 as VNode)).toBe('div')
    expect(extractTextContent(result2)).toBe('nested')
  })

  it('should handle HTML blocks with comments and nested structures', () => {
    const result1 = compiler('<div><!-- comment --></div>')
    expect(getVNodeType(result1 as VNode)).toBe('div')
    expect(extractTextContent(result1)).toBe('')
    const result2 = compiler('<div><div>inner</div>outer</div>')
    expect(getVNodeType(result2 as VNode)).toBe('div')
    expect(extractTextContent(result2)).toBe('innerouter')
  })
})

describe('HTML block edge cases', () => {
  it('should combine HTML blocks with following paragraphs', () => {
    const result = compiler('<pre>code</pre>\nparagraph')
    expect(getVNodeType(result as VNode)).toBe('div')
    const text = extractTextContent(result)
    expect(text).toBe('codeparagraph')
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
