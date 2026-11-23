import { describe, expect, it } from 'bun:test'

import { $ } from './constants.ts'
import { astToHTML, compiler, RuleType } from './html.ts'
import { parser } from './parse.ts'
import { quotesDeep, storedAST } from './test-tree.ts'
import type { MarkdownToJSX } from './types.ts'

describe('html compiler', () => {
  it('breaks: true renders every soft line break as a hard break, outside raw inline HTML', () => {
    expect(
      compiler('a\nb\n\n> c\n> d\n\n- e\n  f\n\ng <span>h\ni</span>', {
        breaks: true,
      })
    ).toBe(
      '<div><p>a<br />\nb</p><blockquote><p>c<br />\nd</p></blockquote><ul><li>e<br />\nf</li></ul><p>g <span>h\ni</span></p></div>'
    )
  })

  it('strikes through only tilde runs of exactly two', () => {
    expect(compiler('a ~~~c~~~ b ~~~~ ~~d~~~e~~')).toMatchInlineSnapshot(
      `"<p>a ~~~c~~~ b ~~~~ <del>d~~~e</del></p>"`
    )
  })

  it('keeps a task marker as text unless whitespace and content follow it', () => {
    expect(compiler('- [x]foo\n- [ ] \n- [x] baz')).toMatchInlineSnapshot(
      `"<ul><li>[x]foo</li><li>[ ]</li><li><input checked="" disabled="" type="checkbox"> baz</li></ul>"`
    )
  })

  it('keeps a content tab inside a quote or list item, and drops a code span continuation line indent', () => {
    expect(compiler('> ```\n> a\tb\n> ```\n\n- `a\tb`\n\n``a\n b``')).toBe(
      '<div><blockquote><pre><code>a\tb</code></pre></blockquote><ul><li><code>a\tb</code></li></ul><p><code>a b</code></p></div>'
    )
  })

  it('reads a tab in a quote or list item as whitespace around a link title, a closing heading sequence, and a soft break, and as content in indented code', () => {
    expect(
      compiler('> [a](/u\t"t")\n\n- # x #\t\n\n> a\t\n> b\n\n>     -\tfoo')
    ).toBe(
      '<div><blockquote><p><a href="/u" title="t">a</a></p></blockquote><ul><li><h1 id="x">x</h1></li></ul><blockquote><p>a\nb</p></blockquote><blockquote><pre><code>-\tfoo</code></pre></blockquote></div>'
    )
  })

  it('keeps the rest of a task marker line as text, never a block', () => {
    expect(compiler('- [x] # heading\n- [x] > quote')).toMatchInlineSnapshot(
      `"<ul><li><input checked="" disabled="" type="checkbox"> # heading</li><li><input checked="" disabled="" type="checkbox"> &gt; quote</li></ul>"`
    )
  })

  it.each([
    ['==``==b==`', '<p>==``<mark>b</mark>`</p>'],
    ['~~``~~b~~`', '<p>~~``<del>b</del>`</p>'],
    ['[a ``b](/u) `c', '<p><a href="/u">a ``b</a> `c</p>'],
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
    expect(compiler(input)).toBe(expected)
  })

  describe('footnotes', () => {
    it('should handle conversion of references into links', () => {
      const result = compiler(
        `foo[^abc] bar

[^abc]: Baz baz`
      )

      expect(result).toContain('<footer>')
      expect(result).toContain('<div id="abc">abc: Baz baz</div>')
      expect(result).toContain('foo<a href="#abc"><sup>abc</sup></a> bar')
    })

    it('should handle complex references', () => {
      const result = compiler(
        `foo[^referencé heré 123] bar

[^referencé heré 123]: Baz baz`
      )

      expect(result).toContain('<footer>')
      expect(result).toContain(
        '<div id="reference-here-123">referencé heré 123: Baz baz</div>'
      )
      expect(result).toContain(
        'foo<a href="#reference-here-123"><sup>referencé heré 123</sup></a> bar'
      )
    })

    it('should handle conversion of multiple references into links', () => {
      const result = compiler(
        `foo[^abc] bar. baz[^def]

[^abc]: Baz baz
[^def]: Def`
      )

      expect(result).toContain('<footer>')
      expect(result).toContain('<div id="abc">abc: Baz baz</div>')
      expect(result).toContain('<div id="def">def: Def</div>')
      expect(result).toContain('foo<a href="#abc"><sup>abc</sup></a> bar')
      expect(result).toContain('baz<a href="#def"><sup>def</sup></a>')
    })

    it('should inject the definitions in a footer at the end of the root', () => {
      const result = compiler(
        `foo[^abc] bar

[^abc]: Baz baz`
      )

      const footerIndex = result.indexOf('<footer>')
      const contentIndex = result.indexOf('foo<a href="#abc"')

      expect(footerIndex).toBeGreaterThan(contentIndex)
      expect(result).toContain('<footer>')
      expect(result).toContain('</footer>')
    })

    it('should handle single word footnote definitions', () => {
      const result = compiler(
        `foo[^abc] bar

[^abc]: Baz`
      )

      expect(result).toContain('<footer>')
      expect(result).toContain('<div id="abc">abc: Baz</div>')
    })

    it('keeps footnote syntax with no matching definition as text', () => {
      const result = compiler('foo[^abc] bar')
      expect(result).toBe('<p>foo[^abc] bar</p>')
    })

    it('should handle multiline footnotes', () => {
      const result = compiler(
        `foo[^abc] bar

[^abc]: Baz
    line2
    line3`
      )

      expect(result).toContain('<footer>')
      expect(result).toContain('<div id="abc">abc: Baz')
      expect(result).toContain('line2')
      expect(result).toContain('line3')
    })

    it('should handle mixed multiline and singleline footnotes', () => {
      const result = compiler(
        `a[^a] b[^b] c[^c]

[^a]: single
[^b]: bbbb
    bbbb
[^c]: single-c`
      )

      expect(result).toContain('<footer>')
      expect(result).toContain('<div id="a">a: single</div>')
      expect(result).toContain('<div id="b">b: bbbb')
      expect(result).toContain('bbbb')
      expect(result).toContain('<div id="c">c: single-c</div>')
    })

    it('should handle indented multiline footnote', () => {
      const result = compiler(
        `Here's a simple footnote,[^1] and here's a longer one.[^bignote]

[^1]: This is the first footnote.

[^bignote]: Here's one with multiple paragraphs and code.

    Indent paragraphs to include them in the footnote.

    \`{ my code }\`

    Add as many paragraphs as you like.`
      )

      expect(result).toContain('<footer>')
      expect(result).toContain(
        '<div id="1">1: This is the first footnote.</div>'
      )
      expect(result).toContain(
        '<div id="bignote">bignote: Here\'s one with multiple paragraphs and code.'
      )
      expect(result).toContain(
        'Indent paragraphs to include them in the footnote.'
      )
    })

    it('should keep caret prefix intact in identifier for renderer', () => {
      const ast = parser(
        `foo[^abc] bar

[^abc]: Baz baz`
      )

      const result = astToHTML(ast, {})

      expect(result).toContain('<div id="abc">abc: Baz baz</div>')
      expect(result).toContain('foo<a href="#abc"><sup>abc</sup></a> bar')
    })

    it('should handle footnotes with formatted content', () => {
      const result = compiler(
        `foo[^abc] bar

[^abc]: This is **bold** and *italic*`
      )

      expect(result).toContain('<footer>')
      expect(result).toContain(
        '<div id="abc">abc: This is <strong>bold</strong> and <em>italic</em></div>'
      )
    })

    it('should handle footnotes with links', () => {
      const result = compiler(
        `foo[^abc] bar

[^abc]: See [link](https://example.com) for more`
      )

      expect(result).toContain('<footer>')
      expect(result).toContain(
        '<div id="abc">abc: See <a href="https://example.com">link</a> for more</div>'
      )
    })

    it('should handle footnotes with code', () => {
      const result = compiler(
        `foo[^abc] bar

[^abc]: Use \`code\` in footnotes`
      )

      expect(result).toContain('<footer>')
      expect(result).toContain(
        '<div id="abc">abc: Use <code>code</code> in footnotes</div>'
      )
    })

    it('should escape script tags in footnote content under the default-on tagfilter and render the footer exactly once', () => {
      const result = compiler(
        `foo[^abc] bar

[^abc]: Content with <script>alert('xss')</script>`,
        { tagfilter: true }
      )

      const footerMatches = result.match(/<footer>.*?<\/footer>/g)
      expect(footerMatches).toBeTruthy()
      expect(footerMatches?.length).toBe(1)

      expect(result).toContain('Content with')

      expect(result).toContain('&lt;script')
      expect(result).not.toContain('<script>')
      expect(result).not.toMatch(/<\/script>/)
    })

    it('should handle empty footnote content', () => {
      const result = compiler(
        `foo[^abc] bar

[^abc]:`
      )

      expect(result).toContain('<footer>')
      expect(result).toContain('<div id="abc">abc: </div>')
    })
  })

  describe('basic HTML output', () => {
    it('should render paragraphs', () => {
      const result = compiler('Hello world')
      expect(result).toBe('<p>Hello world</p>')
    })

    it('should render headings', () => {
      const result = compiler('# Heading 1')
      expect(result).toContain('<h1 id="heading-1">Heading 1</h1>')
    })

    it('should render links', () => {
      const result = compiler('[text](https://example.com)')
      expect(result).toContain('<a href="https://example.com">text</a>')
    })

    it('ends link text at a bracket inside a raw HTML element, and hides only a bracket inside the tag itself', () => {
      expect(compiler('[see <b>this]</b> note](/docs)')).toBe(
        '<p>[see <b>this]</b> note](/docs)</p>'
      )
      expect(compiler('[a <b title="]">x</b>](/u)')).toBe(
        '<p><a href="/u">a <b title="]">x</b></a></p>'
      )
    })

    it.each([
      ['`a| b |\n|---|', '<p>`a| b |\n|---|</p>'],
      ['`|]\n-', '<h2>`|]</h2>'],
      ['-\n  _\n\n  )', '<ul><li><p>_</p><p>)</p></li></ul>'],
      ['-\n\n  -', '<ul><li></li><li></li></ul>'],
      [
        '>a\n-',
        '<div><blockquote><p>a</p></blockquote><ul><li></li></ul></div>',
      ],
    ])('renders the table and list edge case %j as %j', (input, expected) => {
      expect(compiler(input)).toBe(expected)
    })
  })

  describe('options.wrapper', () => {
    it('is ignored when there is a single child', () => {
      const result = compiler('Hello, world!', { wrapper: 'article' })
      expect(result).toBe('<p>Hello, world!</p>')
    })

    it('overrides the wrapper element when there are multiple children', () => {
      const result = compiler('Hello\n\nworld!', { wrapper: 'article' })
      expect(result).toBe('<article><p>Hello</p><p>world!</p></article>')
    })

    it('defaults to div wrapper for multiple block children', () => {
      const result = compiler('# Heading\n\nParagraph')
      expect(result).toBe(
        '<div><h1 id="heading">Heading</h1><p>Paragraph</p></div>'
      )
    })

    it('defaults to span wrapper for inline content', () => {
      const result = compiler('Hello world', { forceInline: true })
      expect(result).toBe('<span>Hello world</span>')
    })

    it('returns unwrapped content when wrapper is null', () => {
      const result = compiler('Hello\n\nworld!', { wrapper: null })
      expect(result).toBe('<p>Hello</p><p>world!</p>')
    })

    it('still renders footnotes when wrapper is null', () => {
      const result = compiler(
        `foo[^abc] bar

[^abc]: Baz`,
        { wrapper: null }
      )
      expect(result).toContain('<p>foo<a href="#abc"')
      expect(result).toContain('<footer>')
      expect(result).toContain('<div id="abc">abc: Baz</div>')
    })

    it('works with custom wrapper element', () => {
      const result = compiler('Hello\n\nworld!', { wrapper: 'section' })
      expect(result).toBe('<section><p>Hello</p><p>world!</p></section>')
    })
  })

  describe('options.forceWrapper', () => {
    it('ensures wrapper element is present even with a single child', () => {
      const result = compiler('Hi Evan', {
        wrapper: 'aside',
        forceWrapper: true,
      })
      expect(result).toBe('<aside>Hi Evan</aside>')
    })

    it('works with default div wrapper', () => {
      const result = compiler('Single paragraph', { forceWrapper: true })
      expect(result).toBe('<div><p>Single paragraph</p></div>')
    })

    it('works with custom wrapper and props', () => {
      const result = compiler('Content', {
        wrapper: 'article',
        wrapperProps: { class: 'post' },
        forceWrapper: true,
      })
      expect(result).toBe('<article class="post">Content</article>')
    })
  })

  describe('options.wrapperProps', () => {
    it('passes along additional props to the wrapper element', () => {
      const result = compiler('Hello\n\nworld!', {
        wrapper: 'article',
        wrapperProps: { class: 'post', id: 'main' },
      })
      expect(result).toBe(
        '<article class="post" id="main"><p>Hello</p><p>world!</p></article>'
      )
    })

    it('handles data attributes', () => {
      const result = compiler('Content', {
        wrapper: 'div',
        wrapperProps: { 'data-testid': 'markdown-content' },
        forceWrapper: true,
      })
      expect(result).toBe('<div data-testid="markdown-content">Content</div>')
    })

    it('sanitizes wrapper props', () => {
      const result = compiler('Content', {
        wrapper: 'div',
        wrapperProps: {
          onclick: "javascript:alert('xss')",
          href: 'javascript:alert("xss")',
        },
        forceWrapper: true,
      })
      expect(result).not.toContain('onclick')
      expect(result).not.toContain('javascript:')
    })

    it('works with empty wrapperProps', () => {
      const result = compiler('Hello\n\nworld!', {
        wrapper: 'section',
        wrapperProps: {},
      })
      expect(result).toBe('<section><p>Hello</p><p>world!</p></section>')
    })
  })

  describe('wrapper with footnotes', () => {
    it('wraps content and footnotes together', () => {
      const result = compiler(
        `foo[^abc] bar

[^abc]: Baz baz`,
        { wrapper: 'article', forceWrapper: true }
      )
      expect(result).toContain('<article>')
      expect(result).toContain('foo<a href="#abc"')
      expect(result).toContain('<footer>')
      expect(result).toContain('</footer></article>')
    })

    it('applies wrapperProps to wrapper containing footnotes', () => {
      const result = compiler(
        `foo[^abc] bar

[^abc]: Baz baz`,
        {
          wrapper: 'div',
          wrapperProps: { class: 'content' },
          forceWrapper: true,
        }
      )
      expect(result).toContain('<div class="content">')
      expect(result).toContain('<footer>')
      expect(result).toContain('</footer></div>')
    })
  })

  describe('renderRule', () => {
    it('keeps the line breaks of a result for a raw element in a list item', () => {
      expect(
        compiler('- <b>x</b>', {
          renderRule: (next, node) =>
            node.type === RuleType.htmlBlock ? 'alpha\nbeta' : next(),
        })
      ).toBe('<ul><li>alpha\nbeta</li></ul>')
    })

    it('allows custom rendering of nodes', () => {
      const result = astToHTML(
        [{ type: RuleType.codeBlock, text: 'test', lang: 'javascript' }],
        {
          renderRule: (next, node) => {
            if (
              node.type === RuleType.codeBlock &&
              node.lang === 'javascript'
            ) {
              const text = node.text || ''
              return (
                '<div class="custom-code">' +
                text
                  .replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;') +
                '</div>'
              )
            }
            return next()
          },
        }
      )
      expect(result).toBe('<div class="custom-code">test</div>')
    })

    it('falls back to default rendering when not matching', () => {
      const result = astToHTML(
        [{ type: RuleType.codeBlock, text: 'test', lang: 'python' }],
        {
          renderRule: (next, node) => {
            if (
              node.type === RuleType.codeBlock &&
              node.lang === 'javascript'
            ) {
              const text = node.text || ''
              return (
                '<div class="custom-code">' +
                text
                  .replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;') +
                '</div>'
              )
            }
            return next()
          },
        }
      )
      expect(result).toBe(
        '<pre><code class="language-python">test</code></pre>'
      )
    })

    it('can use renderChildren for nested content', () => {
      const result = astToHTML(
        [
          {
            type: RuleType.paragraph,
            children: [
              { type: RuleType.text, text: 'Hello' },
              {
                type: RuleType.textFormatted,
                tag: 'strong',
                children: [{ type: RuleType.text, text: 'world' }],
              },
            ],
          },
        ],
        {
          renderRule: (next, node, renderChildren) => {
            if (node.type === RuleType.paragraph) {
              return (
                '<div class="custom-p">' +
                renderChildren(node.children || []) +
                '</div>'
              )
            }
            return next()
          },
        }
      )
      expect(result).toBe(
        '<div class="custom-p">Hello<strong>world</strong></div>'
      )
    })

    it('receives state with refs and key', () => {
      const result = astToHTML(
        [
          {
            type: RuleType.heading,
            level: 1,
            id: 'test',
            children: [{ type: RuleType.text, text: 'Test' }],
          },
        ],
        {
          renderRule: (next, node, renderChildren, state) => {
            if (node.type === RuleType.heading) {
              return `<h${node.level} data-key="${state.key}" data-has-refs="${Boolean(state.refs)}">${renderChildren(node.children || [])}</h${node.level}>`
            }
            return next()
          },
        }
      )
      expect(result).toContain('data-key="0"')
      expect(result).toContain('data-has-refs="true"')
    })
  })

  describe('overrides', () => {
    it('allows overriding tag names', () => {
      const result = astToHTML(
        [
          {
            type: RuleType.paragraph,
            children: [{ type: RuleType.text, text: 'Hello' }],
          },
        ],
        {
          overrides: {
            p: 'div',
          },
        }
      )
      expect(result).toBe('<div>Hello</div>')
    })

    it('allows overriding tag names with component object', () => {
      const result = astToHTML(
        [
          {
            type: RuleType.paragraph,
            children: [{ type: RuleType.text, text: 'Hello' }],
          },
        ],
        {
          overrides: {
            p: {
              component: 'section',
            },
          },
        }
      )
      expect(result).toBe('<section>Hello</section>')
    })

    it('allows adding props to tags', () => {
      const result = astToHTML(
        [
          {
            type: RuleType.paragraph,
            children: [{ type: RuleType.text, text: 'Hello' }],
          },
        ],
        {
          overrides: {
            p: {
              component: 'p',
              props: {
                class: 'custom-class',
                id: 'my-id',
              },
            },
          },
        }
      )
      expect(result).toBe('<p class="custom-class" id="my-id">Hello</p>')
    })

    it('merges override props with existing attributes', () => {
      const result = astToHTML(
        [
          {
            type: RuleType.heading,
            level: 1,
            id: 'existing-id',
            children: [{ type: RuleType.text, text: 'Title' }],
          },
        ],
        {
          overrides: {
            h1: {
              props: {
                class: 'heading',
              },
            },
          },
        }
      )
      expect(result).toContain('id="existing-id"')
      expect(result).toContain('class="heading"')
    })

    it('works with links', () => {
      const result = astToHTML(
        [
          {
            type: RuleType.link,
            target: 'https://example.com',
            children: [{ type: RuleType.text, text: 'Link' }],
          },
        ],
        {
          overrides: {
            a: {
              props: {
                target: '_blank',
                rel: 'noopener',
              },
            },
          },
        }
      )
      expect(result).toContain('href="https://example.com"')
      expect(result).toContain('target="_blank"')
      expect(result).toContain('rel="noopener"')
    })

    it('works with images', () => {
      const result = astToHTML(
        [
          {
            type: RuleType.image,
            target: 'image.jpg',
            alt: 'Image',
          },
        ],
        {
          overrides: {
            img: {
              props: {
                loading: 'lazy',
              },
            },
          },
        }
      )
      expect(result).toContain('src="image.jpg"')
      expect(result).toContain('alt="Image"')
      expect(result).toContain('loading="lazy"')
    })

    it('works with formatted text', () => {
      const result = astToHTML(
        [
          {
            type: RuleType.textFormatted,
            tag: 'strong',
            children: [{ type: RuleType.text, text: 'Bold' }],
          },
        ],
        {
          overrides: {
            strong: {
              props: {
                class: 'bold-text',
              },
            },
          },
        }
      )
      expect(result).toBe('<strong class="bold-text">Bold</strong>')
    })

    it('works with ordered lists', () => {
      const result = astToHTML(
        [
          {
            type: RuleType.orderedList,
            start: 1,
            items: [
              [{ type: RuleType.text, text: 'Item 1' }],
              [{ type: RuleType.text, text: 'Item 2' }],
            ],
          },
        ],
        {
          overrides: {
            ol: {
              props: {
                class: 'custom-list',
              },
            },
          },
        }
      )
      expect(result).toContain('<ol class="custom-list">')
      expect(result).toContain('<li>Item 1</li>')
      expect(result).toContain('<li>Item 2</li>')
    })

    it('works with unordered lists', () => {
      const result = astToHTML(
        [
          {
            type: RuleType.unorderedList,
            items: [
              [{ type: RuleType.text, text: 'Item 1' }],
              [{ type: RuleType.text, text: 'Item 2' }],
            ],
          },
        ],
        {
          overrides: {
            ul: {
              component: 'div',
              props: {
                class: 'list-container',
              },
            },
          },
        }
      )
      expect(result).toContain('<div class="list-container">')
      expect(result).toContain('<li>Item 1</li>')
      expect(result).toContain('<li>Item 2</li>')
    })

    it('works with blockquotes', () => {
      const result = astToHTML(
        [
          {
            type: RuleType.blockQuote,
            children: [
              {
                type: RuleType.paragraph,
                children: [{ type: RuleType.text, text: 'Quote text' }],
              },
            ],
          },
        ],
        {
          overrides: {
            blockquote: {
              props: {
                class: 'quote',
                cite: 'https://example.com',
              },
            },
          },
        }
      )
      expect(result).toContain(
        '<blockquote class="quote" cite="https://example.com">'
      )
      expect(result).toContain('Quote text')
    })

    it('works with tables', () => {
      const result = astToHTML(
        [
          {
            type: RuleType.table,
            align: ['left', 'right'],
            header: [
              [{ type: RuleType.text, text: 'Header 1' }],
              [{ type: RuleType.text, text: 'Header 2' }],
            ],
            cells: [
              [
                [{ type: RuleType.text, text: 'Cell 1' }],
                [{ type: RuleType.text, text: 'Cell 2' }],
              ],
            ],
          },
        ],
        {
          overrides: {
            table: {
              props: {
                class: 'data-table',
              },
            },
          },
        }
      )
      expect(result).toContain('<table class="data-table">')
      expect(result).toContain('<th')
      expect(result).toContain('<td')
    })

    it('#513 should not render empty tbody when table has no data rows', () => {
      const result = astToHTML(
        [
          {
            type: RuleType.table,
            align: ['left', 'right'],
            header: [
              [{ type: RuleType.text, text: 'Header 1' }],
              [{ type: RuleType.text, text: 'Header 2' }],
            ],
            cells: [],
          },
        ],
        {}
      )
      expect(result).toMatchInlineSnapshot(
        `"<table><thead><tr><th align="left">Header 1</th><th align="right">Header 2</th></tr></thead></table>"`
      )
    })

    it('works with HTML blocks', () => {
      const result = astToHTML(
        [
          {
            type: RuleType.htmlBlock,
            tag: 'div',
            attrs: { class: 'existing' },
            children: [{ type: RuleType.text, text: 'Content' }],
          },
        ],
        {
          overrides: {
            div: {
              props: {
                'data-custom': 'value',
              },
            },
          },
        }
      )
      expect(result).toContain('class="existing"')
      expect(result).toContain('data-custom="value"')
    })

    it('works with HTML self-closing tags', () => {
      const result = astToHTML(
        [
          {
            type: RuleType.htmlSelfClosing,
            tag: 'br',
            attrs: {},
          },
        ],
        {
          overrides: {
            br: {
              component: 'hr',
              props: {
                class: 'separator',
              },
            },
          },
        }
      )
      expect(result).toContain('<hr class="separator" />')
    })

    it('void element block does not render children (issue #823)', () => {
      const result = compiler('\n<br>')
      expect(result).toMatchInlineSnapshot(`"<br>"`)
    })

    it('void element block separates trailing content (issue #823)', () => {
      const result = compiler('\n<br>\nsome text')
      expect(result).toMatchInlineSnapshot(`"<div><br><p>some text</p></div>"`)
    })

    it('regression test for #856 - hr without newline drops subsequent content', () => {
      const result = compiler('<p></p><hr><p></p>')
      expect(result).toMatchInlineSnapshot(`"<div><p></p><hr><p></p></div>"`)
    })

    it('regression test for #856 - hr without newline drops text content after', () => {
      const result = compiler('<p>before</p><hr><p>after</p>')
      expect(result).toMatchInlineSnapshot(
        `"<div><p>before</p><hr><p>after</p></div>"`
      )
    })

    it('regression test for #856 - self-closing hr without newline drops subsequent content', () => {
      const result = compiler('<p>before</p><hr /><p>after</p>')
      expect(result).toMatchInlineSnapshot(
        `"<div><p>before</p><hr ><p>after</p></div>"`
      )
    })

    it('empty non-void element preserves closing tag', () => {
      expect(compiler('<p></p>')).toMatchInlineSnapshot(`"<p></p>"`)
      expect(compiler('<div></div>')).toMatchInlineSnapshot(`"<div></div>"`)
      expect(compiler('<span></span>')).toMatchInlineSnapshot(
        `"<p><span></span></p>"`
      )
    })

    it('unclosed non-void element does not synthesize a closing tag', () => {
      expect(compiler('<div>')).toMatchInlineSnapshot(`"<div>"`)
      expect(compiler('<p>')).toMatchInlineSnapshot(`"<p>"`)
    })

    it('applies overrides recursively to nested content', () => {
      const result = astToHTML(
        [
          {
            type: RuleType.blockQuote,
            children: [
              {
                type: RuleType.paragraph,
                children: [
                  {
                    type: RuleType.link,
                    target: 'https://example.com',
                    children: [{ type: RuleType.text, text: 'Link' }],
                  },
                ],
              },
            ],
          },
        ],
        {
          overrides: {
            blockquote: {
              props: { class: 'quote' },
            },
            a: {
              props: { class: 'link' },
            },
          },
        }
      )
      expect(result).toContain('<blockquote class="quote">')
      expect(result).toContain('<a class="link"')
    })

    it('handles multiple overrides at once', () => {
      const result = astToHTML(
        [
          {
            type: RuleType.heading,
            level: 1,
            id: 'title',
            children: [{ type: RuleType.text, text: 'Title' }],
          },
          {
            type: RuleType.paragraph,
            children: [{ type: RuleType.text, text: 'Text' }],
          },
        ],
        {
          overrides: {
            h1: {
              props: { class: 'title' },
            },
            p: {
              props: { class: 'paragraph' },
            },
          },
        }
      )
      expect(result).toContain('class="title"')
      expect(result).toContain('class="paragraph"')
      expect(result).toContain('<h1')
      expect(result).toContain('<p')
    })

    it('handles boolean props', () => {
      const result = astToHTML(
        [
          {
            type: RuleType.link,
            target: 'https://example.com',
            children: [{ type: RuleType.text, text: 'Link' }],
          },
        ],
        {
          overrides: {
            a: {
              props: {
                download: true,
                disabled: false,
              },
            },
          },
        }
      )
      expect(result).toContain('download')
      expect(result).not.toContain('disabled')
    })

    it('handles numeric props', () => {
      const result = astToHTML(
        [
          {
            type: RuleType.orderedList,
            start: 1,
            items: [[{ type: RuleType.text, text: 'Item' }]],
          },
        ],
        {
          overrides: {
            ol: {
              props: {
                start: 5,
              },
            },
          },
        }
      )
      expect(result).toContain('start="5"')
    })

    it('handles empty string props', () => {
      const result = astToHTML(
        [
          {
            type: RuleType.paragraph,
            children: [{ type: RuleType.text, text: 'Text' }],
          },
        ],
        {
          overrides: {
            p: {
              props: {
                'data-empty': '',
              },
            },
          },
        }
      )
      expect(result).toContain('data-empty=""')
    })

    it('overrides work with compiler function', () => {
      const result = compiler('# Heading\n\nParagraph', {
        overrides: {
          h1: {
            props: { class: 'heading' },
          },
          p: {
            component: 'div',
            props: { class: 'para' },
          },
        },
      })
      expect(result).toContain('class="heading"')
      expect(result).toContain('<h1')
      expect(result).toContain('<div class="para">')
    })

    it('node id takes precedence over override id for headings because the node id is set after the override props', () => {
      const result = astToHTML(
        [
          {
            type: RuleType.heading,
            level: 1,
            id: 'original-id',
            children: [{ type: RuleType.text, text: 'Title' }],
          },
        ],
        {
          overrides: {
            h1: {
              props: {
                id: 'override-id',
                class: 'new-class',
              },
            },
          },
        }
      )
      expect(result).toContain('class="new-class"')
      expect(result).toContain('id="original-id"')
      expect(result).not.toContain('id="override-id"')
    })
  })

  describe('style attribute formatting', () => {
    it('should format style object with camelCase conversion', () => {
      const result = astToHTML(
        [
          {
            type: RuleType.htmlBlock,
            tag: 'div',
            attrs: {
              style: {
                backgroundColor: 'red',
                fontSize: '14px',
                marginTop: '10px',
              },
            },
            _verbatim: false,
            children: [],
          },
        ],
        {}
      )
      expect(result).toContain(
        'style="background-color: red; font-size: 14px; margin-top: 10px"'
      )
    })

    it('should handle style object with null values', () => {
      const result = astToHTML(
        [
          {
            type: RuleType.htmlBlock,
            tag: 'div',
            attrs: {
              style: {
                color: 'red',
                backgroundColor: null,
                fontSize: undefined,
              },
            },
            _verbatim: false,
            children: [],
          },
        ],
        {}
      )
      expect(result).toContain('style="color: red"')
      expect(result).not.toContain('background-color')
      expect(result).not.toContain('font-size')
    })

    it('writes nothing for an override prop set to false', () => {
      expect(
        compiler('# hi', {
          overrides: { h1: { props: { 'data-a': false, 'data-d': 'k' } } },
        })
      ).toBe('<h1 data-d="k" id="hi">hi</h1>')
    })

    it('writes nothing for an attribute that is a function, a non-style object, or an empty style object', () => {
      expect(
        astToHTML(
          [
            {
              type: RuleType.htmlBlock,
              tag: 'div',
              attrs: {
                'data-a': false,
                'data-b': () => {},
                'data-c': { x: 1 },
                'data-d': 'k',
                style: {},
              },
              _verbatim: false,
              children: [],
            },
          ],
          {}
        )
      ).toBe('<div data-d="k"></div>')
    })

    it.each([
      ['<div class="z">x</div>', '<div class="z">x</div>'],
      ['<div>x</div>', '<div>x</div>'],
      ['<br class="z">', '<br class="z">'],
      ['<Foo a="b"/>', '<Foo a="b"></Foo>'],
    ])('writes no space after the raw tag in %j when every override prop is false', (markdown, html) => {
      expect(
        compiler(markdown, {
          overrides: {
            br: { props: { 'data-a': false } },
            div: { props: { 'data-a': false } },
            Foo: { props: { 'data-a': false } },
          },
        })
      ).toBe(html)
    })
  })

  describe('URL reencoding after sanitization', () => {
    it('should encode non-BMP characters in internationalized URLs', () => {
      expect(
        compiler('[Author post](https://例え.テスト/著者/𠮷田/投稿-🚀)')
      ).toContain(
        'href="https://%E4%BE%8B%E3%81%88.%E3%83%86%E3%82%B9%E3%83%88/%E8%91%97%E8%80%85/%F0%A0%AE%B7%E7%94%B0/%E6%8A%95%E7%A8%BF-%F0%9F%9A%80"'
      )
    })

    it('should reencode backslashes and backticks after sanitization', () => {
      const result = astToHTML(
        [
          {
            type: RuleType.link,
            target: 'https://example.com/path\\with\\backslashes`and`backticks',
            children: [{ type: RuleType.text, text: 'link' }],
          },
        ],
        {
          sanitizer: (url: string) => url.replace(/https:/, 'http:'),
        }
      )
      expect(result).toContain('%5C')
      expect(result).toContain('%60')
    })

    it('should return sanitized URL without reencoding when no special chars', () => {
      const result = astToHTML(
        [
          {
            type: RuleType.link,
            target: 'https://example.com/path',
            children: [{ type: RuleType.text, text: 'link' }],
          },
        ],
        {
          sanitizer: (url: string) => url.replace(/https:/, 'http:'),
        }
      )
      expect(result).toContain('http://example.com/path')
      expect(result).not.toContain('%5C')
      expect(result).not.toContain('%60')
    })
  })

  describe('blockquote alerts', () => {
    it('should add alert class and header for blockquotes with alerts', () => {
      const result = astToHTML(
        [
          {
            type: RuleType.blockQuote,
            alert: 'Note',
            children: [
              {
                type: RuleType.paragraph,
                children: [{ type: RuleType.text, text: 'Important info' }],
              },
            ],
          },
        ],
        {}
      )
      expect(result).toContain('markdown-alert-note')
      expect(result).toContain('<header>Note</header>')
      expect(result).toContain('Important info')
    })

    it('should handle alert with special characters', () => {
      const result = astToHTML(
        [
          {
            type: RuleType.blockQuote,
            alert: 'WARNING!',
            children: [
              {
                type: RuleType.paragraph,
                children: [{ type: RuleType.text, text: 'Be careful' }],
              },
            ],
          },
        ],
        {}
      )
      expect(result).toContain('markdown-alert-warning')
      expect(result).toContain('<header>WARNING!</header>')
    })

    it.each([
      ['a space', ' '],
      ['a no-break space', ' '],
      ['an ideographic space', '　'],
      ['a form feed', '\f'],
      ['a vertical tab', '\v'],
    ])('stays an alert when the marker is followed by %s', (_name, ws) => {
      expect(compiler(`> [!NOTE]${ws}\n> body`)).toBe(
        '<blockquote class="markdown-alert-note"><header>NOTE</header><p>body</p></blockquote>'
      )
    })

    it('stays a quote when the marker is followed by text', () => {
      expect(compiler('> [!NOTE]　x\n> body')).toBe(
        '<blockquote><p>[!NOTE]　x\nbody</p></blockquote>'
      )
    })
  })

  describe('lazy continuation of a blockquote or list item', () => {
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
        '<div><blockquote><h1 id="h">h</h1></blockquote><p>lazy</p></div>',
      ],
      [
        '- # h\nlazy',
        '<div><ul><li><h1 id="h">h</h1></li></ul><p>lazy</p></div>',
      ],
      ['> ---\nlazy', '<div><blockquote><hr /></blockquote><p>lazy</p></div>'],
      [
        '> ```\n> a\nlazy',
        '<div><blockquote><pre><code>a</code></pre></blockquote><p>lazy</p></div>',
      ],
      [
        '- | a | b |\n  | - | - |\nlazy',
        '<div><ul><li><table><thead><tr><th>a</th><th>b</th></tr></thead></table></li></ul><p>lazy</p></div>',
      ],
      ['> <pre>\nlazy', '<div><blockquote><pre></blockquote><p>lazy</p></div>'],
      ['- <pre>\nlazy', '<div><ul><li><pre></li></ul><p>lazy</p></div>'],
      ['> <div>\nlazy', '<div><blockquote><div></blockquote><p>lazy</p></div>'],
      ['- <div>\nlazy', '<div><ul><li><div></li></ul><p>lazy</p></div>'],
      ['- </pre>\nm', '<div><ul><li></pre></li></ul><p>m</p></div>'],
      ['> </pre>\nm', '<div><blockquote></pre></blockquote><p>m</p></div>'],
      ['> - a\nlazy', '<blockquote><ul><li>a\nlazy</li></ul></blockquote>'],
      [
        '> > a\nlazy',
        '<blockquote><blockquote><p>a\nlazy</p></blockquote></blockquote>',
      ],
      [
        '> f\nbar\n> # x',
        '<blockquote><p>f\nbar</p><h1 id="x">x</h1></blockquote>',
      ],
      [
        '- 10. a\n\n      b\nlazy',
        '<ul><li><ol start="10"><li><p>a</p><p>b\nlazy</p></li></ol></li></ul>',
      ],
      [
        '> 1.  one\n>\n>     two\nthree',
        '<blockquote><ol><li><p>one</p><p>two\nthree</p></li></ol></blockquote>',
      ],
      [
        '> [x]: /u\n[y]: /v\n\n[y]',
        '<div><blockquote></blockquote><p><a href="/v">y</a></p></div>',
      ],
    ])('ends or extends a container for %j as %j', (input, expected) => {
      expect(compiler(input)).toBe(expected)
    })
  })

  describe('list looseness around HTML blocks', () => {
    it.each([
      [
        'a block that ends at the blank line before a paragraph',
        '- <div>x</div>\n\n  i\n- b',
        '<ul><li><div>x</div><p>i</p></li><li><p>b</p></li></ul>',
      ],
      [
        'a nested block that ends at a blank line',
        '- <details>\n  <summary>S</summary>\n\n  body\n\n  </details>\n- next',
        '<ul><li><details><summary>S</summary><p>body</p></details></li><li><p>next</p></li></ul>',
      ],
      [
        'an unclosed block that ends at a blank line',
        '- <div>a\n\n  b',
        '<ul><li><div>a\n<p>b</p></li></ul>',
      ],
      [
        'an opener whose block ends at a blank line',
        '1. <p align="center">\n\n   para\n2. x',
        '<ol><li><p align="center"><p>para</p></li><li><p>x</p></li></ol>',
      ],
      [
        'a void tag followed by a line remainder',
        '- <img src="a.png"> \n  caption\n- b',
        '<ul><li><img src="a.png">caption</li><li>b</li></ul>',
      ],
      [
        'a self-closing component followed by a line remainder',
        '- <MyComponent /> \n  text\n- two',
        '<ul><li><MyComponent ></MyComponent>text</li><li>two</li></ul>',
      ],
      [
        'a closing tag followed by text',
        '- </pre>\n  x\n- y',
        '<ul><li></pre>x</li><li>y</li></ul>',
      ],
    ])('keeps the list right with %s', (_name, source, expected) => {
      expect(compiler(source)).toBe(expected)
    })
  })

  describe('HTML block with closing tag in text', () => {
    it('should reconstruct the closing tag on a raw script block with tagfilter off, since the default-on escaping has its own security test', () => {
      const result = astToHTML(
        [
          {
            type: RuleType.htmlBlock,
            tag: 'script',
            attrs: {},
            _verbatim: true,
            _rawBody: 'console.log("test");',
            _rawClose: '</script>',
            children: [],
          },
        ],
        { tagfilter: false }
      )
      expect(result).toMatchInlineSnapshot(
        `"<script>console.log("test");</script>"`
      )
    })

    it('should handle pre block with closing tag in text', () => {
      const result = astToHTML(
        [
          {
            type: RuleType.htmlBlock,
            tag: 'pre',
            attrs: {},
            _verbatim: true,
            _rawBody: '<code>test</code>',
            _rawClose: '</pre>',
            children: [],
          },
        ],
        {}
      )
      expect(result).toMatchInlineSnapshot(`"<pre><code>test</code></pre>"`)
    })

    it('should add the closing tag on a Type 1 raw script block that has none, with tagfilter off', () => {
      const result = astToHTML(
        [
          {
            type: RuleType.htmlBlock,
            tag: 'script',
            attrs: {},
            _verbatim: true,
            _rawBody: 'console.log("test");',
            children: [],
          },
        ],
        { tagfilter: false }
      )
      expect(result).toMatchInlineSnapshot(
        `"<script>console.log("test");</script>"`
      )
    })

    it.each([
      ['x<span></span></span', '<p>x<span></span>&lt;/span</p>'],
      ['x<div></div></div', '<p>x<div></div>&lt;/div</p>'],
      ['x<Foo></Foo></Foo', '<p>x<Foo></Foo>&lt;/Foo</p>'],
    ])('leaves the second closer of %j as text', (input, expected) => {
      expect(compiler(input)).toBe(expected)
    })

    it.each([
      '<!--@/>',
      '<!A[@e>',
    ])('passes %j through as a raw block', markup => {
      expect(compiler(markup)).toBe(markup)
    })

    it('renders the children of a stored block with its private fields dropped', () => {
      expect(
        astToHTML(storedAST('<div>\n  <div/>\n  <span>content</span>\n</div>'))
      ).toBe('<div><div></div><p><span>content</span></p></div>')
    })
  })

  describe('tagfilter escapes dangerous tags by default, in both the compiler() entry and astToHTML', () => {
    it('escapes script/iframe/style with default options via compiler()', () => {
      expect(compiler('<script>alert(1)</script>')).toBe(
        '&lt;script>alert(1)&lt;/script>'
      )
      expect(compiler('<iframe src=x></iframe>')).toBe(
        '&lt;iframe src=x>&lt;/iframe>'
      )
      expect(compiler('<style>*{}</style>')).toBe('&lt;style>*{}&lt;/style>')
    })

    it('escapes dangerous tags by default via astToHTML()', () => {
      expect(astToHTML(parser('<script>alert(1)</script>'))).toBe(
        '&lt;script>alert(1)&lt;/script>'
      )
    })

    it('passes dangerous tags through only when tagfilter is explicitly disabled', () => {
      expect(compiler('<script>x</script>', { tagfilter: false })).toBe(
        '<script>x</script>'
      )
    })
  })

  describe('strips dangerous attributes from raw HTML, which the html string compiler emits verbatim, making it the strictest test of the parser-level stripping', () => {
    it('strips on* event handlers regardless of quoting or case', () => {
      expect(compiler('<img src=x onerror=alert(1)>')).toBe('<img src=x>')
      expect(compiler('<div onclick="alert(1)">hi</div>')).toBe(
        '<div >hi</div>'
      )
      expect(compiler('<p onmouseover=alert(1)>hi</p>')).toBe('<p >hi</p>')
      expect(compiler('<div OnClick="alert(1)">x</div>')).toBe('<div >x</div>')
      expect(compiler('<svg onload=alert(1)>y</svg>')).toBe(
        '<p><svg>y</svg></p>'
      )
    })

    it('strips dangerous-scheme URL attributes', () => {
      expect(compiler('<a href="javascript:alert(1)">x</a>')).toBe(
        '<p><a>x</a></p>'
      )
      expect(compiler('<a href="JAVASCRIPT:alert(1)">x</a>')).toBe(
        '<p><a>x</a></p>'
      )
      expect(compiler('<a href="vbscript:msgbox(1)">x</a>')).toBe(
        '<p><a>x</a></p>'
      )
      expect(compiler('<a href="  javascript:alert(1)">x</a>')).toBe(
        '<p><a>x</a></p>'
      )
      expect(
        compiler('<form action="javascript:alert(1)"><button>x</button></form>')
      ).toBe('<form ><button>x</button></form>')
      expect(compiler('<object data="javascript:alert(1)"></object>')).toBe(
        '<p><object></object></p>'
      )
      expect(compiler('<a xlink:href="javascript:alert(1)">x</a>')).toBe(
        '<p><a>x</a></p>'
      )
      expect(compiler('<video poster="javascript:alert(1)"></video>')).toBe(
        '<p><video></video></p>'
      )
      expect(
        compiler('<blockquote cite="javascript:alert(1)">q</blockquote>')
      ).toBe('<blockquote >q</blockquote>')
    })

    it.each([
      ['0;url=javascript:alert(1)'],
      ['0;URL=javascript:alert(1)'],
      ["0; url = 'javascript:alert(1)'"],
      ['0;url=JaVaScRiPt:alert(1)'],
      ['0;url=&#106;avascript:alert(1)'],
      ['0;url=jav&#x61;script:alert(1)'],
      ['0;url=java%73cript:alert(1)'],
      ['0;url=java&#9;script:alert(1)'],
      ['0;url=data:text/html,x'],
      ['0;url=vbscript:msgbox(1)'],
      ['0;javascript:alert(1)'],
      ['  5 , url=javascript:alert(1)'],
    ])('strips a meta refresh content whose URL is dangerous: %s', content => {
      expect(compiler(`<meta http-equiv="refresh" content="${content}">`)).toBe(
        '<meta http-equiv="refresh">'
      )
    })

    it('keeps a meta refresh content whose URL is safe', () => {
      expect(
        compiler('<meta http-equiv="refresh" content="0;url=https://x.y">')
      ).toBe('<meta http-equiv="refresh" content="0;url=https://x.y">')
      expect(
        compiler(
          '<meta http-equiv="refresh" content="5; URL=/next?a=javascript:x">'
        )
      ).toBe(
        '<meta http-equiv="refresh" content="5; URL=/next?a=javascript:x">'
      )
      expect(
        compiler('<meta name="description" content="data: files and url=x">')
      ).toBe('<meta name="description" content="data: files and url=x">')
    })

    it('strips schemes hidden behind HTML entities (tab/newline)', () => {
      expect(compiler('<a href="java&#9;script:alert(1)">x</a>')).toBe(
        '<p><a>x</a></p>'
      )
      expect(compiler('<a href="java&#10;script:alert(1)">x</a>')).toBe(
        '<p><a>x</a></p>'
      )
    })

    it('strips dangerous data: URLs but keeps data:image', () => {
      expect(
        compiler('<img src="data:text/html,<script>alert(1)</script>">')
      ).toBe('<img >')
      expect(compiler('<img src="data:image/png;base64,iVBOR">')).toBe(
        '<img src="data:image/png;base64,iVBOR">'
      )
    })

    it('strips srcdoc entirely, before the default tagfilter escapes the iframe', () => {
      expect(
        compiler('<iframe srcdoc="<img src=x onerror=alert(1)>"></iframe>')
      ).toBe('&lt;iframe >&lt;/iframe>')
    })

    it('strips handlers on verbatim tags and nested tags', () => {
      expect(compiler('<pre onclick="alert(1)">code</pre>')).toBe(
        '<pre >code</pre>'
      )
      expect(compiler('<div><img onerror=alert(1)></div>')).toBe(
        '<div><img ></div>'
      )
    })

    it('strips handlers nested in a container that also holds block-level markdown, where the non-verbatim raw-source emit path must still sanitize inner tags', () => {
      expect(
        compiler(
          '<div>\n# Heading\n<a href="javascript:alert(1)">y</a>\n</div>'
        )
      ).toBe('<div>\n# Heading\n<a >y</a>\n</div>')
      expect(
        compiler(
          '<div>\n# Heading\n<a href="/ok" onclick="alert(1)">y</a>\n</div>'
        )
      ).toBe('<div>\n# Heading\n<a href="/ok">y</a>\n</div>')
    })

    it('strips numeric-character-reference schemes without a trailing semicolon, which browsers resolve to the scheme', () => {
      expect(compiler('<a href="&#106avascript:alert(1)">x</a>')).toBe(
        '<p><a>x</a></p>'
      )
      expect(compiler('<a href="j&#x61vascript:alert(1)">x</a>')).toBe(
        '<p><a>x</a></p>'
      )
      expect(compiler('<a href="/s?a=1&#38;b=2">ok</a>')).toBe(
        '<p><a href="/s?a=1&#38;b=2">ok</a></p>'
      )
    })

    it('preserves safe attributes with original formatting', () => {
      expect(
        compiler(
          '<a href="https://example.com" title="t" class="c" data-x="1">ok</a>'
        )
      ).toBe(
        '<p><a href="https://example.com" title="t" class="c" data-x="1">ok</a></p>'
      )
    })
  })

  describe('raw HTML <table> with markdown in cells (#862)', () => {
    it('preserves row structure when second row cell contains a block-level list', () => {
      expect(
        compiler(
          '<table><tr><td>a</td></tr><tr><td>\n\n- x\n\n</td></tr></table>'
        )
      ).toMatchInlineSnapshot(
        `"<table><tr><td>a</td></tr><tr><td><ul><li>x</li></ul></td></tr></table>"`
      )
    })

    it('preserves all rows when first row contains a block-level list', () => {
      expect(
        compiler(
          '<table><tr><td>\n\n- x\n\n</td></tr><tr><td>plain</td></tr></table>'
        )
      ).toMatchInlineSnapshot(
        `"<table><tr><td><ul><li>x</li></ul></td></tr><tr><td>plain</td></tr></table>"`
      )
    })

    it('preserves all three rows when middle row contains a list', () => {
      expect(
        compiler(
          '<table><tr><td>r1</td></tr><tr><td>\n\n- x\n\n</td></tr><tr><td>r3</td></tr></table>'
        )
      ).toMatchInlineSnapshot(
        `"<table><tr><td>r1</td></tr><tr><td><ul><li>x</li></ul></td></tr><tr><td>r3</td></tr></table>"`
      )
    })

    it('handles original issue repro with tbody wrapper and indentation', () => {
      const input = `<table>
  <tbody>
    <tr>
      <td>Foo 1</td>
      <td>Bar 1</td>
    </tr>
    <tr>
      <td>Foo 2</td>
      <td>A list:

- one
- two
- three
      </td>
    </tr>
  </tbody>
</table>`
      const out = compiler(input)
      expect(out).toContain('<td>Foo 1</td>')
      expect(out).toContain('<td>Bar 1</td>')
      expect(out).toContain('<td>Foo 2</td>')
      expect(out).toContain('<ul><li>one</li><li>two</li><li>three</li></ul>')
      expect(out.match(/<tr>/g)?.length).toBe(2)
      expect(out.match(/<\/tr>/g)?.length).toBe(2)
      expect(out.match(/<td>/g)?.length).toBe(4)
      expect(out.match(/<\/td>/g)?.length).toBe(4)
    })

    it('handles ordered list in cell', () => {
      expect(
        compiler(
          '<table><tr><td>r1</td></tr><tr><td>\n\n1. x\n2. y\n\n</td></tr></table>'
        )
      ).toMatchInlineSnapshot(
        `"<table><tr><td>r1</td></tr><tr><td><ol><li>x</li><li>y</li></ol></td></tr></table>"`
      )
    })

    it('handles blockquote in cell', () => {
      expect(
        compiler(
          '<table><tr><td>r1</td></tr><tr><td>\n\n> q\n\n</td></tr></table>'
        )
      ).toMatchInlineSnapshot(
        `"<table><tr><td>r1</td></tr><tr><td><blockquote><p>q</p></blockquote></td></tr></table>"`
      )
    })

    it('handles fenced code block in cell', () => {
      expect(
        compiler(
          '<table><tr><td>r1</td></tr><tr><td>\n\n```\ncode\n```\n\n</td></tr></table>'
        )
      ).toMatchInlineSnapshot(
        `"<table><tr><td>r1</td></tr><tr><td><pre><code>code</code></pre></td></tr></table>"`
      )
    })

    it('handles heading in cell', () => {
      expect(
        compiler(
          '<table><tr><td>r1</td></tr><tr><td>\n\n# h\n\n</td></tr></table>'
        )
      ).toMatchInlineSnapshot(
        `"<table><tr><td>r1</td></tr><tr><td><h1 id="h">h</h1></td></tr></table>"`
      )
    })

    it('handles list in <th> cell', () => {
      expect(
        compiler(
          '<table><thead><tr><th>\n\n- x\n\n</th></tr></thead><tbody><tr><td>r1</td></tr></tbody></table>'
        )
      ).toMatchInlineSnapshot(
        `"<table><thead><tr><th><ul><li>x</li></ul></th></tr></thead><tbody><tr><td>r1</td></tr></tbody></table>"`
      )
    })

    it('leaves inline markdown in cell as raw when no blank line (GFM raw HTML block)', () => {
      expect(
        compiler(
          '<table><tbody><tr><td>**bold**</td><td>r1</td></tr></tbody></table>'
        )
      ).toMatchInlineSnapshot(
        `"<table><tbody><tr><td>**bold**</td><td>r1</td></tr></tbody></table>"`
      )
    })
  })

  describe('HTML block with text content and tagfilter', () => {
    it('should apply tagfilter to text content in HTML blocks, reconstructing the non-filtered parent opener without a trailing </div> when the direct AST _rawBody has no own closer', () => {
      const result = astToHTML(
        [
          {
            type: RuleType.htmlBlock,
            tag: 'div',
            attrs: {},
            _verbatim: true,
            _rawBody: 'Content with <script>alert("xss")</script>',
            children: [],
          },
        ],
        { tagfilter: true }
      )
      expect(result).toMatchInlineSnapshot(
        `"<div>Content with &lt;script>alert("xss")&lt;/script>"`
      )
    })
  })

  describe('HTML self-closing with tagfilter and rawOpen', () => {
    it('should escape rawOpen when tagfilter is enabled for dangerous tags', () => {
      const result = astToHTML(
        [
          {
            type: RuleType.htmlSelfClosing,
            tag: 'script',
            attrs: {},
            _rawOpen: '<script src="evil.js">',
          },
        ],
        { tagfilter: true }
      )
      expect(result).toMatchInlineSnapshot(`"&lt;script src="evil.js">"`)
    })

    it('should handle self-closing closing tag', () => {
      const result = astToHTML(
        [
          {
            type: RuleType.htmlSelfClosing,
            tag: 'div',
            attrs: {},
            _isClosingTag: true,
          },
        ],
        {}
      )
      expect(result).toMatchInlineSnapshot(`"</div>"`)
    })
  })

  describe('space preservation in HTML attributes', () => {
    it('should preserve spaces inside HTML attribute values', () => {
      const result = astToHTML(
        [
          {
            type: RuleType.paragraph,
            children: [
              { type: RuleType.text, text: 'Text with ' },
              {
                type: RuleType.htmlBlock,
                tag: 'div',
                attrs: { title: 'Attribute with space \n newline' },
                _verbatim: false,
                children: [],
              },
              { type: RuleType.text, text: ' more text' },
            ],
          },
        ],
        {}
      )
      expect(result).toMatchInlineSnapshot(`
        "<p>Text with <div title="Attribute with space 
         newline"></div> more text</p>"
      `)
    })

    it('should collapse spaces in text content but preserve in attributes', () => {
      const result = compiler(
        'Text with <div title="attr \n value">content</div> more text'
      )
      expect(result).toMatchInlineSnapshot(`
        "<p>Text with <div title="attr 
         value">content</div> more text</p>"
      `)
    })

    it('should handle multiple quotes in attributes correctly', () => {
      const result = compiler(
        'Text <div title=\'quote "inside" quote\'>content</div> more'
      )
      expect(result).toMatchInlineSnapshot(
        `"<p>Text <div title='quote "inside" quote'>content</div> more</p>"`
      )
    })
  })

  describe('multi-line HTML tags', () => {
    it('#781 should handle custom elements with multi-line attributes', () => {
      const result = compiler(`<dl-custom
  data-variant='horizontalTable'
>
  <dt>title 1</dt>
  <dd>description 1</dd>
</dl-custom>`)

      expect(result).toMatchInlineSnapshot(`
        "<dl-custom
          data-variant='horizontalTable'
        >
          <dt>title 1</dt>
          <dd>description 1</dd>
        </dl-custom>"
      `)
    })

    it('#781 should handle standard elements with multi-line attributes', () => {
      const result = compiler(`<div
  class='container'
  data-test='value'
>
  <p>content</p>
</div>`)

      expect(result).toMatchInlineSnapshot(`
        "<div
          class='container'
          data-test='value'
        >
          <p>content</p>
        </div>"
      `)
    })

    it('should handle uppercase custom components with multi-line attributes', () => {
      const result = compiler(`<MyComponent
  prop="value"
>
  content
</MyComponent>`)

      expect(result).toMatchInlineSnapshot(`
        "<MyComponent
          prop="value"
        >
          content
        </MyComponent>"
      `)
    })

    describe('#781 trailing newline and whitespace variations', () => {
      const baseInput = `<dl-custom
  data-variant='horizontalTable'
>
  <dt>title 1</dt>
</dl-custom>`

      it('should handle no trailing whitespace', () => {
        expect(compiler(baseInput)).toMatchInlineSnapshot(`
          "<dl-custom
            data-variant='horizontalTable'
          >
            <dt>title 1</dt>
          </dl-custom>"
        `)
      })

      it('should handle trailing newline', () => {
        expect(compiler(`${baseInput}\n`)).toMatchInlineSnapshot(`
          "<dl-custom
            data-variant='horizontalTable'
          >
            <dt>title 1</dt>
          </dl-custom>
          "
        `)
      })

      it('should handle CRLF line endings', () => {
        expect(
          compiler(baseInput.replace(/\n/g, '\r\n'))
        ).toMatchInlineSnapshot(`
          "<dl-custom
            data-variant='horizontalTable'
          >
            <dt>title 1</dt>
          </dl-custom>"
        `)
      })

      it('should handle leading and trailing newlines', () => {
        expect(compiler(`\n${baseInput}\n\n`)).toMatchInlineSnapshot(`
          "<dl-custom
            data-variant='horizontalTable'
          >
            <dt>title 1</dt>
          </dl-custom>
          "
        `)
      })
    })

    describe('#781 full original issue example', () => {
      it('should render exact issue example correctly', () => {
        expect(
          compiler(`<dl-custom
  data-variant='horizontalTable'
>
  <dt>title 1</dt>
  <dd>description 1</dd>
  <dt>title 2</dt>
  <dd>description 2</dd>
  <dt>title 3</dt>
  <dd>description 3</dd>
</dl-custom>`)
        ).toMatchInlineSnapshot(`
          "<dl-custom
            data-variant='horizontalTable'
          >
            <dt>title 1</dt>
            <dd>description 1</dd>
            <dt>title 2</dt>
            <dd>description 2</dd>
            <dt>title 3</dt>
            <dd>description 3</dd>
          </dl-custom>"
        `)
      })

      it('should render issue example with trailing newline correctly', () => {
        expect(
          compiler(`<dl-custom
  data-variant='horizontalTable'
>
  <dt>title 1</dt>
  <dd>description 1</dd>
  <dt>title 2</dt>
  <dd>description 2</dd>
  <dt>title 3</dt>
  <dd>description 3</dd>
</dl-custom>
`)
        ).toMatchInlineSnapshot(`
          "<dl-custom
            data-variant='horizontalTable'
          >
            <dt>title 1</dt>
            <dd>description 1</dd>
            <dt>title 2</dt>
            <dd>description 2</dd>
            <dt>title 3</dt>
            <dd>description 3</dd>
          </dl-custom>
          "
        `)
      })
    })
  })

  describe('frontmatter', () => {
    it('should not render frontmatter by default', () => {
      const result = compiler('---\ntitle: Test\n---\n\n# Content')

      expect(result).toBe('<h1 id="content">Content</h1>')
    })

    it('should render frontmatter when preserveFrontmatter is true', () => {
      const result = compiler('---\ntitle: Test\n---\n\n# Content', {
        preserveFrontmatter: true,
      })

      expect(result).toBe(
        '<div><pre>---\ntitle: Test\n---</pre><h1 id="content">Content</h1></div>'
      )
    })

    it('should render frontmatter correctly with multiline content', () => {
      const frontmatter = `---
title: My Document
author: John Doe
date: 2023-11-22
tags:
  - test
  - example
---`

      const result = compiler(`${frontmatter}\n\n# Content`, {
        preserveFrontmatter: true,
      })

      expect(result).toBe(
        '<div><pre>---\ntitle: My Document\nauthor: John Doe\ndate: 2023-11-22\ntags:\n  - test\n  - example\n---</pre><h1 id="content">Content</h1></div>'
      )
    })

    it('should not treat thematic break with colons in content as frontmatter (issue #861)', () => {
      const result = compiler(
        '---\n\n**Subject: Hello World**\n\nSome content here.\n\n---\n\n> Final section'
      )

      expect(result).toMatchInlineSnapshot(
        `"<div><hr /><p><strong>Subject: Hello World</strong></p><p>Some content here.</p><hr /><blockquote><p>Final section</p></blockquote></div>"`
      )
    })
  })
})

