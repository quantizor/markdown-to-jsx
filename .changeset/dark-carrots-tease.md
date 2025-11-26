---
'markdown-to-jsx': patch
---

Fix infinite recursion when using `forceBlock: true` with empty unclosed HTML tags

When `React.createElement(Markdown, {options: {forceBlock: true}}, '<var>')` was called with an empty unclosed tag, it would cause infinite recursion. The parser would set the `text` field to the opening tag itself (e.g., `<var>`), which would then be parsed again in the rendering phase, causing recursion.

This fix adds detection in `createVerbatimHTMLBlock` to detect when `forceBlock` is used and the text contains just the opening tag (empty unclosed tag), rendering it as an empty element to prevent recursion.
