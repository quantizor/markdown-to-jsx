import { describe, expect, it } from 'bun:test'
import { astToHTML } from './html.ts'
import * as p from './parse.ts'
import { storedAST } from './test-tree.ts'
import { type MarkdownToJSX, RuleType } from './types.ts'

function createBlockState(refs = Object.create(null)) {
  return { inline: false, refs } as MarkdownToJSX.State
}

function createInlineState(refs = Object.create(null)) {
  return { inline: true, refs } as MarkdownToJSX.State
}

function createDefaultOptions() {
  return {
    slugify: (input: string) => input,
  } as p.ParseOptions
}

function createForceBlockOptions(): p.ParserInputOptions {
  return { forceBlock: true }
}

function createEmptyRefs() {
  return Object.create(null) as Exclude<MarkdownToJSX.State['refs'], undefined>
}

describe('parser', () => {
  it('keeps a later link once the tags in brackets have spent their reading budget', () => {
    const nodes = p.parser(
      `${'[<b>] '.repeat(2000)}[<i>l</i>](/u)`
    ) as MarkdownToJSX.ParagraphNode[]
    const children = nodes[0].children

    expect(JSON.stringify(children.at(-1))).toMatchInlineSnapshot(
      `"{"type":"link","target":"/u","children":[{"type":"htmlBlock","tag":"i","attrs":{},"_rawAttrs":"","children":[{"type":"text","text":"l"}],"text":"l","_verbatim":false,"_isClosingTag":false}]}"`
    )
  })

  it('ends link text at a bracket inside a raw HTML element, and hides only a bracket inside the tag itself', () => {
    expect(
      JSON.stringify([
        p.parser('[see <b>this]</b> note](/docs)'),
        p.parser('[a <b title="]">x</b>](/u)'),
      ])
    ).toMatchInlineSnapshot(
      `"[[{"type":"paragraph","children":[{"type":"text","text":"[see "},{"type":"htmlBlock","tag":"b","attrs":{},"_rawAttrs":"","children":[{"type":"text","text":"this]"}],"text":"this]","_verbatim":false,"_isClosingTag":false},{"type":"text","text":" note](/docs)"}]}],[{"type":"paragraph","children":[{"type":"link","target":"/u","children":[{"type":"text","text":"a "},{"type":"htmlBlock","tag":"b","attrs":{"title":"]"},"_rawAttrs":"title=\\"]\\"","children":[{"type":"text","text":"x"}],"text":"x","_verbatim":false,"_isClosingTag":false}]}]}]]"`
    )
  })

  it('finds a closer after another tag failed to find one', () => {
    const nodes = p.parser('<q> <b>x</b>') as MarkdownToJSX.ASTNode[]

    expect(JSON.stringify(nodes)).toMatchInlineSnapshot(
      `"[{"type":"paragraph","children":[{"type":"htmlSelfClosing","tag":"q","attrs":{},"_rawOpen":"<q>","_isClosingTag":false},{"type":"text","text":" "},{"type":"htmlBlock","tag":"b","attrs":{},"_rawAttrs":"","children":[{"type":"text","text":"x"}],"text":"x","_verbatim":false,"_isClosingTag":false}]}]"`
    )
  })

  it('opens a code span at a run whose length has a closer after other runs failed to find theirs', () => {
    const nodes = p.parser('`a ``b ```c `` ````d') as MarkdownToJSX.ASTNode[]

    expect(JSON.stringify(nodes)).toMatchInlineSnapshot(
      `"[{"type":"paragraph","children":[{"type":"text","text":"\`a "},{"type":"codeInline","text":"b \`\`\`c "},{"type":"text","text":" \`\`\`\`d"}]}]"`
    )
  })

  it('pairs each closer with the nearest live opener past pairs already consumed', () => {
    const nodes = p.parser('*a *b *c d* e* f*') as MarkdownToJSX.ASTNode[]

    expect(JSON.stringify(nodes)).toMatchInlineSnapshot(
      `"[{"type":"paragraph","children":[{"type":"textFormatted","tag":"em","children":[{"type":"text","text":"a "},{"type":"textFormatted","tag":"em","children":[{"type":"text","text":"b "},{"type":"textFormatted","tag":"em","children":[{"type":"text","text":"c d"}]},{"type":"text","text":" e"}]},{"type":"text","text":" f"}]}]}]"`
    )
  })

  it('keeps only the innermost link when long link texts enclose each other', () => {
    const filler = 'a '.repeat(200)
    const nodes = p.parser(
      `[${filler}[${filler}[[b](u)](v) c](w) d](x)`
    ) as MarkdownToJSX.ASTNode[]

    expect(JSON.stringify(nodes)).toBe(
      `[{"type":"paragraph","children":[{"type":"text","text":"[${filler}[${filler}["},{"type":"link","target":"u","children":[{"type":"text","text":"b"}]},{"type":"text","text":"](v) c](w) d](x)"}]}]`
    )
  })

  it('should parse basic markdown to paragraph', () => {
    const result = p.parser('hello world') as MarkdownToJSX.ParagraphNode[]
    expect(result).toEqual([
      {
        type: RuleType.paragraph,
        children: [{ type: RuleType.text, text: 'hello world' }],
      },
    ])
  })

  it('should handle empty input', () => {
    const result = p.parser('')
    expect(result).toEqual([])
  })

  it('should parse headings with forceBlock option', () => {
    const result = p.parser(
      '# Hello',
      createForceBlockOptions()
    ) as MarkdownToJSX.HeadingNode[]
    expect(result).toEqual([
      {
        type: RuleType.heading,
        level: 1,
        children: [{ type: RuleType.text, text: 'Hello' }],
        id: 'hello',
      },
    ])
  })

  it('should handle null/undefined options', () => {
    const result = p.parser('test', undefined) as MarkdownToJSX.ParagraphNode[]
    expect(result).toEqual([
      {
        type: RuleType.paragraph,
        children: [{ type: RuleType.text, text: 'test' }],
      },
    ])
  })

  it('should handle extremely long input', () => {
    const longText = 'a'.repeat(10_000)
    const result = p.parser(longText)
    expect(result.length).toBeGreaterThan(0)
  })

  it('should handle input with null bytes', () => {
    const result = p.parser('hello\x00world') as MarkdownToJSX.ParagraphNode[]
    expect(result).toEqual([
      {
        type: RuleType.paragraph,
        children: [{ type: RuleType.text, text: 'hello\uFFFDworld' }],
      },
    ])
  })

  it('should normalize mixed CRLF, LF, and CR line endings to LF', () => {
    const result = p.parser(
      'line1\r\nline2\nline3\rline4'
    ) as MarkdownToJSX.ParagraphNode[]
    expect(result).toEqual([
      {
        type: RuleType.paragraph,
        children: [{ type: RuleType.text, text: 'line1\nline2\nline3\nline4' }],
      },
    ])
  })

  it('should handle Unicode characters', () => {
    const result = p.parser('Hello 世界 🌍') as MarkdownToJSX.ParagraphNode[]
    expect(result).toEqual([
      {
        type: RuleType.paragraph,
        children: [{ type: RuleType.text, text: 'Hello 世界 🌍' }],
      },
    ])
  })

  it('should handle HTML with percent character in attributes without throwing URIError (issue #753)', () => {
    const result = p.parser(
      '<iframe src="https://example.com" width="100%"></iframe>'
    )
    expect(result).toHaveLength(1)
    const htmlNode = result[0] as MarkdownToJSX.HTMLNode
    expect(htmlNode.type).toBe(RuleType.htmlBlock)
    expect(htmlNode.tag).toBe('iframe')
    expect(htmlNode.attrs).toEqual({
      src: 'https://example.com',
      width: '100%',
    })
  })

  it('should preserve > and < inside quoted attribute values (#263)', () => {
    const result = p.parser(
      '<CustomSmall data="hello > world"/>'
    ) as MarkdownToJSX.HTMLSelfClosingNode[]
    expect(result[0].tag).toBe('CustomSmall')
    expect(result[0].attrs).toEqual({ data: 'hello > world' })

    const result2 = p.parser(
      '<Comp x="1>2" y="3<4"/>'
    ) as MarkdownToJSX.HTMLSelfClosingNode[]
    expect(result2[0].tag).toBe('Comp')
    expect(result2[0].attrs).toEqual({ x: '1>2', y: '3<4' })
  })
})

describe('parseMarkdown', () => {
  it('should parse block markdown with state', () => {
    const state = createBlockState()
    const options = createDefaultOptions()
    const result = p.parseMarkdown(
      'hello world',
      state,
      options
    ) as MarkdownToJSX.ParagraphNode[]
    expect(result).toEqual([
      {
        type: RuleType.paragraph,
        children: [{ type: RuleType.text, text: 'hello world' }],
      },
    ])
  })

  it('should handle inline parsing with emphasis', () => {
    const state = createInlineState()
    const options = createDefaultOptions()
    const result = p.parseMarkdown('hello *world*', state, options)
    expect(result).toEqual([
      { type: RuleType.text, text: 'hello ' },
      {
        type: RuleType.textFormatted,
        tag: 'em',
        children: [{ type: RuleType.text, text: 'world' }],
      },
    ])
  })

  it('should handle complex emphasis with punctuation', () => {
    const state = createInlineState()
    const options = createDefaultOptions()
    const result = p.parseMarkdown('(*hello* world)', state, options)
    expect(result).toEqual([
      { type: RuleType.text, text: '(' },
      {
        type: RuleType.textFormatted,
        tag: 'em',
        children: [{ type: RuleType.text, text: 'hello' }],
      },
      { type: RuleType.text, text: ' world)' },
    ])
  })

  it('should handle strong emphasis', () => {
    const state = createInlineState()
    const options = createDefaultOptions()
    const result = p.parseMarkdown('**bold** text', state, options)
    expect(result).toEqual([
      {
        type: RuleType.textFormatted,
        tag: 'strong',
        children: [{ type: RuleType.text, text: 'bold' }],
      },
      { type: RuleType.text, text: ' text' },
    ])
  })

  it('should handle mixed inline elements', () => {
    const state = createInlineState()
    const options = createDefaultOptions()
    const result = p.parseMarkdown('`code` and *emphasis*', state, options)
    expect(result).toEqual([
      {
        type: RuleType.codeInline,
        text: 'code',
      },
      { type: RuleType.text, text: ' and ' },
      {
        type: RuleType.textFormatted,
        tag: 'em',
        children: [{ type: RuleType.text, text: 'emphasis' }],
      },
    ])
  })

  it('parses many emphasis pairs in linear time, asserting structure so the guard against a quadratic matcher stays deterministic', () => {
    const state = createInlineState()
    const options = createDefaultOptions()
    const n = 20_000
    const result = p.parseMarkdown('*a* '.repeat(n), state, options)
    expect(result.length).toBe(2 * n)
    expect(result[0]).toEqual({
      type: RuleType.textFormatted,
      tag: 'em',
      children: [{ type: RuleType.text, text: 'a' }],
    })
    expect(result[1]).toEqual({ type: RuleType.text, text: ' ' })
    expect(result.at(-1)).toEqual({
      type: RuleType.text,
      text: ' ',
    })
  })

  it('should handle links in inline mode', () => {
    const state = createInlineState()
    const options = { ...createDefaultOptions(), sanitizer: (x: string) => x }
    const result = p.parseMarkdown('[link](url)', state, options)
    expect(result).toEqual([
      {
        type: RuleType.link,
        target: 'url',
        title: undefined,
        children: [{ type: RuleType.text, text: 'link' }],
      },
    ])
  })

  it('should not nest links in inline mode: the inner link takes precedence and the outer brackets become literal text', () => {
    const state = createInlineState()
    const options = { ...createDefaultOptions(), sanitizer: (x: string) => x }
    const result = p.parseMarkdown(
      '[outer [inner](url2)](url1)',
      state,
      options
    )
    expect(result).toEqual([
      { type: RuleType.text, text: '[outer ' },
      {
        type: RuleType.link,
        target: 'url2',
        title: undefined,
        children: [{ type: RuleType.text, text: 'inner' }],
      },
      { type: RuleType.text, text: '](url1)' },
    ])
  })

  it('should handle malformed link syntax', () => {
    const state = createInlineState()
    const options = { ...createDefaultOptions(), sanitizer: (x: string) => x }
    const result = p.parseMarkdown('[link(url)', state, options)
    expect(result).toEqual([{ type: RuleType.text, text: '[link(url)' }])
  })

  it('should handle links with nested brackets in text', () => {
    const state = createInlineState()
    const options = { ...createDefaultOptions(), sanitizer: (x: string) => x }
    const result = p.parseMarkdown(
      '[link [with] brackets](url)',
      state,
      options
    )
    expect(result).toEqual([
      {
        type: RuleType.link,
        target: 'url',
        children: [{ type: RuleType.text, text: 'link [with] brackets' }],
      },
    ])
  })

  it('should allow unescaped brackets in link URLs', () => {
    const state = createInlineState()
    const options = { ...createDefaultOptions(), sanitizer: (x: string) => x }
    const result = p.parseMarkdown('[text](url[invalid])', state, options)
    expect(result).toEqual([
      {
        type: RuleType.link,
        target: 'url[invalid]',
        title: undefined,
        children: [{ type: RuleType.text, text: 'text' }],
      },
    ])
  })

  it('keeps many unterminated inline-link openers as literal text (issue #874)', () => {
    const input = '[]('.repeat(2000)
    expect(p.parser(input)).toEqual([
      {
        type: RuleType.paragraph,
        children: [{ type: RuleType.text, text: input }],
      },
    ])
  })

  it('keeps bracket matching exact when an outer opener never closes, so a shared "nothing from here matches" memo answer cannot swallow the inner link', () => {
    function expected(leadingText: string) {
      return [
        {
          type: RuleType.paragraph,
          children: [
            { type: RuleType.text, text: leadingText },
            {
              type: RuleType.link,
              target: '/url',
              title: undefined,
              children: [{ type: RuleType.text, text: 'foo' }],
            },
          ],
        },
      ]
    }
    expect(p.parser('[[foo](/url)')).toEqual(expected('['))
    const pad = 'z'.repeat(400)
    expect(p.parser(`[${pad}[foo](/url)`)).toEqual(expected(`[${pad}`))
  })

  it('still parses long link text containing nested brackets as a link, which capping the scanned span would stop doing', () => {
    const text = `${'x'.repeat(9000)} [inner] ${'y'.repeat(500)}`
    expect(p.parser(`[${text}](/url)`)).toEqual([
      {
        type: RuleType.paragraph,
        children: [
          {
            type: RuleType.link,
            target: '/url',
            title: undefined,
            children: [{ type: RuleType.text, text }],
          },
        ],
      },
    ])
  })

  it('keeps footnote references parsing after an unclosed opener, since a `[^` on one line must not suppress a real reference on the next', () => {
    expect(p.parser('[^unclosed\n\n[^1]: note\n\nsee [^1]')).toEqual([
      {
        type: RuleType.refCollection,
        refs: { '^1': { target: 'note', title: undefined } },
      },
      {
        type: RuleType.paragraph,
        children: [{ type: RuleType.text, text: '[^unclosed' }],
      },
      { type: RuleType.footnote },
      {
        type: RuleType.paragraph,
        children: [
          { type: RuleType.text, text: 'see ' },
          {
            type: RuleType.footnoteReference,
            target: '#1',
            text: '1',
          },
        ],
      },
    ])
  })

  it('keeps a footnote reference with no definition as text', () => {
    expect(p.parser('a [^1] b')).toEqual([
      {
        type: RuleType.paragraph,
        children: [{ type: RuleType.text, text: 'a [^1] b' }],
      },
    ])
  })

  it('reads a footnote-shaped link with no definition as a link', () => {
    expect(p.parser('[^1](/u)')).toEqual([
      {
        type: RuleType.paragraph,
        children: [
          {
            type: RuleType.link,
            target: '/u',
            title: undefined,
            children: [{ type: RuleType.text, text: '^1' }],
          },
        ],
      },
    ])
  })

  it('matches a footnote reference to its definition in any letter case', () => {
    expect(p.parser('[^A]\n\n[^a]: y')).toEqual([
      {
        type: RuleType.refCollection,
        refs: { '^a': { target: 'y', title: undefined } },
      },
      {
        type: RuleType.paragraph,
        children: [
          { type: RuleType.footnoteReference, target: '#a', text: 'A' },
        ],
      },
      { type: RuleType.footnote },
    ])
  })

  it('keeps a footnote name holding a bracket as text even with a definition', () => {
    expect(p.parser('[^a[b]\n\n[^a[b]: y')).toEqual([
      {
        type: RuleType.refCollection,
        refs: { '^a[b': { target: 'y', title: undefined } },
      },
      {
        type: RuleType.paragraph,
        children: [{ type: RuleType.text, text: '[^a[b]' }],
      },
      { type: RuleType.footnote },
    ])
  })

  it('shows a footnote reference ending the streamed text like any bracket, as a link may still open', () => {
    expect(p.parser('a [^1]', { optimizeForStreaming: true })).toEqual(
      p.parser('a ^1', { optimizeForStreaming: true })
    )
  })

  it('keeps a footnote reference while streaming, as its definition may still arrive', () => {
    expect(p.parser('a [^1] b', { optimizeForStreaming: true })).toEqual([
      {
        type: RuleType.paragraph,
        children: [
          { type: RuleType.text, text: 'a ' },
          { type: RuleType.footnoteReference, target: '#1', text: '1' },
          { type: RuleType.text, text: ' b' },
        ],
      },
    ])
  })

  const countReferences = (value: unknown): number => {
    if (Array.isArray(value)) {
      return value.reduce((sum, item) => sum + countReferences(item), 0)
    }
    if (!value || typeof value !== 'object') {
      return 0
    }

    return Object.values(value).reduce(
      (sum: number, item) => sum + countReferences(item),
      'type' in value && value.type === RuleType.footnoteReference ? 1 : 0
    )
  }

  it.each([
    ['blockquote', '> R'],
    ['component body', '<Foo>R</Foo>'],
    ['emphasis', '*a R*'],
    ['heading', '# a R'],
    ['HTML block body', '<div>\n\nR\n\n</div>'],
    ['inline HTML', 'a <span>R</span>'],
    ['link text', '[a R](/u)'],
    ['list item', '- R'],
    ['nested list item', '- a\n  - R'],
    ['setext heading', 'a R\n==='],
    ['table cell', '| h |\n|---|\n| R |'],
    ['table header', '| R |\n|---|\n| c |'],
  ])('finds a definition after a footnote reference in a %s', (_name, shape) => {
    const body = shape.replace('R', '[^1]')

    expect(countReferences(p.parser(`${body}\n\n[^1]: y`))).toBe(1)
    expect(countReferences(p.parser(body))).toBe(0)
  })

  it('does not let the failed-link cache reject a valid trailing link: in `[](([](a)` the outer link fails because the bare URL walks to the end without a balanced `)`, and the inner `[](a)` must still parse (issue #874 follow-up)', () => {
    const result = p.parser('[](([](a)')
    expect(result).toEqual([
      {
        type: RuleType.paragraph,
        children: [
          { type: RuleType.text, text: '[]((' },
          {
            type: RuleType.link,
            target: 'a',
            title: undefined,
            children: [],
          },
        ],
      },
    ])
  })

  it('parses mailto autolinks with label preserved', () => {
    const state = createInlineState()
    const options = { ...createDefaultOptions(), sanitizer: (x: string) => x }
    const result = p.parseMarkdown(
      '<mailto:user@example.com>',
      state,
      options
    ) as MarkdownToJSX.ASTNode[]
    expect(result).toEqual([
      {
        type: RuleType.link,
        target: 'mailto:user@example.com',
        children: [
          {
            type: RuleType.text,
            text: 'mailto:user@example.com',
          },
        ],
      } as MarkdownToJSX.ASTNode,
    ])
  })

  it('rejects angle autolinks containing newlines', () => {
    const state = createInlineState()
    const options: p.ParseOptions = {
      disableParsingRawHTML: true,
      sanitizer: (x: string) => x,
      slugify: (value: string) => value,
    }
    const result = p.parseMarkdown(
      '<https://example.com\nnext>',
      state,
      options
    ) as MarkdownToJSX.ASTNode[]
    expect(result).toEqual([
      { type: RuleType.text, text: '<https://example.com\nnext>' },
    ])
  })

  it('rejects bare autolinks with invalid domains', () => {
    const state = createInlineState()
    const options = { ...createDefaultOptions(), sanitizer: (x: string) => x }
    const result = p.parseMarkdown(
      'https://example.invalid_domain',
      state,
      options
    ) as MarkdownToJSX.ASTNode[]
    expect(result).toEqual([
      { type: RuleType.text, text: 'https://example.invalid_domain' },
    ])
  })

  it('keeps an empty domain as text', () => {
    const state = createInlineState()
    const options = { ...createDefaultOptions(), sanitizer: (x: string) => x }
    const result = p.parseMarkdown(
      'http://.',
      state,
      options
    ) as MarkdownToJSX.ASTNode[]
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "text": "http://.",
          "type": "text",
        },
      ]
    `)
  })

  it('keeps a www. address that trims away to nothing as text', () => {
    const state = createInlineState()
    const options = { ...createDefaultOptions(), sanitizer: (x: string) => x }
    const result = p.parseMarkdown(
      'www._www..',
      state,
      options
    ) as MarkdownToJSX.ASTNode[]
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "text": "www._www..",
          "type": "text",
        },
      ]
    `)
  })

  it('judges a later candidate past a slash by its own domain, not the rejected earlier one', () => {
    const state = createInlineState()
    const options = { ...createDefaultOptions(), sanitizer: (x: string) => x }
    const result = p.parseMarkdown(
      'www.x_www.y/a.b',
      state,
      options
    ) as MarkdownToJSX.ASTNode[]
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "text": "www.x_",
          "type": "text",
        },
        {
          "children": [
            {
              "text": "www.y/a.b",
              "type": "text",
            },
          ],
          "target": "http://www.y/a.b",
          "title": undefined,
          "type": "link",
        },
      ]
    `)
  })

  it('rejects bare autolinks when the penultimate domain segment has underscores', () => {
    const state = createInlineState()
    const options = { ...createDefaultOptions(), sanitizer: (x: string) => x }
    const input = 'https://example_.com'
    const result = p.parseMarkdown(
      input,
      state,
      options
    ) as MarkdownToJSX.ASTNode[]
    expect(result).toEqual([
      { type: RuleType.text, text: 'https://example_.com' },
    ])
  })

  it('does not link a www. address whose own text holds no further dot', () => {
    const state = createInlineState()
    const options = { ...createDefaultOptions(), sanitizer: (x: string) => x }
    const result = p.parseMarkdown(
      'www.foo bar.com',
      state,
      options
    ) as MarkdownToJSX.ASTNode[]
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "text": "www.foo bar.com",
          "type": "text",
        },
      ]
    `)
  })

  it('links a www. address that holds its own dot before later text', () => {
    const state = createInlineState()
    const options = { ...createDefaultOptions(), sanitizer: (x: string) => x }
    const result = p.parseMarkdown(
      'www.foo.com bar',
      state,
      options
    ) as MarkdownToJSX.ASTNode[]
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "children": [
            {
              "text": "www.foo.com",
              "type": "text",
            },
          ],
          "target": "http://www.foo.com",
          "title": undefined,
          "type": "link",
        },
        {
          "text": " bar",
          "type": "text",
        },
      ]
    `)
  })

  it('links a later www. address in a rejected run when its own paren balance trims differently', () => {
    const state = createInlineState()
    const options = { ...createDefaultOptions(), sanitizer: (x: string) => x }
    const result = p.parseMarkdown(
      'www.(www.ab_.))',
      state,
      options
    ) as MarkdownToJSX.ASTNode[]
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "text": "www.(",
          "type": "text",
        },
        {
          "children": [
            {
              "text": "www.ab",
              "type": "text",
            },
          ],
          "target": "http://www.ab",
          "title": undefined,
          "type": "link",
        },
        {
          "text": "_.))",
          "type": "text",
        },
      ]
    `)
  })

  it('keeps a ] inside a bare URL run and trims the unmatched trailing ) and ]', () => {
    const state = createInlineState()
    const options = { ...createDefaultOptions(), sanitizer: (x: string) => x }
    const result = p.parseMarkdown(
      'www._]www.a.b)].',
      state,
      options
    ) as MarkdownToJSX.ASTNode[]
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "children": [
            {
              "text": "www._]www.a.b",
              "type": "text",
            },
          ],
          "target": "http://www._]www.a.b",
          "title": undefined,
          "type": "link",
        },
        {
          "text": ")].",
          "type": "text",
        },
      ]
    `)
  })

  it('keeps a trailing ] its [ opened while trimming the unmatched one in a bare URL run', () => {
    const state = createInlineState()
    const options = { ...createDefaultOptions(), sanitizer: (x: string) => x }
    const result = p.parseMarkdown(
      'www._[www.a.b)]].',
      state,
      options
    ) as MarkdownToJSX.ASTNode[]
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "children": [
            {
              "text": "www._[www.a.b)]",
              "type": "text",
            },
          ],
          "target": "http://www._[www.a.b)]",
          "title": undefined,
          "type": "link",
        },
        {
          "text": "].",
          "type": "text",
        },
      ]
    `)
  })

  it('links a later www. address past a [ that the first candidate never closes', () => {
    const state = createInlineState()
    const options = { ...createDefaultOptions(), sanitizer: (x: string) => x }
    const result = p.parseMarkdown(
      'www.[www.a.b_]',
      state,
      options
    ) as MarkdownToJSX.ASTNode[]
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "text": "www.[",
          "type": "text",
        },
        {
          "children": [
            {
              "text": "www.a.b",
              "type": "text",
            },
          ],
          "target": "http://www.a.b",
          "title": undefined,
          "type": "link",
        },
        {
          "text": "_]",
          "type": "text",
        },
      ]
    `)
  })

  it('keeps a trailing ] a later candidate shares with a [ inside its own run', () => {
    const state = createInlineState()
    const options = { ...createDefaultOptions(), sanitizer: (x: string) => x }
    const result = p.parseMarkdown(
      'www._[www.a.b])',
      state,
      options
    ) as MarkdownToJSX.ASTNode[]
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "children": [
            {
              "text": "www._[www.a.b]",
              "type": "text",
            },
          ],
          "target": "http://www._[www.a.b]",
          "title": undefined,
          "type": "link",
        },
        {
          "text": ")",
          "type": "text",
        },
      ]
    `)
  })

  it('keeps a bare URL run as text when a ] before a later candidate leaves it no clean domain', () => {
    const state = createInlineState()
    const options = { ...createDefaultOptions(), sanitizer: (x: string) => x }
    const result = p.parseMarkdown(
      'www.]www.a.b_[]',
      state,
      options
    ) as MarkdownToJSX.ASTNode[]
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "text": "www.]www.a.b_[]",
          "type": "text",
        },
      ]
    `)
  })

  it('keeps a bare URL run as text when a nested [ pair closes after an underscore in the last segment', () => {
    const state = createInlineState()
    const options = { ...createDefaultOptions(), sanitizer: (x: string) => x }
    const result = p.parseMarkdown(
      'www.[[a.b]_]',
      state,
      options
    ) as MarkdownToJSX.ASTNode[]
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "text": "www.[[a.b]_]",
          "type": "text",
        },
      ]
    `)
  })

  it('ends a bare URL at the last closer when a kept ) and a kept ] both remain', () => {
    const state = createInlineState()
    const options = { ...createDefaultOptions(), sanitizer: (x: string) => x }
    const result = p.parseMarkdown(
      'www.[.()]',
      state,
      options
    ) as MarkdownToJSX.ASTNode[]
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "children": [
            {
              "text": "www.[.()]",
              "type": "text",
            },
          ],
          "target": "http://www.[.()]",
          "title": undefined,
          "type": "link",
        },
      ]
    `)
  })

  it('allows underscores outside final domain segments', () => {
    const state = createInlineState()
    const options = { ...createDefaultOptions(), sanitizer: (x: string) => x }
    const input = 'https://a_b.c_d.example.com/path'
    const result = p.parseMarkdown(
      input,
      state,
      options
    ) as MarkdownToJSX.ASTNode[]
    expect(result).toEqual([
      {
        type: RuleType.link,
        target: 'https://a_b.c_d.example.com/path',
        children: [
          { type: RuleType.text, text: 'https://a_b.c_d.example.com/path' },
        ],
      } as MarkdownToJSX.ASTNode,
    ])
  })

  it('strips trailing asterisks from bare URL href (e.g. URL wrapped in bold **url**)', () => {
    const state = createInlineState()
    const options = { ...createDefaultOptions(), sanitizer: (x: string) => x }
    const result = p.parseMarkdown(
      'https://acme.com/foo**',
      state,
      options
    ) as MarkdownToJSX.ASTNode[]
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      type: RuleType.link,
      target: 'https://acme.com/foo',
      children: [{ type: RuleType.text, text: 'https://acme.com/foo' }],
    })
    expect((result[1] as MarkdownToJSX.TextNode).text).toBe('**')
  })

  it('links the whole local-part of a bare email, never starting at an inner "h" ("tec" plus a link to "hnicalsupport@example.com"), when the @ is more than 64 characters from the start of the parsed string (issue #877)', () => {
    const state = createInlineState()
    const options = { ...createDefaultOptions(), sanitizer: (x: string) => x }
    const input =
      'Please contact Support at 1-111-111-1111 or email technicalsupport@example.com for further assistance.'
    const result = p.parseMarkdown(
      input,
      state,
      options
    ) as MarkdownToJSX.ASTNode[]
    expect(result).toEqual([
      {
        type: RuleType.text,
        text: 'Please contact Support at 1-111-111-1111 or email ',
      },
      {
        type: RuleType.link,
        target: 'mailto:technicalsupport@example.com',
        title: undefined,
        children: [
          { type: RuleType.text, text: 'technicalsupport@example.com' },
        ],
      } as MarkdownToJSX.ASTNode,
      { type: RuleType.text, text: ' for further assistance.' },
    ])
  })

  it('links the whole local-part of a bare email containing w or f before an @ more than 65 characters from the start of the parsed string', () => {
    const options = { ...createDefaultOptions(), sanitizer: (x: string) => x }
    const inputW =
      'Please contact Support at 1-111-111-1111 or email technicalsupworker@example.com for further assistance.'
    const resultW = p.parseMarkdown(
      inputW,
      createInlineState(),
      options
    ) as MarkdownToJSX.ASTNode[]
    expect(resultW[1]).toEqual({
      type: RuleType.link,
      target: 'mailto:technicalsupworker@example.com',
      title: undefined,
      children: [
        { type: RuleType.text, text: 'technicalsupworker@example.com' },
      ],
    } as MarkdownToJSX.ASTNode)
    const inputF =
      'Please contact Support at 1-111-111-1111 or email technicalsupfool@example.com for further assistance.'
    const resultF = p.parseMarkdown(
      inputF,
      createInlineState(),
      options
    ) as MarkdownToJSX.ASTNode[]
    expect(resultF[1]).toEqual({
      type: RuleType.link,
      target: 'mailto:technicalsupfool@example.com',
      title: undefined,
      children: [{ type: RuleType.text, text: 'technicalsupfool@example.com' }],
    } as MarkdownToJSX.ASTNode)
  })

  it('still autolinks bare email at the very start of the string (no fast-skip involved)', () => {
    const state = createInlineState()
    const options = { ...createDefaultOptions(), sanitizer: (x: string) => x }
    const result = p.parseMarkdown(
      'technicalsupport@example.com',
      state,
      options
    ) as MarkdownToJSX.ASTNode[]
    expect(result).toEqual([
      {
        type: RuleType.link,
        target: 'mailto:technicalsupport@example.com',
        title: undefined,
        children: [
          { type: RuleType.text, text: 'technicalsupport@example.com' },
        ],
      } as MarkdownToJSX.ASTNode,
    ])
  })

  it('rejects angle autolinks containing tabs, since CommonMark treats tabs as ASCII control characters that invalidate autolinks, leaving the brackets and content as literal text', () => {
    const state = createInlineState()
    const options: p.ParseOptions = {
      disableParsingRawHTML: true,
      sanitizer: (x: string) => x,
      slugify: (value: string) => value,
    }
    const input = '<https://example.com\tpath>'
    const result = p.parseMarkdown(
      input,
      state,
      options
    ) as MarkdownToJSX.ASTNode[]
    expect(result).toEqual([
      { type: RuleType.text, text: '<https://example.com\tpath>' },
    ])
  })

  it('trims emphasis delimiters from bare URL endings (issue #839)', () => {
    const result = p.parser('**www.acme.com/training**')
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "children": [
            {
              "children": [
                {
                  "children": [
                    {
                      "text": "www.acme.com/training",
                      "type": "text",
                    },
                  ],
                  "target": "http://www.acme.com/training",
                  "title": undefined,
                  "type": "link",
                },
              ],
              "tag": "strong",
              "type": "textFormatted",
            },
          ],
          "type": "paragraph",
        },
      ]
    `)
  })

  it('trims emphasis delimiters from https bare URL endings', () => {
    const result = p.parser('Visit **https://acme.com/path** for more.')
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "children": [
            {
              "text": "Visit ",
              "type": "text",
            },
            {
              "children": [
                {
                  "children": [
                    {
                      "text": "https://acme.com/path",
                      "type": "text",
                    },
                  ],
                  "target": "https://acme.com/path",
                  "title": undefined,
                  "type": "link",
                },
              ],
              "tag": "strong",
              "type": "textFormatted",
            },
            {
              "text": " for more.",
              "type": "text",
            },
          ],
          "type": "paragraph",
        },
      ]
    `)
  })

  it('leaves a closing ] that the bare URL did not open out of the link', () => {
    const result = p.parser('[see https://example.com/a]')
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "children": [
            {
              "text": "[see ",
              "type": "text",
            },
            {
              "children": [
                {
                  "text": "https://example.com/a",
                  "type": "text",
                },
              ],
              "target": "https://example.com/a",
              "title": undefined,
              "type": "link",
            },
            {
              "text": "]",
              "type": "text",
            },
          ],
          "type": "paragraph",
        },
      ]
    `)
  })

  it('keeps a ] that closes a [ inside the bare URL', () => {
    const result = p.parser('[see https://example.com/?a[0]=1]')
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "children": [
            {
              "text": "[see ",
              "type": "text",
            },
            {
              "children": [
                {
                  "text": "https://example.com/?a[0]=1",
                  "type": "text",
                },
              ],
              "target": "https://example.com/?a[0]=1",
              "title": undefined,
              "type": "link",
            },
            {
              "text": "]",
              "type": "text",
            },
          ],
          "type": "paragraph",
        },
      ]
    `)
  })
})

describe('collectReferenceDefinitions', () => {
  it('should collect reference definitions', () => {
    const refs = createEmptyRefs()
    const options = createDefaultOptions()
    p.collectReferenceDefinitions('[test]: http://example.com', refs, options)
    expect(refs).toHaveProperty('test')
    expect(refs.test).toEqual({
      target: 'http://example.com',
      title: undefined,
    })
  })

  it('should collect multiple reference definitions', () => {
    const refs = createEmptyRefs()
    const options = createDefaultOptions()
    const input = `[test]: http://example.com
