---
'markdown-to-jsx': patch
---

Stop importing Node's `process` module in library source so production builds can replace environment checks correctly. Browser bundles no longer crash when reading those checks.
