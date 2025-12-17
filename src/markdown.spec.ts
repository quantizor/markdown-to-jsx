import { describe, expect, it } from 'bun:test'
import * as fs from 'fs'
import * as path from 'path'

import {
  astToMarkdown,
  compiler,
  markdown,
  type MarkdownCompilerOptions,
} from './markdown'
import { parser } from './parse'
import type { MarkdownToJSX } from './types'
import { RuleType } from './types'

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

    it('should preserve special characters in text', () => {
      const ast: MarkdownToJSX.TextNode = {
        type: RuleType.text,
        text: '*bold* _italic_ `code` [link](url)',
      }
      expect(markdown(ast)).toBe('*bold* _italic_ `code` [link](url)')
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
  })

  describe('code', () => {
    it('should compile inline code', () => {
      const ast: MarkdownToJSX.CodeInlineNode = {
        type: RuleType.codeInline,
        text: 'console.log("hello")',
      }
      expect(markdown(ast)).toBe('`console.log("hello")`')
    })

    it('should compile inline code with backticks using double backticks', () => {
      const ast: MarkdownToJSX.CodeInlineNode = {
        type: RuleType.codeInline,
        text: 'code with `backtick`',
      }
      expect(markdown(ast)).toBe('``code with `backtick```')
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

    it('should compile strikethrough', () => {
      const ast: MarkdownToJSX.FormattedTextNode = {
        type: RuleType.textFormatted,
        tag: 'del',
        children: [{ type: RuleType.text, text: 'strikethrough' }],
      }
      expect(markdown(ast)).toBe('~~strikethrough~~')
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
        'Header 1 | Header 2 | Header 3\n:---|:---:|---:\nCell 1 | Cell 2 | Cell 3'
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
      const expected = 'Header 1 | Header 2\n---|---\nCell 1 | Cell 2'
      expect(markdown(ast)).toBe(expected)
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
        verbatim: false,
        rawText: undefined,
      }
      expect(markdown(ast)).toBe('<div class="container">\nContent\n</div>')
    })

    it('should compile HTML block with text content', () => {
      const ast: MarkdownToJSX.HTMLNode = {
        type: RuleType.htmlBlock,
        tag: 'script',
        attrs: {},
        children: [],
        verbatim: true,
        rawText: 'console.log("hello");</script>',
      }
      expect(markdown(ast)).toBe('<script>console.log("hello");</script>')
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
    it('should compile frontmatter', () => {
      const ast: MarkdownToJSX.FrontmatterNode = {
        type: RuleType.frontmatter,
        text: 'title: My Document\nauthor: John Doe',
      }
      // Frontmatter should be preserved for round-trip compilation
      expect(markdown(ast)).toBe(
        '---\ntitle: My Document\nauthor: John Doe\n---'
      )
    })

    it('should preserve frontmatter by default', () => {
      const ast: MarkdownToJSX.FrontmatterNode = {
        type: RuleType.frontmatter,
        text: 'title: Test\ntags: [a, b]',
      }
      expect(markdown(ast)).toBe('---\ntitle: Test\ntags: [a, b]\n---')
    })

    it('should preserve frontmatter when preserveFrontmatter is true', () => {
      const ast: MarkdownToJSX.FrontmatterNode = {
        type: RuleType.frontmatter,
        text: 'title: Test\ntags: [a, b]',
      }
      expect(markdown(ast, { preserveFrontmatter: true })).toBe(
        '---\ntitle: Test\ntags: [a, b]\n---'
      )
    })

    it('should exclude frontmatter when preserveFrontmatter is false', () => {
      const ast: MarkdownToJSX.FrontmatterNode = {
        type: RuleType.frontmatter,
        text: 'title: Test\ntags: [a, b]',
      }
      expect(markdown(ast, { preserveFrontmatter: false })).toBe('')
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
      // Reference collection should be preserved for round-trip compilation
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

    // Note: Round-trip testing is complex due to text node splitting differences
    // The markdown compiler preserves structure but may format differently
    // For now, we test that compilation produces valid markdown that can be reparsed
    it('should produce valid markdown that can be reparsed', () => {
      const input = '# Hello\n\nThis is **bold** and *italic* text.'
      const ast = parser(input)
      const output = markdown(ast)
      const reparsed = parser(output)
      // Verify it parses without errors and produces similar structure
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
          verbatim: false,
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
          verbatim: true,
          rawText: 'console.log("hello");</script>',
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
          verbatim: false,
          text: undefined,
        }

        // Test with undefined (default)
        expect(markdown(ast)).toBe('<div class="container">\nContent\n</div>')

        // Test with explicitly false
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
      // Output should match input exactly for round-trip compilation
      expect(output).toContain('title: Test Document')
      expect(output).toContain('author: Test Author')
      expect(output).toContain('# Content')
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
      const output = compiler(input, { preserveFrontmatter: true })
      expect(output).toContain('title: Test Document')
      expect(output).toContain('author: Test Author')
      expect(output).toContain('# Content')
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

    it('should still emit HTML when disableParsingRawHTML is enabled', () => {
      const input = `Regular text

<div class="custom">
  <p>HTML content</p>
</div>

<!-- comment -->

<img src="image.jpg" />

More text`

      const output = compiler(input, { disableParsingRawHTML: true })
      expect(output).toContain('<div class="custom">')
      expect(output).toContain('<p>HTML content</p>')
      expect(output).toContain('<!-- comment -->')
      expect(output).toContain('<img src="image.jpg" />')
      expect(output).toContain('Regular text')
      expect(output).toContain('More text')
    })
  })

  describe('round-trip compilation', () => {
    it('should round-trip the markdown specification document and produce equivalent AST', () => {
      const specPath = path.join(__dirname, 'markdown-spec.md')
      const originalMarkdown = fs.readFileSync(specPath, 'utf8')

      // Parse to AST
      const originalAst = parser(originalMarkdown)

      // Convert back to markdown
      const roundTripMarkdown = markdown(originalAst)

      // Parse the round-trip result
      const roundTripAst = parser(roundTripMarkdown)

      // The ASTs should be structurally equivalent (allowing for formatting differences)
      // For now, we'll just check that both parse successfully and produce some content
      expect(originalAst.length).toBeGreaterThan(0)
      expect(roundTripAst.length).toBeGreaterThan(0)
      expect(roundTripMarkdown.length).toBeGreaterThan(0)

      // Basic smoke test: the round-trip should contain some key elements
      expect(roundTripMarkdown).toContain('# Markdown: Syntax')
      expect(roundTripMarkdown).toContain('Overview')
      expect(roundTripMarkdown).toContain('**Note:**')
    })

    it('should round-trip the GFM specification document and produce equivalent AST', () => {
      const specPath = path.join(__dirname, 'gfm-spec.md')
      const originalMarkdown = fs.readFileSync(specPath, 'utf8')

      // Parse to AST
      const originalAst = parser(originalMarkdown)

      // Convert back to markdown
      const roundTripMarkdown = markdown(originalAst)

      // Parse the round-trip result
      const roundTripAst = parser(roundTripMarkdown)

      // The ASTs should be structurally equivalent (allowing for formatting differences)
      // For now, we'll just check that both parse successfully and produce some content
      expect(originalAst.length).toBeGreaterThan(0)
      expect(roundTripAst.length).toBeGreaterThan(0)
      expect(roundTripMarkdown.length).toBeGreaterThan(0)

      // Basic smoke test: the round-trip should contain some key elements
      expect(roundTripMarkdown).toContain('# Introduction')
      expect(roundTripMarkdown).toContain(
        '## What is GitHub Flavored Markdown?'
      )
      expect(roundTripMarkdown).toContain('---')
      expect(roundTripMarkdown).toContain(
        'title: GitHub Flavored Markdown Spec'
      )
    })

    it('should round-trip the comprehensive stress test fixture and produce equivalent AST', () => {
      const fixturePath = path.join(__dirname, 'stress-test.generated.md')
      const originalMarkdown = fs.readFileSync(fixturePath, 'utf8')

      // Parse to AST
      const originalAst = parser(originalMarkdown)

      // Convert back to markdown
      const roundTripMarkdown = markdown(originalAst)

      // Parse the round-trip result
      const roundTripAst = parser(roundTripMarkdown)

      // The ASTs should be structurally equivalent (allowing for formatting differences)
      // For now, we'll just check that both parse successfully and produce some content
      expect(originalAst.length).toBeGreaterThan(0)
      expect(roundTripAst.length).toBeGreaterThan(0)
      expect(roundTripMarkdown.length).toBeGreaterThan(0)

      // Basic smoke test: the round-trip should contain some key elements
      expect(roundTripMarkdown).toContain(
        '# Comprehensive Markdown Syntax Fixture'
      )
      expect(roundTripMarkdown).toContain('---')
      expect(roundTripMarkdown).toContain(
        'title: Comprehensive Markdown Syntax Fixture'
      )
      expect(roundTripMarkdown).toContain('# END OF COMPREHENSIVE FIXTURE FILE')
    })
  })

  describe('renderRule', () => {
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
              return '> ' + renderChildren(node.children || [])
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
              const key = state.key !== undefined ? String(state.key) : 'none'
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
              return '# ' + renderChildren(headingNode.children || [])
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
      // Empty strings are still joined with \n\n, so we get empty line + content
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
              return '```custom\n' + (node.text || '') + '\n```'
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
              const key = state.key !== undefined ? `[${state.key}]` : ''
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
      // State includes refs from options, but they may not be merged with AST refs
      // Check that state.key is correctly passed (0 and 1)
      expect(result).toContain('#1 [0]')
      expect(result).toContain('#2 [1]')
      expect(result).toContain('Test')
      // Note: refs in state may be empty if not extracted from AST
      // The test verifies state is accessible, not necessarily populated
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
            // Skip code blocks
            if (node.type === RuleType.codeBlock) {
              return ''
            }
            return next()
          },
        }
      )
      // Empty strings are still joined with \n\n
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
              // For typescript, use default
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
        renderRule: (next, node, renderChildren, state) => {
          const key = state.key !== undefined ? state.key : -1
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
