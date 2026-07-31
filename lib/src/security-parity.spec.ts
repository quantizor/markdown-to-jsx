import { describe, expect, it } from 'bun:test'
import { compiler as htmlCompiler } from './html.ts'
import { compiler as markdownCompiler } from './markdown.ts'
import { compiler as nativeCompiler } from './native.tsx'
import { compiler as reactCompiler } from './react.tsx'
import { compiler as solidCompiler } from './solid.tsx'
import { compiler as vueCompiler } from './vue.tsx'

interface DangerCase {
  id: string
  md: string
  /** Substrings forbidden in html string output (lowercase compare). */
  absentFromHtml: string[]
  /**
   * Markdown is a fidelity compiler: tagfilter does not apply. Only assert
   * attribute/scheme sinks that the raw-attr sanitizer clears for all sinks.
   */
  absentFromMarkdown: string[]
}

const CASES: DangerCase[] = [
  {
    id: 'javascript-href',
    md: '[x](javascript:alert(1))',
    absentFromHtml: ['javascript:'],
    absentFromMarkdown: ['javascript:'],
  },
  {
    id: 'javascript-href-encoded',
    md: '[x](java%73cript:alert(1))',
    absentFromHtml: ['javascript:', 'java%73cript'],
    absentFromMarkdown: ['javascript:', 'java%73cript'],
  },
  {
    id: 'javascript-href-entity',
    md: '[x](&#106;avascript:alert(1))',
    absentFromHtml: ['javascript:'],
    absentFromMarkdown: ['javascript:'],
  },
  {
    id: 'onerror-attr',
    md: '<img src="x" onerror="alert(1)">',
    absentFromHtml: ['onerror'],
    absentFromMarkdown: ['onerror'],
  },
  {
    id: 'onclick-attr',
    md: '<div onclick="alert(1)">x</div>',
    absentFromHtml: ['onclick'],
    absentFromMarkdown: ['onclick'],
  },
  {
    id: 'srcdoc',
    md: '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
    absentFromHtml: ['srcdoc'],
    absentFromMarkdown: ['srcdoc'],
  },
  {
    id: 'style-js-url',
    md: '<div style="background:url(javascript:alert(1))">x</div>',
    absentFromHtml: ['javascript:'],
    absentFromMarkdown: ['javascript:'],
  },
]

function dumpJsx(value: unknown): string {
  return JSON.stringify(value)
}

function assertNoScriptElement(tree: unknown): void {
  const walk = (node: unknown): void => {
    if (node == null || typeof node !== 'object') {
      return
    }
    const n = node as { type?: unknown; props?: { children?: unknown } }
    expect(n.type).not.toBe('script')
    const kids = n.props?.children
    if (Array.isArray(kids)) {
      for (const k of kids) {
        walk(k)
      }
    } else {
      walk(kids)
    }
  }
  walk(tree)
}

describe('security sink parity', () => {
  for (const c of CASES) {
    it(`html: ${c.id}`, () => {
      const out = htmlCompiler(c.md)
      for (const needle of c.absentFromHtml) {
        expect(out.toLowerCase()).not.toContain(needle.toLowerCase())
      }
    })

    it(`markdown: ${c.id}`, () => {
      const out = markdownCompiler(c.md)
      for (const needle of c.absentFromMarkdown) {
        expect(out.toLowerCase()).not.toContain(needle.toLowerCase())
      }
    })

    it(`react: ${c.id}`, () => {
      const out = dumpJsx(reactCompiler(c.md))
      for (const needle of c.absentFromHtml) {
        expect(out.toLowerCase()).not.toContain(needle.toLowerCase())
      }
    })

    it(`solid: ${c.id}`, () => {
      const out = dumpJsx(solidCompiler(c.md))
      for (const needle of c.absentFromHtml) {
        expect(out.toLowerCase()).not.toContain(needle.toLowerCase())
      }
    })

    it(`vue: ${c.id}`, () => {
      const out = dumpJsx(vueCompiler(c.md))
      for (const needle of c.absentFromHtml) {
        expect(out.toLowerCase()).not.toContain(needle.toLowerCase())
      }
    })

    it(`native: ${c.id}`, () => {
      const out = dumpJsx(nativeCompiler(c.md))
      for (const needle of c.absentFromHtml) {
        expect(out.toLowerCase()).not.toContain(needle.toLowerCase())
      }
    })
  }

  it('tagfilter escapes script for html and JSX compilers (markdown is fidelity)', () => {
    const md = '<script>alert(1)</script>'
    expect(htmlCompiler(md)).toContain('&lt;script')
    expect(htmlCompiler(md)).not.toMatch(/<script>/i)

    assertNoScriptElement(reactCompiler(md))
    assertNoScriptElement(solidCompiler(md))
    assertNoScriptElement(vueCompiler(md))
    assertNoScriptElement(nativeCompiler(md))

    // Markdown round-trips HTML; tagfilter is a rendering concern.
    expect(markdownCompiler(md)).toContain('<script>')
  })
})
