---
"markdown-to-jsx": minor
---

Replaced the rule-based markdown parser with a compact table-driven parser. Parsing is ~30% faster across all input sizes and bundle size is reduced by ~25% (gzip). Improved CommonMark compliance for HTML block handling and streaming mode reliability. No API changes.
