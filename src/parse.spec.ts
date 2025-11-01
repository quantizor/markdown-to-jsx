import {
  parseInlineSpan,
  parseText,
  parseTextEscaped,
  parseCodeInline,
  parseBreakLine,
  parseLink,
  parseImage,
  parseLinkAngleBrace,
  parseLinkBareUrl,
  parseRefLink,
  parseRefImage,
  parseHeading,
  parseParagraph,
  parseBreakThematic,
  parseHeadingSetext,
  parseCodeBlock,
  parseCodeFenced,
  parseBlockQuote,
  parseOrderedList,
  parseUnorderedList,
  parseTable,
  parseHTML,
  parseHTMLComment,
  parseRef,
  parseFootnote,
  parseFootnoteReference,
  parseGFMTask,
  matchInlineFormatting,
} from './parse'
import { RuleType } from './index'
import type { MarkdownToJSX } from './index'

// Mock options for testing
const mockOptions = {
  slugify: (input: string) => input.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
  sanitizer: (value: string) => value,
  disableAutoLink: false,
  namedCodesToUnicode: {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
  },
}

const mockState: MarkdownToJSX.State = {
  inline: true,
}

const mockBlockState: MarkdownToJSX.State = {
  inline: false,
}

describe('parseInlineSpan', () => {
  it('should parse plain text', () => {
    const result = parseInlineSpan('Hello world', 0, 11, mockState, mockOptions)
    expect(result).toEqual([
      {
        type: RuleType.text,
        text: 'Hello world',
      },
    ])
  })

  it('should handle HTML entities', () => {
    const result = parseInlineSpan(
      'Hello &amp; world',
      0,
      17,
      mockState,
      mockOptions
    )
    expect(result).toEqual([
      {
        type: RuleType.text,
        text: 'Hello & world',
      },
    ])
  })

  it('should parse bold text', () => {
    const result = parseInlineSpan(
      'Hello **world**',
      0,
      15,
      mockState,
      mockOptions
    )
    expect(result).toEqual([
      { type: RuleType.text, text: 'Hello ' },
      {
        type: RuleType.textFormatted,
        tag: 'strong',
        children: [{ type: RuleType.text, text: 'world' }],
      },
    ])
  })

  it('should parse italic text', () => {
    const result = parseInlineSpan(
      'Hello *world*',
      0,
      13,
      mockState,
      mockOptions
    )
    expect(result).toEqual([
      { type: RuleType.text, text: 'Hello ' },
      {
        type: RuleType.textFormatted,
        tag: 'em',
        children: [{ type: RuleType.text, text: 'world' }],
      },
    ])
  })

  it('should handle nested formatting', () => {
    const result = parseInlineSpan(
      '**bold and *italic* text**',
      0,
      26,
      mockState,
      mockOptions
    )
    expect(result).toEqual([
      {
        type: RuleType.textFormatted,
        tag: 'strong',
        children: [
          { type: RuleType.text, text: 'bold and ' },
          {
            type: RuleType.textFormatted,
            tag: 'em',
            children: [{ type: RuleType.text, text: 'italic' }],
          },
          { type: RuleType.text, text: ' text' },
        ],
      },
    ])
  })

  it('should handle escaped characters', () => {
    const result = parseInlineSpan(
      'Hello \\*world\\*',
      0,
      15,
      mockState,
      mockOptions
    )
    expect(result).toEqual([
      { type: RuleType.text, text: 'Hello ' },
      { type: RuleType.text, text: '*', endPos: 8 },
      { type: RuleType.text, text: 'world' },
      { type: RuleType.text, text: '*', endPos: 15 },
    ])
  })

  it('should handle line breaks', () => {
    const result = parseInlineSpan(
      'Hello  \nworld',
      0,
      13,
      mockState,
      mockOptions
    )
    expect(result).toEqual([
      { type: RuleType.text, text: 'Hello' },
      { type: RuleType.breakLine, endPos: 8 },
      { type: RuleType.text, text: 'world' },
    ])
  })

  it('should stop at special characters', () => {
    const result = parseInlineSpan(
      'Hello [world]',
      0,
      13,
      mockState,
      mockOptions
    )
    expect(result).toEqual([{ type: RuleType.text, text: 'Hello [world]' }])
  })
})

// Unit tests for individual parsers
describe('parseText', () => {
  it('should parse plain text', () => {
    const result = parseText('Hello world', 0, 11)
    expect(result).toEqual({
      type: RuleType.text,
      text: 'Hello world',
      endPos: 11,
    })
  })

  it('should handle HTML entities', () => {
    const result = parseText('Hello &amp; world', 0, 17)
    expect(result).toEqual({
      type: RuleType.text,
      text: 'Hello & world',
      endPos: 17,
    })
  })

  it('should handle standard HTML entities', () => {
    const result = parseText('Foo &nbsp; bar&amp;baz.', 0, 23)
    expect(result).toEqual({
      type: RuleType.text,
      text: 'Foo \u00a0 bar&baz.',
      endPos: 23,
    })
  })

  it('should handle escaped underscores', () => {
    const result = parseInlineSpan(
      'Hello.\\_\\_foo\\_\\_',
      0,
      17,
      mockState,
      mockOptions
    )
    expect(result).toEqual([
      { type: RuleType.text, text: 'Hello.' },
      { type: RuleType.text, text: '_', endPos: 8 },
      { type: RuleType.text, text: '_', endPos: 10 },
      { type: RuleType.text, text: 'foo' },
      { type: RuleType.text, text: '_', endPos: 15 },
      { type: RuleType.text, text: '_', endPos: 17 },
    ])
  })

  it('should stop at special characters', () => {
    const result = parseText('Hello [world]', 0, 13)
    expect(result).toEqual({
      type: RuleType.text,
      text: 'Hello ',
      endPos: 6,
    })
  })

  it('should stop at newlines', () => {
    const result = parseText('Hello\nworld', 0, 11)
    expect(result).toEqual({
      type: RuleType.text,
      text: 'Hello',
      endPos: 5,
    })
  })

  it('should return null for empty text', () => {
    const result = parseText('', 0, 0)
    expect(result).toBeNull()
  })
})

describe('parseTextEscaped', () => {
  it('should parse escaped asterisk', () => {
    const result = parseTextEscaped('\\*', 0)
    expect(result).toEqual({
      type: RuleType.text,
      text: '*',
      endPos: 2,
    })
  })

  it('should parse escaped backtick', () => {
    const result = parseTextEscaped('\\`', 0)
    expect(result).toEqual({
      type: RuleType.text,
      text: '`',
      endPos: 2,
    })
  })

  it('should return null for non-escaped character', () => {
    const result = parseTextEscaped('a', 0)
    expect(result).toBeNull()
  })

  it('should return null for escape at end of string', () => {
    const result = parseTextEscaped('\\', 0)
    expect(result).toBeNull()
  })

  it('should return null for non-escapable character', () => {
    const result = parseTextEscaped('\\z', 0)
    expect(result).toBeNull()
  })
})

describe('parseCodeInline', () => {
  it('should parse single backtick code', () => {
    const result = parseCodeInline('`code`', 0)
    expect(result).toEqual({
      type: RuleType.codeInline,
      text: 'code',
      endPos: 6,
    })
  })

  it('should parse triple backtick code', () => {
    const result = parseCodeInline('```code```', 0)
    expect(result).toEqual({
      type: RuleType.codeInline,
      text: 'code',
      endPos: 10,
    })
  })

  it('should handle backticks in code with double backticks', () => {
    const result = parseCodeInline('``code`more``', 0)
    expect(result).toEqual({
      type: RuleType.codeInline,
      text: 'code`more',
      endPos: 13,
    })
  })

  it('should handle naked backticks inside double backticks', () => {
    const result = parseCodeInline('``hi `foo` there``', 0)
    expect(result).toEqual({
      type: RuleType.codeInline,
      text: 'hi `foo` there',
      endPos: 18,
    })
  })

  it('should return null for unmatched backticks', () => {
    const result = parseCodeInline('`code', 0)
    expect(result).toBeNull()
  })

  it('should return null for non-backtick start', () => {
    const result = parseCodeInline('code', 0)
    expect(result).toBeNull()
  })
})

