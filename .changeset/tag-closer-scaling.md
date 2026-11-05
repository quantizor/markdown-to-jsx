---
"markdown-to-jsx": patch
---

Parsing stays fast on text with many unclosed HTML tags, such as `<x1> <x2> <x3> …` or `[<b>] [<b>] …`. A crafted 64 kB document could previously take over a second to parse, and the time grew with the square of the input size. If you render untrusted markdown, please upgrade.
