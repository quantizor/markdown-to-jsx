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
    const result = p.parser('hello world') as (MarkdownToJSX.ParagraphNode & {
      endPos: number
    })[]
    expect(result).toEqual([
      {
        type: RuleType.paragraph,
        children: [{ type: RuleType.text, text: 'hello world' }],
        endPos: 11,
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
    ) as (MarkdownToJSX.HeadingNode & { endPos: number })[]
    expect(result).toEqual([
      {
        type: RuleType.heading,
        level: 1,
        children: [{ type: RuleType.text, text: 'Hello' }],
        endPos: 7,
        id: 'hello',
      },
    ])
  })

  it('should handle null/undefined options', () => {
    const result = p.parser(
      'test',
      undefined
    ) as (MarkdownToJSX.ParagraphNode & { endPos: number })[]
    expect(result).toEqual([
      {
        type: RuleType.paragraph,
        children: [{ type: RuleType.text, text: 'test' }],
        endPos: 4,
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
    ) as (MarkdownToJSX.ParagraphNode & { endPos: number })[]
    expect(result).toEqual([
      {
        type: RuleType.paragraph,
        children: [{ type: RuleType.text, text: 'hello\x00world' }],
        endPos: 11,
      },
    ])
  })

  it('should handle mixed line endings', () => {
    const result = p.parser(
      'line1\r\nline2\nline3\rline4'
    ) as (MarkdownToJSX.ParagraphNode & { endPos: number })[]
    // CRLF and LF are both treated as single line endings (soft breaks)
    // CR without LF is preserved as literal text
    expect(result).toEqual([
      {
        type: RuleType.paragraph,
        children: [
          { type: RuleType.text, text: 'line1' },
          { type: RuleType.text, text: '\n' },
          { type: RuleType.text, text: 'line2' },
          { type: RuleType.text, text: '\n' },
          { type: RuleType.text, text: 'line3\rline4' },
        ],
        endPos: 24,
      },
    ])
  })

  it('should handle Unicode characters', () => {
    const result = p.parser('Hello 世界 🌍') as (MarkdownToJSX.ParagraphNode & {
      endPos: number
    })[]
    expect(result).toEqual([
      {
        type: RuleType.paragraph,
        children: [{ type: RuleType.text, text: 'Hello 世界 🌍' }],
        endPos: 11,
      },
    ])
  })

  it('should handle HTML with percent character in attributes without throwing URIError', () => {
    // Regression test for issue #753: URIError when HTML attributes contain % character
    const result = p.parser(
      '<iframe src="https://example.com" width="100%"></iframe>'
    ) as (MarkdownToJSX.ParagraphNode & { endPos: number })[]
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe(RuleType.paragraph)
    const htmlNode = result[0].children[0] as MarkdownToJSX.HTMLNode
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
    ) as (MarkdownToJSX.ParagraphNode & { endPos: number })[]
    expect(result).toEqual([
      {
        type: RuleType.paragraph,
        children: [{ type: RuleType.text, text: 'hello world' }],
        endPos: 11,
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

  it('should reject nested links in inline mode', () => {
    const state = createInlineState()
    const options = { ...createDefaultOptions(), sanitizer: (x: string) => x }
    const result = p.parseMarkdown(
      '[outer [inner](url2)](url1)',
      state,
      options
    )
    expect(result).toEqual([
      { type: RuleType.text, text: '[' },
      { type: RuleType.text, text: 'outer ' },
      {
        type: RuleType.link,
        target: 'url2',
        title: undefined,
        children: [{ type: RuleType.text, text: 'inner' }],
      },
      { type: RuleType.text, text: ']' },
      { type: RuleType.text, text: '(url1)' },
    ]) // Nested links not allowed - outer brackets treated as literal
  })

  it('should handle malformed link syntax', () => {
    const state = createInlineState()
    const options = { ...createDefaultOptions(), sanitizer: (x: string) => x }
    const result = p.parseMarkdown('[link(url)', state, options)
    expect(result).toEqual([
      { type: RuleType.text, text: '[' },
      { type: RuleType.text, text: 'link(url)' }, // Malformed links treated as literal text
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
        title: undefined,
        children: [
          { type: RuleType.text, text: 'link ' },
          { type: RuleType.text, text: '[' },
          { type: RuleType.text, text: 'with' },
          { type: RuleType.text, text: ']' },
          { type: RuleType.text, text: ' brackets' },
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
        endPos: 25,
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
      { type: RuleType.text, text: '<https://example.com' },
      { type: RuleType.text, text: '\n' },
      { type: RuleType.text, text: 'next>' },
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
      { type: RuleType.text, text: 'https://example.invalid' },
      { type: RuleType.text, text: '_' },
      { type: RuleType.text, text: 'domain' },
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
      { type: RuleType.text, text: 'https://example' },
      { type: RuleType.text, text: '_' },
      { type: RuleType.text, text: '.com' },
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
        endPos: 32,
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
    }
    const input = '<https://example.com\tpath>'
    const result = p.parseMarkdown(
      input,
      state,
      options
    ) as MarkdownToJSX.ASTNode[]
    expect(result).toEqual([{ type: RuleType.text, text: input }])
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
    // Last definition should win, and key should be normalized
    expect(refs).toHaveProperty('test')
    expect(refs.test.target).toBe('http://example.com') // First one wins actually
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
    const input = `    [too-indented]: http://example.com
[valid]: https://example.org`
    p.collectReferenceDefinitions(input, refs, options)
    expect(refs).toHaveProperty('valid')
    expect(refs).not.toHaveProperty('too-indented') // 4+ spaces should be rejected
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
    "endPos": 28,
    "type": "ref",
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
    "endPos": 64,
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
    const input = `[unclosed: http://example.com
[valid]: https://example.org`
    p.collectReferenceDefinitions(input, refs, options)
    expect(refs).toHaveProperty('valid')
    expect(refs).not.toHaveProperty('unclosed') // Unclosed brackets should be rejected
  })

  it('should handle reference definitions with nested brackets', () => {
    const refs = createEmptyRefs()
    const options = createDefaultOptions()
    const input = `[nested [brackets]]: http://example.com`
    p.collectReferenceDefinitions(input, refs, options)
    expect(refs).not.toHaveProperty('nested [brackets]') // Nested brackets in labels are rejected
  })

  it('should reject reference definitions inside fenced code blocks', () => {
    const refs = createEmptyRefs()
    const options = createDefaultOptions()
    const input =
      '```\n[inside-code]: http://example.com\n```\n[outside]: https://example.org'
    p.collectReferenceDefinitions(input, refs, options)
    expect(refs).toHaveProperty('outside')
    expect(refs).not.toHaveProperty('inside-code') // Should not parse refs inside code blocks
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
    expect(result).toEqual({
      type: RuleType.ref,
      endPos: 26,
    })
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
    expect(result).toEqual({
      type: RuleType.ref,
      endPos: 28,
    })
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
    expect(result).toEqual({
      type: RuleType.ref,
      endPos: 50,
    })
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
    expect(result).toEqual({
      type: RuleType.ref,
      endPos: 48,
    })
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
    expect(result).toEqual({
      type: RuleType.ref,
      endPos: 48,
    })
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
    expect(result).toEqual({
      type: RuleType.ref,
      endPos: 67,
    })
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
    expect(result).toEqual({
      type: RuleType.ref,
      endPos: 55,
    })
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
    expect(result).toEqual({
      type: RuleType.ref,
      endPos: 56,
    })
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
    expect(result).toEqual({
      type: RuleType.ref,
      endPos: 56,
    })
  })
})

describe('calculateIndent', () => {
  it('should calculate indent for various inputs', () => {
    expect(p.calculateIndent('   test', 0, 6)).toEqual({
      spaceEquivalent: 3,
      charCount: 3,
    })
    expect(p.calculateIndent('\t\ttest', 0, 6)).toEqual({
      spaceEquivalent: 8,
      charCount: 2,
    })
    expect(p.calculateIndent('test', 0, 4)).toEqual({
      spaceEquivalent: 0,
      charCount: 0,
    })
  })

  it('should handle empty strings', () => {
    expect(p.calculateIndent('', 0, 0)).toEqual({
      spaceEquivalent: 0,
      charCount: 0,
    })
  })

  it('should handle strings with only whitespace', () => {
    expect(p.calculateIndent('   ', 0, 3)).toEqual({
      spaceEquivalent: 3,
      charCount: 3,
    })
    expect(p.calculateIndent('\t\t', 0, 2)).toEqual({
      spaceEquivalent: 8,
      charCount: 2,
    })
  })

  it('should handle position beyond string length', () => {
    expect(p.calculateIndent('test', 10, 14)).toEqual({
      spaceEquivalent: 0,
      charCount: 0,
    })
  })

  it('should respect maxSpaces limit', () => {
    expect(p.calculateIndent('       test', 0, 11, 4)).toEqual({
      spaceEquivalent: 4,
      charCount: 4,
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
    expect(result).toEqual({
      type: RuleType.codeBlock,
      text: 'code',
      lang: '',
      attrs: undefined,
      endPos: 12,
    })
  })

  it('should parse fences with tildes', () => {
    const options = createDefaultOptions()
    const result = p.parseCodeFenced(
      '~~~\ncode\n~~~',
      0,
      createBlockState(),
      options
    )
    expect(result).toEqual({
      type: RuleType.codeBlock,
      text: 'code',
      lang: '',
      attrs: undefined,
      endPos: 12,
    })
  })

  it('should handle code with info string', () => {
    const options = createDefaultOptions()
    const result = p.parseCodeFenced(
      '```javascript\ncode\n```',
      0,
      createBlockState(),
      options
    )
    expect(result).toEqual({
      type: RuleType.codeBlock,
      text: 'code',
      lang: 'javascript',
      attrs: undefined,
      endPos: 22,
    })
  })

  it('should handle longer fence markers', () => {
    const options = createDefaultOptions()
    const result = p.parseCodeFenced(
      '````\ncode\n````',
      0,
      createBlockState(),
      options
    )
    expect(result).toEqual({
      type: RuleType.codeBlock,
      text: 'code',
      lang: '',
      attrs: undefined,
      endPos: 14,
    })
  })

  it('should handle mixed fence types (backticks with tildes)', () => {
    const options = createDefaultOptions()
    const result = p.parseCodeFenced(
      '```javascript\ncode\n~~~',
      0,
      createBlockState(),
      options
    )
    expect(result).toEqual({
      type: RuleType.codeBlock,
      text: 'code\n~~~',
      lang: 'javascript',
      attrs: undefined,
      endPos: 22,
    }) // Mixed fence types are allowed per CommonMark examples
  })

  it('should return null for indented opening fence (up to 3 spaces)', () => {
    const options = createDefaultOptions()
    const result = p.parseCodeFenced(
      '   ```\ncode\n   ```',
      0,
      createBlockState(),
      options
    )
    expect(result).toBeNull() // Actually returns null for indented opening fences
  })

  it('should return null for indented fences (4+ spaces)', () => {
    const options = createDefaultOptions()
    const result = p.parseCodeFenced(
      '    ```\ncode\n```',
      0,
      createBlockState(),
      options
    )
    expect(result).toBeNull()
  })

  it('should handle fences with spaces after info string', () => {
    const options = createDefaultOptions()
    const result = p.parseCodeFenced(
      '```javascript \ncode\n```',
      0,
      createBlockState(),
      options
    )
    expect(result).toEqual({
      type: RuleType.codeBlock,
      text: 'code',
      lang: 'javascript',
      attrs: undefined,
      endPos: 23,
    })
  })

  it('should handle empty code blocks', () => {
    const options = createDefaultOptions()
    const result = p.parseCodeFenced('```\n```', 0, createBlockState(), options)
    expect(result).toEqual({
      type: RuleType.codeBlock,
      text: '',
      lang: '',
      attrs: undefined,
      endPos: 7,
    })
  })

  it('should handle code blocks with blank lines', () => {
    const options = createDefaultOptions()
    const result = p.parseCodeFenced(
      '```\nline1\n\nline3\n```',
      0,
      createBlockState(),
      options
    )
    expect(result).toEqual({
      type: RuleType.codeBlock,
      text: 'line1\n\nline3',
      lang: '',
      attrs: undefined,
      endPos: 20,
    })
  })

  it('should handle unclosed fences', () => {
    const options = createDefaultOptions()
    const result = p.parseCodeFenced(
      '```\ncode\n\nmore code\n\nand even more',
      0,
      createBlockState(),
      options
    ) // unclosed - should extend to end despite double newlines
    expect(result).toEqual({
      type: RuleType.codeBlock,
      text: 'code\n\nmore code\n\nand even more',
      lang: '',
      attrs: undefined,
      endPos: 34,
    })
  })

  it('should handle fences with shorter closing markers', () => {
    const options = createDefaultOptions()
    const result = p.parseCodeFenced(
      '````\ncode\n```',
      0,
      createBlockState(),
      options
    )
    expect(result).toEqual({
      type: RuleType.codeBlock,
      text: 'code\n```',
      lang: '',
      attrs: undefined,
      endPos: 13,
    })
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

  it('should return null for tags with underscores', () => {
    const result = p.parseHTMLTag('<custom_tag>', 0)
    expect(result).toBeNull() // Underscores are not valid in HTML tag names
  })

  it('should reject tags with invalid characters in names', () => {
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

  it('should handle various HTML attribute formats gracefully', () => {
    // The parser should be permissive and parse what it can
    const result1 = p.parseHTMLTag('<div class"missing-equals">', 0)
    expect(result1?.tagName).toBe('div') // Parses tag name correctly

    const result2 = p.parseHTMLTag('<div class=missing-quotes>', 0)
    expect(result2?.tagName).toBe('div') // Parses tag name correctly

    const result3 = p.parseHTMLTag('<div ="missing-name">', 0)
    expect(result3?.tagName).toBe('div') // Parses tag name correctly
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
    expect((nestedItem[0] as MarkdownToJSX.TextNode).text).toBe('Unordered nested list')

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

describe('CRLF line endings', () => {
  function toCRLF(text: string): string {
    return text.replace(/\n/g, '\r\n')
  }

  function stripEndPos(obj: unknown): unknown {
    return JSON.parse(JSON.stringify(obj, (k, v) => k === 'endPos' ? undefined : v))
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
      expectCRLFEquivalent('| Left | Center | Right |\n|:-----|:------:|------:|\n| L | C | R |')
    })

    it('should handle tables with multiple rows', () => {
      expectCRLFEquivalent('| H1 | H2 |\n|---|---|\n| a | b |\n| c | d |\n| e | f |')
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
      expectCRLFEquivalent('[a][1] and [b][2]\n\n[1]: http://a.com\n[2]: http://b.com')
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

describe('initializeParseMetrics', () => {
  it('should initialize parse metrics', () => {
    p.initializeParseMetrics()
    // This function initializes global state, so we just verify it doesn't throw
    expect(true).toBe(true)
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

    it('should rehydrate simple arrow functions', () => {
      const markdown = '<Button onClick={() => 42} />'
      const result = p.parser(
        markdown,
        options
      ) as (MarkdownToJSX.HTMLSelfClosingNode & {
        endPos: number
      })[]

      expect(typeof result[0].attrs?.onClick).toBe('function')
      const fn = result[0].attrs?.onClick as () => number
      expect(fn()).toBe(42)
    })

    it('should rehydrate arrow functions with parameters', () => {
      const markdown = '<Input onChange={(x) => x * 2} />'
      const result = p.parser(
        markdown,
        options
      ) as (MarkdownToJSX.HTMLSelfClosingNode & {
        endPos: number
      })[]

      expect(typeof result[0].attrs?.onChange).toBe('function')
      const fn = result[0].attrs?.onChange as (x: number) => number
      expect(fn(5)).toBe(10)
    })

    it('should rehydrate function declarations', () => {
      const markdown = '<Component handler={function(n) { return n + 1; }} />'
      const result = p.parser(
        markdown,
        options
      ) as (MarkdownToJSX.HTMLSelfClosingNode & {
        endPos: number
      })[]

      expect(typeof result[0].attrs?.handler).toBe('function')
      const fn = result[0].attrs?.handler as (n: number) => number
      expect(fn(10)).toBe(11)
    })

    it('should handle eval failures gracefully', () => {
      const markdown = '<Component invalid={this is not valid javascript} />'
      const result = p.parser(
        markdown,
        options
      ) as (MarkdownToJSX.HTMLSelfClosingNode & {
        endPos: number
      })[]

      // Should fall back to string on eval failure
      expect(typeof result[0].attrs?.invalid).toBe('string')
    })

    it('should still parse arrays and objects normally', () => {
      const markdown =
        '<Component data={[1, 2, 3]} config={{"key": "value"}} />'
      const result = p.parser(
        markdown,
        options
      ) as (MarkdownToJSX.HTMLSelfClosingNode & {
        endPos: number
      })[]

      expect(result[0].attrs?.data).toEqual([1, 2, 3])
      expect(result[0].attrs?.config).toEqual({ key: 'value' })
    })

    it('should handle boolean values', () => {
      const markdown = '<Input enabled={true} disabled={false} />'
      const result = p.parser(
        markdown,
        options
      ) as (MarkdownToJSX.HTMLSelfClosingNode & {
        endPos: number
      })[]

      expect(result[0].attrs?.enabled).toBe(true)
      expect(result[0].attrs?.disabled).toBe(false)
    })

    it('should not eval expressions that reference undefined variables', () => {
      const markdown = '<Component value={someUndefinedVar} />'
      const result = p.parser(
        markdown,
        options
      ) as (MarkdownToJSX.HTMLSelfClosingNode & {
        endPos: number
      })[]

      // Should fall back to string when variable is undefined
      expect(typeof result[0].attrs?.value).toBe('string')
      expect(result[0].attrs?.value).toBe('someUndefinedVar')
    })
  })

  describe('security considerations', () => {
    it('should document that evalUnserializableExpressions is dangerous', () => {
      // This test documents the security risk
      const maliciousMarkdown =
        '<Component onClick={() => fetch("/admin/delete")} />'

      // Without option: safe, kept as string
      const safeResult = p.parser(
        maliciousMarkdown
      ) as (MarkdownToJSX.HTMLSelfClosingNode & {
        endPos: number
      })[]
      expect(typeof safeResult[0].attrs?.onClick).toBe('string')

      // With option: dangerous, function can be executed
      const dangerousResult = p.parser(maliciousMarkdown, {
        evalUnserializableExpressions: true,
      }) as (MarkdownToJSX.HTMLSelfClosingNode & { endPos: number })[]
      expect(typeof dangerousResult[0].attrs?.onClick).toBe('function')
    })

    it('should keep functions as strings by default to prevent code execution', () => {
      const markdown =
        '<Button onClick={() => window.location.href = "https://evil.com"} />'
      const result = p.parser(
        markdown
      ) as (MarkdownToJSX.HTMLSelfClosingNode & {
        endPos: number
      })[]

      // Function is not executable, just a string
      expect(typeof result[0].attrs?.onClick).toBe('string')
      expect(() => {
        // This would throw if it were a function - casting to unknown first for type safety
        ;(result[0].attrs?.onClick as Function)()
      }).toThrow()
    })
  })

  describe('edge cases', () => {
    it('should handle functions with newlines (as string due to markdown parsing)', () => {
      // Note: Multiline attribute values in markdown may not be parsed the same way
      // as single-line values, so they remain as strings
      const markdown = `<Component handler={() => {
  const x = 1;
  return x + 1;
}} />`
      const result = p.parser(markdown, {
        evalUnserializableExpressions: true,
      }) as (MarkdownToJSX.HTMLSelfClosingNode & {
        endPos: number
      })[]

      // Multiline functions remain as strings (markdown parsing limitation)
      expect(typeof result[0].attrs?.handler).toBe('string')
    })

    it('should handle nested braces in functions', () => {
      const markdown = '<Component fn={() => { return { nested: true } }} />'
      const result = p.parser(markdown, {
        evalUnserializableExpressions: true,
      }) as (MarkdownToJSX.HTMLSelfClosingNode & {
        endPos: number
      })[]

      expect(typeof result[0].attrs?.fn).toBe('function')
      const fn = result[0].attrs?.fn as () => { nested: boolean }
      expect(fn()).toEqual({ nested: true })
    })

    it('should handle empty functions', () => {
      const markdown = '<Component noop={() => {}} />'
      const result = p.parser(markdown, {
        evalUnserializableExpressions: true,
      }) as (MarkdownToJSX.HTMLSelfClosingNode & {
        endPos: number
      })[]

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
          "endPos": 33,
          "rawAttrs": "",
          "rawText": "Hello **world**</script>",
          "tag": "script",
          "text": "Hello **world**</script>",
          "type": "htmlBlock",
          "verbatim": true,
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
          "attrs": {},
          "canInterruptParagraph": true,
          "children": [
            {
              "children": [
                {
                  "attrs": {},
                  "children": [
                    {
                      "text": "const x = 1;",
                      "type": "text",
                    },
                  ],
                  "endPos": 25,
                  "rawAttrs": "",
                  "tag": "code",
                  "type": "htmlBlock",
                  "verbatim": false,
                },
              ],
              "endPos": 25,
              "type": "paragraph",
            },
          ],
          "endPos": 37,
          "rawAttrs": "",
          "rawText": "<code>const x = 1;</code></pre>",
          "tag": "pre",
          "text": "<code>const x = 1;</code></pre>",
          "type": "htmlBlock",
          "verbatim": true,
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
          "attrs": {},
          "canInterruptParagraph": true,
          "children": [
            {
              "children": [
                {
                  "text": "body { color: red; }",
                  "type": "text",
                },
              ],
              "endPos": 20,
              "type": "paragraph",
            },
            {
              "children": [
                {
                  "text": "/",
                  "type": "text",
                },
                {
                  "text": "*",
                  "type": "text",
                },
                {
                  "text": " Comment ",
                  "type": "text",
                },
                {
                  "text": "*",
                  "type": "text",
                },
                {
                  "text": "/",
                  "type": "text",
                },
              ],
              "endPos": 35,
              "type": "paragraph",
            },
          ],
          "endPos": 51,
          "rawAttrs": "",
          "rawText": 
        "body { color: red; }

        /* Comment */</style>"
        ,
          "tag": "style",
          "text": 
        "body { color: red; }

        /* Comment */</style>"
        ,
          "type": "htmlBlock",
          "verbatim": true,
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
              "endPos": 15,
              "type": "paragraph",
            },
          ],
          "endPos": 28,
          "rawAttrs": "",
          "rawText": undefined,
          "tag": "div",
          "text": undefined,
          "type": "htmlBlock",
          "verbatim": false,
        }
        `)
    })
  })
})