[other]: https://example.org
[third]: ftp://example.net`
    p.collectReferenceDefinitions(input, refs, options)
    expect(refs).toHaveProperty('test')
    expect(refs).toHaveProperty('other')
    expect(refs).toHaveProperty('third')
    expect(refs.test.target).toBe('http://example.com')
    expect(refs.other.target).toBe('https://example.org')
    expect(refs.third.target).toBe('ftp://example.net')
  })

  it('should handle reference definitions with titles', () => {
    const refs = createEmptyRefs()
    const options = createDefaultOptions()
    const input = `[test]: http://example.com "A title"
[quoted]: https://example.org 'Single quotes'
[parens]: ftp://example.net (Parentheses)`
    p.collectReferenceDefinitions(input, refs, options)
    expect(refs.test.title).toBe('A title')
    expect(refs.quoted.title).toBe('Single quotes')
    expect(refs.parens.title).toBe('Parentheses')
  })

  it('should normalize reference labels case-insensitively, with the first definition winning per CommonMark', () => {
    const refs = createEmptyRefs()
    const options = createDefaultOptions()
    const input = `[Test]: http://example.com
[TEST]: https://example.org`
    p.collectReferenceDefinitions(input, refs, options)
    expect(refs).toHaveProperty('test')
    expect(refs.test.target).toBe('http://example.com')
  })

  it('should normalize whitespace in labels', () => {
    const refs = createEmptyRefs()
    const options = createDefaultOptions()
    const input = '[ test   label ]: http://example.com'
    p.collectReferenceDefinitions(input, refs, options)
    expect(refs).toHaveProperty('test label')
  })

  it('should handle empty input', () => {
    const refs = createEmptyRefs()
    const options = createDefaultOptions()
    p.collectReferenceDefinitions('', refs, options)
    expect(refs).toEqual({})
  })

  it('should handle malformed references', () => {
    const refs = createEmptyRefs()
    const options = createDefaultOptions()
    p.collectReferenceDefinitions('[invalid reference', refs, options)
    expect(refs).toEqual({})
  })

  it('should handle references with special characters in URLs', () => {
    const refs = createEmptyRefs()
    const options = createDefaultOptions()
    const input = '[test]: http://example.com/path(1)?query=value#fragment'
    p.collectReferenceDefinitions(input, refs, options)
    expect(refs.test.target).toBe(
      'http://example.com/path(1)?query=value#fragment'
    )
  })

  it('should collect indented reference definitions (0-3 spaces)', () => {
    const refs = createEmptyRefs()
    const options = createDefaultOptions()
    const input = `   [indented]: http://example.com
[valid]: https://example.org`
    p.collectReferenceDefinitions(input, refs, options)
    expect(refs).toHaveProperty('valid')
    expect(refs).toHaveProperty('indented')
  })

  it('should reject reference definitions indented 4+ spaces', () => {
    const refs = createEmptyRefs()
    const options = createDefaultOptions()
    p.collectReferenceDefinitions(
      '    [too-indented]: http://example.com',
      refs,
      options
    )
    expect(refs).not.toHaveProperty('too-indented')
  })

  it('should handle Unicode content in reference labels (Han Chinese)', () => {
    const refs = createEmptyRefs()
    const options = createDefaultOptions()
    const input = `[中文]: http://example.com/chinese
[日本語]: https://example.jp/japanese
[한글]: https://example.kr/korean`
    p.collectReferenceDefinitions(input, refs, options)
    expect(refs).toHaveProperty('中文')
    expect(refs).toHaveProperty('日本語')
    expect(refs).toHaveProperty('한글')
    expect(refs.中文.target).toBe('http://example.com/chinese')
    expect(refs.日本語.target).toBe('https://example.jp/japanese')
    expect(refs.한글.target).toBe('https://example.kr/korean')
  })

  it('should normalize Unicode reference labels case-insensitively', () => {
    const input = `[中文链接]: http://example.com

This is a link to [中文链接] in Chinese.`
    const result = p.parser(input, createDefaultOptions())
    expect(result).toMatchInlineSnapshot(`
[
  {
    "refs": {
      "中文链接": {
        "target": "http://example.com",
        "title": undefined,
      },
    },
    "type": "refCollection",
  },
  {
    "children": [
      {
        "text": "This is a link to ",
        "type": "text",
      },
      {
        "children": [
          {
            "text": "中文链接",
            "type": "text",
          },
        ],
        "target": "http://example.com",
        "title": undefined,
        "type": "link",
      },
      {
        "text": " in Chinese.",
        "type": "text",
      },
    ],
    "type": "paragraph",
  },
]
`)
  })

  it('should collect reference definitions with malformed URLs, since the parser is permissive about URL validation', () => {
    const refs = createEmptyRefs()
    const options = createDefaultOptions()
    const input = `[bad-url]: not-a-url
[good]: http://example.com`
    p.collectReferenceDefinitions(input, refs, options)
    expect(refs).toHaveProperty('good')
    expect(refs).toHaveProperty('bad-url')
  })

  it('should handle reference definitions with unclosed brackets', () => {
    const refs = createEmptyRefs()
    const options = createDefaultOptions()
    p.collectReferenceDefinitions(
      '[unclosed: http://example.com',
      refs,
      options
    )
    expect(refs).not.toHaveProperty('unclosed')
  })

  it('should handle reference definitions with nested brackets', () => {
    const refs = createEmptyRefs()
    const options = createDefaultOptions()
    const input = '[nested [brackets]]: http://example.com'
    p.collectReferenceDefinitions(input, refs, options)
    expect(refs).not.toHaveProperty('nested [brackets]')
  })

  it('should reject reference definitions inside fenced code blocks', () => {
    const _refs = createEmptyRefs()
    const options = createDefaultOptions()
    const input =
      '```\n[inside-code]: http://example.com\n```\n[outside]: https://example.org'
    const result = p.parser(input, options)
    const refNode = result.find(
      (n): n is MarkdownToJSX.ReferenceCollectionNode =>
        n.type === RuleType.refCollection
    )
    expect(refNode?.refs).toHaveProperty('outside')
    expect(refNode?.refs).not.toHaveProperty('inside-code')
  })
})

describe('parseDefinition', () => {
  it('should parse valid reference definitions', () => {
    const options = createDefaultOptions()
    const result = p.parseDefinition(
      '[test]: http://example.com',
      0,
      createBlockState(),
      options,
      false
    )
    expect(result).toMatchInlineSnapshot(`
      {
        "end": 26,
        "endPos": 26,
        "type": "ref",
      }
    `)
  })

  it('should parse definitions with angle-bracketed URLs', () => {
    const options = createDefaultOptions()
    const result = p.parseDefinition(
      '[test]: <http://example.com>',
      0,
      createBlockState(),
      options,
      false
    )
    expect(result).toMatchInlineSnapshot(`
      {
        "end": 28,
        "endPos": 28,
        "type": "ref",
      }
    `)
  })

  it('should parse definitions with titles in double quotes', () => {
    const options = createDefaultOptions()
    const result = p.parseDefinition(
      '[test]: http://example.com "A double-quoted title"',
      0,
      createBlockState(),
      options,
      false
    )
    expect(result).toMatchInlineSnapshot(`
      {
        "end": 50,
        "endPos": 50,
        "type": "ref",
      }
    `)
  })

  it('should parse definitions with titles in single quotes', () => {
    const options = createDefaultOptions()
    const result = p.parseDefinition(
      "[test]: http://example.com 'Single quoted title'",
      0,
      createBlockState(),
      options,
      false
    )
    expect(result).toMatchInlineSnapshot(`
      {
        "end": 48,
        "endPos": 48,
        "type": "ref",
      }
    `)
  })

  it('should parse definitions with titles in parentheses', () => {
    const options = createDefaultOptions()
    const result = p.parseDefinition(
      '[test]: http://example.com (Parenthesized title)',
      0,
      createBlockState(),
      options,
      false
    )
    expect(result).toMatchInlineSnapshot(`
      {
        "end": 48,
        "endPos": 48,
        "type": "ref",
      }
    `)
  })

  it('should parse definitions with multiline titles', () => {
    const options = createDefaultOptions()
    const input =
      '[test]: http://example.com\n    (Multiline title\n    continues here)'
    const result = p.parseDefinition(
      input,
      0,
      createBlockState(),
      options,
      false
    )
    expect(result).toMatchInlineSnapshot(`
      {
        "end": 67,
        "endPos": 67,
        "type": "ref",
      }
    `)
  })

  it('should parse definitions with URLs containing special characters', () => {
    const options = createDefaultOptions()
    const result = p.parseDefinition(
      '[test]: http://example.com/path(1)?query=value#fragment',
      0,
      createBlockState(),
      options,
      false
    )
    expect(result).toMatchInlineSnapshot(`
      {
        "end": 55,
        "endPos": 55,
        "type": "ref",
      }
    `)
  })

  it('should parse definitions with complex labels', () => {
    const options = createDefaultOptions()
    const result = p.parseDefinition(
      '[a complex-label_with.special.chars]: http://example.com',
      0,
      createBlockState(),
      options,
      false
    )
    expect(result).toMatchInlineSnapshot(`
      {
        "end": 56,
        "endPos": 56,
        "type": "ref",
      }
    `)
  })

  it('should return null for invalid definitions', () => {
    const options = createDefaultOptions()
    const result = p.parseDefinition(
      'invalid definition',
      0,
      createBlockState(),
      options,
      false
    )
    expect(result).toBeNull()
  })

  it('should return null for definitions without closing bracket', () => {
    const options = createDefaultOptions()
    const result = p.parseDefinition(
      '[test: http://example.com',
      0,
      createBlockState(),
      options,
      false
    )
    expect(result).toBeNull()
  })

  it('should return null for definitions without colon', () => {
    const options = createDefaultOptions()
    const result = p.parseDefinition(
      '[test] http://example.com',
      0,
      createBlockState(),
      options,
      false
    )
    expect(result).toBeNull()
  })

  it('should return null for indented definitions', () => {
    const options = createDefaultOptions()
    const result = p.parseDefinition(
      '  [test]: http://example.com',
      0,
      createBlockState(),
      options,
      false
    )
    expect(result).toBeNull()
  })

  it('should parse definitions with blank lines in title', () => {
    const options = createDefaultOptions()
    const input = '[test]: http://example.com "title\n      with blank line"'
    const result = p.parseDefinition(
      input,
      0,
      createBlockState(),
      options,
      false
    )
    expect(result).toMatchInlineSnapshot(`
      {
        "end": 56,
        "endPos": 56,
        "type": "ref",
      }
    `)
  })
})

describe('calculateIndent', () => {
  it('should calculate indent for various inputs', () => {
    expect(p.calculateIndent('   test', 0, 6)).toMatchObject({
      spaceEquivalent: 3,
      charCount: 3,
    })
    expect(p.calculateIndent('\t\ttest', 0, 6)).toMatchObject({
      spaceEquivalent: 8,
      charCount: 2,
    })
    expect(p.calculateIndent('test', 0, 4)).toMatchObject({
      spaceEquivalent: 0,
      charCount: 0,
    })
  })

  it('should handle empty strings', () => {
    expect(p.calculateIndent('', 0, 0)).toMatchObject({
      spaceEquivalent: 0,
      charCount: 0,
    })
  })

  it('should handle strings with only whitespace', () => {
    expect(p.calculateIndent('   ', 0, 3)).toMatchObject({
      spaceEquivalent: 3,
      charCount: 3,
    })
    expect(p.calculateIndent('\t\t', 0, 2)).toMatchObject({
      spaceEquivalent: 8,
      charCount: 2,
    })
  })

  it('should handle position beyond string length', () => {
    expect(p.calculateIndent('test', 10, 14)).toMatchObject({
      spaceEquivalent: 0,
      charCount: 0,
    })
  })

  it('should handle all indent whitespace without maxSpaces', () => {
    expect(p.calculateIndent('       test', 0, 11)).toMatchObject({
      spaceEquivalent: 7,
      charCount: 7,
    })
  })
})

describe('parseCodeFenced', () => {
  it('reads info string attributes as raw HTML attributes are read: a style object, and URLs through the sanitizer', () => {
    expect(
      p.parser(
        '```x style="color:red; margin-top: 1px" href="/a" title="t"\ny\n```',
        {
          sanitizer: value => `${value}?checked`,
        }
      )[0]
    ).toMatchInlineSnapshot(`
      {
        "attrs": {
          "href": "/a?checked",
          "style": {
            "color": "red",
            "marginTop": "1px",
          },
          "title": "t",
        },
        "infoString": "style="color:red; margin-top: 1px" href="/a" title="t"",
        "lang": "x",
        "text": "y",
        "type": "codeBlock",
      }
    `)
  })

  it('should parse fenced code blocks', () => {
    const _options = createDefaultOptions()
    const result = p.parseCodeFenced('```\ncode\n```', 0, createBlockState())
    expect(result).toMatchInlineSnapshot(`
      {
        "attrs": undefined,
        "end": 12,
        "endPos": 12,
        "lang": undefined,
        "node": {
          "attrs": undefined,
          "infoString": undefined,
          "lang": undefined,
          "text": "code",
          "type": "codeBlock",
        },
        "text": "code",
        "type": "codeBlock",
      }
    `)
  })

  it('should parse fences with tildes', () => {
    const _options = createDefaultOptions()
    const result = p.parseCodeFenced('~~~\ncode\n~~~', 0, createBlockState())
    expect(result).toMatchInlineSnapshot(`
      {
        "attrs": undefined,
        "end": 12,
        "endPos": 12,
        "lang": undefined,
        "node": {
          "attrs": undefined,
          "infoString": undefined,
          "lang": undefined,
          "text": "code",
          "type": "codeBlock",
        },
        "text": "code",
        "type": "codeBlock",
      }
    `)
  })

  it('should handle code with info string', () => {
    const _options = createDefaultOptions()
    const result = p.parseCodeFenced(
      '```javascript\ncode\n```',
      0,
      createBlockState()
    )
    expect(result).toMatchInlineSnapshot(`
      {
        "attrs": undefined,
        "end": 22,
        "endPos": 22,
        "lang": "javascript",
        "node": {
          "attrs": undefined,
          "infoString": undefined,
          "lang": "javascript",
          "text": "code",
          "type": "codeBlock",
        },
        "text": "code",
        "type": "codeBlock",
      }
    `)
  })

  it('should handle longer fence markers', () => {
    const _options = createDefaultOptions()
    const result = p.parseCodeFenced('````\ncode\n````', 0, createBlockState())
    expect(result).toMatchInlineSnapshot(`
      {
        "attrs": undefined,
        "end": 14,
        "endPos": 14,
        "lang": undefined,
        "node": {
          "attrs": undefined,
          "infoString": undefined,
          "lang": undefined,
          "text": "code",
          "type": "codeBlock",
        },
        "text": "code",
        "type": "codeBlock",
      }
    `)
  })

  it('should handle mixed fence types (backticks with tildes)', () => {
    const _options = createDefaultOptions()
    const result = p.parseCodeFenced(
      '```javascript\ncode\n~~~',
      0,
      createBlockState()
    )
    expect(result).toMatchInlineSnapshot(`
      {
        "attrs": undefined,
        "end": 22,
        "endPos": 22,
        "lang": "javascript",
        "node": {
          "attrs": undefined,
          "infoString": undefined,
          "lang": "javascript",
          "text": 
      "code
      ~~~"
      ,
          "type": "codeBlock",
        },
        "text": 
      "code
      ~~~"
      ,
        "type": "codeBlock",
      }
    `)
  })

  it('should parse indented opening fence (up to 3 spaces)', () => {
    const _options = createDefaultOptions()
    const result = p.parseCodeFenced(
      '   ```\ncode\n   ```',
      0,
      createBlockState()
    )
    expect(result).toMatchInlineSnapshot(`
      {
        "attrs": undefined,
        "end": 18,
        "endPos": 18,
        "lang": undefined,
        "node": {
          "attrs": undefined,
          "infoString": undefined,
          "lang": undefined,
          "text": "code",
          "type": "codeBlock",
        },
        "text": "code",
        "type": "codeBlock",
      }
    `)
  })

  it('should return null for indented fences (4+ spaces)', () => {
    const _options = createDefaultOptions()
    const result = p.parseCodeFenced(
      '    ```\ncode\n```',
      0,
      createBlockState()
    )
    expect(result).toMatchInlineSnapshot('null')
  })

  it('should handle fences with spaces after info string', () => {
    const _options = createDefaultOptions()
    const result = p.parseCodeFenced(
      '```javascript \ncode\n```',
      0,
      createBlockState()
    )
    expect(result).toMatchInlineSnapshot(`
      {
        "attrs": undefined,
        "end": 23,
        "endPos": 23,
        "lang": "javascript",
        "node": {
          "attrs": undefined,
          "infoString": undefined,
          "lang": "javascript",
          "text": "code",
          "type": "codeBlock",
        },
        "text": "code",
        "type": "codeBlock",
      }
    `)
  })

  it('should handle empty code blocks', () => {
    const _options = createDefaultOptions()
    const result = p.parseCodeFenced('```\n```', 0, createBlockState())
    expect(result).toMatchInlineSnapshot(`
      {
        "attrs": undefined,
        "end": 7,
        "endPos": 7,
        "lang": undefined,
        "node": {
          "attrs": undefined,
          "infoString": undefined,
          "lang": undefined,
          "text": "",
          "type": "codeBlock",
        },
        "text": "",
        "type": "codeBlock",
      }
    `)
  })

  it('should handle code blocks with blank lines', () => {
    const _options = createDefaultOptions()
    const result = p.parseCodeFenced(
      '```\nline1\n\nline3\n```',
      0,
      createBlockState()
    )
    expect(result).toMatchInlineSnapshot(`
      {
        "attrs": undefined,
        "end": 20,
        "endPos": 20,
        "lang": undefined,
        "node": {
          "attrs": undefined,
          "infoString": undefined,
          "lang": undefined,
          "text": 
      "line1

      line3"
      ,
          "type": "codeBlock",
        },
        "text": 
      "line1

      line3"
      ,
        "type": "codeBlock",
      }
    `)
  })

  it('should handle unclosed fences', () => {
    const _options = createDefaultOptions()
    const result = p.parseCodeFenced(
      '```\ncode\n\nmore code\n\nand even more',
      0,
      createBlockState()
    )
    expect(result).toMatchInlineSnapshot(`
      {
        "attrs": undefined,
        "end": 34,
        "endPos": 34,
        "lang": undefined,
        "node": {
          "attrs": undefined,
          "infoString": undefined,
          "lang": undefined,
          "text": 
      "code

      more code

      and even more"
      ,
          "type": "codeBlock",
        },
        "text": 
      "code

      more code

      and even more"
      ,
        "type": "codeBlock",
      }
    `)
  })

  it('should handle fences with shorter closing markers', () => {
    const _options = createDefaultOptions()
    const result = p.parseCodeFenced('````\ncode\n```', 0, createBlockState())
    expect(result).toMatchInlineSnapshot(`
      {
        "attrs": undefined,
        "end": 13,
        "endPos": 13,
        "lang": undefined,
        "node": {
          "attrs": undefined,
          "infoString": undefined,
          "lang": undefined,
          "text": 
      "code
      \`\`\`"
      ,
          "type": "codeBlock",
        },
        "text": 
      "code
      \`\`\`"
      ,
        "type": "codeBlock",
      }
    `)
  })

  it('should return null for fences shorter than 3 characters', () => {
    const _options = createDefaultOptions()
    const result = p.parseCodeFenced('``\ncode\n``', 0, createBlockState())
    expect(result).toBeNull()
  })

  it('should treat fence with language as new opening, implicitly closing previous block', () => {
    const _options = createDefaultOptions()
    const input = '```markdown\n```python\ncode\n```'
    const result = p.parseCodeFenced(input, 0, createBlockState())
    expect(result).toMatchInlineSnapshot(`
      {
        "attrs": undefined,
        "end": 30,
        "endPos": 30,
        "lang": "markdown",
        "node": {
          "attrs": undefined,
          "infoString": undefined,
          "lang": "markdown",
          "text": 
      "\`\`\`python
      code"
      ,
          "type": "codeBlock",
        },
        "text": 
      "\`\`\`python
      code"
      ,
        "type": "codeBlock",
      }
    `)

    if (result == null) {
      throw new Error('expected fenced parse result')
    }
    const nextResult = p.parseCodeFenced(
      input,
      result.endPos,
      createBlockState()
    )
    expect(nextResult).toMatchInlineSnapshot('null')
  })

  it('should treat fence with space before info string as content, since it is neither a valid closing fence nor a new opening (CommonMark compliant)', () => {
    const _options = createDefaultOptions()
    const input = '```\n``` aaa\n```'
    const result = p.parseCodeFenced(input, 0, createBlockState())
    expect(result).toMatchInlineSnapshot(`
      {
        "attrs": undefined,
        "end": 15,
        "endPos": 15,
        "lang": undefined,
        "node": {
          "attrs": undefined,
          "infoString": undefined,
          "lang": undefined,
          "text": "\`\`\` aaa",
          "type": "codeBlock",
        },
        "text": "\`\`\` aaa",
        "type": "codeBlock",
      }
    `)
  })

  it('should handle nested code blocks with different languages', () => {
    const options = createDefaultOptions()
    const input = `\`\`\`markdown
\`this right here is important\`
\`\`\`python
def greet(name):
  print("Hello")
\`\`\`
\`\`\``
    const results = p.parser(input, options)
    expect(results).toMatchInlineSnapshot(`
      [
        {
          "attrs": undefined,
          "infoString": undefined,
          "lang": "markdown",
          "text": 
      "\`this right here is important\`
      \`\`\`python
      def greet(name):
        print("Hello")"
      ,
          "type": "codeBlock",
        },
        {
          "attrs": undefined,
          "infoString": undefined,
          "lang": undefined,
          "text": "",
          "type": "codeBlock",
        },
      ]
    `)
  })

  it('should handle tilde fence with language as new opening', () => {
    const _options = createDefaultOptions()
    const input = '~~~markdown\n~~~python\ncode\n~~~'
    const result = p.parseCodeFenced(input, 0, createBlockState())
    expect(result).toMatchInlineSnapshot(`
      {
        "attrs": undefined,
        "end": 30,
        "endPos": 30,
        "lang": "markdown",
        "node": {
          "attrs": undefined,
          "infoString": undefined,
          "lang": "markdown",
          "text": 
      "~~~python
      code"
      ,
          "type": "codeBlock",
        },
        "text": 
      "~~~python
      code"
      ,
        "type": "codeBlock",
      }
    `)
  })

  it('should not treat fence with backtick in info string as new opening, since CommonMark backtick fences cannot have backticks in the info string, so the entire content is parsed', () => {
    const _options = createDefaultOptions()
    const input = '```\n```py`thon\n```'
    const result = p.parseCodeFenced(input, 0, createBlockState())
    expect(result).toMatchInlineSnapshot(`
      {
        "attrs": undefined,
        "end": 18,
        "endPos": 18,
        "lang": undefined,
        "node": {
          "attrs": undefined,
          "infoString": undefined,
          "lang": undefined,
          "text": "\`\`\`py\`thon",
          "type": "codeBlock",
        },
        "text": "\`\`\`py\`thon",
        "type": "codeBlock",
      }
    `)
  })
})

