---
'markdown-to-jsx': minor
---

Added `ast` option to compiler to expose the parsed AST directly. When `ast: true`, the compiler returns the AST structure (`ParserResult[]`) instead of rendered JSX.

**First time the AST is accessible to users!** This enables:

- AST manipulation and transformation before rendering
- Custom rendering logic without parsing
- Caching parsed AST for performance
- Linting or validation of markdown structure

**Usage:**

```typescript
import { compiler } from 'markdown-to-jsx'
import type { MarkdownToJSX } from 'markdown-to-jsx'

// Get the AST structure
const ast: MarkdownToJSX.AST[] = compiler('# Hello world', {
  ast: true,
})

// Inspect/modify AST
console.log(ast) // Array of parsed nodes

// Render AST to JSX using createRenderer (not implemented yet)
```

The AST format is `MarkdownToJSX.AST[]`. When footnotes are present, the returned value will be an object with `ast` and `footnotes` properties instead of just the AST array.
