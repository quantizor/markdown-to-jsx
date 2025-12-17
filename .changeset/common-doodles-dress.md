---
'markdown-to-jsx': patch
---

Ensure `renderRule` always executes before any other rendering code across all renderers. The `renderRule` function now has full control over node rendering, including normally-skipped nodes like `ref`, `footnote`, and `frontmatter`. Additionally, `renderChildren` in the markdown renderer now invokes `renderRule` for recursively rendered child nodes, ensuring consistent behavior when customizing rendering logic.