describe('parseHTMLTag', () => {
  it('should parse valid HTML tags', () => {
    const result = p.parseHTMLTag('<div>', 0)
    expect(result).toEqual({
      tagName: 'div',
      tagLower: 'div',
      attrs: '',
      whitespaceBeforeAttrs: '',
      isSelfClosing: false,
      hasSpaceBeforeSlash: false,
      isClosing: false,
      hasNewline: false,
      endPos: 5,
    })
  })

  it('should parse closing tags', () => {
    const result = p.parseHTMLTag('</div>', 0)
    expect(result).toEqual({
      tagName: 'div',
      tagLower: 'div',
      attrs: '',
      whitespaceBeforeAttrs: '',
      isSelfClosing: false,
      hasSpaceBeforeSlash: false,
      isClosing: true,
      hasNewline: false,
      endPos: 6,
    })
  })

  it('should parse self-closing tags', () => {
    const result = p.parseHTMLTag('<br/>', 0)
    expect(result).toEqual({
      tagName: 'br',
      tagLower: 'br',
      attrs: '',
      whitespaceBeforeAttrs: '',
      isSelfClosing: true,
      hasSpaceBeforeSlash: false,
      isClosing: false,
      hasNewline: false,
      endPos: 5,
    })
  })

  it('should parse self-closing tags with space before slash', () => {
    const result = p.parseHTMLTag('<br />', 0)
    expect(result).toEqual({
      tagName: 'br',
      tagLower: 'br',
      attrs: '',
      whitespaceBeforeAttrs: ' ',
      isSelfClosing: true,
      hasSpaceBeforeSlash: false,
      isClosing: false,
      hasNewline: false,
      endPos: 6,
    })
  })

  it('should parse tags with single attribute', () => {
    const result = p.parseHTMLTag('<div class="test">', 0)
    expect(result).toEqual({
      tagName: 'div',
      tagLower: 'div',
      attrs: 'class="test"',
      whitespaceBeforeAttrs: ' ',
      isSelfClosing: false,
      hasSpaceBeforeSlash: false,
      isClosing: false,
      hasNewline: false,
      endPos: 18,
    })
  })

  it('should parse tags with multiple attributes', () => {
    const result = p.parseHTMLTag(
      '<div class="test" id="main" data-value="123">',
      0
    )
    expect(result).toEqual({
      tagName: 'div',
      tagLower: 'div',
      attrs: 'class="test" id="main" data-value="123"',
      whitespaceBeforeAttrs: ' ',
      isSelfClosing: false,
      hasSpaceBeforeSlash: false,
      isClosing: false,
      hasNewline: false,
      endPos: 45,
    })
  })

  it('should parse tags with single-quoted attributes', () => {
    const result = p.parseHTMLTag("<div class='test'>", 0)
    expect(result).toEqual({
      tagName: 'div',
      tagLower: 'div',
      attrs: "class='test'",
      whitespaceBeforeAttrs: ' ',
      isSelfClosing: false,
      hasSpaceBeforeSlash: false,
      isClosing: false,
      hasNewline: false,
      endPos: 18,
    })
  })

  it('should parse tags with unquoted attributes', () => {
    const result = p.parseHTMLTag('<div class=test>', 0)
    expect(result).toEqual({
      tagName: 'div',
      tagLower: 'div',
      attrs: 'class=test',
      whitespaceBeforeAttrs: ' ',
      isSelfClosing: false,
      hasSpaceBeforeSlash: false,
      isClosing: false,
      hasNewline: false,
      endPos: 16,
    })
  })

  it('should parse tags with attributes containing special characters', () => {
    const result = p.parseHTMLTag(
      '<a href="http://example.com/path?query=value&other=123">',
      0
    )
    expect(result).toEqual({
      tagName: 'a',
      tagLower: 'a',
      attrs: 'href="http://example.com/path?query=value&other=123"',
      whitespaceBeforeAttrs: ' ',
      isSelfClosing: false,
      hasSpaceBeforeSlash: false,
      isClosing: false,
      hasNewline: false,
      endPos: 56,
    })
  })

  it('should parse tags with percent character in attributes without throwing URIError (issue #753)', () => {
    const result = p.parseHTMLTag(
      '<iframe src="https://example.com" width="100%"></iframe>',
      0
    )
    expect(result).toEqual({
      tagName: 'iframe',
      tagLower: 'iframe',
      attrs: 'src="https://example.com" width="100%"',
      whitespaceBeforeAttrs: ' ',
      isSelfClosing: false,
      hasSpaceBeforeSlash: false,
      isClosing: false,
      hasNewline: false,
      endPos: 47,
    })
  })

  it('should parse tags with multiple spaces before attributes', () => {
    const result = p.parseHTMLTag('<div   class="test">', 0)
    expect(result).toEqual({
      tagName: 'div',
      tagLower: 'div',
      attrs: 'class="test"',
      whitespaceBeforeAttrs: '   ',
      isSelfClosing: false,
      hasSpaceBeforeSlash: false,
      isClosing: false,
      hasNewline: false,
      endPos: 20,
    })
  })

  it('should parse tags with newlines in whitespace before attributes', () => {
    const result = p.parseHTMLTag('<div\nclass="test">', 0)
    expect(result).toEqual({
      tagName: 'div',
      tagLower: 'div',
      attrs: 'class="test"',
      whitespaceBeforeAttrs: '\n',
      isSelfClosing: false,
      hasSpaceBeforeSlash: false,
      isClosing: false,
      hasNewline: true,
      endPos: 18,
    })
  })

  it('should parse tags with mixed whitespace before attributes', () => {
    const result = p.parseHTMLTag('<div \t\n class="test">', 0)
    expect(result).toEqual({
      tagName: 'div',
      tagLower: 'div',
      attrs: 'class="test"',
      whitespaceBeforeAttrs: ' \t\n ',
      isSelfClosing: false,
      hasSpaceBeforeSlash: false,
      isClosing: false,
      hasNewline: true,
      endPos: 21,
    })
  })

  it('should return null for invalid tags', () => {
    const result = p.parseHTMLTag('<invalid', 0)
    expect(result).toBeNull()
  })

  it('should return null for tags without closing bracket', () => {
    const result = p.parseHTMLTag('<div class="test"', 0)
    expect(result).toBeNull()
  })

  it('should return null for malformed tag names', () => {
    const result = p.parseHTMLTag('<123invalid>', 0)
    expect(result).toBeNull()
  })

  it('should handle uppercase tags', () => {
    const result = p.parseHTMLTag('<DIV>', 0)
    expect(result).toEqual({
      tagName: 'DIV',
      tagLower: 'div',
      attrs: '',
      whitespaceBeforeAttrs: '',
      isSelfClosing: false,
      hasSpaceBeforeSlash: false,
      isClosing: false,
      hasNewline: false,
      endPos: 5,
    })
  })

  it('should handle tags with numbers and hyphens', () => {
    const result = p.parseHTMLTag('<custom-tag-123>', 0)
    expect(result).toEqual({
      tagName: 'custom-tag-123',
      tagLower: 'custom-tag-123',
      attrs: '',
      whitespaceBeforeAttrs: '',
      isSelfClosing: false,
      hasSpaceBeforeSlash: false,
      isClosing: false,
      hasNewline: false,
      endPos: 16,
    })
  })

  it('should reject tags with underscores in tag name (no whitespace), since CommonMark tag names allow only [a-zA-Z][a-zA-Z0-9-]*', () => {
    const result = p.parseHTMLTag('<custom_tag>', 0)
    expect(result).toBeNull()
  })

  it('should reject tags with invalid characters after tag name (no whitespace), since CommonMark requires whitespace before attributes', () => {
    const result = p.parseHTMLTag('<tag@name>', 0)
    expect(result).toBeNull()

    const result2 = p.parseHTMLTag('<tag.name>', 0)
    expect(result2).toBeNull()

    const result3 = p.parseHTMLTag('<tag#name>', 0)
    expect(result3).toBeNull()

    const result4 = p.parseHTMLTag('<tag$name>', 0)
    expect(result4).toBeNull()
  })

  it('should reject tags with numbers at the start of names', () => {
    const result = p.parseHTMLTag('<123tag>', 0)
    expect(result).toBeNull()
  })

  it('should reject a quote without equals before the value and an equals without a preceding attribute name, and accept an unquoted attribute value, per CommonMark', () => {
    const result1 = p.parseHTMLTag('<div class"missing-equals">', 0)
    expect(result1).toBeNull()

    const result2 = p.parseHTMLTag('<div class=missing-quotes>', 0)
    expect(result2?.tagName).toBe('div')

    const result3 = p.parseHTMLTag('<div ="missing-name">', 0)
    expect(result3).toBeNull()
  })

  it('should handle tags with complex attribute combinations', () => {
    const result = p.parseHTMLTag(
      '<div class="a" id=\'b\' data-x="y" disabled>',
      0
    )
    expect(result).toEqual({
      tagName: 'div',
      tagLower: 'div',
      attrs: 'class="a" id=\'b\' data-x="y" disabled',
      whitespaceBeforeAttrs: ' ',
      isSelfClosing: false,
      hasSpaceBeforeSlash: false,
      isClosing: false,
      hasNewline: false,
      endPos: 42,
    })
  })

  it('should allow newlines in quoted attribute values and preserve their content', () => {
    const result = p.parseHTMLTag('<div class="line1\nline2">', 0)
    expect(result?.tagName).toBe('div')
    expect(result?.attrs).toContain('line1')
  })

  it('should handle self-closing tags with complex attributes', () => {
    const result = p.parseHTMLTag(
      '<input type="text" name="field" required/>',
      0
    )
    expect(result).toEqual({
      tagName: 'input',
      tagLower: 'input',
      attrs: 'type="text" name="field" required',
      whitespaceBeforeAttrs: ' ',
      isSelfClosing: true,
      hasSpaceBeforeSlash: false,
      isClosing: false,
      hasNewline: false,
      endPos: 42,
    })
  })

  it('should reject tags with mismatched quotes in attributes', () => {
    const result = p.parseHTMLTag('<div class="mismatched\'>', 0)
    expect(result).toBeNull()
  })

  it('should reject tags with nested angle brackets, since CommonMark makes a < after the tag name without whitespace invalid', () => {
    const result = p.parseHTMLTag('<div<inner>>', 0)
    expect(result).toBeNull()
  })

  it('should parse > and < inside quoted attribute values (#263)', () => {
    const result = p.parseHTMLTag('<CustomSmall data="hello > world"/>', 0)
    expect(result).toMatchInlineSnapshot(`
      {
        "attrs": "data="hello > world"",
        "endPos": 35,
        "hasNewline": false,
        "hasSpaceBeforeSlash": false,
        "isClosing": false,
        "isSelfClosing": true,
        "tagLower": "customsmall",
        "tagName": "CustomSmall",
        "whitespaceBeforeAttrs": " ",
      }
    `)

    const result2 = p.parseHTMLTag('<CustomSmall data="hello < world"/>', 0)
    expect(result2).toMatchInlineSnapshot(`
      {
        "attrs": "data="hello < world"",
        "endPos": 35,
        "hasNewline": false,
        "hasSpaceBeforeSlash": false,
        "isClosing": false,
        "isSelfClosing": true,
        "tagLower": "customsmall",
        "tagName": "CustomSmall",
        "whitespaceBeforeAttrs": " ",
      }
    `)

    const result3 = p.parseHTMLTag('<Comp x="1>2" y="3<4"/>', 0)
    expect(result3).toMatchInlineSnapshot(`
      {
        "attrs": "x="1>2" y="3<4"",
        "endPos": 23,
        "hasNewline": false,
        "hasSpaceBeforeSlash": false,
        "isClosing": false,
        "isSelfClosing": true,
        "tagLower": "comp",
        "tagName": "Comp",
        "whitespaceBeforeAttrs": " ",
      }
    `)
  })

  it.each([
    'span',
    'div',
    'Foo',
  ])('leaves a second %s closer as text after a matched pair', tag => {
    expect(p.parser(`x<${tag}></${tag}></${tag}`)).toEqual([
      {
        children: [
          { text: 'x', type: RuleType.text },
          {
            _isClosingTag: false,
            _rawAttrs: '',
            _verbatim: false,
            attrs: {},
            children: [],
            tag,
            text: '',
            type: RuleType.htmlBlock,
          },
          { text: `</${tag}`, type: RuleType.text },
        ],
        type: RuleType.paragraph,
      },
    ])
  })

  it.each([
    '<!--@/>',
    '<!A[@e>',
    '<!doctype html>',
    '<!a b>',
  ])('reads %j as a raw HTML block', markup => {
    expect(p.parser(markup)).toEqual([
      {
        _endsWithGT: false,
        raw: true,
        text: markup,
        type: RuleType.htmlComment,
      },
    ])
  })
})

describe('HTML tags interrupting lists', () => {
  it('should interrupt list with a one-item list followed by a paragraph wrapping the HTML tag when it appears at base indent or less', () => {
    const md = '- foo\n\n\n\n<small>Hi</small>'
    const result = p.parser(md)

    expect(result.length).toBe(2)
    expect(result[0].type).toBe(RuleType.unorderedList)
    expect(result[1].type).toBe(RuleType.paragraph)

    const list = result[0] as MarkdownToJSX.UnorderedListNode
    expect(list.items.length).toBe(1)
    expect(list.items[0][0].type).toBe(RuleType.text)
    expect((list.items[0][0] as MarkdownToJSX.TextNode).text).toBe('foo')
  })

  it('should interrupt indented list when HTML tag appears at column 0, leaving the HTML outside the last item', () => {
    const md =
      '  * You can have lists, like this one\n\n  * Make things **bold** or *italic*\n\n  * Embed snippets of `code`\n\n  * Create [links](/)\n\n  * ...\n\n\n\n<small>Sample content borrowed with thanks from [elm-markdown](http://elm-lang.org/examples/markdown) ❤️</small>'
    const result = p.parser(md)

    expect(result.length).toBeGreaterThan(1)
    expect(result[0].type).toBe(RuleType.unorderedList)

    const list = result[0] as MarkdownToJSX.UnorderedListNode
    const lastItem = list.items.at(-1)
    const lastItemText = JSON.stringify(lastItem)
    expect(lastItemText).not.toContain('small')
    expect(lastItemText).not.toContain('Sample content')
  })

  it('should interrupt list with block-level HTML tag, giving a two-item list, then the HTML block, then another list', () => {
    const md = '- item 1\n- item 2\n<div>test</div>\n- item 3'
    const result = p.parser(md)

    expect(result.length).toBeGreaterThan(1)
    expect(result[0].type).toBe(RuleType.unorderedList)

    const list = result[0] as MarkdownToJSX.UnorderedListNode
    expect(list.items.length).toBe(2)
  })

  it.each([
    [
      'a block that ends at the blank line before a paragraph',
      '- <div>x</div>\n\n  i\n- b',
      [[RuleType.htmlBlock, RuleType.paragraph], [RuleType.paragraph]],
    ],
    [
      'an unclosed block that ends at a blank line',
      '- <div>a\n\n  b',
      [[RuleType.htmlBlock, RuleType.paragraph]],
    ],
    [
      'an opener whose block ends at a blank line',
      '1. <p align="center">\n\n   para\n2. x',
      [[RuleType.htmlBlock, RuleType.paragraph], [RuleType.paragraph]],
    ],
    [
      'a void tag followed by a line remainder',
      '- <img src="a.png"> \n  caption\n- b',
      [[RuleType.htmlBlock, RuleType.text], [RuleType.text]],
    ],
    [
      'a closing tag followed by text',
      '- </pre>\n  x\n- y',
      [[RuleType.htmlSelfClosing, RuleType.text], [RuleType.text]],
    ],
  ])('should shape list items by blank lines around HTML blocks: %s', (_name, source, expected) => {
    const list = p.parser(source)[0] as MarkdownToJSX.UnorderedListNode
    expect(list.items.map(item => item.map(node => node.type))).toEqual(
      expected
    )
  })

  it('should split an empty item from a nested-marker line after one blank line, as CommonMark does for an item that starts with a blank line', () => {
    const list = p.parser('-\n\n  - n')[0] as MarkdownToJSX.UnorderedListNode
    expect(list.items.map(item => item.map(node => node.type))).toEqual([
      [],
      [RuleType.paragraph],
    ])
  })

  it('makes an item loose when a blank line separates its blocks', () => {
    expect(p.parser('-\n  _\n\n  )')).toEqual([
      {
        items: [
          [
            {
              children: [{ text: '_', type: RuleType.text }],
              type: RuleType.paragraph,
            },
            {
              children: [{ text: ')', type: RuleType.text }],
              type: RuleType.paragraph,
            },
          ],
        ],
        type: RuleType.unorderedList,
      },
    ])
  })

  it('reads a marker indented past a blank line after an empty item as a sibling item', () => {
    expect(p.parser('-\n\n  -')).toEqual([
      { items: [[], []], type: RuleType.unorderedList },
    ])
  })

  it('ends a paragraph in a blockquote at a list marker line', () => {
    expect(p.parser('>a\n-')).toEqual([
      {
        children: [
          {
            children: [{ text: 'a', type: RuleType.text }],
            type: RuleType.paragraph,
          },
        ],
        type: RuleType.blockQuote,
      },
      { items: [[]], type: RuleType.unorderedList },
    ])
  })
})

describe('description list parsing', () => {
  it('should parse dt/dd siblings correctly without blank lines between them', () => {
    const md = `<dl data-variant='horizontalTable'>
  <dt>title 1</dt>
  <dd>description 1</dd>
  <dt>title 2</dt>
  <dd>description 2</dd>
  <dt>title 3</dt>
  <dd>description 3</dd>
</dl>`
    const result = p.parser(md)

    expect(result.length).toBe(1)
    expect(result[0].type).toBe(RuleType.htmlBlock)

    const dl = result[0] as MarkdownToJSX.HTMLNode
    expect(dl.tag).toBe('dl')
    expect(dl.attrs?.['data-variant']).toBe('horizontalTable')

    const children = dl.children!
    const htmlChildren = children.filter(
      (c: any) => c.tag === 'dt' || c.tag === 'dd'
    )
    expect(htmlChildren.length).toBe(6)
    expect((htmlChildren[0] as MarkdownToJSX.HTMLNode).tag).toBe('dt')
    expect((htmlChildren[1] as MarkdownToJSX.HTMLNode).tag).toBe('dd')
    expect((htmlChildren[2] as MarkdownToJSX.HTMLNode).tag).toBe('dt')
    expect((htmlChildren[3] as MarkdownToJSX.HTMLNode).tag).toBe('dd')
    expect((htmlChildren[4] as MarkdownToJSX.HTMLNode).tag).toBe('dt')
    expect((htmlChildren[5] as MarkdownToJSX.HTMLNode).tag).toBe('dd')
  })

  it('should parse single dt tag correctly, with the compact parser including the closing tag in the text content', () => {
    const md = '<dt>title 1</dt>'
    const result = p.parser(md)

    expect(result.length).toBe(1)
    expect(result[0].type).toBe(RuleType.htmlBlock)

    const dt = result[0] as MarkdownToJSX.HTMLNode
    expect(dt.tag).toBe('dt')
    expect(dt.text).toContain('title 1')
  })

  it('should parse dt followed by dd on next line correctly', () => {
    const md = `<dt>title 1</dt>
<dd>description 1</dd>`
    const result = p.parser(md)

    expect(result.length).toBe(2)

    const dt = result[0] as MarkdownToJSX.HTMLNode
    expect(dt.tag).toBe('dt')
    expect(dt.text).toContain('title 1')

    const dd = result[1] as MarkdownToJSX.HTMLNode
    expect(dd.tag).toBe('dd')
    expect(dd.text).toContain('description 1')
  })

  it('should handle self-closing tags like <div/> without incrementing nesting depth, parsing as a single div with proper nesting', () => {
    const md = `<div>
  <div/>
  <span>content</span>
</div>`
    const result = p.parser(md)

    expect(result.length).toBe(1)
    expect(result[0].type).toBe(RuleType.htmlBlock)

    const div = result[0] as MarkdownToJSX.HTMLNode
    expect(div.tag).toBe('div')
    expect(astToHTML(storedAST(md))).toBe(
      '<div><div></div><p><span>content</span></p></div>'
    )
  })
})

