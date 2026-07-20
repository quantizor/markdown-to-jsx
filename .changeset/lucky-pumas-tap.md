---
'markdown-to-jsx': patch
---

Ship an `llms.txt` cheatsheet with the package and at [markdown-to-jsx.quantizor.dev/llms.txt](https://markdown-to-jsx.quantizor.dev/llms.txt), so coding assistants can pick up the entry points, options, recipes, and AST shapes in a single short read instead of the full README.

The cheatsheet leads with the questions people actually ask: why a single newline is not a line break, how to wire up a syntax highlighter or KaTeX, opening links in a new tab, restricting which tags render, and the traps around indented template literals and case-sensitive override keys.

Two documentation corrections come along with it. The HTML entry point example named an export that does not exist; the helper there is `astToHTML`. And the class added to a fenced code block is `language-<lang>`, with the older `lang-<lang>` alongside it on the JSX renderers, rather than `lang-<lang>` alone as previously written.
