---
"markdown-to-jsx": patch
---

Text on its own line after a nested HTML element (such as content following `</summary>` inside `<details>`) now renders instead of being dropped or misplaced when no blank line separates them. This now behaves consistently across the React, React Native, Solid, and Vue outputs.
