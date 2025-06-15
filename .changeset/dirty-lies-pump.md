---
'markdown-to-jsx': patch
---

Handle spaces in text as a stop token to improve processing, also adapt paragraph detection to exclude non-atx compliant headings if that option is enabled.

Fixes #680
