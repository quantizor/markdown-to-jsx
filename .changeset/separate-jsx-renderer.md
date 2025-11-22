---
'markdown-to-jsx': minor
---

Separate JSX renderer from compiler and add new entry points

## New Features

- **New `parser` function**: Low-level API that returns AST nodes. Exported from main entry point and all sub-entry points.

  ```tsx
  import { parser } from 'markdown-to-jsx'
  const source = '# Hello world'
  const ast = parser(source)
  ```

- **New `/react` entry point**: React-specific entry point that exports compiler, Markdown component, parser, types, and utils.

  ```tsx
  import Markdown, { astToJSX, compiler, parser } from 'markdown-to-jsx/react'

  const source = '# Hello world'
  const oneStepJSX = compiler(source)
  const twoStepJSX = astToJSX(parser(source))

  function App() {
    return <Markdown children={source} />
    // or
    // return <Markdown>{source}</Markdown>
  }
  ```

- **New `/html` entry point**: HTML string output entry point that exports html function, parser, types, and utils.

  ```tsx
  import { astToHTML, compiler, parser } from 'markdown-to-jsx/html'
  const source = '# Hello world'
  const oneStepHTML = compiler(source)
  const twoStepHTML = astToHTML(parser(source))
  ```

- **New `/markdown` entry point**: Useful for situations where editing of the markdown is desired without resorting to gnarly regex-based parsing.
  ```tsx
  import { astToMarkdown, compiler, parser } from 'markdown-to-jsx/markdown'
  const source = '# Hello world'
  const oneStepMarkdown = compiler(source)
  const twoStepMarkdown = astToMarkdown(parser(source))
  ```

## Deprecations

React code in the main entry point `markdown-to-jsx` is deprecated and will be removed in a future major release. In v10, the main entry point will only export the parser function, the types, and any exposed utility functions.

## Migration

- For React-specific usage, switch imports to `markdown-to-jsx/react`
- For HTML output, use `markdown-to-jsx/html` entry point
- Use `parser()` for direct acces to AST
