import { afterEach, expect, it, describe, mock, spyOn } from 'bun:test'
import * as React from 'react'
import { Image, Pressable, Text, View } from 'react-native'
import type { ImageProps, TextProps, ViewProps } from 'react-native'

import Markdown, {
  compiler,
  astToNative,
  parser,
  RuleType,
  sanitizer,
  slugify,
  type MarkdownToJSX,
  type NativeOptions,
  type NativeStyleKey,
} from './native'

/**
 * Structural view of the props these tests read off rendered elements. The
 * native renderer assembles elements with loosely-typed props, so the tests
 * inspect them through this lens; a wrong claim here surfaces as a failing
 * expectation at runtime, not as unsound access.
 */
interface TestProps {
  children?: React.ReactNode
  source?: { uri?: string }
  style?:
    | Record<string, unknown>
    | Array<Record<string, unknown> | false | null | undefined>
  [prop: string]: unknown
}

/** A rendered element whose props are viewed through TestProps. */
type TestElement = React.ReactElement<TestProps>

/** Narrow any rendered value to an element with structurally-readable props. */
function isTestElement(value: unknown): value is TestElement {
  return React.isValidElement(value)
}

/**
 * Runtime shape of a forwardRef component. React's public types hide these
 * internals, so the tests name the shape and prove it with a guard.
 */
interface ForwardRefComponent {
  $$typeof: symbol
  render: (...args: unknown[]) => unknown
}

function isForwardRefComponent(value: unknown): value is ForwardRefComponent {
  if (
    (typeof value !== 'object' && typeof value !== 'function') ||
    value === null
  ) {
    return false
  }
  if (!('$$typeof' in value) || !('render' in value)) return false
  return (
    value.$$typeof === Symbol.for('react.forward_ref') &&
    typeof value.render === 'function'
  )
}

function extractTextContent(element: React.ReactNode): string {
  if (typeof element === 'string') return element
  if (typeof element === 'number') return String(element)
  if (element === null || element === undefined) return ''
  if (!isTestElement(element)) return ''
  const props = element.props
  if (props && props.children !== undefined) {
    if (Array.isArray(props.children)) {
      return props.children.map(extractTextContent).join('')
    }
    return extractTextContent(props.children)
  }
  return ''
}

function getFirstElement(result: React.ReactNode): TestElement {
  if (isTestElement(result)) {
    return result
  }
  if (Array.isArray(result)) {
    for (const item of result) {
      if (isTestElement(item)) {
        return item
      }
    }
    throw new Error('Expected React element in array but found none')
  }
  if (result === null || result === undefined) {
    throw new Error('Expected React element but got null/undefined')
  }
  throw new Error('Expected React element but got: ' + typeof result)
}

function isComponentType(
  element: React.ReactElement,
  component: React.ComponentType<any>
): boolean {
  // Direct comparison works for forwardRef components
  if (element.type === component) return true
  // For forwardRef, also check the render function
  if (
    isForwardRefComponent(element.type) &&
    isForwardRefComponent(component)
  ) {
    return element.type.render === component.render
  }
  return false
}

function findAllByType(
  element: React.ReactNode,
  component: React.ComponentType
): TestElement[] {
  if (Array.isArray(element)) {
    const out: TestElement[] = []
    for (const item of element) {
      out.push(...findAllByType(item, component))
    }
    return out
  }
  if (!isTestElement(element)) return []
  const results: TestElement[] = []
  if (isComponentType(element, component)) results.push(element)
  const props = element.props
  if (props.children) {
    if (Array.isArray(props.children)) {
      for (const child of props.children) {
        results.push(...findAllByType(child, component))
      }
    } else {
      results.push(...findAllByType(props.children, component))
    }
  }
  return results
}

function findChildByType(
  element: React.ReactNode,
  component: React.ComponentType<any>
): TestElement {
  if (!isTestElement(element)) {
    throw new Error('Expected React element to search for child')
  }
  if (isComponentType(element, component)) return element
  const props = element.props
  if (props.children) {
    if (Array.isArray(props.children)) {
      for (const child of props.children) {
        try {
          return findChildByType(child, component)
        } catch {
          // Continue searching
        }
      }
    } else {
      return findChildByType(props.children, component)
    }
  }
  throw new Error(`Child component of type ${component} not found`)
}

function findTextElement(element: React.ReactNode): TestElement {
  if (isTestElement(element) && isComponentType(element, Text)) {
    return element
  }
  if (Array.isArray(element)) {
    for (const item of element) {
      if (isTestElement(item) && isComponentType(item, Text)) {
        return item
      }
    }
  }
  return findChildByType(element, Text)
}

function findAllTextElements(element: React.ReactNode): TestElement[] {
  const results: TestElement[] = []
  if (isTestElement(element) && isComponentType(element, Text)) {
    results.push(element)
  }
  if (Array.isArray(element)) {
    for (const item of element) {
      results.push(...findAllTextElements(item))
    }
  }
  if (isTestElement(element)) {
    results.push(...findAllByType(element, Text))
  }
  return results
}

function findLinkElement(element: React.ReactNode): TestElement {
  // Check if element itself has onPress (for custom components)
  if (isTestElement(element)) {
    const props = element.props
    if (props.onPress) return element
    // Search children
    if (props.children) {
      const children = Array.isArray(props.children)
        ? props.children
        : [props.children]
      for (const child of children) {
        try {
          return findLinkElement(child)
        } catch {
          // Continue searching
        }
      }
    }
  }
  if (Array.isArray(element)) {
    for (const item of element) {
      try {
        return findLinkElement(item)
      } catch {
        // Continue searching
      }
    }
  }
  throw new Error('Link element with onPress not found')
}

/**
 * Flatten a React Native style prop (which may nest arrays) into a single object,
 * later entries winning on conflict, mirroring how RN resolves a style array.
 */
function flattenStyle(
  style: unknown,
  acc: Record<string, unknown> = {}
): Record<string, unknown> {
  if (!style) return acc
  if (Array.isArray(style)) {
    for (const entry of style) flattenStyle(entry, acc)
    return acc
  }
  return Object.assign(acc, style)
}

function getComponentStyle(element: TestElement): Record<string, unknown> {
  const style = element.props.style
  if (!style) {
    throw new Error('Component has no style prop')
  }
  return flattenStyle(style)
}

describe('native.tsx exports', () => {
  it('should export parser', () => {
    expect(typeof parser).toBe('function')
  })

  it('should export RuleType', () => {
    expect(typeof RuleType).toBe('object')
  })

  it('should export sanitizer', () => {
    expect(typeof sanitizer).toBe('function')
  })

  it('should export slugify', () => {
    expect(typeof slugify).toBe('function')
  })

  it('should export compiler', () => {
    expect(typeof compiler).toBe('function')
  })

  it('should export astToNative', () => {
    expect(typeof astToNative).toBe('function')
  })

  it('should export Markdown component', () => {
    expect(typeof Markdown).toBe('function')
  })

  it('should export default Markdown', () => {
    expect(typeof Markdown).toBe('function')
  })

  it('should export NativeOptions type', () => {
    // Type check - if this compiles, the type exists
    const options: NativeOptions = {}
    expect(typeof options).toBe('object')
  })

  it('should export NativeStyleKey type', () => {
    // Type check
    const key: NativeStyleKey = 'text'
    expect(key).toBe('text')
  })
})

describe('compiler', () => {
  it('should handle empty string', () => {
    const result = compiler('')
    expect(result).toBe(null)
  })

  it('should render paragraph as Text component', () => {
    const result = compiler('Hello world')
    const element = getFirstElement(result)
    expect(isComponentType(element, Text)).toBe(true)
    expect(extractTextContent(element)).toBe('Hello world')
  })

  it('should render heading as Text component', () => {
    const result = compiler('# Hello', { forceBlock: true })
    const element = getFirstElement(result)
    const headingElement = findTextElement(element)
    expect(isComponentType(headingElement, Text)).toBe(true)
    expect(extractTextContent(headingElement)).toBe('Hello')
  })

  it('should render multiple paragraphs in wrapper', () => {
    const result = compiler('Hello\n\nWorld')
    const element = getFirstElement(result)
    expect(isComponentType(element, View)).toBe(true)
    const text = extractTextContent(element)
    expect(text).toContain('Hello')
    expect(text).toContain('World')
  })
})

