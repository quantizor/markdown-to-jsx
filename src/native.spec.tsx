// @ts-nocheck
// Import the mock setup FIRST - this sets up mock.module before native.tsx imports react-native
import './__mocks__/react-native'

// Now import test utilities and the module under test
import { afterEach, expect, it, describe, mock, spyOn } from 'bun:test'
import * as React from 'react'
import { Text, View, Image } from 'react-native'

import Markdown, {
  compiler,
  astToNative,
  parser,
  RuleType,
  sanitizer,
  slugify,
  type NativeOptions,
  type NativeStyleKey,
} from './native'

function extractTextContent(element: React.ReactNode): string {
  if (typeof element === 'string') return element
  if (typeof element === 'number') return String(element)
  if (element === null || element === undefined) return ''
  if (!React.isValidElement(element)) return ''
  const props = element.props
  if (props && props.children !== undefined) {
    if (Array.isArray(props.children)) {
      return props.children.map(extractTextContent).join('')
    }
    return extractTextContent(props.children)
  }
  return ''
}

function getFirstElement(result: React.ReactNode): React.ReactElement {
  if (React.isValidElement(result)) {
    return result
  }
  if (Array.isArray(result)) {
    for (const item of result) {
      if (React.isValidElement(item)) {
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
    typeof element.type === 'object' &&
    element.type !== null &&
    'render' in element.type
  ) {
    const elementRender = element.type.render
    const componentRender = component.render
    if (elementRender && componentRender) {
      return elementRender === componentRender
    }
  }
  return false
}

function findAllByType(
  element: React.ReactNode,
  component: React.ComponentType<any>
): React.ReactElement[] {
  const results: React.ReactElement[] = []
  if (!React.isValidElement(element)) return results
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
): React.ReactElement {
  if (!React.isValidElement(element)) {
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

function findTextElement(element: React.ReactNode): React.ReactElement {
  if (React.isValidElement(element) && isComponentType(element, Text)) {
    return element
  }
  if (Array.isArray(element)) {
    for (const item of element) {
      if (React.isValidElement(item) && isComponentType(item, Text)) {
        return item
      }
    }
  }
  return findChildByType(element, Text)
}

function findAllTextElements(element: React.ReactNode): React.ReactElement[] {
  const results: React.ReactElement[] = []
  if (React.isValidElement(element) && isComponentType(element, Text)) {
    results.push(element)
  }
  if (Array.isArray(element)) {
    for (const item of element) {
      results.push(...findAllTextElements(item))
    }
  }
  if (React.isValidElement(element)) {
    results.push(...findAllByType(element, Text))
  }
  return results
}

function findLinkElement(element: React.ReactNode): React.ReactElement {
  // Check if element itself has onPress (for custom components)
  if (React.isValidElement(element)) {
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

function getComponentStyle(element: React.ReactElement): any {
  const props = element.props
  if (!props.style) {
    throw new Error('Component has no style prop')
  }
  if (Array.isArray(props.style)) {
    return Object.assign({}, ...props.style.filter(Boolean))
  }
  return props.style
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
    const CustomLink = props =>
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
    const CustomImage = props =>
      React.createElement(Image, { ...props, testID: 'custom-image' })
    const result = compiler('![Alt](image.jpg)', {
      forceBlock: true,
      overrides: { img: CustomImage },
    })
    // Image is inside a paragraph, find it
    const element = getFirstElement(result)
    const children = element.props.children
    const imageElement = Array.isArray(children) ? children[0] : children
    expect(imageElement.type).toBe(CustomImage)
    expect(imageElement.props.source.uri).toBe('image.jpg')
  })

  it('should allow overriding with component and props', () => {
    const CustomText = props => React.createElement(Text, props)
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
    expect(props.source.uri).toBe('image.jpg')
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

  it('should render GFM task as Text with checkbox marker', () => {
    const result = compiler('- [x] Task')
    const element = getFirstElement(result)
    expect(isComponentType(element, View)).toBe(true)
    const text = extractTextContent(element)
    expect(text).toContain('Task')
    expect(text).toMatch(/\[[x ]\]/)
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
    // Call Markdown component directly to get its output
    const result = Markdown({
      children: 'Hello\n\nWorld',
      options: {
        wrapperProps: { testID: 'markdown-wrapper' },
      },
    })
    expect(React.isValidElement(result)).toBe(true)
    const props = result.props
    expect(props.testID).toBe('markdown-wrapper')
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
    expect(props.source.uri).toBe('/xyz.png')
  })

  it('should render image with accessibilityLabel from alt text', () => {
    const result = compiler('![Alt text](/image.png)')
    const imageElement = findChildByType(result, Image)
    const props = imageElement.props
    expect(props.source).toBeDefined()
    expect(props.source.uri).toBe('/image.png')
    expect(props.accessibilityLabel).toBe('Alt text')
  })

  it('should handle base64 data URI images', () => {
    const base64Image =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg=='
    const result = compiler(`![Red Dot](${base64Image})`)
    const imageElement = findChildByType(result, Image)
    const props = imageElement.props
    expect(props.source).toBeDefined()
    expect(props.source.uri).toBe(base64Image)
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

describe('edge cases - wrapper rendering', () => {
  it('should handle wrapper null option', () => {
    const result = compiler('Hello\n\nworld!', { wrapper: null })
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
    const firstItem = result[0]
    expect(React.isValidElement(firstItem)).toBe(true)
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
    const props = result.props
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
    expect(result.type).toBe(nullFn)
  })

  it('should handle override that returns null for HTML element', () => {
    const nullFn = () => null
    const result = compiler('<div>Hello</div>', {
      forceBlock: true,
      tagfilter: false,
      overrides: { div: nullFn },
    })
    expect(result.type).toBe(nullFn)
  })

  it('should handle override with component and props', () => {
    const CustomText = props => React.createElement(Text, props)
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
    const Accordion = ({ children }) => children
    const AccordionItem = ({ children }) => children
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
    // Custom HTML tags are parsed as htmlBlock nodes
    // The result contains the Accordion element inside a wrapper
    const element = getFirstElement(result)
    const accordionElement =
      element.props?.children?.[0] || element.props?.children
    expect(accordionElement?.type).toBe(Accordion)
    expect(extractTextContent(result)).toContain('test')
  })

  it('should handle override with forwardRef component', () => {
    const CustomText = React.forwardRef((props, ref) =>
      React.createElement('Text', { ...props, ref })
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
    expect(element.type.$$typeof).toBe(Symbol.for('react.forward_ref'))
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
})

describe('options immutability', () => {
  it('should not mutate options object when calling astToNative multiple times', () => {
    // Test that astToNative doesn't mutate the options object when called multiple times
    // This is important for memoization - if the same options object is reused,
    // mutations could cause unexpected side effects
    const markdown = '# Hello world'
    const ast = parser(markdown)
    const options = { slugify: (input: string) => input.toLowerCase() }
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
    const options = { slugify: (input: string) => input.toLowerCase() }
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