describe('optimizeForStreaming keeps literal delimiters', () => {
  it('removes only the unclosed emphasis opener on the last line and keeps literal underscores and asterisks in finished text (issue #905)', () => {
    expect(
      compiler(
        'pass *args and **kwargs\n\ncustomer_id and `customer_id`\n\nSELECT * FROM t WHERE 2*3=6\n\nhttps://example.com/a_b and <https://example.com/c_d>\n\n**held',
        { optimizeForStreaming: true }
      )
    ).toMatchInlineSnapshot(
      `"<div><p>pass *args and **kwargs</p><p>customer_id and <code>customer_id</code></p><p>SELECT * FROM t WHERE 2*3=6</p><p><a href="https://example.com/a_b">https://example.com/a_b</a> and <a href="https://example.com/c_d">https://example.com/c_d</a></p><p>held</p></div>"`
    )
  })

  it('hides a never-closed opener while the option is on, since the parser cannot tell a streaming edge from finished text, and shows it as written in the final render with the option off (issue #909)', () => {
    const md = 'Use _trace and *args'
    expect(compiler(md, { optimizeForStreaming: true })).toMatchInlineSnapshot(
      `"<p>Use trace and args</p>"`
    )
    expect(compiler(md, { optimizeForStreaming: false })).toMatchInlineSnapshot(
      `"<p>Use _trace and *args</p>"`
    )
  })

  it('renders complete raw HTML, and incomplete-looking links and code in a block that is no longer the last one, exactly as without the option', () => {
    const md = 'a <span>z</span> <br> b\n\nsee [a](b and `code\n\nlast'
    const streamed = compiler(md, { optimizeForStreaming: true })
    expect(streamed).toBe(compiler(md))
    expect(streamed).toMatchInlineSnapshot(
      `"<div><p>a <span>z</span> <br> b</p><p>see [a](b and \`code</p><p>last</p></div>"`
    )
  })
})

