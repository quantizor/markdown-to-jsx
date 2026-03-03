import { describe, expect, it } from 'bun:test'
import { parser } from './parse'
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

describe('Streaming optimization - bold/italic markers', () => {
  it('should strip incomplete italic marker', () => {
    const html = htmlCompiler('*incomplete text', { optimizeForStreaming: true })
    expect(html).toMatchInlineSnapshot(`"<p>incomplete text</p>"`)
  })

  it('should strip incomplete bold marker', () => {
    const html = htmlCompiler('**incomplete text', { optimizeForStreaming: true })
    expect(html).toMatchInlineSnapshot(`"<p>incomplete text</p>"`)
  })

  it('should strip incomplete italic before inline code', () => {
    const html = htmlCompiler('*`ast` option removed:', { optimizeForStreaming: true })
    expect(html).toMatchInlineSnapshot(`"<p><code>ast</code> option removed:</p>"`)
  })

  it('should preserve complete bold wrapping inline code', () => {
    const html = htmlCompiler('**`ast` option removed:**', { optimizeForStreaming: true })
    expect(html).toMatchInlineSnapshot(`"<p><strong><code>ast</code> option removed:</strong></p>"`)
  })

  it('should not strip closing ** from complete bold pair', () => {
    const html = htmlCompiler('- **`ast` option removed**: The `ast: true` option.', { optimizeForStreaming: true })
    expect(html).toMatchInlineSnapshot(`"<ul><li><strong><code>ast</code> option removed</strong>: The <code>ast: true</code> option.</li></ul>"`)
  })

  it('should strip incomplete italic after complete bold', () => {
    const html = htmlCompiler('**bold** *incomplete', { optimizeForStreaming: true })
    expect(html).toMatchInlineSnapshot(`"<p><strong>bold</strong> incomplete</p>"`)
  })

  it('should not strip complete italic', () => {
    const html = htmlCompiler('*italic* text', { optimizeForStreaming: true })
    expect(html).toMatchInlineSnapshot(`"<p><em>italic</em> text</p>"`)
  })
})

describe('Streaming optimization - links', () => {
  it('should strip incomplete link with no closing bracket', () => {
    const html = htmlCompiler('Check [link text', { optimizeForStreaming: true })
    expect(html).toMatchInlineSnapshot(`"<p>Check link text</p>"`)
  })

  it('should strip brackets from [text] at end of input', () => {
    const html = htmlCompiler('Check [link text]', { optimizeForStreaming: true })
    expect(html).toMatchInlineSnapshot(`"<p>Check link text</p>"`)
  })

  it('should strip incomplete inline link [text](url', () => {
    const html = htmlCompiler('Check [link text](http://example', { optimizeForStreaming: true })
    expect(html).toMatchInlineSnapshot(`"<p>Check link text</p>"`)
  })

  it('should strip incomplete ref link [text][ref', () => {
    const html = htmlCompiler('[ref link][ref', { optimizeForStreaming: true })
    expect(html).toMatchInlineSnapshot(`"<p>ref link</p>"`)
  })

  it('should suppress incomplete image entirely', () => {
    const html = htmlCompiler('![alt text](http://img', { optimizeForStreaming: true })
    expect(html).toMatchInlineSnapshot(`"<p></p>"`)
  })

  it('should suppress incomplete image but keep preceding text', () => {
    const html = htmlCompiler('Text ![alt text](http://img', { optimizeForStreaming: true })
    expect(html).toMatchInlineSnapshot(`"<p>Text </p>"`)
  })

  it('should preserve complete links', () => {
    const html = htmlCompiler('[link](http://url) text', { optimizeForStreaming: true })
    expect(html).toMatchInlineSnapshot(`"<p><a href="http://url">link</a> text</p>"`)
  })

  it('should strip only the incomplete link after a complete one', () => {
    const html = htmlCompiler('[a](b) [c', { optimizeForStreaming: true })
    expect(html).toMatchInlineSnapshot(`"<p><a href="b">a</a> c</p>"`)
  })

  it('should suppress incomplete nested image-in-link badge', () => {
    const html = htmlCompiler('[![npm version](https://badge.svg', { optimizeForStreaming: true })
    expect(html).toMatchInlineSnapshot(`"<p></p>"`)
  })

  it('should show image when inner image completes but outer link is incomplete', () => {
    const html = htmlCompiler('[![npm version](https://badge.svg)](https://badge', { optimizeForStreaming: true })
    expect(html).toMatchInlineSnapshot(`"<p><img src=\"https://badge.svg\" alt=\"npm version\" /></p>"`)
  })

  it('should render complete image-in-link badge', () => {
    const html = htmlCompiler('[![npm version](https://badge.svg)](https://badge.io)', { optimizeForStreaming: true })
    expect(html).toMatchInlineSnapshot(`"<p><a href=\"https://badge.io\"><img src=\"https://badge.svg\" alt=\"npm version\" /></a></p>"`)
  })
})

