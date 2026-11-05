/** @jsxImportSource vue */

import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test'
import { h, type VNode } from 'vue'
import type { MarkdownToJSX } from './types.ts'
import Markdown, {
  astToJSX,
  compiler,
  parser,
  RuleType,
  sanitizer,
  type VueOptions,
} from './vue.tsx'

afterEach(() => {
  mock.clearAllMocks()
})

// Helper to extract text content from Vue VNode structure
function extractTextContent(
  element: VNode | VNode[] | string | null | undefined
): string {
  if (!element) {
    return ''
  }
  if (typeof element === 'string') {
    return element
  }
  if (typeof element === 'number') {
    return String(element)
  }
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
    // Check innerHTML prop first (for verbatim blocks like pre/script)
    if (props?.innerHTML !== undefined) {
      return extractTextContent(props.innerHTML as VNode | VNode[] | string)
    }
    const children =
      props?.children === undefined
        ? 'children' in vnode
          ? vnode.children
          : undefined
        : props.children
    if (children !== undefined) {
      // Handle slot functions (e.g., { default: () => [...] })
      if (
        typeof children === 'object' &&
        children !== null &&
        !Array.isArray(children) &&
        typeof (children as Record<string, unknown>).default === 'function'
      ) {
        return extractTextContent(
          (children as Record<string, () => VNode[]>).default() as VNode[]
        )
      }
      return extractTextContent(children as VNode | VNode[] | string)
    }
  }
  return ''
}

// Serialize a Vue VNode tree to an HTML-like string so nesting and sibling
// order (not just text presence) are asserted.
function serialize(el: unknown): string {
  if (el === null || typeof el === 'boolean') {
    return ''
  }
  if (typeof el === 'string' || typeof el === 'number') {
    return String(el)
  }
  if (Array.isArray(el)) {
    return el.map(serialize).join('')
  }
  const vnode = el as VNode
  const props = (vnode.props as Record<string, unknown>) || {}
  let kids: unknown = vnode.children
  if (
    kids &&
    typeof kids === 'object' &&
    !Array.isArray(kids) &&
    typeof (kids as Record<string, unknown>).default === 'function'
  ) {
    kids = (kids as { default: () => unknown }).default()
  }
  if (props.innerHTML !== undefined) {
    kids = props.innerHTML
  }
  const inner = typeof kids === 'string' ? kids : serialize(kids)
  return typeof vnode.type === 'string'
    ? `<${vnode.type}>${inner}</${vnode.type}>`
    : inner
}

// Type guard to check if result is a single VNode (not array or null)
function isSingleVNode(
  vnode: VNode | VNode[] | null | undefined
): vnode is VNode {
  return vnode != null && !Array.isArray(vnode)
}

// Helper to get prop value from VNode
function getProp(
  vnode: VNode | VNode[] | null | undefined,
  prop: string
): unknown {
  if (!isSingleVNode(vnode)) {
    return
  }
  if (vnode.props && typeof vnode.props === 'object') {
    return (vnode.props as Record<string, unknown>)[prop]
  }
}

function isVNode(value: unknown): value is VNode {
  return typeof value === 'object' && value !== null && 'type' in value
}

/** Vue types `children` as string | VNodeArrayChildren | RawSlots; tests index normalized arrays. */
function vnodeChildAt(vnode: VNode, index: number): VNode | undefined {
  const kids = vnode.children
  if (!Array.isArray(kids)) {
    return
  }
  const child = kids[index]
  return isVNode(child) ? child : undefined
}

// Helper to get VNode type
function getVNodeType(
  vnode: VNode | VNode[] | null | undefined
): string | undefined {
  if (!isSingleVNode(vnode)) {
    return
  }
  if (typeof vnode.type === 'string') {
    return vnode.type
  }
}

// Helper to find a child VNode by tag name
function findByTag(
  vnode: VNode | VNode[] | null,
  tag: string
): VNode | undefined {
  if (!isSingleVNode(vnode)) {
    return
  }
  if (Array.isArray(vnode.children)) {
    for (let i = 0; i < vnode.children.length; i++) {
      const child = vnode.children[i]
      if (
        isVNode(child) &&
        typeof child.type === 'string' &&
        child.type === tag
      ) {
        return child
      }
    }
  }
}

it('should throw if not passed a string (first arg)', () => {
  expect(() => compiler('')).not.toThrow()
  expect(() => compiler()).not.toThrow()
  // @ts-expect-error -- negative-behavior test: non-string input must throw
  expect(() => compiler(1)).toThrow()
  // @ts-expect-error -- negative-behavior test: non-string input must throw
  expect(() => compiler(() => {})).toThrow()
  // @ts-expect-error -- negative-behavior test: non-string input must throw
  expect(() => compiler({})).toThrow()
  // @ts-expect-error -- negative-behavior test: non-string input must throw
  expect(() => compiler([])).toThrow()
  // @ts-expect-error -- negative-behavior test: non-string input must throw
  expect(() => compiler(null)).toThrow()
  // @ts-expect-error -- negative-behavior test: non-string input must throw
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
  expect(getVNodeType(result)).toBe('div')
  const text = extractTextContent(result)
  expect(text).toBe('BoopBlep')
  if (!isSingleVNode(result)) {
    throw new Error('Expected single VNode')
  }
  expect(Array.isArray(result.children)).toBe(true)
  expect(result.children?.length).toBe(2)
  const child0 = isSingleVNode(result) ? vnodeChildAt(result, 0) : undefined
  const child1 = isSingleVNode(result) ? vnodeChildAt(result, 1) : undefined
  if (child0) {
    expect(getVNodeType(child0)).toBe('h1')
  }
  if (child1) {
    expect(getVNodeType(child1)).toBe('h2')
  }
})

it('wraps solely inline elements in a span, rather than a div', () => {
  const result = compiler("Hello. _Beautiful_ day isn't it?")
  expect(getVNodeType(result)).toBe('span')
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
    expect(getVNodeType(result)).toBe('hr')
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
    expect(getVNodeType(result)).toBe('h1')
    expect(extractTextContent(result)).toBe('Hello World')
  })

  it('should render h2 headings', () => {
    const result = compiler('## Hello World')
    expect(getVNodeType(result)).toBe('h2')
    expect(extractTextContent(result)).toBe('Hello World')
  })

  it('should generate IDs for headings', () => {
    const result = compiler('# Hello World')
    expect(getVNodeType(result)).toBe('h1')
    const id = getProp(result, 'id')
    expect(typeof id).toBe('string')
    expect(id).toBe('hello-world')
  })

  it('should handle setext level 1 style', () => {
    const result = compiler('Hello World\n===========\n\nsomething')
    expect(getVNodeType(result)).toBe('div')
    const text = extractTextContent(result)
    expect(text).toBe('Hello Worldsomething')
  })

  it('should handle setext level 2 style', () => {
    const result = compiler('Hello World\n-----------\n\nsomething')
    expect(getVNodeType(result)).toBe('div')
    const text = extractTextContent(result)
    expect(text).toBe('Hello Worldsomething')
  })
})

describe('links', () => {
  it('should render inline links', () => {
    const result = compiler('[Link](https://example.com)')
    expect(getVNodeType(result)).toBe('a')
    expect(extractTextContent(result)).toBe('Link')
    expect(getProp(result, 'href')).toBe('https://example.com')
  })

  it('should render reference links', () => {
    const result = compiler('[Link][ref]\n\n[ref]: https://example.com')
    // Reference links are wrapped in paragraph
    expect(getVNodeType(result)).toBe('p')
    const text = extractTextContent(result)
    expect(text).toBe('Link')
    // The link is nested inside the paragraph
    if (!isSingleVNode(result)) {
      throw new Error('Expected single VNode')
    }
    const vnode = result
    expect(Array.isArray(vnode.children)).toBe(true)
  })

  it('should handle links without target', () => {
    const result = compiler('[Link]()')
    expect(getVNodeType(result)).toBe('a')
    expect(extractTextContent(result)).toBe('Link')
    expect(getProp(result, 'href')).toBe('')
  })

  it('should handle links with title', () => {
    const result = compiler('[Link](https://example.com "Title")')
    expect(getProp(result, 'title')).toBe('Title')
    expect(getProp(result, 'href')).toBe('https://example.com')
  })

  it('should encode backslashes in URLs', () => {
    const result = compiler('[Link](path\\to\\file)')
    const href = getProp(result, 'href')
    expect(typeof href).toBe('string')
    expect(href as string).toContain('%5C')
  })

  it('should encode backticks in URLs', () => {
    const result = compiler('[Link](path`to`file)')
    const href = getProp(result, 'href')
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
    expect(getVNodeType(result)).toBe('img')
    expect(getProp(result, 'alt')).toBe('Alt text')
    expect(getProp(result, 'src')).toBe('image.png')
  })

  it('should handle images without alt text', () => {
    const result = compiler('![](image.png)')
    expect(getVNodeType(result)).toBe('img')
    expect(getProp(result, 'src')).toBe('image.png')
  })

  it('should handle images with title', () => {
    const result = compiler('![Alt](image.png "Title")')
    expect(getVNodeType(result)).toBe('img')
    expect(getProp(result, 'alt')).toBe('Alt')
    expect(getProp(result, 'title')).toBe('Title')
    expect(getProp(result, 'src')).toBe('image.png')
  })
})