describe('optimizeForStreaming option', () => {
  it('should strip incomplete HTML tags but keep content', () => {
    const result = compiler('Hello world <div>incomplete', {
      optimizeForStreaming: true,
    })
    expect(result).toContain('Hello world')
    expect(result).toContain('incomplete')
    expect(result).not.toContain('<div>')
  })

  it('should render incomplete fenced code blocks normally so users see the code as it streams', () => {
    const result = compiler('```js\nconst x = 1;', {
      optimizeForStreaming: true,
    })
    expect(result).toContain('const x = 1')
  })

  it('should strip incomplete inline code backticks but keep content', () => {
    const result = compiler('Hello world `incomplete code', {
      optimizeForStreaming: true,
    })
    expect(result).toContain('Hello world')
  })

  it('should strip incomplete bold markers but keep text content', () => {
    const result = compiler('Hello world **bold text', {
      optimizeForStreaming: true,
    })
    expect(result).toContain('Hello world')
    expect(result).toContain('bold text')
    expect(result).not.toContain('**')
  })

  it('should strip incomplete link brackets but keep text content', () => {
    const result = compiler('Hello world [link](http://example.com', {
      optimizeForStreaming: true,
    })
    expect(result).toContain('Hello world')
    expect(result).toContain('link')
    expect(result).not.toContain('[')
  })

  it('should render complete content normally when enabled', () => {
    const result = compiler('<div>complete</div>', {
      optimizeForStreaming: true,
    })
    expect(result).toContain('complete')
  })

  it('should render content without special syntax normally when enabled', () => {
    const result = compiler('Hello world', { optimizeForStreaming: true })
    expect(result).toContain('Hello world')
  })

  it('should render incomplete content when option is disabled (default)', () => {
    const result = compiler('<div>incomplete')
    expect(result).toContain('incomplete')
  })

  it('preserves literal less-than prose while deferring incomplete tags', () => {
    expect(compiler('5 < 3 is false', { optimizeForStreaming: true })).toBe(
      '<p>5 &lt; 3 is false</p>'
    )
    expect(compiler('Hello <Citation', { optimizeForStreaming: true })).toBe(
      '<p>Hello</p>'
    )
    expect(
      compiler('Hello <div>a</div> and 1 < 2', { optimizeForStreaming: true })
    ).toBe('<p>Hello <div>a</div> and 1 &lt; 2</p>')
  })

  it('reads a closing tag after an unfinished opener the way a full parse does', () => {
    expect(compiler('x <Comp </b>y', { optimizeForStreaming: true })).toBe(
      '<p>x &lt;Comp </b>y</p>'
    )
  })
})