describe('link handling', () => {
  afterEach(() => {
    mock.clearAllMocks()
  })

  it('should render link as Text component with onPress and underline style', () => {
    const result = compiler('[Link](https://example.com)')
    const element = getFirstElement(result)
    const linkElement = findLinkElement(element)
    expect(isComponentType(linkElement, Text)).toBe(true)
    expect(extractTextContent(linkElement)).toBe('Link')
    const props = linkElement.props
    expect(typeof props.onPress).toBe('function')
    const style = getComponentStyle(linkElement)
    expect(style.textDecorationLine).toBe('underline')
  })

  it('should use custom onLinkPress handler when provided', () => {
    const onLinkPress = mock((url: string) => {})
    const result = compiler('[Link](https://example.com)', { onLinkPress })
    const element = getFirstElement(result)
    const linkElement = findLinkElement(element)
    expect(isComponentType(linkElement, Text)).toBe(true)
    expect(extractTextContent(linkElement)).toBe('Link')
    const props = linkElement.props
    expect(typeof props.onPress).toBe('function')
  })

  it('should encode non-BMP characters in URLs', () => {
    const onLinkPress = mock((url: string) => {})
    const result = compiler('[Author post](https://例え.テスト/著者/𠮷田/投稿-🚀)', {
      onLinkPress,
    })
    const linkElement = findLinkElement(getFirstElement(result))

    linkElement.props.onPress()

    expect(onLinkPress).toHaveBeenCalledWith(
      'https://%E4%BE%8B%E3%81%88.%E3%83%86%E3%82%B9%E3%83%88/%E8%91%97%E8%80%85/%F0%A0%AE%B7%E7%94%B0/%E6%8A%95%E7%A8%BF-%F0%9F%9A%80',
      undefined
    )
  })

  it('should handle onLinkLongPress when provided', () => {
    const onLinkLongPress = mock((url: string) => {})
    const result = compiler('[Link](https://example.com)', { onLinkLongPress })
    const element = getFirstElement(result)
    const linkElement = findLinkElement(element)
    expect(isComponentType(linkElement, Text)).toBe(true)
    expect(extractTextContent(linkElement)).toBe('Link')
    const props = linkElement.props
    expect(typeof props.onPress).toBe('function')
    expect(typeof props.onLongPress).toBe('function')
  })
})

describe('style overrides', () => {
  it('should apply custom paragraph style', () => {
    const customStyle = { fontSize: 20, color: 'blue' }
    const result = compiler('Hello', {
      forceBlock: true,
      styles: { paragraph: customStyle },
    })
    const element = getFirstElement(result)
    expect(isComponentType(element, Text)).toBe(true)
    expect(extractTextContent(element)).toBe('Hello')
    const style = getComponentStyle(element)
    expect(style.fontSize).toBe(20)
    expect(style.color).toBe('blue')
  })

  it('should apply custom heading styles', () => {
    const h1Style = { fontSize: 32, fontWeight: 'bold' as const }
    const result = compiler('# Heading', {
      forceBlock: true,
      styles: { heading1: h1Style },
    })
    const element = getFirstElement(result)
    const headingElement = findTextElement(element)
    expect(isComponentType(headingElement, Text)).toBe(true)
    expect(extractTextContent(headingElement)).toBe('Heading')
    const style = getComponentStyle(headingElement)
    expect(style.fontSize).toBe(32)
    expect(style.fontWeight).toBe('bold')
  })

  it('should apply custom link style and merge with default underline', () => {
    const linkStyle = { color: 'blue' }
    const result = compiler('[Link](https://example.com)', {
      styles: { link: linkStyle },
    })
    const element = getFirstElement(result)
    const linkElement = findLinkElement(element)
    expect(extractTextContent(linkElement)).toBe('Link')
    const style = getComponentStyle(linkElement)
    expect(style.textDecorationLine).toBe('underline')
    expect(style.color).toBe('blue')
  })

  it('should apply default underline to links', () => {
    const result = compiler('[Link](https://example.com)')
    const element = getFirstElement(result)
    const linkElement = findLinkElement(element)
    expect(extractTextContent(linkElement)).toBe('Link')
    const style = getComponentStyle(linkElement)
    expect(style.textDecorationLine).toBe('underline')
  })
})

describe('component overrides', () => {
  it('should allow overriding link component', () => {
    const CustomLink = (props: TextProps) =>
      React.createElement(Text, { ...props, testID: 'custom-link' })
    const result = compiler('[Link](https://example.com)', {
      overrides: { a: CustomLink },
    })
    const element = getFirstElement(result)
    const linkElement = findLinkElement(element)
    // Check that our custom component is used
    expect(linkElement.type).toBe(CustomLink)
    // Check that onPress is passed through
    expect(typeof linkElement.props.onPress).toBe('function')
    expect(extractTextContent(linkElement)).toBe('Link')
  })

  it('should allow overriding image component', () => {
    const CustomImage = (props: ImageProps) =>
      React.createElement(Image, { ...props, testID: 'custom-image' })
    const result = compiler('![Alt](image.jpg)', {
      forceBlock: true,
      overrides: { img: CustomImage },
    })
    // An image cannot sit inside a Text, so the paragraph renders as a View with
    // the image as its own child; the override still applies.
    const imageElement = findFirst(result, CustomImage)
    expect(imageElement?.type).toBe(CustomImage)
    expect(imageElement?.props.source?.uri).toBe('image.jpg')
  })

  it('should allow overriding with component and props', () => {
    const CustomText = (props: TextProps) => React.createElement(Text, props)
    const result = compiler('Hello', {
      forceBlock: true,
      overrides: {
        p: { component: CustomText, props: { style: { fontSize: 20 } } },
      },
    })
    const element = getFirstElement(result)
    expect(element.type).toBe(CustomText)
    const style = getComponentStyle(element)
    expect(style.fontSize).toBe(20)
  })
})

function findFirst(
  element: React.ReactNode,
  component: React.ComponentType
): TestElement | undefined {
  return findAllByType(element, component)[0]
}

/** findFirst that throws instead of returning undefined, for direct prop reads. */
function mustFindFirst(
  element: React.ReactNode,
  component: React.ComponentType
): TestElement {
  const found = findFirst(element, component)
  if (!found) throw new Error('Expected component in rendered tree')
  return found
}

/** Return the index-th child of an element, asserting it is itself an element. */
function childElementAt(element: TestElement, index: number): TestElement {
  const children = element.props.children
  const child = Array.isArray(children)
    ? children[index]
    : index === 0
      ? children
      : undefined
  if (!isTestElement(child)) {
    throw new Error('Expected an element child at index ' + index)
  }
  return child
}

