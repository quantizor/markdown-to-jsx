---
'markdown-to-jsx': minor
---

Rejected image destinations now use `null` on the parsed AST the same way rejected links already do, so TypeScript consumers can treat `ImageNode.target` and `LinkNode.target` as `string | null`. Compilers still omit `src` for rejected images and the markdown compiler still re-emits them as `![alt]()`.