describe('regression #881 - trailing text after a nested HTML element', () => {
  it('text line after a nested block element is preserved', () => {
    expect(
      compiler('<details>\n<summary>a</summary>\nx\n</details>')
    ).toMatchInlineSnapshot(`
      "<details><summary>a</summary>
      x
      </details>"
    `)
  })

  it('text line after a nested paragraph is preserved', () => {
    expect(compiler('<div>\n<p>a</p>\nx\n</div>')).toMatchInlineSnapshot(`
      "<div><p>a</p>
      x
      </div>"
    `)
  })

  it('text line between nested paragraphs is preserved', () => {
    expect(
      compiler('<div>\n<p>a</p>\nx\n<p>b</p>\n</div>')
    ).toMatchInlineSnapshot(`
      "<div><p>a</p>
      x
      <p>b</p>
      </div>"
    `)
  })

  it('text after the element own closing tag is preserved', () => {
    expect(
      compiler('<div>\n<span>a</span>\n</div>\ntail')
    ).toMatchInlineSnapshot(`
      "<div><span>a</span>
      </div>
      tail"
    `)
  })
})

describe('unique heading IDs (#857)', () => {
  it('suffixes duplicate heading ids in rendered output', () => {
    expect(
      compiler(`# Foo

# Bar

## Foo`)
    ).toMatchInlineSnapshot(
      `"<div><h1 id="foo">Foo</h1><h1 id="bar">Bar</h1><h2 id="foo-1">Foo</h2></div>"`
    )
  })

  it('slugs headings from inline text content, not raw source', () => {
    expect(compiler('## [text](https://e.com)')).toBe(
      '<h2 id="text"><a href="https://e.com">text</a></h2>'
    )
  })

  it('folds accented Latin letters and ß into the heading id', () => {
    expect(compiler('# Öl Straße')).toBe('<h1 id="ol-strasse">Öl Straße</h1>')
    expect(compiler('# Łódź')).toBe('<h1 id="lodz">Łódź</h1>')
  })

  it.each([
    ['# !!!', '<h1>!!!</h1>'],
    ['# `]`', '<h1><code>]</code></h1>'],
  ])('omits the id attribute of %j, a heading with an empty slug', (input, expected) => {
    expect(compiler(input)).toBe(expected)
  })

  it('omits the id attribute of a heading whose slug is only whitespace', () => {
    expect(compiler('# Hi', { slugify: () => ' ' })).toBe('<h1>Hi</h1>')
  })
})

describe('entity text in image alt and link or image title', () => {
  it.each([
    ['![&amp;copy;](x)', '<p><img src="x" alt="&amp;copy;" /></p>'],
    ['[a](x "&amp;copy;")', '<p><a href="x" title="&amp;copy;">a</a></p>'],
    [
      '![a](x "t&amp;amp;")',
      '<p><img src="x" alt="a" title="t&amp;amp;" /></p>',
    ],
    [
      '[a][r]\n\n[r]: /u "t&amp;copy;"',
      '<p><a href="/u" title="t&amp;copy;">a</a></p>',
    ],
    [
      '![a][r]\n\n[r]: /u "t&amp;copy;"',
      '<p><img src="/u" alt="a" title="t&amp;copy;" /></p>',
    ],
    ['![&copy;](x)', '<p><img src="x" alt="©" /></p>'],
    ['[a](x "&copy;")', '<p><a href="x" title="©">a</a></p>'],
  ])('writes the text of %j once-decoded and escaped', (input, expected) => {
    expect(compiler(input)).toBe(expected)
  })
})

