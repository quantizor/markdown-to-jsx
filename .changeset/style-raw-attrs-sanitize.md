---
'markdown-to-jsx': patch
---

Dangerous `url(javascript:…)` (and similar) payloads in raw HTML `style` attributes are now stripped from the HTML and Markdown string outputs, matching the React-family compilers.
