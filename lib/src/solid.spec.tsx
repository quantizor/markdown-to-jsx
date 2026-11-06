/** @jsxImportSource solid-js */

import { afterEach, describe, expect, it, mock } from 'bun:test'
import { createSignal, type JSX } from 'solid-js'

import {
  astToJSX,
  compiler,
  parser,
  RuleType,
  type SolidOptions,
} from './solid.tsx'
import { treeProps } from './test-tree.ts'
import type { MarkdownToJSX } from './types.ts'

afterEach(() => {
  mock.clearAllMocks()
})

// Optimized helper to extract text content from JSX structure
function extractTextContent(
  element: JSX.Element | JSX.Element[] | string | null | undefined
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
  if (typeof element === 'object') {
    // SolidJS structure: { t: tag, p: props }
    if ('p' in element && element.p && typeof element.p === 'object') {
      const props = element.p as Record<string, unknown>
      const tag = (element as { t?: string }).t
      if (tag === 'img' && typeof props.alt === 'string') {
        return props.alt
      }
      // Check innerHTML for text content
      if (props.innerHTML !== undefined) {
        return extractTextContent(
          props.innerHTML as JSX.Element | JSX.Element[] | string
        )
      }
      if (props.children !== undefined) {
        return extractTextContent(
          props.children as JSX.Element | JSX.Element[] | string
        )
      }
    }
    // React-style fallback
    if (
      'props' in element &&
      element.props &&
      typeof element.props === 'object'
    ) {
      const props = element.props as { children?: unknown; innerHTML?: unknown }
      // Check innerHTML for text content
      if (props.innerHTML !== undefined) {
        return extractTextContent(
          props.innerHTML as JSX.Element | JSX.Element[] | string
        )
      }
      if (props.children !== undefined) {
        return extractTextContent(
          props.children as JSX.Element | JSX.Element[] | string
        )
      }
    }
  }
  return ''
}

// Serialize a Solid structural element tree to an HTML-like string so nesting
// and sibling order (not just text presence) are asserted.
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
  const node = el as { t?: string; p?: Record<string, unknown> }
  const tag = node.t
  const props = node.p || {}
  if (!tag) {
    return serialize(props.children ?? props.innerHTML ?? '')
  }
  const inner =
    props.innerHTML === undefined
      ? serialize(props.children ?? '')
      : String(props.innerHTML)
  return `<${tag}>${inner}</${tag}>`
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
})

it('wraps multiple block element returns in a div to avoid invalid nesting errors', () => {
  const result = compiler('# Boop\n\n## Blep')
  const text = extractTextContent(result)
  expect(text).toContain('Boop')
  expect(text).toContain('Blep')
  expect(result).not.toBeNull()
})

it('wraps solely inline elements in a span, rather than a div', () => {
  const result = compiler("Hello. _Beautiful_ day isn't it?")
  const text = extractTextContent(result)
  expect(text).toContain('Hello.')
  expect(text).toContain('Beautiful')
  expect(text).toContain("day isn't it?")
})

describe('break elements', () => {
  it('should handle breakLine (hard break)', () => {
    const result = compiler('Line 1  \nLine 2')
    const text = extractTextContent(result)
    expect(text).toContain('Line 1')
    expect(text).toContain('Line 2')
  })

  it('should handle breakThematic (horizontal rule)', () => {
    const result = compiler('---')
    expect(result).not.toBeNull()
  })
})

describe('inline textual elements', () => {
  it('should handle triple-emphasized text with mixed syntax 1/2', () => {
    const result = compiler('**_Hello._**')
    const text = extractTextContent(result)
    expect(text).toContain('Hello.')
  })

  it('should handle triple-emphasized text with mixed syntax 2/2', () => {
    const result = compiler('_**Hello.**_')
    const text = extractTextContent(result)
    expect(text).toContain('Hello.')
  })

  it('should handle the alternate form of bold/italic', () => {
    const result = compiler('___Hello.___')
    const text = extractTextContent(result)
    expect(text).toContain('Hello.')
  })

  it('should handle deleted text', () => {
    const result = compiler('~~Hello.~~')
    const text = extractTextContent(result)
    expect(text).toContain('Hello.')
  })

  it('should handle escaped text', () => {
    const result = compiler('Hello.\\_\\_foo\\_\\_')
    const text = extractTextContent(result)
    expect(text).toContain('Hello.__foo__')
  })
})

describe('headings', () => {
  it('should render h1 headings', () => {
    const result = compiler('# Hello World')
    expect(extractTextContent(result)).toContain('Hello World')
  })

  it('should render h2 headings', () => {
    const result = compiler('## Hello World')
    expect(extractTextContent(result)).toContain('Hello World')
  })

  it('should generate IDs for headings', () => {
    const result = compiler('# Hello World')
    expect(JSON.stringify(result)).toContain('"id"')
  })
})

describe('links', () => {
  it('should render inline links', () => {
    expect(
      extractTextContent(compiler('[Link](https://example.com)'))
    ).toContain('Link')
  })

  it('should render reference links', () => {
    const result = compiler('[Link][ref]\n\n[ref]: https://example.com')
    expect(extractTextContent(result)).toContain('Link')
  })

  it('should handle links without target', () => {
    expect(extractTextContent(compiler('[Link]()'))).toContain('Link')
  })

  it('should handle links with title', () => {
    expect(
      JSON.stringify(compiler('[Link](https://example.com "Title")'))
    ).toContain('Title')
  })

  it('should encode backslashes in URLs', () => {
    expect(JSON.stringify(compiler('[Link](path\\to\\file)'))).toContain('%5C')
  })

  it('should encode backticks in URLs', () => {
    expect(JSON.stringify(compiler('[Link](path`to`file)'))).toContain('%60')
  })

  it('should encode Unicode characters in URLs', () => {
    expect(
      JSON.stringify(compiler('[Link](https://example.com/测试)'))
    ).toContain('%')
  })

  it('should encode non-BMP characters in URLs', () => {
    expect(
      JSON.stringify(
        compiler('[Author post](https://例え.テスト/著者/𠮷田/投稿-🚀)')
      )
    ).toContain(
      'https://%E4%BE%8B%E3%81%88.%E3%83%86%E3%82%B9%E3%83%88/%E8%91%97%E8%80%85/%F0%A0%AE%B7%E7%94%B0/%E6%8A%95%E7%A8%BF-%F0%9F%9A%80'
    )
  })

  it('should preserve existing percent-encoded sequences in URLs', () => {
    const str = JSON.stringify(
      compiler('[Link](https://example.com/path%20to%20file)')
    )
    expect(str).toContain('%20')
  })

  it('should handle percent encoding at end of URL', () => {
    expect(compiler('[Link](https://example.com/path%2)')).not.toBeNull()
  })

  it('should handle invalid percent encoding sequences', () => {
    expect(compiler('[Link](https://example.com/path%XX)')).not.toBeNull()
  })

  it('should handle URLs that need no encoding (fast path)', () => {
    expect(compiler('[Link](https://example.com/path)')).not.toBeNull()
  })

  it('should handle percent-encoded sequences with backslashes', () => {
    const str = JSON.stringify(
      compiler('[Link](https://example.com/path%20\\to\\file)')
    )
    expect(str).toContain('%20')
    expect(str).toContain('%5C')
  })

  it('should handle percent-encoded sequences with backticks', () => {
    const str = JSON.stringify(
      compiler('[Link](https://example.com/path%20`to`file)')
    )
    expect(str).toContain('%20')
    expect(str).toContain('%60')
  })
})

describe('images', () => {
  it('should render images', () => {
    expect(extractTextContent(compiler('![Alt text](image.png)'))).toContain(
      'Alt text'
    )
  })

  it('should handle images without alt text', () => {
    expect(compiler('![](image.png)')).not.toBeNull()
  })

  it('should handle images with title', () => {
    expect(JSON.stringify(compiler('![Alt](image.png "Title")'))).toContain(
      'Title'
    )
  })
})