describe('destination entity decode before sanitize', () => {
  it('drops entity-obfuscated javascript: href and src', () => {
    expect(compiler('[x](&#106;avascript:alert(1))')).toBe('<p><a>x</a></p>')
    expect(compiler('![x](&#106;avascript:alert(1))')).toBe(
      '<p><img src="" alt="x" /></p>'
    )
  })

  it('percent-encodes a control character in an image src as in a link href', () => {
    expect(compiler('![x](java\u0001script:alert(1))')).toBe(
      '<p><img src="java%01script:alert(1)" alt="x" /></p>'
    )
    expect(compiler('![x](java&#1;script:alert(1))')).toBe(
      '<p><img src="java%01script:alert(1)" alt="x" /></p>'
    )
    expect(compiler('[x](java\u0001script:alert(1))')).toBe(
      '<p><a href="java%01script:alert(1)">x</a></p>'
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
    expect(compiler(input)).toBe('<p><img src="" alt="x" /></p>')
  })

  it('keeps and encodes a safe image src', () => {
    expect(compiler('![x](https://a.b/c.png)')).toBe(
      '<p><img src="https://a.b/c.png" alt="x" /></p>'
    )
    expect(compiler('![x](<a b.png>)')).toBe(
      '<p><img src="a%20b.png" alt="x" /></p>'
    )
  })

  it('re-sanitizes direct astToHTML link targets before href encoding', () => {
    expect(
      astToHTML([
        {
          type: RuleType.link,
          target: 'javascript:alert(1)',
          children: [{ type: RuleType.text, text: 'x' }],
        },
      ])
    ).toBe('<a>x</a>')
  })
})

describe('inline Type 1 content with tagfilter off', () => {
  it('preserves single-line script content, including under forceInline, which wraps the document in a span without dropping the script body', () => {
    expect(compiler('<script>x</script>', { tagfilter: false })).toBe(
      '<script>x</script>'
    )
    expect(
      compiler('<script>x</script>', { tagfilter: false, forceInline: true })
    ).toBe('<span><script>x</script></span>')
  })

  it('writes a textarea body, markup and references included, as written, which a browser shows as text', () => {
    expect(
      compiler('<textarea><b>x</b> &amp;</textarea>', { tagfilter: false })
    ).toBe('<textarea><b>x</b> &amp;</textarea>')
  })

  it('writes the body of a textarea written in capitals', () => {
    expect(
      compiler('<TEXTAREA>a &lt; b</TEXTAREA>', { tagfilter: false })
    ).toBe('<TEXTAREA>a &lt; b</TEXTAREA>')
  })
})

describe('component-like HTML blank-line nesting (#870)', () => {
  it('keeps blank-line content inside a PascalCase component', () => {
    expect(
      compiler(`<MyComponent>
## My header

Some paragraph
</MyComponent>`)
    ).toMatchInlineSnapshot(
      `"<MyComponent><h2 id="my-header">My header</h2><p>Some paragraph</p></MyComponent>"`
    )
  })
})

describe('prototype-slot reference labels (#900)', () => {
  it('renders [__proto__] and [constructor] without throwing', () => {
    expect(compiler('[__proto__]')).toBe('<p>[<strong>proto</strong>]</p>')
    expect(compiler('[constructor]')).toBe('<p>[constructor]</p>')
  })

  it('resolves __proto__ and constructor reference definitions', () => {
    expect(compiler('[__proto__]: /x\n\n[__proto__]')).toBe(
      '<p><a href="/x"><strong>proto</strong></a></p>'
    )
    expect(compiler('[constructor]: /y\n\n[constructor]')).toBe(
      '<p><a href="/y">constructor</a></p>'
    )
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
    expect(compiler(input)).toBe(expected)
    expect(compiler(input, { optimizeForStreaming: true })).toBe(expected)
  })
})

describe('enforceAtxHeadings (#903)', () => {
  it.each([
    [undefined, '#heading', '<p>#heading</p>'],
    [true, '#heading', '<p>#heading</p>'],
    [false, '#heading', '<h1 id="heading">heading</h1>'],
    [undefined, '# heading', '<h1 id="heading">heading</h1>'],
    [true, '# heading', '<h1 id="heading">heading</h1>'],
    [false, '# heading', '<h1 id="heading">heading</h1>'],
    [undefined, 'foo\n#bar', '<p>foo\n#bar</p>'],
    [true, 'foo\n#bar', '<p>foo\n#bar</p>'],
    [false, 'foo\n#bar', '<div><p>foo</p><h1 id="bar">bar</h1></div>'],
    [false, '#######x', '<p>#######x</p>'],
    [undefined, 'a<span>#</span>b', '<p>a<span>#</span>b</p>'],
    [false, 'a<span>#</span>b', '<p>a<span>#</span>b</p>'],
    [undefined, '<div>\n#x\n</div>', '<div>\n#x\n</div>'],
    [false, '<div>\n#x\n</div>', '<div>\n#x\n</div>'],
  ])('with enforceAtxHeadings %j renders %j as %j', (enforceAtxHeadings, input, expected) => {
    expect(compiler(input, { enforceAtxHeadings })).toBe(expected)
  })
})

describe('attribute names a renderer acts on rather than writes', () => {
  it('writes a name that ends in a colon as written', () => {
    expect(compiler('<span a:="1">b</span>')).toBe(
      '<p><span a:="1">b</span></p>'
    )
  })

  it('removes an object children value from a registered tag', () => {
    expect(
      compiler('<Foo children={{"a":1}}>y</Foo>', {
        overrides: { Foo: { props: {} } },
      })
    ).toBe('<Foo >y</Foo>')
  })

  it.each([
    ['<div innerHTML="x<img src=x onerror=alert(1)>">y</div>', '<div >y</div>'],
    [
      '<div prop:innerHTML="x<img src=x onerror=alert(1)>">y</div>',
      '<div >y</div>',
    ],
    ['<div attr:onclick="alert(1)">y</div>', '<div >y</div>'],
    ['<a attr:href="javascript:alert(1)">y</a>', '<p><a>y</a></p>'],
    ['<a prop:href="javascript:alert(1)">y</a>', '<p><a>y</a></p>'],
    [
      '<svg><a xlinkHref="javascript:alert(1)"><text>y</text></a></svg>',
      '<p><svg><a><text>y</text></a></svg></p>',
    ],
    ['<div ref="x">y</div>', '<div >y</div>'],
    ['<div ref={{"current":1}}>y</div>', '<div >y</div>'],
    [
      '<div dangerouslySetInnerHTML={{"__html":"<img src=x onerror=alert(1)>"}}></div>',
      '<div ></div>',
    ],
    ['<img children="z" src="/x">', '<img src="/x">'],
    ['<pre><b>x</b></pre>', '<pre><b>x</b></pre>'],
    ['<div><pre>a</pre></div>', '<div><pre>a</pre></div>'],
    ['<Foo ref="x">y</Foo>', '<Foo >y</Foo>'],
    ['<Foo children="x">y</Foo>', '<Foo >y</Foo>'],
    ['<Foo children={{"a":1}} />', '<Foo ></Foo>'],
    [
      '![" onclick=alert(1)>](/x)',
      '<p><img src="/x" alt="&quot; onclick=alert(1)&gt;" /></p>',
    ],
    ['<Foo innerHTML={x}>y</Foo>', '<Foo >y</Foo>'],
  ])('renders %j as %j', (input, expected) => {
    expect(compiler(input)).toBe(expected)
  })

  it('drops a brace value holding markup from a self-closing tag while streaming', () => {
    expect(
      compiler(
        '<A dangerouslySetInnerHTML={{__html: "<img src=x onerror=alert(1)>"}} />',
        { optimizeForStreaming: true }
      )
    ).toBe('<A ></A>')
  })
})

describe('an SVG animation aimed at a URL or handler attribute', () => {
  it.each([
    [
      '<svg><a><set attributeName="href" to="javascript:alert(1)"/><rect/></a></svg>',
      '<p><svg><a><set to="javascript:alert(1)"/><rect/></a></svg></p>',
    ],
    [
      '<svg><a><animate attributeName="href" values="javascript:alert(1)"/></a></svg>',
      '<p><svg><a><animate values="javascript:alert(1)"/></a></svg></p>',
    ],
    [
      '<svg><a><set attributeName="&#104;ref" to="javascript:alert(1)"/></a></svg>',
      '<p><svg><a><set to="javascript:alert(1)"/></a></svg></p>',
    ],
    [
      '<svg><a><set attributename=" HREF " to="javascript:alert(1)"/></a></svg>',
      '<p><svg><a><set to="javascript:alert(1)"/></a></svg></p>',
    ],
    [
      '<svg><a><animate attributeName="xlink:href" to="javascript:alert(1)"/></a></svg>',
      '<p><svg><a><animate to="javascript:alert(1)"/></a></svg></p>',
    ],
    [
      '<svg><a><set attributeName="&#111;nclick" to="alert(1)"/></a></svg>',
      '<p><svg><a><set to="alert(1)"/></a></svg></p>',
    ],
    [
      'x <svg><a><set attributeName="href" to="javascript:alert(1)"/></a></svg>',
      '<p>x <svg><a><set to="javascript:alert(1)"/></a></svg></p>',
    ],
    [
      '<svg>\n<a>\n<set attributeName="href" to="javascript:alert(1)"/>\n</a>\n</svg>',
      '<svg><a>\n<set to="javascript:alert(1)"/>\n</a>\n</svg>',
    ],
    [
      '<svg><Set attr:attributeName="href" to="javascript:alert(1)"/></svg>',
      '<p><svg><Set to="javascript:alert(1)"/></svg></p>',
    ],
    [
      '<svg><a><set attributeName={href} to="javascript:alert(1)"/></a></svg>',
      '<p><svg><a><set to="javascript:alert(1)"/></a></svg></p>',
    ],
    [
      '<svg><a><set attributeName={"href"} to="javascript:alert(1)"/></a></svg>',
      '<p><svg><a><set to="javascript:alert(1)"/></a></svg></p>',
    ],
    [
      '<svg><Set attributeName={x} to="y"/></svg>',
      '<p><svg><Set attributeName={x} to="y"/></svg></p>',
    ],
    [
      '<svg><rect><animate attributeName="opacity" values="0;1"/></rect></svg>',
      '<p><svg><rect><animate attributeName="opacity" values="0;1"/></rect></svg></p>',
    ],
  ])('renders %j as %j', (input, expected) => {
    expect(compiler(input)).toBe(expected)
  })
})

describe('a brace value on a URL attribute of a component-like tag', () => {
  const overrides = { Btn: { props: {} } }

  it.each([
    ['<Btn action={javascript:alert(1)}>x</Btn>', '<Btn >x</Btn>'],
    ['<Btn href={java&#115;cript:alert(1)}>x</Btn>', '<Btn >x</Btn>'],
    ['<Btn src={ javascript:alert(1)}>x</Btn>', '<Btn >x</Btn>'],
    ['<my-btn action={javascript:alert(1)}>x</my-btn>', '<my-btn >x</my-btn>'],
    ['<Btn srcDoc={"<script>alert(1)</script>"}>x</Btn>', '<Btn >x</Btn>'],
    ['<Btn attributeName={href}>x</Btn>', '<Btn >x</Btn>'],
    [
      '<Btn attributeName={opacity}>x</Btn>',
      '<Btn attributeName={opacity}>x</Btn>',
    ],
    ['<Btn href={link}>x</Btn>', '<Btn href={link}>x</Btn>'],
    ['<Btn data={{"a":1}}>x</Btn>', '<Btn data={{"a":1}}>x</Btn>'],
    ['<Btn src={["a"]}>x</Btn>', '<Btn src={["a"]}>x</Btn>'],
  ])('renders %j as %j, registered or not', (input, expected) => {
    expect(compiler(input)).toBe(expected)
    expect(compiler(input, { overrides })).toBe(expected)
  })
})

describe('a brace handler on a capitalized tag', () => {
  it.each([
    ['<Btn onClick={go}>x</Btn>', '<Btn >x</Btn>'],
    ['<Btn onClick={() => go()}>x</Btn>', '<Btn >x</Btn>'],
    ['<Btn onClick={() => x > 1}>x</Btn>', '<Btn >x</Btn>'],
    ['<Img src=x onerror={steal()}>', '<Img src=x>'],
    ['<Btn attr:onclick={go}>x</Btn>', '<Btn >x</Btn>'],
    [
      '<Btn onClick={go} style={{ a: 1 }}>x</Btn>',
      '&lt;Btn onClick={go} style={{ a: 1 }}>x</Btn>',
    ],
    [
      '<div><Btn onClick={go} style={{ a: 1 }}>x</Btn></div>',
      '<div>&lt;Btn onClick={go} style={{ a: 1 }}>x</Btn></div>',
    ],
    ['a <Btn onClick={go} style={{ a: 1 }}>x</Btn>', '<p>a <Btn>x</Btn></p>'],
    [
      '<Btn onclick={a} x={ onclick={b} }>y</Btn>',
      '&lt;Btn onclick={a} x={ onclick={b} }>y</Btn>',
    ],
    [
      '<div><Btn onclick={a} x={ onclick={b} }>y</Btn></div>',
      '<div>&lt;Btn onclick={a} x={ onclick={b} }>y</Btn></div>',
    ],
    ['<Btn onClick>x</Btn>', '<Btn >x</Btn>'],
    ['<Img onerror>', '<Img >'],
    ['<my-widget online>x</my-widget>', '<my-widget >x</my-widget>'],
    ['<Btn onClick={[1]}>x</Btn>', '<Btn >x</Btn>'],
  ])('writes %j as %j when `overrides` does not register the tag', (input, expected) => {
    expect(compiler(input)).toBe(expected)
  })

  it.each([
    ['<Btn onClick={go}>x</Btn>', '<Btn >x</Btn>'],
    [
      '<Btn onClick={go} style={{ a: 1 }}>x</Btn>',
      '<Btn style={{ a: 1 }}>x</Btn>',
    ],
  ])('writes %j as %j when `overrides` registers the tag, since a browser runs the handler', (input, expected) => {
    expect(compiler(input, { overrides: { Btn: { props: {} } } })).toBe(
      expected
    )
  })
})

describe('a capitalized tag an override matches is a component, and every other tag is HTML', () => {
  it.each(
    ['Card', 'CARD', 'CaRd'].flatMap(tag =>
      ['Card', 'card', 'CARD'].map(key => [tag, key])
    )
  )('renders <%s> with the component a %j key names', (tag, key) => {
    expect(
      compiler(`a <${tag} data={[1]}>x</${tag}>`, {
        overrides: { [key]: { component: 'aside' } },
      })
    ).toBe('<p>a <aside data={[1]}>x</aside></p>')
  })

  it('renders <card> as HTML against a `Card` key', () => {
    expect(
      compiler('a <card data={[1]}>x</card>', {
        overrides: { Card: { component: 'aside' } },
      })
    ).toBe('<p>a <card data={[1]}>x</card></p>')
  })

  it.each([
    [
      '<Card data={[1]} title="t" onClick={go}>x</Card>',
      '<Card data={[1]} title="t">x</Card>',
    ],
    [
      '<div><Card data={[1]} title="t" onClick={go}>x</Card></div>',
      '<div><Card data={[1]} title="t">x</Card></div>',
    ],
    [
      'a <Card data={[1]} title="t" onClick={go}>x</Card> b',
      '<p>a <Card data={[1]} title="t">x</Card> b</p>',
    ],
  ])('writes the unmatched capitalized tag in %j as HTML: %j', (input, expected) => {
    expect(compiler(input)).toBe(expected)
    expect(compiler(input, { overrides: { Other: 'b' } })).toBe(expected)
  })

  it('strips a brace handler from a lowercase tag an override restyles', () => {
    expect(
      compiler('x <a href="/" onclick={alert(1)}>y</a>', {
        overrides: { a: { props: { class: 'x' } } },
      })
    ).toBe('<p>x <a href="/" class="x">y</a></p>')
  })

  const widget = { 'my-widget': { props: {} } }
  const renamed = '<p>x <b href="/">y</b></p>'
  const handBuiltLink: MarkdownToJSX.ASTNode[] = [
    {
      attrs: { href: '/', onclick: 'alert(1)' },
      tag: 'a',
      type: RuleType.htmlSelfClosing,
    },
  ]
  const handBuiltText: MarkdownToJSX.ASTNode[] = [
    {
      attrs: { children: 't', onclick: 'alert(1)' },
      tag: 'span',
      type: RuleType.htmlSelfClosing,
    },
  ]
  const handBuiltBlock = (tag: string): MarkdownToJSX.ASTNode[] => [
    {
      attrs: { onclick: 'alert(1)' },
      children: [{ text: 'x', type: RuleType.text }],
      tag,
      type: RuleType.htmlBlock,
    },
  ]

  it.each([
    [
      'x <a href="/" onclick="alert(1)">y</a>',
      { a: { component: 'b' } },
      renamed,
    ],
    [
      'x <a href="/" onclick={alert(1)}>y</a>',
      { a: { component: 'b' } },
      renamed,
    ],
    ['x <a href="/" onclick>y</a>', { a: { component: 'b' } }, renamed],
    [
      'x <a href="/" onclick="alert(1)">y</a>',
      { a: { props: { class: 'x' } } },
      '<p>x <a href="/" class="x">y</a></p>',
    ],
    [
      'x <a href="/" onclick={alert(1)}>y</a>',
      { a: 'span' },
      '<p>x <span href="/">y</span></p>',
    ],
    [
      'x <img src="/x.png" onerror="alert(1)"> y',
      { img: { props: {} } },
      '<p>x <img src="/x.png"> y</p>',
    ],
    [
      '<my-widget onclick={alert(1)}>x</my-widget>',
      widget,
      '<my-widget >x</my-widget>',
    ],
    [
      '<my-widget onclick="alert(1)">x</my-widget>',
      widget,
      '<my-widget >x</my-widget>',
    ],
    [
      'a <my-widget onclick={alert(1)}>x</my-widget>',
      widget,
      '<p>a <my-widget>x</my-widget></p>',
    ],
    [
      'a <my-widget onclick="alert(1)">x</my-widget>',
      widget,
      '<p>a <my-widget>x</my-widget></p>',
    ],
    [
      '<div>\n<my-widget onclick={alert(1)}>x</my-widget>\n</div>',
      widget,
      '<div><my-widget >x</my-widget>\n</div>',
    ],
    [
      '<div>\n<my-widget onclick="alert(1)">x</my-widget>\n</div>',
      widget,
      '<div><my-widget >x</my-widget>\n</div>',
    ],
    [
      'x <a href="/" onclick={alert(1)}>y</a>',
      undefined,
      '<p>x <a href="/">y</a></p>',
    ],
    ['<Btn onClick={go}>x</Btn>', { Btn: { props: {} } }, '<Btn >x</Btn>'],
    [handBuiltLink, undefined, '<a href="/" />'],
    [handBuiltLink, { a: { component: 'b' } }, '<b href="/" />'],
    [handBuiltText, undefined, '<span>t</span>'],
    [handBuiltBlock('div'), undefined, '<div>x</div>'],
    [handBuiltBlock('my-widget'), widget, '<my-widget>x</my-widget>'],
    [
      storedAST('x <a href="/" onclick="alert(1)">y</a>', { a: { props: {} } }),
      { a: { props: {} } },
      '<p>x <a href="/">y</a></p>',
    ],
    [
      storedAST('x <a href="/" onclick={alert(1)}>y</a>', {
        a: { component: 'b' },
      }),
      { a: { component: 'b' } },
      renamed,
    ],
    [
      storedAST('a <my-widget onclick="alert(1)">x</my-widget>', widget),
      widget,
      '<p>a <my-widget>x</my-widget></p>',
    ],
    [
      storedAST('<my-widget onclick={alert(1)}>x</my-widget>', widget),
      widget,
      '<my-widget>x</my-widget>',
    ],
    [
      storedAST('<my-widget onclick={alert(1)}>x</my-widget>'),
      undefined,
      '<my-widget>x</my-widget>',
    ],
    [
      storedAST('<div>\n<my-widget onclick="alert(1)">x</my-widget>\n</div>'),
      undefined,
      '<div><my-widget>x</my-widget></div>',
    ],
    [
      storedAST('<div><img src=x onerror="alert(1)"></div>'),
      undefined,
      '<div><img src="x"></div>',
    ],
    [
      storedAST('x <a href="/" onclick="alert(1)">y</a>'),
      undefined,
      '<p>x <a href="/">y</a></p>',
    ],
    [
      storedAST('<Btn onClick={go}>x</Btn>', { Btn: { props: {} } }),
      { Btn: { props: {} } },
      '<Btn>x</Btn>',
    ],
  ])('writes %j with %j as %j', (input, overrides, expected) => {
    if (typeof input === 'string') {
      expect(compiler(input, { overrides })).toBe(expected)
      return
    }
    expect(astToHTML(input, { overrides })).toBe(expected)
  })

  it('writes the attributes of a hand-built code block without its handler', () => {
    const ast = parser('```js\nx\n```')
    Object.assign(ast[0], { attrs: { 'data-x': 'y', onclick: 'alert(1)' } })
    expect(astToHTML(ast)).toBe(
      '<pre><code data-x="y" class="language-js">x</code></pre>'
    )
  })

  it('gives renderRule the handler of a lowercase tag an override matches, as written', () => {
    const seen: unknown[] = []
    const html = compiler(
      'x <a href="/" onclick={alert(1)}>y</a> <a onclick="go()">z</a>',
      {
        overrides: { a: { component: 'b' } },
        renderRule(next, node) {
          if (node.type === RuleType.htmlBlock && node.tag === 'a') {
            seen.push(node.attrs?.onclick)
          }
          return next()
        },
      }
    )
    expect(seen).toEqual(['{alert(1)}', 'go()'])
    expect(html).toBe('<p>x <b href="/">y</b> <b>z</b></p>')
  })
})

describe('a filtered tag after raw markup', () => {
  it.each([
    '<!-- c -->',
    '<?php x ?>',
    '<!DOCTYPE html>',
    '<![CDATA[x]]>',
  ])('filters what follows %j and keeps the markup', markup => {
    expect(compiler(`${markup} <script>alert(1)</script>`)).toBe(
      `${markup} &lt;script>alert(1)&lt;/script>`
    )
    expect(compiler(`${markup} <iframe src=x></iframe>`)).toBe(
      `${markup} &lt;iframe src=x>&lt;/iframe>`
    )
    expect(compiler(`${markup} <STYLE>*{}</STYLE>`)).toBe(
      `${markup} &lt;STYLE>*{}&lt;/STYLE>`
    )
    expect(compiler(`- ${markup} <title>x</title>`)).toBe(
      `<ul><li>${markup} &lt;title>x&lt;/title></li></ul>`
    )
  })

  it.each([
    ['<!--> <xmp>', '<!--> &lt;xmp>'],
    ['<!---> <xmp>', '<!---> &lt;xmp>'],
    ['<!-- a --!> <xmp> -->', '<!-- a --!> &lt;xmp> -->'],
    ['a <!-- b --!><xmp>c -->', '<p>a <!-- b --!>&lt;xmp>c --></p>'],
    ['<?x > <xmp> ?>', '<?x > &lt;xmp> ?>'],
    ['<!X a> <xmp>', '<!X a> &lt;xmp>'],
    ['<![CDATA[ > <xmp> ]]>', '<![CDATA[ > &lt;xmp> ]]>'],
    ['a <?x > <xmp> ?>', '<p>a <?x > &lt;xmp> ?></p>'],
    ['<!-- <script> -->', '<!-- &lt;script> -->'],
    ['<!-- <script>', '<!-- &lt;script>'],
    ['a <!-- <xmp> --> b', '<p>a <!-- &lt;xmp> --> b</p>'],
    ['<? <xmp ?>', '<? &lt;xmp ?>'],
    ['<!-- a --> b', '<!-- a --> b'],
  ])('renders %j as %j', (input, expected) => {
    expect(compiler(input)).toBe(expected)
  })

  it.each([
    ['<!-- c --> <script>alert(1)</script>'],
    ['<?x > <xmp> ?>'],
    ['<!-- <script> -->'],
    ['<div x={a><script>alert(1)</script>}>y</div>'],
    ['<Foo x={a><script>}>'],
  ])('leaves %j as written with tagfilter off', input => {
    expect(compiler(input, { tagfilter: false })).toBe(input)
  })
})

describe('a filtered tag after an earlier block leaves a browser reading something else', () => {
  it.each([
    [
      '<p><? a\n\n<!-- x><script>alert(1)</script>',
      '<div><p><? a\n<!-- x>&lt;script>alert(1)&lt;/script></div>',
    ],
    [
      '<p><? a\n\n<!-- x><script>alert(1)</script> -->',
      '<div><p><? a\n<!-- x>&lt;script>alert(1)&lt;/script> --></div>',
    ],
    [
      '<p><? a\n\n<div title="x><script>alert(1)</script>">body</div>',
      '<div><p><? a\n<div title="x>&lt;script>alert(1)&lt;/script>">body</div></div>',
    ],
    [
      '<p><? a\n\n<Comp title="x><script>alert(1)</script>" />',
      '<div><p><? a\n<Comp title="x>&lt;script>alert(1)&lt;/script>" ></Comp></div>',
    ],
    [
      '<p><? a\n\n<br title="x><script>alert(1)</script>">',
      '<div><p><? a\n<br title="x>&lt;script>alert(1)&lt;/script>"></div>',
    ],
    [
      '<p><!-- a\n\nb <b title="--><script>alert(1)</script>">c</b>',
      '<div><p><!-- a\n<p>b <b title="-->&lt;script>alert(1)&lt;/script>">c</b></p></div>',
    ],
    [
      '<p><!-- a\n\nb <br title="--><script>alert(1)</script>"> c',
      '<div><p><!-- a\n<p>b <br title="-->&lt;script>alert(1)&lt;/script>"> c</p></div>',
    ],
    [
      '<p><svg><![CDATA[ a\n\nb <!-- ]]><script>alert(1)</script> --> c',
      '<div><p><svg><![CDATA[ a\n<p>b <!-- ]]>&lt;script>alert(1)&lt;/script> --> c</p></div>',
    ],
    [
      '<p><noscript>\n\n<!-- </noscript><script>alert(1)</script>',
      '<div><p><noscript>\n<!-- </noscript>&lt;script>alert(1)&lt;/script></div>',
    ],
  ])('renders %j as %j', (input, expected) => {
    expect(compiler(input)).toBe(expected)
  })

  it.each([
    [
      '<!-- x><script>alert(1)</script> -->',
      '<!-- x><script>alert(1)</script> -->',
    ],
    [
      '<div title="x><script>alert(1)</script>">body</div>',
      '<div title="x><script>alert(1)</script>">body</div>',
    ],
    [
      '<br title="x><script>alert(1)</script>">',
      '<br title="x><script>alert(1)</script>">',
    ],
    [
      'a <br title="x><script>alert(1)</script>"> b',
      '<p>a <br title="x><script>alert(1)</script>"> b</p>',
    ],
  ])('renders %j as %j with tagfilter off', (input, expected) => {
    expect(compiler(input, { tagfilter: false })).toBe(expected)
  })
})

describe('a filtered tag past where a browser ends an open tag', () => {
  it.each([
    [
      '<div x={a><script>alert(1)</script>}>y</div>',
      '<div x={a>&lt;script>alert(1)&lt;/script>}>y</div>',
    ],
    ['<div x={a><script>}>', '<div x={a>&lt;script>}>'],
    ['p <div x={a><script>}>', '<p>p <div x={a>&lt;script>}></p>'],
    [
      'p <span x={a><script>}>y</span>',
      '<p>p <span x={a>&lt;script>}>y</span></p>',
    ],
    ['p <span x={a><iframe>}/>', '<p>p <span x={a>&lt;iframe>}/></p>'],
    ['<Foo x={a><script>}>', '<Foo x={a>&lt;script>}>'],
    ['<div x="<script>">y</div>', '<div x="&lt;script>">y</div>'],
    ['<div x={"<script>"}>y</div>', '<div x={"&lt;script>"}>y</div>'],
    [
      'p <span x="<script>">y</span>',
      '<p>p <span x="&lt;script>">y</span></p>',
    ],
    ['<div x={a<script}>y</div>', '<div x={a<script}>y</div>'],
  ])('renders %j as %j', (input, expected) => {
    expect(compiler(input)).toBe(expected)
  })
})

describe('deeply nested same-tag openers', () => {
  it.each([
    ['<div>\n\n</div>', '<div></div>'],
    ['<div>\n\n</DIV >', '<div></div>'],
    ['<div>\n \n\t</div>\nb', '<div><div></div><p>b</p></div>'],
    ['<div>\n\n</divx>\n\n</div>', '<div><div></divx>\n</div></div>'],
    ['<div>\n\n</divx>', '<div><div></divx></div>'],
    [
      '<div>\n\n<span>a</span>\n\n</div>',
      '<div><div><p><span>a</span></p></div></div>',
    ],
    ['<div>\n\n<div>a</div>\n\n</div>', '<div><div><div>a</div></div></div>'],
    ['<div>\n\n<div>\n\n</div>\n\n</div>', '<div><div><div></div></div></div>'],
    ['<div>\n\n<div>\n\n', '<div><div><div></div>'],
    ['<div>\n<div>\n</div>\n</div>', '<div><div>\n</div>\n</div>'],
    ['<div>\n\na\n\n</div>', '<div><p>a</p></div>'],
    ['<Foo>\n\n<b>a</b>\n\n</Foo>', '<div><Foo><p><b>a</b></p></Foo></div>'],
  ])('renders %j as %j', (input, expected) => {
    expect(compiler(input)).toBe(expected)
  })
})

describe('a closer search with a Type 1 tag ahead', () => {
  it.each([
    [
      '<div>\nx\n\ny\n</div>\n<pre>a</pre>',
      '<div><div><p>x</p><p>y</p></div><pre>a</pre></div>',
    ],
    [
      '<div>\nx\n\n<pre>a</pre>\n\n</div>',
      '<div><div>x\n<pre>a</pre></div></div>',
    ],
    ['<div>\nx\n\n</pre></div>', '<div><p>x</p></pre></div>'],
    ['<div>\nx\n\n<prefix></div>', '<div><p>x</p><prefix></div>'],
    [
      '<div>\nx\n\n<div title="</div><pre>">\ny\n',
      '<div><div>x\n<div title="</div><pre>">y\n</div>',
    ],
    [
      '<div>\nx\n\n<divx title="</div><pre>">y</divx>\n</div>\nz',
      '<div><div>x\n<p><divx title="</div><pre>">y</divx></p></div>\nz</div>',
    ],
    [
      '<Foo>\nx\n\n<Foo a={</Foo><pre>}>\ny\n\nz',
      '<div><Foo>x\n<Foo a={</Foo><pre>}>y\n<p>z</p></div>',
    ],
    [
      '<Foo>\nx\n\n<Bar a="</Foo><style>">\ny\n\nz',
      '<div><Foo><p>x</p><p>&lt;Bar a=&quot;</p></Foo>&lt;style>">\ny\n\nz</div>',
    ],
    [
      '<div>\nx\n\ny</div <pre>\nz',
      '<div><div><p>x</p><p>y</p></div><p>z</p></div>',
    ],
    [
      '<div>\nx\n\ny</div<pre>\nz',
      '<div><div>x\n<p>y&lt;/div<pre>\nz</p></div>',
    ],
    [
      '<div>\nx\n\ny</div\n<pre\nq>\nz',
      '<div><div><p>x</p><p>y</p></div><p>z</p></div>',
    ],
  ])('renders %j as %j', (input, expected) => {
    expect(compiler(input)).toBe(expected)
  })
})

describe('a closer search after a failed one', () => {
  it.each([
    [
      '<div>\nx\n\n<div>\ny\n\nz\n</div>',
      '<div><div>x\n<div><p>y</p><p>z</p></div></div>',
    ],
    [
      '<div>\nx\n\n<div>\ny\n\nz\n</div>\n</div>',
      '<div><p>x</p><div><p>y</p><p>z</p></div></div>',
    ],
    ['x <b>a<b>c</b>d', '<p>x <b>a<b>c</b>d</p>'],
    ['x <b>a</b><b>c', '<p>x <b>a</b><b>c</p>'],
    ['*<div><div>*</div>', '<p>*<div><div>*</div></p>'],
    [
      '<div><div>\n\n<div>\n\nx</div>',
      '<div><div><div>\n<div><p>x</p></div></div>',
    ],
    ['<div>x\n\n<div>\n\n</div></section>', '<div><div>x\n<div></div></div>'],
    ['*<b>a* <b>c</b>', '<p><em><b>a</em> <b>c</b></p>'],
    ['<b>a <b>c</b>', '<p><b>a <b>c</b></p>'],
    [
      '<div>\nx\n\n<pre>\n</pre>\n\n<div>\ny\n\nz\n</div>',
      '<div><div>x\n<pre></pre><div><p>y</p><p>z</p></div></div>',
    ],
    [
      '<div>\nx\n\n<div a="<pre>">\ny\n\nz\n</div>\n<pre>',
      '<div><div>x\n<div a="<pre>"><p>y</p><p>z</p></div><pre></div>',
    ],
    [
      '<div>\nx\n\n<div a="</div><pre>">\ny\n\nz\n</div>\n<pre>',
      '<div><div>x\n<div a="</div><pre>"><p>y</p><p>z</p></div><pre></div>',
    ],
    ['*<b a="</b>* c', '<p><em>&lt;b a=&quot;</b></em> c</p>'],
    [
      '<section>\nx\n\n<p>\ny\n\n</section>\n\n<section>\nz\n\nw\n</section>',
      '<div><section><p>x</p><p>y\n</section><section><p>z</p><p>w</p></section></div>',
    ],
    [
      '<div>\n \n<span>x</span>\n\n</div>',
      '<div><div><p><span>x</span></p></div></div>',
    ],
    [
      '<div>\n\f\n<span>x</span>\n\n</div>',
      '<div><p>\f\n<span>x</span></p></div>',
    ],
    [
      '<div>\n\v\n<span>x</span>\n\n</div>',
      '<div><p>\v\n<span>x</span></p></div>',
    ],
  ])('renders %j as %j', (input, expected) => {
    expect(compiler(input)).toBe(expected)
  })
})

describe('the end of a Type 1 block', () => {
  it.each([
    [
      '<pre>a</style>b\nc\n\nd</pre>',
      '<div><pre>a&lt;/style>b<p>c</p><p>d</pre></p></div>',
    ],
    [
      '<pre>a</PRE >b\n\nc</SCRIPT>d\n\ne',
      '<div><pre>a</PRE >b\n\nc&lt;/SCRIPT>d<p>e</p></div>',
    ],
    ['<pre>a\n\nb', '<pre>a\n\nb'],
    [
      '<pre>a</pre>\n<style>b</style>\n\nc',
      '<div><pre>a</pre>&lt;style>b&lt;/style><p>c</p></div>',
    ],
  ])('renders %j as %j', (input, expected) => {
    expect(compiler(input)).toBe(expected)
  })
})

describe('inline markup with no terminator', () => {
  it.each([
    [
      '[a<!-- b](/u) [c<!-- d](/v)',
      '<p><a href="/u">a&lt;!-- b</a> <a href="/v">c&lt;!-- d</a></p>',
    ],
    ['[a<!-- b](/u) <!-- c -->', '<p>[a<!-- b](/u) <!-- c --></p>'],
    ['[<!-- a](/u) -->', '<p>[<!-- a](/u) --></p>'],
    ['x <!-- a <!-- b', '<p>x &lt;!-- a &lt;!-- b</p>'],
    ['x <? a <? b', '<p>x &lt;? a &lt;? b</p>'],
    ['x <![CDATA[ a <![CDATA[ b', '<p>x &lt;![CDATA[ a &lt;![CDATA[ b</p>'],
    ['x <!A a <!B b', '<p>x &lt;!A a &lt;!B b</p>'],
    [
      'x <!-- a\n\ny <!-- b -->',
      '<div><p>x &lt;!-- a</p><p>y <!-- b --></p></div>',
    ],
    ['[<? a](/u) <? b ?>', '<p><a href="/u">&lt;? a</a> <? b ?></p>'],
    ['x <!-- a <? b ?>', '<p>x &lt;!-- a <? b ?></p>'],
  ])('renders %j as %j', (input, expected) => {
    expect(compiler(input)).toBe(expected)
  })
})

describe('a children attribute on a tag with an override, where an element with no content of its own takes the value as text and the attribute is never written', () => {
  const card = { card: { component: 'i' } }

  it.each([
    [
      'a capitalized self-closing tag',
      '<Card children="z" />',
      card,
      '<i >z</i>',
    ],
    [
      'a self-closing tag with a trailing newline',
      '<Card children="z" />\n',
      card,
      '<i >z</i>',
    ],
    [
      'a self-closing tag between blocks',
      'a\n\n<Card children="z" />\n\nb',
      card,
      '<div><p>a</p><i >z</i><p>b</p></div>',
    ],
    [
      'a self-closing tag inside a paragraph',
      'x <Card children="z" /> y',
      card,
      '<p>x <i >z</i> y</p>',
    ],
    [
      'a lowercase self-closing tag',
      '<card children="z" />',
      card,
      '<i >z</i>',
    ],
    [
      'a lowercase self-closing tag when the override is inherited',
      '<card children="z" />',
      Object.create(card),
      '<i >z</i>',
    ],
    [
      'an uppercase self-closing tag',
      '<CARD children="z" />',
      card,
      '<i >z</i>',
    ],
    [
      'a hyphenated self-closing tag',
      '<my-el children="z" />',
      { 'my-el': { component: 'i' } },
      '<i >z</i>',
    ],
    [
      'a hyphenated empty pair',
      '<my-el children="z"></my-el>',
      { 'my-el': { component: 'i' } },
      '<i >z</i>',
    ],
    [
      'a hyphenated empty pair kept as written',
      '<my-el children="z"></my-el>',
      { 'my-el': { props: {} } },
      '<my-el >z</my-el>',
    ],
    [
      'a lowercase empty pair',
      '<card children="z"></card>',
      card,
      '<p><i>z</i></p>',
    ],
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
      '<i >z</i>',
    ],
    [
      'a capitalized empty pair inside a paragraph',
      'x <Card children="z"></Card> y',
      card,
      '<p>x <i>z</i> y</p>',
    ],
    [
      'a registered tag kept as written',
      '<Card children="z" />',
      { Card: { props: {} } },
      '<Card >z</Card>',
    ],
    [
      'another attribute beside it',
      '<Card children="z" title="t" />',
      card,
      '<i title="t">z</i>',
    ],
    [
      'an attribute name in uppercase',
      '<Card CHILDREN="z" />',
      card,
      '<i >z</i>',
    ],
    [
      'a value read as text, with its entity and markup escaped',
      '<Card children="a &amp; <b>" />',
      card,
      '<i >a &amp;amp; &lt;b&gt;</i>',
    ],
    ['a brace value', '<Card children={x} />', card, '<i >x</i>'],
    [
      'a quoted brace value',
      '<Card children={"q"} />',
      card,
      '<i >&quot;q&quot;</i>',
    ],
    ['a bare name, which holds no text', '<Card children />', card, '<i ></i>'],
    [
      'an object value, which no element can hold',
      '<Card children={{"a":1}} />',
      card,
      '<i ></i>',
    ],
    [
      'a Solid-prefixed name, which is not children',
      '<Card attr:children="z" />',
      card,
      '<i ></i>',
    ],
    [
      'a void override',
      '<Card children="z" />',
      { card: { component: 'img' } },
      '<img >',
    ],
    [
      'a pair with content of its own',
      '<card children="z">inner</card>',
      card,
      '<p><i>inner</i></p>',
    ],
    [
      'a capitalized pair with content of its own, which the output passes through as written',
      '<Card children="z">inner</Card>',
      card,
      '<Card >inner</Card>',
    ],
    ['an unregistered tag', '<Card children="z" />', {}, '<Card ></Card>'],
    [
      'a lowercase tag no override names',
      '<card children="z" />',
      {},
      '<card ></card>',
    ],
    ['an unclosed tag', '<Card children="z">', card, '<i >z</i>'],
    [
      'an unclosed tag with a trailing newline',
      '<Card children="z">\n',
      card,
      '<i >z</i>',
    ],
    [
      'an unclosed tag between blocks, which closes before the next block',
      'a\n\n<Card children="z">\n\nb',
      card,
      '<div><p>a</p><i >z</i><p>b</p></div>',
    ],
    [
      'an unclosed tag with a void override',
      '<Card children="z">',
      { card: { component: 'img' } },
      '<img >',
    ],
    [
      'an unclosed pre block with content of its own',
      '<pre children="z">a',
      { pre: { props: {} } },
      '<pre >a',
    ],
    [
      'a value with markup characters and a run of spaces',
      '<Card children="a >  < b" />',
      card,
      '<i >a &gt;  &lt; b</i>',
    ],
    [
      'a value with a line break',
      '<Card children="a\nb" />',
      card,
      '<i >a\nb</i>',
    ],
    [
      'a value with a CRLF line break, read as a line feed',
      '<Card children="a\r\nb" />',
      card,
      '<i >a\nb</i>',
    ],
    [
      'a registered tag inside a raw block, which the output passes through without the attribute',
      '<div>\n<Card children="z" />\n</div>',
      card,
      '<div><Card  />\n</div>',
    ],
    [
      'a lowercase pair inside a raw block, which the output passes through without the attribute',
      '<div>\n<card children="z"></card>\n</div>',
      card,
      '<div><card ></card>\n</div>',
    ],
    [
      'a capitalized pair inside a raw block, which the output passes through without the attribute',
      '<div>\n<Card children="z"></Card>\n</div>',
      card,
      '<div><Card ></Card>\n</div>',
    ],
    [
      'a registered tag two raw blocks deep, which the output passes through without the attribute',
      '<div>\n<section>\n<Card children="z" />\n</section>\n</div>',
      card,
      '<div><section>\n<Card  />\n</section>\n</div>',
    ],
    [
      'a registered tag inside a raw block with a line after its closer, which the output passes through without the attribute',
      '<div>\n<card children="z"></card>\n</div>\ntail',
      card,
      '<div><card ></card>\n</div>\ntail',
    ],
    [
      'a pair with content of its own inside a raw block, which the output passes through without the attribute',
      '<div>\n<Card children="z">inner</Card>\n</div>',
      card,
      '<div><Card >inner</Card>\n</div>',
    ],
    [
      'a markup value inside a raw block, which the output passes through without the attribute',
      '<div>\n<Card children="<img src=x onerror=alert(1)>" />\n</div>',
      card,
      '<div><Card  />\n</div>',
    ],
    [
      'a value with markup characters and a run of spaces inside a raw block, which the output passes through without the attribute',
      '<div>\n<Card children="a >  < b" />\n</div>',
      card,
      '<div><Card  />\n</div>',
    ],
    [
      'a value with a line break inside a raw block, which the output passes through without the attribute',
      '<div>\n<Card children="a\nb" />\n</div>',
      card,
      '<div><Card  />\n</div>',
    ],
    [
      'a value with a CRLF line break inside a raw block, which the output passes through without the attribute',
      '<div>\r\n<Card children="a\r\nb" />\r\n</div>',
      card,
      '<div><Card  />\n</div>',
    ],
    [
      'a registered tag inside a pre block, which the output passes through without the attribute',
      '<pre>\n<Card children="z" />\n</pre>',
      card,
      '<pre><Card  /></pre>',
    ],
    [
      'does not take a built-in object property for an override',
      '<constructor children="z" />',
      {},
      '<constructor ></constructor>',
    ],
    [
      'writes a void override with no children',
      '<img children="z" src="/x">',
      { img: { props: { title: 't' } } },
      '<img src="/x" title="t">',
    ],
  ])('%s', (_title, input, overrides, expected) => {
    expect(compiler(input, { overrides })).toBe(expected)
  })
})

