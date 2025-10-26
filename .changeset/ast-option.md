---
'markdown-to-jsx': major
---

Added `ast` option to compiler to expose the parsed AST directly. When `ast: true`, the compiler returns the AST structure (`ASTNode[]`) instead of rendered JSX.

**Breaking Changes:**

- The internal type `ParserResult` has been renamed to `ASTNode` for clarity. If you were accessing this type directly (e.g., via module augmentation or type manipulation), you'll need to update references from `MarkdownToJSX.ParserResult` to `MarkdownToJSX.ASTNode`.

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
const ast: MarkdownToJSX.ASTNode[] = compiler('# Hello world', {
  ast: true,
})

// Inspect/modify AST
console.log(ast) // Array of parsed nodes

// Render AST to JSX using createRenderer (not implemented yet)
```

The AST format is `MarkdownToJSX.ASTNode[]`. When footnotes are present, the returned value will be an object with `ast` and `footnotes` properties instead of just the AST array.
