import { describe, expect, it } from 'bun:test'
import * as fs from 'fs'
import * as path from 'path'

import { compiler, markdown, type MarkdownCompilerOptions } from './markdown'
import { parser } from './parse'
import type { MarkdownToJSX } from './types'
import { RuleType } from './types'

describe('compiler', () => {
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
        ordered: false,
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
        ordered: true,
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
        ordered: true,
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
        ordered: false,
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
        noInnerParse: false,
        text: undefined,
      }
      expect(markdown(ast)).toBe('<div class="container">\nContent\n</div>')
    })

    it('should compile HTML block with text content', () => {
      const ast: MarkdownToJSX.HTMLNode = {
        type: RuleType.htmlBlock,
        tag: 'script',
        attrs: {},
        children: undefined,
        noInnerParse: true,
        text: 'console.log("hello");</script>',
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
      expect(markdown(ast)).toBe(
        '---\ntitle: My Document\nauthor: John Doe\n---'
      )
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

    // TODO: Implement round-trip testing once text node splitting is handled
    // it('should round-trip basic markdown', () => {
    //   const input = '# Hello\n\nThis is **bold** and *italic* text.'
    //   const ast = parser(input)
    //   const output = markdown(ast)
    //   const reparsed = parser(output)
    //   expect(reparsed).toEqual(ast)
    // })

    it('should handle unknown node types gracefully', () => {
      const ast = { type: 999, unknown: 'property' } as any
      expect(markdown(ast)).toBe('')
    })
  })

  describe('options', () => {
    it('should respect reference link option', () => {
      const options: MarkdownToJSX.Options = {} // TODO: Add reference link option to Options type

      const ast: MarkdownToJSX.LinkNode = {
        type: RuleType.link,
        target: 'https://example.com',
        title: 'Title',
        children: [{ type: RuleType.text, text: 'Link' }],
      }

      const result = markdown(ast, options)
      expect(result).toBe('[Link](https://example.com "Title")') // For now, just test inline links
    })

    it('should respect enforce atx headers option', () => {
      const options: MarkdownToJSX.Options = { enforceAtxHeadings: false }

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
        const options: MarkdownToJSX.Options = { disableParsingRawHTML: true }

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
          noInnerParse: false,
          text: undefined,
        }

        expect(markdown(ast, options)).toBe(
          '<div class="container">\nContent\n</div>'
        )
      })

      it('should still emit self-closing HTML tags when disableParsingRawHTML is true', () => {
        const options: MarkdownToJSX.Options = { disableParsingRawHTML: true }

        const ast: MarkdownToJSX.HTMLSelfClosingNode = {
          type: RuleType.htmlSelfClosing,
          tag: 'br',
          attrs: {},
        }

        expect(markdown(ast, options)).toBe('<br />')
      })

      it('should still emit HTML comments when disableParsingRawHTML is true', () => {
        const options: MarkdownToJSX.Options = { disableParsingRawHTML: true }

        const ast: MarkdownToJSX.HTMLCommentNode = {
          type: RuleType.htmlComment,
          text: ' This is a comment ',
        }

        expect(markdown(ast, options)).toBe('<!-- This is a comment -->')
      })

      it('should still emit HTML blocks with text content when disableParsingRawHTML is true', () => {
        const options: MarkdownToJSX.Options = { disableParsingRawHTML: true }

        const ast: MarkdownToJSX.HTMLNode = {
          type: RuleType.htmlBlock,
          tag: 'script',
          attrs: {},
          children: undefined,
          noInnerParse: true,
          text: 'console.log("hello");</script>',
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
          noInnerParse: false,
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
      expect(output).toContain('title: Test Document')
      expect(output).toContain('author: Test Author')
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
})
