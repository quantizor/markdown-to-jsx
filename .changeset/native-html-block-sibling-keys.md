---
"markdown-to-jsx": patch
---

Fixed React key warnings in React Native when raw HTML mixed with other content, such as a `<div>` holding paragraphs with text between them, or a custom component following a heading. These elements now receive unique keys.
