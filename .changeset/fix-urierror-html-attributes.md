---
"markdown-to-jsx": patch
---

Fixed URIError when parsing HTML attributes containing the % character (e.g., `width="100%"`). The parser now gracefully handles invalid URI encodings in attribute values instead of throwing an error.