describe('code naming a filtered tag', () => {
  it.each([
    [{}],
    [{ disableParsingRawHTML: true }],
  ])('stays code with %j, as only the markdown output writes it differently', options => {
    expect(compiler('`<script>`', options)).toBe(
      '<p><code>&lt;script&gt;</code></p>'
    )
  })
})

describe('a URL that names a dangerous scheme', () => {
  it.each([
    [
      '[a](https://en.wikipedia.org/wiki/Javascript:_The_Good_Parts)',
      '<p><a href="https://en.wikipedia.org/wiki/Javascript:_The_Good_Parts">a</a></p>',
    ],
    [
      '<https://example.com/?q=javascript:x>',
      '<p><a href="https://example.com/?q=javascript:x">https://example.com/?q=javascript:x</a></p>',
    ],
    [
      '<a href="/docs/javascript:intro">x</a>',
      '<p><a href="/docs/javascript:intro">x</a></p>',
    ],
    [
      '[l](/[x](javascript:alert(1)))',
      '<p><a href="/%5Bx%5D(javascript:alert(1))">l</a></p>',
    ],
    ['[a](javascript:alert(1))', '<p><a>a</a></p>'],
    ['[a](feed:javascript:alert(1))', '<p><a>a</a></p>'],
  ])('writes %j as %j, by where a browser reads a scheme', (input, expected) => {
    expect(compiler(input)).toBe(expected)
  })
})

