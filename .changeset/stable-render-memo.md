---
'markdown-to-jsx': patch
---

The `<Markdown>` component no longer re-parses its content when a parent re-renders with unchanged props. Previously the rest-props object was reallocated on every render, which invalidated the internal compile cache and forced a full re-parse each time.
