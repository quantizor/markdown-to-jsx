---
"markdown-to-jsx": patch
---

Streaming parses of deeply nested content (blockquotes and long lists) are faster. When `optimizeForStreaming` is on, the incomplete-syntax suppression now runs only on the block that can hold the document's live edge instead of re-scanning every closed block above it, so re-parsing on each streamed token does less work on outline-heavy documents.
