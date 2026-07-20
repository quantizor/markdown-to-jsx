---
"markdown-to-jsx": minor
---

React Native output now ships with a clean, minimal default look so markdown renders with a readable hierarchy out of the box: a heading size cascade, monospace code, spacing between blocks, a blockquote rule, a proper table with a header row and aligned columns, and GFM task items with a drawn checkbox in place of the bullet. Everything stays fully customizable, each element merges your `styles` over the defaults per property, `styles.text` sets a base font and color for all text at once, and any element can be replaced with your own component via `overrides`.
