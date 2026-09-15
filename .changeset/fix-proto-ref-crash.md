---
"markdown-to-jsx": patch
---

Shortcut reference links whose label is `__proto__` or `constructor` no longer throw. Those labels now resolve like any other reference label.

Fixes #900.
