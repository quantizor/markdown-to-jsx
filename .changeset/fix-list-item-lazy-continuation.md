---
"markdown-to-jsx": patch
---

Fix lazy continuation lines for list items when continuation text appears at base indentation without a blank line before it. Previously, such lines were incorrectly parsed as separate paragraphs instead of being appended to the list item content.