describe('parsed-markdown overrides', () => {
  it('fires code override for inline backticks', () => {
    const Code = (props: TextProps) =>
      React.createElement(Text, { ...props, testID: 'code' })
    const result = compiler('Text with `inline` code', {
      overrides: { code: Code },
    })
    expect(extractTextContent(findFirst(result, Code))).toBe('inline')
  })

  it('fires pre override for fenced code blocks', () => {
    const Pre = (props: ViewProps) => React.createElement(View, { ...props, testID: 'pre' })
    const result = compiler('```\nblock\n```', { overrides: { pre: Pre } })
    expect(extractTextContent(findFirst(result, Pre))).toContain('block')
  })

  it('fires code override on inner element of fenced code blocks', () => {
    const Code = (props: TextProps) =>
      React.createElement(Text, { ...props, testID: 'fenced-code' })
    const result = compiler('```\nblock\n```', { overrides: { code: Code } })
    expect(extractTextContent(findFirst(result, Code))).toContain('block')
  })

  it('fires strong override for **bold**', () => {
    const Strong = (props: TextProps) =>
      React.createElement(Text, { ...props, testID: 'strong' })
    const result = compiler('**bold**', { overrides: { strong: Strong } })
    expect(extractTextContent(findFirst(result, Strong))).toBe('bold')
  })

  it('fires em override for *italic*', () => {
    const Em = (props: TextProps) => React.createElement(Text, { ...props, testID: 'em' })
    const result = compiler('*italic*', { overrides: { em: Em } })
    expect(extractTextContent(findFirst(result, Em))).toBe('italic')
  })

  it('fires del override for ~~strikethrough~~', () => {
    const Del = (props: TextProps) => React.createElement(Text, { ...props, testID: 'del' })
    const result = compiler('~~struck~~', { overrides: { del: Del } })
    expect(extractTextContent(findFirst(result, Del))).toBe('struck')
  })

  it('fires blockquote override for > quote', () => {
    const BQ = (props: ViewProps) => React.createElement(View, { ...props, testID: 'bq' })
    const result = compiler('> quote', {
      forceBlock: true,
      overrides: { blockquote: BQ },
    })
    expect(extractTextContent(findFirst(result, BQ))).toContain('quote')
  })

  it('fires hr override for ---', () => {
    const HR = (props: ViewProps) => React.createElement(View, { ...props, testID: 'hr' })
    const result = compiler('---\n', { overrides: { hr: HR } })
    expect(findFirst(result, HR)).toBeDefined()
  })

  it('fires h1-h6 overrides for ATX headings', () => {
    const make = (id: string) => (props: TextProps) =>
      React.createElement(Text, { ...props, testID: id })
    const H1 = make('h1'),
      H2 = make('h2'),
      H3 = make('h3'),
      H4 = make('h4'),
      H5 = make('h5'),
      H6 = make('h6')
    const md = '# A\n\n## B\n\n### C\n\n#### D\n\n##### E\n\n###### F'
    const result = compiler(md, {
      overrides: { h1: H1, h2: H2, h3: H3, h4: H4, h5: H5, h6: H6 },
    })
    expect(extractTextContent(findFirst(result, H1))).toBe('A')
    expect(extractTextContent(findFirst(result, H2))).toBe('B')
    expect(extractTextContent(findFirst(result, H3))).toBe('C')
    expect(extractTextContent(findFirst(result, H4))).toBe('D')
    expect(extractTextContent(findFirst(result, H5))).toBe('E')
    expect(extractTextContent(findFirst(result, H6))).toBe('F')
  })

  it('fires ul override for unordered lists (outer)', () => {
    const UL = (props: ViewProps) => React.createElement(View, { ...props, testID: 'ul' })
    const result = compiler('- one\n- two', { overrides: { ul: UL } })
    const text = extractTextContent(findFirst(result, UL))
    expect(text).toContain('one')
    expect(text).toContain('two')
  })

  it('fires ol override for ordered lists (outer)', () => {
    const OL = (props: ViewProps) => React.createElement(View, { ...props, testID: 'ol' })
    const result = compiler('1. one\n2. two', { overrides: { ol: OL } })
    const text = extractTextContent(findFirst(result, OL))
    expect(text).toContain('one')
    expect(text).toContain('two')
  })

  it('fires li override for each list row', () => {
    const LI = (props: ViewProps) => React.createElement(View, { ...props, testID: 'li' })
    const result = compiler('- one\n- two\n- three', {
      overrides: { li: LI },
    })
    expect(findAllByType(result, LI).length).toBe(3)
  })

  it('fires input override for GFM task checkboxes with checked prop', () => {
    const Checkbox = (props: ViewProps) =>
      React.createElement(View, { ...props, testID: 'checkbox' })
    const result = compiler('- [x] Done\n- [ ] Pending', {
      overrides: { input: Checkbox },
    })
    const checkboxes = findAllByType(result, Checkbox)
    expect(checkboxes.length).toBe(2)
    expect(checkboxes[0].props.checked).toBe(true)
    expect(checkboxes[0].props.type).toBe('checkbox')
    expect(checkboxes[0].props.readOnly).toBe(true)
    expect(checkboxes[1].props.checked).toBe(false)
  })

  it('preserves user styles passed alongside an override', () => {
    const Code = (props: TextProps) => React.createElement(Text, props)
    const result = compiler('Text with `code` inline', {
      overrides: { code: Code },
      styles: { codeInline: { color: 'crimson', fontFamily: 'IBM Plex Mono' } },
    })
    const style = getComponentStyle(mustFindFirst(result, Code))
    expect(style.color).toBe('crimson')
    expect(style.fontFamily).toBe('IBM Plex Mono')
  })

  it('merges textFormatted default style with user style instead of replacing', () => {
    const result = compiler('**bold**', {
      styles: { strong: { color: 'crimson' } },
    })
    const style = getComponentStyle(getFirstElement(result))
    expect(style.fontWeight).toBe('bold')
    expect(style.color).toBe('crimson')
  })

  it('merges override.props.style with renderer-supplied style', () => {
    const Code = (props: TextProps) => React.createElement(Text, props)
    const result = compiler('Text with `code` inline', {
      overrides: { code: { component: Code, props: { style: { color: 'gold' } } } },
      styles: { codeInline: { fontFamily: 'IBM Plex Mono' } },
    })
    const style = getComponentStyle(mustFindFirst(result, Code))
    expect(style.fontFamily).toBe('IBM Plex Mono')
    expect(style.color).toBe('gold')
  })

  it('renders frontmatter as Text-mapped tag when in inline mode', () => {
    // Defensive: an inline-mode renderer wrapped in Text must not nest a View.
    // Construct the AST directly since the parser would not normally emit
    // frontmatter in inline mode.
    const ast: MarkdownToJSX.FrontmatterNode[] = [
      { type: RuleType.frontmatter, text: 'title: hi' },
    ]
    const result = astToNative(ast, { preserveFrontmatter: true, forceInline: true })
    const element = getFirstElement(result)
    expect(isComponentType(element, Text)).toBe(true)
    expect(extractTextContent(element)).toContain('title: hi')
  })

  it('applies TextStyle (codeInline) to inline frontmatter and ViewStyle (codeBlock) to block', () => {
    const ast: MarkdownToJSX.FrontmatterNode[] = [
      { type: RuleType.frontmatter, text: 'title: hi' },
    ]
    const inlineResult = astToNative(ast, {
      preserveFrontmatter: true,
      forceInline: true,
      styles: { codeInline: { color: 'red' }, codeBlock: { padding: 8 } },
    })
    const inlineEl = getFirstElement(inlineResult)
    expect(getComponentStyle(inlineEl).color).toBe('red')

    const blockResult = astToNative(ast, {
      preserveFrontmatter: true,
      styles: { codeInline: { color: 'red' }, codeBlock: { padding: 8 } },
    })
    const blockEl = getFirstElement(blockResult)
    expect(getComponentStyle(blockEl).padding).toBe(8)
  })

  it('does not pass DOM-only props to View when no input override is set', () => {
    const result = compiler('- [x] Task')
    const allViews = findAllByType(result, View)
    // The default checkbox draws a checkmark rather than the "[x]" text marker.
    const taskView = allViews.find(v => extractTextContent(v) === '✓')
    if (!taskView) throw new Error('Expected a task checkbox View')
    expect(taskView.props.type).toBeUndefined()
    expect(taskView.props.checked).toBeUndefined()
    expect(taskView.props.readOnly).toBeUndefined()
  })

  it('task list item wrapper opts into row layout by default', () => {
    const ul = getFirstElement(compiler('- [x] Task'))
    const li = childElementAt(ul, 0)
    const innerItemView = childElementAt(li, 1)
    const style = getComponentStyle(innerItemView)
    expect(style.flexDirection).toBe('row')
    // Top-aligned so the checkbox lines up with the first line of the label.
    expect(style.alignItems).toBe('flex-start')
  })

  it('non-task list items flex their content but do not inherit task row defaults', () => {
    const ul = getFirstElement(compiler('- regular item'))
    const li = childElementAt(ul, 0)
    const innerItemView = childElementAt(li, 1)
    const style = getComponentStyle(innerItemView)
    // Content flexes to fill the row width, but only tasks get row+center layout.
    expect(style.flex).toBe(1)
    expect(style.flexDirection).toBeUndefined()
    expect(style.alignItems).toBeUndefined()
  })

  it('consumer styles.listItem overrides task row defaults via mergeStyle', () => {
    const ul = getFirstElement(
      compiler('- [x] Task', {
        styles: { listItem: { flexDirection: 'column' } },
      })
    )
    const li = childElementAt(ul, 0)
    const innerItemView = childElementAt(li, 1)
    const style = getComponentStyle(innerItemView)
    // mergeStyle puts user style last → user flexDirection wins.
    expect(style.flexDirection).toBe('column')
    // alignItems from the default is preserved (user didn't override it).
    expect(style.alignItems).toBe('flex-start')
  })
})

describe('Markdown component children handling', () => {
  it('accepts string-array children and concatenates', () => {
    const result = React.createElement(Markdown, {
      children: ['# Hello ', 'world'],
    })
    expect(extractTextContent(result)).toContain('Hello world')
  })
})

