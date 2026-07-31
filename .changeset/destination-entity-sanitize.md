---
'markdown-to-jsx': patch
---

Link and image destinations that hide a dangerous scheme behind HTML entities (for example `[x](&#106;avascript:alert(1))`) are now rejected the same way as a literal `javascript:` URL. Compilers drop the href for rejected links and omit the src for rejected images. The markdown compiler re-emits a rejected image as `![alt]()` rather than `![alt](null)`. Direct AST rendering also re-checks link targets before they become hrefs.
