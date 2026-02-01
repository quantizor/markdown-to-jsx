import { describe, expect, it } from 'bun:test'
import { parser } from './parse-compact'
import { compiler as htmlCompiler } from './html'

describe('Streaming optimization - inline code', () => {
  it('should remove incomplete inline code backtick and content', () => {
    const result = parser('Some text `incomplete', { optimizeForStreaming: true })
    const html = htmlCompiler('Some text `incomplete', {
      optimizeForStreaming: true,
    })

    // Should show "Some text" without the backtick
    expect(html).toContain('Some text')
    expect(html).not.toContain('`')
  })

  it('should show complete inline code normally', () => {
    const html = htmlCompiler('Some `code` here', {
      optimizeForStreaming: true,
    })

    expect(html).toContain('<code>code</code>')
    expect(html).not.toContain('`')
  })

  it('should handle multiple incomplete backticks', () => {
    const html = htmlCompiler('Text `code` and `incomplete', {
      optimizeForStreaming: true,
    })

    expect(html).toContain('<code>code</code>')
    expect(html).toContain(' and')
    expect(html).not.toContain('incomplete')
  })
})

describe('Streaming optimization - code blocks', () => {
  it('should show incomplete code block content', () => {
    const html = htmlCompiler('```js\nconst x = 1', {
      optimizeForStreaming: true,
    })

    expect(html).toContain('const x = 1')
  })

  it('should show complete code blocks normally', () => {
    const html = htmlCompiler('```js\nconst x = 1\n```', {
      optimizeForStreaming: true,
    })

    expect(html).toContain('<pre>')
    expect(html).toContain('const x = 1')
  })
})

describe('Streaming optimization - tables', () => {
  it('should show incomplete table as plain text', () => {
    const html = htmlCompiler('| Header |', {
      optimizeForStreaming: true,
    })

    // Should render as paragraph/text, not table
    expect(html).not.toContain('<table>')
    expect(html).toContain('Header')
  })

  it('should suppress table with header and separator but no data rows', () => {
    const html = htmlCompiler('| Name |\n| --- |', {
      optimizeForStreaming: true,
    })

    expect(html).not.toContain('<table>')
    expect(html).not.toContain('|')
    expect(html).not.toContain('---')
  })

  it('should show partial table rows as they stream', () => {
    const html = htmlCompiler('| Name |\n| --- |\n| Alice |', {
      optimizeForStreaming: true,
    })

    expect(html).toContain('<table>')
    expect(html).toContain('Alice')
  })

  it('should suppress incomplete table with malformed separator on same line', () => {
    const html = htmlCompiler(
      '| 选项 | 类型 | 默认值 | 说明 | | :------------------------------ | :---------------------------- | :------ | :------------------------------------------------------------------------------------------------',
      {
        optimizeForStreaming: true,
      }
    )

    expect(html).not.toContain('<table>')
    expect(html).not.toContain('|')
    expect(html).not.toContain('---')
  })
})