describe('parseBreakLine', () => {
  it('should parse line break', () => {
    const result = parseBreakLine('  \n', 0)
    expect(result).toEqual({
      type: RuleType.breakLine,
      endPos: 3,
    })
  })

  it('should return null for insufficient spaces', () => {
    const result = parseBreakLine(' \n', 0)
    expect(result).toBeNull()
  })

  it('should return null for no newline', () => {
    const result = parseBreakLine('  ', 0)
    expect(result).toBeNull()
  })
})

// Unit tests for link and image parsers
describe('parseLink', () => {
  it('should parse link with title', () => {
    const result = parseLink(
      '[text](url "title")',
      0,
      19,
      mockState,
      mockOptions
    )
    expect(result).toEqual({
      type: RuleType.link,
      children: [{ type: RuleType.text, text: 'text' }],
      target: 'url',
      title: 'title',
      endPos: 19,
    })
  })

  it('should parse link without title', () => {
    const result = parseLink('[text](url)', 0, 11, mockState, mockOptions)
    expect(result).toEqual({
      type: RuleType.link,
      children: [{ type: RuleType.text, text: 'text' }],
      target: 'url',
      title: undefined,
      endPos: 11,
    })
  })

  it('should return null for invalid link', () => {
    const result = parseLink('[text', 0, 6, mockState, mockOptions)
    expect(result).toBeNull()
  })
})

describe('parseImage', () => {
  it('should parse image with alt and title', () => {
    const result = parseImage('![alt](url "title")', 0, mockState, mockOptions)
    expect(result).toEqual({
      type: RuleType.image,
      alt: 'alt',
      target: 'url',
      title: 'title',
      endPos: 19,
    })
  })

  it('should parse image without title', () => {
    const result = parseImage('![alt](url)', 0, mockState, mockOptions)
    expect(result).toEqual({
      type: RuleType.image,
      alt: 'alt',
      target: 'url',
      title: undefined,
      endPos: 11,
    })
  })

  it('should return null for invalid image', () => {
    const result = parseImage('![alt', 0, mockState, mockOptions)
    expect(result).toBeNull()
  })
})

describe('parseLinkAngleBrace', () => {
  it('should parse URL in angle braces', () => {
    const result = parseLinkAngleBrace(
      '<http://example.com>',
      0,
      mockState,
      mockOptions
    )
    expect(result).toEqual({
      type: RuleType.link,
      children: [{ type: RuleType.text, text: 'http://example.com' }],
      target: 'http://example.com',
      endPos: 20,
    })
  })

  it('should parse email in angle braces', () => {
    const result = parseLinkAngleBrace(
      '<user@example.com>',
      0,
      mockState,
      mockOptions
    )
    expect(result).toEqual({
      type: RuleType.link,
      children: [{ type: RuleType.text, text: 'user@example.com' }],
      target: 'mailto:user@example.com',
      endPos: 18,
    })
  })

  it('should return null when not in inline mode', () => {
    const blockState = { ...mockState, inline: false }
    const result = parseLinkAngleBrace(
      '<http://example.com>',
      0,
      blockState,
      mockOptions
    )
    expect(result).toBeNull()
  })
})

describe('parseLinkBareUrl', () => {
  it('should parse bare HTTP URL', () => {
    const result = parseLinkBareUrl(
      'http://example.com',
      0,
      mockState,
      mockOptions
    )
    expect(result).toEqual({
      type: RuleType.link,
      children: [{ type: RuleType.text, text: 'http://example.com' }],
      target: 'http://example.com',
      title: undefined,
      endPos: 18,
    })
  })

  it('should parse URL until punctuation', () => {
    const result = parseLinkBareUrl(
      'http://example.com.',
      0,
      mockState,
      mockOptions
    )
    expect(result).toEqual({
      type: RuleType.link,
      children: [{ type: RuleType.text, text: 'http://example.com.' }],
      target: 'http://example.com.',
      title: undefined,
      endPos: 19,
    })
  })

  it('should return null when disabled', () => {
    const result = parseLinkBareUrl('http://example.com', 0, mockState, {
      ...mockOptions,
      disableAutoLink: true,
    })
    expect(result).toBeNull()
  })
})

describe('parseRefLink', () => {
  it('should parse reference link with ref', () => {
    const result = parseRefLink('[text][ref]', 0, mockState, mockOptions)
    expect(result).toEqual({
      type: RuleType.refLink,
      children: [{ type: RuleType.text, text: 'text' }],
      fallbackChildren: '[text][ref]',
      ref: 'ref',
      endPos: 11,
    })
  })

  it('should parse reference link with empty ref', () => {
    const result = parseRefLink('[text][]', 0, mockState, mockOptions)
    expect(result).toEqual({
      type: RuleType.refLink,
      children: [{ type: RuleType.text, text: 'text' }],
      fallbackChildren: '[text][]',
      ref: undefined,
      endPos: 8,
    })
  })

  it('should return null for regular links', () => {
    const result = parseRefLink('[text](url)', 0, mockState, mockOptions)
    expect(result).toBeNull()
  })
})

// Additional link edge case tests
describe('parseLink edge cases', () => {
  it('should handle brackets in link text', () => {
    const result = parseLink(
      '[[text]](https://example.com)',
      0,
      30,
      mockState,
      mockOptions
    )
    expect(result).toEqual({
      type: RuleType.link,
      children: [{ type: RuleType.text, text: '[text]' }],
      target: 'https://example.com',
      title: undefined,
      endPos: 29,
    })
  })
})

describe('parseRefImage', () => {
  it('should parse reference image', () => {
    const result = parseRefImage('![alt][ref]', 0, mockState, mockOptions)
    expect(result).toEqual({
      type: RuleType.refImage,
      alt: 'alt',
      ref: 'ref',
      endPos: 11,
    })
  })

  it('should parse reference image with empty ref', () => {
    const result = parseRefImage('![alt][]', 0, mockState, mockOptions)
    expect(result).toEqual({
      type: RuleType.refImage,
      alt: 'alt',
      ref: undefined,
      endPos: 8,
    })
  })

  it('should return null for invalid image', () => {
    const result = parseRefImage('![alt', 0, mockState, mockOptions)
    expect(result).toBeNull()
  })
})

// Unit tests for block parsers
describe('parseHeading', () => {
  it('should parse ATX heading level 1', () => {
    const result = parseHeading('# Hello World', 0, mockBlockState, mockOptions)
    expect(result).toEqual({
      type: RuleType.heading,
      level: 1,
      children: [{ type: RuleType.text, text: 'Hello World' }],
      id: 'hello-world',
      endPos: 13,
    })
  })

  it('should parse ATX heading level 2', () => {
    const result = parseHeading(
      '## Hello World',
      0,
      mockBlockState,
      mockOptions
    )
    expect(result).toEqual({
      type: RuleType.heading,
      level: 2,
      children: [{ type: RuleType.text, text: 'Hello World' }],
      id: 'hello-world',
      endPos: 14,
    })
  })

  it('should strip trailing #', () => {
    const result = parseHeading('# Hello #', 0, mockBlockState, mockOptions)
    expect(result).toEqual({
      type: RuleType.heading,
      level: 1,
      children: [{ type: RuleType.text, text: 'Hello' }],
      id: 'hello',
      endPos: 9,
    })
  })

  it('should return null when inline', () => {
    const inlineState = { ...mockState, inline: true }
    const result = parseHeading('# Hello', 0, inlineState, mockOptions)
    expect(result).toBeNull()
  })

  it('should return null without space after #', () => {
    const result = parseHeading('#Hello', 0, mockState, mockOptions)
    expect(result).toBeNull()
  })
})

