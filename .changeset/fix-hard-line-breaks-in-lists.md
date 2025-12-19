---
"markdown-to-jsx": patch
---

Fix hard line breaks (two trailing spaces) inside list items not being converted to `<br/>`.

In v9, hard line breaks inside list items were being lost because the first line content and continuation lines were being parsed separately, causing the trailing spaces before the newline to be stripped before the hard break could be detected.

The fix ensures that for tight list items (without blank lines), simple text continuation lines are collected and concatenated with the first line content before parsing. This preserves the trailing spaces + newline sequence that triggers hard break detection.

Fixes #766.
