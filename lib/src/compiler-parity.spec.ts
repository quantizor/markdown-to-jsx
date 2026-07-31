import { describe, expect, it } from 'bun:test'
import { compiler as htmlCompiler } from './html.ts'
import { compiler as markdownCompiler } from './markdown.ts'
import { compiler as nativeCompiler } from './native.tsx'
import { compiler as reactCompiler } from './react.tsx'
import { compiler as solidCompiler } from './solid.tsx'
import { compiler as vueCompiler } from './vue.tsx'

const CASES: Array<{ id: string; md: string }> = [
  { id: 'heading', md: '# Hello' },
  { id: 'paragraph', md: 'A short paragraph.' },
  { id: 'link', md: '[text](https://example.com)' },
  { id: 'image', md: '![alt](data:image/gif;base64,R0lGODlhAQABAAAAACw=)' },
  { id: 'table', md: '| a | b |\n| - | - |\n| 1 | 2 |' },
  { id: 'task-list', md: '- [x] done\n- [ ] todo' },
  { id: 'footnote', md: 'See[^1]\n\n[^1]: note' },
  { id: 'raw-html', md: '<div>plain</div>' },
  { id: 'code-fence', md: '```js\nconst x = 1\n```' },
  { id: 'blockquote', md: '> quoted' },
  { id: 'emphasis', md: '**bold** and *italic*' },
  { id: 'strikethrough', md: '~~gone~~' },
]

const compilers = [
  { name: 'react', run: (md: string) => reactCompiler(md) },
  { name: 'native', run: (md: string) => nativeCompiler(md) },
  { name: 'solid', run: (md: string) => solidCompiler(md) },
  { name: 'vue', run: (md: string) => vueCompiler(md) },
  { name: 'html', run: (md: string) => htmlCompiler(md) },
  { name: 'markdown', run: (md: string) => markdownCompiler(md) },
] as const

describe('compiler parity smoke', () => {
  for (const c of CASES) {
    for (const compiler of compilers) {
      it(`${compiler.name}: ${c.id}`, () => {
        const out = compiler.run(c.md)
        if (compiler.name === 'html' || compiler.name === 'markdown') {
          expect(typeof out).toBe('string')
          expect((out as string).length).toBeGreaterThan(0)
        } else {
          expect(out).not.toBeNull()
          expect(out).not.toBeUndefined()
        }
      })
    }
  }
})