describe('lists', () => {
  it('should render unordered lists', () => {
    const text = extractTextContent(compiler('- Item 1\n- Item 2'))
    expect(text).toContain('Item 1')
    expect(text).toContain('Item 2')
  })

  it('should render ordered lists', () => {
    const text = extractTextContent(compiler('1. Item 1\n2. Item 2'))
    expect(text).toContain('Item 1')
    expect(text).toContain('Item 2')
  })

  it('should handle ordered lists with start attribute', () => {
    expect(JSON.stringify(compiler('3. Item 3\n4. Item 4'))).toContain(
      '"start"'
    )
  })
})

describe('footnote references', () => {
  it('should handle footnote references', () => {
    const text = extractTextContent(compiler('Text[^1]\n\n[^1]: Footnote'))
    expect(text).toContain('Text')
  })
})

describe('code blocks', () => {
  it('should render fenced code blocks', () => {
    expect(
      extractTextContent(compiler('```js\nconsole.log("hello");\n```'))
    ).toContain('console.log')
  })

  it('should render inline code', () => {
    expect(extractTextContent(compiler('This is `inline code`'))).toContain(
      'inline code'
    )
  })

  it('should handle code blocks with language', () => {
    expect(JSON.stringify(compiler('```javascript\ncode\n```'))).toContain(
      'language-javascript'
    )
  })
})

describe('tables', () => {
  it('should render tables', () => {
    const text = extractTextContent(
      compiler(
        '| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |'
      )
    )
    expect(text).toContain('Header 1')
    expect(text).toContain('Cell 1')
  })

  it('should handle table cells with alignment', () => {
    const text = extractTextContent(
      compiler(
        '| Left | Center | Right |\n|:-----|:------:|------:|\n| L    |   C    |     R |'
      )
    )
    expect(text).toContain('Left')
    expect(text).toContain('Center')
    expect(text).toContain('Right')
  })

  it('should handle table cells without alignment (null)', () => {
    const text = extractTextContent(compiler('| A | B |\n|---|---|\n| 1 | 2 |'))
    expect(text).toContain('A')
    expect(text).toContain('B')
  })

  it('should handle table header cells with/without alignment', () => {
    expect(
      compiler('| Left | Center |\n|:-----|:------:|\n| L    |   C    |')
    ).not.toBeNull()
  })

  it('#513 should not render empty tbody when table has no data rows', () => {
    const result = compiler('| A | B |\n|---|---|')
    const str = JSON.stringify(result)
    expect(str).not.toContain('tbody')
  })
})

describe('blockquotes', () => {
  it('should render blockquotes', () => {
    expect(extractTextContent(compiler('> This is a quote'))).toContain(
      'This is a quote'
    )
  })

  it('should handle blockquote with alert', () => {
    const result = compiler('> [!NOTE]\n> Something important')
    const text = extractTextContent(result)
    expect(text).toContain('NOTE')
    expect(text).toContain('Something important')
    expect(JSON.stringify(result)).toContain('markdown-alert-note')
  })

  it('should handle blockquote with different alert types', () => {
    const alerts = ['WARNING', 'TIP', 'IMPORTANT', 'CAUTION']
    alerts.forEach(alert => {
      const result = compiler(`> [!${alert}]\n> Alert content`)
      expect(extractTextContent(result)).toContain(alert)
      expect(JSON.stringify(result)).toContain(
        `markdown-alert-${alert.toLowerCase()}`
      )
    })
  })
})

describe('Markdown component', () => {
  it('should render static content', () => {
    expect(extractTextContent(compiler('# Hello World'))).toContain(
      'Hello World'
    )
  })

  it('should handle null/undefined children', () => {
    const result = compiler('')
    expect(result).toBeNull()
    expect(extractTextContent(result)).toBe('')
  })

  it('should not mutate AST when props change (memoization fix)', () => {
    // This test verifies that AST mutation doesn't cause duplicate headers
    // when the Markdown component's memoization reuses the AST
    const markdown = '> [!NOTE]\n> Something important'
    const ast = parser(markdown)

    // Store original children count before any rendering
    const blockquoteNode = ast.find(
      node =>
        node.type === RuleType.blockQuote &&
        'alert' in node &&
        node.alert === 'NOTE'
    ) as MarkdownToJSX.BlockQuoteNode | undefined
    expect(blockquoteNode).toBeDefined()
    const originalChildrenCount = blockquoteNode?.children?.length || 0

    // Call astToJSX multiple times with different props but same AST
    // This simulates what happens when props change but content doesn't
    const result1 = astToJSX(ast, { wrapperProps: { class: 'first' } })
    const result2 = astToJSX(ast, { wrapperProps: { class: 'second' } })
    const result3 = astToJSX(ast, { wrapperProps: { class: 'third' } })

    // Count occurrences of "NOTE" - should be exactly 1 per result
    const text1 = extractTextContent(result1)
    const text2 = extractTextContent(result2)
    const text3 = extractTextContent(result3)

    // Each result should contain "NOTE" exactly once
    const count1 = (text1.match(/NOTE/g) || []).length
    const count2 = (text2.match(/NOTE/g) || []).length
    const count3 = (text3.match(/NOTE/g) || []).length

    expect(count1).toBe(1)
    expect(count2).toBe(1)
    expect(count3).toBe(1)

    // Verify the AST wasn't mutated - children count should be unchanged
    const finalChildrenCount = blockquoteNode?.children?.length || 0
    expect(finalChildrenCount).toBe(originalChildrenCount)
  })
})

describe('parser and astToJSX', () => {
  it('should parse markdown to AST', () => {
    const ast = parser('# Hello World')
    expect(Array.isArray(ast)).toBe(true)
    expect(ast.length).toBeGreaterThan(0)
  })

  it('should convert AST to JSX', () => {
    expect(extractTextContent(astToJSX(parser('# Hello World')))).toContain(
      'Hello World'
    )
  })

  it('should handle wrapper: null with empty array', () => {
    const ast = parser('')
    const result = astToJSX(ast, { wrapper: null })
    expect(result).toBeNull()
  })

  it('should handle wrapper: null with single element', () => {
    expect(astToJSX(parser('# Hello'), { wrapper: null })).not.toBeNull()
  })

  it('should handle wrapper: null with multiple elements', () => {
    const result = astToJSX(parser('# Hello\n\n## World'), { wrapper: null })
    expect(Array.isArray(result)).toBe(true)
  })

  it('should handle forceWrapper option', () => {
    expect(astToJSX(parser('# Hello'), { forceWrapper: true })).not.toBeNull()
  })

  it('should handle custom wrapper element', () => {
    expect(
      JSON.stringify(astToJSX(parser('# Hello'), { wrapper: 'section' }))
    ).toContain('"t":"h1"')
  })

  it('should handle wrapperProps', () => {
    expect(
      JSON.stringify(
        astToJSX(parser('# Hello\n\n## World'), {
          wrapperProps: { id: 'test' } as JSX.HTMLAttributes<HTMLElement>,
        })
      )
    ).toContain('test')
  })
})

describe('options', () => {
  it('should support overrides', () => {
    expect(
      extractTextContent(
        compiler('# Hello', {
          overrides: {
            h1: { component: 'h2', props: { class: 'custom' } },
          },
        })
      )
    ).toContain('Hello')
  })

  it('should support custom sanitizer', () => {
    expect(
      compiler('[Link](bad)', {
        sanitizer: (value: string) => (value === 'bad' ? null : value),
      })
    ).not.toBeNull()
  })

  it('should support custom slugify', () => {
    expect(
      extractTextContent(
        compiler('# Hello World', {
          slugify: (input: string) => `custom-${input.toLowerCase()}`,
        })
      )
    ).toContain('Hello World')
  })

  // Note: Function component overrides are tested through existing override tests
  // which cover the getTag function branches indirectly

  it('should handle override with component string', () => {
    const _result = compiler('# Hello', {
      overrides: {
        h1: { component: 'h2' },
      },
    })
  })

  it('should handle no override (default tag)', () => {
    expect(compiler('# Hello', {})).not.toBeNull()
  })

  it('should handle override with function component', () => {
    const CustomHeading = (props: Record<string, unknown>) =>
      ({
        t: 'h2',
        p: { ...props, 'data-custom': 'true' },
      }) as unknown as JSX.Element
    expect(
      JSON.stringify(
        compiler('# Hello', {
          overrides: {
            h1: CustomHeading,
          },
        })
      )
    ).toContain('h2')
  })

  it('should handle override with component path as function', () => {
    const CustomHeading = (props: Record<string, unknown>) =>
      ({ t: 'h2', p: props }) as unknown as JSX.Element
    expect(
      JSON.stringify(
        compiler('# Hello', {
          overrides: {
            h1: {
              component: CustomHeading,
            },
          },
        })
      )
    ).toContain('h2')
  })
})