describe('lists', () => {
  it('should render unordered lists', () => {
    const result = compiler('- Item 1\n- Item 2')
    expect(getVNodeType(result)).toBe('ul')
    const text = extractTextContent(result)
    expect(text).toBe('Item 1Item 2')
    if (!isSingleVNode(result)) {
      throw new Error('Expected single VNode')
    }
    const vnode = result
    expect(Array.isArray(vnode.children)).toBe(true)
    expect(vnode.children?.length).toBe(2)
    expect(getVNodeType(vnodeChildAt(vnode, 0))).toBe('li')
    expect(getVNodeType(vnodeChildAt(vnode, 1))).toBe('li')
  })

  it('should render ordered lists', () => {
    const result = compiler('1. Item 1\n2. Item 2')
    expect(getVNodeType(result)).toBe('ol')
    const text = extractTextContent(result)
    expect(text).toBe('Item 1Item 2')
    if (!isSingleVNode(result)) {
      throw new Error('Expected single VNode')
    }
    const vnode = result
    expect(Array.isArray(vnode.children)).toBe(true)
    expect(vnode.children?.length).toBe(2)
    expect(getVNodeType(vnodeChildAt(vnode, 0))).toBe('li')
    expect(getVNodeType(vnodeChildAt(vnode, 1))).toBe('li')
  })

  it('should handle ordered lists with start attribute', () => {
    const result = compiler('3. Item 3\n4. Item 4')
    expect(getVNodeType(result)).toBe('ol')
    expect(getProp(result, 'start')).toBe(3)
    if (!isSingleVNode(result)) {
      throw new Error('Expected single VNode')
    }
    const vnode = result
    expect(Array.isArray(vnode.children)).toBe(true)
    expect(vnode.children?.length).toBe(2)
  })
})

describe('code blocks', () => {
  it('should render fenced code blocks', () => {
    const result = compiler('```js\nconsole.log("hello");\n```')
    expect(getVNodeType(result)).toBe('pre')
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
    expect(getVNodeType(result)).toBe('pre')
    const codeElement = isSingleVNode(result)
      ? vnodeChildAt(result, 0)
      : undefined
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
    expect(getVNodeType(result)).toBe('h1')
    expect(getProp(result, 'class')).toBe('custom-class')
    expect(getProp(result, 'className')).toBeUndefined()
  })

  it('should handle component overrides', () => {
    const CustomHeading = (props: any) => h('h1', { ...props, class: 'custom' })
    const result = compiler('# Hello', {
      overrides: {
        h1: CustomHeading,
      },
    })
    // Component overrides result in function component type
    if (!isSingleVNode(result)) {
      throw new Error('Expected single VNode')
    }
    expect(typeof result.type).toBe('function')
    expect(result.type).toBe(CustomHeading)
    expect(extractTextContent(result)).toBe('Hello')
  })

  it('should handle Options API component overrides with render function', () => {
    const OptionsApiComponent = {
      render() {
        return h('h1', { class: 'options-api' }, 'Options API Heading')
      },
    }
    const result = compiler('# Hello', {
      overrides: {
        h1: OptionsApiComponent,
      },
    })
    // Object-based component should be recognized and passed to h()
    if (!isSingleVNode(result)) {
      throw new Error('Expected single VNode')
    }
    expect(typeof result.type).toBe('object')
    expect(result.type).toBe(OptionsApiComponent)
    // Verify the component has a render function (Options API)
    expect('render' in OptionsApiComponent).toBe(true)
    expect(typeof OptionsApiComponent.render).toBe('function')
    // Verify the component's render function produces the expected output
    const renderedOutput = OptionsApiComponent.render()
    expect(getVNodeType(renderedOutput as VNode)).toBe('h1')
    expect(getProp(renderedOutput as VNode, 'class')).toBe('options-api')
    expect(extractTextContent(renderedOutput)).toBe('Options API Heading')
  })

  it('should handle Composition API component overrides with setup function', () => {
    const CompositionApiComponent = {
      setup() {
        return () =>
          h('h1', { class: 'composition-api' }, 'Composition API Heading')
      },
    }
    const result = compiler('# Hello', {
      overrides: {
        h1: CompositionApiComponent,
      },
    })
    // Object-based component should be recognized and passed to h()
    if (!isSingleVNode(result)) {
      throw new Error('Expected single VNode')
    }
    expect(typeof result.type).toBe('object')
    expect(result.type).toBe(CompositionApiComponent)
    // Verify the component has a setup function (Composition API)
    expect('setup' in CompositionApiComponent).toBe(true)
    expect(typeof CompositionApiComponent.setup).toBe('function')
    // Verify the component's setup function produces the expected output
    const renderFn = CompositionApiComponent.setup()
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
    expect(getVNodeType(result)).toBe('table')
    const text = extractTextContent(result)
    expect(text).toBe('HeaderCell')
    if (!isSingleVNode(result)) {
      throw new Error('Expected single VNode')
    }
    const vnode = result
    expect(Array.isArray(vnode.children)).toBe(true)
    expect(vnode.children?.length).toBe(2)
    expect(getVNodeType(vnodeChildAt(vnode, 0))).toBe('thead')
    expect(getVNodeType(vnodeChildAt(vnode, 1))).toBe('tbody')
  })

  it('#513 should not render empty tbody when table has no data rows', () => {
    const result = compiler('| A | B |\n|---|---|')
    if (!isSingleVNode(result)) {
      throw new Error('Expected single VNode')
    }
    const vnode = result
    expect(vnode.children?.length).toBe(1)
    expect(getVNodeType(vnodeChildAt(vnode, 0))).toBe('thead')
  })
})

describe('blockquotes', () => {
  it('should render blockquotes', () => {
    const result = compiler('> This is a quote')
    expect(getVNodeType(result)).toBe('blockquote')
    const text = extractTextContent(result)
    expect(text).toBe('This is a quote')
  })
})

describe('footnotes', () => {
  it('should handle footnote references', () => {
    const result = compiler('Text[^1]\n\n[^1]: Footnote')
    expect(getVNodeType(result)).toBe('div')
    const text = extractTextContent(result)
    expect(text).toContain('Text')
    expect(text).toContain('Footnote')
    if (!isSingleVNode(result)) {
      throw new Error('Expected single VNode')
    }
    const vnode = result
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
    expect(getVNodeType(vnodes)).toBe('h1')
    expect(extractTextContent(vnodes)).toBe('Hello')
  })
})

interface MarkdownProps {
  children?: string | null
  options?: VueOptions
  [key: string]: unknown
}

// Markdown is implemented as a functional component, so we can type it as a function
type MarkdownComponent = (props: MarkdownProps) => VNode | VNode[] | null

describe('Markdown component', () => {
  // Calling the functional component outside a Vue setup() triggers inject() DEV
  // warnings; silence them so console-leak does not fail these unit checks.
  afterEach(() => {
    mock.restore()
  })

  it('should render markdown via component', () => {
    spyOn(console, 'warn').mockImplementation(() => {})
    // Markdown is a functional component, call it directly
    const result = (Markdown as MarkdownComponent)({ children: '# Hello' })
    expect(getVNodeType(result)).toBe('h1')
    expect(extractTextContent(result)).toBe('Hello')
  })

  it('should handle null children', () => {
    spyOn(console, 'warn').mockImplementation(() => {})
    // Markdown component converts null to empty string
    const result = (Markdown as MarkdownComponent)({ children: null })
    expect(result).toBeNull()
  })

  it('should merge additional props into wrapperProps', () => {
    spyOn(console, 'warn').mockImplementation(() => {})
    // Markdown component merges restProps into wrapperProps
    const result = (Markdown as MarkdownComponent)({
      children: '# Hello\n\n## World',
      'data-testid': 'markdown-wrapper',
      id: 'test-id',
    })
    expect(getVNodeType(result)).toBe('div')
    expect(getProp(result, 'data-testid')).toBe('markdown-wrapper')
    expect(getProp(result, 'id')).toBe('test-id')
  })

  it('should pass options through to compiler', () => {
    spyOn(console, 'warn').mockImplementation(() => {})
    const result = (Markdown as MarkdownComponent)({
      children: '# Hello',
      options: {
        overrides: {
          h1: { props: { class: 'custom-class' } },
        },
      },
    })
    expect(getVNodeType(result)).toBe('h1')
    expect(getProp(result, 'class')).toBe('custom-class')
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
    expect(getVNodeType(result)).toBe('blockquote')
    const classProp = getProp(result, 'class')
    expect(typeof classProp).toBe('string')
    expect(classProp as string).toContain('markdown-alert-note')
    const text = extractTextContent(result)
    expect(text).toBe('NOTESomething important')
    if (!isSingleVNode(result)) {
      throw new Error('Expected single VNode')
    }
    const vnode = result
    expect(Array.isArray(vnode.children)).toBe(true)
  })
})

describe('frontmatter', () => {
  it('should preserve frontmatter when option is set', () => {
    const result = compiler('---\ntitle: Test\n---\n\nContent', {
      preserveFrontmatter: true,
    })
    expect(getVNodeType(result)).toBe('div')
    const text = extractTextContent(result)
    expect(text).toContain('title: Test')
    expect(text).toContain('Content')
    if (!isSingleVNode(result)) {
      throw new Error('Expected single VNode')
    }
    const vnode = result
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
    expect(getVNodeType(result)).toBe('ul')
    const text = extractTextContent(result)
    expect(text).toBe(' Task 1')
    if (!isSingleVNode(result)) {
      throw new Error('Expected single VNode')
    }
    const vnode = result
    expect(Array.isArray(vnode.children)).toBe(true)
    const li = vnodeChildAt(vnode, 0)
    if (li) {
      expect(getVNodeType(li)).toBe('li')
      const checkbox = vnodeChildAt(li, 0)
      if (checkbox) {
        expect(getVNodeType(checkbox)).toBe('input')
        expect(getProp(checkbox, 'type')).toBe('checkbox')
        expect(getProp(checkbox, 'checked')).toBe(false)
      }
    }
  })

  it('should handle checked task items', () => {
    const result = compiler('- [x] Task 1')
    expect(getVNodeType(result)).toBe('ul')
    const text = extractTextContent(result)
    expect(text).toBe(' Task 1')
    if (!isSingleVNode(result)) {
      throw new Error('Expected single VNode')
    }
    const vnode = result
    expect(Array.isArray(vnode.children)).toBe(true)
    const li = vnodeChildAt(vnode, 0)
    expect(getVNodeType(li)).toBe('li')
    const checkbox = li ? vnodeChildAt(li, 0) : undefined
    expect(getVNodeType(checkbox)).toBe('input')
    expect(getProp(checkbox, 'type')).toBe('checkbox')
    expect(getProp(checkbox, 'checked')).toBe(true)
  })
})