describe('AST node rendering', () => {
  it('should render paragraph node as Text component', () => {
    const ast = parser('Hello world')
    const result = astToNative(ast)
    const element = getFirstElement(result)
    expect(isComponentType(element, Text)).toBe(true)
    expect(extractTextContent(element)).toBe('Hello world')
  })

  it('should render heading nodes as Text components', () => {
    const ast = parser('# Heading 1\n## Heading 2')
    const result = astToNative(ast)
    const element = getFirstElement(result)
    const heading1Element = findTextElement(element)
    expect(isComponentType(heading1Element, Text)).toBe(true)
    const text = extractTextContent(result)
    expect(text).toContain('Heading 1')
    expect(text).toContain('Heading 2')
  })

  it('should render link node as Text with onPress', () => {
    const ast = parser('[Link](https://example.com)\n')
    const result = astToNative(ast)
    const element = getFirstElement(result)
    const linkElement = findLinkElement(element)
    expect(isComponentType(linkElement, Text)).toBe(true)
    const props = linkElement.props
    expect(typeof props.onPress).toBe('function')
    expect(extractTextContent(linkElement)).toBe('Link')
  })

  it('should render image node as Image component', () => {
    const ast = parser('![Alt](image.jpg)\n')
    const result = astToNative(ast)
    const element = getFirstElement(result)
    const imageElement = findChildByType(element, Image)
    expect(isComponentType(imageElement, Image)).toBe(true)
    const props = imageElement.props
    expect(props.source).toBeDefined()
    expect(props.source?.uri).toBe('image.jpg')
  })

  it('should render code block as View containing Text', () => {
    const ast = parser('```\ncode\n```')
    const result = astToNative(ast)
    const element = getFirstElement(result)
    expect(isComponentType(element, View)).toBe(true)
    expect(extractTextContent(element)).toContain('code')
  })

  it('should render inline code as Text component', () => {
    const ast = parser('Text with `code` inline')
    const result = astToNative(ast)
    const element = getFirstElement(result)
    const codeElement = findTextElement(element)
    expect(isComponentType(codeElement, Text)).toBe(true)
    expect(extractTextContent(codeElement)).toContain('code')
  })

  it('should render blockquote as View component', () => {
    const ast = parser('> Quote')
    const result = astToNative(ast)
    const element = getFirstElement(result)
    expect(isComponentType(element, View)).toBe(true)
    expect(extractTextContent(element)).toContain('Quote')
  })

  it('should render ordered list as View with Text bullets', () => {
    const ast = parser('1. Item 1\n2. Item 2')
    const result = astToNative(ast)
    const element = getFirstElement(result)
    expect(isComponentType(element, View)).toBe(true)
    const text = extractTextContent(element)
    expect(text).toContain('Item 1')
    expect(text).toContain('Item 2')
  })

  it('should render ordered list with start=0 correctly', () => {
    const ast: MarkdownToJSX.OrderedListNode = {
      type: RuleType.orderedList,
      items: [
        [{ type: RuleType.text, text: 'Item 0' }],
        [{ type: RuleType.text, text: 'Item 1' }],
        [{ type: RuleType.text, text: 'Item 2' }],
      ],
      start: 0,
    }
    const result = astToNative([ast])
    const element = getFirstElement(result)
    expect(isComponentType(element, View)).toBe(true)
    const text = extractTextContent(element)
    expect(text).toContain('0.')
    expect(text).toContain('Item 0')
    expect(text).toContain('1.')
    expect(text).toContain('Item 1')
    expect(text).toContain('2.')
    expect(text).toContain('Item 2')
  })

  it('should render unordered list as View with Text bullets', () => {
    const ast = parser('- Item 1\n- Item 2')
    const result = astToNative(ast)
    const element = getFirstElement(result)
    expect(isComponentType(element, View)).toBe(true)
    const text = extractTextContent(element)
    expect(text).toContain('Item 1')
    expect(text).toContain('Item 2')
  })

  it('should render bold text as Text with fontWeight', () => {
    const result = compiler('**bold**')
    const element = getFirstElement(result)
    expect(isComponentType(element, Text)).toBe(true)
    const style = getComponentStyle(element)
    expect(style.fontWeight).toBe('bold')
  })

  it('should render italic text as Text with fontStyle', () => {
    const result = compiler('*italic*')
    const element = getFirstElement(result)
    expect(isComponentType(element, Text)).toBe(true)
    const style = getComponentStyle(element)
    expect(style.fontStyle).toBe('italic')
  })

  it('should render strikethrough text as Text with textDecorationLine', () => {
    const result = compiler('~~strikethrough~~')
    const element = getFirstElement(result)
    expect(isComponentType(element, Text)).toBe(true)
    const style = getComponentStyle(element)
    expect(style.textDecorationLine).toBe('line-through')
  })

  it('should render thematic break as View component', () => {
    const result = compiler('---\n')
    const element = getFirstElement(result)
    expect(isComponentType(element, View)).toBe(true)
  })

  it('should render table as View with nested View structure', () => {
    const result = compiler('| Header |\n|--------|\n| Cell   |')
    const element = getFirstElement(result)
    expect(isComponentType(element, View)).toBe(true)
    const text = extractTextContent(element)
    expect(text.length).toBeGreaterThan(0)
    expect(text).toContain('Header')
    expect(text).toContain('Cell')
  })

  it('should render GFM task as View with a drawn checkbox marker', () => {
    const result = compiler('- [x] Task')
    const element = getFirstElement(result)
    expect(isComponentType(element, View)).toBe(true)
    const text = extractTextContent(element)
    expect(text).toContain('Task')
    // A completed task draws a checkmark rather than the "[x]" text marker.
    expect(text).toContain('✓')
  })
})

describe('Markdown component', () => {
  it('should render children as markdown', () => {
    const result = React.createElement(Markdown, { children: '# Hello' })
    expect(extractTextContent(result)).toContain('Hello')
  })

  it('should accept options prop', () => {
    const result = React.createElement(Markdown, {
      children: '# Hello',
      options: { styles: { heading1: { fontSize: 24 } } },
    })
    expect(extractTextContent(result)).toContain('Hello')
  })

  it('should accept wrapperProps', () => {
    // Test that wrapperProps are accepted and merged correctly
    // Note: Full rendering test requires React renderer, this verifies no errors
    const result = compiler('Hello\n\nWorld', {
      wrapperProps: { testID: 'markdown-wrapper' },
    })
    const rendered = getFirstElement(result)
    expect(rendered.props.testID).toBe('markdown-wrapper')
  })
})

describe('integration tests', () => {
  it('should handle complex markdown document', () => {
    const markdown = `# Title

This is a paragraph with **bold** and *italic* text.

- List item 1
- List item 2

[Link](https://example.com)
`
    const result = compiler(markdown)
    const text = extractTextContent(result)
    expect(text).toContain('Title')
    expect(text).toContain('bold')
    expect(text).toContain('italic')
    expect(text).toContain('List item 1')
    expect(text).toContain('List item 2')
    expect(text).toContain('Link')
  })

  it('should handle markdown with custom tags', () => {
    const markdown = '<MyTag color="blue">**Bold** text</MyTag>'
    const result = compiler(markdown)
    const text = extractTextContent(result)
    expect(text.length).toBeGreaterThan(0)
    expect(text).toContain('Bold')
    expect(text).toContain('text')
  })

  it('should handle mixed markdown and custom tags', () => {
    const markdown = '<MyTag>*Mixed* **Example**</MyTag>'
    const result = compiler(markdown)
    const text = extractTextContent(result)
    expect(text.length).toBeGreaterThan(0)
    expect(text).toContain('Mixed')
    expect(text).toContain('Example')
  })
})

describe('edge cases - renderer input validation', () => {
  it('should handle null children in Markdown component', () => {
    const result = React.createElement(Markdown, { children: null })
    expect(extractTextContent(result)).toBe('')
  })

  it('should handle undefined children in Markdown component', () => {
    const result = React.createElement(Markdown, { children: undefined })
    expect(extractTextContent(result)).toBe('')
  })

  it('should handle empty string children in Markdown component', () => {
    const result = React.createElement(Markdown, { children: '' })
    expect(extractTextContent(result)).toBe('')
  })

  it('should handle empty array children', () => {
    const result = React.createElement(Markdown, { children: [] })
    expect(extractTextContent(result)).toBe('')
  })
})

describe('edge cases - link rendering', () => {
  it('should handle link with both onPress and onLongPress', () => {
    const onLinkPress = mock((url: string) => {})
    const onLinkLongPress = mock((url: string) => {})
    const result = compiler('[Link](https://example.com)', {
      onLinkPress,
      onLinkLongPress,
    })
    expect(extractTextContent(result)).toBe('Link')
    const element = getFirstElement(result)
    const linkElement = findLinkElement(element)
    const props = linkElement.props
    expect(typeof props.onPress).toBe('function')
    expect(typeof props.onLongPress).toBe('function')
  })

  it('should handle link with empty URL', () => {
    const result = compiler('[Link]()')
    expect(extractTextContent(result)).toContain('Link')
    const element = getFirstElement(result)
    const linkElement = findLinkElement(element)
    expect(isComponentType(linkElement, Text)).toBe(true)
    const props = linkElement.props
    expect(typeof props.onPress).toBe('function')
  })

  it('should handle link with very long URL', () => {
    const longUrl =
      'https://example.com/' + 'a'.repeat(200) + '?param=' + 'b'.repeat(200)
    const result = compiler(`[Link](${longUrl})`)
    expect(extractTextContent(result)).toContain('Link')
    const element = getFirstElement(result)
    const linkElement = findLinkElement(element)
    expect(isComponentType(linkElement, Text)).toBe(true)
    const props = linkElement.props
    expect(typeof props.onPress).toBe('function')
  })

  it('should apply default underline style even when custom style provided', () => {
    const result = compiler('[Link](https://example.com)', {
      styles: {
        link: { color: 'blue' },
      },
    })
    expect(extractTextContent(result)).toBe('Link')
    const element = getFirstElement(result)
    const linkElement = findLinkElement(element)
    const style = getComponentStyle(linkElement)
    expect(style.textDecorationLine).toBe('underline')
    expect(style.color).toBe('blue')
  })
})

