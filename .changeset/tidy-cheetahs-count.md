---
'markdown-to-jsx': patch
---

Arbitrary HTML no longer punches out pipes when parsing rows. If you absolutely need a pipe character that isn't a table separator, either escape it or enclose it in backticks to trigger inline code handling.