describe('code blocks with attributes', () => {
  it('should handle code blocks with custom attributes', () => {
    const result = compiler('```js data-line="1"\ncode\n```')
    expect(getVNodeType(result)).toBe('pre')
    // Attributes are on code element inside pre, not on pre itself
    const codeElement = isSingleVNode(result)
      ? vnodeChildAt(result, 0)
      : undefined
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
    expect(getVNodeType(result)).toBe('span')
    expect(extractTextContent(result)).toBe('<script>alert("xss")</script>')
  })

  it('should process markdown within HTML blocks', () => {
    const result = compiler('<div>**Bold** text</div>')
    expect(getVNodeType(result)).toBe('div')
    const text = extractTextContent(result)
    expect(text).toBe('Bold text')
  })

  it('should handle HTML blocks with verbatim', () => {
    const result = compiler('<pre>code here</pre>')
    expect(getVNodeType(result)).toBe('pre')
    const text = extractTextContent(result)
    expect(text).toBe('code here')
  })

  it('should handle self-closing HTML tags', () => {
    const result = compiler('<br />')
    expect(getVNodeType(result)).toBe('br')
  })

  it('should filter dangerous self-closing tags by wrapping in span when tagfilter is enabled', () => {
    const result = compiler('<script />', { tagfilter: true })
    expect(getVNodeType(result)).toBe('span')
    const text = extractTextContent(result)
    expect(text).toContain('<script')
  })

  it('should format filtered tag attributes with boolean values', () => {
    const result = compiler('<iframe src="test" allowfullscreen />', {
      tagfilter: true,
    })
    expect(getVNodeType(result)).toBe('span')
    const text = extractTextContent(result)
    expect(text).toContain('allowfullscreen')
    expect(text).toContain('src="test"')
  })

  it('should handle HTML blocks with pre tags using innerHTML', () => {
    const result = compiler('<div><pre>code\nhere</pre>text</div>')
    expect(getVNodeType(result)).toBe('div')
    // The raw body keeps its stray closer, as React's does; a browser ignores it
    expect(getProp(result, 'innerHTML')).toBe(
      '<pre>code\nhere</pre>text</div>\n'
    )
  })

  it('should handle self-closing tag regex match with attributes', () => {
    const result = compiler('<div class="test"></div>')
    expect(getVNodeType(result)).toBe('div')
    expect(getProp(result, 'class')).toBe('test')
  })
})

describe('headings with all levels', () => {
  it('should render h3 headings', () => {
    const result = compiler('### Hello')
    expect(getVNodeType(result)).toBe('h3')
    expect(extractTextContent(result)).toBe('Hello')
  })

  it('should render h4 headings', () => {
    const result = compiler('#### Hello')
    expect(getVNodeType(result)).toBe('h4')
    expect(extractTextContent(result)).toBe('Hello')
  })

  it('should render h5 headings', () => {
    const result = compiler('##### Hello')
    expect(getVNodeType(result)).toBe('h5')
    expect(extractTextContent(result)).toBe('Hello')
  })

  it('should render h6 headings', () => {
    const result = compiler('###### Hello')
    expect(getVNodeType(result)).toBe('h6')
    expect(extractTextContent(result)).toBe('Hello')
  })
})

describe('URL encoding', () => {
  it('should preserve percent-encoded sequences in URLs', () => {
    const result = compiler('[Link](http://example.com/path%20with%20spaces)')
    const href = getProp(result, 'href')
    expect(href).toBe('http://example.com/path%20with%20spaces')
  })
})

describe('options.wrapper', () => {
  it('should use custom wrapper element', () => {
    const result = compiler('# Hello\n\n## World', { wrapper: 'article' })
    expect(getVNodeType(result)).toBe('article')
    const text = extractTextContent(result)
    expect(text).toBe('HelloWorld')
  })

  it('should return unwrapped result when wrapper is null', () => {
    const result = compiler('# Hello', { wrapper: null })
    expect(getVNodeType(result)).toBe('h1')
    expect(extractTextContent(result)).toBe('Hello')
  })
})

describe('options.forceWrapper', () => {
  it('should force wrapper even with single child', () => {
    const result = compiler('Hello', { wrapper: 'div', forceWrapper: true })
    expect(getVNodeType(result)).toBe('div')
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
    expect(getVNodeType(result)).toBe('h1')
    const text = extractTextContent(result)
    expect(text).toBe('Custom Heading')
    expect(getProp(result, 'class')).toBe('custom')
  })
})

describe('options.overrides with props', () => {
  it('should apply props from overrides', () => {
    const result = compiler('# Hello', {
      overrides: {
        h1: { props: { class: 'custom-class', id: 'custom-id' } },
      },
    })
    expect(getProp(result, 'class')).toBe('custom-class')
    expect(getProp(result, 'id')).toBe('custom-id')
  })

  it('#248 should apply mixed-case mid-string HTML tag overrides', () => {
    const CustomDiv = (props: any) =>
      h('section', { ...props, class: 'custom-mixed' })
    const result = compiler('<dIV>hello</dIV>', {
      overrides: { div: CustomDiv },
    })
    if (!isSingleVNode(result)) {
      throw new Error('Expected single VNode')
    }
    expect(result.type).toBe(CustomDiv)
    expect(extractTextContent(result)).toBe('hello')
  })
})

describe('nested lists', () => {
  it('should handle nested unordered lists', () => {
    const result = compiler('- Item 1\n  - Nested 1\n  - Nested 2')
    expect(getVNodeType(result)).toBe('ul')
    const text = extractTextContent(result)
    expect(text).toBe('Item 1Nested 1Nested 2')
    if (!isSingleVNode(result)) {
      throw new Error('Expected single VNode')
    }
    const vnode = result
    expect(Array.isArray(vnode.children)).toBe(true)
    const firstLi = vnodeChildAt(vnode, 0)
    expect(getVNodeType(firstLi)).toBe('li')
    expect(firstLi && Array.isArray(firstLi.children)).toBe(true)
    const nestedUl = firstLi ? findByTag(firstLi, 'ul') : undefined
    expect(nestedUl).toBeDefined()
  })

  it('should handle nested ordered lists', () => {
    const result = compiler('1. Item 1\n   1. Nested 1\n   2. Nested 2')
    expect(getVNodeType(result)).toBe('ol')
    const text = extractTextContent(result)
    expect(text).toBe('Item 1Nested 1Nested 2')
    if (!isSingleVNode(result)) {
      throw new Error('Expected single VNode')
    }
    const vnode = result
    expect(Array.isArray(vnode.children)).toBe(true)
    const firstLi = vnodeChildAt(vnode, 0)
    expect(getVNodeType(firstLi)).toBe('li')
    const nestedOl = firstLi ? findByTag(firstLi, 'ol') : undefined
    expect(nestedOl).toBeDefined()
  })
})

describe('tables with alignment', () => {
  it('should handle table alignment', () => {
    const result = compiler(
      '| Left | Center | Right |\n|:-----|:------:|------:|\n| L    |   C    |     R |'
    )
    expect(getVNodeType(result)).toBe('table')
    const text = extractTextContent(result)
    expect(text).toBe('LeftCenterRightLCR')
    if (!isSingleVNode(result)) {
      throw new Error('Expected single VNode')
    }
    const vnode = result
    const thead = vnodeChildAt(vnode, 0)
    const tbody = vnodeChildAt(vnode, 1)
    expect(getVNodeType(thead)).toBe('thead')
    expect(getVNodeType(tbody)).toBe('tbody')
    expect(tbody && Array.isArray(tbody.children)).toBe(true)
  })
})

describe('links without target', () => {
  it('should handle links with null target', () => {
    const result = compiler('[Link]()')
    expect(getVNodeType(result)).toBe('a')
    const text = extractTextContent(result)
    expect(text).toBe('Link')
    expect(getProp(result, 'href')).toBe('')
  })
})

describe('images with various attributes', () => {
  it('should handle images with empty alt', () => {
    const result = compiler('![](image.png)')
    expect(getVNodeType(result)).toBe('img')
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
    const href = getProp(result, 'href')
    expect(typeof href).toBe('string')
    expect(href as string).toContain('%')
  })

  it('should encode non-BMP characters in internationalized URLs', () => {
    const result = compiler(
      '[Author post](https://例え.テスト/著者/𠮷田/投稿-🚀)'
    )
    expect(getProp(result, 'href')).toBe(
      'https://%E4%BE%8B%E3%81%88.%E3%83%86%E3%82%B9%E3%83%88/%E8%91%97%E8%80%85/%F0%A0%AE%B7%E7%94%B0/%E6%8A%95%E7%A8%BF-%F0%9F%9A%80'
    )
  })

  it('should handle URLs with existing percent encoding', () => {
    const result = compiler('[Link](http://example.com/path%5Cfile)')
    const href = getProp(result, 'href')
    expect(href).toBe('http://example.com/path%5Cfile')
  })

  it('should preserve valid percent-encoded sequences', () => {
    const result = compiler('[Link](http://example.com/path%41%42%43)')
    const href = getProp(result, 'href')
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
    expect(getProp(result1, 'innerHTML')).toBe('<pre>code</pre></div>\n')
    const result2 = compiler('<div><pre>code</pre></div>', { tagfilter: true })
    expect(getVNodeType(result2 as VNode)).toBe('div')
    expect(getProp(result2, 'innerHTML')).toBe('<pre>code</pre></div>\n')
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
    expect(getVNodeType(result)).toBe('div')
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
    const dataHtmlProp = getProp(result, 'data-html')
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
    const dataHtmlProp = getProp(result, 'data-html')
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
    expect(getProp(result, 'class')).toBe('override-class')
  })

  it('should handle innerHTML prop when not overridden', () => {
    // Test the branch where innerHTML exists in vueProps but not in overrideProps
    const result = compiler('<div>content</div>')
    expect(getVNodeType(result)).toBe('div')
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
    const innerHtml = getProp(result, 'innerHTML')
    expect(innerHtml).toBe('override')
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
      renderRule: (next, node, _renderChildren) => {
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
    expect(getVNodeType(result)).toBe('article')
  })
})

describe('error handling', () => {
  it('should throw error for invalid overrides type', () => {
    expect(() => {
      // @ts-expect-error -- negative-behavior test: invalid overrides option must throw
      compiler('# Hello', { overrides: 'invalid' })
    }).toThrow('options.overrides')
  })

  it('should throw error for invalid overrides array', () => {
    expect(() => {
      // @ts-expect-error -- negative-behavior test: invalid overrides option must throw
      compiler('# Hello', { overrides: [] })
    }).toThrow('options.overrides')
  })
})

describe('renderer edge cases', () => {
  it('should handle array output from renderRule', () => {
    const result = compiler('# Hello', {
      renderRule: (next, node, _renderChildren, state) => {
        if (node.type === RuleType.heading) {
          // Return single VNode instead of array - arrays are handled internally
          return h('h1', { key: state.key }, 'First')
        }
        return next()
      },
    })
    expect(getVNodeType(result)).toBe('h1')
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
      renderRule: (next, node, _renderChildren, state) => {
        if (
          node.type === RuleType.heading &&
          (node as MarkdownToJSX.HeadingNode).level === 1
        ) {
          return h('h1', { key: state.key }, 'First')
        }
        return next()
      },
    })
    expect(getVNodeType(result)).toBe('div')
    const text = extractTextContent(result)
    expect(text).toBe('FirstWorld')
  })
})