describe('multi-line HTML attributes', () => {
  it('#781 should correctly parse custom elements with multi-line attributes', () => {
    expect(
      p.parser(`<dl-custom
  data-variant='horizontalTable'
>
  <dt>title 1</dt>
  <dd>description 1</dd>
</dl-custom>`)
    ).toMatchInlineSnapshot(`
      [
        {
          "_isClosingTag": false,
          "_rawAttrs": 
      "
        data-variant='horizontalTable'
      "
      ,
          "_rawOuter": 
      "<dl-custom
        data-variant='horizontalTable'
      >
        <dt>title 1</dt>
        <dd>description 1</dd>
      </dl-custom>"
      ,
          "_reparseSource": undefined,
          "_verbatim": true,
          "attrs": {
            "data-variant": "horizontalTable",
          },
          "children": [
            {
              "_emitOwnClose": true,
              "_isClosingTag": false,
              "_rawAttrs": "",
              "_rawBody": "title 1",
              "_rawOuter": undefined,
              "_reparseSource": undefined,
              "_verbatim": true,
              "attrs": {},
              "children": [
                {
                  "text": "title 1",
                  "type": "text",
                },
              ],
              "tag": "dt",
              "text": "title 1",
              "type": "htmlBlock",
            },
            {
              "_emitOwnClose": true,
              "_isClosingTag": false,
              "_rawAttrs": "",
              "_rawBody": "description 1",
              "_rawOuter": undefined,
              "_reparseSource": undefined,
              "_verbatim": true,
              "attrs": {},
              "children": [
                {
                  "text": "description 1",
                  "type": "text",
                },
              ],
              "tag": "dd",
              "text": "description 1",
              "type": "htmlBlock",
            },
          ],
          "tag": "dl-custom",
          "text": 
      "
        <dt>title 1</dt>
        <dd>description 1</dd>
      "
      ,
          "type": "htmlBlock",
        },
      ]
    `)
  })

  it('should parse multiple attributes spanning multiple lines with double quotes', () => {
    expect(
      p.parser(`<div
  class="test"
  id="main"
  data-value="123"
>content</div>`)
    ).toMatchInlineSnapshot(`
      [
        {
          "_isClosingTag": false,
          "_rawAttrs": 
      "
        class="test"
        id="main"
        data-value="123"
      "
      ,
          "_rawBody": undefined,
          "_rawOuter": 
      "<div
        class="test"
        id="main"
        data-value="123"
      >content</div>"
      ,
          "_reparseSource": undefined,
          "_verbatim": true,
          "attrs": {
            "class": "test",
            "data-value": "123",
            "id": "main",
          },
          "children": [
            {
              "text": "content",
              "type": "text",
            },
          ],
          "tag": "div",
          "text": "content",
          "type": "htmlBlock",
        },
      ]
    `)
  })

  it('should parse multiple attributes spanning multiple lines with single quotes', () => {
    expect(
      p.parser(`<div
  class='test'
  id='main'
  data-value='123'
>content</div>`)
    ).toMatchInlineSnapshot(`
      [
        {
          "_isClosingTag": false,
          "_rawAttrs": 
      "
        class='test'
        id='main'
        data-value='123'
      "
      ,
          "_rawBody": undefined,
          "_rawOuter": 
      "<div
        class='test'
        id='main'
        data-value='123'
      >content</div>"
      ,
          "_reparseSource": undefined,
          "_verbatim": true,
          "attrs": {
            "class": "test",
            "data-value": "123",
            "id": "main",
          },
          "children": [
            {
              "text": "content",
              "type": "text",
            },
          ],
          "tag": "div",
          "text": "content",
          "type": "htmlBlock",
        },
      ]
    `)
  })

  it('should parse JSX components with multi-line attributes', () => {
    expect(
      p.parser(
        `<MyComponent
  className="wrapper"
  onClick={handleClick}
>
  inner content
</MyComponent>`,
        { overrides: { MyComponent: { props: {} } } }
      )
    ).toMatchInlineSnapshot(`
      [
        {
          "_isClosingTag": false,
          "_rawAttrs": 
      "
        className="wrapper""
      ,
          "_rawOuter": 
      "<MyComponent
        className="wrapper">
        inner content
      </MyComponent>"
      ,
          "_reparseSource": 
      "<MyComponent
        className="wrapper"
        onClick={handleClick}>
        inner content
      </MyComponent>"
      ,
          "_verbatim": true,
          "attrs": {
            "className": "wrapper",
            "onClick": "handleClick",
          },
          "children": [
            {
              "text": "inner content",
              "type": "text",
            },
          ],
          "tag": "MyComponent",
          "text": 
      "
        inner content
      "
      ,
          "type": "htmlBlock",
        },
      ]
    `)
  })

  it('should handle attributes with spaces in their values on separate lines', () => {
    expect(
      p.parser(`<span
  class="multiple classes here"
  title="Some title with spaces"
>text</span>`)
    ).toMatchInlineSnapshot(`
      [
        {
          "children": [
            {
              "text": 
      "<span
      class="multiple classes here"
      title="Some title with spaces""
      ,
              "type": "text",
            },
          ],
          "type": "paragraph",
        },
        {
          "alert": undefined,
          "children": [
            {
              "children": [
                {
                  "text": "text",
                  "type": "text",
                },
                {
                  "_isClosingTag": true,
                  "_rawClose": "</span>",
                  "attrs": {},
                  "tag": "span",
                  "type": "htmlSelfClosing",
                },
              ],
              "type": "paragraph",
            },
          ],
          "type": "blockQuote",
        },
      ]
    `)
  })

  it('should handle mixed quote styles on separate lines', () => {
    expect(
      p.parser(`<div
  class="double-quoted"
  id='single-quoted'
  data-mixed="value"
>content</div>`)
    ).toMatchInlineSnapshot(`
      [
        {
          "_isClosingTag": false,
          "_rawAttrs": 
      "
        class="double-quoted"
        id='single-quoted'
        data-mixed="value"
      "
      ,
          "_rawBody": undefined,
          "_rawOuter": 
      "<div
        class="double-quoted"
        id='single-quoted'
        data-mixed="value"
      >content</div>"
      ,
          "_reparseSource": undefined,
          "_verbatim": true,
          "attrs": {
            "class": "double-quoted",
            "data-mixed": "value",
            "id": "single-quoted",
          },
          "children": [
            {
              "text": "content",
              "type": "text",
            },
          ],
          "tag": "div",
          "text": "content",
          "type": "htmlBlock",
        },
      ]
    `)
  })

  it('should handle boolean attributes on separate lines', () => {
    expect(
      p.parser(`<input
  type="checkbox"
  disabled
  checked
/>`)
    ).toMatchInlineSnapshot(`
      [
        {
          "children": [
            {
              "_isClosingTag": false,
              "_rawOpen": 
      "<input
        type="checkbox"
        disabled
        checked
      />"
      ,
              "attrs": {
                "checked": true,
                "disabled": true,
                "type": "checkbox",
              },
              "tag": "input",
              "type": "htmlSelfClosing",
            },
          ],
          "type": "paragraph",
        },
      ]
    `)
  })

  it('should handle deeply indented attributes', () => {
    expect(
      p.parser(`<CustomElement
      data-a="1"
      data-b="2"
      data-c="3"
>inner</CustomElement>`)
    ).toMatchInlineSnapshot(`
      [
        {
          "_isClosingTag": false,
          "_rawAttrs": 
      "
            data-a="1"
            data-b="2"
            data-c="3"
      "
      ,
          "_rawOuter": 
      "<CustomElement
            data-a="1"
            data-b="2"
            data-c="3"
      >inner</CustomElement>"
      ,
          "_reparseSource": undefined,
          "_verbatim": true,
          "attrs": {
            "data-a": "1",
            "data-b": "2",
            "data-c": "3",
          },
          "children": [
            {
              "text": "inner",
              "type": "text",
            },
          ],
          "tag": "CustomElement",
          "text": "inner",
          "type": "htmlBlock",
        },
      ]
    `)
  })

  describe('trailing newline variations', () => {
    const baseInput = `<dl-custom
  data-variant='horizontalTable'
>
  <dt>title 1</dt>
  <dd>description 1</dd>
</dl-custom>`

    it('should handle no trailing whitespace', () => {
      expect(p.parser(baseInput)).toMatchInlineSnapshot(`
        [
          {
            "_isClosingTag": false,
            "_rawAttrs": 
        "
          data-variant='horizontalTable'
        "
        ,
            "_rawOuter": 
        "<dl-custom
          data-variant='horizontalTable'
        >
          <dt>title 1</dt>
          <dd>description 1</dd>
        </dl-custom>"
        ,
            "_reparseSource": undefined,
            "_verbatim": true,
            "attrs": {
              "data-variant": "horizontalTable",
            },
            "children": [
              {
                "_emitOwnClose": true,
                "_isClosingTag": false,
                "_rawAttrs": "",
                "_rawBody": "title 1",
                "_rawOuter": undefined,
                "_reparseSource": undefined,
                "_verbatim": true,
                "attrs": {},
                "children": [
                  {
                    "text": "title 1",
                    "type": "text",
                  },
                ],
                "tag": "dt",
                "text": "title 1",
                "type": "htmlBlock",
              },
              {
                "_emitOwnClose": true,
                "_isClosingTag": false,
                "_rawAttrs": "",
                "_rawBody": "description 1",
                "_rawOuter": undefined,
                "_reparseSource": undefined,
                "_verbatim": true,
                "attrs": {},
                "children": [
                  {
                    "text": "description 1",
                    "type": "text",
                  },
                ],
                "tag": "dd",
                "text": "description 1",
                "type": "htmlBlock",
              },
            ],
            "tag": "dl-custom",
            "text": 
        "
          <dt>title 1</dt>
          <dd>description 1</dd>
        "
        ,
            "type": "htmlBlock",
          },
        ]
      `)
    })

    it('should handle single trailing newline', () => {
      expect(p.parser(`${baseInput}\n`)).toMatchInlineSnapshot(`
        [
          {
            "_isClosingTag": false,
            "_rawAttrs": 
        "
          data-variant='horizontalTable'
        "
        ,
            "_rawOuter": 
        "<dl-custom
          data-variant='horizontalTable'
        >
          <dt>title 1</dt>
          <dd>description 1</dd>
        </dl-custom>
        "
        ,
            "_reparseSource": undefined,
            "_verbatim": true,
            "attrs": {
              "data-variant": "horizontalTable",
            },
            "children": [
              {
                "_emitOwnClose": true,
                "_isClosingTag": false,
                "_rawAttrs": "",
                "_rawBody": "title 1",
                "_rawOuter": undefined,
                "_reparseSource": undefined,
                "_verbatim": true,
                "attrs": {},
                "children": [
                  {
                    "text": "title 1",
                    "type": "text",
                  },
                ],
                "tag": "dt",
                "text": "title 1",
                "type": "htmlBlock",
              },
              {
                "_emitOwnClose": true,
                "_isClosingTag": false,
                "_rawAttrs": "",
                "_rawBody": "description 1",
                "_rawOuter": undefined,
                "_reparseSource": undefined,
                "_verbatim": true,
                "attrs": {},
                "children": [
                  {
                    "text": "description 1",
                    "type": "text",
                  },
                ],
                "tag": "dd",
                "text": "description 1",
                "type": "htmlBlock",
              },
            ],
            "tag": "dl-custom",
            "text": 
        "
          <dt>title 1</dt>
          <dd>description 1</dd>
        "
        ,
            "type": "htmlBlock",
          },
        ]
      `)
    })

    it('should handle double trailing newline', () => {
      expect(p.parser(`${baseInput}\n\n`)).toMatchInlineSnapshot(`
        [
          {
            "_isClosingTag": false,
            "_rawAttrs": 
        "
          data-variant='horizontalTable'
        "
        ,
            "_rawOuter": 
        "<dl-custom
          data-variant='horizontalTable'
        >
          <dt>title 1</dt>
          <dd>description 1</dd>
        </dl-custom>
        "
        ,
            "_reparseSource": undefined,
            "_verbatim": true,
            "attrs": {
              "data-variant": "horizontalTable",
            },
            "children": [
              {
                "_emitOwnClose": true,
                "_isClosingTag": false,
                "_rawAttrs": "",
                "_rawBody": "title 1",
                "_rawOuter": undefined,
                "_reparseSource": undefined,
                "_verbatim": true,
                "attrs": {},
                "children": [
                  {
                    "text": "title 1",
                    "type": "text",
                  },
                ],
                "tag": "dt",
                "text": "title 1",
                "type": "htmlBlock",
              },
              {
                "_emitOwnClose": true,
                "_isClosingTag": false,
                "_rawAttrs": "",
                "_rawBody": "description 1",
                "_rawOuter": undefined,
                "_reparseSource": undefined,
                "_verbatim": true,
                "attrs": {},
                "children": [
                  {
                    "text": "description 1",
                    "type": "text",
                  },
                ],
                "tag": "dd",
                "text": "description 1",
                "type": "htmlBlock",
              },
            ],
            "tag": "dl-custom",
            "text": 
        "
          <dt>title 1</dt>
          <dd>description 1</dd>
        "
        ,
            "type": "htmlBlock",
          },
        ]
      `)
    })

    it('should handle leading newline', () => {
      expect(p.parser(`\n${baseInput}`)).toMatchInlineSnapshot(`
        [
          {
            "_isClosingTag": false,
            "_rawAttrs": 
        "
          data-variant='horizontalTable'
        "
        ,
            "_rawOuter": 
        "<dl-custom
          data-variant='horizontalTable'
        >
          <dt>title 1</dt>
          <dd>description 1</dd>
        </dl-custom>"
        ,
            "_reparseSource": undefined,
            "_verbatim": true,
            "attrs": {
              "data-variant": "horizontalTable",
            },
            "children": [
              {
                "_emitOwnClose": true,
                "_isClosingTag": false,
                "_rawAttrs": "",
                "_rawBody": "title 1",
                "_rawOuter": undefined,
                "_reparseSource": undefined,
                "_verbatim": true,
                "attrs": {},
                "children": [
                  {
                    "text": "title 1",
                    "type": "text",
                  },
                ],
                "tag": "dt",
                "text": "title 1",
                "type": "htmlBlock",
              },
              {
                "_emitOwnClose": true,
                "_isClosingTag": false,
                "_rawAttrs": "",
                "_rawBody": "description 1",
                "_rawOuter": undefined,
                "_reparseSource": undefined,
                "_verbatim": true,
                "attrs": {},
                "children": [
                  {
                    "text": "description 1",
                    "type": "text",
                  },
                ],
                "tag": "dd",
                "text": "description 1",
                "type": "htmlBlock",
              },
            ],
            "tag": "dl-custom",
            "text": 
        "
          <dt>title 1</dt>
          <dd>description 1</dd>
        "
        ,
            "type": "htmlBlock",
          },
        ]
      `)
    })

    it('should handle leading and trailing newlines', () => {
      expect(p.parser(`\n${baseInput}\n`)).toMatchInlineSnapshot(`
        [
          {
            "_isClosingTag": false,
            "_rawAttrs": 
        "
          data-variant='horizontalTable'
        "
        ,
            "_rawOuter": 
        "<dl-custom
          data-variant='horizontalTable'
        >
          <dt>title 1</dt>
          <dd>description 1</dd>
        </dl-custom>
        "
        ,
            "_reparseSource": undefined,
            "_verbatim": true,
            "attrs": {
              "data-variant": "horizontalTable",
            },
            "children": [
              {
                "_emitOwnClose": true,
                "_isClosingTag": false,
                "_rawAttrs": "",
                "_rawBody": "title 1",
                "_rawOuter": undefined,
                "_reparseSource": undefined,
                "_verbatim": true,
                "attrs": {},
                "children": [
                  {
                    "text": "title 1",
                    "type": "text",
                  },
                ],
                "tag": "dt",
                "text": "title 1",
                "type": "htmlBlock",
              },
              {
                "_emitOwnClose": true,
                "_isClosingTag": false,
                "_rawAttrs": "",
                "_rawBody": "description 1",
                "_rawOuter": undefined,
                "_reparseSource": undefined,
                "_verbatim": true,
                "attrs": {},
                "children": [
                  {
                    "text": "description 1",
                    "type": "text",
                  },
                ],
                "tag": "dd",
                "text": "description 1",
                "type": "htmlBlock",
              },
            ],
            "tag": "dl-custom",
            "text": 
        "
          <dt>title 1</dt>
          <dd>description 1</dd>
        "
        ,
            "type": "htmlBlock",
          },
        ]
      `)
    })

    it('should handle CRLF line endings', () => {
      expect(p.parser(baseInput.replace(/\n/g, '\r\n'))).toMatchInlineSnapshot(`
        [
          {
            "_isClosingTag": false,
            "_rawAttrs": 
        "
          data-variant='horizontalTable'
        "
        ,
            "_rawOuter": 
        "<dl-custom
          data-variant='horizontalTable'
        >
          <dt>title 1</dt>
          <dd>description 1</dd>
        </dl-custom>"
        ,
            "_reparseSource": undefined,
            "_verbatim": true,
            "attrs": {
              "data-variant": "horizontalTable",
            },
            "children": [
              {
                "_emitOwnClose": true,
                "_isClosingTag": false,
                "_rawAttrs": "",
                "_rawBody": "title 1",
                "_rawOuter": undefined,
                "_reparseSource": undefined,
                "_verbatim": true,
                "attrs": {},
                "children": [
                  {
                    "text": "title 1",
                    "type": "text",
                  },
                ],
                "tag": "dt",
                "text": "title 1",
                "type": "htmlBlock",
              },
              {
                "_emitOwnClose": true,
                "_isClosingTag": false,
                "_rawAttrs": "",
                "_rawBody": "description 1",
                "_rawOuter": undefined,
                "_reparseSource": undefined,
                "_verbatim": true,
                "attrs": {},
                "children": [
                  {
                    "text": "description 1",
                    "type": "text",
                  },
                ],
                "tag": "dd",
                "text": "description 1",
                "type": "htmlBlock",
              },
            ],
            "tag": "dl-custom",
            "text": 
        "
          <dt>title 1</dt>
          <dd>description 1</dd>
        "
        ,
            "type": "htmlBlock",
          },
        ]
      `)
    })
  })

  describe('JSX component scenarios', () => {
    it('should handle PascalCase components with multi-line attributes', () => {
      expect(
        p.parser(`<MyCustomComponent
  propA="value1"
  propB="value2"
>
  content
</MyCustomComponent>`)
      ).toMatchInlineSnapshot(`
        [
          {
            "_isClosingTag": false,
            "_rawAttrs": 
        "
          propA="value1"
          propB="value2"
        "
        ,
            "_rawOuter": 
        "<MyCustomComponent
          propA="value1"
          propB="value2"
        >
          content
        </MyCustomComponent>"
        ,
            "_reparseSource": undefined,
            "_verbatim": true,
            "attrs": {
              "propA": "value1",
              "propB": "value2",
            },
            "children": [
              {
                "text": "content",
                "type": "text",
              },
            ],
            "tag": "MyCustomComponent",
            "text": 
        "
          content
        "
        ,
            "type": "htmlBlock",
          },
        ]
      `)
    })

    it('should handle JSX curly brace attributes on separate lines', () => {
      expect(
        p.parser(
          `<DataTable
  data={myData}
  columns={columns}
  onRowClick={handleClick}
>
  Loading...
</DataTable>`,
          { overrides: { DataTable: { props: {} } } }
        )
      ).toMatchInlineSnapshot(`
        [
          {
            "_isClosingTag": false,
            "_rawAttrs": 
        "
          data={myData}
          columns={columns}"
        ,
            "_rawOuter": 
        "<DataTable
          data={myData}
          columns={columns}>
          Loading...
        </DataTable>"
        ,
            "_reparseSource": 
        "<DataTable
          data={myData}
          columns={columns}
          onRowClick={handleClick}>
          Loading...
        </DataTable>"
        ,
            "_verbatim": true,
            "attrs": {
              "columns": "columns",
              "data": "myData",
              "onRowClick": "handleClick",
            },
            "children": [
              {
                "text": "Loading...",
                "type": "text",
              },
            ],
            "tag": "DataTable",
            "text": 
        "
          Loading...
        "
        ,
            "type": "htmlBlock",
          },
        ]
      `)
    })

    it('should handle mixed HTML and JSX attributes on separate lines', () => {
      expect(
        p.parser(
          `<Widget
  className="container"
  data-id="123"
  onClick={handleClick}
  disabled
>
  content
</Widget>`,
          { overrides: { Widget: { props: {} } } }
        )
      ).toMatchInlineSnapshot(`
        [
          {
            "_isClosingTag": false,
            "_rawAttrs": 
        "
          className="container"
          data-id="123" disabled"
        ,
            "_rawOuter": 
        "<Widget
          className="container"
          data-id="123" disabled>
          content
        </Widget>"
        ,
            "_reparseSource": 
        "<Widget
          className="container"
          data-id="123"
          onClick={handleClick}
          disabled>
          content
        </Widget>"
        ,
            "_verbatim": true,
            "attrs": {
              "className": "container",
              "data-id": "123",
              "disabled": true,
              "onClick": "handleClick",
            },
            "children": [
              {
                "text": "content",
                "type": "text",
              },
            ],
            "tag": "Widget",
            "text": 
        "
          content
        "
        ,
            "type": "htmlBlock",
          },
        ]
      `)
    })

    it('should handle deeply nested components with multi-line attributes', () => {
      expect(
        p.parser(`<Outer
  level="1"
>
  <Middle
    level="2"
  >
    <Inner
      level="3"
    >
      content
    </Inner>
  </Middle>
</Outer>`)
      ).toMatchInlineSnapshot(`
        [
          {
            "_isClosingTag": false,
            "_rawAttrs": 
        "
          level="1"
        "
        ,
            "_rawOuter": 
        "<Outer
          level="1"
        >
          <Middle
            level="2"
          >
            <Inner
              level="3"
            >
              content
            </Inner>
          </Middle>
        </Outer>"
        ,
            "_reparseSource": undefined,
            "_verbatim": true,
            "attrs": {
              "level": "1",
            },
            "children": [
              {
                "_isClosingTag": false,
                "_rawAttrs": 
        "
            level="2"
          "
        ,
                "_rawOuter": 
        "<Middle
            level="2"
          >
            <Inner
              level="3"
            >
              content
            </Inner>
          </Middle>"
        ,
                "_reparseSource": undefined,
                "_verbatim": true,
                "attrs": {
                  "level": "2",
                },
                "children": [
                  {
                    "_isClosingTag": false,
                    "_rawAttrs": 
        "
              level="3"
            "
        ,
                    "_rawOuter": 
        "<Inner
              level="3"
            >
              content
            </Inner>"
        ,
                    "_reparseSource": undefined,
                    "_verbatim": true,
                    "attrs": {
                      "level": "3",
                    },
                    "children": [
                      {
                        "text": "content",
                        "type": "text",
                      },
                    ],
                    "tag": "Inner",
                    "text": 
        "
              content
            "
        ,
                    "type": "htmlBlock",
                  },
                ],
                "tag": "Middle",
                "text": 
        "
            <Inner
              level="3"
            >
              content
            </Inner>
          "
        ,
                "type": "htmlBlock",
              },
            ],
            "tag": "Outer",
            "text": 
        "
          <Middle
            level="2"
          >
            <Inner
              level="3"
            >
              content
            </Inner>
          </Middle>
        "
        ,
            "type": "htmlBlock",
          },
        ]
      `)
    })

    it('should handle self-closing JSX with multi-line attributes', () => {
      expect(
        p.parser(
          `<Icon
  name="star"
  size={24}
  color="gold"
  filled
/>`,
          { overrides: { Icon: { props: {} } } }
        )
      ).toMatchInlineSnapshot(`
        [
          {
            "_isClosingTag": false,
            "_rawAttrs": 
        "
          name="star"
          size={24}
          color="gold"
          filled
        "
        ,
            "_rawBody": "",
            "_reparseSource": undefined,
            "_verbatim": true,
            "attrs": {
              "color": "gold",
              "filled": true,
              "name": "star",
              "size": "24",
            },
            "children": [],
            "tag": "Icon",
            "text": "",
            "type": "htmlBlock",
          },
        ]
      `)
    })
  })

  describe('whitespace variations in attributes', () => {
    it('should handle tabs as whitespace between attributes', () => {
      expect(
        p.parser(`<div
\tclass="test"
\tid="main"
>content</div>`)
      ).toMatchInlineSnapshot(`
        [
          {
            "_isClosingTag": false,
            "_rawAttrs": 
        "
        	class="test"
        	id="main"
        "
        ,
            "_rawBody": undefined,
            "_rawOuter": 
        "<div
        	class="test"
        	id="main"
        >content</div>"
        ,
            "_reparseSource": undefined,
            "_verbatim": true,
            "attrs": {
              "class": "test",
              "id": "main",
            },
            "children": [
              {
                "text": "content",
                "type": "text",
              },
            ],
            "tag": "div",
            "text": "content",
            "type": "htmlBlock",
          },
        ]
      `)
    })

    it('should handle mixed tabs and spaces', () => {
      expect(
        p.parser(`<div
  \tclass="test"
\t  id="main"
>content</div>`)
      ).toMatchInlineSnapshot(`
        [
          {
            "_isClosingTag": false,
            "_rawAttrs": 
        "
          	class="test"
        	  id="main"
        "
        ,
            "_rawBody": undefined,
            "_rawOuter": 
        "<div
          	class="test"
        	  id="main"
        >content</div>"
        ,
            "_reparseSource": undefined,
            "_verbatim": true,
            "attrs": {
              "class": "test",
              "id": "main",
            },
            "children": [
              {
                "text": "content",
                "type": "text",
              },
            ],
            "tag": "div",
            "text": "content",
            "type": "htmlBlock",
          },
        ]
      `)
    })

    it('should handle attribute on same line as tag name', () => {
      expect(
        p.parser(`<dl-custom data-variant='horizontalTable'>
  <dt>title</dt>
</dl-custom>`)
      ).toMatchInlineSnapshot(`
        [
          {
            "_isClosingTag": false,
            "_rawAttrs": " data-variant='horizontalTable'",
            "_rawBody": 
        "  <dt>title</dt>
        </dl-custom>"
        ,
            "_rawOuter": undefined,
            "_reparseSource": undefined,
            "_verbatim": true,
            "attrs": {
              "data-variant": "horizontalTable",
            },
            "children": [
              {
                "_emitOwnClose": true,
                "_isClosingTag": false,
                "_rawAttrs": "",
                "_rawBody": "title",
                "_rawOuter": undefined,
                "_reparseSource": undefined,
                "_verbatim": true,
                "attrs": {},
                "children": [
                  {
                    "text": "title",
                    "type": "text",
                  },
                ],
                "tag": "dt",
                "text": "title",
                "type": "htmlBlock",
              },
            ],
            "tag": "dl-custom",
            "text": 
        "  <dt>title</dt>
        "
        ,
            "type": "htmlBlock",
          },
        ]
      `)
    })

    it('should handle empty content with multi-line opening tag', () => {
      expect(
        p.parser(`<dl-custom
  data-variant='horizontalTable'
>
</dl-custom>`)
      ).toMatchInlineSnapshot(`
        [
          {
            "_isClosingTag": false,
            "_rawAttrs": 
        "
          data-variant='horizontalTable'
        "
        ,
            "_rawOuter": 
        "<dl-custom
          data-variant='horizontalTable'
        >
        </dl-custom>"
        ,
            "_reparseSource": undefined,
            "_verbatim": true,
            "attrs": {
              "data-variant": "horizontalTable",
            },
            "children": [],
            "tag": "dl-custom",
            "text": 
        "
        "
        ,
            "type": "htmlBlock",
          },
        ]
      `)
    })
  })
})

describe('tables in lists', () => {
  it('should parse tables within list items (regression test for issue #1): one list whose first item holds a "Browser Stats" paragraph and then a table of two header cells and three body rows', () => {
    const md = `- **Browser Stats**:

  | Computer | Memory Usage |
  | -------- | ------------ |
  | FireFox  | 86%          |
  | Chrome   | 80%          |
  | Safari   | 79%          |
`
    const result = p.parser(md)

    expect(result.length).toBe(1)
    expect(result[0].type).toBe(RuleType.unorderedList)

    const list = result[0] as MarkdownToJSX.UnorderedListNode
    expect(list.items.length).toBe(1)

    const item = list.items[0]
    expect(item.length).toBe(2)

    expect(item[0].type).toBe(RuleType.paragraph)
    const paragraph = item[0] as MarkdownToJSX.ParagraphNode
    expect(paragraph.children.length).toBeGreaterThan(0)

    expect(item[1].type).toBe(RuleType.table)
    const table = item[1] as MarkdownToJSX.TableNode
    expect(table.header.length).toBe(2)
    expect(table.cells.length).toBe(3)
  })

  it('should parse standalone table', () => {
    const md = `| Computer | Memory Usage |
| -------- | ------------ |
| FireFox  | 86%          |
`
    const result = p.parser(md)

    expect(result.length).toBe(1)
    expect(result[0].type).toBe(RuleType.table)
    const table = result[0] as MarkdownToJSX.TableNode
    expect(table.header.length).toBe(2)
    expect(table.cells.length).toBe(1)
  })

  it('should parse multiple tables in separate list items, with both items holding a table', () => {
    const md = `- Item 1:

  | A | B |
  | - | - |
  | 1 | 2 |

- Item 2:

  | C | D |
  | - | - |
  | 3 | 4 |
`
    const result = p.parser(md)

    expect(result.length).toBe(1)
    expect(result[0].type).toBe(RuleType.unorderedList)

    const list = result[0] as MarkdownToJSX.UnorderedListNode
    expect(list.items.length).toBe(2)

    for (const item of list.items) {
      const tables = item.filter(node => node.type === RuleType.table)
      expect(tables.length).toBe(1)
    }
  })

  it('reads a delimiter row with fewer cells than the header row as paragraph text', () => {
    expect(p.parser('`a| b |\n|---|')).toEqual([
      {
        children: [{ text: '`a| b |\n|---|', type: RuleType.text }],
        type: RuleType.paragraph,
      },
    ])
  })

  it('reads a lone dash under a line with a pipe as a setext heading', () => {
    expect(p.parser('`|]\n-')).toEqual([
      {
        children: [{ text: '`|]', type: RuleType.text }],
        id: '',
        level: 2,
        type: RuleType.heading,
      },
    ])
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
    ['> # h\nlazy', '<blockquote><h1 id="h">h</h1></blockquote><p>lazy</p>'],
    ['- # h\nlazy', '<ul><li><h1 id="h">h</h1></li></ul><p>lazy</p>'],
    ['> ---\nlazy', '<blockquote><hr /></blockquote><p>lazy</p>'],
    [
      '> ```\n> a\nlazy',
      '<blockquote><pre><code>a</code></pre></blockquote><p>lazy</p>',
    ],
    [
      '- | a | b |\n  | - | - |\nlazy',
      '<ul><li><table><thead><tr><th>a</th><th>b</th></tr></thead></table></li></ul><p>lazy</p>',
    ],
    ['> <pre>\nlazy', '<blockquote><pre></blockquote><p>lazy</p>'],
    ['- <div>\nlazy', '<ul><li><div></li></ul><p>lazy</p>'],
    ['- </pre>\nm', '<ul><li></pre></li></ul><p>m</p>'],
    ['> - a\nlazy', '<blockquote><ul><li>a\nlazy</li></ul></blockquote>'],
    [
      '> > a\nlazy',
      '<blockquote><blockquote><p>a\nlazy</p></blockquote></blockquote>',
    ],
    ['- p\n\n  q\nlazy', '<ul><li><p>p</p><p>q\nlazy</p></li></ul>'],
    [
      '- ```\n  a\n  ```\nlazy',
      '<ul><li><pre><code>a</code></pre></li></ul><p>lazy</p>',
    ],
    ['- p\nlazy1\n  q\nlazy2', '<ul><li>p\nlazy1\nq\nlazy2</li></ul>'],
    ['- a\n- b\nlazy', '<ul><li>a</li><li>b\nlazy</li></ul>'],
    ['> a\n>\n> b\nlazy', '<blockquote><p>a</p><p>b\nlazy</p></blockquote>'],
    [
      '- 10. a\n\n      b\nlazy',
      '<ul><li><ol start="10"><li><p>a</p><p>b\nlazy</p></li></ol></li></ul>',
    ],
    [
      '- - - a\n\n      b\nlazy',
      '<ul><li><ul><li><ul><li><p>a</p><p>b\nlazy</p></li></ul></li></ul></li></ul>',
    ],
    [
      '> 1.  one\n>\n>     two\nthree',
      '<blockquote><ol><li><p>one</p><p>two\nthree</p></li></ol></blockquote>',
    ],
    [
      '- 10. a\n\n          code\nlazy',
      '<ul><li><ol start="10"><li><p>a</p><pre><code>code</code></pre></li></ol></li></ul><p>lazy</p>',
    ],
    [
      '> [x]: /u\n[y]: /v\n\n[y]',
      '<blockquote></blockquote><p><a href="/v">y</a></p>',
    ],
    [
      '> [x]: /u\n[x]: /v\n\n[x]',
      '<blockquote></blockquote><p><a href="/u">x</a></p>',
    ],
    [
      '> [x]: /u\n"t"\n\n[x]',
      '<blockquote></blockquote><p><a href="/u" title="t">x</a></p>',
    ],
    [
      '- [x]: /u\n[y]: /v\n\n[y]',
      '<ul><li></li></ul><p><a href="/v">y</a></p>',
    ],
    [
      '> [x]: /u\n[^1]: n\n\n[^1]',
      '<blockquote><p>[^1]: n</p></blockquote><p>[^1]</p>',
    ],
    [
      '> a\n> ---\nlazy',
      '<blockquote><h2 id="a">a</h2></blockquote><p>lazy</p>',
    ],
    [
      '> a\nlazy1\n> b\nlazy2',
      '<blockquote><p>a\nlazy1\nb\nlazy2</p></blockquote>',
    ],
    [
      '> > a\nlazy\n> > ===\nlazy3',
      '<blockquote><blockquote><h1 id="alazy">a\nlazy</h1></blockquote></blockquote><p>lazy3</p>',
    ],
    [
      '- > a\nlazy\n  > ===\nlazy3',
      '<ul><li><blockquote><h1 id="alazy">a\nlazy</h1></blockquote></li></ul><p>lazy3</p>',
    ],
    [
      '> - a\n>     ```\n> - b\nlazy',
      '<blockquote><ul><li>a<pre><code></code></pre></li><li>b\nlazy</li></ul></blockquote>',
    ],
    [
      '> ```\n> > ```\n> b\nlazy',
      '<blockquote><pre><code>&gt; ```\nb</code></pre></blockquote><p>lazy</p>',
    ],
    [
      '> > 1.  one\n> >\n> >     two\nthree',
      '<blockquote><blockquote><ol><li><p>one</p><p>two\nthree</p></li></ol></blockquote></blockquote>',
    ],
    [
      '- 1.\n\n      a\nlazy',
      '<ul><li><ol><li></li></ol><pre><code>a</code></pre></li></ul><p>lazy</p>',
    ],
    [
      '- - [x]: /u\n[y]: /v\n\n[y]',
      '<ul><li><ul><li></li></ul></li></ul><p><a href="/v">y</a></p>',
    ],
    [
      '> > [x]: /u\n[y]: /v\n\n[y]',
      '<blockquote><blockquote></blockquote></blockquote><p><a href="/v">y</a></p>',
    ],
    ['1. \n    a\nb', '<ol><li>a\nb</li></ol>'],
    ['- a\n\n  ***', '<ul><li><p>a</p><hr /></li></ul>'],
    ['> b\n\tc d', '<blockquote><p>b\nc d</p></blockquote>'],
  ])('renders the lazy continuation rule for %j as %j', (input, html) => {
    expect(astToHTML(p.parser(input))).toBe(html)
  })

  it('keeps the lazy line in the paragraph that follows indented code in a blockquote', () => {
    const [quote] = p.parser(
      '>     code\n> para\nlazy'
    ) as MarkdownToJSX.BlockQuoteNode[]

    expect(quote.children.map(node => node.type)).toEqual([
      RuleType.codeBlock,
      RuleType.paragraph,
    ])
    expect((quote.children[1] as MarkdownToJSX.ParagraphNode).children).toEqual(
      [{ type: RuleType.text, text: 'para\nlazy' }]
    )
  })

  it.each([
    ['> a\nb\n> ---', '<blockquote><h2 id="ab">a\nb</h2></blockquote>'],
    [
      '> a\nb\n>\n> c\n> ===',
      '<blockquote><p>a\nb</p><h1 id="c">c</h1></blockquote>',
    ],
    ['> a\nb\n===', '<blockquote><p>a\nb\n===</p></blockquote>'],
    ['> a\n===', '<blockquote><p>a\n===</p></blockquote>'],
    [
      '> a\n> b\nc\n> ---',
      '<blockquote><h2 id="abc">a\nb\nc</h2></blockquote>',
    ],
  ])('ends a setext heading in a blockquote at an underline on a quoted line only: %j renders %j', (input, html) => {
    expect(astToHTML(p.parser(input))).toBe(html)
  })

  it.each([
    [
      '> f\nbar\n> # x',
      '<blockquote><p>f\nbar</p><h1 id="x">x</h1></blockquote>',
    ],
    [
      '> f\nbar\n> > x',
      '<blockquote><p>f\nbar</p><blockquote><p>x</p></blockquote></blockquote>',
    ],
    [
      '> f\nbar\n> - x',
      '<blockquote><p>f\nbar</p><ul><li>x</li></ul></blockquote>',
    ],
    [
      '> a\nb\n> ```\n> code\n> ```',
      '<blockquote><p>a\nb</p><pre><code>code</code></pre></blockquote>',
    ],
    ['> a\nb\n> <div>\n> x', '<blockquote><p>a\nb</p><div>x\n</blockquote>'],
    [
      '> a\nb\nc\n> # x',
      '<blockquote><p>a\nb\nc</p><h1 id="x">x</h1></blockquote>',
    ],
  ])('ends a paragraph in a blockquote at a block start on the quoted line after a lazy line: %j renders %j', (input, html) => {
    expect(astToHTML(p.parser(input))).toBe(html)
  })
})

describe('whitespace-only lines in a list item', () => {
  it.each([
    ['- a\n \n- b', '<ul><li><p>a</p></li><li><p>b</p></li></ul>'],
    ['- a\n          \n- b', '<ul><li><p>a</p></li><li><p>b</p></li></ul>'],
    ['- a\n\t\t\t\n- b', '<ul><li><p>a</p></li><li><p>b</p></li></ul>'],
    [
      '- a\n  - b\n              \n- c',
      '<ul><li><p>a</p><ul><li>b</li></ul></li><li><p>c</p></li></ul>',
    ],
    ['- a\n          x \n- b', '<ul><li>a\nx</li><li>b</li></ul>'],
  ])('reads a line of only spaces and tabs as a blank line: %j renders %j', (input, html) => {
    expect(astToHTML(p.parser(input))).toBe(html)
  })
})

