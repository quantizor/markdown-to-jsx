---
"markdown-to-jsx": patch
---

Shortcut reference links whose label is `__proto__` or `constructor` no longer throw. Those names used to collide with properties on `Object.prototype`, so looking up the reference treated a missing definition as present and then crashed while sanitizing an undefined URL. Reference maps are now null-prototype objects, so the labels work like any other name.

Fixes #900.