describe('MarkdownProvider (provide/inject)', () => {
  it('should export MarkdownProvider', () => {
    const { MarkdownProvider } = require('./vue.tsx')
    expect(typeof MarkdownProvider).toBe('function')
  })

  it('should export MarkdownOptionsKey', () => {
    const { MarkdownOptionsKey } = require('./vue.tsx')
    expect(MarkdownOptionsKey).toBeDefined()
    expect(typeof MarkdownOptionsKey).toBe('symbol')
  })

  it('should support provide/inject pattern (integration test)', () => {
    // Note: Full provide/inject testing requires Vue runtime
    // This test verifies the exports exist and have correct types
    const { MarkdownProvider, MarkdownOptionsKey } = require('./vue.tsx')
    expect(MarkdownProvider).toBeDefined()
    expect(MarkdownOptionsKey).toBeDefined()
  })
})

describe('regression #881 - trailing text after a nested HTML element', () => {
  it('text line after a nested block element is preserved', () => {
    expect(
      serialize(compiler('<details>\n<summary>a</summary>\nx\n</details>'))
    ).toMatchInlineSnapshot(`"<details><summary>a</summary> x </details>"`)
  })

  it('text line after a nested paragraph is preserved', () => {
    expect(
      serialize(compiler('<div>\n<p>a</p>\nx\n</div>'))
    ).toMatchInlineSnapshot(`"<div><p>a</p> x </div>"`)
  })

  it('markdown in the trailing text line is processed', () => {
    expect(
      serialize(
        compiler('<details>\n<summary>a</summary>\n**bold** text\n</details>')
      )
    ).toMatchInlineSnapshot(
      `"<details><summary>a</summary><strong>bold</strong> text </details>"`
    )
  })

  it('text line between nested paragraphs is preserved', () => {
    expect(
      serialize(compiler('<div>\n<p>a</p>\nx\n<p>b</p>\n</div>'))
    ).toMatchInlineSnapshot(`"<div><p>a</p> x <p>b</p></div>"`)
  })

  it('text after the element own closing tag renders as a sibling', () => {
    // tail is a sibling of the span's div, wrapped in Vue's multi-root container
    expect(
      serialize(compiler('<div>\n<span>a</span>\n</div>\ntail'))
    ).toMatchInlineSnapshot(`"<div><div><span>a</span></div> tail</div>"`)
  })

  it('never injects dangerous raw HTML attributes', () => {
    // Vue injects verbatim blocks via innerHTML with no framework backstop,
    // so the parser-level stripping is the only defense.
    const dump = (s: string) => JSON.stringify(compiler(s))
    expect(dump('<div><img onerror=alert(1)></div>')).not.toContain('onerror')
    expect(dump('<pre onclick=alert(1)>code</pre>')).not.toContain('onclick')
    const urls = dump(
      '<div onclick="alert(1)"><a href="javascript:x">y</a></div>'
    )
    expect(urls).not.toContain('onclick')
    expect(urls).not.toContain('javascript:')
  })
})

describe('unique heading IDs (#857)', () => {
  function collectIds(vnode: VNode | VNode[] | null): string[] {
    const ids: string[] = []
    const walk = (node: VNode | VNode[] | null | undefined) => {
      if (node == null) {
        return
      }
      if (Array.isArray(node)) {
        for (const child of node) {
          walk(child)
        }
        return
      }
      const id = getProp(node, 'id')
      if (typeof id === 'string') {
        ids.push(id)
      }
      const kids = node.children
      if (Array.isArray(kids)) {
        for (const child of kids) {
          if (isVNode(child)) {
            walk(child)
          }
        }
      } else if (kids && typeof kids === 'object') {
        // RawSlots is not a VNode; cast through unknown for slot-object walks in tests.
        walk(kids as unknown as VNode)
      }
    }
    walk(vnode)
    return ids
  }

  it('suffixes duplicate heading ids in rendered output', () => {
    expect(
      collectIds(
        compiler(`# Foo

# Bar

## Foo`)
      )
    ).toEqual(['foo', 'bar', 'foo-1'])
  })

  it('slugs headings from inline text content, not raw source', () => {
    expect(collectIds(compiler('## [text](https://e.com)'))).toEqual(['text'])
  })
})

describe('destination entity decode before sanitize', () => {
  function firstAttr(vnode: VNode | VNode[] | null, prop: string): unknown {
    if (vnode === null) {
      return
    }
    if (Array.isArray(vnode)) {
      for (const child of vnode) {
        const found = firstAttr(child, prop)
        if (found !== undefined) {
          return found
        }
      }
      return
    }
    const value = getProp(vnode, prop)
    if (value !== undefined) {
      return value
    }
    const kids = vnode.children
    if (Array.isArray(kids)) {
      for (const child of kids) {
        if (isVNode(child)) {
          const found = firstAttr(child, prop)
          if (found !== undefined) {
            return found
          }
        }
      }
    } else if (kids && typeof kids === 'object') {
      // RawSlots is not a VNode; cast through unknown for slot-object walks in tests.
      return firstAttr(kids as unknown as VNode, prop)
    }
  }

  it('drops entity-obfuscated javascript: href and src', () => {
    expect(firstAttr(compiler('[x](&#106;avascript:alert(1))'), 'href')).toBe(
      undefined
    )
    expect(firstAttr(compiler('![x](&#106;avascript:alert(1))'), 'src')).toBe(
      undefined
    )
  })

  it('re-sanitizes direct astToJSX link targets before href encoding', () => {
    expect(
      firstAttr(
        astToJSX([
          {
            type: RuleType.link,
            target: 'javascript:alert(1)',
            children: [{ type: RuleType.text, text: 'x' }],
          },
        ]),
        'href'
      )
    ).toBeUndefined()
  })
})

describe('inline Type 1 content with tagfilter off', () => {
  it('preserves single-line script content including forceInline', () => {
    expect(
      serialize(compiler('<script>x</script>', { tagfilter: false }))
    ).toBe('<script>x</script>')
    expect(
      serialize(
        compiler('<script>x</script>', { tagfilter: false, forceInline: true })
      )
    ).toBe('<script>x</script>')
  })
})

describe('component-like HTML blank-line nesting (#870)', () => {
  it('keeps blank-line content inside a PascalCase component', () => {
    expect(
      serialize(
        compiler(`<MyComponent>
## My header

Some paragraph
</MyComponent>`)
      )
    ).toMatchInlineSnapshot(
      `"<MyComponent><h2>My header</h2><p>Some paragraph</p></MyComponent>"`
    )
  })
})

describe('tagfilter escapes dangerous tags by default', () => {
  // Regression: the render-time tag filter defaulted OFF in vue (raw options
  // flowed to the renderer; only parse options were coerced), so default output
  // mounted live dangerous tags despite the documented default-on protection.
  // Both compiler() and astToJSX must escape.
  it('escapes script with default options via compiler()', () => {
    expect(serialize(compiler('<script>alert(1)</script>'))).toBe(
      '<span><script>alert(1)</script></span>'
    )
  })

  it('escapes iframe with default options via compiler()', () => {
    expect(serialize(compiler('<iframe src="evil.com"></iframe>'))).toBe(
      '<span><iframe src="evil.com"></iframe></span>'
    )
  })

  it('escapes dangerous tags by default via astToJSX()', () => {
    expect(serialize(astToJSX(parser('<script>alert(1)</script>')))).toBe(
      '<span><script>alert(1)</script></span>'
    )
  })

  it('keeps allowed nested tags live inside a filtered parent', () => {
    expect(
      serialize(compiler('<iframe>hi <em>x</em></iframe>', { tagfilter: true }))
    ).toBe('<span><iframe>hi <em>x</em></iframe></span>')
  })

  it('passes dangerous tags through only when tagfilter is explicitly disabled', () => {
    expect(
      serialize(compiler('<script>\nx\n</script>', { tagfilter: false }))
    ).toBe('<script>x</script>')
  })
})