describe('edge cases - image rendering', () => {
  it('should render image with empty alt text', () => {
    const result = compiler('![](/xyz.png)')
    const imageElement = findChildByType(result, Image)
    const props = imageElement.props
    expect(props.source).toBeDefined()
    expect(props.source?.uri).toBe('/xyz.png')
  })

  it('should render image with accessibilityLabel from alt text', () => {
    const result = compiler('![Alt text](/image.png)')
    const imageElement = findChildByType(result, Image)
    const props = imageElement.props
    expect(props.source).toBeDefined()
    expect(props.source?.uri).toBe('/image.png')
    expect(props.accessibilityLabel).toBe('Alt text')
  })

  it('should handle base64 data URI images', () => {
    const base64Image =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg=='
    const result = compiler(`![Red Dot](${base64Image})`)
    const imageElement = findChildByType(result, Image)
    const props = imageElement.props
    expect(props.source).toBeDefined()
    expect(props.source?.uri).toBe(base64Image)
  })

  it('should apply custom image style', () => {
    const customStyle = { width: 100, height: 100 }
    const result = compiler('![Alt](/image.png)', {
      styles: {
        image: customStyle,
      },
    })
    const imageElement = findChildByType(result, Image)
    const style = getComponentStyle(imageElement)
    expect(style.width).toBe(100)
    expect(style.height).toBe(100)
  })
})

describe('edge cases - style application', () => {
  it('should merge multiple style objects', () => {
    const result = compiler('# Heading', {
      styles: {
        heading1: { fontSize: 24, fontWeight: 'bold' as const },
      },
    })
    const element = getFirstElement(result)
    const headingElement = findTextElement(element)
    const style = getComponentStyle(headingElement)
    expect(style.fontSize).toBe(24)
    expect(style.fontWeight).toBe('bold')
  })

  it('should apply styles to all heading levels', () => {
    const styles = {
      heading1: { fontSize: 32 },
      heading2: { fontSize: 28 },
      heading3: { fontSize: 24 },
    }
    const result1 = compiler('# H1', { styles })
    const result2 = compiler('## H2', { styles })
    const result3 = compiler('### H3', { styles })
    const element1 = getFirstElement(result1)
    const element2 = getFirstElement(result2)
    const element3 = getFirstElement(result3)
    const h1Element = findTextElement(element1)
    const h2Element = findTextElement(element2)
    const h3Element = findTextElement(element3)
    expect(getComponentStyle(h1Element).fontSize).toBe(32)
    expect(getComponentStyle(h2Element).fontSize).toBe(28)
    expect(getComponentStyle(h3Element).fontSize).toBe(24)
  })

  it('should handle style array from React Native StyleSheet', () => {
    const style1 = { fontSize: 16 }
    const style2 = { color: 'blue' }
    const result = compiler('Text', {
      forceBlock: true,
      styles: {
        paragraph: [style1, style2],
      },
    })
    const element = getFirstElement(result)
    const style = getComponentStyle(element)
    expect(style.fontSize).toBe(16)
    expect(style.color).toBe('blue')
  })
})

/** First Text element in the tree whose rendered text content equals `content`. */
function findTextByContent(
  node: React.ReactNode,
  content: string
): TestElement {
  const match = findAllTextElements(node).find(
    t => extractTextContent(t) === content
  )
  if (!match) {
    throw new Error(`No Text with content "${content}"`)
  }
  return match
}

describe('styles.text universal base', () => {
  it('applies styles.text under paragraph, list item, table cell, and heading text', () => {
    const md = '# Heading\n\nParagraph text.\n\n- List item\n\n| Col |\n|-----|\n| Cell |\n'
    const result = compiler(md, {
      styles: { text: { color: 'red', fontSize: 18 } },
    })
    // The base color reaches every Text (none of these elements set a color).
    for (const content of ['Heading', 'Paragraph text.', 'List item', 'Cell']) {
      expect(getComponentStyle(findTextByContent(result, content)).color).toBe(
        'red'
      )
    }
    // The base fontSize shows through where the element sets none (list item,
    // table cell); a heading or paragraph keeps its own size from the cascade.
    expect(getComponentStyle(findTextByContent(result, 'List item')).fontSize).toBe(18)
    expect(getComponentStyle(findTextByContent(result, 'Cell')).fontSize).toBe(18)
  })

  it('leaves output unchanged when styles.text is unset', () => {
    const style = getComponentStyle(
      getFirstElement(compiler('Paragraph text.', { forceBlock: true }))
    )
    expect(style.color).toBeUndefined()
  })

  it('lets an element style win over the text base on conflict', () => {
    // styles.text sets a base color; the heading has no color of its own, so the
    // base shows through, while its fontSize (from the default cascade) is kept.
    const result = compiler('# Heading', {
      forceBlock: true,
      styles: { text: { color: 'red' } },
    })
    const style = getComponentStyle(findTextByContent(result, 'Heading'))
    expect(style.color).toBe('red')
    expect(style.fontSize).toBe(28)
  })
})

describe('table facsimile', () => {
  it('renders bold header text and flex:1 cells that align across rows', () => {
    const result = compiler('| A | B |\n|---|---|\n| c | d |\n| e | f |\n')
    const table = getFirstElement(result)

    // Bold header runs.
    expect(getComponentStyle(findTextByContent(result, 'A')).fontWeight).toBe(
      'bold'
    )
    expect(getComponentStyle(findTextByContent(result, 'B')).fontWeight).toBe(
      'bold'
    )

    // Header cells: equal flex, vertical divider on all but the last, separator
    // under the header row.
    const headerRow = childElementAt(childElementAt(table, 0), 0)
    expect(getComponentStyle(headerRow).borderBottomWidth).toBe(1)
    const headerA = childElementAt(headerRow, 0)
    const headerB = childElementAt(headerRow, 1)
    expect(getComponentStyle(headerA).flex).toBe(1)
    expect(getComponentStyle(headerB).flex).toBe(1)
    expect(getComponentStyle(headerA).borderRightWidth).toBe(1)
    expect(headerB.props.style && flattenStyle(headerB.props.style).borderRightWidth).toBeUndefined()

    // Body rows: separator under all but the last row; body cells carry flex:1.
    const body = childElementAt(table, 1)
    const row0 = childElementAt(body, 0)
    const row1 = childElementAt(body, 1)
    expect(getComponentStyle(row0).borderBottomWidth).toBe(1)
    expect(row1.props.style && flattenStyle(row1.props.style).borderBottomWidth).toBeUndefined()
    expect(getComponentStyle(childElementAt(row0, 0)).flex).toBe(1)
    expect(getComponentStyle(childElementAt(row0, 1)).flex).toBe(1)
  })

  it('keeps the column alignment from the table node', () => {
    const result = compiler('| L | C | R |\n|:--|:-:|--:|\n| a | b | c |\n')
    const table = getFirstElement(result)
    const headerRow = childElementAt(childElementAt(table, 0), 0)
    expect(getComponentStyle(childElementAt(headerRow, 0)).alignItems).toBe(
      'flex-start'
    )
    expect(getComponentStyle(childElementAt(headerRow, 1)).alignItems).toBe(
      'center'
    )
    expect(getComponentStyle(childElementAt(headerRow, 2)).alignItems).toBe(
      'flex-end'
    )
  })
})

describe('edge cases - wrapper rendering', () => {
  it('should handle wrapper null option', () => {
    const result = compiler('Hello\n\nworld!', { wrapper: null })
    expect(Array.isArray(result)).toBe(true)
    const items = Array.isArray(result) ? result : []
    expect(items.length).toBeGreaterThan(0)
    expect(React.isValidElement(items[0])).toBe(true)
  })

  it('should handle wrapper with React.Fragment', () => {
    const result = compiler('Hello\n\nworld!', { wrapper: React.Fragment })
    const text = extractTextContent(result)
    expect(text.length).toBeGreaterThan(0)
    expect(text).toContain('Hello')
  })

  it('should apply wrapperProps to wrapper element', () => {
    const result = compiler('Hello\n\nworld!', {
      wrapper: React.Fragment,
      wrapperProps: { testID: 'wrapper' },
    })
    expect(React.isValidElement(result)).toBe(true)
    const props = getFirstElement(result).props
    expect(props.testID).toBe('wrapper')
  })

  it('should handle forceWrapper with single child', () => {
    const result = compiler('Single child', {
      wrapper: React.Fragment,
      forceWrapper: true,
    })
    const text = extractTextContent(result)
    expect(text.length).toBeGreaterThan(0)
    expect(text).toContain('Single')
  })
})

