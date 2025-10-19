---
'markdown-to-jsx': patch
---

Fix the issue where YAML frontmatter in code blocks doesn't render properly.

This is done by lowering the parsing priority of Setext headings to match ATX headings; both are now prioritized lower than code blocks.