describe('context API', () => {
  it('should work with MarkdownProvider', () => {
    expect(extractTextContent(compiler('# Test'))).toContain('Test')
  })
})

describe('SolidJS-specific functionality', () => {
  describe('no key props', () => {
    it('should not include key props in rendered output', () => {
      expect(JSON.stringify(compiler('# Title\n\n## Subtitle'))).not.toMatch(
        /"key":/
      )
    })

    it('should render lists without key props', () => {
      const result = compiler('- Item 1\n- Item 2\n- Item 3')
      const text = extractTextContent(result)
      expect(text).toContain('Item 1')
      expect(text).toContain('Item 2')
      expect(text).toContain('Item 3')
      expect(JSON.stringify(result)).not.toMatch(/"key":/)
    })

    it('should render table cells without key props', () => {
      const result = compiler('| A | B |\n|---|---|\n| 1 | 2 |')
      const text = extractTextContent(result)
      expect(text).toContain('1')
      expect(text).toContain('2')
      expect(JSON.stringify(result)).not.toMatch(/"key":/)
    })
  })
})

describe('wrapper options', () => {
  it('should return array when wrapper is null', () => {
    const result = compiler('Hello\n\nworld!', { wrapper: null })
    expect(Array.isArray(result)).toBe(true)
    if (Array.isArray(result)) {
      expect(result.length).toBe(2)
    }
  })

  it('should use custom wrapper element', () => {
    const result = compiler('Hello\n\nworld!', { wrapper: 'article' })
    const text = extractTextContent(result)
    expect(text).toContain('Hello')
    expect(text).toContain('world!')
  })

  it('should apply wrapperProps to wrapper', () => {
    const result = compiler('Hello\n\nworld!', {
      wrapper: 'section',
      wrapperProps: { class: 'content', id: 'main' },
    })
    const text = extractTextContent(result)
    expect(text).toContain('Hello')
    expect(text).toContain('world!')
  })

  it('should force wrapper even with single child', () => {
    const result = compiler('Single', {
      wrapper: 'aside',
      forceWrapper: true,
    })
    const text = extractTextContent(result)
    expect(text).toContain('Single')
  })

  it('should not wrap single child by default', () => {
    const result = compiler('Single', { wrapper: 'article' })
    const text = extractTextContent(result)
    expect(text).toContain('Single')
  })
})

describe('tagfilter option', () => {
  // Regression: the render-time tag filter defaulted OFF in solid (raw options
  // flowed to the renderer; only parse options were coerced), so default output
  // mounted live dangerous tags despite the documented default-on protection.
  // Both compiler() and astToJSX must escape.
  it('should escape script tags by default', () => {
    expect(serialize(compiler('<script>alert(1)</script>'))).toBe(
      '<span><script>alert(1)</script></span>'
    )
  })

  it('should escape iframe tags by default', () => {
    expect(serialize(compiler('<iframe src="evil.com"></iframe>'))).toBe(
      '<span><iframe src="evil.com"></iframe></span>'
    )
  })

  it('should escape dangerous tags by default via astToJSX()', () => {
    expect(serialize(astToJSX(parser('<script>alert(1)</script>')))).toBe(
      '<span><script>alert(1)</script></span>'
    )
  })

  it('should not escape when tagfilter is false', () => {
    expect(
      serialize(compiler('<script>\ntest\n</script>', { tagfilter: false }))
    ).toBe('<script>test</script>')
  })

  it('should escape all filtered tags', () => {
    const filteredTags = [
      'title',
      'textarea',
      'style',
      'xmp',
      'iframe',
      'noembed',
      'noframes',
      'script',
      'plaintext',
    ]
    filteredTags.forEach(tag => {
      expect(
        extractTextContent(
          compiler(`<${tag}>content</${tag}>`, { tagfilter: true })
        )
      ).toBe(`<${tag}>content</${tag}>`)
    })
  })

  it('keeps allowed nested tags live inside a filtered parent', () => {
    expect(
      serialize(compiler('<iframe>hi <em>x</em></iframe>', { tagfilter: true }))
    ).toBe('<span><iframe>hi <em>x</em></iframe></span>')
  })

  it('should handle HTML block with rawText when tagfilter is enabled', () => {
    // This tests the rawText branch in HTML block tagfilter
    const _result = compiler('<script>alert("xss")</script>', {
      tagfilter: true,
    })
  })

  it('should format attributes for filtered HTML blocks', () => {
    const result = compiler(
      '<script src="evil.js" type="text/javascript"></script>',
      {
        tagfilter: true,
      }
    )
    const _str = JSON.stringify(result)
    // Should contain the escaped tag with attributes
  })

  it('should handle boolean attributes in filtered HTML blocks', () => {
    const _result = compiler('<script defer>alert("xss")</script>', {
      tagfilter: true,
    })
  })

  it('should skip undefined/null/false attributes in filtered HTML blocks', () => {
    // Test that undefined, null, false attributes are skipped
    const _result = compiler('<script>test</script>', { tagfilter: true })
  })

  it('should handle self-closing filtered tags with rawText', () => {
    const _result = compiler('<script src="evil.js" />', { tagfilter: true })
  })

  it('should handle self-closing filtered tags without rawText', () => {
    const _result = compiler('<iframe src="evil.com" />', { tagfilter: true })
  })

  it('should handle self-closing tags when tagfilter is disabled', () => {
    const _result = compiler('<br />', { tagfilter: false })
  })

  it('should handle HTML self-closing without tagfilter', () => {
    const _result = compiler('<br />', { tagfilter: false })
  })

  it('should handle HTML self-closing with attributes when tagfilter enabled', () => {
    const _result = compiler('<script src="evil.js" />', { tagfilter: true })
  })

  it('should handle Type 1 blocks without HTML tags', () => {
    // This tests the isType1Block && !containsHTMLTags path, which requires
    // the tag filter off: default-on escapes <style> before the verbatim
    // branch can render it.
    const result = compiler('<style>body { color: red; }</style>', {
      tagfilter: false,
    })
    const text = extractTextContent(result)
    expect(text).toContain('body')
    expect(text).toContain('color: red')
  })

  it('should handle Type 1 blocks with tagfilter', () => {
    // Test Type 1 block with tagfilter enabled
    // When tagfilter is enabled, the style tag is escaped, so we test that it's handled
    const result = compiler('<style>body { color: red; }</style>', {
      tagfilter: true,
    })
    const str = JSON.stringify(result)
    // The tag should be escaped when tagfilter is enabled
    expect(str).toContain('style')
  })

  it('should handle HTML blocks with containsPreTags', () => {
    // This tests the containsPreTags path (lines 274-282)
    const result = compiler('<div><pre>code</pre></div>')
    const text = extractTextContent(result)
    expect(text).toContain('code')
  })

  it('should handle HTML blocks with containsPreTags and tagfilter', () => {
    // Test containsPreTags with tagfilter enabled
    const result = compiler('<div><pre>code</pre></div>', { tagfilter: true })
    const text = extractTextContent(result)
    expect(text).toContain('code')
  })

  it('should prevent infinite recursion with selfTagRegex', () => {
    // This tests the selfTagRegex path (lines 300-302)
    // Create a scenario where cleanedText matches the self tag
    const _result = compiler('<div></div>')
  })

  it('should handle HTML blocks with verbatim and parsed content', () => {
    // This tests the processNode function branches (lines 309-341)
    const result = compiler('<div>Hello <strong>world</strong></div>')
    const text = extractTextContent(result)
    expect(text).toContain('Hello')
    expect(text).toContain('world')
  })

  it('should handle processNode with htmlSelfClosing isClosingTag', () => {
    // This tests the htmlSelfClosing with isClosingTag path (lines 312-321)
    // This is tricky to trigger directly, but we can test through HTML parsing
    const _result = compiler('<div>Text</div>')
  })

  it('should handle processNode with paragraph children', () => {
    // This tests the paragraph branch (lines 322-324)
    const result = compiler('<div><p>Paragraph text</p></div>')
    const text = extractTextContent(result)
    expect(text).toContain('Paragraph text')
  })

  it('should handle processNode with text nodes', () => {
    expect(extractTextContent(compiler('<div>Plain text</div>'))).toContain(
      'Plain text'
    )
  })

  it('should filter out empty text nodes in processNode', () => {
    expect(compiler('<div>   </div>')).not.toBeNull()
  })

  it('should handle processNode with htmlBlock children', () => {
    expect(
      extractTextContent(compiler('<div><div>Nested</div></div>'))
    ).toContain('Nested')
  })
})