describe('markup a browser reads differently from the parser', () => {
  it.each([
    ['<!--><svg onload=alert(1)>', '<!--><svg >'],
    ['<?"><b onclick=alert(1)>b</b>', '<?"><b >b</b>'],
    [
      '<div>\n<!-- x\n\n<a title="--><img src=x onerror=alert(1)>">',
      '<div><div><!-- x\n<a ></div>',
    ],
    [
      '<!---><noscript><a title="</noscript><img src=x onerror=alert(1)>">',
      '<!---><noscript>&lt;a title="&lt;/noscript>&lt;img src=x onerror=alert(1)>">',
    ],
    [
      '<!-- x\n\n<a title="--><b y=\'">\n\n\' onclick=alert(1)>',
      '<div><!-- x\n\n&lt;a title="-->&lt;b y=\'">\n<p>\' onclick=alert(1)&gt;</p></div>',
    ],
    ['<a x="<b" y=z>', '<a x="<b" y=z>'],
    ["<div onclick='alert(1)'--!>", "&lt;div onclick='alert(1)'--!>"],
    ['<div onclick={alert(1)}<xmp>', '&lt;div onclick={alert(1)}&lt;xmp>'],
    [
      '<div x={a><img src=x onerror=alert(1)>}>\nhi\n</div>',
      '<div >\nhi\n</div>',
    ],
    [
      'p <span x={a><img src=x onerror=alert(1)>}>hi</span>',
      '<p>p <span>hi</span></p>',
    ],
    ['<pre><Img onclick={alert(1)}', '<pre>&lt;Img onclick={alert(1)}'],
    ['<div>\n<b onclick=alert(1)', '<div>&lt;b onclick=alert(1)'],
    [
      '```x onmouseover="alert(1)"\ny\n```',
      '<pre><code class="language-x">y</code></pre>',
    ],
    [
      '```x style="color:red"\ny\n```',
      '<pre><code style="color: red" class="language-x">y</code></pre>',
    ],
    [
      '<iframe><img src=x onerror=alert(1)',
      '&lt;iframe>&lt;img src=x onerror=alert(1)',
    ],
    ['\\<svg onload=alert(1)>', '<p>&lt;svg onload=alert(1)&gt;</p>'],
    [
      '&lt;img src=x onerror=alert(1)&gt;',
      '<p>&lt;img src=x onerror=alert(1)&gt;</p>',
    ],
    [
      'a[^1]\n\n[^1]: javascript:alert(1)',
      '<p>a<a href="#1"><sup>1</sup></a></p><footer><div id="1">1: javascript:alert(1)</div></footer>',
    ],
    [
      'a[^1]\n\n[^1]: hi [x](javascript:alert(1))',
      '<p>a<a href="#1"><sup>1</sup></a></p><footer><div id="1">1: hi <a>x</a></div></footer>',
    ],
    [
      '![a](&amp;#106;avascript:alert(1))',
      '<p><img src="&amp;#106;avascript:alert(1)" alt="a" /></p>',
    ],
    ['[x](javascript:alert(1) "t")', '<p><a title="t">x</a></p>'],
    ['<!-- x -->İİİİİİİİİİ</pre><pre>', '<!-- x -->İİİİİİİİİİ</pre><pre>'],
    ['<span>[l](javascript:alert(1))</span>', '<p><span><a>l</a></span></p>'],
    ['x <javascript:alert(1)> y', '<p>x <a>javascript:alert(1)</a> y</p>'],
    [
      'x <span><javascript:alert(1)//\xa0></span>',
      '<p>x <span><a>javascript:alert(1)//\xa0</a></span></p>',
    ],
    [
      'x <span><JavaScript:alert&#40;1&#41;\u{2003}x></span>',
      '<p>x <span><a>JavaScript:alert&amp;#40;1&amp;#41;\u{2003}x</a></span></p>',
    ],
    [
      'x <span><a:b\xa0<javascript:alert(1)\u{2028}x></span>',
      '<p>x <span>&lt;a:b\xa0<a>javascript:alert(1)\u{2028}x</a></span></p>',
    ],
    [
      'x <span>[y <https:a\xa0](javascript:alert(1))></span>',
      '<p>x <span>[y <a>https:a\xa0](javascript:alert(1))</a></span></p>',
    ],
    [
      'x <span><javascript:a](<javascript:alert(1)>)></span>',
      '<p>x <span>&lt;javascript:a](<a>javascript:alert(1)</a>)&gt;</span></p>',
    ],
    [
      '[l](&amp;amp;#106;avascript:alert(1))',
      '<p><a href="&amp;amp;#106;avascript:alert(1)">l</a></p>',
    ],
    [
      '[l]: javascript&amp;amp;colon;alert(1)\n\n[l]',
      '<p><a href="javascript&amp;amp;colon;alert(1)">l</a></p>',
    ],
    ['[l](/a?b=1&amp;c=2)', '<p><a href="/a?b=1&amp;c=2">l</a></p>'],
    [
      '[l](&#106avascript:alert(1))',
      '<p><a href="&amp;#106avascript:alert(1)">l</a></p>',
    ],
    ['a\nb\n=', '<h1 id="ab">a\nb</h1>'],
    [
      '- [^1]: a )\n[^1]:&#106avascript:alert(1)',
      '<ul><li><a href="#1"><sup>1</sup></a>:&amp;#106avascript:alert(1)</li></ul><footer><div id="1">1: a )</div></footer>',
    ],
    ['<q> <b>x</b>', '<p><q> <b>x</b></p>'],
    ['&amp;copy; a &amp; b', '<p>&amp;copy; a &amp; b</p>'],
    [
      '\n﻿[^1]:javascript:alert(1)\n[^1]',
      '<p>﻿[^1]:javascript:alert(1)\n[^1]</p>',
    ],
    [
      '<title>a\n\n<!--</title>\n\n```\n<b>\n```',
      '<div>&lt;title><p>a</p><!--&lt;/title><pre><code>&lt;b&gt;</code></pre></div>',
    ],
    [
      '1. # [^1]\n[^1]:&#106avascript:alert(1)',
      '<ol><li><h1 id="1"><a href="#1"><sup>1</sup></a></h1></li></ol><footer><div id="1">1: &amp;#106avascript:alert(1)</div></footer>',
    ],
    [
      '1. a [^1]\n[^1]:&#106avascript:alert(1)',
      '<ol><li>a [^1]\n[^1]:&amp;#106avascript:alert(1)</li></ol>',
    ],
    [
      '1. <!-- c --> x\n[^1]:&#106avascript:alert(1)\n\n[^1]',
      '<div><ol><li><!-- c --> x</li></ol><p><a href="#1"><sup>1</sup></a></p><footer><div id="1">1: &amp;#106avascript:alert(1)</div></footer></div>',
    ],
    ['- <pre>x\ny</pre>', '<div><ul><li><pre>x</li></ul><p>y</pre></p></div>'],
    ['- <!-- x\ny -->', '<div><ul><li><!-- x</li></ul><p>y --&gt;</p></div>'],
    [
      '- <div\nonclick=alert(1)>x</div>',
      '<div><ul><li>&lt;div</li></ul><p>onclick=alert(1)&gt;x</div></p></div>',
    ],
    ['- a <div\nonclick=alert(1)>x</div>', '<ul><li>a <div>x</div></li></ul>'],
    ['- <x-y\nonclick=alert(1)>y</x-y>', '<ul><li><x-y>y</x-y></li></ul>'],
    ['- <Foo x="1\n2">y</Foo>', '<ul><li><Foo x="1\n2">y</Foo></li></ul>'],
    [
      '- ```\ny',
      '<div><ul><li><pre><code></code></pre></li></ul><p>y</p></div>',
    ],
    ['1. <x-y>x\ny', '<ol><li><x-y>x\ny</li></ol>'],
    [
      '1. [r]:\n/u "a\nb"\n\n   [r]',
      '<ol><li><p><a href="/u" title="a\nb">r</a></p></li></ol>',
    ],
    [
      '- <b>f</b><!-- c --><img\nsrc=x>z onclick=alert(1)',
      '<ul><li><b>f</b><!-- c --><img\nsrc=x>z onclick=alert(1)</li></ul>',
    ],
    [
      '- # h\na | b\n  --- | ---',
      '<div><ul><li><h1 id="h">h</h1></li></ul><table><thead><tr><th>a</th><th>b</th></tr></thead></table></div>',
    ],
    [
      '- - [^1]:\nz\n\n  [^1]',
      '<ul><li><ul><li></li></ul><p><a href="#1"><sup>1</sup></a></p></li></ul><footer><div id="1">1: z</div></footer>',
    ],
    ['[r]: a\\\nb\n\n[r]', '<div><p>b</p><p><a href="a%5C">r</a></p></div>'],
    ['[r]: a\\ "t"\n\n[r]', '<p><a href="a%5C" title="t">r</a></p>'],
    ['[r]: <a\\\nb>', '<p>[r]: &lt;a<br />\nb&gt;</p>'],
    ['[x](a\\\\)', '<p><a href="a%5C">x</a></p>'],
    [
      '- a | b\n  --- | ---\nc | d',
      '<div><ul><li><table><thead><tr><th>a</th><th>b</th></tr></thead></table></li></ul><p>c | d</p></div>',
    ],
    [
      '1. [^1]:\nb\n\n   [^1]',
      '<ol><li><p><a href="#1"><sup>1</sup></a></p></li></ol><footer><div id="1">1: b</div></footer>',
    ],
    ['- <b>x</b>\ny\n===', '<ul><li><b>x</b>\ny\n===</li></ul>'],
    [
      '<div <b c="d"/>\n<![CDATA[</pre>\n\n```\n<b>\n```',
      '<div><div <b c="d"/>\n<![CDATA[</pre>\n<pre><code>&lt;b&gt;</code></pre></div>',
    ],
    [
      '<p><!--\n\n<a e="--><b e=">">\n<div>"onclick=alert(1)>',
      '<div><p><!--\n<p><a >&quot;&gt;</p><div>"onclick=alert(1)></div>',
    ],
    [
      '<textarea>```\n```\n</script>\n    [x](&#106avascript:alert(1))',
      '<div>&lt;textarea>```\n```\n&lt;/script><pre><code>[x](&amp;#106avascript:alert(1))</code></pre></div>',
    ],
    [
      '<details>\n<summary>x</summary>\n\n```js\ncode\n```\n\n</details>',
      '<details><summary>x</summary><pre><code class="language-js">code</code></pre></details>',
    ],
    [
      '<div>\n\n```\n``` \n\n</div>\n\n```\n<img src=x onerror=alert(1)>\n',
      '<div><div><pre><code>``` \n</code></pre></div><pre><code>&lt;img src=x onerror=alert(1)&gt;</code></pre></div>',
    ],
    [
      '<![CDATA[a]]]>\n\n```\n<img src=x onerror=alert(1)>\n```',
      '<div><![CDATA[a]]]>\n<pre><code>&lt;img src=x onerror=alert(1)&gt;</code></pre></div>',
    ],
    [
      '- <?p ?> <?q ?>[x](\njavascript:alert(1))',
      '<div><ul><li><?p ?> <?q ?>[x](</li></ul><p>javascript:alert(1))</p></div>',
    ],
    [
      '- a <?p ?> <?q ?>[x](\njavascript:alert(1))',
      '<ul><li>a <?p ?> <?q ?><a>x</a></li></ul>',
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
      '<div>&lt;script>&lt;/textarea>&lt;/script ><pre><code>&lt;img src=x onerror=alert(1)&gt;</code></pre></div>',
    ],
    ['[^a](javascript:alert(1))', '<p><a>^a</a></p>'],
    [
      '[^a](javascript:alert(1))\n\n[^a]: y',
      '<p><a href="#a"><sup>a</sup></a>(javascript:alert(1))</p><footer><div id="a">a: y</div></footer>',
    ],
    [
      'y [^a<img src=x onerror=alert(1)>]\n\n[^a<img src=x onerror=alert(1)>]: a',
      '<p>y <a href="#aimg-srcx-onerroralert1"><sup>a&lt;img src=x onerror=alert(1)&gt;</sup></a></p><footer><div id="aimg-srcx-onerroralert1">a&lt;img src=x onerror=alert(1)&gt;: a</div></footer>',
    ],
    [
      '[^1]: a [\n[r]: a "](javascript:alert(1))"',
      '<footer><div id="1">1: a [</div></footer>',
    ],
    [
      '[^1]: a b\n[r]: a "[x](javascript:alert(1))"',
      '<footer><div id="1">1: a b</div></footer>',
    ],
    [
      '[\\[a\\](javascript:alert(1))](/u)',
      '<p><a href="/u">[a](javascript:alert(1))</a></p>',
    ],
    [
      '\\\n[^1]:&#106avascript:alert(1)\n[^1]',
      '<p><br />\n[^1]:&amp;#106avascript:alert(1)\n[^1]</p>',
    ],
    [
      'x&#60;~~~~javascript:alert(1)>',
      '<p>x&lt;~~~~javascript:alert(1)&gt;</p>',
    ],
    ["<C><?><a e='?>'> onclick/", "<C><?><a e='?>'> onclick/"],
    [
      '<![CDATA[<?><a e="?>"\n<!--"onclick>]',
      '<![CDATA[<?><a e="?>"\n<!--"onclick>]',
    ],
    [
      '<?e><a e="?>">\n<style>"onclick=alert(1)>',
      '<div><?e><a e="?>">\n&lt;style>"onclick=alert(1)></div>',
    ],
    [
      '[x][^1]\n\n[^1]: &amp;#106;avascript:alert(1)',
      '<p>[x]<a href="#1"><sup>1</sup></a></p><footer><div id="1">1: &amp;#106;avascript:alert(1)</div></footer>',
    ],
    ['[x][^1]', '<p>[x][^1]</p>'],
    [
      '[^1][^2]\n\n[^1]: see [^3]',
      '<p><a href="#1"><sup>1</sup></a>[^2]</p><footer><div id="1">1: see [^3]</div></footer>',
    ],
    [
      '[^1]\n\n[^1]: see [^2]\n\n[^2]: y',
      '<p><a href="#1"><sup>1</sup></a></p><footer><div id="1">1: see <a href="#2"><sup>2</sup></a></div><div id="2">2: y</div></footer>',
    ],
    [
      '<?p ?><!DOCTYPE html>```\n```\n<svg onload=alert(1)>',
      '<div><?p ?><!DOCTYPE html>```\n<pre><code>&lt;svg onload=alert(1)&gt;</code></pre></div>',
    ],
    [
      '[l](/u "--><img src=x onerror=alert(1)>")',
      '<p><a href="/u" title="--&gt;&lt;img src=x onerror=alert(1)&gt;">l</a></p>',
    ],
    [
      '![a"--><img src=x onerror=alert(1)>](/x)',
      '<p><img src="/x" alt="a&quot;--&gt;" /></p>',
    ],
    [
      '<svg>](<javascript:alert(1)></svg>',
      '<p><svg>](<a>javascript:alert(1)</a></svg></p>',
    ],
    [
      '<!DOCTYPE html>](<javascript:alert(1)>',
      '<!DOCTYPE html>](<javascript:alert(1)>',
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
      '<p><a href="#1"><sup>1</sup></a></p><footer><div id="1">1: data:text/html,x</div></footer>',
    ],
    [
      '<foreignObject>~~~~```x onmouseover="alert(1)"\n<svg onload=alert(1)>```\n',
      '<p><foreignObject>~~~~<code>x onmouseover=&quot;alert(1)&quot; &lt;svg onload=alert(1)&gt;</code></p>',
    ],
    [
      '[^1]: <iframe srcdoc="x"></iframe>[r][^1]',
      '<footer><div id="1">1: &lt;iframe>&lt;/iframe>[r]<a href="#1"><sup>1</sup></a></div></footer>',
    ],
    [
      '<annotation-xml>[^1]: ](javascript:alert(1)',
      '<annotation-xml>[^1]: ](javascript:alert(1)<footer><div id="1">1: ](javascript:alert(1)</div></footer>',
    ],
    ['<pre>a', '<pre>a'],
    ['<div><pre>a', '<div><pre>a'],
    ['<div>\n\n', '<div>'],
    ["<div </div>'", "<div </div>'"],
    ['<?php echo 1 ?>', '<?php echo 1 ?>'],
    ['<!DOCTYPE html>', '<!DOCTYPE html>'],
    ['<!doctype html>', '<!doctype html>'],
    ['<![CDATA[x]]>', '<![CDATA[x]]>'],
    [
      '<![CDATA[<a title="</style><a title="</textarea><a href="javascript:alert(1)">l</a> x" onclick=alert(1)>',
      '<![CDATA[&lt;a title="&lt;/style>&lt;a title="&lt;/textarea><a >l</a> x" onclick=alert(1)>',
    ],
    ['a <?b?> c', '<p>a <?b?> c</p>'],
    ['a <!B c> d', '<p>a <!B c> d</p>'],
    ['x <!a b> y', '<p>x <!a b> y</p>'],
    ['a <![CDATA[b]]> c', '<p>a <![CDATA[b]]> c</p>'],
    ['a <!-- b --> c', '<p>a <!-- b --> c</p>'],
    ['[l](java&Tab;script:alert(1))', '<p><a>l</a></p>'],
    ['<a href="java\tscript:alert(1)">l</a>', '<p><a>l</a></p>'],
    ['<a href="java\nscript:alert(1)">l</a>', '<p><a>l</a></p>'],
    [
      '<my-widget onclick={alert(1)}>x</my-widget>',
      '<my-widget >x</my-widget>',
    ],
    [
      '<my-widget items={x}>y</my-widget>',
      '<my-widget items={x}>y</my-widget>',
    ],
    [
      '<my-widget href={javascript:x}>z</my-widget>',
      '<my-widget >z</my-widget>',
    ],
    [
      '<a title="?><!--[^1]: ![a](javascript:alert(1))\n</div\n-->',
      '<p>&lt;a title=&quot;?&gt;<!--[^1]: ![a](javascript:alert(1))\n</div\n--></p>',
    ],
    [
      '1. </div x={a ><img src=x onerror=alert(1)>}>    innerHTML="x<img src=x onerror=alert(1)>"',
      '<ol><li></div><pre><code>innerHTML=&quot;x&lt;img src=x onerror=alert(1)&gt;&quot;</code></pre></li></ol>',
    ],
    [
      '- </div x={a ><img src=x onerror=alert(1)>}>    <b onclick=alert(1)>b</b>',
      '<ul><li></div><pre><code>&lt;b onclick=alert(1)&gt;b&lt;/b&gt;</code></pre></li></ul>',
    ],
    [
      '<div x={a><a title="</textarea>[^1]: ![a](javascript:alert(1))\nprop:innerHTML="x<img src=x onerror=alert(1)>"](onclick={alert(1)}',
      '<div x={a>&lt;a title="&lt;/textarea>[^1]: ![a](javascript:alert(1))\nprop:innerHTML="x&lt;img src=x onerror=alert(1)>"](onclick={alert(1)}',
    ],
    [
      '![<!---></span ](javascript:alert(1))>![a"--><img src=x onerror=alert(1)>](/x)',
      '<p><img src="/x" alt="&lt;/span ](javascript:alert(1))&gt;![a&quot;--&gt;" /></p>',
    ],
    [
      '![a\\\\\\](javascript:alert(1))b](/x)',
      '<p><img src="/x" alt="a\\](javascript:alert(1))b" /></p>',
    ],
    [
      `> <div a=1${String.fromCharCode(0x20_28)}>  onclick=alert(1) b>y</div>`,
      `<blockquote><div a=1${String.fromCharCode(0x20_28)}>  onclick=alert(1) b>y</div></blockquote>`,
    ],
    ['<pre>a &lt; b &amp; c</pre>', '<pre>a &lt; b &amp; c</pre>'],
    [
      `> <div </div${String.fromCharCode(0x20_28)}>\nonclick='alert(1)'`,
      `<div><blockquote><div </div${String.fromCharCode(0x20_28)}>\n</blockquote><p>onclick='alert(1)'</p></div>`,
    ],
    [
      `> a <div </div${String.fromCharCode(0x20_28)}>\nonclick='alert(1)'`,
      `<blockquote><p>a &lt;div &lt;/div${String.fromCharCode(0x20_28)}&gt;\nonclick='alert(1)'</p></blockquote>`,
    ],
    [
      '/\n    <pre>\n```\n<img src=x onerror=alert(1)>\n```',
      '<div><p>/\n<pre></p><pre><code>&lt;img src=x onerror=alert(1)&gt;</code></pre></div>',
    ],
    [
      '- <div/>`<img src=x onerror=alert(1)>`',
      '<ul><li><div></div><code>&lt;img src=x onerror=alert(1)&gt;</code></li></ul>',
    ],
    [
      '- z\n  <b/>\n  `<img src=x onerror=alert(1)>`',
      '<ul><li>z\n<b/>\n<code>&lt;img src=x onerror=alert(1)&gt;</code></li></ul>',
    ],
    [
      '- <br>\n  `<img src=x onerror=alert(1)>`',
      '<ul><li><br><code>&lt;img src=x onerror=alert(1)&gt;</code></li></ul>',
    ],
    [
      '- a\n  - <div/>\n  `<img src=x onerror=alert(1)>`',
      '<ul><li>a<ul><li><div></div></li></ul><code>&lt;img src=x onerror=alert(1)&gt;</code></li></ul>',
    ],
    [
      '- a\n\n- z\n  <b/>\n  `<img src=x onerror=alert(1)>`',
      '<ul><li><p>a</p></li><li><p>z\n<b/>\n<code>&lt;img src=x onerror=alert(1)&gt;</code></p></li></ul>',
    ],
    [
      '<b>`</b>x`<img src=x onerror=alert(1)>`',
      '<p><b>`</b>x<code>&lt;img src=x onerror=alert(1)&gt;</code></p>',
    ],
    [
      'z\n    <div>`<img src=x onerror=alert(1)>`',
      '<p>z\n<div><code>&lt;img src=x onerror=alert(1)&gt;</code></p>',
    ],
    [
      '~~~<a href="javascript:alert(1)">\nq\n~~~',
      '<pre><code class="language-&lt;a">q</code></pre>',
    ],
    [
      '- <?a ?>[x]:\n  javascript:alert(1)\n\n<span>[x]</span>',
      '<div><ul><li><?a ?>[x]:\njavascript:alert(1)</li></ul><p><span>[x]</span></p></div>',
    ],
    [
      'a[^1]\n\n[^1]: 100% of people',
      '<p>a<a href="#1"><sup>1</sup></a></p><footer><div id="1">1: 100% of people</div></footer>',
    ],
    ['1. ```\n   foo\n   ```', '<ol><li><pre><code>foo</code></pre></li></ol>'],
    ['a #\n=', '<h1 id="a-">a #</h1>'],
    [
      '`<script> https://a.b/c`',
      '<p><code>&lt;script&gt; https://a.b/c</code></p>',
    ],
    [
      `> <div </div ${String.fromCharCode(0x20_28)}>\nonclick='alert(1)'`,
      `<div><blockquote><div </div ${String.fromCharCode(0x20_28)}>\n</blockquote><p>onclick='alert(1)'</p></div>`,
    ],
    [
      '`[x](javascript:alert(1))`',
      '<p><code>[x](javascript:alert(1))</code></p>',
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
      '<div><![CDATA[\n<![CDATA[]]]>\n<pre><code>&lt;img src=x onerror=alert(1)&gt;</code></pre></div>',
    ],
  ])('renders %j as %j', (input, expected) => {
    expect(compiler(input)).toBe(expected)
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
      '<div><pre>x\n</pre><pre><code>&lt;img src=x onerror=alert(1)&gt;</code></pre></div>',
      'div',
      'pre',
    ],
    [
      '<b/>\n\n```\n<img src=x onerror=alert(1)>\n```',
      '<div><b></b><pre><code>&lt;img src=x onerror=alert(1)&gt;</code></pre></div>',
      'b',
      'script',
    ],
    [
      '<span>y</span>`<img src=x onerror=alert(1)>`',
      '<p><div>y</div><code>&lt;img src=x onerror=alert(1)&gt;</code></p>',
      'span',
      'div',
    ],
    [
      '<pre/>`<img src=x onerror=alert(1)>`',
      '<pre><p><code>&lt;img src=x onerror=alert(1)&gt;</code></p></pre>',
      'pre',
      'script',
    ],
    [
      '<div>\n<a title="></textarea>\nplain "text"\n<div>"onclick=alert(1)>',
      '<pre><a title=">&lt;/textarea>\nplain "text"\n<div>"onclick=alert(1)></pre>',
      'div',
      'pre',
    ],
    [
      '<pre>\n<a title=">\n\nplain "text"\n\n<div>"onclick=alert(1)>\n</pre>',
      '<div><a title=">\n\nplain "text"\n\n<div>"onclick=alert(1)></pre>',
      'pre',
      'div',
    ],
  ])('renders %j as %j when %j is renamed to %j', (input, expected, tag, component) => {
    expect(compiler(input, { overrides: { [tag]: { component } } })).toBe(
      expected
    )
  })

  it('neutralizes a tag hidden in a quoted value that runs past the read limit', () => {
    const long = 'x'.repeat(1100)
    expect(compiler(`<div>\n<a title="<b ${long}">y</a>\n</div>`)).toBe(
      `<div>&lt;a title="&lt;b ${long}">y</a>\n</div>`
    )
  })

  it.each([
    ['<Img onclick={alert(1)} />', undefined, '<Img >'],
    [
      '<constructor>hi</constructor>',
      { overrides: {} },
      '<p><constructor>hi</constructor></p>',
    ],
    [
      '<Constructor>hi</Constructor>',
      { overrides: {} },
      '<Constructor>hi</Constructor>',
    ],
    [
      '<my-widget onclick={alert(1)}>x</my-widget>',
      { overrides: { 'my-widget': { props: {} } } },
      '<my-widget >x</my-widget>',
    ],
    [
      '<my-widget onclick={() => 1}>x</my-widget>',
      { evalUnserializableExpressions: true },
      '<my-widget >x</my-widget>',
    ],
    [
      '<Img onclick={() => 1} />',
      {
        evalUnserializableExpressions: true,
        overrides: { IMG: { props: {} } },
      },
      '<Img >',
    ],
  ])('with its options keeps %j and %j as %j', (input, options, expected) => {
    expect(compiler(input, options)).toBe(expected)
  })
})

