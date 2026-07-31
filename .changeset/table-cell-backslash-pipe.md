---
'markdown-to-jsx': patch
---

Table cells that contain a backslash before a pipe are escaped correctly when compiling back to Markdown, so the pipe no longer splits the row on re-parse.