describe('frontmatter', () => {
  it('should not render frontmatter by default', () => {
    const result = compiler('---\ntitle: Test\n---\n\n# Content')
    const text = extractTextContent(result)
    expect(text).toContain('Content')
    expect(text).not.toContain('title: Test')
  })

  it('should render frontmatter when preserveFrontmatter is true', () => {
    const result = compiler('---\ntitle: Test\n---\n\n# Content', {
      preserveFrontmatter: true,
    })
    const text = extractTextContent(result)
    expect(text).toContain('title: Test')
  })

  it('should handle frontmatter with preserveFrontmatter false explicitly', () => {
    const result = compiler('---\nkey: value\n---\n\n# Content', {
      preserveFrontmatter: false,
    })
    const text = extractTextContent(result)
    expect(text).toContain('Content')
    expect(text).not.toContain('key: value')
  })
})

describe('HTML blocks', () => {
  it('should parse and render HTML blocks', () => {
    const result = compiler('<div>HTML content</div>')
    const text = extractTextContent(result)
    expect(text).toContain('HTML content')
  })

  it('should handle HTML with attributes', () => {
    const result = compiler('<div class="test" id="main">Content</div>')
    const text = extractTextContent(result)
    expect(text).toContain('Content')
  })

  it('should handle nested HTML', () => {
    const result = compiler('<div><p>Nested <strong>content</strong></p></div>')
    const text = extractTextContent(result)
    expect(text).toContain('Nested')
    expect(text).toContain('content')
  })
})

describe('overrides', () => {
  it('should handle override with string tag replacement', () => {
    const result = compiler('# Hello', {
      overrides: {
        h1: { component: 'h2', props: { class: 'custom' } },
      },
    })
    const text = extractTextContent(result)
    expect(text).toContain('Hello')
  })

  it('should handle override with component and props', () => {
    const result = compiler('Hello', {
      overrides: {
        p: {
          component: 'div',
          props: { 'data-testid': 'custom-paragraph' },
        },
      },
    })
    const text = extractTextContent(result)
    expect(text).toContain('Hello')
  })

  it('should handle override with just component string', () => {
    const result = compiler('# Hello', {
      overrides: {
        h1: 'h2',
      },
    })
    const text = extractTextContent(result)
    expect(text).toContain('Hello')
  })

  it('#248 should apply mixed-case mid-string HTML tag overrides', () => {
    const CustomDiv = (props: Record<string, unknown>) =>
      ({
        t: 'section',
        p: { ...props, 'data-custom': 'mixed' },
      }) as unknown as JSX.Element
    expect(
      JSON.stringify(
        compiler('<dIV>hello</dIV>', {
          overrides: { div: CustomDiv },
        })
      )
    ).toContain('mixed')
    expect(
      extractTextContent(
        compiler('<dIV>hello</dIV>', {
          overrides: { div: CustomDiv },
        })
      )
    ).toContain('hello')
  })
})

describe('edge cases', () => {
  it('should handle empty string', () => {
    const result = compiler('')
    expect(result).toBeNull()
    expect(extractTextContent(result)).toBe('')
  })

  it('should handle very long content', () => {
    const longContent = `# Title\n\n${'Paragraph. '.repeat(1000)}`
    const result = compiler(longContent)
    expect(extractTextContent(result)).toContain('Title')
    expect(extractTextContent(result)).toContain('Paragraph.')
  })

  it('should handle special characters', () => {
    const result = compiler('# Hello & <world>')
    const text = extractTextContent(result)
    expect(text).toContain('Hello')
  })

  it('should handle deeply nested structures', () => {
    const deepContent = `${new Array(20).fill('> ').join('')}Deep quote`
    const result = compiler(deepContent)
    const text = extractTextContent(result)
    expect(text).toContain('Deep quote')
  })

  it('should handle unicode characters', () => {
    const result = compiler('# 你好世界 🌍')
    const text = extractTextContent(result)
    expect(text).toContain('你好世界')
    expect(text).toContain('🌍')
  })

  it('should handle markdown with only whitespace', () => {
    const result = compiler('   \n\n   \n\n')
    // Whitespace-only strings return null, which is valid
    expect(result).toBeNull()
  })

  it('should handle markdown with only newlines', () => {
    const result = compiler('\n\n\n\n')
    // Newlines-only strings return null, which is valid
    expect(result).toBeNull()
  })

  it('should handle tables with empty cells', () => {
    const markdown = '| A | B |\n|---|---|\n|   |   |'
    const _result = compiler(markdown)
  })

  it('should handle lists with empty items', () => {
    const result = compiler('- \n- Item')
    const text = extractTextContent(result)
    expect(text).toContain('Item')
  })

  it('should handle GFM task lists', () => {
    const result = compiler('- [ ] Task 1\n- [x] Task 2')
    const text = extractTextContent(result)
    expect(text).toContain('Task 1')
    expect(text).toContain('Task 2')
  })

  it('should handle footnotes', () => {
    const markdown = 'Text[^1]\n\n[^1]: Footnote content'
    const result = compiler(markdown)
    const text = extractTextContent(result)
    expect(text).toContain('Text')
    expect(text).toContain('Footnote content')
  })

  it('should handle multiple footnotes', () => {
    // This tests the multiple footnotes path (lines 901-931)
    const markdown =
      'Text[^1] and more[^2]\n\n[^1]: First footnote\n[^2]: Second footnote'
    const result = compiler(markdown)
    const text = extractTextContent(result)
    expect(text).toContain('Text')
    expect(text).toContain('First footnote')
    expect(text).toContain('Second footnote')
  })

  it('should handle footnote identifier without caret', () => {
    // Test identifierWithoutCaret path (lines 907-910)
    const markdown = 'Text[^1]\n\n[^1]: Footnote'
    const result = compiler(markdown)
    const text = extractTextContent(result)
    expect(text).toContain('Text')
    expect(text).toContain('Footnote')
  })

  it('should handle footnote content as array', () => {
    // Test Array.isArray(footnoteContent) path (line 926)
    const markdown = 'Text[^1]\n\n[^1]: Footnote with **bold**'
    const result = compiler(markdown)
    const text = extractTextContent(result)
    expect(text).toContain('Text')
    expect(text).toContain('bold')
  })
})

describe('edge cases', () => {
  it('should handle forceInline option', () => {
    const result = compiler('# Heading', { forceInline: true })
    const text = extractTextContent(result)
    expect(text).toContain('Heading')
  })

  it('should handle forceBlock option', () => {
    const result = compiler('Inline text', { forceBlock: true })
    const text = extractTextContent(result)
    expect(text).toContain('Inline text')
  })

  it('should handle disableAutoLink option', () => {
    const result = compiler('https://example.com', { disableAutoLink: true })
    const text = extractTextContent(result)
    expect(text).toContain('https://example.com')
  })

  it('should handle disableParsingRawHTML option', () => {
    const result = compiler('<div>test</div>', { disableParsingRawHTML: true })
    const _text = extractTextContent(result)
    // HTML should be treated as text, so it should appear in output
  })
})

describe('renderRule option', () => {
  it('should use custom renderRule when provided', () => {
    const customRenderRule = (
      next: () => JSX.Element | string | null,
      node: any,
      _renderChildren: (children: any[]) => JSX.Element | JSX.Element[],
      _state: any
    ) => {
      if (node.type === 'heading') {
        return { t: 'h2', p: { id: 'custom' } } as unknown as JSX.Element
      }
      return next()
    }
    const _result = compiler('# Hello', { renderRule: customRenderRule })
  })

  it('should use default render when renderRule is not provided', () => {
    const _result = compiler('# Hello', {})
  })
})

