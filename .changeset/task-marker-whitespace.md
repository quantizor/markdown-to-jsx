---
"markdown-to-jsx": patch
---

A task list checkbox now needs whitespace after its marker, matching GFM. `- [x]foo` renders as plain text instead of a checked box, and `- [x]: /url` is read as a link reference definition.
