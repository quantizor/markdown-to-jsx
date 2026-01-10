---
'markdown-to-jsx': patch
---

Add CommonMark-compliant text normalization for null bytes and BOM

Per CommonMark security specification, null bytes (U+0000) are now replaced with the replacement character (U+FFFD) instead of passing through unchanged. Additionally, the Byte Order Mark (U+FEFF) is now stripped when it appears at the start of a document, as specified in the CommonMark spec.

These changes improve spec compliance and security. Most documents are unaffected due to fast-path optimization that skips processing when no special characters are present.
