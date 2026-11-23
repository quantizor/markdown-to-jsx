---
"markdown-to-jsx": patch
---

A task list checkbox now needs a space and some text after its marker, as GFM specifies, so `- [x]foo` and a bare `- [x]` stay plain text. Text after a checkbox stays text: `- [x] # title` no longer becomes a heading.