describe('parseParagraph', () => {
  it('should parse simple paragraph', () => {
    const result = parseParagraph('Hello world', 0, mockBlockState, mockOptions)
    expect(result).toEqual({
      type: RuleType.paragraph,
      children: [{ type: RuleType.text, text: 'Hello world' }],
      endPos: 11,
    })
  })

  it('should stop at block start', () => {
    const result = parseParagraph(
      'Hello\n# World',
      0,
      mockBlockState,
      mockOptions
    )
    expect(result).toEqual({
      type: RuleType.paragraph,
      children: [{ type: RuleType.text, text: 'Hello' }],
      endPos: 5,
    })
  })

  it('should return null when inline', () => {
    const inlineState = { ...mockState, inline: true }
    const result = parseParagraph('Hello world', 0, inlineState, mockOptions)
    expect(result).toBeNull()
  })

  it('should return null for block start chars', () => {
    const result = parseParagraph('# Hello', 0, mockState, mockOptions)
    expect(result).toBeNull()
  })
})

describe('parseBreakThematic', () => {
  it('should parse dash thematic break', () => {
    const result = parseBreakThematic('---', 0)
    expect(result).toEqual({
      type: RuleType.breakThematic,
      endPos: 3,
    })
  })

  it('should parse asterisk thematic break', () => {
    const result = parseBreakThematic('***', 0)
    expect(result).toEqual({
      type: RuleType.breakThematic,
      endPos: 3,
    })
  })

  it('should not parse equals thematic break', () => {
    const result = parseBreakThematic('===', 0)
    expect(result).toBeNull()
  })

  it('should handle whitespace', () => {
    const result = parseBreakThematic('---   ', 0)
    expect(result).toEqual({
      type: RuleType.breakThematic,
      endPos: 6,
    })
  })

  it('should return null for insufficient chars', () => {
    const result = parseBreakThematic('--', 0)
    expect(result).toBeNull()
  })
})

describe('parseHeadingSetext', () => {
  it('should parse setext level 1 heading', () => {
    const result = parseHeadingSetext(
      'Hello World\n===',
      0,
      mockBlockState,
      mockOptions
    )
    expect(result).toEqual({
      type: RuleType.heading,
      level: 1,
      children: [{ type: RuleType.text, text: 'Hello World' }],
      id: 'hello-world',
      endPos: 15,
    })
  })

  it('should parse setext level 2 heading', () => {
    const result = parseHeadingSetext(
      'Hello World\n---',
      0,
      mockBlockState,
      mockOptions
    )
    expect(result).toEqual({
      type: RuleType.heading,
      level: 2,
      children: [{ type: RuleType.text, text: 'Hello World' }],
      id: 'hello-world',
      endPos: 15,
    })
  })

  it('should return null when inline', () => {
    const inlineState = { ...mockState, inline: true }
    const result = parseHeadingSetext('Hello\n===', 0, inlineState, mockOptions)
    expect(result).toBeNull()
  })

  it('should return null for block start chars', () => {
    const result = parseHeadingSetext('# Hello\n===', 0, mockState, mockOptions)
    expect(result).toBeNull()
  })
})

describe('parseCodeBlock', () => {
  it('should parse indented code block', () => {
    const result = parseCodeBlock('    code line 1\n    code line 2', 0)
    expect(result).toEqual({
      type: RuleType.codeBlock,
      text: 'code line 1\ncode line 2',
      endPos: 31,
    })
  })

  it('should parse tab-indented code', () => {
    const result = parseCodeBlock('\tcode line', 0)
    expect(result).toEqual({
      type: RuleType.codeBlock,
      text: 'code line',
      endPos: 10,
    })
  })

  it('should return null for insufficient indent', () => {
    const result = parseCodeBlock('  code', 0)
    expect(result).toBeNull()
  })

  it('should handle indented code block with blank lines that continue with indentation', () => {
    // This matches the fixture.md example around line 887-901
    // Code block with mixed 4-space and tab indentation, including blank lines
    const input = `
    \\   backslash
    \`   backtick
    *   asterisk
    _   underscore
    {}  curly braces
    []  square brackets
    ()  parentheses
    #   hash mark
    +   plus sign
    -   minus sign (hyphen)
    .   dot
    !   exclamation mark

`
    // Start parsing after the initial newline (position 1)
    const result = parseCodeBlock(input, 1)
    expect(result).not.toBeNull()
    expect(result?.type).toBe(RuleType.codeBlock)
    const codeNode = result as MarkdownToJSX.CodeBlockNode
    expect(codeNode.text).toBe(`\\   backslash
\`   backtick
*   asterisk
_   underscore
{}  curly braces
[]  square brackets
()  parentheses
#   hash mark
+   plus sign
-   minus sign (hyphen)
.   dot
!   exclamation mark`)
  })

  it('should stop code block at blank line followed by non-indented content', () => {
    // Code block should stop when blank line is followed by non-indented content
    const input = `    code line 1
    code line 2

not indented - stops here
`
    const result = parseCodeBlock(input, 0)
    expect(result).not.toBeNull()
    expect(result?.type).toBe(RuleType.codeBlock)
    const codeNode = result as MarkdownToJSX.CodeBlockNode
    expect(codeNode.text).toBe(`code line 1
code line 2`)
    // Should stop before the non-indented line
    expect(result?.endPos).toBeLessThan(input.length)
  })
})

describe('parseCodeFenced', () => {
  it('should parse fenced code block', () => {
    const result = parseCodeFenced('```\ncode\n```', 0, mockState, mockOptions)
    expect(result).toEqual({
      type: RuleType.codeBlock,
      text: 'code',
      lang: undefined,
      endPos: 12,
    })
  })

  it('should parse fenced code with language', () => {
    const result = parseCodeFenced(
      '```javascript\ncode\n```',
      0,
      mockState,
      mockOptions
    )
    expect(result).toEqual({
      type: RuleType.codeBlock,
      text: 'code',
      lang: 'javascript',
      endPos: 22,
    })
  })

  it('should return null for insufficient backticks', () => {
    const result = parseCodeFenced('``\ncode\n``', 0, mockState, mockOptions)
    expect(result).toBeNull()
  })

  it('should parse fenced code block with double newlines', () => {
    const result = parseCodeFenced(
      '```\nline1\n\nline2\n```',
      0,
      mockState,
      mockOptions
    )
    expect(result).toEqual({
      type: RuleType.codeBlock,
      text: 'line1\n\nline2',
      lang: undefined,
      endPos: 20,
    })
  })

  it('should preserve markdown syntax inside fenced code blocks', () => {
    const result = parseCodeFenced(
      '```\n**bold**\n_italic_\n[link](url)\n```',
      0,
      mockState,
      mockOptions
    )
    expect(result).toEqual({
      type: RuleType.codeBlock,
      text: '**bold**\n_italic_\n[link](url)',
      lang: undefined,
      endPos: 37,
    })
  })
})