describe('renderer depth overflow', () => {
  it('should handle renderDepth > 2500 with handleStackOverflow', () => {
    // This tests the handleStackOverflow path (line 552-559)
    // Create a deep nesting scenario by using astToJSX directly with high depth
    const ast = parser('Text')
    const _result = astToJSX(ast, {})
    // Manually test with high depth state
    const _deepState = { renderDepth: 2501 }
    // We can't directly test this without exposing internal state,
    // but we can verify the function exists and works normally
  })
})

describe('string concatenation in renderer', () => {
  it('should concatenate consecutive strings', () => {
    // This tests the string concatenation path (lines 575-577)
    // Create multiple text nodes that should be concatenated
    const result = compiler('Text1\n\nText2')
    const text = extractTextContent(result)
    expect(text).toContain('Text1')
    expect(text).toContain('Text2')
  })

  it('should handle array output from renderRule', () => {
    // This tests the Array.isArray(nodeOut) path (lines 573-577)
    const customRenderRule = (
      next: () => JSX.Element | string | null,
      node: any
    ) => {
      if (node.type === 'paragraph') {
        return [
          { t: 'span', p: {}, children: 'Part1' } as unknown as JSX.Element,
          { t: 'span', p: {}, children: 'Part2' } as unknown as JSX.Element,
        ]
      }
      return next()
    }
    const _result = compiler('Hello world', { renderRule: customRenderRule })
  })
})

describe('h function compileHTML and innerHTML', () => {
  it('should compile HTML content in props', () => {
    // This tests the compileHTML path (lines 718-719)
    // This is tested through HTML blocks with attributes containing HTML
    const result = compiler('<div data-content="<span>HTML</span>">Text</div>')
    const text = extractTextContent(result)
    expect(text).toContain('Text')
  })

  it('should handle innerHTML prop', () => {
    // This tests the innerHTML path (lines 725-739)
    // innerHTML is set in the containsPreTags path, which we already test
    // But let's verify it works correctly
    const result = compiler('<div><pre>code</pre></div>')
    const text = extractTextContent(result)
    expect(text).toContain('code')
  })

  it('should merge className with overrides', () => {
    // This tests the className merging path (lines 732-736)
    const result = compiler('# Hello', {
      overrides: {
        h1: { props: { className: 'custom-class' } },
      },
    })
    const str = JSON.stringify(result)
    expect(str).toContain('custom-class')
  })

  it('should handle className merging with undefined values', () => {
    // Test className merging when one is undefined
    const _result = compiler('# Hello', {
      overrides: {
        h1: { props: {} },
      },
    })
  })
})

describe('AST post-processing', () => {
  it('should handle HTML block with pre tags and following paragraph', () => {
    const text = extractTextContent(compiler('<pre>code</pre>\n\nParagraph'))
    expect(text).toContain('code')
    expect(text).toContain('Paragraph')
  })

  it('should handle extractText with textFormatted nodes', () => {
    const text = extractTextContent(
      compiler('<div>_emphasized_ **bold**</div>')
    )
    expect(text).toContain('emphasized')
    expect(text).toContain('bold')
  })

  it('should handle extractText with htmlSelfClosing rawText', () => {
    const text = extractTextContent(compiler('<div>Text<br />More</div>'))
    expect(text).toContain('Text')
    expect(text).toContain('More')
  })
})

describe('createSolidElement and h function', () => {
  it('should handle string tag with single child', () => {
    expect(extractTextContent(compiler('# Hello'))).toContain('Hello')
  })

  it('should handle string tag with multiple children', () => {
    const text = extractTextContent(compiler('Hello\n\nWorld'))
    expect(text).toContain('Hello')
    expect(text).toContain('World')
  })

  it('should handle function component with children', () => {
    // This tests createSolidElement function component path (lines 678-685)
    const CustomComponent = (props: Record<string, unknown>) =>
      ({ t: 'div', p: props }) as unknown as JSX.Element
    const _result = compiler('Hello', {
      overrides: {
        p: CustomComponent,
      },
    })
  })

  it('should handle function component without children', () => {
    // Test function component without children (line 687)
    // Empty string returns null, so we test with actual content
    const CustomComponent = (props: Record<string, unknown>) =>
      ({ t: 'div', p: props }) as unknown as JSX.Element
    const _result = compiler('Text', {
      overrides: {
        p: CustomComponent,
      },
    })
  })

  it('should handle module-level h function with string tag', () => {
    // This tests the module-level h function (lines 1047-1071)
    // Tested through MarkdownProvider and Markdown component
    const _result = compiler('# Test')
  })

  it('should handle module-level h function with function component', () => {
    // Test module-level h with function component (lines 1059-1068)
    // This is tested through component overrides
    const CustomComponent = (props: Record<string, unknown>) =>
      ({ t: 'div', p: props }) as unknown as JSX.Element
    const _result = compiler('Hello', {
      overrides: {
        p: CustomComponent,
      },
    })
  })
})

describe('wrapper edge cases', () => {
  it('should handle wrapper null with empty array', () => {
    // This tests wrapper: null with empty array (lines 933-936)
    const ast = parser('')
    const result = astToJSX(ast, { wrapper: null })
    expect(result).toBeNull()
  })

  it('should handle wrapper null with single element', () => {
    // Test wrapper: null with single element (line 936)
    const ast = parser('# Hello')
    const result = astToJSX(ast, { wrapper: null })

    expect(Array.isArray(result)).toBe(false)
  })

  it('should handle wrapper null with multiple elements', () => {
    // Test wrapper: null with multiple elements (line 936)
    const ast = parser('# Hello\n\n## World')
    const result = astToJSX(ast, { wrapper: null })

    expect(Array.isArray(result)).toBe(true)
  })

  it('should handle forceWrapper with single element', () => {
    // This tests the forceWrapper path (line 942)
    const ast = parser('# Hello')
    const _result = astToJSX(ast, { forceWrapper: true })
  })

  it('should handle forceInline wrapper', () => {
    // This tests the forceInline wrapper path (line 939)
    const result = compiler('Inline text', { forceInline: true })
    const text = extractTextContent(result)
    expect(text).toContain('Inline text')
  })

  it('should handle wrapper with empty array', () => {
    // Test wrapper with empty array (lines 944-947)
    const ast = parser('')
    const result = astToJSX(ast, { wrapper: 'div' })
    expect(result).toBeNull()
  })
})

describe('Markdown component', () => {
  it('should handle function children (Accessor)', () => {
    // This tests the function children path (lines 1103-1104)
    const [content, _setContent] = createSignal('Hello')
    // We can't directly test the component, but we can test the compiler
    const result = compiler(content())
    const text = extractTextContent(result)
    expect(text).toContain('Hello')
  })

  it('should handle null children in Markdown component', () => {
    // Test null children path (line 1105)
    const result = compiler('')
    expect(result).toBeNull()
  })

  it('should handle undefined children in Markdown component', () => {
    // Test undefined children path (line 1105)
    const result = compiler('')
    expect(result).toBeNull()
  })

  it('should filter props in Markdown component', () => {
    // This tests the props filtering path (lines 1120-1124)
    // Tested through wrapperProps merging
    const ast = parser('# Hello\n\n## World')
    const result = astToJSX(ast, {
      wrapperProps: {
        id: 'test',
        'data-test': 'value',
      } as JSX.HTMLAttributes<HTMLElement>,
    })
    const str = JSON.stringify(result)
    expect(str).toContain('test')
  })
})

describe('blockQuote children handling', () => {
  it('should handle blockQuote with array children', () => {
    // This tests line 174 - blockQuote with array children
    const result = compiler('> First\n> Second\n> Third')
    const text = extractTextContent(result)
    expect(text).toContain('First')
    expect(text).toContain('Second')
    expect(text).toContain('Third')
  })

  it('should handle blockQuote with single child (non-array)', () => {
    // This tests line 174 - blockQuote with non-array children
    const result = compiler('> Single line quote')
    const text = extractTextContent(result)
    expect(text).toContain('Single line quote')
  })
})

describe('heading children handling', () => {
  it('should handle heading with array children', () => {
    // This tests line 227 - heading with array children
    const result = compiler('# Heading with **bold** and _italic_')
    const text = extractTextContent(result)
    expect(text).toContain('Heading')
    expect(text).toContain('bold')
    expect(text).toContain('italic')
  })

  it('should handle heading with single child (non-array)', () => {
    // This tests line 227 - heading with non-array children
    const result = compiler('# Simple heading')
    const text = extractTextContent(result)
    expect(text).toContain('Simple heading')
  })
})

