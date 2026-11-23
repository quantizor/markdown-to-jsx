import { describe, expect, test } from 'bun:test'
import { normalize } from './differential.ts'

describe('normalize', () => {
  test('whitespace after an unclosed inline element at the end of a block opens no second element', () => {
    expect(normalize('<p>foo <a href="x"></p>\n')).toBe(
      '<p>foo <a href="x"></a></p>'
    )
    expect(normalize('<p>foo <a href="x"></p>\n<p>bar</p>')).toBe(
      '<p>foo <a href="x"></a></p><p><a href="x">bar</a></p>'
    )
  })

  test('whitespace beside a block tag is removed', () => {
    expect(
      normalize('<ul>\n<li>foo\n<ul>\n<li>bar</li>\n</ul>\n</li>\n</ul>\n')
    ).toBe('<ul><li>foo<ul><li>bar</li></ul></li></ul>')
  })

  test('whitespace between inline tags and inside inline code is kept', () => {
    expect(normalize('<p><em>a</em> <strong>b</strong></p>')).toBe(
      '<p><em>a</em> <strong>b</strong></p>'
    )
    expect(normalize('<p><code>    </code></p>')).toBe(
      '<p><code>    </code></p>'
    )
  })

  test('void element spelling is no difference', () => {
    expect(normalize('<p>a<br />\nb</p>')).toBe('<p>a<br>\nb</p>')
    expect(normalize('<p>a<br>\nb</p>')).toBe('<p>a<br>\nb</p>')
  })

  test("a code block's final newline is removed", () => {
    expect(normalize('<pre><code>x\n</code></pre>\n')).toBe(
      '<pre><code>x</code></pre>'
    )
  })

  test('whitespace inside a raw pre element is kept', () => {
    expect(normalize('<pre>a\n  b</pre>')).toBe('<pre>a\n  b</pre>')
    expect(normalize('<pre><div>x</div>  </pre>\n<p>y</p>')).toBe(
      '<pre><div>x</div>  </pre><p>y</p>'
    )
  })
})
