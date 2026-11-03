import { defineConfig } from 'bunup'
import { common, compiler } from '../bunup.shared.ts'

// lib is the legacy single `marqdown` package (self-imports `marqdown/entities`,
// so no specifier rewrite). The scoped `@marqdown/*` packages build from this
// same source via ../bunup.shared.ts with a per-scope entities rewrite.
export default defineConfig([
  // Entities modules - built separately for browser field swapping
  {
    ...common,
    name: 'entities',
    entry: ['src/entities.generated.ts', 'src/entities.browser.ts'],
  },
  // One Bun.build per entry so unused utils exports do not survive into
  // compilers that never import them (e.g. HTML_TO_JSX_MAP into markdown).
  { ...compiler, name: 'index', entry: 'src/index.tsx' },
  { ...compiler, name: 'parser', entry: 'src/parser.ts' },
  { ...compiler, name: 'react', entry: 'src/react.tsx' },
  { ...compiler, name: 'html', entry: 'src/html.ts' },
  { ...compiler, name: 'markdown', entry: 'src/markdown.ts' },
  { ...compiler, name: 'native', entry: 'src/native.tsx' },
  { ...compiler, name: 'solid', entry: 'src/solid.tsx' },
  { ...compiler, name: 'vue', entry: 'src/vue.tsx' },
])
