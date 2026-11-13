---
'markdown-to-jsx': patch
---

Fixed: rendering under non-React runtimes such as Preact aliased as `react` (for example `preact/compat`). Previously the output was blank.