describe('Streaming optimization - setext heading ambiguity', () => {
  it('should suppress dash underline at end of input (ambiguous with list)', () => {
    const html = htmlCompiler('Some Text\n---', { optimizeForStreaming: true })
    expect(html).toMatchInlineSnapshot(`"<p>Some Text</p>"`)
  })

  it('should suppress double dash underline at end of input', () => {
    const html = htmlCompiler('Some Text\n--', { optimizeForStreaming: true })
    expect(html).toMatchInlineSnapshot(`"<p>Some Text</p>"`)
  })

  it('should suppress equals underline at end of input', () => {
    const html = htmlCompiler('Some Text\n===', { optimizeForStreaming: true })
    expect(html).toMatchInlineSnapshot(`"<p>Some Text</p>"`)
  })

  it('should suppress single equals at end of input', () => {
    const html = htmlCompiler('Some Text\n=', { optimizeForStreaming: true })
    expect(html).toMatchInlineSnapshot(`"<p>Some Text</p>"`)
  })

  it('should suppress dash underline with trailing newline', () => {
    const html = htmlCompiler('Some Text\n---\n', { optimizeForStreaming: true })
    expect(html).toMatchInlineSnapshot(`"<p>Some Text</p>"`)
  })

  it('should suppress indented dash underline at end of input', () => {
    const html = htmlCompiler('Some Text\n  ---', { optimizeForStreaming: true })
    expect(html).toMatchInlineSnapshot(`"<p>Some Text</p>"`)
  })

  it('should preserve setext heading when disambiguated by following content', () => {
    const html = htmlCompiler('Some Text\n---\n\nMore text', { optimizeForStreaming: true })
    expect(html).toMatchInlineSnapshot(`"<div><h2 id=\"some-text\">Some Text</h2><p>More text</p></div>"`)
  })

  it('should preserve thematic break after blank line', () => {
    const html = htmlCompiler('Some Text\n\n---', { optimizeForStreaming: true })
    expect(html).toMatchInlineSnapshot(`"<div><p>Some Text</p><hr /></div>"`)
  })

  it('should preserve standalone thematic break', () => {
    const html = htmlCompiler('---', { optimizeForStreaming: true })
    expect(html).toMatchInlineSnapshot(`"<hr />"`)
  })

  it('should not suppress setext heading in non-streaming mode', () => {
    const html = htmlCompiler('Some Text\n---', {})
    expect(html).toMatchInlineSnapshot(`"<h2 id=\"some-text\">Some Text</h2>"`)
  })

  it('should render list items that follow text normally', () => {
    const html = htmlCompiler('Some Text\n- item1\n- item2', { optimizeForStreaming: true })
    expect(html).toMatchInlineSnapshot(`"<div><p>Some Text</p><ul><li>item1</li><li>item2</li></ul></div>"`)
  })
})

describe('Streaming optimization - fenced code block protection', () => {
  it('should not strip --- inside unclosed backtick fence', () => {
    const html = htmlCompiler('```\nSome Text\n---', { optimizeForStreaming: true })
    expect(html).toMatchInlineSnapshot(`
      "<pre><code>Some Text
      ---</code></pre>"
    `)
  })

  it('should not strip === inside unclosed backtick fence', () => {
    const html = htmlCompiler('```\nSome Text\n===', { optimizeForStreaming: true })
    expect(html).toMatchInlineSnapshot(`
      "<pre><code>Some Text
      ===</code></pre>"
    `)
  })

  it('should not strip --- inside unclosed tilde fence', () => {
    const html = htmlCompiler('~~~\nSome Text\n---', { optimizeForStreaming: true })
    expect(html).toMatchInlineSnapshot(`
      "<pre><code>Some Text
      ---</code></pre>"
    `)
  })

  it('should not strip list markers inside unclosed fence', () => {
    const html = htmlCompiler('```\ncode\n-', { optimizeForStreaming: true })
    expect(html).toMatchInlineSnapshot(`
      "<pre><code>code
      -</code></pre>"
    `)
  })

  it('should not strip table-like content inside unclosed fence', () => {
    const html = htmlCompiler('```\n| col |\n|---|', { optimizeForStreaming: true })
    expect(html).toMatchInlineSnapshot(`
      "<pre><code>| col |
      |---|</code></pre>"
    `)
  })

  it('should not strip HTML tags inside unclosed fence', () => {
    const html = htmlCompiler('```\n<div>content', { optimizeForStreaming: true })
    expect(html).toMatchInlineSnapshot(`"<pre><code>&lt;div&gt;content</code></pre>"`)
  })

  it('should still strip setext after a closed fence', () => {
    const html = htmlCompiler('```\ncode\n```\nSome Text\n---', { optimizeForStreaming: true })
    expect(html).toMatchInlineSnapshot(`"<div><pre><code>code</code></pre><p>Some Text</p></div>"`)
  })

  it('should not strip inside fence with info string', () => {
    const html = htmlCompiler('```js\nconst x = 1\n---', { optimizeForStreaming: true })
    expect(html).toMatchInlineSnapshot(`
      "<pre><code class="language-js">const x = 1
      ---</code></pre>"
    `)
  })

  it('should handle nested fence chars inside code block', () => {
    const html = htmlCompiler('````\n```\ncode\n---', { optimizeForStreaming: true })
    expect(html).toMatchInlineSnapshot(`
      "<pre><code>\`\`\`
      code
      ---</code></pre>"
    `)
  })
})