describe('edge cases - component overrides', () => {
  it('should handle override that returns null', () => {
    const nullFn = () => null
    const result = compiler('Hello', {
      forceBlock: true,
      overrides: { p: nullFn },
    })
    // When override returns null, the element type is the null-returning function
    expect(getFirstElement(result).type).toBe(nullFn)
  })

  it('should handle override that returns null for HTML element', () => {
    const nullFn = () => null
    const result = compiler('<div>Hello</div>', {
      forceBlock: true,
      tagfilter: false,
      overrides: { div: nullFn },
    })
    expect(getFirstElement(result).type).toBe(nullFn)
  })

  it('should handle override with component and props', () => {
    const CustomText = (props: TextProps) => React.createElement(Text, props)
    const result = compiler('Hello', {
      forceBlock: true,
      overrides: {
        p: {
          component: CustomText,
          props: { testID: 'custom-paragraph' },
        },
      },
    })
    const element = getFirstElement(result)
    expect(element.type).toBe(CustomText)
    expect(element.props.testID).toBe('custom-paragraph')
  })

  it('should handle nested overrides', () => {
    const Accordion = ({ children }: { children?: React.ReactNode }) => children
    const AccordionItem = ({ children }: { children?: React.ReactNode }) =>
      children
    const result = compiler(
      '<Accordion><AccordionItem>test</AccordionItem></Accordion>',
      {
        forceBlock: true,
        overrides: {
          Accordion,
          AccordionItem,
        },
        tagfilter: false,
      }
    )
    // Compact parser produces top-level htmlBlock (no paragraph wrapper)
    // so the first element IS the Accordion itself
    const element = getFirstElement(result)
    expect(element.type).toBe(Accordion)
    // AccordionItem is the first child of Accordion
    const accordionItemElement = childElementAt(element, 0)
    expect(accordionItemElement.type).toBe(AccordionItem)
    expect(extractTextContent(result)).toContain('test')
  })

  it('regression test for #823 - void element after blank line', () => {
    const result = compiler('\n<br>')
    const element = getFirstElement(result)
    expect(React.isValidElement(element)).toBe(true)
    expect(element.props.children).toBeUndefined()
  })

  it('regression test for #823 - void element with trailing content', () => {
    const result = compiler('\n<br>\nsome text')
    expect(React.isValidElement(result)).toBe(true)
    expect(extractTextContent(result)).toContain('some text')
  })

  it('should handle override with forwardRef component', () => {
    const CustomText = React.forwardRef<Text, TextProps>((props, ref) =>
      React.createElement(Text, { ...props, ref })
    )
    const result = compiler('Hello', {
      overrides: {
        p: CustomText,
      },
    })
    const element = getFirstElement(result)
    expect(React.isValidElement(element)).toBe(true)
    expect(extractTextContent(element)).toBe('Hello')
  })
})

describe('edge cases - HTML tag rendering', () => {
  it('should map unsupported HTML block tags to View', () => {
    const result = compiler('<div>Content</div>', {
      forceBlock: true,
      tagfilter: false,
    })
    const element = getFirstElement(result)
    // The element should be a View (forwardRef)
    const elementType: unknown = element.type
    expect(
      isForwardRefComponent(elementType) ? elementType.$$typeof : undefined
    ).toBe(Symbol.for('react.forward_ref'))
    expect(extractTextContent(element)).toContain('Content')
  })

  it('should map unsupported HTML inline tags to Text', () => {
    const result = compiler('<span>Inline</span>', { tagfilter: false })
    const element = getFirstElement(result)
    expect(isComponentType(element, Text)).toBe(true)
  })

  it('should handle pre tag', () => {
    const result = compiler('<pre>Code</pre>', { tagfilter: false })
    const element = getFirstElement(result)
    expect(isComponentType(element, View)).toBe(true)
    expect(extractTextContent(element)).toContain('Code')
  })

  it('should handle script tag when tagfilter is false', () => {
    const result = compiler('<script>alert("test")</script>', {
      tagfilter: false,
    })
    const element = getFirstElement(result)
    expect(isComponentType(element, View)).toBe(true)
  })
})

describe('footnotes', () => {
  it('should render plain text footnote content wrapped in Text component', () => {
    const result = compiler(`foo[^1] bar\n\n[^1]: Simple text`)
    const textContent = extractTextContent(result)
    expect(textContent).toContain('Simple text')
    expect(() => {
      // This should not throw "Text strings must be rendered within a Text component"
      const element = getFirstElement(result)
      expect(element).toBeDefined()
    }).not.toThrow()
  })

  // The reference marker is the only pressable element in these single-footnote
  // inputs, so collecting by onPress isolates it from body text and the footer.
  function findMarker(node: React.ReactNode, out: TestElement[] = []): TestElement[] {
    if (Array.isArray(node)) {
      node.forEach(child => findMarker(child, out))
      return out
    }
    if (!isTestElement(node)) return out
    if (node.props?.onPress != null) out.push(node)
    findMarker(node.props?.children as React.ReactNode, out)
    return out
  }

  it('renders a numeric reference as a Unicode superscript', () => {
    const marker = findMarker(compiler('a[^1]\n\n[^1]: note'))[0]
    expect(extractTextContent(marker)).toBe('¹')
  })

  it('maps every digit of a multi-digit reference', () => {
    const marker = findMarker(compiler('a[^12]\n\n[^12]: note'))[0]
    expect(extractTextContent(marker)).toBe('¹²')
  })

  it('passes a non-numeric reference identifier through unchanged', () => {
    const marker = findMarker(compiler('a[^note]\n\n[^note]: text'))[0]
    expect(extractTextContent(marker)).toBe('note')
  })

  it('applies styles.footnote to the marker', () => {
    const marker = findMarker(
      compiler('a[^1]\n\n[^1]: note', { styles: { footnote: { color: 'red' } } })
    )[0]
    // The marker carries the styles.text base plus the footnote override; the
    // override wins on conflict, so the flattened style includes the red color.
    expect(getComponentStyle(marker)).toMatchObject({ color: 'red' })
  })

  // The footer collects footnote definitions. An all-inline note reads as one
  // line and renders as a Text; a note holding a block (an image) stacks as a
  // View, since a Text cannot nest a view (issue #884).
  function findFootnoteFooterEntry(result: React.ReactNode): TestElement {
    const outer = getFirstElement(result)
    const kids = Array.isArray(outer.props.children)
      ? outer.props.children
      : [outer.props.children]
    const footer = kids.find(k => isTestElement(k) && k.key === 'footer')
    if (!isTestElement(footer)) throw new Error('No footnote footer View')
    return childElementAt(footer, 0)
  }

  it('renders an inline note footer entry as a Text', () => {
    const entry = findFootnoteFooterEntry(compiler('a[^1]\n\n[^1]: The note.'))
    expect(isComponentType(entry, Text)).toBe(true)
    expect(extractTextContent(entry)).toContain('The note.')
  })

  it('renders an image note footer entry as a View', () => {
    const entry = findFootnoteFooterEntry(
      compiler('a[^1]\n\n[^1]: ![i](https://x.com/i.png)')
    )
    expect(isComponentType(entry, View)).toBe(true)
    expect(findFirst(entry, Image)?.props.source?.uri).toBe(
      'https://x.com/i.png'
    )
  })
})

describe('options immutability', () => {
  it('should not mutate options object when calling astToNative multiple times', () => {
    // Test that astToNative doesn't mutate the options object when called multiple times
    // This is important for memoization - if the same options object is reused,
    // mutations could cause unexpected side effects
    const markdown = '# Hello world'
    const ast = parser(markdown)
    const options: NativeOptions = {
      slugify: (input: string) => input.toLowerCase(),
    }
    const originalOverrides = options.overrides

    // First call
    astToNative(ast, options)

    // Verify options object wasn't mutated
    expect(options.overrides).toBe(originalOverrides)

    // Second call with same options
    astToNative(ast, options)

    // Options should still be unchanged
    expect(options.overrides).toBe(originalOverrides)
  })

  it('should not mutate options object when calling compiler multiple times', () => {
    // Test that compiler doesn't mutate the options object when called multiple times
    const markdown = '# Hello world'
    const options: NativeOptions = {
      slugify: (input: string) => input.toLowerCase(),
    }
    const originalOverrides = options.overrides

    // First call
    compiler(markdown, options)

    // Verify options object wasn't mutated
    expect(options.overrides).toBe(originalOverrides)

    // Second call with same options
    compiler(markdown, options)

    // Options should still be unchanged
    expect(options.overrides).toBe(originalOverrides)
  })
})

describe('MarkdownProvider and MarkdownContext', () => {
  it('should export MarkdownProvider', () => {
    const { MarkdownProvider } = require('./native')
    expect(typeof MarkdownProvider).toBe('function')
  })

  it('should export MarkdownContext', () => {
    const { MarkdownContext } = require('./native')
    expect(MarkdownContext).toBeDefined()
    expect(typeof MarkdownContext.Provider).toBe('object')
  })

  it('should support context-based options (integration test)', () => {
    // Note: Full context testing requires a proper React renderer
    // This test verifies the exports exist and have correct types
    const { MarkdownProvider, MarkdownContext } = require('./native')
    expect(MarkdownProvider).toBeDefined()
    expect(MarkdownContext).toBeDefined()
  })
})

