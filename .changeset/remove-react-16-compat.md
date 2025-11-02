---
'markdown-to-jsx': major
---

Drop support for React versions less than 16

- Update peer dependency requirement from `>= 0.14.0` to `>= 16.0.0`
- Remove legacy code that wrapped string children in `<span>` elements for React < 16 compatibility
- Directly return single children and null without wrapper elements
