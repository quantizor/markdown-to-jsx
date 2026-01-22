---
"markdown-to-jsx": patch
---

Fix: preserve camelCase attribute casing for all HTML/JSX tags, not just PascalCase components. This restores expected behavior where attributes like `userId` and `firstName` are no longer lowercased to `userid` and `firstname`.