// Unit tests for complex block parsers
describe('parseBlockQuote', () => {
  it('should parse simple blockquote', () => {
    const result = parseBlockQuote(
      '> Hello world',
      0,
      mockBlockState,
      mockOptions
    )
    expect(result).toEqual({
      type: RuleType.blockQuote,
      children: [
        {
          type: RuleType.paragraph,
          children: [{ type: RuleType.text, text: 'Hello world' }],
        },
      ],
      endPos: 13,
    })
  })

  it('should parse multi-line blockquote', () => {
    const result = parseBlockQuote(
      '> Line 1\n> Line 2',
      0,
      mockBlockState,
      mockOptions
    )
    expect(result).toEqual({
      type: RuleType.blockQuote,
      children: [
        {
          type: RuleType.paragraph,
          children: [
            { type: RuleType.text, text: 'Line 1' },
            { type: RuleType.text, text: '\n' },
            { type: RuleType.text, text: 'Line 2' },
          ],
        },
      ],
      endPos: 17,
    })
  })

  it('should return null when inline', () => {
    const result = parseBlockQuote('> Hello', 0, mockState, mockOptions)
    expect(result).toBeNull()
  })

  it('should return null without >', () => {
    const result = parseBlockQuote('Hello', 0, mockBlockState, mockOptions)
    expect(result).toBeNull()
  })
})

describe('parseOrderedList', () => {
  it('should parse simple ordered list', () => {
    const result = parseOrderedList(
      '1. First item\n2. Second item',
      0,
      mockBlockState,
      mockOptions
    )
    expect(result).toEqual({
      type: RuleType.orderedList,
      items: [
        [{ type: RuleType.text, text: 'First item' }],
        [{ type: RuleType.text, text: 'Second item' }],
      ],
      ordered: true,
      start: 1,
      endPos: 28,
    })
  })

  it('should parse ordered list with custom start', () => {
    const result = parseOrderedList(
      '5. Fifth item',
      0,
      mockBlockState,
      mockOptions
    )
    expect(result).toEqual({
      type: RuleType.orderedList,
      items: [[{ type: RuleType.text, text: 'Fifth item' }]],
      ordered: true,
      start: 5,
      endPos: 13,
    })
  })

  it('should return null when inline', () => {
    const result = parseOrderedList('1. Item', 0, mockState, mockOptions)
    expect(result).toBeNull()
  })

  it('should return null for invalid format', () => {
    const result = parseOrderedList(
      'Item without number',
      0,
      mockBlockState,
      mockOptions
    )
    expect(result).toBeNull()
  })
})

describe('parseUnorderedList', () => {
  it('should parse simple unordered list', () => {
    const result = parseUnorderedList(
      '- First item\n- Second item',
      0,
      mockBlockState,
      mockOptions
    )
    expect(result).toEqual({
      type: RuleType.unorderedList,
      items: [
        [{ type: RuleType.text, text: 'First item' }],
        [{ type: RuleType.text, text: 'Second item' }],
      ],
      ordered: false,
      endPos: 26,
    })
  })

  it('should parse unordered list with * marker', () => {
    const result = parseUnorderedList(
      '* Item 1\n* Item 2',
      0,
      mockBlockState,
      mockOptions
    )
    expect(result).toEqual({
      type: RuleType.unorderedList,
      items: [
        [{ type: RuleType.text, text: 'Item 1' }],
        [{ type: RuleType.text, text: 'Item 2' }],
      ],
      ordered: false,
      endPos: 17,
    })
  })

  it('should return null when inline', () => {
    const result = parseUnorderedList('- Item', 0, mockState, mockOptions)
    expect(result).toBeNull()
  })
})

describe('parseTable', () => {
  it('should parse simple table', () => {
    const table = 'Header 1|Header 2\n---|---\nCell 1|Cell 2'
    const result = parseTable(table, 0, mockBlockState, mockOptions)
    expect(result).toEqual({
      type: RuleType.table,
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
      align: [null, null],
      endPos: 39,
    })
  })

  it('should parse table with alignment', () => {
    const table = 'Left|Center|Right\n:-|:-:|-:\nL|C|R'
    const result = parseTable(table, 0, mockBlockState, mockOptions)
    expect(result).toEqual({
      type: RuleType.table,
      header: [
        [{ type: RuleType.text, text: 'Left' }],
        [{ type: RuleType.text, text: 'Center' }],
        [{ type: RuleType.text, text: 'Right' }],
      ],
      cells: [
        [
          [{ type: RuleType.text, text: 'L' }],
          [{ type: RuleType.text, text: 'C' }],
          [{ type: RuleType.text, text: 'R' }],
        ],
      ],
      align: ['left', 'center', 'right'],
      endPos: 33,
    })
  })

  it('should return null when inline', () => {
    const result = parseTable('A|B\n-|-\n1|2', 0, mockState, mockOptions)
    expect(result).toBeNull()
  })

  it('should return null for insufficient rows', () => {
    const result = parseTable('A|B\n-|-', 0, mockBlockState, mockOptions)
    expect(result).toBeNull()
  })

  it('should handle empty cells in table', () => {
    const table =
      '| Foo | Bar | Baz |\n| --- | --- | --- |\n|   | 2   | 3   |\n|   | 5   | 6   |'
    const result = parseTable(table, 0, mockBlockState, mockOptions)
    expect(result).toEqual({
      type: RuleType.table,
      header: [
        [{ type: RuleType.text, text: 'Foo' }],
        [{ type: RuleType.text, text: 'Bar' }],
        [{ type: RuleType.text, text: 'Baz' }],
      ],
      cells: [
        [
          [], // empty cell
          [{ type: RuleType.text, text: '2' }],
          [{ type: RuleType.text, text: '3' }],
        ],
        [
          [], // empty cell
          [{ type: RuleType.text, text: '5' }],
          [{ type: RuleType.text, text: '6' }],
        ],
      ],
      align: [null, null, null],
      endPos: 75,
    })
  })
})

// Unit tests for HTML element parsers
describe('parseHTMLComment', () => {
  it('should parse HTML comments', () => {
    const result = parseHTMLComment('<!-- comment -->', 0)
    expect(result).toEqual({
      type: RuleType.htmlComment,
      text: ' comment ',
      endPos: 16,
    })
  })

  it('should parse multiline HTML comments', () => {
    const result = parseHTMLComment('<!-- multi\nline\ncomment -->', 0)
    expect(result).toEqual({
      type: RuleType.htmlComment,
      text: ' multi\nline\ncomment ',
      endPos: 27,
    })
  })

  it('should return null for incomplete comments', () => {
    const result = parseHTMLComment('<!-- comment', 0)
    expect(result).toBeNull()
  })

  it('should return null if not starting with <!--', () => {
    const result = parseHTMLComment('<div>comment</div>', 0)
    expect(result).toBeNull()
  })
})

