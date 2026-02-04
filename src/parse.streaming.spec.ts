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

describe('Streaming optimization - list markers', () => {
  it('should suppress a lone * at end of input', () => {
    const html = htmlCompiler('*', { optimizeForStreaming: true })
    expect(html).toBe('')
  })

  it('should suppress * followed by space at end of input', () => {
    const html = htmlCompiler('* ', { optimizeForStreaming: true })
    expect(html).toBe('')
  })

  it('should render * with content as a list', () => {
    const html = htmlCompiler('* item', { optimizeForStreaming: true })
    expect(html).toBe('<ul><li>item</li></ul>')
  })

  it('should suppress trailing empty list marker after content', () => {
    const html = htmlCompiler('Hello\n* ', { optimizeForStreaming: true })
    expect(html).toBe('<p>Hello</p>')
  })

  it('should render trailing list marker with content', () => {
    const html = htmlCompiler('Hello\n* item', { optimizeForStreaming: true })
    expect(html).toMatchInlineSnapshot(`"<div><p>Hello</p><ul><li>item</li></ul></div>"`)
  })

  it('should suppress lone - at end of input', () => {
    const html = htmlCompiler('- ', { optimizeForStreaming: true })
    expect(html).toBe('')
  })

  it('should suppress lone + at end of input', () => {
    const html = htmlCompiler('+ ', { optimizeForStreaming: true })
    expect(html).toBe('')
  })

  it('should suppress empty ordered list marker at end of input', () => {
    const html = htmlCompiler('1. ', { optimizeForStreaming: true })
    expect(html).toBe('')
  })

  it('should not suppress multi-item lists', () => {
    const html = htmlCompiler('* one\n* two', { optimizeForStreaming: true })
    expect(html).toMatchInlineSnapshot(`"<ul><li>one</li><li>two</li></ul>"`)
  })

  it('should not suppress list markers without streaming mode', () => {
    const html = htmlCompiler('* ', {})
    expect(html).toBe('<ul><li></li></ul>')
  })
})

describe('Streaming optimization - HTML tags in code spans', () => {
  it('should preserve HTML tags inside backtick code spans', () => {
    const html = htmlCompiler('`<Markdown>`', { optimizeForStreaming: true })
    expect(html).toMatchInlineSnapshot(`"<p><code>&lt;Markdown&gt;</code></p>"`)
  })

  it('should preserve HTML tags in code spans within text', () => {
    const html = htmlCompiler('Use `<Markdown>` for rendering', { optimizeForStreaming: true })
    expect(html).toMatchInlineSnapshot(`"<p>Use <code>&lt;Markdown&gt;</code> for rendering</p>"`)
  })

  it('should still strip bare unclosed HTML tags in streaming mode', () => {
    const html = htmlCompiler('<Markdown> some text', { optimizeForStreaming: true })
    expect(html).toMatchInlineSnapshot(`"<p>some text</p>"`)
  })

  it('should strip bare unclosed uppercase tags with no content', () => {
    const html = htmlCompiler('<Markdown>', { optimizeForStreaming: true })
    expect(html).toBe('')
  })
})
