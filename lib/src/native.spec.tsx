import { afterEach, describe, expect, it, mock } from 'bun:test'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ImageProps, TextProps, ViewProps } from 'react-native'
import { Image, Pressable, Text, View } from 'react-native'
import { $ } from './constants.ts'
import Markdown, {
  astToNative,
  compiler,
  type MarkdownToJSX,
  type NativeOptions,
  type NativeStyleKey,
  parser,
  RuleType,
  sanitizer,
  slugify,
} from './native.tsx'
import { escapeText, quotesDeep, storedAST, treeProps } from './test-tree.ts'

interface TestProps {
  children?: React.ReactNode
  source?: { uri?: string }
  style?:
    | Record<string, unknown>
    | Array<Record<string, unknown> | false | null | undefined>
  [prop: string]: unknown
}

type TestElement = React.ReactElement<TestProps>

function isTestElement(value: unknown): value is TestElement {
  return React.isValidElement(value)
}

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
  if (!('$$typeof' in value && 'render' in value)) {
    return false
  }
  return (
    value.$$typeof === Symbol.for('react.forward_ref') &&
    typeof value.render === 'function'
  )
}

function extractTextContent(element: React.ReactNode): string {
  if (typeof element === 'string') {
    return element
  }
  if (typeof element === 'number') {
    return String(element)
  }
  if (element === null || element === undefined) {
    return ''
  }
  if (!isTestElement(element)) {
    return ''
  }
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
  throw new Error(`Expected React element but got: ${typeof result}`)
}

