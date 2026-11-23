import { describe, expect, it } from 'bun:test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { marked } from 'marked'
import { micromark } from 'micromark'

import { $ } from './constants.ts'
import { astToHTML } from './html.ts'
import {
  astToMarkdown,
  compiler,
  type MarkdownCompilerOptions,
  markdown,
} from './markdown.ts'
import { parser } from './parse.ts'
import { quotesDeep, storedAST } from './test-tree.ts'
import type { MarkdownToJSX } from './types.ts'
import { RuleType } from './types.ts'

function normalizeHtml(html: string): string {
  const isSpace = (c: number) => c === 32 || c === 9 || c === 10 || c === 13
  const charLessThan = 60
  const charGreaterThan = 62
  const charDoubleQuote = 34
  const charSingleQuote = 39
  const charSlash = 47
  let out = ''
  let inTag = false
  let quote = 0
  let tagStart = 0
  for (let i = 0; i < html.length; i++) {
    const c = html.charCodeAt(i)
    if (!inTag) {
      out += html[i]
      if (c === charLessThan) {
        inTag = true
        tagStart = out.length
      }
      continue
    }
    if (quote) {
      out += html[i]
      if (c === quote) {
        quote = 0
      }
      continue
    }
    if (c === charDoubleQuote || c === charSingleQuote) {
      quote = c
      out += html[i]
      continue
    }
    if (c === charGreaterThan) {
      let j = out.length
      while (j > tagStart && isSpace(out.charCodeAt(j - 1))) {
        j--
      }
      if (j > tagStart && out.charCodeAt(j - 1) === charSlash) {
        j--
      }
      while (j > tagStart && isSpace(out.charCodeAt(j - 1))) {
        j--
      }
      out = `${out.slice(0, j)}>`
      inTag = false
      continue
    }
    out += html[i]
  }
  return out.replace(/>\s*\n\s*</g, '><').trim()
}

function expectRoundTrip(source: string): void {
  const original = astToHTML(parser(source))
  const roundTripped = astToHTML(parser(astToMarkdown(parser(source))))
  expect(normalizeHtml(roundTripped)).toBe(normalizeHtml(original))
}

describe('normalizeHTML round-trip helper', () => {
  it('collapses tag-close whitespace and self-closing slashes', () => {
    expect(normalizeHtml('<img />')).toBe('<img>')
    expect(normalizeHtml('<img  >')).toBe('<img>')
    expect(normalizeHtml('<br/>')).toBe('<br>')
  })

  it('collapses whitespace-only inter-tag gaps spanning a newline', () => {
    expect(normalizeHtml('<div>\n  <span>a</span>\n</div>')).toBe(
      '<div><span>a</span></div>'
    )
  })

  it('leaves a literal > inside an attribute value intact so the quote-aware scan cannot mask a real round-trip difference', () => {
    expect(normalizeHtml('<abbr title="a > b">x</abbr>')).toBe(
      '<abbr title="a > b">x</abbr>'
    )
  })
})

