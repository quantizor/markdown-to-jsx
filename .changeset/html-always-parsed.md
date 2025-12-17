---
'markdown-to-jsx': patch
---

HTML blocks are now always fully parsed into the AST `children` property, even when marked as `verbatim`. The `verbatim` flag now acts as a rendering hint rather than a parsing control. Default renderers still use `rawText` for verbatim blocks (maintaining CommonMark compliance), but `renderRule` implementations can now access the fully parsed AST in `children` for all HTML blocks. The `noInnerParse` property has been replaced with `verbatim` for clarity.
