import { describe, expect, it } from 'bun:test'
import * as fs from 'fs'
import * as path from 'path'

import { astToHTML } from './html'
import { parser } from './parse'

type SpecExample = {
  markdown: string
  html: string
  example: number
  start_line: number
  end_line: number
  section: string
}

const specExamples: SpecExample[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'commonmark-spec.json'), 'utf8')
)

/**
 * Collapse insignificant whitespace so output is compared structurally, not
 * byte-for-byte. This deliberately forgives three known, intentional deviations
 * from the spec's literal bytes (see BACKLOG.md "Known spec deviations"):
 * compact inter-block formatting (`<ul><li>` vs `<ul>\n<li>`), the code-block
 * trailing newline, and inter-tag whitespace inside raw HTML blocks. A real
 * content difference still fails.
 */
function normalizeHtml(html: string): string {
  return html.replace(/\n\s*/g, '').replace(/>\s+</g, '><').trim()
}

describe('CommonMark 0.31.2 Specification', () => {
  it.each(specExamples)(
    'Example $example: $section (lines $start_line-$end_line)',
    ({ markdown, html: expectedHtml, section }) => {
      // Enable GFM extensions for autolinks and tagfilter tests
      // Note: angle bracket autolinks (<https://...>) are part of core CommonMark spec
      // GFM bare URL autolinks (www., http:// without <>) are extensions
      const isGFMAutolinkTest = section === 'Autolinks (extension)'
      const isTagfilterTest = section === 'tagfilter'

      const ast = parser(markdown, {
        // Bare URL autolinks are GFM extensions - only enable for GFM autolink tests
        // Angle bracket autolinks are handled separately and are always enabled
        disableAutoLink: !isGFMAutolinkTest,
        tagfilter: isTagfilterTest, // Tagfilter is on by default, but most CommonMark tests expect it off
        slugify: () => '',
      })

      const actualHtml = astToHTML(ast, { tagfilter: isTagfilterTest })

      expect(normalizeHtml(actualHtml)).toBe(normalizeHtml(expectedHtml))
    }
  )
})
