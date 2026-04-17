---
'markdown-to-jsx': patch
---

Fix HTML output for markdown inside `<table>` cells (#862). Lists, blockquotes, fenced code, and headings inside a cell now render as nested content without breaking the surrounding rows or dropping closing tags.
