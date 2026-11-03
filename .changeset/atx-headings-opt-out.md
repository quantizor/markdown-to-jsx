---
"markdown-to-jsx": patch
---

`enforceAtxHeadings: false` now works. With it set, `#heading` (no space after the `#`) renders as a heading, including when it follows a paragraph line, inside list items and quotes, and inside inline HTML. By default, and with `enforceAtxHeadings: true`, a space or tab is still required after the `#` characters, as CommonMark specifies. More than six `#` characters never make a heading.
