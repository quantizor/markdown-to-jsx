/** @jsxImportSource solid-js */

import { afterEach, describe, expect, it, mock } from 'bun:test'
import { createSignal, type JSX } from 'solid-js'
import { $ } from './constants.ts'
import {
  astToJSX,
  compiler,
  parser,
  RuleType,
  type SolidOptions,
} from './solid.tsx'
import { escapeText, quotesDeep, storedAST, treeProps } from './test-tree.ts'
import type { MarkdownToJSX } from './types.ts'

afterEach(() => {
  mock.clearAllMocks()
})

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
    if ('p' in element && element.p && typeof element.p === 'object') {
      const props = element.p as Record<string, unknown>
      const tag = (element as { t?: string }).t
      if (tag === 'img' && typeof props.alt === 'string') {
        return props.alt
      }
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
    if (
      'props' in element &&
      element.props &&
      typeof element.props === 'object'
    ) {
      const props = element.props as { children?: unknown; innerHTML?: unknown }
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

function serialize(el: unknown): string {
  if (el === null || typeof el === 'boolean') {
    return ''
  }
  if (typeof el === 'string' || typeof el === 'number') {
    return escapeText(String(el))
  }
  if (Array.isArray(el)) {
    return el.map(serialize).join('')
  }
  const node = el as { t?: string; p?: Record<string, unknown> }
  const tag = node.t
  const props = node.p || {}
  if (!tag) {
    if (props.children === undefined && props.innerHTML !== undefined) {
      return `<innerHTML>${String(props.innerHTML)}</innerHTML>`
    }
    return serialize(props.children ?? '')
  }
  if (props.innerHTML !== undefined) {
    return `<${tag} innerHTML>${String(props.innerHTML)}</${tag}>`
  }
  return `<${tag}>${serialize(props.children ?? '')}</${tag}>`
}

it('should throw, and fail type-checking, if not passed a string (first arg)', () => {
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

  it('breaks: true renders every soft line break as a hard break, outside raw inline HTML', () => {
    expect(
      serialize(
        compiler('a\nb\n\n> c\n> d\n\n- e\n  f\n\ng <span>h\ni</span>', {
          breaks: true,
        })
      )
    ).toBe(
      '<div><p>a<br></br>b</p><blockquote><p>c<br></br>d</p></blockquote><ul><li>e<br></br>f</li></ul><p>g <span>h\ni</span></p></div>'
    )
  })

  it('renders hard breaks in forceInline text and footnote bodies, and soft ones too under breaks: true', () => {
    const footnote = 'x[^1]\n\n[^1]: a\n    b  \n    c'

    expect([
      serialize(compiler('a  \nb\nc', { forceInline: true })),
      serialize(compiler('a  \nb\nc', { breaks: true, forceInline: true })),
      serialize(compiler(footnote)),
      serialize(compiler(footnote, { breaks: true })),
    ]).toEqual([
      '<span>a<br></br>b\nc</span>',
      '<span>a<br></br>b<br></br>c</span>',
      '<div><p>x<a><sup>1</sup></a></p><footer><div>1: a\nb<br></br>c</div></footer></div>',
      '<div><p>x<a><sup>1</sup></a></p><footer><div>1: a<br></br>b<br></br>c</div></footer></div>',
    ])
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

  it('strikes through only tilde runs of exactly two', () => {
    expect(
      serialize(compiler('a ~~~c~~~ b ~~~~ ~~d~~~e~~'))
    ).toMatchInlineSnapshot(`"<span>a ~~~c~~~ b ~~~~ <del>d~~~e</del></span>"`)
  })

  it.each([
    ['==``==b==`', '<p>==``<mark>b</mark>`</p>'],
    ['~~``~~b~~`', '<p>~~``<del>b</del>`</p>'],
    ['[a ``b](/u) `c', '<p><a>a ``b</a> `c</p>'],
    ['~~a ~~', '<p>~~a ~~</p>'],
    ['~~ a~~', '<p>~~ a~~</p>'],
    ['~~a~~~\n~~<', '<p>~~a~~~\n~~&lt;</p>'],
    ['a ===c=== b', '<p>a ===c=== b</p>'],
    ['==a===b==', '<p><mark>a===b</mark></p>'],
    ['==x==', '<p><mark>x</mark></p>'],
    ['== x==', '<p>== x==</p>'],
    ['a \\==b==', '<p>a ==b==</p>'],
    ['~~foo ~~bar baz~~', '<p>~~foo <del>bar baz</del></p>'],
    ['~~a ~~b~~ c~~', '<p><del>a <del>b</del> c</del></p>'],
    ['==a ==b== c==', '<p><mark>a <mark>b</mark> c</mark></p>'],
    ['~~**a**~~', '<p><del><strong>a</strong></del></p>'],
    ['**~~a~~**', '<p><strong><del>a</del></strong></p>'],
    ['*~~a*~~', '<p><em>~~a</em>~~</p>'],
    ['~~*a~~*', '<p><del>*a</del>*</p>'],
  ])('pairs strikethrough and mark runs like emphasis: %j', (input, expected) => {
    expect(serialize(compiler(input, { forceBlock: true }))).toBe(expected)
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
  it('ends link text at a bracket inside a raw HTML element, and hides only a bracket inside the tag itself', () => {
    expect(
      serialize(
        compiler('[see <b>this]</b> note](/docs)\n\n[a <b title="]">x</b>](/u)')
      )
    ).toMatchInlineSnapshot(
      `"<div><p>[see <b>this]</b> note](/docs)</p><p><a>a <b>x</b></a></p></div>"`
    )
  })

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

  it.each([
    [
      'keeps a list loose when an HTML block ends at the blank line before a paragraph',
      '- <div>x</div>\n\n  i\n- b',
      '<ul><li><div>x</div><p>i</p></li><li><p>b</p></li></ul>',
    ],
    [
      'keeps a list loose when an unclosed HTML block ends at a blank line',
      '- <div>a\n\n  b',
      '<ul><li><div>a</div><p>b</p></li></ul>',
    ],
    [
      'keeps a list tight when a void tag is followed by a line remainder',
      '- <img src="a.png"> \n  caption\n- b',
      '<ul><li><img></img>caption</li><li>b</li></ul>',
    ],
    [
      'keeps a list tight when a self-closing component is followed by a line remainder',
      '- <MyComponent /> \n  text\n- two',
      '<ul><li><MyComponent></MyComponent>text</li><li>two</li></ul>',
    ],
  ])('%s', (_name, source, expected) => {
    expect(serialize(compiler(source))).toBe(expected)
  })

  it.each([
    ['-\n  _\n\n  )', '<ul><li><p>_</p><p>)</p></li></ul>'],
    ['-\n\n  -', '<ul><li></li><li></li></ul>'],
    ['>a\n-', '<div><blockquote><p>a</p></blockquote><ul><li></li></ul></div>'],
  ])('renders the item structure of %j as %j', (input, expected) => {
    expect(serialize(compiler(input))).toBe(expected)
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

  it.each([
    ['`a| b |\n|---|', '<p>`a| b |\n|---|</p>'],
    ['`|]\n-', '<h2>`|]</h2>'],
  ])('renders %j, a delimiter row with the wrong cell count, as %j', (input, expected) => {
    expect(serialize(compiler(input))).toBe(expected)
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

  it('should keep an alert when the marker is followed by an ideographic space', () => {
    const result = compiler('> [!NOTE]　\n> body')
    expect(serialize(result)).toBe(
      '<blockquote><header>NOTE</header><p>body</p></blockquote>'
    )
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

  it.each([
    [
      '>     code\n> para\nlazy',
      '<blockquote><pre><code>code</code></pre><p>para\nlazy</p></blockquote>',
    ],
    [
      '> para\n>     code\nlazy',
      '<blockquote><p>para\ncode\nlazy</p></blockquote>',
    ],
    [
      '> # h\nlazy',
      '<div><blockquote><h1>h</h1></blockquote><p>lazy</p></div>',
    ],
    ['- # h\nlazy', '<div><ul><li><h1>h</h1></li></ul><p>lazy</p></div>'],
    ['> ---\nlazy', '<div><blockquote><hr></hr></blockquote><p>lazy</p></div>'],
    [
      '> ```\n> a\nlazy',
      '<div><blockquote><pre><code>a</code></pre></blockquote><p>lazy</p></div>',
    ],
    [
      '- | a | b |\n  | - | - |\nlazy',
      '<div><ul><li><table><thead><tr><th>a</th><th>b</th></tr></thead></table></li></ul><p>lazy</p></div>',
    ],
    [
      '> <pre>\nlazy',
      '<div><blockquote><pre></pre></blockquote><p>lazy</p></div>',
    ],
    ['- <pre>\nlazy', '<div><ul><li><pre></pre></li></ul><p>lazy</p></div>'],
    [
      '> <div>\nlazy',
      '<div><blockquote><div></div></blockquote><p>lazy</p></div>',
    ],
    ['- <div>\nlazy', '<div><ul><li><div></div></li></ul><p>lazy</p></div>'],
    ['- </pre>\nm', '<div><ul><li><pre></pre></li></ul><p>m</p></div>'],
    ['> </pre>\nm', '<div><blockquote><pre></pre></blockquote><p>m</p></div>'],
    ['> - a\nlazy', '<blockquote><ul><li>a\nlazy</li></ul></blockquote>'],
    [
      '> > a\nlazy',
      '<blockquote><blockquote><p>a\nlazy</p></blockquote></blockquote>',
    ],
    ['> f\nbar\n> # x', '<blockquote><p>f\nbar</p><h1>x</h1></blockquote>'],
    [
      '- 10. a\n\n      b\nlazy',
      '<ul><li><ol><li><p>a</p><p>b\nlazy</p></li></ol></li></ul>',
    ],
    [
      '> 1.  one\n>\n>     two\nthree',
      '<blockquote><ol><li><p>one</p><p>two\nthree</p></li></ol></blockquote>',
    ],
    [
      '> [x]: /u\n[y]: /v\n\n[y]',
      '<div><blockquote></blockquote><p><a>y</a></p></div>',
    ],
  ])('ends or extends a container for the lazy line of %j as %j', (input, expected) => {
    expect(serialize(compiler(input))).toBe(expected)
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

  it('should not mutate AST when props change, so a memoized AST never duplicates alert headers (memoization fix)', () => {
    const markdown = '> [!NOTE]\n> Something important'
    const ast = parser(markdown)

    const blockquoteNode = ast.find(
      node =>
        node.type === RuleType.blockQuote &&
        'alert' in node &&
        node.alert === 'NOTE'
    ) as MarkdownToJSX.BlockQuoteNode | undefined
    expect(blockquoteNode).toBeDefined()
    const originalChildrenCount = blockquoteNode?.children?.length || 0

    const result1 = astToJSX(ast, { wrapperProps: { class: 'first' } })
    const result2 = astToJSX(ast, { wrapperProps: { class: 'second' } })
    const result3 = astToJSX(ast, { wrapperProps: { class: 'third' } })

    const text1 = extractTextContent(result1)
    const text2 = extractTextContent(result2)
    const text3 = extractTextContent(result3)

    const count1 = (text1.match(/NOTE/g) || []).length
    const count2 = (text2.match(/NOTE/g) || []).length
    const count3 = (text3.match(/NOTE/g) || []).length

    expect(count1).toBe(1)
    expect(count2).toBe(1)
    expect(count3).toBe(1)

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
  it('should escape script tags by default', () => {
    expect(serialize(compiler('<script>alert(1)</script>'))).toBe(
      '<span>&lt;script&gt;alert(1)&lt;/script&gt;</span>'
    )
  })

  it('should escape iframe tags by default', () => {
    expect(serialize(compiler('<iframe src="evil.com"></iframe>'))).toBe(
      '<span>&lt;iframe src="evil.com"&gt;&lt;/iframe&gt;</span>'
    )
  })

  it('should escape dangerous tags by default via astToJSX(), as compiler() does (regression: the render-time tag filter defaulted off)', () => {
    expect(serialize(astToJSX(parser('<script>alert(1)</script>')))).toBe(
      '<span>&lt;script&gt;alert(1)&lt;/script&gt;</span>'
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
    ).toBe('<span>&lt;iframe&gt;hi <em>x</em>&lt;/iframe&gt;</span>')
  })

  it('should handle HTML block with rawText when tagfilter is enabled', () => {
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
  })

  it('should handle boolean attributes in filtered HTML blocks', () => {
    const _result = compiler('<script defer>alert("xss")</script>', {
      tagfilter: true,
    })
  })

  it('should skip undefined/null/false attributes in filtered HTML blocks', () => {
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

  it('should handle Type 1 blocks without HTML tags, with tagfilter off because the default escapes <style> before the verbatim branch can render it', () => {
    const result = compiler('<style>body { color: red; }</style>', {
      tagfilter: false,
    })
    const text = extractTextContent(result)
    expect(text).toContain('body')
    expect(text).toContain('color: red')
  })

  it('should handle Type 1 blocks with tagfilter', () => {
    const result = compiler('<style>body { color: red; }</style>', {
      tagfilter: true,
    })
    const str = JSON.stringify(result)
    expect(str).toContain('style')
  })

  it('should handle HTML blocks with containsPreTags', () => {
    const result = compiler('<div><pre>code</pre></div>')
    const text = extractTextContent(result)
    expect(text).toContain('code')
  })

  it('should handle HTML blocks with containsPreTags and tagfilter', () => {
    const result = compiler('<div><pre>code</pre></div>', { tagfilter: true })
    const text = extractTextContent(result)
    expect(text).toContain('code')
  })

  it('should prevent infinite recursion with selfTagRegex', () => {
    const _result = compiler('<div></div>')
  })

  it('should handle HTML blocks with verbatim and parsed content', () => {
    const result = compiler('<div>Hello <strong>world</strong></div>')
    const text = extractTextContent(result)
    expect(text).toContain('Hello')
    expect(text).toContain('world')
  })

  it('should handle processNode with htmlSelfClosing isClosingTag', () => {
    const _result = compiler('<div>Text</div>')
  })

  it('should handle processNode with paragraph children', () => {
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
    expect(serialize(result)).toBe(
      '<div><pre>---\ntitle: Test\n---</pre><h1>Content</h1></div>'
    )
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

  it.each([
    ['x<span></span></span', '<span>x<span></span>&lt;/span</span>'],
    ['x<div></div></div', '<span>x<div></div>&lt;/div</span>'],
    ['x<Foo></Foo></Foo', '<span>x<Foo></Foo>&lt;/Foo</span>'],
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
        astToJSX(storedAST('<div>\n  <div/>\n  <span>content</span>\n</div>'))
      )
    ).toBe('<div><div></div><p><span>content</span></p></div>')
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

  it('should return null for markdown with only whitespace', () => {
    const result = compiler('   \n\n   \n\n')
    expect(result).toBeNull()
  })

  it('should return null for markdown with only newlines', () => {
    const result = compiler('\n\n\n\n')
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

  it('keeps a task marker as text unless whitespace and content follow it', () => {
    expect(serialize(compiler('- [x]foo\n- [ ] \n- [x] baz'))).toBe(
      '<ul><li>[x]foo</li><li>[ ]</li><li><input></input> baz</li></ul>'
    )
  })

  it('keeps a content tab inside a quote or list item, and drops a code span continuation line indent', () => {
    expect(
      serialize(compiler('> ```\n> a\tb\n> ```\n\n- `a\tb`\n\n``a\n b``'))
    ).toBe(
      '<div><blockquote><pre><code>a\tb</code></pre></blockquote><ul><li><code>a\tb</code></li></ul><p><code>a b</code></p></div>'
    )
  })

  it('reads a tab in a quote or list item as whitespace around a link title, a closing heading sequence, and a soft break, and as content in indented code', () => {
    expect(
      serialize(
        compiler('> [a](/u\t"t")\n\n- # x #\t\n\n> a\t\n> b\n\n>     -\tfoo')
      )
    ).toBe(
      '<div><blockquote><p><a>a</a></p></blockquote><ul><li><h1>x</h1></li></ul><blockquote><p>a\nb</p></blockquote><blockquote><pre><code>-\tfoo</code></pre></blockquote></div>'
    )
  })

  it('keeps the rest of a task marker line as text, never a block', () => {
    expect(serialize(compiler('- [x] # heading\n- [x] > quote'))).toBe(
      '<ul><li><input></input> # heading</li><li><input></input> &gt; quote</li></ul>'
    )
  })

  it('should handle footnotes', () => {
    const markdown = 'Text[^1]\n\n[^1]: Footnote content'
    const result = compiler(markdown)
    const text = extractTextContent(result)
    expect(text).toContain('Text')
    expect(text).toContain('Footnote content')
  })

  it('should handle multiple footnotes', () => {
    const markdown =
      'Text[^1] and more[^2]\n\n[^1]: First footnote\n[^2]: Second footnote'
    const result = compiler(markdown)
    const text = extractTextContent(result)
    expect(text).toContain('Text')
    expect(text).toContain('First footnote')
    expect(text).toContain('Second footnote')
  })

  it('should handle footnote identifier without caret', () => {
    const markdown = 'Text[^1]\n\n[^1]: Footnote'
    const result = compiler(markdown)
    const text = extractTextContent(result)
    expect(text).toContain('Text')
    expect(text).toContain('Footnote')
  })

  it('should handle footnote content as array', () => {
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

describe('render depth limit', () => {
  function elementDepth(tree: unknown): number {
    let depth = 0
    let current = tree
    while (current && typeof current === 'object') {
      if (Array.isArray(current)) {
        current = current[0]
      } else if ('p' in current) {
        depth++
        current = (current as { p: { children?: unknown } }).p.children
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
    expect(elementDepth(astToJSX(quotesDeep(count), { wrapper: null }))).toBe(
      expected
    )
  })

  it.each([
    [$.MAX_RENDER_DEPTH, 'x'],
    [$.MAX_RENDER_DEPTH + 1, ''],
    [$.MAX_RENDER_DEPTH * 2, ''],
  ])('continues the depth through renderChildren in a renderRule for %i nested block quotes', (count, expected) => {
    expect(
      astToJSX(quotesDeep(count), {
        wrapper: null,
        renderRule: (next, node, renderChildren) =>
          node.type === RuleType.blockQuote
            ? renderChildren(node.children)
            : next(),
      })
    ).toBe(expected)
  })
})

describe('string concatenation in renderer', () => {
  it('should concatenate consecutive strings', () => {
    const result = compiler('Text1\n\nText2')
    const text = extractTextContent(result)
    expect(text).toContain('Text1')
    expect(text).toContain('Text2')
  })

  it('should handle array output from renderRule', () => {
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
    const result = compiler('<div data-content="<span>HTML</span>">Text</div>')
    const text = extractTextContent(result)
    expect(text).toContain('Text')
  })

  it('should handle innerHTML prop', () => {
    const result = compiler('<div><pre>code</pre></div>')
    const text = extractTextContent(result)
    expect(text).toContain('code')
  })

  it('should merge className with overrides', () => {
    const result = compiler('# Hello', {
      overrides: {
        h1: { props: { className: 'custom-class' } },
      },
    })
    const str = JSON.stringify(result)
    expect(str).toContain('custom-class')
  })

  it('should handle className merging with undefined values', () => {
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
    const CustomComponent = (props: Record<string, unknown>) =>
      ({ t: 'div', p: props }) as unknown as JSX.Element
    const _result = compiler('Hello', {
      overrides: {
        p: CustomComponent,
      },
    })
  })

  it('should handle function component without children', () => {
    const CustomComponent = (props: Record<string, unknown>) =>
      ({ t: 'div', p: props }) as unknown as JSX.Element
    const _result = compiler('Text', {
      overrides: {
        p: CustomComponent,
      },
    })
  })

  it('should handle module-level h function with string tag', () => {
    const _result = compiler('# Test')
  })

  it('should handle module-level h function with function component', () => {
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
    const ast = parser('')
    const result = astToJSX(ast, { wrapper: null })
    expect(result).toBeNull()
  })

  it('should handle wrapper null with single element', () => {
    const ast = parser('# Hello')
    const result = astToJSX(ast, { wrapper: null })

    expect(Array.isArray(result)).toBe(false)
  })

  it('should handle wrapper null with multiple elements', () => {
    const ast = parser('# Hello\n\n## World')
    const result = astToJSX(ast, { wrapper: null })

    expect(Array.isArray(result)).toBe(true)
  })

  it('should handle forceWrapper with single element', () => {
    const ast = parser('# Hello')
    const _result = astToJSX(ast, { forceWrapper: true })
  })

  it('should handle forceInline wrapper', () => {
    const result = compiler('Inline text', { forceInline: true })
    const text = extractTextContent(result)
    expect(text).toContain('Inline text')
  })

  it('should handle wrapper with empty array', () => {
    const ast = parser('')
    const result = astToJSX(ast, { wrapper: 'div' })
    expect(result).toBeNull()
  })
})

describe('Markdown component', () => {
  it('should handle function children (Accessor)', () => {
    const [content, _setContent] = createSignal('Hello')
    const result = compiler(content())
    const text = extractTextContent(result)
    expect(text).toContain('Hello')
  })

  it('should handle null children in Markdown component', () => {
    const result = compiler('')
    expect(result).toBeNull()
  })

  it('should handle undefined children in Markdown component', () => {
    const result = compiler('')
    expect(result).toBeNull()
  })

  it('should filter props in Markdown component', () => {
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
    const result = compiler('> First\n> Second\n> Third')
    const text = extractTextContent(result)
    expect(text).toContain('First')
    expect(text).toContain('Second')
    expect(text).toContain('Third')
  })

  it('should handle blockQuote with single child (non-array)', () => {
    const result = compiler('> Single line quote')
    const text = extractTextContent(result)
    expect(text).toContain('Single line quote')
  })
})

describe('heading children handling', () => {
  it('should handle heading with array children', () => {
    const result = compiler('# Heading with **bold** and _italic_')
    const text = extractTextContent(result)
    expect(text).toContain('Heading')
    expect(text).toContain('bold')
    expect(text).toContain('italic')
  })

  it('should handle heading with single child (non-array)', () => {
    const result = compiler('# Simple heading')
    const text = extractTextContent(result)
    expect(text).toContain('Simple heading')
  })
})

describe('HTML block tagfilter with rawText', () => {
  it('should handle HTML block with rawText when tagfilter is enabled', () => {
    const result = compiler('<script>alert("xss")</script>', {
      tagfilter: true,
    })
    const str = JSON.stringify(result)
    expect(str).toContain('script')
  })
})

describe('HTML block Type 1 blocks with tagfilter', () => {
  it('should apply tagfilter to Type 1 block text content', () => {
    const result = compiler('<style>body { color: red; }</style>', {
      tagfilter: true,
    })
    const str = JSON.stringify(result)
    expect(str).toContain('style')
  })
})

describe('HTML block containsPreTags path', () => {
  it('should handle HTML block with containsPreTags without tagfilter', () => {
    const result = compiler('<div><pre>code</pre></div>', { tagfilter: false })
    const text = extractTextContent(result)
    expect(text).toContain('code')
  })

  it('should handle HTML block with containsPreTags with tagfilter', () => {
    const result = compiler('<div><pre>code</pre></div>', { tagfilter: true })
    const text = extractTextContent(result)
    expect(text).toContain('code')
  })
})

describe('HTML block cleanedText and selfTagRegex', () => {
  it('should handle cleanedText processing', () => {
    const result = compiler('<div>Hello\n\nWorld</div>')
    const text = extractTextContent(result)
    expect(text).toContain('Hello')
    expect(text).toContain('World')
  })

  it('should handle cleanedText with whitespace normalization', () => {
    const result = compiler('<div>Hello > < World</div>')
    const text = extractTextContent(result)
    expect(text).toContain('Hello')
  })

  it('should prevent infinite recursion with selfTagRegex', () => {
    const _result = compiler('<div></div>')
  })

  it('should prevent infinite recursion with selfTagRegex with attributes', () => {
    const _result = compiler('<div class="test"></div>')
  })

  it('should return empty element when selfTagRegex matches', () => {
    const _result = compiler('<div></div>')
  })
})

describe('processNode htmlBlock children', () => {
  it('should handle processNode with htmlBlock that has children', () => {
    const result = compiler('<div><span>Nested</span></div>')
    const text = extractTextContent(result)
    expect(text).toContain('Nested')
  })
})

describe('processNode function branches', () => {
  it('should handle processNode with htmlSelfClosing isClosingTag', () => {
    const _result = compiler('<div>Text</div>')
  })

  it('should handle processNode with paragraph children', () => {
    const result = compiler('<div><p>Paragraph</p></div>')
    const text = extractTextContent(result)
    expect(text).toContain('Paragraph')
  })

  it('should handle processNode with paragraph without children', () => {
    const _result = compiler('<div><p></p></div>')
  })

  it('should handle processNode with text nodes', () => {
    const result = compiler('<div>Plain text</div>')
    const text = extractTextContent(result)
    expect(text).toContain('Plain text')
  })

  it('should handle processNode with empty text nodes', () => {
    const _result = compiler('<div>   </div>')
  })

  it('should handle processNode with htmlBlock children', () => {
    const result = compiler('<div><div>Nested</div></div>')
    const text = extractTextContent(result)
    expect(text).toContain('Nested')
  })

  it('should handle processNode with other node types', () => {
    const result = compiler('<div>Text with <code>code</code></div>')
    const text = extractTextContent(result)
    expect(text).toContain('Text')
    expect(text).toContain('code')
  })
})

describe('processedChildren handling', () => {
  it('should handle processedChildren as array', () => {
    const result = compiler('<div>Hello <strong>world</strong></div>')
    const text = extractTextContent(result)
    expect(text).toContain('Hello')
    expect(text).toContain('world')
  })

  it('should handle processedChildren as non-array', () => {
    const result = compiler('<div>Single text</div>')
    const text = extractTextContent(result)
    expect(text).toContain('Single text')
  })

  it('should handle processedChildren wrapping non-array in array', () => {
    const result = compiler('<div>Text</div>')
    const text = extractTextContent(result)
    expect(text).toContain('Text')
  })
})

describe('HTML block children null handling', () => {
  it('should handle HTML block with null children', () => {
    const _result = compiler('<div></div>')
  })
})

describe('HTML self-closing tagfilter', () => {
  it('should handle self-closing tagfilter with rawText', () => {
    const _result = compiler('<script src="evil.js" />', { tagfilter: true })
  })

  it('should format attributes for filtered self-closing tags', () => {
    const _result = compiler('<iframe src="evil.com" />', { tagfilter: true })
  })
})

describe('table alignment null handling', () => {
  it('should handle table header cells with null alignment', () => {
    const markdown = '| A | B |\n|---|---|\n| 1 | 2 |'
    const result = compiler(markdown)
    const text = extractTextContent(result)
    expect(text).toContain('A')
    expect(text).toContain('B')
  })

  it('should handle table cells with null alignment', () => {
    const markdown = '| A | B |\n|---|---|\n| 1 | 2 |'
    const result = compiler(markdown)
    const text = extractTextContent(result)
    expect(text).toContain('1')
    expect(text).toContain('2')
  })
})

describe('textFormatted children', () => {
  it('should handle textFormatted with array children', () => {
    const result = compiler('**_bold italic_**')
    const text = extractTextContent(result)
    expect(text).toContain('bold italic')
  })

  it('should handle textFormatted with single child (non-array)', () => {
    const result = compiler('**bold**')
    const text = extractTextContent(result)
    expect(text).toContain('bold')
  })
})

describe('list item content handling', () => {
  it('should handle list items with array content', () => {
    const result = compiler('- Item with **bold** text')
    const text = extractTextContent(result)
    expect(text).toContain('Item')
    expect(text).toContain('bold')
  })

  it('should handle list items with single content (non-array)', () => {
    const result = compiler('- Simple item')
    const text = extractTextContent(result)
    expect(text).toContain('Simple item')
  })
})

describe('renderRule userRender path', () => {
  it('should use userRender when provided', () => {
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
    const result = compiler('<div data-content="<span>HTML</span>">Text</div>')
    const text = extractTextContent(result)
    expect(text).toContain('Text')
  })
})

describe('innerHTML handling', () => {
  it('should handle innerHTML with overrides', () => {
    const result = compiler('<div><pre>code</pre></div>', {
      overrides: {
        div: { props: { className: 'custom' } },
      },
    })
    const text = extractTextContent(result)
    expect(text).toContain('code')
  })

  it('should handle innerHTML with className merging', () => {
    const result = compiler('<div><pre>code</pre></div>', {
      overrides: {
        div: { props: { className: 'override-class' } },
      },
    })
    const str = JSON.stringify(result)
    expect(str).toContain('override-class')
  })

  it('should handle innerHTML with undefined className', () => {
    const _result = compiler('<div><pre>code</pre></div>', {
      overrides: {
        div: { props: {} },
      },
    })
  })

  it('should respect user-provided innerHTML in override props over parser-generated innerHTML', () => {
    const result = compiler('<div><pre>original</pre></div>', {
      overrides: {
        div: { props: { innerHTML: '<span>override</span>' } },
      },
    })
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
    expect(innerHtml).toBe('<span>override</span>')
    expect(innerHtml).not.toContain('original')
  })
})

describe('post-processing AST extractText', () => {
  it('should handle extractText with various node types', () => {
    const result = compiler('<pre>code</pre>\n\nParagraph')
    const text = extractTextContent(result)
    expect(text).toContain('code')
    expect(text).toContain('Paragraph')
  })

  it('should handle extractText with textFormatted nodes', () => {
    const result = compiler('<div>_emphasized_ **bold**</div>')
    const text = extractTextContent(result)
    expect(text).toContain('emphasized')
    expect(text).toContain('bold')
  })

  it('should handle extractText with textFormatted em tag', () => {
    const result = compiler('<div>_emphasized_</div>')
    const text = extractTextContent(result)
    expect(text).toContain('emphasized')
  })

  it('should handle extractText with textFormatted strong tag', () => {
    const result = compiler('<div>**bold**</div>')
    const text = extractTextContent(result)
    expect(text).toContain('bold')
  })

  it('should handle extractText with textFormatted other tag', () => {
    const result = compiler('<div><code>code</code></div>')
    const text = extractTextContent(result)
    expect(text).toContain('code')
  })

  it('should handle extractText with htmlSelfClosing rawText', () => {
    const result = compiler('<div>Text<br />More</div>')
    const text = extractTextContent(result)
    expect(text).toContain('Text')
    expect(text).toContain('More')
  })

  it('should handle extractText with removedClosingTags', () => {
    const markdown =
      '<pre>code</pre>\n\nParagraph with </pre></td></tr></table>'
    const result = compiler(markdown)
    const text = extractTextContent(result)
    expect(text).toContain('code')
    expect(text).toContain('Paragraph')
  })

  it('should handle extractText with removedClosingTags that contain closing tag', () => {
    const markdown = '<div>content</div>\n\nParagraph with </div></span></p>'
    const _result = compiler(markdown)
  })

  it('should handle extractText with removedClosingTags without rawText', () => {
    const markdown = '<pre>code</pre>\n\nParagraph with </pre></td></tr>'
    const _result = compiler(markdown)
  })

  it('should handle extractText with removedClosingTags that are not htmlSelfClosing', () => {
    const markdown = '<pre>code</pre>\n\nParagraph'
    const _result = compiler(markdown)
  })

  it('should not mutate AST when Markdown component re-renders with different props, so a memoized ast() with a recalculated jsx() never accumulates text', () => {
    const markdown =
      '<pre>code</pre>\n\nParagraph with </pre></td></tr></table>'
    const ast = parser(markdown)

    const result1 = astToJSX(ast)
    const text1 = extractTextContent(result1)

    const result2 = astToJSX(ast)
    const text2 = extractTextContent(result2)

    expect(text1).toBe(text2)
    expect(text1).toContain('code')
    expect(text1).toContain('Paragraph')

    const htmlBlock = ast.find(
      n => n.type === RuleType.htmlBlock
    ) as MarkdownToJSX.HTMLNode
    if (htmlBlock?.text) {
      const paragraphMatches = (htmlBlock.text.match(/Paragraph/g) || []).length
      expect(paragraphMatches).toBeLessThanOrEqual(1)
    }
  })

  it('should not mutate options object when calling astToJSX multiple times, so a reused options object has no side effects', () => {
    const markdown = '# Hello world'
    const ast = parser(markdown)
    const options: SolidOptions = {
      slugify: (input: string) => input.toLowerCase(),
    }
    const originalOverrides = options.overrides

    astToJSX(ast, options)

    expect(options.overrides).toBe(originalOverrides)

    astToJSX(ast, options)

    expect(options.overrides).toBe(originalOverrides)
  })

  it('should not mutate options object when calling compiler multiple times', () => {
    const markdown = '# Hello world'
    const options: SolidOptions = {
      slugify: (input: string) => input.toLowerCase(),
    }
    const originalOverrides = options.overrides

    compiler(markdown, options)

    expect(options.overrides).toBe(originalOverrides)

    compiler(markdown, options)

    expect(options.overrides).toBe(originalOverrides)
  })
})

describe('footnote identifier handling', () => {
  it('should handle footnote identifier without caret', () => {
    const markdown = 'Text[^1]\n\n[^1]: Footnote'
    const result = compiler(markdown)
    const text = extractTextContent(result)
    expect(text).toContain('Text')
    expect(text).toContain('Footnote')
  })

  it('should handle footnote identifier that starts with caret', () => {
    const markdown = 'Text[^1]\n\n[^1]: Footnote'
    const _result = compiler(markdown)
  })
})

describe('compiler validation', () => {
  it('should throw error for invalid markdown type', () => {
    expect(() => {
      compiler(null as any)
    }).toThrow()
  })

  it('should throw error for invalid overrides type', () => {
    expect(() => {
      compiler('text', { overrides: 'invalid' as any })
    }).toThrow()
  })
})

describe('Markdown component', () => {
  it('should handle function children (Accessor)', () => {
    const result = compiler('Hello')
    const text = extractTextContent(result)
    expect(text).toContain('Hello')
  })

  it('should handle null children in Markdown component', () => {
    const result = compiler('')
    expect(result).toBeNull()
  })

  it('should handle undefined children in Markdown component', () => {
    const result = compiler('')
    expect(result).toBeNull()
  })

  it('should handle Markdown component with wrapperProps', () => {
    const _result = compiler('# Test', {
      wrapperProps: { class: 'custom' },
    })
  })

  it('should handle Markdown component with filtered props', () => {
    const _result = compiler('# Test')
  })
})

describe('module-level h function', () => {
  it('should handle module-level h with string tag and children', () => {
    const _result = compiler('# Test')
  })

  it('should handle module-level h with function component and children', () => {
    const CustomComponent = (props: Record<string, unknown>) =>
      ({ t: 'div', p: props }) as unknown as JSX.Element
    const _result = compiler('Hello', {
      overrides: {
        p: CustomComponent,
      },
    })
  })

  it('should handle module-level h with function component without children', () => {
    const CustomComponent = (props: Record<string, unknown>) =>
      ({ t: 'div', p: props }) as unknown as JSX.Element
    const _result = compiler('Text', {
      overrides: {
        p: CustomComponent,
      },
    })
  })

  it('should handle module-level h with non-string non-function tag', () => {
    const _result = compiler('# Test')
  })
})

describe('MarkdownProvider', () => {
  it('should handle MarkdownProvider with options', () => {
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

  it('text after the element own closing tag renders as a sibling of the span div, wrapped in the multi-root container Solid builds', () => {
    expect(
      serialize(compiler('<div>\n<span>a</span>\n</div>\ntail'))
    ).toMatchInlineSnapshot(`"<div><div><span>a</span></div> tail</div>"`)
  })

  it('never injects dangerous raw HTML attributes, because Solid injects verbatim blocks via innerHTML with no framework backstop and parser-level stripping is the only defense', () => {
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

  it('folds accented Latin letters and ß into the heading id', () => {
    expect(collectIds(compiler('# Öl Straße\n\n# Łódź'))).toEqual([
      'ol-strasse',
      'lodz',
    ])
  })

  it.each([
    '# !!!',
    '# `]`',
  ])('omits the id of %j, a heading with an empty slug', input => {
    expect(collectIds(compiler(input))).toEqual([])
  })
})

describe('destination entity decode before sanitize', () => {
  it('drops entity-obfuscated javascript: href and src', () => {
    expect(firstHref(compiler('[x](&#106;avascript:alert(1))'))).toBeUndefined()
    expect(
      firstHref(compiler('![x](&#106;avascript:alert(1))'))
    ).toBeUndefined()
  })

  it('percent-encodes a control character in an image src as in a link href', () => {
    expect(firstHref(compiler('![x](java\u0001script:alert(1))'))).toBe(
      'java%01script:alert(1)'
    )
    expect(firstHref(compiler('![x](java&#1;script:alert(1))'))).toBe(
      'java%01script:alert(1)'
    )
    expect(firstHref(compiler('[x](java\u0001script:alert(1))'))).toBe(
      'java%01script:alert(1)'
    )
  })

  it.each([
    ['tab in an angle-bracket destination', '![x](<java\tscript:alert(1)>)'],
    ['tab entity', '![x](java&#9;script:alert(1))'],
    ['newline entity', '![x](java&#10;script:alert(1))'],
    ['percent tab, mixed case', '![x](JaVa%09ScRiPt:alert(1))'],
    ['percent control character', '![x](java%01script:alert(1))'],
    ['percent letter', '![x](java%73cript:alert(1))'],
  ])('drops an image src whose stripped form is a dangerous scheme: %s', (_, input) => {
    expect(firstHref(compiler(input))).toBeUndefined()
  })

  it('keeps and encodes a safe image src', () => {
    expect(firstHref(compiler('![x](https://a.b/c.png)'))).toBe(
      'https://a.b/c.png'
    )
    expect(firstHref(compiler('![x](<a b.png>)'))).toBe('a%20b.png')
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

  it('writes a textarea body, markup and references included, as its inner HTML, which a browser shows as text', () => {
    expect(
      serialize(
        compiler('<textarea><b>x</b> &amp;</textarea>', { tagfilter: false })
      )
    ).toBe('<textarea innerHTML><b>x</b> &amp;</textarea>')
  })

  it('writes the body of a textarea written in capitals', () => {
    expect(
      serialize(compiler('<TEXTAREA>a &lt; b</TEXTAREA>', { tagfilter: false }))
    ).toBe('<TEXTAREA>a &lt; b</TEXTAREA>')
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
  it('removes only the genuinely unclosed emphasis opener on the last line, keeping literal `_` and `*` in finished text (issue #905)', () => {
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

  it('hides a never-closed opener while the option is on, since the parser cannot tell a streaming edge from finished text, and shows it as written in the final render with the option off (issue #909)', () => {
    const md = 'Use _trace and *args'
    expect(
      serialize(compiler(md, { optimizeForStreaming: true }))
    ).toMatchInlineSnapshot(`"Use trace and args"`)
    expect(
      serialize(compiler(md, { optimizeForStreaming: false }))
    ).toMatchInlineSnapshot(`"Use _trace and *args"`)
  })

  it('keeps complete HTML, and incomplete-looking links and code in a block that is no longer the last one, rendering exactly as without the option', () => {
    const md = 'a <span>z</span> <br> b\n\nsee [a](b and `code\n\nlast'
    const streamed = serialize(compiler(md, { optimizeForStreaming: true }))
    expect(streamed).toBe(serialize(compiler(md)))
    expect(streamed).toMatchInlineSnapshot(
      `"<div><p>a <span>z</span> <br></br> b</p><p>see [a](b and \`code</p><p>last</p></div>"`
    )
  })
})

describe('optimizeForStreaming preserves literal less-than', () => {
  it('keeps comparison prose and defers incomplete tag prefixes, on single-line input that auto-inlines so serialize sees a bare text node', () => {
    expect(
      serialize(compiler('5 < 3 is false', { optimizeForStreaming: true }))
    ).toBe('5 &lt; 3 is false')
    expect(
      serialize(compiler('Hello <Citation', { optimizeForStreaming: true }))
    ).toBe('Hello ')
    expect(
      serialize(
        compiler('x < y\n\nsecond para', { optimizeForStreaming: true })
      )
    ).toBe('<div><p>x &lt; y</p><p>second para</p></div>')
  })

  it('reads a closing tag after an unfinished opener the way a full parse does', () => {
    expect(
      serialize(compiler('x <Comp </b>y', { optimizeForStreaming: true }))
    ).toBe('<span>x &lt;Comp <b></b>y</span>')
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

const handlerProps = (el: unknown) =>
  treeProps(el)
    .filter(([name]) => name.toLowerCase().startsWith('on'))
    .map(([name, value]) => `${name}=${typeof value}`)

const firstHref = (el: unknown) =>
  treeProps(el).find(
    ([name, value]) =>
      (name === 'href' || name === 'src') && value !== undefined
  )?.[1]

const propNames = (el: unknown) =>
  treeProps(el)
    .map(([name]) => name)
    .filter(name => name !== 'innerHTML')

describe('attribute names a renderer acts on rather than writes', () => {
  it('passes a name that ends in a colon on as written', () => {
    const result = compiler('<span a:="1">b</span>')

    expect(serialize(result)).toBe('<span>b</span>')
    expect(propNames(result)).toEqual(['a:'])
  })

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
    ['<pre><b>x</b></pre>', '<pre innerHTML><b>x</b></pre>'],
    ['<div><pre>a</pre></div>', '<div innerHTML><pre>a</pre></div></div>'],
  ])('renders %j with no prop, as %j', (input, expected) => {
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
    ).toBe('<A></A>')
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
    ['<Btn srcDoc={"<script>alert(1)</script>"}>x</Btn>', '<Btn>x</Btn>', []],
    ['<Btn attributeName={href}>x</Btn>', '<Btn>x</Btn>', []],
    ['<Btn attributeName={opacity}>x</Btn>', '<Btn>x</Btn>', ['attributeName']],
    ['<Btn href={link}>x</Btn>', '<Btn>x</Btn>', ['href']],
    [
      '<!-- c --> <script>alert(1)</script>',
      '<span> <span>&lt;script&gt;alert(1)&lt;/script&gt;</span></span>',
      [],
    ],
    [
      '- a <!-- c --> <script>alert(1)</script>',
      '<ul><li>a  <span>&lt;script&gt;alert(1)&lt;/script&gt;</span></li></ul>',
      ['start'],
    ],
    ['<!-- <script> -->', '', []],
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
    ['<div x={a><script>alert(1)</script>}>y</div>', '<div>y</div>', ['x']],
    ['<img children="z" src="/x">', '<img></img>', ['src']],
    ['![" onclick=alert(1)>](/x)', '<img></img>', ['alt', 'title', 'src']],
  ])('renders %j as %j, with props %j', (input, expected, props) => {
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
})

describe('a children attribute on a tag with an override', () => {
  const card = { card: { component: 'i' } }

  it.each([
    ['<card children="z" />', card],
    ['<card children="z" />', Object.create(card)],
    ['<CARD children="z" />', card],
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
      '<img></img>',
    ],
    ['<card children="z" />', { card: { component: 'img' } }, '<img></img>'],
  ])('does not throw on %j with void override %j', (input, overrides, expected) => {
    expect(serialize(compiler(input, { overrides }))).toBe(expected)
  })

  it.each([
    [
      'a capitalized self-closing tag',
      '<Card children="z" />',
      card,
      '<i>z</i>',
    ],
    [
      'a self-closing tag with a trailing newline',
      '<Card children="z" />\n',
      card,
      '<i>z</i>',
    ],
    [
      'a self-closing tag between blocks',
      'a\n\n<Card children="z" />\n\nb',
      card,
      '<div><p>a</p><i>z</i><p>b</p></div>',
    ],
    [
      'a self-closing tag inside a paragraph',
      'x <Card children="z" /> y',
      card,
      '<span>x <i>z</i> y</span>',
    ],
    ['a lowercase self-closing tag', '<card children="z" />', card, '<i>z</i>'],
    [
      'an uppercase self-closing tag',
      '<CARD children="z" />',
      card,
      '<i>z</i>',
    ],
    [
      'a hyphenated self-closing tag',
      '<my-el children="z" />',
      { 'my-el': { component: 'i' } },
      '<i>z</i>',
    ],
    ['a lowercase empty pair', '<card children="z"></card>', card, '<i>z</i>'],
    [
      'a lowercase empty pair between blocks',
      'a\n\n<card children="z"></card>\n\nb',
      card,
      '<div><p>a</p><p><i>z</i></p><p>b</p></div>',
    ],
    [
      'a capitalized empty pair',
      '<Card children="z"></Card>',
      card,
      '<i>z</i>',
    ],
    [
      'a capitalized empty pair inside a paragraph',
      'x <Card children="z"></Card> y',
      card,
      '<span>x <i>z</i> y</span>',
    ],
    [
      'a registered tag kept as written',
      '<Card children="z" />',
      { Card: { props: {} } },
      '<Card>z</Card>',
    ],
    [
      'an attribute name in uppercase',
      '<Card CHILDREN="z" />',
      card,
      '<i>z</i>',
    ],
    [
      'a value read as text, with its entity and markup as written',
      '<Card children="a &amp; <b>" />',
      card,
      '<i>a &amp;amp; &lt;b&gt;</i>',
    ],
    ['a brace value', '<Card children={x} />', card, '<i>x</i>'],
    ['a quoted brace value', '<Card children={"q"} />', card, '<i>"q"</i>'],
    ['a bare name, which holds no text', '<Card children />', card, '<i></i>'],
    [
      'an object value, which no element can hold',
      '<Card children={{"a":1}} />',
      card,
      '<i></i>',
    ],
    [
      'a Solid-prefixed name, which is not children',
      '<Card attr:children="z" />',
      card,
      '<i></i>',
    ],
    [
      'a void override',
      '<Card children="z" />',
      { card: { component: 'img' } },
      '<img></img>',
    ],
    [
      'a pair with content of its own',
      '<card children="z">inner</card>',
      card,
      '<i>inner</i>',
    ],
    [
      'a capitalized pair with content of its own',
      '<Card children="z">inner</Card>',
      card,
      '<i>inner</i>',
    ],
    ['an unregistered tag', '<Card children="z" />', {}, '<Card></Card>'],
    [
      'a lowercase tag no override names',
      '<card children="z" />',
      {},
      '<card></card>',
    ],
    ['an unclosed tag', '<Card children="z">', card, '<i>z</i>'],
    [
      'an unclosed tag with a trailing newline',
      '<Card children="z">\n',
      card,
      '<i>z</i>',
    ],
    [
      'an unclosed tag between blocks, which closes before the next block',
      'a\n\n<Card children="z">\n\nb',
      card,
      '<div><p>a</p><i>z</i><p>b</p></div>',
    ],
    [
      'an unclosed tag with a void override',
      '<Card children="z">',
      { card: { component: 'img' } },
      '<img></img>',
    ],
    [
      'an unclosed pre block with content of its own',
      '<pre children="z">a',
      { pre: { props: {} } },
      '<pre>a</pre>',
    ],
    [
      'a value with markup characters and a run of spaces',
      '<Card children="a >  < b" />',
      card,
      '<i>a &gt;  &lt; b</i>',
    ],
    [
      'a value with a line break',
      '<Card children="a\nb" />',
      card,
      '<i>a\nb</i>',
    ],
    [
      'a value with a CRLF line break, read as a line feed',
      '<Card children="a\r\nb" />',
      card,
      '<i>a\nb</i>',
    ],
    [
      'a value with markup characters and a run of spaces inside a raw block',
      '<div>\n<Card children="a >  < b" />\n</div>',
      card,
      '<div><i>a &gt;  &lt; b</i></div>',
    ],
    [
      'a value with a line break inside a raw block',
      '<div>\n<Card children="a\nb" />\n</div>',
      card,
      '<div><i>a\nb</i></div>',
    ],
    [
      'a value with a CRLF line break inside a raw block',
      '<div>\r\n<Card children="a\r\nb" />\r\n</div>',
      card,
      '<div><i>a\nb</i></div>',
    ],
    [
      'a registered tag inside a raw block',
      '<div>\n<Card children="z" />\n</div>',
      card,
      '<div><i>z</i></div>',
    ],
    [
      'a lowercase pair inside a raw block',
      '<div>\n<card children="z"></card>\n</div>',
      card,
      '<div><i>z</i></div>',
    ],
    [
      'a capitalized pair inside a raw block',
      '<div>\n<Card children="z"></Card>\n</div>',
      card,
      '<div><i>z</i></div>',
    ],
    [
      'a registered tag two raw blocks deep',
      '<div>\n<section>\n<Card children="z" />\n</section>\n</div>',
      card,
      '<div><section><i>z</i></section></div>',
    ],
    [
      'a registered tag inside a raw block with a line after its closer',
      '<div>\n<card children="z"></card>\n</div>\ntail',
      card,
      '<div><div><i>z</i></div> tail</div>',
    ],
    [
      'a pair with content of its own inside a raw block',
      '<div>\n<Card children="z">inner</Card>\n</div>',
      card,
      '<div><i>inner</i></div>',
    ],
    [
      'a markup value inside a raw block, read as text rather than as an element, which would serialize as `<img></img>`',
      '<div>\n<Card children="<img src=x onerror=alert(1)>" />\n</div>',
      card,
      '<div><i>&lt;img src=x onerror=alert(1)&gt;</i></div>',
    ],
  ])('renders %s as its content, since an element with no content of its own takes the value as text in any document shape', (_title, input, overrides, expected) => {
    expect(serialize(compiler(input, { overrides }))).toBe(expected)
  })

  it('keeps a registered tag inside a pre block as written, without the attribute', () => {
    expect(
      serialize(
        compiler('<pre>\n<Card children="z" />\n</pre>', { overrides: card })
      )
    ).toBe('<pre innerHTML><Card  /></pre>')
  })
})

describe('code naming a filtered tag', () => {
  it.each([
    [{}],
    [{ disableParsingRawHTML: true }],
  ])('stays code with %j, as only the markdown output writes it differently', options => {
    expect(serialize(compiler('`<script>`', options))).toBe(
      '<code>&lt;script&gt;</code>'
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
    ['<?"><b onclick=alert(1)>b</b>', '<span>&lt;?"&gt;<b>b</b></span>'],
    [
      '<div>\n<!-- x\n\n<a title="--><img src=x onerror=alert(1)>">',
      '<div><div></div><a></a></div>',
    ],
    [
      '<!---><noscript><a title="</noscript><img src=x onerror=alert(1)>">',
      '<span><noscript>&lt;a title="</noscript><img></img>"&gt;</span>',
    ],
    [
      '<!-- x\n\n<a title="--><b y=\'">\n\n\' onclick=alert(1)>',
      "<p>' onclick=alert(1)&gt;</p>",
    ],
    ['<a x="<b" y=z>', '<a></a>'],
    ["<div onclick='alert(1)'--!>", "&lt;div onclick='alert(1)'--!&gt;"],
    ['<div onclick={alert(1)}<xmp>', '&lt;div onclick={alert(1)}&lt;xmp&gt;'],
    ['<div x={a><img src=x onerror=alert(1)>}>\nhi\n</div>', '<div>hi</div>'],
    [
      'p <span x={a><img src=x onerror=alert(1)>}>hi</span>',
      '<span>p <span>hi</span></span>',
    ],
    ['<pre><Img onclick={alert(1)}', '<pre>&lt;Img onclick={alert(1)}</pre>'],
    ['<div>\n<b onclick=alert(1)', '<div>&lt;b onclick=alert(1)</div>'],
    ['```x onmouseover="alert(1)"\ny\n```', '<pre><code>y</code></pre>'],
    ['```x style="color:red"\ny\n```', '<pre><code>y</code></pre>'],
    [
      '<iframe><img src=x onerror=alert(1)',
      '<span><span>&lt;iframe&gt;</span>&lt;img src=x onerror=alert(1)</span>',
    ],
    ['\\<svg onload=alert(1)>', '&lt;svg onload=alert(1)&gt;'],
    [
      '&lt;img src=x onerror=alert(1)&gt;',
      '&lt;img src=x onerror=alert(1)&gt;',
    ],
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
    [
      'x <span><javascript:alert(1)//\xa0></span>',
      '<span>x <span><a>javascript:alert(1)//\xa0</a></span></span>',
    ],
    [
      'x <span><JavaScript:alert&#40;1&#41;\u{2003}x></span>',
      '<span>x <span><a>JavaScript:alert&amp;#40;1&amp;#41;\u{2003}x</a></span></span>',
    ],
    [
      'x <span><a:b\xa0<javascript:alert(1)\u{2028}x></span>',
      '<span>x <span>&lt;a:b\xa0<a>javascript:alert(1)\u{2028}x</a></span></span>',
    ],
    [
      'x <span>[y <https:a\xa0](javascript:alert(1))></span>',
      '<span>x <span>[y <a>https:a\xa0](javascript:alert(1))</a></span></span>',
    ],
    [
      'x <span><javascript:a](<javascript:alert(1)>)></span>',
      '<span>x <span>&lt;javascript:a](<a>javascript:alert(1)</a>)&gt;</span></span>',
    ],
    ['[l](&amp;amp;#106;avascript:alert(1))', '<a>l</a>'],
    ['[l](&#106avascript:alert(1))', '<a>l</a>'],
    ['a\nb\n=', '<h1>a\nb</h1>'],
    [
      '- [^1]: a )\n[^1]:&#106avascript:alert(1)',
      '<div><ul><li><a><sup>1</sup></a>:&amp;#106avascript:alert(1)</li></ul><footer><div>1: a )</div></footer></div>',
    ],
    ['<q> <b>x</b>', '<span><q></q> <b>x</b></span>'],
    ['&amp;copy; a &amp; b', '&amp;copy; a &amp; b'],
    [
      '\n﻿[^1]:javascript:alert(1)\n[^1]',
      '<p>﻿[^1]:javascript:alert(1)\n[^1]</p>',
    ],
    [
      '<title>a\n\n<!--</title>\n\n```\n<b>\n```',
      '<div><span>&lt;title&gt;<p>a</p>&lt;/title&gt;</span><pre><code>&lt;b&gt;</code></pre></div>',
    ],
    [
      '1. # [^1]\n[^1]:&#106avascript:alert(1)',
      '<div><ol><li><h1><a><sup>1</sup></a></h1></li></ol><footer><div>1: &amp;#106avascript:alert(1)</div></footer></div>',
    ],
    [
      '1. a [^1]\n[^1]:&#106avascript:alert(1)',
      '<ol><li>a [^1]\n[^1]:&amp;#106avascript:alert(1)</li></ol>',
    ],
    [
      '1. <!-- c --> x\n[^1]:&#106avascript:alert(1)\n\n[^1]',
      '<div><ol><li></li></ol><p><a><sup>1</sup></a></p><footer><div>1: &amp;#106avascript:alert(1)</div></footer></div>',
    ],
    [
      '- <pre>x\ny</pre>',
      '<div><ul><li><pre>x</pre></li></ul><p>y<pre></pre></p></div>',
    ],
    ['- <!-- x\ny -->', '<div><ul><li></li></ul><p>y --&gt;</p></div>'],
    [
      '- <div\nonclick=alert(1)>x</div>',
      '<div><ul><li>&lt;div</li></ul><p>onclick=alert(1)&gt;x<div></div></p></div>',
    ],
    ['- a <div\nonclick=alert(1)>x</div>', '<ul><li>a <div>x</div></li></ul>'],
    ['- <x-y\nonclick=alert(1)>y</x-y>', '<ul><li><x-y>y</x-y></li></ul>'],
    ['- <Foo x="1\n2">y</Foo>', '<ul><li><Foo>y</Foo></li></ul>'],
    [
      '- ```\ny',
      '<div><ul><li><pre><code></code></pre></li></ul><p>y</p></div>',
    ],
    ['1. <x-y>x\ny', '<ol><li><x-y>x y</x-y></li></ol>'],
    ['1. [r]:\n/u "a\nb"\n\n   [r]', '<ol><li><p><a>r</a></p></li></ol>'],
    [
      '- <b>f</b><!-- c --><img\nsrc=x>z onclick=alert(1)',
      '<ul><li><b>f</b><img></img>z onclick=alert(1)</li></ul>',
    ],
    [
      '- # h\na | b\n  --- | ---',
      '<div><ul><li><h1>h</h1></li></ul><table><thead><tr><th>a</th><th>b</th></tr></thead></table></div>',
    ],
    [
      '- - [^1]:\nz\n\n  [^1]',
      '<div><ul><li><ul><li></li></ul><p><a><sup>1</sup></a></p></li></ul><footer><div>1: z</div></footer></div>',
    ],
    ['[r]: a\\\nb\n\n[r]', '<div><p>b</p><p><a>r</a></p></div>'],
    ['[r]: a\\ "t"\n\n[r]', '<p><a>r</a></p>'],
    ['[r]: <a\\\nb>', '<p>[r]: &lt;a<br></br>b&gt;</p>'],
    ['[x](a\\\\)', '<a>x</a>'],
    [
      '- a | b\n  --- | ---\nc | d',
      '<div><ul><li><table><thead><tr><th>a</th><th>b</th></tr></thead></table></li></ul><p>c | d</p></div>',
    ],
    [
      '1. [^1]:\nb\n\n   [^1]',
      '<div><ol><li><p><a><sup>1</sup></a></p></li></ol><footer><div>1: b</div></footer></div>',
    ],
    ['- <b>x</b>\ny\n===', '<ul><li><b>x</b>\ny\n===</li></ul>'],
    [
      '<div <b c="d"/>\n<![CDATA[</pre>\n\n```\n<b>\n```',
      '<div><div innerHTML><div <b c="d"/>\n<![CDATA[</pre>\n</div><pre><code>&lt;b&gt;</code></pre></div>',
    ],
    [
      '<p><!--\n\n<a e="--><b e=">">\n<div>"onclick=alert(1)>',
      '<div><p></p><p><a></a>"&gt;</p><div>"onclick=alert(1)&gt;</div></div>',
    ],
    [
      '<textarea>```\n```\n</script>\n    [x](&#106avascript:alert(1))',
      '<div><span>&lt;textarea&gt;```\n```\n&lt;/script&gt;</span><pre><code>[x](&amp;#106avascript:alert(1))</code></pre></div>',
    ],
    [
      '<details>\n<summary>x</summary>\n\n```js\ncode\n```\n\n</details>',
      '<details><summary>x</summary><pre><code>code</code></pre></details>',
    ],
    [
      '<div>\n\n```\n``` \n\n</div>\n\n```\n<img src=x onerror=alert(1)>\n',
      '<div><div><pre><code>``` \n</code></pre></div><pre><code>&lt;img src=x onerror=alert(1)&gt;</code></pre></div>',
    ],
    [
      '<![CDATA[a]]]>\n\n```\n<img src=x onerror=alert(1)>\n```',
      '<pre><code>&lt;img src=x onerror=alert(1)&gt;</code></pre>',
    ],
    [
      '- <?p ?> <?q ?>[x](\njavascript:alert(1))',
      '<div><ul><li></li></ul><p>javascript:alert(1))</p></div>',
    ],
    [
      '- a <?p ?> <?q ?>[x](\njavascript:alert(1))',
      '<ul><li>a  <a>x</a></li></ul>',
    ],
    [
      '<div>\n\n```\n```\t\n\n</div>\n\n```\n<img src=x onerror=alert(1)>\n',
      '<div><div><pre><code></code></pre></div><pre><code>&lt;img src=x onerror=alert(1)&gt;</code></pre></div>',
    ],
    [
      '<div>\n\n```\n```~\n```\n\n</div>\n\n```\n<img src=x onerror=alert(1)>\n',
      '<div><div><pre><code>```~</code></pre></div><pre><code>&lt;img src=x onerror=alert(1)&gt;</code></pre></div>',
    ],
    [
      '<details>\n\n```\n```js\n```\n\n</details>',
      '<details><pre><code>```js</code></pre></details>',
    ],
    [
      '<script></textarea></script >\n\n```\n<img src=x onerror=alert(1)>\n```',
      '<div><span>&lt;script&gt;&lt;/textarea&gt;&lt;/script &gt;</span><pre><code>&lt;img src=x onerror=alert(1)&gt;</code></pre></div>',
    ],
    ['[^a](javascript:alert(1))', '<a>^a</a>'],
    [
      '[^a](javascript:alert(1))\n\n[^a]: y',
      '<div><p><a><sup>a</sup></a>(javascript:alert(1))</p><footer><div>a: y</div></footer></div>',
    ],
    [
      'y [^a<img src=x onerror=alert(1)>]\n\n[^a<img src=x onerror=alert(1)>]: a',
      '<div><p>y <a><sup>a&lt;img src=x onerror=alert(1)&gt;</sup></a></p><footer><div>a&lt;img src=x onerror=alert(1)&gt;: a</div></footer></div>',
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
      '<p><br></br>[^1]:&amp;#106avascript:alert(1)\n[^1]</p>',
    ],
    ['x&#60;~~~~javascript:alert(1)>', 'x&lt;~~~~javascript:alert(1)&gt;'],
    ["<C><?><a e='?>'> onclick/", "<span><C></C>'&gt; onclick/</span>"],
    ['<![CDATA[<?><a e="?>"\n<!--"onclick>]', ''],
    [
      '<?e><a e="?>">\n<style>"onclick=alert(1)>',
      '<span>&lt;style&gt;"onclick=alert(1)&gt;</span>',
    ],
    [
      '[x][^1]\n\n[^1]: &amp;#106;avascript:alert(1)',
      '<div><p>[x]<a><sup>1</sup></a></p><footer><div>1: &amp;#106;avascript:alert(1)</div></footer></div>',
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
      '<pre><code>&lt;svg onload=alert(1)&gt;</code></pre>',
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
      '<p><foreignObject></foreignObject>~~~~<code>x onmouseover="alert(1)" &lt;svg onload=alert(1)&gt;</code></p>',
    ],
    [
      '[^1]: <iframe srcdoc="x"></iframe>[r][^1]',
      '<span>[^1]: <span>&lt;iframe&gt;&lt;/iframe&gt;</span>[r][^1]</span>',
    ],
    [
      '<annotation-xml>[^1]: ](javascript:alert(1)',
      '<span><annotation-xml></annotation-xml>[^1]: ](javascript:alert(1)</span>',
    ],
    ['<pre>a', '<pre>a</pre>'],
    ['<div><pre>a', '<div innerHTML><pre>a</div>'],
    ['<div>\n\n', '<div></div>'],
    ["<div </div>'", "&lt;div &lt;/div&gt;'"],
    ['<?php echo 1 ?>', ''],
    ['<!DOCTYPE html>', ''],
    ['<!doctype html>', ''],
    ['<![CDATA[x]]>', ''],
    [
      '<![CDATA[<a title="</style><a title="</textarea><a href="javascript:alert(1)">l</a> x" onclick=alert(1)>',
      '<span>&lt;![CDATA[&lt;a title="<span>&lt;/style&gt;</span>&lt;a title="<span>&lt;/textarea&gt;</span><a>l</a> x" onclick=alert(1)&gt;</span>',
    ],
    ['a <?b?> c', '<span>a  c</span>'],
    ['a <!B c> d', '<span>a  d</span>'],
    ['x <!a b> y', '<span>x  y</span>'],
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
      '<p>&lt;a title="?&gt;</p>',
    ],
    [
      '1. </div x={a ><img src=x onerror=alert(1)>}>    innerHTML="x<img src=x onerror=alert(1)>"',
      '<span>1. &lt;/div x={a &gt;<img></img>}&gt;    innerHTML="x<img></img>"</span>',
    ],
    [
      '- </div x={a ><img src=x onerror=alert(1)>}>    <b onclick=alert(1)>b</b>',
      '<ul><li><div></div><pre><code>&lt;b onclick=alert(1)&gt;b&lt;/b&gt;</code></pre></li></ul>',
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
    [
      `> <div a=1${String.fromCharCode(0x20_28)}>  onclick=alert(1) b>y</div>`,
      '<blockquote><div>onclick=alert(1) b&gt;y</div></blockquote>',
    ],
    ['<pre>a &lt; b &amp; c</pre>', '<pre>a &lt; b &amp; c</pre>'],
    [
      `> <div </div${String.fromCharCode(0x20_28)}>\nonclick='alert(1)'`,
      "<div><blockquote><div></div></blockquote><p>onclick='alert(1)'</p></div>",
    ],
    [
      `> a <div </div${String.fromCharCode(0x20_28)}>\nonclick='alert(1)'`,
      `<blockquote><p>a &lt;div &lt;/div${String.fromCharCode(0x20_28)}&gt;\nonclick='alert(1)'</p></blockquote>`,
    ],
    [
      '/\n    <pre>\n```\n<img src=x onerror=alert(1)>\n```',
      '<div><p>/\n<pre></pre></p><pre><code>&lt;img src=x onerror=alert(1)&gt;</code></pre></div>',
    ],
    [
      '- <div/>`<img src=x onerror=alert(1)>`',
      '<ul><li><div></div><code>&lt;img src=x onerror=alert(1)&gt;</code></li></ul>',
    ],
    [
      '- z\n  <b/>\n  `<img src=x onerror=alert(1)>`',
      '<ul><li>z\n<b></b>\n<code>&lt;img src=x onerror=alert(1)&gt;</code></li></ul>',
    ],
    [
      '- <br>\n  `<img src=x onerror=alert(1)>`',
      '<ul><li><br></br><code>&lt;img src=x onerror=alert(1)&gt;</code></li></ul>',
    ],
    [
      '- a\n  - <div/>\n  `<img src=x onerror=alert(1)>`',
      '<ul><li>a<ul><li><div></div></li></ul><code>&lt;img src=x onerror=alert(1)&gt;</code></li></ul>',
    ],
    [
      '- a\n\n- z\n  <b/>\n  `<img src=x onerror=alert(1)>`',
      '<ul><li><p>a</p></li><li><p>z\n<b></b>\n<code>&lt;img src=x onerror=alert(1)&gt;</code></p></li></ul>',
    ],
    [
      '<b>`</b>x`<img src=x onerror=alert(1)>`',
      '<span><b>`</b>x<code>&lt;img src=x onerror=alert(1)&gt;</code></span>',
    ],
    [
      'z\n    <div>`<img src=x onerror=alert(1)>`',
      '<p>z\n<div></div><code>&lt;img src=x onerror=alert(1)&gt;</code></p>',
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
    ['`<script> https://a.b/c`', '<code>&lt;script&gt; https://a.b/c</code>'],
    [
      `> <div </div ${String.fromCharCode(0x20_28)}>\nonclick='alert(1)'`,
      "<div><blockquote><div></div></blockquote><p>onclick='alert(1)'</p></div>",
    ],
    [
      '<pre/>\n\n```\n<img src=x onerror=alert(1)>\n```',
      '<div><pre>\n</pre><pre><code>&lt;img src=x onerror=alert(1)&gt;</code></pre></div>',
    ],
    [
      '<pre/>y\n\n```\n<img src=x onerror=alert(1)>\n```',
      '<div><pre>y\n</pre><pre><code>&lt;img src=x onerror=alert(1)&gt;</code></pre></div>',
    ],
    [
      '<![CDATA[\n<![CDATA[]]]>\n\n```\n<img src=x onerror=alert(1)>\n```',
      '<pre><code>&lt;img src=x onerror=alert(1)&gt;</code></pre>',
    ],
  ])('renders %j as %j with no handler prop', (input, expected) => {
    const result = compiler(input)
    expect(serialize(result)).toBe(expected)
    expect(handlerProps(result)).toEqual([])
  })

  it.each([
    [
      '<br>\n\n```\n<img src=x onerror=alert(1)>\n```',
      '<div><pre></pre><pre><code>&lt;img src=x onerror=alert(1)&gt;</code></pre></div>',
      'br',
      'pre',
    ],
    [
      '<div>\nx\n\n```\n<img src=x onerror=alert(1)>\n```',
      '<div><pre>x</pre><pre><code>&lt;img src=x onerror=alert(1)&gt;</code></pre></div>',
      'div',
      'pre',
    ],
    [
      '<b/>\n\n```\n<img src=x onerror=alert(1)>\n```',
      '<div><script></script><pre><code>&lt;img src=x onerror=alert(1)&gt;</code></pre></div>',
      'b',
      'script',
    ],
    [
      '<span>y</span>`<img src=x onerror=alert(1)>`',
      '<span><div>y</div><code>&lt;img src=x onerror=alert(1)&gt;</code></span>',
      'span',
      'div',
    ],
    [
      '<pre/>`<img src=x onerror=alert(1)>`',
      '<script innerHTML>`<img src=x>`</script>',
      'pre',
      'script',
    ],
    [
      '<div>\n<a title="></textarea>\nplain "text"\n<div>"onclick=alert(1)>',
      '<pre>&lt;a title="&gt;\nplain "text" <pre></pre>"onclick=alert(1)&gt;</pre>',
      'div',
      'pre',
    ],
    [
      '<pre>\n<a title=">\n\nplain "text"\n\n<div>"onclick=alert(1)>\n</pre>',
      '<div innerHTML><a title=">\n\nplain "text"\n\n<div>"onclick=alert(1)></div>',
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
    ).toBe(`<div>&lt;a title="&lt;b ${long}"&gt;y</div>`)
  })

  it.each([
    ['<Img onclick={alert(1)} />', undefined, '<Img></Img>', []],
    ['<Img attr:onerror={alert(1)} />', undefined, '<Img></Img>', []],
    ['<Btn on:click={alert(1)}>x</Btn>', undefined, '<Btn>x</Btn>', []],
    ['<Btn onclick={[1]}>x</Btn>', undefined, '<Btn>x</Btn>', []],
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
      [],
    ],
    [
      '<my-widget onclick={() => 1}>x</my-widget>',
      { evalUnserializableExpressions: true },
      '<my-widget>x</my-widget>',
      [],
    ],
    [
      '<Img onclick={() => 1} />',
      {
        evalUnserializableExpressions: true,
        overrides: { IMG: { props: {} } },
      },
      '<Img></Img>',
      ['onclick=function'],
    ],
  ])('with its options keeps %j and %j as %j with props %j', (input, options, expected, handlers) => {
    const result = compiler(input, options)
    expect(serialize(result)).toBe(expected)
    expect(handlerProps(result)).toEqual(handlers)
  })
})

describe('a capitalized tag an override matches is a component, and every other tag is HTML', () => {
  const ATTR_NAMES = ['class', 'data', 'href', 'onClick', 'onclick', 'title']
  const attrProps = (el: unknown) =>
    treeProps(el).filter(([name]) => ATTR_NAMES.includes(name))

  it.each(
    ['Card', 'CARD', 'CaRd'].flatMap(tag =>
      ['Card', 'card', 'CARD'].map(key => [tag, key])
    )
  )('renders <%s> with the component a %j key names', (tag, key) => {
    const result = compiler(`a <${tag} data={[1]}>x</${tag}>`, {
      overrides: { [key]: { component: 'aside' } },
    })
    expect(serialize(result)).toBe('<span>a <aside>x</aside></span>')
    expect(attrProps(result)).toEqual([['data', [1]]])
  })

  it('renders <card> as HTML against a `Card` key', () => {
    const result = compiler('a <card data={[1]}>x</card>', {
      overrides: { Card: { component: 'aside' } },
    })
    expect(serialize(result)).toBe('<span>a <card>x</card></span>')
    expect(attrProps(result)).toEqual([['data', '{[1]}']])
  })

  it.each([
    ['<Card data={[1]} title="t" onClick={go}>x</Card>', '<Card>x</Card>'],
    [
      '<div>\n<Card data={[1]} title="t" onClick={go}>x</Card>\n</div>',
      '<div><Card>x</Card></div>',
    ],
    [
      'a <Card data={[1]} title="t" onClick={go}>x</Card> b',
      '<span>a <Card>x</Card> b</span>',
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
    expect(serialize(result)).toBe('<span>x <a>y</a></span>')
    expect(attrProps(result)).toEqual([
      ['href', '/'],
      ['class', 'x'],
    ])
  })

  const MyLink = (props: Record<string, unknown>) =>
    ({ t: 'a', p: props }) as unknown as JSX.Element
  const widget = { 'my-widget': { props: {} } }
  const link = '<span>x <a>y</a></span>'

  it.each([
    ['x <a href="/" onclick="alert(1)">y</a>', { a: MyLink }, link],
    ['x <a href="/" onclick={alert(1)}>y</a>', { a: MyLink }, link],
    ['x <a href="/" onclick>y</a>', { a: MyLink }, link],
    [
      'x <a href="/" onclick="alert(1)">y</a>',
      { a: { props: { class: 'x' } } },
      link,
    ],
    [
      'x <a href="/" onclick={alert(1)}>y</a>',
      { a: { component: 'span' } },
      '<span>x <span>y</span></span>',
    ],
    ['x <a href="/" onclick={alert(1)}>y</a>', { a: 'span' }, link],
    [
      '<my-widget onclick={alert(1)}>x</my-widget>',
      widget,
      '<my-widget>x</my-widget>',
    ],
    [
      '<my-widget onclick="alert(1)">x</my-widget>',
      widget,
      '<my-widget>x</my-widget>',
    ],
    [
      'a <my-widget onclick={alert(1)}>x</my-widget>',
      widget,
      '<span>a <my-widget>x</my-widget></span>',
    ],
    [
      'a <my-widget onclick="alert(1)">x</my-widget>',
      widget,
      '<span>a <my-widget>x</my-widget></span>',
    ],
    [
      '<div>\n<my-widget onclick={alert(1)}>x</my-widget>\n</div>',
      widget,
      '<div><my-widget>x</my-widget></div>',
    ],
    [
      '<div>\n<my-widget onclick="alert(1)">x</my-widget>\n</div>',
      widget,
      '<div><my-widget>x</my-widget></div>',
    ],
    ['x <a href="/" onclick={alert(1)}>y</a>', undefined, link],
  ])('renders %j with %j as %j, passing no handler on', (input, overrides, expected) => {
    const result = compiler(input, { overrides })
    expect(serialize(result)).toBe(expected)
    expect(handlerProps(result)).toEqual([])
  })

  it('keeps the handler of a capitalized tag an override makes a component as a prop', () => {
    const result = compiler('<Btn onClick={go}>x</Btn>', {
      overrides: { Btn: MyLink },
    })
    expect(handlerProps(result)).toEqual(['onClick=string'])
  })

  it.each([
    ['an element name', { Btn: 'a' }],
    ['an element component', { Btn: { component: 'a' } }],
    ['props alone', { Btn: { props: {} } }],
  ])('drops the handler of a capitalized tag an override renders as %s, since Solid writes it onto the element', (_, overrides) => {
    const result = compiler('<Btn onclick={alert(1)}>x</Btn>', { overrides })
    expect(handlerProps(result)).toEqual([])
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
    expect(serialize(result)).toBe('<span>x <a>y</a> <a>z</a></span>')
    expect(handlerProps(result)).toEqual([])
  })

  it.each([
    ['an override component', { a: MyLink }],
    ['no override', undefined],
  ])('passes no handler string in a hand-built AST on, with %s', (_, overrides) => {
    const result = astToJSX(
      [
        {
          attrs: { href: '/', onclick: 'alert(1)' },
          tag: 'a',
          type: RuleType.htmlSelfClosing,
        },
      ],
      { overrides }
    )
    expect(serialize(result)).toBe('<a></a>')
    expect(handlerProps(result)).toEqual([])
  })

  it('passes a capitalized tag its handler string only when an override makes it a component', () => {
    const ast: MarkdownToJSX.ASTNode[] = [
      { attrs: { onClick: 'go' }, tag: 'Btn', type: RuleType.htmlSelfClosing },
    ]
    expect(handlerProps(astToJSX(ast))).toEqual([])
    expect(
      handlerProps(astToJSX(ast, { overrides: { Btn: { props: {} } } }))
    ).toEqual([])
    expect(handlerProps(astToJSX(ast, { overrides: { Btn: MyLink } }))).toEqual(
      ['onClick=string']
    )
  })

  it('passes the attributes of a hand-built code block on without its handler', () => {
    const ast = parser('```js\nx\n```')
    Object.assign(ast[0], { attrs: { 'data-x': 'y', onclick: 'alert(1)' } })
    const result = astToJSX(ast)
    expect(serialize(result)).toBe('<pre><code>x</code></pre>')
    expect(treeProps(result)).toEqual([
      ['data-x', 'y'],
      ['class', 'language-js lang-js'],
    ])
  })

  it.each([
    [
      '<my-widget onclick={alert(1)}>x</my-widget>',
      undefined,
      '<my-widget>x</my-widget>',
      [],
    ],
    [
      '<my-widget onclick={alert(1)}>x</my-widget>',
      widget,
      '<my-widget>x</my-widget>',
      [],
    ],
    [
      '<div><img src=x onerror="alert(1)"></div>',
      undefined,
      '<div><img></img></div>',
      ['src=x'],
    ],
  ])('renders %j with %j, stored without its private fields, as %j with %j', (input, overrides, expected, props) => {
    const result = astToJSX(storedAST(input, overrides), { overrides })
    expect(serialize(result)).toBe(expected)
    expect(
      treeProps(result).map(([name, value]) => `${name}=${String(value)}`)
    ).toEqual(props)
  })
})

describe('emphasis that follows emphasis', () => {
  it('renders as two elements', () => {
    expect(serialize(compiler('_a_*b*'))).toBe(
      '<span><em>a</em><em>b</em></span>'
    )
  })

  it('renders as three elements across a chain of alternating delimiters', () => {
    expect(serialize(compiler('*a*_b_*c*'))).toBe(
      '<span><em>a</em><em>b</em><em>c</em></span>'
    )
  })
})

describe('emphasis nested past the inline depth limit', () => {
  it('leaves the delimiters outside the 199th level as literal text', () => {
    expect(serialize(compiler(`${'*'.repeat(6000)}a${'*'.repeat(6000)}`))).toBe(
      `<span>${'*'.repeat(5602)}${'<strong>'.repeat(199)}a${'</strong>'.repeat(199)}${'*'.repeat(5602)}</span>`
    )
  })
})

describe('a www. bare URL needs a dot inside its own span', () => {
  const hrefs = (input: string) =>
    treeProps(compiler(input))
      .filter(([name]) => name === 'href')
      .map(([, value]) => value)

  it('ignores a dot in the text after the URL, compiling text with no element in it to a bare string with no wrapper', () => {
    const result = compiler('www.foo bar.com')
    expect(serialize(result)).toBe('www.foo bar.com')
    expect(hrefs('www.foo bar.com')).toEqual([])
  })

  it('links a URL whose own span holds a dot', () => {
    const result = compiler('www.foo.com bar')
    expect(serialize(result)).toBe('<span><a>www.foo.com</a> bar</span>')
    expect(hrefs('www.foo.com bar')).toEqual(['http://www.foo.com'])
  })

  it('counts a trailing dot that ends the sentence', () => {
    const result = compiler('www.foo. bar')
    expect(serialize(result)).toBe('<span><a>www.foo</a>. bar</span>')
    expect(hrefs('www.foo. bar')).toEqual(['http://www.foo'])
  })
})

describe('bare URLs in a run without spaces', () => {
  const hrefs = (input: string) =>
    treeProps(compiler(input))
      .filter(([name]) => name === 'href')
      .map(([, value]) => value)

  it('links a later www. address whose own paren balance trims differently', () => {
    expect(serialize(compiler('www.(www.ab_.))'))).toBe(
      '<span>www.(<a>www.ab</a>_.))</span>'
    )
    expect(hrefs('www.(www.ab_.))')).toEqual(['http://www.ab'])
  })

  it('links the earliest candidate whose trailing parens leave a clean domain', () => {
    expect(serialize(compiler('www._)www._(www.c).).'))).toBe(
      '<span>www.<em>)www.</em>(<a>www.c</a>).).</span>'
    )
    expect(hrefs('www._)www._(www.c).).')).toEqual(['http://www.c'])
  })

  it('links the whole run once its last two segments are clean', () => {
    expect(serialize(compiler('www._)www._(www.c.d).).'))).toBe(
      '<span><a>www._)www._(www.c.d</a>).).</span>'
    )
    expect(hrefs('www._)www._(www.c.d).).')).toEqual([
      'http://www._)www._(www.c.d',
    ])
  })

  it('links a scheme URL after a rejected one', () => {
    expect(serialize(compiler('http://a_b.c_dhttp://x.y'))).toBe(
      '<span>http://a_b.c_d<a>http://x.y</a></span>'
    )
    expect(hrefs('http://a_b.c_dhttp://x.y')).toEqual(['http://x.y'])
  })

  it('links a www. address past a slash that ended a rejected domain', () => {
    expect(serialize(compiler('www.a_/www.b.c'))).toBe(
      '<span>www.a_/<a>www.b.c</a></span>'
    )
    expect(hrefs('www.a_/www.b.c')).toEqual(['http://www.b.c'])
  })

  it('links a later candidate past a slash that reuses the rejected domain verdict', () => {
    expect(serialize(compiler('www.x_www.y/a.b'))).toBe(
      '<span>www.x_<a>www.y/a.b</a></span>'
    )
    expect(hrefs('www.x_www.y/a.b')).toEqual(['http://www.y/a.b'])
  })

  it('keeps a ] inside the domain and trims the unmatched trailing ) and ]', () => {
    expect(serialize(compiler('www._]www.a.b)].'))).toBe(
      '<span><a>www._]www.a.b</a>)].</span>'
    )
    expect(hrefs('www._]www.a.b)].')).toEqual(['http://www._%5Dwww.a.b'])
  })

  it('keeps a trailing ] its [ opened while trimming the unmatched one', () => {
    expect(serialize(compiler('www._[www.a.b)]].'))).toBe(
      '<span><a>www._[www.a.b)]</a>].</span>'
    )
    expect(hrefs('www._[www.a.b)]].')).toEqual(['http://www._%5Bwww.a.b)%5D'])
  })

  it('links a later www. address past a [ that the first candidate never closes', () => {
    expect(serialize(compiler('www.[www.a.b_]'))).toBe(
      '<span>www.[<a>www.a.b</a>_]</span>'
    )
    expect(hrefs('www.[www.a.b_]')).toEqual(['http://www.a.b'])
  })

  it('keeps a trailing ] a later candidate shares with a [ inside its own run', () => {
    expect(serialize(compiler('www._[www.a.b])'))).toBe(
      '<span><a>www._[www.a.b]</a>)</span>'
    )
    expect(hrefs('www._[www.a.b])')).toEqual(['http://www._%5Bwww.a.b%5D'])
  })

  it('stays text, as a lone text node with no wrapper element, when a ] before a later candidate leaves it no clean domain', () => {
    expect(serialize(compiler('www.]www.a.b_[]'))).toBe('www.]www.a.b_[]')
    expect(hrefs('www.]www.a.b_[]')).toEqual([])
  })

  it('stays text when a nested [ pair closes after an underscore in the last segment', () => {
    expect(serialize(compiler('www.[[a.b]_]'))).toBe('www.[[a.b]_]')
    expect(hrefs('www.[[a.b]_]')).toEqual([])
  })

  it('ends the link at the last closer when a kept ) and a kept ] both remain', () => {
    expect(serialize(compiler('www.[.()]'))).toBe('<a>www.[.()]</a>')
    expect(hrefs('www.[.()]')).toEqual(['http://www.%5B.()%5D'])
  })

  it('stays text when a scheme URL has an empty domain', () => {
    expect(serialize(compiler('http://.'))).toBe('http://.')
    expect(hrefs('http://.')).toEqual([])
  })

  it('stays text when a www. address trims away to nothing', () => {
    expect(serialize(compiler('www._www..'))).toBe('www._www..')
    expect(hrefs('www._www..')).toEqual([])
  })
})

describe('a bare URL inside [ ] text ends at the ] that closes it', () => {
  it.each([
    [
      '[GitHub repo][https://github.com/litejs/natural-compare-lite]',
      '<p>[GitHub repo][<a>https://github.com/litejs/natural-compare-lite</a>]</p>',
    ],
    [
      '[see https://example.com/a]',
      '<p>[see <a>https://example.com/a</a>]</p>',
    ],
    ['[see www.example.com/a]', '<p>[see <a>www.example.com/a</a>]</p>'],
    [
      '[see **https://example.com/a**]',
      '<p>[see <strong><a>https://example.com/a</a></strong>]</p>',
    ],
    [
      '[see https://example.com/?a[0]=1]',
      '<p>[see <a>https://example.com/?a[0]=1</a>]</p>',
    ],
    ['see https://example.com/a]', '<p>see <a>https://example.com/a</a>]</p>'],
    ['[a] https://example.com/a]', '<p>[a] <a>https://example.com/a</a>]</p>'],
    [
      '\\[see https://example.com/a]',
      '<p>[see <a>https://example.com/a</a>]</p>',
    ],
    [
      '[see ~~https://example.com/a]~~',
      '<p>[see <del><a>https://example.com/a</a>]</del></p>',
    ],
    [
      '[see ==https://example.com/a]==',
      '<p>[see <mark><a>https://example.com/a</a>]</mark></p>',
    ],
    [
      '==https://example.com/a==',
      '<p><mark><a>https://example.com/a</a></mark></p>',
    ],
    [
      '==https://x.y/?t=YQ== b',
      '<p><mark><a>https://x.y/?t=YQ</a></mark> b</p>',
    ],
    ['https://x.y/?t=YQ== b', '<p><a>https://x.y/?t=YQ==</a> b</p>'],
    [
      '~~a https://x.y/?t=YQ== b~~',
      '<p><del>a <a>https://x.y/?t=YQ==</a> b</del></p>',
    ],
    [
      "~~https://example.com/a~~'",
      "<p><del><a>https://example.com/a</a></del>'</p>",
    ],
    [
      '[see <span>https://example.com/a]</span>',
      '<p>[see <span><a>https://example.com/a</a>]</span></p>',
    ],
    [
      '[see https://example.com/a\\]]',
      '<p>[see <a>https://example.com/a</a>]]</p>',
    ],
    [
      '![see https://example.com/a]',
      '<p>![see <a>https://example.com/a</a>]</p>',
    ],
    [
      '[^see https://example.com/a]',
      '<p>[^see <a>https://example.com/a</a>]</p>',
    ],
    [
      '[see `]` https://example.com/a]',
      '<p>[see <code>]</code> <a>https://example.com/a</a>]</p>',
    ],
    [
      '[[see https://example.com/a]]',
      '<p>[[see <a>https://example.com/a</a>]]</p>',
    ],
    [
      '[see https://example.com/a.]',
      '<p>[see <a>https://example.com/a</a>.]</p>',
    ],
    [
      '[see https://example.com/?a[0=1]',
      '<p>[see <a>https://example.com/?a[0=1]</a></p>',
    ],
  ])('renders %j as %j', (input, expected) => {
    expect(serialize(compiler(input, { forceBlock: true }))).toBe(expected)
  })

  it('ends it there with optimizeForStreaming too', () => {
    const input = '[see https://example.com/a] after'
    const expected = '<p>[see <a>https://example.com/a</a>] after</p>'
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
  ])('links %j to %j, reading the href from the element tree because serialize drops props', (input, expected) => {
    expect(firstHref(compiler(input, { forceBlock: true }))).toBe(expected)
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
      ['data-a', false],
      ['data-b', noop],
      ['data-c', { x: 1 }],
      ['data-d', 'k'],
      ['style', {}],
    ])
    expect(serialize(result)).toBe('<h1>hi</h1>')
  })
})

describe('a setext underline after a lazy line in a block quote', () => {
  it.each<[string, string, [string, unknown][]]>([
    ['> a\nb\n> ---', '<blockquote><h2>a\nb</h2></blockquote>', [['id', 'ab']]],
    [
      '> a\nb\n>\n> c\n> ===',
      '<blockquote><p>a\nb</p><h1>c</h1></blockquote>',
      [['id', 'c']],
    ],
    ['> a\nb\n===', '<blockquote><p>a\nb\n===</p></blockquote>', []],
  ])('renders %j as %j with props %j', (input, expected, props) => {
    const tree = compiler(input)
    expect(serialize(tree)).toBe(expected)
    expect(treeProps(tree)).toEqual(props)
  })
})

describe('code span edge spaces', () => {
  it.each([
    ['` a `', '<code>a</code>'],
    ['` \t `', '<code>\t</code>'],
    ['`   `', '<code> </code>'],
  ])('renders %j as %j', (input, expected) => {
    expect(serialize(compiler(input))).toBe(expected)
  })
})

describe('code spans at the streaming edge', () => {
  it.each([
    ['x `` a ` b `` y', '<span>x <code>a ` b</code> y</span>'],
    ['x \\` y', 'x ` y'],
  ])('renders %j as %j with optimizeForStreaming, as without it', (input, expected) => {
    expect(serialize(compiler(input, { optimizeForStreaming: true }))).toBe(
      expected
    )
    expect(serialize(compiler(input))).toBe(expected)
  })
})

describe('a bare email address with an underscore', () => {
  it.each<[string, string, [string, unknown][]]>([
    ['foo@a_b.c', '<a>foo@a_b.c</a>', [['href', 'mailto:foo@a_b.c']]],
    ['foo@a.b_c.d', '<a>foo@a.b_c.d</a>', [['href', 'mailto:foo@a.b_c.d']]],
    ['a.b-c_d@a.b_', 'a.b-c_d@a.b_', []],
  ])('renders %j as %j with props %j', (input, expected, props) => {
    const tree = compiler(input)
    expect(serialize(tree)).toBe(expected)
    expect(treeProps(tree)).toEqual(props)
  })
})

describe('a heading whose slug is only whitespace', () => {
  it('writes no id', () => {
    const tree = compiler('# Hi', { slugify: () => ' ' })
    expect(serialize(tree)).toBe('<h1>Hi</h1>')
    expect(treeProps(tree)).toEqual([['id', undefined]])
  })
})

describe('entity text in image alt and link title', () => {
  it('shows the literal text &copy; in an image alt', () => {
    expect(treeProps(compiler('![&amp;copy;](x)'))).toEqual([
      ['alt', '&copy;'],
      ['title', undefined],
      ['src', 'x'],
    ])
  })

  it('shows the literal text &copy; in a link title', () => {
    expect(treeProps(compiler('[a](x "&amp;copy;")'))).toEqual([
      ['href', 'x'],
      ['title', '&copy;'],
    ])
  })
})

describe('frontmatter above a reference definition', () => {
  const input = '---\ntitle: x\n---\n\n# H\n\n[a]\n\n[a]: /u'

  it('drops the frontmatter and links the reference', () => {
    const tree = compiler(input)
    expect(serialize(tree)).toBe('<div><h1>H</h1><p><a>a</a></p></div>')
    expect(treeProps(tree)).toEqual([
      ['id', 'h'],
      ['href', '/u'],
    ])
  })

  it('keeps the frontmatter with preserveFrontmatter and links the reference', () => {
    const tree = compiler(input, { preserveFrontmatter: true })
    expect(serialize(tree)).toBe(
      '<div><pre>---\ntitle: x\n---</pre><h1>H</h1><p><a>a</a></p></div>'
    )
    expect(treeProps(tree)).toEqual([
      ['id', 'h'],
      ['href', '/u'],
    ])
  })

  it('keeps a document that is only frontmatter, closed at the end of input, as frontmatter', () => {
    expect(
      serialize(
        compiler('---\ntitle: Draft\n---', { preserveFrontmatter: true })
      )
    ).toBe('<pre>---\ntitle: Draft\n---</pre>')
  })
})