// Serialize a native element tree to a tag-and-text string so nesting and
// sibling order (not just text presence) are asserted. RN primitives render as
// Text/View; HTML tags with no RN mapping keep their tag name.
/** displayName/name fallback when a component is none of the known primitives. */
function componentDisplayName(t: unknown): string {
  if ((typeof t !== 'object' && typeof t !== 'function') || t === null) {
    return '?'
  }
  if (
    'displayName' in t &&
    typeof t.displayName === 'string' &&
    t.displayName
  ) {
    return t.displayName
  }
  if ('name' in t && typeof t.name === 'string' && t.name) return t.name
  return '?'
}

function serialize(el: React.ReactNode): string {
  if (el == null || typeof el === 'boolean') return ''
  if (typeof el === 'string' || typeof el === 'number') return String(el)
  if (Array.isArray(el)) return el.map(serialize).join('')
  if (!isTestElement(el)) return ''
  const t: unknown = el.type
  const name =
    typeof t === 'string'
      ? t
      : t === Text
        ? 'Text'
        : t === View
          ? 'View'
          : t === Image
            ? 'Image'
            : t === Pressable
              ? 'Pressable'
              : t === React.Fragment
                ? ''
                : componentDisplayName(t)
  const inner = serialize(el.props.children)
  return name ? `<${name}>${inner}</${name}>` : inner
}

describe('regression #881 - trailing text after a nested HTML element', () => {
  it('text line after a nested block element is preserved', () => {
    expect(
      serialize(compiler('<details>\n<summary>a</summary>\nx\n</details>'))
    ).toMatchInlineSnapshot(`"<View><View><Text>a</Text></View><Text> x </Text></View>"`)
  })

  it('text line after a nested paragraph is preserved', () => {
    expect(
      serialize(compiler('<div>\n<p>a</p>\nx\n</div>'))
    ).toMatchInlineSnapshot(`"<View><Text><Text>a</Text><Text> x </Text></Text></View>"`)
  })

  it('markdown in the trailing text line is processed', () => {
    expect(
      serialize(
        compiler('<details>\n<summary>a</summary>\n**bold** text\n</details>')
      )
    ).toMatchInlineSnapshot(`"<View><View><Text>a</Text></View><Text><Text>bold</Text> text </Text></View>"`)
  })

  it('text line between nested paragraphs is preserved', () => {
    expect(
      serialize(compiler('<div>\n<p>a</p>\nx\n<p>b</p>\n</div>'))
    ).toMatchInlineSnapshot(`"<View><Text><Text>a</Text><Text> x <Text>b</Text></Text></Text></View>"`)
  })

  it('text after the element own closing tag renders as a sibling', () => {
    expect(
      serialize(compiler('<div>\n<span>a</span>\n</div>\ntail'))
    ).toMatchInlineSnapshot(`"<View><Text><Text>a</Text></Text></View><Text> tail</Text>"`)
  })

  // The element and its trailing siblings share one Fragment; both were keyed
  // from 0, so React warned about duplicate keys. They must now be unique.
  const mixedBlocks: [string, string][] = [
    ['paragraphs around text', '<div>\n<p>a</p>\nx\n<p>b</p>\n</div>'],
    ['paragraph then text', '<div>\n<p>a</p>\nx\n</div>'],
    ['text after closing tag', '<div>\n<p>a</p>\nx\n<p>b</p>\n</div>\ntail'],
  ]
  mixedBlocks.forEach(([name, md]) => {
    it(`assigns unique sibling keys: ${name}`, () => {
      expect(duplicateSiblingKeys(compiler(md))).toEqual([])
    })
  })

  it('assigns unique sibling keys to a component block after a heading', () => {
    const MyComponent = (props: ViewProps) =>
      React.createElement(View, { ...props, testID: 'my-component' })
    const result = compiler('# H\n\n<MyComponent>hi</MyComponent>', {
      forceBlock: true,
      overrides: { MyComponent },
      tagfilter: false,
    })
    expect(findFirst(result, MyComponent)?.type).toBe(MyComponent)
    expect(duplicateSiblingKeys(result)).toEqual([])
  })
})

/**
 * Collect every element whose direct children include two siblings sharing a
 * React key, which triggers React's duplicate-key warning. An empty result
 * proves every sibling group has unique keys.
 */
function duplicateSiblingKeys(el: React.ReactNode, out: string[] = []): string[] {
  if (!isTestElement(el)) {
    if (Array.isArray(el)) el.forEach(child => duplicateSiblingKeys(child, out))
    return out
  }
  const children = el.props.children
  if (Array.isArray(children)) {
    const counts = new Map<string, number>()
    for (const child of children) {
      if (isTestElement(child) && child.key != null) {
        const key = String(child.key)
        counts.set(key, (counts.get(key) ?? 0) + 1)
      }
    }
    for (const [key, count] of counts) {
      if (count > 1) out.push(key)
    }
  }
  React.Children.toArray(children).forEach(child => duplicateSiblingKeys(child, out))
  return out
}

/**
 * Collect every bare string that sits directly inside a View (or Image), which
 * React Native forbids at render time. An empty result proves the tree is safe.
 */
function bareStringsInView(
  el: React.ReactNode,
  inView = false,
  out: string[] = []
): string[] {
  if (el == null || typeof el === 'boolean') return out
  if (typeof el === 'string' || typeof el === 'number') {
    if (inView && String(el).length) out.push(String(el))
    return out
  }
  if (Array.isArray(el)) {
    el.forEach(c => bareStringsInView(c, inView, out))
    return out
  }
  if (!isTestElement(el)) return out
  const t: unknown = el.type
  bareStringsInView(el.props.children, t === View || t === Image, out)
  return out
}

/**
 * Collect every View/Image element placed directly inside a Text, which React
 * Native forbids on Android ("Unexpected view type nested under text node").
 */
function viewsInText(
  el: React.ReactNode,
  inText = false,
  out: string[] = []
): string[] {
  if (!isTestElement(el)) {
    if (Array.isArray(el)) el.forEach(c => viewsInText(c, inText, out))
    return out
  }
  const t: unknown = el.type
  const isView = t === View || t === Image
  if (isView && inText) out.push(t === Image ? 'Image' : 'View')
  viewsInText(el.props.children, t === Text, out)
  return out
}

describe('regression #884 - bare strings must never sit inside a native View', () => {
  const noBareText: [string, string][] = [
    ['ordered list', '1. First item\n2. Second **bold**\n'],
    ['unordered list', '- First\n- Second *em*\n'],
    ['task list', '- [ ] todo\n- [x] done\n'],
    ['nested list', '- top\n  - nested\n'],
    ['loose list', '- item\n\n  second para\n'],
    ['table', '| a | b |\n|---|---|\n| c *i* | d |\n'],
    ['html div', '<div>hello **world**</div>\n'],
    ['html section', '<section>text</section>\n'],
    ['html figure', '<figure>caption</figure>\n'],
    ['html blockquote', '<blockquote>quote</blockquote>\n'],
    ['raw ul', '<ul><li>a</li><li>b</li></ul>\n'],
    ['raw table', '<table><tr><td>a</td></tr></table>\n'],
    ['html pre', '<pre>code text</pre>\n'],
    ['div with trailing text', '<div>\n<p>a</p>\nx\n</div>\n'],
    ['footnote with formatting', 'a[^1]\n\n[^1]: **bold** note\n'],
    ['definition list', '<dl><dt>term</dt><dd>def</dd></dl>\n'],
    ['details/summary', '<details><summary>s</summary>body text</details>\n'],
    ['table footer', '<table><tfoot><tr><td>x</td></tr></tfoot></table>\n'],
    ['fieldset', '<fieldset><legend>L</legend>field</fieldset>\n'],
  ]

  noBareText.forEach(([name, md]) => {
    it(`${name} renders no bare string inside a View`, () => {
      expect(bareStringsInView(compiler(md))).toEqual([])
    })
  })

  const noViewInText: [string, string][] = [
    ['list with image', '- ![alt](https://x.com/i.png)\n'],
    ['list text with image', '- see ![a](https://x.com/i.png) here\n'],
    ['table cell image', '| a |\n|---|\n| ![x](https://x.com/i.png) |\n'],
    ['standalone image', '![alt](https://x.com/i.png)\n'],
    ['paragraph inline image', 'see ![a](https://x.com/i.png) here\n'],
    ['heading image', '# ![a](https://x.com/i.png)\n'],
    ['image link', '[![a](https://x.com/i.png)](https://x.com)\n'],
    ['emphasis image', '**![a](https://x.com/i.png)**\n'],
    ['blockquote image', '> ![a](https://x.com/i.png)\n'],
    ['footnote image', 'a[^1]\n\n[^1]: ![i](https://x.com/i.png)\n'],
  ]

  noViewInText.forEach(([name, md]) => {
    it(`${name} renders the image as a View child, not inside a Text`, () => {
      expect(viewsInText(compiler(md))).toEqual([])
    })
  })

  it('renders a block-container HTML tag as a View, not inline Text', () => {
    // A definition list is a block container, so it maps to a View whose text
    // children are wrapped in Text (VIEW_TAGS covers dl/dt/dd; a Text host would
    // lay them out inline).
    expect(serialize(compiler('<dl><dt>term</dt><dd>def</dd></dl>\n'))).toContain(
      '<View>'
    )
    expect(bareStringsInView(compiler('<dl><dt>term</dt><dd>def</dd></dl>\n'))).toEqual(
      []
    )
  })

  it('degrades a paragraph with an image to a View, keeping text runs', () => {
    expect(
      serialize(compiler('see ![a](https://x.com/i.png) here\n'))
    ).toMatchInlineSnapshot(`"<View><Text>see </Text><Image></Image><Text> here</Text></View>"`)
  })

  it('renders an image link as a pressable holding the image', () => {
    const result = compiler('[![a](https://x.com/i.png)](https://x.com)\n')
    const pressable = findFirst(result, Pressable)
    expect(pressable?.props.onPress).toBeInstanceOf(Function)
    expect(findFirst(result, Image)?.props.source?.uri).toBe(
      'https://x.com/i.png'
    )
  })

  it('groups list-item inline content into a single Text', () => {
    expect(
      serialize(compiler('1. First **bold** item\n'))
    ).toMatchInlineSnapshot(`"<View><View><Text>1. </Text><View><Text>First <Text>bold</Text> item</Text></View></View></View>"`)
  })

  it('keeps leading text and a nested list as sibling children', () => {
    expect(serialize(compiler('- top\n  - nested\n'))).toMatchInlineSnapshot(`"<View><View><Text>• </Text><View><Text>top</Text><View><View><Text>• </Text><View><Text>nested</Text></View></View></View></View></View></View>"`)
  })

  it('renders a task checkbox and its label as siblings, with no bullet', () => {
    // The checkbox (empty View when unchecked) replaces the bullet and sits
    // beside the label; a checked task draws a checkmark inside the box. The
    // whitespace-only text node after the task marker is dropped so the checkbox
    // margin is the only gap to the label (no leading space in the label Text).
    expect(serialize(compiler('- [ ] todo\n'))).toMatchInlineSnapshot(`"<View><View><View><View></View><Text>todo</Text></View></View></View>"`)
    expect(serialize(compiler('- [x] done\n'))).toMatchInlineSnapshot(`"<View><View><View><View><Text>✓</Text></View><Text>done</Text></View></View></View>"`)
  })

  it('wraps table cell content in a Text', () => {
    expect(
      serialize(compiler('| a |\n|---|\n| c *i* |\n'))
    ).toMatchInlineSnapshot(`"<View><View><View><View><Text>a</Text></View></View></View><View><View><View><Text>c <Text>i</Text></Text></View></View></View></View>"`)
  })
})