describe('prototype-slot reference labels (#900)', () => {
  it('renders [__proto__] and [constructor] without throwing', () => {
    expect(serialize(compiler('[__proto__]'))).toBe(
      '<span>[<strong>proto</strong>]</span>'
    )
    expect(serialize(compiler('[constructor]'))).toBe('[constructor]')
  })

  it('resolves __proto__ and constructor reference definitions', () => {
    const proto = compiler('[__proto__]: /x\n\n[__proto__]')
    expect(serialize(proto)).toBe('<p><a><strong>proto</strong></a></p>')
    expect(getVNodeType(proto)).toBe('p')
    if (!isSingleVNode(proto)) {
      throw new Error('Expected single VNode')
    }
    const protoLink = findByTag(proto, 'a')
    expect(protoLink).toBeDefined()
    expect(getProp(protoLink, 'href')).toBe('/x')

    const ctor = compiler('[constructor]: /y\n\n[constructor]')
    expect(serialize(ctor)).toBe('<p><a>constructor</a></p>')
    if (!isSingleVNode(ctor)) {
      throw new Error('Expected single VNode')
    }
    const ctorLink = findByTag(ctor, 'a')
    expect(ctorLink).toBeDefined()
    expect(getProp(ctorLink, 'href')).toBe('/y')
  })
})

describe('optimizeForStreaming keeps literal delimiters', () => {
  it('removes only unclosed emphasis openers', () => {
    // Literal `_` and `*` in finished text survive; only the genuinely
    // unclosed opener on the last line is held back (issue #905)
    expect(
      serialize(
        compiler(
          'pass *args and **kwargs\n\ncustomer_id and `customer_id`\n\nSELECT * FROM t WHERE 2*3=6\n\nhttps://example.com/a_b and <https://example.com/c_d>\n\n**held',
          { optimizeForStreaming: true }
        )
      )
    ).toMatchInlineSnapshot(
      `"<div><p>pass *args and **kwargs</p><p>customer_id and <code>customer_id</code></p><p>SELECT * FROM t WHERE 2*3=6</p><p><a>https://example.com/a_b</a> and <a>https://example.com/c_d</a></p><p>held</p></div>"`
    )
  })

  it('hides a never-closed opener until the final render (issue #909)', () => {
    // The parser cannot tell a streaming edge from finished text, so an
    // opener with no closer stays hidden while the option is on; the
    // documented final render with the option off shows it as written
    const md = 'Use _trace and *args'
    expect(
      serialize(compiler(md, { optimizeForStreaming: true }))
    ).toMatchInlineSnapshot(`"Use trace and args"`)
    expect(
      serialize(compiler(md, { optimizeForStreaming: false }))
    ).toMatchInlineSnapshot(`"Use _trace and *args"`)
  })

  it('keeps complete HTML and earlier blocks unchanged', () => {
    // Complete raw HTML, and incomplete-looking links and code in a block
    // that is no longer the last one, render exactly as without the option
    const md = 'a <span>z</span> <br> b\n\nsee [a](b and `code\n\nlast'
    const streamed = serialize(compiler(md, { optimizeForStreaming: true }))
    expect(streamed).toBe(serialize(compiler(md)))
    expect(streamed).toMatchInlineSnapshot(
      `"<div><p>a <span>z</span> <br></br> b</p><p>see [a](b and \`code</p><p>last</p></div>"`
    )
  })
})

describe('optimizeForStreaming preserves literal less-than', () => {
  it('keeps comparison prose and defers incomplete tag prefixes', () => {
    // Single-line input auto-inlines, so serialize sees a bare text node.
    expect(
      serialize(compiler('5 < 3 is false', { optimizeForStreaming: true }))
    ).toBe('5 < 3 is false')
    expect(
      serialize(compiler('Hello <Citation', { optimizeForStreaming: true }))
    ).toBe('Hello ')
    expect(
      serialize(
        compiler('x < y\n\nsecond para', { optimizeForStreaming: true })
      )
    ).toBe('<div><p>x < y</p><p>second para</p></div>')
  })
})

describe('inline HTML keeps the spaces at the edges of its content (#904)', () => {
  it.each([
    ['a<span> b </span>c', '<p>a<span> b </span>c</p>'],
    ['<b>bold </b>next', '<p><b>bold </b>next</p>'],
    ['<span> </span>', '<p><span> </span></p>'],
    ['<span> x </span>', '<p><span> x </span></p>'],
    ['a<span> <em>x</em> </span>b', '<p>a<span> <em>x</em> </span>b</p>'],
  ])('renders %j as written', (input, expected) => {
    expect(serialize(compiler(input, { forceBlock: true }))).toBe(expected)
    expect(
      serialize(
        compiler(input, { forceBlock: true, optimizeForStreaming: true })
      )
    ).toBe(expected)
  })
})

describe('enforceAtxHeadings (#903)', () => {
  it.each([
    [undefined, '#heading', '<p>#heading</p>'],
    [true, '#heading', '<p>#heading</p>'],
    [false, '#heading', '<h1>heading</h1>'],
    [undefined, '# heading', '<h1>heading</h1>'],
    [true, '# heading', '<h1>heading</h1>'],
    [false, '# heading', '<h1>heading</h1>'],
    [undefined, 'foo\n#bar', '<p>foo\n#bar</p>'],
    [true, 'foo\n#bar', '<p>foo\n#bar</p>'],
    [false, 'foo\n#bar', '<div><p>foo</p><h1>bar</h1></div>'],
    [false, '#######x', '<p>#######x</p>'],
    [undefined, 'a<span>#</span>b', '<span>a<span>#</span>b</span>'],
    [false, 'a<span>#</span>b', '<span>a<span>#</span>b</span>'],
    [undefined, '<div>\n#x\n</div>', '<div>#x</div>'],
    [false, '<div>\n#x\n</div>', '<div><h1>x</h1></div>'],
  ])('with enforceAtxHeadings %j renders %j as %j', (enforceAtxHeadings, input, expected) => {
    expect(serialize(compiler(input, { enforceAtxHeadings }))).toBe(expected)
  })
})

/** The type of every `on*` prop in a VNode tree, serialize showing no props. */
function handlerProps(el: unknown): string[] {
  if (Array.isArray(el)) {
    return el.flatMap(handlerProps)
  }
  if (el === null || typeof el !== 'object') {
    return []
  }
  const vnode = el as VNode
  const props = (vnode.props as Record<string, unknown>) || {}
  let kids: unknown = vnode.children
  if (
    kids &&
    typeof kids === 'object' &&
    !Array.isArray(kids) &&
    typeof (kids as Record<string, unknown>).default === 'function'
  ) {
    kids = (kids as { default: () => unknown }).default()
  }
  return [
    ...Object.keys(props)
      .filter(name => name.toLowerCase().startsWith('on'))
      .map(name => `${name}=${typeof props[name]}`),
    ...handlerProps(kids),
  ]
}

/** Every prop name in a VNode tree but key and the compiler's own innerHTML. */
function propNames(el: unknown): string[] {
  if (Array.isArray(el)) {
    return el.flatMap(propNames)
  }
  if (el === null || typeof el !== 'object') {
    return []
  }
  const vnode = el as VNode
  return [
    ...Object.keys(vnode.props ?? {}).filter(
      name => name !== 'key' && name !== 'innerHTML'
    ),
    ...propNames(vnode.children),
  ]
}

describe('attribute names a renderer acts on rather than writes', () => {
  it('removes an object children value from a registered tag', () => {
    const result = compiler('<Foo children={{"a":1}}>y</Foo>', {
      overrides: { Foo: { props: {} } },
    })

    expect(serialize(result)).toBe('<Foo>y</Foo>')
    expect(propNames(result)).toEqual([])
  })

  it.each([
    ['<div innerHTML="x<img src=x onerror=alert(1)>">y</div>', '<div>y</div>'],
    [
      '<div prop:innerHTML="x<img src=x onerror=alert(1)>">y</div>',
      '<div>y</div>',
    ],
    ['<div attr:onclick="alert(1)">y</div>', '<div>y</div>'],
    ['<a attr:href="javascript:alert(1)">y</a>', '<a>y</a>'],
    ['<a prop:href="javascript:alert(1)">y</a>', '<a>y</a>'],
    [
      '<svg><a xlinkHref="javascript:alert(1)"><text>y</text></a></svg>',
      '<svg><a><text>y</text></a></svg>',
    ],
    ['<div ref="x">y</div>', '<div>y</div>'],
    ['<div ref={{"current":1}}>y</div>', '<div>y</div>'],
    [
      '<div dangerouslySetInnerHTML={{"__html":"<img src=x onerror=alert(1)>"}}></div>',
      '<div></div>',
    ],
    // A VNode in innerHTML would reach the page as [object Object]
    ['<pre><b>x</b></pre>', '<pre><b>x</b></pre>'],
    // The raw body keeps its stray closer, which a browser ignores
    ['<div><pre>a</pre></div>', '<div><pre>a</pre></div>\n</div>'],
  ])('renders %j with no prop, as %j', (input, expected) => {
    const result = compiler(input)
    expect(serialize(result)).toBe(expected)
    expect(propNames(result)).toEqual([])
  })

  it.each([
    [
      '<svg><a><set attributeName="href" to="javascript:alert(1)"/><rect/></a></svg>',
      '<svg><a><set></set><rect></rect></a></svg>',
      ['to'],
    ],
    [
      '<svg><a><animate attributeName="&#104;ref" values="javascript:alert(1)"/></a></svg>',
      '<svg><a><animate></animate></a></svg>',
      ['values'],
    ],
    [
      'x <svg><a><set attributename="xlink:href" to="javascript:alert(1)"/></a></svg>',
      '<span>x <svg><a><set></set></a></svg></span>',
      ['to'],
    ],
    [
      '<svg><a><set attributeName={href} to="javascript:alert(1)"/></a></svg>',
      '<svg><a><set></set></a></svg>',
      ['to'],
    ],
    [
      '<svg><g><animate attributeName="opacity" values="0;1"/></g></svg>',
      '<svg><g><animate></animate></g></svg>',
      ['attributeName', 'values'],
    ],
    ['<Btn action={javascript:alert(1)}>x</Btn>', '<Btn>x</Btn>', []],
    ['<Btn href={link}>x</Btn>', '<Btn>x</Btn>', ['href']],
    // A filtered tag is a text node, which the serializer writes as is
    [
      '<!-- c --> <script>alert(1)</script>',
      '<span> <span><script>alert(1)</script></span></span>',
      [],
    ],
    // A filtered tag in a list item is text too
    [
      '- a <!-- c --> <script>alert(1)</script>',
      '<ul><li>a  <span><script>alert(1)</script></span></li></ul>',
      [],
    ],
    ['<!-- <script> -->', '', []],
    // A block left open before raw markup: an element tree has no browser reading to confuse
    ['<p><? a\n\n<!-- x><script>alert(1)</script>', '<p></p>', []],
    [
      '<p><? a\n\n<div title="x><script>alert(1)</script>">body</div>',
      '<div><p></p><div>body</div></div>',
      ['title'],
    ],
    [
      '<p><!-- a\n\nb <br title="--><script>alert(1)</script>"> c',
      '<div><p></p><p>b <br></br> c</p></div>',
      ['title'],
    ],
    // A prop value is written whole, so no tag starts inside it
    ['<div x={a><script>alert(1)</script>}>y</div>', '<div>y</div>', ['x']],
  ])('renders %j as %j, with props %j', (input, expected, props) => {
    const result = compiler(input)
    expect(serialize(result)).toBe(expected)
    expect(propNames(result)).toEqual(props)
  })

  it('renders a void element given a children attribute', () => {
    const result = compiler('<img children="z" src="/x">')
    expect(serialize(result)).toBe('<img></img>')
    expect(propNames(result)).toEqual(['src'])
  })

  it('renders image alt text holding a quote as one image', () => {
    const result = compiler('![" onclick=alert(1)>](/x)')
    expect(serialize(result)).toBe('<img></img>')
    expect(propNames(result)).toEqual(['alt', 'title', 'src'])
  })
})

