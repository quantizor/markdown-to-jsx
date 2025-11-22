---
'markdown-to-jsx': major
---

Remove `options.namedCodesToUnicode`. The library now encodes the full HTML entity list by default per CommonMark specification requirements.

**Migration:**

If you were using `options.namedCodesToUnicode` to add custom entity mappings, you can remove the option entirely as all specified HTML entities are now supported automatically.
