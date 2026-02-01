import { describe, it, expect } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { MarkdownCompact, compileMarkdown } from './react-compact'
import * as React from 'react'

describe('Compact React Compiler', () => {
  it('renders heading', () => {
    const html = renderToStaticMarkup(<MarkdownCompact># Hello</MarkdownCompact>)
    expect(html).toContain('<h1')
    expect(html).toContain('Hello')
  })
  
  it('renders paragraph', () => {
    const html = renderToStaticMarkup(<MarkdownCompact>Hello world</MarkdownCompact>)
    expect(html).toContain('<p>')
    expect(html).toContain('Hello world')
  })
  
  it('renders emphasis', () => {
    const html = renderToStaticMarkup(<MarkdownCompact>*emphasis*</MarkdownCompact>)
    expect(html).toContain('<em>')
    expect(html).toContain('emphasis')
  })
  
  it('renders strong', () => {
    const html = renderToStaticMarkup(<MarkdownCompact>**strong**</MarkdownCompact>)
    expect(html).toContain('<strong>')
  })
  
  it('renders link', () => {
    const html = renderToStaticMarkup(<MarkdownCompact>[link](http://example.com)</MarkdownCompact>)
    expect(html).toContain('<a href="http://example.com"')
    expect(html).toContain('link')
  })
  
  it('renders image', () => {
    const html = renderToStaticMarkup(<MarkdownCompact>![alt](/img.png)</MarkdownCompact>)
    expect(html).toContain('<img')
    expect(html).toContain('src="/img.png"')
    expect(html).toContain('alt="alt"')
  })
  
  it('renders code block', () => {
    const md = '```js\ncode\n```'
    const html = renderToStaticMarkup(<MarkdownCompact>{md}</MarkdownCompact>)
    expect(html).toContain('<pre>')
    expect(html).toContain('<code')
    expect(html).toContain('language-js')
  })
  
  it('renders list', () => {
    const html = renderToStaticMarkup(<MarkdownCompact>{'- item 1\n- item 2'}</MarkdownCompact>)
    expect(html).toContain('<ul>')
    expect(html).toContain('<li>')
    expect(html).toContain('item 1')
  })
  
  it('renders table', () => {
    const html = renderToStaticMarkup(<MarkdownCompact>{'| A | B |\n|---|---|\n| 1 | 2 |'}</MarkdownCompact>)
    expect(html).toContain('<table>')
    expect(html).toContain('<th>')
    expect(html).toContain('<td>')
  })
  
  it('supports component overrides', () => {
    const CustomH1 = ({ children }: { children: React.ReactNode }) => 
      React.createElement('h1', { className: 'custom' }, children)
    const html = renderToStaticMarkup(
      <MarkdownCompact options={{ overrides: { h1: CustomH1 } }}>
        # Hello
      </MarkdownCompact>
    )
    expect(html).toContain('class="custom"')
  })
})
