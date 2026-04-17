---
'markdown-to-jsx': patch
---

Fix HTML compiler rendering markdown inside `<table>` cells (#862)

The HTML output adapter duplicated sibling rows and dropped closing tags when a `<table>` contained a cell with block-level markdown (lists, blockquotes, fenced code, headings). Parser flags now distinguish rawText that carries sibling extension from rawText that is the closed element's inner content, so the HTML compiler emits each row and cell structurally.
