---
"markdown-to-jsx": patch
---

The Markdown output compiler now produces Markdown that parses back to the same document across many more constructs. Literal special characters in text are escaped so they stay literal, tables emit outer pipes and escape cell pipes, loose lists keep their spacing instead of collapsing to tight, fenced and inline code widen their delimiters past any backticks inside, link and image titles containing quotes are escaped, raw HTML attributes keep their original values instead of being mangled, and an empty inline element like `<video></video>` no longer splits the surrounding paragraph.