describe('parseHTML (self-closing)', () => {
  it('should parse self-closing tags', () => {
    const result = parseHTML('<br />', 0, mockState, mockOptions)
    expect(result).toEqual({
      type: RuleType.htmlSelfClosing,
      tag: 'br',
      attrs: {},
      endPos: 6,
    })
  })

  it('should parse self-closing tags with attributes', () => {
    const result = parseHTML(
      '<img src="test.jpg" alt="test" />',
      0,
      mockState,
      mockOptions
    )
    expect(result).toEqual({
      type: RuleType.htmlSelfClosing,
      tag: 'img',
      attrs: {
        src: 'test.jpg',
        alt: 'test',
      },
      endPos: 33,
    })
  })

  it('should parse self-closing tags without trailing slash', () => {
    const result = parseHTML('<br>', 0, mockState, mockOptions)
    expect(result).toEqual({
      type: RuleType.htmlSelfClosing,
      tag: 'br',
      attrs: {},
      endPos: 4,
    })
  })

  it('should return null if not starting with <', () => {
    const result = parseHTML('div>', 0, mockState, mockOptions)
    expect(result).toBeNull()
  })

  describe('SVG void elements', () => {
    it('should parse SVG circle without closing tag', () => {
      const result = parseHTML(
        '<circle cx="50" cy="50" r="40">',
        0,
        mockState,
        mockOptions
      )
      expect(result).not.toBeNull()
      expect(result?.type).toBe(RuleType.htmlSelfClosing)
      const node = result as MarkdownToJSX.HTMLSelfClosingNode
      expect(node.tag).toBe('circle')
      expect((node.attrs as any).cx).toBe('50')
    })

    it('should parse SVG path without closing tag', () => {
      const result = parseHTML(
        '<path d="M10 10"/>',
        0,
        mockState,
        mockOptions
      )
      expect(result).not.toBeNull()
      const node = result as MarkdownToJSX.HTMLSelfClosingNode
      expect(node.tag).toBe('path')
    })

    it('should parse SVG rect without closing tag', () => {
      const result = parseHTML(
        '<rect x="10" y="10" width="100" height="100">',
        0,
        mockState,
        mockOptions
      )
      expect(result).not.toBeNull()
      const node = result as MarkdownToJSX.HTMLSelfClosingNode
      expect(node.tag).toBe('rect')
    })

    it('should parse SVG line without closing tag', () => {
      const result = parseHTML(
        '<line x1="0" y1="0" x2="100" y2="100">',
        0,
        mockState,
        mockOptions
      )
      expect(result).not.toBeNull()
      const node = result as MarkdownToJSX.HTMLSelfClosingNode
      expect(node.tag).toBe('line')
    })

    it('should parse SVG polygon without closing tag', () => {
      const result = parseHTML(
        '<polygon points="10,10 50,50 10,50">',
        0,
        mockState,
        mockOptions
      )
      expect(result).not.toBeNull()
      const node = result as MarkdownToJSX.HTMLSelfClosingNode
      expect(node.tag).toBe('polygon')
    })

    it('should parse SVG ellipse without closing tag', () => {
      const result = parseHTML(
        '<ellipse cx="50" cy="50" rx="40" ry="30">',
        0,
        mockState,
        mockOptions
      )
      expect(result).not.toBeNull()
      const node = result as MarkdownToJSX.HTMLSelfClosingNode
      expect(node.tag).toBe('ellipse')
    })

    it('should parse SVG stop without closing tag', () => {
      const result = parseHTML(
        '<stop offset="0%" stop-color="red">',
        0,
        mockState,
        mockOptions
      )
      expect(result).not.toBeNull()
      const node = result as MarkdownToJSX.HTMLSelfClosingNode
      expect(node.tag).toBe('stop')
    })
  })

  describe('Custom web components (hyphenated)', () => {
    it('should parse custom web component without closing tag', () => {
      const result = parseHTML(
        '<my-component attr="value">',
        0,
        mockState,
        mockOptions
      )
      expect(result).not.toBeNull()
      const node = result as MarkdownToJSX.HTMLSelfClosingNode
      expect(node.tag).toBe('my-component')
      expect((node.attrs as any).attr).toBe('value')
    })

    it('should parse custom web component with self-closing syntax', () => {
      const result = parseHTML(
        '<my-custom-element />',
        0,
        mockState,
        mockOptions
      )
      expect(result).not.toBeNull()
      const node = result as MarkdownToJSX.HTMLSelfClosingNode
      expect(node.tag).toBe('my-custom-element')
    })

    it('should parse nested custom components', () => {
      const result = parseHTML(
        '<parent-component><child-component>',
        0,
        mockState,
        mockOptions
      )
      // Custom components without /> can be treated as void
      // The parent component will be parsed as void, child will be handled separately
      expect(result).not.toBeNull()
      const node = result as MarkdownToJSX.HTMLSelfClosingNode
      expect(node.tag).toBe('parent-component')
    })

    it('should parse multiple hyphenated custom components', () => {
      const result1 = parseHTML(
        '<ui-button>',
        0,
        mockState,
        mockOptions
      )
      expect(result1).not.toBeNull()
      const node1 = result1 as MarkdownToJSX.HTMLSelfClosingNode
      expect(node1.tag).toBe('ui-button')

      const result2 = parseHTML(
        '<data-table-cell>',
        0,
        mockState,
        mockOptions
      )
      expect(result2).not.toBeNull()
      const node2 = result2 as MarkdownToJSX.HTMLSelfClosingNode
      expect(node2.tag).toBe('data-table-cell')
    })

    it('should parse custom component with attributes', () => {
      const result = parseHTML(
        '<custom-input type="text" placeholder="Enter text">',
        0,
        mockState,
        mockOptions
      )
      expect(result).not.toBeNull()
      const node = result as MarkdownToJSX.HTMLSelfClosingNode
      expect(node.tag).toBe('custom-input')
      expect((node.attrs as any).type).toBe('text')
      expect((node.attrs as any).placeholder).toBe('Enter text')
    })
  })

  describe('Non-void elements should not parse as void', () => {
    it('should return null for div without closing tag', () => {
      const result = parseHTML('<div>', 0, mockState, mockOptions)
      expect(result).toBeNull() // div is not void, should return null (no closing tag found)
    })

    it('should return null for span without closing tag', () => {
      const result = parseHTML('<span>', 0, mockState, mockOptions)
      expect(result).toBeNull() // span is not void, should return null (no closing tag found)
    })

    it('should return null for p without closing tag', () => {
      const result = parseHTML('<p>', 0, mockState, mockOptions)
      expect(result).toBeNull() // p is not void
    })

    it('should return null for h1 without closing tag', () => {
      const result = parseHTML('<h1>', 0, mockState, mockOptions)
      expect(result).toBeNull() // h1 is not void
    })
  })

  describe('Void element edge cases', () => {
    it('should handle SVG elements with namespace prefixes', () => {
      const result = parseHTML(
        '<svg:circle cx="50" cy="50" r="40">',
        0,
        mockState,
        mockOptions
      )
      // Circle is still void even with namespace
      expect(result).not.toBeNull()
    })

    it('should handle custom components with numbers', () => {
      const result = parseHTML(
        '<my-component-v2>',
        0,
        mockState,
        mockOptions
      )
      expect(result).not.toBeNull()
      const node = result as MarkdownToJSX.HTMLSelfClosingNode
      expect(node.tag).toBe('my-component-v2')
    })

    it('should handle custom components with multiple hyphens', () => {
      const result = parseHTML(
        '<my-custom-web-component>',
        0,
        mockState,
        mockOptions
      )
      expect(result).not.toBeNull()
      const node = result as MarkdownToJSX.HTMLSelfClosingNode
      expect(node.tag).toBe('my-custom-web-component')
    })

    it('should handle void elements in markdown context', () => {
      const inlineResult = parseInlineSpan(
        'Text <br> more text',
        0,
        19,
        mockState,
        mockOptions
      )
      expect(inlineResult.length).toBeGreaterThan(1)
      const brNode = inlineResult.find(n => n.type === RuleType.htmlSelfClosing)
      expect(brNode).toBeDefined()
    })
  })

  describe('Void elements with markdown formatting', () => {
    it('should handle void element in bold text', () => {
      const inlineResult = parseInlineSpan(
        '**Text <img src="test.jpg"> more**',
        0,
        33,
        mockState,
        mockOptions
      )
      expect(inlineResult.length).toBeGreaterThan(0)
    })

    it('should handle multiple void elements in sequence', () => {
      const inlineResult = parseInlineSpan(
        '<br><hr><img src="test.jpg">',
        0,
        27,
        mockState,
        mockOptions
      )
      expect(inlineResult.length).toBeGreaterThan(0)
    })

    it('should handle SVG void elements in paragraphs', () => {
      const state = { inline: false }
      const result = parseParagraph(
        'Text <circle cx="50" cy="50" r="40"> more text',
        0,
        state,
        mockOptions
      )
      expect(result).not.toBeNull()
    })
  })
})

