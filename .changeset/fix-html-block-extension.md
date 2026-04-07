---
'markdown-to-jsx': patch
---

Fix HTML blocks with markdown content inside tables (#862) and restore CommonMark-correct behavior for HTML block content without blank lines (#860)

- Markdown lists inside HTML table cells now render as proper nested lists instead of breaking the table structure
- HTML block content on its own line without surrounding blank lines (e.g. `<div>\n*text*\n</div>`) is now preserved as literal text per CommonMark Example 189
- HTML block content surrounded by blank lines (e.g. `<div>\n\n*text*\n\n</div>`) continues to parse markdown as before (CommonMark Example 188)
