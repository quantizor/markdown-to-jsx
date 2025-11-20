---
'markdown-to-jsx': minor
---

Add markdown reverse compiler.

Sometimes you need to get back to where you started. Maybe you want to edit or sanitize the markdown via AST and reserialize. Whatever the reason, this is now possible.

```ts
import { compiler, parser, astToMarkdown } from 'markdown-to-jsx/markdown'

const source = '# Hello world'
const markdown = compiler(source) // # Hello world
const ast = parser(source)
const markdown2 = astToMarkdown(ast) // # Hello world
```