function isComponentType(
  element: React.ReactElement,
  component: React.ComponentType<any>
): boolean {
  if (element.type === component) {
    return true
  }
  if (isForwardRefComponent(element.type) && isForwardRefComponent(component)) {
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
  if (!isTestElement(element)) {
    return []
  }
  const results: TestElement[] = []
  if (isComponentType(element, component)) {
    results.push(element)
  }
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
  if (isComponentType(element, component)) {
    return element
  }
  const props = element.props
  if (props.children) {
    if (Array.isArray(props.children)) {
      for (const child of props.children) {
        try {
          return findChildByType(child, component)
        } catch {}
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
  if (isTestElement(element)) {
    const props = element.props
    if (props.onPress) {
      return element
    }
    if (props.children) {
      const children = Array.isArray(props.children)
        ? props.children
        : [props.children]
      for (const child of children) {
        try {
          return findLinkElement(child)
        } catch {}
      }
    }
  }
  if (Array.isArray(element)) {
    for (const item of element) {
      try {
        return findLinkElement(item)
      } catch {}
    }
  }
  throw new Error('Link element with onPress not found')
}

function flattenStyle(
  style: unknown,
  acc: Record<string, unknown> = {}
): Record<string, unknown> {
  if (!style) {
    return acc
  }
  if (Array.isArray(style)) {
    for (const entry of style) {
      flattenStyle(entry, acc)
    }
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

  it('should export a NativeOptions type that compiles for an empty object', () => {
    const options: NativeOptions = {}
    expect(typeof options).toBe('object')
  })

  it('should export a NativeStyleKey type that compiles for "text"', () => {
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

  it('ends link text at a bracket inside a raw HTML element, and hides only a bracket inside the tag itself', () => {
    expect(
      serialize(
        compiler('[see <b>this]</b> note](/docs)\n\n[a <b title="]">x</b>](/u)')
      )
    ).toMatchInlineSnapshot(
      `"<View><Text>[see <Text>this]</Text> note](/docs)</Text><Text><Text>a <Text>x</Text></Text></Text></View>"`
    )
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
    const onLinkPress = mock((_url: string) => {})
    const result = compiler('[Link](https://example.com)', { onLinkPress })
    const element = getFirstElement(result)
    const linkElement = findLinkElement(element)
    expect(isComponentType(linkElement, Text)).toBe(true)
    expect(extractTextContent(linkElement)).toBe('Link')
    const props = linkElement.props
    expect(typeof props.onPress).toBe('function')
  })

  it('should encode non-BMP characters in URLs', () => {
    const onLinkPress = mock((_url: string) => {})
    const result = compiler(
      '[Author post](https://例え.テスト/著者/𠮷田/投稿-🚀)',
      {
        onLinkPress,
      }
    )
    const linkElement = findLinkElement(getFirstElement(result))

    const onPress = linkElement.props.onPress
    if (typeof onPress !== 'function') {
      throw new Error('Expected link onPress handler')
    }
    onPress()

    expect(onLinkPress).toHaveBeenCalledWith(
      'https://%E4%BE%8B%E3%81%88.%E3%83%86%E3%82%B9%E3%83%88/%E8%91%97%E8%80%85/%F0%A0%AE%B7%E7%94%B0/%E6%8A%95%E7%A8%BF-%F0%9F%9A%80',
      undefined
    )
  })

  it('should handle onLinkLongPress when provided', () => {
    const onLinkLongPress = mock((_url: string) => {})
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
    expect(linkElement.type).toBe(CustomLink)
    expect(typeof linkElement.props.onPress).toBe('function')
    expect(extractTextContent(linkElement)).toBe('Link')
  })

  it('should allow overriding image component, which stays an override of the paragraph View child since an image cannot sit inside a Text', () => {
    const CustomImage = (props: ImageProps) =>
      React.createElement(Image, { ...props, testID: 'custom-image' })
    const result = compiler('![Alt](image.jpg)', {
      forceBlock: true,
      overrides: { img: CustomImage },
    })
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

  it('#248 should apply mixed-case mid-string HTML tag overrides', () => {
    const CustomDiv = (props: ViewProps) =>
      React.createElement(View, { ...props, testID: 'custom-mixed-div' })
    const result = compiler('<dIV>hello</dIV>', {
      overrides: { div: CustomDiv },
    })
    const element = findFirst(result, CustomDiv)
    expect(element?.type).toBe(CustomDiv)
    expect(extractTextContent(result)).toContain('hello')
  })
})

function findFirst(
  element: React.ReactNode,
  component: React.ComponentType
): TestElement | undefined {
  return findAllByType(element, component)[0]
}

function mustFindFirst(
  element: React.ReactNode,
  component: React.ComponentType
): TestElement {
  const found = findFirst(element, component)
  if (!found) {
    throw new Error('Expected component in rendered tree')
  }
  return found
}

function childElementAt(element: TestElement, index: number): TestElement {
  const children = element.props.children
  const child = Array.isArray(children)
    ? children[index]
    : index === 0
      ? children
      : undefined
  if (!isTestElement(child)) {
    throw new Error(`Expected an element child at index ${index}`)
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
    const Pre = (props: ViewProps) =>
      React.createElement(View, { ...props, testID: 'pre' })
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
    const Em = (props: TextProps) =>
      React.createElement(Text, { ...props, testID: 'em' })
    const result = compiler('*italic*', { overrides: { em: Em } })
    expect(extractTextContent(findFirst(result, Em))).toBe('italic')
  })

  it('fires del override for ~~strikethrough~~', () => {
    const Del = (props: TextProps) =>
      React.createElement(Text, { ...props, testID: 'del' })
    const result = compiler('~~struck~~', { overrides: { del: Del } })
    expect(extractTextContent(findFirst(result, Del))).toBe('struck')
  })

  it('fires blockquote override for > quote', () => {
    const Bq = (props: ViewProps) =>
      React.createElement(View, { ...props, testID: 'bq' })
    const result = compiler('> quote', {
      forceBlock: true,
      overrides: { blockquote: Bq },
    })
    expect(extractTextContent(findFirst(result, Bq))).toContain('quote')
  })

  it('fires hr override for ---', () => {
    const Hr = (props: ViewProps) =>
      React.createElement(View, { ...props, testID: 'hr' })
    const result = compiler('---\n', { overrides: { hr: Hr } })
    expect(findFirst(result, Hr)).toBeDefined()
  })

  it('fires h1-h6 overrides for ATX headings', () => {
    const make = (id: string) => (props: TextProps) =>
      React.createElement(Text, { ...props, testID: id })
    const H1 = make('h1')
    const H2 = make('h2')
    const H3 = make('h3')
    const H4 = make('h4')
    const H5 = make('h5')
    const H6 = make('h6')
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
    const Ul = (props: ViewProps) =>
      React.createElement(View, { ...props, testID: 'ul' })
    const result = compiler('- one\n- two', { overrides: { ul: Ul } })
    const text = extractTextContent(findFirst(result, Ul))
    expect(text).toContain('one')
    expect(text).toContain('two')
  })

  it('fires ol override for ordered lists (outer)', () => {
    const Ol = (props: ViewProps) =>
      React.createElement(View, { ...props, testID: 'ol' })
    const result = compiler('1. one\n2. two', { overrides: { ol: Ol } })
    const text = extractTextContent(findFirst(result, Ol))
    expect(text).toContain('one')
    expect(text).toContain('two')
  })

  it('fires li override for each list row', () => {
    const Li = (props: ViewProps) =>
      React.createElement(View, { ...props, testID: 'li' })
    const result = compiler('- one\n- two\n- three', {
      overrides: { li: Li },
    })
    expect(findAllByType(result, Li).length).toBe(3)
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
      overrides: {
        code: { component: Code, props: { style: { color: 'gold' } } },
      },
      styles: { codeInline: { fontFamily: 'IBM Plex Mono' } },
    })
    const style = getComponentStyle(mustFindFirst(result, Code))
    expect(style.fontFamily).toBe('IBM Plex Mono')
    expect(style.color).toBe('gold')
  })

  it('renders frontmatter as Text-mapped tag when in inline mode so a renderer wrapped in Text does not nest a View (the AST is built directly since the parser would not normally emit frontmatter in inline mode)', () => {
    const ast: MarkdownToJSX.FrontmatterNode[] = [
      { type: RuleType.frontmatter, text: 'title: hi' },
    ]
    const result = astToNative(ast, {
      preserveFrontmatter: true,
      forceInline: true,
    })
    const element = getFirstElement(result)
    expect(isComponentType(element, Text)).toBe(true)
    expect(extractTextContent(element)).toContain('title: hi')
  })

  it('renders block frontmatter as a View holding a Text, with no bare string under a View', () => {
    const result = compiler('---\ntitle: x\n---\n\n# H', {
      preserveFrontmatter: true,
    })
    expect(serialize(result)).toBe(
      '<View><View><Text>---\ntitle: x\n---</Text></View><Text>H</Text></View>'
    )
    expect(bareStringsInView(result)).toEqual([])
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

  it('does not pass DOM-only props to the checkbox View, which draws a checkmark rather than the "[x]" text marker, when no input override is set', () => {
    const result = compiler('- [x] Task')
    const allViews = findAllByType(result, View)
    const taskView = allViews.find(v => extractTextContent(v) === '✓')
    if (!taskView) {
      throw new Error('Expected a task checkbox View')
    }
    expect(taskView.props.type).toBeUndefined()
    expect(taskView.props.checked).toBeUndefined()
    expect(taskView.props.readOnly).toBeUndefined()
  })

  it('task list item wrapper opts into row layout by default, top-aligned so the checkbox lines up with the first line of the label', () => {
    const ul = getFirstElement(compiler('- [x] Task'))
    const li = childElementAt(ul, 0)
    const innerItemView = childElementAt(li, 1)
    const style = getComponentStyle(innerItemView)
    expect(style.flexDirection).toBe('row')
    expect(style.alignItems).toBe('flex-start')
  })

  it('non-task list items flex their content to fill the row width but do not inherit task row defaults, since only tasks get row+center layout', () => {
    const ul = getFirstElement(compiler('- regular item'))
    const li = childElementAt(ul, 0)
    const innerItemView = childElementAt(li, 1)
    const style = getComponentStyle(innerItemView)
    expect(style.flex).toBe(1)
    expect(style.flexDirection).toBeUndefined()
    expect(style.alignItems).toBeUndefined()
  })

  it('consumer styles.listItem overrides task row defaults via mergeStyle, which puts user style last so the user flexDirection wins and the default alignItems is preserved', () => {
    const ul = getFirstElement(
      compiler('- [x] Task', {
        styles: { listItem: { flexDirection: 'column' } },
      })
    )
    const li = childElementAt(ul, 0)
    const innerItemView = childElementAt(li, 1)
    const style = getComponentStyle(innerItemView)
    expect(style.flexDirection).toBe('column')
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

  it.each([
    [
      '>     code\n> para\nlazy',
      '<View><View><Text>code</Text></View><Text>para\nlazy</Text></View>',
    ],
    ['> para\n>     code\nlazy', '<View><Text>para\ncode\nlazy</Text></View>'],
    [
      '> # h\nlazy',
      '<View><View><Text>h</Text></View><Text>lazy</Text></View>',
    ],
    [
      '- # h\nlazy',
      '<View><View><View><Text>• </Text><View><Text>h</Text></View></View></View><Text>lazy</Text></View>',
    ],
    ['> ---\nlazy', '<View><View><View></View></View><Text>lazy</Text></View>'],
    [
      '> ```\n> a\nlazy',
      '<View><View><View><Text>a</Text></View></View><Text>lazy</Text></View>',
    ],
    [
      '- | a | b |\n  | - | - |\nlazy',
      '<View><View><View><Text>• </Text><View><View><View><View><View><Text>a</Text></View><View><Text>b</Text></View></View></View></View></View></View></View><Text>lazy</Text></View>',
    ],
    [
      '> <pre>\nlazy',
      '<View><View><View><Text></Text></View></View><Text>lazy</Text></View>',
    ],
    [
      '- <pre>\nlazy',
      '<View><View><View><Text>• </Text><View><View><Text></Text></View></View></View></View><Text>lazy</Text></View>',
    ],
    [
      '> <div>\nlazy',
      '<View><View><View></View></View><Text>lazy</Text></View>',
    ],
    [
      '- <div>\nlazy',
      '<View><View><View><Text>• </Text><View><View></View></View></View></View><Text>lazy</Text></View>',
    ],
    [
      '- </pre>\nm',
      '<View><View><View><Text>• </Text><View><View></View></View></View></View><Text>m</Text></View>',
    ],
    ['> </pre>\nm', '<View><View><View></View></View><Text>m</Text></View>'],
    [
      '> - a\nlazy',
      '<View><View><View><Text>• </Text><View><Text>a\nlazy</Text></View></View></View></View>',
    ],
    ['> > a\nlazy', '<View><View><Text>a\nlazy</Text></View></View>'],
    ['> f\nbar\n> # x', '<View><Text>f\nbar</Text><Text>x</Text></View>'],
    [
      '- 10. a\n\n      b\nlazy',
      '<View><View><Text>• </Text><View><View><View><Text>10. </Text><View><Text>a</Text><Text>b\nlazy</Text></View></View></View></View></View></View>',
    ],
    [
      '> 1.  one\n>\n>     two\nthree',
      '<View><View><View><Text>1. </Text><View><Text>one</Text><Text>two\nthree</Text></View></View></View></View>',
    ],
    [
      '> [x]: /u\n[y]: /v\n\n[y]',
      '<View><View></View><Text><Text>y</Text></Text></View>',
    ],
  ])('ends or extends a container for the lazy line of %j as %j', (input, expected) => {
    expect(serialize(compiler(input))).toBe(expected)
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

  it.each([
    [
      'keeps a list loose when an HTML block ends at the blank line before a paragraph',
      '- <div>x</div>\n\n  i\n- b',
      '<View><View><Text>• </Text><View><View><Text>x</Text></View><Text>i</Text></View></View><View><Text>• </Text><View><Text>b</Text></View></View></View>',
    ],
    [
      'keeps a list tight when a void tag is followed by a line remainder',
      '- <img src="a.png"> \n  caption\n- b',
      '<View><View><Text>• </Text><View><Text><Image></Image>caption</Text></View></View><View><Text>• </Text><View><Text>b</Text></View></View></View>',
    ],
    [
      'keeps a list tight when a self-closing component is followed by a line remainder',
      '- <MyComponent /> \n  text\n- two',
      '<View><View><Text>• </Text><View><Text><Text></Text>text</Text></View></View><View><Text>• </Text><View><Text>two</Text></View></View></View>',
    ],
  ])('%s', (_name, source, expected) => {
    expect(serialize(compiler(source))).toBe(expected)
  })

  it('keeps an alert when the marker is followed by an ideographic space (native draws no alert header, so the marker line leaving the text is the observable change)', () => {
    expect(serialize(compiler('> [!NOTE]　\n> body'))).toBe(
      '<View><Text>body</Text></View>'
    )
  })

  it.each([
    [
      '-\n  _\n\n  )',
      '<View><View><Text>• </Text><View><Text>_</Text><Text>)</Text></View></View></View>',
    ],
    [
      '-\n\n  -',
      '<View><View><Text>• </Text><View></View></View><View><Text>• </Text><View></View></View></View>',
    ],
    [
      '>a\n-',
      '<View><View><Text>a</Text></View><View><View><Text>• </Text><View></View></View></View></View>',
    ],
  ])('should render the item structure of %j as %j', (input, expected) => {
    expect(serialize(compiler(input))).toBe(expected)
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

  it('strikes through only tilde runs of exactly two', () => {
    expect(
      serialize(compiler('a ~~~c~~~ b ~~~~ ~~d~~~e~~'))
    ).toMatchInlineSnapshot(
      `"<Text>a ~~~c~~~ b ~~~~ <Text>d~~~e</Text></Text>"`
    )
  })

  it.each([
    ['==``==b==`', '<Text>==``<Text>b</Text>`</Text>'],
    ['~~``~~b~~`', '<Text>~~``<Text>b</Text>`</Text>'],
    ['[a ``b](/u) `c', '<Text><Text>a ``b</Text> `c</Text>'],
    ['~~a ~~', '<Text>~~a ~~</Text>'],
    ['~~ a~~', '<Text>~~ a~~</Text>'],
    ['~~a~~~\n~~<', '<Text>~~a~~~\n~~&lt;</Text>'],
    ['a ===c=== b', '<Text>a ===c=== b</Text>'],
    ['==a===b==', '<Text><Text>a===b</Text></Text>'],
    ['==x==', '<Text><Text>x</Text></Text>'],
    ['== x==', '<Text>== x==</Text>'],
    ['a \\==b==', '<Text>a ==b==</Text>'],
    ['~~foo ~~bar baz~~', '<Text>~~foo <Text>bar baz</Text></Text>'],
    ['~~a ~~b~~ c~~', '<Text><Text>a <Text>b</Text> c</Text></Text>'],
    ['==a ==b== c==', '<Text><Text>a <Text>b</Text> c</Text></Text>'],
    ['~~**a**~~', '<Text><Text><Text>a</Text></Text></Text>'],
    ['**~~a~~**', '<Text><Text><Text>a</Text></Text></Text>'],
    ['*~~a*~~', '<Text><Text>~~a</Text>~~</Text>'],
    ['~~*a~~*', '<Text><Text>*a</Text>*</Text>'],
  ])('pairs strikethrough and mark runs like emphasis: %j', (input, expected) => {
    expect(serialize(compiler(input, { forceBlock: true }))).toBe(expected)
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

  it('should render GFM task as View with a drawn checkbox marker, a checkmark for a completed task rather than the "[x]" text marker', () => {
    const result = compiler('- [x] Task')
    const element = getFirstElement(result)
    expect(isComponentType(element, View)).toBe(true)
    const text = extractTextContent(element)
    expect(text).toContain('Task')
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

  it('should accept wrapperProps and merge them onto the wrapper element', () => {
    const result = compiler('Hello\n\nWorld', {
      wrapperProps: { testID: 'markdown-wrapper' },
    })
    const rendered = getFirstElement(result)
    expect(rendered.props.testID).toBe('markdown-wrapper')
  })

  describe('with no styles option', () => {
    function renderMarkdown(
      children: string,
      options?: NativeOptions
    ): React.ReactNode {
      let tree: React.ReactNode = null
      const Capture = () => {
        const rendered = Markdown({ children, options })
        if (rendered instanceof Promise) {
          throw new Error('Expected a synchronous Markdown render')
        }
        tree = rendered
        return null
      }
      renderToStaticMarkup(React.createElement(Capture))
      return tree
    }

    const input =
      '# Title\n\nA paragraph with `code` and a [link](https://a.b).'

    function propShape(tree: React.ReactNode) {
      return treeProps(tree).map(([name, value]) => [
        name,
        typeof value === 'function' ? 'function' : value,
      ])
    }

    it('renders the same tree as the compiler with no styles', () => {
      expect(serialize(renderMarkdown(input))).toBe(serialize(compiler(input)))
      expect(propShape(renderMarkdown(input))).toEqual(
        propShape(compiler(input))
      )
    })

    it('hands every element the same style objects as the compiler with no styles', () => {
      const fromMarkdown = treeProps(renderMarkdown(input))
      const fromCompiler = treeProps(compiler(input))

      expect(fromMarkdown.length).toBe(fromCompiler.length)
      fromMarkdown.forEach(([name, value], index) => {
        if (name === 'style') {
          expect(value).toBe(fromCompiler[index][1])
        }
      })
    })

    it.each([
      ['the compiler', (options: NativeOptions) => compiler(input, options)],
      ['Markdown', (options: NativeOptions) => renderMarkdown(input, options)],
    ])('hands %s the same style objects for an empty styles object as for no styles', (_name, renderWith) => {
      const styleValues = (tree: React.ReactNode) =>
        treeProps(tree)
          .filter(([name]) => name === 'style')
          .map(([, value]) => value)
      const withEmptyStyles = styleValues(renderWith({ styles: {} }))
      const withoutStyles = styleValues(compiler(input))

      expect(withEmptyStyles.length).toBe(withoutStyles.length)
      withEmptyStyles.forEach((value, index) => {
        expect(value).toBe(withoutStyles[index])
      })
    })

    it('renders the same tree for an empty styles object as for no styles', () => {
      expect(propShape(renderMarkdown(input, { styles: {} }))).toEqual(
        propShape(compiler(input))
      )
    })
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
    const onLinkPress = mock((_url: string) => {})
    const onLinkLongPress = mock((_url: string) => {})
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
    const longUrl = `https://example.com/${'a'.repeat(200)}?param=${'b'.repeat(200)}`
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
  it('applies styles.text under paragraph, list item, table cell, and heading text, with the base fontSize showing through only where the element sets none (list item, table cell) while a heading or paragraph keeps its own size from the cascade', () => {
    const md =
      '# Heading\n\nParagraph text.\n\n- List item\n\n| Col |\n|-----|\n| Cell |\n'
    const result = compiler(md, {
      styles: { text: { color: 'red', fontSize: 18 } },
    })
    for (const content of ['Heading', 'Paragraph text.', 'List item', 'Cell']) {
      expect(getComponentStyle(findTextByContent(result, content)).color).toBe(
        'red'
      )
    }
    expect(
      getComponentStyle(findTextByContent(result, 'List item')).fontSize
    ).toBe(18)
    expect(getComponentStyle(findTextByContent(result, 'Cell')).fontSize).toBe(
      18
    )
  })

  it('leaves output unchanged when styles.text is unset', () => {
    const style = getComponentStyle(
      getFirstElement(compiler('Paragraph text.', { forceBlock: true }))
    )
    expect(style.color).toBeUndefined()
  })

  it('lets an element style win over the text base on conflict, so a heading with no color of its own shows the base color while keeping its default-cascade fontSize', () => {
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
  it('renders bold header text, header cells with equal flex and a vertical divider on all but the last, a separator under the header row and under all but the last body row, and flex:1 body cells that align across rows', () => {
    const result = compiler('| A | B |\n|---|---|\n| c | d |\n| e | f |\n')
    const table = getFirstElement(result)

    expect(getComponentStyle(findTextByContent(result, 'A')).fontWeight).toBe(
      'bold'
    )
    expect(getComponentStyle(findTextByContent(result, 'B')).fontWeight).toBe(
      'bold'
    )

    const headerRow = childElementAt(childElementAt(table, 0), 0)
    expect(getComponentStyle(headerRow).borderBottomWidth).toBe(1)
    const headerA = childElementAt(headerRow, 0)
    const headerB = childElementAt(headerRow, 1)
    expect(getComponentStyle(headerA).flex).toBe(1)
    expect(getComponentStyle(headerB).flex).toBe(1)
    expect(getComponentStyle(headerA).borderRightWidth).toBe(1)
    expect(
      headerB.props.style && flattenStyle(headerB.props.style).borderRightWidth
    ).toBeUndefined()

    const body = childElementAt(table, 1)
    const row0 = childElementAt(body, 0)
    const row1 = childElementAt(body, 1)
    expect(getComponentStyle(row0).borderBottomWidth).toBe(1)
    expect(
      row1.props.style && flattenStyle(row1.props.style).borderBottomWidth
    ).toBeUndefined()
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

  it.each([
    ['`a| b |\n|---|', '<Text>`a| b |\n|---|</Text>'],
    ['`|]\n-', '<Text>`|]</Text>'],
  ])('renders %j, a delimiter row with the wrong cell count, as %j', (input, expected) => {
    expect(serialize(compiler(input))).toBe(expected)
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
  it('should handle override that returns null, leaving the null-returning function as the element type', () => {
    const nullFn = () => null
    const result = compiler('Hello', {
      forceBlock: true,
      overrides: { p: nullFn },
    })
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

  it('should handle nested overrides, where the top-level htmlBlock has no paragraph wrapper so the first element is the Accordion itself and AccordionItem is its first child', () => {
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
    const element = getFirstElement(result)
    expect(element.type).toBe(Accordion)
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
    const CustomText = ({
      ref,
      ...props
    }: TextProps & { ref?: React.RefObject<Text | null> }) =>
      React.createElement(Text, { ...props, ref })
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
  it('should map unsupported HTML block tags to View, a forwardRef component', () => {
    const result = compiler('<div>Content</div>', {
      forceBlock: true,
      tagfilter: false,
    })
    const element = getFirstElement(result)
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

  it.each([
    ['x<span></span></span', '<Text>x<Text></Text>&lt;/span</Text>'],
    ['x<div></div></div', '<Text>x<View></View>&lt;/div</Text>'],
    ['x<Foo></Foo></Foo', '<Text>x<Text></Text>&lt;/Foo</Text>'],
  ])('leaves the second closer of %j as text', (input, expected) => {
    expect(serialize(compiler(input))).toBe(expected)
  })

  it.each([
    '<!--@/>',
    '<!A[@e>',
  ])('renders %j as a raw block, which writes no markup', markup => {
    expect(serialize(compiler(markup, { forceBlock: true }))).toBe('')
  })

  it('renders the children of a stored block with its private fields dropped', () => {
    expect(
      serialize(
        astToNative(
          storedAST('<div>\n  <div/>\n  <span>content</span>\n</div>')
        )
      )
    ).toBe('<View><View></View><Text><Text>content</Text></Text></View>')
  })
})

describe('footnotes', () => {
  it('should render plain text footnote content wrapped in Text component so React Native does not throw "Text strings must be rendered within a Text component"', () => {
    const result = compiler('foo[^1] bar\n\n[^1]: Simple text')
    const textContent = extractTextContent(result)
    expect(textContent).toContain('Simple text')
    expect(() => {
      const element = getFirstElement(result)
      expect(element).toBeDefined()
    }).not.toThrow()
  })

  function findMarker(
    node: React.ReactNode,
    out: TestElement[] = []
  ): TestElement[] {
    if (Array.isArray(node)) {
      node.forEach(child => findMarker(child, out))
      return out
    }
    if (!isTestElement(node)) {
      return out
    }
    if (node.props?.onPress != null) {
      out.push(node)
    }
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

  it('applies styles.footnote to the marker, which carries the styles.text base plus the footnote override so the flattened style includes the red color', () => {
    const marker = findMarker(
      compiler('a[^1]\n\n[^1]: note', {
        styles: { footnote: { color: 'red' } },
      })
    )[0]
    expect(getComponentStyle(marker)).toMatchObject({ color: 'red' })
  })

  function findFootnoteFooterEntry(result: React.ReactNode): TestElement {
    const outer = getFirstElement(result)
    const kids = Array.isArray(outer.props.children)
      ? outer.props.children
      : [outer.props.children]
    const footer = kids.find(k => isTestElement(k) && k.key === 'footer')
    if (!isTestElement(footer)) {
      throw new Error('No footnote footer View')
    }
    return childElementAt(footer, 0)
  }

  it('renders an all-inline note footer entry as one line in a Text', () => {
    const entry = findFootnoteFooterEntry(compiler('a[^1]\n\n[^1]: The note.'))
    expect(isComponentType(entry, Text)).toBe(true)
    expect(extractTextContent(entry)).toContain('The note.')
  })

  it('renders a note footer entry holding a block (an image) stacked as a View, since a Text cannot nest a view (issue #884)', () => {
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
  it('should not mutate options object when calling astToNative multiple times, so a memoized options object reused across calls has no side effects', () => {
    const markdown = '# Hello world'
    const ast = parser(markdown)
    const options: NativeOptions = {
      slugify: (input: string) => input.toLowerCase(),
    }
    const originalOverrides = options.overrides

    astToNative(ast, options)

    expect(options.overrides).toBe(originalOverrides)

    astToNative(ast, options)

    expect(options.overrides).toBe(originalOverrides)
  })

  it('should not mutate options object when calling compiler multiple times', () => {
    const markdown = '# Hello world'
    const options: NativeOptions = {
      slugify: (input: string) => input.toLowerCase(),
    }
    const originalOverrides = options.overrides

    compiler(markdown, options)

    expect(options.overrides).toBe(originalOverrides)

    compiler(markdown, options)

    expect(options.overrides).toBe(originalOverrides)
  })
})

describe('MarkdownProvider and MarkdownContext', () => {
  it('should export MarkdownProvider', () => {
    const { MarkdownProvider } = require('./native.tsx')
    expect(typeof MarkdownProvider).toBe('function')
  })

  it('should export MarkdownContext', () => {
    const { MarkdownContext } = require('./native.tsx')
    expect(MarkdownContext).toBeDefined()
    expect(typeof MarkdownContext.Provider).toBe('object')
  })

  it('should export MarkdownProvider and MarkdownContext together (full context testing requires a React renderer)', () => {
    const { MarkdownProvider, MarkdownContext } = require('./native.tsx')
    expect(MarkdownProvider).toBeDefined()
    expect(MarkdownContext).toBeDefined()
  })
})

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
  if ('name' in t && typeof t.name === 'string' && t.name) {
    return t.name
  }
  return '?'
}

function serialize(el: React.ReactNode): string {
  if (el === null || typeof el === 'boolean') {
    return ''
  }
  if (typeof el === 'string' || typeof el === 'number') {
    return escapeText(String(el))
  }
  if (Array.isArray(el)) {
    return el.map(serialize).join('')
  }
  if (!isTestElement(el)) {
    return ''
  }
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
    ).toMatchInlineSnapshot(
      `"<View><View><Text>a</Text></View><Text> x </Text></View>"`
    )
  })

  it('text line after a nested paragraph is preserved', () => {
    expect(
      serialize(compiler('<div>\n<p>a</p>\nx\n</div>'))
    ).toMatchInlineSnapshot(
      `"<View><Text><Text>a</Text><Text> x </Text></Text></View>"`
    )
  })

  it('markdown in the trailing text line is processed', () => {
    expect(
      serialize(
        compiler('<details>\n<summary>a</summary>\n**bold** text\n</details>')
      )
    ).toMatchInlineSnapshot(
      `"<View><View><Text>a</Text></View><Text><Text>bold</Text> text </Text></View>"`
    )
  })

  it('text line between nested paragraphs is preserved', () => {
    expect(
      serialize(compiler('<div>\n<p>a</p>\nx\n<p>b</p>\n</div>'))
    ).toMatchInlineSnapshot(
      `"<View><Text><Text>a</Text><Text> x <Text>b</Text></Text></Text></View>"`
    )
  })

  it('text after the element own closing tag renders as a sibling', () => {
    expect(
      serialize(compiler('<div>\n<span>a</span>\n</div>\ntail'))
    ).toMatchInlineSnapshot(
      `"<View><Text><Text>a</Text></Text></View><Text> tail</Text>"`
    )
  })

  const mixedBlocks: [string, string][] = [
    ['paragraphs around text', '<div>\n<p>a</p>\nx\n<p>b</p>\n</div>'],
    ['paragraph then text', '<div>\n<p>a</p>\nx\n</div>'],
    ['text after closing tag', '<div>\n<p>a</p>\nx\n<p>b</p>\n</div>\ntail'],
  ]
  mixedBlocks.forEach(([name, md]) => {
    it(`assigns unique sibling keys, since the element and its trailing siblings share one Fragment and React warns on duplicate keys: ${name}`, () => {
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

function duplicateSiblingKeys(
  el: React.ReactNode,
  out: string[] = []
): string[] {
  if (!isTestElement(el)) {
    if (Array.isArray(el)) {
      el.forEach(child => duplicateSiblingKeys(child, out))
    }
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
      if (count > 1) {
        out.push(key)
      }
    }
  }
  React.Children.toArray(children).forEach(child =>
    duplicateSiblingKeys(child, out)
  )
  return out
}

function bareStringsInView(
  el: React.ReactNode,
  inView = false,
  out: string[] = []
): string[] {
  if (el === null || typeof el === 'boolean') {
    return out
  }
  if (typeof el === 'string' || typeof el === 'number') {
    if (inView && String(el).length > 0) {
      out.push(String(el))
    }
    return out
  }
  if (Array.isArray(el)) {
    el.forEach(c => bareStringsInView(c, inView, out))
    return out
  }
  if (!isTestElement(el)) {
    return out
  }
  const t: unknown = el.type
  bareStringsInView(el.props.children, t === View || t === Image, out)
  return out
}

function viewsInText(
  el: React.ReactNode,
  inText = false,
  out: string[] = []
): string[] {
  if (!isTestElement(el)) {
    if (Array.isArray(el)) {
      el.forEach(c => viewsInText(c, inText, out))
    }
    return out
  }
  const t: unknown = el.type
  const isView = t === View || t === Image
  if (isView && inText) {
    out.push(t === Image ? 'Image' : 'View')
  }
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

  it('renders a block-container HTML tag (a definition list, dl/dt/dd) as a View whose text children are wrapped in Text, not inline Text, which would lay them out inline', () => {
    expect(
      serialize(compiler('<dl><dt>term</dt><dd>def</dd></dl>\n'))
    ).toContain('<View>')
    expect(
      bareStringsInView(compiler('<dl><dt>term</dt><dd>def</dd></dl>\n'))
    ).toEqual([])
  })

  it('degrades a paragraph with an image to a View, keeping text runs', () => {
    expect(
      serialize(compiler('see ![a](https://x.com/i.png) here\n'))
    ).toMatchInlineSnapshot(
      `"<View><Text>see </Text><Image></Image><Text> here</Text></View>"`
    )
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
    ).toMatchInlineSnapshot(
      `"<View><View><Text>1. </Text><View><Text>First <Text>bold</Text> item</Text></View></View></View>"`
    )
  })

  it('keeps leading text and a nested list as sibling children', () => {
    expect(serialize(compiler('- top\n  - nested\n'))).toMatchInlineSnapshot(
      `"<View><View><Text>• </Text><View><Text>top</Text><View><View><Text>• </Text><View><Text>nested</Text></View></View></View></View></View></View>"`
    )
  })

  it('renders a task checkbox (an empty View when unchecked, a checkmark inside the box when checked) and its label as siblings, with no bullet and no leading space in the label Text since the whitespace-only text node after the task marker is dropped and the checkbox margin is the only gap', () => {
    expect(serialize(compiler('- [ ] todo\n'))).toMatchInlineSnapshot(
      `"<View><View><View><View></View><Text>todo</Text></View></View></View>"`
    )
    expect(serialize(compiler('- [x] done\n'))).toMatchInlineSnapshot(
      `"<View><View><View><View><Text>✓</Text></View><Text>done</Text></View></View></View>"`
    )
  })

  it('keeps a task marker as text unless whitespace and content follow it', () => {
    expect(
      serialize(compiler('- [x]foo\n- [ ] \n- [x] baz'))
    ).toMatchInlineSnapshot(
      `"<View><View><Text>• </Text><View><Text>[x]foo</Text></View></View><View><Text>• </Text><View><Text>[ ]</Text></View></View><View><View><View><Text>✓</Text></View><Text>baz</Text></View></View></View>"`
    )
  })

  it('keeps a content tab inside a quote or list item, and drops a code span continuation line indent', () => {
    expect(
      serialize(compiler('> ```\n> a\tb\n> ```\n\n- `a\tb`\n\n``a\n b``'))
    ).toMatchInlineSnapshot(
      `"<View><View><View><Text>a	b</Text></View></View><View><View><Text>• </Text><View><Text><Text>a	b</Text></Text></View></View></View><Text><Text>a b</Text></Text></View>"`
    )
  })

  it('reads a tab in a quote or list item as whitespace around a link title, a closing heading sequence, and a soft break, and as content in indented code', () => {
    expect(
      serialize(
        compiler('> [a](/u\t"t")\n\n- # x #\t\n\n> a\t\n> b\n\n>     -\tfoo')
      )
    ).toMatchInlineSnapshot(`
      "<View><View><Text><Text>a</Text></Text></View><View><View><Text>• </Text><View><Text>x</Text></View></View></View><View><Text>a
      b</Text></View><View><View><Text>-	foo</Text></View></View></View>"
    `)
  })

  it('keeps the rest of a task marker line as text, never a block', () => {
    expect(
      serialize(compiler('- [x] # heading\n- [x] > quote'))
    ).toMatchInlineSnapshot(
      `"<View><View><View><View><Text>✓</Text></View><Text># heading</Text></View></View><View><View><View><Text>✓</Text></View><Text>&gt; quote</Text></View></View></View>"`
    )
  })

  it('wraps table cell content in a Text', () => {
    expect(
      serialize(compiler('| a |\n|---|\n| c *i* |\n'))
    ).toMatchInlineSnapshot(
      `"<View><View><View><View><Text>a</Text></View></View></View><View><View><View><Text>c <Text>i</Text></Text></View></View></View></View>"`
    )
  })
})

describe('streaming table suppression', () => {
  const docs: Record<string, string> = {
    'single column': 'text\n\n| Only |\n| --- |\n| a |\n',
    'table after paragraph':
      'Here is a table:\n\n| Name | Age |\n| --- | --- |\n| Ann | 30 |\n\nDone.',
    'table at start': '| A | B |\n| --- | --- |\n| 1 | 2 |\n',
  }
  for (const [name, doc] of Object.entries(docs)) {
    it(`never flashes raw pipes while streaming, with each document fed one character at a time (the strictest superset of any token boundary an LLM could stream) through the native input path: ${name}`, () => {
      for (let n = 1; n <= doc.length; n++) {
        const text = extractTextContent(
          compiler(doc.slice(0, n), { optimizeForStreaming: true })
        )
        expect({ prefixLength: n, text }).toEqual({
          prefixLength: n,
          text: expect.not.stringContaining('|'),
        })
      }
    })
  }

  it('renders the complete table once the final row arrives', () => {
    const rendered = serialize(
      compiler('| A | B |\n| --- | --- |\n| 1 | 2 |', {
        optimizeForStreaming: true,
      })
    )
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
  const firstStyleWith = (
    tree: React.ReactNode,
    prop: string
  ): Record<string, unknown> => {
    for (const el of allElements(tree)) {
      if (el.props.style) {
        const flat = flattenStyle(el.props.style)
        if (prop in flat) {
          return flat
        }
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
      compiler('- item\n', {
        styles: { listItemBullet: { color: '#00ff00' } },
      }),
      '• '
    )
    const style = getComponentStyle(bullet)
    expect(style.fontSize).toBe(16)
    expect(style.color).toBe('#00ff00')
  })

  it('listItemNumber styles the ordered marker over its default size', () => {
    const number = findTextByContent(
      compiler('1. item\n', {
        styles: { listItemNumber: { color: '#00ff00' } },
      }),
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
    if (!bq) {
      throw new Error('no blockquote element')
    }
    const kids = Array.isArray(bq.props.children)
      ? bq.props.children
      : [bq.props.children]
    const last = kids.filter(isTestElement).pop()
    if (!last) {
      throw new Error('no block child in blockquote')
    }
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

describe('unique heading IDs (#857)', () => {
  it('renders duplicate headings without id props, since React Native has no heading id attribute surface and the full element tree is asserted instead', () => {
    expect(
      serialize(
        compiler(`# Foo

# Bar

## Foo`)
      )
    ).toMatchInlineSnapshot(
      `"<View><Text>Foo</Text><Text>Bar</Text><Text>Foo</Text></View>"`
    )
  })

  it('renders a link-in-heading from text content without crashing (native emits no id, so the visible text is asserted to match the slug source)', () => {
    expect(extractTextContent(compiler('## [text](https://e.com)'))).toBe(
      'text'
    )
  })

  it('renders a heading with accented Latin letters and ß as its text (native emits no id, so the folded slug does not apply)', () => {
    expect(extractTextContent(compiler('# Öl Straße\n\n# Łódź'))).toBe(
      'Öl StraßeŁódź'
    )
  })

  it.each([
    ['# !!!', '!!!'],
    ['# `]`', ']'],
  ])('renders %j, a heading with an empty slug, as text %j (native emits no id, so the same inputs as the id-omission tests are asserted to still render their text)', (input, text) => {
    expect(extractTextContent(compiler(input))).toBe(text)
  })
})

describe('destination entity decode before sanitize', () => {
  function hasOnPress(node: React.ReactNode): boolean {
    if (!isTestElement(node)) {
      if (Array.isArray(node)) {
        return node.some(hasOnPress)
      }
      return false
    }
    if (node.props?.onPress != null) {
      return true
    }
    return hasOnPress(node.props?.children as React.ReactNode)
  }

  it('drops press handlers for entity-obfuscated javascript: links', () => {
    const result = compiler('[x](&#106;avascript:alert(1))')
    expect(extractTextContent(result)).toBe('x')
    expect(hasOnPress(result)).toBe(false)
  })

  const imageSources = (md: string) =>
    treeProps(compiler(md))
      .filter(([name]) => name === 'source')
      .map(([, value]) => value)

  it('percent-encodes a control character in an image uri', () => {
    expect(imageSources('![x](java\u0001script:alert(1))')).toEqual([
      { uri: 'java%01script:alert(1)' },
    ])
    expect(imageSources('![x](java&#1;script:alert(1))')).toEqual([
      { uri: 'java%01script:alert(1)' },
    ])
  })

  it.each([
    ['tab in an angle-bracket destination', '![x](<java\tscript:alert(1)>)'],
    ['tab entity', '![x](java&#9;script:alert(1))'],
    ['newline entity', '![x](java&#10;script:alert(1))'],
    ['percent tab, mixed case', '![x](JaVa%09ScRiPt:alert(1))'],
    ['percent control character', '![x](java%01script:alert(1))'],
    ['percent letter', '![x](java%73cript:alert(1))'],
  ])('drops an image whose stripped form is a dangerous scheme: %s', (_, input) => {
    expect(imageSources(input)).toEqual([])
  })

  it('keeps and encodes a safe image uri', () => {
    expect(imageSources('![x](https://a.b/c.png)')).toEqual([
      { uri: 'https://a.b/c.png' },
    ])
    expect(imageSources('![x](<a b.png>)')).toEqual([{ uri: 'a%20b.png' }])
  })

  it.each([
    ['0;url=javascript:alert(1)'],
    ['0;URL=javascript:alert(1)'],
    ["0; url = 'javascript:alert(1)'"],
    ['0;url=&#106;avascript:alert(1)'],
    ['0;url=java%73cript:alert(1)'],
    ['0;url=data:text/html,x'],
    ['0;javascript:alert(1)'],
  ])('strips a meta refresh content whose URL is dangerous: %s', content => {
    expect(
      treeProps(compiler(`<meta http-equiv="refresh" content="${content}">`))
    ).toEqual([['http-equiv', 'refresh']])
  })

  it('keeps a meta refresh content whose URL is safe', () => {
    expect(
      treeProps(
        compiler('<meta http-equiv="refresh" content="0;url=https://x.y">')
      )
    ).toEqual([
      ['http-equiv', 'refresh'],
      ['content', '0;url=https://x.y'],
    ])
  })

  it('re-sanitizes direct astToNative link targets before press handlers', () => {
    expect(
      hasOnPress(
        astToNative([
          {
            type: RuleType.link,
            target: 'javascript:alert(1)',
            children: [{ type: RuleType.text, text: 'x' }],
          },
        ])
      )
    ).toBe(false)
  })
})

describe('inline Type 1 content with tagfilter off', () => {
  it('preserves single-line script content including forceInline', () => {
    expect(
      extractTextContent(compiler('<script>x</script>', { tagfilter: false }))
    ).toBe('x')
    expect(
      extractTextContent(
        compiler('<script>x</script>', { tagfilter: false, forceInline: true })
      )
    ).toBe('x')
  })

  it('shows a textarea body, markup included, as text', () => {
    expect(
      extractTextContent(
        compiler('<textarea><b>x</b> &amp;</textarea>', { tagfilter: false })
      )
    ).toBe('<b>x</b> &')
  })

  it('shows the body of a textarea written in capitals', () => {
    expect(
      extractTextContent(
        compiler('<TEXTAREA>a &lt; b</TEXTAREA>', { tagfilter: false })
      )
    ).toBe('a < b')
  })
})

describe('component-like HTML blank-line nesting (#870)', () => {
  it('keeps blank-line component content in one native tree', () => {
    expect(
      serialize(
        compiler(`<MyComponent>
## My header

Some paragraph
</MyComponent>`)
      )
    ).toMatchInlineSnapshot(
      `"<View><Text>My header</Text><Text>Some paragraph</Text></View>"`
    )
  })
})

describe('tagfilter escapes dangerous tags by default', () => {
  it('escapes script with default options via compiler()', () => {
    expect(extractTextContent(compiler('<script>alert(1)</script>'))).toBe(
      '<script>alert(1)</script>'
    )
  })

  it('escapes dangerous tags by default via astToNative()', () => {
    expect(
      extractTextContent(astToNative(parser('<script>alert(1)</script>')))
    ).toBe('<script>alert(1)</script>')
  })

  it('passes dangerous tags through only when tagfilter is explicitly disabled', () => {
    expect(
      extractTextContent(compiler('<script>x</script>', { tagfilter: false }))
    ).toBe('x')
  })
})

describe('prototype-slot reference labels (#900)', () => {
  it('does not crash on undefined __proto__ or constructor shortcut refs', () => {
    expect(() => compiler('[__proto__]')).not.toThrow()
    expect(extractTextContent(compiler('[__proto__]'))).toBe('[proto]')
    expect(() => compiler('[constructor]')).not.toThrow()
    expect(extractTextContent(compiler('[constructor]'))).toBe('[constructor]')
  })

  it('resolves __proto__ and constructor reference definitions', () => {
    const onLinkPress = mock((_url: string) => {})

    const proto = compiler('[__proto__]: /x\n\n[__proto__]', { onLinkPress })
    expect(extractTextContent(proto)).toBe('proto')
    const protoLink = findLinkElement(getFirstElement(proto))
    const protoPress = protoLink.props.onPress
    if (typeof protoPress !== 'function') {
      throw new Error('Expected proto link onPress handler')
    }
    protoPress()
    expect(onLinkPress).toHaveBeenCalledWith('/x', undefined)

    onLinkPress.mockClear()
    const ctor = compiler('[constructor]: /y\n\n[constructor]', { onLinkPress })
    expect(extractTextContent(ctor)).toBe('constructor')
    const ctorLink = findLinkElement(getFirstElement(ctor))
    const ctorPress = ctorLink.props.onPress
    if (typeof ctorPress !== 'function') {
      throw new Error('Expected constructor link onPress handler')
    }
    ctorPress()
    expect(onLinkPress).toHaveBeenCalledWith('/y', undefined)
  })
})

describe('optimizeForStreaming keeps literal delimiters', () => {
  it('removes only the genuinely unclosed emphasis opener on the last line and keeps literal `_` and `*` in finished text (issue #905)', () => {
    expect(
      serialize(
        compiler(
          'pass *args and **kwargs\n\ncustomer_id and `customer_id`\n\nSELECT * FROM t WHERE 2*3=6\n\nhttps://example.com/a_b and <https://example.com/c_d>\n\n**held',
          { optimizeForStreaming: true }
        )
      )
    ).toMatchInlineSnapshot(
      `"<View><Text>pass *args and **kwargs</Text><Text>customer_id and <Text>customer_id</Text></Text><Text>SELECT * FROM t WHERE 2*3=6</Text><Text><Text>https://example.com/a_b</Text> and <Text>https://example.com/c_d</Text></Text><Text>held</Text></View>"`
    )
  })

  it('hides a never-closed opener while the option is on, since the parser cannot tell a streaming edge from finished text, and shows it as written in the final render with the option off (issue #909)', () => {
    const md = 'Use _trace and *args'
    expect(
      serialize(compiler(md, { optimizeForStreaming: true }))
    ).toMatchInlineSnapshot(`"<Text>Use trace and args</Text>"`)
    expect(
      serialize(compiler(md, { optimizeForStreaming: false }))
    ).toMatchInlineSnapshot(`"<Text>Use _trace and *args</Text>"`)
  })

  it('keeps complete raw HTML, and incomplete-looking links and code in a block that is no longer the last one, rendering exactly as without the option', () => {
    const md = 'a <span>z</span> <br> b\n\nsee [a](b and `code\n\nlast'
    const streamed = serialize(compiler(md, { optimizeForStreaming: true }))
    expect(streamed).toBe(serialize(compiler(md)))
    expect(streamed).toMatchInlineSnapshot(
      `"<View><Text>a <Text>z</Text> <Text></Text> b</Text><Text>see [a](b and \`code</Text><Text>last</Text></View>"`
    )
  })
})

describe('optimizeForStreaming preserves literal less-than', () => {
  it('keeps comparison prose in block and forceInline modes', () => {
    expect(
      extractTextContent(
        compiler('5 < 3 is false', { optimizeForStreaming: true })
      )
    ).toBe('5 < 3 is false')
    expect(
      extractTextContent(
        compiler('5 < 3 is false', {
          optimizeForStreaming: true,
          forceInline: true,
        })
      )
    ).toBe('5 < 3 is false')
  })

  it('defers incomplete tag prefixes without dropping prior text', () => {
    expect(
      extractTextContent(
        compiler('Hello <Citation', { optimizeForStreaming: true })
      )
    ).toBe('Hello ')
  })

  it('reads a closing tag after an unfinished opener the way a full parse does', () => {
    expect(
      serialize(compiler('x <Comp </b>y', { optimizeForStreaming: true }))
    ).toBe('<Text>x &lt;Comp <Text></Text>y</Text>')
  })
})

describe('inline HTML keeps the spaces at the edges of its content (#904)', () => {
  it.each([
    ['a<span> b </span>c', '<Text>a<Text> b </Text>c</Text>'],
    ['<b>bold </b>next', '<Text><Text>bold </Text>next</Text>'],
    ['<span> </span>', '<Text><Text> </Text></Text>'],
    ['<span> x </span>', '<Text><Text> x </Text></Text>'],
    [
      'a<span> <em>x</em> </span>b',
      '<Text>a<Text> <Text>x</Text> </Text>b</Text>',
    ],
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
    [undefined, '#heading', '<Text>#heading</Text>'],
    [true, '#heading', '<Text>#heading</Text>'],
    [false, '#heading', '<Text>heading</Text>'],
    [undefined, '# heading', '<Text>heading</Text>'],
    [true, '# heading', '<Text>heading</Text>'],
    [false, '# heading', '<Text>heading</Text>'],
    [undefined, 'foo\n#bar', '<Text>foo\n#bar</Text>'],
    [true, 'foo\n#bar', '<Text>foo\n#bar</Text>'],
    [false, 'foo\n#bar', '<View><Text>foo</Text><Text>bar</Text></View>'],
    [false, '#######x', '<Text>#######x</Text>'],
    [undefined, 'a<span>#</span>b', '<Text>a<Text>#</Text>b</Text>'],
    [false, 'a<span>#</span>b', '<Text>a<Text>#</Text>b</Text>'],
    [undefined, '<div>\n#x\n</div>', '<View><Text>#x</Text></View>'],
    [false, '<div>\n#x\n</div>', '<View><Text>x</Text></View>'],
  ])('with enforceAtxHeadings %j renders %j as %j', (enforceAtxHeadings, input, expected) => {
    expect(serialize(compiler(input, { enforceAtxHeadings }))).toBe(expected)
  })
})

const handlerProps = (el: React.ReactNode) =>
  treeProps(el)
    .filter(
      ([name]) => name.toLowerCase().startsWith('on') && name !== 'onPress'
    )
    .map(([name, value]) => `${name}=${typeof value}`)

const propNames = (el: React.ReactNode) =>
  treeProps(el)
    .map(([name]) => name)
    .filter(name => name !== 'style' && name !== 'onPress')

describe('attribute names a renderer acts on rather than writes', () => {
  it('passes a name that ends in a colon on as written', () => {
    const result = compiler('<span a:="1">b</span>')

    expect(serialize(result)).toBe('<Text>b</Text>')
    expect(propNames(result)).toEqual(['a:'])
  })

  it('removes an object children value from a registered tag', () => {
    const result = compiler('<Foo children={{"a":1}}>y</Foo>', {
      overrides: { Foo: { props: {} } },
    })

    expect(serialize(result)).toBe('<Text>y</Text>')
    expect(propNames(result)).toEqual([])
  })

  it.each([
    [
      '<div innerHTML="x<img src=x onerror=alert(1)>">y</div>',
      '<View><Text>y</Text></View>',
    ],
    [
      '<div prop:innerHTML="x<img src=x onerror=alert(1)>">y</div>',
      '<View><Text>y</Text></View>',
    ],
    ['<div attr:onclick="alert(1)">y</div>', '<View><Text>y</Text></View>'],
    ['<a attr:href="javascript:alert(1)">y</a>', '<Text>y</Text>'],
    ['<a prop:href="javascript:alert(1)">y</a>', '<Text>y</Text>'],
    [
      '<svg><a xlinkHref="javascript:alert(1)"><text>y</text></a></svg>',
      '<Text><Text><Text>y</Text></Text></Text>',
    ],
    ['<div ref="x">y</div>', '<View><Text>y</Text></View>'],
    ['<div ref={{"current":1}}>y</div>', '<View><Text>y</Text></View>'],
    [
      '<div dangerouslySetInnerHTML={{"__html":"<img src=x onerror=alert(1)>"}}></div>',
      '<View></View>',
    ],
  ])('renders %j with no prop, as %j (a native view has no innerHTML or DOM attributes, so these names leave the props, and a ref string throws here as it does on the web)', (input, expected) => {
    const result = compiler(input)
    expect(serialize(result)).toBe(expected)
    expect(propNames(result)).toEqual([])
  })

  it('renders no text for a brace value holding markup on a self-closing tag while streaming', () => {
    expect(
      serialize(
        compiler(
          '<A dangerouslySetInnerHTML={{__html: "<img src=x onerror=alert(1)>"}} />',
          { optimizeForStreaming: true }
        )
      )
    ).toBe('<Text></Text>')
  })

  it.each([
    [
      '<svg><a><set attributeName="href" to="javascript:alert(1)"/><rect/></a></svg>',
      '<Text><Text><Text></Text><Text></Text></Text></Text>',
      ['to'],
    ],
    [
      '<svg><a><animate attributeName="&#104;ref" values="javascript:alert(1)"/></a></svg>',
      '<Text><Text><Text></Text></Text></Text>',
      ['values'],
    ],
    [
      'x <svg><a><set attributename="xlink:href" to="javascript:alert(1)"/></a></svg>',
      '<Text>x <Text><Text><Text></Text></Text></Text></Text>',
      ['to'],
    ],
    [
      '<svg><a><set attributeName={href} to="javascript:alert(1)"/></a></svg>',
      '<Text><Text><Text></Text></Text></Text>',
      ['to'],
    ],
    [
      '<svg><g><animate attributeName="opacity" values="0;1"/></g></svg>',
      '<Text><Text><Text></Text></Text></Text>',
      ['attributeName', 'values'],
    ],
    ['<Btn action={javascript:alert(1)}>x</Btn>', '<Text>x</Text>', []],
    ['<Btn srcDoc={"<script>alert(1)</script>"}>x</Btn>', '<Text>x</Text>', []],
    ['<Btn attributeName={href}>x</Btn>', '<Text>x</Text>', []],
    [
      '<Btn attributeName={opacity}>x</Btn>',
      '<Text>x</Text>',
      ['attributeName'],
    ],
    ['<Btn href={link}>x</Btn>', '<Text>x</Text>', ['href']],
    [
      '<!-- c --> <script>alert(1)</script>',
      '<Text> <Text>&lt;script&gt;alert(1)&lt;/script&gt;</Text></Text>',
      [],
    ],
    [
      '- a <!-- c --> <script>alert(1)</script>',
      '<View><View><Text>• </Text><View><Text>a  </Text><Text>&lt;script&gt;alert(1)&lt;/script&gt;</Text></View></View></View>',
      [],
    ],
    ['<!-- <script> -->', '', []],
    ['<p><? a\n\n<!-- x><script>alert(1)</script>', '<Text></Text>', []],
    [
      '<p><? a\n\n<div title="x><script>alert(1)</script>">body</div>',
      '<View><Text></Text><View><Text>body</Text></View></View>',
      ['title'],
    ],
    [
      '<p><!-- a\n\nb <br title="--><script>alert(1)</script>"> c',
      '<View><Text></Text><Text>b <Text></Text> c</Text></View>',
      ['title'],
    ],
    [
      '<div x={a><script>alert(1)</script>}>y</div>',
      '<View><Text>y</Text></View>',
      ['x'],
    ],
  ])('renders %j as %j, with props %j (a native view has no SVG animation, no link target from an attribute, and no markup reader; a filtered tag is a text node the serializer writes escaped, a block left open before raw markup has no browser reading to confuse, and a prop value is written whole so no tag starts inside it)', (input, expected, props) => {
    const result = compiler(input)
    expect(serialize(result)).toBe(expected)
    expect(propNames(result)).toEqual(props)
  })

  it('drops a brace srcDoc and a brace attributeName naming a link from a tag an override renders as an element', () => {
    const result = compiler(
      '<Card srcDoc={"<script>alert(1)</script>"} attributeName={href} title="t">a</Card>',
      { overrides: { Card: { component: 'iframe' } } }
    )
    expect(propNames(result)).toEqual(['title'])
  })

  it.each([
    ['<img children="z" src="/x">', '<Image></Image>'],
    ['<pre><b>x</b></pre>', '<View><Text>&lt;b&gt;x&lt;/b&gt;</Text></View>'],
    [
      '<div><pre>a</pre></div>',
      '<Text>&lt;pre&gt;a&lt;/pre&gt;&lt;/div&gt;</Text>',
    ],
    ['![" onclick=alert(1)>](/x)', '<Image></Image>'],
  ])('renders %j as %j (a native view has no markup reader, so a raw body shows as text)', (input, expected) => {
    expect(serialize(compiler(input))).toBe(expected)
  })
})

describe('a children attribute on a tag with an override', () => {
  it.each([
    ['<card children="z" />', { card: { component: 'i' } }],
    ['<card children="z" />', Object.create({ card: { component: 'i' } })],
    ['<CARD children="z" />', { card: { component: 'i' } }],
  ])('reaches the override for %j, inherited or keyed in lowercase, as the renderer finds it', (input, overrides) => {
    expect(serialize(compiler(input, { overrides }))).toBe('<Text>z</Text>')
  })

  it('does not take a built-in object property for an override', () => {
    expect(
      serialize(compiler('<constructor children="z" />', { overrides: {} }))
    ).toBe('<Text></Text>')
  })

  it.each<[string, MarkdownToJSX.Overrides, string]>([
    [
      '<img children="z" src="/x">',
      { img: { props: { title: 't' } } },
      '<Image></Image>',
    ],
    [
      '<card children="z" />',
      { card: { component: 'img' } },
      '<Image></Image>',
    ],
    ['<Foo children="z" />', { Foo: { component: 'img' } }, '<Image></Image>'],
    ['<card>x</card>', { card: { component: 'img' } }, '<Image></Image>'],
  ])('renders %j with void override %j as %j, as an Image cannot hold children', (input, overrides, expected) => {
    expect(serialize(compiler(input, { overrides }))).toBe(expected)
  })

  const card = { card: { component: 'i', props: {} } } as const

  it.each<[string, string, MarkdownToJSX.Overrides, string]>([
    [
      'a capitalized self-closing tag',
      '<Card children="z" />',
      card,
      '<Text>z</Text>',
    ],
    [
      'a self-closing tag with a trailing newline',
      '<Card children="z" />\n',
      card,
      '<Text>z</Text>',
    ],
    [
      'a self-closing tag between blocks',
      'a\n\n<Card children="z" />\n\nb',
      card,
      '<View><Text>a</Text><Text>z</Text><Text>b</Text></View>',
    ],
    [
      'a self-closing tag inside a paragraph',
      'x <Card children="z" /> y',
      card,
      '<Text>x <Text>z</Text> y</Text>',
    ],
    [
      'a lowercase self-closing tag',
      '<card children="z" />',
      card,
      '<Text>z</Text>',
    ],
    [
      'an uppercase self-closing tag',
      '<CARD children="z" />',
      card,
      '<Text>z</Text>',
    ],
    [
      'a hyphenated self-closing tag',
      '<my-el children="z" />',
      { 'my-el': { component: 'i', props: {} } },
      '<Text>z</Text>',
    ],
    [
      'a lowercase empty pair',
      '<card children="z"></card>',
      card,
      '<Text>z</Text>',
    ],
    [
      'a lowercase empty pair between blocks',
      'a\n\n<card children="z"></card>\n\nb',
      card,
      '<View><Text>a</Text><Text><Text>z</Text></Text><Text>b</Text></View>',
    ],
    [
      'a capitalized empty pair',
      '<Card children="z"></Card>',
      card,
      '<Text>z</Text>',
    ],
    [
      'a capitalized empty pair inside a paragraph',
      'x <Card children="z"></Card> y',
      card,
      '<Text>x <Text>z</Text> y</Text>',
    ],
    [
      'a registered tag kept as written',
      '<Card children="z" />',
      { Card: { props: {} } },
      '<Text>z</Text>',
    ],
    [
      'an attribute name in uppercase',
      '<Card CHILDREN="z" />',
      card,
      '<Text>z</Text>',
    ],
    [
      'a value read as text, with its entity and markup as written',
      '<Card children="a &amp; <b>" />',
      card,
      '<Text>a &amp;amp; &lt;b&gt;</Text>',
    ],
    ['a brace value', '<Card children={x} />', card, '<Text>x</Text>'],
    [
      'a quoted brace value',
      '<Card children={"q"} />',
      card,
      '<Text>"q"</Text>',
    ],
    [
      'a bare name, which holds no text',
      '<Card children />',
      card,
      '<Text></Text>',
    ],
    [
      'an object value, which no element can hold',
      '<Card children={{"a":1}} />',
      card,
      '<Text></Text>',
    ],
    [
      'a Solid-prefixed name, which is not children',
      '<Card attr:children="z" />',
      card,
      '<Text></Text>',
    ],
    [
      'a pair with content of its own',
      '<card children="z">inner</card>',
      card,
      '<Text>inner</Text>',
    ],
    [
      'a capitalized pair with content of its own',
      '<Card children="z">inner</Card>',
      card,
      '<Text>inner</Text>',
    ],
    ['an unregistered tag', '<Card children="z" />', {}, '<Text></Text>'],
    [
      'a lowercase tag no override names',
      '<card children="z" />',
      {},
      '<Text></Text>',
    ],
    ['an unclosed tag', '<Card children="z">', card, '<Text>z</Text>'],
    [
      'an unclosed tag with a trailing newline',
      '<Card children="z">\n',
      card,
      '<Text>z</Text>',
    ],
    [
      'an unclosed tag between blocks, which closes before the next block',
      'a\n\n<Card children="z">\n\nb',
      card,
      '<View><Text>a</Text><Text>z</Text><Text>b</Text></View>',
    ],
    [
      'an unclosed tag with a void override',
      '<Card children="z">',
      { card: { component: 'img' } },
      '<Image></Image>',
    ],
    [
      'an unclosed pre block with content of its own',
      '<pre children="z">a',
      { pre: { props: {} } },
      '<View><Text>a</Text></View>',
    ],
    [
      'a value with markup characters and a run of spaces',
      '<Card children="a >  < b" />',
      card,
      '<Text>a &gt;  &lt; b</Text>',
    ],
    [
      'a value with a line break',
      '<Card children="a\nb" />',
      card,
      '<Text>a\nb</Text>',
    ],
    [
      'a value with a CRLF line break, read as a line feed',
      '<Card children="a\r\nb" />',
      card,
      '<Text>a\nb</Text>',
    ],
    [
      'a value with markup characters and a run of spaces inside a raw block',
      '<div>\n<Card children="a >  < b" />\n</div>',
      card,
      '<View><Text><Text>a &gt;  &lt; b</Text></Text></View>',
    ],
    [
      'a value with a line break inside a raw block',
      '<div>\n<Card children="a\nb" />\n</div>',
      card,
      '<View><Text><Text>a\nb</Text></Text></View>',
    ],
    [
      'a value with a CRLF line break inside a raw block',
      '<div>\r\n<Card children="a\r\nb" />\r\n</div>',
      card,
      '<View><Text><Text>a\nb</Text></Text></View>',
    ],
    [
      'a registered tag inside a raw block',
      '<div>\n<Card children="z" />\n</div>',
      card,
      '<View><Text><Text>z</Text></Text></View>',
    ],
    [
      'a lowercase pair inside a raw block',
      '<div>\n<card children="z"></card>\n</div>',
      card,
      '<View><Text><Text>z</Text></Text></View>',
    ],
    [
      'a capitalized pair inside a raw block',
      '<div>\n<Card children="z"></Card>\n</div>',
      card,
      '<View><Text><Text>z</Text></Text></View>',
    ],
    [
      'a registered tag two raw blocks deep',
      '<div>\n<section>\n<Card children="z" />\n</section>\n</div>',
      card,
      '<View><View><Text><Text>z</Text></Text></View></View>',
    ],
    [
      'a registered tag inside a raw block with a line after its closer',
      '<div>\n<card children="z"></card>\n</div>\ntail',
      card,
      '<View><Text><Text>z</Text></Text></View><Text> tail</Text>',
    ],
    [
      'a pair with content of its own inside a raw block',
      '<div>\n<Card children="z">inner</Card>\n</div>',
      card,
      '<View><Text><Text>inner</Text></Text></View>',
    ],
    [
      'a markup value inside a raw block, read as text (the serializer escapes a string child and writes an element as a bare tag, so an element would show as `<img></img>`)',
      '<div>\n<Card children="<img src=x onerror=alert(1)>" />\n</div>',
      card,
      '<View><Text><Text>&lt;img src=x onerror=alert(1)&gt;</Text></Text></View>',
    ],
  ])('renders %s as its content', (_title, input, overrides, expected) => {
    expect(serialize(compiler(input, { overrides }))).toBe(expected)
  })

  it('keeps a registered tag inside a pre block as written, without the attribute', () => {
    expect(
      serialize(
        compiler('<pre>\n<Card children="z" />\n</pre>', { overrides: card })
      )
    ).toBe('<View><Text>&lt;Card  /&gt;</Text></View>')
  })
})

describe('code naming a filtered tag', () => {
  it.each([
    [{}],
    [{ disableParsingRawHTML: true }],
  ])('stays code with %j, as only the markdown output writes it differently', options => {
    expect(serialize(compiler('`<script>`', options))).toBe(
      '<Text>&lt;script&gt;</Text>'
    )
  })
})

describe('a URL that names a dangerous scheme', () => {
  it.each([
    [
      '[a](https://en.wikipedia.org/wiki/Javascript:_The_Good_Parts)',
      'https://en.wikipedia.org/wiki/Javascript:_The_Good_Parts',
    ],
    [
      '<https://example.com/?q=javascript:x>',
      'https://example.com/?q=javascript:x',
    ],
    ['[l](/[x](javascript:alert(1)))', '/%5Bx%5D(javascript:alert(1))'],
  ])('opens %j at %j, where a browser reads no such scheme', (input, url) => {
    const onLinkPress = mock((_url: string, _title?: string) => {})
    const press = findLinkElement(compiler(input, { onLinkPress })).props
      .onPress
    expect(typeof press).toBe('function')
    if (typeof press === 'function') {
      press()
    }
    expect(onLinkPress.mock.calls).toEqual([[url, undefined]])
  })

  it('keeps the href of a raw link, since raw HTML has no press handler in React Native and the prop is what it produces', () => {
    const link = compiler('<a href="/docs/javascript:intro">x</a>')
    expect(treeProps(link).filter(([name]) => name === 'href')).toEqual([
      ['href', '/docs/javascript:intro'],
    ])
  })

  it.each([
    ['[a](javascript:alert(1))'],
    ['[a](feed:javascript:alert(1))'],
  ])('renders %j with nothing to open', input => {
    expect(() => findLinkElement(compiler(input))).toThrow(
      'Link element with onPress not found'
    )
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
    ).toBe(
      '<View><View><Text>• </Text><View><Text>alpha\nbeta</Text></View></View></View>'
    )
  })

  it.each([
    ['<!--><svg onload=alert(1)>', '<Text></Text>'],
    ['<?"><b onclick=alert(1)>b</b>', '<Text>&lt;?"&gt;<Text>b</Text></Text>'],
    [
      '<div>\n<!-- x\n\n<a title="--><img src=x onerror=alert(1)>">',
      '<View><View><Text></Text></View><Text></Text></View>',
    ],
    [
      '<!---><noscript><a title="</noscript><img src=x onerror=alert(1)>">',
      '<Text><Text>&lt;a title="</Text><Image></Image>"&gt;</Text>',
    ],
    [
      '<!-- x\n\n<a title="--><b y=\'">\n\n\' onclick=alert(1)>',
      "<Text>' onclick=alert(1)&gt;</Text>",
    ],
    ['<a x="<b" y=z>', '<Text></Text>'],
    [
      "<div onclick='alert(1)'--!>",
      "<Text>&lt;div onclick='alert(1)'--!&gt;</Text>",
    ],
    [
      '<div onclick={alert(1)}<xmp>',
      '<Text>&lt;div onclick={alert(1)}&lt;xmp&gt;</Text>',
    ],
    [
      '<div x={a><img src=x onerror=alert(1)>}>\nhi\n</div>',
      '<View><Text>hi</Text></View>',
    ],
    [
      'p <span x={a><img src=x onerror=alert(1)>}>hi</span>',
      '<Text>p <Text>hi</Text></Text>',
    ],
    [
      '<pre><Img onclick={alert(1)}',
      '<View><Text>&lt;Img onclick={alert(1)}</Text></View>',
    ],
    [
      '<div>\n<b onclick=alert(1)',
      '<View><Text>&lt;b onclick=alert(1)</Text></View>',
    ],
    ['```x onmouseover="alert(1)"\ny\n```', '<View><Text>y</Text></View>'],
    ['```x style="color:red"\ny\n```', '<View><Text>y</Text></View>'],
    [
      '<iframe><img src=x onerror=alert(1)',
      '<Text><Text>&lt;iframe&gt;</Text>&lt;img src=x onerror=alert(1)</Text>',
    ],
    ['\\<svg onload=alert(1)>', '<Text>&lt;svg onload=alert(1)&gt;</Text>'],
    [
      '&lt;img src=x onerror=alert(1)&gt;',
      '<Text>&lt;img src=x onerror=alert(1)&gt;</Text>',
    ],
    [
      'a[^1]\n\n[^1]: javascript:alert(1)',
      '<View><Text>a<Text>¹</Text></Text><View><Text>1: javascript:alert(1)</Text></View></View>',
    ],
    [
      'a[^1]\n\n[^1]: hi [x](javascript:alert(1))',
      '<View><Text>a<Text>¹</Text></Text><View><Text>1: hi <Text>x</Text></Text></View></View>',
    ],
    ['![a](&amp;#106;avascript:alert(1))', '<Image></Image>'],
    ['[x](javascript:alert(1) "t")', '<Text>x</Text>'],
    [
      '<!-- x -->İİİİİİİİİİ</pre><pre>',
      '<Text>İİİİİİİİİİ<View></View><View></View></Text>',
    ],
    ['<span>[l](javascript:alert(1))</span>', '<Text><Text>l</Text></Text>'],
    [
      'x <javascript:alert(1)> y',
      '<Text>x <Text>javascript:alert(1)</Text> y</Text>',
    ],
    [
      'x <span><javascript:alert(1)//\xa0></span>',
      '<Text>x <Text><Text>javascript:alert(1)//\xa0</Text></Text></Text>',
    ],
    [
      'x <span><JavaScript:alert&#40;1&#41;\u{2003}x></span>',
      '<Text>x <Text><Text>JavaScript:alert&amp;#40;1&amp;#41;\u{2003}x</Text></Text></Text>',
    ],
    [
      'x <span><a:b\xa0<javascript:alert(1)\u{2028}x></span>',
      '<Text>x <Text>&lt;a:b\xa0<Text>javascript:alert(1)\u{2028}x</Text></Text></Text>',
    ],
    [
      'x <span>[y <https:a\xa0](javascript:alert(1))></span>',
      '<Text>x <Text>[y <Text>https:a\xa0](javascript:alert(1))</Text></Text></Text>',
    ],
    [
      'x <span><javascript:a](<javascript:alert(1)>)></span>',
      '<Text>x <Text>&lt;javascript:a](<Text>javascript:alert(1)</Text>)&gt;</Text></Text>',
    ],
    ['[l](&amp;amp;#106;avascript:alert(1))', '<Text>l</Text>'],
    ['[l](&#106avascript:alert(1))', '<Text>l</Text>'],
    ['a\nb\n=', '<Text>a\nb</Text>'],
    [
      '- [^1]: a )\n[^1]:&#106avascript:alert(1)',
      '<View><View><View><Text>• </Text><View><Text><Text>¹</Text>:&amp;#106avascript:alert(1)</Text></View></View></View><View><Text>1: a )</Text></View></View>',
    ],
    ['<q> <b>x</b>', '<Text><Text></Text> <Text>x</Text></Text>'],
    ['&amp;copy; a &amp; b', '<Text>&amp;copy; a &amp; b</Text>'],
    [
      '\n﻿[^1]:javascript:alert(1)\n[^1]',
      '<Text>﻿[^1]:javascript:alert(1)\n[^1]</Text>',
    ],
    [
      '<title>a\n\n<!--</title>\n\n```\n<b>\n```',
      '<View><Text>&lt;title&gt;<Text>a</Text>&lt;/title&gt;</Text><View><Text>&lt;b&gt;</Text></View></View>',
    ],
    [
      '1. # [^1]\n[^1]:&#106avascript:alert(1)',
      '<View><View><View><Text>1. </Text><View><Text><Text>¹</Text></Text></View></View></View><View><Text>1: &amp;#106avascript:alert(1)</Text></View></View>',
    ],
    [
      '1. a [^1]\n[^1]:&#106avascript:alert(1)',
      '<View><View><Text>1. </Text><View><Text>a [^1]\n[^1]:&amp;#106avascript:alert(1)</Text></View></View></View>',
    ],
    [
      '1. <!-- c --> x\n[^1]:&#106avascript:alert(1)\n\n[^1]',
      '<View><View><View><Text>1. </Text><View><Text></Text></View></View></View><Text><Text>¹</Text></Text><View><Text>1: &amp;#106avascript:alert(1)</Text></View></View>',
    ],
    [
      '- <pre>x\ny</pre>',
      '<View><View><View><Text>• </Text><View><View><Text>x</Text></View></View></View></View><View><Text>y</Text><View></View></View></View>',
    ],
    [
      '- <!-- x\ny -->',
      '<View><View><View><Text>• </Text><View><Text></Text></View></View></View><Text>y --&gt;</Text></View>',
    ],
    [
      '- <div\nonclick=alert(1)>x</div>',
      '<View><View><View><Text>• </Text><View>&lt;div</View></View></View><View><Text>onclick=alert(1)&gt;x</Text><View></View></View></View>',
    ],
    [
      '- a <div\nonclick=alert(1)>x</div>',
      '<View><View><Text>• </Text><View><Text>a </Text><View><Text>x</Text></View></View></View></View>',
    ],
    [
      '- <x-y\nonclick=alert(1)>y</x-y>',
      '<View><View><Text>• </Text><View><Text><Text>y</Text></Text></View></View></View>',
    ],
    [
      '- <Foo x="1\n2">y</Foo>',
      '<View><View><Text>• </Text><View><Text><Text>y</Text></Text></View></View></View>',
    ],
    [
      '- ```\ny',
      '<View><View><View><Text>• </Text><View><View><Text></Text></View></View></View></View><Text>y</Text></View>',
    ],
    [
      '1. <x-y>x\ny',
      '<View><View><Text>1. </Text><View><Text>x y</Text></View></View></View>',
    ],
    [
      '1. [r]:\n/u "a\nb"\n\n   [r]',
      '<View><View><Text>1. </Text><View><Text><Text>r</Text></Text></View></View></View>',
    ],
    [
      '- <b>f</b><!-- c --><img\nsrc=x>z onclick=alert(1)',
      '<View><View><Text>• </Text><View><Text><Text>f</Text></Text><Image></Image><Text>z onclick=alert(1)</Text></View></View></View>',
    ],
    [
      '- # h\na | b\n  --- | ---',
      '<View><View><View><Text>• </Text><View><Text>h</Text></View></View></View><View><View><View><View><Text>a</Text></View><View><Text>b</Text></View></View></View></View></View>',
    ],
    [
      '- - [^1]:\nz\n\n  [^1]',
      '<View><View><View><Text>• </Text><View><View><View><Text>• </Text><View></View></View></View><Text><Text>¹</Text></Text></View></View></View><View><Text>1: z</Text></View></View>',
    ],
    [
      '[r]: a\\\nb\n\n[r]',
      '<View><Text>b</Text><Text><Text>r</Text></Text></View>',
    ],
    ['[r]: a\\ "t"\n\n[r]', '<Text><Text>r</Text></Text>'],
    ['[r]: <a\\\nb>', '<Text>[r]: &lt;a\nb&gt;</Text>'],
    ['[x](a\\\\)', '<Text>x</Text>'],
    [
      '- a | b\n  --- | ---\nc | d',
      '<View><View><View><Text>• </Text><View><View><View><View><View><Text>a</Text></View><View><Text>b</Text></View></View></View></View></View></View></View><Text>c | d</Text></View>',
    ],
    [
      '1. [^1]:\nb\n\n   [^1]',
      '<View><View><View><Text>1. </Text><View><Text><Text>¹</Text></Text></View></View></View><View><Text>1: b</Text></View></View>',
    ],
    [
      '- <b>x</b>\ny\n===',
      '<View><View><Text>• </Text><View><Text><Text>x</Text>\ny\n===</Text></View></View></View>',
    ],
    [
      '<div <b c="d"/>\n<![CDATA[</pre>\n\n```\n<b>\n```',
      '<View><Text>&lt;div &lt;b c="d"/&gt;\n&lt;![CDATA[&lt;/pre&gt;\n</Text><View><Text>&lt;b&gt;</Text></View></View>',
    ],
    [
      '<p><!--\n\n<a e="--><b e=">">\n<div>"onclick=alert(1)>',
      '<View><Text></Text><Text><Text></Text>"&gt;</Text><View><Text>"onclick=alert(1)&gt;</Text></View></View>',
    ],
    [
      '<textarea>```\n```\n</script>\n    [x](&#106avascript:alert(1))',
      '<View><Text>&lt;textarea&gt;```\n```\n&lt;/script&gt;</Text><View><Text>[x](&amp;#106avascript:alert(1))</Text></View></View>',
    ],
    [
      '<details>\n<summary>x</summary>\n\n```js\ncode\n```\n\n</details>',
      '<View><View><Text>x</Text></View><View><Text>code</Text></View></View>',
    ],
    [
      '<div>\n\n```\n``` \n\n</div>\n\n```\n<img src=x onerror=alert(1)>\n',
      '<View><View><View><Text>``` \n</Text></View></View><View><Text>&lt;img src=x onerror=alert(1)&gt;</Text></View></View>',
    ],
    [
      '<![CDATA[a]]]>\n\n```\n<img src=x onerror=alert(1)>\n```',
      '<View><Text>&lt;img src=x onerror=alert(1)&gt;</Text></View>',
    ],
    [
      '- <?p ?> <?q ?>[x](\njavascript:alert(1))',
      '<View><View><View><Text>• </Text><View><Text></Text></View></View></View><Text>javascript:alert(1))</Text></View>',
    ],
    [
      '- a <?p ?> <?q ?>[x](\njavascript:alert(1))',
      '<View><View><Text>• </Text><View><Text>a  <Text>x</Text></Text></View></View></View>',
    ],
    [
      '<div>\n\n```\n```\t\n\n</div>\n\n```\n<img src=x onerror=alert(1)>\n',
      '<View><View><View><Text></Text></View></View><View><Text>&lt;img src=x onerror=alert(1)&gt;</Text></View></View>',
    ],
    [
      '<div>\n\n```\n```~\n```\n\n</div>\n\n```\n<img src=x onerror=alert(1)>\n',
      '<View><View><View><Text>```~</Text></View></View><View><Text>&lt;img src=x onerror=alert(1)&gt;</Text></View></View>',
    ],
    [
      '<details>\n\n```\n```js\n```\n\n</details>',
      '<View><View><Text>```js</Text></View></View>',
    ],
    [
      '<script></textarea></script >\n\n```\n<img src=x onerror=alert(1)>\n```',
      '<View><Text>&lt;script&gt;&lt;/textarea&gt;&lt;/script &gt;</Text><View><Text>&lt;img src=x onerror=alert(1)&gt;</Text></View></View>',
    ],
    ['[^a](javascript:alert(1))', '<Text>^a</Text>'],
    [
      '[^a](javascript:alert(1))\n\n[^a]: y',
      '<View><Text><Text>a</Text>(javascript:alert(1))</Text><View><Text>a: y</Text></View></View>',
    ],
    [
      'y [^a<img src=x onerror=alert(1)>]\n\n[^a<img src=x onerror=alert(1)>]: a',
      '<View><Text>y <Text>a&lt;img src=x onerror=alert(¹)&gt;</Text></Text><View><Text>a&lt;img src=x onerror=alert(1)&gt;: a</Text></View></View>',
    ],
    [
      '[^1]: a [\n[r]: a "](javascript:alert(1))"',
      '<View><Text>1: a [</Text></View>',
    ],
    [
      '[^1]: a b\n[r]: a "[x](javascript:alert(1))"',
      '<View><Text>1: a b</Text></View>',
    ],
    [
      '[\\[a\\](javascript:alert(1))](/u)',
      '<Text>[a](javascript:alert(1))</Text>',
    ],
    [
      '\\\n[^1]:&#106avascript:alert(1)\n[^1]',
      '<Text>\n[^1]:&amp;#106avascript:alert(1)\n[^1]</Text>',
    ],
    [
      'x&#60;~~~~javascript:alert(1)>',
      '<Text>x&lt;~~~~javascript:alert(1)&gt;</Text>',
    ],
    ["<C><?><a e='?>'> onclick/", "<Text><Text></Text>'&gt; onclick/</Text>"],
    ['<![CDATA[<?><a e="?>"\n<!--"onclick>]', ''],
    [
      '<?e><a e="?>">\n<style>"onclick=alert(1)>',
      '<Text>&lt;style&gt;"onclick=alert(1)&gt;</Text>',
    ],
    [
      '[x][^1]\n\n[^1]: &amp;#106;avascript:alert(1)',
      '<View><Text>[x]<Text>¹</Text></Text><View><Text>1: &amp;#106;avascript:alert(1)</Text></View></View>',
    ],
    ['[x][^1]', '<Text>[x][^1]</Text>'],
    [
      '[^1][^2]\n\n[^1]: see [^3]',
      '<View><Text><Text>¹</Text>[^2]</Text><View><Text>1: see [^3]</Text></View></View>',
    ],
    [
      '[^1]\n\n[^1]: see [^2]\n\n[^2]: y',
      '<View><Text><Text>¹</Text></Text><View><Text>1: see <Text>²</Text></Text><Text>2: y</Text></View></View>',
    ],
    [
      '<?p ?><!DOCTYPE html>```\n```\n<svg onload=alert(1)>',
      '<View><Text>&lt;svg onload=alert(1)&gt;</Text></View>',
    ],
    ['[l](/u "--><img src=x onerror=alert(1)>")', '<Text>l</Text>'],
    ['![a"--><img src=x onerror=alert(1)>](/x)', '<Image></Image>'],
    [
      '<svg>](<javascript:alert(1)></svg>',
      '<Text>](<Text>javascript:alert(1)</Text></Text>',
    ],
    [
      '<!DOCTYPE html>](<javascript:alert(1)>',
      '<Text>](<Text>javascript:alert(1)</Text></Text>',
    ],
    [
      '| a | b |\n|---|---|\n[l](javascript:alert(1)',
      '<View><View><View><View><Text>a</Text></View><View><Text>b</Text></View></View></View><View><View><View><Text>[l](javascript:alert(1)</Text></View><View></View></View></View></View>',
    ],
    [
      '| h | i |\n|---|---|\n| a\\\\\\|b | z |',
      '<View><View><View><View><Text>h</Text></View><View><Text>i</Text></View></View></View><View><View><View><Text>a\\|b</Text></View><View><Text>z</Text></View></View></View></View>',
    ],
    [
      '[^1]: data:text/html,x\n[^1]',
      '<View><Text><Text>¹</Text></Text><View><Text>1: data:text/html,x</Text></View></View>',
    ],
    [
      '<foreignObject>~~~~```x onmouseover="alert(1)"\n<svg onload=alert(1)>```\n',
      '<Text><Text></Text>~~~~<Text>x onmouseover="alert(1)" &lt;svg onload=alert(1)&gt;</Text></Text>',
    ],
    [
      '[^1]: <iframe srcdoc="x"></iframe>[r][^1]',
      '<Text>[^1]: <Text>&lt;iframe&gt;&lt;/iframe&gt;</Text>[r][^1]</Text>',
    ],
    [
      '<annotation-xml>[^1]: ](javascript:alert(1)',
      '<Text><Text></Text>[^1]: ](javascript:alert(1)</Text>',
    ],
    ['<pre>a', '<View><Text>a</Text></View>'],
    ['<div><pre>a', '<Text>&lt;pre&gt;a</Text>'],
    ['<div>\n\n', '<View></View>'],
    ["<div </div>'", "<Text>&lt;div &lt;/div&gt;'</Text>"],
    ['<?php echo 1 ?>', ''],
    ['<!DOCTYPE html>', ''],
    ['<!doctype html>', ''],
    ['<![CDATA[x]]>', ''],
    [
      '<![CDATA[<a title="</style><a title="</textarea><a href="javascript:alert(1)">l</a> x" onclick=alert(1)>',
      '<Text>&lt;![CDATA[&lt;a title="<Text>&lt;/style&gt;</Text>&lt;a title="<Text>&lt;/textarea&gt;</Text><Text>l</Text> x" onclick=alert(1)&gt;</Text>',
    ],
    ['a <?b?> c', '<Text>a  c</Text>'],
    ['a <!B c> d', '<Text>a  d</Text>'],
    ['x <!a b> y', '<Text>x  y</Text>'],
    ['a <![CDATA[b]]> c', '<Text>a  c</Text>'],
    ['a <!-- b --> c', '<Text>a  c</Text>'],
    ['[l](java&Tab;script:alert(1))', '<Text>l</Text>'],
    ['<a href="java\tscript:alert(1)">l</a>', '<Text>l</Text>'],
    ['<a href="java\nscript:alert(1)">l</a>', '<Text><Text>l</Text></Text>'],
    ['<my-widget onclick={alert(1)}>x</my-widget>', '<Text>x</Text>'],
    ['<my-widget items={x}>y</my-widget>', '<Text>y</Text>'],
    ['<my-widget href={javascript:x}>z</my-widget>', '<Text>z</Text>'],
    [
      '<a title="?><!--[^1]: ![a](javascript:alert(1))\n</div\n-->',
      '<Text>&lt;a title="?&gt;</Text>',
    ],
    [
      '1. </div x={a ><img src=x onerror=alert(1)>}>    innerHTML="x<img src=x onerror=alert(1)>"',
      '<Text>1. &lt;/div x={a &gt;<Image></Image>}&gt;    innerHTML="x<Image></Image>"</Text>',
    ],
    [
      '- </div x={a ><img src=x onerror=alert(1)>}>    <b onclick=alert(1)>b</b>',
      '<View><View><Text>• </Text><View><View></View><View><Text>&lt;b onclick=alert(1)&gt;b&lt;/b&gt;</Text></View></View></View></View>',
    ],
    [
      '<div x={a><a title="</textarea>[^1]: ![a](javascript:alert(1))\nprop:innerHTML="x<img src=x onerror=alert(1)>"](onclick={alert(1)}',
      '<View></View>',
    ],
    [
      '![<!---></span ](javascript:alert(1))>![a"--><img src=x onerror=alert(1)>](/x)',
      '<Image></Image>',
    ],
    ['![a\\\\\\](javascript:alert(1))b](/x)', '<Image></Image>'],
    [
      `> <div a=1${String.fromCharCode(0x20_28)}>  onclick=alert(1) b>y</div>`,
      '<View><View><Text>onclick=alert(1) b&gt;y</Text></View></View>',
    ],
    [
      '<pre>a &lt; b &amp; c</pre>',
      '<View><Text>a &lt; b &amp; c</Text></View>',
    ],
    [
      `> <div </div${String.fromCharCode(0x20_28)}>\nonclick='alert(1)'`,
      "<View><View><View></View></View><Text>onclick='alert(1)'</Text></View>",
    ],
    [
      `> a <div </div${String.fromCharCode(0x20_28)}>\nonclick='alert(1)'`,
      `<View><Text>a &lt;div &lt;/div${String.fromCharCode(0x20_28)}&gt;\nonclick='alert(1)'</Text></View>`,
    ],
    [
      '/\n    <pre>\n```\n<img src=x onerror=alert(1)>\n```',
      '<View><View><Text>/\n</Text><View></View></View><View><Text>&lt;img src=x onerror=alert(1)&gt;</Text></View></View>',
    ],
    [
      '- <div/>`<img src=x onerror=alert(1)>`',
      '<View><View><Text>• </Text><View><View></View><Text><Text>&lt;img src=x onerror=alert(1)&gt;</Text></Text></View></View></View>',
    ],
    [
      '- z\n  <b/>\n  `<img src=x onerror=alert(1)>`',
      '<View><View><Text>• </Text><View><Text>z\n<Text></Text>\n<Text>&lt;img src=x onerror=alert(1)&gt;</Text></Text></View></View></View>',
    ],
    [
      '- <br>\n  `<img src=x onerror=alert(1)>`',
      '<View><View><Text>• </Text><View><Text><Text></Text><Text>&lt;img src=x onerror=alert(1)&gt;</Text></Text></View></View></View>',
    ],
    [
      '- a\n  - <div/>\n  `<img src=x onerror=alert(1)>`',
      '<View><View><Text>• </Text><View><Text>a</Text><View><View><Text>• </Text><View><View></View></View></View></View><Text><Text>&lt;img src=x onerror=alert(1)&gt;</Text></Text></View></View></View>',
    ],
    [
      '- a\n\n- z\n  <b/>\n  `<img src=x onerror=alert(1)>`',
      '<View><View><Text>• </Text><View><Text>a</Text></View></View><View><Text>• </Text><View><Text>z\n<Text></Text>\n<Text>&lt;img src=x onerror=alert(1)&gt;</Text></Text></View></View></View>',
    ],
    [
      '<b>`</b>x`<img src=x onerror=alert(1)>`',
      '<Text><Text>`</Text>x<Text>&lt;img src=x onerror=alert(1)&gt;</Text></Text>',
    ],
    [
      'z\n    <div>`<img src=x onerror=alert(1)>`',
      '<View><Text>z\n</Text><View></View><Text><Text>&lt;img src=x onerror=alert(1)&gt;</Text></Text></View>',
    ],
    [
      '~~~<a href="javascript:alert(1)">\nq\n~~~',
      '<View><Text>q</Text></View>',
    ],
    ['`[x](javascript:alert(1))`', '<Text>[x](javascript:alert(1))</Text>'],
    [
      '- <?a ?>[x]:\n  javascript:alert(1)\n\n<span>[x]</span>',
      '<View><View><View><Text>• </Text><View><Text>javascript:alert(1)</Text></View></View></View><Text><Text>[x]</Text></Text></View>',
    ],
    [
      'a[^1]\n\n[^1]: 100% of people',
      '<View><Text>a<Text>¹</Text></Text><View><Text>1: 100% of people</Text></View></View>',
    ],
    [
      '1. ```\n   foo\n   ```',
      '<View><View><Text>1. </Text><View><View><Text>foo</Text></View></View></View></View>',
    ],
    ['a #\n=', '<Text>a #</Text>'],
    ['`<script> https://a.b/c`', '<Text>&lt;script&gt; https://a.b/c</Text>'],
    [
      `> <div </div ${String.fromCharCode(0x20_28)}>\nonclick='alert(1)'`,
      "<View><View><View></View></View><Text>onclick='alert(1)'</Text></View>",
    ],
    [
      '<pre/>\n\n```\n<img src=x onerror=alert(1)>\n```',
      '<View><View><Text>\n</Text></View><View><Text>&lt;img src=x onerror=alert(1)&gt;</Text></View></View>',
    ],
    [
      '<pre/>y\n\n```\n<img src=x onerror=alert(1)>\n```',
      '<View><View><Text>y\n</Text></View><View><Text>&lt;img src=x onerror=alert(1)&gt;</Text></View></View>',
    ],
    [
      '<![CDATA[\n<![CDATA[]]]>\n\n```\n<img src=x onerror=alert(1)>\n```',
      '<View><Text>&lt;img src=x onerror=alert(1)&gt;</Text></View>',
    ],
  ])('renders %j as %j with no handler prop', (input, expected) => {
    const result = compiler(input)
    expect(serialize(result)).toBe(expected)
    expect(handlerProps(result)).toEqual([])
  })

  it.each([
    [
      '<br>\n\n```\n<img src=x onerror=alert(1)>\n```',
      '<View><View></View><View><Text>&lt;img src=x onerror=alert(1)&gt;</Text></View></View>',
      'br',
      'pre',
    ],
    [
      '<div>\nx\n\n```\n<img src=x onerror=alert(1)>\n```',
      '<View><View><Text>x</Text></View><View><Text>&lt;img src=x onerror=alert(1)&gt;</Text></View></View>',
      'div',
      'pre',
    ],
    [
      '<b/>\n\n```\n<img src=x onerror=alert(1)>\n```',
      '<View><View></View><View><Text>&lt;img src=x onerror=alert(1)&gt;</Text></View></View>',
      'b',
      'script',
    ],
    [
      '<span>y</span>`<img src=x onerror=alert(1)>`',
      '<Text><View>y</View><Text>&lt;img src=x onerror=alert(1)&gt;</Text></Text>',
      'span',
      'div',
    ],
    [
      '<pre/>`<img src=x onerror=alert(1)>`',
      '<View><Text>`&lt;img src=x&gt;`</Text></View>',
      'pre',
      'script',
    ],
    [
      '<div>\n<a title="></textarea>\nplain "text"\n<div>"onclick=alert(1)>',
      '<View><Text>&lt;a title="&gt;\nplain "text" </Text><View></View><Text>"onclick=alert(1)&gt;</Text></View>',
      'div',
      'pre',
    ],
    [
      '<pre>\n<a title=">\n\nplain "text"\n\n<div>"onclick=alert(1)>\n</pre>',
      '<View><Text>&lt;a title="&gt;\n\nplain "text"\n\n&lt;div&gt;"onclick=alert(1)&gt;</Text></View>',
      'pre',
      'div',
    ],
  ] as const)('renders %j as %j when %j is renamed to %j', (input, expected, tag, component) => {
    const result = compiler(input, { overrides: { [tag]: { component } } })
    expect(serialize(result)).toBe(expected)
    expect(handlerProps(result)).toEqual([])
  })

  it('escapes a tag hidden in a quoted value that runs past the read limit', () => {
    const long = 'x'.repeat(1100)
    expect(
      serialize(compiler(`<div>\n<a title="<b ${long}">y</a>\n</div>`))
    ).toBe(`<View><Text>&lt;a title="&lt;b ${long}"&gt;y</Text></View>`)
  })

  it.each([
    ['<Img onclick={alert(1)} />', undefined, '<Image></Image>', []],
    ['<Img onerror />', undefined, '<Image></Image>', []],
    ['<my-widget online>x</my-widget>', undefined, '<Text>x</Text>', []],
    [
      '<Img onerror />',
      { overrides: { Img: { props: {} } } },
      '<Image></Image>',
      [],
    ],
    ['<constructor>hi</constructor>', { overrides: {} }, '<Text>hi</Text>', []],
    ['<Constructor>hi</Constructor>', { overrides: {} }, '<Text>hi</Text>', []],
    [
      '<my-widget onclick={alert(1)}>x</my-widget>',
      { overrides: { 'my-widget': { props: {} } } },
      '<Text>x</Text>',
      [],
    ],
    [
      '<my-widget onclick={() => 1}>x</my-widget>',
      { evalUnserializableExpressions: true },
      '<Text>x</Text>',
      [],
    ],
    [
      '<Img onclick={() => 1} />',
      {
        evalUnserializableExpressions: true,
        overrides: { IMG: { props: {} } },
      },
      '<Image></Image>',
      ['onclick=function'],
    ],
  ])('with its options keeps %j and %j as %j with props %j (a tag no override matches is HTML and loses its handlers; React Native writes no attributes, so what a component receives stays; a lowercase tag an override matches passes no handler on, and a lowercase tag is HTML so its value is never evaluated)', (input, options, expected, handlers) => {
    const result = compiler(input, options)
    expect(serialize(result)).toBe(expected)
    expect(handlerProps(result)).toEqual(handlers)
  })
})

describe('a capitalized tag an override matches is a component, and every other tag is HTML', () => {
  const ATTR_NAMES = ['class', 'data', 'href', 'onClick', 'onclick', 'title']
  const attrProps = (el: React.ReactNode) =>
    treeProps(el).filter(([name]) => ATTR_NAMES.includes(name))

  const Aside = ({ children }: { children?: React.ReactNode }) => (
    <View>{children}</View>
  )

  it.each(
    ['Card', 'CARD', 'CaRd'].flatMap(tag =>
      ['Card', 'card', 'CARD'].map(key => [tag, key])
    )
  )('renders <%s> with the component a %j key names', (tag, key) => {
    const result = compiler(`a <${tag} data={[1]}>x</${tag}>`, {
      overrides: { [key]: Aside },
    })
    expect(serialize(result)).toBe('<Text>a <Aside>x</Aside></Text>')
    expect(attrProps(result)).toEqual([['data', [1]]])
  })

  it('renders <card> as HTML against a `Card` key', () => {
    const result = compiler('a <card data={[1]}>x</card>', {
      overrides: { Card: Aside },
    })
    expect(serialize(result)).toBe('<Text>a <Text>x</Text></Text>')
    expect(attrProps(result)).toEqual([['data', '{[1]}']])
  })

  it.each([
    ['<Card data={[1]} title="t" onClick={go}>x</Card>', '<Text>x</Text>'],
    [
      '<div>\n<Card data={[1]} title="t" onClick={go}>x</Card>\n</div>',
      '<View><Text><Text>x</Text></Text></View>',
    ],
    [
      'a <Card data={[1]} title="t" onClick={go}>x</Card> b',
      '<Text>a <Text>x</Text> b</Text>',
    ],
  ])('renders the unmatched capitalized tag in %j as HTML: %j', (input, expected) => {
    const result = compiler(input)
    expect(serialize(result)).toBe(expected)
    expect(attrProps(result)).toEqual([
      ['data', '{[1]}'],
      ['title', 't'],
    ])
  })

  it('strips a brace handler from a lowercase tag an override restyles', () => {
    const result = compiler('x <a href="/" onclick={alert(1)}>y</a>', {
      overrides: { a: { props: { class: 'x' } } },
    })
    expect(handlerProps(result)).toEqual([])
    expect(attrProps(result)).toEqual([
      ['href', '/'],
      ['class', 'x'],
    ])
  })

  const MyLink = (props: TextProps) => <Text {...props} />
  const widget = { 'my-widget': { props: {} } }

  it.each([
    [
      'x <a href="/" onclick="alert(1)">y</a>',
      { a: MyLink },
      '<Text>x <MyLink>y</MyLink></Text>',
    ],
    [
      'x <a href="/" onclick={alert(1)}>y</a>',
      { a: MyLink },
      '<Text>x <MyLink>y</MyLink></Text>',
    ],
    [
      'x <a href="/" onclick>y</a>',
      { a: MyLink },
      '<Text>x <MyLink>y</MyLink></Text>',
    ],
    [
      'x <a href="/" onclick="alert(1)">y</a>',
      { a: { props: { class: 'x' } } },
      '<Text>x <Text>y</Text></Text>',
    ],
    [
      'x <a href="/" onclick={alert(1)}>y</a>',
      { a: { component: 'span' } },
      '<Text>x <Text>y</Text></Text>',
    ],
    [
      'x <a href="/" onclick={alert(1)}>y</a>',
      { a: 'span' },
      '<Text>x <Text>y</Text></Text>',
    ],
    ['<my-widget onclick={alert(1)}>x</my-widget>', widget, '<Text>x</Text>'],
    ['<my-widget onclick="alert(1)">x</my-widget>', widget, '<Text>x</Text>'],
    [
      'a <my-widget onclick={alert(1)}>x</my-widget>',
      widget,
      '<Text>a <Text>x</Text></Text>',
    ],
    [
      'a <my-widget onclick="alert(1)">x</my-widget>',
      widget,
      '<Text>a <Text>x</Text></Text>',
    ],
    [
      '<div>\n<my-widget onclick={alert(1)}>x</my-widget>\n</div>',
      widget,
      '<View><Text><Text>x</Text></Text></View>',
    ],
    [
      '<div>\n<my-widget onclick="alert(1)">x</my-widget>\n</div>',
      widget,
      '<View><Text><Text>x</Text></Text></View>',
    ],
    [
      'x <a href="/" onclick={alert(1)}>y</a>',
      undefined,
      '<Text>x <Text>y</Text></Text>',
    ],
  ] as const)('renders %j with %j as %j, passing no handler on', (input, overrides, expected) => {
    const result = compiler(input, { overrides })
    expect(serialize(result)).toBe(expected)
    expect(handlerProps(result)).toEqual([])
  })

  it('keeps the handler of a capitalized tag an override matches as a prop', () => {
    const result = compiler('<Btn onClick={go}>x</Btn>', {
      overrides: { Btn: Aside },
    })
    expect(serialize(result)).toBe('<Aside>x</Aside>')
    expect(handlerProps(result)).toEqual(['onClick=string'])
  })

  it('gives renderRule the handler of a lowercase tag an override matches, as written', () => {
    const seen: unknown[] = []
    const result = compiler(
      'x <a href="/" onclick={alert(1)}>y</a> <a onclick="go()">z</a>',
      {
        overrides: { a: MyLink },
        renderRule(next, node) {
          if (node.type === RuleType.htmlBlock && node.tag === 'a') {
            seen.push(node.attrs?.onclick)
          }
          return next()
        },
      }
    )
    expect(seen).toEqual(['{alert(1)}', 'go()'])
    expect(serialize(result)).toBe(
      '<Text>x <MyLink>y</MyLink> <MyLink>z</MyLink></Text>'
    )
    expect(handlerProps(result)).toEqual([])
  })

  it.each([
    ['an override component', { a: MyLink }, '<MyLink></MyLink>'],
    ['no override', undefined, '<Text></Text>'],
  ])('passes no handler string in a hand-built AST on, with %s', (_, overrides, expected) => {
    const result = astToNative(
      [
        {
          attrs: { href: '/', onclick: 'alert(1)' },
          tag: 'a',
          type: RuleType.htmlSelfClosing,
        },
      ],
      { overrides }
    )
    expect(serialize(result)).toBe(expected)
    expect(handlerProps(result)).toEqual([])
  })

  it('passes a capitalized tag its handler string only when an override matches the tag', () => {
    const ast: MarkdownToJSX.ASTNode[] = [
      { attrs: { onClick: 'go' }, tag: 'Btn', type: RuleType.htmlSelfClosing },
    ]
    expect(handlerProps(astToNative(ast))).toEqual([])
    expect(
      handlerProps(astToNative(ast, { overrides: { Btn: Aside } }))
    ).toEqual(['onClick=string'])
  })

  it('writes no attribute of a hand-built code block, since a native code block takes only its style and neither data-x nor the handler reaches it', () => {
    const ast = parser('```js\nx\n```')
    Object.assign(ast[0], { attrs: { 'data-x': 'y', onclick: 'alert(1)' } })
    const result = astToNative(ast)
    expect(serialize(result)).toBe('<View><Text>x</Text></View>')
    expect(propNames(result)).toEqual([])
  })

  it.each([
    [
      '<my-widget onclick={alert(1)}>x</my-widget>',
      undefined,
      '<Text>x</Text>',
    ],
    ['<my-widget onclick={alert(1)}>x</my-widget>', widget, '<Text>x</Text>'],
    [
      '<div><img src=x onerror="alert(1)"></div>',
      undefined,
      '<View><Text><Image></Image></Text></View>',
    ],
  ])('renders %j with %j, stored without its private fields, as %j', (input, overrides, expected) => {
    const result = astToNative(storedAST(input, overrides), { overrides })
    expect(serialize(result)).toBe(expected)
    expect(handlerProps(result)).toEqual([])
  })
})

describe('emphasis that follows emphasis', () => {
  it('renders as two elements', () => {
    expect(serialize(compiler('_a_*b*'))).toBe(
      '<Text><Text>a</Text><Text>b</Text></Text>'
    )
  })

  it('renders as three elements across a chain of alternating delimiters', () => {
    expect(serialize(compiler('*a*_b_*c*'))).toBe(
      '<Text><Text>a</Text><Text>b</Text><Text>c</Text></Text>'
    )
  })
})

describe('emphasis nested past the inline depth limit', () => {
  it('leaves the delimiters outside the 199th level as literal text', () => {
    expect(serialize(compiler(`${'*'.repeat(6000)}a${'*'.repeat(6000)}`))).toBe(
      `<Text>${'*'.repeat(5602)}${'<Text>'.repeat(199)}a${'</Text>'.repeat(199)}${'*'.repeat(5602)}</Text>`
    )
  })
})

describe('a www. bare URL needs a dot inside its own span', () => {
  const pressHandlers = (input: string) =>
    treeProps(compiler(input))
      .filter(([name]) => name === 'onPress')
      .map(([name, value]) => `${name}=${typeof value}`)

  it('ignores a dot in the text after the URL', () => {
    expect(serialize(compiler('www.foo bar.com'))).toBe(
      '<Text>www.foo bar.com</Text>'
    )
    expect(pressHandlers('www.foo bar.com')).toEqual([])
  })

  it('links a URL whose own span holds a dot', () => {
    expect(serialize(compiler('www.foo.com bar'))).toBe(
      '<Text><Text>www.foo.com</Text> bar</Text>'
    )
    expect(pressHandlers('www.foo.com bar')).toEqual(['onPress=function'])
  })

  it('counts a trailing dot that ends the sentence', () => {
    expect(serialize(compiler('www.foo. bar'))).toBe(
      '<Text><Text>www.foo</Text>. bar</Text>'
    )
    expect(pressHandlers('www.foo. bar')).toEqual(['onPress=function'])
  })
})

describe('bare URLs in a run without spaces', () => {
  const pressedUrls = (input: string) => {
    const onLinkPress = mock((_url: string, _title?: string) => {})
    for (const [name, value] of treeProps(compiler(input, { onLinkPress }))) {
      if (name === 'onPress' && typeof value === 'function') {
        value()
      }
    }
    return onLinkPress.mock.calls.map(([url]) => url)
  }

  it('links a later www. address whose own paren balance trims differently', () => {
    expect(serialize(compiler('www.(www.ab_.))'))).toBe(
      '<Text>www.(<Text>www.ab</Text>_.))</Text>'
    )
    expect(pressedUrls('www.(www.ab_.))')).toEqual(['http://www.ab'])
  })

  it('links the earliest candidate whose trailing parens leave a clean domain', () => {
    expect(serialize(compiler('www._)www._(www.c).).'))).toBe(
      '<Text>www.<Text>)www.</Text>(<Text>www.c</Text>).).</Text>'
    )
    expect(pressedUrls('www._)www._(www.c).).')).toEqual(['http://www.c'])
  })

  it('links the whole run once its last two segments are clean', () => {
    expect(serialize(compiler('www._)www._(www.c.d).).'))).toBe(
      '<Text><Text>www._)www._(www.c.d</Text>).).</Text>'
    )
    expect(pressedUrls('www._)www._(www.c.d).).')).toEqual([
      'http://www._)www._(www.c.d',
    ])
  })

  it('links a scheme URL after a rejected one', () => {
    expect(serialize(compiler('http://a_b.c_dhttp://x.y'))).toBe(
      '<Text>http://a_b.c_d<Text>http://x.y</Text></Text>'
    )
    expect(pressedUrls('http://a_b.c_dhttp://x.y')).toEqual(['http://x.y'])
  })

  it('links a www. address past a slash that ended a rejected domain', () => {
    expect(serialize(compiler('www.a_/www.b.c'))).toBe(
      '<Text>www.a_/<Text>www.b.c</Text></Text>'
    )
    expect(pressedUrls('www.a_/www.b.c')).toEqual(['http://www.b.c'])
  })

  it('links a later candidate past a slash that reuses the rejected domain verdict', () => {
    expect(serialize(compiler('www.x_www.y/a.b'))).toBe(
      '<Text>www.x_<Text>www.y/a.b</Text></Text>'
    )
    expect(pressedUrls('www.x_www.y/a.b')).toEqual(['http://www.y/a.b'])
  })

  it('keeps a ] inside the domain and trims the unmatched trailing ) and ]', () => {
    expect(serialize(compiler('www._]www.a.b)].'))).toBe(
      '<Text><Text>www._]www.a.b</Text>)].</Text>'
    )
    expect(pressedUrls('www._]www.a.b)].')).toEqual(['http://www._%5Dwww.a.b'])
  })

  it('keeps a trailing ] its [ opened while trimming the unmatched one', () => {
    expect(serialize(compiler('www._[www.a.b)]].'))).toBe(
      '<Text><Text>www._[www.a.b)]</Text>].</Text>'
    )
    expect(pressedUrls('www._[www.a.b)]].')).toEqual([
      'http://www._%5Bwww.a.b)%5D',
    ])
  })

  it('links a later www. address past a [ that the first candidate never closes', () => {
    expect(serialize(compiler('www.[www.a.b_]'))).toBe(
      '<Text>www.[<Text>www.a.b</Text>_]</Text>'
    )
    expect(pressedUrls('www.[www.a.b_]')).toEqual(['http://www.a.b'])
  })

  it('keeps a trailing ] a later candidate shares with a [ inside its own run', () => {
    expect(serialize(compiler('www._[www.a.b])'))).toBe(
      '<Text><Text>www._[www.a.b]</Text>)</Text>'
    )
    expect(pressedUrls('www._[www.a.b])')).toEqual([
      'http://www._%5Bwww.a.b%5D',
    ])
  })

  it('stays text when a ] before a later candidate leaves it no clean domain', () => {
    expect(serialize(compiler('www.]www.a.b_[]'))).toBe(
      '<Text>www.]www.a.b_[]</Text>'
    )
    expect(pressedUrls('www.]www.a.b_[]')).toEqual([])
  })

  it('stays text when a nested [ pair closes after an underscore in the last segment', () => {
    expect(serialize(compiler('www.[[a.b]_]'))).toBe(
      '<Text>www.[[a.b]_]</Text>'
    )
    expect(pressedUrls('www.[[a.b]_]')).toEqual([])
  })

  it('ends the link at the last closer when a kept ) and a kept ] both remain, so a lone link is the paragraph only Text', () => {
    expect(serialize(compiler('www.[.()]'))).toBe('<Text>www.[.()]</Text>')
    expect(pressedUrls('www.[.()]')).toEqual(['http://www.%5B.()%5D'])
  })

  it('stays text when a scheme URL has an empty domain', () => {
    expect(serialize(compiler('http://.'))).toBe('<Text>http://.</Text>')
    expect(pressedUrls('http://.')).toEqual([])
  })

  it('stays text when a www. address trims away to nothing', () => {
    expect(serialize(compiler('www._www..'))).toBe('<Text>www._www..</Text>')
    expect(pressedUrls('www._www..')).toEqual([])
  })
})

describe('a bare URL inside [ ] text ends at the ] that closes it', () => {
  it.each([
    [
      '[GitHub repo][https://github.com/litejs/natural-compare-lite]',
      '<Text>[GitHub repo][<Text>https://github.com/litejs/natural-compare-lite</Text>]</Text>',
    ],
    [
      '[see https://example.com/a]',
      '<Text>[see <Text>https://example.com/a</Text>]</Text>',
    ],
    [
      '[see www.example.com/a]',
      '<Text>[see <Text>www.example.com/a</Text>]</Text>',
    ],
    [
      '[see **https://example.com/a**]',
      '<Text>[see <Text><Text>https://example.com/a</Text></Text>]</Text>',
    ],
    [
      '[see https://example.com/?a[0]=1]',
      '<Text>[see <Text>https://example.com/?a[0]=1</Text>]</Text>',
    ],
    [
      'see https://example.com/a]',
      '<Text>see <Text>https://example.com/a</Text>]</Text>',
    ],
    [
      '[a] https://example.com/a]',
      '<Text>[a] <Text>https://example.com/a</Text>]</Text>',
    ],
    [
      '\\[see https://example.com/a]',
      '<Text>[see <Text>https://example.com/a</Text>]</Text>',
    ],
    [
      '[see ~~https://example.com/a]~~',
      '<Text>[see <Text><Text>https://example.com/a</Text>]</Text></Text>',
    ],
    [
      '[see ==https://example.com/a]==',
      '<Text>[see <Text><Text>https://example.com/a</Text>]</Text></Text>',
    ],
    [
      '==https://example.com/a==',
      '<Text><Text><Text>https://example.com/a</Text></Text></Text>',
    ],
    [
      '==https://x.y/?t=YQ== b',
      '<Text><Text><Text>https://x.y/?t=YQ</Text></Text> b</Text>',
    ],
    [
      'https://x.y/?t=YQ== b',
      '<Text><Text>https://x.y/?t=YQ==</Text> b</Text>',
    ],
    [
      '~~a https://x.y/?t=YQ== b~~',
      '<Text><Text>a <Text>https://x.y/?t=YQ==</Text> b</Text></Text>',
    ],
    [
      "~~https://example.com/a~~'",
      "<Text><Text><Text>https://example.com/a</Text></Text>'</Text>",
    ],
    [
      '[see <span>https://example.com/a]</span>',
      '<Text>[see <Text><Text>https://example.com/a</Text>]</Text></Text>',
    ],
    [
      '[see https://example.com/a\\]]',
      '<Text>[see <Text>https://example.com/a</Text>]]</Text>',
    ],
    [
      '![see https://example.com/a]',
      '<Text>![see <Text>https://example.com/a</Text>]</Text>',
    ],
    [
      '[^see https://example.com/a]',
      '<Text>[^see <Text>https://example.com/a</Text>]</Text>',
    ],
    [
      '[see `]` https://example.com/a]',
      '<Text>[see <Text>]</Text> <Text>https://example.com/a</Text>]</Text>',
    ],
    [
      '[[see https://example.com/a]]',
      '<Text>[[see <Text>https://example.com/a</Text>]]</Text>',
    ],
    [
      '[see https://example.com/a.]',
      '<Text>[see <Text>https://example.com/a</Text>.]</Text>',
    ],
    [
      '[see https://example.com/?a[0=1]',
      '<Text>[see <Text>https://example.com/?a[0=1]</Text></Text>',
    ],
  ])('renders %j as %j', (input, expected) => {
    expect(serialize(compiler(input, { forceBlock: true }))).toBe(expected)
  })

  it('ends it there with optimizeForStreaming too', () => {
    const input = '[see https://example.com/a] after'
    const expected =
      '<Text>[see <Text>https://example.com/a</Text>] after</Text>'
    expect(serialize(compiler(input, { forceBlock: true }))).toBe(expected)
    expect(
      serialize(
        compiler(input, { forceBlock: true, optimizeForStreaming: true })
      )
    ).toBe(expected)
  })

  it.each([
    ['[see https://example.com/a]', 'https://example.com/a'],
    ['[see https://example.com/?a[0]=1]', 'https://example.com/?a%5B0%5D=1'],
  ])('opens %j at %j when pressed (serialize drops props, so the target a press opens is read from the handler)', (input, expected) => {
    const onLinkPress = mock((_url: string) => {})
    const link = findLinkElement(
      compiler(input, { forceBlock: true, onLinkPress })
    )
    const onPress = link.props.onPress
    if (typeof onPress !== 'function') {
      throw new Error('Expected link onPress handler')
    }
    onPress()

    expect(onLinkPress).toHaveBeenCalledWith(expected, undefined)
  })
})

describe('override props that have no attribute form in the html compiler', () => {
  it('hands the element every value, leaving the DOM renderer to decide what each writes', () => {
    const noop = () => {}
    const result = compiler('# hi', {
      overrides: {
        h1: {
          props: {
            'data-a': false,
            'data-b': noop,
            'data-c': { x: 1 },
            'data-d': 'k',
            style: {},
          },
        },
      },
    })

    expect(
      treeProps(result).filter(
        ([name]) => name.startsWith('data-') || name === 'style'
      )
    ).toEqual([
      [
        'style',
        [
          [
            { fontSize: 16, lineHeight: 24 },
            {
              fontSize: 28,
              fontWeight: '600',
              lineHeight: 36,
              marginBottom: 12,
              marginTop: 8,
            },
          ],
          {},
        ],
      ],
      ['data-a', false],
      ['data-b', noop],
      ['data-c', { x: 1 }],
      ['data-d', 'k'],
    ])
    expect(serialize(result)).toBe('<Text>hi</Text>')
  })
})

describe('render depth limit', () => {
  function elementDepth(tree: React.ReactNode): number {
    let depth = 0
    let current: React.ReactNode = tree
    while (current && typeof current === 'object') {
      if (Array.isArray(current)) {
        current = current[0]
      } else if (isTestElement(current)) {
        depth++
        current = current.props.children
      } else {
        break
      }
    }
    return depth
  }

  it.each([
    [$.MAX_RENDER_DEPTH - 1, $.MAX_RENDER_DEPTH - 1],
    [$.MAX_RENDER_DEPTH, $.MAX_RENDER_DEPTH],
    [$.MAX_RENDER_DEPTH + 1, $.MAX_RENDER_DEPTH],
    [$.MAX_RENDER_DEPTH * 2, $.MAX_RENDER_DEPTH],
  ])('renders %i nested block quotes %i levels deep', (count, expected) => {
    expect(elementDepth(astToNative(quotesDeep(count)))).toBe(expected)
  })

  it.each([
    [$.MAX_RENDER_DEPTH, 'x'],
    [$.MAX_RENDER_DEPTH + 1, ''],
    [$.MAX_RENDER_DEPTH * 2, ''],
  ])('continues the depth through renderChildren in a renderRule for %i nested block quotes', (count, expected) => {
    expect(
      astToNative(quotesDeep(count), {
        wrapper: null,
        renderRule: (next, node, renderChildren) =>
          node.type === RuleType.blockQuote
            ? renderChildren(node.children)
            : next(),
      })
    ).toEqual([expected])
  })
})

function linkPresses(
  input: string
): Array<{ title: string | undefined; url: string }> {
  const presses: Array<{ title: string | undefined; url: string }> = []
  const tree = compiler(input, {
    onLinkPress: (url, title) => {
      presses.push({ title, url })
    },
  })
  for (const [name, value] of treeProps(tree)) {
    if (name === 'onPress' && typeof value === 'function') {
      value()
    }
  }
  return presses
}

describe('a setext underline after a lazy line in a block quote', () => {
  const H1 = () => null
  const H2 = () => null

  it.each([
    ['> a\nb\n> ---', '<View><H2>a\nb</H2></View>'],
    ['> a\nb\n>\n> c\n> ===', '<View><Text>a\nb</Text><H1>c</H1></View>'],
    ['> a\nb\n===', '<View><Text>a\nb\n===</Text></View>'],
  ])('renders %j as %j', (input, expected) => {
    expect(serialize(compiler(input, { overrides: { h1: H1, h2: H2 } }))).toBe(
      expected
    )
  })
})

describe('code span edge spaces', () => {
  it.each([
    ['` a `', '<Text>a</Text>'],
    ['` \t `', '<Text>\t</Text>'],
    ['`   `', '<Text> </Text>'],
  ])('renders %j as %j', (input, expected) => {
    expect(serialize(compiler(input))).toBe(expected)
  })
})

describe('code spans at the streaming edge', () => {
  it.each([
    ['x `` a ` b `` y', '<Text>x <Text>a ` b</Text> y</Text>'],
    ['x \\` y', '<Text>x ` y</Text>'],
  ])('renders %j as %j with optimizeForStreaming, as without it', (input, expected) => {
    expect(serialize(compiler(input, { optimizeForStreaming: true }))).toBe(
      expected
    )
    expect(serialize(compiler(input))).toBe(expected)
  })
})

describe('a bare email address with an underscore', () => {
  it.each([
    [
      'foo@a_b.c',
      '<Text>foo@a_b.c</Text>',
      [{ title: undefined, url: 'mailto:foo@a_b.c' }],
    ],
    [
      'foo@a.b_c.d',
      '<Text>foo@a.b_c.d</Text>',
      [{ title: undefined, url: 'mailto:foo@a.b_c.d' }],
    ],
    ['a.b-c_d@a.b_', '<Text>a.b-c_d@a.b_</Text>', []],
  ])('renders %j as %j and presses to %j', (input, expected, presses) => {
    expect(serialize(compiler(input))).toBe(expected)
    expect(linkPresses(input)).toEqual(presses)
  })
})

describe('a heading whose slug is only whitespace', () => {
  it('renders the text, since native emits no heading id so the slug rule does not apply', () => {
    expect(serialize(compiler('# Hi', { slugify: () => ' ' }))).toBe(
      '<Text>Hi</Text>'
    )
  })
})

describe('entity text in image alt and link title', () => {
  it('shows the literal text &copy; in an image accessibility label', () => {
    expect(
      treeProps(compiler('![&amp;copy;](x)')).filter(
        ([name]) => name === 'accessibilityLabel' || name === 'source'
      )
    ).toEqual([
      ['source', { uri: 'x' }],
      ['accessibilityLabel', '&copy;'],
    ])
  })

  it('passes the literal text &copy; as the link title to onLinkPress', () => {
    expect(linkPresses('[a](x "&amp;copy;")')).toEqual([
      { title: '&copy;', url: 'x' },
    ])
  })
})

describe('frontmatter above a reference definition', () => {
  const input = '---\ntitle: x\n---\n\n# H\n\n[a]\n\n[a]: /u'

  it('drops the frontmatter and links the reference', () => {
    expect(serialize(compiler(input))).toBe(
      '<View><Text>H</Text><Text><Text>a</Text></Text></View>'
    )
    expect(linkPresses(input)).toEqual([{ title: undefined, url: '/u' }])
  })

  it('keeps the frontmatter with preserveFrontmatter and links the reference', () => {
    expect(serialize(compiler(input, { preserveFrontmatter: true }))).toBe(
      '<View><View><Text>---\ntitle: x\n---</Text></View><Text>H</Text><Text><Text>a</Text></Text></View>'
    )
  })

  it('keeps a document that is only frontmatter, closed at the end of input, as frontmatter', () => {
    expect(
      serialize(
        compiler('---\ntitle: Draft\n---', { preserveFrontmatter: true })
      )
    ).toBe('<View><Text>---\ntitle: Draft\n---</Text></View>')
  })
})
