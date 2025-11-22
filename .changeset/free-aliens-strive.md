---
'markdown-to-jsx': minor
---

Add `preserveFrontmatter` option to control whether YAML frontmatter is rendered in the output. When set to `true`, frontmatter is rendered as a `<pre>` element in HTML/JSX output. For markdown-to-markdown compilation, frontmatter is preserved by default but can be excluded with `preserveFrontmatter: false`.

| Compiler Type            | Default Behavior            | When `preserveFrontmatter: true` | When `preserveFrontmatter: false` |
| ------------------------ | --------------------------- | -------------------------------- | --------------------------------- |
| **React/HTML**           | ❌ Don't render frontmatter | ✅ Render as `<pre>` element     | ❌ Don't render frontmatter       |
| **Markdown-to-Markdown** | ✅ Preserve frontmatter     | ✅ Preserve frontmatter          | ❌ Exclude frontmatter            |