describe('parseHTML (block)', () => {
  it('should parse HTML blocks', () => {
    const result = parseHTML('<div>Hello</div>', 0, mockState, mockOptions)
    expect(result).toEqual({
      type: RuleType.htmlBlock,
      tag: 'div',
      attrs: {},
      children: [{ type: RuleType.text, text: 'Hello' }],
      noInnerParse: false,
      endPos: 16,
    })
  })

  it('should parse HTML blocks with attributes', () => {
    const result = parseHTML(
      '<p class="test">Content</p>',
      0,
      mockState,
      mockOptions
    )
    expect(result).toEqual({
      type: RuleType.htmlBlock,
      tag: 'p',
      attrs: { className: 'test' },
      children: [{ type: RuleType.text, text: 'Content' }],
      noInnerParse: false,
      endPos: 27,
    })
  })

  it('should return null for unmatched tags', () => {
    const result = parseHTML('<div>Hello', 0, mockState, mockOptions)
    expect(result).toBeNull()
  })

  it('should return null if not starting with <', () => {
    const result = parseHTML('div>Hello</div>', 0, mockState, mockOptions)
    expect(result).toBeNull()
  })

  it('should parse math tag with nested elements', () => {
    const mathMarkup = `<math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><semantics><mrow><mfrac><mrow>a</mrow><mrow>2</mrow></mfrac></mrow><annotation encoding="application/x-tex">\\frac{a}{2}</annotation></semantics></math>`
    const result = parseHTML(mathMarkup, 0, mockState, mockOptions)
    expect(result).not.toBeNull()
    expect(result?.type).toBe(RuleType.htmlBlock)
    if (result?.type === RuleType.htmlBlock) {
      expect(result.tag).toBe('math')
      expect(result.attrs).toHaveProperty(
        'xmlns',
        'http://www.w3.org/1998/Math/MathML'
      )
      expect(result.attrs).toHaveProperty('display', 'block')
    }
  })

  it('should parse multiline math tag with nested elements', () => {
    const mathMarkup = `<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
<semantics>
  <mrow><mfrac><mrow><msqrt><mrow>a</mrow></msqrt></mrow><mrow><mn>2</mn></mrow></mfrac></mrow>
  <annotation encoding="application/x-tex">\\frac{\\sqrt{a}}{2}</annotation>
</semantics>
</math>`
    const result = parseHTML(mathMarkup, 0, mockState, mockOptions)
    expect(result).not.toBeNull()
    expect(result?.type).toBe(RuleType.htmlBlock)
    if (result?.type === RuleType.htmlBlock) {
      expect(result.tag).toBe('math')
      expect(result.attrs).toHaveProperty(
        'xmlns',
        'http://www.w3.org/1998/Math/MathML'
      )
      expect(result.attrs).toHaveProperty('display', 'block')
    }
  })
})

// Unit tests for reference and footnote parsers
describe('parseGFMTask', () => {
  it('should parse unchecked task', () => {
    const result = parseGFMTask('[ ]', 0)
    expect(result).toEqual({
      type: RuleType.gfmTask,
      completed: false,
      endPos: 3,
    })
  })

  it('should parse checked task with lowercase x', () => {
    const result = parseGFMTask('[x]', 0)
    expect(result).toEqual({
      type: RuleType.gfmTask,
      completed: true,
      endPos: 3,
    })
  })

  it('should parse checked task with uppercase X', () => {
    const result = parseGFMTask('[X]', 0)
    expect(result).toEqual({
      type: RuleType.gfmTask,
      completed: true,
      endPos: 3,
    })
  })

  it('should return null for invalid marker', () => {
    const result = parseGFMTask('[a]', 0)
    expect(result).toBeNull()
  })

  it('should return null if not starting with [', () => {
    const result = parseGFMTask('x]', 0)
    expect(result).toBeNull()
  })
})

describe('parseFootnoteReference', () => {
  it('should parse footnote reference', () => {
    const result = parseFootnoteReference('[^abc]', 0, mockState, mockOptions)
    expect(result).toEqual({
      type: RuleType.footnoteReference,
      target: '#abc',
      text: 'abc',
      endPos: 6,
    })
  })

  it('should parse footnote reference with complex identifier', () => {
    const result = parseFootnoteReference(
      '[^ref-erence_123]',
      0,
      mockState,
      mockOptions
    )
    expect(result).toEqual({
      type: RuleType.footnoteReference,
      target: '#ref-erence-123',
      text: 'ref-erence_123',
      endPos: 17,
    })
  })

  it('should return null if not starting with [^', () => {
    const result = parseFootnoteReference('[abc]', 0, mockState, mockOptions)
    expect(result).toBeNull()
  })

  it('should return null for unclosed reference', () => {
    const result = parseFootnoteReference('[^abc', 0, mockState, mockOptions)
    expect(result).toBeNull()
  })
})

describe('parseRef', () => {
  const mockRefs = {}

  it('should parse reference definition', () => {
    const result = parseRef('[ref]: http://example.com', 0, mockRefs)
    expect(result).toEqual({
      type: RuleType.ref,
      endPos: 25,
    })
    expect(mockRefs).toEqual({
      ref: { target: 'http://example.com', title: undefined },
    })
  })

  it('should parse reference definition with title', () => {
    const result = parseRef('[ref2]: http://example.com "title"', 0, mockRefs)
    expect(result).toEqual({
      type: RuleType.ref,
      endPos: 34,
    })
    expect(mockRefs).toEqual({
      ref: { target: 'http://example.com', title: undefined },
      ref2: { target: 'http://example.com', title: 'title' },
    })
  })

  it('should parse reference definition with angle brackets', () => {
    const result = parseRef('[ref3]: <http://example.com>', 0, mockRefs)
    expect(result).toEqual({
      type: RuleType.ref,
      endPos: 28,
    })
    expect(mockRefs).toEqual({
      ref: { target: 'http://example.com', title: undefined },
      ref2: { target: 'http://example.com', title: 'title' },
      ref3: { target: 'http://example.com', title: undefined },
    })
  })

  it('should return null if not starting with [', () => {
    const result = parseRef('ref: http://example.com', 0, mockRefs)
    expect(result).toBeNull()
  })
})