describe('HTML block tagfilter with rawText', () => {
  it('should handle HTML block with rawText when tagfilter is enabled', () => {
    // This tests line 238 - htmlBlock tagfilter with rawText
    const result = compiler('<script>alert("xss")</script>', {
      tagfilter: true,
    })
    const str = JSON.stringify(result)
    expect(str).toContain('script')
  })
})

describe('HTML block Type 1 blocks with tagfilter', () => {
  it('should apply tagfilter to Type 1 block text content', () => {
    // This tests line 275 - tagfilter in Type 1 blocks
    const result = compiler('<style>body { color: red; }</style>', {
      tagfilter: true,
    })
    const str = JSON.stringify(result)
    expect(str).toContain('style')
  })
})

describe('HTML block containsPreTags path', () => {
  it('should handle HTML block with containsPreTags without tagfilter', () => {
    // This tests line 280-288 - containsPreTags path without tagfilter
    const result = compiler('<div><pre>code</pre></div>', { tagfilter: false })
    const text = extractTextContent(result)
    expect(text).toContain('code')
  })

  it('should handle HTML block with containsPreTags with tagfilter', () => {
    // This tests lines 281-287 - containsPreTags with tagfilter
    const result = compiler('<div><pre>code</pre></div>', { tagfilter: true })
    const text = extractTextContent(result)
    expect(text).toContain('code')
  })
})

describe('HTML block cleanedText and selfTagRegex', () => {
  it('should handle cleanedText processing', () => {
    // This tests lines 290-298 - cleanedText processing
    const result = compiler('<div>Hello\n\nWorld</div>')
    const text = extractTextContent(result)
    expect(text).toContain('Hello')
    expect(text).toContain('World')
  })

  it('should handle cleanedText with whitespace normalization', () => {
    // Test cleanedText with >\s+< replacement
    const result = compiler('<div>Hello > < World</div>')
    const text = extractTextContent(result)
    expect(text).toContain('Hello')
  })

  it('should prevent infinite recursion with selfTagRegex', () => {
    // This tests lines 302-308 - selfTagRegex matching
    const _result = compiler('<div></div>')
  })

  it('should prevent infinite recursion with selfTagRegex with attributes', () => {
    // Test selfTagRegex with attributes
    const _result = compiler('<div class="test"></div>')
  })

  it('should return empty element when selfTagRegex matches', () => {
    // This tests line 307 - selfTagRegex matching returns empty element
    const _result = compiler('<div></div>')
  })
})

describe('processNode htmlBlock children', () => {
  it('should handle processNode with htmlBlock that has children', () => {
    // This tests lines 334-345 - processNode with htmlBlock children
    const result = compiler('<div><span>Nested</span></div>')
    const text = extractTextContent(result)
    expect(text).toContain('Nested')
  })
})

describe('processNode function branches', () => {
  it('should handle processNode with htmlSelfClosing isClosingTag', () => {
    // This tests lines 310-345 - processNode branches
    const _result = compiler('<div>Text</div>')
  })

  it('should handle processNode with paragraph children', () => {
    // Test paragraph branch in processNode
    const result = compiler('<div><p>Paragraph</p></div>')
    const text = extractTextContent(result)
    expect(text).toContain('Paragraph')
  })

  it('should handle processNode with paragraph without children', () => {
    // Test paragraph without children branch
    const _result = compiler('<div><p></p></div>')
  })

  it('should handle processNode with text nodes', () => {
    // Test text branch in processNode
    const result = compiler('<div>Plain text</div>')
    const text = extractTextContent(result)
    expect(text).toContain('Plain text')
  })

  it('should handle processNode with empty text nodes', () => {
    // Test text with empty/whitespace (should filter out)
    const _result = compiler('<div>   </div>')
  })

  it('should handle processNode with htmlBlock children', () => {
    // Test htmlBlock branch in processNode
    const result = compiler('<div><div>Nested</div></div>')
    const text = extractTextContent(result)
    expect(text).toContain('Nested')
  })

  it('should handle processNode with other node types', () => {
    // Test other node types (should pass through)
    const result = compiler('<div>Text with <code>code</code></div>')
    const text = extractTextContent(result)
    expect(text).toContain('Text')
    expect(text).toContain('code')
  })
})

describe('processedChildren handling', () => {
  it('should handle processedChildren as array', () => {
    // This tests lines 348-355 - processedChildren array
    const result = compiler('<div>Hello <strong>world</strong></div>')
    const text = extractTextContent(result)
    expect(text).toContain('Hello')
    expect(text).toContain('world')
  })

  it('should handle processedChildren as non-array', () => {
    // This tests lines 352-354 - processedChildren non-array
    const result = compiler('<div>Single text</div>')
    const text = extractTextContent(result)
    expect(text).toContain('Single text')
  })

  it('should handle processedChildren wrapping non-array in array', () => {
    // This tests lines 354-355 - wrapping non-array processedChildren
    const result = compiler('<div>Text</div>')
    const text = extractTextContent(result)
    expect(text).toContain('Text')
  })
})

describe('HTML block children null handling', () => {
  it('should handle HTML block with null children', () => {
    // This tests line 362 - htmlBlock children null
    const _result = compiler('<div></div>')
  })
})

describe('HTML self-closing tagfilter', () => {
  it('should handle self-closing tagfilter with rawText', () => {
    // This tests line 374 - htmlSelfClosing tagfilter with rawText
    const _result = compiler('<script src="evil.js" />', { tagfilter: true })
  })

  it('should format attributes for filtered self-closing tags', () => {
    // This tests lines 376-389 - htmlSelfClosing tagfilter attribute formatting
    const _result = compiler('<iframe src="evil.com" />', { tagfilter: true })
  })
})

describe('table alignment null handling', () => {
  it('should handle table header cells with null alignment', () => {
    // This tests line 442 - table header alignment null
    const markdown = '| A | B |\n|---|---|\n| 1 | 2 |'
    const result = compiler(markdown)
    const text = extractTextContent(result)
    expect(text).toContain('A')
    expect(text).toContain('B')
  })

  it('should handle table cells with null alignment', () => {
    // This tests line 464 - table cell alignment null
    const markdown = '| A | B |\n|---|---|\n| 1 | 2 |'
    const result = compiler(markdown)
    const text = extractTextContent(result)
    expect(text).toContain('1')
    expect(text).toContain('2')
  })
})

describe('textFormatted children', () => {
  it('should handle textFormatted with array children', () => {
    // This tests line 481 - textFormatted children array
    const result = compiler('**_bold italic_**')
    const text = extractTextContent(result)
    expect(text).toContain('bold italic')
  })

  it('should handle textFormatted with single child (non-array)', () => {
    // This tests line 481 - textFormatted with non-array children
    const result = compiler('**bold**')
    const text = extractTextContent(result)
    expect(text).toContain('bold')
  })
})

describe('list item content handling', () => {
  it('should handle list items with array content', () => {
    // This tests line 499 - list item array content
    const result = compiler('- Item with **bold** text')
    const text = extractTextContent(result)
    expect(text).toContain('Item')
    expect(text).toContain('bold')
  })

  it('should handle list items with single content (non-array)', () => {
    // This tests line 499 - list item with non-array content
    const result = compiler('- Simple item')
    const text = extractTextContent(result)
    expect(text).toContain('Simple item')
  })
})

describe('renderRule userRender path', () => {
  it('should use userRender when provided', () => {
    // This tests line 558 - renderRule userRender path
    const customRenderRule = (
      next: () => JSX.Element | string | null,
      node: any
    ) => {
      if (node.type === 'heading') {
        return { t: 'h2', p: { id: 'custom' } } as unknown as JSX.Element
      }
      return next()
    }
    const _result = compiler('# Hello', { renderRule: customRenderRule })
  })
})