describe('emphasis that follows emphasis', () => {
  it('renders as two elements', () => {
    expect(compiler('_a_*b*')).toBe('<p><em>a</em><em>b</em></p>')
  })

  it('renders as three elements across a chain of alternating delimiters', () => {
    expect(compiler('*a*_b_*c*')).toBe('<p><em>a</em><em>b</em><em>c</em></p>')
  })
})

describe('emphasis nested past the inline depth limit', () => {
  it('leaves the delimiters outside the 199th level as literal text', () => {
    expect(compiler(`${'*'.repeat(6000)}a${'*'.repeat(6000)}`)).toBe(
      `<p>${'*'.repeat(5602)}${'<strong>'.repeat(199)}a${'</strong>'.repeat(199)}${'*'.repeat(5602)}</p>`
    )
  })
})

describe('a www. bare URL needs a dot inside its own span', () => {
  it('ignores a dot in the text after the URL', () => {
    expect(compiler('www.foo bar.com')).toBe('<p>www.foo bar.com</p>')
  })

  it('links a URL whose own span holds a dot', () => {
    expect(compiler('www.foo.com bar')).toBe(
      '<p><a href="http://www.foo.com">www.foo.com</a> bar</p>'
    )
  })

  it('counts a trailing dot that ends the sentence', () => {
    expect(compiler('www.foo. bar')).toBe(
      '<p><a href="http://www.foo">www.foo</a>. bar</p>'
    )
  })
})

describe('bare URLs in a run without spaces', () => {
  it('links a later www. address whose own paren balance trims differently', () => {
    expect(compiler('www.(www.ab_.))')).toBe(
      '<p>www.(<a href="http://www.ab">www.ab</a>_.))</p>'
    )
  })

  it('links the earliest candidate whose trailing parens leave a clean domain', () => {
    expect(compiler('www._)www._(www.c).).')).toBe(
      '<p>www.<em>)www.</em>(<a href="http://www.c">www.c</a>).).</p>'
    )
  })

  it('links the whole run once its last two segments are clean', () => {
    expect(compiler('www._)www._(www.c.d).).')).toBe(
      '<p><a href="http://www._)www._(www.c.d">www._)www._(www.c.d</a>).).</p>'
    )
  })

  it('links a scheme URL after a rejected one', () => {
    expect(compiler('http://a_b.c_dhttp://x.y')).toBe(
      '<p>http://a_b.c_d<a href="http://x.y">http://x.y</a></p>'
    )
  })

  it('links a www. address past a slash that ended a rejected domain', () => {
    expect(compiler('www.a_/www.b.c')).toBe(
      '<p>www.a_/<a href="http://www.b.c">www.b.c</a></p>'
    )
  })

  it('links a later candidate past a slash that reuses the rejected domain verdict', () => {
    expect(compiler('www.x_www.y/a.b')).toBe(
      '<p>www.x_<a href="http://www.y/a.b">www.y/a.b</a></p>'
    )
  })

  it('keeps a ] inside the domain and trims the unmatched trailing ) and ]', () => {
    expect(compiler('www._]www.a.b)].')).toBe(
      '<p><a href="http://www._%5Dwww.a.b">www._]www.a.b</a>)].</p>'
    )
  })

  it('keeps a trailing ] its [ opened while trimming the unmatched one', () => {
    expect(compiler('www._[www.a.b)]].')).toBe(
      '<p><a href="http://www._%5Bwww.a.b)%5D">www._[www.a.b)]</a>].</p>'
    )
  })

  it('links a later www. address past a [ that the first candidate never closes', () => {
    expect(compiler('www.[www.a.b_]')).toBe(
      '<p>www.[<a href="http://www.a.b">www.a.b</a>_]</p>'
    )
  })

  it('keeps a trailing ] a later candidate shares with a [ inside its own run', () => {
    expect(compiler('www._[www.a.b])')).toBe(
      '<p><a href="http://www._%5Bwww.a.b%5D">www._[www.a.b]</a>)</p>'
    )
  })

  it('stays text when a ] before a later candidate leaves it no clean domain', () => {
    expect(compiler('www.]www.a.b_[]')).toBe('<p>www.]www.a.b_[]</p>')
  })

  it('stays text when a nested [ pair closes after an underscore in the last segment', () => {
    expect(compiler('www.[[a.b]_]')).toBe('<p>www.[[a.b]_]</p>')
  })

  it('ends the link at the last closer when a kept ) and a kept ] both remain', () => {
    expect(compiler('www.[.()]')).toBe(
      '<p><a href="http://www.%5B.()%5D">www.[.()]</a></p>'
    )
  })

  it('stays text when a scheme URL has an empty domain', () => {
    expect(compiler('http://.')).toBe('<p>http://.</p>')
  })

  it('stays text when a www. address trims away to nothing', () => {
    expect(compiler('www._www..')).toBe('<p>www._www..</p>')
  })
})

describe('a bare URL inside [ ] text ends at the ] that closes it', () => {
  it.each([
    [
      '[GitHub repo][https://github.com/litejs/natural-compare-lite]',
      '<p>[GitHub repo][<a href="https://github.com/litejs/natural-compare-lite">https://github.com/litejs/natural-compare-lite</a>]</p>',
    ],
    [
      '[see https://example.com/a]',
      '<p>[see <a href="https://example.com/a">https://example.com/a</a>]</p>',
    ],
    [
      '[see www.example.com/a]',
      '<p>[see <a href="http://www.example.com/a">www.example.com/a</a>]</p>',
    ],
    [
      '[see **https://example.com/a**]',
      '<p>[see <strong><a href="https://example.com/a">https://example.com/a</a></strong>]</p>',
    ],
    [
      '[see https://example.com/?a[0]=1]',
      '<p>[see <a href="https://example.com/?a%5B0%5D=1">https://example.com/?a[0]=1</a>]</p>',
    ],
    [
      'see https://example.com/a]',
      '<p>see <a href="https://example.com/a">https://example.com/a</a>]</p>',
    ],
    [
      '[a] https://example.com/a]',
      '<p>[a] <a href="https://example.com/a">https://example.com/a</a>]</p>',
    ],
    [
      '\\[see https://example.com/a]',
      '<p>[see <a href="https://example.com/a">https://example.com/a</a>]</p>',
    ],
    [
      '[see ~~https://example.com/a]~~',
      '<p>[see <del><a href="https://example.com/a">https://example.com/a</a>]</del></p>',
    ],
    [
      '[see ==https://example.com/a]==',
      '<p>[see <mark><a href="https://example.com/a">https://example.com/a</a>]</mark></p>',
    ],
    [
      '==https://example.com/a==',
      '<p><mark><a href="https://example.com/a">https://example.com/a</a></mark></p>',
    ],
    [
      '==https://x.y/?t=YQ== b',
      '<p><mark><a href="https://x.y/?t=YQ">https://x.y/?t=YQ</a></mark> b</p>',
    ],
    [
      'https://x.y/?t=YQ== b',
      '<p><a href="https://x.y/?t=YQ==">https://x.y/?t=YQ==</a> b</p>',
    ],
    [
      '~~a https://x.y/?t=YQ== b~~',
      '<p><del>a <a href="https://x.y/?t=YQ==">https://x.y/?t=YQ==</a> b</del></p>',
    ],
    [
      "~~https://example.com/a~~'",
      '<p><del><a href="https://example.com/a">https://example.com/a</a></del>\'</p>',
    ],
    [
      '[see <span>https://example.com/a]</span>',
      '<p>[see <span><a href="https://example.com/a">https://example.com/a</a>]</span></p>',
    ],
    [
      '[see https://example.com/a\\]]',
      '<p>[see <a href="https://example.com/a">https://example.com/a</a>]]</p>',
    ],
    [
      '![see https://example.com/a]',
      '<p>![see <a href="https://example.com/a">https://example.com/a</a>]</p>',
    ],
    [
      '[^see https://example.com/a]',
      '<p>[^see <a href="https://example.com/a">https://example.com/a</a>]</p>',
    ],
    [
      '[see `]` https://example.com/a]',
      '<p>[see <code>]</code> <a href="https://example.com/a">https://example.com/a</a>]</p>',
    ],
    [
      '[[see https://example.com/a]]',
      '<p>[[see <a href="https://example.com/a">https://example.com/a</a>]]</p>',
    ],
    [
      '[see https://example.com/a.]',
      '<p>[see <a href="https://example.com/a">https://example.com/a</a>.]</p>',
    ],
    [
      '[see https://example.com/?a[0=1]',
      '<p>[see <a href="https://example.com/?a%5B0=1%5D">https://example.com/?a[0=1]</a></p>',
    ],
  ])('renders %j as %j', (input, expected) => {
    expect(compiler(input)).toBe(expected)
  })

  it('ends it there with optimizeForStreaming too', () => {
    const input = '[see https://example.com/a] after'
    const expected =
      '<p>[see <a href="https://example.com/a">https://example.com/a</a>] after</p>'
    expect(compiler(input)).toBe(expected)
    expect(compiler(input, { optimizeForStreaming: true })).toBe(expected)
  })
})

describe('render depth limit', () => {
  it.each([
    [$.MAX_RENDER_DEPTH - 1, $.MAX_RENDER_DEPTH - 1, 'x'],
    [$.MAX_RENDER_DEPTH, $.MAX_RENDER_DEPTH, 'x'],
    [$.MAX_RENDER_DEPTH + 1, $.MAX_RENDER_DEPTH, ''],
    [$.MAX_RENDER_DEPTH * 2, $.MAX_RENDER_DEPTH, ''],
    [20_000, $.MAX_RENDER_DEPTH, ''],
  ])('renders %i nested block quotes %i levels deep', (count, levels, text) => {
    expect(astToHTML(quotesDeep(count))).toBe(
      '<blockquote>'.repeat(levels) + text + '</blockquote>'.repeat(levels)
    )
  })

  it.each([
    [$.MAX_RENDER_DEPTH, 'x'],
    [$.MAX_RENDER_DEPTH + 1, ''],
    [$.MAX_RENDER_DEPTH * 2, ''],
    [20_000, ''],
  ])('continues the depth through renderChildren in a renderRule for %i nested block quotes', (count, expected) => {
    expect(
      astToHTML(quotesDeep(count), {
        renderRule: (next, node, renderChildren) =>
          node.type === RuleType.blockQuote
            ? renderChildren(node.children)
            : next(),
      })
    ).toBe(expected)
  })

  it('writes the overflow text escaped', () => {
    let node: MarkdownToJSX.ASTNode = {
      type: RuleType.text,
      text: '<b>&</b>',
    }
    for (let i = 0; i < $.MAX_RENDER_DEPTH; i++) {
      node = { type: RuleType.blockQuote, children: [node] }
    }
    expect(astToHTML([node])).toBe(
      '<blockquote>'.repeat($.MAX_RENDER_DEPTH) +
        '&lt;b&gt;&amp;&lt;/b&gt;' +
        '</blockquote>'.repeat($.MAX_RENDER_DEPTH)
    )
  })
})

describe('a setext underline after a lazy line in a block quote', () => {
  it.each([
    ['> a\nb\n> ---', '<blockquote><h2 id="ab">a\nb</h2></blockquote>'],
    [
      '> a\nb\n>\n> c\n> ===',
      '<blockquote><p>a\nb</p><h1 id="c">c</h1></blockquote>',
    ],
    ['> a\nb\n===', '<blockquote><p>a\nb\n===</p></blockquote>'],
  ])('renders %j as %j', (input, expected) => {
    expect(compiler(input)).toBe(expected)
  })
})

describe('code span edge spaces', () => {
  it.each([
    ['` a `', '<p><code>a</code></p>'],
    ['` \t `', '<p><code>\t</code></p>'],
    ['`   `', '<p><code> </code></p>'],
  ])('renders %j as %j', (input, expected) => {
    expect(compiler(input)).toBe(expected)
  })
})

describe('code spans at the streaming edge', () => {
  it.each([
    ['x `` a ` b `` y', '<p>x <code>a ` b</code> y</p>'],
    ['x \\` y', '<p>x ` y</p>'],
  ])('renders %j as %j with optimizeForStreaming, as without it', (input, expected) => {
    expect(compiler(input, { optimizeForStreaming: true })).toBe(expected)
    expect(compiler(input)).toBe(expected)
  })
})

describe('a bare email address with an underscore', () => {
  it.each([
    ['foo@a_b.c', '<p><a href="mailto:foo@a_b.c">foo@a_b.c</a></p>'],
    ['foo@a.b_c.d', '<p><a href="mailto:foo@a.b_c.d">foo@a.b_c.d</a></p>'],
    ['a.b-c_d@a.b_', '<p>a.b-c_d@a.b_</p>'],
  ])('renders %j as %j', (input, expected) => {
    expect(compiler(input)).toBe(expected)
  })
})

describe('frontmatter above a reference definition', () => {
  const input = '---\ntitle: x\n---\n\n# H\n\n[a]\n\n[a]: /u'

  it('drops the frontmatter and links the reference', () => {
    expect(compiler(input)).toBe(
      '<div><h1 id="h">H</h1><p><a href="/u">a</a></p></div>'
    )
  })

  it('keeps the frontmatter with preserveFrontmatter and links the reference', () => {
    expect(compiler(input, { preserveFrontmatter: true })).toBe(
      '<div><pre>---\ntitle: x\n---</pre><h1 id="h">H</h1><p><a href="/u">a</a></p></div>'
    )
  })

  it('keeps a document that is only frontmatter, closed at the end of input, as frontmatter', () => {
    expect(
      compiler('---\ntitle: Draft\n---', { preserveFrontmatter: true })
    ).toBe('<pre>---\ntitle: Draft\n---</pre>')
  })
})