describe('matchInlineFormatting', () => {
  describe('basic single delimiters', () => {
    it('should match *italic*', () => {
      const str = '*italic*'
      const result = matchInlineFormatting(str, 0, str.length, {
        inline: true,
      })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('*italic*')
      expect(result[1]).toBe('em')
      expect(result[2]).toBe('italic')
    })

    it('should match _italic_', () => {
      const str = '_italic_'
      const result = matchInlineFormatting(str, 0, str.length, {
        inline: true,
      })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('_italic_')
      expect(result[1]).toBe('em')
      expect(result[2]).toBe('italic')
    })

    it('should match **bold**', () => {
      const str = '**bold**'
      const result = matchInlineFormatting(str, 0, str.length, {
        inline: true,
      })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('**bold**')
      expect(result[1]).toBe('strong')
      expect(result[2]).toBe('bold')
    })

    it('should match __bold__', () => {
      const str = '__bold__'
      const result = matchInlineFormatting(str, 0, str.length, {
        inline: true,
      })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('__bold__')
      expect(result[1]).toBe('strong')
      expect(result[2]).toBe('bold')
    })

    it('should match ~~strikethrough~~', () => {
      const str = '~~strikethrough~~'
      const result = matchInlineFormatting(str, 0, str.length, {
        inline: true,
      })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('~~strikethrough~~')
      expect(result[1]).toBe('del')
      expect(result[2]).toBe('strikethrough')
    })

    it('should match ==marked==', () => {
      const str = '==marked=='
      const result = matchInlineFormatting(str, 0, str.length, {
        inline: true,
      })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('==marked==')
      expect(result[1]).toBe('mark')
      expect(result[2]).toBe('marked')
    })
  })

  describe('triple delimiters', () => {
    it('should match ***bold italic*** as ** with nested *', () => {
      const str = '***bold italic***'
      const result = matchInlineFormatting(str, 0, str.length, {
        inline: true,
      })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('***bold italic***')
      expect(result[1]).toBe('strong')
      expect(result[2]).toBe('*bold italic*')
    })

    it('should match ___bold italic___ as __ with nested _', () => {
      const str = '___bold italic___'
      const result = matchInlineFormatting(str, 0, str.length, {
        inline: true,
      })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('___bold italic___')
      expect(result[1]).toBe('strong')
      expect(result[2]).toBe('_bold italic_')
    })
  })

  describe('escaped delimiters', () => {
    it('should skip escaped opening delimiter', () => {
      const str = '\\*not italic\\*'
      const result = matchInlineFormatting(str, 0, str.length, {
        inline: true,
      })!
      expect(result).toBeNull()
    })

    it('should skip escaped closing delimiter and continue', () => {
      const str = '*italic \\* still italic*'
      const result = matchInlineFormatting(str, 0, str.length, {
        inline: true,
      })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('*italic \\* still italic*')
      expect(result[1]).toBe('em')
      expect(result[2]).toBe('italic \\* still italic')
    })
  })

  describe('inline code blocks', () => {
    it('should skip delimiters inside inline code', () => {
      const str = '*foo `code*` bar*'
      const result = matchInlineFormatting(str, 0, str.length, {
        inline: true,
      })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('*foo `code*` bar*')
      expect(result[1]).toBe('em')
      expect(result[2]).toBe('foo `code*` bar')
    })
  })

  describe('HTML tags', () => {
    it('should skip delimiters inside HTML tags', () => {
      const str = '*foo <span>*</span> bar*'
      const result = matchInlineFormatting(str, 0, str.length, {
        inline: true,
      })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('*foo <span>*</span> bar*')
      expect(result[1]).toBe('em')
      expect(result[2]).toBe('foo <span>*</span> bar')
    })

    it('should handle self-closing HTML tags', () => {
      const str = '*text <br /> more*'
      const result = matchInlineFormatting(str, 0, str.length, {
        inline: true,
      })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('*text <br /> more*')
      expect(result[1]).toBe('em')
      expect(result[2]).toBe('text <br /> more')
    })
  })

  describe('double newline boundary', () => {
    it('should return null when encountering double newline', () => {
      const str = '*foo\n\nbar*'
      const result = matchInlineFormatting(str, 0, str.length, {
        inline: true,
      })!
      expect(result).toBeNull()
    })

    it('should allow single newlines', () => {
      const str = '*foo\nbar*'
      const result = matchInlineFormatting(str, 0, str.length, {
        inline: true,
      })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('*foo\nbar*')
      expect(result[1]).toBe('em')
      expect(result[2]).toBe('foo\nbar')
    })
  })

  describe('link and reference syntax', () => {
    it('should skip delimiters inside link text [*](url)', () => {
      const str = '*text [*](url) more*'
      const result = matchInlineFormatting(str, 0, str.length, {
        inline: true,
      })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('*text [*](url) more*')
      expect(result[1]).toBe('em')
      expect(result[2]).toBe('text [*](url) more')
    })

    it('should handle nested brackets in link text', () => {
      const str = '*text [foo [bar]](url) more*'
      const result = matchInlineFormatting(str, 0, str.length, {
        inline: true,
      })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('*text [foo [bar]](url) more*')
      expect(result[2]).toBe('text [foo [bar]](url) more')
    })
  })

  describe('state handling', () => {
    it('should return null when not inline or simple', () => {
      const str = '*italic*'
      const result = matchInlineFormatting(str, 0, str.length, {})!
      expect(result).toBeNull()
    })

    it('should work with simple state', () => {
      const str = '*italic*'
      const result = matchInlineFormatting(str, 0, str.length, {
        simple: true,
      })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('*italic*')
    })
  })

  describe('edge cases', () => {
    it('should return null for empty string', () => {
      const str = ''
      const result = matchInlineFormatting(str, 0, str.length, {
        inline: true,
      })!
      expect(result).toBeNull()
    })

    it('should handle empty content between delimiters', () => {
      const str = '****'
      const result = matchInlineFormatting(str, 0, str.length, {
        inline: true,
      })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('****')
      expect(result[1]).toBe('strong')
      expect(result[2]).toBe('')
    })
  })
})

describe('parseFootnote', () => {
  const mockFootnotes: { footnote: string; identifier: string }[] = []

  it('should parse footnote definition', () => {
    const result = parseFootnote('[^abc]: This is a footnote', 0, mockFootnotes)
    expect(result).toEqual({
      type: RuleType.footnote,
      endPos: 26,
    })
    expect(mockFootnotes).toEqual([
      { footnote: 'This is a footnote', identifier: 'abc' },
    ])
  })

  it('should parse multiline footnote', () => {
    const result = parseFootnote(
      '[^def]: First line\n    Second line\n    Third line',
      0,
      mockFootnotes
    )
    expect(result).toEqual({
      type: RuleType.footnote,
      endPos: 49,
    })
    expect(mockFootnotes).toEqual([
      { footnote: 'This is a footnote', identifier: 'abc' },
      { footnote: 'First line\nSecond line\nThird line', identifier: 'def' },
    ])
  })

  it('should return null if not starting with [^', () => {
    const result = parseFootnote('[abc]: footnote', 0, mockFootnotes)
    expect(result).toBeNull()
  })
})

describe('parseInlineSpan - nested anchor links', () => {
  it('should not parse URLs as links when inside anchor tags', () => {
    // This test reproduces the failing compiler test
    const input =
      '<a href="https://google.com">some text <span>with a link https://google.com</span></a>'
    const result = parseInlineSpan(
      input,
      0,
      input.length,
      mockState,
      mockOptions
    )

    // The URL inside the anchor should NOT be parsed as a link
    // It should remain as plain text
    expect(result).toBeDefined()

    // Check that there's no link node containing "https://google.com"
    const hasUrlLink =
      JSON.stringify(result).includes('"type":"link"') &&
      JSON.stringify(result).includes('https://google.com')
    expect(hasUrlLink).toBe(false)
  })

  it('should parse URLs as links when not inside anchor tags', () => {
    const input = 'some text with a link https://google.com'
    const result = parseInlineSpan(
      input,
      0,
      input.length,
      mockState,
      mockOptions
    )

    expect(result).toBeDefined()

    // Should have a link node
    const hasUrlLink =
      JSON.stringify(result).includes('"type":"link"') &&
      JSON.stringify(result).includes('https://google.com')
    expect(hasUrlLink).toBe(true)
  })
})

