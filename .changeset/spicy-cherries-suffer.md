---
'markdown-to-jsx': major
---

Introduce the `createMarkdown(options)` factory function. This factory wraps and replaces the prior `compiler(input, options)` top-level export, while also exposing the AST parser directly for ✨ advanced use cases ✨.

```tsx
import { createMarkdown } from 'markdown-to-jsx'

// parser = receive AST without going directly to React, allows for complete override
// compiler = parser + React output (the equivalent of using the `Markdown` component)
// Markdown = React component for convenience
const { Markdown, compiler, parser } = createMarkdown({
  /* any options here */
})
```
