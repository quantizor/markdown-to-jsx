---
'markdown-to-jsx': patch
---

The markdown compiler now re-emits processing instructions (`<?xml ?>`), CDATA sections, declarations (`<!DOCTYPE html>`), and orphan closing tags exactly as written. Previously these were reconstructed as a generic self-closing element, which mangled a processing instruction like `<?xml version="1.0"?>` down to `<? />` and dropped CDATA and declaration content entirely.
