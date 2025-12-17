---
'markdown-to-jsx': patch
---

Add `HTMLNode.rawText` field for consistency with `rawAttrs`. The `rawText` field contains the raw text content for verbatim HTML blocks, while `children` contains the parsed AST. The `text` property is now deprecated and will be removed in a future major version. Both fields are set to the same value for backward compatibility.