describe('markdown compiler', () => {
  describe('basic text and paragraphs', () => {
    it('should compile plain text', () => {
      const ast: MarkdownToJSX.TextNode = {
        type: RuleType.text,
        text: 'Hello world',
      }
      expect(markdown(ast)).toBe('Hello world')
    })

    it('should compile paragraph', () => {
      const ast: MarkdownToJSX.ParagraphNode = {
        type: RuleType.paragraph,
        children: [{ type: RuleType.text, text: 'Hello world' }],
      }
      expect(markdown(ast)).toBe('Hello world')
    })

    it('should escape inline-special characters so literal text stays literal on re-parse', () => {
      const ast: MarkdownToJSX.TextNode = {
        type: RuleType.text,
        text: '*bold* _italic_ `code` [link](url)',
      }
      expect(markdown(ast)).toBe(
        '\\*bold\\* \\_italic\\_ \\`code\\` \\[link\\]\\(url)'
      )
    })
  })

  describe('headings', () => {
    it('should compile ATX headings', () => {
      const ast: MarkdownToJSX.HeadingNode = {
        type: RuleType.heading,
        level: 1,
        children: [{ type: RuleType.text, text: 'Heading 1' }],
        id: 'heading-1',
      }
      expect(markdown(ast)).toBe('# Heading 1')
    })

    it('should compile ATX headings with different levels', () => {
      const headings = [1, 2, 3, 4, 5, 6].map(level => ({
        type: RuleType.heading,
        level: level as 1 | 2 | 3 | 4 | 5 | 6,
        children: [{ type: RuleType.text, text: `Heading ${level}` }],
        id: `heading-${level}`,
      }))

      headings.forEach((heading, index) => {
        const level = index + 1
        const hashes = '#'.repeat(level)
        expect(markdown(heading)).toBe(`${hashes} Heading ${level}`)
      })
    })

    it('should compile setext headings when enabled', () => {
      const options: MarkdownCompilerOptions = { useSetextHeaders: true }

      const h1: MarkdownToJSX.HeadingNode = {
        type: RuleType.heading,
        level: 1,
        children: [{ type: RuleType.text, text: 'Heading 1' }],
        id: 'heading-1',
      }

      const h2: MarkdownToJSX.HeadingNode = {
        type: RuleType.heading,
        level: 2,
        children: [{ type: RuleType.text, text: 'Heading 2' }],
        id: 'heading-2',
      }

      expect(markdown(h1, options)).toBe('Heading 1\n=========')
      expect(markdown(h2, options)).toBe('Heading 2\n---------')
    })

    it('should not enforce space after # when disabled', () => {
      const options: MarkdownCompilerOptions = { enforceAtxHeadings: false }

      const ast: MarkdownToJSX.HeadingNode = {
        type: RuleType.heading,
        level: 1,
        children: [{ type: RuleType.text, text: 'Heading' }],
        id: 'heading',
      }

      expect(markdown(ast, options)).toBe('#Heading')
    })
  })

  describe('thematic breaks', () => {
    it('should compile thematic break', () => {
      const ast: MarkdownToJSX.BreakThematicNode = {
        type: RuleType.breakThematic,
      }
      expect(markdown(ast)).toBe('---')
    })
  })

  describe('line breaks', () => {
    it('should compile line break', () => {
      const ast: MarkdownToJSX.BreakLineNode = {
        type: RuleType.breakLine,
      }
      expect(markdown(ast)).toBe('  \n')
    })

    it('breaks: true writes every soft line break as a hard break, outside raw inline HTML', () => {
      expect(
        compiler('a\nb\n\n> c\n> d\n\n- e\n  f\n\ng <span>h\ni</span>', {
          breaks: true,
        })
      ).toBe('a  \nb\n\n> c  \n> d\n\n- e  \n  f\n\ng <span>h\ni</span>')
    })

    it('breaks: true writes a soft line break in forceInline text as a hard break, and a footnote body keeps its source as written', () => {
      expect([
        compiler('a  \nb\nc', { forceInline: true }),
        compiler('a  \nb\nc', { breaks: true, forceInline: true }),
        compiler('x[^1]\n\n[^1]: a  \n    b\n    c', { breaks: true }),
      ]).toEqual([
        'a  \nb\nc',
        'a  \nb  \nc',
        '[^1]: a  \n    b\n    c\n\nx[^1]',
      ])
    })
  })

  describe('code', () => {
    it('should compile inline code', () => {
      const ast: MarkdownToJSX.CodeInlineNode = {
        type: RuleType.codeInline,
        text: 'console.log("hello")',
      }
      expect(markdown(ast)).toBe('`console.log("hello")`')
    })

    it('should fence inline code past its longest interior backtick run and pad abutting backticks', () => {
      const ast: MarkdownToJSX.CodeInlineNode = {
        type: RuleType.codeInline,
        text: 'code with `backtick`',
      }
      expect(markdown(ast)).toBe('`` code with `backtick` ``')
    })

    it('should compile code block', () => {
      const ast: MarkdownToJSX.CodeBlockNode = {
        type: RuleType.codeBlock,
        text: 'console.log("hello")\nconsole.log("world")',
        lang: 'javascript',
      }
      expect(markdown(ast)).toBe(
        '```javascript\nconsole.log("hello")\nconsole.log("world")\n```'
      )
    })

    it('should compile code block without language', () => {
      const ast: MarkdownToJSX.CodeBlockNode = {
        type: RuleType.codeBlock,
        text: 'plain text code',
        lang: undefined,
      }
      expect(markdown(ast)).toBe('```\nplain text code\n```')
    })
  })

  describe('formatted text', () => {
    it('should compile emphasis (italic)', () => {
      const ast: MarkdownToJSX.FormattedTextNode = {
        type: RuleType.textFormatted,
        tag: 'em',
        children: [{ type: RuleType.text, text: 'italic text' }],
      }
      expect(markdown(ast)).toBe('*italic text*')
    })

    it('should compile strong (bold)', () => {
      const ast: MarkdownToJSX.FormattedTextNode = {
        type: RuleType.textFormatted,
        tag: 'strong',
        children: [{ type: RuleType.text, text: 'bold text' }],
      }
      expect(markdown(ast)).toBe('**bold text**')
    })

    it('writes an empty strikethrough as escaped tildes so its neighbors stay apart', () => {
      const ast: MarkdownToJSX.ParagraphNode = {
        type: RuleType.paragraph,
        children: [
          { type: RuleType.text, text: '<' },
          { type: RuleType.textFormatted, tag: 'del', children: [] },
          { type: RuleType.text, text: 'javascript:alert(1)>' },
        ],
      }
      expect(markdown(ast)).toBe('&lt;\\~\\~\\~\\~javascript:alert(1)>')
    })

    it('strikes through only tilde runs of exactly two', () => {
      expect(compiler('a ~~~c~~~ b ~~~~ ~~d~~~e~~')).toMatchInlineSnapshot(
        `"a \\~\\~\\~c\\~\\~\\~ b \\~\\~\\~\\~ ~~d\\~\\~\\~e~~"`
      )
    })

    it.each([
      ['==``==b==`', '\\==\\`\\`==b==\\`'],
      ['~~``~~b~~`', '\\~\\~\\`\\`~~b~~\\`'],
      ['[a ``b](/u) `c', '[a \\`\\`b](/u) \\`c'],
      ['~~a ~~', '\\~\\~a \\~\\~'],
      ['~~ a~~', '\\~\\~ a\\~\\~'],
      ['~~a~~~\n~~<', '\\~\\~a\\~\\~\\~\n\\~\\~<'],
      ['a ===c=== b', 'a ===c=== b'],
      ['==a===b==', '==a===b=='],
      ['==x==', '==x=='],
      ['== x==', '\\== x=='],
      ['a \\==b==', 'a \\==b=='],
      ['a \\=\\=b\\=\\= c', 'a \\==b== c'],
      ['a == b === c', 'a == b === c'],
      ['~~foo ~~bar baz~~', '\\~\\~foo ~~bar baz~~'],
      ['~~a ~~b~~ c~~', '~~a ~~b~~ c~~'],
      ['==a ==b== c==', '==a ==b== c=='],
      ['==a\\===', '==a\\==='],
      ['==\\=a==', '==\\=a=='],
      ['a\\===b==', 'a\\===b=='],
      ['==b==\\=c', '==b==\\=c'],
      ['===`=`a==', '\\=\\==`=`a=='],
      ['===*x==*', '\\=\\==*x==*'],
      ['~~**a**~~', '~~**a**~~'],
      ['**~~a~~**', '**~~a~~**'],
      ['*~~a*~~', '*\\~\\~a*\\~\\~'],
      ['~~*a~~*', '~~\\*a~~\\*'],
    ])('pairs strikethrough and mark runs like emphasis, keeping escapes on literal runs and leaving paired runs bare so each output re-parses to the same tree: %j', (input, expected) => {
      expect(compiler(input)).toBe(expected)
    })

    it('should compile strikethrough', () => {
      const ast: MarkdownToJSX.FormattedTextNode = {
        type: RuleType.textFormatted,
        tag: 'del',
        children: [{ type: RuleType.text, text: 'strikethrough' }],
      }
      expect(markdown(ast)).toBe('~~strikethrough~~')
    })

    it('should compile mark (highlight)', () => {
      const ast: MarkdownToJSX.FormattedTextNode = {
        children: [{ type: RuleType.text, text: 'highlighted' }],
        tag: 'mark',
        type: RuleType.textFormatted,
      }
      expect(markdown(ast)).toBe('==highlighted==')
    })

    it.each([
      ['_a_*b*', '*a*_b_'],
      ['*a*_b_', '*a*_b_'],
      ['__a__**b**', '**a**__b__'],
      ['*a*__b__', '*a*__b__'],
      ['x _a_*b* y', 'x *a*_b_ y'],
      ['_a_*b*y', '_a_*b*y'],
      ['*a*_b_*c*', '*a*_b_*c*'],
      ['*a*_b_**c**', '*a*_b_**c**'],
      ['**a**__b__**c**', '**a**__b__**c**'],
      ['_a_*b*_c_*d*', '*a*_b_*c*_d_'],
      ['_a_*b*_c_*d*y', '_a_*b*_c_*d*y'],
      ['[_a_*b*](/u)', '[*a*_b_](/u)'],
      ['| _a_*b* |\n| - |\n| c |', '| *a*_b_ |\n| --- |\n| c |'],
    ])('keeps adjacent emphasis in %j from fusing', (input, expected) => {
      expect(compiler(input)).toBe(expected)
      expectRoundTrip(input)
    })

    it('should compile nested formatted text', () => {
      const ast: MarkdownToJSX.FormattedTextNode = {
        type: RuleType.textFormatted,
        tag: 'strong',
        children: [
          { type: RuleType.text, text: 'bold and ' },
          {
            type: RuleType.textFormatted,
            tag: 'em',
            children: [{ type: RuleType.text, text: 'italic' }],
          },
        ],
      }
      expect(markdown(ast)).toBe('**bold and *italic***')
    })
  })

  describe('links', () => {
    it('ends link text at a bracket inside a raw HTML element, and hides only a bracket inside the tag itself', () => {
      expect(compiler('[see <b>this]</b> note](/docs)')).toBe(
        '\\[see <b>this]</b> note\\]\\(/docs)'
      )
      expect(compiler('[a <b title="]">x</b>](/u)')).toBe(
        '[a <b title="]">x</b>](/u)'
      )
    })

    it('should compile inline link', () => {
      const ast: MarkdownToJSX.LinkNode = {
        type: RuleType.link,
        target: 'https://example.com',
        title: undefined,
        children: [{ type: RuleType.text, text: 'Example' }],
      }
      expect(markdown(ast)).toBe('[Example](https://example.com)')
    })

    it('should compile inline link with title', () => {
      const ast: MarkdownToJSX.LinkNode = {
        type: RuleType.link,
        target: 'https://example.com',
        title: 'Example Title',
        children: [{ type: RuleType.text, text: 'Example' }],
      }
      expect(markdown(ast)).toBe(
        '[Example](https://example.com "Example Title")'
      )
    })

    it('should compile inline link with null target', () => {
      const ast: MarkdownToJSX.LinkNode = {
        type: RuleType.link,
        target: null,
        title: undefined,
        children: [{ type: RuleType.text, text: 'Broken Link' }],
      }
      expect(markdown(ast)).toBe('[Broken Link]()')
    })

    it('should compile reference-style links when enabled', () => {
      const options: MarkdownCompilerOptions = { useReferenceLinks: true }

      const ast: MarkdownToJSX.LinkNode = {
        type: RuleType.link,
        target: 'https://example.com',
        title: 'Example Title',
        children: [{ type: RuleType.text, text: 'Example' }],
      }

      const result = markdown(ast, options)
      expect(result).toMatch(/\[Example\]\[ref\d+\]/)
      expect(result).toContain('[ref1]: https://example.com "Example Title"')
    })
  })

  describe('images', () => {
    it('should compile inline image', () => {
      const ast: MarkdownToJSX.ImageNode = {
        type: RuleType.image,
        target: 'image.jpg',
        alt: 'Alt text',
        title: undefined,
      }
      expect(markdown(ast)).toBe('![Alt text](image.jpg)')
    })

    it('should compile inline image with title', () => {
      const ast: MarkdownToJSX.ImageNode = {
        type: RuleType.image,
        target: 'image.jpg',
        alt: 'Alt text',
        title: 'Image Title',
      }
      expect(markdown(ast)).toBe('![Alt text](image.jpg "Image Title")')
    })

    it('should compile reference-style images when enabled', () => {
      const options: MarkdownCompilerOptions = { useReferenceLinks: true }

      const ast: MarkdownToJSX.ImageNode = {
        type: RuleType.image,
        target: 'image.jpg',
        alt: 'Alt text',
        title: 'Image Title',
      }

      const result = markdown(ast, options)
      expect(result).toMatch(/!\[Alt text\]\[ref\d+\]/)
      expect(result).toContain('[ref1]: image.jpg "Image Title"')
    })
  })

  describe('lists', () => {
    it('should compile unordered list', () => {
      const ast: MarkdownToJSX.UnorderedListNode = {
        type: RuleType.unorderedList,
        items: [
          [{ type: RuleType.text, text: 'First item' }],
          [{ type: RuleType.text, text: 'Second item' }],
        ],
      }
      expect(markdown(ast)).toBe('- First item\n- Second item')
    })

    it('should compile ordered list', () => {
      const ast: MarkdownToJSX.OrderedListNode = {
        type: RuleType.orderedList,
        items: [
          [{ type: RuleType.text, text: 'First item' }],
          [{ type: RuleType.text, text: 'Second item' }],
        ],
        start: 1,
      }
      expect(markdown(ast)).toBe('1. First item\n2. Second item')
    })

    it('should compile ordered list with custom start', () => {
      const ast: MarkdownToJSX.OrderedListNode = {
        type: RuleType.orderedList,
        items: [
          [{ type: RuleType.text, text: 'First item' }],
          [{ type: RuleType.text, text: 'Second item' }],
        ],
        start: 5,
      }
      expect(markdown(ast)).toBe('5. First item\n6. Second item')
    })

    it('should handle multiline list items', () => {
      const ast: MarkdownToJSX.UnorderedListNode = {
        type: RuleType.unorderedList,
        items: [
          [
            { type: RuleType.text, text: 'First line' },
            { type: RuleType.breakLine },
            { type: RuleType.text, text: 'Second line' },
          ],
        ],
      }
      expect(markdown(ast)).toBe('- First line  \n  Second line')
    })

    it('should separate a nested list from its parent item text on round-trip', () => {
      expect(astToMarkdown(parser('- a\n  - b\n'))).toBe('- a\n  - b')
    })

    it('should separate loose list item blocks with a blank line on round-trip', () => {
      expect(astToMarkdown(parser('- foo\n\n  bar\n'))).toBe('- foo\n  \n  bar')
      expect(astToMarkdown(parser('1. a\n\n   b\n'))).toBe('1. a\n   \n   b')
    })

    it('should separate a block-level child (blockquote, code, heading) inside a list item', () => {
      expect(astToMarkdown(parser('- a\n\n  > q\n'))).toBe('- a\n  \n  > q')
      expect(astToMarkdown(parser('- foo\n\n  ## h\n\n  bar\n'))).toBe(
        '- foo\n  \n  ## h\n  \n  bar'
      )
    })

    it.each([
      [
        'a block that ends at the blank line before a paragraph',
        '- <div>x</div>\n\n  i\n- b',
        '- <div>x</div>\n  \n  i\n\n- b',
      ],
      [
        'a nested block that ends at a blank line',
        '- <details>\n  <summary>S</summary>\n\n  body\n\n  </details>\n- next',
        '- <details>\n  <summary>S</summary>\n  \n  body\n  \n  </details>\n\n- next',
      ],
      [
        'an unclosed block that ends at a blank line',
        '- <div>a\n\n  b',
        '- <div>a\n  \n  \n  b',
      ],
      [
        'an opener whose block ends at a blank line',
        '1. <p align="center">\n\n   para\n2. x',
        '1. <p align="center"></p>\n   \n   para\n\n2. x',
      ],
      [
        'a void tag followed by a line remainder',
        '- <img src="a.png"> \n  caption\n- b',
        '- <img src="a.png">\n  caption\n- b',
      ],
      [
        'a self-closing component followed by a line remainder',
        '- <MyComponent /> \n  text\n- two',
        '- <MyComponent ></MyComponent>\n  text\n- two',
      ],
      [
        'a closing tag followed by text',
        '- </pre>\n  x\n- y',
        '- </pre>x\n- y',
      ],
    ])('keeps the list looseness of a round trip with %s', (_name, source, expected) => {
      expect(astToMarkdown(parser(source))).toBe(expected)
    })

    it.each([
      ['-\n  _\n\n  )', '- \\_\n  \n  )'],
      ['-\n\n  -', '- \n- '],
      ['>a\n-', '> a\n\n- '],
    ])('should emit the item structure of %j as %j', (input, expected) => {
      expect(compiler(input)).toBe(expected)
    })
  })

  describe('blockquotes', () => {
    it('should compile simple blockquote', () => {
      const ast: MarkdownToJSX.BlockQuoteNode = {
        type: RuleType.blockQuote,
        children: [
          {
            type: RuleType.paragraph,
            children: [{ type: RuleType.text, text: 'Quoted text' }],
          },
        ],
      }
      expect(markdown(ast)).toBe('> Quoted text')
    })

    it('should compile multiline blockquote', () => {
      const ast: MarkdownToJSX.BlockQuoteNode = {
        type: RuleType.blockQuote,
        children: [
          {
            type: RuleType.paragraph,
            children: [{ type: RuleType.text, text: 'First line' }],
          },
          {
            type: RuleType.paragraph,
            children: [{ type: RuleType.text, text: 'Second line' }],
          },
        ],
      }
      expect(markdown(ast)).toBe('> First line\n>\n> Second line')
    })

    it('should compile nested blockquotes', () => {
      const ast: MarkdownToJSX.BlockQuoteNode = {
        type: RuleType.blockQuote,
        children: [
          {
            type: RuleType.blockQuote,
            children: [
              {
                type: RuleType.paragraph,
                children: [{ type: RuleType.text, text: 'Nested quote' }],
              },
            ],
          },
        ],
      }
      expect(markdown(ast)).toBe('> > Nested quote')
    })

    it('should re-emit the alert marker line for alert blockquotes so `> [!NOTE]` keeps its type on round-trip', () => {
      const ast: MarkdownToJSX.BlockQuoteNode = {
        alert: 'NOTE',
        children: [
          {
            type: RuleType.paragraph,
            children: [{ type: RuleType.text, text: 'Useful info' }],
          },
        ],
        type: RuleType.blockQuote,
      }
      expect(markdown(ast)).toBe('> [!NOTE]\n> Useful info')
    })

    it.each([
      ['a no-break space', ' '],
      ['an ideographic space', '　'],
      ['a form feed', '\f'],
      ['a vertical tab', '\v'],
    ])('should keep the alert marker followed by %s on round-trip', (_name, ws) => {
      expect(astToMarkdown(parser(`> [!NOTE]${ws}\n> body`))).toBe(
        '> [!NOTE]\n> body'
      )
    })

    it.each([
      ['>     code\n> para\nlazy', '> ```\n> code\n> ```\n>\n> para\n> lazy'],
      ['> para\n>     code\nlazy', '> para\n> code\n> lazy'],
      ['> # h\nlazy', '> # h\n\nlazy'],
      ['- # h\nlazy', '- # h\n\nlazy'],
      ['> ---\nlazy', '> ---\n\nlazy'],
      ['> ```\n> a\nlazy', '> ```\n> a\n> ```\n\nlazy'],
      [
        '- | a | b |\n  | - | - |\nlazy',
        '- | a | b |\n  | --- | --- |\n\nlazy',
      ],
      ['> <pre>\nlazy', '> <pre>\n\nlazy'],
      ['- <pre>\nlazy', '- <pre>\n\nlazy'],
      ['> <div>\nlazy', '> <div></div>\n\nlazy'],
      ['- <div>\nlazy', '- <div></div>\n\nlazy'],
      ['- </pre>\nm', '- </pre>\n\nm'],
      ['> </pre>\nm', '> </pre>\n\nm'],
      ['> - a\nlazy', '> - a\n>   lazy'],
      ['> > a\nlazy', '> > a\n> > lazy'],
      ['> f\nbar\n> # x', '> f\n> bar\n>\n> # x'],
      ['- 10. a\n\n      b\nlazy', '- 10. a\n      \n      b\n      lazy'],
      ['> 1.  one\n>\n>     two\nthree', '> 1. one\n>\n>    two\n>    three'],
      ['> [x]: /u\n[y]: /v\n\n[y]', '[x]: /u\n[y]: /v\n\n>\n\n[y](/v)'],
    ])('should re-emit %j, where a lazy line extends or ends its container, as %j', (input, expected) => {
      expect(compiler(input)).toBe(expected)
    })
  })

  describe('tables', () => {
    it('should compile simple table', () => {
      const ast: MarkdownToJSX.TableNode = {
        type: RuleType.table,
        align: ['left', 'center', 'right'],
        header: [
          [{ type: RuleType.text, text: 'Header 1' }],
          [{ type: RuleType.text, text: 'Header 2' }],
          [{ type: RuleType.text, text: 'Header 3' }],
        ],
        cells: [
          [
            [{ type: RuleType.text, text: 'Cell 1' }],
            [{ type: RuleType.text, text: 'Cell 2' }],
            [{ type: RuleType.text, text: 'Cell 3' }],
          ],
        ],
      }
      const expected =
        '| Header 1 | Header 2 | Header 3 |\n| :--- | :---: | ---: |\n| Cell 1 | Cell 2 | Cell 3 |'
      expect(markdown(ast)).toBe(expected)
    })

    it('should compile table with default alignment', () => {
      const ast: MarkdownToJSX.TableNode = {
        type: RuleType.table,
        align: [],
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
      }
      const expected =
        '| Header 1 | Header 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |'
      expect(markdown(ast)).toBe(expected)
    })

    it('escapes backslashes before pipes in table cells so a cell containing `\\` + `|` does not emit `\\\\|`, which re-parses as an escaped backslash plus an unescaped column split', () => {
      const ast: MarkdownToJSX.TableNode = {
        type: RuleType.table,
        align: [null],
        header: [[{ type: RuleType.text, text: 'a \\| b' }]],
        cells: [[[{ type: RuleType.text, text: 'c' }]]],
      }
      const emitted = markdown(ast)
      expect(emitted).toBe('| a \\\\\\| b |\n| --- |\n| c |')
      const reparsed = parser(emitted)[0] as MarkdownToJSX.TableNode
      expect(reparsed.type).toBe(RuleType.table)
      expect(reparsed.header.length).toBe(1)
      var headerText = ''
      for (var i = 0; i < reparsed.header[0].length; i++) {
        var n = reparsed.header[0][i]
        if (n.type === RuleType.text) {
          headerText += n.text
        }
      }
      expect(headerText).toBe('a \\| b')
    })

    it.each([
      ['`a| b |\n|---|', '\\`a| b |\n\\|---|'],
      ['`|]\n-', '## \\`|\\]'],
    ])('should emit %j, a delimiter row with the wrong cell count, as %j', (input, expected) => {
      expect(compiler(input)).toBe(expected)
    })
  })

  describe('HTML', () => {
    it('should compile HTML comment', () => {
      const ast: MarkdownToJSX.HTMLCommentNode = {
        type: RuleType.htmlComment,
        text: ' This is a comment ',
      }
      expect(markdown(ast)).toBe('<!-- This is a comment -->')
    })

    it('should compile self-closing HTML tag', () => {
      const ast: MarkdownToJSX.HTMLSelfClosingNode = {
        type: RuleType.htmlSelfClosing,
        tag: 'br',
        attrs: {},
      }
      expect(markdown(ast)).toBe('<br />')
    })

    it('should compile self-closing HTML tag with attributes', () => {
      const ast: MarkdownToJSX.HTMLSelfClosingNode = {
        type: RuleType.htmlSelfClosing,
        tag: 'img',
        attrs: { src: 'image.jpg', alt: 'Alt text' },
      }
      expect(markdown(ast)).toBe('<img src="image.jpg" alt="Alt text" />')
    })

    it('should compile HTML block', () => {
      const ast: MarkdownToJSX.HTMLNode = {
        type: RuleType.htmlBlock,
        tag: 'div',
        attrs: { class: 'container' },
        children: [
          {
            type: RuleType.paragraph,
            children: [{ type: RuleType.text, text: 'Content' }],
          },
        ],
        _verbatim: false,
      }
      expect(markdown(ast)).toBe('<div class="container">\nContent\n</div>')
    })

    it('should compile HTML block with text content', () => {
      const ast: MarkdownToJSX.HTMLNode = {
        type: RuleType.htmlBlock,
        tag: 'script',
        attrs: {},
        children: [],
        _verbatim: true,
        _rawBody: 'console.log("hello");',
        _rawClose: '</script>',
      }
      expect(markdown(ast)).toBe('<script>console.log("hello");</script>')
    })

    it('should emit a raw comment as-is rather than nesting its delimiters', () => {
      const ast: MarkdownToJSX.HTMLCommentNode = {
        type: RuleType.htmlComment,
        text: '<!-- c -->',
        raw: true,
      }
      expect(markdown(ast)).toBe('<!-- c -->')
    })

    it('should emit a bare closing tag for an orphan closing-tag node', () => {
      const ast: MarkdownToJSX.HTMLNode = {
        _isClosingTag: true,
        _verbatim: true,
        attrs: {},
        children: [],
        tag: 'details',
        type: RuleType.htmlBlock,
      }
      expect(markdown(ast)).toBe('</details>')
    })

    it('should keep trailing same-line content after an orphan closing tag', () => {
      const ast: MarkdownToJSX.HTMLNode = {
        _isClosingTag: true,
        _rawBody: ' trailing text',
        _verbatim: true,
        attrs: {},
        children: [],
        tag: 'details',
        type: RuleType.htmlBlock,
      }
      expect(markdown(ast)).toBe('</details> trailing text')
    })

    it('should keep the closing tag when a non-void HTML block carries inner text', () => {
      const ast: MarkdownToJSX.HTMLNode = {
        type: RuleType.htmlBlock,
        tag: 'div',
        attrs: {},
        children: [],
        text: 'x',
        _verbatim: false,
      }
      expect(markdown(ast)).toBe('<div>x</div>')
    })

    it.each([
      ['x<span></span></span', 'x<span></span>&lt;/span'],
      ['x<div></div></div', 'x<div></div>&lt;/div'],
      ['x<Foo></Foo></Foo', 'x<Foo></Foo>&lt;/Foo'],
    ])('should leave the second closer of %j as text', (input, expected) => {
      expect(compiler(input)).toBe(expected)
    })

    it.each([
      '<!--@/>',
      '<!A[@e>',
    ])('should pass %j through as a raw block', markup => {
      expect(compiler(markup)).toBe(markup)
    })

    it('should emit the children of a stored block with its private fields dropped', () => {
      expect(
        astToMarkdown(
          storedAST('<div>\n  <div/>\n  <span>content</span>\n</div>')
        )
      ).toBe('<div>  <div/>\n  <span>content</span>\n</div>')
    })
  })

  describe('GFM features', () => {
    it('should compile GFM task list item (checked)', () => {
      const ast: MarkdownToJSX.GFMTaskNode = {
        type: RuleType.gfmTask,
        completed: true,
      }
      expect(markdown(ast)).toBe('[x]')
    })

    it('should compile GFM task list item (unchecked)', () => {
      const ast: MarkdownToJSX.GFMTaskNode = {
        type: RuleType.gfmTask,
        completed: false,
      }
      expect(markdown(ast)).toBe('[ ]')
    })

    it('should compile footnote reference', () => {
      const ast: MarkdownToJSX.FootnoteReferenceNode = {
        type: RuleType.footnoteReference,
        target: '1',
        text: '1',
      }
      expect(markdown(ast)).toBe('[^1]')
    })
  })

  describe('frontmatter', () => {
    it('should compile frontmatter by emitting its raw text, delimiters included, as-is', () => {
      const ast: MarkdownToJSX.FrontmatterNode = {
        type: RuleType.frontmatter,
        text: '---\ntitle: My Document\nauthor: John Doe\n---',
      }
      expect(markdown(ast)).toBe(
        '---\ntitle: My Document\nauthor: John Doe\n---'
      )
    })

    it('should preserve frontmatter by default', () => {
      const ast: MarkdownToJSX.FrontmatterNode = {
        type: RuleType.frontmatter,
        text: '---\ntitle: Test\ntags: [a, b]\n---',
      }
      expect(markdown(ast)).toBe('---\ntitle: Test\ntags: [a, b]\n---')
    })

    it('should preserve frontmatter when preserveFrontmatter is true', () => {
      const ast: MarkdownToJSX.FrontmatterNode = {
        type: RuleType.frontmatter,
        text: '---\ntitle: Test\ntags: [a, b]\n---',
      }
      expect(markdown(ast, { preserveFrontmatter: true })).toBe(
        '---\ntitle: Test\ntags: [a, b]\n---'
      )
    })

    it('should exclude frontmatter when preserveFrontmatter is false', () => {
      const ast: MarkdownToJSX.FrontmatterNode = {
        type: RuleType.frontmatter,
        text: '---\ntitle: Test\ntags: [a, b]\n---',
      }
      expect(markdown(ast, { preserveFrontmatter: false })).toBe('')
    })

    it('keeps a document that is only frontmatter, closed at the end of input, as frontmatter', () => {
      expect(compiler('---\ntitle: Draft\n---')).toBe('---\ntitle: Draft\n---')
    })
  })

  describe('reference collection', () => {
    it('should compile reference collection', () => {
      const ast: MarkdownToJSX.ReferenceCollectionNode = {
        type: RuleType.refCollection,
        refs: {
          example: { target: 'https://example.com', title: 'Example Site' },
          github: { target: 'https://github.com', title: undefined },
        },
      }
      const result = markdown(ast)
      expect(result).toContain('[example]: https://example.com "Example Site"')
      expect(result).toContain('[github]: https://github.com')
    })
  })

  describe('complex documents', () => {
    it('should compile array of nodes', () => {
      const ast: MarkdownToJSX.ASTNode[] = [
        {
          type: RuleType.heading,
          level: 1,
          children: [{ type: RuleType.text, text: 'Title' }],
          id: 'title',
        },
        {
          type: RuleType.paragraph,
          children: [{ type: RuleType.text, text: 'Paragraph text' }],
        },
      ]
      expect(markdown(ast)).toBe('# Title\n\nParagraph text')
    })

    it('should produce valid markdown that can be reparsed', () => {
      const input = '# Hello\n\nThis is **bold** and *italic* text.'
      const ast = parser(input)
      const output = markdown(ast)
      const reparsed = parser(output)
      expect(reparsed.length).toBeGreaterThan(0)
      expect(output).toContain('# Hello')
      expect(output).toContain('**bold**')
      expect(output).toContain('*italic*')
    })

    it('should handle unknown node types gracefully', () => {
      const ast = { type: 999, unknown: 'property' } as any
      expect(markdown(ast)).toBe('')
    })
  })

  describe('options', () => {
    it('should respect reference link option', () => {
      const options: MarkdownCompilerOptions = { useReferenceLinks: false }

      const ast: MarkdownToJSX.LinkNode = {
        type: RuleType.link,
        target: 'https://example.com',
        title: 'Title',
        children: [{ type: RuleType.text, text: 'Link' }],
      }

      const result = markdown(ast, options)
      expect(result).toBe('[Link](https://example.com "Title")')
    })

    it('should use reference-style links when enabled', () => {
      const options: MarkdownCompilerOptions = { useReferenceLinks: true }

      const ast: MarkdownToJSX.LinkNode = {
        type: RuleType.link,
        target: 'https://example.com',
        title: 'Title',
        children: [{ type: RuleType.text, text: 'Link' }],
      }

      const result = markdown(ast, options)
      expect(result).toMatch(/\[Link\]\[ref\d+\]/)
      expect(result).toContain('[ref1]: https://example.com "Title"')
    })

    it('should respect enforce atx headers option', () => {
      const options: MarkdownCompilerOptions = { enforceAtxHeadings: false }

      const ast: MarkdownToJSX.HeadingNode = {
        type: RuleType.heading,
        level: 1,
        children: [{ type: RuleType.text, text: 'Title' }],
        id: 'title',
      }

      expect(markdown(ast, options)).toBe('#Title')
    })

    describe('disableParsingRawHTML', () => {
      it('should still emit HTML blocks when disableParsingRawHTML is true', () => {
        const options: MarkdownCompilerOptions = { disableParsingRawHTML: true }

        const ast: MarkdownToJSX.HTMLNode = {
          type: RuleType.htmlBlock,
          tag: 'div',
          attrs: { class: 'container' },
          children: [
            {
              type: RuleType.paragraph,
              children: [{ type: RuleType.text, text: 'Content' }],
            },
          ],
          _verbatim: false,
          text: undefined,
        }

        expect(markdown(ast, options)).toBe(
          '<div class="container">\nContent\n</div>'
        )
      })

      it('should still emit self-closing HTML tags when disableParsingRawHTML is true', () => {
        const options: MarkdownCompilerOptions = { disableParsingRawHTML: true }

        const ast: MarkdownToJSX.HTMLSelfClosingNode = {
          type: RuleType.htmlSelfClosing,
          tag: 'br',
        }

        expect(markdown(ast, options)).toBe('<br />')
      })

      it('should still emit HTML comments when disableParsingRawHTML is true', () => {
        const options: MarkdownCompilerOptions = { disableParsingRawHTML: true }

        const ast: MarkdownToJSX.HTMLCommentNode = {
          type: RuleType.htmlComment,
          text: ' This is a comment ',
        }

        expect(markdown(ast, options)).toBe('<!-- This is a comment -->')
      })

      it('should still emit HTML blocks with text content when disableParsingRawHTML is true', () => {
        const options: MarkdownCompilerOptions = { disableParsingRawHTML: true }

        const ast: MarkdownToJSX.HTMLNode = {
          type: RuleType.htmlBlock,
          tag: 'script',
          children: [],
          _verbatim: true,
          _rawBody: 'console.log("hello");',
          _rawClose: '</script>',
        }

        expect(markdown(ast, options)).toBe(
          '<script>console.log("hello");</script>'
        )
      })

      it('should emit HTML when disableParsingRawHTML is false or undefined', () => {
        const ast: MarkdownToJSX.HTMLNode = {
          type: RuleType.htmlBlock,
          tag: 'div',
          attrs: { class: 'container' },
          children: [
            {
              type: RuleType.paragraph,
              children: [{ type: RuleType.text, text: 'Content' }],
            },
          ],
          _verbatim: false,
          text: undefined,
        }

        expect(markdown(ast)).toBe('<div class="container">\nContent\n</div>')

        expect(markdown(ast, { disableParsingRawHTML: false })).toBe(
          '<div class="container">\nContent\n</div>'
        )
      })
    })
  })

  describe('compiler (markdown string to markdown string)', () => {
    it('should compile basic markdown', () => {
      const input = '# Hello\n\nThis is **bold** and *italic* text.'
      const output = compiler(input)
      expect(output).toContain('# Hello')
      expect(output).toContain('**bold**')
      expect(output).toContain('*italic*')
    })

    it('should handle complex structures', () => {
      const input = `# Main Title

## Subsection

- List item 1
- List item 2

\`\`\`javascript
console.log("code block")
\`\`\`

> This is a blockquote

[Link](https://example.com)

![Image](image.jpg)
`
      const output = compiler(input)
      expect(output).toContain('# Main Title')
      expect(output).toContain('## Subsection')
      expect(output).toContain('- List item 1')
      expect(output).toContain('```javascript')
      expect(output).toContain('> This is a blockquote')
      expect(output).toContain('[Link](https://example.com)')
      expect(output).toContain('![Image](image.jpg)')
    })

    it('should handle frontmatter', () => {
      const input = `---
title: Test Document
author: Test Author
---

# Content`
      const output = compiler(input)
      expect(output).toContain('title: Test Document')
      expect(output).toContain('author: Test Author')
      expect(output).toContain('# Content')
    })

    it('writes frontmatter before reference definitions so it survives re-parsing', () => {
      const input = '---\ntitle: x\n---\n\n# H\n\n[a]\n\n[a]: /u'
      expect(compiler(input)).toBe(
        '---\ntitle: x\n---\n\n[a]: /u\n\n# H\n\n[a](/u)'
      )
      expectRoundTrip(input)
    })

    it('should preserve frontmatter by default in full compilation', () => {
      const input = `---
title: Test Document
author: Test Author
---

# Content`
      const output = compiler(input)
      expect(output).toContain('title: Test Document')
      expect(output).toContain('author: Test Author')
      expect(output).toContain('# Content')
    })

    it('should preserve frontmatter when preserveFrontmatter is true in full compilation', () => {
      const input = `---
title: Test Document
author: Test Author
---

# Content`
      // markdown output has no wrapper element, so it asserts the frontmatter stays first, above the content
      expect(compiler(input, { preserveFrontmatter: true })).toBe(input)
    })

    it('should exclude frontmatter when preserveFrontmatter is false in full compilation', () => {
      const input = `---
title: Test Document
author: Test Author
---

# Content`
      const output = compiler(input, { preserveFrontmatter: false })
      expect(output).not.toContain('title: Test Document')
      expect(output).not.toContain('author: Test Author')
      expect(output).toContain('# Content')
    })

    it('should handle GFM features', () => {
      const input = `- [x] Completed task
- [ ] Incomplete task

| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
`
      const output = compiler(input)
      expect(output).toContain('[x] Completed task')
      expect(output).toContain('[ ] Incomplete task')
      expect(output).toContain('Header 1')
      expect(output).toContain('Cell 1')
    })

    it('should handle HTML in markdown', () => {
      const input = `Regular text

<div class="custom">
  <p>HTML content</p>
</div>

More text`
      const output = compiler(input)
      expect(output).toContain('<div class="custom">')
      expect(output).toContain('<p>HTML content</p>')
    })

    it('should write raw HTML as inert text when disableParsingRawHTML is enabled', () => {
      const input = `Regular text

<div class="custom">
  <p>HTML content</p>
</div>

<!-- comment -->

<img src="image.jpg" />

More text`

      const output = compiler(input, { disableParsingRawHTML: true })
      expect(output).toBe(
        'Regular text\n\n&lt;div class="custom">\n&lt;p>HTML content&lt;/p>\n&lt;/div>\n\n&lt;!-- comment -->\n\n&lt;img src="image.jpg" />\n\nMore text'
      )
    })
  })

  describe('round-trip compilation', () => {
    it('should round-trip the markdown specification document to the same HTML', () => {
      const specPath = path.join(import.meta.dirname, 'markdown-spec.md')
      expectRoundTrip(fs.readFileSync(specPath, 'utf8'))
    })

    it('should round-trip the GFM specification document to non-empty markdown that reparses and keeps its key elements', () => {
      const specPath = path.join(import.meta.dirname, 'gfm-spec.md')
      const originalMarkdown = fs.readFileSync(specPath, 'utf8')
      const originalAst = parser(originalMarkdown)
      const roundTripMarkdown = markdown(originalAst)
      const roundTripAst = parser(roundTripMarkdown)

      expect(originalAst.length).toBeGreaterThan(0)
      expect(roundTripAst.length).toBeGreaterThan(0)
      expect(roundTripMarkdown.length).toBeGreaterThan(0)
      expect(roundTripMarkdown).toContain('# Introduction')
      expect(roundTripMarkdown).toContain(
        '## What is GitHub Flavored Markdown?'
      )
      expect(roundTripMarkdown).toContain('---')
      expect(roundTripMarkdown).toContain(
        'title: GitHub Flavored Markdown Spec'
      )
    })

    it('should round-trip the comprehensive stress test fixture to non-empty markdown that reparses and keeps its key elements', () => {
      const fixturePath = path.join(
        import.meta.dirname,
        'stress-test.generated.md'
      )
      const originalMarkdown = fs.readFileSync(fixturePath, 'utf8')
      const originalAst = parser(originalMarkdown)
      const roundTripMarkdown = markdown(originalAst)
      const roundTripAst = parser(roundTripMarkdown)

      expect(originalAst.length).toBeGreaterThan(0)
      expect(roundTripAst.length).toBeGreaterThan(0)
      expect(roundTripMarkdown.length).toBeGreaterThan(0)
      expect(roundTripMarkdown).toContain(
        '# Comprehensive Markdown Syntax Fixture'
      )
      expect(roundTripMarkdown).toContain('---')
      expect(roundTripMarkdown).toContain(
        'title: Comprehensive Markdown Syntax Fixture'
      )
      expect(roundTripMarkdown).toContain('# END OF COMPREHENSIVE FIXTURE FILE')
    })

    describe('HTML equivalence corpus', () => {
      it('round-trips headings and thematic breaks', () => {
        expectRoundTrip('# Title')
        expectRoundTrip('## Subtitle with *emphasis*')
        expectRoundTrip('### Deep heading')
        expectRoundTrip('---')
      })

      it('round-trips inline formatting including mark', () => {
        expectRoundTrip(
          'Paragraph with **strong**, *em*, ~~strike~~, ==mark==, and `code`.'
        )
        expectRoundTrip('Line one  \nLine two')
      })

      it('round-trips literal text that would otherwise re-activate as syntax', () => {
        expectRoundTrip('a \\*not bold\\* b')
        expectRoundTrip('literal \\`backtick\\` and \\[bracket\\]')
        expectRoundTrip('\\# not a heading')
        expectRoundTrip('\\- not a list')
        expectRoundTrip('\\> not a quote')
        expectRoundTrip('1\\. not a list')
        expectRoundTrip('2\\) not a list')
        expectRoundTrip('a\n3\\. not a list')
        expectRoundTrip('www\\.not-a-link.com')
        expectRoundTrip('http\\://not-a-link.com')
      })

      it('round-trips links, images, and references', () => {
        expectRoundTrip('[link](https://example.com "Title")')
        expectRoundTrip('![alt text](image.png)')
        expectRoundTrip('[ref link][1]\n\n[1]: https://example.com')
      })

      it('round-trips link and image titles containing quotes or backslashes', () => {
        expectRoundTrip('[x](/u "a\\"b")')
        expectRoundTrip('![alt](/u "t\\"q")')
        expectRoundTrip('[t](/u "back\\\\slash")')
      })

      it('round-trips code blocks', () => {
        expectRoundTrip('```js\nconst x = 1\n```')
        expectRoundTrip('    indented code')
      })

      it('round-trips fenced code that contains a fence', () => {
        expectRoundTrip('````\n```\ncode\n```\n````')
      })

      it('round-trips inline code containing backticks', () => {
        expectRoundTrip('`` `x` ``')
        expectRoundTrip('`a``b`')
      })

      it('round-trips blockquotes', () => {
        expectRoundTrip('> simple quote')
        expectRoundTrip('> first\n>\n> second')
        expectRoundTrip('> outer\n> > inner')
      })

      it('round-trips alert blockquotes of every type', () => {
        expectRoundTrip('> [!NOTE]\n> Useful info')
        expectRoundTrip('> [!TIP]\n> Helpful hint')
        expectRoundTrip('> [!IMPORTANT]\n> Key detail')
        expectRoundTrip('> [!WARNING]\n> Watch out')
        expectRoundTrip('> [!CAUTION]\n> Danger ahead')
      })

      it('round-trips tight lists and task lists', () => {
        expectRoundTrip('- one\n- two\n- three')
        expectRoundTrip('1. first\n2. second')
        expectRoundTrip('- parent\n  - child')
        expectRoundTrip('- [ ] todo\n- [x] done')
      })

      it('keeps a task marker as text unless whitespace and content follow it', () => {
        expect(compiler('- [x]foo\n- [ ] \n- [x] baz')).toBe(
          '- \\[x\\]foo\n- \\[ \\]\n- [x] baz'
        )
      })

      it('keeps a content tab inside a quote or list item, and drops a code span continuation line indent', () => {
        expect(compiler('> ```\n> a\tb\n> ```\n\n- `a\tb`\n\n``a\n b``')).toBe(
          '> ```\n> a\tb\n> ```\n\n- `a\tb`\n\n`a b`'
        )
      })

      it('reads a tab in a quote or list item as whitespace around a link title, a closing heading sequence, and a soft break, and as content in indented code', () => {
        expect(
          compiler('> [a](/u\t"t")\n\n- # x #\t\n\n> a\t\n> b\n\n>     -\tfoo')
        ).toMatchInlineSnapshot(`
          "> [a](/u "t")

          - # x

          > a
          > b

          > \`\`\`
          > -	foo
          > \`\`\`"
        `)
      })

      it('keeps the rest of a task marker line as text, never a block', () => {
        expect(compiler('- [x] # heading\n- [x] > quote')).toBe(
          '- [x] \\# heading\n- [x] \\> quote'
        )
        expectRoundTrip('- [x] # heading\n- [x] > quote')
      })

      it('round-trips loose lists without collapsing them to tight', () => {
        expectRoundTrip('- foo\n\n- bar')
        expectRoundTrip('1. foo\n\n2. bar')
        expectRoundTrip('- foo\n\n  second paragraph\n\n- bar')
      })

      it('round-trips tables', () => {
        expectRoundTrip('Head A | Head B\n---|---\n1 | 2')
        expectRoundTrip('A | B | C\n:---|:---:|---:\na | b | c')
      })

      it('round-trips single-column tables and cells containing pipes', () => {
        expectRoundTrip('| a |\n| - |\n| b |')
        expectRoundTrip('| a \\| b |\n| - |\n| c |')
      })

      it('round-trips raw HTML attributes without corrupting them', () => {
        expectRoundTrip('<div style="color:red">x</div>')
        expectRoundTrip('<div class="c" data-x="1">y</div>')
        expectRoundTrip('<abbr title="HyperText">HTML</abbr>')
      })

      it('round-trips inline HTML with empty children without splitting the paragraph', () => {
        expectRoundTrip('text <video></video> more')
        expectRoundTrip('a <span></span> b')
      })

      it('round-trips footnotes', () => {
        expectRoundTrip('Text with a footnote[^1]\n\n[^1]: The note')
      })

      it('round-trips frontmatter without doubling delimiters', () => {
        expectRoundTrip('---\ntitle: Test\nauthor: X\n---\n\n# Hello')
      })

      it('round-trips HTML blocks, comments, and self-closing tags', () => {
        expectRoundTrip('<div>\n\n*content*\n\n</div>')
        expectRoundTrip('<div class="note">\n\ntext\n\n</div>')
        expectRoundTrip(
          '<details>\n<summary>More</summary>\n\nHidden\n\n</details>'
        )
        expectRoundTrip('<!-- a comment -->')
        expectRoundTrip('line one<br />line two')
        expectRoundTrip('<hr />')
      })

      it('round-trips orphan closing tags', () => {
        expectRoundTrip('</details>')
        expectRoundTrip('</details> trailing text')
      })

      it('round-trips inline processing instructions, CDATA, and declarations verbatim', () => {
        const source = 'text <?xml version="1.0"?> more'
        expect(astToMarkdown(parser(source))).toBe(source)

        const cdata = 'text <![CDATA[ data ]]> more'
        expect(astToMarkdown(parser(cdata))).toBe(cdata)

        const doctype = 'text <!DOCTYPE html> more'
        expect(astToMarkdown(parser(doctype))).toBe(doctype)

        const orphanCloser = 'text </details> more'
        expect(astToMarkdown(parser(orphanCloser))).toBe(orphanCloser)
      })

      it('round-trips a composite document', () => {
        expectRoundTrip(
          '# Doc\n\nIntro paragraph.\n\n> [!WARNING]\n> Careful.\n\n- a\n- b\n\n```\ncode\n```'
        )
      })
    })
  })

  describe('renderRule', () => {
    it.each([
      ['- <b>x</b>', 'alpha\nbeta', '- alpha\n  beta'],
      ['<b>x</b>', 'alpha\nbeta', 'alpha\nbeta'],
      ['- <b>x</b>', '<i\nclass="a">t</i>', '- <i class="a">t</i>'],
    ])('writes %j through a rule returning %j as %j', (input, text, expected) => {
      expect(
        compiler(input, {
          renderRule: (next, node) =>
            node.type === RuleType.htmlBlock ? text : next(),
        })
      ).toBe(expected)
    })

    it('runs once per node when an override renames a tag', () => {
      const types: RuleType[] = []
      compiler('<div>y</div>', {
        overrides: { div: { component: 'section' } },
        renderRule: (next, node) => {
          types.push(node.type)
          return next()
        },
      })
      expect(types).toEqual([RuleType.htmlBlock])
    })

    it('allows custom rendering of nodes', () => {
      const result = astToMarkdown(
        [{ type: RuleType.codeBlock, text: 'test', lang: 'javascript' }],
        {
          renderRule: (next, node) => {
            if (
              node.type === RuleType.codeBlock &&
              node.lang === 'javascript'
            ) {
              const text = node.text || ''
              return `\`\`\`custom\n${text}\n\`\`\``
            }
            return next()
          },
        }
      )
      expect(result).toBe('```custom\ntest\n```')
    })

    it('falls back to default rendering when not matching', () => {
      const result = astToMarkdown(
        [{ type: RuleType.codeBlock, text: 'test', lang: 'python' }],
        {
          renderRule: (next, node) => {
            if (
              node.type === RuleType.codeBlock &&
              node.lang === 'javascript'
            ) {
              const text = node.text || ''
              return `\`\`\`custom\n${text}\n\`\`\``
            }
            return next()
          },
        }
      )
      expect(result).toBe('```python\ntest\n```')
    })

    it('can use renderChildren for nested content', () => {
      const result = astToMarkdown(
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
              return `> ${renderChildren(node.children || [])}`
            }
            return next()
          },
        }
      )
      expect(result).toBe('> Hello**world**')
    })

    it('receives state with refs and key', () => {
      const result = astToMarkdown(
        [
          {
            type: RuleType.refCollection,
            refs: {
              'test-ref': { target: 'https://example.com', title: undefined },
            },
          },
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
              const key = state.key === undefined ? 'none' : String(state.key)
              const hasRefs = state.refs ? 'yes' : 'no'
              return `# [key:${key}][refs:${hasRefs}] ${renderChildren(node.children || [])}`
            }
            return next()
          },
        }
      )
      expect(result).toContain('[key:0]')
      expect(result).toContain('[refs:yes]')
      expect(result).toContain('Test')
    })

    it('can customize code block rendering', () => {
      const result = astToMarkdown(
        [
          {
            type: RuleType.codeBlock,
            text: 'console.log("hello")',
            lang: 'js',
          },
        ],
        {
          renderRule: (next, node) => {
            if (node.type === RuleType.codeBlock && node.lang === 'js') {
              return `\`\`\`javascript\n${node.text}\n\`\`\``
            }
            return next()
          },
        }
      )
      expect(result).toBe('```javascript\nconsole.log("hello")\n```')
    })

    it('can customize heading rendering', () => {
      const result = astToMarkdown(
        [
          {
            type: RuleType.heading,
            level: 2,
            id: 'custom-heading',
            children: [{ type: RuleType.text, text: 'Custom Heading' }],
          },
        ],
        {
          renderRule: (next, node, renderChildren) => {
            if (node.type === RuleType.heading && node.level === 2) {
              return `## ${renderChildren(node.children || [])} (custom)`
            }
            return next()
          },
        }
      )
      expect(result).toBe('## Custom Heading (custom)')
    })

    it('works with multiple nodes', () => {
      const result = astToMarkdown(
        [
          { type: RuleType.text, text: 'First' },
          { type: RuleType.text, text: 'Second' },
        ],
        {
          renderRule: (next, node) => {
            if (node.type === RuleType.text && node.text === 'First') {
              return '**First**'
            }
            return next()
          },
        }
      )
      expect(result).toBe('**First**\n\nSecond')
    })

    it('handles empty children arrays', () => {
      const result = astToMarkdown(
        [
          {
            type: RuleType.paragraph,
            children: [],
          },
        ],
        {
          renderRule: (next, node, renderChildren) => {
            if (node.type === RuleType.paragraph) {
              return (
                'Empty: ' +
                renderChildren(
                  (node as MarkdownToJSX.ParagraphNode).children || []
                )
              )
            }
            return next()
          },
        }
      )
      expect(result).toBe('Empty: ')
    })

    it('handles null/undefined children', () => {
      const result = astToMarkdown(
        [
          {
            type: RuleType.heading,
            level: 1,
            id: '',
            children: [],
          } as MarkdownToJSX.HeadingNode,
        ],
        {
          renderRule: (next, node, renderChildren) => {
            if (node.type === RuleType.heading) {
              const headingNode = node as MarkdownToJSX.HeadingNode
              return `# ${renderChildren(headingNode.children || [])}`
            }
            return next()
          },
        }
      )
      expect(result).toBe('# ')
    })

    it('handles renderRule returning empty string', () => {
      const result = astToMarkdown(
        [
          { type: RuleType.text, text: 'Should be hidden' },
          { type: RuleType.text, text: 'Should be visible' },
        ],
        {
          renderRule: (next, node) => {
            if (
              node.type === RuleType.text &&
              node.text === 'Should be hidden'
            ) {
              return ''
            }
            return next()
          },
        }
      )
      expect(result).toBe('\n\nShould be visible')
    })

    it('handles deeply nested structures', () => {
      const result = astToMarkdown(
        [
          {
            type: RuleType.blockQuote,
            children: [
              {
                type: RuleType.paragraph,
                children: [
                  {
                    type: RuleType.textFormatted,
                    tag: 'strong',
                    children: [
                      {
                        type: RuleType.text,
                        text: 'Nested',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        {
          renderRule: (next, node, renderChildren) => {
            if (node.type === RuleType.blockQuote) {
              return (
                '> ' +
                renderChildren(
                  (node as MarkdownToJSX.BlockQuoteNode).children || []
                )
              )
            }
            return next()
          },
        }
      )
      expect(result).toBe('> **Nested**')
    })

    it('handles renderRule with nodes that have no children property', () => {
      const result = astToMarkdown(
        [
          { type: RuleType.codeBlock, text: 'code', lang: 'js' },
          { type: RuleType.breakThematic },
        ],
        {
          renderRule: (next, node) => {
            if (node.type === RuleType.codeBlock) {
              return `\`\`\`custom\n${node.text || ''}\n\`\`\``
            }
            if (node.type === RuleType.breakThematic) {
              return '---'
            }
            return next()
          },
        }
      )
      expect(result).toBe('```custom\ncode\n```\n\n---')
    })

    it('handles renderRule that accesses state', () => {
      const result = astToMarkdown(
        [
          {
            type: RuleType.refCollection,
            refs: {
              'test-ref': { target: 'https://example.com', title: undefined },
            },
          },
          {
            type: RuleType.heading,
            level: 1,
            id: 'test',
            children: [{ type: RuleType.text, text: 'Test' }],
          },
          {
            type: RuleType.heading,
            level: 2,
            id: 'test',
            children: [{ type: RuleType.text, text: 'Test' }],
          },
        ],
        {
          renderRule: (next, node, renderChildren, state) => {
            if (node.type === RuleType.heading) {
              const key = state.key === undefined ? '' : `[${state.key}]`
              const hasRefs =
                state.refs && Object.keys(state.refs).length > 0
                  ? 'refs'
                  : 'no-refs'
              const headingNode = node as MarkdownToJSX.HeadingNode
              return `#${headingNode.level} ${key}${hasRefs} ${renderChildren(headingNode.children || [])}`
            }
            return next()
          },
        }
      )
      expect(result).toContain('#1 [0]')
      expect(result).toContain('#2 [1]')
      expect(result).toContain('Test')
    })

    it('handles renderRule with mixed node types in children', () => {
      const result = astToMarkdown(
        [
          {
            type: RuleType.paragraph,
            children: [
              { type: RuleType.text, text: 'Text' },
              { type: RuleType.codeInline, text: 'code' },
              {
                type: RuleType.textFormatted,
                tag: 'strong',
                children: [{ type: RuleType.text, text: 'bold' }],
              },
            ],
          },
        ],
        {
          renderRule: (next, node, renderChildren) => {
            if (node.type === RuleType.paragraph) {
              return (
                '[P] ' +
                renderChildren(
                  (node as MarkdownToJSX.ParagraphNode).children || []
                )
              )
            }
            return next()
          },
        }
      )
      expect(result).toBe('[P] Text`code`**bold**')
    })

    it('handles renderRule skipping certain node types', () => {
      const result = astToMarkdown(
        [
          { type: RuleType.text, text: 'Keep' },
          { type: RuleType.codeBlock, text: 'skip', lang: 'js' },
          { type: RuleType.text, text: 'Keep' },
        ],
        {
          renderRule: (next, node) => {
            if (node.type === RuleType.codeBlock) {
              return ''
            }
            return next()
          },
        }
      )
      expect(result).toBe('Keep\n\n\n\nKeep')
    })

    it('handles renderRule with recursive custom rendering', () => {
      const result = astToMarkdown(
        [
          {
            type: RuleType.orderedList,
            items: [
              [
                {
                  type: RuleType.paragraph,
                  children: [
                    {
                      type: RuleType.textFormatted,
                      tag: 'strong',
                      children: [{ type: RuleType.text, text: 'Item' }],
                    },
                  ],
                },
              ],
            ],
          },
        ],
        {
          renderRule: (next, node, renderChildren) => {
            if (node.type === RuleType.orderedList) {
              const listNode = node as MarkdownToJSX.OrderedListNode
              const items = (listNode.items || [])
                .map((item, i) => {
                  const itemContent = item
                    .map(child => {
                      if (child.type === RuleType.paragraph) {
                        return renderChildren(
                          (child as MarkdownToJSX.ParagraphNode).children || []
                        )
                      }
                      return renderChildren([child])
                    })
                    .join('')
                  return `${i + 1}. [CUSTOM] ${itemContent}`
                })
                .join('\n')
              return items
            }
            return next()
          },
        }
      )
      expect(result).toBe('1. [CUSTOM] **Item**')
    })

    it('handles renderRule that transforms text content', () => {
      const result = astToMarkdown(
        [
          {
            type: RuleType.paragraph,
            children: [{ type: RuleType.text, text: 'Hello World' }],
          },
        ],
        {
          renderRule: (next, node, renderChildren) => {
            if (node.type === RuleType.paragraph) {
              const content = renderChildren(
                (node as MarkdownToJSX.ParagraphNode).children || []
              )
              return content.toUpperCase()
            }
            return next()
          },
        }
      )
      expect(result).toBe('HELLO WORLD')
    })

    it('handles renderRule with multiple conditions', () => {
      const result = astToMarkdown(
        [
          { type: RuleType.codeBlock, text: 'js', lang: 'javascript' },
          { type: RuleType.codeBlock, text: 'py', lang: 'python' },
          { type: RuleType.codeBlock, text: 'ts', lang: 'typescript' },
        ],
        {
          renderRule: (next, node) => {
            if (node.type === RuleType.codeBlock) {
              const codeNode = node as MarkdownToJSX.CodeBlockNode
              if (codeNode.lang === 'javascript') {
                return `\`\`\`js\n${codeNode.text || ''}\n\`\`\``
              }
              if (codeNode.lang === 'python') {
                return `\`\`\`python\n${codeNode.text || ''}\n\`\`\``
              }
            }
            return next()
          },
        }
      )
      expect(result).toBe(
        '```js\njs\n```\n\n```python\npy\n```\n\n```typescript\nts\n```'
      )
    })

    it('handles renderRule that wraps content multiple times', () => {
      const result = astToMarkdown(
        [
          {
            type: RuleType.heading,
            level: 1,
            id: 'title',
            children: [{ type: RuleType.text, text: 'Title' }],
          },
        ],
        {
          renderRule: (next, node, renderChildren) => {
            if (node.type === RuleType.heading) {
              const content = renderChildren(
                (node as MarkdownToJSX.HeadingNode).children || []
              )
              return `# [[[${content}]]]`
            }
            return next()
          },
        }
      )
      expect(result).toBe('# [[[Title]]]')
    })

    it('handles renderRule with empty state', () => {
      const result = astToMarkdown([{ type: RuleType.text, text: 'Test' }], {
        renderRule: (next, _node, _renderChildren, state) => {
          const key = state.key === undefined ? -1 : state.key
          const refsCount = state.refs ? Object.keys(state.refs).length : 0
          return `[${key}:${refsCount}]${next()}`
        },
      })
      expect(result).toBe('[0:0]Test')
    })

    it('invokes renderRule for children when renderChildren is called', () => {
      const renderRuleCalls: RuleType[] = []
      const result = astToMarkdown(
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
            renderRuleCalls.push(node.type)
            if (node.type === RuleType.paragraph) {
              return `<p>${renderChildren(node.children || [])}</p>`
            }
            return next()
          },
        }
      )
      expect(result).toBe('<p>Hello**world**</p>')
      expect(renderRuleCalls).toContain(RuleType.paragraph)
      expect(renderRuleCalls).toContain(RuleType.text)
      expect(renderRuleCalls).toContain(RuleType.textFormatted)
    })
  })

  describe('overrides', () => {
    it('allows overriding HTML tag names with string', () => {
      const result = astToMarkdown(
        [
          {
            type: RuleType.htmlBlock,
            tag: 'div',
            children: [
              {
                type: RuleType.paragraph,
                children: [{ type: RuleType.text, text: 'Content' }],
              },
            ],
          },
        ],
        {
          overrides: {
            div: 'section',
          },
        }
      )
      expect(result).toContain('<section>')
      expect(result).toContain('</section>')
      expect(result).toContain('Content')
    })

    it('allows overriding HTML tag names with component object', () => {
      const result = astToMarkdown(
        [
          {
            type: RuleType.htmlBlock,
            tag: 'p',
            children: [{ type: RuleType.text, text: 'Hello' }],
          },
        ],
        {
          overrides: {
            p: {
              component: 'span',
            },
          },
        }
      )
      expect(result).toContain('<span>')
      expect(result).toContain('</span>')
      expect(result).toContain('Hello')
    })

    it('allows adding attributes to HTML tags', () => {
      const result = astToMarkdown(
        [
          {
            type: RuleType.htmlBlock,
            tag: 'div',
            children: [
              {
                type: RuleType.paragraph,
                children: [{ type: RuleType.text, text: 'Content' }],
              },
            ],
          },
        ],
        {
          overrides: {
            div: {
              component: 'div',
              props: {
                class: 'custom-class',
                id: 'my-id',
              },
            },
          },
        }
      )
      expect(result).toContain('class="custom-class"')
      expect(result).toContain('id="my-id"')
      expect(result).toContain('Content')
    })

    it('merges override props with existing attributes', () => {
      const result = astToMarkdown(
        [
          {
            type: RuleType.htmlBlock,
            tag: 'div',
            attrs: { id: 'existing-id' },
            children: [
              {
                type: RuleType.paragraph,
                children: [{ type: RuleType.text, text: 'Content' }],
              },
            ],
          },
        ],
        {
          overrides: {
            div: {
              props: {
                class: 'custom-class',
              },
            },
          },
        }
      )
      expect(result).toContain('id="existing-id"')
      expect(result).toContain('class="custom-class"')
    })

    it('works with HTML self-closing tags', () => {
      const result = astToMarkdown(
        [
          {
            type: RuleType.htmlSelfClosing,
            tag: 'img',
            attrs: { src: 'image.jpg', alt: 'Image' },
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

    it('overrides tag name for self-closing tags', () => {
      const result = astToMarkdown(
        [
          {
            type: RuleType.htmlSelfClosing,
            tag: 'br',
          },
        ],
        {
          overrides: {
            br: 'hr',
          },
        }
      )
      expect(result).toContain('<hr')
      expect(result).not.toContain('<br')
    })

    it('works with nested HTML blocks', () => {
      const result = astToMarkdown(
        [
          {
            type: RuleType.htmlBlock,
            tag: 'div',
            children: [
              {
                type: RuleType.htmlBlock,
                tag: 'span',
                children: [{ type: RuleType.text, text: 'Nested' }],
              },
            ],
          },
        ],
        {
          overrides: {
            div: {
              props: { class: 'outer' },
            },
            span: {
              props: { class: 'inner' },
            },
          },
        }
      )
      expect(result).toContain('class="outer"')
      expect(result).toContain('class="inner"')
      expect(result).toContain('Nested')
    })

    it('override props take precedence over existing attributes', () => {
      const result = astToMarkdown(
        [
          {
            type: RuleType.htmlBlock,
            tag: 'div',
            attrs: { class: 'old-class', id: 'keep-id' },
            children: [
              {
                type: RuleType.paragraph,
                children: [{ type: RuleType.text, text: 'Content' }],
              },
            ],
          },
        ],
        {
          overrides: {
            div: {
              props: {
                class: 'new-class',
              },
            },
          },
        }
      )
      expect(result).toContain('class="new-class"')
      expect(result).toContain('id="keep-id"')
      expect(result).not.toContain('old-class')
    })

    it('works with void elements', () => {
      const result = astToMarkdown(
        [
          {
            type: RuleType.htmlBlock,
            tag: 'img',
            attrs: { src: 'test.jpg' },
            text: '<img src="test.jpg">',
          },
        ],
        {
          overrides: {
            img: {
              props: {
                alt: 'Test',
              },
            },
          },
        }
      )
      expect(result).toContain('src="test.jpg"')
      expect(result).toContain('alt="Test"')
    })

    it('handles multiple overrides at once', () => {
      const result = astToMarkdown(
        [
          {
            type: RuleType.htmlBlock,
            tag: 'div',
            children: [
              {
                type: RuleType.htmlBlock,
                tag: 'span',
                children: [{ type: RuleType.text, text: 'Text' }],
              },
            ],
          },
          {
            type: RuleType.htmlSelfClosing,
            tag: 'br',
          },
        ],
        {
          overrides: {
            div: {
              props: { class: 'container' },
            },
            span: {
              component: 'strong',
            },
            br: {
              props: { 'data-break': 'true' },
            },
          },
        }
      )
      expect(result).toContain('class="container"')
      expect(result).toContain('<strong>')
      expect(result).toContain('data-break="true"')
    })

    it('works with compiler function', () => {
      const input = '<div>Hello</div>'
      const result = compiler(input, {
        overrides: {
          div: {
            component: 'section',
            props: {
              class: 'content',
            },
          },
        },
      })
      expect(result).toContain('<section')
      expect(result).toContain('class="content"')
      expect(result).toContain('Hello')
    })
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

  it('text after the element own closing tag is preserved', () => {
    expect(
      compiler('<div>\n<span>a</span>\n</div>\ntail')
    ).toMatchInlineSnapshot(`
      "<div><span>a</span>
      </div>
      tail"
    `)
  })

  describe('strips dangerous raw HTML attributes', () => {
    it('removes on* handlers and dangerous URLs while keeping safe attributes', () => {
      expect(compiler('<div onclick="alert(1)">hi</div>')).toBe(
        '<div >hi</div>'
      )
      expect(compiler('<a href="javascript:alert(1)" title="ok">x</a>')).toBe(
        '<a title="ok">x</a>'
      )
      expect(compiler('<div><img onerror=alert(1)></div>')).toBe(
        '<div><img ></div>'
      )
    })

    it('sanitizes raw HTML nested in a container that holds block-level markdown at parse time, since the markdown compiler emits the container raw inner source verbatim', () => {
      expect(
        compiler(
          '<div>\n# Heading\n<a href="javascript:alert(1)">y</a>\n</div>'
        )
      ).toBe('<div>\n# Heading\n<a >y</a>\n</div>')
    })

    it('sanitizes inline raw HTML emitted through the deprecated text field', () => {
      expect(
        compiler('text <span><a href="javascript:alert(1)">y</a></span> more')
      ).toBe('text <span><a >y</a></span> more')
      expect(compiler('<span><img src=x onerror=alert(1)></span>')).toBe(
        '<span><img src=x></span>'
      )
    })
  })
})

describe('unique heading IDs (#857)', () => {
  it('round-trips duplicate headings without emitting ids, since the markdown compiler has no id surface and the full emitted markdown is asserted instead', () => {
    expect(
      compiler(`# Foo

# Bar

## Foo`)
    ).toMatchInlineSnapshot(`
      "# Foo

      # Bar

      ## Foo"
    `)
  })

  it('round-trips a link-in-heading without emitting an id', () => {
    expect(compiler('## [text](https://e.com)')).toBe(
      '## [text](https://e.com)'
    )
  })

  it.each([
    ['# !!!', '# !!!'],
    ['# `]`', '# `]`'],
  ])('round-trips %j, a heading with an empty slug, as %j (markdown output has no id surface, so the emitted text is asserted)', (input, expected) => {
    expect(compiler(input)).toBe(expected)
  })
})

describe('destination entity decode before sanitize', () => {
  it('emits an empty destination for entity-obfuscated javascript: links', () => {
    expect(compiler('[x](&#106;avascript:alert(1))')).toBe('[x]()')
  })

  it('emits ![alt]() for rejected images, including those with titles', () => {
    expect(compiler('![alt](javascript:alert(1))')).toBe('![alt]()')
    expect(compiler('![alt](javascript:alert(1) "t")')).toBe('![alt]()')
  })

  it.each([
    ['tab in an angle-bracket destination', '![x](<java\tscript:alert(1)>)'],
    ['tab entity', '![x](java&#9;script:alert(1))'],
    ['newline entity', '![x](java&#10;script:alert(1))'],
    ['percent tab, mixed case', '![x](JaVa%09ScRiPt:alert(1))'],
    ['percent control character', '![x](java%01script:alert(1))'],
  ])('emits ![x]() for an image whose stripped form is a dangerous scheme: %s', (_, input) => {
    expect(compiler(input)).toBe('![x]()')
  })

  it.each([
    ['![&amp;copy;](x)', '![&amp;copy;](x)'],
    ['[a](x "&amp;copy;")', '[a](x "&amp;copy;")'],
    ['![a](x "t&amp;amp;")', '![a](x "t&amp;amp;")'],
    [
      '[a][r]\n\n[r]: /u "t&amp;copy;"',
      '[r]: /u "t&amp;copy;"\n\n[a](/u "t&amp;copy;")',
    ],
    ['![&copy;](x)', '![©](x)'],
    ['[a](x "&copy;")', '[a](x "©")'],
  ])('keeps entity-shaped alt and title text literal in %j', (input, expected) => {
    expect(compiler(input)).toBe(expected)
    expectRoundTrip(input)
  })

  it('keeps a safe image destination', () => {
    expect(compiler('![x](https://a.b/c.png)')).toBe('![x](https://a.b/c.png)')
  })

  it.each([
    ['0;url=javascript:alert(1)'],
    ['0;url=&#106;avascript:alert(1)'],
    ['0;url=java%73cript:alert(1)'],
    ['0;url=data:text/html,x'],
    ['0;javascript:alert(1)'],
  ])('writes a meta refresh with a dangerous URL without its content: %s', content => {
    expect(compiler(`<meta http-equiv="refresh" content="${content}">`)).toBe(
      '<meta http-equiv="refresh">'
    )
  })

  it('keeps a meta refresh with a safe URL', () => {
    expect(
      compiler('<meta http-equiv="refresh" content="0;url=https://x.y">')
    ).toBe('<meta http-equiv="refresh" content="0;url=https://x.y">')
  })
})

describe('inline Type 1 content with tagfilter off', () => {
  it('passes single-line script through unchanged', () => {
    expect(compiler('<script>x</script>', { tagfilter: false })).toBe(
      '<script>x</script>'
    )
  })

  it('passes a textarea body, markup and references included, through unchanged', () => {
    expect(
      compiler('<textarea><b>x</b> &amp;</textarea>', { tagfilter: false })
    ).toBe('<textarea><b>x</b> &amp;</textarea>')
  })

  it('passes a textarea written in capitals through unchanged', () => {
    expect(
      compiler('<TEXTAREA>a &lt; b</TEXTAREA>', { tagfilter: false })
    ).toBe('<TEXTAREA>a &lt; b</TEXTAREA>')
  })
})

describe('component-like HTML blank-line nesting (#870)', () => {
  it('preserves nested component markdown across blank lines', () => {
    expect(
      compiler(`<MyComponent>
## My header

Some paragraph
</MyComponent>`)
    ).toMatchInlineSnapshot(`
      "<MyComponent>
      ## My header

      Some paragraph
      </MyComponent>"
    `)
  })
})

describe('tagfilter passthrough contract', () => {
  it('passes raw dangerous tags through unchanged, with or without tagfilter, because the markdown compiler is not an execution sink and stays byte-preserving where HTML and JSX sinks emit inert source', () => {
    expect(compiler('<script>alert(1)</script>')).toBe(
      '<script>alert(1)</script>'
    )
    expect(compiler('<iframe>hi <em>x</em></iframe>')).toBe(
      '<iframe>hi <em>x</em></iframe>'
    )
    expect(compiler('<script>x</script>', { tagfilter: false })).toBe(
      '<script>x</script>'
    )
  })

  it.each([
    ['`<script>`'],
    ['`<style>`'],
    ['```html\n<script src="https://a.b/c.js"></script>\n```'],
    ['```html\n<title>x</title>\n```'],
    ['```\n<iframe src="https://a.b"></iframe>\n```'],
    ['```\n<textarea>\n```'],
  ])('keeps code naming a filtered tag as code, since a document can write these tags raw and naming one in code adds nothing another renderer can be shown: %j', input => {
    expect(compiler(input)).toBe(input)
  })

  it.each([
    ['<img onerror=alert(1)>', '<code>&lt;img onerror=alert(1)></code>'],
    ['<script onload=alert(1)>', '<code>&lt;script onload=alert(1)></code>'],
  ])('still writes code %j that holds a handler as HTML', (code, expected) => {
    expect(compiler(`\`${code}\``)).toBe(expected)
  })

  it.each([
    ['`<script>`', '<code>&lt;script></code>'],
    ['`<title>`', '<code>&lt;title></code>'],
    [
      '```html\n<script src="https://a.b/c.js"></script>\n```',
      '<pre><code class="language-html">&lt;script src="https://a.b/c.js">&lt;/script>\n</code></pre>',
    ],
    [
      '[^a`b]: x\n\n[^a`b] `<script>alert(1)</script>`',
      '[^a`b]: x\n\n[^a`b] <code>&lt;script>alert(1)&lt;/script></code>',
    ],
  ])('writes %j as HTML when raw HTML parsing is off, since code is then the one way a tag can reach another renderer', (input, expected) => {
    expect(compiler(input, { disableParsingRawHTML: true })).toBe(expected)
  })

  it('reads a truthy option as on, as the parser does, since options parsed from JSON reach it with no type holding them to a boolean', () => {
    expect(
      compiler('`<script>`', JSON.parse('{"disableParsingRawHTML":1}'))
    ).toBe('<code>&lt;script></code>')
  })
})

describe('prototype-slot reference labels (#900)', () => {
  it('emits escaped literal brackets for undefined __proto__/constructor refs', () => {
    expect(compiler('[__proto__]')).toBe('\\[**proto**\\]')
    expect(compiler('[constructor]')).toBe('\\[constructor\\]')
  })

  it('emits reference definitions and resolved inline links', () => {
    expect(compiler('[__proto__]: /x\n\n[__proto__]')).toBe(
      '[__proto__]: /x\n\n[**proto**](/x)'
    )
    expect(compiler('[constructor]: /y\n\n[constructor]')).toBe(
      '[constructor]: /y\n\n[constructor](/y)'
    )
  })
})

describe('optimizeForStreaming keeps literal delimiters', () => {
  it('removes only the genuinely unclosed emphasis opener on the last line and keeps literal `_` and `*` in finished text (issue #905)', () => {
    expect(
      compiler(
        'pass *args and **kwargs\n\ncustomer_id and `customer_id`\n\nSELECT * FROM t WHERE 2*3=6\n\nhttps://example.com/a_b and <https://example.com/c_d>\n\n**held',
        { optimizeForStreaming: true }
      )
    ).toMatchInlineSnapshot(`
      "pass \\*args and \\*\\*kwargs

      customer\\_id and \`customer_id\`

      SELECT \\* FROM t WHERE 2\\*3=6

      [https://example.com/a\\_b](https://example.com/a_b) and [https://example.com/c\\_d](https://example.com/c_d)

      held"
    `)
  })

  it('hides a never-closed opener while the option is on, since the parser cannot tell a streaming edge from finished text, and shows it as written in the final render with the option off (issue #909)', () => {
    const md = 'Use _trace and *args'
    expect(compiler(md, { optimizeForStreaming: true })).toMatchInlineSnapshot(
      `"Use trace and args"`
    )
    expect(compiler(md, { optimizeForStreaming: false })).toMatchInlineSnapshot(
      `"Use \\_trace and \\*args"`
    )
  })

  it('keeps complete raw HTML, and incomplete-looking links and code in a block that is no longer the last one, rendering exactly as without the option', () => {
    const md = 'a <span>z</span> <br> b\n\nsee [a](b and `code\n\nlast'
    const streamed = compiler(md, { optimizeForStreaming: true })
    expect(streamed).toBe(compiler(md))
    expect(streamed).toMatchInlineSnapshot(`
      "a <span>z</span> <br> b

      see \\[a\\]\\(b and \\\`code

      last"
    `)
  })
})

describe('optimizeForStreaming preserves literal less-than', () => {
  it('keeps comparison prose and defers incomplete tag prefixes', () => {
    expect(compiler('5 < 3 is false', { optimizeForStreaming: true })).toBe(
      '5 < 3 is false'
    )
    expect(compiler('Hello <Citation', { optimizeForStreaming: true })).toBe(
      'Hello'
    )
    expect(
      compiler('x < y\n\nsecond para', { optimizeForStreaming: true })
    ).toBe('x < y\n\nsecond para')
  })

  it('reads a closing tag after an unfinished opener the way a full parse does', () => {
    expect(compiler('x <Comp </b>y', { optimizeForStreaming: true })).toBe(
      'x &lt;Comp </b>y'
    )
  })
})

describe('inline HTML keeps the spaces at the edges of its content (#904)', () => {
  it.each([
    ['a<span> b </span>c', 'a<span> b </span>c'],
    ['<b>bold </b>next', '<b>bold </b>next'],
    ['<span> </span>', '<span> </span>'],
    ['<span> x </span>', '<span> x </span>'],
    ['a<span> <em>x</em> </span>b', 'a<span> <em>x</em> </span>b'],
  ])('writes %j back as written', (input, expected) => {
    expect(compiler(input)).toBe(expected)
    expect(compiler(input, { optimizeForStreaming: true })).toBe(expected)
  })
})

describe('enforceAtxHeadings (#903)', () => {
  it.each([
    [undefined, '#heading', '\\#heading'],
    [true, '#heading', '\\#heading'],
    [false, '#heading', '#heading'],
    [undefined, '# heading', '# heading'],
    [true, '# heading', '# heading'],
    [false, '# heading', '#heading'],
    [undefined, 'foo\n#bar', 'foo\n\\#bar'],
    [true, 'foo\n#bar', 'foo\n\\#bar'],
    [false, 'foo\n#bar', 'foo\n\n#bar'],
    [false, '#######x', '\\#######x'],
    [undefined, 'a<span>#</span>b', 'a<span>#</span>b'],
    [false, 'a<span>#</span>b', 'a<span>#</span>b'],
    [undefined, '<div>\n#x\n</div>', '<div>\n#x\n</div>'],
    [false, '<div>\n#x\n</div>', '<div>\n#x\n</div>'],
  ])('with enforceAtxHeadings %j writes %j as %j (a block HTML element is re-emitted as its source text, so the heading the parser reads inside <div> under false does not show)', (enforceAtxHeadings, input, expected) => {
    expect(compiler(input, { enforceAtxHeadings })).toBe(expected)
  })
})

describe('attribute names a renderer acts on rather than writes', () => {
  it('writes a name that ends in a colon as written', () => {
    expect(compiler('<span a:="1">b</span>')).toBe('<span a:="1">b</span>')
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
    ['<a attr:href="javascript:alert(1)">y</a>', '<a>y</a>'],
    ['<a prop:href="javascript:alert(1)">y</a>', '<a>y</a>'],
    [
      '<svg><a xlinkHref="javascript:alert(1)"><text>y</text></a></svg>',
      '<svg><a ><text>y</text></a></svg>',
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
    ['<Foo innerHTML={x}>y</Foo>', '<Foo >y</Foo>'],
    [
      '<svg><a><set attributeName="href" to="javascript:alert(1)"/><rect/></a></svg>',
      '<svg><a><set to="javascript:alert(1)"/><rect/></a></svg>',
    ],
    [
      '<svg><a><animate attributeName="&#104;ref" values="javascript:alert(1)"/></a></svg>',
      '<svg><a><animate values="javascript:alert(1)"/></a></svg>',
    ],
    [
      'x <svg><a><set attributename="xlink:href" to="javascript:alert(1)"/></a></svg>',
      'x <svg><a><set to="javascript:alert(1)"/></a></svg>',
    ],
    [
      '<svg><a><set attributeName={href} to="javascript:alert(1)"/></a></svg>',
      '<svg><a><set to="javascript:alert(1)"/></a></svg>',
    ],
    [
      '<svg><rect><animate attributeName="opacity" values="0;1"/></rect></svg>',
      '<svg><rect><animate attributeName="opacity" values="0;1"/></rect></svg>',
    ],
    ['<Btn action={javascript:alert(1)}>x</Btn>', '<Btn >x</Btn>'],
    ['<Btn srcDoc={"<script>alert(1)</script>"}>x</Btn>', '<Btn >x</Btn>'],
    ['<Btn attributeName={href}>x</Btn>', '<Btn >x</Btn>'],
    [
      '<Btn attributeName={opacity}>x</Btn>',
      '<Btn attributeName={opacity}>x</Btn>',
    ],
    ['<Btn href={link}>x</Btn>', '<Btn href={link}>x</Btn>'],
    ['<Btn data={{"a":1}}>x</Btn>', '<Btn data={{"a":1}}>x</Btn>'],
    [
      '<!-- c --> <script>alert(1)</script>',
      '<!-- c --> <script>alert(1)</script>',
    ],
    [
      '- <!-- c --> <script>alert(1)</script>',
      '- <!-- c --> <script>alert(1)</script>',
    ],
    ['<!-- <script> -->', '<!-- <script> -->'],
    [
      '<div x={a><script>alert(1)</script>}>y</div>',
      '<div x={a><script>alert(1)</script>}>y</div>',
    ],
    [
      '<p><? a\n\n<!-- x><script>alert(1)</script>',
      '<p><? a\n\n\n<!-- x><script>alert(1)</script>',
    ],
    [
      '<p><? a\n\n<div title="x><script>alert(1)</script>">body</div>',
      '<p><? a\n\n\n<div title="x><script>alert(1)</script>">body</div>',
    ],
    [
      '<p><!-- a\n\nb <br title="--><script>alert(1)</script>"> c',
      '<p><!-- a\n\n\nb <br title="--><script>alert(1)</script>"> c',
    ],
  ])('writes %j as %j (the tagfilter contract names the rendered outputs and not this one, which writes source for a renderer that applies its own filter)', (input, expected) => {
    expect(compiler(input)).toBe(expected)
  })

  it('drops a brace srcDoc and a brace attributeName naming a link from a tag an override renders as an element', () => {
    expect(
      compiler(
        '<Card srcDoc={"<script>alert(1)</script>"} attributeName={href} title="t">a</Card>',
        { overrides: { Card: { component: 'iframe' } } }
      )
    ).toBe('<Card title="t">a</Card>')
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

describe('text a downstream renderer reads as markup or a link', () => {
  it.each([
    [
      '<Foo x={a><javascript:alert(1)>}>',
      '<Foo x={a>&lt;javascript:alert(1)>}></Foo>',
    ],
    [
      '<Foo x={a>[l](javascript:alert(1))}>',
      '<Foo x={a>[l&#93;(javascript:alert(1))}></Foo>',
    ],
    ['<Foo x={a>b}>', '<Foo x={a>b}></Foo>'],
    [
      '[r]: <a title=\'<Img onmouseover="alert(1)"&gt;x>\n\n[r]',
      "[r]: a%20title='%3CImg%20onmouseover=%22alert(1)%22%3Ex\n\n[r](a%20title='%3CImg%20onmouseover=%22alert(1)%22%3Ex)",
    ],
    ['[r]: /u\n\n[r]', '[r]: /u\n\n[r](/u)'],
  ])('writes %j as %j (an attribute value is raw text to a renderer that does not read the tag as a block, and a definition target with a space is no definition to a renderer, so its text is a paragraph)', (input, expected) => {
    expect(compiler(input)).toBe(expected)
  })
})

describe('markup a browser or downstream renderer reads differently from the parser', () => {
  it.each([
    ['<!--><svg onload=alert(1)>', '<!--><svg >'],
    ['<?"><b onclick=alert(1)>b</b>', '<?"><b >b</b>'],
    [
      '<div>\n<!-- x\n\n<a title="--><img src=x onerror=alert(1)>">',
      '<div><!-- x\n\n\n<a ></a>',
    ],
    [
      '<!---><noscript><a title="</noscript><img src=x onerror=alert(1)>">',
      '<!---><noscript>&lt;a title="&lt;/noscript>&lt;img src=x onerror=alert(1)>">',
    ],
    [
      '<!-- x\n\n<a title="--><b y=\'">\n\n\' onclick=alert(1)>',
      '<!-- x\n\n&lt;a title="-->&lt;b y=\'">\n\n\n\' onclick=alert(1)>',
    ],
    ['<a x="<b" y=z>', '<a x="<b" y=z></a>'],
    ["<div onclick='alert(1)'--!>", "&lt;div onclick='alert(1)'--!>"],
    ['<div onclick={alert(1)}<xmp>', '&lt;div onclick={alert(1)}&lt;xmp>'],
    [
      '<div x={a><img src=x onerror=alert(1)>}>\nhi\n</div>',
      '<div >\nhi\n</div>',
    ],
    [
      'p <span x={a><img src=x onerror=alert(1)>}>hi</span>',
      'p <span>hi</span>',
    ],
    ['<pre><Img onclick={alert(1)}', '<pre>&lt;Img onclick={alert(1)}'],
    ['<div>\n<b onclick=alert(1)', '<div>&lt;b onclick=alert(1)'],
    ['```x onmouseover="alert(1)"\ny\n```', '```x\ny\n```'],
    ['```x style="color:red"\ny\n```', '```x\ny\n```'],
    [
      '<iframe><img src=x onerror=alert(1)',
      '<iframe>&lt;img src=x onerror=alert(1)',
    ],
    ['\\<svg onload=alert(1)>', '&lt;svg onload=alert(1)>'],
    ['&lt;img src=x onerror=alert(1)&gt;', '&lt;img src=x onerror=alert(1)>'],
    [
      'a[^1]\n\n[^1]: javascript:alert(1)',
      '[^1]: <!---->javascript:alert(1)\n\na[^1]',
    ],
    [
      '<![CDATA[<a title="</style><a title="</textarea><a href="javascript:alert(1)">l</a> x" onclick=alert(1)>',
      '<![CDATA[&lt;a title="&lt;/style>&lt;a title="&lt;/textarea><a >l</a> x" onclick=alert(1)>',
    ],
    ['a~~~~`b`', 'a\\~\\~\\~\\~`b`'],
    ['a~~~~\n\n`<b>`', 'a\\~\\~\\~\\~\n\n`<b>`'],
    [
      '<span>[l](javascript:alert(1))</span>',
      '<span>[l&#93;(javascript:alert(1))</span>',
    ],
    ['x <javascript:alert(1)> y', 'x [javascript:alert(1)]() y'],
    [
      'x <span><javascript:alert(1)//\xa0></span>',
      'x <span>&lt;javascript:alert(1)//\xa0></span>',
    ],
    [
      'x <span><JavaScript:alert&#40;1&#41;\u{2003}x></span>',
      'x <span>&lt;JavaScript:alert&#40;1&#41;\u{2003}x></span>',
    ],
    [
      'x <span><a:b\xa0<javascript:alert(1)\u{2028}x></span>',
      'x <span><a:b\xa0&lt;javascript:alert(1)\u{2028}x></span>',
    ],
    [
      'x <span>[y <https:a\xa0](javascript:alert(1))></span>',
      'x <span>[y &lt;https:a\xa0&#93;(javascript:alert(1))></span>',
    ],
    [
      'x <span><javascript:a](<javascript:alert(1)>)></span>',
      'x <span>&lt;javascript:a&#93;(&lt;javascript:alert(1)>)></span>',
    ],
    [
      '[l](&amp;amp;#106;avascript:alert(1))',
      '[l](&amp;#106;avascript:alert(1))',
    ],
    [
      '[l]: javascript&amp;amp;colon;alert(1)\n\n[l]',
      '[l]: javascript&amp;colon;alert(1)\n\n[l](javascript&amp;colon;alert(1))',
    ],
    ['[l](/a?b=1&amp;c=2)', '[l](/a?b=1&c=2)'],
    [
      '[x][^1]\n\n[^1]: &amp;#106;avascript:alert(1)',
      '[^1]: &amp;#106;avascript:alert(1)\n\n\\[x\\][^1]',
    ],
    ['[x][^1]', '\\[x\\]\\[^1\\]'],
    ['[^1][^2]\n\n[^1]: see [^3]', '[^1]: see [^3]\n\n[^1]\\[^2\\]'],
    ['[^1]\n\n[^1]: see [^2]\n\n[^2]: y', '[^1]: see [^2]\n[^2]: y\n\n[^1]'],
    ['[l](&#106avascript:alert(1))', '[l]()'],
    ['[l](jav&#X61script:alert(1))', '[l]()'],
    ['[l](&#X6Avascript:alert(1))', '[l](&#X6Avascript:alert(1))'],
    ['![l](java&#9script:alert(1))', '![l]()'],
    ['[l](&#00000000106;avascript:alert(1))', '[l]()'],
    ['[l](&#x000000006a;avascript:alert(1))', '[l]()'],
    ['[l]: &#106avascript:alert(1)\n\n[l]', '[l]: <>\n\n[l]()'],
    [
      '<span>[l](&#106avascript:alert(1))</span>',
      '<span>[l&#93;(&#106avascript:alert(1))</span>',
    ],
    [
      '[^1]\n\n[^1]: &#106avascript:alert(1)',
      '[^1]: <!---->&#106avascript:alert(1)\n\n[^1]',
    ],
    ['[l](/a&#98c)', '[l](/a&#98c)'],
    ['a\nb\n=', '# a b'],
    ['a  \nb\n---', '## a b'],
    [
      '[^1]\n[^1]:&#106avascript:alert(1)\n=',
      '# \\[^1\\] \\[^1\\]:&#106avascript:alert(1)',
    ],
    [
      '[^1]\n[^1]:&#106avascript:alert(1)\n=\n\n[^1]: y',
      '[^1]: y\n\n# [^1] [^1]\\:&#106avascript:alert(1)',
    ],
    [
      '- [^1]: a )\n[^1]:&#106avascript:alert(1)',
      '[^1]: a )\n\n- [^1]\\:&#106avascript:alert(1)',
    ],
    ['<q> <b>x</b>', '<q> <b>x</b>'],
    ['&amp;copy; a &amp; b', '&amp;copy; a & b'],
    ['&amp;#106;', '&amp;#106;'],
    [
      '\n﻿[^1]:javascript:alert(1)\n[^1]',
      '&#xFEFF;\\[^1\\]:javascript:alert(1)\n\\[^1\\]',
    ],
    ['<div>a\n\n<?</div>\n`<b>`', '<div>a\n\n&lt;?</div>\n\n`<b>`'],
    [
      '<title>a\n\n<!--</title>\n\n```\n<b>\n```',
      '<title>a\n\n&lt;!--</title>\n\n```\n<b>\n```',
    ],
    ['<div>a\n\n<!-- b -->\n</div>', '<div>a\n\n<!-- b -->\n</div>'],
    ["<C><?><a e='?>'> onclick/", "<C><?>&lt;a e='?>'> onclick/"],
    [
      '<![CDATA[<?><a e="?>"\n<!--"onclick>]',
      '<!&#91;CDATA[<?>&lt;a e="?>"\n&lt;!--"onclick>]',
    ],
    [
      '1. # [^1]\n[^1]:&#106avascript:alert(1)',
      '[^1]: <!---->&#106avascript:alert(1)\n\n1. # [^1]',
    ],
    [
      '1. a [^1]\n[^1]:&#106avascript:alert(1)',
      '1. a \\[^1\\]\n   \\[^1\\]:&#106avascript:alert(1)',
    ],
    [
      '1. # [^1]\n[^1]:&#106avascript:alert(1)\n\n[^1]: y',
      '[^1]: <!---->&#106avascript:alert(1)\n\n1. # [^1]',
    ],
    [
      '1. <!-- c --> x\n[^1]:&#106avascript:alert(1)\n\n[^1]',
      '[^1]: <!---->&#106avascript:alert(1)\n\n1. <!-- c --> x\n\n[^1]',
    ],
    ['- <pre>x\ny</pre>', '- <pre>x\n\ny</pre>'],
    ['- <!-- x\ny -->', '- <!-- x\n\ny -->'],
    [
      '- <div\nonclick=alert(1)>x</div>',
      '- &lt;div\n\nonclick=alert(1)>x</div>',
    ],
    ['- a <div\nonclick=alert(1)>x</div>', '- a \n  <div>x</div>'],
    ['- <x-y\nonclick=alert(1)>y</x-y>', '- <x-y>y</x-y>'],
    ['- <Foo x="1\n2">y</Foo>', '- <Foo x="1&#10;2">y</Foo>'],
    ['- ```\ny', '- ```\n  \n  ```\n\ny'],
    ['1. <x-y>x\ny', '1. <x-y>x\n   y'],
    ['1. [r]:\n/u "a\nb"\n\n   [r]', '[r]: /u "a\nb"\n\n1. [r](/u "a\n   b")'],
    ['- a | b\n  --- | ---\nc | d', '- | a | b |\n  | --- | --- |\n\nc | d'],
    [
      '- <b>f</b><!-- c --><img\nsrc=x>z onclick=alert(1)',
      '- <b>f</b>\n  <!-- c --><img src=x>z onclick=alert(1)',
    ],
    ['- # h\na | b\n  --- | ---', '- # h\n\n| a | b |\n| --- | --- |'],
    ['- - [^1]:\nz\n\n  [^1]', '[^1]: z\n\n- - \n  \n  [^1]'],
    ['[r]: a\\\nb\n\n[r]', '[r]: a\\\\\n\nb\n\n[r](a\\\\)'],
    ['[r]: a\\ "t"\n\n[r]', '[r]: a\\\\ "t"\n\n[r](a\\\\ "t")'],
    ['[r]: <a\\\nb>', '\\[r\\]: &lt;a  \nb>'],
    ['[x](a\\\\)', '[x](a\\\\)'],
    ['[x](a\\b)', '[x](a\\b)'],
    ['1. [^1]:\nb\n\n   [^1]', '[^1]: b\n\n1. \n   [^1]'],
    ['- <b>x</b>\ny\n===', '- <b>x</b>\n  \n  y\n  \\==='],
    [
      '<div <b c="d"/>\n<![CDATA[</pre>\n\n```\n<b>\n```',
      '<div <b c="d"/>\n&lt;![CDATA[</pre>\n\n\n```\n<b>\n```',
    ],
    [
      '<p><!--\n\n<a e="--><b e=">">\n<div>"onclick=alert(1)>',
      '<p><!--\n\n\n<a >">\n\n<div>"onclick=alert(1)>',
    ],
    [
      '<textarea>```\n```\n</script>\n    [x](&#106avascript:alert(1))',
      '<textarea>```\n```\n</script>\n\n<pre><code>&#91;x&#93;(&amp;#106avascript:alert(1))\n</code></pre>',
    ],
    [
      '<details>\n<summary>x</summary>\n\n```js\ncode\n```\n\n</details>',
      '<details>\n<summary>x</summary>\n\n```js\ncode\n```\n\n</details>',
    ],
    [
      '<div>\n\n```\n``` \n\n</div>\n\n```\n<img src=x onerror=alert(1)>\n',
      '<div>\n\n```\n``` \n\n</div>\n\n<pre><code>&lt;img src=x onerror=alert(1)>\n</code></pre>',
    ],
    [
      '<![CDATA[a]]]>\n\n```\n<img src=x onerror=alert(1)>\n```',
      '<![CDATA[a]]]>\n\n\n<pre><code>&lt;img src=x onerror=alert(1)>\n</code></pre>',
    ],
    [
      '- <?p ?> <?q ?>[x](\njavascript:alert(1))',
      '- <?p ?> <?q ?>[x&#93;(\n\njavascript:alert(1))',
    ],
    ['- a <?p ?> <?q ?>[x](\njavascript:alert(1))', '- a <?p ?> <?q ?>[x]()'],
    [
      '1. <!X>![x]( \rjavascript:alert(1))',
      '1. <!X>![x&#93;( \n\njavascript:alert(1))',
    ],
    ['1. a <!X>![x]( \rjavascript:alert(1))', '1. a <!X>![x]()'],
    [
      '<div>\n\n```\n```\t\n\n</div>\n\n```\n<img src=x onerror=alert(1)>\n',
      '<div>\n\n```\n```\t\n\n</div>\n\n<pre><code>&lt;img src=x onerror=alert(1)>\n</code></pre>',
    ],
    [
      '<div>\n\n```\n```~\n```\n\n</div>\n\n```\n<img src=x onerror=alert(1)>\n',
      '<div>\n\n```\n```~\n```\n\n</div>\n\n<pre><code>&lt;img src=x onerror=alert(1)>\n</code></pre>',
    ],
    [
      '<details>\n\n```\n```js\n```\n\n</details>',
      '<details>\n\n```\n```js\n```\n\n</details>',
    ],
    [
      '<script></textarea></script >\n\n```\n<img src=x onerror=alert(1)>\n```',
      '<script></textarea></script >\n\n<pre><code>&lt;img src=x onerror=alert(1)>\n</code></pre>',
    ],
    [
      `> <div a=1${String.fromCharCode(0x20_28)}>  onclick=alert(1) b>y</div>`,
      '> <div a=1&#8232;>  onclick=alert(1) b>y</div>',
    ],
    ['<pre>a &lt; b &amp; c</pre>', '<pre>a &lt; b &amp; c</pre>'],
    ['[r](<a b)c>)', '[r](<a%20b)c>)'],
    ['[r](</a b>)', '[r](/a%20b)'],
    ['![r](</a b>)', '![r](/a%20b)'],
    ['[x](<a) [y](/u>)', '[x](<a)%20%5By%5D(/u>)'],
    ['[r]: <a b>\n\n[r]', '[r]: a%20b\n\n[r](a%20b)'],
    ['[x](<a(b>)', '[x](<a(b>)'],
    ['[a](b<c)', '[a](b%3Cc)'],
    ['[a](x&#1;y)', '[a](x%01y)'],
    ['![a](x&#127;y)', '![a](x%7Fy)'],
    [
      `> <div </div${String.fromCharCode(0x20_28)}>\nonclick='alert(1)'`,
      "> <div </div&#8232;>\n>\n\nonclick='alert(1)'",
    ],
    [
      `> a <div </div${String.fromCharCode(0x20_28)}>\nonclick='alert(1)'`,
      `> a &lt;div &lt;/div${String.fromCharCode(0x20_28)}>\n> onclick='alert(1)'`,
    ],
    [
      '/\n    <pre>\n```\n<img src=x onerror=alert(1)>\n```',
      '/\n<pre>\n\n<pre><code>&lt;img src=x onerror=alert(1)>\n</code></pre>',
    ],
    ['[^a`b] `<img src=x onerror=alert(1)>`', '\\[^a`b] `<img src=x>\\`'],
    [
      '[^a`b] `<img src=x onerror=alert(1)>`\n\n[^a`b]: y',
      '[^a`b]: y\n\n[^a`b] <code>&lt;img src=x onerror=alert(1)></code>',
    ],
    [
      '[r]: /u "\n```\n"\n\n```\n<img src=x onerror=alert(1)>\n```',
      '[r]: /u "\n```\n"\n\n<pre><code>&lt;img src=x onerror=alert(1)>\n</code></pre>',
    ],
    [
      '- <div/>`<img src=x onerror=alert(1)>`',
      '- <div></div>\n  <code>&lt;img src=x onerror=alert(1)></code>',
    ],
    [
      '- z\n  <b/>\n  `<img src=x onerror=alert(1)>`',
      '- z\n  <b/>\n  <code>&lt;img src=x onerror=alert(1)></code>',
    ],
    [
      '- <br>\n  `<img src=x onerror=alert(1)>`',
      '- <br>\n  <code>&lt;img src=x onerror=alert(1)></code>',
    ],
    [
      '- a\n  - <div/>\n  `<img src=x onerror=alert(1)>`',
      '- a\n  - <div></div>\n  <code>&lt;img src=x onerror=alert(1)></code>',
    ],
    [
      '- a\n\n- z\n  <b/>\n  `<img src=x onerror=alert(1)>`',
      '- a\n\n- z\n  <b/>\n  <code>&lt;img src=x onerror=alert(1)></code>',
    ],
    [
      '<b>`</b>x`<img src=x onerror=alert(1)>`',
      '<b>`</b>x<code>&lt;img src=x onerror=alert(1)></code>',
    ],
    [
      'z\n    <div>`<img src=x onerror=alert(1)>`',
      'z\n<div><code>&lt;img src=x onerror=alert(1)></code>',
    ],
    [
      '~~~<a href="javascript:alert(1)">\nq\n~~~',
      '<pre><code>q\n</code></pre>',
    ],
    [
      '`[x](javascript:alert(1))`',
      '<code>&#91;x&#93;(javascript&#58;alert(1))</code>',
    ],
    [
      '`<img onerror=x> https://a.b/c`',
      '<code>&lt;img onerror=x> https&#58;//a&#46;b/c</code>',
    ],
    [
      '`<img onerror=x> www.a.com`',
      '<code>&lt;img onerror=x> www&#46;a&#46;com</code>',
    ],
    [
      '`<img onerror=x> a@b.co`',
      '<code>&lt;img onerror=x> a&#64;b&#46;co</code>',
    ],
    [
      '- <?a ?>[x]:\n  javascript:alert(1)\n\n<span>[x]</span>',
      '- <?a ?>[x&#93;:\n  javascript:alert(1)\n\n<span>[x]</span>',
    ],
    [
      '- <!A >[x]:\n  javascript:alert(1)\n\n<span>[x]</span>',
      '- <!A >[x&#93;:\n  javascript:alert(1)\n\n<span>[x]</span>',
    ],
    [
      '1. <![CDATA[a]]>[x]:\n   &#106;avascript:alert(1)\n\n<span>[y][x]</span>',
      '1. <![CDATA[a]]>[x&#93;:\n   javascript:alert(1)\n\n<span>[y][x]</span>',
    ],
    ['a[^1]\n\n[^1]: 100% of people', '[^1]: 100% of people\n\na[^1]'],
    [
      'a[^1]\n\n[^1]: <!---->Javascript: x',
      '[^1]: <!---->Javascript: x\n\na[^1]',
    ],
    ['1. ```\n   foo\n   ```', '1. ```\n   foo\n   ```'],
    ['10. ```\n    foo\n    ```', '10. ```\n    foo\n    ```'],
    [
      '1. ```\n   <img onerror=x>\n   ```',
      '1. <pre><code>&lt;img onerror=x>\n   </code></pre>',
    ],
    ['a #\n=', '# a \\#'],
    ['# a \\#', '# a \\#'],
    ['## a ###', '## a'],
    ['# a#', '# a#'],
    [
      '```html\n<button onclick="go()">*go*</button>\n```',
      '<pre><code class="language-html">&lt;button onclick="go()">&#42;go&#42;&lt;/button>\n</code></pre>',
    ],
    ['`<div>`', '`<div>`'],
    ['```html\n<div>hi</div>\n```', '```html\n<div>hi</div>\n```'],
    [
      '<pre/>\n\n```\n<img src=x onerror=alert(1)>\n```',
      '<pre>\n\n\n<pre><code>&lt;img src=x onerror=alert(1)>\n</code></pre>',
    ],
    [
      '<pre/>y\n\n```\n<img src=x onerror=alert(1)>\n```',
      '<pre>y\n\n\n<pre><code>&lt;img src=x onerror=alert(1)>\n</code></pre>',
    ],
    [
      '<![CDATA[\n<![CDATA[]]]>\n\n```\n<img src=x onerror=alert(1)>\n```',
      '<![CDATA[\n<![CDATA[]]]>\n\n\n<pre><code>&lt;img src=x onerror=alert(1)>\n</code></pre>',
    ],
    ['[^a](javascript:alert(1))', '[^a]()'],
    [
      '[^a](javascript:alert(1))\n\n[^a]: y',
      '[^a]: y\n\n[^a]\\(javascript:alert(1))',
    ],
    [
      'y [^a<img src=x onerror=alert(1)>]\n\n[^a<img src=x onerror=alert(1)>]: a',
      '[^a&lt;img src=x onerror=alert&#40;1)>]: a\n\ny [^a&lt;img src=x onerror=alert&#40;1)>]',
    ],
    [
      '[^1]: a b\n[r]: a "[x](javascript:alert(1))"',
      '[^1]: a b\n[r]: a "&#91;x&#93;(javascript:alert(1))"',
    ],
    [
      '[^1]: a [\n[r]: a "](javascript:alert(1))"',
      '[^1]: a [\n[r]: a "&#93;(javascript:alert(1))"',
    ],
    [
      '[\\[a\\](javascript:alert(1))](/u)',
      '[\\[a\\]\\(javascript:alert(1))](/u)',
    ],
    [
      '\\\n[^1]:&#106avascript:alert(1)\n[^1]',
      '  \n\\[^1\\]:&#106avascript:alert(1)\n\\[^1\\]',
    ],
    [
      '\\\n[^1]:&#106avascript:alert(1)\n[^1]\n\n[^1]: y',
      '[^1]: y\n\n  \n[^1]\\:&#106avascript:alert(1)\n[^1]',
    ],
    ['x&#60;~~~~javascript:alert(1)>', 'x<\\~\\~\\~\\~javascript:alert(1)>'],
    [
      '<div>\n<![cdata[><a e="]]>">\n</div>',
      '<div><!&#91;cdata[>&lt;a e="]]>">\n</div>',
    ],
    [
      '<?e><a e="?>">\n<style>"onclick=alert(1)>',
      '<?e>&lt;a e="?>">\n\n\n<style>"onclick=alert(1)>',
    ],
    [
      "<?p ?><![CDATA[x><a e=']]>'>\n<style>'onclick=alert(1)>",
      "<?p ?><![CDATA[x>&lt;a e=']]>'>\n\n\n<style>'onclick=alert(1)>",
    ],
    ['<?php echo "</b>"; ?>', '<?php echo "</b>"; ?>'],
    ['<?php echo "<b>"; echo "<i>"; ?>', '<?php echo "<b>"; echo "&lt;i>"; ?>'],
    [
      '<?p ?><!DOCTYPE html>```\n```\n<svg onload=alert(1)>',
      '<?p ?><!DOCTYPE html>```\n\n\n<pre><code>&lt;svg onload=alert(1)>\n</code></pre>',
    ],
    [
      '<?p ?> <?q ?><![CDATA[x]]>~~~\n~~~\n<svg onload=alert(1)>',
      '<?p ?> <?q ?><![CDATA[x]]>~~~\n\n\n<pre><code>&lt;svg onload=alert(1)>\n</code></pre>',
    ],
    [
      '<?p ?><!-- a -->```\n```\n<svg onload=alert(1)>',
      '<?p ?><!-- a -->```\n\n\n<pre><code>&lt;svg onload=alert(1)>\n</code></pre>',
    ],
    [
      '<?p ?><!-->```\n```\n<svg onload=alert(1)>',
      '<?p ?><!-->```\n\n\n<pre><code>&lt;svg onload=alert(1)>\n</code></pre>',
    ],
    [
      '[l](/u "--><img src=x onerror=alert(1)>")',
      '[l](/u "-->&lt;img src=x onerror=alert(1)>")',
    ],
    ['![a"--><img src=x onerror=alert(1)>](/x)', '![a&quot;-->](/x)'],
    ['<?>\n\n```\n<img src=x>\n```', '<?>\n\n\n```\n<img src=x>\n```'],
    [
      '<?>\n\n```\n<img src=x onerror=alert(1)>\n```',
      '<?>\n\n\n<pre><code>&lt;img src=x onerror=alert(1)>\n</code></pre>',
    ],
    ['<?x?>', '<?x?>'],
    ['![" onclick=alert(1)>](/x)', '![&quot; onclick=alert(1)>](/x)'],
    ['![a &quot;b&quot; c](/x)', '![a &quot;b&quot; c](/x)'],
    [
      '<svg>](<javascript:alert(1)></svg>',
      '<svg>&#93;(&lt;javascript:alert(1)></svg>',
    ],
    [
      '<!DOCTYPE html>](<javascript:alert(1)>',
      '<!DOCTYPE html>&#93;(&lt;javascript:alert(1)>',
    ],
    [
      '| a | b |\n|---|---|\n[l](javascript:alert(1)',
      '| a | b |\n| --- | --- |\n| \\[l\\]\\(javascript:alert(1) |  |',
    ],
    [
      '| h | i |\n|---|---|\n| a\\\\\\|b | z |',
      '| h | i |\n| --- | --- |\n| a\\\\\\|b | z |',
    ],
    [
      '| h | i |\n|---|---|\n| `a\\\\b` | z |',
      '| h | i |\n| --- | --- |\n| `a\\\\b` | z |',
    ],
    [
      '| h | i |\n|---|---|\n| a\\\\ | z |',
      '| h | i |\n| --- | --- |\n| a\\\\ | z |',
    ],
    [
      '| h | i |\n|---|---|\n| \\*x\\* | z |',
      '| h | i |\n| --- | --- |\n| \\*x\\* | z |',
    ],
    ['[^1]: data:text/html,x\n[^1]', '[^1]: <!---->data:text/html,x\n\n[^1]'],
    [
      '<foreignObject>~~~~```x onmouseover="alert(1)"\n<svg onload=alert(1)>```\n',
      '<foreignObject>\\~\\~\\~\\~<code>x onmouseover="alert(1)" &lt;svg onload=alert(1)></code>',
    ],
    [
      '[^1]: <iframe srcdoc="x"></iframe>[r][^1]',
      '[^1]: <iframe></iframe>\\[r\\][^1]',
    ],
    [
      '<annotation-xml>[^1]: ](javascript:alert(1)',
      '[^1]: <!---->\\]\\(javascript:alert(1)\n\n<annotation-xml>[^1]: &#93;(javascript:alert(1)',
    ],
    ['a[^1]\n\n[^1]: hi [x](javascript:alert(1))', '[^1]: hi [x]()\n\na[^1]'],
    ['a[^1]\n\n[^1]: [x](javascript:alert(1))', '[^1]: [x]()\n\na[^1]'],
    ['a[^1]\n\n[^1]: hi ![x](javascript:alert(1))', '[^1]: hi ![x]()\n\na[^1]'],
    [
      'a[^1]\n\n[^1]: hi `[x](javascript:alert(1))`',
      '[^1]: hi <code>&#91;x&#93;(javascript&#58;alert(1))</code>\n\na[^1]',
    ],
    ['![a](&amp;#106;avascript:alert(1))', '![a]()'],
    ['[x](javascript:alert(1) "t")', '[x]()'],
    ['<pre>a', '<pre>a'],
    ['<div><pre>a', '<div><pre>a'],
    ['<div>\n\n', '<div></div>'],
    ["<div </div>'", "<div </div>'"],
    ['<?php echo 1 ?>', '<?php echo 1 ?>'],
    ['<!DOCTYPE html>', '<!DOCTYPE html>'],
    ['<!doctype html>', '<!doctype html>'],
    ['<![CDATA[x]]>', '<![CDATA[x]]>'],
    ['a <?b?> c', 'a <?b?> c'],
    ['a <!B c> d', 'a <!B c> d'],
    ['x <!a b> y', 'x <!a b> y'],
    ['a <![CDATA[b]]> c', 'a <![CDATA[b]]> c'],
    ['a <!-- b --> c', 'a <!-- b --> c'],
    ['[l](java&Tab;script:alert(1))', '[l]()'],
    ['<a href="java\tscript:alert(1)">l</a>', '<a>l</a>'],
    ['<a href="java\nscript:alert(1)">l</a>', '<a>l</a>'],
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
      '&lt;a title="?><!--[^1]: ![a&#93;(javascript:alert(1))\n</div\n-->',
    ],
    [
      '1. </div x={a ><img src=x onerror=alert(1)>}>    innerHTML="x<img src=x onerror=alert(1)>"',
      '1. </div>\n   \n   <pre><code>innerHTML="x&lt;img src=x onerror=alert(1)>"\n   </code></pre>',
    ],
    [
      '- </div x={a ><img src=x onerror=alert(1)>}>    <b onclick=alert(1)>b</b>',
      '- </div>\n  \n  <pre><code>&lt;b onclick=alert(1)>b&lt;/b>\n  </code></pre>',
    ],
    [
      '<div x={a><a title="</textarea>[^1]: ![a](javascript:alert(1))\nprop:innerHTML="x<img src=x onerror=alert(1)>"](onclick={alert(1)}',
      '<div x={a>&lt;a title="&lt;/textarea>[^1]: !&#91;a&#93;(javascript:alert(1))\nprop:innerHTML="x&lt;img src=x onerror=alert(1)>"](onclick={alert(1)}',
    ],
    [
      '![<!---></span ](javascript:alert(1))>![a"--><img src=x onerror=alert(1)>](/x)',
      '![&lt;/span \\](javascript:alert(1))>!\\[a&quot;-->](/x)',
    ],
    [
      '![a\\\\\\](javascript:alert(1))b](/x)',
      '![a\\\\\\](javascript:alert(1))b](/x)',
    ],
    ['![a [b] c](/x)', '![a \\[b\\] c](/x)'],
  ])('writes %j as %j', (input, expected) => {
    expect(compiler(input)).toBe(expected)
  })

  it.each([
    [
      '<br>\n\n```\n<img src=x onerror=alert(1)>\n```',
      '<pre></pre>\n\n<pre><code>&lt;img src=x onerror=alert(1)>\n</code></pre>',
      'br',
      'pre',
    ],
    [
      '<div>\nx\n\n```\n<img src=x onerror=alert(1)>\n```',
      '<pre>x\n\n\n<pre><code>&lt;img src=x onerror=alert(1)>\n</code></pre>',
      'div',
      'pre',
    ],
    [
      '<b/>\n\n```\n<img src=x onerror=alert(1)>\n```',
      '<script></script>\n\n<pre><code>&lt;img src=x onerror=alert(1)>\n</code></pre>',
      'b',
      'script',
    ],
    [
      '<span>y</span>`<img src=x onerror=alert(1)>`',
      '<div>y</div>\n\n<code>&lt;img src=x onerror=alert(1)></code>',
      'span',
      'div',
    ],
    [
      '<div>\n<a title="></textarea>\nplain "text"\n<div>"onclick=alert(1)>',
      '<pre>&lt;a title=">&lt;/textarea>\n\nplain "text"\n\n<div>"onclick=alert(1)>',
      'div',
      'pre',
    ],
    [
      '<div>\n<a title="></textarea>\n[r]: a "x"\n<div>"onclick=alert(1)>',
      '[r]: a "x"\n\n<pre>&lt;a title=">&lt;/textarea>\n\n<div>"onclick=alert(1)>',
      'div',
      'pre',
    ],
    [
      '<pre>\n<a title=">\n\nplain "text"\n\n<div>"onclick=alert(1)>\n</pre>',
      '<div>&lt;a title=">\n\n\nplain "text"\n\n<div>"onclick=alert(1)></pre>',
      'pre',
      'div',
    ],
    [
      '<pre/>`<img src=x onerror=alert(1)>`',
      '<script>`<img src=x>`',
      'pre',
      'script',
    ],
    ['<div>y</div>', '<section>y</section>', 'div', 'section'],
    [
      '- <script></textarea></script\v>\n&gt;- <b>f</b><!-- c --><img\nsrc=x> onclick=alert(1)',
      '- <script></textarea></script\v>\n\n\\>- <script>f</script><!-- c --><img\nsrc=x> onclick=alert(1)',
      'b',
      'script',
    ],
    [
      '- a <script></textarea></script\v>\n&gt;- <b>f</b><!-- c --><img\nsrc=x> onclick=alert(1)',
      '- a <script></textarea>&lt;/script\v>\n  \\>-\n  \n  <script>f</script>\n  <!-- c --><img src=x> onclick=alert(1)',
      'b',
      'script',
    ],
    [
      '- <script></textarea></script\v>\n&gt;- <b>f</b><!DOCTYPE html><Foo x={1\nsrc=x}> onclick=alert(1)',
      '- <script></textarea></script\v>\n\n\\>- <script>f</script><!DOCTYPE html><Foo x={1\nsrc=x}> onclick=alert(1)',
      'b',
      'script',
    ],
    [
      '- a <script></textarea></script\v>\n&gt;- <b>f</b><!DOCTYPE html><Foo x={1\nsrc=x}> onclick=alert(1)',
      '- a <script></textarea>&lt;/script\v>\n  \\>-\n  \n  <script>f</script>\n  <!DOCTYPE html><Foo x={1 src=x}> onclick=alert(1)',
      'b',
      'script',
    ],
  ] as const)('writes %j as %j when %j is renamed to %j', (input, expected, tag, component) => {
    expect(compiler(input, { overrides: { [tag]: { component } } })).toBe(
      expected
    )
  })

  it('writes reference links once when an override renames a tag', () => {
    expect(
      compiler('[a](/u "t")\n\n<div>y</div>', {
        overrides: { div: 'section' },
        useReferenceLinks: true,
      })
    ).toBe('[a][ref1]\n\n<section>y</section>\n\n[ref1]: /u "t"')
  })

  it('writes no handler of a lowercase tag an override matches when an override renames another tag', () => {
    expect(
      compiler('<my-widget onclick={fn}>x</my-widget>\n\n<div>y</div>', {
        overrides: { div: 'section', 'my-widget': { props: {} } },
      })
    ).toBe('<my-widget >x</my-widget>\n\n\n<section>y</section>')
  })

  it.each([
    ['<Btn onClick={go}>x</Btn>', '<Btn >x</Btn>'],
    ['<Btn onClick={() => x > 1}>x</Btn>', '<Btn >x</Btn>'],
    ['<Img src=x onerror={steal()}>', '<Img src=x>'],
    [
      '<Btn onClick={go} style={{ a: 1 }}>x</Btn>',
      '&lt;Btn onClick={go} style={{ a: 1 }}>x</Btn>',
    ],
    [
      '<div><Btn onClick={go} style={{ a: 1 }}>x</Btn></div>',
      '<div>&lt;Btn onClick={go} style={{ a: 1 }}>x</Btn></div>',
    ],
    ['a <Btn onClick={go} style={{ a: 1 }}>x</Btn>', 'a <Btn>x</Btn>'],
    [
      '<Btn onclick={a} x={ onclick={b} }>y</Btn>',
      '&lt;Btn onclick={a} x={ onclick={b} }>y</Btn>',
    ],
    ['<Btn onClick>x</Btn>', '<Btn >x</Btn>'],
    ['<Img onerror>', '<Img >'],
    ['<my-widget online>x</my-widget>', '<my-widget >x</my-widget>'],
    ['<Btn onClick={[1]}>x</Btn>', '<Btn >x</Btn>'],
  ])('writes the brace handler in %j as %j when `overrides` does not register the tag', (input, expected) => {
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

  it.each(
    ['Card', 'CARD', 'CaRd'].flatMap(tag =>
      ['Card', 'card', 'CARD'].map(key => [tag, key])
    )
  )('writes <%s> as the component a %j key names', (tag, key) => {
    expect(
      compiler(`a <${tag} data={[1]}>x</${tag}>`, {
        overrides: { [key]: { component: 'aside' } },
      })
    ).toBe('a <aside data={[1]}>x</aside>')
  })

  it('writes <card> as HTML against a `Card` key', () => {
    expect(
      compiler('a <card data={[1]}>x</card>', {
        overrides: { Card: { component: 'aside' } },
      })
    ).toBe('a <card data={[1]}>x</card>')
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
      'a <Card data={[1]} title="t">x</Card> b',
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
    ).toBe('x <a href="/" class="x">y</a>')
  })

  const widget = { 'my-widget': { props: {} } }
  const renamed = 'x <b href="/">y</b>'
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
      'x <a href="/" class="x">y</a>',
    ],
    [
      'x <a href="/" onclick={alert(1)}>y</a>',
      { a: 'span' },
      'x <span href="/">y</span>',
    ],
    [
      'x <img src="/x.png" onerror="alert(1)"> y',
      { img: { props: {} } },
      'x <img src="/x.png"> y',
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
      'a <my-widget>x</my-widget>',
    ],
    [
      'a <my-widget onclick="alert(1)">x</my-widget>',
      widget,
      'a <my-widget>x</my-widget>',
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
      'x <a href="/">y</a>',
    ],
    ['<Btn onClick={go}>x</Btn>', { Btn: { props: {} } }, '<Btn >x</Btn>'],
    [handBuiltLink, undefined, '<a href="/" />'],
    [handBuiltLink, { a: { component: 'b' } }, '<b href="/" ></b>'],
    [handBuiltText, undefined, '<span>t</span>'],
    [handBuiltBlock('div'), undefined, '<div>\nx\n</div>'],
    [handBuiltBlock('my-widget'), widget, '<my-widget>\nx\n</my-widget>'],
    [
      storedAST('x <a href="/" onclick="alert(1)">y</a>', { a: { props: {} } }),
      { a: { props: {} } },
      'x <a href="/">y</a>',
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
      'a <my-widget>x</my-widget>',
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
      '<div><my-widget >x</my-widget>\n</div>',
    ],
    [
      storedAST('<div><img src=x onerror="alert(1)"></div>'),
      undefined,
      '<div><img src=x></div>',
    ],
    [
      storedAST('<pre>\n<img src=x onerror="alert(1)">\n</pre>'),
      undefined,
      '<pre><img src=x></pre>',
    ],
    [
      storedAST('</div><img src=x onerror="alert(1)">'),
      undefined,
      '<div><img src=x></div>',
    ],
    [
      storedAST('x <a href="/" onclick="alert(1)">y</a>'),
      undefined,
      'x <a href="/">y</a>',
    ],
    [
      storedAST('<Btn onClick={go}>x</Btn>', { Btn: { props: {} } }),
      { Btn: { props: {} } },
      '<Btn>x</Btn>',
    ],
  ] as const)('writes %j with %j as %j', (input, overrides, expected) => {
    if (typeof input === 'string') {
      expect(compiler(input, { overrides })).toBe(expected)
      return
    }
    expect(astToMarkdown(input, { overrides })).toBe(expected)
  })

  it('writes a hand-built code block as a fence, without its attributes (a fence has no place for them, so neither data-x nor the handler is written)', () => {
    const ast = parser('```js\nx\n```')
    Object.assign(ast[0], { attrs: { 'data-x': 'y', onclick: 'alert(1)' } })
    expect(astToMarkdown(ast)).toBe('```js\nx\n```')
  })

  it('gives renderRule the handler of a lowercase tag an override matches, as written', () => {
    const seen: unknown[] = []
    const markdown = compiler(
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
    expect(markdown).toBe('x <b href="/">y</b> <b>z</b>')
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
      '<constructor>hi</constructor>',
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

  it.each([
    ['a\\<b', 'a&lt;b'],
    ['a <b', 'a &lt;b'],
    ['1 < 2', '1 < 2'],
    ['x < y', 'x < y'],
    ['1 <2', '1 <2'],
    ['~~x~~`<b>`', '~~x~~`<b>`'],
  ])('keeps benign text bytes: %j as %j', (input, expected) => {
    expect(compiler(input)).toBe(expected)
  })
})

describe('a children attribute on a tag with an override', () => {
  const card = { card: { component: 'i' } }

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
      'a\n\n<i>z</i>\n\nb',
    ],
    [
      'a self-closing tag inside a paragraph',
      'x <Card children="z" /> y',
      card,
      'x <i>z</i> y',
    ],
    ['a lowercase self-closing tag', '<card children="z" />', card, '<i>z</i>'],
    [
      'a lowercase self-closing tag when the override is inherited',
      '<card children="z" />',
      Object.create(card),
      '<i>z</i>',
    ],
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
    [
      'a hyphenated empty pair',
      '<my-el children="z"></my-el>',
      { 'my-el': { component: 'i' } },
      '<i>z</i>',
    ],
    [
      'a hyphenated empty pair kept as written',
      '<my-el children="z"></my-el>',
      { 'my-el': { props: {} } },
      '<my-el >z</my-el>',
    ],
    ['a lowercase empty pair', '<card children="z"></card>', card, '<i>z</i>'],
    [
      'a lowercase empty pair between blocks',
      'a\n\n<card children="z"></card>\n\nb',
      card,
      'a\n\n<i>z</i>\n\nb',
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
      'x <i>z</i> y',
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
      '<i>z</i>',
    ],
    [
      'a value read as text, with its entity and markup escaped',
      '<Card children="a &amp; <b>" />',
      card,
      '<i>a &amp;amp; &lt;b></i>',
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
      '<img >',
    ],
    [
      'a pair with content of its own',
      '<card children="z">inner</card>',
      card,
      '<i>inner</i>',
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
      'a\n\n<i>z</i>\n\nb',
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
      '<i>a >  < b</i>',
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

  const visibleText = (html: string, tag: string) => {
    const match = new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, 's').exec(html)

    if (match === null) {
      throw new Error(`no <${tag}> element in ${html}`)
    }

    return match[1]
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
  }

  it.each<[string, 'i' | 'div', string, string]>([
    ['<b>', 'i', '<i>&lt;b></i>', 'Before <i>&lt;b></i> after.'],
    [
      '[x](javascript:y)',
      'i',
      '<i>&#91;x&#93;&#40;javascript:y)</i>',
      'Before <i>&#91;x&#93;&#40;javascript:y)</i> after.',
    ],
    ['*a*', 'i', '<i>&#42;a&#42;</i>', 'Before <i>&#42;a&#42;</i> after.'],
    [
      '&amp;copy;',
      'i',
      '<i>&amp;amp;copy;</i>',
      'Before <i>&amp;amp;copy;</i> after.',
    ],
    ['<b>', 'div', '<div >&lt;b></div>', 'Before <div>&lt;b></div> after.'],
    [
      '[x](javascript:y)',
      'div',
      '<div >&#91;x&#93;&#40;javascript:y)</div>',
      'Before <div>&#91;x&#93;&#40;javascript:y)</div> after.',
    ],
    [
      '*a*',
      'div',
      '<div >&#42;a&#42;</div>',
      'Before <div>&#42;a&#42;</div> after.',
    ],
    [
      '&amp;copy;',
      'div',
      '<div >&amp;amp;copy;</div>',
      'Before <div>&amp;amp;copy;</div> after.',
    ],
  ])('writes the value %j in a %s tag with entities only (alone on its line a block tag opens a raw HTML block where a backslash shows as text, and inline the value is read as markdown again, so only an entity is inert in both), so marked and micromark show it as written', (value, tag, alone, inline) => {
    const overrides = { Card: { component: tag, props: {} } }
    const aloneOutput = compiler(`<Card children="${value}" />`, { overrides })
    const inlineOutput = compiler(
      `Before <Card children="${value}" /> after.`,
      {
        overrides,
      }
    )

    expect(aloneOutput).toBe(alone)
    expect(inlineOutput).toBe(inline)

    for (const output of [aloneOutput, inlineOutput]) {
      const markedHtml = marked.parse(output, { async: false })
      const micromarkHtml = micromark(output, {
        allowDangerousHtml: true,
        allowDangerousProtocol: true,
      })

      expect(visibleText(markedHtml, tag)).toBe(value)
      expect(visibleText(micromarkHtml, tag)).toBe(value)
    }
  })
})

describe('a URL that names a dangerous scheme', () => {
  it.each([
    [
      '[a](https://en.wikipedia.org/wiki/Javascript:_The_Good_Parts)',
      '[a](https://en.wikipedia.org/wiki/Javascript:_The_Good_Parts)',
    ],
    [
      '<https://example.com/?q=javascript:x>',
      '[https://example.com/?q=javascript:x](https://example.com/?q=javascript:x)',
    ],
    [
      '<a href="/docs/javascript:intro">x</a>',
      '<a href="/docs/javascript:intro">x</a>',
    ],
    ['[l](/[x](javascript:alert(1)))', '[l]()'],
    ['[x](\n?>[x](javascript:alert(1) "t")', '[x]()'],
    ['[a](javascript:alert(1))', '[a]()'],
    ['[a](feed:javascript:alert(1))', '[a]()'],
  ])('writes %j as %j, by where a browser reads a scheme', (input, expected) => {
    expect(compiler(input)).toBe(expected)
  })
})

describe('the character rules of the raw string screens', () => {
  const screen = (text: string) =>
    astToMarkdown({ raw: true, text, type: RuleType.htmlComment })

  const hex = (code: number) => code.toString(16).toUpperCase().padStart(4, '0')

  const ECMASCRIPT_SPACE_CODES = [
    0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x20, 0xa0, 0x16_80, 0x20_00, 0x20_01,
    0x20_02, 0x20_03, 0x20_04, 0x20_05, 0x20_06, 0x20_07, 0x20_08, 0x20_09,
    0x20_0a, 0x20_28, 0x20_29, 0x20_2f, 0x20_5f, 0x30_00, 0xfe_ff,
  ]

  const ZERO_WIDTH_CONTROL_AND_FORMER_SPACE_CODES = [
    0x85, 0x18_0e, 0x20_0b, 0x20_60,
  ]

  it.each(
    ECMASCRIPT_SPACE_CODES.map(code => [hex(code), String.fromCharCode(code)])
  )('U+%s separates `](` from its destination and ends a destination', (_, space) => {
    expect(screen(`](${space}javascript:x)`)).toBe(
      `&#93;(${space}javascript:x)`
    )
    expect(screen(`](a${space}<javascript:x>`)).toBe(
      `](a${space}&lt;javascript:x>`
    )
  })

  it.each(
    ZERO_WIDTH_CONTROL_AND_FORMER_SPACE_CODES.map(code => [
      hex(code),
      String.fromCharCode(code),
    ])
  )('U+%s is part of a destination', (_, character) => {
    expect(screen(`](a${character}<javascript:x>`)).toBe(
      `&#93;(a${character}&lt;javascript:x>`
    )
  })

  it.each([
    ['](/a)javascript:x', '](/a)javascript:x'],
    ['](/a>javascript:x', '](/a>javascript:x'],
    ['](/a]javascript:x', '](/a]javascript:x'],
    [']:javascript:x', '&#93;:javascript:x'],
    [']:', '&#93;:'],
    [']:  \n', '&#93;:  \n'],
    ['](', '&#93;('],
    ['](  \n', '&#93;(  \n'],
    ['](x', '](x'],
    [']x', ']x'],
    ['](<javascript:x', '&#93;(&lt;javascript:x'],
    [']( <javascript:x', '&#93;( &lt;javascript:x'],
    ['](/a](javascript:x', '](/a&#93;(javascript:x'],
    ['<javascript:x>', '&lt;javascript:x>'],
    ['<JavaScript:x>', '&lt;JavaScript:x>'],
    ['<j:](javascript:x>', '<j:&#93;(javascript:x>'],
    ['<jj:](javascript:x>', '&lt;jj:&#93;(javascript:x>'],
    ['[x <jj:a](javascript:x)>', '[x &lt;jj:a&#93;(javascript:x)>'],
    ['[x <jj:a\xa0](javascript:x)>', '[x &lt;jj:a\xa0&#93;(javascript:x)>'],
    [
      `<${'a'.repeat(32)}:](javascript:x>`,
      `&lt;${'a'.repeat(32)}:&#93;(javascript:x>`,
    ],
    [
      `<${'a'.repeat(33)}:](javascript:x>`,
      `<${'a'.repeat(33)}:&#93;(javascript:x>`,
    ],
    ['<1j:](javascript:x>', '<1j:&#93;(javascript:x>'],
    ['<j_j:](javascript:x>', '<j_j:&#93;(javascript:x>'],
    ['<j+.-j:](javascript:x>', '&lt;j+.-j:&#93;(javascript:x>'],
    ['<jj:](javascript:x', '<jj:&#93;(javascript:x'],
    ['<jj:a\xa0](javascript:x>', '&lt;jj:a\xa0&#93;(javascript:x>'],
    ['<javascript:x\xa0y>', '&lt;javascript:x\xa0y>'],
    ['<javascript:x\u{2003}y>', '&lt;javascript:x\u{2003}y>'],
    ['<javascript:x\u{1680}y>', '&lt;javascript:x\u{1680}y>'],
    ['<javascript:x\u{2028}y>', '&lt;javascript:x\u{2028}y>'],
    ['<javascript:x\u{feff}y>', '&lt;javascript:x\u{feff}y>'],
    ['<JavaScript:x\xa0y>', '&lt;JavaScript:x\xa0y>'],
    ['<javascript:x&#40;\xa0y>', '&lt;javascript:x&#40;\xa0y>'],
    ['<jj:a\xa0<javascript:x\xa0y>', '<jj:a\xa0&lt;javascript:x\xa0y>'],
    ['<javascript:x\0y>', '<javascript:x\0y>'],
    ['<jj:<jj:](javascript:x>', '<jj:&lt;jj:&#93;(javascript:x>'],
    [
      '<javascript:a](<javascript:x>)>',
      '&lt;javascript:a&#93;(&lt;javascript:x>)>',
    ],
    [
      '<javascript:a<javascript:b<javascript:c>',
      '&lt;javascript:a&lt;javascript:b&lt;javascript:c>',
    ],
    ['<https:a<javascript:b>', '<https:a&lt;javascript:b>'],
    ['<javascript:x\x7f>', '&lt;javascript:x\x7f>'],
    ['<jj:a>](javascript:x)', '<jj:a>&#93;(javascript:x)'],
    ['![a"]', '!&#91;a"]'],
    ['![a"\n]', '!&#91;a"\n]'],
    ['![a"\n\n]', '![a"\n\n]'],
    ['![![a"]', '!&#91;!&#91;a"]'],
    ['![a]"', '![a]"'],
    ['![a"](javascript:x)', '![a"&#93;(javascript:x)'],
    ['![a"![b"]', '!&#91;a"!&#91;b"]'],
    ['![a\n\n![b"]', '![a\n\n!&#91;b"]'],
  ])('screens the raw markup %j as %j', (text, expected) => {
    expect(screen(text)).toBe(expected)
  })
})

describe('emphasis nested past the inline depth limit', () => {
  it('leaves the delimiters outside the 199th level as literal text', () => {
    expect(compiler(`${'*'.repeat(6000)}a${'*'.repeat(6000)}`)).toBe(
      `${'\\*'.repeat(5602)}${'**'.repeat(199)}a${'**'.repeat(199)}${'\\*'.repeat(5602)}`
    )
  })
})

describe('a www. bare URL needs a dot inside its own span', () => {
  it('ignores a dot in the text after the URL and escapes the dot after www. so a node written after the text cannot complete a URL', () => {
    expect(compiler('www.foo bar.com')).toBe('www\\.foo bar.com')
    expectRoundTrip('www.foo bar.com')
  })

  it('links a URL whose own span holds a dot', () => {
    expect(compiler('www.foo.com bar')).toBe(
      '[www.foo.com](http://www.foo.com) bar'
    )
  })

  it('counts a trailing dot that ends the sentence', () => {
    expect(compiler('www.foo. bar')).toBe('[www.foo](http://www.foo). bar')
  })
})

describe('bare URLs in a run without spaces', () => {
  it('links a later www. address whose own paren balance trims differently', () => {
    expect(compiler('www.(www.ab_.))')).toBe(
      'www\\.([www.ab](http://www.ab)\\_.))'
    )
    expectRoundTrip('www.(www.ab_.))')
  })

  it.each([
    ['a\\@b.com', 'a\\@b.com'],
    ['a@b.c', '[a@b.c](mailto:a@b.c)'],
    ['a@b_c.d', '[a@b\\_c.d](mailto:a@b_c.d)'],
  ])('writes %j as %j', (input, expected) => {
    expect(compiler(input)).toBe(expected)
    expectRoundTrip(input)
  })

  it('links the earliest candidate whose trailing parens leave a clean domain', () => {
    expect(compiler('www._)www._(www.c).).')).toBe(
      'www\\.*)www\\.*\\([www.c](http://www.c)).).'
    )
  })

  it('links the whole run once its last two segments are clean', () => {
    expect(compiler('www._)www._(www.c.d).).')).toBe(
      '[www.\\_)www.\\_(www.c.d](<http://www._)www._(www.c.d>)).).'
    )
  })

  it('links a scheme URL after a rejected one', () => {
    expect(compiler('http://a_b.c_dhttp://x.y')).toBe(
      'http:/\\/a\\_b.c\\_d[http://x.y](http://x.y)'
    )
    expectRoundTrip('http://a_b.c_dhttp://x.y')
  })

  it('links a www. address past a slash that ended a rejected domain', () => {
    expect(compiler('www.a_/www.b.c')).toBe(
      'www\\.a\\_/[www.b.c](http://www.b.c)'
    )
  })

  it('links a later candidate past a slash that reuses the rejected domain verdict', () => {
    expect(compiler('www.x_www.y/a.b')).toBe(
      'www\\.x\\_[www.y/a.b](http://www.y/a.b)'
    )
  })

  it('keeps a ] inside the domain and trims the unmatched trailing ) and ]', () => {
    expect(compiler('www._]www.a.b)].')).toBe(
      '[www.\\_\\]www.a.b](http://www._]www.a.b))\\].'
    )
  })

  it('keeps a trailing ] its [ opened while trimming the unmatched one', () => {
    expect(compiler('www._[www.a.b)]].')).toBe(
      '[www.\\_\\[www.a.b)\\]](<http://www._[www.a.b)]>)\\].'
    )
  })

  it('links a later www. address past a [ that the first candidate never closes', () => {
    expect(compiler('www.[www.a.b_]')).toBe(
      'www\\.\\[[www.a.b](http://www.a.b)\\_\\]'
    )
  })

  it('keeps a trailing ] a later candidate shares with a [ inside its own run', () => {
    expect(compiler('www._[www.a.b])')).toBe(
      '[www.\\_\\[www.a.b\\]](http://www._[www.a.b]))'
    )
  })

  it('stays text when a ] before a later candidate leaves it no clean domain', () => {
    expect(compiler('www.]www.a.b_[]')).toBe('www\\.\\]www\\.a.b\\_\\[\\]')
  })

  it('stays text when a nested [ pair closes after an underscore in the last segment', () => {
    expect(compiler('www.[[a.b]_]')).toBe('www\\.\\[\\[a.b\\]\\_\\]')
  })

  it('ends the link at the last closer when a kept ) and a kept ] both remain', () => {
    expect(compiler('www.[.()]')).toBe('[www.\\[.()\\]](http://www.[.()])')
  })

  it('stays text when a scheme URL has an empty domain', () => {
    expect(compiler('http://.')).toBe('http:/\\/.')
  })

  it('stays text when a www. address trims away to nothing', () => {
    expect(compiler('www._www..')).toBe('www\\.\\_www\\..')
  })
})

describe('a bare URL inside [ ] text ends at the ] that closes it', () => {
  it.each([
    [
      '[GitHub repo][https://github.com/litejs/natural-compare-lite]',
      '\\[GitHub repo\\]\\[[https://github.com/litejs/natural-compare-lite](https://github.com/litejs/natural-compare-lite)\\]',
    ],
    [
      '[see https://example.com/a]',
      '\\[see [https://example.com/a](https://example.com/a)\\]',
    ],
    [
      '[see www.example.com/a]',
      '\\[see [www.example.com/a](http://www.example.com/a)\\]',
    ],
    [
      '[see **https://example.com/a**]',
      '\\[see **[https://example.com/a](https://example.com/a)**\\]',
    ],
    [
      '[see https://example.com/?a[0]=1]',
      '\\[see [https://example.com/?a\\[0\\]=1](https://example.com/?a[0]=1)\\]',
    ],
    [
      'see https://example.com/a]',
      'see [https://example.com/a](https://example.com/a)\\]',
    ],
    [
      '[a] https://example.com/a]',
      '\\[a\\] [https://example.com/a](https://example.com/a)\\]',
    ],
    [
      '\\[see https://example.com/a]',
      '\\[see [https://example.com/a](https://example.com/a)\\]',
    ],
    [
      '[see ~~https://example.com/a]~~',
      '\\[see ~~[https://example.com/a](https://example.com/a)\\]~~',
    ],
    [
      '[see ==https://example.com/a]==',
      '\\[see ==[https://example.com/a](https://example.com/a)\\]==',
    ],
    [
      '==https://example.com/a==',
      '==[https://example.com/a](https://example.com/a)==',
    ],
    ['==https://x.y/?t=YQ== b', '==[https://x.y/?t=YQ](https://x.y/?t=YQ)== b'],
    ['https://x.y/?t=YQ== b', '[https://x.y/?t=YQ==](https://x.y/?t=YQ==) b'],
    [
      '~~a https://x.y/?t=YQ== b~~',
      '~~a [https://x.y/?t=YQ==](https://x.y/?t=YQ==) b~~',
    ],
    [
      "~~https://example.com/a~~'",
      "~~[https://example.com/a](https://example.com/a)~~'",
    ],
    [
      '[see <span>https://example.com/a]</span>',
      '\\[see <span>https://example.com/a]</span>',
    ],
    [
      '[see https://example.com/a\\]]',
      '\\[see [https://example.com/a](https://example.com/a)\\]\\]',
    ],
    [
      '![see https://example.com/a]',
      '!\\[see [https://example.com/a](https://example.com/a)\\]',
    ],
    [
      '[^see https://example.com/a]',
      '\\[^see [https://example.com/a](https://example.com/a)\\]',
    ],
    [
      '[see `]` https://example.com/a]',
      '\\[see `]` [https://example.com/a](https://example.com/a)\\]',
    ],
    [
      '[[see https://example.com/a]]',
      '\\[\\[see [https://example.com/a](https://example.com/a)\\]\\]',
    ],
    [
      '[see https://example.com/a.]',
      '\\[see [https://example.com/a](https://example.com/a).\\]',
    ],
    [
      '[see https://example.com/?a[0=1]',
      '\\[see [https://example.com/?a\\[0=1\\]](https://example.com/?a[0=1])',
    ],
  ])('renders %j as %j', (input, expected) => {
    expect(compiler(input)).toBe(expected)
  })

  it('ends it there with optimizeForStreaming too', () => {
    const input = '[see https://example.com/a] after'
    const expected =
      '\\[see [https://example.com/a](https://example.com/a)\\] after'
    expect(compiler(input)).toBe(expected)
    expect(compiler(input, { optimizeForStreaming: true })).toBe(expected)
  })
})

describe('override props that have no attribute form in the html compiler', () => {
  it('writes the heading without reading override props, since markdown has no attributes', () => {
    expect(
      compiler('# hi', {
        overrides: {
          h1: {
            props: { 'data-a': false, 'data-d': 'k' },
          },
        },
      })
    ).toBe('# hi')
  })
})

describe('a setext underline after a lazy line in a block quote', () => {
  it('writes the heading as ATX with its lines joined by a space', () => {
    expect(compiler('> a\nb\n> ---')).toBe('> ## a b')
  })
  it.each([
    ['> a\nb\n>\n> c\n> ===', '> a\n> b\n>\n> # c'],
    ['> a\nb\n===', '> a\n> b\n> \\==='],
  ])('writes %j as %j and re-parses to the same output', (input, expected) => {
    expect(compiler(input)).toBe(expected)
    expectRoundTrip(input)
  })
})

describe('code span edge spaces', () => {
  it.each([
    ['` a `', '`a`'],
    ['` \t `', '`\t`'],
    ['`   `', '` `'],
  ])('writes %j as %j and re-parses to the same output', (input, expected) => {
    expect(compiler(input)).toBe(expected)
    expectRoundTrip(input)
  })
})

describe('code spans at the streaming edge', () => {
  it.each([
    ['x `` a ` b `` y', 'x ``a ` b`` y'],
    ['x \\` y', 'x \\` y'],
  ])('writes %j as %j with optimizeForStreaming, as without it', (input, expected) => {
    expect(compiler(input, { optimizeForStreaming: true })).toBe(expected)
    expect(compiler(input)).toBe(expected)
  })
})

describe('a bare email address with an underscore', () => {
  it.each([
    ['foo@a_b.c', '[foo@a\\_b.c](mailto:foo@a_b.c)'],
    ['foo@a.b_c.d', '[foo@a.b\\_c.d](mailto:foo@a.b_c.d)'],
    ['a.b-c_d@a.b_', 'a.b-c\\_d\\@a.b\\_'],
  ])('writes %j as %j and re-parses to the same output', (input, expected) => {
    expect(compiler(input)).toBe(expected)
    expectRoundTrip(input)
  })
})

describe('a heading whose slug is only whitespace', () => {
  it('writes the heading with no id, since markdown has no id syntax', () => {
    expect(compiler('# Hi', { slugify: () => ' ' })).toBe('# Hi')
  })

  it('writes a heading with accented Latin letters and ß as written, since markdown has no id syntax for the folded slug', () => {
    expect(compiler('# Öl Straße\n\n# Łódź')).toBe('# Öl Straße\n\n# Łódź')
  })
})

describe('render depth limit', () => {
  it.each([
    [$.MAX_RENDER_DEPTH - 1, `${'> '.repeat($.MAX_RENDER_DEPTH - 1)}x`],
    [$.MAX_RENDER_DEPTH, `${'> '.repeat($.MAX_RENDER_DEPTH)}x`],
    [$.MAX_RENDER_DEPTH + 1, `${'> '.repeat($.MAX_RENDER_DEPTH - 1)}>`],
    [$.MAX_RENDER_DEPTH * 2, `${'> '.repeat($.MAX_RENDER_DEPTH - 1)}>`],
    [100_000, `${'> '.repeat($.MAX_RENDER_DEPTH - 1)}>`],
  ])('writes %i nested block quotes up to the depth limit', (count, expected) => {
    expect(astToMarkdown(quotesDeep(count))).toBe(expected)
  })

  it.each([
    [$.MAX_RENDER_DEPTH, 'x'],
    [$.MAX_RENDER_DEPTH + 1, ''],
    [100_000, ''],
  ])('continues the depth through renderChildren in a renderRule for %i nested block quotes', (count, expected) => {
    expect(
      astToMarkdown(quotesDeep(count), {
        renderRule: (next, node, renderChildren) =>
          node.type === RuleType.blockQuote
            ? renderChildren(node.children)
            : next(),
      })
    ).toBe(expected)
  })

  it('writes the overflow text escaped', () => {
    let node: MarkdownToJSX.ASTNode = { type: RuleType.text, text: '*a*' }
    for (let i = 0; i < $.MAX_RENDER_DEPTH; i++) {
      node = { type: RuleType.blockQuote, children: [node] }
    }
    expect(astToMarkdown([node])).toBe(
      `${'> '.repeat($.MAX_RENDER_DEPTH)}\\*a\\*`
    )
  })
})
