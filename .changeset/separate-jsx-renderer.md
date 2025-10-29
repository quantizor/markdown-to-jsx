---
'markdown-to-jsx': minor
---

Separate JSX renderer from compiler and add new entry points

## New Features

- **New `parser` function**: Low-level API that returns AST nodes. Exported from main entry point and all sub-entry points.

  ```tsx
  import { parser } from 'markdown-to-jsx'
  const ast = parser('# Hello world')
  ```

- **New `/react` entry point**: React-specific entry point that exports compiler, Markdown component, parser, types, and utils.

  ```tsx
  import Markdown, { compiler, parser } from 'markdown-to-jsx/react'
  ```

- **New `/html` entry point**: HTML string output entry point that exports html function, parser, types, and utils.
  ```tsx
  import { html, parser } from 'markdown-to-jsx/html'
  const htmlString = html(parser('# Hello world'))
  ```

## Deprecations

React code in the main entry point `markdown-to-jsx` is deprecated and will be removed in a future major release.

## Migration

- Existing imports from `markdown-to-jsx` continue to work (backward compatible)
- For React-specific usage, consider importing from `markdown-to-jsx/react` for better tree-shaking
- For HTML output, use `markdown-to-jsx/html` entry point
- Use `parser()` for low-level AST access instead of `compiler(..., { ast: true })`
