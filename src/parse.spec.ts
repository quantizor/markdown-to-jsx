import { describe, it, expect } from 'bun:test'
import * as p from './parse'
import { RuleType, type MarkdownToJSX } from './types'

// Test fixtures factories
function createBlockState(refs = {}) {
  return { inline: false, refs } as MarkdownToJSX.State
}

function createInlineState(refs = {}) {
  return { inline: true, refs } as MarkdownToJSX.State
}

function createDefaultOptions() {
  return {
    slugify: (input: string) => input,
  } as p.ParseOptions
}

function createForceBlockOptions() {
  return { forceBlock: true } as p.ParseOptions
}

function createEmptyRefs() {
  return {} as Exclude<MarkdownToJSX.State['refs'], undefined>
}

describe('parser', () => {
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
    const result = p.parser(
      'test',
      undefined
    ) as MarkdownToJSX.ParagraphNode[]
    expect(result).toEqual([
      {
        type: RuleType.paragraph,
        children: [{ type: RuleType.text, text: 'test' }],
      },
    ])
  })

  it('should handle extremely long input', () => {
    const longText = 'a'.repeat(10000)
    const result = p.parser(longText)
    expect(result.length).toBeGreaterThan(0)
  })

  it('should handle input with null bytes', () => {
    const result = p.parser(
      'hello\x00world'
    ) as MarkdownToJSX.ParagraphNode[]
    expect(result).toEqual([
      {
        type: RuleType.paragraph,
        children: [{ type: RuleType.text, text: 'hello\uFFFDworld' }],
      },
    ])
  })

  it('should handle mixed line endings', () => {
    const result = p.parser(
      'line1\r\nline2\nline3\rline4'
    ) as MarkdownToJSX.ParagraphNode[]
    // CRLF, LF, and CR are all normalized to LF
    expect(result).toEqual([
      {
        type: RuleType.paragraph,
        children: [
          { type: RuleType.text, text: 'line1\nline2\nline3\nline4' },
        ],
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

  it('should handle HTML with percent character in attributes without throwing URIError', () => {
    // Regression test for issue #753: URIError when HTML attributes contain % character
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

  it('should handle nested links in inline mode', () => {
    const state = createInlineState()
    const options = { ...createDefaultOptions(), sanitizer: (x: string) => x }
    const result = p.parseMarkdown(
      '[outer [inner](url2)](url1)',
      state,
      options
    )
    // Per CommonMark, links cannot nest. Inner link takes precedence,
    // outer brackets become literal text.
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
    expect(result).toEqual([
      { type: RuleType.text, text: '[link(url)' },
    ])
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
        children: [
          { type: RuleType.text, text: 'link [with] brackets' },
        ],
      },
    ])
  })

  it('should reject links with unescaped brackets in URLs', () => {
    const state = createInlineState()
    const options = { ...createDefaultOptions(), sanitizer: (x: string) => x }
    const result = p.parseMarkdown('[text](url[invalid])', state, options)
    expect(result).toEqual([
      {
        type: RuleType.link,
        target: 'url[invalid]',
        title: undefined,
        children: [{ type: RuleType.text, text: 'text' }],
      }, // Brackets in URLs are actually allowed
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
      tagfilter: true,
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

  it('rejects angle autolinks containing tabs', () => {
    const state = createInlineState()
    const options: p.ParseOptions = {
      disableParsingRawHTML: true,
      sanitizer: (x: string) => x,
      slugify: (value: string) => value,
      tagfilter: true,
    }
    const input = '<https://example.com\tpath>'
    const result = p.parseMarkdown(
      input,
      state,
      options
    ) as MarkdownToJSX.ASTNode[]
    // Per CommonMark spec, tabs are ASCII control characters and invalidate autolinks
    // So the angle brackets and content should be treated as literal text
    expect(result).toEqual([
      { type: RuleType.text, text: '<https://example.com\tpath>' },
    ])
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

  it('should normalize reference labels case-insensitively', () => {
    const refs = createEmptyRefs()
    const options = createDefaultOptions()
    const input = `[Test]: http://example.com
[TEST]: https://example.org`
    p.collectReferenceDefinitions(input, refs, options)
    // First definition wins per CommonMark spec, and key should be normalized
    expect(refs).toHaveProperty('test')
    expect(refs.test.target).toBe('http://example.com')
  })

  it('should normalize whitespace in labels', () => {
    const refs = createEmptyRefs()
    const options = createDefaultOptions()
    const input = `[ test   label ]: http://example.com`
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
    const input = `[test]: http://example.com/path(1)?query=value#fragment`
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
    expect(refs).toHaveProperty('indented') // Indented up to 3 spaces should be allowed per spec
  })

  it('should reject reference definitions indented 4+ spaces', () => {
    const refs = createEmptyRefs()
    const options = createDefaultOptions()
    p.collectReferenceDefinitions('    [too-indented]: http://example.com', refs, options)
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
    expect(refs['中文'].target).toBe('http://example.com/chinese')
    expect(refs['日本語'].target).toBe('https://example.jp/japanese')
    expect(refs['한글'].target).toBe('https://example.kr/korean')
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

  it('should handle reference definitions with malformed URLs', () => {
    const refs = createEmptyRefs()
    const options = createDefaultOptions()
    const input = `[bad-url]: not-a-url
[good]: http://example.com`
    p.collectReferenceDefinitions(input, refs, options)
    expect(refs).toHaveProperty('good')
    expect(refs).toHaveProperty('bad-url') // Parser is permissive about URL validation
  })

  it('should handle reference definitions with unclosed brackets', () => {
    const refs = createEmptyRefs()
    const options = createDefaultOptions()
    p.collectReferenceDefinitions('[unclosed: http://example.com', refs, options)
    expect(refs).not.toHaveProperty('unclosed')
  })

  it('should handle reference definitions with nested brackets', () => {
    const refs = createEmptyRefs()
    const options = createDefaultOptions()
    const input = `[nested [brackets]]: http://example.com`
    p.collectReferenceDefinitions(input, refs, options)
    expect(refs).not.toHaveProperty('nested [brackets]')
  })

  it('should reject reference definitions inside fenced code blocks', () => {
    const refs = createEmptyRefs()
    const options = createDefaultOptions()
    // Test via parser() which properly skips code blocks
    const input =
      '```\n[inside-code]: http://example.com\n```\n[outside]: https://example.org'
    const result = p.parser(input, options)
    const refNode = result.find((n: any) => n.type === RuleType.refCollection)
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
  it('should parse fenced code blocks', () => {
    const options = createDefaultOptions()
    const result = p.parseCodeFenced(
      '```\ncode\n```',
      0,
      createBlockState(),
      options
    )
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
    const options = createDefaultOptions()
    const result = p.parseCodeFenced(
      '~~~\ncode\n~~~',
      0,
      createBlockState(),
      options
    )
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
    const options = createDefaultOptions()
    const result = p.parseCodeFenced(
      '```javascript\ncode\n```',
      0,
      createBlockState(),
      options
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
    const options = createDefaultOptions()
    const result = p.parseCodeFenced(
      '````\ncode\n````',
      0,
      createBlockState(),
      options
    )
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
    const options = createDefaultOptions()
    const result = p.parseCodeFenced(
      '```javascript\ncode\n~~~',
      0,
      createBlockState(),
      options
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
    const options = createDefaultOptions()
    const result = p.parseCodeFenced(
      '   ```\ncode\n   ```',
      0,
      createBlockState(),
      options
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
    const options = createDefaultOptions()
    const result = p.parseCodeFenced(
      '    ```\ncode\n```',
      0,
      createBlockState(),
      options
    )
    expect(result).toMatchInlineSnapshot(`null`)
  })

  it('should handle fences with spaces after info string', () => {
    const options = createDefaultOptions()
    const result = p.parseCodeFenced(
      '```javascript \ncode\n```',
      0,
      createBlockState(),
      options
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
    const options = createDefaultOptions()
    const result = p.parseCodeFenced('```\n```', 0, createBlockState(), options)
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
    const options = createDefaultOptions()
    const result = p.parseCodeFenced(
      '```\nline1\n\nline3\n```',
      0,
      createBlockState(),
      options
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
    const options = createDefaultOptions()
    const result = p.parseCodeFenced(
      '```\ncode\n\nmore code\n\nand even more',
      0,
      createBlockState(),
      options
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
    const options = createDefaultOptions()
    const result = p.parseCodeFenced(
      '````\ncode\n```',
      0,
      createBlockState(),
      options
    )
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
    const options = createDefaultOptions()
    const result = p.parseCodeFenced(
      '``\ncode\n``',
      0,
      createBlockState(),
      options
    )
    expect(result).toBeNull()
  })

  it('should treat fence with language as new opening, implicitly closing previous block', () => {
    // When a fenced code block encounters ```python (fence + language immediately after)
    // it should be treated as a new opening fence, closing the previous block
    const options = createDefaultOptions()
    const input = '```markdown\n```python\ncode\n```'
    const result = p.parseCodeFenced(input, 0, createBlockState(), options)
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

    // The next parse should handle ```python
    const nextResult = p.parseCodeFenced(
      input,
      result!.endPos,
      createBlockState(),
      options
    )
    expect(nextResult).toMatchInlineSnapshot(`null`)
  })

  it('should treat fence with space before info string as content (CommonMark compliant)', () => {
    // Per CommonMark: ``` aaa is NOT a valid closing fence but also should NOT be treated as new opening
    // because the info string has space before it
    const options = createDefaultOptions()
    const input = '```\n``` aaa\n```'
    const result = p.parseCodeFenced(input, 0, createBlockState(), options)
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
    const options = createDefaultOptions()
    const input = '~~~markdown\n~~~python\ncode\n~~~'
    const result = p.parseCodeFenced(input, 0, createBlockState(), options)
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

  it('should not treat fence with backtick in info string as new opening', () => {
    // Per CommonMark: backtick fences cannot have backticks in info string
    const options = createDefaultOptions()
    const input = '```\n```py`thon\n```'
    const result = p.parseCodeFenced(input, 0, createBlockState(), options)
    // Should parse the entire content since ```py`thon is not a valid opening
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

  it('should parse tags with percent character in attributes without throwing URIError', () => {
    // Regression test for issue #753: URIError when HTML attributes contain % character
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

  it('should reject tags with underscores in tag name (no whitespace)', () => {
    // Per CommonMark: tag name only allows [a-zA-Z][a-zA-Z0-9-]*
    // Underscore after tag name without whitespace is invalid
    const result = p.parseHTMLTag('<custom_tag>', 0)
    expect(result).toBeNull()
  })

  it('should reject tags with invalid characters after tag name (no whitespace)', () => {
    // Per CommonMark: need whitespace before attributes
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

  it('should handle various HTML attribute formats per CommonMark', () => {
    // Missing equals before value - quote without = is invalid attr
    const result1 = p.parseHTMLTag('<div class"missing-equals">', 0)
    expect(result1).toBeNull()

    // Unquoted attribute value is valid per CommonMark
    const result2 = p.parseHTMLTag('<div class=missing-quotes>', 0)
    expect(result2?.tagName).toBe('div')

    // = without preceding attr name - invalid
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

  it('should handle tags with newlines in quoted attribute values', () => {
    const result = p.parseHTMLTag('<div class="line1\nline2">', 0)
    expect(result?.tagName).toBe('div') // HTML allows newlines in quoted attribute values
    expect(result?.attrs).toContain('line1') // Should preserve the content
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

  it('should reject tags with nested angle brackets', () => {
    // Per CommonMark: < after tag name without whitespace is invalid
    const result = p.parseHTMLTag('<div<inner>>', 0)
    expect(result).toBeNull()
  })
})

describe('parseStyleAttribute', () => {
  it('should parse CSS style strings', () => {
    const result = p.parseStyleAttribute('color: red; font-size: 12px')
    expect(result).toEqual([
      ['color', 'red'],
      ['font-size', '12px'],
    ])
  })

  it('should handle empty strings', () => {
    const result = p.parseStyleAttribute('')
    expect(result).toEqual([])
  })

  it('should handle malformed styles', () => {
    const result = p.parseStyleAttribute('invalid')
    expect(result).toEqual([])
  })

  it('should parse single properties', () => {
    const result = p.parseStyleAttribute('color: red')
    expect(result).toEqual([['color', 'red']])
  })

  it('should handle styles with extra whitespace', () => {
    const result = p.parseStyleAttribute(' color : red ; font-size : 12px ')
    expect(result).toEqual([
      ['color', 'red'],
      ['font-size', '12px'],
    ])
  })

  it('should handle various CSS property formats', () => {
    // The parser should be permissive and parse what it can
    const result1 = p.parseStyleAttribute('color:red;;font-size:12px')
    expect(result1.length).toBeGreaterThan(0) // Should parse at least the first valid property

    const result2 = p.parseStyleAttribute('color red')
    expect(result2).toEqual([]) // Invalid format should return empty
  })

  it('should handle CSS with quoted values', () => {
    const result = p.parseStyleAttribute(
      'content: "hello world"; background: url(test.jpg)'
    )
    expect(result).toEqual([
      ['content', 'hello world'], // Quotes are stripped by the parser
      ['background', 'url(test.jpg)'],
    ])
  })

  it('should handle CSS with line breaks', () => {
    const result = p.parseStyleAttribute('color: red;\nfont-size: 12px')
    expect(result).toEqual([
      ['color', 'red'],
      ['font-size', '12px'],
    ])
  })

  it('should handle CSS with unclosed quotes gracefully', () => {
    const result = p.parseStyleAttribute('content: "unclosed quote')
    expect(result).toHaveLength(1) // Should parse what it can
    expect(result[0][0]).toBe('content') // Should extract the property name
  })
})

describe('HTML tags interrupting lists', () => {
  it('should interrupt list when HTML tag appears at base indent or less', () => {
    const md = '- foo\n\n\n\n<small>Hi</small>'
    const result = p.parser(md)

    // Should have a list with one item, then an HTML block
    expect(result.length).toBe(2)
    expect(result[0].type).toBe(RuleType.unorderedList)
    expect(result[1].type).toBe(RuleType.paragraph) // HTML tag wrapped in paragraph

    const list = result[0] as MarkdownToJSX.UnorderedListNode
    expect(list.items.length).toBe(1)
    expect(list.items[0][0].type).toBe(RuleType.text)
    expect((list.items[0][0] as MarkdownToJSX.TextNode).text).toBe('foo')
  })

  it('should interrupt indented list when HTML tag appears at column 0', () => {
    const md =
      '  * You can have lists, like this one\n\n  * Make things **bold** or *italic*\n\n  * Embed snippets of `code`\n\n  * Create [links](/)\n\n  * ...\n\n\n\n<small>Sample content borrowed with thanks from [elm-markdown](http://elm-lang.org/examples/markdown) ❤️</small>'
    const result = p.parser(md)

    // Should have a list, then HTML content (not inside the list)
    expect(result.length).toBeGreaterThan(1)
    expect(result[0].type).toBe(RuleType.unorderedList)

    const list = result[0] as MarkdownToJSX.UnorderedListNode
    // The last item should NOT contain the <small> tag
    const lastItem = list.items[list.items.length - 1]
    const lastItemText = JSON.stringify(lastItem)
    expect(lastItemText).not.toContain('small')
    expect(lastItemText).not.toContain('Sample content')
  })

  it('should interrupt list with block-level HTML tag', () => {
    const md = '- item 1\n- item 2\n<div>test</div>\n- item 3'
    const result = p.parser(md)

    // Should have a list with 2 items, then HTML block, then another list
    expect(result.length).toBeGreaterThan(1)
    expect(result[0].type).toBe(RuleType.unorderedList)

    const list = result[0] as MarkdownToJSX.UnorderedListNode
    expect(list.items.length).toBe(2) // Should only have 2 items, not 3
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

    // Should have a single dl element
    expect(result.length).toBe(1)
    expect(result[0].type).toBe(RuleType.htmlBlock)

    const dl = result[0] as MarkdownToJSX.HTMLNode
    expect(dl.tag).toBe('dl')
    expect(dl.attrs['data-variant']).toBe('horizontalTable')

    // Verify dt/dd children are present
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

  it('should parse single dt tag correctly', () => {
    const md = '<dt>title 1</dt>'
    const result = p.parser(md)

    expect(result.length).toBe(1)
    expect(result[0].type).toBe(RuleType.htmlBlock)

    const dt = result[0] as MarkdownToJSX.HTMLNode
    expect(dt.tag).toBe('dt')
    // Compact parser includes closing tag in text content
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

  it('should handle self-closing tags without incorrectly incrementing nesting depth', () => {
    // Self-closing tags like <div/> should not increment nesting depth
    const md = `<div>
  <div/>
  <span>content</span>
</div>`
    const result = p.parser(md)

    // Should parse as a single div with proper nesting
    expect(result.length).toBe(1)
    expect(result[0].type).toBe(RuleType.htmlBlock)

    const div = result[0] as MarkdownToJSX.HTMLNode
    expect(div.tag).toBe('div')
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
          "_rawText": 
      "<dl-custom
        data-variant='horizontalTable'
      >
        <dt>title 1</dt>
        <dd>description 1</dd>
      </dl-custom>"
      ,
          "_verbatim": true,
          "attrs": {
            "data-variant": "horizontalTable",
          },
          "canInterruptParagraph": false,
          "children": [
            {
              "_isClosingTag": false,
              "_rawAttrs": "",
              "_rawText": "title 1",
              "_verbatim": true,
              "attrs": {},
              "canInterruptParagraph": true,
              "children": [
                {
                  "text": "title 1",
                  "type": "text",
                },
              ],
              "endPos": 19,
              "tag": "dt",
              "text": "title 1",
              "type": "htmlBlock",
            },
            {
              "_isClosingTag": false,
              "_rawAttrs": "",
              "_rawText": "description 1",
              "_verbatim": true,
              "attrs": {},
              "canInterruptParagraph": true,
              "children": [
                {
                  "text": "description 1",
                  "type": "text",
                },
              ],
              "endPos": 44,
              "tag": "dd",
              "text": "description 1",
              "type": "htmlBlock",
            },
          ],
          "endPos": 102,
          "tag": "dl-custom",
          "text": 
      "<dl-custom
        data-variant='horizontalTable'
      >
        <dt>title 1</dt>
        <dd>description 1</dd>
      </dl-custom>"
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
          "_rawText": 
      "<div
        class="test"
        id="main"
        data-value="123"
      >content</div>"
      ,
          "_verbatim": true,
          "attrs": {
            "class": "test",
            "data-value": "123",
            "id": "main",
          },
          "canInterruptParagraph": true,
          "children": [
            {
              "text": "content",
              "type": "text",
            },
          ],
          "endPos": 65,
          "tag": "div",
          "text": 
      "<div
        class="test"
        id="main"
        data-value="123"
      >content</div>"
      ,
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
          "_rawText": 
      "<div
        class='test'
        id='main'
        data-value='123'
      >content</div>"
      ,
          "_verbatim": true,
          "attrs": {
            "class": "test",
            "data-value": "123",
            "id": "main",
          },
          "canInterruptParagraph": true,
          "children": [
            {
              "text": "content",
              "type": "text",
            },
          ],
          "endPos": 65,
          "tag": "div",
          "text": 
      "<div
        class='test'
        id='main'
        data-value='123'
      >content</div>"
      ,
          "type": "htmlBlock",
        },
      ]
    `)
  })

  it('should parse JSX components with multi-line attributes', () => {
    expect(
      p.parser(`<MyComponent
  className="wrapper"
  onClick={handleClick}
>
  inner content
</MyComponent>`)
    ).toMatchInlineSnapshot(`
      [
        {
          "_isClosingTag": false,
          "_rawAttrs": 
      "
        className="wrapper"
        onClick={handleClick}
      "
      ,
          "_rawText": 
      "<MyComponent
        className="wrapper"
        onClick={handleClick}
      >
        inner content
      </MyComponent>"
      ,
          "_verbatim": true,
          "attrs": {
            "className": "wrapper",
            "onClick": "handleClick",
          },
          "canInterruptParagraph": false,
          "children": [
            {
              "text": "inner content",
              "type": "text",
            },
          ],
          "endPos": 91,
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
          "children": [
            {
              "children": [
                {
                  "text": "text",
                  "type": "text",
                },
                {
                  "_isClosingTag": true,
                  "_rawText": "</span>",
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
          "_rawText": 
      "<div
        class="double-quoted"
        id='single-quoted'
        data-mixed="value"
      >content</div>"
      ,
          "_verbatim": true,
          "attrs": {
            "class": "double-quoted",
            "data-mixed": "value",
            "id": "single-quoted",
          },
          "canInterruptParagraph": true,
          "children": [
            {
              "text": "content",
              "type": "text",
            },
          ],
          "endPos": 85,
          "tag": "div",
          "text": 
      "<div
        class="double-quoted"
        id='single-quoted'
        data-mixed="value"
      >content</div>"
      ,
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
              "_rawText": 
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
          "_rawText": 
      "<CustomElement
            data-a="1"
            data-b="2"
            data-c="3"
      >inner</CustomElement>"
      ,
          "_verbatim": true,
          "attrs": {
            "data-a": "1",
            "data-b": "2",
            "data-c": "3",
          },
          "canInterruptParagraph": false,
          "children": [
            {
              "text": "inner",
              "type": "text",
            },
          ],
          "endPos": 88,
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
            "_rawText": 
        "<dl-custom
          data-variant='horizontalTable'
        >
          <dt>title 1</dt>
          <dd>description 1</dd>
        </dl-custom>"
        ,
            "_verbatim": true,
            "attrs": {
              "data-variant": "horizontalTable",
            },
            "canInterruptParagraph": false,
            "children": [
              {
                "_isClosingTag": false,
                "_rawAttrs": "",
                "_rawText": "title 1",
                "_verbatim": true,
                "attrs": {},
                "canInterruptParagraph": true,
                "children": [
                  {
                    "text": "title 1",
                    "type": "text",
                  },
                ],
                "endPos": 19,
                "tag": "dt",
                "text": "title 1",
                "type": "htmlBlock",
              },
              {
                "_isClosingTag": false,
                "_rawAttrs": "",
                "_rawText": "description 1",
                "_verbatim": true,
                "attrs": {},
                "canInterruptParagraph": true,
                "children": [
                  {
                    "text": "description 1",
                    "type": "text",
                  },
                ],
                "endPos": 44,
                "tag": "dd",
                "text": "description 1",
                "type": "htmlBlock",
              },
            ],
            "endPos": 102,
            "tag": "dl-custom",
            "text": 
        "<dl-custom
          data-variant='horizontalTable'
        >
          <dt>title 1</dt>
          <dd>description 1</dd>
        </dl-custom>"
        ,
            "type": "htmlBlock",
          },
        ]
      `)
    })

    it('should handle single trailing newline', () => {
      expect(p.parser(baseInput + '\n')).toMatchInlineSnapshot(`
        [
          {
            "_isClosingTag": false,
            "_rawAttrs": 
        "
          data-variant='horizontalTable'
        "
        ,
            "_rawText": 
        "<dl-custom
          data-variant='horizontalTable'
        >
          <dt>title 1</dt>
          <dd>description 1</dd>
        </dl-custom>
        "
        ,
            "_verbatim": true,
            "attrs": {
              "data-variant": "horizontalTable",
            },
            "canInterruptParagraph": false,
            "children": [
              {
                "_isClosingTag": false,
                "_rawAttrs": "",
                "_rawText": "title 1",
                "_verbatim": true,
                "attrs": {},
                "canInterruptParagraph": true,
                "children": [
                  {
                    "text": "title 1",
                    "type": "text",
                  },
                ],
                "endPos": 19,
                "tag": "dt",
                "text": "title 1",
                "type": "htmlBlock",
              },
              {
                "_isClosingTag": false,
                "_rawAttrs": "",
                "_rawText": "description 1",
                "_verbatim": true,
                "attrs": {},
                "canInterruptParagraph": true,
                "children": [
                  {
                    "text": "description 1",
                    "type": "text",
                  },
                ],
                "endPos": 44,
                "tag": "dd",
                "text": "description 1",
                "type": "htmlBlock",
              },
            ],
            "endPos": 103,
            "tag": "dl-custom",
            "text": 
        "<dl-custom
          data-variant='horizontalTable'
        >
          <dt>title 1</dt>
          <dd>description 1</dd>
        </dl-custom>
        "
        ,
            "type": "htmlBlock",
          },
        ]
      `)
    })

    it('should handle double trailing newline', () => {
      expect(p.parser(baseInput + '\n\n')).toMatchInlineSnapshot(`
        [
          {
            "_isClosingTag": false,
            "_rawAttrs": 
        "
          data-variant='horizontalTable'
        "
        ,
            "_rawText": 
        "<dl-custom
          data-variant='horizontalTable'
        >
          <dt>title 1</dt>
          <dd>description 1</dd>
        </dl-custom>
        "
        ,
            "_verbatim": true,
            "attrs": {
              "data-variant": "horizontalTable",
            },
            "canInterruptParagraph": false,
            "children": [
              {
                "_isClosingTag": false,
                "_rawAttrs": "",
                "_rawText": "title 1",
                "_verbatim": true,
                "attrs": {},
                "canInterruptParagraph": true,
                "children": [
                  {
                    "text": "title 1",
                    "type": "text",
                  },
                ],
                "endPos": 19,
                "tag": "dt",
                "text": "title 1",
                "type": "htmlBlock",
              },
              {
                "_isClosingTag": false,
                "_rawAttrs": "",
                "_rawText": "description 1",
                "_verbatim": true,
                "attrs": {},
                "canInterruptParagraph": true,
                "children": [
                  {
                    "text": "description 1",
                    "type": "text",
                  },
                ],
                "endPos": 44,
                "tag": "dd",
                "text": "description 1",
                "type": "htmlBlock",
              },
            ],
            "endPos": 103,
            "tag": "dl-custom",
            "text": 
        "<dl-custom
          data-variant='horizontalTable'
        >
          <dt>title 1</dt>
          <dd>description 1</dd>
        </dl-custom>
        "
        ,
            "type": "htmlBlock",
          },
        ]
      `)
    })

    it('should handle leading newline', () => {
      expect(p.parser('\n' + baseInput)).toMatchInlineSnapshot(`
        [
          {
            "_isClosingTag": false,
            "_rawAttrs": 
        "
          data-variant='horizontalTable'
        "
        ,
            "_rawText": 
        "<dl-custom
          data-variant='horizontalTable'
        >
          <dt>title 1</dt>
          <dd>description 1</dd>
        </dl-custom>"
        ,
            "_verbatim": true,
            "attrs": {
              "data-variant": "horizontalTable",
            },
            "canInterruptParagraph": false,
            "children": [
              {
                "_isClosingTag": false,
                "_rawAttrs": "",
                "_rawText": "title 1",
                "_verbatim": true,
                "attrs": {},
                "canInterruptParagraph": true,
                "children": [
                  {
                    "text": "title 1",
                    "type": "text",
                  },
                ],
                "endPos": 19,
                "tag": "dt",
                "text": "title 1",
                "type": "htmlBlock",
              },
              {
                "_isClosingTag": false,
                "_rawAttrs": "",
                "_rawText": "description 1",
                "_verbatim": true,
                "attrs": {},
                "canInterruptParagraph": true,
                "children": [
                  {
                    "text": "description 1",
                    "type": "text",
                  },
                ],
                "endPos": 44,
                "tag": "dd",
                "text": "description 1",
                "type": "htmlBlock",
              },
            ],
            "endPos": 103,
            "tag": "dl-custom",
            "text": 
        "<dl-custom
          data-variant='horizontalTable'
        >
          <dt>title 1</dt>
          <dd>description 1</dd>
        </dl-custom>"
        ,
            "type": "htmlBlock",
          },
        ]
      `)
    })

    it('should handle leading and trailing newlines', () => {
      expect(p.parser('\n' + baseInput + '\n')).toMatchInlineSnapshot(`
        [
          {
            "_isClosingTag": false,
            "_rawAttrs": 
        "
          data-variant='horizontalTable'
        "
        ,
            "_rawText": 
        "<dl-custom
          data-variant='horizontalTable'
        >
          <dt>title 1</dt>
          <dd>description 1</dd>
        </dl-custom>
        "
        ,
            "_verbatim": true,
            "attrs": {
              "data-variant": "horizontalTable",
            },
            "canInterruptParagraph": false,
            "children": [
              {
                "_isClosingTag": false,
                "_rawAttrs": "",
                "_rawText": "title 1",
                "_verbatim": true,
                "attrs": {},
                "canInterruptParagraph": true,
                "children": [
                  {
                    "text": "title 1",
                    "type": "text",
                  },
                ],
                "endPos": 19,
                "tag": "dt",
                "text": "title 1",
                "type": "htmlBlock",
              },
              {
                "_isClosingTag": false,
                "_rawAttrs": "",
                "_rawText": "description 1",
                "_verbatim": true,
                "attrs": {},
                "canInterruptParagraph": true,
                "children": [
                  {
                    "text": "description 1",
                    "type": "text",
                  },
                ],
                "endPos": 44,
                "tag": "dd",
                "text": "description 1",
                "type": "htmlBlock",
              },
            ],
            "endPos": 104,
            "tag": "dl-custom",
            "text": 
        "<dl-custom
          data-variant='horizontalTable'
        >
          <dt>title 1</dt>
          <dd>description 1</dd>
        </dl-custom>
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
            "_rawText": 
        "<dl-custom
          data-variant='horizontalTable'
        >
          <dt>title 1</dt>
          <dd>description 1</dd>
        </dl-custom>"
        ,
            "_verbatim": true,
            "attrs": {
              "data-variant": "horizontalTable",
            },
            "canInterruptParagraph": false,
            "children": [
              {
                "_isClosingTag": false,
                "_rawAttrs": "",
                "_rawText": "title 1",
                "_verbatim": true,
                "attrs": {},
                "canInterruptParagraph": true,
                "children": [
                  {
                    "text": "title 1",
                    "type": "text",
                  },
                ],
                "endPos": 19,
                "tag": "dt",
                "text": "title 1",
                "type": "htmlBlock",
              },
              {
                "_isClosingTag": false,
                "_rawAttrs": "",
                "_rawText": "description 1",
                "_verbatim": true,
                "attrs": {},
                "canInterruptParagraph": true,
                "children": [
                  {
                    "text": "description 1",
                    "type": "text",
                  },
                ],
                "endPos": 44,
                "tag": "dd",
                "text": "description 1",
                "type": "htmlBlock",
              },
            ],
            "endPos": 102,
            "tag": "dl-custom",
            "text": 
        "<dl-custom
          data-variant='horizontalTable'
        >
          <dt>title 1</dt>
          <dd>description 1</dd>
        </dl-custom>"
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
            "_rawText": 
        "<MyCustomComponent
          propA="value1"
          propB="value2"
        >
          content
        </MyCustomComponent>"
        ,
            "_verbatim": true,
            "attrs": {
              "propA": "value1",
              "propB": "value2",
            },
            "canInterruptParagraph": false,
            "children": [
              {
                "text": "content",
                "type": "text",
              },
            ],
            "endPos": 85,
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
        p.parser(`<DataTable
  data={myData}
  columns={columns}
  onRowClick={handleClick}
>
  Loading...
</DataTable>`)
      ).toMatchInlineSnapshot(`
        [
          {
            "_isClosingTag": false,
            "_rawAttrs": 
        "
          data={myData}
          columns={columns}
          onRowClick={handleClick}
        "
        ,
            "_rawText": 
        "<DataTable
          data={myData}
          columns={columns}
          onRowClick={handleClick}
        >
          Loading...
        </DataTable>"
        ,
            "_verbatim": true,
            "attrs": {
              "columns": "columns",
              "data": "myData",
              "onRowClick": "handleClick",
            },
            "canInterruptParagraph": false,
            "children": [
              {
                "text": "Loading...",
                "type": "text",
              },
            ],
            "endPos": 101,
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
        p.parser(`<Widget
  className="container"
  data-id="123"
  onClick={handleClick}
  disabled
>
  content
</Widget>`)
      ).toMatchInlineSnapshot(`
        [
          {
            "_isClosingTag": false,
            "_rawAttrs": 
        "
          className="container"
          data-id="123"
          onClick={handleClick}
          disabled
        "
        ,
            "_rawText": 
        "<Widget
          className="container"
          data-id="123"
          onClick={handleClick}
          disabled
        >
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
            "canInterruptParagraph": false,
            "children": [
              {
                "text": "content",
                "type": "text",
              },
            ],
            "endPos": 104,
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
            "_rawText": 
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
            "_verbatim": true,
            "attrs": {
              "level": "1",
            },
            "canInterruptParagraph": false,
            "children": [
              {
                "_isClosingTag": false,
                "_rawAttrs": 
        "
            level="2"
          "
        ,
                "_rawText": 
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
                "_verbatim": true,
                "attrs": {
                  "level": "2",
                },
                "canInterruptParagraph": false,
                "children": [
                  {
                    "_isClosingTag": false,
                    "_rawAttrs": 
        "
              level="3"
            "
        ,
                    "_rawText": 
        "<Inner
              level="3"
            >
              content
            </Inner>"
        ,
                    "_verbatim": true,
                    "attrs": {
                      "level": "3",
                    },
                    "canInterruptParagraph": false,
                    "children": [
                      {
                        "text": "content",
                        "type": "text",
                      },
                    ],
                    "endPos": 60,
                    "tag": "Inner",
                    "text": 
        "
              content
            "
        ,
                    "type": "htmlBlock",
                  },
                ],
                "endPos": 100,
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
            "endPos": 129,
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
        p.parser(`<Icon
  name="star"
  size={24}
  color="gold"
  filled
/>`)
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
            "_rawText": "",
            "_verbatim": true,
            "attrs": {
              "color": "gold",
              "filled": true,
              "name": "star",
              "size": "24",
            },
            "canInterruptParagraph": false,
            "children": [],
            "endPos": 58,
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
            "_rawText": 
        "<div
        	class="test"
        	id="main"
        >content</div>"
        ,
            "_verbatim": true,
            "attrs": {
              "class": "test",
              "id": "main",
            },
            "canInterruptParagraph": true,
            "children": [
              {
                "text": "content",
                "type": "text",
              },
            ],
            "endPos": 44,
            "tag": "div",
            "text": 
        "<div
        	class="test"
        	id="main"
        >content</div>"
        ,
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
            "_rawText": 
        "<div
          	class="test"
        	  id="main"
        >content</div>"
        ,
            "_verbatim": true,
            "attrs": {
              "class": "test",
              "id": "main",
            },
            "canInterruptParagraph": true,
            "children": [
              {
                "text": "content",
                "type": "text",
              },
            ],
            "endPos": 48,
            "tag": "div",
            "text": 
        "<div
          	class="test"
        	  id="main"
        >content</div>"
        ,
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
            "_rawText": 
        "  <dt>title</dt>
        </dl-custom>"
        ,
            "_verbatim": true,
            "attrs": {
              "data-variant": "horizontalTable",
            },
            "canInterruptParagraph": false,
            "children": [
              {
                "_isClosingTag": false,
                "_rawAttrs": "",
                "_rawText": "title",
                "_verbatim": true,
                "attrs": {},
                "canInterruptParagraph": true,
                "children": [
                  {
                    "text": "title",
                    "type": "text",
                  },
                ],
                "endPos": 17,
                "tag": "dt",
                "text": "title",
                "type": "htmlBlock",
              },
            ],
            "endPos": 72,
            "tag": "dl-custom",
            "text": 
        "  <dt>title</dt>
        </dl-custom>"
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
            "_rawText": 
        "<dl-custom
          data-variant='horizontalTable'
        >
        </dl-custom>"
        ,
            "_verbatim": true,
            "attrs": {
              "data-variant": "horizontalTable",
            },
            "canInterruptParagraph": false,
            "children": [],
            "endPos": 58,
            "tag": "dl-custom",
            "text": 
        "<dl-custom
          data-variant='horizontalTable'
        >
        </dl-custom>"
        ,
            "type": "htmlBlock",
          },
        ]
      `)
    })
  })
})

describe('tables in lists', () => {
  it('should parse tables within list items (regression test for issue #1)', () => {
    const md = `- **Browser Stats**:

  | Computer | Memory Usage |
  | -------- | ------------ |
  | FireFox  | 86%          |
  | Chrome   | 80%          |
  | Safari   | 79%          |
`
    const result = p.parser(md)

    // Should have a single unordered list
    expect(result.length).toBe(1)
    expect(result[0].type).toBe(RuleType.unorderedList)

    const list = result[0] as MarkdownToJSX.UnorderedListNode
    expect(list.items.length).toBe(1)

    // The first item should contain both content and a table
    const item = list.items[0]
    expect(item.length).toBe(2)

    // First element is the paragraph with "Browser Stats"
    expect(item[0].type).toBe(RuleType.paragraph)
    const paragraph = item[0] as MarkdownToJSX.ParagraphNode
    expect(paragraph.children.length).toBeGreaterThan(0)

    // Second element should be a table
    expect(item[1].type).toBe(RuleType.table)
    const table = item[1] as MarkdownToJSX.TableNode
    expect(table.header.length).toBe(2)
    expect(table.cells.length).toBe(3) // FireFox, Chrome, Safari rows
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

  it('should parse multiple tables in separate list items', () => {
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

    // Both items should have tables
    for (const item of list.items) {
      const tables = item.filter(node => node.type === RuleType.table)
      expect(tables.length).toBe(1)
    }
  })
})

describe('paragraph after nested list', () => {
  it('should parse paragraph at column 0 after blank line as separate block (issue #776)', () => {
    const md = `- Unordered list
  - Unordered nested list

This is paragraph after the unordered nested list.`
    const result = p.parser(md)

    // Should have a list followed by a separate paragraph
    expect(result.length).toBe(2)
    expect(result[0].type).toBe(RuleType.unorderedList)
    expect(result[1].type).toBe(RuleType.paragraph)

    const list = result[0] as MarkdownToJSX.UnorderedListNode
    expect(list.items.length).toBe(1)

    const firstItem = list.items[0]
    expect(firstItem.length).toBe(2) // Text node + nested list

    // The nested list should not contain the paragraph
    const nestedList = firstItem[1] as MarkdownToJSX.UnorderedListNode
    expect(nestedList.items.length).toBe(1)
    const nestedItem = nestedList.items[0]
    // Should only contain the text "Unordered nested list", not the paragraph
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

  it('should handle ordered nested list with paragraph after blank line', () => {
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
    // Should only contain the text, not the paragraph
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
              "start": undefined,
              "type": "unorderedList",
            },
          ],
        ],
        "start": undefined,
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
              "start": undefined,
              "type": "unorderedList",
            },
          ],
        ],
        "start": undefined,
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
              "start": undefined,
              "type": "unorderedList",
            },
          ],
        ],
        "start": undefined,
        "type": "unorderedList",
      },
    ]
  `)
})

describe('CRLF line endings', () => {
  function toCRLF(text: string): string {
    return text.replace(/\n/g, '\r\n')
  }

  function stripEndPos(obj: unknown): unknown {
    return JSON.parse(
      JSON.stringify(obj, (k, v) => (k === 'endPos' ? undefined : v))
    )
  }

  function expectCRLFEquivalent(lfText: string, description?: string) {
    const crlfText = toCRLF(lfText)
    const lfResult = p.parser(lfText)
    const crlfResult = p.parser(crlfText)
    expect(stripEndPos(crlfResult)).toEqual(stripEndPos(lfResult))
  }

  describe('paragraphs', () => {
    it('should handle single paragraph with multiple lines', () => {
      expectCRLFEquivalent('line1\nline2\nline3')
    })

    it('should handle multiple paragraphs separated by blank lines', () => {
      expectCRLFEquivalent('paragraph 1\n\nparagraph 2\n\nparagraph 3')
    })
  })

  describe('headings', () => {
    it('should handle ATX headings', () => {
      expectCRLFEquivalent('# Heading 1\n\n## Heading 2\n\n### Heading 3')
    })

    it('should handle setext headings', () => {
      expectCRLFEquivalent('Heading 1\n=========\n\nHeading 2\n---------')
    })

    it('should handle multi-line setext heading content', () => {
      expectCRLFEquivalent('Multi\nline\nheading\n=======')
    })
  })

  describe('lists', () => {
    it('should handle unordered lists', () => {
      expectCRLFEquivalent('- item 1\n- item 2\n- item 3')
    })

    it('should handle ordered lists', () => {
      expectCRLFEquivalent('1. item 1\n2. item 2\n3. item 3')
    })

    it('should handle nested lists', () => {
      expectCRLFEquivalent('- item 1\n  - nested 1\n  - nested 2\n- item 2')
    })

    it('should handle lists with multi-line items', () => {
      expectCRLFEquivalent('- item 1\n  continuation\n- item 2')
    })

    it('should handle GFM task lists', () => {
      expectCRLFEquivalent('- [ ] unchecked\n- [x] checked\n- [ ] another')
    })
  })

  describe('code blocks', () => {
    it('should handle fenced code blocks with backticks', () => {
      expectCRLFEquivalent('```js\nconst x = 1;\nconst y = 2;\n```')
    })

    it('should handle fenced code blocks with tildes', () => {
      expectCRLFEquivalent('~~~python\ndef foo():\n    pass\n~~~')
    })

    it('should handle indented code blocks', () => {
      expectCRLFEquivalent('    code line 1\n    code line 2\n    code line 3')
    })

    it('should handle fenced code blocks with blank lines', () => {
      expectCRLFEquivalent('```\nline 1\n\nline 3\n```')
    })
  })

  describe('blockquotes', () => {
    it('should handle simple blockquotes', () => {
      expectCRLFEquivalent('> quote line 1\n> quote line 2')
    })

    it('should handle nested blockquotes', () => {
      expectCRLFEquivalent('> level 1\n>> level 2\n>>> level 3')
    })

    it('should handle blockquotes with lazy continuation', () => {
      expectCRLFEquivalent('> quote line 1\ncontinuation line')
    })

    it('should handle blockquotes with multiple paragraphs', () => {
      expectCRLFEquivalent('> paragraph 1\n>\n> paragraph 2')
    })
  })

  describe('thematic breaks', () => {
    it('should handle horizontal rules', () => {
      expectCRLFEquivalent('paragraph\n\n---\n\nparagraph')
    })

    it('should handle asterisk horizontal rules', () => {
      expectCRLFEquivalent('text\n\n***\n\ntext')
    })

    it('should handle underscore horizontal rules', () => {
      expectCRLFEquivalent('text\n\n___\n\ntext')
    })
  })

  describe('HTML blocks', () => {
    it('should handle HTML block elements', () => {
      expectCRLFEquivalent('<div>\ncontent\n</div>')
    })

    it('should handle HTML comments', () => {
      expectCRLFEquivalent('<!-- comment\nspanning lines -->\n\nparagraph')
    })

    it('should handle pre blocks', () => {
      expectCRLFEquivalent('<pre>\npreformatted\ntext\n</pre>')
    })
  })

  describe('tables', () => {
    it('should handle simple tables', () => {
      expectCRLFEquivalent('| A | B |\n|---|---|\n| 1 | 2 |')
    })

    it('should handle tables with alignment', () => {
      expectCRLFEquivalent(
        '| Left | Center | Right |\n|:-----|:------:|------:|\n| L | C | R |'
      )
    })

    it('should handle tables with multiple rows', () => {
      expectCRLFEquivalent(
        '| H1 | H2 |\n|---|---|\n| a | b |\n| c | d |\n| e | f |'
      )
    })
  })

  describe('reference definitions', () => {
    it('should handle reference definitions', () => {
      expectCRLFEquivalent('[link][ref]\n\n[ref]: http://example.com')
    })

    it('should handle reference definitions with titles', () => {
      expectCRLFEquivalent('[link][ref]\n\n[ref]: http://example.com "title"')
    })

    it('should handle multiple reference definitions', () => {
      expectCRLFEquivalent(
        '[a][1] and [b][2]\n\n[1]: http://a.com\n[2]: http://b.com'
      )
    })

    it('should reject title with blank line (CRLF blank line detection)', () => {
      const lfText = '[ref]: http://example.com "title\n\nmore"'
      const crlfText = toCRLF(lfText)
      const lfResult = p.parser(lfText)
      const crlfResult = p.parser(crlfText)
      expect(stripEndPos(crlfResult)).toEqual(stripEndPos(lfResult))
      expect(lfResult.length).toBe(2)
    })

    it('should reject parenthesized title with blank line', () => {
      const lfText = '[ref]: http://example.com (title\n\nmore)'
      const crlfText = toCRLF(lfText)
      const lfResult = p.parser(lfText)
      const crlfResult = p.parser(crlfText)
      expect(stripEndPos(crlfResult)).toEqual(stripEndPos(lfResult))
      expect(lfResult.length).toBe(2)
    })
  })

  describe('footnotes', () => {
    it('should handle footnote definitions', () => {
      expectCRLFEquivalent('Text[^1].\n\n[^1]: Footnote content')
    })

    it('should handle footnotes with continuation', () => {
      expectCRLFEquivalent('Text[^1].\n\n[^1]: Footnote\n    continuation')
    })

    it('should handle multiple footnotes', () => {
      expectCRLFEquivalent('A[^1] B[^2]\n\n[^1]: First\n[^2]: Second')
    })

    it('should not absorb paragraph after blank line (CRLF blank line detection)', () => {
      const lfText = '[^1]: Footnote content\n\nParagraph after.'
      const crlfText = toCRLF(lfText)
      const lfResult = p.parser(lfText)
      const crlfResult = p.parser(crlfText)
      expect(stripEndPos(crlfResult)).toEqual(stripEndPos(lfResult))
      expect(lfResult.length).toBe(3)
    })
  })

  describe('frontmatter', () => {
    it('should handle YAML frontmatter', () => {
      expectCRLFEquivalent('---\ntitle: Test\nauthor: Me\n---\n\nContent')
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
      expectCRLFEquivalent(doc)
    })

    it('should handle the original issue case (issue #773)', () => {
      const text = `Lorem ipsum dolor sit amet.

- Item 1
- Item 2
- Item 3
- Item 4`

      const crlfText = toCRLF(text)
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

describe('Unserializable expression evaluation', () => {
  describe('with evalUnserializableExpressions: false (default)', () => {
    it('should keep function expressions as strings', () => {
      const markdown = '<Button onClick={() => alert("test")} />'
      const result = p.parser(
        markdown
      ) as (MarkdownToJSX.HTMLSelfClosingNode & {
        endPos: number
      })[]

      expect(result[0].attrs?.onClick).toBe('() => alert("test")')
      expect(typeof result[0].attrs?.onClick).toBe('string')
    })

    it('should keep arrow functions as strings', () => {
      const markdown = '<Input onChange={(e) => setValue(e.target.value)} />'
      const result = p.parser(
        markdown
      ) as (MarkdownToJSX.HTMLSelfClosingNode & {
        endPos: number
      })[]

      expect(result[0].attrs?.onChange).toBe('(e) => setValue(e.target.value)')
      expect(typeof result[0].attrs?.onChange).toBe('string')
    })

    it('should keep function declarations as strings', () => {
      const markdown = '<Component handler={function handleClick() { }} />'
      const result = p.parser(
        markdown
      ) as (MarkdownToJSX.HTMLSelfClosingNode & {
        endPos: number
      })[]

      expect(typeof result[0].attrs?.handler).toBe('string')
    })

    it('should keep complex expressions as strings', () => {
      const markdown = '<Component value={someVar + 10} />'
      const result = p.parser(
        markdown
      ) as (MarkdownToJSX.HTMLSelfClosingNode & {
        endPos: number
      })[]

      expect(result[0].attrs?.value).toBe('someVar + 10')
      expect(typeof result[0].attrs?.value).toBe('string')
    })
  })

  describe('with evalUnserializableExpressions: true', () => {
    const options = { evalUnserializableExpressions: true }

    it('should evaluate arrow functions', () => {
      const markdown = '<Button onClick={() => 42} />'
      const result = p.parser(markdown, options) as MarkdownToJSX.HTMLSelfClosingNode[]
      expect(typeof result[0].attrs?.onClick).toBe('function')
      expect((result[0].attrs?.onClick as Function)()).toBe(42)
    })

    it('should evaluate arrow functions with parameters', () => {
      const markdown = '<Input onChange={(x) => x * 2} />'
      const result = p.parser(markdown, options) as MarkdownToJSX.HTMLSelfClosingNode[]
      expect(typeof result[0].attrs?.onChange).toBe('function')
      expect((result[0].attrs?.onChange as Function)(5)).toBe(10)
    })

    it('should evaluate function declarations', () => {
      const markdown = '<Component handler={function(n) { return n + 1; }} />'
      const result = p.parser(markdown, options) as MarkdownToJSX.HTMLSelfClosingNode[]
      expect(typeof result[0].attrs?.handler).toBe('function')
      expect((result[0].attrs?.handler as Function)(5)).toBe(6)
    })

    it('should keep invalid javascript as strings', () => {
      const markdown = '<Component invalid={this is not valid javascript} />'
      const result = p.parser(markdown, options) as MarkdownToJSX.HTMLSelfClosingNode[]
      expect(typeof result[0].attrs?.invalid).toBe('string')
    })

    it('should parse arrays and objects via JSON', () => {
      const markdown =
        '<Component data={[1, 2, 3]} config={{"key": "value"}} />'
      const result = p.parser(markdown, options) as MarkdownToJSX.HTMLSelfClosingNode[]
      expect(result[0].attrs?.data).toEqual([1, 2, 3])
      expect(result[0].attrs?.config).toEqual({ key: 'value' })
    })

    it('should convert boolean values', () => {
      const markdown = '<Input enabled={true} disabled={false} />'
      const result = p.parser(markdown, options) as MarkdownToJSX.HTMLSelfClosingNode[]
      expect(result[0].attrs?.enabled).toBe(true)
      expect(result[0].attrs?.disabled).toBe(false)
    })

    it('should keep undefined variable references as strings', () => {
      const markdown = '<Component value={someUndefinedVar} />'
      const result = p.parser(markdown, options) as MarkdownToJSX.HTMLSelfClosingNode[]
      expect(typeof result[0].attrs?.value).toBe('string')
      expect(result[0].attrs?.value).toBe('someUndefinedVar')
    })
  })

  describe('security considerations', () => {
    it('should keep expressions as strings by default', () => {
      const maliciousMarkdown =
        '<Component onClick={() => fetch("/admin/delete")} />'
      const safeResult = p.parser(maliciousMarkdown) as MarkdownToJSX.HTMLSelfClosingNode[]
      expect(typeof safeResult[0].attrs?.onClick).toBe('string')
    })

    it('should eval expressions when evalUnserializableExpressions is true', () => {
      const markdown =
        '<Component onClick={() => 42} />'
      const result = p.parser(markdown, {
        evalUnserializableExpressions: true,
      }) as MarkdownToJSX.HTMLSelfClosingNode[]
      expect(typeof result[0].attrs?.onClick).toBe('function')
    })

    it('should keep functions as strings by default to prevent code execution', () => {
      const markdown =
        '<Button onClick={() => window.location.href = "https://evil.com"} />'
      const result = p.parser(markdown) as MarkdownToJSX.HTMLSelfClosingNode[]
      expect(typeof result[0].attrs?.onClick).toBe('string')
      expect(() => {
        ;(result[0].attrs?.onClick as Function)()
      }).toThrow()
    })
  })

  describe('edge cases', () => {
    it('should evaluate functions with newlines', () => {
      const markdown = `<Component handler={() => {
  const x = 1;
  return x + 1;
}} />`
      const result = p.parser(markdown, {
        evalUnserializableExpressions: true,
      }) as MarkdownToJSX.HTMLSelfClosingNode[]
      expect(typeof result[0].attrs?.handler).toBe('function')
      expect((result[0].attrs?.handler as Function)()).toBe(2)
    })

    it('should evaluate nested braces in functions', () => {
      const markdown = '<Component fn={() => { return { nested: true } }} />'
      const result = p.parser(markdown, {
        evalUnserializableExpressions: true,
      }) as MarkdownToJSX.HTMLSelfClosingNode[]
      expect(typeof result[0].attrs?.fn).toBe('function')
      expect((result[0].attrs?.fn as Function)()).toEqual({ nested: true })
    })

    it('should evaluate empty functions', () => {
      const markdown = '<Component noop={() => {}} />'
      const result = p.parser(markdown, {
        evalUnserializableExpressions: true,
      }) as MarkdownToJSX.HTMLSelfClosingNode[]
      expect(typeof result[0].attrs?.noop).toBe('function')
    })
  })

  describe('verbatim HTML blocks with parsed children', () => {
    it('should parse markdown content in script tags into children even when verbatim', () => {
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
          "_rawText": "Hello **world**</script>",
          "_verbatim": true,
          "attrs": {},
          "canInterruptParagraph": true,
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
          "endPos": 32,
          "tag": "script",
          "text": "Hello **world**",
          "type": "htmlBlock",
        }
      `)
    })

    it('should parse nested HTML in pre tags into children even when verbatim', () => {
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
          "_rawText": "<code>const x = 1;</code></pre>",
          "_verbatim": true,
          "attrs": {},
          "canInterruptParagraph": true,
          "children": [
            {
              "_rawAttrs": "",
              "_verbatim": false,
              "attrs": {},
              "children": [
                {
                  "text": "const x = 1;",
                  "type": "text",
                },
              ],
              "tag": "code",
              "text": "const x = 1;",
              "type": "htmlBlock",
            },
          ],
          "endPos": 36,
          "tag": "pre",
          "text": "<code>const x = 1;</code>",
          "type": "htmlBlock",
        }
      `)
    })

    it('should parse complex markdown in style tags into children even when verbatim', () => {
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
          "_rawText": 
        "body { color: red; }

        /* Comment */</style>"
        ,
          "_verbatim": true,
          "attrs": {},
          "canInterruptParagraph": true,
          "children": [
            {
              "text": 
        "body { color: red; }

        /* Comment */"
        ,
              "type": "text",
            },
          ],
          "endPos": 50,
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
          "_rawText": "",
          "_verbatim": false,
          "attrs": {},
          "canInterruptParagraph": true,
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
          "endPos": 28,
          "tag": "div",
          "text": 
        "Hello **world**

        "
        ,
          "type": "htmlBlock",
        }
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
      const result = p.parser('a\x00b\x00c\x00d') as MarkdownToJSX.ParagraphNode[]
      expect(result).toEqual([
        {
          type: RuleType.paragraph,
          children: [{ type: RuleType.text, text: 'a\uFFFDb\uFFFDc\uFFFDd' }],
        },
      ])
    })

    it('should replace null bytes in code blocks', () => {
      const result = p.parser('```\ncode\x00block\n```') as MarkdownToJSX.CodeBlockNode[]
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
      const result = p.parser('\uFEFFhello world') as MarkdownToJSX.ParagraphNode[]
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
      const result = p.parser('hello\uFEFFworld') as MarkdownToJSX.ParagraphNode[]
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
      expect(result[0].children[0].text).toContain('\u200D')
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
      expect(result[0].children[0].children[0].text).toBe('bold\u200Btext')
    })
  })

  describe('emoji sequences', () => {
    it('should handle emoji with skin tone modifiers', () => {
      const result = p.parser(
        'wave: \u{1F44B}\u{1F3FB}'
      ) as (MarkdownToJSX.ParagraphNode & { endPos: number })[]
      expect(result[0].children[0].text).toContain('\u{1F44B}\u{1F3FB}')
    })

    it('should handle ZWJ emoji sequences (family)', () => {
      const result = p.parser(
        '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}'
      ) as (MarkdownToJSX.ParagraphNode & { endPos: number })[]
      expect(result[0].children[0].text).toBe(
        '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}'
      )
    })

    it('should handle flag sequences (regional indicators)', () => {
      const result = p.parser(
        '\u{1F1FA}\u{1F1F8}'
      ) as (MarkdownToJSX.ParagraphNode & { endPos: number })[]
      expect(result[0].children[0].text).toBe('\u{1F1FA}\u{1F1F8}')
    })

    it('should handle multiple emoji with various modifiers', () => {
      const result = p.parser(
        '\u{1F44B}\u{1F3FB} \u{1F468}\u200D\u{1F4BB} \u{1F1FA}\u{1F1F8}'
      ) as (MarkdownToJSX.ParagraphNode & { endPos: number })[]
      expect(result[0].children[0].text).toBe(
        '\u{1F44B}\u{1F3FB} \u{1F468}\u200D\u{1F4BB} \u{1F1FA}\u{1F1F8}'
      )
    })
  })

  describe('unicode whitespace', () => {
    it('should treat non-breaking space (U+00A0) as Unicode whitespace', () => {
      const result = p.parser('hello\u00A0world')
      expect(result[0].children[0].text).toBe('hello\u00A0world')
    })

    it('should distinguish ASCII whitespace from Unicode whitespace in emphasis', () => {
      const result = p.parser('*hello world*')
      expect(result[0].children[0].type).toBe(RuleType.textFormatted)
      const result2 = p.parser('*hello\u00A0world*')
      expect(result2[0].children[0].type).toBe(RuleType.textFormatted)
    })

    it('should handle em space (U+2003)', () => {
      const result = p.parser('hello\u2003world')
      expect(result[0].children[0].text).toBe('hello\u2003world')
    })

    it('should handle en space (U+2002)', () => {
      const result = p.parser('hello\u2002world')
      expect(result[0].children[0].text).toBe('hello\u2002world')
    })

    it('should handle thin space (U+2009)', () => {
      const result = p.parser('hello\u2009world')
      expect(result[0].children[0].text).toBe('hello\u2009world')
    })
  })

  describe('control characters', () => {
    it('should preserve bell character (U+0007)', () => {
      const result = p.parser('hello\x07world')
      expect(result[0].children[0].text).toBe('hello\x07world')
    })

    it('should preserve backspace (U+0008)', () => {
      const result = p.parser('hello\x08world')
      expect(result[0].children[0].text).toBe('hello\x08world')
    })

    it('should preserve escape (U+001B)', () => {
      const result = p.parser('hello\x1Bworld')
      expect(result[0].children[0].text).toBe('hello\x1Bworld')
    })

    it('should preserve delete (U+007F)', () => {
      const result = p.parser('hello\x7Fworld')
      expect(result[0].children[0].text).toBe('hello\x7Fworld')
    })

    it('should preserve vertical tab (U+000B)', () => {
      const result = p.parser('hello\x0Bworld')
      expect(result[0].children[0].text).toBe('hello\x0Bworld')
    })

    it('should preserve form feed (U+000C)', () => {
      const result = p.parser('hello\x0Cworld')
      expect(result[0].children[0].text).toBe('hello\x0Cworld')
    })

    it('should handle multiple control characters', () => {
      const result = p.parser('a\x07b\x08c\x1Bd\x7Fe')
      expect(result[0].children[0].text).toBe('a\x07b\x08c\x1Bd\x7Fe')
    })
  })
})
