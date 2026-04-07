---
'markdown-to-jsx': patch
---

Fix frontmatter detection silently consuming content when a thematic break (`---`) starts the document. The colon-anywhere heuristic is replaced with proper YAML key-value validation, and a new `disableFrontmatter` option is added to skip detection entirely.
