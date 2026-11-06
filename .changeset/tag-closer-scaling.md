---
"markdown-to-jsx": patch
---

Parsing stays fast on text with many unclosed HTML tags, such as `<x1> <x2> <x3> …` or `[<b>] [<b>] …`, where a crafted document could take over a second. If you render markdown written by someone else, please upgrade.

On such text, past a limit far above what real documents reach, a `]` inside a tag's attribute can end link text.