describe('paragraph after nested list', () => {
  it('should parse paragraph at column 0 after blank line as separate block, leaving the nested list item with only its text (issue #776)', () => {
    const md = `- Unordered list
  - Unordered nested list

This is paragraph after the unordered nested list.`
    const result = p.parser(md)

    expect(result.length).toBe(2)
    expect(result[0].type).toBe(RuleType.unorderedList)
    expect(result[1].type).toBe(RuleType.paragraph)

    const list = result[0] as MarkdownToJSX.UnorderedListNode
    expect(list.items.length).toBe(1)

    const firstItem = list.items[0]
    expect(firstItem.length).toBe(2)

    const nestedList = firstItem[1] as MarkdownToJSX.UnorderedListNode
    expect(nestedList.items.length).toBe(1)
    const nestedItem = nestedList.items[0]
    expect(nestedItem.length).toBe(1)
    expect(nestedItem[0].type).toBe(RuleType.text)
    expect((nestedItem[0] as MarkdownToJSX.TextNode).text).toBe(
      'Unordered nested list'
    )

    const paragraph = result[1] as MarkdownToJSX.ParagraphNode
    expect(paragraph.children[0].type).toBe(RuleType.text)
    expect((paragraph.children[0] as MarkdownToJSX.TextNode).text).toBe(
      'This is paragraph after the unordered nested list.'
    )
  })

  it('should not assign content to void elements in block-level HTML (issue #823)', () => {
    const result = p.parser('\n<br>')
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "_isClosingTag": false,
          "_rawAttrs": "",
          "_reparseSource": undefined,
          "_verbatim": false,
          "attrs": {},
          "children": [],
          "tag": "br",
          "text": "",
          "type": "htmlBlock",
        },
      ]
    `)
  })

  it('should separate trailing content from void elements (issue #823)', () => {
    const result = p.parser('\n<br>\nsome text')
    expect(result.length).toBe(2)
    expect(result[0].type).toBe(RuleType.htmlBlock)
    expect((result[0] as MarkdownToJSX.HTMLNode).tag).toBe('br')
    expect((result[0] as MarkdownToJSX.HTMLNode)._rawBody).toBeUndefined()
    expect(result[1].type).toBe(RuleType.paragraph)
  })

  it('should keep the paragraph after a blank line out of the ordered nested list item, which holds only its text', () => {
    const md = `1. Ordered list
   1. Ordered nested list

This is paragraph after.`
    const result = p.parser(md)

    expect(result.length).toBe(2)
    expect(result[0].type).toBe(RuleType.orderedList)
    expect(result[1].type).toBe(RuleType.paragraph)

    const list = result[0] as MarkdownToJSX.OrderedListNode
    const nestedList = list.items[0][1] as MarkdownToJSX.OrderedListNode
    const nestedItem = nestedList.items[0]
    expect(nestedItem.length).toBe(1)
    expect(nestedItem[0].type).toBe(RuleType.text)
  })
})

it('should preserve newline between list item text and continuation at same indentation (#793)', () => {
  expect(
    p.parser(`- Unordered list.
  - Nested list.
  Prefixed spaces equal to the nested list.`)
  ).toMatchInlineSnapshot(`
    [
      {
        "items": [
          [
            {
              "text": "Unordered list.",
              "type": "text",
            },
            {
              "items": [
                [
                  {
                    "text": 
    "Nested list.
    Prefixed spaces equal to the nested list."
    ,
                    "type": "text",
                  },
                ],
              ],
              "type": "unorderedList",
            },
          ],
        ],
        "type": "unorderedList",
      },
    ]
  `)
})

it('should preserve newlines between multiple continuation lines (#793)', () => {
  expect(
    p.parser(`- Unordered list.
  - Nested list.
  Prefixed spaces equal to the nested list.
  And again.`)
  ).toMatchInlineSnapshot(`
    [
      {
        "items": [
          [
            {
              "text": "Unordered list.",
              "type": "text",
            },
            {
              "items": [
                [
                  {
                    "text": 
    "Nested list.
    Prefixed spaces equal to the nested list.
    And again."
    ,
                    "type": "text",
                  },
                ],
              ],
              "type": "unorderedList",
            },
          ],
        ],
        "type": "unorderedList",
      },
    ]
  `)
})

it('should preserve newline with lazy continuation then proper continuation (#793)', () => {
  expect(
    p.parser(`- Unordered list.
  - Nested list.
Prefixed spaces not equal to the nested list.
  But this line's are.`)
  ).toMatchInlineSnapshot(`
    [
      {
        "items": [
          [
            {
              "text": "Unordered list.",
              "type": "text",
            },
            {
              "items": [
                [
                  {
                    "text": 
    "Nested list.
    Prefixed spaces not equal to the nested list.
    But this line's are."
    ,
                    "type": "text",
                  },
                ],
              ],
              "type": "unorderedList",
            },
          ],
        ],
        "type": "unorderedList",
      },
    ]
  `)
})

describe('reference definitions', () => {
  it('should not treat __proto__ or constructor as defined refs (#900)', () => {
    expect(p.parser('[__proto__]')).toEqual([
      {
        type: RuleType.paragraph,
        children: [
          { type: RuleType.text, text: '[' },
          {
            type: RuleType.textFormatted,
            tag: 'strong',
            children: [{ type: RuleType.text, text: 'proto' }],
          },
          { type: RuleType.text, text: ']' },
        ],
      },
    ])
    expect(p.parser('[constructor]')).toEqual([
      {
        type: RuleType.paragraph,
        children: [{ type: RuleType.text, text: '[constructor]' }],
      },
    ])
  })

  it('should store and resolve __proto__ and constructor ref definitions (#900)', () => {
    const protoAst = p.parser('[__proto__]: /x\n\n[__proto__]')
    expect(protoAst[0]).toEqual({
      type: RuleType.refCollection,
      refs: Object.assign(Object.create(null), {
        ['__proto__']: { target: '/x', title: undefined },
      }),
    })
    expect(protoAst[1]).toEqual({
      type: RuleType.paragraph,
      children: [
        {
          type: RuleType.link,
          target: '/x',
          title: undefined,
          children: [
            {
              type: RuleType.textFormatted,
              tag: 'strong',
              children: [{ type: RuleType.text, text: 'proto' }],
            },
          ],
        },
      ],
    })

    const ctorAst = p.parser('[constructor]: /y\n\n[constructor]')
    expect(ctorAst[0]).toEqual({
      type: RuleType.refCollection,
      refs: Object.assign(Object.create(null), {
        constructor: { target: '/y', title: undefined },
      }),
    })
    expect(ctorAst[1]).toEqual({
      type: RuleType.paragraph,
      children: [
        {
          type: RuleType.link,
          target: '/y',
          title: undefined,
          children: [{ type: RuleType.text, text: 'constructor' }],
        },
      ],
    })
  })
})

