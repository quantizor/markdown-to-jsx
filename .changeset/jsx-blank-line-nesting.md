---
'markdown-to-jsx': patch
---

Custom JSX components written in PascalCase, and hyphenated custom elements, keep their markdown children when a blank line appears between the opening and closing tags. Content after the blank no longer leaks out as a sibling of the component.
