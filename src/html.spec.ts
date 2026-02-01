import { describe, expect, it } from 'bun:test'

import { compiler, astToHTML, RuleType } from './html'
import { parser } from './parse-compact'
import type { MarkdownToJSX } from './types'

describe('html compiler', () => {
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

    it('should not blow up if footnote syntax is seen but no matching footnote was found', () => {
      const result = compiler('foo[^abc] bar')
      expect(result).toContain('foo<a href="#abc"><sup>abc</sup></a> bar')
      expect(result).not.toContain('<footer>')
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

      // The refs should contain '^abc' as the key
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

    it('should handle HTML in footnote content', () => {
      // With tagfilter enabled (default), dangerous tags should be escaped
      const result = compiler(
        `foo[^abc] bar

[^abc]: Content with <script>alert('xss')</script>`,
        { tagfilter: true }
      )

      // Verify footer appears exactly once
      const footerMatches = result.match(/<footer>.*?<\/footer>/g)
      expect(footerMatches).toBeTruthy()
      expect(footerMatches!.length).toBe(1)

      // Check that footnote content is present
      expect(result).toContain('Content with')

      // Verify script tags are escaped for XSS protection when tagfilter is enabled
      // The opening tag should be escaped, preventing script execution
      expect(result).toContain('&lt;script')
      expect(result).not.toContain('<script>')
      // The closing tag may be handled differently by HTML block parsing
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
      // Should sanitize dangerous attributes
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
              return `<h${node.level} data-key="${state.key}" data-has-refs="${!!state.refs}">${renderChildren(node.children || [])}</h${node.level}>`
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

    it('node id takes precedence over override id for headings', () => {
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
      // Node id is set after override props, so it takes precedence
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
  })

  describe('URL reencoding after sanitization', () => {
    it('should reencode backslashes and backticks after sanitization', () => {
      // Create a URL that gets sanitized and contains backslashes/backticks
      const result = astToHTML(
        [
          {
            type: RuleType.link,
            target: 'https://example.com/path\\with\\backslashes`and`backticks',
            children: [{ type: RuleType.text, text: 'link' }],
          },
        ],
        {
          sanitizer: (url: string) => {
            // Simulate sanitizer that modifies the URL
            return url.replace(/https:/, 'http:')
          },
        }
      )
      // Should contain reencoded characters
      expect(result).toContain('%5C') // backslash
      expect(result).toContain('%60') // backtick
    })

    it('should return sanitized URL without reencoding when no special chars', () => {
      // When sanitizer modifies URL but no backslashes/backticks, should return sanitized directly
      const result = astToHTML(
        [
          {
            type: RuleType.link,
            target: 'https://example.com/path',
            children: [{ type: RuleType.text, text: 'link' }],
          },
        ],
        {
          sanitizer: (url: string) => {
            // Sanitizer modifies URL but no special chars to reencode
            return url.replace(/https:/, 'http:')
          },
        }
      )
      // Should use sanitized URL directly (no reencoding needed)
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
  })

  describe('HTML block with closing tag in text', () => {
    it('should handle script block with closing tag already in text', () => {
      const result = astToHTML(
        [
          {
            type: RuleType.htmlBlock,
            tag: 'script',
            attrs: {},
            _verbatim: true,
            _rawText: 'console.log("test");</script>',
            children: [],
          },
        ],
        {}
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
            _rawText: '<code>test</code></pre>',
            children: [],
          },
        ],
        {}
      )
      expect(result).toMatchInlineSnapshot(`"<pre><code>test</code></pre>"`)
    })

    it('should add closing tag when not present in text (Type 1 block)', () => {
      const result = astToHTML(
        [
          {
            type: RuleType.htmlBlock,
            tag: 'script',
            attrs: {},
            _verbatim: true,
            _rawText: 'console.log("test");', // No closing tag
            children: [],
          },
        ],
        {}
      )
      expect(result).toMatchInlineSnapshot(
        `"<script>console.log("test");</script>"`
      )
    })
  })

  describe('HTML block with text content and tagfilter', () => {
    it('should apply tagfilter to text content in HTML blocks', () => {
      const result = astToHTML(
        [
          {
            type: RuleType.htmlBlock,
            tag: 'div',
            attrs: {},
            _verbatim: true,
            _rawText: 'Content with <script>alert("xss")</script>',
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

  describe('HTML self-closing with tagfilter and rawText', () => {
    it('should escape rawText when tagfilter is enabled for dangerous tags', () => {
      const result = astToHTML(
        [
          {
            type: RuleType.htmlSelfClosing,
            tag: 'script',
            attrs: {},
            _rawText: '<script src="evil.js">',
          } as MarkdownToJSX.HTMLSelfClosingNode & { _rawText?: string },
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
         newline"> more text</p>"
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
        expect(compiler(baseInput + '\n')).toMatchInlineSnapshot(`
          "<dl-custom
            data-variant='horizontalTable'
          >
            <dt>title 1</dt>
          </dl-custom>
          "
        `)
      })

      it('should handle CRLF line endings', () => {
        expect(compiler(baseInput.replace(/\n/g, '\r\n')))
          .toMatchInlineSnapshot(`
          "<dl-custom
            data-variant='horizontalTable'
          >
            <dt>title 1</dt>
          </dl-custom>"
        `)
      })

      it('should handle leading and trailing newlines', () => {
        expect(compiler('\n' + baseInput + '\n\n')).toMatchInlineSnapshot(`
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
        '<pre>---\ntitle: Test\n---</pre><h1 id="content">Content</h1>'
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
        '<pre>---\ntitle: My Document\nauthor: John Doe\ndate: 2023-11-22\ntags:\n  - test\n  - example\n---</pre><h1 id="content">Content</h1>'
      )
    })
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

  it('should render incomplete fenced code blocks normally (content visible as it streams)', () => {
    // Fenced code blocks should render as they stream - users want to see the code
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
})
