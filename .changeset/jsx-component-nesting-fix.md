---
'markdown-to-jsx': patch
---

Fix JSX component nesting with double-newlines between tags

JSX components with double-newlines (blank lines) between opening and closing tags now properly nest children instead of creating sibling nodes. This fixes incorrect AST structure for JSX/MDX content.

**Before:**

```jsx
<Figure>

<div>content</div>

</Figure>
```

Parsed as 3 siblings: `<Figure>`, `<div>`, `</Figure>`

**After:**

Parsed as parent-child: `<Figure>` contains `<div>` as a child

This was a bug where the parser incorrectly treated JSX components as siblings when double-newlines were present between the tags. The fix ensures proper parent-child relationships match expected JSX/MDX semantics.
