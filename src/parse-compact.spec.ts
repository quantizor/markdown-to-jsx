import { describe, it, expect } from 'bun:test'
import { parseMarkdownCompact } from './parse-compact'
import { RuleType } from './types'

describe('Compact Parser', () => {
  describe('Headings', () => {
    it('parses ATX heading level 1', () => {
      const result = parseMarkdownCompact('# Heading')
      expect(result[0].type).toBe(RuleType.heading)
      expect((result[0] as any).level).toBe(1)
    })
    
    it('parses ATX heading level 6', () => {
      const result = parseMarkdownCompact('###### Heading')
      expect(result[0].type).toBe(RuleType.heading)
      expect((result[0] as any).level).toBe(6)
    })
    
    it('strips trailing hashes', () => {
      const result = parseMarkdownCompact('# Heading ###')
      expect(result[0].type).toBe(RuleType.heading)
    })
  })
  
  describe('Thematic breaks', () => {
    it('parses dashes', () => {
      const result = parseMarkdownCompact('---')
      expect(result[0].type).toBe(RuleType.breakThematic)
    })
    
    it('parses asterisks', () => {
      const result = parseMarkdownCompact('***')
      expect(result[0].type).toBe(RuleType.breakThematic)
    })
    
    it('parses underscores', () => {
      const result = parseMarkdownCompact('___')
      expect(result[0].type).toBe(RuleType.breakThematic)
    })
    
    it('allows spaces between', () => {
      const result = parseMarkdownCompact('- - -')
      expect(result[0].type).toBe(RuleType.breakThematic)
    })
  })
  
  describe('Code blocks', () => {
    it('parses fenced code block', () => {
      const result = parseMarkdownCompact('```\ncode\n```')
      expect(result[0].type).toBe(RuleType.codeBlock)
      expect((result[0] as any).text).toBe('code')
    })
    
    it('parses fenced code with language', () => {
      const result = parseMarkdownCompact('```js\nconst x = 1\n```')
      expect(result[0].type).toBe(RuleType.codeBlock)
      expect((result[0] as any).lang).toBe('js')
    })
    
    it('parses indented code block', () => {
      const result = parseMarkdownCompact('    code')
      expect(result[0].type).toBe(RuleType.codeBlock)
      expect((result[0] as any).text).toBe('code')
    })
  })
  
  describe('Blockquotes', () => {
    it('parses simple blockquote', () => {
      const result = parseMarkdownCompact('> quote')
      expect(result[0].type).toBe(RuleType.blockQuote)
    })
    
    it('parses multi-line blockquote', () => {
      const result = parseMarkdownCompact('> line1\n> line2')
      expect(result[0].type).toBe(RuleType.blockQuote)
    })
  })
  
  describe('Paragraphs', () => {
    it('parses simple paragraph', () => {
      const result = parseMarkdownCompact('Hello world')
      expect(result[0].type).toBe(RuleType.paragraph)
    })
  })
  
  describe('Inline code', () => {
    it('parses inline code', () => {
      const result = parseMarkdownCompact('Hello `code` world')
      expect(result[0].type).toBe(RuleType.paragraph)
      const children = (result[0] as any).children
      expect(children[1].type).toBe(RuleType.codeInline)
      expect(children[1].text).toBe('code')
    })
  })
  
  describe('Emphasis', () => {
    it('parses emphasis with asterisk', () => {
      const result = parseMarkdownCompact('*em*')
      expect(result[0].type).toBe(RuleType.paragraph)
      const children = (result[0] as any).children
      expect(children[0].type).toBe(RuleType.textFormatted)
      expect(children[0].format).toBe('em')
    })
    
    it('parses strong with asterisks', () => {
      const result = parseMarkdownCompact('**strong**')
      expect(result[0].type).toBe(RuleType.paragraph)
      const children = (result[0] as any).children
      expect(children[0].type).toBe(RuleType.textFormatted)
      expect(children[0].format).toBe('strong')
    })
  })
})

describe('Lists', () => {
  it('parses unordered list with dash', () => {
    const result = parseMarkdownCompact('- item 1\n- item 2')
    expect(result[0].type).toBe(RuleType.unorderedList)
    expect((result[0] as any).items.length).toBe(2)
  })
  
  it('parses ordered list', () => {
    const result = parseMarkdownCompact('1. first\n2. second')
    expect(result[0].type).toBe(RuleType.orderedList)
    expect((result[0] as any).items.length).toBe(2)
  })
})

describe('Links', () => {
  it('parses inline link', () => {
    const result = parseMarkdownCompact('[link](http://example.com)')
    expect(result[0].type).toBe(RuleType.paragraph)
    const link = (result[0] as any).children[0]
    expect(link.type).toBe(RuleType.link)
    expect(link.target).toBe('http://example.com')
  })
  
  it('parses link with title', () => {
    const result = parseMarkdownCompact('[link](http://example.com "title")')
    expect(result[0].type).toBe(RuleType.paragraph)
    const link = (result[0] as any).children[0]
    expect(link.title).toBe('title')
  })
})

describe('Images', () => {
  it('parses image', () => {
    const result = parseMarkdownCompact('![alt](http://example.com/img.png)')
    expect(result[0].type).toBe(RuleType.paragraph)
    const img = (result[0] as any).children[0]
    expect(img.type).toBe(RuleType.image)
    expect(img.alt).toBe('alt')
    expect(img.target).toBe('http://example.com/img.png')
  })
})