describe('CRLF line endings', () => {
  function toCrlf(text: string): string {
    return text.replace(/\n/g, '\r\n')
  }

  function stripEndPos(obj: unknown): unknown {
    return JSON.parse(
      JSON.stringify(obj, (k, v) => (k === 'endPos' ? undefined : v))
    )
  }

  function expectCrlfEquivalent(lfText: string, _description?: string) {
    const crlfText = toCrlf(lfText)
    const lfResult = p.parser(lfText)
    const crlfResult = p.parser(crlfText)
    expect(stripEndPos(crlfResult)).toEqual(stripEndPos(lfResult))
  }

  describe('paragraphs', () => {
    it('should handle single paragraph with multiple lines', () => {
      expectCrlfEquivalent('line1\nline2\nline3')
    })

    it('should handle multiple paragraphs separated by blank lines', () => {
      expectCrlfEquivalent('paragraph 1\n\nparagraph 2\n\nparagraph 3')
    })
  })

  describe('headings', () => {
    it('should handle ATX headings', () => {
      expectCrlfEquivalent('# Heading 1\n\n## Heading 2\n\n### Heading 3')
    })

    it('should handle setext headings', () => {
      expectCrlfEquivalent('Heading 1\n=========\n\nHeading 2\n---------')
    })

    it('should handle multi-line setext heading content', () => {
      expectCrlfEquivalent('Multi\nline\nheading\n=======')
    })
  })

  describe('lists', () => {
    it('should handle unordered lists', () => {
      expectCrlfEquivalent('- item 1\n- item 2\n- item 3')
    })

    it('should handle ordered lists', () => {
      expectCrlfEquivalent('1. item 1\n2. item 2\n3. item 3')
    })

    it('should handle nested lists', () => {
      expectCrlfEquivalent('- item 1\n  - nested 1\n  - nested 2\n- item 2')
    })

    it('should handle lists with multi-line items', () => {
      expectCrlfEquivalent('- item 1\n  continuation\n- item 2')
    })

    it('should handle GFM task lists', () => {
      expectCrlfEquivalent('- [ ] unchecked\n- [x] checked\n- [ ] another')
    })
  })

  describe('code blocks', () => {
    it('should handle fenced code blocks with backticks', () => {
      expectCrlfEquivalent('```js\nconst x = 1;\nconst y = 2;\n```')
    })

    it('should handle fenced code blocks with tildes', () => {
      expectCrlfEquivalent('~~~python\ndef foo():\n    pass\n~~~')
    })

    it('should handle indented code blocks', () => {
      expectCrlfEquivalent('    code line 1\n    code line 2\n    code line 3')
    })

    it('should handle fenced code blocks with blank lines', () => {
      expectCrlfEquivalent('```\nline 1\n\nline 3\n```')
    })

    it('should preserve interior blank-line content in indented code: a blank line carrying more than 4 columns of whitespace keeps its dedented remainder as code content (CommonMark 0.31.2 ex 112)', () => {
      const result = p.parser(
        '    chunk1\n      \n      chunk2\n'
      ) as MarkdownToJSX.ASTNode[]
      const code = result.find(
        n => n.type === RuleType.codeBlock
      ) as MarkdownToJSX.CodeBlockNode
      expect(code.text).toBe('chunk1\n  \n  chunk2')
    })
  })

  describe('blockquotes', () => {
    it('should handle simple blockquotes', () => {
      expectCrlfEquivalent('> quote line 1\n> quote line 2')
    })

    it('should handle nested blockquotes', () => {
      expectCrlfEquivalent('> level 1\n>> level 2\n>>> level 3')
    })

    it('should handle blockquotes with lazy continuation', () => {
      expectCrlfEquivalent('> quote line 1\ncontinuation line')
    })

    it('should handle blockquotes with multiple paragraphs', () => {
      expectCrlfEquivalent('> paragraph 1\n>\n> paragraph 2')
    })
  })

  describe('thematic breaks', () => {
    it('should handle horizontal rules', () => {
      expectCrlfEquivalent('paragraph\n\n---\n\nparagraph')
    })

    it('should handle asterisk horizontal rules', () => {
      expectCrlfEquivalent('text\n\n***\n\ntext')
    })

    it('should handle underscore horizontal rules', () => {
      expectCrlfEquivalent('text\n\n___\n\ntext')
    })
  })

  describe('HTML blocks', () => {
    it('should handle HTML block elements', () => {
      expectCrlfEquivalent('<div>\ncontent\n</div>')
    })

    it('should handle HTML comments', () => {
      expectCrlfEquivalent('<!-- comment\nspanning lines -->\n\nparagraph')
    })

    it('should handle pre blocks', () => {
      expectCrlfEquivalent('<pre>\npreformatted\ntext\n</pre>')
    })
  })

  describe('tables', () => {
    it('should handle simple tables', () => {
      expectCrlfEquivalent('| A | B |\n|---|---|\n| 1 | 2 |')
    })

    it('should handle tables with alignment', () => {
      expectCrlfEquivalent(
        '| Left | Center | Right |\n|:-----|:------:|------:|\n| L | C | R |'
      )
    })

    it('should handle tables with multiple rows', () => {
      expectCrlfEquivalent(
        '| H1 | H2 |\n|---|---|\n| a | b |\n| c | d |\n| e | f |'
      )
    })
  })

  describe('reference definitions', () => {
    it('should handle reference definitions', () => {
      expectCrlfEquivalent('[link][ref]\n\n[ref]: http://example.com')
    })

    it('should handle reference definitions with titles', () => {
      expectCrlfEquivalent('[link][ref]\n\n[ref]: http://example.com "title"')
    })

    it('should handle multiple reference definitions', () => {
      expectCrlfEquivalent(
        '[a][1] and [b][2]\n\n[1]: http://a.com\n[2]: http://b.com'
      )
    })

    it('should reject title with blank line (CRLF blank line detection)', () => {
      const lfText = '[ref]: http://example.com "title\n\nmore"'
      const crlfText = toCrlf(lfText)
      const lfResult = p.parser(lfText)
      const crlfResult = p.parser(crlfText)
      expect(stripEndPos(crlfResult)).toEqual(stripEndPos(lfResult))
      expect(lfResult.length).toBe(2)
    })

    it('should reject parenthesized title with blank line', () => {
      const lfText = '[ref]: http://example.com (title\n\nmore)'
      const crlfText = toCrlf(lfText)
      const lfResult = p.parser(lfText)
      const crlfResult = p.parser(crlfText)
      expect(stripEndPos(crlfResult)).toEqual(stripEndPos(lfResult))
      expect(lfResult.length).toBe(2)
    })
  })

  describe('footnotes', () => {
    it('should handle footnote definitions', () => {
      expectCrlfEquivalent('Text[^1].\n\n[^1]: Footnote content')
    })

    it('should handle footnotes with continuation', () => {
      expectCrlfEquivalent('Text[^1].\n\n[^1]: Footnote\n    continuation')
    })

    it('should handle multiple footnotes', () => {
      expectCrlfEquivalent('A[^1] B[^2]\n\n[^1]: First\n[^2]: Second')
    })

    it('should not absorb paragraph after blank line (CRLF blank line detection)', () => {
      const lfText = '[^1]: Footnote content\n\nParagraph after.'
      const crlfText = toCrlf(lfText)
      const lfResult = p.parser(lfText)
      const crlfResult = p.parser(crlfText)
      expect(stripEndPos(crlfResult)).toEqual(stripEndPos(lfResult))
      expect(lfResult.length).toBe(3)
    })
  })

  describe('frontmatter', () => {
    it('should handle YAML frontmatter', () => {
      expectCrlfEquivalent('---\ntitle: Test\nauthor: Me\n---\n\nContent')
    })

    it('should skip frontmatter detection when disableFrontmatter is true', () => {
      const result = p.parser('---\ntitle: Hello\n---\ncontent', {
        disableFrontmatter: true,
      })
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "type": "breakThematic",
          },
          {
            "children": [
              {
                "text": "title: Hello",
                "type": "text",
              },
            ],
            "id": "title-hello",
            "level": 2,
            "type": "heading",
          },
          {
            "children": [
              {
                "text": "content",
                "type": "text",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('should detect frontmatter normally when disableFrontmatter is not set', () => {
      const result = p.parser('---\ntitle: Hello\n---\ncontent')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "text": 
        "---
        title: Hello
        ---"
        ,
            "type": "frontmatter",
          },
          {
            "children": [
              {
                "text": "content",
                "type": "text",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('should parse issue #861 input as thematic breaks when disableFrontmatter is true', () => {
      const result = p.parser(
        '---\n\n**Subject: Hello World**\n\nSome content here.\n\n---\n\n> Final section',
        { disableFrontmatter: true }
      )
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "type": "breakThematic",
          },
          {
            "children": [
              {
                "children": [
                  {
                    "text": "Subject: Hello World",
                    "type": "text",
                  },
                ],
                "tag": "strong",
                "type": "textFormatted",
              },
            ],
            "type": "paragraph",
          },
          {
            "children": [
              {
                "text": "Some content here.",
                "type": "text",
              },
            ],
            "type": "paragraph",
          },
          {
            "type": "breakThematic",
          },
          {
            "alert": undefined,
            "children": [
              {
                "children": [
                  {
                    "text": "Final section",
                    "type": "text",
                  },
                ],
                "type": "paragraph",
              },
            ],
            "type": "blockQuote",
          },
        ]
      `)
    })

    it('should not consume content as frontmatter when colons appear in markdown (issue #861)', () => {
      const result = p.parser(
        '---\n\n**Subject: Hello World**\n\nSome content here.\n\n---\n\n> Final section'
      )
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "type": "breakThematic",
          },
          {
            "children": [
              {
                "children": [
                  {
                    "text": "Subject: Hello World",
                    "type": "text",
                  },
                ],
                "tag": "strong",
                "type": "textFormatted",
              },
            ],
            "type": "paragraph",
          },
          {
            "children": [
              {
                "text": "Some content here.",
                "type": "text",
              },
            ],
            "type": "paragraph",
          },
          {
            "type": "breakThematic",
          },
          {
            "alert": undefined,
            "children": [
              {
                "children": [
                  {
                    "text": "Final section",
                    "type": "text",
                  },
                ],
                "type": "paragraph",
              },
            ],
            "type": "blockQuote",
          },
        ]
      `)
    })
  })

  describe('complex documents', () => {
    it('should handle mixed content', () => {
      const doc = `# Title

Paragraph with **bold** and *italic*.

- List item 1
- List item 2

\`\`\`js
code
\`\`\`

> Blockquote

---

Final paragraph.`
      expectCrlfEquivalent(doc)
    })

    it('should handle the original issue case (issue #773)', () => {
      const text = `Lorem ipsum dolor sit amet.

- Item 1
- Item 2
- Item 3
- Item 4`

      const crlfText = toCrlf(text)
      const result = p.parser(crlfText)

      expect(result.length).toBe(2)
      expect(result[0].type).toBe(RuleType.paragraph)
      expect(result[1].type).toBe(RuleType.unorderedList)

      const list = result[1] as MarkdownToJSX.UnorderedListNode
      expect(list.items.length).toBe(4)

      for (const item of list.items) {
        expect(item.length).toBeGreaterThan(0)
        const firstNode = item[0]
        if (firstNode.type === RuleType.text) {
          const text = (firstNode as MarkdownToJSX.TextNode).text
          expect(text.indexOf('\r')).toBe(-1)
        }
      }
    })
  })
})

describe('raw HTML on* attribute stripping', () => {
  const myComponent = { overrides: { MyComponent: { props: {} } } }

  it('keeps a bare boolean on* on a component (a prop, not a handler)', () => {
    const result = p.parser(
      '<MyComponent onClick />',
      myComponent
    ) as (MarkdownToJSX.HTMLSelfClosingNode & { endPos: number })[]
    expect(result[0].attrs?.onClick).toBe(true)
  })

  it('strips a string-valued on* even on a component', () => {
    const result = p.parser(
      '<MyComponent onclick="alert(1)" />',
      myComponent
    ) as (MarkdownToJSX.HTMLSelfClosingNode & { endPos: number })[]
    expect(result[0].attrs?.onclick).toBeUndefined()
  })

  it('strips a bare boolean on* on a standard HTML tag', () => {
    const result = p.parser(
      '<img onload />'
    ) as (MarkdownToJSX.HTMLSelfClosingNode & { endPos: number })[]
    expect(result[0].attrs?.onload).toBeUndefined()
  })
})

describe('Unserializable expression evaluation', () => {
  const components = {
    overrides: {
      Button: { props: {} },
      Component: { props: {} },
      Input: { props: {} },
    },
  }

  describe('with evalUnserializableExpressions: false (default)', () => {
    it('should keep function expressions as strings', () => {
      const markdown = '<Button onClick={() => alert("test")} />'
      const result = p.parser(
        markdown,
        components
      ) as (MarkdownToJSX.HTMLSelfClosingNode & {
        endPos: number
      })[]

      expect(result[0].attrs?.onClick).toBe('() => alert("test")')
      expect(typeof result[0].attrs?.onClick).toBe('string')
    })

    it('should keep arrow functions as strings', () => {
      const markdown = '<Input onChange={(e) => setValue(e.target.value)} />'
      const result = p.parser(
        markdown,
        components
      ) as (MarkdownToJSX.HTMLSelfClosingNode & {
        endPos: number
      })[]

      expect(result[0].attrs?.onChange).toBe('(e) => setValue(e.target.value)')
      expect(typeof result[0].attrs?.onChange).toBe('string')
    })

    it('should keep function declarations as strings', () => {
      const markdown = '<Component handler={function handleClick() { }} />'
      const result = p.parser(
        markdown,
        components
      ) as (MarkdownToJSX.HTMLSelfClosingNode & {
        endPos: number
      })[]

      expect(typeof result[0].attrs?.handler).toBe('string')
    })

    it('should keep complex expressions as strings', () => {
      const markdown = '<Component value={someVar + 10} />'
      const result = p.parser(
        markdown,
        components
      ) as (MarkdownToJSX.HTMLSelfClosingNode & {
        endPos: number
      })[]

      expect(result[0].attrs?.value).toBe('someVar + 10')
      expect(typeof result[0].attrs?.value).toBe('string')
    })
  })

  describe('with evalUnserializableExpressions: true', () => {
    const options = { ...components, evalUnserializableExpressions: true }

    it('should evaluate arrow functions', () => {
      const markdown = '<Button onClick={() => 42} />'
      const result = p.parser(
        markdown,
        options
      ) as MarkdownToJSX.HTMLSelfClosingNode[]
      expect(typeof result[0].attrs?.onClick).toBe('function')
      expect((result[0].attrs?.onClick as Function)()).toBe(42)
    })

    it('should evaluate arrow functions with parameters', () => {
      const markdown = '<Input onChange={(x) => x * 2} />'
      const result = p.parser(
        markdown,
        options
      ) as MarkdownToJSX.HTMLSelfClosingNode[]
      expect(typeof result[0].attrs?.onChange).toBe('function')
      expect((result[0].attrs?.onChange as Function)(5)).toBe(10)
    })

    it('should evaluate function declarations', () => {
      const markdown = '<Component handler={function(n) { return n + 1; }} />'
      const result = p.parser(
        markdown,
        options
      ) as MarkdownToJSX.HTMLSelfClosingNode[]
      expect(typeof result[0].attrs?.handler).toBe('function')
      expect((result[0].attrs?.handler as Function)(5)).toBe(6)
    })

    it('should keep invalid javascript as strings', () => {
      const markdown = '<Component invalid={this is not valid javascript} />'
      const result = p.parser(
        markdown,
        options
      ) as MarkdownToJSX.HTMLSelfClosingNode[]
      expect(typeof result[0].attrs?.invalid).toBe('string')
    })

    it('should parse arrays and objects via JSON', () => {
      const markdown =
        '<Component data={[1, 2, 3]} config={{"key": "value"}} />'
      const result = p.parser(
        markdown,
        options
      ) as MarkdownToJSX.HTMLSelfClosingNode[]
      expect(result[0].attrs?.data).toEqual([1, 2, 3])
      expect(result[0].attrs?.config).toEqual({ key: 'value' })
    })

    it('should convert boolean values', () => {
      const markdown = '<Input enabled={true} disabled={false} />'
      const result = p.parser(
        markdown,
        options
      ) as MarkdownToJSX.HTMLSelfClosingNode[]
      expect(result[0].attrs?.enabled).toBe(true)
      expect(result[0].attrs?.disabled).toBe(false)
    })

    it('should keep undefined variable references as strings', () => {
      const markdown = '<Component value={someUndefinedVar} />'
      const result = p.parser(
        markdown,
        options
      ) as MarkdownToJSX.HTMLSelfClosingNode[]
      expect(typeof result[0].attrs?.value).toBe('string')
      expect(result[0].attrs?.value).toBe('someUndefinedVar')
    })
  })

  describe('security considerations', () => {
    it('should keep expressions as strings by default', () => {
      const maliciousMarkdown =
        '<Component onClick={() => fetch("/admin/delete")} />'
      const safeResult = p.parser(
        maliciousMarkdown,
        components
      ) as MarkdownToJSX.HTMLSelfClosingNode[]
      expect(typeof safeResult[0].attrs?.onClick).toBe('string')
    })

    it('should eval expressions when evalUnserializableExpressions is true', () => {
      const markdown = '<Component onClick={() => 42} />'
      const result = p.parser(markdown, {
        ...components,
        evalUnserializableExpressions: true,
      }) as MarkdownToJSX.HTMLSelfClosingNode[]
      expect(typeof result[0].attrs?.onClick).toBe('function')
    })

    it('should keep functions as strings by default to prevent code execution', () => {
      const markdown =
        '<Button onClick={() => window.location.href = "https://evil.com"} />'
      const result = p.parser(
        markdown,
        components
      ) as MarkdownToJSX.HTMLSelfClosingNode[]
      expect(typeof result[0].attrs?.onClick).toBe('string')
      expect(() => {
        ;(result[0].attrs?.onClick as Function)()
      }).toThrow()
    })

    it('drops string-valued event handlers from the attrs map', () => {
      const result = p.parser(
        '<img src=x onerror=alert(1) onload="steal()">'
      ) as MarkdownToJSX.HTMLSelfClosingNode[]
      expect(result[0].attrs).toEqual({ src: 'x' })
    })

    it('drops dangerous-scheme URL attributes from the attrs map', () => {
      const result = p.parser(
        '<img src="javascript:alert(1)" alt="a">'
      ) as MarkdownToJSX.HTMLSelfClosingNode[]
      expect(result[0].attrs).toEqual({ alt: 'a' })
    })

    it('drops schemes hidden in numeric character references without a trailing semicolon, which a browser resolves to the scheme, and leaves a safe numeric entity (&#38;) in a URL untouched', () => {
      const dec = p.parser(
        '<img src="&#106avascript:alert(1)" alt="a">'
      ) as MarkdownToJSX.HTMLSelfClosingNode[]
      expect(dec[0].attrs).toEqual({ alt: 'a' })
      const hex = p.parser(
        '<img src="j&#x61vascript:alert(1)" alt="a">'
      ) as MarkdownToJSX.HTMLSelfClosingNode[]
      expect(hex[0].attrs).toEqual({ alt: 'a' })
      const safe = p.parser(
        '<img src="/s?a=1&#38;b=2" alt="a">'
      ) as MarkdownToJSX.HTMLSelfClosingNode[]
      expect(safe[0].attrs).toEqual({ alt: 'a', src: '/s?a=1&#38;b=2' })
    })

    it('keeps brace-expression props, as renderer-resolved props, on a capitalized tag an override matches, and a handler as written on a lowercase tag an override matches, but strips dangerous brace handlers on HTML tags (a lowercase tag without an override is HTML)', () => {
      const jsx = p.parser(
        '<MyComponent onClick={handler} onChange={fn} href={url} data={[1,2,3]} />',
        { overrides: { MyComponent: { props: {} } } }
      ) as MarkdownToJSX.HTMLSelfClosingNode[]
      expect(jsx[0].attrs).toEqual({
        data: [1, 2, 3],
        href: '{url}',
        onChange: 'fn',
        onClick: 'handler',
      })
      const custom = p.parser(
        '<my-el onClick={handleClick} items={x}>x</my-el>'
      ) as MarkdownToJSX.HTMLNode[]
      expect(custom[0].attrs).toEqual({ items: '{x}' })
      const registered = p.parser('<my-el onClick={handleClick}>x</my-el>', {
        overrides: { 'my-el': { props: {} } },
      }) as MarkdownToJSX.HTMLNode[]
      expect(registered[0].attrs).toEqual({ onClick: '{handleClick}' })
      const div = p.parser(
        '<div onClick={alert(1)} title={t}>x</div>'
      ) as MarkdownToJSX.HTMLNode[]
      expect(div[0].attrs?.onClick).toBeUndefined()
      expect(div[0].attrs?.title).toBe('{t}')
    })
  })

  describe('edge cases', () => {
    it('should evaluate functions with newlines', () => {
      const markdown = `<Component handler={() => {
  const x = 1;
  return x + 1;
}} />`
      const result = p.parser(markdown, {
        ...components,
        evalUnserializableExpressions: true,
      }) as MarkdownToJSX.HTMLSelfClosingNode[]
      expect(typeof result[0].attrs?.handler).toBe('function')
      expect((result[0].attrs?.handler as Function)()).toBe(2)
    })

    it('should evaluate nested braces in functions', () => {
      const markdown = '<Component fn={() => { return { nested: true } }} />'
      const result = p.parser(markdown, {
        ...components,
        evalUnserializableExpressions: true,
      }) as MarkdownToJSX.HTMLSelfClosingNode[]
      expect(typeof result[0].attrs?.fn).toBe('function')
      expect((result[0].attrs?.fn as Function)()).toEqual({ nested: true })
    })

    it('should evaluate empty functions', () => {
      const markdown = '<Component noop={() => {}} />'
      const result = p.parser(markdown, {
        ...components,
        evalUnserializableExpressions: true,
      }) as MarkdownToJSX.HTMLSelfClosingNode[]
      expect(typeof result[0].attrs?.noop).toBe('function')
    })
  })

  describe('verbatim HTML blocks with parsed children', () => {
    it('should not parse markdown content in script tags (verbatim)', () => {
      const result = p.parser(
        '<script>Hello **world**</script>'
      ) as MarkdownToJSX.ASTNode[]
      const htmlNode = result.find(
        n => n.type === RuleType.htmlBlock
      ) as MarkdownToJSX.HTMLNode
      expect(htmlNode).toMatchInlineSnapshot(`
        {
          "_isClosingTag": false,
          "_rawAttrs": "",
          "_rawBody": "Hello **world**",
          "_rawClose": "</script>",
          "_rawOuter": undefined,
          "_reparseSource": undefined,
          "_verbatim": true,
          "attrs": {},
          "children": [],
          "tag": "script",
          "text": "Hello **world**",
          "type": "htmlBlock",
        }
      `)
    })

    it('should not parse nested HTML in pre tags (verbatim)', () => {
      const result = p.parser(
        '<pre><code>const x = 1;</code></pre>'
      ) as MarkdownToJSX.ASTNode[]
      const htmlNode = result.find(
        n =>
          n.type === RuleType.htmlBlock &&
          (n as MarkdownToJSX.HTMLNode).tag === 'pre'
      ) as MarkdownToJSX.HTMLNode
      expect(htmlNode).toMatchInlineSnapshot(`
        {
          "_isClosingTag": false,
          "_rawAttrs": "",
          "_rawBody": "<code>const x = 1;</code>",
          "_rawClose": "</pre>",
          "_rawOuter": undefined,
          "_reparseSource": undefined,
          "_verbatim": true,
          "attrs": {},
          "children": [],
          "tag": "pre",
          "text": "<code>const x = 1;</code>",
          "type": "htmlBlock",
        }
      `)
    })

    it('should not parse markdown in style tags (verbatim)', () => {
      const result = p.parser(
        '<style>body { color: red; }\n\n/* Comment */</style>'
      ) as MarkdownToJSX.ASTNode[]
      const htmlNode = result.find(
        n => n.type === RuleType.htmlBlock
      ) as MarkdownToJSX.HTMLNode
      expect(htmlNode).toMatchInlineSnapshot(`
        {
          "_isClosingTag": false,
          "_rawAttrs": "",
          "_rawBody": 
        "body { color: red; }

        /* Comment */"
        ,
          "_rawClose": "</style>",
          "_rawOuter": undefined,
          "_reparseSource": undefined,
          "_verbatim": true,
          "attrs": {},
          "children": [],
          "tag": "style",
          "text": 
        "body { color: red; }

        /* Comment */"
        ,
          "type": "htmlBlock",
        }
      `)
    })

    it('should parse markdown in Type 6 div tags ending with blank lines into children even when verbatim', () => {
      const result = p.parser(
        '<div>Hello **world**\n\n</div>\n\nNext paragraph'
      ) as MarkdownToJSX.ASTNode[]
      const htmlNode = result.find(
        n =>
          n.type === RuleType.htmlBlock &&
          (n as MarkdownToJSX.HTMLNode).tag === 'div'
      ) as MarkdownToJSX.HTMLNode
      expect(htmlNode).toMatchInlineSnapshot(`
        {
          "_isClosingTag": false,
          "_rawAttrs": "",
          "_rawBody": undefined,
          "_reparseSource": undefined,
          "_verbatim": false,
          "attrs": {},
          "children": [
            {
              "children": [
                {
                  "text": "Hello ",
                  "type": "text",
                },
                {
                  "children": [
                    {
                      "text": "world",
                      "type": "text",
                    },
                  ],
                  "tag": "strong",
                  "type": "textFormatted",
                },
              ],
              "type": "paragraph",
            },
          ],
          "tag": "div",
          "text": 
        "Hello **world**

        "
        ,
          "type": "htmlBlock",
        }
        `)
    })

    it('should handle nested same-tag HTML blocks with blank lines (#829)', () => {
      expect(
        p.parser('<div>\n<div>\ninner\n</div>\n\n</div>\n\nafter')
      ).toMatchInlineSnapshot(`
        [
          {
            "_isClosingTag": false,
            "_rawAttrs": "",
            "_rawBody": undefined,
            "_reparseSource": undefined,
            "_verbatim": false,
            "attrs": {},
            "children": [
              {
                "_emitOwnClose": true,
                "_isClosingTag": false,
                "_rawAttrs": "",
                "_rawBody": 
        "
        inner
        "
        ,
                "_rawOuter": undefined,
                "_reparseSource": undefined,
                "_verbatim": true,
                "attrs": {},
                "children": [
                  {
                    "text": "inner",
                    "type": "text",
                  },
                ],
                "tag": "div",
                "text": 
        "
        inner
        "
        ,
                "type": "htmlBlock",
              },
            ],
            "tag": "div",
            "text": 
        "
        <div>
        inner
        </div>

        "
        ,
            "type": "htmlBlock",
          },
          {
            "children": [
              {
                "text": "after",
                "type": "text",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })
  })
})

describe('text normalization edge cases', () => {
  describe('null bytes (U+0000)', () => {
    it('should replace null bytes with U+FFFD per CommonMark spec', () => {
      const result = p.parser('hello\x00world') as MarkdownToJSX.ParagraphNode[]
      expect(result).toEqual([
        {
          type: RuleType.paragraph,
          children: [{ type: RuleType.text, text: 'hello\uFFFDworld' }],
        },
      ])
    })

    it('should replace multiple null bytes', () => {
      const result = p.parser(
        'a\x00b\x00c\x00d'
      ) as MarkdownToJSX.ParagraphNode[]
      expect(result).toEqual([
        {
          type: RuleType.paragraph,
          children: [{ type: RuleType.text, text: 'a\uFFFDb\uFFFDc\uFFFDd' }],
        },
      ])
    })

    it('should replace null bytes in code blocks', () => {
      const result = p.parser(
        '```\ncode\x00block\n```'
      ) as MarkdownToJSX.CodeBlockNode[]
      expect(result[0].type).toBe(RuleType.codeBlock)
      expect(result[0].text).toBe('code\uFFFDblock')
    })

    it('should replace null bytes in headings', () => {
      const result = p.parser(
        '# Hello\x00World',
        createForceBlockOptions()
      ) as MarkdownToJSX.HeadingNode[]
      expect(result).toEqual([
        {
          type: RuleType.heading,
          level: 1,
          children: [{ type: RuleType.text, text: 'Hello\uFFFDWorld' }],
          id: 'helloworld',
        },
      ])
    })
  })

  describe('BOM handling', () => {
    it('should strip BOM (U+FEFF) at document start', () => {
      const result = p.parser(
        '\uFEFFhello world'
      ) as MarkdownToJSX.ParagraphNode[]
      expect(result).toEqual([
        {
          type: RuleType.paragraph,
          children: [{ type: RuleType.text, text: 'hello world' }],
        },
      ])
    })

    it('should strip BOM before heading', () => {
      const result = p.parser(
        '\uFEFF# Heading',
        createForceBlockOptions()
      ) as MarkdownToJSX.HeadingNode[]
      expect(result).toEqual([
        {
          type: RuleType.heading,
          level: 1,
          children: [{ type: RuleType.text, text: 'Heading' }],
          id: 'heading',
        },
      ])
    })

    it('should preserve BOM in middle of document', () => {
      const result = p.parser(
        'hello\uFEFFworld'
      ) as MarkdownToJSX.ParagraphNode[]
      expect(result).toEqual([
        {
          type: RuleType.paragraph,
          children: [{ type: RuleType.text, text: 'hello\uFEFFworld' }],
        },
      ])
    })
  })

  describe('zero-width characters', () => {
    it('should preserve zero-width space (U+200B) in text', () => {
      const result = p.parser(
        'hello\u200Bworld'
      ) as (MarkdownToJSX.ParagraphNode & { endPos: number })[]
      expect(result[0].children[0]).toEqual({
        type: RuleType.text,
        text: 'hello\u200Bworld',
      })
    })

    it('should handle zero-width joiner (U+200D) in emoji context', () => {
      const result = p.parser(
        'family: \u{1F468}\u200D\u{1F469}\u200D\u{1F467}'
      ) as (MarkdownToJSX.ParagraphNode & { endPos: number })[]
      expect((result[0].children[0] as MarkdownToJSX.TextNode).text).toContain(
        '\u200D'
      )
    })

    it('should handle zero-width non-joiner (U+200C)', () => {
      const result = p.parser(
        'test\u200Cword'
      ) as (MarkdownToJSX.ParagraphNode & { endPos: number })[]
      expect(result[0].children[0]).toEqual({
        type: RuleType.text,
        text: 'test\u200Cword',
      })
    })

    it('should handle zero-width space in emphasis context', () => {
      const result = p.parser(
        '**bold\u200Btext**'
      ) as (MarkdownToJSX.ParagraphNode & { endPos: number })[]
      expect(result[0].children[0].type).toBe(RuleType.textFormatted)
      expect(
        (
          (result[0].children[0] as MarkdownToJSX.FormattedTextNode)
            .children[0] as MarkdownToJSX.TextNode
        ).text
      ).toBe('bold\u200Btext')
    })
  })

  describe('emoji sequences', () => {
    it('should handle emoji with skin tone modifiers', () => {
      const result = p.parser(
        'wave: \u{1F44B}\u{1F3FB}'
      ) as (MarkdownToJSX.ParagraphNode & { endPos: number })[]
      expect((result[0].children[0] as MarkdownToJSX.TextNode).text).toContain(
        '\u{1F44B}\u{1F3FB}'
      )
    })

    it('should handle ZWJ emoji sequences (family)', () => {
      const result = p.parser(
        '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}'
      ) as (MarkdownToJSX.ParagraphNode & { endPos: number })[]
      expect((result[0].children[0] as MarkdownToJSX.TextNode).text).toBe(
        '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}'
      )
    })

    it('should handle flag sequences (regional indicators)', () => {
      const result = p.parser(
        '\u{1F1FA}\u{1F1F8}'
      ) as (MarkdownToJSX.ParagraphNode & { endPos: number })[]
      expect((result[0].children[0] as MarkdownToJSX.TextNode).text).toBe(
        '\u{1F1FA}\u{1F1F8}'
      )
    })

    it('should handle multiple emoji with various modifiers', () => {
      const result = p.parser(
        '\u{1F44B}\u{1F3FB} \u{1F468}\u200D\u{1F4BB} \u{1F1FA}\u{1F1F8}'
      ) as (MarkdownToJSX.ParagraphNode & { endPos: number })[]
      expect((result[0].children[0] as MarkdownToJSX.TextNode).text).toBe(
        '\u{1F44B}\u{1F3FB} \u{1F468}\u200D\u{1F4BB} \u{1F1FA}\u{1F1F8}'
      )
    })
  })

  describe('unicode whitespace', () => {
    it('should treat non-breaking space (U+00A0) as Unicode whitespace', () => {
      const result = p.parser(
        'hello\u00A0world'
      ) as MarkdownToJSX.ParagraphNode[]
      expect((result[0].children[0] as MarkdownToJSX.TextNode).text).toBe(
        'hello\u00A0world'
      )
    })

    it('should distinguish ASCII whitespace from Unicode whitespace in emphasis', () => {
      const result = p.parser('*hello world*') as MarkdownToJSX.ParagraphNode[]
      expect(result[0].children[0].type).toBe(RuleType.textFormatted)
      const result2 = p.parser(
        '*hello\u00A0world*'
      ) as MarkdownToJSX.ParagraphNode[]
      expect(result2[0].children[0].type).toBe(RuleType.textFormatted)
    })

    it('should handle em space (U+2003)', () => {
      const result = p.parser(
        'hello\u2003world'
      ) as MarkdownToJSX.ParagraphNode[]
      expect((result[0].children[0] as MarkdownToJSX.TextNode).text).toBe(
        'hello\u2003world'
      )
    })

    it('should handle en space (U+2002)', () => {
      const result = p.parser(
        'hello\u2002world'
      ) as MarkdownToJSX.ParagraphNode[]
      expect((result[0].children[0] as MarkdownToJSX.TextNode).text).toBe(
        'hello\u2002world'
      )
    })

    it('should handle thin space (U+2009)', () => {
      const result = p.parser(
        'hello\u2009world'
      ) as MarkdownToJSX.ParagraphNode[]
      expect((result[0].children[0] as MarkdownToJSX.TextNode).text).toBe(
        'hello\u2009world'
      )
    })

    it.each([
      ['a no-break space', '\u00a0'],
      ['an ideographic space', '\u3000'],
      ['a form feed', '\f'],
      ['a vertical tab', '\v'],
    ])('should keep a GitHub alert when its marker is followed by %s', (_name, ws) => {
      expect(p.parser(`> [!NOTE]${ws}\n> body`)).toEqual([
        {
          alert: 'NOTE',
          children: [
            {
              children: [{ text: 'body', type: RuleType.text }],
              type: RuleType.paragraph,
            },
          ],
          type: RuleType.blockQuote,
        },
      ])
    })
  })

  describe('control characters', () => {
    it('should preserve bell character (U+0007)', () => {
      const result = p.parser('hello\x07world') as MarkdownToJSX.ParagraphNode[]
      expect((result[0].children[0] as MarkdownToJSX.TextNode).text).toBe(
        'hello\x07world'
      )
    })

    it('should preserve backspace (U+0008)', () => {
      const result = p.parser('hello\x08world') as MarkdownToJSX.ParagraphNode[]
      expect((result[0].children[0] as MarkdownToJSX.TextNode).text).toBe(
        'hello\x08world'
      )
    })

    it('should preserve escape (U+001B)', () => {
      const result = p.parser('hello\x1Bworld') as MarkdownToJSX.ParagraphNode[]
      expect((result[0].children[0] as MarkdownToJSX.TextNode).text).toBe(
        'hello\x1Bworld'
      )
    })

    it('should preserve delete (U+007F)', () => {
      const result = p.parser('hello\x7Fworld') as MarkdownToJSX.ParagraphNode[]
      expect((result[0].children[0] as MarkdownToJSX.TextNode).text).toBe(
        'hello\x7Fworld'
      )
    })

    it('should preserve vertical tab (U+000B)', () => {
      const result = p.parser('hello\x0Bworld') as MarkdownToJSX.ParagraphNode[]
      expect((result[0].children[0] as MarkdownToJSX.TextNode).text).toBe(
        'hello\x0Bworld'
      )
    })

    it('should preserve form feed (U+000C)', () => {
      const result = p.parser('hello\x0Cworld') as MarkdownToJSX.ParagraphNode[]
      expect((result[0].children[0] as MarkdownToJSX.TextNode).text).toBe(
        'hello\x0Cworld'
      )
    })

    it('should handle multiple control characters', () => {
      const result = p.parser(
        'a\x07b\x08c\x1Bd\x7Fe'
      ) as MarkdownToJSX.ParagraphNode[]
      expect((result[0].children[0] as MarkdownToJSX.TextNode).text).toBe(
        'a\x07b\x08c\x1Bd\x7Fe'
      )
    })
  })

  describe('md4c regression edge cases, from md4c test/regressions.txt without the md4c-specific extensions (--fpermissive-url-autolinks, --fwiki-links) and with single-tilde strikethrough adapted to double-tilde', () => {
    it('md4c#2: raw HTML block with attributes', () => {
      const result = p.parser('<gi att1=tok1 att2=tok2>')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "_isClosingTag": false,
            "_rawAttrs": " att1=tok1 att2=tok2",
            "_rawBody": "",
            "_rawOuter": undefined,
            "_reparseSource": undefined,
            "_verbatim": true,
            "attrs": {
              "att1": "tok1",
              "att2": "tok2",
            },
            "children": [],
            "tag": "gi",
            "text": "",
            "type": "htmlBlock",
          },
        ]
      `)
    })

    it('md4c#2: inline HTML with attributes', () => {
      const result = p.parser('foo <gi att1=tok1 att2=tok2> bar')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "children": [
              {
                "text": "foo ",
                "type": "text",
              },
              {
                "_isClosingTag": false,
                "_rawOpen": "<gi att1=tok1 att2=tok2>",
                "attrs": {
                  "att1": "tok1",
                  "att2": "tok2",
                },
                "tag": "gi",
                "type": "htmlSelfClosing",
              },
              {
                "text": " bar",
                "type": "text",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('md4c#2: inline HTML with line break in attributes', () => {
      const result = p.parser('foo <gi att1=tok1\natt2=tok2> bar')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "children": [
              {
                "text": "foo ",
                "type": "text",
              },
              {
                "_isClosingTag": false,
                "_rawOpen": 
        "<gi att1=tok1
        att2=tok2>"
        ,
                "attrs": {
                  "att1": "tok1",
                  "att2": "tok2",
                },
                "tag": "gi",
                "type": "htmlSelfClosing",
              },
              {
                "text": " bar",
                "type": "text",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('md4c#4: image alt text with entity', () => {
      const result = p.parser(
        "![alt text with *entity* &copy;](img.png 'title')"
      )
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "children": [
              {
                "alt": "alt text with entity ©",
                "target": "img.png",
                "title": "title",
                "type": "image",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('md4c#9: reference link defined inside blockquote', () => {
      const result = p.parser('> [foo\n> bar]: /url\n>\n> [foo bar]')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "refs": {
              "foo bar": {
                "target": "/url",
                "title": undefined,
              },
            },
            "type": "refCollection",
          },
          {
            "alert": undefined,
            "children": [
              {
                "children": [
                  {
                    "children": [
                      {
                        "text": "foo bar",
                        "type": "text",
                      },
                    ],
                    "target": "/url",
                    "title": undefined,
                    "type": "link",
                  },
                ],
                "type": "paragraph",
              },
            ],
            "type": "blockQuote",
          },
        ]
      `)
    })

    it('md4c#10: link def then list with processing instruction', () => {
      const result = p.parser('[x]:\nx\n- <?\n\n  x')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "refs": {
              "x": {
                "target": "x",
                "title": undefined,
              },
            },
            "type": "refCollection",
          },
          {
            "items": [
              [
                {
                  "_endsWithGT": false,
                  "raw": true,
                  "text": 
        "<?

        x"
        ,
                  "type": "htmlComment",
                },
              ],
            ],
            "type": "unorderedList",
          },
        ]
      `)
    })

    it('md4c#11: link with entity in title', () => {
      const result = p.parser('x [link](/url "foo &ndash; bar") x')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "children": [
              {
                "text": "x ",
                "type": "text",
              },
              {
                "children": [
                  {
                    "text": "link",
                    "type": "text",
                  },
                ],
                "target": "/url",
                "title": "foo – bar",
                "type": "link",
              },
              {
                "text": " x",
                "type": "text",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('md4c#14: emphasis edge case a***b* c*', () => {
      const result = p.parser('a***b* c*')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "children": [
              {
                "text": "a**",
                "type": "text",
              },
              {
                "children": [
                  {
                    "text": "b",
                    "type": "text",
                  },
                ],
                "tag": "em",
                "type": "textFormatted",
              },
              {
                "text": " c*",
                "type": "text",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('md4c#15: emphasis edge case ***b* c*', () => {
      const result = p.parser('***b* c*')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "children": [
              {
                "text": "*",
                "type": "text",
              },
              {
                "children": [
                  {
                    "children": [
                      {
                        "text": "b",
                        "type": "text",
                      },
                    ],
                    "tag": "em",
                    "type": "textFormatted",
                  },
                  {
                    "text": " c",
                    "type": "text",
                  },
                ],
                "tag": "em",
                "type": "textFormatted",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('md4c#21: emphasis edge case a*b**c*', () => {
      const result = p.parser('a*b**c*')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "children": [
              {
                "text": "a",
                "type": "text",
              },
              {
                "children": [
                  {
                    "text": "b",
                    "type": "text",
                  },
                  {
                    "text": "**",
                    "type": "text",
                  },
                  {
                    "text": "c",
                    "type": "text",
                  },
                ],
                "tag": "em",
                "type": "textFormatted",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('md4c#33: unclosed code fence with entities in info string', () => {
      const result = p.parser('```&amp;&amp;&amp;&amp;&amp;&amp;&amp;&amp;')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "attrs": undefined,
            "infoString": undefined,
            "lang": "&amp;&amp;&amp;&amp;&amp;&amp;&amp;&amp;",
            "text": "",
            "type": "codeBlock",
          },
        ]
      `)
    })

    it('md4c#36: underscore emphasis __x_ _x___', () => {
      const result = p.parser('__x_ _x___')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "children": [
              {
                "children": [
                  {
                    "children": [
                      {
                        "text": "x",
                        "type": "text",
                      },
                    ],
                    "tag": "em",
                    "type": "textFormatted",
                  },
                  {
                    "text": " ",
                    "type": "text",
                  },
                  {
                    "children": [
                      {
                        "text": "x",
                        "type": "text",
                      },
                    ],
                    "tag": "em",
                    "type": "textFormatted",
                  },
                ],
                "tag": "em",
                "type": "textFormatted",
              },
              {
                "text": "_",
                "type": "text",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('md4c#39: reference def with backslash label', () => {
      const result = p.parser('[\\\\]: x')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "refs": {
              "\\\\\\\\": {
                "target": "x",
                "title": undefined,
              },
            },
            "type": "refCollection",
          },
        ]
      `)
    })

    it('md4c#40: link with multiline title', () => {
      const result = p.parser("[x](url\n'title'\n)x")
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "children": [
              {
                "children": [
                  {
                    "text": "x",
                    "type": "text",
                  },
                ],
                "target": "url",
                "title": "title",
                "type": "link",
              },
              {
                "text": "x",
                "type": "text",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('md4c#42: table with link in cell and fewer body columns', () => {
      const result = p.parser('A | B\n--- | ---\n[x](url)')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "align": [
              null,
              null,
            ],
            "cells": [
              [
                [
                  {
                    "children": [
                      {
                        "text": "x",
                        "type": "text",
                      },
                    ],
                    "target": "url",
                    "title": undefined,
                    "type": "link",
                  },
                ],
                [],
              ],
            ],
            "header": [
              [
                {
                  "text": "A",
                  "type": "text",
                },
              ],
              [
                {
                  "text": "B",
                  "type": "text",
                },
              ],
            ],
            "type": "table",
          },
        ]
      `)
    })

    it('md4c#65: single backtick as paragraph', () => {
      const result = p.parser('`')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "children": [
              {
                "text": "\`",
                "type": "text",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('md4c#69: strikethrough wrapping code', () => {
      const result = p.parser('~~`foo`~~')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "children": [
              {
                "children": [
                  {
                    "text": "foo",
                    "type": "codeInline",
                  },
                ],
                "tag": "del",
                "type": "textFormatted",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('md4c#69: strikethrough wrapping emphasis', () => {
      const result = p.parser('~~*foo*~~')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "children": [
              {
                "children": [
                  {
                    "children": [
                      {
                        "text": "foo",
                        "type": "text",
                      },
                    ],
                    "tag": "em",
                    "type": "textFormatted",
                  },
                ],
                "tag": "del",
                "type": "textFormatted",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('md4c#69: emphasis wrapping strikethrough', () => {
      const result = p.parser('*~~foo~~*')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "children": [
              {
                "children": [
                  {
                    "children": [
                      {
                        "text": "foo",
                        "type": "text",
                      },
                    ],
                    "tag": "del",
                    "type": "textFormatted",
                  },
                ],
                "tag": "em",
                "type": "textFormatted",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('md4c#74: link def followed by indented code and list', () => {
      const result = p.parser('[f]:\n-\n    xx\n-')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "refs": {
              "f": {
                "target": "-",
                "title": undefined,
              },
            },
            "type": "refCollection",
          },
          {
            "attrs": undefined,
            "infoString": undefined,
            "lang": undefined,
            "text": "xx",
            "type": "codeBlock",
          },
          {
            "items": [
              [],
            ],
            "type": "unorderedList",
          },
        ]
      `)
    })

    it('md4c#78: unicode sharp-s case folding in refs', () => {
      const result = p.parser('[SS ẞ]: /url\n[ẞ SS]')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "refs": {
              "ss ss": {
                "target": "/url",
                "title": undefined,
              },
            },
            "type": "refCollection",
          },
          {
            "children": [
              {
                "children": [
                  {
                    "text": "ẞ SS",
                    "type": "text",
                  },
                ],
                "target": "/url",
                "title": undefined,
                "type": "link",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('md4c#83: paragraph followed by empty blockquote', () => {
      const result = p.parser('foo\n>')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "children": [
              {
                "text": "foo",
                "type": "text",
              },
            ],
            "type": "paragraph",
          },
          {
            "alert": undefined,
            "children": [],
            "type": "blockQuote",
          },
        ]
      `)
    })

    it('md4c#95: dot-space is not an ordered list', () => {
      const result = p.parser('. foo')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "children": [
              {
                "text": ". foo",
                "type": "text",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('md4c#96: reference link exact match only', () => {
      const result = p.parser('[ab]: /foo\n[a] [ab] [abc]')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "refs": {
              "ab": {
                "target": "/foo",
                "title": undefined,
              },
            },
            "type": "refCollection",
          },
          {
            "children": [
              {
                "text": "[a] ",
                "type": "text",
              },
              {
                "children": [
                  {
                    "text": "ab",
                    "type": "text",
                  },
                ],
                "target": "/foo",
                "title": undefined,
                "type": "link",
              },
              {
                "text": " [abc]",
                "type": "text",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('md4c#96: reference link with internal whitespace', () => {
      const result = p.parser('[a b]: /foo\n[a   b]')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "refs": {
              "a b": {
                "target": "/foo",
                "title": undefined,
              },
            },
            "type": "refCollection",
          },
          {
            "children": [
              {
                "children": [
                  {
                    "text": "a   b",
                    "type": "text",
                  },
                ],
                "target": "/foo",
                "title": undefined,
                "type": "link",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('md4c#97: emphasis *a **b c* d**', () => {
      const result = p.parser('*a **b c* d**')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "children": [
              {
                "children": [
                  {
                    "text": "a ",
                    "type": "text",
                  },
                  {
                    "children": [
                      {
                        "children": [
                          {
                            "text": "b c",
                            "type": "text",
                          },
                        ],
                        "tag": "em",
                        "type": "textFormatted",
                      },
                      {
                        "text": " d",
                        "type": "text",
                      },
                    ],
                    "tag": "em",
                    "type": "textFormatted",
                  },
                ],
                "tag": "em",
                "type": "textFormatted",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('md4c#100: autolink email at max label length', () => {
      const result = p.parser(
        '<foo@123456789012345678901234567890123456789012345678901234567890123.123456789012345678901234567890123456789012345678901234567890123>'
      )
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "children": [
              {
                "children": [
                  {
                    "text": "foo@123456789012345678901234567890123456789012345678901234567890123.123456789012345678901234567890123456789012345678901234567890123",
                    "type": "text",
                  },
                ],
                "target": "mailto:foo@123456789012345678901234567890123456789012345678901234567890123.123456789012345678901234567890123456789012345678901234567890123",
                "title": undefined,
                "type": "link",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('md4c#100: autolink email exceeding max label length', () => {
      const result = p.parser(
        '<foo@123456789012345678901234567890123456789012345678901234567890123x.123456789012345678901234567890123456789012345678901234567890123>'
      )
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "children": [
              {
                "text": "<foo@123456789012345678901234567890123456789012345678901234567890123x.123456789012345678901234567890123456789012345678901234567890123>",
                "type": "text",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('md4c#104: table cell containing a link', () => {
      const result = p.parser('A | B\n--- | ---\n[x](url)')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "align": [
              null,
              null,
            ],
            "cells": [
              [
                [
                  {
                    "children": [
                      {
                        "text": "x",
                        "type": "text",
                      },
                    ],
                    "target": "url",
                    "title": undefined,
                    "type": "link",
                  },
                ],
                [],
              ],
            ],
            "header": [
              [
                {
                  "text": "A",
                  "type": "text",
                },
              ],
              [
                {
                  "text": "B",
                  "type": "text",
                },
              ],
            ],
            "type": "table",
          },
        ]
      `)
    })

    it('md4c#107: emphasis ***foo *bar baz***', () => {
      const result = p.parser('***foo *bar baz***')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "children": [
              {
                "text": "*",
                "type": "text",
              },
              {
                "children": [
                  {
                    "text": "foo ",
                    "type": "text",
                  },
                  {
                    "children": [
                      {
                        "text": "bar baz",
                        "type": "text",
                      },
                    ],
                    "tag": "em",
                    "type": "textFormatted",
                  },
                ],
                "tag": "strong",
                "type": "textFormatted",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('md4c#124: code fence preserves many leading spaces', () => {
      const result = p.parser(
        '~~~\n                x\n~~~\n\n~~~\n                 x\n~~~'
      )
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "attrs": undefined,
            "infoString": undefined,
            "lang": undefined,
            "text": "                x",
            "type": "codeBlock",
          },
          {
            "attrs": undefined,
            "infoString": undefined,
            "lang": undefined,
            "text": "                 x",
            "type": "codeBlock",
          },
        ]
      `)
    })

    it('md4c#131: image inside link via reference defs', () => {
      const result = p.parser(
        '[![alt][img]][link]\n\n[img]: img_url\n[link]: link_url'
      )
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "refs": {
              "img": {
                "target": "img_url",
                "title": undefined,
              },
              "link": {
                "target": "link_url",
                "title": undefined,
              },
            },
            "type": "refCollection",
          },
          {
            "children": [
              {
                "children": [
                  {
                    "alt": "alt",
                    "target": "img_url",
                    "title": undefined,
                    "type": "image",
                  },
                ],
                "target": "link_url",
                "title": undefined,
                "type": "link",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('md4c#138: table with header only, no body rows', () => {
      const result = p.parser('| abc | def |\n| --- | --- |')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "align": [
              null,
              null,
            ],
            "cells": [],
            "header": [
              [
                {
                  "text": "abc",
                  "type": "text",
                },
              ],
              [
                {
                  "text": "def",
                  "type": "text",
                },
              ],
            ],
            "type": "table",
          },
        ]
      `)
    })

    it('md4c#142: unicode ligature not matching in ref labels', () => {
      const result = p.parser('[foo\uFB17]: /url\n[foo\uFB15]')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "refs": {
              "fooﬗ": {
                "target": "/url",
                "title": undefined,
              },
            },
            "type": "refCollection",
          },
          {
            "children": [
              {
                "text": "[fooﬕ]",
                "type": "text",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('md4c#149: script tag inside list items', () => {
      const result = p.parser('- <script>\n- foo\nbar\n</script>')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "items": [
              [
                {
                  "_isClosingTag": false,
                  "_rawAttrs": "",
                  "_rawBody": undefined,
                  "_rawClose": undefined,
                  "_rawOuter": "<script>",
                  "_reparseSource": undefined,
                  "_verbatim": true,
                  "attrs": {},
                  "children": [],
                  "tag": "script",
                  "text": "",
                  "type": "htmlBlock",
                },
              ],
              [
                {
                  "text": 
        "foo
        bar"
        ,
                  "type": "text",
                },
              ],
            ],
            "type": "unorderedList",
          },
          {
            "_isClosingTag": true,
            "_rawClose": "</script>",
            "attrs": {},
            "tag": "script",
            "type": "htmlSelfClosing",
          },
        ]
      `)
    })

    it('md4c#190: empty list item followed by indented code block', () => {
      const result = p.parser('-\n\n    foo')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "items": [
              [],
            ],
            "type": "unorderedList",
          },
          {
            "attrs": undefined,
            "infoString": undefined,
            "lang": undefined,
            "text": "foo",
            "type": "codeBlock",
          },
        ]
      `)
    })

    it('md4c#200: HTML comment followed by indented code', () => {
      const result = p.parser('<!-- foo -->\n    ```\n    bar\n    ```')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "_endsWithGT": false,
            "raw": true,
            "text": 
        "<!-- foo -->
        "
        ,
            "type": "htmlComment",
          },
          {
            "attrs": undefined,
            "infoString": undefined,
            "lang": undefined,
            "text": 
        "\`\`\`
        bar
        \`\`\`"
        ,
            "type": "codeBlock",
          },
        ]
      `)
    })

    it('md4c#201: lazy continuation with indented backtick code', () => {
      const result = p.parser('foo\n    ```\n    bar\n    ```')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "children": [
              {
                "text": 
        "foo
        "
        ,
                "type": "text",
              },
              {
                "text": "    bar    ",
                "type": "codeInline",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('md4c#207: textarea preserves inner markdown verbatim', () => {
      const result = p.parser(
        '<textarea>\n\n*foo*\n\n_bar_\n\n</textarea>\n\nbaz'
      )
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "_isClosingTag": false,
            "_rawAttrs": "",
            "_rawBody": 
        "
        *foo*

        _bar_"
        ,
            "_rawClose": "</textarea>",
            "_rawOuter": undefined,
            "_reparseSource": undefined,
            "_verbatim": true,
            "attrs": {},
            "children": [],
            "tag": "textarea",
            "text": 
        "*foo*

        _bar_"
        ,
            "type": "htmlBlock",
          },
          {
            "children": [
              {
                "text": "baz",
                "type": "text",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('md4c#210: nested image in image alt text', () => {
      const result = p.parser(
        '![outer ![inner](img_inner "inner title")](img_outer "outer title")'
      )
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "children": [
              {
                "alt": "outer inner",
                "target": "img_outer",
                "title": "outer title",
                "type": "image",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('md4c#215: setext heading underline with trailing tab', () => {
      const result = p.parser('title\n--\t')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "children": [
              {
                "text": "title",
                "type": "text",
              },
            ],
            "id": "title",
            "level": 2,
            "type": "heading",
          },
        ]
      `)
    })

    it('md4c#216: inline HTML declaration <!A>', () => {
      const result = p.parser('x <!A>')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "children": [
              {
                "text": "x ",
                "type": "text",
              },
              {
                "_endsWithGT": false,
                "raw": true,
                "text": "<!A>",
                "type": "htmlComment",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('md4c#217: emphasis __!_!__', () => {
      const result = p.parser('__!_!__')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "children": [
              {
                "children": [
                  {
                    "text": "!",
                    "type": "text",
                  },
                  {
                    "text": "_",
                    "type": "text",
                  },
                  {
                    "text": "!",
                    "type": "text",
                  },
                ],
                "tag": "strong",
                "type": "textFormatted",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('md4c#217: emphasis __!x!__', () => {
      const result = p.parser('__!x!__')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "children": [
              {
                "children": [
                  {
                    "text": "!x!",
                    "type": "text",
                  },
                ],
                "tag": "strong",
                "type": "textFormatted",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('md4c#217: emphasis **!*!**', () => {
      const result = p.parser('**!*!**')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "children": [
              {
                "children": [
                  {
                    "text": "!",
                    "type": "text",
                  },
                  {
                    "text": "*",
                    "type": "text",
                  },
                  {
                    "text": "!",
                    "type": "text",
                  },
                ],
                "tag": "strong",
                "type": "textFormatted",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('md4c#217: emphasis _*__*_*', () => {
      const result = p.parser('_*__*_*')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "children": [
              {
                "children": [
                  {
                    "children": [
                      {
                        "text": "__",
                        "type": "text",
                      },
                    ],
                    "tag": "em",
                    "type": "textFormatted",
                  },
                ],
                "tag": "em",
                "type": "textFormatted",
              },
              {
                "text": "*",
                "type": "text",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('md4c#217: emphasis _*xx*_*', () => {
      const result = p.parser('_*xx*_*')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "children": [
              {
                "children": [
                  {
                    "children": [
                      {
                        "text": "xx",
                        "type": "text",
                      },
                    ],
                    "tag": "em",
                    "type": "textFormatted",
                  },
                ],
                "tag": "em",
                "type": "textFormatted",
              },
              {
                "text": "*",
                "type": "text",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('md4c#217: emphasis _*__-_-', () => {
      const result = p.parser('_*__-_-')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "children": [
              {
                "children": [
                  {
                    "text": "*",
                    "type": "text",
                  },
                  {
                    "text": "__",
                    "type": "text",
                  },
                  {
                    "text": "-",
                    "type": "text",
                  },
                ],
                "tag": "em",
                "type": "textFormatted",
              },
              {
                "text": "-",
                "type": "text",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('md4c#217: emphasis _*xx-_-', () => {
      const result = p.parser('_*xx-_-')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "children": [
              {
                "children": [
                  {
                    "text": "*",
                    "type": "text",
                  },
                  {
                    "text": "xx-",
                    "type": "text",
                  },
                ],
                "tag": "em",
                "type": "textFormatted",
              },
              {
                "text": "-",
                "type": "text",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('md4c#222: strikethrough not opening mid-word', () => {
      const result = p.parser('~~foo ~~bar baz~~')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "children": [
              {
                "text": "~~foo ",
                "type": "text",
              },
              {
                "children": [
                  {
                    "text": "bar baz",
                    "type": "text",
                  },
                ],
                "tag": "del",
                "type": "textFormatted",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('md4c#223: code span with leading newline', () => {
      const result = p.parser('`\nfoo`')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "children": [
              {
                "text": " foo",
                "type": "codeInline",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('md4c#223: code span with trailing newline', () => {
      const result = p.parser('`foo\n`')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "children": [
              {
                "text": "foo ",
                "type": "codeInline",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('md4c#223: code span with both leading and trailing newlines', () => {
      const result = p.parser('`\nfoo\n`')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "children": [
              {
                "text": "foo",
                "type": "codeInline",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('md4c#242: tildes in file paths not strikethrough', () => {
      const result = p.parser('copy ~user1/file to ~user2/file')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "children": [
              {
                "text": "copy ~user1/file to ~user2/file",
                "type": "text",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('GFM: a task marker needs whitespace and then content after it, and the whitespace stays inline', () => {
      expect(
        p.parser(
          '- [x]foo\n- [ ]\n- [x] \n- [X]\tbaz\n- [x]     five\n- [x]\nlazy'
        )
      ).toMatchInlineSnapshot(`
        [
          {
            "items": [
              [
                {
                  "text": "[x]foo",
                  "type": "text",
                },
              ],
              [
                {
                  "text": "[ ]",
                  "type": "text",
                },
              ],
              [
                {
                  "text": "[x]",
                  "type": "text",
                },
              ],
              [
                {
                  "completed": true,
                  "type": "gfmTask",
                },
                {
                  "text": " ",
                  "type": "text",
                },
                {
                  "text": "baz",
                  "type": "text",
                },
              ],
              [
                {
                  "completed": true,
                  "type": "gfmTask",
                },
                {
                  "text": " ",
                  "type": "text",
                },
                {
                  "text": "five",
                  "type": "text",
                },
              ],
              [
                {
                  "completed": true,
                  "type": "gfmTask",
                },
                {
                  "text": " ",
                  "type": "text",
                },
                {
                  "text": "lazy",
                  "type": "text",
                },
              ],
            ],
            "type": "unorderedList",
          },
        ]
      `)
    })

    it('GFM: the rest of a task marker line is paragraph text, never a block', () => {
      expect(
        p.parser('- [x] # h\n- [x] > q\n- [x] 1. n\n- [x] ***\n- [x] [y]: /u')
      ).toMatchInlineSnapshot(`
        [
          {
            "items": [
              [
                {
                  "completed": true,
                  "type": "gfmTask",
                },
                {
                  "text": " ",
                  "type": "text",
                },
                {
                  "text": "# h",
                  "type": "text",
                },
              ],
              [
                {
                  "completed": true,
                  "type": "gfmTask",
                },
                {
                  "text": " ",
                  "type": "text",
                },
                {
                  "text": "> q",
                  "type": "text",
                },
              ],
              [
                {
                  "completed": true,
                  "type": "gfmTask",
                },
                {
                  "text": " ",
                  "type": "text",
                },
                {
                  "text": "1. n",
                  "type": "text",
                },
              ],
              [
                {
                  "completed": true,
                  "type": "gfmTask",
                },
                {
                  "text": " ",
                  "type": "text",
                },
                {
                  "text": "***",
                  "type": "text",
                },
              ],
              [
                {
                  "completed": true,
                  "type": "gfmTask",
                },
                {
                  "text": " ",
                  "type": "text",
                },
                {
                  "text": "[y]: /u",
                  "type": "text",
                },
              ],
            ],
            "type": "unorderedList",
          },
        ]
      `)
    })

    it('GFM: a task marker alone on its line needs its paragraph to continue', () => {
      expect([
        p.parser('- [x]\n\n  foo'),
        p.parser('- [x]\n  # h'),
      ]).toMatchInlineSnapshot(`
        [
          [
            {
              "items": [
                [
                  {
                    "children": [
                      {
                        "text": "[x]",
                        "type": "text",
                      },
                    ],
                    "type": "paragraph",
                  },
                  {
                    "children": [
                      {
                        "text": "foo",
                        "type": "text",
                      },
                    ],
                    "type": "paragraph",
                  },
                ],
              ],
              "type": "unorderedList",
            },
          ],
          [
            {
              "items": [
                [
                  {
                    "text": "[x]",
                    "type": "text",
                  },
                  {
                    "children": [
                      {
                        "text": "h",
                        "type": "text",
                      },
                    ],
                    "id": "h",
                    "level": 1,
                    "type": "heading",
                  },
                ],
              ],
              "type": "unorderedList",
            },
          ],
        ]
      `)
    })

    it('GFM: a task marker followed by a colon is a link reference definition', () => {
      expect(p.parser('- [x]: /url\n\n[x]')).toMatchInlineSnapshot(`
        [
          {
            "refs": {
              "x": {
                "target": "/url",
                "title": undefined,
              },
            },
            "type": "refCollection",
          },
          {
            "items": [
              [],
            ],
            "type": "unorderedList",
          },
          {
            "children": [
              {
                "children": [
                  {
                    "text": "x",
                    "type": "text",
                  },
                ],
                "target": "/url",
                "title": undefined,
                "type": "link",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('GFM: tilde runs longer than two do not strike through', () => {
      expect(p.parser('a ~~~c~~~ b ~~~~ ~~d~~~e~~')).toMatchInlineSnapshot(`
        [
          {
            "children": [
              {
                "text": "a ~~~c~~~ b ~~~~ ",
                "type": "text",
              },
              {
                "children": [
                  {
                    "text": "d~~~e",
                    "type": "text",
                  },
                ],
                "tag": "del",
                "type": "textFormatted",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('GFM: strikethrough and mark need flanking runs of exactly two', () => {
      expect(p.parser('~~a ~~')).toMatchInlineSnapshot(`
        [
          {
            "children": [
              {
                "text": "~~a ~~",
                "type": "text",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
      expect(p.parser('a ===c=== b ==d===e==')).toMatchInlineSnapshot(`
        [
          {
            "children": [
              {
                "text": "a ===c=== b ",
                "type": "text",
              },
              {
                "children": [
                  {
                    "text": "d===e",
                    "type": "text",
                  },
                ],
                "tag": "mark",
                "type": "textFormatted",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
      expect(p.parser('~~a ~~b~~ c~~')).toMatchInlineSnapshot(`
        [
          {
            "children": [
              {
                "children": [
                  {
                    "text": "a ",
                    "type": "text",
                  },
                  {
                    "children": [
                      {
                        "text": "b",
                        "type": "text",
                      },
                    ],
                    "tag": "del",
                    "type": "textFormatted",
                  },
                  {
                    "text": " c",
                    "type": "text",
                  },
                ],
                "tag": "del",
                "type": "textFormatted",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('md4c#248: ATX heading with tab after #', () => {
      const result = p.parser('#\tFoo')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "children": [
              {
                "text": "Foo",
                "type": "text",
              },
            ],
            "id": "foo",
            "level": 1,
            "type": "heading",
          },
        ]
      `)
    })

    it('md4c#248: setext heading with tab in content', () => {
      const result = p.parser('  Foo *bar\nbaz*\t\n====')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "children": [
              {
                "text": "Foo ",
                "type": "text",
              },
              {
                "children": [
                  {
                    "text": 
        "bar
        baz"
        ,
                    "type": "text",
                  },
                ],
                "tag": "em",
                "type": "textFormatted",
              },
            ],
            "id": "foo-barbaz",
            "level": 1,
            "type": "heading",
          },
        ]
      `)
    })

    it('md4c#250: space+space+tab+newline is not hard break', () => {
      const result = p.parser('foo  \t\nbar')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "children": [
              {
                "text": 
        "foo  	
        bar"
        ,
                "type": "text",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('md4c#250: tab+space+space+newline is hard break', () => {
      const result = p.parser('foo\t  \nbar')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "children": [
              {
                "text": "foo	",
                "type": "text",
              },
              {
                "type": "breakLine",
              },
              {
                "text": "bar",
                "type": "text",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('emphasis can close before a hard break (two trailing spaces) (issue #830)', () => {
      const result = p.parser('**TEST:**  \nTEST')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "children": [
              {
                "children": [
                  {
                    "text": "TEST:",
                    "type": "text",
                  },
                ],
                "tag": "strong",
                "type": "textFormatted",
              },
              {
                "type": "breakLine",
              },
              {
                "text": "TEST",
                "type": "text",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('backslash-escaped underscores become literal text inside emphasis, while the outer unescaped underscore delimiters still form emphasis (issue #271)', () => {
      const result = p.parser('_{over\\_flow}_')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "children": [
              {
                "children": [
                  {
                    "text": "{over",
                    "type": "text",
                  },
                  {
                    "text": "_",
                    "type": "text",
                  },
                  {
                    "text": "flow}",
                    "type": "text",
                  },
                ],
                "tag": "em",
                "type": "textFormatted",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('all underscores escaped produces literal text, preventing emphasis entirely (issue #271)', () => {
      const result = p.parser('\\_test\\_')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "children": [
              {
                "text": "_",
                "type": "text",
              },
              {
                "text": "test",
                "type": "text",
              },
              {
                "text": "_",
                "type": "text",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('escaped underscore inside emphasis is literal (issue #271)', () => {
      const result = p.parser('*foo\\_bar*')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "children": [
              {
                "children": [
                  {
                    "text": "foo",
                    "type": "text",
                  },
                  {
                    "text": "_",
                    "type": "text",
                  },
                  {
                    "text": "bar",
                    "type": "text",
                  },
                ],
                "tag": "em",
                "type": "textFormatted",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('all three underscores escaped produces all literal text, the fully escaped example from issue #271', () => {
      const result = p.parser('\\_{over\\_flow}\\_')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "children": [
              {
                "text": "_",
                "type": "text",
              },
              {
                "text": "{over",
                "type": "text",
              },
              {
                "text": "_",
                "type": "text",
              },
              {
                "text": "flow}",
                "type": "text",
              },
              {
                "text": "_",
                "type": "text",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })

    it('emphasis can close before a hard break (backslash)', () => {
      const result = p.parser('**TEST:**\\\nTEST')
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "children": [
              {
                "children": [
                  {
                    "text": "TEST:",
                    "type": "text",
                  },
                ],
                "tag": "strong",
                "type": "textFormatted",
              },
              {
                "type": "breakLine",
              },
              {
                "text": "TEST",
                "type": "text",
              },
            ],
            "type": "paragraph",
          },
        ]
      `)
    })
  })
})

describe('forward reference resolution: definitions may appear anywhere in the document, including after their first use inside nested containers, so every inline parse context sees the complete refs collection', () => {
  function findLinks(
    nodes: MarkdownToJSX.ASTNode[]
  ): { target: string; text: string }[] {
    const out: { target: string; text: string }[] = []
    const walk = (ns: MarkdownToJSX.ASTNode[]) => {
      for (const n of ns as any[]) {
        if (!n || typeof n !== 'object') {
          continue
        }
        if (n.type === RuleType.link) {
          out.push({ target: n.target, text: n.children?.[0]?.text })
        }
        if (Array.isArray(n.children)) {
          walk(n.children)
        }
        if (Array.isArray(n.items)) {
          for (const item of n.items) {
            walk(item)
          }
        }
        if (Array.isArray(n.header)) {
          for (const cell of n.header) {
            walk(cell)
          }
        }
        if (Array.isArray(n.cells)) {
          for (const row of n.cells) {
            for (const cell of row) {
              walk(cell)
            }
          }
        }
      }
    }
    walk(nodes)
    return out
  }

  const expected = [{ target: '/url', text: 'foo' }]

  it('resolves in a paragraph', () => {
    expect(findLinks(p.parser('[foo]\n\n[foo]: /url'))).toEqual(expected)
  })

  it('resolves in a heading', () => {
    expect(findLinks(p.parser('# [foo]\n\n[foo]: /url'))).toEqual(expected)
  })

  it('resolves in a blockquote', () => {
    expect(findLinks(p.parser('> [foo]\n\n[foo]: /url'))).toEqual(expected)
  })

  it('resolves in a tight list item', () => {
    expect(findLinks(p.parser('- [foo]\n\n[foo]: /url'))).toEqual(expected)
  })

  it('resolves in a loose list item', () => {
    expect(findLinks(p.parser('- [foo]\n\n- bar\n\n[foo]: /url'))).toEqual(
      expected
    )
  })

  it('resolves in a multi-block tight list item', () => {
    expect(findLinks(p.parser('- [foo]\n  > quote\n\n[foo]: /url'))).toEqual(
      expected
    )
  })

  it('resolves in a task list item', () => {
    expect(findLinks(p.parser('- [x] [foo]\n\n[foo]: /url'))).toEqual(expected)
  })

  it('resolves in a table cell', () => {
    expect(
      findLinks(p.parser('| [foo] |\n| --- |\n| [foo] |\n\n[foo]: /url'))
    ).toEqual([...expected, ...expected])
  })

  it('resolves in an HTML block', () => {
    expect(findLinks(p.parser('<div>[foo]</div>\n\n[foo]: /url'))).toEqual(
      expected
    )
  })

  it('resolves in nested list inside blockquote', () => {
    expect(findLinks(p.parser('> - [foo]\n\n[foo]: /url'))).toEqual(expected)
  })
})

describe('unique heading IDs (#857)', () => {
  function headingIds(nodes: MarkdownToJSX.ASTNode[]): string[] {
    const ids: string[] = []
    const walk = (ns: MarkdownToJSX.ASTNode[]) => {
      for (const n of ns) {
        if (n.type === RuleType.heading) {
          ids.push(n.id)
        }
        if ('children' in n && Array.isArray(n.children)) {
          walk(n.children)
        }
        if (
          'items' in n &&
          Array.isArray((n as MarkdownToJSX.OrderedListNode).items)
        ) {
          for (const item of (n as MarkdownToJSX.OrderedListNode).items) {
            walk(item)
          }
        }
      }
    }
    walk(nodes)
    return ids
  }

  it('suffixes duplicate ATX headings in source order', () => {
    expect(
      headingIds(
        p.parser(`# Foo

# Bar

## Foo

# Foo`)
      )
    ).toEqual(['foo', 'bar', 'foo-1', 'foo-2'])
  })

  it('suffixes duplicate setext headings', () => {
    expect(
      headingIds(
        p.parser(`Foo
===

Foo
---`)
      )
    ).toEqual(['foo', 'foo-1'])
  })

  it('skips an occupied numeric suffix (Foo, Foo-1, Foo)', () => {
    expect(
      headingIds(
        p.parser(`# Foo

# Foo-1

# Foo`)
      )
    ).toEqual(['foo', 'foo-1', 'foo-2'])
  })

  it.each([
    '# !!!',
    '# `]`',
  ])('keeps the empty id of %j, a heading with an empty slug', input => {
    expect(headingIds(p.parser(input))).toEqual([''])
  })

  it('dedupes headings nested in blockquote, list, and HTML', () => {
    expect(
      headingIds(
        p.parser(`# Foo

> # Foo

- # Foo

<div>

# Foo

</div>`)
      )
    ).toEqual(['foo', 'foo-1', 'foo-2', 'foo-3'])
  })

  it('dedupes collisions from a custom slugify', () => {
    expect(
      headingIds(
        p.parser(
          `# Alpha

# Beta`,
          {
            slugify: () => 'same',
          }
        )
      )
    ).toEqual(['same', 'same-1'])
  })

  it('leaves empty slugify results empty without inventing a suffix', () => {
    expect(
      headingIds(
        p.parser(
          `# One

# Two`,
          {
            slugify: () => '',
          }
        )
      )
    ).toEqual(['', ''])
  })

  it('starts fresh on each top-level parser call', () => {
    const first = headingIds(p.parser('# Foo\n\n# Foo'))
    const second = headingIds(p.parser('# Foo\n\n# Foo'))
    expect(first).toEqual(['foo', 'foo-1'])
    expect(second).toEqual(['foo', 'foo-1'])
  })

  it('slugs link text without the destination, since slugs use flattened inline text (GitHub / rehype-slug) rather than raw source', () => {
    expect(headingIds(p.parser('## [text](https://e.com)'))).toEqual(['text'])
  })

  it('slugs strong and code without their markers', () => {
    expect(headingIds(p.parser('## **bold** text'))).toEqual(['bold-text'])
    expect(headingIds(p.parser('## `code` here'))).toEqual(['code-here'])
  })

  it('omits image alt from heading slugs', () => {
    expect(headingIds(p.parser('## ![alt](https://i/x.png)'))).toEqual([''])
    expect(headingIds(p.parser('## text ![alt](https://i/x.png)'))).toEqual([
      'text-',
    ])
  })

  it('includes footnote reference display text in the slug', () => {
    expect(headingIds(p.parser('# H[^1]\n\n[^1]: body'))).toEqual(['h1'])
  })

  it('slugs angle autolink visible text', () => {
    expect(headingIds(p.parser('## <https://example.com>'))).toEqual([
      'httpsexamplecom',
    ])
  })

  it('slugs decoded entities in heading text', () => {
    expect(headingIds(p.parser('## a &amp; b'))).toEqual(['a--b'])
  })
})

describe('destination entity decode before sanitize', () => {
  function linkTarget(md: string): string | null | undefined {
    const nodes = p.parser(md)
    const walk = (ns: MarkdownToJSX.ASTNode[]): string | null | undefined => {
      for (const n of ns) {
        if (n.type === RuleType.link || n.type === RuleType.image) {
          return (n as MarkdownToJSX.LinkNode).target
        }
        if ('children' in n && Array.isArray(n.children)) {
          const found = walk(n.children)
          if (found !== undefined) {
            return found
          }
        }
      }
    }
    return walk(nodes)
  }

  it('nulls entity-obfuscated javascript: link destinations', () => {
    expect(linkTarget('[x](&#106;avascript:alert(1))')).toBe(null)
    expect(linkTarget('[x](jav&#x61;script:alert(1))')).toBe(null)
  })

  it('nulls rejected image destinations (ImageNode.target is string | null, and null round-trips as ![alt]() in markdown)', () => {
    expect(linkTarget('![x](&#106;avascript:alert(1))')).toBe(null)
    expect(linkTarget('![x](javascript:alert(1) "t")')).toBe(null)
    expect(linkTarget('![x][r]\n\n[r]: javascript:alert(1)')).toBe(null)
  })

  it('nulls entity-obfuscated javascript: reference link destinations', () => {
    expect(linkTarget('[x][r]\n\n[r]: &#106;avascript:alert(1)')).toBe(null)
  })

  it('keeps valid empty destinations and safe URLs', () => {
    expect(linkTarget('![x]()')).toBe('')
    expect(linkTarget('[x]()')).toBe('')
    expect(linkTarget('[x](https://e.com)')).toBe('https://e.com')
    expect(linkTarget('![x](https://e.com)')).toBe('https://e.com')
  })

  it('keeps a decoded control character in an image destination for the emitters to encode', () => {
    expect(linkTarget('![x](java&#1;script:alert(1))')).toBe(
      'java\u0001script:alert(1)'
    )
    expect(linkTarget('[x](java&#1;script:alert(1))')).toBe(
      'java\u0001script:alert(1)'
    )
  })

  it.each([
    ['0;url=javascript:alert(1)'],
    ['0;URL=javascript:alert(1)'],
    ["0; url = 'javascript:alert(1)'"],
    ['0;url=&#106;avascript:alert(1)'],
    ['0;url=java%73cript:alert(1)'],
    ['0; url=data:text/html,x'],
    ['0;javascript:alert(1)'],
  ])('drops a meta refresh content whose URL is dangerous: %s', content => {
    const node = p.parser(
      `<meta http-equiv="refresh" content="${content}">`
    )[0] as MarkdownToJSX.HTMLNode
    expect(node.attrs).toEqual({ 'http-equiv': 'refresh' })
  })

  it('keeps a meta refresh content whose URL is safe', () => {
    const node = p.parser(
      '<meta http-equiv="refresh" content="0;url=https://x.y">'
    )[0] as MarkdownToJSX.HTMLNode
    expect(node.attrs).toEqual({
      content: '0;url=https://x.y',
      'http-equiv': 'refresh',
    })
  })

  it('discards rewritten sanitizer returns at parse time, so the parse keeps the original decoded destination and emit applies transforms', () => {
    var calls = 0
    const rewritten = p.parser('[x](https://e.com)', {
      sanitizer: () => {
        calls++
        return 'https://rewritten.example'
      },
    })
    expect(calls).toBe(1)
    const walk = (ns: MarkdownToJSX.ASTNode[]): string | null | undefined => {
      for (const n of ns) {
        if (n.type === RuleType.link) {
          return (n as MarkdownToJSX.LinkNode).target
        }
        if ('children' in n && Array.isArray(n.children)) {
          const found = walk(n.children)
          if (found !== undefined) {
            return found
          }
        }
      }
    }
    expect(walk(rewritten)).toBe('https://e.com')
  })
})

describe('inline Type 1 htmlBlock shape', () => {
  it('emits verbatim Type 1 nodes for single-line script under inline mode', () => {
    const state = createInlineState()
    const options = createDefaultOptions()
    const result = p.parseMarkdown(
      '<script>x</script>',
      state,
      options
    ) as MarkdownToJSX.ASTNode[]
    const node = result[0] as MarkdownToJSX.HTMLNode
    expect(node.type).toBe(RuleType.htmlBlock)
    expect(node.tag).toBe('script')
    expect(node._verbatim).toBe(true)
    expect(node._rawBody).toBe('x')
    expect(node._rawClose).toBe('</script>')
    expect(node.children).toEqual([])
  })
})

describe('component-like HTML blank-line nesting (#870)', () => {
  it('nests heading and paragraph inside a PascalCase component', () => {
    const result = p.parser(`<MyComponent>
## My header

Some paragraph
</MyComponent>`)
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "_isClosingTag": false,
          "_rawAttrs": "",
          "_rawBody": undefined,
          "_reparseSource": undefined,
          "_verbatim": false,
          "attrs": {},
          "children": [
            {
              "children": [
                {
                  "text": "My header",
                  "type": "text",
                },
              ],
              "id": "my-header",
              "level": 2,
              "type": "heading",
            },
            {
              "children": [
                {
                  "text": "Some paragraph",
                  "type": "text",
                },
              ],
              "type": "paragraph",
            },
          ],
          "tag": "MyComponent",
          "text": 
      "
      ## My header

      Some paragraph
      "
      ,
          "type": "htmlBlock",
        },
      ]
    `)
  })

  it('still nests known block tags and Figure', () => {
    for (const tag of ['div', 'Figure']) {
      const result = p.parser(`<${tag}>
## My header

Some paragraph
</${tag}>`)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(RuleType.htmlBlock)
      const html = result[0] as MarkdownToJSX.HTMLNode
      expect(html.tag).toBe(tag)
      expect(html.children).toHaveLength(2)
      expect(html.children?.[0].type).toBe(RuleType.heading)
      expect(html.children?.[1].type).toBe(RuleType.paragraph)
    }
  })

  it('nests hyphenated custom elements across a blank line', () => {
    const result = p.parser(`<my-widget>
## My header

Some paragraph
</my-widget>`)
    expect(result).toHaveLength(1)
    const html = result[0] as MarkdownToJSX.HTMLNode
    expect(html.tag).toBe('my-widget')
    expect(html.children).toHaveLength(2)
    expect(html.children?.[0].type).toBe(RuleType.heading)
    expect(html.children?.[1].type).toBe(RuleType.paragraph)
  })

  it('keeps lowercase unknown tags as Type 7 stopping at the blank line', () => {
    const result = p.parser(`<widget>
## My header

Some paragraph
</widget>`)
    expect(result.length).toBeGreaterThan(1)
    expect(result[0].type).toBe(RuleType.htmlBlock)
    expect((result[0] as MarkdownToJSX.HTMLNode).tag).toBe('widget')
  })

  it('does not parse markdown inside a component with no blank lines (#860)', () => {
    const result = p.parser(`<MyComponent>
*Emphasized* text.
</MyComponent>`)
    expect(result).toHaveLength(1)
    const html = result[0] as MarkdownToJSX.HTMLNode
    expect(html.tag).toBe('MyComponent')
    expect(html.children).toEqual([
      { type: RuleType.text, text: '*Emphasized* text.' },
    ])
  })
})

describe('inline HTML keeps the spaces at the edges of its content (#904)', () => {
  const htmlChildren = (input: string, options = {}) => {
    const [first] = p.parser(input, options) as MarkdownToJSX.ParagraphNode[]
    const span = first.children.find(
      n => n.type === RuleType.htmlBlock
    ) as MarkdownToJSX.HTMLNode
    return span.children ?? []
  }

  it.each([
    {},
    { optimizeForStreaming: true },
  ])('keeps leading and trailing spaces between the tags (%o)', options => {
    expect(htmlChildren('a<span> b </span>c', options)).toEqual([
      { type: RuleType.text, text: ' b ' },
    ])
    expect(htmlChildren('<b>bold </b>next', options)).toEqual([
      { type: RuleType.text, text: 'bold ' },
    ])
  })

  it('keeps a whitespace-only body', () => {
    expect(htmlChildren('a<span> </span>b')).toEqual([
      { type: RuleType.text, text: ' ' },
    ])
  })

  it('keeps the spaces around a nested element', () => {
    const children = htmlChildren('a<span> <em>x</em> </span>b')

    expect(children.map(n => n.type)).toEqual([
      RuleType.text,
      RuleType.htmlBlock,
      RuleType.text,
    ])
    expect((children[0] as MarkdownToJSX.TextNode).text).toBe(' ')
    expect((children[2] as MarkdownToJSX.TextNode).text).toBe(' ')
  })
})

describe('enforceAtxHeadings (#903)', () => {
  const types = (input: string, options?: { enforceAtxHeadings?: boolean }) =>
    p.parser(input, options).map(n => n.type)

  it.each([
    undefined,
    true,
  ])('requires a space after the # run when the option is %s', enforceAtxHeadings => {
    const options = { enforceAtxHeadings }

    expect(types('#heading', options)).toEqual([RuleType.paragraph])
    expect(types('foo\n#bar', options)).toEqual([RuleType.paragraph])
    expect(types('# heading', options)).toEqual([RuleType.heading])
  })

  it('reads #heading as a heading when the option is false', () => {
    const options = { enforceAtxHeadings: false }
    const [heading] = p.parser(
      '#heading',
      options
    ) as MarkdownToJSX.HeadingNode[]

    expect(heading.type).toBe(RuleType.heading)
    expect(heading.level).toBe(1)
    expect(heading.children).toEqual([{ type: RuleType.text, text: 'heading' }])
    expect(types('# heading', options)).toEqual([RuleType.heading])
  })

  it('lets #bar interrupt a paragraph when the option is false', () => {
    const options = { enforceAtxHeadings: false }

    expect(types('foo\n#bar', options)).toEqual(types('foo\n# bar', options))
    expect(types('foo\n#bar', options)).toEqual([
      RuleType.paragraph,
      RuleType.heading,
    ])
  })

  it('reads #bar as a heading inside list items and blockquotes when the option is false', () => {
    const options = { enforceAtxHeadings: false }

    expect(JSON.stringify(p.parser('- #bar', options))).toBe(
      JSON.stringify(p.parser('- # bar', options))
    )
    expect(JSON.stringify(p.parser('> #bar', options))).toBe(
      JSON.stringify(p.parser('> # bar', options))
    )
  })

  it('reads #bar inside inline HTML blocks as a heading when the option is false', () => {
    const options = { enforceAtxHeadings: false }

    const spanChildren = (input: string) =>
      (
        (p.parser(input, options)[0] as MarkdownToJSX.ParagraphNode)
          .children[1] as MarkdownToJSX.HTMLNode
      ).children

    expect(spanChildren('a<span>#bar</span>c')).toEqual(
      spanChildren('a<span># bar</span>c')
    )
    expect(spanChildren('a<span>#bar</span>c')?.[0].type).toBe(RuleType.heading)
  })

  it('keeps more than six # characters as text when the option is false', () => {
    expect(types('#######x', { enforceAtxHeadings: false })).toEqual([
      RuleType.paragraph,
    ])
  })

  it('treats #bar like a heading line for reference definitions when the option is false', () => {
    const options = { enforceAtxHeadings: false }

    expect(types('[a]: /x\n#bar\n[b]: /y\n\n[a][b]', options)).toEqual(
      types('[a]: /x\n# bar\n[b]: /y\n\n[a][b]', options)
    )
  })

  it('treats #bar like a heading while streaming when the option is false', () => {
    const options = { enforceAtxHeadings: false, optimizeForStreaming: true }

    expect(types('foo\n#bar', options)).toEqual(types('foo\n# bar', options))
  })

  it.each([
    undefined,
    true,
    false,
  ])('keeps a lone # inside inline HTML as text when the option is %s', enforceAtxHeadings => {
    const [paragraph] = p.parser('a<span>#</span>b', {
      enforceAtxHeadings,
    }) as MarkdownToJSX.ParagraphNode[]
    const span = paragraph.children[1] as MarkdownToJSX.HTMLNode

    expect(span.children).toEqual([{ type: RuleType.text, text: '#' }])
  })

  it('keeps <span>#x</span> as a span holding text by default and a heading when the option is false', () => {
    const spanChildren = (options?: { enforceAtxHeadings?: boolean }) =>
      (
        (p.parser('<span>#x</span>', options)[0] as MarkdownToJSX.ParagraphNode)
          .children[0] as MarkdownToJSX.HTMLNode
      ).children

    expect(spanChildren()).toEqual([{ type: RuleType.text, text: '#x' }])
    expect(spanChildren({ enforceAtxHeadings: true })).toEqual([
      { type: RuleType.text, text: '#x' },
    ])
    expect(spanChildren({ enforceAtxHeadings: false })?.[0].type).toBe(
      RuleType.heading
    )
  })

  it.each([
    ['<div>\n#x\n</div>', 1],
    ['<div>\n ## y\n</div>', 2],
    ['<section>\n#x\n</section>', 1],
  ] as const)('block-parses %j as a level %i heading inside HTML when the option is false', (input, level) => {
    const tag = input.slice(1, input.indexOf('>'))
    const relaxed = p.parser(input, {
      enforceAtxHeadings: false,
    }) as MarkdownToJSX.HTMLNode[]
    const heading = relaxed[0].children?.[0] as MarkdownToJSX.HeadingNode

    expect(relaxed[0].tag).toBe(tag)
    expect(relaxed[0].children).toHaveLength(1)
    expect(heading.type).toBe(RuleType.heading)
    expect(heading.level).toBe(level)
  })

  it('keeps #x inside block HTML as text by default', () => {
    for (const enforceAtxHeadings of [undefined, true]) {
      const [div] = p.parser('<div>\n#x\n</div>', {
        enforceAtxHeadings,
      }) as MarkdownToJSX.HTMLNode[]

      expect(div.children).toEqual([{ type: RuleType.text, text: '#x' }])
    }
  })

  it('reads ## y inside block HTML as a heading in every mode', () => {
    for (const enforceAtxHeadings of [undefined, true, false]) {
      const [div] = p.parser('<div>\n ## y\n</div>', {
        enforceAtxHeadings,
      }) as MarkdownToJSX.HTMLNode[]

      expect(div.children?.[0].type).toBe(RuleType.heading)
    }
  })

  it('never reads a run of seven # characters inside block HTML as a heading, with the same result in every mode', () => {
    for (const enforceAtxHeadings of [undefined, true, false]) {
      const [div] = p.parser('<div>\n#######x\n</div>', {
        enforceAtxHeadings,
      }) as MarkdownToJSX.HTMLNode[]

      expect(div.children).toEqual([
        {
          type: RuleType.paragraph,
          children: [{ type: RuleType.text, text: '#######x' }],
        },
      ])
    }
  })

  it('reads ##x as a level 2 heading when the option is false', () => {
    const [heading] = p.parser('##x', {
      enforceAtxHeadings: false,
    }) as MarkdownToJSX.HeadingNode[]

    expect(heading.type).toBe(RuleType.heading)
    expect(heading.level).toBe(2)
    expect(heading.children).toEqual([{ type: RuleType.text, text: 'x' }])
  })

  it.each([
    undefined,
    false,
  ])('reads a lone # as an empty level 1 heading when the option is %s', enforceAtxHeadings => {
    expect(p.parser('#', { enforceAtxHeadings })).toEqual([
      { type: RuleType.heading, level: 1, children: [], id: '' },
    ])
  })

  it.each([
    undefined,
    false,
  ])('never reads a lone ####### as a heading when the option is %s', enforceAtxHeadings => {
    expect(types('#######', { enforceAtxHeadings })).toEqual([
      RuleType.paragraph,
    ])
  })
})

const attrsOf = (source: string, options?: Parameters<typeof p.parser>[1]) =>
  (p.parser(source, options)[0] as MarkdownToJSX.HTMLNode).attrs

describe('table cell pipe escapes', () => {
  it.each([
    ['a\\|b', ['a|b', 'z']],
    ['a\\\\\\|b', ['a\\|b', 'z']],
    ['a\\\\b', ['a\\b', 'z']],
    ['a\\\\|b', ['a\\', 'b']],
  ])('reads the row cell %j as the cell texts %j', (cell, expected) => {
    const table = p.parser(
      `| h | i |\n|---|---|\n| ${cell} | z |`
    )[0] as MarkdownToJSX.TableNode
    expect(
      table.cells[0].map(nodes =>
        nodes
          .map(node => (node.type === RuleType.text ? node.text : ''))
          .join('')
      )
    ).toEqual(expected)
  })
})

describe('attribute names a renderer acts on rather than writes', () => {
  it.each([
    '<div innerHTML="x">y</div>',
    '<div INNERHTML="x">y</div>',
    '<div outerHTML="x">y</div>',
    '<div dangerouslySetInnerHTML="x">y</div>',
    '<div dangerouslySetInnerHTML={{"__html":"x"}}>y</div>',
    '<div ref="x">y</div>',
    '<div ref={x}>y</div>',
    '<div children="x">y</div>',
    '<div prop:innerHTML="x">y</div>',
    '<div attr:onclick="x">y</div>',
    '<div bool:onclick="x">y</div>',
    '<div prop:onclick="x">y</div>',
    '<div attr:srcdoc="x">y</div>',
    '<div attr:href="javascript:x">y</div>',
    '<div prop:href="javascript:x">y</div>',
    '<div xlinkHref="javascript:x">y</div>',
    '<div attr:xlink:href="javascript:x">y</div>',
    '<Foo innerHTML={x}>y</Foo>',
    '<Foo outerHTML={x}>y</Foo>',
    '<Foo dangerouslySetInnerHTML={{"__html":"x"}}>y</Foo>',
    '<Foo ref={x}>y</Foo>',
    '<Foo children="x">y</Foo>',
    '<Foo children={x}>y</Foo>',
    '<Foo children={{"a":1}}>y</Foo>',
    '<my-el children="x">y</my-el>',
  ])('removes the attribute from %j', source => {
    expect(attrsOf(source)).toEqual({})
  })

  it.each([
    ['attr:title="x"', { 'attr:title': 'x' }],
    ['prop:title="x"', { 'prop:title': 'x' }],
    ['attr:href="/x"', { 'attr:href': '/x' }],
    ['xlinkHref="/x"', { xlinkHref: '/x' }],
    ['textContent="x"', { textContent: 'x' }],
    ['key="x"', { key: 'x' }],
  ])('keeps %s on an element', (attribute, attrs) => {
    expect(attrsOf(`<div ${attribute}>y</div>`)).toEqual(attrs)
  })

  it.each([
    ['<div innerHTML="x">y</div>', '<div >y</div>'],
    ['<div attr:onclick="x">y</div>', '<div >y</div>'],
    ['<b ref="x" title="y">z</b>', '<b title="y">z</b>'],
    [
      '<img src=x onerror="y"><b title="z">w</b>',
      '<img src=x><b title="z">w</b>',
    ],
  ])('removes it from the raw string %j', (raw, screened) => {
    expect(p.stripDangerousHtml(raw)).toBe(screened)
  })
})

describe('markup a browser reads differently from the parser', () => {
  const OPEN_QUOTE = '<![CDATA[<a title="</style><a title="</textarea>'
  const OPEN_QUOTE_TEXT =
    '<![CDATA[&lt;a title="&lt;/style>&lt;a title="&lt;/textarea>'

  it.each([
    [
      `${OPEN_QUOTE}<a href="javascript:alert(1)">l</a> x" onclick=alert(1)>`,
      `${OPEN_QUOTE_TEXT}<a >l</a> x" onclick=alert(1)>`,
    ],
    [
      `${OPEN_QUOTE}<img src=x onerror="y">l x" onclick=alert(1)>`,
      `${OPEN_QUOTE_TEXT}<img src=x>l x" onclick=alert(1)>`,
    ],
  ])('writes the tag with the open quote in %j as text', (raw, screened) => {
    expect(p.stripDangerousHtml(raw)).toBe(screened)
  })

  it.each([
    ['<?php echo 1 ?>', '<?php echo 1 ?>'],
    ['<!DOCTYPE html>', '<!DOCTYPE html>'],
    ['<!a b>', '<!a b>'],
    ['<![CDATA[x]]>', '<![CDATA[x]]>'],
  ])('reads the inline markup in a %j paragraph as a raw comment', (markup, text) => {
    const paragraph = p.parser(
      `a ${markup} c`
    )[0] as MarkdownToJSX.ParagraphNode
    expect(paragraph.children[1]).toEqual({
      _endsWithGT: false,
      raw: true,
      text,
      type: RuleType.htmlComment,
    })
  })

  it('reads a fence info string with the attribute screen', () => {
    const code = p.parser(
      '```x onmouseover="alert(1)" title="t"\ny\n```'
    )[0] as MarkdownToJSX.CodeBlockNode
    expect(Object.keys(code.attrs ?? {})).toEqual(['title'])
  })

  const registeredTags = {
    overrides: { Foo: { props: {} }, 'my-el': { props: {} } },
  }

  it.each([
    ['<my-el onClick={go} items={x}>y</my-el>', undefined, { items: '{x}' }],
    ['<my-el onClick={go}>y</my-el>', registeredTags, { onClick: '{go}' }],
    ['<My-el onClick={go}>y</My-el>', undefined, {}],
    ['<My-el onClick={go}>y</My-el>', registeredTags, { onClick: 'go' }],
    ['<Foo children="x">y</Foo>', registeredTags, { children: 'x' }],
    ['<Foo children={x}>y</Foo>', registeredTags, { children: 'x' }],
    ['<my-el children="x">y</my-el>', registeredTags, { children: 'x' }],
    ['<Foo children={{"a":1}}>y</Foo>', registeredTags, {}],
    ['<Foo children={ {"a":1} }>y</Foo>', registeredTags, {}],
    ['<Foo children={[{"a":1}]}>y</Foo>', registeredTags, {}],
  ])('keeps the attributes of %j with %j as %j', (input, options, attrs) => {
    expect(attrsOf(input, options)).toEqual(attrs)
  })

  it.each([
    '<Foo children="<img src=x onerror=alert(1)>"><my-el children="<img src=y onerror=alert(2)>">x</my-el></Foo>',
    '<Foo children="<img src=x onerror=alert(1)>"><my-el>x</my-el></Foo>',
  ])('keeps the outer component source of %j after its nested component is screened', input => {
    const outer = p.parser(input, registeredTags)[0] as MarkdownToJSX.HTMLNode
    expect(outer._reparseSource).toBe(input)
  })

  it('keeps the content source of an unclosed component after its nested component is screened', () => {
    const outer = p.parser(
      '<Foo a="x"><Bar onClick={go}></Bar><my-el children="<img src=y>">y',
      { overrides: { ...registeredTags.overrides, Bar: { props: {} } } }
    )[0] as MarkdownToJSX.HTMLNode
    expect(outer._reparseSource).toBe(
      '<Bar onClick={go}></Bar><my-el children="<img src=y>">y'
    )
  })

  it('reads no registered tag from a parse that ended', () => {
    p.parser('x', { overrides: { 'my-el': { props: {} } } })
    expect(attrsOf('<my-el onClick={go}>y</my-el>')).toEqual({})
  })

  it.each([
    ['<div><a x="<b>">y</a>', '<div><a x="<b>">y</a>'],
    ['<div>\n<b onclick=alert(1)', '<div>\n&lt;b onclick=alert(1)'],
    [
      '<div>\n<a title="<b onclick=alert(1)>">',
      '<div>\n&lt;a title="&lt;b onclick=alert(1)>">',
    ],
    ['<!--><svg onload=alert(1)>', '<!--><svg >'],
    ['<?"><b onclick=alert(1)>b</b>', '<?"><b >b</b>'],
  ])('screens the raw string %j to %j', (input, expected) => {
    expect(p.stripDangerousHtml(input, true)).toBe(expected)
  })
})

describe('a tag that matches an override is a component, and every other tag is HTML', () => {
  const attrsOfTag = (
    source: string,
    tag: string,
    options?: Parameters<typeof p.parser>[1]
  ) => {
    const find = (nodes: unknown): unknown => {
      if (!Array.isArray(nodes)) {
        return
      }
      for (const node of nodes) {
        if (node.tag === tag) {
          return node.attrs
        }
        const inner = find(node.children)
        if (inner !== undefined) {
          return inner
        }
      }
    }
    return find(p.parser(source, options))
  }

  const keys = ['Card', 'card', 'CARD']

  it.each(
    ['Card', 'CARD', 'CaRd'].flatMap(tag => keys.map(key => [tag, key]))
  )('reads <%s> as the component a %j key names', (tag, key) => {
    const overrides = { [key]: { component: 'aside' } }
    expect(
      attrsOfTag(`a <${tag} data={[1]} children="z" />`, tag, { overrides })
    ).toEqual({
      children: 'z',
      data: [1],
    })
  })

  it('reads <card> as HTML against a `Card` key', () => {
    const overrides = { Card: { component: 'aside' } }
    expect(
      attrsOfTag('a <card data={[1]} children="z" />', 'card', { overrides })
    ).toEqual({ data: '{[1]}' })
  })

  it.each([
    '<Card data={[1]} title="t" onClick={go} on={true}>x</Card>',
    '<div>\n<Card data={[1]} title="t" onClick={go} on={true}>x</Card>\n</div>',
    'a <Card data={[1]} title="t" onClick={go} on={true}>x</Card> b',
  ])('keeps the attributes of an unmatched capitalized tag in %j as written, without its handlers', input => {
    expect(attrsOfTag(input, 'Card')).toEqual({ data: '{[1]}', title: 't' })
    expect(attrsOfTag(input, 'Card', { overrides: { Other: 'b' } })).toEqual({
      data: '{[1]}',
      title: 't',
    })
  })

  it.each([
    [
      '<div data={[1]} hidden={true}>x</div>',
      undefined,
      { data: '{[1]}', hidden: '{true}' },
    ],
    [
      '<div data={[1]} hidden={true}>x</div>',
      { overrides: { div: { props: {} } } },
      { data: '{[1]}', hidden: '{true}' },
    ],
    ['<my-el data={[1]} onclick={go}>x</my-el>', undefined, { data: '{[1]}' }],
    [
      '<my-el data={[1]} onclick={go}>x</my-el>',
      { overrides: { 'my-el': { props: {} } } },
      { data: '{[1]}', onclick: '{go}' },
    ],
    [
      '<a data={{"a":1}}>x</a>',
      { overrides: { a: { props: {} } } },
      { data: '{{"a":1}}' },
    ],
    [
      '<card children="z" />',
      { overrides: { card: { props: {} } } },
      { children: 'z' },
    ],
  ])('reads the lowercase tag %j with %j as HTML: %j', (input, options, attrs) => {
    expect(
      attrsOfTag(input, input.slice(1, input.indexOf(' ')), options)
    ).toEqual(attrs)
  })

  it.each([
    ['<Card onClick={() => 1} data={foo} />', { data: '{foo}' }],
    ['<div data={foo}>x</div>', { data: '{foo}' }],
  ])('evaluates no expression in %j when no override matches the tag', (input, attrs) => {
    const withEval = { evalUnserializableExpressions: true }
    expect(
      attrsOfTag(input, input.slice(1, input.indexOf(' ')), withEval)
    ).toEqual(attrs)
  })

  it('evaluates the expressions of a tag an override matches when the option is on', () => {
    const attrs = attrsOfTag('<CARD onClick={() => 1} />', 'CARD', {
      evalUnserializableExpressions: true,
      overrides: { Card: { props: {} } },
    }) as { onClick: () => number }
    expect(typeof attrs.onClick).toBe('function')
    expect(attrs.onClick()).toBe(1)
  })

  it('keeps a brace handler on a lowercase tag an override restyles, as written', () => {
    expect(
      attrsOfTag('x <a href="/" onclick={alert(1)}>y</a>', 'a', {
        overrides: { a: { props: { class: 'x' } } },
      })
    ).toEqual({ href: '/', onclick: '{alert(1)}' })
  })

  const RAW_SPANS = [
    '_rawAttrs',
    '_rawOpen',
    '_rawOuter',
    '_rawBody',
    '_reparseSource',
  ] as const

  const rawSpans = (nodes: unknown) => {
    const out: string[][] = []
    const walk = (list: unknown) => {
      if (!Array.isArray(list)) {
        return
      }
      for (const node of list) {
        for (const field of RAW_SPANS) {
          if (typeof node[field] === 'string') {
            out.push([field, node[field]])
          }
        }
        walk(node.children)
      }
    }
    walk(nodes)
    return out
  }

  const link = { overrides: { a: { props: {} } } }
  const widget = { overrides: { 'my-widget': { props: {} } } }
  const widgetBlock = [
    ['_rawAttrs', ' '],
    ['_rawOuter', '<my-widget >x</my-widget>'],
  ]
  const widgetNested = [
    ['_rawAttrs', ''],
    ['_rawBody', '<my-widget >x</my-widget>\n</div>'],
    ['_rawAttrs', ' '],
    ['_rawOuter', '<my-widget >x</my-widget>\n'],
  ]

  it.each([
    [
      'x <a href="/" onclick="alert(1)">y</a>',
      link,
      { href: '/', onclick: 'alert(1)' },
      [['_rawAttrs', 'href="/"']],
    ],
    [
      'x <a href="/" onclick={alert(1)}>y</a>',
      link,
      { href: '/', onclick: '{alert(1)}' },
      [['_rawAttrs', 'href="/"']],
    ],
    [
      'x <a href="/" onclick>y</a>',
      link,
      { href: '/', onclick: true },
      [['_rawAttrs', 'href="/"']],
    ],
    [
      'x <img src="/x.png" onerror="alert(1)"> y',
      { overrides: { img: { props: {} } } },
      { onerror: 'alert(1)', src: '/x.png' },
      [['_rawOpen', '<img src="/x.png">']],
    ],
    [
      '<my-widget onclick={alert(1)}>x</my-widget>',
      widget,
      { onclick: '{alert(1)}' },
      widgetBlock,
    ],
    [
      '<my-widget onclick="alert(1)">x</my-widget>',
      widget,
      { onclick: 'alert(1)' },
      widgetBlock,
    ],
    [
      'a <my-widget onclick={alert(1)}>x</my-widget>',
      widget,
      { onclick: '{alert(1)}' },
      [['_rawAttrs', '']],
    ],
    [
      'a <my-widget onclick="alert(1)">x</my-widget>',
      widget,
      { onclick: 'alert(1)' },
      [['_rawAttrs', '']],
    ],
    [
      '<div>\n<my-widget onclick={alert(1)}>x</my-widget>\n</div>',
      widget,
      { onclick: '{alert(1)}' },
      widgetNested,
    ],
    [
      '<div>\n<my-widget onclick="alert(1)">x</my-widget>\n</div>',
      widget,
      { onclick: 'alert(1)' },
      widgetNested,
    ],
    [
      'x <a href="/" onclick={alert(1)}>y</a>',
      undefined,
      { href: '/' },
      [['_rawAttrs', 'href="/"']],
    ],
    ['<my-widget onclick={alert(1)}>x</my-widget>', undefined, {}, widgetBlock],
    [
      '<Btn onClick={go}>x</Btn>',
      { overrides: { Btn: { props: {} } } },
      { onClick: 'go' },
      [
        ['_rawAttrs', ' '],
        ['_rawOuter', '<Btn >x</Btn>'],
        ['_reparseSource', '<Btn onClick={go}>x</Btn>'],
      ],
    ],
  ])('keeps the handlers of %j with %j in attrs as %j, with raw source %j', (input, options, attrs, spans) => {
    const opener = input.slice(input.lastIndexOf('<', input.indexOf(' on')) + 1)
    const tag = opener.slice(0, opener.indexOf(' '))
    const tree = p.parser(input, options)
    expect(attrsOfTag(input, tag, options)).toEqual(attrs)
    expect(rawSpans(tree)).toEqual(spans)
  })

  const widgetX = (
    attrs: Record<string, string>,
    rawOuter: string
  ): MarkdownToJSX.HTMLNode => ({
    _isClosingTag: false,
    _rawAttrs: ' ',
    _rawOuter: rawOuter,
    _verbatim: true,
    attrs,
    children: [{ text: 'x', type: RuleType.text }],
    tag: 'my-widget',
    text: 'x',
    type: RuleType.htmlBlock,
  })

  it.each([
    [
      '<my-widget onclick={alert(1)}>x</my-widget>',
      undefined,
      [widgetX({}, '<my-widget >x</my-widget>')],
    ],
    [
      '<my-widget onclick="alert(1)">x</my-widget>',
      widget,
      [widgetX({ onclick: 'alert(1)' }, '<my-widget >x</my-widget>')],
    ],
    [
      '<my-widget onclick={alert(1)}>x</my-widget>',
      widget,
      [widgetX({ onclick: '{alert(1)}' }, '<my-widget >x</my-widget>')],
    ],
    [
      '<div>\n<my-widget onclick="alert(1)">x</my-widget>\n</div>',
      undefined,
      [
        {
          _isClosingTag: false,
          _rawAttrs: '',
          _rawBody: '<my-widget >x</my-widget>\n</div>',
          _verbatim: true,
          attrs: {},
          children: [widgetX({}, '<my-widget >x</my-widget>\n')],
          tag: 'div',
          text: '<my-widget >x</my-widget>\n',
          type: RuleType.htmlBlock,
        },
      ],
    ],
    [
      '<div><img src=x onerror="alert(1)"></div>',
      undefined,
      [
        {
          _isClosingTag: false,
          _rawAttrs: '',
          _rawBody: '<img src=x></div>',
          _verbatim: true,
          attrs: {},
          children: [
            {
              _isClosingTag: false,
              _rawAttrs: ' src=x',
              _verbatim: false,
              attrs: { src: 'x' },
              children: [],
              tag: 'img',
              text: '',
              type: RuleType.htmlBlock,
            },
          ],
          tag: 'div',
          text: '<img src=x>',
          type: RuleType.htmlBlock,
        },
      ],
    ],
    [
      '<pre>\n<img src=x onerror="alert(1)">\n</pre>',
      undefined,
      [
        {
          _isClosingTag: false,
          _rawAttrs: '',
          _rawBody: '<img src=x>',
          _rawClose: '</pre>',
          _verbatim: true,
          attrs: {},
          children: [],
          tag: 'pre',
          text: '<img src=x>',
          type: RuleType.htmlBlock,
        },
      ],
    ],
    [
      '</div><img src=x onerror="alert(1)">',
      undefined,
      [
        {
          _isClosingTag: true,
          _rawBody: '<img src=x>',
          _rawClose: '</div>',
          _verbatim: true,
          attrs: {},
          children: [],
          tag: 'div',
          text: '<img src=x>',
          type: RuleType.htmlBlock,
        },
      ],
    ],
    [
      '<Card children="z">\n',
      { overrides: { card: { component: 'i' } } },
      [
        {
          _isClosingTag: false,
          _rawAttrs: ' ',
          _rawBody: '',
          _verbatim: true,
          attrs: { children: 'z' },
          children: [],
          tag: 'Card',
          text: '',
          type: RuleType.htmlBlock,
        },
      ],
    ],
    [
      '<div>\n\n',
      undefined,
      [
        {
          _isClosingTag: false,
          _rawAttrs: '',
          _rawBody: '',
          _verbatim: true,
          attrs: {},
          children: [],
          tag: 'div',
          text: '',
          type: RuleType.htmlBlock,
        },
      ],
    ],
    [
      '<pre>\n<img src=x onerror="alert(1)">\n',
      undefined,
      [
        {
          _isClosingTag: false,
          _rawAttrs: '',
          _rawOuter: '<pre>\n<img src=x>',
          _verbatim: true,
          attrs: {},
          children: [],
          tag: 'pre',
          text: '<img src=x>',
          type: RuleType.htmlBlock,
        },
      ],
    ],
  ])('stores the screened inner content of %j with %j as text', (input, options, expected) => {
    expect(p.parser(input, options)).toEqual(expected)
  })
})

describe('code span edge spaces strip only U+0020', () => {
  it.each([
    ['` \t `', '<p><code>\t</code></p>'],
    ['`   `', '<p><code> </code></p>'],
    ['`\t`', '<p><code>\t</code></p>'],
    ['` a `', '<p><code>a</code></p>'],
    ['`  a  `', '<p><code> a </code></p>'],
    ['`  `', '<p><code>  </code></p>'],
    ['` `` `', '<p><code>``</code></p>'],
    ['`\na\n`', '<p><code>a</code></p>'],
  ])('renders %j as %j', (input, html) => {
    expect(astToHTML(p.parser(input))).toBe(html)
  })
})

describe('bare email domains accept underscores, while www domains reject them in the last two segments (GFM 6.9)', () => {
  it.each([
    ['foo@a_b.c', '<p><a href="mailto:foo@a_b.c">foo@a_b.c</a></p>'],
    ['foo@a.b_c.d', '<p><a href="mailto:foo@a.b_c.d">foo@a.b_c.d</a></p>'],
    ['a.b-c_d@a.b', '<p><a href="mailto:a.b-c_d@a.b">a.b-c_d@a.b</a></p>'],
    ['a.b-c_d@a.b_', '<p>a.b-c_d@a.b_</p>'],
    ['www.a_b.com', '<p>www.a_b.com</p>'],
    ['http://a_b.com', '<p>http://a_b.com</p>'],
  ])('renders %j as %j', (input, html) => {
    expect(astToHTML(p.parser(input))).toBe(html)
  })
})