describe('a children attribute on a lowercase tag with an override', () => {
  it('reaches the override', () => {
    const result = compiler('<card children="z" />', {
      overrides: { card: { component: 'i' } },
    })

    // A Vue vnode takes children as a prop, which a component override reads
    expect(getProp(result, 'children')).toBe('z')
  })

  it.each([
    ['<card children="z" />', Object.create({ card: { component: 'i' } })],
    ['<CARD children="z" />', { card: { component: 'i' } }],
  ])('reaches the override for %j, inherited or keyed in lowercase, as the renderer finds it', (input, overrides) => {
    expect(getProp(compiler(input, { overrides }), 'children')).toBe('z')
  })

  it('does not take a built-in object property for an override', () => {
    expect(
      getProp(
        compiler('<constructor children="z" />', { overrides: {} }),
        'children'
      )
    ).toBe(undefined)
  })

  it.each([
    [
      '<img children="z" src="/x">',
      { img: { props: { title: 't' } } },
      '<img></img>',
    ],
    ['<card children="z" />', { card: { component: 'img' } }, '<img></img>'],
  ])('does not throw on %j with void override %j', (input, overrides, expected) => {
    expect(serialize(compiler(input, { overrides }))).toBe(expected)
  })
})

describe('a URL that names a dangerous scheme', () => {
  const firstHref = (el: unknown): unknown => {
    if (Array.isArray(el)) {
      return el.map(firstHref).find(href => href !== undefined)
    }
    if (el === null || typeof el !== 'object') {
      return
    }
    const { children, props } = el as {
      children?: unknown
      props?: Record<string, unknown> | null
    }
    return props && 'href' in props ? props.href : firstHref(children)
  }

  it.each([
    [
      '[a](https://en.wikipedia.org/wiki/Javascript:_The_Good_Parts)',
      'https://en.wikipedia.org/wiki/Javascript:_The_Good_Parts',
    ],
    [
      '<https://example.com/?q=javascript:x>',
      'https://example.com/?q=javascript:x',
    ],
    ['<a href="/docs/javascript:intro">x</a>', '/docs/javascript:intro'],
    ['[l](/[x](javascript:alert(1)))', '/%5Bx%5D(javascript:alert(1))'],
    ['[a](javascript:alert(1))', undefined],
    ['[a](feed:javascript:alert(1))', undefined],
  ])('gives %j the href %j, by where a browser reads a scheme', (input, expected) => {
    expect(firstHref(compiler(input))).toBe(expected)
  })
})

