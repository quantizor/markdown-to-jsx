import { describe, expect, it } from 'bun:test'
import * as fs from 'node:fs'
import * as path from 'node:path'

import { astToHTML } from './html.ts'
import { parser } from './parse.ts'

interface SpecExample {
  markdown: string
  html: string
  example: number
  start_line: number
  end_line: number
  section: string
}

const specExamples: SpecExample[] = JSON.parse(
  fs.readFileSync(
    path.join(import.meta.dirname, 'commonmark-spec.json'),
    'utf8'
  )
)

function normalizeHtml(html: string): string {
  return html.replace(/\n\s*/g, '').replace(/>\s+</g, '><').trim()
}

const SECURITY_DEVIATIONS: Record<number, string> = {
  156: '&lt;div id="foo"\n*hi*\n',
  157: '&lt;div class\nfoo\n',
  158: '&lt;div *???-&&&-&lt;---\n*foo*\n',
}

describe('CommonMark 0.31.2 Specification', () => {
  it.each(
    specExamples
  )('Example $example: $section (lines $start_line-$end_line)', ({
    markdown,
    html: expectedHtml,
    section,
    example,
  }) => {
    const isGfmAutolinkTest = section === 'Autolinks (extension)'
    const isTagfilterTest = section === 'tagfilter'

    const ast = parser(markdown, {
      disableAutoLink: !isGfmAutolinkTest,
      tagfilter: isTagfilterTest,
      slugify: () => '',
    })

    const actualHtml = astToHTML(ast, { tagfilter: isTagfilterTest })

    if (example in SECURITY_DEVIATIONS) {
      expect(actualHtml).toBe(SECURITY_DEVIATIONS[example])
      return
    }

    expect(normalizeHtml(actualHtml)).toBe(normalizeHtml(expectedHtml))
  })
})
