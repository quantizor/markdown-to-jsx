---
"markdown-to-jsx": minor
---

React Native output now exposes a style key for every element it draws, so nothing is stuck with a built-in look. New `styles` keys: `checkmark` and `gfmTaskChecked` (the checkmark glyph and the checked-box accent of a GFM task item), `tableHeaderText` (the bold header run), and `tableCellDivider` and `tableRowDivider` (the table grid lines). These join the existing bullet, number, and per-element keys, and each merges over the default so you can restyle just what you want. Blockquotes also render tighter: the last paragraph inside no longer leaves extra space below it.