describe('array output handling in renderer', () => {
  it('should handle array output from renderRule', () => {
    // This tests lines 581-583 - array output handling
    const customRenderRule = (
      next: () => JSX.Element | string | null,
      node: any
    ) => {
      if (node.type === 'paragraph') {
        return [
          { t: 'span', p: {}, children: 'Part1' } as unknown as JSX.Element,
          { t: 'span', p: {}, children: 'Part2' } as unknown as JSX.Element,
        ]
      }
      return next()
    }
    const _result = compiler('Hello world', { renderRule: customRenderRule })
  })
})

describe('compileHTML in props', () => {
  it('should compile HTML content in props', () => {
    // This tests lines 715-717 - compileHTML in props
    const result = compiler('<div data-content="<span>HTML</span>">Text</div>')
    const text = extractTextContent(result)
    expect(text).toContain('Text')
  })
})

describe('innerHTML handling', () => {
  it('should handle innerHTML with overrides', () => {
    // This tests lines 755-768 - innerHTML handling
    const result = compiler('<div><pre>code</pre></div>', {
      overrides: {
        div: { props: { className: 'custom' } },
      },
    })
    const text = extractTextContent(result)
    expect(text).toContain('code')
  })

  it('should handle innerHTML with className merging', () => {
    // Test innerHTML with className merging from overrides
    const result = compiler('<div><pre>code</pre></div>', {
      overrides: {
        div: { props: { className: 'override-class' } },
      },
    })
    const str = JSON.stringify(result)
    expect(str).toContain('override-class')
  })

  it('should handle innerHTML with undefined className', () => {
    // Test innerHTML when className is undefined
    const _result = compiler('<div><pre>code</pre></div>', {
      overrides: {
        div: { props: {} },
      },
    })
  })

  it('should respect user-provided innerHTML in override props', () => {
    // Test that user-provided innerHTML in overrides takes precedence over parser-generated innerHTML
    const result = compiler('<div><pre>original</pre></div>', {
      overrides: {
        div: { props: { innerHTML: '<span>override</span>' } },
      },
    })
    // Helper to extract innerHTML from JSX structure
    function getInnerHtml(
      element: JSX.Element | JSX.Element[] | null | undefined
    ): string | undefined {
      if (!element || Array.isArray(element)) {
        return
      }
      if (
        typeof element === 'object' &&
        'p' in element &&
        element.p &&
        typeof element.p === 'object'
      ) {
        const props = element.p as Record<string, unknown>
        return typeof props.innerHTML === 'string' ? props.innerHTML : undefined
      }
    }
    const innerHtml = getInnerHtml(result as JSX.Element)
    // User-provided innerHTML should be used, not the original content
    expect(innerHtml).toBe('<span>override</span>')
    expect(innerHtml).not.toContain('original')
  })
})