describe('markup a browser reads differently from the parser', () => {
  it('keeps the line breaks of a renderRule result for a raw element in a list item', () => {
    expect(
      serialize(
        compiler('- <b>x</b>', {
          renderRule: (next, node) =>
            node.type === RuleType.htmlBlock ? 'alpha\nbeta' : next(),
        })
      )
    ).toBe('<ul><li>alpha\nbeta</li></ul>')
  })

  it.each([
    ['<!--><svg onload=alert(1)>', '<svg></svg>'],
    ['<?"><b onclick=alert(1)>b</b>', '<span><?"><b>b</b></span>'],
    [
      '<div>\n<!-- x\n\n<a title="--><img src=x onerror=alert(1)>">',
      '<div><div></div><a></a></div>',
    ],
    [
      '<!---><noscript><a title="</noscript><img src=x onerror=alert(1)>">',
      '<span><noscript><a title="</noscript><img></img>"></span>',
    ],
    [
      '<!-- x\n\n<a title="--><b y=\'">\n\n\' onclick=alert(1)>',
      "<p>' onclick=alert(1)></p>",
    ],
    ['<a x="<b" y=z>', '<a></a>'],
    ["<div onclick='alert(1)'--!>", "<div onclick='alert(1)'--!>"],
    ['<div onclick={alert(1)}<xmp>', '<div onclick={alert(1)}<xmp>'],
    ['<div x={a><img src=x onerror=alert(1)>}>\nhi\n</div>', '<div>hi</div>'],
    [
      'p <span x={a><img src=x onerror=alert(1)>}>hi</span>',
      '<span>p <span>hi</span></span>',
    ],
    [
      '<pre><Img onclick={alert(1)}',
      '<pre><pre>&lt;Img onclick={alert(1)}</pre>',
    ],
    ['<div>\n<b onclick=alert(1)', '<div><b onclick=alert(1)</div>'],
    ['```x onmouseover="alert(1)"\ny\n```', '<pre><code>y</code></pre>'],
    [
      '<iframe><img src=x onerror=alert(1)',
      '<span><span><iframe></span><img src=x onerror=alert(1)</span>',
    ],
    ['\\<svg onload=alert(1)>', '<svg onload=alert(1)>'],
    ['&lt;img src=x onerror=alert(1)&gt;', '<img src=x onerror=alert(1)>'],
    [
      'a[^1]\n\n[^1]: javascript:alert(1)',
      '<div><p>a<a><sup>1</sup></a></p><footer><div>1: javascript:alert(1)</div></footer></div>',
    ],
    [
      'a[^1]\n\n[^1]: hi [x](javascript:alert(1))',
      '<div><p>a<a><sup>1</sup></a></p><footer><div>1: hi <a>x</a></div></footer></div>',
    ],
    ['![a](&amp;#106;avascript:alert(1))', '<img></img>'],
    ['[x](javascript:alert(1) "t")', '<a>x</a>'],
    [
      '<!-- x -->İİİİİİİİİİ</pre><pre>',
      '<span>İİİİİİİİİİ<pre></pre><pre></pre></span>',
    ],
    ['<span>[l](javascript:alert(1))</span>', '<span><a>l</a></span>'],
    [
      'x <javascript:alert(1)> y',
      '<span>x <a>javascript:alert(1)</a> y</span>',
    ],
    // The markdown output ends an autolink at an ASCII space or control only, so a
    // Unicode space in one is the same link here
    [
      'x <span><javascript:alert(1)//\xa0></span>',
      '<span>x <span><a>javascript:alert(1)//\xa0</a></span></span>',
    ],
    [
      'x <span><JavaScript:alert&#40;1&#41;\u{2003}x></span>',
      '<span>x <span><a>JavaScript:alert&#40;1&#41;\u{2003}x</a></span></span>',
    ],
    [
      'x <span><a:b\xa0<javascript:alert(1)\u{2028}x></span>',
      '<span>x <span><a:b\xa0<a>javascript:alert(1)\u{2028}x</a></span></span>',
    ],
    [
      'x <span>[y <https:a\xa0](javascript:alert(1))></span>',
      '<span>x <span>[y <a>https:a\xa0](javascript:alert(1))</a></span></span>',
    ],
    [
      'x <span><javascript:a](<javascript:alert(1)>)></span>',
      '<span>x <span><javascript:a](<a>javascript:alert(1)</a>)></span></span>',
    ],
    ['[l](&amp;amp;#106;avascript:alert(1))', '<a>l</a>'],
    ['[l](&#106avascript:alert(1))', '<a>l</a>'],
    ['a\nb\n=', '<h1>a\nb</h1>'],
    [
      '- [^1]: a )\n[^1]:&#106avascript:alert(1)',
      '<div><ul><li><a><sup>1</sup></a>:&#106avascript:alert(1)</li></ul><footer><div>1: a )</div></footer></div>',
    ],
    ['<q> <b>x</b>', '<span><q></q> <b>x</b></span>'],
    ['&amp;copy; a &amp; b', '&copy; a & b'],
    [
      '\n﻿[^1]:javascript:alert(1)\n[^1]',
      '<p>﻿[^1]:javascript:alert(1)\n[^1]</p>',
    ],
    [
      '<title>a\n\n<!--</title>\n\n```\n<b>\n```',
      '<div><span><title><p>a</p></title></span><pre><code><b></code></pre></div>',
    ],
    [
      '1. # [^1]\n[^1]:&#106avascript:alert(1)',
      '<ol><li><h1>[^1]</h1>[^1]:&#106avascript:alert(1)</li></ol>',
    ],
    [
      '1. <!-- c --> x\n[^1]:&#106avascript:alert(1)\n\n[^1]',
      '<div><ol><li></li></ol><p><a><sup>1</sup></a></p><footer><div>1: &#106avascript:alert(1)</div></footer></div>',
    ],
    ['- <pre>x\ny</pre>', '<ul><li><pre>x\ny</pre></li></ul>'],
    ['- <!-- x\ny -->', '<ul><li></li></ul>'],
    ['- <div\nonclick=alert(1)>x</div>', '<ul><li><div>x</div></li></ul>'],
    ['- <x-y\nonclick=alert(1)>y</x-y>', '<ul><li><x-y>y</x-y></li></ul>'],
    ['- <Foo x="1\n2">y</Foo>', '<ul><li><Foo>y</Foo></li></ul>'],
    ['- ```\ny', '<ul><li><pre><code>y</code></pre></li></ul>'],
    ['1. <x-y>x\ny', '<ol><li><x-y>x y</x-y></li></ol>'],
    ['1. [r]:\n/u "a\nb"\n\n   [r]', '<ol><li><p><a>r</a></p></li></ol>'],
    [
      '- <b>f</b><!-- c --><img\nsrc=x>z onclick=alert(1)',
      '<ul><li><b>f</b><img></img>z onclick=alert(1)</li></ul>',
    ],
    [
      '- # h\na | b\n  --- | ---',
      '<ul><li><h1>h</h1><table><thead><tr><th>a</th><th>b</th></tr></thead></table></li></ul>',
    ],
    [
      '- - [^1]:\nz\n\n  [^1]',
      '<div><ul><li><ul><li></li></ul><p><a><sup>1</sup></a></p></li></ul><footer><div>1: z</div></footer></div>',
    ],
    ['[r]: a\\\nb\n\n[r]', '<div><p>b</p><p><a>r</a></p></div>'],
    ['[r]: a\\ "t"\n\n[r]', '<p><a>r</a></p>'],
    ['[r]: <a\\\nb>', '<p>[r]: <a<br></br>b></p>'],
    ['[x](a\\\\)', '<a>x</a>'],
    [
      '- a | b\n  --- | ---\nc | d',
      '<ul><li><table><thead><tr><th>a</th><th>b</th></tr></thead><tbody><tr><td>c</td><td>d</td></tr></tbody></table></li></ul>',
    ],
    [
      '1. [^1]:\nb\n\n   [^1]',
      '<div><ol><li><p><a><sup>1</sup></a></p></li></ol><footer><div>1: b</div></footer></div>',
    ],
    // A paragraph's lazy line stays out of block parsing, so no heading
    ['- <b>x</b>\ny\n===', '<ul><li><b>x</b>\ny\n===</li></ul>'],
    [
      '<div <b c="d"/>\n<![CDATA[</pre>\n\n```\n<b>\n```',
      '<div><div><div <b c="d"/>\n<![CDATA[</pre>\n</div><pre><code><b></code></pre></div>',
    ],
    [
      '<p><!--\n\n<a e="--><b e=">">\n<div>"onclick=alert(1)>',
      '<div><p></p><p><a></a>"></p><div>"onclick=alert(1)></div></div>',
    ],
    [
      '<textarea>```\n```\n</script>\n    [x](&#106avascript:alert(1))',
      '<div><span><textarea>```\n```\n</script></span><pre><code>[x](&#106avascript:alert(1))</code></pre></div>',
    ],
    [
      '<details>\n<summary>x</summary>\n\n```js\ncode\n```\n\n</details>',
      '<details><summary>x</summary><pre><code>code</code></pre></details>',
    ],
    [
      '<div>\n\n```\n``` \n\n</div>\n\n```\n<img src=x onerror=alert(1)>\n',
      '<div><div><pre><code>``` \n</code></pre></div><pre><code><img src=x onerror=alert(1)>\n</code></pre></div>',
    ],
    [
      '<![CDATA[a]]]>\n\n```\n<img src=x onerror=alert(1)>\n```',
      '<pre><code><img src=x onerror=alert(1)></code></pre>',
    ],
    [
      '- <?p ?> <?q ?>[x](\njavascript:alert(1))',
      '<ul><li>javascript:alert(1))</li></ul>',
    ],
    [
      '<div>\n\n```\n```\t\n\n</div>\n\n```\n<img src=x onerror=alert(1)>\n',
      '<div><div><pre><code></code></pre></div><pre><code><img src=x onerror=alert(1)>\n</code></pre></div>',
    ],
    [
      '<div>\n\n```\n```~\n```\n\n</div>\n\n```\n<img src=x onerror=alert(1)>\n',
      '<div><div><pre><code>```~</code></pre></div><pre><code><img src=x onerror=alert(1)>\n</code></pre></div>',
    ],
    [
      '<details>\n\n```\n```js\n```\n\n</details>',
      '<details><pre><code>```js</code></pre></details>',
    ],
    [
      '<script></textarea></script >\n\n```\n<img src=x onerror=alert(1)>\n```',
      '<div><span><script></textarea></script ></span><pre><code><img src=x onerror=alert(1)></code></pre></div>',
    ],
    ['[^a](javascript:alert(1))', '<a>^a</a>'],
    [
      '[^a](javascript:alert(1))\n\n[^a]: y',
      '<div><p><a><sup>a</sup></a>(javascript:alert(1))</p><footer><div>a: y</div></footer></div>',
    ],
    [
      'y [^a<img src=x onerror=alert(1)>]\n\n[^a<img src=x onerror=alert(1)>]: a',
      '<div><p>y <a><sup>a<img src=x onerror=alert(1)></sup></a></p><footer><div>a<img src=x onerror=alert(1)>: a</div></footer></div>',
    ],
    [
      '[^1]: a [\n[r]: a "](javascript:alert(1))"',
      '<footer><div>1: a [</div></footer>',
    ],
    [
      '[^1]: a b\n[r]: a "[x](javascript:alert(1))"',
      '<footer><div>1: a b</div></footer>',
    ],
    ['[\\[a\\](javascript:alert(1))](/u)', '<a>[a](javascript:alert(1))</a>'],
    [
      '\\\n[^1]:&#106avascript:alert(1)\n[^1]',
      '<p><br></br>[^1]:&#106avascript:alert(1)\n[^1]</p>',
    ],
    [
      'x&#60;~~~~javascript:alert(1)>',
      '<span>x<<del></del>javascript:alert(1)></span>',
    ],
    ["<C><?><a e='?>'> onclick/", "<span><C></C>'> onclick/</span>"],
    ['<![CDATA[<?><a e="?>"\n<!--"onclick>]', ''],
    [
      '<?e><a e="?>">\n<style>"onclick=alert(1)>',
      '<span><style>"onclick=alert(1)></span>',
    ],
    [
      '[x][^1]\n\n[^1]: &amp;#106;avascript:alert(1)',
      '<div><p>[x]<a><sup>1</sup></a></p><footer><div>1: &#106;avascript:alert(1)</div></footer></div>',
    ],
    ['[x][^1]', '[x][^1]'],
    [
      '[^1][^2]\n\n[^1]: see [^3]',
      '<div><p><a><sup>1</sup></a>[^2]</p><footer><div>1: see [^3]</div></footer></div>',
    ],
    [
      '[^1]\n\n[^1]: see [^2]\n\n[^2]: y',
      '<div><p><a><sup>1</sup></a></p><footer><div>1: see <a><sup>2</sup></a></div><div>2: y</div></footer></div>',
    ],
    [
      '<?p ?><!DOCTYPE html>```\n```\n<svg onload=alert(1)>',
      '<pre><code><svg onload=alert(1)>\n</code></pre>',
    ],
    ['[l](/u "--><img src=x onerror=alert(1)>")', '<a>l</a>'],
    ['![a"--><img src=x onerror=alert(1)>](/x)', '<img></img>'],
    [
      '<svg>](<javascript:alert(1)></svg>',
      '<svg>](<a>javascript:alert(1)</a></svg>',
    ],
    [
      '<!DOCTYPE html>](<javascript:alert(1)>',
      '<span>](<a>javascript:alert(1)</a></span>',
    ],
    [
      '| a | b |\n|---|---|\n[l](javascript:alert(1)',
      '<table><thead><tr><th>a</th><th>b</th></tr></thead><tbody><tr><td>[l](javascript:alert(1)</td><td></td></tr></tbody></table>',
    ],
    [
      '| h | i |\n|---|---|\n| a\\\\\\|b | z |',
      '<table><thead><tr><th>h</th><th>i</th></tr></thead><tbody><tr><td>a\\|b</td><td>z</td></tr></tbody></table>',
    ],
    [
      '[^1]: data:text/html,x\n[^1]',
      '<div><p><a><sup>1</sup></a></p><footer><div>1: data:text/html,x</div></footer></div>',
    ],
    [
      '<foreignObject>~~~~```x onmouseover="alert(1)"\n<svg onload=alert(1)>```\n',
      '<p><foreignObject></foreignObject><del></del><code>x onmouseover="alert(1)" <svg onload=alert(1)></code></p>',
    ],
    [
      '[^1]: <iframe srcdoc="x"></iframe>[r][^1]',
      '<span>[^1]: <span><iframe></iframe></span>[r][^1]</span>',
    ],
    [
      '<annotation-xml>[^1]: ](javascript:alert(1)',
      '<span><annotation-xml></annotation-xml>[^1]: ](javascript:alert(1)</span>',
    ],
    ['<pre>a', '<pre><pre>a</pre>'],
    ['<div><pre>a', '<div><pre>a\n</div>'],
    ["<div </div>'", "<div </div>'"],
    ['<?php echo 1 ?>', ''],
    ['<!DOCTYPE html>', ''],
    ['<![CDATA[x]]>', ''],
    // The string outputs' quote re-pairing has no reading here: these are elements and text
    [
      '<![CDATA[<a title="</style><a title="</textarea><a href="javascript:alert(1)">l</a> x" onclick=alert(1)>',
      '<span><![CDATA[<a title="<span></style></span><a title="<span></textarea></span><a>l</a> x" onclick=alert(1)></span>',
    ],
    ['a <?b?> c', '<span>a  c</span>'],
    ['a <!B c> d', '<span>a  d</span>'],
    ['a <![CDATA[b]]> c', '<span>a  c</span>'],
    ['a <!-- b --> c', '<span>a  c</span>'],
    ['[l](java&Tab;script:alert(1))', '<a>l</a>'],
    ['<a href="java\tscript:alert(1)">l</a>', '<a>l</a>'],
    ['<a href="java\nscript:alert(1)">l</a>', '<p><a>l</a></p>'],
    ['<my-widget onclick={alert(1)}>x</my-widget>', '<my-widget>x</my-widget>'],
    ['<my-widget items={x}>y</my-widget>', '<my-widget>y</my-widget>'],
    [
      '<my-widget href={javascript:x}>z</my-widget>',
      '<my-widget>z</my-widget>',
    ],
    [
      '<a title="?><!--[^1]: ![a](javascript:alert(1))\n</div\n-->',
      '<p><a title="?></p>',
    ],
    [
      '1. </div x={a ><img src=x onerror=alert(1)>}>    innerHTML="x<img src=x onerror=alert(1)>"',
      '<span>1. </div x={a ><img></img>}>    innerHTML="x<img></img>"</span>',
    ],
    [
      '- </div x={a ><img src=x onerror=alert(1)>}>    <b onclick=alert(1)>b</b>',
      '<ul><li><div></div><pre><code><b onclick=alert(1)>b</b></code></pre></li></ul>',
    ],
    [
      '<div x={a><a title="</textarea>[^1]: ![a](javascript:alert(1))\nprop:innerHTML="x<img src=x onerror=alert(1)>"](onclick={alert(1)}',
      '<div></div>',
    ],
    [
      '![<!---></span ](javascript:alert(1))>![a"--><img src=x onerror=alert(1)>](/x)',
      '<img></img>',
    ],
    ['![a\\\\\\](javascript:alert(1))b](/x)', '<img></img>'],
  ])('renders %j as %j with no handler prop', (input, expected) => {
    const result = compiler(input)
    expect(serialize(result)).toBe(expected)
    expect(handlerProps(result)).toEqual([])
  })

  it.each([
    [
      `> <div a=1${String.fromCharCode(0x20_28)}>  onclick=alert(1) b>y</div>`,
      '<blockquote><div>onclick=alert(1) b>y</div></blockquote>',
    ],
    ['<pre>a &lt; b &amp; c</pre>', '<pre>a < b & c</pre>'],
    [
      `> <div </div${String.fromCharCode(0x20_28)}>\nonclick='alert(1)'`,
      '<blockquote><div></div></blockquote>',
    ],
    [
      '/\n    <pre>\n```\n<img src=x onerror=alert(1)>\n```',
      '<div><p>/\n<pre></pre></p><pre><code><img src=x onerror=alert(1)></code></pre></div>',
    ],
    [
      '- <div/>`<img src=x onerror=alert(1)>`',
      '<ul><li><div></div><code><img src=x onerror=alert(1)></code></li></ul>',
    ],
    [
      '- z\n  <b/>\n  `<img src=x onerror=alert(1)>`',
      '<ul><li>z\n<b></b>\n<code><img src=x onerror=alert(1)></code></li></ul>',
    ],
    [
      '- <br>\n  `<img src=x onerror=alert(1)>`',
      '<ul><li><br></br><code><img src=x onerror=alert(1)></code></li></ul>',
    ],
    [
      '- a\n  - <div/>\n  `<img src=x onerror=alert(1)>`',
      '<ul><li>a<ul><li><div></div></li></ul><code><img src=x onerror=alert(1)></code></li></ul>',
    ],
    [
      '- a\n\n- z\n  <b/>\n  `<img src=x onerror=alert(1)>`',
      '<ul><li><p>a</p></li><li><p>z\n<b></b>\n<code><img src=x onerror=alert(1)></code></p></li></ul>',
    ],
    [
      '<b>`</b>x`<img src=x onerror=alert(1)>`',
      '<span><b>`</b>x<code><img src=x onerror=alert(1)></code></span>',
    ],
    [
      'z\n    <div>`<img src=x onerror=alert(1)>`',
      '<p>z\n<div></div><code><img src=x onerror=alert(1)></code></p>',
    ],
    ['~~~<a href="javascript:alert(1)">\nq\n~~~', '<pre><code>q</code></pre>'],
    ['`[x](javascript:alert(1))`', '<code>[x](javascript:alert(1))</code>'],
    [
      '- <?a ?>[x]:\n  javascript:alert(1)\n\n<span>[x]</span>',
      '<div><ul><li>javascript:alert(1)</li></ul><p><span>[x]</span></p></div>',
    ],
    [
      'a[^1]\n\n[^1]: 100% of people',
      '<div><p>a<a><sup>1</sup></a></p><footer><div>1: 100% of people</div></footer></div>',
    ],
    ['1. ```\n   foo\n   ```', '<ol><li><pre><code>foo</code></pre></li></ol>'],
    ['a #\n=', '<h1>a #</h1>'],
    ['`<script> https://a.b/c`', '<code><script> https://a.b/c</code>'],
    [
      `> <div </div ${String.fromCharCode(0x20_28)}>\nonclick='alert(1)'`,
      '<blockquote><div></div></blockquote>',
    ],
    [
      '<pre/>\n\n```\n<img src=x onerror=alert(1)>\n```',
      '<div><pre>\n</pre><pre><code><img src=x onerror=alert(1)></code></pre></div>',
    ],
    [
      '<pre/>y\n\n```\n<img src=x onerror=alert(1)>\n```',
      '<div><pre>y\n</pre><pre><code><img src=x onerror=alert(1)></code></pre></div>',
    ],
    [
      '<![CDATA[\n<![CDATA[]]]>\n\n```\n<img src=x onerror=alert(1)>\n```',
      '<pre><code><img src=x onerror=alert(1)></code></pre>',
    ],
  ])('renders %j as %j, a shape only the markdown output screens', (input, expected) => {
    const result = compiler(input)
    expect(serialize(result)).toBe(expected)
    expect(handlerProps(result)).toEqual([])
  })

  it.each([
    [
      '<br>\n\n```\n<img src=x onerror=alert(1)>\n```',
      '<div><pre></pre><pre><code><img src=x onerror=alert(1)></code></pre></div>',
      'br',
      'pre',
    ],
    [
      '<div>\nx\n\n```\n<img src=x onerror=alert(1)>\n```',
      '<div><pre>x</pre><pre><code><img src=x onerror=alert(1)></code></pre></div>',
      'div',
      'pre',
    ],
    [
      '<b/>\n\n```\n<img src=x onerror=alert(1)>\n```',
      '<div><script></script><pre><code><img src=x onerror=alert(1)></code></pre></div>',
      'b',
      'script',
    ],
    [
      '<span>y</span>`<img src=x onerror=alert(1)>`',
      '<span><div>y</div><code><img src=x onerror=alert(1)></code></span>',
      'span',
      'div',
    ],
    [
      '<pre/>`<img src=x onerror=alert(1)>`',
      '<script>`<img src=x>`\n</script>',
      'pre',
      'script',
    ],
    [
      '<div>\n<a title="></textarea>\nplain "text"\n<div>"onclick=alert(1)>',
      '<pre><a title="> plain "text" <pre></pre>"onclick=alert(1)></pre>',
      'div',
      'pre',
    ],
    [
      '<pre>\n<a title=">\n\nplain "text"\n\n<div>"onclick=alert(1)>\n</pre>',
      '<div><a title=">\n\nplain "text"\n\n<div>"onclick=alert(1)></div>',
      'pre',
      'div',
    ],
  ])('renders %j as %j when %j is renamed to %j', (input, expected, tag, component) => {
    const result = compiler(input, { overrides: { [tag]: { component } } })
    expect(serialize(result)).toBe(expected)
    expect(handlerProps(result)).toEqual([])
  })

  it('escapes a tag hidden in a quoted value that runs past the read limit', () => {
    const long = 'x'.repeat(1100)
    expect(
      serialize(compiler(`<div>\n<a title="<b ${long}">y</a>\n</div>`))
    ).toBe(`<div><a title="<b ${long}">y</div>`)
  })

  it.each([
    ['<Img onclick={alert(1)} />', undefined, '<Img></Img>', []],
    ['<Img attr:onerror={alert(1)} />', undefined, '<Img></Img>', []],
    ['<Btn onclick={[1]}>x</Btn>', undefined, '<Btn>x</Btn>', []],
    // Vue writes a bare name as a plain attribute or nothing, and neither runs or throws
    ['<Img onerror />', undefined, '<Img></Img>', ['onerror=boolean']],
    [
      '<my-widget online>x</my-widget>',
      undefined,
      '<my-widget>x</my-widget>',
      ['online=boolean'],
    ],
    [
      '<constructor>hi</constructor>',
      { overrides: {} },
      '<constructor>hi</constructor>',
      [],
    ],
    [
      '<Constructor>hi</Constructor>',
      { overrides: {} },
      '<Constructor>hi</Constructor>',
      [],
    ],
    [
      '<my-widget onclick={alert(1)}>x</my-widget>',
      { overrides: { 'my-widget': { props: {} } } },
      '<my-widget>x</my-widget>',
      ['onclick=string'],
    ],
    [
      '<my-widget onclick={() => 1}>x</my-widget>',
      { evalUnserializableExpressions: true },
      '<my-widget>x</my-widget>',
      ['onclick=function'],
    ],
  ])('with its options keeps %j and %j as %j with props %j', (input, options, expected, handlers) => {
    const result = compiler(input, options)
    expect(serialize(result)).toBe(expected)
    expect(handlerProps(result)).toEqual(handlers)
  })
})