describe('streaming table suppression', () => {
  // The native compiler runs input through prepareBlockInput (which appends a
  // blank line) before parsing, a different path than the html compiler. This
  // progressive check feeds each document one character at a time (the strictest
  // superset of any token boundary an LLM could stream) and asserts no in-flight
  // prefix leaks raw pipe syntax as text.
  const docs: Record<string, string> = {
    'single column': 'text\n\n| Only |\n| --- |\n| a |\n',
    'table after paragraph':
      'Here is a table:\n\n| Name | Age |\n| --- | --- |\n| Ann | 30 |\n\nDone.',
    'table at start': '| A | B |\n| --- | --- |\n| 1 | 2 |\n',
  }
  for (const [name, doc] of Object.entries(docs)) {
    it(`never flashes raw pipes while streaming: ${name}`, () => {
      for (let n = 1; n <= doc.length; n++) {
        const text = extractTextContent(compiler(doc.slice(0, n), { optimizeForStreaming: true }))
        expect({ prefixLength: n, text }).toEqual({
          prefixLength: n,
          text: expect.not.stringContaining('|'),
        })
      }
    })
  }

  it('renders the complete table once the final row arrives', () => {
    const rendered = serialize(compiler('| A | B |\n| --- | --- |\n| 1 | 2 |', { optimizeForStreaming: true }))
    expect(rendered).toContain('<Text>A</Text>')
    expect(rendered).toContain('<Text>1</Text>')
    expect(rendered).not.toContain('|')
  })
})

describe('native styling escape hatches', () => {
  const allElements = (
    node: React.ReactNode,
    acc: TestElement[] = []
  ): TestElement[] => {
    if (Array.isArray(node)) {
      node.forEach(n => allElements(n, acc))
    } else if (isTestElement(node)) {
      acc.push(node)
      allElements(node.props.children, acc)
    }
    return acc
  }
  // Flattened style of the first element whose style declares `prop`.
  const firstStyleWith = (
    tree: React.ReactNode,
    prop: string
  ): Record<string, unknown> => {
    for (const el of allElements(tree)) {
      if (el.props.style) {
        const flat = flattenStyle(el.props.style)
        if (prop in flat) return flat
      }
    }
    throw new Error(`No element with style property "${prop}"`)
  }

  it('checkmark styles the completed glyph, keeping the default centering transform', () => {
    const mark = findTextByContent(
      compiler('- [x] done\n', { styles: { checkmark: { color: '#00ff00' } } }),
      '✓'
    )
    const style = getComponentStyle(mark)
    expect(style.color).toBe('#00ff00')
    expect(style.transform).toEqual([{ translateY: -1 }])
  })

  it('gfmTaskChecked styles the checked box accent', () => {
    const box = firstStyleWith(
      compiler('- [x] done\n', {
        styles: { gfmTaskChecked: { backgroundColor: '#00ff00' } },
      }),
      'width'
    )
    expect(box.width).toBe(16)
    expect(box.backgroundColor).toBe('#00ff00')
  })

  it('tableHeaderText styles the bold header run', () => {
    const headerText = findTextByContent(
      compiler('| a | b |\n| --- | --- |\n| 1 | 2 |\n', {
        styles: { tableHeaderText: { color: '#00ff00' } },
      }),
      'a'
    )
    const style = getComponentStyle(headerText)
    expect(style.fontWeight).toBe('bold')
    expect(style.color).toBe('#00ff00')
  })

  it('tableCellDivider styles the vertical grid divider', () => {
    const divider = firstStyleWith(
      compiler('| a | b |\n| --- | --- |\n| 1 | 2 |\n', {
        styles: { tableCellDivider: { borderRightColor: '#00ff00' } },
      }),
      'borderRightWidth'
    )
    expect(divider.borderRightColor).toBe('#00ff00')
  })

  it('tableRowDivider styles the horizontal grid divider', () => {
    const divider = firstStyleWith(
      compiler('| a | b |\n| --- | --- |\n| 1 | 2 |\n', {
        styles: { tableRowDivider: { borderBottomColor: '#00ff00' } },
      }),
      'borderBottomWidth'
    )
    expect(divider.borderBottomColor).toBe('#00ff00')
  })

  it('listItemBullet styles the unordered marker over its default size', () => {
    const bullet = findTextByContent(
      compiler('- item\n', { styles: { listItemBullet: { color: '#00ff00' } } }),
      '• '
    )
    const style = getComponentStyle(bullet)
    expect(style.fontSize).toBe(16)
    expect(style.color).toBe('#00ff00')
  })

  it('listItemNumber styles the ordered marker over its default size', () => {
    const number = findTextByContent(
      compiler('1. item\n', { styles: { listItemNumber: { color: '#00ff00' } } }),
      '1. '
    )
    const style = getComponentStyle(number)
    expect(style.fontSize).toBe(16)
    expect(style.color).toBe('#00ff00')
  })

  it('blockquote zeroes its last block child bottom margin so it ends flush', () => {
    const tree = compiler('> quoted text\n')
    const bq = allElements(tree).find(el => {
      const s = el.props.style ? flattenStyle(el.props.style) : {}
      return s.borderLeftWidth === 3
    })
    if (!bq) throw new Error('no blockquote element')
    const kids = Array.isArray(bq.props.children)
      ? bq.props.children
      : [bq.props.children]
    const last = kids.filter(isTestElement).pop()
    if (!last) throw new Error('no block child in blockquote')
    expect(getComponentStyle(last).marginBottom).toBe(0)
  })
})

describe('native strips dangerous raw HTML attributes', () => {
  const allElements = (
    node: React.ReactNode,
    acc: TestElement[] = []
  ): TestElement[] => {
    if (Array.isArray(node)) {
      node.forEach(n => allElements(n, acc))
    } else if (isTestElement(node)) {
      acc.push(node)
      allElements(node.props.children, acc)
    }
    return acc
  }

  it('never forwards an on* handler prop while keeping safe attributes and content', () => {
    const tree = compiler('<div onclick="alert(1)" data-ok="1">hi</div>')
    for (const el of allElements(tree)) {
      for (const key of Object.keys(el.props)) {
        expect(key.toLowerCase()).not.toBe('onclick')
      }
    }
    const carrier = allElements(tree).find(el => 'data-ok' in el.props)
    expect(carrier?.props['data-ok']).toBe('1')
    expect(extractTextContent(carrier as TestElement)).toBe('hi')
  })
})