describe('Unicode support', () => {
  describe('Japanese text', () => {
    it('should parse Japanese hiragana text', () => {
      const result = parseInlineSpan('こんにちは', 0, 5, mockState, mockOptions)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(RuleType.text)
      expect((result[0] as MarkdownToJSX.TextNode).text).toBe('こんにちは')
    })

    it('should parse Japanese katakana text', () => {
      const result = parseInlineSpan('コンニチハ', 0, 5, mockState, mockOptions)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(RuleType.text)
      expect((result[0] as MarkdownToJSX.TextNode).text).toBe('コンニチハ')
    })

    it('should parse Japanese kanji text', () => {
      const result = parseInlineSpan('日本語', 0, 3, mockState, mockOptions)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(RuleType.text)
      expect((result[0] as MarkdownToJSX.TextNode).text).toBe('日本語')
    })

    it('should parse mixed Japanese and English', () => {
      const result = parseInlineSpan(
        'Hello こんにちは World',
        0,
        20,
        mockState,
        mockOptions
      )
      expect(result.length).toBeGreaterThan(0)
      const textNodes = result.filter(
        node => node.type === RuleType.text
      ) as MarkdownToJSX.TextNode[]
      const combinedText = textNodes.map(n => n.text).join('')
      expect(combinedText).toContain('Hello')
      expect(combinedText).toContain('こんにちは')
      expect(combinedText).toContain('World')
    })

    it('should parse Japanese text with markdown formatting', () => {
      const result = parseInlineSpan('**日本語**', 0, 7, mockState, mockOptions)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(RuleType.textFormatted)
      const formatted = result[0] as MarkdownToJSX.FormattedTextNode
      expect(formatted.tag).toBe('strong')
      expect(formatted.children).toHaveLength(1)
      expect((formatted.children[0] as MarkdownToJSX.TextNode).text).toBe(
        '日本語'
      )
    })

    it('should parse Japanese text in links', () => {
      const result = parseInlineSpan(
        '[日本語](https://example.com)',
        0,
        29,
        mockState,
        mockOptions
      )
      const linkNodes = result.filter(node => node.type === RuleType.link)
      expect(linkNodes.length).toBeGreaterThan(0)
      const link = linkNodes[0] as MarkdownToJSX.LinkNode
      expect(link.target).toBe('https://example.com')
      expect(link.children).toHaveLength(1)
      expect((link.children[0] as MarkdownToJSX.TextNode).text).toBe('日本語')
    })

    it('should parse Japanese text in paragraphs', () => {
      const state = { inline: false }
      const result = parseParagraph('日本語の段落です。', 0, state, mockOptions)
      expect(result).not.toBeNull()
      expect(result?.type).toBe(RuleType.paragraph)
      const para = result as MarkdownToJSX.ParagraphNode
      expect(para.children.length).toBeGreaterThan(0)
      const textNodes = para.children.filter(
        node => node.type === RuleType.text
      ) as MarkdownToJSX.TextNode[]
      const combinedText = textNodes.map(n => n.text).join('')
      expect(combinedText).toContain('日本語')
    })

    it('should parse Japanese text in headings', () => {
      const state = { inline: false }
      const result = parseHeading('# 日本語の見出し', 0, state, mockOptions)
      expect(result).not.toBeNull()
      expect(result?.type).toBe(RuleType.heading)
      const heading = result as MarkdownToJSX.HeadingNode
      expect(heading.children.length).toBeGreaterThan(0)
      const textNodes = heading.children.filter(
        node => node.type === RuleType.text
      ) as MarkdownToJSX.TextNode[]
      const combinedText = textNodes.map(n => n.text).join('')
      expect(combinedText).toContain('日本語')
    })
  })

  describe('Other Unicode scripts', () => {
    it('should parse Chinese text', () => {
      const result = parseInlineSpan('你好世界', 0, 4, mockState, mockOptions)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(RuleType.text)
      expect((result[0] as MarkdownToJSX.TextNode).text).toBe('你好世界')
    })

    it('should parse Korean text', () => {
      const result = parseInlineSpan('안녕하세요', 0, 5, mockState, mockOptions)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(RuleType.text)
      expect((result[0] as MarkdownToJSX.TextNode).text).toBe('안녕하세요')
    })

    it('should parse Arabic text', () => {
      const result = parseInlineSpan('مرحبا', 0, 5, mockState, mockOptions)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(RuleType.text)
      expect((result[0] as MarkdownToJSX.TextNode).text).toBe('مرحبا')
    })

    it('should parse Cyrillic text', () => {
      const result = parseInlineSpan('Привет', 0, 6, mockState, mockOptions)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(RuleType.text)
      expect((result[0] as MarkdownToJSX.TextNode).text).toBe('Привет')
    })

    it('should parse emoji', () => {
      const text = 'Hello 👋 World 🌍'
      const result = parseInlineSpan(
        text,
        0,
        text.length,
        mockState,
        mockOptions
      )
      expect(result.length).toBeGreaterThan(0)
      const textNodes = result.filter(
        node => node.type === RuleType.text
      ) as MarkdownToJSX.TextNode[]
      const combinedText = textNodes.map(n => n.text).join('')
      expect(combinedText).toContain('👋')
      expect(combinedText).toContain('🌍')
    })

    it('should parse text with combining characters', () => {
      const result = parseInlineSpan(
        'café naïve',
        0,
        10,
        mockState,
        mockOptions
      )
      expect(result.length).toBeGreaterThan(0)
      const textNodes = result.filter(
        node => node.type === RuleType.text
      ) as MarkdownToJSX.TextNode[]
      const combinedText = textNodes.map(n => n.text).join('')
      expect(combinedText).toContain('café')
      expect(combinedText).toContain('naïve')
    })
  })

  describe('Unicode word boundaries', () => {
    it('should handle Unicode word boundaries in anchor tag detection', () => {
      const state = { inline: true }
      const result = parseInlineSpan(
        '<a href="#">リンク</a>',
        0,
        23,
        state,
        mockOptions
      )
      expect(result.length).toBeGreaterThan(0)
      const htmlNodes = result.filter(node => node.type === RuleType.htmlBlock)
      expect(htmlNodes.length).toBeGreaterThan(0)
    })

    it('should handle Unicode in HTML tag attributes', () => {
      const state = { inline: true }
      const result = parseInlineSpan(
        '<div title="日本語">テキスト</div>',
        0,
        32,
        state,
        mockOptions
      )
      expect(result.length).toBeGreaterThan(0)
    })

    it('should handle Unicode characters adjacent to HTML tags', () => {
      const state = { inline: true }
      const result = parseInlineSpan(
        '日本語<div>テキスト</div>日本語',
        0,
        24,
        state,
        mockOptions
      )
      expect(result.length).toBeGreaterThan(0)
      const textNodes = result.filter(
        node => node.type === RuleType.text
      ) as MarkdownToJSX.TextNode[]
      const combinedText = textNodes.map(n => n.text).join('')
      expect(combinedText).toContain('日本語')
    })
  })

  describe('Unicode in code blocks', () => {
    it('should preserve Unicode in inline code', () => {
      const result = parseCodeInline('`日本語`', 0)
      expect(result).not.toBeNull()
      expect(result?.type).toBe(RuleType.codeInline)
      expect((result as MarkdownToJSX.CodeInlineNode).text).toBe('日本語')
    })

    it('should preserve Unicode in fenced code blocks', () => {
      const state = { inline: false }
      const code = '```\n日本語のコード\n```'
      const result = parseCodeFenced(code, 0, state, mockOptions)
      expect(result).not.toBeNull()
      // parseCodeFenced may return codeBlock or codeFenced depending on implementation
      expect([RuleType.codeFenced, RuleType.codeBlock]).toContain(result?.type)
      expect(result?.endPos).toBeGreaterThan(0)
    })
  })

  describe('Unicode in lists', () => {
    it('should parse Unicode text in unordered lists', () => {
      const state = { inline: false }
      const result = parseUnorderedList('- 日本語の項目', 0, state, mockOptions)
      expect(result).not.toBeNull()
      expect(result?.type).toBe(RuleType.unorderedList)
      const list = result as MarkdownToJSX.UnorderedListNode
      expect(list.items.length).toBeGreaterThan(0)
      expect(list.items[0].length).toBeGreaterThan(0)
    })

    it('should parse Unicode text in ordered lists', () => {
      const state = { inline: false }
      const result = parseOrderedList('1. 日本語の項目', 0, state, mockOptions)
      expect(result).not.toBeNull()
      expect(result?.type).toBe(RuleType.orderedList)
      const list = result as MarkdownToJSX.OrderedListNode
      expect(list.items.length).toBeGreaterThan(0)
      expect(list.items[0].length).toBeGreaterThan(0)
    })
  })
})