describe('post-processing AST extractText', () => {
  it('should handle extractText with various node types', () => {
    // This tests lines 810-812, 815-841 - post-processing extractText
    const result = compiler('<pre>code</pre>\n\nParagraph')
    const text = extractTextContent(result)
    expect(text).toContain('code')
    expect(text).toContain('Paragraph')
  })

  it('should handle extractText with textFormatted nodes', () => {
    // Test extractText with formatted text
    const result = compiler('<div>_emphasized_ **bold**</div>')
    const text = extractTextContent(result)
    expect(text).toContain('emphasized')
    expect(text).toContain('bold')
  })

  it('should handle extractText with textFormatted em tag', () => {
    // This tests lines 829-838 - extractText with textFormatted em tag
    const result = compiler('<div>_emphasized_</div>')
    const text = extractTextContent(result)
    expect(text).toContain('emphasized')
  })

  it('should handle extractText with textFormatted strong tag', () => {
    // This tests lines 829-838 - extractText with textFormatted strong tag
    const result = compiler('<div>**bold**</div>')
    const text = extractTextContent(result)
    expect(text).toContain('bold')
  })

  it('should handle extractText with textFormatted other tag', () => {
    // This tests lines 829-838 - extractText with textFormatted other tag (empty marker)
    const result = compiler('<div><code>code</code></div>')
    const text = extractTextContent(result)
    expect(text).toContain('code')
  })

  it('should handle extractText with htmlSelfClosing rawText', () => {
    // Test extractText with htmlSelfClosing rawText
    const result = compiler('<div>Text<br />More</div>')
    const text = extractTextContent(result)
    expect(text).toContain('Text')
    expect(text).toContain('More')
  })

  it('should handle extractText with removedClosingTags', () => {
    // This tests lines 843-870 - post-processing removedClosingTags
    // Per CommonMark spec Example 148: paragraph with 3+ consecutive closing tags
    // The parser removes all but the first one and stores them in removedClosingTags
    // This test creates a scenario where HTML block with <pre> is followed by paragraph with removedClosingTags
    const markdown =
      '<pre>code</pre>\n\nParagraph with </pre></td></tr></table>'
    const result = compiler(markdown)
    const text = extractTextContent(result)
    expect(text).toContain('code')
    expect(text).toContain('Paragraph')
  })

  it('should handle extractText with removedClosingTags that contain closing tag', () => {
    // Test the filter condition where rawText contains the closing tag
    const markdown = '<div>content</div>\n\nParagraph with </div></span></p>'
    const _result = compiler(markdown)
  })

  it('should handle extractText with removedClosingTags without rawText', () => {
    // Test map path where tag doesn't have rawText (line 868 - fallback to empty string)
    const markdown = '<pre>code</pre>\n\nParagraph with </pre></td></tr>'
    const _result = compiler(markdown)
  })

  it('should handle extractText with removedClosingTags that are not htmlSelfClosing', () => {
    // Test map path where tag is not htmlSelfClosing (line 868 - fallback to empty string)
    const markdown = '<pre>code</pre>\n\nParagraph'
    const _result = compiler(markdown)
  })

  it('should not mutate AST when Markdown component re-renders with different props', () => {
    // Test that astToJSX doesn't mutate the AST when called multiple times with the same AST
    // This is critical for memoization - if ast() is cached but jsx() recalculates,
    // the mutation would accumulate text content
    const markdown =
      '<pre>code</pre>\n\nParagraph with </pre></td></tr></table>'
    const ast = parser(markdown)

    // First call
    const result1 = astToJSX(ast)
    const text1 = extractTextContent(result1)

    // Second call with same AST (simulating memoized ast() but recalculated jsx())
    const result2 = astToJSX(ast)
    const text2 = extractTextContent(result2)

    // Text should be the same, not accumulated
    expect(text1).toBe(text2)
    expect(text1).toContain('code')
    expect(text1).toContain('Paragraph')

    // Verify AST wasn't mutated by checking the original node
    const htmlBlock = ast.find(
      n => n.type === RuleType.htmlBlock
    ) as MarkdownToJSX.HTMLNode
    if (htmlBlock?.text) {
      // The text should not contain the paragraph text multiple times
      const paragraphMatches = (htmlBlock.text.match(/Paragraph/g) || []).length
      expect(paragraphMatches).toBeLessThanOrEqual(1)
    }
  })

  it('should not mutate options object when calling astToJSX multiple times', () => {
    // Test that astToJSX doesn't mutate the options object when called multiple times
    // This is important for memoization - if the same options object is reused,
    // mutations could cause unexpected side effects
    const markdown = '# Hello world'
    const ast = parser(markdown)
    const options: SolidOptions = {
      slugify: (input: string) => input.toLowerCase(),
    }
    const originalOverrides = options.overrides

    // First call
    astToJSX(ast, options)

    // Verify options object wasn't mutated
    expect(options.overrides).toBe(originalOverrides)

    // Second call with same options
    astToJSX(ast, options)

    // Options should still be unchanged
    expect(options.overrides).toBe(originalOverrides)
  })

  it('should not mutate options object when calling compiler multiple times', () => {
    // Test that compiler doesn't mutate the options object when called multiple times
    const markdown = '# Hello world'
    const options: SolidOptions = {
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

describe('footnote identifier handling', () => {
  it('should handle footnote identifier without caret', () => {
    // This tests line 955 - footnote identifier without caret
    const markdown = 'Text[^1]\n\n[^1]: Footnote'
    const result = compiler(markdown)
    const text = extractTextContent(result)
    expect(text).toContain('Text')
    expect(text).toContain('Footnote')
  })

  it('should handle footnote identifier that starts with caret', () => {
    // Test footnote identifier that starts with caret (different path)
    const markdown = 'Text[^1]\n\n[^1]: Footnote'
    const _result = compiler(markdown)
  })
})

describe('compiler validation', () => {
  it('should throw error for invalid markdown type', () => {
    // This tests line 1049 - compiler validation error
    expect(() => {
      compiler(null as any)
    }).toThrow()
  })

  it('should throw error for invalid overrides type', () => {
    // This tests line 1056 - compiler validation error for overrides
    expect(() => {
      compiler('text', { overrides: 'invalid' as any })
    }).toThrow()
  })
})

describe('Markdown component', () => {
  it('should handle function children (Accessor)', () => {
    // This tests lines 1122-1155 - Markdown component with function children
    const result = compiler('Hello')
    const text = extractTextContent(result)
    expect(text).toContain('Hello')
  })

  it('should handle null children in Markdown component', () => {
    // This tests line 1132 - null children path
    const result = compiler('')
    expect(result).toBeNull()
  })

  it('should handle undefined children in Markdown component', () => {
    // This tests line 1132 - undefined children path
    const result = compiler('')
    expect(result).toBeNull()
  })

  it('should handle Markdown component with wrapperProps', () => {
    // This tests lines 1145-1152 - wrapperProps handling
    const _result = compiler('# Test', {
      wrapperProps: { class: 'custom' },
    })
  })

  it('should handle Markdown component with filtered props', () => {
    // This tests lines 1148-1150 - filtering props
    const _result = compiler('# Test')
  })
})

describe('module-level h function', () => {
  it('should handle module-level h with string tag and children', () => {
    // This tests lines 1074-1096 - module-level h function
    const _result = compiler('# Test')
  })

  it('should handle module-level h with function component and children', () => {
    // Test module-level h with function component
    const CustomComponent = (props: Record<string, unknown>) =>
      ({ t: 'div', p: props }) as unknown as JSX.Element
    const _result = compiler('Hello', {
      overrides: {
        p: CustomComponent,
      },
    })
  })

  it('should handle module-level h with function component without children', () => {
    // Test module-level h with function component without children
    // Empty string returns null, so we test with actual content
    const CustomComponent = (props: Record<string, unknown>) =>
      ({ t: 'div', p: props }) as unknown as JSX.Element
    const _result = compiler('Text', {
      overrides: {
        p: CustomComponent,
      },
    })
  })

  it('should handle module-level h with non-string non-function tag', () => {
    // Test the return tag as JSX.Element path (line 1097)
    const _result = compiler('# Test')
  })
})

describe('MarkdownProvider', () => {
  it('should handle MarkdownProvider with options', () => {
    // This tests lines 1104-1109 - MarkdownProvider
    const _result = compiler('# Test')
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
    // tail is a sibling of the span's div, wrapped in Solid's multi-root container
    expect(
      serialize(compiler('<div>\n<span>a</span>\n</div>\ntail'))
    ).toMatchInlineSnapshot(`"<div><div><span>a</span></div> tail</div>"`)
  })

  it('never injects dangerous raw HTML attributes', () => {
    // Solid injects verbatim blocks via innerHTML with no framework backstop,
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
  function collectIds(el: unknown): string[] {
    const ids: string[] = []
    const walk = (node: unknown) => {
      if (node === null || typeof node === 'boolean') {
        return
      }
      if (typeof node === 'string' || typeof node === 'number') {
        return
      }
      if (Array.isArray(node)) {
        for (const child of node) {
          walk(child)
        }
        return
      }
      const props = (node as { p?: Record<string, unknown> }).p
      if (!props) {
        return
      }
      if (typeof props.id === 'string') {
        ids.push(props.id)
      }
      walk(props.children)
    }
    walk(el)
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
  it('drops entity-obfuscated javascript: href and src', () => {
    expect(firstHref(compiler('[x](&#106;avascript:alert(1))'))).toBeUndefined()
    expect(
      firstHref(compiler('![x](&#106;avascript:alert(1))'))
    ).toBeUndefined()
  })

  it('re-sanitizes direct astToJSX link targets before href encoding', () => {
    expect(
      firstHref(
        astToJSX([
          {
            type: RuleType.link,
            target: 'javascript:alert(1)',
            children: [{ type: RuleType.text, text: 'x' }],
          },
        ])
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

describe('prototype-slot reference labels (#900)', () => {
  it('renders [__proto__] and [constructor] without throwing', () => {
    expect(serialize(compiler('[__proto__]'))).toBe(
      '<span>[<strong>proto</strong>]</span>'
    )
    expect(serialize(compiler('[constructor]'))).toBe('[constructor]')
  })

  it('resolves __proto__ and constructor reference definitions', () => {
    expect(serialize(compiler('[__proto__]: /x\n\n[__proto__]'))).toBe(
      '<p><a><strong>proto</strong></a></p>'
    )
    expect(
      JSON.stringify(compiler('[__proto__]: /x\n\n[__proto__]'))
    ).toContain('"/x"')
    expect(serialize(compiler('[constructor]: /y\n\n[constructor]'))).toBe(
      '<p><a>constructor</a></p>'
    )
    expect(
      JSON.stringify(compiler('[constructor]: /y\n\n[constructor]'))
    ).toContain('"/y"')
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

/** The type of every `on*` prop in a Solid element tree, serialize showing no props. */
const handlerProps = (el: unknown) =>
  treeProps(el)
    .filter(([name]) => name.toLowerCase().startsWith('on'))
    .map(([name, value]) => `${name}=${typeof value}`)

/** The first defined href or src in a Solid element tree. */
const firstHref = (el: unknown) =>
  treeProps(el).find(
    ([name, value]) =>
      (name === 'href' || name === 'src') && value !== undefined
  )?.[1]

/** Every prop name in a Solid element tree but children and the compiler's own innerHTML. */
const propNames = (el: unknown) =>
  treeProps(el)
    .map(([name]) => name)
    .filter(name => name !== 'innerHTML')

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
    // An element in innerHTML would reach the page as [object HTMLElement]
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
      ['start'],
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

    expect(serialize(result)).toBe('<i>z</i>')
  })

  it.each([
    ['<card children="z" />', Object.create({ card: { component: 'i' } })],
    ['<CARD children="z" />', { card: { component: 'i' } }],
  ])('reaches the override for %j, inherited or keyed in lowercase, as the renderer finds it', (input, overrides) => {
    expect(serialize(compiler(input, { overrides }))).toBe('<i>z</i>')
  })

  it('does not take a built-in object property for an override', () => {
    expect(
      serialize(compiler('<constructor children="z" />', { overrides: {} }))
    ).toBe('<constructor></constructor>')
  })

  it.each([
    [
      '<img children="z" src="/x">',
      { img: { props: { title: 't' } } },
      '<img>z</img>',
    ],
    ['<card children="z" />', { card: { component: 'img' } }, '<img>z</img>'],
  ])('does not throw on %j with void override %j', (input, overrides, expected) => {
    expect(serialize(compiler(input, { overrides }))).toBe(expected)
  })
})

describe('code naming a filtered tag', () => {
  it.each([
    [{}],
    [{ disableParsingRawHTML: true }],
  ])('stays code with %j, as only the markdown output writes it differently', options => {
    expect(serialize(compiler('`<script>`', options))).toBe(
      '<code><script></code>'
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
    ['<Btn on:click={alert(1)}>x</Btn>', undefined, '<Btn>x</Btn>', []],
    ['<Btn onclick={[1]}>x</Btn>', undefined, '<Btn>x</Btn>', []],
    // Solid hands a bare name's `true` to addEventListener, which throws
    ['<Img onerror />', undefined, '<Img></Img>', []],
    ['<Btn onclick>x</Btn>', undefined, '<Btn>x</Btn>', []],
    ['<Btn on:click>x</Btn>', undefined, '<Btn>x</Btn>', []],
    ['<Btn oncapture:click>x</Btn>', undefined, '<Btn>x</Btn>', []],
    [
      '<my-widget onerror>x</my-widget>',
      undefined,
      '<my-widget>x</my-widget>',
      [],
    ],
    [
      '<my-widget online>x</my-widget>',
      undefined,
      '<my-widget>x</my-widget>',
      [],
    ],
    [
      '<Btn onclick>x</Btn>',
      { overrides: { Btn: { props: {} } } },
      '<Btn>x</Btn>',
      [],
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
